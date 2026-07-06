const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const {
  attachRegionIdsToSections,
  regionKey,
  regionKeyForSection,
  regionTextHash,
  rowsForParserRegions,
} = require('../lib/parser-v2/region-store');
const { sectionsForExtractFromSnapshot, toCompactSections } = require('../lib/parser-v2/snapshot');
const { matchSnapshotToParsed } = require('../scripts/backfill-parser-regions');
const { backfillSectionLeftovers } = require('../lib/parser-v2/extract');

test('classified snapshot carries parser region identity through round-trip', () => {
  const cleaned = cleanText(`
AGREEMENT AND PLAN OF MERGER

NOW, THEREFORE, the parties agree as follows:

ARTICLE II
MERGER

SECTION 2.03. Treatment of Company Equity Awards. (a) Each Company Stock Option shall be cancelled. (b) Each Company Restricted Stock Award shall vest in full.
`);
  const parsed = parseStructure(cleaned);
  const section = parsed.sections.find((s) => s.number === '2.03');
  const region = parsed.regions.find((r) => r.source === 'section' && r.sectionNumber === '2.03');
  assert.ok(section);
  assert.ok(region);
  assert.equal(regionKeyForSection(section), regionKey(region));
  const persistedRows = rowsForParserRegions('deal-1', cleaned, parsed.regions, parsed.sections);
  assert.ok(persistedRows.some((row) => row.region_key === regionKeyForSection(section)));

  const regionId = '00000000-0000-0000-0000-000000000123';
  const [withRegion] = attachRegionIdsToSections([{ ...section, provision_type: 'CONSID' }], [
    { id: regionId, region_key: regionKey(region) },
  ]);
  assert.equal(withRegion.regionId, regionId);

  const [compact] = toCompactSections([withRegion]);
  assert.equal(compact.regionId, regionId);
  assert.equal(compact.regionType, section.regionType);
  assert.equal(typeof compact.endChar, 'number');

  const [roundTrip] = sectionsForExtractFromSnapshot([compact]);
  assert.equal(roundTrip.regionId, regionId);
  assert.equal(roundTrip.region_id, regionId);
  assert.equal(roundTrip.regionType, section.regionType);
  assert.equal(roundTrip.endChar, compact.endChar);
});

test('regionTextHash ignores whitespace-only differences', () => {
  assert.equal(regionTextHash('A   B\nC'), regionTextHash('a b c'));
});

test('backfill matcher realigns stale classified-section offsets by unique section number', () => {
  const [matched] = matchSnapshotToParsed([
    { sectionNumber: '2.03', startChar: 9999, type: 'CONSID', title: 'Treatment of Company Equity Awards' },
  ], [
    {
      number: '2.03',
      startChar: 154,
      endChar: 610,
      regionType: 'body.section.provision',
      title: 'Treatment of Company Equity Awards',
    },
  ]);

  assert.equal(matched.startChar, 154);
  assert.equal(matched.endChar, 610);
  assert.equal(matched.regionType, 'body.section.provision');
});

test('section-leftover backfill keeps uncovered slices on the source region', () => {
  const covered = 'The Company shall keep ordinary course operations consistent with past practice and preserve goodwill. ';
  const uncovered = 'Parent shall provide reasonable assistance for regulatory filings and timely responses to agency requests.';
  const sectionText = covered + uncovered;
  const provisions = [
    {
      type: 'COV',
      text: covered.trim(),
      startChar: 1000,
      regionId: 'region-1',
      features: { regionId: 'region-1' },
    },
    {
      type: 'COV',
      text: uncovered,
      startChar: 1000 + covered.length,
      regionId: 'region-2',
      features: { regionId: 'region-2' },
    },
  ];

  const report = backfillSectionLeftovers([
    {
      text: sectionText,
      startChar: 1000,
      sectionNumber: '5.01',
      title: 'Covenants',
      provision_type: 'COV',
      regionId: 'region-1',
      regionKey: 'body.section.provision:5.01:1000',
      regionType: 'body.section.provision',
    },
  ], provisions);

  assert.equal(report.leftovers_emitted, 1);
  const leftover = provisions.find((p) => p.type === 'SECTION-LEFTOVER');
  assert.ok(leftover);
  assert.equal(leftover.regionId, 'region-1');
  assert.equal(leftover.region_id, 'region-1');
  assert.equal(leftover.features.regionId, 'region-1');
  assert.match(leftover.text, /regulatory filings/);
});
