'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { extractDocumentIdentity } = require('../lib/product/sec-intake');

function identity(canonicalText) {
  return extractDocumentIdentity({
    url: 'https://www.sec.gov/Archives/edgar/data/1/000000000000000001/agreement.htm',
    html: '<html></html>',
    canonicalText,
    exhibit: { type: 'EX-2.1', description: 'Agreement' },
  });
}

test('party identity preserves comma names and explicit Merger Sub markers', () => {
  const source = identity('OLAPLEX HOLDINGS, INC., a Delaware corporation (the “Company”), HENKEL US OPERATIONS CORPORATION, a Delaware corporation (“Parent”) and MARGOT ACQUISITION MERGER SUB, INC., a Delaware corporation and a wholly owned Subsidiary of Parent (“Merger Sub”)');
  assert.deepEqual(source.parties, [
    { name: 'OLAPLEX HOLDINGS, INC.', role: 'COMPANY' },
    { name: 'HENKEL US OPERATIONS CORPORATION', role: 'PARENT' },
    { name: 'MARGOT ACQUISITION MERGER SUB, INC.', role: 'MERGER_SUB' },
  ]);
});

test('party identity preserves full names after a colon and semicolon separators', () => {
  const source = identity('THIS AGREEMENT is made and entered into by and among: Gilead Sciences, Inc., a Delaware corporation (\u201cParent\u201d); Ravens Sub, Inc., a Delaware corporation and a wholly owned Subsidiary of Parent (\u201cPurchaser\u201d); and Arcellx, Inc., a Delaware corporation (the \u201cCompany\u201d).');
  assert.deepEqual(source.parties, [
    { name: 'Gilead Sciences, Inc.', role: 'PARENT' },
    { name: 'Ravens Sub, Inc.', role: 'PURCHASER' },
    { name: 'Arcellx, Inc.', role: 'COMPANY' },
  ]);
});

test('party identity uses the full introduction after cover captions and contents', () => {
  const source = identity([
    'AGREEMENT AND PLAN OF MERGER',
    'by and among OLAPLEX HOLDINGS, INC.; HENKEL US OPERATIONS CORPORATION; and MARGOT ACQUISITION MERGER SUB, INC.',
    'TABLE OF CONTENTS',
    'This AGREEMENT AND PLAN OF MERGER, dated as of March 26, 2026 (this “Agreement”), is made by and among OLAPLEX HOLDINGS, INC., a Delaware corporation (the “Company”), HENKEL US OPERATIONS CORPORATION, a Delaware corporation (“Parent”) and MARGOT ACQUISITION MERGER SUB, INC., a Delaware corporation and a wholly owned Subsidiary of Parent (“Merger Sub”)',
  ].join('\n'));
  assert.deepEqual(source.parties, [
    { name: 'OLAPLEX HOLDINGS, INC.', role: 'COMPANY' },
    { name: 'HENKEL US OPERATIONS CORPORATION', role: 'PARENT' },
    { name: 'MARGOT ACQUISITION MERGER SUB, INC.', role: 'MERGER_SUB' },
  ]);
});

test('party identity keeps later agreement references bounded', () => {
  const source = identity([
    'This AGREEMENT is made by and among OLAPLEX HOLDINGS, INC., a Delaware corporation (the “Company”), HENKEL US OPERATIONS CORPORATION, a Delaware corporation (“Parent”) and MARGOT ACQUISITION MERGER SUB, INC., a Delaware corporation (“Merger Sub”).',
    'The parties refer to an agreement by and among OTHER COMPANY, OTHER PARENT and OTHER SUBSIDIARY.',
  ].join('\n'));
  assert.deepEqual(source.parties, [
    { name: 'OLAPLEX HOLDINGS, INC.', role: 'COMPANY' },
    { name: 'HENKEL US OPERATIONS CORPORATION', role: 'PARENT' },
    { name: 'MARGOT ACQUISITION MERGER SUB, INC.', role: 'MERGER_SUB' },
  ]);
});

test('party identity retains conflicts from later role markers', () => {
  const source = identity([
    'This AGREEMENT is made by and among OLAPLEX HOLDINGS, INC., a Delaware corporation (the “Company”), HENKEL US OPERATIONS CORPORATION, a Delaware corporation (“Parent”).',
    'A later agreement by and among OTHER COMPANY, a Delaware corporation (the “Company”), OTHER PARENT, a Delaware corporation (“Parent”).',
  ].join('\n'));
  assert.equal(source.identity_status, 'NEEDS_REVIEW');
  assert.ok(source.identity_review_reasons.includes('PARTIES_UNCONFIRMED'));
});

test('party identity joins line breaks in names and legal descriptions', () => {
  const source = identity('Acme Holdings,\nInc., a Delaware\ncorporation (the “Company”),\nBuyer Public Limited Company, a Delaware corporation (“Parent”) and\nAcme Merger Sub,\nLLC, a Delaware limited liability company (“Merger Sub”)');
  assert.deepEqual(source.parties, [
    { name: 'Acme Holdings, Inc.', role: 'COMPANY' },
    { name: 'Buyer Public Limited Company', role: 'PARENT' },
    { name: 'Acme Merger Sub, LLC', role: 'MERGER_SUB' },
  ]);
});

test('party identity retains as-role captions and suffixless names', () => {
  const source = identity('Acme Holdings, as the Company,\nBuyer Holdings, as Parent,');
  assert.deepEqual(source.parties, [
    { name: 'Acme Holdings', role: 'COMPANY' },
    { name: 'Buyer Holdings', role: 'PARENT' },
  ]);
});

test('party identity retains LLC and LP names', () => {
  const source = identity('Acme Holdings, LLC, a Delaware limited liability company (the "Company"), Buyer Holdings, L.P., a Delaware limited partnership (the "Parent")');
  assert.deepEqual(source.parties, [
    { name: 'Acme Holdings, LLC', role: 'COMPANY' },
    { name: 'Buyer Holdings, L.P.', role: 'PARENT' },
  ]);
});

test('party identity preserves bare parenthetical role markers', () => {
  const source = identity('Acme Holdings, Inc. (“Company”)\nBuyer Holdings, LLC ("Parent")\nAcme Merger Sub, L.P. ("Merger Sub")');
  assert.deepEqual(source.parties, [
    { name: 'Acme Holdings, Inc.', role: 'COMPANY' },
    { name: 'Buyer Holdings, LLC', role: 'PARENT' },
    { name: 'Acme Merger Sub, L.P.', role: 'MERGER_SUB' },
  ]);
});

test('ambiguous party role markers remain needs review', () => {
  const source = identity('Acme, a Delaware corporation (the “Company”), Other Acme, a Delaware corporation (the “Company”), Buyer LLC, a Delaware limited liability company (“Parent”)');
  assert.equal(source.identity_status, 'NEEDS_REVIEW');
  assert.ok(source.identity_review_reasons.includes('PARTIES_UNCONFIRMED'));
});
