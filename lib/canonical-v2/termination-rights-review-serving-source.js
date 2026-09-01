'use strict';

// Per-family serving switch, Termination Rights review: the SERVER side.
//
// Mirrors lib/canonical-v2/termination-fee-serving-source.js — env gate,
// per-deal registry, fail-closed wrapper. Preview/local only; no DB writes.

const { isPermittedCanonicalV2Runtime } = require('./feature-flags');
const {
  validateAnalysisV2,
  validateProjectionV2,
} = require('./m7-v2-contract');
const { generateAnalysisV2 } = require('./m7-v2-deterministic-generator');
const { projectAgreement } = require('./agreement-projection');
const {
  assembleTerminationRightsReviewV2,
} = require('./termination-rights-review-attachment');
const { attachStageBGovernedDisclosureNotes } = require('./termination-rights-review-stage-b-notes');
const { canonicalJson } = require('./canonical-bytes');
const {
  AGREEMENT_ID: RED_HAT_AGREEMENT_ID,
  GENERATOR_INPUT: RED_HAT_GENERATOR_INPUT,
  VIEW_POLICY: RED_HAT_VIEW_POLICY,
  AGREEMENT_INDEX: RED_HAT_AGREEMENT_INDEX,
  FILES_BY_PATH_B64: RED_HAT_FILES_BY_PATH_B64,
  PAYLOAD_SHA256: RED_HAT_SERVING_PAYLOAD_SHA256,
} = require('../../__fixtures__/canonical-v2/red-hat-termination-rights-serving.generated.js');

const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY =
  'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING';
const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE =
  'ENABLED_LOCAL_PREPRODUCTION';

const RED_HAT_DEAL_ID = '2b9a6571-6fe7-4aac-931d-a96ab227ea43';
const METSERA_DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';
const SKECHERS_DEAL_ID = 'af4940e1-a645-437c-acfa-4a53e8d9f7ac';
// Preview bridge slots: profile provenance differs from the home-directory deal name.
const SKYWATER_DEAL_ID = '13894e33-b5b6-4412-96bb-940b841d5130';
const CONCHO_DEAL_ID = 'a267309a-fc22-4160-a652-1144fc64e9cf';

const B9E_PROFILE_KEY =
  'PROFILE:TERMINATION:LEGAL_RESTRAINT:b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712';
const B9E_PROPOSED_PROFILE_KEY =
  'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712';
const B9E_GOVERNED_DISCLOSURE_DISPLAY_TEXT =
  'contained in non-public disclosure letter';
const METSERA_OUTSIDE_DATE_PROFILE_KEY =
  'PROFILE:TERMINATION:OUTSIDE_DATE:261c8790a3247cc495222c2c63e3c82bf09bbcabeae4caa4cb4ff99031a5a6a6';
const METSERA_OUTSIDE_DATE_PROPOSED_PROFILE_KEY =
  '261c8790a3247cc495222c2c63e3c82bf09bbcabeae4caa4cb4ff99031a5a6a6';
const SKECHERS_OUTSIDE_DATE_PROFILE_KEY =
  'PROFILE:TERMINATION:OUTSIDE_DATE:4ea33624832698aaae46dae9e7328de732f0b6a6f7c0206888edacd4c064b20d';
const SKECHERS_OUTSIDE_DATE_PROPOSED_PROFILE_KEY =
  '4ea33624832698aaae46dae9e7328de732f0b6a6f7c0206888edacd4c064b20d';
const RED_HAT_OUTSIDE_DATE_PROFILE_KEY =
  'PROFILE:TERMINATION:OUTSIDE_DATE:e30648500c6a76071927c51739c941a31f0d141c1fbf35f105a015e9dc9e148c';
const RED_HAT_OUTSIDE_DATE_PROPOSED_PROFILE_KEY =
  'e30648500c6a76071927c51739c941a31f0d141c1fbf35f105a015e9dc9e148c';
const RED_HAT_BREACH_PROFILE_KEY =
  'PROFILE:TERMINATION:BREACH:0f240b2a5fad54776d6d7ca04ce3d235b754c6e3d289424b8457c9fce65b02f4';
