import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import Button from '../ui/Button';
import { Badge, StatusBadge } from '../ui/Badge';
import DataTable from '../ui/DataTable';
import Modal from '../ui/Modal';
import Pagination from '../ui/Pagination';
import { FormField, Select, Textarea } from '../ui/FormField';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { getErrorMessage } from '../../services/api';
import { feedbackService } from '../../services/endpoints';
import { PAGE_SIZE, ROLE_LABEL, STATUS_META, SYSTEM_FEEDBACK_STATUSES, SYSTEM_FEEDBACK_TYPES } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

/** System feedback table. With `manage`, admins can filter and update status / response. */
export default function SystemFeedbackList({ manage = false, refreshKey = 0 }) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const { data, loading, error, reload } = useApi(
    () => feedbackService.systemList({ page, size: PAGE_SIZE, status, type }), [page, status, type, refreshKey]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await feedbackService.systemStatus(editing.id, { status: editing.status, adminResponse: editing.adminResponse?.trim() || null });
      toast.success('Feedback updated.');
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {manage && (
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <FormField label="Status">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                <option value="">All statuses</option>
                {SYSTEM_FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Type">
            {(p) => (
              <Select {...p} value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
                <option value="">All types</option>
                {Object.entries(SYSTEM_FEEDBACK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </FormField>
        </div>
      )}
      <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No feedback submitted yet."
                 columns={[
                   { key: 'title', header: 'Feedback', render: (f) => (
                     <div className="min-w-[220px]">
                       <p className="font-medium text-slate-900">{f.title}</p>
                       <p className="mt-0.5 text-xs text-slate-500 line-clamp-3">{f.description}</p>
                     </div>) },
                   { key: 'type', header: 'Type', render: (f) => <Badge tone="violet">{SYSTEM_FEEDBACK_TYPES[f.feedbackType]}</Badge> },
                   manage && { key: 'by', header: 'Submitted by', render: (f) => (
                     <div><p className="text-sm">{f.submittedByEmail}</p><p className="text-xs text-slate-500">{ROLE_LABEL[f.submittedByRole]}</p></div>) },
                   { key: 'created', header: 'Submitted', render: (f) => <span className="whitespace-nowrap">{formatDateTime(f.createdAt)}</span> },
                   { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
                   { key: 'response', header: 'Admin response', render: (f) => <span className="text-sm text-slate-600">{f.adminResponse || '—'}</span> },
                   manage && { key: 'actions', header: <span className="sr-only">Actions</span>, render: (f) => (
                     <Button size="sm" variant="secondary" icon={Settings2}
                             onClick={() => setEditing({ id: f.id, title: f.title, status: f.status, adminResponse: f.adminResponse || '' })}>Update</Button>) },
                 ].filter(Boolean)} />
      <Pagination page={data} onChange={setPage} />
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Update feedback" description={editing?.title}
             footer={(<><Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
               <Button onClick={save} loading={saving}>Save</Button></>)}>
        {editing && (
          <div className="space-y-4">
            <FormField label="Status" required>
              {(p) => (
                <Select {...p} value={editing.status} onChange={(e) => setEditing((v) => ({ ...v, status: e.target.value }))}>
                  {SYSTEM_FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Response to the user" hint="Shown to the person who submitted the feedback.">
              {(p) => <Textarea {...p} rows={4} maxLength={2000} value={editing.adminResponse}
                                onChange={(e) => setEditing((v) => ({ ...v, adminResponse: e.target.value }))} />}
            </FormField>
          </div>
        )}
      </Modal>
    </>
  );
}
