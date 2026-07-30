const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  MAX_CANDIDATES,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
} = require('./process-passage-order');
const {
  validateProcessPhrasebookSharedRowBridgeReceipt,
} = require('./process-phrasebook-shared-row-bridge');
const {
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  compileProductQueryResultSet,
  validateProductResultSlotFailure,
} = require('./product-query-result-set-compiler');
const {
  compileProductResultPresentation,
  validateProductResultPresentation,
} = require('./product-result-presentation-compiler');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');

const singleResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const resultSetAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const productResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);
const qxoF28ResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
);
const qxoF28ResultAdapterV2Contract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v2.json',
);
const qxoResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-product-result-adapter.v1.json',
);

const PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA =
  'PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT/V1';
const PROCESS_DOMAIN_KEY = 'PROCESS';
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProcessPhrasebookProductResultSetBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPhrasebookProductResultSetBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPhrasebookProductResultSetBridgeError(
    code,
    message,
    details,
  );
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT',
) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireArray(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT',
) {
  if (!Array.isArray(value) || value.length > MAX_CANDIDATES) {
    fail(code, `${label} must be a bounded array.`);
  }
  return value;
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT',
) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a full lower-case SHA-256 digest.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process result-set bridge input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function contractMember(canonicalValue) {
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function requireExactContractValue(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_CONTRACT_BINDING',
      `${label} does not match the signed adapter contract.`,
    );
  }
}

function validateContractBinding() {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_CONTRACT_BINDING';
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(singleResultAdapterContract),
      contractMember(resultSetAdapterContract),
      contractMember(productResultContract),
      contractMember(qxoF28ResultAdapterContract),
      contractMember(qxoF28ResultAdapterV2Contract),
      contractMember(qxoResultAdapterContract),
    ]);
  } catch (error) {
    fail(code, 'A signed Process result-set contract has changed.', {
      cause: error.code || error.message,
    });
  }
  const definition = resultSetAdapterContract.definition;
  requireExactContractValue(
    definition.target_contract,
    {
      single_result_adapter_stable_id:
        'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER',
      single_result_adapter_version: 1,
      single_result_adapter_receipt_schema_version:
        'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT/V1',
      product_result_schema_version: 'PRODUCT_QUERY_RESULT/V1',
      product_result_set_compiler: 'compileProductQueryResultSet',
      product_result_set_compiler_module:
        'lib/canonical-v2/product-query-result-set-compiler.js',
      product_execution_summary_schema_version:
        'PRODUCT_QUERY_EXECUTION_SUMMARY/V1',
      creates_new_result_or_result_set_architecture: false,
    },
    'Process result-set target',
  );
  requireExactContractValue(
    definition.validation_carrier_contract.required_fields,
    [
      'schema_version',
      'result_set_adapter_receipt_id',
      'valid_adapter_members',
      'external_failed_slots',
      'product_result_set_authority_inputs',
      'product_result_set',
      'adapter_state',
      'authority_state',
    ],
    'Process result-set receipt fields',
  );
  requireExactContractValue(
    definition.validation_carrier_contract.identity_inputs,
    [
      'valid_adapter_members',
      'external_failed_slots',
      'product_result_set_authority_inputs',
      'product_result_set',
    ],
    'Process result-set receipt identity inputs',
  );
  if (
    definition.valid_member_contract
      .single_result_bridge_revalidation_function
      !== 'validateProcessPhrasebookSharedRowBridgeReceipt'
    || definition.valid_member_contract
      .single_result_bridge_revalidation_required !== true
    || definition.failure_contract.failure_source
      !== 'EXTERNAL_CHECKED_PRODUCT_RESULT_SLOT_FAILURES'
    || definition.failure_contract.failure_validation_function
      !== 'validateProductResultSlotFailure'
    || definition.query_and_release_contract.selected_domain_key
      !== PROCESS_DOMAIN_KEY
    || definition.ordering_contract.ordering_authority
      !== 'PROCESS_PASSAGE_ORDERING_PROJECTION'
    || definition.ordering_contract.ordering_projection_schema_version
      !== PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA
    || definition.ordering_contract.product_ordering_receipt_schema_version
      !== PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA
    || definition.ordering_contract
      .product_result_set_compiler_owns_final_slots_and_summary !== true
    || definition.bounds_and_presentation_contract
      .bridge_can_pad_repeat_or_manufacture_minimum_result_count !== false
    || definition.presentation_handoff_contract.handoff_function
      !== 'compileProcessPhrasebookProductResultPresentation'
    || definition.presentation_handoff_contract.presentation_compiler
      !== 'compileProductResultPresentation'
    || canonicalJson(
      definition.presentation_handoff_contract
        .required_handoff_input_fields,
    ) !== canonicalJson([
      'validated_result_set_adapter_receipt',
      'product_query_ir',
      'product_field_catalogue_manifest',
      'understood_legal_question',
    ])
    || canonicalJson(
      definition.presentation_handoff_contract.handoff_output_fields,
    ) !== canonicalJson([
      'product_result_presentation',
      'result_set_adapter_receipt',
    ])
    || definition.presentation_handoff_contract
      .handoff_creates_new_presentation_identity_or_receipt !== false
    || definition.presentation_handoff_contract
      .process_sidecars_are_not_passed_into_product_presentation_compiler
      !== true
    || definition.validation_carrier_contract.adapter_state
      !== 'VALIDATED_NOT_MATERIALISED'
    || definition.validation_carrier_contract.authority_state
      !== 'NOT_GRANTED'
    || Object.values(definition.prohibited_state_contract)
      .some((value) => value !== false)
    || Object.values(definition.authority_contract)
      .some((value) => value !== false)
  ) {
    fail(code, 'The signed Process result-set safety boundary has changed.');
  }
}

