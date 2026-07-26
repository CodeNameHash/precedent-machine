#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  buildAdmittedParserProposalEnvelope,
} = require('../lib/canonical-v2/admitted-parser-proposal-adapter');
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  InMemoryCanonicalRepository,
  buildCanonicalWriteReceipt,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  compileFixtureContractV6,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoNoShopActionsF6ParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge');
const {
  buildQxoNoShopExceptionSourceBindingF6,
} = require('../lib/canonical-v2/qxo-no-shop-exception-source-binding-f6');
const {
  buildQxoNoShopInlinePermissionF9,
} = require('../lib/canonical-v2/qxo-no-shop-inline-permission-f9');
const {
  buildQxoNoShopNestedDefinitionCandidateSupplement,
} = require('../lib/canonical-v2/qxo-no-shop-nested-definition-candidate-supplement');
const {
  buildQxoNoShopReviewedDefinitionGraphF6,
} = require('../lib/canonical-v2/qxo-no-shop-reviewed-definition-graph-f6');
const {
  buildQxoAdmittedNoShopActionsF6Slice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-f6-slice');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const {
  buildSourceArtifactChunks,
} = require('../lib/canonical-v2/source-artifact-chunks');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const SOURCE = Object.freeze({
  retrieval_url_sha256:
    'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256:
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const DEAL_KEY = 'deal:qxo-topbuild';
const IDEMPOTENCY_KEY =
  'QXO_NO_SHOP_INLINE_PERMISSION_F9_DEAL_SCOPE_V2';
const EXPECTED_LEGACY_DEAL_ADMISSION_ID =
  '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const EXPECTED_PREDECESSOR_CLOSURE_ID =
  '26b7305e27d18a60410bb500d9b4079f9f3ac25f9db4a43a9d7ad3619499f9ad';
const EXPECTED_F9 = Object.freeze({
  dealAdmissionId:
    'f8d4c707ad160d069c3975fd62a79544a28cdca1ddb122e45a5018b38d81d5b5',
  closureId:
    '5fc1ea048128c91e99cde48975e2bf89e752698b79e4bf9c4e94a956b9f400d8',
  relationshipRevisionId:
    'cc3dd51cc7a135abb1d46e8909a7164c940c2b975f7091d34a85c7c960e14224',
});
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
const PERSISTED_KINDS = Object.freeze([
  Object.freeze({
    kind: 'excerpts',
    table: 'excerpts',
    idField: 'excerpt_id',
  }),
  Object.freeze({
    kind: 'provisions',
    table: 'provision_instances',
    idField: 'provision_instance_id',
  }),
  Object.freeze({
    kind: 'components',
    table: 'provision_components',
    idField: 'provision_component_id',
  }),
  Object.freeze({
    kind: 'claims',
    table: 'claim_revisions',
    idField: 'claim_revision_id',
  }),
]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(
    join(ROOT, 'supabase/.temp/project-ref'),
    'utf8',
  ).trim();
  const linked = JSON.parse(readFileSync(
    join(ROOT, 'supabase/.temp/linked-project.json'),
    'utf8',
  ));
  if (ref !== PROJECT.ref
    || linked.ref !== PROJECT.ref
    || linked.name !== PROJECT.name) {
    throw new Error(
      `Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`,
    );
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item))
    || lines.at(-1);
  return (line || 'Canonical QXO F9 staging operation failed.')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(
      /((?:password|token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .slice(0, 500);
}

function runSql(sql, { commit = false, readOnly = false } = {}) {
  const directory = mkdtempSync(
    join(tmpdir(), 'canonical-v2-qxo-f9-'),
  );
  const file = join(directory, commit ? 'commit.sql' : 'query.sql');
  writeFileSync(file, `BEGIN${readOnly ? ' TRANSACTION READ ONLY' : ''};
SET LOCAL statement_timeout='60000ms';
${sql}
${commit ? 'COMMIT;' : 'ROLLBACK;'}
`, { mode: 0o600 });
  try {
    const result = spawnSync(
      'supabase',
      [
        '--workdir',
        ROOT,
        'db',
        'query',
        '--linked',
        '--file',
        file,
        '--output',
        'json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
        shell: false,
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error(safeDiagnostic(
        `${result.error?.message || ''}\n${result.stderr || ''}\n${result.stdout || ''}`,
      ));
    }
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows)) {
      throw new Error('Supabase returned no rows array.');
    }
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function readCapture() {
  const rows = runSql(`SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${SOURCE.retrieval_url_sha256}'
  AND response_bytes_sha256='${SOURCE.response_bytes_sha256}'
LIMIT 2;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.canonical_payload) {
    throw new Error('The exact QXO SEC intake capture must exist once.');
  }
  return rows[0].canonical_payload;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  const tag = `$qxo_f9_${createHash('sha256')
    .update(json)
    .digest('hex')
    .slice(0, 16)}$`;
  if (json.includes(tag)) {
    throw new Error('Unable to construct a safe canonical JSON literal.');
  }
  return `${tag}${json}${tag}::jsonb`;
}

function readPersistedPredecessors(writeSet) {
  const selections = PERSISTED_KINDS.map((definition, kindOrdinal) => {
    const ids = writeSet[definition.kind].map(
      (row) => row[definition.idField],
    );
    return `SELECT
  ${kindOrdinal}::integer AS kind_ordinal,
  requested.input_ordinal::integer,
  '${definition.kind}'::text AS object_kind,
  stored.${definition.idField} AS object_id,
  stored.closure_id,
  stored.canonical_payload_digest,
  stored.canonical_payload
FROM jsonb_array_elements_text(${sqlJson(ids)})
  WITH ORDINALITY AS requested(object_id, input_ordinal)
JOIN canonical_v2_staging.${definition.table} stored
  ON stored.${definition.idField}=requested.object_id`;
  });
  const rows = runSql(`${selections.join('\nUNION ALL\n')}
ORDER BY kind_ordinal, input_ordinal;`, { readOnly: true });
  const expectedCount = PERSISTED_KINDS.reduce(
    (count, definition) => count + writeSet[definition.kind].length,
    0,
  );
  if (rows.length !== expectedCount) {
    throw new Error(
      'The exact predecessor canonical objects are not all present in staging.',
    );
  }
  const byIdentity = new Map(rows.map(
    (row) => [`${row.object_kind}:${row.object_id}`, row],
  ));
  const references = [];
  const payloads = [];
  for (const definition of PERSISTED_KINDS) {
    for (const expected of writeSet[definition.kind]) {
      const objectId = expected[definition.idField];
      const stored = byIdentity.get(`${definition.kind}:${objectId}`);
      if (!stored) {
        throw new Error(`The stored ${definition.kind} predecessor is missing.`);
      }
      if (stored.closure_id !== EXPECTED_PREDECESSOR_CLOSURE_ID) {
        throw new Error(
          `The stored ${definition.kind} predecessor closure is ${stored.closure_id}.`,
        );
      }
      if (canonicalJson({
          ...stored.canonical_payload,
          closure_id: EXPECTED_F9.closureId,
        }) !== canonicalJson(expected)) {
        const normalisedStored = {
          ...stored.canonical_payload,
          closure_id: EXPECTED_F9.closureId,
        };
        const driftedKeys = [...new Set([
          ...Object.keys(normalisedStored),
          ...Object.keys(expected),
        ])].filter(
          (key) => canonicalJson(normalisedStored[key])
            !== canonicalJson(expected[key]),
        );
        throw new Error(
          `The stored ${definition.kind} predecessor differs at ${driftedKeys.join(', ')}.`,
        );
      }
      references.push({
        schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
        object_kind: definition.kind,
        object_id: objectId,
        stored_closure_id: stored.closure_id,
        canonical_payload_digest: stored.canonical_payload_digest,
        validation_closure_id: EXPECTED_F9.closureId,
      });
      payloads.push({
        object_kind: definition.kind,
        canonical_payload_digest: stored.canonical_payload_digest,
        canonical_payload: stored.canonical_payload,
      });
    }
  }
  return { references, payloads };
}

async function buildWrite() {
  const contractBundle = compileFixtureContractV6();
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admission = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const artifact = buildSourceArtifactChunks(conversion);
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      admission.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const sourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  const parserInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: sourceContext,
  };
  const parserEnvelope = buildAdmittedParserProposalEnvelope(parserInputs);
  const actionsSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext,
    contractBundle,
  });
  const actionSeed = buildQxoNoShopActionsF6ParserBoundReviewSeed({
    ...parserInputs,
    admitted_parser_proposal_envelope: parserEnvelope,
    reviewed_no_shop_actions_f6_slice: actionsSlice,
  });
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: parserEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  const definitionGraph = buildQxoNoShopReviewedDefinitionGraphF6({
    ...supplementInputs,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  });
  const exceptionSourceBinding = buildQxoNoShopExceptionSourceBindingF6({
    ...parserInputs,
    qxo_no_shop_actions_f6_parser_bound_review_seed: actionSeed,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  });
  const materialisation = buildQxoNoShopInlinePermissionF9({
    sourceContext,
    contractBundle,
    actionsSlice,
    exceptionSourceBinding,
  });
  if (dealAdmissionId !== EXPECTED_F9.dealAdmissionId
    || materialisation.semantic_closure_id !== EXPECTED_F9.closureId
    || materialisation.relationship.relationship_revision_id
      !== EXPECTED_F9.relationshipRevisionId) {
    throw new Error('The exact QXO F9 semantic identity has drifted.');
  }

  const persisted = readPersistedPredecessors(
    materialisation.canonical_write_set,
  );
  const repository = new InMemoryCanonicalRepository({
    persistedCanonicalObjects: persisted.payloads,
  });
  const writer = createCanonicalWriter({ repository, contractBundle });
  await writer.write({
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: 'QXO_SEC_INTAKE_PREREQUISITE',
    writeSet: { intake_capture: capture },
  });
  for (const chunk of artifact.chunks) {
    await writer.write({
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey:
        `QXO_SEC_SOURCE_ARTIFACT_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: {
        source_artifact_manifest: artifact.manifest,
        source_artifact_chunk: chunk,
      },
    });
  }
  await writer.write({
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: 'QXO_SEC_SOURCE_ADMISSION_V2',
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: capture.intake_capture_receipt_id,
        source_response_content_id: capture.source_response_content_id,
      },
      conversion_artifact_manifest: artifact.manifest,
      verification,
      source_admission_bundle: admission,
    },
  });
  await writer.write({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: `${IDEMPOTENCY_KEY}_FULL_GRAPH_VALIDATION`,
    dryRun: true,
    writeSet: materialisation.canonical_write_set,
  });
  const successorWriteSet = {
    ...materialisation.canonical_write_set,
    persisted_object_references: persisted.references,
    excerpts: [],
    provisions: [],
    components: [],
    claims: [],
  };
  const input = {
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey: IDEMPOTENCY_KEY,
    writeSet: successorWriteSet,
  };
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  return {
    ...input,
    inputDigest: dryRun.inputDigest,
    receipt: committed.receipt,
    sourceContext,
    materialisation,
    persisted,
  };
}

function writerSql(write) {
  return `SELECT public.canonical_v2_write(
    'staging',
    'DEAL_SCOPE_RUN',
    '${IDEMPOTENCY_KEY}',
    '${write.inputDigest}',
    ${sqlJson(write.writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${sqlJson(write.receipt)}
  ) AS result;`;
}

function resignRelationship(row) {
  row.relationship_revision_id = contentId(
    'RELATIONSHIP_REVISION/V1',
    {
      relationship_occurrence_id: row.relationship_occurrence_id,
      source_occurrence_id: row.source_occurrence_id,
      relationship_definition_key: row.relationship_definition_key,
      relationship_definition_version: row.relationship_definition_version,
      ordinal: row.ordinal,
      state: row.state,
      raw_scope: row.raw_scope,
      scope: row.scope,
      applicability: row.applicability,
      not_examined: row.not_examined,
      failure: row.failure,
      target_occurrence_ids: row.target_occurrence_ids,
      effect: row.effect,
      evidence_ids: row.evidence_ids,
      attributes: row.attributes,
      taxonomy_codes: row.taxonomy_codes,
      resolver_version: row.resolver_version,
    },
  );
}

function buildUnknownEffectProbe(writeSetInput) {
  const idempotencyKey =
    'QXO_NO_SHOP_INLINE_PERMISSION_F9_UNKNOWN_EFFECT_PROBE_V1';
  const writeSet = structuredClone(writeSetInput);
  writeSet.relationships[0].effect = {
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
  };
  resignRelationship(writeSet.relationships[0]);
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    writeSet,
    residuals: [],
    quarantines: [],
  });
  const receipt = buildCanonicalWriteReceipt({
    operation: 'DEAL_SCOPE_RUN',
    idempotencyKey,
    inputDigest,
    validation: {
      counts: {
        publishable: 0,
        residuals: 0,
        quarantinedClosures: 0,
      },
    },
  });
  return {
    idempotencyKey,
    inputDigest,
    writeSet,
    receipt,
  };
}

