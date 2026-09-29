import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { FormField, Input, Textarea } from '../ui/FormField';
import { StarRatingInput } from '../ui/StarRating';
import { Alert } from '../ui/States';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../../services/api';

/**
 * Generic 1–5 rating form used for evaluations and all feedback types.
 * ratings: [{ key, label, description? }]   texts: [{ key, label, max, rows?, input? }]
 */
export default function RatingFormModal({ open, onClose, title, description, ratings, texts = [], initial = {},
  submitLabel = 'Save', onSubmit, successMessage }) {
  const toast = useToast();
  const [values, setValues] = useState(() => {
    const v = {};
    ratings.forEach((r) => { v[r.key] = initial[r.key] ?? null; });
    texts.forEach((t) => { v[t.key] = initial[t.key] ?? ''; });
    return v;
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const found = {};
    ratings.forEach((r) => { if (!values[r.key]) found[r.key] = 'Please choose a rating from 1 to 5.'; });
    setErrors(found);
    if (Object.keys(found).length) {
      setServerError('Please rate every item.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const payload = { ...values };
      texts.forEach((t) => { payload[t.key] = values[t.key]?.trim() || null; });
      const saved = await onSubmit(payload);
      toast.success(successMessage || 'Saved.');
      onClose(saved);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose()} title={title} description={description} size="lg"
           footer={(
             <>
               <Button variant="secondary" onClick={() => onClose()} disabled={saving}>Cancel</Button>
               <Button onClick={submit} loading={saving}>{submitLabel}</Button>
             </>
           )}>
      <div className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          {ratings.map((r) => (
            <StarRatingInput key={r.key} label={r.label} description={r.description} value={values[r.key]}
                             error={errors[r.key]} onChange={(n) => setValues((v) => ({ ...v, [r.key]: n }))} />
          ))}
        </div>
        {texts.map((t) => (
          <FormField key={t.key} label={t.label} error={errors[t.key]}>
            {(p) => (t.input
              ? <Input {...p} maxLength={t.max} value={values[t.key]} onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))} />
              : <Textarea {...p} rows={t.rows || 3} maxLength={t.max} value={values[t.key]}
                          onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))} />)}
          </FormField>
        ))}
      </div>
    </Modal>
  );
}
