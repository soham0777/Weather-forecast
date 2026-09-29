import { useState } from 'react';
import { FileText, Save, UserRound } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { FormField, Input } from '../../components/ui/FormField';
import { ErrorState, PageLoader } from '../../components/ui/States';
import ResumeUpload from '../../components/domain/ResumeUpload';
import ChangePasswordCard from '../../components/domain/ChangePasswordCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { studentService } from '../../services/endpoints';
import { DEPARTMENT_SUGGESTIONS } from '../../utils/constants';
import { collectErrors, required, validateGpa, validatePhone } from '../../utils/validation';

export default function StudentProfilePage() {
  const { data: profile, setData, loading, error, reload } = useApi(() => studentService.me(), []);
  if (loading && !profile) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!profile) return null;
  return <StudentProfileContent profile={profile} setData={setData} />;
}

function StudentProfileContent({ profile, setData }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState(() => ({
    name: profile.name, phone: profile.phone, department: profile.department, gpa: String(profile.gpa),
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };
  const save = async (e) => {
    e.preventDefault();
    const found = collectErrors({
      name: required(form.name, 'Full name'), phone: validatePhone(form.phone),
      department: required(form.department, 'Department'), gpa: validateGpa(form.gpa),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const updated = await studentService.updateMe({ ...form, name: form.name.trim(), gpa: Number(form.gpa) });
      setData(updated);
      refreshUser().catch(() => {});
      toast.success('Profile updated.');
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const stats = profile.applicationStats;
  return (
    <>
      <PageHeader title="Profile & resume" description="Keep your details and resume up to date before applying." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Personal details" icon={UserRound} />
            <CardBody>
              <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name" required error={errors.name} className="sm:col-span-2">
                  {(p) => <Input {...p} maxLength={100} value={form.name} onChange={set('name')} />}
                </FormField>
                <FormField label="E-mail" hint="Contact the administrator to change your login e-mail.">
                  {(p) => <Input {...p} value={profile.email} disabled />}
                </FormField>
                <FormField label="Mobile number" required error={errors.phone}>
                  {(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} />}
                </FormField>
                <FormField label="Department" required error={errors.department}>
                  {(p) => (<><Input {...p} list="profile-departments" value={form.department} onChange={set('department')} />
                    <datalist id="profile-departments">{DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist></>)}
                </FormField>
                <FormField label="CGPA (out of 10)" required error={errors.gpa}>
                  {(p) => <Input {...p} type="number" min="0" max="10" step="0.01" value={form.gpa} onChange={set('gpa')} />}
                </FormField>
                <div className="sm:col-span-2"><Button type="submit" icon={Save} loading={saving}>Save changes</Button></div>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Resume" icon={FileText} description="Mandatory for internship applications." />
            <CardBody><ResumeUpload resume={profile.resume} onUploaded={setData} /></CardBody>
          </Card>
          <ChangePasswordCard />
        </div>
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <ProgressBar value={profile.profileCompletion} label="Profile completion" />
              <ul className="space-y-1.5 text-sm">
                <li className="flex justify-between"><span className="text-slate-600">Resume</span>
                  <Badge tone={profile.resume.uploaded ? 'green' : 'amber'}>{profile.resume.uploaded ? 'Uploaded' : 'Missing'}</Badge></li>
                <li className="flex justify-between"><span className="text-slate-600">E-mail</span>
                  <Badge tone={profile.verified ? 'green' : 'amber'}>{profile.verified ? 'Verified' : 'Not verified'}</Badge></li>
                <li className="flex justify-between"><span className="text-slate-600">Account</span>
                  <Badge tone={profile.active ? 'green' : 'red'}>{profile.active ? 'Active' : 'Inactive'}</Badge></li>
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Application statistics" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[['Total', stats.total], ['Pending', stats.pending], ['Shortlisted', stats.shortlisted], ['Accepted', stats.accepted],
                  ['Rejected', stats.rejected], ['Withdrawn', stats.withdrawn]].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">{label}</dt><dd className="text-lg font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
