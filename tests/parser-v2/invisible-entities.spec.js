const test = require('node:test');
const assert = require('node:assert/strict');

const { stripHtml } = require('../../scripts/ingest-local.js');
const { verifyDealQuotes } = require('../../lib/verification');

// Summit Materials 2026-07-17: the exhibit salts "&lrm;" (a NAMED entity for
// the invisible left-to-right mark) through headings and cross-references.
// stripHtml only decoded numeric entities, so 99 literal "&lrm;" strings
// reached the stored text — failing quote verification and punching fake
// holes in coverage (§4.17 read as a 9k-char gap).

test('stripHtml drops invisible named entities and decodes space-like ones', () => {
  const out = stripHtml('<p>in &lrm;Section 10.01(d) and &#8206;Section 4.17 &sect;&ensp;5</p>');
  assert.equal(out, 'in Section 10.01(d) and Section 4.17 § 5');
});

test('stripHtml strips raw zero-width characters emitted by numeric decode', () => {
  const out = stripHtml('A&#8203;B&#8207;C&#65279;D');
  assert.equal(out, 'ABCD');
});

test('quotes containing &lrm; verify against sources containing &lrm;', () => {
  const source = 'The Company may terminate this Agreement pursuant to and in accordance with &lrm;Section 10.01(d)(i) in order to enter into a Superior Proposal.';
  const provisions = [{
    type: 'NOSOL',
    category: 'Fiduciary Out',
    full_text: source,
    ai_metadata: {
      features: {
        fiduciaryOut: {
          value: 'YES',
          quotes: ['terminate this Agreement pursuant to and in accordance with &lrm;Section 10.01(d)(i)'],
        },
      },
    },
  }];
  const v = verifyDealQuotes(provisions, source);
  assert.equal(v.unverified, 0, JSON.stringify(v.failures));
});
