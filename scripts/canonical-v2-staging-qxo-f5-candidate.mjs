#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  recheckCandidateInputHead,
  selectTrustedCandidateInputs,
} = require('../lib/canonical-v2/candidate-input-authority');
const {
  importCandidateRelease,
  rollbackInactiveCandidateRelease,
} = require('../lib/canonical-v2/candidate-release-import');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { createCanonicalWriter } = require('../lib/canonical-v2/canonical-writer');
const {
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  composeReferenceOnlyDealScopeWriteSet,
} = require('../lib/canonical-v2/deal-extraction-write-set');
const {
  buildQxoDenominatorPrecisionF5Candidate,
} = require('../lib/canonical-v2/qxo-reverse-f4-candidate');
const {
  QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F4_CANDIDATE_MANIFEST_ID,
  QXO_REVERSE_F4_CORPUS_RELEASE_ID,
} = require('../lib/canonical-v2/qxo-reverse-candidate-identity');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-qxo-f5-candidate-',
  operationLabel: 'Canonical QXO F5 inactive candidate',
  bounds: {
    maxSqlBytes: 2 * 1024 * 1024,
    maxResponseBytes: 4 * 1024 * 1024,
    maxProcessBufferBytes: 6 * 1024 * 1024,
  },
});
const {
  guardProject,
  runSql,
  sqlJson,
  sqlRpcClient,
  sqlText,
} = runtime;

const DEAL_KEY = 'deal:qxo-topbuild';
const DEAL_ADMISSION_ID = '62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f';
const APPLICATION_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const AGREEMENT_SOURCE_ADMISSION_ID =
  'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819';
const DEAL_VALUE_SOURCE_ADMISSION_ID =
  '8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c';
const F5_AUTHORITY = Object.freeze({
  candidateInputHeadId: '100f80b3ed7e0685f010e79597d16458eda681469375315d4b072e79fd36b9ea',
  candidateInputHeadDigest: '8a8188dc2da2bcd7eff4463487f663e0fa51fefd5b3a29d4189efd89f756db12',
  correctionDischargeMapId: 'b2c6f67f1e48acca7e9d4a95e78588cb984b646bc5c617647d71bc8ecfb7b5af',
});
const EXPECTED_CANDIDATE = Object.freeze({
  corpusReleaseId: '7980dc600883690a0b290abb679a5ea5ecbd3119f7de97fa0519f5ca82d883c7',
  servingNamespaceId: 'e7d2c4c0941d6b825ea47599826bdd8c3b8767f160241c112e5f5b34bd30de6d',
  candidateManifestId: 'aa407583e05b0ed01a1675e78321963a70b54624a2647541dc50b2ab558bdb02',
  importPlanId: '0f2a73c1d8d71e4e7e1978ae160f5aa0e23e66d7211ceb9a46941e80ba396da6',
});
const EXPECTED_SEMANTIC_WRITE = Object.freeze({
  inputDigest: '4c75cfbff60131e7572b4c51d20b3974fcf54e4588b32b17f2501ba62c550706',
  receiptId: '299e6dbd8091edf81b9e2428e42d3d0d08de10b973dde07b422812365b9f76cb',
  persistedObjectReferences: 84,
  newSemanticObjects: 4,
});
const OPERATION = 'DEAL_SCOPE_RUN';
const IDEMPOTENCY_KEY = 'QXO_MONEY_DENOMINATOR_PRECISION_F5_DEAL_SCOPE_V1';
const EXPECTED_COUNTS = Object.freeze({
  observations: 10,
  exclusions: 2,
  sharedRows: 11,
  incompleteRows: 1,
  queryRows: 10,
  exactDetails: 11,
  dealDirectoryRows: 1,
  approximateMoneyRows: 3,
});
const MAX_WRITER_PAYLOAD_BYTES = 1536 * 1024;
const PERSISTED_OBJECTS = Object.freeze({
  excerpts: Object.freeze({ table: 'excerpts', identity: 'excerpt_id' }),
  validated_semantic_graphs: Object.freeze({
    table: 'validated_semantic_graphs',
    identity: 'validated_semantic_graph_id',
  }),
  provisions: Object.freeze({ table: 'provision_instances', identity: 'provision_instance_id' }),
  components: Object.freeze({ table: 'provision_components', identity: 'provision_component_id' }),
  claims: Object.freeze({ table: 'claim_revisions', identity: 'claim_revision_id' }),
  relationships: Object.freeze({
    table: 'relationship_revisions',
    identity: 'relationship_revision_id',
  }),
  open_world_candidates: Object.freeze({ table: 'open_world_candidates', identity: 'candidate_id' }),
  open_world_candidate_occurrences: Object.freeze({
    table: 'open_world_candidate_occurrences',
    identity: 'open_world_candidate_occurrence_id',
  }),
  open_world_evidence_references: Object.freeze({
    table: 'open_world_evidence_references',
    identity: 'evidence_reference_id',
  }),
  open_world_candidate_dispositions: Object.freeze({
    table: 'open_world_candidate_dispositions',
    identity: 'final_disposition_id',
  }),
  open_world_primitives: Object.freeze({ table: 'open_world_primitives', identity: 'primitive_id' }),
  semantic_impact_closures: Object.freeze({
    table: 'semantic_impact_closures',
    identity: 'semantic_impact_closure_id',
  }),
  reviewed_source_specific_rows: Object.freeze({
    table: 'reviewed_source_specific_rows',
    identity: 'reviewed_source_specific_row_serving_key',
  }),
  incomplete_canonical_result_rows: Object.freeze({
    table: 'incomplete_canonical_result_rows',
    identity: 'incomplete_result_review_row_serving_key',
  }),
});

