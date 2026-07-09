export const SEC_MEETING_FIELDS = [
  'proxyFilingDeadline',
  'mailingDeadline',
  'meetingDeadline',
  'adjournmentRights',
  'meetingControlNotes',
];

export const SEC_MEETING_COLLAPSED_TEXT = 'SEC Filing / Meeting Requirements — no data extracted';

const SEC_CODES = new Set(['COV-PROXY', 'COV-MEETING']);

const UNIT_LABELS = {
  BUSINESS_DAYS: 'business days',
  CALENDAR_DAYS: 'calendar days',
};

const TRIGGER_LABELS = {
  SIGNING: 'signing',
  AGREEMENT_DATE: 'agreement date',
  SEC_CLEARANCE: 'SEC clearance',
  NO_SEC_COMMENT_PERIOD_END: 'end of SEC no-comment period',
  EFFECTIVENESS: 'effectiveness',
  FILING: 'filing',
  MAILING: 'mailing',
  CLEARANCE: 'clearance',
};

export function unwrapFeatureValue(raw) {
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, 'value') &&
    !Object.prototype.hasOwnProperty.call(raw, 'code')
  ) {
    return raw.value;
  }
  return raw;
}

export function featureBag(provision) {
  const meta = provision && provision.ai_metadata;
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && parsed.features && typeof parsed.features === 'object' && !Array.isArray(parsed.features)
        ? parsed.features
        : {};
    } catch {
      return {};
    }
  }
  return meta.features && typeof meta.features === 'object' && !Array.isArray(meta.features)
    ? meta.features
    : {};
}

export function provisionCode(provision) {
  const meta = provision && provision.ai_metadata;
  if (meta && typeof meta === 'object' && meta.code) return meta.code;
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      if (parsed && parsed.code) return parsed.code;
    } catch {
      return provision && provision.code;
    }
  }
  return provision && provision.code;
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// --- Prose deadline/adjournment parsing -----------------------------------
// The claims-backfill pipeline (lib/queries/claims-adapter.js) cannot parse
// numbers out of prose -- a mailingDeadline/meetingDeadline/proxyFilingDeadline
// claim with no JSON-shaped verbatim degrades to `{ code: null, text: <raw
// sentence>, quotes: [] }`, no days/unit/trigger. Real Metsera data is
// exactly this shape (verified against the live deal): e.g. meetingDeadline
// verbatim is "The Company will schedule the Company Stockholders Meeting to
// be held within thirty (30) calendar days of the initial mailing of the
// Proxy Statement...". Without this parser, formatDeadline() falls through
// to `deadline.text` and the read view dumps the whole sentence -- the exact
// "why doesn't it say 30 days" bug the rebuild spec calls out. This section
// extracts the count/unit/anchor from that prose so normaliseDeadline() can
// populate days/unit/trigger the same way a structured extraction would,
// and the existing formatDeadline()/enumLabel() below render it unchanged.

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

