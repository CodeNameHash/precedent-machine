'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const CALIBRATION_AUTHORITY_SCHEMA = 'CANONICAL_V2_CALIBRATION_AUTHORITY/V1';
// Canonical validation and publication disposition are separate axes.
// VALIDATED/QUARANTINED name validation state, never unattended availability.
const UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA = 'CANONICAL_V2_UNATTENDED_PUBLICATION_DISPOSITION/V1';
const PUBLICATION_DISPOSITION_V2_SCHEMA = 'CANONICAL_V2_PUBLICATION_DISPOSITION/V2';
const PUBLICATION_FAMILY_SWITCH_SCHEMA = 'CANONICAL_V2_PUBLICATION_FAMILY_SWITCH/V1';
const PUBLICATION_RELEASE_RECEIPT_SCHEMA = 'CANONICAL_V2_PUBLICATION_RELEASE_RECEIPT/V1';
const PUBLICATION_ROLLBACK_RECEIPT_SCHEMA = 'CANONICAL_V2_PUBLICATION_ROLLBACK_RECEIPT/V1';
const UNATTENDED_PUBLICATION_DISPOSITIONS = Object.freeze({
  WITHHELD: 'WITHHELD',
  ELIGIBLE: 'ELIGIBLE',
  PUBLISHED: 'PUBLISHED',
});
const CANONICAL_CLAIM_VALIDATION_STATES = Object.freeze({
  VALIDATED: 'VALIDATED',
  QUARANTINED: 'QUARANTINED',
});
// Kept only for the isolated V1 contract below.
const CANONICAL_CLAIM_PUBLICATION_STATES = CANONICAL_CLAIM_VALIDATION_STATES;
const PUBLICATION_DISPOSITION_SCHEMA = UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA;
const PUBLICATION_DISPOSITIONS = UNATTENDED_PUBLICATION_DISPOSITIONS;
const SHA256_RE = /^[a-f0-9]{64}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

class PublicationDispositionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PublicationDispositionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PublicationDispositionError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function isUtf8(value) {
  return typeof value === 'string'
    && Buffer.from(value, 'utf8').toString('utf8') === value;
}

function requireString(value, label) {
  if (!isUtf8(value) || value.trim().length === 0 || value !== value.trim()) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', `${label} must be a non-empty trimmed UTF-8 string.`);
  }
  return value;
}

function requireExactKeys(value, keys, label, code = 'INVALID_CALIBRATION_AUTHORITY_SCHEMA') {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(code, `${label} fields do not match the contract.`);
  }
}

function requireDigest(value, label, code = 'INVALID_CALIBRATION_AUTHORITY_SCHEMA') {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireProbability(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', `${label} must be a finite number from zero through one.`);
  }
  return value;
}

function parseTimestamp(value, label, code = 'INVALID_CALIBRATION_AUTHORITY_SCHEMA') {
  if (!isUtf8(value) || !UTC_TIMESTAMP_RE.test(value)) {
    fail(code, `${label} must be a canonical UTC timestamp.`);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    fail(code, `${label} must be a valid canonical UTC timestamp.`);
  }
  return milliseconds;
}

function normaliseConfidenceInterval(value) {
  requireExactKeys(value, ['confidence_level', 'lower_bound', 'upper_bound'], 'confidence interval');
  requireProbability(value.lower_bound, 'confidence interval lower_bound');
  requireProbability(value.upper_bound, 'confidence interval upper_bound');
  requireProbability(value.confidence_level, 'confidence interval confidence_level');
  if (value.lower_bound > value.upper_bound) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'confidence interval lower_bound must not exceed upper_bound.');
  }
  return clone(value);
}

function normaliseAdjudicators(value) {
  if (!Array.isArray(value) || value.length === 0) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'adjudicators must be a non-empty array.');
  }
  const result = value.map((entry) => {
    requireExactKeys(entry, ['calibration_score', 'identity'], 'adjudicator');
    requireString(entry.identity, 'adjudicator identity');
    requireProbability(entry.calibration_score, 'adjudicator calibration_score');
    return clone(entry);
  }).sort((left, right) => left.identity.localeCompare(right.identity));
  if (new Set(result.map((entry) => entry.identity)).size !== result.length) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'adjudicator identities must be unique.');
  }
  return result;
}

function normaliseFamilySwitches(value, authorityFamily) {
  if (!Array.isArray(value) || value.length === 0) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family_switches must be a non-empty array.');
  }
  const result = value.map((entry) => {
    requireExactKeys(entry, ['claim_kinds', 'enabled', 'family'], 'family switch');
    requireString(entry.family, 'family switch family');
    if (typeof entry.enabled !== 'boolean') {
      fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family switch enabled must be boolean.');
    }
    if (!Array.isArray(entry.claim_kinds) || entry.claim_kinds.length === 0) {
      fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family switch claim_kinds must be a non-empty array.');
    }
    const claimKinds = entry.claim_kinds.map((kind) => requireString(kind, 'family switch claim kind')).sort();
    if (new Set(claimKinds).size !== claimKinds.length) {
      fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family switch claim_kinds must be unique.');
    }
    return { family: entry.family, enabled: entry.enabled, claim_kinds: claimKinds };
  }).sort((left, right) => left.family.localeCompare(right.family));
  if (new Set(result.map((entry) => entry.family)).size !== result.length) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family_switches must contain one entry per family.');
  }
  if (!result.some((entry) => entry.family === authorityFamily)) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'family_switches must include the authority family.');
  }
  return result;
}

