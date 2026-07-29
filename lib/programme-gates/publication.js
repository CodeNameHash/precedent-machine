const crypto = require('node:crypto');
const {
  BOOTSTRAP_NONCE,
  buildUnsignedProgrammeGateStatus,
  requireProgrammeStatusAuthority,
  unsignedProgrammeGateStatus,
} = require('./status');

const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PUBLICATION_REF = 'refs/heads/programme-status-publication-head';
const STATUS_PATH = 'docs/certification/programme-gate-status-v2.json';
const HEAD_PATH = 'docs/certification/programme-status-publication-head.json';
const UNSIGNED_STATUS_DOMAIN = 'PROGRAMME_GATE_UNSIGNED_STATUS/V2';
const STATUS_ARTEFACT_ID_DOMAIN = 'PROGRAMME_GATE_STATUS_ARTEFACT_ID/V2';
const STATUS_ARTEFACT_PAYLOAD_DOMAIN = 'PROGRAMME_GATE_STATUS_ARTEFACT_PAYLOAD/V2';
const PUBLICATION_HEAD_PAYLOAD_DOMAIN = 'PROGRAMME_GATE_PUBLICATION_HEAD_PAYLOAD/V1';
const authorityBrands = new WeakSet();

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function requireCommit(value, label) {
  if (!COMMIT_PATTERN.test(value)) throw new TypeError(`${label} must be a Git commit ID`);
  return value;
}

function requireDigest(value, label) {
  if (!DIGEST_PATTERN.test(value)) throw new TypeError(`${label} must be a SHA-256 digest`);
  return value;
}

function createProgrammePublicationAuthority(dependencies) {
  requireExactKeys(dependencies, [
    'statusAuthority',
    'canonicalBytes',
    'domainDigest',
    'validatePublicationHeadSchema',
    'verifyPublicationHeadSignature',
  ], 'programme publication authority dependencies');
  const authority = Object.freeze({
    statusAuthority: requireProgrammeStatusAuthority(dependencies.statusAuthority),
    canonicalBytes: requireFunction(dependencies.canonicalBytes, 'canonicalBytes'),
    domainDigest: requireFunction(dependencies.domainDigest, 'domainDigest'),
    validatePublicationHeadSchema: requireFunction(
      dependencies.validatePublicationHeadSchema,
      'validatePublicationHeadSchema',
    ),
    verifyPublicationHeadSignature: requireFunction(
      dependencies.verifyPublicationHeadSignature,
      'verifyPublicationHeadSignature',
    ),
  });
  authorityBrands.add(authority);
  return authority;
}

function requireProgrammePublicationAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed programme publication authority is required');
  }
  return value;
}

