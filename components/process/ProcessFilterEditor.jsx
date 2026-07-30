import { useMemo, useState } from 'react';

export default function ProcessFilterEditor({ fields = [], selected = [], onApply, onClose }) {
  const [search, setSearch] = useState('');
  const [fieldKey, setFieldKey] = useState(selected[0]?.field_reference?.field_key || '');
  const [value, setValue] = useState(selected[0]?.value ?? '');
  const matches = useMemo(() => fields.filter((field) => field.label?.toLowerCase().includes(search.toLowerCase())), [fields, search]);
  const active = matches.find((field) => field.field_key === fieldKey) || fields.find((field) => field.field_key === fieldKey);
  const options = active?.value_options || active?.options || [];
  return (
    <section className="rounded border border-border bg-white p-4" aria-label="More filters">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-ink">More filters</h2><button type="button" onClick={onClose} aria-label="Close more filters" className="text-sm text-inkLight">Close</button></div>
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-search">Search catalogue fields</label>
      <input id="process-filter-search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" placeholder="Search fields" />
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-field">Catalogue field</label>
      <select id="process-filter-field" value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm">
        <option value="">Select a field</option>{matches.map((field) => <option key={`${field.field_key}:${field.field_version}`} value={field.field_key}>{field.label}</option>)}
      </select>
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-value">Value</label>
      {options.length ? <select id="process-filter-value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"><option value="">Select a value</option>{options.map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select> : <input id="process-filter-value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" />}
      <button type="button" disabled={!active} onClick={() => active && onApply?.({ field_reference: { field_key: active.field_key, field_version: active.field_version }, field_label: active.label, value })} className="mt-3 rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Apply filter</button>
    </section>
  );
}