function normaliseExpiryDriftRule(value) {
  requireExactKeys(value, ['description', 'mode'], 'expiry_drift_rule');
  if (value.mode !== 'EXACT_BOUND_DIGESTS_AND_TIME_EXPIRY') {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'expiry_drift_rule mode is not recognised.');
  }
  requireString(value.description, 'expiry_drift_rule description');
  return clone(value);
}

function calibrationAuthorityBody(input = {}) {
  requireExactKeys(input, [
    'adjudication_rubric_digest',
    'adjudicators',
    'confidence_interval',
    'corpus_digest',
    'expires_at',
    'expiry_drift_rule',
    'family',
    'family_switches',
    'mechanism',
    'product_approved_false_publication_threshold',
    'prompt_digest',
    'registry_digest',
    'requested_model_digest',
    'resolver_digest',
    'sample_size',
    'selected_rung',
    'source_digest',
    'valid_from',
  ], 'calibration authority');
  const family = requireString(input.family, 'family');
  requireString(input.mechanism, 'mechanism');
  const validFrom = parseTimestamp(input.valid_from, 'valid_from');
  const expiresAt = parseTimestamp(input.expires_at, 'expires_at');
  if (validFrom >= expiresAt) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'valid_from must be before expires_at.');
  }
  const confidenceInterval = normaliseConfidenceInterval(input.confidence_interval);
  const productApprovedFalsePublicationThreshold = requireProbability(
    input.product_approved_false_publication_threshold,
    'product_approved_false_publication_threshold',
  );
  if (confidenceInterval.upper_bound > productApprovedFalsePublicationThreshold) {
    fail(
      'FALSE_PUBLICATION_CONFIDENCE_EXCEEDS_THRESHOLD',
      'confidence interval upper_bound must not exceed product_approved_false_publication_threshold.',
    );
  }
  const body = {
    schema_version: CALIBRATION_AUTHORITY_SCHEMA,
    corpus_digest: requireDigest(input.corpus_digest, 'corpus_digest'),
    source_digest: requireDigest(input.source_digest, 'source_digest'),
    prompt_digest: requireDigest(input.prompt_digest, 'prompt_digest'),
    requested_model_digest: requireDigest(input.requested_model_digest, 'requested_model_digest'),
    registry_digest: requireDigest(input.registry_digest, 'registry_digest'),
    resolver_digest: requireDigest(input.resolver_digest, 'resolver_digest'),
    adjudication_rubric_digest: requireDigest(input.adjudication_rubric_digest, 'adjudication_rubric_digest'),
    family,
    mechanism: input.mechanism,
    selected_rung: requirePositiveInteger(input.selected_rung, 'selected_rung'),
    sample_size: requirePositiveInteger(input.sample_size, 'sample_size'),
    confidence_interval: confidenceInterval,
    adjudicators: normaliseAdjudicators(input.adjudicators),
    valid_from: input.valid_from,
    expires_at: input.expires_at,
    expiry_drift_rule: normaliseExpiryDriftRule(input.expiry_drift_rule),
    product_approved_false_publication_threshold: productApprovedFalsePublicationThreshold,
    family_switches: normaliseFamilySwitches(input.family_switches, family),
  };
  return body;
}

function buildCalibrationAuthority(input = {}) {
  const body = calibrationAuthorityBody(input);
  const canonicalPayloadDigest = sha256Hex(canonicalJson(body));
  return deepFreeze({
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    calibration_authority_id: contentId('CANONICAL_V2_CALIBRATION_AUTHORITY/V1', {
      ...body,
      canonical_payload_digest: canonicalPayloadDigest,
    }),
  });
}

