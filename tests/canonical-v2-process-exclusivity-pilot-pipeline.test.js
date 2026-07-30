const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createRequire } = require('node:module');

const {
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  acquireProcessSources,
} = require('../lib/canonical-v2/process-source-acquisition');
const {
  enumerateProcessScope,
} = require('../lib/canonical-v2/process-scope-enumerator');
const {
  PIPELINE_INPUT_SCHEMA,
  PIPELINE_RECEIPT_SCHEMA,
  compileProcessExclusivityPilotPipeline,
} = require('../lib/canonical-v2/process-exclusivity-pilot-pipeline');

function digest(label) {
  return contentId('SYNTHETIC_PROCESS_PILOT_PIPELINE_TEST/V1', { label });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPilotFixture() {
  const fixturePath = path.join(
    __dirname,
    'canonical-v2-process-exclusivity-pilot.test.js',
  );
  const localRequire = createRequire(fixturePath);
  const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
  const noTestRegistration = (id) => (
    id === 'node:test' ? (() => {}) : localRequire(id)
  );
  const load = new Function(
    'require',
    '__dirname',
    '__filename',
    `${fixtureSource}\nreturn metseraFixture;`,
  );
  return load(
    noTestRegistration,
    path.dirname(fixturePath),
    fixturePath,
  )();
}

function sourceEvidence(document, start = 0, length = 7) {
  const bytes = Buffer.from(document.source_text, 'utf8');
  const end = Math.min(start + length, bytes.length);
  return {
    source_document_identity: document.source_document_identity,
    source_revision_id: document.source_revision_id,
    document_hash: document.document_hash,
    start_utf8_byte: start,
    end_utf8_byte: end,
    exact_text_digest: sha256Hex(bytes.subarray(start, end)),
  };
}

function sourceAcquisitionInput(pilot) {
  const expectedSourceIds = pilot.source_documents.map(
    (_source, index) => `SOURCE_${index}`,
  );
  return {
    schema_version: 'PROCESS_SOURCE_ACQUISITION_INPUT/V1',
    governed_scope: {
      scope_id: 'SYNTHETIC_METSERA_PIPELINE_SCOPE',
      scope_digest: digest('governed-scope'),
      manifest_id: digest('source-manifest'),
      expected_source_ids: expectedSourceIds,
      coverage_limit: {
        coverage_limit_id: 'SYNTHETIC_PIPELINE_ONLY',
        limitation_codes: ['SYNTHETIC_ONLY'],
      },
    },
    frozen_sources: pilot.source_documents.map((source, index) => ({
      source_id: expectedSourceIds[index],
      source_class: 'FILING',
      frozen_snapshot_id: digest(`source-${index}-snapshot`),
      source_text: source.source_text,
      source_text_digest: source.source_text_digest,
      source_identity: {
        source_document_identity: source.source_document_identity,
        source_revision_id: source.source_revision_id,
        document_hash: source.document_hash,
      },
      evidence_history: [{
        evidence_id: digest(`source-${index}-evidence`),
        evidence_digest: digest(`source-${index}-evidence-digest`),
      }],
      intake_outcome: 'VERIFIED_INTAKE_RECEIPT',
      attempts_used: 1,
    })),
    limits: {
      maximum_sources: 8,
      maximum_attempts: 8,
      maximum_total_bytes: 16384,
      maximum_runtime_ms: 1000,
      maximum_memory_bytes: 16384,
    },
  };
}

function secCompletenessInput(scope) {
  return {
    schema_version: 'PROCESS_SEC_COMPLETENESS_ORACLE_INPUT/V1',
    governed_scope: {
      scope_id: scope.scope_id,
      scope_digest: scope.scope_digest,
      issuer_cik: '1840574',
      filing_date_start: '2025-01-01',
      filing_date_end: '2025-12-31',
    },
    sec_index_records: [{
      index_source: 'SEC_FULL_INDEX',
      index_snapshot_id: digest('sec-index-snapshot'),
      accession_number: '0001193125-25-141749',
      accession_number_no_dashes: '000119312525141749',
      issuer_cik: '1840574',
      filing_date: '2025-09-15',
      form_type: 'DEFM14A',
      primary_document: 'defm14a.htm',
    }],
    limits: {
      maximum_records: 8,
      maximum_total_bytes: 4096,
      maximum_runtime_ms: 1000,
      maximum_memory_bytes: 4096,
    },
  };
}

function slotKey(pilot) {
  return pilot.frozen_scope.predicate_witness_slots[0]
    .predicate_witness_slot_key;
}

function scopeInput(pilot, records) {
  return {
    schema_version: 'PROCESS_SCOPE_ENUMERATOR_INPUT/V1',
    governed_deal_admission_id: pilot.governed_deal_admission_id,
    scope_records: records,
    limits: { max_scope_records: 8, max_slots: 4 },
  };
}

function scopeSlot(pilot) {
  return {
    record_key: 'PRIMARY_EXCLUSIVITY_SLOT',
    record_state: 'SLOT',
    slot_key: slotKey(pilot),
    deal_id: pilot.governed_deal_admission_id,
    occurrence_kind: 'EXCLUSIVITY_EVENT',
    required_evidence_roles: ['AGREEMENT_TEXT'],
    scope_evidence: [sourceEvidence(pilot.source_documents[0])],
    residual_code: null,
  };
}

function scopeResidual(pilot, recordKey = 'UNRESOLVED_SCOPE_RECORD') {
  return {
    record_key: recordKey,
    record_state: 'RESIDUAL',
    slot_key: null,
    deal_id: pilot.governed_deal_admission_id,
    occurrence_kind: null,
    required_evidence_roles: null,
    scope_evidence: [sourceEvidence(pilot.source_documents[0])],
    residual_code: 'UNRESOLVED_SCOPE',
  };
}

function semanticSourceUnit(pilot) {
  return {
    source_unit_id: digest('semantic-source-unit'),
    unit_state: 'CANDIDATE',
    slot_key: slotKey(pilot),
    evidence: {
      ...sourceEvidence(pilot.source_documents[0]),
      evidence_role_key: 'AGREEMENT_TEXT',
    },
    semantic_payload: {
      predicate_key: 'EXCLUSIVITY_GRANTED',
      polarity: 'PRESENT',
    },
    disposition_code: null,
  };
}

function lexicalSourceUnit(pilot) {
  const source = pilot.source_documents[0];
  const evidence = sourceEvidence(source);
  return {
    source_unit_id: digest('lexical-source-unit'),
    source_document_identity: source.source_document_identity,
    source_revision_id: source.source_revision_id,
    document_hash: source.document_hash,
    start_utf8_byte: 0,
    end_utf8_byte: Buffer.byteLength(source.source_text, 'utf8'),
    exact_text: source.source_text,
    lexical_observations: [{
      state: 'CANDIDATE',
      slot_key: slotKey(pilot),
      evidence_role_key: 'AGREEMENT_TEXT',
      start_utf8_byte: evidence.start_utf8_byte,
      end_utf8_byte: evidence.end_utf8_byte,
      lexical_payload: { matcher: 'SYNTHETIC_EXACT_BYTES' },
      reason_code: null,
    }],
  };
}

function validSibling(pilot, siblingKey = 'VALID_SIBLING') {
  return {
    sibling_key: siblingKey,
    scope_input: scopeInput(pilot, [
      scopeSlot(pilot),
      scopeResidual(pilot),
    ]),
    semantic_source_units: [semanticSourceUnit(pilot)],
    semantic_limits: {
      max_source_units: 8,
      max_candidates: 4,
    },
    lexical_source_units: [lexicalSourceUnit(pilot)],
    lexical_limits: {
      max_source_count: 8,
      max_source_bytes: 16384,
      max_candidate_count: 8,
      max_duration_ms: 1000,
      max_memory_bytes: 16384,
    },
    lexical_reported_usage: {
      duration_ms: 1,
      memory_bytes: 128,
    },
    candidate_graph_limits: {
      max_source_bytes: 16384,
      max_candidate_count: 16,
      max_runtime_ms: 1000,
      max_memory_bytes: 16384,
    },
    materialisation_input: pilot,
  };
}

function residualSibling(pilot, siblingKey = 'RESIDUAL_SIBLING') {
  return {
    ...validSibling(pilot, siblingKey),
    scope_input: scopeInput(pilot, [scopeResidual(pilot, 'ONLY_RESIDUAL')]),
    semantic_source_units: [],
    lexical_source_units: [],
    materialisation_input: null,
  };
}

function fixture() {
  const pilot = loadPilotFixture();
  const acquisitionInput = sourceAcquisitionInput(pilot);
  const valid = validSibling(pilot);
  const value = {
    schema_version: PIPELINE_INPUT_SCHEMA,
    frozen_contract_pair_digest: pilot.frozen_contract_pair_digest,
    governed_deal_admission_id: pilot.governed_deal_admission_id,
    source_acquisition_input: acquisitionInput,
    sec_completeness_input:
      secCompletenessInput(acquisitionInput.governed_scope),
    siblings: [valid],
  };
  return { pilot, value };
}

function trustedContext(value) {
  return {
    expected_acquisition_receipt_id:
      acquireProcessSources(value.source_acquisition_input)
        .acquisition_receipt_id,
    scope_receipt_anchors: value.siblings.map((sibling) => ({
      sibling_key: sibling.sibling_key,
      expected_scope_receipt_id:
        enumerateProcessScope(sibling.scope_input).scope_receipt_id,
    })),
  };
}

function byKey(receipt, key) {
  return receipt.siblings.find((sibling) => sibling.sibling_key === key);
}

test('runs one deterministic synthetic chain and retains every receipt and disagreement', () => {
  const { value } = fixture();
  const trusted = trustedContext(value);
  const first = compileProcessExclusivityPilotPipeline(value, trusted);
  const second = compileProcessExclusivityPilotPipeline(value, trusted);
  const branch = byKey(first, 'VALID_SIBLING');

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, PIPELINE_RECEIPT_SCHEMA);
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(first.external_operation_state, 'NOT_PERFORMED');
  assert.equal(first.source_acquisition_receipt.authority_state, 'NOT_GRANTED');
  assert.equal(first.sec_completeness_receipt.authority_state, 'NOT_GRANTED');
  assert.equal(branch.failure, null);
  assert.equal(branch.scope_receipt.scope_receipt_id,
    trusted.scope_receipt_anchors[0].expected_scope_receipt_id);
  assert.equal(branch.semantic_enumeration.candidates.length, 1);
  assert.equal(branch.lexical_enumeration.candidates.length, 1);
  assert.equal(branch.candidate_graph.disagreements.length, 2);
  assert.equal(branch.candidate_graph.retained_records.length, 1);
  assert.equal(branch.candidate_validation_receipt.disagreement_count, 2);
  assert.equal(
    branch.process_exclusivity_pilot_materialisation_receipt
      .materialisation_state,
    'VALIDATED_SIDECAR_ONLY',
  );
  assert.equal(Object.isFrozen(first), true);
});

