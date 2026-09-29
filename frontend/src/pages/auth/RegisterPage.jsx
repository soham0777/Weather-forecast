import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import PasswordChecklist from '../../components/domain/PasswordChecklist';
import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/ui/Button';
import { FormField, Input } from '../../components/ui/FormField';
import { Alert } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { DEPARTMENT_SUGGESTIONS } from '../../utils/constants';
import {
  collectErrors, isStrongPassword, required, validateEmail, validateGpa, validatePhone,
} from '../../utils/validation';

export default function RegisterPage() {
  useDocumentTitle('Student registration');
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', department: '', gpa: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = collectErrors({
      name: required(form.name, 'Full name') || (form.name.trim().length < 2 ? 'Full name must be at least 2 characters.' : null),
      email: validateEmail(form.email),
      password: isStrongPassword(form.password) ? null : 'Password does not meet all the requirements below.',
      confirmPassword: form.confirmPassword !== form.password ? 'Passwords do not match.' : null,
      phone: validatePhone(form.phone),
      department: required(form.department, 'Department'),
      gpa: validateGpa(form.gpa),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await register({
        name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim(),
        department: form.department.trim(), gpa: Number(form.gpa),
      }, '/student/profile');
      toast.success('Welcome! Your account has been created. Please verify your e-mail and upload your resume.');
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your student account" subtitle="Register to browse and apply for internships." wide>
      <form onSubmit={submit} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.name} className="sm:col-span-2">
            {(p) => <Input {...p} autoComplete="name" placeholder="e.g. Bhakti Kulkarni" value={form.name} onChange={update('name')} />}
          </FormField>
          <FormField label="College e-mail" required error={errors.email} className="sm:col-span-2">
            {(p) => <Input {...p} type="email" autoComplete="email" placeholder="name@college.edu" value={form.email} onChange={update('email')} />}
          </FormField>
          <FormField label="Password" required error={errors.password}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={update('password')} />}
          </FormField>
          <FormField label="Confirm password" required error={errors.confirmPassword}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} />}
          </FormField>
          <div className="sm:col-span-2 -mt-2"><PasswordChecklist value={form.password} /></div>
          <FormField label="Mobile number" required error={errors.phone} hint="10–15 digits, e.g. 9876543210">
            {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="9876543210" value={form.phone} onChange={update('phone')} />}
          </FormField>
          <FormField label="CGPA (out of 10)" required error={errors.gpa}>
            {(p) => <Input {...p} type="number" inputMode="decimal" min="0" max="10" step="0.01" placeholder="8.25" value={form.gpa} onChange={update('gpa')} />}
          </FormField>
          <FormField label="Department" required error={errors.department} className="sm:col-span-2">
            {(p) => (
              <>
                <Input {...p} list="departments" placeholder="Start typing, e.g. Computer Engineering" value={form.department} onChange={update('department')} />
                <datalist id="departments">{DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist>
              </>
            )}
          </FormField>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={submitting} icon={UserPlus}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
