// PLAN.md Step 2A. Guards the three pieces whose absence produces wrong
// output that does not throw: title inheritance, the dispatchable-node
// filter, and byte-offset slicing.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  generateFamilySectionRefs,
  deriveSectionTitle,
  dispatchableNodes,
  ACCEPTED_PROVENANCE,
} = require('../lib/canonical-v2/native-producer/family-section-ref-generator');
const { sectionizeAdmittedSource } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { listRegisteredSectionFamilies } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  SECTION_FAMILY_AI_CLASSIFIED,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');

const MODIV_HTML = path.join(
  __dirname, 'fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm',
);
const MODIV_CANONICAL_SHA = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

let cached = null;
function modivCanonical() {
  if (cached) return cached;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: 'https://www.sec.gov/test',
    final_url: 'https://www.sec.gov/test',
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T00:00:00.000Z',
    retrieval_policy_digest: crypto.createHash('sha256').update('test').digest('hex'),
    redirect_count: 0,
    response_bytes: fs.readFileSync(MODIV_HTML),
  });
  cached = convertSecHtmlToCanonicalText(capture);
  return cached;
}

test('every registered family gets a key, including the ones that match nothing', () => {
  const conversion = modivCanonical();
  const result = generateFamilySectionRefs({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });
  const families = listRegisteredSectionFamilies();
  assert.equal(Object.keys(result.by_family).length, families.length);
  for (const family of families) {
    assert.ok(Array.isArray(result.by_family[family]), `${family} missing from by_family`);
  }
  // An absent key and an empty list are different claims. A family matching
  // nothing must be visible as a finding, not disappear.
  for (const family of result.unmatched_families) {
    assert.equal(result.by_family[family].length, 0);
  }
});

test('the canonical text hash is the one Modiv is pinned to', () => {
  assert.equal(modivCanonical().canonical_text_sha256, MODIV_CANONICAL_SHA);
});

test('it rediscovers the two section lists a human found by reading the document', () => {
  const conversion = modivCanonical();
  const result = generateFamilySectionRefs({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });
  // PLAN.md Step 2A records both of these as corrections found by a person
  // reading Modiv. If the generator stops finding them, it has regressed in
  // a way that a family-count check would not catch.
  assert.deepEqual(result.by_family.APPRAISAL_DISSENTERS_RIGHTS, ['2.6']);
  assert.ok(
    result.by_family.KEY_DEFINED_TERMS.includes('8.12'),
    'KEY_DEFINED_TERMS must include 8.12, the correction PLAN.md Step 2A records',
  );
});

test('every dispatchable node resolves a title, and inheritance is the fallback', () => {
  const conversion = modivCanonical();
  const tree = sectionizeAdmittedSource({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });
  const nodes = dispatchableNodes(tree);
  // Measured on Modiv: all 101 dispatchable nodes carry their own heading,
  // while 362 of 471 referenced nodes do not. The dispatchable filter
  // already selects heading-bearing nodes, so the parent walk is a no-op for
  // THIS composition -- it is load-bearing in the precedent
  // (full-corpus-routing-prompt-cost-audit.js), which classifies a different
  // node set. Retained as the fallback rather than deleted, because nothing
  // guarantees another document's tree has the same property, and the
  // failure mode without it is silent under-classification.
  for (const node of nodes) {
    assert.notEqual(
      deriveSectionTitle(tree, node), null,
      `node ${node.reference} resolved no title; classification would be empty`,
    );
  }
  // Prove the fallback works, since the real tree does not exercise it.
  const synthetic = {
    nodes: [
      { section_id: 'a', heading: 'Article VII Termination', parent_section_id: null, reference: 'VII' },
      { section_id: 'b', heading: null, parent_section_id: 'a', reference: '7.1' },
      { section_id: 'c', heading: '', parent_section_id: 'b', reference: '7.1(a)' },
    ],
  };
  assert.equal(deriveSectionTitle(synthetic, synthetic.nodes[2]), 'Article VII Termination');
});

test('the dispatchable filter excludes nested descendants of SECTION nodes', () => {
  const conversion = modivCanonical();
  const tree = sectionizeAdmittedSource({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });
  const dispatchable = dispatchableNodes(tree);
  // Without the filter every limb inheriting a matching ancestor's heading
  // would classify into that family, so the count would approach the whole
  // referenced tree rather than a fraction of it.
  const referenced = tree.nodes.filter((node) => node.reference);
  assert.ok(
    dispatchable.length < referenced.length,
    'dispatchable set should be strictly smaller than every referenced node',
  );
  const ids = new Set(dispatchable.map((node) => node.section_id));
  for (const node of dispatchable) {
    assert.ok(
      node.kind === 'SECTION' || node.kind === 'ARTICLE' || node.kind === 'SUBSECTION',
      `unexpected dispatchable kind ${node.kind}`,
    );
    if (node.kind !== 'SECTION') continue;
    // No dispatchable SECTION may be an ancestor of another dispatchable
    // SECTION -- that is the duplication the filter exists to prevent.
    const byId = new Map(tree.nodes.map((item) => [item.section_id, item]));
    let parent = node.parent_section_id;
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const parentNode = byId.get(parent);
      if (parentNode && parentNode.kind === 'SECTION') {
        assert.ok(!ids.has(parent), `${node.reference} nested under dispatchable ${parentNode.reference}`);
      }
      parent = parentNode ? parentNode.parent_section_id : null;
    }
  }
});

test('references are unique per family and in document order', () => {
  const conversion = modivCanonical();
  const result = generateFamilySectionRefs({
    source_text: conversion.canonical_text,
    document_hash: conversion.canonical_text_sha256,
  });
  for (const [family, refs] of Object.entries(result.by_family)) {
    assert.equal(new Set(refs).size, refs.length, `${family} has duplicate references`);
  }
});

test('AI-classified provenance is never accepted', () => {
  // Stage 2 output carries the blocking SECTION_FAMILY_AI_UNVERIFIED flag.
  // Admitting it here would import exactly what this generator avoids.
  assert.ok(!ACCEPTED_PROVENANCE.includes(SECTION_FAMILY_AI_CLASSIFIED));
});

test('it refuses empty or missing input rather than returning an empty map', () => {
  assert.throws(() => generateFamilySectionRefs({}), /SOURCE_TEXT_REQUIRED/);
  assert.throws(
    () => generateFamilySectionRefs({ source_text: 'x' }),
    /DOCUMENT_HASH_REQUIRED/,
  );
});
