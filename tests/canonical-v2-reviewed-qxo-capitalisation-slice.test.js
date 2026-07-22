const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
  validateQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

const contractBundle = compileFixtureContract();
const capitalText = fs.readFileSync('tests/fixtures/qxo-section-3-1-b.txt', 'utf8');

function digest(label) {
  return contentId('QXO_REVIEWED_CAPITALISATION_TEST/V1', label);
}

function sourceText({ capital = capitalText, condition = QXO_5_2_TEXT, capitalStart = CAPITAL_STRUCTURE_INTERVAL.start } = {}) {
  const chunks = [' '.repeat(capitalStart), capital];
  const afterCapital = capitalStart + Buffer.byteLength(capital, 'utf8');
  if (afterCapital > SECTION_5_2_INTERVAL.start) throw new Error('test source geometry overlaps');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.start - afterCapital), condition);
  const afterCondition = SECTION_5_2_INTERVAL.start + Buffer.byteLength(condition, 'utf8');
  if (afterCondition > SECTION_5_2_INTERVAL.end) throw new Error('test condition exceeds governed interval');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - afterCondition));
  return chunks.join('');
}

function sourceContext(overrides = {}) {
  const text = overrides.text || sourceText(overrides);
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  return Object.freeze({
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: digest('deal-admission'),
    source_ordinal: 0,
    immutable_source_document_id: digest('immutable-source'),
    source_admission_manifest_id: digest('source-admission'),
    semantic_extraction_input_envelope_id: digest('semantic-envelope'),
    source_content_id: digest('source-content'),
    source_occurrence_id: digest('source-occurrence'),
    source_occurrence_key: digest('source-occurrence-key'),
    source_kind: 'ORIGINAL_BYTES',
    document_hash: digest('original-response-bytes'),
    source_byte_length: Buffer.byteLength(text, 'utf8') + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    canonical_text: Object.freeze({
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    }),
    admitted_semantic_source_context_id: digest(`context:${sha256Hex(text)}`),
  });
}

function build(context = sourceContext()) {
  return buildQxoReviewedCapitalisationSlice({ sourceContext: context, contractBundle });
}

test('maps the admitted QXO capitalisation rep and both buyer bring-down tiers deterministically', () => {
  const context = sourceContext();
  const first = build(context);
  const second = build(context);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(validateQxoReviewedCapitalisationSlice({ sourceContext: context, contractBundle, slice: first }), true);
  assert.deepEqual(first.provisions.map((item) => item.concept_key), ['REP-T-CAP', 'COND-B-REP']);
  assert.equal(first.components.length, 5);
  assert.deepEqual(first.accuracyClaims.map((item) => item.canonical_value), [
    'MAT_ALL_RESPECTS_DE_MINIMIS',
    'MAT_ALL_MATERIAL',
  ]);
  assert.equal(first.exceptionClaim.canonical_value, 'DE_MINIMIS_INACCURACIES');
  assert.deepEqual(first.knowledgeClaims.map((item) => item.state), [
    'ABSENT', 'ABSENT', 'ABSENT', 'ABSENT', 'ABSENT',
  ]);
  assert.equal(first.materialityClaims.length, 0);
  assert.equal(contractBundle.claim_definitions.some(
    (item) => item.claim_definition_key === 'MATERIALITY_QUALIFIER',
  ), false);
});

