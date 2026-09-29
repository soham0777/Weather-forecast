import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { RatingDisplay } from '../../components/ui/StarRating';
import PlatformFeedbackPanel from '../../components/domain/PlatformFeedbackPanel';
import StudentFeedbackTable from '../../components/domain/StudentFeedbackTable';
import { useApi } from '../../hooks/useApi';
import { feedbackService } from '../../services/endpoints';
import { formatDateTime } from '../../utils/format';

const TABS = [
  { id: 'system', label: 'Platform feedback' },
  { id: 'student', label: 'Student feedback' },
  { id: 'company', label: 'Company feedback' },
  { id: 'faculty', label: 'Faculty feedback' },
];

function CompanyFeedbackTable() {
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi(() => feedbackService.companyList({ page, size: 10 }), [page]);
  return (
    <Card>
      <CardHeader title="Company feedback on interns" />
      <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No company feedback yet."
                 columns={[
                   { key: 'student', header: 'Intern', render: (f) => (<div><p className="font-medium text-slate-900">{f.studentName}</p><p className="text-xs text-slate-500">{f.internshipTitle}</p></div>) },
                   { key: 'company', header: 'Company', render: (f) => (<div><p>{f.companyName}</p>{f.companyRepresentative && <p className="text-xs text-slate-500">{f.companyRepresentative}</p>}</div>) },
                   { key: 'tech', header: 'Technical', render: (f) => <RatingDisplay value={f.technicalSkills} /> },
                   { key: 'hire', header: 'Hire likelihood', render: (f) => <RatingDisplay value={f.hireLikelihood} /> },
                   { key: 'notes', header: 'Strengths / improve', render: (f) => (<p className="max-w-xs text-sm text-slate-600">{f.strengths || '—'}<span className="block text-xs text-slate-500">{f.areasForImprovement}</span></p>) },
                   { key: 'by', header: 'Recorded', render: (f) => (<div className="text-sm"><p>{formatDateTime(f.createdAt)}</p><p className="text-xs text-slate-500">{f.recordedByEmail}</p></div>) },
                 ]} />
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}

function FacultyFeedbackTable() {
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi(() => feedbackService.facultyList({ page, size: 10 }), [page]);
  return (
    <Card>
      <CardHeader title="Faculty quality-assurance feedback" />
      <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No faculty feedback yet."
                 columns={[
                   { key: 'internship', header: 'Internship', render: (f) => (<div><p className="font-medium text-slate-900">{f.internshipTitle}</p><p className="text-xs text-slate-500">{f.companyName}</p></div>) },
                   { key: 'faculty', header: 'Faculty', render: (f) => f.facultyName },
                   { key: 'suit', header: 'Course suitability', render: (f) => <RatingDisplay value={f.courseSuitability} /> },
                   { key: 'outcomes', header: 'Learning outcomes', render: (f) => <RatingDisplay value={f.learningOutcomes} /> },
                   { key: 'quality', header: 'Quality', render: (f) => <RatingDisplay value={f.internshipQuality} /> },
                   { key: 'notes', header: 'Notes / suggestions', render: (f) => (<p className="max-w-xs text-sm text-slate-600">{f.learningOutcomesNotes || '—'}<span className="block text-xs text-slate-500">{f.suggestions}</span></p>) },
                 ]} />
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState('system');
  return (
    <>
      <PageHeader title="Feedback management" description="Platform suggestions and bug reports, plus all internship feedback categories." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Feedback categories" />
      {tab === 'system' && <PlatformFeedbackPanel manage />}
      {tab === 'student' && <StudentFeedbackTable />}
      {tab === 'company' && <CompanyFeedbackTable />}
      {tab === 'faculty' && <FacultyFeedbackTable />}
    </>
  );
}
