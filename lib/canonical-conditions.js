// ───────────────────────────────────────────────────────────────────────────
// CANONICAL_CONDITIONS — the canonical-condition row catalogue, per family.
// Each row carries:
//   label   — human-readable canonical condition name
//   re      — regex against provision.category to match deal provisions
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
  { label: 'Stockholder Approval (Company)',  re: /stockholder\s+approval|shareholder\s+approval|requisite\s+vote/i, side: 'company' },
  { label: 'Stockholder Approval (Parent)',   re: /(?:parent|buyer|acquir\w+)\s+(?:stockholder|shareholder)\s+approval/i, side: 'parent', requireParentApproval: true },
  { label: 'No Injunctions',                  re: /no\s+(?:injunction|order)|legal\s+restraint|absence\s+of\s+(?:injunction|enjoining)|government(?:al)?\s+proceeding|no\s+(?:pending\s+)?action/i },
  { label: 'HSR Clearance',                   re: /hsr|hart[\s-]*scott|waiting\s+period\s+(?:has\s+)?expir/i },
  { label: 'Other Regulatory Approvals',      re: /regulatory\s+approvals?|antitrust\s+approvals?|cfius|sami?r|cma|merger\s+control/i },
  { label: 'S-4 / Proxy Effective',           re: /s-?4|proxy\s+statement\s+(?:has\s+been\s+)?(?:declared\s+)?effective|registration\s+statement/i },
  { label: 'Tender Offer Minimum Condition',  re: /tender\s+offer\s+minimum|minimum\s+condition|acceptance\s+time/i, tenderOnly: true },
];

const CANONICAL_CONDITIONS_B = [
  { label: 'Reps Bring-Down',                 re: /bring[\s-]*down|representations?\s+true|accuracy\s+of\s+(?:the\s+)?representations/i },
  { label: 'Covenant Performance',            re: /covenants?\s+performed|covenants?\s+complied|performance\s+of\s+covenants/i },
  { label: 'No Material Adverse Effect',      re: /material\s+adverse\s+effect|\bmae\b/i, alwaysRender: true, maeSide: 'target' },
];

const CANONICAL_CONDITIONS_S = [
  { label: 'Reps Bring-Down (Parent)',        re: /bring[\s-]*down|representations?\s+true|accuracy\s+of\s+(?:the\s+)?representations/i },
  { label: 'Covenant Performance (Parent)',   re: /covenants?\s+performed|covenants?\s+complied|performance\s+of\s+covenants/i },
  { label: 'No Material Adverse Effect (Parent)', re: /material\s+adverse\s+effect|\bmae\b/i, alwaysRender: true, maeSide: 'parent' },
];

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
};
