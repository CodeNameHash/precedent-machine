#!/usr/bin/env node
/**
 * scripts/canonical-v2-live-extraction-run.mjs
 *
 * GENERAL LIVE-EXTRACTION RUNNER: any registered section family, against any
 * deal whose source is committed and pinned. Originally written narrowly for
 * one scope-corrected Modiv/Global Net Lease TERMINATION_FEE re-run, as
 * `canonical-v2-modiv-termination-fee-scope-correction-run.mjs` (see the
 * "ORIGINAL MODIV RUN" section below for that history); generalised because
 * almost nothing about it actually was Modiv- or TERMINATION_FEE-specific.
 * The old name was left in place through that generalisation -- purely to
 * avoid re-touching this file's Phase 1 authority-boundary classification --
 * which was the wrong trade: a script run against all 25 families under a
 * name claiming one scope correction for one deal is a misleading provenance
 * record, not a cosmetic mismatch. Renamed to this path once that was
 * corrected, with the classification re-done properly rather than skipped
 * (see phase1-authority-boundary-inventory.js's LIVE_EXTRACTION_RUN_SOURCES
 * comment for that side of it). The extraction engine underneath
 * (`runNativeExtraction`) already resolves its producer prompt through
 * `getProducerPromptModule(section_family)` against a registry of 25
 * families (`listRegisteredSectionFamilies()`); the only things that were
 * ever hard-pinned to Modiv/TERMINATION_FEE in THIS script were: two source
 * hashes, a default section-reference list, a default family constant, log
 * prefixes, and a hard-coded import of the termination-fee prompt module
 * used only to report its PROMPT_VERSION.
 *
 * PER-DEAL PINNED LOOKUP, NOT A TRUST-WHATEVER-YOU-COMPUTE CHECK. This
 * script re-derives both the raw-bytes SHA-256 and the canonical-text
 * SHA-256 of whatever source file it reads and refuses to run on any
 * mismatch -- that check is what makes its evidence trustworthy, and
 * generalising to more deals must not weaken it. `DEAL_PINS` below is a
 * table from deal identifier to that deal's expected digests (plus its
 * committed source path, retrieval URL, and a few optional per-deal
 * defaults). A deal with no entry in `DEAL_PINS` is refused outright
 * (`UNPINNED_DEAL`) -- adding a deal means adding a pin, deliberately, in
 * its own reviewed diff, never inferring one from whatever bytes happen to
 * be on disk.
 *
 * ORIGINAL MODIV RUN. The scope-corrected Modiv/Global Net Lease
 * TERMINATION_FEE re-run this script was first written for: the prior run
 * (evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/execution-
 * result.json, work item `modiv-termination-fee-7-3`) pinned ONLY Section
 * 7.3 ("Fees and Expenses"). That run found all six/seven fee-trigger
 * candidates but rejected every one of them TRIGGER_UNCORROBORATED, because
 * Section 7.3 states every trigger as a BARE cross-reference to Section 7.1
 * ("Termination") -- e.g. "by the Company pursuant to Section 7.1(c)(i)" --
 * with no operative description of the ground itself, and Section 7.1 was
 * not in the governed scope. Separately, zero TERMINATION_FEE_AMOUNT
 * candidates were ever proposed, because the dollar figures behind
 * "Company Termination Fee" / "Company Base Amount" / "Parent Termination
 * Fee" / "Parent Base Amount" live in Section 8.12 ("Definitions"),
 * specifically sub-clauses (f), (m), (gg) and (vv) as PRINTED in the
 * agreement -- also not in scope. The scope-corrected run pins Section 7.1
 * and Section 8.12 alongside Section 7.3, all three dispatched under the
 * SAME TERMINATION_FEE family (one family, not a family expansion), via
 * explicit `section_family_assignments`. `DEAL_PINS.modiv`'s
 * `default_section_refs_by_family.TERMINATION_FEE` below is exactly that
 * three-section list, preserved verbatim, so the plain invocation (only
 * `--out-dir` given) still reproduces this run's defaults unchanged.
 *
 * WHY "8.12" AS ONE WHOLE SECTION, NOT "8.12(gg)"/"8.12(vv)" DIRECTLY. The
 * printed labels "(gg)" and "(vv)" are real (the agreement's own Section
 * 8.12(m) formula cross-cites "Section 8.12(f)" as "Company Base Amount",
 * and Section 8.12 itself, read start to finish, defines "Parent Base
 * Amount" at printed label (gg) and "Parent Termination Fee" at printed
 * label (vv)) -- but this filing's Section 8.12 restarts its own internal
 * enumeration at "(z)" (a single defined term, "Intellectual Property",
 * whose OWN internal sub-clauses happen to be lettered (a)-(f)) and the
 * deterministic sectionizer's marker-depth heuristic reads the following
 * "(aa)" as a CHILD of that inner enumeration rather than the outer list's
 * next sibling. The result: `findSectionByReference` resolves "8.12(f)" and
 * "8.12(m)" cleanly (they sit before the "(z)" collision) but returns
 * nothing for "8.12(gg)" or "8.12(vv)". Pinning the whole "8.12" node
 * sidesteps the addressing bug entirely rather than guessing a
 * nested-chain reference string.
 *
 * SECTION REFERENCES ARE ALWAYS EXPLICIT, NEVER GUESSED ACROSS FAMILIES.
 * Which sections carry a family differs by agreement, so `--section-refs`
 * is the one thing this script will not infer for an unfamiliar deal or
 * family combination: a default section list exists ONLY for the exact
 * (deal, family) pairs recorded in `DEAL_PINS`, and any other combination
 * must name its sections explicitly or the run refuses before touching the
 * source file.
 *
 * DRY RUN. `--dry-run` resolves the pinned source, verifies both hashes,
 * sectionizes, resolves every requested section reference, and resolves
 * the chosen family's producer-prompt version -- then stops, reporting what
 * a live run would dispatch and how many model calls it would cost, without
 * calling a model or a CLI subprocess. Useful for learning about a run
 * before paying for it; several defects in earlier live runs of this script
 * (a wrong section reference, an unregistered family) would have been
 * visible for free this way.
 *
 * SOURCE. Reuses a deal's ALREADY-ADMITTED, already-committed raw HTML (no
 * live fetch: this is a re-run against an admitted source, never a new
 * pinning fetch). Independently re-derives and asserts both the raw-bytes
 * SHA-256 and the canonical-text SHA-256 against `DEAL_PINS[deal]`, refusing
 * to proceed on any mismatch, rather than trusting a committed value
 * blindly.
 *
 * MODEL BACKEND. No ANTHROPIC_API_KEY is assumed. Drives the model via the
 * Claude Code subscription CLI (`claude -p`), injected through
 * createAnthropicProvider's `client` seam, capturing full usage/cost/
 * duration telemetry from `--output-format json`. `maxRetries: 0`: a failed
 * call fails the run, it does not silently retry and blur the call count
 * this run exists partly to report.
 *
 * Usage:
 *   node scripts/canonical-v2-live-extraction-run.mjs \
 *     [--deal <deal id registered in DEAL_PINS, default "modiv">] \
 *     [--family <registered section_family, default "TERMINATION_FEE">] \
 *     [--raw-html <path, default: the deal's own pinned source path>] \
 *     [--section-refs <comma-separated, default: only exists for deal=modiv \
 *        + family=TERMINATION_FEE, "7.1,7.3,8.12" -- every other combination \
 *        must name its sections explicitly>] \
 *     [--out-dir <path, required unless --dry-run>] \
 *     [--agreement-date <default: the deal's own pinned date, if any>] \
 *     [--model <claude CLI model alias, default "sonnet">] \
 *     [--no-follow-citations] \
 *     [--call-timeout-ms <positive integer, default 600000>] \
 *     [--v1-snapshot <path to a committed V1_PROVISION_SNAPSHOT/V1 JSON, \
 *        default: none -- condition 1 (v1<->v2 comparator) then stays \
 *        unevaluated for every claim, recorded explicitly in run-manifest.json>] \
 *     [--dry-run]
 *
 * M3 AUTO-PASS CONDITIONS. Every resolveCandidates() call below wires both
 * of Ben's two M3 auto-pass conditions (docs/core/PLAN.md, "Prerequisite."):
 * condition 2 (lexical-disagreement net, lexical-disagreement-net.js) is
 * always built, one receipt per resolved section, from this run's own
 * resolved candidates -- no extra input needed. Condition 1 (v1<->v2
 * comparator, v1v2-comparator.js) needs a committed V1_PROVISION_SNAPSHOT/V1
 * for the SAME deal, which this script never fetches on its own (that is
 * scripts/export-v1-provision-snapshot.mjs's separately-gated job) -- pass
 * one via --v1-snapshot to evaluate it. Absent, condition 1 stays
 * unevaluated (`V1_V2_COMPARATOR_ABSENT` on every claim), and this run's
 * `run-manifest.json.m3_auto_pass_conditions.v1v2_comparison` records that
 * fact plainly rather than omitting it.
 *
 * --follow-citations dispatches an extra single-section call for each
 * section a fee trigger cites by bare cross-reference, so the model can
 * read the ground it is being asked to name. One hop only, and -- by
 * native-extraction-run-citation-followup.js's own design -- scoped to
 * TERMINATION_FEE bare-citation fee triggers specifically: for every other
 * family this flag dispatches zero extra calls (documented as INERT by that
 * module) rather than doing something family-specific silently. Off by
 * default because on the Modiv filing it takes three model calls to
 * roughly fourteen.
 */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const {
  retrievalPolicyDigestFor, sourceMapPayloadPathFor,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
// V38, not V34. The runner sat on V34 while the resolver dispatch table and
// claim definitions for three antitrust assertion kinds had already landed in
// V38, so every one of those candidates fell out as open world for want of a
// governed home that existed. Replaying the committed antitrust run with V38
// gives all eleven a home, two resolving and nine queueing honestly, with no
// change to anything that already resolved.
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  createRecordingClient,
  createReplayClient,
  createOrderedReplayClient,
  buildRecordingFromSectionFixtures,
  replayCoverage,
} = require('../lib/canonical-v2/native-producer/provider-record-replay');
const {
  getProducerPromptModule, listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { runNativeExtraction, NativeExtractionRunError } = require('../lib/canonical-v2/native-producer/native-extraction-run');
// Opt-in only, via --follow-citations. The wrapper takes the same arguments and
// is inert when nothing cites anything, but it is NOT free: on the Modiv
// filing it turns three model calls into roughly fourteen, because Section
// 7.3 states every fee trigger as a bare cross-reference into Section 7.1.
// Left off by default so an ordinary re-run stays comparable with every
// earlier one. It is also, by its own module header, scoped to
// TERMINATION_FEE bare-citation fee triggers specifically -- inert for every
// other family (see this file's own header note above).
const { runNativeExtractionWithCitationFollowup } = require('../lib/canonical-v2/native-producer/native-extraction-run-citation-followup');
const {
  resolveCandidates, computeSectionCandidatesForLexicalDigest,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
// Ben's two M3 auto-pass conditions (docs/core/PLAN.md, "Prerequisite. Wire
// Ben's two M3 auto-pass conditions before rung 1"). Both are pure,
// deterministic, no-model-call modules -- see each file's own header.
// Condition 2 (lexical-disagreement) is ALWAYS built from this run's own
// data, no extra input needed. Condition 1 (v1<->v2 comparator) needs a
// committed V1_PROVISION_SNAPSHOT/V1 the caller supplies via --v1-snapshot;
// absent that, condition 1 stays unevaluated and this run's evidence records
// that explicitly (see "Step 4" below), never silently.
const { buildLexicalDisagreementReceipt } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const { buildV1V2ComparisonReceipt } = require('../lib/canonical-v2/native-producer/v1v2-comparator');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const {
  buildReviewQueueArtifact, serialiseReviewQueueArtifact,
} = require('../lib/canonical-v2/native-producer/review-queue-artifact');

const DEFAULT_DEAL = 'modiv';
const DEFAULT_FAMILY = 'TERMINATION_FEE';

/**
 * This script's own path, relative to the current working directory --
 * derived from `import.meta.url`, never hard-coded. `run-manifest.json`'s
 * `script` field is a provenance record of which script produced it: a
 * literal string here is exactly the trap this file's own filename fell
 * into once already (generalised without being renamed, so every manifest
 * it wrote kept naming a one-off scope correction it no longer was). Deriving
 * it means a future rename of this file keeps every manifest it writes
 * afterwards accurate automatically, with nothing to remember to update.
 */
// Relative to the repository root, or absolute if it lies outside it.
//
// `startsWith`, not `includes`. With `includes`, a path that merely CONTAINS
// the working directory somewhere in the middle was sliced from the front by
// the working directory's length, producing a mangled path; and a path under
// a different root was recorded absolute, which is machine-specific and fails
// to resolve anywhere else. Both matter now that source-reference.json's
// recorded paths are read back to rebuild the source chain.
function repoRelative(absolutePath) {
  const root = `${process.cwd()}/`;
  return absolutePath.startsWith(root) ? absolutePath.slice(root.length) : absolutePath;
}

function scriptRelativePath() {
  return repoRelative(fileURLToPath(import.meta.url));
}

// UTF-8 BYTE offsets, never UTF-16 code units (CLAUDE.md's own standing
// trap note) -- `section.start`/`section.end` on a `resolved_sections` entry
// are byte offsets into the canonical text, so this slices via `Buffer`,
// matching scripts/nets-eligibility-report.mjs's own `sectionBodyText`.
function sectionBodyText(canonicalText, section) {
  return Buffer.from(canonicalText, 'utf8').slice(section.start, section.end).toString('utf8');
}

// ─────────────────────────────────────────────────────────────────────────
// DEAL_PINS -- the ONE place a deal identifier is mapped to its expected
// source digests. A deal absent from this table is refused
// (`UNPINNED_DEAL`), never inferred from whatever bytes happen to sit at a
// path. Adding a deal means adding an entry here, deliberately.
//
// `modiv`'s three pinned values (`raw_bytes_sha256`, `canonical_text_sha256`,
// `default_section_refs_by_family.TERMINATION_FEE`) are copied verbatim from
// this script's own pre-generalisation constants -- never recomputed --
// which is what keeps the plain `--out-dir`-only invocation's defaults
// unchanged. `section_expectations` carries the same per-section
// kind/heading assertions the original script hard-coded inline, moved here
// so they apply only to the deal (and sections) they were ever actually
// verified against; a section reference with no entry here is still
// required to resolve against the sectionizer's tree (that check is
// universal, see `sectionizeAndResolve` below), it just is not held to a
// specific kind or heading.
//
// `topbuild`'s two hashes were independently re-derived the same way this
// script derives Modiv's (read the committed raw HTML, sha256 it, convert
// to canonical text via sec-html-canonical-text.js, sha256 that, verify
// PASS via sec-html-canonical-text-verifier.js) and cross-checked against
// the already-committed
// tests/fixtures/canonical-v2/mae-definition-family/topbuild-intake-pin.json
// -- both hashes and both byte lengths match that pin exactly. No pin below
// is invented without that kind of corroboration from something already
// committed.
// Every capture this script builds declares the same content type. Named so
// the rebuilder and the run's own recorded inputs cannot drift from it.
const CAPTURE_CONTENT_TYPE = 'text/html; charset=UTF-8';

const DEAL_PINS = Object.freeze({
  modiv: Object.freeze({
    label: 'Modiv, Inc. / Global Net Lease, Inc.',
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm',
    raw_html_path: 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm',
    raw_bytes_sha256: '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968',
    canonical_text_sha256: '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e',
    // The PINNING FETCH's timestamp, copied verbatim from
    // tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json. See
    // the note on `retrieved_at` below `DEAL_PINS`.
    retrieved_at: '2026-08-01T15:05:49.024Z',
    agreement_date: '2026-05-03',
    pin_corroboration: 'tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json, and the prior '
      + 'TERMINATION_FEE run receipt at evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/'
      + 'execution-result.json (work_item_id modiv-termination-fee-7-3, run_receipt.source_sha256 / .document_hash)',
    // All 25 registered families (PLAN.md Step 2A). Twenty-four are HARVESTED
    // from the section lists previous sweeps actually used -- twenty from
    // run-manifest.json's `section_references`, four from
    // section-location-scan.json's `requested_section_references` for the
    // directories that have no manifest. That is human judgement already
    // spent, and it is what the committed baseline was produced against, so
    // rung 1-4 diffs compare like with like.
    //
    // The stage-1 generator
    // (scripts/canonical-v2-generate-family-section-refs.mjs --compare)
    // disagrees with the harvest on 17 families. Those disagreements are NOT
    // resolved here: settling them needs the document read, which is Step 2A's
    // review pass. Pinning the harvest keeps the ladder runnable and keeps the
    // baseline comparable; the generator's proposal is committed alongside at
    // docs/codex-program/notes/family-section-refs-modiv-20260807-generated.json
    // so the difference stays visible.
    default_section_refs_by_family: Object.freeze({
      ANTITRUST_REGULATORY: Object.freeze(["5.5"]),
      APPRAISAL_DISSENTERS_RIGHTS: Object.freeze(["2.6"]),
      CAPITALISATION: Object.freeze(["3.2","4.2"]),
      CLOSING_CONDITIONS: Object.freeze(["6.1","6.2","6.3","6.4"]),
      // 2.6 CORRECTED IN 2026-08-07, as PLAN.md Step 2A required and as no
      // previous sweep did. Section 2.6 "Dissenters' Rights" reads in full:
      // "No dissenters' or appraisal rights shall be available with respect to
      // the Mergers." 119 bytes, verified against the document.
      //
      // It belongs to THIS family, not to Appraisal. The appraisal producer
      // prompt (native-producer/appraisal-producer-prompt.js) says in terms
      // "Never assert a negative" and that availability "remain[s] with
      // Consideration", so the appraisal run requesting 2.6 and declining to
      // assert anything from it was correct by design -- which is why that
      // family's zero is a correct zero and not a taxonomy gap.
      //
      // NOT YET RUN: there are no recorded responses for 2.6 under this
      // family, so this needs a live call before it produces anything. The
      // committed baseline entry still reflects the 2.1/2.2/2.3 run.
      CONSIDERATION: Object.freeze(["2.1","2.2","2.3","2.6"]),
      DIVIDENDS: Object.freeze(["5.10"]),
      DNO_INDEMNIFICATION: Object.freeze(["5.8"]),
      EMPLOYEE_MATTERS: Object.freeze(["3.11","3.12"]),
      FINANCING_COVENANTS: Object.freeze(["4.13","5.20"]),
      GENERAL_COVENANTS: Object.freeze(["5.3","5.7","5.9"]),
      GUARANTY_FINANCING_PARTY: Object.freeze(["5.11"]),
      INTERIM_OPERATING: Object.freeze(["5.1"]),
      // CORRECTED 2026-08-07, and the correction is the reason this family
      // produced nothing. The harvested pin was ["8.5"] alone. Section 8.5 is
      // "Interpretation; Certain Definitions" -- 3,391 bytes of construction
      // conventions -- while Section 8.12 is "Definitions", 54,682 bytes and
      // the actual defined terms. So the run was pointed at the wrong section
      // and correctly found only construction rules: the fifteen terms it
      // proposed were "include", "hereof", "extent", "dollars", "or",
      // "shall", "days", "from", "to and until", "through" and five others,
      // every one of which fell out as an ungoverned DEFINITION_ENVELOPE.
      //
      // That is a pin defect, not a resolver defect, and it was invisible
      // because a family finding nothing looks the same either way. The
      // stage-1 generator proposed ["8.5","8.12"] and was right; the harvest
      // from a previous sweep was wrong. 8.5 is kept because the run that
      // produced the baseline used it and the containment check requires it.
      //
      // NOT YET RUN against 8.12: there are no recorded responses for that
      // section under this family, so the corrected pin needs a live call
      // before it produces anything. Until then this family's zero is
      // explained, not fixed.
      KEY_DEFINED_TERMS: Object.freeze(["8.5", "8.12"]),
      // Never run against Modiv: the only 2026-08-06 MAE run is TopBuild, so
      // this list began as the stage-1 generator's PROPOSAL rather than
      // judgement harvested from a run that happened.
      //
      // REVIEWED AGAINST THE DOCUMENT 2026-08-07, as PLAN.md Step 2A required,
      // and the proposal is correct. Section 8.12 "Definitions" spans bytes
      // 360,030-414,712 of the Modiv canonical text and contains BOTH
      // definition sites: "Company Material Adverse Effect" means at byte
      // 367,819 and "Parent Material Adverse Effect" means at byte 387,682.
      // Each appears exactly once; of the document's 77 mentions of the
      // phrase, 75 are uses. Pinned by
      // tests/canonical-v2-mae-definition-pin-review.test.js, so a sectionizer
      // change that moved the boundary would fail rather than silently narrow
      // the run.
      //
      // (Those two offsets were first recorded as 366,186 and 385,847, which
      // were UTF-16 character indices mislabelled as bytes. The test now
      // asserts them rather than only stating them.)
      //
      // Cost note, not a defect: 8.12 is the whole definitions article at
      // ~55 KB, so this is one expensive call over a section mostly not about
      // MAE. Narrowing needs evidence about the producer's behaviour on a
      // narrower anchor, which does not exist until the family runs once.
      // Rung 4 is where it first runs, creating a baseline rather than
      // checking one.
      MAE_DEFINITION: Object.freeze(['8.12']),
      MATERIAL_CONTRACTS: Object.freeze(["3.17"]),
      MERGER_STRUCTURE_CLOSING: Object.freeze(["1.1","1.4","1.5","1.6"]),
      MISC_BOILERPLATE: Object.freeze(["8.2","8.3","8.4","8.7","8.9","8.10"]),
      NO_OTHER_REPS_FRAUD: Object.freeze(["3.25"]),
      NO_SHOP: Object.freeze(["5.6"]),
      PROXY_MEETING: Object.freeze(["5.4"]),
      REPRESENTATIONS: Object.freeze(["3.1","3.3","3.4"]),
      SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze(["8.8"]),
      TAX_MATTERS: Object.freeze(["3.13","4.15","5.12"]),
      TERMINATION: Object.freeze(["7.1","7.2"]),
      TERMINATION_FEE: Object.freeze(["7.1","7.3","8.12"]),
    }),
    // Verified empirically against this exact filing before this script was
    // first written: "7.1" -> SECTION heading "Termination"; "7.3" ->
    // SECTION heading "Fees and Expenses"; "8.12" -> SECTION heading
    // "Definitions".
    section_expectations: Object.freeze({
      '7.1': Object.freeze({ kind: 'SECTION', heading: /Termination/i }),
      '7.3': Object.freeze({ kind: 'SECTION', heading: /Fees/i }),
      '8.12': Object.freeze({ kind: 'SECTION', heading: /Definitions/i }),
    }),
    // Purely a debugging aid carried over from the original script's
    // section-location-scan.json (`all_7x_and_8_12_nodes`): every node whose
    // reference falls in Article 7 or under 8.12, so a reviewer can see
    // neighbouring sections without re-running the sectionizer by hand.
    // Optional; only meaningful for a deal a reviewer is this familiar with.
    debug_related_node_pattern: /^7\.[0-9]|^8\.12/,
  }),
  topbuild: Object.freeze({
    label: 'QXO, Inc. / TopBuild Corp.',
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm',
    raw_html_path: 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm',
    raw_bytes_sha256: '146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f',
    canonical_text_sha256: '7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d',
    // The PINNING FETCH's timestamp from
    // tests/fixtures/canonical-v2/mae-definition-family/topbuild-intake-pin.json,
    // normalised to the millisecond form the capture contract requires
    // (that file records `2026-08-03T02:20:00Z`).
    retrieved_at: '2026-08-03T02:20:00.000Z',
    // Not pinned in this repo yet: pass --agreement-date explicitly for a
    // TopBuild run that needs it (e.g. for deadline/date resolution).
    agreement_date: null,
    pin_corroboration: 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-intake-pin.json -- both '
      + 'raw_bytes_sha256 and canonical_text_sha256 above were independently re-derived from the committed '
      + 'raw HTML and match that pin file exactly (raw_bytes_length 732686, canonical_text_byte_length '
      + '412860, verification_status PASS)',
    default_section_refs_by_family: Object.freeze({}),
    section_expectations: Object.freeze({}),
    debug_related_node_pattern: null,
  }),
});

function parseArgs(argv) {
  const out = {
    deal: DEFAULT_DEAL,
    family: DEFAULT_FAMILY,
    model: 'sonnet',
    rawHtml: null,
    sectionRefs: null,
    agreementDate: null,
    agreementDateGiven: false,
    followCitations: true,
    timeoutMs: null,
    dryRun: false,
    outDir: null,
    v1SnapshotPath: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--deal': out.deal = argv[++i]; break;
      case '--family': out.family = argv[++i]; break;
      case '--raw-html': out.rawHtml = argv[++i]; break;
      case '--section-refs': out.sectionRefs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--out-dir': out.outDir = argv[++i]; break;
      case '--agreement-date': out.agreementDate = argv[++i]; out.agreementDateGiven = true; break;
      case '--model': out.model = argv[++i]; break;
      case '--follow-citations': out.followCitations = true; break;
      case '--no-follow-citations': out.followCitations = false; break;
      case '--call-timeout-ms': {
        const raw = argv[++i];
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--call-timeout-ms must be a positive integer, got ${JSON.stringify(raw)}`);
        out.timeoutMs = parsed;
        break;
      }
      case '--dry-run': out.dryRun = true; break;
      case '--record': out.recordPath = argv[++i]; break;
      case '--replay': out.replayPath = argv[++i]; break;
      case '--replay-from-run': out.replayFromRunDir = argv[++i]; break;
      case '--v1-snapshot': out.v1SnapshotPath = argv[++i]; break;
      default: throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  if (!out.dryRun && !out.outDir) throw new Error('--out-dir is required (unless --dry-run)');
  if ([out.recordPath, out.replayPath, out.replayFromRunDir].filter(Boolean).length > 1) {
    throw new Error('MUTUALLY_EXCLUSIVE: --record captures live responses, --replay consumes them; pick one');
  }
  if (out.dryRun && (out.recordPath || out.replayPath || out.replayFromRunDir)) {
    throw new Error('--dry-run never reaches a model, so it cannot --record or --replay');
  }
  if (out.sectionRefs && out.sectionRefs.length === 0) throw new Error('--section-refs must name at least one section reference');
  return out;
}

/**
 * Pure semantic resolution over already-parsed CLI args: which deal, which
 * family, which section references, which source path, which agreement
 * date. Zero filesystem/network access -- everything here is either a
 * lookup into `DEAL_PINS` or the registry's own `listRegisteredSectionFamilies()`
 * introspection, so this function is unit-testable with no I/O at all.
 *
 * Throws three independently-distinguishable, loudly-labelled errors for
 * the three ways a run must refuse rather than proceed:
 *   - `UNREGISTERED_FAMILY` -- `--family` names something
 *     producer-prompt-registry.js has never heard of.
 *   - `UNPINNED_DEAL` -- `--deal` names something absent from `DEAL_PINS`.
 *   - a plain `Error` when the (deal, family) combination has no pinned
 *     default section references AND `--section-refs` was not given
 *     explicitly -- section references are never guessed across families.
 */
function resolveRunConfig(args) {
  const registeredFamilies = listRegisteredSectionFamilies();
  if (typeof args.family !== 'string' || !args.family || !registeredFamilies.includes(args.family)) {
    throw new Error(
      `UNREGISTERED_FAMILY: "${args.family}" is not a registered section family. `
      + `Registered families: ${registeredFamilies.join(', ')}.`,
    );
  }

  const dealPin = DEAL_PINS[args.deal];
  if (!dealPin) {
    throw new Error(
      `UNPINNED_DEAL: no committed pin for deal "${args.deal}". `
      + `Registered deals: ${Object.keys(DEAL_PINS).sort().join(', ')}. `
      + 'Add a pin to DEAL_PINS deliberately before running this deal -- an unpinned deal is a reason to '
      + 'stop and ask, not to proceed.',
    );
  }

  const rawHtmlPath = args.rawHtml || dealPin.raw_html_path;

  const defaultRefs = dealPin.default_section_refs_by_family
    && dealPin.default_section_refs_by_family[args.family];
  const sectionRefs = (args.sectionRefs && args.sectionRefs.length > 0) ? args.sectionRefs : defaultRefs;
  if (!sectionRefs || sectionRefs.length === 0) {
    throw new Error(
      `--section-refs is required for deal "${args.deal}" + family "${args.family}": no default section `
      + 'references are pinned for this combination. Which sections carry a family differs by agreement -- '
      + 'name them explicitly.',
    );
  }

  const agreementDate = args.agreementDateGiven ? args.agreementDate : (dealPin.agreement_date || null);

  return Object.freeze({
    deal: args.deal,
    dealPin,
    family: args.family,
    rawHtmlPath,
    sectionRefs: Object.freeze([...sectionRefs]),
    agreementDate,
    model: args.model,
    followCitations: args.followCitations,
    dryRun: args.dryRun,
    outDir: args.outDir,
    recordPath: args.recordPath || null,
    replayPath: args.replayPath || null,
    replayFromRunDir: args.replayFromRunDir || null,
    v1SnapshotPath: args.v1SnapshotPath || null,
  });
}

/**
 * Resolves the producer prompt module registered for `family` and reports
 * its `{prompt_id, prompt_version}` -- WITHOUT a model call. Every
 * registered producer prompt builder is a pure, synchronous function that
 * takes `{source_text, governed_scope, known_definitions}` and returns
 * `{prompt_id, prompt_version, messages}`; probing it with a throwaway
 * string and an empty governed_scope object is how `native-extraction-run.js`
 * itself learns a prompt's id/version (see its own `prompt.prompt_id` /
 * `prompt.prompt_version` read after calling the SAME builder function this
 * resolves), so this is not a parallel or approximate mechanism, it is the
 * real one, called early and standalone.
 *
 * Fails loudly for an unregistered family rather than silently reporting
 * nothing -- this replaces the previous hard-coded
 * `require('./termination-fee-producer-prompt').PROMPT_VERSION` import.
 */
function resolvePromptVersionInfo(family) {
  const registeredFamilies = listRegisteredSectionFamilies();
  if (!registeredFamilies.includes(family)) {
    throw new Error(
      `UNREGISTERED_FAMILY: "${family}" is not a registered section family. `
      + `Registered families: ${registeredFamilies.join(', ')}.`,
    );
  }
  const builder = getProducerPromptModule(family);
  if (typeof builder !== 'function') {
    throw new Error(
      `UNREGISTERED_FAMILY: "${family}" reports as registered but producer-prompt-registry.js resolved no `
      + 'builder function for it. This should be unreachable; treat it as a registry bug.',
    );
  }
  const probe = builder({
    source_text: 'PROBE TEXT: used only to read prompt_id/prompt_version, never sent to a model.',
    governed_scope: Object.freeze({}),
    known_definitions: [],
  });
  if (!probe || typeof probe.prompt_version === 'undefined') {
    throw new Error(`PROMPT_VERSION_UNAVAILABLE: producer prompt module for family "${family}" did not report a prompt_version.`);
  }
  return Object.freeze({ prompt_id: probe.prompt_id, prompt_version: probe.prompt_version });
}

/**
 * Reads the deal's committed raw HTML (from `rawHtmlPath`, which defaults
 * to but need not equal `dealPin.raw_html_path` -- see the file header's
 * "PER-DEAL PINNED LOOKUP" note: whatever bytes are read are ALWAYS checked
 * against `dealPin`'s own digests, never against wherever they came from),
 * independently re-derives its raw-bytes and canonical-text SHA-256, and
 * refuses to proceed on any mismatch. Never falls back to a live fetch.
 */
function loadAndVerifySource({ dealPin, deal, rawHtmlPath }) {
  const absoluteRawHtmlPath = resolve(rawHtmlPath);
  if (!existsSync(absoluteRawHtmlPath)) {
    throw new Error(`SOURCE_FILE_NOT_FOUND: committed raw HTML not found at ${absoluteRawHtmlPath} for deal "${deal}" -- refusing to fall back to a live fetch`);
  }
  const rawBytes = readFileSync(absoluteRawHtmlPath);
  const rawBytesSha256 = sha256Hex(rawBytes);
  if (rawBytesSha256 !== dealPin.raw_bytes_sha256) {
    throw new Error(
      `RAW_BYTES_HASH_MISMATCH: raw HTML at ${absoluteRawHtmlPath} does not match the pin for deal "${deal}": `
      + `expected ${dealPin.raw_bytes_sha256}, got ${rawBytesSha256}`,
    );
  }

  // Imported, not restated. The digest is of a sentence, so one character's
  // drift between this script and the rebuilder changes the capture receipt
  // and every identity below it -- and the failure would surface only as an
  // unexplained reference mismatch at import time.
  const retrievalPolicyDigest = retrievalPolicyDigestFor(deal);
  // PINNED, not wall-clock. This script does not fetch: it reuses raw HTML
  // that was fetched once and committed, so `new Date()` here recorded the
  // time of a retrieval that never happened, and recorded it nowhere.
  //
  // That cost more than tidiness. `retrieved_at` feeds
  // `intake_capture_receipt_id`, which feeds `verification_manifest_id`,
  // which feeds `immutable_source_document_id` -- the identity the canonical
  // writer rebuilds and compares before it will accept a write. A run that
  // does not record its own timestamp cannot rebuild its own source chain,
  // and every run made before 2026-08-07 is in that position.
  //
  // The pinned value is the PINNING FETCH's timestamp, which is the one
  // moment this document actually was retrieved.
  const retrievedAt = dealPin.retrieved_at;
  if (!retrievedAt) {
    throw new Error(
      `UNPINNED_RETRIEVAL_TIMESTAMP: deal "${deal}" has no pinned retrieved_at. Add the pinning fetch's `
      + 'timestamp to DEAL_PINS rather than substituting a wall-clock value: an unrecorded timestamp '
      + 'makes the run\'s admitted-source chain unrebuildable and the run unimportable.',
    );
  }
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: dealPin.retrieval_url,
    final_url: dealPin.retrieval_url,
    status_code: 200,
    content_type: CAPTURE_CONTENT_TYPE,
    retrieved_at: retrievedAt,
    retrieval_policy_digest: retrievalPolicyDigest,
    redirect_count: 0,
    response_bytes: rawBytes,
  });

  const conversion = convertSecHtmlToCanonicalText(capture);
  if (conversion.canonical_text_sha256 !== dealPin.canonical_text_sha256) {
    throw new Error(
      `CANONICAL_TEXT_HASH_MISMATCH: canonical text sha256 mismatch for deal "${deal}": `
      + `expected ${dealPin.canonical_text_sha256}, got ${conversion.canonical_text_sha256}`,
    );
  }
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  if (verification.verification_status !== 'PASS') {
    throw new Error(`SOURCE_VERIFICATION_FAILED: independent canonical-text verification did not PASS for deal "${deal}": ${verification.verification_status}`);
  }

  return {
    rawHtmlPath: absoluteRawHtmlPath,
    rawBytes,
    rawBytesSha256,
    capture,
    conversion,
    verification,
    // Every input the capture was built from, so the run can record them and
    // rebuild its own chain later without re-deriving anything by guess.
    captureInputs: {
      retrieval_url: dealPin.retrieval_url,
      content_type: CAPTURE_CONTENT_TYPE,
      retrieved_at: retrievedAt,
      retrieval_policy_digest: retrievalPolicyDigest,
    },
  };
}

