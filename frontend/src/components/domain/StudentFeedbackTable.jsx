import { useState } from 'react';
import { Card, CardHeader } from '../ui/Card';
import DataTable from '../ui/DataTable';
import Pagination from '../ui/Pagination';
import { RatingDisplay } from '../ui/StarRating';
import { useApi } from '../../hooks/useApi';
import { feedbackService } from '../../services/endpoints';
import { formatDateTime } from '../../utils/format';

/** Paginated student feedback (faculty: their internships; admin: all). */
export default function StudentFeedbackTable() {
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi(() => feedbackService.studentList({ page, size: 10 }), [page]);
  return (
    <Card>
      <CardHeader title="Student feedback about internships" />
      <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No student feedback yet."
                 columns={[
                   { key: 'internship', header: 'Internship', render: (f) => (<div><p className="font-medium text-slate-900">{f.internshipTitle}</p><p className="text-xs text-slate-500">{f.companyName} · {f.studentName}</p></div>) },
                   { key: 'overall', header: 'Overall', render: (f) => <RatingDisplay value={f.overallExperience} /> },
                   { key: 'mentor', header: 'Mentorship', render: (f) => <RatingDisplay value={f.mentorshipQuality} /> },
                   { key: 'comments', header: 'Comments', render: (f) => <p className="max-w-sm text-sm text-slate-600">{f.comments || '—'}{f.suggestions && <span className="block text-xs text-slate-500">Suggestion: {f.suggestions}</span>}</p> },
                   { key: 'date', header: 'Submitted', render: (f) => <span className="whitespace-nowrap">{formatDateTime(f.createdAt)}</span> },
                 ]} />
      <Pagination page={data} onChange={setPage} />
    </Card>
  );
}
