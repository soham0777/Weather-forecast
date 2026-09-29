import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
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
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage } from '../../services/api';
import { internshipService } from '../../services/endpoints';
import { PAGE_SIZE } from '../../utils/constants';
import { formatDate, formatDateTime, formatStipend } from '../../utils/format';

const TABS = [
  { id: '', label: 'All' }, { id: 'PENDING', label: 'Pending' }, { id: 'APPROVED', label: 'Approved' },
  { id: 'OPEN', label: 'Open' }, { id: 'CLOSED', label: 'Closed' }, { id: 'REJECTED', label: 'Rejected' },
  { id: 'ARCHIVED', label: 'Archived' },
];

/** Faculty: own internships. Admin: all internships, or the approval queue when `approvals`. */
export default function InternshipsManagePage({ approvals = false }) {
  const { user } = useAuth();
  const base = useRoleBase();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';
  const [status, setStatus] = useState(approvals ? 'PENDING' : '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(
    () => internshipService.list({ status, q, page, size: PAGE_SIZE, sort: approvals ? 'createdAt,asc' : undefined }),
    [status, q, page, approvals]);
  const [review, setReview] = useState(null); // { internship, status }
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async () => {
    if (review.status === 'REJECTED' && !remarks.trim()) {
      toast.error('Please enter a reason for rejection.');
      return;
    }
    setBusy(true);
    try {
      await internshipService.changeStatus(review.internship.id, review.status, remarks.trim() || null);
      toast.success(`"${review.internship.title}" ${review.status === 'APPROVED' ? 'approved' : 'rejected'}.`);
      setReview(null);
      setRemarks('');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'title', header: 'Internship', render: (i) => (
      <div className="min-w-[200px]">
        <Link to={`${base}/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link>
        <p className="text-xs text-slate-500">{i.companyName} · {i.domain}</p>
      </div>) },
    isAdmin ? { key: 'faculty', header: 'Coordinator', render: (i) => i.facultyName } : null,
    { key: 'dates', header: 'Deadline / start', render: (i) => (
      <div className="whitespace-nowrap text-sm"><p>{formatDate(i.applicationDeadline)}</p><p className="text-xs text-slate-500">Starts {formatDate(i.startDate)}</p></div>) },
    { key: 'stipend', header: 'Stipend', render: (i) => <span className="whitespace-nowrap">{formatStipend(i.stipend)}</span> },
    approvals ? { key: 'submitted', header: 'Submitted', render: (i) => formatDateTime(i.createdAt) }
      : { key: 'apps', header: 'Applications', className: 'text-center', render: (i) => i.applicationCount },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, render: (i) => (
      <div className="flex justify-end gap-2 whitespace-nowrap">
        {approvals && (
          <>
            <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => setReview({ internship: i, status: 'APPROVED' })}>Approve</Button>
            <Button size="sm" variant="secondary" icon={XCircle} onClick={() => setReview({ internship: i, status: 'REJECTED' })}>Reject</Button>
          </>
        )}
        <Button size="sm" variant="ghost" to={`${base}/internships/${i.id}`}>View</Button>
      </div>) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title={approvals ? 'Internship approvals' : isAdmin ? 'Internships' : 'My internships'}
        description={approvals ? 'Review internships submitted by faculty coordinators. Approved internships can then be opened for applications.'
          : isAdmin ? 'All internship postings across companies and coordinators.'
            : 'Internships you coordinate. New postings need admin approval before students can see them.'}
        actions={!approvals && <Button icon={Plus} to={`${base}/internships/new`}>{isAdmin ? 'New internship' : 'Post internship'}</Button>} />
      {!approvals && <Tabs tabs={TABS} active={status} onChange={(s) => { setStatus(s); setPage(0); }} label="Internship status" />}
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search internships"
                       placeholder="Search by title, company, domain or location" className="max-w-md" />
        </div>
        <DataTable columns={columns} rows={data?.content} loading={loading} error={error} onRetry={reload}
                   emptyTitle={approvals ? 'No internships are waiting for approval.' : 'No internships found.'}
                   emptyAction={!approvals && !isAdmin && <Button icon={Plus} to={`${base}/internships/new`}>Post your first internship</Button>} />
        <Pagination page={data} onChange={setPage} />
      </Card>

      <ConfirmDialog open={Boolean(review)} loading={busy}
                     title={review?.status === 'APPROVED' ? 'Approve internship' : 'Reject internship'}
                     tone={review?.status === 'APPROVED' ? 'primary' : 'danger'}
                     confirmLabel={review?.status === 'APPROVED' ? 'Approve' : 'Reject'}
                     message={`${review?.status === 'APPROVED' ? 'Approve' : 'Reject'} "${review?.internship.title}" (${review?.internship.companyName})?`}
                     onCancel={() => { setReview(null); setRemarks(''); }} onConfirm={decide}>
        <FormField label={review?.status === 'REJECTED' ? 'Reason for rejection' : 'Remarks (optional)'} required={review?.status === 'REJECTED'}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />}
        </FormField>
      </ConfirmDialog>
    </>
  );
}
