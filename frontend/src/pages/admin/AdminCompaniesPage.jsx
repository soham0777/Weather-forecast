import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
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
import { companyService } from '../../services/endpoints';
import { PAGE_SIZE } from '../../utils/constants';
import { collectErrors, REGISTRATION_REGEX, required, validateEmail, validatePhone } from '../../utils/validation';

function CompanyFormModal({ company, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: company?.name || '', registrationNumber: company?.registrationNumber || '', location: company?.location || '',
    contactPerson: company?.contactPerson || '', contactEmail: company?.contactEmail || '', contactPhone: company?.contactPhone || '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (f) => (e) => {
    setForm((v) => ({ ...v, [f]: e.target.value }));
    setErrors((errs) => ({ ...errs, [f]: undefined })); // clear the message once the user edits
  };

  const submit = async () => {
    const reg = form.registrationNumber.trim().toUpperCase();
    const found = collectErrors({
      name: required(form.name, 'Company name'),
      registrationNumber: required(reg, 'Registration number')
        || (!REGISTRATION_REGEX.test(reg) ? 'Use a 21-character CIN (e.g. U72200MH2009PTC123456) or an LLPIN (e.g. AAB-1234).' : null),
      location: required(form.location, 'Location'), contactPerson: required(form.contactPerson, 'Contact person'),
      contactEmail: validateEmail(form.contactEmail), contactPhone: validatePhone(form.contactPhone),
    });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setServerError(null);
    try {
      const payload = { ...form, registrationNumber: reg, name: form.name.trim(), location: form.location.trim() };
      if (company) await companyService.update(company.id, payload); else await companyService.create(payload);
      toast.success(company ? 'Company updated.' : 'Company added.');
      onClose(true);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={company ? 'Edit company' : 'Add company'} size="lg"
           footer={<><Button variant="secondary" onClick={() => onClose(false)} disabled={saving}>Cancel</Button><Button onClick={submit} loading={saving}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {serverError && <div className="sm:col-span-2"><Alert tone="error">{serverError}</Alert></div>}
        <FormField label="Company name" required error={errors.name} className="sm:col-span-2">{(p) => <Input {...p} maxLength={150} value={form.name} onChange={set('name')} />}</FormField>
        <FormField label="Registration number (CIN / LLPIN)" required error={errors.registrationNumber} hint="Must be unique. e.g. U72200MH2009PTC123456 or AAB-1234">
          {(p) => <Input {...p} className="uppercase" maxLength={21} value={form.registrationNumber} onChange={set('registrationNumber')} />}
        </FormField>
        <FormField label="Location" required error={errors.location}>{(p) => <Input {...p} placeholder="City" value={form.location} onChange={set('location')} />}</FormField>
        <FormField label="Contact person" required error={errors.contactPerson}>{(p) => <Input {...p} value={form.contactPerson} onChange={set('contactPerson')} />}</FormField>
        <FormField label="Contact phone" required error={errors.contactPhone}>{(p) => <Input {...p} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</FormField>
        <FormField label="Contact e-mail" required error={errors.contactEmail} className="sm:col-span-2">{(p) => <Input {...p} type="email" value={form.contactEmail} onChange={set('contactEmail')} />}</FormField>
      </div>
    </Modal>
  );
}

export default function AdminCompaniesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(() => companyService.list({ q, status, page, size: PAGE_SIZE }), [q, status, page]);
  const [form, setForm] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const archive = async () => {
    setBusy(true);
    try {
      const result = await companyService.remove(archiveTarget.id);
      toast.success(result.message);
      setArchiveTarget(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const restore = async (c) => {
    try { await companyService.restore(c.id); toast.success('Company restored.'); reload(); } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <>
      <PageHeader title="Companies" description="Partner companies. Companies with internship history are archived instead of deleted."
                  actions={<Button icon={Plus} onClick={() => setForm({})}>Add company</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search companies" className="w-full max-w-md"
                       placeholder="Search by name, registration number or contact" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="w-auto" aria-label="Company status">
            <option value="">All companies</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option>
          </Select>
        </div>
        <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No companies found."
                   emptyAction={<Button icon={Plus} onClick={() => setForm({})}>Add company</Button>}
                   columns={[
                     { key: 'name', header: 'Company', render: (c) => (<div><Link to={`/admin/companies/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">{c.name}</Link><p className="text-xs text-slate-500 tabular">{c.registrationNumber}</p></div>) },
                     { key: 'location', header: 'Location' },
                     { key: 'contact', header: 'Contact', render: (c) => (<div className="text-sm"><p>{c.contactPerson}</p><p className="text-xs text-slate-500">{c.contactEmail} · {c.contactPhone}</p></div>) },
                     { key: 'internships', header: 'Internships', className: 'text-center tabular', render: (c) => c.internshipCount },
                     { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
                     { key: 'actions', header: <span className="sr-only">Actions</span>, render: (c) => (
                       <div className="flex flex-wrap justify-end gap-1.5">
                         <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setForm({ company: c })}>Edit</Button>
                         {c.status === 'ACTIVE'
                           ? <Button size="sm" variant="ghost" icon={Archive} onClick={() => setArchiveTarget(c)}>{c.internshipCount ? 'Archive' : 'Delete'}</Button>
                           : <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => restore(c)}>Restore</Button>}
                       </div>) },
                   ]} />
        <Pagination page={data} onChange={setPage} />
      </Card>
      {form && <CompanyFormModal company={form.company} onClose={(saved) => { setForm(null); if (saved) reload(); }} />}
      <ConfirmDialog open={Boolean(archiveTarget)} loading={busy} title={archiveTarget?.internshipCount ? 'Archive company' : 'Delete company'}
                     confirmLabel={archiveTarget?.internshipCount ? 'Archive' : 'Delete'}
                     message={archiveTarget?.internshipCount
                       ? `Are you sure you want to archive ${archiveTarget?.name}? Its internship history is kept, but it cannot be used for new internships.`
                       : `${archiveTarget?.name} has no internships and will be permanently deleted.`}
                     onCancel={() => setArchiveTarget(null)} onConfirm={archive} />
    </>
  );
}
