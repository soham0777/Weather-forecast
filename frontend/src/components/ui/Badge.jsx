import { STATUS_META, TONES } from '../../utils/constants';

export function Badge({ tone = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset
      whitespace-nowrap ${TONES[tone] || TONES.gray} ${className}`}>
      {children}
    </span>
  );
}

/** Consistent badge for any controlled status value (PENDING, OPEN, SHORTLISTED, ...). */
export function StatusBadge({ status, className }) {
  if (!status) return null;
  const meta = STATUS_META[status] || { label: status, tone: 'gray' };
  return <Badge tone={meta.tone} className={className}>{meta.label}</Badge>;
}
