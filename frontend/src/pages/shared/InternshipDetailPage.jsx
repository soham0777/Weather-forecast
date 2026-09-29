import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, Building2, CheckCircle2, Edit3, Lock, Send, Unlock, XCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DescriptionList from '../../components/ui/DescriptionList';
import DataTable from '../../components/ui/DataTable';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { FormField, Textarea } from '../../components/ui/FormField';
import { Alert, ErrorState, PageLoader } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage } from '../../services/api';
import { applicationService, internshipService } from '../../services/endpoints';
import { deadlineLabel, formatDate, formatDateTime, formatStipend } from '../../utils/format';

/** Internship details for every role; staff get management actions and the applicant list. */
export default function InternshipDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = useRoleBase();
  const toast = useToast();
  const navigate = useNavigate();
  const isStudent = user.role === 'STUDENT';
  const isAdmin = user.role === 'ADMIN';
  const { data: internship, setData, loading, error, reload } = useApi(() => internshipService.get(id), [id]);
  const applicants = useApi(
    () => (isStudent ? Promise.resolve(null) : applicationService.list({ internshipId: id, size: 50 })), [id, isStudent]);
  const [dialog, setDialog] = useState(null); // { type, status }
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !internship) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!internship) return null;

  const changeStatus = async (status) => {
    setBusy(true);
    try {
      const updated = await internshipService.changeStatus(id, status, remarks.trim() || null);
      setData(updated);
      toast.success(`Internship ${status === 'OPEN' ? 'opened for applications' : status.toLowerCase()}.`);
      setDialog(null);
      setRemarks('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const result = await internshipService.remove(id);
      toast.success(result.message);
      navigate(`${base}/internships`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  const s = internship.status;
  const staffActions = !isStudent && (
    <>
      {isAdmin && s === 'PENDING' && (
        <>
          <Button variant="success" icon={CheckCircle2} onClick={() => setDialog({ type: 'status', status: 'APPROVED' })}>Approve</Button>
          <Button variant="danger" icon={XCircle} onClick={() => setDialog({ type: 'status', status: 'REJECTED' })}>Reject</Button>
        </>
      )}
      {(s === 'APPROVED' || s === 'CLOSED') && (
        <Button icon={Unlock} onClick={() => setDialog({ type: 'status', status: 'OPEN' })}>Open applications</Button>
      )}
      {s === 'OPEN' && <Button variant="secondary" icon={Lock} onClick={() => setDialog({ type: 'status', status: 'CLOSED' })}>Close applications</Button>}
      {s !== 'ARCHIVED' && <Button variant="secondary" icon={Edit3} to={`${base}/internships/${id}/edit`}>Edit</Button>}
      {s !== 'ARCHIVED' && (
        <Button variant="ghost" icon={Archive} onClick={() => setDialog({ type: 'delete' })}>
          {['PENDING', 'REJECTED'].includes(s) && !internship.applicationCount ? 'Delete' : 'Archive'}
        </Button>
      )}
    </>
  );

  const studentAction = isStudent && (
    internship.myApplicationId
      ? <Button to={`/student/applications/${internship.myApplicationId}`} variant="secondary">View my application</Button>
      : internship.acceptingApplications
        ? <Button icon={Send} to={`/student/internships/${id}/apply`}>Apply now</Button>
        : null
  );

  const dialogCopy = {
    APPROVED: { title: 'Approve internship', message: 'Approve this internship? The coordinator can then open it for applications.', label: 'Approve', tone: 'primary' },
    REJECTED: { title: 'Reject internship', message: 'Reject this internship? Please tell the coordinator what needs to change.', label: 'Reject', tone: 'danger' },
    OPEN: { title: 'Open applications', message: 'Students will be able to see and apply for this internship until the deadline.', label: 'Open applications', tone: 'primary' },
    CLOSED: { title: 'Close applications', message: 'Students will no longer be able to apply. Existing applications are kept.', label: 'Close applications', tone: 'danger' },
  };
  const current = dialog?.type === 'status' ? dialogCopy[dialog.status] : null;

  return (
    <>
      <PageHeader title={internship.title} backTo={`${base}/internships`} backLabel="Back to internships"
                  description={`${internship.companyName} · ${internship.location}`}
                  actions={<>{staffActions}{studentAction}</>} />

      {s === 'REJECTED' && internship.reviewRemarks && (
        <div className="mb-6"><Alert tone="error" title="Rejected by the administrator">{internship.reviewRemarks}
          {!isStudent && ' Edit the internship to resubmit it for approval.'}</Alert></div>
      )}
      {s === 'PENDING' && !isStudent && (
        <div className="mb-6"><Alert tone="warning" title="Awaiting admin approval">Students cannot see this internship until it is approved and opened.</Alert></div>
      )}
      {isStudent && internship.myApplicationStatus && (
        <div className="mb-6"><Alert tone="info">You applied for this internship. Current status: <StatusBadge status={internship.myApplicationStatus} /></Alert></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="About the internship" actions={<StatusBadge status={s} />} />
            <CardBody><p className="text-sm leading-6 whitespace-pre-line text-slate-700">{internship.description}</p></CardBody>
          </Card>
          {!isStudent && (
            <Card>
              <CardHeader title="Applicants" description={`${internship.applicationCount ?? 0} application(s)`} />
              <DataTable
                loading={applicants.loading} error={applicants.error} onRetry={applicants.reload}
                rows={applicants.data?.content} emptyTitle="No applications found."
                emptyMessage={internship.acceptingApplications ? 'Applications will appear here as students apply.' : undefined}
                columns={[
                  { key: 'student', header: 'Student', render: (a) => (
                    <div><p className="font-medium text-slate-900">{a.student.name}</p><p className="text-xs text-slate-500">{a.student.department} · CGPA {a.student.gpa}</p></div>) },
                  { key: 'appliedAt', header: 'Applied', render: (a) => formatDateTime(a.appliedAt) },
                  { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
                  { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => (
                    <Link className="text-sm font-medium text-brand-700 hover:underline" to={`${base}/applications/${a.id}`}>Review</Link>) },
                ]} />
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Key details" />
            <CardBody>
              <DescriptionList columns={1} items={[
                { label: 'Domain', value: internship.domain },
                { label: 'Stipend', value: formatStipend(internship.stipend) },
                { label: 'Duration', value: `${internship.durationWeeks} weeks` },
                { label: 'Start – end', value: `${formatDate(internship.startDate)} – ${formatDate(internship.endDate)}` },
                { label: 'Application deadline', value: (
                  <span>{formatDate(internship.applicationDeadline)}{internship.acceptingApplications && (
                    <span className="ml-2 text-xs font-medium text-amber-700">{deadlineLabel(internship.applicationDeadline)}</span>)}</span>) },
                { label: 'Faculty coordinator', value: internship.facultyName },
                !isStudent && internship.reviewedAt ? { label: 'Reviewed', value: `${formatDateTime(internship.reviewedAt)}${internship.reviewRemarks ? ` — ${internship.reviewRemarks}` : ''}` } : null,
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Company" icon={Building2} />
            <CardBody>
              <p className="font-medium text-slate-900">{internship.companyName}</p>
              <p className="text-sm text-slate-500">{internship.location}</p>
              <Link to={`${base}/companies/${internship.companyId}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
                View company profile, ratings and feedback
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={Boolean(current)} title={current?.title} message={current?.message} confirmLabel={current?.label}
                     tone={current?.tone} loading={busy} onCancel={() => { setDialog(null); setRemarks(''); }}
                     onConfirm={() => {
                       if (dialog.status === 'REJECTED' && !remarks.trim()) { toast.error('Please enter a reason for rejection.'); return; }
                       changeStatus(dialog.status);
                     }}>
        {(dialog?.status === 'APPROVED' || dialog?.status === 'REJECTED') && (
          <FormField label={dialog.status === 'REJECTED' ? 'Reason for rejection' : 'Remarks (optional)'} required={dialog.status === 'REJECTED'}>
            {(p) => <Textarea {...p} rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />}
          </FormField>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={dialog?.type === 'delete'} title="Remove internship" loading={busy} confirmLabel="Yes, continue"
                     message={['PENDING', 'REJECTED'].includes(s) && !internship.applicationCount
                       ? 'This internship has no applications and will be permanently deleted.'
                       : 'Are you sure you want to archive this internship? It will be hidden from students but its applications and history are kept.'}
                     onCancel={() => setDialog(null)} onConfirm={remove} />
    </>
  );
}
