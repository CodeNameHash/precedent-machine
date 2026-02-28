import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '../../../lib/supabase';
import { cleanEdgarText, removeRepeatedHeaders, cleanSectionText } from '../../../lib/edgar-cleanup';
import crypto from 'crypto';

export const config = {
  maxDuration: 300,
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

// ─── Phase 1: Structural parsing — find every Section heading, split on it ───

// Cross-reference signals — words that precede "Section X.XX" in cross-refs
const XREF_SIGNALS = /(?:in|under|of|to|pursuant\s+to|set\s+forth\s+in|described\s+in|defined\s+in|referenced\s+in|subject\s+to|accordance\s+with|provided\s+in|specified\s+in|required\s+by|referred\s+to\s+in|see|per)\s*$/i;

// Find where agreement body starts — skip past TABLE OF CONTENTS
// TOC entries have "SECTION X.XX." on its own line (just the number).
// Real body sections have body text on the same line: "SECTION X.XX. Title. Body text..."
function findBodyStart(fullText) {
  const tocMatch = fullText.match(/TABLE\s+OF\s+CONTENTS/i);
  if (tocMatch) {
    const afterToc = fullText.substring(tocMatch.index);

    // Collect all SECTION heading positions after TOC marker
    const secPattern = /(?:SECTION|Section)\s+\d+\.\d{1,2}\b/g;
    let sm;
    while ((sm = secPattern.exec(afterToc)) !== null) {
      // Check if the heading line has body text (not just a TOC stub)
      const restOfLine = afterToc.substring(sm.index).match(/[^\n]+/);
      if (!restOfLine) continue;
      const afterNum = restOfLine[0].replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*\.?\s*/, '');
      if (afterNum.length > 30) {
        // Real section found — find the preceding ARTICLE heading
        const before = afterToc.substring(0, sm.index);
        const artPattern = /\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/gi;
        let lastArtIdx = -1;
        let am;
        while ((am = artPattern.exec(before)) !== null) lastArtIdx = am.index;
        if (lastArtIdx >= 0) return tocMatch.index + lastArtIdx + 1;
        return tocMatch.index + sm.index;
      }
    }
  }
  // No TOC — look for first ARTICLE heading anywhere
  const firstArt = fullText.match(/\n\s*ARTICLE\s+(?:[IVXLC]+|\d+)\b/i);
  if (firstArt) return firstArt.index + 1;
  return 0;
}

// Check if a "Section X.XX" match is a real heading vs a cross-reference
function isHeading(text, matchIndex) {
  // Look at the 80 chars before the match
  const lookback = text.substring(Math.max(0, matchIndex - 80), matchIndex);

  // Find the last newline before the match
  const lastNL = lookback.lastIndexOf('\n');

  if (lastNL !== -1) {
    // Text between last newline and match
    const gap = lookback.substring(lastNL + 1);
    // If only whitespace between newline and "Section" → heading
    if (gap.trim().length === 0) return true;
    // If very short non-whitespace (indented heading label) → heading
    if (gap.trim().length <= 5) return true;
  } else if (matchIndex <= 80) {
    // Near start of text → heading
    return true;
  }

  // Check for cross-reference signal words immediately before
  const immediateBefore = text.substring(Math.max(0, matchIndex - 40), matchIndex);
  if (XREF_SIGNALS.test(immediateBefore)) return false;

  // If we're more than 80 chars from a newline, it's mid-paragraph → cross-ref
  return false;
}

