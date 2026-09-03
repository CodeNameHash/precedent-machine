'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work5-render-packet.mjs');
const REGISTRATION_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const INPUTS = [
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-review-packet.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-decision-ledger.json',
];

function writeBytes(root, repositoryPath, bytes) {
  const absolute = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
}

function writeCanonical(root, repositoryPath, record) {
  writeBytes(root, repositoryPath, Buffer.from(`${canonicalJson(record)}\n`, 'utf8'));
}

function identify(schema, record, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  return { ...record, [idField]: contentId(schema, unsigned) };
}

function buildSyntheticRegistration(root) {
  const dummyPath = 'lib/canonical-v2/work5-dummy.js';
  const dummyBytes = Buffer.from('// work5\n', 'utf8');
  writeBytes(root, dummyPath, dummyBytes);
  const dummyBinding = {
    path: dummyPath,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: dummyBytes.length,
    sha256: sha256Hex(dummyBytes),
    git_blob_oid: null,
  };
  const registrationPath = `${REGISTRATION_ROOT}/${'ab'.repeat(32)}.json`;
  const registration = identify('STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', {
    schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
    stage: 'M7_V2_REPAIR',
    lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
    code_bindings: { compiler: dummyBinding },
    semantic_input_bindings: [],
    predecessor_receipt_bindings: [],
  }, 'candidate_registration_id');
  writeCanonical(root, registrationPath, registration);
  for (const repositoryPath of INPUTS) {
    writeBytes(root, repositoryPath, fs.readFileSync(path.join(SOURCE_ROOT, repositoryPath)));
  }
  return { registrationPath, registrationId: registration.candidate_registration_id };
}

function runScript(args) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
    return { status: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const stdout = error.stdout && String(error.stdout).trim() ? String(error.stdout) : '{}';
    return { status: error.status, result: JSON.parse(stdout.split('\n').find((line) => line.startsWith('{')) ?? '{}') };
  }
}

test('no selector refuses', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work5-noselect-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  buildSyntheticRegistration(root);
  const ran = runScript(['--repo-root', root]);
  assert.equal(ran.status, 1);
  assert.equal(ran.result.findings[0].code, 'SELECTION_REQUIRED');
});

test('renders all 50 items and --check matches', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work5-render-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  assert.equal(wrote.result.item_count, 50);
  const markdown = fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8');
  assert.equal((markdown.match(/^## Item /gmu) || []).length, 50);
  assert.match(markdown, /## Item 4/);
  assert.match(markdown, /### Item 4 operative chapeau/);
  assert.match(markdown, /## Item 39/);
  assert.match(markdown, /three standing questions|Standing questions/i);
  const checked = runScript(['--repo-root', root, '--registration', built.registrationPath, '--check']);
  assert.equal(checked.status, 0, JSON.stringify(checked.result));
});
