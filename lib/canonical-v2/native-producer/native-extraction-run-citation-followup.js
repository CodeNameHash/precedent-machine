/**
 * lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js
 *
 * docs/codex-program/notes/citation-scope-design.md, Part 6 ("Option B"):
 * a termination-fee trigger candidate that names its ground ONLY by a bare
 * cross-reference (e.g. "by Parent pursuant to Section 7.1(d)(ii)") gives
 * the model nothing to read -- the words describing what actually happened
 * live in the CITED section, which was never in that call's governed scope.
 * This module dispatches the cited section as its own ORDINARY, INDEPENDENT
 * single-section call, through the exact same `runNativeExtraction` dispatch
 * path every other section already goes through, and merges the two run
 * receipts into one. It never shares a byte buffer between sections and
 * never widens any one call's governed scope: `checkEvidenceScope` and
 * `deriveGlobalEvidenceSpan` (native-extraction-run.js) run completely
 * unmodified, once per call, exactly as they do today, on both the original
 * and the follow-up dispatch. See the design doc's Part 3 for why this
 * matters more than it might look like it does: the byte-offset
 * verification contract is written for exactly one contiguous span per
 * call, and two independent single-section calls need no change to it at
 * all, where a single call spanning two sections would.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not decide whether a follow-up
 * answer is trustworthy enough to publish -- that is
 * candidate-resolution.js's `handleFeeTriggerCandidate`, which re-runs its
 * own existing, unmodified trigger-code/matchedCodes gate against the cited
 * candidate's own data before anything is finalized. This module's job ends
 * at "which extra sections does this run need, and why" -- selection,
 * resolution, deduplication and hop-limiting, nothing else. It also never
 * chases a citation more than one hop: see CITATION_FOLLOWUP_HOP_LIMIT
 * below.
 *
 * HOP LIMIT = 1, STRUCTURALLY, NOT BY A COUNTER. This module calls
 * `runNativeExtraction` at most twice per invocation -- once for the
 * caller's own requested sections (pass A), once for every bare citation's
 * resolved target found in pass A's OWN results (pass B). There is no loop,
 * no recursion, and no third call: a citation discovered INSIDE a pass-B
 * section's own text (e.g. Modiv's Section 8.12 cites Section 7.3(b)(i),
 * whose own text is itself just another bare citation into Section
 * 7.1(d)(ii)) is never followed. `CITATION_FOLLOWUP_HOP_LIMIT` exists so
 * this fact is textually discoverable and testable, not because the code
 * decrements it.
 *
 * INERT WHEN NOTHING CITES ANYTHING. If pass A's own results contain zero
 * bare-citation-shaped, null-trigger_code fee-trigger candidates, this
 * module returns pass A's OWN receipt completely unchanged -- same object
 * shape, same `run_receipt_id` a plain `runNativeExtraction(args)` call
 * would have produced, zero extra fields, zero extra calls. See this
 * module's own test file for the byte-identical-receipt proof.
 *
 * "PAYS NOTHING EXTRA, BUT NOT SILENT" IS A DIFFERENT CASE FROM INERT. If
 * pass A DOES contain bare citations but every one of their cited
 * references turns out unresolvable, ambiguous, or already covered by pass
 * A's own requested sections, this module still makes zero extra calls
 * (the follow-up batch is empty) -- but it attaches
 * `citation_followup_dispatched_references: []` and a typed
 * `citation_followup_residuals` array explaining why nothing was
 * dispatched, rather than silently returning pass A's receipt as if
 * citation-following had never been attempted. "No silent scope growth"
 * (this task's own non-negotiable) cuts both ways: a run must be able to
 * report exactly which extra sections it dispatched and why, AND exactly
 * which ones it considered and declined, and why.
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const { sectionizeAdmittedSource } = require('./deterministic-sectionizer');
const { runNativeExtraction, RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');
const { FEE_TRIGGER_CLAIM_KEY } = require('./anthropic-provider');
const { parseBareCitationTriggerQuote } = require('./bare-citation-trigger-parser');

// See the file header's "HOP LIMIT = 1, STRUCTURALLY" note. Not a
// decrementing counter -- a documented, tested fact about this module's own
// call structure (exactly one `runNativeExtraction` call for the caller's
// sections, at most one more for their bare citations' resolved targets).
const CITATION_FOLLOWUP_HOP_LIMIT = 1;

// The only family this module knows how to follow up for v1 (design doc
// Part 6.1: "reusing the TERMINATION_FEE family and
// termination-fee-producer-prompt.js unmodified for v1"). A cited section
// is asked the exact same question every other TERMINATION_FEE section is
// asked -- nothing about the fact that it was reached via a citation is
// visible to the prompt or the provider.
const CITATION_FOLLOWUP_SECTION_FAMILY = 'TERMINATION_FEE';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

/**
 * Merges two run receipts produced against the SAME admitted document
 * (asserted, not assumed -- throws on any document-identity mismatch)
 * into one, content-addressed the same way `native-extraction-run.js`
 * content-addresses its own single-call receipt. Concatenates every
 * per-call array (`resolved_sections`, `compiled_candidates`,
 * `evidence_residuals`, `scope_violations`, `citation_residuals`,
 * `coverage_proxies`, `limb_enumeration_scan`, `undispatched_sections`,
 * `requested_section_references`), A's entries before B's, recomputes the
 * count fields from the concatenated arrays, and recomputes
 * `run_receipt_id` over the WHOLE merged body -- never an ad hoc splice of
 * two already-hashed ids.
 *
 * @param {object} a first run receipt (RUN_RECEIPT_SCHEMA)
 * @param {object} b second run receipt (RUN_RECEIPT_SCHEMA), same document as `a`
 * @param {object} [extraFields] additional top-level fields folded into the
 *   merged body BEFORE `run_receipt_id` is computed, so a caller that needs
 *   to attach its own additive fields (e.g. this module's own
 *   `citation_followup_dispatched_references`) never pays for a second,
 *   wasted content-id computation.
 * @returns {object} a frozen, content-addressed merged run receipt
 */
