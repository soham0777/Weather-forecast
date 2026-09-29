import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import StatCard from '../../components/ui/StatCard';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import ChartCard from '../../components/charts/ChartCard';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';
import { useApi } from '../../hooks/useApi';
import { reportService } from '../../services/endpoints';
import { STATUS_META } from '../../utils/constants';
import { formatPercent, formatRating } from '../../utils/format';

const NO_DATA = 'No data available';
const criteria = (a) => [
  ['Technical skills', a.technicalSkills], ['Soft skills', a.softSkills], ['Punctuality', a.punctuality],
  ['Responsibility', a.responsibility], ['Teamwork', a.teamwork], ['Learning ability', a.learningAbility],
].map(([label, value]) => ({ label, value }));

export default function FacultyReportsPage() {
  const { data, loading, error, reload } = useApi(() => reportService.faculty(), []);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { postedInternships: posted, applicationReview: review, studentEvaluations: evals, interviewStatistics: iv } = data;
  const internshipStatus = posted.statusBreakdown.filter((s) => s.count > 0).map((s) => ({ label: STATUS_META[s.status].label, value: s.count }));
  const reviewData = [
    { label: 'Pending', value: review.pending }, { label: 'Shortlisted', value: review.shortlisted },
    { label: 'Accepted', value: review.accepted }, { label: 'Rejected', value: review.rejected }, { label: 'Withdrawn', value: review.withdrawn },
  ];

  return (
    <>
      <PageHeader title="Faculty reports" description="Figures for internships you coordinate, calculated from the database." />
      <div className="space-y-8">
        <section aria-labelledby="posted-heading" className="space-y-4">
          <h2 id="posted-heading" className="text-lg font-semibold text-slate-900">Posted internships</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Number of postings" value={posted.total} />
            <StatCard label="Total applications" value={review.totalApplications} accent="slate" />
            <StatCard label="Applications per internship" value={posted.total ? (review.totalApplications / posted.total).toFixed(1) : NO_DATA} accent="indigo" hint="Average" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Status breakdown" data={internshipStatus} valueLabel="Internships" emptyMessage="No internships posted yet.">
              <HorizontalBarChart data={internshipStatus} valueLabel="Internships" />
            </ChartCard>
            <Card>
              <CardHeader title="Applications per internship" />
              <DataTable rows={posted.applicationsPerInternship} rowKey={(r) => r.internshipId} emptyTitle="No internships posted yet."
                         columns={[
                           { key: 'title', header: 'Internship', render: (r) => <Link className="font-medium text-slate-900 hover:text-brand-700" to={`/faculty/internships/${r.internshipId}`}>{r.title}</Link> },
                           { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                           { key: 'total', header: 'Total', className: 'text-right tabular', headerClassName: 'text-right' },
                           { key: 'pending', header: 'Pending', className: 'text-right tabular', headerClassName: 'text-right' },
                           { key: 'shortlisted', header: 'Shortlisted', className: 'text-right tabular', headerClassName: 'text-right' },
                           { key: 'accepted', header: 'Accepted', className: 'text-right tabular', headerClassName: 'text-right' },
                         ]} />
            </Card>
          </div>
        </section>

        <section aria-labelledby="review-heading" className="space-y-4">
          <h2 id="review-heading" className="text-lg font-semibold text-slate-900">Application review</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total reviewed" value={review.reviewed} hint="Shortlisted, accepted or rejected" />
            <StatCard label="Pending applications" value={review.pending} accent="amber" />
            <StatCard label="Shortlisting progress" value={formatPercent(review.shortlistingProgress) ?? NO_DATA} accent="indigo"
                      hint="(Shortlisted + accepted) ÷ active applications" />
          </div>
          <ChartCard title="Review outcome" data={review.totalApplications ? reviewData : []} valueLabel="Applications" emptyMessage="No applications found.">
            <HorizontalBarChart data={reviewData} valueLabel="Applications" />
          </ChartCard>
        </section>

        <section aria-labelledby="eval-heading" className="space-y-4">
          <h2 id="eval-heading" className="text-lg font-semibold text-slate-900">Student evaluations</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Evaluated students" value={evals.evaluatedStudents} />
            <StatCard label="Average overall rating" value={formatRating(evals.evaluationAverages.overall) ?? NO_DATA} accent="green" />
            <StatCard label="Company hire likelihood" value={formatRating(evals.averageHireLikelihood) ?? NO_DATA} accent="indigo"
                      hint={`${evals.companyFeedbackAverages.count} company feedback record(s)`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Average evaluation by criterion" description="Faculty evaluations, 1–5 scale"
                       data={evals.evaluationAverages.count ? criteria(evals.evaluationAverages) : []} valueLabel="Average rating">
              <HorizontalBarChart data={criteria(evals.evaluationAverages)} valueLabel="Average rating" domain={[0, 5]} />
            </ChartCard>
            <Card>
              <CardHeader title="Feedback summary" />
              <CardBody>
                {evals.studentFeedbackAverages.count === 0 && evals.companyFeedbackAverages.count === 0
                  ? <EmptyState title={NO_DATA} message="No company or student feedback has been recorded for your internships yet." />
                  : (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['Student feedback entries', evals.studentFeedbackAverages.count],
                        ['Students: overall experience', formatRating(evals.studentFeedbackAverages.overallExperience) ?? NO_DATA],
                        ['Students: mentorship quality', formatRating(evals.studentFeedbackAverages.mentorshipQuality) ?? NO_DATA],
                        ['Company feedback entries', evals.companyFeedbackAverages.count],
                        ['Companies: technical skills', formatRating(evals.companyFeedbackAverages.technicalSkills) ?? NO_DATA],
                        ['Companies: teamwork', formatRating(evals.companyFeedbackAverages.teamwork) ?? NO_DATA],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                          <dt className="text-xs text-slate-500">{label}</dt><dd className="text-base font-semibold text-slate-900">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
              </CardBody>
            </Card>
          </div>
        </section>

        <section aria-labelledby="iv-heading" className="space-y-4">
          <h2 id="iv-heading" className="text-lg font-semibold text-slate-900">Interview statistics</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Scheduled interviews" value={iv.scheduled} />
            <StatCard label="Completed interviews" value={iv.completed} accent="green" />
            <StatCard label="Cancelled" value={iv.cancelled} accent="slate" />
            <StatCard label="Success rate" value={formatPercent(iv.successRate) ?? NO_DATA} accent="indigo" hint="Selected ÷ completed interviews" />
          </div>
        </section>
      </div>
    </>
  );
}
