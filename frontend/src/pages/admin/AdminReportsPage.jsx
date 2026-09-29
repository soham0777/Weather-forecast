import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { RatingDisplay } from '../../components/ui/StarRating';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import RatingsSummary from '../../components/domain/RatingsSummary';
import { STUDENT_FEEDBACK_RATINGS } from '../../components/domain/ratingConfigs';
import ChartCard from '../../components/charts/ChartCard';
import ColumnChart from '../../components/charts/ColumnChart';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';
import TrendChart from '../../components/charts/TrendChart';
import { useApi } from '../../hooks/useApi';
import { reportService } from '../../services/endpoints';
import { STATUS_META } from '../../utils/constants';
import {
  formatBytes, formatCurrency, formatDateTime, formatDayShort, formatMonth, formatNumber, formatPercent, titleCase,
} from '../../utils/format';

const NO_DATA = 'No data available';

function Section({ id, title, description, children }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AdminReportsPage() {
  const { data, loading, error, reload } = useApi(() => reportService.admin(), []);
  if (loading && !data) return <PageLoader label="Calculating reports…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { placement, applications, studentPerformance: perf, companies, systemActivity: activity, compliance } = data;

  const statusBars = applications.statusBreakdown.map((s) => ({ label: STATUS_META[s.status].label, value: s.count }));
  const perMonth = applications.applicationsPerMonth.map((p) => ({ label: formatMonth(p.period), value: p.count }));
  const registrations = activity.registrationsPerMonth.map((p) => ({ label: formatMonth(p.period), value: p.count }));
  const logins = activity.loginsPerDay.map((p) => ({ label: p.period, value: p.count }));
  const companyRatings = companies.averageRatings.map((c) => ({ label: c.name, value: c.averageOverall }));
  const usage = activity.dataUsage;

  return (
    <>
      <PageHeader title="Reports & analytics" description="Every figure is calculated live from the database. Where a value cannot be calculated yet, it shows “No data available”." />
      <div className="space-y-10">
        <Section id="placement" title="Placement summary">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Overall placement rate" value={formatPercent(placement.placementRate) ?? NO_DATA}
                      hint="Placed students ÷ active students" accent="green" />
            <StatCard label="Total students placed" value={placement.studentsPlaced} hint="At least one accepted application" />
            <StatCard label="Active students" value={placement.activeStudents} hint={`${placement.totalStudents} registered`} accent="slate" />
            <StatCard label="Average stipend" value={placement.averageStipend !== null ? `${formatCurrency(placement.averageStipend)}/month` : NO_DATA}
                      hint="Across accepted internships" accent="indigo" />
          </div>
        </Section>

        <Section id="applications" title="Application analytics">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total applications" value={applications.total} />
            <StatCard label="Accepted" value={applications.accepted} accent="green" />
            <StatCard label="Acceptance rate" value={formatPercent(applications.acceptanceRate) ?? NO_DATA}
                      hint="Accepted ÷ (total − withdrawn)" accent="indigo" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Status breakdown" data={applications.total ? statusBars : []} valueLabel="Applications" emptyMessage="No applications found.">
              <HorizontalBarChart data={statusBars} valueLabel="Applications" />
            </ChartCard>
            <ChartCard title="Applications per month" description="Last 6 months" data={perMonth} valueLabel="Applications">
              <ColumnChart data={perMonth} valueLabel="Applications" />
            </ChartCard>
          </div>
        </Section>

        <Section id="performance" title="Student performance">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Accepted internships" value={perf.acceptedInternships} />
            <StatCard label="Completed internships" value={perf.completedInternships} accent="green" />
            <StatCard label="Completion rate" value={formatPercent(perf.completionRate) ?? NO_DATA} hint="Completed ÷ accepted" accent="indigo" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top performing students" description="By average overall evaluation rating" />
              <DataTable rows={perf.topStudents} rowKey={(r) => r.studentId} emptyTitle={NO_DATA}
                         emptyMessage="Top students appear once evaluations are recorded."
                         columns={[
                           { key: 'name', header: 'Student', render: (s) => (<div><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.department}</p></div>) },
                           { key: 'rating', header: 'Average rating', render: (s) => <RatingDisplay value={s.averageRating} /> },
                           { key: 'count', header: 'Evaluations', className: 'text-center tabular', render: (s) => s.evaluationCount },
                         ]} />
            </Card>
            <Card>
              <CardHeader title="Most popular internships" description="By number of applications" />
              <DataTable rows={perf.popularInternships} rowKey={(r) => r.internshipId} emptyTitle={NO_DATA}
                         columns={[
                           { key: 'title', header: 'Internship', render: (i) => (<div><Link to={`/admin/internships/${i.internshipId}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link><p className="text-xs text-slate-500">{i.companyName}</p></div>) },
                           { key: 'count', header: 'Applications', className: 'text-right tabular', headerClassName: 'text-right', render: (i) => i.applicationCount },
                         ]} />
            </Card>
          </div>
        </Section>

        <Section id="companies" title="Company statistics">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Companies" value={companies.totalCompanies} hint={`${companies.activeCompanies} active`} />
            <StatCard label="Student feedback entries" value={companies.studentFeedbackSummary.count} accent="slate" />
            <StatCard label="Average overall experience" value={companies.studentFeedbackSummary.overallExperience !== null
              ? `${companies.studentFeedbackSummary.overallExperience} / 5` : NO_DATA} accent="green" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Most active companies" description="By internships posted, then applications received" />
              <DataTable rows={companies.mostActive} rowKey={(r) => r.companyId} emptyTitle={NO_DATA}
                         columns={[
                           { key: 'name', header: 'Company', render: (c) => <Link to={`/admin/companies/${c.companyId}`} className="font-medium text-slate-900 hover:text-brand-700">{c.name}</Link> },
                           { key: 'internships', header: 'Internships', className: 'text-right tabular', headerClassName: 'text-right', render: (c) => c.internshipCount },
                           { key: 'apps', header: 'Applications', className: 'text-right tabular', headerClassName: 'text-right', render: (c) => c.applicationCount },
                           { key: 'accepted', header: 'Accepted', className: 'text-right tabular', headerClassName: 'text-right', render: (c) => c.acceptedCount },
                         ]} />
            </Card>
            <ChartCard title="Average company ratings" description="Overall experience from student feedback (1–5)" data={companyRatings}
                       valueLabel="Average rating" emptyMessage={NO_DATA}>
              <HorizontalBarChart data={companyRatings} valueLabel="Average rating" domain={[0, 5]} labelWidth={170} />
            </ChartCard>
          </div>
          <Card>
            <CardHeader title="Student feedback summary" description="Average of all student feedback" />
            <CardBody>
              {companies.studentFeedbackSummary.count === 0 ? <EmptyState title={NO_DATA} />
                : <RatingsSummary fields={STUDENT_FEEDBACK_RATINGS} values={companies.studentFeedbackSummary} />}
            </CardBody>
          </Card>
        </Section>

        <Section id="activity" title="System activity">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Logins (last 30 days)" value={activity.loginsLast30Days} />
            <StatCard label="Failed logins (last 30 days)" value={activity.failedLoginsLast30Days} accent="rose" />
            <StatCard label="Registered users" value={usage.users} accent="slate" />
            <StatCard label="Stored resume files" value={formatBytes(usage.storedFileBytes)} hint={`${usage.resumesUploaded} students with a resume`} accent="slate" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="User registrations" description="Accounts created per month, last 6 months" data={registrations} valueLabel="Registrations">
              <ColumnChart data={registrations} valueLabel="Registrations" />
            </ChartCard>
            <ChartCard title="Login trend" description="Successful logins per day, last 30 days" data={logins} valueLabel="Logins"
                       emptyMessage="No logins recorded yet.">
              <TrendChart data={logins} valueLabel="Logins" formatLabel={formatDayShort} />
            </ChartCard>
          </div>
          <Card>
            <CardHeader title="Data usage" description="Records stored in the database" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[['Students', usage.students], ['Faculty', usage.faculty], ['Companies', usage.companies], ['Internships', usage.internships],
                  ['Applications', usage.applications], ['Interviews', usage.interviews], ['Evaluations', usage.evaluations],
                  ['Feedback entries', usage.feedbackEntries], ['Resumes uploaded', usage.resumesUploaded], ['Users', usage.users]].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">{label}</dt><dd className="text-lg font-semibold text-slate-900">{formatNumber(value)}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </Section>

        <Section id="compliance" title="Compliance report" description="Policy violations are requests the system rejected; they are logged automatically.">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Policy violations" />
              <DataTable rows={compliance.policyViolations} rowKey={(r) => r.type}
                         columns={[
                           { key: 'type', header: 'Type', render: (v) => (<div><p className="font-medium text-slate-900">{titleCase(v.type)}</p><p className="text-xs text-slate-500">{v.description}</p></div>) },
                           { key: 'recent', header: 'Last 30 days', className: 'text-right tabular', headerClassName: 'text-right', render: (v) => v.last30Days },
                           { key: 'all', header: 'All time', className: 'text-right tabular', headerClassName: 'text-right', render: (v) => v.allTime },
                         ]} />
            </Card>
            <Card>
              <CardHeader title="Document verification status" />
              <CardBody>
                <dl className="space-y-3 text-sm">
                  {[
                    ['Students with a resume', compliance.documentVerification.studentsWithResume, 'green'],
                    ['Students without a resume', compliance.documentVerification.studentsWithoutResume, 'amber'],
                    ['Verified e-mail accounts', compliance.documentVerification.verifiedAccounts, 'green'],
                    ['Unverified e-mail accounts', compliance.documentVerification.unverifiedAccounts, 'amber'],
                    ['Applications with a resume attached', `${compliance.documentVerification.applicationsWithResume} of ${compliance.documentVerification.totalApplications}`, 'blue'],
                  ].map(([label, value, tone]) => (
                    <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <dt className="text-slate-600">{label}</dt><dd><Badge tone={tone}>{value}</Badge></dd>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title="Recent violations" actions={<Link to="/admin/audit-log" className="text-sm font-medium text-brand-700 hover:underline">Full audit log</Link>} />
            <DataTable rows={compliance.recentViolations} emptyTitle="No violations recorded."
                       columns={[
                         { key: 'time', header: 'When', render: (v) => <span className="whitespace-nowrap">{formatDateTime(v.createdAt)}</span> },
                         { key: 'action', header: 'Type', render: (v) => <Badge tone="red">{titleCase(v.action)}</Badge> },
                         { key: 'user', header: 'User', render: (v) => v.userEmail || <span className="text-slate-400">Anonymous</span> },
                         { key: 'details', header: 'Details', render: (v) => <span className="text-sm text-slate-600">{v.details}</span> },
                       ]} />
          </Card>
        </Section>
      </div>
    </>
  );
}
