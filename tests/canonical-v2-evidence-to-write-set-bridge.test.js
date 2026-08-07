// PLAN.md Step 2B, write half. These tests pin the bridge's reading and its
// refusals. They do not yet assert a successful import: 23 of 24 committed
// runs pass validation, and the writer then refuses them for a narrower
// reason recorded below and in PLAN.md Step 2B.

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

test('23 of 24 committed runs pass the resolved validator', () => {
  // An earlier version of this file asserted the opposite -- that all 24 were
  // rejected -- because the bridge called validateCanonicalWriteSet, the
  // GENERIC validator, whose WRITE_SET_KEYS allow-list is for a different
  // write-set shape. An extraction run is a DEAL_SCOPE_RUN and is checked
  // against DEAL_SCOPE_WRITE_SET_KEYS by validateResolvedCanonicalWriteSet.
  // This test pins the real number so that mistake cannot recur silently.
  const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
  const root = path.join(__dirname, '..', 'evidence/canonical-v2');
  const dirs = fs.readdirSync(root)
    .filter((entry) => fs.existsSync(path.join(root, entry, 'adapter-result.json')));
  const bundle = compileFixtureContractV38();
  let passed = 0;
  for (const dir of dirs) {
    const adapter = JSON.parse(fs.readFileSync(path.join(root, dir, 'adapter-result.json'), 'utf8'));
    try {
      validateResolvedCanonicalWriteSet({
        writeSet: adapter.write_set,
        contractBundle: bundle,
        admittedSourceContexts: adapter.admitted_source_contexts,
      });
      passed += 1;
    } catch {
      // Counted, not rethrown: the point is the ratio.
    }
  }
  assert.ok(dirs.length >= 24, `expected at least 24 run directories, found ${dirs.length}`);
  assert.ok(
    passed >= dirs.length - 1,
    `expected at most one validation failure, got ${dirs.length - passed} of ${dirs.length}`,
  );
});

test('KNOWN GAP: import needs the admitted-source chain rebuilt', async () => {
  // Two earlier blockers are CLOSED. The writer's deal-scope key check now
  // accepts write_set_origin (canonical-writer.js, optional-key powerset,
  // matching validate-write-set.js:507), and the bridge supplies a source
  // reference resolver from the run's own admitted_source_contexts.
  //
  // What remains: the writer validates the full admitted-source chain, and
  // `admitted-semantic-source.js:199` requires a `conversion` object matching
  // SEC_HTML_CANONICAL_TEXT_CONVERSION/V2. A run directory does not carry
  // one. It can be rebuilt from the pinned raw HTML -- the same conversion
  // scripts/canonical-v2-generate-family-section-refs.mjs already performs --
  // and that is the remaining work on Step 2B's write half.
  //
  // Asserted rather than skipped so it fails the moment someone closes it.
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    /closed conversion-only V2 contract/,
  );
});

test('the bridge re-validates rather than trusting the file it was handed', async () => {
  // The refusal above is the proof: validation.json already claims the run
  // was validated. The bridge does not take that claim, which is why it can
  // see the divergence at all.
  const validation = JSON.parse(fs.readFileSync(path.join(RUN, 'validation.json'), 'utf8'));
  assert.equal(validation.accepted, true, 'the run claims it was accepted');
  // It gets PAST validation and past the write-set shape check, and fails
  // deeper in the admitted-source chain -- which is itself the proof: the
  // bridge ran the validators rather than trusting the file's own claim.
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    /closed conversion-only V2 contract/,
  );
});
