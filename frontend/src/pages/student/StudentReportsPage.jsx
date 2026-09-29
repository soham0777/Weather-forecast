import { Link } from 'react-router-dom';
import { Award, CalendarClock, FileText } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import DescriptionList from '../../components/ui/DescriptionList';
import StatCard from '../../components/ui/StatCard';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import ChartCard from '../../components/charts/ChartCard';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';
import { useApi } from '../../hooks/useApi';
import { reportService } from '../../services/endpoints';
import { STATUS_META } from '../../utils/constants';
import { formatDate, formatDateTime, formatStipend, formatTime } from '../../utils/format';

export default function StudentReportsPage() {
  const { data, loading, error, reload } = useApi(() => reportService.student(), []);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { applications, interviews, placement } = data;
  const distribution = applications.statusDistribution.map((s) => ({ label: STATUS_META[s.status].label, value: s.count }));
  const count = (status) => applications.statusDistribution.find((s) => s.status === status)?.count ?? 0;

  const interviewColumns = [
    { key: 'when', header: 'Date & time', render: (i) => <span className="whitespace-nowrap">{formatDate(i.interviewDate)}, {formatTime(i.interviewTime)}</span> },
    { key: 'internship', header: 'Internship', render: (i) => (<div><p>{i.internshipTitle}</p><p className="text-xs text-slate-500">{i.companyName}</p></div>) },
    { key: 'interviewer', header: 'Interviewer', render: (i) => i.interviewerName },
    { key: 'status', header: 'Status / result', render: (i) => (<div className="flex flex-wrap gap-1"><StatusBadge status={i.status} />{i.result && <StatusBadge status={i.result} />}</div>) },
    { key: 'comments', header: 'Feedback', render: (i) => <span className="text-sm text-slate-600">{i.comments || '—'}</span> },
  ];

  return (
    <>
      <PageHeader title="My reports" description="Your applications, interviews and placement status — calculated from your records." />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total applications" value={applications.total} icon={FileText} />
          <StatCard label="Accepted" value={count('ACCEPTED')} accent="green" />
          <StatCard label="Upcoming interviews" value={interviews.upcoming.length} icon={CalendarClock} accent="indigo" />
          <StatCard label="Placement status" value={STATUS_META[placement.status].label} icon={Award} accent={placement.status === 'PLACED' ? 'green' : 'slate'} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Application status distribution" data={applications.total ? distribution : []} valueLabel="Applications"
                     emptyMessage="No applications found.">
            <HorizontalBarChart data={distribution} valueLabel="Applications" />
          </ChartCard>
          <Card>
            <CardHeader title="Placement status" icon={Award} actions={<StatusBadge status={placement.status} />} />
            <CardBody>
              {placement.offers.length === 0 ? (
                <EmptyState title="No accepted offers yet." message="Offers appear here when a coordinator accepts one of your applications." />
              ) : placement.offers.map((o) => (
                <div key={o.applicationId} className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 last:mb-0">
                  <Link to={`/student/applications/${o.applicationId}`} className="font-semibold text-slate-900 hover:text-brand-700">{o.internshipTitle}</Link>
                  <p className="mb-3 text-sm text-slate-600">{o.companyName} · {o.location}</p>
                  <DescriptionList items={[
                    { label: 'Stipend', value: formatStipend(o.stipend) },
                    { label: 'Duration', value: `${o.durationWeeks} weeks` },
                    { label: 'Dates', value: `${formatDate(o.startDate)} – ${formatDate(o.endDate)}` },
                    { label: 'Accepted on', value: formatDateTime(o.acceptedAt) },
                    { label: 'Completed', value: o.completedAt ? formatDateTime(o.completedAt) : 'Not yet' },
                  ]} />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Application timeline" description="Every application with its latest status." />
          <DataTable rows={applications.timeline} rowKey={(r) => r.applicationId} emptyTitle="No applications found."
                     columns={[
                       { key: 'internship', header: 'Internship', render: (r) => (
                         <Link className="font-medium text-slate-900 hover:text-brand-700" to={`/student/applications/${r.applicationId}`}>{r.internshipTitle}</Link>) },
                       { key: 'company', header: 'Company', render: (r) => r.companyName },
                       { key: 'applied', header: 'Applied', render: (r) => formatDateTime(r.appliedAt) },
                       { key: 'updated', header: 'Last update', render: (r) => formatDateTime(r.lastUpdatedAt) },
                       { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                     ]} />
        </Card>

        <Card>
          <CardHeader title="Upcoming interviews" icon={CalendarClock} />
          <DataTable rows={interviews.upcoming} columns={interviewColumns} emptyTitle="No upcoming interviews." />
        </Card>
        <Card>
          <CardHeader title="Past interviews & results" />
          <DataTable rows={interviews.past} columns={interviewColumns} emptyTitle="No past interviews." />
        </Card>
      </div>
    </>
  );
}
