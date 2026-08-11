'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MAX_INLINE_DEPTH,
  segmentAuthoredInlineLists,
} = require('../lib/canonical-v2/agreement-inline-structure');

const UTF16_COORDINATE_SYSTEM = 'UTF16_CODE_UNIT_HALF_OPEN';

function acceptedLists(result) {
  return result.marker_dispositions.filter((entry) =>
    entry.disposition === 'AUTHORED_INLINE_LIST');
}

function unresolvedLists(result) {
  return result.marker_dispositions.filter((entry) =>
    entry.disposition === 'UNRESOLVED_INLINE_LIST');
}

function nonStructuralReferences(result) {
  return result.marker_dispositions.filter((entry) =>
    entry.disposition === 'NON_STRUCTURAL_MARKER');
}

function labels(list) {
  return list.items.map((item) => item.label);
}

function dispositionMarkers(result) {
  return result.marker_dispositions.flatMap((entry) => entry.marker_offsets)
    .sort((left, right) => left.start - right.start || left.end - right.end);
}

test('segments the Concho 6.9(a) inline list into four sibling limbs', () => {
  const text = [
    'Until December 31 of the calendar year in which the Effective Time occurs, ',
    'Parent shall cause each Company Employee to be provided with ',
    '(i) target cash compensation; ',
    '(ii) equity compensation; ',
    '(iii) employee benefits; and ',
    '(iv) severance benefits.',
  ].join('');

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['i', 'ii', 'iii', 'iv']);
  assert.equal(
    text.slice(result.root_list.chapeau.start, result.root_list.chapeau.end),
    'Until December 31 of the calendar year in which the Effective Time occurs, '
      + 'Parent shall cause each Company Employee to be provided with ',
  );
  assert.deepEqual(result.root_list.items.map((item) => text.slice(
    item.marker_start,
    item.marker_end,
  )), ['(i)', '(ii)', '(iii)', '(iv)']);
  assert.deepEqual(acceptedLists(result).map((entry) => entry.depth), [1]);
});

test('dedents a distinct-style nested list before the next outer sibling', () => {
  const text = 'Parent shall provide (i) certificates, including (A) an officer certificate '
    + 'and (B) a secretary certificate; and (ii) notices.';

  const result = segmentAuthoredInlineLists(text);
  const first = result.root_list.items[0];
  const second = result.root_list.items[1];

  assert.deepEqual(labels(result.root_list), ['i', 'ii']);
  assert.deepEqual(labels(first.child_list), ['A', 'B']);
  assert.equal(first.end, second.start);
  assert.equal(first.child_list.end, second.start);
  assert.equal(text.slice(second.marker_start, second.marker_end), '(ii)');
});

test('retains an adjacent nested marker as authored structure', () => {
  const text = 'Parent shall provide (i)(A) an officer certificate and (B) a secretary '
    + 'certificate; and (ii) notices.';

  const result = segmentAuthoredInlineLists(text);
  const first = result.root_list.items[0];

  assert.deepEqual(labels(result.root_list), ['i', 'ii']);
  assert.deepEqual(labels(first.child_list), ['A', 'B']);
  assert.equal(first.child_list.start, text.indexOf('(A)'));
  assert.equal(nonStructuralReferences(result).some((entry) =>
    entry.marker_offsets.some((marker) => ['A', 'B'].includes(marker.label))), false);
});

test('fails closed when the same marker style restarts without proven parentage', () => {
  const text = 'Parent shall (i) deliver A; and (ii) deliver B; Buyer shall '
    + '(i) deliver C; and (ii) deliver D.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.equal(result.root_list, null);
  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'AMBIGUOUS_SAME_STYLE_RESTART');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), [
    'i', 'ii', 'i', 'ii',
  ]);
});

test('fails closed when same-style markers are out of order', () => {
  const text = 'Parent shall provide (i) first; (iii) third; and (ii) second.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'OUT_OF_ORDER_MARKER_SEQUENCE');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), [
    'i', 'iii', 'ii',
  ]);
});

test('fails closed when a later same-style sibling is out of order', () => {
  const text = 'Parent shall provide (i) one; (ii) two; (iv) four; and (iii) three.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'OUT_OF_ORDER_MARKER_SEQUENCE');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), [
    'i', 'ii', 'iv', 'iii',
  ]);
});

