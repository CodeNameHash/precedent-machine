// PLAN.md Step 2B. The canonical writer will not accept a caller's assertion
// of source lineage: it rebuilds the admitted-source context from four
// primitives and compares. These tests pin what the rebuild does, and -- more
// importantly -- pin the two ways it must refuse, because the refusals are
// the only thing standing between "this run is imported" and "this run was
// edited until it imported".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const {
  AdmittedSourceChainError,
  SOURCE_MAP_PAYLOAD_STORE,
  sourceMapPayloadPathFor,
  adoptPersistedSourceMapPayload,
  retrievalPolicyDigestFor,
  rebuildAdmittedSourcePrimitives,
  explainReferenceDivergence,
  createRebuildingSourceReferenceResolver,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { CONVERTER_DIGEST } = require('../lib/canonical-v2/sec-html-canonical-text');

const REPO = path.join(__dirname, '..');
const REBUILDABLE = path.join(REPO, 'evidence/canonical-v2/modiv-antitrust-20260807-replay');
const HISTORICAL = path.join(REPO, 'evidence/canonical-v2/modiv-antitrust-20260806');

test('the policy digest matches the string the runner actually hashes', () => {
  // The digest is of a sentence. One character's drift between the runner and
  // this module changes intake_capture_receipt_id and every identity below
  // it, and the only symptom would be an unexplained reference mismatch at
  // import time. The runner imports this function rather than restating the
  // string; this test pins the string itself so an edit to it is deliberate.
  const expected = crypto.createHash('sha256').update(
    'General extraction runner: reuse of the already-admitted, already-committed raw HTML for deal '
    + '"modiv"; no new network fetch performed.',
  ).digest('hex');
  assert.equal(retrievalPolicyDigestFor('modiv'), expected);
  assert.notEqual(retrievalPolicyDigestFor('modiv'), retrievalPolicyDigestFor('topbuild'));
});

