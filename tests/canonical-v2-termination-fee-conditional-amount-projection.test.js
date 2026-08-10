'use strict';

// Closes the delivery seam described in the Modiv termination-fee measurement:
// V2 correctly extracted the §7.3 fee terms and the product displayed almost
// none of them. Three drops, one file each in cause:
//
//   1. resolution.conditional_termination_fee_values (the branch-conditional
//      "lesser of $X and the REIT cap" formula) was captured by the native
//      producer and never read by the projection -- FEE_DEFINITIONS only
//      covers claims that land in resolution.resolved, and this data never
//      does. The fee row rendered "not yet extracted" while the answer sat
//      one field away.
//   2. The SOLE_REMEDY_EVIDENCE Wave-B mechanic's `carve_outs` (FRAUD,
//      WILLFUL_BREACH, with their own quotes) were captured and discarded by
//      waveBEvidenceFeatures().
//   3. soleRemedy/soleAndExclusiveRemedy (what the row reads) vs
//      soleRemedyFeeContext (what the projection published) -- investigated
//      and NOT bridged with a fabricated boolean; see the dedicated section
//      below for why.
//
// Ground truth throughout is the REAL Modiv resolution: work item
// modiv-termination-fee-7-3's `resolution` object, read directly off the
// committed run receipt at
// evidence/canonical-v2/m3-pilot-20260804-fresh/final-output/execution-result.json
// (per the task brief -- "Load it and look at the resolution object
// directly; do not work from this brief's summary alone"), cross-checked
// against the actual agreement text extracted from the
// committed source filing (tests/fixtures/canonical-v2/mae-definition-family/
// modiv-raw-fetched.htm, sha256 659bcfaa017718ac735811861565fa2cd4e212657
// ba68e06ff1eab53e3729968, matching the run receipt's document_hash exactly).
// Section 7.3(b): "... (i) the Company Base Amount ..."; Section 8.12(f):
// '"Company Base Amount" means (x) if payable pursuant to Section 7.3(b)(i),
// Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000, or (y) if payable
// pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v), $15,000,000.00.';
// Section 8.12(m): '"Company Termination Fee" means an amount equal to the
// lesser of (i) the Company Base Amount and (ii) the maximum amount, if any,
// that can be paid to Parent without causing Parent to fail to meet the
// requirements of Sections 856(c)(2) and (3) of the Code (the "REIT
// Requirements") ...'; Section 8.12(gg): '"Parent Base Amount" means
// $15,000,000.00.'; Section 7.3(d): '... shall be the sole and exclusive
// remedy (other than in the event of fraud or Willful and Intentional
// Breach, ...)'.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  conditionalFeeHeadline,
  formatBranchCitations,
  projectTerminationFeeProductSurfaces,
} = require('../lib/canonical-v2/termination-product-projection');

const EXECUTION_RESULT_PATH = path.join(
  __dirname, '..', 'evidence', 'canonical-v2', 'm3-pilot-20260804-fresh', 'final-output', 'execution-result.json',
);
const MODIV_WORK_ITEM_ID = 'modiv-termination-fee-7-3';
const EXECUTION_RESULT = JSON.parse(fs.readFileSync(EXECUTION_RESULT_PATH, 'utf8'));
const MODIV_WORK_ITEM = EXECUTION_RESULT.work_results.find((item) => item.work_item_id === MODIV_WORK_ITEM_ID);
assert.ok(MODIV_WORK_ITEM, `${MODIV_WORK_ITEM_ID} must be present in the committed execution result`);
assert.equal(MODIV_WORK_ITEM.status, 'SUCCEEDED');
const MODIV_RESOLUTION = MODIV_WORK_ITEM.resolution;
const MODIV_DEAL_ID = MODIV_WORK_ITEM_ID;

// The run receipt pins the exact source text this resolution was extracted
// from -- verified below (drop 2's agreement-text test) against the raw
// filing itself, not merely trusted.
assert.equal(
  MODIV_WORK_ITEM.run_receipt.source_sha256,
  '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e',
);

const COMPANY_FEE_HEADLINE = 'Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv) or (v)) and the REIT Requirements cap';
const PARENT_FEE_HEADLINE = 'Lesser of $15,000,000 (§7.3(c)) and the REIT Requirements cap';

