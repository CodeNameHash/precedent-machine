'use strict';

// Registration contract for Termination Rights preview serving.
// Documents what lib/canonical-v2/termination-rights-review-serving-source.js
// must guarantee once IBM/Red Hat is registered. Does not require the gate
// or builder to exist yet — uses injectable sources like the serving-source suite.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  attachCanonicalTerminationRightsReview,
  CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES,
  CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE,
  CONCHO_DEAL_ID,
  METSERA_DEAL_ID,
  METSERA_OUTSIDE_DATE_PROFILE_KEY,
  PREVIEW_TERMINATION_DEAL_IDS,
  RED_HAT_BREACH_PROFILE_KEY,
  RED_HAT_DEAL_ID,
  RED_HAT_OUTSIDE_DATE_PROFILE_KEY,
  SKECHERS_DEAL_ID,
  SKECHERS_OUTSIDE_DATE_PROFILE_KEY,
  SKYWATER_DEAL_ID,
  createCanonicalTerminationRightsReviewAttacher,
  isCanonicalV2TerminationRightsReviewServingEnabled,
} = require('../lib/canonical-v2/termination-rights-review-serving-source');
const { isPermittedCanonicalV2Runtime } = require('../lib/canonical-v2/feature-flags');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

const PLANNED_SERVING_ENV_KEY = CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY;
const PLANNED_SERVING_ENABLED_VALUE = CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE;
const B9E_RULING_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/'
  + 'm7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json';
const HOME_DEAL_DIRECTORY = 'lib/generated/home-deal-directory-v1.json';

const B9E_DISPLAY_TEXT = 'contained in non-public disclosure letter';

