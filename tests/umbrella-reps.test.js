/* Tests for the umbrella-rep segmentation pre-pass in lib/parser-v2/extract.js.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitUmbrellaRepSections, extractTitledSubclauses } = require('../lib/parser-v2/extract');

// A Red-Hat-shaped umbrella: all company reps under one Section 3.01 with
// TITLED lettered sub-clauses. Real umbrellas are the whole reps article
// (~75k chars / 22 reps); pad each rep body so the fixture clears the length
// floor the way a real one does.
const FILLER = ' The foregoing representation is qualified in its entirety by the Company Disclosure Letter and applies to the Company and each of its Subsidiaries as of the date of this Agreement and as of the Closing Date, except to the extent expressly relating to an earlier date.'.repeat(4);
const UMBRELLA_TEXT = [
  'SECTION 3.01. Representations and Warranties of the Company. Except (i) as disclosed in the Company SEC Documents or (ii) as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent as follows:',
  `(a) Organization, Standing and Corporate Power. The Company and each of its Subsidiaries is duly organized, validly existing and in good standing under the laws of its jurisdiction of organization, with all requisite corporate power.${FILLER}`,
  `(b) Subsidiaries. Section 3.01(b) of the Company Disclosure Letter sets forth a true and complete list of each Subsidiary of the Company, together with its jurisdiction of organization.${FILLER}`,
  `(c) Capital Structure. The authorized capital stock of the Company consists of (i) 1,000,000,000 shares of Company Common Stock and (ii) 100,000,000 shares of preferred stock.${FILLER}`,
  `(d) Authority; Noncontravention. The Company has all necessary corporate power and authority to execute and deliver this Agreement and to consummate the Merger.${FILLER}`,
  `(e) Company SEC Documents; Financial Statements. The Company has filed with the SEC all reports required to be filed since January 1, 2016.${FILLER}`,
  `(f) Absence of Certain Changes or Events. Since the date of the most recent audited financial statements, (i) the Company has conducted its business in the ordinary course and (ii) there has not been any Company Material Adverse Effect.${FILLER}`,
].join('\n');

function sec(overrides) {
  return {
    provision_type: 'REP-T',
    number: '3.01',
    title: 'Representations and Warranties of the Company',
    articleNumber: 'III',
    articleTitle: 'REPRESENTATIONS AND WARRANTIES',
    startChar: 10000,
    text: UMBRELLA_TEXT,
    ...overrides,
  };
}

test('extractTitledSubclauses pulls the monotonic a..f titled run', () => {
  const parts = extractTitledSubclauses(UMBRELLA_TEXT);
  assert.deepEqual(parts.map((p) => p.letter), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(parts[0].title, 'Organization, Standing and Corporate Power');
  assert.equal(parts[4].title, 'Company SEC Documents; Financial Statements');
  // The nested "(i)/(ii)" inside (c) and (f) must NOT create sub-clauses.
  assert.ok(parts.every((p) => /^[a-z]$/.test(p.letter)));
});

test('gap-tolerant sequence: a missing letter does not truncate the tail, a stray jump is rejected', () => {
  // Real Red-Hat shape: "(i)" fails to match the titled regex (reads as a roman
  // numeral) and a stray "(z) Inktank Storage, Inc." appears mid-list. The run
  // must skip the (z) jump AND continue past the missing (i) to (j), (k)…
  const text = [
    '(a) Organization. Body text for organization rep goes here in full.',
    '(b) Subsidiaries. Body text describing the subsidiaries representation.',
    '(c) Capital Structure. The authorized capital stock consists of shares, including (z) Inktank Storage, Inc. as a listed subsidiary among others.',
    '(d) Authority. The Company has all necessary corporate power and authority.',
    '(e) SEC Documents. The Company has filed all required reports with the SEC.',
    '(f) Absence of Changes. There has not been any Company Material Adverse Effect.',
    '(g) Litigation. There are no material actions pending against the Company.',
    '(h) Contracts. The Company Disclosure Letter lists each material contract.',
    // (i) intentionally absent from the titled run (would-be "(i) Permits")
    '(j) Environmental Matters. The Company complies with Environmental Laws.',
    '(k) Labor Relations. There is no labor dispute pending against the Company.',
  ].join('\n');
  const letters = extractTitledSubclauses(text).map((p) => p.letter);
  assert.ok(!letters.includes('z'), 'stray (z) jump must be rejected');
  assert.ok(letters.includes('j') && letters.includes('k'), 'tail after the missing (i) must survive');
  assert.deepEqual(letters, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k']);
});

test('splitUmbrellaRepSections expands one umbrella into preamble + one section per rep', () => {
  const out = splitUmbrellaRepSections([sec()]);
  const preamble = out.filter((s) => s._umbrellaPreamble);
  const children = out.filter((s) => s._umbrellaChild);
  assert.equal(preamble.length, 1);
  assert.equal(children.length, 6);
  // Preamble holds the chapeau only (no rep body).
  assert.ok(/represents and warrants to Parent as follows/.test(preamble[0].text));
  assert.ok(!/Organization, Standing/.test(preamble[0].text));
  // Each child is its own rep, numbered 3.01(a)… and titled by its heading.
  assert.equal(children[0].number, '3.01(a)');
  assert.equal(children[0].category, 'Organization, Standing and Corporate Power');
  assert.ok(/duly organized/.test(children[0].text));
  // startChar advances into the document for each child.
  assert.ok(children[1].startChar > children[0].startChar);
  // Type is preserved so downstream type-routing is unchanged.
  assert.ok(out.every((s) => s.provision_type === 'REP-T'));
});

test('a per-section rep (short, no titled run) passes through untouched', () => {
  const perSection = {
    provision_type: 'REP-T',
    number: '3.09',
    title: 'Taxes',
    startChar: 500,
    text: 'SECTION 3.09. Taxes. (a) The Company has timely filed all Tax Returns. (b) All such Tax Returns are true and correct. (c) There are no audits pending.',
  };
  const out = splitUmbrellaRepSections([perSection]);
  assert.equal(out.length, 1);
  assert.equal(out[0], perSection); // untouched (too short + only 3 sub-clauses)
});

test('an enumerated single rep (Material Contracts, untitled roman items) is NOT split', () => {
  // Long, but sub-items are lowercase/untitled "(i) …, (ii) …" — the titled-run
  // discriminator must find no monotonic a,b,c titled headings.
  const materialContracts = {
    provision_type: 'REP-T',
    number: '3.08',
    title: 'Material Contracts',
    startChar: 0,
    text: 'SECTION 3.08. Material Contracts. '
      + 'Section 3.08 of the Company Disclosure Letter lists each Contract that '
      + '(i) is a partnership or joint venture agreement, (ii) relates to indebtedness for borrowed money, '
      + '(iii) grants a right of first refusal, (iv) limits the ability to compete, (v) is with a Governmental Entity, '
      + '(vi) contains a most-favored-nation provision, (vii) involves annual payments in excess of $10,000,000. '.repeat(30),
  };
  const out = splitUmbrellaRepSections([materialContracts]);
  assert.equal(out.length, 1);
  assert.equal(out[0]._umbrellaChild, undefined);
});

test('sibling gate (Skechers): a long titled-subclause rep inside an already-segmented article is NOT split', () => {
  // Skechers-shaped: ~12 distinct per-topic REP-T sections (3.1–3.12), one of
  // which (IP) is long and internally uses titled lettered sub-clauses. The
  // umbrella pre-pass must NOT fire — the article is already segmented, and
  // splitting shreds one rep into a row per letter (REP-T hit 53).
  const siblings = Array.from({ length: 11 }, (_, i) => ({
    provision_type: 'REP-T',
    number: `3.${i + 1}`,
    title: `Rep Topic ${i + 1}`,
    startChar: i * 1000,
    text: `SECTION 3.${i + 1}. Rep Topic ${i + 1}. The Company represents and warrants accordingly.`,
  }));
  const longIp = sec({ number: '3.16', title: 'Intellectual Property' });
  const out = splitUmbrellaRepSections([...siblings, longIp]);
  assert.equal(out.length, 12);
  assert.ok(out.every((s) => !s._umbrellaChild && !s._umbrellaPreamble));
  assert.ok(out.includes(longIp), 'long IP rep passes through untouched');
});

test('sibling gate does not block the true umbrella case (few REP sections)', () => {
  // Old-style drafting: the whole reps article is ONE giant section (plus a
  // couple of stubs). The split must still fire.
  const stub = {
    provision_type: 'REP-T',
    number: '3.02',
    title: 'Brokers',
    startChar: 90000,
    text: 'SECTION 3.02. Brokers. No broker is entitled to any fee from the Company.',
  };
  const out = splitUmbrellaRepSections([sec(), stub]);
  assert.equal(out.filter((s) => s._umbrellaChild).length, 6);
});

test('non-REP sections are never touched', () => {
  const cov = { provision_type: 'COV', number: '5.01', startChar: 0, text: UMBRELLA_TEXT };
  const out = splitUmbrellaRepSections([cov]);
  assert.equal(out.length, 1);
  assert.equal(out[0], cov);
});
