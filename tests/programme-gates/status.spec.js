const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const YAML = require('yaml');

const {
  domainDigest,
} = require('../../lib/programme-gates/bytes');
const {
  createGoverningRegistryAuthority,
} = require('../../lib/programme-gates/governing-registry');
const {
  EVIDENCE_ENVELOPE_ID_DOMAIN,
  EVIDENCE_PAYLOAD_DOMAIN,
} = require('../../lib/programme-gates/validator');
const {
  attachProgrammeGateStatusSignature,
  buildUnsignedProgrammeGateStatus,
  createProgrammeStatusAuthority,
  projectProgrammeStatus,
  resolveWorkClasses,
} = require('../../lib/programme-gates/status');

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const COMMIT = 'c'.repeat(40);

function unsignedEnvelope(envelope) {
  const { signature, ...unsigned } = envelope;
  return unsigned;
}

function governingRegistry() {
  return createGoverningRegistryAuthority({
    readFileSync: fs.readFileSync,
    parseYaml: YAML.parse,
    domainDigest,
  });
}

function createAuthority(overrides = {}) {
  const registry = governingRegistry();
  const values = {
    governingRegistryAuthority: registry,
    domainDigest,
    validateEvidence(input) {
      return {
        valid: true,
        gate_id: input.gate.id,
        evidence_envelope_id: domainDigest(EVIDENCE_ENVELOPE_ID_DOMAIN, input.envelope),
        evidence_payload_digest: domainDigest(
          EVIDENCE_PAYLOAD_DOMAIN,
          unsignedEnvelope(input.envelope),
        ),
      };
    },
    evidencePayloadForDigest: unsignedEnvelope,
    validateStatusSchema: () => true,
    verifyStatusSignature: () => true,
    validatorExecutableDigest: DIGEST_A,
    validatorConfigurationDigest: DIGEST_B,
    validatorKeyId: 'VALIDATOR_KEY',
    bootstrapState: 'AVAILABLE',
    terminalPairState: 'UNVALIDATED',
    ...overrides,
  };
  return createProgrammeStatusAuthority(values);
}

function evidenceCandidate(gate, suffix = '1') {
  return {
    envelope: {
      schema_version: 'ProgrammeGateEvidenceEnvelope/V2',
      gate_id: gate.id,
      evidence_contract: gate.evidence_contract,
      required_evidence_object_type: gate.required_evidence_object_type,
      terminal_state: 'PASS',
      nonce: suffix,
      signature: 'signed',
    },
    validation_input: {
      evidenceObject: { gate_id: gate.id },
      clock: { now: () => '2026-07-27T00:00:00.000Z' },
    },
  };
}

function tenG0Candidates(authority) {
  return authority.registry.gates.slice(0, 10).map(evidenceCandidate);
}

test('projects the authoritative 35 gates and 13 work classes in source order', () => {
  const authority = createAuthority();
  const projected = projectProgrammeStatus({
    authority,
    evidenceCandidates: tenG0Candidates(authority),
    generation: 1,
    predecessorStatusId: 'NONE',
  });

  assert.deepEqual(
    projected.ordered_gate_projection.map(({ gate_id }) => gate_id),
    authority.registry.gate_ids,
  );
  assert.deepEqual(
    projected.ordered_work_class_projection.map(({ work_class }) => work_class),
    authority.registry.work_class_ids,
  );
  assert.deepEqual(
    projected.ordered_gate_projection.map(({ state }) => state),
    [...Array(10).fill('PASS'), ...Array(25).fill('OPEN')],
  );
  const workClasses = new Map(
    projected.ordered_work_class_projection.map((row) => [row.work_class, row.state]),
  );
  assert.equal(workClasses.get('canonical_work_start'), 'PASS');
  assert.equal(workClasses.get('gate_status_bootstrap'), 'PASS');
  assert.equal(workClasses.get('programme_complete'), 'OPEN');
});

test('validator results must bind to the exact candidate envelope bytes', () => {
  const authority = createAuthority({
    validateEvidence(input) {
      return {
        valid: true,
        gate_id: input.gate.id,
        evidence_envelope_id: 'f'.repeat(64),
        evidence_payload_digest: domainDigest(
          EVIDENCE_PAYLOAD_DOMAIN,
          unsignedEnvelope(input.envelope),
        ),
      };
    },
  });
  const projected = projectProgrammeStatus({
    authority,
    evidenceCandidates: [evidenceCandidate(authority.registry.gates[0])],
    generation: 1,
    predecessorStatusId: 'NONE',
  });
  assert.equal(projected.ordered_gate_projection[0].state, 'OPEN');
  assert.equal(projected.ordered_gate_projection[0].evidence_envelope_id, null);
});

