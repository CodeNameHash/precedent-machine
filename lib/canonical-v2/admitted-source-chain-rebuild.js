// Rebuilds an extraction run's admitted-source chain from the run directory.
//
// PLAN.md Step 2B, the last piece of the write half. The writer does not
// accept a pre-built admitted-source context: `canonical-writer.js`'s
// `resolveAdmittedSemanticContexts` takes FOUR PRIMITIVES from the resolver
// -- `immutable_source_document`, `source_admission_manifest`,
// `semantic_extraction_input_envelope`, `conversion` -- rebuilds the context
// from them, and refuses unless the rebuilt reference is byte-identical to
// the write-set's own `source_references[i]`. That refusal is the point: it
// is what stops a caller asserting a lineage it cannot demonstrate.
//
// A run directory carries the finished context (`admitted_source_contexts`
// in adapter-result.json) but not the primitives. It does carry what they
// are derived FROM: `source-reference.json` names the committed raw HTML and
// its sha256. So the chain is rebuildable -- capture, conversion,
// verification, admission bundle -- exactly as the runner built it.
//
// ── THE ENVIRONMENT DEPENDENCE ──────────────────────────────────────────
// For runs made before 2026-08-07 the rebuild is provably impossible, and
// the reason is a defect in the identity contract rather than anything
// missing from the run.
//
// `IMMUTABLE_SOURCE_DOCUMENT/V2` includes `source_map_compressed_sha256`:
// the SHA-256 of the DEFLATE output for the conversion source map
// (`sec-html-canonical-text.js:390`, `compactSourceMapLineage` in
// `sec-source-admission.js:76`). DEFLATE parameters are pinned there --
// level 9, windowBits 15, memLevel 8, Z_DEFAULT_STRATEGY -- but the
// compressor BUILD is not part of the contract, and different zlib builds
// emit different bytes for identical input at identical settings.
//
// Measured on modiv-antitrust-20260806, not inferred:
//   - the uncompressed source map rebuilds byte-identically (6,902,109
//     bytes, and `source_map_digest`, which is a contentId over the
//     uncompressed structure, matches the committed run exactly);
//   - `canonical_text_id` matches the committed run exactly;
//   - `source_map_compressed_sha256` does not, and no combination of the 135
//     available (level, memLevel, strategy) settings on this zlib reproduces
//     the committed digest.
//
// So the committed `immutable_source_document_id` cannot be reproduced here
// by any timestamp or parameter. Two consequences, both enforced below:
//
//   1. A run whose chain does not rebuild is REFUSED, with the divergence
//      named. It is never imported against a re-derived reference -- that
//      would mean editing the evidence until it passes, which is the exact
//      failure this validator exists to catch.
//   2. Runs made on or after 2026-08-07 record their capture inputs in
//      `source-reference.json` (`admitted_source_capture_inputs`) AND persist
//      the compressed source map itself. See below.
//
// Historical runs are recoverable without a model call: replay regenerates
// the run in the current environment (`provider-record-replay.js`), and the
// regenerated directory rebuilds.
//
// ── WHY THE PAYLOAD IS PERSISTED RATHER THAN THE SCHEMA CHANGED ─────────
// The obvious fix is to key `IMMUTABLE_SOURCE_DOCUMENT/V2` on
// `source_map_digest` instead of on compressor output. It is the wrong
// trade. That identity cascades through source_admission_manifest_id ->
// semantic_extraction_input_envelope_id -> admitted_semantic_source_context_id
// -> source_occurrence_id, which is embedded in every excerpt row and is a
// primary and foreign key in `supabase/canonical-v2-foundation.sql` (266,
// 366-382). The contract is also REIMPLEMENTED in Postgres, which enforces
// the exact V2 key set and recomputes the id in SQL (2544-2603, mirrored in
// `sql/optionA/step0b-canonical-writer-by-contract.sql`). Roughly forty test
// files and several committed fixtures pin exact ids.
//
// DEFLATE compression is not deterministic across builds. DEFLATE
// DECOMPRESSION is: it is the standard's, and every zlib inflates the same
// bytes to the same output. So persisting the compressed payload alongside
// the run and verifying it by inflation gives the same property with no
// contract change, no fixture regeneration and no SQL change:
//
//   - rebuild the uncompressed source map independently, from the raw HTML;
//   - inflate the persisted payload;
//   - require the two to be byte-identical;
//   - only then adopt the persisted payload's digest into the chain.
//
// That is verification, not assertion: a payload that does not inflate to
// the independently derived map is rejected, so persisting it cannot be used
// to smuggle in a lineage the document does not support.
//
// It also survives a Node upgrade in place, which the record-the-timestamp
// fix alone does not -- zlib ships inside Node, so upgrading would otherwise
// strand every run directory made before it and recreate this exact loss.
//
// Payloads are stored ONCE, content-addressed by canonical_text_id, under
// `evidence/canonical-v2/_admitted-source-map-payloads/`. Every Modiv run
// converts the same document, so twenty-one runs share one 1.5 MB file
// rather than committing thirty megabytes of identical bytes.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { sha256Hex } = require('./canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('./sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('./sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('./sec-source-admission');

