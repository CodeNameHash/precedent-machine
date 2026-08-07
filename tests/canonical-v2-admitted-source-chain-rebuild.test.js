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
  retrievalPolicyDigestFor,
  rebuildAdmittedSourcePrimitives,
  explainReferenceDivergence,
  createRebuildingSourceReferenceResolver,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');

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
  const reference = adapter.write_set.source_references[0];
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

test('the identity contract depends on DEFLATE output, which is why history is unimportable', () => {
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

  // The historical run's compressed digest is unreachable from these bytes at
  // any available setting. If a future zlib change made it reachable, this
  // assertion fails and the header's claim needs revisiting -- which is the
  // point of pinning it.
  const historical = 'd9da156bd091bc9ed1d3ae4609814b0fa2e016d1da270acc771d57c3f691cb50';
  let reachable = null;
  for (const level of [1, 5, 9]) {
    for (const memLevel of [7, 8, 9]) {
      const candidate = zlib.deflateRawSync(uncompressed, {
        level, memLevel, windowBits: 15, strategy: zlib.constants.Z_DEFAULT_STRATEGY,
      });
      if (crypto.createHash('sha256').update(candidate).digest('hex') === historical) {
        reachable = { level, memLevel };
      }
    }
  }
  assert.equal(reachable, null, 'the historical compressed source map is not reproducible here');
  assert.notEqual(conversion.source_map_compressed_sha256, historical);
});