/**
 * Builds the admitted semantic source context a resolved run needs, keyed
 * by a deal+family-scoped deal key/admission id (so two different families
 * run against the same underlying document get independently addressable
 * admissions, rather than colliding). Pure content-derivation over already
 * loaded/verified source data -- no I/O of its own.
 */
function buildAdmittedContext({
  deal, family, dealPin, verified,
}) {
  const { capture, conversion, verification } = verified;
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const dealKeySlug = `${deal}-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const dealKey = `deal:${dealKeySlug}:${sha256Hex(dealPin.retrieval_url).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-${dealKeySlug}:${dealPin.retrieval_url}`);
  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  return {
    admissionBundle, admittedSourceContext, dealKey, dealAdmissionId,
  };
}

/**
 * Sectionizes the admitted source and resolves every requested section
 * reference against the tree BEFORE any model call is made, exactly as
 * `native-extraction-run.js` itself will (this is a friendlier, earlier
 * failure of the same fail-closed check, not a parallel one). When the
 * deal pin carries a `section_expectations` entry for a given reference,
 * asserts the resolved node's kind/heading match it -- a numbering drift
 * on a deal this well-characterised fails loudly instead of silently
 * extracting the wrong text. A reference with no entry (any deal/family
 * combination this script has not been specifically pinned against before)
 * is still required to resolve against the tree; it is just not held to a
 * specific kind or heading, since that cannot be known in advance for an
 * unfamiliar combination.
 */
function sectionizeAndResolve({
  sourceText, documentHash, sectionRefs, sectionExpectations = {},
}) {
  const tree = sectionizeAdmittedSource({ source_text: sourceText, document_hash: documentHash });
  const kindCounts = {};
  for (const n of tree.nodes) kindCounts[n.kind] = (kindCounts[n.kind] || 0) + 1;

  const resolvedNodesByRef = {};
  const resolutions = [];
  for (const ref of sectionRefs) {
    const node = findSectionByReference(tree, ref);
    if (!node) {
      throw new Error(
        `SECTION_REFERENCE_UNRESOLVED: section reference "${ref}" could not be resolved against the tree `
        + `(node count=${tree.nodes.length}). Aborting per instruction: do not guess a section.`,
      );
    }
    const expectation = sectionExpectations[ref];
    if (expectation) {
      if (expectation.kind && node.kind !== expectation.kind) {
        throw new Error(
          `SECTION_KIND_MISMATCH: section "${ref}" resolved to kind=${node.kind}, expected ${expectation.kind}. `
          + `heading=${JSON.stringify(node.heading)} start=${node.start} end=${node.end}. Aborting.`,
        );
      }
      if (expectation.heading && !expectation.heading.test(node.heading || '')) {
        throw new Error(
          `SECTION_HEADING_MISMATCH: section "${ref}" resolved to heading=${JSON.stringify(node.heading)}, `
          + `expected to match ${expectation.heading}. kind=${node.kind} start=${node.start} end=${node.end}. Aborting.`,
        );
      }
    }
    resolvedNodesByRef[ref] = node;
    resolutions.push(Object.freeze({
      section_reference: ref,
      kind: node.kind,
      heading: node.heading || null,
      start: node.start,
      end: node.end,
      byte_length: node.end - node.start,
    }));
  }
  return {
    tree, kindCounts, resolvedNodesByRef, resolutions,
  };
}

/**
 * The dry-run report: everything a caller would want to know before paying
 * for a live run, computed with zero model calls.
 */
function buildDryRunReport({
  config, verified, resolutions, promptInfo, documentHash,
}) {
  return {
    schema_version: 'GENERAL_EXTRACTION_RUN_DRY_RUN_REPORT/V1',
    deal: config.deal,
    deal_label: config.dealPin.label || null,
    family: config.family,
    section_references: config.sectionRefs,
    raw_html_path: verified.rawHtmlPath,
    retrieval_url: config.dealPin.retrieval_url,
    agreement_date: config.agreementDate,
    model_cli_alias: config.model,
    follow_citations: config.followCitations,
    source: {
      raw_bytes_length: verified.rawBytes.length,
      raw_bytes_sha256: verified.rawBytesSha256,
      canonical_text_byte_length: verified.conversion.canonical_text_byte_length,
      canonical_text_sha256: verified.conversion.canonical_text_sha256,
      verification_status: verified.verification.verification_status,
      document_hash: documentHash,
    },
    prompt: promptInfo,
    sections_resolved: resolutions,
    projected_model_call_count: config.sectionRefs.length,
    projected_model_call_note: 'One model call per pinned section reference under runNativeExtraction. '
      + '--follow-citations may dispatch additional single-section calls, but only for TERMINATION_FEE '
      + 'bare-citation triggers (native-extraction-run-citation-followup.js is scoped to that one family '
      + 'today) -- it is inert for every other family. The exact extra count cannot be known without a live call.',
    would_call_model: false,
  };
}

// Records what code produced a run, so a later run can answer "did anything
// this depends on change?" without re-running. PLAN.md Stage 2's
// change-triggered re-run policy needs this: the manifest previously carried
// prompt_version, contract_bundle_version and section_references but no
// commit and no resolved model, so neither "did the code change" nor "did the
// model change" was answerable from a receipt.
function runProvenance() {
  const read = (args) => {
    try {
      const out = spawnSync('git', args, { encoding: 'utf8' });
      return out.status === 0 ? String(out.stdout).trim() : null;
    } catch {
      return null;
    }
  };
  const commit = read(['rev-parse', 'HEAD']);
  const dirty = read(['status', '--porcelain']);
  return {
    // Null rather than a guess when git is unavailable. A wrong commit is
    // worse than a missing one: it would make a changed run look unchanged.
    commit: commit || null,
    // A dirty tree means the commit does not describe what actually ran, so
    // change-detection against it is unsound. Say so rather than imply the
    // commit is sufficient.
    working_tree_clean: dirty === null ? null : dirty.length === 0,
  };
}

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force subscription auth, not metered billing
  return env;
}

function runClaudeCli(promptText, { model, timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', model], {
      env: childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude -p timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude -p exited ${code}: ${err.slice(0, 800)}`));
      resolvePromise(out);
    });
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

