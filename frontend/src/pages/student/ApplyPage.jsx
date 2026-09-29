import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { CharCount, FormField, Textarea } from '../../components/ui/FormField';
import { Alert, ErrorState, PageLoader } from '../../components/ui/States';
import ResumeUpload from '../../components/domain/ResumeUpload';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { applicationService, internshipService, studentService } from '../../services/endpoints';
import { deadlineLabel, formatDate, formatStipend } from '../../utils/format';

export default function ApplyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(async () => {
    const [internship, profile] = await Promise.all([internshipService.get(id), studentService.me()]);
    return { internship, profile };
  }, [id]);
  const [form, setForm] = useState({ coverLetter: '', qualifications: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { internship, profile } = data;
  if (internship.myApplicationId) return <Navigate to={`/student/applications/${internship.myApplicationId}`} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!profile.resume.uploaded) found.resume = 'Please upload your resume first.';
    if (form.coverLetter.trim().length < 50) found.coverLetter = 'Cover letter must be at least 50 characters.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await applicationService.apply({ internshipId: Number(id), coverLetter: form.coverLetter.trim(),
        qualifications: form.qualifications.trim() || null });
      toast.success('Application submitted successfully.');
      navigate(`/student/applications/${result.application.id}`, { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader title={`Apply: ${internship.title}`} backTo={`/student/internships/${id}`} backLabel="Back to internship"
                  description={`${internship.companyName} · ${formatStipend(internship.stipend)} · starts ${formatDate(internship.startDate)}`} />
      {!internship.acceptingApplications ? (
        <Alert tone="warning" title="This internship is not accepting applications">The deadline may have passed or applications are closed.</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {serverError && <Alert tone="error">{serverError}</Alert>}
            <Card>
              <CardHeader title="1. Resume" description="Your current profile resume is attached to this application." />
              <CardBody>
                <ResumeUpload resume={profile.resume} onUploaded={(p) => setData((d) => ({ ...d, profile: p }))} />
                {errors.resume && <p className="mt-2 text-sm font-medium text-rose-600">{errors.resume}</p>}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="2. Cover letter & qualifications" />
              <CardBody className="space-y-4">
                <FormField label="Cover letter" required error={errors.coverLetter}
                           hint="Explain why you are interested and what makes you a good fit (50–3000 characters).">
                  {(p) => (<><Textarea {...p} rows={9} maxLength={3000} value={form.coverLetter}
                                     onChange={(e) => setForm((f) => ({ ...f, coverLetter: e.target.value }))} />
                    <CharCount value={form.coverLetter} max={3000} min={50} /></>)}
                </FormField>
                <FormField label="Qualifications" error={errors.qualifications} hint="Relevant skills, certifications, projects (optional).">
                  {(p) => <Textarea {...p} rows={4} maxLength={2000} placeholder="e.g. Java, Spring Boot, React; AWS Cloud Practitioner"
                                    value={form.qualifications} onChange={(e) => setForm((f) => ({ ...f, qualifications: e.target.value }))} />}
                </FormField>
              </CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Before you submit" />
              <CardBody className="space-y-3 text-sm text-slate-600">
                <p className="flex gap-2"><CheckCircle2 className={`h-5 w-5 shrink-0 ${profile.resume.uploaded ? 'text-emerald-600' : 'text-slate-300'}`} aria-hidden="true" />
                  Resume uploaded {profile.resume.uploaded ? '' : '(required)'}</p>
                <p className="flex gap-2"><CheckCircle2 className={`h-5 w-5 shrink-0 ${form.coverLetter.trim().length >= 50 ? 'text-emerald-600' : 'text-slate-300'}`} aria-hidden="true" />
                  Cover letter written</p>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{deadlineLabel(internship.applicationDeadline)} ({formatDate(internship.applicationDeadline)}).
                  You can apply only once, but you can edit a pending application until the deadline.</p>
                <Button type="submit" className="w-full" size="lg" icon={Send} loading={submitting}>Submit application</Button>
              </CardBody>
            </Card>
          </div>
        </form>
      )}
    </>
  );
}
