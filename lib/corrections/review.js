// Approve/reject logic for pending corrections (pages/corrections-review.js
// page, pages/api/corrections/review.js route). Spec:
// docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md's "Review queue" section.
//
// The spec names the review PAGE (pages/corrections-review.js) but not its
// backing API route — this module + pages/api/corrections/review.js is the
// minimal endpoint the page's Approve/Reject actions need. Both actions
// require a valid editor key (same EDITOR_KEYS mechanism as submit).

const { resolveEditorKey } = require('./editor-keys');
const { resolveTargetUpdate } = require('./submit');
const { writeProvisionUpdate, provisionExists, snapshot } = require('../provisions/apply-patch');

async function fetchPendingCorrection(sb, id) {
  const { data, error } = await sb.from('corrections').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data;
}

// Approve: UPDATES the existing pending row in place (does not insert a
// second correction row) — see lib/provisions/apply-patch.js's header
// comment on why writeProvisionUpdate (not applyProvisionPatch) is used
// here. If the original proposal still can't be mapped to an automated
// provisions PATCH (free-text 'other', or no resolvable provision_id), the
// row is still marked applied/reviewed — approval records that a human
// signed off, it never fabricates a write the system can't justify.
async function approveCorrection(sb, { id, reviewed_by }) {
  const row = await fetchPendingCorrection(sb, id);
  if (!row) return { httpStatus: 404, error: 'correction not found' };
  if (row.status !== 'pending') return { httpStatus: 409, error: `correction is already ${row.status}` };

  const context = row.context && typeof row.context === 'object' ? row.context : {};
  const target = context.target || null;
  const proposed = context.proposed;
  const mapping = target ? resolveTargetUpdate(target, proposed) : null;
  const provOk = row.provision_id ? await provisionExists(sb, row.provision_id) : false;

  let before = row.before;
  let after = row.after;
  if (mapping && provOk) {
    const result = await writeProvisionUpdate(sb, { id: row.provision_id, updates: mapping.updates });
    if (result.error) return { httpStatus: 500, error: result.error.message };
    before = before || snapshot(result.beforeRow);
    after = after || snapshot(result.provision);
  }

  const { data, error } = await sb
    .from('corrections')
    .update({ status: 'applied', reviewed_by, reviewed_at: new Date().toISOString(), before, after })
    .eq('id', id)
    .select()
    .single();
  if (error) return { httpStatus: 500, error: error.message };
  return { httpStatus: 200, outcome: 'applied', correction: data };
}

async function rejectCorrection(sb, { id, reviewed_by, note }) {
  if (!note || !String(note).trim()) return { httpStatus: 400, error: 'note is required to reject a correction' };
  const row = await fetchPendingCorrection(sb, id);
  if (!row) return { httpStatus: 404, error: 'correction not found' };
  if (row.status !== 'pending') return { httpStatus: 409, error: `correction is already ${row.status}` };

  const context = row.context && typeof row.context === 'object' ? row.context : {};
  const { data, error } = await sb
    .from('corrections')
    .update({
      status: 'rejected',
      reviewed_by,
      reviewed_at: new Date().toISOString(),
      context: { ...context, rejection_note: String(note).trim() },
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { httpStatus: 500, error: error.message };
  return { httpStatus: 200, outcome: 'rejected', correction: data };
}

// action: 'approve' | 'reject'. Requires a resolvable editor key — returns
// 403 (never revealing key-vs-missing detail, per the submit route's same
// convention) when absent/invalid.
async function handleReviewAction(sb, body, { editorKeyHeader } = {}) {
  const editor = resolveEditorKey(editorKeyHeader);
  if (!editor) return { httpStatus: 403, error: 'editor key required' };

  const { id, action, note } = body || {};
  if (!id) return { httpStatus: 400, error: 'id is required' };

  if (action === 'approve') return approveCorrection(sb, { id, reviewed_by: editor.name });
  if (action === 'reject') return rejectCorrection(sb, { id, reviewed_by: editor.name, note });
  return { httpStatus: 400, error: "action must be 'approve' or 'reject'" };
}

module.exports = { handleReviewAction, approveCorrection, rejectCorrection };
