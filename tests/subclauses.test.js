// Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
// Part 1 — pinned-fixture tests for lib/parser-v2/subclauses.js.
//
// QXO_5_2_TEXT and REDFIN_2_10_TEXT are the REAL, VERBATIM stored section
// text (deals.metadata.classified_sections[].text), fetched read-only from
// Supabase and pinned here as static strings — segmentSubClauses() is a pure
// function and must not hit the network at test time.
//   QXO_5_2_TEXT    — deal 7dc3a05f-b170-4d59-a255-b7103cca16e1, section 5.2
//                      ("Additional Conditions to the Obligations of Parent,
//                      Titanium Merger Sub and Forward Merger Sub"), the
//                      COND-B tiered rep bring-down defect fixture.
//   REDFIN_2_10_TEXT — deal b57d0d65-d9d6-4e77-8e2e-08da4eb58f81, section
//                      2.10 ("Employees; Employee Benefits"), the REP-T
//                      mid-provision-loss defect fixture.
//
// NOTE on QXO §5.2's real shape vs. the spec's description: the spec's
// defect writeup describes "(a)(i), (a)(ii)(A-D), (b), (c)" from memory of
// the bug report. The REAL stored text has only TWO top-level markers —
// (a) (containing (i), (ii)(A-D), (iii)) and (b) (the bring-down
// certificate) — there is no separate top-level (c); what the spec called
// "(c) certificate" is this (b). Pinned here is the real structure, per the
// task instruction to fetch and pin the actual stored text.
const test = require('node:test');
const assert = require('node:assert/strict');

const { segmentSubClauses } = require('../lib/parser-v2/subclauses.js');

const QXO_5_2_TEXT = "5.2Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub. The obligations of Parent, Titanium Merger Sub and Forward Merger Sub to effect the Mergers are subject to the satisfaction or waiver at or prior to the Titanium Merger Effective Time of each of the following further conditions:\n\n(a)\n\n(i)The Company shall have performed in all material respects all of its obligations hereunder required to be performed by it as of or prior to the Closing Date;\n\n(ii)(A) the representations and warranties of the Company set forth in Section 3.1(f)(i)(B) (Absence of Certain Changes) shall be true and correct in all respects at and as of the date of this Agreement and at and as the Closing Date as though made at and as of the Closing Date, (B) the representations and warranties of the Company set forth in Section 3.1(b)(i) and Section 3.1(b)(iii) (Capital Structure) shall be true and correct at and as of the date of this Agreement and the Closing Date as though made at and as of the Closing Date except for De Minimis Inaccuracies, (C) the representations and warranties of the Company set forth in Section 3.1(a) (Organization, Good Standing and Qualification), Section 3.1(b) (Capital Structure) (other than Section 3.1(b)(i) and Section 3.1(b)(iii) thereof), Section 3.1(c) (Corporate Authority and Approval) and Section 3.1(s) (Brokers and Finders) shall be true and correct (disregarding all qualifications or limitations as to \"material\", \"materiality\" or \"Company Material Adverse Effect\") in all material respects at and as of the date of this Agreement and the Closing Date as though made at and as of the Closing Date and (D) any of the other representations and warranties of the Company set forth in this Agreement (other than those listed in the preceding clauses (A), (B) and (C)) shall be true and correct at and as of the date of this Agreement and the Closing Date as though made at and as of the Closing Date, except where the failure to be so true and correct (disregarding all qualifications or limitations as to \"material\", \"materiality\" or \"Company Material Adverse Effect\") would not, individually or in the aggregate, reasonably be expected to have a Company Material Adverse Effect; provided, however, that, with respect to clauses (A), (B), (C) and (D) above, representations and warranties that are made as of a particular date or period shall be true and correct (in the manner set forth in clause (A), (B), (C) or (D), as applicable) only as of such date or period. For purposes of this Agreement, \"De Minimis Inaccuracies\" means any inaccuracies that individually or in the aggregate are de minimis relative to the total fully diluted equity capitalization of the Company or Parent, as the case may be; and\n\n(iii)No Company Material Adverse Effect shall have occurred since the date of this Agreement.\n\n(b)Parent shall have received a certificate of the Company, executed on its behalf by an authorized officer of the Company, dated the Closing Date, certifying that the conditions set forth in Section 5.2(a)(i), Section 5.2(a)(ii) and Section 5.2(a)(iii) have been satisfied.";

