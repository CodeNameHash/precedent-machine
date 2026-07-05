const { normalizeForMatch, locateProvisionInSource } = require('./verification');
const { familyType, isCanonicalCode, provisionCode } = require('./expected-sets');
const { REGION_TYPES } = require('./parser-v2/regions');

const NOSOL_ANCHORS = [
  'No Solicitation',
  'Acquisition Proposal',
  'Superior Proposal',
  'Change of Recommendation',
  'Intervening Event',
  'Company Recommendation',
  'Adverse Recommendation Change',
];

const COV_ANCHORS = [
  'interim covenant',
  'conduct of business',
  'ordinary course',
  'access',
  'reasonable best efforts',
  'commercially reasonable efforts',
  'efforts',
  'employee',
  'director and officer',
  'directors and officers',
  'D&O',
  'indemnification',
  'insurance',
];

const MISC_ANCHORS = [
  'notices',
  'governing law',
  'expenses',
  'amendment',
  'waiver',
  'assignment',
];

const ANCILLARY_ANCHORS = [
  'exhibit',
  'support agreement',
  'voting agreement',
  'tender and support agreement',
  'form of',
  'disclosure schedule',
  'letter of transmittal',
  'certificate of merger',
  'escrow agreement',
  'registration rights agreement',
];

function normalizeForGapDisplay(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\[\[\/?[A-Z_]+\]\]/g, ' ')
    .replace(/[«»]/g, ' ')
    .replace(/[‘’‛'“”„"]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/([a-zA-Z0-9])-\s+(?=[a-zA-Z0-9])/g, '$1-')
    .replace(/([a-zA-Z0-9])\s+-(?=[a-zA-Z0-9])/g, '$1-')
    .replace(/([([])\s+/g, '$1')
    .replace(/\)\s+\(/g, ')(')
    .replace(/\s+([.,;:)\]])/g, '$1')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anchorRegex(anchor) {
  if (anchor === 'D&O') return /\bd\s*&\s*o\b/i;
  return new RegExp(`\\b${escapeRegExp(anchor).replace(/\\ /g, '\\s+')}\\b`, 'i');
}

function findAnchor(text, anchors) {
  const source = String(text || '');
  for (const anchor of anchors) {
    if (anchorRegex(anchor).test(source)) return anchor;
  }
  return null;
}

function suggestGapType(text) {
  const nosol = findAnchor(text, NOSOL_ANCHORS);
  if (nosol) {
    return {
      suggested_type: 'NOSOL',
      suggested_reason: `Contains ${nosol}.`,
      anchor: nosol,
    };
  }

  const cov = findAnchor(text, COV_ANCHORS);
  if (cov) {
    return {
      suggested_type: 'COV',
      suggested_reason: `Contains covenant-style anchor ${cov}.`,
      anchor: cov,
    };
  }

  const misc = findAnchor(text, MISC_ANCHORS);
  if (misc) {
    return {
      suggested_type: 'MISC',
      suggested_reason: `Contains miscellaneous anchor ${misc}.`,
      anchor: misc,
    };
  }

  const ancillary = findAnchor(text, ANCILLARY_ANCHORS);
  if (ancillary) {
    return {
      suggested_type: 'IGNORE/ANCILLARY',
      suggested_reason: `Looks like ancillary or exhibit material: ${ancillary}.`,
      anchor: ancillary,
    };
  }

  return {
    suggested_type: 'UNKNOWN',
    suggested_reason: 'No first-pass anchor matched.',
    anchor: null,
  };
}

function classifyGapRegion(text) {
  const source = String(text || '').trim();
  const head = source.slice(0, 2000);
  if (!head) return REGION_TYPES.BODY_SECTION_UNASSIGNED;

  if (/\bTABLE\s+OF\s+CONTENTS\b/i.test(head)) return REGION_TYPES.PREAMBLE_TOC;
  if (/^WHEREAS\b|[\s.]WHEREAS\b/i.test(head)) return REGION_TYPES.PREAMBLE_RECITALS;
  if (/\bNOW\s*,?\s+THEREFORE\b|\bNOW\s+THEREFORE\b/i.test(head)) return REGION_TYPES.PREAMBLE_ENACTING;
  if (/^\s*(?:AGREEMENT\s+AND\s+PLAN\s+OF\s+MERGER\b|This\s+AGREEMENT\b.{0,240}\bis\s+(?:made\s+and\s+entered\s+into|entered\s+into)\s+as\s+of\b|[A-Z][A-Z\s,.'()-]{10,160}\bdated\s+as\s+of\b)/i.test(head) && !/(?:SECTION|Section)\s+\d{1,2}\.\d{1,2}\b/.test(head)) {
    return REGION_TYPES.PREAMBLE_COVER;
  }
  if (/IN\s+WITNESS\s+WHEREOF|\[Signature\s+Page|\/s\//i.test(head)) return REGION_TYPES.BACKMATTER_SIGNATURES;
  if (/^\s*(?:EXHIBIT|Exhibit)\b|\bFORM\s+OF\s+(?:CERTIFICATE|CHARTER|BYLAWS?|VOTING|SUPPORT|LETTER|CVR|CONTINGENT\s+VALUE)/i.test(head)) {
    return REGION_TYPES.BACKMATTER_EXHIBIT;
  }
  if (/^\s*(?:ANNEX|Annex)\b/i.test(head)) return REGION_TYPES.BACKMATTER_ANNEX;
  if (/^\s*(?:SCHEDULE|Schedule)\b/i.test(head)) return REGION_TYPES.BACKMATTER_SCHEDULE;
  if (/\bINDEX\s+OF\s+DEFINED\s+TERMS\b|\bDefined\s+Term\b.{0,80}\bLocation\s+of\s+Definition\b/i.test(head)) {
    return REGION_TYPES.BACKMATTER_INDEX;
  }
  return REGION_TYPES.BODY_SECTION_UNASSIGNED;
}

function isReviewableGapRegion(regionType) {
  return regionType === REGION_TYPES.BODY_SECTION_UNASSIGNED
    || regionType === REGION_TYPES.BODY_SECTION_PARTIAL;
}

function ignoredGapReason(regionType) {
  if (isReviewableGapRegion(regionType)) return null;
  if (regionType && regionType.startsWith('preamble.')) return 'Frontmatter is typed, not a parser gap.';
  if (regionType && regionType.startsWith('backmatter.')) return 'Backmatter is typed, not a parser gap.';
  return 'Non-reviewable parser region.';
}

function compactText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  const s = compactText(text);
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function gapTextFromSource(sourceText, gap) {
  const displaySource = normalizeForGapDisplay(sourceText || '');
  const start = Math.max(0, Math.min(displaySource.length, Number(gap && gap.start) || 0));
  const length = Math.max(0, Number(gap && gap.length) || 0);
  return displaySource.slice(start, Math.min(displaySource.length, start + length)).trim();
}

function gapPreviewFromSource(sourceText, gap, max = 240) {
  return truncate(gapTextFromSource(sourceText, gap), max);
}

function locateProvisionIntervals(provisions, sourceText) {
  const normSource = normalizeForMatch(sourceText || '');
  const intervals = [];

  for (const p of provisions || []) {
    const locatedProvision = locateProvisionInSource(p, sourceText, { normalizedSource: normSource });
    if (!locatedProvision) continue;
    intervals.push({
      provision_id: p.id || null,
      id: p.id || null,
      type: p.type || null,
      category: p.category || null,
      start: locatedProvision.start,
      end: locatedProvision.end,
      length: locatedProvision.length,
    });
  }

  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  return intervals;
}

function intervalSummary(interval, distance) {
  if (!interval) return null;
  return {
    provision_id: interval.provision_id,
    type: interval.type,
    category: interval.category,
    start: interval.start,
    end: interval.end,
    distance,
  };
}

function adjacentProvisions(intervals, gap) {
  const start = Number(gap && gap.start) || 0;
  const end = start + (Number(gap && gap.length) || 0);
  let before = null;
  let after = null;

  for (const interval of intervals || []) {
    if (interval.end <= start && (!before || interval.end > before.end)) {
      before = interval;
    }
    if (interval.start >= end && (!after || interval.start < after.start)) {
      after = interval;
    }
  }

  return {
    before: intervalSummary(before, before ? start - before.end : null),
    after: intervalSummary(after, after ? after.start - end : null),
  };
}

function findRoughHeading(displaySource, start, gapText) {
  const candidates = [
    String(gapText || '').slice(0, 800),
    String(displaySource || '').slice(Math.max(0, start - 1200), Math.min(displaySource.length, start + 400)),
  ];
  const headingRe = /\b(?:section|article)\s+[a-z0-9ivxlcdm]+(?:\.[a-z0-9]+)*(?:\([a-z0-9]+\))?\.?\s+[^.;]{0,140}/gi;

  for (const source of candidates) {
    let best = null;
    let match;
    while ((match = headingRe.exec(source)) !== null) {
      best = match[0];
    }
    if (best) return truncate(best, 160);
  }

  return null;
}

function formatGapId(index) {
  return `G-${String(index).padStart(3, '0')}`;
}

function formatUncodedId(index) {
  return `U-${String(index).padStart(3, '0')}`;
}

function isProposedUncoded(category, code) {
  return String(category || '').startsWith('[PROPOSED') || String(code || '').startsWith('[PROPOSED');
}

function uncodedReason(category, code) {
  if (isProposedUncoded(category, code)) return 'Proposed taxonomy item awaiting review.';
  if (!code) return 'No canonical code stored in ai_metadata.';
  return 'Stored code is not in the canonical rubric.';
}

function objectValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function provisionMetadata(provision) {
  return objectValue(provision && provision.ai_metadata);
}

function provisionFeatures(provision) {
  return objectValue(provisionMetadata(provision).features);
}

function firstPresent(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function buildUncodedSummary(provisions) {
  const byType = {};
  let count = 0;
  let proposedCount = 0;

  for (const p of provisions || []) {
    const code = provisionCode(p);
    if (isCanonicalCode(code)) continue;

    const type = familyType(p && p.type) || (p && p.type) || '?';
    const proposed = isProposedUncoded(p && p.category, code);
    count += 1;
    if (proposed) proposedCount += 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    count,
    proposed_count: proposedCount,
    by_type: byType,
  };
}

function buildUncodedDetails(provisions, { max = Infinity } = {}) {
  const out = [];

  for (const p of provisions || []) {
    const code = provisionCode(p);
    if (isCanonicalCode(code)) continue;

    const category = p && p.category ? p.category : null;
    const type = p && p.type ? p.type : null;
    const fullText = String((p && p.full_text) || '').trim();
    const proposed = isProposedUncoded(category, code);
    const metadata = provisionMetadata(p);
    const features = provisionFeatures(p);

    out.push({
      id: formatUncodedId(out.length + 1),
      provision_id: (p && p.id) || null,
      section_number: firstPresent(
        p && p.section_number,
        p && p.sectionNumber,
        metadata.section_number,
        metadata.sectionNumber,
        features.section_number,
        features.sectionNumber,
      ),
      start_char: firstPresent(
        p && p.start_char,
        p && p.startChar,
        metadata.start_char,
        metadata.startChar,
      ),
      region_type: firstPresent(
        p && p.region_type,
        p && p.regionType,
        metadata.region_type,
        metadata.regionType,
      ),
      type,
      family_type: familyType(type),
      category,
      code: code || null,
      proposed,
      suggested_reason: uncodedReason(category, code),
      length: fullText.length,
      preview: truncate(fullText, 240),
      text: fullText,
      full_text: fullText,
      rough_heading: findRoughHeading(fullText, 0, fullText) || truncate(fullText, 140),
    });

    if (out.length >= max) break;
  }

  return out;
}

function buildGapDetails({ coverage, sourceText, provisions, contextChars = 500 }) {
  const displaySource = normalizeForGapDisplay(sourceText || '');
  const intervals = locateProvisionIntervals(provisions || [], sourceText || '');
  const gaps = [...((coverage && coverage.gaps) || [])]
    .filter((gap) => gap && Number(gap.length) > 0)
    .sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0));

  return gaps.map((gap, index) => {
    const start = Math.max(0, Math.min(displaySource.length, Number(gap.start) || 0));
    const length = Math.max(0, Number(gap.length) || 0);
    const end = Math.min(displaySource.length, start + length);
    const fullText = displaySource.slice(start, end).trim();
    const suppliedRegionType = gap && typeof gap.region_type === 'string' ? gap.region_type : null;
    const regionType = suppliedRegionType || classifyGapRegion(fullText);
    const suggestion = suggestGapType(fullText);

    return {
      id: formatGapId(index + 1),
      start,
      length,
      preview: truncate(fullText, 240),
      text: fullText,
      full_text: fullText,
      before_context: displaySource.slice(Math.max(0, start - contextChars), start).trim(),
      after_context: displaySource.slice(end, Math.min(displaySource.length, end + contextChars)).trim(),
      rough_heading: findRoughHeading(displaySource, start, fullText),
      region_type: regionType,
      reviewable_gap: isReviewableGapRegion(regionType),
      ignored_reason: ignoredGapReason(regionType),
      suggested_type: suggestion.suggested_type,
      suggested_reason: suggestion.suggested_reason,
      suggestion,
      adjacent_provisions: adjacentProvisions(intervals, { start, length }),
    };
  });
}

module.exports = {
  NOSOL_ANCHORS,
  COV_ANCHORS,
  MISC_ANCHORS,
  ANCILLARY_ANCHORS,
  normalizeForGapDisplay,
  suggestGapType,
  locateProvisionIntervals,
  adjacentProvisions,
  buildGapDetails,
  buildUncodedSummary,
  buildUncodedDetails,
  gapTextFromSource,
  gapPreviewFromSource,
  classifyGapRegion,
  isReviewableGapRegion,
  formatGapId,
  formatUncodedId,
};
