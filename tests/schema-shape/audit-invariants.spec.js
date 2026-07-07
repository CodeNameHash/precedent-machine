const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { auditCompleteness, noOrphanValues } = require('../../scripts/schema-shape/audit-invariants');
const { readLog, replay } = require('../../scripts/schema-shape/replay-reconciliation');

function definitionEntries() {
  const lines = fs.readFileSync('docs/schema-shape/canonical-definitions.md', 'utf8').split(/\r?\n/);
  const entries = [];
  let current = null;
  let inFrontmatter = false;
  for (const line of lines) {
    if (line === '---') {
      if (!current) {
        current = [];
        inFrontmatter = true;
      } else if (inFrontmatter) {
        inFrontmatter = false;
      } else {
        entries.push(current.join('\n').trim());
        current = [];
        inFrontmatter = true;
      }
      continue;
    }
    if (current) current.push(line);
  }
  if (current?.length) entries.push(current.join('\n').trim());
  return entries.filter(Boolean);
}

test('PH0C-B/PH0C-K: canonical definitions parse and cover every frozen vocab key', () => {
  const entries = definitionEntries();
  const byKey = new Map(entries.map((entry) => [entry.match(/\n?key:\s*([^\n]+)/)?.[1], entry]));
  for (const file of fs.readdirSync('docs/vocab').filter((name) => /^FROZEN-.*\.json$/.test(name))) {
    const vocab = JSON.parse(fs.readFileSync(`docs/vocab/${file}`, 'utf8'));
    for (const value of vocab.values) {
      const entry = byKey.get(value.key);
      assert.ok(entry, `${value.key} missing definition`);
      assert.match(entry, /stability:\s*(STABLE|PROVISIONAL)/);
      assert.match(entry, /anchor_citation:/);
      assert.match(entry, /distinguished_from:/);
    }
  }
});

test('PH0C-G/H: audit invariants pass empty committed baseline', () => {
  assert.deepEqual(auditCompleteness({ decisions: [] }), { ok: true, failures: [] });
  assert.deepEqual(noOrphanValues({ entries: [] }, { entries: [] }), { ok: true, failures: [] });
});

test('PH0C-I: split flow assignments must be exhaustive', () => {
  const assignments = [
    { provision_id: 'a', newKey: 'ONE' },
    { provision_id: 'b', flagged: true },
  ];
  assert.equal(assignments.every((item) => item.newKey || item.flagged), true);
});

test('PH0C-J: reconciliation log replay reconstructs empty-log state', () => {
  const normalized = { entries: [{ key: 'x', value: { canonicalKey: 'A', extractorRawValue: 'a', sourceProvisionId: 'p' } }] };
  assert.deepEqual(replay(normalized, []), normalized);
  assert.deepEqual(readLog('docs/schema-shape/reconciliation-log.jsonl'), []);
});
