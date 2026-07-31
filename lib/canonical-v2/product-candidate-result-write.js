const productCandidateWriteContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-candidate-result-writer.v1.json',
);
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateMetseraExclusivityProductAdmission,
} = require('./metsera-exclusivity-product-admission');
const {
  validateMetseraExclusivityProcessPhrasebookAdmission,
} = require('./metsera-exclusivity-process-phrasebook-admission');
const {
  validateProcessExclusivityPilotMaterialisation,
} = require('./process-exclusivity-pilot');
const {
  validateMetseraExclusivityProductPresentation,
} = require('./metsera-exclusivity-product-presentation');
const {
  validateMetseraExclusivityProductResultSet,
} = require('./metsera-exclusivity-product-result-set');
const {
  validateMetseraExclusivityProductRow,
} = require('./metsera-exclusivity-product-row');
const {
  validateMetseraExclusivityProductSurfaces,
} = require('./metsera-exclusivity-product-surfaces');
const {
  validateAuthoredProductCandidateWriteInputs,
} = require('./product-candidate-write-contract-input-validator');
const {
  validatePilotProductAuthorityContext,
} = require('./pilot-product-authority-context');
const {
  AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
} = require('./agreement-candidate-envelope');
const {
  AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA,
} = require('./agreement-candidate-product-materialisation');
const { canonicalProductQueryIrBytes } = require('./product-query-ir');
const { validateProductQueryResult } = require('./product-citation-share-compiler');
const { validateAgreementComparableResultOrderProjection } = require('./agreement-comparable-result-order');
const { validateProductResultPresentation } = require('./product-result-presentation-compiler');
const { validateProductResultSurfaceBindings } = require('./product-result-surface-bindings');
const {
  compileProductQueryResultSet,
} = require('./product-query-result-set-compiler');
const agreementEnvelopeContract = require(
  '../../contracts/canonical-v2/successor/product/query/agreement-candidate-envelope.v1.json',
);

const PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_WRITE_SET/V1';
const PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_RECORD/V1';
const PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE/V1';
const PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA =
  'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1';
const AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA =
  'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1';
const ADAPTER_IDENTIFIERS = Object.freeze([
  'AGREEMENT_CANDIDATE_ENVELOPE',
  'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
]);
const WRITE_ENVELOPE_KEYS = Object.freeze([
  'adapter_identifier',
  'domain_carrier',
  'schema_version',
]);
const WRITE_SET_KEYS = Object.freeze([
  'candidate_release_binding',
  'process_pilot_materialisation_receipt',
  'product_admission',
  'product_presentation',
  'product_result_set',
  'product_row',
  'product_surfaces',
  'schema_version',
]);

class ProductCandidateResultWriteError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductCandidateResultWriteError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductCandidateResultWriteError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function sha256(value) {
  return require('./canonical-bytes').sha256Hex(Buffer.from(
    canonicalJson(value),
    'utf8',
  ));
}

function exactKeys(value, keys, code, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    fail(code, message);
  }
}

function buildProcessPhrasebookProductChain(
  writeSet,
  authorityContext,
  authorityInput,
) {
  validatePilotProductAuthorityContext(authorityContext, authorityInput);
  const body = {
    schema_version: PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA,
    complete_write_set: clone(writeSet),
    pilot_product_authority_context: clone(authorityContext),
    pilot_product_authority_context_input: clone(authorityInput),
  };
  return {
    schema_version: body.schema_version,
    process_phrasebook_product_chain_id: contentId(
      PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA,
      body,
    ),
    process_phrasebook_product_chain_payload_digest: sha256(body),
    ...body,
  };
}

