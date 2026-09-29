import { useState } from 'react';
import { BadgeCheck, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { FormField, Input, Select } from '../../components/ui/FormField';
import { Alert } from '../../components/ui/States';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { getErrorMessage, getFieldErrors } from '../../services/api';
import { facultyService, userService } from '../../services/endpoints';
import { DEPARTMENT_SUGGESTIONS, PAGE_SIZE } from '../../utils/constants';
import { collectErrors, isStrongPassword, required, validateEmail, validatePhone } from '../../utils/validation';

function FacultyFormModal({ faculty, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    email: faculty?.email || '', password: '', name: faculty?.name || '', department: faculty?.department || '',
    designation: faculty?.designation || '', phone: faculty?.phone || '',
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
      email: validateEmail(form.email), name: required(form.name, 'Name'), department: required(form.department, 'Department'),
      designation: required(form.designation, 'Designation'), phone: validatePhone(form.phone),
      password: !faculty && !isStrongPassword(form.password)
        ? 'Initial password must have 8+ characters with upper-case, lower-case, number and special character.' : null,
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = { ...form, email: form.email.trim(), password: faculty ? null : form.password };
      if (faculty) await facultyService.update(faculty.id, payload); else await facultyService.create(payload);
      toast.success(faculty ? 'Faculty updated.' : 'Faculty account created. A verification link was sent.');
      onClose(true);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={faculty ? 'Edit faculty member' : 'Add faculty member'}
           footer={<><Button variant="secondary" onClick={() => onClose(false)} disabled={saving}>Cancel</Button><Button onClick={submit} loading={saving}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {serverError && <div className="sm:col-span-2"><Alert tone="error">{serverError}</Alert></div>}
        <FormField label="Full name" required error={errors.name} className="sm:col-span-2">{(p) => <Input {...p} placeholder="e.g. Dr. Priya Sharma" value={form.name} onChange={set('name')} />}</FormField>
        <FormField label="E-mail" required error={errors.email} className="sm:col-span-2">{(p) => <Input {...p} type="email" value={form.email} onChange={set('email')} />}</FormField>
        {!faculty && (
          <FormField label="Initial password" required error={errors.password} className="sm:col-span-2">
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </FormField>
        )}
        <FormField label="Department" required error={errors.department}>
          {(p) => (<><Input {...p} list="fac-admin-departments" value={form.department} onChange={set('department')} />
            <datalist id="fac-admin-departments">{DEPARTMENT_SUGGESTIONS.map((d) => <option key={d} value={d} />)}</datalist></>)}
        </FormField>
        <FormField label="Designation" required error={errors.designation}>{(p) => <Input {...p} placeholder="e.g. Assistant Professor" value={form.designation} onChange={set('designation')} />}</FormField>
        <FormField label="Phone" required error={errors.phone}>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} />}</FormField>
      </div>
    </Modal>
  );
}

export default function AdminFacultyPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(() => facultyService.list({ q, active, page, size: PAGE_SIZE }), [q, active, page]);
  const [form, setForm] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [busy, setBusy] = useState(false);

  const doToggle = async () => {
    setBusy(true);
    try {
      await userService.setActive(toggle.userId, !toggle.active);
      toast.success(toggle.active ? 'Faculty account deactivated.' : 'Faculty account activated.');
      setToggle(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (f) => {
    try { await userService.verify(f.userId); toast.success('E-mail marked as verified.'); reload(); } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <>
      <PageHeader title="Faculty" description="Faculty coordinators who post internships and review applications."
                  actions={<Button icon={Plus} onClick={() => setForm({})}>Add faculty</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search faculty" className="w-full max-w-md"
                       placeholder="Search by name, e-mail or designation" />
          <Select value={active} onChange={(e) => { setActive(e.target.value); setPage(0); }} className="w-auto" aria-label="Account status">
            <option value="">All accounts</option><option value="true">Active</option><option value="false">Inactive</option>
          </Select>
        </div>
        <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No faculty members found."
                   columns={[
                     { key: 'name', header: 'Name', render: (f) => (<div><p className="font-medium text-slate-900">{f.name}</p><p className="text-xs text-slate-500">{f.email}</p></div>) },
                     { key: 'department', header: 'Department' },
                     { key: 'designation', header: 'Designation' },
                     { key: 'internships', header: 'Internships', className: 'text-center tabular', render: (f) => f.internshipCount },
                     { key: 'status', header: 'Account', render: (f) => (
                       <div className="flex flex-col items-start gap-1">
                         <Badge tone={f.active ? 'green' : 'red'}>{f.active ? 'Active' : 'Inactive'}</Badge>
                         <Badge tone={f.verified ? 'blue' : 'amber'}>{f.verified ? 'Verified' : 'Unverified'}</Badge>
                       </div>) },
                     { key: 'actions', header: <span className="sr-only">Actions</span>, render: (f) => (
                       <div className="flex flex-wrap justify-end gap-1.5">
                         <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setForm({ faculty: f })}>Edit</Button>
                         {!f.verified && <Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => verify(f)}>Verify</Button>}
                         <Button size="sm" variant={f.active ? 'ghost' : 'secondary'} icon={f.active ? UserX : UserCheck} onClick={() => setToggle(f)}>
                           {f.active ? 'Deactivate' : 'Activate'}
                         </Button>
                       </div>) },
                   ]} />
        <Pagination page={data} onChange={setPage} />
      </Card>
      {form && <FacultyFormModal faculty={form.faculty} onClose={(saved) => { setForm(null); if (saved) reload(); }} />}
      <ConfirmDialog open={Boolean(toggle)} loading={busy} tone={toggle?.active ? 'danger' : 'primary'}
                     title={toggle?.active ? 'Deactivate faculty member' : 'Activate faculty member'}
                     confirmLabel={toggle?.active ? 'Deactivate' : 'Activate'}
                     message={toggle?.active ? `Deactivate ${toggle?.name}? They will not be able to log in. Their internships and records are kept.` : `Re-activate ${toggle?.name}'s account?`}
                     onCancel={() => setToggle(null)} onConfirm={doToggle} />
    </>
  );
}
