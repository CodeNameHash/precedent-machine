'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { sectionizeAdmittedSource } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { parseStructure } = require('../lib/parser-v2/structural');
const { createPhase1Foundation } = require('../lib/product/phase-1-foundation');
const { createProductIntakeHandler } = require('../lib/product/intake-handler');
const { ProductPhase1StoreError } = require('../lib/product/phase-1-store');
const { createSecIntakeAdapter, parseSecExhibitUrl, ProductSecIntakeError } = require('../lib/product/sec-intake');
const { buildSourceClosure, canonicalCrossScopeReferences, substantiveSections } = require('../lib/product/source-context');
const { displaySectionReference } = require('../lib/product/section-reference-display');

const SEC_URL = 'https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/d840067dex21.htm';
const BLIND_SEC_URL = 'https://www.sec.gov/Archives/edgar/data/1366868/000114036126014528/ef20070409_ex2-1.htm';
const FIXED_TIME = new Date('2026-09-04T12:00:00.000Z');
const ROOT = path.resolve(__dirname, '..');

test('cross-scope reference identity is stable across traversal order and duplicates', () => {
  const first = { reference: '10.03', from_scope: 'Exhibit-A', to_scope: 'MAIN_AGREEMENT', target_node_id: 'b'.repeat(64) };
  const second = { reference: '2.01', from_scope: 'Exhibit-B', to_scope: 'MAIN_AGREEMENT', target_node_id: 'a'.repeat(64) };
  assert.deepEqual(canonicalCrossScopeReferences([first, second, first]), canonicalCrossScopeReferences([second, first]));
  assert.deepEqual(canonicalCrossScopeReferences([first, second, first]), [first, second]);
});

function agreementHtml({ ambiguous = false } = {}) {
  const identity = ambiguous ? '' : [
    '<TYPE data-source="filing">EX-2.1',
    '<TITLE data-source="filing">Agreement and Plan of Merger',
    '<DESCRIPTION>Agreement and Plan of Merger',
    '<FILENAME>d840067dex21.htm',
    '<h1>AGREEMENT AND PLAN OF MERGER</h1>',
    '<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>',
    '<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>',
    '<p>MERGER SUB CORPORATION, a Delaware corporation (the "Merger Sub")</p>',
    '<p>Dated as of April 13, 2026</p>',
  ].join('\n');
  return [
    '<!doctype html><html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body>',
    identity,
    '<h2>ARTICLE I</h2><h3>COVENANTS</h3>',
    '<p>Section 1.1. Delivery.</p><p>Parent shall deliver the Certificate.</p>',
    '<p>Section 1.2. Closing.</p><p>The Closing shall occur promptly.</p>',
    '<h2>ARTICLE II</h2><h3>REPRESENTATIONS</h3>',
    '<p>Section 2.1. Organisation.</p><p>Each party is duly organised.</p>',
    '<h2>ARTICLE III</h2><h3>TERMINATION</h3>',
    '<p>Section 3.1. Termination.</p><p>This Agreement may be terminated.</p>',
    '</body></html>',
  ].join('\n');
}

