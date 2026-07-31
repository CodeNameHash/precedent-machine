#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  buildCanonicalWriteReceipt,
} = require('../lib/canonical-v2/canonical-writer');
const {
  compileAgreementCandidateProductMaterialisation,
} = require('../lib/canonical-v2/agreement-candidate-product-materialisation');
const {
  buildAgreementCandidateEnvelopeCarrier,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  authority,
  evaluationEvidence,
  familyInput,
} = require('../tests/fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs');

const OPERATION = 'PRODUCT_RESULT_CANDIDATE_RUN';
const STAGING_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const INVALID_MATERIALISATION =
  'invalid SQL-native Agreement candidate Product materialisation';
const PROFILES = Object.freeze([
  'CAPITALISATION_BRING_DOWN_V3',
  'IOC_CAPEX_RESTRICTION_V1',
]);
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-agreement-product-writer-p8-',
  operationLabel: 'P8 Agreement Product hostile writer staging proof',
  bounds: {
    maxSqlBytes: 6 * 1024 * 1024,
    maxProcessBufferBytes: 8 * 1024 * 1024,
    maxResponseBytes: 1024 * 1024,
  },
});

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function idempotencyKey(profile, suffix = 'VALID') {
  return `P8_AGREEMENT_PRODUCT_WRITER_${profile}_${suffix}_V1`;
}

function buildFixture(profile) {
  const { input: authorityInput, context: authorityContext } = authority();
  const envelopeInput = {
    family_profile_id: profile,
    family_input: familyInput(profile),
  };
  const prepared = evaluationEvidence({
    envelopeInput,
    authorityInput,
    authorityContext,
  });
  const materialisation = compileAgreementCandidateProductMaterialisation({
    agreement_candidate_envelope: prepared.envelopeValue,
    family_input: envelopeInput.family_input,
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_context_input: authorityInput,
    product_evaluation_evidence: prepared.product_evaluation_evidence,
  });
  const writeSet = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
    domain_carrier: buildAgreementCandidateEnvelopeCarrier(
      prepared.envelopeValue,
      materialisation,
    ),
  });
  return {
    profile,
    materialisation,
    writeSet,
    validation: validateProductCandidateResultWriteSet(writeSet),
  };
}

function requestFor({ writeSet, key, validation }) {
  const residuals = [];
  const quarantines = [];
  const receiptValidation = validation || validateProductCandidateResultWriteSet(writeSet);
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: OPERATION,
    idempotencyKey: key,
    writeSet,
    residuals,
    quarantines,
  });
  return {
    idempotencyKey: key,
    inputDigest,
    receipt: buildCanonicalWriteReceipt({
      operation: OPERATION,
      idempotencyKey: key,
      inputDigest,
      validation: receiptValidation,
    }),
  };
}

function replaceText(value, expected, replacement) {
  if (value === expected) return replacement;
  if (Array.isArray(value)) {
    return value.map((item) => replaceText(item, expected, replacement));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    replaceText(item, expected, replacement),
  ]));
}

function recomputeTerminal(terminal, { preserveShape = false } = {}) {
  if (!preserveShape) {
    terminal.subject_terminal_payload_digest = digest(terminal.subject_terminal);
  }
  const body = clone(terminal);
  delete body.schema_version;
  delete body.terminal_id;
  delete body.terminal_payload_digest;
  delete body.subject_terminal;
  terminal.terminal_id = contentId(
    'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1', body,
  );
  terminal.terminal_payload_digest = digest(body);
}

function recomputeQueryIdentity(materialisation) {
  const query = materialisation.product_query_ir;
  const previous = query.query_definition_id;
  const identity = clone(query);
  delete identity.query_definition_id;
  query.query_definition_id = contentId('PRODUCT_QUERY_IR/V1', identity);
  return { previous, current: query.query_definition_id };
}

