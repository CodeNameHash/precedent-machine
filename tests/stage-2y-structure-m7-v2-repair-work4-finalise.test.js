'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = path.resolve(__dirname, '..');
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work4-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work4-validate.mjs';
// Work4 candidate correction (Ben, 2026-09-03): with the correction authority
// in the tree the governed set is the successor manifest and receipt.
const CORRECTION_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work4-candidate-correction-authority.json';
const CORRECTED = fs.existsSync(path.join(REPO_ROOT, CORRECTION_AUTHORITY_PATH));
const MANIFEST_PATH = CORRECTED
  ? 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json'
  : 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest.json';
const RECEIPT_PATH = CORRECTED
  ? 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json'
  : 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json';

function transitionedOptions() {
  return fs.existsSync(path.join(REPO_ROOT, MANIFEST_PATH))
    ? {}
    : { skip: 'Work4 candidate transition has not created the execution manifest' };
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('Work4 finaliser and validator refuse CLI arguments before any repository access', () => {
  for (const [script, code] of [
    [FINALISER_PATH, 'WORK4_RECEIPT_INVALID'],
    [VALIDATOR_PATH, 'WORK4_VALIDATION_INVALID'],
  ]) {
    const run = spawnSync(process.execPath, [script, '--write'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0, script);
    assert.match(run.stderr, new RegExp(`${code}: CLI arguments`), script);
    assert.equal(run.stdout, '', script);
  }
});

test('Work4 finaliser and validator reject unknown options', async () => {
  const { finaliseWork4 } = await import(path.join(REPO_ROOT, FINALISER_PATH));
  const { validateWork4 } = await import(path.join(REPO_ROOT, VALIDATOR_PATH));
  await assert.rejects(() => finaliseWork4({ repoRoot: REPO_ROOT, force: true }), /WORK4_RECEIPT_INVALID/u);
  await assert.rejects(() => finaliseWork4({ repoRoot: REPO_ROOT, write: 'yes' }), /WORK4_RECEIPT_INVALID/u);
  await assert.rejects(() => validateWork4({ repoRoot: REPO_ROOT, write: false }), /WORK4_VALIDATION_INVALID/u);
});

test('Work4 finaliser preview is byte-deterministic and re-derives any committed receipt',
  transitionedOptions(), async () => {
  const { finaliseWork4, resolveWork4Paths } = await import(path.join(REPO_ROOT, FINALISER_PATH));
  assert.equal(resolveWork4Paths(REPO_ROOT).receiptPath, RECEIPT_PATH);
  const first = await finaliseWork4({ repoRoot: REPO_ROOT, write: false });
  const second = await finaliseWork4({ repoRoot: REPO_ROOT, write: false });
  assert.equal(first.status, 'PASS_WORK4_FINALISATION_PREVIEW');
  assert.deepEqual(first, second);
  assert.deepEqual(first.effects, { files_written: 0, receipt_writes: 0 });
  const committed = path.join(REPO_ROOT, RECEIPT_PATH);
  if (fs.existsSync(committed)) {
    const bytes = fs.readFileSync(committed);
    assert.equal(bytes.length, first.byte_length);
    assert.equal(sha256(bytes), first.sha256);
    const { validateWork4 } = await import(path.join(REPO_ROOT, VALIDATOR_PATH));
    const result = await validateWork4({ repoRoot: REPO_ROOT });
    assert.equal(result.status, 'PASS');
    assert.equal(result.work4_receipt_id, first.work4_receipt_id);
  }
});

test('Work4 receipt validation rejects lineage, identity, count and effect drift', async () => {
  const { validateWork4Receipt, COUNT_KEYS, EXPECTED_EFFECTS, RECEIPT_SCHEMA } =
    await import(path.join(REPO_ROOT, VALIDATOR_PATH));
  const manifest = {
    execution_manifest_id: 'a'.repeat(64),
    execution_manifest_digest: 'b'.repeat(64),
    candidate_ordering_correction_authority_binding: { path: 'authority.json', record_id: 'c'.repeat(64) },
    candidate_registration_binding: { registration_binding: { record_id: 'd'.repeat(64) } },
    candidate_transition: { state: 'PASS', transition_run_count: 1, transition_argv: ['node', 'x'] },
  };
  const expectedCounts = Object.fromEntries(COUNT_KEYS.map((key, index) => [key, index + 1]));
  const seal = (body) => ({ ...body, work4_receipt_id: contentId(RECEIPT_SCHEMA, body) });
  const lawful = seal({
    schema_version: RECEIPT_SCHEMA,
    state: 'PASS_WORK4',
    status: 'PASS',
    work: 'WORK4',
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_ordering_correction_authority_binding:
      JSON.parse(canonicalJson(manifest.candidate_ordering_correction_authority_binding)),
    candidate_registration_id: 'd'.repeat(64),
    candidate_transition: JSON.parse(canonicalJson(manifest.candidate_transition)),
    counts: expectedCounts,
    effects: { ...EXPECTED_EFFECTS },
  });
  assert.equal(validateWork4Receipt(lawful, { manifest, expectedCounts }), true);

  const mutate = (change) => {
    const body = JSON.parse(JSON.stringify(lawful));
    delete body.work4_receipt_id;
    change(body);
    return seal(body);
  };
  const cases = [
    [(body) => { body.state = 'PASS_WORK5'; }, /WORK4_RECEIPT_DRIFT/u],
    [(body) => { body.status = 'FAIL'; }, /WORK4_RECEIPT_DRIFT/u],
    [(body) => { body.extra = 1; }, /WORK4_RECEIPT_DRIFT/u],
    [(body) => { delete body.effects; }, /WORK4_RECEIPT_DRIFT/u],
    [(body) => { body.execution_manifest_id = 'e'.repeat(64); }, /WORK4_LINEAGE_DRIFT/u],
    [(body) => { body.candidate_registration_id = 'e'.repeat(64); }, /WORK4_LINEAGE_DRIFT/u],
    [(body) => { body.candidate_transition.transition_run_count = 2; }, /WORK4_LINEAGE_DRIFT/u],
    [(body) => { body.candidate_ordering_correction_authority_binding.record_id = 'e'.repeat(64); }, /WORK4_LINEAGE_DRIFT/u],
    [(body) => { body.counts[COUNT_KEYS[0]] += 1; }, /WORK4_COUNT_DRIFT/u],
    [(body) => { body.counts.unexpected = 1; }, /WORK4_COUNT_DRIFT/u],
    [(body) => { body.counts[COUNT_KEYS[1]] = -1; }, /WORK4_COUNT_DRIFT/u],
    [(body) => { body.effects.model_calls = 1; }, /WORK4_EFFECT_DRIFT/u],
    [(body) => { body.effects.receipt_writes = 0; }, /WORK4_EFFECT_DRIFT/u],
  ];
  for (const [change, pattern] of cases) {
    assert.throws(() => validateWork4Receipt(mutate(change), { manifest, expectedCounts }), pattern);
  }
  const forged = { ...lawful, work4_receipt_id: 'f'.repeat(64) };
  assert.throws(() => validateWork4Receipt(forged, { manifest, expectedCounts }), /WORK4_RECEIPT_DRIFT/u);
  const failedTransition = { ...manifest, candidate_transition: { ...manifest.candidate_transition, state: 'FAIL' } };
  assert.throws(
    () => validateWork4Receipt(mutate((body) => { body.candidate_transition.state = 'FAIL'; }), { manifest: failedTransition, expectedCounts }),
    /WORK4_LINEAGE_DRIFT/u,
  );
});

test('Work4 V2 receipt validation binds the correction authority and the superseded receipt', async () => {
  const { validateWork4Receipt, COUNT_KEYS, EXPECTED_EFFECTS, RECEIPT_SCHEMA, RECEIPT_SCHEMA_V2, CORRECTION_MEMBER } =
    await import(path.join(REPO_ROOT, VALIDATOR_PATH));
  const authorityBinding = { path: 'correction.json', record_id: 'a'.repeat(64), byte_length: 1, sha256: 'b'.repeat(64) };
  const supersededReceiptBinding = { path: 'work4-fixture.json', schema_version: RECEIPT_SCHEMA, record_id: 'c'.repeat(64) };
  const manifest = {
    execution_manifest_id: 'a'.repeat(64),
    execution_manifest_digest: 'b'.repeat(64),
    candidate_ordering_correction_authority_binding: { path: 'authority.json', record_id: 'c'.repeat(64) },
    candidate_registration_binding: { registration_binding: { record_id: 'd'.repeat(64) } },
    candidate_transition: { state: 'PASS', transition_run_count: 1, transition_argv: ['node', 'x'] },
    [CORRECTION_MEMBER]: authorityBinding,
  };
  const expectedCounts = Object.fromEntries(COUNT_KEYS.map((key, index) => [key, index + 1]));
  const correction = { authorityBinding, supersededReceiptBinding };
  const body = {
    schema_version: RECEIPT_SCHEMA_V2,
    state: 'PASS_WORK4',
    status: 'PASS',
    work: 'WORK4',
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_ordering_correction_authority_binding:
      JSON.parse(canonicalJson(manifest.candidate_ordering_correction_authority_binding)),
    candidate_registration_id: 'd'.repeat(64),
    candidate_transition: JSON.parse(canonicalJson(manifest.candidate_transition)),
    counts: expectedCounts,
    effects: { ...EXPECTED_EFFECTS },
    [CORRECTION_MEMBER]: JSON.parse(canonicalJson(authorityBinding)),
    superseded_work4_receipt_binding: JSON.parse(canonicalJson(supersededReceiptBinding)),
  };
  const seal = (unsigned) => ({ ...unsigned, work4_receipt_id: contentId(unsigned.schema_version, unsigned) });
  assert.equal(validateWork4Receipt(seal(body), { manifest, expectedCounts, correction }), true);
  // A V2 receipt is not a V1 receipt and a V1 receipt is not a V2 receipt.
  assert.throws(() => validateWork4Receipt(seal(body), { manifest, expectedCounts }), /WORK4_RECEIPT_DRIFT/u);
  const v1 = { ...body, schema_version: RECEIPT_SCHEMA };
  delete v1[CORRECTION_MEMBER];
  delete v1.superseded_work4_receipt_binding;
  assert.throws(() => validateWork4Receipt(seal(v1), { manifest, expectedCounts, correction }), /WORK4_RECEIPT_DRIFT/u);
  const wrongAuthority = { ...body, [CORRECTION_MEMBER]: { ...authorityBinding, record_id: 'e'.repeat(64) } };
  assert.throws(() => validateWork4Receipt(seal(wrongAuthority), { manifest, expectedCounts, correction }), /WORK4_LINEAGE_DRIFT/u);
  const wrongSuperseded = { ...body, superseded_work4_receipt_binding: { ...supersededReceiptBinding, record_id: 'e'.repeat(64) } };
  assert.throws(() => validateWork4Receipt(seal(wrongSuperseded), { manifest, expectedCounts, correction }), /WORK4_LINEAGE_DRIFT/u);
});
