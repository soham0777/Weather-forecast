/**
 * Display helpers.
 *
 * Amounts arrive from the API as strings ("45230.75"). They are formatted
 * and compared as strings / BigInt paise - never converted to floating point.
 */

export function toPaise(amount) {
  const text = String(amount ?? '').trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null
  const negative = text.startsWith('-')
  const [whole, fraction = ''] = text.replace('-', '').split('.')
  const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
  return negative ? -paise : paise
}

export function paiseToString(paise) {
  const negative = paise < 0n
  const abs = negative ? -paise : paise
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`
}

/** "45230.75" -> "₹45,230.75" (Indian digit grouping: 12,34,567.89). */
export function formatINR(amount) {
  const paise = toPaise(amount)
  if (paise === null) return amount ?? '—'
  const [whole, fraction] = paiseToString(paise < 0n ? -paise : paise).split('.')
  const last3 = whole.slice(-3)
  const rest = whole.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
  return `${paise < 0n ? '−' : ''}₹${grouped}.${fraction}`
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }) + ' IST'
}

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export function prettyJson(value) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value, null, 2)
}

/** Re-indent an XML document for display. Returns the input unchanged if it is not valid XML. */
export function formatXml(xml) {
  if (!xml) return ''
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return xml

  const declaration = xml.trimStart().startsWith('<?xml') ? xml.trimStart().split('?>')[0] + '?>\n' : ''
  const escapeText = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const escapeAttr = (t) => escapeText(t).replace(/"/g, '&quot;')

  const render = (node, depth) => {
    const pad = '  '.repeat(depth)
    if (node.nodeType === Node.COMMENT_NODE) return `${pad}<!--${node.nodeValue}-->`
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join('')
    const children = Array.from(node.childNodes).filter(
      (c) => c.nodeType === Node.ELEMENT_NODE || c.nodeType === Node.COMMENT_NODE ||
        (c.nodeType === Node.TEXT_NODE && c.nodeValue.trim()),
    )
    if (!children.length) return `${pad}<${node.nodeName}${attrs}/>`
    if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
      return `${pad}<${node.nodeName}${attrs}>${escapeText(children[0].nodeValue.trim())}</${node.nodeName}>`
    }
    const inner = children
      .map((c) => (c.nodeType === Node.TEXT_NODE ? `${pad}  ${escapeText(c.nodeValue.trim())}` : render(c, depth + 1)))
      .join('\n')
    return `${pad}<${node.nodeName}${attrs}>\n${inner}\n${pad}</${node.nodeName}>`
  }
  return declaration + render(doc.documentElement, 0)
}

export function randomKey(prefix) {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}-${part}`
}

export function randomRrn() {
  // 12-digit retrieval reference number, as used by ATM switches.
  return String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}
