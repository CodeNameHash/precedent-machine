'use strict';

// Behavioural proof of the quarantine gate added 2026-09-04 (Ben's
// instruction, product code, outside the M7 repair authority --
// docs/core/OPERATING-RULES.md's authority boundary; see docs/core/
// GRAVEYARD.md entry 17 for the full account).
//
// The claim under test: no request path may serve V2 termination-rights
// review output compiled from the synthetic Red Hat fixture
// (__fixtures__/canonical-v2/red-hat-termination-rights-serving.generated.js,
// a 49-byte canonical text) as though it were a real agreement analysis.
// Proved two ways below, both on behaviour, never on source text:
//   1. the REAL checked-in synthetic fixture, run through the REAL
//      generator, is refused -- both by the gate function directly and by
//      the actual production entrypoint cards.js calls;
//   2. a stub input shaped like an admitted real-agreement analysis is
//      served.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  attachCanonicalTerminationRightsReview,
  isAdmittedRealAgreementAnalysis,
  RED_HAT_DEAL_ID,
  SEALED_M7_V2_REPAIR_WORK3_AGREEMENT_IDS,
  STOPPED_M7_V2_CANDIDATE_REGISTRATION_ID,
  SyntheticV2AnalysisRefusedError,
} = require('../lib/canonical-v2/termination-rights-review-serving-source');
const { generateAnalysisV2 } = require('../lib/canonical-v2/m7-v2-deterministic-generator');
const {
  GENERATOR_INPUT: RED_HAT_GENERATOR_INPUT,
} = require('../__fixtures__/canonical-v2/red-hat-termination-rights-serving.generated.js');

const [SEALED_AGREEMENT_ID] = [...SEALED_M7_V2_REPAIR_WORK3_AGREEMENT_IDS];

function previewServingEnv() {
  return {
    CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING: 'ENABLED_LOCAL_PREPRODUCTION',
    NODE_ENV: 'development',
  };
}

test('the sealed set actually admits the agreement_id the synthetic fixture claims', () => {
  // Establishes the check is not vacuous: the fixture's agreement_id really
  // is a member of the sealed corpus, so agreement_id membership ALONE
  // cannot be what refuses it below -- it is specifically the governance
  // check that must do the work.
  assert.equal(
    SEALED_M7_V2_REPAIR_WORK3_AGREEMENT_IDS.has(RED_HAT_GENERATOR_INPUT.baseAnalysis.agreement_id),
    true,
  );
});

test('the real synthetic fixture, compiled by the real generator, is not admitted real', () => {
  const syntheticAnalysis = generateAnalysisV2(RED_HAT_GENERATOR_INPUT);

  assert.equal(isAdmittedRealAgreementAnalysis(syntheticAnalysis), false);
  // Not refused merely because its governance equals the one named-stopped
  // id: the fixture's own governance is a third, unregistered id. Proves
  // the gate is not a narrow denylist-of-one that this exact fixture slips
  // past.
  assert.notEqual(
    syntheticAnalysis.governance.candidate_registration_id,
    STOPPED_M7_V2_CANDIDATE_REGISTRATION_ID,
  );
});

test('a stub input shaped like an admitted real-agreement analysis is treated as served', () => {
  const stubRealAnalysis = {
    agreement_id: SEALED_AGREEMENT_ID,
    governance: { candidate_registration_id: 'stub-admitted-registration-id' },
  };

  // Not admitted under the real, current (empty) allowlist -- nothing is,
  // today, by design (see the module header comment: Work 5 has not yet
  // produced a registration that compiles real agreement text).
  assert.equal(isAdmittedRealAgreementAnalysis(stubRealAnalysis), false);

  // Admitted once its registration is actually on the allowlist -- this is
  // the "served" half of the proof: the gate is not unconditionally closed,
  // it opens for exactly the shape it is meant to open for.
  assert.equal(
    isAdmittedRealAgreementAnalysis(stubRealAnalysis, {
      admittedRegistrationIds: new Set(['stub-admitted-registration-id']),
    }),
    true,
  );
});

test('the stopped candidate registration is refused even once its id is otherwise allowlisted', () => {
  const stubOnStoppedRegistration = {
    agreement_id: SEALED_AGREEMENT_ID,
    governance: { candidate_registration_id: STOPPED_M7_V2_CANDIDATE_REGISTRATION_ID },
  };

  assert.equal(
    isAdmittedRealAgreementAnalysis(stubOnStoppedRegistration, {
      admittedRegistrationIds: new Set([STOPPED_M7_V2_CANDIDATE_REGISTRATION_ID]),
    }),
    false,
  );
});