function recomputeResultIdentity(materialisation) {
  const result = materialisation.product_query_result;
  const previous = result.product_query_result_identity;
  result.product_query_result_identity = contentId('PRODUCT_QUERY_RESULT/V1', {
    schema_version: result.schema_version,
    product_query_definition_id: result.product_query_definition_id,
    approved_pm_data_version_id: result.approved_pm_data_version_id,
    candidate_release_manifest_id: result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition_stable_id: result.domain_result_definition.stable_id,
    domain_result_definition_version: result.domain_result_definition.version,
    domain_result_identity: result.domain_result_identity,
  });
  return { previous, current: result.product_query_result_identity };
}

function recomputeCitation(result) {
  const citation = result.exact_citation;
  citation.citation_target_identity = contentId(citation.schema_version, {
    product_query_result_identity: result.product_query_result_identity,
    candidate_release_manifest_id: result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity: citation.source_document_identity,
    source_evidence_identity: citation.source_evidence_identity,
  });
}

function recomputeSchemaObjectId(value, idField) {
  const body = clone(value);
  delete body[idField];
  value[idField] = contentId(value.schema_version, body);
}

function recomputeOrdering(ordering) {
  const body = clone(ordering);
  delete body.ordering_projection_id;
  delete body.canonical_payload_digest;
  ordering.ordering_projection_id = contentId(
    'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION/V1', body,
  );
  ordering.canonical_payload_digest = digest(body);
}

function recomputePresentation(presentation) {
  presentation.product_result_presentation_id = contentId(
    'PRODUCT_RESULT_PRESENTATION/V1', presentation.identity_inputs,
  );
  const body = clone(presentation);
  delete body.product_result_presentation_id;
  delete body.canonical_payload_digest;
  presentation.canonical_payload_digest = digest(body);
}

function recomputeSurfaces(surfaces) {
  const first = surfaces.surface_bindings.COMPARE;
  const identity = {
    product_query_definition_id: first.product_query_definition_id,
    product_query_result_identity: first.product_query_result_identity,
    domain_result_identity: first.domain_result_identity,
    product_result_presentation_id: first.product_result_presentation_id,
    candidate_release_manifest_id: first.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      first.candidate_release_manifest_payload_digest,
    exact_citation_target_identity: first.exact_citation_target_identity,
    exact_detail_action: first.exact_detail_action,
  };
  surfaces.renderer_neutral_content_identity = contentId(
    'PRODUCT_RESULT_SURFACE_BINDING/V1', identity,
  );
  for (const binding of Object.values(surfaces.surface_bindings)) {
    binding.renderer_neutral_content_identity =
      surfaces.renderer_neutral_content_identity;
  }
  const body = clone(surfaces);
  delete body.schema_version;
  delete body.product_result_surface_binding_id;
  surfaces.product_result_surface_binding_id = contentId(
    'PRODUCT_RESULT_SURFACE_BINDING/V1', body,
  );
}

function recomputeSurfaceRecordId(surfaces) {
  const body = clone(surfaces);
  delete body.schema_version;
  delete body.product_result_surface_binding_id;
  surfaces.product_result_surface_binding_id = contentId(
    'PRODUCT_RESULT_SURFACE_BINDING/V1', body,
  );
}