function secResponse(body, { status = 200, url = SEC_URL, contentType = 'text/html; charset=utf-8' } = {}) {
  const response = new Response(body, { status, headers: { 'content-type': contentType, 'x-test': 'retained' } });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

test('SEC adapter captures one immutable source and confirms document identity', async () => {
  let request;
  const adapter = createSecIntakeAdapter({
    fetchImpl: async (url, options) => { request = { url, options }; return secResponse(agreementHtml()); },
    clock: () => FIXED_TIME,
  });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(request.url, SEC_URL);
  assert.equal(request.options.redirect, 'manual');
  assert.match(request.options.headers['User-Agent'], /@/);
  assert.deepEqual(source.request_headers, request.options.headers);
  assert.equal(source.response_headers['x-test'], 'retained');
  assert.equal(source.http_status, 200);
  assert.equal(source.response_content_type, 'text/html');
  assert.equal(source.redirect_count, 0);
  assert.equal(source.schema_version, 'SOURCE_DOCUMENT/V1');
  assert.equal(source.filing_accession, '0001193125-19-299997');
  assert.equal(source.cik, '98246');
  assert.equal(source.exhibit_type, 'EX-2.1');
  assert.deepEqual(source.parties, [
    { name: 'ACME CORPORATION', role: 'COMPANY' },
    { name: 'BUYER CORPORATION', role: 'PARENT' },
    { name: 'MERGER SUB CORPORATION', role: 'MERGER_SUB' },
  ]);
  assert.equal(source.agreement_date, '2026-04-13');
  assert.equal(source.revision_status, 'original');
  assert.equal(source.identity_status, 'CONFIRMED');
  assert.equal(Buffer.from(source.raw_bytes_base64, 'base64').length, source.raw_byte_length);
  assert.ok(source.canonical_text.length > 0);
  assert.ok(source.source_map_payload_base64.length > 0);
  assert.match(source.source_document_digest, /^[0-9a-f]{64}$/);
  assert.ok(Object.isFrozen(source));
  assert.ok(Object.isFrozen(source.revision));
  assert.doesNotMatch(JSON.stringify(source), /authority|receipt/i);
});

test('SEC adapter fails closed on URL, redirect, final URL, media type and streamed byte limit', async () => {
  assert.throws(() => parseSecExhibitUrl('https://example.com/Archives/edgar/data/98246/000119312519299997/x.htm'), /INVALID_URL/);
  assert.throws(() => parseSecExhibitUrl(`${SEC_URL}?download=1`), /INVALID_URL/);
  assert.equal(parseSecExhibitUrl(BLIND_SEC_URL).filing_accession, '0001140361-26-014528');
  assert.throws(() => parseSecExhibitUrl('https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/index.htm'), /INVALID_EXHIBIT_URL/);
  const cases = [
    [secResponse('', { status: 302 }), 'REDIRECT_REJECTED'],
    [secResponse('x', { url: 'https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/other.htm' }), 'FINAL_URL_REJECTED'],
    [secResponse('x', { url: '', contentType: 'text/html' }), 'FINAL_URL_REJECTED'],
    [secResponse('x', { contentType: 'application/pdf' }), 'INVALID_CONTENT_TYPE'],
  ];
  for (const [response, code] of cases) {
    const adapter = createSecIntakeAdapter({ fetchImpl: async () => response });
    await assert.rejects(adapter.intake({ url: SEC_URL }), new RegExp(code));
  }
  const limited = createSecIntakeAdapter({ fetchImpl: async () => secResponse('123456789'), maxBytes: 8 });
  await assert.rejects(limited.intake({ url: SEC_URL }), /RESPONSE_TOO_LARGE/);
});

test('missing document identity creates one concise review state', async () => {
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(agreementHtml({ ambiguous: true })), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(source.identity_status, 'NEEDS_REVIEW');
  assert.deepEqual(source.identity_review_reasons, [
    'PARTIES_UNCONFIRMED', 'AGREEMENT_DATE_UNCONFIRMED',
  ]);
});

test('short or conflicting identity evidence cannot reach confirmed state', async () => {
  const short = '<html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body><p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p><p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p><p>Dated as of April 13, 2026</p></body></html>';
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(short), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL, exhibit: { type: 'EX-10.1' }, filing: { accession: '0000000000-00-000000' } });
  assert.equal(source.identity_status, 'NEEDS_REVIEW');
  assert.ok(source.identity_review_reasons.includes('ACCESSION_CONFLICT'));
  assert.ok(source.identity_review_reasons.includes('EXHIBIT_TYPE_CONFLICT'));
  assert.ok(source.identity_review_reasons.includes('DOCUMENT_INCOMPLETE'));
});

test('identity keeps valid SEC path fields independent and rejects conflicting caption evidence', async () => {
  const withAnd = agreementHtml().replace(/ACME CORPORATION/g, 'BARNES AND NOBLE HOLDINGS');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(withAnd), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(source.cik, '98246');
  assert.equal(source.filing_accession, '0001193125-19-299997');
  assert.equal(source.parties[0].name, 'BARNES AND NOBLE HOLDINGS');

  const conflictingDates = agreementHtml().replace('</body>', '<p>Dated as of May 14, 2026</p></body>');
  const conflictAdapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(conflictingDates), clock: () => FIXED_TIME });
  const conflict = await conflictAdapter.intake({ url: SEC_URL });
  assert.equal(conflict.agreement_date, null);
  assert.ok(conflict.identity_review_reasons.includes('AGREEMENT_DATE_CONFLICT'));
});

test('identity recognises a caption date split after Dated as of', async () => {
  const splitDate = agreementHtml().replace('Dated as of April 13, 2026', 'Dated as of<br>April 13, 2026');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(splitDate), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(source.agreement_date, '2026-04-13');
  assert.equal(source.identity_review_reasons.includes('AGREEMENT_DATE_UNCONFIRMED'), false);
});

test('identity recognises caption parties followed by as-role labels', async () => {
  const asRoleCaption = agreementHtml()
    .replace('ACME CORPORATION, a Delaware corporation (the "Company")', 'ACME CORPORATION, as the Company,')
    .replace('BUYER CORPORATION, a Delaware corporation (the "Parent")', 'BUYER CORPORATION, as Parent,');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(asRoleCaption), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.ok(source.parties.some((party) => party.name === 'ACME CORPORATION' && party.role === 'COMPANY'));
  assert.ok(source.parties.some((party) => party.name === 'BUYER CORPORATION' && party.role === 'PARENT'));
  assert.equal(source.identity_review_reasons.includes('PARTIES_UNCONFIRMED'), false);
});

test('identity recognises multiple defined parties in one preamble line', async () => {
  const oneLine = agreementHtml()
    .replace('<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>\n<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>', '<p>This Agreement is by and among Acme Corporation, a Delaware corporation (the "Company"), Buyer Corporation, a Delaware corporation ("Parent"), and Merger Sub Corporation.</p>');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(oneLine), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.ok(source.parties.some((party) => party.name === 'Acme Corporation' && party.role === 'COMPANY'));
  assert.ok(source.parties.some((party) => party.name === 'Buyer Corporation' && party.role === 'PARENT'));
  assert.equal(source.identity_review_reasons.includes('PARTIES_UNCONFIRMED'), false);
});

