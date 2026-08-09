'use strict';

// No Other Reps / Fraud product projection -- VALIDATED_NOT_SERVED.
// Turns resolved positive-presence claims into four flat, parallel fact
// arrays (review, query, compare, market), one entry per claim.
//
// TWO RESOLVER SHAPES, ONE PROJECTION. Updated 2026-08-08 (Step 2F BREAK 6)
// after this module was found never to have rendered on any committed run of
// its own family -- not TopBuild, not Modiv, not the 2026-08-06 Modiv run,
// three runs and three throws, all `TypeError: canonical JSON does not
// support undefined` from inside contentId. It was written against
// native-producer/no-other-reps-fraud-resolution.js's
// resolveNoOtherRepsFraudProposals, which emits `resolution_id`,
// `claim.concept_key`, `claim.owner_family` and `evidence_only` directly on
// each resolved item. That resolver is still live -- review-preview-assembly.js
// and this family's dark-bridge tests both drive it -- but it is NOT what the
// live extraction runner writes. The runner's own resolution.json entries
// (candidate-resolution.js, the shape 25 families and both documents agree
// on) carry none of those four keys: identity is `claim.claim_revision_id`,
// the concept sits on the ENTRY as `entry.concept_key`, and owner family and
// evidence-only routing are not serialised at all.
//
// So each of the four is now derived, preferring the explicit field when the
// legacy resolver supplied it and falling back to what the native producer
// actually emits. Nothing is invented: owner family and the evidence-only
// envelope both come from native-producer/no-other-reps-fraud-contract.js's
// ELEMENTS -- the same registry the native resolver itself reads to set them
// -- keyed by claim-definition key, so both paths resolve to the same value
// for the same claim.
//
// FAILS LOUDLY, NEVER QUIETLY. A claim this module owns that it cannot
// render throws NoOtherRepsFraudProductProjectionError naming the claim,
// following termination-product-projection.js's TERMINATION_RIGHT_TITLE_
// UNMAPPED and remedies-misc-product-projection.js's UNMAPPED_FAMILY_CLAIM_
// DEFINITION. Returning a short list, or dropping the claim, would reproduce
// exactly the failure this family has been in since Step 4A: a write that
// commits, a surface that shows a lawyer nothing, and no error anywhere.

const { contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const { ELEMENTS } = require('./native-producer/no-other-reps-fraud-contract');

const PRODUCT_PROJECTION_SCHEMA = 'NO_OTHER_REPS_FRAUD_PRODUCT_PROJECTION/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const LABELS = Object.freeze({
  NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: 'No other representations',
  NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: 'Non-reliance',
  EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: 'Extra-contractual disclaimer',
  INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_PRESENT: 'Independent investigation',
  FRAUD_CARVEOUT_PRESENT: 'Fraud carve-out',
  WILLFUL_BREACH_DEFINITION_PRESENT: 'Willful breach definition',
});

// The family's own contract, re-keyed by claim-definition key. ELEMENTS is
// keyed by the producer's generic key, which a resolution.json entry does not
// carry in a form this module can rely on.
const ELEMENTS_BY_CLAIM_DEFINITION_KEY = Object.freeze(Object.fromEntries(
  Object.values(ELEMENTS).map((element) => [element.claim_definition_key, element]),
));

// Same convention as tax-dividends-appraisal-product-projection.js and
// financing-guaranty-product-projection.js: the native resolver merges
// system/routing metadata into governed attributes, and those keys are read
// from the entry, never from attributes. `answer_provenance` is on every
// native claim in this family; leaving it in would put a provenance blob into
// a market-metric breakdown and fragment its cohorts.
const SYSTEM_ATTRIBUTE_KEYS = new Set(['assertion_kind', 'section_reference', 'answer_provenance']);

class NoOtherRepsFraudProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NoOtherRepsFraudProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NoOtherRepsFraudProductProjectionError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function evidenceQuote(item) {
  return item?.claim?.evidence?.[0] ? item.claim.raw_value || null : null;
}

function sanitizeAttributes(attributes) {
  return Object.fromEntries(
    Object.entries(attributes || {}).filter(([attributeKey, value]) => (
      value !== null && value !== undefined && !SYSTEM_ATTRIBUTE_KEYS.has(attributeKey)
    )),
  );
}

// Legacy resolver first, native producer second, typed failure third. The
// third branch is the point: before this, every one of these fell through as
// `undefined` and died four frames deep inside canonicalJson naming nothing.
function factIdentity(item, claim, index) {
  if (nonEmptyString(item.resolution_id)) return item.resolution_id;
  if (nonEmptyString(claim.claim_revision_id)) return claim.claim_revision_id;
  return fail(
    'MISSING_CLAIM_IDENTITY',
    `${claim.claim_definition_key} at resolved[${index}] carries neither a resolution_id nor a `
    + 'claim.claim_revision_id, so it has no stable product identity.',
    { index, claim_definition_key: claim.claim_definition_key },
  );
}

function factConceptKey(item, claim, index) {
  if (nonEmptyString(claim.concept_key)) return claim.concept_key;
  if (nonEmptyString(item.concept_key)) return item.concept_key;
  return fail(
    'MISSING_CONCEPT_KEY',
    `${claim.claim_definition_key} at resolved[${index}] carries no concept_key on either the claim `
    + 'or the resolution entry.',
    { index, claim_definition_key: claim.claim_definition_key },
  );
}