async function feesConfig() {
  return import('../components/review/table-configs/termination-fees.config.js');
}

function rowById(rows, id) {
  return rows.find((row) => row.id === id) || null;
}

// A reviewDeal wired for canonical-only serving off the REAL Modiv projection
// -- the shape lib/canonical-v2/termination-fee-serving-source.js stamps onto
// the wire payload in production.
function modivCanonicalReviewDeal({ valueUsd = null, cards } = {}) {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  return {
    value_usd: valueUsd,
    cards: [],
    canonical_v2_termination_fee_serving_enabled: true,
    canonical_v2_termination_fee_cards: cards || projection.cards,
    _projection: projection,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   DROP 1 -- conditional_termination_fee_values reaches the projection
   ───────────────────────────────────────────────────────────────────────── */

test('drop 1: the Modiv projection reads resolution.conditional_termination_fee_values and publishes a TERMF-TARGET card', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const target = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  assert.ok(target, 'a TERMF-TARGET card must exist -- today none does, because TERMINATION_FEE_AMOUNT never resolves for Modiv');
  assert.equal(target.features.companyTerminationFee.amount, COMPANY_FEE_HEADLINE);
  // The headline is not invented: every dollar figure and citation in it is
  // in the extracted formulas, verified above against the actual agreement.
  assert.match(target.features.companyTerminationFee.amount, /\$10,000,000/);
  assert.match(target.features.companyTerminationFee.amount, /\$15,000,000/);
  assert.match(target.features.companyTerminationFee.amount, /REIT Requirements/);
});

test('drop 1: the reverse (Parent Termination) fee gets the same honest treatment, single branch', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const reverse = projection.cards.find((card) => card.provision_subtype === 'TERMF-REVERSE');
  assert.ok(reverse, 'a TERMF-REVERSE card must exist');
  assert.equal(reverse.features.reverseTerminationFee.amount, PARENT_FEE_HEADLINE);
});

test('drop 1: full per-branch fidelity is preserved alongside the headline, nothing grouped away', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const target = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  const reverse = projection.cards.find((card) => card.provision_subtype === 'TERMF-REVERSE');
  assert.equal(target.features.conditionalFeeAmounts.length, 5, 'all five branches (i)-(v), not just the two distinct amounts');
  assert.deepEqual(
    target.features.conditionalFeeAmounts.map((v) => v.triggering_branch),
    ['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)'],
  );
  assert.deepEqual(target.features.conditionalFeeAmounts.map((v) => v.base_amount), ['10000000', '10000000', '10000000', '15000000.00', '15000000.00']);
  assert.ok(target.features.conditionalFeeAmounts.every((v) => v.operator === 'LOWER_OF'));
  assert.ok(target.features.conditionalFeeAmounts.every((v) => v.reit_limit_cap_term_ref === 'REIT Requirements'));
  assert.deepEqual(target.features.conditionalFeeAmounts[0].defined_term_lineage, ['Company Termination Fee', 'Company Base Amount']);
  assert.equal(reverse.features.conditionalFeeAmounts.length, 1);
  assert.equal(reverse.features.conditionalFeeAmounts[0].triggering_branch, '7.3(c)');
});

test('drop 1: the card\'s own evidence quote is the actual defined-term formula, not a synthetic string', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const target = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  // Verbatim substring of Section 8.12(m)'s "Company Termination Fee" formula
  // as read directly off the committed source filing.
  assert.match(target.primary_quote, /lesser of \(i\) the Company Base Amount and \(ii\) the maximum amount/);
  assert.match(target.primary_quote, /REIT Requirements/);
  const reverse = projection.cards.find((card) => card.provision_subtype === 'TERMF-REVERSE');
  assert.match(reverse.primary_quote, /lesser of \(i\) the Parent Base Amount/);
});