function recomputeCarrier(writeSet, { preserveTerminalShape = false } = {}) {
  const carrier = writeSet.domain_carrier;
  const envelope = carrier.agreement_candidate_envelope;
  const materialisation = carrier.product_materialisation;
  for (const terminal of envelope.ordered_terminals) {
    recomputeTerminal(terminal, { preserveShape: preserveTerminalShape });
  }
  const envelopeBody = clone(envelope);
  delete envelopeBody.schema_version;
  delete envelopeBody.agreement_candidate_envelope_id;
  envelope.agreement_candidate_envelope_id = contentId(
    'AGREEMENT_CANDIDATE_ENVELOPE/V1', envelopeBody,
  );
  carrier.agreement_candidate_envelope_id = envelope.agreement_candidate_envelope_id;
  carrier.agreement_candidate_envelope_payload_digest = digest(envelope);
  materialisation.agreement_candidate_envelope_id = envelope.agreement_candidate_envelope_id;

  const queryIdentity = recomputeQueryIdentity(materialisation);
  if (queryIdentity.previous !== queryIdentity.current) {
    carrier.product_materialisation = replaceText(
      carrier.product_materialisation,
      queryIdentity.previous,
      queryIdentity.current,
    );
  }
  const resultIdentity = recomputeResultIdentity(carrier.product_materialisation);
  if (resultIdentity.previous !== resultIdentity.current) {
    carrier.product_materialisation = replaceText(
      carrier.product_materialisation,
      resultIdentity.previous,
      resultIdentity.current,
    );
  }
  const refreshed = carrier.product_materialisation;
  refreshed.product_query_result.product_query_definition_id =
    refreshed.product_query_ir.query_definition_id;
  recomputeCitation(refreshed.product_query_result);
  for (const slot of refreshed.product_result_set.ordered_result_slots) {
    if (slot.slot_state === 'VALID') {
      slot.slot_identity =
        refreshed.product_query_result.product_query_result_identity;
      slot.product_query_result = clone(refreshed.product_query_result);
    }
  }
  recomputeSchemaObjectId(
    refreshed.product_result_set.query_execution_summary,
    'query_execution_summary_id',
  );
  refreshed.product_evaluation_evidence.raw_product_query.predicate_key =
    refreshed.product_query_ir.semantic_contract.predicate_key;
  refreshed.product_evaluation_evidence.understood_legal_question.predicate_key =
    refreshed.product_query_ir.semantic_contract.predicate_key;
  recomputeSchemaObjectId(
    refreshed.product_evaluation_evidence.product_query_result_admission_receipt,
    'admission_receipt_id',
  );
  refreshed.evidence_sidecar.exact_citation = clone(
    refreshed.product_query_result.exact_citation,
  );
  refreshed.agreement_ordering_projection.product_query_ir = clone(
    refreshed.product_query_ir,
  );
  refreshed.product_result_presentation.contract_bindings
    .product_query_ir_definition.query_payload_digest = digest(
      refreshed.product_query_ir,
    );
  recomputeOrdering(refreshed.agreement_ordering_projection);
  const orderingReceipt = refreshed.product_evaluation_evidence
    .product_query_result_ordering_receipt;
  orderingReceipt.domain_ordering_projection_identity =
    refreshed.agreement_ordering_projection.ordering_projection_id;
  orderingReceipt.domain_ordering_projection_payload_digest =
    refreshed.agreement_ordering_projection.canonical_payload_digest;
  recomputeSchemaObjectId(orderingReceipt, 'ordering_receipt_id');
  refreshed.product_result_presentation.query_execution_summary_id =
    refreshed.product_result_set.query_execution_summary
      .query_execution_summary_id;
  recomputePresentation(refreshed.product_result_presentation);
  recomputeSurfaces(refreshed.product_result_surfaces);
  const materialisationBody = clone(refreshed);
  delete materialisationBody.schema_version;
  delete materialisationBody.agreement_candidate_product_materialisation_id;
  refreshed.agreement_candidate_product_materialisation_id = contentId(
    'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1', materialisationBody,
  );
  const carrierBody = clone(carrier);
  delete carrierBody.agreement_candidate_envelope_carrier_id;
  delete carrierBody.agreement_candidate_envelope_carrier_payload_digest;
  carrier.agreement_candidate_envelope_carrier_id = contentId(
    'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1', carrierBody,
  );
  carrier.agreement_candidate_envelope_carrier_payload_digest = digest(carrierBody);
  return writeSet;
}

