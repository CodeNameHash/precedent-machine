'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionInstance,
  buildSemanticSpan,
  buildStructuralProvisionInstance,
} = require('../lib/canonical-v2/source-structure');
const { validateCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');

const EMPTY_COLLECTIONS = Object.freeze([
  'excerpts', 'components', 'condition_groups', 'claims',
  'relationships', 'validated_semantic_graphs', 'open_world_candidates',
  'open_world_candidate_occurrences', 'open_world_evidence_references',
  'open_world_candidate_dispositions', 'open_world_primitives',
  'semantic_impact_closures', 'reviewed_source_specific_rows',
  'incomplete_canonical_result_rows',
]);

function fixture() {
  const contractBundle = compileFixtureContract();
  const source = buildImmutableSource({
    sourceBytes: Buffer.from('Each Share converts into merger consideration.', 'utf8'),
    sourceOccurrenceKey: 'partyless-structural-provision-test',
  });
  const span = buildSemanticSpan(source, 0, utf8ByteLength(source.canonical_text.text));
  const dealKey = 'deal:partyless-structural-provision-test';
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', dealKey);
  const sourceAdmission = buildFixtureSourceAdmission({
    source, dealKey, dealAdmissionId, contractFingerprint: contractBundle.fingerprint,
  });
  return { contractBundle, source, span, dealKey, dealAdmissionId, sourceAdmission };
}

test('a structural factual provision has governed identity without a party sentinel', () => {
  const { contractBundle, source, span } = fixture();
  const provision = buildStructuralProvisionInstance({
    source, span, conceptKey: 'REP-T-CAP', ordinal: 1, contractBundle,
  });
  assert.equal(provision.schema_version, 'STRUCTURAL_PROVISION_INSTANCE/V1');
  assert.equal(Object.hasOwn(provision, 'party'), false);
  assert.match(provision.provision_instance_id, /^[a-f0-9]{64}$/);
});

test('the obligation-bearing provision interface still rejects a missing party', () => {
  const { contractBundle, source, span } = fixture();
  assert.throws(() => buildProvisionInstance({
    source, span, conceptKey: 'REP-T-CAP', ordinal: 1, contractBundle,
  }), /party must be an object/);
});

test('the canonical validator publishes a structural factual provision without weakening V1', () => {
  const { contractBundle, source, span, dealKey, dealAdmissionId, sourceAdmission } = fixture();
  const provision = buildStructuralProvisionInstance({
    source, span, conceptKey: 'REP-T-CAP', ordinal: 1, contractBundle,
  });
  const writeSet = {
    source,
    source_admission: sourceAdmission,
    deal: { deal_key: dealKey, deal_admission_id: dealAdmissionId, document_hash: source.document_hash },
    provisions: [{
      ...provision,
      closure_id: contentId('TEST_STRUCTURAL_PROVISION_CLOSURE/V1', {
        provision_instance_id: provision.provision_instance_id,
      }),
    }],
    ...Object.fromEntries(EMPTY_COLLECTIONS.map((key) => [key, []])),
  };
  const result = validateCanonicalWriteSet(writeSet, contractBundle);
  assert.equal(result.accepted, true);
  assert.equal(result.publishableWriteSet.provisions.length, 1);
});

test('the canonical validator still rejects an obligation-shaped V1 provision without party', () => {
  const { contractBundle, source, span, dealKey, dealAdmissionId, sourceAdmission } = fixture();
  const valid = buildProvisionInstance({
    source,
    span,
    conceptKey: 'REP-T-CAP',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
    ordinal: 1,
    contractBundle,
  });
  const { party: ignored, ...withoutParty } = valid;
  const writeSet = {
    source,
    source_admission: sourceAdmission,
    deal: { deal_key: dealKey, deal_admission_id: dealAdmissionId, document_hash: source.document_hash },
    provisions: [{
      ...withoutParty,
      closure_id: contentId('TEST_OBLIGATION_PROVISION_CLOSURE/V1', {
        provision_instance_id: valid.provision_instance_id,
      }),
    }],
    ...Object.fromEntries(EMPTY_COLLECTIONS.map((key) => [key, []])),
  };
  assert.throws(
    () => validateCanonicalWriteSet(writeSet, contractBundle),
    /fields do not match the structural write contract|party must match/,
  );
});
