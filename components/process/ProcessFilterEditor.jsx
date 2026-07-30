import { useMemo, useState } from 'react';

function optionValue(option) {
  return option?.value ?? option;
}

function fieldIdentity(field) {
  const reference = field?.field_reference;
  return reference ? `${reference.field_key}:${reference.field_version}` : '';
}

function optionIdentity(option) {
  return JSON.stringify(optionValue(option));
}

export function admittedOptionsForField({ active, activeSegments, admittedOptionsProjection }) {
  const others = activeSegments
    .filter((segment) => (
      segment.field_reference?.field_key !== active?.field_reference?.field_key
      || segment.field_reference?.field_version !== active?.field_reference?.field_version
    ))
    .map((segment) => `${segment.field_reference?.field_key}:${segment.field_reference?.field_version}:${JSON.stringify(segment.value)}`)
    .sort();
  const projection = admittedOptionsProjection.find((candidate) => (
    candidate.field_reference?.field_key === active?.field_reference?.field_key
    && candidate.field_reference?.field_version === active?.field_reference?.field_version
    && JSON.stringify([...candidate.other_active_filter_segment_keys].sort()) === JSON.stringify(others)
  ));
  return projection?.value_options || [];
}

export function isAdmittedFilterValue({ active, activeSegments, admittedOptionsProjection, value }) {
  return admittedOptionsForField({
    active,
    activeSegments,
    admittedOptionsProjection,
  }).some((option) => optionIdentity(option) === JSON.stringify(value));
}

export default function ProcessFilterEditor({ fields = [], selected = [], activeSegments = [], admittedOptionsProjection = [], onApply, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedFieldIdentity, setSelectedFieldIdentity] = useState(
    selected[0]?.field_reference
      ? `${selected[0].field_reference.field_key}:${selected[0].field_reference.field_version}`
      : '',
  );
  const [value, setValue] = useState(selected[0]?.value ?? '');
  const matches = useMemo(() => fields.filter((field) => field.label?.toLowerCase().includes(search.toLowerCase())), [fields, search]);
  const active = fields.find((field) => fieldIdentity(field) === selectedFieldIdentity);
  const options = admittedOptionsForField({ active, activeSegments, admittedOptionsProjection });
  const valueIsAdmitted = isAdmittedFilterValue({
    active,
    activeSegments,
    admittedOptionsProjection,
    value,
  });
  return (
    <section className="rounded border border-border bg-white p-4" aria-label="More filters">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-ink">More filters</h2><button type="button" onClick={onClose} aria-label="Close more filters" className="text-sm text-inkLight">Close</button></div>
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-search">Search catalogue fields</label>
      <input id="process-filter-search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm" placeholder="Search fields" />
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-field">Catalogue field</label>
      <select id="process-filter-field" value={selectedFieldIdentity} onChange={(event) => { setSelectedFieldIdentity(event.target.value); setValue(''); }} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm">
        <option value="">Select a field</option>{matches.map((field) => <option key={fieldIdentity(field)} value={fieldIdentity(field)}>{field.label}</option>)}
      </select>
      <label className="mt-3 block text-xs font-medium text-inkLight" htmlFor="process-filter-value">Value</label>
      <select id="process-filter-value" value={value === '' ? '' : JSON.stringify(value)} disabled={!active || options.length === 0} onChange={(event) => { const selectedOption = options.find((option) => optionIdentity(option) === event.target.value); setValue(selectedOption ? optionValue(selectedOption) : ''); }} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm disabled:opacity-50"><option value="">{active && options.length === 0 ? 'No admitted values' : 'Select a value'}</option>{options.map((option) => <option key={optionIdentity(option)} value={optionIdentity(option)}>{option.label ?? optionValue(option)}</option>)}</select>
      <button type="button" disabled={!valueIsAdmitted} onClick={() => valueIsAdmitted && onApply?.({ field_reference: active.field_reference, field_label: active.label, value })} className="mt-3 rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Apply filter</button>
    </section>
  );
}