test('identity resolves exact caption parties from paired representations article headings', async () => {
  const html = agreementHtml()
    .replace('<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>\n<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>\n<p>MERGER SUB CORPORATION, a Delaware corporation (the "Merger Sub")</p>', [
      '<p>by and among:</p>',
      '<p>PASSAGE BIO, INC.;</p>',
      '<p>PEREGRINE MERGER SUB, INC.;</p>',
      '<p>REMIX THERAPEUTICS, INC.</p>',
    ].join('\n'))
    .replace('<h2>ARTICLE II</h2><h3>REPRESENTATIONS</h3>', '<h2>Article III REPRESENTATIONS AND WARRANTIES OF REMIX</h2>')
    .replace('<h2>ARTICLE III</h2><h3>TERMINATION</h3>', '<h2>Article IV REPRESENTATIONS AND WARRANTIES OF PASSAGE AND MERGER SUB</h2>');
  const source = await createSecIntakeAdapter({ fetchImpl: async () => secResponse(html), clock: () => FIXED_TIME }).intake({ url: SEC_URL });
  assert.deepEqual(source.parties, [
    { name: 'PASSAGE BIO, INC', role: 'PARENT' },
    { name: 'PEREGRINE MERGER SUB, INC', role: 'MERGER_SUB' },
    { name: 'REMIX THERAPEUTICS, INC', role: 'COMPANY' },
  ]);
});

test('identity does not infer caption roles from prose or ambiguous heading tokens', async () => {
  const html = agreementHtml()
    .replace('<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>\n<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>\n<p>MERGER SUB CORPORATION, a Delaware corporation (the "Merger Sub")</p>', [
      '<p>by and among:</p>',
      '<p>REMIX HOLDINGS, INC.;</p>',
      '<p>REMIX MERGER SUB, INC.;</p>',
      '<p>REMIX THERAPEUTICS, INC.</p>',
    ].join('\n'))
    .replace('<h2>ARTICLE II</h2><h3>REPRESENTATIONS</h3>', '<p>The Article III representations and warranties of Remix follow.</p>')
    .replace('<h2>ARTICLE III</h2><h3>TERMINATION</h3>', '<h2>Article IV REPRESENTATIONS AND WARRANTIES OF REMIX AND MERGER SUB</h2>');
  const source = await createSecIntakeAdapter({ fetchImpl: async () => secResponse(html), clock: () => FIXED_TIME }).intake({ url: SEC_URL });
  assert.equal(source.parties.every((party) => party.role === 'PARTY'), true);
  assert.equal(source.parties.some((party) => party.name.startsWith(':')), false);
});

test('identity does not treat a caption rule as a party', async () => {
  const ruledCaption = agreementHtml().replace('<p>Dated as of April 13, 2026</p>', '<p>_____________________</p><p>Dated as of April 13, 2026</p>');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(ruledCaption), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(source.parties.some((party) => party.name === '_____________________'), false);
  assert.equal(source.identity_status, 'CONFIRMED');
});

test('SGML title participates in amendment classification', async () => {
  const amendment = agreementHtml().replace(
    '<TITLE data-source="filing">Agreement and Plan of Merger',
    '<TITLE data-source="filing">Amendment No. 1 to Agreement and Plan of Merger',
  ).replace('Parent shall deliver the Certificate.', 'The Agreement is hereby amended to read as follows.');
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => secResponse(amendment), clock: () => FIXED_TIME });
  const source = await adapter.intake({ url: SEC_URL });
  assert.equal(source.revision_status, 'amendment');
  assert.equal(source.identity_status, 'NEEDS_REVIEW');
  assert.ok(source.identity_review_reasons.includes('REVISION_UNCONFIRMED'));
});

test('agreement structure excludes external regulatory section citations but retains unresolved agreement references', () => {
  const canonicalText = [
    'ARTICLE I',
    'TAX MATTERS',
    'Section 1.1 Tax Treatment.',
    'The payment is subject to Treasury Regulation Section 1.409A-3, Section 607.1301(6) of the FBCA and Internal Revenue Code Section 368.',
    'The issuance complies with Section 312.03 of the New York Stock Exchange Listed Company Manual.',
    'The parties shall also comply with Section 9.9.',
  ].join('\n');
  const source = sourceFixture();
  const structure = buildAgreementStructure({
    agreement_id: source.source_document_id,
    canonical_text: canonicalText,
    canonical_text_sha256: require('node:crypto').createHash('sha256').update(canonicalText).digest('hex'),
  });
  const references = structure.annotations.filter((item) => item.kind === 'SECTION_REFERENCE').map((item) => item.value);
  assert.deepEqual(references, ['1.1', '9.9']);
  assert.equal(references.includes('1.409'), false);
  assert.equal(references.includes('607.130'), false);
  assert.equal(references.includes('312.03'), false);
});

