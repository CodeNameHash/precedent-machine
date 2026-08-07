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
