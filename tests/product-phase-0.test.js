'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { REGISTERED_FAMILY_KEYS } = require('../lib/product/family-taxonomy');
const { validateLegalSchema } = require('../lib/product/legal-schema');
const {
  buildAgreementStructure,
  validateAgreementStructure,
} = require('../lib/product/agreement-structure');
const {
  ERROR_CLASSES,
  validateDevelopmentRegressions,
} = require('../lib/product/development-regressions');

const ROOT = path.resolve(__dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stableId = (domain, value) => sha256(Buffer.from(`${domain}\0${JSON.stringify(value)}`, 'utf8'));

function sourceFixture() {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'ARTICLE I',
    'COVENANTS',
    '',
    'Section 1.1. Delivery.',
    'Parent shall deliver the Certificate, subject to Section 1.2.',
    '',
    'Section 1.2. Defined Term.',
    '“Certificate” means the closing certificate.',
  ].join('\n');
  return {
    agreement_id: sha256('product-agreement'),
    canonical_text: canonicalText,
    canonical_text_sha256: sha256(Buffer.from(canonicalText, 'utf8')),
  };
}

function orderedSourceFixture() {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'ARTICLE I',
    'FIRST',
    '',
    'Section 1.1. Alpha.',
    'Text.',
    '',
    'Section 1.2. Beta.',
    '(a) First limb.',
    '(i) Nested one.',
    '(ii) Nested two.',
    '(b) Second limb.',
    '',
    'ARTICLE II',
    'SECOND',
    '',
    'Section 2.1. Gamma.',
    'Text.',
  ].join('\n');
  return {
    agreement_id: sha256('ordered-product-agreement'),
    canonical_text: canonicalText,
    canonical_text_sha256: sha256(Buffer.from(canonicalText, 'utf8')),
  };
}

test('legal schema equals the registered 25-family taxonomy', () => {
  const schema = validateLegalSchema(readJson('contracts/product/legal-schema.v1.json'));
  assert.equal(schema.schema_version, 'LEGAL_SCHEMA/V1');
  assert.equal(schema.schema_revision, 'LEGAL_SCHEMA/V1.1');
  assert.deepEqual(
    schema.families.map((family) => family.family_key).sort(),
    [...REGISTERED_FAMILY_KEYS].sort(),
  );
  const defined = Object.fromEntries(schema.families
    .filter((family) => family.state === 'DEFINED')
    .map((family) => [family.family_key, family]));
  assert.deepEqual(Object.keys(defined), schema.families.map((family) => family.family_key));
  for (const family of Object.values(defined)) {
    assert.ok(family.required_fact_types.length > 0);
    assert.ok(family.materiality_rules.length > 0);
    assert.ok(family.summary_grammar);
    assert.ok(family.absence_semantics);
    assert.ok(family.compact_omissions);
  }
  assert.equal(defined.TERMINATION_FEE.subtypes.some((item) => item.subtype_key === 'SOLE_REMEDY_EFFECT'), false);
  assert.equal(defined.TERMINATION_FEE.role_rules.reverse_fee, 'Use the same fee fact types. Set payer capacity to BUYER and payee capacity to SELLER.');
  assert.deepEqual(schema.issues, []);
});

test('Phase 0 boundary builds product structure directly from canonical source', () => {
  const source = sourceFixture();
  const structure = buildAgreementStructure(source);
  assert.equal(structure.schema_version, 'AGREEMENT_STRUCTURE/V1');
  assert.equal(structure.nodes.filter((node) => node.parent_id === null).length, 1);
  assert.deepEqual(structure.nodes.map((node) => node.authored_order), structure.nodes.map((_, index) => index));
  assert.ok(structure.annotations.some((item) => item.kind === 'SECTION_REFERENCE'));
  assert.ok(structure.annotations.some((item) => item.kind === 'DEFINED_TERM'));
  assert.equal(structure.structural_diagnostics.completeness, 'COMPLETE');
  assert.doesNotMatch(JSON.stringify(structure), /stage|policy|digest|experiment|authority|receipt|manifest/i);
});

