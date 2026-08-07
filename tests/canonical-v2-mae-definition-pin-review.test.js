// PLAN.md Step 2A required one thing be done by hand before the ladder
// trusts it: MAE_DEFINITION is the only family never run against Modiv, so
// its pinned section list is the stage-1 generator's PROPOSAL rather than
// human judgement harvested from a run that happened. Step 2A says read it
// against the document before trusting the result.
//
// This is that read, made mechanical so it cannot quietly stop being true.
//
// THE ANSWER: the proposal is right. Section 8.12 "Definitions" spans bytes
// 360,030 to 414,712 of the Modiv canonical text and contains BOTH definition
// sites -- "Company Material Adverse Effect" means (366,186) and "Parent
// Material Adverse Effect" means (385,847). No other definition site exists;
// the document's 77 other mentions of the phrase are uses, not definitions.
//
// Byte offsets throughout, matching the pipeline. The document is 8-bit clean
// in the region searched, but the offsets recorded here came from Buffer
// arithmetic, not from `indexOf` on a UTF-16 string, because mixing those has
// produced three separate confident false findings in this repository.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { retrievalPolicyDigestFor } = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');

const REPO = path.join(__dirname, '..');
const RAW_HTML = 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm';
const RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const DOCUMENT_HASH = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const PINNED_RETRIEVED_AT = '2026-08-01T15:05:49.024Z';

// Curly quotes, because the canonical text preserves the filing's own
// typography. A straight-quote search finds nothing and would read as "the
// document does not define it", which is the wrong conclusion from the right
// search.
const COMPANY_MAE_DEFINITION = '“Company Material Adverse Effect” means';
const PARENT_MAE_DEFINITION = '“Parent Material Adverse Effect” means';

let cached = null;
function modivCanonicalText() {
  if (cached) return cached;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: RETRIEVAL_URL,
    final_url: RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: PINNED_RETRIEVED_AT,
    retrieval_policy_digest: retrievalPolicyDigestFor('modiv'),
    redirect_count: 0,
    response_bytes: fs.readFileSync(path.join(REPO, RAW_HTML)),
  });
  cached = convertSecHtmlToCanonicalText(capture).canonical_text;
  return cached;
}

function byteOffsetOf(text, needle) {
  const bytes = Buffer.from(text, 'utf8');
  return bytes.indexOf(Buffer.from(needle, 'utf8'));
}

function pinnedMaeSectionRefs() {
  // Read out of the runner's source rather than exported, for the same reason
  // tests/canonical-v2-modiv-family-pins.test.js does: widening the script's
  // export surface purely so a test can see a constant is a product change
  // made for a test's convenience.
  const source = fs.readFileSync(path.join(REPO, 'scripts/canonical-v2-live-extraction-run.mjs'), 'utf8');
  const match = source.match(/MAE_DEFINITION: Object\.freeze\((\[[^\]]*\])\)/);
  assert.ok(match, 'could not locate the MAE_DEFINITION pin');
  return JSON.parse(match[1].replace(/'/g, '"'));
}

test('the document defines Company and Parent MAE exactly once each', () => {
  const text = modivCanonicalText();
  for (const definition of [COMPANY_MAE_DEFINITION, PARENT_MAE_DEFINITION]) {
    const occurrences = text.split(definition).length - 1;
    assert.equal(occurrences, 1, `${definition} should appear exactly once, found ${occurrences}`);
  }
});

test('the pinned section contains both MAE definitions', () => {
  // The whole review, in one assertion. If the generator's proposal were
  // wrong, or if the sectionizer's boundaries moved, this fails and the pin
  // needs re-reading rather than re-running.
  const text = modivCanonicalText();
  const refs = pinnedMaeSectionRefs();
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: DOCUMENT_HASH });

  const covering = refs
    .map((ref) => findSectionByReference(tree, ref))
    .filter(Boolean);
  assert.equal(covering.length, refs.length, `every pinned ref must resolve: ${refs.join(', ')}`);

  for (const [label, definition] of [
    ['Company', COMPANY_MAE_DEFINITION],
    ['Parent', PARENT_MAE_DEFINITION],
  ]) {
    const offset = byteOffsetOf(text, definition);
    assert.ok(offset > 0, `${label} MAE definition not found`);
    const inside = covering.some((node) => offset >= node.start && offset < node.end);
    assert.ok(
      inside,
      `${label} MAE definition at byte ${offset} falls outside the pinned section(s) `
      + covering.map((node) => `${node.heading} [${node.start}, ${node.end})`).join(', '),
    );
  }
});

test('the pinned section is the definitions section, and it is large', () => {
  // Recorded because it is a real cost fact, not a defect. 8.12 is the whole
  // definitions article at roughly 55 KB, so the MAE run is one expensive
  // call over a section that is mostly not about MAE. Narrowing the pin would
  // need evidence about how the producer behaves on a narrower anchor, which
  // does not exist until the family has run once. Pinning the section that
  // provably contains both definitions is the correct first move; this test
  // records why, so the size is not later mistaken for a mis-pin.
  const tree = sectionizeAdmittedSource({
    source_text: modivCanonicalText(),
    document_hash: DOCUMENT_HASH,
  });
  const node = findSectionByReference(tree, '8.12');
  assert.equal(node.heading, 'Definitions');
  assert.ok(node.end - node.start > 50000, 'if 8.12 got small, the sectionizer changed');
});