test('agreement structure excludes sections qualified by a separately defined agreement', () => {
  const canonicalText = [
    'ARTICLE I',
    'DEFINITIONS',
    'Section 1.1 Defined Terms.',
    '“Partnership Agreement” means the Fourth Amended and Restated Agreement of Limited Partnership of the Partnership, dated as of May 30, 2024, together with all amendments, supplements and restatements thereto.',
    '“Support Agreement” means that certain Support Agreement, dated as of March 1, 2026, between Parent and Sponsor.',
    '“Merger Agreement” means this Amended and Restated Agreement and Plan of Merger, as amended from time to time.',
    '“Acquisition Agreement” means the Agreement and Plan of Merger, dated as of March 16, 2026, among Parent, Merger Sub and the Company.',
    '“Shared Agreement” means that certain Agreement, dated as of January 1, 2025, between Parent and Sponsor.',
    '“Shared Agreement” means this Agreement when used in the operative covenants.',
    'ARTICLE II',
    'COVENANTS',
    'Section 2.1 Required Actions.',
    'Pursuant to Section 11.2(a) of the Partnership Agreement, the Partnership shall act.',
    'The parties shall also comply with Section 7.4 of the Support Agreement.',
    'The parties shall also comply with Section 4.2 of the Merger Agreement.',
    'The parties shall also comply with Section 5.5 of the Acquisition Agreement.',
    'The parties shall also comply with Section 6.6 of the Shared Agreement.',
    'The parties shall also comply with Section 9.9 and Section 8.8 of this Agreement.',
  ].join('\n');
  const source = sourceFixture();
  const structure = buildAgreementStructure({
    agreement_id: source.source_document_id,
    canonical_text: canonicalText,
    canonical_text_sha256: require('node:crypto').createHash('sha256').update(canonicalText).digest('hex'),
  });
  const references = structure.annotations.filter((item) => item.kind === 'SECTION_REFERENCE').map((item) => item.value);
  assert.equal(references.includes('11.2(a)'), false);
  assert.equal(references.includes('7.4'), false);
  assert.equal(references.includes('4.2'), true);
  assert.equal(references.includes('5.5'), true);
  assert.equal(references.includes('6.6'), true);
  assert.equal(references.includes('9.9'), true);
  assert.equal(references.includes('8.8'), true);
  const section = structure.nodes.find((node) => node.reference === '2.1');
  const sourceDocument = {
    ...source,
    canonical_text: canonicalText,
    canonical_text_sha256: require('node:crypto').createHash('sha256').update(canonicalText).digest('hex'),
    final_url: SEC_URL,
    filing_accession: '000000000000000001',
    exhibit_filename: 'other-agreement-reference.htm',
    source_map_id: 'd'.repeat(64),
  };
  const closure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: section.node_id });
  assert.equal(closure.spans.find((span) => span.kind === 'FULL_SECTION').exact_text.includes('Section 11.2(a) of the Partnership Agreement'), true);
  assert.deepEqual(closure.context_diagnostics.unresolved_section_references, ['4.2', '5.5', '6.6', '8.8', '9.9']);
});

test('sectioniser retains a bare heading that directly opens a lettered clause', () => {
  const text = [
    'ARTICLE V',
    'COVENANTS',
    '',
    '5.5 Efforts.',
    'The parties shall use reasonable efforts.',
    '5.6 Other Consents and Actions',
    '(a) The Company shall seek third-party consents.',
    '',
    '5.7 Access.',
    'The Company shall provide access.',
  ].join('\n');
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: sha256ForTest(text) });
  assert.ok(tree.nodes.some((node) => node.reference === '5.6'));
  assert.equal(tree.swallowed_heading_residuals.some((item) => item.reference === '5.6'), false);
});

test('sectioniser retains a sole first section bounded by its article', () => {
  const text = [
    'ARTICLE I',
    'THE MERGER',
    '1.1 The Merger. The parties shall complete the merger.',
    'ARTICLE II',
    'CLOSING',
    '2.1 Closing. The closing shall occur electronically.',
    'ARTICLE III',
    'REPRESENTATIONS',
    '3.1 Company Representations. The Company represents to Parent.',
    '3.2 Parent Representations. Parent represents to the Company.',
  ].join('\n');
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: sha256ForTest(text) });
  assert.ok(tree.nodes.some((node) => node.reference === '2.1'));
  assert.equal(tree.rejected_inline_heading_candidates.some((item) => item.reference === '2.1'), false);
});

test('sectioniser tripwire ignores a line-wrapped subsection reference', () => {
  const text = [
    'ARTICLE V',
    'COVENANTS',
    '5.01 Efforts. The parties shall use reasonable efforts subject to Section',
    '45',
    '5.06(b) below, and shall cooperate.',
    '5.02 Notices. The parties shall give notice.',
  ].join('\n');
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: sha256ForTest(text) });
  assert.equal(tree.swallowed_heading_residuals.some((item) => item.reference === '5.6'), false);
});

