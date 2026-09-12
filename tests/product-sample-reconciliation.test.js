'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {
  normaliseNoteFile,
  referenceMatcher,
  reconcileSampleNotes,
} = require('../lib/product/sample-reconciliation');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'product', 'ben-samples');

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

function fact({ fact_id, section_reference, label, text }) {
  return {
    fact_id,
    section_reference,
    headline: { label, distinguishing_component_ids: [] },
    components: [{ component_id: `${fact_id}-c1`, kind: 'TERM', origin: 'OWN', text, children: [] }],
  };
}

test('normalises the Olaplex note_batches fixture into 72 items with one GAP', () => {
  const raw = loadFixture('olaplex-ben-partial-inventory.v1.json');
  const items = normaliseNoteFile(raw);
  assert.equal(items.length, 72);
  const gaps = items.filter((item) => item.is_gap);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].item_id, 'OLAPLEX-BEN-02-034');
  assert.equal(gaps[0].section_reference, '5.1');
  for (const item of items) {
    assert.equal(typeof item.item_id, 'string');
    assert.ok(item.item_id.length > 0);
    assert.equal(typeof item.section_reference, 'string');
    assert.equal(typeof item.text, 'string');
    assert.ok(item.text.length > 0);
  }
});

test('normalises the Apogee flat notes fixture into 7 items, one per note, no semicolon splitting', () => {
  const raw = loadFixture('apogee-ben-partial-inventory.v1.json');
  const items = normaliseNoteFile(raw);
  assert.equal(items.length, 7);
  assert.ok(items.every((item) => item.is_gap === false));
  const articleIntro = items.find((item) => item.section_reference === 'Article III intro');
  assert.ok(articleIntro);
  assert.ok(articleIntro.text.includes(';'), 'a multi-point note is kept as one item, not split on semicolons');
  const ids = items.map((item) => item.item_id);
  assert.equal(new Set(ids).size, ids.length, 'item ids are unique');
});

test('reference matcher: a bare reference matches itself and everything below it', () => {
  const matches = referenceMatcher('5.2');
  assert.ok(matches('5.2'));
  assert.ok(matches('5.2(a)'));
  assert.ok(matches('5.2(a)(i)'));
  assert.ok(!matches('5.20'));
  assert.ok(!matches('5.3'));
});

test('reference matcher: a lettered range matches every member and its descendants', () => {
  const matches = referenceMatcher('6.1(a)-(d)');
  assert.ok(matches('6.1(a)'));
  assert.ok(matches('6.1(c)'));
  assert.ok(matches('6.1(d)'));
  assert.ok(matches('6.1(c)(i)'));
  assert.ok(!matches('6.1(e)'));
  assert.ok(!matches('6.1'));
});

test('reference matcher: an "and" reference matches either side', () => {
  const matches = referenceMatcher('7.2 and 7.3(d)');
  assert.ok(matches('7.2'));
  assert.ok(matches('7.2(a)'));
  assert.ok(matches('7.3(d)'));
  assert.ok(!matches('7.3'));
  assert.ok(!matches('7.3(e)'));
});

test('reference matcher: an Article intro reference matches the roman, arabic and ".0" forms', () => {
  const matches = referenceMatcher('Article III intro');
  assert.ok(matches('III'));
  assert.ok(matches('3'));
  assert.ok(matches('3.0'));
  assert.ok(!matches('3.1'));
  assert.ok(!matches('IV'));
});

test('reconcileSampleNotes: MATCHED, PARTIAL and MISSING cases against a synthetic fact list', () => {
  const facts = [
    fact({ fact_id: 'f-term', section_reference: '9.1', label: 'Termination fee', text: 'Company pays Parent a termination fee of $50,000,000 in cash within two business days' }),
    fact({ fact_id: 'f-noshop', section_reference: '9.2', label: 'No-shop', text: 'Company shall not solicit competing acquisition proposals during the interim period' }),
    fact({ fact_id: 'f-unrelated', section_reference: '9.3', label: 'Governing law', text: 'This agreement is governed by Delaware law' }),
  ];
  const items = [
    { item_id: 'i-matched', section_reference: '9.1', text: 'Termination fee of $50,000,000 payable in cash within two business days', is_gap: false },
    { item_id: 'i-partial', section_reference: '9.2', text: 'No solicitation of competing proposals but also a long unrelated tangent about financing covenants and MAE definitions and indemnification caps', is_gap: false },
    { item_id: 'i-missing', section_reference: '9.3', text: 'Something entirely different about employee benefits continuation', is_gap: false },
  ];

  const { results, summary } = reconcileSampleNotes({ items, facts });
  const byId = Object.fromEntries(results.map((r) => [r.item_id, r]));

  assert.equal(byId['i-matched'].status, 'MATCHED');
  assert.equal(byId['i-matched'].best_fact.fact_id, 'f-term');
  assert.ok(byId['i-matched'].overlap_share >= 0.5);

  assert.equal(byId['i-partial'].status, 'PARTIAL');
  assert.equal(byId['i-partial'].best_fact.fact_id, 'f-noshop');
  assert.ok(byId['i-partial'].overlap_share >= 0.2 && byId['i-partial'].overlap_share < 0.5);

  assert.equal(byId['i-missing'].status, 'MISSING');

  assert.deepEqual(summary, { MATCHED: 1, PARTIAL: 1, MISSING: 1, GAP: 0 });
});

test('reconcileSampleNotes: a GAP item never runs matching and always reports GAP', () => {
  const facts = [fact({ fact_id: 'f1', section_reference: '5.1', label: 'X', text: 'anything at all' })];
  const items = [{ item_id: 'i-gap', section_reference: '5.1', text: 'not enumerated in the notes', is_gap: true }];
  const { results, summary } = reconcileSampleNotes({ items, facts });
  assert.equal(results[0].status, 'GAP');
  assert.equal(results[0].best_fact, null);
  assert.equal(results[0].overlap_share, null);
  assert.deepEqual(summary, { MATCHED: 0, PARTIAL: 0, MISSING: 0, GAP: 1 });
});

test('reconcileSampleNotes: an unmatched fact in a covered section is listed as not mentioned, not an error', () => {
  const facts = [
    fact({ fact_id: 'f-a', section_reference: '5.3(a)', label: 'A', text: 'shareholder approval condition required for closing' }),
    fact({ fact_id: 'f-b', section_reference: '5.3(b)', label: 'B', text: 'financing condition unrelated to shareholder approval' }),
  ];
  const items = [{ item_id: 'i1', section_reference: '5.3', text: 'shareholder approval condition required for closing', is_gap: false }];
  const { results, unmentionedFacts } = reconcileSampleNotes({ items, facts });
  assert.equal(results[0].status, 'MATCHED');
  assert.equal(results[0].best_fact.fact_id, 'f-a');
  assert.equal(unmentionedFacts.length, 1);
  assert.equal(unmentionedFacts[0].fact_id, 'f-b');
});
