const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildReviewedTerminationFeeServingRow,
  buildReviewedTerminationFeeSlice,
} = require('../lib/canonical-v2/reviewed-termination-fee-slice');
const {
  buildQxoNoShopNoticeSlice,
  buildQxoNoShopServingRows,
} = require('../lib/canonical-v2/reviewed-qxo-no-shop-slice');
const { buildReviewedSlice } = require('../lib/canonical-v2/reviewed-slice-harness');

const contractBundle = compileFixtureContract();

// ---------------------------------------------------------------------
// Landos termination-fee replay
// ---------------------------------------------------------------------

const AGREEMENT_HASH = 'fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be';
const DEAL_VALUE_HASH = '60eb81f6a3091816da7f3390620266bfa60ce508e30ee9e61f1534626df479a3';
const FEE_PARTY = Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
const SUPERIOR_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'COMPANY', capacity: 'TARGET' });
const RECOMMEND_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'PARENT', capacity: 'BUYER' });
const TAIL_PARTY = Object.freeze({ role: 'FEE_TRIGGER_BENEFICIARY', value: 'PARENT', capacity: 'BUYER' });

function buildLandosTerminationFeeReplay() {
  const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
  const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
  const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture');
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture');

  const oracleSlice = buildReviewedTerminationFeeSlice({
    agreementText, dealValueSourceText, contractBundle, corpusReleaseId,
  });
  const oracleRow = buildReviewedTerminationFeeServingRow({ slice: oracleSlice, contractBundle });

  const span = (excerptKey, sourceKey) => ({
    key: excerptKey,
    sourceKey,
    absoluteStart: oracleSlice.excerpts[excerptKey].absolute_start,
    absoluteEnd: oracleSlice.excerpts[excerptKey].absolute_end,
  });

  const input = {
    dealKey: 'deal:landos-abbvie',
    dealAdmissionSeed: 'landos-abbvie',
    reviewVersion: 'LANDOS_SELLER_TERMINATION_FEE/V1',
    corpusReleaseId,
    contractBundle,
    deal: {
      dimensions: {
        sector: 'Biopharma',
        buyer: 'AbbVie',
        merger_form: 'Reverse triangular merger',
        adviser_firms: [],
        lawyers: [],
        announce_year: 2024,
        deal_value_usd: '137500000',
      },
    },
    sources: [
      {
        key: 'agreement',
        text: agreementText,
        sourceKind: 'PLAIN_UTF8',
        sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
        expectedDocumentHash: AGREEMENT_HASH,
        admissionOrdinal: 0,
      },
      {
        key: 'dealValue',
        text: dealValueSourceText,
        sourceKind: 'SEC_FILING_EXCERPT_UTF8',
        sourceOccurrenceKey: 'sec:1785345:000119312524077190:d787351ddefa14a.htm',
        expectedDocumentHash: DEAL_VALUE_HASH,
        admissionOrdinal: 1,
      },
    ],
    spans: [
      span('superior_trigger', 'agreement'),
      span('recommendation_trigger', 'agreement'),
      span('tail_trigger', 'agreement'),
      span('fee_payment', 'agreement'),
      span('fee_amount', 'agreement'),
      span('deal_value', 'dealValue'),
      {
        key: 'fee_provision_span',
        sourceKey: 'agreement',
        absoluteStart: oracleSlice.provisions[0].absolute_start,
        absoluteEnd: oracleSlice.provisions[0].absolute_end,
      },
    ],
    excerpts: [
      { key: 'superior_trigger', spanKey: 'superior_trigger' },
      { key: 'recommendation_trigger', spanKey: 'recommendation_trigger' },
      { key: 'tail_trigger', spanKey: 'tail_trigger' },
      { key: 'fee_payment', spanKey: 'fee_payment' },
      { key: 'fee_amount', spanKey: 'fee_amount' },
      { key: 'deal_value', spanKey: 'deal_value' },
    ],
    provisions: [
      { key: 'fee', spanKey: 'fee_provision_span', conceptKey: 'TERMF-TARGET', party: FEE_PARTY, ordinal: 1 },
      { key: 'superior', spanKey: 'superior_trigger', conceptKey: 'TERMR-SUPERIOR', party: SUPERIOR_PARTY, ordinal: 1 },
      { key: 'recommend', spanKey: 'recommendation_trigger', conceptKey: 'TERMR-RECOMMEND', party: RECOMMEND_PARTY, ordinal: 2 },
      { key: 'tail', spanKey: 'tail_trigger', conceptKey: 'TERMF-TAIL', party: TAIL_PARTY, ordinal: 3 },
    ],
    components: [
      { key: 'fee_component', parentProvisionKey: 'fee', spanKey: 'fee_payment', componentKey: 'FEE_AMOUNT_LIMB', ordinal: 1 },
      { key: 'superior_component', parentProvisionKey: 'superior', spanKey: 'superior_trigger', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 1 },
      { key: 'recommend_component', parentProvisionKey: 'recommend', spanKey: 'recommendation_trigger', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 2 },
      { key: 'tail_component', parentProvisionKey: 'tail', spanKey: 'tail_trigger', componentKey: 'TERMINATION_TRIGGER_LIMB', ordinal: 3 },
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
          rawAmount: '7000000',
          currency: 'USD',
          denominator: {
            value: '137500000',
            currency: 'USD',
            basis: 'HEADLINE_TRANSACTION_VALUE',
            sourceLineageExcerptKeys: ['deal_value'],
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
      {
        key: 'superior_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 0,
        state: 'PRESENT',
        rawScopeExcerptKey: 'superior_trigger',
        targetComponentKeys: ['superior_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION',
          terminating_party: 'COMPANY',
          payment_timing: 'CONCURRENT_WITH_TERMINATION',
          conditions: [],
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'superior_trigger', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['superior_trigger'],
      },
      {
        key: 'recommend_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 1,
        state: 'PRESENT',
        rawScopeExcerptKey: 'recommendation_trigger',
        targetComponentKeys: ['recommend_component'],
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
          { excerptKey: 'recommendation_trigger', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['recommendation_trigger'],
      },
      {
        key: 'tail_rel',
        sourceComponentKey: 'fee_component',
        relationshipDefinitionKey: 'TRIGGERED_BY',
        ordinal: 2,
        state: 'PRESENT',
        rawScopeExcerptKey: 'tail_trigger',
        targetComponentKeys: ['tail_component'],
        effect: {
          effect_mode: 'TYPED_LEGAL_EFFECT',
          legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
          trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
          terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
          payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
          conditions: [
            'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
            'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
            'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
          ],
        },
        evidence: [
          { excerptKey: 'fee_payment', role: 'DERIVATION_INPUT', documentOrdinal: 0 },
          { excerptKey: 'tail_trigger', role: 'CROSS_REFERENCE', documentOrdinal: 0 },
        ],
        targetIntervalExcerptKeys: ['tail_trigger'],
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
        relationshipKeys: ['superior_rel', 'recommend_rel', 'tail_rel'],
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
      primarySourceKey: 'agreement',
      structuralSectionProposalIds: [
        oracleSlice.sections['7.1'].structural_section_proposal_id,
        oracleSlice.sections['7.3'].structural_section_proposal_id,
      ],
      governedEvidenceExcerptKeys: [
        'superior_trigger', 'recommendation_trigger', 'tail_trigger', 'fee_payment', 'fee_amount', 'deal_value',
      ],
    },
    semanticClosure: { admissionFieldStyle: 'plural', includeComponentIds: true },
    canonicalWriteSetShape: 'plural_sources',
  };

  return { input, oracleSlice, oracleRow, harness: buildReviewedSlice(input) };
}

test('harness replays the Landos termination-fee provisions, components and claim byte-for-byte', () => {
  const { oracleSlice, harness } = buildLandosTerminationFeeReplay();
  assert.deepStrictEqual(harness.provisions.fee, oracleSlice.provisions[0]);
  assert.deepStrictEqual(harness.provisions.superior, oracleSlice.provisions[1]);
  assert.deepStrictEqual(harness.provisions.recommend, oracleSlice.provisions[2]);
  assert.deepStrictEqual(harness.provisions.tail, oracleSlice.provisions[3]);
  assert.deepStrictEqual(harness.components.fee_component, oracleSlice.feeComponent);
  assert.deepStrictEqual(harness.components.superior_component, oracleSlice.triggerComponents[0]);
  assert.deepStrictEqual(harness.components.recommend_component, oracleSlice.triggerComponents[1]);
  assert.deepStrictEqual(harness.components.tail_component, oracleSlice.triggerComponents[2]);
  assert.deepStrictEqual(harness.claims.fee_claim, oracleSlice.feeClaim);
});

test('harness replays the Landos three trigger relationships byte-for-byte', () => {
  const { oracleSlice, harness } = buildLandosTerminationFeeReplay();
  assert.deepStrictEqual(harness.relationships.superior_rel, oracleSlice.triggerRelationships[0]);
  assert.deepStrictEqual(harness.relationships.recommend_rel, oracleSlice.triggerRelationships[1]);
  assert.deepStrictEqual(harness.relationships.tail_rel, oracleSlice.triggerRelationships[2]);
});

test('harness replays the Landos result, projection, reviewed mapping, write-set and serving row byte-for-byte', () => {
  const { oracleSlice, oracleRow, harness } = buildLandosTerminationFeeReplay();
  assert.deepStrictEqual(harness.results.fee_result.result, oracleSlice.result);
  assert.deepStrictEqual(harness.results.fee_result.projection, oracleSlice.projection);
  assert.deepStrictEqual(harness.reviewed_mapping, oracleSlice.reviewed_mapping);
  assert.deepStrictEqual(harness.canonicalWriteSet, oracleSlice.canonicalWriteSet);
  assert.deepStrictEqual(harness.servingRows.fee_row, oracleRow);
});

// ---------------------------------------------------------------------
// QXO no-shop replay
// ---------------------------------------------------------------------

const QXO_SOURCE_HASH = '5a0a3df49f22a610f1fcca609b55bfa3fcb543d26dd3cbfde04670b29ced6e72';
const QXO_TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const QXO_BUYER_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });

function buildQxoNoShopReplay() {
  const sourceText = fs.readFileSync('__fixtures__/canonical-v2/qxo-no-shop-reviewed-excerpts.txt', 'utf8');
  const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-reviewed-notice-fixture');
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-reviewed-notice-fixture');

  const oracleSlice = buildQxoNoShopNoticeSlice({ sourceText, contractBundle, corpusReleaseId });
  const oracleRows = buildQxoNoShopServingRows({ slice: oracleSlice, contractBundle, servingNamespaceId });

  const span = (excerptKey) => ({
    key: excerptKey,
    sourceKey: 'source',
    absoluteStart: oracleSlice.excerpts[excerptKey].absolute_start,
    absoluteEnd: oracleSlice.excerpts[excerptKey].absolute_end,
  });

  const input = {
    dealKey: 'deal:qxo-topbuild',
    dealAdmissionSeed: 'qxo-topbuild-reviewed-excerpts',
    reviewVersion: 'QXO_NO_SHOP_NOTICE/V1',
    corpusReleaseId,
    contractBundle,
    deal: {
      dimensions: {
        sector: 'Building products',
        buyer: 'QXO',
        merger_form: 'Reverse triangular merger',
        adviser_firms: ['Paul Weiss', 'Jones Day'],
        lawyers: ['Scott Barshay', 'Robert Profusek'],
        announce_year: 2026,
        deal_value_usd: null,
      },
    },
    sources: [
      {
        key: 'source',
        text: sourceText,
        sourceKind: 'REVIEWED_MERGER_AGREEMENT_EXCERPT',
        sourceOccurrenceKey: 'qxo-topbuild-no-shop-reviewed-excerpts',
        expectedDocumentHash: QXO_SOURCE_HASH,
        admissionOrdinal: 0,
      },
    ],
    spans: [
      span('notice_clause'),
      span('match_clause'),
      span('notice_clock'),
      span('match_clock'),
    ],
    excerpts: [
      { key: 'notice_clause', spanKey: 'notice_clause' },
      { key: 'match_clause', spanKey: 'match_clause' },
      { key: 'notice_clock', spanKey: 'notice_clock' },
      { key: 'match_clock', spanKey: 'match_clock' },
    ],
    provisions: [
      { key: 'notice', spanKey: 'notice_clause', conceptKey: 'NOSOL-NOTICE', party: QXO_TARGET_PARTY, ordinal: 1 },
      { key: 'match', spanKey: 'match_clause', conceptKey: 'NOSOL-MATCH', party: QXO_BUYER_PARTY, ordinal: 1 },
    ],
    components: [
      { key: 'notice_component', parentProvisionKey: 'notice', spanKey: 'notice_clause', componentKey: 'NOTICE_LIMB', ordinal: 1 },
      { key: 'match_component', parentProvisionKey: 'match', spanKey: 'match_clause', componentKey: 'MATCH_PERIOD_LIMB', ordinal: 1 },
    ],
    claims: [
      {
        key: 'notice_claim',
        subjectComponentKey: 'notice_component',
        claimDefinitionKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
        ordinal: 0,
        state: 'PRESENT',
        rawValueExcerptKey: 'notice_clock',
        normalisation: {
          kind: 'duration_to_days', rawMagnitude: '24', rawUnit: 'HOURS', dayBasis: 'ELAPSED', trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
        },
        extraAttributes: {},
        evidence: [{ excerptKey: 'notice_clock', role: 'OPERATIVE_TEXT', documentOrdinal: 0 }],
        scopeClosureKind: 'subject_and_single_excerpt',
      },
      {
        key: 'match_claim',
        subjectComponentKey: 'match_component',
        claimDefinitionKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
        ordinal: 0,
        state: 'PRESENT',
        rawValueExcerptKey: 'match_clock',
        normalisation: {
          kind: 'duration_to_days', rawMagnitude: '4', rawUnit: 'DAYS', dayBasis: 'BUSINESS', trigger: 'SUPERIOR_PROPOSAL_NOTICE',
        },
        extraAttributes: {},
        evidence: [{ excerptKey: 'match_clock', role: 'OPERATIVE_TEXT', documentOrdinal: 0 }],
        scopeClosureKind: 'subject_and_single_excerpt',
      },
    ],
    relationships: [],
    results: [
      {
        key: 'notice_result',
        resultKey: 'TARGET_NO_SHOP_NOTICE',
        resultVersion: 1,
        conceptKey: 'NOSOL-NOTICE',
        party: QXO_TARGET_PARTY,
        valueSlotKey: 'NOTICE_PERIOD',
        ordinal: 0,
        claimKey: 'notice_claim',
        relationshipKeys: [],
        completeness: 'COMPLETE',
        comparability: 'COMPARABLE',
        metricKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
        compositionScopeClosureShape: 'claim_scalar',
      },
      {
        key: 'match_result',
        resultKey: 'BUYER_INITIAL_MATCH_RIGHT',
        resultVersion: 1,
        conceptKey: 'NOSOL-MATCH',
        party: QXO_BUYER_PARTY,
        valueSlotKey: 'INITIAL_MATCH_PERIOD',
        ordinal: 0,
        claimKey: 'match_claim',
        relationshipKeys: [],
        completeness: 'COMPLETE',
        comparability: 'COMPARABLE',
        metricKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
        compositionScopeClosureShape: 'claim_scalar',
      },
    ],
    servingRows: [
      { key: 'notice_row', resultKey: 'notice_result', servingNamespaceId, resultOrdinal: 0 },
      { key: 'match_row', resultKey: 'match_result', servingNamespaceId, resultOrdinal: 0 },
    ],
    reviewedMapping: {
      primarySourceKey: 'source',
      structuralSectionProposalIds: null,
      governedEvidenceExcerptKeys: ['notice_clock', 'match_clock'],
    },
    semanticClosure: { admissionFieldStyle: 'singular', includeComponentIds: false },
    canonicalWriteSetShape: 'singular_source',
  };

  return { input, oracleSlice, oracleRows, harness: buildReviewedSlice(input) };
}

test('harness replays both QXO no-shop provisions, components and claims byte-for-byte', () => {
  const { oracleSlice, harness } = buildQxoNoShopReplay();
  assert.deepStrictEqual(harness.provisions.notice, oracleSlice.provisions[0]);
  assert.deepStrictEqual(harness.provisions.match, oracleSlice.provisions[1]);
  assert.deepStrictEqual(harness.components.notice_component, oracleSlice.components[0]);
  assert.deepStrictEqual(harness.components.match_component, oracleSlice.components[1]);
  assert.deepStrictEqual(harness.claims.notice_claim, oracleSlice.claims[0]);
  assert.deepStrictEqual(harness.claims.match_claim, oracleSlice.claims[1]);
});

test('harness replays the QXO no-shop notice result, mapping, write-set and one serving row byte-for-byte', () => {
  const { oracleSlice, oracleRows, harness } = buildQxoNoShopReplay();
  assert.deepStrictEqual(harness.results.notice_result.result, oracleSlice.results[0].result);
  assert.deepStrictEqual(harness.results.notice_result.projection, oracleSlice.results[0].projection);
  assert.deepStrictEqual(harness.results.match_result.result, oracleSlice.results[1].result);
  assert.deepStrictEqual(harness.results.match_result.projection, oracleSlice.results[1].projection);
  assert.deepStrictEqual(harness.reviewed_mapping, oracleSlice.reviewed_mapping);
  assert.deepStrictEqual(harness.canonicalWriteSet, oracleSlice.canonicalWriteSet);
  assert.deepStrictEqual(harness.servingRows.notice_row, oracleRows[0]);
  assert.deepStrictEqual(harness.servingRows.match_row, oracleRows[1]);
});

// ---------------------------------------------------------------------
// Throw-don't-guess: missing / unknown input fields never get defaulted
// ---------------------------------------------------------------------

test('an unrecognised top-level input field throws instead of being ignored', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = { ...input, unexpectedField: true };
  assert.throws(() => buildReviewedSlice(mutated), /input fields do not match the harness input contract/);
});

test('a missing top-level input field throws instead of being defaulted', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = { ...input };
  delete mutated.reviewVersion;
  assert.throws(() => buildReviewedSlice(mutated), /input fields do not match the harness input contract/);
});

