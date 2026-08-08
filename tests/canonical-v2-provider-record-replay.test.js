// PLAN.md Stage 2 prerequisite: a deterministic replay path, so the ladder's
// gates compare resolver behaviour rather than model sampling noise.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCHEMA_VERSION,
  requestKey,
  createRecordingClient,
  createReplayClient,
  replayCoverage,
} = require('../lib/canonical-v2/native-producer/provider-record-replay');

function fakeClient(responses) {
  let index = 0;
  const calls = [];
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        const text = responses[index];
        index += 1;
        return { content: [{ text }] };
      },
    },
  };
}

const REQ = (text) => ({ messages: [{ role: 'user', content: text }] });

test('a multi-call run records every call, not just the last', async () => {
  // The sibling script records one response into one file. For a run that
  // issues one call per pinned section, that would replay the same answer
  // for every section.
  let latest = null;
  const client = createRecordingClient({
    client: fakeClient(['A', 'B', 'C']),
    model: 'test-model',
    sink: (recording) => { latest = recording; },
  });
  await client.messages.create(REQ('section 7.1'));
  await client.messages.create(REQ('section 7.3'));
  await client.messages.create(REQ('section 8.12'));

  assert.equal(latest.schema_version, SCHEMA_VERSION);
  assert.equal(latest.call_count, 3);
  assert.deepEqual(latest.calls.map((call) => call.raw_response_text), ['A', 'B', 'C']);
});

test('replay returns the answer recorded for that request, not by call order', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['ANSWER_71', 'ANSWER_83']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('section 7.1'));
  await recorder.messages.create(REQ('section 8.3'));

  // Replay in the OPPOSITE order. Order-keyed replay would hand back the
  // wrong section's answer here, resolve cleanly, and be wrong.
  const replay = createReplayClient({ recording });
  const second = await replay.messages.create(REQ('section 8.3'));
  const first = await replay.messages.create(REQ('section 7.1'));
  assert.equal(second.content[0].text, 'ANSWER_83');
  assert.equal(first.content[0].text, 'ANSWER_71');
});

test('replay is deterministic across repeated runs', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['X']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('s'));

  const first = await createReplayClient({ recording }).messages.create(REQ('s'));
  const second = await createReplayClient({ recording }).messages.create(REQ('s'));
  assert.equal(first.content[0].text, second.content[0].text);
});

test('an unrecorded request fails closed rather than returning nothing', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['X']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('recorded'));

  const replay = createReplayClient({ recording });
  await assert.rejects(
    () => replay.messages.create(REQ('never recorded')),
    /REPLAY_MISS/,
  );
});

test('replaying more calls than were recorded fails closed', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['X']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('s'));

  const replay = createReplayClient({ recording });
  await replay.messages.create(REQ('s'));
  await assert.rejects(() => replay.messages.create(REQ('s')), /REPLAY_EXHAUSTED/);
});

test('an identical request recorded twice replays both answers in order', async () => {
  // Retries and multi-pass families legitimately issue the same request more
  // than once, and the answers can differ.
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['FIRST', 'SECOND']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('same'));
  await recorder.messages.create(REQ('same'));

  const replay = createReplayClient({ recording });
  assert.equal((await replay.messages.create(REQ('same'))).content[0].text, 'FIRST');
  assert.equal((await replay.messages.create(REQ('same'))).content[0].text, 'SECOND');
});

test('coverage reports a run that stopped asking something', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['A', 'B']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('one'));
  await recorder.messages.create(REQ('two'));

  const replay = createReplayClient({ recording });
  await replay.messages.create(REQ('one'));
  const coverage = replayCoverage({ recording, served: replay.served });
  assert.equal(coverage.recorded_calls, 2);
  assert.equal(coverage.replayed_calls, 1);
  assert.equal(coverage.unused_recorded_requests, 1);
  assert.equal(coverage.complete, false);
});

test('coverage is complete when every recorded call is replayed', async () => {
  let recording = null;
  const recorder = createRecordingClient({
    client: fakeClient(['A', 'B']),
    sink: (value) => { recording = value; },
  });
  await recorder.messages.create(REQ('one'));
  await recorder.messages.create(REQ('two'));

  const replay = createReplayClient({ recording });
  await replay.messages.create(REQ('one'));
  await replay.messages.create(REQ('two'));
  assert.equal(replayCoverage({ recording, served: replay.served }).complete, true);
});

test('a recording from a different schema version is refused', () => {
  assert.throws(
    () => createReplayClient({ recording: { schema_version: 'SOMETHING_ELSE/V9', calls: [] } }),
    /REPLAY_SCHEMA_MISMATCH/,
  );
});

test('request keys ignore fields that are not the prompt', () => {
  // Model, temperature and max_tokens are run configuration, not the
  // question. Keying on them would miss every recording after a config
  // change, which reads as REPLAY_MISS and sends someone re-recording for
  // no reason.
  const a = requestKey({ messages: [{ role: 'user', content: 'q' }], model: 'm1', max_tokens: 100 });
  const b = requestKey({ messages: [{ role: 'user', content: 'q' }], model: 'm2', max_tokens: 900 });
  assert.equal(a, b);
});

test('it refuses a client or sink that cannot work', () => {
  assert.throws(() => createRecordingClient({ client: null, sink: () => {} }), /REQUIRES_CLIENT/);
  assert.throws(
    () => createRecordingClient({ client: fakeClient([]), sink: null }),
    /REQUIRES_SINK/,
  );
});

