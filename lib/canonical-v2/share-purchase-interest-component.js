const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateTransactionLegResolutionOccurrence,
  validateTransactionLegResolutionRevision,
} = require('./transaction-leg');

const SHARE_PURCHASE_INTEREST_COMPONENT_SCHEMA_VERSION =
  'SHARE_PURCHASE_INTEREST_COMPONENT/V1';
const SHARE_PURCHASE_INTEREST_COMPONENT_REVISION_SCHEMA_VERSION =
  'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const COMPONENT_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const OWNERSHIP_PATHS = Object.freeze([
  'DIRECT',
  'INDIRECT',
  'MIXED',
  'NOT_STATED',
]);
const ACQUISITION_STATES = Object.freeze([
  'PARTIAL',
  'FULL',
  'NOT_STATED',
]);
const PURCHASE_AMOUNT_KINDS = Object.freeze([
  'PERCENTAGE',
  'SECURITY_COUNT',
  'MIXED',
  'OTHER_STATED',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'acquired_entity_endpoint_key',
  'buyer_endpoint_key',
  'expected_component_slot_key',
  'expected_security_class_slot_key',
  'governed_deal_id',
  'governed_ordinal',
  'selling_shareholder_endpoint_key',
  'transaction_leg_resolution_occurrence_id',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'share_purchase_interest_component_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'share_purchase_interest_component',
  'acquired_entity',
  'buyer',
  'consideration',
  'evidence_edges',
  'number_or_percentage_purchased',
  'ownership_path',
  'partial_or_full_acquisition_state',
  'purchased_security_or_share_class',
  'resolver_version',
  'selling_shareholder',
  'state',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'share_purchase_interest_component_revision_id',
  'share_purchase_interest_component_id',
  'acquired_entity',
  'buyer',
  'consideration',
  'evidence_edges',
  'number_or_percentage_purchased',
  'ownership_path',
  'partial_or_full_acquisition_state',
  'purchased_security_or_share_class',
  'resolver_version',
  'selling_shareholder',
  'state',
]);
const ENDPOINT_KEYS = Object.freeze([
  'entity_subject_id',
  'participant_relationship_revision_id',
  'role_code',
]);
const CONSIDERATION_KEYS = Object.freeze([
  'canonical_deal_fact_projection_revision_id',
  'consideration_component_slot_key',
]);
const PURCHASE_AMOUNT_KEYS = Object.freeze([
  'percentage_basis_points',
  'security_count_text',
  'stated_kind',
  'stated_text',
]);

class SharePurchaseInterestComponentError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SharePurchaseInterestComponentError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new SharePurchaseInterestComponentError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_SHARE_PURCHASE_COMPONENT', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(
      'INVALID_SHARE_PURCHASE_COMPONENT',
      `${label} fields do not match the closed contract.`,
      { label },
    );
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail(
      'INVALID_SHARE_PURCHASE_COMPONENT',
      `${label} must be a SHA-256 content ID.`,
      { label },
    );
  }
  return value;
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail(
      'INVALID_SHARE_PURCHASE_COMPONENT',
      `${label} must be a governed uppercase key.`,
      { label },
    );
  }
  return value;
}

function requireText(value, label, maximumBytes = 512) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail(
      'INVALID_SHARE_PURCHASE_COMPONENT',
      `${label} must be bounded, trimmed text.`,
      { label },
    );
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_SHARE_PURCHASE_COMPONENT', `${label} must be an array.`);
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_SHARE_PURCHASE_INPUT', `${label} contains a duplicate.`);
  }
  return selected;
}

function normaliseState(value) {
  requireObject(value, 'state');
  if (!COMPONENT_STATES.includes(value.code)) {
    fail('INVALID_SHARE_PURCHASE_STATE', 'state.code is not governed.');
  }
  const keysByCode = {
    PRESENT: ['code'],
    ABSENT: ['code', 'complete_scope_id'],
    NOT_APPLICABLE: ['code', 'applicability_evidence_ids'],
    NOT_EXAMINED: ['code', 'reason'],
    FAILED: ['code', 'failure_code', 'attempted_resolver'],
  };
  requireExactKeys(value, keysByCode[value.code], 'state');
  if (value.code === 'ABSENT') {
    return {
      code: value.code,
      complete_scope_id: requireDigest(value.complete_scope_id, 'state.complete_scope_id'),
    };
  }
  if (value.code === 'NOT_APPLICABLE') {
    const evidenceIds = uniqueSortedDigests(
      value.applicability_evidence_ids,
      'state.applicability_evidence_ids',
    );
    if (evidenceIds.length === 0) {
      fail('INVALID_SHARE_PURCHASE_STATE', 'NOT_APPLICABLE requires evidence.');
    }
    return { code: value.code, applicability_evidence_ids: evidenceIds };
  }
  if (value.code === 'NOT_EXAMINED') {
    return { code: value.code, reason: requireText(value.reason, 'state.reason') };
  }
  if (value.code === 'FAILED') {
    return {
      code: value.code,
      failure_code: requireGovernedKey(value.failure_code, 'state.failure_code'),
      attempted_resolver: requireText(
        value.attempted_resolver,
        'state.attempted_resolver',
      ),
    };
  }
  return { code: value.code };
}

