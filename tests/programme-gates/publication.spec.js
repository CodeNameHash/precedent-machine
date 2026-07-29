const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const YAML = require('yaml');

const {
  canonicalBytes,
  domainDigest,
} = require('../../lib/programme-gates/bytes');
const {
  BOOTSTRAP_NONCE,
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
} = require('../../lib/programme-gates/status');
const {
  HEAD_PATH,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  PUBLICATION_REF,
  STATUS_PATH,
  createProgrammePublicationAuthority,
  gitBlobObjectId,
  planProgrammeStatusPublication,
} = require('../../lib/programme-gates/publication');

const APPLICATION_COMMIT = 'a'.repeat(40);
const PREDECESSOR_GIT_OBJECT = 'd'.repeat(40);
const PREDECESSOR_STATUS_ID = 'e'.repeat(64);
const DIGEST_A = '1'.repeat(64);
const DIGEST_B = '2'.repeat(64);

function unsignedEnvelope(envelope) {
  const { signature, ...unsigned } = envelope;
  return unsigned;
}

function evidenceCandidate(gate) {
  return {
    envelope: {
      schema_version: 'ProgrammeGateEvidenceEnvelope/V2',
      gate_id: gate.id,
      evidence_contract: gate.evidence_contract,
      required_evidence_object_type: gate.required_evidence_object_type,
      terminal_state: 'PASS',
      signature: 'signed',
    },
    validation_input: {
      evidenceObject: { gate_id: gate.id },
      clock: { now: () => '2026-07-27T00:00:00.000Z' },
    },
  };
}

function authorities({
  bootstrapState = 'AVAILABLE',
  verifyStatusSignature = () => true,
  verifyPublicationHeadSignature = () => true,
} = {}) {
  const governingRegistryAuthority = createGoverningRegistryAuthority({
    readFileSync: fs.readFileSync,
    parseYaml: YAML.parse,
    domainDigest,
  });
  const statusAuthority = createProgrammeStatusAuthority({
    governingRegistryAuthority,
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
    verifyStatusSignature,
    validatorExecutableDigest: DIGEST_A,
    validatorConfigurationDigest: DIGEST_B,
    validatorKeyId: 'VALIDATOR_KEY',
    bootstrapState,
    terminalPairState: 'UNVALIDATED',
  });
  const publicationAuthority = createProgrammePublicationAuthority({
    statusAuthority,
    canonicalBytes,
    domainDigest,
    validatePublicationHeadSchema: () => true,
    verifyPublicationHeadSignature,
  });
  return { statusAuthority, publicationAuthority };
}

function commitIdentity() {
  return {
    author_name: 'Programme Gate Publisher',
    author_email: 'programme-gate-publisher@example.invalid',
    timestamp: '1785146400',
    timezone: '+0000',
    message: 'Publish programme gate status',
  };
}

function fixture(options = {}) {
  const generation = options.generation || 1;
  const predecessorStatusId = generation === 1 ? 'NONE' : PREDECESSOR_STATUS_ID;
  const { statusAuthority, publicationAuthority } = authorities({
    bootstrapState: generation === 1 ? 'AVAILABLE' : 'CONSUMED',
    ...options.authorityOverrides,
  });
  const evidenceCandidates = options.evidenceCandidates
    || statusAuthority.registry.gates.slice(0, 10).map(evidenceCandidate);
  const unsignedStatus = buildUnsignedProgrammeGateStatus({
    authority: statusAuthority,
    evidenceCandidates,
    specificationRoot: DIGEST_A,
    codeCommit: APPLICATION_COMMIT,
    environment: 'STAGING',
    generation,
    predecessorStatusId,
  });
  const status = options.status || attachProgrammeGateStatusSignature({
    authority: statusAuthority,
    unsignedStatus,
    signature: 'signed-status',
  });
  const statusArtefactId = domainDigest(STATUS_ARTEFACT_ID_DOMAIN, status);
  const statusPayloadDigest = domainDigest(STATUS_ARTEFACT_PAYLOAD_DOMAIN, status);
  const statusGitObjectId = gitBlobObjectId(status, canonicalBytes);
  const publicationHead = options.publicationHead || {
    schema_version: 'ProgrammeStatusPublicationHead/V1',
    generation,
    predecessor_git_object_id: generation === 1 ? 'NONE' : PREDECESSOR_GIT_OBJECT,
    status_git_object_id: statusGitObjectId,
    status_artefact_id: statusArtefactId,
    status_artefact_payload_digest: statusPayloadDigest,
    publisher_key_id: 'PUBLISHER_KEY',
    signature_algorithm: 'Ed25519',
    signature: 'signed-head',
  };
  const currentRef = generation === 1
    ? {
      ref: PUBLICATION_REF,
      state: 'ABSENT',
      observed_git_object_id: 'NONE',
      status_artefact_id: 'NONE',
      generation: 0,
    }
    : {
      ref: PUBLICATION_REF,
      state: 'PRESENT',
      observed_git_object_id: PREDECESSOR_GIT_OBJECT,
      status_artefact_id: PREDECESSOR_STATUS_ID,
      generation: 1,
    };
  return {
    authority: publicationAuthority,
    status,
    evidenceCandidates,
    publicationHead,
    currentRef,
    bootstrapNonce: generation === 1 ? BOOTSTRAP_NONCE : 'NONE',
    commitIdentity: commitIdentity(),
  };
}

