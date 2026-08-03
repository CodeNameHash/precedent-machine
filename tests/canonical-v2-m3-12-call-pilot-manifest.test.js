'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
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
    BLOCKED_SOURCE_PIN: 5,
    EXTRACT: 7,
    NOT_PRESENT: 0,
  });
  assert.equal(result.execution_plan.zero_retry_provider_call_count, 7);
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

test('M3 12-call pilot blocks TopBuild rather than inventing its missing policy digest', () => {
  const manifest = loadManifest();
  const source = manifest.sources.find((entry) => entry.source_id === 'topbuild-full');
  assert.deepEqual(source, {
    source_id: 'topbuild-full',
    disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm, raw_sha256 146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f',
    blocking_code: 'RETRIEVAL_POLICY_DIGEST_UNAVAILABLE',
  });
  const blocked = manifest.work_items.filter((item) => item.source_id === 'topbuild-full');
  assert.equal(blocked.length, 5);
  assert.ok(blocked.every((item) =>
    item.disposition === 'BLOCKED_SOURCE_PIN'
      && item.blocking_code === 'RETRIEVAL_POLICY_DIGEST_UNAVAILABLE'));
});
