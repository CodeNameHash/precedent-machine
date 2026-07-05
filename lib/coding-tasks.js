const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CODING_ACTIONS = [
  'assign_existing',
  'split',
  'ignore',
  'propose_new_code',
];

const VALID_CODING_ACTIONS = new Set(CODING_ACTIONS);
const MAX_NOTE_CHARS = 4000;
const MAX_SUGGESTED_CODE_CHARS = 200;

function firstString(value) {
  if (Array.isArray(value)) return firstString(value[0]);
  if (typeof value !== 'string') return '';
  return value.trim();
}

function cleanLimited(value, max) {
  const text = firstString(value);
  return text.length > max ? text.slice(0, max) : text;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function validateCodingTaskInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const dealId = firstString(input.deal_id);
  const needsCodeId = firstString(input.needs_code_id || input.uncoded_id || input.item_id);
  const provisionId = firstString(input.provision_id);
  const suggestedAction = firstString(input.suggested_action || input.coding_action || input.action);
  const note = cleanLimited(input.note || input.ben_note, MAX_NOTE_CHARS);
  const suggestedCode = cleanLimited(input.suggested_code || input.existing_code, MAX_SUGGESTED_CODE_CHARS);
  const errors = {};

  if (!isUuid(dealId)) errors.deal_id = 'deal_id must be a UUID';
  if (!needsCodeId && !provisionId) errors.needs_code_id = 'needs_code_id or provision_id is required';
  if (provisionId && !isUuid(provisionId)) errors.provision_id = 'provision_id must be a UUID';
  if (!VALID_CODING_ACTIONS.has(suggestedAction)) {
    errors.suggested_action = `suggested_action must be one of: ${CODING_ACTIONS.join(', ')}`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      dealId,
      needsCodeId,
      provisionId: provisionId || null,
      suggestedAction,
      note,
      suggestedCode: suggestedCode || null,
    },
  };
}

function findNeedsCodeItem(items, { needsCodeId, provisionId } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (provisionId) {
    const byProvision = list.find((item) => item && item.provision_id === provisionId);
    if (byProvision) return byProvision;
  }
  if (needsCodeId) {
    return list.find((item) => item && item.id === needsCodeId) || null;
  }
  return null;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function taskLockKey(dealId, item) {
  const provisionId = item && item.provision_id ? item.provision_id : null;
  return `needs-code:${dealId}:${provisionId || (item && item.id) || 'unknown'}`;
}

function buildCodingTaskPayload({ deal, item, suggestedAction, note, suggestedCode, status = 'pending' }) {
  const dealId = (deal && (deal.id || deal.deal_id)) || null;
  const fullText = String((item && (item.full_text || item.text)) || '').trim();
  const preview = (item && item.preview) || compactText(fullText).slice(0, 240);
  const currentType = (item && item.type) || null;
  const currentCategory = (item && item.category) || null;
  const currentCode = (item && item.code) || null;

  return {
    source: 'admin/gaps',
    version: 1,
    status,
    deal_id: dealId,
    provision_id: (item && item.provision_id) || null,
    current_type: currentType,
    current_category: currentCategory,
    current_code: currentCode,
    full_text: fullText,
    ben_note: note || '',
    suggested_action: suggestedAction,
    suggested_code: suggestedCode || null,
    deal: {
      deal_id: dealId,
      acquirer: (deal && deal.acquirer) || null,
      target: (deal && deal.target) || null,
    },
    needs_code_item: {
      id: (item && item.id) || null,
      family_type: (item && item.family_type) || null,
      proposed: Boolean(item && item.proposed),
      suggested_reason: (item && item.suggested_reason) || null,
      rough_heading: (item && item.rough_heading) || null,
      length: fullText.length,
      preview,
      full_text: fullText,
    },
    current: {
      type: currentType,
      category: currentCategory,
      code: currentCode,
    },
    audit: {
      direct_taxonomy_write: false,
      cli_audited: true,
    },
  };
}

function buildCodingTaskRow({ deal, item, suggestedAction, note, suggestedCode, createdBy = 'admin/gaps' }) {
  const dealId = (deal && (deal.id || deal.deal_id)) || null;
  const payload = buildCodingTaskPayload({ deal, item, suggestedAction, note, suggestedCode });

  return {
    status: 'pending',
    suggested_action: suggestedAction,
    deal_id: dealId,
    provision_id: payload.provision_id,
    current_type: payload.current_type,
    current_category: payload.current_category,
    current_code: payload.current_code,
    full_text: payload.full_text,
    note: payload.ben_note,
    suggested_code: payload.suggested_code,
    lock_key: taskLockKey(dealId, item),
    payload,
    created_by: createdBy,
  };
}

function summariseTaskForCli(task) {
  const payload = task && task.payload && typeof task.payload === 'object' ? task.payload : {};
  return {
    id: task && task.id,
    status: (task && task.status) || payload.status || null,
    suggested_action: (task && task.suggested_action) || payload.suggested_action || null,
    deal_id: (task && task.deal_id) || payload.deal_id || null,
    provision_id: (task && task.provision_id) || payload.provision_id || null,
    current_type: (task && task.current_type) || payload.current_type || null,
    current_category: (task && task.current_category) || payload.current_category || null,
    current_code: (task && task.current_code) || payload.current_code || null,
    note: (task && task.note) || payload.ben_note || '',
    suggested_code: (task && task.suggested_code) || payload.suggested_code || null,
    preview: payload.needs_code_item ? payload.needs_code_item.preview : compactText(task && task.full_text).slice(0, 240),
  };
}

module.exports = {
  CODING_ACTIONS,
  VALID_CODING_ACTIONS,
  MAX_NOTE_CHARS,
  MAX_SUGGESTED_CODE_CHARS,
  isUuid,
  validateCodingTaskInput,
  findNeedsCodeItem,
  buildCodingTaskPayload,
  buildCodingTaskRow,
  summariseTaskForCli,
  taskLockKey,
};
