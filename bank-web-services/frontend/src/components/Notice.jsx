import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

const TONES = {
  info: { box: 'border-indigo-200 bg-indigo-50 text-indigo-900', icon: Info, iconColor: 'text-indigo-600' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CircleCheck, iconColor: 'text-emerald-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: TriangleAlert, iconColor: 'text-amber-600' },
  error: { box: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert, iconColor: 'text-red-600' },
}

/** Callout box used for explanations, hints and friendly error messages. */
export default function Notice({ tone = 'info', title, children, className = '', role }) {
  const t = TONES[tone]
  const IconComponent = t.icon
  return (
    <div className={`flex gap-3 rounded-lg border p-3 text-sm ${t.box} ${className}`} role={role || (tone === 'error' ? 'alert' : undefined)}>
      <IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${t.iconColor}`} aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
