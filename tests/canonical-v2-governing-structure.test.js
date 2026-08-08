'use strict';

/**
 * Step 2X-A: resolveGoverningStructure + placement annotation.
 *
 * Proves fail-closed behaviour (same-style, span-crossing), markerless
 * section-only resolution, placement identity preservation, and pins the
 * six corpus mis-nest sections.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveGoverningStructure,
  buildSectionOutline,
  resolveTerminationLimbChapeauViaStructure,
  UNDETERMINED_REASONS,
  SEGMENTER_VERSION,
  MARKER_TIERS,
} = require('../lib/canonical-v2/native-producer/governing-structure');
const {
  annotateEntryStructureContext,
  annotateResolutionStructureContexts,
} = require('../lib/canonical-v2/native-producer/structure-placement');
const {
  MISNEST_SECTIONS,
  loadMisnestSectionText,
} = require('./fixtures/canonical-v2/step-2x-a-misnest-sections');
const { findStructuralMarkers } = require('../lib/parser-v2/subclauses');

test('RESOLVED: clean nested outline returns leaf + chapeau chain in UTF-8 bytes', () => {
  const sectionText = [
    'The Company shall not:',
    '(a) acquire any business;',
    '(b) do any of the following:',
    '(i) issue equity; or',
    '(ii) incur debt.',
  ].join('\n');

  const outline = buildSectionOutline(sectionText);
  const iiLeaf = outline.leaves.find((leaf) => leaf.path === 'b.ii');
  assert.ok(iiLeaf, 'expected b.ii leaf');

  const result = resolveGoverningStructure({
    sectionText,
    startByte: iiLeaf.start_byte,
    endByte: iiLeaf.end_byte,
    outline,
  });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.segmenter_version, SEGMENTER_VERSION);
  assert.equal(result.leaf.path, 'b.ii');
  assert.ok(result.chain.length >= 2, 'chain includes leaf and ancestors/chapeau');
  assert.equal(result.chain[0].path, 'b.ii');
  assert.equal(result.chain[result.chain.length - 1].path, null, 'chain ends at section chapeau');
  // Offsets are UTF-8 bytes into sectionText.
  assert.equal(typeof result.leaf.start_byte, 'number');
  assert.ok(result.leaf.end_byte > result.leaf.start_byte);
});

test('UNDETERMINED on same-style mis-nest (colon-restart signature)', () => {
  // Two colon-introduced lists: second (a) nests under (b) as b.a.
  const sectionText = [
    'The Company shall not:',
    '(a) first list item;',
    '(b) second list item;',
    'Parent shall not:',
    '(a) parent first;',
    '(b) parent second.',
  ].join('\n');

  const outline = buildSectionOutline(sectionText);
  assert.ok(outline.same_style_paths.length > 0, 'expected same-style paths');
  assert.ok(
    outline.same_style_paths.some((path) => path === 'b.a' || path.startsWith('b.a')),
    `expected b.a in same_style_paths, got ${outline.same_style_paths.join(',')}`,
  );

  const tainted = outline.leaves.find((leaf) => leaf.path === 'b.a');
  assert.ok(tainted, 'expected mis-nested b.a leaf');
  const result = resolveGoverningStructure({
    sectionText,
    startByte: tainted.start_byte,
    endByte: tainted.end_byte,
    outline,
  });
  assert.equal(result.status, 'UNDETERMINED');
  assert.equal(result.reason, UNDETERMINED_REASONS.SAME_STYLE_CHAIN);
});

test('UNDETERMINED on span that crosses leaf boundaries', () => {
  const sectionText = [
    'Chapeau text.',
    '(a) first limb text here;',
    '(b) second limb text here.',
  ].join('\n');
  const outline = buildSectionOutline(sectionText);
  const aLeaf = outline.leaves.find((leaf) => leaf.path === 'a');
  const bLeaf = outline.leaves.find((leaf) => leaf.path === 'b');
  assert.ok(aLeaf && bLeaf);

  const result = resolveGoverningStructure({
    sectionText,
    startByte: aLeaf.start_byte,
    endByte: bLeaf.end_byte,
    outline,
  });
  assert.equal(result.status, 'UNDETERMINED');
  assert.equal(result.reason, UNDETERMINED_REASONS.SPAN_CROSSES_LEAVES);
});

test('markerless section resolves as section-only context (not a silent absence)', () => {
  const sectionText = 'This section has no outline markers at all. Pure prose.';
  const outline = buildSectionOutline(sectionText);
  assert.equal(outline.markerless, true);
  assert.equal(outline.leaves.length, 1);
  assert.equal(outline.leaves[0].path, null);

  const result = resolveGoverningStructure({
    sectionText,
    startByte: 0,
    endByte: outline.total_bytes,
    outline,
  });
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.markerless, true);
  assert.equal(result.leaf.path, null);
  assert.equal(result.chain.length, 1);
  assert.equal(result.chain[0].path, null);
});

test('corroboration tiers distinguish line-anchored vs permissive markers', () => {
  // Line-anchored (a)/(b); inline permissive (A)/(B) after a colon mid-line.
  const sectionText = [
    '(a) Top level one;',
    '(b) Top level two with inline: (A) alpha; (B) bravo.',
  ].join('\n');
  const outline = buildSectionOutline(sectionText);
  const tiers = new Set(outline.marker_tiers.map((entry) => entry.tier));
  assert.ok(tiers.has(MARKER_TIERS.CORROBORATED) || tiers.has(MARKER_TIERS.LINE_ANCHORED_ONLY));
  // Inline (A)/(B) are permissive-only under line-anchored detector.
  const permissive = outline.marker_tiers.filter((entry) => entry.tier === MARKER_TIERS.PERMISSIVE_ONLY);
  assert.ok(permissive.length >= 1, 'expected at least one PERMISSIVE_ONLY inline marker');
});

test('termination structural adapter finds unique limb head and fails closed on duplicates', () => {
  const sectionText = [
    'This Agreement may be terminated:',
    '(a) by mutual written consent of the Company and Parent;',
    '(b) by written notice from the Company to Parent, if:',
    '(i) Parent breaches.',
  ].join('\n');
  const hit = resolveTerminationLimbChapeauViaStructure({ sectionText, letter: 'b' });
  assert.ok(hit);
  assert.match(hit.chapeau_text, /by written notice from the Company to Parent/i);
  assert.ok(hit.chapeau_text.endsWith(':') || hit.chapeau_text.includes(':'));

  const dup = [
    '(c) first occurrence if:',
    'some body',
    '(c) second occurrence if:',
  ].join('\n');
  assert.equal(resolveTerminationLimbChapeauViaStructure({ sectionText: dup, letter: 'c' }), null);
});

test('placement annotates structure_context without changing claim identity fields', () => {
  const sectionText = [
    'The Company shall not:',
    '(a) acquire any business;',
    '(b) issue equity.',
  ].join('\n');
  const outline = buildSectionOutline(sectionText);
  const aLeaf = outline.leaves.find((leaf) => leaf.path === 'a');

  const claimRevisionId = 'claim-rev-fixed-for-test';
  const claimOccurrenceId = 'claim-occ-fixed-for-test';
  const entry = Object.freeze({
    section_reference: '5.1',
    claim: Object.freeze({
      claim_revision_id: claimRevisionId,
      claim_occurrence_id: claimOccurrenceId,
      claim_definition_key: 'SOME_FLAT_ASSERTION',
      evidence: Object.freeze([
        Object.freeze({
          absolute_start: aLeaf.start_byte,
          absolute_end: aLeaf.end_byte,
          evidence_role: 'OPERATIVE_TEXT',
        }),
      ]),
    }),
  });

  const annotated = annotateEntryStructureContext(entry, {
    sectionTextByReference: new Map([['5.1', sectionText]]),
  });

  assert.equal(annotated.claim.claim_revision_id, claimRevisionId);
  assert.equal(annotated.claim.claim_occurrence_id, claimOccurrenceId);
  assert.equal(annotated.claim.claim_definition_key, 'SOME_FLAT_ASSERTION');
  assert.ok(annotated.structure_context);
  assert.equal(annotated.structure_context.status, 'RESOLVED');
  assert.equal(annotated.structure_context.annotation_only, true);
  assert.equal(annotated.structure_context.leaf.path, 'a');

  // Batch path: every entry gets a structure_context (never silently absent).
  const batch = annotateResolutionStructureContexts({
    resolved: [entry],
    review_queue: [entry],
    open_world: [{ section_reference: '5.1', claim: { evidence: [] } }],
    sectionTextByReference: new Map([['5.1', sectionText]]),
  });
  assert.ok(batch.resolved[0].structure_context);
  assert.ok(batch.review_queue[0].structure_context);
  assert.equal(batch.open_world[0].structure_context.status, 'UNDETERMINED');
  assert.equal(batch.open_world[0].structure_context.reason, UNDETERMINED_REASONS.NO_EVIDENCE_SPAN);
});

test('six pinned mis-nest sections each expose a same-style path the service refuses', () => {
  assert.equal(MISNEST_SECTIONS.length, 6);
  for (const entry of MISNEST_SECTIONS) {
    const sectionText = loadMisnestSectionText(entry);
    const outline = buildSectionOutline(sectionText);
    assert.ok(
      outline.same_style_paths.length > 0,
      `${entry.deal} ${entry.section_reference} should have same-style paths`,
    );

    const taintedLeaf = outline.leaves.find((leaf) => leaf.same_style_tainted);
    assert.ok(
      taintedLeaf,
      `${entry.deal} ${entry.section_reference} should have a tainted leaf`,
    );
    const result = resolveGoverningStructure({
      sectionText,
      startByte: taintedLeaf.start_byte,
      endByte: Math.max(taintedLeaf.start_byte + 1, taintedLeaf.end_byte),
      outline,
    });
    assert.equal(
      result.status,
      'UNDETERMINED',
      `${entry.deal} ${entry.section_reference} path=${taintedLeaf.path}`,
    );
    assert.equal(result.reason, UNDETERMINED_REASONS.SAME_STYLE_CHAIN);

    // findStructuralMarkers now stamps style — used by the detector.
    const markers = findStructuralMarkers(sectionText);
    assert.ok(markers.some((marker) => typeof marker.style === 'string'));
  }
});
