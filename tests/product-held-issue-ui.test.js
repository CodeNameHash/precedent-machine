'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');
require.extensions['.jsx'] = function compileJsx(module, filename) {
  const result = transformSync(fs.readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  module._compile(result.code, filename);
};
const { Requirement } = require('../components/product/ReviewWorkspace.jsx');

test('held unsupported proposal renders readable proposed content and preserves detail', () => {
  const html = renderToStaticMarkup(React.createElement(Requirement, {
    item: { kind: 'ISSUE', decision: 'PENDING', original: { code: 'UNSUPPORTED_FACT_TYPE', message: JSON.stringify({ client_ref: 'notice-proposal', group_ref: 'notice-group', statement: 'Buyer must deliver notice.', family_key: 'GENERAL_COVENANTS', subtype_key: 'NOTICE', fact_type: 'NOTICE', roles: { obligor: 'Buyer' }, value: '5 days', evidence_quotes: [{ quote: 'deliver notice' }] }) }, source_span_ids: ['span'] },
    onDecision() {}, onSource() {},
  }));
  assert.match(html, /Held model-proposed content, not accepted/);
  assert.match(html, /Model-proposed statement: Buyer must deliver notice\./);
  assert.match(html, /Model-proposed category: GENERAL_COVENANTS · NOTICE · NOTICE/);
  assert.match(html, /Model-proposed proposal reference:/);
  assert.match(html, /Model-proposed roles: obligor: Buyer/);
  assert.match(html, /Model-proposed evidence: deliver notice/);
  assert.match(html, /Show recorded detail/);
});

test('malformed and unrelated issue detail remain safe', () => {
  const malformed = renderToStaticMarkup(React.createElement(Requirement, { item: { kind: 'ISSUE', decision: 'PENDING', original: { code: 'UNSUPPORTED_FACT_TYPE', message: '{bad' } }, onDecision() {}, onSource() {} }));
  assert.match(malformed, /Recorded detail: \{bad/);
  const unrelated = renderToStaticMarkup(React.createElement(Requirement, { item: { kind: 'ISSUE', decision: 'PENDING', original: { code: 'MODEL_COVERAGE_KEY_OMITTED', message: 'coverage path' } }, onDecision() {}, onSource() {} }));
  assert.match(unrelated, /Recorded detail: coverage path/);
});

test('all held issue codes label group, proposal, and link references without object coercion', () => {
  const cases = {
    UNSUPPORTED_SUBTYPE: { client_ref: 'group-1', family_key: 'F', subtype_key: 'S' },
    UNSUPPORTED_FACT_TYPE: { client_ref: 'proposal-1', group_ref: 'group-1', family_key: 'F', subtype_key: 'S', fact_type: 'TYPE', statement: 'Held text' },
    UNSUPPORTED_PROPOSITION_GROUP_MEMBER: { client_ref: 'proposal-2', group_ref: 'group-1', family_key: 'F', subtype_key: 'S', statement: 'Held text', roles: { nested: { bad: true } } },
    DUPLICATE_PROPOSITION_GROUP: [{ client_ref: 'group-2', family_key: 'F', subtype_key: 'S' }],
    UNSUPPORTED_FACT_LINK: { from_ref: 'proposal-1', to_ref: 'proposal-2', relationship_type: 'QUALIFIES' },
  };
  for (const [code, message] of Object.entries(cases)) {
    const html = renderToStaticMarkup(React.createElement(Requirement, { item: { kind: 'ISSUE', decision: 'PENDING', original: { code, message: JSON.stringify(message) } }, onDecision() {}, onSource() {} }));
    assert.doesNotMatch(html, /\[object Object\]/);
    assert.match(html, /Held model-proposed content, not accepted/);
    if (code === 'UNSUPPORTED_SUBTYPE' || code === 'DUPLICATE_PROPOSITION_GROUP') {
      assert.match(html, /Model-proposed group reference: group-/);
      assert.doesNotMatch(html, /Model-proposed proposal reference:/);
    }
    if (code === 'UNSUPPORTED_FACT_TYPE' || code === 'UNSUPPORTED_PROPOSITION_GROUP_MEMBER') {
      assert.match(html, /Model-proposed proposal reference: proposal-/);
      assert.match(html, /Model-proposed group reference: group-1/);
    }
    if (code === 'UNSUPPORTED_FACT_LINK') {
      assert.match(html, /Model-proposed link from: proposal-1/);
      assert.match(html, /Model-proposed link to: proposal-2/);
      assert.match(html, /Model-proposed link type: QUALIFIES/);
    }
  }
});

test('hostile held JSON values render safely and retain the original detail', () => {
  const cases = [
    ['[null]', /No readable model-proposed content/],
    ['{"statement":{}}', /Model-proposed statement: \{\}/],
    ['{"evidence_quotes":[null]}', /Model-proposed evidence: None recorded/],
  ];
  for (const [message, expected] of cases) {
    const html = renderToStaticMarkup(React.createElement(Requirement, {
      item: { kind: 'ISSUE', decision: 'PENDING', original: { code: 'UNSUPPORTED_FACT_TYPE', message } },
      onDecision() {}, onSource() {},
    }));
    assert.match(html, /Held model-proposed content, not accepted/);
    assert.match(html, expected);
    assert.match(html, /Show recorded detail/);
    assert.doesNotMatch(html, /\[object Object\]/);
  }
});

test('held model text is HTML escaped, including nested fields', () => {
  const html = renderToStaticMarkup(React.createElement(Requirement, {
    item: { kind: 'ISSUE', decision: 'PENDING', original: { code: 'UNSUPPORTED_FACT_TYPE', message: JSON.stringify({
      client_ref: 'proposal-escape', group_ref: 'group-escape', statement: '<script>alert("statement")</script>',
      roles: { obligor: { name: '<img src=x onerror=alert(1)>' } },
      value: { text: '<b>value</b>' }, evidence_quotes: [{ quote: '<i>evidence</i>' }],
    }) } },
    onDecision() {}, onSource() {},
  }));
  assert.doesNotMatch(html, /<script>|<img|<b>|<i>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;statement&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;value&lt;\/b&gt;/);
  assert.match(html, /&lt;i&gt;evidence&lt;\/i&gt;/);
  assert.doesNotMatch(html, /\[object Object\]/);
});