test('structural gap recovery splits a swallowed prefixed heading from its prior section', () => {
  const text = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE VII',
    'COVENANTS',
    'Section 7.09 Listing Application. The parties shall submit an application under',
    'Section 7.10 State Takeover Statutes. Each party shall take necessary action.',
    'Section 7.11 Transaction Litigation. The Company shall notify Parent.',
  ].join('\n');
  const parsed = parseStructure(text);
  const recovered = parsed.sections.find((section) => section.number === '7.10');
  assert.ok(recovered);
  assert.equal(recovered.recovered, true);
  const prior = parsed.sections.find((section) => section.number === '7.09');
  assert.equal(prior.endChar, recovered.startChar);
  assert.equal(parsed.diagnostics.gaps.includes('7.10'), false);
});

test('structural gap recovery does not split an ordinary line-start internal reference', () => {
  const text = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE VII',
    'COVENANTS',
    'Section 7.09 Listing Application. The parties shall submit an application under',
    'Section 7.10 applies to the filing after notice is delivered.',
    'Section 7.11 Transaction Litigation. The Company shall notify Parent.',
  ].join('\n');
  const parsed = parseStructure(text);
  const bodyReferenceStart = text.lastIndexOf('Section 7.10');
  assert.equal(parsed.sections.some((section) => (
    section.number === '7.10' && section.startChar >= bodyReferenceStart
  )), false);
});

test('structural gap recovery does not treat a title-prefixed reference sentence as a heading', () => {
  const text = [
    'TABLE OF CONTENTS',
    '7.10',
    'State Takeover Statutes',
    'ARTICLE VII',
    'COVENANTS',
    'Section 7.09 Listing Application. The parties shall submit an application under',
    'Section 7.10 State Takeover Statutes require notice before closing.',
    'Section 7.11 Transaction Litigation. The Company shall notify Parent.',
  ].join('\n');
  const parsed = parseStructure(text);
  const bodyReferenceStart = text.lastIndexOf('Section 7.10');
  assert.equal(parsed.sections.some((section) => (
    section.number === '7.10' && section.startChar >= bodyReferenceStart
  )), false);
});

test('structural gap recovery uses an exact contents title when body prose follows the bare heading inline', () => {
  const text = [
    'TABLE OF CONTENTS',
    'ARTICLE VII CONDITIONS TO THE MERGER 80',
    '7.1',
    'Conditions to Each Party’s Obligations to Effect the Merger',
    '81',
    '7.2',
    'Conditions to the Obligations of the Buyer Parties',
    '82',
    '7.3',
    'Conditions to the Obligations of the Company to Effect the Merger',
    '83',
    'ARTICLE I',
    'THE MERGER',
    'Section 1.1 The Merger. The parties shall merge.',
    'Section 1.2 Closing. The closing shall occur.',
    'Section 1.3 Effective Time. The filing shall become effective.',
    'Section 1.4 Effects. The merger shall have its statutory effects.',
    'Section 1.5 Further Action. The parties shall take further action.',
    'ARTICLE VII',
    'CONDITIONS TO THE MERGER',
    '',
    '7.1 Conditions to Each Party’s Obligations to Effect the Merger Each party must satisfy its conditions:',
    '81',
    '7.2 Conditions to the Obligations of the Buyer Parties The obligations of the Buyer Parties to consummate the Merger will be subject to the satisfaction or waiver at or prior to the Effective Time of each of the following conditions, any of which may be waived exclusively by Parent:',
    '(a) The representations shall be true.',
    '',
    '7.3 Conditions to the Obligations of the Company to Effect the Merger The Company must satisfy each condition:',
  ].join('\n');
  const digest = sha256ForTest(text);
  const parsed = sectionizeAdmittedSource({ source_text: text, document_hash: digest });
  const recovered = parsed.nodes.find((node) => node.kind === 'SECTION' && node.reference === '7.2');
  assert.ok(recovered);
  assert.equal(recovered.heading, 'Conditions to the Obligations of the Buyer Parties');
  assert.equal(parsed.swallowed_heading_residuals.some((entry) => entry.reference === '7.2'), false);
});

test('source closure resolves an unambiguous zero-padded internal reference', () => {
  const canonicalText = [
    'ARTICLE VII',
    'COVENANTS',
    '',
    'Section 7.11 Litigation.',
    'This Section is subject to Section 07.12.',
    '',
    'Section 7.12 Notices.',
    'The Company shall notify Parent.',
  ].join('\n');
  const digest = sha256ForTest(canonicalText);
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: digest, agreement_id: digest,
    retrieval_url: SEC_URL, final_url: SEC_URL, filing_accession: '0001193125-19-299997',
    exhibit_filename: 'd840067dex21.htm', source_map_id: digest,
    canonical_text: canonicalText, canonical_text_sha256: digest,
  };
  const structure = buildAgreementStructure(sourceDocument);
  const node = structure.nodes.find((item) => item.reference === '7.11');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: node.node_id });
  assert.deepEqual(closure.context_diagnostics.unresolved_section_references, []);
  assert.ok(closure.cross_reference_span_ids.length > 0);
});

