'use strict';

/**
 * tests/canonical-v2-termination-limb-chapeau-structure-swap.test.js
 *
 * DECISIONS.md §15 — Termination adapter swap (structural half only).
 *
 * Proves:
 *   (a) live `findTerminationLimbChapeau` spans are byte-identical to the
 *       pinned Modiv 7.1 / Concho 8.1 / TopBuild 6.2 fixtures;
 *   (b) direction grammar + capacity comparison stayed in
 *       candidate-resolution.js (a unit that breaks if those were wrongly
 *       absorbed into governing-structure.js);
 *   (c) adapter UNDETERMINED / null never falls back to a local structural
 *       guess in the live wrapper.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  findTerminationLimbChapeau,
  parseTerminationLimbDirection,
  findTerminationLimbGrantContext,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  resolveTerminationLimbChapeauViaStructure,
} = require('../lib/canonical-v2/native-producer/governing-structure');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-rights-family');
const PARITY = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_DIR, 'termination-limb-chapeau-structural-parity.json'), 'utf8'),
);

function loadSection(fixtureFile) {
  return fs.readFileSync(path.join(FIXTURE_DIR, fixtureFile), 'utf8');
}

function admittedContextForSection(sectionText) {
  const digest = sha256Hex(Buffer.from(sectionText, 'utf8'));
  return {
    canonical_text: { text: sectionText, canonical_text_id: digest },
    canonical_text_id: digest,
  };
}

test('pinned parity fixture schema and section digests match committed section files', () => {
  assert.equal(PARITY.schema, 'TERMINATION_LIMB_CHAPEAU_STRUCTURAL_PARITY/V1');
  assert.equal(PARITY.sections.length, 3);
  for (const section of PARITY.sections) {
    const text = loadSection(section.fixture_file);
    assert.equal(
      sha256Hex(Buffer.from(text, 'utf8')),
      section.section_sha256,
      `${section.deal} ${section.section_reference} section file digest`,
    );
  }
});

test('(a) structural spans: findTerminationLimbChapeau matches pinned Modiv/Concho/TopBuild chapeaux byte-for-byte', () => {
  let compared = 0;
  for (const section of PARITY.sections) {
    const sectionText = loadSection(section.fixture_file);
    const admittedSourceContext = admittedContextForSection(sectionText);
    const sectionSpan = { start: 0, end: Buffer.byteLength(sectionText, 'utf8') };

    for (const [letter, pinned] of Object.entries(section.chapeaux)) {
      const live = findTerminationLimbChapeau({
        section: sectionSpan,
        admittedSourceContext,
        sectionReference: section.section_reference,
        citationReference: `${section.section_reference}(${letter})`,
      });
      assert.ok(live, `${section.deal} ${section.section_reference}(${letter}) must resolve`);
      assert.equal(
        live.chapeau_text,
        pinned.chapeau_text,
        `${section.deal} (${letter}) chapeau_text`,
      );
      assert.ok(
        Buffer.from(live.chapeau_text, 'utf8').equals(Buffer.from(pinned.chapeau_text, 'utf8')),
        `${section.deal} (${letter}) UTF-8 bytes`,
      );
      assert.equal(live.span.absolute_start, pinned.start_byte);
      assert.equal(live.span.absolute_end, pinned.end_byte);
      assert.equal(sha256Hex(Buffer.from(live.chapeau_text, 'utf8')), pinned.chapeau_sha256);

      const adapter = resolveTerminationLimbChapeauViaStructure({
        sectionText,
        letter,
      });
      assert.ok(adapter);
      assert.equal(adapter.chapeau_text, pinned.chapeau_text);
      assert.equal(adapter.start_byte, pinned.start_byte);
      assert.equal(adapter.end_byte, pinned.end_byte);
      compared += 1;
    }
  }
  assert.equal(compared, 14, '4 Modiv + 6 Concho + 4 TopBuild pinned limbs');
});

test('(b) direction grammar stays in candidate-resolution — adapter has no party/capacity parse', () => {
  const adapterSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'canonical-v2', 'native-producer', 'governing-structure.js'),
    'utf8',
  );
  // Match executable definitions / requires, not comment mentions of the
  // semantic half that deliberately stay in candidate-resolution.js.
  assert.equal(/\bfunction\s+parseTerminationLimbDirection\b/.test(adapterSource), false);
  assert.equal(/\bTERMINATION_LIMB_FROM_TO_PATTERN\b/.test(adapterSource), false);
  assert.equal(/\bTERMINATION_LIMB_BARE_BY_PATTERN\b/.test(adapterSource), false);
  assert.equal(/\bTERMINATION_LIMB_EITHER_PATTERN\b/.test(adapterSource), false);
  assert.equal(/\bfunction\s+resolvePartyCapacity\b/.test(adapterSource), false);
  assert.equal(/\bfunction\s+findTerminationLimbGrantContext\b/.test(adapterSource), false);
  assert.equal(/require\(['"]\.\/candidate-resolution['"]\)/.test(adapterSource), false);

  const resolutionSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'canonical-v2', 'native-producer', 'candidate-resolution.js'),
    'utf8',
  );
  assert.ok(resolutionSource.includes('function parseTerminationLimbDirection'));
  assert.ok(resolutionSource.includes('function findTerminationLimbGrantContext'));
  assert.ok(resolutionSource.includes('resolveTerminationLimbChapeauViaStructure'));

  // Adapter return shape is structural only — no direction fields.
  const modiv = PARITY.sections.find((entry) => entry.deal === 'modiv');
  const sectionText = loadSection(modiv.fixture_file);
  const hit = resolveTerminationLimbChapeauViaStructure({ sectionText, letter: 'd' });
  assert.ok(hit);
  assert.equal(Object.prototype.hasOwnProperty.call(hit, 'outcome'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(hit, 'granting_party'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(hit, 'party_a'), false);

  // Capacity comparison still lives on the grant-context path: Parent is
  // granted on (d); claiming the Company on the same limb must fail closed.
  const admittedSourceContext = admittedContextForSection(sectionText);
  const sectionSpan = { start: 0, end: Buffer.byteLength(sectionText, 'utf8') };
  assert.ok(findTerminationLimbGrantContext({
    section: sectionSpan,
    admittedSourceContext,
    sectionReference: '7.1',
    citationReference: '7.1(d)(ii)',
    terminatingPartyRef: 'Parent',
    partyScope: 'ONE_PARTY',
  }));
  assert.equal(findTerminationLimbGrantContext({
    section: sectionSpan,
    admittedSourceContext,
    sectionReference: '7.1',
    citationReference: '7.1(d)(ii)',
    terminatingPartyRef: 'the Company',
    partyScope: 'ONE_PARTY',
  }), null);

  // Direction parse still distinguishes Modiv's real heads (would be lost if
  // grammar were deleted from candidate-resolution after a "move").
  assert.deepEqual(
    parseTerminationLimbDirection('(d) by written notice from Parent to the Company, if:'),
    { outcome: 'ONE_PARTY', granting_party: 'Parent' },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by either the Company, on the one hand, or Parent, on the other hand, by written notice to the other, if:'),
    {
      outcome: 'EITHER_PARTY',
      party_a: 'the Company',
      party_b: 'Parent',
      either_phrase: 'either the Company, on the one hand, or Parent, on the other hand',
    },
  );
});

test('(c) fail closed: adapter null / no letter → findTerminationLimbChapeau null (no local structural fallback)', () => {
  const sectionText = loadSection('modiv-section-7.1.txt');
  const admittedSourceContext = admittedContextForSection(sectionText);
  const sectionSpan = { start: 0, end: Buffer.byteLength(sectionText, 'utf8') };

  assert.equal(findTerminationLimbChapeau({
    section: sectionSpan,
    admittedSourceContext,
    sectionReference: '7.1',
    citationReference: '7.1(z)',
  }), null);

  assert.equal(findTerminationLimbChapeau({
    section: sectionSpan,
    admittedSourceContext,
    sectionReference: '7.1',
    citationReference: '7.1',
  }), null);

  // Live wrapper body must not re-implement marker/colon structural logic.
  const resolutionSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'canonical-v2', 'native-producer', 'candidate-resolution.js'),
    'utf8',
  );
  const fnStart = resolutionSource.indexOf('function findTerminationLimbChapeau({');
  const fnEnd = resolutionSource.indexOf('\nfunction parseTerminationLimbDirection', fnStart);
  assert.ok(fnStart >= 0 && fnEnd > fnStart);
  const wrapperBody = resolutionSource.slice(fnStart, fnEnd);
  assert.ok(wrapperBody.includes('resolveTerminationLimbChapeauViaStructure'));
  assert.equal(wrapperBody.includes('markerPattern'), false);
  assert.equal(wrapperBody.includes("indexOf(':')"), false);
  assert.equal(wrapperBody.includes("indexOf(';')"), false);
});
