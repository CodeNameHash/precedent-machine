'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildFullCorpusRoutingPromptCostAudit } = require('../lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit');
const {
  AUDIT_OUTPUT_DIRECTORY,
  buildAndWriteContentAddressedAudit,
  writeContentAddressedAudit,
} = require('../lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer');
const { writeFullCorpusRoutingAuditFixtureRoot } = require('./helpers/full-corpus-routing-audit-fixture');

const TEST_ROOT = path.resolve(__dirname, '..');

function temporaryDurableRoot() {
  return fs.mkdtempSync(path.join(TEST_ROOT, '.routing-audit-writer-'));
}

test('writes an audit only beneath an explicit durable root, then returns the same content-addressed output idempotently', () => {
  const sourceRoot = writeFullCorpusRoutingAuditFixtureRoot();
  const audit = buildFullCorpusRoutingPromptCostAudit({ artifact_root: sourceRoot });
  const root = temporaryDurableRoot();
  try {
    const first = writeContentAddressedAudit({ artifact_root: root, audit });
    assert.equal(first.status, 'WRITTEN');
    assert.equal(first.output_path, path.join(root, AUDIT_OUTPUT_DIRECTORY, `audit-${audit.audit_id}.json`));
    assert.deepEqual(JSON.parse(fs.readFileSync(first.output_path, 'utf8')), audit);
    const second = writeContentAddressedAudit({ artifact_root: root, audit });
    assert.equal(second.status, 'ALREADY_PRESENT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('refuses a different byte sequence at the content-addressed path and refuses a missing root', () => {
  const sourceRoot = writeFullCorpusRoutingAuditFixtureRoot();
  const audit = buildFullCorpusRoutingPromptCostAudit({ artifact_root: sourceRoot });
  const root = temporaryDurableRoot();
  try {
    const directory = path.join(root, AUDIT_OUTPUT_DIRECTORY);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `audit-${audit.audit_id}.json`), '{"different":true}\n');
    assert.throws(
      () => writeContentAddressedAudit({ artifact_root: root, audit }),
      (error) => error.code === 'CONTENT_ADDRESS_COLLISION',
    );
    assert.throws(
      () => buildAndWriteContentAddressedAudit({}),
      (error) => error.code === 'DURABLE_ARTIFACT_ROOT_REQUIRED',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('writer and CLI contain no provider, extraction, admission, database or production path', () => {
  for (const file of [
    path.join(TEST_ROOT, 'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer.js'),
    path.join(TEST_ROOT, 'scripts/write-full-corpus-routing-prompt-cost-audit.js'),
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    for (const forbidden of ['createCodex', 'produceCandidate', 'loadAdmittedSource', 'captureDiscoveryRecords', 'createClient', 'fetch(']) {
      assert.equal(source.includes(forbidden), false, `${path.basename(file)} must not include ${forbidden}`);
    }
  }
});