let currentStage = 'STARTUP';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readSourceInputs() {
  const sourceBundle = (admissionId) => `(SELECT jsonb_build_object(
    'immutable_source_document', immutable.canonical_payload,
    'source_admission_manifest', admission.canonical_payload,
    'semantic_extraction_input_envelope', envelope.canonical_payload,
    'conversion', conversion.canonical_payload
  )
    FROM canonical_v2_staging.source_admission_manifests admission
    JOIN canonical_v2_staging.immutable_source_documents immutable
      ON immutable.immutable_source_document_id=
        admission.canonical_payload->>'immutable_source_document_id'
    JOIN canonical_v2_staging.semantic_extraction_input_envelopes envelope
      ON envelope.source_admission_manifest_id=admission.source_admission_manifest_id
    JOIN canonical_v2_staging.canonical_text_conversions conversion
      ON conversion.canonical_text_id=admission.canonical_payload->>'canonical_text_id'
    WHERE admission.source_admission_manifest_id='${admissionId}')`;
  const rows = runSql(`SELECT jsonb_build_object(
    'agreement', ${sourceBundle(AGREEMENT_SOURCE_ADMISSION_ID)},
    'deal_value', ${sourceBundle(DEAL_VALUE_SOURCE_ADMISSION_ID)},
    'active_pointer', (SELECT canonical_payload
      FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging'),
    'stored_deal', (SELECT canonical_payload
      FROM canonical_v2_staging.deals
      WHERE deal_key='${DEAL_KEY}'),
    'f4_predecessor', (SELECT jsonb_build_object(
      'corpus_release_id', corpus_release_id,
      'candidate_manifest_id', candidate_manifest_id
    ) FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id='${QXO_REVERSE_F4_CORPUS_RELEASE_ID}')
  ) AS inputs;`, { readOnly: true });
  const inputs = rows[0]?.inputs;
  if (rows.length !== 1
    || !inputs?.agreement
    || !inputs?.deal_value
    || !inputs?.active_pointer
    || canonicalJson(inputs.stored_deal) !== canonicalJson({
      deal_key: DEAL_KEY,
      deal_admission_id: DEAL_ADMISSION_ID,
      document_hash: inputs.agreement.immutable_source_document.response_bytes_sha256,
    })
    || canonicalJson(inputs.f4_predecessor) !== canonicalJson({
      corpus_release_id: QXO_REVERSE_F4_CORPUS_RELEASE_ID,
      candidate_manifest_id: QXO_REVERSE_F4_CANDIDATE_MANIFEST_ID,
    })) {
    throw new Error('The exact admitted sources, active pointer and inactive F4 predecessor must resolve once.');
  }
  return inputs;
}

function sourceContext(source, sourceOrdinal) {
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: source.immutable_source_document,
    source_admission_manifest: source.source_admission_manifest,
    semantic_extraction_input_envelope: source.semantic_extraction_input_envelope,
    conversion: source.conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: sourceOrdinal,
  });
}