const RED_HAT_BREACH_PROPOSED_PROFILE_KEY =
  '0f240b2a5fad54776d6d7ca04ce3d235b754c6e3d289424b8457c9fce65b02f4';

const PREVIEW_TERMINATION_RIGHT_SUBTYPE_PATH = Object.freeze([
  'TERMINATION',
  'TERMINATION_RIGHT',
  'LEGAL_RESTRAINT_RIGHT',
]);
const PREVIEW_OUTSIDE_DATE_RIGHT_SUBTYPE_PATH = Object.freeze([
  'TERMINATION',
  'TERMINATION_RIGHT',
  'OUTSIDE_DATE_RIGHT',
]);
const PREVIEW_BREACH_RIGHT_SUBTYPE_PATH = Object.freeze([
  'TERMINATION',
  'TERMINATION_RIGHT',
  'BREACH_RIGHT',
]);
const PREVIEW_TERMINATION_PATCH_BY_DEAL_ID = Object.freeze({
  [RED_HAT_DEAL_ID]: Object.freeze({
    subtype_path: PREVIEW_TERMINATION_RIGHT_SUBTYPE_PATH,
    profile_key: B9E_PROFILE_KEY,
  }),
  [METSERA_DEAL_ID]: Object.freeze({
    subtype_path: PREVIEW_OUTSIDE_DATE_RIGHT_SUBTYPE_PATH,
    profile_key: METSERA_OUTSIDE_DATE_PROFILE_KEY,
  }),
  [SKECHERS_DEAL_ID]: Object.freeze({
    subtype_path: PREVIEW_OUTSIDE_DATE_RIGHT_SUBTYPE_PATH,
    profile_key: SKECHERS_OUTSIDE_DATE_PROFILE_KEY,
  }),
  [SKYWATER_DEAL_ID]: Object.freeze({
    subtype_path: PREVIEW_OUTSIDE_DATE_RIGHT_SUBTYPE_PATH,
    profile_key: RED_HAT_OUTSIDE_DATE_PROFILE_KEY,
  }),
  [CONCHO_DEAL_ID]: Object.freeze({
    subtype_path: PREVIEW_BREACH_RIGHT_SUBTYPE_PATH,
    profile_key: RED_HAT_BREACH_PROFILE_KEY,
  }),
});
const PREVIEW_TERMINATION_DEAL_IDS = Object.freeze(Object.keys(
  PREVIEW_TERMINATION_PATCH_BY_DEAL_ID,
));

function ownEnvValue(env, key) {
  if (!env || typeof env !== 'object') return undefined;
  return Object.prototype.hasOwnProperty.call(env, key) ? env[key] : undefined;
}

function isCanonicalV2TerminationRightsReviewServingEnabled(env) {
  const resolvedEnv = arguments.length === 0 ? process.env : env;
  if (!resolvedEnv || typeof resolvedEnv !== 'object') return false;
  const value = ownEnvValue(resolvedEnv, CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY);
  if (value !== CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE) return false;
  return isPermittedCanonicalV2Runtime(resolvedEnv);
}

function outsideDateStageBBlueprint(proposedProfileKey, outsideDateExtensionLinks) {
  return Object.freeze({
    schema_version: 'M7_V2_TERMINATION_WORK3_STAGE_B_45_PROFILE_BLUEPRINT_PROPOSAL/V1',
    profile_approval_state: 'UNAPPROVED',
    proposed_profiles: Object.freeze([Object.freeze({
      proposed_profile_key: proposedProfileKey,
      outside_date_extension_links: outsideDateExtensionLinks,
    })]),
  });
}