function hostileWriteSet(fixture, mutation) {
  const writeSet = clone(fixture.writeSet);
  const carrier = writeSet.domain_carrier;
  const { agreement_candidate_envelope: envelope, product_materialisation: materialisation } = carrier;
  switch (mutation) {
    case 'QUERY_PROFILE':
      materialisation.product_query_ir.semantic_contract.predicate_key =
        'HOSTILE_PROFILE_SUBSTITUTION';
      break;
    case 'RESULT_ACTION_CITATION':
      materialisation.product_query_result.exact_detail_action =
        'HOSTILE_UNGOVERNED_DETAIL_ACTION';
      materialisation.product_query_result.exact_citation.source_location_label =
        'Hostile substituted citation';
      materialisation.product_query_result.exact_citation.human_readable_source_label =
        'Hostile substituted citation';
      break;
    case 'IOC_OLD_CAPEX_CITATION':
      materialisation.product_query_result.exact_citation
        .result_component_evidence_identity = materialisation.product_query_result
          .exact_citation.source_evidence_identity;
      break;
    case 'IOC_LOST_PRECISION':
      materialisation.product_query_result.domain_result_payload
        .canonical_result.components[0].denominator.precision = 'NOT_CAPTURED';
      materialisation.product_query_result.domain_result_payload
        .canonical_result.components[0].claim_attributes.denominator_precision =
          'NOT_CAPTURED';
      materialisation.product_query_result.domain_result_payload
        .canonical_result.market_context.subject_observation.denominator.precision =
          'NOT_CAPTURED';
      envelope.ordered_terminals[0].subject_terminal.denominator.precision =
        'NOT_CAPTURED';
      envelope.ordered_terminals[0].subject_terminal.claim_attributes
        .denominator_precision = 'NOT_CAPTURED';
      break;
    case 'ORDERING':
      materialisation.agreement_ordering_projection.comparator_state =
        'HOSTILE_UNGOVERNED_ORDER';
      break;
    case 'PRESENTATION':
      materialisation.product_result_presentation.filter_sentence =
        'Hostile rendered instruction';
      break;
    case 'SURFACES':
      materialisation.product_result_surfaces.surface_state =
        'HOSTILE_SERVED';
      break;
    case 'SURFACE_QUERY_DEFINITION_ID':
    case 'SURFACE_RESULT_IDENTITY':
    case 'SURFACE_DOMAIN_IDENTITY':
    case 'SURFACE_PRESENTATION_ID':
    case 'SURFACE_RELEASE_ID':
    case 'SURFACE_RELEASE_DIGEST':
    case 'SURFACE_CITATION_TARGET':
    case 'SURFACE_DETAIL_ACTION':
    case 'SURFACE_RENDERER_IDENTITY':
    case 'SURFACE_SOURCE_DOCUMENT':
    case 'SURFACE_SOURCE_EVIDENCE':
    case 'SURFACE_AUTHORITY':
    case 'SURFACE_EXTRA_FIELD':
    case 'SURFACE_MISSING_FIELD':
      break;
    case 'EVIDENCE_RELEASE':
      materialisation.candidate_release_binding.release_state = 'ACTIVE';
      break;
    case 'TERMINAL_BODY':
      envelope.ordered_terminals[0].metric_key = 'HOSTILE_TERMINAL_BODY';
      break;
    case 'TERMINAL_SUBJECT':
      envelope.ordered_terminals[0].subject_terminal = {
        hostile_subject: 'substituted',
      };
      break;
    case 'TERMINAL_ID':
      envelope.ordered_terminals[0].subject_terminal_id =
        '0'.repeat(64);
      break;
    case 'TERMINAL_SHAPE':
      delete envelope.ordered_terminals[0].subject_terminal_payload_digest;
      break;
    case 'PROVISION_ROW':
      envelope.provision_row = {
        ...envelope.provision_row,
        provision_row_id: '0'.repeat(64),
      };
      break;
    case 'PRODUCT_MEMBERSHIP':
      envelope.product_membership = {
        ...envelope.product_membership,
        membership_state: 'HOSTILE_MATERIALISED',
      };
      break;
    case 'PRODUCT_MEMBERSHIP_EXTRA':
      envelope.product_membership = {
        ...envelope.product_membership,
        hostile_authority: true,
      };
      break;
    default:
      throw new Error(`Unknown Agreement Product hostile mutation: ${mutation}`);
  }
  const rehashed = recomputeCarrier(writeSet, {
    preserveTerminalShape: mutation === 'TERMINAL_SHAPE',
  });
  const refreshed = rehashed.domain_carrier.product_materialisation;
  const result = refreshed.product_query_result;
  for (const slot of refreshed.product_result_presentation.result_slots) {
    if (slot.slot_state === 'VALID') {
      slot.exact_detail_action = result.exact_detail_action;
      slot.exact_citation = clone(result.exact_citation);
    }
  }
  for (const binding of Object.values(
    refreshed.product_result_surfaces.surface_bindings,
  )) {
    binding.exact_detail_action = result.exact_detail_action;
    binding.exact_citation_target_identity =
      result.exact_citation.citation_target_identity;
  }
  recomputePresentation(refreshed.product_result_presentation);
  recomputeSurfaces(refreshed.product_result_surfaces);
  const compare = refreshed.product_result_surfaces.surface_bindings.COMPARE;
  switch (mutation) {
    case 'SURFACE_QUERY_DEFINITION_ID':
      compare.product_query_definition_id = '0'.repeat(64); break;
    case 'SURFACE_RESULT_IDENTITY':
      compare.product_query_result_identity = '0'.repeat(64); break;
    case 'SURFACE_DOMAIN_IDENTITY':
      compare.domain_result_identity = '0'.repeat(64); break;
    case 'SURFACE_PRESENTATION_ID':
      compare.product_result_presentation_id = '0'.repeat(64); break;
    case 'SURFACE_RELEASE_ID':
      compare.candidate_release_manifest_id = '0'.repeat(64); break;
    case 'SURFACE_RELEASE_DIGEST':
      compare.candidate_release_manifest_payload_digest = '0'.repeat(64); break;
    case 'SURFACE_CITATION_TARGET':
      compare.exact_citation_target_identity = '0'.repeat(64); break;
    case 'SURFACE_DETAIL_ACTION':
      compare.exact_detail_action = 'HOSTILE_DETAIL_ACTION'; break;
    case 'SURFACE_RENDERER_IDENTITY':
      compare.renderer_neutral_content_identity = '0'.repeat(64); break;
    case 'SURFACE_SOURCE_DOCUMENT':
      compare.source_document_identity = '0'.repeat(64); break;
    case 'SURFACE_SOURCE_EVIDENCE':
      compare.source_evidence_identity = '0'.repeat(64); break;
    case 'SURFACE_AUTHORITY':
      compare.authority_state = 'HOSTILE_GRANTED'; break;
    case 'SURFACE_EXTRA_FIELD':
      compare.hostile_extra = true; break;
    case 'SURFACE_MISSING_FIELD':
      delete compare.source_evidence_identity; break;
    default:
      break;
  }
  recomputeSurfaceRecordId(refreshed.product_result_surfaces);
  const materialisationBody = clone(refreshed);
  delete materialisationBody.schema_version;
  delete materialisationBody.agreement_candidate_product_materialisation_id;
  refreshed.agreement_candidate_product_materialisation_id = contentId(
    'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1', materialisationBody,
  );
  const carrierBody = clone(rehashed.domain_carrier);
  delete carrierBody.agreement_candidate_envelope_carrier_id;
  delete carrierBody.agreement_candidate_envelope_carrier_payload_digest;
  rehashed.domain_carrier.agreement_candidate_envelope_carrier_id = contentId(
    'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1', carrierBody,
  );
  rehashed.domain_carrier.agreement_candidate_envelope_carrier_payload_digest =
    digest(carrierBody);
  return rehashed;
}

