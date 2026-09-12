'use strict';

// What the reviewer is asked to look at on a given run. Presentation only:
// these notes are the assistant's questions for the lawyer, never legal
// conclusions, and they never change stored facts or decisions. Section
// references must match routing.section_reference values for the run.

const BRIEFS = Object.freeze({
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