const REDFIN_2_10_TEXT = "Section 2.10 Employees; Employee Benefits.\n(a)Section 2.10(a) of the Company Disclosure Letter sets forth a complete list of all material Company Benefit Plans other than offer letters and other agreements, understandings, plans or arrangements related to U.S. employees or other service providers that are terminable (i) \"at will\" or for convenience and (ii) without the payment of severance, notice pay, accelerated vesting in or payment of compensation or any other material obligations (except pursuant to any Company Benefit Plan listed in Section 2.10(a) of the Company Disclosure Letter).\n(b)The Company and its Subsidiaries are in compliance, and have been in compliance since January 1, 2023, with all applicable Laws regarding employment practices, terms and conditions of employment, worker classification (including classification of independent contractors and or exempt and non-exempt employees), equal opportunity and wages and hours, including WARN, ERISA, COBRA and the Fair Labor Standards Act of 1938, as amended, other than instances of noncompliance that have not had, and would not reasonably be expected to have, individually or in the aggregate, a Company Material Adverse Effect.\n(c)There is not presently pending, existing or threatened in writing, any strike, slowdown, picketing, work stoppage or labor dispute, nor, to the knowledge of the Company, has any such event existed or been threatened since January 1, 2023. Neither the Company nor any of its Subsidiaries is party to or bound by any collective bargaining agreement, works council or labor Contract, other than such agreements or Contracts that are mandated by applicable Law, and no such agreement is being negotiated by the Company or any Subsidiary thereof and, to the knowledge of the Company, there are no union organizing activities involving the employees of the Company and its Subsidiaries to authorize representation by any labor union, nor, to the knowledge of the Company, has any such organizing occurred or been threatened since January 1, 2023.\n(d)The Company has made available to Parent, with respect to each material Company Benefit Plan, where applicable, true and complete copies of (i) all current documents setting forth the terms of each such Company Benefit Plan, including the plan document, all amendments thereto and all related trust documents, insurance contracts and policies, material ancillary documents and certificates of coverage (or, in the case of any unwritten Company Benefit Plan, a description thereof), (ii) the most recent annual report on Form 5500 thereto (including any related actuarial valuation reports and accompanying schedules) filed with the Internal Revenue Service with respect to each Company Benefit Plan (if any such report was required), (iii) the most recent summary plan description for each Company Benefit Plan for which such summary plan description is required, together with any summaries of material modifications thereto, (iv) the most recent determination, advisory or opinion letter issued by the Internal Revenue Service relating to the tax-qualified status of each applicable Company Benefit Plan and (v) all material, non-routine correspondence to or from any governmental body, agency, authority or entity.\n\n(e)There has been no amendment to, written interpretation or material announcement by the Company or its Subsidiaries relating to, changes in employee participation or coverage under, or adoption of, any Company Benefit Plan which would increase materially the expense of maintaining such Company Benefit Plan above the level of expense incurred in respect thereof for the 12 months ended on December 31, 2024.\n(f)None of the Company, its Subsidiaries, or any of their ERISA Affiliates, nor any predecessor thereof, sponsors, maintains or contributes to, or within the past six years, has sponsored, maintained or contributed to, a multiemployer plan within the meaning of Section 3(37) of ERISA. None of the Company, its Subsidiaries or any of their ERISA Affiliates has incurred any unsatisfied material Liability (including withdrawal Liability) under, and, to the knowledge of the Company, no circumstances exist that would result in any material Liability to the Company, any of its Subsidiaries or any of their ERISA Affiliates under, Title IV of ERISA or Section 412 of the Code or Section 302 of ERISA. No Company Benefit Plan provides for retiree health benefits or retiree life benefits (other than such benefits required by Section 4980B of the Code or Section 601 of ERISA or similar state law).\n(g)Each Company Benefit Plan has been maintained, operated and administered in compliance with its terms and applicable Law, including ERISA and the Code, except for any such noncompliance as would not, individually or in the aggregate, reasonably be expected to have a Company Material Adverse Effect. Each Company Benefit Plan that is intended to be qualified under Section 401(a) of the Code has received a favorable determination letter from the IRS or is the subject of a favorable opinion letter from the IRS on the form of such Company Benefit Plan, to the effect that each such Company Benefit Plan is qualified and exempt from federal income Tax under Sections 401(a) and 501(a) of the Code and, to the knowledge of the Company, there are no facts or circumstances that would be reasonably likely to adversely affect the qualified status of any such Company Benefit Plan in any material respect. Except as would not, individually or in the aggregate, reasonably be expected to have a material effect on the Company and its Subsidiaries, taken as a whole, all contributions, distributions or other amounts payable by the Company or any of its Subsidiaries as of the Effective Time pursuant to each Company Benefit Plan in respect of current or prior plan years have been timely paid in accordance with applicable law or, to the extent not yet due, have been accrued in accordance with GAAP. Neither the Company nor any of its Subsidiaries has engaged in a transaction in connection with which the Company or its Subsidiaries could be subject to either a civil penalty assessed pursuant to Section 409 or 502(i) of ERISA or a Tax imposed pursuant to Section 4975 or 4976 of the Code. No Company Benefit Plan provides and neither the Company, its Subsidiaries, nor its ERISA Affiliates have any liability in respect of, post-termination medical or life insurance benefits to any Person, other than as required by applicable Law. There is no pending or, to the knowledge of the Company, threatened audit, investigation or legal action by or legal action brought before a Governmental Authority by or on behalf of any Company Benefit Plan or otherwise involving any such Company Benefit Plan (other than routine claims for benefits), nor, to the knowledge of the Company, has any such event occurred since January 1, 2023.\n(h)The execution and delivery of this Agreement and the consummation of the Transactions will not (i) entitle any employee to any materially extra or increased statutory severance pay under any Company Benefit Plan, (ii) result in any material payment becoming due, accelerate the time of payment or vesting of benefits, or increase the amount of compensation due to any executive level employee under any Company Benefit Plan or (iii) result in any forgiveness of Indebtedness, trigger any funding obligation under any Company Benefit Plan that is sponsored or maintained by the Company.\n(i)With respect to any Company Employee, none of the Company, its Subsidiaries or any ERISA Affiliate thereof has any indemnity or gross-up obligation for any excise taxes or penalties or interest imposed or accelerated under Sections 409A or 4999 of the Code.\n(j)No amount or benefit that could reasonably be, or has been, received (whether in cash or property or the vesting of property or the cancellation of Indebtedness) by any current or former Company Employee who is a \"disqualified individual\" within the meaning of Section 280G of the Code, pursuant to Contracts in existence at the Closing, could reasonably be characterized as an \"excess parachute payment\" (as defined in Section 280G(b)(1) of the Code) as a result of the consummation of the Transactions.\n(k)Each Company Benefit Plan maintained outside the jurisdiction of the United States, or that covers any employee residing or working outside the United States that is required to be registered or approved by any Governmental Authority, has been so registered and approved, except where failure to register or gain approval will not result in a material liability to the Company and its Subsidiaries (taken as a whole), and to the knowledge of the Company, has been maintained in good standing with applicable requirements of Governmental Authority.\n(l)There has been no \"mass layoff\" or \"plant closing\" (as defined by WARN) with respect to the Company or any of its Subsidiaries since January 1, 2023, and neither the Company nor any of its Subsidiaries has incurred any material Liability under WARN that remains unsatisfied.\n(m)Except as would not reasonably be expected to have a Company Material Adverse Effect, individually or in the aggregate, during the three years prior to the Agreement Date, (i) the Company has investigated any allegation of sexual harassment or other sexual misconduct or race discrimination made by any current or former employee or independent contractor of the Company or any of its Subsidiaries against any employee of the Company or its Subsidiaries with the title of vice president or above through any formal human resources communication channels at the Company (including an anonymous employee hotline, if any), (ii) there is no action, suit, investigation or proceeding pending or, to the Company's knowledge, threatened related to any allegation of sexual harassment, other sexual misconduct or race discrimination made by any current or former employee or independent contractor of the Company or any of its Subsidiaries against any Company Employee with the title of vice president or above and (iii) neither the Company nor any of its Subsidiaries have entered into any settlement agreements related to allegations of sexual harassment, other sexual misconduct or race discrimination made by any current or former employee or independent contractor of the Company or any of its Subsidiaries against any Company Employee with the title of vice president or above.";

