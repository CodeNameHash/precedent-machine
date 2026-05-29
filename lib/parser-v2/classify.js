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

// ---------------------------------------------------------------------------
// 1. DETERMINISTIC PRE-CLASSIFICATION
//    Only ~10 patterns that NEVER misfire. Everything else goes to AI.
// ---------------------------------------------------------------------------

const DETERMINISTIC_RULES = [
  // No-solicitation / No-shop. Covers tender-offer-style M&A where these
  // appear inside a generic "Covenants" article instead of their own section.
  { pattern: /no[\s-]*(?:solicitation|shop)|acquisition\s+proposals?|takeover\s+proposals?|alternative\s+(?:transactions?|proposals?)|company\s+(?:adverse|board)\s+recommendation|adverse\s+recommendation\s+change/i, type: 'NOSOL' },
  // Interim Operating Covenants — "Covenants of the Company" / "Conduct of
  // Business of the Company" / "Interim Operations". Catches IOC sections
  // dumped into a consolidated "Covenants" article (typical tender-offer style).
  { pattern: /covenants?\s+of\s+(?:the\s+)?(?:company|target|seller)|conduct\s+of\s+(?:the\s+)?(?:company|target|seller)['’]?s?\s+business|interim\s+oper/i, type: 'IOC' },
  // Takeover statutes / Section 203 DGCL / "No Inconsistent Action" w/r/t
  // anti-takeover statutes. MUST come BEFORE the ANTI rule below since the
  // ANTI pattern matches "no inconsistent action" generically. We use the
  // dedicated COV-TAKEOVER code so the per-provision view can pick up the
  // takeover-specific schema.
  // Guarded so true antitrust headings ("antitrust action", "antitrust efforts")
  // don't accidentally match.
  { pattern: /takeover\s+statutes?|state\s+takeover|business\s+combination\s+statute|section\s+203(?:\s+of\s+the\s+dgcl)?|no\s+inconsistent\s+action/i, type: 'COV', code: 'COV-TAKEOVER', guardNot: /antitrust/i },
  // Antitrust / HSR / regulatory efforts (includes "Reasonable Best Efforts" section)
  { pattern: /antitrust|HSR\b|hart[\s-]*scott|(?:reasonable\s+)?best\s+efforts|regulatory\s+(?:approval|matters|filings)|filings.*(?:cooperation|notification)|further\s+action[;,\s]+efforts/i, type: 'ANTI' },
  // Definitions — exact title match
  { pattern: /^definitions?\s*$/i, type: 'DEF', matchOn: 'title' },
  // Governing law
  { pattern: /governing\s+law/i, type: 'MISC' },
  // Boilerplate MISC
  { pattern: /severab|counterpart|waiver\s+of\s+jury/i, type: 'MISC' },
  // Specific performance
  { pattern: /specific\s+performance/i, type: 'MISC' },
  // "The Merger" exact title → STRUCT
  { pattern: /^(?:the\s+)?merger\s*$/i, type: 'STRUCT', matchOn: 'title' },
  // Effective time → STRUCT
  { pattern: /effective\s+time/i, type: 'STRUCT' },

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
  { pattern: /^proxy(?:\s+statement)?$|preparation\s+of\s+(?:the\s+)?proxy|special\s+meeting/i, whenType: 'COV', code: 'COV-PROXY' },
  // TERMF family
  { pattern: /antitrust\s+(?:reverse\s+)?termination\s+fee|regulatory\s+termination\s+fee|reverse\s+termination\s+fee.*antitrust/i, whenType: 'TERMF', code: 'TERMF-RTF-ANTI' },
  { pattern: /(?:acquirer|buyer|parent)\s+expense\s+reimburse|expense\s+reimbursement/i, whenType: 'TERMF', code: 'TERMF-REIMBURSE' },
  // REP-B family
  { pattern: /sufficient\s+funds|available\s+funds|sufficient\s+cash/i, whenType: 'REP-B', code: 'REP-B-FUNDS' },
  { pattern: /\bsolvenc/i, whenType: 'REP-B', code: 'REP-B-SOLVENCY' },
  { pattern: /anti[\s-]*reliance|exclusivity\s+of\s+representations|no\s+other\s+representations/i, whenType: 'REP-B', code: 'REP-B-ANTIRELIANCE' },
  // REP-T family
  { pattern: /sufficiency\s+of\s+assets/i, whenType: 'REP-T', code: 'REP-T-SUFFICIENCY' },
  { pattern: /top\s+customers|top\s+suppliers|significant\s+customers|major\s+customers/i, whenType: 'REP-T', code: 'REP-T-TOP-CUSTOMERS' },
  { pattern: /material\s+contracts|significant\s+contracts/i, whenType: 'REP-T', code: 'REP-T-MATERIAL-CONTRACTS' },
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
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+(?:of\s+)?(?:the\s+)?(?:parent|buyer|acqui|investor|purchaser)/i, type: 'REP-B' },
  { pattern: /represent\w*\s+(?:and\s+)?warrant/i, type: 'REP-T' }, // default to target; rep-ordering-fixup re-tags 2nd+ as REP-B
  { pattern: /conduct\s+of\s+(?:the\s+)?(?:company|target|seller)/i, type: 'IOC' },
  { pattern: /conduct\s+of\s+(?:the\s+)?(?:parent|buyer|acqui)/i, type: 'IOC' },
  { pattern: /conduct\s+of\s+business|interim\s+operat|conduct\s+prior/i, type: 'IOC' },
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

  // Section-level rules — title-only matching to avoid false positives
  for (const rule of DETERMINISTIC_RULES) {
    if (rule.pattern.test(title)) {
      if (rule.guardNot && rule.guardNot.test(title)) continue;
      const result = { type: rule.type, confidence: 'high' };
      if (rule.code) result.code = rule.code;
      return result;
    }
  }

  // Article-level context: if we know the article type, use it
  if (articleType) {
    // For TERMINATION articles, distinguish TERMR vs TERMF from section title
    if (articleType === 'TERMINATION') {
      if (/(?:termination\s+)?fee|break[\s-]*up|expense\s+reimburse|effect\s+of\s+termination|sole.*remedy/i.test(title)) {
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
    if (['REP-T', 'REP-B', 'IOC', 'COV', 'STRUCT', 'CONSID', 'DEF', 'MISC'].includes(articleType)) {
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

4. **Party detection for IOC:**
   - IOC (target): "Conduct of Business of the Company" / "Conduct of Company's Business" / "Interim Operations"
   - If buyer has its own IOC section under "Conduct of Buyer's Business" → still classify as IOC (the rubric uses IOC for target; note this in reasoning)

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
 */
function parseAIResponse(rawText) {
  // Strip markdown fences if present
  const clean = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Try to extract JSON array from the response
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_) {
        // fall through
      }
    }
    return null;
  }
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
    model: 'claude-sonnet-4-20250514',
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
  const highComplexityTypes = ['NOSOL', 'ANTI'];
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
 * @returns {Object[]} Classified sections with provisionType, confidence, classifiedBy, complexity
 */
async function classifySections(sections, articles, client) {
  if (!sections || sections.length === 0) return [];

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
  // Exposed for testing
  tryDeterministic,
  estimateComplexity,
  extractTitle,
  countSubItems,
  buildTypeReference,
};
