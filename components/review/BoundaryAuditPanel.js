import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { typeHex, typeLabel } from './shared';

function num(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString();
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : '-';
}

function flagClass(severity) {
  if (severity === 'error') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (severity === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-border bg-bg text-inkMid';
}

function rowClass(item) {
  if (item.kind === 'gap' && item.reviewable_gap) return 'border-rose-200 bg-rose-50/50';
  if (item.kind === 'gap') return 'border-border bg-bg/50 opacity-75';
  return 'border-border bg-white';
}

function typeChip(type) {
  const label = typeLabel(type || '') || type || 'TYPE';
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-ui font-medium text-white"
      style={{ background: typeHex(type || 'OTHER') }}
    >
      {label}
    </span>
  );
}

function FlagList({ flags }) {
  if (!Array.isArray(flags) || flags.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {flags.map((flag, idx) => (
        <span key={`${flag.code || 'flag'}-${idx}`} className={`rounded border px-1.5 py-0.5 text-[10px] font-ui ${flagClass(flag.severity)}`}>
          {flag.label || flag.code}
        </span>
      ))}
    </div>
  );
}

function fullTextForItem(item) {
  return item.full_text || item.text || item.preview || 'No text.';
}

function issueRank(item) {
  if (!Array.isArray(item && item.flags)) return 0;
  if (item.flags.some((flag) => flag && flag.severity === 'error')) return 2;
  if (item.flags.some((flag) => flag && flag.severity === 'warn')) return 1;
  return 0;
}

function sourceStart(item) {
  const n = Number(item && item.start);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function BoundaryRow({ item, onEditProvision, dealId }) {
  const isProvision = item.kind === 'provision';
  const isGap = item.kind === 'gap';
  return (
    <div className={`rounded border p-3 ${rowClass(item)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-inkFaint">{item.id}</span>
          {isProvision && typeChip(item.type)}
          {isGap && (
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-ui font-medium ${item.reviewable_gap ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-border bg-white text-inkMid'}`}>
              {item.reviewable_gap ? 'Gap' : 'Ignored'}
            </span>
          )}
          <span className="min-w-0 truncate font-ui text-xs font-medium text-ink">
            {isProvision ? (item.category || item.code || 'Provision') : (item.rough_heading || item.region_type || 'Uncovered text')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-ui text-[10px] text-inkFaint">
          <span>{num(item.start)}-{num(item.end)}</span>
          <span>{num(item.length)} chars</span>
          {isProvision && item.provision_id && onEditProvision && (
            <button
              type="button"
              onClick={() => onEditProvision(item.provision_id)}
              className="rounded border border-border bg-white px-2 py-1 text-[10px] text-inkMid hover:border-accent hover:text-accent"
            >
              Edit
            </button>
          )}
          {isGap && dealId && (
            <Link
              href={{ pathname: '/admin/gaps', query: { deal_id: dealId, gap: item.id } }}
              className="rounded border border-border bg-white px-2 py-1 text-[10px] text-inkMid hover:border-accent hover:text-accent"
            >
              Read
            </Link>
          )}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-inkMid">
        {fullTextForItem(item)}
      </p>
      {isGap && item.suggested_reason && (
        <p className="mt-2 font-ui text-[10px] text-inkFaint">{item.suggested_reason}</p>
      )}
      <FlagList flags={item.flags} />
    </div>
  );
}

