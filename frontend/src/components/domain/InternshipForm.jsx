import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import Button from '../ui/Button';
import { CharCount, FormField, Input, Select, Textarea } from '../ui/FormField';
import { Alert } from '../ui/States';
import { DOMAIN_SUGGESTIONS } from '../../utils/constants';
import { parseLocalDate, todayIso } from '../../utils/format';
import { collectErrors, required } from '../../utils/validation';

/** Weeks between two yyyy-MM-dd dates (whole weeks, as computed by the server). */
function computeWeeks(start, end) {
  if (!start || !end) return null;
  const days = Math.round((parseLocalDate(end) - parseLocalDate(start)) / 86400000);
  return days > 0 ? Math.floor(days / 7) : null;
}

function addMonths(iso, months) {
  const d = parseLocalDate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return target;
}

/** Client-side mirror of the server's date rules for instant feedback. */
function validateDates({ startDate, endDate, applicationDeadline }, original) {
  const today = todayIso();
  const errors = {};
  if (!startDate) errors.startDate = 'Start date is required.';
  if (!endDate) errors.endDate = 'End date is required.';
  if (!applicationDeadline) errors.applicationDeadline = 'Application deadline is required.';
  if (Object.keys(errors).length) return errors;
  if ((!original || original.startDate !== startDate) && startDate <= today) errors.startDate = 'Start date must be in the future.';
  if ((!original || original.applicationDeadline !== applicationDeadline) && applicationDeadline < today) {
    errors.applicationDeadline = 'Application deadline cannot be in the past.';
  }
  if (endDate <= startDate) {
    errors.endDate = 'End date must be after the start date.';
  } else {
    const days = Math.round((parseLocalDate(endDate) - parseLocalDate(startDate)) / 86400000);
    if (days < 28) errors.endDate = 'Internship duration must be at least 4 weeks.';
    else if (parseLocalDate(endDate) > addMonths(startDate, 6)) errors.endDate = 'Internship duration must not exceed 6 months.';
  }
  if (applicationDeadline >= startDate && !errors.applicationDeadline) {
    errors.applicationDeadline = 'Application deadline must be before the start date.';
  }
  return errors;
}

/**
 * Create / edit internship form shared by faculty and administrators. The duration is shown
 * live from the dates and is never typed by hand (the server derives it the same way).
 */
export default function InternshipForm({ initial, companies, facultyOptions, isAdmin, submitting, serverError, serverErrors = {},
  onSubmit, submitLabel }) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    description: initial?.description || '',
    domain: initial?.domain || '',
    companyId: initial?.companyId ? String(initial.companyId) : '',
    facultyId: initial?.facultyId ? String(initial.facultyId) : '',
    stipend: initial?.stipend ?? '',
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    applicationDeadline: initial?.applicationDeadline || '',
  }));
  const [errors, setErrors] = useState({});
  const weeks = useMemo(() => computeWeeks(form.startDate, form.endDate), [form.startDate, form.endDate]);
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined })); // clear the message once the user edits
  };
  const allErrors = { ...serverErrors, ...errors };

  const submit = (e) => {
    e.preventDefault();
    const found = {
      ...collectErrors({
        title: required(form.title, 'Title') || (form.title.trim().length < 3 ? 'Title must be at least 3 characters.' : null),
        description: required(form.description, 'Description')
          || (form.description.trim().length < 20 ? 'Description must be at least 20 characters.' : null),
        domain: required(form.domain, 'Domain'),
        companyId: required(form.companyId, 'Company'),
        facultyId: isAdmin && !initial ? required(form.facultyId, 'Faculty coordinator') : null,
        stipend: form.stipend === '' ? 'Stipend is required (enter 0 for unpaid).'
          : Number(form.stipend) < 0 ? 'Stipend cannot be negative.' : null,
      }),
      ...validateDates(form, initial),
    };
    setErrors(found);
    if (Object.keys(found).length) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      domain: form.domain.trim(),
      companyId: Number(form.companyId),
      facultyId: form.facultyId ? Number(form.facultyId) : null,
      stipend: Number(form.stipend),
      startDate: form.startDate,
      endDate: form.endDate,
      applicationDeadline: form.applicationDeadline,
      durationWeeks: weeks,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {serverError && <Alert tone="error">{serverError}</Alert>}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="Internship title" required error={allErrors.title} className="md:col-span-2">
          {(p) => <Input {...p} maxLength={150} placeholder="e.g. Full Stack Developer Intern" value={form.title} onChange={set('title')} />}
        </FormField>
        <FormField label="Description" required error={allErrors.description} className="md:col-span-2"
                   hint="Describe the work, required skills and what the intern will learn.">
          {(p) => (
            <>
              <Textarea {...p} rows={6} maxLength={5000} value={form.description} onChange={set('description')} />
              <CharCount value={form.description} max={5000} min={20} />
            </>
          )}
        </FormField>
        <FormField label="Domain" required error={allErrors.domain}>
          {(p) => (
            <>
              <Input {...p} list="domains" maxLength={100} placeholder="e.g. Web Development" value={form.domain} onChange={set('domain')} />
              <datalist id="domains">{DOMAIN_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist>
            </>
          )}
        </FormField>
        <FormField label="Company" required error={allErrors.companyId} hint="Only active companies are listed. Ask the admin to add a new company.">
          {(p) => (
            <Select {...p} value={form.companyId} onChange={set('companyId')}>
              <option value="">Select a company</option>
              {companies?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          )}
        </FormField>
        {isAdmin && (
          <FormField label="Faculty coordinator" required={!initial} error={allErrors.facultyId}>
            {(p) => (
              <Select {...p} value={form.facultyId} onChange={set('facultyId')}>
                <option value="">Select a faculty member</option>
                {facultyOptions?.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </Select>
            )}
          </FormField>
        )}
        <FormField label="Monthly stipend (₹)" required error={allErrors.stipend} hint="Enter 0 for an unpaid internship.">
          {(p) => <Input {...p} type="number" min="0" step="500" inputMode="numeric" value={form.stipend} onChange={set('stipend')} />}
        </FormField>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">Dates</legend>
        <p className="mb-4 text-xs text-slate-500">
          Duration must be between 4 weeks and 6 months. The application deadline must be before the start date.
        </p>
        <div className="grid gap-5 md:grid-cols-4">
          <FormField label="Application deadline" required error={allErrors.applicationDeadline}>
            {(p) => <Input {...p} type="date" value={form.applicationDeadline} onChange={set('applicationDeadline')} />}
          </FormField>
          <FormField label="Start date" required error={allErrors.startDate}>
            {(p) => <Input {...p} type="date" value={form.startDate} onChange={set('startDate')} />}
          </FormField>
          <FormField label="End date" required error={allErrors.endDate}>
            {(p) => <Input {...p} type="date" value={form.endDate} min={form.startDate || undefined} onChange={set('endDate')} />}
          </FormField>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Duration</p>
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800" aria-live="polite">
              {weeks ? `${weeks} week${weeks === 1 ? '' : 's'}` : 'Select start and end dates'}
            </p>
            {allErrors.durationWeeks && <p className="mt-1.5 text-xs font-medium text-rose-600">{allErrors.durationWeeks}</p>}
          </div>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" icon={Save} loading={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
