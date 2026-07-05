const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { assertCoverage } = require('../lib/parser-v2/coverage');
const { REGION_TYPES } = require('../lib/parser-v2/regions');

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
EFFECTS OF THE MERGER

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

EXHIBIT A
FORM OF CERTIFICATE OF INCORPORATION
This exhibit is not operative merger-agreement body text.
`;

function parsedFixture() {
  const cleaned = cleanText(FIXTURE);
  return { cleaned, parsed: parseStructure(cleaned) };
}

test('parser hierarchy regions cover the full cleaned document exactly', () => {
  const { cleaned, parsed } = parsedFixture();
  const diagnostics = assertCoverage(parsed.regions, cleaned);
  assert.equal(diagnostics.complete, true);
  assert.equal(parsed.diagnostics.regionCoverageComplete, true);
  assert.equal(parsed.diagnostics.regionCoverageGaps.length, 0);
  assert.equal(parsed.diagnostics.regionCoverageOverlaps.length, 0);
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
  const { parsed } = parsedFixture();
  const appraisal = parsed.sections.find((section) => section.number === '3.04');
  assert.ok(appraisal);
  assert.equal(appraisal.title, 'No Appraisal Rights');
  assert.match(appraisal.text, /No appraisal rights shall be available/);
  assert.doesNotMatch(appraisal.text, /No Solicitation/);
});

test('parser hierarchy marks atomic NoSol and double-dummy equity sections without splitting the parent', () => {
  const { parsed } = parsedFixture();
  const equity = parsed.sections.find((section) => section.number === '3.02');
  assert.ok(equity);
  assert.equal(equity.atomic, true);
  assert.equal(equity.atomicReason, 'equity_awards');
  assert.equal(equity.needsDoubleDummyModel, true);
  assert.deepEqual(equity.subClauses.map((clause) => clause.label), ['a', 'b', 'c']);

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
});