function validateMember(member, index, input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER';
  requireExactKeys(member, [
    'single_result_adapter_input',
    'single_result_adapter_receipt',
  ], `Process result-set valid member ${index}`, code);
  requireObject(
    member.single_result_adapter_input,
    `Process result-set valid member ${index} input`,
    code,
  );
  requireObject(
    member.single_result_adapter_receipt,
    `Process result-set valid member ${index} receipt`,
    code,
  );
  try {
    validateProcessPhrasebookSharedRowBridgeReceipt(
      member.single_result_adapter_receipt,
      member.single_result_adapter_input,
    );
  } catch (error) {
    fail(code, 'A Process single-result adapter member is invalid.', {
      index,
      cause: error.code || error.message,
    });
  }
  const memberInput = member.single_result_adapter_input;
  const memberReceipt = member.single_result_adapter_receipt;
  const processReceipt = memberReceipt.process_admission_receipt;
  const productResult = memberReceipt.product_query_result;
  if (
    canonicalJson(memberInput.product_query_ir)
      !== canonicalJson(input.product_query_ir)
    || canonicalJson(
      memberInput.process_admission_input.passage_order_projection,
    ) !== canonicalJson(input.domain_ordering_projection)
    || processReceipt.ordering_projection_id
      !== input.domain_ordering_projection.ordering_projection_id
    || productResult.product_query_definition_id
      !== input.product_query_ir.query_definition_id
    || productResult.domain_key !== PROCESS_DOMAIN_KEY
  ) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_QUERY_ORDER_BINDING',
      'A Process adapter member does not bind the exact query and order.',
      { index },
    );
  }
  return {
    member: clone(member, code),
    productResult,
    domainResultIdentity: productResult.domain_result_identity,
    adapterReceiptIdentity: memberReceipt.adapter_receipt_id,
  };
}

function validateFailure(failure, index) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_EXTERNAL_FAILURE';
  try {
    validateProductResultSlotFailure(failure, code);
  } catch (error) {
    fail(code, 'An external Product result failure is invalid.', {
      index,
      cause: error.code || error.message,
    });
  }
  if (failure.failed_domain_result_identity === null) {
    fail(code, 'An external failure does not bind a Process result.', {
      index,
    });
  }
  return clone(failure, code);
}

function requireUnique(values, label, code) {
  if (new Set(values).size !== values.length) {
    fail(code, `${label} contains a duplicate identity.`);
  }
}

function receiptIdentityBody({
  validAdapterMembers,
  externalFailedSlots,
  authorityInputs,
  productResultSet,
}) {
  return {
    valid_adapter_members: clone(validAdapterMembers),
    external_failed_slots: clone(externalFailedSlots),
    product_result_set_authority_inputs: clone(authorityInputs),
    product_result_set: clone(productResultSet),
  };
}

