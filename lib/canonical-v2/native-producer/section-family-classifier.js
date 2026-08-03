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
 * STAGE 1 -- DETERMINISTIC TITLE RULES. Ported from, and tested against,
 * the v1 parser's `lib/parser-v2/classify.js` TERMR/TERMF split (~498-521):
 * a title containing "termination" classifies TERMINATION, UNLESS it also
 * matches the fee/expense/effect-of-termination/sole-remedy exclusion --
 * ported verbatim so fee sections (TERMF) never classify TERMINATION and
 * therefore never reach a termination producer. A stage-1 match returns
 * provenance `SECTION_FAMILY_RULE_CLASSIFIED`. This is the ONLY stage-1
 * rule this slice ports; the seam is written so a future family's own
 * title rule is added to `STAGE_1_TITLE_RULES` in that family's own
 * reviewed diff, never invented here.
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
const SECTION_FAMILY_CLASSIFIER_VERSION = 3;

const SECTION_FAMILY_RULE_CLASSIFIED = 'SECTION_FAMILY_RULE_CLASSIFIED';
const SECTION_FAMILY_AI_CLASSIFIED = 'SECTION_FAMILY_AI_CLASSIFIED';
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
const PROXY_MEETING_TITLE_PATTERN = /stockholders?\s+meeting|shareholders?\s+meeting|company\s+meeting|special\s+meeting|meeting\s+of\s+(?:company\s+)?stockholders|^proxy(?:\s+statement)?$|preparation\s+of\s+(?:the\s+)?proxy/i;
const ANTI_TAKEOVER_TITLE_PATTERN = /takeover\s+statutes?|state\s+takeover|business\s+combination\s+statute|section\s+203|no\s+inconsistent\s+action/i;
const ANTITRUST_REGULATORY_TITLE_PATTERN = /filings?\s*,?\s*consents?\s*,?\s*(?:and\s+)?approvals?|antitrust\s+(?:approvals?|cooperation|matters|action)|regulatory\s+(?:cooperation|efforts)|^(?:reasonable\s+best|commercially\s+reasonable|best)\s+efforts\b|^(?:required\s+actions?\b|filings?\s*\.?\s*$|efforts\s*\.?\s*$|further\s+action\s*[;,]\s*efforts\b|hsr\b|consummation\s+of\s+the\s+(?:offer|merger)\b)/i;
const REPRESENTATIONS_TITLE_PATTERN = /representations?\s+and\s+warrant(?:y|ies)/i;
const CONSIDERATION_TITLE_PATTERN = /consideration|treatment\s+of\s+securit|securities?\s+treatment|conversion\s+of\s+(?:the\s+)?(?:shares|stock|securit|capital\s+stock)|exchange\s+(?:and\s+payment|of\s+certificates)|effect\s+(?:of|on)[^,]{0,40}(?:capital\s+stock|securit|merger)|capital\s+stock\s+of\s+the\s+constituent|(?:mixed|cash|stock)\s+election|(?:treatment\s+of\s+)?(?:company\s+)?equity\s+(?:compensation\s+)?awards?|treatment\s+of\s+(?:company\s+)?(?:stock\s+options|restricted\s+stock)|appraisal(?:\s+rights?|\s+proceedings?)?|dissenters?['’]?\s+rights?|withholding\s+rights?|required\s+withholding|adjustments?/i;
const CLOSING_CONDITIONS_TITLE_PATTERN = /\bconditions?\s+(?:to|of|precedent)\b/i;
const IOC_PARENT_INTERIM = /interim\s+operations?\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i;
const IOC_BY_PARENT = /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i;
const IOC_BY_TARGET = /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:company|target|seller)\b/i;
const IOC_PARENT = /(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)['’]?s?\s+business/i;
const IOC_TARGET = /covenants?\s+of\s+(?:the\s+)?(?:company|target|seller)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:company|target|seller)['’]?s?\s+business|interim\s+oper/i;
const IOC_BARE = /^(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\b/i;

// STAGE_1 title rules. Each rule's `test(title)` runs against the
// section's own title text; the first matching rule wins.
const STAGE_1_TITLE_RULES = Object.freeze([
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
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return MAE_DEFINITION_TITLE_PATTERN.test(title);
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
    family: 'REPRESENTATIONS',
    test(title) {
      return typeof title === 'string' && REPRESENTATIONS_TITLE_PATTERN.test(title);
    },
  }),
  Object.freeze({
    family: 'CONSIDERATION',
    test(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return CONSIDERATION_TITLE_PATTERN.test(title);
    },
  }),
]);

function runStage1(title) {
  for (const rule of STAGE_1_TITLE_RULES) {
    if (rule.test(title)) {
      return {
        section_family: rule.family,
        provenance: SECTION_FAMILY_RULE_CLASSIFIED,
        classifier_version: SECTION_FAMILY_CLASSIFIER_VERSION,
        covenant_side: rule.covenant_side || null,
        declined_reason: null,
      };
    }
  }
  return null;
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
  section_reference: sectionReference,
  source_text: sourceText,
  registered_families: registeredFamilies,
  classifier_provider: classifierProvider,
} = {}) {
  const stage1 = runStage1(title);
  if (stage1) return stage1;

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
  SECTION_FAMILY_AI_CLASSIFIED,
  SECTION_FAMILY_AI_UNVERIFIED,
  STAGE_1_TITLE_RULES,
  classifySectionFamily,
};
