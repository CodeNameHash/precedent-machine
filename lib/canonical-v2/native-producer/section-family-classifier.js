/**
 * lib/canonical-v2/native-producer/section-family-classifier.js
 *
 * TWO-STAGE, AI-ASSISTED SECTION-FAMILY CLASSIFIER, WITH FLAGGED PROVENANCE
 * (docs/superpowers/specs/2026-08-02-family-termination-rights-design.md
 * section 3, "Native-side section-family classifier" -- BEN RULING
 * 2026-08-02, amending the original title-rules-only design).
 *
 * This module answers exactly one question for one resolved section: which
 * `section_family` (a key into producer-prompt-registry.js) does this
 * section belong to, if any -- and it answers with the provenance of that
 * answer attached, because a title-rule match and a model's guess are not
 * the same epistemic strength and downstream code (receipts, compiled
 * candidates, the review queue) must never conflate them.
 *
 * STAGE 1 -- DETERMINISTIC TITLE RULES. The original entry in
 * `STAGE_1_TITLE_RULES` was ported from, and tested against, the v1
 * parser's `lib/parser-v2/classify.js` TERMR/TERMF split (~498-521):
 * a title containing "termination" classifies TERMINATION, UNLESS it also
 * matches the fee/expense/effect-of-termination/sole-remedy exclusion --
 * ported verbatim so fee sections (TERMF) never classify TERMINATION and
 * therefore never reach a termination producer. A stage-1 match returns
 * provenance `SECTION_FAMILY_RULE_CLASSIFIED`. That TERMINATION/TERMF pair
 * was the ONLY stage-1 rule this slice ported when this header was first
 * written; the seam it established has been reused by every family added
 * since, each in that family's own reviewed diff, never invented here.
 * `STAGE_1_TITLE_RULES` now holds 27 rule entries covering 26 family
 * labels (INTERIM_OPERATING contributes two entries, one per
 * `covenant_side`; TAKEOVER_STATUTE_EXCLUDED is an exclusion-only label,
 * never dispatched to a producer) across the 25 families
 * producer-prompt-registry.js actually registers. This count has gone
 * stale once already -- recount from `STAGE_1_TITLE_RULES` itself before
 * relying on the number in prose anywhere, including here.
 *
 * STAGE 2 -- AI-ASSISTED, INJECTABLE, NEVER SILENT. A section stage 1
 * leaves unmatched MAY be classified by a bounded model call, following
 * the SAME provider-injection discipline as `native-extraction-run.js`'s
 * own `provider` argument: the caller supplies a `classifier_provider`
 * function (a live model call in production, a deterministic stub or
 * `--replay` fixture in tests). This module never calls a model directly
 * and never has a default provider -- no `classifier_provider` means stage
 * 2 is simply skipped (typed decline, not an error, not a guess). A
 * malformed or empty stage-2 response is a TYPED FAILURE, never an empty
 * success: this module never returns a family from a response it cannot
 * validate. A confident, well-formed response returns provenance
 * `SECTION_FAMILY_AI_CLASSIFIED` -- a flag meant to be VISIBLE IN OUTPUT
 * per Ben's ruling, mirroring the existing MECHANICAL/AI/VERIFIED
 * provenance-tag convention used elsewhere in this pipeline.
 *
 * FAIL CLOSED, ALWAYS. Neither stage ever invents a family for an unclear
 * or unregistered section. `classifySectionFamily` returns
 * `{ section_family: null, provenance: null, declined_reason }` whenever
 * classification does not produce a confident answer -- the caller
 * (`native-extraction-run.js`) is responsible for treating a null family
 * as "no producer dispatched", exactly like an unregistered family (see
 * producer-prompt-registry.js's own fail-closed contract). This module
 * does NOT consult the registry itself -- it has no opinion on which
 * families are registered, only on which family a section's text most
 * plausibly belongs to.
 *
 * `SECTION_FAMILY_AI_UNVERIFIED` IS NOT A CLASSIFIER OUTPUT. It is a typed,
 * blocking `unevaluated_conditions`/`reasons` entry exported here for
 * downstream consumers (native-extraction-run.js's receipt,
 * candidate-resolution.js's triage) to attach to every candidate/review
 * item whose governing section carries `SECTION_FAMILY_AI_CLASSIFIED`
 * provenance -- so an AI-classified section's claims can never auto-pass
 * while the classification itself is unverified. Cleared only by a human
 * confirming the family, or a later rule-classified re-run agreeing (both
 * outside this module's scope -- it only emits the typed condition, it
 * never clears it).
 */

