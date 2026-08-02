'use strict';

/**
 * tests/export-v1-provision-snapshot.test.js
 *
 * Unit tests for scripts/export-v1-provision-snapshot.mjs's PURE functions
 * (parseArgs, buildSnapshotSql, buildSnapshotForDeal) -- zero DB, zero
 * network. The one thing this file exists to prove above everything else:
 * the script REFUSES TO RUN without an explicit --deal allowlist (spec
 * Acceptance), checked before any I/O.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;

test.before(async () => {
  mod = await import(path.join('..', 'scripts', 'export-v1-provision-snapshot.mjs'));
});

test('parseArgs refuses to run without at least one --deal allowlist entry', () => {
  assert.throws(() => mod.parseArgs([]), /Refusing to run.*--deal/);
  assert.throws(() => mod.parseArgs(['--provision-type', 'REPRESENTATION']), /Refusing to run.*--deal/);
});

test('parseArgs requires --deal to be a UUID, not a target-name substring (explicit allowlist, no fuzzy resolution)', () => {
  assert.throws(() => mod.parseArgs(['--deal', 'topbuild']), /must be a UUID/);
  assert.doesNotThrow(() => mod.parseArgs(['--deal', '7dc3a05f-b170-4d59-a255-b7103cca16e1']));
});

test('parseArgs accepts multiple --deal entries and --governed-deal-key pairs', () => {
  const args = mod.parseArgs([
    '--deal', '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    '--deal', '11111111-2222-3333-4444-555555555555',
    '--governed-deal-key', '7dc3a05f-b170-4d59-a255-b7103cca16e1=deal:test:abc',
  ]);
  assert.deepEqual(args.deals, ['7dc3a05f-b170-4d59-a255-b7103cca16e1', '11111111-2222-3333-4444-555555555555']);
  assert.equal(args.governedDealKeys.get('7dc3a05f-b170-4d59-a255-b7103cca16e1'), 'deal:test:abc');
  assert.equal(args.provisionType, 'REPRESENTATION');
});

test('parseArgs rejects --out combined with more than one --deal', () => {
  assert.throws(() => mod.parseArgs([
    '--deal', '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    '--deal', '11111111-2222-3333-4444-555555555555',
    '--out', 'x.json',
  ]), /--out-dir/);
});

test('buildSnapshotSql is a SELECT-only statement over provision_cards, parameterised on deal_id allowlist + provision_type', () => {
  const { text, values } = mod.buildSnapshotSql({ dealIds: ['a', 'b'], provisionType: 'REPRESENTATION' });
  assert.match(text, /^SELECT/i);
  assert.match(text, /FROM public\.provision_cards/);
  assert.match(text, /WHERE deal_id = ANY\(\$1/);
  assert.deepEqual(values, [['a', 'b'], 'REPRESENTATION']);
  mod.assertReadOnlySql(text); // does not throw
});

test('assertReadOnlySql rejects any write-verb statement', () => {
  assert.throws(() => mod.assertReadOnlySql('DELETE FROM provision_cards'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('UPDATE provision_cards SET x = 1'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('INSERT INTO provision_cards VALUES (1)'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('DROP TABLE provision_cards'), /read-only/);
  assert.doesNotThrow(() => mod.assertReadOnlySql('SELECT * FROM provision_cards'));
});

test('maxExtractionVersion picks the lexicographically last label deterministically (opaque tag, not a numeric ordering)', () => {
  assert.equal(mod.maxExtractionVersion([
    { extraction_version: 'm2-00-corpus-backfill-v1' },
    { extraction_version: 'm2-00-corpus-backfill-v1' },
  ]), 'm2-00-corpus-backfill-v1');
  assert.equal(mod.maxExtractionVersion([
    { extraction_version: 'a' }, { extraction_version: 'z' }, { extraction_version: 'm' },
  ]), 'z');
  assert.equal(mod.maxExtractionVersion([]), null);
});

test('buildSnapshotForDeal produces a content-addressed V1_PROVISION_SNAPSHOT/V1 with the deal-identity bridge and per-deal max extraction_version', () => {
  const cards = [
    { id: 'card-2', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-ORG', section_ref: '3.1(a) | Org | x', primary_quote: 'q2', region_hash: 'h2', extraction_version: 'v1' },
    { id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap | x', primary_quote: 'q1', region_hash: 'h1', extraction_version: 'v1' },
  ];
  const snapshot = mod.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    deal: { acquirer: 'QXO, Inc.', target: 'TopBuild Corp.' },
    cards,
    governedDealKey: 'deal:test:abc',
  });
  assert.equal(snapshot.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(typeof snapshot.snapshot_id, 'string');
  assert.ok(snapshot.snapshot_id.length > 0);
  assert.deepEqual(snapshot.deal_identity_bridge, {
    production_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1', governed_deal_key: 'deal:test:abc',
  });
  assert.equal(snapshot.deal_max_extraction_version, 'v1');
  assert.equal(snapshot.cards.length, 2);
  // Cards are sorted by id, independent of input row order.
  assert.deepEqual(snapshot.cards.map((c) => c.id), ['card-1', 'card-2']);

  const again = mod.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    deal: { acquirer: 'QXO, Inc.', target: 'TopBuild Corp.' },
    cards: [...cards].reverse(),
    governedDealKey: 'deal:test:abc',
  });
  assert.equal(again.snapshot_id, snapshot.snapshot_id, 'content-addressed and row-order invariant');
});

test('buildSnapshotForDeal falls back to a labelled placeholder governed_deal_key when the caller supplies none', () => {
  const cards = [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap | x', primary_quote: 'q1', region_hash: 'h1', extraction_version: 'v1' }];
  const snapshot = mod.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1', deal: { acquirer: 'A', target: 'B' }, cards, governedDealKey: null,
  });
  assert.match(snapshot.deal_identity_bridge.governed_deal_key, /^deal:v1-snapshot-placeholder:7dc3a05f-b170-4d59-a255-b7103cca16e1$/);
});

test('buildSnapshotForDeal refuses a deal with zero cards rather than emitting an empty, misleading snapshot', () => {
  assert.throws(() => mod.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1', deal: { acquirer: 'A', target: 'B' }, cards: [], governedDealKey: 'k',
  }), /No provision_cards found/);
});