function validateAgreementCarrier(carrier) {
  exactKeys(carrier, [
    'agreement_candidate_envelope',
    'agreement_candidate_envelope_carrier_id',
    'agreement_candidate_envelope_carrier_payload_digest',
    'agreement_candidate_envelope_id',
    'agreement_candidate_envelope_payload_digest',
    'schema_version',
    'product_materialisation',
  ], 'INVALID_AGREEMENT_CANDIDATE_ENVELOPE_CARRIER',
  'The Agreement domain carrier is not closed.');
  const carrierBody = clone(carrier);
  delete carrierBody.agreement_candidate_envelope_carrier_id;
  delete carrierBody.agreement_candidate_envelope_carrier_payload_digest;
  const envelope = carrier.agreement_candidate_envelope;
  exactKeys(envelope, [
    'agreement_candidate_envelope_id',
    'authority_state',
    'candidate_state',
    'contract_definition_digest',
    'contract_stable_id',
    'family_profile_digest',
    'family_profile_id',
    'ordered_terminals',
    'product_membership',
    'provision_row',
    'schema_version',
    'source_projection',
    'source_projection_id',
    'source_projection_payload_digest',
  ], 'INVALID_AGREEMENT_CANDIDATE_ENVELOPE_CARRIER',
  'The Agreement candidate envelope is not closed.');
  const body = clone(envelope);
  delete body.agreement_candidate_envelope_id;
  delete body.schema_version;
  const projectionBody = clone(envelope.source_projection || {});
  delete projectionBody.schema_version;
  delete projectionBody.source_projection_id;
  delete projectionBody.source_projection_payload_digest;
  const provisionRow = envelope.source_projection?.provision_row?.payload;
  const provisionRowId = provisionRow?.provision_row_id
    || provisionRow?.row_serving_key;
  if (
    carrier.schema_version !== AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA
    || carrier.agreement_candidate_envelope_carrier_id !== contentId(
      AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA, carrierBody,
    )
    || carrier.agreement_candidate_envelope_carrier_payload_digest
      !== sha256(carrierBody)
    || envelope.schema_version !== AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA
    || envelope.candidate_state !== 'VALIDATED_NOT_MATERIALISED'
    || envelope.authority_state !== 'NONE'
    || carrier.agreement_candidate_envelope_id
      !== envelope.agreement_candidate_envelope_id
    || carrier.agreement_candidate_envelope_payload_digest !== sha256(envelope)
    || envelope.agreement_candidate_envelope_id !== contentId(
      AGREEMENT_CANDIDATE_ENVELOPE_RUNTIME_SCHEMA,
      body,
    )
    || envelope.source_projection_id !== envelope.source_projection
      ?.source_projection_id
    || envelope.source_projection_payload_digest !== envelope.source_projection
      ?.source_projection_payload_digest
    || envelope.source_projection?.source_projection_payload_digest
      !== sha256(projectionBody)
    || envelope.source_projection?.source_projection_id !== contentId(
      'AGREEMENT_CANDIDATE_ENVELOPE_SOURCE_PROJECTION/V1', projectionBody,
    )
    || envelope.source_projection?.provision_row?.payload_digest
      !== sha256(provisionRow)
    || envelope.source_projection?.provision_row?.id !== provisionRowId
    || !Array.isArray(envelope.ordered_terminals)
    || envelope.ordered_terminals.some((terminal) => {
      const terminalBody = clone(terminal);
      delete terminalBody.terminal_id;
      delete terminalBody.terminal_payload_digest;
      delete terminalBody.subject_terminal;
      delete terminalBody.schema_version;
      return terminal.schema_version !== 'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1'
        || terminal.terminal_payload_digest !== sha256(terminalBody)
        || terminal.terminal_id !== contentId(
          'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1', terminalBody,
        )
        || terminal.subject_terminal_payload_digest !== sha256(
          terminal.subject_terminal,
        );
    })
  ) {
    fail(
      'INVALID_AGREEMENT_CANDIDATE_ENVELOPE_CARRIER',
      'The Agreement carrier identity, payload or nested terminal is invalid.',
    );
  }
}

