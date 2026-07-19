// Pure decision logic behind pages/api/admin/reconcile/decide.js — split out
// (CommonJS, no fs/network access) so node:test can exercise it directly
// against fixtures without going through Next.js's build transform. WP-4
// delta (docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md, "5. WP-4
// (M4-01)"): decided_by actor, claim_ids[] linkage, and the
// normalized-v1.json `_meta.version` bump all live here.

const { resolveEditorKey } = require('../corrections/editor-keys');
const { bumpVersion } = require('./registry-version');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// decided_by actor resolution — mirrors the corrections Correct-tab pattern
// (docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md, lib/corrections/submit.js):
// an `x-editor-key` header resolves through EDITOR_KEYS first; absent/invalid
// key falls back to a free-text `decided_by` on the request body; absent
// both, the event still gets an explicit "unknown" actor rather than silently
// omitting one. Reconcile writes are already gated to local-only execution
// (pages/api/admin/reconcile/decide.js's `process.env.VERCEL` check), so
// unlike the corrections queue there is no pending-vs-applied branch here —
// every decision commits.
function resolveDecidedBy(body, editorKeyHeader, envValue = process.env.EDITOR_KEYS) {
  const editor = resolveEditorKey(editorKeyHeader, envValue);
  if (editor) return editor.name;
  const provided = body && body.decided_by ? String(body.decided_by).trim() : '';
  return provided || 'unknown';
}

function selectedEntries(entries, body) {
  if (Array.isArray(body.ids) && body.ids.length) {
    const ids = new Set(body.ids);
    return entries.filter((entry) => ids.has(entry.id));
  }
  if (body.field_key && Object.prototype.hasOwnProperty.call(body, 'raw_value')) {
    return entries.filter((entry) => entry.field_key === body.field_key && entry.raw_value === body.raw_value && entry.status !== 'RESOLVED');
  }
  if (body.id) return entries.filter((entry) => entry.id === body.id);
  return [];
}

function applyResolution(queue, normalized, body, now = new Date().toISOString(), decidedBy = 'unknown') {
  const nextQueue = clone(queue);
  const nextNormalized = clone(normalized);
  const entries = selectedEntries(nextQueue.entries || [], body);
  if (!entries.length) return { error: 'Queue entry not found' };
  const action = body.action || 'MERGE';
  const targetCanonicalKey = body.targetCanonicalKey || null;
  if (['MERGE', 'PROMOTE'].includes(action) && !targetCanonicalKey) {
    return { error: `${action} requires targetCanonicalKey` };
  }
  if (action === 'SPLIT') {
    return { error: 'SPLIT is not implemented yet; use Merge, Promote, or Freeform.' };
  }
  const touched = [];
  for (const entry of entries) {
    entry.status = 'RESOLVED';
    entry.resolution = {
      action,
      targetCanonicalKey,
      rationale: body.rationale || '',
      decided_by: decidedBy,
      resolved_at: now,
    };
    touched.push(entry.id);
  }
  // Claim linkage (WP-4 delta item 2): entries and triples share no id
  // space, but both carry the deal_id|field_key|raw_value triple key — the
  // same join the targetCanonicalKey mutation below relies on. Reuse it to
  // resolve `touched[]` (queue entry ids) to the normalized triple ids they
  // correspond to, so a claim's canonical history is queryable by triple id
  // regardless of whether this decision changed canonicalKey.
  const selectedKeys = new Set(entries.map((entry) => `${entry.deal_id}|${entry.field_key}|${entry.raw_value}`));
  const claimIds = [];
  for (const triple of nextNormalized.triples || []) {
    if (!selectedKeys.has(`${triple.deal_id}|${triple.field_key}|${triple.raw_value}`)) continue;
    claimIds.push(triple.id);
    if (targetCanonicalKey) triple.canonicalKey = targetCanonicalKey;
  }
  nextNormalized._meta = {
    ...(nextNormalized._meta || {}),
    version: bumpVersion(normalized._meta && normalized._meta.version),
  };
  const first = entries[0];
  const logRow = {
    id: `log-${Date.now()}`,
    action,
    field_key: first.field_key,
    raw_value: first.raw_value,
    targetCanonicalKey,
    rationale: body.rationale || '',
    decided_by: decidedBy,
    touched,
    claim_ids: claimIds,
    registry_version: nextNormalized._meta.version,
    resolved_at: now,
  };
  return { nextQueue, nextNormalized, entries, logRow };
}

module.exports = { applyResolution, selectedEntries, resolveDecidedBy, clone };