test('it rebuilds the four primitives the writer asks for, and nothing else', () => {
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  // canonical-writer.js resolveAdmittedSemanticContexts reads exactly these.
  for (const key of [
    'immutable_source_document',
    'source_admission_manifest',
    'semantic_extraction_input_envelope',
    'conversion',
  ]) {
    assert.ok(primitives[key], `the writer destructures ${key}`);
  }
  assert.equal(primitives.conversion.schema_version, 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2');
  assert.equal(primitives.conversion.conversion_stage, 'CONVERSION_ONLY');
});

test('the rebuild lands on the identity the run committed', () => {
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const adapter = JSON.parse(fs.readFileSync(path.join(REBUILDABLE, 'adapter-result.json'), 'utf8'));
  const sourceReference = JSON.parse(fs.readFileSync(path.join(REBUILDABLE, 'source-reference.json'), 'utf8'));
  const reference = adapter.write_set.source_references[0];
  assert.equal(primitives.conversion.converter_digest, CONVERTER_DIGEST);
  assert.equal(
    primitives.conversion.source_map_digest,
    sourceReference.admitted_source_capture_inputs.source_map_digest,
  );
  assert.equal(
    primitives.conversion.source_map_compressed_sha256,
    sourceReference.admitted_source_capture_inputs.source_map_compressed_sha256,
  );
  assert.equal(
    primitives.immutable_source_document.immutable_source_document_id,
    reference.immutable_source_document_id,
  );
  assert.equal(primitives.conversion.canonical_text_id, reference.canonical_text_id);
  assert.equal(explainReferenceDivergence({ primitives, sourceReferenceRecord: reference }), null);
});

test('a run with no recorded retrieval timestamp is refused', () => {
  // Not "degraded", not "best effort". The runner passed a wall-clock value
  // and wrote it nowhere, so the capture receipt is unreproducible, and every
  // identity derived from it with it.
  assert.throws(
    () => rebuildAdmittedSourcePrimitives({ runDirectory: HISTORICAL }),
    (error) => error instanceof AdmittedSourceChainError
      && error.code === 'NO_RECORDED_RETRIEVAL_TIMESTAMP',
  );
});

test('it verifies the raw HTML before converting it', () => {
  // The run records the digest it was actually run against. A file that has
  // changed since would rebuild a different -- and entirely plausible --
  // lineage for the same run, which is worse than not rebuilding at all.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-rebuild-'));
  const runDirectory = path.join(scratch, 'run');
  fs.mkdirSync(runDirectory);
  const sourceReference = JSON.parse(
    fs.readFileSync(path.join(REBUILDABLE, 'source-reference.json'), 'utf8'),
  );
  const decoy = path.join(scratch, 'decoy.htm');
  fs.writeFileSync(decoy, '<html>not the pinned document</html>');
  sourceReference.admitted_source_capture_inputs.raw_html_path = decoy;
  fs.writeFileSync(path.join(runDirectory, 'source-reference.json'), JSON.stringify(sourceReference));

  assert.throws(
    () => rebuildAdmittedSourcePrimitives({ runDirectory }),
    (error) => error.code === 'RAW_BYTES_HASH_MISMATCH',
  );
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('the resolver refuses a divergent chain rather than returning it', async () => {
  // The failure this guards against is not a crash, it is a clean import of a
  // run whose lineage was never demonstrated. The resolver could satisfy the
  // writer by handing back the run's own finished contexts; it must not.
  const resolver = createRebuildingSourceReferenceResolver({ runDirectory: REBUILDABLE });
  const adapter = JSON.parse(fs.readFileSync(path.join(REBUILDABLE, 'adapter-result.json'), 'utf8'));
  const tampered = {
    ...adapter.write_set.source_references[0],
    immutable_source_document_id: 'f'.repeat(64),
  };
  await assert.rejects(
    () => resolver([tampered]),
    (error) => error.code === 'SOURCE_CHAIN_NOT_REBUILDABLE',
  );
  // And it resolves the untampered one, so the refusal above is discriminating.
  const resolved = await resolver(adapter.write_set.source_references);
  assert.equal(resolved.length, adapter.write_set.source_references.length);
  assert.ok(resolved[0].immutable_source_document);
  assert.ok(!('rebuild_diagnostics' in resolved[0]), 'diagnostics must not leak into the writer input');
});

test('a divergence is diagnosed by what actually differs', () => {
  // "ADMITTED_SOURCE_REFERENCE_MISMATCH" is true and useless. The difference
  // between "the document changed" and "the compressor did" decides whether
  // the run is regenerable or suspect, so the diagnosis distinguishes them.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const adapter = JSON.parse(fs.readFileSync(path.join(REBUILDABLE, 'adapter-result.json'), 'utf8'));
  const reference = adapter.write_set.source_references[0];

  const compressorDrift = explainReferenceDivergence({
    primitives,
    sourceReferenceRecord: { ...reference, immutable_source_document_id: 'a'.repeat(64) },
  });
  assert.equal(compressorDrift.canonical_text_agrees, true);
  assert.match(compressorDrift.diagnosis, /DEFLATE output digest/);

  const documentDrift = explainReferenceDivergence({
    primitives,
    sourceReferenceRecord: { ...reference, canonical_text_id: 'b'.repeat(64) },
  });
  assert.equal(documentDrift.canonical_text_agrees, false);
  assert.match(documentDrift.diagnosis, /text it never saw/);
});

test('the identity contract distinguishes DEFLATE output for the same source map', () => {
  // This is the measurement behind that diagnosis, kept as a test so the
  // claim in the module header stays true or fails loudly.
  //
  // IMMUTABLE_SOURCE_DOCUMENT/V2 carries source_map_compressed_sha256 -- a
  // digest of compressor OUTPUT. The parameters are pinned; the zlib build is
  // not part of any contract. So the same source map on two machines can
  // produce two immutable_source_document_ids, and the historical Modiv runs
  // are exactly that case: same uncompressed source map (source_map_digest
  // matches), different compressed bytes.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const conversion = primitives.conversion;
  const uncompressed = zlib.inflateRawSync(
    Buffer.from(conversion.source_map_payload_base64, 'base64'),
    { maxOutputLength: 1 << 30 },
  );
  assert.equal(uncompressed.length, conversion.source_map_uncompressed_byte_length);

  const alternative = zlib.deflateRawSync(uncompressed, {
    level: 1,
    memLevel: 8,
    windowBits: 15,
    strategy: zlib.constants.Z_DEFAULT_STRATEGY,
  });
  assert.notEqual(
    crypto.createHash('sha256').update(alternative).digest('hex'),
    conversion.source_map_compressed_sha256,
  );
});

// ─── The persisted compressed source map ─────────────────────────────────
//
// The fix for the environment dependence above. DEFLATE compression is not
// deterministic across zlib builds; DEFLATE decompression is. So the run
// persists its compressed source map and a rebuild adopts those bytes -- but
// only after proving they inflate to the map it independently derived from
// the document. These tests pin that "only after".

test('runs share one content-addressed payload rather than a copy each', () => {
  const store = path.join(REPO, SOURCE_MAP_PAYLOAD_STORE);
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const expected = sourceMapPayloadPathFor(primitives.conversion.canonical_text_id);
  assert.ok(fs.existsSync(path.join(REPO, expected)), `${expected} must be committed`);
  // Twenty-one Modiv runs convert the same document. One file, not twenty-one.
  const payloads = fs.readdirSync(store).filter((name) => name.endsWith('.deflate'));
  const runs = fs.readdirSync(path.join(REPO, 'evidence/canonical-v2'))
    .filter((name) => name.endsWith('-replay'));
  assert.ok(runs.length > payloads.length, 'payloads are shared, not per-run');
});

test('every regenerated run names a payload that is actually there', () => {
  const root = path.join(REPO, 'evidence/canonical-v2');
  const runs = fs.readdirSync(root).filter((name) => name.endsWith('-replay'));
  assert.ok(runs.length >= 20, `expected the regenerated baseline, found ${runs.length} run(s)`);
  for (const run of runs) {
    const reference = JSON.parse(
      fs.readFileSync(path.join(root, run, 'source-reference.json'), 'utf8'),
    );
    const named = reference.admitted_source_capture_inputs.source_map_payload_path;
    assert.ok(named, `${run} names no persisted source map`);
    assert.ok(fs.existsSync(path.join(REPO, named)), `${run} names ${named}, which is missing`);
    // Recorded relative to the repository root, never absolute: an absolute
    // path is machine-specific and resolves nowhere else.
    assert.ok(!path.isAbsolute(named), `${run} recorded an absolute payload path`);
  }
});

test('a payload that inflates to something else is refused', () => {
  // The payload is the one input to the chain that does not come from the
  // source bytes, so it is the only one that has to earn its place. If it
  // could be adopted unverified, persisting it would be a way to smuggle in a
  // lineage the document does not support.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const foreign = zlib.deflateRawSync(Buffer.from('not this document\'s source map', 'utf8'));
  assert.throws(
    () => adoptPersistedSourceMapPayload({
      conversion: primitives.conversion,
      payloadBytes: foreign,
      expectedSha256: crypto.createHash('sha256').update(foreign).digest('hex'),
    }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_DIVERGES',
  );

  const notDeflate = Buffer.from('not deflate data at all');
  assert.throws(
    () => adoptPersistedSourceMapPayload({
      conversion: primitives.conversion,
      payloadBytes: notDeflate,
      // Its own digest, so the check that fails is the inflation, not the
      // digest -- otherwise this would pass for the wrong reason.
      expectedSha256: crypto.createHash('sha256').update(notDeflate).digest('hex'),
    }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_UNREADABLE',
  );

  assert.throws(
    () => adoptPersistedSourceMapPayload({
      conversion: primitives.conversion,
      payloadBytes: foreign,
      expectedSha256: 'e'.repeat(64),
    }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_DIGEST_MISMATCH',
  );
});

test('a payload compressed differently but identical in content is adopted', () => {
  // The whole point. Re-compress the same source map at a different level to
  // stand in for another zlib build, and require the rebuild to take it --
  // the identity must follow the recorded bytes, not this machine's
  // compressor. Anything less and the run stays machine-bound.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const uncompressed = zlib.inflateRawSync(
    Buffer.from(primitives.conversion.source_map_payload_base64, 'base64'),
    { maxOutputLength: 1 << 30 },
  );
  const otherBuild = zlib.deflateRawSync(uncompressed, { level: 6, windowBits: 15, memLevel: 8 });
  const otherSha = crypto.createHash('sha256').update(otherBuild).digest('hex');
  assert.notEqual(otherSha, primitives.conversion.source_map_compressed_sha256);

  const adopted = adoptPersistedSourceMapPayload({
    conversion: primitives.conversion,
    payloadBytes: otherBuild,
    expectedSha256: otherSha,
  });
  assert.equal(adopted.source_map_compressed_sha256, otherSha);
  // And nothing derived from the uncompressed structure moves.
  assert.equal(adopted.source_map_digest, primitives.conversion.source_map_digest);
  assert.equal(adopted.canonical_text_id, primitives.conversion.canonical_text_id);
  assert.equal(
    adopted.source_map_uncompressed_byte_length,
    primitives.conversion.source_map_uncompressed_byte_length,
  );
});

test('a run naming a payload that is gone is refused, not quietly rebuilt', () => {
  // Falling back to this machine's compression would look like it worked and
  // would produce a different identity, which is the failure the payload
  // exists to prevent.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-payload-'));
  const runDirectory = path.join(scratch, 'run');
  fs.mkdirSync(runDirectory);
  const reference = JSON.parse(
    fs.readFileSync(path.join(REBUILDABLE, 'source-reference.json'), 'utf8'),
  );
  reference.admitted_source_capture_inputs.source_map_payload_path = `${SOURCE_MAP_PAYLOAD_STORE}/gone.deflate`;
  fs.writeFileSync(path.join(runDirectory, 'source-reference.json'), JSON.stringify(reference));
  assert.throws(
    () => rebuildAdmittedSourcePrimitives({ runDirectory }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_NOT_FOUND',
  );
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('a payload with no recorded digest is refused, not adopted on inflation alone', () => {
  // Inflation equality is not identity. zlib stops at the end of a deflate
  // stream and ignores trailing bytes, so a payload can carry arbitrary extra
  // data and still inflate to exactly the right map. The recorded digest is
  // what pins it, so a missing digest must refuse rather than fall through.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const payload = Buffer.from(primitives.conversion.source_map_payload_base64, 'base64');
  assert.throws(
    () => adoptPersistedSourceMapPayload({
      conversion: primitives.conversion,
      payloadBytes: payload,
      expectedSha256: null,
    }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_UNVERIFIABLE',
  );
});

test('trailing bytes after the deflate stream do not slip through', () => {
  // The concrete version of the above: zlib inflates this to the correct map
  // and reports no error. Only the digest check catches it.
  const primitives = rebuildAdmittedSourcePrimitives({ runDirectory: REBUILDABLE });
  const payload = Buffer.from(primitives.conversion.source_map_payload_base64, 'base64');
  const withGarbage = Buffer.concat([payload, Buffer.from('smuggled', 'utf8')]);

  // First: prove the premise, so this test fails loudly if zlib ever changes.
  const inflated = zlib.inflateRawSync(withGarbage, { maxOutputLength: 1 << 30 });
  assert.equal(inflated.length, primitives.conversion.source_map_uncompressed_byte_length);

  assert.throws(
    () => adoptPersistedSourceMapPayload({
      conversion: primitives.conversion,
      payloadBytes: withGarbage,
      expectedSha256: primitives.conversion.source_map_compressed_sha256,
    }),
    (error) => error.code === 'PERSISTED_SOURCE_MAP_DIGEST_MISMATCH',
  );
});
