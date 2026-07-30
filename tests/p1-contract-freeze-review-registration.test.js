const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../lib/programme-gates/bytes');
const {
  AUTHENTICATED_RESULT_DOMAIN,
  AUTHENTICATED_RESULT_ID_DOMAIN,
  ContractFreezeReviewRegistrationError,
  REGISTRATION_DOMAIN,
  REGISTRATION_ID_DOMAIN,
  RESULT_PAYLOAD_DOMAIN,
  verifyP1ContractFreezeReviewRegistration,
} = require('../lib/programme-gates/contract-freeze-review-registration');
const { TRUSTED_PUBLIC_KEY_REGISTRY } = require('../lib/programme-gates/registry');
const { checkAllowlist } = require('../scripts/ci/check-allowlist');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const LANES = [
  'SEMANTIC_QUESTION_CATALOGUE_REVIEW',
  'COMPOSITION_CATALOGUE_REVIEW',
  'SEMANTIC_AND_IDENTITY_DIFF_REVIEW',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unsigned(value, field) {
  const { [field]: ignored, ...payload } = value;
  void ignored;
  return payload;
}

function sign(privateKey, domain, payload) {
  return crypto.sign(null, signatureBytes({
    domain,
    role: 'REVIEW_CONTROLLER',
    payload,
  }), privateKey).toString('base64');
}

function makeAuthority() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privateKey,
    authority: {
      keyRegistry: {
        schema_version: 'TrustedProgrammeGatePublicKeys/V1',
        registry_state: 'ACTIVE',
        keys: [{
          key_id: 'P1_TEST_REVIEW_CONTROLLER',
          algorithm: 'Ed25519',
          public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
          permitted_roles: ['REVIEW_CONTROLLER'],
          permitted_domains: [REGISTRATION_DOMAIN, AUTHENTICATED_RESULT_DOMAIN],
          valid_from: '2020-01-01T00:00:00.000Z',
          valid_until: '2030-01-01T00:00:00.000Z',
          revoked_at: null,
        }],
      },
      verificationTime: '2026-07-30T12:00:00.000Z',
    },
  };
}

