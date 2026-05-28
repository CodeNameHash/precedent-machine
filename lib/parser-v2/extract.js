/**
 * extract.js — Phase 3 of the v2 parser pipeline.
 *
 * Extracts sub-provisions from classified sections, assigns canonical rubric
 * codes, and extracts structured features.
 *
 * Strategies:
 *   A  Regex-split → AI-classify  (DEF, IOC, COND-M/B/S types)
 *   B  AI multi-code extraction   (NOSOL, ANTI — overlapping spans)
 *   C  Section-level AI           (REP, STRUCT, CONSID, COV, TERMR, TERMF, MISC)
 *   D  Definition splitting       (DEF — regex split + alias lookup + AI classify)
 *
 * CommonJS — consumed by Next.js API routes.
 */

const {
  CODES,
  FEATURES,
  PROVISION_TYPES,
  getCodesForType,
  isValidCode,
  findCodeByAlias,
  getTypeLabel,
  getFeaturesForType,
} = require('../rubric');

const {
  EXCEPTION_CODES,
  MATERIALITY_CODES,
  CONSENT_STANDARDS,
  EFFORTS_STANDARDS,
  formatDict,
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  LIST_TAXONOMY_KEYS,
} = require('../taxonomy');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';
const MAX_CONCURRENT = 6;

/** Types handled by Strategy A (regex split → AI classify). */
const STRATEGY_A_TYPES = new Set([
  'IOC', 'COND-M', 'COND-B', 'COND-S', 'COND',
]);

/** Types handled by Strategy B (multi-code, overlapping spans). */
const STRATEGY_B_TYPES = new Set(['NOSOL', 'ANTI']);

