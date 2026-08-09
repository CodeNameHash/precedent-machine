'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'IOC_WAVE_A_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'IOC_WAVE_A_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const CLAIM_DEFINITION_KEY = 'IOC_RESTRICTION_PRESENT';

// PLAN.md Step 2D1 defect 4 (2026-08-07): the other three projections this
// step touched (financing-guaranty, tax-dividends-appraisal,
// representations) widened their provision.schema_version check from the
// single literal 'PROVISION_INSTANCE/V1' to the union of both real kinds
// validate-write-set.js admits. This module is NOT one of the four the
// defect named, and it stays on the single literal deliberately:
// candidate-resolution.js's GENERIC_CLAIM_KEY_RESOLUTION_TABLE gives every
// IOC-* row `party_field: 'covenant_obligor'`, so an IOC restriction is
// always party-bound by construction (confirmed live: all 10 resolved
// entries in the committed modiv-interim-operating-20260807-replay run
// carry PROVISION_INSTANCE/V1 with a real party). Widening this one the same
// way the other three were widened would have been actively wrong, not just
// unnecessary: below, `canonicalJson(provision.party) !== canonicalJson(party)`
// sits in the same `||` chain as the schema check, short-circuited today
// because a schema mismatch never reaches it -- accept
// STRUCTURAL_PROVISION_INSTANCE/V1 (which carries no `party` field at all)
// here and that line stops being skipped, calls
// canonicalJson(undefined), and throws 'canonical JSON does not support
// undefined' deep inside canonical-bytes.js instead of this module's own
// clean, named INVALID_PARENT_PROVISION failure -- the exact cryptic-crash
// shape termination-product-projection.js's header warns about. Left as a
// single literal on purpose; do not widen without also guarding the party
// comparison below.
const GOVERNED_PROVISION_SCHEMA_VERSION = 'PROVISION_INSTANCE/V1';

const CONCEPT_LABELS = Object.freeze({
  'IOC-MERGE': 'Mergers, acquisitions and dispositions',
  'IOC-CONTRACT': 'Material contracts',
  'IOC-COMP': 'Compensation and benefits',
  'IOC-DEBT': 'Indebtedness and loans',
  'IOC-TAX': 'Tax matters',
  'IOC-CHARTER': 'Charter and bylaws',
  'IOC-ISSUE': 'Securities issuances',
  'IOC-ACCOUNTING': 'Accounting changes',
  'IOC-SETTLE': 'Litigation settlements',
  'IOC-DIVIDEND': 'Dividends and distributions',
  'IOC-CAPEX': 'Capital expenditures',
  'IOC-LIEN': 'Liens and encumbrances',
  'IOC-REPURCHASE': 'Equity repurchases',
  'IOC-HIRE': 'Hiring and termination',
  'IOC-IP': 'Intellectual property',
  'IOC-INSURANCE': 'Insurance',
  'IOC-REALPROP': 'Real estate and leases',
  'IOC-AFFILIATE': 'Intercompany arrangements',
  'IOC-REGAUTH': 'Regulatory filings and cyber',
  'IOC-ORDINARY': 'Other ordinary course',
});

class IocWaveAProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IocWaveAProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new IocWaveAProjectionError(code, message, details);
}

function validateEntry(entry, componentsById) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  if (!Object.hasOwn(CONCEPT_LABELS, entry.concept_key)
    || entry.resolved_claim_definition_key !== CLAIM_DEFINITION_KEY) {
    fail('UNGOVERNED_IOC_CLAIM', 'Only governed IOC restriction-presence claims can be projected.');
  }
  const party = entry.party;
  // Step 3F1 (docs/core/PLAN.md, "give the marker a downstream contract"):
  // this ALREADY refuses JOINT_MULTI_PARTY_CAPACITY ('JOINT_MULTI_PARTY',
  // lib/canonical-v2/native-producer/candidate-resolution.js) and every
  // other capacity outside TARGET/BUYER -- the allow-list below was
  // written before that marker existed, but a value not in the list is a
  // value not in the list. Confirmed by direct test rather than left
  // implicit (tests/canonical-v2-ioc-parent-child-resolution.test.js,
  // "JOINT_MULTI_PARTY capacity"): this is the "refuses it explicitly"
  // side of the acceptance criteria, not the "maps it" side -- an IOC
  // restriction inherits a SINGLE obligor's capacity by construction
  // (obligor_capacity feeds a TARGET/BUYER-only market breakdown three
  // lines below), so there is no meaningful "both sides jointly restricted"
  // value to invent; a typed, explicit throw is the correct behaviour here,
  // not a defect to fix.
  if (!party || party.role !== 'IOC_COVENANT_OBLIGOR'
    || !['TARGET', 'BUYER'].includes(party.capacity)) {
    fail('INVALID_INHERITED_PARTY', 'The IOC restriction must inherit a target or buyer obligor.');
  }
  const provision = entry.provision_instance;
  if (!provision || provision.schema_version !== GOVERNED_PROVISION_SCHEMA_VERSION
    || canonicalJson(provision.party) !== canonicalJson(party)) {
    fail('INVALID_PARENT_PROVISION', 'The IOC restriction must use its party-bearing parent provision.');
  }
  const claim = entry.claim;
  if (!claim || claim.state !== 'PRESENT' || claim.canonical_value !== true
    || claim.claim_definition_key !== CLAIM_DEFINITION_KEY) {
    fail('INVALID_PUBLISHED_CLAIM', 'The IOC claim must be a PRESENT restriction-presence claim.');
  }
  const component = componentsById.get(claim.subject_occurrence_id);
  if (!component || component.schema_version !== 'PROVISION_COMPONENT/V1'
    || component.component_key !== 'RESTRICTED_ACTION'
    || component.parent_provision_instance_id !== provision.provision_instance_id) {
    fail('INVALID_RESTRICTION_COMPONENT', 'The IOC claim must be bound to a restricted-action child component.');
  }
  return { claim, component, party, provision };
}