test('drop 1: the fee row renders both amounts, their branch and their cap -- through the real table config, not just the projection', async () => {
  const mod = await feesConfig();
  const reviewDeal = modivCanonicalReviewDeal();
  const rows = mod.terminationFeesConfig.selectRows(reviewDeal);

  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(feeRow, 'the row must render -- not "not yet extracted"');
  assert.match(feeRow.detail, /\$10,000,000/);
  assert.match(feeRow.detail, /\$15,000,000/);
  assert.match(feeRow.detail, /7\.3\(b\)\(i\)/);
  assert.match(feeRow.detail, /7\.3\(b\)\(iv\)/);
  assert.match(feeRow.detail, /REIT Requirements/);
  const amountSignal = feeRow.signals.find((s) => s.id === 'COMPANY_TERMINATION_FEE-amount');
  assert.equal(amountSignal.label, COMPANY_FEE_HEADLINE);
  assert.equal(amountSignal.tone, 'present');

  const reverseRow = rowById(rows, 'termination-fees-REVERSE_TERMINATION_FEE');
  assert.ok(reverseRow, 'the reverse-fee row must render too');
  assert.match(reverseRow.detail, /\$15,000,000/);
  assert.match(reverseRow.detail, /7\.3\(c\)/);
  const reverseSignal = reverseRow.signals.find((s) => s.id === 'REVERSE_TERMINATION_FEE-amount');
  assert.equal(reverseSignal.label, PARENT_FEE_HEADLINE);

  // The gap this task fixes: these placeholders must NOT appear any more.
  assert.equal(rows.some((r) => r.id === 'termination-fees-not-yet-extracted-COMPANY_TERMINATION_FEE'), false);
  assert.equal(rows.some((r) => r.id === 'termination-fees-not-yet-extracted-REVERSE_TERMINATION_FEE'), false);
});

test('drop 1: a wrong rendering that shows only ONE branch amount would misstate the agreement -- prove neither figure is dropped', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal());
  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  // Showing "$10,000,000" alone would be wrong (branches iv/v are $15,000,000);
  // showing "$15,000,000" alone would be wrong (branches i-iii are
  // $10,000,000); showing nothing would throw away a correct extraction.
  // The row must carry BOTH.
  assert.match(feeRow.detail, /10,000,000/);
  assert.match(feeRow.detail, /15,000,000/);
});

test('drop 1: the % of deal value figure is never fabricated for a branch-conditional amount, even when value_usd is on file', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal({ valueUsd: 2000000000 }));
  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  // parseFeeAmountUsd would otherwise read the FIRST figure in the headline
  // ($10,000,000) and silently compute "0.5% of deal value" -- a precise-
  // looking number that is not true of the fee (it could be $15,000,000,
  // and either way is further capped by the REIT Requirements limit).
  assert.doesNotMatch(feeRow.detail, /% of deal value/);
  const amountSignal = feeRow.signals.find((s) => s.id === 'COMPANY_TERMINATION_FEE-amount');
  assert.equal(amountSignal.label, COMPANY_FEE_HEADLINE, 'no "(X% of deal value)" suffix grafted onto the honest headline');
});

test('drop 1: the reverse fee (single stated figure) still gets its % of deal value -- the guard is scoped to multi-figure strings only', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal({ valueUsd: 2000000000 }));
  const reverseRow = rowById(rows, 'termination-fees-REVERSE_TERMINATION_FEE');
  // $15,000,000 / $2,000,000,000 = 0.75%.
  assert.match(reverseRow.detail, /0\.75% of deal value/);
});

test('drop 1 (unit): conditionalFeeHeadline groups same-amount branches and states the cap, for an arbitrary formula shape', () => {
  const values = [
    { base_amount: '5000000', currency: 'USD', operator: 'LOWER_OF', reit_limit_cap_term_ref: 'Tax Cap', triggering_branch: '9.1(a)(i)' },
    { base_amount: '5000000', currency: 'USD', operator: 'LOWER_OF', reit_limit_cap_term_ref: 'Tax Cap', triggering_branch: '9.1(a)(ii)' },
    { base_amount: '7500000', currency: 'USD', operator: 'LOWER_OF', reit_limit_cap_term_ref: 'Tax Cap', triggering_branch: '9.1(b)' },
  ];
  assert.equal(
    conditionalFeeHeadline(values),
    'Lesser of $5,000,000 (§9.1(a)(i) or (ii)) or $7,500,000 (§9.1(b)) and the Tax Cap cap',
  );
});

