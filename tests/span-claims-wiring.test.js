/* Span accounting Part 2 — the extract.js side of the switch.
 *
 * lib/parser-v2/span-claims.js has always been able to compute claim offsets
 * deterministically. It never ran: extract.js's hook gated on
 * `opts.spanClaims === true`, and extractProvisions accepted `opts` and then
 * dropped it before calling strategyA/strategyC — so no caller could reach
 * the gate even by passing the flag. These tests pin that the hook now runs
 * when asked, that its offsets resolve against the source text, and that it
 * stays off otherwise.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachStrategySpanClaims,
  resolveSpanClaimsOpts,
} = require('../lib/parser-v2/extract');
const { buildClaimRowsForCard } = require('../lib/parser-v2/store-claims');
const { buildProvisionCardRows } = require('../lib/parser-v2/store-cards');

const SECTION_START = 12000;
const SECTION_TEXT = [
  '5.2Additional Conditions. The obligations of Parent are subject to the',
  'satisfaction of each of the following further conditions:',
  '',
  '(a)',
  '',
  '(i)The Company shall have performed in all material respects all of its',
  'obligations hereunder required to be performed by it as of the Closing Date;',
  '',
  '(b)Parent shall have received a certificate of the Company dated the',
  'Closing Date certifying that the conditions above have been satisfied.',
].join('\n');

const SUBCLAUSE_QUOTE = 'Parent shall have received a certificate of the Company dated the';

function sections() {
  return [{ startChar: SECTION_START, text: SECTION_TEXT }];
}

// Strategy C emits the whole section as one provision (startChar === the
// section's own). Strategy A emits sub-clauses, whose startChar sits INSIDE
// the section — those have to be mapped back to the parent section before
// they can be located, because segmentSubClauses needs the whole section.
function wholeSectionProvision() {
  return { startChar: SECTION_START, text: SECTION_TEXT };
}

function subClauseProvision() {
  return {
    startChar: SECTION_START + SECTION_TEXT.indexOf(SUBCLAUSE_QUOTE),
    text: SUBCLAUSE_QUOTE,
  };
}

// ---------------------------------------------------------------------------
// Off by default — nothing about the ingest path changes.
// ---------------------------------------------------------------------------

test('the Strategy A/C hook writes nothing when no caller opts in', () => {
  for (const opts of [undefined, {}, { spanClaims: false }, { checkpoint: null }]) {
    const provisions = [wholeSectionProvision(), subClauseProvision()];
    attachStrategySpanClaims(sections(), provisions, opts);
    assert.ok(
      provisions.every((prov) => prov.features === undefined),
      `features must stay untouched for opts=${JSON.stringify(opts)}`,
    );
  }
});

test('resolveSpanClaimsOpts leaves the flag off unless it is explicitly turned on', () => {
  const saved = process.env.PM_SPAN_CLAIMS;
  try {
    delete process.env.PM_SPAN_CLAIMS;
    assert.equal(resolveSpanClaimsOpts(undefined).spanClaims, undefined);
    assert.equal(resolveSpanClaimsOpts({}).spanClaims, undefined);
    assert.equal(resolveSpanClaimsOpts({ spanClaims: false }).spanClaims, false);

    for (const value of ['0', 'true', 'yes', '']) {
      process.env.PM_SPAN_CLAIMS = value;
      assert.notEqual(
        resolveSpanClaimsOpts({}).spanClaims,
        true,
        `PM_SPAN_CLAIMS=${JSON.stringify(value)} must not enable the pass`,
      );
    }
  } finally {
    if (saved === undefined) delete process.env.PM_SPAN_CLAIMS;
    else process.env.PM_SPAN_CLAIMS = saved;
  }
});

test('resolveSpanClaimsOpts preserves the rest of the caller options bag', () => {
  const checkpoint = { load: () => null, save: () => {} };
  const resolved = resolveSpanClaimsOpts({ checkpoint, spanClaims: true });
  assert.equal(resolved.checkpoint, checkpoint);
  assert.equal(resolved.spanClaims, true);
});

// ---------------------------------------------------------------------------
// On when asked — and the offsets it records actually resolve.
// ---------------------------------------------------------------------------

test('a whole-section (Strategy C) provision gets offsets that slice back to the source text', () => {
  const provisions = [wholeSectionProvision()];
  attachStrategySpanClaims(sections(), provisions, { spanClaims: true });

  const { spanClaims } = provisions[0].features;
  assert.equal(spanClaims.spanUnlocated, false);
  assert.equal(spanClaims.sectionStartChar, SECTION_START);
  assert.equal(
    SECTION_TEXT.slice(spanClaims.textSpan.start, spanClaims.textSpan.end),
    SECTION_TEXT,
  );
});

test('a sub-clause (Strategy A) provision is located against its PARENT section, with resolving offsets', () => {
  const provisions = [subClauseProvision()];
  attachStrategySpanClaims(sections(), provisions, { spanClaims: true });

  const { spanClaims } = provisions[0].features;
  assert.equal(spanClaims.sectionStartChar, SECTION_START, 'mapped back to the containing section');
  assert.equal(spanClaims.spanUnlocated, false);
  assert.equal(
    SECTION_TEXT.slice(spanClaims.textSpan.start, spanClaims.textSpan.end),
    SUBCLAUSE_QUOTE,
    'the recorded offsets must give the quote back, or they are decoration',
  );
  assert.equal(spanClaims.claimedSpans[0].marker, 'b');
  // The offsets are section-relative; sectionStartChar is what lifts them
  // into the coordinates the provision's own startChar lives in.
  assert.equal(spanClaims.sectionStartChar + spanClaims.textSpan.start, provisions[0].startChar);
});

test('PM_SPAN_CLAIMS=1 turns the pass on for entrypoints that thread no span option of their own', () => {
  const saved = process.env.PM_SPAN_CLAIMS;
  try {
    process.env.PM_SPAN_CLAIMS = '1';
    const provisions = [subClauseProvision()];
    attachStrategySpanClaims(sections(), provisions, {});
    assert.ok(provisions[0].features.spanClaims);
    assert.equal(provisions[0].features.spanClaims.spanUnlocated, false);
  } finally {
    if (saved === undefined) delete process.env.PM_SPAN_CLAIMS;
    else process.env.PM_SPAN_CLAIMS = saved;
  }
});

test('a provision whose text is not in its section is flagged, not given an invented span', () => {
  const provisions = [{
    startChar: SECTION_START,
    text: 'Parent shall pay a termination fee of $500,000,000 upon a Company Change of Recommendation.',
  }];
  attachStrategySpanClaims(sections(), provisions, { spanClaims: true });

  const { spanClaims } = provisions[0].features;
  assert.equal(spanClaims.spanUnlocated, true);
  assert.equal(spanClaims.textSpan, null);
  assert.deepEqual(spanClaims.claimedSpans, []);
});

// ---------------------------------------------------------------------------
// Downstream: the payload rides in the existing features bag (persisted as
// provisions.ai_metadata.features by store.js — no new column), and the
// claims layer must not mistake it for an extracted feature.
// ---------------------------------------------------------------------------

test('spanClaims in a feature bag is never materialised as a claim, nor reported as a registry-unknown feature', () => {
  const prov = {
    type: 'TERMR',
    code: 'TERMR-OUTSIDE',
    category: 'Outside Date Termination',
    section_path: 'Section 8.01(b)',
    region_id: '00000000-0000-4000-8000-000000000010',
    region_full_text: SECTION_TEXT,
    text: SECTION_TEXT,
    features: {
      outsideDateMonths: { value: '24', quotes: [] },
      spanClaims: {
        claimedSpans: [{ start: 0, end: 10, marker: 'b', depth: 1 }],
        spanUnlocated: false,
        textSpan: { start: 0, end: 10 },
        sectionStartChar: SECTION_START,
      },
    },
  };
  const [cardRow] = buildProvisionCardRows('885edae5-49e8-464a-9f33-edd229119d7c', [prov], {
    extractedAt: '2026-07-08T00:00:00.000Z',
  });
  const { rows, unknownAttributes } = buildClaimRowsForCard(
    '885edae5-49e8-464a-9f33-edd229119d7c',
    cardRow,
    prov,
    { extractedAt: '2026-07-08T00:00:00.000Z' },
  );

  assert.ok(rows.every((row) => row.attribute !== 'spanClaims'));
  assert.deepEqual(unknownAttributes, [], 'a derived key must not read as an unregistered feature');
  assert.equal(rows.length, 1, 'only the real feature becomes a claim');
});