function validateCalibrationAuthority(authority) {
  requireExactKeys(authority, [
    'adjudication_rubric_digest',
    'adjudicators',
    'calibration_authority_id',
    'canonical_payload_digest',
    'confidence_interval',
    'corpus_digest',
    'expires_at',
    'expiry_drift_rule',
    'family',
    'family_switches',
    'mechanism',
    'product_approved_false_publication_threshold',
    'prompt_digest',
    'registry_digest',
    'requested_model_digest',
    'resolver_digest',
    'sample_size',
    'schema_version',
    'selected_rung',
    'source_digest',
    'valid_from',
  ], 'calibration authority');
  if (authority.schema_version !== CALIBRATION_AUTHORITY_SCHEMA) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'calibration authority schema_version is not recognised.');
  }
  requireDigest(authority.canonical_payload_digest, 'canonical_payload_digest');
  requireDigest(authority.calibration_authority_id, 'calibration_authority_id');
  const rebuilt = buildCalibrationAuthority({
    corpus_digest: authority.corpus_digest,
    source_digest: authority.source_digest,
    prompt_digest: authority.prompt_digest,
    requested_model_digest: authority.requested_model_digest,
    registry_digest: authority.registry_digest,
    resolver_digest: authority.resolver_digest,
    adjudication_rubric_digest: authority.adjudication_rubric_digest,
    family: authority.family,
    mechanism: authority.mechanism,
    selected_rung: authority.selected_rung,
    sample_size: authority.sample_size,
    confidence_interval: authority.confidence_interval,
    adjudicators: authority.adjudicators,
    valid_from: authority.valid_from,
    expires_at: authority.expires_at,
    expiry_drift_rule: authority.expiry_drift_rule,
    product_approved_false_publication_threshold: authority.product_approved_false_publication_threshold,
    family_switches: authority.family_switches,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(authority)) {
    fail('INVALID_CALIBRATION_AUTHORITY_SCHEMA', 'calibration authority identity or content is invalid.');
  }
  return true;
}

function claimInput(input) {
  requireExactKeys(input, [
    'adjudication_rubric_digest',
    'canonical_claim_publication_state',
    'claim_kind',
    'corpus_digest',
    'family',
    'mechanism',
    'prompt_digest',
    'registry_digest',
    'requested_model_digest',
    'resolver_digest',
    'risk_signals',
    'selected_rung',
    'source_digest',
  ], 'publication input', 'INVALID_PUBLICATION_INPUT');
  const risk = input.risk_signals;
  requireExactKeys(risk, [
    'definition_ambiguity',
    'model_fallback',
    'party_attribution_risk',
    'structural_uncertainty',
  ], 'publication input risk_signals', 'INVALID_PUBLICATION_INPUT');
  for (const [name, value] of Object.entries(risk)) {
    if (typeof value !== 'boolean') fail('INVALID_PUBLICATION_INPUT', `${name} must be boolean.`);
  }
  if (!Number.isSafeInteger(input.selected_rung) || input.selected_rung < 1) {
    fail('INVALID_PUBLICATION_INPUT', 'selected_rung must be a positive safe integer.');
  }
  const result = clone(input);
  for (const field of ['canonical_claim_publication_state', 'family', 'claim_kind', 'mechanism']) {
    if (!isUtf8(result[field]) || result[field].trim().length === 0 || result[field] !== result[field].trim()) {
      fail('INVALID_PUBLICATION_INPUT', `${field} must be a non-empty trimmed UTF-8 string.`);
    }
  }
  for (const field of [
    'corpus_digest', 'source_digest', 'prompt_digest', 'requested_model_digest',
    'registry_digest', 'resolver_digest', 'adjudication_rubric_digest',
  ]) requireDigest(result[field], field, 'INVALID_PUBLICATION_INPUT');
  return result;
}

function buildDecision({
  disposition,
  authorityId = null,
  reasonCodes,
  priorDecisionId = null,
  priorEligibleDecision = null,
}) {
  const body = {
    schema_version: UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA,
    disposition,
    authority_id: authorityId,
    reason_codes: [...reasonCodes].sort(),
    prior_decision_id: priorDecisionId,
    prior_eligible_decision: priorEligibleDecision === null ? null : clone(priorEligibleDecision),
  };
  return deepFreeze({
    ...body,
    decision_id: contentId(UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA, body),
  });
}

