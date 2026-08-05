// Crude, in-process per-IP rate limit for pending-correction submissions
// (spec: "reject > 20 pending submissions per hour per IP"). No new schema
// column was added for this (the migration's field list in
// docs/archive/handoffs/CORRECT-TAB-SPEC-2026-07-17.md doesn't include one, and
// storing IP addresses next to a user's free-text name felt like scope
// creep beyond what the spec asked for) — an in-memory sliding window is
// the minimal "crude" implementation the spec calls for. It resets on cold
// start / redeploy, which is an accepted tradeoff for a soft abuse guard,
// not a security control.

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PENDING_PER_HOUR = 20;

// ip -> array of timestamps (ms) of pending submissions within the window.
let pendingByIp = new Map();

function prune(ip, now) {
  const list = pendingByIp.get(ip) || [];
  const kept = list.filter((ts) => now - ts < WINDOW_MS);
  if (kept.length > 0) pendingByIp.set(ip, kept);
  else pendingByIp.delete(ip);
  return kept;
}

// Returns true if another PENDING submission from this ip is allowed right
// now. Does not record anything — call recordPendingSubmission after a
// pending row is actually written.
function canSubmitPending(ip, now = Date.now()) {
  const key = ip || 'unknown';
  const kept = prune(key, now);
  return kept.length < MAX_PENDING_PER_HOUR;
}

function recordPendingSubmission(ip, now = Date.now()) {
  const key = ip || 'unknown';
  const kept = prune(key, now);
  kept.push(now);
  pendingByIp.set(key, kept);
}

// Test-only: clear the module-level store between test cases.
function resetRateLimitStore() {
  pendingByIp = new Map();
}

module.exports = {
  MAX_PENDING_PER_HOUR,
  WINDOW_MS,
  canSubmitPending,
  recordPendingSubmission,
  resetRateLimitStore,
};
