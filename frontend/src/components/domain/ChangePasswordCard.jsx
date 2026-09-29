import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import Button from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { FormField, Input } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { authService } from '../../services/endpoints';
import { collectErrors, isStrongPassword, required } from '../../utils/validation';
import PasswordChecklist from './PasswordChecklist';

export default function ChangePasswordCard() {
  const toast = useToast();
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = collectErrors({
      currentPassword: required(form.currentPassword, 'Current password'),
      newPassword: isStrongPassword(form.newPassword) ? null : 'New password does not meet the requirements.',
      confirmPassword: form.confirmPassword !== form.newPassword ? 'Passwords do not match.' : null,
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await authService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Your password has been changed.');
      setForm(empty);
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" icon={KeyRound} description="Use a strong password that you do not use elsewhere." />
      <CardBody>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
          <FormField label="Current password" required error={errors.currentPassword}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={form.currentPassword} onChange={update('currentPassword')} />}
          </FormField>
          <FormField label="New password" required error={errors.newPassword}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.newPassword} onChange={update('newPassword')} />}
          </FormField>
          <FormField label="Confirm new password" required error={errors.confirmPassword}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} />}
          </FormField>
          <div className="sm:col-span-3"><PasswordChecklist value={form.newPassword} /></div>
          <div className="sm:col-span-3"><Button type="submit" loading={saving}>Update password</Button></div>
        </form>
      </CardBody>
    </Card>
  );
}