'use strict';

const SECTION_FAMILY_CLASSIFIER_SCHEMA = 'NATIVE_SECTION_FAMILY_CLASSIFIER/V1';
const SECTION_FAMILY_CLASSIFIER_VERSION = 7;

const SECTION_FAMILY_RULE_CLASSIFIED = 'SECTION_FAMILY_RULE_CLASSIFIED';
const SECTION_FAMILY_DEFINED_TERM_ANCHORED = 'SECTION_FAMILY_DEFINED_TERM_ANCHORED';
const SECTION_FAMILY_AI_CLASSIFIED = 'SECTION_FAMILY_AI_CLASSIFIED';
const SECTION_FAMILY_MANIFEST_ASSIGNED = 'SECTION_FAMILY_MANIFEST_ASSIGNED';
// Blocking condition, per the file header note above -- exported for
// candidate-resolution.js, never produced as this module's own `provenance`.
const SECTION_FAMILY_AI_UNVERIFIED = 'SECTION_FAMILY_AI_UNVERIFIED';

// STAGE 1 -- deterministic title rules. Each rule's `test(title)` runs
// against the section's own title text (its own heading, or -- matching
// classify.js's article-then-section reading -- the nearest ancestor
// heading when the section itself carries none); the first matching rule
// wins. Ported verbatim from lib/parser-v2/classify.js ~509-521.
// The exact TERMF-titled pattern classify.js ~518 (and the pre-existing
// TERMINATION rule below) already uses to EXCLUDE fee/break-up/expense-
// reimbursement/effect-of-termination/sole-remedy titles from TERMINATION
// (rights). Shared verbatim between the two rules below (never
// re-derived): a title that trips this pattern is exactly the population
// TERMINATION_FEE (this family) exists to claim, and TERMINATION must
// never claim it either -- one pattern, one place, so the two rules can
// never silently drift apart.
const TERMF_TITLE_PATTERN =
  /(?:termination\s+)?fee|break[\s-]*up|expense\s+reimburse|expenses?\s+and\s+other\s+payments?|effect\s+of\s+termination|sole.*remedy/i;
