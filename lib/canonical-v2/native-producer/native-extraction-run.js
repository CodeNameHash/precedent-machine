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
 *
 * PRODUCER DISPATCH THROUGH THE REGISTRY, PURE REFACTOR (docs/superpowers/
 * specs/2026-08-02-family-termination-rights-design.md section 3, "Dispatch
 * seam"). This module used to hard-require `buildCapitalisationProducerPrompt`
 * and call it for every resolved section, unconditionally. It now selects
 * the producer through `producer-prompt-registry.js`'s
 * `getProducerPromptModule(section_family)` -- but the DEFAULT behavior,
 * when the caller does not opt into section-family classification (no
 * `section_family_classifier` argument), is to dispatch every resolved
 * section as `CAPITALISATION`, exactly as before: this is what makes the
 * refactor pure, and is what recorded fixture replays (F28/TopBuild,
 * Skechers, Modiv) exercise -- byte-identical output, routed through the
 * registry instead of a hard-coded import. Opting into
 * `section_family_classifier` runs `section-family-classifier.js`'s
 * two-stage classifier (deterministic title rules, then an injected
 * AI-assisted stage 2) per resolved section instead of assuming
 * CAPITALISATION; a section whose resolved family has no registry entry
 * (including a null/declined classification) is dispatched to NO producer
 * -- fail closed, recorded in `undispatched_sections`, never a silent
 * capitalisation fallback.
 *
 * CITATION CONSTRUCTIBILITY, NOT LITERAL PRESENCE (docs/handoffs/
 * F28-FIRST-LIVE-RUN.md defect 3). Every field a proposal carries that
 * purports to cite document structure (currently `attributes.
 * section_reference`, propagated from the producer's own response onto every
 * proposal derived from one representation_instance/bring_down_condition) is
 * cross-checked here against citation-constructibility.js, which compares it
 * to the citation this module DERIVES independently from the sectionizer's
 * own tree -- never a literal-string search of the source text, which would
 * reject correctly-constructed citations that simply never appear
 * concatenated anywhere in the prose (see that module's header). A citation
 * the tree cannot construct may still be ACCEPTED when the document's own
 * text corroborates it (see citation-constructibility.js's `checkCitation
 * Corroboration`) -- validated by a WEAKER, second source than tree
 * construction, and that distinction (`CONSTRUCTED_FROM_TREE` vs
 * `CORROBORATED_BY_DOCUMENT_TEXT`) is preserved, never flattened, in the
 * `citation_validation` this module attaches to every compiled candidate.
 *
 * NEVER SILENTLY DISCARD (docs/handoffs/F28-SECOND-LIVE-RUN.md). An earlier
 * version of this module excluded a citation-unvalidated proposal from
 * `compiled_candidates` before compilation -- a silent drop this
 * architecture forbids everywhere else (contrast `scope_violations`, which
 * is likewise fail-closed but never removes the record of what happened). On
 * the real QXO/TopBuild filing, whose headings never spell out a "Section
 * 3.1" the sectionizer's tree can discover, that silent exclusion rejected
 * 100% of one run's output -- 23/23 proposals, zero compiled candidates --
 * even though every citation was grounded in real, in-scope cross-reference
 * prose. EVERY proposal now compiles into `compiled_candidates` regardless
 * of citation outcome; a failing or unvalidated citation is instead recorded
 * as a typed `citation_residuals` entry (informational, no longer
 * exclusionary) AND as a `citation_validation` object on the compiled
 * candidate's own entry (`{status, accepted, validation_source, ...}`,
 * sibling to `candidate`, never inside the claim/relationship's own closed
 * field set). Downstream, candidate-resolution.js reads `citation_validation`
 * and routes an unvalidated citation into `review_queue` with a typed reason
 * (`CITATION_NOT_VALIDATED`) rather than letting it silently auto-pass or
 * vanish. THE GENERAL PRINCIPLE, for the next reference-like field this
 * producer grows: check for constructibility against independently-derived
 * structure, never for literal presence, never take the model's word for it,
 * and never let a failing check remove the record of the candidate it
 * failed on -- route it for review instead.
 *
 * RECEIPT-BUILT RECALL INSTRUMENTS (F28-THIRD-LIVE-RUN.md known-limitations
 * register item 5 / final-audit finding M7: "Coverage proxies / enumeration
 * scan are not yet written into the run receipt by native-extraction-run.js
 * -- they run in the driver. Wiring them into the receipt is mechanical.").
 * `coverage-proxies.js`'s `computeCoverageProxies` and
 * `limb-enumeration-scan.js`'s `scanLimbEnumeration` are both pure,
 * standalone instruments (spec: "Recall and volume instrumentation") that
 * this module does NOT modify -- it adapts its OWN already-available data
 * into each instrument's small, documented input shape, once per resolved
 * section:
 *   - `assertion_spans` / `qualifiers` (coverage-proxies.js) come from
 *     `inScopeProposals` for that section -- every evidence edge on every
 *     in-scope proposal (governed or open-world) contributes a span;
 *     proposals carrying `claim_definition_key === QUALIFIER_CLAIM_KEY`
 *     (anthropic-provider.js's own generic bucket for a qualifier
 *     candidate, imported here, never redefined) contribute a qualifier
 *     quote.
 *   - `proposed_limb_paths` (limb-enumeration-scan.js) come from the same
 *     in-scope proposals' `attributes.limb_path`, for proposals carrying
 *     `claim_definition_key === LIMB_ASSERTION_CLAIM_KEY`.
 * Both reports are attached to the receipt as `coverage_proxies` and
 * `limb_enumeration_scan`, one entry per resolved section, index-aligned
 * with `resolved_sections`. NEITHER INSTRUMENT CAN FAIL THE RUN: each is
 * computed inside its own try/catch and a thrown error is typed into the
 * receipt as `{ section_reference, error: code, message }` in place of the
 * report -- exactly the "nothing fails silently, nothing throws the run
 * down" house rule applied to an optional, best-effort signal. Both fields
 * are folded into the SAME `receiptBody` object the existing fields already
 * populate, so `run_receipt_id`'s content-id derivation covers them by the
 * same mechanism as every other field (see the two prior additions of
 * `citation_residuals` and `scope_violations` to this same receipt body,
 * neither of which bumped `RUN_RECEIPT_SCHEMA` -- this addition follows
 * that same precedent: additive, optional receipt fields do not bump the
 * schema string; only a breaking reshape of an EXISTING field would).
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const {
  sectionizeAdmittedSource,
  findSectionByReference,
} = require('./deterministic-sectionizer');
const {
  getProducerPromptModule,
  listRegisteredSectionFamilies,
} = require('./producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-prompt-binding');
const {
  classifySectionFamily,
  SECTION_FAMILY_MANIFEST_ASSIGNED,
} = require('./section-family-classifier');
const { produceCandidateProposals } = require('./provider-interface');
const { compileCandidateProposals } = require('./candidate-proposal-compiler');
const { deriveCitationForSpan, checkCitationConstructibility } = require('./citation-constructibility');
const { computeCoverageProxies } = require('./coverage-proxies');
const { scanLimbEnumeration } = require('./limb-enumeration-scan');
const { QUALIFIER_CLAIM_KEY, LIMB_ASSERTION_CLAIM_KEY } = require('./anthropic-provider');

const RUN_RECEIPT_SCHEMA = 'NATIVE_EXTRACTION_RUN_RECEIPT/V1';
const GOVERNED_SCOPE_SCHEMA = 'NATIVE_EXTRACTION_GOVERNED_SCOPE/V1';
const PROMPT_DIGEST_DOMAIN = 'NATIVE_EXTRACTION_RUN_PROMPT/V1';
const EXTRACTOR_ID = 'canonical-v2-native-extraction-run/v1';
const EXTRACTOR_VERSION = '1';

// Backward-compatible default section_family for every resolved section
// when the caller does not supply `section_family_classifier` -- see the
// file header's "PRODUCER DISPATCH THROUGH THE REGISTRY, PURE REFACTOR"
// note. This is what keeps every existing caller (and every recorded
// fixture replay) byte-identical: no classifier means every section is
// still CAPITALISATION, exactly as when the import was hard-required.
const DEFAULT_SECTION_FAMILY = 'CAPITALISATION';

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

function requireSectionFamilyAssignments(value, references) {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length !== references.length) {
    throw new NativeExtractionRunError(
      'INVALID_INPUT',
      'section_family_assignments must contain exactly one assignment for each section reference',
    );
  }
  const registeredFamilies = new Set(listRegisteredSectionFamilies());
  const requestedReferences = new Set(references);
  const assignments = new Map();
  value.forEach((assignment, index) => {
    requirePlainObject(assignment, `section_family_assignments[${index}]`);
    const keys = Object.keys(assignment).sort();
    const expectedKeys = assignment.covenant_side === undefined
      ? ['family_id', 'section_reference']
      : ['covenant_side', 'family_id', 'section_reference'];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys.sort())) {
      throw new NativeExtractionRunError(
        'INVALID_INPUT',
        `section_family_assignments[${index}] has unknown or missing fields`,
      );
    }
    const sectionReference = requireNonEmptyString(
      assignment.section_reference,
      `section_family_assignments[${index}].section_reference`,
    );
    const familyId = requireNonEmptyString(
      assignment.family_id,
      `section_family_assignments[${index}].family_id`,
    );
    if (!requestedReferences.has(sectionReference) || assignments.has(sectionReference)) {
      throw new NativeExtractionRunError(
        'INVALID_INPUT',
        `section_family_assignments[${index}] must name one unique requested section reference`,
      );
    }
    if (!registeredFamilies.has(familyId)) {
      throw new NativeExtractionRunError(
        'INVALID_INPUT',
        `section_family_assignments[${index}].family_id is not registered`,
      );
    }
    let covenantSide = null;
    if (assignment.covenant_side !== undefined) {
      covenantSide = requireNonEmptyString(
        assignment.covenant_side,
        `section_family_assignments[${index}].covenant_side`,
      );
      if (!['BUYER', 'TARGET'].includes(covenantSide)) {
        throw new NativeExtractionRunError(
          'INVALID_INPUT',
          `section_family_assignments[${index}].covenant_side must be BUYER or TARGET`,
        );
      }
    }
    assignments.set(sectionReference, Object.freeze({ family_id: familyId, covenant_side: covenantSide }));
  });
  return assignments;
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

// The section-family classifier's stage 1 rules run on TITLE text
// (section-family-classifier.js, ported from lib/parser-v2/classify.js's
// own article-then-section reading). A resolved node's own `heading` is
// used when present; a node with no heading of its own (e.g. a numbered
// SUBSECTION with no short title) walks up `parent_section_id` until it
// finds an ancestor that has one -- the nearest ancestor heading is the
// closest analogue to classify.js's "known article type" fallback. Never
// throws: an unresolvable ancestor chain (should not happen against a tree
// this same run just built) simply yields `null`, and the classifier
// treats a null title as "stage 1 does not match".
function deriveSectionTitle(tree, node) {
  const byId = new Map(tree.nodes.map((candidate) => [candidate.section_id, candidate]));
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (typeof current.heading === 'string' && current.heading.length > 0) return current.heading;
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
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
      // A defined-term proposal has two independently byte-verified spans:
      // its definition head and its operative limb.  The producer's raw
      // value is deliberately the limb, so compare the head edge with its
      // own retained quote rather than treating a valid multi-span fact as
      // an out-of-scope candidate.
      const expected = edge.evidence_role === 'DEFINITION'
        ? proposal.attributes?.definition_head_quote
        : proposal.raw_value;
      if (slice !== expected) {
        return { ok: false, reason: 'EVIDENCE_TEXT_MISMATCH', edge };
      }
    }
  }
  return { ok: true };
}

// Adapts this module's own already-available per-section data into
// coverage-proxies.js's documented input shape (see the file header's
// "RECEIPT-BUILT RECALL INSTRUMENTS" note). Never throws -- a malformed
// evidence edge or proposal is simply excluded from the projection, since
// the instrument itself is best-effort; a hard failure inside
// `computeCoverageProxies` is caught by the caller, not here.
function projectCoverageProxiesInput(inScopeProposals) {
  const assertionSpans = [];
  const qualifiers = [];
  for (const proposal of inScopeProposals) {
    for (const edge of (Array.isArray(proposal.evidence) ? proposal.evidence : [])) {
      if (Number.isFinite(edge.absolute_start) && Number.isFinite(edge.absolute_end)) {
        assertionSpans.push({ start: edge.absolute_start, end: edge.absolute_end });
      }
    }
    if (proposal.claim_definition_key === QUALIFIER_CLAIM_KEY) {
      qualifiers.push({ quote: typeof proposal.raw_value === 'string' ? proposal.raw_value : '' });
    }
  }
  return { assertionSpans, qualifiers };
}

// Adapts this module's own already-available per-section data into
// limb-enumeration-scan.js's documented input shape. Same never-throws
// discipline as the projection above.
function projectLimbEnumerationScanInput(inScopeProposals) {
  const proposedLimbPaths = [];
  for (const proposal of inScopeProposals) {
    if (proposal.claim_definition_key !== LIMB_ASSERTION_CLAIM_KEY) continue;
    const limbPath = proposal.attributes && proposal.attributes.limb_path;
    if (Array.isArray(limbPath) && limbPath.length > 0) proposedLimbPaths.push(limbPath);
  }
  return proposedLimbPaths;
}

// Shifts a proposal's own byte-verified evidence span(s) -- section-local
// offsets, per `checkEvidenceScope` above -- into document-global
// coordinates by adding the governing section's own `node.start`, and
// widens across every evidence edge the proposal carries (min start, max
// end) so a multi-edge proposal derives from the full span its evidence
// actually covers. Returns `null` (never throws) when the proposal has no
// numerically valid evidence edge to derive from, so the caller can fall
// back to the section's own span -- the same "citation constructibility,
// not literal presence, never silently drop" discipline as the rest of this
// module.
function deriveGlobalEvidenceSpan(proposal, sectionStart) {
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : [];
  let start = null;
  let end = null;
  for (const edge of evidence) {
    if (!Number.isSafeInteger(edge.absolute_start) || !Number.isSafeInteger(edge.absolute_end)) continue;
    const globalStart = sectionStart + edge.absolute_start;
    const globalEnd = sectionStart + edge.absolute_end;
    if (start === null || globalStart < start) start = globalStart;
    if (end === null || globalEnd > end) end = globalEnd;
  }
  return start === null || end === null ? null : { start, end };
}

// Runs one of the two Task-8 recall instruments for a section, never
// throwing the run down: a failure inside the instrument itself (malformed
// input this module's projection did not anticipate, a future breaking
// change to the instrument's own contract, etc.) is typed into the receipt
// as `{ section_reference, error: code, message }` in place of the report --
// the "nothing fails silently" house rule applied to a best-effort signal.
function runInstrumentSafely(sectionReference, computeFn) {
  try {
    return computeFn();
  } catch (error) {
    return {
      section_reference: sectionReference,
      error: (error && error.code) || 'INSTRUMENT_FAILED',
      message: error && error.message ? error.message : String(error),
    };
  }
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
 * @param {(input: object) => (Promise<object>|object)} [args.section_family_classifier]
 *   OPTIONAL stage-2 provider for section-family-classifier.js's two-stage
 *   classifier. Omit to keep every resolved section dispatched as
 *   `CAPITALISATION` (the pre-registry default -- see DEFAULT_SECTION_FAMILY
 *   and the file header's "PRODUCER DISPATCH THROUGH THE REGISTRY, PURE
 *   REFACTOR" note). Supplying it engages stage 1 (deterministic title
 *   rules) then stage 2 (this injected provider) per resolved section, and
 *   any section whose classified family has no producer-prompt-registry.js
 *   entry (including a declined/null classification) is dispatched to NO
 *   producer -- recorded in the receipt's `undispatched_sections`, never a
 *   silent CAPITALISATION fallback.
 * @param {Array<{section_reference: string, family_id: string,
 *   covenant_side?: 'BUYER'|'TARGET'}>} [args.section_family_assignments]
 *   Exact manifest assignments. They are mutually exclusive with a classifier.
 * @returns {Promise<object>} a frozen, content-addressed run receipt
 */
async function runNativeExtraction({
  source_text: sourceText,
  document_hash: documentHash,
  section_references: sectionReferences,
  contract_bundle: contractBundle,
  definitions,
  provider,
  section_family_classifier: sectionFamilyClassifier,
  section_family_assignments: sectionFamilyAssignments,
} = {}) {
  requireNonEmptyString(sourceText, 'source_text');
  requireNonEmptyString(documentHash, 'document_hash');
  const references = requireSectionReferenceList(sectionReferences);
  requirePlainObject(contractBundle, 'contract_bundle');
  requirePlainObject(definitions, 'definitions');
  if (typeof provider !== 'function') {
    throw new NativeExtractionRunError('INVALID_INPUT', 'provider must be a function');
  }
  if (sectionFamilyClassifier !== undefined && typeof sectionFamilyClassifier !== 'function') {
    throw new NativeExtractionRunError('INVALID_INPUT', 'section_family_classifier must be a function when supplied');
  }
  if (sectionFamilyClassifier !== undefined && sectionFamilyAssignments !== undefined) {
    throw new NativeExtractionRunError(
      'INVALID_INPUT',
      'section_family_classifier and section_family_assignments are mutually exclusive',
    );
  }
  const assignmentsByReference = requireSectionFamilyAssignments(
    sectionFamilyAssignments,
    references,
  );

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
  const citationResiduals = [];
  const compiledCandidates = [];
  const coverageProxies = [];
  const limbEnumerationScan = [];
  const undispatchedSections = [];

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

    // Section-family dispatch through the registry (see the file header's
    // "PRODUCER DISPATCH THROUGH THE REGISTRY, PURE REFACTOR" note). No
    // `section_family_classifier` supplied -> DEFAULT_SECTION_FAMILY,
    // unclassified (provenance null): identical dispatch to the pre-registry
    // hard-required import, for every existing caller and every recorded
    // fixture replay.
    let sectionFamily = DEFAULT_SECTION_FAMILY;
    let sectionFamilyProvenance = null;
    let sectionFamilyDeclinedReason = null;
    let covenantSide = null;
    const manifestAssignment = assignmentsByReference
      ? assignmentsByReference.get(reference)
      : null;
    if (manifestAssignment) {
      sectionFamily = manifestAssignment.family_id;
      sectionFamilyProvenance = SECTION_FAMILY_MANIFEST_ASSIGNED;
      covenantSide = manifestAssignment.covenant_side;
    } else if (sectionFamilyClassifier) {
      const title = deriveSectionTitle(tree, node);
      // eslint-disable-next-line no-await-in-loop
      const classification = await classifySectionFamily({
        title,
        article_context: node.article_context || null,
        section_reference: reference,
        source_text: sectionText,
        registered_families: listRegisteredSectionFamilies(),
        classifier_provider: sectionFamilyClassifier,
      });
      sectionFamily = classification.section_family;
      sectionFamilyProvenance = classification.provenance;
      sectionFamilyDeclinedReason = classification.declined_reason;
      covenantSide = classification.covenant_side || null;
    }

    const producerPromptModule = sectionFamily ? getProducerPromptModule(sectionFamily) : null;

    if (!producerPromptModule) {
      // FAIL CLOSED: unresolved/unregistered family -> no prompt built, no
      // provider called, no candidates compiled -- never a silent
      // CAPITALISATION fallback. Recorded, never dropped, matching this
      // module's own "never silently discard" discipline for every other
      // typed skip (scope_violations, citation_residuals, etc.).
      undispatchedSections.push({
        section_reference: reference,
        section_family: sectionFamily,
        section_family_provenance: sectionFamilyProvenance,
        declined_reason: sectionFamilyDeclinedReason,
      });
      coverageProxies.push(runInstrumentSafely(reference, () => computeCoverageProxies({
        section_reference: reference,
        source_text: sectionText,
        assertion_spans: [],
        qualifiers: [],
      })));
      limbEnumerationScan.push(runInstrumentSafely(reference, () => scanLimbEnumeration({
        section_reference: reference,
        source_text: sectionText,
        proposed_limb_paths: [],
      })));
      resolvedSections.push({
        section_reference: reference,
        section_id: node.section_id,
        parent_section_id: node.parent_section_id,
        kind: node.kind,
        depth: node.depth,
        start: node.start,
        end: node.end,
        text_sha256: node.text_sha256,
        section_family: sectionFamily,
        section_family_provenance: sectionFamilyProvenance,
        prompt_id: null,
        prompt_version: null,
        prompt_digest: null,
        producer_receipt: null,
      });
      continue;
    }

    const providerScope = covenantSide
      ? Object.freeze({ ...governedScope, covenant_side: covenantSide })
      : governedScope;
    const prompt = bindNativePromptToGovernedScope({
      prompt: producerPromptModule({
        source_text: sectionText,
        governed_scope: providerScope,
        known_definitions: knownDefinitions,
      }),
      governed_scope: providerScope,
    });
    const promptDigest = contentId(PROMPT_DIGEST_DOMAIN, prompt.messages);

    // eslint-disable-next-line no-await-in-loop
    const {
      proposals,
      evidence_residuals: providerResiduals,
      producer_receipt: producerReceipt,
    } = await produceCandidateProposals({
      governed_scope: providerScope,
      definitions,
      contract_bundle: contractBundle,
      section_family: sectionFamily,
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

    // Task-8 recall instruments, computed here from data this call already
    // has (see the file header's "RECEIPT-BUILT RECALL INSTRUMENTS" note).
    // Best-effort: neither instrument can fail the run.
    coverageProxies.push(runInstrumentSafely(reference, () => {
      const { assertionSpans, qualifiers } = projectCoverageProxiesInput(inScopeProposals);
      return computeCoverageProxies({
        section_reference: reference,
        source_text: sectionText,
        assertion_spans: assertionSpans,
        qualifiers,
      });
    }));
    limbEnumerationScan.push(runInstrumentSafely(reference, () => scanLimbEnumeration({
      section_reference: reference,
      source_text: sectionText,
      proposed_limb_paths: projectLimbEnumerationScanInput(inScopeProposals),
    })));

    // Citation constructibility, and corroboration as a second, weaker
    // source (see file header). PER-PROPOSAL DERIVATION (Skechers-first-
    // live-run defect: see docs/handoffs -- native-extraction-run.js commit
    // "Skechers live run"): the derived citation is NOT the governing
    // section's own outer span for every proposal alike. A governed section
    // frequently sits INSIDE the byte range of some other, unrelated node
    // the sectionizer also discovered (e.g. a legacy article-intro
    // "III-INTRO" node whose lettered-subsection walk straddles the whole
    // article body, including a minted decimal SECTION nested well inside
    // it) -- deriving once from the section's outer span silently prefers
    // whichever node the depth tie-break likes for THAT span, which need not
    // be the node that actually contains any given proposal's own evidence.
    // Each proposal's own byte-verified evidence span (already validated by
    // `checkEvidenceScope` above, section-local offsets) is shifted to
    // document-global coordinates via `node.start` -- the same shift
    // `checkEvidenceScope`'s bounds check implicitly relies on -- and THAT
    // span, not the section's outer span, is what gets derived from. A
    // proposal with no verifiable evidence span (empty/malformed evidence)
    // falls back to the section's own span, matching the prior behaviour for
    // that one case.
    //
    // NEVER SILENTLY DISCARD: every proposal in `inScopeProposals` is
    // compiled below regardless of its citation outcome -- `citationChecks`
    // is recorded index-aligned with `inScopeProposals` (compileCandidate
    // Proposals preserves order and length exactly) purely so its result can
    // be attached to the matching compiled entry afterwards, never to filter
    // the input.
    const citationChecks = inScopeProposals.map((proposal) => {
      const proposalSpan = deriveGlobalEvidenceSpan(proposal, node.start);
      const derivedNode = proposalSpan
        ? deriveCitationForSpan(tree, proposalSpan.start, proposalSpan.end)
        : deriveCitationForSpan(tree, node.start, node.end);
      const modelCitation = proposal.attributes && proposal.attributes.section_reference;
      const citationCheck = checkCitationConstructibility({
        tree,
        model_citation: modelCitation,
        derived_node: derivedNode,
        document_text: sourceText,
        quote: proposal.raw_value,
      });
      if (citationCheck && !citationCheck.accepted) {
        citationResiduals.push({
          section_reference: reference,
          reason: citationCheck.status,
          model_citation: citationCheck.model_citation,
          normalized_citation: citationCheck.normalized_citation,
          derived_citation: citationCheck.derived_citation,
          proposal_kind: proposal.kind,
          claim_definition_key: proposal.claim_definition_key || null,
        });
      }
      return citationCheck;
    });

    const compileResults = compileCandidateProposals({
      proposals: inScopeProposals,
      governed_scope: governedScope,
      producer_receipt: producerReceipt,
      extractor_id: EXTRACTOR_ID,
      extractor_version: EXTRACTOR_VERSION,
    });
    compileResults.forEach((result, index) => {
      const citationCheck = citationChecks[index];
      const citationValidation = citationCheck ? {
        status: citationCheck.status,
        accepted: citationCheck.accepted,
        validation_source: citationCheck.validation_source,
        model_citation: citationCheck.model_citation,
        normalized_citation: citationCheck.normalized_citation,
        derived_citation: citationCheck.derived_citation,
      } : null;
      compiledCandidates.push({
        section_reference: reference,
        citation_validation: citationValidation,
        section_family: sectionFamily,
        section_family_provenance: sectionFamilyProvenance,
        covenant_side: covenantSide,
        ...result,
      });
    });

    resolvedSections.push({
      section_reference: reference,
      section_id: node.section_id,
      parent_section_id: node.parent_section_id,
      kind: node.kind,
      depth: node.depth,
      start: node.start,
      end: node.end,
      text_sha256: node.text_sha256,
      section_family: sectionFamily,
      section_family_provenance: sectionFamilyProvenance,
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
    citation_residuals: citationResiduals,
    coverage_proxies: coverageProxies,
    limb_enumeration_scan: limbEnumerationScan,
    // Sections whose section_family had no producer-prompt-registry.js
    // entry (including a stage-2 decline/malformed classification) --
    // never silently discarded, see producer-prompt-registry.js's and this
    // module's own fail-closed dispatch notes.
    undispatched_sections: undispatchedSections,
    evidence_residual_count: evidenceResiduals.length,
    scope_violation_count: scopeViolations.length,
    citation_residual_count: citationResiduals.length,
    undispatched_section_count: undispatchedSections.length,
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
