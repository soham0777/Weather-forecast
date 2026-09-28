import { Fragment, useMemo } from 'react'
import CodeBlock from './CodeBlock'
import { formatXml } from '../services/format'

const TAG = /(<!--[\s\S]*?-->)|(<\?[\s\S]*?\?>)|(<\/?)([\w.-]+:)?([\w.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*\/?>)/g
const ATTR = /([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/g

function highlightAttributes(text, keyBase) {
  const parts = []
  let last = 0
  for (const m of text.matchAll(ATTR)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<span key={`${keyBase}-a${m.index}`} className="tok-attr">{m[1]}</span>)
    parts.push(<span key={`${keyBase}-e${m.index}`} className="tok-punct">{m[2]}</span>)
    parts.push(<span key={`${keyBase}-v${m.index}`} className="tok-string">{m[3]}</span>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Tokenise XML into coloured React spans: tags, namespace prefixes, attributes, text. */
function highlightXml(text) {
  const parts = []
  let last = 0
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const k = m.index
    if (m[1] || m[2]) {
      parts.push(<span key={k} className="tok-comment">{m[0]}</span>)
    } else {
      parts.push(
        <Fragment key={k}>
          <span className="tok-punct">{m[3]}</span>
          {m[4] && <span className="tok-prefix">{m[4]}</span>}
          <span className="tok-tag">{m[5]}</span>
          {highlightAttributes(m[6], k)}
          <span className="tok-punct">{m[7]}</span>
        </Fragment>,
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function XmlViewer({ xml, title = 'XML', format = true, maxHeight }) {
  const text = useMemo(() => (format ? formatXml(xml || '') : xml || ''), [xml, format])
  const highlighted = useMemo(() => highlightXml(text), [text])
  return (
    <CodeBlock title={title} language="text/xml" text={text} maxHeight={maxHeight}>
      {highlighted}
    </CodeBlock>
  )
}