function metseraOutsideDateStageBBlueprint() {
  return outsideDateStageBBlueprint(
    METSERA_OUTSIDE_DATE_PROPOSED_PROFILE_KEY,
    Object.freeze([Object.freeze({
      surface: 'OUTSIDE_DATE_EXTENSION',
      open_world_candidate_id:
        'fc9d0be66fea3333669e1288c63cb6e24abc369b1b25521ab6300042efa4f630',
      open_world_candidate_occurrence_id:
        'd2538b7ceb5cdb4c4d145e8ddda26dc6f0069134057ae6543cf45a0c931e53d1',
      extension_mode: 'AUTOMATIC',
      electing_party: null,
      open_world_evidence_path:
        'evidence/canonical-v2/metsera-termination-20260809-2xk-final/validation.json',
    })]),
  );
}

function skechersOutsideDateStageBBlueprint() {
  return outsideDateStageBBlueprint(
    SKECHERS_OUTSIDE_DATE_PROPOSED_PROFILE_KEY,
    Object.freeze([
      Object.freeze({
        surface: 'OUTSIDE_DATE_EXTENSION',
        open_world_candidate_id:
          'b8ad9ac6164eb90eacc8e9c1c841439a5133c9810c1c26bd6cc8605a2a92108b',
        open_world_candidate_occurrence_id:
          '8017e8523fb7f7e33d4d16918bce78f79b5b21692cc5b662ab823e7f855b8d36',
        extension_mode: 'AUTOMATIC',
        electing_party: null,
        open_world_evidence_path:
          'evidence/canonical-v2/skechers-termination-20260809-2xk-final/validation.json',
      }),
      Object.freeze({
        surface: 'OUTSIDE_DATE_EXTENSION',
        open_world_candidate_id:
          '8e3623acf7aa88a3a7972bff5a180b84f301f56d04264c69a7b6e5c151b2bd5d',
        open_world_candidate_occurrence_id:
          '2ed47e3863cb22566e2ab99d93c06dab10f06674e490d0a7fff92da6dba29e24',
        extension_mode: 'ELECTIVE',
        electing_party: 'Parent',
        open_world_evidence_path:
          'evidence/canonical-v2/skechers-termination-20260809-2xk-final/validation.json',
      }),
    ]),
  );
}

function redHatOutsideDateStageBBlueprint() {
  return outsideDateStageBBlueprint(
    RED_HAT_OUTSIDE_DATE_PROPOSED_PROFILE_KEY,
    Object.freeze([
      Object.freeze({
        surface: 'OUTSIDE_DATE_EXTENSION',
        open_world_candidate_id:
          '78e06ad5565908328afabea5bb32ae4726c6ea8c3ff3c3bab5569d15d4546e26',
        open_world_candidate_occurrence_id:
          'f277bf626ae014d41bfd15fe2c27dddb2c2b3a32a7ab942c11ac8aed07e75671',
        extension_mode: 'ELECTIVE',
        electing_party: 'either Parent or the Company',
        open_world_evidence_path:
          'evidence/canonical-v2/redhat-termination-20260809-2xk-final/validation.json',
      }),
      Object.freeze({
        surface: 'OUTSIDE_DATE_EXTENSION',
        open_world_candidate_id:
          'bd3bdf2b9b064843e1701fc4be98acf26cc759199d87dfc11f3da290ceb14580',
        open_world_candidate_occurrence_id:
          '3d6d2b62cc20520ff9b8ebdfffeeba5664b1004ee06b3ce68f306828f82bfb41',
        extension_mode: 'ELECTIVE',
        electing_party: 'either Parent or the Company',
        open_world_evidence_path:
          'evidence/canonical-v2/redhat-termination-20260809-2xk-final/validation.json',
      }),
    ]),
  );
}

function redHatB9eStageBBlueprint() {
  return Object.freeze({
    schema_version: 'M7_V2_TERMINATION_WORK3_STAGE_B_45_PROFILE_BLUEPRINT_PROPOSAL/V1',
    profile_approval_state: 'UNAPPROVED',
    proposed_profiles: Object.freeze([Object.freeze({
      proposed_profile_key: B9E_PROPOSED_PROFILE_KEY,
      governed_disclosure_notes: Object.freeze([Object.freeze({
        display_text: B9E_GOVERNED_DISCLOSURE_DISPLAY_TEXT,
        disposition_kind: 'NON_PUBLIC_DISCLOSURE_LOCATION',
        field_key: 'JURISDICTION_LIST_REFERENCE',
        profile_key: B9E_PROFILE_KEY,
      })]),
    })]),
  });
}

