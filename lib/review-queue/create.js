const crypto = require('node:crypto');
const { writeEntry } = require('./store');

function defaultChoices() {
  return [
    { key: 'approve', label: 'Approve as proposed', codex_action: 'self-merge PR' },
    { key: 'reject', label: 'Reject', codex_action: 'close PR and comment with reason' },
    { key: 'modify', label: 'Approve with changes', codex_action: 'await Ben-authored diff, apply, self-merge' },
  ];
}

function createEntry(input = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const entry = {
    id: input.id || crypto.randomUUID(),
    created_at: input.created_at || now,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    evidence: input.evidence || [],
    choices: input.choices || defaultChoices(input),
    resolution: null,
    resolved_at: null,
    resolved_by: null,
  };
  return writeEntry(entry, options);
}

module.exports = { createEntry, defaultChoices };
