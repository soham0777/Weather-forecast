import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import AuthLayout from '../../layouts/AuthLayout';
import Button from '../../components/ui/Button';
import { FormField, Input } from '../../components/ui/FormField';
import { Alert } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getErrorMessage } from '../../services/api';
import { collectErrors, required, validateEmail } from '../../utils/validation';

export default function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = collectErrors({ email: validateEmail(form.email), password: required(form.password, 'Password') });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    setServerError(null);
    try {
      // PublicOnlyRoute performs the redirect once the user is set.
      await login(form.email.trim(), form.password, location.state?.from);
    } catch (err) {
      setServerError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your student, faculty or administrator account.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <FormField label="E-mail address" required error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder="name@college.edu" value={form.email} onChange={update('email')} />}
        </FormField>
        <FormField label="Password" required error={errors.password}>
          {(p) => (
            <div className="relative">
              <Input {...p} type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-10"
                     value={form.password} onChange={update('password')} />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={submitting} icon={LogIn}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        New student? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">
        Faculty and administrator accounts are created by the placement cell.
      </p>
      {import.meta.env.DEV && (
        <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Development only — sample accounts from database/seed.sql</p>
          <p className="mt-1">admin@cims.test / Admin@123 · priya.sharma@cims.test / Faculty@123 · aarav.patil@students.cims.test / Student@123</p>
        </div>
      )}
    </AuthLayout>
  );
}