function evaluatePublicationDisposition({ calibration_authority: authority, publication_input: input, evaluation_time: evaluationTime } = {}) {
  if (!authority) {
    return buildDecision({
      disposition: PUBLICATION_DISPOSITIONS.WITHHELD,
      reasonCodes: ['MISSING_CALIBRATION_AUTHORITY'],
    });
  }
  try {
    validateCalibrationAuthority(authority);
  } catch (error) {
    if (error instanceof PublicationDispositionError) {
      return buildDecision({
        disposition: PUBLICATION_DISPOSITIONS.WITHHELD,
        reasonCodes: [error.code === 'FALSE_PUBLICATION_CONFIDENCE_EXCEEDS_THRESHOLD'
          ? error.code
          : 'INVALID_CALIBRATION_AUTHORITY'],
      });
    }
    throw error;
  }
  let claim;
  try {
    claim = claimInput(input);
    parseTimestamp(evaluationTime, 'evaluation_time', 'INVALID_PUBLICATION_INPUT');
  } catch (error) {
    if (error instanceof PublicationDispositionError) {
      return buildDecision({
        disposition: PUBLICATION_DISPOSITIONS.WITHHELD,
        authorityId: authority.calibration_authority_id,
        reasonCodes: ['INVALID_PUBLICATION_INPUT'],
      });
    }
    throw error;
  }

  const reasons = [];
  const evaluatedAt = parseTimestamp(evaluationTime, 'evaluation_time', 'INVALID_PUBLICATION_INPUT');
  const validFrom = parseTimestamp(authority.valid_from, 'valid_from');
  const expiresAt = parseTimestamp(authority.expires_at, 'expires_at');
  if (evaluatedAt < validFrom) reasons.push('AUTHORITY_NOT_YET_VALID');
  if (evaluatedAt >= expiresAt) reasons.push('AUTHORITY_EXPIRED');

  const digests = [
    'corpus_digest', 'source_digest', 'prompt_digest', 'requested_model_digest',
    'registry_digest', 'resolver_digest', 'adjudication_rubric_digest',
  ];
  if (digests.some((field) => claim[field] !== authority[field])) reasons.push('AUTHORITY_DIGEST_MISMATCH');
  if (claim.mechanism !== authority.mechanism || claim.selected_rung !== authority.selected_rung) {
    reasons.push('AUTHORITY_BINDING_MISMATCH');
  }
  if (authority.confidence_interval.upper_bound > authority.product_approved_false_publication_threshold) {
    reasons.push('FALSE_PUBLICATION_CONFIDENCE_EXCEEDS_THRESHOLD');
  }
  if (claim.canonical_claim_publication_state === CANONICAL_CLAIM_PUBLICATION_STATES.QUARANTINED) {
    reasons.push('CANONICAL_CLAIM_QUARANTINED');
  } else if (claim.canonical_claim_publication_state !== CANONICAL_CLAIM_PUBLICATION_STATES.VALIDATED) {
    reasons.push('UNKNOWN_CANONICAL_CLAIM_PUBLICATION_STATE');
  }
  const familySwitch = authority.family_switches.find((entry) => entry.family === claim.family);
  if (!familySwitch || claim.family !== authority.family) reasons.push('UNKNOWN_FAMILY');
  if (familySwitch && !familySwitch.claim_kinds.includes(claim.claim_kind)) reasons.push('UNKNOWN_CLAIM_KIND');
  if (familySwitch && !familySwitch.enabled) reasons.push('FAMILY_DISABLED');
  if (claim.risk_signals.structural_uncertainty) reasons.push('STRUCTURAL_UNCERTAINTY');
  if (claim.risk_signals.definition_ambiguity) reasons.push('DEFINITION_AMBIGUITY');
  if (claim.risk_signals.model_fallback) reasons.push('MODEL_FALLBACK');
  if (claim.risk_signals.party_attribution_risk) reasons.push('PARTY_ATTRIBUTION_RISK');

  return buildDecision({
    disposition: reasons.length === 0 ? PUBLICATION_DISPOSITIONS.ELIGIBLE : PUBLICATION_DISPOSITIONS.WITHHELD,
    authorityId: authority.calibration_authority_id,
    reasonCodes: reasons.length === 0 ? ['CALIBRATION_AUTHORITY_MATCHED'] : reasons,
  });
}