test('drop 1 (unit): conditionalFeeHeadline on a single branch, single amount', () => {
  const values = [{ base_amount: '15000000.00', currency: 'USD', operator: 'LOWER_OF', reit_limit_cap_term_ref: 'REIT Requirements', triggering_branch: '7.3(c)' }];
  assert.equal(conditionalFeeHeadline(values), PARENT_FEE_HEADLINE);
});

test('drop 1 (unit): an operator this file does not recognise renders literally rather than being assumed to mean "lesser of"', () => {
  const values = [{ base_amount: '1000000', currency: 'USD', operator: 'GREATER_OF', reit_limit_cap_term_ref: 'Some Cap', triggering_branch: '9.1(a)' }];
  const headline = conditionalFeeHeadline(values);
  assert.doesNotMatch(headline, /^Lesser of/, 'a wrong "lesser of" would be a confidently wrong legal claim');
  assert.match(headline, /GREATER_OF/);
});

test('drop 1 (unit): conditionalFeeHeadline returns null on no values -- never an empty-string headline', () => {
  assert.equal(conditionalFeeHeadline([]), null);
});

test('drop 1 (unit): formatBranchCitations falls back to listing full citations when branches do not share a base clause', () => {
  assert.equal(formatBranchCitations(['7.3(b)(i)', '9.4(a)']), '§7.3(b)(i), §9.4(a)');
});

test('drop 1: a deal with no conditional_termination_fee_values is completely unaffected (regression safety for every other deal)', () => {
  const resolutionWithoutConditionalValues = { ...MODIV_RESOLUTION, conditional_termination_fee_values: [] };
  const projection = projectTerminationFeeProductSurfaces({ resolution: resolutionWithoutConditionalValues, deal_id: MODIV_DEAL_ID });
  assert.equal(projection.cards.some((card) => card.provision_subtype === 'TERMF-TARGET'), false);
  assert.equal(projection.cards.some((card) => card.provision_subtype === 'TERMF-REVERSE'), false);

  const resolutionWithoutField = { ...MODIV_RESOLUTION };
  delete resolutionWithoutField.conditional_termination_fee_values;
  const projection2 = projectTerminationFeeProductSurfaces({ resolution: resolutionWithoutField, deal_id: MODIV_DEAL_ID });
  assert.equal(projection2.cards.some((card) => card.provision_subtype === 'TERMF-TARGET'), false);
});

test('drop 1: a conditional-fee seed merges cleanly alongside a genuinely resolved claim for the same side, never overwriting it', async () => {
  // Not Modiv's actual shape (Modiv has no resolved TERMINATION_FEE_TRIGGER),
  // but proves the merge is safe if a future deal resolves both a formula
  // AND a real claim (e.g. a trigger) for the same fee side: they must land
  // on the SAME rendered row without either clobbering the other, through
  // the REAL production merge path -- combineTermfFeatures() -- not a naive
  // shallow-object-spread stand-in, which would let the second card's
  // companyTerminationFee (triggers only, no amount) silently clobber the
  // first's (amount, no triggers).
  const mod = await feesConfig();
  const withTrigger = {
    ...MODIV_RESOLUTION,
    resolved: [
      ...MODIV_RESOLUTION.resolved,
      {
        section_reference: '7.3',
        resolved_claim_definition_key: 'TERMINATION_FEE_TRIGGER',
        concept_key: 'TERMF-TARGET',
        party: { capacity: 'TARGET' },
        provision_instance: { provision_instance_id: 'synthetic-trigger-provision' },
        claim: {
          claim_revision_id: 'synthetic-trigger-claim',
          canonical_value: 'SUPERIOR_PROPOSAL_TERMINATION',
          raw_value: 'the Company terminates to accept a Superior Proposal',
        },
      },
    ],
  };
  const projection = projectTerminationFeeProductSurfaces({ resolution: withTrigger, deal_id: MODIV_DEAL_ID });
  const targetCards = projection.cards.filter((card) => card.provision_subtype === 'TERMF-TARGET');
  assert.equal(targetCards.length, 2, 'two distinct provision instances -- the synthetic conditional-value card and the real claim-derived card');
  const combined = mod.combineTermfFeatures(targetCards);
  assert.equal(combined.companyTerminationFee.amount, COMPANY_FEE_HEADLINE, 'the amount from the conditional-value card must survive the merge');
  assert.equal(combined.companyTerminationFee.triggers.length, 1, 'the trigger from the OTHER card must survive the same merge');
  assert.equal(combined.companyTerminationFee.triggers[0].code, 'SUPERIOR_PROPOSAL_TERMINATION');
});

