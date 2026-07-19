const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// R6 item 7: table headers never render with an ellipsis. headerLines()
// (card-utils.js, plain JS) is the single rule; ProvisionTable.jsx's thead
// (JSX -- asserted by source pattern-matching, same style as
// provision-table-compact-columns.spec.js) must route every column.header
// through it.

const { headerLines } = require('../../components/review/table-configs/card-utils.js');

test('plain short header passes through with no qualifier', () => {
  assert.deepEqual(headerLines('Term'), { main: 'Term', qualifier: null });
  assert.deepEqual(headerLines('CVR Entitlement'), { main: 'CVR Entitlement', qualifier: null });
});

test('clean parenthetical qualifier becomes its own second line', () => {
  assert.deepEqual(headerLines('Threshold (as % of equity value)'), {
    main: 'Threshold',
    qualifier: 'as % of equity value',
  });
});

test('an already-truncated qualifier is omitted entirely, never ellipsized', () => {
  assert.deepEqual(headerLines('Threshold (as % of equity va...)'), {
    main: 'Threshold',
    qualifier: null,
  });
  assert.deepEqual(headerLines('Threshold (as % of equity va…)'), {
    main: 'Threshold',
    qualifier: null,
  });
});

test('a bare ellipsized header loses the trailing ellipsis', () => {
  assert.deepEqual(headerLines('Superior Proposal thresho...'), {
    main: 'Superior Proposal thresho',
    qualifier: null,
  });
  assert.deepEqual(headerLines('Superior Proposal thresho…'), {
    main: 'Superior Proposal thresho',
    qualifier: null,
  });
});

test('non-string headers (nodes, undefined) pass through untouched', () => {
  assert.deepEqual(headerLines(undefined), { main: undefined, qualifier: null });
  const node = { type: 'span' };
  assert.equal(headerLines(node).main, node);
});

test('never returns a main or qualifier containing an ellipsis for string input', () => {
  const samples = [
    'Term',
    'Threshold (as % of ...)',
    'Some header...',
    'Some header… (qual)',
    'A (b) c (d…)',
  ];
  for (const s of samples) {
    const { main, qualifier } = headerLines(s);
    assert.ok(!/(?:\.{3}|…)\s*$/.test(String(main)), `main ellipsized for ${JSON.stringify(s)}: ${main}`);
    if (qualifier) assert.ok(!/(?:\.{3}|…)/.test(qualifier), `qualifier ellipsized for ${JSON.stringify(s)}`);
  }
});

test('ProvisionTable thead routes column.header through headerLines', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components', 'review', 'ProvisionTable.jsx'),
    'utf8',
  );
  assert.match(src, /import \{ headerLines \} from '\.\/table-configs\/card-utils\.js'/);
  assert.match(src, /headerLines\(column\.header\)/);
  // The th must allow clean wrapping (two-line where needed), never nowrap.
  assert.doesNotMatch(src, /<th[^>]*whitespace-nowrap/);
  assert.match(src, /whitespace-normal break-words"\s*\n?\s*style=\{column\.width/);
});
