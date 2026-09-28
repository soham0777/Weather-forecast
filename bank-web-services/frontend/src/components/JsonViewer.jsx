import { Fragment, useMemo } from 'react'
import CodeBlock from './CodeBlock'
import { prettyJson } from '../services/format'

const TOKEN = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],])/g

/** Tokenise pretty-printed JSON into coloured React spans (no innerHTML). */
function highlightJson(text) {
  const parts = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    let cls = 'tok-number'
    if (token.startsWith('"')) cls = token.trimEnd().endsWith(':') ? 'tok-key' : 'tok-string'
    else if (/^(true|false|null)$/.test(token)) cls = 'tok-literal'
    else if (/^[{}[\],]$/.test(token)) cls = 'tok-punct'
    parts.push(<span key={match.index} className={cls}>{token}</span>)
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)
}

export default function JsonViewer({ data, title = 'JSON', maxHeight }) {
  const text = useMemo(() => (data === undefined ? '' : prettyJson(data)), [data])
  const highlighted = useMemo(() => highlightJson(text), [text])
  return (
    <CodeBlock title={title} language="application/json" text={text} maxHeight={maxHeight}>
      {highlighted}
    </CodeBlock>
  )
}
