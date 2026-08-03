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
const LEXICAL_FAMILY_LEXICON_VERSION = 2;

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

const LEXICAL_FAMILY_LEXICON = Object.freeze({
  schema_version: LEXICAL_FAMILY_LEXICON_SCHEMA,
  version: LEXICAL_FAMILY_LEXICON_VERSION,
  entries: Object.freeze([
    ...REP_T_CAP_PHRASES, ...REP_T_CAP_ACRONYMS,
    ...TERMF_TARGET_PHRASES, ...TERMF_REVERSE_PHRASES, ...TERMF_TAIL_PHRASES,
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
