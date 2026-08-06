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
 *     [--dry-run]
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
  readFileSync, writeFileSync, mkdirSync, existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
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
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
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
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
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
function scriptRelativePath() {
  const absolutePath = fileURLToPath(import.meta.url);
  return absolutePath.includes(process.cwd()) ? absolutePath.slice(process.cwd().length + 1) : absolutePath;
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
const DEAL_PINS = Object.freeze({
  modiv: Object.freeze({
    label: 'Modiv, Inc. / Global Net Lease, Inc.',
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm',
    raw_html_path: 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm',
    raw_bytes_sha256: '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968',
    canonical_text_sha256: '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e',
    agreement_date: '2026-05-03',
    pin_corroboration: 'tests/fixtures/canonical-v2/modiv-first-live-run/intake-pin.json, and the prior '
      + 'TERMINATION_FEE run receipt at evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/'
      + 'execution-result.json (work_item_id modiv-termination-fee-7-3, run_receipt.source_sha256 / .document_hash)',
    default_section_refs_by_family: Object.freeze({
      TERMINATION_FEE: Object.freeze(['7.1', '7.3', '8.12']),
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
    dryRun: false,
    outDir: null,
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
      case '--dry-run': out.dryRun = true; break;
      default: throw new Error(`unrecognised argument: ${arg}`);
    }
  }
  if (!out.dryRun && !out.outDir) throw new Error('--out-dir is required (unless --dry-run)');
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

  const retrievalPolicyDigest = sha256Hex(
    `General extraction runner: reuse of the already-admitted, already-committed raw HTML for deal "${deal}"; no new network fetch performed.`,
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: dealPin.retrieval_url,
    final_url: dealPin.retrieval_url,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: new Date().toISOString(),
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
    rawHtmlPath: absoluteRawHtmlPath, rawBytes, rawBytesSha256, capture, conversion, verification,
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
        const sectionReference = orderedSectionRefs[callIndex] || `unknown-call-${callIndex}`;
        const prompt = flattenMessages(params);
        const startedAt = Date.now();
        const rawCliOutput = await runClaudeCli(prompt, { model });
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

  if (outDir) {
    writeFileSync(resolve(outDir, 'source-reference.json'), JSON.stringify({
      schema_version: 'GENERAL_EXTRACTION_RUN_SOURCE_REFERENCE/V1',
      deal: config.deal,
      reused_committed_raw_html: verified.rawHtmlPath.includes(process.cwd()) ? verified.rawHtmlPath.slice(process.cwd().length + 1) : verified.rawHtmlPath,
      retrieval_url: config.dealPin.retrieval_url,
      raw_bytes_length: verified.rawBytes.length,
      raw_bytes_sha256: verified.rawBytesSha256,
      canonical_text_byte_length: verified.conversion.canonical_text_byte_length,
      canonical_text_sha256: verified.conversion.canonical_text_sha256,
      verification_status: verified.verification.verification_status,
      document_hash: documentHash,
      pin_corroboration: config.dealPin.pin_corroboration || null,
      note: 'REUSE, not a pinning fetch. No network call was made by this script.',
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

  const contractBundle = compileFixtureContractV34();
  const definitions = { known_definitions: [] };
  const telemetry = { calls: [] };

  const sectionFamilyAssignments = config.sectionRefs.map((section_reference) => ({
    section_reference,
    family_id: config.family,
  }));

  const providerOptions = {
    model: `claude-sonnet-5-via-claude-code-cli(${config.model})`,
    client: makeMeasuredCliClient({
      model: config.model, telemetry, orderedSectionRefs: config.sectionRefs, fixtureOutDir: outDir, config, promptInfo,
    }),
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

  writeFileSync(resolve(outDir, 'run-receipt.json'), JSON.stringify(receipt, null, 2));
  writeFileSync(resolve(outDir, 'call-telemetry.json'), JSON.stringify({ run_wall_clock_ms: extractionWallClockMs, calls: telemetry.calls }, null, 2));

  // ─── Step 4: resolveCandidates -> buildNativeWriteSet (WITH resolution context) -> validate ───

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
    agreement_date: config.agreementDate,
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
    contract_bundle_version: 'compileFixtureContractV34',
    prompt_id: promptInfo.prompt_id,
    prompt_version: promptInfo.prompt_version,
    agreement_date: config.agreementDate,
    model_cli_alias: config.model,
    follow_citations: config.followCitations,
    max_retries: 0,
    run_started_at: new Date(runStartedAt).toISOString(),
    total_elapsed_ms: totalElapsedMs,
    extraction_wall_clock_ms: extractionWallClockMs,
    model_call_count: telemetry.calls.length,
    run_receipt_id: receipt.run_receipt_id,
    document_hash: documentHash,
    source_sha256: verified.conversion.canonical_text_sha256,
  }, null, 2));

  process.stderr.write(`${logPrefix} === SUMMARY ===\n`);
  process.stderr.write(`total_elapsed_ms: ${totalElapsedMs}, model_call_count: ${telemetry.calls.length}\n`);
  process.stderr.write(`compiled_candidates: ${receipt.compiled_candidate_count} ok / ${receipt.rejected_candidate_count} rejected\n`);
  process.stderr.write(`evidence_residuals (producer): ${receipt.evidence_residual_count}\n`);
  process.stderr.write(`scope_violations: ${receipt.scope_violation_count}\n`);
  process.stderr.write(`citation_residuals: ${receipt.citation_residual_count} -- ${JSON.stringify((receipt.citation_residuals || []).map((r) => r.reason))}\n`);
  process.stderr.write(`undispatched_sections: ${receipt.undispatched_section_count}\n`);
  process.stderr.write(`resolution: resolved=${resolution.resolved.length} auto_pass=${resolution.resolved.filter((e) => e.triage.auto_pass).length} review_queue=${resolution.review_queue.length} open_world=${resolution.open_world.length} residuals=${resolution.residuals.length}\n`);
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