test('fails closed when a later same-style sibling skips the expected marker', () => {
  const text = 'Parent shall provide (i) one; (ii) two; and (iv) four.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'OUT_OF_ORDER_MARKER_SEQUENCE');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), [
    'i', 'ii', 'iv',
  ]);
});

test('does not treat a quantitative parenthetical as a skipped digit sibling', () => {
  const text = 'Parent shall provide (1) the first amount; and (2) a term greater than ten '
    + '(10) years.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['1', '2']);
  assert.deepEqual(unresolvedLists(result), []);
  assert.equal(nonStructuralReferences(result).some((entry) =>
    entry.marker_offsets.some((marker) => marker.label === '10')), true);
});

test('does not truncate an outer Roman list at a nested xyz list', () => {
  const text = 'Parent shall provide (i) one, including (x) x-ray and (y) yield; '
    + '(ii) two; and (iii) three.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['i', 'ii', 'iii']);
  assert.deepEqual(labels(result.root_list.items[0].child_list), ['x', 'y']);
  assert.deepEqual(unresolvedLists(result), []);
});

test('keeps an expected outer Roman x after a nested xyz x and y', () => {
  const text = 'Parent shall provide (i) one; (ii) two; (iii) three; (iv) four; (v) five; '
    + '(vi) six; (vii) seven; (viii) eight; (ix) nine, including (x) nested x and (y) nested y; '
    + '(x) outer ten; and (xi) outer eleven.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi',
  ]);
  assert.deepEqual(labels(result.root_list.items[8].child_list), ['x', 'y']);
  assert.deepEqual(unresolvedLists(result), []);
});

test('uses a later line-start duplicate to dedent nested xyz from outer Roman x', () => {
  const text = 'Parent shall provide (i) one; (ii) two; (iii) three; (iv) four; (v) five; '
    + '(vi) six; (vii) seven; (viii) eight; (ix) nine, in the case of (A) or (B), '
    + '(x) nested x and (y) nested y;\n(x) outer ten; and (xi) outer eleven.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi',
  ]);
  assert.deepEqual(labels(result.root_list.items[8].child_list), ['x', 'y']);
  assert.equal(result.root_list.items[9].marker_start, text.lastIndexOf('(x)'));
});

test('does not extend a bare-reference run through substantive authored text', () => {
  const text = 'Parent approved (i) the first item; (ii) the second item; (iii) the stated '
    + 'standard (this clause (iii), the “Board Recommendation”); and (iv) adopted resolutions.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['i', 'ii', 'iii', 'iv']);
  assert.equal(nonStructuralReferences(result).some((entry) =>
    entry.marker_offsets.some((marker) => marker.start === text.indexOf('(iii),'))), true);
});

test('builds a proven nested list that repeats the parent marker style', () => {
  const text = 'Parent shall provide (i) first, including (i) nested one; and (ii) nested two; '
    + 'and (ii) outer two.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['i', 'ii']);
  assert.deepEqual(labels(result.root_list.items[0].child_list), ['i', 'ii']);
  assert.deepEqual(unresolvedLists(result), []);
});

test('does not promote a same-style child when its outer parent is incomplete', () => {
  const text = 'Parent shall provide (i) one, including (i) inner one; and (ii) inner two.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'AMBIGUOUS_SAME_STYLE_RESTART');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), [
    'i', 'i', 'ii',
  ]);
});

test('keeps a trailing qualification outside the final limb and its child list', () => {
  const text = 'Parent shall provide (i) certificates, including (A) an officer certificate '
    + 'and (B) a secretary certificate; and (ii) notices; provided that both deliveries '
    + 'may be delayed.';
  const trailingStart = text.indexOf('provided that');

  const result = segmentAuthoredInlineLists(text);
  const first = result.root_list.items[0];
  const finalItem = result.root_list.items.at(-1);

  assert.deepEqual(labels(first.child_list), ['A', 'B']);
  assert.equal(result.root_list.end, trailingStart);
  assert.equal(finalItem.end, trailingStart);
  assert.equal(text.slice(result.root_list.end), 'provided that both deliveries may be delayed.');
});

