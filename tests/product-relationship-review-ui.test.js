'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const {
  RelationshipEditor, RelationshipReviewCard,
} = require('../components/product/ReviewWorkspace.jsx');

const facts = [{
  item_id: 'fact-item-a', source_id: 'fact-a', kind: 'PROPOSAL', decision: 'ACCEPTED',
  structure_node_id: 'section-a', original: {
    family_key: 'NO_SHOP', subtype_key: 'EXCEPTION_PREREQUISITE',
    statement: 'The Company must not solicit.',
  },
}, {
  item_id: 'fact-item-b', source_id: 'fact-b', kind: 'USER_FACT', decision: 'EDITED',
  structure_node_id: 'section-b', original: {
    family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION',
    statement: 'The Company may provide information.',
  },
}];
const analysis = {
  agreement_structure: { nodes: [
    { node_id: 'section-a', reference: '6.3', title: 'No solicitation' },
    { node_id: 'section-b', reference: '6.4', title: 'Board recommendation' },
  ] },
  source_closures: [
    { source_closure_id: 'closure-a', structure_node_id: 'section-a' },
    { source_closure_id: 'closure-b', structure_node_id: 'section-b' },
  ],
  spans: [
    { span_id: 'span-a', source_closure_ids: ['closure-a'], kind: 'FULL_SECTION', exact_text: 'Section 6.3 source.' },
    { span_id: 'span-b', source_closure_ids: ['closure-b'], kind: 'SUPPORTING_EVIDENCE', exact_text: 'Section 6.4 source.' },
  ],
};

test('add relationship starts empty and labels facts, sections, types and sources plainly', () => {
  const html = renderToStaticMarkup(React.createElement(RelationshipEditor, {
    factItems: facts, analysis, busy: false, onSave() {}, onCancel() {},
  }));
  assert.match(html, /Add relationship/);
  assert.match(html, /Select starting fact/);
  assert.match(html, /Select related fact/);
  assert.match(html, /Section 6\.3: The Company must not solicit\./);
  assert.match(html, /Section 6\.4: The Company may provide information\./);
  assert.doesNotMatch(html, />Qualifies</);
  assert.doesNotMatch(html, />Excepts</);
  assert.match(html, /Select source section/);
  assert.doesNotMatch(html, /Section 6\.3 source\./);
});

test('edit relationship prefills the reviewed endpoints, type and exact source', () => {
  const item = {
    item_id: 'relationship-item', source_id: 'link-a', kind: 'RELATIONSHIP', decision: 'PENDING',
    effective_relationship: {
      from_proposal_id: 'fact-a', to_proposal_id: 'fact-b', relationship_type: 'EXCEPTS',
      source_closure_id: 'closure-a', source_span_ids: ['span-a'],
    },
  };
  const html = renderToStaticMarkup(React.createElement(RelationshipEditor, {
    item, factItems: facts, analysis, busy: false, onSave() {}, onCancel() {},
  }));
  assert.match(html, /Edit relationship/);
  assert.match(html, /value="fact-item-a" selected=""/);
  assert.match(html, /value="fact-item-b" selected=""/);
  assert.match(html, /value="EXCEPTS" selected=""/);
  assert.match(html, />Requires</);
  assert.doesNotMatch(html, />Triggers</);
  assert.match(html, /value="closure-a" selected=""/);
  assert.match(html, /checked="" value="span-a"/);
  assert.match(html, /Section 6\.3 source\./);
});

test('relationship card shows the effective typed link and explicit review controls', () => {
  const html = renderToStaticMarkup(React.createElement(RelationshipReviewCard, {
    item: {
      item_id: 'relationship-item', kind: 'RELATIONSHIP', decision: 'PENDING',
      source_closure_id: 'closure-a', source_span_ids: ['span-a'],
      effective_relationship: { relationship_type: 'QUALIFIES' },
      relationship_context: {
        from: 'The Company must not solicit.', to: 'The Company may provide information.',
      },
    },
    factItems: facts, analysis, busy: false, onDecision() {}, onSave() {}, onSource() {},
  }));
  assert.match(html, /Qualifies/);
  assert.match(html, /From:.*The Company must not solicit\./);
  assert.match(html, /To:.*The Company may provide information\./);
  assert.match(html, />Accept</);
  assert.match(html, />Edit</);
  assert.match(html, />Reject</);
  assert.match(html, />Unresolved</);
  assert.match(html, /View relationship source/);
});

test('relationship card cannot accept a link without an exact source', () => {
  const html = renderToStaticMarkup(React.createElement(RelationshipReviewCard, {
    item: {
      item_id: 'relationship-item', kind: 'RELATIONSHIP', decision: 'PENDING',
      source_closure_id: null, source_span_ids: [],
      effective_relationship: { relationship_type: 'QUALIFIES' },
      relationship_context: { from: 'Starting fact.', to: 'Related fact.' },
    },
    factItems: facts, analysis, busy: false, onDecision() {}, onSave() {}, onSource() {},
  }));
  assert.match(html, /Exact relationship source required/);
  assert.match(html, /<button disabled=""[^>]*>Accept<\/button>/);
});