test('uses separately controlled acquisition and scope receipt anchors', () => {
  const original = fixture();
  const trusted = trustedContext(original.value);

  const changedAcquisition = clone(original.value);
  changedAcquisition.source_acquisition_input
    .frozen_sources[0].intake_outcome = 'REVIEWED_NON_RECEIPT';
  assert.throws(
    () => compileProcessExclusivityPilotPipeline(
      changedAcquisition,
      trusted,
    ),
    { code: 'INVALID_PROCESS_SOURCE_ACQUISITION_RECEIPT' },
  );

  const changedScope = clone(original.value);
  changedScope.siblings[0].scope_input
    .scope_records[0].occurrence_kind = 'OTHER_EXCLUSIVITY_EVENT';
  const result = compileProcessExclusivityPilotPipeline(
    changedScope,
    trusted,
  );
  assert.equal(
    byKey(result, 'VALID_SIBLING').failure.error_code,
    'PROCESS_PILOT_PIPELINE_SCOPE_RECEIPT_SUBSTITUTION',
  );
});

test('preserves byte-zero evidence and a residual-only zero-slot sibling', () => {
  const { pilot, value } = fixture();
  value.siblings.push(residualSibling(pilot));
  const receipt = compileProcessExclusivityPilotPipeline(
    value,
    trustedContext(value),
  );
  const valid = byKey(receipt, 'VALID_SIBLING');
  const residual = byKey(receipt, 'RESIDUAL_SIBLING');

  assert.equal(valid.candidate_graph.candidate_nodes.every(
    (node) => node.evidence.start_utf8_byte === 0,
  ), true);
  assert.equal(residual.failure, null);
  assert.equal(residual.scope_receipt.expected_occurrence_slots.length, 0);
  assert.equal(residual.candidate_graph.candidate_nodes.length, 0);
  assert.equal(residual.candidate_graph.retained_records.length, 1);
  assert.equal(
    residual.candidate_graph.retained_records[0].outcome_kind,
    'SCOPE_RESIDUAL',
  );
  assert.equal(
    residual.process_exclusivity_pilot_materialisation_receipt,
    null,
  );
  assert.notEqual(
    valid.process_exclusivity_pilot_materialisation_receipt,
    null,
  );
});

