import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';
import crypto from 'crypto';

export const config = {
  maxDuration: 600,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

// Reuse categories from the legacy pipeline for sub-extraction prompts
const PROVISION_TYPE_CONFIGS = {
  MAE: {
    label: 'Material Adverse Effect',
    categories: [
      'Base Definition', 'General Economic / Market Conditions', 'Changes in Law / GAAP',
      'Industry Conditions', 'War / Terrorism', 'Acts of God / Pandemic',
      'Failure to Meet Projections', 'Announcement / Pendency Effects',
      'Actions at Parent Request', 'Disproportionate Impact Qualifier',
      'Changes in Stock Price', 'Customer / Supplier Relationships'
    ],
  },
  IOC: {
    label: 'Interim Operating Covenants',
    categories: [
      'Ordinary Course Standard', 'M&A / Acquisitions', 'Dividends / Distributions',
      'Equity Issuances', 'Indebtedness', 'Capital Expenditures', 'Employee Compensation',
      'Material Contracts', 'Accounting / Tax Changes', 'Charter / Organizational Amendments',
      'Stock Repurchases / Splits', 'Labor Agreements', 'Litigation Settlements',
      'Liquidation / Dissolution', 'Stockholder Rights Plans', 'Catch-All / General'
    ],
  },
  ANTI: {
    label: 'Antitrust / Regulatory Efforts',
    categories: [
      'Efforts Standard', 'Anti-Hell or High Water', 'Hell or High Water',
      'Burdensome Condition', 'Definition of Burdensome Condition',
      'Obligation to Litigate', 'Obligation Not to Litigate',
      'Regulatory Approval Filing Deadline', 'Cooperation Obligations'
    ],
  },
  COND: {
    label: 'Conditions to Closing',
    categories: [
      'Regulatory Approval / HSR', 'No Legal Impediment',
      'Accuracy of Target Representations', 'Accuracy of Acquirer Representations',
      'Target Compliance with Covenants', 'Acquirer Compliance with Covenants',
      'No MAE', 'Third-Party Consents', 'Stockholder Approval'
    ],
  },
  TERMR: {
    label: 'Termination Rights',
    categories: [
      'Mutual Termination', 'Outside Date', 'Outside Date Extension',
      'Regulatory Failure', 'Breach by Target', 'Breach by Acquirer',
      'Superior Proposal', 'Intervening Event', 'Failure of Conditions'
    ],
  },
  TERMF: {
    label: 'Termination Fees',
    categories: [
      'Target Termination Fee', 'Reverse Termination Fee', 'Regulatory Break-Up Fee',
      'Fee Amount', 'Fee Triggers', 'Expense Reimbursement', 'Fee as Percentage of Deal Value'
    ],
  },
  DEF: {
    label: 'Definitions',
    categories: [
      'Material Adverse Effect', 'Governmental Entity', 'Knowledge',
      'Subsidiary', 'Person', 'Business Day'
    ],
  },
  REP: {
    label: 'Representations & Warranties',
    categories: [
      'Organization / Good Standing', 'Authority / No Conflicts', 'Financial Statements',
      'No Undisclosed Liabilities', 'Absence of Changes', 'Litigation',
      'Tax Matters', 'Employee Benefits', 'Environmental', 'Intellectual Property', 'Material Contracts'
    ],
  },
  COV: {
    label: 'Covenants',
    categories: [
      'No Solicitation', 'Information Access', 'Reasonable Best Efforts',
      'Financing Cooperation', 'Employee Matters', 'Indemnification', 'Public Announcements'
    ],
  },
  MISC: {
    label: 'Miscellaneous',
    categories: [
      'Notices', 'Severability', 'Entire Agreement', 'Amendment / Waiver',
      'Governing Law', 'Jurisdiction', 'Counterparts'
    ],
  },
  STRUCT: {
    label: 'Deal Structure',
    categories: [
      'Merger Consideration', 'Exchange Procedures', 'Treatment of Equity Awards', 'Closing Mechanics'
    ],
  },
};

// Cross-reference signal words — if these appear before a Section/Article
// reference on the same line, it's a cross-ref not a heading
const XREF_SIGNALS = /(?:in|under|pursuant\s+to|of|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in)\s+$/i;

// ─── TOC Parser ───
function parseTOC(fullText) {
  // Look for TABLE OF CONTENTS in first 25% of text (SEC filings often have preamble)
  const searchRegion = fullText.substring(0, Math.floor(fullText.length * 0.25));
  const tocMatch = searchRegion.match(/TABLE\s+OF\s+CONTENTS/i);
  if (!tocMatch) return null;

  const tocStart = tocMatch.index + tocMatch[0].length;

  // Find where TOC ends — look for first real ARTICLE heading in body
  // (TOC entries reference articles but the body starts with the actual heading)
  const afterToc = fullText.substring(tocStart);
  const bodyStartMatch = afterToc.match(/\n\s*(ARTICLE\s+(?:[IVXLC]+|\d+))\s*\n/i);
  const tocEnd = bodyStartMatch ? tocStart + bodyStartMatch.index : tocStart + 5000;
  const tocText = fullText.substring(tocStart, Math.min(tocEnd, fullText.length));

  const entries = [];
  const lines = tocText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Match article entries: ARTICLE I, ARTICLE 1, etc.
    const artMatch = trimmed.match(/^(ARTICLE\s+(?:[IVXLC]+|\d+))\s*[.\-—\s]+\s*(.+?)(?:\s*\.{2,}\s*\d+|\s+\d+)?\s*$/i);
    if (artMatch) {
      entries.push({
        number: artMatch[1].trim(),
        title: artMatch[2].replace(/\.+\s*\d*\s*$/, '').trim(),
        level: 'article',
      });
      continue;
    }

    // Match section entries: Section 1.1, 1.1, SECTION 1.01, etc.
    const secMatch = trimmed.match(/^(?:(?:SECTION|Section)\s+)?(\d+\.\d{1,2}[a-z]?)\s*[.\-—\s]+\s*(.+?)(?:\s*\.{2,}\s*\d+|\s+\d+)?\s*$/i);
    if (secMatch) {
      entries.push({
        number: secMatch[1].trim(),
        title: secMatch[2].replace(/\.+\s*\d*\s*$/, '').trim(),
        level: 'section',
      });
    }
  }

  return entries.length >= 3 ? { entries, tocEndPos: tocEnd } : null;
}

