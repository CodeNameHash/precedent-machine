'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  executeUnifiedRun,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');

function callerManifest() {
  return {
    schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1',
    sources: [
      {
        source_id: 'caller-created-source',
        disposition: 'BLOCKED_SOURCE_PIN',
        source_locator: 'caller-created source locator',
        blocking_code: 'SOURCE_NOT_ISSUED',
      },
    ],
    work_items: [
      {
        work_item_id: 'caller-created-extract',
        source_id: 'caller-created-source',
        family_id: 'NO_SHOP',
        disposition: 'BLOCKED_SOURCE_PIN',
        blocking_code: 'SOURCE_NOT_ISSUED',
      },
    ],
  };
}

test('execution rejects caller manifests before provider invocation or checkpoint writing', async () => {
  let providerCalls = 0;
  let checkpointWrites = 0;

  await assert.rejects(
    () => executeUnifiedRun({
      manifest: callerManifest(),
      work_item_controls: [
        {
          work_item_id: 'caller-created-extract',
          profile_id: 'TERRA_MEDIUM',
          covenant_side: null,
        },
      ],
      provider_factory: () => {
        providerCalls += 1;
        return async () => {
          providerCalls += 1;
          return {};
        };
      },
      on_work_result: async () => {
        checkpointWrites += 1;
      },
    }),
    (error) => error?.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );

  assert.equal(providerCalls, 0);
  assert.equal(checkpointWrites, 0);
});

test('execution remains unavailable until an external trusted verifier issues authority', async () => {
  await assert.rejects(
    () => executeUnifiedRun({
      manifest: callerManifest(),
      work_item_controls: [],
    }),
    (error) => error?.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});