function parseStructure(fullText) {
  const bodyStart = findBodyStart(fullText);
  const body = fullText.substring(bodyStart);

  // Step 1: Find ALL "Section X.XX" / "SECTION X.XX" occurrences in body
  // No line anchoring — find them wherever they appear
  const sectionPattern = /(?:SECTION|Section)\s+(\d+\.\d{1,2})\b/g;
  const allMatches = [];
  let m;
  while ((m = sectionPattern.exec(body)) !== null) {
    allMatches.push({
      index: m.index,
      absIndex: bodyStart + m.index,
      number: m[1],
      fullMatch: m[0],
    });
  }

  // Also try bare "X.XX Title" format if "Section" pattern found < 5
  if (allMatches.length < 5) {
    const barePattern = /(?:^|\n)\s*(\d+\.\d{1,2})\s+[A-Z]/g;
    while ((m = barePattern.exec(body)) !== null) {
      // Don't duplicate if already matched as "Section X.XX"
      const num = m[1];
      if (!allMatches.some(a => a.number === num && Math.abs(a.index - m.index) < 20)) {
        allMatches.push({
          index: m.index + (m[0].startsWith('\n') ? 1 : 0),
          absIndex: bodyStart + m.index + (m[0].startsWith('\n') ? 1 : 0),
          number: num,
          fullMatch: m[0].trim(),
        });
      }
    }
    allMatches.sort((a, b) => a.index - b.index);
  }

  // Step 2: Classify each match as heading vs cross-reference
  const headings = allMatches.filter(match => isHeading(body, match.index));

  // Step 3: Diagnostic — detect delimiter pattern for reporting
  const delimiterPattern = allMatches.length >= 5
    ? (body.match(/SECTION\s+\d/i) ? 'Section X.XX' : 'X.XX bare')
    : 'fallback';

  // Step 4: Build sections between consecutive heading matches
  const sections = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    const rawText = body.substring(start, end).trim();
    const text = cleanSectionText(rawText);
    // Grab the heading line
    const headingLine = text.split('\n')[0].substring(0, 200).trim();
    if (text.length < 20) continue;
    sections.push({
      heading: headingLine,
      text,
      level: 'section',
      startChar: bodyStart + start,
      endChar: bodyStart + end,
      number: headings[i].number,
    });
  }

  // Step 5: Find ARTICLE boundaries, add articles without sub-sections
  const articleRegex = /ARTICLE\s+(?:[IVXLC]+|\d+)\b[^\n]*/gi;
  const articles = [];
  let artMatch;
  while ((artMatch = articleRegex.exec(body)) !== null) {
    if (isHeading(body, artMatch.index)) {
      articles.push({
        heading: artMatch[0].trim(),
        startChar: bodyStart + artMatch.index,
      });
    }
  }
  for (let i = 0; i < articles.length; i++) {
    const artStart = articles[i].startChar;
    const artEnd = i + 1 < articles.length ? articles[i + 1].startChar : fullText.length;
    const hasSections = sections.some(s => s.startChar >= artStart && s.startChar < artEnd);
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

  // Step 6: Fallback — split on double-newlines if nothing found
  if (sections.length < 3) {
    sections.length = 0;
    const chunks = body.split(/\n\s*\n/);
    let offset = bodyStart;
    for (const chunk of chunks) {
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
    }
  }

  // Sort by document position
  sections.sort((a, b) => a.startChar - b.startChar);

  // Coverage tracking
  const coveredChars = sections.reduce((sum, s) => sum + (s.endChar - s.startChar), 0);
  const coverage = {
    totalChars: fullText.length,
    coveredChars: Math.min(coveredChars, fullText.length),
    coveragePct: Math.round((Math.min(coveredChars, fullText.length) / fullText.length) * 100),
    sectionCount: sections.length,
    bodyStart,
    delimiterPattern,
    totalSectionMatches: allMatches.length,
    headingMatches: headings.length,
  };

  return { sections, coverage };
}

