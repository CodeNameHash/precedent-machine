// Natural-language filter controls shared by every place on the query
// surface that lets someone build a provision-level filter row: the full
// "Build a query" section (pages/query/index.js) and the compact
// QueryLaunchBox embedded on the deals index. Pulled out of
// pages/query/index.js so QueryLaunchBox doesn't have to import a page
// module to reuse the same dropdowns.
//
// Ben's query-surface UX pass (2026-07-19):
//   1. The "value" control offers REAL options derived from the field
//      selected on the left — fetched from /api/query/field-options (backed
//      by lib/query/field-meta.js: taxonomy dicts for coded fields, observed
//      corpus values for plain enums). No more free-text field/value boxes
//      for coded data.
//   2. No coder-speak: booleans render as a single has/does-not-have choice
//      (no operator dropdown, no Yes/No), coded fields render "is"/"is not"
//      + a real value picker, numerics render a quantifier
//      (at least/at most/exactly/between) + a unit-hinted number input.
// The underlying filter payload shape (provision_type/field/op/value) is
// UNCHANGED — see lib/query/filter-labels.js's header for how the op
// vocabulary here maps 1:1 onto lib/query/executors/filter-then-list.js's
// testOp(), including 'between' (already engine-supported, just newly
// exposed in the UI).

import { useEffect, useState } from 'react';
import { getDisplayAdvisors } from '../../lib/canonical-advisors';
import { considerationTypeDisplay } from '../../lib/deals-index-columns';
import {
  OPERATOR_LABELS, NUMERIC_TYPES, humanizeKey, provisionTypeLabel, lowerFirst, sentenceForFilter,
} from '../../lib/query/filter-labels';

// Kept in sync with lib/query/types.js PROVISION_CARD_TYPES — duplicated
// here (not imported) so client bundles that only need the dropdown list
// don't pull in rubric.js/expected-sets.js, which are Node-oriented.
export const PROVISION_TYPES = [
  'CONSIDERATION', 'REPRESENTATION', 'MATERIAL_CONTRACT', 'CLOSING_CONDITION',
  'COVENANT_INTERIM_OPERATING', 'COVENANT_NO_SOLICITATION', 'COVENANT_OTHER',
  'TERMINATION_RIGHT', 'TERMINATION_FEE', 'DEFINITION', 'ANTITRUST_REGULATORY',
  'SEC_FILING_MEETING', 'EMPLOYEE_BENEFITS', 'STRUCTURE_MECHANICS', 'MAE',
  'NO_OTHER_REPS', 'MISC_BOILERPLATE',
];

export const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'];

export function OpSelect({ value, onChange, className = 'mtx-select' }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {OPS.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
    </select>
  );
}

export function ProvisionTypeSelect({ value, onChange, className = 'mtx-select', types = PROVISION_TYPES }) {
  return (
    <select className={className} value={value} title={provisionTypeLabel(value)} onChange={(e) => onChange(e.target.value)}>
      {types.map((t) => <option key={t} value={t}>{provisionTypeLabel(t)}</option>)}
    </select>
  );
}

