'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'CANONICAL_V2_EMPLOYEE_DNO_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const EMPLOYEE_DEFINITIONS = new Set([
  'EMPLOYEE_COMP_ITEM_STANDARD',
  'BENEFITS_CONTINUATION_PERIOD_MONTHS',
  'EMPLOYEE_SERVICE_CREDIT',
  'WELFARE_PLAN_TRANSITION_RELIEF',
  'EMPLOYEE_MATTERS_TPB_DISCLAIMER',
]);
const DNO_DEFINITIONS = new Set([
  'INDEMNIFICATION_CONTINUATION',
  'CHARTER_PROTECTION_CONTINUATION',
  'ADVANCEMENT_OF_EXPENSES',
  'INDEMNIFICATION_SURVIVAL_YEARS',
  'TAIL_POLICY_OBLIGATION',
  'TAIL_POLICY_PERIOD_YEARS',
  'TAIL_PREMIUM_CAP_PERCENT',
  'TAIL_PREMIUM_CAP_OFF_AGREEMENT',
  'COVERED_PERSON_TPB_RIGHTS',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function addFeature(features, key, value) {
  if (value === null || value === undefined || value === '') return;
  if (features[key] === undefined) features[key] = value;
  else if (canonicalJson(features[key]) !== canonicalJson(value)) {
    features[key] = [...new Set([].concat(features[key], value))];
  }
}

const EMPLOYEE_ITEM_LABELS = Object.freeze({
  BASE_SALARY: 'Base salary',
  TARGET_BONUS: 'Target bonus',
  EQUITY_AWARD_OPPORTUNITY: 'Equity award opportunity',
  SEVERANCE: 'Severance',
  EMPLOYEE_BENEFITS: 'Employee benefits',
});

const EMPLOYEE_STANDARD_LABELS = Object.freeze({
  NO_LESS_FAVORABLE: 'No less favourable',
  SUBSTANTIALLY_COMPARABLE: 'Substantially comparable',
  SUBSTANTIALLY_SIMILAR: 'Substantially similar',
  DEFERRED_TO_SCHEDULE: 'As set out in the disclosure schedule',
});

function employeeFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const attrs = entry.claim.attributes || {};
  const features = {};
  if (definition === 'EMPLOYEE_COMP_ITEM_STANDARD') {
    const item = attrs.comp_item;
    const standard = attrs.standard_kind;
    addFeature(features, 'compensationItems', [{
      item,
      item_label: EMPLOYEE_ITEM_LABELS[item] || item,
      label: `${EMPLOYEE_ITEM_LABELS[item] || item}: ${EMPLOYEE_STANDARD_LABELS[standard] || standard}`,
      standard_code: standard,
      standard_label: EMPLOYEE_STANDARD_LABELS[standard] || standard,
      comparison_group: attrs.benchmark || 'Not specified',
      aggregation: attrs.aggregation || null,
      text: entry.claim.raw_value,
    }]);
  } else if (definition === 'BENEFITS_CONTINUATION_PERIOD_MONTHS') {
    const months = Number(entry.claim.canonical_value);
    addFeature(features, 'protectionPeriodMonths', months);
    addFeature(features, 'employeeBenefitPeriod', months);
    addFeature(features, 'protectionPeriod', `${months} months`);
  } else if (definition === 'EMPLOYEE_SERVICE_CREDIT') {
    addFeature(features, 'continuedService', true);
  } else if (definition === 'WELFARE_PLAN_TRANSITION_RELIEF') {
    if (attrs.relief_kind === 'PREEXISTING_AND_WAITING_WAIVER') addFeature(features, 'eligibilityWaiver', true);
    if (attrs.relief_kind === 'EXPENSE_CREDIT') addFeature(features, 'welfarePlanExpenseCredit', true);
  } else if (definition === 'EMPLOYEE_MATTERS_TPB_DISCLAIMER') {
    addFeature(features, 'employeeMattersThirdPartyBeneficiaryDisclaimer', true);
  }
  addFeature(features, 'mainConcept', entry.claim.raw_value);
  return features;
}

function dnoFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const attrs = entry.claim.attributes || {};
  const features = {};
  if (definition === 'INDEMNIFICATION_CONTINUATION') addFeature(features, 'indemnificationContinuation', true);
  else if (definition === 'CHARTER_PROTECTION_CONTINUATION') addFeature(features, 'charterProtectionContinuation', true);
  else if (definition === 'ADVANCEMENT_OF_EXPENSES') addFeature(features, 'advancementOfExpenses', true);
  else if (definition === 'INDEMNIFICATION_SURVIVAL_YEARS') addFeature(features, 'indemnificationPeriod', Number(entry.claim.canonical_value));
  else if (definition === 'TAIL_POLICY_OBLIGATION') addFeature(features, 'doInsurance', true);
  else if (definition === 'TAIL_POLICY_PERIOD_YEARS') addFeature(features, 'insurancePeriod', Number(entry.claim.canonical_value));
  else if (definition === 'TAIL_PREMIUM_CAP_PERCENT') {
    addFeature(features, 'insuranceCap', `${entry.claim.canonical_value}%`);
    addFeature(features, 'tailPremiumCapPercent', Number(entry.claim.canonical_value));
  } else if (definition === 'TAIL_PREMIUM_CAP_OFF_AGREEMENT') {
    addFeature(features, 'insuranceCap', attrs.schedule_ref || entry.claim.raw_value);
    addFeature(features, 'tailPremiumCapOffAgreement', true);
  } else if (definition === 'COVERED_PERSON_TPB_RIGHTS') addFeature(features, 'coveredPersonThirdPartyBeneficiaryRights', true);
  addFeature(features, 'mainConcept', entry.claim.raw_value);
  return features;
}