test('exhibit documents retain scoped articles, sections and nearest-scope references', () => {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER',
    'ARTICLE X',
    'MAIN AGREEMENT COVENANTS',
    'Section 10.01 Main Covenant.',
    'The main covenant is subject to Section 10.02 and Section 14.01.',
    'Section 10.02 Main Notice.',
    'The Company shall give notice.',
    'Section 10.03 Main Cooperation.',
    'The parties shall cooperate.',
    '[Signature Page Follows]',
    'EXHIBIT A',
    'FORM OF OPERATIVE AGREEMENT',
    'ARTICLE X',
    'EXHIBIT COVENANTS',
    'Section 10.01 Café Covenant.',
    'This exhibit covenant is subject to Section 10.02.',
    'Section 10.02 Exhibit Notice.',
    'The Company shall give exhibit notice.',
    'ARTICLE XI',
    'EXHIBIT REPRESENTATIONS',
    'Section 11.01 Exhibit Representation.',
    'The Company represents the stated fact subject to Section 10.03.',
    'ARTICLE XII',
    'EXHIBIT REMEDIES',
    'Section 12.01 Exhibit Remedy.',
    'The words ARTICLE XIII in this sentence are ordinary prose.',
    'ARTICLE XIII',
    'EXHIBIT TERMINATION',
    'Section 13.01 Exhibit Termination.',
    'The parties may terminate.',
    'ARTICLE XIV',
    'EXHIBIT MISCELLANEOUS',
    'Section 14.01 Exhibit Governing Law.',
    'New York law governs.',
    'EXHIBIT B',
    'SECOND OPERATIVE AGREEMENT',
    'ARTICLE XIV',
    'SECOND EXHIBIT MISCELLANEOUS',
    'Section 14.01 Second Exhibit Governing Law.',
    '“Company” means only the issuer under this second exhibit. Delaware law governs.',
  ].join('\n');
  const digest = sha256ForTest(canonicalText);
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: digest, agreement_id: digest,
    retrieval_url: SEC_URL, final_url: SEC_URL, filing_accession: '0001193125-19-299997',
    exhibit_filename: 'd840067dex21.htm', source_map_id: digest,
    canonical_text: canonicalText, canonical_text_sha256: digest,
  };
  const structure = buildAgreementStructure(sourceDocument);
  const exhibitScope = structure.nodes.find((node) => node.reference === 'Exhibit-A');
  const main1001 = structure.nodes.find((node) => node.reference === '10.01');
  const exhibit1001 = structure.nodes.find((node) => node.reference === 'Exhibit-A::10.01');
  assert.ok(exhibitScope);
  assert.ok(structure.nodes.some((node) => node.reference === 'Exhibit-A::ARTICLE XIV'));
  assert.ok(exhibit1001);
  assert.notEqual(main1001.node_id, exhibit1001.node_id);
  assert.equal(exhibit1001.parent_id, structure.nodes.find((node) => node.reference === 'Exhibit-A::ARTICLE X').node_id);
  assert.equal(Buffer.from(canonicalText, 'utf8').subarray(exhibit1001.span.start_byte, exhibit1001.span.end_byte).toString('utf8').startsWith('Section 10.01 Café Covenant.'), true);
  assert.equal(structure.nodes.some((node) => node.reference === 'Exhibit-A::ARTICLE XIII' && node.span.start_byte === canonicalText.indexOf('ARTICLE XIII in this sentence')), false);
  const reviewedSections = substantiveSections(structure);
  assert.equal(reviewedSections.some((node) => node.reference === 'Exhibit-A'), false);
  assert.equal(reviewedSections.some((node) => node.reference === 'Exhibit-A::14.01'), true);
  assert.equal(displaySectionReference('Exhibit-A::10.01'), 'Exhibit A, Section 10.01');
  assert.equal(displaySectionReference('10.01'), 'Section 10.01');

  const exhibitClosure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: exhibit1001.node_id });
  assert.deepEqual(exhibitClosure.context_diagnostics.unresolved_section_references, []);
  assert.ok(exhibitClosure.spans.some((span) => span.kind === 'CROSS_REFERENCE'
    && span.structure_node_id === structure.nodes.find((node) => node.reference === 'Exhibit-A::10.02').node_id));
  assert.deepEqual(exhibitClosure.context_diagnostics.cross_scope_section_references, []);

  const exhibit1101 = structure.nodes.find((node) => node.reference === 'Exhibit-A::11.01');
  const crossScopeClosure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: exhibit1101.node_id });
  assert.ok(crossScopeClosure.spans.some((span) => span.kind === 'CROSS_REFERENCE'
    && span.structure_node_id === structure.nodes.find((node) => node.reference === '10.03').node_id));
  assert.deepEqual(crossScopeClosure.context_diagnostics.cross_scope_section_references.map((entry) => ({
    reference: entry.reference, from_scope: entry.from_scope, to_scope: entry.to_scope,
  })), [{ reference: '10.03', from_scope: 'Exhibit-A', to_scope: 'MAIN_AGREEMENT' }]);

  const mainClosure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: main1001.node_id });
  assert.ok(mainClosure.spans.some((span) => span.kind === 'CROSS_REFERENCE'
    && span.structure_node_id === structure.nodes.find((node) => node.reference === '10.02').node_id));
  assert.deepEqual(mainClosure.context_diagnostics.unresolved_section_references, ['14.01']);
  assert.equal(mainClosure.context_diagnostics.cross_scope_section_references.length, 0);
  assert.equal(mainClosure.spans.some((span) => span.kind === 'DEFINITION'
    && span.structure_node_id === structure.nodes.find((node) => node.reference === 'Exhibit-B::14.01').node_id), false);
});

