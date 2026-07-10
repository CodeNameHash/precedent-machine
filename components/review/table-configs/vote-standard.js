// Shared stockholder-vote-standard synthesizer. ONE definition consumed by
// conditions.config.js, votes-approvals-meeting.config.js, and
// termination-rights.config.js so the same threshold prose yields the same
// pill ("Majority of outstanding shares" etc.) in every table. Previously this
// 6-line pure function was copy-pasted across those three configs; the copies
// were byte-identical in output (termination-rights called it
// `parseVoteStandard` and omitted the leading `!def` guard, but its only call
// site is `threshold && parseVoteStandard(threshold)`, so `def` is always
// truthy there — same result).
//
// Given a definition/threshold sentence, returns the canonical vote-standard
// label, or null when nothing matches.
export function voteStandard(def) {
  if (!def) return null;
  const t = String(def).toLowerCase();
  if (/two-?thirds|2\/3|66\s*2\/3|sixty-?six and two-?thirds/.test(t)) return 'Two-thirds of outstanding shares';
  if (/majority of (the )?(issued and )?outstanding/.test(t)) return 'Majority of outstanding shares';
  if (/majority of[^.]*(votes? cast|voting power)/.test(t)) return 'Majority of voting power';
  if (/majority/.test(t)) return 'Majority stockholder approval';
  return null;
}
