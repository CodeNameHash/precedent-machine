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

// Work package C6 (plan finding (130)): the four parser misses of finding
// (129), each pinned with the exhibit's own words. Ben, 2026-10-18:
// "everything to be driven by coding and not just a layer on top so all
// edits need to be repeatable across corpus".

test('C6 (a): Crinetics cover "DATED AS OF JULY 6, 2026," with a trailing comma and the preamble date agree', () => {
  const source = identity([
    'AGREEMENT AND PLAN OF MERGER',
    'DATED AS OF JULY 6, 2026,',
    'AMONG',
    'VERTEX PHARMACEUTICALS INCORPORATED,',
    'CLARK MERGER SUB, INC.',
    'AND',
    'CRINETICS PHARMACEUTICALS, INC.',
    'Table of Contents',
    'This AGREEMENT AND PLAN OF MERGER, dated as of July 6, 2026 (this “Agreement” and, such date, the “Agreement Date”), by and among Vertex Pharmaceuticals Incorporated, a Massachusetts corporation (“Parent”), Clark Merger Sub, Inc., a Delaware corporation and a wholly owned subsidiary of Parent (“Merger Sub”), and Crinetics Pharmaceuticals, Inc., a Delaware corporation (the “Company”).',
  ].join('\n'));
  assert.equal(source.agreement_date, '2026-07-06');
  assert.deepEqual(source.parties, [
    { name: 'Vertex Pharmaceuticals Incorporated', role: 'PARENT' },
    { name: 'Clark Merger Sub, Inc.', role: 'MERGER_SUB' },
    { name: 'Crinetics Pharmaceuticals, Inc.', role: 'COMPANY' },
  ]);
  assert.ok(!source.identity_review_reasons.includes('AGREEMENT_DATE_UNCONFIRMED'));
  assert.ok(!source.identity_review_reasons.includes('PARTIES_UNCONFIRMED'));
});

test('C6 (a): the preamble date alone confirms when the cover has none, and "Dated August 1, 2026" needs no "as of" (Indivior / Supernus)', () => {
  const preambleOnly = identity('This AGREEMENT AND PLAN OF MERGER (this “Agreement”) is dated August 1, 2026, by and among Indivior Pharmaceuticals, Inc., a Delaware corporation (“Indivior”), Artemis Merger Sub Inc., a Delaware corporation (“Merger Sub”), and Supernus Pharmaceuticals, Inc., a Delaware corporation (“Supernus”).');
  assert.equal(preambleOnly.agreement_date, '2026-08-01');
  const coverOnly = identity('AGREEMENT AND PLAN OF MERGER\nby and among\nINDIVIOR PHARMACEUTICALS, INC.,\nARTEMIS MERGER SUB INC.,\nand\nSUPERNUS PHARMACEUTICALS, INC.\nDated August 1, 2026\nTABLE OF CONTENTS');
  assert.equal(coverOnly.agreement_date, '2026-08-01');
  assert.deepEqual(coverOnly.parties.map((party) => party.name), ['INDIVIOR PHARMACEUTICALS, INC.', 'ARTEMIS MERGER SUB INC.', 'SUPERNUS PHARMACEUTICALS, INC.']);
});

test('C6 (a): cover and preamble dates that differ are a conflict, not a date (Alkermes / Avadel: October 22 on the cover, October 21 in the preamble)', () => {
  const source = identity([
    'TRANSACTION AGREEMENT',
    'dated as of October 22, 2025',
    'among',
    'Alkermes plc',
    'and',
    'Avadel Pharmaceuticals plc',
    'TABLE OF CONTENTS',
    'This TRANSACTION AGREEMENT (this “Agreement”), dated as of October 21, 2025, is by and among Alkermes plc, an Irish public limited company with registered number 498284 (“Parent”), and Avadel Pharmaceuticals plc, an Irish public limited company (the “Company”).',
  ].join('\n'));
  assert.equal(source.agreement_date, null);
  assert.ok(source.identity_review_reasons.includes('AGREEMENT_DATE_CONFLICT'));
  assert.deepEqual(source.parties, [{ name: 'Alkermes plc', role: 'PARENT' }, { name: 'Avadel Pharmaceuticals plc', role: 'COMPANY' }]);
});

