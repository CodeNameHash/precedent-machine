'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCandidateGoverningContext, REASONS, SCHEMA_VERSION } = require('../lib/canonical-v2/native-producer/candidate-governing-context');
const { sha256Hex, utf8ByteLength, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { buildSectionOutline } = require('../lib/canonical-v2/native-producer/governing-structure');

function byteOffset(text, quote, occurrence = 0) {
  const source = Buffer.from(text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  let offset = -1;
  let from = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(needle, from);
    if (offset < 0) throw new Error(`quote not found: ${quote}`);
    from = offset + needle.length;
  }
  return offset;
}

function fixture(sectionText, { sectionReference = '5.1', prefix = '' } = {}) {
  const sourceText = `${prefix}${sectionText}`;
  const sectionStart = utf8ByteLength(prefix);
  const context = Object.freeze({
    canonical_text_id: 'canonical-test-id',
    document_hash: 'document-test-hash',
    canonical_text: Object.freeze({ canonical_text_id: 'canonical-test-id', text: sourceText }),
  });
  const service = createCandidateGoverningContext({
    admittedSourceContext: context,
    sectionsByReference: new Map([[sectionReference, { start: sectionStart, end: sectionStart + utf8ByteLength(sectionText) }]]),
  });
  return { service, context, sourceText, sectionText, sectionReference };
}

function candidate({ sectionReference, sectionText, quote, occurrence = 0, evidence = null, entryEvidence = undefined }) {
  const start = byteOffset(sectionText, quote, occurrence);
  const edge = Object.freeze({
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: `edge-${occurrence}`,
    absolute_start: start,
    absolute_end: start + utf8ByteLength(quote),
  });
  const claim = Object.freeze({ raw_value: quote, evidence: evidence || Object.freeze([edge]) });
  const entry = { section_reference: sectionReference, candidate: { claim } };
  if (entryEvidence !== undefined) entry.evidence = entryEvidence;
  return { entry: Object.freeze(entry), claim, edge };
}

test('binds repeated text to the evidence-addressed leaf with UTF-8 digests', () => {
  const quote = 'same 🎯 operative words';
  const sectionText = [
    'Chapeau: Élan 😀 must act.',
    `(a) first limb ${quote};`,
    `(b) second limb ${quote}; trailing qualifier.`,
  ].join('\n');
  const prepared = fixture(sectionText, { prefix: '😀 document prefix\n' });
  const input = candidate({ sectionReference: prepared.sectionReference, sectionText, quote, occurrence: 1 });
  const result = prepared.service.forCandidate(input);

  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.schema_version, SCHEMA_VERSION);
  assert.equal(result.leaf.path, 'b');
  assert.equal(result.item.path, 'b');
  assert.ok(result.chapeau.some((record) => record.path === null));
  assert.match(result.trailing.text, /trailing qualifier/);
  assert.equal(result.operative.text, quote);
  assert.equal(result.operative.exact_bytes_digest, sha256Hex(Buffer.from(quote, 'utf8')));
  assert.equal(utf8Slice(sectionText, result.leaf.start_byte, result.leaf.end_byte), result.leaf.text);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.chapeau));
  assert.ok(Object.isFrozen(result.operative));
  assert.equal(result.source.section_start_byte, utf8ByteLength('😀 document prefix\n'));
  assert.equal(result.source.canonical_text_id, 'canonical-test-id');
  assert.equal(result.source.document_hash, 'document-test-hash');
});

test('returns detached chapeau, selected item, and only same-leaf trailing text', () => {
  const quote = 'issue equity';
  const sectionText = [
    'The Company shall not:',
    '(a) do either of the following:',
    '(i) issue equity; only with consent;',
    '(ii) incur debt; sibling only.',
  ].join('\n');
  const prepared = fixture(sectionText);
  const result = prepared.service.forCandidate(candidate({ sectionReference: prepared.sectionReference, sectionText, quote }));

  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.item.path, 'a.i');
  assert.ok(result.chapeau.some((record) => record.path === 'a'));
  assert.ok(result.chapeau.some((record) => record.path === null));
  assert.match(result.trailing.text, /only with consent/);
  assert.doesNotMatch(result.trailing.text, /sibling only/);
});