test('keeps a final-limb exception that cites that limb inside the final limb', () => {
  const text = 'Parent shall provide (i) notice; (ii) consent; and (iii) a certificate, '
    + 'except, in the case of this clause (iii), where failure is immaterial.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), ['i', 'ii', 'iii']);
  assert.equal(result.root_list.trailing_qualification, null);
  assert.equal(result.root_list.items.at(-1).end, text.length);
});

test('fails closed when the final item has no substantive payload', () => {
  const text = 'Parent shall (i) deliver A; and (ii); Buyer shall perform the Closing.';

  const result = segmentAuthoredInlineLists(text);
  const unresolved = unresolvedLists(result);

  assert.equal(result.root_list, null);
  assert.deepEqual(result.lists, []);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'INSUFFICIENT_ITEM_PAYLOAD');
  assert.deepEqual(unresolved[0].marker_offsets.map((marker) => marker.label), ['i', 'ii']);
});

test('classifies bare and glued references as non-structural', () => {
  const bare = segmentAuthoredInlineLists(
    'The named rights are Sections (i) Financing Covenant and (ii) No Shop Restriction.',
  );
  const glued = segmentAuthoredInlineLists(
    'Parent shall comply with Section 6.9(a)(i) and Item 601(b)(10).',
  );

  assert.equal(bare.root_list, null);
  assert.ok(nonStructuralReferences(bare).length > 0);
  assert.equal(nonStructuralReferences(bare).some((entry) =>
    entry.reason === 'BARE_CLAUSE_REFERENCE'), true);
  assert.equal(glued.root_list, null);
  assert.ok(nonStructuralReferences(glued).length > 0);
  assert.ok(nonStructuralReferences(glued).every((entry) =>
    entry.reason === 'GLUED_SECTION_REFERENCE'));
});

test('rejects a lone plausible marker without inventing authored structure', () => {
  const text = 'Parent shall perform (i) the first stated obligation.';

  const result = segmentAuthoredInlineLists(text);
  assert.equal(result.root_list, null);
  assert.deepEqual(unresolvedLists(result), []);
  assert.equal(nonStructuralReferences(result).length, 1);
  assert.equal(nonStructuralReferences(result)[0].reason, 'UNCORROBORATED_FIRST_MARKER');
  assert.deepEqual(
    nonStructuralReferences(result)[0].marker_offsets.map((marker) => marker.label),
    ['i'],
  );
});

test('retains every lower-case Roman limb from i through viii', () => {
  const text = 'Parent shall provide (i) one; (ii) two; (iii) three; (iv) four; '
    + '(v) five; (vi) six; (vii) seven; and (viii) eight.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_list), [
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii',
  ]);
  assert.equal(
    text.slice(result.root_list.items.at(-1).marker_start,
      result.root_list.items.at(-1).marker_end),
    '(viii)',
  );
});

test('marks the complete over-depth subtree unresolved', () => {
  const text = 'Root: (i) first; and (ii) level2: (A) first; and (B) level3: '
    + '(1) first; and (2) level4: (a) first; and (b) level5: (x) first; and '
    + '(y) level6: (i) first; and (ii) level7: (A) first; and (B) last.';

  const result = segmentAuthoredInlineLists(text, { maximumDepth: MAX_INLINE_DEPTH });
  const depthSixStart = text.indexOf('(i)', text.indexOf('level6:'));
  const blockedDispositions = result.marker_dispositions.filter((entry) =>
    entry.marker_offsets.some((marker) => marker.start >= depthSixStart));

  assert.equal(result.lists.some((list) => list.depth > MAX_INLINE_DEPTH), false);
  assert.ok(blockedDispositions.length > 0);
  assert.ok(blockedDispositions.every((entry) =>
    entry.disposition === 'UNRESOLVED_INLINE_LIST'));
  assert.ok(blockedDispositions.some((entry) => entry.reason === 'DEPTH_LIMIT'));
  assert.deepEqual(
    [...new Set(blockedDispositions.flatMap((entry) =>
      entry.marker_offsets.map((marker) => marker.label)))],
    ['i', 'ii', 'A', 'B'],
  );
});

