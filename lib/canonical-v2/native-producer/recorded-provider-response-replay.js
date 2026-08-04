'use strict';

const { getFamilyAdapter } = require('./anthropic-provider');

class RecordedProviderReplayError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RecordedProviderReplayError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new RecordedProviderReplayError(code, message, details);
}

function reshapeRecordedProviderOutput({ provider_output: providerOutput, section_family: sectionFamily, source_text: sourceText } = {}) {
  const raw = providerOutput?.raw_response_text;
  if (typeof raw !== 'string' || raw.length === 0) {
    fail('REPLAY_RAW_RESPONSE_MISSING', 'The retained provider recording has no immutable raw response text.', {
      section_family: sectionFamily || null,
    });
  }
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    fail('REPLAY_RAW_RESPONSE_UNSHAPEABLE', 'The retained raw response cannot be reshaped without admitted source text.', {
      section_family: sectionFamily || null,
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    fail('REPLAY_RAW_RESPONSE_MALFORMED', 'The retained provider raw response is not one complete JSON object.', {
      section_family: sectionFamily || null,
      raw_response_length: raw.length,
    });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('REPLAY_RAW_RESPONSE_MALFORMED', 'The retained provider raw response must parse to one JSON object.', {
      section_family: sectionFamily || null,
      raw_response_length: raw.length,
    });
  }

  const adapter = getFamilyAdapter(sectionFamily);
  if (!adapter) {
    fail('REPLAY_RAW_RESPONSE_UNSHAPEABLE', 'No current family adapter can reshape the retained provider response.', {
      section_family: sectionFamily || null,
    });
  }
  const missingLists = adapter.required_response_lists.filter((key) => !Array.isArray(parsed[key]));
  if (missingLists.length > 0) {
    fail('REPLAY_RAW_RESPONSE_UNSHAPEABLE', 'The retained provider response does not match the current family response contract.', {
      section_family: sectionFamily,
      missing_or_invalid_lists: missingLists,
    });
  }

  let shaped;
  try {
    shaped = adapter.response_shaper(parsed, sourceText);
  } catch (error) {
    fail('REPLAY_RAW_RESPONSE_UNSHAPEABLE', 'The current family adapter could not reshape the retained provider response.', {
      section_family: sectionFamily,
      cause: error && (error.code || error.name || error.message),
    });
  }
  if (!shaped || !Array.isArray(shaped.proposals) || !Array.isArray(shaped.evidence_residuals)) {
    fail('REPLAY_RAW_RESPONSE_UNSHAPEABLE', 'The current family adapter returned an invalid replay shape.', {
      section_family: sectionFamily,
    });
  }

  return Object.freeze({
    ...providerOutput,
    proposals: Object.freeze([...shaped.proposals]),
    evidence_residuals: Object.freeze([...shaped.evidence_residuals]),
  });
}

module.exports = {
  RecordedProviderReplayError,
  reshapeRecordedProviderOutput,
};
