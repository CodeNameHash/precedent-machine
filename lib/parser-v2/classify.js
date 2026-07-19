/**
 * classify.js — Phase 2: Section classification for the v2 parser.
 *
 * Classifies each segmented section into a provision type from the rubric.
 * Uses a two-pass approach:
 *   1. Deterministic pre-classification (regex) for high-confidence patterns only
 *   2. AI classification (Claude) for everything else, with article context
 *
 * After classification, estimates complexity per section.
 *
 * CommonJS module for Next.js API-route compatibility.
 */

const { PROVISION_TYPES, CODES } = require('../rubric');
const { MODEL } = require('../model');
const { parseJSON } = require('./parse-json');
const { sectionTextHash } = require('./snapshot');
const { canonicalIocCategoryFromHeading } = require('../vocab/ioc-categories');

// ---------------------------------------------------------------------------
// 1. DETERMINISTIC PRE-CLASSIFICATION
//    Only ~10 patterns that NEVER misfire. Everything else goes to AI.
// ---------------------------------------------------------------------------

/**
 * Detects a dollar figure of at least $1,000,000 anywhere in text —
 * "$326,000,000", "$1,000,000", "$50 million", "$1.2 billion". One of three
 * independent fee-substance signals (see hasFeeSubstance below).
 */
function hasLargeDollarAmount(text) {
  const re = /\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion)?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    let value = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isNaN(value)) continue;
    if (/billion/i.test(m[2] || '')) value *= 1e9;
    else if (/million/i.test(m[2] || '')) value *= 1e6;
    if (value >= 1000000) return true;
  }
  return false;
}

/**
 * Body-content discriminator for generic expense-allocation titles ("Fees
 * and Expenses", "Expenses", "Expense Reimbursement", "(Company/Parent)
 * Termination Fee(s)"). The SAME title is used both for genuine
 * each-party-bears-its-own-expenses boilerplate (CSRA 278 chars, Metsera 323
 * chars — both must stay MISC) and for buried real termination fees (Red Hat
 * 9.6, Kraft 8.05, Bioverativ 9.04(b) — a $326,000,000 fee — plus Prometheus
 * 8.3 / Skechers 8.3, all real TERMF), REGARDLESS of which article the
 * section sits in. PR #67's body check only ran inside TERMINATION articles,
 * which missed Red Hat/Kraft/Bioverativ because their fee sections sit in a
 * different article (MISC/COV) — title alone can't decide, and neither can
 * the article, only the body can.
 *
 * Three independent signals, any one of which is sufficient:
 *   1. a defined "Termination Fee" / "Company Termination Fee" term (or
 *      "break-up fee"),
 *   2. a dollar amount of at least $1,000,000,
 *   3. payable-upon/following-termination language.
 */
/**
 * Content-signal fallback for the NOSOL no-shop covenant when no title rule
 * matches (SecureWorks/Sophos: the operative "shall not ... initiate,
 * solicit, facilitate or knowingly encourage the making of any Acquisition
 * Proposal" covenant sits under a heading no title pattern catches). Applied
 * in classifySections' Pass 2.8, and ONLY when the section would otherwise
 * be COV or MISC — never overrides a more specific type. Exported so the
 * corpus-wide safety-check script and tests share the exact production
 * pattern.
 */
const NOSOL_CONTENT_RE = /(shall not|agrees? not to)[\s\S]{0,200}(solicit|initiate|knowingly encourage)[\s\S]{0,120}Acquisition Proposal/i;

function hasFeeSubstance(text) {
  const t = text || '';
  if (!t) return false;
  if (/["“]?(?:company\s+|parent\s+)?termination\s+fee["”]?|break[\s-]*up\s+fee/i.test(t)) return true;
  if (/payable[^.]{0,120}\b(?:upon|following|after|in\s+the\s+event\s+of|as\s+a\s+result\s+of|on)\b[^.]{0,40}\btermination\b/i.test(t)) return true;
  if (/\btermination\b[^.]{0,60}\bpayable\b/i.test(t)) return true;
  return hasLargeDollarAmount(t);
}

