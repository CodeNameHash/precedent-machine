// QXO/TopBuild company termination fee — reviewed fixture (SPEC-QXO-TERMF-AMENDMENT-
// 2026-07-23, Step 2). Company Termination Fee only (party-side); no reverse/Parent
// fee rows (separate later packet).
//
// Built through lib/canonical-v2/reviewed-slice-harness.js's buildReviewedSlice —
// this is the WP-EXP-01 harness's first from-scratch consumer (no hand-rolled
// reviewed-*-slice.js oracle module backs this fixture; the harness IS the
// construction mechanism). Source text is quoted VERBATIM from the filed agreement
// (EDGAR accession 0001104659-26-045111, Ex. 2.1, §§6.2, 6.4 and 6.5(b)) and the
// deal's SEC-filed headline transaction value (same accession, Ex. 99.1) — see
// __fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.txt and
// __fixtures__/canonical-v2/qxo-deal-value-sec-excerpt.txt.
//
// Legal encoding is PROPOSAL-TERMF-TRIGGER-VOCABULARY-2026-07-23.md /
// SPEC-QXO-TERMF-AMENDMENT-2026-07-23.md Step 2, binding: six trigger
// relationships, exact codes/conditions/timings, nothing from the legacy card
// (tests/termf-tail-trigger-dedup.test.js's reconstruction cites nonexistent
// §8.02 sections and an unsourced 18-month tail — both absent here), vote-failure
// tail-only (never immediate-pay in this deal).
//
// CONCEPT KEYS (SPEC-VERSIONED-CONTRACT-2026-07-23): every provision below
// carries a `conceptKey` from FIXTURE_CONTRACT_INPUT_V2.concepts
// (lib/canonical-v2/contract-bundle.js) — V1 plus the four concept keys Ben
// approved in docs/archive/handoffs/SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md. This
// fixture now compiles under F2 (compileFixtureContractV2()), not the frozen
// F1 default; F1 and every reviewed-*-slice.js oracle's pinned digest are
// untouched (they still compile under F1, proven by
// tests/canonical-v2-contract-bundle-versions.test.js). An earlier version of
// this fixture (see git history) reused TERMR-RECOMMEND / TERMF-TAIL as
// placeholders for grounds those concepts don't describe, pending this
// concept-minting packet; that reuse is gone — each ground below now carries
// its own honest concept:
//   - rec_change / intervening_tail: TERMR-RECOMMEND (both are Change-in-
//     Recommendation grounds — one immediate, §6.4(a)(i)(A), one via the
//     intervening-event tail gateway, §6.5(b)(iii)(D); distinguished at the
//     trigger_code level, not the concept level, per
//     SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md).
//   - nosolicit_immediate / nosolicit_tail: TERMR-NOSOL-BREACH (the same
//     §4.3 no-solicitation-breach ground, reached via two pathways —
//     §6.4(a)(ii) directly, and §6.5(b)(iii)(C)(1) via the general-breach
//     gateway).
//   - vote_failure: TERMR-NOVOTE (§6.2(c) stockholder-vote-failure ground,
//     tail-only in this deal).
//   - covenant_breach: TERMR-BREACH (§6.5(b)(iii)(C)(2) general covenant/
//     agreement breach gateway).
// TERMR-OUTSIDE (the fourth approved concept) has no ground in this
// termination-FEE-only fixture — QXO's outside-date right doesn't trigger
// the Company Termination Fee — and is not used here.

const fs = require('node:fs');
const path = require('node:path');

const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV2,
  moneyDenominatorPrecisionPolicyForClaim,
} = require('../../lib/canonical-v2/contract-bundle');
const { buildFixtureClaimEvidenceDetailPackage } = require('../../lib/canonical-v2/exact-detail');
const { buildReviewedSlice } = require('../../lib/canonical-v2/reviewed-slice-harness');

const TERMINATION_EXCERPTS_HASH = 'a23116053df1e9d8a741f13e514558905c5dbe67e016c6fb54bf0d51adfab9c2';
const DEAL_VALUE_EXCERPT_HASH = '5e2a95c00ab1447d9717cfa24830d8f484ab06fb90a0fb912b85a0a518479089';
const DEAL_KEY = 'deal:qxo-topbuild';
const REVIEW_VERSION = 'QXO_SELLER_TERMINATION_FEE/V1';

