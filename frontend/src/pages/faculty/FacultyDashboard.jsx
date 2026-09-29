import { Link } from 'react-router-dom';
import { Briefcase, CalendarClock, ClipboardCheck, Clock, FileText, ListChecks, Plus, Star } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/States';
import ChartCard from '../../components/charts/ChartCard';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services/endpoints';
import { STATUS_META } from '../../utils/constants';
import { formatDate, formatDateTime, formatTime } from '../../utils/format';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => dashboardService.faculty(), []);
  const statusData = data?.applicationStatus.map((s) => ({ label: STATUS_META[s.status].label, value: s.count })) || [];

  return (
    <>
      <PageHeader title={`Welcome, ${user.name || 'faculty'}`} description="Your internships, applicants and interviews."
                  actions={<Button icon={Plus} to="/faculty/internships/new">Post internship</Button>} />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <CardsSkeleton count={8} />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Posted internships" value={data.postedInternships} icon={Briefcase} to="/faculty/internships"
                      hint={`${data.openInternships} open · ${data.pendingApproval} awaiting approval`} />
            <StatCard label="Applications" value={data.applications} icon={FileText} to="/faculty/applications" accent="slate" />
            <StatCard label="Pending reviews" value={data.pendingReviews} icon={Clock} accent="amber" to="/faculty/applications" />
            <StatCard label="Shortlisted students" value={data.shortlistedStudents} icon={ListChecks} accent="indigo" />
            <StatCard label="Scheduled interviews" value={data.scheduledInterviews} icon={CalendarClock} to="/faculty/interviews" hint="Upcoming" />
            <StatCard label="Evaluations recorded" value={data.evaluations} icon={Star} accent="green" to="/faculty/evaluations" />
            <StatCard label="Awaiting evaluation" value={data.pendingEvaluations} icon={ClipboardCheck} accent="rose" to="/faculty/evaluations" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Applications by status" description="Applications to your internships" data={data.applications ? statusData : []}
                       valueLabel="Applications" emptyMessage="No applications found.">
              <HorizontalBarChart data={statusData} valueLabel="Applications" />
            </ChartCard>
            <Card>
              <CardHeader title="Upcoming interviews" icon={CalendarClock}
                          actions={<Link to="/faculty/interviews" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
              <CardBody>
                {data.upcomingInterviews.length === 0 ? <EmptyState title="No upcoming interviews." /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.upcomingInterviews.map((i) => (
                      <li key={i.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div><p className="font-medium text-slate-900">{i.studentName}</p><p className="text-sm text-slate-500">{i.internshipTitle}</p></div>
                        <div className="text-right text-sm whitespace-nowrap"><p className="font-medium">{formatDate(i.interviewDate)}</p><p className="text-slate-500">{formatTime(i.interviewTime)}</p></div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Recent applications" icon={FileText}
                        actions={<Link to="/faculty/applications" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
            <CardBody>
              {data.recentApplications.length === 0 ? <EmptyState title="No applications found." /> : (
                <ul className="divide-y divide-slate-100">
                  {data.recentApplications.map((a) => (
                    <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                      <Link to={`/faculty/applications/${a.id}`} className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="font-medium text-slate-900">{a.student.name}</p>
                          <p className="truncate text-sm text-slate-500">{a.internship.title} · applied {formatDateTime(a.appliedAt)}</p></div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