function buildProcessPhrasebookProductResultSetBridge(input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'valid_adapter_members',
    'external_failed_slots',
    'product_query_ir',
    'domain_ordering_projection',
    'ordering_receipt',
    'coverage_certification',
  ], 'Process phrasebook Product result-set bridge input', code);
  requireObject(input.product_query_ir, 'Product Query IR', code);
  requireObject(
    input.product_query_ir.semantic_contract,
    'Product Query IR semantic contract',
    code,
  );
  requireObject(
    input.domain_ordering_projection,
    'Process ordering projection',
    code,
  );
  requireObject(input.ordering_receipt, 'Product ordering receipt', code);
  requireObject(
    input.coverage_certification,
    'Product coverage certification',
    code,
  );
  if (
    input.product_query_ir.semantic_contract.domain_key
      !== PROCESS_DOMAIN_KEY
    || input.domain_ordering_projection.schema_version
      !== PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA
    || input.ordering_receipt.schema_version
      !== PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA
  ) {
    fail(code, 'The bridge inputs do not select the Process result set.');
  }
  const rawMembers = requireArray(
    input.valid_adapter_members,
    'Process valid adapter members',
    code,
  );
  const rawFailures = requireArray(
    input.external_failed_slots,
    'External failed Product slots',
    code,
  );
  if (rawMembers.length + rawFailures.length > MAX_CANDIDATES) {
    fail(code, 'The complete Process candidate set exceeds its bound.');
  }
  const members = rawMembers.map(
    (member, index) => validateMember(member, index, input),
  );
  const failures = rawFailures.map(validateFailure);
  requireUnique(
    members.map((entry) => entry.adapterReceiptIdentity),
    'Process adapter receipt identities',
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER',
  );
  requireUnique(
    members.map(
      (entry) => entry.productResult.product_query_result_identity,
    ),
    'Product result identities',
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER',
  );
  const validDomainResultIdentities = members.map(
    (entry) => entry.domainResultIdentity,
  );
  const failedDomainResultIdentities = failures.map(
    (failure) => failure.failed_domain_result_identity,
  );
  requireUnique(
    validDomainResultIdentities,
    'Valid Process result identities',
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_VALID_MEMBER',
  );
  requireUnique(
    failures.map((failure) => failure.failure_identity),
    'External failure identities',
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_EXTERNAL_FAILURE',
  );
  requireUnique(
    failedDomainResultIdentities,
    'Failed Process result identities',
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_EXTERNAL_FAILURE',
  );
  if (
    failedDomainResultIdentities.some(
      (identity) => validDomainResultIdentities.includes(identity),
    )
  ) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_CANDIDATE_PARTITION',
      'A Process result is both valid and failed.',
    );
  }
  const candidateSlots = [
    ...members.map((entry) => ({
      slot_identity:
        entry.productResult.product_query_result_identity,
      slot_state: 'VALID',
      product_query_result: clone(entry.productResult),
      failure: null,
    })),
    ...failures.map((failure) => ({
      slot_identity: failure.failure_identity,
      slot_state: 'UNAVAILABLE',
      product_query_result: null,
      failure: clone(failure),
    })),
  ];
  let productResultSet;
  try {
    productResultSet = compileProductQueryResultSet({
      product_query_ir: input.product_query_ir,
      candidate_slots: candidateSlots,
      domain_ordering_projection: input.domain_ordering_projection,
      ordering_receipt: input.ordering_receipt,
      coverage_certification: input.coverage_certification,
    });
  } catch (error) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_PRODUCT_INPUT',
      'The external Product inputs do not admit the Process result set.',
      { cause: error.code || error.message },
    );
  }
  const authorityInputs = {
    product_query_ir: clone(input.product_query_ir),
    domain_ordering_projection:
      clone(input.domain_ordering_projection),
    ordering_receipt: clone(input.ordering_receipt),
    coverage_certification: clone(input.coverage_certification),
  };
  const identityBody = receiptIdentityBody({
    validAdapterMembers: members.map((entry) => entry.member),
    externalFailedSlots: failures,
    authorityInputs,
    productResultSet,
  });
  return {
    schema_version:
      PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA,
    result_set_adapter_receipt_id: contentId(
      PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA,
      identityBody,
    ),
    valid_adapter_members: identityBody.valid_adapter_members,
    external_failed_slots: identityBody.external_failed_slots,
    product_result_set_authority_inputs:
      identityBody.product_result_set_authority_inputs,
    product_result_set: identityBody.product_result_set,
    adapter_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: 'NOT_GRANTED',
  };
}