function flattenMessages(params) {
  const parts = [];
  if (params.system) {
    const sys = Array.isArray(params.system) ? params.system.map((b) => b.text || '').join('\n') : String(params.system);
    if (sys.trim()) parts.push(sys);
  }
  for (const m of params.messages || []) {
    const content = typeof m.content === 'string' ? m.content : (m.content || []).map((b) => b.text || '').join('\n');
    parts.push(content);
  }
  return parts.join('\n\n');
}

// Sections are processed by native-extraction-run.js in the exact order of
// the `section_references` array it is given (see that module's `resolved
// = references.map(...)` then `for (const { reference, node } of resolved)`).
// This client relies on that documented ordering -- never on parsing the
// prompt text -- to label each recorded call/fixture with the section
// reference it belongs to, and writes ONE recorded-response fixture PER
// CALL (a fixed path would silently overwrite itself across multiple calls
// in a multi-section run).
function makeMeasuredCliClient({
  model, telemetry, orderedSectionRefs, fixtureOutDir, config, promptInfo,
}) {
  return {
    messages: {
      async create(params) {
        const callIndex = telemetry.calls.length;
        // Attribution is BY CALL ORDER against the pinned section list, and
        // that is only sound while the run issues exactly one call per pinned
        // section. --follow-citations dispatches additional calls beyond that
        // list, so the index overruns and every extra call used to be labelled
        // `unknown-call-N`. The committed
        // modiv-termination-fee-citation-following-20260806 run has 11 of its
        // 14 calls labelled that way. They are not unknown: they are citation
        // follow-ups, a known and expected category, and calling them unknown
        // both loses that information and implies a defect where there is none.
        //
        // The section reference is NOT recoverable from the prompt at this
        // seam -- checked -- so this records the attribution basis alongside
        // the label rather than pretending to a precision it does not have.
        // A consumer that needs per-call section identity for follow-up calls
        // must get it from the citation-following module, not from here.
        const withinPinnedList = callIndex < orderedSectionRefs.length;
        const sectionReference = withinPinnedList
          ? orderedSectionRefs[callIndex]
          : `citation-followup-${callIndex - orderedSectionRefs.length + 1}`;
        const attributionBasis = withinPinnedList
          ? 'ORDERED_PINNED_SECTION'
          : 'CITATION_FOLLOWUP_UNATTRIBUTED';
        const prompt = flattenMessages(params);
        const startedAt = Date.now();
        const rawCliOutput = await runClaudeCli(prompt, { model, ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}) });
        const wallClockMs = Date.now() - startedAt;
        const parsed = JSON.parse(rawCliOutput);
        if (parsed.is_error) throw new Error(`claude -p error (section ${sectionReference}): ${String(parsed.result).slice(0, 500)}`);
        telemetry.calls.push({
          call_index: callIndex,
          section_reference: sectionReference,
          wall_clock_ms: wallClockMs,
          duration_ms_reported: parsed.duration_ms,
          duration_api_ms_reported: parsed.duration_api_ms,
          total_cost_usd_cli: parsed.total_cost_usd,
          usage: parsed.usage,
          model_usage: parsed.modelUsage,
          served_model: parsed.model || null,
          attribution_basis: attributionBasis,
          session_id: parsed.session_id,
        });
        const rawResponseText = parsed.result || '';
        const fixtureSlug = sectionReference.replace(/[^a-zA-Z0-9.]+/g, '_');
        writeFileSync(resolve(fixtureOutDir, `native-producer-recorded-response-${fixtureSlug}.json`), JSON.stringify({
          schema_version: 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1',
          model: `claude-sonnet-5 (served via Claude Code subscription CLI, \`claude -p --model ${model}\`, no ANTHROPIC_API_KEY available in this environment)`,
          recorded_at: new Date().toISOString(),
          section_reference: sectionReference,
          note: `General extraction run: deal=${config.deal}, family=${config.family}, `
            + `section_references=${JSON.stringify(config.sectionRefs)} (all dispatched as ${config.family} via `
            + `section_family_assignments), prompt_id=${promptInfo.prompt_id}, prompt_version=${promptInfo.prompt_version}. `
            + 'request_messages omitted here; raw_response_text is the model\'s literal output including its '
            + '```json fence, byte-for-byte as returned.',
          raw_response_text: rawResponseText,
        }, null, 2));
        return { content: [{ type: 'text', text: rawResponseText }] };
      },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveRunConfig(args);
  const promptInfo = resolvePromptVersionInfo(config.family);
  const logPrefix = `[extraction:${config.deal}:${config.family}]`;

  process.stderr.write(`${logPrefix} prompt_id=${promptInfo.prompt_id} prompt_version=${promptInfo.prompt_version}\n`);
  process.stderr.write(`${logPrefix} deal=${config.deal} (${config.dealPin.label || 'no label'}) section_references=${JSON.stringify(config.sectionRefs)}\n`);
  if (config.dryRun) process.stderr.write(`${logPrefix} --dry-run: resolving pins and sections, will not call a model\n`);

  const outDir = config.outDir ? resolve(config.outDir) : null;
  if (outDir) mkdirSync(outDir, { recursive: true });

  const runStartedAt = Date.now();

  // ─── Step 1: reuse the ALREADY-ADMITTED committed source (no live fetch) ───

  const verified = loadAndVerifySource({ dealPin: config.dealPin, deal: config.deal, rawHtmlPath: config.rawHtmlPath });
  process.stderr.write(`${logPrefix} reused committed raw HTML at ${verified.rawHtmlPath}, sha256=${verified.rawBytesSha256} (MATCHES pin)\n`);

  const { admittedSourceContext } = buildAdmittedContext({
    deal: config.deal, family: config.family, dealPin: config.dealPin, verified,
  });
  const documentHash = admittedSourceContext.document_hash; // = raw HTML sha256
  const fullText = verified.conversion.canonical_text;

  process.stderr.write(`${logPrefix} document_hash = ${documentHash}\n`);
  process.stderr.write(`${logPrefix} canonical_text_sha256 = ${verified.conversion.canonical_text_sha256} (MATCHES pin)\n`);

  // Persist the compressed source map before writing the reference that names
  // it, so a run directory never points at a payload that is not there.
  //
  // WHY AT ALL. IMMUTABLE_SOURCE_DOCUMENT/V2 includes a digest of DEFLATE
  // OUTPUT, and DEFLATE output differs between zlib builds for identical
  // input at identical settings. Without the payload, a run's identity is
  // reproducible only on the machine that produced it -- including only on
  // this machine until the next Node upgrade, since zlib ships inside Node.
  // A rebuild adopts these bytes only after proving they inflate to the map
  // it independently derived from the document.
  //
  // Content-addressed by canonical_text_id, so every run over a given
  // document shares one file rather than committing a copy each.
  //
  // NOT ON A DRY RUN. The store is content-addressed under the repository, so
  // a dry run -- which makes no model call and produces nothing importable --
  // was writing a 1.4 MB file into committed evidence every time the test
  // suite exercised the runner's argument parsing. A dry run needs no
  // payload, because it has no write-set to import.
  let sourceMapPayloadPath = null;
  if (outDir && !config.dryRun) {
    sourceMapPayloadPath = sourceMapPayloadPathFor(verified.conversion.canonical_text_id);
    const absolutePayloadPath = resolve(sourceMapPayloadPath);
    if (!existsSync(absolutePayloadPath)) {
      mkdirSync(dirname(absolutePayloadPath), { recursive: true });
      writeFileSync(absolutePayloadPath, Buffer.from(verified.conversion.source_map_payload_base64, 'base64'));
      process.stderr.write(`${logPrefix} persisted compressed source map at ${sourceMapPayloadPath}\n`);
    }
  }

  if (outDir) {
    writeFileSync(resolve(outDir, 'source-reference.json'), JSON.stringify({
      schema_version: 'GENERAL_EXTRACTION_RUN_SOURCE_REFERENCE/V1',
      deal: config.deal,
      reused_committed_raw_html: repoRelative(verified.rawHtmlPath),
      retrieval_url: config.dealPin.retrieval_url,
      raw_bytes_length: verified.rawBytes.length,
      raw_bytes_sha256: verified.rawBytesSha256,
      canonical_text_byte_length: verified.conversion.canonical_text_byte_length,
      canonical_text_sha256: verified.conversion.canonical_text_sha256,
      verification_status: verified.verification.verification_status,
      document_hash: documentHash,
      pin_corroboration: config.dealPin.pin_corroboration || null,
      note: 'REUSE, not a pinning fetch. No network call was made by this script.',
      // Everything needed to rebuild this run's admitted-source chain, which
      // the canonical writer requires before it will accept a write: it
      // rebuilds the chain from these primitives and refuses unless the
      // result matches the write-set's own source_references.
      //
      // Runs before 2026-08-07 recorded none of this and used a wall-clock
      // retrieved_at, so they cannot rebuild. See
      // lib/canonical-v2/admitted-source-chain-rebuild.js.
      admitted_source_capture_inputs: {
        schema_version: 'ADMITTED_SOURCE_CAPTURE_INPUTS/V1',
        raw_html_path: repoRelative(verified.rawHtmlPath),
        raw_bytes_sha256: verified.rawBytesSha256,
        retrieval_url: verified.captureInputs.retrieval_url,
        content_type: verified.captureInputs.content_type,
        retrieved_at: verified.captureInputs.retrieved_at,
        retrieval_policy_digest: verified.captureInputs.retrieval_policy_digest,
        // The identity the rebuild must land on. Recorded so a divergence
        // can be seen here rather than only as a writer refusal.
        immutable_source_document_id: admittedSourceContext.immutable_source_document_id,
        source_map_payload_path: sourceMapPayloadPath,
        source_map_compressed_sha256: verified.conversion.source_map_compressed_sha256,
        source_map_digest: verified.conversion.source_map_digest,
      },
    }, null, 2));
  }

  // ─── Step 2: sectionize + locate + assert every requested section BEFORE any model call ───

  const {
    tree, kindCounts, resolutions,
  } = sectionizeAndResolve({
    sourceText: fullText,
    documentHash,
    sectionRefs: config.sectionRefs,
    sectionExpectations: config.dealPin.section_expectations || {},
  });
  process.stderr.write(`${logPrefix} sectionizer node count = ${tree.nodes.length}, by kind = ${JSON.stringify(kindCounts)}\n`);
  for (const r of resolutions) {
    process.stderr.write(`${logPrefix} resolved ${r.section_reference}: heading=${JSON.stringify(r.heading)} start=${r.start} end=${r.end} bytes=${r.byte_length}\n`);
  }

  if (outDir) {
    const debugPattern = config.dealPin.debug_related_node_pattern;
    writeFileSync(resolve(outDir, 'section-location-scan.json'), JSON.stringify({
      node_count: tree.nodes.length,
      kind_counts: kindCounts,
      requested_section_references: config.sectionRefs,
      resolved: resolutions,
      ...(debugPattern ? {
        debug_related_nodes: tree.nodes
          .filter((n) => debugPattern.test(n.reference || ''))
          .map((n) => ({
            kind: n.kind, reference: n.reference, heading: n.heading, start: n.start, end: n.end,
          })),
      } : {}),
    }, null, 2));
  }

  if (config.dryRun) {
    const report = buildDryRunReport({
      config, verified, resolutions, promptInfo, documentHash,
    });
    process.stderr.write(`${logPrefix} DRY RUN complete: projected_model_call_count=${report.projected_model_call_count}. Stopping before any model call.\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (outDir) writeFileSync(resolve(outDir, 'dry-run-report.json'), JSON.stringify(report, null, 2));
    return;
  }

  // ─── Step 3: LIVE model calls, one per pinned section, all dispatched under the chosen family ───

  const contractBundle = compileFixtureContractV38();
  const definitions = { known_definitions: [] };
  const telemetry = { calls: [] };

  const sectionFamilyAssignments = config.sectionRefs.map((section_reference) => ({
    section_reference,
    family_id: config.family,
  }));

  // Record/replay (PLAN.md Stage 2 prerequisite). The ladder's gate compares
  // resolved counts across rounds; without replay it cannot tell a regression
  // from a fresh sample of a nondeterministic model.
  let liveClient = makeMeasuredCliClient({
    model: config.model, telemetry, orderedSectionRefs: config.sectionRefs, fixtureOutDir: outDir, config, promptInfo,
  });
  let replayClientRef = null;
  if (config.replayFromRunDir) {
    // Replay a HISTORICAL run from the per-section fixtures it already wrote.
    // Weaker keying than --replay (ordered, not request-hashed) because those
    // fixtures carry no request messages -- see the module header.
    const fixtures = readdirSync(resolve(config.replayFromRunDir))
      .filter((name) => /^native-producer-recorded-response-.+\.json$/.test(name))
      .map((name) => JSON.parse(readFileSync(resolve(config.replayFromRunDir, name), 'utf8')));
    const recording = buildRecordingFromSectionFixtures({
      fixtures,
      orderedSectionRefs: config.sectionRefs,
      model: `legacy-fixtures(${config.replayFromRunDir})`,
    });
    replayClientRef = createOrderedReplayClient({ recording });
    replayClientRef.recording = recording;
    liveClient = replayClientRef;
  } else if (config.replayPath) {
    const recording = JSON.parse(readFileSync(resolve(config.replayPath), 'utf8'));
    replayClientRef = createReplayClient({ recording });
    replayClientRef.recording = recording;
    liveClient = replayClientRef;
  } else if (config.recordPath) {
    liveClient = createRecordingClient({
      client: liveClient,
      model: config.model,
      // Written after every call rather than at the end, so a run that dies
      // partway still leaves a usable recording of what it did ask.
      sink: (recording) => {
        writeFileSync(resolve(config.recordPath), `${JSON.stringify(recording, null, 2)}\n`);
      },
    });
  }

  const providerOptions = {
    model: (config.replayPath || config.replayFromRunDir)
      ? `replay(${config.replayPath || config.replayFromRunDir})`
      : `claude-sonnet-5-via-claude-code-cli(${config.model})`,
    client: liveClient,
    maxRetries: 0,
  };
  const provider = createAnthropicProvider(providerOptions);

  process.stderr.write(`${logPrefix} starting ${config.sectionRefs.length} LIVE extraction call(s)...\n`);
  const extractionStart = Date.now();
  let receipt;
  try {
    const runExtraction = config.followCitations
      ? runNativeExtractionWithCitationFollowup
      : runNativeExtraction;
    receipt = await runExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: config.sectionRefs,
      section_family_assignments: sectionFamilyAssignments,
      contract_bundle: contractBundle,
      definitions,
      provider,
    });
  } catch (err) {
    const elapsedMs = Date.now() - runStartedAt;
    process.stderr.write(`${logPrefix} EXTRACTION FAILED after ${elapsedMs}ms, ${telemetry.calls.length} call(s) completed: ${err && err.stack ? err.stack : err}\n`);
    if (outDir) {
      writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({
        run_wall_clock_ms: Date.now() - extractionStart, calls: telemetry.calls, failed: true, error: String(err && err.message ? err.message : err),
      }, null, 2));
    }
    throw err;
  }
  const extractionWallClockMs = Date.now() - extractionStart;
  process.stderr.write(`${logPrefix} extraction complete in ${extractionWallClockMs}ms, ${telemetry.calls.length} model call(s)\n`);

  // A replay that used fewer recorded calls than were captured means the run
  // stopped asking something. That is a behaviour change and a finding, not
  // a pass -- report it loudly rather than letting a green run hide it.
  let replayReport = null;
  if (replayClientRef) {
    replayReport = replayCoverage({
      recording: replayClientRef.recording,
      served: replayClientRef.served,
    });
    process.stderr.write(
      `${logPrefix} REPLAY: ${replayReport.replayed_calls}/${replayReport.recorded_calls} recorded call(s) used`
      + `${replayReport.complete ? '' : `, ${replayReport.unused_recorded_requests} recorded request(s) never asked`}\n`,
    );
    if (!replayReport.complete) {
      process.stderr.write(
        `${logPrefix} REPLAY INCOMPLETE: this run issued a different set of calls than the recording. `
        + 'Treat any comparison against the recorded run as invalid until that is explained.\n',
      );
    }
  }

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: extractionWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates -> buildNativeWriteSet (WITH resolution context) -> validate ───

  // PLAIN PASS (no M3 conditions wired yet): needed as the input BOTH M3
  // conditions are built from -- the lexical net keys its per-section
  // candidates off `plainResolution.resolved`, and the comparator's
  // `attempted_section_scope` is derived the same way. This pass is never
  // written to disk on its own; `resolution.json` below is always the fully
  // wired result.
  const plainResolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: config.agreementDate,
  });

  // Condition 2: lexical-disagreement net (Ben's M3 auto-pass condition 2,
  // docs/core/PLAN.md prerequisite). ALWAYS built -- one
  // LEXICAL_DISAGREEMENT_RECEIPT/V1 per resolved section, from THIS run's
  // own resolved candidates via candidate-resolution.js's own
  // `computeSectionCandidatesForLexicalDigest` (the exact digest formula
  // `resolveCandidates`'s wiring itself re-verifies), never an external
  // input. No model cost, no extra call.
  const lexicalDisagreement = {};
  for (const section of receipt.resolved_sections) {
    const sectionCandidates = computeSectionCandidatesForLexicalDigest(plainResolution.resolved, section.section_reference);
    const governedSection = {
      section_ref: section.section_reference,
      text: sectionBodyText(fullText, section),
      text_sha256: section.text_sha256,
    };
    lexicalDisagreement[section.section_reference] = buildLexicalDisagreementReceipt({
      governed_section: governedSection, candidates: sectionCandidates,
    });
  }
  writeFileSync(resolve(outDir, 'lexical-disagreement.json'), JSON.stringify(lexicalDisagreement, null, 2));

  // Condition 1: v1<->v2 comparator (Ben's M3 auto-pass condition 1). Only
  // built when the caller supplies --v1-snapshot; STAYS UNEVALUATED
  // otherwise (V1_V2_COMPARATOR_ABSENT on every claim), and that fact is
  // recorded on run-manifest.json below rather than silently omitted.
  let v1v2Comparison = null;
  let v1v2ComparisonSkippedReason = null;
  if (config.v1SnapshotPath) {
    const v1Snapshot = JSON.parse(readFileSync(resolve(config.v1SnapshotPath), 'utf8'));
    const attemptedSectionScope = [...new Set(plainResolution.resolved.map((entry) => {
      const citationValidation = entry.compiled_candidate && entry.compiled_candidate.citation_validation;
      if (!citationValidation) return null;
      if (citationValidation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'
        && typeof citationValidation.normalized_citation === 'string') return citationValidation.normalized_citation;
      return typeof citationValidation.derived_citation === 'string' ? citationValidation.derived_citation : null;
    }).filter(Boolean))];
    v1v2Comparison = buildV1V2ComparisonReceipt({
      v1_snapshot: v1Snapshot, v2_side: plainResolution, attempted_section_scope: attemptedSectionScope,
    });
    writeFileSync(resolve(outDir, 'v1v2-comparison.json'), JSON.stringify(v1v2Comparison, null, 2));
    process.stderr.write(`${logPrefix} v1v2_comparison: SUPPLIED from ${config.v1SnapshotPath} (${v1v2Comparison.provision_outcomes.length} v1 card outcome(s))\n`);
  } else {
    v1v2ComparisonSkippedReason = 'NO_V1_SNAPSHOT_SUPPLIED: pass --v1-snapshot <path to a committed V1_PROVISION_SNAPSHOT/V1 JSON> '
      + 'to evaluate condition 1 on this run; every claim keeps V1_V2_COMPARATOR_ABSENT until then.';
    process.stderr.write(`${logPrefix} v1v2_comparison: NOT SUPPLIED -- ${v1v2ComparisonSkippedReason}\n`);
  }

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: config.agreementDate,
    v1v2_comparison: v1v2Comparison,
    lexical_disagreement: lexicalDisagreement,
  });
  writeFileSync(resolve(outDir, 'resolution.json'), JSON.stringify(resolution, null, 2));

  const reviewQueueArtifact = buildReviewQueueArtifact({
    resolution,
    run_receipt_id: receipt.run_receipt_id,
  });
  writeFileSync(resolve(outDir, 'review-queue.json'), serialiseReviewQueueArtifact(reviewQueueArtifact));

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: fullText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution,
  });
  writeFileSync(resolve(outDir, 'adapter-result.json'), JSON.stringify(adapterResult, null, 2));

  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = {
    ...adapterResult.write_set,
    provisions: [...provisionsById.values()],
    components: adapterResult.write_set.components || [],
  };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  writeFileSync(resolve(outDir, 'validation.json'), JSON.stringify(validation, null, 2));

  const totalElapsedMs = Date.now() - runStartedAt;

  writeFileSync(resolve(outDir, 'run-manifest.json'), JSON.stringify({
    schema_version: 'GENERAL_EXTRACTION_RUN_MANIFEST/V1',
    script: scriptRelativePath(),
    deal: config.deal,
    deal_label: config.dealPin.label || null,
    section_family: config.family,
    purpose: (config.deal === DEFAULT_DEAL && config.family === DEFAULT_FAMILY)
      ? 'Scope-corrected re-run of TERMINATION_FEE family for Modiv/Global Net Lease: 7.1 + 7.3 + 8.12 pinned together (prior run pinned 7.3 only).'
      : `General extraction run: family ${config.family} on deal ${config.deal}.`,
    section_references: config.sectionRefs,
    section_family_assignments: sectionFamilyAssignments,
    contract_bundle_version: 'compileFixtureContractV38',
    prompt_id: promptInfo.prompt_id,
    prompt_version: promptInfo.prompt_version,
    agreement_date: config.agreementDate,
    model_cli_alias: config.model,
    follow_citations: config.followCitations,
    max_retries: 0,
    run_started_at: new Date(runStartedAt).toISOString(),
    total_elapsed_ms: totalElapsedMs,
    extraction_wall_clock_ms: extractionWallClockMs,
    replay: replayReport,
    recorded_to: config.recordPath || null,
    // Change-detection inputs (PLAN.md Stage 2). With these a later run can
    // decide whether a (deal, family) pair needs re-running at all, instead
    // of re-running everything and comparing samples of a nondeterministic
    // model. `model_cli_alias` above is the alias the operator typed;
    // `resolved_models` is what the CLI reported actually serving each call,
    // which is the one that matters -- a model swap behind an unchanged
    // alias would otherwise trigger no re-run at all.
    code_provenance: runProvenance(),
    resolved_models: Object.freeze([...new Set(
      telemetry.calls.map((call) => call.served_model).filter(Boolean),
    )]),
    model_call_count: telemetry.calls.length,
    run_receipt_id: receipt.run_receipt_id,
    document_hash: documentHash,
    source_sha256: verified.conversion.canonical_text_sha256,
    // Ben's two M3 auto-pass conditions (docs/core/PLAN.md prerequisite):
    // whether each condition was evaluated on THIS rung, and its outcome,
    // recorded here rather than left implicit in resolution.json alone --
    // "a rung that skipped them looks identical, in its evidence directory,
    // to a rung that ran them" is exactly the failure this field exists to
    // rule out.
    m3_auto_pass_conditions: {
      v1v2_comparison: v1v2Comparison ? {
        supplied: true,
        source: config.v1SnapshotPath,
        v1v2_comparison_receipt_id: v1v2Comparison.v1v2_comparison_receipt_id,
        counts: v1v2Comparison.counts,
      } : { supplied: false, reason: v1v2ComparisonSkippedReason },
      lexical_disagreement: {
        supplied: true,
        sections_covered: Object.keys(lexicalDisagreement).length,
        resolution_receipt_counts: resolution.resolution_receipt.lexical_disagreement_counts || null,
      },
      claims_both_nets_clean: resolution.resolved.filter((entry) => entry.triage.both_nets_clean).length,
    },
  }, null, 2));

  process.stderr.write(`${logPrefix} === SUMMARY ===\n`);
  process.stderr.write(`total_elapsed_ms: ${totalElapsedMs}, model_call_count: ${telemetry.calls.length}\n`);
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`undispatched_sections: ${receipt.undispatched_section_count}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
  process.stderr.write(`m3_auto_pass_conditions: v1v2_comparison=${v1v2Comparison ? 'EVALUATED' : 'NOT_EVALUATED'} lexical_disagreement=EVALUATED (${Object.keys(lexicalDisagreement).length} section(s)) both_nets_clean=${resolution.resolved.filter((e) => e.triage.both_nets_clean).length}\n`);
  process.stderr.write(`conditional_termination_fee_values: ${(resolution.conditional_termination_fee_values || []).length}\n`);
  process.stderr.write(`write_set claims: ${adapterResult.write_set.claims.length}, components: ${(adapterResult.write_set.components || []).length}, adapter residuals: ${adapterResult.residuals.length}\n`);
  process.stderr.write(`validation accepted: ${validation.accepted}, residuals: ${validation.residuals.length}, quarantines: ${validation.quarantines.length}\n`);
  process.stderr.write(`review_queue artifact: ${reviewQueueArtifact.review_queue.length} item(s)\n`);
  process.stderr.write(`publishable claims: ${validation.publishableWriteSet ? validation.publishableWriteSet.claims.length : 'n/a'}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    process.stderr.write(`[extraction-run] FAILED: ${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 1;
  });
}

export {
  DEAL_PINS,
  DEFAULT_DEAL,
  DEFAULT_FAMILY,
  scriptRelativePath,
  parseArgs,
  resolveRunConfig,
  resolvePromptVersionInfo,
  loadAndVerifySource,
  buildAdmittedContext,
  sectionizeAndResolve,
  buildDryRunReport,
  main,
};
