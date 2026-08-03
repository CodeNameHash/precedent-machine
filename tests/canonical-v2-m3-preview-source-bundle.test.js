'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { RUN_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { RESOLUTION_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  buildM3SourceScopeCertificate,
  buildM3SourceScopeCertificationSet,
  deriveSourceScopePartition,
} = require('../lib/canonical-v2/native-producer/m3-source-scope-certification');
const {
  M3PreviewSourceBundleError,
  REVIEW_FINDING_SCHEMA,
  buildM3PreviewCandidateSetBinding,
  buildM3PreviewSourceBundle,
  validateM3PreviewSourceBundle,
} = require('../lib/canonical-v2/m3-preview-source-bundle');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const digest = (seed) => seed.repeat(64).slice(0, 64);
const APPLICATION_DEAL_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
];

function sourceScope(dealKey, dealAdmissionId, index) {
  const context = buildIdentityAdmittedSourceContext(`Section 1.${index + 1} Fixture.\n`, {
    dealKey,
    dealAdmissionId,
  });
  const runBody = {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: context.document_hash,
    fixture: `bundle-${index}`,
  };
  const runReceipt = { ...runBody, run_receipt_id: contentId(RUN_RECEIPT_SCHEMA, runBody) };
  const resolutionBody = {
    schema_version: RESOLUTION_RECEIPT_SCHEMA,
    run_receipt_id: runReceipt.run_receipt_id,
    document_hash: context.document_hash,
    fixture: `bundle-${index}`,
  };
  const partition = deriveSourceScopePartition({ admitted_source_context: context });
  const certificate = buildM3SourceScopeCertificate({
    admitted_source_context: context,
    run_receipt: runReceipt,
    resolution_receipt: {
      ...resolutionBody,
      resolution_receipt_id: contentId(RESOLUTION_RECEIPT_SCHEMA, resolutionBody),
    },
    dispositions: partition.atomic_units.map((unit) => ({
      start: unit.start,
      end: unit.end,
      disposition: 'EXTRACTED',
      extraction_reference_id: digest(String(index + 1)),
    })),
  });
  return { context, set: buildM3SourceScopeCertificationSet({ admitted_source_contexts: [context], certificates: [certificate] }) };
}

function reviewFinding(seed) {
  const body = {
    schema_version: REVIEW_FINDING_SCHEMA,
    status: 'RESOLVED',
    rationale_digest: digest(seed),
  };
  return { ...body, review_finding_id: contentId(REVIEW_FINDING_SCHEMA, body) };
}

function bundleInput() {
  const contractFingerprint = digest('a');
  const deals = APPLICATION_DEAL_IDS.map((applicationDealId, index) => {
    const governedDealKey = `deal:m3-preview-bundle-${index + 1}`;
    const dealAdmissionId = digest(String(index + 1));
    const candidateId = digest(String(index + 5));
    const scope = sourceScope(governedDealKey, dealAdmissionId, index);
    const sourceAuthority = {
      source_occurrence_id: scope.context.source_occurrence_id,
      source_document_id: digest(String(index + 9)),
      canonical_text_id: scope.context.canonical_text_id,
      evidence_closure_id: digest(String(index + 13)),
    };
    return {
      application_deal_id: applicationDealId,
      governed_deal_key: governedDealKey,
      deal_admission_id: dealAdmissionId,
      candidate_id: candidateId,
      source_scope_certification_set_id: scope.set.m3_source_scope_certification_set_id,
      source_scope_certification_set: scope.set,
      source_authority: [sourceAuthority],
      rows: [{
        row_serving_key: digest(String(index + 17)),
        row_kind: 'CONSIDERATION',
        canonical_value: `Fixture value ${index + 1}`,
        raw_value: null,
        source_occurrence_id: sourceAuthority.source_occurrence_id,
        source_detail_reference_id: digest(String(index + 21)),
        source_document_id: sourceAuthority.source_document_id,
        canonical_text_id: sourceAuthority.canonical_text_id,
        evidence_closure_id: sourceAuthority.evidence_closure_id,
        candidate_id: candidateId,
        claim_revision_id: null,
        classification: 'OPEN_WORLD_CANDIDATE',
        answer_provenance_tag: index === 0 ? 'AI' : 'MECHANICAL',
        review_requirement: index === 0 ? 'REQUIRED' : 'NOT_REQUIRED',
        review_finding: index === 0 ? reviewFinding('b') : null,
        presentation_sidecar: null,
      }],
    };
  });
  return {
    preview_epoch: 'M3_PREVIEW_EPOCH_FIXTURE',
    contract_fingerprint: contractFingerprint,
    candidate_set: buildM3PreviewCandidateSetBinding({
      contract_fingerprint: contractFingerprint,
      candidates: deals.map((deal) => ({
        candidate_id: deal.candidate_id,
        governed_deal_key: deal.governed_deal_key,
        deal_admission_id: deal.deal_admission_id,
      })),
    }),
    deals,
  };
}