function assertAuthority(authoritySelection) {
  const head = authoritySelection.candidate_input_head;
  if (head.contract_fingerprint !== QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT
    || head.candidate_input_head_id !== F5_AUTHORITY.candidateInputHeadId
    || head.canonical_payload_digest !== F5_AUTHORITY.candidateInputHeadDigest
    || head.correction_discharge_map_id !== F5_AUTHORITY.correctionDischargeMapId
    || head.generation !== 1
    || authoritySelection.active_correction_application_ids.length !== 0
    || authoritySelection.correction_materialisations.length !== 0) {
    throw new Error('The selected F5 correction authority is not the exact empty generation-1 head.');
  }
}

async function buildCandidate() {
  const inputs = readSourceInputs();
  const agreementSourceContext = sourceContext(inputs.agreement, 0);
  const dealValueSourceContext = sourceContext(inputs.deal_value, 1);
  const contractBundle = compileFixtureContractV5();
  if (contractBundle.fingerprint !== QXO_DENOMINATOR_PRECISION_F5_CONTRACT_FINGERPRINT) {
    throw new Error('The compiled F5 contract fingerprint has drifted.');
  }
  const authoritySelection = await selectTrustedCandidateInputs({
    client: sqlRpcClient(),
    contract_bundle: contractBundle,
  });
  assertAuthority(authoritySelection);
  const build = buildQxoDenominatorPrecisionF5Candidate({
    agreementSourceContext,
    agreementSourceAdmission: inputs.agreement.source_admission_manifest,
    dealValueSourceContext,
    dealValueSourceAdmission: inputs.deal_value.source_admission_manifest,
    contractBundle,
    correctionAuthoritySelection: authoritySelection,
  });
  const semanticWrite = await buildSemanticWrite({
    build,
    sources: [inputs.agreement, inputs.deal_value],
    storedDeal: inputs.stored_deal,
  });
  return Object.freeze({
    inputs,
    agreementSourceContext,
    dealValueSourceContext,
    authoritySelection,
    build,
    semanticWrite,
  });
}

async function buildSemanticWrite({ build, sources, storedDeal }) {
  const materialWriteSet = build.serving_slices.material.semantic_write_set;
  const terminationWriteSet = build.serving_slices.termination_fee_semantic_write_set;
  const storedMaterialWriteSet = Object.freeze({
    ...materialWriteSet,
    deal: storedDeal,
  });
  const proposedWriteSet = composeReferenceOnlyDealScopeWriteSet({
    writeSets: [storedMaterialWriteSet, terminationWriteSet],
    deal: storedDeal,
  });
  const forcedPublishKeys = new Set([
    ...proposedWriteSet.claims
      .filter((claim) => claim.attributes?.denominator_precision === 'APPROXIMATE')
      .map((claim) => `claims:${claim.claim_revision_id}`),
    ...proposedWriteSet.incomplete_canonical_result_rows.map(
      (row) => `incomplete_canonical_result_rows:${row.incomplete_result_review_row_serving_key}`,
    ),
  ]);
  if (forcedPublishKeys.size !== EXPECTED_SEMANTIC_WRITE.newSemanticObjects) {
    throw new Error('The F5 semantic delta must contain exactly three precision claims and one incomplete row.');
  }
  const {
    writeSet,
    resolvedPersistedObjects,
  } = partitionPersistedObjects(proposedWriteSet, forcedPublishKeys);
  const sourcesByAdmission = new Map(sources.map((source) => [
    source.source_admission_manifest.source_admission_manifest_id,
    source,
  ]));
  const repository = {
    getReceipt: async () => null,
    resolveAdmittedSourceReferences: async (references) => references.map(
      (reference) => sourcesByAdmission.get(reference.source_admission_manifest_id) || null,
    ),
    resolvePersistedCanonicalObjectReferences: async (references) => references.map(
      (reference) => resolvedPersistedObjects.get(
        `${reference.object_kind}:${reference.object_id}`,
      ) || null,
    ),
    transaction: async () => {
      throw new Error('The local F5 validator must never open a write transaction.');
    },
  };
  const writer = createCanonicalWriter({
    repository,
    contractBundle: build.contract_bundle,
  });
  const dryRun = await writer.write({
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    writeSet,
    dryRun: true,
  });
  if (dryRun.validation.counts.residuals !== 0
    || dryRun.validation.counts.quarantinedClosures !== 0
    || dryRun.validation.residuals.length !== 0
    || dryRun.validation.quarantines.length !== 0) {
    throw new Error('The F5 semantic write did not validate without residuals and quarantines.');
  }
  const receiptBody = {
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    inputDigest: dryRun.inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: dryRun.validation.counts.publishable,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  const request = Object.freeze({
    operation: OPERATION,
    idempotencyKey: IDEMPOTENCY_KEY,
    inputDigest: dryRun.inputDigest,
    writeSet,
    residuals: Object.freeze([]),
    quarantines: Object.freeze([]),
    receipt: Object.freeze({
      receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody),
      ...receiptBody,
    }),
  });
  if (Buffer.byteLength(JSON.stringify(request), 'utf8') > MAX_WRITER_PAYLOAD_BYTES) {
    throw new Error('The F5 semantic writer request exceeds its bounded payload limit.');
  }
  return request;
}