/** Types handled by Strategy C (section-level AI). */
const STRATEGY_C_TYPES = new Set([
  'REP-T', 'REP-B', 'STRUCT', 'CONSID', 'COV', 'TERMR', 'TERMF', 'MISC',
]);

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(limit, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// JSON parse helper — tolerant of markdown fences
// ---------------------------------------------------------------------------

function parseJSON(raw) {
  const clean = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

// ---------------------------------------------------------------------------
// Provision shape builder
// ---------------------------------------------------------------------------

function makeProvision(overrides) {
  return {
    type: null,
    code: null,
    category: null,
    text: '',
    startChar: 0,
    favorability: 'neutral',
    features: {},
    relatedDefinitions: [],
    isNewCode: false,
    proposedCode: null,
    proposedLabel: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Build feature extraction instructions for a provision type
// ---------------------------------------------------------------------------

function buildFeatureInstructions(typeKey) {
  const feats = getFeaturesForType(typeKey);
  if (!feats || feats.length === 0) return '';

  // Track which taxonomy dictionaries are referenced by features on this
  // provision type so we can append the codebook(s) once at the end.
  const usedTaxonomies = new Map(); // dict-name → dict object

  const lines = feats.map((f) => {
    let desc = `- ${f.key}: `;
    const taxonomy = taxonomyForFeatureKey(f.key);
    const taxonomyIsList = isListTaxonomyKey(f.key);

    if (taxonomy && taxonomyIsList) {
      // Array of tagged objects
      desc += 'array of TAGGED objects { code, label, text }, or empty array []';
    } else if (taxonomy) {
      // Single tagged object (or null)
      desc += 'TAGGED object { code, label, text }, or null';
    } else {
      switch (f.type) {
        case 'enum':
          desc += `one of ${JSON.stringify(f.options)}, or null`;
          break;
        case 'boolean':
          desc += 'true/false';
          break;
        case 'currency':
          desc += 'dollar amount as string (e.g. "$500,000,000"), or null';
          break;
        case 'percentage':
          desc += 'percentage as string (e.g. "15%"), or null';
          break;
        case 'duration':
          desc += 'numeric value (e.g. 4 for 4 business days), or null';
          break;
        case 'list':
          desc += 'array of strings, or empty array []';
          break;
        case 'text':
          desc += 'free text string, or null';
          break;
        default:
          desc += 'value or null';
      }
    }
    desc += ` — ${f.label}`;

    if (taxonomy) {
      // Identify which dict this is and remember it for the codebook footer
      let dictName;
      if (taxonomy === EXCEPTION_CODES) dictName = 'EXCEPTION_CODES';
      else if (taxonomy === MATERIALITY_CODES) dictName = 'MATERIALITY_CODES';
      else if (taxonomy === CONSENT_STANDARDS) dictName = 'CONSENT_STANDARDS';
      else if (taxonomy === EFFORTS_STANDARDS) dictName = 'EFFORTS_STANDARDS';
      else dictName = 'TAXONOMY_CODES';
      usedTaxonomies.set(dictName, taxonomy);
      desc += ` [map each ${taxonomyIsList ? 'item' : 'value'} to a code from ${dictName}]`;
    }
    return desc;
  });

  // Type-specific extraction guard rails
  let warnings = '';
  if (typeKey === 'IOC') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for IOC:
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in the source: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT list every sub-clause as an exception. If there are no such carve-outs in the provision, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits).
- "mainObligation" should be a one-sentence summary of what the sub-clause actually restricts or requires (e.g., "Target cannot incur indebtedness in excess of $25 million without buyer consent").
- "consentStandard" and "effortsStandard" are TAGGED single objects { code, label, text } drawn from CONSENT_STANDARDS / EFFORTS_STANDARDS respectively (or null if absent).
- "materialityQualifier" — if a materiality qualifier IS present, return a tagged object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. (Treat the legacy boolean form as superseded.)
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
`;
  } else if (typeKey === 'TERMR') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for TERMR:
- "terminationTriggers" is the LIST of CONDITIONS that allow termination (e.g., ["outside date passed without closing", "stockholder vote not obtained", "material breach by target uncured"]). Do NOT include exceptions to termination, cure carve-outs, or fault-based exclusions.
- "faultBasedExclusion" is true if there is "...except that this right is not available to a party whose breach caused..." style language.
- "partyWhoCanTerminate" identifies who can invoke this termination right.
`;
  } else if (typeKey === 'NOSOL') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for NOSOL:
- "mainConcept" is a one-sentence summary of the substantive concept.
- "noticePeriod" / "matchingPeriod" / "goShopWindow" are numeric durations.
- "fiduciaryCarveoutThreshold" describes the standard the board must meet to engage with an unsolicited bid.
`;
  } else if (typeKey === 'ANTI') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ANTI:
- "hellOrHighWater" is true ONLY if there is no cap on required divestitures.
- "divestitureCap" captures any dollar/revenue cap on remedies (if present).
- "litigationObligation" describes whether the parties must litigate against regulators.
- "effortsStandard" is a TAGGED single object { code, label, text } drawn from EFFORTS_STANDARDS (or null if absent).
`;
  } else if (typeKey && typeKey.startsWith('COND')) {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- "mainCondition" is a one-sentence summary of what must be satisfied for closing.
- If the bring-down is tiered (e.g., fundamental reps held to a higher standard), set "tieredBringDown" to true and list each tier in "tiers".
`;
  } else if (typeKey === 'TERMF') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for TERMF:
- "triggerEvents" lists the specific events that cause the fee to be payable.
- "soleRemedy" is true only if there is explicit "sole and exclusive remedy" language.
`;
  } else if (typeKey === 'DEF') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for DEF:
- "canonicalTerm" is the exact quoted defined term as it appears (e.g., "Material Adverse Effect").
- "definitionText" is the core definition body (excluding enumerated carve-outs).
- For MAE-type definitions, "carveOuts" lists each enumerated exception as a TAGGED object { code, label, text } drawn from EXCEPTION_CODES (use "OTHER" when no listed code fits). "disproportionateImpactClause" captures any "except to the extent disproportionately affected" qualifier as free text.
- "crossReferences" lists other defined terms referenced inside this definition.
`;
  } else if (typeKey === 'REP-T' || typeKey === 'REP-B') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- "mainConcept" is a one-sentence summary of what is being represented.
- "materialityQualifier" — if a materiality qualifier IS present, return a TAGGED object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. (Treat the legacy boolean form as superseded.)
- "crossReferences" should include schedule references (e.g. "Section 3.6 of the Company Disclosure Letter") and other section cross-references.
`;
  }

  // Build taxonomy codebook footer — only includes dictionaries actually used
  // by features on this provision type.
  let taxonomyBlock = '';
  if (usedTaxonomies.size > 0) {
    const sections = [];
    for (const [name, dict] of usedTaxonomies.entries()) {
      sections.push(`${name}:\n${formatDict(dict)}`);
    }
    taxonomyBlock = `
TAXONOMY CODEBOOKS — for fields marked "TAGGED", map each value to the closest code below.
Return an object of the form { "code": "<CODE_FROM_DICT>", "label": "<canonical label from dict>", "text": "<verbatim excerpt from the agreement>" }.
For list-typed fields (e.g. permittedExceptions, carveOuts), return an ARRAY of such objects.
If no listed code fits, use code "OTHER" (for EXCEPTION_CODES) or pick the closest available code, and still include the verbatim "text".
Do NOT invent new codes — only use codes that appear in the dictionaries below.

${sections.join('\n\n')}
`;
  }

  return `\nExtract these features for each provision (return them in a "features" object on each result):\n${lines.join('\n')}\n${warnings}${taxonomyBlock}\n`;
}

