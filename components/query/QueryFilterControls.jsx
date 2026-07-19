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
import { FIELD_OPTIONS_BY_PROVISION_TYPE } from '../../lib/query/field-options';

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