test('plans genesis as an exact pure two-blob Git CAS transaction', () => {
  const plan = planProgrammeStatusPublication(fixture());
  assert.equal(plan.plan_type, 'ProgrammeStatusGitCasTransactionPlan/V1');
  assert.equal(plan.mutation_performed, false);
  assert.equal(plan.current_ref_read.ref, PUBLICATION_REF);
  assert.equal(plan.construction.object_database, 'ISOLATED_QUARANTINE');
  assert.equal(plan.construction.blobs.length, 2);
  assert.deepEqual(
    plan.construction.blobs.map(({ path }) => path),
    [STATUS_PATH, HEAD_PATH],
  );
  assert.equal(plan.construction.tree.exact_entries.length, 2);
  assert.deepEqual(plan.construction.commit.parent_git_object_ids, []);
  assert.equal(plan.compare_and_swap.expected_old_git_object_id, 'NONE');
  assert.equal(plan.compare_and_swap.on_success.consume_bootstrap_nonce, true);
  assert.equal(plan.compare_and_swap.on_failure.ref_change, 'NONE');
  assert.equal(plan.compare_and_swap.on_failure.nonce_state_change, 'NONE');
  assert.equal(plan.bootstrap_nonce_transition.nonce, BOOTSTRAP_NONCE);
  assert.equal(plan.receipt.create_only_after_post_verification, true);
  assert.equal(Object.isFrozen(plan), true);
});

test('genesis requires ten G0 PASS, every P1/P9 OPEN and canonical work start PASS', () => {
  const base = fixture();
  const missing = fixture({
    evidenceCandidates: base.evidenceCandidates.slice(0, 9),
  });
  assert.throws(
    () => planProgrammeStatusPublication(missing),
    /exactly ten supported G0 PASS/,
  );

  const manuallyPassedP1 = {
    ...base.status,
    ordered_gate_projection: base.status.ordered_gate_projection.map((row, index) => (
      index === 10
        ? {
          ...row,
          state: 'PASS',
          evidence_envelope_id: '3'.repeat(64),
          evidence_payload_digest: '4'.repeat(64),
        }
        : row
    )),
  };
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      status: manuallyPassedP1,
    }),
    /validator-recomputed projection/,
  );
});

test('substituted registry, callbacks, manual PASS and partial output are not inputs', () => {
  const base = fixture();
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      gateRegistry: { gates: [] },
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      recomputedStatus: base.status,
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      verifyStatusSignature: () => true,
    }),
    /unsupported fields/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      outputSet: [],
    }),
    /unsupported fields/,
  );

  const manualPass = {
    ...base.status,
    ordered_gate_projection: base.status.ordered_gate_projection.map((row, index) => (
      index === 10
        ? {
          ...row,
          state: 'PASS',
          evidence_envelope_id: '3'.repeat(64),
          evidence_payload_digest: '4'.repeat(64),
        }
        : row
    )),
  };
  assert.throws(
    () => planProgrammeStatusPublication({ ...base, status: manualPass }),
    /validator-recomputed projection/,
  );
});

test('status and head signatures are checked only by the fixed authority', () => {
  const base = fixture();
  const badStatusAuthority = authorities({ verifyStatusSignature: () => false });
  const badStatus = {
    ...base,
    authority: badStatusAuthority.publicationAuthority,
  };
  assert.throws(
    () => planProgrammeStatusPublication(badStatus),
    /status signature was not verified/,
  );
  const badHeadAuthority = authorities({
    verifyPublicationHeadSignature: () => false,
  });
  const badHead = {
    ...base,
    authority: badHeadAuthority.publicationAuthority,
  };
  assert.throws(
    () => planProgrammeStatusPublication(badHead),
    /publication-head signature was not verified/,
  );
});

test('successor publication names the exact current ref and cannot reuse the nonce', () => {
  const successor = fixture({ generation: 2 });
  const plan = planProgrammeStatusPublication(successor);
  assert.deepEqual(
    plan.construction.commit.parent_git_object_ids,
    [PREDECESSOR_GIT_OBJECT],
  );
  assert.equal(
    plan.compare_and_swap.expected_old_git_object_id,
    PREDECESSOR_GIT_OBJECT,
  );
  assert.equal(plan.compare_and_swap.on_success.consume_bootstrap_nonce, false);

  assert.throws(
    () => planProgrammeStatusPublication({
      ...successor,
      currentRef: {
        ...successor.currentRef,
        observed_git_object_id: 'f'.repeat(40),
      },
    }),
    /exact current predecessor/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...successor,
      bootstrapNonce: BOOTSTRAP_NONCE,
    }),
    /cannot be reused/,
  );
});

test('stale or malformed current-ref reads fail before any transaction plan exists', () => {
  const base = fixture();
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      currentRef: {
        ...base.currentRef,
        ref: 'refs/heads/substituted',
      },
    }),
    /governing special ref/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      currentRef: {
        ...base.currentRef,
        observed_git_object_id: 'f'.repeat(40),
      },
    }),
    /exact genesis state/,
  );
});

test('head or signed-status substitution fails closed', () => {
  const base = fixture();
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      publicationHead: {
        ...base.publicationHead,
        status_git_object_id: 'f'.repeat(40),
      },
    }),
    /does not bind the exact signed status/,
  );
  assert.throws(
    () => planProgrammeStatusPublication({
      ...base,
      status: {
        ...base.status,
        environment: 'PRODUCTION',
      },
    }),
    /does not bind the exact signed status/,
  );
});
