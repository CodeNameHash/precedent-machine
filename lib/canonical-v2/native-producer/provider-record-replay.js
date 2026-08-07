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
  const calls = recording.calls || [];
  const recorded = calls.length;
  const usedKeys = new Set(served || []);
  // Which identifier a recording is keyed on decides what "unused" means, and
  // reading the wrong one reports every complete replay as incomplete. An
  // ordered recording built from legacy per-section fixtures has
  // `request_key: null` on every call, so the recorded-key set is {null}
  // while `served` holds section references -- nothing intersects, and a
  // 1-of-1 replay reported "1 recorded request never asked". That warning
  // fired on the first successful replay-regeneration and was false.
  const orderKeyed = calls.length > 0
    && calls.every((call) => call.request_key === null || call.request_key === undefined);
  const recordedKeys = new Set(calls.map((call, index) => (
    orderKeyed ? (call.section_reference || `call-${index + 1}`) : call.request_key
  )));
  const unusedKeys = [...recordedKeys].filter((key) => !usedKeys.has(key));
  return {
    recorded_calls: recorded,
    replayed_calls: (served || []).length,
    keying: orderKeyed ? 'ORDERED_SECTION_REFERENCE' : 'REQUEST_HASH',
    unused_recorded_requests: unusedKeys.length,
    complete: unusedKeys.length === 0 && (served || []).length === recorded,
  };
}

// Builds a replayable recording from the per-section fixtures a live run
// already writes (`native-producer-recorded-response-<ref>.json`,
// schema NATIVE_PRODUCER_RECORDED_RESPONSE/V1). Every historical run has
// these, so they are the only way to replay a run recorded before
// NATIVE_PRODUCER_RECORDED_RUN/V1 existed.
//
// THIS IS THE WEAKER KEYING, DELIBERATELY. Those fixtures carry
// `section_reference` and `raw_response_text` but NO `request_messages`
// (checked), so a request hash cannot be computed from them and replay must
// be served in the order the caller asks. That is sound only when the run
// issues one call per pinned section, in that order -- exactly the
// assumption that produced 11 mislabelled calls in the citation-following
// run. So this refuses rather than guesses when the counts disagree, and
// callers should prefer a fresh --record for anything they intend to re-run
// repeatedly.
function buildRecordingFromSectionFixtures({ fixtures, orderedSectionRefs, model = 'legacy-fixture' }) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error('LEGACY_FIXTURES_REQUIRED: pass at least one recorded-response fixture');
  }
  const byRef = new Map();
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture.raw_response_text !== 'string') {
      throw new Error('LEGACY_FIXTURE_MALFORMED: every fixture needs raw_response_text');
    }
    if (!fixture.section_reference) {
      throw new Error('LEGACY_FIXTURE_UNKEYED: every fixture needs section_reference');
    }
    byRef.set(String(fixture.section_reference), fixture.raw_response_text);
  }
  const refs = Array.isArray(orderedSectionRefs) && orderedSectionRefs.length > 0
    ? orderedSectionRefs
    : [...byRef.keys()];
  const missing = refs.filter((ref) => !byRef.has(String(ref)));
  if (missing.length > 0) {
    throw new Error(
      `LEGACY_FIXTURE_MISSING: no recorded response for section(s) ${missing.join(', ')}. `
      + 'Replaying a partial set would produce a run that looks complete and is not.',
    );
  }
  return {
    schema_version: SCHEMA_VERSION,
    model,
    keying: 'ORDERED_SECTION_REFERENCE',
    call_count: refs.length,
    calls: refs.map((ref) => ({
      request_key: null,
      section_reference: String(ref),
      raw_response_text: byRef.get(String(ref)),
    })),
  };
}

// Serves a recording whose calls have no request_key, in recorded order.
// Separate from createReplayClient rather than a mode of it, so the stronger
// guarantee that function makes -- an answer is matched to its own request --
// is not quietly weakened for every caller.
function createOrderedReplayClient({ recording }) {
  if (!recording || recording.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `REPLAY_SCHEMA_MISMATCH: expected ${SCHEMA_VERSION}, got ${recording && recording.schema_version}`,
    );
  }
  const calls = recording.calls || [];
  let cursor = 0;
  const served = [];
  return {
    served,
    messages: {
      async create() {
        if (cursor >= calls.length) {
          throw new Error(
            `REPLAY_EXHAUSTED: the run issued more than the ${calls.length} recorded call(s). `
            + 'Ordered replay cannot cover the extra calls; re-record with --record.',
          );
        }
        const call = calls[cursor];
        cursor += 1;
        served.push(call.section_reference || `call-${cursor}`);
        return { content: [{ text: call.raw_response_text }] };
      },
    },
  };
}

module.exports = {
  SCHEMA_VERSION,
  requestKey,
  createRecordingClient,
  createReplayClient,
  buildRecordingFromSectionFixtures,
  createOrderedReplayClient,
  replayCoverage,
};
