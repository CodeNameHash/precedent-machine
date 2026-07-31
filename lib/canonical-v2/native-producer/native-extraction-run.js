/**
 * lib/canonical-v2/native-producer/native-extraction-run.js
 *
 * The single wiring point that turns an admitted merger agreement's raw
 * text into compiled candidates, with no hand-authored payload anywhere in
 * the chain. This module owns NO legal judgment and NO model logic of its
 * own -- it composes the four existing native-producer pieces in order:
 *
 *   1. deterministic-sectionizer.js    -- discovers the section tree and its
 *                                          exact byte offsets from the bytes
 *                                          actually admitted, not constants.
 *   2. capitalisation-producer-prompt.js -- builds the prompt for each
 *                                          resolved governed scope (recorded
 *                                          into the run receipt for audit;
 *                                          the provider is free to rebuild
 *                                          the identical prompt itself).
 *   3. provider-interface.js / anthropic-provider.js -- calls the injected
 *                                          provider under produceCandidateProposals's
 *                                          seam, receiving proposals plus a
 *                                          content-addressed producer receipt.
 *   4. candidate-proposal-compiler.js  -- compiles in-scope proposals into
 *                                          claim/relationship candidates with
 *                                          their own closure_id.
 *
 * GOVERNED SCOPE COMES FROM DISCOVERY, NOT CONSTANTS. Each requested
 * `section_reference` is resolved against the sectionizer's tree via
 * `findSectionByReference`. The governed scope handed to the producer for
 * that reference is built from the resolved node's EXACT byte offsets --
 * nothing here reads a hand-picked {start,end} constant.
 *
 * FAIL CLOSED ON UNRESOLVABLE REFERENCES. If any requested section_reference
 * cannot be resolved, this function throws a typed
 * `NativeExtractionRunError('SECTION_REFERENCE_UNRESOLVED', ...)` BEFORE any
 * provider is ever called for ANY reference in the batch. It never falls
 * back to sectionizing/extracting from the whole document -- a silent scope
 * widening would make a NOT_EXAMINED reference look like a real search.
 *
 * SCOPE DISCIPLINE ON THE WAY OUT, NOT JUST THE WAY IN. The producer is
 * handed only the resolved section's own exact text as `governed_scope.
 * source_text` (never the whole document), so a compliant provider's
 * evidence offsets are necessarily local to that section's bytes. This
 * module additionally verifies, independently of the provider's own
 * cooperation, that every returned proposal's evidence offsets are real,
 * half-open, in-bounds positions inside that same section text AND that the
 * byte slice at those offsets reproduces the proposal's own raw_value
 * exactly. A proposal that fails either check is never handed to the
 * compiler: it is rejected as a typed `scope_violations` entry, distinct
 * from the producer's own `evidence_residuals` (which are the *provider's*
 * admissions that it could not evidence something -- both are carried
 * through to the run receipt, never dropped).
 *
 * CONTENT-ADDRESSED AND DETERMINISTIC. The returned run receipt is built
 * from nothing but its own inputs and the (assumed deterministic, e.g.
 * stubbed-in-tests or --replay'd) provider output: the same source text,
 * document hash, section references, definitions, contract bundle and
 * provider responses always produce a byte-identical receipt, including its
 * own content-addressed `run_receipt_id`.
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const {
  sectionizeAdmittedSource,
  findSectionByReference,
} = require('./deterministic-sectionizer');
const { buildCapitalisationProducerPrompt } = require('./capitalisation-producer-prompt');
const { produceCandidateProposals } = require('./provider-interface');
const { compileCandidateProposals } = require('./candidate-proposal-compiler');

const RUN_RECEIPT_SCHEMA = 'NATIVE_EXTRACTION_RUN_RECEIPT/V1';
const GOVERNED_SCOPE_SCHEMA = 'NATIVE_EXTRACTION_GOVERNED_SCOPE/V1';
const PROMPT_DIGEST_DOMAIN = 'NATIVE_EXTRACTION_RUN_PROMPT/V1';
const EXTRACTOR_ID = 'canonical-v2-native-extraction-run/v1';
const EXTRACTOR_VERSION = '1';

class NativeExtractionRunError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeExtractionRunError';
    this.code = code;
    this.details = details;
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new NativeExtractionRunError('INVALID_INPUT', `${label} must be a non-empty string`);
  }
  return value;
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeExtractionRunError('INVALID_INPUT', `${label} must be a plain object`);
  }
  return value;
}

function requireSectionReferenceList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new NativeExtractionRunError(
      'INVALID_INPUT',
      'section_references must be a non-empty array of section reference strings',
    );
  }
  return value.map((ref, index) => requireNonEmptyString(ref, `section_references[${index}]`));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

// UTF-8 byte-exact slicing, matching the sectionizer's own offset semantics
// (deterministic-sectionizer.js's node.start/node.end are UTF-8 byte
// offsets into source_text, produced by the same charToByteOffset scheme).
function sliceSectionText(sourceText, start, end) {
  return Buffer.from(sourceText, 'utf8').subarray(start, end).toString('utf8');
}

/**
 * Verifies one proposal's evidence stays entirely inside the section text
 * the producer was actually shown, and that each edge's byte slice
 * reproduces the proposal's own raw_value exactly. Returns
 * `{ ok: true }` or `{ ok: false, reason, edge }` -- never throws, so a
 * batch of proposals is filtered rather than aborted by one bad citation.
 */