function stateSql() {
  return `
SELECT
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_candidate_results)
    AS candidate_result_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.write_receipts
   WHERE operation = ${runtime.sqlText(OPERATION)})
    AS candidate_write_receipt_count,
  (SELECT canonical_payload
   FROM canonical_v2_staging.active_corpus_release_pointers
   WHERE environment = 'staging') AS active_pointer;`;
}

function writerCall(writeSet, request) {
  return `public.canonical_v2_write(
    'staging',
    ${runtime.sqlText(OPERATION)},
    ${runtime.sqlText(request.idempotencyKey)},
    ${runtime.sqlText(request.inputDigest)},
    ${runtime.sqlJson(writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${runtime.sqlJson(request.receipt)}
  )`;
}

function hostileRequest(fixture, mutation) {
  const writeSet = hostileWriteSet(fixture, mutation);
  return {
    mutation,
    writeSet,
    request: requestFor({
      writeSet,
      key: idempotencyKey(fixture.profile, `HOSTILE_${mutation}`),
      validation: fixture.validation,
    }),
  };
}

function proveValidStagingWriter(fixtures, before) {
  const [f28, ioc] = fixtures;
  const f28Request = requestFor({
    writeSet: f28.writeSet,
    key: idempotencyKey(f28.profile),
  });
  const iocRequest = requestFor({
    writeSet: ioc.writeSet,
    key: idempotencyKey(ioc.profile),
  });
  const f28Conflict = requestFor({
    writeSet: ioc.writeSet,
    key: f28Request.idempotencyKey,
  });
  const iocConflict = requestFor({
    writeSet: f28.writeSet,
    key: iocRequest.idempotencyKey,
  });
  const proofRows = runtime.runSql(`
DO $agreement_product_writer_p8$
DECLARE
  candidate_count_before integer;
  receipt_count_before integer;
  candidate_count_after_valid integer;
  receipt_count_after_valid integer;
  pointer_before jsonb;
  pointer_after jsonb;
  f28_result jsonb;
  f28_replay jsonb;
  ioc_result jsonb;
  ioc_replay jsonb;
BEGIN
  SELECT count(*)::integer INTO candidate_count_before
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_before
  FROM canonical_v2_staging.write_receipts
  WHERE operation = ${runtime.sqlText(OPERATION)};
  SELECT canonical_payload INTO pointer_before
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';

  f28_result := ${writerCall(f28.writeSet, f28Request)};
  f28_replay := ${writerCall(f28.writeSet, f28Request)};
  BEGIN
    PERFORM ${writerCall(ioc.writeSet, f28Conflict)};
    RAISE EXCEPTION 'F28 conflicting Agreement Product replay was accepted';
  EXCEPTION WHEN unique_violation THEN
    IF position('idempotency key already names different canonical input' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  ioc_result := ${writerCall(ioc.writeSet, iocRequest)};
  ioc_replay := ${writerCall(ioc.writeSet, iocRequest)};
  BEGIN
    PERFORM ${writerCall(f28.writeSet, iocConflict)};
    RAISE EXCEPTION 'IOC conflicting Agreement Product replay was accepted';
  EXCEPTION WHEN unique_violation THEN
    IF position('idempotency key already names different canonical input' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
  SELECT count(*)::integer INTO candidate_count_after_valid
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_after_valid
  FROM canonical_v2_staging.write_receipts
  WHERE operation = ${runtime.sqlText(OPERATION)};
  IF f28_result->>'replayed' IS DISTINCT FROM 'false'
    OR f28_replay->>'replayed' IS DISTINCT FROM 'true'
    OR ioc_result->>'replayed' IS DISTINCT FROM 'false'
    OR ioc_replay->>'replayed' IS DISTINCT FROM 'true'
    OR candidate_count_after_valid <> candidate_count_before + 2
    OR receipt_count_after_valid <> receipt_count_before + 2
  THEN
    RAISE EXCEPTION 'valid Agreement Product writer replay proof failed closed';
  END IF;
  SELECT canonical_payload INTO pointer_after
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';
  IF pointer_after IS DISTINCT FROM pointer_before THEN
    RAISE EXCEPTION 'Agreement Product writer changed the active pointer';
  END IF;
END
$agreement_product_writer_p8$;
${stateSql()}`);
  const duringRollback = proofRows[0];
  if (
    !duringRollback
    || duringRollback.candidate_result_count !== before.candidate_result_count + 2
    || duringRollback.candidate_write_receipt_count
      !== before.candidate_write_receipt_count + 2
    || JSON.stringify(duringRollback.active_pointer) !== JSON.stringify(before.active_pointer)
  ) {
    throw new Error('Agreement Product rollback proof did not preserve valid-write state.');
  }
}

