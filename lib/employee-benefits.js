// ───────────────────────────────────────────────────────────────────────────
// lib/employee-benefits.js — pure derivation logic for the "Employee
// Benefits" synthetic review section (FB3 missed item 1).
//
// DELIBERATELY JSX-FREE and dependency-free: `npm test` runs under
// `node --test` with no build step, so this module is directly importable by
// tests via dynamic import (same pattern as lib/sec-meeting.js / lib/abry.js).
// components/review/EmployeeBenefitsTable.js imports these helpers and wires
// them into JSX — registered the same way SecMeetingTable is (see
// components/review/shared.js SIDEBAR_GROUPS + pages/review/[id].js sentinel
// synthesis + render branch), placed BEFORE "Other Covenants".
//
// SOURCE: COV-EMPLOYEE provisions (lib/rubric.js). The DB `type` column is
// generic 'COV' — the specific code lives in ai_metadata.code (or the raw
// pipeline `code` field pre-storage) — see isEmployeeBenefitsProvision.
//
// OWNER'S CRITICAL PRINCIPLE: benefits bundled in drafting must each get
// their OWN row even when one clause covers several — comparability across
// deals requires per-element tracking. `compensationItems` already carries
// one entry PER benefit element on a well-formed extraction; when a single
// entry's OWN text additionally names another canonical element (a bundled
// clause — "base salary and target bonus, each no less favorable than..."),
// that element gets its own row too, sharing the SAME standard/quote as the
// entry it was bundled into (copied, never invented) — see buildElementRows.
// A direct compensationItems entry for a code always wins over a bundled
// guess for that same code.
// ───────────────────────────────────────────────────────────────────────────

export const EMPLOYEE_BENEFITS_COLLAPSED_TEXT = 'Employee Benefits — no data extracted';

const EMPLOYEE_BENEFITS_CODES = new Set(['COV-EMPLOYEE']);
const EMPLOYEE_BENEFITS_CATEGORY_RE = /employee[^a-z]*benefits|benefits[^a-z]*continuation|employee\s+matters|continuing\s+employees/i;

const COMP_ITEM_ORDER = [
  'BASE_SALARY', 'TARGET_BONUS', 'ANNUAL_BONUS_PAID', 'LONG_TERM_INCENTIVE',
  'HEALTH_WELFARE', 'RETIREMENT', 'SEVERANCE', 'PTO', 'EQUITY_AWARDS', 'OTHER_BENEFITS',
];

const COMP_ITEM_LABELS = {
  BASE_SALARY: 'Base salary',
  TARGET_BONUS: 'Target annual bonus / cash incentive',
  ANNUAL_BONUS_PAID: 'Earned annual bonus (pro-rata)',
  LONG_TERM_INCENTIVE: 'Long-term incentive (LTI) / equity grants',
  HEALTH_WELFARE: 'Health and welfare benefits',
  RETIREMENT: 'Retirement / 401(k) benefits',
  SEVERANCE: 'Severance / change-in-control protection',
  PTO: 'Paid time off / vacation',
  EQUITY_AWARDS: 'Equity / stock awards (new grants)',
  OTHER_BENEFITS: 'Other benefits',
};

// Keyword synonyms used ONLY to detect a bundled reference to a canonical
// element inside ANOTHER element's own text. Never used to override an
// element's own direct compensationItems entry (see buildElementRows: pass 1
// always wins).
const COMP_ITEM_TEXT_SYNONYMS = {
  BASE_SALARY: /base\s+salary|base\s+wage/i,
  TARGET_BONUS: /target\s+(?:annual\s+)?bonus|cash\s+incentive/i,
  ANNUAL_BONUS_PAID: /earned\s+(?:annual\s+)?bonus|pro-?rata\s+bonus/i,
  LONG_TERM_INCENTIVE: /long-term\s+incentive|\bLTI\b|equity\s+(?:compensation|grants?|awards?|opportunities)/i,
  HEALTH_WELFARE: /health\s+and\s+welfare|welfare\s+benefit/i,
  RETIREMENT: /retirement|401\(k\)/i,
  SEVERANCE: /severance/i,
  PTO: /paid\s+time.?off|vacation/i,
  EQUITY_AWARDS: /equity\s+(?:award|grant)/i,
  OTHER_BENEFITS: /other\s+(?:employee\s+)?benefits?/i,
};

// STANDARD -> COMPARISON GROUP. The schema has no discrete "comparison
// group" field; it's implied by the standard_code — COMPARABLE_TO_BUYER_EMPLOYEES
// is explicitly a buyer-employee comparison, every other comparative
// standard (NO_LESS_FAVORABLE / SUBSTANTIALLY_SIMILAR / SUBSTANTIALLY_COMPARABLE
// / IN_THE_AGGREGATE / TARGET_BASELINE) compares against the employee's OWN
// pre-closing arrangements. BUYER_DISCRETION isn't a comparison at all (it's
// a unilateral-discretion standard), so it gets no comparison-group pill.
const BUYER_EMPLOYEE_COMPARISON_CODES = new Set(['COMPARABLE_TO_BUYER_EMPLOYEES']);
const NO_COMPARISON_CODES = new Set(['BUYER_DISCRETION']);
const COMPARISON_GROUP_BUYER_EMPLOYEES = 'Similarly-situated buyer employees';
const COMPARISON_GROUP_PRE_CLOSING = 'Company pre-closing arrangements';

function humanizeCode(code) {
  if (!code) return '';
  return String(code)
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/* Read a provision's structured features, handling both the raw pipeline
 * shape (`provision.features`) and the stored DB shape
 * (`provision.ai_metadata.features`, possibly JSON-stringified). */
export function featureBag(provision) {
  if (!provision) return {};
  if (provision.features && typeof provision.features === 'object') return provision.features;
  let meta = provision.ai_metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = null; }
  }
  if (meta && typeof meta === 'object' && meta.features && typeof meta.features === 'object') return meta.features;
  return {};
}