function validateAgreementMaterialisation(value, envelope) {
  exactKeys(value, [
    'agreement_candidate_envelope_id',
    'agreement_candidate_product_materialisation_id',
    'agreement_ordering_projection', 'authority_state',
    'candidate_release_binding', 'evidence_sidecar',
    'materialisation_state', 'product_evaluation_evidence', 'product_query_ir',
    'product_query_result', 'product_result_presentation', 'product_result_set',
    'product_result_surfaces', 'schema_version',
  ], 'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
  'The Agreement Product materialisation is not closed.');
  const body = clone(value);
  delete body.schema_version;
  delete body.agreement_candidate_product_materialisation_id;
  if (
    value.schema_version !== AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA
    || value.agreement_candidate_envelope_id !== envelope.agreement_candidate_envelope_id
    || value.materialisation_state !== 'VALIDATED_NOT_PERSISTED'
    || value.authority_state !== 'NOT_GRANTED'
    || value.agreement_candidate_product_materialisation_id !== contentId(
      AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION_SCHEMA, body,
    )
  ) fail('INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
    'The Agreement Product materialisation identity or state changed.');
  try {
    canonicalProductQueryIrBytes(value.product_query_ir);
    validateProductQueryResult(value.product_query_result);
    validateAgreementComparableResultOrderProjection(value.agreement_ordering_projection);
    validateProductResultPresentation(value.product_result_presentation);
    validateProductResultSurfaceBindings(value.product_result_surfaces, {
      product_query_ir: value.product_query_ir,
      product_query_result: value.product_query_result,
      product_result_presentation: value.product_result_presentation,
      candidate_release_binding: {
        approved_pm_data_version_id: value.product_query_ir.release_contract.approved_pm_data_version_id,
        candidate_release_manifest_id: value.product_query_ir.release_contract.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest: value.product_query_ir.release_contract.candidate_release_manifest_payload_digest,
      },
      exact_source_action: value.evidence_sidecar.exact_citation
        ? { exact_citation: value.evidence_sidecar.exact_citation,
          exact_detail_action: value.product_query_result.exact_detail_action }
        : {},
    });
  } catch (error) {
    fail('INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
      'The Agreement Product compiler chain is invalid.', { cause: error.code || error.message });
  }
  const query = value.product_query_ir;
  const result = value.product_query_result;
  const release = value.candidate_release_binding;
  const profile = agreementEnvelopeContract.definition.runtime_contract
    .admitted_family_profiles.find(
      (candidate) => candidate.profile_id === envelope.family_profile_id,
    );
  let rebuiltResultSet;
  try {
    rebuiltResultSet = compileProductQueryResultSet({
      product_query_ir: query,
      candidate_slots: [{
        slot_identity: result.product_query_result_identity,
        slot_state: 'VALID',
        product_query_result: result,
        failure: null,
      }],
      domain_ordering_projection: value.agreement_ordering_projection,
      ordering_receipt:
        value.product_evaluation_evidence.product_query_result_ordering_receipt,
      coverage_certification:
        value.product_evaluation_evidence.coverage_certification,
    });
  } catch (error) {
    fail(
      'INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
      'The Agreement Product result set cannot be rebuilt from its evidence.',
      { cause: error.code || error.message },
    );
  }
  if (
    !profile
    || !release
    || envelope.family_profile_digest !== sha256(profile)
    || query.semantic_contract.domain_key !== 'AGREEMENT'
    || release.approved_pm_data_version_id
      !== query.release_contract.approved_pm_data_version_id
    || release.candidate_release_manifest_id
      !== query.release_contract.candidate_release_manifest_id
    || release.candidate_release_manifest_payload_digest
      !== query.release_contract.candidate_release_manifest_payload_digest
    || release.product_query_definition_id !== query.query_definition_id
    || release.release_state !== 'CANDIDATE_NOT_ACTIVE'
    || release.authority_state !== 'NOT_GRANTED'
    || !/^[a-f0-9]{64}$/.test(release.corpus_release_id || '')
    || result.product_query_definition_id !== query.query_definition_id
    || result.domain_result_identity !== envelope.product_membership.domain_result_identity
    || result.domain_result_payload_digest !== envelope.product_membership.domain_result_payload_digest
    || query.semantic_contract.result_definition.stable_id !== envelope.product_membership.result_definition_stable_id
    || query.semantic_contract.result_definition.version !== envelope.product_membership.result_definition_version
    || result.exact_detail_action !== profile.exact_detail_action_stable_id
    || canonicalJson(result.exact_citation)
      !== canonicalJson(value.evidence_sidecar.exact_citation)
    || canonicalJson(rebuiltResultSet)
      !== canonicalJson(value.product_result_set)
  ) fail('INVALID_AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION',
    'The Agreement Product materialisation does not preserve its envelope.');
}

function buildAgreementCandidateResultRecord(carrier) {
  const materialisation = carrier.product_materialisation;
  const query = materialisation.product_query_ir;
  const result = materialisation.product_query_result;
  const body = {
    schema_version: PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    writer_contract_stable_id: productCandidateWriteContract.stable_id,
    writer_contract_version: productCandidateWriteContract.definition.contract_version,
    operation: productCandidateWriteContract.definition.operation_contract.operation,
    candidate_release_manifest_id: query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: query.release_contract.candidate_release_manifest_payload_digest,
    corpus_release_id: materialisation.candidate_release_binding.corpus_release_id,
    product_query_definition_id: query.query_definition_id,
    product_query_result_identity: result.product_query_result_identity,
    domain_result_identity: result.domain_result_identity,
    process_phrasebook_result_identity: null,
    candidate_state: 'CANDIDATE_NOT_ACTIVE', authority_state: 'NOT_GRANTED',
    complete_write_set: clone(carrier),
  };
  return { schema_version: body.schema_version,
    candidate_product_result_id: contentId(PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA, clone(carrier)), ...body };
}

