/* ─────────────────────────────────────────────────────────────────────────
   lib/run-history.js — extraction run records + run-to-run diffs.
   ───────────────────────────────────────────────────────────────────────────
   Every (non-dry) extraction phase appends a run record to
   deals.metadata.extraction_runs: who ran what, with which backend/model,
   and a lightweight SNAPSHOT of what was stored (category/code/text-hash/
   feature keys per provision). That makes two questions cheap forever:

     • "what changed between run A and run B?"  → diffSnapshots()
     • "did this prompt tweak regress anything?" → diff before/after

   Tonight's motivating case: a June TERMF extraction stored a
   misclassified "Acquirer Expense Reimbursement" provision; discovering
   that took forensic DB queries. With run history it's one diff line:
   `- Acquirer Expense Reimbursement (features: mainConcept only)`.

   Records are capped (newest kept) so deal metadata stays bounded.
   CommonJS: shared by API routes, local scripts, and tests.
   ───────────────────────────────────────────────────────────────────────── */

const crypto = require('crypto');

const MAX_RUNS_PER_DEAL = 40;

function textHash(s) {
  return crypto.createHash('sha1').update(String(s || '')).digest('hex').slice(0, 12);
}

/** One snapshot row per provision — enough to diff, small enough to keep. */
function snapshotProvision(p) {
  const features = p.features || {};
  return {
    type: p.type || null,
    category: p.category || null,
    code: features.canonicalCode || p.code || null,
    text_hash: textHash(p.text),
    text_chars: (p.text || '').length,
    feature_keys: Object.keys(features).sort(),
  };
}

/**
 * Build a run record for deals.metadata.extraction_runs.
 * `provisions` are the in-memory (pre-store) shape: { type, category, text, features }.
 */
function buildRunRecord({ type, backend, model, timingMs, inserted, deleted, provisions }) {
  return {
    run_id: `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${type}`,
    type,
    backend: backend || 'api',
    model: model || null,
    at: new Date().toISOString(),
    timing_ms: timingMs ?? null,
    inserted: inserted ?? null,
    deleted: deleted ?? null,
    snapshot: (provisions || []).map(snapshotProvision),
  };
}

/** Append a record, keeping the newest MAX_RUNS_PER_DEAL. */
function appendRunRecord(metadata, record) {
  const runs = Array.isArray(metadata.extraction_runs) ? metadata.extraction_runs : [];
  return { ...metadata, extraction_runs: [...runs, record].slice(-MAX_RUNS_PER_DEAL) };
}

/**
 * Diff two snapshots (arrays of snapshotProvision rows).
 * Provisions match on (type, category); code/text/features changes on a
 * matched pair are reported as `changed`.
 * Returns { added: [...], removed: [...], changed: [...], unchanged: n }.
 */
function diffSnapshots(before, after) {
  const key = (r) => `${r.type}||${r.category}`;
  const byKey = (rows) => {
    const m = new Map();
    for (const r of rows || []) {
      // Duplicate categories within a type are possible (e.g. multiple
      // Superior Proposal termination rights) — bucket them.
      if (!m.has(key(r))) m.set(key(r), []);
      m.get(key(r)).push(r);
    }
    return m;
  };
  const b = byKey(before);
  const a = byKey(after);

  const added = [];
  const removed = [];
  const changed = [];
  let unchanged = 0;

  for (const [k, aRows] of a) {
    const bRows = b.get(k) || [];
    // Pair off rows; extras are added/removed.
    const n = Math.min(aRows.length, bRows.length);
    for (let i = 0; i < n; i++) {
      const deltas = [];
      if (aRows[i].code !== bRows[i].code) deltas.push(`code ${bRows[i].code} → ${aRows[i].code}`);
      if (aRows[i].text_hash !== bRows[i].text_hash) {
        deltas.push(`text ${bRows[i].text_chars} → ${aRows[i].text_chars} chars`);
      }
      const bf = (bRows[i].feature_keys || []).join(',');
      const af = (aRows[i].feature_keys || []).join(',');
      if (bf !== af) {
        const bSet = new Set(bRows[i].feature_keys || []);
        const aSet = new Set(aRows[i].feature_keys || []);
        const gained = [...aSet].filter((x) => !bSet.has(x));
        const lost = [...bSet].filter((x) => !aSet.has(x));
        if (gained.length) deltas.push(`+features ${gained.join(',')}`);
        if (lost.length) deltas.push(`-features ${lost.join(',')}`);
      }
      if (deltas.length) changed.push({ ...aRows[i], deltas });
      else unchanged += 1;
    }
    for (let i = n; i < aRows.length; i++) added.push(aRows[i]);
    const bExtra = bRows.slice(n);
    for (const r of bExtra) removed.push(r);
  }
  for (const [k, bRows] of b) {
    if (!a.has(k)) removed.push(...bRows);
  }

  return { added, removed, changed, unchanged };
}

/** Render a diff as terse terminal lines. */
function formatDiff(diff) {
  const lines = [];
  for (const r of diff.added) lines.push(`+ [${r.type}] ${r.category} (${r.text_chars} chars, features: ${r.feature_keys.join(',') || 'none'})`);
  for (const r of diff.removed) lines.push(`- [${r.type}] ${r.category} (features: ${r.feature_keys.join(',') || 'none'})`);
  for (const r of diff.changed) lines.push(`~ [${r.type}] ${r.category}: ${r.deltas.join('; ')}`);
  lines.push(`= ${diff.unchanged} unchanged`);
  return lines.join('\n');
}

/** Snapshot rows from CURRENT stored provisions (DB shape) for diffing. */
function snapshotStoredProvision(p) {
  const features = (p.ai_metadata && p.ai_metadata.features) || {};
  return {
    type: p.type || null,
    category: p.category || null,
    code: features.canonicalCode || null,
    text_hash: textHash(p.full_text),
    text_chars: (p.full_text || '').length,
    feature_keys: Object.keys(features).sort(),
  };
}

module.exports = {
  buildRunRecord,
  appendRunRecord,
  diffSnapshots,
  formatDiff,
  snapshotProvision,
  snapshotStoredProvision,
  MAX_RUNS_PER_DEAL,
};
