const test = require('node:test');
const assert = require('node:assert/strict');

const { detectHeadMatter, detectAncillaryRegions, normalizeForMatch } = require('../../lib/verification');

// Coverage-denominator exclusions (2026-07-17): head matter (cover page +
// TOC) and earlier-anchored signature stacks. Both were inflating the
// denominator on Cox / M.D.C. / Forest City / CSRA — deals whose extraction
// was fine but whose filings carry 40k-390k chars of non-provision matter.

function pad(label, n) {
  return `${label} filler sentence about procedural mechanics. `.repeat(Math.ceil(n / 48)).slice(0, n);
}

test('detectHeadMatter excludes cover page + TOC, keeps the operative preamble', () => {
  const cover = 'exhibit 2.1 agreement and plan of merger by and among alpha inc., beta llc dated as of may 1, 2026 ';
  const toc = `table of contents article i the merger 1 article ii conversion of shares 5 ${pad('toc', 2500)} `;
  const preamble = 'this agreement and plan of merger is entered into as of may 1, 2026, by and among alpha inc. and beta llc. ';
  const recitals = 'recitals whereas the board of directors of the company has approved this agreement; now, therefore, the parties agree as follows: ';
  const body = pad('body', 8000);
  const norm = normalizeForMatch(cover + toc + preamble + recitals + body);
  const regions = detectHeadMatter(norm);
  assert.equal(regions.length, 1);
  const [start, end, label] = regions[0];
  assert.equal(start, 0);
  assert.equal(label, 'cover/toc');
  // Head end must land at the operative preamble — after the TOC, before the recitals.
  const preambleIdx = norm.indexOf('this agreement and plan of merger is entered into');
  assert.ok(Math.abs(end - preambleIdx) < 50, `head end ${end} should be ~${preambleIdx}`);
});

test('detectHeadMatter excludes nothing when the doc opens on its preamble', () => {
  const norm = normalizeForMatch(
    'agreement and plan of merger dated as of may 1, 2026 now, therefore, the parties agree as follows: ' + pad('body', 6000),
  );
  assert.deepEqual(detectHeadMatter(norm), []);
});

test('detectAncillaryRegions anchors on the EARLIEST signature marker', () => {
  // "[signature page to ...]" markers open the signature stack well before
  // the first "in witness whereof" (which belongs to an attached agreement).
  const body = pad('body', 60000);
  const sigStack = '[signature page to agreement and plan of merger] by: /s/ someone name: someone title: ceo ';
  const attached = `voting agreement this voting agreement is made and entered into by and among alpha inc. and the stockholders ${pad('voting', 12000)} in witness whereof, the parties have caused this agreement to be executed. `;
  const norm = normalizeForMatch(body + sigStack + attached);
  const regions = detectAncillaryRegions(norm);
  assert.ok(regions.length >= 1, 'expected an excluded tail');
  const sigIdx = norm.indexOf('[signature page to');
  assert.ok(regions[0][0] <= sigIdx + 5, `exclusion should start at/before the sig-page marker (${regions[0][0]} vs ${sigIdx})`);
});