function objectWithoutClosure(row) {
  const { closure_id: ignored, ...canonicalObject } = row;
  return canonicalObject;
}

function readPersistedObjects(requests) {
  if (requests.length === 0) return [];
  const storedArms = Object.entries(PERSISTED_OBJECTS).map(([objectKind, config]) => `
    SELECT requested.input_ordinal, requested.object_kind, requested.object_id,
      stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
    FROM requested
    JOIN canonical_v2_staging.${config.table} stored
      ON requested.object_kind='${objectKind}'
      AND stored.${config.identity}=requested.object_id`);
  return runSql(`WITH requested AS (
    SELECT *
    FROM jsonb_to_recordset(${sqlJson(requests)})
      AS item(input_ordinal integer, object_kind text, object_id text)
  ),
  stored AS (${storedArms.join('\n    UNION ALL')})
  SELECT requested.input_ordinal, requested.object_kind, requested.object_id,
    stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
  FROM requested
  LEFT JOIN stored USING (input_ordinal, object_kind, object_id)
  ORDER BY requested.input_ordinal;`, { readOnly: true });
}

function partitionPersistedObjects(proposedWriteSet, forcedPublishKeys) {
  const requests = [];
  const proposedByKey = new Map();
  for (const [objectKind, config] of Object.entries(PERSISTED_OBJECTS)) {
    for (const row of proposedWriteSet[objectKind]) {
      const objectId = row[config.identity];
      const key = `${objectKind}:${objectId}`;
      if (proposedByKey.has(key)) {
        throw new Error(`The proposed F5 write contains duplicate canonical object ${key}.`);
      }
      proposedByKey.set(key, row);
      requests.push({
        input_ordinal: requests.length,
        object_kind: objectKind,
        object_id: objectId,
      });
    }
  }
  const storedRows = readPersistedObjects(requests);
  if (storedRows.length !== requests.length) {
    throw new Error('The bounded persisted-object read did not preserve exact request cardinality.');
  }
  const persistedKeys = new Set();
  const persistedObjectReferences = [];
  const resolvedPersistedObjects = new Map();
  for (const [index, request] of requests.entries()) {
    const stored = storedRows[index];
    if (stored.input_ordinal !== request.input_ordinal
      || stored.object_kind !== request.object_kind
      || stored.object_id !== request.object_id) {
      throw new Error('The bounded persisted-object read changed request order or identity.');
    }
    if (!stored.canonical_payload) continue;
    const key = `${request.object_kind}:${request.object_id}`;
    const proposed = proposedByKey.get(key);
    if (forcedPublishKeys.has(key)) {
      if (canonicalJson(stored.canonical_payload) !== canonicalJson(proposed)) {
        throw new Error(`Pinned F5 semantic delta object ${key} conflicts with stored content.`);
      }
      continue;
    }
    if (canonicalJson(objectWithoutClosure(stored.canonical_payload))
      !== canonicalJson(objectWithoutClosure(proposed))) {
      throw new Error(`Persisted canonical object ${key} conflicts beyond publication closure.`);
    }
    if (stored.canonical_payload.closure_id !== stored.closure_id
      || !/^[a-f0-9]{64}$/.test(stored.canonical_payload_digest || '')) {
      throw new Error(`Persisted canonical object ${key} has invalid stored provenance.`);
    }
    persistedKeys.add(key);
    persistedObjectReferences.push(Object.freeze({
      schema_version: 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1',
      object_kind: request.object_kind,
      object_id: request.object_id,
      stored_closure_id: stored.closure_id,
      canonical_payload_digest: stored.canonical_payload_digest,
      validation_closure_id: proposed.closure_id,
    }));
    resolvedPersistedObjects.set(key, Object.freeze({
      object_kind: request.object_kind,
      object_id: request.object_id,
      closure_id: stored.closure_id,
      canonical_payload_digest: stored.canonical_payload_digest,
      canonical_payload: stored.canonical_payload,
    }));
  }
  const writeSet = Object.freeze({
    ...proposedWriteSet,
    ...Object.fromEntries(Object.keys(PERSISTED_OBJECTS).map((objectKind) => [
      objectKind,
      Object.freeze(proposedWriteSet[objectKind].filter((row) => (
        !persistedKeys.has(`${objectKind}:${row[PERSISTED_OBJECTS[objectKind].identity]}`)
      ))),
    ])),
    persisted_object_references: Object.freeze(persistedObjectReferences),
  });
  return Object.freeze({ writeSet, resolvedPersistedObjects });
}