test('C6 (a): a recital\'s "Confidentiality Agreement dated January 23, 2026, between" is not the agreement date (Chiesi / KalVista)', () => {
  const source = identity([
    'Dated as of April 29, 2026',
    'THIS AGREEMENT AND PLAN OF MERGER (this “Agreement”) is made and entered into as of April 29, 2026, by and among: Chiesi Farmaceutici S.p.A., an Italian società per azioni (“Parent”); Skyline Merger Sub, Inc., a Delaware corporation (“Purchaser”); and KalVista Pharmaceuticals, Inc., a Delaware corporation (the “Company”).',
    'Parent and Purchaser and their Representatives shall hold in confidence in accordance with the Mutual Confidentiality Agreement dated January 23, 2026, between the Company and Parent (as amended, the “Confidentiality Agreement”) the information contained herein.',
  ].join('\n'));
  assert.equal(source.agreement_date, '2026-04-29');
  assert.ok(!source.identity_review_reasons.includes('AGREEMENT_DATE_CONFLICT'));
  assert.deepEqual(source.parties.map((party) => `${party.role}=${party.name}`), ['PARENT=Chiesi Farmaceutici S.p.A.', 'PURCHASER=Skyline Merger Sub, Inc.', 'COMPANY=KalVista Pharmaceuticals, Inc.']);
});

test('C6 (b): the compound closing parenthetical yields the Company (Lilly / Centessa; Merck / Verona Pharma with Bidco)', () => {
  const centessa = identity('This TRANSACTION AGREEMENT, dated as of March 31, 2026 (this “Agreement”), is entered into by and among Eli Lilly and Company, an Indiana corporation (“Parent”), LDH XV Corporation, a Delaware corporation and direct wholly owned Subsidiary of Parent (“Purchaser”), and Centessa Pharmaceuticals plc, a public limited company registered in England and Wales (the “Company” and, together with Parent and Purchaser, the “Parties”).');
  assert.deepEqual(centessa.parties, [
    { name: 'Eli Lilly and Company', role: 'PARENT' },
    { name: 'LDH XV Corporation', role: 'PURCHASER' },
    { name: 'Centessa Pharmaceuticals plc', role: 'COMPANY' },
  ]);
  assert.equal(centessa.agreement_date, '2026-03-31');
  const verona = identity('This TRANSACTION AGREEMENT (this “Agreement”) is made and entered into as of July 8, 2025, by and among Merck Sharp & Dohme LLC, a New Jersey limited liability company (“Parent”), Vol Holdings LLC, a Delaware limited liability company and a wholly owned Subsidiary of Parent (“Bidco”), and Verona Pharma plc, a public limited company registered in England and Wales (the “Company” and, together with Parent and Bidco, the “Parties”).');
  assert.deepEqual(verona.parties, [
    { name: 'Merck Sharp & Dohme LLC', role: 'PARENT' },
    { name: 'Vol Holdings LLC', role: 'BIDCO' },
    { name: 'Verona Pharma plc', role: 'COMPANY' },
  ]);
  assert.equal(verona.agreement_date, '2025-07-08');
});