function validatePublicationDispositionDecision(decision) {
  requireExactKeys(decision, [
    'authority_id', 'decision_id', 'disposition', 'prior_decision_id', 'prior_eligible_decision', 'reason_codes', 'schema_version',
  ], 'publication disposition decision', 'INVALID_PUBLICATION_DECISION');
  if (decision.schema_version !== UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA
    || !Object.values(UNATTENDED_PUBLICATION_DISPOSITIONS).includes(decision.disposition)
    || !Array.isArray(decision.reason_codes) || decision.reason_codes.length === 0
    || decision.reason_codes.some((code) => !isUtf8(code) || code.trim().length === 0)
    || new Set(decision.reason_codes).size !== decision.reason_codes.length
    || canonicalJson(decision.reason_codes) !== canonicalJson([...decision.reason_codes].sort())) {
    fail('INVALID_PUBLICATION_DECISION', 'publication disposition decision has an invalid schema.');
  }
  if (decision.authority_id !== null) requireDigest(decision.authority_id, 'authority_id', 'INVALID_PUBLICATION_DECISION');
  if (decision.prior_decision_id !== null) requireDigest(decision.prior_decision_id, 'prior_decision_id', 'INVALID_PUBLICATION_DECISION');
  requireDigest(decision.decision_id, 'decision_id', 'INVALID_PUBLICATION_DECISION');
  if (decision.disposition === UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED) {
    if (!decision.authority_id || !decision.prior_decision_id
      || canonicalJson(decision.reason_codes) !== canonicalJson(['EXPLICIT_UNATTENDED_PUBLICATION_TRANSITION'])
      || !decision.prior_eligible_decision) {
      fail('INVALID_PUBLICATION_DECISION', 'PUBLISHED requires an explicit eligible transition.');
    }
    validatePublicationDispositionDecision(decision.prior_eligible_decision);
    if (decision.prior_eligible_decision.disposition !== UNATTENDED_PUBLICATION_DISPOSITIONS.ELIGIBLE
      || decision.prior_eligible_decision.decision_id !== decision.prior_decision_id
      || decision.prior_eligible_decision.authority_id !== decision.authority_id) {
      fail('INVALID_PUBLICATION_DECISION', 'PUBLISHED must bind the eligible decision it transitions from.');
    }
  } else if (decision.prior_decision_id !== null || decision.prior_eligible_decision !== null) {
    fail('INVALID_PUBLICATION_DECISION', 'only PUBLISHED may carry a prior eligible decision.');
  }
  if (decision.disposition === UNATTENDED_PUBLICATION_DISPOSITIONS.ELIGIBLE
    && (!decision.authority_id
      || canonicalJson(decision.reason_codes) !== canonicalJson(['CALIBRATION_AUTHORITY_MATCHED']))) {
    fail('INVALID_PUBLICATION_DECISION', 'ELIGIBLE requires a matched calibration authority.');
  }
  if (decision.disposition === UNATTENDED_PUBLICATION_DISPOSITIONS.WITHHELD
    && decision.reason_codes.includes('CALIBRATION_AUTHORITY_MATCHED')) {
    fail('INVALID_PUBLICATION_DECISION', 'WITHHELD cannot carry an eligibility reason.');
  }
  const rebuilt = buildDecision({
    disposition: decision.disposition,
    authorityId: decision.authority_id,
    reasonCodes: decision.reason_codes,
    priorDecisionId: decision.prior_decision_id,
    priorEligibleDecision: decision.prior_eligible_decision,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(decision)) {
    fail('INVALID_PUBLICATION_DECISION', 'publication disposition decision identity is invalid.');
  }
  return true;
}

function transitionUnattendedPublicationDisposition({ decision, target_disposition: targetDisposition } = {}) {
  validatePublicationDispositionDecision(decision);
  if (targetDisposition !== UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED) {
    fail('ILLEGAL_PUBLICATION_DISPOSITION_TRANSITION', 'only the explicit transition to PUBLISHED is supported.');
  }
  if (decision.disposition !== UNATTENDED_PUBLICATION_DISPOSITIONS.ELIGIBLE) {
    fail('ILLEGAL_PUBLICATION_DISPOSITION_TRANSITION', 'only ELIGIBLE may transition to PUBLISHED.');
  }
  return buildDecision({
    disposition: UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED,
    authorityId: decision.authority_id,
    reasonCodes: ['EXPLICIT_UNATTENDED_PUBLICATION_TRANSITION'],
    priorDecisionId: decision.decision_id,
    priorEligibleDecision: decision,
  });
}

function requireNullableDigest(value, label, code = 'INVALID_PUBLICATION_DISPOSITION') {
  if (value === null) return null;
  return requireDigest(value, label, code);
}

function publicationInputDigest({ publicationInput, canonicalValidationState, evaluationTime }) {
  return sha256Hex(canonicalJson({
    publication_input: publicationInput === undefined ? null : publicationInput,
    canonical_validation_state: canonicalValidationState,
    evaluated_at: evaluationTime,
  }));
}

function v2DecisionBody({
  claimRevisionId,
  runReceiptId,
  resolutionReceiptId,
  reviewQueueArtifactId = null,
  publicationInput,
  canonicalValidationState,
  evaluatedAt,
  authority,
}) {
  requireDigest(claimRevisionId, 'claim_revision_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireDigest(runReceiptId, 'run_receipt_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireDigest(resolutionReceiptId, 'resolution_receipt_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireNullableDigest(reviewQueueArtifactId, 'review_queue_artifact_id');
  parseTimestamp(evaluatedAt, 'evaluated_at', 'INVALID_PUBLICATION_DISPOSITION');
  const input = publicationInput || {};
  const validationState = canonicalValidationState || input.canonical_validation_state
    || input.canonical_claim_publication_state || CANONICAL_CLAIM_VALIDATION_STATES.QUARANTINED;
  const v1Input = publicationInput && (() => {
    const { canonical_validation_state: _ignoredValidationState, ...rest } = publicationInput;
    return { ...rest, canonical_claim_publication_state: validationState };
  })();
  const evaluated = evaluatePublicationDisposition({
    calibration_authority: authority,
    publication_input: v1Input,
    evaluation_time: evaluatedAt,
  });
  // A V2 record is deliberately unable to mint PUBLISHED. That transition
  // needs a future immutable release receipt and revalidation.
  if (evaluated.disposition === UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED) {
    fail('PUBLISHED_TRANSITION_NOT_IMPLEMENTED', 'Stage 2Y-0A cannot create PUBLISHED decisions.');
  }
  return {
    schema_version: PUBLICATION_DISPOSITION_V2_SCHEMA,
    claim_revision_id: claimRevisionId,
    run_receipt_id: runReceiptId,
    resolution_receipt_id: resolutionReceiptId,
    review_queue_artifact_id: reviewQueueArtifactId,
    publication_input_digest: publicationInputDigest({
      publicationInput: v1Input,
      canonicalValidationState: validationState,
      evaluationTime: evaluatedAt,
    }),
    canonical_validation_state: validationState,
    family: typeof input.family === 'string' ? input.family : 'UNKNOWN',
    claim_kind: typeof input.claim_kind === 'string' ? input.claim_kind : 'UNKNOWN',
    mechanism: typeof input.mechanism === 'string' ? input.mechanism : 'UNKNOWN',
    selected_rung: Number.isSafeInteger(input.selected_rung) ? input.selected_rung : 1,
    risk_signals: input.risk_signals || {
      structural_uncertainty: true,
      definition_ambiguity: true,
      model_fallback: true,
      party_attribution_risk: true,
    },
    evaluated_at: evaluatedAt,
    authority_id: evaluated.authority_id,
    disposition: evaluated.disposition,
    reason_codes: evaluated.reason_codes,
    prior_eligible_decision_id: null,
    prior_eligible_decision: null,
  };
}

function buildPublicationDispositionV2(args = {}) {
  const body = v2DecisionBody({
    claimRevisionId: args.claim_revision_id,
    runReceiptId: args.run_receipt_id,
    resolutionReceiptId: args.resolution_receipt_id,
    reviewQueueArtifactId: args.review_queue_artifact_id === undefined ? null : args.review_queue_artifact_id,
    publicationInput: args.publication_input,
    canonicalValidationState: args.canonical_validation_state,
    evaluatedAt: args.evaluated_at,
    authority: args.calibration_authority,
  });
  return deepFreeze({
    ...body,
    decision_id: contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, body),
  });
}

function validatePublicationDispositionV2Identity(decision) {
  requireExactKeys(decision, [
    'authority_id', 'canonical_validation_state', 'claim_kind', 'claim_revision_id',
    'decision_id', 'disposition', 'evaluated_at', 'family', 'mechanism',
    'prior_eligible_decision', 'prior_eligible_decision_id', 'publication_input_digest',
    'reason_codes', 'resolution_receipt_id', 'review_queue_artifact_id', 'risk_signals',
    'run_receipt_id', 'schema_version', 'selected_rung',
  ], 'publication disposition V2', 'INVALID_PUBLICATION_DISPOSITION');
  if (decision.schema_version !== PUBLICATION_DISPOSITION_V2_SCHEMA) {
    fail('INVALID_PUBLICATION_DISPOSITION', 'publication disposition V2 has an invalid schema version.');
  }
  if (decision.disposition === UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED) {
    fail('PUBLISHED_TRANSITION_NOT_IMPLEMENTED', 'Stage 2Y-0A does not accept PUBLISHED decisions.');
  }
  requireDigest(decision.claim_revision_id, 'claim_revision_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireDigest(decision.run_receipt_id, 'run_receipt_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireDigest(decision.resolution_receipt_id, 'resolution_receipt_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireNullableDigest(decision.review_queue_artifact_id, 'review_queue_artifact_id');
  requireDigest(decision.publication_input_digest, 'publication_input_digest', 'INVALID_PUBLICATION_DISPOSITION');
  requireDigest(decision.decision_id, 'decision_id', 'INVALID_PUBLICATION_DISPOSITION');
  requireNullableDigest(decision.authority_id, 'authority_id');
  parseTimestamp(decision.evaluated_at, 'evaluated_at', 'INVALID_PUBLICATION_DISPOSITION');
  if (!Object.values(CANONICAL_CLAIM_VALIDATION_STATES).includes(decision.canonical_validation_state)
    || !Number.isSafeInteger(decision.selected_rung) || decision.selected_rung < 1
    || !['family', 'claim_kind', 'mechanism'].every((field) => isUtf8(decision[field])
      && decision[field].trim().length > 0 && decision[field] === decision[field].trim())
    || decision.prior_eligible_decision_id !== null || decision.prior_eligible_decision !== null
    || !Array.isArray(decision.reason_codes) || decision.reason_codes.length === 0
    || decision.reason_codes.some((code) => !isUtf8(code) || code.trim().length === 0)
    || new Set(decision.reason_codes).size !== decision.reason_codes.length
    || canonicalJson(decision.reason_codes) !== canonicalJson([...decision.reason_codes].sort())) {
    fail('INVALID_PUBLICATION_DISPOSITION', 'publication disposition V2 has an invalid immutable trace.');
  }
  requireExactKeys(decision.risk_signals, [
    'definition_ambiguity', 'model_fallback', 'party_attribution_risk', 'structural_uncertainty',
  ], 'publication disposition V2 risk_signals', 'INVALID_PUBLICATION_DISPOSITION');
  if (Object.values(decision.risk_signals).some((value) => typeof value !== 'boolean')) {
    fail('INVALID_PUBLICATION_DISPOSITION', 'publication disposition V2 risk_signals must be booleans.');
  }
  const { decision_id: decisionId, ...body } = decision;
  if (contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, body) !== decisionId) {
    fail('INVALID_PUBLICATION_DISPOSITION', 'publication disposition V2 identity is invalid.');
  }
  return true;
}

function validatePublicationDispositionV2(decision, {
  calibration_authority: authority,
  publication_input: input,
  rebuild = false,
} = {}) {
  validatePublicationDispositionV2Identity(decision);
  if (!rebuild) return true;
  const rebuilt = buildPublicationDispositionV2({
    claim_revision_id: decision.claim_revision_id,
    run_receipt_id: decision.run_receipt_id,
    resolution_receipt_id: decision.resolution_receipt_id,
    review_queue_artifact_id: decision.review_queue_artifact_id,
    publication_input: input,
    canonical_validation_state: decision.canonical_validation_state,
    evaluated_at: decision.evaluated_at,
    calibration_authority: authority,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(decision)) {
    fail('PUBLICATION_DISPOSITION_MISMATCH', 'publication disposition V2 does not match independent evaluation.');
  }
  return true;
}

function buildPublicationFamilySwitch({ family, enabled, effective_at: effectiveAt, reason_code: reasonCode } = {}) {
  requireString(family, 'family');
  if (typeof enabled !== 'boolean') {
    fail('INVALID_PUBLICATION_FAMILY_SWITCH', 'enabled must be boolean.');
  }
  parseTimestamp(effectiveAt, 'effective_at', 'INVALID_PUBLICATION_FAMILY_SWITCH');
  requireString(reasonCode, 'reason_code');
  const body = {
    schema_version: PUBLICATION_FAMILY_SWITCH_SCHEMA,
    family,
    enabled,
    effective_at: effectiveAt,
    reason_code: reasonCode,
  };
  return deepFreeze({
    ...body,
    family_switch_id: contentId(PUBLICATION_FAMILY_SWITCH_SCHEMA, body),
  });
}

function validatePublicationFamilySwitch(switchReceipt) {
  requireExactKeys(switchReceipt, [
    'effective_at', 'enabled', 'family', 'family_switch_id', 'reason_code', 'schema_version',
  ], 'publication family switch', 'INVALID_PUBLICATION_FAMILY_SWITCH');
  if (switchReceipt.schema_version !== PUBLICATION_FAMILY_SWITCH_SCHEMA) {
    fail('INVALID_PUBLICATION_FAMILY_SWITCH', 'publication family switch schema_version is not recognised.');
  }
  const rebuilt = buildPublicationFamilySwitch({
    family: switchReceipt.family,
    enabled: switchReceipt.enabled,
    effective_at: switchReceipt.effective_at,
    reason_code: switchReceipt.reason_code,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(switchReceipt)) {
    fail('INVALID_PUBLICATION_FAMILY_SWITCH', 'publication family switch identity is invalid.');
  }
  return true;
}

function buildPublicationReleaseReceipt({ eligible_decision: eligibleDecision, family_switch: familySwitch, released_at: releasedAt } = {}) {
  validatePublicationDispositionV2Identity(eligibleDecision);
  validatePublicationFamilySwitch(familySwitch);
  if (eligibleDecision.disposition !== PUBLICATION_DISPOSITIONS.ELIGIBLE) {
    fail('INVALID_PUBLICATION_RELEASE_RECEIPT', 'only an ELIGIBLE decision can receive a publication release receipt.');
  }
  if (!familySwitch.enabled) {
    fail('FAMILY_PUBLICATION_DISABLED', 'a disabled family cannot receive a publication release receipt.');
  }
  if (eligibleDecision.family !== familySwitch.family) {
    fail('PUBLICATION_RELEASE_FAMILY_MISMATCH', 'the release receipt family must match the eligible decision family.');
  }
  parseTimestamp(releasedAt, 'released_at', 'INVALID_PUBLICATION_RELEASE_RECEIPT');
  const body = {
    schema_version: PUBLICATION_RELEASE_RECEIPT_SCHEMA,
    family: eligibleDecision.family,
    claim_revision_id: eligibleDecision.claim_revision_id,
    eligible_decision_id: eligibleDecision.decision_id,
    family_switch_id: familySwitch.family_switch_id,
    released_at: releasedAt,
  };
  return deepFreeze({
    ...body,
    release_receipt_id: contentId(PUBLICATION_RELEASE_RECEIPT_SCHEMA, body),
  });
}

function validatePublicationReleaseReceipt(receipt, { eligible_decision: eligibleDecision, family_switch: familySwitch } = {}) {
  requireExactKeys(receipt, [
    'claim_revision_id', 'eligible_decision_id', 'family', 'family_switch_id', 'release_receipt_id',
    'released_at', 'schema_version',
  ], 'publication release receipt', 'INVALID_PUBLICATION_RELEASE_RECEIPT');
  if (receipt.schema_version !== PUBLICATION_RELEASE_RECEIPT_SCHEMA) {
    fail('INVALID_PUBLICATION_RELEASE_RECEIPT', 'publication release receipt schema_version is not recognised.');
  }
  const rebuilt = buildPublicationReleaseReceipt({
    eligible_decision: eligibleDecision,
    family_switch: familySwitch,
    released_at: receipt.released_at,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(receipt)) {
    fail('INVALID_PUBLICATION_RELEASE_RECEIPT', 'publication release receipt identity or binding is invalid.');
  }
  return true;
}

function buildPublicationRollbackReceipt({ release_receipt: releaseReceipt, disabled_family_switch: disabledFamilySwitch, rolled_back_at: rolledBackAt, reason_code: reasonCode } = {}) {
  validatePublicationFamilySwitch(disabledFamilySwitch);
  if (!releaseReceipt || typeof releaseReceipt !== 'object' || Array.isArray(releaseReceipt)) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'a release receipt is required for rollback.');
  }
  requireExactKeys(releaseReceipt, [
    'claim_revision_id', 'eligible_decision_id', 'family', 'family_switch_id', 'release_receipt_id',
    'released_at', 'schema_version',
  ], 'publication release receipt', 'INVALID_PUBLICATION_ROLLBACK_RECEIPT');
  if (releaseReceipt.schema_version !== PUBLICATION_RELEASE_RECEIPT_SCHEMA
    || !SHA256_RE.test(releaseReceipt.release_receipt_id)) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'the rollback receipt must bind an immutable release receipt.');
  }
  const { release_receipt_id: releaseReceiptId, ...releaseBody } = releaseReceipt;
  if (contentId(PUBLICATION_RELEASE_RECEIPT_SCHEMA, releaseBody) !== releaseReceiptId) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'the rollback receipt must bind an unmodified release receipt.');
  }
  if (disabledFamilySwitch.enabled || disabledFamilySwitch.family !== releaseReceipt.family) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'rollback requires a disabled switch for the released family.');
  }
  parseTimestamp(rolledBackAt, 'rolled_back_at', 'INVALID_PUBLICATION_ROLLBACK_RECEIPT');
  requireString(reasonCode, 'reason_code');
  const body = {
    schema_version: PUBLICATION_ROLLBACK_RECEIPT_SCHEMA,
    release_receipt_id: releaseReceipt.release_receipt_id,
    family: releaseReceipt.family,
    disabled_family_switch_id: disabledFamilySwitch.family_switch_id,
    rolled_back_at: rolledBackAt,
    reason_code: reasonCode,
  };
  return deepFreeze({
    ...body,
    rollback_receipt_id: contentId(PUBLICATION_ROLLBACK_RECEIPT_SCHEMA, body),
  });
}

