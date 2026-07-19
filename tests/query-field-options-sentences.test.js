// tests/query-field-options-sentences.test.js — Ben's query-surface UX pass:
// dependent field/value options (lib/query/field-meta.js +
// pages/api/query/field-options.js) and human-sentence filter phrasing
// (lib/query/filter-labels.js). Locks in the three product rules:
//   1. The value control offers REAL options (registry fields per
//      provision_type; corpus-observed, taxonomy-labeled values for coded
//      fields) — never a raw enum dump or extraction-annotation label.
//   2. Sentences everywhere: booleans "Has X"/"Does not have X", coded
//      "is"/"is not", numerics "at least/at most/exactly/between". No
//      "equals", no bare Yes/No.
//   3. The field-options endpoint fails SOFT when Supabase is down: field
//      lists are static metadata and must still answer; value options
//      degrade to an empty list instead of erroring.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  cleanFieldLabel,
  fieldsForProvisionType,
  observedValueOptions,
  valueOptionsForField,
} = require('../lib/query/field-meta');
const { sentenceForFilter, describeFilter } = require('../lib/query/filter-labels');
const { wpTypeToFamilies } = require('../lib/query/types');

// ── field-meta: dependent field lists (item 1) ─────────────────────────────

test('fieldsForProvisionType is static metadata: real fields, typed, deduped, no DB needed', () => {
  const fields = fieldsForProvisionType('TERMINATION_FEE');
  assert.ok(fields.length > 0, 'TERMINATION_FEE offers fields');
  const keys = fields.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate canonical keys (aliases collapse)');
  const fee = fields.find((f) => f.key === 'companyTerminationFee');
  assert.ok(fee, 'companyTerminationFee is offered');
  assert.equal(fee.numeric, true);
  assert.equal(fee.unit, '$');
  // Sorted alphabetically by label so the dropdown reads as a list, not
  // registry order.
  const labels = fields.map((f) => f.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b)));
});

test('field labels are human: extraction-annotation suffixes never reach the dropdown', () => {
  const all = [
    'CONSIDERATION', 'REPRESENTATION', 'MATERIAL_CONTRACT', 'CLOSING_CONDITION',
    'COVENANT_INTERIM_OPERATING', 'COVENANT_NO_SOLICITATION', 'COVENANT_OTHER',
    'TERMINATION_RIGHT', 'TERMINATION_FEE', 'DEFINITION', 'ANTITRUST_REGULATORY',
    'SEC_FILING_MEETING', 'EMPLOYEE_BENEFITS', 'STRUCTURE_MECHANICS', 'MAE',
    'NO_OTHER_REPS', 'MISC_BOILERPLATE',
  ];
  for (const pt of all) {
    for (const f of fieldsForProvisionType(pt)) {
      // "{...}" / "[{...}]" are schema-shape leaks; a plain "[date]"-style
      // bracket inside a kept meaning-bearing suffix is fine.
      assert.doesNotMatch(f.label, /[{}]/, `${pt}.${f.key}: "${f.label}" leaks a schema shape`);
      assert.doesNotMatch(f.label, /verbatim|e\.g\./i, `${pt}.${f.key}: "${f.label}" leaks extraction guidance`);
    }
  }
});

test('cleanFieldLabel strips annotation junk but keeps meaning-bearing suffixes', () => {
  assert.equal(cleanFieldLabel('Company Termination Fee - object { amount, percentage_of_equity, triggers[], payment_deadline }'), 'Company Termination Fee');
  assert.equal(cleanFieldLabel('Anti-Reliance rep - verbatim language'), 'Anti-Reliance rep');
  assert.equal(cleanFieldLabel('Termination fees - structured fee table'), 'Termination fees');
  assert.equal(cleanFieldLabel('Instrument Type (the equity-award type this row represents - drawn from EQUITY_INSTRUMENTS)'), 'Instrument Type');
  assert.equal(cleanFieldLabel('Notices Block (party + address + email + counsel cc) - verbatim'), 'Notices Block');
  // Meaning-bearing suffixes / short qualifiers survive — sibling fields must
  // not collapse to the same label.
  assert.equal(cleanFieldLabel('Public statements carveout - Company'), 'Public statements carveout - Company');
  assert.equal(cleanFieldLabel('Tail fee trigger - alternative announced during pendency'), 'Tail fee trigger - alternative announced during pendency');
  assert.equal(cleanFieldLabel('AoC rep - "no MAE since [date]" limb present'), 'AoC rep - "no MAE since [date]" limb present');
  assert.equal(cleanFieldLabel('ARC re-affirmation deadline (business days) - for "fail to publicly recommend against ... within X days" sub-item'), 'ARC re-affirmation deadline (business days)');
});

