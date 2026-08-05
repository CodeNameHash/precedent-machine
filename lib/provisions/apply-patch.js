// Shared "apply a patch to a provisions row + log the correction" core.
//
// Extracted from pages/api/provisions.js's PATCH handler so the Correct-tab
// submission/review flow (pages/api/corrections/submit.js,
// pages/api/corrections/review.js) can write through the SAME machinery the
// v1 edit page uses — the corrections table stays the single source of
// truth and lib/parser-v2/reapply-corrections.js's before/after-snapshot
// overlay matching keeps working unchanged, per docs/archive/handoffs/
// CORRECT-TAB-SPEC-2026-07-17.md's "reuse, do not rebuild" constraint.
//
// Two layers:
//   - writeProvisionUpdate: fetch-before -> merge ai_metadata -> UPDATE.
//     No correction-table write. Used when the caller needs to control the
//     correction row itself (e.g. updating an existing pending row in place
//     on review-approve, instead of inserting a second one).
//   - applyProvisionPatch: writeProvisionUpdate + INSERT a new correction
//     row via logCorrection (same call the v1 PATCH handler always made).
//     `extra` lets callers outside the v1 edit page (the submit route)
//     attach submitted_by/card_id/claim_attribute to that row without
//     duplicating the insert logic.

const { diffCorrectionType, logCorrection } = require('../corrections/log');
const { mergeProvisionAiMetadata } = require('../provision-metadata-locks');

// Fields snapshotted into before/after for correction logging.
const TRACKED_FIELDS = ['type', 'category', 'full_text', 'ai_favorability', 'prohibition', 'exceptions'];

function snapshot(provision) {
  if (!provision) return null;
  const snap = {};
  for (const k of TRACKED_FIELDS) {
    if (k in provision) snap[k] = provision[k];
  }
  const meta = provision && provision.ai_metadata;
  let parsed = meta;
  if (typeof meta === 'string') {
    try { parsed = JSON.parse(meta); } catch { parsed = null; }
  }
  if (parsed && typeof parsed === 'object' && parsed.features) {
    snap.features = parsed.features;
  }
  return snap;
}

// updates: already-validated/allow-listed column updates (type, category,
// full_text, ai_favorability, prohibition, exceptions, ai_metadata). Callers
// are responsible for allow-listing — this module trusts its input, same as
// the PATCH handler trusted `safeUpdates`.
async function writeProvisionUpdate(sb, { id, updates }) {
  if (!id) return { error: { message: 'id is required' } };

  // Best-effort before-fetch, matching the original inline PATCH logic: a
  // failed/errored fetch does NOT block the update (beforeRow stays null and
  // correction logging degrades gracefully) — only the UPDATE itself is
  // load-bearing. A genuinely nonexistent id still surfaces as an error
  // below, from the update's own .single() call finding zero rows.
  let beforeRow = null;
  try {
    const { data: pre } = await sb.from('provisions').select('*').eq('id', id).single();
    beforeRow = pre || null;
  } catch (err) {
    console.warn('[apply-patch] failed to fetch before-state:', err?.message || err);
  }

  const safeUpdates = { ...updates };
  if ('ai_metadata' in safeUpdates && safeUpdates.ai_metadata && typeof safeUpdates.ai_metadata === 'object') {
    let existingMeta = beforeRow.ai_metadata;
    if (typeof existingMeta === 'string') {
      try { existingMeta = JSON.parse(existingMeta); } catch { existingMeta = null; }
    }
    safeUpdates.ai_metadata = mergeProvisionAiMetadata(existingMeta, safeUpdates.ai_metadata);
  }

  const { data, error } = await sb.from('provisions').update(safeUpdates).eq('id', id).select().single();
  if (error) return { error, beforeRow };
  return { provision: data, beforeRow };
}

// Full apply-and-log path: writeProvisionUpdate, then INSERT a fresh
// correction row (status defaults to 'applied' per the migration's column
// default — see supabase/corrections-status-schema.sql). `extra` is merged
// into the insert payload verbatim (submitted_by/card_id/claim_attribute
// for Correct-tab submissions; omitted entirely by the v1 PATCH handler, so
// its behavior/shape is unchanged).
async function applyProvisionPatch(sb, { id, updates, reason, user_id, extra } = {}) {
  const { provision, beforeRow, error } = await writeProvisionUpdate(sb, { id, updates });
  if (error) return { error, beforeRow };

  let correction = null;
  try {
    const before = snapshot(beforeRow);
    const after = snapshot(provision);
    const correction_type = diffCorrectionType(before, after);
    if (correction_type) {
      correction = await logCorrection(sb, {
        provision_id: id,
        deal_id: provision?.deal_id || beforeRow?.deal_id || null,
        correction_type,
        before,
        after,
        context: {
          original_ai_type: beforeRow?.type || null,
          original_ai_category: beforeRow?.category || null,
          original_ai_favorability: beforeRow?.ai_favorability || null,
        },
        reason: reason || null,
        user_id: user_id || null,
        ...(extra || {}),
      });
    }
  } catch (err) {
    console.warn('[apply-patch] correction logging failed:', err?.message || err);
  }

  return { provision, beforeRow, correction };
}

// Lightweight existence check used by the Correct-tab submit route to
// decide whether a proposal is even eligible for the automated PATCH path —
// review-v2 cards (provision_cards) are a SEPARATE table from the legacy
// `provisions` rows this module patches (no FK between them), so most
// correction submissions carry no resolvable provision_id and must queue
// for manual review regardless of who submitted them. See
// docs/archive/handoffs/CORRECT-TAB-SPEC-2026-07-17.md and this repo's
// provision_cards/provisions schema split.
async function provisionExists(sb, id) {
  if (!id) return false;
  try {
    const { data, error } = await sb.from('provisions').select('id').eq('id', id).maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

module.exports = {
  TRACKED_FIELDS,
  snapshot,
  writeProvisionUpdate,
  applyProvisionPatch,
  provisionExists,
};