// ─── Check if a match is a cross-reference (not a real heading) ───
function isCrossReference(fullText, matchIndex) {
  // Find start of the line this match is on
  const lineStart = fullText.lastIndexOf('\n', matchIndex - 1) + 1;
  const textBeforeOnLine = fullText.substring(lineStart, matchIndex);

  // Check for cross-reference signal words first — strongest signal
  if (XREF_SIGNALS.test(textBeforeOnLine)) return true;

  // If match is near line start (only whitespace before), it's a heading
  const stripped = textBeforeOnLine.replace(/^\s+/, '');
  if (stripped.length === 0) return false;

  // If there are >25 non-whitespace chars before the match on this line,
  // it's mid-sentence, not a heading (raised from 10 to avoid filtering indented headings)
  if (stripped.length > 25) return true;

  return false;
}

// ─── Phase 1: Structural parsing (deterministic regex, no AI) ───
function parseStructure(fullText) {
  const sections = [];

  // Try TOC-guided parsing first
  const toc = parseTOC(fullText);

  if (toc) {
    // TOC-guided mode: use TOC entries to find section boundaries in body
    const bodyStart = toc.tocEndPos;
    const bodyText = fullText.substring(bodyStart);

    const boundaries = [];

    for (const entry of toc.entries) {
      // Build regex to find this heading in the body
      const escaped = entry.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let pattern;
      if (entry.level === 'article') {
        pattern = new RegExp(`^[ \\t]*${escaped}\\b[^\\n]*`, 'mi');
      } else {
        pattern = new RegExp(`^[ \\t]*(?:(?:SECTION|Section)\\s+)?${escaped}\\b[^\\n]*`, 'mi');
      }

      const match = pattern.exec(bodyText);
      if (match) {
        boundaries.push({
          heading: match[0].trim(),
          startChar: bodyStart + match.index,
          level: entry.level,
          tocTitle: entry.title,
        });
      }
    }

    // Sort boundaries by position and build sections
    boundaries.sort((a, b) => a.startChar - b.startChar);
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i].startChar;
      const end = i + 1 < boundaries.length ? boundaries[i + 1].startChar : fullText.length;
      const text = fullText.substring(start, end).trim();
      if (text.length < 20) continue;
      sections.push({
        heading: boundaries[i].heading,
        text,
        level: boundaries[i].level,
        startChar: start,
        endChar: end,
      });
    }
  }

  // If TOC didn't produce enough sections, use regex with cross-ref filtering
  if (sections.length < 5) {
    sections.length = 0;

    // Extract definitions
    const defRegex = /"([^"]{3,80})"\s+(?:means|shall\s+mean|has\s+the\s+meaning)/gi;
    let defMatch;
    while ((defMatch = defRegex.exec(fullText)) !== null) {
      const defName = defMatch[1];
      const startChar = defMatch.index;
      const afterDef = fullText.substring(startChar);
      const nextBoundary = afterDef.search(/\n\s*"[^"]{3,80}"\s+(?:means|shall\s+mean|has\s+the\s+meaning)|\n\s*(?:ARTICLE|SECTION)\s+/i);
      const endChar = nextBoundary > 0 ? startChar + nextBoundary : Math.min(startChar + 5000, fullText.length);
      sections.push({
        heading: defName,
        text: fullText.substring(startChar, endChar).trim(),
        level: 'definition',
        startChar,
        endChar,
      });
    }

    // Detect article boundaries with cross-ref filtering
    const articleRegex = /ARTICLE\s+(?:[IVXLC]+|\d+)\b[^\n]*/gmi;
    const articles = [];
    let artMatch;
    while ((artMatch = articleRegex.exec(fullText)) !== null) {
      if (!isCrossReference(fullText, artMatch.index)) {
        articles.push({ heading: artMatch[0].trim(), startChar: artMatch.index });
      }
    }

    // Detect section boundaries with cross-ref filtering
    const sectionRegex = /(?:(?:SECTION|Section)\s+)?(\d+\.\d{1,2}[a-z]?)\b[^\n]*/gm;
    const sectionMatches = [];
    let secMatch;
    while ((secMatch = sectionRegex.exec(fullText)) !== null) {
      if (!isCrossReference(fullText, secMatch.index)) {
        sectionMatches.push({ heading: secMatch[0].trim(), startChar: secMatch.index });
      }
    }

    // Build section entries from section boundaries
    for (let i = 0; i < sectionMatches.length; i++) {
      const start = sectionMatches[i].startChar;
      const end = i + 1 < sectionMatches.length
        ? sectionMatches[i + 1].startChar
        : (articles.length > 0 ? findNextArticleAfter(articles, start, fullText.length) : fullText.length);
      const text = fullText.substring(start, end).trim();
      if (text.length < 20) continue;
      sections.push({
        heading: sectionMatches[i].heading,
        text,
        level: 'section',
        startChar: start,
        endChar: end,
      });
    }

    // Add article-level entries for articles without sub-sections
    for (let i = 0; i < articles.length; i++) {
      const artStart = articles[i].startChar;
      const artEnd = i + 1 < articles.length ? articles[i + 1].startChar : fullText.length;
      const hasSections = sectionMatches.some(s => s.startChar >= artStart && s.startChar < artEnd);
      if (!hasSections) {
        const text = fullText.substring(artStart, artEnd).trim();
        if (text.length >= 20) {
          sections.push({
            heading: articles[i].heading,
            text,
            level: 'article',
            startChar: artStart,
            endChar: artEnd,
          });
        }
      }
    }
  }

  // Fallback: if still <5 sections, split on double-newlines
  if (sections.length < 5) {
    sections.length = 0;
    const chunks = fullText.split(/\n\s*\n/);
    let offset = 0;
    chunks.forEach((chunk) => {
      const trimmed = chunk.trim();
      if (trimmed.length >= 50) {
        sections.push({
          heading: trimmed.substring(0, 80).replace(/\n/g, ' '),
          text: trimmed,
          level: 'section',
          startChar: offset,
          endChar: offset + chunk.length,
        });
      }
      offset += chunk.length + 2;
    });
  }

  // 1e: Split large article-level chunks that lack sub-sections
  const expanded = [];
  for (const sec of sections) {
    if (sec.level === 'article' && sec.text.length > 3000) {
      const subs = splitArticleIntoParagraphs(sec);
      if (subs.length > 1) {
        expanded.push(...subs);
        continue;
      }
    }
    expanded.push(sec);
  }

  // Sort by position in document
  expanded.sort((a, b) => a.startChar - b.startChar);

  // 1f: Coverage tracking
  const coveredChars = expanded.reduce((sum, s) => sum + (s.endChar - s.startChar), 0);
  const coverage = {
    totalChars: fullText.length,
    coveredChars: Math.min(coveredChars, fullText.length),
    coveragePct: Math.round((Math.min(coveredChars, fullText.length) / fullText.length) * 100),
    sectionCount: expanded.length,
  };

  return { sections: expanded, coverage };
}

