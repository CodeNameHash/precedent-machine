'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  NativeUnifiedRunValidationError,
  validateUnifiedRunManifestDiagnostic,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const {
  sectionizeAdmittedSource,
  findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
);

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

test('M3 12-call pilot manifest validates locally with exact source and section pins', () => {
  const result = validateUnifiedRunManifestDiagnostic({
    manifest: loadManifest(),
    root_dir: ROOT,
  });
  assert.equal(result.receipt.source_count, 3);
  assert.equal(result.receipt.work_item_count, 12);
  assert.equal(result.receipt.authority, 'NONE');
  assert.equal(result.diagnostic_manifest.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(result.diagnostic_manifest.work_item_diagnostics.filter((item) => (
    item.diagnostic_state === 'EXTRACT_CANDIDATE_PENDING_TRUSTED_SOURCE_ADMISSION'
  )).length, 12);
});

test('M3 12-call pilot binds the two non-title family assignments directly', () => {
  const manifest = loadManifest();
  const items = new Map(manifest.work_items.map((item) => [item.work_item_id, item]));
  assert.deepEqual(items.get('modiv-mae-definition-8-12-g'), {
    work_item_id: 'modiv-mae-definition-8-12-g',
    source_id: 'modiv-full',
    family_id: 'MAE_DEFINITION',
    disposition: 'EXTRACT',
    section_pin: {
      section_reference: '8.12(g)',
      section_id: '8a1d973242979ca8e254302f9f3f3024f2c8e7f57f11d6b58450077542475e96',
      section_kind: 'SUBSECTION',
      section_text_sha256: '0dec194d9d833eea3006a6cee3b74e7ab58961dd39f9a0932343b3eeb808643c',
    },
  });
  assert.equal(items.get('modiv-antitrust-consents-5-5').family_id, 'ANTITRUST_REGULATORY');
});

test('M3 12-call pilot admits recorded TopBuild context with explicit identity and section pins', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  assert.deepEqual(source, {
    source_id: 'topbuild-full',
    disposition: 'ADMITTED_RECORDED',
    recorded_admitted_source_context_path: 'tests/fixtures/canonical-v2/f28-third-live-run/adapter-result.json',
    admitted_semantic_source_context_id: 'b069039c65512a01b0be43396e9c0c25c0eff925867f0eec7a173862e7cfc352',
    admitted_source_reference: {
      schema_version: 'ADMITTED_SOURCE_REFERENCE/V1',
      immutable_source_document_id: '6a0b0c1eee2035ea01fbaa272008b11d99c9ccabc10d3d3810c5c8d68a2613a7',
      source_admission_manifest_id: 'b2eca29a562812f4d7993953b29d8ab0329d7673ade908439b2875b24b373558',
      semantic_extraction_input_envelope_id: '7c2eab4c41a724c432ef42546e5ea072f02e58a6d7ded73e141a5e666f2863db',
      canonical_text_id: 'b7b42f06a162d29be7c34ae7cc15fae6686add86310d9afd715bf6cab3055676',
      governed_deal_key: 'deal:f28-third-live-run:e552449e17bebcd1',
      deal_admission_id: 'd0e3649379240a201bfb9fd58dc4be998b3c83980c48b0618dbdf8db4ee5287a',
      source_ordinal: 0,
    },
    canonical_text_sha256: '7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d',
    canonical_text_byte_length: 412860,
    document_hash: '146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f',
  });
  const topbuildItems = manifest.work_items.filter((item) => item.source_id === 'topbuild-full');
  assert.equal(topbuildItems.length, 5);
  assert.ok(topbuildItems.every((item) => item.disposition === 'EXTRACT' && item.section_pin));
  assert.deepEqual(manifest.work_items.find((item) => item.work_item_id === 'topbuild-capitalisation-3-1-b'), {
    work_item_id: 'topbuild-capitalisation-3-1-b',
    source_id: 'topbuild-full',
    family_id: 'CAPITALISATION',
    disposition: 'EXTRACT',
    section_pin: {
      // Corrected with the manifest's own pin: same bytes, same
      // section_text_sha256, real reference instead of the phantom lettered
      // child the old 78-character heading cap produced. See the comment above
      // the Capital Structure test below for the full reasoning.
      section_reference: '3.1(b)',
      section_id: '66f01432485170a2d87fffaf6139e0b7f6c6dd380bfdc0550f76c2bad4dba418',
      section_kind: 'SUBSECTION',
      section_text_sha256: 'ab4ce66d8e07577673bf4ea1f99838b21bd518786778e8511c71efab3df30487',
    },
  });
  const result = validateUnifiedRunManifestDiagnostic({ manifest, root_dir: ROOT });
  const diagnostic = result.diagnostic_manifest.source_diagnostics.find((entry) => entry.source_id === 'topbuild-full');
  assert.equal(diagnostic.authority, 'NONE');
});