test('an analysis for an agreement outside the sealed corpus is refused regardless of governance', () => {
  const stubOutsideCorpus = {
    agreement_id: 'not-a-member-of-the-sealed-work3-corpus',
    governance: { candidate_registration_id: 'stub-admitted-registration-id' },
  };

  assert.equal(
    isAdmittedRealAgreementAnalysis(stubOutsideCorpus, {
      admittedRegistrationIds: new Set(['stub-admitted-registration-id']),
    }),
    false,
  );
});

test('invoking the real serving function with the synthetic fixture input is refused, not served', async () => {
  // This is the exact call pages/api/review/[id]/cards.js makes
  // (attachCanonicalTerminationRightsReview(servedReviewDeal, { env:
  // process.env })), against the real, default, unmodified registry --
  // i.e. the actual synthetic-fixture serving path delivery 13 identified,
  // invoked end to end rather than mocked.
  await assert.rejects(
    () => attachCanonicalTerminationRightsReview(
      { dealId: RED_HAT_DEAL_ID, cards: [] },
      { env: previewServingEnv() },
    ),
    (error) => {
      assert.ok(error instanceof SyntheticV2AnalysisRefusedError);
      assert.equal(error.code, 'CANONICAL_V2_SYNTHETIC_ANALYSIS_REFUSED');
      assert.equal(error.dealId, RED_HAT_DEAL_ID);
      return true;
    },
  );
});

// The two tests below exercise createCanonicalTerminationRightsReviewAttacher
// directly, with injected validate/assemble functions -- the same pattern
// tests/canonical-v2-termination-rights-review-serving-source.test.js and
// tests/canonical-v2-termination-rights-preview-registration.test.js already
// use for the attacher's other invariants -- rather than the real
// validateAnalysisV2/validateProjectionV2, which additionally require a
// fully governed AGREEMENT_ANALYSIS/V2 shape unrelated to this gate. The
// quarantine check under test sits inside the SAME shared attacher factory
// either way (between validateAnalysis and validateAgreementIndexBindings
// in lib/canonical-v2/termination-rights-review-serving-source.js), so this
// proves the actual gate, independent of which contract validator a caller
// wires in -- and the previous two tests already proved it against the
// real, unmocked validator and the real fixture.
function stubAttacher() {
  const { createCanonicalTerminationRightsReviewAttacher } = require(
    '../lib/canonical-v2/termination-rights-review-serving-source',
  );
  return createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis() { return { status: 'PASS' }; },
    validateProjection() { return { status: 'PASS' }; },
    assemble({ reviewDeal }) {
      return {
        ...reviewDeal,
        canonical_v2_termination_rights_review_rows: {
          schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
          rows: [],
        },
      };
    },
  });
}