function verifyUnknownEffectRejected(write) {
  const probe = buildUnknownEffectProbe(write.writeSet);
  const sql = `SELECT public.canonical_v2_write(
    'staging',
    'DEAL_SCOPE_RUN',
    '${probe.idempotencyKey}',
    '${probe.inputDigest}',
    ${sqlJson(probe.writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${sqlJson(probe.receipt)}
  ) AS result;`;
  try {
    runSql(sql);
  } catch (error) {
    if (/no-shop exception effect is invalid or unsupported/.test(
      error instanceof Error ? error.message : '',
    )) return;
    throw error;
  }
  throw new Error('The staging writer accepted an unknown no-shop effect.');
}

function state(write) {
  const closureId = write.materialisation.semantic_closure_id;
  const persistedReferences = write.writeSet.persisted_object_references;
  const rows = runSql(`WITH persisted AS (
    SELECT 'excerpts'::text AS object_kind, excerpt_id AS object_id,
      closure_id, canonical_payload_digest
    FROM canonical_v2_staging.excerpts
    UNION ALL
    SELECT 'provisions', provision_instance_id, closure_id,
      canonical_payload_digest
    FROM canonical_v2_staging.provision_instances
    UNION ALL
    SELECT 'components', provision_component_id, closure_id,
      canonical_payload_digest
    FROM canonical_v2_staging.provision_components
    UNION ALL
    SELECT 'claims', claim_revision_id, closure_id,
      canonical_payload_digest
    FROM canonical_v2_staging.claim_revisions
  )
  SELECT jsonb_build_object(
    'legacy_deal_admission_id', (
      SELECT canonical_payload->>'deal_admission_id'
      FROM canonical_v2_staging.deals
      WHERE deal_key='${DEAL_KEY}'
    ),
    'legacy_deal_digest', (
      SELECT canonical_payload_digest
      FROM canonical_v2_staging.deals
      WHERE deal_key='${DEAL_KEY}'
    ),
    'active_pointer_digest', (
      SELECT coalesce(
        canonical_v2_staging.payload_digest(
          jsonb_agg(to_jsonb(pointer) ORDER BY pointer.environment)
        ),
        'NONE'
      )
      FROM canonical_v2_staging.active_corpus_release_pointers pointer
    ),
    'deal_admission', EXISTS (
      SELECT 1
      FROM canonical_v2_staging.deal_admission_records
      WHERE deal_admission_id='${write.sourceContext.deal_admission_id}'
        AND deal_key='${DEAL_KEY}'
        AND document_hash='${write.sourceContext.document_hash}'
        AND canonical_payload_digest=canonical_v2_staging.payload_digest(
          ${sqlJson(write.writeSet.deal)}
        )
    ),
    'persisted_objects', (
      SELECT count(*)=${persistedReferences.length}
        AND bool_and(
          persisted.object_id IS NOT NULL
          AND persisted.closure_id=reference.value->>'stored_closure_id'
          AND persisted.canonical_payload_digest
            =reference.value->>'canonical_payload_digest'
        )
      FROM jsonb_array_elements(${sqlJson(persistedReferences)})
        AS reference(value)
      LEFT JOIN persisted
        ON persisted.object_kind=reference.value->>'object_kind'
        AND persisted.object_id=reference.value->>'object_id'
    ),
    'new_excerpts', (
      SELECT count(*)=0
      FROM canonical_v2_staging.excerpts
      WHERE closure_id='${closureId}'
    ),
    'new_provisions', (
      SELECT count(*)=0
      FROM canonical_v2_staging.provision_instances
      WHERE closure_id='${closureId}'
    ),
    'new_components', (
      SELECT count(*)=0
      FROM canonical_v2_staging.provision_components
      WHERE closure_id='${closureId}'
    ),
    'new_claims', (
      SELECT count(*)=0
      FROM canonical_v2_staging.claim_revisions
      WHERE closure_id='${closureId}'
    ),
    'relationships', (
      SELECT count(*)=${write.writeSet.relationships.length}
      FROM canonical_v2_staging.relationship_revisions
      WHERE closure_id='${closureId}'
    ),
    'write_receipt', EXISTS (
      SELECT 1
      FROM canonical_v2_staging.write_receipts
      WHERE operation='DEAL_SCOPE_RUN'
        AND idempotency_key='${IDEMPOTENCY_KEY}'
        AND input_digest='${write.inputDigest}'
        AND receipt_id='${write.receipt.receiptId}'
    )
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) {
    throw new Error('The QXO F9 staging state could not be read.');
  }
  return rows[0].state;
}

function assertCommitted(value) {
  if (value.legacy_deal_admission_id
      !== EXPECTED_LEGACY_DEAL_ADMISSION_ID) {
    throw new Error('The legacy QXO deal row changed.');
  }
  const required = [
    'deal_admission',
    'persisted_objects',
    'new_excerpts',
    'new_provisions',
    'new_components',
    'new_claims',
    'relationships',
    'write_receipt',
  ];
  const missing = required.filter((key) => value[key] !== true);
  if (missing.length > 0) {
    throw new Error(
      `The QXO F9 staging transaction is incomplete: ${missing.join(', ')}.`,
    );
  }
}

function immutableState(value) {
  return {
    legacy_deal_admission_id: value.legacy_deal_admission_id,
    legacy_deal_digest: value.legacy_deal_digest,
    active_pointer_digest: value.active_pointer_digest,
  };
}

function attestation(write, mode) {
  return {
    schema_version:
      'QXO_NO_SHOP_INLINE_PERMISSION_F9_STAGING_WRITE_ATTESTATION/V1',
    environment: 'STAGING',
    mode,
    authority_scope: 'POSITIVE_INLINE_PERMISSION_GRAPH_ONLY',
    deal_admission_id: write.sourceContext.deal_admission_id,
    document_hash: write.sourceContext.document_hash,
    semantic_closure_id:
      write.materialisation.semantic_closure_id,
    relationship_revision_id:
      write.materialisation.relationship.relationship_revision_id,
    action_claim_count:
      write.materialisation.canonical_write_set.claims.length,
    qualified_action_occurrence_count:
      write.materialisation.relationship.effect
        .qualified_action_occurrence_ids.length,
    persisted_object_reference_count:
      write.writeSet.persisted_object_references.length,
    publishable_object_count:
      write.receipt.publishableObjectCount,
    writer_request_byte_length:
      Buffer.byteLength(writerSql(write), 'utf8'),
    active_release_changed: false,
    legacy_deal_changed: false,
    release_authority: 'NONE',
  };
}

const invocation = Object.freeze({
  '--dry-run': 'DRY_RUN',
  '--apply': 'APPLY',
  '--verify': 'VERIFY',
});

async function main(argv) {
  const mode = argv[2];
  if (!invocation[mode] || argv.length !== 3) {
    fail(
      'Usage: node scripts/canonical-v2-staging-qxo-no-shop-inline-permission-f9.mjs --dry-run|--apply|--verify',
    );
  }
  try {
    guardProject();
    const write = await buildWrite();
    verifyUnknownEffectRejected(write);
    if (Buffer.byteLength(writerSql(write), 'utf8')
        > MAX_WRITER_REQUEST_BYTES) {
      throw new Error('The QXO F9 writer request exceeds its transport bound.');
    }
    if (invocation[mode] === 'VERIFY') {
      assertCommitted(state(write));
    } else {
      const before = state(write);
      runSql(writerSql(write));
      const afterRollback = state(write);
      if (canonicalJson(before) !== canonicalJson(afterRollback)) {
        throw new Error('Rollback-first QXO F9 run changed staging state.');
      }
      if (invocation[mode] === 'APPLY') {
        runSql(writerSql(write), { commit: true });
        const afterCommit = state(write);
        assertCommitted(afterCommit);
        if (canonicalJson(immutableState(before))
            !== canonicalJson(immutableState(afterCommit))) {
          throw new Error(
            'QXO F9 write changed the legacy deal or active release pointer.',
          );
        }
      }
    }
    process.stdout.write(`${canonicalJson(attestation(
      write,
      invocation[mode] === 'APPLY'
        ? 'COMMITTED'
        : invocation[mode] === 'VERIFY'
          ? 'VERIFIED'
          : 'ROLLED_BACK',
    ))}\n`);
  } catch (error) {
    fail(
      error instanceof Error
        ? error.message
        : 'Canonical QXO F9 staging run failed.',
    );
  }
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] || '')) {
  main(process.argv);
}

export { buildUnknownEffectProbe };