// ─── Phase 2: Gap detection and recovery ───
function detectGaps(sections) {
  const byArticle = {};
  for (const s of sections) {
    const numMatch = (s.number || s.heading).match(/(\d+)\.(\d{1,2})/);
    if (!numMatch) continue;
    const art = parseInt(numMatch[1], 10);
    const sec = parseInt(numMatch[2], 10);
    if (!byArticle[art]) byArticle[art] = new Set();
    byArticle[art].add(sec);
  }

  const gaps = [];
  for (const [artStr, secSet] of Object.entries(byArticle)) {
    const art = parseInt(artStr, 10);
    const nums = Array.from(secSet).sort((a, b) => a - b);
    if (nums.length < 2) continue;
    // Detect if document uses zero-padded format (e.g. 1.01 vs 1.1)
    const usesZeroPad = nums.some(n => {
      const found = sections.find(s => {
        const m = (s.number || s.heading).match(/(\d+)\.(\d{1,2})/);
        return m && parseInt(m[1]) === art && parseInt(m[2]) === n;
      });
      return found && (found.number || found.heading).match(/\.\d{2}/);
    });
    for (let i = 0; i < nums.length - 1; i++) {
      for (let missing = nums[i] + 1; missing < nums[i + 1]; missing++) {
        const label = usesZeroPad ? `${art}.${String(missing).padStart(2, '0')}` : `${art}.${missing}`;
        gaps.push({ article: art, section: missing, label });
      }
    }
  }

  return gaps;
}

function recoverGaps(gaps, fullText, sections, bodyStart) {
  const recovered = [];

  for (const gap of gaps) {
    const escapedNum = gap.label.replace('.', '\\.');
    const pattern = new RegExp(`^\\s*(?:(?:SECTION|Section)\\s+)?${escapedNum}\\b[^\\n]*`, 'gm');

    let match;
    const body = fullText.substring(bodyStart);
    while ((match = pattern.exec(body)) !== null) {
      const absPos = bodyStart + match.index;

      // Skip if already covered by an existing section
      const alreadyCovered = sections.some(s => absPos >= s.startChar && absPos < s.endChar);
      if (alreadyCovered) continue;

      // Find end: next known boundary
      let endChar = Math.min(absPos + 5000, fullText.length);
      for (const s of sections) {
        if (s.startChar > absPos && s.startChar < endChar) {
          endChar = s.startChar;
        }
      }

      const text = fullText.substring(absPos, endChar).trim();
      if (text.length < 30) continue;

      recovered.push({
        heading: match[0].trim(),
        text,
        level: 'section',
        startChar: absPos,
        endChar: endChar,
        number: gap.label,
        recovered: true,
      });
      break;
    }
  }

  return recovered;
}

// ─── Extract section title from heading ───
// "Section 5.01. Conduct of Business" → "Conduct of Business"
// "SECTION 1.01     Definitions" → "Definitions"
function extractTitle(heading) {
  return heading
    .replace(/^(?:SECTION|Section)\s+\d+\.\d{1,2}\b\s*/, '')
    .replace(/^[.\-—:;\s]+/, '')
    .trim();
}

