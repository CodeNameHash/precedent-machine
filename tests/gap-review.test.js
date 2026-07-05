const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeForMatch } = require('../lib/verification');
const {
  normalizeForGapDisplay,
  suggestGapType,
  buildGapDetails,
  gapPreviewFromSource,
} = require('../lib/gap-review');

test('normalizeForGapDisplay aligns offsets with normalizeForMatch while preserving case', () => {
  const source = '[[SECTION]] Section 5.04. “No Solicitation” — Company’s duty. [[/SECTION]]';
  const display = normalizeForGapDisplay(source);
  const matched = normalizeForMatch(source);
  assert.equal(display.length, matched.length);
  assert.match(display, /Section 5\.04/);
  assert.equal(matched, display.toLowerCase());
});

test('suggestGapType applies the first-pass rule order', () => {
  assert.equal(
    suggestGapType('Section 5.04 No Solicitation. Acquisition Proposal and Superior Proposal mechanics.').suggested_type,
    'NOSOL',
  );
  assert.equal(
    suggestGapType('The Company shall provide access and use reasonable best efforts before closing.').suggested_type,
    'COV',
  );
  assert.equal(
    suggestGapType('Section 9.07 Notices. All notices and other communications must be in writing.').suggested_type,
    'MISC',
  );
  assert.equal(
    suggestGapType('Exhibit A Form of Voting and Support Agreement.').suggested_type,
    'IGNORE/ANCILLARY',
  );
  assert.equal(
    suggestGapType('This stray paragraph has no reviewable anchor.').suggested_type,
    'UNKNOWN',
  );
});

test('NOSOL wins when a gap also contains covenant or misc anchors', () => {
  const suggestion = suggestGapType(
    'No Solicitation. The Company shall use reasonable best efforts to notify Parent of any Acquisition Proposal.',
  );
  assert.equal(suggestion.suggested_type, 'NOSOL');
  assert.equal(suggestion.anchor, 'No Solicitation');
});

test('buildGapDetails numbers document-order gaps with full text, contexts, heading, and adjacent provisions', () => {
  const source = [
    'Section 1.01 Intro. Parent will acquire the Company at the Effective Time.',
    'Section 5.04 No Solicitation. The Company shall not solicit any Acquisition Proposal and may respond only to a Superior Proposal.',
    'Section 9.02 Notices. All notices must be in writing and delivered to the parties listed below.',
  ].join(' ');
  const display = normalizeForGapDisplay(source);
  const gapStart = display.indexOf('Section 5.04');
  const gapLength = display.indexOf('Section 9.02') - gapStart;
  const coverage = { gaps: [{ start: gapStart, length: gapLength, preview: 'ignored' }] };
  const provisions = [
    {
      id: 'prov-intro',
      type: 'STRUCT',
      category: 'Intro',
      full_text: 'Section 1.01 Intro. Parent will acquire the Company at the Effective Time.',
    },
    {
      id: 'prov-notices',
      type: 'MISC',
      category: 'Notices',
      full_text: 'Section 9.02 Notices. All notices must be in writing and delivered to the parties listed below.',
    },
  ];

  const gaps = buildGapDetails({ coverage, sourceText: source, provisions, contextChars: 80 });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].id, 'G-001');
  assert.equal(gaps[0].start, gapStart);
  assert.equal(gaps[0].length, gapLength);
  assert.equal(gaps[0].text, gaps[0].full_text);
  assert.match(gaps[0].full_text, /No Solicitation/);
  assert.match(gaps[0].preview, /Acquisition Proposal/);
  assert.match(gaps[0].before_context, /Effective Time/);
  assert.match(gaps[0].after_context, /Notices/);
  assert.match(gaps[0].rough_heading, /Section 5\.04 No Solicitation/);
  assert.equal(gaps[0].suggested_type, 'NOSOL');
  assert.equal(gaps[0].adjacent_provisions.before.provision_id, 'prov-intro');
  assert.equal(gaps[0].adjacent_provisions.after.provision_id, 'prov-notices');
});

test('gapPreviewFromSource returns the display text slice, not the stored coverage snippet', () => {
  const source = 'Section 1.01 Intro. Some text. Section 8.01 Expenses. Each party pays its own expenses.';
  const display = normalizeForGapDisplay(source);
  const start = display.indexOf('Section 8.01');
  assert.equal(
    gapPreviewFromSource(source, { start, length: display.length - start }, 80),
    'Section 8.01 Expenses. Each party pays its own expenses.',
  );
});

test('/api/admin/gaps uses schema-backed candidate ordering fields', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/api/admin/gaps.js'), 'utf8');
  assert.match(source, /\.select\('id, ingested_deal_id, status, discovered_at'\)/);
  assert.match(source, /\.order\('discovered_at', \{ ascending: false \}\)/);
  assert.doesNotMatch(source, /\.select\('id, ingested_deal_id, status, updated_at'\)/);
});
