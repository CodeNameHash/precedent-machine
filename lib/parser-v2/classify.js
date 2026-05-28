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
  // No-solicitation / No-shop
  { pattern: /no[\s-]*(?:solicitation|shop)/i, type: 'NOSOL' },
  // Antitrust / HSR / regulatory efforts (includes "Reasonable Best Efforts" section)
  { pattern: /antitrust|HSR\b|hart[\s-]*scott|(?:reasonable\s+)?best\s+efforts|regulatory\s+(?:approval|matters|filings)|filings.*(?:cooperation|notification)/i, type: 'ANTI' },
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

// Article-level classification: map article titles to the provision type
// family that all sections within that article belong to.
const ARTICLE_TYPE_MAP = [
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+(?:of\s+)?(?:the\s+)?(?:company|target|seller)/i, type: 'REP-T' },
  { pattern: /represent\w*\s+(?:and\s+)?warrant\w*\s+(?:of\s+)?(?:the\s+)?(?:parent|buyer|acqui|investor|purchaser)/i, type: 'REP-B' },
  { pattern: /represent\w*\s+(?:and\s+)?warrant/i, type: 'REP-T' }, // default to target if no party specified
  { pattern: /conduct\s+of\s+(?:the\s+)?(?:company|target|seller)/i, type: 'IOC' },
  { pattern: /conduct\s+of\s+(?:the\s+)?(?:parent|buyer|acqui)/i, type: 'IOC' },
  { pattern: /conduct\s+of\s+business|interim\s+operat|conduct\s+prior/i, type: 'IOC' },
  { pattern: /conditions?\s+(?:to|of|precedent)|conditions?\s+(?:to\s+)?(?:the\s+)?(?:closing|merger|obligations?)/i, type: 'COND' },
  { pattern: /termination\b/i, type: 'TERMINATION' }, // split into TERMR/TERMF at section level
  { pattern: /(?:additional\s+)?(?:covenants?|agreements?)/i, type: 'COV' },
  { pattern: /(?:the\s+)?merger|structure|mechanics/i, type: 'STRUCT' },
  { pattern: /consideration|securities?\s+treatment|conversion|exchange/i, type: 'CONSID' },
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
 */
function tryDeterministic(section, articleType) {
  const title = extractTitle(section.heading || section.title || '');
  const fullText = `${title} ${(section.text || '').substring(0, 200)}`;

  // Section-level rules first (highest priority)
  for (const rule of DETERMINISTIC_RULES) {
    const target = rule.matchOn === 'title' ? title : fullText;
    if (rule.pattern.test(target)) {
      return { type: rule.type, confidence: 'high' };
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
  const title = extractTitle(section.heading || section.title || '');
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
        // Validate provision type
        const validTypes = PROVISION_TYPES.map(t => t.key);
        const provType = validTypes.includes(item.provisionType) ? item.provisionType : 'MISC';
        const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium';

        resultMap.set(idx, {
          provisionType: provType,
          confidence,
          reasoning: item.reasoning || '',
        });
      }
    }
  }

  // Fill in any sections that the AI missed
  for (let i = 0; i < sections.length; i++) {
    if (!resultMap.has(i)) {
      resultMap.set(i, {
        provisionType: 'MISC',
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
    const title = extractTitle(section.heading || section.title || '');
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
    const articleNum = sectionNum.split('.')[0];
    const articleType = articleTypes[articleNum] || null;

    const result = tryDeterministic(sections[i], articleType);
    if (result) {
      deterministic.push({ index: i, type: result.type, confidence: result.confidence || 'high' });
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
  for (const { index, type, confidence } of deterministic) {
    classified[index] = {
      ...sections[index],
      provisionType: type,
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

  // ── Pass 3: Complexity estimation ──
  for (let i = 0; i < classified.length; i++) {
    classified[i].complexity = estimateComplexity(classified[i]);
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
