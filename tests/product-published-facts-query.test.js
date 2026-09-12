'use strict';

// Store and page-body tests for the Query surface's first read: published,
// layered (FACT_COMPONENTS/V2) facts across every agreement's current
// release head. Store: lib/product/phase-3-store.js
// listPublishedLayeredFacts. Page body: pages/query/provisions.js
// QueryProvisionsBody (the presentational half, isolated from useUser/fetch
// so it can be rendered without a router or network — same pattern as
// tests/product-held-issue-ui.test.js exercising ReviewWorkspace's
// `Requirement` directly).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

const { ProductPhase3Store } = require('../lib/product/phase-3-store');

// Compiles ESM + JSX .jsx files (e.g. components/product/PublishedSummary.jsx).
require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

// Repo .js files are a mix: lib/product/* is plain CommonJS (fast-pathed
// through Node's normal loader), while pages/* and some lib/component
// helpers (lib/useUser.js, components/UI.js) use ESM import/export the way
// every Next.js page does. Only the latter need the SWC transform, and only
// inside this repo, never node_modules.
const projectRoot = path.join(__dirname, '..');
const originalJsLoader = require.extensions['.js'];
require.extensions['.js'] = function compileProjectEsm(module, filename) {
  if (!filename.startsWith(projectRoot) || filename.includes(`${path.sep}node_modules${path.sep}`)) {
    return originalJsLoader(module, filename);
  }
  const source = fs.readFileSync(filename, 'utf8');
  if (!/(^|\n)\s*(import\s|export\s)/.test(source)) return originalJsLoader(module, filename);
  const transformed = transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const { QueryProvisionsBody, QUERYABLE_FAMILIES, NO_FACTS_MESSAGE } = require('../pages/query/provisions.js');

function createFakeClient(tables) {
  return {
    from(table) {
      return { select: () => Promise.resolve({ data: tables[table] || [], error: null }) };
    },
    async rpc(name) { throw new Error(`unexpected rpc ${name}`); },
  };
}

function layeredFact({ reviewItemId, familyKey, subtypeKey, label, sectionReference }) {
  return {
    review_item_id: reviewItemId,
    family_key: familyKey,
    subtype_key: subtypeKey,
    coverage_only: false,
    section_reference: sectionReference,
    headline: { label, distinguishing_component_ids: [] },
    components: [{
      component_id: `${reviewItemId}-c1`, kind: 'TERM', label: 'text', text: label,
      source_span_id: `${reviewItemId}-span`, start_byte: 0, end_byte: 10, origin: 'OWN', gap_before: false, children: [],
    }],
  };
}

function v1OnlyFact({ reviewItemId, familyKey, subtypeKey }) {
  return {
    review_item_id: reviewItemId, family_key: familyKey, subtype_key: subtypeKey,
    fact_type: 'SOME_TYPE', statement: 'A plain V1 statement.', roles: {}, canonical_value: null,
  };
}

function buildTables() {
  return {
    product_agreement_release_heads: [
      { source_document_id: 'doc-a', release_id: 'release-a1' },
      { source_document_id: 'doc-b', release_id: 'release-b1' },
    ],
    product_agreement_releases: [
      {
        release_id: 'release-a1', source_document_id: 'doc-a', run_id: 'run-a', published_at: '2026-09-10T00:00:00.000Z',
        summary: {
          families: [
            { family_key: 'TERMINATION', facts: [layeredFact({ reviewItemId: 'v-1', familyKey: 'TERMINATION', subtypeKey: 'MUTUAL_CONSENT', label: 'Mutual consent', sectionReference: '7.1' })] },
            { family_key: 'NO_SHOP', facts: [layeredFact({ reviewItemId: 'v-2', familyKey: 'NO_SHOP', subtypeKey: 'SOLICITATION_BAN', label: 'No solicitation', sectionReference: '6.1' })] },
          ],
        },
      },
      {
        release_id: 'release-b1', source_document_id: 'doc-b', run_id: 'run-b', published_at: '2026-09-11T00:00:00.000Z',
        summary: {
          families: [
            { family_key: 'TERMINATION', facts: [v1OnlyFact({ reviewItemId: 'v-3', familyKey: 'TERMINATION', subtypeKey: 'MUTUAL_CONSENT' })] },
          ],
        },
      },
    ],
    product_source_documents: [
      { source_document_id: 'doc-a', retrieval_url: 'https://www.sec.gov/Archives/doc-a.htm' },
      { source_document_id: 'doc-b', retrieval_url: 'https://www.sec.gov/Archives/doc-b.htm' },
    ],
  };
}

test('listPublishedLayeredFacts returns every current release head, keeping only layered (V2) facts', async () => {
  const store = new ProductPhase3Store({ client: createFakeClient(buildTables()) });
  const agreements = await store.listPublishedLayeredFacts({});
  assert.equal(agreements.length, 2);

  const docA = agreements.find((agreement) => agreement.source_document_id === 'doc-a');
  const docB = agreements.find((agreement) => agreement.source_document_id === 'doc-b');
  assert.equal(docA.run_id, 'run-a');
  assert.equal(docA.agreement_label, 'https://www.sec.gov/Archives/doc-a.htm');
  assert.equal(docA.released_at, '2026-09-10T00:00:00.000Z');
  assert.deepEqual(docA.facts.map((fact) => fact.review_item_id).sort(), ['v-1', 'v-2']);

  // The V1-only body has no `components`, so it yields no layered facts.
  assert.equal(docB.agreement_label, 'https://www.sec.gov/Archives/doc-b.htm');
  assert.deepEqual(docB.facts, []);
});

test('listPublishedLayeredFacts filters by family', async () => {
  const store = new ProductPhase3Store({ client: createFakeClient(buildTables()) });
  const agreements = await store.listPublishedLayeredFacts({ familyKey: 'NO_SHOP' });
  const docA = agreements.find((agreement) => agreement.source_document_id === 'doc-a');
  const docB = agreements.find((agreement) => agreement.source_document_id === 'doc-b');
  assert.deepEqual(docA.facts.map((fact) => fact.review_item_id), ['v-2']);
  assert.deepEqual(docB.facts, []);
});

test('listPublishedLayeredFacts filters by subtype', async () => {
  const store = new ProductPhase3Store({ client: createFakeClient(buildTables()) });
  const agreements = await store.listPublishedLayeredFacts({ subtypeKey: 'MUTUAL_CONSENT' });
  const docA = agreements.find((agreement) => agreement.source_document_id === 'doc-a');
  const docB = agreements.find((agreement) => agreement.source_document_id === 'doc-b');
  // v-1 is TERMINATION/MUTUAL_CONSENT and layered; v-3 is MUTUAL_CONSENT too but V1-only (no components).
  assert.deepEqual(docA.facts.map((fact) => fact.review_item_id), ['v-1']);
  assert.deepEqual(docB.facts, []);
});

test('QueryProvisionsBody renders the empty state when no release has layered facts', () => {
  const html = renderToStaticMarkup(React.createElement(QueryProvisionsBody, {
    agreements: [{ run_id: 'run-b', source_document_id: 'doc-b', agreement_label: 'https://www.sec.gov/Archives/doc-b.htm', released_at: '2026-09-11T00:00:00.000Z', facts: [] }],
    error: null,
    families: QUERYABLE_FAMILIES,
    familyKey: '',
    subtypeKey: '',
    onFamilyChange: () => {},
    onSubtypeChange: () => {},
  }));
  assert.match(html, new RegExp(NO_FACTS_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /data-testid="published-fact"/);
});

test('QueryProvisionsBody renders matching facts headline-first, grouped per agreement', () => {
  const agreements = [
    {
      run_id: 'run-a', source_document_id: 'doc-a', agreement_label: 'https://www.sec.gov/Archives/doc-a.htm',
      released_at: '2026-09-10T00:00:00.000Z',
      facts: [layeredFact({ reviewItemId: 'v-1', familyKey: 'TERMINATION', subtypeKey: 'MUTUAL_CONSENT', label: 'Mutual consent', sectionReference: '7.1' })],
    },
  ];
  const html = renderToStaticMarkup(React.createElement(QueryProvisionsBody, {
    agreements,
    error: null,
    families: QUERYABLE_FAMILIES,
    familyKey: 'TERMINATION',
    subtypeKey: '',
    onFamilyChange: () => {},
    onSubtypeChange: () => {},
  }));
  assert.match(html, /https:\/\/www\.sec\.gov\/Archives\/doc-a\.htm/);
  assert.match(html, /data-testid="fact-headline"/);
  assert.match(html, /Mutual consent/);
  assert.match(html, /Show layers/);
  assert.doesNotMatch(html, new RegExp(NO_FACTS_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
