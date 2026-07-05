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

/* ─────────────────────────────────────────────────────────────────────────
 * Audit-2 item 5 — Cooper IOC preserve limbs. Both Cooper deals phrase the
 * preservation duty as "preserve INTACT its current/present business
 * organization(s) ..." rather than "preserve its present relationships ...",
 * so the relationships-only IOC-PRESERVE pattern never fired and the limb
 * vanished from the affirmative table. Additionally, the efforts qualifier
 * sits before the FIRST infinitive only ("use commercially reasonable
 * efforts to conduct ... and to preserve ...") so the preserve limb's own
 * text carries no efforts phrase — the coordinated-infinitive rule must
 * carry the CRE standard across, not default to FLAT.
 * ───────────────────────────────────────────────────────────────────────── */

// Real Mr. Cooper §5.1 preamble (Rocket / Mr. Cooper, trimmed).
const MRCOOPER_PREAMBLE =
  'Section 5.1 Conduct of Maverick. From the date of this Agreement until the ' +
  'Maverick Effective Time, except with the prior written consent of Cavalier ' +
  '(such consent not to be unreasonably withheld, conditioned or delayed), as ' +
  'expressly permitted or required by this Agreement, as may be required by ' +
  'applicable Law or as set forth in Section 5.1 of the Maverick Disclosure ' +
  'Schedules, Maverick and each of its Subsidiaries shall use commercially ' +
  'reasonable efforts to conduct its business and operations in the ordinary ' +
  'course of business consistent with past practice in all material respects ' +
  'and to preserve intact its current business organizations and relationships ' +
  'with material customers, vendors, distributors, partners, licensors, ' +
  'licensees, creditors and other Persons with which it has material business ' +
  'relations; provided that (x) no action by Maverick or any of its ' +
  'Subsidiaries to the extent expressly permitted by any of clauses (a) ' +
  'through (t) below shall be a breach of this sentence.';

// Real Cooper Tire §5.1 preamble limb (Goodyear / Cooper Tire, trimmed).
const COOPERTIRE_PRESERVE_SENTENCE =
  'the Company shall, and shall cause each of its Subsidiaries to, use its ' +
  'commercially reasonable efforts to preserve intact its present business ' +
  'organization, keep available the services of its directors, officers and ' +
  'employees and maintain existing relations and goodwill with customers, ' +
  'distributors, lenders, partners (including Joint Venture partners and ' +
  'others with similar relationships), suppliers and others having material ' +
  'business associations with it or its Subsidiaries; provided, however, that ' +
  'the failure to take any action prohibited by the subclauses in the next ' +
  'sentence shall not be a breach.';

test('Mr. Cooper §5.1: "preserve intact its current business organizations and relationships" limb is split out', () => {
  const split = splitIocPreamble(MRCOOPER_PREAMBLE);
  assert.ok(split, 'preamble must split');
  const keys = split.obligations.map((o) => o.key);
  assert.ok(keys.includes('IOC-ORDINARY'), `ordinary-course limb expected, got ${keys}`);
  assert.ok(keys.includes('IOC-PRESERVE'), `preserve limb expected, got ${keys}`);
  const preserve = split.obligations.find((o) => o.key === 'IOC-PRESERVE');
  assert.ok(preserve.text.includes('business organizations and relationships'), preserve.text);
});

test('Mr. Cooper §5.1: coordinated "efforts to conduct ... and to preserve" carries CRE onto the preserve limb (not FLAT)', () => {
  const split = splitIocPreamble(MRCOOPER_PREAMBLE);
  const preserve = split.obligations.find((o) => o.key === 'IOC-PRESERVE');
  assert.equal(preserve.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
  const ordinary = split.obligations.find((o) => o.key === 'IOC-ORDINARY');
  assert.equal(ordinary.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
});

test('Cooper Tire §5.1: "preserve intact its present business organization, keep available the services ..." limb is split with CRE', () => {
  const split = splitIocPreamble(COOPERTIRE_PRESERVE_SENTENCE);
  assert.ok(split, 'sentence must split');
  const preserve = split.obligations.find((o) => o.key === 'IOC-PRESERVE');
  assert.ok(preserve, `preserve limb expected, got ${split.obligations.map((o) => o.key)}`);
  assert.ok(preserve.text.includes('keep available the services'), preserve.text);
  assert.equal(preserve.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
});

test('a genuinely flat "and to preserve" with NO efforts phrase in the sentence stays FLAT', () => {
  const flat =
    'the Company shall conduct its business in the ordinary course of business ' +
    'and to preserve intact its current business organizations and relationships with material customers.';
  const split = splitIocPreamble(flat);
  const preserve = split && split.obligations.find((o) => o.key === 'IOC-PRESERVE');
  if (preserve) {
    assert.equal(preserve.efforts_standard, 'FLAT');
  }
});