test('authored order follows source order across articles, sections and nested siblings', () => {
  const source = orderedSourceFixture();
  const structure = buildAgreementStructure(source);
  assert.deepEqual(
    structure.nodes.map((node) => node.reference),
    [null, 'ARTICLE I', '1.1', '1.2', '1.2(a)', '1.2(a)(i)', '1.2(a)(ii)', '1.2(b)', 'ARTICLE II', '2.1'],
  );
  assert.deepEqual(structure.nodes.map((node) => node.authored_order), structure.nodes.map((_, index) => index));
  for (let index = 1; index < structure.nodes.length; index++) {
    assert.ok(structure.nodes[index - 1].span.start_byte <= structure.nodes[index].span.start_byte);
  }
  const reordered = structuredClone(structure);
  const firstIndex = reordered.nodes.findIndex((node) => node.reference === '1.2(a)(i)');
  const secondIndex = reordered.nodes.findIndex((node) => node.reference === '1.2(a)(ii)');
  [reordered.nodes[firstIndex], reordered.nodes[secondIndex]] = [reordered.nodes[secondIndex], reordered.nodes[firstIndex]];
  reordered.nodes[firstIndex].authored_order = firstIndex;
  reordered.nodes[secondIndex].authored_order = secondIndex;
  assert.throws(() => validateAgreementStructure(reordered, source.canonical_text), /STRUCTURE_ORDER/);
});

test('product structure rejects broken identity, topology, order and spans', () => {
  const source = sourceFixture();
  assert.throws(() => buildAgreementStructure({ ...source, canonical_text_sha256: '0'.repeat(64) }), /STRUCTURE_SOURCE_HASH/);
  const valid = buildAgreementStructure(source);
  const mutation = (change) => {
    const copy = structuredClone(valid);
    change(copy);
    return () => validateAgreementStructure(copy, source.canonical_text);
  };
  assert.throws(mutation((copy) => { copy.nodes[1].parent_id = null; }), /STRUCTURE_ROOT/);
  assert.throws(mutation((copy) => { copy.nodes[1].parent_id = copy.nodes[1].node_id; }), /STRUCTURE_CYCLE/);
  assert.throws(mutation((copy) => { copy.nodes[1].parent_id = 'missing'; }), /STRUCTURE_PARENT/);
  assert.throws(mutation((copy) => { copy.nodes[1].authored_order = 99; }), /STRUCTURE_ORDER/);
  assert.throws(mutation((copy) => { copy.nodes[1].span.end_byte += 1; }), /STRUCTURE_SPAN/);
  assert.throws(mutation((copy) => { copy.annotations[0].annotation_id = '0'.repeat(64); }), /STRUCTURE_ANNOTATION_IDENTITY/);
  assert.throws(mutation((copy) => { copy.annotations[0].span.text_sha256 = '0'.repeat(64); }), /STRUCTURE_SPAN/);
});

test('node identity is recomputed after a node ID and all child links are replaced', () => {
  const source = orderedSourceFixture();
  const copy = structuredClone(buildAgreementStructure(source));
  const article = copy.nodes.find((node) => node.reference === 'ARTICLE I');
  const priorId = article.node_id;
  article.node_id = 'f'.repeat(64);
  for (const node of copy.nodes) {
    if (node.parent_id === priorId) node.parent_id = article.node_id;
  }
  assert.throws(() => validateAgreementStructure(copy, source.canonical_text), /STRUCTURE_IDENTITY/);
});