function mergeFeatures(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'compensationItems') target[key] = [...(target[key] || []), ...value];
    else addFeature(target, key, value);
  }
}

function featureClaims({ entry, dealId, excerptId, features }) {
  return Object.entries(features).map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_EMPLOYEE_DNO_PRODUCT_FEATURE_CLAIM/V1', {
      claim_revision_id: entry.claim.claim_revision_id,
      attribute,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: excerptId,
    attribute,
    canonical: value,
    verbatim: entry.claim.raw_value,
    evidence_quote: entry.claim.raw_value,
    provenance: {
      code: entry.concept_key,
      feature_value: value,
      source: NATIVE_SOURCE,
      source_claim_definition_key: entry.resolved_claim_definition_key,
      source_claim_revision_id: entry.claim.claim_revision_id,
    },
  }));
}

function evidenceFamily(item) {
  const detail = String(item?.attributes?.why_unmapped || '');
  return /^(ADVANCEMENT_TIMING|SUCCESSOR_ASSUMPTION|PENDING_CLAIM_SURVIVAL|INDEMNIFICATION_AGREEMENT|FEE_SHIFTING|CLAIMS_HANDLING):/.test(detail)
    ? 'DNO_INDEMNIFICATION'
    : 'EMPLOYEE_MATTERS';
}

function projectEmployeeDnoProductSurfaces({ resolution, deal_id: dealId } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of resolution.resolved) {
    const isEmployee = EMPLOYEE_DEFINITIONS.has(entry?.resolved_claim_definition_key) && entry.concept_key === 'COV-EMPLOYEE';
    const isDno = DNO_DEFINITIONS.has(entry?.resolved_claim_definition_key)
      && ['DNO-INDEM', 'DNO-TAIL', 'DNO-BENEF', 'COV-DO'].includes(entry.concept_key);
    if (!isEmployee && !isDno) continue;
    const provisionId = entry.provision_instance?.provision_instance_id;
    if (!provisionId || !entry.claim?.claim_revision_id) continue;
    const excerptId = `native:${provisionId}`;
    const conceptKey = isEmployee ? 'COV-EMPLOYEE' : 'COV-DO';
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId, excerptId, conceptKey, sectionRef: entry.section_reference,
      features: {}, quotes: [], claimRevisionIds: [],
    });
    const group = groups.get(provisionId);
    const features = isEmployee ? employeeFeatures(entry) : dnoFeatures(entry);
    mergeFeatures(group.features, features);
    group.quotes.push(entry.claim.raw_value);
    group.claimRevisionIds.push(entry.claim.claim_revision_id);
    claims.push(...featureClaims({ entry, dealId, excerptId, features }));
  }

  const cards = [...groups.values()].map((group) => {
    const quote = [...new Set(group.quotes)].join('\n');
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: group.excerptId,
      type: 'COV',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: group.conceptKey,
      section_ref: group.sectionRef,
      short_title: group.conceptKey === 'COV-EMPLOYEE' ? 'Employee matters' : 'Directors and officers indemnification',
      primary_quote: quote,
      region_full_text: quote,
      full_text: quote,
      features: group.features,
      ai_metadata: { features: group.features },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
      },
    };
  });

  const openItems = resolution.open_world.filter((item) => (
    item?.claim_definition_key === 'OPEN_WORLD_PROPOSITION'
    && /^(RETIREMENT_401K|BONUS_OR_LTI|WARN_OR_CBA|ADVANCEMENT_TIMING|SUCCESSOR_ASSUMPTION|PENDING_CLAIM_SURVIVAL|INDEMNIFICATION_AGREEMENT|FEE_SHIFTING|CLAIMS_HANDLING):/.test(String(item?.attributes?.why_unmapped || ''))
  ));
  const evidenceCards = openItems.map((item, ordinal) => {
    const family = evidenceFamily(item);
    return {
      id: contentId('CANONICAL_V2_EMPLOYEE_DNO_EVIDENCE_CARD/V1', { deal_id: dealId, closure_id: item.closure_id, ordinal }),
      deal_id: dealId,
      excerpt_id: `open-world:${item.closure_id}`,
      type: 'COV',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: family === 'EMPLOYEE_MATTERS' ? 'COV-EMPLOYEE' : 'COV-DO',
      section_ref: item.section_reference,
      short_title: family === 'EMPLOYEE_MATTERS' ? 'Deferred employee-matters evidence' : 'Deferred D&O evidence',
      primary_quote: item.raw_value,
      region_full_text: item.raw_value,
      full_text: item.raw_value,
      features: {},
      ai_metadata: { features: {} },
      canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
    };
  });
  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims: claims.sort((a, b) => a.id.localeCompare(b.id)),
    open_items: clone(openItems),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  DNO_DEFINITIONS,
  EMPLOYEE_DEFINITIONS,
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  projectEmployeeDnoProductSurfaces,
};
