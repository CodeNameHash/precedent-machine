'use strict';

/**
 * tests/review-parity-harness.test.js
 *
 * Tests for the legacy-vs-Canonical-V2 review-parity harness
 * (lib/review-parity/**, scripts/review-parity-check.js).
 *
 * The five properties the harness exists to guarantee are proved first, in
 * their own describe block, because everything else is detail:
 *
 *   1. identical inputs produce a clean pass
 *   2. a dropped row is caught and classified as V2_LOSS
 *   3. a changed value is caught and classified as DISAGREEMENT
 *   4. a purely cosmetic difference does NOT fail
 *   5. output is byte-identical across two runs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  ABSENT, foldText, isAbsent, normKey, normaliseValue, readPath,
} = require('../lib/review-parity/normalise');
const { MAPPING_SCHEMA, MappingError, compileMapping } = require('../lib/review-parity/mapping');
const { OUTCOMES, classifyField, compareDeal } = require('../lib/review-parity/compare');
const { EXIT, buildReport, exitCodeFor, renderText } = require('../lib/review-parity/report');
const { runComparison } = require('../lib/review-parity/run');
const { buildLegacyRows, buildV2Rows } = require('../lib/review-parity/views');
const { loadCaseSet, resolveSide } = require('../lib/review-parity/case-file');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = path.resolve(__dirname, '..');
const MAPPING_FILE = path.join(REPO_ROOT, 'lib', 'review-parity', 'mappings', 'material-contracts.example.json');
const CASES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'review-parity', 'cases', 'material-contracts');
const TOPBUILD_SNAPSHOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'canonical-v2', 'v1v2-comparator', 'topbuild-v1-provision-snapshot.json');
const LANDOS_PROJECTION = path.join(CASES_DIR, 'landos-abbvie.projection.json');

// ---------------------------------------------------------------------------
// A tiny synthetic family, so the engine can be exercised without dragging a
// table config in. Paths are real row-shaped paths; the module paths are only
// validated for shape, never loaded, by compareDeal().
// ---------------------------------------------------------------------------

function mappingFor(fieldOverrides = [], rowKey = ['code']) {
  return compileMapping({
    schema: MAPPING_SCHEMA,
    mapping_version: 'test-1',
    family_id: 'TEST_FAMILY',
    legacy: {
      config_module: 'components/review/table-configs/material-contracts.config.js',
      config_export: 'materialContractsConfig',
    },
    v2: { view: 'config_rows' },
    row_key: rowKey,
    fields: [
      { field_id: 'code', legacy: 'code', v2: 'code', kind: 'citation' },
      { field_id: 'label', legacy: 'label', v2: 'label', kind: 'text' },
      { field_id: 'threshold', legacy: 'threshold', v2: 'threshold', kind: 'text' },
      { field_id: 'evidence', legacy: 'evidence', v2: 'evidence', kind: 'quote' },
      { field_id: 'section_ref', legacy: 'source.section_ref', v2: 'source.section_ref', kind: 'citation' },
      ...fieldOverrides,
    ],
  });
}

function row(code, overrides = {}) {
  return {
    code,
    label: `${code} label`,
    threshold: '$10,000,000',
    evidence: 'any supply agreement requiring annual payments of more than $10,000,000;',
    source: { section_ref: '3.13' },
    ...overrides,
  };
}

function compare(legacyRows, v2Rows, mapping = mappingFor()) {
  return compareDeal({ mapping, deal_id: 'deal-1', legacy_rows: legacyRows, v2_rows: v2Rows });
}

function reportFor(dealResult, mapping = mappingFor()) {
  return buildReport({ mapping, deals: [dealResult], corpus: {} });
}

function findingsWith(result, predicate) {
  return result.findings.filter(predicate);
}

// ===========================================================================
// THE FIVE REQUIRED PROOFS
// ===========================================================================

test('required proof 1: identical inputs produce a clean pass', () => {
  const rows = [row('SUPPLY'), row('INDEBTEDNESS'), row('HEDGING')];
  const result = compare(rows, rows.map((item) => ({ ...item, source: { ...item.source } })));

  assert.equal(result.substantive_count, 0);
  assert.equal(result.outcome_counts[OUTCOMES.V2_LOSS], 0);
  assert.equal(result.outcome_counts[OUTCOMES.V2_ADDITION], 0);
  assert.equal(result.outcome_counts[OUTCOMES.DISAGREEMENT], 0);
  assert.equal(result.outcome_counts[OUTCOMES.COSMETIC], 0);
  assert.equal(result.outcome_counts[OUTCOMES.IDENTICAL], 15, '3 rows x 5 fields all identical');
  assert.deepEqual(result.findings, []);

  const report = reportFor(result);
  assert.equal(report.headline.clean, true);
  assert.equal(exitCodeFor(report), EXIT.CLEAN);
});

test('required proof 2: a dropped row is caught and classified as V2_LOSS', () => {
  const legacy = [row('SUPPLY'), row('INDEBTEDNESS'), row('HEDGING')];
  const v2 = [row('SUPPLY'), row('HEDGING')];
  const result = compare(legacy, v2);

  const rowLosses = findingsWith(result, (f) => f.scope === 'row' && f.outcome === OUTCOMES.V2_LOSS);
  assert.equal(rowLosses.length, 1);
  assert.equal(rowLosses[0].reason, 'ROW_PRESENT_IN_LEGACY_ONLY');
  assert.equal(rowLosses[0].row_key.code, 'INDEBTEDNESS');
  assert.equal(rowLosses[0].v2_value, null);
  assert.match(rowLosses[0].legacy_value, /INDEBTEDNESS/);
  assert.equal(result.row_counts.legacy_only, 1);
  assert.equal(result.row_counts.v2_only, 0);

  const report = reportFor(result);
  // Impossible to overlook: its own headline counter, its own report
  // section, and a non-zero exit.
  assert.equal(report.headline.row_level_v2_loss, 1);
  assert.equal(report.row_level_losses.length, 1);
  assert.equal(exitCodeFor(report), EXIT.SUBSTANTIVE_DIFFERENCE);
  const text = renderText(report);
  assert.match(text, /ROW-LEVEL LOSS -- 1 row\(s\) present in legacy and absent from Canonical V2/);
  assert.match(text, /rows legacy renders and V2 does not \(V2_LOSS\)\s+1/);
});

test('required proof 3: a changed value is caught and classified as DISAGREEMENT', () => {
  const legacy = [row('SUPPLY', { threshold: '$10,000,000' })];
  const v2 = [row('SUPPLY', { threshold: '$25,000,000' })];
  const result = compare(legacy, v2);

  const disagreements = findingsWith(result, (f) => f.outcome === OUTCOMES.DISAGREEMENT);
  assert.equal(disagreements.length, 1);
  assert.equal(disagreements[0].field_id, 'threshold');
  assert.equal(disagreements[0].reason, 'VALUE_CHANGED');
  assert.equal(disagreements[0].legacy_value, '$10,000,000');
  assert.equal(disagreements[0].v2_value, '$25,000,000');
  // A disagreement is never counted as a loss or an addition.
  assert.equal(result.outcome_counts[OUTCOMES.V2_LOSS], 0);
  assert.equal(result.outcome_counts[OUTCOMES.V2_ADDITION], 0);
  assert.equal(exitCodeFor(reportFor(result)), EXIT.SUBSTANTIVE_DIFFERENCE);
});

test('required proof 4: a purely cosmetic difference does NOT fail', () => {
  const legacy = [row('SUPPLY', {
    label: 'Supply  contracts',
    evidence: 'any supply agreement\n\trequiring annual payments of more than $10,000,000;',
  })];
  const v2 = [row('SUPPLY', {
    label: ' Supply contracts ',
    evidence: 'any supply agreement requiring annual payments of more than $10,000,000;',
  })];
  const result = compare(legacy, v2);

  assert.equal(result.substantive_count, 0);
  assert.equal(result.outcome_counts[OUTCOMES.COSMETIC], 2);
  assert.ok(result.findings.every((f) => f.outcome === OUTCOMES.COSMETIC));
  assert.ok(result.findings.every((f) => f.reason === 'EQUAL_AFTER_NORMALISATION'));

  const report = reportFor(result);
  assert.equal(report.headline.clean, true);
  assert.equal(exitCodeFor(report), EXIT.CLEAN);
  // Cosmetic findings are still reported, just not as failures.
  assert.match(renderText(report), /COSMETIC \(2\) -- normalised away, not failures/);
});

test('required proof 5: output is byte-identical across two runs', () => {
  const legacy = [row('SUPPLY'), row('INDEBTEDNESS', { threshold: '$5,000' }), row('HEDGING')];
  const v2 = [row('HEDGING'), row('SUPPLY', { label: 'SUPPLY   label' })];

  const first = renderReportBytes(legacy, v2);
  const second = renderReportBytes(legacy, v2);
  assert.equal(first.json, second.json);
  assert.equal(first.text, second.text);
  assert.equal(first.reportId, second.reportId);

  // And byte-identical when the INPUT row order changes, since rows pair by
  // key rather than position.
  const shuffled = renderReportBytes([...legacy].reverse(), [...v2].reverse());
  assert.equal(shuffled.json, first.json);
});

function renderReportBytes(legacyRows, v2Rows) {
  const mapping = mappingFor();
  const report = buildReport({ mapping, deals: [compare(legacyRows, v2Rows, mapping)], corpus: { declared_deal_count: 40 } });
  return {
    json: canonicalJson(JSON.parse(JSON.stringify(report))),
    text: renderText(report),
    reportId: report.report_id,
  };
}

// ===========================================================================
// The absence rules
// ===========================================================================

test('missing on both sides is not a difference', () => {
  const mapping = mappingFor([{ field_id: 'note', legacy: 'note', v2: 'note', kind: 'text' }]);
  const legacy = [row('SUPPLY', { note: null })];
  const v2 = [row('SUPPLY', { note: '' })];
  const result = compare(legacy, v2, mapping);
  assert.equal(result.substantive_count, 0);
  assert.deepEqual(result.findings, []);
  assert.equal(result.outcome_counts[OUTCOMES.IDENTICAL], 6);
});

test('a field present in legacy only is V2_LOSS; present in V2 only is V2_ADDITION', () => {
  const mapping = mappingFor([{ field_id: 'note', legacy: 'note', v2: 'note', kind: 'text' }]);

  const lost = compare([row('SUPPLY', { note: 'carve-out applies' })], [row('SUPPLY')], mapping);
  const lostFinding = lost.findings.find((f) => f.field_id === 'note');
  assert.equal(lostFinding.outcome, OUTCOMES.V2_LOSS);
  assert.equal(lostFinding.reason, 'PRESENT_IN_LEGACY_ONLY');
  assert.equal(lostFinding.v2_value, null);

  const added = compare([row('SUPPLY')], [row('SUPPLY', { note: 'carve-out applies' })], mapping);
  const addedFinding = added.findings.find((f) => f.field_id === 'note');
  assert.equal(addedFinding.outcome, OUTCOMES.V2_ADDITION);
  assert.equal(addedFinding.reason, 'PRESENT_IN_V2_ONLY');
  assert.equal(addedFinding.legacy_value, null);
});

test('empty containers count as absent, recursively', () => {
  assert.ok(isAbsent(normaliseValue([])));
  assert.ok(isAbsent(normaliseValue({})));
  assert.ok(isAbsent(normaliseValue({ a: null, b: [], c: { d: '   ' } })));
  assert.ok(isAbsent(normaliseValue('   \n\t ')));
  assert.equal(normaliseValue([null, 'x', undefined]).length, 1);
});

test('a row added by V2 is an addition, never lumped in with loss', () => {
  const result = compare([row('SUPPLY')], [row('SUPPLY'), row('HEDGING')]);
  assert.equal(result.row_counts.v2_only, 1);
  assert.equal(result.row_counts.legacy_only, 0);
  const added = result.findings.filter((f) => f.scope === 'row');
  assert.equal(added.length, 1);
  assert.equal(added[0].outcome, OUTCOMES.V2_ADDITION);
  assert.equal(added[0].reason, 'ROW_PRESENT_IN_V2_ONLY');
  const report = reportFor(result);
  assert.equal(report.headline.row_level_v2_addition, 1);
  assert.equal(report.headline.row_level_v2_loss, 0);
});

test('rows with the same key are paired by ordinal, so a dropped duplicate is still a loss', () => {
  const legacy = [row('SUPPLY'), row('SUPPLY', { threshold: '$1' }), row('SUPPLY', { threshold: '$2' })];
  const v2 = [row('SUPPLY'), row('SUPPLY', { threshold: '$1' })];
  const result = compare(legacy, v2);
  assert.equal(result.row_counts.paired, 2);
  assert.equal(result.row_counts.legacy_only, 1);
  const rowLoss = result.findings.find((f) => f.scope === 'row');
  assert.equal(rowLoss.outcome, OUTCOMES.V2_LOSS);
  assert.equal(rowLoss.detail.legacy_rows_with_key, 3);
  assert.equal(rowLoss.detail.v2_rows_with_key, 2);
});

// ===========================================================================
// Kind-specific classification
// ===========================================================================

test('a truncated quotation is V2_LOSS, an extended one V2_ADDITION', () => {
  const field = { field_id: 'evidence', legacy: 'evidence', v2: 'evidence', kind: 'quote', fold_case: false };
  const full = 'any supply agreement requiring annual payments of more than $10,000,000;';

  const truncated = classifyField(field, full, 'any supply agreement requiring annual payments');
  assert.equal(truncated.outcome, OUTCOMES.V2_LOSS);
  assert.equal(truncated.reason || truncated.detail.reason, 'QUOTE_TRUNCATED');

  const extended = classifyField(field, 'any supply agreement', full);
  assert.equal(extended.outcome, OUTCOMES.V2_ADDITION);
  assert.equal(extended.detail.reason, 'QUOTE_EXTENDED');

  const changed = classifyField(field, full, 'any services agreement requiring annual payments of more than $10,000,000;');
  assert.equal(changed.outcome, OUTCOMES.DISAGREEMENT);
  assert.equal(changed.detail.reason, 'QUOTE_TEXT_CHANGED');
});

test('a citation is never "close enough" -- any difference disagrees', () => {
  const field = { field_id: 'section_ref', legacy: 'x', v2: 'x', kind: 'citation', fold_case: false };
  assert.equal(classifyField(field, '3.13', '3.13(a)').outcome, OUTCOMES.DISAGREEMENT);
  assert.equal(classifyField(field, '3.13', '3.13(a)').detail.reason, 'CITATION_CHANGED');
  // ...but whitespace and unicode still fold.
  assert.equal(classifyField(field, ' 3.13 ', '3.13').outcome, OUTCOMES.COSMETIC);
});

test('set membership: dropped is loss, added is addition, both is disagreement', () => {
  const field = { field_id: 's', legacy: 's', v2: 's', kind: 'set', fold_case: false };
  assert.equal(classifyField(field, ['A', 'B', 'C'], ['C', 'A', 'B']).outcome, OUTCOMES.COSMETIC);

  const dropped = classifyField(field, ['A', 'B', 'C'], ['A', 'C']);
  assert.equal(dropped.outcome, OUTCOMES.V2_LOSS);
  assert.deepEqual(dropped.detail.lost_members, [normKey('B')]);

  const added = classifyField(field, ['A'], ['A', 'B']);
  assert.equal(added.outcome, OUTCOMES.V2_ADDITION);

  const both = classifyField(field, ['A', 'B'], ['A', 'C']);
  assert.equal(both.outcome, OUTCOMES.DISAGREEMENT);
  assert.equal(both.detail.lost_members.length, 1);
  assert.equal(both.detail.added_members.length, 1);

  // Multiset, not set: a dropped duplicate is a loss.
  assert.equal(classifyField(field, ['A', 'A'], ['A']).outcome, OUTCOMES.V2_LOSS);
});

test('sequence kind treats order as substantive', () => {
  const field = { field_id: 'q', legacy: 'q', v2: 'q', kind: 'sequence', fold_case: false };
  assert.equal(classifyField(field, ['A', 'B', 'C'], ['A', 'C']).outcome, OUTCOMES.V2_LOSS);
  assert.equal(classifyField(field, ['A', 'C'], ['A', 'B', 'C']).outcome, OUTCOMES.V2_ADDITION);
  assert.equal(classifyField(field, ['A', 'B'], ['B', 'A']).outcome, OUTCOMES.DISAGREEMENT);
});

test('number kind folds formatting but never magnitude', () => {
  const field = { field_id: 'n', legacy: 'n', v2: 'n', kind: 'number', fold_case: false };
  assert.equal(classifyField(field, '$10,000,000', '10000000').outcome, OUTCOMES.COSMETIC);
  assert.equal(classifyField(field, '$10,000,000', '$10,000,001').outcome, OUTCOMES.DISAGREEMENT);
  // A value that is not a number on one side is a finding, never a guess.
  assert.equal(classifyField(field, '$10,000,000', 'Any').outcome, OUTCOMES.DISAGREEMENT);
  assert.equal(classifyField(field, '$10,000,000', 'Any').detail.reason, 'NUMERIC_UNPARSEABLE');
});

test('case is substantive by default and cosmetic only when the mapping opts in', () => {
  const strict = { field_id: 't', legacy: 't', v2: 't', kind: 'text', fold_case: false };
  const folded = { field_id: 't', legacy: 't', v2: 't', kind: 'text', fold_case: true };
  assert.equal(classifyField(strict, 'Material Adverse Effect', 'material adverse effect').outcome, OUTCOMES.DISAGREEMENT);
  assert.equal(classifyField(folded, 'Material Adverse Effect', 'material adverse effect').outcome, OUTCOMES.COSMETIC);
});

test('byte-identical values are IDENTICAL; normalisation-equal values are COSMETIC', () => {
  const field = { field_id: 't', legacy: 't', v2: 't', kind: 'text', fold_case: false };
  assert.equal(classifyField(field, 'abc', 'abc').outcome, OUTCOMES.IDENTICAL);
  assert.equal(classifyField(field, 'abc', 'abc ').outcome, OUTCOMES.COSMETIC);
});

test('unicode and invisible characters fold, so encoding is never a false positive', () => {
  assert.equal(foldText('“quoted”'), '"quoted"');
  assert.equal(foldText('en–dash em—dash'), 'en-dash em-dash');
  assert.equal(foldText('soft­hyphen'), 'softhyphen');
  assert.equal(foldText('a​b'), 'ab');
  assert.equal(foldText('a b'), 'a b');
  assert.equal(foldText('é'), 'é');
});

test('row order alone is not a difference, but it is recorded', () => {
  const rows = [row('A'), row('B')];
  const same = compare(rows, rows);
  assert.equal(same.row_order_matches, true);
  const reordered = compare(rows, [rows[1], rows[0]]);
  assert.equal(reordered.substantive_count, 0);
  assert.equal(reordered.row_order_matches, false);
});

// ===========================================================================
// Mapping table validation (the mapping is an INPUT, so it is fail-closed)
// ===========================================================================

test('a valid mapping compiles and is content-addressed', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  assert.equal(mapping.family_id, 'MATERIAL_CONTRACTS');
  assert.match(mapping.mapping_id, /^[0-9a-f]{64}$/);
  // Recompiling the same table yields the same id; a changed table does not.
  const again = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  assert.equal(mapping.mapping_id, again.mapping_id);
  const changed = compileMapping({
    ...JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')),
    mapping_version: 'other',
  });
  assert.notEqual(mapping.mapping_id, changed.mapping_id);
  // The V2 side defaults to the legacy config: both sides render through the
  // same renderer unless the mapping deliberately says otherwise.
  assert.equal(mapping.v2.config_module, mapping.legacy.config_module);
});

test('mapping validation is fail-closed', () => {
  const base = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  const bad = (mutate) => {
    const input = JSON.parse(JSON.stringify(base));
    mutate(input);
    return () => compileMapping(input);
  };

  assert.throws(bad((m) => { m.unexpected = 1; }), (e) => e instanceof MappingError && e.code === 'MAPPING_UNKNOWN_KEY');
  assert.throws(bad((m) => { m.fields[0].typo = 1; }), (e) => e.code === 'MAPPING_UNKNOWN_KEY');
  assert.throws(bad((m) => { m.row_key = ['nope']; }), (e) => e.code === 'MAPPING_BAD_ROW_KEY');
  assert.throws(bad((m) => { m.fields.push({ ...m.fields[0] }); }), (e) => e.code === 'MAPPING_DUPLICATE_FIELD');
  assert.throws(bad((m) => { m.fields[0].kind = 'vibes'; }), (e) => e.code === 'MAPPING_BAD_KIND');
  assert.throws(bad((m) => { m.schema = 'OTHER/V1'; }), (e) => e.code === 'MAPPING_BAD_SCHEMA');
  // A mapping is caller-supplied data; it must not be an arbitrary-require
  // primitive.
  assert.throws(bad((m) => { m.legacy.config_module = 'scripts/evil.js'; }), (e) => e.code === 'MAPPING_BAD_MODULE');
  assert.throws(bad((m) => { m.legacy.config_module = 'lib/canonical-v2/../../etc/passwd.js'; }), (e) => e.code === 'MAPPING_BAD_MODULE');
  assert.throws(bad((m) => { m.fields[0].legacy = '__proto__.x'; }), (e) => e.code === 'MAPPING_BAD_FIELDS');
});

test('readPath is total and prototype-safe', () => {
  assert.equal(readPath({ a: { b: 'x' } }, 'a.b'), 'x');
  assert.ok(isAbsent(readPath({ a: {} }, 'a.b')));
  assert.ok(isAbsent(readPath({ a: { b: 'x' } }, 'a.b.c')));
  assert.ok(isAbsent(readPath({}, '__proto__')));
  assert.ok(isAbsent(readPath({}, 'constructor.name')));
  assert.deepEqual(readPath({ items: [{ c: 1 }, { c: 2 }] }, 'items.*.c'), [1, 2]);
  assert.equal(readPath({ items: ['a', 'b'] }, 'items.1'), 'b');
  assert.equal(readPath({ a: 1 }, ''), ABSENT);
});

// ===========================================================================
// Real data shapes: the actual table config, the actual projection output
// ===========================================================================

test('the legacy view builds rows from real committed production provision cards', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const snapshot = JSON.parse(fs.readFileSync(TOPBUILD_SNAPSHOT, 'utf8'));
  const rows = buildLegacyRows({ mapping, deal_id: '7dc3a05f-topbuild', cards: snapshot.cards });
  assert.ok(rows.length > 0, 'the real QXO/TopBuild snapshot yields Material Contracts rows');
  assert.ok(rows.every((item) => typeof item.label === 'string' && item.label !== ''));
  assert.ok(rows.some((item) => item.code === 'SUPPLY' || item.code === 'INDEBTEDNESS'));
});

test('the V2 view builds rows from a real projection through the same table config', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const projection = JSON.parse(fs.readFileSync(LANDOS_PROJECTION, 'utf8'));
  assert.equal(projection.schema_version, 'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_PROJECTION/V2');
  const rows = buildV2Rows({ mapping, deal_id: 'landos-abbvie', projection });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'INDEBTEDNESS');
  assert.equal(rows[0].threshold, '$100,000');
  assert.match(rows[0].evidence, /Indebtedness in excess of \$100,000/);
});

test('real cards on both sides through the real config produce a clean pass', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const snapshot = JSON.parse(fs.readFileSync(TOPBUILD_SNAPSHOT, 'utf8'));
  const legacyRows = buildLegacyRows({ mapping, deal_id: '7dc3a05f-topbuild', cards: snapshot.cards });
  const v2Rows = buildLegacyRows({ mapping, deal_id: '7dc3a05f-topbuild', cards: structuredClone(snapshot.cards) });
  const result = compareDeal({ mapping, deal_id: '7dc3a05f-topbuild', legacy_rows: legacyRows, v2_rows: v2Rows });
  assert.equal(result.substantive_count, 0);
  assert.equal(result.row_counts.legacy_only, 0);
  assert.equal(result.row_counts.v2_only, 0);
  assert.equal(result.row_counts.paired, legacyRows.length);
  assert.equal(exitCodeFor(reportFor(result, mapping)), EXIT.CLEAN);
});

test('dropping one real row from the V2 side is caught on real data', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const snapshot = JSON.parse(fs.readFileSync(TOPBUILD_SNAPSHOT, 'utf8'));
  const legacyRows = buildLegacyRows({ mapping, deal_id: '7dc3a05f-topbuild', cards: snapshot.cards });
  const v2Rows = legacyRows.slice(1);
  const result = compareDeal({ mapping, deal_id: '7dc3a05f-topbuild', legacy_rows: legacyRows, v2_rows: v2Rows });
  assert.equal(result.row_counts.legacy_only, 1);
  const loss = result.findings.find((f) => f.scope === 'row');
  assert.equal(loss.outcome, OUTCOMES.V2_LOSS);
  assert.equal(loss.row_key.bucket_code, legacyRows[0].code);
});

// ===========================================================================
// Case files, coverage accounting and the CLI contract
// ===========================================================================

test('an unreachable side is UNCOMPARABLE and cannot pass silently', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const report = runComparison({
    mapping,
    cases: [{
      file: 'synthetic',
      family_id: 'MATERIAL_CONTRACTS',
      deal_id: 'deal-x',
      deal_label: null,
      review_deal_extra: {},
      legacy: { cards: [] },
      v2: { unavailable: 'no V2 resolution committed for this family' },
    }],
    corpus: { declared_deal_count: 40 },
  });
  assert.equal(report.corpus.deals_compared, 0);
  assert.equal(report.corpus.deals_uncomparable, 1);
  assert.equal(report.headline.substantive_findings, 0);
  // No substantive difference, but the run proves nothing -- it must not
  // look like a pass.
  assert.equal(exitCodeFor(report), EXIT.INCOMPLETE_COVERAGE);
  assert.match(renderText(report), /THIS RUN PROVES NOTHING ABOUT 40 OF 40 DEALS/);
});

test('coverage is reported against the declared corpus, by deal id', () => {
  const mapping = mappingFor();
  const report = buildReport({
    mapping,
    deals: [compare([row('A')], [row('A')], mapping)],
    corpus: { declared_deal_ids: ['deal-1', 'deal-2', 'deal-3'], source: 'test' },
  });
  assert.equal(report.corpus.declared_deal_count, 3);
  assert.equal(report.corpus.deals_compared, 1);
  assert.deepEqual(report.corpus.deals_not_reached, ['deal-2', 'deal-3']);
  assert.equal(report.corpus.coverage_complete, false);
  assert.equal(exitCodeFor(report), EXIT.INCOMPLETE_COVERAGE);
});

test('a side declaring neither cards nor a projection is unavailable, not empty', () => {
  assert.match(resolveSide({}, 'v2').unavailable, /declares no cards/);
  assert.match(resolveSide(undefined, 'legacy').unavailable, /absent from the case file/);
  assert.equal(resolveSide({ cards: [] }, 'legacy').unavailable, undefined);
});

test('the committed Material Contracts case set loads and runs', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const cases = loadCaseSet(CASES_DIR);
  assert.equal(cases.length, 4);
  // Sorted by deal_id, never by filesystem order.
  assert.deepEqual(cases.map((item) => item.deal_id), [
    '7dc3a05f-topbuild', 'af4940e1-skechers', 'dfaa71fa-modiv', 'landos-abbvie',
  ]);
  const report = runComparison({ mapping, cases, corpus: { declared_deal_count: 40, source: 'docs/audits/card-backed-status.md' } });
  assert.equal(report.corpus.deals_compared, 1);
  assert.equal(report.corpus.deals_uncomparable, 3);
  // Committed reality: the only deal with both sides has a V2 row the legacy
  // cards do not carry.
  assert.equal(report.headline.row_level_v2_addition, 1);
  assert.equal(report.headline.row_level_v2_loss, 0);
  assert.equal(exitCodeFor(report), EXIT.SUBSTANTIVE_DIFFERENCE);
});

test('the committed case set report is byte-identical across two runs', () => {
  const mapping = compileMapping(JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8')));
  const render = () => {
    const report = runComparison({ mapping, cases: loadCaseSet(CASES_DIR), corpus: { declared_deal_count: 40 } });
    return { json: canonicalJson(JSON.parse(JSON.stringify(report))), text: renderText(report) };
  };
  const first = render();
  const second = render();
  assert.equal(first.json, second.json);
  assert.equal(first.text, second.text);
});

test('exit codes separate "clean", "different" and "incomplete"', () => {
  const mapping = mappingFor();
  const clean = buildReport({ mapping, deals: [compare([row('A')], [row('A')], mapping)], corpus: {} });
  assert.equal(exitCodeFor(clean), EXIT.CLEAN);

  const different = buildReport({ mapping, deals: [compare([row('A')], [], mapping)], corpus: {} });
  assert.equal(exitCodeFor(different), EXIT.SUBSTANTIVE_DIFFERENCE);

  const incomplete = buildReport({
    mapping,
    deals: [compare([row('A')], [row('A')], mapping)],
    corpus: { declared_deal_count: 40 },
  });
  assert.equal(exitCodeFor(incomplete), EXIT.INCOMPLETE_COVERAGE);
});

test('the CLI runs the committed case set and reports a non-zero exit', () => {
  const { main } = require('../scripts/review-parity-check');
  const chunks = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk) => { chunks.push(String(chunk)); return true; };
  let code;
  try {
    code = main([
      '--mapping', 'lib/review-parity/mappings/material-contracts.example.json',
      '--cases', 'tests/fixtures/review-parity/cases/material-contracts',
      '--corpus-deals', '40',
    ]);
  } finally {
    process.stdout.write = originalWrite;
  }
  const output = chunks.join('');
  assert.equal(code, EXIT.SUBSTANTIVE_DIFFERENCE);
  assert.match(output, /REVIEW PARITY {2}-- {2}family MATERIAL_CONTRACTS/);
  assert.match(output, /THIS RUN PROVES NOTHING ABOUT 39 OF 40 DEALS/);
});

test('the CLI rejects a missing mapping or case set rather than passing', () => {
  const { main } = require('../scripts/review-parity-check');
  const originalErr = process.stderr.write;
  process.stderr.write = () => true;
  try {
    assert.equal(main([]), EXIT.USAGE_ERROR);
    assert.equal(main(['--mapping', 'lib/review-parity/mappings/material-contracts.example.json']), EXIT.USAGE_ERROR);
    assert.equal(main(['--cases', 'tests/fixtures/review-parity/cases/material-contracts']), EXIT.USAGE_ERROR);
  } finally {
    process.stderr.write = originalErr;
  }
});

test('the case generator is deterministic', async () => {
  const { buildFiles } = require('../scripts/review-parity-build-cases');
  const first = await buildFiles();
  const second = await buildFiles();
  assert.deepEqual([...first.keys()].sort(), [...second.keys()].sort());
  for (const [name, content] of first) assert.equal(second.get(name), content, name);
  // And the committed files match what it regenerates.
  for (const [name, content] of first) {
    assert.equal(fs.readFileSync(path.join(CASES_DIR, name), 'utf8'), content, `${name} is stale; rerun scripts/review-parity-build-cases.js`);
  }
});