function writerRpcParams(request) {
  return {
    p_environment: 'staging',
    p_operation: request.operation,
    p_idempotency_key: request.idempotencyKey,
    p_input_digest: request.inputDigest,
    p_write_set: request.writeSet,
    p_residuals: request.residuals,
    p_quarantines: request.quarantines,
    p_receipt: request.receipt,
  };
}

async function executeSemanticWrite(request, { commit }) {
  const { data, error } = await sqlRpcClient({ commit }).rpc(
    'canonical_v2_write',
    writerRpcParams(request),
  );
  const { replayed, ...receipt } = data || {};
  if (error
    || typeof replayed !== 'boolean'
    || canonicalJson(receipt) !== canonicalJson(request.receipt)) {
    throw new Error(error?.message || 'The canonical writer returned a different F5 receipt.');
  }
}

function readSemanticState(request) {
  const rows = runSql(`SELECT jsonb_build_object(
    'total_receipts', (SELECT count(*) FROM canonical_v2_staging.write_receipts
      WHERE operation=${sqlText(request.operation)}
        AND idempotency_key=${sqlText(request.idempotencyKey)}),
    'exact_receipts', (SELECT count(*) FROM canonical_v2_staging.write_receipts
      WHERE operation=${sqlText(request.operation)}
        AND idempotency_key=${sqlText(request.idempotencyKey)}
        AND input_digest=${sqlText(request.inputDigest)}
        AND receipt_id=${sqlText(request.receipt.receiptId)}
        AND canonical_payload=${sqlJson(request.receipt)})
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) {
    throw new Error('The F5 semantic writer state could not be read.');
  }
  return rows[0].state;
}

function assertSemanticWritten(state) {
  if (Number(state.total_receipts) !== 1 || Number(state.exact_receipts) !== 1) {
    throw new Error('The exact F5 semantic writer receipt is missing or conflicting.');
  }
}

function readCandidateState(build) {
  const releaseId = build.corpus_release_id;
  const rows = runSql(`SELECT jsonb_build_object(
    'release_records', (SELECT count(*) FROM canonical_v2_staging.fixture_corpus_releases
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND candidate_manifest_id=${sqlText(build.release.manifest.candidate_release_manifest_id)}
        AND contract_fingerprint=${sqlText(build.contract_bundle.fingerprint)}),
    'correction_input_seals', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_input_seals
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'correction_discharges', (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_discharges
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'deal_directory_records', (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND application_deal_id='${APPLICATION_DEAL_ID}'),
    'market_observations', (SELECT count(*) FROM canonical_v2_staging.market_observations
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'market_exclusions', (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'shared_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'query_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND canonical_payload->>'row_kind'='CANONICAL_RESULT'),
    'incomplete_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND canonical_payload->>'row_kind'='INCOMPLETE_CANONICAL_RESULT'),
    'exact_details', (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages
      WHERE corpus_release_id=${sqlText(releaseId)}),
    'complete_receipts', (SELECT count(*) FROM canonical_v2_staging.candidate_release_import_receipts
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND candidate_release_import_plan_id=${sqlText(build.import_plan.candidate_release_import_plan_id)}
        AND import_state='IMPORTED_COMPLETE'),
    'approximate_money_rows', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND coalesce(
          canonical_payload #>> '{canonical_result,components,0,unit}',
          canonical_payload #>> '{incomplete_canonical_result,components,0,unit}'
        )='PERCENT_OF_DEAL_VALUE'
        AND coalesce(
          canonical_payload #>> '{canonical_result,components,0,denominator,precision}',
          canonical_payload #>> '{incomplete_canonical_result,components,0,denominator,precision}'
        )='APPROXIMATE'
        AND coalesce(
          canonical_payload #>> '{canonical_result,components,0,claim_attributes,denominator_precision}',
          canonical_payload #>> '{incomplete_canonical_result,components,0,claim_attributes,denominator_precision}'
        )='APPROXIMATE'
        AND denominator_precision='APPROXIMATE'),
    'money_precision_mismatches', (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(releaseId)}
        AND coalesce(
          canonical_payload #>> '{canonical_result,components,0,unit}',
          canonical_payload #>> '{incomplete_canonical_result,components,0,unit}'
        )='PERCENT_OF_DEAL_VALUE'
        AND (
          coalesce(
            canonical_payload #>> '{canonical_result,components,0,denominator,precision}',
            canonical_payload #>> '{incomplete_canonical_result,components,0,denominator,precision}'
          ) IS DISTINCT FROM denominator_precision
          OR coalesce(
            canonical_payload #>> '{canonical_result,components,0,claim_attributes,denominator_precision}',
            canonical_payload #>> '{incomplete_canonical_result,components,0,claim_attributes,denominator_precision}'
          ) IS DISTINCT FROM denominator_precision
        )),
    'active_pointer', (SELECT canonical_payload
      FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging')
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) {
    throw new Error('The F5 inactive candidate state could not be read.');
  }
  return rows[0].state;
}

function assertCandidateImported(state, candidate) {
  const release = candidate.build.release;
  const expected = {
    release_records: 1,
    correction_input_seals: 1,
    correction_discharges: release.correction_discharges.length,
    deal_directory_records: EXPECTED_COUNTS.dealDirectoryRows,
    market_observations: EXPECTED_COUNTS.observations,
    market_exclusions: EXPECTED_COUNTS.exclusions,
    shared_rows: EXPECTED_COUNTS.sharedRows,
    query_rows: EXPECTED_COUNTS.queryRows,
    incomplete_rows: EXPECTED_COUNTS.incompleteRows,
    exact_details: EXPECTED_COUNTS.exactDetails,
    complete_receipts: 1,
    approximate_money_rows: EXPECTED_COUNTS.approximateMoneyRows,
    money_precision_mismatches: 0,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (Number(state[key]) !== value) {
      throw new Error(`The F5 inactive candidate ${key} is ${state[key]}, expected ${value}.`);
    }
  }
}

function assertCandidateAbsent(state) {
  for (const key of [
    'release_records',
    'correction_input_seals',
    'correction_discharges',
    'deal_directory_records',
    'market_observations',
    'market_exclusions',
    'shared_rows',
    'query_rows',
    'incomplete_rows',
    'exact_details',
    'complete_receipts',
    'approximate_money_rows',
    'money_precision_mismatches',
  ]) {
    if (Number(state[key]) !== 0) {
      throw new Error(`The F5 inactive candidate ${key} remains after rollback.`);
    }
  }
}

function actualIdentities(candidate) {
  return Object.freeze({
    corpusReleaseId: candidate.build.corpus_release_id,
    servingNamespaceId: candidate.build.serving_namespace_id,
    candidateManifestId: candidate.build.release.manifest.candidate_release_manifest_id,
    importPlanId: candidate.build.import_plan.candidate_release_import_plan_id,
  });
}

function assertIdentityPins(candidate) {
  const actual = actualIdentities(candidate);
  const semanticWrite = {
    inputDigest: candidate.semanticWrite.inputDigest,
    receiptId: candidate.semanticWrite.receipt.receiptId,
    persistedObjectReferences:
      candidate.semanticWrite.writeSet.persisted_object_references.length,
    newSemanticObjects: Object.keys(PERSISTED_OBJECTS).reduce(
      (count, objectKind) => count + candidate.semanticWrite.writeSet[objectKind].length,
      0,
    ),
  };
  if (canonicalJson(actual) !== canonicalJson(EXPECTED_CANDIDATE)
    || canonicalJson(semanticWrite) !== canonicalJson(EXPECTED_SEMANTIC_WRITE)) {
    throw new Error(`The F5 candidate identities must be pinned before mutation: ${canonicalJson(actual)}`);
  }
}

function assertActivePointer(candidate, state) {
  if (canonicalJson(state.active_pointer) !== canonicalJson(candidate.inputs.active_pointer)) {
    throw new Error('The inactive F5 lifecycle changed the active staging pointer.');
  }
}

async function recheckAuthority(candidate) {
  await recheckCandidateInputHead({
    client: sqlRpcClient(),
    candidate_input_head: candidate.authoritySelection.candidate_input_head,
  });
}

function attestation(candidate, status, rollbackRehearsed = false) {
  const identities = actualIdentities(candidate);
  const newSemanticObjectCount = Object.keys(PERSISTED_OBJECTS).reduce(
    (count, objectKind) => count + candidate.semanticWrite.writeSet[objectKind].length,
    0,
  );
  return Object.freeze({
    schema_version: 'QXO_DENOMINATOR_PRECISION_F5_STAGING_ATTESTATION/V1',
    environment: 'staging',
    status,
    contract_fingerprint: candidate.build.contract_bundle.fingerprint,
    candidate_input_head_id:
      candidate.authoritySelection.candidate_input_head.candidate_input_head_id,
    correction_discharge_map_id:
      candidate.authoritySelection.candidate_input_head.correction_discharge_map_id,
    semantic_write_input_digest: candidate.semanticWrite.inputDigest,
    semantic_write_receipt_id: candidate.semanticWrite.receipt.receiptId,
    persisted_semantic_object_references:
      candidate.semanticWrite.writeSet.persisted_object_references.length,
    new_semantic_objects: newSemanticObjectCount,
    ...identities,
    observations: candidate.build.release.market_observations.length,
    exclusions: candidate.build.release.market_exclusions.length,
    shared_rows: candidate.build.release.shared_rows.length,
    incomplete_rows: candidate.build.release.incomplete_canonical_rows.length,
    query_rows: candidate.build.release.query_records.length,
    exact_details: candidate.build.release.exact_detail_packages.length,
    approximate_money_rows: EXPECTED_COUNTS.approximateMoneyRows,
    active_pointer_id: candidate.inputs.active_pointer.pointer_id,
    active_pointer_unchanged: true,
    rollback_rehearsed: rollbackRehearsed,
  });
}

const mode = process.argv[2];
const MODES = new Set([
  '--derive',
  '--dry-run',
  '--import',
  '--verify',
  '--rehearse-rollback',
]);
if (!MODES.has(mode) || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-f5-candidate.mjs --derive|--dry-run|--import|--verify|--rehearse-rollback');
}

try {
  currentStage = 'GUARD_PROJECT';
  guardProject();
  currentStage = 'BUILD_AND_CERTIFY';
  const candidate = await buildCandidate();
  if (mode === '--derive') {
    process.stdout.write(`${canonicalJson(attestation(candidate, 'DERIVED_NOT_APPLIED'))}\n`);
    process.exit(0);
  }
  assertIdentityPins(candidate);
  currentStage = 'READ_INITIAL_STATE';
  const initialSemanticState = readSemanticState(candidate.semanticWrite);
  const initialCandidateState = readCandidateState(candidate.build);
  assertActivePointer(candidate, initialCandidateState);

  if (mode === '--dry-run') {
    currentStage = 'RECHECK_AUTHORITY';
    await recheckAuthority(candidate);
    currentStage = 'DRY_RUN_SEMANTIC_WRITE';
    await executeSemanticWrite(candidate.semanticWrite, { commit: false });
    const afterSemanticDryRun = readSemanticState(candidate.semanticWrite);
    if (canonicalJson(afterSemanticDryRun) !== canonicalJson(initialSemanticState)) {
      throw new Error('The rollback-first F5 semantic write changed staging state.');
    }
    if (Number(initialSemanticState.exact_receipts) === 1) {
      currentStage = 'DRY_RUN_CANDIDATE_IMPORT';
      await importCandidateRelease({
        client: sqlRpcClient(),
        release: candidate.build.release,
      });
      const afterImportDryRun = readCandidateState(candidate.build);
      if (canonicalJson(afterImportDryRun) !== canonicalJson(initialCandidateState)) {
        throw new Error('The rollback-first F5 candidate import changed staging state.');
      }
    }
    process.stdout.write(`${canonicalJson(attestation(candidate, 'DRY_RUN_ROLLED_BACK'))}\n`);
    process.exit(0);
  }

  if (mode === '--import') {
    if (Number(initialSemanticState.exact_receipts) === 0) {
      currentStage = 'DRY_RUN_SEMANTIC_WRITE';
      await executeSemanticWrite(candidate.semanticWrite, { commit: false });
      if (canonicalJson(readSemanticState(candidate.semanticWrite))
        !== canonicalJson(initialSemanticState)) {
        throw new Error('The rollback-first F5 semantic write changed staging state.');
      }
      currentStage = 'RECHECK_AUTHORITY_FOR_SEMANTIC_WRITE';
      await recheckAuthority(candidate);
      currentStage = 'APPLY_SEMANTIC_WRITE';
      await executeSemanticWrite(candidate.semanticWrite, { commit: true });
    }
    assertSemanticWritten(readSemanticState(candidate.semanticWrite));
    const beforeImport = readCandidateState(candidate.build);
    assertActivePointer(candidate, beforeImport);
    if (Number(beforeImport.release_records) === 0) {
      currentStage = 'RECHECK_AUTHORITY_FOR_IMPORT_DRY_RUN';
      await recheckAuthority(candidate);
      currentStage = 'DRY_RUN_CANDIDATE_IMPORT';
      await importCandidateRelease({
        client: sqlRpcClient(),
        release: candidate.build.release,
      });
      if (canonicalJson(readCandidateState(candidate.build)) !== canonicalJson(beforeImport)) {
        throw new Error('The rollback-first F5 candidate import changed staging state.');
      }
      currentStage = 'RECHECK_AUTHORITY_FOR_IMPORT';
      await recheckAuthority(candidate);
      currentStage = 'IMPORT_INACTIVE_CANDIDATE';
      await importCandidateRelease({
        client: sqlRpcClient({ commit: true }),
        release: candidate.build.release,
      });
    }
    const imported = readCandidateState(candidate.build);
    assertCandidateImported(imported, candidate);
    assertActivePointer(candidate, imported);
    process.stdout.write(`${canonicalJson(attestation(candidate, 'IMPORTED_INACTIVE'))}\n`);
    process.exit(0);
  }

  assertSemanticWritten(initialSemanticState);
  assertCandidateImported(initialCandidateState, candidate);
  if (mode === '--verify') {
    process.stdout.write(`${canonicalJson(attestation(candidate, 'VERIFIED_INACTIVE'))}\n`);
    process.exit(0);
  }

  currentStage = 'ROLLBACK_INACTIVE_CANDIDATE';
  await rollbackInactiveCandidateRelease({
    client: sqlRpcClient({ commit: true }),
    release: candidate.build.release,
  });
  const absent = readCandidateState(candidate.build);
  assertCandidateAbsent(absent);
  assertActivePointer(candidate, absent);
  currentStage = 'RECHECK_AUTHORITY_FOR_REIMPORT';
  await recheckAuthority(candidate);
  currentStage = 'REIMPORT_IDENTICAL_CANDIDATE';
  await importCandidateRelease({
    client: sqlRpcClient({ commit: true }),
    release: candidate.build.release,
  });
  const reimported = readCandidateState(candidate.build);
  assertCandidateImported(reimported, candidate);
  assertActivePointer(candidate, reimported);
  process.stdout.write(`${canonicalJson(attestation(
    candidate,
    'ROLLED_BACK_AND_REIMPORTED',
    true,
  ))}\n`);
} catch (error) {
  fail(error instanceof Error
    ? `${currentStage}: ${error.message}`
    : `${currentStage}: Canonical QXO F5 candidate run failed.`);
}