class AdmittedSourceChainError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'AdmittedSourceChainError';
  }
}

// The runner's own policy string, reproduced exactly. It is a digest of a
// sentence, so a single character's difference changes the capture receipt
// and every id downstream of it. Kept here rather than imported because the
// runner is an .mjs script whose constants are not exported and whose import
// runs main().
function retrievalPolicyDigestFor(deal) {
  return sha256Hex(
    `General extraction runner: reuse of the already-admitted, already-committed raw HTML for deal "${deal}"; `
    + 'no new network fetch performed.',
  );
}

function readJson(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    throw new AdmittedSourceChainError('MISSING_FILE', `expected ${absolutePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

// Where a run's compressed source map lives, content-addressed so runs over
// the same document share one file. The runner writes it; this module only
// reads. Kept here rather than in the runner so the two cannot disagree about
// the location.
const SOURCE_MAP_PAYLOAD_STORE = 'evidence/canonical-v2/_admitted-source-map-payloads';

function sourceMapPayloadPathFor(canonicalTextId) {
  return `${SOURCE_MAP_PAYLOAD_STORE}/${canonicalTextId}.deflate`;
}

// Adopts a persisted compressed source map into a freshly rebuilt conversion,
// after proving it decompresses to the map this environment independently
// derived. Refuses on any disagreement: the payload is the only thing here
// that did not come from the document, so it is the only thing that has to
// earn its place.
function adoptPersistedSourceMapPayload({ conversion, payloadBytes, expectedSha256 }) {
  const actualSha = sha256Hex(payloadBytes);
  if (expectedSha256 && actualSha !== expectedSha256) {
    throw new AdmittedSourceChainError(
      'PERSISTED_SOURCE_MAP_DIGEST_MISMATCH',
      `the persisted source map is not the one the run recorded: expected ${expectedSha256}, `
      + `got ${actualSha}.`,
    );
  }
  if (actualSha === conversion.source_map_compressed_sha256) return conversion;

  const rebuilt = zlib.inflateRawSync(
    Buffer.from(conversion.source_map_payload_base64, 'base64'),
    { maxOutputLength: conversion.source_map_uncompressed_byte_length },
  );
  let persisted;
  try {
    persisted = zlib.inflateRawSync(payloadBytes, {
      maxOutputLength: conversion.source_map_uncompressed_byte_length,
    });
  } catch (error) {
    throw new AdmittedSourceChainError(
      'PERSISTED_SOURCE_MAP_UNREADABLE',
      `the persisted source map does not inflate (${error.message}).`,
    );
  }
  if (!rebuilt.equals(persisted)) {
    throw new AdmittedSourceChainError(
      'PERSISTED_SOURCE_MAP_DIVERGES',
      'the persisted source map inflates to something other than the map this environment derives '
      + 'from the document. The payload is the one input here that did not come from the source '
      + 'bytes, so a disagreement means it does not belong to this document.',
    );
  }
  // Byte-identical content, different compressor output. Adopting the
  // persisted bytes reproduces the run's identity without asserting anything
  // the document does not support: source_map_digest is a contentId over the
  // uncompressed structure and is unchanged, and canonical_text_id does not
  // include the compressed digest at all.
  return Object.freeze({
    ...conversion,
    source_map_payload_base64: payloadBytes.toString('base64'),
    source_map_compressed_sha256: actualSha,
  });
}

// Everything the capture builder needs, taken from the run where the run
// records it and reconstructed where it does not. `retrieved_at` is the one
// input a pre-2026-08-07 run cannot supply: the runner passed
// `new Date().toISOString()` and never wrote it down. The rebuild proceeds
// anyway -- the reference comparison is what decides, and reporting "no
// recorded timestamp" as the reason would be wrong when the chain would
// diverge regardless.
function captureInputsFor({ runDirectory, sourceReference, repoRoot }) {
  const recorded = sourceReference.admitted_source_capture_inputs || null;
  const rawHtmlRelative = (recorded && recorded.raw_html_path)
    || sourceReference.reused_committed_raw_html;
  if (!rawHtmlRelative) {
    throw new AdmittedSourceChainError(
      'NO_RAW_HTML_REFERENCE',
      `${runDirectory}/source-reference.json names no committed raw HTML, so the source chain has `
      + 'nothing to rebuild from.',
    );
  }
  const rawHtmlPath = path.isAbsolute(rawHtmlRelative)
    ? rawHtmlRelative
    : path.join(repoRoot, rawHtmlRelative);
  if (!fs.existsSync(rawHtmlPath)) {
    throw new AdmittedSourceChainError('RAW_HTML_NOT_FOUND', rawHtmlPath);
  }
  const rawBytes = fs.readFileSync(rawHtmlPath);

  // Verify before use. The run records the digest it was actually run
  // against; a file that has since changed would rebuild a different -- and
  // entirely plausible -- lineage for the same run.
  const expectedSha = (recorded && recorded.raw_bytes_sha256) || sourceReference.raw_bytes_sha256;
  const actualSha = sha256Hex(rawBytes);
  if (expectedSha && actualSha !== expectedSha) {
    throw new AdmittedSourceChainError(
      'RAW_BYTES_HASH_MISMATCH',
      `${rawHtmlPath} is not the file this run was run against: expected ${expectedSha}, got ${actualSha}.`,
    );
  }

  const deal = sourceReference.deal || null;
  return {
    raw_html_path: rawHtmlPath,
    raw_bytes: rawBytes,
    raw_bytes_sha256: actualSha,
    retrieval_url: (recorded && recorded.retrieval_url) || sourceReference.retrieval_url,
    content_type: (recorded && recorded.content_type) || 'text/html; charset=UTF-8',
    retrieved_at: (recorded && recorded.retrieved_at) || null,
    retrieval_policy_digest: (recorded && recorded.retrieval_policy_digest)
      || (deal ? retrievalPolicyDigestFor(deal) : null),
    source_map_payload_path: (recorded && recorded.source_map_payload_path) || null,
    source_map_compressed_sha256: (recorded && recorded.source_map_compressed_sha256) || null,
    recorded: Boolean(recorded),
  };
}

// The four primitives `canonical-writer.js` asks a resolver for, rebuilt
// from source. Deliberately returns the same shape the writer destructures,
// so the resolver below is a pass-through rather than a translation layer.
function rebuildAdmittedSourcePrimitives({ runDirectory, repoRoot = path.join(__dirname, '..', '..') }) {
  const dir = path.resolve(runDirectory);
  const sourceReference = readJson(path.join(dir, 'source-reference.json'));
  const inputs = captureInputsFor({ runDirectory: dir, sourceReference, repoRoot });

  if (!inputs.retrieved_at) {
    throw new AdmittedSourceChainError(
      'NO_RECORDED_RETRIEVAL_TIMESTAMP',
      `${dir}/source-reference.json has no admitted_source_capture_inputs.retrieved_at. The runner `
      + 'passed a wall-clock timestamp and did not record it, so this run\'s intake capture receipt -- '
      + 'and every identity derived from it -- cannot be reproduced. Regenerate the run by replay '
      + '(zero model calls) rather than guessing a timestamp.',
    );
  }
  if (!inputs.retrieval_policy_digest) {
    throw new AdmittedSourceChainError(
      'NO_RETRIEVAL_POLICY_DIGEST',
      `${dir}/source-reference.json names no deal and records no retrieval_policy_digest, so the `
      + 'capture cannot be rebuilt.',
    );
  }

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: inputs.retrieval_url,
    final_url: inputs.retrieval_url,
    status_code: 200,
    content_type: inputs.content_type,
    retrieved_at: inputs.retrieved_at,
    retrieval_policy_digest: inputs.retrieval_policy_digest,
    redirect_count: 0,
    response_bytes: inputs.raw_bytes,
  });
  let conversion = convertSecHtmlToCanonicalText(capture);
  // Adopt the run's own compressed source map, if it persisted one, after
  // proving it inflates to the map just derived from the document. This is
  // what makes the identity reproducible on a machine whose zlib compresses
  // differently -- including this machine after a Node upgrade.
  if (inputs.source_map_payload_path) {
    const payloadPath = path.isAbsolute(inputs.source_map_payload_path)
      ? inputs.source_map_payload_path
      : path.join(repoRoot, inputs.source_map_payload_path);
    if (!fs.existsSync(payloadPath)) {
      throw new AdmittedSourceChainError(
        'PERSISTED_SOURCE_MAP_NOT_FOUND',
        `${dir} names a persisted source map at ${payloadPath} and it is not there. Without it the `
        + 'chain rebuilds only on a machine whose zlib matches the one that produced the run.',
      );
    }
    conversion = adoptPersistedSourceMapPayload({
      conversion,
      payloadBytes: fs.readFileSync(payloadPath),
      expectedSha256: inputs.source_map_compressed_sha256,
    });
  }
  if (sourceReference.canonical_text_sha256
    && conversion.canonical_text_sha256 !== sourceReference.canonical_text_sha256) {
    throw new AdmittedSourceChainError(
      'CANONICAL_TEXT_HASH_MISMATCH',
      `rebuilt canonical text for ${dir} does not match the run's own record: expected `
      + `${sourceReference.canonical_text_sha256}, got ${conversion.canonical_text_sha256}. The converter `
      + 'has changed since the run, and importing it would attribute this run to text it never saw.',
    );
  }
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new AdmittedSourceChainError(
      'SOURCE_VERIFICATION_FAILED',
      `independent canonical-text verification for ${dir} did not PASS `
      + `(${verification.verification_status}).`,
    );
  }
  const bundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  return {
    immutable_source_document: bundle.immutable_source_document,
    source_admission_manifest: bundle.source_admission_manifest,
    semantic_extraction_input_envelope: bundle.semantic_extraction_input_envelope,
    conversion,
    // Not part of the writer's contract; carried for diagnostics so a caller
    // can say WHICH id diverged rather than only that one did.
    rebuild_diagnostics: {
      raw_html_path: inputs.raw_html_path,
      raw_bytes_sha256: inputs.raw_bytes_sha256,
      retrieved_at: inputs.retrieved_at,
      capture_inputs_were_recorded: inputs.recorded,
      source_map_compressed_sha256: conversion.source_map_compressed_sha256,
      source_map_digest: conversion.source_map_digest,
      canonical_text_id: conversion.canonical_text_id,
    },
  };
}