test('C6 (c): "/" and the other characters corporate names carry, and "by and among:" with a colon (Novo Nordisk / Akero; Genmab / Merus; Roche / 89bio; Merck KGaA)', () => {
  const akero = identity('THIS AGREEMENT AND PLAN OF MERGER (“Agreement”) is made and entered into as of October 9, 2025, by and among: Novo Nordisk A/S, a Danish aktieselsab (“Parent”); NN Invest Sub, Inc, a Delaware corporation and a direct or indirect wholly owned subsidiary of Parent (“Merger Sub”); and Akero Therapeutics, Inc., a Delaware corporation (the “Company”). Certain capitalized terms used in this Agreement are defined in Exhibit A.');
  assert.deepEqual(akero.parties, [
    { name: 'Novo Nordisk A/S', role: 'PARENT' },
    { name: 'NN Invest Sub, Inc', role: 'MERGER_SUB' },
    { name: 'Akero Therapeutics, Inc.', role: 'COMPANY' },
  ]);
  assert.equal(akero.agreement_date, '2025-10-09');
  const merus = identity('This TRANSACTION AGREEMENT (this “Agreement”), dated as of September 29, 2025 (the “Agreement Date”), is made by and among Genmab A/S, a public limited liability company (Aktieselskab) organized under the Laws of Denmark (“Parent”), Genmab Holding II B.V., a private limited liability company (besloten vennootschap met beperkte aansprakelijkheid) organized under the Laws of The Netherlands and a wholly owned Subsidiary of Parent (“Purchaser”), and Merus N.V., a public limited liability company (naamloze vennootschap) organized under the Laws of The Netherlands (the “Company” and together with Parent and Purchaser, collectively, the “parties” and each individually a “party”).');
  assert.deepEqual(merus.parties, [
    { name: 'Genmab A/S', role: 'PARENT' },
    { name: 'Genmab Holding II B.V.', role: 'PURCHASER' },
    { name: 'Merus N.V.', role: 'COMPANY' },
  ]);
  assert.equal(merus.agreement_date, '2025-09-29');
  const bio89 = identity('This AGREEMENT AND PLAN OF MERGER (this “Agreement”), dated as of September 17, 2025, is by and among (i) Roche Holdings, Inc., a Delaware corporation (“Parent”), (ii) Bluefin Merger Subsidiary, Inc., a Delaware corporation and a wholly-owned Subsidiary of Parent (“Merger Sub”), and (iii) 89bio, Inc., a Delaware corporation (the “Company”).');
  assert.deepEqual(bio89.parties.map((party) => party.name), ['Roche Holdings, Inc.', 'Bluefin Merger Subsidiary, Inc.', '89bio, Inc.']);
  const kgaa = identity('This AGREEMENT AND PLAN OF MERGER (this “Agreement”), dated as of April 27, 2025, is entered into by and among SpringWorks Therapeutics, Inc., a Delaware corporation (the “Company”), Merck KGaA, Darmstadt, Germany, a German corporation with general partners (“Parent”), and EMD Holdings Merger Sub, Inc., a Delaware corporation and Wholly Owned Subsidiary of Parent (“Merger Sub” and, together with the Company and Parent, the “Parties” and each, a “Party”).');
  assert.deepEqual(kgaa.parties, [
    { name: 'SpringWorks Therapeutics, Inc.', role: 'COMPANY' },
    { name: 'Merck KGaA, Darmstadt, Germany', role: 'PARENT' },
    { name: 'EMD Holdings Merger Sub, Inc.', role: 'MERGER_SUB' },
  ]);
  const nested = identity('This AGREEMENT AND PLAN OF MERGER (this “Agreement”), is made and entered into as of October 25, 2025, among NOVARTIS AG, a company limited by shares (Aktiengesellschaft) incorporated under the laws of Switzerland (“Parent”), AJAX ACQUISITION SUB, INC., a Delaware corporation and an indirect wholly owned subsidiary of Parent (“Merger Sub”), and AVIDITY BIOSCIENCES, INC., a Delaware corporation (the “Company”).');
  assert.deepEqual(nested.parties.map((party) => `${party.role}=${party.name}`), ['PARENT=NOVARTIS AG', 'MERGER_SUB=AJAX ACQUISITION SUB, INC.', 'COMPANY=AVIDITY BIOSCIENCES, INC.']);
  assert.equal(nested.agreement_date, '2025-10-25');
  const lowercase = identity('THIS AGREEMENT AND PLAN OF MERGER (“Agreement”) is made and entered into as of July 26, 2026 by and among: argenx BV, a private company with limited liability (besloten vennootschap) organized under Belgian law (“Parent”); Avena Merger Sub Inc., a Delaware corporation and a wholly owned Subsidiary of Parent (“Purchaser”); and Forte Biosciences, Inc., a Delaware corporation (the “Company”).');
  assert.deepEqual(lowercase.parties.map((party) => party.name), ['argenx BV', 'Avena Merger Sub Inc.', 'Forte Biosciences, Inc.']);
});

