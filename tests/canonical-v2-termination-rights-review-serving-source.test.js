'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD,
  RED_HAT_DEAL_ID,
  TERMINATION_RIGHTS_REVIEW_SOURCE_STATE,
  attachCanonicalTerminationRightsReview,
  createCanonicalTerminationRightsReviewAttacher,
  isCanonicalV2TerminationRightsReviewServingEnabled,
} = require('../lib/canonical-v2/termination-rights-review-serving-source');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const DEAL_ID = '00000000-0000-4000-8000-000000000001';

function previewServingEnv(overrides = {}) {
  return {
    [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY]:
      CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE,
    NODE_ENV: 'development',
    ...overrides,
  };
}

test('an unregistered deal is an exact no-op', async () => {
  const reviewDeal = Object.freeze({
    dealId: DEAL_ID,
    cardCount: 0,
    cards: [],
  });

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, {
    env: previewServingEnv(),
  });

  assert.equal(result, reviewDeal);
});

test('the serving gate off is an exact no-op even for the registered Red Hat deal', async () => {
  const reviewDeal = Object.freeze({ dealId: RED_HAT_DEAL_ID, cards: [] });

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, { env: {} });

  assert.equal(result, reviewDeal);
  assert.equal(isCanonicalV2TerminationRightsReviewServingEnabled({}), false);
});

test('a registered source failure is visible and does not attach partial review data', async () => {
  const reviewDeal = Object.freeze({ dealId: DEAL_ID, cardCount: 0, cards: [] });
  const loggerCalls = [];

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, {
    env: previewServingEnv(),
    sources: {
      [DEAL_ID]: async () => {
        const error = new Error('registered source is unavailable');
        error.code = 'SOURCE_UNAVAILABLE';
        throw error;
      },
    },
    reviewState: {
      [DEAL_ID]: { open_review_keys: [], prompts: [], fact_groups: [] },
    },
    logger: {
      error(...args) { loggerCalls.push(args); },
    },
  });

  assert.notEqual(result, reviewDeal);
  assert.deepEqual(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD],
    {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
      review_row_count: 0,
      prompt_count: 0,
      failure: {
        error_name: 'Error',
        error_code: 'SOURCE_UNAVAILABLE',
        error_message: 'registered source is unavailable',
      },
    },
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result,
      'canonical_v2_termination_rights_review_rows',
    ),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result,
      'canonical_v2_termination_rights_review_prompts',
    ),
    false,
  );
  assert.equal(loggerCalls.length, 1);
});

test('failure while resolving a registered source is also visible as FAILED', async () => {
  const sources = {};
  Object.defineProperty(sources, DEAL_ID, {
    enumerable: true,
    get() { throw new Error('source registry lookup failed'); },
  });

  const result = await attachCanonicalTerminationRightsReview(
    { dealId: DEAL_ID, cards: [] },
    { env: previewServingEnv(), sources, logger: { error() {} } },
  );

  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].state,
    TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
  );
  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].failure.error_message,
    'source registry lookup failed',
  );
});

test('an invalid registered source is FAILED rather than mistaken for an unregistered deal', async () => {
  const reviewDeal = Object.freeze({ dealId: DEAL_ID, cardCount: 0, cards: [] });

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, {
    env: previewServingEnv(),
    sources: { [DEAL_ID]: null },
    logger: { error() {} },
  });

  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].state,
    TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
  );
  assert.match(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].failure.error_message,
    /registered source/i,
  );
});

test('a source cannot substitute or derive a different application deal ID', async () => {
  const result = await attachCanonicalTerminationRightsReview({ dealId: DEAL_ID, cards: [] }, {
    env: previewServingEnv(),
    sources: {
      [DEAL_ID]: () => ({
        application_deal_id: '00000000-0000-4000-8000-000000000002',
        analysis: {},
        projection: {},
        agreement_indexes: [{}],
        view_policy: {},
        resolve_binding() {},
      }),
    },
    logger: { error() {} },
  });

  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].state,
    TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
  );
  assert.match(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].failure.error_message,
    /source bundle is invalid/i,
  );
});

test('FAILED removes stale transient review fields so the UI cannot render partial data', async () => {
  const reviewDeal = Object.freeze({
    dealId: DEAL_ID,
    cardCount: 0,
    cards: [],
    canonical_v2_termination_rights_review_rows: { rows: [{ stale: true }] },
    canonical_v2_termination_rights_review_prompts: { prompts: [{ stale: true }] },
  });

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, {
    env: previewServingEnv(),
    sources: { [DEAL_ID]: async () => { throw new Error('failed'); } },
    logger: { error() {} },
  });

  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'canonical_v2_termination_rights_review_rows'),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'canonical_v2_termination_rights_review_prompts'),
    false,
  );
  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].state,
    TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
  );
});

