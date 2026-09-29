import { Link } from 'react-router-dom';
import {
  Briefcase, Building2, CalendarClock, CheckCircle2, ClipboardCheck, Clock, FileText, GraduationCap, UserCheck, Users,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Button from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import { CardsSkeleton, ErrorState } from '../../components/ui/States';
import ChartCard from '../../components/charts/ChartCard';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';
import ColumnChart from '../../components/charts/ColumnChart';
import { useApi } from '../../hooks/useApi';
import { dashboardService } from '../../services/endpoints';
import { STATUS_META } from '../../utils/constants';
import { formatDateTime, formatMonth } from '../../utils/format';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi(() => dashboardService.admin(), []);
  const toBars = (list) => list.map((s) => ({ label: STATUS_META[s.status].label, value: s.count }));

  return (
    <>
      <PageHeader title="Admin dashboard" description="System-wide overview from live data."
                  actions={<Button icon={ClipboardCheck} to="/admin/internships/approvals">Review approvals</Button>} />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <CardsSkeleton count={8} />}
      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total students" value={data.totalStudents} icon={GraduationCap} to="/admin/students" />
            <StatCard label="Active students" value={data.activeStudents} icon={UserCheck} accent="green" />
            <StatCard label="Total faculty" value={data.totalFaculty} icon={Users} to="/admin/faculty" accent="slate" />
            <StatCard label="Active companies" value={data.totalCompanies} icon={Building2} to="/admin/companies" accent="slate" />
            <StatCard label="Total internships" value={data.totalInternships} icon={Briefcase} to="/admin/internships" />
            <StatCard label="Pending approvals" value={data.pendingApprovals} icon={ClipboardCheck} accent="amber" to="/admin/internships/approvals" />
            <StatCard label="Total applications" value={data.totalApplications} icon={FileText} to="/admin/applications" />
            <StatCard label="Pending applications" value={data.pendingApplications} icon={Clock} accent="amber" />
            <StatCard label="Interviews" value={data.totalInterviews} icon={CalendarClock} to="/admin/interviews" accent="indigo"
                      hint={`${data.scheduledInterviews} upcoming`} />
            <StatCard label="Accepted applications" value={data.acceptedApplications} icon={CheckCircle2} accent="green" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Applications by status" data={data.totalApplications ? toBars(data.applicationStatus) : []} valueLabel="Applications"
                       emptyMessage="No applications found.">
              <HorizontalBarChart data={toBars(data.applicationStatus)} valueLabel="Applications" />
            </ChartCard>
            <ChartCard title="Internships by status" data={data.totalInternships ? toBars(data.internshipStatus) : []} valueLabel="Internships"
                       emptyMessage="No internships found.">
              <HorizontalBarChart data={toBars(data.internshipStatus)} valueLabel="Internships" />
            </ChartCard>
          </div>
          <ChartCard title="Applications per month" description="Last 6 months"
                     data={data.applicationsPerMonth.map((p) => ({ label: formatMonth(p.period), value: p.count }))} valueLabel="Applications">
            <ColumnChart data={data.applicationsPerMonth.map((p) => ({ label: formatMonth(p.period), value: p.count }))} valueLabel="Applications" />
          </ChartCard>

          <Card>
            <CardHeader title="Waiting for approval" description="Oldest submissions first"
                        actions={<Link to="/admin/internships/approvals" className="text-sm font-medium text-brand-700 hover:underline">Open approvals</Link>} />
            <DataTable rows={data.awaitingApproval} emptyTitle="No internships are waiting for approval."
                       columns={[
                         { key: 'title', header: 'Internship', render: (i) => (<div><Link to={`/admin/internships/${i.id}`} className="font-medium text-slate-900 hover:text-brand-700">{i.title}</Link><p className="text-xs text-slate-500">{i.companyName}</p></div>) },
                         { key: 'faculty', header: 'Coordinator', render: (i) => i.facultyName },
                         { key: 'created', header: 'Submitted', render: (i) => formatDateTime(i.createdAt) },
                       ]} />
          </Card>
        </div>
      )}
    </>
  );
}
