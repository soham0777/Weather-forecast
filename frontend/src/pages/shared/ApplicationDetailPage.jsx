import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award, CalendarPlus, CheckCircle2, Edit3, FileText, ListChecks, MessageSquare, Star, Trophy, Undo2, XCircle,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DescriptionList from '../../components/ui/DescriptionList';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import { CharCount, FormField, Textarea } from '../../components/ui/FormField';
import { RatingDisplay } from '../../components/ui/StarRating';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/States';
import ApplicationTimeline from '../../components/domain/ApplicationTimeline';
import InterviewFormModal from '../../components/domain/InterviewFormModal';
import InterviewResultModal from '../../components/domain/InterviewResultModal';
import RatingFormModal from '../../components/domain/RatingFormModal';
import RatingsSummary from '../../components/domain/RatingsSummary';
import {
  COMPANY_FEEDBACK_RATINGS, COMPANY_FEEDBACK_TEXTS, EVALUATION_RATINGS, EVALUATION_TEXTS, STUDENT_FEEDBACK_RATINGS,
  STUDENT_FEEDBACK_TEXTS,
} from '../../components/domain/ratingConfigs';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useRoleBase } from '../../hooks/useRoleBase';
import { getErrorMessage, openPdf } from '../../services/api';
import { applicationService, evaluationService, feedbackService, interviewService } from '../../services/endpoints';
import { formatDate, formatDateTime, formatStipend, formatTime } from '../../utils/format';