test('returns byte-identical results for repeated calls', () => {
  const text = 'Parent shall provide (i) certificates, including (A) an officer certificate '
    + 'and (B) a secretary certificate; and (ii) notices.';

  const first = segmentAuthoredInlineLists(text);
  const second = segmentAuthoredInlineLists(text);

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.deepEqual(dispositionMarkers(first), first.candidate_markers);
});

test('declares UTF-16 offsets and preserves exact slices after curly quotes', () => {
  const text = '“Buyer” shall provide (i) certificates; and (ii) notices.';

  const result = segmentAuthoredInlineLists(text);
  const firstMarker = result.root_list.items[0];

  assert.equal(result.coordinate_system, UTF16_COORDINATE_SYSTEM);
  assert.equal(firstMarker.marker_start, 22);
  assert.equal(Buffer.byteLength(text.slice(0, firstMarker.marker_start), 'utf8'), 26);
  assert.equal(text.slice(firstMarker.marker_start, firstMarker.marker_end), '(i)');
});

test('segments Modiv 5.11 qualification limbs without promoting its bare references', () => {
  const text = 'During the Interim Period, the Company shall use commercially reasonable efforts to provide such cooperation and assistance as Parent may reasonably request to (a) convert or cause the conversion of one or more wholly owned Company Subsidiaries that are organized as corporations into limited liability companies and one or more Company Subsidiaries that are organized as limited partnerships into limited liability companies, on the basis of organizational documents as reasonably requested by Parent, (b) sell or cause to be sold stock, partnership interests, limited liability company interests or other equity interests owned, directly or indirectly, by the Company in one or more wholly owned Company Subsidiaries at a price and on such other terms as designated by Parent, (c) exercise any right of the Company or a Company Subsidiary to terminate or cause to be terminated any Contract to which the Company or a wholly owned Company Subsidiary is a party and (d) sell or cause to be sold any of the assets of the Company or one or more wholly owned Company Subsidiaries at a price and on such other terms as designated by Parent (any action or transaction described in clauses (a) through (d), a “Parent-Approved Transaction”); provided, that (i) neither the Company nor any of the Company Subsidiaries shall be required to take any action in contravention of (A) any organizational document of the Company or any of the Company Subsidiaries, (B) any Contract to which the Company or a Company Subsidiary is a party, or (C) applicable Law, (ii) any transactions contemplated by this Section 5.11, including such conversions, exercises of any rights of termination or other terminations, sales or transactions, including the consummation of any Parent-Approved Transaction or other obligations of the Company or its Subsidiaries to incur any liabilities with respect thereto, shall be contingent upon all of the conditions set forth in Article VI having been satisfied (or, with respect to Section 6.2, waived) and receipt by the Company of a written notice from Parent stating that Parent, Company Merger Sub and Parent OpCo are prepared to proceed immediately with the Closing and irrevocably waiving any right to claim that the conditions to their obligations to consummate the Mergers set forth in Section 6.1 and Section 6.2 have not been satisfied (other than the delivery by the Company at the Closing of the certificate specified in Section 6.2(f) and the opinion specified in Section 6.2(c)), together with any other evidence reasonably requested by the Company that the Closing will occur (it being understood that in any event the transactions described in clauses (a), (b), (c) and (d) will be deemed to have occurred prior to the Closing), (iii) such actions (or the inability to complete such actions) shall not affect or modify in any respect the obligations of Parent, Company Merger Sub or Parent OpCo under this Agreement, including the amount of or timing of payment of the Merger Consideration or the obligation to complete the Mergers in accordance with the terms of this Agreement, or prevent or materially delay beyond the Outside Date the ability of the parties hereto to consummate the Transaction, (iv) neither the Company nor any Company Subsidiary shall be required to take any such action that could adversely affect the classification as a REIT of the Company or any Company Subsidiary that is classified as a REIT or could subject the Company or any such Subsidiary to any “prohibited transactions” Taxes or other material Taxes under Code Sections 857(b), 860(c) or 4981(or other material entity-level Taxes) and (v) neither the Company nor any Company Subsidiary shall be required to take any such action that could result in any U.S. federal, state or local income Tax being imposed on the limited partners of the Partnership or an amount of Taxes being imposed on any stockholder or other equity interest holder of the Company (in such person’s capacity as a stockholder or other equity interest holder of the Company) that are incrementally greater than the Taxes that would be imposed on such party in connection with the consummation of this Agreement in the absence of such action taken pursuant to this Section 5.11.';

  const result = segmentAuthoredInlineLists(text);
  const outer = result.root_lists[0];
  const qualification = outer.trailing_qualification;
  const roman = qualification.child_lists[0];

  assert.deepEqual(labels(outer), ['a', 'b', 'c', 'd']);
  assert.deepEqual(labels(roman), ['i', 'ii', 'iii', 'iv', 'v']);
  assert.deepEqual(labels(roman.items[0].child_lists[0]), ['A', 'B', 'C']);
  assert.equal(unresolvedLists(result).length, 0);
});

