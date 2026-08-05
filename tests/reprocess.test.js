/* Tests for the partial-reprocessing helpers:
   lib/parser-v2/snapshot.js (compact snapshot shape, prior-cache lookup,
   classification diff) and the pure planning helpers in scripts/reprocess.js.
   Also covers classifySections' prior-snapshot cache path (no AI call when
   the cache covers every non-deterministic section). */

const test = require('node:test');
const assert = require('node:assert');

const {
  normalizeSectionText,
  sectionTextHash,
  toCompactSections,
  sectionsForExtractFromSnapshot,
  buildPriorLookup,
  classifyBreakdown,
  diffClassifications,
} = require('../lib/parser-v2/snapshot');

const {
  parseTypesArg,
  snapshotSectionCounts,
  deterministicEstimate,
  countsForTypes,
  formatClassifyDiff,
  classifiedByTally,
  stripRiskConflicts,
  formatStripRiskError,
  formatRematerializeWarning,
  parseArgs,
  buildRematerializePlans,
  printRematerializePlans,
  runRematerializeApply,
  buildV1ReclassificationPinMap,
  applyV1ReclassificationPins,
  pinTextHash,
  resolveReclassificationCompact,
  isV1ExtractionTypeSet,
  assertV1FixtureScope,
  isV1TypeCompleteAfterClassification,
  hasPendingV1Classification,
  assertV1ApplyOrderNotBypassed,
} = require('../scripts/reprocess');

const { classifySections } = require('../lib/parser-v2/classify');

/* ── snapshot shape round-trip ───────────────────────────────────────────── */

test('toCompactSections accepts both provision_type and provisionType spellings', () => {
  const compact = toCompactSections([
    { provision_type: 'TERMF', text: 'a', startChar: 5, number: '8.03', title: 'Termination Fee' },
    { provisionType: 'ANTI', body: 'b', start: 9, sectionNumber: '6.03', heading: 'Efforts' },
  ]);
  assert.strictEqual(compact[0].type, 'TERMF');
  assert.strictEqual(compact[0].sectionNumber, '8.03');
  assert.strictEqual(compact[0].startChar, 5);
  assert.strictEqual(compact[1].type, 'ANTI');
  assert.strictEqual(compact[1].text, 'b');
  assert.strictEqual(compact[1].title, 'Efforts');
});

test('sectionsForExtractFromSnapshot round-trips the compact shape into extract input', () => {
  const compact = toCompactSections([{
    provision_type: 'TERMF', provisionCode: 'TERMF-RTF-ANTI', text: 'fee text',
    startChar: 100, number: '8.03', title: 'Termination Fee', articleType: 'TERMINATION',
  }]);
  const [s] = sectionsForExtractFromSnapshot(compact);
  assert.strictEqual(s.provision_type, 'TERMF');
  assert.strictEqual(s.provisionType, 'TERMF');
  assert.strictEqual(s.provisionCode, 'TERMF-RTF-ANTI');
  assert.strictEqual(s.text, 'fee text');
  assert.strictEqual(s.body, 'fee text');
  assert.strictEqual(s.startChar, 100);
  assert.strictEqual(s.start, 100);
  assert.strictEqual(s.number, '8.03');
  assert.strictEqual(s.heading, 'Termination Fee');
});

/* ── text normalization / hashing ────────────────────────────────────────── */

test('sectionTextHash is stable across display markers, «italics», and whitespace', () => {
  const raw = 'SECTION 5.07. Employee Matters. The Company shall provide benefits.';
  const display = '[[SECTION]]SECTION 5.07.[[/SECTION]]  «Employee Matters».\n\nThe  Company shall provide benefits.';
  assert.strictEqual(sectionTextHash(raw), sectionTextHash(display));
  assert.notStrictEqual(sectionTextHash(raw), sectionTextHash(raw + ' Amended.'));
  assert.strictEqual(normalizeSectionText('  A  B  '), 'a b');
});

/* ── prior lookup + classify cache ───────────────────────────────────────── */

const throwingClient = {
  messages: { create: async () => { throw new Error('AI must not be called'); } },
};