// ─── Keyword-based type mapping from section titles ───
const TITLE_TYPE_MAP = [
  { pattern: /material\s+adverse\s+effect|MAE/i, type: 'MAE', tier: 1 },
  { pattern: /interim\s+operat|conduct\s+of\s+(?:the\s+)?business|conduct\s+prior/i, type: 'IOC', tier: 1 },
  { pattern: /antitrust|regulatory\s+(?:efforts|approval|matters)|HSR|hell\s+or\s+high/i, type: 'ANTI', tier: 1 },
  { pattern: /conditions?\s+(?:to|of|precedent)|conditions?\s+(?:to\s+)?closing/i, type: 'COND', tier: 1 },
  { pattern: /termination\s+(?:rights|of\s+agreement|by)|right\s+to\s+terminat/i, type: 'TERMR', tier: 1 },
  { pattern: /termination\s+fee|break[\s-]*up\s+fee|reverse.*fee|expense\s+reimburse/i, type: 'TERMF', tier: 1 },
  { pattern: /no[\s-]*(?:solicitation|shop)|(?:non|no)[\s-]*solicit/i, type: 'COV', tier: 2 },
  { pattern: /represent\w*\s+and\s+warrant|representations/i, type: 'REP', tier: 2 },
  { pattern: /(?:^|\b)covenants?\b/i, type: 'COV', tier: 2 },
  { pattern: /definition/i, type: 'DEF', tier: 3 },
  { pattern: /merger\s+(?:consideration|sub)|exchange\s+(?:ratio|procedures)|closing\s+(?:mechanics|date)/i, type: 'STRUCT', tier: 2 },
  { pattern: /(?:the\s+)?merger\b/i, type: 'STRUCT', tier: 2 },
  { pattern: /equity\s+awards?|stock\s+options?|RSU/i, type: 'STRUCT', tier: 2 },
  { pattern: /financing\s+(?:cooperation|efforts)/i, type: 'COV', tier: 2 },
  { pattern: /(?:reasonable\s+)?best\s+efforts/i, type: 'ANTI', tier: 1 },
  { pattern: /indemnif/i, type: 'COV', tier: 2 },
  { pattern: /employee\s+(?:matters|benefits)/i, type: 'COV', tier: 2 },
  { pattern: /information\s+(?:access|rights)|access\s+to\s+information/i, type: 'COV', tier: 2 },
  { pattern: /notices?\b/i, type: 'MISC', tier: 3 },
  { pattern: /governing\s+law/i, type: 'MISC', tier: 3 },
  { pattern: /severab|entire\s+agreement|amendment|waiver|counterpart|jurisdict/i, type: 'MISC', tier: 3 },
  { pattern: /public\s+announcement|press\s+release/i, type: 'COV', tier: 2 },
  { pattern: /organiz\w+.*(?:standing|good)|good\s+standing/i, type: 'REP', tier: 2 },
  { pattern: /authority|no\s+conflict/i, type: 'REP', tier: 2 },
  { pattern: /financial\s+statement/i, type: 'REP', tier: 2 },
  { pattern: /undisclosed\s+liabilit/i, type: 'REP', tier: 2 },
  { pattern: /absence\s+of\s+(?:certain\s+)?change/i, type: 'REP', tier: 2 },
  { pattern: /litigat|legal\s+proceed/i, type: 'REP', tier: 2 },
  { pattern: /\btax\b/i, type: 'REP', tier: 2 },
  { pattern: /employee\s+benefit|ERISA/i, type: 'REP', tier: 2 },
  { pattern: /environment/i, type: 'REP', tier: 2 },
  { pattern: /intellectual\s+property/i, type: 'REP', tier: 2 },
  { pattern: /material\s+contract/i, type: 'REP', tier: 2 },
  { pattern: /insurance/i, type: 'REP', tier: 2 },
  { pattern: /compliance\s+with\s+law/i, type: 'REP', tier: 2 },
  { pattern: /(?:real\s+)?property/i, type: 'REP', tier: 2 },
  { pattern: /stockholder.*(?:vote|approv)|(?:vote|approv).*stockholder/i, type: 'COND', tier: 1 },
];

// ─── No-Solicitation sub-categories for high-complexity extraction ───
const NOSOL_CATEGORIES = [
  'No-Solicitation Standard',
  'Window-Shop / Go-Shop',
  'Superior Proposal Definition',
  'Fiduciary Out / Exception',
  'Match Right / Negotiation Period',
  'Notice Requirements',
  'Board Recommendation Change',
];

