// r17b (Ben): QXO's proration See-provision expansion showed a cut-off
// quote — the stored oversubscriptionTreatment excerpt carries a literal
// mid-string " ... " that elides exactly the operative payment formulas.
// lib/unelide-quote.js reconstructs the complete span from the provision's
// full_text when both anchors resolve; these tests pin the QXO shape (the
// real 20,177-char CONSID full_text is the fixture), the anchor-miss and
// no-elision null paths, and the server wiring in lib/queries/
// review-deal.js (mocked sb returning the real full_text).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { hasMidElision, unelideQuote } = require('../lib/unelide-quote');
const { unelideMechanicsQuotes, collectElidedMechanicsSlots } = require('../lib/queries/review-deal');

const QXO_FULL_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-consid-full-text.txt'),
  'utf8'
);

// The stored (elided) claims-layer quote, verbatim from the QXO
// CONSID-CONVERT card's prorationMechanics.oversubscriptionTreatment.
const QXO_ELIDED =
  'In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number, all Stock Election Shares shall be converted into the right to receive Stock Consideration, and all Cash Election Shares shall be converted into the right to receive: ... In the event that the aggregate number of Stock Election Shares exceeds the Maximum Stock Election Number, all Cash Election Shares shall be converted into the right to receive Cash Consideration, and all Stock Election Shares shall be converted into the right to receive:';

test('hasMidElision: mid-string " ... " with text on both sides', () => {
  assert.equal(hasMidElision(QXO_ELIDED), true);
  assert.equal(hasMidElision('alpha … omega'), true);
  assert.equal(hasMidElision('alpha . . . omega'), true);
});

test('hasMidElision: no elision / edge-only ellipses / non-strings', () => {
  assert.equal(hasMidElision('a complete clause with no elision at all'), false);
  assert.equal(hasMidElision('...trailing head only'), false);
  assert.equal(hasMidElision('leading tail only...'), false);
  assert.equal(hasMidElision(''), false);
  assert.equal(hasMidElision(null), false);
  assert.equal(hasMidElision(42), false);
});

test('QXO shape: the elided middle is restored — both mirror clauses WITH the proration formulas', () => {
  const out = unelideQuote(QXO_ELIDED, QXO_FULL_TEXT);
  assert.ok(out, 'span must resolve');
  // Starts at the head, ends at the tail (the stored quote edges).
  assert.ok(out.startsWith('In the event that the aggregate number of Cash Election Shares exceeds'));
  assert.ok(out.endsWith('all Stock Election Shares shall be converted into the right to receive:'));
  // The previously-elided operative payment formulas are back:
  assert.match(out, /a fraction \(the "Cash Proration Fraction"\)/);
  assert.match(out, /the numerator of which is the Maximum Cash Election Number/);
  assert.match(
    out,
    /Parent Shares equal to the product of \(x\) the Stock Consideration and \(y\) one minus the Cash Proration Fraction/
  );
  // Both mirror clauses present:
  assert.match(out, /Cash Election Shares exceeds the Maximum Cash Election Number/);
  assert.match(out, /Stock Election Shares exceeds the Maximum Stock Election Number/);
  // Formatting comes from the provision's own text (paragraph list breaks
  // survive), and the literal elision is gone.
  assert.ok(!/\s\.\.\.\s/.test(out), 'no residual mid-string elision');
  assert.ok(out.includes('\n'), 'original full_text formatting preserved');
  assert.ok(out.length > QXO_ELIDED.length, 'restored span is longer than the elided excerpt');
  assert.ok(out.length < 8000, 'within the plausibility cap');
});

test('multi-elision quotes resolve as ONE span (first head, last tail)', () => {
  const multi =
    'In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number ... rounded down to the nearest cent ... and all Stock Election Shares shall be converted into the right to receive:';
  const out = unelideQuote(multi, QXO_FULL_TEXT);
  assert.ok(out);
  assert.ok(out.startsWith('In the event that the aggregate number of Cash Election Shares exceeds'));
  assert.ok(out.endsWith('all Stock Election Shares shall be converted into the right to receive:'));
  assert.match(out, /"Cash Proration Fraction"/);
});

test('anchor miss returns null — never guess or stitch', () => {
  const wrongHead =
    'This head sentence appears nowhere in the QXO consideration provision text at all, truly ... and all Stock Election Shares shall be converted into the right to receive:';
  assert.equal(unelideQuote(wrongHead, QXO_FULL_TEXT), null);
  const wrongTail =
    'In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number ... this tail sentence appears nowhere in the QXO consideration provision text at all';
  assert.equal(unelideQuote(wrongTail, QXO_FULL_TEXT), null);
});

test('out-of-order anchors (tail occurs only BEFORE the head) return null', () => {
  const fullText =
    'Zebra clause omega omega omega omega omega omega omega omega ends here first. ' +
    'Alpha clause begins here and runs long enough to serve as a head anchor for the test.';
  const quote =
    'Alpha clause begins here and runs long enough to serve as a head anchor ... Zebra clause omega omega omega omega omega omega omega omega ends here first.';
  assert.equal(unelideQuote(quote, fullText), null);
});

test('no-elision quote returns null — caller keeps the original', () => {
  assert.equal(
    unelideQuote('a complete clause with no elision that appears verbatim', 'a complete clause with no elision that appears verbatim'),
    null
  );
});

test('edge-only ellipses (no mid elision) return null', () => {
  assert.equal(unelideQuote('...the tail half of a clause that was clipped at the front', QXO_FULL_TEXT), null);
});