function createResolveBindingFromFiles(filesByPathB64) {
  return function resolveBinding(binding) {
    if (!binding || typeof binding.path !== 'string') {
      throw new TypeError('Canonical V2 Termination Rights binding path is invalid.');
    }
    const encoded = filesByPathB64[binding.path];
    if (typeof encoded !== 'string' || encoded.length === 0) {
      throw new TypeError(`Canonical V2 Termination Rights binding ${binding.path} is missing.`);
    }
    return Buffer.from(encoded, 'base64');
  };
}

function terminationAnalysisAlreadyHasRights(analysis) {
  return analysis.profile_snapshots.some(
    (profile) => profile.family_key === 'TERMINATION'
      && Array.isArray(profile.subtype_path)
      && profile.subtype_path.includes('TERMINATION_RIGHT'),
  );
}

// Governed-compiler preview input still matches the TERMINATION family-marker profile.
// Clone and relabel for review assembly only until Work3 termination claims produce
// TERMINATION_RIGHT profiles through generateAnalysisV2 without bridging.
function patchPreviewTerminationAnalysis(analysis, dealId) {
  const patch = PREVIEW_TERMINATION_PATCH_BY_DEAL_ID[dealId];
  if (!patch || terminationAnalysisAlreadyHasRights(analysis)) {
    return analysis;
  }
  const cloned = structuredClone(analysis);
  for (const rule of cloned.rules) {
    if (rule.family_key !== 'TERMINATION') continue;
    const profile = cloned.profile_snapshots.find(
      (entry) => entry.profile_id === rule.profile_id,
    );
    if (!profile) continue;
    profile.subtype_path = [...patch.subtype_path];
    profile.classification_path = [...patch.subtype_path];
    profile.profile_key = patch.profile_key;
    rule.subtype_path = [...patch.subtype_path];
  }
  return cloned;
}

function patchRedHatPreviewTerminationAnalysis(analysis, dealId) {
  return patchPreviewTerminationAnalysis(analysis, dealId);
}

function collectExpressionTreeFactIds(expression, factIds = []) {
  if (!expression || typeof expression !== 'object' || !Array.isArray(expression.children)) {
    return factIds;
  }
  for (const child of expression.children) {
    if (child?.kind === 'FACT') {
      const factId = child.node?.fact_id;
      if (typeof factId === 'string' && factId.length > 0 && !factIds.includes(factId)) {
        factIds.push(factId);
      }
    } else if (child?.kind === 'EXPRESSION') {
      collectExpressionTreeFactIds(child.node, factIds);
    }
  }
  return factIds;
}

// Governed-compiler preview rows can carry rule-level fact_ids that exceed the
// facts embedded in expression_tree. The V2 UI requires those sets to match.
function patchPreviewTerminationReviewRows(reviewDeal) {
  if (!PREVIEW_TERMINATION_PATCH_BY_DEAL_ID[reviewDeal?.dealId]) return reviewDeal;
  const attachment = reviewDeal[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_ROWS_FIELD];
  if (attachment?.schema_version !== 'TERMINATION_RIGHTS_REVIEW_ROWS/V2'
      || !Array.isArray(attachment.rows)) {
    return reviewDeal;
  }
  const rows = attachment.rows.map((row) => {
    const treeFactIds = collectExpressionTreeFactIds(row.expression_tree);
    if (treeFactIds.length === 0
        || (treeFactIds.length === row.fact_ids.length
          && treeFactIds.every((factId, index) => factId === row.fact_ids[index]))) {
      return row;
    }
    return {
      ...row,
      fact_ids: [...treeFactIds],
      ungrouped_fact_ids: [...treeFactIds],
      fact_groups: [],
    };
  });
  return {
    ...reviewDeal,
    [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_ROWS_FIELD]: {
      ...attachment,
      rows,
    },
  };
}

function patchRedHatPreviewTerminationReviewRows(reviewDeal) {
  return patchPreviewTerminationReviewRows(reviewDeal);
}