function provisionCode(provision) {
  if (provision && provision.code) return provision.code;
  let meta = provision && provision.ai_metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = null; }
  }
  return (meta && typeof meta === 'object' && meta.code) || null;
}

export function isEmployeeBenefitsProvision(provision) {
  if (!provision) return false;
  if (EMPLOYEE_BENEFITS_CODES.has(provisionCode(provision))) return true;
  const cat = String(provision.category || '');
  return EMPLOYEE_BENEFITS_CATEGORY_RE.test(cat);
}

export function formatContinuationPeriod(value) {
  if (value === null || value === undefined || value === '' || value === false) return null;
  if (typeof value === 'number') return `${value} month${value === 1 ? '' : 's'}`;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || null;
  }
  return null;
}

/* Derive comparison group from a compensationItems entry's standard_code —
 * never invented, only ever one of the two owner-specified groups (or null
 * for a non-comparative standard like buyer discretion). */
export function comparisonGroupForStandardCode(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).toUpperCase();
  if (NO_COMPARISON_CODES.has(code)) return null;
  if (BUYER_EMPLOYEE_COMPARISON_CODES.has(code)) return COMPARISON_GROUP_BUYER_EMPLOYEES;
  return COMPARISON_GROUP_PRE_CLOSING;
}

/* First populated continuation-period signal across the section's
 * provisions — protectionPeriodMonths / employeeBenefitPeriod (bare number,
 * "months" appended) preferred over the free-text protectionPeriod. */
export function deriveContinuationPeriod(ebProvisions) {
  for (const p of ebProvisions || []) {
    const f = featureBag(p);
    const months = typeof f.protectionPeriodMonths === 'number' ? f.protectionPeriodMonths
      : typeof f.employeeBenefitPeriod === 'number' ? f.employeeBenefitPeriod
      : null;
    if (months !== null) {
      return { value: formatContinuationPeriod(months), quote: typeof f.protectionPeriod === 'string' ? f.protectionPeriod : null, provision: p };
    }
    const text = formatContinuationPeriod(f.protectionPeriod);
    if (text) return { value: text, quote: text, provision: p };
  }
  return null;
}

function buildRow(code, item, provision, bundled) {
  const standardCode = item.standard_code || item.standardCode || null;
  const standardLabel = item.standard_label || item.standardLabel
    || (standardCode ? humanizeCode(standardCode) : null);
  const text = typeof item.text === 'string' && item.text.trim() ? item.text.trim() : null;
  return {
    code,
    label: COMP_ITEM_LABELS[code] || humanizeCode(code),
    standardCode: standardCode || null,
    standardLabel: standardLabel || null,
    comparisonGroup: comparisonGroupForStandardCode(standardCode),
    text,
    quote: text,
    bundled: !!bundled,
    provision,
  };
}

/* One row PER benefit/comp element the section's compensationItems arrays
 * carry, in canonical order. A direct entry (item's OWN code) always wins;
 * a SECOND pass then adds a row for any OTHER canonical element whose text
 * is bundled into an existing entry (keyword match against that entry's own
 * text) and has no direct entry anywhere in the section — that bundled row
 * shares the bundling entry's standard/text/provision (same values, shared
 * hover), never fabricated. */
export function buildElementRows(ebProvisions) {
  const allItems = [];
  for (const p of ebProvisions || []) {
    const f = featureBag(p);
    const items = Array.isArray(f.compensationItems) ? f.compensationItems : [];
    for (const item of items) {
      if (item && typeof item === 'object') allItems.push({ item, provision: p });
    }
  }

  const rowsByCode = new Map();

  // Pass 1: direct entries.
  for (const { item, provision } of allItems) {
    const ownCode = String(item.item || item.code || '').toUpperCase();
    if (!ownCode || rowsByCode.has(ownCode)) continue;
    rowsByCode.set(ownCode, buildRow(ownCode, item, provision, false));
  }

  // Pass 2: bundled references — an item's own text also names another
  // canonical element with no direct entry anywhere in this section.
  for (const { item, provision } of allItems) {
    const ownCode = String(item.item || item.code || '').toUpperCase();
    const text = typeof item.text === 'string' ? item.text : '';
    if (!text) continue;
    for (const [code, re] of Object.entries(COMP_ITEM_TEXT_SYNONYMS)) {
      if (code === ownCode || rowsByCode.has(code)) continue;
      if (re.test(text)) rowsByCode.set(code, buildRow(code, item, provision, true));
    }
  }

  return COMP_ITEM_ORDER.filter((c) => rowsByCode.has(c)).map((c) => rowsByCode.get(c));
}

/* Top-level display state, mirroring lib/sec-meeting.js's
 * secMeetingDisplayState shape (collapsed / collapsedText / rows). */
export function employeeBenefitsDisplayState(allProvisions) {
  const ebProvisions = (allProvisions || []).filter(isEmployeeBenefitsProvision);
  if (ebProvisions.length === 0) {
    return { collapsed: true, collapsedText: EMPLOYEE_BENEFITS_COLLAPSED_TEXT, continuationPeriod: null, rows: [] };
  }
  const continuationPeriod = deriveContinuationPeriod(ebProvisions);
  const rows = buildElementRows(ebProvisions);
  if (!continuationPeriod && rows.length === 0) {
    return { collapsed: true, collapsedText: EMPLOYEE_BENEFITS_COLLAPSED_TEXT, continuationPeriod: null, rows: [] };
  }
  return { collapsed: false, collapsedText: null, continuationPeriod, rows };
}