test('classifySections reuses the prior snapshot instead of calling the AI', async () => {
  const text = 'The Company shall maintain employee benefit plans for one year following closing.';
  const sections = [{ number: '5.07', title: 'Section 5.07. Employee Matters.', text, startChar: 0 }];
  const prior = buildPriorLookup([
    { type: 'COV', code: 'COV-EMPLOYEE', confidence: 'high', text },
  ]);
  const out = await classifySections(sections, [], throwingClient, { prior });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].provisionType, 'COV');
  assert.strictEqual(out[0].provisionCode, 'COV-EMPLOYEE');
  assert.strictEqual(out[0].classifiedBy, 'cache');
});

test('classifySections calls the AI for sections missing from the prior snapshot', async () => {
  const sections = [{ number: '5.07', title: 'Section 5.07. Employee Matters.', text: 'Brand new text never classified before.', startChar: 0 }];
  const prior = buildPriorLookup([
    { type: 'COV', code: null, confidence: 'high', text: 'Some other section entirely.' },
  ]);
  let aiCalled = false;
  const stubClient = {
    messages: {
      create: async () => {
        aiCalled = true;
        return { content: [{ text: '[{"index":0,"provisionType":"COV","confidence":"high","reasoning":"x"}]' }] };
      },
    },
  };
  const out = await classifySections(sections, [], stubClient, { prior });
  assert.strictEqual(aiCalled, true);
  assert.strictEqual(out[0].provisionType, 'COV');
  assert.strictEqual(out[0].classifiedBy, 'ai');
});

test('deterministic rules beat the cache — rule changes take effect immediately', async () => {
  const text = 'This Agreement shall be governed by the laws of Delaware.';
  const sections = [{ number: '9.05', title: 'Section 9.05. Governing Law.', text, startChar: 0 }];
  const prior = buildPriorLookup([{ type: 'COV', code: null, confidence: 'high', text }]);
  const out = await classifySections(sections, [], throwingClient, { prior });
  assert.strictEqual(out[0].provisionType, 'MISC'); // deterministic governing-law rule
  assert.strictEqual(out[0].classifiedBy, 'regex');
});

test('a bounded reclassification preserves unrelated cached types', async () => {
  const section = {
    number: '4.2',
    title: 'Interim Operations of Parent',
    text: 'Parent shall operate in the ordinary course before Closing.',
  };
  const prior = new Map([[
    sectionTextHash(section.text),
    { provisionType: 'IOC-T', provisionCode: null, confidence: 'high' },
  ]]);
  const out = await classifySections([section], [], throwingClient, {
    prior,
    rerunPriorCodes: new Set(['REP-T-CONSENT', 'REP-T-REGSTATUS']),
  });
  assert.equal(out[0].provisionType, 'IOC-T');
  assert.equal(out[0].classifiedBy, 'cache');
});

test('the reviewed v1 pin map rewrites only governed sections', () => {
  const pins = buildV1ReclassificationPinMap();
  assert.equal(pins.get('af4940e1|3.4').code, 'REP-T-STOCKAPPROVAL');
  assert.equal(pins.get('dfaa71fa|3.22').code, 'REP-T-40ACT');
  assert.equal(pins.get('df393645|3.22').code, 'OPEN_WORLD');

  const before = [
    { sectionNumber: '3.22', type: 'REP-T', title: 'Investment Company Act', text: 'fixture text', code: 'REP-T-REGSTATUS', classifiedBy: 'regex' },
    { sectionNumber: '5.1', type: 'COV', code: 'COV-ACCESS', classifiedBy: 'cache' },
  ];
  const pinsForTest = new Map([['dfaa71fa|3.22', {
    code: 'REP-T-40ACT', type: 'REP-T', title: 'Investment Company Act', textHash: pinTextHash('fixture text'),
  }]]);
  const after = applyV1ReclassificationPins('dfaa71fa-9723', before, pinsForTest);
  assert.equal(after[0].code, 'REP-T-40ACT');
  assert.equal(after[0].classifiedBy, 'v1-reclass-pin');
  assert.equal(after[1], before[1]);
});