const ADVISORY_FEE_TITLE_PATTERN = /\b(?:finders?|brokers?|advisors?|advisers?|investment\s+bankers?)['’]?\s+fees?\b/i;
const NON_RIGHT_TERMINATION_TITLE_PATTERN = /\btermination\s+of\s+(?:the\s+)?(?:exchange\s+fund|certain\s+agreements?|intercompany\s+contracts?|contracts?|commitments?|plans?|trusts?|insurance)\b/i;

// NO_SHOP (docs/superpowers/specs/2026-08-02-family-no-shop-design.md
// section 3, "this slice's own reviewed diff"): "No Solicitation" / "Non-
// Solicitation" / "No-Shop" titled sections. PAIRED EXCLUSION (mirrors the
// TERMF_TITLE_PATTERN/TERMINATION pairing above): a "Non-Solicitation"
// title is NOT always this family -- ancillary/employment-matters articles
// commonly title a PERSONNEL non-solicitation covenant ("Non-Solicitation
// of Employees", "Non-Solicitation of Customers") the same way, and that is
// a wholly different covenant family this slice does not govern. Both
// patterns are shared constants, never re-derived, so the title rule and
// its own exclusion can never silently drift apart.
const NO_SHOP_TITLE_PATTERN = /no[\s-]?solicitation|non[\s-]?solicitation|no[\s-]?shop/i;
const NO_SHOP_TITLE_EXCLUSION_PATTERN = /employee|personnel|customer/i;

// MAE_DEFINITION (docs/superpowers/specs/2026-08-02-family-mae-definition-
// design.md section 3, "this slice's own reviewed diff"): DELIBERATELY
// NARROW -- only a title that names the MAE/MAC term directly. Corpus
// grounding (this slice's own EDGAR fetches, PROVENANCE.json): the
// Skechers/Modiv MAE definitions sit in generically-titled "Definitions"
// articles, and the TopBuild/QXO definitions are nested INSIDE an
// unrelated-titled rep ("Organization, Good Standing and Qualification")
// with no MAE-specific heading of their own at all -- neither shape is
// title-matchable without a false-positive risk this rule refuses to take
// (a bare "Definitions" title match would misclassify every unrelated
// defined term in that article as this family). This rule therefore only
// ever fires for the rarer deals that title the MAE clause itself (e.g. a
// standalone "Material Adverse Effect" heading/cross-reference cell); every
// other real-world MAE-definition section in this slice's own fixture trio
// reaches this family via stage 2 (AI-assisted) classification instead,
// never stage 1 -- recorded here, not silently assumed solved.
const MAE_DEFINITION_TITLE_PATTERN = /material\s+adverse\s+(effect|change)/i;
const MAE_DEFINED_TERM_PATTERN = /["“]?\s*(?:(?:company|parent|target|business)\s+)?material\s+adverse\s+(?:effect|change)\s*["”]?\s+(?:shall\s+)?means\b/i;
const DEFINED_TERMS_TITLE_PATTERN = /definition/i;
const NO_OTHER_REPS_FRAUD_TITLE_PATTERN = /no\s+other\s+representations|non[\s-]*reliance|anti[\s-]*reliance|exclusivity\s+of\s+representations/i;
const PROXY_MEETING_TITLE_PATTERN = /stockholders?\s+meeting|shareholders?\s+meeting|company\s+meeting|special\s+meeting|meeting\s+of\s+(?:company\s+)?stockholders|^proxy(?:\s+statement)?$|preparation\s+of\s+(?:the\s+)?proxy/i;
const ANTI_TAKEOVER_TITLE_PATTERN = /takeover\s+statutes?|state\s+takeover|business\s+combination\s+statute|section\s+203|no\s+inconsistent\s+action/i;
const ANTITRUST_REGULATORY_TITLE_PATTERN = /filings?\s*,?\s*consents?\s*,?\s*(?:and\s+)?approvals?|antitrust\s+(?:approvals?|cooperation|matters|action)|regulatory\s+(?:cooperation|efforts)|^(?:reasonable\s+best|commercially\s+reasonable|best)\s+efforts\b|^(?:required\s+actions?\b|filings?\s*\.?\s*$|efforts\s*\.?\s*$|further\s+action\s*[;,]\s*efforts\b|hsr\b|consummation\s+of\s+the\s+(?:offer|merger)\b)/i;
const REPRESENTATIONS_TITLE_PATTERN = /representations?\s+and\s+warrant(?:y|ies)/i;
const CONSIDERATION_TITLE_PATTERN = /consideration|treatment\s+of\s+securit|securities?\s+treatment|conversion\s+of\s+(?:the\s+)?(?:shares|stock|securit|capital\s+stock)|exchange\s+(?:and\s+payment|of\s+certificates)|effect\s+(?:of|on)[^,]{0,40}(?:capital\s+stock|securit|merger)|capital\s+stock\s+of\s+the\s+constituent|(?:mixed|cash|stock)\s+election|(?:treatment\s+of\s+)?(?:company\s+)?equity\s+(?:compensation\s+)?awards?|treatment\s+of\s+(?:company\s+)?(?:stock\s+options|restricted\s+stock)|appraisal(?:\s+rights?|\s+proceedings?)?|dissenters?['’]?\s+rights?|withholding\s+rights?|required\s+withholding|adjustments?/i;
const CLOSING_CONDITIONS_TITLE_PATTERN = /\bconditions?\s+(?:to|of|precedent)\b/i;
const TAX_MATTERS_TITLE_PATTERN = /^(?:tax matters|transfer taxes|firpta (?:affidavits?|certificate))/i;
const DIVIDENDS_TITLE_PATTERN = /^(?:dividend matters|dividends?)$/i;
const APPRAISAL_STANDALONE_TITLE_PATTERN = /^(?:(?:dissenting|dissenters?['’]?)\s+(?:shares|rights|proceedings)|appraisal\s+(?:shares|rights|proceedings))$/i;
const EMPLOYEE_MATTERS_TITLE_PATTERN = /employee\s+matters|continuing\s+employees?|employee\s+benefit\s+matters/i;
const DNO_TITLE_PATTERN = /d\s*&\s*o|d&o|indemnification|exculpation|director\s+and\s+officer\s+liability|directors?['’]?\s*(?:and|&)\s*officers?['’]?\s+(?:indemnification|insurance|liability|protection)/i;
const SURVIVING_GOVERNANCE_TITLE_PATTERN = /\b(?:directors?|officers?)\b[^\n]{0,80}\b(?:surviving\s+(?:corporation|company|entity|entities)|merger\s+sub)\b|\b(?:surviving\s+(?:corporation|company|entity|entities)|merger\s+sub)\b[^\n]{0,80}\b(?:directors?|officers?)\b/i;
const IOC_PARENT_INTERIM = /interim\s+operations?\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i;
const IOC_BY_PARENT = /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i;
const IOC_BY_TARGET = /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:company|target|seller)\b/i;
const IOC_PARENT = /(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)['’]?s?\s+business/i;
const IOC_TARGET = /covenants?\s+of\s+(?:the\s+)?(?:company|target|seller)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:company|target|seller)['’]?s?\s+business|interim\s+oper/i;
const IOC_BARE = /^(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\b/i;
const FINANCING_TITLE_PATTERN = /\bfinancing\b/i;
const PAYOFF_TITLE_PATTERN = /payoff\s+(?:letters?|deliverables)|prepayment\s+of\s+indebtedness|repaid\s+indebtedness/i;
const GUARANTY_TITLE_PATTERN = /\bperformance\s+guarant(?:y|ee)\b|guarant(?:y|ee)s?\s+of\s+(?:the\s+)?guarantors?\b|\b(?:parent|holdco)\s+(?:holdco\s+)?guarant(?:y|ee)\b|^\s*(?:(?:section|§)\s*)?[\d.()]*\s*[.:]?\s*(?:limited\s+)?guarant(?:y|ee|ees|ies)\s*\.?\s*$/i;
const CAPITALISATION_TITLE_PATTERN = /^(?:(?:section|article)\s+[A-Z0-9.()]+\s+)?(?:capitali[sz]ation|capital\s+structure)(?:\s*;[^.]*)?\.?$/i;
const MERGER_STRUCTURE_TITLE_PATTERN = /^(?:(?:section|article)\s+[A-Z0-9.()]+\s+)?(?:(?:the\s+)?(?:merger|mergers|closing|closing\s+date|effective\s+time)|consummation\s+of\s+(?:the\s+)?(?:merger|mergers)|certificates?\s+of\s+merger|effects?\s+of\s+(?:the\s+)?(?:merger|mergers)|charter\s+and\s+bylaws?\s+of\s+the\s+surviving\s+(?:corporation|company)|organizational\s+documents?\s+of\s+the\s+surviving\s+(?:corporation|company))\.?$/i;
const MISC_BOILERPLATE_TITLE_PATTERN = /^(?:(?:section|article)\s+[A-Z0-9.()]+\s+)?(?:notices?|assignment|amendments?|modification\s+or\s+amendment|waiver(?:\s+of\s+conditions)?|counterparts?|governing\s+law(?:\s+and\s+venue)?(?:;\s*waiver\s+of\s+jury\s+trial)?|submission\s+to\s+jurisdiction(?:;\s*waivers?)?|waiver\s+of\s+jury\s+trial|entire\s+agreement(?:;\s*third[- ]party\s+beneficiaries)?|no\s+third[- ]party\s+beneficiaries|severability)\.?$/i;
const SPECIFIC_PERFORMANCE_TITLE_PATTERN = /\bspecific\s+performance\b|^(?:equitable\s+)?remedies\.?$|^equitable\s+relief\.?$/i;

function isBodyPollutedHeading(title) {
  if (typeof title !== 'string') return false;
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words.length > 30
    || (title.length > 90 && /\b(?:shall|there\s+(?:is|are)|has\s+not|have\s+not|except\s+as|as\s+of)\b/i.test(title))
    || /[.!?]\s+(?:a|an|as|except|each|the|there|parent|company)\b/i.test(title)
    || /\.\s*\([a-z0-9ivx]+\)\s+(?:as|except|the|there|each|parent|company)\b/i.test(title);
}

// STAGE_1 title rules. Each rule's `test(title)` runs against the
// section's own title text. The set-returning detector retains every
// justified family after the explicit ownership exclusions below.
const STAGE_1_TITLE_RULES = Object.freeze([
  Object.freeze({
    family: 'MERGER_STRUCTURE_CLOSING',
    test: (title) => typeof title === 'string'
      && (MERGER_STRUCTURE_TITLE_PATTERN.test(title.trim()) || SURVIVING_GOVERNANCE_TITLE_PATTERN.test(title)),
  }),
  Object.freeze({ family: 'DNO_INDEMNIFICATION', test: (title) => typeof title === 'string' && DNO_TITLE_PATTERN.test(title) }),
  Object.freeze({ family: 'EMPLOYEE_MATTERS', test: (title) => typeof title === 'string' && EMPLOYEE_MATTERS_TITLE_PATTERN.test(title) && !/d\s*&\s*o|d&o|director|officer/i.test(title) }),
  Object.freeze({ family: 'APPRAISAL_DISSENTERS_RIGHTS', test: (title, articleContext) => typeof title === 'string' && APPRAISAL_STANDALONE_TITLE_PATTERN.test(title.trim()) && !['CONSIDERATION', 'EXCHANGE'].includes(articleContext) }),
  Object.freeze({ family: 'TAX_MATTERS', test: (title) => typeof title === 'string' && TAX_MATTERS_TITLE_PATTERN.test(title.trim()) }),
  Object.freeze({ family: 'DIVIDENDS', test: (title) => typeof title === 'string' && DIVIDENDS_TITLE_PATTERN.test(title.trim()) }),
  Object.freeze({
    family: 'GUARANTY_FINANCING_PARTY',
    test(title, articleContext) {
      if (typeof title !== 'string' || !GUARANTY_TITLE_PATTERN.test(title)) return false;
      return !['DEFINITIONS', 'CONDITIONS', 'INTERIM_OPERATING'].includes(articleContext);
    },
  }),
  Object.freeze({
    family: 'FINANCING_COVENANTS',
    test(title, articleContext) {
      if (typeof title !== 'string' || /financing\s+sources?|non[- ]recourse|no\s+recourse/i.test(title)) return false;
      if (PAYOFF_TITLE_PATTERN.test(title)) return true;
      return FINANCING_TITLE_PATTERN.test(title) && articleContext !== 'REPRESENTATIONS';
    },
  }),
  Object.freeze({
    family: 'NO_OTHER_REPS_FRAUD',
    test(title) {
      return typeof title === 'string' && NO_OTHER_REPS_FRAUD_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    family: 'PROXY_MEETING',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return PROXY_MEETING_TITLE_PATTERN.test(title.replace(/[;:,.]+$/, ''));
    },
  }),
  Object.freeze({ family: 'INTERIM_OPERATING', covenant_side: 'BUYER', test: (title) => typeof title === 'string' && (IOC_PARENT_INTERIM.test(title) || IOC_BY_PARENT.test(title) || IOC_PARENT.test(title)) }),
  Object.freeze({ family: 'INTERIM_OPERATING', covenant_side: 'TARGET', test: (title) => typeof title === 'string' && (IOC_BY_TARGET.test(title) || IOC_TARGET.test(title) || IOC_BARE.test(title)) }),
  Object.freeze({
    family: 'CLOSING_CONDITIONS',
    test(title) {
      return typeof title === 'string' && CLOSING_CONDITIONS_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    // This exclusion must precede the generic regulatory rule. A state
    // takeover-statute representation is not a regulatory-efforts covenant.
    family: 'TAKEOVER_STATUTE_EXCLUDED',
    test(title) { return typeof title === 'string' && ANTI_TAKEOVER_TITLE_PATTERN.test(title); },
  }),
  Object.freeze({
    family: 'ANTITRUST_REGULATORY',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (/regulatory\s+matters/i.test(title)) return false;
      return ANTITRUST_REGULATORY_TITLE_PATTERN.test(title);
    },
  }),
  // TERMINATION_FEE (docs/superpowers/specs/2026-08-02-family-termination-
  // fee-design.md section 3, "register any new producer" -- this slice's
  // own reviewed diff): fee/break-up/expense-reimbursement/effect-of-
  // termination/sole-remedy titles, whether or not the title also contains
  // the bare word "termination". Ordered BEFORE the TERMINATION rule below
  // so a fee-titled section (which would otherwise simply fail that rule's
  // own exclusion and classify as null/unmatched) is claimed by its own
  // family instead -- this is the missing half of the pre-existing TERMF
  // exclusion: excluding fee titles from TERMINATION was only ever correct
  // once fee titles had somewhere else to go.
  Object.freeze({
    family: 'TERMINATION_FEE',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (ADVISORY_FEE_TITLE_PATTERN.test(title)) return false;
      return TERMF_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    family: 'TERMINATION',
    // classify.js ~518: the TERMF exclusion -- fee/break-up/expense-
    // reimbursement/effect-of-termination/sole-remedy titles are NOT
    // TERMINATION (rights) sections, even though they sit in a
    // "termination"-titled article. (Those titles are now claimed by the
    // TERMINATION_FEE rule above, which runs first.)
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (!/termination\b/i.test(title)) return false;
      if (NON_RIGHT_TERMINATION_TITLE_PATTERN.test(title)) return false;
      if (TERMF_TITLE_PATTERN.test(title)) {
        return false;
      }
      return true;
    },
  }),
  Object.freeze({
    family: 'NO_SHOP',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (!NO_SHOP_TITLE_PATTERN.test(title)) return false;
      if (NO_SHOP_TITLE_EXCLUSION_PATTERN.test(title)) return false;
      return true;
    },
  }),
  Object.freeze({
    family: 'MAE_DEFINITION',
    test(title, _articleContext, sourceText) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (!MAE_DEFINITION_TITLE_PATTERN.test(title)) return false;
      return typeof sourceText !== 'string' || sourceText.length === 0
        || MAE_DEFINED_TERM_PATTERN.test(sourceText);
    },
  }),
  Object.freeze({
    family: 'KEY_DEFINED_TERMS',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return DEFINED_TERMS_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    family: 'MATERIAL_CONTRACTS',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return /^(?:(?:section|article)\s+[A-Z0-9.()]+\s+)?(?:material\s+)?contracts?\.?$/i.test(title.trim());
    },
  }),
  Object.freeze({
    family: 'CAPITALISATION',
    test(title) {
      return typeof title === 'string' && CAPITALISATION_TITLE_PATTERN.test(title.trim());
    },
  }),
  Object.freeze({
    family: 'REPRESENTATIONS',
    test(title) {
      return typeof title === 'string'
        && (REPRESENTATIONS_TITLE_PATTERN.test(title) || ADVISORY_FEE_TITLE_PATTERN.test(title));
    },
  }),
  Object.freeze({
    family: 'SPECIFIC_PERFORMANCE_REMEDIES',
    test(title) {
      return typeof title === 'string' && SPECIFIC_PERFORMANCE_TITLE_PATTERN.test(title.trim());
    },
  }),
  Object.freeze({
    family: 'MISC_BOILERPLATE',
    test(title) {
      return typeof title === 'string' && MISC_BOILERPLATE_TITLE_PATTERN.test(title.trim());
    },
  }),
  Object.freeze({
    family: 'CONSIDERATION',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      if (/^tax\s+considerations?\.?$/i.test(title.trim())) return false;
      return CONSIDERATION_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    family: 'GENERAL_COVENANTS',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return /^(?:(?:section|article)\s+[A-Z0-9.()]+\s+)?(?:access\s+to\s+information|books\s+and\s+records\s+access|public\s+announcements?(?:\s*;\s*disclosure)?|press\s+releases?|publicity|takeover\s+laws?|notification\s+of\s+certain\s+matters|stockholder\s+litigation|transaction\s+litigation|section\s+16(?:\s+matters)?|rule\s+16b-3|director\s+resignations?|board\s+resignations?|delisting(?:\s+and\s+deregistration)?|stock\s+exchange\s+listing|further\s+assurances?|post-closing\s+sec\s+reports?|treatment\s+of\s+existing\s+indebtedness|merger\s+sub\s+(?:compliance|covenants?|obligations?)|delivery\s+of\s+written\s+consents?|paying\s+agent|exchange\s+agent|cvr\s+agreement|fda\s+communications?)\.?$/i.test(title.trim());
    },
  }),
]);

function classification(family, provenance, covenantSide = null) {
  return {
    section_family: family,
    provenance,
    classifier_version: SECTION_FAMILY_CLASSIFIER_VERSION,
    covenant_side: covenantSide,
    declined_reason: null,
  };
}

function mergeClassification(byFamily, candidate) {
  const existing = byFamily.get(candidate.section_family);
  if (!existing) {
    byFamily.set(candidate.section_family, candidate);
  }
}

function classifyRuleSectionFamilies(title, articleContext = null, sourceText = null) {
  if (isBodyPollutedHeading(title)) return [];
  const byFamily = new Map();
  for (const rule of STAGE_1_TITLE_RULES) {
    if (rule.test(title, articleContext, sourceText)) {
      mergeClassification(byFamily, classification(
        rule.family,
        SECTION_FAMILY_RULE_CLASSIFIED,
        rule.covenant_side || null,
      ));
    }
  }

  if (byFamily.has('TAKEOVER_STATUTE_EXCLUDED')) {
    byFamily.delete('TAKEOVER_STATUTE_EXCLUDED');
    byFamily.delete('ANTITRUST_REGULATORY');
  }
  if (byFamily.has('APPRAISAL_DISSENTERS_RIGHTS')) byFamily.delete('CONSIDERATION');
  if (byFamily.has('NO_OTHER_REPS_FRAUD')) byFamily.delete('REPRESENTATIONS');
  if (byFamily.has('MAE_DEFINITION') && !DEFINED_TERMS_TITLE_PATTERN.test(String(title || ''))) {
    byFamily.delete('KEY_DEFINED_TERMS');
  }
  return [...byFamily.values()];
}

function adaptDeterministicFamilySetToSingleClassification(classifications) {
  return Array.isArray(classifications) && classifications.length > 0
    ? classifications[0]
    : null;
}

function runStage1(title, articleContext = null, sourceText = null) {
  return adaptDeterministicFamilySetToSingleClassification(
    classifyRuleSectionFamilies(title, articleContext, sourceText),
  );
}

function declineResult(reason, extra = {}) {
  return {
    section_family: null,
    provenance: null,
    classifier_version: SECTION_FAMILY_CLASSIFIER_VERSION,
    covenant_side: null,
    declined_reason: reason,
    ...extra,
  };
}

function classifyDeterministicSectionFamilies({
  title,
  article_context: articleContext = null,
  source_text: sourceText,
} = {}) {
  if (isBodyPollutedHeading(title)) return Object.freeze([]);
  const classifications = classifyRuleSectionFamilies(title, articleContext, sourceText);
  const byFamily = new Map(classifications.map((item) => [item.section_family, item]));
  if (typeof sourceText === 'string' && /"Marketing\s{1,3}Period"\s+(?:shall\s+)?means?\b/.test(sourceText)) {
    mergeClassification(byFamily, classification(
      'FINANCING_COVENANTS',
      SECTION_FAMILY_DEFINED_TERM_ANCHORED,
    ));
  }
  if (typeof sourceText === 'string' && MAE_DEFINED_TERM_PATTERN.test(sourceText)) {
    mergeClassification(byFamily, classification(
      'MAE_DEFINITION',
      SECTION_FAMILY_DEFINED_TERM_ANCHORED,
    ));
  }
  return Object.freeze([...byFamily.values()].map((item) => Object.freeze(item)));
}

function classifyDeterministicSectionFamily(args = {}) {
  return adaptDeterministicFamilySetToSingleClassification(
    classifyDeterministicSectionFamilies(args),
  );
}

/**
 * Runs stage 1, then stage 2 (only if stage 1 did not match and a
 * `classifier_provider` was supplied). Never throws for a provider error
 * or a malformed response -- both are typed declines (see file header).
 *
 * @param {object} args
 * @param {string} args.title                the section's own title/heading
 *   text (or nearest-ancestor heading), used by stage 1's rules
 * @param {string} [args.section_reference]  passed through to stage 2 only
 * @param {string} [args.source_text]        passed through to stage 2 only
 * @param {string[]} [args.registered_families] passed through to stage 2
 *   only, so a stage-2 provider can be told which families are actually
 *   dispatchable (informational -- this module never filters on it itself)
 * @param {(input: object) => (Promise<object>|object)} [args.classifier_provider]
 *   injected stage-2 classifier (a live model call, a stub, or a --replay
 *   fixture). Omit to skip stage 2 entirely.
 * @returns {Promise<{section_family: string|null, provenance: string|null,
 *   classifier_version: number, declined_reason: string|null}>}
 */
async function classifySectionFamily({
  title,
  article_context: articleContext = null,
  section_reference: sectionReference,
  source_text: sourceText,
  registered_families: registeredFamilies,
  classifier_provider: classifierProvider,
} = {}) {
  if (isBodyPollutedHeading(title)) {
    return declineResult('BODY_POLLUTED_HEADING');
  }
  const deterministic = classifyDeterministicSectionFamily({
    title,
    article_context: articleContext,
    source_text: sourceText,
  });
  if (deterministic) return deterministic;

  if (typeof classifierProvider !== 'function') {
    return declineResult('NO_STAGE_2_PROVIDER');
  }

  let response;
  try {
    response = await classifierProvider({
      title: typeof title === 'string' ? title : null,
      section_reference: sectionReference,
      source_text: sourceText,
      registered_families: Array.isArray(registeredFamilies) ? registeredFamilies : [],
    });
  } catch (error) {
    return declineResult('STAGE_2_PROVIDER_ERROR', { error: error && error.message ? error.message : String(error) });
  }

  if (!response || typeof response !== 'object') {
    return declineResult('STAGE_2_MALFORMED_RESPONSE');
  }
  if (response.declined === true) {
    return declineResult('STAGE_2_DECLINED');
  }
  if (typeof response.section_family !== 'string' || response.section_family.length === 0) {
    return declineResult('STAGE_2_MALFORMED_RESPONSE');
  }

  return {
    section_family: response.section_family,
    provenance: SECTION_FAMILY_AI_CLASSIFIED,
    classifier_version: SECTION_FAMILY_CLASSIFIER_VERSION,
    covenant_side: null,
    declined_reason: null,
  };
}

module.exports = {
  SECTION_FAMILY_CLASSIFIER_SCHEMA,
  SECTION_FAMILY_CLASSIFIER_VERSION,
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
  SECTION_FAMILY_AI_CLASSIFIED,
  SECTION_FAMILY_MANIFEST_ASSIGNED,
  SECTION_FAMILY_AI_UNVERIFIED,
  STAGE_1_TITLE_RULES,
  adaptDeterministicFamilySetToSingleClassification,
  runStage1,
  classifyDeterministicSectionFamilies,
  classifyDeterministicSectionFamily,
  classifySectionFamily,
};
