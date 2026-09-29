import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Tabs from '../../components/ui/Tabs';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { FormField, Textarea } from '../../components/ui/FormField';
import InterviewFormModal from '../../components/domain/InterviewFormModal';
import InterviewResultModal from '../../components/domain/InterviewResultModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage } from '../../services/api';
import { interviewService } from '../../services/endpoints';
import { PAGE_SIZE } from '../../utils/constants';
import { formatDate, formatTime } from '../../utils/format';

const TABS = [{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past & results' }, { id: '', label: 'All' }];

/** Interview schedule: students see their own; faculty their internships'; admins all. */
export default function InterviewsPage() {
  const { user } = useAuth();
  const base = useRoleBase();
  const toast = useToast();
  const isStudent = user.role === 'STUDENT';
  const [scope, setScope] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(
    () => interviewService.list({ scope, q, page, size: PAGE_SIZE }), [scope, q, page]);
  const [modal, setModal] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      await interviewService.cancel(cancelTarget.id, reason.trim() || null);
      toast.success('Interview cancelled.');
      setCancelTarget(null);
      setReason('');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'when', header: 'Date & time', render: (i) => (
      <div className="whitespace-nowrap"><p className="font-medium text-slate-900">{formatDate(i.interviewDate)}</p><p className="text-xs text-slate-500">{formatTime(i.interviewTime)}</p></div>) },
    !isStudent && { key: 'student', header: 'Student', render: (i) => (
      <div><p className="font-medium text-slate-900">{i.studentName}</p><p className="text-xs text-slate-500">{i.studentEmail}</p></div>) },
    { key: 'internship', header: 'Internship', render: (i) => (
      <div className="min-w-[160px]"><p className="text-slate-900">{i.internshipTitle}</p><p className="text-xs text-slate-500">{i.companyName}</p></div>) },
    { key: 'interviewer', header: 'Interviewer', render: (i) => (
      <div className="min-w-[160px]"><p>{i.interviewerName}</p>{i.interviewerDetails && <p className="text-xs text-slate-500">{i.interviewerDetails}</p>}</div>) },
    { key: 'status', header: 'Status / result', render: (i) => (
      <div className="flex flex-col items-start gap-1"><StatusBadge status={i.status} />{i.result && <StatusBadge status={i.result} />}
        {i.comments && <p className="max-w-[220px] text-xs text-slate-500">{i.comments}</p>}</div>) },
    { key: 'actions', header: <span className="sr-only">Actions</span>, render: (i) => (
      <div className="flex flex-wrap justify-end gap-1.5">
        {!isStudent && i.status === 'SCHEDULED' && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'reschedule', interview: i })}>Reschedule</Button>
            <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'result', interview: i })}>Result</Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelTarget(i)}>Cancel</Button>
          </>
        )}
        <Link to={`${base}/applications/${i.applicationId}`} className="px-2 py-1.5 text-sm font-medium text-brand-700 hover:underline">Application</Link>
      </div>) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={isStudent ? 'My interviews' : 'Interviews'}
                  description={isStudent ? 'Upcoming interviews, previous interviews, results and feedback.'
                    : 'Scheduled interviews and results. Schedule new interviews from a shortlisted application.'} />
      <Tabs tabs={TABS} active={scope} onChange={(s) => { setScope(s); setPage(0); }} label="Interview period" />
      <Card>
        {!isStudent && (
          <div className="border-b border-slate-100 p-4">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search interviews" className="max-w-md"
                         placeholder="Search by student, internship or interviewer" />
          </div>
        )}
        <DataTable columns={columns} rows={data?.content} loading={loading} error={error} onRetry={reload}
                   emptyTitle={scope === 'upcoming' ? 'No upcoming interviews.' : 'No interviews found.'}
                   emptyMessage={scope === 'upcoming' && isStudent ? 'When a coordinator schedules an interview for you, it will appear here.' : undefined} />
        <Pagination page={data} onChange={setPage} />
      </Card>

      {modal?.type === 'reschedule' && (
        <InterviewFormModal open interview={modal.interview} onClose={() => setModal(null)} onSaved={reload} />
      )}
      {modal?.type === 'result' && <InterviewResultModal open interview={modal.interview} onClose={() => setModal(null)} onSaved={reload} />}
      <ConfirmDialog open={Boolean(cancelTarget)} title="Cancel interview" confirmLabel="Cancel interview" cancelLabel="Keep interview"
                     loading={busy} message={`Are you sure you want to cancel the interview with ${cancelTarget?.studentName}?`}
                     onCancel={() => { setCancelTarget(null); setReason(''); }} onConfirm={cancel}>
        <FormField label="Reason (shown to the student)">
          {(p) => <Textarea {...p} rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </FormField>
      </ConfirmDialog>
      {!isStudent && !loading && !data?.totalElements && scope === 'upcoming' && (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <CalendarClock className="h-4 w-4" aria-hidden="true" /> Tip: open a shortlisted application and choose <strong>Schedule interview</strong>.
        </p>
      )}
    </>
  );
}
