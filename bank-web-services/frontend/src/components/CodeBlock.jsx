import CopyButton from './CopyButton'

/** Dark code surface with a title bar and copy-to-clipboard. */
export default function CodeBlock({ title, language, text, children, maxHeight = '28rem', actions }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {title && <span className="truncate text-xs font-semibold tracking-wide text-slate-300 uppercase">{title}</span>}
          {language && <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{language}</span>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {text != null && <CopyButton text={text} dark />}
        </div>
      </div>
      <pre className="code-surface rounded-none" style={{ maxHeight }} tabIndex={0}>
        <code>{children ?? text}</code>
      </pre>
    </div>
  )
}