test('an unrecognised field on a spans[] entry throws', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    spans: input.spans.map((s, i) => (i === 0 ? { ...s, extraField: 1 } : s)),
  };
  assert.throws(() => buildReviewedSlice(mutated), /spans\[\] fields do not match the harness input contract/);
});

test('a missing field on a sources[] entry throws', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    sources: input.sources.map((s) => {
      const { admissionOrdinal, ...rest } = s;
      return rest;
    }),
  };
  assert.throws(() => buildReviewedSlice(mutated), /sources\[\] fields do not match the harness input contract/);
});

test('a source whose bytes do not match expectedDocumentHash throws rather than silently admitting it', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    sources: input.sources.map((s) => ({ ...s, expectedDocumentHash: `${s.expectedDocumentHash.slice(0, -1)}0` })),
  };
  assert.throws(() => buildReviewedSlice(mutated), /document hash does not match expectedDocumentHash/);
});

test('a span referencing an unknown sourceKey throws instead of guessing a source', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    spans: input.spans.map((s, i) => (i === 0 ? { ...s, sourceKey: 'no-such-source' } : s)),
  };
  assert.throws(() => buildReviewedSlice(mutated), /spans\[\]\.sourceKey references an unknown key/);
});

test('a claim with an unrecognised normalisation kind throws', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    claims: input.claims.map((c, i) => (i === 0 ? { ...c, normalisation: { ...c.normalisation, kind: 'made_up_kind' } } : c)),
  };
  assert.throws(() => buildReviewedSlice(mutated), /unknown claims\[\]\.normalisation\.kind/);
});

test('a claim with an unrecognised scopeClosureKind throws', () => {
  const { input } = buildQxoNoShopReplay();
  const mutated = {
    ...input,
    claims: input.claims.map((c, i) => (i === 0 ? { ...c, scopeClosureKind: 'made_up_kind' } : c)),
  };
  assert.throws(() => buildReviewedSlice(mutated), /unknown claims\[\]\.scopeClosureKind/);
});

test('a relationship targeting an unknown component throws instead of guessing a target', () => {
  const { input } = buildLandosTerminationFeeReplay();
  const mutated = {
    ...input,
    relationships: input.relationships.map((r, i) => (i === 0 ? { ...r, targetComponentKeys: ['no-such-component'] } : r)),
  };
  assert.throws(() => buildReviewedSlice(mutated), /targetComponentKeys\[0\] references an unknown key/);
});

test('a claim_scalar result composition shape refuses to silently drop relationships', () => {
  const { input } = buildLandosTerminationFeeReplay();
  const mutated = {
    ...input,
    results: input.results.map((r) => ({ ...r, compositionScopeClosureShape: 'claim_scalar' })),
  };
  assert.throws(() => buildReviewedSlice(mutated), /cannot carry relationships silently/);
});
