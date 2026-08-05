/**
 * lib/canonical-v2/native-producer/lexical-disagreement-net.js
 *
 * The lexical-disagreement net -- auto-pass condition 2 of Ben's M3 protocol
 * (docs/superpowers/specs/2026-08-02-lexical-disagreement-net-design.md).
 * PURE, DETERMINISTIC, NO MODEL CALLS, NO NETWORK, NO DB -- exactly this
 * module's inputs decide every outcome:
 *
 *  - `governed_section`: `{ section_ref, text, text_sha256 }`. This module
 *    recomputes and verifies `text_sha256` itself; a mismatch is a typed,
 *    thrown `SECTION_HASH_MISMATCH` -- fail-closed, never a silent
 *    "treat the given text as authoritative" fallback.
 *  - `candidates`: the run's compiled candidates FOR THIS SECTION -- each
 *    `{ closure_id, section_reference, family, evidence: [{start, end}] }`
 *    with SECTION-LOCAL UTF-8 byte offsets (candidate-resolution.js's own
 *    convention -- see that file's header on why evidence offsets stay
 *    section-local until native-write-set-adapter.js shifts them). Two
 *    rejections, both typed and thrown -- fail-closed, never
 *    skip-and-continue:
 *      - `CANDIDATE_SECTION_MISMATCH`: any candidate whose
 *        `section_reference` differs from `governed_section.section_ref`
 *        (checked by reference equality, never by whether its offsets
 *        happen to fit the frame -- offsets from another section can land
 *        inside this section's byte range and launder an unmatched hit
 *        into a match).
 *      - `EVIDENCE_OUT_OF_FRAME`: any span violating
 *        `0 <= start < end <= utf8ByteLength(text)`.
 *  - `lexicon`: the frozen, versioned `LEXICAL_FAMILY_LEXICON/V1` table
 *    (section 2 below); defaults to this module's own frozen constant.
 *
 * Output: `LEXICAL_DISAGREEMENT_RECEIPT/V1` (section 4 below).
 *
 * EXTRACTION SEMANTICS RULE 2 ("lexical disagreement vetoes negatives,
 * never creates positives"): this module never constructs a claim or a
 * PRESENT value -- an unmatched lexical hit is reported as a typed
 * disagreement signal for a HUMAN or the wiring layer to act on, never
 * promoted into extracted data of its own. See `absentConclusionPermitted`
 * (section 6) for the pure helper the future ABSENT-deriver will consume.
 *
 * THE NET MATCHES ONLY REGISTERED CODES. It is structurally blind to
 * novelty (a phrase describing a genuinely new proposition, not on the
 * lexicon at all) -- the open-world path is the recall mechanism for that
 * shape of miss. This net is a disagreement detector over the KNOWN
 * taxonomy, never a recall guarantee (ledger note, accepted).
 */

'use strict';

const crypto = require('node:crypto');
const { contentId, utf8ByteLength, utf8Slice } = require('../canonical-bytes');
const { normaliseForMatching, ZERO_WIDTH_PATTERN } = require('../zero-width-normalise');

const LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA = 'LEXICAL_DISAGREEMENT_RECEIPT/V1';
const LEXICAL_FAMILY_LEXICON_SCHEMA = 'LEXICAL_FAMILY_LEXICON/V1';
const LEXICAL_DISAGREEMENT_CANDIDATE_DIGEST_DOMAIN = 'LEXICAL_DISAGREEMENT_CANDIDATE_DIGEST/V1';

const PER_FAMILY_OUTCOMES = Object.freeze([
  'LEXICAL_ALL_SIGNALS_MATCHED',
  'LEXICAL_UNMATCHED_SIGNALS',
  'LEXICON_FAMILY_UNCOVERED',
]);

// Spec-pinned typed code (section 3, offset mapping): stamped onto a
// disagreement-set entry whose round-trip predicate failed.
const HIT_OFFSET_IRREPRODUCIBLE = 'HIT_OFFSET_IRREPRODUCIBLE';

// A single, non-global copy of the zero-width/bidi character class this
// module needs to test ONE character at a time while walking a string --
// `ZERO_WIDTH_PATTERN` itself carries the 'g' flag (stateful `lastIndex`,
// unsafe to `.test()` repeatedly), so a fresh non-global RegExp built from
// its own `.source` is the safe re-use here. Never re-declares the
// character class -- that would be exactly the kind of silent drift the
// spec's "WITHOUT modifying that module" instruction guards against.
const ZERO_WIDTH_CHAR = new RegExp(ZERO_WIDTH_PATTERN.source);