function mergeNativeExtractionReceipts(a, b, extraFields = {}) {
  if (!a || typeof a !== 'object' || !b || typeof b !== 'object') {
    throw new TypeError('mergeNativeExtractionReceipts requires two run receipt objects');
  }
  if (a.schema_version !== RUN_RECEIPT_SCHEMA || b.schema_version !== RUN_RECEIPT_SCHEMA) {
    throw new TypeError(`mergeNativeExtractionReceipts requires schema_version ${RUN_RECEIPT_SCHEMA} on both receipts`);
  }
  const identityFields = ['document_hash', 'source_sha256', 'source_byte_length', 'root_section_id'];
  for (const field of identityFields) {
    if (a[field] !== b[field]) {
      throw new TypeError(
        `mergeNativeExtractionReceipts: receipts do not describe the same document (${field} differs: `
        + `${JSON.stringify(a[field])} vs ${JSON.stringify(b[field])})`,
      );
    }
  }

  const concatField = (name) => [...(a[name] || []), ...(b[name] || [])];
  const resolvedSections = concatField('resolved_sections');
  const compiledCandidates = concatField('compiled_candidates');
  const evidenceResiduals = concatField('evidence_residuals');
  const scopeViolations = concatField('scope_violations');
  const citationResiduals = concatField('citation_residuals');
  const coverageProxies = concatField('coverage_proxies');
  const limbEnumerationScan = concatField('limb_enumeration_scan');
  const undispatchedSections = concatField('undispatched_sections');
  const requestedSectionReferences = concatField('requested_section_references');

  const receiptBody = {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: a.document_hash,
    source_sha256: a.source_sha256,
    source_byte_length: a.source_byte_length,
    root_section_id: a.root_section_id,
    requested_section_references: requestedSectionReferences,
    resolved_sections: resolvedSections,
    compiled_candidates: compiledCandidates,
    evidence_residuals: evidenceResiduals,
    scope_violations: scopeViolations,
    citation_residuals: citationResiduals,
    coverage_proxies: coverageProxies,
    limb_enumeration_scan: limbEnumerationScan,
    undispatched_sections: undispatchedSections,
    evidence_residual_count: evidenceResiduals.length,
    scope_violation_count: scopeViolations.length,
    citation_residual_count: citationResiduals.length,
    undispatched_section_count: undispatchedSections.length,
    compiled_candidate_count: compiledCandidates.filter((entry) => entry && entry.ok).length,
    rejected_candidate_count: compiledCandidates.filter((entry) => entry && !entry.ok).length,
    ...extraFields,
  };
  const runReceiptId = contentId(RUN_RECEIPT_SCHEMA, receiptBody);
  return deepFreeze({ ...receiptBody, run_receipt_id: runReceiptId });
}