function buildAgreementCandidateEnvelopeCarrier(
  agreementCandidateEnvelope,
  productMaterialisation,
) {
  const body = {
    schema_version: AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA,
    agreement_candidate_envelope_id:
      agreementCandidateEnvelope?.agreement_candidate_envelope_id,
    agreement_candidate_envelope_payload_digest: sha256(
      agreementCandidateEnvelope,
    ),
    agreement_candidate_envelope: clone(agreementCandidateEnvelope),
  };
  if (productMaterialisation !== undefined) {
    body.product_materialisation = clone(productMaterialisation);
  }
  return {
    schema_version: body.schema_version,
    agreement_candidate_envelope_carrier_id: contentId(
      AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA, body,
    ),
    agreement_candidate_envelope_carrier_payload_digest: sha256(body),
    ...body,
  };
}

function validateWriteEnvelope(value) {
  exactKeys(value, WRITE_ENVELOPE_KEYS,
    'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE',
    'The Product candidate-result write envelope is not closed.');
  if (
    value.schema_version !== PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA
    || !ADAPTER_IDENTIFIERS.includes(value.adapter_identifier)
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE',
      'The Product candidate-result adapter is not admitted.',
    );
  }
  if (value.adapter_identifier === 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN') {
    const carrier = value.domain_carrier;
    exactKeys(carrier, [
      'complete_write_set',
      'pilot_product_authority_context',
      'pilot_product_authority_context_input',
      'process_phrasebook_product_chain_id',
      'process_phrasebook_product_chain_payload_digest',
      'schema_version',
    ], 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
    'The Process Phrasebook domain carrier is not closed.');
    const body = clone(carrier);
    delete body.process_phrasebook_product_chain_id;
    delete body.process_phrasebook_product_chain_payload_digest;
    if (
      carrier.schema_version !== PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA
      || carrier.process_phrasebook_product_chain_id !== contentId(
        PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA, body,
      )
      || carrier.process_phrasebook_product_chain_payload_digest !== sha256(body)
    ) {
      fail('INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
        'The Process Phrasebook carrier identity or payload has changed.');
    }
    try {
      validatePilotProductAuthorityContext(
        carrier.pilot_product_authority_context,
        carrier.pilot_product_authority_context_input,
      );
    } catch (error) {
      fail(
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
        'The Process Phrasebook carrier does not contain the exact current Product authority pair.',
        { cause: error.code || error.message },
      );
    }
    return {
      adapterIdentifier: value.adapter_identifier,
      writeSet: carrier.complete_write_set,
      authorityContext: carrier.pilot_product_authority_context,
      authorityInput: carrier.pilot_product_authority_context_input,
    };
  }
  validateAgreementCarrier(value.domain_carrier);
  validateAgreementMaterialisation(
    value.domain_carrier.product_materialisation,
    value.domain_carrier.agreement_candidate_envelope,
  );
  return { adapterIdentifier: value.adapter_identifier, agreementCarrier: clone(value.domain_carrier) };
}

function buildProductCandidateResultWriteEnvelope({
  adapter_identifier: adapterIdentifier,
  domain_carrier: domainCarrier,
} = {}) {
  return clone({
    schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA,
    adapter_identifier: adapterIdentifier,
    domain_carrier: domainCarrier,
  });
}

function assertContract() {
  validateAuthoredProductCandidateWriteInputs([{
    object_kind: productCandidateWriteContract.object_kind,
    canonical_value: productCandidateWriteContract,
  }]);
}

function validateReleaseBinding(binding, row) {
  if (
    !binding
    || typeof binding !== 'object'
    || Array.isArray(binding)
    || binding.release_state !== 'CANDIDATE_NOT_ACTIVE'
    || binding.authority_state !== 'NOT_GRANTED'
    || row.product_query_ir.release_contract
      .candidate_release_manifest_id
      !== binding.candidate_release_manifest_id
    || row.product_query_ir.release_contract
      .candidate_release_manifest_payload_digest
      !== binding.candidate_release_manifest_payload_digest
    || row.product_query_ir.query_definition_id
      !== binding.product_query_definition_id
    || typeof binding.corpus_release_id !== 'string'
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RELEASE_BINDING',
      'The candidate release is not the exact inactive Product release.',
    );
  }
}