function checkEvidenceScope(proposal, sectionBytes) {
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : [];
  for (const edge of evidence) {
    const inBounds = Number.isSafeInteger(edge.absolute_start) && edge.absolute_start >= 0
      && Number.isSafeInteger(edge.absolute_end) && edge.absolute_end > edge.absolute_start
      && edge.absolute_end <= sectionBytes.length;
    if (!inBounds) {
      return { ok: false, reason: 'EVIDENCE_OUTSIDE_GOVERNED_SCOPE', edge };
    }
    if (typeof proposal.raw_value === 'string') {
      const slice = sectionBytes.subarray(edge.absolute_start, edge.absolute_end).toString('utf8');
      if (slice !== proposal.raw_value) {
        return { ok: false, reason: 'EVIDENCE_TEXT_MISMATCH', edge };
      }
    }
  }
  return { ok: true };
}

/**
 * @param {object} args
 * @param {string} args.source_text          the admitted merger-agreement text, in full
 * @param {string} args.document_hash        content hash binding this run to the admitted text
 * @param {string[]} args.section_references  section references to resolve and extract,
 *                                            e.g. ["3.1(b)", "5.2"]
 * @param {object} args.contract_bundle      the compiled contract bundle framing this run
 * @param {object} args.definitions          the claim/relationship definition catalogue
 * @param {(input: {governed_scope, definitions, contract_bundle}) =>
 *   (Promise<object>|object)} args.provider  injected producer (test stub, --replay fixture,
 *                                            or a real createAnthropicProvider(...) instance)
 * @returns {Promise<object>} a frozen, content-addressed run receipt
 */