function previewEnv() {
  return {
    [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE,
    NODE_ENV: 'development',
  };
}

function gateOffEnvs() {
  return [
    {},
    { [PLANNED_SERVING_ENV_KEY]: 'true' },
    { [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE, VERCEL_ENV: 'production' },
    { [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE, NODE_ENV: 'production' },
  ];
}

function stageBBlueprintFromRuling() {
  const ruling = JSON.parse(fs.readFileSync(B9E_RULING_PATH, 'utf8'));
  const profileKeySuffix = ruling.profile_key.split(':').pop();
  return {
    schema_version: 'M7_V2_TERMINATION_WORK3_STAGE_B_45_PROFILE_BLUEPRINT_PROPOSAL/V1',
    profile_approval_state: 'UNAPPROVED',
    proposed_profiles: [{
      proposed_profile_key: profileKeySuffix,
      governed_disclosure_notes: [{
        display_text: ruling.ruling_text,
        disposition_kind: 'NON_PUBLIC_DISCLOSURE_LOCATION',
        field_key: ruling.field_key,
        profile_key: ruling.profile_key,
      }],
    }],
  };
}

test('IBM / Red Hat is the production deal id bound to the B9e Termination ruling', () => {
  const directory = JSON.parse(fs.readFileSync(HOME_DEAL_DIRECTORY, 'utf8'));
  const deal = directory.deals.find((entry) => entry.id === RED_HAT_DEAL_ID);
  assert.ok(deal);
  assert.match(deal.deal_name, /Red Hat/i);

  const ruling = JSON.parse(fs.readFileSync(B9E_RULING_PATH, 'utf8'));
  assert.equal(ruling.family_key, 'TERMINATION');
  assert.equal(ruling.ruling_text, B9E_DISPLAY_TEXT);
  assert.equal(
    ruling.agreement_id,
    '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
  );
});

test('planned preview gate matches termination-fee fail-closed semantics', () => {
  for (const env of gateOffEnvs()) {
    const permitted = isPermittedCanonicalV2Runtime(env);
    const sentinel = env[PLANNED_SERVING_ENV_KEY] === PLANNED_SERVING_ENABLED_VALUE;
    const wouldServe = sentinel && permitted;
    assert.equal(wouldServe, false);
    assert.equal(isCanonicalV2TerminationRightsReviewServingEnabled(env), false);
  }
  const env = previewEnv();
  assert.equal(env[PLANNED_SERVING_ENV_KEY], PLANNED_SERVING_ENABLED_VALUE);
  assert.equal(isPermittedCanonicalV2Runtime(env), true);
  assert.equal(isCanonicalV2TerminationRightsReviewServingEnabled(env), true);
});

test('registration contract: only the registered Red Hat deal attaches V2 review rows', async () => {
  const agreementIndexes = [{
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: 'agreement-index:red-hat',
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
  const resolveBinding = () => Buffer.from(`${canonicalJson(agreementIndexes[0])}\n`, 'utf8');
  const attach = createCanonicalTerminationRightsReviewAttacher({
    validateAnalysis() { return { status: 'PASS' }; },
    validateProjection() { return { status: 'PASS' }; },
    assemble({ reviewDeal }) {
      return {
        ...reviewDeal,
        canonical_v2_termination_rights_review_rows: {
          schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
          agreement_analysis_id: 'analysis:red-hat',
          agreement_projection_id: 'projection:red-hat',
          rows: [{
            display_section_id: 'termination-rights',
            governed_ordinal: 0,
            subtype_key: 'LEGAL_RESTRAINT_RIGHT',
            profile_key: 'PROFILE:TERMINATION:LEGAL_RESTRAINT:b9e',
            review_required: false,
            issue_codes: [],
            source_span_ids: [],
            expression_tree: { children: [] },
          }],
          general_review_items: [],
        },
      };
    },
  });

  const otherDealId = '00000000-0000-4000-8000-000000000099';
  const sources = {
    [RED_HAT_DEAL_ID]: async (dealId) => ({
      application_deal_id: dealId,
      analysis,
      projection: { schema_version: 'AGREEMENT_PROJECTION/V2' },
      agreement_indexes: agreementIndexes,
      view_policy: { schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1' },
      resolve_binding: resolveBinding,
    }),
  };
  const reviewState = {
    [RED_HAT_DEAL_ID]: { open_review_keys: [], prompts: [], fact_groups: [] },
  };

  const unregistered = await attach({ dealId: otherDealId, cards: [] }, { sources, reviewState });
  assert.equal(unregistered, unregistered);
  assert.equal(
    Object.prototype.hasOwnProperty.call(unregistered, 'canonical_v2_termination_rights_review_rows'),
    false,
  );

  const registered = await attach(
    { dealId: RED_HAT_DEAL_ID, cards: [{ type: 'TERMR', provision_subtype: 'TERMR-OUTSIDE' }] },
    { sources, reviewState, stageBBlueprints: { [RED_HAT_DEAL_ID]: stageBBlueprintFromRuling() } },
  );
  assert.equal(
    registered.canonical_v2_termination_rights_review_rows.schema_version,
    'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
  );
  assert.equal(
    registered.canonical_v2_termination_rights_review_source_status.state,
    'ATTACHED',
  );
});

test('registration contract: V2 attachment suppresses legacy TERMR family groups', () => {
  const configSource = fs.readFileSync(path.join(
    __dirname,
    '..',
    'components',
    'review',
    'table-configs',
    'termination-rights.config.js',
  ), 'utf8');
  assert.match(configSource, /function hasCanonicalV2ReviewRows/);
  assert.match(
    configSource,
    /if \(!hasCanonicalV2ReviewRows\(reviewDeal\)\) \{\s*groups\.push\(\.\.\.visibleFamilyGroups/,
  );
});

test('serving-source registry registers five env-gated preview deals', () => {
  const expectedDealIds = [
    RED_HAT_DEAL_ID,
    METSERA_DEAL_ID,
    SKECHERS_DEAL_ID,
    SKYWATER_DEAL_ID,
    CONCHO_DEAL_ID,
  ];
  assert.deepEqual(PREVIEW_TERMINATION_DEAL_IDS, expectedDealIds);
  for (const dealId of expectedDealIds) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES, dealId),
      true,
    );
    assert.equal(
      typeof CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES[dealId],
      'function',
    );
    assert.deepEqual(CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE[dealId], {
      open_review_keys: [],
      prompts: [],
      fact_groups: [],
    });
  }
});

test('the real export is an exact no-op when the preview serving gate is off', async () => {
  const reviewDeal = Object.freeze({ dealId: RED_HAT_DEAL_ID, cards: [] });

  const result = await attachCanonicalTerminationRightsReview(reviewDeal, { env: {} });

  assert.equal(result, reviewDeal);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'canonical_v2_termination_rights_review_rows'),
    false,
  );
});

test('Red Hat preview rows render through the V2 review group builder', async () => {
  const { buildTerminationRightsReviewGroups } = await import(
    '../components/review/table-configs/termination-rights-review-groups.js'
  );
  const env = {
    [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE,
    VERCEL_ENV: 'preview',
  };
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: RED_HAT_DEAL_ID, cards: [] },
    { env },
  );
  const groups = buildTerminationRightsReviewGroups(attached);
  const propositionGroup = groups.find(
    (group) => group?.id === 'canonical-v2-termination-right-propositions',
  );
  assert.ok(propositionGroup);
  assert.equal(propositionGroup.rows.length, 1);
  assert.equal(propositionGroup.rows[0].label, 'Legal restraint right');
});

test('Metsera preview rows render through the V2 review group builder', async () => {
  const { buildTerminationRightsReviewGroups } = await import(
    '../components/review/table-configs/termination-rights-review-groups.js'
  );
  const env = {
    [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE,
    VERCEL_ENV: 'preview',
  };
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: METSERA_DEAL_ID, cards: [] },
    { env },
  );
  const groups = buildTerminationRightsReviewGroups(attached);
  const propositionGroup = groups.find(
    (group) => group?.id === 'canonical-v2-termination-right-propositions',
  );
  assert.ok(propositionGroup);
  assert.equal(propositionGroup.rows.length, 1);
  assert.equal(propositionGroup.rows[0].label, 'Outside date right');
  assert.equal(
    attached.canonical_v2_termination_rights_review_rows.rows[0].profile_key,
    METSERA_OUTSIDE_DATE_PROFILE_KEY,
  );
});

test('Skechers preview bridge renders the approved outside-date partial profile', async () => {
  const { buildTerminationRightsReviewGroups } = await import(
    '../components/review/table-configs/termination-rights-review-groups.js'
  );
  const env = previewEnv();
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: SKECHERS_DEAL_ID, cards: [] },
    { env },
  );
  const groups = buildTerminationRightsReviewGroups(attached);
  const propositionGroup = groups.find(
    (group) => group?.id === 'canonical-v2-termination-right-propositions',
  );
  assert.ok(propositionGroup);
  assert.equal(propositionGroup.rows[0].label, 'Outside date right');
  assert.equal(
    attached.canonical_v2_termination_rights_review_rows.rows[0].profile_key,
    SKECHERS_OUTSIDE_DATE_PROFILE_KEY,
  );
});

