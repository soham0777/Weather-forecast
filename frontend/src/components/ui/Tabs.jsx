/** Simple accessible tab bar; the parent renders the active panel. */
export default function Tabs({ tabs, active, onChange, label = 'Sections' }) {
  return (
    <div className="mb-4 overflow-x-auto border-b border-slate-200">
      <div role="tablist" aria-label={label} className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => onChange(tab.id)}
                    className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
                      ${selected ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
