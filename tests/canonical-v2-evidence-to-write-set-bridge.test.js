// PLAN.md Step 2B, write half. These tests pin the bridge's reading, its
// refusals, and -- since 2026-08-07 -- one successful import all the way
// through the canonical writer with a rebuilt and verified admitted-source
// chain.

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

// A pre-2026-08-07 run: no recorded capture inputs, so its chain cannot be
// rebuilt and it must be refused.
const RUN = path.join(__dirname, '..', 'evidence/canonical-v2/modiv-antitrust-20260806');
// The same family and the same recorded model responses, replayed through the
// current runner with zero model calls, so the run records its capture inputs
// and its chain rebuilds.
const REBUILDABLE_RUN = path.join(__dirname, '..', 'evidence/canonical-v2/modiv-antitrust-20260807-replay');

test('it reads the write-set from adapter-result.json, not validation.json', () => {
  // Both files carry a write-set and reaching for the wrong one is easy.
  // validation.json's publishableWriteSet is the post-split publishable
  // subset and lacks the source-admission keys the writer needs.
  const evidence = readRunEvidence(RUN);
  const adapter = JSON.parse(fs.readFileSync(path.join(RUN, 'adapter-result.json'), 'utf8'));
  // Every adapter key survives; the bridge adds `provisions`, which the
  // adapter's write-set does not carry and the run's validated write-set does.
  for (const key of Object.keys(adapter.write_set)) {
    assert.ok(key in evidence.write_set, `${key} must survive the composition`);
  }
  assert.ok(
    Object.prototype.hasOwnProperty.call(evidence.write_set, 'write_set_origin'),
    'the adapter write-set carries write_set_origin; the publishable subset does not',
  );
  assert.ok(evidence.admitted_source_contexts, 'admitted_source_contexts must travel with the write-set');
});

test('the write-set is composed with the provisions the runner validated against', () => {
  // The defect this pins: adapter-result.json's write_set carries no
  // provisions, and a claim whose governing provision is absent is DROPPED
  // rather than rejected. Importing the adapter's write-set directly wrote 10
  // excerpts, lost all 13 claims, and reported accepted: true. The provisions
  // live in resolution.json, which is where the runner reads them from too
  // (canonical-v2-live-extraction-run.mjs:1114).
  const evidence = readRunEvidence(RUN);
  const adapter = JSON.parse(fs.readFileSync(path.join(RUN, 'adapter-result.json'), 'utf8'));
  assert.equal((adapter.write_set.provisions || []).length, 0, 'the adapter carries no provisions');
  assert.equal(evidence.provisions_recovered_from_resolution, true);
  assert.equal(evidence.write_set.provisions.length, evidence.write_set.claims.length);

  // And the counts the shortfall check measures against are the run's own.
  assert.equal(evidence.published_counts.claims, evidence.write_set.claims.length);
  assert.equal(evidence.published_counts.provisions, evidence.write_set.provisions.length);
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

test('every family has a passing run, and the one historical failure is superseded', () => {
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

  // The single expected failure is modiv-no-other-reps-20260806, a real
  // historical defect (a missing attributes.answer_provenance) from a crash
  // that has since been fixed in the resolver. It is kept rather than
  // deleted: it is the evidence that the defect existed.
  //
  // It is SUPERSEDED by modiv-no-other-reps-20260807-replay, regenerated by
  // replaying that run's own committed responses through the fixed resolver
  // with zero model calls. Assert the replacement exists and passes, so
  // nobody re-runs the family live to fix a problem already fixed.
  const replay = path.join(root, 'modiv-no-other-reps-20260807-replay/adapter-result.json');
  assert.ok(fs.existsSync(replay), 'the superseding replay run must stay committed');
  const replayed = JSON.parse(fs.readFileSync(replay, 'utf8'));
  assert.doesNotThrow(() => validateResolvedCanonicalWriteSet({
    writeSet: replayed.write_set,
    contractBundle: bundle,
    admittedSourceContexts: replayed.admitted_source_contexts,
  }), 'the replayed no-other-reps run must pass the validator the original fails');
});

test('a run that records its capture inputs imports through the writer', async () => {
  // The end of Step 2B's write half, and the first time an extraction run has
  // passed the canonical writer at all. Everything before this asserted
  // refusals.
  //
  // REBUILT is the operative word. The writer takes four primitives from the
  // resolver, rebuilds the admitted-source context from them, and refuses
  // unless the rebuilt reference is byte-identical to this write-set's own
  // source_references. So this passing means the chain was demonstrated from
  // the committed raw HTML, not asserted from the run's own output.
  const result = await importRunEvidence({
    runDirectory: REBUILDABLE_RUN,
    repository: new InMemoryCanonicalRepository(),
    contractBundle: compileFixtureContractV38(),
    dryRun: true,
  });
  assert.equal(result.dry_run, true);
  assert.equal(result.receipt.validation.accepted, true);
  assert.ok(result.receipt.inputDigest, 'a dry run still reports what it would have written');
  assert.ok(
    result.receipt.validation.publishableWriteSet.claims.length > 0,
    'an import that publishes nothing has not demonstrated the path',
  );
  assert.match(result.idempotency_key, /^evidence-bridge:ANTITRUST_REGULATORY:/);
});

test('a run made before capture inputs were recorded is refused, not repaired', async () => {
  // Every run before 2026-08-07 passed `new Date().toISOString()` as the
  // capture's retrieved_at and recorded it nowhere. That timestamp feeds
  // intake_capture_receipt_id -> verification_manifest_id ->
  // immutable_source_document_id, so the chain cannot be rebuilt and the run
  // cannot be imported.
  //
  // The refusal is the correct outcome. The available alternative -- re-derive
  // the source reference from the rebuild and write that -- would make every
  // run import cleanly by editing the evidence until it agreed with itself.
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    /NO_RECORDED_RETRIEVAL_TIMESTAMP/,
  );
});

test('the bridge re-validates rather than trusting the file it was handed', async () => {
  // validation.json already claims the run was validated. The bridge does not
  // take that claim: it runs the validators itself, which is why the refusal
  // above is reachable at all.
  const validation = JSON.parse(fs.readFileSync(path.join(RUN, 'validation.json'), 'utf8'));
  assert.equal(validation.accepted, true, 'the run claims it was accepted');
  await assert.rejects(
    () => importRunEvidence({
      runDirectory: RUN,
      repository: new InMemoryCanonicalRepository(),
      contractBundle: compileFixtureContractV38(),
      dryRun: true,
    }),
    /NO_RECORDED_RETRIEVAL_TIMESTAMP/,
  );
});