function wordToNumber(raw) {
  const w = String(raw || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (!w) return null;
  if (NUMBER_WORDS[w] != null) return NUMBER_WORDS[w];
  const parts = w.split('-').filter(Boolean);
  if (parts.length === 2) {
    const tens = NUMBER_WORDS[parts[0]];
    const ones = NUMBER_WORDS[parts[1]];
    if (tens != null && tens >= 20 && tens % 10 === 0 && ones != null && ones < 10) return tens + ones;
  }
  return null;
}

// Anchor keyword -> the SAME trigger codes formatDeadline()/enumLabel()
// already know how to render (TRIGGER_LABELS above), checked in priority
// order against a window of text around a candidate day-count. Kept
// deliberately narrow (e.g. "this Agreement" alone is NOT enough to infer
// AGREEMENT_DATE -- that phrase appears constantly in boilerplate unrelated
// to a deadline trigger; only "date of this Agreement" / "date hereof" do).
const ANCHOR_PATTERNS = [
  [/no\s+(?:further\s+)?comments?\b/i, 'SEC_CLEARANCE'],
  [/does\s+not\s+(?:provide|have|plan\s+to\s+provide)\s+comments?/i, 'SEC_CLEARANCE'],
  [/sec\s+clearance/i, 'SEC_CLEARANCE'],
  [/no.?comment\s+period/i, 'NO_SEC_COMMENT_PERIOD_END'],
  [/initial\s+mailing|the\s+mailing\b/i, 'MAILING'],
  [/date\s+of\s+this\s+agreement|date\s+hereof/i, 'AGREEMENT_DATE'],
  [/\bsigning\b/i, 'SIGNING'],
  [/effective(?:ness)?\b/i, 'EFFECTIVENESS'],
  [/after\s+filing|filing\s+(?:of|the)\b/i, 'FILING'],
];

// Drafting convention: "either (a) ... or (b) ..." lists alternative
// triggers for the same deadline. The final alternative is the one the
// design reference's worked example resolves to (a concrete "informed of no
// further comments" event, vs. a deemed-clearance fallback in the earlier
// branch) -- restrict candidate scanning to the text after the LAST such
// "or (<letter>)" marker when the sentence contains one.
function operativeClause(text) {
  const matches = [...text.matchAll(/\bor\s*\([a-z]\)/gi)];
  if (!matches.length) return text;
  const last = matches[matches.length - 1];
  return text.slice(last.index + last[0].length);
}

// Reads the number immediately preceding a matched unit phrase, preferring
// "word (digit)" (the standard legal drafting convention, e.g. "thirty
// (30)") over a bare digit over a spelled-out word alone.
function numberImmediatelyBefore(before) {
  const tail = before.slice(-40);
  let m = tail.match(/\((\d{1,3})\)\s*$/);
  if (m) return parseInt(m[1], 10);
  m = tail.match(/(\d{1,3})\s*$/);
  if (m) return parseInt(m[1], 10);
  m = tail.match(/([a-z]+(?:[-\s][a-z]+)?)\s*$/i);
  if (m) {
    const n = wordToNumber(m[1]);
    if (n !== null) return n;
  }
  return null;
}

// Finds every "<count> business|calendar days" occurrence (plural "days"
// only -- deliberately excludes ordinal-position phrasing like "the first
// (1st) business day", which is not a duration) and, for each, resolves a
// trigger anchor from a window of surrounding text.
function findDeadlineCandidates(text) {
  const unitRe = /(business\s+days|calendar\s+days|\bdays\b)/gi;
  const candidates = [];
  let m;
  while ((m = unitRe.exec(text))) {
    const unitRaw = m[1].toLowerCase();
    const unit = /business/.test(unitRaw) ? 'BUSINESS_DAYS' : /calendar/.test(unitRaw) ? 'CALENDAR_DAYS' : null;
    const days = numberImmediatelyBefore(text.slice(0, m.index));
    if (days === null) continue;
    const windowStart = Math.max(0, m.index - 150);
    const windowEnd = Math.min(text.length, m.index + m[0].length + 150);
    const window = text.slice(windowStart, windowEnd);
    let trigger = null;
    for (const [pattern, code] of ANCHOR_PATTERNS) {
      if (pattern.test(window)) { trigger = code; break; }
    }
    candidates.push({ days, unit, trigger, index: m.index });
  }
  return candidates;
}

// Parses a deadline sentence into { days, unit, trigger } (the same shape a
// structured extraction would produce). Prefers the first candidate with a
// resolved anchor (so a later, unrelated day-count elsewhere in the same
// verbatim capture -- e.g. an adjournment limit folded into the meeting-
// deadline sentence -- doesn't win); falls back to the first day-count found
// with no anchor; returns null (never a partial guess) when no day-count at
// all is present, so callers degrade to "see text" rather than fabricating.
export function parseDeadlineText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const candidates = findDeadlineCandidates(operativeClause(text));
  if (!candidates.length) return null;
  const chosen = candidates.find((c) => c.trigger) || candidates[0];
  return { days: chosen.days, unit: chosen.unit, trigger: chosen.trigger };
}

const ADJOURNMENT_REASON_PATTERNS = [
  [/quorum/i, { code: 'QUORUM_ABSENT', label: 'Quorum absent' }],
  [/(?:not\s+|in)?sufficient\s+(?:affirmative\s+)?votes|insufficient\s+votes/i, { code: 'INSUFFICIENT_VOTES', label: 'Insufficient votes' }],
  [/supplemental\s+disclosure/i, { code: 'SUPPLEMENTAL_DISCLOSURE', label: 'Supplemental disclosure' }],
  [/required\s+by\s+law|legal\s+requirement/i, { code: 'LEGAL_REQUIREMENT', label: 'Legal requirement' }],
];

function partyFromAdjournmentText(text) {
  if (/\bCompany\b[^.;]*\badjourn/i.test(text)) return 'COMPANY';
  if (/\bParent\b[^.;]*\badjourn/i.test(text)) return 'PARENT';
  return null;
}