// ─── Split large article chunks on paragraph markers ───
function splitArticleIntoParagraphs(section) {
  const text = section.text;
  // Match paragraph-level markers: (a), (b), (i), (ii), (1), (2), etc.
  const paraRegex = /\n\s*\((?:[a-z]{1,3}|[ivxlc]+|\d{1,2})\)\s/gi;
  const splits = [];
  let match;
  while ((match = paraRegex.exec(text)) !== null) {
    splits.push(match.index);
  }
  if (splits.length < 2) return [section];

  const results = [];
  // Include preamble before first marker if substantial
  if (splits[0] > 100) {
    results.push({
      heading: section.heading + ' (preamble)',
      text: text.substring(0, splits[0]).trim(),
      level: 'paragraph',
      startChar: section.startChar,
      endChar: section.startChar + splits[0],
    });
  }

  for (let i = 0; i < splits.length; i++) {
    const start = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1] : text.length;
    const chunk = text.substring(start, end).trim();
    if (chunk.length < 20) continue;
    const label = chunk.match(/^\(([^)]+)\)/)?.[1] || String(i + 1);
    results.push({
      heading: section.heading + ` (${label})`,
      text: chunk,
      level: 'paragraph',
      startChar: section.startChar + start,
      endChar: section.startChar + end,
    });
  }

  return results.length > 1 ? results : [section];
}