test('structure exposes rejected and swallowed headings and cannot claim they are complete', () => {
  const rejectedText = [
    'ARTICLE III\n\n',
    'REPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Except as set forth in Section 3.1(b), Section 3.2(a), Section 3.3(c), Section 3.4(d) or ',
    'Section 4.5(a) of the Company Disclosure Letter, the Company represents and warrants to Parent ',
    'as follows:\n',
    '3.5 Litigation. There is no material Legal Proceeding pending or, to the knowledge of the ',
    'Company, threatened against the Company or any of its Subsidiaries.\n',
    '(a) No Actions. Neither the Company nor any Subsidiary is subject to any outstanding order, ',
    'judgment or decree of any Governmental Authority.\n',
  ].join('');
  const rejected = buildAgreementStructure({
    agreement_id: sha256('rejected-heading'),
    canonical_text: rejectedText,
    canonical_text_sha256: sha256(Buffer.from(rejectedText, 'utf8')),
  });
  assert.equal(rejected.structural_diagnostics.completeness, 'INCOMPLETE');
  assert.deepEqual(
    rejected.structural_diagnostics.rejected_heading_candidates.map((item) => [item.reference, item.reason]),
    [['3.5', 'LONE_CANDIDATE']],
  );

  const overLongTitle = 'Company Stockholder Meeting and Parent Stockholder Meeting and Any '
    + 'Adjournments or Postponements Thereof in Accordance with the Terms of This '
    + 'Agreement, Applicable Law and the Rules and Regulations of the New York '
    + 'Stock Exchange and the Securities and Exchange Commission';
  const swallowedText = [
    'ARTICLE IV',
    'COVENANTS',
    '4.1 Interim Operations. The Company shall operate its business in the ordinary course of business consistent with past practice, subject to Section 3.1, Section 3.2, Section 3.3 and Section 3.4 of this Agreement, and further subject to Section 3.5 hereof.',
    `4.2 ${overLongTitle}. The Company and Parent shall take all actions necessary to convene and hold the applicable stockholder meetings.`,
    '4.3 Further Assurances. Each party shall use reasonable best efforts to take all actions necessary to consummate the Transactions.',
  ].join('\n');
  const swallowedSource = {
    agreement_id: sha256('swallowed-heading'),
    canonical_text: swallowedText,
    canonical_text_sha256: sha256(Buffer.from(swallowedText, 'utf8')),
  };
  const swallowed = buildAgreementStructure(swallowedSource);
  assert.equal(swallowed.structural_diagnostics.completeness, 'INCOMPLETE');
  assert.deepEqual(
    swallowed.structural_diagnostics.swallowed_heading_residuals.map((item) => [item.reference, item.reason]),
    [['4.2', 'UNACCOUNTED_LINE_START_DECIMAL']],
  );
  const hidden = structuredClone(swallowed);
  hidden.structural_diagnostics.completeness = 'COMPLETE';
  hidden.structural_diagnostics.swallowed_heading_residuals = [];
  assert.throws(() => validateAgreementStructure(hidden, swallowedText), /STRUCTURE_DIAGNOSTIC/);
});

test('spans require safe UTF-8 byte offsets, the declared coordinate system and code-point boundaries', () => {
  const source = sourceFixture();
  const valid = buildAgreementStructure(source);
  const mutation = (change) => {
    const copy = structuredClone(valid);
    change(copy);
    return () => validateAgreementStructure(copy, source.canonical_text);
  };
  assert.throws(mutation((copy) => { copy.nodes[1].span.start_byte = 0.5; }), /STRUCTURE_SPAN/);
  assert.throws(mutation((copy) => { copy.nodes[1].span.coordinate_system = 'CHARACTERS'; }), /STRUCTURE_SPAN/);
  assert.throws(mutation((copy) => { copy.coordinate_system = 'CHARACTERS'; }), /STRUCTURE_SOURCE_HASH/);

  const definedTerm = valid.annotations.find((annotation) => annotation.kind === 'DEFINED_TERM');
  assert.ok(definedTerm);
  assert.throws(mutation((copy) => {
    const annotation = copy.annotations.find((item) => item.kind === 'DEFINED_TERM');
    annotation.start_byte += 1;
    annotation.span.start_byte = annotation.start_byte;
    annotation.span.text_sha256 = sha256(Buffer.from(source.canonical_text, 'utf8').subarray(annotation.start_byte, annotation.end_byte));
    annotation.annotation_id = stableId('AGREEMENT_ANNOTATION/V1', {
      kind: annotation.kind,
      owner_node_id: annotation.owner_node_id,
      start_byte: annotation.start_byte,
      end_byte: annotation.end_byte,
      value: annotation.value,
    });
  }), /STRUCTURE_SPAN/);
});