test('v1 pin application fails closed on a changed target identity or duplicate section number', () => {
  const pin = new Map([['dfaa71fa|3.22', {
    code: 'REP-T-40ACT', type: 'REP-T', title: 'Investment Company Act', textHash: pinTextHash('expected text'),
  }]]);
  assert.throws(
    () => applyV1ReclassificationPins('dfaa71fa-9723', [{ sectionNumber: '3.22', type: 'REP-T', title: 'Investment Company Act', text: 'changed text' }], pin),
    /identity drift/,
  );
  assert.throws(
    () => applyV1ReclassificationPins('dfaa71fa-9723', [
      { sectionNumber: '3.22', type: 'REP-T', title: 'Investment Company Act', text: 'expected text' },
      { sectionNumber: '3.22', type: 'REP-T', title: 'Investment Company Act', text: 'expected text' },
    ], pin),
    /exactly one snapshot section/,
  );
});

test('only explicit v1 mode applies pins; ordinary classify-only uses the stored-text classifier', async () => {
  const before = [{ sectionNumber: '3.22', type: 'REP-T', title: 'Investment Company Act', text: 'fixture text' }];
  const pins = new Map([['dfaa71fa|3.22', {
    code: 'REP-T-40ACT', type: 'REP-T', title: 'Investment Company Act', textHash: pinTextHash('fixture text'),
  }]]);
  let classifierCalls = 0;
  const classify = async () => {
    classifierCalls += 1;
    return { compact: [{ ...before[0], code: 'ordinary-classify-result' }] };
  };
  const ordinary = await resolveReclassificationCompact({ deal: { id: 'dfaa71fa-9723' }, before, v1Reclass: false, classify, pins });
  assert.equal(classifierCalls, 1);
  assert.equal(ordinary[0].code, 'ordinary-classify-result');
  const v1 = await resolveReclassificationCompact({ deal: { id: 'dfaa71fa-9723' }, before, v1Reclass: true, classify, pins });
  assert.equal(classifierCalls, 1);
  assert.equal(v1[0].code, 'REP-T-40ACT');
});

test('v1 extraction mode accepts exactly REP-T, REP-B and MISC', () => {
  assert.equal(isV1ExtractionTypeSet(['REP-T', 'REP-B', 'MISC']), true);
  assert.equal(isV1ExtractionTypeSet(['REP-T', 'MISC']), false);
  assert.equal(isV1ExtractionTypeSet(['REP-T', 'REP-B', 'MISC', 'DEF']), false);
});

test('v1 fixture mode rejects corpus, broad, and non-fixture scopes but permits one approved UUID', () => {
  assert.throws(
    () => assertV1FixtureScope([], { v1Reclass: true, all: true }),
    /rejects --all/,
  );
  assert.throws(
    () => assertV1FixtureScope([{ id: '7dc3a05f-b170-4d59-a255-b7103cca16e1' }, { id: 'af4940e1-a645-437c-acfa-4a53e8d9f7ac' }], { v1Reclass: true, all: false }),
    /exactly one selected deal/,
  );
  assert.throws(
    () => assertV1FixtureScope([{ id: '00000000-0000-0000-0000-000000000000' }], { v1Reclass: true, all: false }),
    /only permits TopBuild, Skechers, or Modiv/,
  );
  assert.doesNotThrow(
    () => assertV1FixtureScope([{ id: 'dfaa71fa-9723-4794-825d-bd5024aa0b5d' }], { v1Reclass: true, all: false }),
  );
});

test('v1 resume skips only a successful type completed after classification', () => {
  const deal = {
    metadata: {
      v1_reclassification: { classified_at: '2026-08-03T07:00:00.000Z' },
      extract_status: {
        'REP-T': { status: 'done', completed_at: '2026-08-03T08:00:00.000Z' },
        'REP-B': { status: 'failed', completed_at: '2026-08-03T08:01:00.000Z' },
        MISC: { status: 'done', completed_at: '2026-08-03T06:59:59.000Z' },
      },
    },
  };
  assert.equal(isV1TypeCompleteAfterClassification(deal, 'REP-T'), true);
  assert.equal(isV1TypeCompleteAfterClassification(deal, 'REP-B'), false);
  assert.equal(isV1TypeCompleteAfterClassification(deal, 'MISC'), false);
});

