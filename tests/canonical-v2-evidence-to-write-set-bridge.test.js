// PLAN.md Step 2B, write half. These tests pin the bridge's reading and its
// refusals. They deliberately do NOT assert a successful import: no committed
// run can currently be imported, and the reason is recorded below and in
// PLAN.md Step 2B rather than worked around.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EvidenceBridgeError,
  readRunEvidence,
  idempotencyKeyFor,
  importRunEvidence,
} = require('../lib/canonical-v2/evidence-to-write-set-bridge');
const { InMemoryCanonicalRepository } = require('../lib/canonical-v2/canonical-writer');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');

const RUN = path.join(__dirname, '..', 'evidence/canonical-v2/modiv-antitrust-20260806');

test('it reads the write-set from adapter-result.json, not validation.json', () => {
  // Both files carry a write-set and reaching for the wrong one is easy.
  // validation.json's publishableWriteSet is the post-split publishable
  // subset and lacks the source-admission keys the writer needs.
  const evidence = readRunEvidence(RUN);
  const adapter = JSON.parse(fs.readFileSync(path.join(RUN, 'adapter-result.json'), 'utf8'));
  assert.deepEqual(Object.keys(evidence.write_set).sort(), Object.keys(adapter.write_set).sort());
  assert.ok(
    Object.prototype.hasOwnProperty.call(evidence.write_set, 'write_set_origin'),
    'the adapter write-set carries write_set_origin; the publishable subset does not',
  );
  assert.ok(evidence.admitted_source_contexts, 'admitted_source_contexts must travel with the write-set');
});

test('provenance travels with the run so an import is traceable', () => {
  const evidence = readRunEvidence(RUN);
  assert.equal(evidence.provenance.deal, 'modiv');
  assert.equal(evidence.provenance.section_family, 'ANTITRUST_REGULATORY');
  assert.ok(evidence.provenance.document_hash, 'document_hash is required for a stable idempotency key');
  assert.equal(evidence.provenance.has_manifest, true);
});

test('the idempotency key is stable across reads of the same run', () => {
  const first = idempotencyKeyFor(readRunEvidence(RUN));
  const second = idempotencyKeyFor(readRunEvidence(RUN));
  assert.equal(first, second);
  assert.match(first, /^evidence-bridge:ANTITRUST_REGULATORY:/);
});

test('a run with no manifest still gets a stable key rather than none', () => {
  // Four committed Modiv directories have no run-manifest.json
  // (CODEBASE-GUIDE section 12.5). Import must not be blocked by an artefact
  // a legitimate historical run never wrote.
  const key = idempotencyKeyFor({
    run_directory: '/tmp/whatever/modiv-capitalisation-20260806',
    provenance: { document_hash: null, section_family: null },
  });
  assert.equal(key, 'evidence-bridge:dir:modiv-capitalisation-20260806');
});

test('it refuses a missing run directory', () => {
  assert.throws(() => readRunEvidence('/tmp/definitely-not-a-run-dir'), /MISSING_RUN_DIRECTORY/);
});

test('it refuses to write without a repository or a contract bundle', async () => {
  await assert.rejects(
    () => importRunEvidence({ runDirectory: RUN, contractBundle: {} }),
    /REPOSITORY_REQUIRED/,
  );
  await assert.rejects(
    () => importRunEvidence({ runDirectory: RUN, repository: new InMemoryCanonicalRepository() }),
    /CONTRACT_BUNDLE_REQUIRED/,
  );
});

test('KNOWN GAP: every committed run is rejected by the current validator', async () => {
  // Measured 2026-08-07 across all 24 evidence directories carrying an
  // adapter-result.json: 24 of 24 rejected, every one on the same two keys.
  //
  // The runner emits `definition_occurrences` and `source_references` in its
  // write-set. validate-write-set.js's WRITE_SET_KEYS contains neither --
  // though CANONICAL_COLLECTION_KEYS, in the same file, DOES list
  // `definition_occurrences`. So the validator disagrees with itself, and
  // with the producer.
  //
  // This test asserts the CURRENT state on purpose. It is not accepting the
  // defect: it makes the defect visible and will fail the moment someone
  // fixes it, which is the prompt to delete this test and assert a real
  // import instead. Silently skipping the import, or loosening the bridge to
  // strip the offending keys, would hide a producer/validator divergence
  // behind a green suite.
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    (err) => {
      assert.ok(err instanceof EvidenceBridgeError);
      assert.equal(err.code, 'REVALIDATION_FAILED');
      assert.match(err.message, /outside the fixed contract/);
      return true;
    },
  );
});

test('the bridge re-validates rather than trusting the file it was handed', async () => {
  // The refusal above is the proof: validation.json already claims the run
  // was validated. The bridge does not take that claim, which is why it can
  // see the divergence at all.
  const validation = JSON.parse(fs.readFileSync(path.join(RUN, 'validation.json'), 'utf8'));
  assert.equal(validation.accepted, true, 'the run claims it was accepted');
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    /REVALIDATION_FAILED/,
  );
});