const DECISIONS = {
  SHORTLISTED: { label: 'Shortlist', icon: ListChecks, variant: 'primary', message: 'Shortlist this applicant? You can then schedule an interview.' },
  ACCEPTED: { label: 'Accept', icon: CheckCircle2, variant: 'success', message: 'Accept this applicant for the internship? The student will see the offer immediately.' },
  REJECTED: { label: 'Reject', icon: XCircle, variant: 'danger', message: 'Reject this application? Any scheduled interview will be cancelled. This cannot be undone.' },
};

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const base = useRoleBase();
  const toast = useToast();
  const isStudent = user.role === 'STUDENT';
  const { data, setData, loading, error, reload } = useApi(() => applicationService.get(id), [id]);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState(null); // 'withdraw' | 'complete' | { cancel: interview }
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // { type, payload }
  const [edit, setEdit] = useState(null);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { application: app, actions } = data;
  const myEvaluation = data.evaluations.find((e) => e.evaluatorId === user.id);

  const run = async (fn, success) => {
    setBusy(true);
    try {
      const result = await fn();
      if (result?.application) setData(result); else await reload();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    const ok = await run(() => applicationService.changeStatus(id, decision, comment.trim() || null),
      `Application ${DECISIONS[decision].label.toLowerCase()}ed.`);
    if (ok) { setDecision(null); setComment(''); }
  };

  const viewResume = async () => {
    try {
      await openPdf(`/applications/${id}/resume`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeModal = (saved) => {
    setModal(null);
    if (saved) reload();
  };

  const interviewActions = (i) => i.status === 'SCHEDULED' && !isStudent && (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'reschedule', payload: i })}>Reschedule</Button>
      <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'result', payload: i })}>Record result</Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm({ cancel: i })}>Cancel interview</Button>
    </div>
  );

  return (
    <>
      <PageHeader title={app.internship.title} backTo={`${base}/applications`} backLabel="Back to applications"
                  description={`${app.internship.companyName} · Applied ${formatDateTime(app.appliedAt)}`}
                  actions={<StatusBadge status={app.status} className="text-sm" />} />

      {isStudent && app.status === 'ACCEPTED' && (
        <div className="mb-6"><Alert tone="success" title="Congratulations! You have been selected for this internship.">
          Starts {formatDate(app.internship.startDate)} · {formatStipend(app.internship.stipend)}
          {app.completedAt && ` · Completed on ${formatDateTime(app.completedAt)}`}</Alert></div>
      )}
      {actions.canSubmitStudentFeedback && (
        <div className="mb-6"><Alert tone="info" title="Tell us about your internship"
          action={<Button size="sm" icon={MessageSquare} onClick={() => setModal({ type: 'studentFeedback' })}>Give feedback</Button>}>
          Your feedback helps future students and the placement cell.</Alert></div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Decision panel for reviewers */}
          {!isStudent && (actions.allowedStatusChanges.length > 0 || actions.canMarkCompleted) && (
            <Card>
              <CardHeader title="Review decision" description="Every decision is recorded in the application timeline." />
              <CardBody className="flex flex-wrap gap-2">
                {actions.allowedStatusChanges.map((status) => {
                  const d = DECISIONS[status];
                  return <Button key={status} variant={d.variant} icon={d.icon} onClick={() => setDecision(status)}>{d.label}</Button>;
                })}
                {actions.canScheduleInterview && (
                  <Button variant="secondary" icon={CalendarPlus} onClick={() => setModal({ type: 'schedule' })}>Schedule interview</Button>
                )}
                {actions.canMarkCompleted && (
                  <Button variant="secondary" icon={Trophy} onClick={() => setConfirm('complete')}>Mark internship completed</Button>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Application" icon={FileText}
                        actions={(
                          <>
                            <Button size="sm" variant="secondary" icon={FileText} onClick={viewResume}>View submitted resume</Button>
                            {actions.canEdit && <Button size="sm" variant="secondary" icon={Edit3}
                              onClick={() => setEdit({ coverLetter: data.coverLetter, qualifications: data.qualifications || '' })}>Edit</Button>}
                          </>
                        )} />
            <CardBody className="space-y-4">
              <div>
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Cover letter</h3>
                <p className="mt-1 text-sm leading-6 whitespace-pre-line text-slate-800">{data.coverLetter}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Qualifications</h3>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-800">{data.qualifications || '—'}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Interviews" icon={CalendarPlus}
                        actions={actions.canScheduleInterview && <Button size="sm" icon={CalendarPlus} onClick={() => setModal({ type: 'schedule' })}>Schedule</Button>} />
            <CardBody>
              {data.interviews.length === 0 ? (
                <EmptyState title="No interviews yet." message={app.status === 'SHORTLISTED' && isStudent ? 'You will see interview details here once scheduled.' : undefined} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.interviews.map((i) => (
                    <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{formatDate(i.interviewDate)} at {formatTime(i.interviewTime)}</p>
                          <p className="text-sm text-slate-600">With {i.interviewerName}</p>
                          {i.interviewerDetails && <p className="text-sm text-slate-500">{i.interviewerDetails}</p>}
                        </div>
                        <div className="flex gap-2"><StatusBadge status={i.status} />{i.result && <StatusBadge status={i.result} />}</div>
                      </div>
                      {i.comments && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{i.comments}</p>}
                      {interviewActions(i)}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {(app.status === 'ACCEPTED' || data.evaluations.length > 0) && (
            <Card>
              <CardHeader title="Evaluations" icon={Star}
                          actions={(
                            <>
                              {actions.canEvaluate && <Button size="sm" icon={Star} onClick={() => setModal({ type: 'evaluation' })}>Evaluate</Button>}
                              {myEvaluation && !isStudent && <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ type: 'evaluation', payload: myEvaluation })}>Edit my evaluation</Button>}
                            </>
                          )} />
              <CardBody className="space-y-5">
                {data.evaluations.length === 0 && <EmptyState title="No evaluations recorded yet." />}
                {data.evaluations.map((e) => (
                  <div key={e.id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">By {e.evaluatorName} · {formatDateTime(e.updatedAt)}</p>
                      <span className="text-sm text-slate-600">Overall <RatingDisplay value={e.overallRating} /></span>
                    </div>
                    <RatingsSummary fields={EVALUATION_RATINGS.slice(0, 6)} values={e} />
                    {e.comments && <p className="mt-2 text-sm text-slate-600">“{e.comments}”</p>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {(data.companyFeedback || actions.canRecordCompanyFeedback) && (
            <Card>
              <CardHeader title="Company feedback on the intern" icon={Award}
                          actions={(
                            <>
                              {actions.canRecordCompanyFeedback && <Button size="sm" icon={Award} onClick={() => setModal({ type: 'companyFeedback' })}>Record company feedback</Button>}
                              {data.companyFeedback && !isStudent && <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ type: 'companyFeedback', payload: data.companyFeedback })}>Edit</Button>}
                            </>
                          )} />
              <CardBody>
                {data.companyFeedback ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">Given by {data.companyFeedback.companyRepresentative || 'the company'} · recorded {formatDateTime(data.companyFeedback.createdAt)}</p>
                    <RatingsSummary fields={COMPANY_FEEDBACK_RATINGS} values={data.companyFeedback} />
                    <DescriptionList items={[
                      { label: 'Strengths', value: data.companyFeedback.strengths },
                      { label: 'Areas for improvement', value: data.companyFeedback.areasForImprovement },
                      { label: 'Comments', value: data.companyFeedback.comments, wide: true },
                    ]} />
                  </div>
                ) : <EmptyState title="The company's feedback has not been recorded yet." />}
              </CardBody>
            </Card>
          )}

          {data.studentFeedback && (
            <Card>
              <CardHeader title="Student's feedback about the internship" icon={MessageSquare}
                          actions={isStudent && <Button size="sm" variant="secondary" icon={Edit3} onClick={() => setModal({ type: 'studentFeedback', payload: data.studentFeedback })}>Edit</Button>} />
              <CardBody className="space-y-3">
                <RatingsSummary fields={STUDENT_FEEDBACK_RATINGS} values={data.studentFeedback} />
                <DescriptionList items={[
                  { label: 'Comments', value: data.studentFeedback.comments },
                  { label: 'Suggestions', value: data.studentFeedback.suggestions },
                ]} />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {isStudent && actions.canWithdraw && (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-600">Changed your mind? Withdrawing keeps a record of your application but removes you from consideration.</p>
                <Button className="mt-3 w-full" variant="secondary" icon={Undo2} onClick={() => setConfirm('withdraw')}>Withdraw application</Button>
              </CardBody>
            </Card>
          )}
          {!isStudent && (
            <Card>
              <CardHeader title="Student" />
              <CardBody>
                <DescriptionList columns={1} items={[
                  { label: 'Name', value: app.student.name },
                  { label: 'E-mail', value: <a className="text-brand-700 hover:underline" href={`mailto:${app.student.email}`}>{app.student.email}</a> },
                  { label: 'Phone', value: app.student.phone },
                  { label: 'Department', value: app.student.department },
                  { label: 'CGPA', value: app.student.gpa },
                ]} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Timeline" />
            <CardBody><ApplicationTimeline events={data.timeline} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Internship" />
            <CardBody>
              <DescriptionList columns={1} items={[
                { label: 'Company', value: app.internship.companyName },
                { label: 'Location', value: app.internship.location },
                { label: 'Dates', value: `${formatDate(app.internship.startDate)} – ${formatDate(app.internship.endDate)}` },
                { label: 'Stipend', value: formatStipend(app.internship.stipend) },
                { label: 'Coordinator', value: app.internship.facultyName },
              ]} />
              <Link to={`${base}/internships/${app.internship.id}`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">View internship</Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog open={Boolean(decision)} title={decision && `${DECISIONS[decision].label} application`}
                     message={decision && DECISIONS[decision].message} confirmLabel={decision && DECISIONS[decision].label}
                     tone={decision === 'REJECTED' ? 'danger' : 'primary'} loading={busy}
                     onCancel={() => { setDecision(null); setComment(''); }} onConfirm={decide}>
        <FormField label="Comment for the timeline (optional)">
          {(p) => <Textarea {...p} rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />}
        </FormField>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'withdraw'} title="Withdraw application" confirmLabel="Withdraw" loading={busy}
                     message="Are you sure you want to withdraw this application? You cannot apply to this internship again."
                     onCancel={() => setConfirm(null)}
                     onConfirm={async () => { if (await run(() => applicationService.withdraw(id), 'Application withdrawn.')) setConfirm(null); }} />
      <ConfirmDialog open={confirm === 'complete'} title="Mark internship completed" tone="primary" confirmLabel="Mark completed" loading={busy}
                     message="Confirm that this student has completed the internship. The student can then submit feedback."
                     onCancel={() => setConfirm(null)}
                     onConfirm={async () => { if (await run(() => applicationService.complete(id), 'Internship marked as completed.')) setConfirm(null); }} />
      <ConfirmDialog open={Boolean(confirm?.cancel)} title="Cancel interview" confirmLabel="Cancel interview" cancelLabel="Keep interview" loading={busy}
                     message="Are you sure you want to cancel this interview? The student will see it as cancelled."
                     onCancel={() => { setConfirm(null); setCancelReason(''); }}
                     onConfirm={async () => {
                       if (await run(() => interviewService.cancel(confirm.cancel.id, cancelReason.trim() || null), 'Interview cancelled.')) {
                         setConfirm(null); setCancelReason('');
                       }
                     }}>
        <FormField label="Reason (shown to the student)">
          {(p) => <Textarea {...p} rows={2} maxLength={1000} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />}
        </FormField>
      </ConfirmDialog>

      {modal?.type === 'schedule' && (
        <InterviewFormModal open onClose={() => setModal(null)} onSaved={() => reload()} applicationId={app.id}
                            deadline={app.internship.applicationDeadline} />
      )}
      {modal?.type === 'reschedule' && (
        <InterviewFormModal open onClose={() => setModal(null)} onSaved={() => reload()} interview={modal.payload}
                            deadline={app.internship.applicationDeadline} />
      )}
      {modal?.type === 'result' && <InterviewResultModal open onClose={() => setModal(null)} onSaved={() => reload()} interview={modal.payload} />}
      {modal?.type === 'evaluation' && (
        <RatingFormModal open title={modal.payload ? 'Edit evaluation' : 'Evaluate intern'} description={`${app.student.name} · ${app.internship.title}`}
                         ratings={EVALUATION_RATINGS} texts={EVALUATION_TEXTS} initial={modal.payload || {}} successMessage="Evaluation saved."
                         submitLabel="Save evaluation" onClose={closeModal}
                         onSubmit={(values) => (modal.payload
                           ? evaluationService.update(modal.payload.id, { ...values, applicationId: app.id })
                           : evaluationService.create({ ...values, applicationId: app.id }))} />
      )}
      {modal?.type === 'companyFeedback' && (
        <RatingFormModal open title="Company feedback on intern" description="Enter the ratings given by the company for this intern."
                         ratings={COMPANY_FEEDBACK_RATINGS} texts={COMPANY_FEEDBACK_TEXTS} initial={modal.payload || {}}
                         successMessage="Company feedback saved." onClose={closeModal}
                         onSubmit={(values) => (modal.payload
                           ? feedbackService.companyUpdate(modal.payload.id, { ...values, applicationId: app.id })
                           : feedbackService.companyCreate({ ...values, applicationId: app.id }))} />
      )}
      {modal?.type === 'studentFeedback' && (
        <RatingFormModal open title="Internship feedback" description={`${app.internship.title} at ${app.internship.companyName}`}
                         ratings={STUDENT_FEEDBACK_RATINGS} texts={STUDENT_FEEDBACK_TEXTS} initial={modal.payload || {}}
                         successMessage="Thank you for your feedback." onClose={closeModal}
                         onSubmit={(values) => (modal.payload
                           ? feedbackService.studentUpdate(modal.payload.id, { ...values, applicationId: app.id })
                           : feedbackService.studentCreate({ ...values, applicationId: app.id }))} />
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Edit application" size="lg"
             footer={(
               <>
                 <Button variant="secondary" onClick={() => setEdit(null)} disabled={busy}>Cancel</Button>
                 <Button loading={busy} onClick={async () => {
                   if ((edit.coverLetter || '').trim().length < 50) { toast.error('Cover letter must be at least 50 characters.'); return; }
                   if (await run(() => applicationService.update(id, { coverLetter: edit.coverLetter.trim(), qualifications: edit.qualifications.trim() || null }), 'Application updated.')) setEdit(null);
                 }}>Save changes</Button>
               </>
             )}>
        {edit && (
          <div className="space-y-4">
            <FormField label="Cover letter" required>
              {(p) => (<><Textarea {...p} rows={8} maxLength={3000} value={edit.coverLetter} onChange={(e) => setEdit((v) => ({ ...v, coverLetter: e.target.value }))} />
                <CharCount value={edit.coverLetter} max={3000} min={50} /></>)}
            </FormField>
            <FormField label="Qualifications">
              {(p) => <Textarea {...p} rows={3} maxLength={2000} value={edit.qualifications} onChange={(e) => setEdit((v) => ({ ...v, qualifications: e.target.value }))} />}
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