// Parses a plain-prose adjournment-rights sentence into the same
// { party, reasons, maxAdjournments, maxDaysPerAdjournment, maxDaysTotal,
// text } shape normaliseAdjournment() expects from a structured claim.
// Real Metsera data stores this attribute as a bare string (per
// lib/schema/features.js's adjournmentRights listItemType: 'string' --
// there is no taxonomy dictionary backing it), so without this the whole
// row silently disappears (normaliseAdjournment's object-only check rejects
// a string outright).
export function parseAdjournmentText(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const party = partyFromAdjournmentText(text);
  const reasons = [];
  for (const [pattern, reason] of ADJOURNMENT_REASON_PATTERNS) {
    if (pattern.test(text)) reasons.push(reason);
  }
  let maxDaysTotal = null;
  const totalMatch = text.match(/more\s+than\s+(?:[a-z]+(?:[-\s][a-z]+)?\s+)?\(?(\d{1,3})\)?\s*(?:business|calendar)?\s*days?/i)
    || text.match(/\(?(\d{1,3})\)?\s*(?:business|calendar)?\s*days?\s+(?:in\s+the\s+aggregate|in\s+total|total)/i);
  if (totalMatch) maxDaysTotal = parseInt(totalMatch[1], 10);
  let maxDaysPerAdjournment = null;
  const perMatch = text.match(/\(?(\d{1,3})\)?\s*(?:business|calendar)?\s*days?\s+(?:each|per\s+adjournment)/i);
  if (perMatch) maxDaysPerAdjournment = parseInt(perMatch[1], 10);
  let maxAdjournments = null;
  const countMatch = text.match(/\(?(\d{1,3})\)?\s*adjournments?/i);
  if (countMatch) maxAdjournments = parseInt(countMatch[1], 10);
  if (!party && !reasons.length && maxDaysTotal === null && maxDaysPerAdjournment === null && maxAdjournments === null) return null;
  return { party, reasons, maxAdjournments, maxDaysPerAdjournment, maxDaysTotal, text };
}

export function isDeadlinePopulated(raw) {
  const value = unwrapFeatureValue(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    nonEmptyText(value.text) ||
    typeof value.days === 'number' ||
    nonEmptyText(value.unit) ||
    nonEmptyText(value.trigger)
  );
}

function normaliseDeadline(raw) {
  // Real backfilled claims sometimes carry the bare prose string itself
  // (not yet wrapped in the { text, days, unit, trigger } envelope) --
  // treat a plain string the same as { text: <string> } before the
  // populated-check below.
  const unwrapped = unwrapFeatureValue(raw);
  const value = typeof unwrapped === 'string' ? { text: unwrapped } : unwrapped;
  if (!isDeadlinePopulated(value)) return null;
  const deadline = {
    term: nonEmptyText(value.term) ? value.term.trim() : null,
    flag: nonEmptyText(value.flag) ? value.flag.trim() : null,
    text: nonEmptyText(value.text) ? value.text.trim() : null,
    days: typeof value.days === 'number' ? value.days : null,
    unit: nonEmptyText(value.unit) ? value.unit.trim() : null,
    trigger: nonEmptyText(value.trigger) ? value.trigger.trim() : null,
  };
  // No structured days -- the extraction/backfill only captured the
  // verbatim sentence. Parse it rather than letting formatDeadline() fall
  // through to a raw prose dump.
  if (deadline.days === null && deadline.text) {
    const parsed = parseDeadlineText(deadline.text);
    if (parsed) {
      deadline.days = parsed.days;
      deadline.unit = deadline.unit || parsed.unit;
      deadline.trigger = deadline.trigger || parsed.trigger;
    }
  }
  return deadline;
}

function normaliseAdjournment(raw) {
  const value = unwrapFeatureValue(raw);
  // Real backfilled adjournmentRights entries are a bare prose string (see
  // lib/schema/features.js -- listItemType 'string', no taxonomy dictionary
  // backing it), not the structured { party, reasons, maxDaysTotal, ... }
  // object the extraction schema describes. Parse the prose instead of
  // rejecting it outright, which previously dropped the whole row.
  if (typeof value === 'string') return parseAdjournmentText(value);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const reasons = Array.isArray(value.reasons)
    ? value.reasons.filter((r) => r && typeof r === 'object' && (r.code || r.label || r.text))
    : [];
  const out = {
    party: nonEmptyText(value.party) ? value.party.trim() : null,
    reasons,
    maxAdjournments: typeof value.maxAdjournments === 'number' ? value.maxAdjournments : null,
    maxDaysPerAdjournment: typeof value.maxDaysPerAdjournment === 'number' ? value.maxDaysPerAdjournment : null,
    maxDaysTotal: typeof value.maxDaysTotal === 'number' ? value.maxDaysTotal : null,
    text: nonEmptyText(value.text) ? value.text.trim() : null,
  };
  const hasLimit = out.maxAdjournments !== null || out.maxDaysPerAdjournment !== null || out.maxDaysTotal !== null;
  if (!out.party && reasons.length === 0 && !hasLimit && !out.text) return null;
  return out;
}