// ─── Phase 2: Gap detection and recovery ───
function detectGaps(sections) {
  // Extract all section numbers, group by article
  const byArticle = {};
  for (const s of sections) {
    const numMatch = s.heading.match(/(\d+)\.(\d{1,2})/);
    if (!numMatch) continue;
    const art = parseInt(numMatch[1], 10);
    const sec = parseInt(numMatch[2], 10);
    if (!byArticle[art]) byArticle[art] = new Set();
    byArticle[art].add(sec);
  }

  const gaps = [];

  // Find sequential gaps within each article
  for (const [artStr, secSet] of Object.entries(byArticle)) {
    const art = parseInt(artStr, 10);
    const nums = Array.from(secSet).sort((a, b) => a - b);
    if (nums.length < 2) continue;
    for (let i = 0; i < nums.length - 1; i++) {
      for (let missing = nums[i] + 1; missing < nums[i + 1]; missing++) {
        gaps.push({ article: art, section: missing, label: `${art}.${String(missing).padStart(nums[0] > 9 ? 2 : 1, '0')}` });
      }
    }
  }

  // Detect missing article numbers
  const artNums = Object.keys(byArticle).map(Number).sort((a, b) => a - b);
  if (artNums.length >= 2) {
    for (let i = 0; i < artNums.length - 1; i++) {
      for (let missing = artNums[i] + 1; missing < artNums[i + 1]; missing++) {
        gaps.push({ article: missing, section: null, label: `Article ${missing}` });
      }
    }
  }

  return gaps;
}

function recoverGaps(gaps, fullText, sections) {
  const recovered = [];

  for (const gap of gaps) {
    let pattern;
    if (gap.section != null) {
      // Look for the missing section number
      const secNum = `${gap.article}.${String(gap.section).padStart(gap.label.includes('.0') ? 2 : 1, '0')}`;
      pattern = new RegExp(`(?:(?:SECTION|Section)\\s+)?${secNum.replace('.', '\\.')}\\b[^\\n]*`, 'gm');
    } else {
      // Look for a missing article
      pattern = new RegExp(`ARTICLE\\s+${romanize(gap.article) || gap.article}\\b[^\\n]*`, 'gmi');
    }

    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      // Skip if this is a cross-reference
      if (isCrossReference(fullText, match.index)) continue;

      // Skip if this position is already covered by an existing section
      const alreadyCovered = sections.some(s => match.index >= s.startChar && match.index < s.endChar);
      if (alreadyCovered) continue;

      // Find the end: next known section boundary or +5000 chars
      let endChar = Math.min(match.index + 5000, fullText.length);
      for (const s of sections) {
        if (s.startChar > match.index && s.startChar < endChar) {
          endChar = s.startChar;
        }
      }

      const text = fullText.substring(match.index, endChar).trim();
      if (text.length < 30) continue;

      recovered.push({
        heading: match[0].trim(),
        text,
        level: gap.section != null ? 'section' : 'article',
        startChar: match.index,
        endChar: endChar,
        recovered: true,
      });
      break; // Only recover the first non-xref match per gap
    }
  }

  return recovered;
}

