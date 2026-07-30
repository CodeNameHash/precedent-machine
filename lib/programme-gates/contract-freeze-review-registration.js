const { domainDigest } = require('./bytes');
const { REGISTRY_DIGESTS } = require('./registry');
const { validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');

const REGISTRATION_VERSION = 'P1ContractFreezeReviewRegistration/V1';
const AUTHENTICATED_RESULT_VERSION = 'P1ContractFreezeAuthenticatedResult/V1';
const CONTROLLER_ROLE = 'REVIEW_CONTROLLER';
const REGISTRATION_DOMAIN =
  'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_REGISTRATION/V1';
const AUTHENTICATED_RESULT_DOMAIN =
  'PROGRAMME_GATE_P1_CONTRACT_FREEZE_AUTHENTICATED_RESULT/V1';
const REGISTRATION_ID_DOMAIN =
  'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_REGISTRATION_ID/V1';
const RESULT_PAYLOAD_DOMAIN =
  'PROGRAMME_GATE_P1_CONTRACT_FREEZE_REVIEW_RESULT_PAYLOAD/V1';
const AUTHENTICATED_RESULT_ID_DOMAIN =
  'PROGRAMME_GATE_P1_CONTRACT_FREEZE_AUTHENTICATED_RESULT_ID/V1';

class ContractFreezeReviewRegistrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContractFreezeReviewRegistrationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractFreezeReviewRegistrationError(code, message);
}

function unsigned(value, signatureField) {
  const { [signatureField]: ignored, ...payload } = value;
  void ignored;
  return payload;
}

function registrationIdentity(registration) {
  const { registration_id: ignored, controller_signature: ignoredSignature, ...identity } = registration;
  void ignored;
  void ignoredSignature;
  return identity;
}

function authenticatedResultCommitment(result) {
  return {
    lane_id: result.lane_id,
    task_id: result.task_id,
    result_payload_digest: result.result_payload_digest,
  };
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireVerificationAuthority(authority) {
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    fail(
      'P1_SIGNED_REVIEW_REGISTRATION_UNAVAILABLE',
      'A trusted controller key registry and verification time are required.',
    );
  }
  if (!authority.keyRegistry || typeof authority.verificationTime === 'undefined') {
    fail(
      'P1_SIGNED_REVIEW_REGISTRATION_UNAVAILABLE',
      'A trusted controller key registry and verification time are required.',
    );
  }
  if (domainDigest(
    'PROGRAMME_GATE_TRUSTED_PUBLIC_KEY_REGISTRY/V1',
    authority.keyRegistry,
  ) !== REGISTRY_DIGESTS.trusted_public_keys) {
    fail(
      'P1_UNTRUSTED_REVIEW_REGISTRATION_AUTHORITY',
      'The P1 registration key registry is not the protected programme signer inventory.',
    );
  }
}

function verifyRegistrationSignature(registration, authority) {
  try {
    verifySignature({
      keyRegistry: authority.keyRegistry,
      keyId: registration.controller_key_id,
      role: CONTROLLER_ROLE,
      domain: REGISTRATION_DOMAIN,
      payload: unsigned(registration, 'controller_signature'),
      signature: registration.controller_signature,
      at: authority.verificationTime,
    });
  } catch (error) {
    const code = /does not permit domain/.test(error.message)
      ? 'P1_SIGNED_REVIEW_REGISTRATION_UNAUTHORISED_DOMAIN'
      : 'P1_SIGNED_REVIEW_REGISTRATION_SIGNATURE_INVALID';
    fail(code, error.message);
  }
}

function verifyResultSignature(result, authority) {
  try {
    verifySignature({
      keyRegistry: authority.keyRegistry,
      keyId: result.controller_key_id,
      role: CONTROLLER_ROLE,
      domain: AUTHENTICATED_RESULT_DOMAIN,
      payload: unsigned(result, 'controller_signature'),
      signature: result.controller_signature,
      at: authority.verificationTime,
    });
  } catch (error) {
    fail('P1_AUTHENTICATED_RESULT_SIGNATURE_INVALID', error.message);
  }
}