test('segments the Skechers Indebtedness qualification after Roman limb viii', () => {
  const text = '“Indebtedness” means any of the following liabilities or obligations: (i) indebtedness for borrowed money (including any principal, premium, accrued and unpaid interest, related expenses, prepayment penalties, commitment and other fees, sale or liquidity participation amounts, reimbursements, indemnities and all other amounts payable in connection therewith); (ii) liabilities evidenced by bonds, debentures, notes or other similar instruments or debt securities; (iii) liabilities pursuant to or in connection with letters of credit or banker’s acceptances or similar items (in each case whether or not drawn, contingent or otherwise); (iv) liabilities pursuant to capitalized leases; (v) liabilities arising out of interest rate and currency swap arrangements and any other arrangements designed to provide protection against fluctuations in interest or currency rates; (vi) deferred purchase price liabilities related to past acquisitions; (vii) payment obligations arising in connection with earnouts or other contingent payment obligations under Contracts (other than contingent indemnification obligations that have not matured and as to which no claims have been made, or to the Knowledge of the Company, threatened); and (viii) indebtedness of others guaranteed by the Company Group or secured by any lien or security interest on the assets of the Company Group; provided, that “Indebtedness” shall exclude (A) any liabilities or obligations of the type specified in clauses (i)-(viii) of this definition that is solely between or among members of the Company Group and (B) trade payables in the ordinary course of business.';

  const result = segmentAuthoredInlineLists(text);
  const roman = result.root_lists[0];
  const exclusions = roman.trailing_qualification.child_lists[0];

  assert.deepEqual(labels(roman), ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']);
  assert.deepEqual(labels(exclusions), ['A', 'B']);
  assert.ok(nonStructuralReferences(result).some((entry) =>
    entry.marker_offsets.some((marker) => marker.start === text.indexOf('(i)-(viii)'))));
  assert.equal(unresolvedLists(result).length, 0);
});

test('keeps the Red Hat 6.01(b) trailing Roman pair as a reference', () => {
  const text = '(i) Any waiting period (and any extension thereof) applicable to the Merger under the HSR Act shall have been terminated or shall have expired and (ii) any other approval or waiting period under any other applicable Antitrust Law of any Governmental Entity in a jurisdiction set forth in Section 6.01(b) of the Company Letter shall have been obtained or terminated or shall have expired, in the case of each of (i) and (ii) without the imposition, individually or in the aggregate, of a Burdensome Condition.';
  const trailingReferenceStart = text.indexOf('(i)', text.indexOf('each of'));

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(labels(result.root_lists[0]), ['i', 'ii']);
  assert.ok(nonStructuralReferences(result).some((entry) =>
    entry.marker_offsets.some((marker) => marker.start === trailingReferenceStart)));
  assert.equal(unresolvedLists(result).length, 0);
});

test('returns two root lists when a sentence boundary proves a same-style restart', () => {
  const text = 'Parent shall (i) deliver A; and (ii) deliver B. '
    + 'Buyer shall (i) deliver C; and (ii) deliver D.';

  const result = segmentAuthoredInlineLists(text);

  assert.deepEqual(result.root_lists.map(labels), [
    ['i', 'ii'],
    ['i', 'ii'],
  ]);
  assert.deepEqual(acceptedLists(result).map((entry) => entry.depth), [1, 1]);
  assert.equal(unresolvedLists(result).length, 0);
});