// ---------------------------------------------------------------------------
// Shared invariant: leaves partition the section (no overlaps, monotonic,
// and total dropped chars — marker tokens + inter-leaf whitespace — is
// small relative to section length).
// ---------------------------------------------------------------------------
function assertLeavesPartition(t, leaves, sectionText) {
  let cursor = 0;
  let coveredChars = 0;
  for (const leaf of leaves) {
    assert.ok(leaf.start >= cursor, `leaf ${leaf.marker} starts before cursor (overlap)`);
    assert.ok(leaf.end > leaf.start, `leaf ${leaf.marker} has non-positive length`);
    assert.equal(leaf.text, sectionText.slice(leaf.start, leaf.end), `leaf ${leaf.marker} text does not match its own [start,end) slice`);
    coveredChars += leaf.end - leaf.start;
    cursor = Math.max(cursor, leaf.end);
  }
  assert.ok(cursor <= sectionText.length, 'leaves run past the end of the section text');
  const dropped = sectionText.length - coveredChars;
  // Only marker tokens themselves ("(a)", "(ii)") and pure-whitespace gaps
  // between leaves are ever unaccounted for — never substantive prose.
  assert.ok(dropped < sectionText.length * 0.05, `dropped ${dropped} chars of ${sectionText.length} (>5%) — segmentation is losing content, not just markers/whitespace`);
}