function validateRegistration(registration, request, authority) {
  if (!registration) {
    fail(
      'P1_SIGNED_REVIEW_REGISTRATION_UNAVAILABLE',
      'No protected P1 signed review registration was supplied.',
    );
  }
  try {
    validateSchema(REGISTRATION_VERSION, registration);
  } catch (error) {
    const code = registration && typeof registration === 'object'
      && !Object.hasOwn(registration, 'controller_signature')
      ? 'P1_UNSIGNED_REVIEW_REGISTRATION'
      : 'P1_SIGNED_REVIEW_REGISTRATION_INVALID';
    fail(code, error.message);
  }
  if (registration.registration_id !== domainDigest(
    REGISTRATION_ID_DOMAIN,
    registrationIdentity(registration),
  )) {
    fail(
      'P1_REHASHED_REVIEW_REGISTRATION',
      'The registration ID does not derive from its closed unsigned payload.',
    );
  }
  const requestInput = request.request_input;
  const expectedTaskIds = request.tasks.map((task) => task.task_id);
  if (
    registration.gate_id !== request.gate_id
    || registration.exact_review_package_fingerprint
      !== requestInput.exact_review_package_fingerprint
    || registration.exact_review_package_payload_digest
      !== request.tasks[0].exact_review_input.exact_review_package_payload_digest
    || registration.code_commit !== requestInput.code_commit
    || registration.frozen_contract_pair_digest !== requestInput.frozen_contract_pair_digest
    || registration.contract_freeze_attestation_id
      !== requestInput.source_closure_identity.contract_freeze_attestation_id
    || !sameValue(registration.ordered_task_ids, expectedTaskIds)
  ) {
    fail(
      'P1_STALE_REVIEW_REGISTRATION',
      'The signed registration does not bind this exact P1 review request.',
    );
  }
  if (registration.lanes.length !== request.tasks.length) {
    fail(
      'P1_OVERLAPPING_REVIEW_REGISTRATION',
      'The registration must contain exactly one lane for each ordered P1 task.',
    );
  }
  const laneIds = new Set();
  const sessions = new Set();
  const identities = new Set();
  const principals = new Set();
  const dispositions = new Set();
  for (let index = 0; index < request.tasks.length; index += 1) {
    const task = request.tasks[index];
    const lane = registration.lanes[index];
    const binding = task.reviewer_binding;
    if (!lane || lane.lane_id !== task.lane_id || lane.task_id !== task.task_id) {
      fail(
        'P1_STALE_REVIEW_REGISTRATION',
        'The registration lane order or task binding is not exact.',
      );
    }
    const expected = {
      reviewer_role: binding.reviewer_role,
      reviewer_principal_id: binding.reviewer_principal_id,
      reviewer_identity: binding.reviewer_identity,
      reviewer_model_identifier: binding.reviewer_model_identifier,
      reasoning_level: binding.reasoning_level,
      reviewer_source_control_identity_set: binding.reviewer_source_control_identity_set,
      immutable_session_id: binding.independence_binding.immutable_session_id,
      reviewer_eligibility_digest: binding.reviewer_eligibility_digest,
      source_control_authorship_event_set_root:
        binding.independence_binding.source_control_authorship_event_set_root,
      review_disposition_id: binding.review_disposition_id,
    };
    if (Object.entries(expected).some(([key, value]) => !sameValue(lane[key], value))) {
      fail(
        'P1_STALE_REVIEW_REGISTRATION',
        `The registration changed the ${task.lane_id} reviewer binding.`,
      );
    }
    for (const [set, value] of [
      [laneIds, lane.lane_id],
      [sessions, lane.immutable_session_id],
      [identities, lane.reviewer_identity],
      [principals, lane.reviewer_principal_id],
      [dispositions, lane.review_disposition_id],
    ]) {
      if (set.has(value)) {
        fail(
          'P1_OVERLAPPING_REVIEW_REGISTRATION',
          'The registration has overlapping lane reviewer authority.',
        );
      }
      set.add(value);
    }
  }
  verifyRegistrationSignature(registration, authority);
  return registration;
}

function validateAuthenticatedResults({ registration, request, results, authenticatedResults, authority }) {
  if (!Array.isArray(authenticatedResults) || authenticatedResults.length !== results.length) {
    fail(
      'P1_AUTHENTICATED_RESULT_SET_UNAVAILABLE',
      'Exactly one signed authenticated result is required for every P1 lane.',
    );
  }
  const seenLanes = new Set();
  authenticatedResults.forEach((carrier, index) => {
    try {
      validateSchema(AUTHENTICATED_RESULT_VERSION, carrier);
    } catch (error) {
      const code = carrier && typeof carrier === 'object'
        && !Object.hasOwn(carrier, 'controller_signature')
        ? 'P1_UNSIGNED_AUTHENTICATED_RESULT'
        : 'P1_AUTHENTICATED_RESULT_INVALID';
      fail(code, error.message);
    }
    const task = request.tasks[index];
    const result = results[index];
    const lane = registration.lanes[index];
    if (
      carrier.registration_id !== registration.registration_id
      || carrier.lane_id !== task.lane_id
      || carrier.task_id !== task.task_id
      || carrier.controller_key_id !== registration.controller_key_id
      || seenLanes.has(carrier.lane_id)
    ) {
      fail(
        'P1_AUTHENTICATED_RESULT_BINDING_MISMATCH',
        'An authenticated result does not match the signed registration lane.',
      );
    }
    seenLanes.add(carrier.lane_id);
    const resultPayloadDigest = domainDigest(RESULT_PAYLOAD_DOMAIN, result);
    if (carrier.result_payload_digest !== resultPayloadDigest) {
      fail(
        'P1_REHASHED_AUTHENTICATED_RESULT',
        'The authenticated result digest does not bind the supplied result bytes.',
      );
    }
    if (carrier.authenticated_result_digest !== domainDigest(
      AUTHENTICATED_RESULT_ID_DOMAIN,
      authenticatedResultCommitment(carrier),
    )) {
      fail(
        'P1_REHASHED_AUTHENTICATED_RESULT',
        'The authenticated result ID does not derive from its closed payload.',
      );
    }
    if (lane.expected_authenticated_result_digest !== carrier.authenticated_result_digest) {
      fail(
        'P1_STALE_AUTHENTICATED_RESULT',
        'The signed registration did not commit to this authenticated result.',
      );
    }
    verifyResultSignature(carrier, authority);
  });
  return authenticatedResults.length;
}

function verifyP1ContractFreezeReviewRegistration(input) {
  requireVerificationAuthority(input.authority);
  const registration = validateRegistration(input.registration, input.request, input.authority);
  return validateAuthenticatedResults({
    registration,
    request: input.request,
    results: input.results,
    authenticatedResults: input.authenticatedResults,
    authority: input.authority,
  });
}

module.exports = {
  AUTHENTICATED_RESULT_DOMAIN,
  AUTHENTICATED_RESULT_ID_DOMAIN,
  AUTHENTICATED_RESULT_VERSION,
  ContractFreezeReviewRegistrationError,
  REGISTRATION_DOMAIN,
  REGISTRATION_ID_DOMAIN,
  REGISTRATION_VERSION,
  RESULT_PAYLOAD_DOMAIN,
  verifyP1ContractFreezeReviewRegistration,
};
