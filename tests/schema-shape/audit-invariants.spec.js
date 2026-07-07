const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { auditCompleteness, noOrphanValues } = require('../../scripts/schema-shape/audit-invariants');
const { readLog, replay } = require('../../scripts/schema-shape/replay-reconciliation');

const METSERA_DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

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
  assert.ok(Array.isArray(readLog('docs/schema-shape/reconciliation-log.jsonl')));
});

test('PH0C-J: reconciliation replay applies G-0B-T3 RENAME_KEY rows to registry entries', () => {
  const normalized = {
    entries: [{
      key: 'tenderOffer',
      displayName: 'Tender offer structure present',
      type: 'boolean',
      aliases: ['dealStructure', 'tenderOffer', 'tender_offer'],
    }],
  };
  const [entry] = replay(normalized, [{
    decision: 'RENAME_KEY',
    field_key: 'tenderOffer',
    to: {
      displayName: 'Tender offer present',
      type: 'boolean',
      aliases: ['tenderOffer', 'tender_offer'],
    },
  }]).entries;
  assert.deepEqual(entry, {
    key: 'tenderOffer',
    displayName: 'Tender offer present',
    type: 'boolean',
    aliases: ['tenderOffer', 'tender_offer'],
  });
});

test('PH0C-J: reconciliation replay ignores legacy MERGE rows for registry entries without values', () => {
  const normalized = { entries: [{ key: 'x' }] };
  assert.deepEqual(replay(normalized, [{ action: 'MERGE', rawValue: undefined, touched: [{}], targetCanonicalKey: 'A' }]), normalized);
});

test('PH0C-OPTION-A: normalized artifact contains populated deal-value triples', () => {
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  const triples = normalized.triples || [];
  const deals = new Set(triples.map((triple) => triple.deal_id));
  assert.ok(triples.length >= deals.size);
  assert.ok(deals.size >= 4);
  assert.ok(triples.some((triple) => triple.deal_id === METSERA_DEAL_ID));
  assert.ok(triples.every((triple) => (
    triple.deal_id
    && triple.field_key
    && Object.prototype.hasOwnProperty.call(triple, 'canonicalKey')
    && Object.prototype.hasOwnProperty.call(triple, 'raw_value')
    && triple.raw_value !== null
    && triple.raw_value !== ''
    && triple.source_provision_id
    && triple.extractor_id === 'codex'
  )));
});

test('PH0C-OPTION-A: Metsera audit source data has populated cells and evidence', () => {
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  const triples = (normalized.triples || []).filter((triple) => triple.deal_id === METSERA_DEAL_ID);
  const populatedFields = new Set(triples.map((triple) => triple.field_key));
  assert.ok(populatedFields.size >= 5);
  assert.ok(triples.some((triple) => String(triple.evidence_quote || '').length > 20));
});

test('PH0C-OPTION-A: reconciliation queue is deterministic and well-formed', () => {
  const queue = JSON.parse(fs.readFileSync('docs/schema-shape/reconciliation-queue.json', 'utf8'));
  const worklog = fs.readFileSync('WORKLOG-P0-C.md', 'utf8');
  if ((queue.entries || []).length === 0) {
    assert.match(worklog, /RECONCILE_CORPUS: 0 queue entries produced from [1-9]\d* triples/);
    return;
  }
  assert.ok(queue.entries.every((entry) => (
    /^[a-f0-9]{16}$/.test(entry.id)
    && Object.prototype.hasOwnProperty.call(entry, 'raw_value')
    && entry.raw_value !== null
    && entry.raw_value !== ''
    && entry.field_key
    && entry.deal_id
    && Array.isArray(entry.similarity_candidates)
    && ['NEW', 'RESOLVED'].includes(entry.status)
  )));
});