function makeSignedSet() {
  const { privateKey, authority } = makeAuthority();
  const request = {
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    request_input: {
      exact_review_package_fingerprint: digest('package-fingerprint'),
      code_commit: 'a'.repeat(40),
      frozen_contract_pair_digest: digest('frozen-pair'),
      source_closure_identity: { contract_freeze_attestation_id: digest('attestation') },
    },
    tasks: LANES.map((lane, index) => ({
      lane_id: lane,
      task_id: `p1-task-${index + 1}`,
      exact_review_input: { exact_review_package_payload_digest: digest('package-bytes') },
      reviewer_binding: {
        reviewer_role: `INDEPENDENT_${index + 1}_REVIEWER`,
        reviewer_principal_id: `reviewer-principal-${index + 1}`,
        reviewer_identity: `reviewer-${index + 1}@example.invalid`,
        reviewer_model_identifier: 'gpt-5.6-sol',
        reasoning_level: 'high',
        reviewer_source_control_identity_set: [`reviewer-${index + 1}@example.invalid`],
        reviewer_eligibility_digest: digest(`eligibility-${index + 1}`),
        review_disposition_id: digest(`disposition-${index + 1}`),
        independence_binding: {
          immutable_session_id: `immutable-session-${index + 1}`,
          source_control_authorship_event_set_root: digest(`ancestry-${index + 1}`),
        },
      },
    })),
  };
  const results = request.tasks.map((task) => ({
    task_id: task.task_id,
    lane_id: task.lane_id,
    disposition: 'PASS',
    findings: [],
  }));
  const commitments = request.tasks.map((task, index) => ({
    schema_version: 'P1ContractFreezeAuthenticatedResult/V1',
    registration_id: digest('registration-placeholder'),
    lane_id: task.lane_id,
    task_id: task.task_id,
    result_payload_digest: domainDigest(RESULT_PAYLOAD_DOMAIN, results[index]),
    authenticated_result_digest: domainDigest(AUTHENTICATED_RESULT_ID_DOMAIN, {
      lane_id: task.lane_id,
      task_id: task.task_id,
      result_payload_digest: domainDigest(RESULT_PAYLOAD_DOMAIN, results[index]),
    }),
    controller_key_id: 'P1_TEST_REVIEW_CONTROLLER',
    signature_algorithm: 'Ed25519',
    controller_signature: '',
  }));
  const registration = {
    schema_version: 'P1ContractFreezeReviewRegistration/V1',
    registration_id: '',
    gate_id: request.gate_id,
    exact_review_package_fingerprint: request.request_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest: request.tasks[0].exact_review_input.exact_review_package_payload_digest,
    code_commit: request.request_input.code_commit,
    frozen_contract_pair_digest: request.request_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id:
      request.request_input.source_closure_identity.contract_freeze_attestation_id,
    ordered_task_ids: request.tasks.map((task) => task.task_id),
    lanes: request.tasks.map((task, index) => ({
      lane_id: task.lane_id,
      task_id: task.task_id,
      reviewer_role: task.reviewer_binding.reviewer_role,
      reviewer_principal_id: task.reviewer_binding.reviewer_principal_id,
      reviewer_identity: task.reviewer_binding.reviewer_identity,
      reviewer_model_identifier: task.reviewer_binding.reviewer_model_identifier,
      reasoning_level: task.reviewer_binding.reasoning_level,
      reviewer_source_control_identity_set:
        task.reviewer_binding.reviewer_source_control_identity_set,
      immutable_session_id: task.reviewer_binding.independence_binding.immutable_session_id,
      reviewer_eligibility_digest: task.reviewer_binding.reviewer_eligibility_digest,
      source_control_authorship_event_set_root:
        task.reviewer_binding.independence_binding.source_control_authorship_event_set_root,
      review_disposition_id: task.reviewer_binding.review_disposition_id,
      expected_authenticated_result_digest: commitments[index].authenticated_result_digest,
    })),
    controller_key_id: 'P1_TEST_REVIEW_CONTROLLER',
    signature_algorithm: 'Ed25519',
    controller_signature: '',
  };
  const { registration_id: ignoredId, controller_signature: ignoredSignature, ...identity } = registration;
  void ignoredId;
  void ignoredSignature;
  registration.registration_id = domainDigest(REGISTRATION_ID_DOMAIN, identity);
  registration.controller_signature = sign(
    privateKey,
    REGISTRATION_DOMAIN,
    unsigned(registration, 'controller_signature'),
  );
  commitments.forEach((carrier) => {
    carrier.registration_id = registration.registration_id;
    carrier.controller_signature = sign(
      privateKey,
      AUTHENTICATED_RESULT_DOMAIN,
      unsigned(carrier, 'controller_signature'),
    );
  });
  return { authority, authenticatedResults: commitments, registration, request, results };
}

function expectCode(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error instanceof ContractFreezeReviewRegistrationError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test('rejects self-authored authority and uses only the protected P1 signer domains', () => {
  const sample = makeSignedSet();
  expectCode('P1_UNTRUSTED_REVIEW_REGISTRATION_AUTHORITY', () => (
    verifyP1ContractFreezeReviewRegistration(sample)
  ));

  const reviewControllerKey = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find(
    (key) => key.key_id === 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
  );
  assert.deepEqual(
    reviewControllerKey.permitted_domains,
    [
      'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
      'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      REGISTRATION_DOMAIN,
      AUTHENTICATED_RESULT_DOMAIN,
    ],
  );

  const protectedInventory = clone(sample);
  protectedInventory.authority.keyRegistry = clone(TRUSTED_PUBLIC_KEY_REGISTRY);
  protectedInventory.registration.controller_key_id =
    'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07';
  const {
    registration_id: ignoredId,
    controller_signature: ignoredSignature,
    ...identity
  } = protectedInventory.registration;
  void ignoredId;
  void ignoredSignature;
  protectedInventory.registration.registration_id = domainDigest(
    REGISTRATION_ID_DOMAIN,
    identity,
  );
  expectCode('P1_SIGNED_REVIEW_REGISTRATION_SIGNATURE_INVALID', () => (
    verifyP1ContractFreezeReviewRegistration(protectedInventory)
  ));
});

test('the P1 registration allowlist is closed around its owned contract', () => {
  const allowlist = require('../.github/phase-allowlists/wp-p1-contract-freeze-review-registration-v1.json');
  const checked = checkAllowlist({
    phase: allowlist.phase,
    files: allowlist.allowed,
  });
  assert.deepEqual(checked.denied, []);
  assert.deepEqual(checked.outside, []);
  assert.match(allowlist.note, /cannot create that authority/i);
});
