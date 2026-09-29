import { SlidersHorizontal } from 'lucide-react';
import Button from '../ui/Button';
import { FormField, Input, Select } from '../ui/FormField';
import SearchInput from '../ui/SearchInput';

/**
 * Search + filter bar: Domain, Company, Location, Minimum/Maximum stipend.
 * Filters are applied with the button; the search box applies as you type.
 */
export default function InternshipFilters({ options, draft, setDraft, onApply, onClear, search, onSearch, error }) {
  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));
  return (
    <div className="card mb-6 p-4 sm:p-5">
      <SearchInput value={search} onChange={onSearch} label="Search internships"
                   placeholder="Search by internship title, company, domain or location" />
      <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); onApply(); }} noValidate>
        <FormField label="Domain">
          {(p) => (
            <Select {...p} value={draft.domain} onChange={set('domain')}>
              <option value="">All domains</option>
              {options?.domains?.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="Company">
          {(p) => (
            <Select {...p} value={draft.companyId} onChange={set('companyId')}>
              <option value="">All companies</option>
              {options?.companies?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="Location">
          {(p) => (
            <Select {...p} value={draft.location} onChange={set('location')}>
              <option value="">All locations</option>
              {options?.locations?.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="Minimum stipend (₹)" error={error}>
          {(p) => <Input {...p} type="number" min="0" step="500" placeholder="0" value={draft.minStipend} onChange={set('minStipend')} />}
        </FormField>
        <FormField label="Maximum stipend (₹)">
          {(p) => <Input {...p} type="number" min="0" step="500" placeholder="Any" value={draft.maxStipend} onChange={set('maxStipend')} />}
        </FormField>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" icon={SlidersHorizontal}>Apply filters</Button>
          <Button variant="secondary" onClick={onClear}>Clear filters</Button>
        </div>
      </form>
    </div>
  );
}
