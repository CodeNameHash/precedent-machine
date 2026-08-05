'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_SCRIPT = path.join(ROOT, 'scripts/generate-canonical-contract-current-review.mjs');
const SPECIFICATION_PATH = 'docs/codex-program/specification-manifest.json';
const V2_MEMBER_PATHS = Object.freeze([
  'docs/CODEX-PROGRAM.md',
  'docs/codex-program/EXECUTION-LEDGER.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/m3-family-parity-register.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/adversarial-tests.md',
]);

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function writeFile(root, relativePath, bytes) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-current-review-'));
  fs.cpSync(path.join(ROOT, 'contracts/canonical-v2/successor'), path.join(root, 'contracts/canonical-v2/successor'), { recursive: true });
  const files = V2_MEMBER_PATHS.map((memberPath, index) => {
    const bytes = Buffer.from(`V2 governed member ${index + 1}\n`, 'utf8');
    writeFile(root, memberPath, bytes);
    return { order: index + 1, path: memberPath, byte_length: bytes.length, sha256: sha256(bytes) };
  });
  writeFile(root, SPECIFICATION_PATH, `${JSON.stringify({
    schema: 'codex-program-specification-manifest/v2',
    purpose: 'DRIFT_DETECTION_ONLY_NOT_EXECUTION_AUTHORITY',
    files,
  }, null, 2)}\n`);
  return root;
}
function listRelativeFiles(root) {
  const entries = [];
  function walk(relativePath = '') {
    for (const entry of fs.readdirSync(path.join(root, relativePath), { withFileTypes: true })) {
      const child = path.join(relativePath, entry.name);
      if (entry.isDirectory()) walk(child);
      else entries.push(child);
    }
  }
  walk();
  return entries.sort();
}

test('current-review generation reads exactly the six-member V2 manifest root and remains pre-review only', async () => {
  const review = await import(pathToFileURL(REVIEW_SCRIPT).href);
  const root = fixtureRoot();
  try {
    const members = review.readGoverningSpecificationMembers(root);
    assert.equal(members.length, 7);
    assert.deepEqual(members.map((member) => member.path), [SPECIFICATION_PATH, ...V2_MEMBER_PATHS]);

    const before = listRelativeFiles(root);
    const closure = JSON.parse(review.generateReviewSourceClosure({
      repositoryRoot: root,
      codeCommit: 'a'.repeat(40),
      approvalEpochNonce: 'test-current-review',
    }).toString('utf8'));
    assert.equal(closure.disposition.state, 'PRE_REVIEW_SOURCE_CLOSED_NOT_REVIEWED');
    assert.deepEqual(listRelativeFiles(root), before);
    assert.equal(fs.existsSync(path.join(root, 'evidence/contract-freeze')), false);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, SPECIFICATION_PATH), 'utf8'));
    manifest.schema = 'codex-program-specification-manifest/v1';
    writeFile(root, SPECIFICATION_PATH, `${JSON.stringify(manifest)}\n`);
    assert.throws(() => review.readGoverningSpecificationMembers(root), /current V2 root contract/);

    manifest.schema = 'codex-program-specification-manifest/v2';
    writeFile(root, SPECIFICATION_PATH, `${JSON.stringify(manifest)}\n`);
    fs.appendFileSync(path.join(root, V2_MEMBER_PATHS[0]), 'stale member');
    assert.throws(() => review.readGoverningSpecificationMembers(root), /Governing specification member drift/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