// Compares a rebuild against the reference the run committed, and explains a
// divergence in terms of what actually differs. A bare
// ADMITTED_SOURCE_REFERENCE_MISMATCH from the writer is true and useless;
// this says whether the canonical text agrees and the compressed source map
// does not, which is the difference between "the document changed" and "the
// compressor did".
function explainReferenceDivergence({ primitives, sourceReferenceRecord }) {
  const rebuilt = primitives.immutable_source_document;
  const differing = [];
  if (rebuilt.immutable_source_document_id !== sourceReferenceRecord.immutable_source_document_id) {
    differing.push('immutable_source_document_id');
  }
  if (primitives.conversion.canonical_text_id !== sourceReferenceRecord.canonical_text_id) {
    differing.push('canonical_text_id');
  }
  if (differing.length === 0) return null;

  const canonicalTextAgrees = !differing.includes('canonical_text_id');
  return {
    differing_fields: differing,
    canonical_text_agrees: canonicalTextAgrees,
    diagnosis: canonicalTextAgrees
      ? 'The canonical text rebuilds exactly, so the document and converter agree. The divergence is '
      + 'upstream of the text: IMMUTABLE_SOURCE_DOCUMENT/V2 includes source_map_compressed_sha256, a '
      + 'DEFLATE output digest, and DEFLATE output is not stable across zlib builds. This run was made '
      + 'in a different environment. Regenerate it by replay in this one -- zero model calls -- rather '
      + 'than re-deriving the reference to make it pass.'
      : 'The canonical text itself does not rebuild, so the converter or the source bytes have changed '
      + 'since the run. Do not import it: the run would be attributed to text it never saw.',
  };
}

