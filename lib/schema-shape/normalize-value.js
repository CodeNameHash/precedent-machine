const fs = require('fs');
const path = require('path');
const { PARTY_ROLE_ALIASES } = require('../vocab/party-role-aliases');
const { TRIGGER_CODE_ALIASES } = require('../vocab/trigger-code-aliases');

const VOCAB_FILES = {
  'FROZEN-party_role-v1': 'docs/vocab/FROZEN-party_role-v1.json',
  'FROZEN-triggerCode-v1': 'docs/vocab/FROZEN-triggerCode-v1.json',
};

const ALIASES = {
  'FROZEN-party_role-v1': PARTY_ROLE_ALIASES,
  'FROZEN-triggerCode-v1': TRIGGER_CODE_ALIASES,
};

function readVocab(vocabRef) {
  const file = VOCAB_FILES[vocabRef] || vocabRef;
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
}

function normalizeValue(value, vocabRef, sourceProvisionId = null) {
  if (value && typeof value === 'object' && value.canonicalKey) return value;
  const raw = value == null ? null : String(value);
  const vocab = readVocab(vocabRef);
  const keys = new Set((vocab.values || []).map((entry) => entry.key));
  const aliases = ALIASES[vocabRef] || {};
  const canonicalKey = keys.has(raw) ? raw : aliases[raw] || aliases[String(raw || '').toLowerCase()] || 'FREEFORM';
  return {
    canonicalKey,
    extractorRawValue: raw,
    sourceProvisionId,
  };
}

module.exports = {
  ALIASES,
  normalizeValue,
  readVocab,
};
