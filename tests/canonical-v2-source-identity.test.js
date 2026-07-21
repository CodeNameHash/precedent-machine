const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalJson,
  contentId,
  utf8ByteLength,
  utf8Slice,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT,
  compileFixtureContract,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');
const {
  FIXTURE_EXCERPT_DEFINITION,
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildSemanticSpan,
  buildProvisionInstance,
  buildProvisionComponent,
  validateExcerpt,
  validateFixtureSourceAdmission,
} = require('../lib/canonical-v2/source-structure');

const PARTY = Object.freeze({
  role: 'REPRESENTATION_MAKER',
  value: 'COMPANY',
  capacity: 'TARGET',
});

function sourceFor(text = 'Capitalisation is £10 million. “De Minimis Inaccuracies” means immaterial errors.') {
  return buildImmutableSource({ sourceBytes: Buffer.from(text, 'utf8'), sourceOccurrenceKey: 'qxo-fixture-document' });
}

test('canonical JSON, fixture compilation and identity are insertion-order independent', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: 3 } }), canonicalJson({ a: { x: 3, y: 2 }, z: 1 }));
  assert.equal(contentId('TEST/V1', { b: 2, a: 1 }), contentId('TEST/V1', { a: 1, b: 2 }));

  const first = compileFixtureContract(FIXTURE_CONTRACT_INPUT);
  const second = compileFixtureContract(FIXTURE_CONTRACT_INPUT);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(validateContractBundle(first), true);

  const sourceA = sourceFor();
  const sourceB = sourceFor();
  assert.equal(sourceA.immutable_source_document_id, sourceB.immutable_source_document_id);
  assert.equal(sourceA.canonical_text_id, sourceB.canonical_text_id);
  assert.equal(sourceA.source_content_id, sourceB.source_content_id);
});

test('one changed source byte rekeys source, canonical text and provision identity', () => {
  const first = sourceFor('Capitalisation is £10 million.');
  const second = sourceFor('Capitalisation is £11 million.');
  assert.notEqual(first.document_hash, second.document_hash);
  assert.notEqual(first.source_content_id, second.source_content_id);
  assert.notEqual(first.canonical_text_id, second.canonical_text_id);
  assert.notEqual(first.immutable_source_document_id, second.immutable_source_document_id);

  const firstSpan = buildSemanticSpan(first, 0, utf8ByteLength(first.canonical_text.text));
  const secondSpan = buildSemanticSpan(second, 0, utf8ByteLength(second.canonical_text.text));
  const firstProvision = buildProvisionInstance({ source: first, span: firstSpan, conceptKey: 'REP-T-CAP', party: PARTY, ordinal: 1 });
  const secondProvision = buildProvisionInstance({ source: second, span: secondSpan, conceptKey: 'REP-T-CAP', party: PARTY, ordinal: 1 });
  assert.notEqual(firstProvision.provision_instance_id, secondProvision.provision_instance_id);
});

test('semantic spans use exact half-open UTF-8 byte offsets', () => {
  const source = sourceFor('A £10 “quoted” value');
  const text = source.canonical_text.text;
  const start = utf8ByteLength('A ');
  const end = start + utf8ByteLength('£10');
  const span = buildSemanticSpan(source, start, end);

  assert.equal(utf8Slice(text, span.absolute_start, span.absolute_end), '£10');
  assert.match(span.semantic_span_id, /^[a-f0-9]{64}$/);
  assert.throws(() => utf8Slice(text, start + 1, end), /code-point boundaries/);
});

test('an excerpt is a distinct, source-backed serving object admitted under the frozen contract', () => {
  const contract = compileFixtureContract();
  const source = sourceFor('The representations are true in all material respects.');
  const start = utf8ByteLength('The representations are ');
  const end = utf8ByteLength(source.canonical_text.text);
  const span = buildSemanticSpan(source, start, end);
  const excerpt = buildExcerpt({ source, span });
  const admission = buildFixtureSourceAdmission({
    source,
    dealKey: 'deal:qxo',
    dealAdmissionId: contentId('DEAL_ADMISSION/V1', 'qxo'),
    contractFingerprint: contract.fingerprint,
  });

  assert.notEqual(excerpt.excerpt_id, span.semantic_span_id);
  assert.equal(excerpt.excerpt_definition_id, FIXTURE_EXCERPT_DEFINITION.excerpt_definition_id);
  assert.equal(excerpt.exact_text, 'true in all material respects.');
  assert.equal(validateExcerpt({ source, excerpt }), true);
  assert.equal(validateFixtureSourceAdmission({
    source,
    admission,
    dealKey: 'deal:qxo',
    dealAdmissionId: contentId('DEAL_ADMISSION/V1', 'qxo'),
    contractFingerprint: contract.fingerprint,
  }), true);

  const badText = { ...excerpt, exact_text: 'true in all respects.' };
  assert.throws(() => validateExcerpt({ source, excerpt: badText }), /exact source bytes/);
  const badOffset = { ...excerpt, absolute_start: 0 };
  assert.throws(() => validateExcerpt({ source, excerpt: badOffset }), /identity|source bytes/);
  assert.throws(() => validateExcerpt({
    source,
    excerpt: { ...excerpt, excerpt_id: span.semantic_span_id },
  }), /identity/);
});