class LexicalDisagreementNetError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LexicalDisagreementNetError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new LexicalDisagreementNetError(code, message, details);
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`);
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  return value;
}

// ═══════════════════════════════════════════════════════════════════════
// 2. LEXICAL_FAMILY_LEXICON/V1 -- frozen, versioned, content-hashed into
// every receipt. Keys are the pipeline's REAL family codes (registered
// `concept_key` values candidate-resolution.js stamps as `family`, e.g.
// `REP-T-CAP`), NEVER invented names -- `validateLexicalFamilyLexicon`
// below enforces this against a caller-supplied set of registered concept
// keys wherever a caller wants that check (the table-validation test does).
//
// PATTERN KINDS:
//  - LITERAL_PHRASE: case-insensitive, zero-width/bidi-tolerant match
//    (via `normaliseForMatching`). Word-boundary rule (audit M2): a hit is
//    valid only when both edges abut a character outside [A-Za-z0-9] in
//    the normalised text (or the text boundary) -- no naked-substring
//    hits ("options" must not fire inside "optionally").
//  - LITERAL_ACRONYM: CASE-SENSITIVE, same boundary rule. For
//    RSU/PSU/SAR/ESPP/DSU-class tokens -- case-insensitive matching would
//    fire "RSU" inside "puRSUant" and "SAR" inside "necesSARy" /
//    "Sarbanes-Oxley", flooding every section with noise. Predictable
//    noise is itself a widener at one remove: it pressures the review
//    process into lexicon deletions, and deletions widen auto-pass.
//  - BOUNDED_REGEX: syntactically restricted -- literals, character
//    classes, alternation, bounded {m,n} only; NO unbounded quantifiers
//    (*, +, unbounded {m,}). `validateBoundedRegexMaxLength` computes a
//    static maximum match length and rejects anything over 128 normalised
//    characters. Matching runs ONCE over the whole normalised text,
//    standard leftmost scan -- no windowing. (No BOUNDED_REGEX pattern is
//    registered in this V1 table -- see the "option" family note below --
//    but the kind and its validator are real machinery for future
//    families, exercised directly by the table-validation tests.)
//
// Multi-form entries expand to SEPARATE pattern_ids (audit m2): every
// phrase below is its own entry, never a slash-joined alternate.
//
// DELETION ASYMMETRY. Removing a pattern narrows the veto and widens
// auto-pass; every removal requires a Fable-reviewed rationale recorded in
// the entry's own history (the PR diff, not this file). Additions only
// narrow auto-pass and are cheap -- add freely as coverage grows family by
// family.
// ═══════════════════════════════════════════════════════════════════════

// V2 (family-termination-fee slice, docs/superpowers/specs/2026-08-02-
// family-termination-fee-design.md section 5): adds the TERMF-TARGET,
// TERMF-REVERSE and TERMF-TAIL family entries -- uncovered families block
// auto-pass (program invariant), so the lexicon grows in the same slice as
// any new concept family's promotion. All patterns are grounded in the
// committed fixture quotes (tests/fixtures/canonical-v2/termination-fee/
// quotes.json); word-boundary rule applies throughout (inherited from the
// V1 REP-T-CAP entries above -- see "PATTERN KINDS" at the top of this
// section).
//
// V3 (family-no-shop slice, docs/superpowers/specs/2026-08-02-family-no-
// shop-design.md section 5, AUDIT-AMENDED): adds the five NOSOL- family
// entries (NOSOL-PROHIBIT, NOSOL-EXCEPT, NOSOL-NOTICE, NOSOL-MATCH,
// NOSOL-REMATCH) -- same program invariant. Corpus groundings below are
// verbatim production-quote fragments EXCEPT the two entries explicitly
// labelled ungrounded (audit M-5): "fiduciary out" and "right to match" /
// "matching rights" are retained as priced dead weight (0 corpus hits,
// never a corpus grounding).
//
// V4 (family-mae-definition slice, docs/superpowers/specs/2026-08-02-
// family-mae-definition-design.md section 5, AUDIT-AMENDED): adds the
// DEF-MAE family entries -- same program invariant (DEF-MAE registers as a
// concept key in candidate-resolution.js's own V7 table in the SAME
// slice, so the table-validation test's registered-key assertion passes).
// KNOWN, DELIBERATE, PRICED BLIND SPOT (spec section 5, stated up front):
// the "Material Adverse Effect" LITERAL_PHRASE entry saturates every
// MAE-QUALIFIED rep/bring-down/closing-condition section corpus-wide --
// accepted deliberately under the Ben-ratified same-family-within-section
// reading (an unmatched hit there vetoes only DEF-MAE conclusions in that
// section, never REP-T-CAP or any other family's claims). Priced
// exclusions (deletion-asymmetry): naked "material"/"adverse"/"effect"/
// "change"/"in the aggregate"/"taken as a whole"/"individually or in the
// aggregate" and naked "GAAP" are NOT lexicon entries (floods every
// article; would pressure deletions, which widen auto-pass). "Material
// Adverse Change"/"MAC" and "COVID-19" are likewise NOT lexicon entries
// (0/51 corpus cards use "MAC"; "COVID-19" fires far outside MAE
// definitions) -- both recorded blind spots, not oversights.
// V5 (family-termination-rights slice, docs/superpowers/specs/2026-08-02-
// family-termination-rights-design.md section 5, AUDIT-AMENDED): adds the
// TERMR- family entries -- same program invariant (uncovered families
// block auto-pass, so the lexicon grows in the same slice as any new
// concept family's promotion). Every pattern is grounded in the spec's own
// quoted corpus text (section "Corpus grounding"). TERMR-NOSOL-BREACH is
// DELIBERATELY UNCOVERED this slice (spec section 5: "no v1 subtype exists
// for it, so there is zero corpus quote text to ground a pattern in") --
// it stays LEXICON_FAMILY_UNCOVERED until real corpus text is observed.
// Boundary pin (spec, audit m-2): every case-sensitive defined-term
// pattern below is authored with explicit `\b` anchors.
// V6 adds the three grounded Consideration families. Case-sensitive
// defined terms use the existing LITERAL_ACRONYM mechanism because the
// BOUNDED_REGEX scanner is intentionally case-insensitive.
const LEXICAL_FAMILY_LEXICON_VERSION = 15;

function phraseEntry(idSuffix, family, value, rationale) {
  return Object.freeze({
    pattern_id: `${family}:PHRASE:${idSuffix}`, family, kind: 'LITERAL_PHRASE', value, rationale,
  });
}

function acronymEntry(idSuffix, family, value, rationale) {
  return Object.freeze({
    pattern_id: `${family}:ACRONYM:${idSuffix}`, family, kind: 'LITERAL_ACRONYM', value, rationale,
  });
}

function regexEntry(idSuffix, family, value, rationale) {
  return Object.freeze({
    pattern_id: `${family}:REGEX:${idSuffix}`, family, kind: 'BOUNDED_REGEX', value, rationale,
  });
}

const REP_T_CAP_PHRASES = Object.freeze([
  ['AUTHORIZED_CAPITAL_STOCK', 'authorized capital stock', 'The chapeau tell for a capitalisation representation’s own subject matter.'],
  ['CAPITAL_STOCK', 'capital stock', 'The base noun phrase every capitalisation clause is built from.'],
  ['ISSUED_AND_OUTSTANDING', 'issued and outstanding', 'Standard formula introducing the share-count disclosure.'],
  ['RESERVED_FOR_ISSUANCE', 'reserved for issuance', 'Standard formula for equity plan reservation pools.'],
  ['TREASURY_SHARES', 'treasury shares', 'One of two treasury-holding forms; kept as its own pattern per the no-slash rule.'],
  ['TREASURY_STOCK', 'treasury stock', 'The other treasury-holding form; kept separate from "treasury shares", never slash-joined.'],
  ['PREFERRED_STOCK', 'preferred stock', 'The second class of stock a capitalisation rep almost always enumerates.'],
  ['PAR_VALUE', 'par value', 'Standard per-share valuation tell accompanying a share-class description.'],
  ['EQUITY_INTEREST', 'equity interest', 'Singular form of the non-stock-entity ownership tell; kept separate from the plural.'],
  ['EQUITY_INTERESTS', 'equity interests', 'Plural form -- covers LLC/partnership-style capitalisation language.'],
  ['EQUITY_AWARD', 'equity award', 'Umbrella term for equity compensation grants (RSU/PSU/option/etc.).'],
  ['RESTRICTED_STOCK', 'restricted stock', 'Named award type distinct from the RSU/PSU acronym forms.'],
  ['STOCK_APPRECIATION_RIGHT', 'stock appreciation right', 'Named award type; the SAR acronym is covered separately, case-sensitively.'],
  ['EMPLOYEE_STOCK_PURCHASE', 'employee stock purchase', 'ESPP plan tell in its spelled-out form.'],
  ['DEFERRED_STOCK_UNIT', 'deferred stock unit', 'DSU award tell in its spelled-out form.'],
  ['PROFITS_INTEREST', 'profits interest', 'Partnership/LLC equity-compensation tell.'],
  ['INCENTIVE_PLAN', 'incentive plan', 'The generic equity/incentive plan tell (e.g. "2015 Long Term Stock Incentive Plan").'],
  ['PHANTOM', 'phantom', 'Phantom-equity award tell.'],
  ['CONVERTIBLE', 'convertible', 'Convertible-security tell (notes, preferred stock, etc. convertible into equity).'],
  ['VOTING_DEBT', 'voting debt', 'Standard "no voting debt" no-shop-adjacent capitalisation tell.'],
  ['VOTING_SECURITIES', 'voting securities', 'Standard voting-rights capitalisation tell.'],
  ['WARRANTS_TO_PURCHASE', 'warrants to purchase', 'A purchase-instrument warrant phrase deliberately narrower than the bare word "warrant" (see the ruled-out note below).'],
  ['WARRANT_AGREEMENT', 'warrant agreement', 'A purchase-instrument warrant phrase, same rationale as "warrants to purchase".'],
  ['WARRANTS_EXERCISABLE', 'warrants exercisable', 'A purchase-instrument warrant phrase, same rationale as "warrants to purchase".'],
  // "option" family (spec RULING): the naked noun "option(s)" is excluded
  // -- `/\boptions?\b/i` fires on "option to terminate" and similar
  // non-capitalisation uses, flooding every section with noise. These
  // three phrases are the narrower, precise substitutes; the residual
  // blind spot (a rep whose only tell is the bare word "options") is
  // priced and recorded -- the v1 comparator and open-world path cover it.
  ['STOCK_OPTION', 'stock option', 'Narrow, precise substitute for the excluded bare noun "option(s)".'],
  ['COMPANY_OPTION', 'Company Option', 'Narrow, precise substitute for the excluded bare noun "option(s)" (defined-term form).'],
  ['OPTION_PLAN', 'option plan', 'Narrow, precise substitute for the excluded bare noun "option(s)".'],
].map(([id, value, rationale]) => phraseEntry(id, 'REP-T-CAP', value, rationale)));

const REP_T_CAP_ACRONYMS = Object.freeze([
  ['RSU', 'RSU', 'Restricted Stock Unit acronym; case-sensitive to avoid firing inside "puRSUant".'],
  ['RSUS', 'RSUs', 'Plural RSU acronym form.'],
  ['PSU', 'PSU', 'Performance Stock Unit acronym; case-sensitive to avoid incidental substring hits.'],
  ['PSUS', 'PSUs', 'Plural PSU acronym form.'],
  ['SAR', 'SAR', 'Stock Appreciation Right acronym; case-sensitive to avoid firing inside "necesSARy" / "Sarbanes-Oxley".'],
  ['SARS', 'SARs', 'Plural SAR acronym form.'],
  ['ESPP', 'ESPP', 'Employee Stock Purchase Plan acronym.'],
  ['DSU', 'DSU', 'Deferred Stock Unit acronym.'],
  ['DSUS', 'DSUs', 'Plural DSU acronym form.'],
].map(([id, value, rationale]) => acronymEntry(id, 'REP-T-CAP', value, rationale)));

// V10 adds the Material Contracts family. The tells are grounded in the
// committed QXO/TopBuild and Landos/AbbVie agreement fixtures.
const REP_T_CONTRACTS_PHRASES = Object.freeze([
  ['MATERIAL_CONTRACTS', 'Material Contracts', 'The defined-term tell in the committed QXO/TopBuild Material Contracts representation.'],
  ['COMPANY_MATERIAL_CONTRACTS', 'Company Material Contracts', 'The target-specific defined-term form in the committed QXO/TopBuild Material Contracts representation.'],
  ['ANY_COMPANY_CONTRACT', 'any Company Contract', 'The repeated criterion tell in the committed Landos/AbbVie Material Contracts representation.'],
].map(([id, value, rationale]) => phraseEntry(id, 'REP-T-CONTRACTS', value, rationale)));
const NO_OTHER_REPS_FRAUD_PHRASES = Object.freeze([
  ['NOOTHERREPS', 'REP-T-NOOTHERREPS', 'No Other Representations'], ['NOOTHERREPS', 'REP-B-NOOTHERREPS', 'No Other Representations'], ['NONRELIANCE', 'REP-T-NONRELIANCE', 'not relying on'], ['NONRELIANCE', 'REP-B-NONRELIANCE', 'not relying on'], ['INDEPINVEST', 'REP-T-INDEPINVEST', 'independent investigation'], ['INDEPINVEST', 'REP-B-INDEPINVEST', 'independent investigation'], ['FRAUDCARVEOUT', 'REP-T-FRAUDCARVEOUT', 'liability for any fraud'], ['FRAUDCARVEOUT', 'REP-B-FRAUDCARVEOUT', 'liability for any fraud'], ['WILLFUL', 'DEF-WILLFUL', 'Willful and Intentional Breach'],
].map(([id, family, value]) => phraseEntry(id, family, value, 'No-other-representations and fraud source phrase.')));
const GENERAL_COVENANT_PHRASES = Object.freeze([
  ['16B', 'COV-16B', 'Rule 16b-3'], ['ACCESS', 'COV-ACCESS', 'Access to Information'], ['CONSENT', 'COV-CONSENT', 'Client Consents'], ['CVR', 'COV-CVR', 'CVR Agreement'], ['DEBT', 'COV-DEBT', 'Existing Indebtedness'], ['DELIST', 'COV-DELIST', 'Delisting'], ['FDA', 'COV-FDACOMMS', 'correspondence received after the date hereof from the FDA'], ['FURTHER', 'COV-FURTHER', 'Further Assurances'], ['INDEMN', 'COV-INDEMN', 'Indemnification'], ['LIST', 'COV-LIST', 'Stock Exchange Listing'], ['LITIGATION', 'COV-LITNOTIFY', 'Transaction Litigation'], ['MERGESUB', 'COV-MERGESUB', 'Merger Sub'], ['NOTIFY', 'COV-NOTIFY', 'Notification of Certain Matters'], ['PAYAGENT', 'COV-PAYAGENT', 'Paying Agent'], ['PUBLICITY', 'COV-PUBLICITY', 'Public Announcements'], ['RESIGN', 'COV-RESIGN', 'Director Resignations'], ['SEC', 'COV-SECREPORT', 'Post-Closing SEC Reports'], ['TAKEOVER', 'COV-TAKEOVER', 'Takeover Laws'],
].map(([id, family, value]) => phraseEntry(id, family, value, 'Grounded General Covenants source phrase.')));

// TERMF-TARGET (spec section 5): the base "termination fee" phrase (fires
// on "Termination Fee" / "Company Termination Fee" alike -- veto-only, so
// double-side coverage with TERMF-REVERSE's own copy below is a feature,
// not redundancy); "liquidated damages" (Bridge: "not a penalty, but
// rather is liquidated damages"); "fee in the amount of" (Bioverativ).
const TERMF_TARGET_PHRASES = Object.freeze([
  ['TERMINATION_FEE', 'termination fee', 'The base defined-term tell for a termination-fee clause; fires on "Termination Fee" and "Company Termination Fee" alike.'],
  ['LIQUIDATED_DAMAGES', 'liquidated damages', 'Bridge: "not a penalty, but rather is liquidated damages" -- the fee’s own legal characterisation.'],
  ['FEE_IN_THE_AMOUNT_OF', 'fee in the amount of', 'Bioverativ’s own fee-amount-clause tell.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMF-TARGET', value, rationale)));

// TERMF-REVERSE (spec section 5): "parent termination fee" / "parent
// termination payment" (Forest City -- the term is "Payment", not "Fee"; a
// fee-only pattern would blind the net to that deal's reverse fee);
// "reverse termination fee" (explicitly UNGROUNDED market vocabulary --
// audit m-1: matches zero primary_quote bytes corpus-wide, retained
// deliberately because the net scans agreement text, not card prose, and
// market drafting uses the phrase; veto-only, so a pattern that never fires
// costs nothing); and "termination fee" AGAIN under this family --
// deliberately duplicated so a section carrying only a company fee leaves
// the TERMF-REVERSE copy unmatched, vetoing a careless ABSENT on the
// reverse fee (and vice versa for TERMF-TARGET's own copy above).
const TERMF_REVERSE_PHRASES = Object.freeze([
  ['PARENT_TERMINATION_FEE', 'parent termination fee', 'The base defined-term tell for a reverse (Parent-paid) termination fee.'],
  ['PARENT_TERMINATION_PAYMENT', 'parent termination payment', 'Forest City’s own term is "Payment", not "Fee" -- a fee-only pattern would blind the net to that deal’s reverse fee.'],
  ['REVERSE_TERMINATION_FEE', 'reverse termination fee', 'Market vocabulary (audit m-1: ungrounded in any committed primary_quote, retained because the net scans agreement text and market drafting uses the phrase; veto-only, costs nothing when it never fires).'],
  ['TERMINATION_FEE', 'termination fee', 'Deliberately duplicated from TERMF-TARGET (spec section 5): in a section carrying only a company fee, this copy is unmatched and vetoes a careless ABSENT on the reverse fee, and vice versa.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMF-REVERSE', value, rationale)));

// TERMF-TAIL (spec section 5): the tail-period tells actually grounded in
// the committed fixture quotes.
const TERMF_TAIL_PHRASES = Object.freeze([
  ['ANNIVERSARY_OF_SUCH_TERMINATION', 'anniversary of such termination', 'Cooper Tire’s own tail-trigger tell.'],
  ['ENTERS_INTO_A_DEFINITIVE_AGREEMENT', 'enters into a definitive agreement', 'Cooper Tire’s own tail-trigger tell.'],
  ['PUBLICLY_WITHDRAWN', 'publicly withdrawn', 'Concho’s own tail-trigger tell.'],
  ['BECOMES_PUBLICLY_KNOWN', 'becomes publicly known', 'Bridge/Cooper’s own tail-trigger tell.'],
  ['ACQUISITION_PROPOSAL', 'acquisition proposal', 'Anadarko/Bridge/Carrols’ own tail-trigger tell -- noisy in NOSOL-governed sections (priced known cost, spec section 5), but an unmatched hit there costs a queue item, never a wrong claim.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMF-TAIL', value, rationale)));

// NOSOL-PROHIBIT (spec section 5): the solicit stem (grounding: "(1)
// solicit", "not solicited in violation"); the three Acquisition/Takeover/
// Company-Acquisition Proposal phrases (separate pattern_ids, no slash-
// joining, per the multi-form-entry convention above); "knowingly
// encourage", "knowingly facilitate"; "no-shop" (grounding: "the No-Shop
// Period Start Date").
const NOSOL_PROHIBIT_REGEXES = Object.freeze([
  regexEntry('SOLICIT_STEM', 'NOSOL-PROHIBIT', String.raw`\bsolicit(s|ed|ing|ation|ations)?`, 'The solicit stem, grounded verbatim: "(1) solicit", "not solicited in violation".'),
].map((e) => e));
const NOSOL_PROHIBIT_PHRASES = Object.freeze([
  ['ACQUISITION_PROPOSAL', 'Acquisition Proposal', 'The base defined-term tell for the prohibited-action population.'],
  ['TAKEOVER_PROPOSAL', 'Takeover Proposal', 'Alternate defined-term form for the same population, kept as its own pattern per the no-slash rule.'],
  ['COMPANY_ACQUISITION_PROPOSAL', 'Company Acquisition Proposal', 'Alternate defined-term form, kept separate from the two above.'],
  ['KNOWINGLY_ENCOURAGE', 'knowingly encourage', 'Grounded verbatim in production NOSOL-PROHIBIT cards.'],
  ['KNOWINGLY_FACILITATE', 'knowingly facilitate', 'Grounded verbatim in production NOSOL-PROHIBIT cards.'],
  ['NO_SHOP', 'no-shop', 'Grounding: "the No-Shop Period Start Date".'],
].map(([id, value, rationale]) => phraseEntry(id, 'NOSOL-PROHIBIT', value, rationale)));

// NOSOL-EXCEPT (spec section 5, audit M-5/C-2 amended): "Superior
// Proposal" and "fiduciary duties" (both grounded; the production fragment
// "(b) Fiduciary Exception to No Solicitation Provision" grounds their
// co-occurrence, per audit M-5's reattribution); "fiduciary out" --
// ungrounded market-standard tell, 0 corpus hits, retained as priced dead
// weight; "unsolicited" -- audit C-2's correction of the earlier
// self-contradictory draft: "unsolicited" IS itself a NOSOL-EXCEPT phrase
// (grounded in "bona fide unsolicited written proposal" fiduciary-exception
// drafting) and fires on the anti-noise regression's own second sentence
// (a known, pinned queue cost -- see the anti-noise test below). "bona
// fide" and "good faith" are deliberately EXCLUDED (priced: both appear in
// efforts covenants, MAE definitions, and virtually every board-
// determination clause corpus-wide -- the noise would pressure deletions,
// and deletions widen auto-pass).
const NOSOL_EXCEPT_PHRASES = Object.freeze([
  ['SUPERIOR_PROPOSAL', 'Superior Proposal', 'Grounded co-occurrence with "fiduciary duties" in production NOSOL-EXCEPT cards (audit M-5 reattribution).'],
  ['FIDUCIARY_DUTIES', 'fiduciary duties', 'Grounded co-occurrence with "Superior Proposal" -- "(b) Fiduciary Exception to No Solicitation Provision" (audit M-5 reattribution).'],
  ['FIDUCIARY_OUT', 'fiduciary out', 'Ungrounded market-standard tell: 0 corpus hits in primary_quote AND region_full_text across all provision_cards, retained as priced dead weight (audit M-5).'],
  ['UNSOLICITED', 'unsolicited', 'Grounded in "bona fide unsolicited written proposal" fiduciary-exception drafting; a known, pinned queue cost in the anti-noise regression (audit C-2).'],
].map(([id, value, rationale]) => phraseEntry(id, 'NOSOL-EXCEPT', value, rationale)));

// NOSOL-NOTICE (spec section 5): the notify stem (grounding, verbatim
// production NOSOL-NOTICE card: "within 24 hours following the receipt
// thereof) notify Parent"); "written notice" (priced: also fires in
// match-window and administrative-notices text -- veto-only cost is a
// queue item, never a wrong claim).
const NOSOL_NOTICE_REGEXES = Object.freeze([
  regexEntry('NOTIFY_STEM', 'NOSOL-NOTICE', String.raw`\bnotif(y|ies|ied|ication)?`, 'Grounding, verbatim production NOSOL-NOTICE card: "within 24 hours following the receipt thereof) notify Parent".'),
]);
const NOSOL_NOTICE_PHRASES = Object.freeze([
  ['WRITTEN_NOTICE', 'written notice', 'Priced: also fires in match-window and administrative-notices text -- veto-only cost is a queue item, never a wrong claim.'],
].map(([id, value, rationale]) => phraseEntry(id, 'NOSOL-NOTICE', value, rationale)));

// NOSOL-MATCH (spec section 5): "right to match" / "matching rights" --
// ungrounded market-standard tells, 0 corpus hits, retained as priced dead
// weight (audit M-5); "Notice Period" (grounding: "(the 'Notice Period')");
// "last look" (grounding: "(d) 'Last Look'."); "days in advance" (grounding:
// "four (4) business days in advance", "five Business Days in advance").
const NOSOL_MATCH_PHRASES = Object.freeze([
  ['RIGHT_TO_MATCH', 'right to match', 'Ungrounded market-standard tell: 0 corpus hits, retained as priced dead weight (audit M-5).'],
  ['MATCHING_RIGHTS', 'matching rights', 'Ungrounded market-standard tell: 0 corpus hits, retained as priced dead weight (audit M-5).'],
  ['NOTICE_PERIOD', 'Notice Period', 'Grounding: "(the \'Notice Period\')".'],
  ['LAST_LOOK', 'last look', 'Grounding: "(d) \'Last Look\'.".'],
  ['DAYS_IN_ADVANCE', 'days in advance', 'Grounding: "four (4) business days in advance", "five Business Days in advance".'],
].map(([id, value, rationale]) => phraseEntry(id, 'NOSOL-MATCH', value, rationale)));

// NOSOL-REMATCH (spec section 5): all four verbatim in production REMATCH
// cards -- "in the event of any material amendment or material
// modification … shall be required to deliver a new written notice".
const NOSOL_REMATCH_PHRASES = Object.freeze([
  ['MATERIAL_AMENDMENT', 'material amendment', 'Grounded verbatim in production NOSOL-REMATCH cards.'],
  ['MATERIAL_MODIFICATION', 'material modification', 'Grounded verbatim in production NOSOL-REMATCH cards.'],
  ['MATERIAL_REVISIONS', 'material revisions', 'Grounded verbatim in production NOSOL-REMATCH cards.'],
  ['NEW_WRITTEN_NOTICE', 'new written notice', 'Grounded verbatim: "…shall be required to deliver a new written notice".'],
].map(([id, value, rationale]) => phraseEntry(id, 'NOSOL-REMATCH', value, rationale)));

// DEF-MAE (spec section 5): every grounding below is a verbatim production-
// quote fragment cited in the spec's own section 4 corroboration tables and
// re-verified against this slice's own committed EDGAR fixture excerpts
// (tests/fixtures/canonical-v2/mae-definition-family/PROVENANCE.json).
const DEF_MAE_REGEXES = Object.freeze([
  regexEntry(
    'DISPROPORTIONATE_STEM', 'DEF-MAE', String.raw`\bdisproportionate(ly)?`,
    'The carveback tell; grounded in 49/51 long-form cards; essentially unique to MAE definitions in M&A drafting -- the family\'s highest-precision pattern.',
  ),
  regexEntry('PANDEMIC_STEM', 'DEF-MAE', String.raw`\bpandemics?`, 'Pandemic carve-out tell.'),
  regexEntry('EPIDEMIC_STEM', 'DEF-MAE', String.raw`\bepidemics?`, 'Pandemic carve-out tell (companion stem to PANDEMIC_STEM, kept as its own pattern_id per the no-slash rule).'),
]);
const DEF_MAE_PHRASES = Object.freeze([
  ['MATERIAL_ADVERSE_EFFECT', 'Material Adverse Effect', 'The family\'s defining term; grounded in all 68 cards. PRICED NOISE (spec section 5): saturates MAE-qualified reps/bring-downs/closing conditions corpus-wide -- Ben-ratified same-family-within-section reading limits an unmatched hit to vetoing only DEF-MAE conclusions in that section. LITERAL_PHRASE is case-insensitive by the net\'s own contract, so "material adverse effect" is the SAME pattern -- no separate entry.'],
  ['TAKEN_INTO_ACCOUNT_IN_DETERMINING', 'taken into account in determining', 'The carve-out chapeau tell (Metsera: "shall be taken into account in determining whether there has been a Company Material Adverse Effect"); verified present across the grounding deals\' committed fixture excerpts (audit m-1 grounding swap, restated).'],
  ['TAKEN_INTO_ACCOUNT_WHEN_DETERMINING', 'taken into account when determining', 'Variant chapeau form ("shall be taken into account when determining whether a \'Material Adverse Effect\' has occurred").'],
  ['TAKEN_INTO_CONSIDERATION_WHEN_DETERMINING', 'taken into consideration when determining', 'The Skechers drafting variant, previously an unrecorded miss (audit m-1).'],
  ['ACTS_OF_WAR', 'acts of war', 'War/terror carve-out tell; grounded in the TopBuild/Modiv committed fixture excerpts ("acts of war, sabotage, terrorism").'],
  ['TERRORISM', 'terrorism', 'War/terror carve-out tell (49/51 cards carry terrorism language). Priced: may also fire in a rare force-majeure covenant section; veto-only cost.'],
  ['HOSTILITIES', 'hostilities', 'War/terror carve-out tell; grounded in the TopBuild committed fixture excerpt ("outbreak of hostilities, acts of war").'],
  ['DISEASE_OUTBREAK', 'disease outbreak', 'Pandemic carve-out tell; grounded in the Modiv committed fixture excerpt.'],
  ['NATURAL_DISASTERS', 'natural disasters', 'Grounded in the Skechers committed fixture excerpt ("earthquakes, hurricanes, tsunamis, tornadoes, floods, mudslides, wild fires or other natural disasters").'],
  ['FORCE_MAJEURE', 'force majeure', 'Grounded in the Skechers committed fixture excerpt ("other force majeure events").'],
  ['GENERAL_ECONOMIC_CONDITIONS', 'general economic conditions', 'Economy-general carve-out tell; grounded in the TopBuild committed fixture excerpt.'],
  ['CREDIT_MARKETS', 'credit markets', 'Financial-markets carve-out tell. Priced: also fires in financing reps and efforts covenants -- queue cost, recorded.'],
  ['CAPITAL_MARKETS', 'capital markets', 'Financial-markets carve-out tell. Priced: same queue cost as CREDIT_MARKETS.'],
  ['SECURITIES_MARKETS', 'securities markets', 'Financial-markets carve-out tell; grounded in the TopBuild committed fixture excerpt.'],
  ['FAILURE_TO_MEET', 'failure to meet', 'Projections carve-out tell; grounded in the TopBuild committed fixture excerpt ("any failure by the Company to meet any internal or public projections").'],
  ['PROJECTIONS', 'projections', 'Projections carve-out tell. Priced: fires in disclosure/forecast reps; veto-only.'],
  ['CHANGES_IN_GAAP', 'changes in GAAP', 'GAAP-change carve-out tell, grounded 14 cards. Naked "GAAP" acronym is deliberately EXCLUDED (spec section 5) -- fires in every financial-statements/SEC-reports rep; only the phrase form carries the family signal.'],
].map(([id, value, rationale]) => phraseEntry(id, 'DEF-MAE', value, rationale)));

// TERMR-MUTUAL (spec section 5): the two grounded phrasings for mutual
// termination by consent -- "mutual written agreement" per audit M-2's
// correction (a bare "mutual written consent" pattern misses the recurring
// "by mutual written agreement of Parent and the Company" corpus form).
const TERMR_MUTUAL_PHRASES = Object.freeze([
  ['MUTUAL_WRITTEN_CONSENT', 'mutual written consent', 'Grounded verbatim: "by mutual written consent of the Company and Parent by action of their respective boards of directors."'],
  ['MUTUAL_WRITTEN_AGREEMENT', 'mutual written agreement', 'Recurring verified corpus form: "by mutual written agreement of Parent and the Company" (audit M-2).'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMR-MUTUAL', value, rationale)));

// TERMR-OUTSIDE (spec section 5): the three defined-term literals are
// CASE-SENSITIVE (lower-case "end date" in prose must not fire) --
// matched via LITERAL_ACRONYM, this module's existing case-sensitive,
// word-bounded literal-scan mechanism (the same mechanism the REP-T-CAP
// RSU/PSU/SAR entries already use for exact-case tokens; BOUNDED_REGEX
// entries in this module are always scanned case-INsensitively by
// `matchFamily`, so a case-sensitive defined-term literal is expressed as
// LITERAL_ACRONYM here, never as BOUNDED_REGEX, to actually get the
// case-sensitivity the spec requires rather than silently losing it).
// Priced cross-hit noise (spec section 5, audit M-4): these defined terms
// verifiably appear inside breach CURE clauses and extension
// parentheticals too -- an ACCEPTED, recorded cost (see test 7's anti-
// noise pin).
const TERMR_OUTSIDE_ACRONYMS = Object.freeze([
  ['OUTSIDE_DATE', 'Outside Date', 'Case-sensitive defined term; grounded verbatim: "(the \'Outside Date\')".'],
  ['END_DATE', 'End Date', 'Case-sensitive defined term; grounded verbatim: "(the \'End Date\')".'],
  ['TERMINATION_DATE', 'Termination Date', 'Case-sensitive defined term; grounded verbatim: "on the \'Termination Date\'".'],
].map(([id, value, rationale]) => acronymEntry(id, 'TERMR-OUTSIDE', value, rationale)));
const TERMR_OUTSIDE_PHRASES = Object.freeze([
  ['NOT_CONSUMMATED_ON_OR_BEFORE', 'not been consummated on or before', 'Grounded deadline-prose tell, covers lower-case drafting variants the case-sensitive defined-term literals above would miss.'],
  ['NOT_OCCURRED_ON_OR_BEFORE', 'not have occurred on or before', 'Grounded deadline-prose tell, companion form to NOT_CONSUMMATED_ON_OR_BEFORE.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMR-OUTSIDE', value, rationale)));

// TERMR-NOVOTE (spec section 5, audit M-4): narrowed to the FAILURE
// phrases only -- the earlier draft's bare Stockholder/Shareholder
// Approval defined terms flood non-VOTE TERMR sections (SUPERIOR/RECOMMEND
// conditions, mutual parentheticals) and are deliberately NOT lexicon
// entries here (see the trigger-kind corroboration pattern in
// candidate-resolution.js for the Approval-term+failure-phrase PAIR, which
// runs on the candidate's own narrower quote where the pairing IS
// discriminating).
const TERMR_NOVOTE_PHRASES = Object.freeze([
  ['SHALL_NOT_HAVE_BEEN_OBTAINED', 'shall not have been obtained', 'Grounded verbatim: "the Company Stockholder Approval shall not have been obtained".'],
  ['FAILURE_TO_OBTAIN_REQUIRED_VOTE', 'failure to obtain the required vote', 'Grounded verbatim: "by reason of the failure to obtain the required vote".'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMR-NOVOTE', value, rationale)));

// TERMR-BREACH (spec section 5): cure/notice tells grounded verbatim in
// the quoted corpus breach text.
const TERMR_BREACH_PHRASES = Object.freeze([
  ['BREACHED_OR_FAILED_TO_PERFORM', 'breached or failed to perform', 'Standard breach-trigger chapeau tell.'],
  ['WRITTEN_NOTICE_OF_SUCH_BREACH', 'written notice of such breach', 'Grounded verbatim: "written notice of such breach, delivered at least 45 days prior to such termination".'],
  ['NOT_CURED_WITHIN', 'not cured within', 'Grounded verbatim: "which is not cured within the earlier of (1) the Outside Date and (2) 30 days following written notice".'],
  ['CURED_WITHIN', 'cured within', 'Companion form to NOT_CURED_WITHIN, grounded in the same cure-period drafting.'],
  ['INCAPABLE_OF_BEING_CURED', 'incapable of being cured', 'Standard breach-cure carve-out tell for an incurable breach.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMR-BREACH', value, rationale)));

// TERMR-LEGAL (spec section 5): grounded in the quoted corpus legal-
// restraint text ("any permanent injunction or other judgment or order
// issued by a Governmental Authority of competent jurisdiction ...
// preventing the consummation of the Merger").
const TERMR_LEGAL_PHRASES = Object.freeze([
  ['PERMANENT_INJUNCTION', 'permanent injunction', 'Grounded verbatim in the quoted corpus LEGAL text.'],
  ['PREVENTING_THE_CONSUMMATION', 'preventing the consummation', 'Grounded verbatim in the quoted corpus LEGAL text.'],
  ['RESTRAINT_OR_PROHIBITION', 'restraint or prohibition', 'Standard restraint-clause noun-form tell, companion to the injunction tell above.'],
].map(([id, value, rationale]) => phraseEntry(id, 'TERMR-LEGAL', value, rationale)));

// TERMR-SUPERIOR (spec section 5): the case-sensitive defined term, same
// LITERAL_ACRONYM mechanism as TERMR-OUTSIDE's defined terms above.
const TERMR_SUPERIOR_ACRONYMS = Object.freeze([
  ['SUPERIOR_PROPOSAL', 'Superior Proposal', 'Case-sensitive defined term; grounded verbatim: "the Company Board has determined that an Acquisition Proposal constitutes a Superior Proposal".'],
].map(([id, value, rationale]) => acronymEntry(id, 'TERMR-SUPERIOR', value, rationale)));

// TERMR-RECOMMEND (spec section 5, audit M-2): the head alternative
// "Adverse Recommendation" also covers "Adverse Recommendation Change"
// cards; "Change in Recommendation" added per audit M-2 (the three
// original literals alone hit only 26/40 -- this fourth form closes the
// gap). All four are case-sensitive defined terms.
const TERMR_RECOMMEND_ACRONYMS = Object.freeze([
  ['ADVERSE_RECOMMENDATION', 'Adverse Recommendation', 'Case-sensitive defined term; also covers "Adverse Recommendation Change" cards.'],
  ['CHANGE_OF_RECOMMENDATION', 'Change of Recommendation', 'Case-sensitive defined term; grounded in the section-titled "Change of Recommendation" corpus example.'],
  ['CHANGE_IN_RECOMMENDATION', 'Change in Recommendation', 'Case-sensitive defined term, added per audit M-2 (6 cards use this form; the three original literals alone hit only 26/40).'],
  ['COMPANY_BOARD_RECOMMENDATION', 'Company Board Recommendation', 'Case-sensitive defined term, companion form.'],
].map(([id, value, rationale]) => acronymEntry(id, 'TERMR-RECOMMEND', value, rationale)));

const COV_PROXY_REGEXES = Object.freeze([
  ['PROXY_STATEMENT', '\\bProxy Statement\\b', 'Defined proxy document term.'],
  ['SCHEDULE_13E_3', '\\bSchedule 13E-3\\b', 'Grounded going-private filing document.'],
  ['FORM_S_4', '\\bForm S-4\\b', 'Grounded registration document.'],
].map(([id, value, rationale]) => regexEntry(id, 'COV-PROXY', value, rationale)));
const COV_PROXY_PHRASES = Object.freeze([
  ['PRELIMINARY_FORM', 'in preliminary form', 'Grounded SEC-filing preparation tell.'],
  ['NO_FURTHER_COMMENTS', 'no further comments', 'Grounded SEC-clearance tell.'],
  ['BROKER_SEARCH', 'broker search', 'Grounded proxy-mechanics tell.'],
  ['COMPANY_RECOMMENDATION_INCLUSION', 'include the Company Board Recommendation', 'Grounded inclusion covenant.'],
  ['RECOMMENDATION_INCLUSION', 'include the Board Recommendation', 'Grounded alternate inclusion covenant.'],
].map(([id, value, rationale]) => phraseEntry(id, 'COV-PROXY', value, rationale)));
const COV_MEETING_REGEXES = Object.freeze([
  ['STOCKHOLDERS_MEETING', "\\bStockholders?['’]{0,1} Meeting\\b", 'Defined stockholders-meeting term.'],
  ['SHAREHOLDERS_MEETING', "\\bShareholders?['’]{0,1} Meeting\\b", 'Defined shareholders-meeting term.'],
].map(([id, value, rationale]) => regexEntry(id, 'COV-MEETING', value, rationale)));
const COV_MEETING_PHRASES = Object.freeze([
  ['EXTRAORDINARY_GENERAL_MEETING', 'extraordinary general meeting', 'Grounded foreign-issuer meeting form.'],
  ['POSTPONE_OR_ADJOURN', 'postpone or adjourn', 'Grounded adjournment control phrase.'],
  ['ADJOURN_OR_POSTPONE', 'adjourn or postpone', 'Grounded adjournment control phrase.'],
  ['POSTPONED_OR_ADJOURNED', 'postponed or adjourned', 'Grounded adjournment cap phrase.'],
  ['RECORD_DATE', 'record date', 'Grounded, intentionally veto-only, record-date phrase.'],
].map(([id, value, rationale]) => phraseEntry(id, 'COV-MEETING', value, rationale)));

const CONS_PERSHARE_PHRASES = Object.freeze([
  ['IN_CASH_WITHOUT_INTEREST', 'in cash, without interest', 'Grounded per-share cash payment phrase.'],
  ['CONVERTED_INTO_RIGHT_TO_RECEIVE', 'converted into the right to receive', 'Grounded conversion phrase introducing per-share consideration.'],
  ['RIGHT_TO_RECEIVE_CASH', 'right to receive cash', 'Grounded cash-payment phrase.'],
].map(([id, value, rationale]) => phraseEntry(id, 'CONS-PERSHARE', value, rationale)));
const CONS_PERSHARE_ACRONYMS = Object.freeze([
  ['MERGER_CONSIDERATION', 'Merger Consideration', 'Case-sensitive defined term. Priced cross-hits in payment mechanics remain veto-only.'],
].map(([id, value, rationale]) => acronymEntry(id, 'CONS-PERSHARE', value, rationale)));

const CONS_RATIO_PHRASES = Object.freeze([
  ['OF_A_SHARE_OF', 'of a share of', 'Grounded stock exchange-ratio phrase.'],
  ['IN_LIEU_OF_FRACTIONAL_SHARES', 'in lieu of fractional shares', 'Grounded companion phrase for a stock consideration component.'],
].map(([id, value, rationale]) => phraseEntry(id, 'CONS-RATIO', value, rationale)));
const CONS_RATIO_ACRONYMS = Object.freeze([
  ['EXCHANGE_RATIO', 'Exchange Ratio', 'Case-sensitive defined term, including the bounded suffix of longer defined terms.'],
].map(([id, value, rationale]) => acronymEntry(id, 'CONS-RATIO', value, rationale)));

const CONS_DISSENT_PHRASES = Object.freeze([
  ['APPRAISAL_RIGHTS', 'appraisal rights', 'Grounded in both available and expressly unavailable appraisal-rights clauses.'],
].map(([id, value, rationale]) => phraseEntry(id, 'CONS-DISSENT', value, rationale)));
const CONS_DISSENT_ACRONYMS = Object.freeze([
  ['DISSENTING_STOCKHOLDER', 'Dissenting Stockholder', 'Case-sensitive defined-term form.'],
  ['DISSENTING_SHARES', 'Dissenting Shares', 'Case-sensitive defined-term form.'],
  ['DISSENTING_COMPANY_SHARES', 'Dissenting Company Shares', 'Case-sensitive defined-term form.'],
  ['DISSENTER_RIGHTS', 'Dissenter Rights', 'Case-sensitive Cayman defined-term form.'],
].map(([id, value, rationale]) => acronymEntry(id, 'CONS-DISSENT', value, rationale)));

const COV_FINANCING_PHRASES = Object.freeze([
  ['FINANCING_COOPERATION', 'financing cooperation', 'Grounded financing-cooperation tell.'],
  ['CUSTOMARY_COOPERATION', 'customary cooperation', 'Grounded target cooperation tell.'],
  ['NO_CONDITION', 'is not a condition to', 'Grounded quoted no-financing-condition acknowledgment.'],
].map(([id, value, rationale]) => phraseEntry(id, 'COV-FINANCING', value, rationale)));
const COV_FINANCING_REGEXES = Object.freeze([
  ['DEBT_FINANCING', '\\bDebt Financing\\b', 'Grounded debt-financing defined term.'],
  ['EQUITY_FINANCING', '\\bEquity Financing\\b', 'Grounded equity-financing defined term.'],
  ['DEBT_COMMITMENT', '\\bDebt Commitment Letter\\b', 'Grounded debt commitment term.'],
  ['EQUITY_COMMITMENT', '\\bEquity Commitment Letter\\b', 'Grounded equity commitment term.'],
].map(([id, value, rationale]) => regexEntry(id, 'COV-FINANCING', value, rationale)));
const COV_PAYOFF_PHRASES = Object.freeze([
  ['PAYOFF_LETTER', 'payoff letter', 'Grounded payoff-delivery tell.'],
  ['PAYOFF_LETTERS', 'payoff letters', 'Grounded plural payoff-delivery tell.'],
  ['PAYOFF_DELIVERABLES', 'payoff deliverables', 'Grounded payoff-delivery tell.'],
].map(([id, value, rationale]) => phraseEntry(id, 'COV-PAYOFF', value, rationale)));
const COV_MARKETING_ACRONYMS = Object.freeze([
  ['MARKETING_PERIOD', 'Marketing Period', 'Case-sensitive defined marketing term.'],
].map(([id, value, rationale]) => acronymEntry(id, 'COV-MARKETING', value, rationale)));
const GTY_PERF_PHRASES = Object.freeze([
  ['HEREBY_GUARANTEES', 'hereby guarantees', 'Grounded operative guaranty phrase.'],
  ['IRREVOCABLE_GUARANTEE', 'irrevocably and unconditionally guarantees', 'Grounded unconditional guaranty phrase.'],
  ['PAYMENT_AND_PERFORMANCE', 'guarantee of payment and performance', 'Grounded payment-and-performance form.'],
].map(([id, value, rationale]) => phraseEntry(id, 'GTY-PERF', value, rationale)));
const GTY_DELIVERY_PHRASES = Object.freeze([
  ['DULY_EXECUTED_GUARANTY', 'duly executed guaranty', 'Grounded delivery form.'],
  ['DULY_EXECUTED_GUARANTEE', 'duly executed guarantee', 'Grounded delivery form.'],
].map(([id, value, rationale]) => phraseEntry(id, 'GTY-DELIVERY', value, rationale)));
const GTY_DELIVERY_REGEXES = Object.freeze([
  ['LIMITED_GUARANTEES', '\\bLimited Guarantees?\\b', 'Grounded limited-guaranty defined term.'],
].map(([id, value, rationale]) => regexEntry(id, 'GTY-DELIVERY', value, rationale)));

// TERMR-NOSOL-BREACH (spec section 5): DELIBERATELY UNCOVERED this slice --
// no v1 subtype exists for it, so there is zero corpus quote text to
// ground a pattern in, and fabricating one violates the grounding rule
// this programme runs on. It stays LEXICON_FAMILY_UNCOVERED (typed, never
// silently clean) until real corpus text is observed and a grounded
// pattern is authored in a reviewed lexicon diff. No entries added here.

const ANTI_EFFORTS_PHRASES = Object.freeze([
  ['REASONABLE_BEST', 'reasonable best efforts', 'Regulatory-clearance efforts standard.'],
  ['COMMERCIAL_REASONABLE', 'commercially reasonable efforts', 'Regulatory-clearance efforts standard.'],
  ['BEST', 'best efforts', 'Regulatory-clearance efforts standard.'],
  ['FLAT_ACTIONS', 'take, or cause to be taken, all actions', 'Flat regulatory action obligation tell.'],
  ['FLAT_NECESSARY', 'all things necessary, proper, or advisable', 'Flat regulatory action obligation tell.'],
].map(([id, value, rationale]) => phraseEntry(id, 'ANTI-EFFORTS', value, rationale)));
const ANTI_BURDEN_ACRONYMS = Object.freeze([
  ['BURDENSOME_CONDITION', 'Burdensome Condition', 'Case-sensitive defined burden term.'],
  ['DETRIMENT', 'Detriment', 'Case-sensitive defined burden term.'],
].map(([id, value, rationale]) => acronymEntry(id, 'ANTI-BURDEN', value, rationale)));
const ANTI_BURDEN_PHRASES = Object.freeze([
  ['HOLD_SEPARATE', 'hold separate', 'Remedy-burden tell.'], ['NOT_REQUIRED', 'shall not be required to', 'Express burden carve-out tell.'],
  ['ELIMINATE_IMPEDIMENT', 'avoid or eliminate each and every impediment', 'Express HOHW tell.'], ['HOHW_MARKET', 'hell or high water', 'Ungrounded market vocabulary retained as a veto-only tell.'],
].map(([id, value, rationale]) => phraseEntry(id, 'ANTI-BURDEN', value, rationale)));
const ANTI_LITIGATION_PHRASES = Object.freeze([
  ['VIGOROUSLY_CONTEST', 'vigorously contest', 'Mandatory litigation drafting tell.'], ['DEFENDING_THROUGH_LITIGATION', 'defending through litigation', 'Mandatory litigation drafting tell.'], ['JUDICIAL_APPEAL', 'judicial appeal', 'Mandatory litigation drafting tell.'], ['CONTESTING_LITIGATING_DEFENDING', 'contesting, litigating and defending', 'Recorded Modiv transaction-litigation obligation.'],
].map(([id, value, rationale]) => phraseEntry(id, 'ANTI-LITIGATION', value, rationale)));
const ANTI_TIMING_PHRASES = Object.freeze([
  ['PULL_AND_REFILE', 'pull and refile', 'Timing-agreement restriction tell.'], ['PULL_AND_REFILE_HYPHEN', 'pull-and-refile', 'Hyphenated timing-agreement restriction tell.'],
  ['STAY_TOLL_EXTEND', 'stay, toll or extend', 'Timing-agreement restriction tell.'], ['STAY_TOLL_EXTEND_SERIAL', 'stay, toll, or extend', 'Serial-comma timing-agreement restriction tell.'], ['TIMING_AGREEMENT', 'timing agreement', 'Timing-agreement restriction tell.'],
].map(([id, value, rationale]) => phraseEntry(id, 'ANTI-TIMING', value, rationale)));
const ANTI_FILING_ACRONYMS = Object.freeze([['HSR_ACT', 'HSR Act', 'Case-sensitive statute reference and deliberate cross-hit veto.']].map(([id, value, rationale]) => acronymEntry(id, 'ANTI-FILING', value, rationale)));
const ANTI_FILING_PHRASES = Object.freeze([['NOTIFICATION_REPORT_FORM', 'Notification and Report Form', 'HSR filing-form tell.']].map(([id, value, rationale]) => phraseEntry(id, 'ANTI-FILING', value, rationale)));
const COND_B_REP_PHRASES = Object.freeze([['COMPANY_REPRESENTATIONS', 'representations and warranties of the Company', 'Recorded target bring-down condition.']].map(([id, value, rationale]) => phraseEntry(id, 'COND-B-REP', value, rationale)));
const COND_S_REP_PHRASES = Object.freeze([['PARENT_REPRESENTATIONS', 'representations and warranties made by Parent', 'Recorded buyer bring-down condition.']].map(([id, value, rationale]) => phraseEntry(id, 'COND-S-REP', value, rationale)));
const COND_MAE_PHRASES = Object.freeze([['COMPANY_MAE', 'Company Material Adverse Effect', 'Recorded no-MAE condition term.'], ['CONTINUING', 'is continuing', 'Recorded continuing-MAE condition qualifier.']].map(([id, value, rationale]) => phraseEntry(id, 'COND-MAE', value, rationale)));
const COND_COV_PHRASES = Object.freeze([['PERFORMANCE_MATERIALITY', 'performed in all material respects', 'Recorded covenant-compliance condition.']].map(([id, value, rationale]) => phraseEntry(id, 'COND-COV', value, rationale)));
const COND_REG_PHRASES = Object.freeze([['HSR_WAITING_PERIOD', 'waiting period applicable to the consummation of the Merger under the HSR Act', 'Recorded HSR closing condition.'], ['SCHEDULED_APPROVALS', 'approvals required in those jurisdictions set forth in Section', 'Recorded scheduled-approval condition.']].map(([id, value, rationale]) => phraseEntry(id, 'COND-REG', value, rationale)));

const IOC_PHRASES = Object.freeze([
  ['CAPEX', 'IOC-CAPEX', 'capital expenditures'],
  ['DEBT', 'IOC-DEBT', 'indebtedness for borrowed money'],
  ['DIVIDEND', 'IOC-DIVIDEND', 'declare, set aside'],
  ['SETTLE', 'IOC-SETTLE', 'compromise or settle'],
  ['COMP', 'IOC-COMP', 'base salary'],
  ['ISSUE', 'IOC-ISSUE', 'issue, deliver'],
  ['CHARTER', 'IOC-CHARTER', 'certificate of incorporation'],
  ['MERGE', 'IOC-MERGE', 'merge with'],
  ['CONTRACT', 'IOC-CONTRACT', 'Material Contract'],
  ['ACCOUNTING', 'IOC-ACCOUNTING', 'accounting policies'],
  ['TAX', 'IOC-TAX', 'election relating to Taxes'],
].map(([id, family, value]) => phraseEntry(id, family, value, 'IOC corpus-grounded restriction phrase.')));
const TAX_DIVIDENDS_APPRAISAL_PHRASES = Object.freeze([
  ['INTENDED_TAX_TREATMENT', 'TAXM-TREATMENT', 'Intended Tax Treatment'],
  ['TRANSFER_TAXES', 'TAXM-TRANSFER', 'Transfer Taxes'],
  ['FIRPTA', 'TAXM-FIRPTA', 'FIRPTA'],
  ['DIVIDEND_COORDINATION', 'DIVD-COORD', 'coordinate their record and payment dates'],
  ['SPECIAL_DIVIDEND', 'DIVD-SPECIAL', 'Special Dividend'],
  ['APPRAISAL_DEMANDS', 'APPR-SETTLE', 'demands for appraisal'],
  ['WITHDRAWAL', 'APPR-WITHDRAW', 'fails to perfect'],
].map(([id, family, value]) => phraseEntry(id, family, value, 'Tax, dividend or appraisal governed phrase.')));
const EMPLOYEE_DNO_PHRASES = Object.freeze([
  phraseEntry('CONTINUING_EMPLOYEES', 'COV-EMPLOYEE', 'Continuing Employees', 'Employee continuation defined term.'),
  phraseEntry('SERVICE_CREDIT', 'COV-EMPLOYEE', 'service credit', 'Employee service-credit phrase.'),
  phraseEntry('DNO_INDEMNIFICATION', 'DNO-INDEM', 'indemnification and advancement', 'D&O indemnification phrase.'),
  phraseEntry('TAIL_POLICY', 'DNO-TAIL', 'tail policy', 'D&O tail insurance phrase.'),
  phraseEntry('TPB', 'DNO-BENEF', 'third party beneficiaries', 'Covered-person enforcement right.'),
]);

// V31 carrier families. Each phrase occurs in the admitted Landos agreement
// fixture. They are veto-only signals, never positive extraction rules.
const MERGER_STRUCTURE_PHRASES = Object.freeze([
  ['EFFECTIVE_TIME', 'Effective Time', 'Grounded merger-mechanics defined term.'],
  ['SECTION_251H', 'Section 251(h)', 'Grounded short-form merger statute phrase in the read-only production fixture.'],
].map(([id, value, rationale]) => phraseEntry(id, 'MERGER-STRUCTURE', value, rationale)));
const SPECIFIC_PERFORMANCE_PHRASES = Object.freeze([
  ['SPECIFIC_PERFORMANCE', 'specific performance', 'Grounded remedies phrase in the admitted Landos agreement.'],
].map(([id, value, rationale]) => phraseEntry(id, 'REMEDY-SPECIFIC-PERFORMANCE', value, rationale)));
const MISC_BOILERPLATE_PHRASES = Object.freeze([
  ['EXCLUSIVE_JURISDICTION', 'exclusive jurisdiction and venue', 'Grounded forum-selection phrase in the admitted Landos agreement.'],
  ['GOVERNED_BY', 'governed by', 'Grounded governing-law phrase in the read-only production fixture.'],
  ['EXCLUSIVE_JURISDICTION_SHORT', 'exclusive jurisdiction', 'Grounded forum-selection phrase in the read-only production fixture.'],
].map(([id, value, rationale]) => phraseEntry(id, 'MISC-BOILERPLATE', value, rationale)));
const REP_TARGET_QUALIFIER_PHRASES = Object.freeze([
  ['COMPANY_ACCURACY', 'to the Knowledge of the Company, true and correct in all material respects', 'Grounded Company-side qualifier phrase in the read-only production fixture.'],
].map(([id, value, rationale]) => phraseEntry(id, 'REP-T-QUALIFIER', value, rationale)));
const REP_BUYER_QUALIFIER_PHRASES = Object.freeze([
  ['PARENT_ACCURACY', 'Parent and its Subsidiaries will not be true and correct in all material respects', 'Grounded Parent-side qualifier phrase in the read-only production fixture.'],
].map(([id, value, rationale]) => phraseEntry(id, 'REP-B-QUALIFIER', value, rationale)));

const LEXICAL_FAMILY_LEXICON = Object.freeze({
  schema_version: LEXICAL_FAMILY_LEXICON_SCHEMA,
  version: LEXICAL_FAMILY_LEXICON_VERSION,
  entries: Object.freeze([
    ...REP_T_CAP_PHRASES, ...REP_T_CAP_ACRONYMS,
    ...REP_T_CONTRACTS_PHRASES,
    ...NO_OTHER_REPS_FRAUD_PHRASES,
    ...GENERAL_COVENANT_PHRASES,
    ...TERMF_TARGET_PHRASES, ...TERMF_REVERSE_PHRASES, ...TERMF_TAIL_PHRASES,
    ...NOSOL_PROHIBIT_REGEXES, ...NOSOL_PROHIBIT_PHRASES,
    ...NOSOL_EXCEPT_PHRASES,
    ...NOSOL_NOTICE_REGEXES, ...NOSOL_NOTICE_PHRASES,
    ...NOSOL_MATCH_PHRASES,
    ...NOSOL_REMATCH_PHRASES,
    ...DEF_MAE_REGEXES, ...DEF_MAE_PHRASES,
    ...TERMR_MUTUAL_PHRASES,
    ...TERMR_OUTSIDE_ACRONYMS, ...TERMR_OUTSIDE_PHRASES,
    ...TERMR_NOVOTE_PHRASES,
    ...TERMR_BREACH_PHRASES,
    ...TERMR_LEGAL_PHRASES,
    ...TERMR_SUPERIOR_ACRONYMS,
    ...TERMR_RECOMMEND_ACRONYMS,
    ...COV_PROXY_REGEXES, ...COV_PROXY_PHRASES,
    ...COV_MEETING_REGEXES, ...COV_MEETING_PHRASES,
    ...ANTI_EFFORTS_PHRASES, ...ANTI_BURDEN_ACRONYMS, ...ANTI_BURDEN_PHRASES,
    ...ANTI_LITIGATION_PHRASES, ...ANTI_TIMING_PHRASES, ...ANTI_FILING_ACRONYMS, ...ANTI_FILING_PHRASES,
    ...COND_B_REP_PHRASES, ...COND_S_REP_PHRASES, ...COND_MAE_PHRASES,
    ...COND_COV_PHRASES, ...COND_REG_PHRASES,
    ...CONS_PERSHARE_PHRASES, ...CONS_PERSHARE_ACRONYMS,
    ...CONS_RATIO_PHRASES, ...CONS_RATIO_ACRONYMS,
    ...CONS_DISSENT_PHRASES, ...CONS_DISSENT_ACRONYMS,
    ...COV_FINANCING_PHRASES, ...COV_FINANCING_REGEXES,
    ...COV_PAYOFF_PHRASES, ...COV_MARKETING_ACRONYMS,
    ...GTY_PERF_PHRASES, ...GTY_DELIVERY_PHRASES, ...GTY_DELIVERY_REGEXES,
    ...IOC_PHRASES,
    ...TAX_DIVIDENDS_APPRAISAL_PHRASES,
    ...EMPLOYEE_DNO_PHRASES,
    ...REP_TARGET_QUALIFIER_PHRASES, ...REP_BUYER_QUALIFIER_PHRASES,
    ...MERGER_STRUCTURE_PHRASES, ...SPECIFIC_PERFORMANCE_PHRASES, ...MISC_BOILERPLATE_PHRASES,
  ]),
});

// ---------------------------------------------------------------------------
// Lexicon content hash -- pinned into every receipt (spec section 4). Always
// computed over entries in SORTED pattern_id order so a lexicon-entry-order
// permutation of the same logical table hashes identically (audit m6).
// ---------------------------------------------------------------------------
function sortedLexiconEntries(lexicon) {
  return [...lexicon.entries].sort((a, b) => a.pattern_id.localeCompare(b.pattern_id));
}

function lexiconContentHash(lexicon) {
  return contentId(LEXICAL_FAMILY_LEXICON_SCHEMA, {
    version: lexicon.version,
    entries: sortedLexiconEntries(lexicon).map((entry) => ({
      pattern_id: entry.pattern_id, family: entry.family, kind: entry.kind,
      value: entry.value, rationale: entry.rationale,
    })),
  });
}

// ---------------------------------------------------------------------------
// BOUNDED_REGEX static-max-length validator (spec audit M5). Rejects any
// unbounded quantifier syntactically; computes a conservative static upper
// bound on match length for everything else. Exported so a future
// BOUNDED_REGEX entry's own table-validation test can call it directly, and
// so THIS module's own lexicon-validation test exercises it even though no
// entry in LEXICAL_FAMILY_LEXICON/V1 currently uses the kind.
// ---------------------------------------------------------------------------
const UNBOUNDED_BOUND_RE = /^\{\d+,\}$/;

// A single lastIndex-scanning pass whose ONLY job is to find a `*`, `+`, or
// unbounded `{m,}` that is a QUANTIFIER TOKEN, never a literal character
// consumed as part of a two-character escape sequence (a naive "char
// before it isn't a backslash" regex is fooled by an ESCAPED backslash
// atom, e.g. `\\+` -- the `+` there quantifies the escaped `\` atom, and
// the character immediately before it IS a backslash, so a same-char
// lookbehind wrongly reads it as "escaped" and misses the unbounded
// quantifier entirely). Escapes, character classes, and groups are each
// consumed as an indivisible unit before the scanner ever looks at what
// follows them, so a `*`/`+`/`{m,}` is only ever seen when it is truly in
// quantifier position.
function hasUnboundedQuantifier(source) {
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      const close = source.indexOf(']', i + 1);
      i = close === -1 ? source.length : close + 1;
      continue;
    }
    if (ch === '(') {
      i += 1;
      continue;
    }
    if (ch === '*' || ch === '+') return true;
    if (ch === '{') {
      const close = source.indexOf('}', i + 1);
      if (close !== -1 && UNBOUNDED_BOUND_RE.test(source.slice(i, close + 1))) return true;
      i = close === -1 ? source.length : close + 1;
      continue;
    }
    i += 1;
  }
  return false;
}

function validateBoundedRegexPattern(source) {
  if (typeof source !== 'string' || source.length === 0) {
    fail('INVALID_BOUNDED_REGEX', 'BOUNDED_REGEX pattern must be a non-empty string');
  }
  if (hasUnboundedQuantifier(source)) {
    fail('BOUNDED_REGEX_UNBOUNDED_QUANTIFIER', `BOUNDED_REGEX pattern uses an unbounded quantifier: ${source}`, { source });
  }
  // Conservative static max length: walk the source, summing a per-atom
  // maximum. Literal characters and character classes count 1 each,
  // `{m,n}` multiplies the PRECEDING atom's count by n, alternation `(a|b)`
  // counts the longest branch. This is deliberately conservative (it may
  // over-count escaped/edge syntax) -- its only job is to prove an upper
  // bound, never to be a full regex-length calculus.
  let maxLength = 0;
  let i = 0;
  let lastAtomLength = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      lastAtomLength = 1;
      maxLength += 1;
      i += 2;
      continue;
    }
    if (ch === '[') {
      const close = source.indexOf(']', i + 1);
      if (close === -1) fail('INVALID_BOUNDED_REGEX', 'unterminated character class', { source });
      lastAtomLength = 1;
      maxLength += 1;
      i = close + 1;
      continue;
    }
    if (ch === '(') {
      const close = source.indexOf(')', i + 1);
      if (close === -1) fail('INVALID_BOUNDED_REGEX', 'unterminated group', { source });
      const inner = source.slice(i + 1, close);
      const branches = inner.split('|');
      const branchMax = Math.max(...branches.map((branch) => branch.replace(/^\?:/, '').length));
      lastAtomLength = branchMax;
      maxLength += branchMax;
      i = close + 1;
      continue;
    }
    if (ch === '{') {
      const close = source.indexOf('}', i + 1);
      if (close === -1) fail('INVALID_BOUNDED_REGEX', 'unterminated bound', { source });
      const bound = source.slice(i + 1, close);
      const parts = bound.split(',');
      const upper = parts.length === 2 ? Number(parts[1]) : Number(parts[0]);
      if (!Number.isInteger(upper) || upper < 0) fail('INVALID_BOUNDED_REGEX', `unparseable bound {${bound}}`, { source });
      // We already added lastAtomLength once for the preceding atom; a
      // bound of n means the atom repeats n times total, so add (n-1) more.
      maxLength += lastAtomLength * Math.max(upper - 1, 0);
      i = close + 1;
      continue;
    }
    if (ch === '?') {
      // Optional: preceding atom may or may not appear -- already counted
      // once above as its base occurrence, so this is a no-op on the max.
      i += 1;
      continue;
    }
    if (ch === '^' || ch === '$') {
      i += 1;
      continue;
    }
    lastAtomLength = 1;
    maxLength += 1;
    i += 1;
  }
  return maxLength;
}

const BOUNDED_REGEX_MAX_MATCH_LENGTH = 128;

// ---------------------------------------------------------------------------
// Table validation (spec acceptance test 7): every key is a registered
// concept key (caller supplies the registered set -- this module has no
// vocabulary of its own to check against), every BOUNDED_REGEX pattern is
// syntactically restricted with a static max <= 128, and every entry
// carries a non-empty pattern_id + rationale.
// ---------------------------------------------------------------------------
function validateLexicalFamilyLexicon(lexicon, { registeredConceptKeys } = {}) {
  requirePlainObject(lexicon, 'lexicon');
  if (lexicon.schema_version !== LEXICAL_FAMILY_LEXICON_SCHEMA) {
    fail('INVALID_LEXICON', `lexicon.schema_version must be ${LEXICAL_FAMILY_LEXICON_SCHEMA}`, {
      schema_version: lexicon.schema_version,
    });
  }
  requireArray(lexicon.entries, 'lexicon.entries');
  const seenIds = new Set();
  for (const entry of lexicon.entries) {
    requirePlainObject(entry, 'lexicon.entries[]');
    requireNonEmptyString(entry.pattern_id, 'lexicon.entries[].pattern_id');
    requireNonEmptyString(entry.family, 'lexicon.entries[].family');
    requireNonEmptyString(entry.rationale, 'lexicon.entries[].rationale');
    requireNonEmptyString(entry.value, 'lexicon.entries[].value');
    if (!['LITERAL_PHRASE', 'LITERAL_ACRONYM', 'BOUNDED_REGEX'].includes(entry.kind)) {
      fail('INVALID_LEXICON', `lexicon.entries[].kind unrecognised: ${entry.kind}`, { pattern_id: entry.pattern_id });
    }
    if (seenIds.has(entry.pattern_id)) fail('DUPLICATE_PATTERN_ID', `duplicate pattern_id: ${entry.pattern_id}`, { pattern_id: entry.pattern_id });
    seenIds.add(entry.pattern_id);
    if (registeredConceptKeys && !registeredConceptKeys.has(entry.family)) {
      fail('LEXICON_FAMILY_NOT_REGISTERED', `lexicon family is not a registered concept key: ${entry.family}`, { family: entry.family });
    }
    if (entry.kind === 'BOUNDED_REGEX') {
      const maxLength = validateBoundedRegexPattern(entry.value);
      if (maxLength > BOUNDED_REGEX_MAX_MATCH_LENGTH) {
        fail('BOUNDED_REGEX_TOO_LONG', `static max match length ${maxLength} exceeds ${BOUNDED_REGEX_MAX_MATCH_LENGTH}`, {
          pattern_id: entry.pattern_id, max_length: maxLength,
        });
      }
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. Matching semantics and the disagreement set.
// ═══════════════════════════════════════════════════════════════════════

function isWordChar(ch) {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

// Word-boundary-checked literal scan over `normalisedText`, returning every
// hit as normalised-string [start, end) indices. `caseSensitive` distinguishes
// LITERAL_ACRONYM from LITERAL_PHRASE (spec audit M2).
function scanLiteral(normalisedText, needle, caseSensitive) {
  const haystack = caseSensitive ? normalisedText : normalisedText.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  const hits = [];
  if (target.length === 0) return hits;
  let searchFrom = 0;
  for (;;) {
    const found = haystack.indexOf(target, searchFrom);
    if (found === -1) break;
    const end = found + target.length;
    const beforeOk = !isWordChar(normalisedText[found - 1]);
    const afterOk = !isWordChar(normalisedText[end]);
    if (beforeOk && afterOk) hits.push({ start: found, end });
    searchFrom = found + 1;
  }
  return hits;
}

// BOUNDED_REGEX scan: standard leftmost, non-windowed, global scan (spec:
// "Matching runs ONCE over the whole normalised text"). The word-boundary
// rule from the LITERAL kinds does not additionally apply here -- a
// BOUNDED_REGEX pattern is expected to encode its own boundary syntax
// (\b, character classes) if it needs one; this module does not silently
// impose one on top of a pattern author's own regex.
function scanBoundedRegex(normalisedText, source, caseSensitive) {
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(source, flags);
  const hits = [];
  let match = regex.exec(normalisedText);
  while (match !== null) {
    const start = match.index;
    const end = start + match[0].length;
    hits.push({ start, end });
    regex.lastIndex = match[0].length === 0 ? regex.lastIndex + 1 : regex.lastIndex;
    match = regex.exec(normalisedText);
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Offset mapping (spec audit M1, pinned exactly). Builds a normalised-index
// -> original-string-index map using the SAME zero-width character class
// zero-width-normalise.js exports, without modifying that module. A
// sentinel entry at `normalised.length` maps to `original.length` so a hit
// ending exactly at the string's end still resolves.
// ---------------------------------------------------------------------------
function buildPositionMap(original) {
  const originalIndexByNormalised = [];
  let normalised = '';
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i];
    if (!ZERO_WIDTH_CHAR.test(ch)) {
      originalIndexByNormalised.push(i);
      normalised += ch;
    }
  }
  originalIndexByNormalised.push(original.length);
  return { normalised, originalIndexByNormalised };
}

// Original JS-string (UTF-16) index -> UTF-8 byte offset, per the spec's own
// pinned formula.
function charIndexToByteOffset(original, charIndex) {
  return Buffer.byteLength(original.slice(0, charIndex), 'utf8');
}

// Maps one normalised-space hit {start, end} to {startByte, endByte,
// reproducible} against the ORIGINAL text, applying the round-trip
// predicate (spec audit M1): `normaliseForMatching(utf8Slice(original,
// startByte, endByte)) === matchedNormalisedText`. A failure is reported,
// never thrown and never silently dropped -- the caller treats
// `reproducible: false` as UNMATCHED for every consumer.
function mapHitToByteOffsets({ original, positionMap, hit, matchedNormalisedText }) {
  const startCharIdx = positionMap.originalIndexByNormalised[hit.start];
  const endCharIdx = positionMap.originalIndexByNormalised[hit.end];
  const startByte = charIndexToByteOffset(original, startCharIdx);
  const endByte = charIndexToByteOffset(original, endCharIdx);
  let reproducible = false;
  try {
    const roundTripped = utf8Slice(original, startByte, endByte);
    reproducible = normaliseForMatching(roundTripped) === matchedNormalisedText;
  } catch {
    reproducible = false;
  }
  return { startByte, endByte, reproducible };
}

// ---------------------------------------------------------------------------
// Byte-range overlap (spec: "byte-overlaps ... at least one byte in common
// -- containment not required"). Half-open ranges.
// ---------------------------------------------------------------------------
function byteRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// Excerpt extraction: hit +/-80 bytes, clamped to the section, snapped
// inward to UTF-8 character boundaries (audit m3) so the excerpt always
// decodes cleanly and stays byte-identical across implementations.
// ---------------------------------------------------------------------------
const EXCERPT_RADIUS_BYTES = 80;

function isUtf8ContinuationByte(byte) {
  return (byte & 0xc0) === 0x80;
}

function snapForwardToBoundary(bytes, index) {
  let idx = index;
  while (idx < bytes.length && isUtf8ContinuationByte(bytes[idx])) idx += 1;
  return idx;
}

function snapBackwardToBoundary(bytes, index) {
  let idx = index;
  while (idx > 0 && isUtf8ContinuationByte(bytes[idx])) idx -= 1;
  return idx;
}

function buildExcerpt(textBytes, startByte, endByte) {
  const rawStart = Math.max(0, startByte - EXCERPT_RADIUS_BYTES);
  const rawEnd = Math.min(textBytes.length, endByte + EXCERPT_RADIUS_BYTES);
  const snappedStart = snapForwardToBoundary(textBytes, rawStart);
  const snappedEnd = snapBackwardToBoundary(textBytes, rawEnd);
  const finalStart = Math.min(snappedStart, snappedEnd);
  return textBytes.subarray(finalStart, snappedEnd).toString('utf8');
}

// ---------------------------------------------------------------------------
// Candidate digest (spec section 4/5): sorted closure_ids, recomputable by
// any consumer from the same candidate list the receipt was built against.
// ---------------------------------------------------------------------------
function computeCandidateDigest(candidates) {
  const closureIds = candidates.map((candidate) => candidate.closure_id).sort();
  return contentId(LEXICAL_DISAGREEMENT_CANDIDATE_DIGEST_DOMAIN, { closure_ids: closureIds });
}

// ---------------------------------------------------------------------------
// Candidate validation (spec section 1): fail-closed, thrown, never
// skip-and-continue.
// ---------------------------------------------------------------------------
function validateCandidates(candidates, { sectionRef, textByteLength }) {
  requireArray(candidates, 'candidates');
  for (const candidate of candidates) {
    requirePlainObject(candidate, 'candidates[]');
    requireNonEmptyString(candidate.closure_id, 'candidates[].closure_id');
    requireNonEmptyString(candidate.section_reference, 'candidates[].section_reference');
    requireNonEmptyString(candidate.family, 'candidates[].family');
    requireArray(candidate.evidence, 'candidates[].evidence');
    if (candidate.section_reference !== sectionRef) {
      fail('CANDIDATE_SECTION_MISMATCH', 'candidate.section_reference does not match governed_section.section_ref', {
        closure_id: candidate.closure_id, expected: sectionRef, actual: candidate.section_reference,
      });
    }
    for (const edge of candidate.evidence) {
      requirePlainObject(edge, 'candidates[].evidence[]');
      const { start, end } = edge;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > textByteLength) {
        fail('EVIDENCE_OUT_OF_FRAME', 'candidate evidence span violates 0 <= start < end <= section byte length', {
          closure_id: candidate.closure_id, start, end, text_byte_length: textByteLength,
        });
      }
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// governed_section validation + hash verification (fail-closed).
// ---------------------------------------------------------------------------
function validateGovernedSection(governedSection) {
  requirePlainObject(governedSection, 'governed_section');
  requireNonEmptyString(governedSection.section_ref, 'governed_section.section_ref');
  if (typeof governedSection.text !== 'string') fail('INVALID_INPUT', 'governed_section.text must be a string');
  requireNonEmptyString(governedSection.text_sha256, 'governed_section.text_sha256');
  const actualHash = crypto.createHash('sha256').update(Buffer.from(governedSection.text, 'utf8')).digest('hex');
  if (actualHash !== governedSection.text_sha256) {
    fail('SECTION_HASH_MISMATCH', 'governed_section.text_sha256 does not match the recomputed hash of governed_section.text', {
      expected: governedSection.text_sha256, actual: actualHash,
    });
  }
  return governedSection;
}

// ---------------------------------------------------------------------------
// Per-family matching: runs every pattern of the family (sorted pattern_id
// order, audit m6) against the normalised section text, maps every hit to
// byte offsets, and classifies each hit MATCHED/UNMATCHED against the
// family's own candidate evidence spans (cross-family evidence never
// matches -- spec pinned decision).
// ---------------------------------------------------------------------------
function matchFamily({ family, entries, text, textBytes, positionMap, normalisedText, candidateEvidenceByFamily }) {
  const evidenceSpans = candidateEvidenceByFamily.get(family) || [];
  const disagreementSet = [];
  let patternHitCount = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;
  let irreproducibleCount = 0;

  const sortedEntries = [...entries].sort((a, b) => a.pattern_id.localeCompare(b.pattern_id));
  for (const entry of sortedEntries) {
    let hits;
    if (entry.kind === 'LITERAL_PHRASE') hits = scanLiteral(normalisedText, entry.value, false);
    else if (entry.kind === 'LITERAL_ACRONYM') hits = scanLiteral(normalisedText, entry.value, true);
    else hits = scanBoundedRegex(normalisedText, entry.value, false);

    for (const hit of hits) {
      patternHitCount += 1;
      const matchedNormalisedText = normalisedText.slice(hit.start, hit.end);
      const { startByte, endByte, reproducible } = mapHitToByteOffsets({
        original: text, positionMap, hit, matchedNormalisedText,
      });
      if (!reproducible) irreproducibleCount += 1;

      const overlapsEvidence = evidenceSpans.some((span) => byteRangesOverlap(startByte, endByte, span.start, span.end));
      const matched = reproducible && overlapsEvidence;

      if (matched) {
        matchedCount += 1;
      } else {
        unmatchedCount += 1;
        disagreementSet.push(Object.freeze({
          family,
          pattern_id: entry.pattern_id,
          start: startByte,
          end: endByte,
          excerpt: buildExcerpt(textBytes, startByte, endByte),
          offset_reproducible: reproducible,
          // Spec-pinned consumer-facing typed name (section 3): a hit whose
          // round-trip predicate failed is REPORTED as irreproducible, never
          // silently dropped, and counts as UNMATCHED for every consumer --
          // `failure_code` is the typed vocabulary a caller can branch on;
          // `offset_reproducible` stays too, as the underlying boolean.
          failure_code: reproducible ? null : HIT_OFFSET_IRREPRODUCIBLE,
        }));
      }
    }
  }

  disagreementSet.sort((a, b) => (a.start - b.start) || (a.end - b.end) || a.pattern_id.localeCompare(b.pattern_id));

  // Max evidence-span share (spec's "known limitation, named" measurement):
  // per candidate of this family, the union-byte-footprint of its own
  // evidence spans, divided by the section's byte length; the max across
  // candidates. 0 when the family has no candidates.
  const candidatesForFamily = new Map();
  for (const span of evidenceSpans) {
    const list = candidatesForFamily.get(span.closure_id) || [];
    list.push(span);
    candidatesForFamily.set(span.closure_id, list);
  }
  let maxEvidenceSpanShare = 0;
  for (const spans of candidatesForFamily.values()) {
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    let unionBytes = 0;
    let cursor = -1;
    for (const span of sorted) {
      const start = Math.max(span.start, cursor);
      if (span.end > start) unionBytes += span.end - start;
      cursor = Math.max(cursor, span.end);
    }
    const share = textBytes.length === 0 ? 0 : unionBytes / textBytes.length;
    if (share > maxEvidenceSpanShare) maxEvidenceSpanShare = share;
  }

  const outcome = disagreementSet.length === 0 ? 'LEXICAL_ALL_SIGNALS_MATCHED' : 'LEXICAL_UNMATCHED_SIGNALS';

  return Object.freeze({
    family,
    outcome,
    disagreement_set: Object.freeze(disagreementSet),
    pattern_hit_count: patternHitCount,
    matched_count: matchedCount,
    unmatched_count: unmatchedCount,
    irreproducible_count: irreproducibleCount,
    max_evidence_span_share: maxEvidenceSpanShare,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 4. LEXICAL_DISAGREEMENT_RECEIPT/V1 -- public entry point.
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param {object} args
 * @param {object} args.governed_section  { section_ref, text, text_sha256 }.
 * @param {object[]} args.candidates      the run's compiled candidates for
 *   THIS section -- { closure_id, section_reference, family, evidence:
 *   [{start, end}] } with section-local UTF-8 byte offsets.
 * @param {object} [args.lexicon]         a LEXICAL_FAMILY_LEXICON/V1;
 *   defaults to this module's own frozen `LEXICAL_FAMILY_LEXICON`.
 * @returns {object} a frozen LEXICAL_DISAGREEMENT_RECEIPT/V1.
 */
function buildLexicalDisagreementReceipt({
  governed_section: governedSectionInput, candidates: candidatesInput, lexicon: lexiconInput = LEXICAL_FAMILY_LEXICON,
} = {}) {
  const governedSection = validateGovernedSection(governedSectionInput);
  requirePlainObject(lexiconInput, 'lexicon');
  requireArray(lexiconInput.entries, 'lexicon.entries');
  const textBytes = Buffer.from(governedSection.text, 'utf8');
  const textByteLength = utf8ByteLength(governedSection.text);
  const candidates = validateCandidates(candidatesInput, {
    sectionRef: governedSection.section_ref, textByteLength,
  });

  const positionMap = buildPositionMap(governedSection.text);
  const normalisedText = normaliseForMatching(governedSection.text);

  const candidateEvidenceByFamily = new Map();
  for (const candidate of candidates) {
    const list = candidateEvidenceByFamily.get(candidate.family) || [];
    for (const edge of candidate.evidence) {
      list.push({ start: edge.start, end: edge.end, closure_id: candidate.closure_id });
    }
    candidateEvidenceByFamily.set(candidate.family, list);
  }

  const entriesByFamily = new Map();
  for (const entry of lexiconInput.entries) {
    const list = entriesByFamily.get(entry.family) || [];
    list.push(entry);
    entriesByFamily.set(entry.family, list);
  }

  // Per-family outcome domain (spec audit M6, pinned): SORTED UNION of
  // (lexicon table keys ∪ families of the passed candidates). Any family
  // outside this domain is LEXICON_FAMILY_UNCOVERED to every consumer by
  // definition -- a missing row can never read as clean.
  const domain = new Set([...entriesByFamily.keys(), ...candidateEvidenceByFamily.keys()]);
  const sortedFamilies = [...domain].sort();

  const familyOutcomes = sortedFamilies.map((family) => {
    const entries = entriesByFamily.get(family);
    if (!entries || entries.length === 0) {
      return Object.freeze({
        family, outcome: 'LEXICON_FAMILY_UNCOVERED', disagreement_set: Object.freeze([]),
        pattern_hit_count: 0, matched_count: 0, unmatched_count: 0, irreproducible_count: 0,
        max_evidence_span_share: 0,
      });
    }
    return matchFamily({
      family, entries, text: governedSection.text, textBytes, positionMap, normalisedText, candidateEvidenceByFamily,
    });
  });

  const counts = {
    families_total: familyOutcomes.length,
    families_all_matched: familyOutcomes.filter((entry) => entry.outcome === 'LEXICAL_ALL_SIGNALS_MATCHED').length,
    families_unmatched_signals: familyOutcomes.filter((entry) => entry.outcome === 'LEXICAL_UNMATCHED_SIGNALS').length,
    families_uncovered: familyOutcomes.filter((entry) => entry.outcome === 'LEXICON_FAMILY_UNCOVERED').length,
    total_pattern_hits: familyOutcomes.reduce((sum, entry) => sum + entry.pattern_hit_count, 0),
    total_matched: familyOutcomes.reduce((sum, entry) => sum + entry.matched_count, 0),
    total_unmatched: familyOutcomes.reduce((sum, entry) => sum + entry.unmatched_count, 0),
    total_irreproducible: familyOutcomes.reduce((sum, entry) => sum + entry.irreproducible_count, 0),
  };

  const receiptBody = {
    schema_version: LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA,
    lexicon_version: lexiconInput.version,
    lexicon_content_hash: lexiconContentHash(lexiconInput),
    section_ref: governedSection.section_ref,
    text_sha256: governedSection.text_sha256,
    candidate_digest: computeCandidateDigest(candidates),
    family_outcomes: familyOutcomes,
    counts,
  };
  const lexicalDisagreementReceiptId = contentId(LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA, receiptBody);

  return Object.freeze({
    ...receiptBody,
    family_outcomes: Object.freeze(familyOutcomes),
    counts: Object.freeze(counts),
    lexical_disagreement_receipt_id: lexicalDisagreementReceiptId,
  });
}

// ---------------------------------------------------------------------------
// Receipt-lookup helper: family outcome (or LEXICON_FAMILY_UNCOVERED-shaped
// synthetic entry when the family is entirely absent from the receipt's own
// domain -- spec audit C1: "a missing row can never read as clean").
// ---------------------------------------------------------------------------
function familyOutcomeFromReceipt(receipt, family) {
  const found = receipt.family_outcomes.find((entry) => entry.family === family);
  if (found) return found;
  return { family, outcome: 'LEXICON_FAMILY_UNCOVERED', disagreement_set: [] };
}

// ═══════════════════════════════════════════════════════════════════════
// 5. Structural receipt validation -- used by BOTH this module's own
// callers and the candidate-resolution.js wiring's "receipt validates
// structurally" check (spec section 5, item 4).
// ═══════════════════════════════════════════════════════════════════════
function isStructurallyValidReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  if (receipt.schema_version !== LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA) return false;
  if (typeof receipt.section_ref !== 'string' || receipt.section_ref.length === 0) return false;
  if (typeof receipt.text_sha256 !== 'string' || receipt.text_sha256.length === 0) return false;
  if (typeof receipt.candidate_digest !== 'string' || receipt.candidate_digest.length === 0) return false;
  if (!Array.isArray(receipt.family_outcomes)) return false;
  for (const entry of receipt.family_outcomes) {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.family !== 'string' || entry.family.length === 0) return false;
    if (!PER_FAMILY_OUTCOMES.includes(entry.outcome)) return false;
    if (!Array.isArray(entry.disagreement_set)) return false;
  }
  if (typeof receipt.lexical_disagreement_receipt_id !== 'string' || receipt.lexical_disagreement_receipt_id.length === 0) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// 6. ABSENT veto (extraction semantics rule 2): a pure helper the future
// ABSENT-deriver will consume. Fail-closed in EVERY branch (spec audit C4):
// missing/mismatching current-state inputs -> RECEIPT_STALE (absence of
// proof of freshness IS staleness); structural failure -> RECEIPT_MALFORMED,
// never `permitted: true`; family uncovered or missing from the outcome
// domain -> LEXICON_FAMILY_UNCOVERED.
// ═══════════════════════════════════════════════════════════════════════
function absentConclusionPermitted({
  receipt, family, current_section_sha256: currentSectionSha256, current_candidate_digest: currentCandidateDigest,
} = {}) {
  if (typeof family !== 'string' || family.length === 0) {
    return Object.freeze({ permitted: false, reason: 'RECEIPT_MALFORMED' });
  }
  if (!isStructurallyValidReceipt(receipt)) {
    return Object.freeze({ permitted: false, reason: 'RECEIPT_MALFORMED' });
  }
  if (typeof currentSectionSha256 !== 'string' || currentSectionSha256.length === 0
    || typeof currentCandidateDigest !== 'string' || currentCandidateDigest.length === 0) {
    return Object.freeze({ permitted: false, reason: 'RECEIPT_STALE' });
  }
  if (receipt.text_sha256 !== currentSectionSha256 || receipt.candidate_digest !== currentCandidateDigest) {
    return Object.freeze({ permitted: false, reason: 'RECEIPT_STALE' });
  }
  const familyOutcome = familyOutcomeFromReceipt(receipt, family);
  if (familyOutcome.outcome === 'LEXICON_FAMILY_UNCOVERED') {
    return Object.freeze({ permitted: false, reason: 'LEXICON_FAMILY_UNCOVERED' });
  }
  if (familyOutcome.outcome === 'LEXICAL_UNMATCHED_SIGNALS') {
    return Object.freeze({ permitted: false, reason: 'LEXICAL_UNMATCHED_SIGNALS' });
  }
  return Object.freeze({ permitted: true });
}

module.exports = {
  LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA,
  LEXICAL_FAMILY_LEXICON_SCHEMA,
  LEXICAL_FAMILY_LEXICON_VERSION,
  LEXICAL_FAMILY_LEXICON,
  PER_FAMILY_OUTCOMES,
  HIT_OFFSET_IRREPRODUCIBLE,
  LexicalDisagreementNetError,
  buildLexicalDisagreementReceipt,
  computeCandidateDigest,
  isStructurallyValidReceipt,
  familyOutcomeFromReceipt,
  absentConclusionPermitted,
  validateLexicalFamilyLexicon,
  validateBoundedRegexPattern,
  BOUNDED_REGEX_MAX_MATCH_LENGTH,
  // Exported for tests that want to exercise pieces directly.
  lexiconContentHash,
  sortedLexiconEntries,
  buildPositionMap,
  scanLiteral,
  byteRangesOverlap,
  mapHitToByteOffsets,
};