const FEE_PARTY = Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
// Immediate-pay pathway (§6.5(b)(i)): the two grounds Parent may terminate on
// directly, sharing TWO_BUSINESS_DAYS_AFTER_TERMINATION.
const IMMEDIATE_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'PARENT', capacity: 'BUYER' });
// Tail pathway (§6.5(b)(iii)): Parent is always the fee's ultimate beneficiary
// regardless of which party nominally terminates.
const TAIL_PARTY = Object.freeze({ role: 'FEE_TRIGGER_BENEFICIARY', value: 'PARENT', capacity: 'BUYER' });

// Shared tail composition (PROPOSAL-TERMF-TRIGGER-VOCABULARY-2026-07-23's design
// rule: tail mechanics are conditions + payment_timing composed onto a ground
// trigger_code, not separate ground codes).
const TAIL_CONDITIONS = Object.freeze([
  'COMPETING_PROPOSAL_PUBLICLY_PENDING',
  'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
  'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
]);
const TAIL_TIMING = 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION';

// Exact verbatim substrings located within
// qxo-termination-fee-reviewed-excerpts.txt, each checked for uniqueness when this
// fixture was authored. Offsets below are UTF-8 byte offsets; the source file is
// pure ASCII so byte offset === character offset.
const GROUND_TEXT = Object.freeze({
  // §6.2(c) — Company stockholder vote failure ground.
  vote_failure: 'the Company Stockholder Approval shall not have been obtained by reason of the failure to obtain the required vote at the Company Stockholder Meeting duly convened (or any adjournment or postponement thereof)',
  // §6.4(a)(i)(A) — adverse recommendation change.
  rec_change: 'the Company Board shall have made a Company Adverse Recommendation Change',
  // §6.4(a)(ii) — material breach of the no-solicitation covenant (§4.3).
  nosolicit_immediate: "the Company or any of its Representatives (acting on behalf of the Company) materially breaches its obligations under Section 4.3 and, in the case of this clause (ii), such breach is not curable or, if curable is not cured prior to the earlier of (A) the fifth business day after written notice thereof is given by Parent to the Company and (B) the date that is three business days prior to the Outside Date",
  // §6.5(b)(iii)(C)(1) — the same §4.3 no-solicitation breach ground, reached via
  // the general-breach gateway instead of the direct §6.4(a)(ii) pathway.
  nosolicit_tail: "by Parent pursuant to the provisions of Section 6.4(b) in respect of a (1) breach of the Company's obligations under Section 4.3 (and the Company Stockholder Approval shall not theretofore have been obtained)",
  // §6.5(b)(iii)(C)(2) — the general covenant/agreement breach gateway.
  covenant_breach: 'a breach of any other covenant or agreement of this Agreement',
  // §6.5(b)(iii)(D) — intervening-event recommendation change.
  intervening_tail: "(D) by Parent pursuant to the provisions of Section 6.4(a)(i)(B) (and the Company Stockholder Approval shall not theretofore have been obtained)",
});

function locateSpan(text, needle, label) {
  const start = text.indexOf(needle);
  if (start < 0) throw new TypeError(`reviewed ${label} was not found`);
  if (text.indexOf(needle, start + 1) >= 0) throw new TypeError(`reviewed ${label} is ambiguous`);
  return { absoluteStart: start, absoluteEnd: start + needle.length };
}

// The covenant-breach ground text ("a breach of any other covenant or agreement
// of this Agreement") appears twice in §6.5(b) — once as the actual §6.5(b)(iii)
// (C)(2) ground, once inside the (x) disambiguation gloss. Anchor on the unique
// longer string that includes the (C)(2)/(D) boundary, then narrow to the
// meaningful ground text within it.
function locateWithinUniqueAnchor(text, anchor, needle, label) {
  const anchorStart = text.indexOf(anchor);
  if (anchorStart < 0) throw new TypeError(`reviewed ${label} anchor was not found`);
  if (text.indexOf(anchor, anchorStart + 1) >= 0) throw new TypeError(`reviewed ${label} anchor is ambiguous`);
  const needleStart = anchor.indexOf(needle);
  if (needleStart < 0) throw new TypeError(`reviewed ${label} was not found within its anchor`);
  const absoluteStart = anchorStart + needleStart;
  return { absoluteStart, absoluteEnd: absoluteStart + needle.length };
}

