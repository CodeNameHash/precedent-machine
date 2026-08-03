'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;
test.before(async () => { mod = await import(path.join('..', 'scripts', 'export-m3-family-source-pack.mjs')); });

test('M3 source exporter is exact-family, paginated and SELECT-only', () => {
  assert.throws(() => mod.parseArgs([]), /--family/);
  assert.throws(() => mod.parseArgs(['--family', 'general-covenants']), /--out or --stdout/);
  const args = mod.parseArgs(['--family', 'general-covenants', '--stdout']);
  assert.equal(args.codes.length, 18);
  const sql = mod.buildSourcePackSql({ codes: args.codes, family: 'general-covenants' });
  assert.match(sql.text, /^SELECT/i);
  assert.match(sql.text, /provision_subtype = ANY/);
  assert.match(sql.text, /primary_quote ILIKE/);
  assert.doesNotThrow(() => mod.assertReadOnlySql(sql.text));
  assert.throws(() => mod.assertReadOnlySql('UPDATE provision_cards SET primary_quote = x'), /SELECT-only/);
});

test('M3 source packs preserve literal quote hashes and explicitly retain unsupported coverage', () => {
  const codes = mod.FAMILY_CODES['general-covenants'];
  const pack = mod.buildSourcePack({
    family: 'general-covenants', codes,
    cards: [{ id: 'card-1', deal_id: 'deal-1', provision_type: 'COVENANT_OTHER', provision_subtype: 'COV-ACCESS', section_ref: '6.11', primary_quote: 'The Company shall provide Parent access to books and records.', region_hash: 'region', extraction_version: 'v1' }],
    deals: [{ id: 'deal-1', acquirer: 'Parent', target: 'Company' }],
  });
  assert.equal(mod.verifySourcePack(pack), true);
  assert.equal(pack.coverage.find((row) => row.code === 'COV-ACCESS').disposition, 'GROUNDED');
  assert.equal(pack.coverage.find((row) => row.code === 'COV-SECREPORT').disposition, 'NO_GROUNDED_PRODUCTION_EVIDENCE');
  const altered = structuredClone(pack);
  altered.sources[0].primary_quote = 'altered';
  assert.throws(() => mod.verifySourcePack(altered), /Quote hash mismatch/);
});

test('legacy COV-LIST cards carrying literal post-closing SEC-report text are routed to COV-SECREPORT, not discarded', () => {
  const pack = mod.buildSourcePack({
    family: 'general-covenants', codes: mod.FAMILY_CODES['general-covenants'],
    cards: [{ id: 'legacy-card', deal_id: 'deal-1', provision_type: 'COVENANT_OTHER', provision_subtype: 'COV-LIST', section_ref: '6.12', primary_quote: 'The Company shall deliver Post-Closing SEC Reports to Parent.', region_hash: 'region', extraction_version: 'v1' }],
    deals: [{ id: 'deal-1', acquirer: 'Parent', target: 'Company' }],
  });
  assert.equal(pack.sources[0].provision_subtype, 'COV-LIST');
  assert.equal(pack.sources[0].routed_code, 'COV-SECREPORT');
  assert.equal(pack.coverage.find((row) => row.code === 'COV-SECREPORT').disposition, 'GROUNDED');
  assert.equal(mod.verifySourcePack(pack), true);
});
