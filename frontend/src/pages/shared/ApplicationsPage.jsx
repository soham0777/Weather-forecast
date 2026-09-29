import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchInput from '../../components/ui/SearchInput';
import Tabs from '../../components/ui/Tabs';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useRoleBase } from '../../hooks/useRoleBase';
import { applicationService } from '../../services/endpoints';
import { PAGE_SIZE, STATUS_META } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/format';

const TABS = ['', 'PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']
  .map((id) => ({ id, label: id ? STATUS_META[id].label : 'All' }));

/** Students: my applications. Faculty: applications to my internships. Admin: all applications. */
export default function ApplicationsPage() {
  const { user } = useAuth();
  const base = useRoleBase();
  const isStudent = user.role === 'STUDENT';
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useApi(
    () => applicationService.list({ status, q, page, size: PAGE_SIZE }), [status, q, page]);

  const columns = [
    !isStudent && { key: 'student', header: 'Student', render: (a) => (
      <div className="min-w-[160px]">
        <p className="font-medium text-slate-900">{a.student.name}</p>
        <p className="text-xs text-slate-500">{a.student.email}</p>
        <p className="text-xs text-slate-500">{a.student.department} · CGPA {a.student.gpa}</p>
      </div>) },
    { key: 'internship', header: 'Internship', render: (a) => (
      <div className="min-w-[180px]">
        <p className="font-medium text-slate-900">{a.internship.title}</p>
        <p className="text-xs text-slate-500">{a.internship.companyName} · {a.internship.location}</p>
      </div>) },
    { key: 'appliedAt', header: 'Applied on', render: (a) => <span className="whitespace-nowrap">{formatDateTime(a.appliedAt)}</span> },
    isStudent && { key: 'deadline', header: 'Starts', render: (a) => <span className="whitespace-nowrap">{formatDate(a.internship.startDate)}</span> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => (
      <Link to={`${base}/applications/${a.id}`} className="whitespace-nowrap text-sm font-medium text-brand-700 hover:underline">
        {isStudent ? 'Track' : 'Review'}
      </Link>) },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={isStudent ? 'My applications' : 'Applications'}
                  description={isStudent ? 'Track the status of every internship you applied for.'
                    : user.role === 'FACULTY' ? 'Applications for internships you coordinate.' : 'Monitor all applications across the college.'}
                  actions={isStudent && <Button icon={Search} to="/student/internships">Browse internships</Button>} />
      <Tabs tabs={TABS} active={status} onChange={(s) => { setStatus(s); setPage(0); }} label="Application status" />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} label="Search applications" className="max-w-md"
                       placeholder={isStudent ? 'Search by internship or company' : 'Search by student, e-mail, internship or company'} />
        </div>
        <DataTable columns={columns} rows={data?.content} loading={loading} error={error} onRetry={reload}
                   emptyTitle="No applications found."
                   emptyMessage={isStudent && !status && !q ? 'You have not applied for any internship yet.' : undefined}
                   emptyAction={isStudent && !status && !q && <Button to="/student/internships">Find an internship</Button>} />
        <Pagination page={data} onChange={setPage} />
      </Card>
    </>
  );
}
