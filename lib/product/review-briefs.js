'use strict';

// What the reviewer is asked to look at on a given run. Presentation only:
// these notes are the assistant's questions for the lawyer, never legal
// conclusions, and they never change stored facts or decisions. Section
// references must match routing.section_reference values for the run.

const BRIEFS = Object.freeze({
  // NCS generation 4, layered facts (LEGAL_SCHEMA/V2, prompt bundle V8).
  '39456f2d-4c92-46c9-8398-2d55c5b0a58f': {
    title: 'NCS / Weatherford, layered rerun: the same 13 provisions',
    intro: 'This is the V2 rerun of the draft you reviewed on 9 to 12 September. Each fact now has a headline and layers; click a headline or a component to see its words in the provision. Look at the same provisions and say whether each of your earlier comments is now addressed. Held facts (marked "requires edit") failed the component check and are shown for information.',
    ask: [
      'Does the headline carry what distinguishes the provision (threshold, carve-out, standard, trigger, party), not just the topic?',
      'Is the cut right: one fact per operative unit, lists as list elements, synonyms as one litany, inherited chapeau words marked?',
      'Are the components verbatim and complete, with nothing invented for an absent timing, qualification or forum?',
      'Is each of your 9 to 12 September comments on this provision addressed, partly addressed, or dropped?',
    ],
    sections: [
      { reference: '7.1', look_for: 'Written Consent and Support Agreement non-delivery rights as their own subtypes; the Novation/Rewind right as a date-based right. Cure as a branch: curable or not, window from notice, capped at the outside date. Headline shows the terminator-breach bar where the text has one.' },
      { reference: '7.3', look_for: 'One fact per fee amount, trigger and tail. Tail headline names the 20% to 50% deeming rule. The 7 business day election to accept or decline the Parent fee is a fact, not held.' },
      { reference: '5.2', look_for: 'Prohibited actions as one list with one element per verb. Cease-discussions and return-or-destroy as their own subtypes. Notice duties with contents as list elements. Acceptable Confidentiality Agreement present as a defined-term fact.' },
      { reference: '5.3', look_for: 'Change of recommendation with each prerequisite as a condition. Match periods (four business days, two for amendments) as periods with values. No intervening-event change invented.' },
      { reference: '5.6', look_for: 'Consent solicitation and delivery subtypes, Consent Time as a date component, Consenting Stockholders identity as a component. No cross-references to 7.1 or 7.3 from these facts.' },
      { reference: '6.1', look_for: 'No chapeau-only fact. Nasdaq listing labelled Listing of shares.' },
      { reference: '6.2', look_for: 'One bring-down fact per tier, with the reps covered as resolved cross-references and the standard as a component. Materiality scrape as its own component.' },
      { reference: '6.3', look_for: 'Mirror tiers; the tax opinion with the five-percent transferee exclusion and the Canadian remittance point as qualifiers, not separate facts.' },
      { reference: '5.8', look_for: 'Every obligation as its own fact with its efforts standard beside it: Parent "agrees to take all actions" against Company reasonable best efforts. Remedy limitation as one list. Compare the count with the 41 V1 facts.' },
      { reference: '3.16', look_for: 'One fact per category with threshold ($250,000, $750,000, $100,000) as a value and carve-outs as exceptions; chapeau limitations marked as inherited. No duplicated (a)(ix). Status reps in one fact each with the qualifier as a component.' },
      { reference: '3.1', look_for: 'MAE definition prong as one fact with the litany, the aggregation and probability standards, and the affected-business list. Ten carve-outs as ten one-line facts; disproportionality carve-back listing clauses (1) to (4) and (7).' },
      { reference: '8.10', look_for: '"would occur" as a standard component; the court as a forum; agreement of irreparable damage and cumulative rights labelled as such. No invented timing.' },
      { reference: '8.4', look_for: 'Interpretation rules are coverage-only: each with a category label, shown as a collapsed section on the published page, not as reader-facing facts.' },
    ],
  },
  'eaafcac8-790b-41bb-a5e1-b12187a55e7d': {
    title: 'NCS / Weatherford: what to look at',
    intro: 'Not the whole draft. These provisions are where the extraction is either most material or most likely wrong. Accept, reject, edit or comment on the facts you read; leave the rest pending.',
    ask: [
      'Is each material term of the provision present as a fact, or lost inside another fact or held content?',
      'Does the label (family and subtype) describe the provision, or force it into the wrong bucket?',
      'Are the words the fact cites the right words? Click a fact to see them in the provision.',
      'Where a fact restates the chapeau or a sibling, say whether the split helps or hurts a reader.',
    ],
    sections: [
      { reference: '7.1', look_for: 'Written Consent and Support Agreement non-delivery rights are labelled Vote failure. The Novation/Rewind right (d)(iii) is labelled Outside date. Are the cure, outside-date and terminator-breach bars right?' },
      { reference: '7.3', look_for: 'Company fee $5.5m, Parent fee $9.7m. The 12-month tail with the 20% to 50% deeming. The Company election to accept or decline the Parent fee within 7 business days is held, not a fact. Exclusive-remedy carve-outs differ by side.' },
      { reference: '5.2', look_for: 'No-shop runs to closing; fiduciary exception and 48-hour notice duties end when the Written Consent is received. The Acceptable Confidentiality Agreement definition has no fact. Cease-discussions duties are labelled Prohibited action.' },
      { reference: '5.3', look_for: 'Change of recommendation only for a Superior Proposal, only until the Written Consent. Four business day match, two for amendments (both facts are marked invalid over the unit). No intervening-event change exists.' },
      { reference: '5.6', look_for: 'Consent solicitation instead of a meeting; Consent Time is 11:59pm Central the day after signing. Every fact here carries a proxy or meeting label. Nothing links this to 6.1(a), 7.1(c) or 7.3(a)(iii).' },
      { reference: '6.1', look_for: 'Mutual conditions. One card is only the chapeau. Nasdaq listing is labelled Legal restraint.' },
      { reference: '6.2', look_for: 'Three-tier bring-down with materiality scrape, covenant compliance, certificate, no MAE. Cross-references to reps are bare.' },
      { reference: '6.3', look_for: 'Mirror conditions plus the tax opinion with the five-percent transferee shareholder carve-out and the bespoke Canadian tax remittance condition.' },
      { reference: '5.8', look_for: 'Parent "agrees to take all actions" versus Company reasonable best efforts. No divestiture, conduct or litigation commitment for either side. 41 facts for one section: which would you keep?' },
      { reference: '3.16', look_for: 'Every dollar threshold ($250,000, $750,000, $100,000) is held rather than a fact. Two (a)(ix) cards duplicate each other. Status reps split into six MAE-qualified cards.' },
      { reference: '3.1', look_for: 'MAE definition: ten carve-outs, disproportionality carve-back for (1) to (4) and (7), the Disclosure Letter items exclusion. Is each carve-out a useful separate fact?' },
      { reference: '8.10', look_for: 'Specific performance in six cards. Fee-versus-performance coordination lives in 7.3.' },
      { reference: '8.4', look_for: 'Control: 21 interpretation facts. Should this family be coverage-only, not reader-facing?' },
    ],
  },
});

function briefForRun(runId) {
  return BRIEFS[runId] || null;
}

module.exports = { briefForRun };