test('a classified v1 snapshot remains pending until every card has the v1 extraction version', async () => {
  const deal = {
    id: 'fixture-deal',
    metadata: {
      v1_reclassification: {
        version: 'm2-01-reclass-v1',
        state: 'CLASSIFIED',
      },
    },
  };
  assert.equal(hasPendingV1Classification(deal), true);

  const sb = {
    from() {
      return {
        select() {
          return {
            eq(field) {
              assert.equal(field, 'deal_id');
              return {
                eq(versionField, version) {
                  assert.equal(versionField, 'extraction_version');
                  assert.equal(version, 'm2-01-reclass-v1');
                  return Promise.resolve({ count: 0, error: null });
                },
                then(resolve, reject) {
                  return Promise.resolve({ count: 300, error: null }).then(resolve, reject);
                },
              };
            },
          };
        },
      };
    },
  };
  await assert.rejects(
    () => assertV1ApplyOrderNotBypassed(sb, [deal], { apply: true, v1Reclass: false }),
    /apply order is incomplete/,
  );
  await assert.doesNotReject(
    () => assertV1ApplyOrderNotBypassed(sb, [deal], { apply: true, v1Reclass: true }),
  );
});

test('buildPriorLookup skips untyped rows and keeps first entry per hash', () => {
  const prior = buildPriorLookup([
    { type: null, text: 'abc' },
    { type: 'COV', code: 'X', text: 'same text' },
    { type: 'MISC', code: 'Y', text: 'same text' },
  ]);
  assert.strictEqual(prior.size, 1);
  assert.strictEqual(prior.get(sectionTextHash('same text')).provisionType, 'COV');
});

/* ── classification diff ─────────────────────────────────────────────────── */

test('diffClassifications reports type changes, code changes, adds, removes', () => {
  const before = [
    { sectionNumber: '6.03', title: 'Efforts', type: 'COV', code: null, text: 'efforts text' },
    { sectionNumber: '8.03', title: 'Termination Fee', type: 'TERMF', code: null, text: 'fee text' },
    { sectionNumber: '9.01', title: 'Old Section', type: 'MISC', code: null, text: 'gone' },
  ];
  const after = [
    { sectionNumber: '6.03', title: 'Efforts', type: 'ANTI', code: null, text: 'efforts text' },
    { sectionNumber: '8.03', title: 'Termination Fee', type: 'TERMF', code: 'TERMF-RTF-ANTI', text: 'fee text' },
    { sectionNumber: '9.02', title: 'New Section', type: 'MISC', code: null, text: 'fresh' },
  ];
  const diff = diffClassifications(before, after);
  assert.strictEqual(diff.changed.length, 2);
  const typeChange = diff.changed.find((c) => c.sectionNumber === '6.03');
  assert.strictEqual(typeChange.from, 'COV');
  assert.strictEqual(typeChange.to, 'ANTI');
  const codeChange = diff.changed.find((c) => c.sectionNumber === '8.03');
  assert.strictEqual(codeChange.toCode, 'TERMF-RTF-ANTI');
  assert.strictEqual(diff.removed.length, 1);
  assert.strictEqual(diff.removed[0].sectionNumber, '9.01');
  assert.strictEqual(diff.added.length, 1);
  assert.strictEqual(diff.added[0].sectionNumber, '9.02');
  assert.strictEqual(diff.unchanged, 0);
});

test('diffClassifications falls back to text-hash matching when offsets/numbers shift', () => {
  const before = [{ sectionNumber: null, title: 'Annex I', type: 'COND', code: null, text: 'offer conditions text', startChar: 100 }];
  const after = [{ sectionNumber: null, title: 'Annex I', type: 'COND', code: null, text: '[[SECTION]]offer conditions text[[/SECTION]]', startChar: 900 }];
  const diff = diffClassifications(before, after);
  assert.strictEqual(diff.unchanged, 1);
  assert.strictEqual(diff.added.length, 0);
  assert.strictEqual(diff.removed.length, 0);
});