function sha256ForTest(value) {
  return require('node:crypto').createHash('sha256').update(value).digest('hex');
}

class MemoryStore {
  constructor() {
    this.sources = new Map(); this.runs = new Map(); this.requests = new Map(); this.structures = new Map();
    this.events = []; this.failures = []; this.reviews = new Map();
  }
  async findRunBySubmission(input) {
    const run = this.requests.get(input.idempotencyKey);
    if (!run) return null;
    if (run.retrieval_url !== input.url || run.schema_version !== input.schemaVersion
      || run.prompt_bundle_version !== input.promptBundleVersion
      || JSON.stringify(run.model_config) !== JSON.stringify(input.modelConfig)
      || run.explicit_generation !== input.explicitGeneration || run.max_attempts !== input.maxAttempts) {
      throw new ProductPhase1StoreError('IDEMPOTENCY_CONFLICT', 'changed submission');
    }
    return run;
  }
  async findSourceDocumentByUrl(url) { return this.sources.get(url) || null; }
  async persistSourceDocument(source) { this.events.push('persist-source'); this.sources.set(source.retrieval_url, source); return source; }
  async createOrGetRun(input) {
    this.events.push('create-run');
    const generation = [...this.runs.values()].filter((run) => run.source_document_id === input.sourceDocumentId).length + 1;
    const run = { run_id: `run-${this.runs.size + 1}`, source_document_id: input.sourceDocumentId, retrieval_url: input.retrievalUrl,
      idempotency_key: input.idempotencyKey, schema_version: input.schemaVersion, prompt_bundle_version: input.promptBundleVersion,
      model_config: input.modelConfig, explicit_generation: input.explicitGeneration, max_attempts: input.maxAttempts,
      source_generation: generation, status: 'QUEUED', stage: 'STRUCTURE' };
    this.runs.set(run.run_id, run); this.requests.set(input.idempotencyKey, run); return run;
  }
  async getStructureForRun(runId) { return this.structures.get(runId) || null; }
  async attachStructure({ runId, structure, identityReview }) {
    this.events.push('attach-structure'); this.structures.set(runId, structure);
    const run = this.runs.get(runId); run.stage = identityReview ? 'DOCUMENT_IDENTITY_REVIEW' : 'SECTION_ANALYSIS';
    if (identityReview) this.reviews.set(runId, identityReview);
    return run;
  }
  async failRun(input) { this.failures.push(input); const run = this.runs.get(input.runId); run.status = 'FAILED'; run.stage = input.stage; return run; }
}

function sourceFixture(identityStatus = 'CONFIRMED') {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER', 'ARTICLE I', 'COVENANTS', 'Section 1.1. Delivery.', 'Text.',
    'ARTICLE II', 'REPRESENTATIONS', 'Section 2.1. Organisation.', 'Text.',
  ].join('\n');
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256').update(canonicalText).digest('hex');
  return { schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: hash, agreement_id: hash,
    retrieval_url: SEC_URL, canonical_text: canonicalText, canonical_text_sha256: hash,
    identity_status: identityStatus, identity_review_reasons: identityStatus === 'NEEDS_REVIEW' ? ['PARTIES_UNCONFIRMED'] : [] };
}

function submission(overrides = {}) {
  return { url: SEC_URL, idempotencyKey: 'request-1', schemaVersion: 'LEGAL_SCHEMA/V1',
    promptBundleVersion: 'PROMPTS/V1', modelConfig: { model: 'test' }, ...overrides };
}

test('foundation persists source before run, builds structure once and deduplicates retries', async () => {
  const store = new MemoryStore(); let fetches = 0; let builds = 0;
  const source = sourceFixture();
  const foundation = createPhase1Foundation({
    secIntake: { intake: async () => { fetches += 1; return source; } }, store,
    structureBuilder: (value) => {
      builds += 1;
      assert.equal(store.sources.get(SEC_URL), value);
      return { ...buildAgreementStructure(value), builder_revision: builds };
    },
  });
  const first = await foundation.submit(submission());
  const retry = await foundation.submit(submission());
  assert.equal(retry.run_id, first.run_id);
  assert.equal(fetches, 1);
  assert.equal(builds, 1);
  assert.deepEqual(store.events, ['persist-source', 'create-run', 'attach-structure']);

  const changed = await foundation.submit(submission({ idempotencyKey: 'request-2', schemaVersion: 'LEGAL_SCHEMA/V2' }));
  assert.notEqual(changed.run_id, first.run_id);
  assert.equal(changed.source_generation, 2);
  assert.equal(fetches, 1);
  assert.equal(builds, 2);
  assert.equal(store.structures.get(first.run_id).builder_revision, 1);
  assert.equal(store.structures.get(changed.run_id).builder_revision, 2);
  await assert.rejects(foundation.submit(submission({ modelConfig: { model: 'changed' } })), /IDEMPOTENCY_CONFLICT/);
});