function stubRealShapedSource(dealId) {
  return async () => ({
    application_deal_id: dealId,
    analysis: {
      schema_version: 'AGREEMENT_ANALYSIS/V2',
      agreement_id: SEALED_AGREEMENT_ID,
      governance: { candidate_registration_id: 'stub-admitted-registration-id' },
      source_closures: [{
        agreement_index_binding: {
          record_id_field: 'agreement_index_id',
          record_id: 'agreement-index:stub',
        },
      }],
    },
    projection: { schema_version: 'AGREEMENT_PROJECTION/V2' },
    agreement_indexes: [{
      schema_version: 'AGREEMENT_INDEX/V1',
      agreement_index_id: 'agreement-index:stub',
    }],
    view_policy: { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' },
    resolve_binding: () => Buffer.from(
      `${require('../lib/canonical-v2/canonical-bytes').canonicalJson({
        schema_version: 'AGREEMENT_INDEX/V1',
        agreement_index_id: 'agreement-index:stub',
      })}\n`,
      'utf8',
    ),
  });
}

test('a stub real-analysis source is served once its registration is admitted', async () => {
  const attach = stubAttacher();
  const dealId = 'stub-real-deal-00000000-0000-0000-0000-000000000001';

  const result = await attach({ dealId, cards: [] }, {
    sources: { [dealId]: stubRealShapedSource(dealId) },
    reviewState: { [dealId]: { open_review_keys: [], prompts: [], fact_groups: [] } },
    admittedRegistrationIds: new Set(['stub-admitted-registration-id']),
    logger: { error() { assert.fail('a served admitted analysis must not log an error'); } },
  });

  assert.equal(
    result.canonical_v2_termination_rights_review_source_status.state,
    'ATTACHED',
  );
  assert.equal(
    result.canonical_v2_termination_rights_review_rows.schema_version,
    'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
  );
});

test('the same stub real-analysis source is refused without the admittedRegistrationIds override', async () => {
  // Same stub, same registered source -- only the allowlist override is
  // removed, falling back to the real, empty, production default. Isolates
  // that the previous test's success came from the override, not from some
  // other difference in the stub shape.
  const attach = stubAttacher();
  const dealId = 'stub-real-deal-00000000-0000-0000-0000-000000000002';

  // A refused synthetic/non-admitted source is a hard rejection (see the
  // gate's own comment in termination-rights-review-serving-source.js), not
  // a resolved FAILED status the way every other source error is -- that
  // distinction is what lets pages/api/review/[id]/cards.js turn this one
  // into a 410 instead of a 200.
  await assert.rejects(
    () => attach({ dealId, cards: [] }, {
      sources: { [dealId]: stubRealShapedSource(dealId) },
      reviewState: { [dealId]: { open_review_keys: [], prompts: [], fact_groups: [] } },
      logger: { error() { assert.fail('a refused source must not be logged as a generic failure'); } },
    }),
    (error) => error instanceof SyntheticV2AnalysisRefusedError && error.dealId === dealId,
  );
});

// The two cases below close the exact loophole an earlier version of this
// gate had: it only ran isAdmittedRealAgreementAnalysis when the analysis
// declared an agreement_id, so a synthetic source only had to omit the
// field to be served unrefused. The gate is unconditional now (see
// createCanonicalTerminationRightsReviewAttacher()'s comment).
//
// Both cases below go through createCanonicalTerminationRightsReviewAttacher
// with mocked validateAnalysis/validateProjection -- the "API route handler
// path" in the sense that matters here: this factory is the exact shared
// function both attachCanonicalTerminationRightsReview (cards.js's real
// entrypoint, exercised with the real, unmocked validators earlier in this
// file) AND every test in this suite ultimately call, and the quarantine
// gate under test lives inside it, identically regardless of which
// validators are wired in. It is NOT feasible to exercise "no agreement_id"
// through the real, unmocked validateAnalysisV2 specifically: that
// validator's own M7_V2_SCHEMA independently requires agreement_id as a
// mandatory non-empty string (lib/canonical-v2/m7-v2-contract.js,
// exactKeys(analysis, [...]) then string(analysis.agreement_id, ...)) and
// would refuse a schema-shaped-but-agreement_id-less analysis one layer
// earlier, for an unrelated reason, before this gate ever ran -- which is
// itself a second, independent reason the omitted-field loophole can never
// reach a real, schema-valid production analysis, only a source that skips
// real validation entirely (exactly what a synthetic/mocked source is).
function noAgreementIdAttacher() {
  const { createCanonicalTerminationRightsReviewAttacher } = require(
    '../lib/canonical-v2/termination-rights-review-serving-source',
  );
  return createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis() { return { status: 'PASS' }; },
    validateProjection() { return { status: 'PASS' }; },
    assemble({ reviewDeal }) {
      return {
        ...reviewDeal,
        canonical_v2_termination_rights_review_rows: {
          schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
          rows: [],
        },
      };
    },
  });
}