function factOwnerFamily(claim, element, index) {
  if (nonEmptyString(claim.owner_family)) return claim.owner_family;
  if (element && nonEmptyString(element.owner_family)) return element.owner_family;
  return fail(
    'UNMAPPED_FAMILY_CLAIM_DEFINITION',
    `${claim.claim_definition_key} at resolved[${index}] resolves into this family but has no owner `
    + 'family: the claim does not carry one and the key is absent from ELEMENTS in '
    + 'lib/canonical-v2/native-producer/no-other-reps-fraud-contract.js.',
    { index, claim_definition_key: claim.claim_definition_key },
  );
}

// The legacy resolver builds this envelope for exactly the elements that
// carry a qualified_owner_family (FRAUD_CARVEOUT_PRESENT and
// WILLFUL_BREACH_DEFINITION_PRESENT, both cross-claimed by
// SPECIFIC_PERFORMANCE_REMEDIES) and null for the rest. Derived here from the
// same registry, with the same quote, so both resolver shapes agree.
function factEvidenceOnly(item, claim, element) {
  if (Object.hasOwn(item, 'evidence_only')) return item.evidence_only;
  if (!element || !nonEmptyString(element.qualified_owner_family)) return null;
  return Object.freeze({
    qualified_owner_family: element.qualified_owner_family,
    relationship_state: 'EVIDENCE_ONLY_UNADJUDICATED',
    quote: claim.raw_value,
  });
}

function factLabel(claim, index) {
  const label = LABELS[claim.claim_definition_key];
  if (nonEmptyString(label)) return label;
  // Distinct from UNMAPPED_FAMILY_CLAIM_DEFINITION on purpose: that one means
  // "this key is not in the family's contract at all", this one means "it is,
  // and the product surface has drifted behind it". Mirrors
  // termination-product-projection.js's TERMINATION_RIGHT_TITLE_UNMAPPED.
  // Cannot fire against today's registry -- all six ELEMENTS keys are in
  // LABELS -- and exists for the next element added to the contract, which is
  // exactly how the termination case arrived.
  return fail(
    'NO_OTHER_REPS_FRAUD_LABEL_UNMAPPED',
    `${claim.claim_definition_key} at resolved[${index}] resolves into this family but has no product-surface `
    + 'label. Add it to LABELS in lib/canonical-v2/no-other-reps-fraud-product-projection.js.',
    { index, claim_definition_key: claim.claim_definition_key },
  );
}

function projectNoOtherRepsFraudProduct({ resolved, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  const facts = permittedEntries.map((item, index) => {
    const claim = item?.claim;
    if (!claim || claim.state !== 'PRESENT' || claim.canonical_value !== true) {
      fail(
        'NOT_A_POSITIVE_PRESENCE_CLAIM',
        `resolved[${index}] is not a positive presence claim.`,
        {
          index,
          claim_definition_key: claim?.claim_definition_key ?? null,
          state: claim?.state ?? null,
          canonical_value: claim?.canonical_value ?? null,
        },
      );
    }
    const element = ELEMENTS_BY_CLAIM_DEFINITION_KEY[claim.claim_definition_key];
    return Object.freeze({
      id: factIdentity(item, claim, index),
      claim_definition_key: claim.claim_definition_key,
      concept_key: factConceptKey(item, claim, index),
      owner_family: factOwnerFamily(claim, element, index),
      label: factLabel(claim, index),
      present: true,
      attributes: sanitizeAttributes(claim.attributes),
      evidence: evidenceQuote(item),
      evidence_only: factEvidenceOnly(item, claim, element),
      source_section_reference: item.section_reference || null,
    });
  });

  const review = facts.map((fact) => Object.freeze({
    row_id: `no-other-reps-fraud-${fact.id}`,
    table_id: fact.owner_family === 'KEY_DEFINED_TERMS' ? 'key-defined-terms' : 'no-other-reps-fraud',
    label: fact.label,
    status: 'Present',
    concept_key: fact.concept_key,
    owner_family: fact.owner_family,
    attributes: fact.attributes,
    evidence: fact.evidence,
    source_section_reference: fact.source_section_reference,
  }));
  const query = facts.map((fact) => Object.freeze({
    field_key: fact.owner_family === 'KEY_DEFINED_TERMS' ? 'definedTermFact' : 'noOtherRepsFraudFact',
    value: fact.label,
    concept_key: fact.concept_key,
    present: true,
    attributes: fact.attributes,
  }));
  const compare = query.map((fact) => Object.freeze({
    field_key: fact.field_key,
    display_value: fact.value,
    concept_key: fact.concept_key,
  }));
  const market = facts.map((fact) => Object.freeze({
    metric_key: `${fact.claim_definition_key.toLowerCase()}_prevalence`,
    cohort: fact.owner_family,
    present: true,
    concept_key: fact.concept_key,
    breakdown: Object.freeze({ ...fact.attributes }),
  }));
  const body = { schema_version: PRODUCT_PROJECTION_SCHEMA, authority_state: AUTHORITY_STATE, review, query, compare, market };
  return deepFreeze({ ...body, projection_id: contentId(PRODUCT_PROJECTION_SCHEMA, body) });
}

module.exports = {
  AUTHORITY_STATE,
  LABELS,
  PRODUCT_PROJECTION_SCHEMA,
  NoOtherRepsFraudProductProjectionError,
  projectNoOtherRepsFraudProduct,
};