test('isolates malformed and unknown-predicate siblings from a valid sibling', () => {
  const { pilot, value } = fixture();
  const malformed = validSibling(clone(pilot), 'MALFORMED_SIBLING');
  malformed.semantic_source_units[0].evidence.end_utf8_byte =
    malformed.semantic_source_units[0].evidence.start_utf8_byte;
  const unknown = validSibling(clone(pilot), 'UNKNOWN_PREDICATE_SIBLING');
  unknown.materialisation_input.frozen_scope
    .predicate_witness_slots[0]
    .predicate_definition_key_and_version.key = 'UNKNOWN_PREDICATE';
  unknown.materialisation_input.typed_values
    .predicate_witnesses[0].predicate_key = 'UNKNOWN_PREDICATE';
  value.siblings.push(malformed, unknown);

  const receipt = compileProcessExclusivityPilotPipeline(
    value,
    trustedContext(value),
  );
  assert.equal(byKey(receipt, 'VALID_SIBLING').failure, null);
  assert.equal(
    byKey(receipt, 'MALFORMED_SIBLING').failure.failure_state,
    'FAILED',
  );
  assert.equal(
    byKey(receipt, 'MALFORMED_SIBLING').failure.failure_stage,
    'SEMANTIC_ENUMERATION',
  );
  assert.equal(
    byKey(receipt, 'UNKNOWN_PREDICATE_SIBLING').failure.failure_stage,
    'PILOT_MATERIALISATION',
  );
  assert.notEqual(
    byKey(receipt, 'VALID_SIBLING')
      .process_exclusivity_pilot_materialisation_receipt,
    null,
  );
});