function normaliseEndpoint(value, requiredRole, label) {
  if (value === null) return null;
  requireExactKeys(value, ENDPOINT_KEYS, label);
  if (value.role_code !== requiredRole) {
    fail(
      'SHARE_PURCHASE_ROLE_MISMATCH',
      `${label} must use the ${requiredRole} transaction role.`,
    );
  }
  return {
    entity_subject_id: requireDigest(value.entity_subject_id, `${label}.entity_subject_id`),
    participant_relationship_revision_id: requireDigest(
      value.participant_relationship_revision_id,
      `${label}.participant_relationship_revision_id`,
    ),
    role_code: value.role_code,
  };
}

function normaliseConsideration(value) {
  if (value === null) return null;
  requireExactKeys(value, CONSIDERATION_KEYS, 'consideration');
  return {
    canonical_deal_fact_projection_revision_id: requireDigest(
      value.canonical_deal_fact_projection_revision_id,
      'consideration.canonical_deal_fact_projection_revision_id',
    ),
    consideration_component_slot_key: requireGovernedKey(
      value.consideration_component_slot_key,
      'consideration.consideration_component_slot_key',
    ),
  };
}

function normalisePurchaseAmount(value) {
  if (value === null) return null;
  requireExactKeys(value, PURCHASE_AMOUNT_KEYS, 'number_or_percentage_purchased');
  if (!PURCHASE_AMOUNT_KINDS.includes(value.stated_kind)) {
    fail(
      'INVALID_SHARE_PURCHASE_AMOUNT',
      'number_or_percentage_purchased.stated_kind is not governed.',
    );
  }
  const percentageBasisPoints = value.percentage_basis_points;
  const securityCountText = value.security_count_text === null
    ? null
    : requireText(
      value.security_count_text,
      'number_or_percentage_purchased.security_count_text',
    );
  if (percentageBasisPoints !== null
    && (!Number.isSafeInteger(percentageBasisPoints)
      || percentageBasisPoints < 1
      || percentageBasisPoints > 10000)) {
    fail(
      'INVALID_SHARE_PURCHASE_AMOUNT',
      'percentage_basis_points must be an integer from 1 through 10000.',
    );
  }
  const requirements = {
    PERCENTAGE: percentageBasisPoints !== null && securityCountText === null,
    SECURITY_COUNT: percentageBasisPoints === null && securityCountText !== null,
    MIXED: percentageBasisPoints !== null && securityCountText !== null,
    OTHER_STATED: percentageBasisPoints === null && securityCountText === null,
  };
  if (!requirements[value.stated_kind]) {
    fail(
      'INVALID_SHARE_PURCHASE_AMOUNT',
      'The structured purchase amount does not match stated_kind.',
    );
  }
  return {
    percentage_basis_points: percentageBasisPoints,
    security_count_text: securityCountText,
    stated_kind: value.stated_kind,
    stated_text: requireText(
      value.stated_text,
      'number_or_percentage_purchased.stated_text',
    ),
  };
}

