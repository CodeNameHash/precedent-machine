const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { assertCoverage, findUncovered, findOverlaps, mergeAdjacent } = require('../lib/parser-v2/coverage');
const { REGION_TYPES } = require('../lib/parser-v2/regions');
const regions = require('../lib/parser-v2/regions');
const { analyzeDefinitionCompleteness, findDefinitionUnits } = require('../lib/parser-v2/regions/definitions');
const { atomicRuleForSection } = require('../lib/parser-v2/regions/atomic');
const { detectDoubleDummyEquity } = require('../lib/parser-v2/regions/double-dummy');

const FIXTURE = `
AGREEMENT AND PLAN OF MERGER

TABLE OF CONTENTS
Section 1.01 The Merger 1
Section 3.02 Treatment of Company Equity Awards 12
Section 3.04 No Appraisal Rights 14
Section 5.03 No Solicitation 28

AGREEMENT AND PLAN OF MERGER, dated as of July 1, 2020, by and among Parent, Merger Sub and the Company.

WHEREAS, the parties desire to combine their businesses.

NOW, THEREFORE, in consideration of the foregoing, the parties agree as follows:

ARTICLE I
THE MERGER

SECTION 1.01. The Merger. Upon the terms and subject to the conditions set forth in this Agreement, Merger Sub shall merge with and into the Company, with the Company surviving the Merger.

ARTICLE III
EFFECTS OF THE
MERGER ON THE CAPITAL STOCK OF THE COMPANY AND MERGER SUB; EXCHANGE

SECTION 3.02. Treatment of Company Equity Awards. (a) Each Company Stock Option shall be converted into a Parent Stock Award on substantially equivalent terms. (b) Each Company restricted stock unit shall be assumed by Parent and converted into a Parent restricted stock unit. (c) Each Company performance stock unit shall be converted into a Parent performance stock unit.

SECTION 3.03. Exchange and Payment. (a) Parent shall appoint an exchange agent. (b) Parent shall deposit the merger consideration with the exchange agent.

SECTION 3.04. No Appraisal Rights. No appraisal rights shall be available with respect to the Merger or the other transactions contemplated hereby.

ARTICLE V
COVENANTS

SECTION 5.03. No Solicitation. (a) The Company shall not solicit, initiate or knowingly encourage any Acquisition Proposal. (b) The Company may furnish information in response to a Superior Proposal subject to the terms of this Section 5.03. (c) The Company shall notify Parent promptly of any Acquisition Proposal.

ARTICLE IX
DEFINITIONS

SECTION 9.01. Definitions. "Affiliate" means any person that controls another person. "Company Material Adverse Effect" means any event that would reasonably be expected to have a material adverse effect on the Company, except that (b) changes in general economic conditions shall be excluded.

IN WITNESS WHEREOF, the parties have executed this Agreement.

/s/ Parent

ANNEX A
Certain Definitions

"Company Competing Proposal" means any proposal involving, directly or indirectly, (a) any acquisition of assets, (b) any acquisition of beneficial ownership of equity securities or (c) any merger or similar transaction involving the Company.

EXHIBIT A
FORM OF CERTIFICATE OF INCORPORATION
This exhibit is not operative merger-agreement body text.
`;

function parsedFixture() {
  const cleaned = cleanText(FIXTURE);
  return { cleaned, parsed: parseStructure(cleaned) };
}

test('cleanText normalizes SEC narrow no-break spaces before section titles', () => {
  const cleaned = cleanText('3.2\u202f\u202fTreatment of Equity Compensation Awards.');
  assert.doesNotMatch(cleaned, /\u202f/);
  assert.match(cleaned, /3\.2 +Treatment/);
});

test('parser hierarchy regions cover the full cleaned document exactly', () => {
  const { cleaned, parsed } = parsedFixture();
  const diagnostics = assertCoverage(parsed.regions, cleaned);
  assert.equal(diagnostics.complete, true);
  assert.equal(parsed.diagnostics.regionCoverageComplete, true);
  assert.equal(parsed.diagnostics.regionCoverageGaps.length, 0);
  assert.equal(parsed.diagnostics.regionCoverageOverlaps.length, 0);
});