// ---------------------------------------------------------------------------
// Build canonical codes list for a provision type
// ---------------------------------------------------------------------------

function buildCodesList(typeKey) {
  const codes = getCodesForType(typeKey);
  return codes.map(
    (c) => `  ${c.code}: "${c.label}" — ${c.description}`
  ).join('\n');
}

// ---------------------------------------------------------------------------
// Definition cross-referencing — find defined terms referenced in text
// ---------------------------------------------------------------------------

function findRelatedDefinitions(text) {
  const related = [];
  const defCodes = getCodesForType('DEF');

  for (const dc of defCodes) {
    // Check if the label or any alias appears in the text
    const terms = [dc.label, ...(dc.aliases || [])];
    for (const term of terms) {
      if (term.length < 4) continue; // skip very short aliases
      // Look for the term in quotes or as a capitalized reference
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(?:[“"]${escaped}[”"]|\\b${escaped}\\b)`,
        'i'
      );
      if (pattern.test(text)) {
        if (!related.includes(dc.code)) {
          related.push(dc.code);
        }
        break; // found this code, move to next
      }
    }
  }

  return related;
}

// ---------------------------------------------------------------------------
// Regex: sub-clause splitting for (a)/(b)/(c) boundaries
// ---------------------------------------------------------------------------

function splitSubClauses(sectionText, typeKey) {
  const romanNumerals = new Set([
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
  ]);
  const isCondType = typeKey.startsWith('COND');
  const clausePattern = /(?:^|\n)\s*\(([a-z]+)\)\s/g;
  const matches = [];
  let m;

  while ((m = clausePattern.exec(sectionText)) !== null) {
    if (isCondType && romanNumerals.has(m[1])) continue;
    const offset = sectionText[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
  }

  // Also catch inline sub-clauses after sentence boundaries
  const inlinePattern = /\.\s+\(([a-z]+)\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    if (isCondType && romanNumerals.has(m[1])) continue;
    const pos = m.index + m[0].indexOf('(');
    if (matches.some((x) => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
  }
  matches.sort((a, b) => a.index - b.index);

  if (matches.length < 2) return null;

  const parts = [];

  // Preamble before first sub-clause
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      parts.push({ letter: '_preamble', text: preamble });
    }
  }

  // Each sub-clause
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    parts.push({ letter: matches[i].letter, text });
  }

  return parts.length > 0 ? parts : null;
}

// ---------------------------------------------------------------------------
// Regex: definition splitting ("TERM" means ...)
// ---------------------------------------------------------------------------

function splitDefinitions(sectionText) {
  const defPattern =
    /[“"]([^”"]+)[”"][^“"\n]{0,40}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;

  const matches = [];
  let m;
  while ((m = defPattern.exec(sectionText)) !== null) {
    // Validate: must be near start of line or after sentence punctuation
    const before = sectionText.substring(Math.max(0, m.index - 200), m.index);
    const lastNL = before.lastIndexOf('\n');
    if (lastNL !== -1) {
      const sinceLine = before.substring(lastNL + 1);
      const nonWS = sinceLine.replace(/\s/g, '').length;
      if (nonWS > 20) continue;
    } else if (m.index > 20) {
      const trimmedBefore = before.trimEnd();
      if (trimmedBefore.length > 0 && !/[.;:!?)\]]$/.test(trimmedBefore)) continue;
    }
    matches.push({ index: m.index, term: m[1].trim() });
  }

  if (matches.length === 0) return null;

  const parts = [];

  // Preamble
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      parts.push({ term: '_preamble', text: preamble });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    parts.push({ term: matches[i].term, text });
  }

  return parts.length > 0 ? parts : null;
}

// ---------------------------------------------------------------------------
// Strategy A: Regex-split → AI-classify (IOC, COND types)
// ---------------------------------------------------------------------------

async function strategyA(sections, client) {
  const provisions = [];

  // Group sections by type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    // 1. Regex-split all sections of this type
    const allSubClauses = [];
    for (const section of typeSections) {
      const parts = splitSubClauses(section.text, typeKey);
      if (parts) {
        for (const part of parts) {
          allSubClauses.push({
            text: part.text,
            letter: part.letter,
            startChar: section.startChar,
            sectionIdx: typeSections.indexOf(section),
          });
        }
      } else {
        // No sub-clauses — treat the whole section as one sub-clause
        allSubClauses.push({
          text: section.text,
          letter: '_whole',
          startChar: section.startChar,
          sectionIdx: typeSections.indexOf(section),
        });
      }
    }

    if (allSubClauses.length === 0) return;

    // 2. Build the preamble provisions (no AI needed)
    const preambles = allSubClauses.filter((sc) => sc.letter === '_preamble');
    for (const p of preambles) {
      provisions.push(makeProvision({
        type: typeKey,
        code: null,
        category: 'General / Preamble',
        text: p.text,
        startChar: p.startChar,
        favorability: 'neutral',
        features: {},
        relatedDefinitions: findRelatedDefinitions(p.text),
      }));
    }

    // 3. Send non-preamble sub-clauses to Claude in ONE batched call
    const classifiable = allSubClauses.filter(
      (sc) => sc.letter !== '_preamble'
    );
    if (classifiable.length === 0) return;

    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

    const subClausePayload = classifiable.map((sc, idx) => {
      const parentSection = typeSections[sc.sectionIdx] || {};
      return {
        idx,
        sectionTitle: parentSection.title || parentSection.heading || parentSection.category || null,
        sectionNumber: parentSection.number || null,
        text: sc.text.length > 3000 ? sc.text.substring(0, 3000) : sc.text,
      };
    });

    const prompt = `You are a senior M&A attorney. Classify each sub-clause below into exactly one canonical rubric code, assess favorability, and extract STRUCTURED features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SUB-CLAUSES TO CLASSIFY (each tagged with its parent sectionTitle and sectionNumber):
${JSON.stringify(subClausePayload, null, 2)}
${featureInstructions}
For each sub-clause, determine:
1. The best matching canonical code from the list above. Each sub-clause gets
   a UNIQUE code based on its sectionTitle and the actual text of the sub-clause.
   Do not default many sub-clauses to the same code.
2. Favorability from the buyer's perspective.
3. POPULATE the structured "features" object with every applicable field from
   the schema above. Use null / [] / false for fields that genuinely don't
   apply, but DO attempt every field — these features power the UI and
   downstream comparison, so a populated features object is required.

If NO existing code fits, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a
"features" object with the schema fields populated:
{
  "results": [
    {
      "idx": 0,
      "code": "COND-M-LEGAL",
      "category": "No Legal Impediment",
      "favorability": "neutral",
      "features": { /* fields per the schema above */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
      }

      for (let i = 0; i < classifiable.length; i++) {
        const sc = classifiable[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (aiResult.category || 'Unclassified'),
          text: sc.text,
          startChar: sc.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
          relatedDefinitions: findRelatedDefinitions(sc.text),
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: emit each sub-clause as unclassified
      for (const sc of classifiable) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: 'Unclassified',
          text: sc.text,
          startChar: sc.startChar,
          relatedDefinitions: findRelatedDefinitions(sc.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy B: AI multi-code extraction (NOSOL, ANTI)
// ---------------------------------------------------------------------------

async function strategyB(sections, client) {
  const provisions = [];

  // Group by type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    // Concatenate all section texts for this type (they may span multiple
    // sections, e.g. multiple NOSOL articles)
    const combinedText = typeSections.map((s) => s.text).join('\n\n---\n\n');
    const startChar = typeSections[0].startChar;

    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

    const prompt = `You are a senior M&A attorney. This is a "${getTypeLabel(typeKey)}" section of a merger agreement. A single passage can contain MULTIPLE provisions with overlapping text spans.

SECTION TEXT:
${combinedText.length > 15000 ? combinedText.substring(0, 15000) : combinedText}

ALL CANONICAL CODES for ${typeKey}:
${codesList}

For EACH canonical code listed above, determine:
1. Whether it is present in this section (true/false).
2. If present, extract the most relevant text excerpt (verbatim).
3. Assess favorability from the buyer's perspective.
4. POPULATE the structured "features" object with every applicable field from
   the schema below. Each identified passage gets its OWN features object.
${featureInstructions}
If you identify a concept not covered by any existing code, include it with "isNewCode": true and propose a code and label.

Return ONLY valid JSON (no markdown, no backticks). Each provision MUST include
its own "features" object populated per the schema:
{
  "provisions": [
    {
      "code": "NOSOL-PROHIBIT",
      "category": "Solicitation Prohibition",
      "present": true,
      "text": "exact verbatim excerpt...",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}

Only include provisions that are actually present. Do NOT include provisions where present=false.`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 12000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);

      for (const p of (parsed.provisions || [])) {
        if (!p.present && p.present !== undefined) continue;
        if (!p.text || p.text.length < 10) continue;

        const code = p.code || null;
        const codeEntry = code ? CODES[code] : null;

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (p.category || 'Unclassified'),
          text: p.text,
          startChar,
          favorability: p.favorability || 'neutral',
          features: p.features || {},
          relatedDefinitions: findRelatedDefinitions(p.text),
          isNewCode: p.isNewCode || false,
          proposedCode: p.proposedCode || null,
          proposedLabel: p.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: keep as single provision per section
      for (const s of typeSections) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: getTypeLabel(typeKey) || typeKey,
          text: s.text,
          startChar: s.startChar,
          relatedDefinitions: findRelatedDefinitions(s.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy C: Section-level AI (REP, STRUCT, CONSID, COV, TERMR, TERMF, MISC)
// ---------------------------------------------------------------------------

async function strategyC(sections, client) {
  const provisions = [];

  // Group by type — one AI call per type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

    const sectionPayload = typeSections.map((s, idx) => ({
      idx,
      sectionNumber: s.number || null,
      sectionTitle: s.title || s.heading || s.category || null,
      articleNumber: s.articleNumber || null,
      articleTitle: s.articleTitle || null,
      text: s.text.length > 4000 ? s.text.substring(0, 4000) : s.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each section below into exactly one canonical rubric code, assess favorability, and extract features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SECTIONS TO CLASSIFY (each has a sectionNumber, sectionTitle, articleTitle, and text):
${JSON.stringify(sectionPayload, null, 2)}
${featureInstructions}
CRITICAL CLASSIFICATION RULES:
1. Each section gets a UNIQUE canonical code based on its sectionTitle and content.
   Do NOT default multiple sections to the same code just because they are
   the same provision type. Different sections cover different topics.
2. The sectionTitle is your strongest signal — e.g. a section titled
   "The Merger" should map to a STRUCT code about the merger structure,
   "Closing" to a closing-mechanics code, "Effective Time" to an effective-time
   code, etc. Use the title FIRST, then confirm with the text.
3. Articles group related sections (e.g. Article III = company reps).
   Use articleTitle as supporting context but the sectionTitle is the primary signal.
4. If two sections truly cover the exact same concept, both can share a code,
   but this should be rare. Prefer distinct codes when titles differ.

For each section:
1. Pick the single best matching canonical code (driven by sectionTitle + content).
2. Provide the human-readable category label.
3. Assess favorability from the buyer's perspective.
4. POPULATE the structured "features" object with EVERY applicable field from the schema above. The features object powers the UI's structured display, so do not skip it.

If NO existing code fits a section, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label derived from the sectionTitle.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a populated "features" object:
{
  "results": [
    {
      "idx": 0,
      "code": "${typeKey}-EXAMPLE",
      "category": "Example Label",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 10000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
      }

      for (let i = 0; i < typeSections.length; i++) {
        const section = typeSections[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry
            ? codeEntry.label
            : (aiResult.category || section.category || 'Unclassified'),
          text: section.text,
          startChar: section.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
          relatedDefinitions: findRelatedDefinitions(section.text),
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback
      for (const s of typeSections) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: s.category || 'Unclassified',
          text: s.text,
          startChar: s.startChar,
          relatedDefinitions: findRelatedDefinitions(s.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy D: Definition splitting (DEF)
// ---------------------------------------------------------------------------

async function strategyD(sections, client) {
  const provisions = [];

  // 1. Regex-split all DEF sections into individual definitions
  const allDefs = [];
  for (const section of sections) {
    const parts = splitDefinitions(section.text);
    if (parts) {
      for (const part of parts) {
        // Check alias lookup first
        const aliasCode = part.term !== '_preamble'
          ? findCodeByAlias(part.term)
          : null;

        allDefs.push({
          term: part.term,
          text: part.text,
          startChar: section.startChar,
          aliasCode,
        });
      }
    } else {
      // Couldn't split — treat the whole section as a single def
      allDefs.push({
        term: section.category || 'Definitions',
        text: section.text,
        startChar: section.startChar,
        aliasCode: null,
      });
    }
  }

  if (allDefs.length === 0) return provisions;

  // 2. Handle preambles immediately (no AI needed)
  const preambles = allDefs.filter((d) => d.term === '_preamble');
  for (const p of preambles) {
    provisions.push(makeProvision({
      type: 'DEF',
      code: 'DEF-GENERAL',
      category: 'General / Preamble',
      text: p.text,
      startChar: p.startChar,
      relatedDefinitions: [],
    }));
  }

  // 3. For defs with alias matches, we already know the code
  const needsAI = [];
  const aliasMatched = [];
  for (const d of allDefs) {
    if (d.term === '_preamble') continue;
    if (d.aliasCode) {
      aliasMatched.push(d);
    } else {
      needsAI.push(d);
    }
  }

  // Emit alias-matched definitions
  for (const d of aliasMatched) {
    const codeEntry = CODES[d.aliasCode];
    provisions.push(makeProvision({
      type: 'DEF',
      code: d.aliasCode,
      category: codeEntry ? codeEntry.label : d.term,
      text: d.text,
      startChar: d.startChar,
      relatedDefinitions: findRelatedDefinitions(d.text),
    }));
  }

  // 4. Send remaining definitions to Claude for classification + feature extraction
  if (needsAI.length > 0) {
    const codesList = buildCodesList('DEF');
    const featureInstructions = buildFeatureInstructions('DEF');

    const defPayload = needsAI.map((d, idx) => ({
      idx,
      term: d.term,
      text: d.text.length > 2000 ? d.text.substring(0, 2000) : d.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each defined term below into the best matching canonical rubric code, and extract STRUCTURED features.

VALID DEF CODES:
${codesList}

DEFINITIONS TO CLASSIFY:
${JSON.stringify(defPayload, null, 2)}
${featureInstructions}
For each definition:
1. Pick the best matching canonical code.
2. Assess favorability from the buyer's perspective.
3. POPULATE the "features" object with every applicable schema field — including "canonicalTerm", "definitionText", "crossReferences", and (for MAE) "carveOuts" and "disproportionateImpactClause".
4. Identify related provision codes — e.g., "Superior Proposal" relates to NOSOL provisions, "MAE" relates to COND-B-MAE.

If no existing code fits, set "isNewCode": true and propose a code (format: "DEF-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a populated "features" object:
{
  "results": [
    {
      "idx": 0,
      "code": "DEF-MAE",
      "category": "Material Adverse Effect",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "relatedProvisionTypes": ["COND-B-MAE"],
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
      }

      for (let i = 0; i < needsAI.length; i++) {
        const d = needsAI[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        // Merge AI-suggested related provision types into relatedDefinitions
        const related = findRelatedDefinitions(d.text);
        if (aiResult.relatedProvisionTypes) {
          for (const rp of aiResult.relatedProvisionTypes) {
            if (!related.includes(rp)) related.push(rp);
          }
        }

        provisions.push(makeProvision({
          type: 'DEF',
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (aiResult.category || d.term),
          text: d.text,
          startChar: d.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
          relatedDefinitions: related,
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: emit each definition unclassified
      for (const d of needsAI) {
        provisions.push(makeProvision({
          type: 'DEF',
          code: null,
          category: d.term,
          text: d.text,
          startChar: d.startChar,
          relatedDefinitions: findRelatedDefinitions(d.text),
          _error: err.message,
        }));
      }
    }
  }

  // 5. Feature extraction for alias-matched defs (batch call)
  const aliasProvisions = provisions.filter(
    (p) => p.type === 'DEF' && p.code && Object.keys(p.features).length === 0
      && p.category !== 'General / Preamble'
  );

  if (aliasProvisions.length > 0) {
    const featureInstructions = buildFeatureInstructions('DEF');
    if (featureInstructions) {
      const featurePayload = aliasProvisions.map((p, idx) => ({
        idx,
        code: p.code,
        text: p.text.length > 2000 ? p.text.substring(0, 2000) : p.text,
      }));

      const featurePrompt = `Extract features from each definition below.
${featureInstructions}
DEFINITIONS:
${JSON.stringify(featurePayload, null, 2)}

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "features": {},
      "favorability": "neutral"
    }
  ]
}`;

      try {
        const resp = await client.messages.create({
          model: MODEL,
          max_tokens: 6000,
          messages: [{ role: 'user', content: featurePrompt }],
        });

        const raw = resp.content.map((c) => c.text || '').join('');
        const parsed = parseJSON(raw);
        for (const r of (parsed.results || [])) {
          if (r.idx >= 0 && r.idx < aliasProvisions.length) {
            aliasProvisions[r.idx].features = r.features || {};
            if (r.favorability) {
              aliasProvisions[r.idx].favorability = r.favorability;
            }
          }
        }
      } catch {
        // Features are best-effort; continue without them
      }
    }
  }

  return provisions;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extract provisions from classified sections.
 *
 * @param {Array<Object>} classifiedSections — output from Phase 2 (classify)
 *   Each has: { provision_type, text, startChar, category?, number?, ... }
 * @param {Object} client — Anthropic SDK client instance
 * @returns {Promise<Array<Object>>} provisions with canonical codes and features
 */
async function extractProvisions(classifiedSections, client) {
  // Route sections to the appropriate strategy
  const stratABucket = [];  // IOC, COND-*
  const stratBBucket = [];  // NOSOL, ANTI
  const stratCBucket = [];  // REP-*, STRUCT, CONSID, COV, TERMR, TERMF, MISC
  const stratDBucket = [];  // DEF

  for (const section of classifiedSections) {
    const type = section.provision_type;
    if (!type) continue;

    if (type === 'DEF') {
      stratDBucket.push(section);
    } else if (STRATEGY_A_TYPES.has(type)) {
      stratABucket.push(section);
    } else if (STRATEGY_B_TYPES.has(type)) {
      stratBBucket.push(section);
    } else if (STRATEGY_C_TYPES.has(type)) {
      stratCBucket.push(section);
    } else {
      // Unknown type — treat as Strategy C
      stratCBucket.push(section);
    }
  }

  // Run all strategies concurrently
  const [resultsA, resultsB, resultsC, resultsD] = await Promise.all([
    stratABucket.length > 0 ? strategyA(stratABucket, client) : [],
    stratBBucket.length > 0 ? strategyB(stratBBucket, client) : [],
    stratCBucket.length > 0 ? strategyC(stratCBucket, client) : [],
    stratDBucket.length > 0 ? strategyD(stratDBucket, client) : [],
  ]);

  const allProvisions = [
    ...resultsA,
    ...resultsB,
    ...resultsC,
    ...resultsD,
  ];

  // Post-processing: link definitions to provisions that reference them
  linkDefinitionCrossReferences(allProvisions);

  // Clean up internal-only fields
  for (const p of allProvisions) {
    delete p._error;
  }

  return allProvisions;
}

// ---------------------------------------------------------------------------
// Post-processing: definition cross-reference linking
// ---------------------------------------------------------------------------

/**
 * For each non-DEF provision, find defined terms it references and add
 * them to relatedDefinitions. For DEF provisions, identify which provision
 * types they relate to (e.g., DEF-SUPERIOR → NOSOL provisions).
 */
function linkDefinitionCrossReferences(provisions) {
  // Build a lookup of DEF provisions by code
  const defByCode = {};
  for (const p of provisions) {
    if (p.type === 'DEF' && p.code) {
      defByCode[p.code] = p;
    }
  }

  // Known relationships: certain DEF codes relate to specific provision types
  const DEF_RELATED_TYPES = {
    'DEF-MAE': ['COND-B-MAE'],
    'DEF-MAE-CARVEOUT': ['COND-B-MAE', 'DEF-MAE'],
    'DEF-MAE-DISPROP': ['COND-B-MAE', 'DEF-MAE', 'DEF-MAE-CARVEOUT'],
    'DEF-SUPERIOR': ['NOSOL-SUPERIOR', 'NOSOL-EXCEPT', 'TERMR-SUPERIOR'],
    'DEF-ACQPROPOSAL': ['NOSOL-ACQPROPOSAL', 'NOSOL-PROHIBIT'],
    'DEF-INTERVENING': ['NOSOL-INTERVENING'],
    'DEF-KNOWLEDGE': ['REP-T-NOCHANGE', 'REP-T-LIT', 'REP-T-COMPLY'],
    'DEF-ORDINARY': ['IOC-ORDINARY'],
    'DEF-BURDENSOME': ['ANTI-BURDEN'],
    'DEF-WILLFUL': ['TERMF-SOLE', 'TERMF-EFFECT'],
  };

  // Enrich DEF provisions with known related codes
  for (const p of provisions) {
    if (p.type === 'DEF' && p.code && DEF_RELATED_TYPES[p.code]) {
      for (const rc of DEF_RELATED_TYPES[p.code]) {
        if (!p.relatedDefinitions.includes(rc)) {
          p.relatedDefinitions.push(rc);
        }
      }
    }
  }

  // For non-DEF provisions, look for defined terms in their text
  const defLabels = {};
  for (const [code, entry] of Object.entries(CODES)) {
    if (entry.type === 'DEF') {
      defLabels[entry.label.toLowerCase()] = code;
      for (const alias of (entry.aliases || [])) {
        defLabels[alias.toLowerCase()] = code;
      }
    }
  }

  for (const p of provisions) {
    if (p.type === 'DEF') continue;
    const textLower = p.text.toLowerCase();

    // Check for quoted defined terms
    const quotedPattern = /[“"]([^”"]+)[”"]/g;
    let qm;
    while ((qm = quotedPattern.exec(p.text)) !== null) {
      const term = qm[1].trim().toLowerCase();
      const matchedCode = defLabels[term];
      if (matchedCode && !p.relatedDefinitions.includes(matchedCode)) {
        p.relatedDefinitions.push(matchedCode);
      }
    }

    // Check for well-known term references (capitalized, even without quotes)
    const wellKnownTerms = [
      'Material Adverse Effect', 'Material Adverse Change',
      'Superior Proposal', 'Acquisition Proposal',
      'Intervening Event', 'Willful Breach',
      'Burdensome Condition', 'Company Adverse Recommendation Change',
    ];
    for (const term of wellKnownTerms) {
      if (p.text.includes(term)) {
        const matchedCode = defLabels[term.toLowerCase()];
        if (matchedCode && !p.relatedDefinitions.includes(matchedCode)) {
          p.relatedDefinitions.push(matchedCode);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  extractProvisions,
  // Exposed for testing
  splitSubClauses,
  splitDefinitions,
  findRelatedDefinitions,
  buildFeatureInstructions,
  buildCodesList,
};
