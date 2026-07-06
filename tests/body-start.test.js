/* Tests for findBodyStart's preamble-anchor path (lib/parser-v2/structural).
   Guards the CSRA/Covance failure class: the same-line-content cascade either
   rejected every body article (CSRA: short section titles -> body start landed
   at Article IX, 96% of the doc discarded) or accepted TOC entries as body
   (Covance: long TOC titles -> every "section" was a stub). Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure, cleanText } = require('../lib/parser-v2/structural');

const BODY_FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.'.repeat(3);

test('CSRA-shape: short same-line section titles after a stub TOC still segment from Article I', () => {
  // TOC = number on its own line, title on the next (stub layout).
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I', '', 'DEFINITIONS', '',
    'Section 1.1', '', 'Definitions', '',
    'Section 2.1', '', 'The Offer', '',
    'Section 9.1', '', 'Amendments and Waivers', '',
    '',
    'This AGREEMENT AND PLAN OF MERGER, dated as of February 9, 2018, is by and among BUYER INC. and TARGET INC.',
    '',
    'WHEREAS, the parties intend to effect the acquisition of the Company;',
    '',
    'ARTICLE I',
    '',
    `Section 1.1 Definitions.${BODY_FILLER}`,
    '',
    'ARTICLE II',
    '',
    // Body header with a SHORT same-line title — the old cascade rejected this.
    `Section 2.1 The Offer.${BODY_FILLER}`,
    '',
    'ARTICLE IX',
    '',
    `Section 9.1 Amendments and Waivers. Subject to the provisions of applicable Law.${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.1') && nums.includes('2.1') && nums.includes('9.1'), `got ${nums}`);
  // The 2.1 section must carry BODY text, not a TOC stub.
  const s21 = sections.find((s) => String(s.number) === '2.1');
  assert.ok((s21.text || '').length > 300, 'body text captured for 2.1');
});

test('Kraft-shape: headerless stub TOC + wrapped SECTION headings anchor from the preamble', () => {
  // Fifth format variant (Heinz/Kraft 2015): NO "TABLE OF CONTENTS" header
  // anywhere, TOC stubs with the "SECTION" prefix and the title on the NEXT
  // line, body headings whose titles are hard-wrapped onto the next line
  // ("SECTION 1.01.\nThe Merger. (a) On the terms ..."), and NO "ARTICLE"
  // heading lines at all (articles are bare title lines). No heading has
  // same-line content, so the legacy sec-1.01 cascade scanned past the whole
  // agreement and anchored the body inside the defined-terms index.
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'Among',
    '',
    'BUYER HOLDING CORPORATION,',
    '',
    'MERGER SUB LLC',
    '',
    'AND',
    '',
    'TARGET GROUP, INC.',
    '',
    'Dated as', // cover date split across lines — must not anchor the preamble
    'of March 24, 2015',
    '',
    // Headerless TOC (stub layout: SECTION line, title on the next line).
    'The Merger',
    '',
    'SECTION 1.01.', '', 'The Merger', '',
    'SECTION 1.02.', '', 'Closing', '',
    'Conditions Precedent',
    '',
    'SECTION 7.01.', '', "Conditions to Each Party's Obligations", '',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of March 24, 2015 (this "Agreement"), among BUYER HOLDING CORPORATION, MERGER SUB LLC and TARGET GROUP, INC.',
    '',
    'WHEREAS the respective boards of directors have approved this Agreement;',
    '',
    'The Merger',
    '',
    ' SECTION 1.01.',
    `The Merger. (a) On the terms and subject to the conditions set forth in this Agreement, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    ' SECTION 1.02.',
    `Closing. The closing of the Merger shall take place at 9:00 a.m. on the third Business Day.${BODY_FILLER}`,
    '',
    'Conditions Precedent',
    '',
    ' SECTION 7.01.',
    `Conditions to Each Party's Obligations. The obligations of the parties are subject to the satisfaction of the following conditions.${BODY_FILLER}`,
  ].join('\n');
  const { sections, articles } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.01') && nums.includes('1.02') && nums.includes('7.01'), `got ${nums}`);
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok(/On the terms/.test(s101.text || ''), '1.01 carries body prose, not the TOC stub');
  assert.ok((s101.text || '').length > 300, 'body text captured for 1.01');
  // Articles are synthesized from the bare title lines before each X.01.
  const artI = articles.find((a) => String(a.number) === 'I');
  assert.ok(artI && /The Merger/.test(artI.title || ''), 'article I synthesized with its title line');
});

test('Verizon-shape: headerless same-line contents stubs do not become sections', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'ARTICLE I',
    'The Merger',
    '',
    ' SECTION 1.01. The Merger',
    '',
    ' SECTION 1.02. Closing',
    '',
    'ARTICLE IV',
    'Representations and Warranties of Parent and Merger Sub',
    '',
    ' SECTION 4.06. Certain Arrangements',
    '',
    ' SECTION 4.07. Brokers and Other Advisors',
    '',
    ' SECTION 4.08. Information Supplied',
    '',
    ' SECTION 4.09. Legal Proceedings',
    '',
    ' SECTION 4.10. Ownership of Equity of the Company',
    '',
    ' SECTION 4.11. No Other Company Representations or Warranties',
    '',
    'ARTICLE V',
    'Additional Covenants and Agreements',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of September 4, 2024, by and among Parent, Merger Sub and the Company.',
    '',
    'W I T N E S S E T H:',
    '',
    'WHEREAS, the parties intend to effect the merger on the terms set forth herein.',
    '',
    'NOW, THEREFORE, the parties hereto agree as follows:',
    '',
    'ARTICLE I',
    'The Merger',
    '',
    `SECTION 1.01. The Merger. Upon the terms and subject to the conditions set forth in this Agreement, Merger Sub shall merge with and into the Company.${BODY_FILLER}`,
    '',
    'ARTICLE IV',
    'Representations and Warranties of Parent and Merger Sub',
    '',
    `SECTION 4.06. Certain Arrangements. As of the date of this Agreement, there are no Contracts or arrangements between Parent, Merger Sub or any of their Affiliates and any stockholder of the Company.${BODY_FILLER}`,
    '',
    `SECTION 4.07. Brokers and Other Advisors. No broker, investment banker or other advisor is entitled to any fee in connection with the transactions.${BODY_FILLER}`,
    '',
    `SECTION 4.08. Information Supplied. None of the information supplied by Parent or Merger Sub will contain any untrue statement of a material fact.${BODY_FILLER}`,
    '',
    `SECTION 4.09. Legal Proceedings. There are no legal proceedings pending against Parent or Merger Sub that would reasonably be expected to prevent the merger.${BODY_FILLER}`,
    '',
    `SECTION 4.10. Ownership of Equity of the Company. Neither Parent nor Merger Sub owns any shares of Company common stock.${BODY_FILLER}`,
    '',
    `SECTION 4.11. No Other Company Representations or Warranties. Parent and Merger Sub acknowledge that the Company makes no other representations except as expressly set forth in this Agreement.${BODY_FILLER}`,
  ].join('\n');

  const { sections } = parseStructure(cleanText(doc));
  const headingOnly = sections.filter((s) =>
    /^SECTION\s+\d+\.\d+\.\s+[^.]+$/i.test(String(s.text || '').trim())
  );
  assert.deepEqual(headingOnly.map((s) => s.number), []);
  const s406 = sections.find((s) => String(s.number) === '4.06');
  assert.ok(s406, '4.06 captured');
  assert.ok((s406.text || '').includes('As of the date of this Agreement'), '4.06 body text captured');
  assert.ok((s406.text || '').length > 300, '4.06 is substantive, not a contents stub');
});

test('no-TOC doc: a false "dated as of" inside Definitions does not hijack the preamble anchor', () => {
  // Bioverativ shape: the real preamble was lost at ingest, the document
  // opens directly at "Section 1.01. Definitions." and a defined term deep
  // in the definitions ("...non-disclosure agreement, dated as of...")
  // matches the preamble regex. A true preamble always PRECEDES the first
  // substantive body heading, so the anchor must be rejected here.
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'ARTICLE 1',
    '',
    'DEFINITIONS',
    '',
    `Section 1.01. Definitions. (a) As used herein, the following terms have the following meanings: "Confidentiality Agreement" means the non-disclosure agreement, dated as of December 4, 2017, between Parent and the Company.${BODY_FILLER}`,
    '',
    `Section 1.02. Other Definitional and Interpretative Provisions. The words "hereof" and "hereunder" refer to this Agreement as a whole.${BODY_FILLER}`,
    '',
    'ARTICLE 2',
    '',
    'THE OFFER',
    '',
    `Section 2.01. The Offer. Subject to the conditions of this Agreement, Buyer shall commence a tender offer for all outstanding shares.${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.01', '1.02', '2.01']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok((s101.text || '').length > 300, '1.01 not truncated by a false preamble anchor');
});

test('Covance-shape: TOC entries with long same-line titles are not mistaken for the body', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    // TOC entries with LONG same-line titles — the old cascade accepted these.
    'Section 1.01. The Merger',
    'Section 1.05. Certificate of Incorporation and Bylaws of the Surviving Corporation',
    'Section 3.01. Representations and Warranties of the Company',
    '',
    'AGREEMENT AND PLAN OF MERGER dated as of November 2, 2014, among BUYER CORPORATION and TARGET INC.',
    '',
    'ARTICLE I',
    '',
    `Section 1.01. The Merger.${BODY_FILLER}`,
    '',
    `Section 1.05. Certificate of Incorporation and Bylaws of the Surviving Corporation.${BODY_FILLER}`,
    '',
    'ARTICLE III',
    '',
    `Section 3.01. Representations and Warranties of the Company. Except as disclosed, the Company represents:${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok(s101, 'section 1.01 found');
  assert.ok((s101.text || '').length > 300, `1.01 must carry body text, got ${(s101.text || '').length} chars (TOC stub bug)`);
});

test('Redfin-shape: legally-bound body anchor beats same-line TOC entries', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I DESCRIPTION OF TRANSACTION 2',
    ' Section 1.1 The Merger 2',
    ' Section 1.2 Effects of the Merger 2',
    '',
    'ARTICLE II REPRESENTATIONS AND WARRANTIES OF THE COMPANY 8',
    ' Section 2.1 Corporate Existence 8',
    ' Section 2.8 Financial Statements; Undisclosed Liabilities; Internal Controls 16',
    '',
    'ARTICLE III REPRESENTATIONS AND WARRANTIES OF PARENT AND MERGER SUB 33',
    ' Section 3.1 Corporate Existence 34',
    ' Section 3.6 Financial Statements; Undisclosed Liabilities; Internal Controls 37',
    '',
    'ARTICLE IV CERTAIN COVENANTS 42',
    ' Section 4.1 Covenants of the Company 42',
    '',
    'AGREEMENT',
    'The Parties, intending to be legally bound, in consideration of the representations, warranties, covenants and other agreements contained herein, agree as follows:',
    'Article I',
    'DESCRIPTION OF TRANSACTION',
    `Section 1.1 The Merger. Upon the terms and subject to the conditions set forth in this Agreement, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    'Article II',
    'REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    `Section 2.1 Corporate Existence. The Company is a corporation duly organised, validly existing and in good standing.${BODY_FILLER}`,
    '',
    `Section 2.8 Financial Statements; Undisclosed Liabilities; Internal Controls. The Company SEC Documents complied with applicable requirements.${BODY_FILLER}`,
    '',
    'Article III',
    'REPRESENTATIONS AND WARRANTIES OF PARENT AND MERGER SUB',
    `Section 3.1 Corporate Existence. Parent is a corporation duly organised, validly existing and in good standing.${BODY_FILLER}`,
    '',
    `Section 3.6 Financial Statements; Undisclosed Liabilities; Internal Controls. The Parent SEC Documents complied with applicable requirements.${BODY_FILLER}`,
    '',
    'Article IV',
    'CERTAIN COVENANTS',
    `Section 4.1 Covenants of the Company. The Company shall carry on its business in the ordinary course.${BODY_FILLER}`,
  ].join('\n');
  const { sections, articles } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.1', '2.1', '2.8', '3.1', '3.6', '4.1']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
  const s21 = sections.find((s) => String(s.number) === '2.1');
  assert.ok((s21.text || '').length > 300, '2.1 carries body text, not the TOC stub');
  assert.ok(articles.some((a) => String(a.number) === 'II'), 'Article II retained');
  assert.ok(articles.some((a) => String(a.number) === 'III'), 'Article III retained');
});

test('Envestnet-shape: operative NOW THEREFORE anchor beats title-page TOC stubs and keeps Exhibit A definitions', () => {
  const doc = [
    'ea020926101ex2-1_envestnet.htm',
    'AGREEMENT AND PLAN OF MERGER, DATED AS OF JULY 11, 2024, BY AND AMONG PARENT, MERGER SUB AND THE COMPANY',
    '',
    'AGREEMENT AND PLAN',
    'OF MERGER',
    '',
    'dated as of',
    '',
    'july 11, 2024',
    '',
    '[[ARTICLE]]Article I[[/ARTICLE]]',
    '[[ARTICLE_TITLE]]DEFINITIONS[[/ARTICLE_TITLE]]',
    '',
    ' [[REF]]Section 1.1[[/REF]]',
    ' Definitions',
    '',
    ' [[REF]]Article II[[/REF]] THE MERGER',
    '',
    ' [[REF]]Section 2.1[[/REF]]',
    ' The Merger',
    '',
    '[[ARTICLE]]Article IV[[/ARTICLE]]',
    '[[ARTICLE_TITLE]]REPRESENTATIONS AND WARRANTIES OF THE COMPANY[[/ARTICLE_TITLE]]',
    '',
    ' [[REF]]Section 4.14[[/REF]]',
    ' Employee Benefit Plans; Employment',
    '',
    'Exhibits',
    '',
    ' Exhibit A',
    ' Certain Definitions',
    '',
    'AGREEMENT AND PLAN',
    'OF MERGER',
    '',
    'THIS AGREEMENT AND PLAN OF MERGER (this [[DEFINED]]"Agreement"[[/DEFINED]]) dated as of July 11, 2024 is by and among BCPE Pequod Buyer, Inc., BCPE Pequod Merger Sub, Inc. and Envestnet, Inc.',
    '',
    'W I T N E S S E',
    'T H:',
    '',
    'WHEREAS, the Parties intend that, on the terms and subject to the conditions set forth in this Agreement, Merger Sub shall merge with and into the Company;',
    '',
    'WHEREAS, the Company, Parent and Merger Sub desire to make certain representations, warranties, covenants and agreements in connection with the Transactions.',
    '',
    'NOW, THEREFORE, in consideration of the promises and the respective representations, warranties, covenants and agreements set forth herein, the Parties hereto agree as follows:',
    '',
    '[[ARTICLE]]Article I[[/ARTICLE]]',
    '',
    '[[ARTICLE_TITLE]]DEFINITIONS[[/ARTICLE_TITLE]]',
    '',
    '[[REF]]Section 1.1[[/REF]]',
    'Definitions. As used in this Agreement, the capitalized terms have the respective meanings ascribed to such terms in Exhibit A or as otherwise defined elsewhere in this Agreement.',
    '',
    '[[ARTICLE]]Article II[[/ARTICLE]]',
    '',
    '[[ARTICLE_TITLE]]THE MERGER[[/ARTICLE_TITLE]]',
    '',
    '[[REF]]Section 2.1[[/REF]]',
    'The Merger.',
    '',
    `(a) On the terms and subject to the conditions set forth in this Agreement, and in accordance with the DGCL, at the Effective Time, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    '[[ARTICLE]]Article IV[[/ARTICLE]]',
    '',
    '[[ARTICLE_TITLE]]REPRESENTATIONS AND WARRANTIES OF THE COMPANY[[/ARTICLE_TITLE]]',
    '',
    '[[REF]]Section 4.14[[/REF]]',
    'Employee Benefit Plans; Employment.',
    '',
    `Except as would not reasonably be expected to have a Company Material Adverse Effect, each Company Benefit Plan has been operated in compliance with applicable Law.${BODY_FILLER}`,
    '',
    'IN WITNESS WHEREOF, the parties hereto have caused this Agreement to be executed.',
    '',
    'Exhibit A',
    '',
    'Certain Definitions',
    '',
    '"Acceptable Confidentiality Agreement" means an agreement with the Company that is either (i) in effect as of the execution and delivery of this Agreement; or (ii) executed, delivered and effective after the execution and delivery of this Agreement, in each case containing provisions that require any counterparty thereto that receives material non-public information to keep such information confidential.',
  ].join('\n');

  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.1', '2.1', '4.14', 'Exhibit-A']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
  const s11 = sections.find((s) => String(s.number) === '1.1');
  assert.ok((s11.text || '').includes('capitalized terms have the respective meanings'), '1.1 carries body text, not the TOC stub');
  assert.ok((s11.text || '').length > 130, '1.1 body text captured');
  const s414 = sections.find((s) => String(s.number) === '4.14');
  assert.ok((s414.text || '').length > 300, '4.14 carries body text, not the TOC stub');
  const exhibit = sections.find((s) => String(s.number) === 'Exhibit-A');
  assert.ok(/Acceptable Confidentiality Agreement/.test(exhibit.text || ''), 'Exhibit A definitions captured');
});

test('legally-bound inline path keeps short Section 1.1 when Article I is absent', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I DESCRIPTION OF TRANSACTION 2',
    ' Section 1.1 Definitions 2',
    ' Section 1.2 The Merger 3',
    '',
    'AGREEMENT',
    'The Parties, intending to be legally bound, in consideration of the representations, warranties, covenants and other agreements contained herein, agree as follows:',
    'Section 1.1 Definitions.',
    '"Agreement" means this Agreement and Plan of Merger.',
    '',
    `Section 1.2 The Merger. Upon the terms and subject to the conditions set forth in this Agreement, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    `Section 1.3 Closing. The closing of the Merger shall take place remotely via the electronic exchange of documents.${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.1', '1.2', '1.3']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
});

test('TopBuild-shape: bare headings with no space after the number still segment', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE III Representations and Warranties -- 3.1',
    'ARTICLE IV Covenants -- 4.1',
    'ARTICLE V Conditions -- 5.1',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, among BUYER INC., MERGER SUB INC. and TARGET CORP.',
    '',
    'WHEREAS, the parties intend to effect the merger;',
    '',
    'ARTICLE III',
    '',
    'Representations and Warranties',
    '',
    `3.1Representations and Warranties of the Company. Except as set forth in the Company Disclosure Letter, the Company represents and warrants to Parent as follows.${BODY_FILLER}`,
    '',
    `3.2Capitalization. The authorized capital stock of the Company consists of shares of common stock and preferred stock.${BODY_FILLER}`,
    '',
    'ARTICLE IV',
    '',
    'Covenants',
    '',
    `4.1Interim Operations of the Company. From the date of this Agreement until the Effective Time, the Company shall conduct its business in the ordinary course.${BODY_FILLER}`,
    '',
    'ARTICLE V',
    '',
    'Conditions',
    '',
    `5.1Conditions to Each Party's Obligation to Effect the Merger. The obligations of the parties are subject to the satisfaction or waiver of the following conditions.${BODY_FILLER}`,
    '',
    `5.2Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub. Parent's obligations are subject to the satisfaction or waiver of the following further conditions.${BODY_FILLER}`,
    ].join('\n');

  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['3.1', '3.2', '4.1', '5.1', '5.2']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
  const s31 = sections.find((s) => String(s.number) === '3.1');
  assert.match(s31.title || '', /Representations and Warranties of the Company/);
  assert.ok((s31.text || '').length > 300, '3.1 carries body text, not an article intro blob');
});
