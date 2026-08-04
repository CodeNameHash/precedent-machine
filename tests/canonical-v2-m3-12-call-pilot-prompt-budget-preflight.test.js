'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PROMPT_BYTE_CEILING,
  PilotPromptBudgetPreflightError,
  buildPilotPromptBudgetPreflight,
  buildPromptBudgetCall,
} = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-prompt-budget-preflight');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'), 'utf8'));

function sourceFor(workItem) {
  return MANIFEST.sources.find((source) => source.source_id === workItem.source_id);
}

function extract(workItemId) {
  return structuredClone(MANIFEST.work_items.find((item) => item.work_item_id === workItemId));
}

test('the pilot preflight reports exact admitted section bytes and prompt bytes for every EXTRACT work item', () => {
  const result = buildPilotPromptBudgetPreflight({ root_dir: ROOT });
  assert.equal(result.call_count, 7);
  assert.equal(result.calls.length, 7);
  assert.equal(result.prompt_byte_ceiling, PROMPT_BYTE_CEILING);
  assert.equal(result.total_prompt_byte_length, result.calls.reduce((total, call) => total + call.prompt_byte_length, 0));
  assert.ok(result.calls.every((call) => call.section_text_byte_length > 0
    && call.prompt_byte_length > call.section_text_byte_length
    && call.prompt_byte_length <= PROMPT_BYTE_CEILING));
  assert.deepEqual(result.calls.map((call) => call.work_item_id), [
    'modiv-antitrust-consents-5-5',
    'modiv-closing-conditions-6-1',
    'modiv-consideration-2-1',
    'modiv-mae-definition-8-12-g',
    'modiv-termination-fee-7-3',
    'skechers-capitalisation-3-7',
    'skechers-no-other-reps-3-28',
  ]);
});

test('a section pin or family mismatch fails before any provider path exists', () => {
  const sectionMismatch = extract('modiv-mae-definition-8-12-g');
  sectionMismatch.section_pin.section_id = '0'.repeat(64);
  assert.throws(
    () => buildPromptBudgetCall({ source: sourceFor(sectionMismatch), work_item: sectionMismatch, root_dir: ROOT }),
    (error) => error instanceof PilotPromptBudgetPreflightError && error.code === 'SECTION_PIN_MISMATCH',
  );
  const familyMismatch = extract('modiv-antitrust-consents-5-5');
  familyMismatch.family_id = 'UNREGISTERED_FAMILY';
  assert.throws(
    () => buildPromptBudgetCall({ source: sourceFor(familyMismatch), work_item: familyMismatch, root_dir: ROOT }),
    (error) => error instanceof PilotPromptBudgetPreflightError && error.code === 'UNREGISTERED_FAMILY',
  );
});

test('the explicit prompt-byte ceiling fails closed', () => {
  const item = extract('skechers-capitalisation-3-7');
  assert.throws(
    () => buildPromptBudgetCall({ source: sourceFor(item), work_item: item, root_dir: ROOT, prompt_byte_ceiling: 1 }),
    (error) => error instanceof PilotPromptBudgetPreflightError && error.code === 'PROMPT_BYTE_CEILING_EXCEEDED',
  );
});

test('the preflight imports no provider, transport, database, or UI path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/native-producer/m3-12-call-pilot-prompt-budget-preflight.js'), 'utf8');
  assert.doesNotMatch(source, /provider-interface|anthropic-provider|codex-cli-provider|node:https|node:http|\bfetch\s*\(|supabase|next\//);
});
