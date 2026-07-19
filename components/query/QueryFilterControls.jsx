// Natural-language filter controls shared by every place on the query
// surface that lets someone build a provision-level filter row: the full
// "Build a query" section (pages/query/index.js) and the compact
// QueryLaunchBox embedded on the deals index. Pulled out of
// pages/query/index.js so QueryLaunchBox doesn't have to import a page
// module to reuse the same dropdowns.
//
// Presentation only — see lib/query/filter-labels.js for the natural-
// language mapping. The underlying filter payload shape (provision_type/
// field/op/value) is unchanged; these just render nicer controls over it.

import { OPERATOR_LABELS, humanizeKey } from '../../lib/query/filter-labels';
import { FIELD_OPTIONS_BY_PROVISION_TYPE, fieldOption } from '../../lib/query/field-options';

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

// Operators that make sense for a field's registry value type — a boolean
// never needs "more than", prose never needs "at least" (Ben r7: less
// coder-like; only offer what reads sensibly).
const NUMERIC_TYPES = new Set(['number', 'duration', 'percentage', 'currency']);
export function opsForFieldType(type) {
  if (type === 'boolean' || type === 'enum' || type === 'tagged') return ['eq', 'neq'];
  if (NUMERIC_TYPES.has(type)) return ['eq', 'gte', 'lte', 'gt', 'lt'];
  return ['contains', 'eq', 'neq'];
}

export function OpSelect({ value, onChange, className = 'mtx-select', ops = OPS }) {
  const list = ops.includes(value) || !value ? ops : [value, ...ops];
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
    </select>
  );
}

// Query kinds as TABS (Ben r7), not a dropdown — one click to flick between
// query types. Styled on the .mtx tokens the review page uses.
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

// Dependent field dropdown (Ben r6): offers the fields that actually exist
// for the selected provision type — from the generated client-safe map —
// instead of a free-text "field path" input. A value not in the list (hand-
// built payload, older saved query) gets its own "custom" option so nothing
// breaks; a type with no mapped fields falls back to the free-text input.
export function FieldSelect({ provisionType, value, onChange, className = 'mtx-select' }) {
  const options = FIELD_OPTIONS_BY_PROVISION_TYPE[provisionType] || [];
  if (!options.length) {
    return <input className="mtx-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="field" />;
  }
  const known = options.some((o) => o.key === value);
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && value ? <option value={value}>{humanizeKey(value)}</option> : null}
      {!value ? <option value="">Choose a field…</option> : null}
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}

export function ProvisionTypeSelect({ value, onChange, className = 'mtx-select', types = PROVISION_TYPES }) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {types.map((t) => <option key={t} value={t}>{humanizeKey(t)}</option>)}
    </select>
  );
}

// Boolean-aware value input: a bare true/false renders as a Yes/No select
// (matches formatValue()'s Yes/No on the result page and describeFilter()'s
// value label); anything else stays a free-text value input, since filter
// values can be numbers or strings too.
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

// Registry-type-aware value control (Ben r7: "any cell with pilled answers
// should populate the filter options"): booleans are Yes/No, enum/tagged
// fields offer their registry option slugs as a humanized dropdown, numeric
// types get a number input, prose stays free text. Falls back to
// FilterValueInput when the field isn't in the generated map.
export function ValueControl({ provisionType, fieldKey, value, onChange, className = 'mtx-select' }) {
  const def = fieldOption(provisionType, fieldKey);
  if (!def) return <FilterValueInput value={value} onChange={onChange} />;
  if (def.type === 'boolean') {
    const boolVal = value === true || value === 'true' ? 'true' : 'false';
    return (
      <select className={className} value={boolVal} onChange={(e) => onChange(e.target.value)}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (Array.isArray(def.options) && def.options.length) {
    const known = def.options.includes(value);
    return (
      <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && value ? <option value={value}>{humanizeKey(String(value))}</option> : null}
        {!value ? <option value="">Choose…</option> : null}
        {def.options.map((o) => <option key={o} value={o}>{humanizeKey(o)}</option>)}
      </select>
    );
  }
  if (NUMERIC_TYPES.has(def.type)) {
    return <input className="mtx-input" type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={def.type === 'percentage' ? '%' : 'number'} />;
  }
  return <input className="mtx-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="contains text…" />;
}

// Sensible default value + operator when a field is picked, so a fresh
// filter block reads as a complete sentence immediately.
export function defaultsForField(provisionType, fieldKey) {
  const def = fieldOption(provisionType, fieldKey);
  if (!def) return { op: 'eq', value: '' };
  if (def.type === 'boolean') return { op: 'eq', value: 'true' };
  if (Array.isArray(def.options) && def.options.length) return { op: 'eq', value: def.options[0] };
  if (NUMERIC_TYPES.has(def.type)) return { op: 'gte', value: '' };
  return { op: 'contains', value: '' };
}
