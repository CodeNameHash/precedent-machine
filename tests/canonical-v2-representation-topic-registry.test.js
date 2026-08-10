'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  REGISTRY_VERSION, REGISTRY_DIGEST, NATIVE_LIMB_KEY, CLASSIFIED, UNCLASSIFIED,
  UNCLASSIFIED_REASONS, TOPIC_RULES, classifyRepresentationTopic,
} = require('../lib/canonical-v2/representation-topic-registry');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'stage-2y-h-representation-topic-replay.mjs');
const OUTPUT = path.join(ROOT, 'evidence', 'canonical-v2', 'stage-2y-h-representation-topic-replay.json');

function input(raw_value, overrides = {}) {
  return {
    family: 'REPRESENTATIONS', generic_claim_key: NATIVE_LIMB_KEY, raw_value,
    subject: null,
    evidence: { source_text: raw_value, spans: [{ absolute_start: 0, absolute_end: Buffer.byteLength(raw_value, 'utf8') }] },
    ...overrides,
  };
}

test('every V1 raw anchor classifies its declared code from byte-verified evidence', () => {
  for (const rule of TOPIC_RULES) {
    const code = rule.id.replace('REP_TOPIC_V1_', '');
    for (const anchor of rule.anchors) {
      const quote = anchor.replace(/\\b/g, '').replace(/\.\{0,\d+\}/g, ' ').replace(/\(\?:([^)]*)\)/g, (_, values) => values.split('|')[0]).replace(/\?/g, '').replace(/\[sz\]/g, 's').replace(/\[sc\]/g, 'c');
      const result = classifyRepresentationTopic(input(`${quote}.`));
      assert.equal(result.state, CLASSIFIED, `${rule.id}:${anchor}`);
      assert.equal(result.canonical_value, code, `${rule.id}:${anchor}`);
      assert.equal(result.topic_match_rule_id, rule.id);
      assert.equal(result.model_calls, 0);
    }
  }
});

test('normalisation is match-only and a clean subject can classify without a raw anchor', () => {
  const normalised = classifyRepresentationTopic(input('  DULY\nORGANIZED  '));
  assert.equal(normalised.canonical_value, 'CORPORATE_ORGANISATION');
  const subjectOnly = classifyRepresentationTopic(input('A novel commercial assertion.', { subject: 'Tax matters' }));
  assert.equal(subjectOnly.state, CLASSIFIED);
  assert.equal(subjectOnly.canonical_value, 'TAX');
  assert.equal(subjectOnly.topic_match_rule_id, 'REP_TOPIC_V1_TAX');
  assert.deepEqual(subjectOnly.raw_anchor_matches, []);
  assert.equal(subjectOnly.subject_corroborated, true);
});

test('exclusions and precedence are explicit, while non-hierarchical ties fail closed', () => {
  const maeDefinition = classifyRepresentationTopic(input('Material Adverse Effect means an adverse effect.'));
  assert.equal(maeDefinition.reason, UNCLASSIFIED_REASONS.NO_RAW_ANCHOR);
  const adviserFee = classifyRepresentationTopic(input('The financial advisor fee was disclosed.'));
  assert.equal(adviserFee.reason, UNCLASSIFIED_REASONS.NO_RAW_ANCHOR);
  const specific = classifyRepresentationTopic(input('The Company complies with Environmental Law and has every Permit.'));
  assert.equal(specific.canonical_value, 'ENVIRONMENTAL');
  const financing = classifyRepresentationTopic(input('The Equity Commitment covers all shares of Common Stock.'));
  assert.equal(financing.canonical_value, 'FINANCING');
  const tie = classifyRepresentationTopic(input('The financial statements disclose all liabilities.'));
  assert.equal(tie.state, UNCLASSIFIED);
  assert.equal(tie.reason, UNCLASSIFIED_REASONS.NON_HIERARCHICAL_TIE);
  assert.deepEqual(tie.matched_rule_ids, ['REP_TOPIC_V1_FINANCIAL_REPORTING', 'REP_TOPIC_V1_LIABILITIES']);
  const subjectBreak = classifyRepresentationTopic(input('The financial statements disclose all liabilities.', { subject: 'Financial reporting' }));
  assert.equal(subjectBreak.canonical_value, 'FINANCIAL_REPORTING');
});

test('clean subject and raw topics agree or fail closed on a deterministic conflict', () => {
  const agreement = classifyRepresentationTopic(input('The Company filed every tax return.', { subject: 'Tax matters' }));
  assert.equal(agreement.state, CLASSIFIED);
  assert.equal(agreement.canonical_value, 'TAX');
  assert.equal(agreement.subject_corroborated, true);

  const conflict = classifyRepresentationTopic(input('The Company filed every tax return.', { subject: 'Employee benefits' }));
  assert.equal(conflict.state, UNCLASSIFIED);
  assert.equal(conflict.reason, UNCLASSIFIED_REASONS.SUBJECT_RAW_CONFLICT);
  assert.deepEqual(conflict.matched_rule_ids, ['REP_TOPIC_V1_EMPLOYMENT_BENEFITS', 'REP_TOPIC_V1_TAX']);

  const ambiguousSubject = classifyRepresentationTopic(input('The Company filed every tax return.', { subject: 'Tax and employee benefits' }));
  assert.equal(ambiguousSubject.state, CLASSIFIED);
  assert.equal(ambiguousSubject.canonical_value, 'TAX');
  assert.equal(ambiguousSubject.subject_corroborated, true);
});

