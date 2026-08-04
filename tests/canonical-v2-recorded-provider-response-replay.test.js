'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  findSectionByReference,
  sectionizeAdmittedSource,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  RecordedProviderReplayError,
  reshapeRecordedProviderOutput,
} = require('../lib/canonical-v2/native-producer/recorded-provider-response-replay');
const {
  loadAdmittedSourceForExecution,
  validateUnifiedRunManifest,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const { resolveDurableArtifactRoot } = require('../lib/canonical-v2/durable-artifact-root');

const ROOT = path.resolve(__dirname, '..');
const PILOT_ROOT = resolveDurableArtifactRoot();
const V6_REVIEW_PACKET_PATH = PILOT_ROOT && path.join(PILOT_ROOT, 'final-review-v6', 'sealed-final-pilot-review-packet.json');
const MANIFEST = require('./fixtures/canonical-v2/m3-12-call-pilot-manifest.json');

function providerOutput(rawResponseText) {
  return {
    provider_id: 'recorded-provider',
    model_id: 'recorded-model',
    prompt: 'immutable prompt',
    prompt_id: 'immutable-prompt-id',
    prompt_version: 1,
    proposals: [{ stale: true }],
    evidence_residuals: [{ stale: true }],
    raw_response_length: typeof rawResponseText === 'string' ? rawResponseText.length : 0,
    ...(rawResponseText === undefined ? {} : { raw_response_text: rawResponseText }),
    attempts: 1,
  };
}

test('recorded replay uses the current family adapter and replaces stale shaped output', () => {
  const raw = JSON.stringify({
    no_shop_action_assertions: [],
    exception_prerequisite_assertions: [],
    period_assertions: [],
    open_world_candidates: [],
  });
  const original = providerOutput(raw);
  const replay = reshapeRecordedProviderOutput({
    provider_output: original,
    section_family: 'NO_SHOP',
    source_text: 'Section 4.3 No Solicitation.',
  });

  assert.deepEqual(replay.proposals, []);
  assert.deepEqual(replay.evidence_residuals, []);
  assert.equal(replay.provider_id, original.provider_id);
  assert.equal(replay.model_id, original.model_id);
  assert.equal(replay.prompt, original.prompt);
  assert.equal(replay.raw_response_text, raw);
  assert.deepEqual(original.proposals, [{ stale: true }]);
});

for (const [label, raw, code] of [
  ['missing', undefined, 'REPLAY_RAW_RESPONSE_MISSING'],
  ['malformed', '{not-json', 'REPLAY_RAW_RESPONSE_MALFORMED'],
  ['unshapeable', '{"open_world_candidates":[]}', 'REPLAY_RAW_RESPONSE_UNSHAPEABLE'],
]) {
  test(`recorded replay fails closed on ${label} raw text`, () => {
    assert.throws(
      () => reshapeRecordedProviderOutput({
        provider_output: providerOutput(raw),
        section_family: 'CAPITALISATION',
        source_text: 'Section 3.1 Capitalisation.',
      }),
      (error) => error instanceof RecordedProviderReplayError && error.code === code,
    );
  });
}

test('V6 recordings reshape through their current family adapters with deterministic counts', {
  skip: !V6_REVIEW_PACKET_PATH || !fs.existsSync(V6_REVIEW_PACKET_PATH),
}, () => {
  const packet = JSON.parse(fs.readFileSync(V6_REVIEW_PACKET_PATH, 'utf8'));
  const semantic = validateUnifiedRunManifest({ manifest: MANIFEST, root_dir: ROOT }).semantic_manifest;
  const sources = new Map();
  const actual = [];

  for (const item of semantic.work_items) {
    const sourcePin = MANIFEST.sources.find((source) => source.source_id === item.source_id);
    let source = sources.get(item.source_id);
    if (!source) {
      const admitted = loadAdmittedSourceForExecution({ source: sourcePin, root_dir: ROOT });
      const text = admitted.context.canonical_text.text;
      source = {
        text,
        tree: sectionizeAdmittedSource({ source_text: text, document_hash: admitted.context.document_hash }),
      };
      sources.set(item.source_id, source);
    }
    const node = findSectionByReference(source.tree, item.section_reference);
    assert.ok(node, `missing governed section for ${item.work_item_id}`);
    const scopedText = Buffer.from(source.text, 'utf8').subarray(node.start, node.end).toString('utf8');
    const providerOutput = packet.work_items.find((entry) => (
      entry.work_item_id === item.work_item_id
    )).repaired_replay.provider_recording.provider_output;
    const reshaped = reshapeRecordedProviderOutput({
      provider_output: providerOutput,
      section_family: item.family_id,
      source_text: scopedText,
    });
    actual.push([item.work_item_id, reshaped.proposals.length, reshaped.evidence_residuals.length]);
  }

  assert.deepEqual(actual, [
    ['modiv-antitrust-consents-5-5', 9, 0],
    ['modiv-closing-conditions-6-1', 6, 0],
    ['modiv-consideration-2-1', 7, 0],
    ['modiv-mae-definition-8-12-g', 20, 0],
    ['modiv-termination-fee-7-3', 12, 0],
    ['skechers-capitalisation-3-7', 46, 5],
    ['skechers-no-other-reps-3-28', 4, 1],
    ['topbuild-capitalisation-3-1-b', 44, 0],
    ['topbuild-ioc-company-4-1', 67, 0],
    ['topbuild-no-shop-company-4-3', 55, 0],
    ['topbuild-remedies-specific-performance-7-6', 2, 0],
    ['topbuild-termination-company-6-3', 9, 0],
  ]);
});
