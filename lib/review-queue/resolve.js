const { appendHandoffResolution, readEntry, writeEntry } = require('./store');

function resolveEntry(id, input = {}, options = {}) {
  const entry = readEntry(id, options);
  if (entry.resolution != null) throw new Error(`Review queue entry is already resolved: ${id}`);
  const choiceKey = String(input.choice_key || input.choiceKey || input.choice || '').trim();
  const choice = entry.choices.find((item) => item.key === choiceKey);
  if (!choice) throw new Error(`Unknown review queue choice for ${id}: ${choiceKey || '(empty)'}`);
  const resolved = {
    ...entry,
    resolution: {
      choice_key: choice.key,
      label: choice.label,
      codex_action: choice.codex_action,
      note: input.note || '',
    },
    resolved_at: options.now || new Date().toISOString(),
    resolved_by: input.resolved_by || input.resolvedBy || 'ben',
  };
  writeEntry(resolved, options);
  const handoff = appendHandoffResolution(resolved, options);
  return { entry: resolved, handoff };
}

module.exports = { resolveEntry };