function proveHostileStagingWriter(hostile, before) {
  for (const { mutation, writeSet, request } of hostile) {
    const rows = runtime.runSql(`
DO $agreement_product_hostile_p8$
DECLARE
  candidate_count_before integer;
  receipt_count_before integer;
  pointer_before jsonb;
  pointer_after jsonb;
BEGIN
  SELECT count(*)::integer INTO candidate_count_before
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_before
  FROM canonical_v2_staging.write_receipts
  WHERE operation = ${runtime.sqlText(OPERATION)};
  SELECT canonical_payload INTO pointer_before
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';

  BEGIN
    PERFORM ${writerCall(writeSet, request)};
    RAISE EXCEPTION 'hostile ${mutation} Agreement Product write was accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM IS DISTINCT FROM ${runtime.sqlText(INVALID_MATERIALISATION)} THEN
      RAISE;
    END IF;
  END;

  SELECT canonical_payload INTO pointer_after
  FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';
  IF (SELECT count(*) FROM canonical_v2_staging.product_candidate_results)
      <> candidate_count_before
    OR (SELECT count(*) FROM canonical_v2_staging.write_receipts
        WHERE operation = ${runtime.sqlText(OPERATION)})
      <> receipt_count_before
    OR pointer_after IS DISTINCT FROM pointer_before
  THEN
    RAISE EXCEPTION 'hostile ${mutation} Agreement Product write reached DML';
  END IF;
END
$agreement_product_hostile_p8$;
${stateSql()}`);
    if (JSON.stringify(rows[0]) !== JSON.stringify(before)) {
      throw new Error(`Hostile ${mutation} proof changed rollback state.`);
    }
  }
}

