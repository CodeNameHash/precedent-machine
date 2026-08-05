const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyResolution, selectedEntries, resolveDecidedBy } = require('../../lib/schema-shape/reconcile-decide');
const { bumpVersion, BASE_VERSION } = require('../../lib/schema-shape/registry-version');
const { checkVersionPins } = require('../../scripts/schema-shape/version-pin-check');

// WP-4 delta (docs/archive/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md §5,
// "WP-4 (M4-01) — Reconciliation log: delta only"): decided_by actor,
// claim_ids[] linkage, and the normalized-v1.json `_meta.version` bump.
// These tests exercise the pure applyResolution() function against small
// fixtures — no filesystem/network writes, no production DB access.

function fixtureQueue() {
  return {
    schema_version: 1,
    entries: [
      { id: 'q1', field_key: 'goShopPresent', raw_value: 'YES', deal_id: 'deal-a', status: 'NEW' },
      { id: 'q2', field_key: 'goShopPresent', raw_value: 'YES', deal_id: 'deal-b', status: 'NEW' },
    ],
  };
}

function fixtureNormalized(metaVersion) {
  return {
    version: 'v1.0.0',
    _meta: metaVersion ? { stored_value_shape: 'triples-v1', version: metaVersion } : { stored_value_shape: 'triples-v1' },
    triples: [
      { id: 't1', deal_id: 'deal-a', field_key: 'goShopPresent', raw_value: 'YES', canonicalKey: null },
      { id: 't2', deal_id: 'deal-b', field_key: 'goShopPresent', raw_value: 'YES', canonicalKey: null },
      { id: 't3', deal_id: 'deal-c', field_key: 'goShopPresent', raw_value: 'NO', canonicalKey: null },
    ],
  };
}

test('WP4: registry-version bumpVersion increments and defaults', () => {
  assert.equal(bumpVersion(undefined), BASE_VERSION);
  assert.equal(bumpVersion(null), BASE_VERSION);
  assert.equal(bumpVersion('garbage'), BASE_VERSION);
  assert.equal(bumpVersion('normalized-v1.0'), 'normalized-v1.1');
  assert.equal(bumpVersion('normalized-v1.1'), 'normalized-v1.2');
  assert.equal(bumpVersion('normalized-v1.9'), 'normalized-v1.10');
});

test('WP4: resolveDecidedBy prefers an approved editor key over free-text decided_by', () => {
  const env = 'ben:sekrit1';
  assert.equal(resolveDecidedBy({ decided_by: 'someone else' }, 'sekrit1', env), 'ben');
});

test('WP4: resolveDecidedBy falls back to body.decided_by when no valid key, then "unknown"', () => {
  assert.equal(resolveDecidedBy({ decided_by: 'alex' }, undefined), 'alex');
  assert.equal(resolveDecidedBy({ decided_by: '  ' }, undefined), 'unknown');
  assert.equal(resolveDecidedBy({}, undefined), 'unknown');
});

test('WP4: a local reconcile decision produces an event with actor + claim_ids + version bump', () => {
  const queue = fixtureQueue();
  const normalized = fixtureNormalized(BASE_VERSION);
  const body = {
    field_key: 'goShopPresent',
    raw_value: 'YES',
    action: 'MERGE',
    targetCanonicalKey: 'GO_SHOP',
    rationale: 'Standardizing on GO_SHOP for affirmative go-shop language.',
  };
  const decidedBy = resolveDecidedBy(body, undefined, 'ben:sekrit1'); // no header sent -> falls back
  const result = applyResolution(queue, normalized, body, '2026-07-19T00:00:00.000Z', decidedBy);

  assert.equal(result.error, undefined);
  assert.equal(result.logRow.decided_by, 'unknown');
  assert.deepEqual(result.logRow.claim_ids.sort(), ['t1', 't2']);
  assert.equal(result.logRow.registry_version, 'normalized-v1.1');
  assert.equal(result.nextNormalized._meta.version, 'normalized-v1.1');
  // Original untouched.
  assert.equal(normalized._meta.version, BASE_VERSION);
  // Canonical key applied only to the matched triples.
  const t1 = result.nextNormalized.triples.find((t) => t.id === 't1');
  const t3 = result.nextNormalized.triples.find((t) => t.id === 't3');
  assert.equal(t1.canonicalKey, 'GO_SHOP');
  assert.equal(t3.canonicalKey, null);
  // Queue entries record the same actor.
  for (const entry of result.entries) {
    assert.equal(entry.resolution.decided_by, 'unknown');
  }
});

