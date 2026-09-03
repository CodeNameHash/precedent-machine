'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const LEDGER_DIR = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction';
const LEDGERS = [
  'known-loss-244-ledger.json',
  'red-hat-69-ledger.json',
  'm2-inline-23-ledger.json',
];
const EXTRA_SOURCES = [
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
  'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-comparison-entry-correction/additive-open-world.json',
];
const TEN_SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work6-ten-agreement-calibration.mjs');
const ADDITIVE_SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work6-additive-three-calibration.mjs');
const REGISTRATION_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const KNOWN_LOSS_SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work6-known-loss-244.mjs');
const LIMBS_SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work6-historical-limbs-69.mjs');
const AMBIGUITY_SCRIPT = path.resolve(__dirname, '../scripts/stage-2y-structure-m7-v2-repair-work6-parser-ambiguities-23.mjs');

function writeBytes(root, repositoryPath, bytes) {
  const absolute = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
  return bytes;
}

function writeCanonical(root, repositoryPath, record) {
  return writeBytes(root, repositoryPath, Buffer.from(`${canonicalJson(record)}\n`, 'utf8'));
}

function identify(schema, record, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  return { ...record, [idField]: contentId(schema, unsigned) };
}

function buildSyntheticRegistration(root) {
  const dummyPath = 'lib/canonical-v2/work6-dummy.js';
  const dummyBytes = writeBytes(root, dummyPath, Buffer.from('// work6\n', 'utf8'));
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
  const unsigned = {
    schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
    stage: 'M7_V2_REPAIR',
    lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
    code_bindings: { compiler: dummyBinding },
    semantic_input_bindings: [],
    predecessor_receipt_bindings: [],
  };
  const registration = identify('STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', unsigned, 'candidate_registration_id');
  writeCanonical(root, registrationPath, registration);
  return { registrationPath, registrationId: registration.candidate_registration_id, dummyPath };
}

function copySealedLedgers(root) {
  for (const name of LEDGERS) {
    const repositoryPath = `${LEDGER_DIR}/${name}`;
    writeBytes(root, repositoryPath, fs.readFileSync(path.join(SOURCE_ROOT, repositoryPath)));
  }
  for (const repositoryPath of EXTRA_SOURCES) {
    writeBytes(root, repositoryPath, fs.readFileSync(path.join(SOURCE_ROOT, repositoryPath)));
  }
}

function runScript(script, args) {
  try {
    const stdout = execFileSync('node', [script, ...args], { encoding: 'utf8' });
    return { status: 0, result: JSON.parse(stdout) };
  } catch (error) {
    const stdout = error.stdout && String(error.stdout).trim() ? String(error.stdout) : '{}';
    return { status: error.status, result: JSON.parse(stdout.split('\n').find((line) => line.startsWith('{')) ?? '{}') };
  }
}

test('no selector refuses with SELECTION_REQUIRED', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-noselect-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  buildSyntheticRegistration(root);
  const ran = runScript(KNOWN_LOSS_SCRIPT, ['--repo-root', root]);
  assert.equal(ran.status, 1);
  assert.equal(ran.result.status, 'FAIL');
  assert.equal(ran.result.findings[0].code, 'SELECTION_REQUIRED');
});

test('tree drift against the selected registration refuses', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-drift-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  fs.writeFileSync(path.join(root, built.dummyPath), Buffer.from('// changed\n', 'utf8'));
  const ran = runScript(KNOWN_LOSS_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(ran.status, 1);
  assert.equal(ran.result.findings[0].code, 'TREE_DRIFT');
});

test('a mutated sealed ledger refuses with LEDGER_DIGEST_MISMATCH', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-ledger-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const ledgerPath = path.join(root, LEDGER_DIR, 'known-loss-244-ledger.json');
  const bytes = fs.readFileSync(ledgerPath);
  bytes[0] = bytes[0] === 123 ? 91 : 123;
  fs.writeFileSync(ledgerPath, bytes);
  const ran = runScript(KNOWN_LOSS_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(ran.status, 1);
  assert.equal(ran.result.findings[0].code, 'LEDGER_DIGEST_MISMATCH');
});

