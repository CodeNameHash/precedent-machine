// Item 13 (UI Feedback Round 3, stage 1): the qualifier hover popover showed
// a bare quote, head-truncated at TOOLTIP_MAX, with no indication of which
// rep it belongs to, and no attempt to center a long excerpt on the actual
// match when truncating. shared.js's HoverSource briefly grew a sourceLabel
// prop + focusSnippet-based centering to fix this.
//
// Item 8 (round 3, stage 2, same pass): the popover itself is then KILLED --
// every row gets a left-column "See provision" expander (always reachable,
// full untruncated text) instead, which structurally solves the same
// "quote lacks context" problem Item 13 targeted (no truncation, and the
// expander sits directly under the row's own label). HoverSource keeps its
// FULL prop signature (quote/highlight/sourceLabel/align) so its 50+ call
// sites need no changes, but renders children with no popover, no listeners,
// and no popover-only state.
//
// shared.js's HoverSource component uses real JSX (no JSX loader configured
// for this repo's node:test runner -- see
// tests/review/provision-table-primitives.spec.js for the same convention),
// so this asserts against source text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source() {
  return fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
}

test('HoverSource keeps its full prop signature (quote/highlight/sourceLabel/align) so call sites need no changes', () => {
  const body = source();
  const fn = body.match(/export function HoverSource\(\{[\s\S]*?\}\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'HoverSource must still exist and not be deleted -- 50+ call sites depend on it');
});

test('HoverSource renders children with NO popover -- no hover/touch listeners, no popover markup, no state', () => {
  const body = source();
  const fn = body.match(/export function HoverSource\([\s\S]*?\n\}/);
  assert.ok(fn, 'HoverSource must still exist');
  assert.doesNotMatch(fn[0], /onMouseEnter/, 'the hover listener must be gone');
  assert.doesNotMatch(fn[0], /onTouchStart/, 'the touch handler must be gone');
  assert.doesNotMatch(fn[0], /role="tooltip"/, 'no popover markup should render any more');
  assert.doesNotMatch(fn[0], /useState/, 'no popover-only show/pos state should remain');
  assert.match(fn[0], /return <Tag className=\{className\}>\{children\}<\/Tag>;/, 'HoverSource is now a plain pass-through wrapper');
});
