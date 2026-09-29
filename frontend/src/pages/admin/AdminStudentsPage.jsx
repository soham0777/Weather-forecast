import { useState } from 'react';
import { BadgeCheck, Eye, FileText, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DescriptionList from '../../components/ui/DescriptionList';
import { FormField, Input, Select } from '../../components/ui/FormField';
import { Alert, PageLoader } from '../../components/ui/States';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { getErrorMessage, getFieldErrors, openPdf } from '../../services/api';
import { studentService, userService } from '../../services/endpoints';
import { DEPARTMENT_SUGGESTIONS, PAGE_SIZE } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';
import { collectErrors, isStrongPassword, required, validateEmail, validateGpa, validatePhone } from '../../utils/validation';

function StudentFormModal({ student, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    email: student?.email || '', password: '', name: student?.name || '', phone: student?.phone || '',
    department: student?.department || '', gpa: student?.gpa ?? '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (f) => (e) => {
    setForm((v) => ({ ...v, [f]: e.target.value }));
    setErrors((errs) => ({ ...errs, [f]: undefined })); // clear the message once the user edits
  };

  const submit = async () => {
    const found = collectErrors({
      email: validateEmail(form.email), name: required(form.name, 'Full name'), phone: validatePhone(form.phone),
      department: required(form.department, 'Department'), gpa: validateGpa(form.gpa),
      password: !student && !isStrongPassword(form.password)
        ? 'Initial password must have 8+ characters with upper-case, lower-case, number and special character.' : null,
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = { ...form, email: form.email.trim(), name: form.name.trim(), gpa: Number(form.gpa), password: student ? null : form.password };
      if (student) await studentService.update(student.id, payload); else await studentService.create(payload);
      toast.success(student ? 'Student updated.' : 'Student account created. A verification link was sent.');
      onClose(true);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={student ? 'Edit student' : 'Add student'}
           footer={<><Button variant="secondary" onClick={() => onClose(false)} disabled={saving}>Cancel</Button><Button onClick={submit} loading={saving}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {serverError && <div className="sm:col-span-2"><Alert tone="error">{serverError}</Alert></div>}
        <FormField label="Full name" required error={errors.name} className="sm:col-span-2">{(p) => <Input {...p} value={form.name} onChange={set('name')} />}</FormField>
        <FormField label="E-mail" required error={errors.email} className="sm:col-span-2"
                   hint={student ? 'Changing the e-mail marks the account as unverified.' : undefined}>
          {(p) => <Input {...p} type="email" value={form.email} onChange={set('email')} />}
        </FormField>
        {!student && (
          <FormField label="Initial password" required error={errors.password} className="sm:col-span-2" hint="Share it securely; the student can change it after logging in.">
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </FormField>
        )}
        <FormField label="Phone" required error={errors.phone}>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} />}</FormField>
        <FormField label="CGPA" required error={errors.gpa}>{(p) => <Input {...p} type="number" min="0" max="10" step="0.01" value={form.gpa} onChange={set('gpa')} />}</FormField>
        <FormField label="Department" required error={errors.department} className="sm:col-span-2">
          {(p) => (<><Input {...p} list="admin-departments" value={form.department} onChange={set('department')} />
            <datalist id="admin-departments">{DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist></>)}
        </FormField>
      </div>
    </Modal>
  );
}

function StudentDetailsModal({ id, onClose }) {
  const toast = useToast();
  const { data, loading } = useApi(() => studentService.get(id), [id]);
  return (
    <Modal open onClose={onClose} title="Student record" size="lg">
      {loading || !data ? <PageLoader /> : (
        <div className="space-y-5">
          <DescriptionList items={[
            { label: 'Name', value: data.name }, { label: 'E-mail', value: data.email }, { label: 'Phone', value: data.phone },
            { label: 'Department', value: data.department }, { label: 'CGPA', value: data.gpa },
            { label: 'Account', value: <Badge tone={data.active ? 'green' : 'red'}>{data.active ? 'Active' : 'Inactive'}</Badge> },
            { label: 'E-mail verification', value: <Badge tone={data.verified ? 'green' : 'amber'}>{data.verified ? 'Verified' : 'Not verified'}</Badge> },
            { label: 'Profile completion', value: `${data.profileCompletion}%` },
            { label: 'Registered', value: formatDateTime(data.createdAt) },
            { label: 'Resume', value: data.resume.uploaded ? (
              <Button size="sm" variant="secondary" icon={FileText}
                      onClick={() => openPdf(`/students/${id}/resume`).catch((e) => toast.error(e.message))}>View {data.resume.fileName}</Button>) : 'Not uploaded' },
          ]} />
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Applications</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Object.entries(data.applicationStats).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 text-center"><p className="text-xs text-slate-500 capitalize">{k}</p><p className="text-lg font-semibold">{v}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminStudentsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(() => studentService.list({ q, active, page, size: PAGE_SIZE }), [q, active, page]);
  const [form, setForm] = useState(null); // { student } | { }
  const [viewId, setViewId] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);

  const doToggle = async () => {
    setBusy(true);
    try {
      await userService.setActive(toggle.userId, !toggle.active);
      toast.success(toggle.active ? 'Student account deactivated.' : 'Student account activated.');
      setToggle(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (s) => {
    try {
      await userService.verify(s.userId);
      toast.success('E-mail marked as verified.');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Students" description="Student records. Accounts are deactivated rather than deleted to preserve history."
                  actions={<Button icon={Plus} onClick={() => setForm({})}>Add student</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search students" className="w-full max-w-md"
                       placeholder="Search by name, e-mail or phone" />
          <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(0); }} className="w-auto" aria-label="Account status">
            <option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option>
          </Select>
        </div>
        <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No students found."
                   columns={[
                     { key: 'name', header: 'Student', render: (s) => (<div><p className="font-medium text-slate-900">{s.name}</p><p className="text-xs text-slate-500">{s.email}</p></div>) },
                     { key: 'department', header: 'Department', render: (s) => <span className="text-sm">{s.department}</span> },
                     { key: 'gpa', header: 'CGPA', className: 'tabular' },
                     { key: 'resume', header: 'Resume', render: (s) => <Badge tone={s.hasResume ? 'green' : 'amber'}>{s.hasResume ? 'Uploaded' : 'Missing'}</Badge> },
                     { key: 'status', header: 'Account', render: (s) => (
                       <div className="flex flex-col items-start gap-1">
                         <Badge tone={s.active ? 'green' : 'red'}>{s.active ? 'Active' : 'Inactive'}</Badge>
                         <Badge tone={s.verified ? 'blue' : 'amber'}>{s.verified ? 'Verified' : 'Unverified'}</Badge>
                       </div>) },
                     { key: 'actions', header: <span className="sr-only">Actions</span>, render: (s) => (
                       <div className="flex flex-wrap justify-end gap-1.5">
                         <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewId(s.id)}>View</Button>
                         <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setForm({ student: s })}>Edit</Button>
                         {!s.verified && <Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => verify(s)}>Verify</Button>}
                         <Button size="sm" variant={s.active ? 'ghost' : 'secondary'} icon={s.active ? UserX : UserCheck} onClick={() => setToggle(s)}>
                           {s.active ? 'Deactivate' : 'Activate'}
                         </Button>
                       </div>) },
                   ]} />
        <Pagination page={data} onChange={setPage} />
      </Card>
      {form && <StudentFormModal student={form.student} onClose={(saved) => { setForm(null); if (saved) reload(); }} />}
      {viewId && <StudentDetailsModal id={viewId} onClose={() => setViewId(null)} />}
      <ConfirmDialog open={Boolean(toggle)} loading={busy} tone={toggle?.active ? 'danger' : 'primary'}
                     title={toggle?.active ? 'Deactivate student' : 'Activate student'} confirmLabel={toggle?.active ? 'Deactivate' : 'Activate'}
                     message={toggle?.active
                       ? `Are you sure you want to deactivate ${toggle?.name}? They will be signed out and cannot log in or apply. Their records are kept.`
                       : `Re-activate ${toggle?.name}'s account?`}
                     onCancel={() => setToggle(null)} onConfirm={doToggle} />
    </>
  );
}
