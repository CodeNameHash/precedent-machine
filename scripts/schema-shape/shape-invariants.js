#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');

const TRIGGER_CODES = [
  'SUPERIOR_PROPOSAL',
  'BOARD_RECOMMENDATION_CHANGE',
  'NAKED_NO_VOTE',
  'MUTUAL_DROP_DEAD',
  'BUYER_REG_FAILURE',
  'COMPANY_BREACH_MATERIAL',
  'BUYER_BREACH_MATERIAL',
  'LAW_ORDER_PERMANENT_ENJOIN',
  'COMPANY_BREACH_FINANCING_COOPERATION',
  'OUTSIDE_DATE_ELAPSED',
  'STOCKHOLDER_VOTE_FAILED',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function valueKeys(vocab) {
  assert(Array.isArray(vocab.values), 'vocab.values must be an array');
  return vocab.values.map((value) => value.key);
}

function checkTriggerCodeVocab() {
  const vocab = readJson('docs/vocab/FROZEN-triggerCode-v1.json');
  const keys = valueKeys(vocab);
  assert(keys.length === TRIGGER_CODES.length, `triggerCode must have ${TRIGGER_CODES.length} values`);
  for (const key of TRIGGER_CODES) {
    assert(keys.includes(key), `triggerCode missing ${key}`);
  }
  return 'trigger-code-vocab';
}

function checkPartyRoleVocab() {
  const vocab = readJson('docs/vocab/FROZEN-party_role-v1.json');
  const values = new Map(vocab.values.map((value) => [value.key, value]));
  for (const key of ['company', 'parent', 'both']) {
    assert(values.has(key), `party_role missing ${key}`);
    assert(Array.isArray(values.get(key).aliases), `party_role ${key} aliases missing`);
  }
  assert(values.get('company').aliases.includes('TARGET'), 'company aliases missing TARGET');
  assert(values.get('company').aliases.includes('SELLER'), 'company aliases missing SELLER');
  assert(values.get('parent').aliases.includes('BUYER'), 'parent aliases missing BUYER');
  assert(values.get('parent').aliases.includes('ACQUIRER'), 'parent aliases missing ACQUIRER');
  return 'party-role-vocab';
}

function checkPhase0CAllowlist() {
  const allowlist = readJson('.github/phase-allowlists/phase-0-C.json');
  assert(allowlist.phase === '0-C', 'phase-0-C allowlist phase mismatch');
  assert(allowlist.allowed.includes('docs/schema-shape/canonical-definitions.md'), 'phase-0-C allowlist missing canonical-definitions');
  assert(allowlist.allowed.includes('WORKLOG-P0-C.md'), 'phase-0-C allowlist missing WORKLOG');
  assert(allowlist.denied.includes('docs/vocab/FROZEN-*.json'), 'phase-0-C denylist missing frozen vocab guard');
  return 'phase-0-C-allowlist';
}

function checkNormalizeIdempotent() {
  const first = execFileSync(process.execPath, ['scripts/schema-shape/normalize.js'], { encoding: 'utf8' });
  const second = execFileSync(process.execPath, ['scripts/schema-shape/normalize.js'], { encoding: 'utf8' });
  assert(first === second, 'normalize.js output drifted across two runs');
  return 'normalize-idempotent';
}

function run(check) {
  switch (check) {
    case 'trigger-code-vocab':
      return checkTriggerCodeVocab();
    case 'party-role-vocab':
      return checkPartyRoleVocab();
    case 'phase-0-C-allowlist':
      return checkPhase0CAllowlist();
    case 'normalize-idempotent':
      return checkNormalizeIdempotent();
    case 'all':
      return [
        checkTriggerCodeVocab(),
        checkPartyRoleVocab(),
        checkPhase0CAllowlist(),
        checkNormalizeIdempotent(),
      ].join('\n');
    default:
      throw new Error(`Unknown invariant: ${check}`);
  }
}

function main() {
  const check = process.argv[2] || 'all';
  try {
    process.stdout.write(`${run(check)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  run,
  checkNormalizeIdempotent,
  checkPartyRoleVocab,
  checkPhase0CAllowlist,
  checkTriggerCodeVocab,
};
