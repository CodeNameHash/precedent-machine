'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  NativeUnifiedRunValidationError,
  validateUnifiedRunManifest,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
);

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

test('M3 12-call pilot manifest validates locally with exact source and section pins', () => {
  const result = validateUnifiedRunManifest({
    manifest: loadManifest(),
    root_dir: ROOT,
  });
  assert.equal(result.receipt.source_count, 3);
  assert.equal(result.receipt.work_item_count, 12);
  assert.deepEqual(result.receipt.disposition_counts, {
    BLOCKED_SOURCE_PIN: 0,
    EXTRACT: 12,
    NOT_PRESENT: 0,
  });
  assert.equal(result.execution_plan.zero_retry_provider_call_count, 12);
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
  const result = validateUnifiedRunManifest({ manifest, root_dir: ROOT });
  const admitted = result.semantic_manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  assert.equal(admitted.admitted_semantic_source_context_id,
    source.admitted_semantic_source_context_id);
});

test('M3 12-call pilot rejects a recorded TopBuild context whose explicit pins drift', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  source.canonical_text_sha256 = '0'.repeat(64);
  assert.throws(
    () => validateUnifiedRunManifest({ manifest, root_dir: ROOT }),
    (error) => error instanceof NativeUnifiedRunValidationError
      && error.code === 'RECORDED_CONTEXT_PIN_MISMATCH',
  );
});

test('M3 12-call pilot rejects a recorded TopBuild source-reference pin that drifts', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  source.admitted_source_reference.canonical_text_id = '0'.repeat(64);
  assert.throws(
    () => validateUnifiedRunManifest({ manifest, root_dir: ROOT }),
    (error) => error instanceof NativeUnifiedRunValidationError
      && error.code === 'RECORDED_SOURCE_REFERENCE_MISMATCH',
  );
});
