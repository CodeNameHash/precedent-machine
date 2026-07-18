// Item 13 (UI Feedback Round 3): the qualifier hover popover showed a bare
// quote, head-truncated at TOOLTIP_MAX, with no indication of which rep it
// belongs to, and no attempt to center a long excerpt on the actual match
// when truncating. shared.js's HoverSource component uses real JSX (no JSX
// loader configured for this repo's node:test runner -- see
// tests/review/provision-table-primitives.spec.js for the same convention),
// so this asserts against source text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source() {
  return fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
}

test('HoverSource accepts an optional sourceLabel and renders it as a bold first line in the popover', () => {
  const body = source();
  assert.match(body, /export function HoverSource\(\{[\s\S]*?sourceLabel[\s\S]*?\}\)/);
  assert.match(body, /sourceLabel \?[\s\S]*?font-bold[\s\S]*?\{sourceLabel\}/);
});

test('HoverSource centers a long quote on the highlight via focusSnippet before truncating, instead of always cutting from the head', () => {
  const body = source();
  assert.match(body, /import \{[\s\S]*?focusSnippet[\s\S]*?\} from '\.\.\/\.\.\/lib\/citable';/);
  const fn = body.match(/export function HoverSource\([\s\S]*?\n\}/);
  assert.ok(fn, 'HoverSource must still exist');
  assert.match(fn[0], /focusSnippet\(trimmed, highlight\)/, 'must call focusSnippet when centering the excerpt on the highlight');
  assert.match(fn[0], /trimmed\.length > TOOLTIP_MAX/, 'centering only kicks in once the quote exceeds the popover budget');
});