async function buildRedHatTerminationRightsReviewSource(dealId) {
  if (RED_HAT_GENERATOR_INPUT.baseAnalysis?.agreement_id !== RED_HAT_AGREEMENT_ID) {
    throw new Error('Red Hat Termination Rights serving fixture agreement id mismatch.');
  }
  const resolveBinding = createResolveBindingFromFiles(RED_HAT_FILES_BY_PATH_B64);
  const analysis = generateAnalysisV2(RED_HAT_GENERATOR_INPUT);
  validateAnalysisV2({ analysis, resolveBinding });
  const projection = projectAgreement(analysis, RED_HAT_VIEW_POLICY);
  return {
    application_deal_id: dealId,
    analysis,
    projection,
    agreement_indexes: [RED_HAT_AGREEMENT_INDEX],
    view_policy: RED_HAT_VIEW_POLICY,
    resolve_binding: resolveBinding,
  };
}

const PREVIEW_TERMINATION_REVIEW_STATE = Object.freeze({
  open_review_keys: [],
  prompts: [],
  fact_groups: [],
});

const CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES = Object.freeze({
  [RED_HAT_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
  [METSERA_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
  [SKECHERS_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
  [SKYWATER_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
  [CONCHO_DEAL_ID]: buildRedHatTerminationRightsReviewSource,
});

const CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE = Object.freeze({
  [RED_HAT_DEAL_ID]: PREVIEW_TERMINATION_REVIEW_STATE,
  [METSERA_DEAL_ID]: PREVIEW_TERMINATION_REVIEW_STATE,
  [SKECHERS_DEAL_ID]: PREVIEW_TERMINATION_REVIEW_STATE,
  [SKYWATER_DEAL_ID]: PREVIEW_TERMINATION_REVIEW_STATE,
  [CONCHO_DEAL_ID]: PREVIEW_TERMINATION_REVIEW_STATE,
});

const CANONICAL_TERMINATION_RIGHTS_REVIEW_STAGE_B_BLUEPRINTS = Object.freeze({
  [RED_HAT_DEAL_ID]: redHatB9eStageBBlueprint(),
  [METSERA_DEAL_ID]: metseraOutsideDateStageBBlueprint(),
  [SKECHERS_DEAL_ID]: skechersOutsideDateStageBBlueprint(),
  [SKYWATER_DEAL_ID]: redHatOutsideDateStageBBlueprint(),
});

const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_ROWS_FIELD =
  'canonical_v2_termination_rights_review_rows';
const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD =
  'canonical_v2_termination_rights_review_prompts';
const CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD =
  'canonical_v2_termination_rights_review_source_status';
const TERMINATION_RIGHTS_REVIEW_PROMPTS_SCHEMA =
  'TERMINATION_RIGHTS_REVIEW_PROMPTS/V1';
const TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_SCHEMA =
  'CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS/V1';
const TERMINATION_RIGHTS_REVIEW_SOURCE_STATE = Object.freeze({
  ATTACHED: 'ATTACHED',
  FAILED: 'FAILED',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function registeredValue(registry, dealId) {
  if (!isObject(registry) || !Object.prototype.hasOwnProperty.call(registry, dealId)) {
    return undefined;
  }
  return registry[dealId];
}

function hasRegisteredValue(registry, dealId) {
  return isObject(registry) && Object.prototype.hasOwnProperty.call(registry, dealId);
}

function validateSourceBundle(bundle, dealId) {
  if (!exactKeys(bundle, [
    'application_deal_id',
    'analysis',
    'projection',
    'agreement_indexes',
    'view_policy',
    'resolve_binding',
  ])
      || bundle.application_deal_id !== dealId
      || !isObject(bundle.analysis)
      || !isObject(bundle.projection)
      || !Array.isArray(bundle.agreement_indexes)
      || bundle.agreement_indexes.length === 0
      || !isObject(bundle.view_policy)
      || typeof bundle.resolve_binding !== 'function') {
    throw new TypeError('Canonical V2 Termination Rights review source bundle is invalid.');
  }
  return bundle;
}

function validateTransientReviewState(state) {
  if (!exactKeys(state, ['open_review_keys', 'prompts', 'fact_groups'])
      || !Array.isArray(state.open_review_keys)
      || !Array.isArray(state.prompts)
      || !Array.isArray(state.fact_groups)) {
    throw new TypeError('Canonical V2 Termination Rights review state is invalid.');
  }
  const openKeys = new Set();
  for (const reviewKey of state.open_review_keys) {
    if (typeof reviewKey !== 'string' || reviewKey.length === 0 || openKeys.has(reviewKey)) {
      throw new TypeError('Canonical V2 Termination Rights open review keys are invalid.');
    }
    openKeys.add(reviewKey);
  }
  const promptKeys = new Set();
  const prompts = state.prompts.map((prompt) => {
    if (!exactKeys(prompt, ['review_key', 'question', 'analysis', 'requested_input'])
        || Object.values(prompt).some((value) => typeof value !== 'string' || value.length === 0)
        || !openKeys.has(prompt.review_key)
        || promptKeys.has(prompt.review_key)) {
      throw new TypeError('Canonical V2 Termination Rights review prompts are invalid.');
    }
    promptKeys.add(prompt.review_key);
    return Object.freeze({ ...prompt });
  });
  if (promptKeys.size !== openKeys.size) {
    throw new TypeError('Every open Termination Rights review key requires one prompt.');
  }
  const groupKeys = new Set();
  const memberOwners = new Set();
  const factGroups = state.fact_groups.map((group) => {
    if (!exactKeys(group, [
      'group_key',
      'profile_key',
      'label',
      'member_field_keys',
    ])
        || typeof group.group_key !== 'string' || !group.group_key
        || typeof group.profile_key !== 'string' || !group.profile_key
        || typeof group.label !== 'string' || !group.label
        || !Array.isArray(group.member_field_keys)
        || group.member_field_keys.length === 0
        || groupKeys.has(group.group_key)) {
      throw new TypeError('Canonical V2 Termination Rights fact group is invalid.');
    }
    groupKeys.add(group.group_key);
    const localMembers = new Set();
    const memberFieldKeys = group.member_field_keys.map((fieldKey) => {
      const ownerKey = `${group.profile_key}\0${fieldKey}`;
      if (typeof fieldKey !== 'string' || !fieldKey
          || localMembers.has(fieldKey)
          || memberOwners.has(ownerKey)) {
        throw new TypeError('Canonical V2 Termination Rights fact group members overlap.');
      }
      localMembers.add(fieldKey);
      memberOwners.add(ownerKey);
      return fieldKey;
    });
    return Object.freeze({
      group_key: group.group_key,
      profile_key: group.profile_key,
      label: group.label,
      member_field_keys: Object.freeze(memberFieldKeys),
    });
  });
  return Object.freeze({
    open_review_keys: Object.freeze([...state.open_review_keys]),
    prompts: Object.freeze(prompts),
    fact_groups: Object.freeze(factGroups),
  });
}

function bindingBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError('Canonical V2 Termination Rights Agreement Index binding returned no bytes.');
}

function validateAgreementIndexBindings(analysis, agreementIndexes, resolveBinding) {
  if (!Array.isArray(analysis.source_closures)) {
    throw new TypeError('Canonical V2 Termination Rights Analysis has no source closures.');
  }
  const bindingsById = new Map();
  for (const closure of analysis.source_closures) {
    const binding = closure?.agreement_index_binding;
    if (!isObject(binding)
        || binding.record_id_field !== 'agreement_index_id'
        || typeof binding.record_id !== 'string'
        || binding.record_id.length === 0) {
      throw new TypeError('Canonical V2 Termination Rights Agreement Index binding is invalid.');
    }
    bindingsById.set(binding.record_id, binding);
  }
  const indexesById = new Map();
  for (const agreementIndex of agreementIndexes) {
    if (!isObject(agreementIndex)
        || agreementIndex.schema_version !== 'AGREEMENT_INDEX/V1'
        || typeof agreementIndex.agreement_index_id !== 'string'
        || agreementIndex.agreement_index_id.length === 0
        || indexesById.has(agreementIndex.agreement_index_id)) {
      throw new TypeError('Canonical V2 Termination Rights Agreement Index is invalid.');
    }
    indexesById.set(agreementIndex.agreement_index_id, agreementIndex);
  }
  if (indexesById.size !== bindingsById.size
      || [...indexesById.keys()].some((agreementIndexId) => !bindingsById.has(agreementIndexId))) {
    throw new TypeError('Canonical V2 Termination Rights Agreement Index set differs from the Analysis.');
  }
  for (const [agreementIndexId, binding] of bindingsById) {
    let resolved;
    try {
      resolved = bindingBytes(resolveBinding(binding));
    } catch {
      throw new TypeError(`Canonical V2 Termination Rights Agreement Index ${agreementIndexId} cannot be resolved.`);
    }
    const expected = Buffer.from(`${canonicalJson(indexesById.get(agreementIndexId))}\n`, 'utf8');
    if (!resolved.equals(expected)) {
      throw new TypeError(`Canonical V2 Termination Rights Agreement Index ${agreementIndexId} differs from its binding.`);
    }
  }
}

function describeFailure(error) {
  const isError = error !== null && typeof error === 'object';
  return Object.freeze({
    error_name: isError && error.name ? String(error.name) : 'Error',
    error_code: isError && error.code !== undefined && error.code !== null
      ? String(error.code)
      : null,
    error_message: isError && error.message ? String(error.message) : String(error),
  });
}

function sourceStatus({ state, reviewRowCount = 0, promptCount = 0, failure = null }) {
  return Object.freeze({
    schema_version: TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_SCHEMA,
    state,
    review_row_count: reviewRowCount,
    prompt_count: promptCount,
    failure,
  });
}

function withoutTransientReviewAttachment(reviewDeal) {
  const clean = { ...reviewDeal };
  delete clean[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_ROWS_FIELD];
  delete clean[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD];
  delete clean[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD];
  return clean;
}

function createCanonicalTerminationRightsReviewAttacher({
  validateAnalysis,
  validateProjection,
  assemble,
}) {
  if (![validateAnalysis, validateProjection, assemble].every((value) => typeof value === 'function')) {
    throw new TypeError('Canonical V2 Termination Rights review attacher dependencies are invalid.');
  }
  return async function attachCanonicalTerminationRightsReviewFromSources(
    reviewDeal,
    {
      sources = CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES,
      reviewState = CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE,
      stageBBlueprints = Object.freeze({}),
      logger = console,
    } = {},
  ) {
    const dealId = reviewDeal?.dealId;
    if (dealId === undefined || !hasRegisteredValue(sources, dealId)) return reviewDeal;
    try {
      const source = registeredValue(sources, dealId);
      if (typeof source !== 'function') {
        throw new TypeError('Canonical V2 Termination Rights registered source is invalid.');
      }
      const bundle = validateSourceBundle(await source(dealId), dealId);
      const state = validateTransientReviewState(registeredValue(reviewState, dealId));
      validateAnalysis({
        analysis: bundle.analysis,
        resolveBinding: bundle.resolve_binding,
      });
      validateAgreementIndexBindings(
        bundle.analysis,
        bundle.agreement_indexes,
        bundle.resolve_binding,
      );
      validateProjection({
        analysis: bundle.analysis,
        projection: bundle.projection,
        viewPolicy: bundle.view_policy,
      });
      const assembled = assemble({
        reviewDeal,
        analysis: bundle.analysis,
        projection: bundle.projection,
        agreement_indexes: bundle.agreement_indexes,
        review_state: {
          open_review_keys: [...state.open_review_keys],
          fact_groups: state.fact_groups,
        },
      });
      const noted = attachStageBGovernedDisclosureNotes(
        patchPreviewTerminationReviewRows(assembled),
        registeredValue(stageBBlueprints, dealId),
      );
      const reviewRows = noted[CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_ROWS_FIELD];
      if (!isObject(reviewRows)
          || reviewRows.schema_version !== 'TERMINATION_RIGHTS_REVIEW_ROWS/V2'
          || !Array.isArray(reviewRows.rows)) {
        throw new TypeError('Canonical V2 Termination Rights review assembly is invalid.');
      }
      return Object.freeze({
        ...noted,
        [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD]: Object.freeze({
          schema_version: TERMINATION_RIGHTS_REVIEW_PROMPTS_SCHEMA,
          prompts: state.prompts,
        }),
        [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD]: sourceStatus({
          state: TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.ATTACHED,
          reviewRowCount: reviewRows.rows.length,
          promptCount: state.prompts.length,
        }),
      });
    } catch (error) {
      logger?.error?.('Canonical V2 Termination Rights review source failed.', error);
      return Object.freeze({
        ...withoutTransientReviewAttachment(reviewDeal),
        [CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD]: sourceStatus({
          state: TERMINATION_RIGHTS_REVIEW_SOURCE_STATE.FAILED,
          failure: describeFailure(error),
        }),
      });
    }
  };
}

const attachCanonicalTerminationRightsReviewCore = createCanonicalTerminationRightsReviewAttacher({
  validateAnalysis: validateAnalysisV2,
  validateProjection: validateProjectionV2,
  assemble(input) {
    return assembleTerminationRightsReviewV2({
      ...input,
      analysis: patchPreviewTerminationAnalysis(input.analysis, input.reviewDeal?.dealId),
    });
  },
});

async function attachCanonicalTerminationRightsReview(reviewDeal, options = {}) {
  const resolvedEnv = options.env || process.env;
  if (!isCanonicalV2TerminationRightsReviewServingEnabled(resolvedEnv)) return reviewDeal;
  return attachCanonicalTerminationRightsReviewCore(reviewDeal, {
    ...options,
    stageBBlueprints: options.stageBBlueprints ?? CANONICAL_TERMINATION_RIGHTS_REVIEW_STAGE_B_BLUEPRINTS,
  });
}

function terminationRightsReviewCacheControl(reviewDeal) {
  return isObject(reviewDeal)
    && Object.prototype.hasOwnProperty.call(
      reviewDeal,
      CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD,
    )
    ? 'private, no-store'
    : 's-maxage=300, stale-while-revalidate=3600';
}

module.exports = {
  B9E_PROFILE_KEY,
  CANONICAL_TERMINATION_RIGHTS_REVIEW_SOURCES,
  CANONICAL_TERMINATION_RIGHTS_REVIEW_STAGE_B_BLUEPRINTS,
  CANONICAL_TERMINATION_RIGHTS_REVIEW_STATE,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_PROMPTS_FIELD,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENABLED_VALUE,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SERVING_ENV_KEY,
  CANONICAL_V2_TERMINATION_RIGHTS_REVIEW_SOURCE_STATUS_FIELD,
  CONCHO_DEAL_ID,
  METSERA_DEAL_ID,
  METSERA_OUTSIDE_DATE_PROFILE_KEY,
  PREVIEW_TERMINATION_DEAL_IDS,
  PREVIEW_TERMINATION_PATCH_BY_DEAL_ID,
  RED_HAT_AGREEMENT_ID,
  RED_HAT_BREACH_PROFILE_KEY,
  RED_HAT_DEAL_ID,
  RED_HAT_OUTSIDE_DATE_PROFILE_KEY,
  RED_HAT_SERVING_PAYLOAD_SHA256,
  SKECHERS_DEAL_ID,
  SKECHERS_OUTSIDE_DATE_PROFILE_KEY,
  SKYWATER_DEAL_ID,
  TERMINATION_RIGHTS_REVIEW_SOURCE_STATE,
  attachCanonicalTerminationRightsReview,
  createCanonicalTerminationRightsReviewAttacher,
  isCanonicalV2TerminationRightsReviewServingEnabled,
  patchRedHatPreviewTerminationAnalysis,
  patchRedHatPreviewTerminationReviewRows,
  collectExpressionTreeFactIds,
  terminationRightsReviewCacheControl,
};
