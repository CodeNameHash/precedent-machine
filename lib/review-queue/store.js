const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_QUEUE_DIR = path.join('docs', 'review-queue');
const VALID_KINDS = new Set(['canonical', 'destructive', 'unfreeze', 'clarify']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CHOICE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function repoRoot(options = {}) {
  return options.root || process.env.REVIEW_QUEUE_ROOT || process.cwd();
}

function queueDir(options = {}) {
  return options.queueDir || path.join(repoRoot(options), DEFAULT_QUEUE_DIR);
}

function handoffFile(options = {}) {
  return options.handoffFile || path.join(repoRoot(options), 'archive', 'HANDOFF.md');
}

function assertId(id) {
  if (!ID_PATTERN.test(String(id || ''))) {
    throw new Error(`Invalid review queue id: ${id || '(empty)'}`);
  }
}

function entryPath(id, options = {}) {
  assertId(id);
  return path.join(queueDir(options), `${id}.json`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function listEntryFiles(options = {}) {
  const dir = queueDir(options);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== 'schema.json')
    .sort()
    .map((file) => path.join(dir, file));
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new Error('evidence must be an array');
  for (const item of evidence) {
    if (!item || typeof item !== 'object') throw new Error('evidence entries must be objects');
    if (!String(item.label || '').trim()) throw new Error('evidence.label is required');
    if (!String(item.url || '').trim()) throw new Error('evidence.url is required');
  }
}

function validateChoices(choices) {
  if (!Array.isArray(choices) || choices.length === 0) throw new Error('choices must be a non-empty array');
  const seen = new Set();
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') throw new Error('choices entries must be objects');
    if (!CHOICE_KEY_PATTERN.test(String(choice.key || ''))) throw new Error(`Invalid choice key: ${choice.key || '(empty)'}`);
    if (seen.has(choice.key)) throw new Error(`Duplicate choice key: ${choice.key}`);
    seen.add(choice.key);
    if (!String(choice.label || '').trim()) throw new Error('choice.label is required');
    if (!String(choice.codex_action || '').trim()) throw new Error('choice.codex_action is required');
  }
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  assertId(entry.id);
  if (!VALID_KINDS.has(entry.kind)) throw new Error(`Invalid review queue kind: ${entry.kind || '(empty)'}`);
  if (!String(entry.title || '').trim()) throw new Error('title is required');
  if (!String(entry.summary || '').trim()) throw new Error('summary is required');
  if (Number.isNaN(Date.parse(entry.created_at))) throw new Error('created_at must be an ISO date');
  validateEvidence(entry.evidence);
  validateChoices(entry.choices);
  if (entry.resolution == null) {
    if (entry.resolved_at != null) throw new Error('resolved_at must be null when resolution is null');
    if (entry.resolved_by != null) throw new Error('resolved_by must be null when resolution is null');
  } else {
    if (!entry.resolution.choice_key) throw new Error('resolution.choice_key is required');
    if (Number.isNaN(Date.parse(entry.resolved_at))) throw new Error('resolved_at must be an ISO date when resolved');
    if (!String(entry.resolved_by || '').trim()) throw new Error('resolved_by is required when resolved');
  }
  return entry;
}

function readEntry(id, options = {}) {
  const file = entryPath(id, options);
  if (!fs.existsSync(file)) throw new Error(`Review queue entry not found: ${id}`);
  return validateEntry(readJson(file));
}

function writeEntry(entry, options = {}) {
  validateEntry(entry);
  writeJson(entryPath(entry.id, options), entry);
  return entry;
}

function listEntries(options = {}) {
  const includeResolved = Boolean(options.includeResolved);
  return listEntryFiles(options)
    .map((file) => validateEntry(readJson(file)))
    .filter((entry) => includeResolved || entry.resolution == null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.title.localeCompare(b.title));
}

function appendHandoffResolution(entry, options = {}) {
  const payload = {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    choice_key: entry.resolution.choice_key,
    codex_action: entry.resolution.codex_action,
    resolved_at: entry.resolved_at,
    resolved_by: entry.resolved_by,
  };
  const file = handoffFile(options);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `\nREVIEW_QUEUE_RESOLUTION ${JSON.stringify(payload)}\n`);
  return payload;
}

module.exports = {
  appendHandoffResolution,
  entryPath,
  handoffFile,
  listEntries,
  queueDir,
  readEntry,
  repoRoot,
  validateEntry,
  writeEntry,
};
