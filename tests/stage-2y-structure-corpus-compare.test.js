'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function files(relativeRoot, suffix) {
  return fs.readdirSync(path.join(ROOT, relativeRoot)).filter((name) => name.endsWith(suffix)).sort()
    .map((name) => readJson(`${relativeRoot}/${name}`));
}

async function auditModule() {
  return import('../scripts/stage-2y-structure-corpus-compare.mjs');
}

test('known-loss ledger accounts for all 244 members and proves each preserved member fact', async () => {
  const { buildKnownLossLedger } = await auditModule();
  const analyses = files(`${BASE}/shadow/m5-correction/analysis`, '.agreement-analysis.json');
  const projections = files(`${BASE}/shadow/m6/projection`, '.agreement-projection.json');
  const ledger = buildKnownLossLedger({
    knownLoss: readJson('evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json'),
    analyses,
    projections,
    combinedDigest: 'test-combined-digest',
  });
  assert.equal(ledger.members.length, 244);
  assert.equal(ledger.counts.verified_fixed, 244);
  assert.equal(ledger.counts.unverified, 0);
  assert.ok(ledger.members.every((entry) => entry.row_id && entry.compound_proposition_id));
});

test('sealed M2 ambiguity ledger accounts for exactly 23 parser ambiguities', async () => {
  const { buildAmbiguityLedger } = await auditModule();
  const ledger = buildAmbiguityLedger({
    indexes: files(`${BASE}/shadow/m2`, '.agreement-index.json'),
    analyses: files(`${BASE}/shadow/m5-correction/analysis`, '.agreement-analysis.json'),
    combinedDigest: 'test-combined-digest',
    programmeRulings: readJson(`${BASE}/control/m5-programme-rulings.json`),
  });
  assert.equal(ledger.members.length, 23);
  assert.ok(ledger.members.every((entry) => entry.source_span
    && entry.parser_reason
    && entry.competing_structures.length === 2
    && entry.reviewed_disposition.startsWith('BEN_APPROVED_')));
});

test('Red Hat ledger accounts for every one of the 69 authored limbs', async () => {
  const { buildRedHatLedger } = await auditModule();
  function parseResponse(section) {
    const response = readJson(`evidence/canonical-v2/redhat-representations-20260808-r1/native-producer-recorded-response-${section}.json`);
    return JSON.parse(response.raw_response_text.replace(/^```json\s*/, '').replace(/```\s*$/, ''));
  }
  const agreementId = '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a';
  const ledger = buildRedHatLedger({
    recordedResponses: [parseResponse('3.01'), parseResponse('3.02')],
    historicalResolution: readJson('evidence/canonical-v2/redhat-representations-20260808-2xl-replay/resolution.json'),
    redHatIndex: readJson(`${BASE}/shadow/m2/${agreementId}.agreement-index.json`),
    redHatAnalysis: readJson(`${BASE}/shadow/m5-correction/analysis/${agreementId}.agreement-analysis.json`),
    combinedDigest: 'test-combined-digest',
  });
  assert.equal(ledger.members.length, 69);
  assert.equal(Object.values(ledger.counts).reduce((sum, value) => sum + value, 0), 69);
  assert.ok(ledger.members.every((entry) => entry.limb_path.length));
});

