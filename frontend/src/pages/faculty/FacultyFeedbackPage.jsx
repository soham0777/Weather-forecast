import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Edit3, MessageSquare } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/Badge';
import { RatingDisplay } from '../../components/ui/StarRating';
import { ErrorState, TableSkeleton } from '../../components/ui/States';
import RatingFormModal from '../../components/domain/RatingFormModal';
import PlatformFeedbackPanel from '../../components/domain/PlatformFeedbackPanel';
import StudentFeedbackTable from '../../components/domain/StudentFeedbackTable';
import {
  COMPANY_FEEDBACK_RATINGS, COMPANY_FEEDBACK_TEXTS, FACULTY_FEEDBACK_RATINGS, FACULTY_FEEDBACK_TEXTS,
} from '../../components/domain/ratingConfigs';
import { useApi } from '../../hooks/useApi';
import { applicationService, feedbackService, internshipService } from '../../services/endpoints';
import { formatDate, todayIso } from '../../utils/format';

const TABS = [
  { id: 'faculty', label: 'Internship quality' },
  { id: 'company', label: 'Company feedback on interns' },
  { id: 'student', label: 'Student feedback' },
  { id: 'platform', label: 'Platform feedback' },
];

function FacultyQualityTab() {
  const { data, loading, error, reload } = useApi(async () => {
    const [internships, mine] = await Promise.all([internshipService.list({ size: 100 }), feedbackService.facultyList({ size: 100 })]);
    return {
      internships: internships.content.filter((i) => ['APPROVED', 'OPEN', 'CLOSED', 'ARCHIVED'].includes(i.status)),
      mine: Object.fromEntries(mine.content.map((f) => [f.internshipId, f])),
    };
  }, []);
  const [modal, setModal] = useState(null);
  if (loading && !data) return <TableSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <Card>
      <CardHeader title="Assess your internships" description="Suitability for course objectives, learning outcomes and overall quality. Stored for quality assurance." />
      <DataTable rows={data.internships} emptyTitle="No approved internships yet."
                 columns={[
                   { key: 'title', header: 'Internship', render: (i) => (<div><Link to={`/faculty/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link><p className="text-xs text-slate-500">{i.companyName}</p></div>) },
                   { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
                   { key: 'quality', header: 'Quality rating', render: (i) => (data.mine[i.id] ? <RatingDisplay value={data.mine[i.id].internshipQuality} /> : '—') },
                   { key: 'actions', header: <span className="sr-only">Actions</span>, render: (i) => (data.mine[i.id]
                     ? <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ internship: i, feedback: data.mine[i.id] })}>Edit</Button>
                     : <Button size="sm" icon={MessageSquare} onClick={() => setModal({ internship: i })}>Give feedback</Button>) },
                 ]} />
      {modal && (
        <RatingFormModal open title="Internship quality feedback" description={`${modal.internship.title} · ${modal.internship.companyName}`}
                         ratings={FACULTY_FEEDBACK_RATINGS} texts={FACULTY_FEEDBACK_TEXTS} initial={modal.feedback || {}}
                         successMessage="Feedback saved." onClose={(saved) => { setModal(null); if (saved) reload(); }}
                         onSubmit={(values) => (modal.feedback
                           ? feedbackService.facultyUpdate(modal.feedback.id, { ...values, internshipId: modal.internship.id })
                           : feedbackService.facultyCreate({ ...values, internshipId: modal.internship.id }))} />
      )}
    </Card>
  );
}

function CompanyFeedbackTab() {
  const { data, loading, error, reload } = useApi(async () => {
    const [accepted, recorded] = await Promise.all([
      applicationService.list({ status: 'ACCEPTED', size: 100 }), feedbackService.companyList({ size: 100 }),
    ]);
    return { accepted: accepted.content, recorded: Object.fromEntries(recorded.content.map((f) => [f.applicationId, f])) };
  }, []);
  const [modal, setModal] = useState(null);
  if (loading && !data) return <TableSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const today = todayIso();
  return (
    <Card>
      <CardHeader title="Record the company's rating of each intern" icon={Award}
                  description="Companies do not log in; enter the ratings the company shared with you after the internship." />
      <DataTable rows={data.accepted} emptyTitle="No accepted interns yet."
                 columns={[
                   { key: 'student', header: 'Intern', render: (a) => (<div><Link to={`/faculty/applications/${a.id}`} className="font-medium text-slate-900 hover:text-brand-700">{a.student.name}</Link><p className="text-xs text-slate-500">{a.internship.title} · {a.internship.companyName}</p></div>) },
                   { key: 'dates', header: 'Ends', render: (a) => formatDate(a.internship.endDate) },
                   { key: 'hire', header: 'Hire likelihood', render: (a) => (data.recorded[a.id] ? <RatingDisplay value={data.recorded[a.id].hireLikelihood} /> : '—') },
                   { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => {
                     const existing = data.recorded[a.id];
                     if (existing) return <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ app: a, feedback: existing })}>Edit</Button>;
                     if (a.completedAt || a.internship.endDate < today) return <Button size="sm" icon={Award} onClick={() => setModal({ app: a })}>Record</Button>;
                     return <span className="text-xs text-slate-500">After the internship ends</span>;
                   } },
                 ]} />
      {modal && (
        <RatingFormModal open title="Company feedback on intern" description={`${modal.app.student.name} · ${modal.app.internship.companyName}`}
                         ratings={COMPANY_FEEDBACK_RATINGS} texts={COMPANY_FEEDBACK_TEXTS} initial={modal.feedback || {}}
                         successMessage="Company feedback saved." onClose={(saved) => { setModal(null); if (saved) reload(); }}
                         onSubmit={(values) => (modal.feedback
                           ? feedbackService.companyUpdate(modal.feedback.id, { ...values, applicationId: modal.app.id })
                           : feedbackService.companyCreate({ ...values, applicationId: modal.app.id }))} />
      )}
    </Card>
  );
}

export default function FacultyFeedbackPage() {
  const [tab, setTab] = useState('faculty');
  return (
    <>
      <PageHeader title="Feedback" description="Assess internship quality, record company feedback on interns and read student feedback." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Feedback sections" />
      {tab === 'faculty' && <FacultyQualityTab />}
      {tab === 'company' && <CompanyFeedbackTab />}
      {tab === 'student' && <StudentFeedbackTable />}
      {tab === 'platform' && <PlatformFeedbackPanel />}
    </>
  );
}