function validatePublicationRollbackReceipt(receipt, { release_receipt: releaseReceipt, disabled_family_switch: disabledFamilySwitch } = {}) {
  requireExactKeys(receipt, [
    'disabled_family_switch_id', 'family', 'reason_code', 'release_receipt_id', 'rollback_receipt_id',
    'rolled_back_at', 'schema_version',
  ], 'publication rollback receipt', 'INVALID_PUBLICATION_ROLLBACK_RECEIPT');
  if (receipt.schema_version !== PUBLICATION_ROLLBACK_RECEIPT_SCHEMA) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'publication rollback receipt schema_version is not recognised.');
  }
  const rebuilt = buildPublicationRollbackReceipt({
    release_receipt: releaseReceipt,
    disabled_family_switch: disabledFamilySwitch,
    rolled_back_at: receipt.rolled_back_at,
    reason_code: receipt.reason_code,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(receipt)) {
    fail('INVALID_PUBLICATION_ROLLBACK_RECEIPT', 'publication rollback receipt identity or binding is invalid.');
  }
  return true;
}

const evaluateUnattendedPublicationDisposition = evaluatePublicationDisposition;
const validateUnattendedPublicationDispositionDecision = validatePublicationDispositionDecision;
const transitionPublicationDisposition = transitionUnattendedPublicationDisposition;

