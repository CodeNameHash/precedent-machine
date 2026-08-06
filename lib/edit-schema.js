/* ─────────────────────────────────────────────────────────────────────────
   lib/edit-schema.js — the per-provision-type editable-field schema.
   ───────────────────────────────────────────────────────────────────────────
   The edit panel used to render the ENTIRE rubric feature list for a type
   (minus a hardcoded blocklist), so unrelated controls leaked in — e.g.
   disproportionate-impact qualifiers on an ordinary representation. This flips
   it to an ALLOWLIST: each type declares the SMALL set of things a lawyer
   actually corrects, layered as an OVERLAY on the protected, immutable clause
   text.

   Design principles (from Ben):
   - The extracted clause text is authenticity-protected: never editable here,
     always shown. These fields QUALIFY that text, they don't replace it.
   - Only fields that belong to the provision TYPE appear. Materiality selectors
     and exceptions on a rep; carve-outs / carve-backs on the MAE definition;
     fee mechanics on TERMF. No cross-type noise.
   - Keys map to the SAME rubric FEATURES storage, so edits validate
     (lib/feature-validation) and survive re-extraction as overlays
     (lib/parser-v2/reapply-corrections).

   getEditFields(type, code, category) returns the ordered, resolved control
   specs for the panel. Types without a curated schema fall back to
   `fallbackEditFields` (populated rubric fields) so nothing is un-editable.

   CommonJS (consumed by the review page bundle + tests).
   ───────────────────────────────────────────────────────────────────────── */

const { getFeaturesForType } = require('./rubric');
const {
  MATERIALITY_CODES,
  KNOWLEDGE_STANDARD_META,
  EXCEPTION_CODES,
} = require('./taxonomy');

// Materiality-standard options a user picks when a rep/condition carries a
// materiality qualifier. Ordered strongest→weakest; drawn from the taxonomy.
const MATERIALITY_STANDARD_OPTIONS = [
  'MAT_MAE_QUALIFIED',
  'MAT_MAE_AGGREGATE',
  'MAT_MATERIAL_TO_COMPANY',
  'MAT_ALL_MATERIAL',
  'MAT_MATERIAL_INLINE',
  'MAT_ALL_RESPECTS_DE_MINIMIS',
  'MAT_DE_MINIMIS',
].map((code) => ({ value: code, label: MATERIALITY_CODES[code] || code }));

const KNOWLEDGE_STANDARD_OPTIONS = Object.entries(KNOWLEDGE_STANDARD_META)
  .filter(([code]) => code !== 'NA')
  .map(([code, meta]) => ({ value: code, label: (meta && meta.label) || code }));

/* Field spec shape:
   { key, label, control, options?, help?, group? }
   control ∈ 'materiality' | 'knowledge' | 'exceptions' | 'text' | 'currency'
          | 'percentage' | 'checkbox' | 'select' | 'list' | 'number'
   'materiality'/'knowledge'/'exceptions' are composite controls the panel
   renders specially (checkbox + standard picker; tagged-list editor). */

const materialityField = {
  key: 'materialityQualifier',
  label: 'Materiality qualifier',
  control: 'materiality',
  options: MATERIALITY_STANDARD_OPTIONS,
  help: 'Does this provision carry a materiality qualifier over the protected text, and to what standard?',
};

const knowledgeField = {
  key: 'knowledgeQualifier',
  label: 'Knowledge qualifier',
  control: 'knowledge',
  options: KNOWLEDGE_STANDARD_OPTIONS,
  help: 'Is the statement qualified by the knowledge of the party?',
};

const exceptionsField = {
  key: 'permittedExceptions',
  label: 'Exceptions / carve-outs',
  control: 'exceptions',
  options: Object.entries(EXCEPTION_CODES).map(([value, label]) => ({ value, label })),
  help: 'Enumerated exceptions that qualify this provision.',
};

const dollarThresholdField = { key: 'dollarThreshold', label: 'Dollar threshold', control: 'currency' };

