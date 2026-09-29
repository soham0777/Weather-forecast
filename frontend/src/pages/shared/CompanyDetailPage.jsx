import { useParams } from 'react-router-dom';
import { Building2, MessageSquare } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DescriptionList from '../../components/ui/DescriptionList';
import DataTable from '../../components/ui/DataTable';
import { RatingDisplay } from '../../components/ui/StarRating';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import RatingsSummary from '../../components/domain/RatingsSummary';
import { STUDENT_FEEDBACK_RATINGS } from '../../components/domain/ratingConfigs';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useRoleBase } from '../../hooks/useRoleBase';
import { companyService } from '../../services/endpoints';
import { formatDate, formatDateTime, formatStipend } from '../../utils/format';
import { Link } from 'react-router-dom';

/** Company profile: details (staff only for contacts), internships, ratings and student feedback. */
export default function CompanyDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = useRoleBase();
  const { data, loading, error, reload } = useApi(() => companyService.get(id), [id]);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { company, internships, ratings, recentFeedback } = data;
  const staff = user.role !== 'STUDENT';

  return (
    <>
      <PageHeader title={company.name} description={company.location}
                  backTo={user.role === 'ADMIN' ? '/admin/companies' : `${base}/internships`}
                  backLabel={user.role === 'ADMIN' ? 'Back to companies' : 'Back to internships'}
                  actions={<StatusBadge status={company.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Internships" description={`${internships.length} posting(s)`} />
            <DataTable rows={internships} emptyTitle="No internships are currently available."
                       columns={[
                         { key: 'title', header: 'Internship', render: (i) => (
                           <Link to={`${base}/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link>) },
                         { key: 'domain', header: 'Domain' },
                         { key: 'stipend', header: 'Stipend', render: (i) => formatStipend(i.stipend) },
                         { key: 'deadline', header: 'Deadline', render: (i) => formatDate(i.applicationDeadline) },
                         { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
                       ]} />
          </Card>
          <Card>
            <CardHeader title="Student feedback" icon={MessageSquare} description="What interns said about this company." />
            <CardBody>
              {recentFeedback.length === 0 ? <EmptyState title="No student feedback yet." /> : (
                <ul className="divide-y divide-slate-100">
                  {recentFeedback.map((f) => (
                    <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{f.internshipTitle}{staff && f.studentName && ` · ${f.studentName}`}</p>
                        <RatingDisplay value={f.overallExperience} />
                      </div>
                      {f.comments && <p className="mt-1 text-sm text-slate-600">“{f.comments}”</p>}
                      {f.suggestions && <p className="mt-1 text-xs text-slate-500">Suggestion: {f.suggestions}</p>}
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(f.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Company details" icon={Building2} />
            <CardBody>
              <DescriptionList columns={1} items={[
                { label: 'Location', value: company.location },
                staff ? { label: 'Registration number', value: company.registrationNumber } : null,
                staff ? { label: 'Contact person', value: company.contactPerson } : null,
                staff ? { label: 'Contact e-mail', value: company.contactEmail } : null,
                staff ? { label: 'Contact phone', value: company.contactPhone } : null,
                { label: 'Internships posted', value: company.internshipCount },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Ratings" description={ratings.feedbackCount ? `Average of ${ratings.feedbackCount} student review(s)` : 'Based on student feedback'} />
            <CardBody>
              {ratings.feedbackCount === 0 ? <EmptyState title="No data available" message="Ratings appear after interns submit feedback." />
                : <RatingsSummary fields={STUDENT_FEEDBACK_RATINGS} values={ratings} />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
