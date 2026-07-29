const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalBytes,
  domainDigest,
} = require('../../lib/programme-gates/bytes');
const {
  HEAD_PATH,
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  STATUS_PATH,
  gitBlobObjectId,
} = require('../../lib/programme-gates/publication');

const ROOT = path.resolve(__dirname, '../..');
const MODULE_URL = new URL(
  '../../scripts/verify-programme-status-publication.mjs',
  `file://${__filename}`,
);

function hasLocalPublicationRefs() {
  try {
    for (const ref of [
      'refs/remotes/origin/main^{commit}',
      'refs/remotes/origin/programme-status-publication-head^{commit}',
    ]) {
      execFileSync('git', [
        '-C',
        ROOT,
        'rev-parse',
        '--verify',
        ref,
      ], { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

test('the exact publication tree accepts only the two regular files', async () => {
  const { requireExactPublicationTree } = await import(MODULE_URL);
  assert.doesNotThrow(() => requireExactPublicationTree([
    {
      mode: '100644',
      type: 'blob',
      objectId: '1'.repeat(40),
      path: STATUS_PATH,
    },
    {
      mode: '100644',
      type: 'blob',
      objectId: '2'.repeat(40),
      path: HEAD_PATH,
    },
  ]));
  assert.throws(() => requireExactPublicationTree([
    {
      mode: '100644',
      type: 'blob',
      objectId: '1'.repeat(40),
      path: STATUS_PATH,
    },
  ]), /exactly the two status files/);
  assert.throws(() => requireExactPublicationTree([
    {
      mode: '100755',
      type: 'blob',
      objectId: '1'.repeat(40),
      path: STATUS_PATH,
    },
    {
      mode: '100644',
      type: 'blob',
      objectId: '2'.repeat(40),
      path: HEAD_PATH,
    },
  ]), /not a regular file/);
});

test('the publication head must bind the exact signed status', async () => {
  const { requireStatusHeadBindings } = await import(MODULE_URL);
  const status = {
    schema_version: 'ProgrammeGateStatusArtefact/V2',
    generation: 1,
    signature: 'signed-value',
  };
  const statusBlobId = gitBlobObjectId(status, canonicalBytes);
  const head = {
    generation: 1,
    status_artefact_id: domainDigest(STATUS_ARTEFACT_ID_DOMAIN, status),
    status_artefact_payload_digest: domainDigest(
      STATUS_ARTEFACT_PAYLOAD_DOMAIN,
      status,
    ),
    status_git_object_id: statusBlobId,
  };
  assert.doesNotThrow(() => requireStatusHeadBindings({
    status,
    head,
    statusBlobId,
  }));
  assert.throws(() => requireStatusHeadBindings({
    status: { ...status, signature: 'different-value' },
    head,
    statusBlobId,
  }), /does not bind the exact signed status/);
});

test('the protected live publication passes the complete verifier', {
  skip: process.env.PROGRAMME_STATUS_LIVE_ACCEPTANCE !== '1'
    || !hasLocalPublicationRefs(),
}, async () => {
  const { verifyFetchedPublication } = await import(MODULE_URL);
  const result = verifyFetchedPublication({ root: ROOT });
  const mainCommit = execFileSync(
    'git',
    ['-C', ROOT, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'],
    { encoding: 'utf8' },
  ).trim();
  assert.equal(result.result, 'PASS');
  assert.equal(result.origin_main_commit, mainCommit);
  assert.equal(result.work_classes.implementation_planning, 'PASS');
  assert.equal(result.work_classes.canonical_work_start, 'PASS');
  assert.equal(result.work_classes.vertical_slice_execution, 'OPEN');
});