/* ─────────────────────────────────────────────────────────────────────────
   DROP 2 -- willful-breach / fraud carve-outs are published, not discarded
   ───────────────────────────────────────────────────────────────────────── */

test('drop 2: the sole-remedy carve-outs (fraud, willful-and-intentional breach) are published on the evidence card', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const evidenceCard = projection.cards.find((card) => card.features.soleRemedyFeeContext);
  assert.ok(evidenceCard, 'the SOLE_REMEDY_EVIDENCE card must still exist');
  assert.deepEqual(evidenceCard.features.soleRemedyCarveOutEvidence, [
    { kind: 'FRAUD', quote: 'other than in the event of fraud' },
    { kind: 'WILLFUL_BREACH', quote: 'Willful and Intentional Breach' },
  ]);
});

test('drop 2: the carve-outs are consumable off the ordinary card-features surface, by kind and by quote, with no assumption about which row reads them', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const evidenceCard = projection.cards.find((card) => card.features.soleRemedyFeeContext);
  const carveOuts = evidenceCard.features.soleRemedyCarveOutEvidence;
  const kinds = carveOuts.map((c) => c.kind);
  assert.ok(kinds.includes('FRAUD'));
  assert.ok(kinds.includes('WILLFUL_BREACH'));
  // Both are independently readable by kind -- a future "carve-out to the
  // effect-of-termination rule" row and a future "carve-out to the sole-
  // remedy cap" row can each ask "is FRAUD/WILLFUL_BREACH present" without
  // this file having decided which one owns the answer.
  const fraud = carveOuts.find((c) => c.kind === 'FRAUD');
  const willful = carveOuts.find((c) => c.kind === 'WILLFUL_BREACH');
  assert.match(fraud.quote, /fraud/i);
  assert.match(willful.quote, /Willful and Intentional Breach/);
});

test('drop 2: verified against the agreement -- §7.3(d) carves fraud and Willful and Intentional Breach out of the sole-remedy limitation', () => {
  // Direct read of the committed source filing at absolute offsets covering
  // Section 7.3(d) (see the module doc comment for the sha256 chain proving
  // this is the exact document the run receipt pins).
  const raw = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm'),
    'utf8',
  );
  const stripped = raw.slice(575000, 578500).replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ');
  assert.match(stripped, /sole and exclusive remedy/);
  assert.match(stripped, /other than in the event of fraud or Willful and Intentional Breach/);
});

test('drop 2: carve-outs never appear on the fee card once a Remedies-family run has linked and validated them (the resolver has already stripped them by then)', () => {
  // Mirrors the "Landos" fixture shape in
  // tests/canonical-v2-sole-remedy-resolution.test.js: once
  // soleRemedyRemediesClaimLink is populated, the upstream resolver has
  // already promoted the carve-outs into validated SOLE_REMEDY_CARVEOUT_KIND
  // claims and stripped `carve_outs` off the mechanic -- this file must not
  // re-publish stale/unvalidated data that the resolver has since superseded.
  const linked = JSON.parse(JSON.stringify(MODIV_RESOLUTION));
  const soleRemedyItem = linked.open_world.find((item) => item?.attributes?.structured_mechanic?.surface === 'SOLE_REMEDY_EVIDENCE');
  soleRemedyItem.attributes.structured_mechanic.remedies_claim_link = { provision_instance_id: 'p1', claim_revision_id: 'c1' };
  delete soleRemedyItem.attributes.structured_mechanic.carve_outs;
  const projection = projectTerminationFeeProductSurfaces({ resolution: linked, deal_id: MODIV_DEAL_ID });
  const evidenceCard = projection.cards.find((card) => card.features.soleRemedyFeeContext);
  assert.equal(Object.hasOwn(evidenceCard.features, 'soleRemedyCarveOutEvidence'), false);
  assert.deepEqual(evidenceCard.features.soleRemedyRemediesClaimLink, { provision_instance_id: 'p1', claim_revision_id: 'c1' });
});