function buildProductCandidateResultRecord(
  writeSet,
  authorityContext,
  authorityInput,
  sourceBytesByIdentity,
) {
  assertContract();
  if (
    !writeSet
    || typeof writeSet !== 'object'
    || Array.isArray(writeSet)
    || canonicalJson(Object.keys(writeSet).sort())
      !== canonicalJson([...WRITE_SET_KEYS].sort())
    || writeSet.schema_version
      !== PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_SET',
      'The Product candidate-result write set is not closed.',
    );
  }
  const {
    candidate_release_binding: release,
    process_pilot_materialisation_receipt: pilot,
    product_admission: admission,
    product_row: row,
    product_result_set: resultSet,
    product_presentation: presentation,
    product_surfaces: surfaces,
  } = writeSet;
  let bridge;
  try {
    validateMetseraExclusivityProductAdmission(
      admission,
      sourceBytesByIdentity,
    );
    bridge = admission.process_phrasebook_admission;
    validateMetseraExclusivityProcessPhrasebookAdmission(
      bridge,
      sourceBytesByIdentity,
    );
    validateProcessExclusivityPilotMaterialisation(
      bridge.materialisation_receipt,
      bridge.materialisation_input,
      sourceBytesByIdentity,
    );
  } catch (error) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE',
      'The Product admission or its Process materialisation bridge is invalid.',
      { cause: error.code || error.message },
    );
  }
  if (canonicalJson(pilot) !== canonicalJson(bridge.materialisation_receipt)) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE',
      'The persisted Process materialisation receipt does not equal the bridge-bound receipt.',
    );
  }
  try {
    validateMetseraExclusivityProductRow(
      row,
      admission,
      authorityContext,
      authorityInput,
      sourceBytesByIdentity,
    );
    validateMetseraExclusivityProductResultSet(
      resultSet,
      admission,
      row,
      authorityContext,
      authorityInput,
      sourceBytesByIdentity,
    );
    validateMetseraExclusivityProductPresentation(
      presentation,
      row,
      resultSet,
    );
    validateMetseraExclusivityProductSurfaces(
      surfaces,
      admission,
      row,
      resultSet,
      presentation,
      authorityContext,
      authorityInput,
      undefined,
      sourceBytesByIdentity,
    );
  } catch (error) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE',
      'The Product candidate result or its Process lineage is invalid.',
      { cause: error.code || error.message },
    );
  }
  validateReleaseBinding(release, row);
  const result =
    row.shared_row_adapter_receipt.product_query_result;
  const body = {
    schema_version: PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    writer_contract_stable_id:
      productCandidateWriteContract.stable_id,
    writer_contract_version:
      productCandidateWriteContract.definition.contract_version,
    operation:
      productCandidateWriteContract.definition
        .operation_contract.operation,
    candidate_release_manifest_id:
      release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      release.candidate_release_manifest_payload_digest,
    corpus_release_id: release.corpus_release_id,
    product_query_definition_id:
      row.product_query_ir.query_definition_id,
    product_query_result_identity:
      result.product_query_result_identity,
    domain_result_identity: result.domain_result_identity,
    process_phrasebook_result_identity:
      admission.admission_receipt
        .process_phrasebook_passage_result_id,
    candidate_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
    complete_write_set: clone(writeSet),
  };
  return {
    schema_version: body.schema_version,
    candidate_product_result_id: contentId(
      PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
      clone(writeSet),
    ),
    ...body,
  };
}

function validateProductCandidateResultWriteSet(
  writeSet,
  authorityContext,
  authorityInput,
  sourceBytesByIdentity,
) {
  const envelope = validateWriteEnvelope(writeSet);
  if (envelope.adapterIdentifier === 'AGREEMENT_CANDIDATE_ENVELOPE') {
    return {
      adapterIdentifier: envelope.adapterIdentifier,
      agreementCarrier: envelope.agreementCarrier,
      materialisable: true,
      counts: { publishable: 1, residuals: 0, quarantinedClosures: 0 },
      publishableWriteSet: clone(writeSet),
      candidateRecord: buildAgreementCandidateResultRecord(envelope.agreementCarrier),
      residuals: [],
      quarantines: [],
      quarantinedClosureIds: [],
    };
  }
  const record = buildProductCandidateResultRecord(
    envelope.writeSet,
    envelope.authorityContext,
    envelope.authorityInput,
    sourceBytesByIdentity,
  );
  return {
    adapterIdentifier: envelope.adapterIdentifier,
    materialisable: true,
    counts: {
      publishable: 1,
      residuals: 0,
      quarantinedClosures: 0,
    },
    publishableWriteSet: clone(writeSet),
    candidateRecord: record,
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

module.exports = {
  ADAPTER_IDENTIFIERS,
  AGREEMENT_CANDIDATE_ENVELOPE_CARRIER_SCHEMA,
  PROCESS_PHRASEBOOK_PRODUCT_CHAIN_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
  ProductCandidateResultWriteError,
  buildAgreementCandidateEnvelopeCarrier,
  buildProcessPhrasebookProductChain,
  buildProductCandidateResultWriteEnvelope,
  buildProductCandidateResultRecord,
  validateProductCandidateResultWriteSet,
};
