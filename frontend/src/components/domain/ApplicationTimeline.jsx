import { CalendarCheck, CalendarX, CheckCircle2, Circle, Eye, FileText, ListChecks, Trophy, Undo2, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

const ICONS = {
  STATUS_PENDING: { icon: FileText, className: 'bg-slate-100 text-slate-600' },
  UNDER_REVIEW: { icon: Eye, className: 'bg-blue-100 text-blue-700' },
  STATUS_SHORTLISTED: { icon: ListChecks, className: 'bg-indigo-100 text-indigo-700' },
  INTERVIEW_SCHEDULED: { icon: CalendarCheck, className: 'bg-blue-100 text-blue-700' },
  INTERVIEW_COMPLETED: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  INTERVIEW_CANCELLED: { icon: CalendarX, className: 'bg-slate-100 text-slate-600' },
  STATUS_ACCEPTED: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  STATUS_REJECTED: { icon: XCircle, className: 'bg-rose-100 text-rose-700' },
  STATUS_WITHDRAWN: { icon: Undo2, className: 'bg-slate-100 text-slate-600' },
  COMPLETED: { icon: Trophy, className: 'bg-amber-100 text-amber-700' },
};

/** Vertical timeline of real, time-stamped events returned by the API. */
export default function ApplicationTimeline({ events }) {
  if (!events?.length) return <p className="text-sm text-slate-500">No events recorded yet.</p>;
  return (
    <ol className="relative space-y-6">
      {events.map((event, index) => {
        const meta = ICONS[event.type] || { icon: Circle, className: 'bg-slate-100 text-slate-500' };
        const Icon = meta.icon;
        const last = index === events.length - 1;
        return (
          <li key={`${event.type}-${event.timestamp}-${index}`} className="relative flex gap-4">
            {!last && <span className="absolute left-4 top-9 -bottom-6 w-px bg-slate-200" aria-hidden="true" />}
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-sm font-semibold text-slate-900">{event.title}</p>
              <p className="text-xs text-slate-500">
                <time dateTime={event.timestamp}>{formatDateTime(event.timestamp)}</time>
                {event.actor && <> · by {event.actor}</>}
              </p>
              {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
