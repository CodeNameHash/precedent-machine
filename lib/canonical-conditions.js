// ───────────────────────────────────────────────────────────────────────────
// CANONICAL_CONDITIONS — the canonical-condition row catalogue, per family.
// Each row carries:
//   label   — human-readable canonical condition name
//   codes   — canonical rubric codes this row represents. MATCHED FIRST: a
//             provision whose canonical code is in this list fills the row,
//             regardless of how its category label reads. Codes are stable;
//             category text drifts ("No Legal Impediment" vs "No Injunctions",
//             "Accuracy of Target Reps" vs "…representations"), which is why
//             matching on category regex alone silently dropped present
//             conditions to "Not present in this agreement".
//   re      — regex against provision.category, used as a FALLBACK when a
//             provision carries no canonical code (older rows) or an unmapped
//             one.
//   side?   — 'company' | 'parent' (informational; used by review's banner)
//   alwaysRender?  — render the row even if no provision matches (the No-MAE
//                    rows pull from the MAE definition when absent)
//   tenderOnly?    — render only for tender-offer deals
//   requireParentApproval? — gate the Parent Stockholder Approval row
//   maeSide?       — 'target' | 'parent' (review's MAE-definition fallback)
//
// Shared between the review page (CanonicalConditionsTable) and the compare
// view (CanonicalConditionsCompare).
// ───────────────────────────────────────────────────────────────────────────

const CANONICAL_CONDITIONS_M = [
  { label: 'Stockholder Approval (Company)',  codes: ['COND-M-STOCKHOLDER'], re: /stockholder\s+approval|shareholder\s+approval|requisite\s+vote/i, side: 'company' },
  { label: 'Stockholder Approval (Parent)',   re: /(?:parent|buyer|acquir\w+)\s+(?:stockholder|shareholder)\s+approval/i, side: 'parent', requireParentApproval: true },
  { label: 'No Injunctions / Legal Restraints', codes: ['COND-M-LEGAL'], re: /no\s+(?:injunction|order)|legal\s+(?:restraint|impediment)|absence\s+of\s+(?:injunction|enjoining)|government(?:al)?\s+proceeding|no\s+(?:pending\s+)?action/i },
  // 'HSR Clearance' + 'Other Regulatory Approvals' merged into one Antitrust
  // row per review: the canonical concept is antitrust clearance — HSR
  // expiration/termination plus scheduled (disclosure-schedule) approvals.
  { label: 'Antitrust',                       codes: ['COND-M-REG'], re: /hsr|hart[\s-]*scott|waiting\s+period\s+(?:has\s+)?expir|regulatory\s+approvals?|antitrust|cfius|sami?r|cma|merger\s+control|scheduled\s+approvals?/i },
  { label: 'S-4 / Proxy Effective',           codes: ['COND-M-S4'], re: /s-?4|proxy\s+statement\s+(?:has\s+been\s+)?(?:declared\s+)?effective|registration\s+statement/i },
  { label: 'Stock Exchange Listing',          codes: ['COND-M-LISTING'], re: /listing|stock\s+exchange|nasdaq|nyse/i },
  { label: 'Tender Offer Minimum Condition',  re: /tender\s+offer\s+minimum|minimum\s+(?:tender\s+)?condition|acceptance\s+time|minimum\s+tender/i, featureKey: 'tenderOfferMinimumCondition', tenderOnly: true },
];

const CANONICAL_CONDITIONS_B = [
  { label: 'Reps Bring-Down',                 codes: ['COND-B-REP'], re: /bring[\s-]*down|representations?\s+true|accuracy\s+of\s+(?:the\s+)?(?:representations|reps)/i },
  { label: 'Covenant Performance',            codes: ['COND-B-COV'], re: /covenants?\s+(?:performed|complied|compliance)|performance\s+of\s+covenants|(?:target|company)\s+covenant/i },
  { label: 'No Material Adverse Effect',      codes: ['COND-B-MAE'], re: /material\s+adverse\s+effect|\bmae\b/i, alwaysRender: true, maeSide: 'target' },
  { label: "Officer's Certificate",           codes: ['COND-B-CERT'], re: /officers?\s+certificate|closing\s+certificate|certificate\s+signed/i },
  { label: 'Dissenting Shares Threshold',     codes: ['COND-B-DISSENT'], re: /dissent|appraisal\s+(?:shares|threshold)/i },
];

const CANONICAL_CONDITIONS_S = [
  { label: 'Reps Bring-Down (Parent)',        codes: ['COND-S-REP'], re: /bring[\s-]*down|representations?\s+true|accuracy\s+of\s+(?:the\s+)?(?:representations|reps)/i },
  { label: 'Covenant Performance (Parent)',   codes: ['COND-S-COV'], re: /covenants?\s+(?:performed|complied|compliance)|performance\s+of\s+covenants|(?:parent|acquir\w+)\s+covenant/i },
  { label: 'No Material Adverse Effect (Parent)', re: /material\s+adverse\s+effect|\bmae\b/i, alwaysRender: true, maeSide: 'parent' },
  { label: "Officer's Certificate (Parent)",  codes: ['COND-S-CERT'], re: /officers?\s+certificate|closing\s+certificate|certificate\s+signed/i },
  { label: 'Financing / Sufficient Funds',    codes: ['COND-S-FUNDS'], re: /sufficient\s+funds|financing\s+condition|funds\s+condition/i },
];

