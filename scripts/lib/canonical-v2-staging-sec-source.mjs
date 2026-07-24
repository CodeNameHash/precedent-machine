import https from 'node:https';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createCanonicalV2StagingRuntime } from './canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const {
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../../lib/canonical-v2/canonical-writer');
const {
  buildSecEdgarIntakeCapture,
  validateSecEdgarIntakeCapture,
} = require('../../lib/canonical-v2/sec-edgar-intake-capture');
const {
  CONFIG_DIGEST,
  CONVERTER_DIGEST,
  convertSecHtmlToCanonicalText,
} = require('../../lib/canonical-v2/sec-html-canonical-text');
const {
  VERIFIER_DIGEST,
  verifySecHtmlCanonicalText,
} = require('../../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
  validateVerifiedSecSourceAdmission,
} = require('../../lib/canonical-v2/sec-source-admission');
const {
  CHUNK_MAX_BYTE_LENGTH,
  buildSourceArtifactChunks,
  reconstructSourceArtifact,
} = require('../../lib/canonical-v2/source-artifact-chunks');

const DIGEST_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_WRITER_REQUEST_BYTES = 512 * 1024;
const WRITER_DEFINITION_SHA256 = '3853be81c08a2817bc5ed9aa12b130ddae69a820ea183445aebcfb272c9cdb14';
const SOURCE_OPERATIONS = Object.freeze([
  'INTAKE_CAPTURE',
  'STAGE_SOURCE_ARTIFACT_CHUNK',
  'PREPARE_SOURCE_ADMISSION',
]);
const PROTECTED_TABLES = Object.freeze([
  'active_corpus_release_pointer_history',
  'candidate_input_events',
  'candidate_input_head_versions',
  'candidate_input_heads',
  'candidate_release_correction_discharges',
  'candidate_release_correction_input_seals',
  'candidate_release_import_receipts',
  'candidate_release_semantic_graphs',
  'claim_revisions',
  'correction_authority_materialisations',
  'correction_discharge_map_entries',
  'correction_discharge_maps',
  'deal_serving_directory',
  'deals',
  'exact_detail_serving_packages',
  'excerpts',
  'fixture_corpus_releases',
  'incomplete_canonical_result_rows',
  'market_metric_slot_exclusions',
  'market_observations',
  'open_world_candidate_dispositions',
  'open_world_candidate_occurrences',
  'open_world_candidates',
  'open_world_evidence_references',
  'open_world_primitives',
  'provision_components',
  'provision_instances',
  'quarantines',
  'query_response_cache',
  'relationship_revisions',
  'residuals',
  'reviewed_source_specific_rows',
  'reviewed_source_specific_serving_rows',
  'semantic_impact_closures',
  'shared_serving_rows',
  'validated_semantic_graphs',
]);
const SOURCE_TABLES = Object.freeze([
  'intake_capture_receipts',
  'source_artifact_manifests',
  'source_artifact_chunks',
  'canonical_text_conversions',
  'canonical_text_verification_manifests',
  'immutable_source_documents',
  'source_admission_manifests',
  'source_admission_preparation_receipts',
  'semantic_extraction_input_envelopes',
  'write_receipts',
]);
const QXO = Object.freeze({
  intake_capture_receipt_id: 'a2b7d53a00424488fb6653c2519338bdf8ea79d58993bd52abc926f5c15ac2e7',
  source_response_content_id: 'ec3e3587b2d111bb4863bad4729bd73099755e02abf48c17ff0ff95ba6866696',
  artifact_manifest_id: '6fd4ce44ee6de501249e0e8a5646a5ae08319f8b70d77ecc26d3d705769c2d55',
  canonical_text_id: 'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1',
  verification_manifest_id: '2860cdad62db545466464b2961545dd0ff28fadbe0dd97dd60dc1ce206b0f354',
  immutable_source_document_id: '5c6f01b194e7f195a5c5fe48ac88b3cf900656d8dcc70028a3e8f103bba9fc6b',
  source_admission_manifest_id: 'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
  source_admission_preparation_receipt_id: 'eface03ce6774f1465a1ebb560f63a41ed50b4e1a34e7949f8a5c29aa38b3d2c',
  semantic_extraction_input_envelope_id: '9dcc596af6312d3d9ac65cc5266bc564ee00f99d0a6b23a9b5b822813bc3fd07',
  chunk_count: 12,
});

export const SEC_RETRIEVAL_POLICY = Object.freeze({
  schema_version: 'SEC_RETRIEVAL_POLICY/V1',
  user_agent: 'Deal Corpus canonical intake bengoodchild@gmail.com',
  accept: 'text/html',
  accept_encoding: 'identity',
  redirect_limit: 0,
  timeout_ms: 15000,
  maximum_response_bytes: 2 * 1024 * 1024,
});