/* ─────────────────────────────────────────────────────────────────────────
   DROP 3 -- sole remedy naming: investigated, not bridged with an invented
   boolean. Recorded here because the brief asked for it to be reconciled,
   and this is the reconciliation: NOT a rename, a documented finding.
   ───────────────────────────────────────────────────────────────────────── */

test('drop 3: soleRemedyFeeContext/soleRemedyRemediesClaimLink still publish exactly as before -- unchanged shape', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const evidenceCard = projection.cards.find((card) => card.features.soleRemedyFeeContext);
  assert.deepEqual(evidenceCard.features.soleRemedyFeeContext, {
    payment_context_quote: 'If Parent or the Company receives the full payment of the applicable Company Termination Fee or the Parent Termination Fee (as applicable), together with any applicable Enforcement Costs',
    source_section_reference: '7.3',
  });
  assert.equal(evidenceCard.features.soleRemedyRemediesClaimLink, null, 'no Remedies-family run exists for Modiv in this pilot -- the link is honestly null, not fabricated');
});

test('drop 3: soleRemedy is deliberately NOT published on the termination-fee card -- the sole-remedy legal effect is Remedies-owned', () => {
  // This is a considered decision, not an oversight. Two independent, dated
  // rulings already pin it:
  //  - tests/canonical-v2-sole-remedy-resolution.test.js: "V38 registers the
  //    approved Remedies-owned sole-remedy effect" and the specific-
  //    performance-remedies-producer-prompt.js assertion "Remedies owns the
  //    sole-remedy legal effect".
  //  - tests/canonical-v2-termination-product-parity.test.js: pins
  //    `deferred.features.soleRemedy === undefined` against a fixture that
  //    carries BOTH a remedy_effect_quote AND carve_outs -- i.e. even with
  //    full evidence in hand, this file must not assert the boolean.
  // Fabricating `soleRemedy: true` here from raw, unvalidated Wave-B evidence
  // would also bypass real validation the dedicated resolver applies (see
  // "a bad carve-out kind and an uncorroborated quote stay open world" in
  // the sole-remedy test) -- confidently showing "Yes" off evidence that a
  // corroboration check might reject is exactly the failure mode this
  // product exists to prevent.
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  for (const card of projection.cards) {
    assert.equal(card.features.soleRemedy, undefined, `card ${card.provision_subtype} must not carry a fabricated soleRemedy boolean`);
    assert.equal(card.features.soleAndExclusiveRemedy, undefined);
  }
});

test('drop 3: sole remedy still renders on the page -- as deferred evidence carrying the carve-outs, honestly scoped to what was actually extracted', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal());
  const deferred = rows.find((row) => row.label === 'Deferred evidence: Sole remedy evidence');
  assert.ok(deferred, 'the sole-remedy evidence must still be visible on the page');
  assert.match(deferred.evidence, /sole and exclusive remedy/);
  // The dedicated scalar "Sole and exclusive remedy" row correctly still
  // reads not-yet-extracted: no TERMF-EFFECT/TERMF-SOLE-coded governed card
  // exists for Modiv under canonical serving, and per the above this file
  // does not fabricate one. This is the honest state, not a residual bug --
  // proven here so a future change cannot silently start asserting "Yes"
  // off unvalidated evidence without this test catching it.
  const notYetExtracted = rows.find((row) => row.id === 'termination-fees-not-yet-extracted-sole-remedy');
  assert.ok(notYetExtracted);
  assert.equal(notYetExtracted.detail, 'Not yet extracted');
  assert.equal(notYetExtracted.coverageState, 'NOT_YET_EXTRACTED');
});

/* ─────────────────────────────────────────────────────────────────────────
   THE TWO-STATE DISTINCTION (not-yet-extracted vs established-absent) HOLDS
   ───────────────────────────────────────────────────────────────────────── */