test('known-loss 244 recounts 244 verified-fixed members and --check matches', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-244-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(KNOWN_LOSS_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  assert.equal(wrote.result.status, 'PASS');
  assert.equal(wrote.result.candidate_registration_id, built.registrationId);
  const report = JSON.parse(fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8'));
  assert.equal(report.observed_member_count, 244);
  assert.equal(report.disposition_counts.VERIFIED_FIXED_BY_COMPLETE_COMPOUND_PROPOSITION_AND_MEMBER_FACT_ROW, 244);
  assert.equal(report.member_ids.length, 244);
  const checked = runScript(KNOWN_LOSS_SCRIPT, [
    '--repo-root', root, '--registration', built.registrationPath, '--check',
  ]);
  assert.equal(checked.status, 0, JSON.stringify(checked.result));
  assert.equal(checked.result.check, true);
});

test('historical limbs 69 reports the residual quote and does not resolve it', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-69-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(LIMBS_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  const report = JSON.parse(fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8'));
  assert.equal(report.observed_member_count, 69);
  assert.equal(report.disposition_counts.RESIDUAL_QUOTE_UNVERIFIED, 1);
  assert.equal(report.residual_quote_unverified.length, 1);
  assert.equal(report.residual_quote_unverified[0].resolution, 'REPORTED_NOT_RESOLVED');
  assert.equal(
    report.residual_quote_unverified[0].red_hat_limb_member_id,
    '47fd75416787b2d88361a658fda4d001e0a2344f87843b5c89d85a10d69480fa',
  );
});

test('parser ambiguities 23 create no overlay', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-23-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(AMBIGUITY_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  const report = JSON.parse(fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8'));
  assert.equal(report.observed_member_count, 23);
  assert.equal(report.overlays_created, 0);
  assert.equal(report.members.every((member) => member.overlay_created === false), true);
  assert.equal(report.reviewed_disposition_counts.BEN_APPROVED_NO_UNAFFECTED_PROPOSITION_BLOCK, 23);
});

test('a sibling registration is listed as superseded', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-sib-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  writeCanonical(root, `${REGISTRATION_ROOT}/${'cd'.repeat(32)}.json`, {
    schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
    note: 'superseded',
  });
  const wrote = runScript(KNOWN_LOSS_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  assert.deepEqual(wrote.result.superseded_registrations, [`${REGISTRATION_ROOT}/${'cd'.repeat(32)}.json`]);
});

test('ten-agreement calibration isolates TopBuild', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-ten-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(TEN_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  const report = JSON.parse(fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8'));
  assert.equal(report.agreement_count, 10);
  assert.equal(report.topbuild.known_loss_member_count, 84);
  assert.equal(report.combined_ten_corpus_digest, 'b8825b712ab905a175cfc4a86c3504705f1d8bf509ddcee40f951764c3cf6e3d');
});

test('additive-three calibration recounts the three sealed deals', async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work6-add-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  copySealedLedgers(root);
  const built = buildSyntheticRegistration(root);
  const wrote = runScript(ADDITIVE_SCRIPT, ['--repo-root', root, '--registration', built.registrationPath]);
  assert.equal(wrote.status, 0, JSON.stringify(wrote.result));
  const report = JSON.parse(fs.readFileSync(path.join(root, wrote.result.report_path), 'utf8'));
  assert.equal(report.observed_member_count, 16);
  assert.equal(report.candidate_key_counts['abbvie-landos'] > 0, true);
  assert.equal(report.candidate_key_counts['lilly-verve'] > 0, true);
  assert.equal(report.candidate_key_counts['rocket-redfin'] > 0, true);
});
