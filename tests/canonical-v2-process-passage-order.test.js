const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessNarrationOccurrence,
} = require('../lib/canonical-v2/process-narration-occurrence');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const {
  AUTHORITY_LIMITS,
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
  compileProcessPassageOrder,
  validateProcessPassageOrderProjection,
} = require('../lib/canonical-v2/process-passage-order');
const resultContract = require(
  '../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);

const CONTRACT_PAIR = 'a'.repeat(64);
const RELEASE_ID = 'b'.repeat(64);
const RELEASE_PAYLOAD = 'c'.repeat(64);
const QUERY_ID = 'd'.repeat(64);
const NARRATION_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_NARRATION_OCCURRENCE',
  definition_version: 1,
});

function id(label) {
  return contentId('SYNTHETIC_PROCESS_PASSAGE_ORDER_TEST/V1', { label });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function narration({
  label,
  deal = id('deal-a'),
  start,
  documentOrdinal = 0,
  governedOrdinal = start,
}) {
  return buildProcessNarrationOccurrence({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: deal,
    narration_definition_key_and_version: NARRATION_DEFINITION,
    canonical_source_interval_set: {
      coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
      intervals: [{
        admitted_source_occurrence_id: id(`${label}:source`),
        document_hash: id(`${label}:document`),
        document_ordinal: documentOrdinal,
        absolute_start: start,
        absolute_end: start + 20,
        exact_bytes_digest: id(`${label}:bytes`),
      }],
    },
    governed_ordinal: governedOrdinal,
  });
}

function resultIdentity(
  selectedNarration,
  {
    role = 'DIRECT_PREDICATE_WITNESS',
    governedOrdinal = selectedNarration.governed_ordinal,
  } = {},
) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id:
      selectedNarration.governed_deal_admission_id,
    precomputed_process_narration_occurrence_id:
      selectedNarration.process_narration_occurrence_id,
    exact_evidence_role_slot_key: role,
    governed_ordinal: governedOrdinal,
  });
}

function orderingFact({
  label,
  deal = id('deal-a'),
  bidderTrack = id('track-a'),
  start,
  role = 'DIRECT_PREDICATE_WITNESS',
  narrationTreatment = 'SOURCE_LOCAL_PRIMARY_NARRATION',
  documentOrdinal = 0,
  governedOrdinal = start,
  releaseId = RELEASE_ID,
  releasePayload = RELEASE_PAYLOAD,
}) {
  const selectedNarration = narration({
    label,
    deal,
    start,
    documentOrdinal,
    governedOrdinal,
  });
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    result_identity: resultIdentity(selectedNarration, {
      role,
      governedOrdinal,
    }),
    selected_narration_occurrence: selectedNarration,
    bidder_track_id: bidderTrack,
    narration_treatment: narrationTreatment,
    candidate_release_manifest_id: releaseId,
    candidate_release_manifest_payload_digest: releasePayload,
    external_validation_receipt_id: id(`${label}:validation`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_fact_id: contentId(
      PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
      body,
    ),
    result_identity: body.result_identity,
    selected_narration_occurrence:
      body.selected_narration_occurrence,
    bidder_track_id: body.bidder_track_id,
    narration_treatment: body.narration_treatment,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    external_validation_receipt_id:
      body.external_validation_receipt_id,
    validation_state: body.validation_state,
    authority_state: body.authority_state,
  };
}

function compile(facts, pageSize = 10) {
  return compileProcessPassageOrder({
    product_query_definition_id: QUERY_ID,
    candidate_release_manifest_id: RELEASE_ID,
    candidate_release_manifest_payload_digest: RELEASE_PAYLOAD,
    page_size: pageSize,
    ordering_facts: facts,
  });
}

function resultId(fact) {
  return fact.result_identity.process_phrasebook_passage_result_id;
}

test('applies the exact comparator before diversification', () => {
  const directPrimaryLate = orderingFact({
    label: 'direct-primary-late',
    start: 300,
  });
  const directPrimaryEarly = orderingFact({
    label: 'direct-primary-early',
    start: 200,
  });
  const directRetelling = orderingFact({
    label: 'direct-retelling',
    start: 100,
    narrationTreatment: 'LATER_RETELLING',
  });
  const contextualPrimary = orderingFact({
    label: 'contextual-primary',
    start: 50,
    role: 'CONTEXTUAL_EVIDENCE',
  });
  const projection = compile([
    contextualPrimary,
    directRetelling,
    directPrimaryLate,
    directPrimaryEarly,
  ]);

  assert.deepEqual(projection.ordered_result_ids, [
    resultId(directPrimaryEarly),
    resultId(directPrimaryLate),
    resultId(directRetelling),
    resultId(contextualPrimary),
  ]);
  assert.equal(
    projection.comparator_state,
    'GOVERNED_TOTAL_COMPARATOR_APPLIED',
  );
});

test('diversifies by deal and bidder track within each priority tier', () => {
  const dealA = id('deal-a');
  const dealB = id('deal-b');
  const trackA = id('track-a');
  const trackB = id('track-b');
  const a1 = orderingFact({
    label: 'a1',
    deal: dealA,
    bidderTrack: trackA,
    start: 10,
  });
  const a2 = orderingFact({
    label: 'a2',
    deal: dealA,
    bidderTrack: trackA,
    start: 20,
  });
  const a3 = orderingFact({
    label: 'a3',
    deal: dealA,
    bidderTrack: trackB,
    start: 30,
  });
  const b1 = orderingFact({
    label: 'b1',
    deal: dealB,
    bidderTrack: trackA,
    start: 100,
  });
  const projection = compile([a2, b1, a3, a1]);

  assert.deepEqual(projection.ordered_result_ids, [
    resultId(a1),
    resultId(a3),
    resultId(b1),
    resultId(a2),
  ]);
  assert.equal(
    projection.diversification_state,
    'DEAL_AND_BIDDER_TRACK_APPLIED',
  );
});