test('annotation kinds and values are derived from their exact source spans', () => {
  const source = sourceFixture();
  const valid = buildAgreementStructure(source);
  const mutation = (change) => {
    const copy = structuredClone(valid);
    change(copy);
    return () => validateAgreementStructure(copy, source.canonical_text);
  };
  assert.throws(mutation((copy) => { copy.annotations[0].kind = 'UNKNOWN'; }), /STRUCTURE_ANNOTATION_KIND/);
  assert.throws(mutation((copy) => {
    const annotation = copy.annotations.find((item) => item.kind === 'SECTION_REFERENCE');
    annotation.value = '9.9';
    annotation.annotation_id = stableId('AGREEMENT_ANNOTATION/V1', {
      kind: annotation.kind,
      owner_node_id: annotation.owner_node_id,
      start_byte: annotation.start_byte,
      end_byte: annotation.end_byte,
      value: annotation.value,
    });
  }), /STRUCTURE_ANNOTATION_VALUE/);
});

test('annotation validation rejects omission and ancestor-owner substitution', () => {
  const source = sourceFixture();
  const valid = buildAgreementStructure(source);

  const omitted = structuredClone(valid);
  omitted.annotations = [];
  assert.throws(
    () => validateAgreementStructure(omitted, source.canonical_text),
    /STRUCTURE_ANNOTATION_COLLECTION/,
  );

  const substituted = structuredClone(valid);
  const annotation = substituted.annotations.find((item) => item.kind === 'DEFINED_TERM');
  annotation.owner_node_id = substituted.root_node_id;
  annotation.annotation_id = stableId('AGREEMENT_ANNOTATION/V1', {
    kind: annotation.kind,
    owner_node_id: annotation.owner_node_id,
    start_byte: annotation.start_byte,
    end_byte: annotation.end_byte,
    value: annotation.value,
  });
  assert.throws(
    () => validateAgreementStructure(substituted, source.canonical_text),
    /STRUCTURE_ANNOTATION_COLLECTION/,
  );
});

test('curated regressions are explicit product fixtures with no programme runtime input', () => {
  const fixture = validateDevelopmentRegressions(readJson('fixtures/product/development-regressions.v1.json'));
  assert.equal(fixture.cases.length, 50);
  assert.equal(new Set(fixture.cases.map((item) => item.case_id)).size, 50);
  assert.equal(fixture.cases.some((item) => item.error_class === 'DUPLICATE'), false);
  assert.equal(fixture.cases.every((item) => item.assertion && item.assertion.kind), true);
  const moduleSource = fs.readFileSync(path.join(ROOT, 'lib/product/development-regressions.js'), 'utf8');
  assert.doesNotMatch(moduleSource, /stage-2y|baseline-ledger|review-packet|original_note/i);
});

test('duplicate remains a distinct supported regression without inventing a historical case', () => {
  const fixture = readJson('fixtures/product/development-regressions.v1.json');
  const synthetic = structuredClone(fixture);
  synthetic.cases[0].error_class = 'DUPLICATE';
  synthetic.cases[0].assertion = { kind: 'NO_DUPLICATE_FACT', identity_fields: ['agreement_id', 'family_key', 'fact_type', 'source_span'] };
  assert.equal(ERROR_CLASSES.includes('DUPLICATE'), true);
  assert.equal(validateDevelopmentRegressions(synthetic).cases[0].error_class, 'DUPLICATE');
});

test('blind agreement is new, identity-locked and has no repository source fixture', () => {
  const cohort = readJson('contracts/product/development-cohort.v1.json');
  assert.equal(cohort.blind.agreement, 'Amazon / Globalstar');
  assert.equal(cohort.blind.accession, '0001140361-26-014528');
  assert.equal(cohort.blind.raw_source_sha256, '1743208f8078575bf4615fe43327ec5d4d695c10212ff115fcf079d38c4aa6c8');
  assert.equal(Object.hasOwn(cohort.blind, 'source_fixture'), false);
});