// Convert integer to Roman numeral (for article gap detection)
function romanize(num) {
  if (num < 1 || num > 50) return null;
  const vals = [50, 40, 10, 9, 5, 4, 1];
  const syms = ['L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}

function findNextArticleAfter(articles, pos, fallback) {
  for (const a of articles) {
    if (a.startChar > pos) return a.startChar;
  }
  return fallback;
}

// ─── Phase 3: Classify sections via AI with expanded context + complexity tiers ───
async function classifySections(sections, client, rules) {
  // Build payload with expanded preview: 1500 chars + tail for long sections
  const sectionSummaries = sections.map((s, idx) => {
    const summary = {
      idx,
      heading: s.heading.substring(0, 120),
      preview: s.text.substring(0, 1500),
      level: s.level,
      charCount: s.text.length,
    };
    // Add tail context for long sections (catches conclusion/carve-out language)
    if (s.text.length > 3000) {
      summary.tail = s.text.substring(s.text.length - 500);
    }
    return summary;
  });

  const allTypes = Object.keys(PROVISION_TYPE_CONFIGS);
  const typeList = allTypes.map(k => `${k} (${PROVISION_TYPE_CONFIGS[k].label})`).join(', ');

  // Batch into groups of 100 (larger previews = fewer per batch)
  const batchSize = 100;
  const batches = [];
  for (let i = 0; i < sectionSummaries.length; i += batchSize) {
    batches.push(sectionSummaries.slice(i, i + batchSize));
  }

  const allClassifications = [];

  await Promise.all(batches.map(async (batch) => {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: `You are a senior M&A attorney classifying sections of a merger agreement.

For each section below, classify it into one of these provision types: ${typeList}

Assign a COMPLEXITY level to determine extraction depth:
- "high": MAE carve-out sections, IOC restriction lists, COND condition lists, TERMR/TERMF trigger/fee lists — these have detailed sub-provisions that need individual extraction
- "medium": REP articles with multiple sub-representations (Tax, IP, Environmental, etc.), COV articles with multiple covenants (No-Shop, Efforts, Financing Cooperation), STRUCT sections with multiple deal terms, DEF sections with multiple defined terms, AND any section >3000 chars that contains sub-numbered items like (a), (b), (i), (ii)
- "low": Single-topic sections <2000 chars, individual definitions, simple miscellaneous boilerplate, notices, governing law

IMPORTANT: A section titled "Representations and Warranties of the Company" that contains sub-sections (e.g., 4.1 Organization, 4.2 Authority, 4.3 Financial Statements) MUST be classified as "medium" complexity. Same for Covenants articles with multiple sub-covenants.

Display tiers: 1=Core (MAE, termination, conditions, antitrust, key IOC), 2=Supporting (reps, covenants, deal structure), 3=Reference (definitions, miscellaneous boilerplate).

SECTIONS:
${JSON.stringify(batch)}

Return ONLY valid JSON array (no markdown, no backticks):
[{
  "idx": 0,
  "provision_type": "MAE",
  "category": "specific sub-category name",
  "display_tier": 1,
  "complexity": "high"
}]

Rules:
- Every section must appear in the output
- Use the exact provision_type keys: ${allTypes.join(', ')}
- For sections that don't clearly fit, use MISC
- complexity must be one of: "high", "medium", "low"
- When a "tail" field is present, use it along with "preview" to understand the full scope of the section${rules && rules.length > 0 ? '\n\nLEARNED RULES (from prior review sessions):\n' + rules.filter(r => r.scope === 'classify' || r.scope === 'parse').map(r => '- ' + r.rule).join('\n') : ''}`
      }],
    });

    const raw = resp.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(clean);
      allClassifications.push(...parsed);
    } catch {
      batch.forEach(s => {
        allClassifications.push({
          idx: s.idx,
          provision_type: 'MISC',
          category: 'Unclassified',
          display_tier: 3,
          complexity: 'low',
        });
      });
    }
  }));

  // Map classifications back to sections
  const classifiedSections = sections.map((s, idx) => {
    const cls = allClassifications.find(c => c.idx === idx);
    return {
      ...s,
      provision_type: cls?.provision_type || 'MISC',
      category: cls?.category || 'Unclassified',
      display_tier: cls?.display_tier || 3,
      complexity: cls?.complexity || 'low',
    };
  });

  return classifiedSections;
}