// ── Per-code schemas (checked before per-type) ─────────────────────────────
const EDIT_SCHEMA_BY_CODE = {
  // TERMF is a multi-code section; each fee-type edits different mechanics.
  'TERMF-TARGET': [
    { key: 'companyTerminationFee', label: 'Company termination fee', control: 'object', help: 'amount, % of equity, triggers, payment deadline' },
    { key: 'interestOnLatePayment', label: 'Interest on late payment', control: 'object' },
    { key: 'soleAndExclusiveRemedy', label: 'Sole & exclusive remedy', control: 'checkbox' },
  ],
  'TERMF-REVERSE': [
    { key: 'reverseTerminationFee', label: 'Reverse termination fee', control: 'object', help: 'amount, % of equity, triggers, payment deadline' },
    { key: 'interestOnLatePayment', label: 'Interest on late payment', control: 'object' },
  ],
  'TERMF-EXPENSE': [
    { key: 'expenseReimbursement', label: 'Expense reimbursement', control: 'object', help: 'cap + triggers' },
  ],
  'TERMF-TAIL': [
    { key: 'tailProvision', label: 'Tail provision', control: 'object', help: 'period (months), threshold %, triggers' },
  ],
  'TERMF-SOLE': [
    { key: 'soleAndExclusiveRemedy', label: 'Sole & exclusive remedy', control: 'checkbox' },
    // Labelled for the carve-out this code actually carries. TERMF-SOLE is the
    // carve-out to the fee-as-damages cap; TERMF-EFFECT below is the carve-out
    // to the effect-of-termination rule. They are separate facts and an
    // agreement can have either alone, which is why the review tables render
    // them as two rows (owner ruling, 2026-08-05).
    { key: 'willfulBreachException', label: 'Willful-breach carve-out to sole remedy', control: 'checkbox' },
  ],
  // Added 2026-08-05. This code had no edit schema at all, so the
  // effect-of-termination carve-out was readable and not correctable: a
  // reviewer who spotted a wrong value had nowhere to fix it. The gap predates
  // the two-row split but only became visible once the row rendered on its own.
  'TERMF-EFFECT': [
    { key: 'willfulBreachException', label: 'Willful-breach carve-out', control: 'checkbox' },
  ],
};

// ── Per-type schemas ───────────────────────────────────────────────────────
const EDIT_SCHEMA_BY_TYPE = {
  // Representations: materiality + knowledge selectors, exceptions, threshold.
  // Deliberately NO disproportionate qualifiers / MAE carve-outs — those live
  // on the MAE definition, not each rep.
  'REP-T': [materialityField, knowledgeField, exceptionsField, dollarThresholdField],
  'REP-B': [materialityField, knowledgeField, exceptionsField, dollarThresholdField],

  // Conditions: the bring-down materiality standard, cure, and the party the
  // condition benefits.
  COND: [
    { key: 'bringDownStandard', label: 'Bring-down standard', control: 'materiality', options: MATERIALITY_STANDARD_OPTIONS },
    { key: 'materialityScrape', label: 'Materiality scrape', control: 'checkbox', help: 'Materiality qualifiers disregarded for the bring-down.' },
    { key: 'curePeriodDays', label: 'Cure period (days)', control: 'number' },
  ],

  // Termination rights: who, triggers, cure, outside date.
  TERMR: [
    { key: 'partyWhoCanTerminate', label: 'Terminating party', control: 'select', options: [
      { value: 'Either party', label: 'Either party' },
      { value: 'Company / Target', label: 'Company / Target' },
      { value: 'Buyer / Parent', label: 'Buyer / Parent' },
    ] },
    { key: 'terminationTriggers', label: 'Triggers', control: 'list' },
    { key: 'curePeriodDays', label: 'Cure period (days)', control: 'number' },
    { key: 'outsideDateMonths', label: 'Outside date (months)', control: 'number' },
  ],

  // Interim operating covenants: consent standard, threshold, exceptions.
  IOC: [
    { key: 'consentStandard', label: 'Consent standard', control: 'select', options: [
      { value: 'prior-written', label: 'Prior written consent' },
      { value: 'not-unreasonably-withheld', label: 'Not to be unreasonably withheld' },
      { value: 'sole-discretion', label: 'Sole discretion' },
    ] },
    dollarThresholdField,
    exceptionsField,
  ],
};