// The resolver `canonical-writer.js` asks for, backed by a rebuild rather
// than by the run's own finished contexts. Passing those contexts back would
// satisfy the shape and defeat the check: the writer rebuilds and compares
// precisely so that a caller cannot assert its own lineage.
function createRebuildingSourceReferenceResolver({ runDirectory, repoRoot }) {
  let cached = null;
  return async (sourceReferences) => {
    if (!cached) cached = rebuildAdmittedSourcePrimitives({ runDirectory, repoRoot });
    const { rebuild_diagnostics: diagnostics, ...primitives } = cached;
    return sourceReferences.map((reference) => {
      const divergence = explainReferenceDivergence({
        primitives: cached,
        sourceReferenceRecord: reference,
      });
      if (divergence) {
        throw new AdmittedSourceChainError(
          'SOURCE_CHAIN_NOT_REBUILDABLE',
          `${runDirectory}: the admitted-source chain does not rebuild to the reference this run `
          + `committed. Differing: ${divergence.differing_fields.join(', ')}. ${divergence.diagnosis} `
          + `(rebuilt source_map_compressed_sha256 ${diagnostics.source_map_compressed_sha256}, `
          + `source_map_digest ${diagnostics.source_map_digest}.)`,
        );
      }
      return primitives;
    });
  };
}

module.exports = {
  AdmittedSourceChainError,
  SOURCE_MAP_PAYLOAD_STORE,
  sourceMapPayloadPathFor,
  adoptPersistedSourceMapPayload,
  retrievalPolicyDigestFor,
  rebuildAdmittedSourcePrimitives,
  explainReferenceDivergence,
  createRebuildingSourceReferenceResolver,
};