test('a changed admitted source rekeys its excerpt and manifest', () => {
  const contract = compileFixtureContract();
  const first = sourceFor('True in all material respects.');
  const second = sourceFor('True in all respects.');
  const firstSpan = buildSemanticSpan(first, 0, utf8ByteLength(first.canonical_text.text));
  const secondSpan = buildSemanticSpan(second, 0, utf8ByteLength(second.canonical_text.text));
  const firstExcerpt = buildExcerpt({ source: first, span: firstSpan });
  const secondExcerpt = buildExcerpt({ source: second, span: secondSpan });
  const firstAdmission = buildFixtureSourceAdmission({
    source: first,
    dealKey: 'deal:qxo',
    dealAdmissionId: contentId('DEAL_ADMISSION/V1', 'qxo'),
    contractFingerprint: contract.fingerprint,
  });
  const secondAdmission = buildFixtureSourceAdmission({
    source: second,
    dealKey: 'deal:qxo',
    dealAdmissionId: contentId('DEAL_ADMISSION/V1', 'qxo'),
    contractFingerprint: contract.fingerprint,
  });

  assert.notEqual(firstExcerpt.excerpt_id, secondExcerpt.excerpt_id);
  assert.notEqual(firstAdmission.source_admission_manifest_id, secondAdmission.source_admission_manifest_id);
});

test('provision identity binds document hash, byte offsets, concept, complete party tuple and ordinal', () => {
  const text = 'Capitalisation representation. Bring-down condition.';
  const source = sourceFor(text);
  const repEnd = utf8ByteLength('Capitalisation representation.');
  const fullSpan = buildSemanticSpan(source, 0, utf8ByteLength(text));
  const repSpan = buildSemanticSpan(source, 0, repEnd);
  const base = buildProvisionInstance({ source, span: repSpan, conceptKey: 'REP-T-CAP', party: PARTY, ordinal: 1 });

  const variants = [
    buildProvisionInstance({ source, span: fullSpan, conceptKey: 'REP-T-CAP', party: PARTY, ordinal: 1 }),
    buildProvisionInstance({ source, span: repSpan, conceptKey: 'COND-B-REP', party: PARTY, ordinal: 1 }),
    buildProvisionInstance({ source, span: repSpan, conceptKey: 'REP-T-CAP', party: { ...PARTY, role: 'CONDITION_OBLIGOR' }, ordinal: 1 }),
    buildProvisionInstance({ source, span: repSpan, conceptKey: 'REP-T-CAP', party: { ...PARTY, value: 'PARENT' }, ordinal: 1 }),
    buildProvisionInstance({ source, span: repSpan, conceptKey: 'REP-T-CAP', party: { ...PARTY, capacity: 'BUYER' }, ordinal: 1 }),
    buildProvisionInstance({ source, span: repSpan, conceptKey: 'REP-T-CAP', party: PARTY, ordinal: 2 }),
  ];
  for (const variant of variants) assert.notEqual(variant.provision_instance_id, base.provision_instance_id);
  assert.deepEqual(base.party, PARTY);
  assert.equal(base.document_hash, source.document_hash);
  assert.equal(base.absolute_start, 0);
  assert.equal(base.absolute_end, repEnd);

  const component = buildProvisionComponent({
    source,
    parentProvision: base,
    span: repSpan,
    componentKey: 'REPRESENTATION_LIMB',
    ordinal: 1,
  });
  assert.match(component.provision_component_id, /^[a-f0-9]{64}$/);
  assert.equal(component.parent_provision_instance_id, base.provision_instance_id);
});

test('identity builders fail closed on incomplete parties, unknown concepts and invalid byte boundaries', () => {
  const source = sourceFor('£ capitalisation');
  const span = buildSemanticSpan(source, 0, utf8ByteLength(source.canonical_text.text));
  assert.throws(
    () => buildProvisionInstance({ source, span, conceptKey: 'REP-T-CAP', party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY' }, ordinal: 1 }),
    /exactly role, value and capacity/,
  );
  assert.throws(
    () => buildProvisionInstance({ source, span, conceptKey: 'INVENTED-CONCEPT', party: PARTY, ordinal: 1 }),
    /outside the frozen fixture contract/,
  );
  assert.throws(() => buildSemanticSpan(source, 1, 2), /code-point boundaries/);
});