test('formatClassifyDiff renders terse change lines', () => {
  const out = formatClassifyDiff({
    changed: [{ sectionNumber: '6.03', title: 'Efforts', from: 'COV', to: 'ANTI', fromCode: null, toCode: null }],
    added: [],
    removed: [],
    unchanged: 40,
  });
  assert.match(out, /~ §6\.03 Efforts: COV → ANTI/);
  assert.match(out, /= 40 unchanged/);
});

/* ── planning helpers ────────────────────────────────────────────────────── */

/* ── EXT-4 guard: stripRiskConflicts ──────────────────────────────────────── */

test('stripRiskConflicts: happy path (NOSOL/MISC/TERMF) has zero conflicts', () => {
  assert.deepStrictEqual(stripRiskConflicts(['NOSOL']), []);
  assert.deepStrictEqual(stripRiskConflicts(['MISC']), []);
  assert.deepStrictEqual(stripRiskConflicts(['TERMF']), []);
  assert.deepStrictEqual(stripRiskConflicts(['NOSOL', 'MISC', 'TERMF']), []);
});

test('stripRiskConflicts: REP per-type runs are safe after knowledge definitions are rejoined', () => {
  assert.deepStrictEqual(stripRiskConflicts(['REP-T']), []);
  assert.deepStrictEqual(stripRiskConflicts(['REP-B']), []);
  assert.deepStrictEqual(stripRiskConflicts(['REP-T', 'REP-B']), []);
});

test('stripRiskConflicts: COND (group-expanded to COND-M/COND-B/COND-S) flags citedProvisionNames', () => {
  const conflicts = stripRiskConflicts(['COND']);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].feature, 'citedProvisionNames');
  assert.deepStrictEqual(conflicts[0].types.sort(), ['COND', 'COND-B', 'COND-M', 'COND-S']);
});

test('stripRiskConflicts: a mixed request only flags the affected type', () => {
  const conflicts = stripRiskConflicts(['REP-T', 'NOSOL']);
  assert.deepStrictEqual(conflicts, []);
});

test('stripRiskConflicts: unrelated REP/COND-adjacent types are not flagged (DEF, REP-B untouched by COND request)', () => {
  assert.deepStrictEqual(stripRiskConflicts(['DEF']), []);
});

test('formatStripRiskError names the feature and the type, and mentions --allow-strip', () => {
  const msg = formatStripRiskError(stripRiskConflicts(['COND']));
  assert.match(msg, /citedProvisionNames/);
  assert.match(msg, /COND/);
  assert.match(msg, /--allow-strip/);
});

/* ── DATA-1: rematerialize-claims warning ─────────────────────────────────── */

test('formatRematerializeWarning names the exact rematerialize command with the reprocessed deal ids', () => {
  const msg = formatRematerializeWarning(['deal-a', 'deal-b']);
  assert.match(msg, /claims are NOT materialized/);
  assert.match(msg, /node scripts\/reprocess\/rematerialize-claims\.js --deal deal-a,deal-b --apply/);
});

test('formatRematerializeWarning handles a single deal id', () => {
  const msg = formatRematerializeWarning(['only-deal']);
  assert.match(msg, /--deal only-deal --apply/);
});

test('parseTypesArg splits, uppercases, dedupes, validates', () => {
  assert.deepStrictEqual(parseTypesArg('termf,anti'), ['TERMF', 'ANTI']);
  assert.deepStrictEqual(parseTypesArg(['TERMF', 'TERMF,COND']), ['TERMF', 'COND']);
  assert.throws(() => parseTypesArg('BOGUS'), /Unknown type "BOGUS"/);
});

test('snapshotSectionCounts expands type groups (TERMR covers party variants)', () => {
  const compact = [
    { type: 'TERMR' }, { type: 'TERMR-B' }, { type: 'TERMF' }, { type: 'COV' },
  ];
  assert.deepStrictEqual(snapshotSectionCounts(compact, ['TERMR', 'TERMF']), { TERMR: 2, TERMF: 1 });
});

