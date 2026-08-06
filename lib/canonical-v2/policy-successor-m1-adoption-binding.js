'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA,
  buildOperationalPolicySetProposal,
  validateOperationalPolicySetProposal,
} = require('./operational-policy-set-proposal');
const {
  CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA,
  buildCertificationPolicyManifestProposal,
  validateCertificationPolicyManifestProposal,
} = require('./certification-policy-manifest-proposal');

const POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA = 'CANONICAL_V2_POLICY_SUCCESSOR_M1_ADOPTION_BINDING/V1';
const POLICY_SET_SCHEMA = 'CANONICAL_V2_POLICY_SET/V2';
const STATUS = 'PROPOSAL_ONLY_BLOCKED_NOT_ADOPTED';
const REQUIRED_MEMBER_KEYS = Object.freeze([
  'certification_policy_manifest_proposal_id',
  'certification_policy_manifest_schema',
  'operational_policy_set_proposal_id',
  'operational_policy_set_schema',
]);
const REQUIRED_BLOCKER_CODES = Object.freeze([
  'EXACT_POLICY_MANIFEST_DIGEST_ADOPTION_REQUIRED',
  'SUCCESSOR_M1_APPROVAL_REQUIRED',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function rejectCallerInput(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length > 0) {
    throw new TypeError('Policy successor-M1 adoption binding derives exact current policy proposals and accepts no caller values.');
  }
}

function policyMembers(operational, certification) {
  return Object.freeze({
    operational_policy_set_schema: operational.schema_version,
    operational_policy_set_proposal_id: operational.operational_policy_set_proposal_id,
    certification_policy_manifest_schema: certification.schema_version,
    certification_policy_manifest_proposal_id: certification.certification_policy_manifest_proposal_id,
  });
}

function policySetDigest(members) {
  return contentId(POLICY_SET_SCHEMA, members);
}

function buildCurrentPolicySuccessorM1AdoptionBinding(options = {}) {
  rejectCallerInput(options);
  const operational = validateOperationalPolicySetProposal(buildOperationalPolicySetProposal());
  const certification = validateCertificationPolicyManifestProposal(buildCertificationPolicyManifestProposal());
  const members = policyMembers(operational, certification);
  const body = {
    schema_version: POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA,
    status: STATUS,
    authority: 'NONE',
    policy_adoption_authority: 'NONE',
    adopted: false,
    policy_set_schema: POLICY_SET_SCHEMA,
    policy_set_digest: policySetDigest(members),
    policy_set_members: members,
    successor_m1_pass_receipt_id: null,
    required_blocker_codes: REQUIRED_BLOCKER_CODES,
  };
  return Object.freeze({
    ...body,
    policy_successor_m1_adoption_binding_id: contentId(POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA, body),
  });
}

function validatePolicySuccessorM1AdoptionBinding(binding) {
  const keys = [
    'adopted', 'authority', 'policy_adoption_authority', 'policy_set_digest', 'policy_set_members',
    'policy_set_schema', 'policy_successor_m1_adoption_binding_id', 'required_blocker_codes',
    'schema_version', 'status', 'successor_m1_pass_receipt_id',
  ];
  if (!exactKeys(binding, keys)
    || binding.schema_version !== POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA
    || binding.status !== STATUS
    || binding.authority !== 'NONE'
    || binding.policy_adoption_authority !== 'NONE'
    || binding.adopted !== false
    || binding.policy_set_schema !== POLICY_SET_SCHEMA
    || binding.successor_m1_pass_receipt_id !== null
    || canonicalJson(binding.required_blocker_codes) !== canonicalJson(REQUIRED_BLOCKER_CODES)
    || !exactKeys(binding.policy_set_members, REQUIRED_MEMBER_KEYS)
    || binding.policy_set_members.operational_policy_set_schema !== OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA
    || binding.policy_set_members.certification_policy_manifest_schema !== CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA
    || !isDigest(binding.policy_set_members.operational_policy_set_proposal_id)
    || !isDigest(binding.policy_set_members.certification_policy_manifest_proposal_id)
    || !isDigest(binding.policy_set_digest)
    || binding.policy_set_digest !== policySetDigest(binding.policy_set_members)) {
    throw new TypeError('Policy successor-M1 adoption binding has an invalid non-authority shape.');
  }
  const { policy_successor_m1_adoption_binding_id: bindingId, ...body } = binding;
  if (!isDigest(bindingId) || bindingId !== contentId(POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA, body)) {
    throw new TypeError('Policy successor-M1 adoption binding does not match its content identity.');
  }
  const expected = buildCurrentPolicySuccessorM1AdoptionBinding();
  if (canonicalJson(binding) !== canonicalJson(expected)) {
    throw new TypeError('Policy successor-M1 adoption binding is stale, partial, forged, or uses a non-current policy schema.');
  }
  return expected;
}

function requireAdoptedPolicySuccessorM1Binding(binding) {
  validatePolicySuccessorM1AdoptionBinding(binding);
  throw new Error('Policy adoption requires an externally verified passed successor M1 receipt. The current binding is proposal-only and grants no authority.');
}

module.exports = {
  POLICY_SET_SCHEMA,
  POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA,
  REQUIRED_BLOCKER_CODES,
  REQUIRED_MEMBER_KEYS,
  STATUS,
  buildCurrentPolicySuccessorM1AdoptionBinding,
  requireAdoptedPolicySuccessorM1Binding,
  validatePolicySuccessorM1AdoptionBinding,
};
