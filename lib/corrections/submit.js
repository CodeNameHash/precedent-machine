// Correct-tab submission orchestration (pages/api/corrections/submit.js is
// a thin wrapper around handleCorrectionSubmission). Spec:
// docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md.
//
// IMPORTANT SCHEMA NOTE: review-v2 corrections target a `provision_cards`
// row (`card_id`), which has NO foreign key to the legacy `provisions`
// table that pages/api/provisions.js's PATCH (and therefore
// lib/provisions/apply-patch.js) writes to — they are two separate
// extraction generations (see supabase/schema-03-card-model.sql vs
// supabase/schema.sql). So even an approved editor's proposal can only be
// auto-applied when the caller supplies a `provision_id` that resolves to a
// REAL legacy `provisions` row (the v1 edit page's use case). Absent that,
// "map cleanly to an automatable patch" is false by construction and the
// correction queues as `manual_review` — this is the spec's own "never
// guess a write" rule, not a shortfall of this implementation.

const { resolveEditorKey } = require('./editor-keys');
const { logCorrection } = require('./log');
const { applyProvisionPatch, provisionExists } = require('../provisions/apply-patch');
const { canSubmitPending, recordPendingSubmission } = require('./rate-limit');

const VALID_KINDS = new Set(['code', 'party', 'value', 'quote', 'other']);

// Returns { updates } when `target`/`proposed` map cleanly onto an
// allow-listed `provisions` column update, or null when the proposal can't
// be automated (kind has no column mapping, or the proposed value is
// blank). 'party' and 'other' never map — the legacy provisions table has
// no party_scope column, and 'other' is free text by definition.
function resolveTargetUpdate(target, proposed) {
  const kind = target && target.kind;
  const value = typeof proposed === 'string' ? proposed.trim() : proposed;
  if (value === null || value === undefined || value === '') return null;

  if (kind === 'code') return { updates: { category: String(value).trim() } };
  if (kind === 'quote') return { updates: { full_text: String(value).trim() } };
  if (kind === 'value' && target.claim_attribute) {
    return { updates: { ai_metadata: { features: { [target.claim_attribute]: value } } } };
  }
  return null;
}

function badRequest(message) {
  return { httpStatus: 400, outcome: 'error', error: message };
}

async function handleCorrectionSubmission(sb, body, opts = {}) {
  const { editorKeyHeader, ip } = opts;
  const b = body || {};
  const { card_id, provision_id, deal_id, target, proposed, rationale, submitted_by } = b;

  if (!deal_id) return badRequest('deal_id is required');
  if (!card_id && !provision_id) return badRequest('card_id or provision_id is required');
  if (!target || !VALID_KINDS.has(target.kind)) {
    return badRequest(`target.kind must be one of ${[...VALID_KINDS].join(', ')}`);
  }
  if (proposed === undefined || proposed === null || String(proposed).trim() === '') {
    return badRequest('proposed is required');
  }
  if (!rationale || !String(rationale).trim()) {
    return badRequest('rationale is required');
  }

  const editor = resolveEditorKey(editorKeyHeader);
  const submittedByName = editor ? editor.name : (submitted_by ? String(submitted_by).trim() : null) || null;

  const mapping = resolveTargetUpdate(target, proposed);
  const targetProvisionOk = provision_id ? await provisionExists(sb, provision_id) : false;

  if (editor && mapping && targetProvisionOk) {
    const { provision, correction, error } = await applyProvisionPatch(sb, {
      id: provision_id,
      updates: mapping.updates,
      reason: rationale,
      user_id: null,
      extra: {
        submitted_by: submittedByName,
        card_id: card_id || null,
        claim_attribute: (target.claim_attribute) || null,
      },
    });
    if (error) return { httpStatus: 500, outcome: 'error', error: error.message };
    return { httpStatus: 200, outcome: 'applied', correction, provision };
  }

  // Everything else queues — either the submitter isn't an approved editor,
  // or the proposal can't be safely automated (see resolveTargetUpdate /
  // the module header note on provision_cards vs provisions).
  if (!canSubmitPending(ip)) {
    return { httpStatus: 429, outcome: 'error', error: 'Too many pending submissions from this address — try again later.' };
  }

  const correction_type = editor ? 'manual_review' : 'pending_submission';
  const correction = await logCorrection(sb, {
    provision_id: provision_id || null,
    deal_id,
    correction_type,
    before: null,
    after: null,
    context: { target, proposed },
    reason: rationale,
    user_id: null,
    status: 'pending',
    submitted_by: submittedByName,
    card_id: card_id || null,
    claim_attribute: (target.claim_attribute) || null,
  });
  recordPendingSubmission(ip);
  return { httpStatus: 200, outcome: 'pending', correction };
}

module.exports = { handleCorrectionSubmission, resolveTargetUpdate, VALID_KINDS };