// Every FEE_TRIGGER_CLAIM_KEY compiled candidate dispatched under
// `sectionReference`, ok===true, regardless of its own trigger_code --
// callers filter further as needed. Order-preserving.
function feeTriggerCandidatesForSection(compiledCandidates, sectionReference) {
  return compiledCandidates.filter((entry) => (
    entry
    && entry.ok === true
    && entry.section_reference === sectionReference
    && entry.candidate
    && entry.candidate.kind === 'claim'
    && entry.candidate.claim
    && entry.candidate.claim.claim_definition_key === FEE_TRIGGER_CLAIM_KEY
  ));
}

/**
 * Finds every bare-citation-shaped, null-trigger_code fee-trigger candidate
 * in `compiledCandidates` and returns the distinct set of section
 * references they cite, plus which citing section(s) named each one (for
 * residual traceability). Pure, no I/O.
 */
function collectBareCitationTargets(compiledCandidates) {
  const citedFromByReference = new Map(); // cited reference -> Set(citing section_reference)
  for (const entry of compiledCandidates) {
    if (!entry || entry.ok !== true || !entry.candidate || entry.candidate.kind !== 'claim') continue;
    const claim = entry.candidate.claim;
    if (claim.claim_definition_key !== FEE_TRIGGER_CLAIM_KEY) continue;
    const attrs = claim.attributes || {};
    const triggerCode = typeof attrs.trigger_code === 'string' && attrs.trigger_code.length > 0
      ? attrs.trigger_code
      : null;
    if (triggerCode) continue; // already named a ground -- not a citation-following candidate
    const parsed = parseBareCitationTriggerQuote(claim.raw_value);
    if (!parsed.is_bare_citation) continue;
    for (const ref of parsed.cited_references) {
      if (!citedFromByReference.has(ref)) citedFromByReference.set(ref, new Set());
      citedFromByReference.get(ref).add(entry.section_reference);
    }
  }
  return citedFromByReference;
}

/**
 * Pure decision function, no I/O: given the set of cited references a
 * pass-A receipt's bare candidates named (`citedFromByReference`, from
 * `collectBareCitationTargets`), a sectionizer tree (`{nodes: [{reference,
 * ...}]}`, or a plain array of such nodes -- the same shape
 * `findSectionByReference` itself accepts), and the caller's own already-
 * requested references (`originalReferences`, a Set), decides which cited
 * references get a follow-up call and which do not, and why. Separated
 * from `runNativeExtractionWithCitationFollowup` specifically so this
 * decision -- "given this candidate tree shape, what does this module
 * dispatch" -- is directly testable against a hand-built tree, independent
 * of whether the real sectionizer happens to produce a genuinely ambiguous
 * (>=2 nodes, same reference string) tree on any committed fixture. Never
 * throws, never guesses: exactly the same four outcomes
 * `runNativeExtractionWithCitationFollowup`'s own doc comment enumerates
 * (`CITATION_ALREADY_DISPATCHED`, `CITATION_REFERENCE_UNRESOLVED`,
 * `CITATION_REFERENCE_AMBIGUOUS`, or added to the follow-up batch).
 *
 * @param {object} args
 * @param {Map<string, Set<string>>} args.citedFromByReference
 * @param {{nodes: Array<{reference: string|null}>} | Array<{reference: string|null}>} args.tree
 * @param {Set<string>} args.originalReferences
 * @returns {{ followupBatch: string[], residuals: object[] }} `followupBatch`
 *   is sorted (deterministic dispatch order); `residuals` covers every
 *   OTHER cited reference, each entry frozen.
 */