// ─────────────────────────────────────────────────────────────────────────
// REPLAY MODEL IDENTITY.
//
// `model_id` feeds `producer_receipt_id`, which feeds `closure_id`. Replay
// used to report itself as the model -- `replay(<path>)` -- so the SAME
// recorded evidence replayed from two directories minted two different
// identities for identical claims. The committed artefacts still show both
// values for one Modiv run: `replay(evidence/canonical-v2/modiv-antitrust-20260806)`
// and `replay(/tmp/.../pool-modiv-antitrust-20260807-replay)`.
//
// Replay is a transport, not a producer. These tests pin that the identity
// comes from the live run that produced the text, and that an unidentifiable
// replay refuses rather than inventing one.

const {
  resolveOriginalProviderModelId,
  READABLE_SCHEMA_VERSIONS,
} = require('../lib/canonical-v2/native-producer/provider-record-replay');

const RECEIPT = (...modelIds) => ({
  resolved_sections: modelIds.map((id) => ({ producer_receipt: { model_id: id } })),
});

test('a V2 recording carries the live producer identity, not the CLI alias', async () => {
  let latest = null;
  const client = createRecordingClient({
    client: fakeClient(['A']),
    model: 'sonnet',
    providerModelId: 'claude-sonnet-5-via-claude-code-cli(sonnet)',
    sink: (recording) => { latest = recording; },
  });
  await client.messages.create(REQ('one'));
  // The alias and the producer identity are different strings, and the
  // second is the one that reaches the receipt.
  assert.equal(latest.model, 'sonnet');
  assert.equal(latest.provider_model_id, 'claude-sonnet-5-via-claude-code-cli(sonnet)');
  assert.equal(resolveOriginalProviderModelId({ recording: latest }), 'claude-sonnet-5-via-claude-code-cli(sonnet)');
});

test('the same recording replayed from two directories resolves ONE identity', () => {
  // The regression itself. Nothing in the resolution may derive from a path.
  const recording = {
    schema_version: SCHEMA_VERSION,
    provider_model_id: 'claude-sonnet-5-via-claude-code-cli(sonnet)',
    call_count: 0,
    calls: [],
  };
  const fromA = resolveOriginalProviderModelId({ recording, source: '/evidence/run' });
  const fromB = resolveOriginalProviderModelId({ recording, source: '/tmp/scratch/pool-copy' });
  assert.equal(fromA, fromB);
  assert.equal(fromA, 'claude-sonnet-5-via-claude-code-cli(sonnet)');
});

test('a V1 recording falls back to the receipt of the run that produced it', () => {
  // 24 V1 recordings exist and re-recording costs real model calls, so they
  // stay readable -- but they carry only the alias, so the identity comes
  // from the run receipt sitting beside them.
  assert.ok(READABLE_SCHEMA_VERSIONS.includes('NATIVE_PRODUCER_RECORDED_RUN/V1'));
  const v1 = { schema_version: 'NATIVE_PRODUCER_RECORDED_RUN/V1', model: 'sonnet', call_count: 0, calls: [] };
  assert.doesNotThrow(() => createReplayClient({ recording: v1 }));
  assert.equal(
    resolveOriginalProviderModelId({
      recording: v1,
      runReceipt: RECEIPT('claude-sonnet-5-via-claude-code-cli(sonnet)', 'claude-sonnet-5-via-claude-code-cli(sonnet)'),
    }),
    'claude-sonnet-5-via-claude-code-cli(sonnet)',
  );
});

test('a receipt-less run refuses to replay rather than inventing an identity', () => {
  // The two TopBuild runs whose extraction failed (BREAKs 1 and 4) write no
  // receipt. Substituting a path here is what caused the instability.
  assert.throws(
    () => resolveOriginalProviderModelId({ runReceipt: null, source: 'the run in /some/dir' }),
    /REPLAY_MODEL_IDENTITY_UNKNOWN/,
  );
  assert.throws(
    () => resolveOriginalProviderModelId({ runReceipt: RECEIPT(), source: 'x' }),
    /REPLAY_MODEL_IDENTITY_UNKNOWN/,
  );
});

test('a run produced by two models refuses to claim one identity', () => {
  assert.throws(
    () => resolveOriginalProviderModelId({
      runReceipt: RECEIPT('model-a', 'model-b'),
      source: 'a mixed run',
    }),
    /REPLAY_MODEL_IDENTITY_AMBIGUOUS/,
  );
});

test('an operator may state the identity of a hand-assembled fixture set', () => {
  // The "fullpin" collections are merged from several runs and carry no
  // receipt. Stating the identity deliberately is allowed; deriving it from
  // wherever the files sit is not.
  assert.equal(
    resolveOriginalProviderModelId({
      runReceipt: null,
      declared: 'claude-sonnet-5-via-claude-code-cli(sonnet)',
      source: 'a hand-assembled set',
    }),
    'claude-sonnet-5-via-claude-code-cli(sonnet)',
  );
});

test('an operator who contradicts the record is refused, not obeyed', () => {
  assert.throws(
    () => resolveOriginalProviderModelId({
      runReceipt: RECEIPT('claude-sonnet-5-via-claude-code-cli(sonnet)'),
      declared: 'claude-opus-4-via-something-else',
      source: 'a recorded run',
    }),
    /REPLAY_MODEL_IDENTITY_CONFLICT/,
  );
});

test('an operator who agrees with the record is a no-op', () => {
  assert.equal(
    resolveOriginalProviderModelId({
      runReceipt: RECEIPT('claude-sonnet-5-via-claude-code-cli(sonnet)'),
      declared: 'claude-sonnet-5-via-claude-code-cli(sonnet)',
    }),
    'claude-sonnet-5-via-claude-code-cli(sonnet)',
  );
});