test('parser hierarchy exports the WP helper API names', () => {
  assert.equal(typeof regions.isProvisionType, 'function');
  assert.equal(typeof regions.isPreambleType, 'function');
  assert.equal(typeof regions.isBackmatterType, 'function');
  assert.equal(typeof regions.isClassifiable, 'function');
  assert.equal(REGION_TYPES.BACKMATTER_UNCLASSIFIED, 'backmatter.unclassified');
  assert.deepEqual(findUncovered([{ type: 'x', start: 0, end: 5 }], 8), [
    { start: 5, end: 8, length: 3 },
  ]);
  assert.equal(findOverlaps([{ type: 'x', start: 0, end: 5 }, { type: 'x', start: 3, end: 7 }]).length, 1);
  assert.equal(mergeAdjacent([{ type: 'x', start: 0, end: 2 }, { type: 'x', start: 2, end: 5 }])[0].end, 5);
});

test('parser hierarchy types frontmatter and backmatter outside the reviewable body gap queue', () => {
  const { parsed } = parsedFixture();
  const types = new Set(parsed.regions.map((region) => region.type));
  assert.equal(types.has(REGION_TYPES.PREAMBLE_TOC), true);
  assert.equal(types.has(REGION_TYPES.PREAMBLE_RECITALS), true);
  assert.equal(types.has(REGION_TYPES.PREAMBLE_ENACTING), true);
  assert.equal(types.has(REGION_TYPES.BACKMATTER_SIGNATURES), true);
  assert.equal(types.has(REGION_TYPES.BACKMATTER_EXHIBIT), true);
});

test('parser hierarchy keeps short clean sections and hard article boundaries', () => {
  const { cleaned, parsed } = parsedFixture();
  const appraisal = parsed.sections.find((section) => section.number === '3.04');
  assert.ok(appraisal);
  assert.equal(appraisal.title, 'No Appraisal Rights');
  assert.match(appraisal.text, /No appraisal rights shall be available/);
  assert.doesNotMatch(appraisal.text, /No Solicitation/);

  assert.equal(
    parsed.regions.some((region) => (
      region.type === REGION_TYPES.BODY_SECTION_UNASSIGNED &&
      /MERGER ON THE CAPITAL STOCK/.test(cleaned.slice(region.start, region.end))
    )),
    false,
  );
});

test('parser hierarchy marks atomic NoSol, equity, and exchange sections without splitting the parent', () => {
  const { parsed } = parsedFixture();
  const equity = parsed.sections.find((section) => section.number === '3.02');
  assert.ok(equity);
  assert.equal(equity.atomic, true);
  assert.equal(equity.atomicReason, 'equity_awards');
  assert.equal(equity.needsDoubleDummyModel, true);
  assert.deepEqual(equity.subClauses.map((clause) => clause.label), ['a', 'b', 'c']);

  const exchange = parsed.sections.find((section) => section.number === '3.03');
  assert.ok(exchange);
  assert.equal(exchange.atomic, true);
  assert.equal(exchange.atomicReason, 'payment_exchange');

  const nosol = parsed.sections.find((section) => section.number === '5.03');
  assert.ok(nosol);
  assert.equal(nosol.atomic, true);
  assert.equal(nosol.atomicReason, 'nosol');
  assert.deepEqual(nosol.subClauses.map((clause) => clause.label), ['a', 'b', 'c']);
});

test('parser hierarchy treats definitions as definition regions and flags mid-sliced definition patterns', () => {
  const { parsed } = parsedFixture();
  const definitions = parsed.sections.find((section) => section.number === '9.01');
  assert.ok(definitions);
  assert.equal(definitions.regionType, REGION_TYPES.BODY_SECTION_DEFINITION);
  assert.ok(definitions.definitionCompletenessWarnings.some((warning) => warning.code === 'definition-mid-slice'));

  const annexDefinitions = parsed.sections.find((section) => section.number === 'Annex-A');
  assert.ok(annexDefinitions);
  assert.equal(annexDefinitions.regionType, REGION_TYPES.BODY_SECTION_DEFINITION);
  assert.equal(annexDefinitions.title, 'Certain Definitions');
  assert.equal(annexDefinitions.needsDoubleDummyModel, undefined);
  assert.doesNotMatch(annexDefinitions.text, /FORM OF CERTIFICATE OF INCORPORATION/);
});

