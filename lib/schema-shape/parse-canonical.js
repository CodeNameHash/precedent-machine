const fs = require('fs');

function splitList(value) {
  if (!value || value === 'none detected') return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseValue(name, raw) {
  const value = raw.trim();
  if (name === 'aliases' || name === 'enumValues' || name === 'usedIn') {
    return splitList(value);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'none detected') return [];
  return value;
}

function parseCanonicalMarkdown(markdown) {
  const entries = [];
  let current = null;

  for (const line of String(markdown || '').split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      if (current) entries.push(current);
      current = { name: heading[1].trim() };
      continue;
    }

    if (!current) continue;
    const field = line.match(/^-\s+([^:]+):\s*(.*)$/);
    if (!field) continue;
    const name = field[1].trim();
    current[name] = parseValue(name, field[2]);
  }

  if (current) entries.push(current);
  return entries.map((entry) => ({
    ...entry,
    key: entry.key || entry.name,
  }));
}

function parseCanonicalFile(file) {
  return parseCanonicalMarkdown(fs.readFileSync(file, 'utf8'));
}

if (require.main === module) {
  const file = process.argv[2] || 'docs/schema-shape/canonical-registry-v1.md';
  process.stdout.write(`${JSON.stringify(parseCanonicalFile(file), null, 2)}\n`);
}

module.exports = {
  parseCanonicalFile,
  parseCanonicalMarkdown,
};