test('countsForTypes sums group members out of a by-type breakdown', () => {
  const byType = { 'COND-M': 2, 'COND-B': 1, TERMF: 3, COV: 9 };
  assert.deepStrictEqual(countsForTypes(byType, ['COND', 'TERMF']), { COND: 3, TERMF: 3 });
});

test('deterministicEstimate counts rule-resolvable sections and unresolved rest', () => {
  const articles = [{ number: 'VII', title: 'CONDITIONS TO THE MERGER' }];
  const sections = [
    { number: '7.01', title: 'Section 7.01. Conditions to Obligations of Each Party.', text: 'The obligations of each party to effect the Merger…' },
    { number: '9.99', title: 'Section 9.99. Some Bespoke Provision.', text: 'Entirely novel text no rule matches.' },
  ];
  const est = deterministicEstimate(sections, articles);
  assert.strictEqual(est.total, 2);
  assert.strictEqual(est.unresolved, 1);
  assert.strictEqual((est.byType['COND-M'] || 0), 1);
});

test('classifyBreakdown and classifiedByTally count by field', () => {
  const compact = [
    { type: 'COV', classifiedBy: 'regex' },
    { type: 'COV', classifiedBy: 'cache' },
    { type: 'TERMF', classifiedBy: 'ai' },
  ];
  assert.deepStrictEqual(classifyBreakdown(compact), { COV: 2, TERMF: 1 });
  assert.deepStrictEqual(classifiedByTally(compact), { regex: 1, cache: 1, ai: 1 });
});

// ---------------------------------------------------------------------------
// Regression: --classify-only dry-run purity. classifyFromStoredText used to
// call persistParserRegions (a real parser_regions upsert) unconditionally,
// so `reprocess.js --classify-only` WITHOUT --apply wrote to the DB while
// printing "dry-run: no writes". Found by the P8 coverage investigation,
// 2026-07-15. persistRegions:false must never touch the supabase client.
// ---------------------------------------------------------------------------

const { classifyFromStoredText } = require('../scripts/reprocess');

const DRYRUN_FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.'.repeat(3);

function dryrunDealFixture() {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER, dated as of July 30, 2018 (this "Agreement"), among EXAMPLE PARENT INC. and EXAMPLE TARGET, INC.',
    '',
    'ARTICLE IX',
    '',
    'TERMINATION',
    '',
    `9.5. Effect of Termination and Abandonment. In the event of termination of this Agreement, this Agreement shall be of no further force and effect.${DRYRUN_FILLER}`,
    '',
    `9.6. Governing Law. This Agreement shall be governed by the Laws of the State of Delaware.${DRYRUN_FILLER}`,
  ].join('\n');
  return { id: 'deal-dryrun-fixture', metadata: { full_text: doc } };
}

function poisonedSb(label) {
  return {
    from() { throw new Error(`${label}: supabase client must not be touched`); },
    rpc() { throw new Error(`${label}: supabase client must not be touched`); },
  };
}

function poisonedClient(label) {
  return {
    complete() { throw new Error(`${label}: LLM client must not be called`); },
    completeJson() { throw new Error(`${label}: LLM client must not be called`); },
    chat() { throw new Error(`${label}: LLM client must not be called`); },
  };
}

test('classifyFromStoredText with persistRegions:false performs zero supabase calls', async () => {
  const deal = dryrunDealFixture();
  // Build a prior cache that covers every parsed section so no AI call happens.
  const { cleanText: ct, parseStructure: ps } = require('../lib/parser-v2/structural');
  const { sections } = ps(ct(deal.metadata.full_text));
  assert.ok(sections.length >= 2, 'fixture parses into sections');
  const compactPrior = sections.map((s) => ({
    section_number: s.number,
    title: s.title,
    type: 'MISC',
    text_hash: sectionTextHash(s.text),
  }));
  const prior = buildPriorLookup(compactPrior);

  const out = await classifyFromStoredText(
    poisonedSb('dry-run'),
    deal,
    poisonedClient('dry-run'),
    prior,
    { persistRegions: false },
  );
  assert.ok(Array.isArray(out.compact) && out.compact.length === sections.length);
});