// ─── Pre-classify sections deterministically from headings + DB catalog ───
function preClassify(sections, dbCatalog) {
  return sections.map(s => {
    const title = extractTitle(s.heading);
    s.extractedTitle = title;

    // Try keyword-based matching first
    for (const rule of TITLE_TYPE_MAP) {
      if (rule.pattern.test(title)) {
        s.preType = rule.type;
        s.preTier = rule.tier;
        s.preCategory = title || 'General';
        break;
      }
    }

    // If no keyword match, try DB catalog cross-reference
    if (!s.preType && dbCatalog && dbCatalog.length > 0) {
      const titleLower = title.toLowerCase();
      if (titleLower.length >= 3) {
        for (const entry of dbCatalog) {
          const catLower = entry.category.toLowerCase();
          if (titleLower.includes(catLower) || catLower.includes(titleLower)) {
            s.preType = entry.type;
            s.preTier = entry.display_tier || 2;
            s.preCategory = entry.category;
            break;
          }
        }
      }
    }

    // Flag no-solicit sections for high-complexity extraction
    if (s.preType === 'COV' && /no[\s-]*(?:solicitation|shop)|(?:non|no)[\s-]*solicit/i.test(title)) {
      s._isNoSolicit = true;
    }

    // Count (a)/(b)/(c) sub-items to detect complexity
    s.subItemCount = (s.text.match(/\n\s*\([a-z]{1,3}\)\s/gi) || []).length;

    return s;
  });
}