function buildSharePurchaseInterestComponent(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'share purchase component input');
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(
      'INVALID_SHARE_PURCHASE_COMPONENT',
      'governed_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    acquired_entity_endpoint_key: requireGovernedKey(
      input.acquired_entity_endpoint_key,
      'acquired_entity_endpoint_key',
    ),
    buyer_endpoint_key: requireGovernedKey(
      input.buyer_endpoint_key,
      'buyer_endpoint_key',
    ),
    expected_component_slot_key: requireGovernedKey(
      input.expected_component_slot_key,
      'expected_component_slot_key',
    ),
    expected_security_class_slot_key: requireGovernedKey(
      input.expected_security_class_slot_key,
      'expected_security_class_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_ordinal: input.governed_ordinal,
    selling_shareholder_endpoint_key: requireGovernedKey(
      input.selling_shareholder_endpoint_key,
      'selling_shareholder_endpoint_key',
    ),
    transaction_leg_resolution_occurrence_id: requireDigest(
      input.transaction_leg_resolution_occurrence_id,
      'transaction_leg_resolution_occurrence_id',
    ),
  };
  if (new Set([
    body.acquired_entity_endpoint_key,
    body.buyer_endpoint_key,
    body.selling_shareholder_endpoint_key,
  ]).size !== 3) {
    fail(
      'SHARE_PURCHASE_ENDPOINT_COLLISION',
      'Each share-purchase role requires a separate endpoint slot.',
    );
  }
  return deepFreeze({
    schema_version: SHARE_PURCHASE_INTEREST_COMPONENT_SCHEMA_VERSION,
    share_purchase_interest_component_id: contentId(
      'SHARE_PURCHASE_INTEREST_COMPONENT/V1',
      body,
    ),
    ...body,
  });
}

function validateSharePurchaseInterestComponent(component) {
  requireExactKeys(component, OCCURRENCE_KEYS, 'share purchase component');
  const rebuilt = buildSharePurchaseInterestComponent({
    acquired_entity_endpoint_key: component.acquired_entity_endpoint_key,
    buyer_endpoint_key: component.buyer_endpoint_key,
    expected_component_slot_key: component.expected_component_slot_key,
    expected_security_class_slot_key: component.expected_security_class_slot_key,
    governed_deal_id: component.governed_deal_id,
    governed_ordinal: component.governed_ordinal,
    selling_shareholder_endpoint_key: component.selling_shareholder_endpoint_key,
    transaction_leg_resolution_occurrence_id:
      component.transaction_leg_resolution_occurrence_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(component)) {
    fail(
      'STALE_SHARE_PURCHASE_COMPONENT',
      'Share purchase component identity or content is stale.',
    );
  }
  return true;
}

function buildSharePurchaseInterestComponentRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'share purchase component revision input');
  validateSharePurchaseInterestComponent(input.share_purchase_interest_component);
  const component = input.share_purchase_interest_component;
  const state = normaliseState(input.state);
  const buyer = normaliseEndpoint(input.buyer, 'BUYER', 'buyer');
  const acquiredEntity = normaliseEndpoint(
    input.acquired_entity,
    'ACQUIRED_ENTITY',
    'acquired_entity',
  );
  const sellingShareholder = normaliseEndpoint(
    input.selling_shareholder,
    'SELLING_SHAREHOLDER',
    'selling_shareholder',
  );
  const consideration = normaliseConsideration(input.consideration);
  const purchaseAmount = normalisePurchaseAmount(
    input.number_or_percentage_purchased,
  );
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const isPresent = state.code === 'PRESENT';

  if (isPresent && (
    buyer === null
    || acquiredEntity === null
    || sellingShareholder === null
    || !OWNERSHIP_PATHS.includes(input.ownership_path)
    || !ACQUISITION_STATES.includes(input.partial_or_full_acquisition_state)
    || input.purchased_security_or_share_class === null
    || evidenceEdges.length === 0
  )) {
    fail(
      'INCOMPLETE_SHARE_PURCHASE_COMPONENT',
      'A present share purchase requires all endpoints, one security class, and evidence.',
    );
  }
  const endpointRelationshipIds = [buyer, acquiredEntity, sellingShareholder]
    .filter(Boolean)
    .map((endpoint) => endpoint.participant_relationship_revision_id);
  if (isPresent
    && new Set(endpointRelationshipIds).size !== endpointRelationshipIds.length) {
    fail(
      'SHARE_PURCHASE_ENDPOINT_COLLISION',
      'Each share-purchase role requires a separate participant relationship revision.',
    );
  }
  if (isPresent && purchaseAmount?.percentage_basis_points === 10000
    && input.partial_or_full_acquisition_state === 'PARTIAL') {
    fail(
      'SHARE_PURCHASE_AMOUNT_STATE_MISMATCH',
      'A stated 100 percent purchase cannot be marked PARTIAL.',
    );
  }
  if (isPresent
    && purchaseAmount?.percentage_basis_points !== null
    && purchaseAmount?.percentage_basis_points !== undefined
    && purchaseAmount.percentage_basis_points < 10000
    && input.partial_or_full_acquisition_state === 'FULL') {
    fail(
      'SHARE_PURCHASE_AMOUNT_STATE_MISMATCH',
      'A stated purchase below 100 percent cannot be marked FULL.',
    );
  }
  if (!isPresent && (
    buyer !== null
    || acquiredEntity !== null
    || sellingShareholder !== null
    || consideration !== null
    || purchaseAmount !== null
    || input.ownership_path !== null
    || input.partial_or_full_acquisition_state !== null
    || input.purchased_security_or_share_class !== null
  )) {
    fail(
      'NON_PRESENT_SHARE_PURCHASE_VALUE',
      'A non-present share purchase component cannot assert component values.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail('SHARE_PURCHASE_EVIDENCE_REQUIRED', `${state.code} requires exact evidence.`);
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_SHARE_PURCHASE_EVIDENCE',
      'Applicability evidence must be in the component evidence set.',
    );
  }

  const body = {
    acquired_entity: acquiredEntity,
    buyer,
    consideration,
    evidence_edges: evidenceEdges,
    number_or_percentage_purchased: purchaseAmount,
    ownership_path: input.ownership_path,
    partial_or_full_acquisition_state: input.partial_or_full_acquisition_state,
    purchased_security_or_share_class: input.purchased_security_or_share_class === null
      ? null
      : requireText(
        input.purchased_security_or_share_class,
        'purchased_security_or_share_class',
      ),
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    selling_shareholder: sellingShareholder,
    share_purchase_interest_component_id:
      component.share_purchase_interest_component_id,
    state,
  };
  return deepFreeze({
    schema_version: SHARE_PURCHASE_INTEREST_COMPONENT_REVISION_SCHEMA_VERSION,
    share_purchase_interest_component_revision_id: contentId(
      'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION/V1',
      body,
    ),
    ...body,
  });
}

