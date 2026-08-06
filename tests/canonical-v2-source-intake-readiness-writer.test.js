'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildInitialImportProposalPacket } = require('../lib/canonical-v2/governed-identity-proposal-packet');
const {
  OUTPUT_DIRECTORY,
  buildCurrentSourceIntakeReadinessMaterialisation,
  validateCurrentSourceIntakeReadinessMaterialisation,
  writeCurrentSourceIntakeReadinessMaterialisation,
  tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation,
} = require('../lib/canonical-v2/source-intake-readiness-writer');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');

function temporaryDurableRoot() { return fs.mkdtempSync(path.join(ROOT, '.source-intake-readiness-')); }

function writeCurrentInputs(root) {
  const cohort = makeCohort({ dealCount: 40 });
  const directory = path.join(root, 'm3-corpus-source-capture');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'cohort-capture-manifest.json'), `${JSON.stringify(cohort.cohort_manifest)}\n`);
  cohort.receipt_records.forEach((record, index) => {
    const target = path.join(directory, `record-${String(index).padStart(2, '0')}`);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'intake-receipt.json'), `${JSON.stringify(record.receipt)}\n`);
    fs.writeFileSync(path.join(target, 'discovery.json'), `${JSON.stringify(record.discovery)}\n`);
    fs.writeFileSync(path.join(target, 'capture.json'), `${JSON.stringify(record.capture)}\n`);
    fs.writeFileSync(path.join(target, 'canonical-conversion.json'), `${JSON.stringify(record.conversion)}\n`);
    fs.writeFileSync(path.join(target, 'canonical-verification.json'), `${JSON.stringify(record.verification)}\n`);
  });
  const packet = buildInitialImportProposalPacket({ initial_import_source_inventory_digest: sha256Hex('fixture-current-inventory') });
  fs.writeFileSync(path.join(root, 'governed-identity-initial-import-proposal-packet.json'), `${JSON.stringify(packet)}\n`);
  return { cohort, packet };
}

test('recomputes all current cohort bindings and atomically writes one blocked proposal-only readiness receipt', () => {
  const root = temporaryDurableRoot();
  try {
    const { packet } = writeCurrentInputs(root);
    const receipt = buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: root });
    assert.equal(receipt.status, 'BLOCKED_PROPOSAL_ONLY_NOT_AUTHORITY');
    assert.equal(receipt.input_bindings.source_occurrence_count, 41);
    assert.equal(receipt.input_bindings.pending_identity_packet_id, packet.initial_import_proposal_packet_id);
    assert.deepEqual(receipt.readiness_receipt.blockers, [
      'ADOPTED_INITIAL_IMPORT_SEED_POLICY_NOT_IDENTITY_AUTHORITY',
      'UNISSUED_DEAL_IDENTITIES',
      'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED',
      'ROUTINE_PRIMARY_POLICY_NOT_ADOPTED',
      'TOPBUILD_MULTI_OCCURRENCE_DISPOSITION_NOT_ISSUED',
    ]);
    assert.equal(receipt.readiness_receipt.source_intake_authority.authority, 'NONE');
    assert.equal(receipt.readiness_receipt.caller_authority_diagnostic.authority, 'NONE');
    assert.deepEqual(receipt.execution_sources, []);
    assert.equal(receipt.database_authority, 'NONE');
    assert.equal(receipt.production_authority, 'NONE');
    assert.equal(validateCurrentSourceIntakeReadinessMaterialisation({ materialisation: receipt, artifact_root: root }).materialisation_id, receipt.materialisation_id);
    const first = writeCurrentSourceIntakeReadinessMaterialisation({ artifact_root: root, materialisation: receipt });
    assert.equal(first.status, 'WRITTEN');
    assert.equal(first.output_path, path.join(root, OUTPUT_DIRECTORY, `readiness-${receipt.materialisation_id}.json`));
    assert.deepEqual(JSON.parse(fs.readFileSync(first.output_path, 'utf8')), receipt);
    const second = tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation({ artifact_root: root });
    assert.equal(second.status, 'ALREADY_PRESENT');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails closed on a changed adopted policy packet or one changed cohort binding', () => {
  const root = temporaryDurableRoot();
  try {
    writeCurrentInputs(root);
    const packetPath = path.join(root, 'governed-identity-initial-import-proposal-packet.json');
    const packet = JSON.parse(fs.readFileSync(packetPath));
    packet.status = 'PROPOSAL_ONLY_NOT_AUTHORITY';
    fs.writeFileSync(packetPath, JSON.stringify(packet));
    assert.throws(() => buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: root }));
    fs.rmSync(path.join(root, 'm3-corpus-source-capture'), { recursive: true, force: true });
    writeCurrentInputs(root);
    const recordPath = path.join(root, 'm3-corpus-source-capture', 'record-00', 'intake-receipt.json');
    const record = JSON.parse(fs.readFileSync(recordPath));
    record.capture_id = '0'.repeat(64);
    fs.writeFileSync(recordPath, JSON.stringify(record));
    assert.throws(() => buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: root }), { code: 'CURRENT_COHORT_INVALID' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('writer has no provider, network, database, admission, or production execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/source-intake-readiness-writer.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation/);
});

test('current source-intake consumers contain no retired pending-ratification identity status', () => {
  for (const relativePath of [
    'lib/canonical-v2/source-intake-readiness.js',
    'lib/canonical-v2/source-intake-readiness-writer.js',
    'lib/canonical-v2/source-universe-inventory-candidate.js',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /PENDING_NAMESPACE_AND_KEY_DOMAIN_RATIFICATION|PENDING_INITIAL_IMPORT_PACKET_NOT_IDENTITY_AUTHORITY/);
  }
});