function UnlocatedRow({ item, onEditProvision }) {
  return (
    <div className="rounded border border-rose-200 bg-rose-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-inkFaint">{item.id}</span>
          {typeChip(item.type)}
          <span className="min-w-0 truncate font-ui text-xs font-medium text-ink">{item.category || item.code || 'Unlocated provision'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-ui text-[10px] text-inkFaint">
          <span>{shortId(item.provision_id)}</span>
          <span>{num(item.length)} chars</span>
          {item.provision_id && onEditProvision && (
            <button
              type="button"
              onClick={() => onEditProvision(item.provision_id)}
              className="rounded border border-border bg-white px-2 py-1 text-[10px] text-inkMid hover:border-accent hover:text-accent"
            >
              Edit
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap font-serif text-[12px] leading-relaxed text-inkMid">{fullTextForItem(item)}</p>
      <FlagList flags={item.flags} />
    </div>
  );
}

export function BoundaryAuditPanel({ open, dealId, editing = false, onClose, onEditProvision }) {
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const [sortMode, setSortMode] = useState('source');

  useEffect(() => {
    if (!open || !dealId) return undefined;
    const ac = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetch(`/api/admin/gaps?deal_id=${encodeURIComponent(dealId)}`, { signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setState({ loading: false, error: null, data });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ loading: false, error: err.message, data: null });
      });
    return () => ac.abort();
  }, [open, dealId]);

  const audit = state.data && state.data.boundary_audit;
  const items = Array.isArray(audit && audit.items) ? audit.items : [];
  const unlocated = Array.isArray(audit && audit.unlocated) ? audit.unlocated : [];
  const summary = audit && audit.summary ? audit.summary : {};
  const sortedItems = useMemo(() => {
    if (sortMode !== 'issues') return items;
    return [...items].sort((a, b) => {
      const rank = issueRank(b) - issueRank(a);
      if (rank !== 0) return rank;
      return sourceStart(a) - sourceStart(b);
    });
  }, [items, sortMode]);
  const handleEditProvision = (provisionId) => {
    if (onEditProvision) onEditProvision(provisionId);
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-y-0 left-0 z-[72] flex ${editing ? 'right-0 md:right-[400px]' : 'right-0 justify-end'}`}>
      {!editing && <button type="button" aria-label="Close boundary audit" className="absolute inset-0 bg-black/30" onClick={onClose} />}
      <aside className={`relative z-[73] flex h-full w-full flex-col bg-bg shadow-2xl ${editing ? 'border-r border-line md:shadow-xl' : 'max-w-[1040px] border-l border-line'}`} role="dialog" aria-modal="true" aria-label="Boundary audit">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="font-ui text-[10px] uppercase tracking-wider text-inkFaint">Boundary audit</p>
            <p className="truncate font-display text-sm text-ink">{shortId(dealId)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-white px-3 py-1.5 text-xs font-ui font-medium text-ink hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {state.loading && <div className="rounded border border-border bg-white p-4 font-ui text-sm text-inkMid">Loading...</div>}
          {state.error && <div className="rounded border border-rose-200 bg-rose-50 p-4 font-ui text-sm text-rose-700">{state.error}</div>}

          {!state.loading && !state.error && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  ['Located', summary.provisions_located],
                  ['Unlocated', summary.provisions_unlocated],
                  ['Gaps', summary.gaps],
                  ['Reviewable', summary.reviewable_gaps],
                  ['Flagged', summary.flagged_items],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-border bg-white px-3 py-2">
                    <div className="font-ui text-[10px] uppercase tracking-wider text-inkFaint">{label}</div>
                    <div className="font-display text-lg text-ink">{num(value)}</div>
                  </div>
                ))}
              </div>

              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-ui text-[11px] font-semibold uppercase tracking-wider text-inkMid">
                    {sortMode === 'issues' ? 'Issues first' : 'Source order'}
                  </h3>
                  <div className="inline-flex rounded border border-border bg-white p-0.5 font-ui text-[10px]">
                    {[
                      ['source', 'Source order'],
                      ['issues', 'Issues first'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSortMode(mode)}
                        className={`rounded px-2 py-1 ${sortMode === mode ? 'bg-accent text-white' : 'text-inkMid hover:text-accent'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {sortedItems.map((item) => (
                  <BoundaryRow key={`${item.kind}-${item.id}-${item.start || item.provision_id}`} item={item} onEditProvision={handleEditProvision} dealId={dealId} />
                ))}
                {sortedItems.length === 0 && <div className="rounded border border-border bg-white p-4 font-ui text-sm text-inkFaint">No boundary audit data.</div>}
              </section>

              {unlocated.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-ui text-[11px] font-semibold uppercase tracking-wider text-rose-700">Unlocated provisions</h3>
                  {unlocated.map((item) => (
                    <UnlocatedRow key={item.id} item={item} onEditProvision={handleEditProvision} />
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
