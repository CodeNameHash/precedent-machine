'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  executeUnifiedRun,
  validateRecomputedPromptBudgetSplitPreflights,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildPromptBudgetSplitPreflight,
} = require('../lib/canonical-v2/native-producer/prompt-budget-split-preflight');

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

function blockedSplitFixture() {
  const canonicalText = 'Material Adverse Effect means any materially adverse event.';
  const documentHash = sha256Hex(canonicalText);
  const node = Object.freeze({
    section_id: sha256Hex('blocked-split-section'),
    reference: '1.1',
    parent_section_id: null,
    kind: 'SECTION',
    depth: 1,
    heading: 'Material Adverse Effect',
    article_context: 'DEFINITIONS',
    start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'),
    text_sha256: sha256Hex(canonicalText),
  });
  const tree = Object.freeze({
    document_hash: documentHash,
    source_byte_length: Buffer.byteLength(canonicalText, 'utf8'),
    source_sha256: sha256Hex(canonicalText),
    nodes: Object.freeze([node]),
  });
  const workItemId = 'blocked-split-extract';
  const sourceId = 'blocked-split-source';
  const preflight = buildPromptBudgetSplitPreflight({
    tree,
    canonical_text: canonicalText,
    document_hash: documentHash,
    source_id: sourceId,
    origin_work_item_id: workItemId,
    family_id: 'MAE_DEFINITION',
    nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 1 },
  });
  assert.equal(preflight.status, 'BLOCKED_IRREDUCIBLE');
  return {
    preflight,
    manifest: {
      schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1',
      sources: [{
        source_id: sourceId,
        disposition: 'BLOCKED_SOURCE_PIN',
        source_locator: 'blocked split fixture',
        blocking_code: 'SOURCE_NOT_ISSUED',
      }],
      work_items: [{
        work_item_id: workItemId,
        source_id: sourceId,
        family_id: 'MAE_DEFINITION',
        disposition: 'EXTRACT',
        section_pin: {
          section_reference: node.reference,
          section_id: node.section_id,
          section_kind: node.kind,
          section_text_sha256: node.text_sha256,
        },
      }],
    },
  };
}

function recomputationFixture() {
  const canonicalText = 'Material Adverse Effect means any materially adverse event.';
  const documentHash = sha256Hex(canonicalText);
  const node = Object.freeze({
    section_id: sha256Hex('recomputed-split-section'),
    reference: '1.1',
    parent_section_id: null,
    kind: 'SECTION',
    depth: 1,
    heading: 'Material Adverse Effect',
    article_context: 'DEFINITIONS',
    start: 0,
    end: Buffer.byteLength(canonicalText, 'utf8'),
    text_sha256: sha256Hex(canonicalText),
  });
  const tree = Object.freeze({
    document_hash: documentHash,
    source_byte_length: Buffer.byteLength(canonicalText, 'utf8'),
    source_sha256: sha256Hex(canonicalText),
    nodes: Object.freeze([node]),
  });
  const item = Object.freeze({
    work_item_id: 'recomputed-split-extract',
    source_id: 'recomputed-split-source',
    family_id: 'MAE_DEFINITION',
    disposition: 'EXTRACT',
    section_reference: node.reference,
    section_id: node.section_id,
    section_kind: node.kind,
    section_text_sha256: node.text_sha256,
  });
  const preflight = buildPromptBudgetSplitPreflight({
    tree,
    canonical_text: canonicalText,
    document_hash: documentHash,
    source_id: item.source_id,
    origin_work_item_id: item.work_item_id,
    family_id: item.family_id,
    nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });
  assert.equal(preflight.status, 'PASS');
  return {
    canonicalText,
    item,
    node,
    preflight,
    admitted: Object.freeze({
      source_id: item.source_id,
      context: Object.freeze({
        document_hash: documentHash,
        canonical_text: Object.freeze({ text: canonicalText }),
      }),
      tree,
    }),
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
      max_model_invocations: 0,
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

test('a blocked split preflight stops before trusted validation, provider construction or checkpoint writing', async () => {
  const fixture = blockedSplitFixture();
  let providerCalls = 0;
  let checkpointWrites = 0;

  await assert.rejects(() => executeUnifiedRun({
    manifest: fixture.manifest,
    prompt_budget_split_preflights: [fixture.preflight],
    work_item_controls: [{
      work_item_id: 'blocked-split-extract',
      profile_id: 'TERRA_MEDIUM',
      covenant_side: null,
    }],
    max_model_invocations: 1,
    provider_factory: () => {
      providerCalls += 1;
      return async () => ({});
    },
    on_work_result: async () => {
      checkpointWrites += 1;
    },
  }), (error) => error?.code === 'PROMPT_BUDGET_SPLIT_PREFLIGHT_BLOCKED');

  assert.equal(providerCalls, 0);
  assert.equal(checkpointWrites, 0);
});

test('trusted recomputation rejects a content-addressed preflight built from different admitted bytes', () => {
  const fixture = recomputationFixture();
  assert.deepEqual(validateRecomputedPromptBudgetSplitPreflights({
    extract_items: [fixture.item],
    admitted_by_id: new Map([[fixture.item.source_id, fixture.admitted]]),
    prompt_budget_split_preflights: [fixture.preflight],
  }), {
    status: 'PASS',
    preflight_ids: [fixture.preflight.preflight_id],
  });

  const changedCanonicalText = `${fixture.canonicalText} Unrelated tail text.`;
  const changedDocumentHash = sha256Hex(changedCanonicalText);
  const changedTree = Object.freeze({
    document_hash: changedDocumentHash,
    source_byte_length: Buffer.byteLength(changedCanonicalText, 'utf8'),
    source_sha256: sha256Hex(changedCanonicalText),
    nodes: Object.freeze([fixture.node]),
  });
  const changedAdmitted = Object.freeze({
    source_id: fixture.item.source_id,
    context: Object.freeze({
      document_hash: changedDocumentHash,
      canonical_text: Object.freeze({ text: changedCanonicalText }),
    }),
    tree: changedTree,
  });
  assert.throws(() => validateRecomputedPromptBudgetSplitPreflights({
    extract_items: [fixture.item],
    admitted_by_id: new Map([[fixture.item.source_id, changedAdmitted]]),
    prompt_budget_split_preflights: [fixture.preflight],
  }), (error) => error?.code === 'PROMPT_BUDGET_SPLIT_PREFLIGHT_RECOMPUTATION_MISMATCH'
    && error.details.reason === 'CANONICAL_MISMATCH');
});

test('execution remains unavailable until an external trusted verifier issues authority', async () => {
  await assert.rejects(
    () => executeUnifiedRun({
      manifest: callerManifest(),
      work_item_controls: [],
      max_model_invocations: 0,
    }),
    (error) => error?.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('execution rejects an omitted or unbounded model-invocation cap before any run work', async () => {
  for (const max_model_invocations of [undefined, Infinity]) {
    await assert.rejects(
      () => executeUnifiedRun({
        manifest: callerManifest(),
        work_item_controls: [],
        max_model_invocations,
      }),
      (error) => error?.code === 'INVALID_MAX_MODEL_INVOCATIONS',
    );
  }
});
