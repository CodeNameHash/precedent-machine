const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  loadSealedMetseraGoldEvidence,
  validatePassageAgainstBytes,
  verifySourceBytes,
} = require('./metsera-gold-evidence');
const {
  acquireProcessSources,
} = require('./process-source-acquisition');
const {
  enumerateProcessScope,
} = require('./process-scope-enumerator');
const {
  PIPELINE_INPUT_SCHEMA,
  compileProcessExclusivityPilotPipeline,
} = require('./process-exclusivity-pilot-pipeline');
const {
  compileProcessExclusivityPilotMaterialisation,
} = require('./process-exclusivity-pilot');

const METSERA_STAGING_PILOT_SCHEMA =
  'METSERA_EXCLUSIVITY_STAGING_PILOT/V1';
const SELECTED_PASSAGE_ID =
  'party-2-august-17-executed-exclusivity';
const SELECTED_TRACK_ID = 'party-2';
const SELECTED_PARTY_IDS = Object.freeze(['metsera', 'party-2']);
const AUTHORITY_LIMITS = Object.freeze({
  external_operation: 'NONE',
  extraction: 'NONE',
  canonical_write: 'NONE',
  writer: 'NONE',
  database_write: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera staging pilot: ${message}`);
}

function digest(label) {
  return contentId(METSERA_STAGING_PILOT_SCHEMA, { label });
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function evidence(role, ...intervals) {
  return {
    evidence_role_key: role,
    intervals,
  };
}

function typedLinkEvidence(predicateKey, terminalType, slotKey, ...intervals) {
  return {
    terminal_type: terminalType,
    slot_key: slotKey,
    evidence: evidence(
      `${predicateKey}_${terminalType}`,
      ...intervals,
    ),
  };
}

function sourceIdentity(document) {
  return {
    source_document_identity: digest(`${document.accession}:document`),
    source_revision_id: digest(`${document.accession}:${document.sha256}:revision`),
    document_hash: document.sha256,
  };
}

function buildSourceDocuments(sourceUniverse, sourceBytesByAccession) {
  return sourceUniverse.documents.map((document, documentOrdinal) => {
    const bytes = sourceBytesByAccession.get(document.accession);
    verifySourceBytes(document.accession, bytes, sourceUniverse);
    const identity = sourceIdentity(document);
    return {
      admitted_source_occurrence_id:
        digest(`${document.accession}:admitted-source-occurrence`),
      ...identity,
      document_ordinal: documentOrdinal,
      source_text: bytes.toString('utf8'),
      source_text_digest: document.sha256,
      citation_identity: {
        accession_number: document.accession,
        form_type: document.form,
        filed_on: document.filedOn,
        official_url: document.officialUrl,
      },
      evidence_validation_receipt_id:
        digest(`${document.accession}:evidence-validation`),
    };
  });
}

function fullPassageInterval(passage, sourceByAccession) {
  const source = sourceByAccession.get(passage.source.accession);
  if (!source) fail(`selected passage source is missing: ${passage.id}`);
  return {
    source_document_identity: source.source_document_identity,
    absolute_start: passage.interval.byteStart,
    absolute_end: passage.interval.byteEnd,
  };
}

function subInterval(passage, sourceByAccession, exactText) {
  const offset = passage.verbatimUtf8.indexOf(exactText);
  if (offset < 0) fail(`selected passage does not contain: ${exactText}`);
  const prefixBytes = Buffer.byteLength(
    passage.verbatimUtf8.slice(0, offset),
    'utf8',
  );
  const start = passage.interval.byteStart + prefixBytes;
  const source = sourceByAccession.get(passage.source.accession);
  return {
    source_document_identity: source.source_document_identity,
    absolute_start: start,
    absolute_end: start + Buffer.byteLength(exactText, 'utf8'),
  };
}

function buildMaterialisationInput({
  sourceDocuments,
  sourceUniverse,
  exclusivityGold,
}) {
  const sourceByAccession = new Map(
    sourceUniverse.documents.map((document, index) => [
      document.accession,
      sourceDocuments[index],
    ]),
  );
  const passage = exclusivityGold.passages.find(
    (value) => value.id === SELECTED_PASSAGE_ID,
  );
  if (!passage
    || passage.trackId !== SELECTED_TRACK_ID
    || canonicalJson(passage.partyIds) !== canonicalJson(SELECTED_PARTY_IDS)) {
    fail('the sealed selected passage identity has changed');
  }
  const narrationInterval = fullPassageInterval(passage, sourceByAccession);
  const metseraInterval = subInterval(
    passage,
    sourceByAccession,
    'Metsera',
  );
  const partyTwoInterval = subInterval(
    passage,
    sourceByAccession,
    'Party 2',
  );
  const positionText = 'entered into an exclusivity agreement';
  const positionInterval = subInterval(
    passage,
    sourceByAccession,
    positionText,
  );
  const temporalText =
    'through 9:00 a.m. Eastern Time on September&nbsp;8,\n2025';
  const temporalInterval = subInterval(
    passage,
    sourceByAccession,
    temporalText,
  );

  return {
    schema_version: 'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_INPUT/V1',
    frozen_contract_pair_digest: digest('frozen-contract-pair'),
    governed_deal_admission_id: digest('metsera-deal-admission'),
    source_documents: sourceDocuments,
    frozen_scope: {
      narration_slots: [{
        canonical_source_intervals: [narrationInterval],
      }],
      event_slots: [{
        process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        narration_ordinals: [0],
        event_grouping_evidence: evidence(
          'EVENT_GROUPING',
          narrationInterval,
        ),
        expected_result_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_RESULT',
      }],
      participant_slots: [
        {
          process_event_slot_key:
            'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'METSERA_GRANTOR',
          governed_ordinal: 0,
        },
        {
          process_event_slot_key:
            'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'PARTY_2_BENEFICIARY',
          governed_ordinal: 1,
        },
      ],
      bidder_track_slots: [{
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        governed_ordinal: 0,
      }],
      phase_slots: [{
        phase_scope: {
          scope_kind: 'BIDDER_TRACK',
          bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        },
        process_phase_slot_key: 'PARTY_2_EXCLUSIVITY_PHASE',
        governed_ordinal: 0,
      }],
      position_slots: [{
        process_position_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
        governed_ordinal: 0,
      }],
      agreement_slots: [{
        process_agreement_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
        governed_ordinal: 0,
      }],
      relationship_slots: [
        {
          process_relationship_slot_key:
            'PARTY_2_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          source_endpoint: {
            logical_type: 'BidderTrack',
            slot_key: 'PARTY_2_BIDDER_TRACK',
          },
          target_endpoint: {
            logical_type: 'ProcessEvent',
            slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
          },
          governed_ordinal: 0,
          relationship_evidence: evidence(
            'BIDDER_TRACK_EVENT_MEMBERSHIP',
            narrationInterval,
          ),
        },
        {
          process_relationship_slot_key:
            'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
          source_endpoint: {
            logical_type: 'ProcessPosition',
            slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
          },
          target_endpoint: {
            logical_type: 'ProcessAgreement',
            slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
          },
          governed_ordinal: 1,
          relationship_evidence: evidence(
            'PROCESS_RELATIONSHIP',
            narrationInterval,
          ),
        },
      ],
      temporal_slots: [{
        expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        governed_ordinal: 0,
        governed_subject: {
          logical_type: 'ProcessEvent',
          slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        },
      }],
      predicate_witness_slots: [{
        predicate_witness_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANTED_WITNESS',
        narration_ordinal: 0,
        predicate_definition_key_and_version: {
          key: 'EXCLUSIVITY_GRANTED',
          version: 1,
        },
        predicate_evidence_role_slot_key: 'EXCLUSIVITY_GRANTED',
        governed_ordinal: 0,
        governed_subject_code: 'NEGOTIATION_EXCLUSIVITY',
      }],
      passage_slots: [{
        process_passage_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
        canonical_source_intervals: [narrationInterval],
      }],
    },
    typed_values: {
      narrations: [{
        narration_ordinal: 0,
        revision_status: 'PRESENT',
        claim_revision_ids: [],
        source_role_code: 'PRIMARY_PROCESS_NARRATION',
        source_backed_attributes: {
          source_role_code: 'PRIMARY_PROCESS_NARRATION',
          verbatim_text: passage.verbatimUtf8,
        },
        evidence: evidence('EXCLUSIVITY_GRANTED', narrationInterval),
      }],
      events: [{
        process_event_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        event_type_code: 'EXCLUSIVITY_GRANT',
        channel_code: 'WRITTEN_COMMUNICATION',
        event_state: 'PRESENT',
        claim_revision_ids: [],
        temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        participant_slot_keys: [
          'METSERA_GRANTOR',
          'PARTY_2_BENEFICIARY',
        ],
        evidence: evidence('PROCESS_EVENT', narrationInterval),
      }],
      participants: [
        {
          process_participant_slot_key: 'METSERA_GRANTOR',
          revision_state: 'PRESENT',
          identity_state: 'NAMED',
          entity_subject_id: digest('metsera-entity-subject'),
          source_local_subject_occurrence_id: null,
          entity_identity_bridge_revision_id: null,
          deal_participant_relationship_revision_id:
            digest('metsera-target-relationship-revision'),
          bidder_track_slot_key: null,
          event_role_code: 'GRANTOR',
          evidence: evidence('EVENT_ROLE_GRANTOR', metseraInterval),
        },
        {
          process_participant_slot_key: 'PARTY_2_BENEFICIARY',
          revision_state: 'PRESENT',
          identity_state: 'SOURCE_LOCAL_ONLY',
          entity_subject_id: null,
          source_local_subject_occurrence_id:
            digest('party-2-source-local-subject'),
          entity_identity_bridge_revision_id: null,
          deal_participant_relationship_revision_id:
            digest('party-2-bidder-relationship-revision'),
          bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
          event_role_code: 'BENEFICIARY',
          evidence: evidence(
            'EVENT_ROLE_BENEFICIARY',
            partyTwoInterval,
          ),
        },
      ],
      bidder_tracks: [{
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        entity_identity_bridge_revision_id: null,
        entity_subject_id: null,
        source_local_subject_occurrence_ids: [
          digest('party-2-source-local-subject'),
        ],
        identity_state: 'SOURCE_LOCAL_ONLY',
        track_state: 'ACTIVE',
        evidence: evidence('BIDDER_TRACK', partyTwoInterval),
      }],
      phases: [{
        process_phase_slot_key: 'PARTY_2_EXCLUSIVITY_PHASE',
        phase_code: 'EXCLUSIVITY',
        phase_state: 'PRESENT',
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME'],
        evidence: evidence('PROCESS_PHASE', narrationInterval),
      }],
      positions: [{
        process_position_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
        position_code: 'GRANTED',
        position_state: 'PRESENT',
        term_code: 'EXCLUSIVITY_SUBJECT',
        exact_source_formulation: positionText,
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        process_event_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_key: 'METSERA_GRANTOR',
        temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        evidence: evidence('PROCESS_POSITION', positionInterval),
      }],
      agreements: [{
        process_agreement_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
        agreement_state: 'PRESENT',
        agreement_type_code: 'EXCLUSIVITY',
        document_stage_code: 'EXECUTED',
        version_number: 1,
        effective_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        party_participant_slot_keys: [
          'METSERA_GRANTOR',
          'PARTY_2_BENEFICIARY',
        ],
        process_passage_slot_keys: [
          'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
        ],
        evidence: evidence('PROCESS_AGREEMENT', narrationInterval),
      }],
      relationships: [
        {
          process_relationship_slot_key:
            'PARTY_2_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          relationship_type_code: 'BIDDER_TRACK_EVENT_MEMBERSHIP',
          relationship_effect: {
            effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
          },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence(
            'BIDDER_TRACK_EVENT_MEMBERSHIP',
            narrationInterval,
          ),
        },
        {
          process_relationship_slot_key:
            'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
          relationship_type_code: 'CROSS_REFERENCE',
          relationship_effect: {
            effect_code: 'POSITION_EVIDENCES_EXCLUSIVITY_AGREEMENT',
          },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence('PROCESS_RELATIONSHIP', narrationInterval),
        },
      ],
      temporal_expressions: [{
        expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        coarse_temporal_state: 'EXPLICIT_DATE',
        raw_source_expression: temporalText,
        evidence: evidence('TEMPORAL_EXPRESSION', temporalInterval),
      }],
      predicate_witnesses: [{
        predicate_witness_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANTED_WITNESS',
        predicate_key: 'EXCLUSIVITY_GRANTED',
        predicate_state: 'PRESENT',
        atomic_response_predicate_key: null,
        atomic_response_predicate_witness_slot_key: null,
        source_semantic_kind: 'GRANT',
        subject_code: 'NEGOTIATION_EXCLUSIVITY',
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        process_event_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_keys: [
          'METSERA_GRANTOR',
          'PARTY_2_BENEFICIARY',
        ],
        process_passage_slot_keys: [
          'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
        ],
        process_position_slot_keys: [
          'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
        ],
        process_agreement_slot_keys: [
          'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
        ],
        process_relationship_slot_keys: [
          'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
        ],
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME'],
        evidence: evidence('EXCLUSIVITY_GRANTED', narrationInterval),
        typed_link_evidence: [
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'BIDDER_TRACK_REVISION',
            'PARTY_2_BIDDER_TRACK',
            partyTwoInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_AGREEMENT_REVISION',
            'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_EVENT_REVISION',
            'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PARTICIPANT_REVISION',
            'METSERA_GRANTOR',
            metseraInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PARTICIPANT_REVISION',
            'PARTY_2_BENEFICIARY',
            partyTwoInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PASSAGE_REVISION',
            'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_POSITION_REVISION',
            'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
            positionInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_RELATIONSHIP_REVISION',
            'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'TEMPORAL_EXPRESSION_REVISION',
            'METSERA_EXCLUSIVITY_END_TIME',
            temporalInterval,
          ),
        ],
        complete_scope_evidence: null,
        applicability_evidence: null,
        failure_detail: null,
      }],
      passages: [{
        process_passage_slot_key:
          'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
        passage_role_codes: ['PROCESS_NARRATION'],
        passage_state: 'PRESENT',
        evidence: evidence('PROCESS_PASSAGE', narrationInterval),
      }],
    },
  };
}

function scopeEvidence(interval, sourceByIdentity) {
  const source = sourceByIdentity.get(interval.source_document_identity);
  const exactBytes = Buffer.from(source.source_text, 'utf8').subarray(
    interval.absolute_start,
    interval.absolute_end,
  );
  return {
    source_document_identity: source.source_document_identity,
    source_revision_id: source.source_revision_id,
    document_hash: source.document_hash,
    start_utf8_byte: interval.absolute_start,
    end_utf8_byte: interval.absolute_end,
    exact_text_digest: sha256Hex(exactBytes),
  };
}

function buildPipelineInput(materialisationInput, sourceUniverse, exclusivityGold) {
  const witnessSlot =
    materialisationInput.frozen_scope.predicate_witness_slots[0]
      .predicate_witness_slot_key;
  const narrationInterval =
    materialisationInput.frozen_scope.narration_slots[0]
      .canonical_source_intervals[0];
  const sourceByIdentity = new Map(
    materialisationInput.source_documents.map((source) => [
      source.source_document_identity,
      source,
    ]),
  );
  const exactEvidence = scopeEvidence(narrationInterval, sourceByIdentity);
  const governedScope = {
    scope_id: 'METSERA_EXCLUSIVITY_P8_SCOPE',
    scope_digest: digest('governed-scope'),
    manifest_id: digest('sealed-source-manifest'),
    expected_source_ids:
      materialisationInput.source_documents.map(
        (_source, index) => `METSERA_SOURCE_${index}`,
      ),
    coverage_limit: {
      coverage_limit_id: 'METSERA_SEALED_UNIVERSE_THROUGH_2025_11_13',
      limitation_codes: ['ONE_EXCLUSIVITY_GRANT_SLICE'],
    },
  };
  const sourceAcquisitionInput = {
    schema_version: 'PROCESS_SOURCE_ACQUISITION_INPUT/V1',
    governed_scope: governedScope,
    frozen_sources: materialisationInput.source_documents.map(
      (source, index) => ({
        source_id: governedScope.expected_source_ids[index],
        source_class:
          sourceUniverse.documents[index].cik === '0002040807'
            ? 'FILING'
            : 'INCORPORATED_REFERENCE',
        frozen_snapshot_id:
          digest(`${sourceUniverse.documents[index].accession}:snapshot`),
        source_text: source.source_text,
        source_text_digest: source.source_text_digest,
        source_identity: {
          source_document_identity: source.source_document_identity,
          source_revision_id: source.source_revision_id,
          document_hash: source.document_hash,
        },
        evidence_history: [{
          evidence_id:
            digest(`${sourceUniverse.documents[index].accession}:evidence`),
          evidence_digest:
            digest(`${sourceUniverse.documents[index].accession}:evidence-digest`),
        }],
        intake_outcome: 'VERIFIED_INTAKE_RECEIPT',
        attempts_used: 1,
      }),
    ),
    limits: {
      maximum_sources: 16,
      maximum_attempts: 16,
      maximum_total_bytes: 16 * 1024 * 1024,
      maximum_runtime_ms: 60_000,
      maximum_memory_bytes: 64 * 1024 * 1024,
    },
  };
  const metseraDocuments = sourceUniverse.documents.filter(
    (document) => document.cik === '0002040807',
  );
  const secCompletenessInput = {
    schema_version: 'PROCESS_SEC_COMPLETENESS_ORACLE_INPUT/V1',
    governed_scope: {
      scope_id: governedScope.scope_id,
      scope_digest: governedScope.scope_digest,
      issuer_cik: '2040807',
      filing_date_start: '2025-01-01',
      filing_date_end: '2025-11-13',
    },
    sec_index_records: metseraDocuments.map((document) => ({
      index_source: 'SEC_FULL_INDEX',
      index_snapshot_id: digest('sealed-sec-index-snapshot'),
      accession_number: document.accession,
      accession_number_no_dashes: document.accession.replaceAll('-', ''),
      issuer_cik: '2040807',
      filing_date: document.filedOn,
      form_type: document.form,
      primary_document: document.primaryDocument,
    })),
    limits: {
      maximum_records: 32,
      maximum_total_bytes: 1024 * 1024,
      maximum_runtime_ms: 60_000,
      maximum_memory_bytes: 4 * 1024 * 1024,
    },
  };
  const scopeRecords = [{
    record_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT',
    record_state: 'SLOT',
    slot_key: witnessSlot,
    deal_id: materialisationInput.governed_deal_admission_id,
    occurrence_kind: 'EXCLUSIVITY_EVENT',
    required_evidence_roles: ['PRIMARY_PROCESS_NARRATION'],
    scope_evidence: [exactEvidence],
    residual_code: null,
  }];
  for (const passage of exclusivityGold.passages) {
    if (passage.id === SELECTED_PASSAGE_ID) continue;
    const source = materialisationInput.source_documents[
      sourceUniverse.documents.findIndex(
        (document) => document.accession === passage.source.accession,
      )
    ];
    const bytes = Buffer.from(source.source_text, 'utf8').subarray(
      passage.interval.byteStart,
      passage.interval.byteEnd,
    );
    scopeRecords.push({
      record_key: `RESIDUAL_${passage.id.toUpperCase().replaceAll('-', '_')}`,
      record_state: 'RESIDUAL',
      slot_key: null,
      deal_id: materialisationInput.governed_deal_admission_id,
      occurrence_kind: null,
      required_evidence_roles: null,
      scope_evidence: [{
        source_document_identity: source.source_document_identity,
        source_revision_id: source.source_revision_id,
        document_hash: source.document_hash,
        start_utf8_byte: passage.interval.byteStart,
        end_utf8_byte: passage.interval.byteEnd,
        exact_text_digest: sha256Hex(bytes),
      }],
      residual_code: 'OUTSIDE_SINGLE_PILOT_SLICE',
    });
  }
  scopeRecords.sort((left, right) => compareText(left.record_key, right.record_key));
  const scopeInput = {
    schema_version: 'PROCESS_SCOPE_ENUMERATOR_INPUT/V1',
    governed_deal_admission_id:
      materialisationInput.governed_deal_admission_id,
    scope_records: scopeRecords,
    limits: {
      max_scope_records: 32,
      max_slots: 8,
    },
  };
  const semanticEvidence = {
    ...exactEvidence,
    evidence_role_key: 'PRIMARY_PROCESS_NARRATION',
  };
  const selectedSource = sourceByIdentity.get(
    narrationInterval.source_document_identity,
  );
  const pipelineInput = {
    schema_version: PIPELINE_INPUT_SCHEMA,
    frozen_contract_pair_digest:
      materialisationInput.frozen_contract_pair_digest,
    governed_deal_admission_id:
      materialisationInput.governed_deal_admission_id,
    source_acquisition_input: sourceAcquisitionInput,
    sec_completeness_input: secCompletenessInput,
    siblings: [{
      sibling_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT',
      scope_input: scopeInput,
      semantic_source_units: [{
        source_unit_id: digest('semantic-source-unit'),
        unit_state: 'CANDIDATE',
        slot_key: witnessSlot,
        evidence: semanticEvidence,
        semantic_payload: {
          predicate_key: 'EXCLUSIVITY_GRANTED',
          polarity: 'PRESENT',
        },
        disposition_code: null,
      }],
      semantic_limits: {
        max_source_units: 16,
        max_candidates: 8,
      },
      lexical_source_units: [{
        source_unit_id: digest('lexical-source-unit'),
        source_document_identity: selectedSource.source_document_identity,
        source_revision_id: selectedSource.source_revision_id,
        document_hash: selectedSource.document_hash,
        start_utf8_byte: narrationInterval.absolute_start,
        end_utf8_byte: narrationInterval.absolute_end,
        exact_text: exclusivityGold.passages.find(
          (passage) => passage.id === SELECTED_PASSAGE_ID,
        ).verbatimUtf8,
        lexical_observations: [{
          state: 'CANDIDATE',
          slot_key: witnessSlot,
          evidence_role_key: 'PRIMARY_PROCESS_NARRATION',
          start_utf8_byte: narrationInterval.absolute_start,
          end_utf8_byte: narrationInterval.absolute_end,
          lexical_payload: {
            matcher: 'SEALED_EXCLUSIVITY_GRANT_EXACT_BYTES',
          },
          reason_code: null,
        }],
      }],
      lexical_limits: {
        max_source_count: 16,
        max_source_bytes: 16 * 1024 * 1024,
        max_candidate_count: 16,
        max_duration_ms: 60_000,
        max_memory_bytes: 64 * 1024 * 1024,
      },
      lexical_reported_usage: {
        duration_ms: 1,
        memory_bytes: 1024,
      },
      candidate_graph_limits: {
        max_source_bytes: 16 * 1024 * 1024,
        max_candidate_count: 32,
        max_runtime_ms: 60_000,
        max_memory_bytes: 64 * 1024 * 1024,
      },
      materialisation_input: materialisationInput,
    }],
  };
  const scopeReceipt = enumerateProcessScope(scopeInput);
  return {
    pipelineInput,
    trustedContext: {
      expected_acquisition_receipt_id:
        acquireProcessSources(sourceAcquisitionInput)
          .acquisition_receipt_id,
      scope_receipt_anchors: [{
        sibling_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT',
        expected_scope_receipt_id: scopeReceipt.scope_receipt_id,
      }],
    },
  };
}

function compileMetseraExclusivityStagingPilot(sourceBytesByAccession) {
  if (!(sourceBytesByAccession instanceof Map)) {
    fail('source bytes must be supplied as a Map keyed by accession');
  }
  const { sourceUniverse, exclusivityGold } =
    loadSealedMetseraGoldEvidence();
  const sourceDocuments = buildSourceDocuments(
    sourceUniverse,
    sourceBytesByAccession,
  );
  for (const passage of exclusivityGold.passages) {
    validatePassageAgainstBytes(
      passage,
      sourceBytesByAccession.get(passage.source.accession),
    );
  }
  const materialisationInput = buildMaterialisationInput({
    sourceDocuments,
    sourceUniverse,
    exclusivityGold,
  });
  compileProcessExclusivityPilotMaterialisation(materialisationInput);
  const { pipelineInput, trustedContext } = buildPipelineInput(
    materialisationInput,
    sourceUniverse,
    exclusivityGold,
  );
  const pipelineReceipt = compileProcessExclusivityPilotPipeline(
    pipelineInput,
    trustedContext,
  );
  const sibling = pipelineReceipt.siblings[0];
  if (sibling.failure !== null
    || sibling.process_exclusivity_pilot_materialisation_receipt
      ?.materialisation_state !== 'VALIDATED_SIDECAR_ONLY') {
    fail(`pipeline failed: ${canonicalJson(sibling.failure)}`);
  }
  return Object.freeze({
    schema_version: METSERA_STAGING_PILOT_SCHEMA,
    selected_passage_id: SELECTED_PASSAGE_ID,
    sealed_source_count: sourceUniverse.documents.length,
    sealed_passage_count: exclusivityGold.passages.length,
    retained_scope_residual_count: sibling.scope_receipt.residuals.length,
    acquisition_receipt_id:
      pipelineReceipt.source_acquisition_receipt.acquisition_receipt_id,
    sec_completeness_receipt_id:
      pipelineReceipt.sec_completeness_receipt
        .oracle_receipt_id,
    scope_receipt_id: sibling.scope_receipt.scope_receipt_id,
    candidate_graph_id: sibling.candidate_graph.candidate_graph_id,
    candidate_validation_receipt_id:
      sibling.candidate_validation_receipt
        .candidate_validation_receipt_id,
    materialisation_receipt_id:
      sibling.process_exclusivity_pilot_materialisation_receipt
        .materialisation_receipt_id,
    pipeline_receipt: pipelineReceipt,
    authority_limits: AUTHORITY_LIMITS,
  });
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_STAGING_PILOT_SCHEMA,
  SELECTED_PASSAGE_ID,
  compileMetseraExclusivityStagingPilot,
};
