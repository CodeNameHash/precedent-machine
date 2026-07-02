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
  { label: 'HSR Clearance',                   re: /hsr|hart[\s-]*scott|waiting\s+period\s+(?:has\s+)?expir/i },
  { label: 'Other Regulatory Approvals',      codes: ['COND-M-REG'], re: /regulatory\s+approvals?|antitrust\s+approvals?|cfius|sami?r|cma|merger\s+control/i },
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
};
