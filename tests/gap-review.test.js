const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeForMatch } = require('../lib/verification');
const {
  normalizeForGapDisplay,
  suggestGapType,
  locateProvisionIntervals,
  buildBoundaryAudit,
  buildGapDetails,
  buildUncodedSummary,
  buildUncodedDetails,
  classifyGapRegion,
  gapPreviewFromSource,
} = require('../lib/gap-review');
const { REGION_TYPES } = require('../lib/parser-v2/regions');

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

test('classifyGapRegion separates non-provision matter from reviewable body gaps', () => {
  assert.equal(
    classifyGapRegion('TABLE OF CONTENTS Section 5.03 No Solicitation 41 Section 6.01 Covenants 52'),
    REGION_TYPES.PREAMBLE_TOC,
  );
  assert.equal(
    classifyGapRegion([
      'ef20035469_ex2-1.htm EXHIBIT 2.1 AGREEMENT AND PLAN OF MERGER',
      'ARTICLE I The Merger SECTION 1.01. The Merger SECTION 1.02. Closing SECTION 1.03. Effective Time',
      'ARTICLE II Effect of the Merger SECTION 2.01. Effect on Capital Stock SECTION 2.02. Exchange Matters',
      'ARTICLE III Representations SECTION 3.01. Organization SECTION 3.02. Capitalization SECTION 3.03. Authority',
      'ARTICLE V Covenants SECTION 5.01. Conduct of Business SECTION 5.02. Solicitation SECTION 5.03. Efforts',
    ].join(' ')),
    REGION_TYPES.PREAMBLE_TOC,
  );
  assert.equal(
    classifyGapRegion('WHEREAS, the parties desire to enter into the Merger.'),
    REGION_TYPES.PREAMBLE_RECITALS,
  );
  assert.equal(
    classifyGapRegion('IN WITNESS WHEREOF, the parties have executed this Agreement. /s/ Parent'),
    REGION_TYPES.BACKMATTER_SIGNATURES,
  );
  assert.equal(
    classifyGapRegion('Section 5.03 No Solicitation. The Company shall not solicit Acquisition Proposals.'),
    REGION_TYPES.BODY_SECTION_UNASSIGNED,
  );
  assert.equal(
    classifyGapRegion('"Confidentiality Agreement" means the Confidentiality Agreement, dated as of June 1, 2020, between Parent and the Company.'),
    REGION_TYPES.BODY_SECTION_UNASSIGNED,
  );
});

test('buildGapDetails treats mid-recital slices under an article Recitals heading as frontmatter', () => {
  const source = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE I. RECITALS',
    'A. The Company Board has established a special committee to evaluate the Transactions.',
    'B. The Special Committee has unanimously determined that this Agreement and the Transactions are advisable, fair to and in the best interests of the Company and the stockholders.',
    'C. The Company Board approved execution and delivery of this Agreement.',
    'AGREEMENT NOW, THEREFORE, in consideration of the foregoing, the Parties agree as follows:',
    'ARTICLE I DEFINITIONS & INTERPRETATIONS',
    'Section 1.1 Certain Definitions. Affiliate means any Person controlled by another Person.',
  ].join(' ');
  const display = normalizeForGapDisplay(source);
  const gapStart = display.indexOf('best interests of the Company');
  const gapLength = display.indexOf('C. The Company Board') - gapStart;
  const details = buildGapDetails({
    coverage: { gaps: [{ start: gapStart, length: gapLength }] },
    sourceText: source,
    provisions: [],
  });

  assert.equal(details[0].region_type, REGION_TYPES.PREAMBLE_RECITALS);
  assert.equal(details[0].reviewable_gap, false);
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
      ai_metadata: { features: { mainConcept: 'Parent will acquire the Company.' } },
      full_text: 'Section 1.01 Intro. Parent will acquire the Company at the Effective Time.',
    },
    {
      id: 'prov-notices',
      type: 'MISC',
      category: 'Notices',
      ai_metadata: { features: { mainConcept: 'Notices must be delivered to listed parties.' } },
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
  assert.equal(gaps[0].region_type, REGION_TYPES.BODY_SECTION_UNASSIGNED);
  assert.equal(gaps[0].reviewable_gap, true);
  assert.equal(gaps[0].ignored_reason, null);
  assert.equal(gaps[0].adjacent_provisions.before.provision_id, 'prov-intro');
  assert.equal(gaps[0].adjacent_provisions.before.main_concept, 'Parent will acquire the Company.');
  assert.equal(gaps[0].adjacent_provisions.after.provision_id, 'prov-notices');
  assert.equal(gaps[0].adjacent_provisions.after.main_concept, 'Notices must be delivered to listed parties.');
});

test('buildGapDetails honours parser-supplied region type for definition annexes', () => {
  const source = 'ANNEX A Certain Definitions "Company Competing Proposal" means any proposal involving (a) assets and (b) equity.';
  const display = normalizeForGapDisplay(source);
  const [gap] = buildGapDetails({
    coverage: {
      gaps: [{
        start: 0,
        length: display.length,
        region_type: REGION_TYPES.BODY_SECTION_DEFINITION,
      }],
    },
    sourceText: source,
    provisions: [],
  });

  assert.equal(gap.region_type, REGION_TYPES.BODY_SECTION_DEFINITION);
  assert.equal(gap.reviewable_gap, false);
  assert.equal(gap.ignored_reason, 'Non-reviewable parser region.');
});

