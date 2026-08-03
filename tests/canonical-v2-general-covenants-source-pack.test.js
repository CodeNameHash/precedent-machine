'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { GENERAL_COVENANT_CODES_V1 } = require('../lib/canonical-v2/contract-bundle');
const { LEXICAL_FAMILY_LEXICON, buildLexicalDisagreementReceipt } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

const SNAPSHOT = path.join(__dirname, '..', 'docs', 'schema-shape', 'normalized-v1.json');

function snapshotSources() {
  const bytes = fs.readFileSync(SNAPSHOT);
  const snapshot = JSON.parse(bytes.toString('utf8'));
  const patterns = new Map(LEXICAL_FAMILY_LEXICON.entries.filter((entry) => GENERAL_COVENANT_CODES_V1.includes(entry.family)).map((entry) => [entry.family, entry.value]));
  return GENERAL_COVENANT_CODES_V1.map((code) => {
    const candidates = snapshot.triples.filter((entry) => entry.ai_metadata?.code === code && entry.evidence_quote);
    const literal = candidates.find((entry) => entry.evidence_quote.toLowerCase().includes(patterns.get(code).toLowerCase())) || candidates[0] || null;
    return { code, literal };
  });
}

test('repository production snapshot is an exhaustive literal General Covenants source pack with an explicit no-evidence disposition', () => {
  const bytes = fs.readFileSync(SNAPSHOT);
  const sources = snapshotSources();
  assert.equal(sources.length, 18);
  assert.equal(sha256Hex(bytes), 'df62de96cb844320a1d5916130095847fba8034646768c6f7d94f55e09476c68');
  for (const { code, literal } of sources) {
    if (code === 'COV-SECREPORT') {
      assert.equal(literal, null, 'no grounded production evidence is explicitly retained as open');
      continue;
    }
    assert.ok(literal, `${code} must retain one literal source record`);
    assert.equal(typeof literal.deal_id, 'string');
    assert.equal(typeof literal.source_provision_id, 'string');
    assert.equal(typeof literal.extracted_at, 'string');
    assert.equal(sha256Hex(Buffer.from(literal.evidence_quote, 'utf8')).length, 64);
  }
});

test('every grounded General Covenants source record produces a complete lexical receipt; COV-SECREPORT stays uncovered', () => {
  for (const { code, literal } of snapshotSources()) {
    if (!literal) continue;
    const bytes = Buffer.from(literal.evidence_quote, 'utf8');
    const receipt = buildLexicalDisagreementReceipt({
      governed_section: { section_ref: literal.source_provision_id, text: literal.evidence_quote, text_sha256: sha256Hex(bytes) },
      candidates: [{ closure_id: literal.id, section_reference: literal.source_provision_id, family: code, evidence: [{ start: 0, end: bytes.length }] }],
    });
    const outcome = receipt.family_outcomes.find((row) => row.family === code);
    assert.equal(outcome.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED', code);
  }
});