// Match a canonical-condition row against a provision. Canonical code wins;
// category regex is the fallback for rows/provisions without a mapped code.
function conditionRowMatches(row, provision, code) {
  const c = code || null;
  if (row.codes && c && row.codes.includes(c)) return true;
  if (row.re) return row.re.test(String((provision && provision.category) || ''));
  return false;
}

// Value-shape discriminators, mirroring lib/citable.js. Inlined (not
// imported) so this module stays dependency-free — tests load it directly
// under `node --test` with no build step, and citable pulls in taxonomy.
// A citable wrapper is {value, quotes|text} (has `value`, no `code`); a
// tagged item is {code, label?} (taxonomy-resolved).
const isCitable = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('code' in v);
const isTagged = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && typeof v.code === 'string' && v.code.length > 0;

// Format one structured-feature value for display: unwrap citable {value,
// quotes} wrappers and tagged {code,label} items, join arrays, drop empties.
function formatConditionValue(val) {
  const u = isCitable(val) ? val.value : val;
  if (u === null || u === undefined || u === '' || u === false) return null;
  if (typeof u === 'boolean') return u ? 'Yes' : null;
  if (Array.isArray(u)) {
    const parts = u
      .map((x) => (isTagged(x) ? (x.label || x.code) : String(x)))
      .filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  if (isTagged(u)) return u.label || u.code;
  return String(u);
}

// Build the generic Standard/Detail lines for one matched condition
// provision's structured features. Pure (shared by the review UI and tests).
// Returns [{ label, value }] — an EMPTY array means the provision matched a
// canonical row but carries no displayable detail; callers must still render
// the row as PRESENT (this is where "Not present in this agreement" used to
// leak onto matched rows, hiding conditions the deal plainly has).
function conditionDetailLines(features) {
  const f = features || {};
  const fmt = formatConditionValue;
  const lines = [];
  const push = (label, value) => { if (value) lines.push({ label, value }); };
  // The main body of the cell for rows without a bespoke renderer. Callers
  // that build `features` off a real card (see conditions-m.config.js's
  // cardToProvision) already resolve f.mainCondition to the REAL clause text
  // (primary_quote/region_full_text) ahead of the AI's one-sentence summary,
  // falling back to the summary only when no clause text was ever captured —
  // this formatter just renders whatever precedence the caller resolved.
  push('Condition', fmt(f.mainCondition) || fmt(f.mainConcept));
  push('Threshold', fmt(f.dollarThreshold));
  push('Cure period', fmt(f.curePeriod) || fmt(f.cureDays));
  const scrape = fmt(f.materialityScrapeLanguage) || fmt(f.materialityScrapePresent) || fmt(f.materialityScrape);
  push('Materiality scrape', scrape ? 'Present' : null);
  push('Schedule reference', fmt(f.scheduleReference));
  return lines;
}

// Absent-row copy for the canonical-conditions checklist. Absence of a match
// only proves the extractor found nothing — NOT that the agreement lacks the
// condition — so the copy must not assert absence as fact.
const CONDITION_ABSENT_COPY = 'Not found (may not be present, or not yet extracted)';

// No-MAE condition's "continuing at Closing" requirement. The structured
// continuingRequirement boolean (extracted directly onto COND-B-MAE, always
// populated true/false on current-schema provisions per lib/rubric.js) wins
// over the regex — the regex is a fallback for legacy rows extracted before
// the field existed. Anchors BOTH word orders the source language uses:
// "continuing [to be/material adverse effect]" (continuing-first) and the
// trailing "...Material Adverse Effect that [has occurred and] is
// continuing" (MAE-first).
const MAE_CONTINUING_RE = /continu(?:ing|e[ds]?)\s+(?:to\s+(?:be|exist)|material\s+adverse\s+effect|effect)|(?:material\s+adverse\s+effect|\bmae\b)(?:\s+that)?(?:\s+has\s+occurred\s+and)?\s+is\s+continuing/i;

// entries: [{ continuingRequirement, mainCondition, fullText }] — one per
// matched No-MAE provision. Returns true/false/null (null = not specified,
// neither structured field nor regex found anything).
function deriveMaeContinuing(entries) {
  let sawStructured = false;
  for (const e of entries || []) {
    if (typeof (e && e.continuingRequirement) === 'boolean') {
      sawStructured = true;
      if (e.continuingRequirement === true) return true;
    }
  }
  if (sawStructured) return false;
  for (const e of entries || []) {
    const t = `${typeof (e && e.mainCondition) === 'string' ? e.mainCondition : ''} ${(e && e.fullText) || ''}`;
    if (MAE_CONTINUING_RE.test(t)) return true;
  }
  return null;
}

function canonicalConditionsFor(family) {
  if (family === 'COND-B') return CANONICAL_CONDITIONS_B;
  if (family === 'COND-S') return CANONICAL_CONDITIONS_S;
  return CANONICAL_CONDITIONS_M;
}

export {
  CANONICAL_CONDITIONS_M,
  CANONICAL_CONDITIONS_B,
  CANONICAL_CONDITIONS_S,
  canonicalConditionsFor,
  conditionRowMatches,
  conditionDetailLines,
  CONDITION_ABSENT_COPY,
  deriveMaeContinuing,
};