// ── field-meta: dependent value options (item 1) ───────────────────────────

function fixtureProvision(provisionType, features) {
  // provisionMatchesWpType accepts the family type string directly.
  const family = wpTypeToFamilies(provisionType)[0];
  return { type: family, ai_metadata: { features } };
}

test('observedValueOptions counts corpus codes and labels them via taxonomy, not raw enum constants', () => {
  const provisions = [
    fixtureProvision('TERMINATION_RIGHT', { partyWhoCanTerminate: { value: 'PARTY_BUYER' } }),
    fixtureProvision('TERMINATION_RIGHT', { partyWhoCanTerminate: 'PARTY_BUYER' }),
    fixtureProvision('TERMINATION_RIGHT', { partyWhoCanTerminate: { value: 'PARTY_MUTUAL' } }),
    // Wrong provision type: never contributes options.
    fixtureProvision('TERMINATION_FEE', { partyWhoCanTerminate: { value: 'PARTY_TARGET' } }),
  ];
  const options = observedValueOptions('TERMINATION_RIGHT', 'partyWhoCanTerminate', provisions);
  assert.deepEqual(options.map((o) => o.code), ['PARTY_BUYER', 'PARTY_MUTUAL'], 'only observed codes, count-descending');
  assert.deepEqual(options.map((o) => o.count), [2, 1]);
  // Dropdown label is the human taxonomy label, never the bare enum code,
  // and never a full definitional sentence (em-dash definitions are trimmed
  // to the short name, with the full text carried as `description`).
  assert.equal(options[0].label, 'Buyer / Parent only');
  for (const o of options) assert.doesNotMatch(o.label, / — /);
});

test('valueOptionsForField shapes boolean/numeric/coded responses for the client control', () => {
  const bool = valueOptionsForField('COVENANT_NO_SOLICITATION', 'forceTheVote', []);
  assert.equal(bool.type, 'boolean');
  assert.deepEqual(bool.options, []);

  const fee = valueOptionsForField('TERMINATION_FEE', 'companyTerminationFee', []);
  assert.equal(fee.unit, '$');
  assert.deepEqual(fee.options, []);
  assert.equal(fee.label, 'Company Termination Fee', 'cleaned label, not the registry annotation blob');

  // Coded field with an empty corpus (the DB-down degraded path): still a
  // well-formed response — correct type, empty options.
  const coded = valueOptionsForField('COVENANT_NO_SOLICITATION', 'forceTheVoteType', []);
  assert.deepEqual(coded.options, []);
  assert.ok(coded.type, 'type still resolved from static metadata');
});

// ── filter-labels: human sentences (item 2) ────────────────────────────────