test('two-state distinction: a fully empty resolution still projects to zero cards -- never a fabricated one', () => {
  const emptyResolution = { resolved: [], open_world: [], conditional_termination_fee_values: [] };
  const projection = projectTerminationFeeProductSurfaces({ resolution: emptyResolution, deal_id: 'empty-deal' });
  assert.equal(projection.cards.length, 0);
});

test('two-state distinction: absent conditional_termination_fee_values (this fix\'s own input), the fee rows correctly still read "Not yet extracted", amber -- never invented', async () => {
  const mod = await feesConfig();
  // Same Modiv resolution, MINUS the one field this task teaches the
  // projection to read -- isolates that the "not yet extracted" placeholder
  // is conditional on the data actually being present, not unconditionally
  // suppressed by this change. The tail claim and the four Wave-B evidence
  // items still resolve, so canonicalCards is non-empty and the deal reaches
  // the CANONICAL branch (not the legacy-fallback one).
  const withoutConditionalValues = { ...MODIV_RESOLUTION, conditional_termination_fee_values: [] };
  const projection = projectTerminationFeeProductSurfaces({ resolution: withoutConditionalValues, deal_id: MODIV_DEAL_ID });
  assert.ok(projection.cards.length > 0, 'the tail claim and Wave-B evidence still resolve');
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: null,
    cards: [],
    canonical_v2_termination_fee_serving_enabled: true,
    canonical_v2_termination_fee_cards: projection.cards,
  });
  assert.equal(rows[0].servingSourceState, 'CANONICAL');
  const feePlaceholder = rowById(rows, 'termination-fees-not-yet-extracted-COMPANY_TERMINATION_FEE');
  const reversePlaceholder = rowById(rows, 'termination-fees-not-yet-extracted-REVERSE_TERMINATION_FEE');
  assert.ok(feePlaceholder, 'without the fix\'s input data, the row must read "not yet extracted", not show a fabricated amount');
  assert.ok(reversePlaceholder);
  assert.equal(feePlaceholder.detail, 'Not yet extracted');
  assert.equal(feePlaceholder.signals[0].tone, 'warning');
  assert.equal(feePlaceholder.present, false);
});

test('two-state distinction: established-absent (grey "No") and not-yet-extracted (amber) remain visually and semantically distinct after this change', async () => {
  const mod = await feesConfig();
  // A canonical card set that HAS extracted the fee amount (via the new
  // conditional-value path) but genuinely has nothing for naked-no-vote --
  // that surface must read "Not yet extracted" (amber), never "No" (grey),
  // because canonical never looked at it for this deal.
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal());
  const nakedNoVotePlaceholder = rowById(rows, 'termination-fees-not-yet-extracted-naked-no-vote');
  assert.ok(nakedNoVotePlaceholder);
  assert.equal(nakedNoVotePlaceholder.detail, 'Not yet extracted');
  assert.equal(nakedNoVotePlaceholder.signals[0].tone, 'warning');
  // Established-absent still reads differently -- exercised on a LEGACY card
  // that explicitly extracted "no naked no-vote fee", proving the amber
  // "not yet extracted" pill this task adds is never confused with it.
  const legacyAbsent = mod.scalarRows([{
    id: 'legacy-naked',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    primary_quote: 'No naked no-vote fee applies.',
    features: { nakedNoVoteFeePresent: false },
  }]);
  const nakedRow = legacyAbsent.find((row) => row.id === 'termination-fees-naked-no-vote');
  assert.equal(nakedRow.detail, 'No');
  assert.equal(nakedRow.signals[0].tone, 'missing');
});

/* ─────────────────────────────────────────────────────────────────────────
   ALL FOUR SERVING MODES STILL WORK, AND CARD SETS NEVER MERGE
   ───────────────────────────────────────────────────────────────────────── */

function legacyCompanyFeeCard() {
  return {
    id: 'legacy-fee',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    primary_quote: 'The Company shall pay Parent a termination fee of $99,000,000.',
    features: { terminationFees: { amount: '$99,000,000', percentage_of_equity: '2.0%' } },
  };
}

test('four modes: mode 1, legacy only (flag off) -- untouched by the conditional-fee projection', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows({ value_usd: null, cards: [legacyCompanyFeeCard()] });
  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(feeRow.detail.includes('REIT Requirements'), false);
  assert.match(feeRow.detail, /\$99,000,000/);
});