test('WP4: a decision with an approved editor key records the resolved name', () => {
  const queue = fixtureQueue();
  const normalized = fixtureNormalized(BASE_VERSION);
  const body = {
    field_key: 'goShopPresent',
    raw_value: 'YES',
    action: 'FREEFORM',
    rationale: 'Marking for manual follow-up.',
  };
  const decidedBy = resolveDecidedBy(body, 'sekrit1', 'ben:sekrit1');
  const result = applyResolution(queue, normalized, body, '2026-07-19T00:00:00.000Z', decidedBy);
  assert.equal(result.logRow.decided_by, 'ben');
  // FREEFORM has no targetCanonicalKey but claim linkage is still recorded.
  assert.deepEqual(result.logRow.claim_ids.sort(), ['t1', 't2']);
  assert.equal(result.logRow.registry_version, 'normalized-v1.1');
});

test('WP4: repeated decisions keep bumping the version (dry local exercise, tmp files only)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-decide-'));
  const normalizedPath = path.join(dir, 'normalized-v1.json');
  fs.writeFileSync(normalizedPath, JSON.stringify(fixtureNormalized(BASE_VERSION), null, 2));

  let normalized = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
  const queue = fixtureQueue();
  const body = {
    field_key: 'goShopPresent',
    raw_value: 'YES',
    action: 'PROMOTE',
    targetCanonicalKey: 'GO_SHOP',
    rationale: 'Promote to canonical.',
  };

  const first = applyResolution(queue, normalized, body, '2026-07-19T00:00:00.000Z', 'ben');
  fs.writeFileSync(normalizedPath, JSON.stringify(first.nextNormalized, null, 2));
  normalized = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
  assert.equal(normalized._meta.version, 'normalized-v1.1');

  // Re-select the same field/raw_value pair (still NEW/unresolved in the
  // fresh queue clone) to prove a second local decision bumps again.
  const second = applyResolution(fixtureQueue(), normalized, body, '2026-07-19T01:00:00.000Z', 'ben');
  assert.equal(second.nextNormalized._meta.version, 'normalized-v1.2');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('WP4: existing normalized-v1.json readers tolerate the new _meta.version key', () => {
  assert.deepEqual(checkVersionPins(), { ok: true, failures: [] });
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  assert.equal(normalized._meta.version, BASE_VERSION);
  assert.equal(normalized._meta.stored_value_shape, 'triples-v1'); // untouched sibling key
});

test('WP4: pre-existing reconciliation-log.jsonl rows (no decided_by/claim_ids) still parse', () => {
  const lines = fs.readFileSync('docs/schema-shape/reconciliation-log.jsonl', 'utf8').trim().split('\n').filter(Boolean);
  assert.ok(lines.length > 0, 'expected at least one existing log row');
  for (const line of lines) {
    const row = JSON.parse(line); // must not throw — proves additive schema
    assert.equal(typeof row, 'object');
    // Old rows (both the decide.js shape and the earlier phase-0
    // decision_id shape already mixed into this file) are
    // additive-schema-compatible: decided_by/claim_ids are simply absent on
    // pre-WP-4 rows, never malformed.
    if ('decided_by' in row) assert.equal(typeof row.decided_by, 'string');
    if ('claim_ids' in row) assert.ok(Array.isArray(row.claim_ids));
  }
});

test('WP4: selectedEntries still resolves by field_key + raw_value (unchanged shared helper)', () => {
  const queue = fixtureQueue();
  const entries = selectedEntries(queue.entries, { field_key: 'goShopPresent', raw_value: 'YES' });
  assert.equal(entries.length, 2);
});