test('definition completeness ignores defined-elsewhere index tables', () => {
  const warnings = analyzeDefinitionCompleteness({
    title: 'Terms Defined Elsewhere',
    articleTitle: 'Definitions',
    text: '1.2 Terms Defined Elsewhere. As used in this Agreement, the following capitalized terms are defined in this Agreement as referenced in the following table: Definition Section Agreement Preamble Antitrust Laws 6.8(b) Parent Material Adverse Effect 4.1(a)',
  });

  assert.deepEqual(warnings, []);
});

test('definition units can be semicolon-separated in one paragraph', () => {
  const units = findDefinitionUnits(
    '"Affiliate" means any person that controls another person; "Business Day" means any day other than Saturday or Sunday; "Company Competing Proposal" means any proposal involving (b) equity securities.',
  );

  assert.deepEqual(units.map((unit) => unit.term), [
    'Affiliate',
    'Business Day',
    'Company Competing Proposal',
  ]);
});

test('defined-elsewhere tables do not create phantom section headings', () => {
  const longTableLead = 'Additional explanatory index text. '.repeat(45);
  const cleaned = cleanText(`
ARTICLE IX
DEFINITIONS

Section 9.3. Certain Definitions. "Transfer Taxes" means transfer taxes.

Section 9.4. Terms Defined Elsewhere. For purposes of this Agreement each of the following terms when used in this Agreement will have the meaning ascribed to such term in the Section set forth opposite such term:
${longTableLead}

Closing Date

Section 2.2

Code

Section 3.6

Company

Preamble

Section 9.5. Severability. If any term is invalid, the remaining provisions will be enforced.
`);
  const parsed = parseStructure(cleaned);
  const terms = parsed.sections.find((section) => section.number === '9.4');

  assert.ok(terms);
  assert.match(terms.text, /Closing Date/);
  assert.match(terms.text, /Section 2\.2/);
  assert.equal(terms.regionType, REGION_TYPES.BODY_SECTION_DEFINITION);
  assert.equal(parsed.sections.some((section) => section.number === '2.2'), false);
  assert.equal(parsed.regions.some((region) => region.type === REGION_TYPES.BODY_SECTION_UNASSIGNED), false);
});

test('standalone Section line followed by title line remains a real heading', () => {
  const cleaned = cleanText(`
AGREEMENT AND PLAN OF MERGER

NOW, THEREFORE, the parties agree as follows:

ARTICLE V
COVENANTS

Section 5.1
Conduct of Business
The Company shall operate in ordinary course.

Section 5.2
No Solicitation
The Company shall not solicit Acquisition Proposals.
`);
  const parsed = parseStructure(cleaned);

  assert.deepEqual(parsed.sections.map((section) => section.number), ['5.1', '5.2']);
  assert.equal(parsed.sections[0].title, 'Conduct of Business');
  assert.equal(parsed.sections[1].title, 'No Solicitation');
});

test('double-dummy detector is independent of the narrower atomic rules', () => {
  const atomicRule = atomicRuleForSection({
    title: 'Company Stock Options',
    text: 'Each Company Option shall be converted into a Parent Option and assumed by Parent.',
  });

  assert.equal(atomicRule, null);
  assert.equal(detectDoubleDummyEquity({
    title: 'Company Stock Options',
    text: 'Each Company Option shall be converted into a Parent Option and assumed by Parent.',
  }), true);
});

test('atomic rules do not fire on incidental stock, fee, or insurance references', () => {
  for (const title of [
    'Information Supplied',
    'Brokers',
    'HSR and Other Approvals',
    "Indemnification; Directors' and Officers' Insurance",
    'Entire Agreement; No Third Party Beneficiaries',
  ]) {
    assert.equal(atomicRuleForSection({ title, text: 'Parent Common Stock fees and expenses.' }), null);
  }
});
