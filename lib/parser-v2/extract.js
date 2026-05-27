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

  const lines = feats.map((f) => {
    let desc = `- ${f.key}: `;
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
    desc += ` — ${f.label}`;
    return desc;
  });

  return `\nExtract these features for each provision:\n${lines.join('\n')}\n`;
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

    const subClausePayload = classifiable.map((sc, idx) => ({
      idx,
      text: sc.text.length > 3000 ? sc.text.substring(0, 3000) : sc.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each sub-clause below into exactly one canonical rubric code, assess favorability, and extract features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SUB-CLAUSES TO CLASSIFY:
${JSON.stringify(subClausePayload, null, 2)}
${featureInstructions}
For each sub-clause, determine:
1. The best matching canonical code from the list above
2. Favorability from the buyer's perspective
3. Feature values (if any apply to this specific sub-clause)

If NO existing code fits, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "code": "COND-M-LEGAL",
      "category": "No Legal Impediment",
      "favorability": "neutral",
      "features": {},
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
1. Whether it is present in this section (true/false)
2. If present, extract the most relevant text excerpt (verbatim)
3. Assess favorability from the buyer's perspective
4. Extract features
${featureInstructions}
If you identify a concept not covered by any existing code, include it with "isNewCode": true and propose a code and label.

Return ONLY valid JSON (no markdown, no backticks):
{
  "provisions": [
    {
      "code": "NOSOL-PROHIBIT",
      "category": "Solicitation Prohibition",
      "present": true,
      "text": "exact verbatim excerpt...",
      "favorability": "neutral",
      "features": {},
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
      heading: s.category || s.number || null,
      text: s.text.length > 4000 ? s.text.substring(0, 4000) : s.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each section below into exactly one canonical rubric code, assess favorability, and extract features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SECTIONS TO CLASSIFY:
${JSON.stringify(sectionPayload, null, 2)}
${featureInstructions}
For each section:
1. Pick the single best matching canonical code
2. Provide the human-readable category label
3. Assess favorability from the buyer's perspective
4. Extract feature values

If NO existing code fits a section, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "code": "${typeKey}-EXAMPLE",
      "category": "Example Label",
      "favorability": "neutral",
      "features": {},
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

    const prompt = `You are a senior M&A attorney. Classify each defined term below into the best matching canonical rubric code, and extract features where applicable.

VALID DEF CODES:
${codesList}

DEFINITIONS TO CLASSIFY:
${JSON.stringify(defPayload, null, 2)}
${featureInstructions}
For each definition:
1. Pick the best matching canonical code
2. Assess favorability from the buyer's perspective
3. Extract feature values (especially for MAE definitions, knowledge standards, etc.)
4. Identify related provision codes — e.g., "Superior Proposal" relates to NOSOL provisions, "MAE" relates to COND-B-MAE

If no existing code fits, set "isNewCode": true and propose a code (format: "DEF-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "code": "DEF-MAE",
      "category": "Material Adverse Effect",
      "favorability": "neutral",
      "features": {},
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
