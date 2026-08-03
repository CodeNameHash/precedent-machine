'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'IOC_WAVE_A_PRODUCT_PROJECTION/V1';
const RECORD_SCHEMA = 'IOC_WAVE_A_PRODUCT_RECORD/V1';
const AUTHORITY_STATE = 'VALIDATED_NOT_SERVED';
const CLAIM_DEFINITION_KEY = 'IOC_RESTRICTION_PRESENT';

const CONCEPT_LABELS = Object.freeze({
  'IOC-MERGE': 'Mergers, acquisitions and dispositions',
  'IOC-CONTRACT': 'Material contracts',
  'IOC-COMP': 'Compensation and benefits',
  'IOC-DEBT': 'Indebtedness',
  'IOC-TAX': 'Tax matters',
  'IOC-CHARTER': 'Charter and bylaws',
  'IOC-ISSUE': 'Securities issuances',
  'IOC-ACCOUNTING': 'Accounting changes',
  'IOC-SETTLE': 'Litigation settlements',
  'IOC-DIVIDEND': 'Dividends and distributions',
  'IOC-CAPEX': 'Capital expenditures',
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
  if (!party || party.role !== 'IOC_COVENANT_OBLIGOR'
    || !['TARGET', 'BUYER'].includes(party.capacity)) {
    fail('INVALID_INHERITED_PARTY', 'The IOC restriction must inherit a target or buyer obligor.');
  }
  const provision = entry.provision_instance;
  if (!provision || provision.schema_version !== 'PROVISION_INSTANCE/V1'
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
} = {}) {
  if (!Array.isArray(resolvedEntries) || resolvedEntries.length === 0
    || !Array.isArray(iocRestrictionComponents)) {
    fail('INVALID_INPUT', 'Resolved entries and IOC restriction components are required.');
  }
  const componentsById = new Map(iocRestrictionComponents.map(
    (component) => [component && component.provision_component_id, component],
  ));
  const records = resolvedEntries.map((entry) => {
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
