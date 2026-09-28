/**
 * SOAP client helpers: build SOAP 1.1 envelopes, send them, read the replies.
 *
 * A legacy ATM switch or branch system would do exactly this: POST an XML
 * envelope to one URL (/soap) with a SOAPAction header naming the operation.
 */
import { sendRequest } from './api'

export const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/'
export const NDB_NS = 'http://bank.local/soap/corebanking/v1'

export const CONSUMERS = {
  ATM: { id: 'ATM', name: 'ATM Switch', terminalId: 'ATM-PUNE-0042' },
  BRANCH: { id: 'BRANCH', name: 'Branch Software', terminalId: 'BR-MUM-0101/TELLER-07' },
}

const escapeXml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const field = (name, value, indent = '      ') =>
  value === undefined || value === null || value === '' ? '' : `\n${indent}<ndb:${name}>${escapeXml(value)}</ndb:${name}>`

/** Operation name -> element fields, in the order the WSDL defines them. */
const OPERATION_FIELDS = {
  getBalance: (p) => field('accountNumber', p.accountNumber),
  getMiniStatement: (p) => field('accountNumber', p.accountNumber) + field('maxEntries', p.maxEntries),
  transferFunds: (p) =>
    field('fromAccount', p.fromAccount) +
    field('toAccount', p.toAccount) +
    field('amount', p.amount) +
    field('currency', p.currency) +
    field('remarks', p.remarks) +
    field('referenceId', p.referenceId),
}

export function buildEnvelope({ consumer, operation, params }) {
  const c = CONSUMERS[consumer]
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}"
               xmlns:ndb="${NDB_NS}">
  <soap:Header>
    <ndb:ConsumerInfo>
      <ndb:channel>${c.id}</ndb:channel>
      <ndb:terminalId>${escapeXml(c.terminalId)}</ndb:terminalId>
    </ndb:ConsumerInfo>
  </soap:Header>
  <soap:Body>
    <ndb:${operation}>${OPERATION_FIELDS[operation](params)}
    </ndb:${operation}>
  </soap:Body>
</soap:Envelope>`
}

export function soapHeaders(operation, simulate) {
  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    SOAPAction: `"${NDB_NS}/${operation}"`,
  }
  if (simulate) headers['X-Demo-Simulate'] = simulate
  return headers
}

export function sendSoap(xml, operation, { simulate } = {}) {
  return sendRequest({ method: 'POST', path: '/soap', headers: soapHeaders(operation, simulate), data: xml })
}

/** Extract the useful bits of a SOAP response (result fields or the fault). */
export function parseSoapResponse(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText || '', 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return null
  const body = doc.getElementsByTagNameNS(SOAP_NS, 'Body')[0]
  if (!body) return null

  const fault = body.getElementsByTagNameNS(SOAP_NS, 'Fault')[0]
  if (fault) {
    const text = (tag) => fault.getElementsByTagName(tag)[0]?.textContent ?? ''
    const detail = (tag) => fault.getElementsByTagNameNS(NDB_NS, tag)[0]?.textContent ?? ''
    return {
      fault: {
        faultcode: text('faultcode'),
        faultstring: text('faultstring'),
        errorCode: detail('errorCode'),
        errorMessage: detail('errorMessage'),
      },
    }
  }

  const result = Array.from(body.children)[0]
  if (!result) return null
  const fields = {}
  const entries = []
  Array.from(result.children).forEach((child) => {
    if (child.localName === 'entries') {
      Array.from(child.children).forEach((entry) => {
        const row = {}
        Array.from(entry.children).forEach((f) => (row[f.localName] = f.textContent))
        entries.push(row)
      })
    } else {
      fields[child.localName] = child.textContent
    }
  })
  return { operation: result.localName, fields, entries }
}