test('implausibly long span (> maxSpanChars) returns null', () => {
  const head = 'The head anchor sentence sits at the very beginning of the document text.';
  const tail = 'The tail anchor sentence sits at the very end of the document text here.';
  const fullText = head + ' filler '.repeat(1200) + tail; // ~9.7k chars between anchors
  const quote = `${head} ... ${tail}`;
  assert.equal(unelideQuote(quote, fullText), null);
  // Same shape resolves when the caller relaxes the cap — proves it was the
  // length check, not the anchoring, that said no.
  assert.ok(unelideQuote(quote, fullText, { maxSpanChars: 20000 }));
});

test('anchors shorter than the trust minimum return null', () => {
  assert.equal(unelideQuote('short head ... short tail', 'short head middle short tail'), null);
});

test('whitespace/newline differences between quote and full_text still anchor', () => {
  const fullText =
    'Section 9.9 Long Enough Heading. In the event of oversubscription the\n\nExchange Agent shall allocate     the consideration\namong the holders ratably and without interest as promptly as practicable following the Election Deadline.';
  const quote =
    'In the event of oversubscription the Exchange Agent shall allocate the consideration ... ratably and without interest as promptly as practicable following the Election Deadline.';
  const out = unelideQuote(quote, fullText);
  assert.ok(out);
  assert.ok(out.startsWith('In the event of oversubscription'));
  assert.ok(out.endsWith('following the Election Deadline.'));
});

// ── Server wiring: lib/queries/review-deal.js ────────────────────────────

function makeCard(overrides = {}) {
  return {
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-CONVERT',
    features: {
      prorationMechanics: {
        text: 'the maximum number of Company Shares to be converted…',
        electionType: 'MIXED_ELECTION',
        oversubscriptionTreatment: QXO_ELIDED,
        electionDeadline: '5:00 P.M. (Eastern Time) on the business day that is five (5) business days prior',
      },
    },
    ...overrides,
  };
}

function makeProvisionSb(rows, calls = []) {
  return {
    from(table) {
      const q = {
        _table: table,
        select() { return this; },
        eq(col, val) { calls.push([table, 'eq', col, val]); return this; },
        ilike(col, val) {
          calls.push([table, 'ilike', col, val]);
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return q;
    },
  };
}

test('collectElidedMechanicsSlots: only CONSID-family mechanics strings with mid-elisions', () => {
  const considCard = makeCard();
  const otherType = makeCard({ provision_type: 'TERMINATION', provision_subtype: 'TERM-FEE' });
  const noElision = makeCard({
    features: { prorationMechanics: { oversubscriptionTreatment: 'complete clause, nothing elided' } },
  });
  const slots = collectElidedMechanicsSlots([considCard, otherType, noElision]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].field, 'oversubscriptionTreatment');
  assert.equal(slots[0].mech, considCard.features.prorationMechanics);
});

test('unelideMechanicsQuotes replaces the QXO elided oversubscription quote with the complete clause (mocked sb, real full_text)', async () => {
  const card = makeCard();
  const calls = [];
  const sb = makeProvisionSb([{ id: 'p1', full_text: QXO_FULL_TEXT }], calls);
  const replaced = await unelideMechanicsQuotes('7dc3a05f-b170-4d59-a255-b7103cca16e1', [card], sb);
  assert.equal(replaced, 1);
  const after = card.features.prorationMechanics.oversubscriptionTreatment;
  assert.match(after, /"Cash Proration Fraction"/);
  assert.match(after, /one minus the Cash Proration Fraction/);
  assert.ok(!/\s\.\.\.\s/.test(after));
  // Untouched siblings stay untouched.
  assert.equal(card.features.prorationMechanics.electionType, 'MIXED_ELECTION');
  assert.match(card.features.prorationMechanics.electionDeadline, /five \(5\) business days/);
  // One tightly-filtered provisions query: deal_id eq + type ilike CONSID%.
  assert.deepEqual(calls, [
    ['provisions', 'eq', 'deal_id', '7dc3a05f-b170-4d59-a255-b7103cca16e1'],
    ['provisions', 'ilike', 'type', 'CONSID%'],
  ]);
});

test('unelideMechanicsQuotes: no elided slots => no provisions query at all', async () => {
  const card = makeCard({
    features: { prorationMechanics: { oversubscriptionTreatment: 'complete clause, nothing elided' } },
  });
  const sb = {
    from() { throw new Error('must not query provisions when nothing is elided'); },
  };
  const replaced = await unelideMechanicsQuotes('deal-1', [card], sb);
  assert.equal(replaced, 0);
});

test('unelideMechanicsQuotes degrades gracefully: fetch failure keeps the original quotes', async () => {
  const card = makeCard();
  const sb = { from() { throw new Error('supabase down'); } };
  const replaced = await unelideMechanicsQuotes('deal-1', [card], sb);
  assert.equal(replaced, 0);
  assert.equal(card.features.prorationMechanics.oversubscriptionTreatment, QXO_ELIDED);
});

test('unelideMechanicsQuotes: anchor miss keeps the stored quote (never stitches)', async () => {
  const card = makeCard();
  const sb = makeProvisionSb([{ id: 'p1', full_text: 'entirely unrelated provision text with none of the anchors present anywhere in it' }]);
  const replaced = await unelideMechanicsQuotes('deal-1', [card], sb);
  assert.equal(replaced, 0);
  assert.equal(card.features.prorationMechanics.oversubscriptionTreatment, QXO_ELIDED);
});
