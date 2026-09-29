import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Clock, IndianRupee, MapPin } from 'lucide-react';
import { StatusBadge } from '../ui/Badge';
import { deadlineLabel, formatDate, formatStipend } from '../../utils/format';

/** Internship summary card used on the student browse page. */
export default function InternshipCard({ internship, to }) {
  const closing = deadlineLabel(internship.applicationDeadline);
  return (
    <article className="card flex h-full flex-col p-5 transition hover:border-brand-200 hover:shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">
            <Link to={to} className="hover:text-brand-700 focus:outline-none">
              {internship.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> {internship.companyName}
          </p>
        </div>
        {internship.myApplicationStatus
          ? <StatusBadge status={internship.myApplicationStatus} />
          : <StatusBadge status={internship.acceptingApplications ? 'OPEN' : internship.status} />}
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{internship.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" /><dt className="sr-only">Location</dt><dd>{internship.location}</dd></div>
        <div className="flex items-center gap-1.5"><IndianRupee className="h-4 w-4 text-slate-400" aria-hidden="true" /><dt className="sr-only">Stipend</dt><dd>{formatStipend(internship.stipend)}</dd></div>
        <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" aria-hidden="true" /><dt className="sr-only">Duration</dt><dd>{internship.durationWeeks} weeks</dd></div>
        <div className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" /><dt className="sr-only">Starts</dt><dd>Starts {formatDate(internship.startDate)}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{internship.domain}</span>
        <span className={`text-xs font-medium ${internship.acceptingApplications ? 'text-amber-700' : 'text-slate-500'}`}>
          {internship.acceptingApplications ? closing : internship.status === 'APPROVED' ? 'Applications open soon' : 'Not accepting applications'}
        </span>
      </div>
      <Link to={to} className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100">
        View details
      </Link>
    </article>
  );
}