function projectIocWaveAClaims({
  resolved_entries: resolvedEntries,
  ioc_restriction_components: iocRestrictionComponents,
  publication_filter: publicationFilter,
  release_receipt_id: releaseReceiptId,
  publication_evaluation_time: publicationEvaluationTime,
} = {}) {
  const permittedEntries = filterResolvedEntriesForPublication(resolvedEntries, publicationFilter, releaseReceiptId, publicationEvaluationTime);
  if (permittedEntries.length === 0
    || !Array.isArray(iocRestrictionComponents)) {
    fail('INVALID_INPUT', 'Resolved entries and IOC restriction components are required.');
  }
  const componentsById = new Map(iocRestrictionComponents.map(
    (component) => [component && component.provision_component_id, component],
  ));
  const records = permittedEntries.map((entry) => {
    const {
      claim, component, party, provision,
    } = validateEntry(entry, componentsById);
    const body = {
      schema_version: RECORD_SCHEMA,
      authority_state: AUTHORITY_STATE,
      claim_revision_id: claim.claim_revision_id,
      provision_instance_id: provision.provision_instance_id,
      provision_component_id: component.provision_component_id,
      concept_key: entry.concept_key,
      obligor_capacity: party.capacity,
      review: {
        row_key: entry.concept_key,
        label: CONCEPT_LABELS[entry.concept_key],
        value: true,
        obligor_capacity: party.capacity,
        source_section_reference: entry.section_reference,
      },
      query: {
        field_key: 'iocRestrictionPresent',
        value: { concept_key: entry.concept_key, obligor_capacity: party.capacity },
      },
      compare: {
        field_key: 'iocRestrictionPresent',
        value: { concept_key: entry.concept_key, obligor_capacity: party.capacity },
      },
      market: {
        metric_key: 'IOC_RESTRICTION_PRESENCE_BY_CONCEPT_AND_SIDE',
        metric_version: 1,
        value_dimension: 'BOOLEAN_PRESENCE',
        canonical_unit: 'PRESENT_TRUE',
        canonical_value: true,
        breakdown: { concept_key: entry.concept_key, obligor_capacity: party.capacity },
        per_deal_rollup: 'ANY_TRUE',
        weighting: 'DEAL',
      },
    };
    return Object.freeze({ ...body, projection_record_id: contentId(RECORD_SCHEMA, body) });
  }).sort((left, right) => left.projection_record_id.localeCompare(right.projection_record_id));

  const duplicateKeys = records.map((record) => canonicalJson([
    record.provision_component_id,
    record.concept_key,
  ]));
  if (new Set(duplicateKeys).size !== duplicateKeys.length) {
    fail('DUPLICATE_PRODUCT_FIELD', 'A restricted-action component can contribute one presence value per concept.');
  }
  const body = { schema_version: PROJECTION_SCHEMA, authority_state: AUTHORITY_STATE, records };
  return Object.freeze({ ...body, projection_id: contentId(PROJECTION_SCHEMA, body) });
}

module.exports = {
  PROJECTION_SCHEMA,
  RECORD_SCHEMA,
  AUTHORITY_STATE,
  CLAIM_DEFINITION_KEY,
  CONCEPT_LABELS,
  IocWaveAProjectionError,
  projectIocWaveAClaims,
};