function bridgeInputFromReceipt(receipt) {
  return {
    valid_adapter_members: receipt.valid_adapter_members,
    external_failed_slots: receipt.external_failed_slots,
    product_query_ir:
      receipt.product_result_set_authority_inputs.product_query_ir,
    domain_ordering_projection:
      receipt.product_result_set_authority_inputs
        .domain_ordering_projection,
    ordering_receipt:
      receipt.product_result_set_authority_inputs.ordering_receipt,
    coverage_certification:
      receipt.product_result_set_authority_inputs
        .coverage_certification,
  };
}

function validateProcessPhrasebookProductResultSetBridgeReceipt(value) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_BRIDGE_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'result_set_adapter_receipt_id',
    'valid_adapter_members',
    'external_failed_slots',
    'product_result_set_authority_inputs',
    'product_result_set',
    'adapter_state',
    'authority_state',
  ], 'Process phrasebook Product result-set adapter receipt', code);
  requireDigest(
    value.result_set_adapter_receipt_id,
    'Process result-set adapter receipt ID',
    code,
  );
  requireObject(
    value.product_result_set_authority_inputs,
    'Process result-set authority inputs',
    code,
  );
  requireObject(value.product_result_set, 'Product result set', code);
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA
    || value.adapter_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process result-set adapter state is invalid.');
  }
  const rebuilt = buildProcessPhrasebookProductResultSetBridge(
    bridgeInputFromReceipt(value),
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The Process result-set adapter receipt was changed.');
  }
  return true;
}

function compileProcessPhrasebookProductResultSetBridge(input) {
  const receipt = buildProcessPhrasebookProductResultSetBridge(input);
  validateProcessPhrasebookProductResultSetBridgeReceipt(receipt);
  return deepFreeze(clone(receipt));
}

function canonicalProcessPhrasebookProductResultSetBridgeReceiptBytes(
  value,
) {
  validateProcessPhrasebookProductResultSetBridgeReceipt(value);
  return Buffer.from(canonicalJson(value), 'utf8');
}

function compileProcessPhrasebookProductResultPresentation(input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_PRESENTATION_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'validated_result_set_adapter_receipt',
    'product_query_ir',
    'product_field_catalogue_manifest',
    'understood_legal_question',
  ], 'Process phrasebook Product presentation handoff input', code);
  requireObject(
    input.validated_result_set_adapter_receipt,
    'Validated Process result-set adapter receipt',
    code,
  );
  requireObject(input.product_query_ir, 'Product Query IR', code);
  requireObject(
    input.product_field_catalogue_manifest,
    'Product field catalogue manifest',
    code,
  );
  requireObject(
    input.understood_legal_question,
    'Understood legal question',
    code,
  );
  try {
    validateProcessPhrasebookProductResultSetBridgeReceipt(
      input.validated_result_set_adapter_receipt,
    );
  } catch (error) {
    fail(code, 'The Process result-set adapter receipt is invalid.', {
      cause: error.code || error.message,
    });
  }
  const receipt = input.validated_result_set_adapter_receipt;
  const receiptQuery = receipt.product_result_set_authority_inputs
    .product_query_ir;
  if (
    canonicalJson(input.product_query_ir)
      !== canonicalJson(receiptQuery)
  ) {
    fail(code, 'The presentation query does not match the result set.');
  }
  let presentation;
  try {
    presentation = compileProductResultPresentation({
      understood_legal_question: input.understood_legal_question,
      product_query_ir: input.product_query_ir,
      product_field_catalogue_manifest:
        input.product_field_catalogue_manifest,
      ordered_result_slots:
        receipt.product_result_set.ordered_result_slots,
      query_execution_summary:
        receipt.product_result_set.query_execution_summary,
    });
    validateProductResultPresentation(presentation);
  } catch (error) {
    fail(code, 'The external Product presentation inputs are invalid.', {
      cause: error.code || error.message,
    });
  }
  return deepFreeze(clone({
    product_result_presentation: presentation,
    result_set_adapter_receipt: receipt,
  }, code));
}

module.exports = {
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT_SCHEMA,
  ProcessPhrasebookProductResultSetBridgeError,
  canonicalProcessPhrasebookProductResultSetBridgeReceiptBytes,
  compileProcessPhrasebookProductResultPresentation,
  compileProcessPhrasebookProductResultSetBridge,
  validateProcessPhrasebookProductResultSetBridgeReceipt,
};
