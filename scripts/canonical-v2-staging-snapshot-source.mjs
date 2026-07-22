#!/usr/bin/env node

import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  SNAPSHOT_PROJECT_NAME,
  SNAPSHOT_PROJECT_REF,
  SOURCE_TABLE,
  buildProductionSnapshotSourceEnvelope,
  validateProductionSnapshotSourceEnvelope,
} = require('../lib/canonical-v2/production-snapshot-source-envelope');

const QXO_DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const SNAPSHOT_CREATED_AT = '2026-07-22T09:43:58.000Z';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function safeDiagnostic(output) {
  const line = String(output || '').split('\n').find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item));
  return line
    ? line.slice(line.search(/(?:ERROR|DETAIL|HINT):/i)).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    : 'Snapshot source query failed.';
}

function snapshotProjectDir() {
  const projectDir = resolve(process.env.CANONICAL_V2_SNAPSHOT_PROJECT_DIR || '');
  if (!process.env.CANONICAL_V2_SNAPSHOT_PROJECT_DIR) {
    throw new Error('CANONICAL_V2_SNAPSHOT_PROJECT_DIR is required.');
  }
  const ref = readFileSync(join(projectDir, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(projectDir, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== SNAPSHOT_PROJECT_REF || linked.ref !== SNAPSHOT_PROJECT_REF
    || linked.name !== SNAPSHOT_PROJECT_NAME) {
    throw new Error(`Refusing to read outside ${SNAPSHOT_PROJECT_NAME} (${SNAPSHOT_PROJECT_REF}).`);
  }
  return projectDir;
}

function readQxoRow(projectDir) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-snapshot-source-'));
  const file = join(directory, 'source.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='5000ms';
SELECT jsonb_build_object(
  'id', id,
  'updated_at', updated_at,
  'metadata', jsonb_build_object(
    'full_text', metadata->>'full_text',
    'source_url', metadata->>'source_url'
  )
) AS row
FROM public.deals
WHERE id = '${QXO_DEAL_ID}'::uuid
LIMIT 2;
COMMIT;
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.row) {
      throw new Error('The pinned QXO snapshot query must return exactly one row.');
    }
    return rows[0].row;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function snapshotMarker() {
  return {
    schema_version: 'IMMUTABLE_SNAPSHOT_MARKER/V1',
    marker_id: contentId('IMMUTABLE_SNAPSHOT_MARKER/V1', {
      snapshot_project_ref: SNAPSHOT_PROJECT_REF,
      snapshot_project_name: SNAPSHOT_PROJECT_NAME,
      snapshot_created_at: SNAPSHOT_CREATED_AT,
    }),
  };
}

function attest(envelope) {
  return {
    schema_version: 'PRODUCTION_SNAPSHOT_SOURCE_ATTESTATION/V1',
    snapshot_project_ref: envelope.snapshot_project_ref,
    governed_source_row_id: envelope.governed_source_row_id,
    production_snapshot_source_envelope_id: envelope.production_snapshot_source_envelope_id,
    immutable_source_document_id: envelope.immutable_source.immutable_source_document_id,
    source_kind: envelope.immutable_source.source_kind,
    exact_utf8_bytes_sha256: envelope.exact_utf8_bytes_sha256,
    exact_utf8_byte_length: envelope.exact_utf8_byte_length,
    metadata_source_url_sha256: envelope.metadata_source_url_sha256,
    promotable_to_original_source: envelope.source_fidelity.promotable_to_original_source,
    transaction_mode: 'READ_ONLY',
  };
}

if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
  fail('Usage: node scripts/canonical-v2-staging-snapshot-source.mjs --verify');
}

try {
  const envelope = buildProductionSnapshotSourceEnvelope({
    project_ref: SNAPSHOT_PROJECT_REF,
    project_name: SNAPSHOT_PROJECT_NAME,
    source_table: SOURCE_TABLE,
    row: readQxoRow(snapshotProjectDir()),
    immutable_snapshot_marker: snapshotMarker(),
  });
  validateProductionSnapshotSourceEnvelope(envelope);
  process.stdout.write(`${canonicalJson(attest(envelope))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Snapshot source verification failed.');
}
