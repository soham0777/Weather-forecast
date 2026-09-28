/** SOAP operations of the legacy Core Banking service (see GET /soap?wsdl). */
import { DEMO_ACCOUNT, DEMO_BENEFICIARY } from './demoClients'

export const SOAP_OPERATIONS = [
  {
    id: 'getBalance',
    label: 'Get Balance',
    icon: 'Wallet',
    description: 'Available and ledger balance - what an ATM shows on "Balance Enquiry".',
    service: 'banking_service.get_balance()',
    rest: 'GET /api/v1/accounts/{id}/balance',
    params: [{ name: 'accountNumber', label: 'Account number', required: true }],
    scenarios: [
      { id: 'normal', label: 'Normal request' },
      { id: 'unknown', label: 'Unknown account (Client fault)', patch: { accountNumber: '0000000000' } },
    ],
  },
  {
    id: 'getMiniStatement',
    label: 'Mini Statement',
    icon: 'ScrollText',
    description: 'Most recent transactions - the ATM "Mini Statement" receipt.',
    service: 'banking_service.get_mini_statement()',
    rest: 'GET /api/v1/accounts/{id}/transactions',
    params: [
      { name: 'accountNumber', label: 'Account number', required: true },
      { name: 'maxEntries', label: 'Max entries', required: false },
    ],
    scenarios: [
      { id: 'normal', label: 'Normal request' },
      { id: 'unknown', label: 'Unknown account (Client fault)', patch: { accountNumber: '0000000000' } },
    ],
  },
  {
    id: 'transferFunds',
    label: 'Fund Transfer',
    icon: 'ArrowLeftRight',
    description: 'Simulated intra-bank fund transfer from an ATM or branch counter.',
    service: 'banking_service.transfer_funds()',
    rest: 'POST /api/v1/accounts/{id}/transfers',
    params: [
      { name: 'fromAccount', label: 'From account', required: true },
      { name: 'toAccount', label: 'To account', required: true },
      { name: 'amount', label: 'Amount (INR)', required: true },
      { name: 'remarks', label: 'Remarks', required: false },
      { name: 'referenceId', label: 'Reference ID (RRN)', required: false },
    ],
    scenarios: [
      { id: 'normal', label: 'Normal request' },
      { id: 'insufficient', label: 'Insufficient funds (Client fault)', patch: { amount: '5000000.00' } },
      { id: 'invalid', label: 'Invalid amount (Client fault)', patch: { amount: '0' } },
      { id: 'beneficiary', label: 'Unknown beneficiary (Client fault)', patch: { toAccount: '1111111111' } },
    ],
  },
]

export const DEFAULT_SOAP_PARAMS = {
  accountNumber: DEMO_ACCOUNT,
  maxEntries: '5',
  fromAccount: DEMO_ACCOUNT,
  toAccount: DEMO_BENEFICIARY,
  amount: '500.00',
  currency: 'INR',
  remarks: 'Branch transfer',
}

export const SOAP_RESPONSE_EXAMPLES = {
  getBalance: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <ndb:getBalanceResponse>
      <ndb:accountNumber>1234567890</ndb:accountNumber>
      <ndb:customerName>Aarav Sharma</ndb:customerName>
      <ndb:availableBalance>45230.75</ndb:availableBalance>
      <ndb:ledgerBalance>47230.75</ndb:ledgerBalance>
      <ndb:currency>INR</ndb:currency>
      <ndb:asOf>2026-09-28T10:15:00+05:30</ndb:asOf>
    </ndb:getBalanceResponse>
  </soap:Body>
</soap:Envelope>`,
  getMiniStatement: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <ndb:getMiniStatementResponse>
      <ndb:accountNumber>1234567890</ndb:accountNumber>
      <ndb:currency>INR</ndb:currency>
      <ndb:availableBalance>45230.75</ndb:availableBalance>
      <ndb:entryCount>1</ndb:entryCount>
      <ndb:entries>
        <ndb:entry>
          <ndb:transactionId>TXN1021</ndb:transactionId>
          <ndb:date>2026-09-27</ndb:date>
          <ndb:type>DEBIT</ndb:type>
          <ndb:amount>500.00</ndb:amount>
          <ndb:description>ATM WDL/ATM-MUM-0107</ndb:description>
          <ndb:balanceAfter>45230.75</ndb:balanceAfter>
        </ndb:entry>
      </ndb:entries>
    </ndb:getMiniStatementResponse>
  </soap:Body>
</soap:Envelope>`,
  transferFunds: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <ndb:transferFundsResponse>
      <ndb:transferId>TRX10001</ndb:transferId>
      <ndb:status>COMPLETED</ndb:status>
      <ndb:fromAccount>1234567890</ndb:fromAccount>
      <ndb:toAccount>9876543210</ndb:toAccount>
      <ndb:amount>500.00</ndb:amount>
      <ndb:currency>INR</ndb:currency>
      <ndb:mode>INTERNAL</ndb:mode>
      <ndb:availableBalance>44730.75</ndb:availableBalance>
      <ndb:timestamp>2026-09-28T10:15:00+05:30</ndb:timestamp>
    </ndb:transferFundsResponse>
  </soap:Body>
</soap:Envelope>`,
  fault: `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Account 0000000000 does not exist.</faultstring>
      <detail>
        <ndb:BankingFault>
          <ndb:errorCode>ACCOUNT_NOT_FOUND</ndb:errorCode>
          <ndb:errorMessage>Account 0000000000 does not exist.</ndb:errorMessage>
          <ndb:requestId>3f2a9c1b7d4e</ndb:requestId>
        </ndb:BankingFault>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`,
}

export const SOAP_FAULT_CODES = [
  { code: 'ACCOUNT_NOT_FOUND', meaning: 'The account does not exist.', rest: 404 },
  { code: 'BENEFICIARY_NOT_FOUND', meaning: 'The destination account does not exist.', rest: 422 },
  { code: 'INVALID_AMOUNT', meaning: 'Amount is zero, negative, non-numeric or has more than 2 decimals.', rest: 400 },
  { code: 'INSUFFICIENT_FUNDS', meaning: 'Available balance is lower than the amount.', rest: 422 },
  { code: 'ACCOUNT_INACTIVE', meaning: 'Source or beneficiary account is dormant/frozen.', rest: 409 },
  { code: 'INVALID_REQUEST', meaning: 'A required element is missing or invalid.', rest: 400 },
  { code: 'MALFORMED_XML', meaning: 'The message is not well-formed XML.', rest: 400 },
  { code: 'UNKNOWN_OPERATION', meaning: 'The Body names an operation the service does not offer.', rest: 404 },
  { code: 'HOST_UNAVAILABLE', meaning: 'Simulated core banking outage (soap:Server fault).', rest: 503 },
]