function gitBlobObjectId(payload, canonicalBytes) {
  const bytes = canonicalBytes(payload);
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function validateExactProjection(status, registry) {
  if (!Array.isArray(status.ordered_gate_projection)
    || status.ordered_gate_projection.length !== registry.gates.length) {
    throw new Error('status must contain the complete 35-gate projection');
  }
  registry.gates.forEach((gate, index) => {
    const row = status.ordered_gate_projection[index];
    if (!row || row.gate_id !== gate.id) {
      throw new Error('status gate projection does not match governing registry order');
    }
    if (row.state === 'PASS') {
      requireDigest(row.evidence_envelope_id, `${gate.id} evidence envelope ID`);
      requireDigest(row.evidence_payload_digest, `${gate.id} evidence payload digest`);
    } else if (row.state !== 'OPEN'
      || row.evidence_envelope_id !== null
      || row.evidence_payload_digest !== null) {
      throw new Error(`unsupported or non-passing gate ${gate.id} must be OPEN`);
    }
  });

  if (!Array.isArray(status.ordered_work_class_projection)
    || status.ordered_work_class_projection.length !== registry.work_class_ids.length) {
    throw new Error('status must contain the complete 13-work-class projection');
  }
  registry.work_class_ids.forEach((workClassId, index) => {
    if (status.ordered_work_class_projection[index]?.work_class !== workClassId) {
      throw new Error('status work-class projection does not match governing registry order');
    }
  });
}

function validateGenesis(status, authority, bootstrapNonce) {
  const registry = authority.statusAuthority.registry;
  if (status.generation !== 1 || status.predecessor_status_id !== 'NONE') {
    throw new Error('first V2 publication must be generation 1 from predecessor NONE');
  }
  if (authority.statusAuthority.bootstrapState !== 'AVAILABLE'
    || bootstrapNonce !== BOOTSTRAP_NONCE
    || registry.bootstrap_nonce !== BOOTSTRAP_NONCE) {
    throw new Error('the exact unused gate-status bootstrap nonce is required');
  }
  const supported = new Set(registry.supported_gate_ids);
  for (const row of status.ordered_gate_projection) {
    const expected = supported.has(row.gate_id) ? 'PASS' : 'OPEN';
    if (row.state !== expected) {
      throw new Error('genesis requires exactly ten supported G0 PASS and all P1/P9 OPEN');
    }
  }
  const workClasses = new Map(
    status.ordered_work_class_projection.map((row) => [row.work_class, row.state]),
  );
  if (workClasses.get('canonical_work_start') !== 'PASS') {
    throw new Error('genesis requires canonical_work_start PASS');
  }
  if (workClasses.get('gate_status_bootstrap') !== 'PASS') {
    throw new Error('genesis requires the available one-use bootstrap authority');
  }
  if (workClasses.get('programme_complete') !== 'OPEN') {
    throw new Error('genesis cannot assert programme completion');
  }
}

function validateCurrentRef(currentRef) {
  requireExactKeys(
    currentRef,
    ['ref', 'state', 'observed_git_object_id', 'status_artefact_id', 'generation'],
    'current publication ref',
  );
  if (currentRef.ref !== PUBLICATION_REF) {
    throw new Error('current publication read must target the governing special ref');
  }
  if (currentRef.state === 'ABSENT') {
    if (currentRef.observed_git_object_id !== 'NONE'
      || currentRef.status_artefact_id !== 'NONE'
      || currentRef.generation !== 0) {
      throw new Error('absent publication ref must have the exact genesis state');
    }
    return 'NONE';
  }
  if (currentRef.state !== 'PRESENT') {
    throw new Error('publication ref state must be ABSENT or PRESENT');
  }
  requireCommit(currentRef.observed_git_object_id, 'current publication Git object ID');
  requireDigest(currentRef.status_artefact_id, 'current status artefact ID');
  if (!Number.isInteger(currentRef.generation) || currentRef.generation < 1) {
    throw new TypeError('current publication generation must be a positive integer');
  }
  return currentRef.observed_git_object_id;
}

function validateCommitIdentity(commitIdentity) {
  requireExactKeys(
    commitIdentity,
    ['author_name', 'author_email', 'timestamp', 'timezone', 'message'],
    'publication commit identity',
  );
  for (const [field, value] of Object.entries(commitIdentity)) {
    if (typeof value !== 'string' || value.length === 0 || /[\r\n\0]/.test(value)) {
      throw new TypeError(`publication commit ${field} must be a non-empty single-line string`);
    }
  }
}

function exactOutput(path, payload, payloadDomain, authority) {
  const bytes = authority.canonicalBytes(payload);
  return Object.freeze({
    path,
    byte_length: bytes.length,
    payload_digest: authority.domainDigest(payloadDomain, payload),
    git_blob_object_id: gitBlobObjectId(payload, authority.canonicalBytes),
    canonical_bytes_base64: bytes.toString('base64'),
  });
}

function planProgrammeStatusPublication(input) {
  requireExactKeys(input, [
    'authority',
    'status',
    'evidenceCandidates',
    'publicationHead',
    'currentRef',
    'bootstrapNonce',
    'commitIdentity',
  ], 'publication planning input');
  const authority = requireProgrammePublicationAuthority(input.authority);
  const statusAuthority = authority.statusAuthority;
  const registry = statusAuthority.registry;
  const expectedOldGitObjectId = validateCurrentRef(input.currentRef);
  validateCommitIdentity(input.commitIdentity);

  statusAuthority.validateStatusSchema('ProgrammeGateStatusArtefact/V2', input.status);
  if (statusAuthority.verifyStatusSignature(input.status) !== true) {
    throw new Error('status signature was not verified');
  }
  const recomputedUnsignedStatus = buildUnsignedProgrammeGateStatus({
    authority: statusAuthority,
    evidenceCandidates: input.evidenceCandidates,
    specificationRoot: input.status.specification_root,
    codeCommit: input.status.code_commit,
    environment: input.status.environment,
    generation: input.status.generation,
    predecessorStatusId: input.status.predecessor_status_id,
  });
  if (authority.domainDigest(UNSIGNED_STATUS_DOMAIN, recomputedUnsignedStatus)
    !== authority.domainDigest(
      UNSIGNED_STATUS_DOMAIN,
      unsignedProgrammeGateStatus(input.status),
    )) {
    throw new Error('signed status does not equal the validator-recomputed projection');
  }
  if (input.status.gate_registry_digest !== registry.digest) {
    throw new Error('status does not bind the governing registry digest');
  }
  validateExactProjection(input.status, registry);

  authority.validatePublicationHeadSchema(
    'ProgrammeStatusPublicationHead/V1',
    input.publicationHead,
  );
  if (authority.verifyPublicationHeadSignature(input.publicationHead) !== true) {
    throw new Error('publication-head signature was not verified');
  }

  const statusArtefactId = authority.domainDigest(STATUS_ARTEFACT_ID_DOMAIN, input.status);
  const statusOutput = exactOutput(
    STATUS_PATH,
    input.status,
    STATUS_ARTEFACT_PAYLOAD_DOMAIN,
    authority,
  );
  const headOutput = exactOutput(
    HEAD_PATH,
    input.publicationHead,
    PUBLICATION_HEAD_PAYLOAD_DOMAIN,
    authority,
  );
  if (input.publicationHead.status_artefact_id !== statusArtefactId
    || input.publicationHead.status_artefact_payload_digest !== statusOutput.payload_digest
    || input.publicationHead.status_git_object_id !== statusOutput.git_blob_object_id
    || input.publicationHead.generation !== input.status.generation) {
    throw new Error('publication head does not bind the exact signed status');
  }

  const genesis = input.currentRef.state === 'ABSENT';
  if (genesis) {
    if (input.publicationHead.predecessor_git_object_id !== 'NONE') {
      throw new Error('genesis publication head predecessor must be NONE');
    }
    validateGenesis(input.status, authority, input.bootstrapNonce);
  } else {
    if (input.bootstrapNonce !== 'NONE'
      || statusAuthority.bootstrapState !== 'CONSUMED') {
      throw new Error('the bootstrap nonce cannot be reused after genesis');
    }
    if (input.status.generation !== input.currentRef.generation + 1
      || input.status.predecessor_status_id !== input.currentRef.status_artefact_id
      || input.publicationHead.generation !== input.currentRef.generation + 1
      || input.publicationHead.predecessor_git_object_id
        !== input.currentRef.observed_git_object_id) {
      throw new Error('publication does not name the exact current predecessor');
    }
  }

  const outputs = Object.freeze([statusOutput, headOutput]);
  const construction = Object.freeze({
    object_database: 'ISOLATED_QUARANTINE',
    blobs: outputs,
    tree: Object.freeze({
      base: 'EMPTY_TREE',
      exact_entries: Object.freeze(outputs.map((output) => Object.freeze({
        mode: '100644',
        path: output.path,
        git_blob_object_id: output.git_blob_object_id,
      }))),
      output_git_object_id: 'COMPUTE_FROM_EXACT_ENTRIES',
    }),
    commit: Object.freeze({
      parent_git_object_ids: Object.freeze(genesis
        ? []
        : [input.currentRef.observed_git_object_id]),
      tree_git_object_id_source: 'construction.tree.output_git_object_id',
      identity: Object.freeze({ ...input.commitIdentity }),
      output_git_object_id: 'COMPUTE_FROM_EXACT_COMMIT_BYTES',
    }),
  });
  const nonceTransition = Object.freeze({
    nonce: genesis ? BOOTSTRAP_NONCE : 'NONE',
    before: genesis ? 'AVAILABLE' : 'CONSUMED',
    after: 'CONSUMED',
    apply_only_if_ref_compare_and_swap_succeeds: true,
    failure_effect: 'NO_NONCE_STATE_CHANGE',
  });
  const compareAndSwap = Object.freeze({
    operation: 'UPDATE_REF_COMPARE_AND_SWAP',
    ref: PUBLICATION_REF,
    expected_old_git_object_id: expectedOldGitObjectId,
    new_git_object_id_source: 'construction.commit.output_git_object_id',
    on_success: Object.freeze({
      publish_quarantined_objects: true,
      consume_bootstrap_nonce: genesis,
      create_immutable_receipt: true,
    }),
    on_failure: Object.freeze({
      ref_change: 'NONE',
      nonce_state_change: 'NONE',
      receipt: 'NONE',
      discard_quarantined_objects: true,
    }),
  });
  const postVerification = Object.freeze({
    reread_ref: PUBLICATION_REF,
    expected_git_object_id_source: 'construction.commit.output_git_object_id',
    verify_exact_tree_entries: construction.tree.exact_entries,
    verify_status_artefact_id: statusArtefactId,
    verify_generation: input.status.generation,
    mismatch_effect: 'PUBLICATION_FAILURE_NO_RECEIPT',
  });
  const receipt = Object.freeze({
    receipt_type: 'ProgrammeStatusPublicationReceiptPlan/V1',
    publication_ref: PUBLICATION_REF,
    expected_old_git_object_id: expectedOldGitObjectId,
    new_git_object_id_source: 'construction.commit.output_git_object_id',
    generation: input.status.generation,
    status_artefact_id: statusArtefactId,
    status_artefact_payload_digest: statusOutput.payload_digest,
    create_only_after_post_verification: true,
    immutable_after_success: true,
  });

  return Object.freeze({
    plan_type: 'ProgrammeStatusGitCasTransactionPlan/V1',
    mutation_performed: false,
    current_ref_read: Object.freeze({ ...input.currentRef }),
    precondition_failure_effect: 'ZERO_MUTATION',
    construction,
    compare_and_swap: compareAndSwap,
    bootstrap_nonce_transition: nonceTransition,
    post_verification: postVerification,
    receipt,
  });
}

module.exports = {
  HEAD_PATH,
  PUBLICATION_HEAD_PAYLOAD_DOMAIN,
  PUBLICATION_REF,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  STATUS_PATH,
  UNSIGNED_STATUS_DOMAIN,
  createProgrammePublicationAuthority,
  gitBlobObjectId,
  planProgrammeStatusPublication,
  requireProgrammePublicationAuthority,
};