test('family, key, clipped, invalid, and multibyte evidence gates return typed abstentions', () => {
  assert.equal(classifyRepresentationTopic(input('duly organized', { family: 'MAE_DEFINITION' })).reason, UNCLASSIFIED_REASONS.WRONG_FAMILY);
  assert.equal(classifyRepresentationTopic(input('duly organized', { generic_claim_key: 'OTHER' })).reason, UNCLASSIFIED_REASONS.WRONG_KEY);
  assert.equal(classifyRepresentationTopic(input('... duly organized', { evidence: { source_text: '... duly organized', spans: [{ absolute_start: 0, absolute_end: 18 }] } })).reason, UNCLASSIFIED_REASONS.CLIPPED_EVIDENCE);
  assert.equal(classifyRepresentationTopic(input('duly organized', { evidence: { source_text: 'wrong', spans: [{ absolute_start: 0, absolute_end: 5 }] } })).reason, UNCLASSIFIED_REASONS.INVALID_EVIDENCE);
  const multibyte = 'é duly organized';
  assert.equal(classifyRepresentationTopic(input(multibyte, { evidence: { source_text: multibyte, spans: [{ absolute_start: 1, absolute_end: Buffer.byteLength(multibyte) }] } })).reason, UNCLASSIFIED_REASONS.INVALID_EVIDENCE);
});

test('registry identity is deterministic and versioned', () => {
  assert.equal(REGISTRY_VERSION, 'REPRESENTATION_TOPIC_REGISTRY/V1');
  assert.match(REGISTRY_DIGEST, /^[a-f0-9]{64}$/);
  assert.equal(classifyRepresentationTopic(input('duly organized')).registry_digest, REGISTRY_DIGEST);
});

test('the registry subject tie-break contract is enforced by the classifier', () => {
  const vocabulary = require('../lib/vocab/resolution/representation-topic-registry');
  assert.deepEqual(vocabulary.SUBJECT_TIE_BREAKS, [
    ['SEC_DISCLOSURE', 'FINANCIAL_REPORTING'],
    ['LIABILITIES', 'FINANCIAL_REPORTING'],
    ['LIABILITIES', 'EMPLOYMENT_BENEFITS'],
  ]);
  const unapproved = classifyRepresentationTopic(input(
    'The Company has real property and material contracts.',
    { subject: 'Real property' },
  ));
  assert.equal(unapproved.state, UNCLASSIFIED);
  assert.equal(unapproved.reason, UNCLASSIFIED_REASONS.NON_HIERARCHICAL_TIE);
  assert.deepEqual(unapproved.matched_rule_ids, [
    'REP_TOPIC_V1_MATERIAL_CONTRACTS',
    'REP_TOPIC_V1_REAL_PROPERTY',
  ]);
});

test('canonical-v2 compatibility module reexports the resolution vocabulary registry exactly', () => {
  const compatibility = require('../lib/canonical-v2/representation-topic-registry');
  const vocabulary = require('../lib/vocab/resolution/representation-topic-registry');
  assert.strictEqual(compatibility, vocabulary);
  assert.equal(vocabulary.VERSION, REGISTRY_VERSION);
  assert.equal(vocabulary.DIGEST, `sha256:${REGISTRY_DIGEST}`);
});

test('recorded replay conserves the exact corpus, exclusions, zero calls, and deterministic write/check output', async () => {
  const replay = await import(`${path.toNamespacedPath(SCRIPT)}?test=${Date.now()}`);
  const ledger = replay.buildRepresentationTopicReplay({ repoRoot: ROOT });
  assert.deepEqual(ledger.conservation, { input_rows: 623, classified_rows: ledger.conservation.classified_rows, unclassified_rows: ledger.conservation.unclassified_rows, total_rows: 623 });
  assert.equal(ledger.conservation.classified_rows + ledger.conservation.unclassified_rows, 623);
  assert.equal(ledger.exclusions.mae_native_limb_rows.actual, 84);
  assert.equal(ledger.exclusions.mae_native_limb_rows.classifier_invoked, false);
  assert.equal(ledger.exclusions.mae_native_limb_rows.unchanged, true);
  assert.equal(ledger.exclusions.mae_native_limb_rows.rows.every((row) => row.classifier_result.state === 'EXCLUDED' && Object.values(row.unchanged_fields).every(Boolean)), true);
  assert.equal(ledger.exclusions.no_other_generic_rows.actual, 6);
  assert.equal(ledger.exclusions.no_other_generic_rows.classifier_invoked, false);
  assert.equal(ledger.exclusions.no_other_generic_rows.unchanged, true);
  assert.equal(ledger.exclusions.no_other_generic_rows.rows.every((row) => row.classifier_result.state === 'EXCLUDED' && Object.values(row.unchanged_fields).every(Boolean)), true);
  assert.deepEqual(ledger.publication, { model_calls: 0, writes_performed: false, serving_activated: false, publication_disposition: 'WITHHELD' });
  assert.equal(ledger.representation_rows.every((row) => row.evidence.utf8_text && row.evidence.utf8_digest && row.registry_digest === REGISTRY_DIGEST), true);
  const write = spawnSync(process.execPath, [SCRIPT, '--write'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(write.status, 0, write.stderr);
  const first = fs.readFileSync(OUTPUT, 'utf8');
  const check = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(fs.readFileSync(OUTPUT, 'utf8'), first);
});