module.exports = {
  CALIBRATION_AUTHORITY_SCHEMA,
  PUBLICATION_DISPOSITION_V2_SCHEMA,
  PUBLICATION_FAMILY_SWITCH_SCHEMA,
  PUBLICATION_RELEASE_RECEIPT_SCHEMA,
  PUBLICATION_ROLLBACK_RECEIPT_SCHEMA,
  CANONICAL_CLAIM_VALIDATION_STATES,
  CANONICAL_CLAIM_PUBLICATION_STATES,
  UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA,
  UNATTENDED_PUBLICATION_DISPOSITIONS,
  PUBLICATION_DISPOSITION_SCHEMA,
  PUBLICATION_DISPOSITIONS,
  PublicationDispositionError,
  buildCalibrationAuthority,
  validateCalibrationAuthority,
  evaluatePublicationDisposition,
  evaluateUnattendedPublicationDisposition,
  validatePublicationDispositionDecision,
  validateUnattendedPublicationDispositionDecision,
  transitionPublicationDisposition,
  transitionUnattendedPublicationDisposition,
  buildPublicationDispositionV2,
  validatePublicationDispositionV2Identity,
  validatePublicationDispositionV2,
  buildPublicationFamilySwitch,
  validatePublicationFamilySwitch,
  buildPublicationReleaseReceipt,
  validatePublicationReleaseReceipt,
  buildPublicationRollbackReceipt,
  validatePublicationRollbackReceipt,
};
