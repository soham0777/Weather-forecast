import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, MessageSquare } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import { RatingDisplay } from '../../components/ui/StarRating';
import RatingFormModal from '../../components/domain/RatingFormModal';
import RatingsSummary from '../../components/domain/RatingsSummary';
import PlatformFeedbackPanel from '../../components/domain/PlatformFeedbackPanel';
import { COMPANY_FEEDBACK_RATINGS, STUDENT_FEEDBACK_RATINGS, STUDENT_FEEDBACK_TEXTS } from '../../components/domain/ratingConfigs';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/ui/States';
import { useApi } from '../../hooks/useApi';
import { applicationService, evaluationService, feedbackService } from '../../services/endpoints';
import { formatDate, formatDateTime, todayIso } from '../../utils/format';

const TABS = [
  { id: 'internship', label: 'Internship feedback' },
  { id: 'performance', label: 'Feedback on my performance' },
  { id: 'platform', label: 'Platform feedback' },
];

function InternshipFeedbackTab() {
  const { data, loading, error, reload } = useApi(async () => {
    const [accepted, mine] = await Promise.all([
      applicationService.list({ status: 'ACCEPTED', size: 50 }),
      feedbackService.studentList({ size: 50 }),
    ]);
    return { accepted: accepted.content, mine: mine.content };
  }, []);
  const [modal, setModal] = useState(null);
  if (loading && !data) return <TableSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const byApp = Object.fromEntries(data.mine.map((f) => [f.applicationId, f]));
  const today = todayIso();

  return (
    <Card>
      <CardHeader title="Rate your internships" description="Share your post-internship experience: company culture, mentorship, learning and environment." />
      <DataTable rows={data.accepted} emptyTitle="No completed internships yet."
                 emptyMessage="Once you finish an accepted internship you can give feedback here."
                 columns={[
                   { key: 'internship', header: 'Internship', render: (a) => (<div><p className="font-medium text-slate-900">{a.internship.title}</p><p className="text-xs text-slate-500">{a.internship.companyName}</p></div>) },
                   { key: 'dates', header: 'Dates', render: (a) => <span className="whitespace-nowrap">{formatDate(a.internship.startDate)} – {formatDate(a.internship.endDate)}</span> },
                   { key: 'rating', header: 'Your rating', render: (a) => (byApp[a.id] ? <RatingDisplay value={byApp[a.id].overallExperience} /> : '—') },
                   { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => {
                     const existing = byApp[a.id];
                     const finished = a.completedAt || a.internship.endDate < today;
                     if (existing) return <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ app: a, feedback: existing })}>Edit</Button>;
                     if (finished) return <Button size="sm" icon={MessageSquare} onClick={() => setModal({ app: a })}>Give feedback</Button>;
                     return <span className="text-xs text-slate-500">Available after the internship ends</span>;
                   } },
                 ]} />
      {modal && (
        <RatingFormModal open title="Internship feedback" description={`${modal.app.internship.title} at ${modal.app.internship.companyName}`}
                         ratings={STUDENT_FEEDBACK_RATINGS} texts={STUDENT_FEEDBACK_TEXTS} initial={modal.feedback || {}}
                         successMessage="Thank you for your feedback." submitLabel="Submit feedback"
                         onClose={(saved) => { setModal(null); if (saved) reload(); }}
                         onSubmit={(values) => (modal.feedback
                           ? feedbackService.studentUpdate(modal.feedback.id, { ...values, applicationId: modal.app.id })
                           : feedbackService.studentCreate({ ...values, applicationId: modal.app.id }))} />
      )}
    </Card>
  );
}

function PerformanceTab() {
  const { data, loading, error, reload } = useApi(async () => {
    const [evaluations, company] = await Promise.all([evaluationService.list({ size: 50 }), feedbackService.companyList({ size: 50 })]);
    return { evaluations: evaluations.content, company: company.content };
  }, []);
  if (loading && !data) return <TableSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.evaluations.length && !data.company.length) {
    return <div className="card"><EmptyState title="No feedback on your performance yet." message="Evaluations from your faculty coordinator and the company appear here after your internship." /></div>;
  }
  return (
    <div className="space-y-6">
      {data.evaluations.map((e) => (
        <Card key={`e${e.id}`}>
          <CardHeader title={`Faculty evaluation · ${e.internshipTitle}`} description={`${e.companyName} · by ${e.evaluatorName} · ${formatDateTime(e.updatedAt)}`}
                      actions={<span className="text-sm text-slate-600">Overall <RatingDisplay value={e.overallRating} /></span>} />
          <CardBody>
            <RatingsSummary fields={COMPANY_FEEDBACK_RATINGS.slice(0, 6)} values={e} />
            {e.comments && <p className="mt-3 text-sm text-slate-600">“{e.comments}”</p>}
          </CardBody>
        </Card>
      ))}
      {data.company.map((f) => (
        <Card key={`c${f.id}`}>
          <CardHeader title={`Company feedback · ${f.internshipTitle}`} description={`${f.companyName}${f.companyRepresentative ? ` · ${f.companyRepresentative}` : ''}`} />
          <CardBody className="space-y-3">
            <RatingsSummary fields={COMPANY_FEEDBACK_RATINGS} values={f} />
            {f.strengths && <p className="text-sm"><span className="font-medium text-slate-700">Strengths: </span>{f.strengths}</p>}
            {f.areasForImprovement && <p className="text-sm"><span className="font-medium text-slate-700">Areas for improvement: </span>{f.areasForImprovement}</p>}
            {f.comments && <p className="text-sm text-slate-600">“{f.comments}”</p>}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export default function StudentFeedbackPage() {
  const [tab, setTab] = useState('internship');
  return (
    <>
      <PageHeader title="Feedback" description={<>Rate your internships, read feedback on your performance and help us improve CIMS. See also <Link className="text-brand-700 hover:underline" to="/student/reports">Reports</Link>.</>} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Feedback sections" />
      {tab === 'internship' && <InternshipFeedbackTab />}
      {tab === 'performance' && <PerformanceTab />}
      {tab === 'platform' && <PlatformFeedbackPanel />}
    </>
  );
}
