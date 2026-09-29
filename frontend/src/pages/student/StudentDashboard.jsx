import { Link } from 'react-router-dom';
import { Briefcase, CalendarClock, CheckCircle2, Clock, FileText, ListChecks, Search, Upload } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Alert, CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services/endpoints';
import { formatDate, formatDateTime, formatTime } from '../../utils/format';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => dashboardService.student(), []);

  return (
    <>
      <PageHeader title={`Hello, ${user.name?.split(' ')[0] || 'student'}`}
                  description="Your internship journey at a glance."
                  actions={<Button icon={Search} to="/student/internships">Browse internships</Button>} />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <CardsSkeleton count={4} />}
      {data && (
        <div className="space-y-6">
          {!data.resumeUploaded && (
            <Alert tone="warning" title="Upload your resume to start applying"
                   action={<Button size="sm" icon={Upload} to="/student/profile">Upload resume</Button>}>
              A PDF resume (max 5 MB) is required for every internship application.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Available internships" value={data.availableInternships} icon={Briefcase} to="/student/internships" hint="Open for applications now" />
            <StatCard label="My applications" value={data.applications} icon={FileText} to="/student/applications" accent="slate" />
            <StatCard label="Pending" value={data.pendingApplications} icon={Clock} accent="amber" hint="Awaiting review" />
            <StatCard label="Shortlisted" value={data.shortlistedApplications} icon={ListChecks} accent="indigo" />
            <StatCard label="Accepted" value={data.acceptedApplications} icon={CheckCircle2} accent="green" />
            <StatCard label="Upcoming interviews" value={data.upcomingInterviewCount} icon={CalendarClock} to="/student/interviews" />
            <div className="card p-5 sm:col-span-2">
              <ProgressBar value={data.profileCompletion} label="Profile completion" />
              <p className="mt-2 text-xs text-slate-500">
                Based on your details, resume upload and e-mail verification.{' '}
                {data.profileCompletion < 100 && <Link to="/student/profile" className="font-medium text-brand-700 hover:underline">Complete profile</Link>}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Upcoming interviews" icon={CalendarClock} />
              <CardBody>
                {data.upcomingInterviews.length === 0 ? <EmptyState title="No upcoming interviews." /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.upcomingInterviews.map((i) => (
                      <li key={i.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div>
                          <p className="font-medium text-slate-900">{i.internshipTitle}</p>
                          <p className="text-sm text-slate-500">{i.companyName} · with {i.interviewerName}</p>
                        </div>
                        <div className="text-right text-sm whitespace-nowrap">
                          <p className="font-medium text-slate-900">{formatDate(i.interviewDate)}</p>
                          <p className="text-slate-500">{formatTime(i.interviewTime)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Recent applications" icon={FileText}
                          actions={<Link to="/student/applications" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
              <CardBody>
                {data.recentApplications.length === 0 ? (
                  <EmptyState title="No applications found." message="Find an internship that matches your interests and apply."
                              action={<Button size="sm" to="/student/internships">Browse internships</Button>} />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data.recentApplications.map((a) => (
                      <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                        <Link to={`/student/applications/${a.id}`} className="flex items-start justify-between gap-3 rounded hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{a.internship.title}</p>
                            <p className="text-sm text-slate-500">{a.internship.companyName} · updated {formatDateTime(a.updatedAt)}</p>
                          </div>
                          <StatusBadge status={a.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
