import { useState } from 'react';
import { Send } from 'lucide-react';
import Button from '../ui/Button';
import { CharCount, FormField, Input, Select, Textarea } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { feedbackService } from '../../services/endpoints';
import { SYSTEM_FEEDBACK_TYPES } from '../../utils/constants';
import { collectErrors, required } from '../../utils/validation';

/** Suggestions, bug reports and improvement ideas for the platform (any signed-in user). */
export default function SystemFeedbackForm({ onSubmitted }) {
  const toast = useToast();
  const empty = { feedbackType: '', title: '', description: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = collectErrors({
      feedbackType: required(form.feedbackType, 'Feedback type'),
      title: required(form.title, 'Title') || (form.title.trim().length < 5 ? 'Title must be at least 5 characters.' : null),
      description: required(form.description, 'Description')
        || (form.description.trim().length < 10 ? 'Description must be at least 10 characters.' : null),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await feedbackService.systemCreate({ ...form, title: form.title.trim(), description: form.description.trim() });
      toast.success('Thank you! Your feedback has been submitted.');
      setForm(empty);
      onSubmitted?.();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-3">
      <FormField label="Type" required error={errors.feedbackType}>
        {(p) => (
          <Select {...p} value={form.feedbackType} onChange={set('feedbackType')}>
            <option value="">Select type</option>
            {Object.entries(SYSTEM_FEEDBACK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        )}
      </FormField>
      <FormField label="Title" required error={errors.title} className="sm:col-span-2">
        {(p) => <Input {...p} maxLength={150} placeholder="Short summary" value={form.title} onChange={set('title')} />}
      </FormField>
      <FormField label="Description" required error={errors.description} className="sm:col-span-3"
                 hint="For bugs, describe what you did, what happened and what you expected.">
        {(p) => (
          <>
            <Textarea {...p} rows={4} maxLength={5000} value={form.description} onChange={set('description')} />
            <CharCount value={form.description} max={5000} min={10} />
          </>
        )}
      </FormField>
      <div className="sm:col-span-3"><Button type="submit" icon={Send} loading={saving}>Submit feedback</Button></div>
    </form>
  );
}