test('risk-weighted lawyer sample is frozen at 50 and covers all 25 families', async () => {
  const { selectLawyerSample } = await auditModule();
  const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`).family_order_contract.families;
  const makeRow = (family, ordinal, agreementId = 'sealed') => ({
    agreement_id: agreementId,
    citations: [{ exact_text: `Source ${family}` }],
    family_key: family,
    fields: [
      { field_key: 'compact_text', value: `Compact ${family}` },
      { field_key: 'expanded_text', value: `Expanded ${family}` },
      { field_key: 'member_facts', value: [{ analysis_claim_id: `claim-${ordinal}` }] },
    ],
    grouping_decision: ordinal % 2 ? 'SEPARATE_AUTHORED_LEGAL_UNIT' : 'ONE_COMPOUND_PROPOSITION',
    member_analysis_claim_ids: ordinal % 2 ? [`claim-${ordinal}`] : [`claim-${ordinal}`, `claim-${ordinal}-b`],
    row_id: `row-${ordinal}`,
    row_state: 'COMPLETE_COMPARISON_ROW',
    section_reference: String(ordinal),
    source_compound_proposition_id: `proposition-${ordinal}`,
    source_evidence_edge_ids: [`edge-${ordinal}`],
    source_node_occurrence_ids: [`node-${ordinal}`],
    title: family,
  });
  const sealedRows = familyOrder.map((family, index) => makeRow(family.family_key, index));
  for (let index = 25; index < 70; index += 1) sealedRows.push(makeRow(familyOrder[index % 25].family_key, index));
  const additiveRows = ['abbvie-landos', 'lilly-verve', 'rocket-redfin'].map((candidate, index) => ({
    ...makeRow(familyOrder[index].family_key, index + 100, candidate),
    _candidate_key: candidate,
  }));
  const knownLossLedger = {
    members: ['DNO_INDEMNIFICATION', 'MAE_DEFINITION', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP'].map((family, index) => ({
      family_key: family,
      row_id: sealedRows.find((row) => row.family_key === family).row_id,
      ordinal: index,
    })),
  };
  const ambiguityLedger = { members: Array.from({ length: 10 }, (_, index) => ({
    agreement_id: `agreement-${index}`,
    ambiguity_id: `ambiguity-${index}`,
    source_span: { start_byte: index, end_byte: index + 1 },
    parser_reason: 'TEST_REASON',
    competing_structures: ['A', 'B'],
    affected_compound_proposition_ids: [],
    dependent_claim_block: [],
  })) };
  const sample = selectLawyerSample({
    familyOrder,
    sealedRows,
    additiveRows,
    additiveReviews: [],
    ambiguityLedger,
    knownLossLedger,
    samplePolicy: { sample_size: 50 },
  });
  assert.equal(sample.length, 50);
  assert.equal(new Set(sample.filter((entry) => entry.family_key).map((entry) => entry.family_key)).size, 25);
  assert.deepEqual(new Set(sample.filter((entry) => entry.candidate_key).map((entry) => entry.candidate_key)),
    new Set(['abbvie-landos', 'lilly-verve', 'rocket-redfin']));
  assert.ok(sample.some((entry) => entry.item_kind === 'PARSER_AMBIGUITY'));
});

test('review-only volume cannot crowd parser ambiguities out of the lawyer sample', async () => {
  const { selectLawyerSample } = await auditModule();
  const requiredLossFamilies = ['DNO_INDEMNIFICATION', 'MAE_DEFINITION', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP'];
  const familyOrder = [
    ...requiredLossFamilies.map((family_key) => ({ family_key })),
    ...Array.from({ length: 21 }, (_, index) => ({ family_key: `FAMILY_${index}` })),
  ];
  const row = (index) => ({
    agreement_id: `agreement-${index}`,
    citations: [{ exact_text: `Source ${index}` }],
    family_key: familyOrder[index % familyOrder.length].family_key,
    fields: [
      { field_key: 'compact_text', value: `Compact ${index}` },
      { field_key: 'expanded_text', value: `Expanded ${index}` },
      { field_key: 'member_facts', value: [{ analysis_claim_id: `claim-${index}` }] },
    ],
    grouping_decision: 'SEPARATE_AUTHORED_LEGAL_UNIT',
    member_analysis_claim_ids: [`claim-${index}`],
    row_id: `row-${index}`,
    section_reference: String(index),
    source_compound_proposition_id: `proposition-${index}`,
    source_evidence_edge_ids: [`edge-${index}`],
    source_node_occurrence_ids: [`node-${index}`],
    title: `Row ${index}`,
  });
  const reviewOnlyFamily = 'FAMILY_20';
  const sealedRows = Array.from({ length: 70 }, (_, index) => row(index))
    .filter((entry) => entry.family_key !== reviewOnlyFamily);
  const additiveRows = ['abbvie-landos', 'lilly-verve', 'rocket-redfin'].map((candidateKey, index) => ({
    ...row(index + 100),
    _candidate_key: candidateKey,
  }));
  const additiveReviews = Array.from({ length: 30 }, (_, index) => ({
    candidateKey: 'abbvie-landos',
    index,
    review: {
      agreement_id: 'additive',
      family_key: familyOrder[index % familyOrder.length].family_key,
      source_excerpt: `Review source ${index}`,
    },
  }));
  const ambiguityLedger = { members: [{
    agreement_id: 'sealed',
    ambiguity_id: 'required-ambiguity',
    source_span: { start_byte: 1, end_byte: 2 },
    parser_reason: 'TEST_REASON',
    competing_structures: ['A', 'B'],
    affected_compound_proposition_ids: [],
    dependent_claim_block: [],
  }] };
  const knownLossLedger = { members: requiredLossFamilies.map((family_key) => ({
    family_key,
    row_id: sealedRows.find((entry) => entry.family_key === family_key).row_id,
  })) };
  const sample = selectLawyerSample({
    familyOrder,
    sealedRows,
    additiveRows,
    additiveReviews,
    ambiguityLedger,
    knownLossLedger,
    samplePolicy: { sample_size: 50 },
  });
  assert.ok(sample.some((entry) => entry.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW'));
  assert.ok(sample.some((entry) => entry.item_kind === 'PARSER_AMBIGUITY'));
  assert.ok(sample.some((entry) => entry.family_key === reviewOnlyFamily
    && entry.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW'));
});