test('PASS requires exactly one valid evidence candidate', () => {
  const authority = createAuthority();
  const gate = authority.registry.gates[0];
  const cases = [
    [],
    [evidenceCandidate(gate, '1'), evidenceCandidate(gate, '2')],
    [{ ...evidenceCandidate(gate), envelope: {
      ...evidenceCandidate(gate).envelope,
      evidence_contract: 'substituted/v1',
    } }],
  ];
  for (const evidenceCandidates of cases) {
    const projected = projectProgrammeStatus({
      authority,
      evidenceCandidates,
      generation: 1,
      predecessorStatusId: 'NONE',
    });
    assert.equal(projected.ordered_gate_projection[0].state, 'OPEN');
  }
});

test('terminal work classes cannot become PASS from all_of alone', () => {
  const consumed = createAuthority({ bootstrapState: 'CONSUMED' });
  const allGateStatesPass = new Map(consumed.registry.gate_ids.map((id) => [id, 'PASS']));
  const consumedRows = resolveWorkClasses({
    authority: consumed,
    gateStateById: allGateStatesPass,
    generation: 1,
    predecessorStatusId: 'NONE',
  });
  assert.equal(
    consumedRows.find(({ work_class }) => work_class === 'gate_status_bootstrap').state,
    'OPEN',
  );
  assert.equal(
    consumedRows.find(({ work_class }) => work_class === 'programme_complete').state,
    'OPEN',
  );

  const terminalPair = createAuthority({
    bootstrapState: 'CONSUMED',
    terminalPairState: 'VALIDATED',
  });
  const completeRows = resolveWorkClasses({
    authority: terminalPair,
    gateStateById: allGateStatesPass,
    generation: 2,
    predecessorStatusId: DIGEST_A,
  });
  assert.equal(
    completeRows.find(({ work_class }) => work_class === 'programme_complete').state,
    'PASS',
  );
});

test('status builder derives the registry and validator identities from its authority', () => {
  const authority = createAuthority();
  const status = buildUnsignedProgrammeGateStatus({
    authority,
    evidenceCandidates: tenG0Candidates(authority),
    specificationRoot: DIGEST_A,
    codeCommit: COMMIT,
    environment: 'STAGING',
    generation: 1,
    predecessorStatusId: 'NONE',
  });
  assert.equal(status.gate_registry_digest, authority.registry.digest);
  assert.equal(status.validator_executable_digest, DIGEST_A);
  assert.equal(status.validator_configuration_digest, DIGEST_B);
  assert.throws(
    () => buildUnsignedProgrammeGateStatus({
      authority,
      evidenceCandidates: [],
      specificationRoot: DIGEST_A,
      codeCommit: COMMIT,
      environment: 'STAGING',
      generation: 1,
      predecessorStatusId: 'NONE',
      gateRegistry: { gates: [] },
    }),
    /unsupported fields/,
  );
});

test('per-call callbacks and manual projection fields are rejected', () => {
  const authority = createAuthority();
  assert.throws(
    () => projectProgrammeStatus({
      authority,
      evidenceCandidates: [],
      generation: 1,
      predecessorStatusId: 'NONE',
      validateEvidenceEnvelope: () => ({ valid: true }),
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => buildUnsignedProgrammeGateStatus({
      authority,
      evidenceCandidates: [],
      specificationRoot: DIGEST_A,
      codeCommit: COMMIT,
      environment: 'STAGING',
      generation: 1,
      predecessorStatusId: 'NONE',
      orderedGateProjection: [{ gate_id: 'G0_MARKET_STATS_CONTAINED', state: 'PASS' }],
    }),
    /unsupported fields/,
  );
});

test('signature attachment uses the fixed authority validators', () => {
  let schemaChecked = false;
  const authority = createAuthority({
    validateStatusSchema(schemaId, value) {
      assert.equal(schemaId, 'ProgrammeGateStatusArtefact/V2');
      assert.equal(value.signature, 'signed');
      schemaChecked = true;
    },
  });
  const unsignedStatus = buildUnsignedProgrammeGateStatus({
    authority,
    evidenceCandidates: [],
    specificationRoot: DIGEST_A,
    codeCommit: COMMIT,
    environment: 'STAGING',
    generation: 1,
    predecessorStatusId: 'NONE',
  });
  const status = attachProgrammeGateStatusSignature({
    authority,
    unsignedStatus,
    signature: 'signed',
  });
  assert.equal(schemaChecked, true);
  assert.equal(status.signature, 'signed');
  assert.throws(
    () => attachProgrammeGateStatusSignature({
      authority,
      unsignedStatus,
      signature: 'signed',
      verifySignature: () => true,
    }),
    /unsupported fields/,
  );
});