// ---------------------------------------------------------------------------
// SPEC-MECHANICAL-HARDENING-2026-07-23 part A, amended by Ben's DATA-1
// sign-off (DECISIONS 2026-07-23, D1 flip-on): rematerialize is ON by
// default; --no-rematerialize restores the warn-only path.
// Group 1 — arg parsing.
// ---------------------------------------------------------------------------

test('parseArgs: rematerialize defaults ON; --no-rematerialize turns it off; --rematerialize-partial recognized', () => {
  const defaults = parseArgs(['node', 'reprocess.js', '--deal', 'Metsera', '--types', 'TERMF']);
  assert.strictEqual(defaults.rematerialize, true);
  assert.strictEqual(defaults.rematerializePartial, false);

  const optOut = parseArgs(['node', 'reprocess.js', '--deal', 'Metsera', '--types', 'TERMF', '--no-rematerialize']);
  assert.strictEqual(optOut.rematerialize, false);

  const explicit = parseArgs(['node', 'reprocess.js', '--deal', 'Metsera', '--types', 'TERMF', '--rematerialize']);
  assert.strictEqual(explicit.rematerialize, true);

  const withBoth = parseArgs([
    'node', 'reprocess.js', '--deal', 'Metsera', '--types', 'TERMF',
    '--apply', '--rematerialize-partial',
  ]);
  assert.strictEqual(withBoth.rematerialize, true);
  assert.strictEqual(withBoth.rematerializePartial, true);
  assert.strictEqual(withBoth.apply, true);
});

test('parseArgs: rematerialize flags accepted alongside dry-run, --apply, and --classify-only with no new validation errors', () => {
  assert.doesNotThrow(() => parseArgs(['node', 'reprocess.js', '--deal', 'x', '--types', 'TERMF', '--rematerialize']));
  assert.doesNotThrow(() => parseArgs(['node', 'reprocess.js', '--deal', 'x', '--types', 'TERMF', '--apply', '--no-rematerialize']));
  assert.doesNotThrow(() => parseArgs(['node', 'reprocess.js', '--deal', 'x', '--classify-only', '--rematerialize']));
});

test('DATA-1 opt-out: --no-rematerialize restores the warn-only path, and formatRematerializeWarning text/command are unchanged', () => {
  const args = parseArgs(['node', 'reprocess.js', '--deal', 'x', '--types', 'TERMF', '--apply', '--no-rematerialize']);
  assert.strictEqual(args.rematerialize, false);
  const msg = formatRematerializeWarning(['deal-a']);
  assert.match(msg, /claims are NOT materialized/);
  assert.match(msg, /node scripts\/reprocess\/rematerialize-claims\.js --deal deal-a --apply\n/);
});

// ---------------------------------------------------------------------------
// Group 2 — wiring: fake sb + fake rematerialize entry points.
// ---------------------------------------------------------------------------

function fakeRematPlan(dealId, overrides = {}) {
  return {
    dealId,
    cardsTotal: 0,
    provisionsTotal: 0,
    matches: [],
    ambiguities: [],
    unmatchedCards: [],
    unmatchedProvisions: [],
    coverageFailures: [],
    rungCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    claimRows: [],
    unknownAttributes: [],
    matchedExcerptIds: [],
    keepClaimIds: new Set(),
    ok: true,
    ...overrides,
  };
}

function fakeRematDeps({ planByDealId = {}, writeDealClaims } = {}) {
  const calls = { fetchProvisions: [], fetchCards: [], buildDealPlan: [], writeDealClaims: [] };
  const deps = {
    fetchProvisions: async (sb, dealId) => { calls.fetchProvisions.push(dealId); return []; },
    fetchCards: async (sb, dealId) => { calls.fetchCards.push(dealId); return []; },
    buildDealPlan: (dealId) => { calls.buildDealPlan.push(dealId); return planByDealId[dealId] || fakeRematPlan(dealId); },
    formatDealTable: () => '  fake table',
    writeDealClaims: writeDealClaims || (async (sb, plan) => { calls.writeDealClaims.push(plan.dealId); return 0; }),
  };
  return { calls, deps };
}