test('C6 (c): the preamble\'s verbs ahead of "among" never become part of the name (GSK / Nuvalent; Novartis / Tourmaline)', () => {
  const nuvalent = identity('AGREEMENT AND PLAN OF MERGER, dated as of June 9, 2026 (this “Agreement”), among GlaxoSmithKline LLC, a Delaware limited liability company (“Parent”), Harmony Row Acquisition Co., a Delaware corporation and wholly owned Subsidiary of Parent (“Purchaser”), Nuvalent, Inc., a Delaware corporation (the “Company”), and, solely for purposes of Section 9.14, GSK plc, a public limited company organized under the laws of England and Wales (“Ultimate Parent”).');
  assert.deepEqual(nuvalent.parties.map((party) => `${party.role}=${party.name}`), ['PARENT=GlaxoSmithKline LLC', 'PURCHASER=Harmony Row Acquisition Co.', 'COMPANY=Nuvalent, Inc.']);
  const tourmaline = identity('THIS AGREEMENT AND PLAN OF MERGER is made and entered into as of September 8, 2025, by and among NOVARTIS AG, a company limited by shares (Aktiengesellschaft) incorporated under the laws of Switzerland (“Parent”); TORINO MERGER SUB INC., a Delaware corporation and an indirect wholly owned Subsidiary of Parent (“Purchaser”); and TOURMALINE BIO, INC., a Delaware corporation (the “Company”).');
  assert.deepEqual(tourmaline.parties.map((party) => party.name), ['NOVARTIS AG', 'TORINO MERGER SUB INC.', 'TOURMALINE BIO, INC.']);
});

test('C6 (d): the cover caption reads "among" and "among:" as well as "by and among", skips description lines and does not join names across "and"', () => {
  const centessa = identity('TRANSACTION AGREEMENT\namong\nELI LILLY AND COMPANY,\nLDH XV\nCORPORATION\nand\nCENTESSA PHARMACEUTICALS PLC\nDated as of March 31, 2026\nTABLE OF CONTENTS');
  assert.deepEqual(centessa.parties.map((party) => party.name), ['ELI LILLY AND COMPANY', 'LDH XV CORPORATION', 'CENTESSA PHARMACEUTICALS PLC']);
  assert.equal(centessa.agreement_date, '2026-03-31');
  const akero = identity('AGREEMENT AND PLAN OF MERGER\namong:\nAKERO THERAPEUTICS, INC.\na Delaware corporation;\nNOVO NORDISK A/S,\na Danish aktieselskab; and\nNN INVEST SUB, INC,\na Delaware corporation\nDated as of October 9, 2025\nTable of Contents');
  assert.deepEqual(akero.parties.map((party) => party.name), ['AKERO THERAPEUTICS, INC.', 'NOVO NORDISK A/S', 'NN INVEST SUB, INC']);
  const verona = identity('TRANSACTION AGREEMENT\nby and among\nMERCK SHARP & DOHME LLC,\nVOL HOLDINGS LLC\nand\nVERONA PHARMA PLC\nDated as of July 8, 2025\nTABLE OF CONTENTS');
  assert.deepEqual(verona.parties.map((party) => party.name), ['MERCK SHARP & DOHME LLC', 'VOL HOLDINGS LLC', 'VERONA PHARMA PLC']);
  const crinetics = identity('AGREEMENT AND PLAN OF MERGER\nDATED AS OF JULY 6, 2026,\nAMONG\nVERTEX PHARMACEUTICALS INCORPORATED,\nCLARK MERGER SUB, INC.\nAND\nCRINETICS PHARMACEUTICALS, INC.\nTable of Contents\nArticle I DEFINITIONS');
  assert.deepEqual(crinetics.parties.map((party) => party.name), ['VERTEX PHARMACEUTICALS INCORPORATED', 'CLARK MERGER SUB, INC.', 'CRINETICS PHARMACEUTICALS, INC.']);
  assert.equal(crinetics.agreement_date, '2026-07-06');
});