function noAgreementIdSource(dealId, overrides = {}) {
  return async () => ({
    application_deal_id: dealId,
    analysis: {
      schema_version: 'AGREEMENT_ANALYSIS/V2',
      // No agreement_id, no governance -- the omitted-field loophole.
      source_closures: [{
        agreement_index_binding: {
          record_id_field: 'agreement_index_id',
          record_id: 'agreement-index:no-agreement-id',
        },
      }],
      ...overrides,
    },
    projection: { schema_version: 'AGREEMENT_PROJECTION/V2' },
    agreement_indexes: [{
      schema_version: 'AGREEMENT_INDEX/V1',
      agreement_index_id: 'agreement-index:no-agreement-id',
    }],
    view_policy: { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' },
    resolve_binding: () => Buffer.from(
      `${require('../lib/canonical-v2/canonical-bytes').canonicalJson({
        schema_version: 'AGREEMENT_INDEX/V1',
        agreement_index_id: 'agreement-index:no-agreement-id',
      })}\n`,
      'utf8',
    ),
  });
}

test('an analysis with no agreement_id at all is refused, not served -- the omitted-field loophole is closed', async () => {
  const attach = noAgreementIdAttacher();
  const dealId = 'stub-no-agreement-id-deal-00000000-0000-0000-000000000005';

  await assert.rejects(
    () => attach({ dealId, cards: [] }, {
      sources: { [dealId]: noAgreementIdSource(dealId) },
      reviewState: { [dealId]: { open_review_keys: [], prompts: [], fact_groups: [] } },
      logger: { error() { assert.fail('a refused source must not be logged as a generic failure'); } },
    }),
    (error) => {
      // Exactly the shape pages/api/review/[id]/cards.js's catch block
      // checks (instanceof, then error.message in the 410 body) to turn
      // this into an HTTP 410 rather than its generic 500 -- see that
      // file's catch block and the "the cards route turns the Red Hat
      // preview refusal into an HTTP 410" test in
      // tests/canonical-v2-termination-rights-preview-registration.test.js,
      // which proves the same error shape reaches cards.js's catch through
      // the real, unmocked entrypoint for the fixture's declared-but-
      // unsealed-governance case. This test proves the declared-agreement_id
      // precondition itself has no bypass.
      assert.ok(error instanceof SyntheticV2AnalysisRefusedError);
      assert.equal(error.code, 'CANONICAL_V2_SYNTHETIC_ANALYSIS_REFUSED');
      assert.equal(error.dealId, dealId);
      // agreementId is undefined, not a string -- the error message says
      // "unset" rather than the literal word "undefined" (see the message
      // template in SyntheticV2AnalysisRefusedError).
      assert.equal(error.agreementId, undefined);
      assert.match(error.message, /agreement_id unset/);
      return true;
    },
  );
});

test('the same source is served only once both stub sets explicitly admit its agreement_id and governance', async () => {
  // "The same source" as the refused case above: same builder, same
  // missing-field starting point -- but this variant fills in exactly the
  // two fields the gate requires (agreement_id,
  // governance.candidate_registration_id) and admits both, one field at a
  // time, via the two independently injectable overrides. Neither override
  // alone is sufficient; both stub sets together are what serves it,
  // proving sealedAgreementIds and admittedRegistrationIds are each
  // load-bearing, not just one of them.
  const attach = noAgreementIdAttacher();
  const dealId = 'stub-no-agreement-id-deal-00000000-0000-0000-000000000006';
  const STUB_AGREEMENT_ID = 'stub-admitted-agreement-id';
  const STUB_REGISTRATION_ID = 'stub-admitted-registration-id';
  const admittedSource = noAgreementIdSource(dealId, {
    agreement_id: STUB_AGREEMENT_ID,
    governance: { candidate_registration_id: STUB_REGISTRATION_ID },
  });
  const reviewState = { [dealId]: { open_review_keys: [], prompts: [], fact_groups: [] } };

  // Neither override alone is sufficient.
  await assert.rejects(
    () => attach({ dealId, cards: [] }, {
      sources: { [dealId]: admittedSource },
      reviewState,
      sealedAgreementIds: new Set([STUB_AGREEMENT_ID]),
      // admittedRegistrationIds left at the real, empty production default.
      logger: { error() {} },
    }),
    (error) => error instanceof SyntheticV2AnalysisRefusedError,
  );
  await assert.rejects(
    () => attach({ dealId, cards: [] }, {
      sources: { [dealId]: admittedSource },
      reviewState,
      admittedRegistrationIds: new Set([STUB_REGISTRATION_ID]),
      // sealedAgreementIds left at the real production default, which does
      // not contain this stub id.
      logger: { error() {} },
    }),
    (error) => error instanceof SyntheticV2AnalysisRefusedError,
  );

  // Both together serve it.
  const result = await attach({ dealId, cards: [] }, {
    sources: { [dealId]: admittedSource },
    reviewState,
    sealedAgreementIds: new Set([STUB_AGREEMENT_ID]),
    admittedRegistrationIds: new Set([STUB_REGISTRATION_ID]),
    logger: { error() { assert.fail('a served admitted analysis must not log an error'); } },
  });

  assert.equal(
    result.canonical_v2_termination_rights_review_source_status.state,
    'ATTACHED',
  );
});