// ─── Concurrency limiter ───
async function runWithConcurrency(tasks, maxConcurrent = 8) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, async () => {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Phase 4: Extract sub-provisions — three-tier universal extraction ───
async function extractSubProvisions(classifiedSections, client, calibrationByType) {
  const results = [];

  // Split into three tiers by complexity
  const highSections = classifiedSections.filter(s => s.complexity === 'high');
  const mediumSections = classifiedSections.filter(s => s.complexity === 'medium');
  const lowSections = classifiedSections.filter(s => s.complexity !== 'high' && s.complexity !== 'medium');

  // ─── Tier 1 (high): Full sub-extraction per category ───
  const highTasks = highSections.map((section) => async () => {
    const typeConfig = PROVISION_TYPE_CONFIGS[section.provision_type];
    if (!typeConfig) {
      results.push({
        type: section.provision_type,
        category: section.category,
        text: section.text,
        favorability: 'neutral',
        display_tier: section.display_tier,
        startChar: section.startChar,
      });
      return;
    }

    let calibrationSection = '';
    const examples = calibrationByType[section.provision_type];
    if (examples && examples.length > 0) {
      calibrationSection = '\nCALIBRATION EXAMPLES:\n';
      for (const ex of examples.slice(0, 3)) {
        const exText = ex.full_text.length > 400 ? ex.full_text.substring(0, 400) + '...' : ex.full_text;
        calibrationSection += `Category: "${ex.category}" | Favorability: ${ex.ai_favorability || 'neutral'}\nText: "${exText}"\n\n`;
      }
    }

    try {
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are a senior M&A attorney extracting "${typeConfig.label}" sub-provisions from this section of a merger agreement.

SECTION TEXT:
${section.text}
${calibrationSection}
Extract each sub-provision category. For each, copy the EXACT text from the agreement (verbatim, word-for-word).
Include the COMPLETE text of each provision, not just the title or first sentence.

Categories to look for:
${typeConfig.categories.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return ONLY valid JSON (no markdown, no backticks):
{
  "provisions": [
    {
      "category": "exact category name from list above",
      "text": "exact verbatim text from agreement",
      "favorability": "strong-buyer|mod-buyer|neutral|mod-seller|strong-seller"
    }
  ]
}`
        }],
      });

      const raw = resp.content.map(c => c.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      try {
        const parsed = JSON.parse(clean);
        (parsed.provisions || []).forEach(prov => {
          if (!prov.text || prov.text.length < 20) return;
          results.push({
            type: section.provision_type,
            category: prov.category,
            text: prov.text.trim(),
            favorability: prov.favorability || 'neutral',
            display_tier: section.display_tier,
            startChar: section.startChar,
          });
        });
      } catch {
        results.push({
          type: section.provision_type,
          category: section.category,
          text: section.text,
          favorability: 'neutral',
          display_tier: section.display_tier,
          startChar: section.startChar,
        });
      }
    } catch (err) {
      results.push({
        type: section.provision_type,
        category: section.category,
        text: section.text,
        favorability: 'neutral',
        display_tier: section.display_tier,
        startChar: section.startChar,
        error: err.message,
      });
    }
  });

  // ─── Tier 2 (medium): Structured sub-extraction for REP, COV, STRUCT, multi-DEF ───
  const mediumTasks = mediumSections.map((section) => async () => {
    const typeConfig = PROVISION_TYPE_CONFIGS[section.provision_type];
    const typeLabel = typeConfig?.label || section.provision_type;

    try {
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        messages: [{
          role: 'user',
          content: `You are a senior M&A attorney splitting a "${typeLabel}" section into its individual sub-provisions.

SECTION TEXT:
${section.text}

This section contains multiple sub-provisions. Split it into individual provisions by their internal numbering or headings (e.g., Section 4.1 Organization, Section 4.2 Authority, (a) Tax Matters, (b) Environmental, etc.).

For each sub-provision:
1. Identify its specific sub-category name (e.g., "Organization / Good Standing", "Tax Matters", "No Solicitation")
2. Copy the EXACT verbatim text
3. Rate its favorability from the buyer's perspective

Return ONLY valid JSON (no markdown, no backticks):
{
  "provisions": [
    {
      "category": "specific sub-category name",
      "text": "exact verbatim text from agreement",
      "favorability": "strong-buyer|mod-buyer|neutral|mod-seller|strong-seller"
    }
  ]
}

Rules:
- Extract EVERY sub-provision, not just the first few
- Each provision should be the complete text of that sub-section
- Use descriptive category names that identify the specific topic
- Do NOT combine multiple sub-provisions into one`
        }],
      });

      const raw = resp.content.map(c => c.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      try {
        const parsed = JSON.parse(clean);
        const provs = parsed.provisions || [];
        if (provs.length > 0) {
          provs.forEach(prov => {
            if (!prov.text || prov.text.length < 20) return;
            results.push({
              type: section.provision_type,
              category: prov.category,
              text: prov.text.trim(),
              favorability: prov.favorability || 'neutral',
              display_tier: section.display_tier,
              startChar: section.startChar,
            });
          });
        } else {
          // No provisions extracted — use whole section
          results.push({
            type: section.provision_type,
            category: section.category,
            text: section.text,
            favorability: 'neutral',
            display_tier: section.display_tier,
            startChar: section.startChar,
          });
        }
      } catch {
        results.push({
          type: section.provision_type,
          category: section.category,
          text: section.text,
          favorability: 'neutral',
          display_tier: section.display_tier,
          startChar: section.startChar,
        });
      }
    } catch (err) {
      results.push({
        type: section.provision_type,
        category: section.category,
        text: section.text,
        favorability: 'neutral',
        display_tier: section.display_tier,
        startChar: section.startChar,
        error: err.message,
      });
    }
  });

  // ─── Tier 3 (low): Batch favorability assessment ───
  const favBatchSize = 15;
  const favBatches = [];
  for (let i = 0; i < lowSections.length; i += favBatchSize) {
    favBatches.push(lowSections.slice(i, i + favBatchSize));
  }

  const lowTasks = favBatches.map((batch) => async () => {
    const batchPayload = batch.map((s, i) => ({
      i,
      type: s.provision_type,
      category: s.category,
      text: s.text.length <= 3000 ? s.text : s.text.substring(0, 1500),
    }));

    try {
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Rate the favorability of each merger agreement provision below from the buyer's perspective.

PROVISIONS:
${JSON.stringify(batchPayload)}

Return ONLY valid JSON array (no markdown, no backticks):
[{ "i": 0, "favorability": "strong-buyer|mod-buyer|neutral|mod-seller|strong-seller" }]`
        }],
      });

      const raw = resp.content.map(c => c.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      let favResults;
      try { favResults = JSON.parse(clean); } catch { favResults = []; }

      batch.forEach((s, idx) => {
        const fr = favResults.find(f => f.i === idx);
        results.push({
          type: s.provision_type,
          category: s.category,
          text: s.text,
          favorability: fr?.favorability || 'neutral',
          display_tier: s.display_tier,
          startChar: s.startChar,
        });
      });
    } catch {
      batch.forEach(s => {
        results.push({
          type: s.provision_type,
          category: s.category,
          text: s.text,
          favorability: 'neutral',
          display_tier: s.display_tier,
          startChar: s.startChar,
        });
      });
    }
  });

  // Run all tiers with concurrency limiter
  await runWithConcurrency([...highTasks, ...mediumTasks, ...lowTasks], 8);

  return results;
}

