const VALID_TABS = new Set(['provisions', 'document']);
const VALID_MODES = new Set(['edit']);

function cleanValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const cleaned = cleanValue(item);
      if (cleaned) return cleaned;
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanList(value) {
  const items = Array.isArray(value) ? value : [value];
  const cleaned = items.map(cleanValue).filter(Boolean);
  if (cleaned.length === 0) return null;
  return cleaned.length === 1 ? cleaned[0] : cleaned;
}

function cleanTab(value) {
  const tab = cleanValue(value);
  return VALID_TABS.has(tab) ? tab : null;
}

function cleanMode(value) {
  const mode = cleanValue(value);
  return VALID_MODES.has(mode) ? mode : null;
}

export function parseReviewRouteQuery(query = {}) {
  const provisionId = cleanValue(query.provision);
  return {
    section: provisionId ? null : cleanList(query.section),
    provisionId,
    tab: cleanTab(query.tab),
    mode: cleanMode(query.mode),
    editProvisionId: cleanValue(query.edit),
  };
}

export function serializeReviewRouteQuery(route = {}) {
  const provisionId = cleanValue(route.provisionId || route.provision);
  const editProvisionId = cleanValue(route.editProvisionId || route.edit);
  const tab = cleanTab(route.tab);
  const section = provisionId ? null : cleanList(route.section);
  const query = {};

  if (section) query.section = section;
  if (provisionId) query.provision = provisionId;
  if (tab) query.tab = tab;
  if (editProvisionId) {
    query.mode = 'edit';
    query.edit = editProvisionId;
  }

  return query;
}