test('binds every provision and limb to the exact governed canonical-text geometry', () => {
  const slice = build();
  const [representation, condition] = slice.provisions;

  assert.deepEqual(
    [representation.absolute_start, representation.absolute_end],
    [CAPITAL_STRUCTURE_INTERVAL.start, CAPITAL_STRUCTURE_INTERVAL.end],
  );
  assert.ok(condition.absolute_start >= SECTION_5_2_INTERVAL.start);
  assert.ok(condition.absolute_end <= SECTION_5_2_INTERVAL.end);
  assert.deepEqual(slice.components.map((item) => item.ordinal), [1, 2, 3, 4, 5]);
  for (let index = 1; index < slice.components.length; index += 1) {
    assert.equal(slice.components[index - 1].absolute_end, slice.components[index].absolute_start);
  }
  assert.equal(slice.components[0].absolute_start, CAPITAL_STRUCTURE_INTERVAL.start + 22);
  assert.equal(slice.components.at(-1).absolute_end, CAPITAL_STRUCTURE_INTERVAL.end);
  assert.match(slice.excerpts.materiality_scrape.exact_text, /disregarding all qualifications/);
  assert.match(slice.excerpts.earlier_date.exact_text, /only as of such date or period\.$/);
});

test('one result composes non-contiguous rep limbs with the exact applicable condition tier', () => {
  const slice = build();
  const [tierB, tierC] = slice.relationships;
  const componentIds = slice.components.map((item) => item.provision_component_id);

  assert.deepEqual(tierB.target_occurrence_ids, [componentIds[0], componentIds[2]]);
  assert.deepEqual(tierC.target_occurrence_ids, [componentIds[1], componentIds[3], componentIds[4]]);
  assert.ok(slice.components[0].absolute_end < slice.components[2].absolute_start);
  assert.ok(slice.components[1].absolute_end < slice.components[3].absolute_start);
  assert.equal(slice.resultInputs.length, 2);
  assert.deepEqual(slice.resultInputs.map((item) => item.relationships[0].relationship_revision_id), [
    tierB.relationship_revision_id,
    tierC.relationship_revision_id,
  ]);
  assert.equal(tierB.effect.exception, 'DE_MINIMIS_INACCURACIES');
  assert.deepEqual(tierB.effect.time_points, [
    'SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE',
  ]);
  assert.deepEqual(tierC.effect.materiality_scrape, {
    applied: true,
    disregarded_qualifiers: ['MATERIAL', 'MATERIALITY', 'COMPANY_MATERIAL_ADVERSE_EFFECT'],
  });
  assert.equal(tierC.effect.exception, null);
});

test('scoped absence is limited to each complete rep limb and never inferred from the condition scrape', () => {
  const slice = build();
  for (const [index, claim] of slice.knowledgeClaims.entries()) {
    const governed = slice.excerpts[`limb_${['i', 'ii', 'iii', 'iv', 'v'][index]}`];
    assert.deepEqual(claim.scope.required_interval_ids, [governed.excerpt_id]);
    assert.deepEqual(claim.scope.examined_interval_ids, [governed.excerpt_id]);
    assert.equal(claim.evidence.length, 0);
  }
  assert.equal(slice.claims.some((item) => item.claim_definition_key === 'MATERIALITY_QUALIFIER'), false);
  assert.equal(slice.relationships[1].evidence.some(
    (item) => item.excerpt_id === slice.excerpts.materiality_scrape.excerpt_id,
  ), true);
});

test('source drift and wrong governed span geometry fail closed before canonical objects are emitted', () => {
  const capitalDrift = sourceContext({ capital: capitalText.replace('250,000,000', '250,000,001') });
  assert.throws(() => build(capitalDrift), /Section 3\.1\(b\) source has drifted/);

  const conditionDrift = sourceContext({
    condition: QXO_5_2_TEXT.replace('except for De Minimis Inaccuracies', 'except for immaterial inaccuracies'),
  });
  assert.throws(() => build(conditionDrift), /Section 5\.2 source has drifted/);

  const wrongSpan = sourceContext({ capitalStart: CAPITAL_STRUCTURE_INTERVAL.start + 1 });
  assert.throws(() => build(wrongSpan), /Section 3\.1\(b\) source has drifted/);

  const altered = structuredClone(build());
  altered.relationships[0].target_occurrence_ids.reverse();
  assert.throws(
    () => validateQxoReviewedCapitalisationSlice({ sourceContext: sourceContext(), contractBundle, slice: altered }),
    /identity or source binding has drifted/,
  );
});