test('fails typed siblings for cross-deal, slot and frozen-pair drift', () => {
  const { pilot, value } = fixture();
  const crossDeal = validSibling(clone(pilot), 'CROSS_DEAL_SIBLING');
  crossDeal.scope_input.governed_deal_admission_id = digest('other-deal');
  crossDeal.scope_input.scope_records.forEach((record) => {
    record.deal_id = digest('other-deal');
  });
  const slotDrift = validSibling(clone(pilot), 'SLOT_DRIFT_SIBLING');
  slotDrift.materialisation_input.frozen_scope
    .predicate_witness_slots[0].predicate_witness_slot_key =
      'OTHER_PREDICATE_WITNESS_SLOT';
  slotDrift.materialisation_input.typed_values
    .predicate_witnesses[0].predicate_witness_slot_key =
      'OTHER_PREDICATE_WITNESS_SLOT';
  const pairDrift = validSibling(clone(pilot), 'PAIR_DRIFT_SIBLING');
  pairDrift.materialisation_input.frozen_contract_pair_digest =
    digest('other-pair');
  value.siblings.push(crossDeal, slotDrift, pairDrift);

  const receipt = compileProcessExclusivityPilotPipeline(
    value,
    trustedContext(value),
  );
  for (const key of [
    'CROSS_DEAL_SIBLING',
    'SLOT_DRIFT_SIBLING',
    'PAIR_DRIFT_SIBLING',
  ]) {
    assert.equal(
      byKey(receipt, key).failure.error_code,
      'PROCESS_PILOT_PIPELINE_BINDING_DRIFT',
    );
  }
  assert.equal(byKey(receipt, 'VALID_SIBLING').failure, null);
});

test('rejects caller authority and release fields at the exact boundary', () => {
  const { value } = fixture();
  const trusted = trustedContext(value);
  for (const [key, fieldValue] of [
    ['authority_state', 'GRANTED'],
    ['release_id', digest('release')],
    ['writer', 'CANONICAL'],
    ['production', true],
  ]) {
    const hostile = clone(value);
    hostile[key] = fieldValue;
    assert.throws(
      () => compileProcessExclusivityPilotPipeline(hostile, trusted),
      { code: 'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_INPUT' },
    );
  }

  const hostileSibling = clone(value);
  hostileSibling.siblings[0].authority_state = 'GRANTED';
  const receipt = compileProcessExclusivityPilotPipeline(
    hostileSibling,
    trusted,
  );
  assert.equal(
    byKey(receipt, 'VALID_SIBLING').failure.error_code,
    'INVALID_PROCESS_EXCLUSIVITY_PILOT_PIPELINE_SIBLING',
  );
});

test('has only the approved pure-runtime imports and exact phase allowlist', () => {
  const source = fs.readFileSync(
    require.resolve('../lib/canonical-v2/process-exclusivity-pilot-pipeline'),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /require\(['"](?:fs|http|https|child_process|.*filing|.*database|.*writer|.*serving|.*query|.*import|.*release|.*activation|.*production|.*canonical-writer)/,
  );
  const imports = [...source.matchAll(/require\('([^']+)'\)/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(imports, [
    './canonical-bytes',
    './process-candidate-graph',
    './process-candidate-validator',
    './process-exclusivity-pilot',
    './process-lexical-enumerator',
    './process-scope-enumerator',
    './process-sec-completeness-oracle',
    './process-semantic-enumerator',
    './process-source-acquisition',
  ]);

  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-process-exclusivity-pilot-pipeline-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-process-exclusivity-pilot-pipeline-v1.json',
    'lib/canonical-v2/process-exclusivity-pilot-pipeline.js',
    'tests/canonical-v2-process-exclusivity-pilot-pipeline.test.js',
  ]);
});
