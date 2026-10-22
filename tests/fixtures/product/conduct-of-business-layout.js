'use strict';

// Plan finding (199e), work package E12: NCS 5.1's layout as the structure
// reads it (finding (226)), for the long-section split and thin-answer
// pins. Section 5.1: a heading chapeau of one short line ("Section 5.1
// Conduct of Business.", 32 bytes); limb (a) with a two-sentence lead
// (the affirmative covenants, the consent standard, the exceptions) before
// roman sub-limbs; limb (b) with a one-sentence lead before its sub-limbs;
// limb (c) with no sub-limb. Section 5.3: a chapeau that states covenants
// in three sentences, for the chapeau-own-part rule of (199d).

const { createSecIntakeAdapter } = require('../../../lib/product/sec-intake');

const SEC_URL = 'https://www.sec.gov/Archives/edgar/data/1000001/000119312526000001/d1ex21.htm';

const LEAD_A = 'From the date of this Agreement until the earlier of the Effective Time and the termination of this Agreement, except as required by Law, as set forth in the Company Disclosure Letter or as consented to in writing by Parent (such consent not to be unreasonably withheld, conditioned or delayed), the Company shall, and shall cause each of its Subsidiaries to, conduct its business in the ordinary course of business consistent with past practice. The Company shall use its reasonable best efforts to preserve intact its business organisation, keep its assets in good repair, keep available the services of its officers and consultants and preserve its goodwill and relationships with customers, suppliers and others having business dealings with it.';
const LEAD_B = 'Without limiting the generality of the foregoing, except as required by Law, as set forth in the Company Disclosure Letter or as consented to in writing by Parent, the Company shall not, and shall not permit any of its Subsidiaries to:';
const CHAPEAU_53 = 'Section 5.3 No Solicitation. From the date of this Agreement until the Effective Time, the Company shall not solicit, initiate or knowingly encourage any Acquisition Proposal. The Company shall cease all existing discussions with any Person conducted before the date of this Agreement with respect to any Acquisition Proposal. The Company shall promptly request the return or destruction of all confidential information furnished to any such Person.';

const SUB_LIMBS_A = [
  'amend its certificate of incorporation or bylaws or other comparable organisational documents in any material respect, or adopt any plan of complete or partial liquidation, dissolution, restructuring, recapitalisation or other reorganisation;',
  'split, combine, subdivide or reclassify any shares of its capital stock, or declare, set aside or pay any dividend or other distribution (whether in cash, stock or property or any combination thereof) in respect of any shares of its capital stock, other than dividends paid by a wholly owned Subsidiary to the Company;',
  'issue, sell, pledge, dispose of or encumber any shares of its capital stock or any securities convertible into or exercisable for any such shares, other than upon the exercise of Company Options or the settlement of Company RSUs outstanding on the date hereof in accordance with their terms;',
  'acquire any business, assets or equity interests of any Person, by merger, consolidation, purchase of assets or otherwise, for consideration in excess of $5,000,000 in the aggregate, other than purchases of inventory and supplies in the ordinary course of business;',
  'sell, lease, license, transfer or otherwise dispose of any of its material assets, other than sales of inventory in the ordinary course of business and dispositions of obsolete equipment;',
  'enter into, materially amend, waive any material right under or terminate any Material Contract, other than in the ordinary course of business consistent with past practice;',
  'increase the compensation or benefits payable to any director, officer or employee, other than increases in base salary in the ordinary course of business not exceeding three per cent in the aggregate;',
  'settle or compromise any Action for an amount in excess of $1,000,000 individually or $3,000,000 in the aggregate, or that imposes any material restriction on the business of the Company; or',
  'agree, resolve or commit to do any of the foregoing.',
];
const SUB_LIMBS_B = [
  'incur any indebtedness for borrowed money in excess of $10,000,000 in the aggregate, other than borrowings under the Existing Credit Facility in the ordinary course of business; or',
  'make any loans, advances or capital contributions to, or investments in, any other Person in excess of $2,000,000 in the aggregate, other than to or in a wholly owned Subsidiary.',
];
const LIMB_C = 'Nothing contained in this Agreement shall give Parent, directly or indirectly, the right to control or direct the operations of the Company prior to the Effective Time, and prior to the Effective Time the Company shall exercise, consistent with the terms and conditions of this Agreement, complete control and supervision over its operations.';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

