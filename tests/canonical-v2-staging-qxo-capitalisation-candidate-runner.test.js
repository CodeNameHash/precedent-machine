const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-qxo-capitalisation-candidate.mjs';
const body = fs.readFileSync(RUNNER, 'utf8');

test('QXO candidate runner is staging-only, bounded and rollback-first', () => {
  assert.match(body, /deal-corpus-canonical-v2-staging/);
  assert.match(body, /MAX_GRAPH_READ_BYTES/);
  assert.match(body, /TRANSACTION READ ONLY/);
  assert.match(body, /Rollback-first QXO candidate import changed staging state/);
  assert.match(body, /selectTrustedCandidateInputs/);
  assert.match(body, /recheckCandidateInputHead/);
});

test('one set-wise graph read closes over source, semantics and the current pointer', () => {
  assert.equal((body.match(/function readGraph\(/g) || []).length, 1);
  assert.match(body, /jsonb_build_object\([\s\S]*immutable_source_document[\s\S]*source_admission_manifest[\s\S]*semantic_extraction_input_envelope[\s\S]*conversion[\s\S]*excerpts[\s\S]*provisions[\s\S]*components[\s\S]*claims[\s\S]*relationships[\s\S]*active_pointer/);
  assert.match(body, /assertGraphParity/);
  assert.doesNotMatch(body, /SELECT \* FROM canonical_v2_staging/);
});

test('candidate import cannot activate either staging or production', () => {
  assert.match(body, /active_pointer_unchanged: true/);
  assert.match(body, /import moved the active staging release pointer/);
  assert.doesNotMatch(body, /activateCandidateRelease|canonical_v2_activate_candidate_release|environment:\s*'production'/);
});

test('attestation exposes governed identities and counts without source payloads', () => {
  assert.match(body, /candidate_release_manifest_id/);
  assert.match(body, /semantic_closure_id/);
  assert.match(body, /exact_detail_packages/);
  assert.doesNotMatch(body, /response_bytes_base64|source_map_payload_base64/);
});

test('ambiguous invocation fails before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--import', 'extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stderr, /Supabase|database/);
});