test('QXO Section 5.2: tiered COND-B rep bring-down segments into (a.i), (a.ii.A-D), (a.iii), (b)', () => {
  const leaves = segmentSubClauses(QXO_5_2_TEXT);
  assertLeavesPartition(null, leaves, QXO_5_2_TEXT);

  const markers = leaves.filter((l) => l.marker !== null).map((l) => l.marker);
  assert.deepEqual(markers, ['a.i', 'a.ii.A', 'a.ii.B', 'a.ii.C', 'a.ii.D', 'a.iii', 'b']);

  const byMarker = Object.fromEntries(leaves.map((l) => [l.marker, l]));
  assert.equal(byMarker['a.i'].depth, 2);
  assert.equal(byMarker['a.ii.A'].depth, 3);
  assert.equal(byMarker['a.ii.B'].depth, 3);
  assert.equal(byMarker['a.ii.C'].depth, 3);
  assert.equal(byMarker['a.ii.D'].depth, 3);
  assert.equal(byMarker['a.iii'].depth, 2);
  assert.equal(byMarker['b'].depth, 1);

  // The (A)-(D) rep bring-down tiers are the exact content that COND-B
  // extraction was dropping in full — prove each one is captured verbatim.
  assert.match(byMarker['a.ii.A'].text, /Absence of Certain Changes/);
  assert.match(byMarker['a.ii.B'].text, /Capital Structure/);
  assert.match(byMarker['a.ii.C'].text, /Organization, Good Standing and Qualification/);
  assert.match(byMarker['a.ii.D'].text, /any of the other representations and warranties/);
  assert.match(byMarker['a.iii'].text, /No Company Material Adverse Effect/);
  assert.match(byMarker['b'].text, /Parent shall have received a certificate/);

  // Inline cross-references inside (C) — "Section 3.1(b)(i)", "Section
  // 3.1(b)(iii)" — must NOT fragment the leaf or spawn spurious markers.
  assert.ok(!markers.includes('a.ii.C.i'));
  assert.ok(!markers.includes('a.ii.C.iii'));
});