test('is deterministic, deeply frozen and independent of worker order', () => {
  const facts = [
    orderingFact({ label: 'one', start: 100 }),
    orderingFact({ label: 'two', start: 200 }),
    orderingFact({ label: 'three', start: 300 }),
  ];
  const first = compile(facts);
  const second = compile([...facts].reverse());

  assert.deepEqual(first, second);
  assertDeepFrozen(first);
  assert.equal(validateProcessPassageOrderProjection(first), true);
  assert.deepEqual(first.authority_limits, AUTHORITY_LIMITS);
});

test('returns 8 to 12 results when available and never pads', () => {
  const fifteen = Array.from({ length: 15 }, (_, index) => (
    orderingFact({
      label: `many-${index}`,
      start: 100 + index,
      bidderTrack: id(`track-${index % 3}`),
    })
  ));
  const full = compile(fifteen, 10);
  const short = compile(fifteen.slice(0, 3), 10);
  const empty = compile([], 10);

  assert.equal(full.first_page_result_ids.length, 10);
  assert.equal(new Set(full.first_page_result_ids).size, 10);
  assert.equal(short.first_page_result_ids.length, 3);
  assert.equal(empty.first_page_result_ids.length, 0);
  assert.equal(full.no_padding_or_repetition, true);
  assert.throws(
    () => compile(fifteen, 7),
    { code: 'INVALID_PROCESS_PASSAGE_PAGE_SIZE' },
  );
  assert.throws(
    () => compile(fifteen, 13),
    { code: 'INVALID_PROCESS_PASSAGE_PAGE_SIZE' },
  );
});

test('rejects duplicate results, release drift and narration substitution', () => {
  const fact = orderingFact({ label: 'valid', start: 100 });
  assert.throws(
    () => compile([fact, fact]),
    { code: 'DUPLICATE_PROCESS_PASSAGE_RESULT' },
  );

  const wrongRelease = orderingFact({
    label: 'wrong-release',
    start: 200,
    releaseId: id('wrong-release'),
  });
  assert.throws(
    () => compile([wrongRelease]),
    { code: 'INVALID_PROCESS_PASSAGE_ORDERING_FACT' },
  );

  const substituted = clone(fact);
  substituted.selected_narration_occurrence = narration({
    label: 'substitute',
    start: 300,
  });
  const substitutedBody = clone(substituted);
  delete substitutedBody.ordering_fact_id;
  substituted.ordering_fact_id = contentId(
    PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    substitutedBody,
  );
  assert.throws(
    () => compile([substituted]),
    { code: 'INVALID_PROCESS_PASSAGE_ORDERING_FACT' },
  );
});

test('rejects correctly self-rehashed structural and ranking forgeries', () => {
  const fact = orderingFact({ label: 'valid', start: 100 });
  const extraAuthority = clone(fact);
  extraAuthority.invented_authority = true;
  const factBody = clone(extraAuthority);
  delete factBody.ordering_fact_id;
  extraAuthority.ordering_fact_id = contentId(
    PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
    factBody,
  );
  assert.throws(
    () => compile([extraAuthority]),
    { code: 'INVALID_PROCESS_PASSAGE_ORDERING_FACT' },
  );

  const first = orderingFact({ label: 'first', start: 100 });
  const second = orderingFact({ label: 'second', start: 200 });
  const projection = clone(compile([first, second]));
  projection.ordered_result_ids.reverse();
  projection.first_page_result_ids.reverse();
  const projectionBody = clone(projection);
  delete projectionBody.ordering_projection_id;
  delete projectionBody.canonical_payload_digest;
  projection.ordering_projection_id = contentId(
    PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    projectionBody,
  );
  projection.canonical_payload_digest = sha256Hex(
    Buffer.from(canonicalJson(projectionBody), 'utf8'),
  );
  assert.throws(
    () => validateProcessPassageOrderProjection(projection),
    { code: 'INVALID_PROCESS_PASSAGE_ORDERING_PROJECTION' },
  );
});

test('fails closed if the signed ordering contract changes', () => {
  const original = resultContract.definition.ordering_contract
    .application_memory_can_recreate_ranking_authority;
  resultContract.definition.ordering_contract
    .application_memory_can_recreate_ranking_authority = true;
  try {
    assert.throws(
      () => compile([]),
      { code: 'INVALID_PROCESS_PASSAGE_ORDER_CONTRACT_BINDING' },
    );
  } finally {
    resultContract.definition.ordering_contract
      .application_memory_can_recreate_ranking_authority = original;
  }
});

test('contains no query, source-read, database, serving or UI path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/process-passage-order.js',
    ),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /require\(['"](?:node:)?(?:fs|http|https|net|child_process)['"]\)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|query|execute|render|writeFile|readFile|createClient)\s*\(/,
  );
  assert.doesNotMatch(source, /\b(?:process\.env|supabase|postgres)\b/i);
});
