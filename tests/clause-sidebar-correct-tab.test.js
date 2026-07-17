const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SOURCE = fs.readFileSync('components/review-v2/ClauseSidebar.jsx', 'utf8');

test('Correct tab posts to the submit endpoint with the editor-key header', () => {
  assert.match(SOURCE, /fetch\('\/api\/corrections\/submit'/);
  assert.match(SOURCE, /'x-editor-key':\s*editorKey/);
  assert.match(SOURCE, /mtx_editor_key/);
});

test('Correct tab form covers every field the spec lists', () => {
  assert.match(SOURCE, /WRONG_KINDS/);
  assert.match(SOURCE, /'code'/);
  assert.match(SOURCE, /'party'/);
  assert.match(SOURCE, /'value'/);
  assert.match(SOURCE, /'quote'/);
  assert.match(SOURCE, /'other'/);
  assert.match(SOURCE, /Proposed fix/);
  assert.match(SOURCE, /Rationale \(required\)/);
  assert.match(SOURCE, /Your name/);
  assert.match(SOURCE, /Editor key/);
});

test('Correct tab distinguishes applied vs queued outcomes with the spec copy', () => {
  assert.match(SOURCE, /Applied to the corpus\./);
  assert.match(SOURCE, /Queued for weekly review\./);
  assert.match(SOURCE, /data-outcome=\{result\.outcome\}/);
});

test('Correct tab claim dropdown reads from the card\'s features (attribute — current value)', () => {
  assert.match(SOURCE, /cardClaimOptions/);
  assert.match(SOURCE, /c\.attribute.*—.*c\.valueText/);
});

test('Correct tab requires kind + proposed + rationale before enabling submit', () => {
  assert.match(SOURCE, /canSubmit = kind && proposed\.trim\(\) && rationale\.trim\(\) && !submitting/);
});

test('no serif typography anywhere in the sidebar (Inter/mono only)', () => {
  // Strip // comments before scanning — the file's own header documents the
  // "no serif" rule in prose, which would otherwise self-trigger this check.
  const code = SOURCE.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
  assert.doesNotMatch(code, /serif/i);
  assert.doesNotMatch(code, /Georgia|Times New Roman|font-display/i);
  assert.match(code, /var\(--mtx-sans\)/);
});

test('Correct tab reuses the sidebar\'s existing LAB/SEL style constants', () => {
  assert.match(SOURCE, /className={LAB}/);
  assert.match(SOURCE, /className={SEL}/);
});