test('boolean filters phrase as presence, never Yes/No or equals', () => {
  const meta = { type: 'boolean', label: 'Force the vote', unit: null, options: [] };
  const f = { provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq' };
  assert.equal(sentenceForFilter({ ...f, value: true }, meta), 'Covenant no solicitation: Has force the vote');
  assert.equal(sentenceForFilter({ ...f, value: false }, meta), 'Covenant no solicitation: Does not have force the vote');
  // neq inverts the presence phrasing rather than saying "is not true".
  assert.equal(sentenceForFilter({ ...f, op: 'neq', value: true }, meta), 'Covenant no solicitation: Does not have force the vote');
  // Fallback with no fieldMeta (result-page chips): string 'true' still
  // reads as presence.
  assert.equal(sentenceForFilter({ ...f, value: 'true' }), 'Covenant no solicitation: Has force the vote');
});

test('numeric filters phrase as quantifiers with unit-aware values, including between', () => {
  const meta = { type: 'usd', label: 'Company Termination Fee', unit: '$', options: [] };
  const f = { provision_type: 'TERMINATION_FEE', field: 'companyTerminationFee' };
  assert.equal(
    sentenceForFilter({ ...f, op: 'gte', value: 100000000 }, meta),
    'Termination fee: Company Termination Fee is at least $100M',
  );
  assert.equal(
    sentenceForFilter({ ...f, op: 'eq', value: 3500000 }, meta),
    'Termination fee: Company Termination Fee is exactly $3.5M',
  );
  assert.equal(
    sentenceForFilter({ ...f, op: 'between', value: [50000000, 150000000] }, meta),
    'Termination fee: Company Termination Fee is between $50M and $150M',
  );
  const days = { type: 'duration', label: 'Tail period', unit: 'days', options: [] };
  assert.equal(
    sentenceForFilter({ provision_type: 'TERMINATION_FEE', field: 'tailPeriod', op: 'lte', value: 12 }, days),
    'Termination fee: Tail period is at most 12 days',
  );
});

test('coded filters phrase as is / is not with the option label, not the raw code', () => {
  const meta = {
    type: 'enum',
    label: 'Consideration form',
    unit: null,
    options: [{ code: 'ALL_CASH', label: 'All cash' }],
  };
  const f = { provision_type: 'CONSIDERATION', field: 'considerationType', value: 'ALL_CASH' };
  assert.equal(sentenceForFilter({ ...f, op: 'eq' }, meta), 'Consideration: Consideration form is all cash');
  assert.equal(sentenceForFilter({ ...f, op: 'neq' }, meta), 'Consideration: Consideration form is not all cash');
  // No fieldMeta: humanized code, still never the bare enum constant.
  assert.equal(
    sentenceForFilter({ ...f, op: 'eq' }),
    'Consideration: Consideration type is all cash',
  );
});

test('no sentence ever says "equals" and describeFilter carries the sentence as .text', () => {
  const samples = [
    [{ provision_type: 'MAE', field: 'pandemicCarveout', op: 'eq', value: true }, { type: 'boolean', label: 'Pandemic carveout' }],
    [{ provision_type: 'TERMINATION_FEE', field: 'companyTerminationFee', op: 'eq', value: 1000000 }, { type: 'usd', label: 'Fee', unit: '$' }],
    [{ provision_type: 'CONSIDERATION', field: 'considerationType', op: 'eq', value: 'ALL_CASH' }, { type: 'enum', label: 'Type', options: [] }],
    [{ provision_type: 'DEFINITION', field: 'definedTerm', op: 'contains', value: 'Superior' }, null],
  ];
  for (const [filter, meta] of samples) {
    const sentence = sentenceForFilter(filter, meta || undefined);
    assert.doesNotMatch(sentence, /\bequals\b/i, sentence);
    assert.doesNotMatch(sentence, /: Yes$|: No$/, sentence);
    assert.equal(describeFilter(filter, meta || undefined).text, sentence);
  }
});

// ── endpoint: fail-soft with the DB down (item 1, resilience) ──────────────
// pages/ files are ESM — same source-text-assertion pattern as
// tests/query-staging-exclusion.test.js.

test('field-options endpoint answers field lists without touching Supabase and degrades value options when the DB is down', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'query', 'field-options.js'), 'utf8');
  // The fields-list branch returns BEFORE any Supabase/loadContext call.
  const fieldsReturn = src.indexOf('fieldsForProvisionType(provisionType)');
  const contextCall = src.indexOf('loadContext(');
  assert.ok(fieldsReturn > -1 && contextCall > -1);
  assert.ok(fieldsReturn < contextCall, 'fields list resolves before the corpus load');
  // The value-options branch catches a failed corpus load and proceeds with
  // an empty provisions list instead of erroring.
  assert.match(src, /catch\s*\{\s*provisions\s*=\s*\[\]/);
});