test('four modes: mode 2, canonical only (flag on, deal has canonical data) -- the fixed rows render', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal());
  assert.equal(rows[0].servingSourceState, 'CANONICAL');
  assert.ok(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE'));
  assert.ok(rowById(rows, 'termination-fees-REVERSE_TERMINATION_FEE'));
});

test('four modes: mode 3, canonical flag on but THIS deal has no canonical data -- visible legacy fallback, no crash from the new seeding step', async () => {
  const mod = await feesConfig();
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: null,
    cards: [legacyCompanyFeeCard()],
    canonical_v2_termination_fee_serving_enabled: true,
    canonical_v2_termination_fee_cards: [],
  });
  assert.equal(rows[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.ok(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE'));
});

test('four modes: mode 4, both sources side by side -- V1 and V2 disagree visibly, neither is a blend of the other', async () => {
  const mod = await feesConfig();
  const reviewDeal = modivCanonicalReviewDeal();
  reviewDeal.cards = [legacyCompanyFeeCard()];
  reviewDeal.canonical_v2_termination_fee_compare_enabled = true;
  const rows = mod.terminationFeesConfig.selectRows(reviewDeal);
  assert.equal(rows[0].servingSourceState, 'BOTH_SOURCES');
  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(feeRow.sources.v1.headline, '$99,000,000');
  assert.equal(feeRow.sources.v2.headline, COMPANY_FEE_HEADLINE);
  assert.equal(feeRow.sourceComparison.state, 'DIFFER');
  // The row's OWN detail is the stated comparison, never a silent pick of
  // one side -- and never a hybrid string mixing legacy and canonical words.
  assert.match(feeRow.detail, /V1 and V2 differ/);
  assert.match(feeRow.detail, /\$99,000,000/);
  assert.match(feeRow.detail, /REIT Requirements/);
});

test('card sets never merge: a mixed reviewDeal with the flag OFF renders ONLY the legacy figure -- no conditional-fee text leaks in', async () => {
  const mod = await feesConfig();
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: null,
    cards: [legacyCompanyFeeCard()],
    canonical_v2_termination_fee_cards: projection.cards, // present on the wire, but flag is off
  });
  const feeRow = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(feeRow.detail.includes('REIT Requirements'), false, 'legacy is authoritative while the flag is off -- canonical data must not leak in');
  assert.match(feeRow.detail, /\$99,000,000/);
  // And the reverse check: canonical-only mode must never see the legacy
  // card's figure either.
  const canonicalOnlyRows = mod.terminationFeesConfig.selectRows(modivCanonicalReviewDeal());
  const canonicalFeeRow = rowById(canonicalOnlyRows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.equal(canonicalFeeRow.detail.includes('99,000,000'), false);
});

/* ─────────────────────────────────────────────────────────────────────────
   OTHER EXTRACTED FACTS FOUND ALONG THE WAY (see the report for the full
   list) -- pinned here so they stay honestly absent rather than silently
   drifting, since fixing them was out of this task's scope.
   ───────────────────────────────────────────────────────────────────────── */

test('the tail-period claim (the one entry actually in resolution.resolved) still projects correctly -- untouched by this change', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const tail = projection.cards.find((card) => card.provision_subtype === 'TERMF-TAIL');
  assert.ok(tail);
  assert.deepEqual(tail.features.tailFeeWindowMonths, {
    value: '12',
    unit: 'months',
    trigger: 'qualifying_termination',
  });
});

test('review_queue triggers (out of scope per the brief -- a manifest fix, not a projection fix) are still not projected', () => {
  const projection = projectTerminationFeeProductSurfaces({ resolution: MODIV_RESOLUTION, deal_id: MODIV_DEAL_ID });
  const target = projection.cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  // The five TERMINATION_FEE_TRIGGER review_queue entries never resolved
  // (their citations reach outside this run's scoped section), so no
  // triggers[] entries exist on the conditional-fee card -- correct, and
  // unaffected by this task.
  assert.deepEqual(target.features.companyTerminationFee.triggers, []);
});