async function withCapturedConsole(fn) {
  const logs = [];
  const errs = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    const result = await fn();
    return { result, logs, errs };
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

test('dry-run: buildRematerializePlans invokes only the planner (fetch + buildDealPlan), never the writer', async () => {
  const deals = [{ id: 'deal-1', acquirer: 'A', target: 'B' }, { id: 'deal-2', acquirer: 'C', target: 'D' }];
  const { calls, deps } = fakeRematDeps();
  const plans = await buildRematerializePlans('fake-sb', deals, deps);
  assert.strictEqual(plans.length, 2);
  assert.deepStrictEqual(calls.fetchProvisions, ['deal-1', 'deal-2']);
  assert.deepStrictEqual(calls.fetchCards, ['deal-1', 'deal-2']);
  assert.deepStrictEqual(calls.buildDealPlan, ['deal-1', 'deal-2']);
  assert.strictEqual(calls.writeDealClaims.length, 0);
});

test('printRematerializePlans prints the plan table (formatDealTable) once per deal', async () => {
  const deals = [{ id: 'deal-1', acquirer: 'A', target: 'B' }];
  const { deps } = fakeRematDeps();
  const plans = await buildRematerializePlans('fake-sb', deals, deps);
  const { logs } = await withCapturedConsole(() => { printRematerializePlans(plans, deps); });
  assert.ok(logs.some((l) => l.includes('fake table')));
  assert.ok(logs.some((l) => l.includes('deal-1')));
});

test('--apply --rematerialize invokes the write path exactly once per exactly the selected deal ids', async () => {
  const deals = [{ id: 'deal-x', acquirer: 'A', target: 'B' }, { id: 'deal-y', acquirer: 'C', target: 'D' }];
  const { calls, deps } = fakeRematDeps();
  const { result } = await withCapturedConsole(() => runRematerializeApply('fake-sb', deals, { partial: false }, deps));
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(calls.writeDealClaims, ['deal-x', 'deal-y']);
});

test('strict failure: ambiguity/coverage failure on any deal in the batch exits { ok: false }, writes nothing (not even for the clean deal), and prints the stale-claims warning', async () => {
  const deals = [
    { id: 'deal-good', acquirer: 'A', target: 'B' },
    { id: 'deal-bad', acquirer: 'C', target: 'D' },
  ];
  const { calls, deps } = fakeRematDeps({
    planByDealId: {
      'deal-bad': fakeRematPlan('deal-bad', { ok: false, coverageFailures: [{ provisionId: 'p1', type: 'TERMF', category: 'Fee' }] }),
    },
  });
  const { result, errs } = await withCapturedConsole(() => runRematerializeApply('fake-sb', deals, { partial: false }, deps));
  assert.strictEqual(result.ok, false);
  assert.strictEqual(calls.writeDealClaims.length, 0, 'strict failure must write NOTHING, including for the clean deal in the same batch');
  const combined = errs.join('\n');
  assert.match(combined, /stale/i);
  assert.match(combined, /already committed/i);
  assert.match(combined, /rematerialize-claims\.js --deal deal-good,deal-bad --apply --partial/);
});

test('--rematerialize-partial maps to the existing --partial semantics: writes unambiguous matches even when another deal has a coverage failure, and reports ok:true', async () => {
  const deals = [
    { id: 'deal-good', acquirer: 'A', target: 'B' },
    { id: 'deal-bad', acquirer: 'C', target: 'D' },
  ];
  const { calls, deps } = fakeRematDeps({
    planByDealId: {
      'deal-bad': fakeRematPlan('deal-bad', { ok: false, coverageFailures: [{ provisionId: 'p1', type: 'TERMF', category: 'Fee' }] }),
    },
  });
  const { result, logs } = await withCapturedConsole(() => runRematerializeApply('fake-sb', deals, { partial: true }, deps));
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(calls.writeDealClaims, ['deal-good', 'deal-bad']);
  assert.ok(logs.some((l) => /--rematerialize-partial/.test(l)));
});