function classifyCitedReferences({ citedFromByReference, tree, originalReferences }) {
  const nodes = Array.isArray(tree) ? tree : (tree && tree.nodes) || [];
  const refCounts = new Map();
  for (const node of nodes) {
    if (!node || !node.reference) continue;
    refCounts.set(node.reference, (refCounts.get(node.reference) || 0) + 1);
  }

  const followupBatch = [];
  const residuals = [];
  const citedReferencesSorted = [...citedFromByReference.keys()].sort();
  for (const ref of citedReferencesSorted) {
    const citedFrom = [...citedFromByReference.get(ref)].sort();
    if (originalReferences.has(ref)) {
      residuals.push(Object.freeze({
        cited_reference: ref, reason: 'CITATION_ALREADY_DISPATCHED', cited_from_section_references: citedFrom,
      }));
      continue;
    }
    const matchCount = refCounts.get(ref) || 0;
    if (matchCount === 0) {
      residuals.push(Object.freeze({
        cited_reference: ref, reason: 'CITATION_REFERENCE_UNRESOLVED', cited_from_section_references: citedFrom,
      }));
      continue;
    }
    if (matchCount >= 2) {
      residuals.push(Object.freeze({
        cited_reference: ref, reason: 'CITATION_REFERENCE_AMBIGUOUS', cited_from_section_references: citedFrom,
      }));
      continue;
    }
    followupBatch.push(ref);
  }
  return { followupBatch, residuals };
}

/**
 * docs/codex-program/notes/citation-scope-design.md Part 6.3. Runs
 * `runNativeExtraction` for the caller's own requested sections exactly as
 * today (byte-identical call, byte-identical receipt shape), then -- ONLY
 * when that receipt contains at least one bare-citation-shaped,
 * null-trigger_code TERMINATION_FEE_TRIGGER candidate whose cited
 * reference(s) resolve cleanly against this SAME document's sectionizer
 * tree -- dispatches exactly one more `runNativeExtraction` call for those
 * cited sections (deduplicated against each other and against the sections
 * already requested by the caller), and merges the two receipts.
 *
 * @param {object} args identical to `runNativeExtraction`'s own arguments.
 * @returns {Promise<object>} a run receipt (RUN_RECEIPT_SCHEMA). When no
 *   bare citation was found at all, this is `runNativeExtraction(args)`'s
 *   own return value, completely unchanged. Otherwise it is the merged
 *   receipt, additionally carrying:
 *   - `citation_followup_dispatched_references: string[]` -- every section
 *     reference this call actually dispatched a second, independent call
 *     for (possibly empty).
 *   - `citation_followup_residuals: object[]` -- one typed entry per cited
 *     reference this call considered but did NOT dispatch a call for, or
 *     DID dispatch but whose own answer could not be chased further:
 *     `{ cited_reference, reason, cited_from_section_references }` where
 *     `reason` is one of `CITATION_REFERENCE_UNRESOLVED` (Part 2: the tree
 *     has no node with this reference -- e.g. Modiv's `8.12(gg)`/`8.12(vv)`
 *     defect, SEC2), `CITATION_REFERENCE_AMBIGUOUS` (>=2 nodes share the
 *     reference string -- `findSectionByReference` itself cannot detect
 *     this, so this module checks independently), `CITATION_ALREADY_
 *     DISPATCHED` (the caller's own pass-A `section_references` already
 *     covers it -- no second call needed, and the resolver can already see
 *     it in pass A's own compiled candidates), `CITATION_TARGET_NO_
 *     TRIGGER_CANDIDATE` (dispatched, but the model's own response carried
 *     no TERMINATION_FEE_TRIGGER assertion for it at all), or
 *     `CITATION_CHAIN_NOT_FOLLOWED` (dispatched, and it DID carry its own
 *     TERMINATION_FEE_TRIGGER assertion(s), but every one of them is
 *     ITSELF still bare-citation-shaped -- a second hop, out of scope for
 *     v1, Part 9; this entry additionally carries `chains_to: string[]`,
 *     the reference(s) the chained candidate's own text cites, purely
 *     informational -- this module never dispatches a call for them).
 */
