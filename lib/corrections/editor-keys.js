// Editor-role resolution for the Correct-tab flow
// (docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md). No Supabase Auth in this
// phase — approved editors are named in the server-side EDITOR_KEYS env var,
// format: comma-separated `name:secret` pairs, e.g. "ben:xxxx,alex:yyyy".
//
// Deliberately constant-time-ish and silent about WHY a key failed: the
// spec requires the response to never reveal whether a key was wrong vs
// absent beyond the queued-vs-applied outcome, so resolveEditorKey just
// returns null on any failure to match — callers must not add their own
// diagnostic detail to error responses.

function parseEditorKeys(envValue) {
  const map = new Map();
  if (!envValue || typeof envValue !== 'string') return map;
  for (const pair of envValue.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0 || idx === trimmed.length - 1) continue; // malformed entry, skip
    const name = trimmed.slice(0, idx).trim();
    const secret = trimmed.slice(idx + 1).trim();
    if (!name || !secret) continue;
    map.set(secret, name);
  }
  return map;
}

// Returns { name } for a valid key, or null for missing/invalid/malformed
// input — the caller cannot distinguish "no header sent" from "header sent
// but wrong" from this return value alone, by design.
function resolveEditorKey(headerValue, envValue = process.env.EDITOR_KEYS) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const key = headerValue.trim();
  if (!key) return null;
  const map = parseEditorKeys(envValue);
  const name = map.get(key);
  return name ? { name } : null;
}

module.exports = { parseEditorKeys, resolveEditorKey };
