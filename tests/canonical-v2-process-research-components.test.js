const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const helperSource = fs.readFileSync(path.join(root, 'components/process/processResearchView.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .concat('\nmodule.exports = { presentationSlots, visibleSlots, actionTarget, actionInput, exactCopyInput, displayValue, sourceLabel, isAdmittedCvr, editorSelection };');
const moduleShim = { exports: {} };
new Function('module', helperSource)(moduleShim);
const view = moduleShim.exports;

const source = (file) => fs.readFileSync(path.join(root, 'components/process', file), 'utf8');
const slot = Object.freeze({ slot_identity: 'slot-a', slot_state: 'VALID', exact_content: 'Exact operative passage.', exact_citation: { human_readable_source_label: 'Proxy, Background' }, metadata: [{ field_reference: { field_key: 'process_phase', field_version: 1 }, value: 'PRE_SIGNING', typed_state: null }], action_targets: [{ action_kind: 'COPY_EXACT_PASSAGE', accessible_name: 'Copy exact passage', action_state: 'AVAILABLE', product_query_result_identity: 'result-a', citation_target_identity: 'citation-a', authority_state: 'NOT_GRANTED' }, { action_kind: 'OPEN_SOURCE', accessible_name: 'Open source', action_state: 'AVAILABLE', product_query_result_identity: 'result-a', citation_target_identity: 'citation-a', authority_state: 'NOT_GRANTED' }] });

test('uses the same ordered slot identities in passage and table views', () => {
  const presentation = { result_slots: [slot, { slot_identity: 'slot-b', slot_state: 'UNAVAILABLE', failure: {} }] };
  assert.deepEqual(view.visibleSlots(presentation).map((item) => item.slot_identity), ['slot-a', 'slot-b']);
});

test('passes the full exact passage and citation to copy, never a preview', () => {
  assert.deepEqual(view.exactCopyInput(slot), { ...slot.action_targets[0], exact_passage: 'Exact operative passage.', citation: slot.exact_citation });
});

test('does not manufacture an action or silently expose CVR', () => {
  assert.equal(view.actionInput(slot, 'SHARE_EXACT_RESULT'), null);
  assert.equal(view.isAdmittedCvr(slot), false);
  assert.equal(view.isAdmittedCvr({ domain_key: 'CVR' }), true);
});

test('component source has declared accessible controls and full-screen mobile reader dialog', () => {
  assert.match(source('ProcessAsk.jsx'), /htmlFor="process-research-question"/);
  assert.match(source('ProcessBrowse.jsx'), /aria-pressed/);
  assert.match(source('ProcessSourceReader.jsx'), /role="dialog"/);
  assert.match(source('ProcessSourceReader.jsx'), /h-screen w-full/);
  assert.match(source('ProcessSourceReader.jsx'), /aria-modal="true"/);
  assert.match(source('ProcessSourceReader.jsx'), /priorFocusRef\.current = document\.activeElement/);
  assert.match(source('ProcessSourceReader.jsx'), /dialogRef\.current\?\.focus\(\)/);
  assert.match(source('ProcessSourceReader.jsx'), /priorFocusRef\.current\?\.focus\?\.\(\)/);
  assert.match(source('ProcessSourceReader.jsx'), /hidden lg:sticky lg:top-4 lg:flex/);
  assert.match(source('ProcessSourceReader.jsx'), /fixed inset-0 z-50 bg-black\/30 lg:hidden/);
});

test('renderer units remain isolated from network, source reads and compilers', () => {
  const files = fs.readdirSync(path.join(root, 'components/process')).filter((file) => file.endsWith('.js') || file.endsWith('.jsx'));
  for (const file of files) {
    const contents = source(file);
    assert.doesNotMatch(contents, /\bfetch\s*\(|XMLHttpRequest|WebSocket|canonical-v2|compiler/i, file);
  }
});

test('filter sentence is compact and selected values are retained by controlled editor source', () => {
  const sentence = source('ProcessFilterSentence.jsx');
  const editor = source('ProcessFilterEditor.jsx');
  assert.doesNotMatch(sentence, /pill/i);
  assert.match(editor, /useState\(selected\[0\]\?\.value/);
  assert.match(editor, /Search catalogue fields/);
  assert.match(editor, /value_options/);
});

test('unavailable slots remain visible without removing valid siblings', () => {
  const list = source('ProcessPassageList.jsx');
  const card = source('ProcessPassageCard.jsx');
  assert.match(list, /visibleSlots\(presentation\)/);
  assert.match(card, /slot\.slot_state === 'UNAVAILABLE'/);
});

test('editing the second filter retains that exact segment and its value', () => {
  const segments = [{ field_label: 'Process phase', value: 'PRE_SIGNING' }, { field_label: 'Sector', value: 'BIOPHARMA' }];
  assert.deepEqual(view.editorSelection(segments[1]), [segments[1]]);
  assert.equal(view.editorSelection(segments[1])[0].value, 'BIOPHARMA');
  assert.deepEqual(view.editorSelection(null), []);
  assert.match(source('ProcessResearchSurface.jsx'), /setEditingSegment\(segment\)/);
});

test('save and rerun use the immutable presentation, while correction keeps the validated slot', () => {
  const surface = source('ProcessResearchSurface.jsx');
  const card = source('ProcessPassageCard.jsx');
  assert.match(surface, /onSave\(presentation\)/);
  assert.match(surface, /onRerun\(presentation\)/);
  assert.match(surface, /lg:grid lg:grid-cols/);
  assert.match(card, /onCorrection\(slot\)/);
  assert.doesNotMatch(card, /on(?:Save|Rerun|Correction)\(actionInput\(slot, 'OPEN_EXACT_DETAIL'\)\)/);
});
