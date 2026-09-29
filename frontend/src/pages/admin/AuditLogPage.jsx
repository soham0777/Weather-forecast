import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { Select } from '../../components/ui/FormField';
import { useApi } from '../../hooks/useApi';
import { auditService } from '../../services/endpoints';
import { formatDateTime, titleCase } from '../../utils/format';

const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'USER_REGISTERED', 'EMAIL_VERIFIED', 'PASSWORD_CHANGED', 'USER_CREATED',
  'USER_ACTIVATED', 'USER_DEACTIVATED', 'USER_VERIFIED_BY_ADMIN', 'PROFILE_UPDATED', 'COMPANY_CREATED', 'COMPANY_UPDATED',
  'COMPANY_ARCHIVED', 'COMPANY_RESTORED', 'INTERNSHIP_CREATED', 'INTERNSHIP_UPDATED', 'INTERNSHIP_STATUS_CHANGED',
  'INTERNSHIP_DELETED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_UPDATED', 'INTERVIEW_CANCELLED', 'INTERVIEW_COMPLETED',
  'EVALUATION_SAVED', 'EVALUATION_ARCHIVED', 'APPLICATION_COMPLETED', 'SYSTEM_FEEDBACK_UPDATED', 'ACCESS_DENIED',
  'INVALID_FILE_UPLOAD', 'DUPLICATE_APPLICATION_ATTEMPT',
];
const VIOLATIONS = new Set(['LOGIN_FAILED', 'ACCESS_DENIED', 'INVALID_FILE_UPLOAD', 'DUPLICATE_APPLICATION_ATTEMPT']);

export default function AuditLogPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi(() => auditService.list({ action, page, size: 20 }), [action, page]);
  return (
    <>
      <PageHeader title="Audit log" description="Who did what and when: logins, administrative actions and rejected (policy-violating) requests." />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="w-auto" aria-label="Filter by action">
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
          </Select>
        </div>
        <DataTable loading={loading} error={error} onRetry={reload} rows={data?.content} emptyTitle="No audit entries found."
                   columns={[
                     { key: 'time', header: 'When', render: (a) => <span className="whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
                     { key: 'action', header: 'Action', render: (a) => <Badge tone={VIOLATIONS.has(a.action) ? 'red' : 'gray'}>{titleCase(a.action)}</Badge> },
                     { key: 'user', header: 'User', render: (a) => a.userEmail || <span className="text-slate-400">Anonymous</span> },
                     { key: 'entity', header: 'Record', render: (a) => (a.entityType ? `${a.entityType} #${a.entityId ?? '—'}` : '—') },
                     { key: 'details', header: 'Details', render: (a) => <span className="text-sm text-slate-600">{a.details || '—'}</span> },
                   ]} />
        <Pagination page={data} onChange={setPage} />
      </Card>
    </>
  );
}