// ─── Phase 3: Classify sections — heading-first, AI for ambiguous ───
async function classifySections(sections, client, rules, dbCatalog) {
  // Step 1: Pre-classify deterministically from headings + DB
  const preSections = preClassify(sections, dbCatalog);

  // Step 2: Separate resolved (heading matched) vs ambiguous (needs AI)
  const resolved = [];
  const ambiguous = [];
  preSections.forEach((s, idx) => {
    if (s.preType) {
      let complexity = 'low';
      if (['MAE', 'IOC', 'ANTI'].includes(s.preType) || s._isNoSolicit || (s.subItemCount >= 5 && s.text.length > 3000)) {
        complexity = 'high';
      } else if (s.subItemCount >= 3 || s.text.length > 3000) {
        complexity = 'medium';
      }
      resolved.push({
        ...s,
        provision_type: s.preType,
        category: s.preCategory || s.extractedTitle,
        display_tier: s.preTier,
        complexity,
        _idx: idx,
        _preClassified: true,
      });
    } else {
      ambiguous.push({ ...s, _idx: idx });
    }
  });

  // Step 3: Send only ambiguous sections to AI
  if (ambiguous.length > 0) {
    const allTypes = Object.keys(PROVISION_TYPE_CONFIGS);
    const typeList = allTypes.map(k => `${k} (${PROVISION_TYPE_CONFIGS[k].label})`).join(', ');

    const sectionSummaries = ambiguous.map(s => ({
      idx: s._idx,
      heading: s.heading.substring(0, 120),
      title: s.extractedTitle,
      preview: s.text.substring(0, 1500),
      level: s.level,
      charCount: s.text.length,
      subItemCount: s.subItemCount,
      ...(s.text.length > 3000 ? { tail: s.text.substring(s.text.length - 500) } : {}),
    }));

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

Assign a COMPLEXITY level:
- "high": MAE carve-out sections, IOC restriction lists, COND condition lists, TERMR/TERMF trigger/fee lists, or sections with subItemCount >= 5 and charCount > 3000
- "medium": Sections with subItemCount >= 3, or charCount > 3000 with sub-numbered items
- "low": Single-topic sections, simple boilerplate

Display tiers: 1=Core, 2=Supporting, 3=Reference.
Use the section "title" field as the primary category name when descriptive.

SECTIONS:
${JSON.stringify(batch)}

Return ONLY valid JSON array (no markdown, no backticks):
[{ "idx": 0, "provision_type": "MAE", "category": "category name", "display_tier": 1, "complexity": "high" }]

Rules:
- Every section must appear in the output
- Use exact provision_type keys: ${allTypes.join(', ')}
- For unclear sections, use MISC
- complexity must be "high", "medium", or "low"${rules && rules.length > 0 ? '\n\nLEARNED RULES:\n' + rules.filter(r => r.scope === 'classify' || r.scope === 'parse').map(r => '- ' + r.rule).join('\n') : ''}`
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
            category: s.title || 'Unclassified',
            display_tier: 3,
            complexity: s.subItemCount >= 3 ? 'medium' : 'low',
          });
        });
      }
    }));

    for (const cls of allClassifications) {
      const section = ambiguous.find(a => a._idx === cls.idx);
      if (section) {
        // Auto-upgrade complexity based on sub-item count
        let complexity = cls.complexity || 'low';
        if (section.subItemCount >= 5 && complexity === 'low') complexity = 'high';
        else if (section.subItemCount >= 3 && complexity === 'low') complexity = 'medium';
        resolved.push({
          ...section,
          provision_type: cls.provision_type || 'MISC',
          category: cls.category || section.extractedTitle || 'Unclassified',
          display_tier: cls.display_tier || 3,
          complexity,
        });
      }
    }
  }

  // Step 4: Sort back into document order and clean up temp fields
  resolved.sort((a, b) => a.startChar - b.startChar);
  return resolved.map(s => {
    const { _idx, preType, preTier, preCategory, extractedTitle, subItemCount, ...rest } = s;
    return rest; // _preClassified is kept for diagnostics, stripped later
  });
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

// ─── Regex-based definition splitting ───
// Splits a definitions section into individual defined terms without AI.
function splitDefinitions(sectionText) {
  // Match "TERM" means / "TERM" shall mean / "TERM" has the meaning / "TERM" shall have the meaning
  // Handles both curly quotes (\u201c \u201d) and straight quotes
  // Allows up to 40 chars of qualifier between term and "means" (e.g. "affiliate" of any Person means)
  const defPattern = /[\u201c"]([^\u201d"]+)[\u201d"][^\u201c"\n]{0,40}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;

  const matches = [];
  let m;
  while ((m = defPattern.exec(sectionText)) !== null) {
    // Schema validation: candidate must be near start of a line (< 20 chars of
    // non-whitespace since last newline) or after sentence-ending punctuation —
    // rejects false matches where "means" appears mid-paragraph within a definition
    const before = sectionText.substring(Math.max(0, m.index - 200), m.index);
    const lastNL = before.lastIndexOf('\n');
    if (lastNL !== -1) {
      const sinceLine = before.substring(lastNL + 1);
      const nonWS = sinceLine.replace(/\s/g, '').length;
      if (nonWS > 20) continue; // too much content since last newline — mid-paragraph
    } else if (m.index > 20) {
      // No newline found in lookback — check if after sentence-ending punctuation
      const trimmedBefore = before.trimEnd();
      if (trimmedBefore.length > 0 && !/[.;:!?)\]]$/.test(trimmedBefore)) continue;
    }
    matches.push({ index: m.index, term: m[1].trim() });
  }

  if (matches.length === 0) return null;

  const provisions = [];

  // Preamble before first definition
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      provisions.push({
        type: 'DEF',
        category: 'General / Preamble',
        text: preamble,
        favorability: 'neutral',
        display_tier: 3,
      });
    }
  }

  // Each definition: from this match to the next match (or end)
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    provisions.push({
      type: 'DEF',
      category: matches[i].term,
      text,
      favorability: 'neutral',
      display_tier: 3,
    });
  }

  return provisions.length > 0 ? provisions : null;
}

// ─── Regex-based sub-clause splitting for COND, IOC, ANTI, NOSOL ───
// Splits sections with (a), (b), (c) sub-clause markers into individual provisions.
function splitBySubClauses(sectionText, type, displayTier) {
  // Find (a), (b), (c) etc. at start of lines OR inline after ". "
  const clausePattern = /(?:^|\n)\s*\(([a-z])\)\s/g;
  const matches = [];
  let m;
  while ((m = clausePattern.exec(sectionText)) !== null) {
    const offset = sectionText[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
  }

  // Also find (a) inline after ". " (common when heading and first clause share a line)
  const inlinePattern = /\.\s+\(([a-z])\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    const pos = m.index + m[0].indexOf('(');
    // Skip if already found at this position (±5 chars)
    if (matches.some(x => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
  }
  matches.sort((a, b) => a.index - b.index);

  if (matches.length < 2) return null; // Need at least 2 sub-clauses to split

  const provisions = [];

  // Preamble before first sub-clause
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      provisions.push({
        type,
        category: 'General / Preamble',
        text: preamble,
        favorability: 'neutral',
        display_tier: displayTier,
      });
    }
  }

  // Each sub-clause: from this marker to the next (or end)
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;

    const category = extractSubClauseCategory(text);

    provisions.push({
      type,
      category,
      text,
      favorability: 'neutral',
      display_tier: displayTier,
    });
  }

  return provisions.length > 0 ? provisions : null;
}

// Extract a category name from the first meaningful phrase of a sub-clause
function extractSubClauseCategory(text) {
  // Remove (a)/(b) prefix
  const stripped = text.replace(/^\s*\([a-z]\)\s*/, '').trim();
  // Take first line
  const firstLine = stripped.split('\n')[0].trim();

  // Pattern 1: Capitalised title with period ("Organization and Good Standing. The Company...")
  const titleMatch = firstLine.match(/^([A-Z][^.]{3,60})\./);
  if (titleMatch) return titleMatch[1].trim();

  // Pattern 2: First sentence or meaningful phrase (up to 80 chars)
  const sentenceMatch = firstLine.match(/^(.{10,80}?)[.;]/);
  if (sentenceMatch) return sentenceMatch[1].trim();

  // Pattern 3: Truncate at word boundary
  const excerpt = firstLine.substring(0, 60);
  const lastSpace = excerpt.lastIndexOf(' ');
  return lastSpace > 15 ? excerpt.substring(0, lastSpace) : excerpt;
}

// ─── Phase 4: Extract sub-provisions — three-tier universal extraction ───
async function extractSubProvisions(classifiedSections, client, calibrationByType) {
  const results = [];

  // Intercept DEF, COND, IOC, ANTI, NOSOL — split with regex instead of AI
  const PRE_SPLIT_TYPES = new Set(['DEF', 'COND', 'IOC', 'ANTI']);
  const aiSections = [];
  for (const s of classifiedSections) {
    if (s.provision_type === 'DEF') {
      const split = splitDefinitions(s.text);
      if (split) {
        split.forEach(p => { p.startChar = s.startChar; });
        results.push(...split);
      } else {
        results.push({
          type: 'DEF',
          category: s.category,
          text: s.text,
          favorability: 'neutral',
          display_tier: s.display_tier,
          startChar: s.startChar,
        });
      }
    } else if (PRE_SPLIT_TYPES.has(s.provision_type) || s._isNoSolicit) {
      const split = splitBySubClauses(s.text, s.provision_type, s.display_tier);
      // Derive section heading for nested preview grouping
      const sectionHeading = s.number && s.category
        ? `${s.number}: ${s.category}`
        : s.category || s.number || null;
      if (split) {
        split.forEach(p => {
          p.startChar = s.startChar;
          if (sectionHeading) p._sectionHeading = sectionHeading;
        });
        results.push(...split);
      } else {
        // No sub-clauses found — keep as single provision
        const prov = {
          type: s.provision_type,
          category: s.category,
          text: s.text,
          favorability: 'neutral',
          display_tier: s.display_tier,
          startChar: s.startChar,
        };
        if (sectionHeading) prov._sectionHeading = sectionHeading;
        results.push(prov);
      }
    } else {
      aiSections.push(s);
    }
  }

  // Split remaining (non-pre-split) into three tiers by complexity
  const highSections = aiSections.filter(s => s.complexity === 'high');
  const mediumSections = aiSections.filter(s => s.complexity === 'medium');
  const lowSections = aiSections.filter(s => s.complexity !== 'high' && s.complexity !== 'medium');

  // ─── Tier 1 (high): Full sub-extraction per category ───
  const highTasks = highSections.map((section) => async () => {
    // Use NOSOL_CATEGORIES for no-solicit sections instead of generic COV categories
    const typeConfig = section._isNoSolicit
      ? { label: 'No-Solicitation', categories: NOSOL_CATEGORIES }
      : PROVISION_TYPE_CONFIGS[section.provision_type];
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

    // Fetch calibration examples + category catalog for cross-referencing
    const calibrationByType = {};
    let dbCatalog = [];
    if (sb) {
      const typeKeys = Object.keys(PROVISION_TYPE_CONFIGS);
      const [, catalogResult] = await Promise.all([
        // Calibration examples per type
        Promise.all(typeKeys.map(async (typeKey) => {
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
        })),
        // Distinct (type, category) pairs for heading cross-reference
        sb.from('provisions')
          .select('type, category, display_tier')
          .limit(500),
      ]);
      if (catalogResult.data) {
        // Deduplicate by type+category
        const seen = new Set();
        dbCatalog = catalogResult.data.filter(r => {
          const key = `${r.type}:${r.category}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    const client = new Anthropic({ apiKey });
    const diagnostics = {};

    // Phase 0: Clean EDGAR formatting artifacts
    const cleanedText = removeRepeatedHeaders(cleanEdgarText(full_text));

    // Phase 1: Parse structure
    const parseStart = Date.now();
    const { sections, coverage } = parseStructure(cleanedText);
    timing.parse_ms = Date.now() - parseStart;
    timing.section_count = sections.length;
    diagnostics.coverage = coverage;

    // Phase 2: Detect and recover gaps
    const gapStart = Date.now();
    const gaps = detectGaps(sections);
    const recovered = recoverGaps(gaps, cleanedText, sections, coverage.bodyStart || 0);
    if (recovered.length > 0) {
      sections.push(...recovered);
      sections.sort((a, b) => a.startChar - b.startChar);
    }
    timing.gap_ms = Date.now() - gapStart;
    diagnostics.gaps = { detected: gaps.length, recovered: recovered.length };

    // Phase 3: Classify sections
    const classifyStart = Date.now();
    const classifiedSections = await classifySections(sections, client, rules, dbCatalog);
    timing.classify_ms = Date.now() - classifyStart;

    // Track section breakdown by complexity
    diagnostics.sectionBreakdown = {
      high: classifiedSections.filter(s => s.complexity === 'high').length,
      medium: classifiedSections.filter(s => s.complexity === 'medium').length,
      low: classifiedSections.filter(s => s.complexity !== 'high' && s.complexity !== 'medium').length,
    };
    // Count how many had heading-based vs AI classification
    const preClassifiedCount = classifiedSections.filter(s => s._preClassified).length;
    diagnostics.classification = {
      total: sections.length,
      headingBased: preClassifiedCount,
      aiClassified: sections.length - preClassifiedCount,
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
    const completenessWarnings = verifyCompleteness(kept, cleanedText);
    timing.verify_ms = Date.now() - verifyStart;
    diagnostics.completeness = completenessWarnings;

    timing.total_ms = Date.now() - totalStart;
    timing.mode = 'segment';

    // Assign sort_order — DEF provisions go to end, everything else by document position
    kept.sort((a, b) => {
      const aDef = a.type === 'DEF' ? 1 : 0;
      const bDef = b.type === 'DEF' ? 1 : 0;
      if (aDef !== bDef) return aDef - bDef;
      return (a.startChar || 0) - (b.startChar || 0);
    });
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
        const provEntry = {
          type: p.type,
          category: p.category,
          text: p.text,
          favorability: p.favorability || 'neutral',
          display_tier: p.display_tier || 2,
          sort_order: p.sort_order,
        };
        if (p._sectionHeading) provEntry._sectionHeading = p._sectionHeading;
        resultsByType[p.type].provisions.push(provEntry);
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