// Boolean-aware value input: a bare true/false renders as a Yes/No select
// (matches formatValue() on the result page); anything else stays a
// free-text value input. Kept for the one remaining non-filter caller
// (MARKET_RANGE's field-path input never runs through this) and for
// backward compatibility — filter ROWS now use FilterRow below instead.
export function FilterValueInput({ value, onChange, placeholder = 'value' }) {
  const isBool = value === 'true' || value === 'false' || value === true || value === false;
  if (isBool) {
    const boolVal = value === true || value === 'true' ? 'true' : 'false';
    return (
      <select className="mtx-select" value={boolVal} onChange={(e) => onChange(e.target.value)}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return <input className="mtx-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

// ── Dependent field/value options (item 1) ─────────────────────────────────
// Module-scope caches so every FilterRow on the page shares one in-flight
// fetch per (provision_type) / (provision_type, field) pair instead of each
// row re-fetching the same options independently.
const fieldsCache = new Map(); // provisionType -> Promise<fieldMeta[]>
const valueCache = new Map(); // `${provisionType}::${field}` -> Promise<{type,unit,label,options}>

function fetchFields(provisionType) {
  if (!provisionType) return Promise.resolve([]);
  if (!fieldsCache.has(provisionType)) {
    fieldsCache.set(provisionType, fetch(`/api/query/field-options?provision_type=${encodeURIComponent(provisionType)}`)
      .then((r) => r.json())
      .then((json) => json.fields || [])
      .catch(() => []));
  }
  return fieldsCache.get(provisionType);
}

function fetchValueOptions(provisionType, field) {
  if (!provisionType || !field) return Promise.resolve(null);
  const key = `${provisionType}::${field}`;
  if (!valueCache.has(key)) {
    valueCache.set(key, fetch(`/api/query/field-options?provision_type=${encodeURIComponent(provisionType)}&field=${encodeURIComponent(field)}`)
      .then((r) => r.json())
      .catch(() => ({ type: 'string', unit: null, label: humanizeKey(field), options: [] })));
  }
  return valueCache.get(key);
}

// The list of real, selectable fields for a provision_type — powers the
// FilterRow field dropdown below. Exposed separately in case a caller wants
// the raw list (e.g. to render a summary) without the full row UI.
export function useFieldsForProvisionType(provisionType) {
  const [fields, setFields] = useState([]);
  useEffect(() => {
    let alive = true;
    setFields([]);
    fetchFields(provisionType).then((f) => { if (alive) setFields(f); });
    return () => { alive = false; };
  }, [provisionType]);
  return fields;
}

function useFieldMeta(provisionType, field) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    let alive = true;
    setMeta(null);
    fetchValueOptions(provisionType, field).then((m) => { if (alive) setMeta(m); });
    return () => { alive = false; };
  }, [provisionType, field]);
  return meta;
}

// Coerces a builder row's UI-friendly value (real boolean, or a [lo,hi]
// array for a 'between' quantifier) into the exact primitive shape the
// engine expects. Numeric-looking strings still coerce to Number as before
// — this only ADDS a boolean short-circuit so a real `true`/`false` (which
// FilterRow now sets directly) doesn't fall through to `Number(true) === 1`.
export function coerceFilterForPayload(f) {
  // SHOW_ALL (Ben r15, item 7): the agreed payload shape with the engine is
  // { provision_type, field, mode: 'all' } — no op/value. The executor lists
  // every deal and annotates has/hasn't + value instead of gating.
  if (f.mode === 'all') {
    return { provision_type: f.provision_type, field: f.field, mode: 'all' };
  }
  const { mode, ...rest } = f;
  if (rest.op === 'between' && Array.isArray(rest.value)) {
    return { ...rest, value: rest.value.map((v) => (v === '' || v === null || v === undefined ? null : Number(v))) };
  }
  if (typeof rest.value === 'boolean') return { ...rest };
  if (rest.value === 'true') return { ...rest, value: true };
  if (rest.value === 'false') return { ...rest, value: false };
  const numeric = Number(rest.value);
  return { ...rest, value: (rest.value === '' || Number.isNaN(numeric)) ? rest.value : numeric };
}

// Three states (Ben r15, item 7): Has / Doesn't have / Show all. "Show all"
// isn't a gate — it lists every deal annotated with whether it has the term
// (payload: { provision_type, field, mode: 'all' }).
function BooleanControl({ filter, onChange, fieldLabel }) {
  const showAll = filter.mode === 'all';
  const truthy = filter.value === true || filter.value === 'true';
  const label = lowerFirst(fieldLabel || humanizeKey(filter.field));
  return (
    <div className="boolToggle">
      <button type="button" className={`boolBtn${!showAll && truthy ? ' boolBtnOn' : ''}`} onClick={() => onChange({ mode: undefined, op: 'eq', value: true })}>Has {label}</button>
      <button type="button" className={`boolBtn${!showAll && !truthy ? ' boolBtnOn' : ''}`} onClick={() => onChange({ mode: undefined, op: 'eq', value: false })}>Doesn&rsquo;t have {label}</button>
      <button type="button" className={`boolBtn${showAll ? ' boolBtnOn' : ''}`} title="List every deal and show whether each one has it" onClick={() => onChange({ mode: 'all', op: null, value: '' })}>Show all</button>
      <style jsx>{`
        .boolToggle { display: flex; gap: 6px; flex-wrap: wrap; }
        .boolBtn { border: 1px solid var(--line, #E0E0E0); background: #fff; color: var(--ink, #1F1F1F); font-family: var(--mtx-sans); font-size: 12px; font-weight: 600; padding: 6px 10px; cursor: pointer; }
        .boolBtn:hover { background: var(--paper-2, #F6F6F6); }
        .boolBtnOn { background: var(--ink, #1F1F1F); color: #fff; border-color: var(--ink, #1F1F1F); }
      `}</style>
    </div>
  );
}

