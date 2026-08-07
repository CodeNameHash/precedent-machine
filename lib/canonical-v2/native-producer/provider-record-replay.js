// Record and replay Anthropic provider responses for an extraction run.
//
// PLAN.md Stage 2 names this as a blocking prerequisite for the ladder. The
// ladder's gate compares `resolved` counts across rounds and stops the line
// when one falls. Every re-run is currently a live model call with no pinned
// seed, so two identical runs can differ and the gate is measuring sampling
// noise as if it were regression. Ben ruled on 2026-08-06: build the replay
// path rather than write a tolerance policy.
//
// WHY THIS IS NOT THE SIBLING SCRIPT'S VERSION.
// `scripts/canonical-v2-native-extract.mjs` already has --record/--replay
// (lines 86-118), and it works, but it records exactly ONE response into one
// file: `{raw_response_text}`. That is correct for that script, which
// extracts one section of one family. The general runner
// (`scripts/canonical-v2-live-extraction-run.mjs`) issues one call per
// pinned section reference, so a single-response fixture would replay the
// same answer for every section and produce a confidently wrong run. This
// module keys recordings by request so an N-call run replays N answers.
//
// WHAT REPLAY DOES NOT PROVE. Replaying recorded responses re-scores the
// resolver, the validator and the write-set builder against fixed model
// output. It proves those changed or did not. It says nothing about whether
// the model would answer the same way today, which is a different question
// and needs a live run.

const crypto = require('node:crypto');

const SCHEMA_VERSION = 'NATIVE_PRODUCER_RECORDED_RUN/V1';

// Keyed on the request messages rather than call order. Order-keying breaks
// the moment a run dispatches sections concurrently or a caller reorders the
// pinned list, and it breaks silently -- the replay returns a real response
// to the wrong section, which resolves cleanly and is wrong.
function requestKey(params) {
  const messages = Array.isArray(params && params.messages) ? params.messages : [];
  return crypto.createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex');
}

function rawTextOf(response) {
  return Array.isArray(response && response.content)
    ? response.content.map((part) => (part && part.text) || '').join('')
    : '';
}

// Wraps a real client so every response is captured. `sink` receives the
// finished recording; the caller owns writing it, so this module performs no
// filesystem access and stays classifiable as pure analysis.
function createRecordingClient({ client, model = 'default', sink }) {
  if (!client || !client.messages || typeof client.messages.create !== 'function') {
    throw new Error('RECORDING_CLIENT_REQUIRES_CLIENT: pass a client with messages.create');
  }
  if (typeof sink !== 'function') {
    throw new Error('RECORDING_CLIENT_REQUIRES_SINK: pass a sink(recording) callback');
  }
  const calls = [];
  return {
    messages: {
      async create(params) {
        const response = await client.messages.create(params);
        calls.push({
          request_key: requestKey(params),
          request_messages: params.messages,
          raw_response_text: rawTextOf(response),
        });
        sink({
          schema_version: SCHEMA_VERSION,
          model,
          call_count: calls.length,
          calls: [...calls],
        });
        return response;
      },
    },
  };
}

// Replays a recording. Fails closed on an unrecorded request: returning a
// plausible-but-wrong answer, or an empty one, would produce a run that looks
// complete and is not, which is the failure this whole stage exists to stop.
function createReplayClient({ recording, onCall = null }) {
  if (!recording || recording.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `REPLAY_SCHEMA_MISMATCH: expected ${SCHEMA_VERSION}, got ${recording && recording.schema_version}`,
    );
  }
  const byKey = new Map();
  for (const call of recording.calls || []) {
    if (!byKey.has(call.request_key)) byKey.set(call.request_key, []);
    byKey.get(call.request_key).push(call.raw_response_text);
  }
  // Repeated identical requests within one run replay in the order recorded.
  const cursor = new Map();
  const served = [];
  return {
    served,
    messages: {
      async create(params) {
        const key = requestKey(params);
        const bucket = byKey.get(key);
        if (!bucket) {
          throw new Error(
            `REPLAY_MISS: no recorded response for this request (key ${key.slice(0, 12)}...). `
            + `The recording has ${recording.call_count || (recording.calls || []).length} call(s). `
            + 'Re-record rather than falling back to a live call: a partial replay is a run that '
            + 'looks complete and is not.',
          );
        }
        const index = cursor.get(key) || 0;
        if (index >= bucket.length) {
          throw new Error(
            `REPLAY_EXHAUSTED: request ${key.slice(0, 12)}... was recorded ${bucket.length} time(s) `
            + `but replayed ${index + 1} time(s). The run is issuing more calls than were recorded.`,
          );
        }
        cursor.set(key, index + 1);
        served.push(key);
        if (onCall) onCall({ request_key: key, replay_index: index });
        return { content: [{ text: bucket[index] }] };
      },
    },
  };
}

// True when every recorded call was replayed. A run that replays fewer calls
// than were recorded has changed behaviour -- it stopped asking something --
// and that is a finding, not a pass.
function replayCoverage({ recording, served }) {
  const recorded = (recording.calls || []).length;
  const usedKeys = new Set(served || []);
  const recordedKeys = new Set((recording.calls || []).map((call) => call.request_key));
  const unusedKeys = [...recordedKeys].filter((key) => !usedKeys.has(key));
  return {
    recorded_calls: recorded,
    replayed_calls: (served || []).length,
    unused_recorded_requests: unusedKeys.length,
    complete: unusedKeys.length === 0 && (served || []).length === recorded,
  };
}

module.exports = {
  SCHEMA_VERSION,
  requestKey,
  createRecordingClient,
  createReplayClient,
  replayCoverage,
};
