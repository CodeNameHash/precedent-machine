// Shared fiduciary-out-standard label map. ONE definition consumed by
// nosol-fiduciary.config.js, nosol-noshop.config.js, and nosol-superior.config.js
// (mirrors the vote-standard.js / board-change-standard.js shared modules).
// Previously this map was defined independently in all three configs, and
// 'is-superior-proposal' had drifted to two different values across them
// ("Is a Superior Proposal (after Parent's adjustments)" in nosol-fiduciary,
// "Superior Proposal only" in nosol-noshop/nosol-superior). The canonical
// value is the plain "Is a Superior Proposal" -- no parenthetical, no "only".
// Codes here are the extraction-assigned fiduciaryOutStandard enum; unknown
// codes fall back to each config's local prettifyCode (codes are hover-title
// only, never rendered verbatim).
export const FIDUCIARY_STANDARD_LABELS = {
  'is-superior-proposal': 'Is a Superior Proposal',
  'constitutes-or-could-lead-to-superior': 'Constitutes or could lead to a Superior Proposal',
  'constitutes-or-could-reasonably-be-expected-to-lead-to-superior': 'Constitutes or could reasonably be expected to lead to a Superior Proposal',
  'continues-to-constitute-superior': 'Continues to constitute a Superior Proposal',
};