// ─── Phase 5: Dedup — type-aware with higher thresholds ───
function mergeAndDedup(allProvisions) {
  const isDuplicate = new Set();
  for (let i = 0; i < allProvisions.length; i++) {
    if (isDuplicate.has(i)) continue;
    for (let j = i + 1; j < allProvisions.length; j++) {
      if (isDuplicate.has(j)) continue;
      // Only dedup within the same provision type
      if (allProvisions[i].type !== allProvisions[j].type) continue;
      const a = allProvisions[i].text.replace(/\s+/g, ' ').trim();
      const b = allProvisions[j].text.replace(/\s+/g, ' ').trim();
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length > b.length ? a : b;
      const checkLen = Math.floor(shorter.length * 0.8);
      if (checkLen > 50 && longer.includes(shorter.substring(0, checkLen))) {
        const discardIdx = a.length <= b.length ? i : j;
        isDuplicate.add(discardIdx);
      }
    }
  }
  const kept = allProvisions.filter((_, idx) => !isDuplicate.has(idx));
  return { kept, deduplicatedCount: isDuplicate.size };
}


// ─── Phase 6: Verify completeness against standard M&A provisions ───
function verifyCompleteness(provisions, fullText) {
  const checklist = [
    { type: 'STRUCT', keywords: ['consideration', 'per share', 'merger sub'], minProvisions: 1 },
    { type: 'COND', keywords: ['conditions', 'closing'], minProvisions: 2 },
    { type: 'TERMR', keywords: ['terminate', 'termination'], minProvisions: 1 },
    { type: 'TERMF', keywords: ['termination fee', 'break-up'], minProvisions: 1 },
    { type: 'REP', keywords: ['represents and warrants'], minProvisions: 3 },
    { type: 'COV', keywords: ['covenant', 'shall', 'shall not'], minProvisions: 2 },
  ];

  const warnings = [];
  const lowerText = fullText.toLowerCase();

  for (const check of checklist) {
    const count = provisions.filter(p => p.type === check.type).length;
    if (count < check.minProvisions) {
      const keywordsFound = check.keywords.some(kw => lowerText.includes(kw.toLowerCase()));
      if (keywordsFound) {
        warnings.push({
          type: check.type,
          label: PROVISION_TYPE_CONFIGS[check.type]?.label || check.type,
          expected: check.minProvisions,
          found: count,
          message: `Expected at least ${check.minProvisions} ${PROVISION_TYPE_CONFIGS[check.type]?.label || check.type} provision(s) but found ${count}. Keywords like "${check.keywords[0]}" appear in the agreement text.`,
        });
      }
    }
  }

  return warnings;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, full_text, title, source_url, filing_date, preview, rules } = req.body;
  if (!full_text) {
    return res.status(400).json({ error: 'full_text is required' });
  }
  if (!preview && !deal_id) {
    return res.status(400).json({ error: 'deal_id is required when not in preview mode' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb && !preview) return res.status(500).json({ error: 'Supabase not configured' });

  const timing = {};
  const totalStart = Date.now();

  try {
    let agreementSourceId = null;

    // Store full agreement text (skip in preview mode)
    if (!preview) {
      const textHash = crypto.createHash('sha256').update(full_text).digest('hex');
      const { data: existing } = await sb.from('agreement_sources')
        .select('id').eq('text_hash', textHash).single();

      if (existing) {
        agreementSourceId = existing.id;
      } else {
        const { data: srcData, error: srcError } = await sb.from('agreement_sources')
          .insert({
            title: title || 'Merger Agreement',
            full_text,
            text_hash: textHash,
            source_url: source_url || null,
            filing_date: filing_date || null,
            metadata: { ingested_at: new Date().toISOString(), char_count: full_text.length },
          })
          .select().single();
        if (srcError) return res.status(500).json({ error: 'Failed to store agreement: ' + srcError.message });
        agreementSourceId = srcData.id;
      }
    }

    // Fetch calibration examples
    const calibrationByType = {};
    if (sb) {
      const typeKeys = Object.keys(PROVISION_TYPE_CONFIGS);
      await Promise.all(typeKeys.map(async (typeKey) => {
        const { data: examples } = await sb.from('provisions')
          .select('type, category, full_text, ai_favorability, ai_metadata')
          .eq('type', typeKey)
          .order('created_at', { ascending: false })
          .limit(3);
        if (examples && examples.length > 0) {
          examples.sort((a, b) => {
            const aCorrected = a.ai_metadata?.user_corrected ? 0 : 1;
            const bCorrected = b.ai_metadata?.user_corrected ? 0 : 1;
            return aCorrected - bCorrected;
          });
          calibrationByType[typeKey] = examples;
        }
      }));
    }

    const client = new Anthropic({ apiKey });
    const diagnostics = {};

    // Phase 1: Parse structure
    const parseStart = Date.now();
    const { sections, coverage } = parseStructure(full_text);
    timing.parse_ms = Date.now() - parseStart;
    timing.section_count = sections.length;
    diagnostics.coverage = coverage;

    // Phase 2: Detect and recover gaps
    const gapStart = Date.now();
    const gaps = detectGaps(sections);
    const recovered = recoverGaps(gaps, full_text, sections);
    if (recovered.length > 0) {
      sections.push(...recovered);
      sections.sort((a, b) => a.startChar - b.startChar);
    }
    timing.gap_ms = Date.now() - gapStart;
    diagnostics.gaps = { detected: gaps.length, recovered: recovered.length };

    // Phase 3: Classify sections
    const classifyStart = Date.now();
    const classifiedSections = await classifySections(sections, client, rules);
    timing.classify_ms = Date.now() - classifyStart;

    // Track section breakdown by complexity
    diagnostics.sectionBreakdown = {
      high: classifiedSections.filter(s => s.complexity === 'high').length,
      medium: classifiedSections.filter(s => s.complexity === 'medium').length,
      low: classifiedSections.filter(s => s.complexity !== 'high' && s.complexity !== 'medium').length,
    };

    // Phase 4: Extract sub-provisions
    const extractStart = Date.now();
    const allProvisions = await extractSubProvisions(classifiedSections, client, calibrationByType);
    timing.extract_ms = Date.now() - extractStart;

    // Phase 5: Dedup
    const dedupStart = Date.now();
    const { kept, deduplicatedCount } = mergeAndDedup(allProvisions);
    timing.dedup_ms = Date.now() - dedupStart;

    // Phase 6: Verify completeness
    const verifyStart = Date.now();
    const completenessWarnings = verifyCompleteness(kept, full_text);
    timing.verify_ms = Date.now() - verifyStart;
    diagnostics.completeness = completenessWarnings;

    timing.total_ms = Date.now() - totalStart;
    timing.mode = 'segment';

    // Assign sort_order based on document position
    kept.sort((a, b) => (a.startChar || 0) - (b.startChar || 0));
    kept.forEach((p, idx) => { p.sort_order = idx; });

    // Group results by type for response
    const resultsByType = {};
    kept.forEach(p => {
      if (!resultsByType[p.type]) {
        const config = PROVISION_TYPE_CONFIGS[p.type];
        resultsByType[p.type] = {
          type: p.type,
          label: config?.label || p.type,
          extracted: 0,
          created: 0,
          provisions: preview ? [] : undefined,
        };
      }
      resultsByType[p.type].extracted++;
      resultsByType[p.type].created++;
      if (preview) {
        resultsByType[p.type].provisions.push({
          type: p.type,
          category: p.category,
          text: p.text,
          favorability: p.favorability || 'neutral',
          display_tier: p.display_tier || 2,
          sort_order: p.sort_order,
        });
      }
    });

    // Save provisions if not preview
    if (!preview) {
      for (const prov of kept) {
        await sb.from('provisions')
          .insert({
            deal_id,
            type: prov.type,
            category: prov.category,
            full_text: prov.text.trim(),
            sort_order: prov.sort_order,
            ai_favorability: prov.favorability || 'neutral',
            display_tier: prov.display_tier || 2,
            agreement_source_id: agreementSourceId,
            ai_metadata: { ai_extracted: true, ingestion_mode: 'segment', ingestion_timing: timing },
          })
          .select().single();
      }
    }

    const results = Object.values(resultsByType);

    return res.json({
      success: true,
      preview: !!preview,
      agreement_source_id: agreementSourceId,
      deduplicated_count: deduplicatedCount,
      timing,
      diagnostics,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, timing });
  }
}