function validateSharePurchaseInterestComponentRevision({
  revision,
  share_purchase_interest_component: component,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'share purchase component revision');
  validateSharePurchaseInterestComponent(component);
  if (revision.share_purchase_interest_component_id
    !== component.share_purchase_interest_component_id) {
    fail(
      'STALE_SHARE_PURCHASE_COMPONENT_REVISION',
      'Revision refers to another share purchase component.',
    );
  }
  const rebuilt = buildSharePurchaseInterestComponentRevision({
    share_purchase_interest_component: component,
    acquired_entity: revision.acquired_entity,
    buyer: revision.buyer,
    consideration: revision.consideration,
    evidence_edges: revision.evidence_edges,
    number_or_percentage_purchased: revision.number_or_percentage_purchased,
    ownership_path: revision.ownership_path,
    partial_or_full_acquisition_state: revision.partial_or_full_acquisition_state,
    purchased_security_or_share_class: revision.purchased_security_or_share_class,
    resolver_version: revision.resolver_version,
    selling_shareholder: revision.selling_shareholder,
    state: revision.state,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail(
      'STALE_SHARE_PURCHASE_COMPONENT_REVISION',
      'Share purchase component revision identity or content is stale.',
    );
  }
  return true;
}

function validateSharePurchaseInterestComponentLegBinding({
  share_purchase_interest_component: component,
  transaction_leg_resolution_occurrence: legOccurrence,
  transaction_leg_resolution_revision: legRevision,
} = {}) {
  validateSharePurchaseInterestComponent(component);
  validateTransactionLegResolutionOccurrence(legOccurrence);
  validateTransactionLegResolutionRevision({
    revision: legRevision,
    transaction_leg_resolution_occurrence: legOccurrence,
  });
  if (component.transaction_leg_resolution_occurrence_id
      !== legOccurrence.transaction_leg_resolution_occurrence_id
    || legRevision.resolved_leg_type !== 'SHARE_PURCHASE'
    || legRevision.terminal_eligible !== true) {
    fail(
      'INVALID_SHARE_PURCHASE_LEG_BINDING',
      'A share purchase component must bind a terminal SHARE_PURCHASE leg.',
    );
  }
  return true;
}

module.exports = {
  ACQUISITION_STATES,
  COMPONENT_STATES,
  OWNERSHIP_PATHS,
  PURCHASE_AMOUNT_KINDS,
  SHARE_PURCHASE_INTEREST_COMPONENT_REVISION_SCHEMA_VERSION,
  SHARE_PURCHASE_INTEREST_COMPONENT_SCHEMA_VERSION,
  SharePurchaseInterestComponentError,
  buildSharePurchaseInterestComponent,
  buildSharePurchaseInterestComponentRevision,
  validateSharePurchaseInterestComponent,
  validateSharePurchaseInterestComponentLegBinding,
  validateSharePurchaseInterestComponentRevision,
};