const DETERMINISTIC_RULES = [
  // No-solicitation / No-shop. Covers tender-offer-style M&A where these
  // appear inside a generic "Covenants" article instead of their own section.
  // overrideArticle: NOSOL routinely sits in a COV article — its dedicated
  // title is unambiguous, so always honor it.
  // "Unsolicited Proposals" is Sanofi/Bioverativ's title for the no-shop
  // (Section 6.02, 15k chars of classic no-solicitation mechanics) — without
  // it the deal had ZERO NOSOL provisions.
  // NOSOL-M / NOSOL-B MUST be checked before the generic NOSOL rule below —
  // they're the same no-solicitation family, but party-scoped for
  // reciprocal / reverse-merger "merger of equals"-style deals (both sides
  // give a no-shop, or the deal is genuinely mutual). The generic NOSOL rule
  // stays the DEFAULT (target-side, unchanged) so the overwhelming majority
  // of single-party deals keep classifying exactly as before.
  { pattern: /mutual\s+non[\s-]*solicitation|reciprocal\s+non[\s-]*solicitation|no[\s-]*(?:solicitation|shop)\s+by\s+(?:either|both|each\s+of\s+the)\s+part(?:y|ies)|mutual\s+no[\s-]*shop/i, type: 'NOSOL-M', overrideArticle: true },
  { pattern: /no[\s-]*(?:solicitation|shop)\s+by\s+(?:parent|buyer|acqui\w+)|(?:parent|buyer|acqui\w+)['’]?s?\s+non[\s-]*solicitation|reverse\s+no[\s-]*shop|(?:parent|buyer|acqui\w+)\s+(?:acquisition|takeover)\s+proposals?|(?:parent|buyer|acqui\w+)\s+(?:adverse|board)\s+recommendation/i, type: 'NOSOL-B', overrideArticle: true },
  // "Solicitation; Change in Recommendation" (Frontier/Verizon) — the
  // no-shop's title omits the "No-" prefix the rule above requires. Bare
  // \bsolicitation\b (no "no"/"non-" gate) plus \bacquisition\s+proposals?\b
  // catch these title variants; both are anchored to the title only (never
  // the body), so unrelated prose can't misfire. Verified against all 40
  // deals' section titles (see tests/nosol-title-solicitation.test.js and
  // the corpus-wide safety-check script) — only Frontier's "Solicitation;
  // Change in Recommendation" title newly matches; no other section flips.
  { pattern: /no[\s-]*(?:solicitation|shop)|unsolicited\s+proposals?|acquisition\s+proposals?|takeover\s+proposals?|alternative\s+(?:transactions?|proposals?)|company\s+(?:adverse|board)\s+recommendation|adverse\s+recommendation\s+change|\bsolicitation\b/i, type: 'NOSOL', overrideArticle: true },
  // Interim Operating Covenants — "Covenants of the Company" / "Conduct of
  // Business of the Company" / "Operation of the Company's Business" /
  // "Interim Operations". Catches IOC sections dumped into a consolidated
  // "Covenants" article (typical tender-offer style and Landos-style).
  // Party-suffixed "Interim Operations of Parent" (TopBuild §4.2) MUST be
  // checked before the bare `interim oper` catch below, which would
  // otherwise stamp the PARENT's operating covenants IOC-T (QXO/TopBuild:
  // all of Parent's §4.2 covenants rendered on the Company side).
  { pattern: /interim\s+operations?\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i, type: 'IOC-B', overrideArticle: true },
  { pattern: /covenants?\s+of\s+(?:the\s+)?(?:company|target|seller)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:company|target|seller)['’]?s?\s+business|interim\s+oper/i, type: 'IOC-T', overrideArticle: true },
  { pattern: /covenants?\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)['’]?s?\s+business/i, type: 'IOC-B', overrideArticle: true },
  // Looser conduct-section titles the rules above miss (title-only matching,
  // so prose can't false-positive). Party-specific first, then the bare
  // "Conduct of Business" (Starwood 4.1) that sits in a generic COVENANTS
  // article; Anadarko titles its IOC "Conduct of the Company" (5.1) /
  // "Conduct of Parent" (6.1) with no trailing "business".
  // "Conduct of Business BY Parent [and Merger Sub]" (CSRA/General Dynamics
  // §5.2, Modiv/GNL) — the by-phrased party variant; without it these titles
  // fall through to the bare "Conduct of Business" rule below and default
  // IOC-T even though the heading names the acquirer.
  { pattern: /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i, type: 'IOC-B', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  { pattern: /(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\s+by\s+(?:the\s+)?(?:company|target|seller)\b/i, type: 'IOC-T', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  { pattern: /(?:conduct|operation)s?\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)\b/i, type: 'IOC-B', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  { pattern: /(?:conduct|operation)s?\s+of\s+(?:the\s+)?(?:company|target|seller)\b/i, type: 'IOC-T', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  { pattern: /^(?:conduct|operation)s?\s+of\s+(?:the\s+)?business(?:es)?\b/i, type: 'IOC-T', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // PE-style interim-operations articles split the conduct covenant into
  // "Affirmative Obligations" (5.1) + "Forbearance Covenants" (5.2) instead
  // of one "Conduct of Business" section (Skechers/3G-style drafting; Kraft
  // writes party-prefixed "Heinz Forbearances"/"Kraft Forbearances", which
  // its IOC article already covers). Title-anchored exact matches; the
  // "(b) Forbearance." SUB-heading inside an Absence-of-Changes rep is not a
  // section title, and the REP guard keeps rep sections un-yankable.
  { pattern: /^affirmative\s+obligations?\s*\.?\s*$/i, type: 'IOC-T', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  { pattern: /^forbearances?(?:\s+covenants?)?\s*\.?\s*$/i, type: 'IOC-T', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // Party-suffixed umbrella rep sections: "Representations and Warranties of
  // Parent and Sub" (Red Hat 3.02) sits inside a party-less
  // "REPRESENTATIONS AND WARRANTIES" article that defaults to REP-T — the
  // section title must win. (Entity-named variants like "of Marriott" are
  // handled positionally by the rep-ordering fixup in classifySections.)
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+|purchaser|merger\s+sub)/i, type: 'REP-B', overrideArticle: true },
  // Takeover statutes / Section 203 DGCL / "No Inconsistent Action" w/r/t
  // anti-takeover statutes. MUST come BEFORE the ANTI rule below since the
  // ANTI pattern matches "no inconsistent action" generically. We use the
  // dedicated COV-TAKEOVER code so the per-provision view can pick up the
  // takeover-specific schema.
  // Guarded so true antitrust headings ("antitrust action", "antitrust efforts")
  // don't accidentally match. notInArticle: don't fire inside REP articles —
  // "no inconsistent action" generic phrasing shows up in REP sections too.
  { pattern: /takeover\s+statutes?|state\s+takeover|business\s+combination\s+statute|section\s+203(?:\s+of\s+the\s+dgcl)?|no\s+inconsistent\s+action/i, type: 'COV', code: 'COV-TAKEOVER', guardNot: /antitrust/i, notInArticle: ['REP-T', 'REP-B'] },
  // Antitrust / regulatory-efforts covenant titled "Filings, Consents, and
  // Approvals" / "Antitrust Approvals" / "Regulatory Cooperation" — sits
  // inside the Covenants article in almost every modern M&A agreement
  // (e.g. Landos Section 5.5). The generic ANTI pattern below defers to the
  // COV article (default) so this section silently collapses into COV. With
  // overrideArticle: true the specific antitrust-cooperation title wins over
  // the parent COV article, but we still skip REP articles so Article III's
  // "Regulatory Matters" rep doesn't get yanked into ANTI.
  { pattern: /filings?\s*,?\s*consents?\s*,?\s*(?:and\s+)?approvals?|antitrust\s+(?:approvals?|cooperation|matters|action)|regulatory\s+(?:cooperation|efforts)|reasonable\s+best\s+efforts\s+to\s+(?:obtain|consummate)/i, type: 'ANTI', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // A section TITLED "Reasonable Best Efforts" (± "; Notification") is the
  // antitrust/regulatory-efforts covenant by drafting convention — it must
  // beat its parent COV article (Metsera 6.03 was swallowed as generic COV
  // "Further Assurances", leaving the deal with ZERO ANTI provisions and an
  // empty Regulatory Efforts section). Title-anchored so prose can't misfire.
  { pattern: /^(?:reasonable\s+best|commercially\s+reasonable|best)\s+efforts\b/i, type: 'ANTI', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // Deal-specific titles for the SAME regulatory-efforts covenant, each
  // verified against every deal's section titles to hit ONLY the efforts/
  // HSR package (all previously collapsed into generic COV, leaving those
  // deals with ZERO ANTI provisions):
  //   "Required Action and Forbearance; Efforts" (Skechers 6.1) /
  //   "Required Actions" (Kraft 6.03 — takeover statute + HSR efforts),
  //   "Filings" (Skechers 6.2 — the HSR/foreign-antitrust filings package),
  //   "Efforts" (Bioverativ 6.10), "Further Action; Efforts" (Verve 6.6),
  //   "HSR and Other Approvals" (Concho 6.8),
  //   "Consummation of the Offer and the Merger" (CSRA 6.3).
  // Title-anchored ($-terminated where the word alone is generic) so
  // "SEC Filings" / "Certain Filings" / "Proxy Statement Filing" reps and
  // covenants can't be yanked; REP guard belt-and-suspenders on top.
  { pattern: /^(?:required\s+actions?\b|filings?\s*\.?\s*$|efforts\s*\.?\s*$|further\s+action\s*[;,]\s*efforts\b|hsr\b|consummation\s+of\s+the\s+(?:offer|merger)\b)/i, type: 'ANTI', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // Antitrust / HSR / regulatory efforts (includes "Reasonable Best Efforts" section).
  // Belt-and-suspenders: explicitly do NOT fire inside REP articles — a section
  // titled "Regulatory Matters" or "Regulatory Approvals" inside Article III
  // (Company Reps) is a REP, not an ANTI provision.
  { pattern: /antitrust|HSR\b|hart[\s-]*scott|(?:reasonable\s+)?best\s+efforts|regulatory\s+(?:approval|matters|filings)|filings.*(?:cooperation|notification)|further\s+action[;,\s]+efforts/i, type: 'ANTI', notInArticle: ['REP-T', 'REP-B'] },
  // Definitions — exact title match
  { pattern: /^definitions?\s*$/i, type: 'DEF', matchOn: 'title', overrideArticle: true },
  // Governing law
  { pattern: /governing\s+law/i, type: 'MISC', overrideArticle: true },
  // Boilerplate MISC
  { pattern: /severab|counterpart|waiver\s+of\s+jury/i, type: 'MISC', overrideArticle: true },
  {
    pattern: /^amendments?(?:\s+and\s+waivers?)?\s*\.?\s*$/i,
    type: 'MISC',
    code: 'MISC-AMEND',
    overrideArticle: true,
    notInArticle: ['REP-T', 'REP-B'],
  },
  {
    pattern: /^(?:extension\s*;\s*waiver|waivers?(?:\s+and\s+extensions?)?)\s*\.?\s*$/i,
    type: 'MISC',
    code: 'MISC-WAIVER',
    overrideArticle: true,
    notInArticle: ['REP-T', 'REP-B'],
  },
  // Generic expense/termination-fee-allocation titles — "Fees and Expenses"
  // (Red Hat 5.06, Kraft 6.08), "Fees; Expenses" (Bioverativ 9.04(b) —
  // $326,000,000 — Bioverativ punctuates with a semicolon, not "and"),
  // "Expenses" (LabCorp/Covance 5.06), "Expense Reimbursement", "(Company/
  // Parent) Termination Fee(s)". These titles cover BOTH genuine
  // each-party-bears-its-own boilerplate (CSRA 278 chars, Metsera 323 chars
  // — must stay MISC) and real buried termination fees (Anadarko 10.5,
  // Mr. Cooper 10.5, Prometheus 8.3, Skechers 8.3 — must be TERMF), in EVERY
  // article those deals happen to park the section in (MISC, COV,
  // TERMINATION — title and article both lie). hasFeeSubstance() reads the
  // BODY to decide; overrideArticle so it fires ahead of a strong-typed
  // parent article. Exact anchored title so prose mentioning "expenses"
  // elsewhere can't match; REP guard belt-and-suspenders since these titles
  // never denote a rep.
  {
    pattern: /^fees?\s*(?:and|[,;])\s*expenses\s*\.?\s*$|^expenses\s*\.?\s*$|^expense\s+reimbursements?\s*\.?\s*$|^(?:company\s+|parent\s+)?termination\s+(?:fees?|payments?)\s*\.?\s*$/i,
    overrideArticle: true,
    notInArticle: ['REP-T', 'REP-B'],
    resolve(section) {
      return hasFeeSubstance(section.text || '')
        ? { type: 'TERMF' }
        : { type: 'MISC', code: 'MISC-EXPENSES' };
    },
  },
  // Tender-offer condition annexes ("Annex I — Conditions to the Offer":
  // CSRA, Verve, Bioverativ, Pharmasset). These sit OUTSIDE any article
  // (or inherit a stray STRUCT article), so without a title rule the AI
  // types them inconsistently and the offer conditions never reach the
  // COND extractor. Offer conditions are buyer accept-conditions → COND-B.
  { pattern: /^conditions?\s+to\s+the\s+offer\s*\.?\s*$/i, type: 'COND-B', overrideArticle: true, notInArticle: ['REP-T', 'REP-B'] },
  // Specific performance
  { pattern: /specific\s+performance/i, type: 'MISC', overrideArticle: true },
  // Consideration-mechanics sections inside a STRUCT-titled article.
  // Skechers folds "Effect of Merger on Company Common Stock", "Mixed
  // Election Procedures", "Exchange of Certificates" etc. under one
  // Article II titled "THE MERGER" — the article inherits STRUCT and,
  // without a section-level rule, the whole consideration package is
  // mis-typed STRUCT (CONSID=0) with the unmatched sections surfacing as
  // "[PROPOSED]". Section-level mirror of the article-level CONSID pattern,
  // anchored to consideration-mechanics titles so plain "Effects of the
  // Merger" (genuinely STRUCT) can't match.
  // "Effect on Capital Stock" (no "of the Merger") and "Conversion of
  // Capital Stock" are the same consideration-mechanics section (Red Hat
  // 2.01, Mr. Cooper 1.4, Prometheus 2.7, Anadarko 1.4 — the latter three
  // sat in a STRUCT-titled "The Merger" article and were typed STRUCT,
  // leaving CONSID=0 on those deals).
  { pattern: /effect\s+(?:of|on)\s+(?:the\s+)?merger\s+on|^effect\s+on\s+(?:the\s+)?capital\s+stock\b|conversion\s+of\s+(?:the\s+)?(?:shares|stock|securit|capital\s+stock)|payment\s+for\s+securities;?\s*exchange|exchange\s+and\s+payment|exchange\s+of\s+certificates|(?:mixed|cash|stock)\s+election|lost,?\s+stolen\s+or\s+destroyed\s+certificates|no\s+appraisal\s+rights?|no\s+further\s+ownership\s+rights|no\s+dividends?\s+or\s+distributions|withholding\s+rights?|required\s+withholding|^(?:merger\s+)?consideration\s*\.?\s*$/i, type: 'CONSID', overrideArticle: true },
  // Equity-award treatment is consideration wherever it sits.
  { pattern: /^(?:treatment\s+of\s+)?(?:company\s+)?equity\s+(?:compensation\s+)?awards?\s*\.?\s*$|treatment\s+of\s+(?:company\s+)?(?:stock\s+options|equity\s+(?:compensation\s+)?awards?|restricted\s+stock)/i, type: 'CONSID', overrideArticle: true },
  // "The Merger" exact title → STRUCT
  { pattern: /^(?:the\s+)?merger\s*$/i, type: 'STRUCT', matchOn: 'title', overrideArticle: true },
  // Effective time → STRUCT
  { pattern: /effective\s+time/i, type: 'STRUCT', overrideArticle: true },

];

// ── Stage 2: sub-code REFINEMENT rules ──
// These only stamp a more-specific `code` on a section AFTER its parent type
// has been determined (by article context or AI). They never override an
// already-classified type. Stamping CONSID-PAYAGENT on a section that's
// genuinely CONSID is fine; but force-routing a CONSID-article "Appraisal
// Rights" section to COV is a regression — it strips the data from the
// CONSID rendering and orphans it under a generic COV view.
//
// To match: section title matches `pattern` AND the resolved type matches
// `whenType`. Output: add `code` to the existing classification. Order of
// rules is preserved; first match wins per (type, section).
const SUBCODE_REFINEMENT_RULES = [
  // Tender-offer mechanics inside an article titled "The Offer" (Verve,
  // CSRA, Bioverativ, Pharmasset). These remain STRUCT rows, but need a
  // distinct code from one-step "The Merger" mechanics.
  { pattern: /^(?:the\s+)?offer\b|^company\s+(?:actions?|consent)\b|schedule\s+14d-9|stockholder\s+lists?/i, whenType: 'STRUCT', code: 'STRUCT-OFFER' },
  // CONSID family
  { pattern: /contingent\s+value\s+rights?|\bcvr\b/i, whenType: 'CONSID', code: 'CONSID-CVR' },
  { pattern: /\bcollar\b/i, whenType: 'CONSID', code: 'CONSID-COLLAR' },
  { pattern: /ticking\s+fee|per[\s-]*diem\s+fee/i, whenType: 'CONSID', code: 'CONSID-TICKING' },
  { pattern: /exchange\s+ratio/i, whenType: 'CONSID', code: 'CONSID-EXCHANGE-RATIO' },
  { pattern: /walkaway|market[\s-]*out/i, whenType: 'CONSID', code: 'CONSID-WALKAWAY' },
  // Appraisal & paying-agent: these sit in the CONSID article in most
  // standard merger agreements — stamp as CONSID sub-codes when found there.
  // Only refine to COV if the section is already classified COV.
  { pattern: /appraisal(?:\s+rights?|\s+proceedings?)?|dissenters?\s+rights?/i, whenType: 'CONSID', code: 'CONSID-APPRAISAL' },
  { pattern: /appraisal(?:\s+rights?|\s+proceedings?)?|dissenters?\s+rights?/i, whenType: 'COV', code: 'COV-APPRAISAL' },
  { pattern: /paying\s+agent|exchange\s+agent|disbursing\s+agent/i, whenType: 'CONSID', code: 'CONSID-PAYAGENT' },
  { pattern: /paying\s+agent|exchange\s+agent|disbursing\s+agent/i, whenType: 'COV', code: 'COV-PAYAGENT' },
  // COV family
  { pattern: /marketing\s+period/i, whenType: 'COV', code: 'COV-MARKETING' },
  { pattern: /indemnification\s+(?:of|and)\s+(?:directors|officers)|d\s*&\s*o\s+(?:indemnification|insurance)|directors?\s+and\s+officers?\s+(?:indemnification|insurance)/i, whenType: 'COV', code: 'COV-DO' },
  { pattern: /stockholders?\s+meeting|shareholders?\s+meeting|company\s+meeting|special\s+meeting|meeting\s+of\s+(?:company\s+)?stockholders/i, whenType: 'COV', code: 'COV-MEETING' },
  { pattern: /^proxy(?:\s+statement)?$|preparation\s+of\s+(?:the\s+)?proxy|special\s+meeting/i, whenType: 'COV', code: 'COV-PROXY' },
  // P7 item 17: Parent adoption (sole-stockholder of MergerSub, written consent).
  { pattern: /^(?:approval\s+of\s+the\s+merger|adoption\s+(?:of\s+(?:this\s+)?agreement|by\s+(?:sole\s+)?stockholder))/i, whenType: 'COV', code: 'COV-SHAPRV-PARENT' },
  // P7 item 18: stamp COND-FRUSTRATE when the section title matches the
  // anti-frustration heading. The bare type ('COND') is already assigned by
  // tryDeterministic when the title contains "frustrat".
  { pattern: /frustrat(?:ion)?\s+of\s+(?:closing\s+)?conditions?|no\s+(?:party\s+)?(?:reli|excuse).*failure\s+of\s+(?:a\s+)?condition/i, whenType: 'COND', code: 'COND-FRUSTRATE' },
  // TERMF family
  { pattern: /antitrust\s+(?:reverse\s+)?termination\s+fee|regulatory\s+termination\s+fee|reverse\s+termination\s+fee.*antitrust/i, whenType: 'TERMF', code: 'TERMF-RTF-ANTI' },
  { pattern: /(?:acquirer|buyer|parent)\s+expense\s+reimburse|expense\s+reimbursement/i, whenType: 'TERMF', code: 'TERMF-REIMBURSE' },
  // REP-B family
  { pattern: /sufficient\s+funds|available\s+funds|sufficient\s+cash/i, whenType: 'REP-B', code: 'REP-B-FUNDS' },
  { pattern: /\bsolvenc/i, whenType: 'REP-B', code: 'REP-B-SOLVENCY' },
  { pattern: /\bsubsidiar/i, whenType: 'REP-B', code: 'REP-B-SUBSIDIARIES' },
  { pattern: /real\s+propert(?:y|ies)|leased\s+propert(?:y|ies)|owned\s+propert(?:y|ies)/i, whenType: 'REP-B', code: 'REP-B-REALPROPERTY' },
  { pattern: /anti[\s-]*reliance|non[\s-]*reliance|exclusivity\s+of\s+representations|no\s+other\s+representations/i, whenType: 'REP-B', code: 'REP-B-ANTIRELIANCE' },
  // Anti-reliance language sometimes lives outside REP-B (typically in COV
  // "No Other Representations" or in MISC). Still stamp the REP-B-ANTIRELIANCE
  // code so the ExpectedRepsTable can find it across types.
  { pattern: /anti[\s-]*reliance|non[\s-]*reliance|exclusivity\s+of\s+representations|no\s+other\s+representations/i, whenType: 'COV', code: 'REP-B-ANTIRELIANCE' },
  { pattern: /anti[\s-]*reliance|non[\s-]*reliance|exclusivity\s+of\s+representations|no\s+other\s+representations/i, whenType: 'MISC', code: 'REP-B-ANTIRELIANCE' },
  // MetsFB2: the Company-side "No Other Representations and Warranties" /
  // "Non-Reliance" section (in the Company reps article) gets its own
  // canonical code so the Abry fields land on it rather than being dropped.
  { pattern: /anti[\s-]*reliance|non[\s-]*reliance|exclusivity\s+of\s+representations|no\s+other\s+representations/i, whenType: 'REP-T', code: 'REP-T-NOREP' },
  // REP-T family
  { pattern: /sufficiency\s+of\s+assets/i, whenType: 'REP-T', code: 'REP-T-SUFFICIENCY' },
  { pattern: /top\s+customers|top\s+suppliers|significant\s+customers|major\s+customers/i, whenType: 'REP-T', code: 'REP-T-TOP-CUSTOMERS' },
  { pattern: /material\s+contracts|significant\s+contracts/i, whenType: 'REP-T', code: 'REP-T-MATERIAL-CONTRACTS' },
  // DEF family
  { pattern: /^environmental\s+claims?\s*$/i, whenType: 'DEF', code: 'DEF-ENVIRONMENTAL-CLAIMS' },
];

function refineSubCode(section, resolvedType) {
  if (!resolvedType) return null;
  const title = extractTitle(section.title || section.heading || '');
  if (!title) return null;
  for (const rule of SUBCODE_REFINEMENT_RULES) {
    if (rule.whenType !== resolvedType) continue;
    if (rule.pattern.test(title)) return rule.code;
  }
  return null;
}

// Article-level classification: map article titles to the provision type
// family that all sections within that article belong to.
const ARTICLE_TYPE_MAP = [
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+(?:of\s+)?(?:the\s+)?(?:company|target|seller)/i, type: 'REP-T' },
  // A reps article whose title names the MERGER SUB is the buyer side even
  // when the parties are otherwise entity-named ("Representations and
  // Warranties of Heinz, Merger Sub I and Merger Sub II" — Kraft). Only the
  // acquirer has a merger sub, so this can't misfire on a target reps
  // article; without it the generic REP-T default below + the positional
  // ordering fixup INVERTED the parties on Kraft, whose buyer reps come
  // FIRST (Article III) and target reps second (Article IV).
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*[^\n]{0,80}?\bmerger\s+sub/i, type: 'REP-B' },
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+(?:of\s+)?(?:the\s+)?(?:parent|buyer|acqui|investor|purchaser)/i, type: 'REP-B' },
  { pattern: /represent\w*\s+(?:and\s+)?warrant/i, type: 'REP-T' }, // default to target; rep-ordering-fixup re-tags 2nd+ as REP-B
  // Party-suffixed IOC types: the heading explicitly names whose conduct is
  // covered ("Conduct of Business of the Company" / "Conduct of Parent's
  // Business"). Generic "Conduct of Business" without a party falls through
  // to IOC-T (the default — ~all M&A agreements only have Target IOC).
  { pattern: /(?:conduct|operation)\s+of\s+(?:the\s+)?(?:company|target|seller)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:company|target|seller)['’]?s?\s+business/i, type: 'IOC-T' },
  { pattern: /(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui)|(?:conduct|operation)\s+of\s+(?:the\s+)?(?:parent|buyer|acqui\w+)['’]?s?\s+business/i, type: 'IOC-B' },
  { pattern: /(?:conduct|operation)\s+of\s+business|interim\s+operat|(?:conduct|operation)\s+prior/i, type: 'IOC-T' },
  // Tender-offer Annex I / "Offer Conditions" — these are the buyer's
  // conditions to consummate a tender offer. Must come before the generic
  // conditions rule to be tagged distinctly.
  { pattern: /annex\s+I\b|offer\s+conditions|conditions\s+(?:to|of)\s+(?:the\s+)?offer/i, type: 'COND' },
  { pattern: /conditions?\s+(?:to|of|precedent)|conditions?\s+(?:to\s+)?(?:the\s+)?(?:closing|merger|obligations?)/i, type: 'COND' },
  { pattern: /termination\b/i, type: 'TERMINATION' }, // split into TERMR/TERMF at section level
  // CONSID must come BEFORE STRUCT — many article titles include "merger"
  // (e.g. "Effect of the Merger on the Capital Stock"), and we want those to
  // win as CONSID rather than STRUCT.
  { pattern: /consideration|treatment\s+of\s+securit|securities?\s+treatment|conversion\s+of\s+shares|exchange\s+of\s+certificates|effect\s+(?:of|on)[^,]{0,40}(?:capital\s+stock|securit|merger)|capital\s+stock\s+of\s+the\s+constituent/i, type: 'CONSID' },
  { pattern: /(?:additional\s+)?(?:covenants?|agreements?)/i, type: 'COV' },
  // STRUCT — deal mechanics. Catches both standard "The Merger" articles and
  // tender-offer "The Offer" articles (which describe offer commencement,
  // expiration, acceptance, top-up options, etc.).
  { pattern: /(?:the\s+)?merger|structure|mechanics|^\s*the\s+offer\b|^\s*offer\s*$/i, type: 'STRUCT' },
  { pattern: /definition/i, type: 'DEF' },
  { pattern: /miscellaneous|general\s+provisions/i, type: 'MISC' },
];

function classifyArticle(articleTitle) {
  if (!articleTitle) return null;
  for (const rule of ARTICLE_TYPE_MAP) {
    if (rule.pattern.test(articleTitle)) return rule.type;
  }
  return null;
}

// Convert roman numerals to arabic for article lookup
const ROMAN_TO_ARABIC = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9,
  X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};
function normalizeArticleNumber(num) {
  if (!num) return null;
  const upper = String(num).toUpperCase();
  if (ROMAN_TO_ARABIC[upper]) return String(ROMAN_TO_ARABIC[upper]);
  return String(num);
}

/**
 * Extracts a clean title from a section heading (strips numbering).
 */
function extractTitle(heading) {
  if (!heading) return '';
  return heading
    .replace(/^(?:Section\s+)?[\d]+\.[\d]+[\.\s]*/i, '')
    .replace(/^\(?\s*[a-z]\s*\)\s*/i, '')
    .replace(/\.\s*$/, '')
    .trim();
}

function explicitIocCategory(section) {
  const title = extractTitle(section && (section.title || section.heading || ''));
  const titleHit = canonicalIocCategoryFromHeading(title);
  if (titleHit) return titleHit;

  const text = String((section && section.text) || '');
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
  const headingLike = firstLine
    .replace(/^SECTION\s+\d+(?:\.\d+)*\s*/i, '')
    .replace(/^\(?[a-z0-9ivx]+\)?\s*/i, '')
    .replace(/\.\s.*$/, '')
    .trim();
  return canonicalIocCategoryFromHeading(headingLike);
}

/**
 * Attempt deterministic classification on a single section.
 * Uses both section-level rules and article-level context.
 * Returns { type, confidence } or null if no deterministic match.
 *
 * IMPORTANT: Section-level rules only match against the TITLE (not body text),
 * because section bodies routinely reference unrelated concepts (e.g., a COND
 * section mentions "Effective Time", a DEF section defines "Severability").
 */
function tryDeterministic(section, articleType) {
  const title = extractTitle(section.title || section.heading || '');

  // Item 9: when we have strong article context (one of the canonical body
  // types), the article wins over the section-level title regex. Section-level
  // regex rules become a fallback for sections that lack article context. This
  // prevents a section like "Regulatory Matters" inside Article III "Reps and
  // Warranties of the Company" from being yanked into ANTI by the generic
  // regulatory pattern.
  //
  // Two carve-outs:
  //   (a) DEF — definitions are routinely standalone; never fight the title
  //   (b) deterministic rules that explicitly opt out via `notInArticle: []`
  const STRONG_ARTICLE_TYPES = new Set(['REP-T', 'REP-B', 'IOC', 'IOC-T', 'IOC-B', 'COV', 'STRUCT', 'CONSID', 'DEF', 'MISC']);
  const articleWinsForType = articleType && STRONG_ARTICLE_TYPES.has(articleType);

  // Section-level rules — title-only matching to avoid false positives
  for (const rule of DETERMINISTIC_RULES) {
    if (rule.pattern.test(title)) {
      if (rule.guardNot && rule.guardNot.test(title)) continue;
      // A rule tagged as risky inside this article type never fires there —
      // for ANY known article type, strong or not (e.g. the MISC-EXPENSES
      // rule opting out of TERMINATION articles, where "Fees and Expenses"
      // is usually the termination-fee section).
      if (articleType && Array.isArray(rule.notInArticle) && rule.notInArticle.includes(articleType)) continue;
      // If the section sits inside a strong-typed article, defer to
      // article-level classification below unless the rule explicitly opts
      // in via `overrideArticle: true` (e.g. specific-performance MISC
      // inside a COV article).
      if (articleWinsForType && !rule.overrideArticle) continue;
      // A `resolve` rule computes its type/code dynamically from the section
      // BODY rather than a static type — used where the title alone is
      // ambiguous (e.g. hasFeeSubstance() for the generic expense-allocation
      // titles above). If resolve declines to produce a result, fall through
      // and keep scanning the remaining rules rather than treating the title
      // match as a dead end.
      if (typeof rule.resolve === 'function') {
        const resolved = rule.resolve(section, articleType);
        if (resolved) return { confidence: 'high', ...resolved };
        continue;
      }
      const result = { type: rule.type, confidence: 'high' };
      if (rule.code) result.code = rule.code;
      return result;
    }
  }

  // Article-level context: if we know the article type, use it
  if (articleType) {
    // For TERMINATION articles, distinguish TERMR vs TERMF from section title
    if (articleType === 'TERMINATION') {
      // Generic expense-allocation titles ("Fees and Expenses" / "Expenses" /
      // "Expense Reimbursement" / "(Company/Parent) Termination Fee(s)") are
      // handled by the body-aware `resolve` rule in DETERMINISTIC_RULES above
      // — it fires in every article (including this one), so those titles
      // never reach this branch.
      // "Expenses and Other Payments" is Concho 8.3 — 10k chars of Company
      // Termination Fee triggers dressed in an expenses title.
      if (/(?:termination\s+)?fee|break[\s-]*up|expense\s+reimburse|expenses?\s+and\s+other\s+payments?|effect\s+of\s+termination|sole.*remedy/i.test(title)) {
        return { type: 'TERMF', confidence: 'high' };
      }
      return { type: 'TERMR', confidence: 'high' };
    }

    // For COND articles, detect party from section title
    if (articleType === 'COND') {
      const sectionHeader = (section.text || '').substring(0, 300);
      const articleTitle = section.articleTitle || section.article || '';
      // Tender-offer "Offer Conditions" / Annex I — these are buyer-only
      // conditions for accepting tendered shares.
      if (/offer\s+conditions|conditions?\s+(?:to|of)\s+(?:the\s+)?offer|annex\s+I\b/i.test(articleTitle) ||
          /offer\s+conditions|conditions?\s+(?:to|of)\s+(?:the\s+)?offer/i.test(title)) {
        return { type: 'COND-B', confidence: 'high' };
      }
      if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:each|both|all)\s+part/i.test(sectionHeader)) return { type: 'COND-M', confidence: 'high' };
      if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:company|target|seller)/i.test(sectionHeader)) return { type: 'COND-S', confidence: 'high' };
      if (/(?:obligations?\s+of\s+)?(?:the\s+)?(?:buyer|parent|acqui|investor|purchaser|merger\s+sub)/i.test(sectionHeader)) return { type: 'COND-B', confidence: 'high' };
      if (/frustrat/i.test(title)) return { type: 'COND', confidence: 'high' };
      return { type: 'COND-M', confidence: 'medium' };
    }

    // Direct article type mapping for unambiguous types
    if (['REP-T', 'REP-B', 'IOC', 'IOC-T', 'IOC-B', 'COV', 'STRUCT', 'CONSID', 'DEF', 'MISC'].includes(articleType)) {
      return { type: articleType, confidence: 'high' };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 2. AI CLASSIFICATION
//    Single batched call per deal. Prompt includes article context, rubric
//    types, and party-detection instructions.
// ---------------------------------------------------------------------------

/**
 * Build the provision type reference list for the AI prompt.
 */
function buildTypeReference() {
  return PROVISION_TYPES.map(t => {
    const codes = Object.entries(CODES)
      .filter(([, v]) => v.type === t.key)
      .map(([code, v]) => `${code}: ${v.label}`)
      .slice(0, 5); // keep prompt concise, show top 5 codes per type
    const codeStr = codes.length > 0 ? ` [e.g. ${codes.join('; ')}]` : '';
    return `- ${t.key}: ${t.label} — ${t.description}${codeStr}`;
  }).join('\n');
}

/**
 * Build a section summary for the AI prompt.
 */
function buildSectionSummary(section, index) {
  const title = extractTitle(section.title || section.heading || '');
  const text = section.text || '';
  const charCount = text.length;

  // First 500 chars + last 200 chars for long sections
  let preview;
  if (charCount > 800) {
    preview = text.substring(0, 500) + '\n[...]\n' + text.substring(charCount - 200);
  } else {
    preview = text;
  }

  return {
    index,
    sectionNumber: section.sectionNumber || section.number || '',
    title,
    articleTitle: section.articleTitle || section.article || '',
    charCount,
    preview: preview.substring(0, 750), // safety cap
  };
}

/**
 * Build the classification prompt.
 */
function buildPrompt(sectionSummaries) {
  const typeRef = buildTypeReference();

  return `You are a senior M&A attorney classifying sections of a merger agreement into provision types.

## Provision Types

${typeRef}

## Critical Classification Rules

1. **Article context is essential for COND sections.** If a section sits under an article titled "Conditions to the Merger" or "Conditions Precedent to the Merger", it is a COND section — do NOT classify it as REP or COV.

2. **Party detection for COND:**
   - "Conditions to Obligations of Parent" / "Conditions to Obligations of Buyer" / "Conditions to Buyer's Obligation" → COND-B
   - "Conditions to Obligations of the Company" / "Conditions to Obligations of Seller" / "Conditions to Target's Obligation" → COND-S
   - "Conditions to Obligations of Each Party" / "Conditions to the Merger" (mutual) → COND-M
   - Use the ARTICLE title to determine party when the section title is ambiguous (e.g., "Accuracy of Representations" under "Conditions to Buyer's Obligations" = COND-B)

3. **Party detection for REP:**
   - REP-T: Section is within an article about "Representations and Warranties of the Company" / "...of the Target" / "...of Seller"
   - REP-B: Section is within an article about "Representations and Warranties of Parent" / "...of Buyer" / "...of Acquiror"
   - Use the ARTICLE title — individual rep section titles (e.g. "Organization", "Authority") do not indicate party

4. **Party detection for IOC (REQUIRED — pick the suffix):**
   - **IOC-T** (target/company side): "Conduct of Business of the Company" /
     "Conduct of Company's Business" / "Interim Operations" / generic
     "Conduct of Business" with no party named (this is the default — ~all
     M&A agreements only have Target IOC, so when in doubt classify IOC-T).
   - **IOC-B** (buyer/parent side): "Conduct of Parent's Business" /
     "Conduct of Buyer's Business" / "Covenants of Parent". Use when the
     article EXPLICITLY scopes to the buyer/parent.
   - DO NOT emit bare "IOC" — always use IOC-T or IOC-B so the sidebar's
     Company / Target vs Buyer / Parent children render correctly.

4b. **Party detection for NOSOL (default stays bare "NOSOL" — do NOT rename it away):**
   - Plain "No-Solicitation" / "No-Shop" sections with no party named — or
     naming only the Company/Target — are the DEFAULT and MUST be classified
     as bare **NOSOL** (this is the overwhelming majority of deals; do not
     use NOSOL-T for these).
   - **NOSOL-B**: ONLY when the section is EXPLICITLY scoped to the
     buyer/parent's own no-solicitation obligation (a reverse no-shop) — e.g.
     "No Solicitation by Parent", "Parent Non-Solicitation".
   - **NOSOL-M**: ONLY when the obligation is EXPLICITLY mutual/reciprocal —
     e.g. "Mutual Non-Solicitation", "No Solicitation by Either Party".
   - When in doubt, use bare NOSOL.

5. **COND (no suffix):** Only for condition modifiers like "Frustration of Conditions" or "Tax Opinion" conditions — NOT for actual closing conditions

6. **TERMR vs TERMF:** TERMR = termination rights/triggers. TERMF = fees, expenses, effect of termination, sole remedy

7. **COV:** Additional agreements, covenants, access, proxy, employee matters, indemnification — NOT conditions or reps

8. **DEF:** Sections that primarily define terms. If a section IS a definitions article, classify as DEF.

## Sections to Classify

${JSON.stringify(sectionSummaries, null, 2)}

## Response Format

Return ONLY a valid JSON array (no markdown fences, no commentary):
[
  {
    "sectionNumber": "7.01",
    "provisionType": "COND-M",
    "confidence": "high",
    "reasoning": "Under Article VII: Conditions; mutual conditions to each party's obligations"
  }
]

Rules:
- Every section in the input MUST appear in the output
- Use the index field to track sections
- provisionType must be one of: ${PROVISION_TYPES.map(t => t.key).join(', ')}
- confidence must be "high", "medium", or "low"
- For genuinely unclear sections, use MISC with confidence "low"
- Keep reasoning to 1-2 sentences max`;
}

/**
 * Parse the AI response JSON, with fallback handling.
 * Delegates to the shared prose-tolerant extractor (parse-json.js), which
 * handles fences, prose preambles/trailers, and light truncation, returning
 * null on unrecoverable input.
 */
function parseAIResponse(rawText) {
  return parseJSON(rawText);
}

/**
 * Classify unresolved sections via AI in a single batched call.
 *
 * @param {Object[]} sections - Sections needing AI classification
 * @param {Object[]} articles - Article-level context (titles, numbers)
 * @param {Object} client - Anthropic SDK client instance
 * @returns {Map<number, Object>} Map from section index to classification result
 */
async function classifyWithAI(sections, articles, client) {
  if (sections.length === 0) return new Map();

  // Enrich sections with article titles if not already present
  const enriched = sections.map((s, i) => {
    const summary = buildSectionSummary(s, i);

    // If section doesn't have an articleTitle but we have articles, find it
    if (!summary.articleTitle && articles && articles.length > 0) {
      const sNum = summary.sectionNumber;
      if (sNum) {
        const articleNum = sNum.split('.')[0];
        const article = articles.find(a =>
          String(a.number) === articleNum ||
          String(a.articleNumber) === articleNum
        );
        if (article) {
          summary.articleTitle = article.title || article.heading || '';
        }
      }
    }

    return summary;
  });

  const prompt = buildPrompt(enriched);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = resp.content.map(c => c.text || '').join('');
  const parsed = parseAIResponse(rawText);

  const resultMap = new Map();

  if (parsed && Array.isArray(parsed)) {
    for (const item of parsed) {
      // Match by index (primary) or sectionNumber (fallback)
      let idx = item.index;
      if (idx === undefined || idx === null) {
        // Try to find by sectionNumber
        idx = enriched.findIndex(s => s.sectionNumber === item.sectionNumber);
      }
      if (idx >= 0 && idx < sections.length) {
        // Validate provision type. Anything that doesn't map to a known
        // rubric type falls back to OTHER (not MISC) — MISC is reserved for
        // genuine boilerplate (governing law, severability, etc.) and is
        // handled by deterministic rules. OTHER guarantees no section is
        // orphaned without classification.
        const validTypes = PROVISION_TYPES.map(t => t.key);
        const provType = validTypes.includes(item.provisionType) ? item.provisionType : 'OTHER';
        const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium';

        resultMap.set(idx, {
          provisionType: provType,
          confidence,
          reasoning: item.reasoning || '',
        });
      }
    }
  }

  // Fill in any sections that the AI missed. Use OTHER (not MISC) so the
  // coverage stays at 100% without misclassifying as boilerplate.
  for (let i = 0; i < sections.length; i++) {
    if (!resultMap.has(i)) {
      resultMap.set(i, {
        provisionType: 'OTHER',
        confidence: 'low',
        reasoning: 'AI did not return a classification for this section',
      });
    }
  }

  return resultMap;
}

// ---------------------------------------------------------------------------
// 3. COMPLEXITY ESTIMATION
// ---------------------------------------------------------------------------

/**
 * Count (a)/(b)/(c)-style sub-items in section text.
 */
function countSubItems(text) {
  if (!text) return 0;
  return (text.match(/\n\s*\([a-z]{1,3}\)\s/gi) || []).length;
}

/**
 * Estimate complexity for a classified section.
 *
 * High: MAE, NOSOL, ANTI, or sections with 5+ sub-items AND 3000+ chars
 * Medium: sections with 3+ sub-items OR 3000+ chars
 * Low: everything else
 */
function estimateComplexity(section) {
  const type = section.provisionType;
  const text = section.text || '';
  const charCount = text.length;
  const subItems = countSubItems(text);

  // High-complexity types regardless of size
  const highComplexityTypes = ['NOSOL', 'NOSOL-T', 'NOSOL-B', 'NOSOL-M', 'ANTI'];
  if (highComplexityTypes.includes(type)) return 'high';

  // Check for MAE — either as a type or if the section title/text references MAE definition
  if (type === 'DEF') {
    const title = extractTitle(section.title || section.heading || '');
    if (/material\s+adverse\s+effect|MAE\b/i.test(title)) return 'high';
  }

  // Size-based thresholds
  if (subItems >= 5 && charCount >= 3000) return 'high';
  if (subItems >= 3 || charCount >= 3000) return 'medium';

  return 'low';
}

// ---------------------------------------------------------------------------
// 4. MAIN EXPORT: classifySections
// ---------------------------------------------------------------------------

/**
 * Classify all sections into provision types.
 *
 * @param {Object[]} sections - Segmented sections from Phase 1
 * @param {Object[]} articles - Article-level metadata (titles, numbers)
 * @param {Object} client - Anthropic SDK client instance
 * @param {Object} [opts] - { prior?: Map<textHash, {provisionType, provisionCode, confidence}> }
 *   `prior` (built from a stored classified_sections snapshot via
 *   lib/parser-v2/snapshot.js buildPriorLookup) short-circuits the AI pass:
 *   a section the deterministic rules leave open reuses its previous
 *   classification when its normalized text matches (classifiedBy: 'cache').
 *   Deterministic rules always run first — rule changes take effect on every
 *   section regardless of cache.
 * @returns {Object[]} Classified sections with provisionType, confidence, classifiedBy, complexity
 */
async function classifySections(sections, articles, client, opts = {}) {
  if (!sections || sections.length === 0) return [];
  const prior = opts && opts.prior instanceof Map ? opts.prior : null;

  // ── Pass 0: Classify articles to establish context ──
  // Keyed by normalized (arabic) article number so section "7.01" can lookup article "VII"
  const articleTypes = {};
  if (articles) {
    for (const art of articles) {
      const artKey = normalizeArticleNumber(art.number || art.articleNumber);
      const artTitle = art.title || art.articleTitle || art.heading || '';
      const artType = classifyArticle(artTitle);
      if (artKey && artType) articleTypes[artKey] = artType;
    }
  }

  // ── Pass 1: Deterministic pre-classification (section rules + article context) ──
  const deterministic = [];   // { index, type }
  const needsAI = [];         // { index, section }

  for (let i = 0; i < sections.length; i++) {
    // Find this section's article type
    const sectionNum = sections[i].number || sections[i].sectionNumber || '';
    // For annex pseudo-sections (number "Annex-I"), articleNumber/articleTitle
    // come from the section directly. For normal sections, derive the article
    // number from the prefix before the first dot.
    let articleType = null;
    if (sections[i].isAnnex || /^Annex-/i.test(sectionNum)) {
      // For annex pseudo-sections, classify based on the annex's OWN title
      // (e.g., "CONDITIONS TO THE OFFER"). Do NOT inherit the article-number
      // collision with an existing body article (e.g., body Article I "THE
      // OFFER" would otherwise drag an "Annex I — Offer Conditions" into
      // STRUCT).
      articleType = classifyArticle(sections[i].articleTitle || '');
    } else {
      const articleNum = sectionNum.split('.')[0];
      articleType = articleTypes[articleNum] || null;
    }

    const result = tryDeterministic(sections[i], articleType);
    if (result) {
      deterministic.push({ index: i, type: result.type, code: result.code || null, confidence: result.confidence || 'high' });
    } else {
      needsAI.push({ index: i, section: sections[i] });
    }
  }

  // ── Pass 1.5: prior-snapshot cache ──
  // Sections the deterministic pass left open reuse their previous
  // classification when the (normalized) text is unchanged. Only genuinely
  // new/changed sections fall through to the AI pass below.
  const cached = []; // { index, hit }
  if (prior && prior.size > 0 && needsAI.length > 0) {
    for (let n = needsAI.length - 1; n >= 0; n--) {
      const { index, section } = needsAI[n];
      const hit = prior.get(sectionTextHash(section.text || section.body || ''));
      if (hit && hit.provisionType) {
        cached.push({ index, hit });
        needsAI.splice(n, 1);
      }
    }
  }

  // ── Pass 2: AI classification for remaining sections (batched in groups of 30) ──
  const aiSections = needsAI.map(item => item.section);
  const aiResults = new Map();
  const batchSize = 30;
  for (let b = 0; b < aiSections.length; b += batchSize) {
    const batch = aiSections.slice(b, b + batchSize);
    const batchResults = await classifyWithAI(batch, articles, client);
    for (const [localIdx, result] of batchResults) {
      aiResults.set(b + localIdx, result);
    }
  }

  // ── Assemble results ──
  const classified = new Array(sections.length);

  // Apply deterministic results
  for (const { index, type, code, confidence } of deterministic) {
    classified[index] = {
      ...sections[index],
      provisionType: type,
      ...(code ? { provisionCode: code } : {}),
      confidence: confidence || 'high',
      classifiedBy: 'regex',
    };
  }

  // Apply cached (prior-snapshot) results
  for (const { index, hit } of cached) {
    classified[index] = {
      ...sections[index],
      provisionType: hit.provisionType,
      ...(hit.provisionCode ? { provisionCode: hit.provisionCode } : {}),
      confidence: hit.confidence || 'medium',
      classifiedBy: 'cache',
    };
  }

  // Apply AI results
  for (let ai = 0; ai < needsAI.length; ai++) {
    const { index } = needsAI[ai];
    const result = aiResults.get(ai);
    classified[index] = {
      ...sections[index],
      provisionType: result.provisionType,
      confidence: result.confidence,
      classifiedBy: 'ai',
    };
  }

  // ── Pass 2.5: REP article ordering fixup ──
  // Some agreements have a generic "REPRESENTATIONS AND WARRANTIES" article
  // title (no party suffix) for the buyer's reps — typically the SECOND
  // representations article in the document. The default rule in
  // ARTICLE_TYPE_MAP tags such articles as REP-T. Walk the article list in
  // document order: once we have seen a REP-T article, any subsequent
  // article whose computed type is also REP-T but whose title did NOT
  // explicitly name the company/target/seller is reassigned to REP-B, and
  // every section attributed to that article is re-tagged accordingly.
  if (articles && articles.length > 0) {
    const orderedArticles = [...articles].sort((a, b) => {
      const sa = a.startChar ?? a.start ?? 0;
      const sb = b.startChar ?? b.start ?? 0;
      return sa - sb;
    });
    let sawRepT = false;
    const repBArticleKeys = new Set();
    for (const art of orderedArticles) {
      const artTitle = art.title || art.articleTitle || art.heading || '';
      const artType = classifyArticle(artTitle);
      if (artType !== 'REP-T') continue;
      // If the title explicitly names the target/company/seller, keep as REP-T
      const explicitTarget = /(?:company|target|seller)/i.test(artTitle);
      if (!sawRepT) {
        sawRepT = true;
        continue;
      }
      if (explicitTarget) continue;
      // Reassign this article (and the section-level lookup map) to REP-B
      const key = normalizeArticleNumber(art.number || art.articleNumber);
      if (key) {
        articleTypes[key] = 'REP-B';
        repBArticleKeys.add(key);
      }
    }
    if (repBArticleKeys.size > 0) {
      for (let i = 0; i < sections.length; i++) {
        const cls = classified[i];
        if (!cls) continue;
        const sectionNum = sections[i].number || sections[i].sectionNumber || '';
        const artKey = sectionNum.split('.')[0];
        if (!repBArticleKeys.has(artKey)) continue;
        if (cls.provisionType === 'REP-T') {
          cls.provisionType = 'REP-B';
          cls.classifiedBy = 'rep-ordering-fixup';
        }
      }
    }
  }

  // ── Pass 2.6: SECTION-level rep ordering fixup ──
  // The umbrella template family puts BOTH parties' reps inside ONE party-less
  // "REPRESENTATIONS AND WARRANTIES" article as two sections: "Representations
  // and Warranties of the Company" (3.01) then "… of Parent and Sub" (3.02).
  // Pass 2.5 only handles whole ARTICLES. Party-worded section titles are
  // caught deterministically (REP-B rule above), but some deals name the
  // ENTITIES instead ("… of Starwood" / "… of Marriott"), which no party-word
  // regex can resolve. Drafting convention is universal: the target's reps
  // come first, the buyer's second. So: walk "Representations and Warranties
  // of X" SECTIONS in document order; the first stays REP-T; any LATER one
  // whose title does not name the company/target/seller is re-tagged REP-B.
  {
    const repSecTitleRe = /represent\w*\s+(?:and\s+)?warrant\w*\s+of\s+/i;
    const explicitTargetRe = /(?:company|target|seller)/i;
    let sawTargetRepSection = false;
    const order = sections
      .map((s, i) => ({ i, start: s.startChar ?? s.start ?? 0 }))
      .sort((a, b) => a.start - b.start);
    for (const { i } of order) {
      const cls = classified[i];
      if (!cls) continue;
      const title = sections[i].title || sections[i].heading || '';
      if (!repSecTitleRe.test(title)) continue;
      if (cls.provisionType !== 'REP-T' && cls.provisionType !== 'REP-B') continue;
      if (!sawTargetRepSection) {
        sawTargetRepSection = true; // first rep-of-X section = target's
        continue;
      }
      if (cls.provisionType === 'REP-T' && !explicitTargetRe.test(title)) {
        cls.provisionType = 'REP-B';
        cls.classifiedBy = 'rep-section-ordering-fixup';
      }
    }
  }

  // ── Pass 2.7: CODENAME conduct-section fixup ──
  // Some deals title their interim-ops covenants with CODENAMES ("Conduct of
  // Maverick" / "Conduct of Cavalier" in Nationstar/Mr. Cooper) — no
  // company/parent/business word for the deterministic rules to key on. The
  // drafting convention is positional and mirrors reps: the TARGET's conduct
  // section comes first, the buyer's second. Walk sections titled
  // "Conduct of <Name>" in document order: first distinct name → IOC-T, a
  // later section naming a DIFFERENT entity → IOC-B. Sections the rules
  // already typed IOC are left alone.
  {
    const conductRe = /^conduct\s+of\s+(?:the\s+)?([A-Z][\w'&.-]*)\s*$/i;
    let firstName = null;
    const order2 = sections
      .map((s, i) => ({ i, start: s.startChar ?? s.start ?? 0 }))
      .sort((a, b) => a.start - b.start);
    for (const { i } of order2) {
      const cls = classified[i];
      if (!cls) continue;
      const title = (sections[i].title || sections[i].heading || '').trim();
      const m2 = title.match(conductRe);
      if (!m2) continue;
      const name = m2[1].toLowerCase();
      // Skip titles the party-word rules already handle.
      if (/company|target|seller|parent|buyer|business/.test(name)) continue;
      if (cls.provisionType === 'IOC-T' || cls.provisionType === 'IOC-B') { if (!firstName) firstName = name; continue; }
      if (!firstName || name === firstName) {
        firstName = firstName || name;
        cls.provisionType = 'IOC-T';
      } else {
        cls.provisionType = 'IOC-B';
      }
      cls.classifiedBy = 'conduct-codename-fixup';
    }
  }

  // ── Pass 2.8: NOSOL content-signal fallback ──
  // SecureWorks/Sophos parks the full operative no-shop covenant ("shall
  // not ... initiate, solicit, facilitate or knowingly encourage the
  // making of any Acquisition Proposal") under a heading that matches NO
  // title-based NOSOL rule at all (title rules only look at the title —
  // see the comment on tryDeterministic above). Title rules always run
  // first and win; this is a last-resort content read, and per the Fable
  // spec ONLY fires when the section would otherwise land as COV or MISC —
  // it must never override a more specific type (REP, COND, TERMF, ANTI,
  // etc.), since those are more likely to be correct than a generic
  // body-text pattern match.
  //
  // IOC-T/IOC-B carve-out (deviation from the literal COV/MISC-only spec,
  // documented for review): SecureWorks's actual no-shop section (6.02,
  // "Acquisition Proposals; Change in Recommendation") never became its own
  // classified section at all — Phase-1 segmentation merged it into the
  // PRECEDING section, 6.01 "Conduct of the Company", which the IOC-T title
  // rule (correctly, on its own terms) claims. Under the spec's literal
  // COV/MISC guard this section never flips, leaving the deal's no-shop
  // undetected — the exact defect this fix exists to close. Before adding
  // IOC-T/IOC-B to the guard, NOSOL_CONTENT_RE was run against ALL 40
  // deals' classified_sections regardless of type: it matches exactly 5
  // sections — 4 already typed NOSOL (no-op) and this ONE IOC-T section.
  // Zero collateral matches anywhere else in the corpus, including every
  // other IOC-T/IOC-B section. On that empirical basis the guard is widened
  // to IOC-T/IOC-B (not to REP/COND/TERMF/ANTI/etc., which stay excluded
  // per spec) — re-verify with the corpus-wide safety-check script
  // (scripts/safety-check-nosol-rule.js) before any future change to this
  // pattern or guard.
  {
    for (let i = 0; i < sections.length; i++) {
      const cls = classified[i];
      if (!cls) continue;
      if (!['COV', 'MISC', 'IOC-T', 'IOC-B'].includes(cls.provisionType)) continue;
      const text = sections[i].text || '';
      if (NOSOL_CONTENT_RE.test(text)) {
        cls.provisionType = 'NOSOL';
        cls.confidence = 'medium';
        cls.classifiedBy = 'nosol-content-fallback';
        delete cls.provisionCode;
      }
    }
  }

  // ── Pass 3: Sub-code refinement ──
  // Stamp a more-specific provisionCode on sections whose title matches a
  // SUBCODE_REFINEMENT_RULES entry AND whose resolved type matches the rule's
  // whenType. Never overrides type — only attaches a code. If the
  // deterministic pass already set a code, we keep it.
  for (let i = 0; i < sections.length; i++) {
    const cls = classified[i];
    if (!cls) continue;
    if (cls.provisionCode) continue; // already set by deterministic pass
    const sub = refineSubCode(sections[i], cls.provisionType);
    if (sub) cls.provisionCode = sub;
  }

  // Explicit IOC subheadings beat inferred categories. Metsera §5.01(d)
  // says "Dividends and Distributions" even if the body also mentions
  // acquisitions or business combinations by cross-reference.
  for (let i = 0; i < sections.length; i++) {
    const cls = classified[i];
    if (!cls || !/^IOC(?:-|$)/.test(String(cls.provisionType || ''))) continue;
    const key = explicitIocCategory(sections[i]);
    if (key) cls.categoryCanonical = key;
  }

  // ── Final safety net: 100% coverage guarantee ──
  // Every section MUST appear in the classified output. If any slot is still
  // null (shouldn't happen, but bugs in the routing above could leave one),
  // fall it back to OTHER so downstream consumers can rely on
  // sections.length === classified.length.
  for (let i = 0; i < sections.length; i++) {
    if (!classified[i]) {
      classified[i] = {
        ...sections[i],
        provisionType: 'OTHER',
        confidence: 'low',
        classifiedBy: 'fallback',
      };
    }
  }

  // ── Pass 3: Complexity estimation ──
  for (let i = 0; i < classified.length; i++) {
    classified[i].complexity = estimateComplexity(classified[i]);
  }

  // Hard assertion — should never trip but log loudly if it does so we know
  // some upstream code dropped a section.
  if (classified.length !== sections.length) {
    console.warn(
      `[classify] coverage mismatch: classified.length=${classified.length} sections.length=${sections.length}`,
    );
  }

  return classified;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  classifySections,
  // Exposed for testing + the deterministic-only planning pass in
  // scripts/reprocess.js
  tryDeterministic,
  refineSubCode,
  classifyArticle,
  normalizeArticleNumber,
  estimateComplexity,
  extractTitle,
  explicitIocCategory,
  countSubItems,
  buildTypeReference,
  // Exposed for the NOSOL content-fallback corpus-wide safety-check script
  // and its tests (scripts/safety-check-nosol-rule.js).
  NOSOL_CONTENT_RE,
};
