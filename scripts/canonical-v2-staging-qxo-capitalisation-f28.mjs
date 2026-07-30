#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  compileFixtureContractV13,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoCapitalisationParserSourceClosureF27,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-parser-source-closure-f27',
);
const {
  buildQxoReviewedCapitalisationF28,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f28');
const {
  buildQxoCapitalisationCrossViewReleaseF28,
  compileQxoCapitalisationF28MarketRequest,
  validateQxoCapitalisationCrossViewReleaseF28,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-cross-view-release-f28',
);
const {
  buildQxoCapitalisationF28CandidateEnvelope,
  validateQxoCapitalisationF28CandidateEnvelope,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope',
);
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const {
  requireVerticalSliceExecutionPermission,
} = require('../lib/programme-gates/vertical-slice-permission');
const {
  buildF27Inputs,
} = require(
  '../tests/fixtures/canonical-v2/qxo-capitalisation-f27-inputs',
);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const DEAL_KEY = 'deal:qxo-topbuild';
const ADMITTED_SOURCE = Object.freeze({
  immutable_source_document_id:
    '5c6f01b194e7f195a5c5fe48ac88b3cf900656d8dcc70028a3e8f103bba9fc6b',
  source_admission_manifest_id:
    'f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819',
  semantic_extraction_input_envelope_id:
    '9dcc596af6312d3d9ac65cc5266bc564ee00f99d0a6b23a9b5b822813bc3fd07',
  canonical_text_id:
    'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1',
  document_hash:
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const MAX_PROBE_RECORDS = 30;
const MAX_PROBE_PAYLOAD_BYTES = 1024 * 1024;
const MAX_RESULT_BYTES = 128 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function safeDiagnostic(output) {
  const text = String(output || '');
  const allowed = [
    'F28 probe payload failed its bounded shape contract',
    'F28 metric slots were missing, reordered or aggregated',
    'canceling statement due to statement timeout',
    'canceling statement due to lock timeout',
  ].find((message) => text.includes(message));
  return allowed
    || 'F28 staging proof failed without publishing database diagnostics.';
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
  if (
    ref !== PROJECT.ref
    || linked.ref !== PROJECT.ref
    || linked.name !== PROJECT.name
  ) {
    throw new Error(
      `Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`,
    );
  }
}

function fixtureSupabaseExecutable() {
  const configured =
    process.env.CANONICAL_V2_F28_FIXTURE_SUPABASE_EXECUTABLE;
  if (!configured || !isAbsolute(configured)) {
    throw new Error(
      'Fixture rollback requires an absolute '
        + 'CANONICAL_V2_F28_FIXTURE_SUPABASE_EXECUTABLE.',
    );
  }
  const temporaryRoot = realpathSync(tmpdir());
  const executable = realpathSync(configured);
  const relativeToTemporaryRoot = relative(temporaryRoot, executable);
  if (
    relativeToTemporaryRoot === ''
    || relativeToTemporaryRoot.startsWith('..')
    || isAbsolute(relativeToTemporaryRoot)
    || lstatSync(configured).isSymbolicLink()
    || !lstatSync(configured).isFile()
  ) {
    throw new Error(
      'Fixture rollback executable must be a non-symlink file '
        + 'inside the operating-system temporary directory.',
    );
  }
  return executable;
}

function buildCandidate(inputs) {
  const reviewedGraph = buildQxoReviewedCapitalisationF28(inputs);
  const release = buildQxoCapitalisationCrossViewReleaseF28({
    reviewedGraph,
    ...inputs,
  });
  validateQxoCapitalisationCrossViewReleaseF28({
    candidate: release,
    reviewedGraph,
    ...inputs,
  });
  const request = compileQxoCapitalisationF28MarketRequest({ release });
  const envelopeInput = {
    qxo_cross_view_release: release,
    reviewed_graph: reviewedGraph,
    source_context: inputs.sourceContext,
    parser_source_closure: inputs.parserSourceClosure,
    contract_bundle: inputs.contractBundle,
  };
  const candidateEnvelope =
    buildQxoCapitalisationF28CandidateEnvelope(envelopeInput);
  validateQxoCapitalisationF28CandidateEnvelope(
    candidateEnvelope,
    envelopeInput,
  );
  if (
    release.admissions.length !== 14
    || release.observations.length !== 13
    || release.exclusions.length !== 1
    || release.provision_row.subrows.length !== 6
    || release.manifest.release_state !== 'INACTIVE_CANDIDATE'
    || release.manifest.status.publication_blocked !== true
    || Object.values(release.manifest.authority).some(
      (authority) => authority !== 'NONE',
    )
    || request.metric_bindings.length !== 14
    || request.database_call_budget !== 1
    || request.immediate_retries !== 0
  ) {
    throw new Error('The locally built F28 candidate is not execution-safe.');
  }
  const sourceBinding =
    inputs.sourceContext.immutable_source_document_id
        === ADMITTED_SOURCE.immutable_source_document_id
      && inputs.sourceContext.source_admission_manifest_id
        === ADMITTED_SOURCE.source_admission_manifest_id
      && inputs.sourceContext.canonical_text_id
        === ADMITTED_SOURCE.canonical_text_id
      && inputs.sourceContext.document_hash
        === ADMITTED_SOURCE.document_hash
      ? 'ADMITTED_QXO_IMMUTABLE_SOURCE'
      : 'UNIT_TEST_EXACT_TEXT_FIXTURE';
  return {
    inputs,
    reviewedGraph,
    release,
    request,
    candidateEnvelope,
    sourceBinding,
  };
}

function terminalId(value) {
  return value.market_observation_id
    || value.market_metric_slot_exclusion_id;
}

function buildProbeRecords(release) {
  const records = [
    {
      record_kind: 'RELEASE_MANIFEST',
      record_id: release.manifest.release_manifest_id,
      release_id: release.release_id,
      display_ordinal: null,
      metric_serving_admission_id: null,
      governed_deal_key: null,
      canonical_payload: release.manifest,
    },
    ...release.admissions.map((entry) => ({
      record_kind: 'METRIC_ADMISSION',
      record_id: entry.metric_serving_admission_id,
      release_id: release.release_id,
      display_ordinal: entry.display_ordinal,
      metric_serving_admission_id: entry.metric_serving_admission_id,
      governed_deal_key: null,
      canonical_payload: entry,
    })),
    ...release.observations.map((entry) => ({
      record_kind: 'MARKET_OBSERVATION',
      record_id: entry.market_observation_id,
      release_id: release.release_id,
      display_ordinal: null,
      metric_serving_admission_id:
        entry.metric_serving_admission_id,
      governed_deal_key: entry.governed_deal_key,
      canonical_payload: entry,
    })),
    ...release.exclusions.map((entry) => ({
      record_kind: 'METRIC_SLOT_EXCLUSION',
      record_id: terminalId(entry),
      release_id: release.release_id,
      display_ordinal: null,
      metric_serving_admission_id:
        entry.metric_serving_admission_id,
      governed_deal_key: entry.governed_deal_key,
      canonical_payload: entry,
    })),
    {
      record_kind: 'PROVISION_ROW',
      record_id: release.provision_row.provision_row_id,
      release_id: release.release_id,
      display_ordinal: null,
      metric_serving_admission_id: null,
      governed_deal_key: release.provision_row.governed_deal_key,
      canonical_payload: release.provision_row,
    },
  ];
  const payloadBytes = Buffer.byteLength(canonicalJson(records), 'utf8');
  if (
    records.length !== MAX_PROBE_RECORDS
    || payloadBytes > MAX_PROBE_PAYLOAD_BYTES
    || new Set(records.map((entry) => entry.record_id)).size
      !== records.length
    || records.some((entry) => entry.release_id !== release.release_id)
  ) {
    throw new Error('The bounded F28 staging payload is invalid.');
  }
  return { records, payloadBytes };
}

function sqlJson(value) {
  const json = canonicalJson(value);
  const tag = `$f28_${createHash('sha256')
    .update(json)
    .digest('hex')
    .slice(0, 16)}$`;
  if (json.includes(tag)) {
    throw new Error('Unable to construct a safe F28 JSON literal.');
  }
  return `${tag}${json}${tag}::jsonb`;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expectedMetricRead(release) {
  const terminalByAdmission = new Map([
    ...release.observations,
    ...release.exclusions,
  ].map((entry) => [entry.metric_serving_admission_id, entry]));
  return release.admissions.map((entry) => {
    const terminal = terminalByAdmission.get(
      entry.metric_serving_admission_id,
    );
    return {
      display_ordinal: entry.display_ordinal,
      metric_serving_admission_id: entry.metric_serving_admission_id,
      metric_admissions: 1,
      subject_market_observations:
        terminal.schema_version === 'MARKET_OBSERVATION_F28/V1' ? 1 : 0,
      subject_slot_exclusions:
        terminal.schema_version
          === 'MARKET_METRIC_SLOT_EXCLUSION_F28/V1'
          ? 1
          : 0,
      independent_market_observations: 0,
    };
  });
}

function buildRollbackProofSql(candidate, permission) {
  const { release } = candidate;
  const { records } = buildProbeRecords(release);
  return `BEGIN;
SET LOCAL lock_timeout='2000ms';
SET LOCAL statement_timeout='15000ms';
CREATE TEMP TABLE qxo_capitalisation_f28_guard ON COMMIT DROP AS
SELECT
  (SELECT to_jsonb(pointer)
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE environment='staging') AS active_pointer,
  (SELECT count(*)
    FROM canonical_v2_staging.fixture_corpus_releases
    WHERE corpus_release_id=${sqlText(release.release_id)}) AS release_rows,
  (SELECT count(*)
    FROM canonical_v2_staging.market_observations
    WHERE corpus_release_id=${sqlText(release.release_id)}) AS observation_rows,
  (SELECT count(*)
    FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id=${sqlText(release.release_id)}) AS serving_rows;
SAVEPOINT qxo_capitalisation_f28_probe_start;
CREATE TEMP TABLE qxo_capitalisation_f28_probe (
  record_kind text NOT NULL,
  record_id text NOT NULL CHECK (record_id ~ '^[a-f0-9]{64}$'),
  release_id text NOT NULL CHECK (release_id ~ '^[a-f0-9]{64}$'),
  display_ordinal integer,
  metric_serving_admission_id text,
  governed_deal_key text,
  canonical_payload jsonb NOT NULL,
  PRIMARY KEY (record_kind, record_id)
) ON COMMIT DROP;
INSERT INTO qxo_capitalisation_f28_probe (
  record_kind,
  record_id,
  release_id,
  display_ordinal,
  metric_serving_admission_id,
  governed_deal_key,
  canonical_payload
)
SELECT
  record_kind,
  record_id,
  release_id,
  display_ordinal,
  metric_serving_admission_id,
  governed_deal_key,
  canonical_payload
FROM jsonb_to_recordset(${sqlJson(records)}) AS input(
  record_kind text,
  record_id text,
  release_id text,
  display_ordinal integer,
  metric_serving_admission_id text,
  governed_deal_key text,
  canonical_payload jsonb
);
DO $f28_validate$
DECLARE
  metric_read jsonb;
BEGIN
  IF (SELECT count(*) FROM qxo_capitalisation_f28_probe)
      <> ${MAX_PROBE_RECORDS}
    OR (SELECT count(*) FROM qxo_capitalisation_f28_probe
      WHERE record_kind='RELEASE_MANIFEST') <> 1
    OR (SELECT count(*) FROM qxo_capitalisation_f28_probe
      WHERE record_kind='METRIC_ADMISSION') <> 14
    OR (SELECT count(*) FROM qxo_capitalisation_f28_probe
      WHERE record_kind='MARKET_OBSERVATION') <> 13
    OR (SELECT count(*) FROM qxo_capitalisation_f28_probe
      WHERE record_kind='METRIC_SLOT_EXCLUSION') <> 1
    OR (SELECT count(*) FROM qxo_capitalisation_f28_probe
      WHERE record_kind='PROVISION_ROW') <> 1
    OR EXISTS (
      SELECT 1
      FROM qxo_capitalisation_f28_probe
      WHERE release_id <> ${sqlText(release.release_id)}
    ) THEN
    RAISE EXCEPTION 'F28 probe payload failed its bounded shape contract';
  END IF;

  SELECT jsonb_agg(to_jsonb(metric_counts) ORDER BY display_ordinal)
  INTO metric_read
  FROM (
    SELECT
      admission.display_ordinal,
      admission.metric_serving_admission_id,
      1::integer AS metric_admissions,
      count(terminal.record_id) FILTER (
        WHERE terminal.record_kind='MARKET_OBSERVATION'
          AND terminal.governed_deal_key=${sqlText(DEAL_KEY)}
      )::integer AS subject_market_observations,
      count(terminal.record_id) FILTER (
        WHERE terminal.record_kind='METRIC_SLOT_EXCLUSION'
          AND terminal.governed_deal_key=${sqlText(DEAL_KEY)}
      )::integer AS subject_slot_exclusions,
      count(terminal.record_id) FILTER (
        WHERE terminal.record_kind='MARKET_OBSERVATION'
          AND terminal.governed_deal_key<>${sqlText(DEAL_KEY)}
      )::integer AS independent_market_observations
    FROM qxo_capitalisation_f28_probe admission
    LEFT JOIN qxo_capitalisation_f28_probe terminal
      ON terminal.metric_serving_admission_id =
        admission.metric_serving_admission_id
      AND terminal.record_kind IN (
        'MARKET_OBSERVATION',
        'METRIC_SLOT_EXCLUSION'
      )
    WHERE admission.record_kind='METRIC_ADMISSION'
    GROUP BY
      admission.display_ordinal,
      admission.metric_serving_admission_id
  ) AS metric_counts;

  IF metric_read <> ${sqlJson(expectedMetricRead(release))} THEN
    RAISE EXCEPTION 'F28 metric slots were missing, reordered or aggregated';
  END IF;
END
$f28_validate$;
ROLLBACK TO SAVEPOINT qxo_capitalisation_f28_probe_start;
SELECT jsonb_build_object(
  'schema_version', 'QXO_CAPITALISATION_STAGING_PROOF_F28/V1',
  'project_ref', ${sqlText(PROJECT.ref)},
  'release_id', ${sqlText(release.release_id)},
  'release_manifest_id', ${sqlText(release.manifest.release_manifest_id)},
  'provision_row_id', ${sqlText(release.provision_row.provision_row_id)},
  'candidate_envelope_id',
    ${sqlText(candidate.candidateEnvelope.qxo_capitalisation_f28_candidate_envelope_id)},
  'reviewed_graph_payload_digest',
    ${sqlText(release.manifest.reviewed_graph_payload_digest)},
  'source_binding', ${sqlText(candidate.sourceBinding)},
  'source_context_id',
    ${sqlText(candidate.inputs.sourceContext.admitted_semantic_source_context_id)},
  'document_hash', ${sqlText(candidate.inputs.sourceContext.document_hash)},
  'programme_status_generation', ${permission.generation},
  'programme_status_main_commit', ${sqlText(permission.origin_main_commit)},
  'programme_status_publication_commit',
    ${sqlText(permission.publication_commit)},
  'vertical_slice_execution', ${sqlText(permission.vertical_slice_execution)},
  'probe_records', ${MAX_PROBE_RECORDS},
  'metric_slots', 14,
  'set_based_insert_statements', 1,
  'set_based_metric_reads', 1,
  'subject_exclusion_verified', true,
  'active_pointer_unchanged',
    (SELECT active_pointer FROM qxo_capitalisation_f28_guard)
    IS NOT DISTINCT FROM
    (SELECT to_jsonb(pointer)
      FROM canonical_v2_staging.active_corpus_release_pointers pointer
      WHERE environment='staging'),
  'candidate_counts_unchanged',
    (SELECT jsonb_build_array(release_rows, observation_rows, serving_rows)
      FROM qxo_capitalisation_f28_guard)
    IS NOT DISTINCT FROM
    jsonb_build_array(
      (SELECT count(*)
        FROM canonical_v2_staging.fixture_corpus_releases
        WHERE corpus_release_id=${sqlText(release.release_id)}),
      (SELECT count(*)
        FROM canonical_v2_staging.market_observations
        WHERE corpus_release_id=${sqlText(release.release_id)}),
      (SELECT count(*)
        FROM canonical_v2_staging.shared_serving_rows
        WHERE corpus_release_id=${sqlText(release.release_id)})
    ),
  'probe_rolled_back',
    to_regclass('pg_temp.qxo_capitalisation_f28_probe') IS NULL,
  'durable_candidate_writes', 0,
  'active_pointer_writes', 0,
  'database_calls_per_market_request', 1,
  'immediate_retries', 0
) AS attestation;
ROLLBACK;
`;
}

function runLinkedSql(
  sql,
  {
    executable = 'supabase',
    fileName,
    maxBuffer,
    timeout = 30000,
  },
) {
  const directory = mkdtempSync(join(
    tmpdir(),
    'canonical-v2-qxo-capitalisation-f28-',
  ));
  const file = join(directory, fileName);
  writeFileSync(file, sql, { mode: 0o600 });
  try {
    const result = spawnSync(
      executable,
      [
        'db',
        'query',
        '--linked',
        '--file',
        file,
        '--output',
        'json',
        '--agent=yes',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout,
        maxBuffer,
      },
    );
    if (result.status !== 0) {
      throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    }
    if (Buffer.byteLength(result.stdout, 'utf8') > maxBuffer) {
      throw new Error('F28 staging query exceeded its response bound.');
    }
    const parsed = JSON.parse(result.stdout);
    const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (!Array.isArray(rows)) {
      throw new Error('F28 staging query returned no rows array.');
    }
    return rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sourceSlice(text, interval) {
  return Buffer.from(text, 'utf8')
    .subarray(interval.start, interval.end)
    .toString('utf8');
}

function readAdmittedF28Inputs() {
  const rows = runLinkedSql(`BEGIN TRANSACTION READ ONLY;
SET LOCAL lock_timeout='2000ms';
SET LOCAL statement_timeout='15000ms';
SELECT jsonb_build_object(
  'immutable_source_document', immutable.canonical_payload,
  'source_admission_manifest', admission.canonical_payload,
  'semantic_extraction_input_envelope', envelope.canonical_payload,
  'conversion', conversion.canonical_payload
) AS source_graph
FROM canonical_v2_staging.source_admission_manifests admission
JOIN canonical_v2_staging.immutable_source_documents immutable
  ON immutable.immutable_source_document_id =
    admission.canonical_payload->>'immutable_source_document_id'
JOIN canonical_v2_staging.semantic_extraction_input_envelopes envelope
  ON envelope.source_admission_manifest_id =
    admission.source_admission_manifest_id
JOIN canonical_v2_staging.canonical_text_conversions conversion
  ON conversion.canonical_text_id =
    admission.canonical_payload->>'canonical_text_id'
WHERE admission.source_admission_manifest_id =
  ${sqlText(ADMITTED_SOURCE.source_admission_manifest_id)}
  AND immutable.immutable_source_document_id =
    ${sqlText(ADMITTED_SOURCE.immutable_source_document_id)}
  AND envelope.semantic_extraction_input_envelope_id =
    ${sqlText(ADMITTED_SOURCE.semantic_extraction_input_envelope_id)}
  AND conversion.canonical_text_id =
    ${sqlText(ADMITTED_SOURCE.canonical_text_id)}
LIMIT 2;
ROLLBACK;
`, {
    fileName: 'read-admitted-source.sql',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (rows.length !== 1 || !rows[0]?.source_graph) {
    throw new Error('The exact admitted QXO source must resolve once.');
  }
  const graph = rows[0].source_graph;
  const contractBundle = compileFixtureContractV13();
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      ADMITTED_SOURCE.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const sourceContext = buildAdmittedSemanticSourceContext({
    ...graph,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  if (
    sourceContext.immutable_source_document_id
      !== ADMITTED_SOURCE.immutable_source_document_id
    || sourceContext.source_admission_manifest_id
      !== ADMITTED_SOURCE.source_admission_manifest_id
    || sourceContext.semantic_extraction_input_envelope_id
      !== ADMITTED_SOURCE.semantic_extraction_input_envelope_id
    || sourceContext.canonical_text_id
      !== ADMITTED_SOURCE.canonical_text_id
    || sourceContext.document_hash !== ADMITTED_SOURCE.document_hash
  ) {
    throw new Error('The admitted QXO source identity has drifted.');
  }
  const parserSourceClosure =
    buildQxoCapitalisationParserSourceClosureF27({
      capital_structure_text: sourceSlice(
        sourceContext.canonical_text.text,
        CAPITAL_STRUCTURE_INTERVAL,
      ),
      closing_condition_text: sourceSlice(
        sourceContext.canonical_text.text,
        SECTION_5_2_INTERVAL,
      ),
    });
  return { sourceContext, parserSourceClosure, contractBundle };
}

function runRollbackProof(sql, candidate, permission, executable) {
  const rows = runLinkedSql(sql, {
    executable,
    fileName: 'rollback-proof.sql',
    maxBuffer: MAX_RESULT_BYTES,
  });
  if (
    rows.length !== 1
    || !rows[0]?.attestation
  ) {
    throw new Error('F28 staging proof returned no exact attestation.');
  }
  const attestation = rows[0].attestation;
  if (
    attestation.schema_version
      !== 'QXO_CAPITALISATION_STAGING_PROOF_F28/V1'
    || attestation.project_ref !== PROJECT.ref
    || attestation.release_id !== candidate.release.release_id
    || attestation.release_manifest_id
      !== candidate.release.manifest.release_manifest_id
    || attestation.provision_row_id
      !== candidate.release.provision_row.provision_row_id
    || attestation.candidate_envelope_id
      !== candidate.candidateEnvelope
        .qxo_capitalisation_f28_candidate_envelope_id
    || attestation.reviewed_graph_payload_digest
      !== candidate.release.manifest.reviewed_graph_payload_digest
    || attestation.source_binding !== candidate.sourceBinding
    || attestation.source_context_id
      !== candidate.inputs.sourceContext.admitted_semantic_source_context_id
    || attestation.document_hash
      !== candidate.inputs.sourceContext.document_hash
    || attestation.programme_status_generation !== permission.generation
    || attestation.programme_status_main_commit
      !== permission.origin_main_commit
    || attestation.programme_status_publication_commit
      !== permission.publication_commit
    || attestation.vertical_slice_execution !== 'PASS'
    || attestation.probe_records !== MAX_PROBE_RECORDS
    || attestation.metric_slots !== 14
    || attestation.set_based_insert_statements !== 1
    || attestation.set_based_metric_reads !== 1
    || attestation.subject_exclusion_verified !== true
    || attestation.active_pointer_unchanged !== true
    || attestation.candidate_counts_unchanged !== true
    || attestation.probe_rolled_back !== true
    || attestation.durable_candidate_writes !== 0
    || attestation.active_pointer_writes !== 0
    || attestation.database_calls_per_market_request !== 1
    || attestation.immediate_retries !== 0
  ) {
    throw new Error('F28 rollback proof did not leave staging unchanged.');
  }
  return attestation;
}

function offlineAttestation(candidate) {
  const { release, request } = candidate;
  const { records, payloadBytes } = buildProbeRecords(release);
  return {
    schema_version: 'QXO_CAPITALISATION_OFFLINE_ATTESTATION_F28/V1',
    execution_state: 'NOT_EXECUTED_OFFLINE_ONLY',
    source_binding: candidate.sourceBinding,
    source_context_id:
      candidate.inputs.sourceContext.admitted_semantic_source_context_id,
    document_hash: candidate.inputs.sourceContext.document_hash,
    project_ref: PROJECT.ref,
    release_id: release.release_id,
    release_manifest_id: release.manifest.release_manifest_id,
    provision_row_id: release.provision_row.provision_row_id,
    candidate_envelope_id:
      candidate.candidateEnvelope
        .qxo_capitalisation_f28_candidate_envelope_id,
    reviewed_graph_payload_digest:
      release.manifest.reviewed_graph_payload_digest,
    probe_records: records.length,
    probe_payload_bytes: payloadBytes,
    metric_slots: request.metric_bindings.length,
    metric_admissions: release.admissions.length,
    market_observations: release.observations.length,
    typed_slot_exclusions: release.exclusions.length,
    market_database_call_budget: request.database_call_budget,
    immediate_retries: request.immediate_retries,
    durable_candidate_writes: 0,
    active_pointer_writes: 0,
  };
}

const args = process.argv.slice(2);
if (
  args.length !== 1
  || ![
    '--attest',
    '--verify',
    '--verify-fixture-rollback',
  ].includes(args[0])
) {
  fail(
    'Usage: node scripts/canonical-v2-staging-qxo-capitalisation-f28.mjs '
      + '--attest|--verify|--verify-fixture-rollback',
  );
}

try {
  if (args[0] === '--attest') {
    const candidate = buildCandidate(buildF27Inputs());
    process.stdout.write(`${JSON.stringify(offlineAttestation(candidate))}\n`);
  } else {
    let permission;
    if (args[0] === '--verify') {
      const {
        verifyFetchedPublication,
      } = await import('./verify-programme-status-publication.mjs');
      permission = requireVerticalSliceExecutionPermission(
        verifyFetchedPublication({ root: ROOT }),
      );
      guardProject();
    } else {
      permission = Object.freeze({
        schema_version: 'VERTICAL_SLICE_EXECUTION_PERMISSION_TEST_FIXTURE/V1',
        generation: 1,
        origin_main_commit: '0'.repeat(40),
        publication_commit: '1'.repeat(40),
        p1_contract_freeze_attested: 'TEST_ONLY',
        vertical_slice_execution: 'PASS',
        authority_source: 'TEMPORARY_EXECUTABLE_TEST_FIXTURE_ONLY',
      });
    }
    const executable = args[0] === '--verify'
      ? 'supabase'
      : fixtureSupabaseExecutable();
    const inputs = args[0] === '--verify'
      ? readAdmittedF28Inputs()
      : buildF27Inputs();
    const candidate = buildCandidate(inputs);
    const sql = buildRollbackProofSql(candidate, permission);
    const attestation = runRollbackProof(
      sql,
      candidate,
      permission,
      executable,
    );
    process.stdout.write(`${JSON.stringify(attestation)}\n`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
