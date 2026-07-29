const { canonicalJson } = require('./canonical-bytes');

const SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND = 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT';
const SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA = 'SHARED_AUTHORITY_LOGICAL_TYPE_INPUT/V1';
const SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_KIND =
  'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT';
const SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_SCHEMA =
  'SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT/V1';

const CANONICAL_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);

const VALUE_RULE_BY_STATE = Object.freeze({
  PRESENT: 'VALUE_AND_EVIDENCE_REQUIRED',
  ABSENT: 'COMPLETE_SCOPE_AND_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_APPLICABLE: 'APPLICABILITY_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_EXAMINED: 'NO_VALUE',
  FAILED: 'FAILURE_DETAIL_REQUIRED_NO_VALUE',
});

const COMMON_KEYS = Object.freeze([
  'logical_type',
  'logical_type_version',
  'expected_slot',
  'occurrence_identity',
  'revision_identity',
  'state_rules',
  'evidence_rules',
  'physical_carrier',
  'writer_action',
  'release_treatment',
  'import_treatment',
  'trace_treatment',
  'exact_detail_treatment',
  'consumer_projection_rule',
  'type_contract',
]);

const TYPE_SPECS = Object.freeze({
  EntitySubject: Object.freeze({
    stableId: 'ENTITY_SUBJECT',
    slotKind: 'SUBJECT_IDENTITY_SLOT',
    slotSchema: 'ENTITY_SUBJECT_IDENTITY_SLOT/V1',
    occurrenceDomain: 'ENTITY_SUBJECT/V1',
    occurrenceInputs: Object.freeze([
      'identity_authority_type',
      'identity_authority_value',
    ]),
    excludedValueFields: Object.freeze([
      'classification_codes',
      'display_label',
      'status',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_name',
      'database_row_id',
      'deal_date',
      'deal_economics',
      'display_name',
      'source_order',
      'ticker',
    ]),
    revisionType: 'EntitySubjectRevision',
    revisionDomain: 'ENTITY_SUBJECT_REVISION/V1',
    revisionInputs: Object.freeze([
      'classification_revisions',
      'display_label',
      'entity_subject_id',
      'evidence_edges',
      'revision_status',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'entity_subjects',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: true,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES_OR_GOVERNED_APPROVAL_ATTESTATION',
    writerAction: 'MATERIALISE_ENTITY_SUBJECT',
    terminalType: 'ENTITY_REVISION',
    detailAction: 'ENTITY_SUBJECT_EVIDENCE',
  }),
  EntityNameOccurrence: Object.freeze({
    stableId: 'ENTITY_NAME_OCCURRENCE',
    slotKind: 'SOURCE_NAME_SLOT',
    slotSchema: 'ENTITY_NAME_OCCURRENCE_SLOT/V1',
    occurrenceDomain: 'ENTITY_NAME_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'expected_name_slot_key',
      'governed_ordinal',
      'name_role',
      'source_occurrence_id',
    ]),
    excludedValueFields: Object.freeze([
      'entity_subject_id',
      'exact_name_text',
      'language',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_name',
      'entity_subject_id',
      'exact_name_text',
      'normalised_name',
    ]),
    revisionType: 'EntityNameRevision',
    revisionDomain: 'ENTITY_NAME_REVISION/V1',
    revisionInputs: Object.freeze([
      'entity_name_occurrence_id',
      'entity_subject_id',
      'evidence_state',
      'exact_name_text',
      'extraction_version',
      'language',
      'source_interval',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'entity_name_occurrences',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_ENTITY_NAME_OCCURRENCE',
    terminalType: 'ENTITY_NAME_REVISION',
    detailAction: 'ENTITY_NAME_EVIDENCE',
  }),
  EntityIdentityBridge: Object.freeze({
    stableId: 'ENTITY_IDENTITY_BRIDGE',
    slotKind: 'SOURCE_IDENTITY_RELATIONSHIP_SLOT',
    slotSchema: 'ENTITY_IDENTITY_BRIDGE_SLOT/V1',
    occurrenceDomain: 'ENTITY_IDENTITY_BRIDGE/V1',
    occurrenceInputs: Object.freeze([
      'bridge_rule_key',
      'expected_identity_bridge_slot_key',
      'governed_ordinal',
      'source_local_subject_occurrence_id',
    ]),
    excludedValueFields: Object.freeze([
      'identity_disposition',
      'selected_entity_subject_id',
      'state',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'identity_disposition',
      'normalised_name',
      'selected_entity_subject_id',
      'state',
    ]),
    revisionType: 'EntityIdentityBridgeRevision',
    revisionDomain: 'ENTITY_IDENTITY_BRIDGE_REVISION/V1',
    revisionInputs: Object.freeze([
      'bridge_rule_and_version',
      'conflict_checks',
      'entity_identity_bridge_id',
      'evidence_edges',
      'identity_disposition',
      'review_evidence',
      'selected_entity_subject_id',
      'state',
      'supersession',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrierName: 'entity_identity_bridges',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'ADMIT_ENTITY_IDENTITY_BRIDGE',
    terminalType: 'IDENTITY_BRIDGE_REVISION',
    detailAction: 'ENTITY_IDENTITY_BRIDGE_EVIDENCE',
  }),
  DealParticipantRelationship: Object.freeze({
    stableId: 'DEAL_PARTICIPANT_RELATIONSHIP',
    slotKind: 'DEAL_PARTICIPANT_RELATIONSHIP_SLOT',
    slotSchema: 'DEAL_PARTICIPANT_RELATIONSHIP_SLOT/V1',
    occurrenceDomain: 'DEAL_PARTICIPANT_RELATIONSHIP/V1',
    occurrenceInputs: Object.freeze([
      'bidder_track_slot_key',
      'expected_participant_slot_key',
      'governed_deal_id',
      'governed_ordinal',
      'participant_endpoint_slot_key',
      'role_code',
      'role_layer',
      'transaction_leg_slot_key',
    ]),
    excludedValueFields: Object.freeze([
      'effective_time_scope',
      'entity_subject_id',
      'source_local_subject_occurrence_id',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_name',
      'display_name',
      'entity_subject_id',
      'source_local_subject_occurrence_id',
    ]),
    revisionType: 'DealParticipantRelationshipRevision',
    revisionDomain: 'DEAL_PARTICIPANT_RELATIONSHIP_REVISION/V1',
    revisionInputs: Object.freeze([
      'bidder_track_id',
      'deal_participant_relationship_id',
      'effective_time_scope',
      'entity_subject_id',
      'evidence_edges',
      'relationship_definition_and_version',
      'resolver_version',
      'role_code',
      'role_layer',
      'source_local_subject_occurrence_id',
      'state',
      'transaction_leg_resolution_occurrence_id',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrierName: 'deal_participant_relationships',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'ADMIT_DEAL_PARTICIPANT_RELATIONSHIP',
    terminalType: 'PARTICIPANT_RELATIONSHIP_REVISION',
    detailAction: 'DEAL_PARTICIPANT_RELATIONSHIP_EVIDENCE',
  }),
  SourceTransactionLegOccurrence: Object.freeze({
    stableId: 'SOURCE_TRANSACTION_LEG_OCCURRENCE',
    slotKind: 'SOURCE_TRANSACTION_LEG_SLOT',
    slotSchema: 'SOURCE_TRANSACTION_LEG_SLOT/V1',
    occurrenceDomain: 'SOURCE_TRANSACTION_LEG_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'admitted_source_occurrence_id',
      'expected_source_leg_slot_key',
      'governed_deal_id',
      'governed_repeatable_ordinal',
      'leg_definition_and_version',
    ]),
    excludedValueFields: Object.freeze([
      'leg_type',
      'observed_participant_roles',
      'source_endpoints',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'extracted_value',
      'later_structure_classification',
      'leg_type',
      'party_label',
    ]),
    revisionType: 'SourceTransactionLegRevision',
    revisionDomain: 'SOURCE_TRANSACTION_LEG_REVISION/V1',
    revisionInputs: Object.freeze([
      'closing_condition',
      'effective_time_expression',
      'evidence_edges',
      'leg_type',
      'observed_participant_roles',
      'predecessor_and_successor_occurrence_ids',
      'resolver_version',
      'source_endpoints',
      'source_order',
      'source_transaction_leg_occurrence_id',
      'state',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'source_transaction_leg_occurrences',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_SOURCE_TRANSACTION_LEG_OCCURRENCE',
    terminalType: 'SOURCE_TRANSACTION_LEG_REVISION',
    detailAction: 'SOURCE_TRANSACTION_LEG_EVIDENCE',
  }),
  TransactionLegResolutionOccurrence: Object.freeze({
    stableId: 'TRANSACTION_LEG_RESOLUTION_OCCURRENCE',
    slotKind: 'DEAL_TRANSACTION_LEG_SLOT',
    slotSchema: 'TRANSACTION_LEG_RESOLUTION_SLOT/V1',
    occurrenceDomain: 'TRANSACTION_LEG_RESOLUTION_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'expected_deal_leg_slot_key',
      'governed_deal_id',
      'governed_repeatable_ordinal',
      'leg_definition_and_version',
    ]),
    excludedValueFields: Object.freeze([
      'resolved_participant_relationships',
      'resolved_source_and_target_entities',
      'supporting_source_leg_revisions',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'extracted_value',
      'later_structure_classification',
      'participant_name',
      'source_label',
    ]),
    revisionType: 'TransactionLegResolutionRevision',
    revisionDomain: 'TRANSACTION_LEG_RESOLUTION_REVISION/V1',
    revisionInputs: Object.freeze([
      'closing_conditions',
      'conflict_disposition',
      'effective_time_expression',
      'evidence_edges',
      'predecessor_and_successor_occurrence_ids',
      'resolved_participant_relationships',
      'resolved_source_and_target_entities',
      'resolver_version',
      'state',
      'supporting_source_leg_revisions',
      'transaction_leg_resolution_occurrence_id',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'transaction_leg_resolutions',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'SELECTED_EXACT_SOURCE_EVIDENCE_EDGES',
    writerAction: 'RESOLVE_TRANSACTION_LEG',
    terminalType: 'TRANSACTION_LEG_RESOLUTION_REVISION',
    detailAction: 'TRANSACTION_LEG_RESOLUTION_EVIDENCE',
  }),
  TransactionStructureResolutionOccurrence: Object.freeze({
    stableId: 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE',
    slotKind: 'TRANSACTION_STRUCTURE_RESOLUTION_SLOT',
    slotSchema: 'TRANSACTION_STRUCTURE_RESOLUTION_SLOT/V1',
    occurrenceDomain: 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'effective_time_slot',
      'expected_structure_resolution_slot_key',
      'governed_deal_id',
      'governed_ordinal',
      'structure_resolution_definition_and_version',
    ]),
    excludedValueFields: Object.freeze([
      'characterisation_code',
      'legal_structure_code',
      'selected_transaction_leg_revisions',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'characterisation_code',
      'legal_structure_code',
      'participant_name',
      'source_label',
    ]),
    revisionType: 'TransactionStructureResolutionRevision',
    revisionDomain: 'TRANSACTION_STRUCTURE_RESOLUTION_REVISION/V1',
    revisionInputs: Object.freeze([
      'conflict_disposition',
      'evidence_edges',
      'legal_structure_code',
      'participant_relationship_revisions',
      'resolver_version',
      'source_characterisation_fact_resolutions',
      'state',
      'transaction_leg_resolution_revisions',
      'transaction_structure_resolution_occurrence_id',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'transaction_structure_resolutions',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'SELECTED_EXACT_SOURCE_EVIDENCE_EDGES',
    writerAction: 'RESOLVE_TRANSACTION_STRUCTURE',
    terminalType: 'TRANSACTION_STRUCTURE_RESOLUTION_REVISION',
    detailAction: 'TRANSACTION_STRUCTURE_RESOLUTION_EVIDENCE',
  }),
  TransactionControlOutcomeOccurrence: Object.freeze({
    stableId: 'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE',
    slotKind: 'TRANSACTION_CONTROL_OUTCOME_SLOT',
    slotSchema: 'TRANSACTION_CONTROL_OUTCOME_SLOT/V1',
    occurrenceDomain: 'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'control_outcome_definition_and_version',
      'effective_time_slot',
      'expected_control_outcome_slot_key',
      'governed_deal_id',
      'governed_ordinal',
    ]),
    excludedValueFields: Object.freeze([
      'controlling_entity_ids',
      'control_outcome',
      'ownership_percentage',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'controlling_entity_ids',
      'control_outcome',
      'management_choice',
      'ownership_percentage',
    ]),
    revisionType: 'TransactionControlOutcomeRevision',
    revisionDomain: 'TRANSACTION_CONTROL_OUTCOME_REVISION/V1',
    revisionInputs: Object.freeze([
      'complete_selected_input_set',
      'conflict_disposition',
      'controlling_entity_ids',
      'control_outcome',
      'derivation_rule',
      'effective_time',
      'evidence_edges',
      'resolver_version',
      'state',
      'transaction_control_outcome_occurrence_id',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'transaction_control_outcomes',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'SELECTED_EXACT_SOURCE_EVIDENCE_EDGES',
    writerAction: 'RESOLVE_TRANSACTION_CONTROL_OUTCOME',
    terminalType: 'TRANSACTION_CONTROL_OUTCOME_REVISION',
    detailAction: 'TRANSACTION_CONTROL_OUTCOME_EVIDENCE',
  }),
  SharePurchaseInterestComponent: Object.freeze({
    stableId: 'SHARE_PURCHASE_INTEREST_COMPONENT',
    slotKind: 'SHARE_PURCHASE_INTEREST_COMPONENT_SLOT',
    slotSchema: 'SHARE_PURCHASE_INTEREST_COMPONENT_SLOT/V1',
    occurrenceDomain: 'SHARE_PURCHASE_INTEREST_COMPONENT/V1',
    occurrenceInputs: Object.freeze([
      'acquired_entity_endpoint_key',
      'buyer_endpoint_key',
      'expected_component_slot_key',
      'expected_security_class_slot_key',
      'governed_deal_id',
      'governed_ordinal',
      'selling_shareholder_endpoint_key',
      'transaction_leg_resolution_occurrence_id',
    ]),
    excludedValueFields: Object.freeze([
      'consideration',
      'number_or_percentage_purchased',
      'purchased_security_or_share_class',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'consideration',
      'number_or_percentage_purchased',
      'purchased_security_or_share_class',
      'selected_entity_names',
    ]),
    revisionType: 'SharePurchaseInterestComponentRevision',
    revisionDomain: 'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION/V1',
    revisionInputs: Object.freeze([
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
      'share_purchase_interest_component_id',
      'state',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_COMPONENT_TABLE',
    carrierName: 'share_purchase_interest_components',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_SHARE_PURCHASE_INTEREST_COMPONENT',
    terminalType: 'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION',
    detailAction: 'SHARE_PURCHASE_INTEREST_COMPONENT_EVIDENCE',
  }),
  SourceDealFactOccurrence: Object.freeze({
    stableId: 'SOURCE_DEAL_FACT_OCCURRENCE',
    slotKind: 'SOURCE_DEAL_FACT_SLOT',
    slotSchema: 'SOURCE_DEAL_FACT_OCCURRENCE_SLOT/V1',
    occurrenceDomain: 'SOURCE_DEAL_FACT_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'admitted_source_occurrence_id',
      'effective_time_slot',
      'expected_source_slot_key',
      'fact_definition_and_version',
      'governed_deal_id',
      'governed_repeatable_ordinal',
      'governed_source_role',
    ]),
    excludedValueFields: Object.freeze([
      'basis',
      'canonical_value',
      'raw_source_text',
      'unit',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'basis',
      'canonical_value',
      'normalised_value',
      'raw_source_text',
      'unit',
    ]),
    revisionType: 'SourceDealFactRevision',
    revisionDomain: 'SOURCE_DEAL_FACT_REVISION/V1',
    revisionInputs: Object.freeze([
      'basis',
      'canonical_value',
      'derivation_version',
      'evidence_edges',
      'normalisation_version',
      'raw_source_text',
      'review_state',
      'source_date',
      'source_deal_fact_occurrence_id',
      'source_role',
      'state',
      'unit',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'source_deal_fact_occurrences',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_SOURCE_DEAL_FACT_OCCURRENCE',
    terminalType: 'SOURCE_DEAL_FACT_REVISION',
    detailAction: 'SOURCE_DEAL_FACT_EVIDENCE',
  }),
  DealFactResolutionOccurrence: Object.freeze({
    stableId: 'DEAL_FACT_RESOLUTION_OCCURRENCE',
    slotKind: 'DEAL_FACT_RESOLUTION_SLOT',
    slotSchema: 'DEAL_FACT_RESOLUTION_OCCURRENCE_SLOT/V1',
    occurrenceDomain: 'DEAL_FACT_RESOLUTION_OCCURRENCE/V1',
    occurrenceInputs: Object.freeze([
      'basis_slot',
      'effective_time_slot',
      'expected_resolution_slot_key',
      'fact_definition_and_version',
      'governed_deal_id',
      'governed_ordinal',
    ]),
    excludedValueFields: Object.freeze([
      'canonical_value',
      'resolution_disposition',
      'selected_source_revisions',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'canonical_value',
      'resolution_disposition',
      'selected_source_revision_id',
      'source_order',
    ]),
    revisionType: 'DealFactResolutionRevision',
    revisionDomain: 'DEAL_FACT_RESOLUTION_REVISION/V1',
    revisionInputs: Object.freeze([
      'basis',
      'canonical_value',
      'complete_selected_source_revision_set',
      'conflict_detail',
      'deal_fact_resolution_occurrence_id',
      'derivation',
      'evidence_edges',
      'resolution_disposition',
      'resolver_version',
      'review_evidence',
      'state',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'deal_fact_resolutions',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'SELECTED_EXACT_SOURCE_EVIDENCE_EDGES',
    writerAction: 'RESOLVE_DEAL_FACT',
    terminalType: 'DEAL_FACT_RESOLUTION_REVISION',
    detailAction: 'DEAL_FACT_RESOLUTION_EVIDENCE',
  }),
  TemporalExpression: Object.freeze({
    stableId: 'TEMPORAL_EXPRESSION',
    slotKind: 'TEMPORAL_EXPRESSION_SLOT',
    slotSchema: 'TEMPORAL_EXPRESSION_SLOT/V1',
    occurrenceDomain: 'TEMPORAL_EXPRESSION/V1',
    occurrenceInputs: Object.freeze([
      'admitted_source_occurrence_id',
      'expected_temporal_slot_key',
      'governed_ordinal',
      'governed_subject_id',
      'governed_subject_type',
      'temporal_definition_and_version',
    ]),
    excludedValueFields: Object.freeze([
      'coarse_temporal_state',
      'computed_value',
      'raw_source_expression',
      'structured_nodes',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'coarse_temporal_state',
      'computed_value',
      'raw_source_expression',
      'structured_nodes',
    ]),
    revisionType: 'TemporalExpressionRevision',
    revisionDomain: 'TEMPORAL_EXPRESSION_REVISION/V1',
    revisionInputs: Object.freeze([
      'coarse_temporal_state',
      'computed_derivation',
      'computed_value',
      'evidence_edges',
      'raw_source_expression',
      'source_interval',
      'state',
      'structured_nodes',
      'temporal_expression_id',
      'temporal_registry_version',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_TABLE',
    carrierName: 'temporal_expressions',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'MATERIALISE_TEMPORAL_EXPRESSION',
    terminalType: 'TEMPORAL_EXPRESSION_REVISION',
    detailAction: 'TEMPORAL_EXPRESSION_EVIDENCE',
  }),
  ProfessionalAssignmentRelationship: Object.freeze({
    stableId: 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP',
    slotKind: 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP_SLOT',
    slotSchema: 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP_SLOT/V1',
    occurrenceDomain: 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP/V1',
    occurrenceInputs: Object.freeze([
      'bidder_track_slot_key',
      'effective_time_slot',
      'expected_assignment_slot_key',
      'governed_deal_id',
      'governed_ordinal',
      'professional_endpoint_slot_key',
      'professional_role',
      'represented_endpoint_slot_key',
      'transaction_leg_slot_key',
    ]),
    excludedValueFields: Object.freeze([
      'professional_entity_id',
      'represented_entity_id',
      'source_local_subject_occurrence_ids',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_professional_name',
      'professional_entity_id',
      'represented_entity_id',
      'side_label',
    ]),
    revisionType: 'ProfessionalAssignmentRevision',
    revisionDomain: 'PROFESSIONAL_ASSIGNMENT_REVISION/V1',
    revisionInputs: Object.freeze([
      'bidder_track_id',
      'effective_time_scope',
      'evidence_edges',
      'professional_assignment_reason',
      'professional_assignment_relationship_id',
      'professional_entity_id',
      'professional_role',
      'relationship_definition_and_version',
      'represented_entity_id',
      'resolver_version',
      'source_local_subject_occurrence_ids',
      'state',
      'transaction_leg_resolution_occurrence_id',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrierName: 'professional_assignment_relationships',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'ADMIT_PROFESSIONAL_ASSIGNMENT_RELATIONSHIP',
    terminalType: 'PROFESSIONAL_ASSIGNMENT_REVISION',
    detailAction: 'PROFESSIONAL_ASSIGNMENT_EVIDENCE',
  }),
  LawyerFirmAffiliationRelationship: Object.freeze({
    stableId: 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP',
    slotKind: 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP_SLOT',
    slotSchema: 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP_SLOT/V1',
    occurrenceDomain: 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP/V1',
    occurrenceInputs: Object.freeze([
      'admitted_source_occurrence_id',
      'effective_time_slot',
      'expected_affiliation_slot_key',
      'governed_ordinal',
      'law_firm_endpoint_slot_key',
      'lawyer_endpoint_slot_key',
    ]),
    excludedValueFields: Object.freeze([
      'law_firm_entity_id',
      'lawyer_entity_id',
      'resolved_source_local_occurrences',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'cleaned_firm_name',
      'cleaned_lawyer_name',
      'law_firm_entity_id',
      'lawyer_entity_id',
    ]),
    revisionType: 'LawyerFirmAffiliationRevision',
    revisionDomain: 'LAWYER_FIRM_AFFILIATION_REVISION/V1',
    revisionInputs: Object.freeze([
      'effective_time_expression',
      'evidence_edges',
      'law_firm_endpoint',
      'lawyer_endpoint',
      'lawyer_firm_affiliation_relationship_id',
      'relationship_definition_and_version',
      'resolver_version',
      'source_role',
      'state',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrierName: 'lawyer_firm_affiliation_relationships',
    sourceOccurrenceRequired: true,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'ADMITTED_SOURCE_UTF8_BYTES',
    writerAction: 'ADMIT_LAWYER_FIRM_AFFILIATION_RELATIONSHIP',
    terminalType: 'LAWYER_FIRM_AFFILIATION_REVISION',
    detailAction: 'LAWYER_FIRM_AFFILIATION_EVIDENCE',
  }),
  CanonicalDealFactProjection: Object.freeze({
    stableId: 'CANONICAL_DEAL_FACT_PROJECTION',
    slotKind: 'CANONICAL_DEAL_FACT_PROJECTION_SLOT',
    slotSchema: 'CANONICAL_DEAL_FACT_PROJECTION_SLOT/V1',
    occurrenceDomain: 'CANONICAL_DEAL_FACT_PROJECTION/V1',
    occurrenceInputs: Object.freeze([
      'canonical_contract_fingerprint',
      'serving_namespace_id',
      'corpus_release_id',
      'governed_deal_id',
      'projection_version',
    ]),
    excludedValueFields: Object.freeze([
      'display_label',
      'field_entries',
      'write_credentials',
    ]),
    prohibitedIdentityInputs: Object.freeze([
      'database_row_id',
      'display_label',
      'field_entries',
      'legacy_deal_facts',
      'write_credentials',
    ]),
    revisionType: 'CanonicalDealFactProjectionRevision',
    revisionDomain: 'CANONICAL_DEAL_FACT_PROJECTION_REVISION/V1',
    revisionInputs: Object.freeze([
      'canonical_deal_fact_projection_id',
      'field_entries',
      'projection_payload_digest',
      'release_identity',
      'revision_status',
    ]),
    carrierKind: 'CANDIDATE_RELEASE_PROJECTION_TABLE',
    carrierName: 'canonical_deal_fact_projections',
    sourceOccurrenceRequired: false,
    approvedSeedAttestationPermitted: false,
    evidenceCoordinateSpace: 'SELECTED_TYPED_LINEAGE_AND_RELEASE_IDENTITY',
    writerAction: 'MATERIALISE_CANONICAL_DEAL_FACT_PROJECTION',
    terminalType: 'CANONICAL_DEAL_FACT_PROJECTION_REVISION',
    detailAction: 'CANONICAL_DEAL_FACT_PROJECTION_EVIDENCE',
  }),
});

class SharedAuthorityContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SharedAuthorityContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new SharedAuthorityContractInputError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(orderedExpected)) {
    fail(code, `${label} fields do not match the authored contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function requireExactObject(value, expected, label, code) {
  requireObject(value, label, code);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual: value,
      expected,
    });
  }
}

function validateCommonDefinition(value, spec, code) {
  requireExactKeys(value, COMMON_KEYS, 'shared-authority logical type definition', code);
  if (value.logical_type_version !== 1) {
    fail(code, 'Shared-authority logical type version must be 1.');
  }

  requireExactKeys(value.expected_slot, [
    'slot_kind',
    'slot_schema',
    'identity_inputs',
    'value_fields_excluded_from_identity',
  ], 'expected slot', code);
  if (
    value.expected_slot.slot_kind !== spec.slotKind
    || value.expected_slot.slot_schema !== spec.slotSchema
  ) {
    fail(code, 'Expected slot identity does not match the logical type.');
  }
  requireExactArray(
    value.expected_slot.identity_inputs,
    spec.occurrenceInputs,
    'expected_slot.identity_inputs',
    code,
  );
  requireExactArray(
    value.expected_slot.value_fields_excluded_from_identity,
    spec.excludedValueFields,
    'expected_slot.value_fields_excluded_from_identity',
    code,
  );

  requireExactKeys(value.occurrence_identity, [
    'stable_id_domain',
    'stable_id_inputs',
    'prohibited_inputs',
  ], 'occurrence identity', code);
  if (value.occurrence_identity.stable_id_domain !== spec.occurrenceDomain) {
    fail(code, 'Occurrence identity domain does not match the logical type.');
  }
  const valueIdentityInputs = spec.excludedValueFields.filter(
    (field) => value.occurrence_identity.stable_id_inputs.includes(field),
  );
  if (valueIdentityInputs.length > 0) {
    fail(
      'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
      'A value field cannot define a stable occurrence ID.',
      { value_identity_inputs: valueIdentityInputs },
    );
  }
  requireExactArray(
    value.occurrence_identity.stable_id_inputs,
    spec.occurrenceInputs,
    'occurrence_identity.stable_id_inputs',
    code,
  );
  requireExactArray(
    value.occurrence_identity.prohibited_inputs,
    spec.prohibitedIdentityInputs,
    'occurrence_identity.prohibited_inputs',
    code,
  );

  requireExactKeys(value.revision_identity, [
    'revision_type',
    'revision_id_domain',
    'immutable_inputs',
  ], 'revision identity', code);
  if (
    value.revision_identity.revision_type !== spec.revisionType
    || value.revision_identity.revision_id_domain !== spec.revisionDomain
  ) {
    fail(code, 'Revision identity does not match the logical type.');
  }
  requireExactArray(
    value.revision_identity.immutable_inputs,
    spec.revisionInputs,
    'revision_identity.immutable_inputs',
    code,
  );

  requireExactKeys(value.state_rules, [
    'allowed_states',
    'value_rule_by_state',
  ], 'state rules', code);
  requireExactArray(
    value.state_rules.allowed_states,
    CANONICAL_STATES,
    'state_rules.allowed_states',
    code,
  );
  requireExactObject(
    value.state_rules.value_rule_by_state,
    VALUE_RULE_BY_STATE,
    'state_rules.value_rule_by_state',
    code,
  );

  requireExactKeys(value.evidence_rules, [
    'exact_evidence_required',
    'source_occurrence_required',
    'approved_seed_attestation_permitted',
    'coordinate_space',
    'complete_scope_required_for_absent',
  ], 'evidence rules', code);
  if (
    value.evidence_rules.exact_evidence_required !== true
    || value.evidence_rules.source_occurrence_required !== spec.sourceOccurrenceRequired
    || value.evidence_rules.approved_seed_attestation_permitted
      !== spec.approvedSeedAttestationPermitted
    || value.evidence_rules.coordinate_space !== spec.evidenceCoordinateSpace
    || value.evidence_rules.complete_scope_required_for_absent !== true
  ) {
    fail(code, 'Evidence rules do not preserve exact admitted source evidence.');
  }

  requireExactKeys(value.physical_carrier, [
    'carrier_kind',
    'carrier_name',
    'release_partitioned',
  ], 'physical carrier', code);
  if (
    value.physical_carrier.carrier_kind !== spec.carrierKind
    || value.physical_carrier.carrier_name !== spec.carrierName
    || value.physical_carrier.release_partitioned !== true
  ) {
    fail(code, 'Physical carrier does not match the logical type.');
  }

  requireExactKeys(value.writer_action, [
    'action_key',
    'action_version',
    'candidate_only',
    'current_release_writer_path',
  ], 'writer action', code);
  if (
    value.writer_action.action_key !== spec.writerAction
    || value.writer_action.action_version !== 1
    || value.writer_action.candidate_only !== true
    || value.writer_action.current_release_writer_path !== false
  ) {
    fail(code, 'Writer action grants unsupported authority.');
  }

  requireExactObject(value.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    exact_release_citation_redirect: false,
  }, 'release treatment', code);
  requireExactObject(value.import_treatment, {
    mode: 'WHOLE_RELEASE_ONLY',
    stable_id_preserved: true,
    revision_id_preserved: true,
  }, 'import treatment', code);
  requireExactObject(value.trace_treatment, {
    terminal_type: spec.terminalType,
    occurrence_id_required: true,
    revision_id_required: true,
    evidence_edges_required: true,
  }, 'trace treatment', code);
  requireExactObject(value.exact_detail_treatment, {
    action_key: spec.detailAction,
    exact_evidence_only: true,
    preserve_release_identity: true,
  }, 'exact-detail treatment', code);
  requireExactObject(value.consumer_projection_rule, {
    projection_type: 'CanonicalDealFactProjection',
    terminal_type: spec.terminalType,
    typed_state_required: true,
    release_identity_required: true,
    conflict_indicator_required: true,
  }, 'consumer projection rule', code);
}

function validateEntitySubjectContract(value, code) {
  requireExactKeys(value, [
    'subject_classes',
    'identity_authority_types',
    'evidence_rule_by_identity_authority',
    'classification_codes',
    'display_name_creates_identity',
    'equivalence_requires_reviewed_relationship',
    'conflict_blocks_selection',
  ], 'EntitySubject type contract', code);
  requireExactArray(value.subject_classes, [
    'NATURAL_PERSON',
    'ORGANISATION',
    'GOVERNMENT_BODY',
  ], 'EntitySubject subject classes', code);
  requireExactArray(value.identity_authority_types, [
    'SEC_CIK',
    'LEI',
    'BEN_APPROVED_IMMUTABLE_IMPORT_SEED',
  ], 'EntitySubject identity authorities', code);
  requireExactObject(value.evidence_rule_by_identity_authority, {
    SEC_CIK: 'EXACT_SOURCE_OCCURRENCE_REQUIRED',
    LEI: 'EXACT_SOURCE_OCCURRENCE_REQUIRED',
    BEN_APPROVED_IMMUTABLE_IMPORT_SEED: 'GOVERNED_APPROVAL_ATTESTATION_REQUIRED',
  }, 'EntitySubject evidence rule by identity authority', code);
  requireExactArray(value.classification_codes, [
    'PUBLIC_COMPANY',
    'PRIVATE_COMPANY',
    'INVESTMENT_FIRM',
    'LAW_FIRM',
    'FINANCIAL_SERVICES_FIRM',
    'OTHER_ORGANISATION',
  ], 'EntitySubject classifications', code);
  if (
    value.display_name_creates_identity !== false
    || value.equivalence_requires_reviewed_relationship !== true
    || value.conflict_blocks_selection !== true
  ) {
    fail(
      'SHARED_AUTHORITY_DISPLAY_NAME_IDENTITY_FORBIDDEN',
      'A display name cannot create or unify an EntitySubject.',
    );
  }
}

function validateEntityNameContract(value, code) {
  requireExactKeys(value, [
    'name_roles',
    'identity_is_text_independent',
    'unresolved_source_local_name_permitted',
    'entity_subject_reference_required',
  ], 'EntityNameOccurrence type contract', code);
  requireExactArray(value.name_roles, [
    'LEGAL_NAME',
    'SHORT_NAME',
    'SOURCE_LOCAL_LABEL',
  ], 'EntityNameOccurrence name roles', code);
  if (
    value.identity_is_text_independent !== true
    || value.unresolved_source_local_name_permitted !== true
    || value.entity_subject_reference_required !== false
  ) {
    fail(code, 'A source name must remain separate from entity identity.');
  }
}

function validateEntityIdentityBridgeContract(value, code) {
  requireExactKeys(value, [
    'identity_dispositions',
    'permitted_terminal_combinations',
    'candidate_only_dispositions',
    'normalised_name_match_sufficient',
    'conflict_blocks_terminal_selection',
  ], 'EntityIdentityBridge type contract', code);
  requireExactArray(value.identity_dispositions, [
    'NAMED',
    'GOVERNED_BRIDGE_CONFIRMED',
    'SOURCE_LOCAL_ONLY',
    'CONFLICTING',
    'NO_BRIDGE_WITNESS',
  ], 'EntityIdentityBridge dispositions', code);
  requireExactArray(value.permitted_terminal_combinations, [
    'PRESENT:NAMED',
    'PRESENT:GOVERNED_BRIDGE_CONFIRMED',
    'ABSENT:NO_BRIDGE_WITNESS',
    'NOT_EXAMINED:SOURCE_LOCAL_ONLY',
    'NOT_APPLICABLE:SOURCE_LOCAL_ONLY',
    'FAILED:NONE',
  ], 'EntityIdentityBridge terminal combinations', code);
  requireExactArray(
    value.candidate_only_dispositions,
    ['CONFLICTING'],
    'EntityIdentityBridge candidate-only dispositions',
    code,
  );
  if (
    value.normalised_name_match_sufficient !== false
    || value.conflict_blocks_terminal_selection !== true
  ) {
    fail(code, 'A normalised name cannot prove an identity bridge.');
  }
}

function validateDealParticipantContract(value, code) {
  requireExactKeys(value, [
    'role_layers',
    'legal_roles',
    'transaction_roles',
    'target_and_buyer_optional',
    'combination_party_permitted_without_target_or_buyer',
    'role_inheritance_from_side_label',
    'surviving_entity_infers_buyer',
    'share_issuer_infers_buyer',
    'share_issuer_infers_control',
    'bidder_track_scope_required_when_role_varies',
  ], 'DealParticipantRelationship type contract', code);
  requireExactArray(value.role_layers, [
    'LEGAL_DOCUMENT_ROLE',
    'TRANSACTION_ROLE',
  ], 'DealParticipantRelationship role layers', code);
  requireExactArray(value.legal_roles, [
    'COMPANY',
    'PARENT',
    'MERGER_SUB',
    'ACQUIROR',
    'ISSUER',
    'SELLER',
    'SURVIVING_ENTITY',
    'CONSTITUENT_ENTITY',
    'NEW_HOLDCO',
    'DISTRIBUTING_PARENT',
    'SPINCO',
    'REMAINCO',
    'OTHER_LEGAL_PARTY',
  ], 'DealParticipantRelationship legal roles', code);
  requireExactArray(value.transaction_roles, [
    'TARGET',
    'BUYER',
    'BIDDER',
    'COMBINATION_PARTY',
    'SPONSOR',
    'CONSORTIUM_MEMBER',
    'DIVESTING_PARENT',
    'CONTRIBUTING_PARTY',
    'ACQUIRED_BUSINESS',
    'ACQUIRED_ENTITY',
    'SELLING_SHAREHOLDER',
    'MERGER_COUNTERPARTY',
    'OTHER_COUNTERPARTY',
  ], 'DealParticipantRelationship transaction roles', code);
  if (
    value.target_and_buyer_optional !== true
    || value.combination_party_permitted_without_target_or_buyer !== true
    || value.role_inheritance_from_side_label !== false
    || value.surviving_entity_infers_buyer !== false
    || value.share_issuer_infers_buyer !== false
    || value.share_issuer_infers_control !== false
    || value.bidder_track_scope_required_when_role_varies !== true
  ) {
    fail(code, 'Participant roles collapse legal form, commercial role, or bidder track.');
  }
}

function validateSourceTransactionLegContract(value, code) {
  requireExactKeys(value, [
    'leg_types',
    'exact_source_endpoints_required_when_present',
    'predecessor_and_successor_links_permitted',
    'source_order_required',
    'later_structure_classification_creates_identity',
  ], 'SourceTransactionLegOccurrence type contract', code);
  requireExactArray(value.leg_types, [
    'DIRECT_MERGER',
    'FORWARD_TRIANGULAR_MERGER',
    'REVERSE_TRIANGULAR_MERGER',
    'TENDER_OFFER',
    'SECOND_STEP_MERGER',
    'DISTRIBUTION_OR_SPIN_OFF',
    'CONTRIBUTION',
    'SHARE_EXCHANGE',
    'SHARE_PURCHASE',
    'ASSET_TRANSFER',
    'NEW_HOLDCO_FORMATION',
    'OTHER_GOVERNED_STEP',
  ], 'SourceTransactionLegOccurrence leg types', code);
  if (
    value.exact_source_endpoints_required_when_present !== true
    || value.predecessor_and_successor_links_permitted !== true
    || value.source_order_required !== true
    || value.later_structure_classification_creates_identity !== false
  ) {
    fail(code, 'Source transaction legs do not preserve source-local legal steps.');
  }
}

function validateTransactionLegResolutionContract(value, code) {
  requireExactKeys(value, [
    'complete_ordered_supporting_source_legs_required',
    'resolved_participant_relationships_required',
    'resolved_source_and_target_entities_required',
    'unreconciled_duplicate_blocks_structure_resolution',
    'participant_relationship_scope',
  ], 'TransactionLegResolutionOccurrence type contract', code);
  requireExactArray(value.participant_relationship_scope, [
    'WHOLE_TRANSACTION',
    'ONE_TRANSACTION_LEG',
  ], 'TransactionLegResolutionOccurrence participant relationship scope', code);
  if (
    value.complete_ordered_supporting_source_legs_required !== true
    || value.resolved_participant_relationships_required !== true
    || value.resolved_source_and_target_entities_required !== true
    || value.unreconciled_duplicate_blocks_structure_resolution !== true
  ) {
    fail(code, 'Deal-level transaction leg resolution is not complete.');
  }
}

function validateTransactionStructureContract(value, code) {
  requireExactKeys(value, [
    'legal_structure_codes',
    'characterisation_codes',
    'source_characterisation_is_separate_fact',
    'merger_of_equals_requires_exact_source_language',
    'reverse_merger_is_not_reverse_triangular_merger',
    'rmt_requires_stated_distribution_reorganisation_and_merger',
    'new_holdco_infers_buyer',
    'new_holdco_infers_control',
    'share_purchase_becomes_asset_acquisition',
    'required_separate_leg_groups',
  ], 'TransactionStructureResolutionOccurrence type contract', code);
  requireExactArray(value.legal_structure_codes, [
    'DIRECT_MERGER',
    'FORWARD_TRIANGULAR_MERGER',
    'REVERSE_TRIANGULAR_MERGER',
    'REVERSE_MERGER',
    'REVERSE_MORRIS_TRUST',
    'TENDER_OFFER_WITH_SECOND_STEP_MERGER',
    'NEW_HOLDCO_COMBINATION',
    'SHARE_PURCHASE',
    'ASSET_ACQUISITION',
    'SHARE_EXCHANGE',
    'SPIN_MERGE',
    'DE_SPAC',
    'JOINT_VENTURE_COMBINATION',
    'OTHER_REVIEWED_STRUCTURE',
  ], 'TransactionStructureResolutionOccurrence legal structure codes', code);
  requireExactArray(value.characterisation_codes, [
    'ACQUISITION',
    'MERGER_OF_EQUALS_STATED',
    'COMBINATION',
    'STRATEGIC_MERGER',
    'DIVESTITURE',
  ], 'TransactionStructureResolutionOccurrence characterisation codes', code);
  requireExactObject(value.required_separate_leg_groups, {
    REVERSE_MORRIS_TRUST: [
      ['DISTRIBUTION_OR_SPIN_OFF'],
      ['CONTRIBUTION', 'OTHER_GOVERNED_STEP'],
      [
        'DIRECT_MERGER',
        'FORWARD_TRIANGULAR_MERGER',
        'REVERSE_TRIANGULAR_MERGER',
        'OTHER_GOVERNED_STEP',
      ],
    ],
    TENDER_OFFER_WITH_SECOND_STEP_MERGER: [
      ['TENDER_OFFER'],
      ['SECOND_STEP_MERGER'],
    ],
  }, 'TransactionStructureResolutionOccurrence required separate legs', code);
  if (
    value.source_characterisation_is_separate_fact !== true
    || value.merger_of_equals_requires_exact_source_language !== true
    || value.reverse_merger_is_not_reverse_triangular_merger !== true
    || value.rmt_requires_stated_distribution_reorganisation_and_merger !== true
    || value.new_holdco_infers_buyer !== false
    || value.new_holdco_infers_control !== false
    || value.share_purchase_becomes_asset_acquisition !== false
  ) {
    fail(code, 'Transaction structure collapses legal form, characterisation, or control.');
  }
}

function validateTransactionControlContract(value, code) {
  requireExactKeys(value, [
    'control_outcomes',
    'complete_selected_input_families',
    'single_inputs_never_decide_control',
    'participant_label_infers_control',
    'surviving_entity_infers_control',
    'share_issuer_infers_control',
    'absent_does_not_mean_no_controller',
  ], 'TransactionControlOutcomeOccurrence type contract', code);
  requireExactArray(value.control_outcomes, [
    'CONTROLLED_BY_ONE_PARTICIPANT',
    'SHARED_CONTROL',
    'NEW_HOLDCO_SHARED_CONTROL',
    'NO_CLEAR_CONTROL',
  ], 'TransactionControlOutcomeOccurrence outcomes', code);
  requireExactArray(value.complete_selected_input_families, [
    'PARTICIPANT_RELATIONSHIP_REVISIONS',
    'TRANSACTION_LEG_RESOLUTION_REVISIONS',
    'VOTING_OWNERSHIP_FACT_RESOLUTIONS',
    'BOARD_COMPOSITION_FACT_RESOLUTIONS',
    'MANAGEMENT_FACT_RESOLUTIONS',
    'SOURCE_CHARACTERISATION_FACT_RESOLUTIONS',
    'EXACT_EVIDENCE_EDGES',
  ], 'TransactionControlOutcomeOccurrence selected input families', code);
  requireExactArray(value.single_inputs_never_decide_control, [
    'COMPANY_NAME',
    'HEADQUARTERS',
    'CHIEF_EXECUTIVE',
    'SURVIVING_ENTITY',
    'SHARE_ISSUER',
    'RELATIVE_OWNERSHIP',
  ], 'TransactionControlOutcomeOccurrence non-decisive inputs', code);
  if (
    value.participant_label_infers_control !== false
    || value.surviving_entity_infers_control !== false
    || value.share_issuer_infers_control !== false
    || value.absent_does_not_mean_no_controller !== true
  ) {
    fail(code, 'Control outcome is inferred from an unsupported single fact.');
  }
}

function validateSharePurchaseContract(value, code) {
  requireExactKeys(value, [
    'required_endpoint_roles',
    'ownership_paths',
    'acquisition_states',
    'security_class_required_when_present',
    'amount_or_percentage_preserved_when_stated',
    'consideration_bound_to_component',
    'independent_parallel_arrays_permitted',
    'converts_to_asset_acquisition',
    'query_group_and_export_use_complete_component',
  ], 'SharePurchaseInterestComponent type contract', code);
  requireExactArray(value.required_endpoint_roles, [
    'BUYER',
    'ACQUIRED_ENTITY',
    'SELLING_SHAREHOLDER',
  ], 'SharePurchaseInterestComponent endpoint roles', code);
  requireExactArray(value.ownership_paths, [
    'DIRECT',
    'INDIRECT',
    'MIXED',
    'NOT_STATED',
  ], 'SharePurchaseInterestComponent ownership paths', code);
  requireExactArray(value.acquisition_states, [
    'PARTIAL',
    'FULL',
    'NOT_STATED',
  ], 'SharePurchaseInterestComponent acquisition states', code);
  if (
    value.security_class_required_when_present !== true
    || value.amount_or_percentage_preserved_when_stated !== true
    || value.consideration_bound_to_component !== true
    || value.independent_parallel_arrays_permitted !== false
    || value.converts_to_asset_acquisition !== false
    || value.query_group_and_export_use_complete_component !== true
  ) {
    fail(code, 'Share-purchase component loses an endpoint, interest, or consideration binding.');
  }
}

function validateSourceDealFactContract(value, code) {
  requireExactKeys(value, [
    'fact_families',
    'value_types',
    'source_roles',
    'announcement_release_preferred_for_stated_headline_value',
    'preferred_source_silently_overrides_other_sources',
    'different_basis_is_automatic_conflict',
    'same_basis_same_time_difference_creates_conflict',
    'cvr_expected_payment_requires_later_governed_method',
    'empty_string_represents_state',
    'absent_requires_zero_witness_proof',
  ], 'SourceDealFactOccurrence type contract', code);
  requireExactArray(value.fact_families, [
    'DEAL_ANNOUNCEMENT_DATE',
    'AGREEMENT_SIGNING_DATE',
    'CLOSING_DATE',
    'SECTOR',
    'JURISDICTION',
    'TRANSACTION_LEGAL_STRUCTURE',
    'TRANSACTION_SOURCE_CHARACTERISATION',
    'TRANSACTION_CONTROL_OUTCOME',
    'POST_CLOSING_VOTING_OWNERSHIP',
    'POST_CLOSING_BOARD_COMPOSITION',
    'BUYER_TYPE',
    'CONSIDERATION_FORM',
    'CONSIDERATION_COMPONENT',
    'HEADLINE_PRICE_PER_SHARE',
    'STATED_TRANSACTION_VALUE',
    'STATED_VALUE_BASIS',
    'OUTSTANDING_SHARE_OR_SECURITY_COUNT',
    'DEBT_OR_CASH_ADJUSTMENT',
    'REGISTERED_DERIVATION_INPUT',
  ], 'SourceDealFactOccurrence fact families', code);
  requireExactArray(value.value_types, [
    'EQUITY_VALUE',
    'ENTERPRISE_VALUE',
    'HEADLINE_TRANSACTION_VALUE',
    'OFFER_PRICE_PER_SHARE',
    'STOCK_EXCHANGE_RATIO',
    'TARGET_PAID_DIVIDEND',
    'CVR_MAXIMUM_PAYMENT',
    'CVR_EXPECTED_PAYMENT',
    'OTHER_STATED_VALUE',
  ], 'SourceDealFactOccurrence value types', code);
  requireExactArray(value.source_roles, [
    'ANNOUNCEMENT_PRESS_RELEASE',
    'MERGER_AGREEMENT',
    'PROXY_STATEMENT',
    'SCHEDULE_14D_9',
    'SCHEDULE_TO',
    'AMENDMENT',
    'CLOSING_RELEASE',
    'NOTICES_PROVISION',
    'OTHER_REGISTERED_SOURCE_ROLE',
  ], 'SourceDealFactOccurrence source roles', code);
  if (
    value.announcement_release_preferred_for_stated_headline_value !== true
    || value.preferred_source_silently_overrides_other_sources !== false
    || value.different_basis_is_automatic_conflict !== false
    || value.same_basis_same_time_difference_creates_conflict !== true
    || value.cvr_expected_payment_requires_later_governed_method !== true
    || value.empty_string_represents_state !== false
    || value.absent_requires_zero_witness_proof !== true
  ) {
    fail(code, 'Source deal-fact rules erase source, basis, time, or state distinctions.');
  }
}

function validateDealFactResolutionContract(value, code) {
  requireExactKeys(value, [
    'resolution_dispositions',
    'permitted_terminal_combinations',
    'candidate_only_dispositions',
    'complete_ordered_source_revision_set_required',
    'unresolved_conflict_blocks_filter_group_sort_and_denominator',
    'selection_preserves_all_source_statements',
    'registered_derivation_required_for_normalised_equity_value',
    'normalised_equity_derivation_inputs',
    'enterprise_value_can_be_renamed_equity_value',
    'cvr_ceiling_can_be_treated_as_certain_cash',
    'target_paid_dividend_requires_approved_inclusion_rule',
    'incompatible_dates_can_be_combined',
    'unexplained_share_count_permitted',
    'cross_deal_derivation_input_permitted',
  ], 'DealFactResolutionOccurrence type contract', code);
  requireExactArray(value.resolution_dispositions, [
    'SELECTED_EXACT_STATEMENT',
    'SELECTED_REGISTERED_DERIVATION',
    'CONSISTENT_MULTI_SOURCE',
    'RESOLVED_SOURCE_CONFLICT',
    'UNDISCLOSED',
    'NOT_EXAMINED',
    'NOT_APPLICABLE',
    'UNRESOLVED_CONFLICT',
    'FAILED',
  ], 'DealFactResolutionOccurrence dispositions', code);
  requireExactArray(value.permitted_terminal_combinations, [
    'PRESENT:SELECTED_EXACT_STATEMENT',
    'PRESENT:SELECTED_REGISTERED_DERIVATION',
    'PRESENT:CONSISTENT_MULTI_SOURCE',
    'PRESENT:RESOLVED_SOURCE_CONFLICT',
    'ABSENT:UNDISCLOSED',
    'NOT_EXAMINED:NOT_EXAMINED',
    'NOT_APPLICABLE:NOT_APPLICABLE',
    'FAILED:FAILED',
  ], 'DealFactResolutionOccurrence terminal combinations', code);
  requireExactArray(
    value.candidate_only_dispositions,
    ['UNRESOLVED_CONFLICT'],
    'DealFactResolutionOccurrence candidate-only dispositions',
    code,
  );
  requireExactArray(value.normalised_equity_derivation_inputs, [
    'INPUT_FACT_RESOLUTIONS',
    'INPUT_VALUE_AND_UNIT',
    'EFFECTIVE_DATE',
    'SHARE_OR_SECURITY_CLASS',
    'INCLUSION_RULE',
    'EXCLUSION_RULE',
    'ARITHMETIC_OPERATION',
    'ROUNDING_RULE',
    'RESULT',
    'EXACT_SOURCE_EVIDENCE_FOR_EACH_INPUT',
  ], 'DealFactResolutionOccurrence equity derivation inputs', code);
  if (
    value.complete_ordered_source_revision_set_required !== true
    || value.unresolved_conflict_blocks_filter_group_sort_and_denominator !== true
    || value.selection_preserves_all_source_statements !== true
    || value.registered_derivation_required_for_normalised_equity_value !== true
    || value.enterprise_value_can_be_renamed_equity_value !== false
    || value.cvr_ceiling_can_be_treated_as_certain_cash !== false
    || value.target_paid_dividend_requires_approved_inclusion_rule !== true
    || value.incompatible_dates_can_be_combined !== false
    || value.unexplained_share_count_permitted !== false
    || value.cross_deal_derivation_input_permitted !== false
  ) {
    fail(code, 'Deal-fact resolution loses source conflicts or invents economics.');
  }
}

function validateTemporalExpressionContract(value, code) {
  requireExactKeys(value, [
    'consumer_domains',
    'coarse_temporal_states',
    'raw_source_expression_required',
    'structured_node_registry',
    'structured_node_release_permitted',
    'pilot_can_record_raw_expressions',
    'pilot_can_certify_structured_nodes',
    'runtime_node_admission_permitted',
    'new_node_requires_successor_contract_and_fixtures',
    'computed_value_requires_complete_derivation',
    'computed_value_replaces_source_expression',
    'unsupported_structure_state',
  ], 'TemporalExpression type contract', code);
  requireExactArray(value.consumer_domains, [
    'DEAL_FACT',
    'PARTICIPANT_ROLE',
    'PROFESSIONAL_ASSIGNMENT',
    'PROCESS_EVENT',
    'CVR_MILESTONE',
  ], 'TemporalExpression consumer domains', code);
  requireExactArray(value.coarse_temporal_states, [
    'EXPLICIT_DATE',
    'STATED_DURATION',
    'RELATIVE_OR_CONDITIONAL',
    'UNRESOLVED',
  ], 'TemporalExpression coarse states', code);
  requireExactArray(
    value.structured_node_registry,
    [],
    'TemporalExpression structured node registry',
    code,
  );
  if (
    value.raw_source_expression_required !== true
    || value.structured_node_release_permitted !== false
    || value.pilot_can_record_raw_expressions !== true
    || value.pilot_can_certify_structured_nodes !== false
    || value.runtime_node_admission_permitted !== false
    || value.new_node_requires_successor_contract_and_fixtures !== true
    || value.computed_value_requires_complete_derivation !== true
    || value.computed_value_replaces_source_expression !== false
    || value.unsupported_structure_state !== 'UNRESOLVED'
  ) {
    fail(code, 'Temporal expression contract invents or silently admits structured time.');
  }
}

function validateProfessionalAssignmentContract(value, code) {
  requireExactKeys(value, [
    'professional_roles',
    'assignment_reasons',
    'permitted_terminal_combinations',
    'absent_state_meaning',
    'absent_state_proves_no_professional_engaged',
    'candidate_only_reasons',
    'professional_endpoints_per_assignment_occurrence',
    'several_professionals_use_separate_occurrences',
    'represented_endpoints_per_assignment_occurrence',
    'silence_proves_no_adviser',
    'no_adviser_stated_requires_positive_fact_evidence',
    'role_inheritance_from_general_side_label',
    'bidder_track_required_when_assignment_varies_by_bidder',
    'affiliation_use_requires_matching_source_and_time_scope',
  ], 'ProfessionalAssignmentRelationship type contract', code);
  requireExactArray(value.professional_roles, [
    'LEGAL_COUNSEL',
    'FINANCIAL_ADVISER',
    'SPECIAL_COMMITTEE_COUNSEL',
    'BOARD_COUNSEL',
    'FINANCING_COUNSEL',
    'REGULATORY_COUNSEL',
    'NAMED_LAWYER',
  ], 'ProfessionalAssignmentRelationship professional roles', code);
  requireExactArray(value.assignment_reasons, [
    'DISCLOSED',
    'UNDISCLOSED',
    'NO_ADVISER_STATED',
    'CONFLICTING_ASSIGNMENTS',
    'OUTSIDE_REQUIRED_SOURCE_SCOPE',
    'EXTRACTION_FAILED',
  ], 'ProfessionalAssignmentRelationship reasons', code);
  requireExactArray(value.permitted_terminal_combinations, [
    'PRESENT:DISCLOSED',
    'ABSENT:UNDISCLOSED',
    'NOT_APPLICABLE:NO_ADVISER_STATED',
    'NOT_EXAMINED:OUTSIDE_REQUIRED_SOURCE_SCOPE',
    'FAILED:EXTRACTION_FAILED',
  ], 'ProfessionalAssignmentRelationship terminal combinations', code);
  requireExactArray(
    value.candidate_only_reasons,
    ['CONFLICTING_ASSIGNMENTS'],
    'ProfessionalAssignmentRelationship candidate-only reasons',
    code,
  );
  if (
    value.absent_state_meaning
      !== 'NO_DISCLOSED_ASSIGNMENT_IN_COMPLETE_REQUIRED_SOURCE_SCOPE'
    || value.absent_state_proves_no_professional_engaged !== false
    || value.professional_endpoints_per_assignment_occurrence !== 'EXACTLY_ONE'
    || value.several_professionals_use_separate_occurrences !== true
    || value.represented_endpoints_per_assignment_occurrence !== 'EXACTLY_ONE'
    || value.silence_proves_no_adviser !== false
    || value.no_adviser_stated_requires_positive_fact_evidence !== true
    || value.role_inheritance_from_general_side_label !== false
    || value.bidder_track_required_when_assignment_varies_by_bidder !== true
    || value.affiliation_use_requires_matching_source_and_time_scope !== true
  ) {
    fail(code, 'Professional assignment loses a party, bidder, role, or evidence boundary.');
  }
}

function validateLawyerFirmAffiliationContract(value, code) {
  requireExactKeys(value, [
    'lawyer_endpoint_subject_class',
    'law_firm_endpoint_classification',
    'effective_time_expression_required',
    'name_match_sufficient',
    'firm_level_deal_assignment_sufficient',
    'text_proximity_sufficient',
    'professional_assignment_use_requires_matching_source_scope',
    'professional_assignment_use_requires_matching_time_scope',
    'unresolved_source_local_lawyer_name_remains_displayable',
    'unresolved_affiliation_blocks_canonical_firm_filter',
  ], 'LawyerFirmAffiliationRelationship type contract', code);
  if (
    value.lawyer_endpoint_subject_class !== 'NATURAL_PERSON'
    || value.law_firm_endpoint_classification !== 'LAW_FIRM'
    || value.effective_time_expression_required !== true
    || value.name_match_sufficient !== false
    || value.firm_level_deal_assignment_sufficient !== false
    || value.text_proximity_sufficient !== false
    || value.professional_assignment_use_requires_matching_source_scope !== true
    || value.professional_assignment_use_requires_matching_time_scope !== true
    || value.unresolved_source_local_lawyer_name_remains_displayable !== true
    || value.unresolved_affiliation_blocks_canonical_firm_filter !== true
  ) {
    fail(code, 'Lawyer-firm affiliation is inferred without exact source and time scope.');
  }
}

function validateCanonicalDealFactProjectionContract(value, code) {
  requireExactKeys(value, [
    'release_identity_inputs',
    'field_entry_required_keys',
    'terminal_lineage_types',
    'admitted_fields_only',
    'selected_revision_required',
    'generic_revision_id_permitted',
    'complete_release_identity_per_field',
    'conflict_indicator_required',
    'derivation_reference_required_when_applicable',
    'exact_detail_action_from_terminal_lineage',
    'write_credential_in_projection',
    'direct_write_path',
    'legacy_value_fallback',
    'same_release_live_and_pinned_rows_equal',
  ], 'CanonicalDealFactProjection type contract', code);
  requireExactArray(value.release_identity_inputs, [
    'canonical_contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
    'governed_deal_id',
    'projection_version',
  ], 'CanonicalDealFactProjection release identity', code);
  requireExactArray(value.field_entry_required_keys, [
    'field_key',
    'field_version',
    'canonical_value',
    'display_label',
    'typed_state',
    'typed_lineage',
    'exact_detail_action',
    'conflict_indicator',
    'derivation_reference',
    'release_identity',
  ], 'CanonicalDealFactProjection field entry keys', code);
  requireExactArray(value.terminal_lineage_types, [
    'ENTITY_REVISION',
    'ENTITY_NAME_REVISION',
    'IDENTITY_BRIDGE_REVISION',
    'DEAL_FACT_RESOLUTION_REVISION',
    'PARTICIPANT_RELATIONSHIP_REVISION',
    'PROFESSIONAL_ASSIGNMENT_REVISION',
    'LAWYER_FIRM_AFFILIATION_REVISION',
    'TRANSACTION_LEG_RESOLUTION_REVISION',
    'TRANSACTION_STRUCTURE_RESOLUTION_REVISION',
    'TRANSACTION_CONTROL_OUTCOME_REVISION',
    'SHARE_PURCHASE_INTEREST_COMPONENT_REVISION',
    'REGISTERED_DERIVATION',
  ], 'CanonicalDealFactProjection terminal lineage types', code);
  if (
    value.admitted_fields_only !== true
    || value.selected_revision_required !== true
    || value.generic_revision_id_permitted !== false
    || value.complete_release_identity_per_field !== true
    || value.conflict_indicator_required !== true
    || value.derivation_reference_required_when_applicable !== true
    || value.exact_detail_action_from_terminal_lineage !== true
    || value.write_credential_in_projection !== false
    || value.direct_write_path !== false
    || value.legacy_value_fallback !== false
    || value.same_release_live_and_pinned_rows_equal !== true
  ) {
    fail(code, 'Canonical deal facts are not typed, release-pinned, and read-only.');
  }
}

const CURRENT_PM_BASELINE_FIELD_KEYS = Object.freeze([
  'deal',
  'signed',
  'buyer',
  'value',
  'type',
  'structure',
  'buyer_type',
  'sector',
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
  'merger_form',
]);

const FIELD_GROUPS = Object.freeze([
  'DEAL_IDENTITY',
  'CHRONOLOGY',
  'PARTIES',
  'ECONOMICS',
  'TRANSACTION_STRUCTURE',
  'CLASSIFICATIONS',
  'PROFESSIONALS',
]);

const CONTROL_TYPE_BY_VALUE_TYPE = Object.freeze({
  DEAL_REFERENCE: 'SEARCH_SELECT',
  DATE: 'DATE_RANGE',
  ENTITY_REFERENCE: 'ENTITY_MULTISELECT',
  MONEY_WITH_BASIS: 'NUMBER_RANGE_WITH_BASIS',
  ENUM: 'ENUM_MULTISELECT',
  PROFESSIONAL_ASSIGNMENT: 'PROFESSIONAL_MULTISELECT',
});

const FIELD_OPERATORS = new Set([
  'EQ',
  'IN',
  'SEARCH',
  'BEFORE',
  'AFTER',
  'BETWEEN',
  'YEAR_EQ',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'EXISTS',
  'NONE',
  'ALL',
]);

function validateSharedFieldDefinition(field, code, index) {
  const label = `shared field definition ${index}`;
  requireExactKeys(field, [
    'field_key',
    'field_version',
    'label',
    'field_group',
    'value_type',
    'permitted_domains',
    'capabilities',
    'permitted_operators',
    'control_type',
    'missing_state_behaviour',
    'projection_path',
    'filter_scope',
    'multiplicity',
    'incomplete_collection_behaviour',
    'identity_filter_uses_canonical_id',
    'legacy_filter_authority',
    'active_only_if_release_admitted',
    'source_detail_action',
    'unavailable_request_result',
  ], label, code);
  if (
    field.field_key !== CURRENT_PM_BASELINE_FIELD_KEYS[index]
    || field.field_version !== 1
    || typeof field.label !== 'string'
    || field.label.length === 0
    || !FIELD_GROUPS.includes(field.field_group)
    || !Object.hasOwn(CONTROL_TYPE_BY_VALUE_TYPE, field.value_type)
    || field.control_type !== CONTROL_TYPE_BY_VALUE_TYPE[field.value_type]
    || typeof field.projection_path !== 'string'
    || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(field.projection_path)
  ) {
    fail(code, `${label} identity, type, control, or projection path is invalid.`);
  }
  requireExactArray(
    field.permitted_domains,
    ['AGREEMENT', 'PROCESS'],
    `${label} permitted domains`,
    code,
  );
  requireExactKeys(
    field.capabilities,
    ['display', 'filter', 'sort', 'group'],
    `${label} capabilities`,
    code,
  );
  if (
    field.capabilities.display !== true
    || field.capabilities.filter !== true
    || typeof field.capabilities.sort !== 'boolean'
    || typeof field.capabilities.group !== 'boolean'
    || !Array.isArray(field.permitted_operators)
    || field.permitted_operators.length === 0
    || new Set(field.permitted_operators).size !== field.permitted_operators.length
    || field.permitted_operators.some((operator) => !FIELD_OPERATORS.has(operator))
  ) {
    fail(code, `${label} is not a complete user-facing PM field.`);
  }
  if (
    !['ONE', 'ZERO_OR_ONE', 'MANY'].includes(field.multiplicity)
    || !['NOT_APPLICABLE', 'UNKNOWN'].includes(field.incomplete_collection_behaviour)
    || ![
      'UNAVAILABLE_IF_NOT_ADMITTED',
      'TYPED_STATE_NOT_EMPTY_STRING',
      'UNKNOWN_IF_COLLECTION_INCOMPLETE',
    ].includes(field.missing_state_behaviour)
    || field.legacy_filter_authority !== false
    || field.active_only_if_release_admitted !== true
    || field.source_detail_action !== 'PROJECTED_TERMINAL_LINEAGE_ACTION'
    || field.unavailable_request_result !== 'FIELD_UNAVAILABLE_IN_SELECTED_RELEASE'
  ) {
    fail(code, `${label} can create legacy authority, false emptiness, or a false zero.`);
  }
  if (field.multiplicity === 'MANY') {
    if (
      field.incomplete_collection_behaviour !== 'UNKNOWN'
      || field.missing_state_behaviour !== 'UNKNOWN_IF_COLLECTION_INCOMPLETE'
    ) {
      fail(code, `${label} does not preserve three-valued collection completeness.`);
    }
  } else if (field.incomplete_collection_behaviour !== 'NOT_APPLICABLE') {
    fail(code, `${label} applies repeatable collection semantics to a scalar field.`);
  }
  if (field.value_type === 'PROFESSIONAL_ASSIGNMENT') {
    if (
      field.field_group !== 'PROFESSIONALS'
      || field.filter_scope !== 'SAME_PROFESSIONAL_ASSIGNMENT_COMPONENT'
      || field.multiplicity !== 'MANY'
      || field.identity_filter_uses_canonical_id !== true
      || !field.permitted_operators.includes('ALL')
    ) {
      fail(code, `${label} can cross-join professional assignments or use text identity.`);
    }
  } else if (field.permitted_operators.includes('ALL')) {
    fail(code, `${label} uses a repeatable-set quantifier outside a governed component.`);
  }
}

function validateFieldCatalogueMember(member) {
  const code = 'INVALID_SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'catalogue_version',
    'field_groups',
    'current_pm_baseline_field_keys',
    'field_definitions',
    'catalogue_contract',
  ], 'shared-authority field catalogue input', code);
  if (
    value.object_kind !== SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_KIND
    || value.schema_version !== SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_SCHEMA
    || value.stable_id !== 'SHARED_DEAL_FIELD_CATALOGUE'
    || value.catalogue_version !== 1
  ) {
    fail(code, 'Shared field catalogue identity is not registered.');
  }
  requireExactArray(value.field_groups, FIELD_GROUPS, 'shared field groups', code);
  requireExactArray(
    value.current_pm_baseline_field_keys,
    CURRENT_PM_BASELINE_FIELD_KEYS,
    'current PM baseline field keys',
    code,
  );
  if (
    !Array.isArray(value.field_definitions)
    || value.field_definitions.length !== CURRENT_PM_BASELINE_FIELD_KEYS.length
  ) {
    fail(code, 'The shared field catalogue does not contain all 15 current PM fields.');
  }
  value.field_definitions.forEach((field, index) => {
    validateSharedFieldDefinition(field, code, index);
  });
  requireExactObject(value.catalogue_contract, {
    release_admitted_union_drives_more_filters: true,
    all_current_pm_baseline_fields_present: true,
    database_column_presence_sufficient: false,
    unapproved_field_control_permitted: false,
    unsupported_field_false_zero_permitted: false,
    legacy_professional_text_filter_authority: false,
    identity_filters_use_reviewed_labels_and_canonical_ids: true,
    same_component_professional_filtering_required: true,
    non_vacuous_all_required: true,
    incomplete_repeatable_collection_returns_unknown: true,
    ask_browse_manual_saved_search_share_one_definition: true,
    new_field_in_existing_group_requires_ui_code: false,
    new_field_group_requires_product_review: true,
    new_control_type_requires_product_review: true,
    future_domain_admission_requires_successor_catalogue: true,
  }, 'shared field catalogue contract', code);
  return value;
}

function validateLogicalTypeMember(member) {
  const code = 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'shared-authority logical type input', code);
  const logicalType = value.definition?.logical_type;
  const spec = TYPE_SPECS[logicalType];
  if (
    value.object_kind !== SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND
    || value.schema_version !== SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA
    || !spec
    || value.stable_id !== spec.stableId
  ) {
    fail(
      'UNREGISTERED_SHARED_AUTHORITY_LOGICAL_TYPE',
      'Shared-authority logical type identity is not registered.',
      {
        logical_type: logicalType || null,
        stable_id: value.stable_id || null,
      },
    );
  }
  validateCommonDefinition(value.definition, spec, code);
  const typeValidators = {
    EntitySubject: validateEntitySubjectContract,
    EntityNameOccurrence: validateEntityNameContract,
    EntityIdentityBridge: validateEntityIdentityBridgeContract,
    DealParticipantRelationship: validateDealParticipantContract,
    SourceTransactionLegOccurrence: validateSourceTransactionLegContract,
    TransactionLegResolutionOccurrence: validateTransactionLegResolutionContract,
    TransactionStructureResolutionOccurrence: validateTransactionStructureContract,
    TransactionControlOutcomeOccurrence: validateTransactionControlContract,
    SharePurchaseInterestComponent: validateSharePurchaseContract,
    SourceDealFactOccurrence: validateSourceDealFactContract,
    DealFactResolutionOccurrence: validateDealFactResolutionContract,
    TemporalExpression: validateTemporalExpressionContract,
    ProfessionalAssignmentRelationship: validateProfessionalAssignmentContract,
    LawyerFirmAffiliationRelationship: validateLawyerFirmAffiliationContract,
    CanonicalDealFactProjection: validateCanonicalDealFactProjectionContract,
  };
  typeValidators[logicalType](value.definition.type_contract, code);
  return value;
}

function validateAuthoredSharedAuthorityInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const logicalTypes = authoredMembers.filter(
    (member) => member?.object_kind === SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND,
  );
  const seen = new Set();
  for (const member of logicalTypes) {
    const value = validateLogicalTypeMember(member);
    if (seen.has(value.stable_id)) {
      fail(
        'DUPLICATE_SHARED_AUTHORITY_LOGICAL_TYPE',
        'A shared-authority logical type can appear only once.',
        { stable_id: value.stable_id },
      );
    }
    seen.add(value.stable_id);
  }
  const catalogues = authoredMembers.filter(
    (member) => member?.object_kind === SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_KIND,
  );
  if (catalogues.length > 1) {
    fail(
      'DUPLICATE_SHARED_AUTHORITY_FIELD_CATALOGUE',
      'The shared field catalogue can appear only once.',
    );
  }
  catalogues.forEach(validateFieldCatalogueMember);
}

module.exports = {
  SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_KIND,
  SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT_SCHEMA,
  SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_KIND,
  SHARED_AUTHORITY_LOGICAL_TYPE_INPUT_SCHEMA,
  SharedAuthorityContractInputError,
  validateAuthoredSharedAuthorityInputs,
};
