import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Edit3, Star } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { RatingDisplay } from '../../components/ui/StarRating';
import RatingFormModal from '../../components/domain/RatingFormModal';
import { EVALUATION_RATINGS, EVALUATION_TEXTS } from '../../components/domain/ratingConfigs';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage } from '../../services/api';
import { evaluationService } from '../../services/endpoints';
import { PAGE_SIZE } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';

/** Faculty/admin: interns awaiting evaluation and recorded evaluations (1–5 ratings). */
export default function EvaluationsPage() {
  const { user } = useAuth();
  const base = useRoleBase();
  const toast = useToast();
  const isAdmin = user.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const q = useDebounce(search);
  const pending = useApi(() => evaluationService.pending(), []);
  const list = useApi(() => evaluationService.list({ q, page, size: PAGE_SIZE, includeArchived }), [q, page, includeArchived]);
  const [modal, setModal] = useState(null); // { application } or { evaluation }
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => { pending.reload(); list.reload(); };

  const archive = async () => {
    setBusy(true);
    try {
      await evaluationService.archive(archiveTarget.id);
      toast.success('Evaluation archived.');
      setArchiveTarget(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const target = modal?.application || modal?.evaluation;
  return (
    <>
      <PageHeader title="Evaluations" description="Rate accepted interns on six criteria (1–5) plus an overall rating." />

      <Card className="mb-6">
        <CardHeader title="Awaiting your evaluation" description="Accepted interns whose internship has started." icon={Star} />
        <DataTable loading={pending.loading} error={pending.error} onRetry={pending.reload} rows={pending.data}
                   emptyTitle="No interns are waiting for your evaluation."
                   columns={[
                     { key: 'student', header: 'Student', render: (a) => (<div><p className="font-medium text-slate-900">{a.student.name}</p><p className="text-xs text-slate-500">{a.student.department}</p></div>) },
                     { key: 'internship', header: 'Internship', render: (a) => (<div><p>{a.internship.title}</p><p className="text-xs text-slate-500">{a.internship.companyName}</p></div>) },
                     { key: 'dates', header: 'Dates', render: (a) => <span className="whitespace-nowrap">{formatDate(a.internship.startDate)} – {formatDate(a.internship.endDate)}</span> },
                     { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => (
                       <Button size="sm" icon={Star} onClick={() => setModal({ application: a })}>Evaluate</Button>) },
                   ]} />
      </Card>

      <Card>
        <CardHeader title="Recorded evaluations"
                    actions={isAdmin && (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); setPage(0); }}
                               className="h-4 w-4 rounded border-slate-300 text-brand-700" />
                        Show archived
                      </label>
                    )} />
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search evaluations" className="max-w-md"
                       placeholder="Search by student or internship" />
        </div>
        <DataTable loading={list.loading} error={list.error} onRetry={list.reload} rows={list.data?.content}
                   emptyTitle="No evaluations recorded yet."
                   columns={[
                     { key: 'student', header: 'Student', render: (e) => (
                       <Link to={`${base}/applications/${e.applicationId}`} className="font-medium text-slate-900 hover:text-brand-700">{e.studentName}</Link>) },
                     { key: 'internship', header: 'Internship', render: (e) => (<div><p>{e.internshipTitle}</p><p className="text-xs text-slate-500">{e.companyName}</p></div>) },
                     { key: 'avg', header: 'Criteria average', render: (e) => <RatingDisplay value={e.averageCriteriaScore} /> },
                     { key: 'overall', header: 'Overall', render: (e) => <RatingDisplay value={e.overallRating} /> },
                     { key: 'by', header: 'Evaluator', render: (e) => (<div><p>{e.evaluatorName}</p><p className="text-xs text-slate-500">{formatDateTime(e.updatedAt)}</p></div>) },
                     { key: 'actions', header: <span className="sr-only">Actions</span>, render: (e) => (e.archived
                       ? <Badge>Archived</Badge>
                       : (e.evaluatorId === user.id || isAdmin) && (
                         <div className="flex justify-end gap-1.5">
                           <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ evaluation: e })}>Edit</Button>
                           <Button size="sm" variant="ghost" icon={Archive} onClick={() => setArchiveTarget(e)}>Archive</Button>
                         </div>)) },
                   ]} />
        <Pagination page={list.data} onChange={setPage} />
      </Card>

      {modal && (
        <RatingFormModal open title={modal.evaluation ? 'Edit evaluation' : 'Evaluate intern'}
                         description={modal.application ? `${target.student.name} · ${target.internship.title}` : `${target.studentName} · ${target.internshipTitle}`}
                         ratings={EVALUATION_RATINGS} texts={EVALUATION_TEXTS} initial={modal.evaluation || {}}
                         submitLabel="Save evaluation" successMessage="Evaluation saved."
                         onClose={(saved) => { setModal(null); if (saved) refresh(); }}
                         onSubmit={(values) => (modal.evaluation
                           ? evaluationService.update(modal.evaluation.id, { ...values, applicationId: modal.evaluation.applicationId })
                           : evaluationService.create({ ...values, applicationId: modal.application.id }))} />
      )}
      <ConfirmDialog open={Boolean(archiveTarget)} title="Archive evaluation" confirmLabel="Archive" loading={busy}
                     message="Archive this evaluation? It will no longer count in reports or be visible to the student."
                     onCancel={() => setArchiveTarget(null)} onConfirm={archive} />
    </>
  );
}
