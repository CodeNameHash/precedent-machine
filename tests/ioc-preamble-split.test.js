// Regression tests for splitIocPreamble on a Metsera-shaped IOC preamble
// (MetsFB2 §3): the affirmative-limb splitter must not swallow the
// "; provided that ..." interpretive proviso mid-word, and must not emit a
// garbage "Other Affirmative Obligations" provision from the consent
// parenthetical's "shall not be unreasonably withheld" boilerplate.
const test = require('node:test');
const assert = require('node:assert');

const { splitIocPreamble } = require('../lib/parser-v2/extract.js');

const METSERA_PREAMBLE =
  'SECTION 5.01. Conduct of Business of the Company. Except for matters set ' +
  'forth in Section 5.01 of the Company Disclosure Letter or otherwise ' +
  'expressly required by this Agreement or required by applicable Law or ' +
  'with the prior written consent of Parent (which consent shall not be ' +
  'unreasonably withheld, delayed or conditioned), from the date of this ' +
  'Agreement to the Effective Time, the Company shall, and shall cause each ' +
  'Company Subsidiary to, conduct its business in the ordinary course and, ' +
  'to the extent consistent therewith, use commercially reasonable efforts ' +
  'to preserve its present relationships with suppliers, licensors, ' +
  'licensees, Governmental Entities and other Persons with which it has ' +
  'material business relations and maintain its material assets and ' +
  'business organization intact in all material respects; provided that no ' +
  'action by the Company or any of the Company Subsidiaries with respect to ' +
  'matters specifically addressed by Section 5.01(a) through (r) shall be ' +
  'deemed to be a breach of this sentence unless such action would ' +
  'constitute a breach of Section 5.01(a) through (r). In addition, without ' +
  'limiting the generality of the foregoing, except for matters set forth ' +
  'in Section 5.01 of the Company Disclosure Letter or otherwise expressly ' +
  'required by this Agreement or required by applicable Law, from the date ' +
  'of this Agreement to the Effective Time, the Company shall not, and ' +
  'shall not permit any Company Subsidiary to, do any of the following ' +
  'without the prior written consent of Parent (which consent shall not be ' +
  'unreasonably withheld, delayed or conditioned):';

test('IOC-MAINTAIN stops at the semicolon before the proviso', () => {
  const split = splitIocPreamble(METSERA_PREAMBLE);
  assert.ok(split, 'preamble should split');
  const maintain = split.obligations.find((o) => o.key === 'IOC-MAINTAIN');
  assert.ok(maintain, 'MAINTAIN limb detected');
  assert.ok(
    !/provided|matters specifically|with respect to mat/i.test(maintain.text),
    `MAINTAIN must not swallow the proviso, got: ${maintain.text}`
  );
});

test('proviso survives intact in the residual (no mid-word splice)', () => {
  const split = splitIocPreamble(METSERA_PREAMBLE);
  const residual = split.sharedCarveOuts;
  assert.ok(
    residual.includes('matters specifically addressed by Section 5.01(a)'),
    'proviso text intact in residual'
  );
  assert.ok(
    !/\band ters\b|\bmat ters\b/.test(residual),
    `no mid-word splice artifacts, got: ${residual.slice(0, 400)}`
  );
});

test('no garbage Other-Affirmative from the consent parenthetical', () => {
  const split = splitIocPreamble(METSERA_PREAMBLE);
  if (split.other) {
    assert.ok(
      !/^shall not be unreasonably/i.test(split.other.text),
      `consent boilerplate must not become an obligation, got: ${split.other.text}`
    );
  }
});

test('residual keeps all four section-wide carve-outs verbatim', () => {
  const split = splitIocPreamble(METSERA_PREAMBLE);
  const residual = split.sharedCarveOuts;
  assert.ok(residual.includes('Section 5.01 of the Company Disclosure Letter'));
  assert.ok(residual.includes('otherwise expressly required by this Agreement'));
  assert.ok(residual.includes('required by applicable Law'));
  assert.ok(
    residual.includes(
      'prior written consent of Parent (which consent shall not be unreasonably withheld, delayed or conditioned)'
    ),
    'full consent parenthetical verbatim'
  );
});