async function runNativeExtractionWithCitationFollowup(args = {}) {
  const receiptA = await runNativeExtraction(args);

  const citedFromByReference = collectBareCitationTargets(receiptA.compiled_candidates);
  if (citedFromByReference.size === 0) {
    return receiptA; // inert: byte-identical to a plain runNativeExtraction(args) call.
  }

  const originalReferences = new Set(receiptA.requested_section_references);
  const tree = sectionizeAdmittedSource({
    source_text: args.source_text,
    document_hash: args.document_hash,
  });
  const { followupBatch, residuals } = classifyCitedReferences({
    citedFromByReference, tree, originalReferences,
  });

  if (followupBatch.length === 0) {
    // Bare citations existed, but nothing was dispatchable -- zero extra
    // cost, but NOT the same as "nothing cited anything" (see file header).
    // `run_receipt_id` is RECOMPUTED, not carried over from receiptA: this
    // object's own content now includes the two citation_followup_* fields
    // receiptA's own id never covered, and a content-addressed id that does
    // not cover its own object's full content is worse than no id at all.
    const { run_receipt_id: _discardedId, ...receiptABody } = receiptA;
    const extraFields = {
      citation_followup_dispatched_references: Object.freeze([]),
      citation_followup_residuals: Object.freeze(residuals),
    };
    const runReceiptId = contentId(RUN_RECEIPT_SCHEMA, { ...receiptABody, ...extraFields });
    return deepFreeze({ ...receiptABody, ...extraFields, run_receipt_id: runReceiptId });
  }

  const sectionFamilyAssignments = followupBatch.map((sectionReference) => ({
    section_reference: sectionReference,
    family_id: CITATION_FOLLOWUP_SECTION_FAMILY,
  }));
  const receiptB = await runNativeExtraction({
    source_text: args.source_text,
    document_hash: args.document_hash,
    section_references: followupBatch,
    section_family_assignments: sectionFamilyAssignments,
    contract_bundle: args.contract_bundle,
    definitions: args.definitions,
    provider: args.provider,
    ...(args.source_tree_limb_citations !== undefined
      ? { source_tree_limb_citations: args.source_tree_limb_citations } : {}),
  });

  // Post-pass-B diagnostics (Part 6.5 case 4: a chained citation). This is
  // the ONE hop this module ever takes -- the chained target's OWN cited
  // reference (e.g. 7.3(b)(i) -> 7.1(d)(ii)) is reported here, never
  // dispatched (see CITATION_FOLLOWUP_HOP_LIMIT).
  for (const ref of followupBatch) {
    const citedFrom = [...citedFromByReference.get(ref)].sort();
    const candidates = feeTriggerCandidatesForSection(receiptB.compiled_candidates, ref);
    if (candidates.length === 0) {
      residuals.push(Object.freeze({
        cited_reference: ref, reason: 'CITATION_TARGET_NO_TRIGGER_CANDIDATE', cited_from_section_references: citedFrom,
      }));
      continue;
    }
    const bareParsesByCandidate = candidates.map((entry) => (
      parseBareCitationTriggerQuote(entry.candidate.claim.raw_value)
    ));
    const everyCandidateIsBare = bareParsesByCandidate.every((parsed) => parsed.is_bare_citation);
    if (everyCandidateIsBare) {
      // chains_to: purely informational (Part 9 scopes chasing this out of
      // v1 -- see CITATION_FOLLOWUP_HOP_LIMIT) -- what the chained
      // candidate's OWN text cites, so a reviewer can see the second hop
      // this module deliberately does not take, not just that one exists.
      const chainsTo = [...new Set(bareParsesByCandidate.flatMap((parsed) => parsed.cited_references))].sort();
      residuals.push(Object.freeze({
        cited_reference: ref,
        reason: 'CITATION_CHAIN_NOT_FOLLOWED',
        cited_from_section_references: citedFrom,
        chains_to: Object.freeze(chainsTo),
      }));
    }
  }

  return mergeNativeExtractionReceipts(receiptA, receiptB, {
    citation_followup_dispatched_references: Object.freeze(followupBatch),
    citation_followup_residuals: Object.freeze(residuals),
  });
}

module.exports = {
  CITATION_FOLLOWUP_HOP_LIMIT,
  CITATION_FOLLOWUP_SECTION_FAMILY,
  mergeNativeExtractionReceipts,
  runNativeExtractionWithCitationFollowup,
  // Exported for tests that want to exercise dispatch-selection logic
  // directly, independent of a live/replayed model call.
  collectBareCitationTargets,
  classifyCitedReferences,
  feeTriggerCandidatesForSection,
};
