const RULES = Object.freeze([
  { test: /status of the company as a reit|qualif(?:y|ied) as a reit/i, identity: 'maintain-reit-qualification' },
  { test: /adversely affects? the ability .{0,60}regulatory approvals?/i, identity: 'not-impede-regulatory-approvals' },
  { test: /prompt written notice/i, identity: 'notify-of-customer-relationship-issues' },
  { test: /anti-corruption|economic sanctions|\bsanctions\b/i, identity: 'comply-with-anti-corruption-sanctions-laws' },
  { test: /\bcomply\b[\s\S]{0,60}\blaws?\b/i, identity: 'comply-with-applicable-laws' },
  { test: /existence in good standing/i, identity: 'maintain-corporate-existence-good-standing' },
  {
    test: /^(?![\s\S]*\b(?:business organizations?|relationships?\s+with)\b)[\s\S]*\b(?:franchis|permits?\b|licen[cs]es?\b|approvals?\b|authoriz)/i,
    identity: 'maintain-permits-franchises-authorizations',
  },
  { test: /\blease|\bpersonal property\b|good repair/i, identity: 'maintain-leases-material-property' },
  { test: /keep available the services|retain the services|retain [\s\S]{0,20}officers/i, identity: 'retain-officers-key-employees' },
  { test: /preserve|goodwill|business organization|business relationship|relationships?\s+with/i, identity: 'preserve-business-organization-relationships' },
  { test: /ordinary (?:and usual )?course/i, identity: 'conduct-business-in-ordinary-course' },
]);

function parseNestedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (typeof value.text !== 'string' || !value.text.trim().startsWith('{')) return value;
  try {
    const parsed = JSON.parse(value.text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...value, ...parsed }
      : value;
  } catch {
    return value;
  }
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  for (const key of ['text', 'label', 'value']) {
    const candidate = textValue(value[key]);
    if (candidate) return candidate;
  }
  return '';
}

function obligationText(value) {
  const item = parseNestedObject(value);
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return textValue(item.obligation) || textValue(item.text);
  }
  return textValue(item);
}

function fallbackIdentity(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160) || null;
}

function affirmativeObligationIdentity(value) {
  const text = obligationText(value);
  if (!text) return null;
  const rule = RULES.find((candidate) => candidate.test.test(text));
  return rule ? rule.identity : fallbackIdentity(text);
}

module.exports = {
  RULES,
  affirmativeObligationIdentity,
  obligationText,
  parseNestedObject,
};