test('M3 preview source bundle seals exactly four deals, their candidates, certified source scopes and serving rows', () => {
  const input = bundleInput();
  const first = buildM3PreviewSourceBundle(input);
  const reordered = buildM3PreviewSourceBundle({
    ...input,
    deals: [...input.deals].reverse(),
  });
  assert.equal(first.m3_preview_source_bundle_id, reordered.m3_preview_source_bundle_id);
  assert.equal(first.cohort.application_deal_ids.length, 4);
  assert.equal(first.deals.length, 4);
  assert.equal(first.deals.flatMap((deal) => deal.rows).length, 4);
  assert.equal(validateM3PreviewSourceBundle(first), true);
  assert.ok(Object.isFrozen(first));
});

test('M3 preview source bundle fails closed for cohort, candidate, scope, row and review drift', () => {
  const cases = [
    ['missing deal', (input) => { input.deals.pop(); }, 'INVALID_COHORT'],
    ['extra deal', (input) => { input.deals.push(structuredClone(input.deals[0])); }, 'INVALID_COHORT'],
    ['ambiguous application mapping', (input) => { input.deals[1].application_deal_id = input.deals[0].application_deal_id; }, 'DUPLICATE_APPLICATION_DEAL_ID'],
    ['changed governed mapping', (input) => { input.deals[1].governed_deal_key = input.deals[0].governed_deal_key; }, 'SOURCE_SCOPE_DRIFT'],
    ['candidate set drift', (input) => { input.candidate_set = buildM3PreviewCandidateSetBinding({ contract_fingerprint: input.contract_fingerprint, candidates: input.candidate_set.candidates.slice(1) }); }, 'CANDIDATE_SET_DRIFT'],
    ['source scope set identity drift', (input) => { input.deals[0].source_scope_certification_set_id = digest('f'); }, 'SOURCE_SCOPE_DRIFT'],
    ['source scope drift', (input) => { input.deals[0].source_authority[0].canonical_text_id = digest('f'); }, 'SOURCE_SCOPE_DRIFT'],
    ['unbound row', (input) => { input.deals[0].rows[0].source_document_id = digest('e'); }, 'UNBOUND_SERVING_ROW'],
    ['duplicate row identity', (input) => { input.deals[1].rows[0].row_serving_key = input.deals[0].rows[0].row_serving_key; }, 'DUPLICATE_ROW_SERVING_KEY'],
    ['open review finding', (input) => { input.deals[0].rows[0].review_finding.status = 'OPEN'; }, 'INVALID_REVIEW_FINDING'],
  ];
  for (const [name, mutate, code] of cases) {
    const input = structuredClone(bundleInput());
    mutate(input);
    assert.throws(
      () => buildM3PreviewSourceBundle(input),
      (error) => error instanceof M3PreviewSourceBundleError && error.code === code,
      name,
    );
  }
});

test('M3 preview source bundle validator rejects changed sealed identities and closed-contract extras', () => {
  const bundle = structuredClone(buildM3PreviewSourceBundle(bundleInput()));
  bundle.m3_preview_source_bundle_id = digest('f');
  assert.throws(
    () => validateM3PreviewSourceBundle(bundle),
    (error) => error instanceof M3PreviewSourceBundleError && error.code === 'BUNDLE_IDENTITY_MISMATCH',
  );
  const extra = structuredClone(buildM3PreviewSourceBundle(bundleInput()));
  extra.deals[0].rows[0].fallback = 'forbidden';
  assert.throws(
    () => validateM3PreviewSourceBundle(extra),
    (error) => error instanceof M3PreviewSourceBundleError && error.code === 'INVALID_SERVING_ROW',
  );
});