test('locateProvisionIntervals places duplicate parent-side text in the parent section', () => {
  const duplicate = '(f) Parent shall not waive any standstill provision unless the Parent Board determines that failure to do so would be inconsistent with its fiduciary duties. ';
  const source = [
    'Table of Contents 6.4 No Solicitation by Parent',
    '6.3 No Solicitation by the Company.',
    duplicate.repeat(3),
    '6.4 No Solicitation by Parent.',
    duplicate.repeat(3),
  ].join(' ');
  const [interval] = locateProvisionIntervals([{
    id: 'parent-nosol',
    type: 'NOSOL',
    category: 'Standstill Waiver',
    full_text: duplicate.repeat(3),
    ai_metadata: { features: { canonicalCode: 'NOSOL-STANDSTILL-WAIVER' } },
  }], source);

  const normSource = normalizeForMatch(source);
  const parentHeading = normSource.lastIndexOf('6.4 no solicitation by parent.');
  assert.ok(interval.start > parentHeading, `interval ${interval.start} should be after parent heading ${parentHeading}`);
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

test('buildUncodedDetails numbers non-canonical extracted provisions with full text', () => {
  const provisions = [
    {
      id: 'prov-canonical',
      type: 'REP-T',
      category: 'Organisation',
      ai_metadata: { features: { canonicalCode: 'REP-T-ORG' } },
      full_text: 'Section 3.01 Organisation. The Company is duly organised.',
    },
    {
      id: 'prov-proposed',
      type: 'NOSOL',
      category: '[PROPOSED] Go-Shop',
      ai_metadata: {
        startChar: 298438,
        regionType: REGION_TYPES.BODY_SECTION_DEFINITION,
        features: {
          canonicalCode: '[PROPOSED] NOSOL-GOSHOP',
          sectionNumber: 'Annex-A',
          mainConcept: { value: 'Company may run a 30-day go-shop.', quotes: ['go-shop quote'] },
        },
      },
      full_text: 'Section 5.03 Go-Shop. The Company may solicit Acquisition Proposals for 30 days.',
    },
    {
      id: 'prov-missing',
      type: 'COV',
      category: 'Ordinary Course',
      ai_metadata: { features: {} },
      full_text: 'Section 4.01 Conduct of Business. The Company shall operate in the ordinary course.',
    },
    {
      id: 'prov-freeform',
      type: 'MISC',
      category: 'Bespoke Notice Mechanics',
      ai_metadata: { features: { canonicalCode: 'MISC-BESPOKE-NOTICES' } },
      full_text: 'Section 9.02 Bespoke Notice Mechanics. Notices must include a deal code.',
    },
  ];

  const summary = buildUncodedSummary(provisions);
  assert.deepEqual(summary, {
    count: 3,
    proposed_count: 1,
    by_type: { NOSOL: 1, COV: 1, MISC: 1 },
  });

  const uncoded = buildUncodedDetails(provisions);

  assert.equal(uncoded.length, 3);
  assert.deepEqual(uncoded.map((item) => item.id), ['U-001', 'U-002', 'U-003']);
  assert.equal(uncoded[0].provision_id, 'prov-proposed');
  assert.equal(uncoded[0].proposed, true);
  assert.equal(uncoded[0].code, '[PROPOSED] NOSOL-GOSHOP');
  assert.equal(uncoded[0].section_number, 'Annex-A');
  assert.equal(uncoded[0].start_char, 298438);
  assert.equal(uncoded[0].region_type, REGION_TYPES.BODY_SECTION_DEFINITION);
  assert.equal(uncoded[0].main_concept, 'Company may run a 30-day go-shop.');
  assert.match(uncoded[0].full_text, /Go-Shop/);
  assert.equal(uncoded[1].code, null);
  assert.match(uncoded[1].suggested_reason, /No canonical code/);
  assert.equal(uncoded[2].family_type, 'MISC');
  assert.match(uncoded[2].suggested_reason, /not in the canonical rubric/);
});

test('buildBoundaryAudit exposes provision spans, reviewable gaps, and unlocated rows', () => {
  const source = [
    'Section 1.01 Intro. Parent will acquire the Company.',
    'Section 2.01 Tender Offer. Parent shall commence the Offer and',
    'Section 5.04 No Solicitation. The Company shall not solicit Acquisition Proposals.',
  ].join(' ');
  const display = normalizeForGapDisplay(source);
  const gapStart = display.indexOf('Section 5.04');
  const provisions = [
    {
      id: 'prov-intro',
      type: 'STRUCT',
      category: 'Intro',
      ai_metadata: { features: { canonicalCode: 'STRUCT-MERGER' } },
      full_text: 'Section 1.01 Intro. Parent will acquire the Company.',
    },
    {
      id: 'prov-offer',
      type: 'STRUCT',
      category: 'Tender Offer',
      ai_metadata: { features: { canonicalCode: 'STRUCT-TENDER' } },
      full_text: 'Section 2.01 Tender Offer. Parent shall commence the Offer and',
    },
    {
      id: 'prov-unlocated',
      type: 'COV',
      category: 'Missing Covenant',
      ai_metadata: { features: { canonicalCode: 'COV-ORDINARY-COURSE' } },
      full_text: 'Section 6.01 Missing Covenant. The Company shall operate in the ordinary course.',
    },
  ];

  const audit = buildBoundaryAudit({
    coverage: { gaps: [{ start: gapStart, length: display.length - gapStart }] },
    sourceText: source,
    provisions,
  });

  assert.equal(audit.summary.provisions_located, 2);
  assert.equal(audit.summary.provisions_unlocated, 1);
  assert.equal(audit.summary.reviewable_gaps, 1);
  assert.equal(audit.items[0].id, 'P-001');
  assert.equal(audit.items[0].provision_id, 'prov-intro');
  assert.match(audit.items[0].full_text, /Parent will acquire the Company/);
  assert.equal(audit.items[1].provision_id, 'prov-offer');
  assert.match(audit.items[1].tail_preview, /Offer and$/);
  assert.equal(audit.items[1].text, audit.items[1].full_text);
  assert.equal(audit.items[1].flags[0].code, 'odd_end_word');
  assert.equal(audit.items[2].id, 'G-001');
  assert.equal(audit.items[2].reviewable_gap, true);
  assert.match(audit.items[2].full_text, /No Solicitation/);
  assert.equal(audit.unlocated[0].provision_id, 'prov-unlocated');
  assert.match(audit.unlocated[0].full_text, /Missing Covenant/);
  assert.equal(audit.unlocated[0].flags[0].code, 'unlocated');
});

test('buildBoundaryAudit does not warn on same-family contained spans', () => {
  const source = 'Section 6.01 Interim Covenants. The Company shall not: (a) issue stock without Parent consent; (b) incur debt without Parent consent.';
  const audit = buildBoundaryAudit({
    coverage: { gaps: [] },
    sourceText: source,
    provisions: [
      {
        id: 'ioc-preamble',
        type: 'IOC-T',
        category: 'Interim Covenants Preamble',
        ai_metadata: { features: { canonicalCode: 'IOC-T-PREAMBLE' } },
        full_text: source,
      },
      {
        id: 'ioc-issue-stock',
        type: 'IOC-T',
        category: 'Issuance of Securities',
        ai_metadata: { features: { canonicalCode: 'IOC-T-ISSUANCE' } },
        full_text: '(a) issue stock without Parent consent;',
      },
    ],
  });

  const child = audit.items.find((item) => item.provision_id === 'ioc-issue-stock');
  assert.ok(child);
  assert.equal(child.flags.some((flag) => flag.code === 'overlap'), false);
});

test('buildBoundaryAudit flags a broad different-family parent once instead of every child', () => {
  const source = 'Section 6.01 Covenants. The Company shall not: (a) issue stock without Parent consent; (b) incur debt without Parent consent.';
  const audit = buildBoundaryAudit({
    coverage: { gaps: [] },
    sourceText: source,
    provisions: [
      {
        id: 'broad-other',
        type: 'OTHER',
        category: 'Covenants',
        ai_metadata: { features: { canonicalCode: 'OTHER-GENERAL' } },
        full_text: source,
      },
      {
        id: 'ioc-issue-stock',
        type: 'IOC-T',
        category: 'Issuance of Securities',
        ai_metadata: { features: { canonicalCode: 'IOC-T-ISSUANCE' } },
        full_text: '(a) issue stock without Parent consent;',
      },
      {
        id: 'ioc-debt',
        type: 'IOC-T',
        category: 'Debt',
        ai_metadata: { features: { canonicalCode: 'IOC-T-DEBT' } },
        full_text: '(b) incur debt without Parent consent.',
      },
    ],
  });

  const parent = audit.items.find((item) => item.provision_id === 'broad-other');
  const children = audit.items.filter((item) => String(item.provision_id || '').startsWith('ioc-'));
  assert.equal(parent.flags.some((flag) => flag.code === 'contains_nested_spans'), true);
  assert.equal(children.some((item) => item.flags.some((flag) => flag.code === 'overlap')), false);
});

test('/api/admin/gaps uses schema-backed candidate ordering fields', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages/api/admin/gaps.js'), 'utf8');
  assert.match(source, /\.select\('id, ingested_deal_id, status, discovered_at'\)/);
  assert.match(source, /\.order\('discovered_at', \{ ascending: false \}\)/);
  assert.doesNotMatch(source, /\.select\('id, ingested_deal_id, status, updated_at'\)/);
});

test('/api/admin/gaps summary uses context-aware gap region classification', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'deal-quality-metrics.js'), 'utf8');
  assert.match(source, /classifyGapRegionWithContext/);
  assert.match(source, /normalizeForGapDisplay\(sourceText\)/);
  assert.doesNotMatch(source, /classifyGapRegion\(gapTextFromSource\(sourceText, gap\)\)/);
});
