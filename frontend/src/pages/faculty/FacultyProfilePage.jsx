import { useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { FormField, Input } from '../../components/ui/FormField';
import { ErrorState, PageLoader } from '../../components/ui/States';
import ChangePasswordCard from '../../components/domain/ChangePasswordCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { facultyService } from '../../services/endpoints';
import { DEPARTMENT_SUGGESTIONS } from '../../utils/constants';
import { collectErrors, required, validatePhone } from '../../utils/validation';

export default function FacultyProfilePage() {
  const { data, loading, error, reload } = useApi(() => facultyService.me(), []);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  return <FacultyProfileContent data={data} />;
}

function FacultyProfileContent({ data }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState(() => ({
    name: data.name, department: data.department, designation: data.designation, phone: data.phone,
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
      name: required(form.name, 'Name'), department: required(form.department, 'Department'),
      designation: required(form.designation, 'Designation'), phone: validatePhone(form.phone),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await facultyService.updateMe(form);
      refreshUser().catch(() => {});
      toast.success('Profile updated.');
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Your details as shown to students and administrators." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Faculty details" icon={UserRound} />
          <CardBody>
            <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full name" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set('name')} />}</FormField>
              <FormField label="E-mail" hint="Contact the administrator to change your login e-mail.">{(p) => <Input {...p} value={data.email} disabled />}</FormField>
              <FormField label="Department" required error={errors.department}>
                {(p) => (<><Input {...p} list="fac-departments" value={form.department} onChange={set('department')} />
                  <datalist id="fac-departments">{DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist></>)}
              </FormField>
              <FormField label="Designation" required error={errors.designation}>{(p) => <Input {...p} value={form.designation} onChange={set('designation')} />}</FormField>
              <FormField label="Phone" required error={errors.phone}>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} />}</FormField>
              <div className="sm:col-span-2"><Button type="submit" icon={Save} loading={saving}>Save changes</Button></div>
            </form>
          </CardBody>
        </Card>
        <ChangePasswordCard />
      </div>
    </>
  );
}