function assertDigest(value, label, { nullable = false } = {}) {
  if (nullable && value == null) return;
  if (!DIGEST_RE.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest.`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    throw new TypeError(`${label} must match its closed contract.`);
  }
}

export function validateStagingSecSourceProfile(profile) {
  exactKeys(profile, [
    'schema_version',
    'source_key',
    'source_locator_deal_id',
    'source_role',
    'url',
    'required_document_anchors',
    'retrieval_url_sha256',
    'response_bytes_sha256',
    'response_byte_length',
    'intake_idempotency_key',
    'artifact_idempotency_prefix',
    'admission_idempotency_key',
    'expected',
  ], 'staging SEC source profile');
  if (profile.schema_version !== 'STAGING_SEC_SOURCE_PROFILE/V1'
    || !/^[A-Z][A-Z0-9_]{2,63}$/.test(profile.source_key)
    || !UUID_RE.test(profile.source_locator_deal_id || '')
    || profile.source_role !== 'AGREEMENT'
    || typeof profile.url !== 'string'
    || typeof profile.intake_idempotency_key !== 'string'
    || typeof profile.artifact_idempotency_prefix !== 'string'
    || typeof profile.admission_idempotency_key !== 'string') {
    throw new TypeError('Staging SEC source profile has invalid governed fields.');
  }
  const parsed = new URL(profile.url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.sec.gov'
    || parsed.username || parsed.password) {
    throw new TypeError('Staging SEC source URL must be an exact SEC HTTPS URL.');
  }
  assertDigest(profile.retrieval_url_sha256, 'retrieval_url_sha256');
  assertDigest(profile.response_bytes_sha256, 'response_bytes_sha256');
  if (sha256Hex(Buffer.from(profile.url, 'utf8')) !== profile.retrieval_url_sha256
    || !Number.isInteger(profile.response_byte_length)
    || profile.response_byte_length < 1
    || profile.response_byte_length > SEC_RETRIEVAL_POLICY.maximum_response_bytes) {
    throw new TypeError('Staging SEC source URL or byte-length pin is invalid.');
  }
  if (!Array.isArray(profile.required_document_anchors)
    || profile.required_document_anchors.length < 2
    || profile.required_document_anchors.length > 8
    || profile.required_document_anchors.some((anchor) => (
      typeof anchor !== 'string' || anchor.length < 4 || anchor.length > 160
    ))) {
    throw new TypeError('Staging SEC source profile requires bounded document anchors.');
  }
  exactKeys(profile.expected, [
    'retrieval_policy_digest',
    'retrieved_at',
    'source_response_content_id',
    'intake_capture_receipt_id',
    'converter_digest',
    'converter_config_digest',
    'verifier_digest',
    'canonical_text_sha256',
    'canonical_text_byte_length',
    'canonical_text_id',
    'source_map_digest',
    'verification_manifest_id',
    'artifact_manifest_id',
    'artifact_chunk_ids',
    'artifact_chunk_sha256',
    'artifact_chunk_count',
    'immutable_source_document_id',
    'source_admission_manifest_id',
    'source_admission_preparation_receipt_id',
    'semantic_extraction_input_envelope_id',
    'verified_sec_source_admission_bundle_id',
  ], 'staging SEC source expected identities');
  for (const key of [
    'retrieval_policy_digest',
    'source_response_content_id',
    'converter_digest',
    'converter_config_digest',
    'verifier_digest',
    'canonical_text_sha256',
    'canonical_text_id',
    'source_map_digest',
  ]) assertDigest(profile.expected[key], `expected.${key}`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
    profile.expected.retrieved_at || '',
  )) {
    throw new TypeError('expected.retrieved_at must pin one canonical retrieval event.');
  }
  for (const key of [
    'intake_capture_receipt_id',
    'verification_manifest_id',
    'artifact_manifest_id',
    'immutable_source_document_id',
    'source_admission_manifest_id',
    'source_admission_preparation_receipt_id',
    'semantic_extraction_input_envelope_id',
    'verified_sec_source_admission_bundle_id',
  ]) assertDigest(profile.expected[key], `expected.${key}`, { nullable: true });
  if (!Number.isInteger(profile.expected.canonical_text_byte_length)
    || profile.expected.canonical_text_byte_length < 1
    || !Number.isInteger(profile.expected.artifact_chunk_count)
    || profile.expected.artifact_chunk_count < 1
    || !Array.isArray(profile.expected.artifact_chunk_ids)
    || !Array.isArray(profile.expected.artifact_chunk_sha256)
    || profile.expected.artifact_chunk_ids.length
      !== profile.expected.artifact_chunk_sha256.length
    || ![0, profile.expected.artifact_chunk_count]
      .includes(profile.expected.artifact_chunk_ids.length)) {
    throw new TypeError('Staging SEC source expected conversion bounds are invalid.');
  }
  for (const digest of [
    ...profile.expected.artifact_chunk_ids,
    ...profile.expected.artifact_chunk_sha256,
  ]) assertDigest(digest, 'expected artifact chunk identity');
  return true;
}

export function fetchExactSecSource(profile, {
  httpsGet = https.get,
  now = () => new Date().toISOString(),
} = {}) {
  validateStagingSecSourceProfile(profile);
  const requestedAt = now();
  return new Promise((resolveFetch, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const request = httpsGet(profile.url, {
      agent: false,
      headers: {
        'User-Agent': SEC_RETRIEVAL_POLICY.user_agent,
        Accept: SEC_RETRIEVAL_POLICY.accept,
        'Accept-Encoding': SEC_RETRIEVAL_POLICY.accept_encoding,
      },
    }, (response) => {
      const chunks = [];
      let length = 0;
      response.on('aborted', () => finish(reject, new Error('SEC response was aborted.')));
      response.on('error', (error) => finish(reject, error));
      response.on('data', (chunk) => {
        length += chunk.length;
        if (length > SEC_RETRIEVAL_POLICY.maximum_response_bytes) {
          request.destroy(new Error('SEC response exceeded the governed byte limit.'));
        } else {
          chunks.push(chunk);
        }
      });
      response.on('end', () => {
        if (response.complete !== true) {
          finish(reject, new Error('SEC response did not complete.'));
          return;
        }
        const bytes = Buffer.concat(chunks);
        const declaredLength = response.headers['content-length'];
        const contentEncoding = response.headers['content-encoding'];
        if (response.statusCode !== 200 || response.headers.location) {
          finish(reject, new Error('SEC response status or redirect was rejected.'));
          return;
        }
        if (contentEncoding && String(contentEncoding).toLowerCase() !== 'identity') {
          finish(reject, new Error('SEC response content encoding was not identity.'));
          return;
        }
        if (declaredLength != null
          && (!/^(0|[1-9]\d*)$/.test(String(declaredLength))
            || Number(declaredLength) !== bytes.length)) {
          finish(reject, new Error('SEC response content length did not match its bytes.'));
          return;
        }
        if (bytes.length !== profile.response_byte_length
          || sha256Hex(bytes) !== profile.response_bytes_sha256) {
          finish(reject, new Error('SEC response bytes drifted from the frozen source profile.'));
          return;
        }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (profile.required_document_anchors.some((anchor) => !text.includes(anchor))) {
          finish(reject, new Error('SEC response did not contain every governed document anchor.'));
          return;
        }
        finish(resolveFetch, {
          response: {
            status_code: response.statusCode,
            content_type: response.headers['content-type'],
            final_url: profile.url,
            redirect_count: 0,
            response_bytes: bytes,
          },
          retrieved_at: requestedAt,
        });
      });
    });
    request.on('error', (error) => finish(reject, error));
    request.setTimeout(
      SEC_RETRIEVAL_POLICY.timeout_ms,
      () => request.destroy(new Error('SEC retrieval timed out.')),
    );
  });
}

function writerSql(runtime, request) {
  if (!SOURCE_OPERATIONS.includes(request.operation)) {
    throw new Error('The SEC source engine rejected a non-source writer operation.');
  }
  return `SELECT public.canonical_v2_write(
    'staging',
    ${runtime.sqlText(request.operation)},
    ${runtime.sqlText(request.idempotencyKey)},
    ${runtime.sqlText(request.inputDigest)},
    ${runtime.sqlJson(request.writeSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${runtime.sqlJson(request.receipt)}
  ) AS result;`;
}

function runWriter(runtime, request, { commit = false } = {}) {
  const rows = runtime.runSql(writerSql(runtime, request), { commit });
  if (rows.length !== 1 || !rows[0]?.result) {
    throw new Error('Canonical source writer returned an invalid result.');
  }
  return rows[0].result;
}

function assertCapture(profile, capture) {
  validateSecEdgarIntakeCapture(capture);
  const expected = {
    retrieval_url_sha256: profile.retrieval_url_sha256,
    response_bytes_sha256: profile.response_bytes_sha256,
    response_byte_length: profile.response_byte_length,
    source_response_content_id: profile.expected.source_response_content_id,
    retrieval_policy_digest: profile.expected.retrieval_policy_digest,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (capture[key] !== value) throw new Error(`Stored SEC capture ${key} drifted.`);
  }
  if (profile.expected.intake_capture_receipt_id
    && capture.intake_capture_receipt_id
      !== profile.expected.intake_capture_receipt_id) {
    throw new Error('Stored SEC capture receipt identity drifted.');
  }
}

function readStoredCapture(runtime, profile) {
  const rows = runtime.runSql(`SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256=${runtime.sqlText(profile.retrieval_url_sha256)}
  AND response_bytes_sha256=${runtime.sqlText(profile.response_bytes_sha256)}
LIMIT 2;`, { readOnly: true });
  if (rows.length > 1) throw new Error('The exact SEC source capture is duplicated.');
  if (rows.length === 0) return null;
  assertCapture(profile, rows[0].canonical_payload);
  return rows[0].canonical_payload;
}

async function captureForMode(runtime, profile, mode, fetchSource) {
  const stored = readStoredCapture(runtime, profile);
  if (stored) return { capture: stored, alreadyStored: true };
  if (mode === 'VERIFY') throw new Error('The exact SEC source capture is not stored.');
  const fetched = await fetchSource(profile);
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: profile.url,
    ...fetched.response,
    retrieved_at: profile.expected.retrieved_at,
    retrieval_policy_digest: contentId(
      'SEC_RETRIEVAL_POLICY/V1',
      SEC_RETRIEVAL_POLICY,
    ),
  });
  assertCapture(profile, capture);
  return { capture, alreadyStored: false };
}

async function materialiseRequest(writer, input) {
  const dryRun = await writer.write({ ...input, dryRun: true });
  const committed = await writer.write(input);
  return {
    ...input,
    inputDigest: dryRun.inputDigest,
    receipt: committed.receipt,
  };
}

async function buildRequests(profile, capture) {
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  validateVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
    bundle: sourceAdmissionBundle,
  });
  const artifact = buildSourceArtifactChunks(conversion);
  reconstructSourceArtifact({ manifest: artifact.manifest, chunks: artifact.chunks });
  const repository = new InMemoryCanonicalRepository();
  const writer = createCanonicalWriter({ repository });
  const intake = await materialiseRequest(writer, {
    operation: 'INTAKE_CAPTURE',
    idempotencyKey: profile.intake_idempotency_key,
    writeSet: { intake_capture: capture },
  });
  const chunks = [];
  for (const chunk of artifact.chunks) {
    chunks.push(await materialiseRequest(writer, {
      operation: 'STAGE_SOURCE_ARTIFACT_CHUNK',
      idempotencyKey:
        `${profile.artifact_idempotency_prefix}_${artifact.manifest.artifact_manifest_id}_${chunk.chunk_ordinal}`,
      writeSet: {
        source_artifact_manifest: artifact.manifest,
        source_artifact_chunk: chunk,
      },
    }));
  }
  const admission = await materialiseRequest(writer, {
    operation: 'PREPARE_SOURCE_ADMISSION',
    idempotencyKey: profile.admission_idempotency_key,
    writeSet: {
      capture_reference: {
        schema_version: 'INTAKE_CAPTURE_REFERENCE/V1',
        intake_capture_receipt_id: capture.intake_capture_receipt_id,
        source_response_content_id: capture.source_response_content_id,
      },
      conversion_artifact_manifest: artifact.manifest,
      verification,
      source_admission_bundle: sourceAdmissionBundle,
    },
  });
  return {
    capture,
    conversion,
    verification,
    sourceAdmissionBundle,
    artifact,
    intake,
    chunks,
    admission,
  };
}

function assertBuiltPins(profile, built) {
  const bundle = built.sourceAdmissionBundle;
  const values = {
    retrieval_policy_digest: built.capture.retrieval_policy_digest,
    retrieved_at: built.capture.retrieved_at,
    source_response_content_id: built.capture.source_response_content_id,
    intake_capture_receipt_id: built.capture.intake_capture_receipt_id,
    converter_digest: built.conversion.converter_digest,
    converter_config_digest: built.conversion.converter_config_digest,
    verifier_digest: built.verification.verifier_digest,
    canonical_text_sha256: built.conversion.canonical_text_sha256,
    canonical_text_byte_length: built.conversion.canonical_text_byte_length,
    canonical_text_id: built.conversion.canonical_text_id,
    source_map_digest: built.conversion.source_map_digest,
    verification_manifest_id: built.verification.verification_manifest_id,
    artifact_manifest_id: built.artifact.manifest.artifact_manifest_id,
    artifact_chunk_ids: built.artifact.chunks.map((chunk) => chunk.chunk_id),
    artifact_chunk_sha256: built.artifact.chunks.map((chunk) => chunk.chunk_sha256),
    artifact_chunk_count: built.artifact.manifest.chunk_count,
    immutable_source_document_id:
      bundle.immutable_source_document.immutable_source_document_id,
    source_admission_manifest_id:
      bundle.source_admission_manifest.source_admission_manifest_id,
    source_admission_preparation_receipt_id:
      bundle.source_admission_preparation_receipt
        .source_admission_preparation_receipt_id,
    semantic_extraction_input_envelope_id:
      bundle.semantic_extraction_input_envelope
        .semantic_extraction_input_envelope_id,
    verified_sec_source_admission_bundle_id:
      bundle.verified_sec_source_admission_bundle_id,
  };
  for (const [key, expected] of Object.entries(profile.expected)) {
    if (expected != null
      && !(Array.isArray(expected) && expected.length === 0)
      && (!(Array.isArray(expected))
        ? values[key] !== expected
        : canonicalJson(values[key]) !== canonicalJson(expected))) {
      throw new Error(`Built SEC source identity ${key} drifted.`);
    }
  }
}

function requestBounds(runtime, built) {
  const intakeBytes = Buffer.byteLength(writerSql(runtime, built.intake), 'utf8');
  const bounded = [...built.chunks, built.admission]
    .map((request) => Buffer.byteLength(writerSql(runtime, request), 'utf8'));
  if (intakeBytes > runtime.bounds.maxSqlBytes
    || bounded.some((length) => length > MAX_WRITER_REQUEST_BYTES)) {
    throw new Error('A canonical source writer request exceeded its bounded transport limit.');
  }
  return {
    intake_writer_request_byte_length: intakeBytes,
    maximum_bounded_writer_request_byte_length: Math.max(...bounded),
  };
}

function assertWriterDefinition(runtime) {
  const rows = runtime.runSql(
    `SELECT pg_get_functiondef(
      'public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure
    ) AS definition;`,
    { readOnly: true },
  );
  if (rows.length !== 1
    || typeof rows[0]?.definition !== 'string'
    || createHash('sha256').update(rows[0].definition).digest('hex')
      !== WRITER_DEFINITION_SHA256) {
    throw new Error('The deployed canonical source writer definition drifted.');
  }
}

function sourceCounts(runtime) {
  const fields = SOURCE_TABLES.map((table) => (
    `${runtime.sqlText(table)}, (SELECT count(*) FROM canonical_v2_staging.${table})`
  ));
  const rows = runtime.runSql(
    `SELECT jsonb_build_object(${fields.join(', ')}) AS counts;`,
    { readOnly: true },
  );
  if (rows.length !== 1 || !rows[0]?.counts) {
    throw new Error('Canonical source table counts could not be read.');
  }
  return rows[0].counts;
}

function protectedState(runtime) {
  const countFields = PROTECTED_TABLES.map((table) => (
    `${runtime.sqlText(table)}, (SELECT jsonb_build_array(
      count(*),
      encode(extensions.digest(convert_to(coalesce(string_agg(
        canonical_v2_staging.payload_digest(to_jsonb(protected_row)),
        '' ORDER BY canonical_v2_staging.payload_digest(to_jsonb(protected_row))
      ), ''), 'UTF8'), 'sha256'), 'hex')
    ) FROM canonical_v2_staging.${table} AS protected_row)`
  ));
  const rows = runtime.runSql(`SELECT jsonb_build_object(
    'active_pointer', (SELECT canonical_payload
      FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging'),
    'active_pointer_history', (SELECT jsonb_agg(jsonb_build_array(
        pointer_id, canonical_payload_digest, canonical_payload
      ) ORDER BY generation)
      FROM canonical_v2_staging.active_corpus_release_pointer_history
      WHERE environment='staging'),
    'protected_counts', jsonb_build_object(${countFields.join(', ')}),
    'qxo', jsonb_build_object(
      'capture', (SELECT jsonb_build_array(intake_capture_receipt_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.intake_capture_receipts
        WHERE intake_capture_receipt_id=${runtime.sqlText(QXO.intake_capture_receipt_id)}
          AND source_response_content_id=${runtime.sqlText(QXO.source_response_content_id)}),
      'artifact', (SELECT jsonb_build_array(artifact_manifest_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.source_artifact_manifests
        WHERE artifact_manifest_id=${runtime.sqlText(QXO.artifact_manifest_id)}),
      'chunks', (SELECT jsonb_agg(jsonb_build_array(chunk_ordinal, chunk_id,
        canonical_payload_storage_digest) ORDER BY chunk_ordinal)
        FROM canonical_v2_staging.source_artifact_chunks
        WHERE artifact_manifest_id=${runtime.sqlText(QXO.artifact_manifest_id)}),
      'conversion', (SELECT jsonb_build_array(canonical_text_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.canonical_text_conversions
        WHERE canonical_text_id=${runtime.sqlText(QXO.canonical_text_id)}),
      'verification', (SELECT jsonb_build_array(verification_manifest_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.canonical_text_verification_manifests
        WHERE verification_manifest_id=${runtime.sqlText(QXO.verification_manifest_id)}),
      'immutable', (SELECT jsonb_build_array(immutable_source_document_id,
        canonical_payload_digest)
        FROM canonical_v2_staging.immutable_source_documents
        WHERE immutable_source_document_id=${runtime.sqlText(QXO.immutable_source_document_id)}),
      'admission', (SELECT jsonb_build_array(source_admission_manifest_id,
        canonical_payload_digest)
        FROM canonical_v2_staging.source_admission_manifests
        WHERE source_admission_manifest_id=${runtime.sqlText(QXO.source_admission_manifest_id)}),
      'preparation', (SELECT jsonb_build_array(source_admission_preparation_receipt_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.source_admission_preparation_receipts
        WHERE source_admission_preparation_receipt_id=${runtime.sqlText(
    QXO.source_admission_preparation_receipt_id,
  )}),
      'semantic_input', (SELECT jsonb_build_array(semantic_extraction_input_envelope_id,
        canonical_payload_storage_digest)
        FROM canonical_v2_staging.semantic_extraction_input_envelopes
        WHERE semantic_extraction_input_envelope_id=${runtime.sqlText(
    QXO.semantic_extraction_input_envelope_id,
  )})
    )
  ) AS state;`, { readOnly: true });
  const state = rows.length === 1 ? rows[0]?.state : null;
  if (!state?.active_pointer
    || !Array.isArray(state.active_pointer_history)
    || state.active_pointer_history.length < 1
    || !state.qxo?.capture
    || !state.qxo?.artifact
    || !Array.isArray(state.qxo?.chunks)
    || state.qxo.chunks.length !== QXO.chunk_count
    || !state.qxo?.conversion
    || !state.qxo?.verification
    || !state.qxo?.immutable
    || !state.qxo?.admission
    || !state.qxo?.preparation
    || !state.qxo?.semantic_input) {
    throw new Error('The protected active-pointer or QXO source state is incomplete.');
  }
  return state;
}

function physicalValidity(table) {
  const expressions = {
    intake_capture_receipts: `stored.intake_capture_receipt_id =
        stored.canonical_payload->>'intake_capture_receipt_id'
      AND stored.retrieval_url_sha256 =
        stored.canonical_payload->>'retrieval_url_sha256'
      AND stored.response_bytes_sha256 =
        stored.canonical_payload->>'response_bytes_sha256'
      AND stored.response_byte_length =
        (stored.canonical_payload->>'response_byte_length')::bigint
      AND stored.source_response_content_id =
        stored.canonical_payload->>'source_response_content_id'
      AND replace(encode(decode(
        stored.canonical_payload->>'response_bytes_base64', 'base64'
      ), 'base64'), E'\\n', '') =
        stored.canonical_payload->>'response_bytes_base64'`,
    source_artifact_manifests: `stored.artifact_manifest_id =
        stored.canonical_payload->>'artifact_manifest_id'
      AND stored.artifact_kind = stored.canonical_payload->>'artifact_kind'
      AND stored.payload_encoding = stored.canonical_payload->>'payload_encoding'
      AND stored.payload_byte_length =
        (stored.canonical_payload->>'payload_byte_length')::bigint
      AND stored.payload_sha256 = stored.canonical_payload->>'payload_sha256'
      AND stored.chunk_count = (stored.canonical_payload->>'chunk_count')::integer
      AND stored.chunk_max_byte_length =
        (stored.canonical_payload->>'chunk_max_byte_length')::integer
      AND stored.ordered_chunk_sha256 =
        stored.canonical_payload->'ordered_chunk_sha256'`,
    source_artifact_chunks: `stored.artifact_manifest_id =
        stored.canonical_payload->>'artifact_manifest_id'
      AND stored.chunk_ordinal =
        (stored.canonical_payload->>'chunk_ordinal')::integer
      AND stored.artifact_kind = stored.canonical_payload->>'artifact_kind'
      AND stored.chunk_byte_length =
        (stored.canonical_payload->>'chunk_byte_length')::integer
      AND stored.chunk_sha256 = stored.canonical_payload->>'chunk_sha256'
      AND stored.chunk_id = stored.canonical_payload->>'chunk_id'
      AND replace(encode(stored.chunk_payload, 'base64'), E'\\n', '') =
        stored.canonical_payload->>'chunk_payload_base64'
      AND encode(extensions.digest(stored.chunk_payload, 'sha256'), 'hex') =
        stored.chunk_sha256`,
    canonical_text_conversions: `stored.canonical_text_id =
        stored.canonical_payload->>'canonical_text_id'
      AND stored.intake_capture_receipt_id =
        stored.canonical_payload->>'intake_capture_receipt_id'
      AND stored.source_response_content_id =
        stored.canonical_payload->>'source_response_content_id'
      AND stored.canonical_text_sha256 =
        stored.canonical_payload->>'canonical_text_sha256'
      AND stored.canonical_text_byte_length =
        (stored.canonical_payload->>'canonical_text_byte_length')::bigint`,
    canonical_text_verification_manifests: `stored.verification_manifest_id =
        stored.canonical_payload->>'verification_manifest_id'
      AND stored.canonical_text_id =
        stored.canonical_payload->>'canonical_text_id'
      AND stored.intake_capture_receipt_id =
        stored.canonical_payload->>'intake_capture_receipt_id'`,
    immutable_source_documents: `stored.immutable_source_document_id =
      stored.canonical_payload->>'immutable_source_document_id'`,
    source_admission_manifests: `stored.source_admission_manifest_id =
      stored.canonical_payload->>'source_admission_manifest_id'`,
    source_admission_preparation_receipts:
      `stored.source_admission_preparation_receipt_id =
        stored.canonical_payload->>'source_admission_preparation_receipt_id'
      AND stored.immutable_source_document_id =
        stored.canonical_payload->>'immutable_source_document_id'
      AND stored.source_admission_manifest_id =
        stored.canonical_payload->>'source_admission_manifest_id'
      AND stored.verification_manifest_id =
        stored.canonical_payload->>'verification_manifest_id'`,
    semantic_extraction_input_envelopes:
      `stored.semantic_extraction_input_envelope_id =
        stored.canonical_payload->>'semantic_extraction_input_envelope_id'
      AND stored.immutable_source_document_id =
        stored.canonical_payload->>'immutable_source_document_id'
      AND stored.source_admission_manifest_id =
        stored.canonical_payload->>'source_admission_manifest_id'
      AND stored.verification_manifest_id =
        stored.canonical_payload->>'verification_manifest_id'
      AND stored.canonical_text_id =
        stored.canonical_payload->>'canonical_text_id'`,
  };
  if (!expressions[table]) throw new Error(`No physical source contract for ${table}.`);
  return expressions[table];
}

function readExactRows(runtime, table, idColumn, ids) {
  const digestColumn = ['immutable_source_documents', 'source_admission_manifests']
    .includes(table)
    ? 'canonical_payload_digest'
    : 'canonical_payload_storage_digest';
  const rows = runtime.runSql(`SELECT stored.${idColumn} AS id,
  stored.canonical_payload,
  stored.${digestColumn} =
    canonical_v2_staging.payload_digest(stored.canonical_payload) AS digest_valid,
  (${physicalValidity(table)}) AS physical_valid
FROM canonical_v2_staging.${table} AS stored
WHERE stored.${idColumn} IN (${ids.map(runtime.sqlText).join(', ')})
ORDER BY stored.${idColumn};`, { readOnly: true });
  if (rows.length !== ids.length
    || rows.some((row) => row.digest_valid !== true || row.physical_valid !== true)) {
    throw new Error(`Stored ${table} payload set is incomplete or invalid.`);
  }
  return rows;
}

function assertExactReceipts(runtime, built) {
  const requests = [built.intake, ...built.chunks, built.admission];
  const rows = runtime.runSql(`SELECT receipt_id AS id, canonical_payload,
  operation = canonical_payload->>'operation'
    AND idempotency_key = canonical_payload->>'idempotencyKey'
    AND input_digest = canonical_payload->>'inputDigest'
    AND receipt_id = canonical_payload->>'receiptId' AS physical_valid
FROM canonical_v2_staging.write_receipts
WHERE receipt_id IN (${requests.map((request) => (
    runtime.sqlText(request.receipt.receiptId)
  )).join(', ')})
ORDER BY receipt_id;`, { readOnly: true });
  if (rows.length !== requests.length
    || rows.some((row) => row.physical_valid !== true)) {
    throw new Error('Stored canonical source write receipts are incomplete or invalid.');
  }
  const byId = new Map(rows.map((row) => [row.id, row.canonical_payload]));
  for (const request of requests) {
    if (canonicalJson(byId.get(request.receipt.receiptId))
      !== canonicalJson(request.receipt)) {
      throw new Error('Stored canonical source write receipt payload drifted.');
    }
  }
}

function sourcePresence(runtime, built) {
  const bundle = built.sourceAdmissionBundle;
  const requests = [built.intake, ...built.chunks, built.admission]
    .map((request) => ({
      operation: request.operation,
      idempotency_key: request.idempotencyKey,
      input_digest: request.inputDigest,
      receipt_id: request.receipt.receiptId,
    }));
  const rows = runtime.runSql(`SELECT jsonb_build_object(
    'intake_capture_receipts', EXISTS (
      SELECT 1 FROM canonical_v2_staging.intake_capture_receipts
      WHERE intake_capture_receipt_id=${runtime.sqlText(
    built.capture.intake_capture_receipt_id,
  )}),
    'source_artifact_manifests', EXISTS (
      SELECT 1 FROM canonical_v2_staging.source_artifact_manifests
      WHERE artifact_manifest_id=${runtime.sqlText(
    built.artifact.manifest.artifact_manifest_id,
  )}),
    'source_artifact_chunks', (
      SELECT count(*) FROM canonical_v2_staging.source_artifact_chunks
      WHERE artifact_manifest_id=${runtime.sqlText(
    built.artifact.manifest.artifact_manifest_id,
  )}),
    'canonical_text_conversions', EXISTS (
      SELECT 1 FROM canonical_v2_staging.canonical_text_conversions
      WHERE canonical_text_id=${runtime.sqlText(built.conversion.canonical_text_id)}),
    'canonical_text_verification_manifests', EXISTS (
      SELECT 1 FROM canonical_v2_staging.canonical_text_verification_manifests
      WHERE verification_manifest_id=${runtime.sqlText(
    built.verification.verification_manifest_id,
  )}),
    'immutable_source_documents', EXISTS (
      SELECT 1 FROM canonical_v2_staging.immutable_source_documents
      WHERE immutable_source_document_id=${runtime.sqlText(
    bundle.immutable_source_document.immutable_source_document_id,
  )}),
    'source_admission_manifests', EXISTS (
      SELECT 1 FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id=${runtime.sqlText(
    bundle.source_admission_manifest.source_admission_manifest_id,
  )}),
    'source_admission_preparation_receipts', EXISTS (
      SELECT 1 FROM canonical_v2_staging.source_admission_preparation_receipts
      WHERE source_admission_preparation_receipt_id=${runtime.sqlText(
    bundle.source_admission_preparation_receipt
      .source_admission_preparation_receipt_id,
  )}),
    'semantic_extraction_input_envelopes', EXISTS (
      SELECT 1 FROM canonical_v2_staging.semantic_extraction_input_envelopes
      WHERE semantic_extraction_input_envelope_id=${runtime.sqlText(
    bundle.semantic_extraction_input_envelope
      .semantic_extraction_input_envelope_id,
  )}),
    'write_receipts', (
      SELECT count(*)
      FROM canonical_v2_staging.write_receipts AS stored
      JOIN jsonb_to_recordset(${runtime.sqlJson(requests)}) AS expected(
        operation text,
        idempotency_key text,
        input_digest text,
        receipt_id text
      ) ON stored.operation=expected.operation
        AND stored.idempotency_key=expected.idempotency_key
        AND stored.input_digest=expected.input_digest
        AND stored.receipt_id=expected.receipt_id
    )
  ) AS presence;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.presence) {
    throw new Error('Exact canonical source presence could not be read.');
  }
  return rows[0].presence;
}

function assertAllowedSourceDelta(beforeCounts, afterCounts, beforePresence, built) {
  const expected = {
    intake_capture_receipts: beforePresence.intake_capture_receipts ? 0 : 1,
    source_artifact_manifests: beforePresence.source_artifact_manifests ? 0 : 1,
    source_artifact_chunks:
      built.artifact.manifest.chunk_count - Number(beforePresence.source_artifact_chunks),
    canonical_text_conversions: beforePresence.canonical_text_conversions ? 0 : 1,
    canonical_text_verification_manifests:
      beforePresence.canonical_text_verification_manifests ? 0 : 1,
    immutable_source_documents: beforePresence.immutable_source_documents ? 0 : 1,
    source_admission_manifests: beforePresence.source_admission_manifests ? 0 : 1,
    source_admission_preparation_receipts:
      beforePresence.source_admission_preparation_receipts ? 0 : 1,
    semantic_extraction_input_envelopes:
      beforePresence.semantic_extraction_input_envelopes ? 0 : 1,
    write_receipts:
      built.artifact.manifest.chunk_count + 2 - Number(beforePresence.write_receipts),
  };
  for (const table of SOURCE_TABLES) {
    const actual = Number(afterCounts[table]) - Number(beforeCounts[table]);
    if (actual !== expected[table]) {
      throw new Error(`Canonical source table ${table} changed outside its exact allowance.`);
    }
  }
}

function assertExactStored(runtime, built) {
  const bundle = built.sourceAdmissionBundle;
  const singletonSpecs = [
    ['intake_capture_receipts', 'intake_capture_receipt_id',
      built.capture.intake_capture_receipt_id, built.capture],
    ['source_artifact_manifests', 'artifact_manifest_id',
      built.artifact.manifest.artifact_manifest_id, built.artifact.manifest],
    ['canonical_text_conversions', 'canonical_text_id',
      built.conversion.canonical_text_id, built.conversion],
    ['canonical_text_verification_manifests', 'verification_manifest_id',
      built.verification.verification_manifest_id, built.verification],
    ['immutable_source_documents', 'immutable_source_document_id',
      bundle.immutable_source_document.immutable_source_document_id,
      bundle.immutable_source_document],
    ['source_admission_manifests', 'source_admission_manifest_id',
      bundle.source_admission_manifest.source_admission_manifest_id,
      bundle.source_admission_manifest],
    ['source_admission_preparation_receipts',
      'source_admission_preparation_receipt_id',
      bundle.source_admission_preparation_receipt
        .source_admission_preparation_receipt_id,
      bundle.source_admission_preparation_receipt],
    ['semantic_extraction_input_envelopes',
      'semantic_extraction_input_envelope_id',
      bundle.semantic_extraction_input_envelope
        .semantic_extraction_input_envelope_id,
      bundle.semantic_extraction_input_envelope],
  ];
  for (const [table, column, id, expected] of singletonSpecs) {
    const rows = readExactRows(runtime, table, column, [id]);
    if (canonicalJson(rows[0].canonical_payload) !== canonicalJson(expected)) {
      throw new Error(`Stored ${table} payload drifted from the rebuilt source chain.`);
    }
  }
  const chunkRows = readExactRows(
    runtime,
    'source_artifact_chunks',
    'chunk_id',
    built.artifact.chunks.map((chunk) => chunk.chunk_id),
  );
  const storedChunks = new Map(
    chunkRows.map((row) => [row.id, row.canonical_payload]),
  );
  for (const chunk of built.artifact.chunks) {
    if (canonicalJson(storedChunks.get(chunk.chunk_id)) !== canonicalJson(chunk)) {
      throw new Error('Stored source artifact chunk drifted from its exact payload.');
    }
  }
  assertExactReceipts(runtime, built);
}

function assertUnchanged(before, after, label) {
  if (canonicalJson(before) !== canonicalJson(after)) {
    throw new Error(`${label} changed unexpectedly.`);
  }
}

function assertReplay(result, expected) {
  if (result.replayed !== expected) {
    throw new Error(`Canonical source writer replay state was not ${expected}.`);
  }
}

function attestation(
  profile,
  built,
  mode,
  bounds,
  { replayVerified, admissionRollbackVerified },
) {
  const bundle = built.sourceAdmissionBundle;
  return {
    schema_version: 'STAGING_SEC_SOURCE_ADMISSION_ATTESTATION/V1',
    environment: 'staging',
    mode,
    source_key: profile.source_key,
    source_locator_deal_id: profile.source_locator_deal_id,
    source_role: profile.source_role,
    deal_membership_status: 'NOT_ATTEMPTED',
    retrieval_url_sha256: built.capture.retrieval_url_sha256,
    document_hash: built.capture.response_bytes_sha256,
    response_byte_length: built.capture.response_byte_length,
    source_response_content_id: built.capture.source_response_content_id,
    intake_capture_receipt_id: built.capture.intake_capture_receipt_id,
    converter_digest: built.conversion.converter_digest,
    converter_config_digest: built.conversion.converter_config_digest,
    verifier_digest: built.verification.verifier_digest,
    canonical_text_id: built.conversion.canonical_text_id,
    canonical_text_sha256: built.conversion.canonical_text_sha256,
    canonical_text_byte_length: built.conversion.canonical_text_byte_length,
    source_map_digest: built.conversion.source_map_digest,
    verification_manifest_id: built.verification.verification_manifest_id,
    conversion_artifact_manifest_id: built.artifact.manifest.artifact_manifest_id,
    conversion_artifact_chunk_count: built.artifact.manifest.chunk_count,
    immutable_source_document_id:
      bundle.immutable_source_document.immutable_source_document_id,
    source_admission_manifest_id:
      bundle.source_admission_manifest.source_admission_manifest_id,
    source_admission_preparation_receipt_id:
      bundle.source_admission_preparation_receipt
        .source_admission_preparation_receipt_id,
    semantic_extraction_input_envelope_id:
      bundle.semantic_extraction_input_envelope
        .semantic_extraction_input_envelope_id,
    verified_sec_source_admission_bundle_id:
      bundle.verified_sec_source_admission_bundle_id,
    admission_state: bundle.source_admission_manifest.admission_state,
    semantic_extraction_status:
      bundle.semantic_extraction_input_envelope.semantic_extraction_status,
    intake_writer_request_byte_length:
      bounds.intake_writer_request_byte_length,
    maximum_bounded_writer_request_byte_length:
      bounds.maximum_bounded_writer_request_byte_length,
    writer_definition_sha256: WRITER_DEFINITION_SHA256,
    local_dry_run_complete: true,
    rollback_first: mode === 'APPLY',
    admission_rollback_verified: admissionRollbackVerified,
    replay_verified: replayVerified,
    active_pointer_unchanged: true,
    qxo_source_chain_unchanged: true,
    protected_canonical_state_unchanged: true,
  };
}

export async function runStagingSecSource({
  root,
  profile,
  mode,
  fetchSource = fetchExactSecSource,
} = {}) {
  validateStagingSecSourceProfile(profile);
  if (!['DRY_RUN', 'APPLY', 'VERIFY'].includes(mode)) {
    throw new TypeError('Staging SEC source mode is invalid.');
  }
  const runtime = createCanonicalV2StagingRuntime({
    root,
    tempPrefix: `canonical-v2-${profile.source_key.toLowerCase()}-`,
    operationLabel: `${profile.source_key} source admission`,
    bounds: {
      maxResponseBytes: 6 * 1024 * 1024,
      maxProcessBufferBytes: 8 * 1024 * 1024,
    },
  });
  runtime.guardProject();
  assertWriterDefinition(runtime);
  const { capture } = await captureForMode(
    runtime,
    profile,
    mode,
    fetchSource,
  );
  const built = await buildRequests(profile, capture);
  const rebuilt = await buildRequests(profile, capture);
  if (canonicalJson(built) !== canonicalJson(rebuilt)) {
    throw new Error('Canonical source construction was not deterministic.');
  }
  assertBuiltPins(profile, built);
  const bounds = requestBounds(runtime, built);
  const protectedBefore = protectedState(runtime);
  const countsBefore = sourceCounts(runtime);
  const presenceBefore = sourcePresence(runtime, built);
  let replayVerified = false;
  let admissionRollbackVerified = false;

  if (mode === 'DRY_RUN') {
    const requests = [built.intake, ...built.chunks];
    for (const request of requests) runWriter(runtime, request);
    if (presenceBefore.intake_capture_receipts
      && presenceBefore.source_artifact_manifests
      && Number(presenceBefore.source_artifact_chunks)
        === built.artifact.manifest.chunk_count) {
      runWriter(runtime, built.admission);
      admissionRollbackVerified = true;
    }
    assertUnchanged(countsBefore, sourceCounts(runtime), 'Rollback-first source state');
  } else if (mode === 'APPLY') {
    const requests = [built.intake, ...built.chunks];
    for (const request of requests) {
      const beforeRollback = sourceCounts(runtime);
      runWriter(runtime, request);
      assertUnchanged(
        beforeRollback,
        sourceCounts(runtime),
        'Rollback-first source writer state',
      );
      const committed = runWriter(runtime, request, { commit: true });
      if (committed.replayed !== true && committed.replayed !== false) {
        throw new Error('Canonical source writer returned no replay state.');
      }
    }
    const beforeAdmissionRollback = sourceCounts(runtime);
    runWriter(runtime, built.admission);
    admissionRollbackVerified = true;
    assertUnchanged(
      beforeAdmissionRollback,
      sourceCounts(runtime),
      'Rollback-first source admission state',
    );
    const admissionResult = runWriter(runtime, built.admission, { commit: true });
    if (admissionResult.replayed !== true && admissionResult.replayed !== false) {
      throw new Error('Canonical source admission returned no replay state.');
    }
    assertExactStored(runtime, built);
    assertAllowedSourceDelta(
      countsBefore,
      sourceCounts(runtime),
      presenceBefore,
      built,
    );
    const beforeReplay = sourceCounts(runtime);
    for (const request of [...requests, built.admission]) {
      assertReplay(runWriter(runtime, request, { commit: true }), true);
    }
    assertUnchanged(beforeReplay, sourceCounts(runtime), 'Idempotent source replay state');
    replayVerified = true;
  } else {
    assertExactStored(runtime, built);
    const beforeReplay = sourceCounts(runtime);
    for (const request of [built.intake, ...built.chunks, built.admission]) {
      assertReplay(runWriter(runtime, request, { commit: true }), true);
    }
    assertUnchanged(beforeReplay, sourceCounts(runtime), 'Verified source replay state');
    replayVerified = true;
  }

  assertUnchanged(
    protectedBefore,
    protectedState(runtime),
    'Protected canonical, pointer or QXO state',
  );
  if (mode !== 'DRY_RUN') assertExactStored(runtime, built);
  return attestation(profile, built, mode, bounds, {
    replayVerified,
    admissionRollbackVerified,
  });
}

export const STAGING_SEC_SOURCE_CONSTANTS = Object.freeze({
  CHUNK_MAX_BYTE_LENGTH,
  CONFIG_DIGEST,
  CONVERTER_DIGEST,
  MAX_WRITER_REQUEST_BYTES,
  QXO,
  SEC_RETRIEVAL_POLICY_DIGEST: contentId(
    'SEC_RETRIEVAL_POLICY/V1',
    SEC_RETRIEVAL_POLICY,
  ),
  SOURCE_OPERATIONS,
  VERIFIER_DIGEST,
  WRITER_DEFINITION_SHA256,
});
