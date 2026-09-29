import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { FormField, Input, Textarea } from '../ui/FormField';
import { Alert } from '../ui/States';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { interviewService } from '../../services/endpoints';
import { formatDate } from '../../utils/format';
import { collectErrors, required } from '../../utils/validation';

/**
 * Schedule (applicationId) or reschedule (interview) an interview. The server enforces:
 * not in the past, at least 24 hours' notice, not after the application deadline.
 */
export default function InterviewFormModal({ open, onClose, onSaved, applicationId, interview, deadline }) {
  const toast = useToast();
  const editing = Boolean(interview);
  const [form, setForm] = useState(() => ({
    interviewDate: interview?.interviewDate || '',
    interviewTime: interview?.interviewTime?.slice(0, 5) || '',
    interviewerName: interview?.interviewerName || '',
    interviewerDetails: interview?.interviewerDetails || '',
    comments: interview?.comments || '',
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };

  const submit = async (e) => {
    e?.preventDefault();
    const found = collectErrors({
      interviewDate: required(form.interviewDate, 'Interview date'),
      interviewTime: required(form.interviewTime, 'Interview time'),
      interviewerName: required(form.interviewerName, 'Interviewer name'),
    });
    if (!found.interviewDate && !found.interviewTime) {
      const slot = new Date(`${form.interviewDate}T${form.interviewTime}`);
      if (slot.getTime() < Date.now() + 24 * 3600 * 1000) {
        found.interviewDate = 'Choose a slot at least 24 hours from now.';
      } else if (deadline && form.interviewDate > deadline) {
        found.interviewDate = `Must be on or before the application deadline (${formatDate(deadline)}).`;
      }
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = {
        interviewDate: form.interviewDate,
        interviewTime: form.interviewTime,
        interviewerName: form.interviewerName.trim(),
        interviewerDetails: form.interviewerDetails.trim() || null,
      };
      const saved = editing
        ? await interviewService.update(interview.id, { ...payload, comments: form.comments.trim() || null })
        : await interviewService.schedule({ ...payload, applicationId });
      toast.success(editing ? 'Interview updated.' : 'Interview scheduled.');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Reschedule interview' : 'Schedule interview'}
           description={deadline ? `Interviews need at least 24 hours' notice and must be on or before ${formatDate(deadline)}.` : undefined}
           footer={(
             <>
               <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
               <Button onClick={submit} loading={saving}>{editing ? 'Save changes' : 'Schedule interview'}</Button>
             </>
           )}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {serverError && <div className="sm:col-span-2"><Alert tone="error">{serverError}</Alert></div>}
        <FormField label="Date" required error={errors.interviewDate}>
          {(p) => <Input {...p} type="date" max={deadline || undefined} value={form.interviewDate} onChange={set('interviewDate')} />}
        </FormField>
        <FormField label="Time" required error={errors.interviewTime}>
          {(p) => <Input {...p} type="time" value={form.interviewTime} onChange={set('interviewTime')} />}
        </FormField>
        <FormField label="Interviewer name" required error={errors.interviewerName} className="sm:col-span-2">
          {(p) => <Input {...p} maxLength={100} placeholder="e.g. Mr. Sandeep Rao" value={form.interviewerName} onChange={set('interviewerName')} />}
        </FormField>
        <FormField label="Interviewer details / venue" error={errors.interviewerDetails} className="sm:col-span-2"
                   hint="Designation, venue or online meeting information shared with the student.">
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={form.interviewerDetails} onChange={set('interviewerDetails')} />}
        </FormField>
        {editing && (
          <FormField label="Comments" error={errors.comments} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} maxLength={1000} value={form.comments} onChange={set('comments')} />}
          </FormField>
        )}
      </form>
    </Modal>
  );
}
