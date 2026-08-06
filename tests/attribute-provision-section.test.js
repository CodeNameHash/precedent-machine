/* Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md)
 * Part 3 rollout gate 1's attribution-drift fix (docs/codex-program/ROADMAP.md
 * P5) — lib/parser-v2/attribute-provision-section.js, and its consumer,
 * scripts/span-residual-baseline.js's groupProvisionsBySection.
 *
 * The scenario every test in this file is built around: a provision was
 * extracted when its containing section started at some offset; a LATER,
 * unrelated reclassification run overwrote deals.metadata.classified_sections
 * with new section boundaries; the provision's own text never changed, but
 * its stored ai_metadata.startChar now disagrees with where its real section
 * currently starts (or, worse, now numerically falls inside a DIFFERENT
 * section entirely). Content-based attribution must survive this; the old
 * numeric-containment mechanism did not (2026-07-18 baseline: 470 of 952
 * flagged sections were this failure mode, not genuine extraction gaps).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attributeProvisionToSection,
  attributeProvisionsToSections,
} = require('../lib/parser-v2/attribute-provision-section');
const { computeSpanClaims } = require('../lib/parser-v2/span-claims');
const { groupProvisionsBySection } = require('../scripts/span-residual-baseline');

const COV_TEXT = '(a) Interim Operating Covenants. From the date hereof until the Effective '
  + 'Time, the Company shall conduct its business in the ordinary course '
  + 'consistent with past practice in all material respects.';

const MAE_TEXT = '(b) Absence of Material Adverse Effect. Since the Measurement Date, there '
  + 'has not occurred any event, change, or effect that would not have a '
  + 'Material Adverse Effect on the Company and its Subsidiaries, taken as a '
  + 'whole.';

const MAE_PROVISION_TEXT = 'there has not occurred any event, change, or effect that would not have a '
  + 'Material Adverse Effect on the Company and its Subsidiaries, taken as a whole.';

// The CURRENT classified_sections snapshot — as it stands NOW, after
// whatever reclassification run last overwrote it.
function currentSections() {
  const covStart = 1000;
  const maeStart = covStart + COV_TEXT.length + 40; // some inter-section gap
  return [
    { startChar: covStart, text: COV_TEXT },
    { startChar: maeStart, text: MAE_TEXT },
  ];
}

test('a provision whose stale startChar now numerically falls in the WRONG section still attributes to its real section by content', () => {
  const [covSection, maeSection] = currentSections();
  const sections = [covSection, maeSection];

  // STALE: stamped when the MAE section used to start here; after
  // reclassification this offset now sits inside the COV section's
  // CURRENT numeric range even though the text never moved.
  const staleStartChar = covSection.startChar + 5;
  assert.ok(
    staleStartChar < covSection.startChar + COV_TEXT.length,
    'fixture sanity: the stale offset really is inside the COV section numeric range',
  );

  const attributed = attributeProvisionToSection(sections, MAE_PROVISION_TEXT, staleStartChar);
  assert.equal(
    attributed.startChar,
    maeSection.startChar,
    'attributed by CONTENT to the MAE section, not the COV section the stale offset numerically points at',
  );
});

test('the drifted provision, attributed correctly and run through computeSpanClaims, is NOT flagged spanUnlocated', () => {
  const sections = currentSections();
  const staleStartChar = sections[0].startChar + 5; // drifted into the COV section, as above

  const attributed = attributeProvisionToSection(sections, MAE_PROVISION_TEXT, staleStartChar);
  const [claim] = computeSpanClaims(attributed.text, [{ text: MAE_PROVISION_TEXT }]);
  assert.equal(claim.spanUnlocated, false, 'correct attribution -> the item IS located -> no false fabrication flag');
});

test('fixture sanity: the OLD numeric-only mechanism would have picked the wrong section, and span-claims would have failed to locate the text there', () => {
  const sections = currentSections();
  // This is exactly what the pre-fix groupProvisionsBySection did: trust
  // the stale startChar's numeric position, full stop.
  const [wrongClaim] = computeSpanClaims(sections[0].text, [{ text: MAE_PROVISION_TEXT }]);
  assert.equal(wrongClaim.spanUnlocated, true, 'the stale-offset section genuinely does not contain this text');
});

test('a genuinely fabricated quote is still flagged spanUnlocated regardless of attribution', () => {
  const sections = currentSections();
  const fabricated = 'The Company shall pay Parent a termination fee of $500,000,000 in immediately available funds.';
  // No content match anywhere -> falls to the legacy numeric fallback,
  // which lands it in the MAE section here. Even so, the text genuinely
  // is not there.
  const attributed = attributeProvisionToSection(sections, fabricated, sections[1].startChar + 5);
  assert.ok(attributed, 'fixture sanity: the fallback still finds A section to test against');
  const [claim] = computeSpanClaims(attributed.text, [{ text: fabricated }]);
  assert.equal(claim.spanUnlocated, true, 'genuine fabrication is still caught — attribution fixes noise, not the real hallucination surface');
});

test('multiple sections containing the SAME text tie-break to the section closest to the stale offset', () => {
  const shared = 'shall be entitled to specific performance of this Agreement without the necessity of posting a bond.';
  const sections = [
    { startChar: 0, text: `(a) Remedies. Each party ${shared}` },
    { startChar: 5000, text: `(b) Further Remedies. Each party likewise ${shared}` },
  ];
  const near = attributeProvisionToSection(sections, shared, 4990);
  assert.equal(near.startChar, 5000);
  const far = attributeProvisionToSection(sections, shared, 10);
  assert.equal(far.startChar, 0);
});

test('multiple content matches with no stale offset at all fall back to document order, not an arbitrary pick', () => {
  const shared = 'shall be entitled to specific performance of this Agreement without the necessity of posting a bond.';
  const sections = [
    { startChar: 5000, text: `(b) Further Remedies. Each party likewise ${shared}` },
    { startChar: 0, text: `(a) Remedies. Each party ${shared}` },
  ];
  const attributed = attributeProvisionToSection(sections, shared, null);
  assert.equal(attributed.startChar, 0);
});

test('no content match and no stale offset returns null, not a guess', () => {
  const sections = currentSections();
  const attributed = attributeProvisionToSection(sections, 'this exact sentence appears nowhere in either section body text', null);
  assert.equal(attributed, null);
});

test('a too-short provision text is never matched (mirrors span-claims.js MIN_ITEM_CHARS) and falls back to numeric containment only', () => {
  const sections = currentSections();
  const attributed = attributeProvisionToSection(sections, 'short', sections[1].startChar + 5);
  assert.equal(attributed.startChar, sections[1].startChar, 'too short to content-match, so only the fallback applies');
});

test('attributeProvisionsToSections gives every section a Map entry, including empty ones', () => {
  const sections = currentSections();
  const map = attributeProvisionsToSections(sections, []);
  assert.equal(map.size, 2);
  assert.deepEqual(map.get(sections[0].startChar), []);
  assert.deepEqual(map.get(sections[1].startChar), []);
});

test('attributeProvisionsToSections accepts custom accessors for non-default provision shapes', () => {
  const sections = currentSections();
  const provisions = [{ text: MAE_PROVISION_TEXT, meta: { oldStart: sections[0].startChar + 5 } }];
  const map = attributeProvisionsToSections(sections, provisions, {
    textOf: (p) => p.text,
    staleStartCharOf: (p) => p.meta.oldStart,
  });
  assert.deepEqual(map.get(sections[1].startChar), provisions);
});

// ---------------------------------------------------------------------------
// The fixed script itself (scripts/span-residual-baseline.js), not just the
// underlying lib module — proves the corpus baseline (and any future
// backfill built the same way) actually gets the fix, in its real habitat.
// require()-ing the script must not attempt a Supabase connection: guarded
// by `if (require.main === module)` around its own main() call.
// ---------------------------------------------------------------------------

test('groupProvisionsBySection (span-residual-baseline.js) attributes a drifted provision to its real current section, not its stale numeric one', () => {
  const sections = currentSections();
  const provisions = [
    { full_text: MAE_PROVISION_TEXT, ai_metadata: { startChar: sections[0].startChar + 5 } }, // drifted into COV
  ];
  const bySection = groupProvisionsBySection(sections, provisions);
  assert.deepEqual(bySection.get(sections[0].startChar), [], 'the COV section (the stale numeric home) gets nothing');
  assert.deepEqual(bySection.get(sections[1].startChar), [MAE_PROVISION_TEXT], 'the MAE section (the real content home) gets the provision');
});

test('groupProvisionsBySection still returns an entry (possibly empty) for every input section', () => {
  const sections = currentSections();
  const bySection = groupProvisionsBySection(sections, []);
  assert.equal(bySection.size, 2);
});

test('groupProvisionsBySection drops a provision with no startChar and no content match, rather than mis-attributing it', () => {
  const sections = currentSections();
  const provisions = [{ full_text: 'a sentence with no relationship to either section and no stored offset at all here', ai_metadata: {} }];
  const bySection = groupProvisionsBySection(sections, provisions);
  assert.deepEqual(bySection.get(sections[0].startChar), []);
  assert.deepEqual(bySection.get(sections[1].startChar), []);
});