function buildQxoTerminationFeeFixture({
  contractBundle = compileFixtureContractV2(),
  corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-termination-fee-reviewed-fixture'),
  servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-termination-fee-reviewed-fixture'),
} = {}) {
  const denominatorPrecisionPolicy = moneyDenominatorPrecisionPolicyForClaim(
    contractBundle,
    'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  );
  const terminationText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'canonical-v2', 'qxo-termination-fee-reviewed-excerpts.txt'),
    'utf8',
  );
  const dealValueText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'canonical-v2', 'qxo-deal-value-sec-excerpt.txt'),
    'utf8',
  );

  const feePayment = locateSpan(
    terminationText,
    'then, in the case of each of (i), (ii) and (iii), the Company shall pay Parent the Company Termination Fee, by wire transfer (to an account designated by Parent) in immediately available funds (1) in the case of clause (i) of this Section 6.5(b), within two (2) business days after such termination, (2) in the case of clause (ii) of this Section 6.5(b), within two (2) business days after such termination and (3) in the case of clause (iii) of this Section 6.5(b), upon the earlier of entering into such definitive agreement with respect to a Company Acquisition Proposal or the consummation of the transactions contemplated by a Company Acquisition Proposal. "Company Termination Fee" shall mean a cash amount equal to $600,000,000. Each of the parties acknowledges that the Company Termination Fee is not a penalty, but rather are liquidated damages in a reasonable amount that will compensate Parent in the circumstances in which such Company Termination Fee is due and payable, for the efforts and resources expended and opportunities foregone while negotiating this Agreement and in reliance on this Agreement and on the expectation of the consummation of the Transactions, which amount would otherwise be impossible to calculate with precision. In no event shall Parent be entitled to the Company Termination Fee on more than one occasion.',
    'fee payment',
  );
  const feeAmount = locateSpan(terminationText, '$600,000,000', 'fee amount');
  const voteFailure = locateSpan(terminationText, GROUND_TEXT.vote_failure, 'vote-failure ground');
  const recChange = locateSpan(terminationText, GROUND_TEXT.rec_change, 'recommendation-change ground');
  const nosolicitImmediate = locateSpan(terminationText, GROUND_TEXT.nosolicit_immediate, 'immediate no-solicit-breach ground');
  const nosolicitTail = locateSpan(terminationText, GROUND_TEXT.nosolicit_tail, 'tail no-solicit-breach ground');
  const covenantBreach = locateWithinUniqueAnchor(
    terminationText,
    "or (2) a breach of any other covenant or agreement of this Agreement or (D) by Parent pursuant to the provisions of Section 6.4(a)(i)(B)",
    GROUND_TEXT.covenant_breach,
    'covenant-breach ground',
  );
  const interveningTail = locateSpan(terminationText, GROUND_TEXT.intervening_tail, 'intervening-event ground');
  const dealValueParagraph = locateSpan(
    dealValueText,
    'GREENWICH, Conn. and DAYTONA BEACH, Fla. - April 19, 2026 - QXO, Inc. (NYSE: QXO) today announced that it has entered into a definitive agreement to acquire TopBuild Corp. (NYSE: BLD) ("TopBuild") for approximately $17 billion, significantly expanding QXO\'s scale and capabilities across the building products value chain.',
    'deal value paragraph',
  );

  const input = {
    dealKey: DEAL_KEY,
    dealAdmissionSeed: 'qxo-topbuild-termination-fee-reviewed-excerpts',
    reviewVersion: REVIEW_VERSION,
    corpusReleaseId,
    contractBundle,
    // Deal dimensions copied from lib/canonical-v2/reviewed-qxo-no-shop-slice.js
    // (same deal); deal_value_usd is populated here (the no-shop notice-period
    // metric did not need a denominator, so it was null there).
    deal: {
      dimensions: {
        sector: 'Building products',
        buyer: 'QXO',
        merger_form: 'Reverse triangular merger',
        adviser_firms: ['Paul Weiss', 'Jones Day'],
        lawyers: ['Scott Barshay', 'Robert Profusek'],
        announce_year: 2026,
        deal_value_usd: '17000000000',
      },
    },
    sources: [
      {
        key: 'termination',
        text: terminationText,
        sourceKind: 'REVIEWED_MERGER_AGREEMENT_EXCERPT',
        sourceOccurrenceKey: 'qxo-topbuild-termination-fee-reviewed-excerpts',
        expectedDocumentHash: TERMINATION_EXCERPTS_HASH,
        admissionOrdinal: 0,
      },
      {
        key: 'dealValue',
        text: dealValueText,
        sourceKind: 'SEC_FILING_EXCERPT_UTF8',
        sourceOccurrenceKey: 'sec:1236275:000110465926045111:tm2612209d1_ex99-1.htm',
        expectedDocumentHash: DEAL_VALUE_EXCERPT_HASH,
        admissionOrdinal: 1,
      },
    ],
    spans: [
      { key: 'fee_payment', sourceKey: 'termination', ...feePayment },
      { key: 'fee_amount', sourceKey: 'termination', ...feeAmount },
      { key: 'vote_failure', sourceKey: 'termination', ...voteFailure },
      { key: 'rec_change', sourceKey: 'termination', ...recChange },
      { key: 'nosolicit_immediate', sourceKey: 'termination', ...nosolicitImmediate },
      { key: 'nosolicit_tail', sourceKey: 'termination', ...nosolicitTail },
      { key: 'covenant_breach', sourceKey: 'termination', ...covenantBreach },
      { key: 'intervening_tail', sourceKey: 'termination', ...interveningTail },
      { key: 'deal_value', sourceKey: 'dealValue', ...dealValueParagraph },
    ],
    excerpts: [
      { key: 'fee_payment', spanKey: 'fee_payment' },
      { key: 'fee_amount', spanKey: 'fee_amount' },
      { key: 'vote_failure', spanKey: 'vote_failure' },
      { key: 'rec_change', spanKey: 'rec_change' },
      { key: 'nosolicit_immediate', spanKey: 'nosolicit_immediate' },
      { key: 'nosolicit_tail', spanKey: 'nosolicit_tail' },
      { key: 'covenant_breach', spanKey: 'covenant_breach' },
      { key: 'intervening_tail', spanKey: 'intervening_tail' },
      { key: 'deal_value', spanKey: 'deal_value' },
    ],
    provisions: [
      { key: 'fee', spanKey: 'fee_payment', conceptKey: 'TERMF-TARGET', party: FEE_PARTY, ordinal: 1 },
      { key: 'rec_change', spanKey: 'rec_change', conceptKey: 'TERMR-RECOMMEND', party: IMMEDIATE_PARTY, ordinal: 1 },
      { key: 'nosolicit_immediate', spanKey: 'nosolicit_immediate', conceptKey: 'TERMR-NOSOL-BREACH', party: IMMEDIATE_PARTY, ordinal: 2 },
      { key: 'vote_failure', spanKey: 'vote_failure', conceptKey: 'TERMR-NOVOTE', party: TAIL_PARTY, ordinal: 1 },
      { key: 'nosolicit_tail', spanKey: 'nosolicit_tail', conceptKey: 'TERMR-NOSOL-BREACH', party: TAIL_PARTY, ordinal: 2 },
      { key: 'covenant_breach', spanKey: 'covenant_breach', conceptKey: 'TERMR-BREACH', party: TAIL_PARTY, ordinal: 3 },
      { key: 'intervening_tail', spanKey: 'intervening_tail', conceptKey: 'TERMR-RECOMMEND', party: TAIL_PARTY, ordinal: 4 },
    ],
    components: [
      { key: 'fee_component', parentProvisionKey: 'fee', spanKey: 'fee_payment', componentKey: 'FEE_AMOUNT_LIMB', ordinal: 1 },
      { key: 'rec_change_component', parentProvisionKey: 'rec_change', spanKey: 'rec_change', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 1 },
      { key: 'nosolicit_immediate_component', parentProvisionKey: 'nosolicit_immediate', spanKey: 'nosolicit_immediate', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 2 },
      { key: 'vote_failure_component', parentProvisionKey: 'vote_failure', spanKey: 'vote_failure', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 3 },
      { key: 'nosolicit_tail_component', parentProvisionKey: 'nosolicit_tail', spanKey: 'nosolicit_tail', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 4 },
      { key: 'covenant_breach_component', parentProvisionKey: 'covenant_breach', spanKey: 'covenant_breach', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 5 },
      { key: 'intervening_tail_component', parentProvisionKey: 'intervening_tail', spanKey: 'intervening_tail', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 6 },
    ],
    claims: [
      {
        key: 'fee_claim',
        subjectComponentKey: 'fee_component',
        claimDefinitionKey: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
        ordinal: 0,
        state: 'PRESENT',
        rawValueExcerptKey: 'fee_amount',
        normalisation: {
          kind: 'money_relative_to_deal_value',
          rawAmount: '600000000',
          currency: 'USD',
          denominator: {
            value: '17000000000',
            currency: 'USD',
            basis: 'HEADLINE_TRANSACTION_VALUE',
            sourceLineageExcerptKeys: ['deal_value'],
            ...(denominatorPrecisionPolicy ? { precision: 'APPROXIMATE' } : {}),
          },
        },
        extraAttributes: { fee_side: 'SELLER', payee_value: 'PARENT', payee_capacity: 'BUYER' },
        evidence: [
          { excerptKey: 'fee_amount', role: 'OPERATIVE_TEXT', documentOrdinal: 0 },
          { excerptKey: 'deal_value', role: 'DERIVATION_INPUT', documentOrdinal: 1 },
        ],
        scopeClosureKind: 'evidence_id_list',
      },
    ],
    relationships: [
      // Immediate-pay triggers (§6.5(b)(i)).
      {
        key: 'rec_change_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 0,
        state: 'PRESENT',
        rawScopeExcerptKey: 'rec_change',
        targetComponentKeys: ['rec_change_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
          terminating_party: 'PARENT',
          payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
          conditions: [],
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'rec_change', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['rec_change'],
      },
      {
        key: 'nosolicit_immediate_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 1,
        state: 'PRESENT',
        rawScopeExcerptKey: 'nosolicit_immediate',
        targetComponentKeys: ['nosolicit_immediate_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
          terminating_party: 'PARENT',
          payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
          conditions: [],
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'nosolicit_immediate', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['nosolicit_immediate'],
      },
      // Tail triggers (§6.5(b)(iii)).
      {
        key: 'vote_failure_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 2,
        state: 'PRESENT',
        rawScopeExcerptKey: 'vote_failure',
        targetComponentKeys: ['vote_failure_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
          terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
          payment_timing: TAIL_TIMING,
          conditions: [...TAIL_CONDITIONS, 'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'],
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'vote_failure', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['vote_failure'],
      },
      {
        key: 'nosolicit_tail_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 3,
        state: 'PRESENT',
        rawScopeExcerptKey: 'nosolicit_tail',
        targetComponentKeys: ['nosolicit_tail_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
          terminating_party: 'PARENT',
          payment_timing: TAIL_TIMING,
          conditions: TAIL_CONDITIONS,
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'nosolicit_tail', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['nosolicit_tail'],
      },
      {
        key: 'covenant_breach_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 4,
        state: 'PRESENT',
        rawScopeExcerptKey: 'covenant_breach',
        targetComponentKeys: ['covenant_breach_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
          terminating_party: 'PARENT',
          payment_timing: TAIL_TIMING,
          conditions: TAIL_CONDITIONS,
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'covenant_breach', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['covenant_breach'],
      },
      {
        key: 'intervening_tail_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 5,
        state: 'PRESENT',
        rawScopeExcerptKey: 'intervening_tail',
        targetComponentKeys: ['intervening_tail_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
          terminating_party: 'PARENT',
          payment_timing: TAIL_TIMING,
          conditions: TAIL_CONDITIONS,
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'intervening_tail', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['intervening_tail'],
      },
    ],
    results: [
      {
        key: 'fee_result',
        resultKey: 'SELLER_TERMINATION_FEE',
        resultVersion: 1,
        conceptKey: 'TERMF-TARGET',
        party: FEE_PARTY,
        valueSlotKey: 'FEE_AMOUNT',
        ordinal: 0,
        claimKey: 'fee_claim',
        relationshipKeys: [
          'rec_change_rel',
          'nosolicit_immediate_rel',
          'vote_failure_rel',
          'nosolicit_tail_rel',
          'covenant_breach_rel',
          'intervening_tail_rel',
        ],
        completeness: 'COMPLETE',
        comparability: 'COMPARABLE',
        metricKey: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
        compositionScopeClosureShape: 'claim_and_relationships',
      },
    ],
    servingRows: [
      { key: 'fee_row', resultKey: 'fee_result', servingNamespaceId, resultOrdinal: 0 },
    ],
    reviewedMapping: {
      primarySourceKey: 'termination',
      structuralSectionProposalIds: null,
      governedEvidenceExcerptKeys: [
        'fee_payment', 'fee_amount', 'vote_failure', 'rec_change',
        'nosolicit_immediate', 'nosolicit_tail', 'covenant_breach', 'intervening_tail',
        'deal_value',
      ],
    },
    semanticClosure: { admissionFieldStyle: 'plural', includeComponentIds: true },
    canonicalWriteSetShape: 'plural_sources',
  };

  const harness = buildReviewedSlice(input);
  const row = harness.servingRows.fee_row;
  const detailPackage = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row,
    source: harness.sources.termination,
    source_admission: harness.admissions.termination,
    excerpt: harness.excerpts.fee_amount,
    claim: harness.claims.fee_claim,
    action_slot_key: 'RESULT_COMPONENT_CLAIM_EVIDENCE',
    evidence_ordinal: 0,
  });

  return Object.freeze({
    input,
    harness,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    row,
    detailPackage,
  });
}

module.exports = { buildQxoTerminationFeeFixture };