export function isSecMeetingProvision(provision) {
  const code = provisionCode(provision);
  if (SEC_CODES.has(code)) return true;
  const f = featureBag(provision);
  return SEC_MEETING_FIELDS.some((key) => {
    const value = f[key];
    if (key === 'adjournmentRights') return Array.isArray(value) && value.length > 0;
    if (key === 'meetingControlNotes') return nonEmptyText(value);
    return isDeadlinePopulated(value);
  });
}

export function deriveSecMeetingSummary(provisions) {
  const summary = {
    proxyFilingDeadline: null,
    mailingDeadline: null,
    meetingDeadline: null,
    adjournmentRights: [],
    meetingControlNotes: null,
    hasData: false,
  };
  const seenAdjournments = new Set();

  for (const provision of Array.isArray(provisions) ? provisions : []) {
    if (!isSecMeetingProvision(provision)) continue;
    const f = featureBag(provision);

    for (const key of ['proxyFilingDeadline', 'mailingDeadline', 'meetingDeadline']) {
      if (!summary[key]) summary[key] = normaliseDeadline(f[key]);
    }

    if (!summary.meetingControlNotes && nonEmptyText(f.meetingControlNotes)) {
      summary.meetingControlNotes = f.meetingControlNotes.trim();
    }

    if (Array.isArray(f.adjournmentRights)) {
      for (const item of f.adjournmentRights) {
        const normalised = normaliseAdjournment(item);
        if (!normalised) continue;
        const sig = JSON.stringify(normalised);
        if (seenAdjournments.has(sig)) continue;
        seenAdjournments.add(sig);
        summary.adjournmentRights.push(normalised);
      }
    }
  }

  summary.hasData = Boolean(
    summary.proxyFilingDeadline ||
    summary.mailingDeadline ||
    summary.meetingDeadline ||
    summary.meetingControlNotes ||
    summary.adjournmentRights.length > 0,
  );
  return summary;
}

export function enumLabel(code) {
  return TRIGGER_LABELS[code] || UNIT_LABELS[code] || humanizeCode(code);
}

export function humanizeCode(code) {
  if (!code) return '';
  return String(code)
    .toLowerCase()
    .split('_')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export function formatDeadline(deadline) {
  if (!deadline) return null;
  if (typeof deadline.days === 'number') {
    const unit = UNIT_LABELS[deadline.unit] || (deadline.unit ? humanizeCode(deadline.unit).toLowerCase() : 'days');
    const base = `${deadline.days} ${unit}`;
    return deadline.trigger ? `${base} after ${enumLabel(deadline.trigger)}` : base;
  }
  return deadline.text || null;
}

export function formatAdjournmentLimits(right) {
  if (!right) return [];
  const out = [];
  if (typeof right.maxAdjournments === 'number') {
    out.push(`${right.maxAdjournments} adjournment${right.maxAdjournments === 1 ? '' : 's'}`);
  }
  if (typeof right.maxDaysPerAdjournment === 'number') {
    out.push(`${right.maxDaysPerAdjournment} days each`);
  }
  if (typeof right.maxDaysTotal === 'number') {
    out.push(`${right.maxDaysTotal} days total`);
  }
  return out;
}

export function secMeetingDisplayState(provisions) {
  const summary = deriveSecMeetingSummary(provisions);
  if (!summary.hasData) {
    return { summary, collapsed: true, collapsedText: SEC_MEETING_COLLAPSED_TEXT, rows: [] };
  }
  const rows = [
    { key: 'proxyFilingDeadline', label: summary.proxyFilingDeadline?.term || 'Filing deadline', kind: 'deadline', value: summary.proxyFilingDeadline },
    { key: 'mailingDeadline', label: summary.mailingDeadline?.term || 'Mailing', kind: 'deadline', value: summary.mailingDeadline },
    { key: 'meetingDeadline', label: summary.meetingDeadline?.term || 'Meeting', kind: 'deadline', value: summary.meetingDeadline },
    ...summary.adjournmentRights.map((right, idx) => ({
      key: `adjournmentRights-${idx}`,
      label: `Adjournment rights${right.party && !/^company$/i.test(enumLabel(right.party)) ? ` - ${enumLabel(right.party)}` : ''}`,
      kind: 'adjournment',
      value: right,
    })),
  ];
  if (summary.meetingControlNotes) {
    rows.push({ key: 'meetingControlNotes', label: 'Meeting control notes', kind: 'text', value: summary.meetingControlNotes });
  }
  for (const row of rows) {
    if (!row.label || !String(row.label).trim()) {
      row.label = 'Unlabeled value - flag for QA';
      row.qaFlag = true;
    }
  }
  return { summary, collapsed: false, collapsedText: null, rows };
}
