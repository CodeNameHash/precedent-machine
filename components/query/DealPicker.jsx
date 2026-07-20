import { useMemo, useState } from 'react';

export function dealPickerLabel(deal) {
  const metadata = deal?.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const buyer = deal?.buyer_display || metadata.acquirer_display || deal?.acquirer || 'Buyer';
  const target = deal?.target_display || metadata.target_display || metadata.target_entity || deal?.target || 'Target';
  return `${buyer} / ${target}`;
}

export default function DealPicker({ deals, value, onChange, label = 'Deal' }) {
  const [search, setSearch] = useState('');
  const loading = deals === null;
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (deals || []).slice()
      .sort((a, b) => dealPickerLabel(a).localeCompare(dealPickerLabel(b)))
      .filter((deal) => !query || dealPickerLabel(deal).toLowerCase().includes(query));
  }, [deals, search]);
  const selected = (deals || []).find((deal) => String(deal.id) === String(value));
  return (
    <div className="dealPicker">
      <span className="dealPickerLabel">{label}</span>
      <input className="mtx-input" value={search} disabled={loading} placeholder={loading ? 'Loading deals…' : 'Type a buyer or target…'} onChange={(event) => setSearch(event.target.value)} />
      {selected && <div className="selectedDeal">Selected: <b>{dealPickerLabel(selected)}</b></div>}
      <div className="dealOptions" role="listbox" aria-label={label}>
        {!loading && rows.length === 0 && <span>No deals match.</span>}
        {rows.slice(0, 12).map((deal) => (
          <button key={deal.id} type="button" className={String(deal.id) === String(value) ? 'selected' : ''} onClick={() => onChange(deal.id)}>
            {dealPickerLabel(deal)}
          </button>
        ))}
      </div>
      <style jsx>{`
        .dealPicker { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .dealPickerLabel { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-faint, #9A9A9A); }
        .selectedDeal { font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .dealOptions { max-height: 150px; overflow: auto; border: 1px solid var(--line, #E0E0E0); background: #fff; }
        .dealOptions > span { display: block; padding: 9px; font-size: 11px; color: var(--ink-light, #6B6B6B); }
        .dealOptions button { display: block; width: 100%; border: 0; border-bottom: 1px solid var(--line-soft, #EEEEEE); background: #fff; padding: 7px 9px; text-align: left; font: 11px var(--mtx-sans); cursor: pointer; }
        .dealOptions button:hover, .dealOptions button.selected { background: var(--paper-2, #F6F6F6); font-weight: 650; }
      `}</style>
    </div>
  );
}