test('SkyWater preview bridge renders the Red Hat outside-date partial profile', async () => {
  const { buildTerminationRightsReviewGroups } = await import(
    '../components/review/table-configs/termination-rights-review-groups.js'
  );
  const env = previewEnv();
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: SKYWATER_DEAL_ID, cards: [] },
    { env },
  );
  const groups = buildTerminationRightsReviewGroups(attached);
  const propositionGroup = groups.find(
    (group) => group?.id === 'canonical-v2-termination-right-propositions',
  );
  assert.ok(propositionGroup);
  assert.equal(propositionGroup.rows[0].label, 'Outside date right');
  assert.equal(
    attached.canonical_v2_termination_rights_review_rows.rows[0].profile_key,
    RED_HAT_OUTSIDE_DATE_PROFILE_KEY,
  );
});

test('Concho preview bridge renders the Red Hat breach profile', async () => {
  const { buildTerminationRightsReviewGroups } = await import(
    '../components/review/table-configs/termination-rights-review-groups.js'
  );
  const env = previewEnv();
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: CONCHO_DEAL_ID, cards: [] },
    { env },
  );
  const groups = buildTerminationRightsReviewGroups(attached);
  const propositionGroup = groups.find(
    (group) => group?.id === 'canonical-v2-termination-right-propositions',
  );
  assert.ok(propositionGroup);
  assert.equal(propositionGroup.rows[0].label, 'Breach right');
  assert.equal(
    attached.canonical_v2_termination_rights_review_rows.rows[0].profile_key,
    RED_HAT_BREACH_PROFILE_KEY,
  );
});

test('Red Hat preview rows appear in the Termination Rights section selectRows', async () => {
  const { terminationRightsConfig } = await import(
    '../components/review/table-configs/termination-rights.config.js'
  );
  const env = {
    [PLANNED_SERVING_ENV_KEY]: PLANNED_SERVING_ENABLED_VALUE,
    VERCEL_ENV: 'preview',
  };
  const attached = await attachCanonicalTerminationRightsReview(
    { dealId: RED_HAT_DEAL_ID, cards: [] },
    { env },
  );
  const rows = terminationRightsConfig.selectRows(attached);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].groups.some(
    (group) => group.id === 'canonical-v2-termination-right-propositions',
  ));
});

test('cards route still calls attachCanonicalTerminationRightsReview after termination fee', () => {
  const route = fs.readFileSync('pages/api/review/[id]/cards.js', 'utf8');
  const feeAt = route.indexOf('attachCanonicalTerminationFeeServing(previewedReviewDeal');
  const rightsAt = route.indexOf('attachCanonicalTerminationRightsReview(servedReviewDeal');
  assert.ok(feeAt > 0 && rightsAt > feeAt);
  assert.match(route, /attachCanonicalTerminationRightsReview\([\s\S]*env:\s*process\.env/);
});