test('refuses missing, conflicting, multiple, wrong-section, and byte-mismatched evidence', () => {
  const sectionText = '(a) correct words;\n(b) other words;';
  const prepared = fixture(sectionText);
  const right = candidate({ sectionReference: prepared.sectionReference, sectionText, quote: 'correct words' });
  const wrongEdge = Object.freeze({ evidence_role: 'OPERATIVE_TEXT', absolute_start: byteOffset(sectionText, 'other words'), absolute_end: utf8ByteLength(sectionText) - 1 });

  assert.equal(prepared.service.forCandidate({ entry: { section_reference: '5.1', candidate: { claim: { raw_value: 'correct words', evidence: [] } } } }).reason, REASONS.EVIDENCE_MISSING);
  assert.equal(prepared.service.forCandidate({ entry: { ...right.entry, evidence: [wrongEdge] } }).reason, REASONS.EVIDENCE_CONFLICT);
  assert.equal(prepared.service.forCandidate({ entry: { section_reference: '5.1', candidate: { claim: { raw_value: 'correct words', evidence: [right.edge, wrongEdge] } } } }).reason, REASONS.EVIDENCE_NOT_SINGLE_OPERATIVE);
  assert.equal(prepared.service.forCandidate({ entry: { section_reference: '9.9', candidate: { claim: right.claim } } }).reason, REASONS.SECTION_UNAVAILABLE);
  const secondSection = '(a) completely different section text;';
  const combinedSource = `${sectionText}\n${secondSection}`;
  const wrongSectionService = createCandidateGoverningContext({
    admittedSourceContext: { canonical_text: { text: combinedSource } },
    sectionsByReference: new Map([
      ['5.1', { start: 0, end: utf8ByteLength(sectionText) }],
      ['5.2', { start: utf8ByteLength(`${sectionText}\n`), end: utf8ByteLength(combinedSource) }],
    ]),
  });
  assert.equal(wrongSectionService.forCandidate({ entry: { section_reference: '5.2', candidate: { claim: right.claim } } }).reason, REASONS.EVIDENCE_BYTES_MISMATCH);
  assert.equal(prepared.service.forCandidate({ entry: { section_reference: '5.1', candidate: { claim: { ...right.claim, raw_value: 'other words' } } } }).reason, REASONS.EVIDENCE_BYTES_MISMATCH);
});

test('propagates structural refusals and treats a markerless section as section-only context', () => {
  const crossing = 'Chapeau.\n(a) first limb.\n(b) second limb.';
  const crossingFixture = fixture(crossing);
  const crossQuote = '(a) first limb.\n(b) second limb.';
  const cross = crossingFixture.service.forCandidate(candidate({ sectionReference: '5.1', sectionText: crossing, quote: crossQuote }));
  assert.equal(cross.status, 'UNDETERMINED');
  assert.equal(cross.reason, 'SPAN_CROSSES_LEAVES');

  const misnested = [
    'The Company shall not:',
    '(a) first item;',
    '(b) second item;',
    'Parent shall not:',
    '(a) target item;',
  ].join('\n');
  const misnestedFixture = fixture(misnested);
  const sameStyle = misnestedFixture.service.forCandidate(candidate({ sectionReference: '5.1', sectionText: misnested, quote: 'target item' }));
  assert.equal(sameStyle.status, 'UNDETERMINED');
  assert.equal(sameStyle.reason, 'SAME_STYLE_CHAIN');

  const markerless = 'Élan agrees to do the complete operative thing.';
  const markerlessFixture = fixture(markerless);
  const markerlessResult = markerlessFixture.service.forCandidate(candidate({ sectionReference: '5.1', sectionText: markerless, quote: 'complete operative thing' }));
  assert.equal(markerlessResult.status, 'RESOLVED');
  assert.equal(markerlessResult.markerless, true);
  assert.equal(markerlessResult.item, null);
  assert.equal(markerlessResult.chapeau.length, 1);
  assert.equal(markerlessResult.chapeau[0].path, null);
});

test('preserves original evidence without mutation for held and open-world shapes', () => {
  const sectionText = '(a) a held proposition;\n(b) an open-world proposition.';
  const prepared = fixture(sectionText);
  for (const quote of ['a held proposition', 'an open-world proposition']) {
    const input = candidate({ sectionReference: '5.1', sectionText, quote });
    const before = structuredClone(input.entry);
    const result = prepared.service.forCandidate(input);
    assert.equal(result.status, 'RESOLVED');
    assert.deepEqual(input.entry, before);
    assert.equal(result.operative.evidence_role, input.edge.evidence_role);
    assert.equal(result.operative.start_byte, input.edge.absolute_start);
    assert.equal(result.operative.end_byte, input.edge.absolute_end);
    assert.equal(result.operative.exact_bytes_digest, sha256Hex(Buffer.from(input.claim.raw_value, 'utf8')));
  }
});

test('uses an outline cache without changing the source or candidate inputs', () => {
  const sectionText = '(a) first item;\n(b) second item;';
  const cache = new Map();
  const prepared = fixture(sectionText);
  const service = createCandidateGoverningContext({
    admittedSourceContext: prepared.context,
    sectionsByReference: new Map([['5.1', { start: 0, end: utf8ByteLength(sectionText) }]]),
    outlineByReference: cache,
  });
  const first = candidate({ sectionReference: '5.1', sectionText, quote: 'first item' });
  const second = candidate({ sectionReference: '5.1', sectionText, quote: 'second item' });
  assert.equal(service.forCandidate(first).status, 'RESOLVED');
  const outline = cache.get('5.1');
  assert.ok(outline);
  assert.equal(service.forCandidate(second).status, 'RESOLVED');
  assert.equal(cache.get('5.1'), outline);
  assert.deepEqual(outline, buildSectionOutline(sectionText));
});