test('Redfin Section 2.10: employee benefits reps segment into top-level (a)-(m)', () => {
  const leaves = segmentSubClauses(REDFIN_2_10_TEXT);
  assertLeavesPartition(null, leaves, REDFIN_2_10_TEXT);

  const markers = leaves.filter((l) => l.marker !== null).map((l) => l.marker);
  assert.deepEqual(markers, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm']);
  for (const leaf of leaves.filter((l) => l.marker !== null)) assert.equal(leaf.depth, 1);

  const byMarker = Object.fromEntries(leaves.map((l) => [l.marker, l]));
  // The disclosure-letter enumeration that the live coverage-gate defect
  // dropped lives in (a) — assert it survives whole.
  assert.match(byMarker['a'].text, /Company Disclosure Letter/);
  assert.match(byMarker['m'].text, /sexual harassment/);

  // (h) contains an inline, non-adjacent (i)/(ii)/(iii) enumeration ("will
  // not (i) entitle … (ii) result … or (iii) result …") that is NOT
  // line-adjacent to (h)'s own marker. Per the CHILD-OPEN adjacency rule
  // this stays inside (h)'s leaf rather than fragmenting into a spurious
  // depth-2 list — (h) is captured whole, still fully covered (see
  // assertLeavesPartition). The single-char "(i)" tokens are ambiguous
  // (letter vs. roman numeral); requiring a STRONG position (start-of-line)
  // for an ambiguous sibling match is what stops the inline "(i) entitle…"
  // from being misread as the top-level alpha list's next item. The real
  // top-level (i) that follows on its own line ("(i)With respect to any
  // Company Employee…") IS at a strong position and is correctly recovered
  // as its own top-level leaf.
  assert.match(byMarker['h'].text, /will not \(i\) entitle[\s\S]*maintained by the Company\.\s*$/);
  assert.ok(!/^\(i\)/.test(byMarker['h'].text.trim()));
  assert.match(byMarker['i'].text, /^With respect to any Company Employee/);
});

test('markerless prose section yields a single chapeau span covering the whole text', () => {
  const text = 'This is a plain narrative section with no enumerated sub-clauses at all, just prose describing the covenant in full paragraphs without any lettered or numbered breakdown.';
  const leaves = segmentSubClauses(text);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].marker, null);
  assert.equal(leaves[0].depth, 0);
  assert.equal(leaves[0].start, 0);
  assert.equal(leaves[0].end, text.length);
  assert.equal(leaves[0].text, text);
});

test('hard-wrapped marker case: markers survive mid-clause line wraps from fixed-width text extraction', () => {
  // Simulates a text-layer extraction artifact where body prose is hard-
  // wrapped mid-sentence (common in PDF-derived filings) while the markers
  // themselves still each open a line.
  const text = [
    '(a) The Company shall deliver to Parent a certificate, in form and',
    'substance reasonably satisfactory to Parent, executed by an officer',
    'of the Company, certifying as to the matters set forth herein.',
    '(b) Parent shall have no obligation to consummate the Merger unless',
    'each of the foregoing conditions has been satisfied or waived in',
    'writing by Parent in its sole discretion prior to the Closing.',
  ].join('\n');

  const leaves = segmentSubClauses(text);
  assertLeavesPartition(null, leaves, text);
  assert.deepEqual(leaves.map((l) => l.marker), ['a', 'b']);
  assert.match(leaves[0].text, /certifying as to the matters set forth herein\.\s*$/);
  assert.match(leaves[1].text, /prior to the Closing\.\s*$/);
});
