export default function PageHeader({ icon: IconComponent, title, subtitle, children, badges }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex items-start gap-3">
        {IconComponent && (
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-sm">
            <IconComponent className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600 sm:text-base">{subtitle}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