const NUMERIC_QUANTIFIERS = ['at least', 'at most', 'exactly', 'between'];
const QUANTIFIER_TO_OP = { 'at least': 'gte', 'at most': 'lte', exactly: 'eq', between: 'between' };

function quantifierForOp(op) {
  if (op === 'lte') return 'at most';
  if (op === 'eq') return 'exactly';
  if (op === 'between') return 'between';
  return 'at least';
}

function NumericControl({ filter, onChange, unit }) {
  const quantifier = quantifierForOp(filter.op);
  const setQuantifier = (q) => {
    const op = QUANTIFIER_TO_OP[q];
    if (op === 'between') {
      const lo = Array.isArray(filter.value) ? filter.value[0] : filter.value;
      onChange({ op, value: [lo ?? '', ''] });
    } else {
      const val = Array.isArray(filter.value) ? filter.value[0] : filter.value;
      onChange({ op, value: val ?? '' });
    }
  };
  const unitPrefix = unit === '$' ? '$' : null;
  const unitSuffix = unit && unit !== '$' ? unit : null;
  const [lo, hi] = filter.op === 'between'
    ? (Array.isArray(filter.value) ? filter.value : ['', ''])
    : [filter.value ?? '', null];

  return (
    <div className="numRow">
      <select className="mtx-select" value={quantifier} onChange={(e) => setQuantifier(e.target.value)}>
        {NUMERIC_QUANTIFIERS.map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
      {unitPrefix && <span className="numUnit">{unitPrefix}</span>}
      <input
        className="mtx-input numInput"
        type="number"
        value={lo === null || lo === undefined ? '' : lo}
        onChange={(e) => (filter.op === 'between' ? onChange({ value: [e.target.value, hi] }) : onChange({ value: e.target.value }))}
      />
      {unitSuffix && <span className="numUnit">{unitSuffix}</span>}
      {filter.op === 'between' && (
        <>
          <span className="numAnd">and</span>
          {unitPrefix && <span className="numUnit">{unitPrefix}</span>}
          <input className="mtx-input numInput" type="number" value={hi === null || hi === undefined ? '' : hi} onChange={(e) => onChange({ value: [lo, e.target.value] })} />
          {unitSuffix && <span className="numUnit">{unitSuffix}</span>}
        </>
      )}
      <style jsx>{`
        .numRow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .numInput { width: 110px; }
        .numUnit { font-size: 12px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
        .numAnd { font-size: 12px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

// `loading` (item 1, r13): the field's TYPE is known synchronously from the
// already-fetched field list (fieldsForProvisionType's `coded: true`), so the
// dropdown SHELL — the is/is not selector and a disabled value select —
// renders on first paint. Only the option VALUES (corpus-observed codes,
// counts) depend on the async /api/query/field-options?field= fetch, so
// while that's in flight the value select shows a single disabled "Loading
// options…" placeholder instead of sitting empty or flashing a free-text box.
function CodedControl({
  filter, onChange, options, loading = false,
}) {
  const showAll = filter.mode === 'all';
  const negated = filter.op === 'neq';
  const modeValue = showAll ? 'show all' : negated ? 'is not' : 'is';
  const setMode = (v) => {
    if (v === 'show all') { onChange({ mode: 'all', op: null, value: '' }); return; }
    onChange({ mode: undefined, op: v === 'is not' ? 'neq' : 'eq', value: filter.mode === 'all' ? (options[0] ? options[0].code : '') : filter.value });
  };
  return (
    <div className="codedRow">
      <select className="mtx-select" value={modeValue} onChange={(e) => setMode(e.target.value)}>
        <option value="is">is</option>
        <option value="is not">is not</option>
        <option value="show all">show all</option>
      </select>
      {showAll ? (
        <span className="codedAllHint">every deal, annotated</span>
      ) : loading ? (
        <select className="mtx-select" value="" disabled>
          <option value="">Loading options…</option>
        </select>
      ) : (
        <select
          className="mtx-select"
          value={filter.value === null || filter.value === undefined ? '' : String(filter.value)}
          title={(options.find((o) => String(o.code) === String(filter.value)) || {}).label}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          {options.map((o) => <option key={o.code} value={o.code} title={o.description || undefined}>{o.label}</option>)}
        </select>
      )}
      <style jsx>{`
        .codedRow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; min-width: 0; max-width: 100%; }
        .codedRow :global(select.mtx-select) { max-width: 100%; min-width: 0; text-overflow: ellipsis; }
        .codedAllHint { font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

function FreeTextControl({ filter, onChange }) {
  return <input className="mtx-input" value={filter.value === null || filter.value === undefined ? '' : filter.value} onChange={(e) => onChange({ op: 'contains', value: e.target.value })} placeholder="value" />;
}

// One full filter row: provision type -> field (real options for that
// provision type) -> a value control shaped for the field's TYPE
// (boolean/numeric/coded/free-text), plus a live natural-language preview.
// This is the single implementation both pages/query/index.js's
// FilterListBuilder and components/query/QueryLaunchBox.jsx render, so the
// two builders can't drift on phrasing or available options.
export function FilterRow({ filter, onChange, onRemove, provisionTypes = PROVISION_TYPES, showPreview = true }) {
  const fields = useFieldsForProvisionType(filter.provision_type);
  const fieldMeta = useFieldMeta(filter.provision_type, filter.field);
  // Item 1 (Ben r13): the field's TYPE (boolean/numeric/coded) is knowable
  // the instant a field is selected — the field list fetched above already
  // carries type/unit/coded/boolean/numeric per field (lib/query/field-meta.js
  // fieldsForProvisionType). Seed `meta` from THAT entry first so the correct
  // control shape renders on first paint; the async per-field fetch
  // (fieldMeta, /api/query/field-options?field=) only ever fills in the
  // option VALUES (corpus-observed codes/counts) for coded fields once it
  // resolves — it never changes which control shape is shown.
  const fieldEntry = fields.find((f) => f.key === filter.field) || null;
  const meta = fieldMeta || (fieldEntry
    ? {
      type: fieldEntry.type, unit: fieldEntry.unit, options: [], label: fieldEntry.label,
    }
    : { type: null, unit: null, options: [], label: humanizeKey(filter.field) });
  // Coded fields render their dropdown SHELL immediately (from fieldEntry
  // above) but need the async fetch to fill in real option values — while
  // that's in flight, show a loading placeholder instead of an empty select
  // or a free-text fallback.
  const loadingCodedOptions = !fieldMeta && !!(fieldEntry && fieldEntry.coded);

  // Once this provision_type's field list resolves, default an empty (or no
  // longer valid, e.g. after switching provision type) field selection to
  // the first real field rather than leaving the dropdown on a blank value.
  useEffect(() => {
    if (fields.length && (!filter.field || !fields.some((f) => f.key === filter.field))) {
      onChange({ field: fields[0].key, op: null, value: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // Once the selected field's metadata resolves, normalize op/value into a
  // shape that control renders correctly and that a fresh row can run
  // immediately without extra clicks (mirrors the old FilterValueInput's
  // "boolean defaults to a valid Yes/No" behavior, extended to coded/numeric).
  useEffect(() => {
    if (!fieldMeta) return;
    if (filter.mode === 'all') return; // SHOW_ALL needs no op/value normalization
    if (fieldMeta.type === 'boolean') {
      if (filter.value !== true && filter.value !== false) onChange({ op: 'eq', value: true });
    } else if (NUMERIC_TYPES.has(fieldMeta.type)) {
      if (!['gte', 'lte', 'eq', 'between'].includes(filter.op)) onChange({ op: 'gte', value: typeof filter.value === 'boolean' ? '' : (filter.value ?? '') });
    } else if (fieldMeta.options && fieldMeta.options.length) {
      const codes = fieldMeta.options.map((o) => o.code);
      if (!codes.includes(String(filter.value))) onChange({ op: filter.op === 'neq' ? 'neq' : 'eq', value: fieldMeta.options[0].code });
    } else if (filter.op !== 'contains') {
      onChange({ op: 'contains', value: typeof filter.value === 'boolean' ? '' : (filter.value ?? '') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldMeta && fieldMeta.type, fieldMeta && fieldMeta.options && fieldMeta.options.length]);

  return (
    <div className="filterRow">
      <div className="filterControls">
        <ProvisionTypeSelect
          value={filter.provision_type}
          onChange={(pt) => onChange({ provision_type: pt, field: '', op: null, value: '' })}
          types={provisionTypes}
        />
        <select
          className="mtx-select"
          value={filter.field || ''}
          disabled={!fields.length}
          title={(fields.find((f) => f.key === filter.field) || {}).label}
          onChange={(e) => onChange({ field: e.target.value, op: null, value: '' })}
        >
          {!fields.length && <option value="">Loading fields…</option>}
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {meta.type === 'boolean' ? (
          <BooleanControl filter={filter} onChange={onChange} fieldLabel={meta.label} />
        ) : meta.type && NUMERIC_TYPES.has(meta.type) ? (
          <NumericControl filter={filter} onChange={onChange} unit={meta.unit} />
        ) : loadingCodedOptions ? (
          <CodedControl filter={filter} onChange={onChange} options={[]} loading />
        ) : meta.options && meta.options.length ? (
          <CodedControl filter={filter} onChange={onChange} options={meta.options} />
        ) : (
          <FreeTextControl filter={filter} onChange={onChange} />
        )}
        {onRemove && <button type="button" className="mtx-btn" onClick={onRemove}>Remove</button>}
      </div>
      {showPreview && <p className="filterPreview">{sentenceForFilter(filter, meta)}</p>}
      <style jsx>{`
        .filterRow { display: flex; flex-direction: column; gap: 6px; min-width: 0; max-width: 100%; }
        .filterControls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; max-width: 100%; }
        /* Mobile (Ben r15 addendum): closed controls never overflow their
           container — long option labels truncate cleanly inside the select
           (full text via the title attribute; the native popup is fine). */
        .filterControls :global(select.mtx-select), .filterControls :global(input.mtx-input) { max-width: 100%; min-width: 0; text-overflow: ellipsis; }
        .filterPreview { margin: 0; font-size: 11px; color: var(--ink-light, #6B6B6B); font-family: var(--mtx-sans); }
      `}</style>
    </div>
  );
}

// Query kinds as TABS (Ben r7), not a dropdown — one click to flick between
// query types. Styled on the .mtx tokens the review page uses. Shared by
// the full builder and the index QueryLaunchBox.
export function KindTabs({ kinds, labels, value, onChange }) {
  return (
    <div className="qkTabs" role="tablist">
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={k === value}
          className={`qkTab${k === value ? ' qkTabOn' : ''}`}
          onClick={() => onChange(k)}
        >
          {labels[k] || humanizeKey(k)}
        </button>
      ))}
      <style jsx>{`
        .qkTabs { display: flex; flex-wrap: wrap; border: 1px solid #E0E0E0; background: #FFFFFF; }
        .qkTab { padding: 7px 14px; font-size: 12px; color: #6B6B6B; background: transparent; border: 0; border-right: 1px solid #E0E0E0; cursor: pointer; font-family: var(--mtx-sans); }
        .qkTab:hover { color: #1F1F1F; background: #F6F6F6; }
        .qkTabOn { color: #1F1F1F; font-weight: 600; box-shadow: inset 0 -2px 0 #1F1F1F; background: #FFFFFF; }
      `}</style>
    </div>
  );
}

// ── Deal filters (Ben r8) ────────────────────────────────────────────────
// "Don't say type of deal — say deal filters" with real dropdowns:
// Consideration type / Buyer / Law firm always visible, plus a dashed "+"
// that reveals more facets (Sector, Signing year). Values feed the query
// engine's deal_filter (lib/query/executors/shared.js comparisonDeals),
// which resolves buyer against acquirer/display names and law firms via
// the canonical advisor forms — the same strings shown here.

// Works over BOTH deal payload shapes: /api/home rows (buyer_display,
// consideration_type, advisors.{buyer_firms,seller_firms}, signing_date)
// and /api/deals rows (acquirer, metadata.*, announce_date).
export function dealFilterOptions(deals) {
  const considerations = new Set();
  const buyers = new Set();
  const lawFirms = new Set();
  const lawyers = new Set();
  const mergerForms = new Set();
  const sectors = new Set();
  const years = new Set();
  for (const deal of deals || []) {
    const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    const cons = deal.consideration_type || meta.headlineConsiderationType || meta.considerationType || null;
    if (cons) considerations.add(cons);
    const buyer = deal.buyer_display || meta.acquirer_display || deal.acquirer || null;
    if (buyer) buyers.add(buyer);
    if (deal.advisors && typeof deal.advisors === 'object') {
      for (const f of [...(deal.advisors.buyer_firms || []), ...(deal.advisors.seller_firms || [])]) lawFirms.add(f);
      for (const lawyer of [...(deal.advisors.buyer_lawyers || []), ...(deal.advisors.seller_lawyers || [])]) lawyers.add(lawyer);
    } else if (meta.advisors_v2) {
      const adv = getDisplayAdvisors(meta);
      for (const f of [...(adv.buyerFirms || []), ...(adv.sellerFirms || [])]) lawFirms.add(f);
      for (const lawyer of [...(adv.buyerLawyers || []), ...(adv.sellerLawyers || [])]) lawyers.add(lawyer);
    }
    const mergerForm = deal.merger_form || meta.merger_form;
    if (mergerForm) mergerForms.add(mergerForm);
    if (deal.sector) sectors.add(deal.sector);
    const date = deal.signing_date || deal.announce_date;
    if (date) years.add(Number(String(date).slice(0, 4)));
  }
  const sorted = (set) => [...set].filter(Boolean).sort();
  return {
    consideration_type: sorted(considerations),
    buyer: sorted(buyers),
    law_firm: sorted(lawFirms),
    lawyer: sorted(lawyers),
    merger_form: sorted(mergerForms),
    sector: sorted(sectors),
    signing_year: [...years].filter(Boolean).sort((a, b) => b - a),
  };
}

const DEAL_FACETS = [
  { key: 'consideration_type', label: 'Consideration type', display: (v) => considerationTypeDisplay(v) || humanizeKey(v) },
  { key: 'buyer', label: 'Buyer', display: (v) => v },
  { key: 'law_firm', label: 'Law firm', display: (v) => v },
  { key: 'lawyer', label: 'Lawyer', display: (v) => v },
  { key: 'merger_form', label: 'Merger form', display: (v) => humanizeKey(v) },
  { key: 'sector', label: 'Sector', display: (v) => v },
  { key: 'signing_year', label: 'Signing year', display: (v) => String(v) },
];
const BASE_FACETS = ['consideration_type', 'buyer', 'law_firm'];

export function buildDealFilterPayload(values) {
  const out = {};
  const search = String(values.search || '').trim();
  if (search) out.search = search;
  for (const facet of DEAL_FACETS) {
    const v = values[facet.key];
    if (v === '' || v === null || v === undefined) continue;
    out[facet.key] = [facet.key === 'signing_year' ? Number(v) : v];
  }
  return out;
}

export function dealMatchesDealFilter(deal, filter = {}) {
  const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const consideration = deal.consideration_type || meta.headlineConsiderationType || meta.considerationType || null;
  const buyer = deal.buyer_display || meta.acquirer_display || deal.acquirer || null;
  const date = deal.signing_date || deal.announce_date || null;
  const year = date ? Number(String(date).slice(0, 4)) : null;
  const advisors = deal.advisors && typeof deal.advisors === 'object'
    ? [...(deal.advisors.buyer_firms || []), ...(deal.advisors.seller_firms || [])]
    : (() => {
      const resolved = getDisplayAdvisors(meta);
      return [...(resolved.buyerFirms || []), ...(resolved.sellerFirms || [])];
    })();
  const lawyers = deal.advisors && typeof deal.advisors === 'object'
    ? [...(deal.advisors.buyer_lawyers || []), ...(deal.advisors.seller_lawyers || [])]
    : (() => {
      const resolved = getDisplayAdvisors(meta);
      return [...(resolved.buyerLawyers || []), ...(resolved.sellerLawyers || [])];
    })();
  const mergerForm = deal.merger_form || meta.merger_form || null;
  const search = String(Array.isArray(filter.search) ? filter.search[0] : (filter.search || '')).trim().toLowerCase();
  if (search) {
    const dealName = deal.deal_name || `${buyer || deal.acquirer || 'Buyer'} / ${deal.target_display || meta.target_display || deal.target || 'Target'}`;
    if (![dealName, buyer, deal.target_display, meta.target_display, deal.target, deal.sector].filter(Boolean).join(' ').toLowerCase().includes(search)) return false;
  }
  if (filter.consideration_type?.length && !filter.consideration_type.includes(consideration)) return false;
  if (filter.buyer?.length && !filter.buyer.includes(buyer)) return false;
  if (filter.law_firm?.length && !filter.law_firm.some((firm) => advisors.includes(firm))) return false;
  if (filter.lawyer?.length && !filter.lawyer.some((lawyer) => lawyers.includes(lawyer))) return false;
  if (filter.merger_form?.length && !filter.merger_form.includes(mergerForm)) return false;
  if (filter.sector?.length && !filter.sector.includes(deal.sector)) return false;
  if (filter.signing_year?.length && !filter.signing_year.includes(year)) return false;
  return true;
}

export function describeDealFilters(values) {
  const parts = [];
  if (String(values.search || '').trim()) parts.push(`search contains “${String(values.search).trim()}”`);
  for (const facet of DEAL_FACETS) {
    const v = values[facet.key];
    if (v === '' || v === null || v === undefined) continue;
    parts.push(`${facet.label.toLowerCase()} is ${facet.display(v)}`);
  }
  return parts;
}

// Ben's info-hierarchy note ("why is the text on deal filters so big —
// think about hierarchy"): this block sits below the query-type tabs and
// must read as visually SECONDARY to them — smaller labels, compact
// selects (overriding the global 13px/36px .mtx-select via :global()), and
// a quieter section label than the tabs' bold uppercase treatment.
export function DealFiltersBlock({
  deals, values, onChange, facetKeys = null, showSearch = false, expandAll = false,
}) {
  const options = dealFilterOptions(deals);
  const [extraFacets, setExtraFacets] = useState([]);
  const eligible = facetKeys ? DEAL_FACETS.filter((facet) => facetKeys.includes(facet.key)) : DEAL_FACETS;
  const visible = eligible.filter((f) => expandAll || facetKeys || BASE_FACETS.includes(f.key) || extraFacets.includes(f.key) || values[f.key]);
  const hidden = eligible.filter((f) => !visible.includes(f));
  return (
    <div className="dfb">
      <span className="dfbSectionLabel">Deal filters <em className="dfbOptional">· optional — narrow which deals count</em></span>
      <div className="dfbRow">
        {showSearch && (
          <label className="dfbFacet dfbSearch">
            <span className="dfbLabel">Search</span>
            <input className="mtx-input" value={values.search || ''} placeholder="Buyer, target or deal" onChange={(e) => onChange({ ...values, search: e.target.value })} />
          </label>
        )}
        {visible.map((facet) => (
          <label key={facet.key} className="dfbFacet">
            <span className="dfbLabel">{facet.label}</span>
            <select
              className="mtx-select"
              value={values[facet.key] ?? ''}
              onChange={(e) => onChange({ ...values, [facet.key]: e.target.value })}
            >
              <option value="">Any</option>
              {(options[facet.key] || []).map((v) => (
                <option key={v} value={v}>{facet.display(v)}</option>
              ))}
            </select>
          </label>
        ))}
        {hidden.length > 0 && (
          <button
            type="button"
            className="dfbAdd"
            title={`Add a filter: ${hidden.map((f) => f.label).join(', ')}`}
            onClick={() => setExtraFacets([...extraFacets, hidden[0].key])}
          >
            +
          </button>
        )}
      </div>
      <style jsx>{`
        .dfb { display: flex; flex-direction: column; gap: 4px; }
        .dfbSectionLabel { font-family: var(--mtx-sans); font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px; color: #9A9A9A; }
        .dfbOptional { font-style: normal; font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 10px; color: #9A9A9A; }
        .dfbRow { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; min-width: 0; max-width: 100%; }
        .dfbFacet { display: flex; flex-direction: column; gap: 2px; min-width: 0; max-width: 100%; }
        .dfbFacet :global(select.mtx-select) { max-width: 100%; text-overflow: ellipsis; }
        .dfbSearch { min-width: 180px; }
        .dfbLabel { font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; color: #9A9A9A; font-family: var(--mtx-sans); }
        .dfbAdd { width: 26px; height: 24px; border: 1px dashed #E0E0E0; background: #fff; color: #6B6B6B; font-size: 13px; line-height: 1; cursor: pointer; font-family: var(--mtx-sans); }
        .dfbAdd:hover { color: #1F1F1F; border-color: #6B6B6B; background: #F6F6F6; }
        /* Compact selects — this block is secondary to the query-type tabs
           above it, so it must not compete on size. */
        .dfbRow :global(select.mtx-select) { font-size: 11px; height: 24px; padding: 0 6px; min-width: 0; }
        .dfbRow :global(input.mtx-input) { font-size: 11px; height: 24px; min-height: 24px; padding: 0 6px; min-width: 0; }
      `}</style>
    </div>
  );
}