test('M3 12-call pilot rejects a recorded TopBuild context whose explicit pins drift', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  source.canonical_text_sha256 = '0'.repeat(64);
  assert.throws(
    () => validateUnifiedRunManifestDiagnostic({ manifest, root_dir: ROOT }),
    (error) => error instanceof NativeUnifiedRunValidationError
      && error.code === 'RECORDED_CONTEXT_PIN_MISMATCH',
  );
});

test('M3 12-call pilot never turns a caller-modified recorded source reference into executable authority', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  source.admitted_source_reference.canonical_text_id = '0'.repeat(64);
  assert.throws(
    () => require('../lib/canonical-v2/native-producer/unified-runner-validate').validateUnifiedRunManifest({ manifest }),
    (error) => error instanceof NativeUnifiedRunValidationError
      && error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

// Reference corrected on 2026-08-05, byte range untouched. This test used to
// address the Capital Structure subsection as "III-INTRO(b)". That label was a
// phantom: the sectionizer's heading pattern capped section titles at 78
// characters, TopBuild's Sections 3.1 and 3.2 have longer titles, so neither
// was ever recognised and the Article III chapeau kept the whole article and
// minted lettered children of its own. Raising the cap makes the real sections
// appear and the phantom disappear.
//
// The pin moved because the tree was wrong, not because the bytes were. The
// start and end offsets below are unchanged, and text_sha256 is byte-identical
// to what this test pinned before, which is the proof that the same span of
// the agreement is being addressed. Only section_id moves, because it derives
// from the reference. The manifest work item was already called
// "topbuild-capitalisation-3-1-b", so 3.1(b) is the name everyone had been
// using for it anyway.
//
// The correction also separates two things the phantom had merged: there are
// now both a 3.1(b) and a 3.2(b) Capital Structure representation, the
// Company's and Parent's, which a single III-INTRO(b) could not distinguish.
test('M3 TopBuild capitalisation pin is the exact Capital Structure subsection, not the whole of Article III', () => {
  const recorded = JSON.parse(fs.readFileSync(path.join(
    ROOT,
    'tests/fixtures/canonical-v2/f28-third-live-run/adapter-result.json',
  ), 'utf8'));
  const context = recorded.admitted_source_contexts[0];
  const tree = sectionizeAdmittedSource({
    source_text: context.canonical_text.text,
    document_hash: context.document_hash,
  });
  const capital = findSectionByReference(tree, '3.1(b)');
  const article = findSectionByReference(tree, '3.1');
  assert.ok(capital);
  assert.ok(article);
  assert.equal(findSectionByReference(tree, 'III-INTRO(b)'), null, 'the phantom lettered child of the Article III chapeau must no longer exist');
  assert.deepEqual({
    start: capital.start,
    end: capital.end,
    section_id: capital.section_id,
    text_sha256: capital.text_sha256,
  }, {
    start: 57763,
    end: 62446,
    section_id: '66f01432485170a2d87fffaf6139e0b7f6c6dd380bfdc0550f76c2bad4dba418',
    // Unchanged from the pre-correction pin: same bytes, new label.
    text_sha256: 'ab4ce66d8e07577673bf4ea1f99838b21bd518786778e8511c71efab3df30487',
  });
  const bytes = Buffer.from(context.canonical_text.text, 'utf8');
  assert.match(bytes.subarray(capital.start, capital.end).toString('utf8'), /^\(b\) Capital Structure\./);
  assert.match(bytes.subarray(capital.end, article.end).toString('utf8'), /^\(c\)/);
  assert.ok(capital.start > article.start && capital.end < article.end);
});
