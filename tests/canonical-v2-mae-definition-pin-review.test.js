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
// sites -- "Company Material Adverse Effect" means at byte 367,819 and
// "Parent Material Adverse Effect" means at byte 387,682. Each phrase appears
// exactly once. The document mentions "Material Adverse Effect" 77 times in
// total, so 75 of those are uses rather than definitions.
//
// CORRECTED 2026-08-07, and the correction is the point. The first version of
// this header gave those offsets as 366,186 and 385,847 while asserting they
// came from Buffer arithmetic rather than `indexOf` on a UTF-16 string. They
// did not: they were UTF-16 character indices, off by 1,642 and 1,843 bytes
// because the document's curly quotes and dashes are multi-byte. It also said
// "77 other mentions" when 77 is the total.
//
// The test CODE was right throughout -- `byteOffsetOf` below uses
// `Buffer.indexOf` and compares against byte spans -- so the verdict never
// depended on the wrong numbers. But CLAUDE.md records three prior confident
// false findings from exactly this confusion, and this was a fourth, stamped
// with a claim of immunity to it. The numbers are now asserted below rather
// than only stated, which is the only version that stays true.

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
// Byte offsets, verified with Buffer.indexOf. The UTF-16 character indices of
// the same phrases are 366,177 and 385,839 -- 1,642 and 1,843 lower, because
// the filing's curly quotes and dashes are multi-byte. If a future edit
// reintroduces those numbers, this test fails.
const EXPECTED_BYTE_OFFSETS = Object.freeze({ Company: 367819, Parent: 387682 });

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
  // 77 TOTAL, of which 2 are the definitions and 75 are uses. An earlier
  // version of this file's header called 77 the number of OTHER mentions.
  assert.equal(text.split('Material Adverse Effect').length - 1, 77);
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
    // Assert the recorded number, not just its containment. The header's
    // first version carried UTF-16 indices labelled as byte offsets and
    // nothing caught it, because containment holds either way.
    assert.equal(offset, EXPECTED_BYTE_OFFSETS[label], `${label} definition byte offset moved`);
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

// ─── Two more section facts, from the same read ──────────────────────────
//
// Ten of the 25 importable runs publish zero claims. That is not ten
// instances of the standing "a family returning zero can be correct" case,
// and telling the correct zeros from the defects needs the document. These
// pin the two that the document settles outright.

test('KEY_DEFINED_TERMS was pinned to the interpretation section, not the definitions', () => {
  // The finding behind the pin correction. 8.5 is construction conventions --
  // what "including" means, how "days" is counted -- and 8.12 is the defined
  // terms. A run pointed at 8.5 correctly proposes "include", "hereof",
  // "or", "days" and the like, every one of which falls out as an ungoverned
  // DEFINITION_ENVELOPE. The family looked broken and was mis-aimed.
  const tree = sectionizeAdmittedSource({
    source_text: modivCanonicalText(),
    document_hash: DOCUMENT_HASH,
  });
  const interpretation = findSectionByReference(tree, '8.5');
  const definitions = findSectionByReference(tree, '8.12');
  assert.equal(interpretation.heading, 'Interpretation; Certain Definitions');
  assert.equal(definitions.heading, 'Definitions');
  assert.ok(
    definitions.end - definitions.start > 10 * (interpretation.end - interpretation.start),
    'the definitions section is an order of magnitude larger; if that stops being true, re-read both',
  );

  const source = fs.readFileSync(path.join(REPO, 'scripts/canonical-v2-live-extraction-run.mjs'), 'utf8');
  const match = source.match(/KEY_DEFINED_TERMS: Object\.freeze\((\[[^\]]*\])\)/);
  assert.ok(match, 'could not locate the KEY_DEFINED_TERMS pin');
  const pinned = JSON.parse(match[1].replace(/'/g, '"'));
  assert.ok(pinned.includes('8.12'), 'the definitions section must be pinned for this family');
  assert.ok(pinned.includes('8.5'), '8.5 is kept: the committed baseline run used it');
});

test('APPRAISAL_DISSENTERS_RIGHTS finding nothing is the document, not the pipeline', () => {
  // Section 2.6 in full: "No dissenters' or appraisal rights shall be
  // available with respect to the Mergers." One sentence, 119 bytes. There is
  // nothing to extract, so zero is the only correct answer -- the same case
  // as guaranty on an unfinanced deal, and worth pinning because a zero that
  // is correct and a zero that is a defect look identical in a count.
  const text = modivCanonicalText();
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: DOCUMENT_HASH });
  const node = findSectionByReference(tree, '2.6');
  // Either apostrophe: the sectionizer's heading is ASCII-normalised while the
  // body keeps the filing's curly one. Asserting the wrong one reads as "the
  // section is not there", which is the opposite of what it would mean.
  assert.match(node.heading, /^Dissenters['’] Rights$/);
  assert.ok(node.end - node.start < 200, 'a one-sentence denial; if it grew, re-read it');
  const body = Buffer.from(text, 'utf8').slice(node.start, node.end).toString('utf8');
  assert.match(body, /No dissenters’ or appraisal rights shall be available/);
});