test('foundation records identity review and honest structure failure', async () => {
  const reviewStore = new MemoryStore();
  const reviewFoundation = createPhase1Foundation({ secIntake: { intake: async () => sourceFixture('NEEDS_REVIEW') }, store: reviewStore });
  const reviewRun = await reviewFoundation.submit(submission());
  assert.equal(reviewRun.stage, 'DOCUMENT_IDENTITY_REVIEW');
  assert.deepEqual(reviewStore.reviews.get(reviewRun.run_id), { reasons: ['PARTIES_UNCONFIRMED'] });

  const failedStore = new MemoryStore();
  const failedFoundation = createPhase1Foundation({
    secIntake: { intake: async () => sourceFixture() }, store: failedStore,
    structureBuilder: () => { throw new Error('structure failed'); },
  });
  await assert.rejects(failedFoundation.submit(submission()), /structure failed/);
  assert.equal(failedStore.sources.size, 1);
  assert.equal(failedStore.failures.length, 1);
  assert.equal(failedStore.runs.get('run-1').status, 'FAILED');
});

test('foundation resumes a run interrupted after durable run creation', async () => {
  const store = new MemoryStore();
  const source = sourceFixture();
  await store.persistSourceDocument(source);
  const input = submission();
  const interrupted = await store.createOrGetRun({
    sourceDocumentId: source.source_document_id, retrievalUrl: source.retrieval_url,
    idempotencyKey: input.idempotencyKey, schemaVersion: input.schemaVersion,
    promptBundleVersion: input.promptBundleVersion, modelConfig: input.modelConfig,
    explicitGeneration: 0, maxAttempts: 3,
  });
  let builds = 0;
  const foundation = createPhase1Foundation({
    secIntake: { intake: async () => { throw new Error('network must not run'); } }, store,
    structureBuilder: (value) => { builds += 1; return buildAgreementStructure(value); },
  });
  const resumed = await foundation.submit(input);
  assert.equal(resumed.run_id, interrupted.run_id);
  assert.equal(resumed.stage, 'SECTION_ANALYSIS');
  assert.equal(builds, 1);
});

function responseRecorder() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('product intake handler exposes one authenticated server submission boundary', async () => {
  let submitted;
  const handler = createProductIntakeHandler({
    getClient: () => ({ server: true }), intakeFactory: () => ({ intake() {} }), storeFactory: () => ({}),
    modelConfigResolver: () => ({ provider_id: 'SERVER_FIXED' }),
    foundationFactory: () => ({ submit: async (input) => {
      submitted = input;
      return { run_id: 'run-1', source_document_id: 'source-1', source_generation: 2, status: 'QUEUED', stage: 'SECTION_ANALYSIS' };
    } }),
  });
  const response = responseRecorder();
  await handler({ method: 'POST', body: submission({ modelConfig: { provider_id: 'CLIENT_FORGED' } }) }, response);
  assert.equal(response.statusCode, 202);
  assert.deepEqual(submitted.modelConfig, { provider_id: 'SERVER_FIXED' });
  assert.deepEqual(response.body, { run_id: 'run-1', source_document_id: 'source-1', generation: 2, status: 'QUEUED', stage: 'SECTION_ANALYSIS' });
  const wrongMethod = responseRecorder();
  await handler({ method: 'GET' }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
});

test('product intake handler does not expose SEC or database error details', async () => {
  const handler = createProductIntakeHandler({
    getClient: () => ({}), intakeFactory: () => ({}), storeFactory: () => ({}),
    foundationFactory: () => ({ submit: async () => { throw new ProductSecIntakeError('NETWORK_FAILURE', 'secret upstream detail'); } }),
  });
  const prior = console.error; console.error = () => {};
  try {
    const response = responseRecorder();
    await handler({ method: 'POST', body: submission() }, response);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.body, { error: 'SEC intake failed' });
    assert.doesNotMatch(JSON.stringify(response.body), /secret|upstream/i);
  } finally { console.error = prior; }
});

test('migration exposes only server RPC writes and no visible-deal mutation path', () => {
  const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260905020346_product_phase_1_foundation.sql'), 'utf8');
  assert.doesNotMatch(migration, /product_visible_deals/i);
  assert.doesNotMatch(migration, /GRANT\s+(?:[^;]*\b(?:INSERT|UPDATE|DELETE)\b)[^;]*TO service_role/is);
  for (const name of ['persist_source', 'create_run', 'attach_structure', 'resolve_identity', 'claim_section', 'complete_section', 'fail_section', 'save_draft']) {
    assert.match(migration, new RegExp(`product_phase1_${name}[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`, 'i'));
  }
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i);
});
