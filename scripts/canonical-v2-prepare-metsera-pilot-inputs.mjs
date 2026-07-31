#!/usr/bin/env node

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const {
  METSERA_STAGING_PILOT_SCHEMA,
  SELECTED_PASSAGE_ID,
  DIRECT_GRANTOR_TEXT,
  DIRECT_BENEFICIARY_TEXT,
  GRANT_EFFECTIVE_TEXT,
  EXCLUSIVITY_EXPIRY_TEXT,
  validateSealedGrantEvidence,
  compileMetseraExclusivityStagingPilot,
} = require('../lib/canonical-v2/metsera-exclusivity-staging-pilot');
const {
  loadSealedMetseraGoldEvidence,
  verifySourceBytes,
  validatePassageAgainstBytes,
} = require('../lib/canonical-v2/metsera-gold-evidence');
const {
  compileProcessExclusivityPilotMaterialisation,
  validateProcessExclusivityPilotMaterialisation,
} = require('../lib/canonical-v2/process-exclusivity-pilot');
const {
  compileMetseraExclusivityProcessPhrasebookAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission');
const {
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');
const {
  METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
  METSERA_COHORT_REQUEST_SCHEMA,
  compileMetseraExclusivityCohortExecution,
} = require('../lib/canonical-v2/metsera-exclusivity-cohort-executor');
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  compilePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function fail(message) {
  throw new Error(`prepare-metsera-pilot-inputs: ${message}`);
}

function readArg(flag, { required } = { required: true }) {
  const index = process.argv.indexOf(flag);
  const value = index < 0 ? null : process.argv[index + 1];
  if (required && (!value || value.startsWith('--'))) {
    fail(`requires ${flag} <value>.`);
  }
  return value && !value.startsWith('--') ? value : null;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

function writeStableJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`);
}

function sha256HexOfFile(filePath) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

// --- Reconstruct the exact materialisation input --------------------------
//
// compileMetseraExclusivityStagingPilot() computes the materialisation input
// internally but only returns the pipeline receipt (which is content-derived
// and irreversible). The runner needs the plain materialisation_input file
// too, so this rebuilds it deterministically from the same sealed evidence
// using only exported building blocks, then proves the reconstruction is
// exact by handing it to the library's own
// validateProcessExclusivityPilotMaterialisation() check (and, downstream,
// to compileMetseraExclusivityProcessPhrasebookAdmission(), which performs
// the same validation again as part of its normal admission path). Neither
// check is skipped or bypassed anywhere below.

function digest(label) {
  return contentId(METSERA_STAGING_PILOT_SCHEMA, { label });
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
  const prefixBytes = Buffer.byteLength(passage.verbatimUtf8.slice(0, offset), 'utf8');
  const start = passage.interval.byteStart + prefixBytes;
  const source = sourceByAccession.get(passage.source.accession);
  return {
    source_document_identity: source.source_document_identity,
    absolute_start: start,
    absolute_end: start + Buffer.byteLength(exactText, 'utf8'),
  };
}

function evidence(role, ...intervals) {
  return { evidence_role_key: role, intervals };
}

function typedLinkEvidence(predicateKey, terminalType, slotKey, ...intervals) {
  return {
    terminal_type: terminalType,
    slot_key: slotKey,
    evidence: evidence(`${predicateKey}_${terminalType}`, ...intervals),
  };
}

function reconstructMaterialisationInput({ sourceDocuments, sourceUniverse, exclusivityGold }) {
  const sourceByAccession = new Map(
    sourceUniverse.documents.map((document, index) => [document.accession, sourceDocuments[index]]),
  );
  const passage = exclusivityGold.passages.find((value) => value.id === SELECTED_PASSAGE_ID);
  const rolePassage = exclusivityGold.passages.find(
    (value) => value.id === 'party-2-august-16-board-exclusivity-analysis',
  );
  if (
    !passage
    || !rolePassage
    || passage.trackId !== 'party-2'
    || canonicalJson(passage.partyIds) !== canonicalJson(['metsera', 'party-2'])
    || passage.date !== '2025-08-17'
    || canonicalJson(rolePassage.partyIds) !== canonicalJson(['metsera', 'party-2', 'party-1'])
  ) {
    fail('the sealed selected passage identity has changed');
  }
  const narrationInterval = fullPassageInterval(passage, sourceByAccession);
  const directGrantorBeneficiaryInterval = subInterval(rolePassage, sourceByAccession, DIRECT_GRANTOR_TEXT);
  const metseraInterval = directGrantorBeneficiaryInterval;
  const partyTwoInterval = subInterval(rolePassage, sourceByAccession, DIRECT_BENEFICIARY_TEXT);
  const positionText = 'entered into an exclusivity agreement';
  const positionInterval = subInterval(passage, sourceByAccession, positionText);
  const grantEffectiveInterval = subInterval(passage, sourceByAccession, GRANT_EFFECTIVE_TEXT);
  const expiryInterval = subInterval(passage, sourceByAccession, EXCLUSIVITY_EXPIRY_TEXT);
  validateSealedGrantEvidence({
    grantorEvidenceText: DIRECT_GRANTOR_TEXT,
    beneficiaryEvidenceText: DIRECT_BENEFICIARY_TEXT,
    grantEffectiveText: GRANT_EFFECTIVE_TEXT,
    expiryText: EXCLUSIVITY_EXPIRY_TEXT,
  });

  return {
    schema_version: 'PROCESS_EXCLUSIVITY_PILOT_MATERIALISATION_INPUT/V1',
    frozen_contract_pair_digest: digest('frozen-contract-pair'),
    governed_deal_admission_id: digest('metsera-deal-admission'),
    source_documents: sourceDocuments,
    frozen_scope: {
      narration_slots: [{ canonical_source_intervals: [narrationInterval] }],
      event_slots: [{
        process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        narration_ordinals: [0],
        event_grouping_evidence: evidence('EVENT_GROUPING', narrationInterval),
        expected_result_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_RESULT',
      }],
      participant_slots: [
        {
          process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'METSERA_GRANTOR',
          governed_ordinal: 0,
        },
        {
          process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'PARTY_2_BENEFICIARY',
          governed_ordinal: 1,
        },
      ],
      bidder_track_slots: [{ bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK', governed_ordinal: 0 }],
      phase_slots: [{
        phase_scope: { scope_kind: 'BIDDER_TRACK', bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK' },
        process_phase_slot_key: 'PARTY_2_EXCLUSIVITY_PHASE',
        governed_ordinal: 0,
      }],
      position_slots: [{
        process_position_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
        governed_ordinal: 0,
      }],
      agreement_slots: [{
        process_agreement_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
        governed_ordinal: 0,
      }],
      relationship_slots: [
        {
          process_relationship_slot_key: 'PARTY_2_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          source_endpoint: { logical_type: 'BidderTrack', slot_key: 'PARTY_2_BIDDER_TRACK' },
          target_endpoint: { logical_type: 'ProcessEvent', slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT' },
          governed_ordinal: 0,
          relationship_evidence: evidence('BIDDER_TRACK_EVENT_MEMBERSHIP', narrationInterval),
        },
        {
          process_relationship_slot_key: 'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
          source_endpoint: { logical_type: 'ProcessPosition', slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION' },
          target_endpoint: { logical_type: 'ProcessAgreement', slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT' },
          governed_ordinal: 1,
          relationship_evidence: evidence('PROCESS_RELATIONSHIP', narrationInterval),
        },
      ],
      temporal_slots: [
        {
          expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME',
          governed_ordinal: 0,
          governed_subject: { logical_type: 'ProcessEvent', slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT' },
        },
        {
          expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
          governed_ordinal: 1,
          governed_subject: { logical_type: 'ProcessEvent', slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT' },
        },
      ],
      predicate_witness_slots: [{
        predicate_witness_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANTED_WITNESS',
        narration_ordinal: 0,
        predicate_definition_key_and_version: { key: 'EXCLUSIVITY_GRANTED', version: 1 },
        predicate_evidence_role_slot_key: 'EXCLUSIVITY_GRANTED',
        governed_ordinal: 0,
        governed_subject_code: 'NEGOTIATION_EXCLUSIVITY',
      }],
      passage_slots: [{
        process_passage_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
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
        process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        event_type_code: 'EXCLUSIVITY_GRANT',
        channel_code: 'WRITTEN_COMMUNICATION',
        event_state: 'PRESENT',
        claim_revision_ids: [],
        temporal_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME',
        participant_slot_keys: ['METSERA_GRANTOR', 'PARTY_2_BENEFICIARY'],
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
          deal_participant_relationship_revision_id: digest('metsera-target-relationship-revision'),
          bidder_track_slot_key: null,
          event_role_code: 'GRANTOR',
          evidence: evidence('EVENT_ROLE_GRANTOR', metseraInterval),
        },
        {
          process_participant_slot_key: 'PARTY_2_BENEFICIARY',
          revision_state: 'PRESENT',
          identity_state: 'SOURCE_LOCAL_ONLY',
          entity_subject_id: null,
          source_local_subject_occurrence_id: digest('party-2-source-local-subject'),
          entity_identity_bridge_revision_id: null,
          deal_participant_relationship_revision_id: digest('party-2-bidder-relationship-revision'),
          bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
          event_role_code: 'BENEFICIARY',
          evidence: evidence('EVENT_ROLE_BENEFICIARY', partyTwoInterval),
        },
      ],
      bidder_tracks: [{
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        entity_identity_bridge_revision_id: null,
        entity_subject_id: null,
        source_local_subject_occurrence_ids: [digest('party-2-source-local-subject')],
        identity_state: 'SOURCE_LOCAL_ONLY',
        track_state: 'ACTIVE',
        evidence: evidence('BIDDER_TRACK', partyTwoInterval),
      }],
      phases: [{
        process_phase_slot_key: 'PARTY_2_EXCLUSIVITY_PHASE',
        phase_code: 'EXCLUSIVITY',
        phase_state: 'PRESENT',
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME', 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME'],
        evidence: evidence('PROCESS_PHASE', narrationInterval),
      }],
      positions: [{
        process_position_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION',
        position_code: 'GRANTED',
        position_state: 'PRESENT',
        term_code: 'EXCLUSIVITY_SUBJECT',
        exact_source_formulation: positionText,
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_key: 'METSERA_GRANTOR',
        temporal_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME',
        evidence: evidence('PROCESS_POSITION', positionInterval),
      }],
      agreements: [{
        process_agreement_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT',
        agreement_state: 'PRESENT',
        agreement_type_code: 'EXCLUSIVITY',
        document_stage_code: 'EXECUTED',
        version_number: 1,
        effective_temporal_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME',
        party_participant_slot_keys: ['METSERA_GRANTOR', 'PARTY_2_BENEFICIARY'],
        process_passage_slot_keys: ['METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE'],
        evidence: evidence('PROCESS_AGREEMENT', narrationInterval),
      }],
      relationships: [
        {
          process_relationship_slot_key: 'PARTY_2_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          relationship_type_code: 'BIDDER_TRACK_EVENT_MEMBERSHIP',
          relationship_effect: { effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK' },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence('BIDDER_TRACK_EVENT_MEMBERSHIP', narrationInterval),
        },
        {
          process_relationship_slot_key: 'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT',
          relationship_type_code: 'CROSS_REFERENCE',
          relationship_effect: { effect_code: 'POSITION_EVIDENCES_EXCLUSIVITY_AGREEMENT' },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence('PROCESS_RELATIONSHIP', narrationInterval),
        },
      ],
      temporal_expressions: [
        {
          expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME',
          coarse_temporal_state: 'EXPLICIT_DATE',
          raw_source_expression: GRANT_EFFECTIVE_TEXT,
          evidence: evidence('TEMPORAL_EXPRESSION', grantEffectiveInterval),
        },
        {
          expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
          coarse_temporal_state: 'EXPLICIT_DATE',
          raw_source_expression: EXCLUSIVITY_EXPIRY_TEXT,
          evidence: evidence('TEMPORAL_EXPRESSION', expiryInterval),
        },
      ],
      predicate_witnesses: [{
        predicate_witness_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANTED_WITNESS',
        predicate_key: 'EXCLUSIVITY_GRANTED',
        predicate_state: 'PRESENT',
        atomic_response_predicate_key: null,
        atomic_response_predicate_witness_slot_key: null,
        source_semantic_kind: 'GRANT',
        subject_code: 'NEGOTIATION_EXCLUSIVITY',
        bidder_track_slot_key: 'PARTY_2_BIDDER_TRACK',
        process_event_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_keys: ['METSERA_GRANTOR', 'PARTY_2_BENEFICIARY'],
        process_passage_slot_keys: ['METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE'],
        process_position_slot_keys: ['METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION'],
        process_agreement_slot_keys: ['METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT'],
        process_relationship_slot_keys: ['GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT'],
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME', 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME'],
        evidence: evidence('EXCLUSIVITY_GRANTED', narrationInterval),
        typed_link_evidence: [
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'BIDDER_TRACK_REVISION', 'PARTY_2_BIDDER_TRACK', partyTwoInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_AGREEMENT_REVISION', 'METSERA_PARTY_2_EXCLUSIVITY_AGREEMENT', narrationInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_EVENT_REVISION', 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_EVENT', narrationInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_PARTICIPANT_REVISION', 'METSERA_GRANTOR', metseraInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_PARTICIPANT_REVISION', 'PARTY_2_BENEFICIARY', partyTwoInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_PASSAGE_REVISION', 'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE', narrationInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_POSITION_REVISION', 'METSERA_PARTY_2_EXCLUSIVITY_GRANT_POSITION', positionInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'PROCESS_RELATIONSHIP_REVISION', 'GRANT_POSITION_TO_PARTY_2_EXCLUSIVITY_AGREEMENT', narrationInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'TEMPORAL_EXPRESSION_REVISION', 'METSERA_EXCLUSIVITY_GRANT_EFFECTIVE_TIME', grantEffectiveInterval),
          typedLinkEvidence('EXCLUSIVITY_GRANTED', 'TEMPORAL_EXPRESSION_REVISION', 'METSERA_EXCLUSIVITY_END_TIME', expiryInterval),
        ],
        complete_scope_evidence: null,
        applicability_evidence: null,
        failure_detail: null,
      }],
      passages: [{
        process_passage_slot_key: 'METSERA_PARTY_2_EXCLUSIVITY_NARRATION_PASSAGE',
        passage_role_codes: ['PROCESS_NARRATION'],
        passage_state: 'PRESENT',
        evidence: evidence('PROCESS_PASSAGE', narrationInterval),
      }],
    },
  };
}

// --- Product authority + candidate release (mirrors the staging runner) ---

function currentProductAuthority(candidateReleaseManifest) {
  const contractRoot = resolve(ROOT, 'contracts/canonical-v2/successor');
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: contractRoot,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
  });
  const compiledContractBundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const input = {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
  return { input, context: compilePilotProductAuthorityContext(input) };
}

function buildCombinedPilotBaseRelease() {
  const fixture = buildLandosCandidateReleaseFixture();
  return buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: fixture.validatedSemanticGraphs,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  });
}

// --- Cohort request/execution-input construction (mirrors the test fixture
// tests/fixtures/canonical-v2/metsera-external-cohort-execution.js), bound
// to this run's real product_admission/product_row identities. -----------

function buildCohortFiles(productAdmission, productRow) {
  const productResult = productRow.shared_row_adapter_receipt.product_query_result;
  const filterSelection = {
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    filters: {},
  };
  const selectedFilterDigest = contentId('METSERA_EXCLUSIVITY_SELECTED_FILTERS/V1', filterSelection);
  const requestBody = {
    schema_version: METSERA_COHORT_REQUEST_SCHEMA,
    candidate_release_manifest_id: productAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: productAdmission.candidate_release_manifest_payload_digest,
    subject_deal_key: productAdmission.admission_input.result_identity.governed_deal_admission_id,
    subject_product_result_identity: productResult.product_query_result_identity,
    ...filterSelection,
    selected_filter_digest: selectedFilterDigest,
    maximum_result_rows: 1,
    database_call_budget: 1,
    immediate_retries: 0,
    execution_authority: 'NONE',
    database_authority: 'NONE',
  };
  const cohortDigest = contentId('METSERA_EXCLUSIVITY_SELECTED_COHORT/V1', {
    candidate_release_manifest_id: requestBody.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: requestBody.candidate_release_manifest_payload_digest,
    selected_filter_digest: selectedFilterDigest,
  });
  const cohortRequest = {
    ...requestBody,
    cohort_request_id: contentId(METSERA_COHORT_REQUEST_SCHEMA, requestBody),
    cohort_digest: cohortDigest,
  };
  const executionInputBody = {
    schema_version: METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
    cohort_request_id: cohortRequest.cohort_request_id,
    cohort_digest: cohortDigest,
    selected_filter_digest: selectedFilterDigest,
    selected_candidates: [{
      candidate_deal_key: cohortRequest.subject_deal_key,
      candidate_product_result_identity: cohortRequest.subject_product_result_identity,
      is_subject: true,
    }],
    maximum_candidates: 1,
    execution_authority: 'BOUNDED_PURE_EXECUTOR',
    database_authority: 'NONE',
  };
  const cohortExecutionInput = {
    ...executionInputBody,
    cohort_execution_input_id: contentId(METSERA_COHORT_EXECUTION_INPUT_SCHEMA, executionInputBody),
  };

  // Prove the pair passes the real cohort-executor validators (not a
  // hand-rolled shortcut check) before anything is written to disk.
  compileMetseraExclusivityCohortExecution({
    cohort_request: cohortRequest,
    cohort_execution_input: cohortExecutionInput,
    product_admission: productAdmission,
    product_row: productRow,
  });

  return { cohortRequest, cohortExecutionInput };
}

function main() {
  const outDir = resolve(readArg('--out-dir'));
  const sourceDir = resolve(readArg('--source-dir'));

  const { sourceUniverse, exclusivityGold } = loadSealedMetseraGoldEvidence();

  const sourceBytesByAccession = new Map();
  for (const document of sourceUniverse.documents) {
    const sourceFile = join(sourceDir, `${document.accession}.htm`);
    if (!existsSync(sourceFile)) {
      fail(
        `missing sealed source bytes for ${document.accession} at ${sourceFile}. `
        + 'Run scripts/fetch-metsera-sealed-sources.mjs --out-dir <source-dir> first.',
      );
    }
    sourceBytesByAccession.set(document.accession, readFileSync(sourceFile));
  }

  // End-to-end integrity proof over the sealed evidence: this call performs
  // its own fail-closed verification of every byte against the sealed
  // manifest (verifySourceBytes), every gold passage against those bytes
  // (validatePassageAgainstBytes), and runs the full source-acquisition /
  // scope-enumeration / candidate-graph / candidate-validation pipeline to
  // confirm materialisation_state === 'VALIDATED_SIDECAR_ONLY'. Its own
  // frozen receipt is not reused below (see citation note next), but this
  // call must succeed or nothing downstream is trustworthy.
  const pilot = compileMetseraExclusivityStagingPilot(sourceBytesByAccession);
  if (
    pilot.pipeline_receipt.siblings[0].failure !== null
    || pilot.pipeline_receipt.siblings[0]
      .process_exclusivity_pilot_materialisation_receipt
      ?.materialisation_state !== 'VALIDATED_SIDECAR_ONLY'
  ) {
    fail('the sealed staging pilot did not validate the real evidence end to end');
  }

  // Re-derive the plain materialisation_input object the pilot compiler
  // builds internally (it is not part of the pilot's return value; its
  // receipt is content-derived and irreversible).
  for (const passage of exclusivityGold.passages) {
    validatePassageAgainstBytes(passage, sourceBytesByAccession.get(passage.source.accession));
  }
  const sourceDocuments = buildSourceDocuments(sourceUniverse, sourceBytesByAccession);
  const sourceBytesByIdentity = new Map(
    sourceUniverse.documents.map((document) => [
      sourceIdentity(document).source_document_identity,
      sourceBytesByAccession.get(document.accession),
    ]),
  );
  const materialisationInput = reconstructMaterialisationInput({
    sourceDocuments,
    sourceUniverse,
    exclusivityGold,
  });

  // lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission.js
  // requires the selected witness's source_document citation_identity to
  // carry issuer_name and source_location_label (in addition to the
  // accession_number/form_type/filed_on/official_url baseline that
  // metsera-exclusivity-staging-pilot.js's buildSourceDocuments supplies).
  // citation_identity is a free-form, non-empty metadata object (see
  // process-exclusivity-pilot.js SOURCE_DOCUMENT_KEYS / requireObject check
  // -- no exact-key contract), so this is additive, verified metadata about
  // the real filing, not fabricated evidence:
  //   - issuer_name: the sealed source universe's own subject.name for the
  //     filer of this accession (source-universe.v1.json).
  //   - source_location_label: confirmed by direct inspection of the real
  //     fetched DEFM14A bytes -- the selected passage's byte interval
  //     (337991-338415) falls, with no intervening <B> section heading,
  //     inside the "Background of the Merger" heading block that starts at
  //     byte 307718 of accession 0001193125-25-242494.
  const selectedPassage = exclusivityGold.passages.find(
    (value) => value.id === SELECTED_PASSAGE_ID,
  );
  const selectedSourceIndex = sourceUniverse.documents.findIndex(
    (document) => document.accession === selectedPassage.source.accession,
  );
  const selectedSourceDocument = sourceUniverse.documents[selectedSourceIndex];
  if (selectedSourceIndex < 0) {
    fail('the selected passage source document could not be located in the sealed universe');
  }
  // lib/canonical-v2/metsera-exclusivity-product-row.js re-derives and
  // regex-matches a human-readable citation label downstream
  // (`^Metsera (DEFM14A), filed (...), Background of the Merger, event
  // (...)$`), which fixes issuer_name to the short form "Metsera" (matching
  // how the DEFM14A itself refers to the company throughout, e.g. the
  // selected passage text itself: "Metsera and Party 2 entered into an
  // exclusivity agreement").
  materialisationInput.source_documents[selectedSourceIndex].citation_identity = {
    ...materialisationInput.source_documents[selectedSourceIndex].citation_identity,
    issuer_name: 'Metsera',
    source_location_label: 'Background of the Merger',
  };
  if (
    materialisationInput.source_documents[selectedSourceIndex]
      .citation_identity.accession_number !== selectedSourceDocument.accession
  ) {
    fail('citation augmentation targeted the wrong source document');
  }

  // The receipt written to disk is produced by the same official,
  // unmodified compiler the sealed pilot itself calls
  // (compileProcessExclusivityPilotMaterialisation), fed with the augmented
  // input above, and immediately proven exact against that input via the
  // library's own validator.
  const materialisationReceipt =
    compileProcessExclusivityPilotMaterialisation(
      materialisationInput,
      sourceBytesByIdentity,
    );
  validateProcessExclusivityPilotMaterialisation(
    materialisationReceipt,
    materialisationInput,
    sourceBytesByIdentity,
  );

  // Real candidate release + product authority context, exactly as the
  // staging runner builds them.
  const combinedPilotBaseRelease = buildCombinedPilotBaseRelease();
  const productAuthority = currentProductAuthority(combinedPilotBaseRelease.manifest);
  const candidateReleaseBinding = {
    candidate_release_manifest_id: combinedPilotBaseRelease.manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: combinedPilotBaseRelease.manifest.canonical_payload_digest,
    corpus_release_id: combinedPilotBaseRelease.manifest.corpus_release_id,
  };

  const realProcessAdmission = compileMetseraExclusivityProcessPhrasebookAdmission({
    materialisation_input: materialisationInput,
    materialisation_receipt: materialisationReceipt,
    candidate_release_binding: candidateReleaseBinding,
    pilot_product_authority_context: productAuthority.context,
    pilot_product_authority_input: productAuthority.input,
  }, sourceBytesByIdentity);
  const productAdmission = compileMetseraExclusivityProductAdmission({
    process_phrasebook_admission: realProcessAdmission,
  }, sourceBytesByIdentity);
  const productRow = compileMetseraExclusivityProductRow(
    productAdmission,
    productAuthority.context,
    productAuthority.input,
    sourceBytesByIdentity,
  );

  const { cohortRequest, cohortExecutionInput } = buildCohortFiles(productAdmission, productRow);

  mkdirSync(outDir, { recursive: true });
  const files = {
    'materialisation-input.json': materialisationInput,
    'materialisation-receipt.json': materialisationReceipt,
    'cohort-request.json': cohortRequest,
    'cohort-execution-input.json': cohortExecutionInput,
  };
  const filePaths = {};
  for (const [name, value] of Object.entries(files)) {
    const filePath = join(outDir, name);
    writeStableJson(filePath, value);
    filePaths[name] = filePath;
  }

  const subjectDealKey = productAdmission.admission_input.result_identity.governed_deal_admission_id;
  const subjectProductResultIdentity =
    productRow.shared_row_adapter_receipt.product_query_result.product_query_result_identity;

  process.stdout.write(`${JSON.stringify({
    schema_version: 'METSERA_EXCLUSIVITY_P8_PREPARED_INPUTS/V1',
    out_dir: outDir,
    source_dir: sourceDir,
    subject_deal_key: subjectDealKey,
    subject_product_result_identity: subjectProductResultIdentity,
    files: Object.fromEntries(
      Object.entries(filePaths).map(([name, filePath]) => [
        name,
        { path: filePath, sha256: sha256HexOfFile(filePath) },
      ]),
    ),
  }, null, 2)}\n`);
}

main();
