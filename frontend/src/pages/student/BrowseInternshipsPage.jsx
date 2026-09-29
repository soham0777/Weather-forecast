import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import Pagination from '../../components/ui/Pagination';
import { Select } from '../../components/ui/FormField';
import { CardsSkeleton, EmptyState, ErrorState } from '../../components/ui/States';
import InternshipCard from '../../components/domain/InternshipCard';
import InternshipFilters from '../../components/domain/InternshipFilters';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { internshipService } from '../../services/endpoints';

const EMPTY = { domain: '', companyId: '', location: '', minStipend: '', maxStipend: '' };
const SORTS = [
  { value: 'deadline,asc', label: 'Deadline (soonest first)' },
  { value: 'stipend,desc', label: 'Stipend (highest first)' },
  { value: 'startDate,asc', label: 'Start date (earliest first)' },
  { value: 'createdAt,desc', label: 'Newest first' },
];

export default function BrowseInternshipsPage() {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('deadline,asc');
  const [page, setPage] = useState(0);
  const [filterError, setFilterError] = useState(null);
  const q = useDebounce(search);
  const options = useApi(() => internshipService.filters(), []);
  const { data, loading, error, reload } = useApi(
    () => internshipService.list({ ...filters, q, sort, page, size: 9 }), [filters, q, sort, page]);

  const apply = () => {
    if (draft.minStipend && draft.maxStipend && Number(draft.minStipend) > Number(draft.maxStipend)) {
      setFilterError('Minimum stipend cannot be more than the maximum.');
      return;
    }
    setFilterError(null);
    setFilters(draft);
    setPage(0);
  };
  const clear = () => { setDraft(EMPTY); setFilters(EMPTY); setSearch(''); setFilterError(null); setPage(0); };

  return (
    <>
      <PageHeader title="Internships" description="Approved internships from partner companies. Open internships accept applications until the deadline." />
      <InternshipFilters options={options.data} draft={draft} setDraft={setDraft} onApply={apply} onClear={clear}
                         search={search} onSearch={(v) => { setSearch(v); setPage(0); }} error={filterError} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600" aria-live="polite">
          {data ? `${data.totalElements} internship${data.totalElements === 1 ? '' : 's'} found` : ' '}
        </p>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-slate-600">
          Sort by
          <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} className="w-auto">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </label>
      </div>
      {error && <div className="card"><ErrorState message={error} onRetry={reload} /></div>}
      {loading && !data && <CardsSkeleton count={6} />}
      {data && data.content.length === 0 && (
        <div className="card"><EmptyState title="No internships are currently available."
          message={q || Object.values(filters).some(Boolean) ? 'Try different search words or clear the filters.' : 'Please check back later.'} /></div>
      )}
      {data && data.content.length > 0 && (
        <>
          <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {data.content.map((i) => <InternshipCard key={i.id} internship={i} to={`/student/internships/${i.id}`} />)}
          </div>
          <div className="card mt-6"><Pagination page={data} onChange={setPage} /></div>
        </>
      )}
    </>
  );
}