async function main() {
  runtime.guardProject();
  if (runtime.project.ref !== STAGING_PROJECT_REF) {
    throw new Error('Agreement Product writer is not linked to the approved staging project.');
  }
  const fixtures = PROFILES.map(buildFixture);
  const before = runtime.runSql(stateSql(), { readOnly: true })[0];
  if (!before) throw new Error('Agreement Product writer could not read staging state.');
  proveValidStagingWriter(fixtures, before);
  const hostile = fixtures.flatMap((fixture) => [
    'QUERY_PROFILE',
    'RESULT_ACTION_CITATION',
    'ORDERING',
    'PRESENTATION',
    'SURFACES',
    'SURFACE_QUERY_DEFINITION_ID',
    'SURFACE_RESULT_IDENTITY',
    'SURFACE_DOMAIN_IDENTITY',
    'SURFACE_PRESENTATION_ID',
    'SURFACE_RELEASE_ID',
    'SURFACE_RELEASE_DIGEST',
    'SURFACE_CITATION_TARGET',
    'SURFACE_DETAIL_ACTION',
    'SURFACE_RENDERER_IDENTITY',
    'SURFACE_SOURCE_DOCUMENT',
    'SURFACE_SOURCE_EVIDENCE',
    'SURFACE_AUTHORITY',
    'SURFACE_EXTRA_FIELD',
    'SURFACE_MISSING_FIELD',
    'EVIDENCE_RELEASE',
    'TERMINAL_BODY',
    'TERMINAL_SUBJECT',
    'TERMINAL_ID',
    'TERMINAL_SHAPE',
    'PROVISION_ROW',
    'PRODUCT_MEMBERSHIP',
    'PRODUCT_MEMBERSHIP_EXTRA',
    ...(fixture.profile === 'IOC_CAPEX_RESTRICTION_V1' ? [
      'IOC_OLD_CAPEX_CITATION',
      'IOC_LOST_PRECISION',
    ] : []),
  ].map((mutation) => hostileRequest(fixture, mutation)));
  proveHostileStagingWriter(hostile, before);
  const hostile_call_count = hostile.length;
  const after = runtime.runSql(stateSql(), { readOnly: true })[0];
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error('Forced rollback changed durable Agreement Product writer state.');
  }
  process.stdout.write(`${JSON.stringify({
    schema_version: 'AGREEMENT_PRODUCT_WRITER_HOSTILE_STAGING_PROOF_P8/V1',
    project_ref: runtime.project.ref,
    execution_environment: 'staging',
    profiles: PROFILES,
    valid_write_profiles: PROFILES,
    exact_replay_no_op: true,
    conflicting_replay_rejected: true,
    hostile_call_count,
    hostile_rejected_before_dml: true,
    forced_rollback: true,
    candidate_rows_unchanged: true,
    receipt_rows_unchanged: true,
    active_pointer_unchanged: true,
    production_accessed: false,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