async function runNativeExtraction({
  source_text: sourceText,
  document_hash: documentHash,
  section_references: sectionReferences,
  contract_bundle: contractBundle,
  definitions,
  provider,
} = {}) {
  requireNonEmptyString(sourceText, 'source_text');
  requireNonEmptyString(documentHash, 'document_hash');
  const references = requireSectionReferenceList(sectionReferences);
  requirePlainObject(contractBundle, 'contract_bundle');
  requirePlainObject(definitions, 'definitions');
  if (typeof provider !== 'function') {
    throw new NativeExtractionRunError('INVALID_INPUT', 'provider must be a function');
  }

  const tree = sectionizeAdmittedSource({ source_text: sourceText, document_hash: documentHash });

  // Resolve EVERY requested reference before calling the provider for ANY
  // of them: a batch with one unresolvable reference fails closed as a
  // whole, rather than partially extracting the references that happened
  // to resolve first.
  const resolved = references.map((reference) => {
    const node = findSectionByReference(tree, reference);
    if (!node) {
      throw new NativeExtractionRunError(
        'SECTION_REFERENCE_UNRESOLVED',
        `requested section reference "${reference}" could not be resolved against the sectionized `
          + 'document: refusing to widen scope to the whole document',
        { section_reference: reference },
      );
    }
    return { reference, node };
  });

  const knownDefinitions = Array.isArray(definitions.known_definitions) ? definitions.known_definitions : [];

  const resolvedSections = [];
  const evidenceResiduals = [];
  const scopeViolations = [];
  const compiledCandidates = [];

  for (const { reference, node } of resolved) {
    const sectionText = sliceSectionText(sourceText, node.start, node.end);
    const sectionBytes = Buffer.from(sectionText, 'utf8');

    const governedScope = Object.freeze({
      schema_version: GOVERNED_SCOPE_SCHEMA,
      document_hash: documentHash,
      section_reference: reference,
      section_id: node.section_id,
      parent_section_id: node.parent_section_id,
      kind: node.kind,
      depth: node.depth,
      start: node.start,
      end: node.end,
      text_sha256: node.text_sha256,
      source_text: sectionText,
    });

    const prompt = buildCapitalisationProducerPrompt({
      source_text: sectionText,
      governed_scope: governedScope,
      known_definitions: knownDefinitions,
    });
    const promptDigest = contentId(PROMPT_DIGEST_DOMAIN, prompt.messages);

    // eslint-disable-next-line no-await-in-loop
    const {
      proposals,
      evidence_residuals: providerResiduals,
      producer_receipt: producerReceipt,
    } = await produceCandidateProposals({
      governed_scope: governedScope,
      definitions,
      contract_bundle: contractBundle,
      provider,
    });

    for (const residual of providerResiduals) {
      evidenceResiduals.push({ section_reference: reference, ...residual });
    }

    const inScopeProposals = [];
    for (const proposal of proposals) {
      const scopeCheck = checkEvidenceScope(proposal, sectionBytes);
      if (!scopeCheck.ok) {
        scopeViolations.push({
          section_reference: reference,
          reason: scopeCheck.reason,
          edge: scopeCheck.edge,
          proposal_kind: proposal.kind,
          claim_definition_key: proposal.claim_definition_key || null,
          relationship_definition_key: proposal.relationship_definition_key || null,
        });
        continue;
      }
      inScopeProposals.push(proposal);
    }

    const compileResults = compileCandidateProposals({
      proposals: inScopeProposals,
      governed_scope: governedScope,
      producer_receipt: producerReceipt,
      extractor_id: EXTRACTOR_ID,
      extractor_version: EXTRACTOR_VERSION,
    });
    for (const result of compileResults) {
      compiledCandidates.push({ section_reference: reference, ...result });
    }

    resolvedSections.push({
      section_reference: reference,
      section_id: node.section_id,
      parent_section_id: node.parent_section_id,
      kind: node.kind,
      depth: node.depth,
      start: node.start,
      end: node.end,
      text_sha256: node.text_sha256,
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      prompt_digest: promptDigest,
      producer_receipt: producerReceipt,
    });
  }

  const receiptBody = {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: documentHash,
    source_sha256: tree.source_sha256,
    source_byte_length: tree.source_byte_length,
    root_section_id: tree.root_section_id,
    requested_section_references: references,
    resolved_sections: resolvedSections,
    compiled_candidates: compiledCandidates,
    evidence_residuals: evidenceResiduals,
    scope_violations: scopeViolations,
    evidence_residual_count: evidenceResiduals.length,
    scope_violation_count: scopeViolations.length,
    compiled_candidate_count: compiledCandidates.filter((entry) => entry.ok).length,
    rejected_candidate_count: compiledCandidates.filter((entry) => !entry.ok).length,
  };
  const runReceiptId = contentId(RUN_RECEIPT_SCHEMA, receiptBody);

  return deepFreeze({ ...receiptBody, run_receipt_id: runReceiptId });
}

module.exports = {
  RUN_RECEIPT_SCHEMA,
  GOVERNED_SCOPE_SCHEMA,
  EXTRACTOR_ID,
  EXTRACTOR_VERSION,
  NativeExtractionRunError,
  runNativeExtraction,
};