function conductOfBusinessHtml() {
  return [
    '<!doctype html><html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body>',
    '<TYPE data-source="filing">EX-2.1', '<TITLE data-source="filing">Agreement and Plan of Merger', '<DESCRIPTION>Agreement and Plan of Merger', '<FILENAME>d1ex21.htm',
    '<h1>AGREEMENT AND PLAN OF MERGER</h1>',
    '<p>by and among ACME CORPORATION, a Delaware corporation (the "Company")</p>',
    '<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>',
    '<p>Dated as of April 13, 2026</p>',
    '<h2>ARTICLE V</h2><h3>COVENANTS</h3>',
    '<p>Section 5.1 Conduct of Business.</p>',
    `<p>(a) ${LEAD_A}</p>`,
    ...SUB_LIMBS_A.map((text, index) => `<p>(${ROMAN[index]}) ${text}</p>`),
    `<p>(b) ${LEAD_B}</p>`,
    ...SUB_LIMBS_B.map((text, index) => `<p>(${ROMAN[index]}) ${text}</p>`),
    `<p>(c) ${LIMB_C}</p>`,
    '<p>Section 5.2 Access.</p><p>The Company shall afford Parent reasonable access to its properties, books and records during normal business hours.</p>',
    `<p>${CHAPEAU_53}</p>`,
    '<p>(a) The Company shall notify Parent promptly, and in any event within twenty-four hours, of the receipt of any Acquisition Proposal, including the material terms and the identity of the Person making it.</p>',
    '<p>(b) The Company shall keep Parent reasonably informed of the status of any Acquisition Proposal, including any material change to its terms, on a current basis.</p>',
    '<p>(c) Nothing in this Section 5.3 shall prohibit the Company Board from complying with Rule 14d-9 and Rule 14e-2 under the Exchange Act with respect to an Acquisition Proposal.</p>',
    '<p>(d) The Company shall not terminate, amend, waive or release any standstill or confidentiality provision to which it is a party, other than to permit a Person to make an Acquisition Proposal to the Company Board.</p>',
    '<h2>ARTICLE VIII</h2><h3>TERMINATION</h3>',
    '<p>Section 8.1 Termination.</p><p>This Agreement may be terminated by mutual written consent of Parent and the Company at any time prior to the Effective Time.</p>',
    '</body></html>',
  ].join('\n');
}

let shared = null;
async function conductOfBusinessSource() {
  if (!shared) {
    const response = new Response(conductOfBusinessHtml(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    Object.defineProperty(response, 'url', { value: SEC_URL });
    const adapter = createSecIntakeAdapter({ fetchImpl: async () => response, clock: () => new Date('2026-09-04T12:00:00Z') });
    shared = adapter.intake({ url: SEC_URL });
  }
  return shared;
}

// The family each section routes to in the tests.
const FAMILY_FOR = { '5.1': 'INTERIM_OPERATING', '5.3': 'NO_SHOP' };

// The counts the part instruction names: the chapeau's sentences, each
// named limb lead's sentences, one for a limb without a lead.
function countsNamed(request) {
  const instruction = request.part_instruction || '';
  const chapeau = /The opening words state (\d+) sentence/.exec(instruction);
  const leads = new Map([...instruction.matchAll(/limb (s\d+) states (\d+) sentences? before its first numbered sub-limb/g)].map((match) => [match[1], Number(match[2])]));
  return { chapeau: chapeau ? Number(chapeau[1]) : 0, leads };
}

// The model answers the counts named, less `shortfall(part, wanted)`.
function countedAnswerFor(request, { familyKey, shortfall = () => 0 }) {
  const family = request.family_contracts.find((item) => item.family_key === familyKey);
  const subtype = family.subtypes[0];
  const part = request.source_closure.extraction_part?.part || 1;
  const operative = request.source_closure.operative;
  const chapeauSpan = request.source_closure.chapeau.find((span) => span.structure_node_id === request.source_closure.structure_node_id) || request.source_closure.chapeau[0];
  const named = countsNamed(request);
  const spans = [];
  if (request.source_closure.extraction_part?.covers_chapeau) for (let index = 0; index < named.chapeau; index += 1) spans.push(chapeauSpan);
  for (const span of operative) for (let index = 0; index < (named.leads.get(span.span_id) ?? 1); index += 1) spans.push(span);
  const wanted = Math.max(0, spans.length - shortfall(part, spans.length));
  const coverage = Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === familyKey && wanted > 0 ? 'FOUND' : 'NOT_FOUND']));
  const proposals = [];
  const groups = [];
  const used = new Map();
  for (let index = 0; index < wanted; index += 1) {
    const span = spans[index];
    const sentences = span.exact_text.split(/(?<=\.)\s+/).filter((item) => item.trim().length > 0);
    const sentence = sentences[(used.get(span.span_id) || 0) % sentences.length];
    used.set(span.span_id, (used.get(span.span_id) || 0) + 1);
    groups.push({ client_ref: `g${index + 1}`, family_key: familyKey, subtype_key: subtype.subtype_key });
    proposals.push({
      client_ref: `p${index + 1}`, group_ref: `g${index + 1}`, family_key: familyKey, subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [`c${index + 1}`], summary: 'The covenant' },
      components: [{ ref: `c${index + 1}`, kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: span.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    });
  }
  return { proposals, groups, links: [], coverage };
}


module.exports = { FAMILY_FOR, countedAnswerFor, countsNamed, CHAPEAU_53, LEAD_A, LEAD_B, LIMB_C, SEC_URL, SUB_LIMBS_A, SUB_LIMBS_B, conductOfBusinessHtml, conductOfBusinessSource };
