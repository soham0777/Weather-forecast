import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../../utils/validation';

/** Live checklist of the password policy (8+ chars, upper, lower, digit, special). */
export default function PasswordChecklist({ value }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value || '');
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{rule.label}</span><span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
