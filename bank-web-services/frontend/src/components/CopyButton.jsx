import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyButton({ text, label = 'Copy', dark = false }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for browsers that block the async clipboard API (e.g. plain http on a LAN IP).
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const tone = dark ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
  return (
    <button type="button" onClick={copy} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${tone}`}
      aria-label={copied ? 'Copied to clipboard' : `${label} to clipboard`}>
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  )
}