// The MAE definition is where disproportionate carve-backs legitimately live.
const MAE_EDIT_FIELDS = [
  { key: 'carveouts', label: 'MAE carve-outs', control: 'list', help: 'Events excluded from constituting an MAE.' },
  { key: 'disproportionateImpactCarveouts', label: 'Disproportionate-impact carve-backs', control: 'list', help: 'Carve-outs that DO count to the extent they disproportionately affect the company.' },
  { key: 'materialityScrape', label: 'Materiality scrape', control: 'checkbox' },
];

function isMaeDefinition(type, code, category) {
  if (code === 'DEF-MAE' || code === 'DEF-MAE-CLINICAL') return true;
  return type === 'DEF' && /material adverse effect/i.test(category || '');
}

/**
 * Resolve the ordered editable-field specs for a provision.
 * @param {string} type provision type (REP-T, COND, DEF, …)
 * @param {string} code canonical code (may be null)
 * @param {string} category provision category (used to detect the MAE def)
 * @returns {Array<{key,label,control,options?,help?}>}
 */
function getEditFields(type, code, category) {
  if (isMaeDefinition(type, code, category)) return MAE_EDIT_FIELDS;
  if (code && EDIT_SCHEMA_BY_CODE[code]) return EDIT_SCHEMA_BY_CODE[code];
  // Family fallback: TERMF-* with an unknown/absent code shows the union.
  if (type === 'TERMF' && !EDIT_SCHEMA_BY_CODE[code]) {
    return [
      { key: 'companyTerminationFee', label: 'Company termination fee', control: 'object' },
      { key: 'reverseTerminationFee', label: 'Reverse termination fee', control: 'object' },
      { key: 'tailProvision', label: 'Tail provision', control: 'object' },
      { key: 'soleAndExclusiveRemedy', label: 'Sole & exclusive remedy', control: 'checkbox' },
    ];
  }
  const base = type && type.startsWith('REP') ? EDIT_SCHEMA_BY_TYPE[type.startsWith('REP-B') ? 'REP-B' : 'REP-T'] : null;
  if (base) return base;
  if (EDIT_SCHEMA_BY_TYPE[type]) return EDIT_SCHEMA_BY_TYPE[type];
  // Party-suffixed COND/TERMR families share the base schema.
  if (type && type.startsWith('COND')) return EDIT_SCHEMA_BY_TYPE.COND;
  if (type && type.startsWith('TERMR')) return EDIT_SCHEMA_BY_TYPE.TERMR;
  if (type && type.startsWith('IOC')) return EDIT_SCHEMA_BY_TYPE.IOC;
  return null; // signal: use fallbackEditFields
}

/**
 * Fallback for types without a curated schema: the rubric fields that are
 * currently populated (so the panel still lets you edit real data), minus the
 * infra/derived keys the old blocklist hid.
 */
const FALLBACK_HIDE = new Set([
  'mainConcept', 'crossReferences', 'carveOuts', 'carveOutsList',
  'definitionText',
  'maeQualifiedReps', 'mae_qualified_reps', 'canonicalCode',
  'sectionNumber', 'sort_order', 'sourceSection', 'sourceSectionType',
  'inlineDefinition', 'relatedDefinitions', 'startChar', 'flags',
]);

function fallbackEditFields(type, code, features = {}) {
  const schema = getFeaturesForType(type, code) || [];
  const seen = new Set();
  const out = [];
  for (const f of schema) {
    if (!f || !f.key || seen.has(f.key) || FALLBACK_HIDE.has(f.key)) continue;
    // Only surface fields that currently hold a value.
    const v = features[f.key];
    const populated = v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0) && v !== '';
    if (!populated) continue;
    seen.add(f.key);
    out.push({ key: f.key, label: f.label || f.key, control: f.type === 'boolean' ? 'checkbox' : (f.type || 'text') });
  }
  return out;
}

/** getEditFields with the fallback applied — always returns a usable list. */
function resolveEditFields(type, code, category, features = {}) {
  const curated = getEditFields(type, code, category);
  if (curated) return { fields: curated, curated: true };
  return { fields: fallbackEditFields(type, code, features), curated: false };
}

module.exports = {
  getEditFields,
  resolveEditFields,
  fallbackEditFields,
  isMaeDefinition,
  MATERIALITY_STANDARD_OPTIONS,
  KNOWLEDGE_STANDARD_OPTIONS,
};