test('the displayed Agreement Index must be the exact record resolved by the validated Analysis binding', async () => {
  let assembled = false;
  const agreementIndex = {
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: 'agreement-index:1',
  };
  const analysis = {
    schema_version: 'AGREEMENT_ANALYSIS/V2',
    source_closures: [{
      agreement_index_binding: {
        record_id_field: 'agreement_index_id',
        record_id: agreementIndex.agreement_index_id,
      },
    }],
  };
  const attach = createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis() { return { status: 'PASS' }; },
    validateProjection() { return { status: 'PASS' }; },
    assemble() {
      assembled = true;
      return {
        canonical_v2_termination_rights_review_rows: {
          schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
          rows: [],
        },
      };
    },
  });

  const result = await attach({ dealId: DEAL_ID, cards: [] }, {
    sources: {
      [DEAL_ID]: () => ({
        application_deal_id: DEAL_ID,
        analysis,
        projection: { schema_version: 'AGREEMENT_PROJECTION/V2' },
        agreement_indexes: [agreementIndex],
        view_policy: { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' },
        resolve_binding: () => Buffer.from('{"different":"record"}\n', 'utf8'),
      }),
    },
    reviewState: { [DEAL_ID]: { open_review_keys: [], prompts: [], fact_groups: [] } },
    logger: { error() {} },
  });

  assert.equal(assembled, false);
  assert.equal(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].state,
    TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
  );
  assert.match(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD].failure.error_message,
    /Agreement Index agreement-index:1 differs from its binding/i,
  );
});

test('a registered source attaches validated rows and transient prompts without governing them', async () => {
  const calls = [];
  const agreementIndexes = [{
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: 'agreement-index:1',
  }];
  const analysis = {
    schema_version: 'AGREEMENT_ANALYSIS/V2',
    source_closures: [{
      agreement_index_binding: {
        record_id_field: 'agreement_index_id',
        record_id: agreementIndexes[0].agreement_index_id,
      },
    }],
  };
  const projection = { schema_version: 'AGREEMENT_PROJECTION/V2' };
  const viewPolicy = { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' };
  const resolveBinding = () => Buffer.from(`${canonicalJson(agreementIndexes[0])}\n`, 'utf8');
  const attach = createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis({ analysis: candidate, resolveBinding: resolver }) {
      calls.push(['validate-analysis', candidate, resolver]);
      return { status: 'PASS' };
    },
    validateProjection({ analysis: candidateAnalysis, projection: candidateProjection, viewPolicy: policy }) {
      calls.push(['validate-projection', candidateAnalysis, candidateProjection, policy]);
      return { status: 'PASS' };
    },
    assemble(input) {
      calls.push(['assemble', input]);
      return Object.freeze({
        ...input.reviewDeal,
        canonical_v2_termination_rights_review_rows: Object.freeze({
          schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
          agreement_analysis_id: 'analysis-id',
          agreement_projection_id: 'projection-id',
          rows: [{ proposition_id: 'proposition:1' }],
          general_review_items: [],
        }),
      });
    },
  });
  const reviewDeal = Object.freeze({ dealId: DEAL_ID, cardCount: 0, cards: [] });
  const prompt = Object.freeze({
    review_key: 'FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE',
    question: 'Which notice rule governs this termination right?',
    analysis: 'The right and section-wide notice sentence are separate source units.',
    requested_input: 'Confirm whether the notice sentence applies to this right.',
  });
  const factGroups = Object.freeze([Object.freeze({
    group_key: 'OUTSIDE_DATE_SCHEDULE',
    profile_key: 'PROFILE:TERMINATION:OUTSIDE_DATE_RIGHT',
    label: 'Outside date schedule',
    member_field_keys: Object.freeze([
      'OUTSIDE_DATE',
      'OUTSIDE_DATE_TERM',
      'EXTENSION_MECHANISM_REFERENCE',
    ]),
  })]);

  const result = await attach(reviewDeal, {
    sources: {
      [DEAL_ID]: async (dealId) => {
        assert.equal(dealId, DEAL_ID);
        return {
          application_deal_id: DEAL_ID,
          analysis,
          projection,
          agreement_indexes: agreementIndexes,
          view_policy: viewPolicy,
          resolve_binding: resolveBinding,
        };
      },
    },
    reviewState: {
      [DEAL_ID]: {
        open_review_keys: [prompt.review_key],
        prompts: [prompt],
        fact_groups: factGroups,
      },
    },
    logger: { error() { assert.fail('successful source must not log an error'); } },
  });

  assert.deepEqual(calls.slice(0, 2), [
    ['validate-analysis', analysis, resolveBinding],
    ['validate-projection', analysis, projection, viewPolicy],
  ]);
  assert.deepEqual(calls[2], ['assemble', {
    reviewDeal,
    analysis,
    projection,
    agreement_indexes: agreementIndexes,
    review_state: { open_review_keys: [prompt.review_key], fact_groups: factGroups },
  }]);
  assert.deepEqual(result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD], {
    schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
    prompts: [prompt],
  });
  assert.deepEqual(
    result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD],
    {
      schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
      state: TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.ATTACHED,
      review_row_count: 1,
      prompt_count: 1,
      failure: null,
    },
  );
  assert.equal(Object.prototype.hasOwnProperty.call(reviewDeal, CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD), false);
  assert.equal(Object.isFrozen(result), true);
});

test('the wire keeps the transient prompt and source status beside the review rows', () => {
  const prompts = {
    schema_version: 'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1',
    prompts: [{
      review_key: 'FIDUCIARY_NOTICE_RIGHT::EXERCISE_MODE',
      question: 'Question',
      analysis: 'Analysis',
      requested_input: 'Requested input',
    }],
  };
  const status = {
    schema_version: 'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1',
    state: 'ATTACHED',
    review_row_count: 1,
    prompt_count: 1,
    failure: null,
  };

  const result = trimReviewDealForWire({
    dealId: DEAL_ID,
    cardCount: 0,
    cards: [],
    canonical_v2_termination_rights_review_rows: { rows: [] },
    [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD]: prompts,
    [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD]: status,
  });

  assert.equal(result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD], prompts);
  assert.equal(result[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD], status);
});
