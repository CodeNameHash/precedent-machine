'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'CANONICAL_V2_PROXY_MEETING_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const SUPPORTED_DEFINITIONS = new Set([
  'PROXY_FILING_DEADLINE_DAYS',
  'MEETING_DEADLINE_DAYS',
  'MEETING_ADJOURNMENT_MAX_COUNT',
  'MEETING_ADJOURNMENT_MAX_DAYS',
  'BOARD_RECOMMENDATION_INCLUSION',
  'MEETING_CONVENE_OBLIGATION',
  'RECORD_DATE_ESTABLISHMENT_PRESENT',
  'BROKER_SEARCH_OBLIGATION_PRESENT',
  'PARENT_APPROVAL_OBLIGATION',
  'MERGER_SUB_APPROVAL_OBLIGATION',
  'MEETING_ADJOURNMENT_REASON',
]);

const ADJOURNMENT_REASON_LABELS = Object.freeze({
  QUORUM_ABSENT: 'Quorum absent',
  INSUFFICIENT_VOTES: 'Insufficient votes',
  SUPPLEMENTAL_DISCLOSURE: 'Supplemental disclosure',
  LEGAL_REQUIREMENT: 'Legal requirement',
});

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

function deadlineValue(entry) {
  const attrs = entry.claim.attributes || {};
  return {
    text: entry.claim.raw_value,
    days: Number(entry.claim.canonical_value),
    unit: attrs.day_kind === 'BUSINESS' ? 'BUSINESS_DAYS' : 'CALENDAR_DAYS',
    trigger: attrs.anchor_kind,
  };
}

function meetingParty(entry) {
  if (entry.party?.capacity === 'TARGET') return 'COMPANY';
  if (entry.party?.capacity === 'BUYER') return 'PARENT';
  // Step 3F1 (docs/core/PLAN.md, "give the marker a downstream contract"):
  // this field is COMPANY/PARENT-shaped and rendered directly to a user
  // (adjournmentRights[].party). Before this fix, ANY unrecognised
  // capacity -- including JOINT_MULTI_PARTY_CAPACITY ('JOINT_MULTI_PARTY',
  // lib/canonical-v2/native-producer/candidate-resolution.js) -- fell
  // through to `entry.party?.capacity || null`, which would render that raw
  // internal marker string as if it were a party label. The final `return
  // null` below now refuses ANY unrecognised capacity explicitly, not just
  // JOINT: this field only ever means COMPANY or PARENT, so anything else
  // is omitted rather than leaked. No committed evidence reaches this with
  // a joint capacity today (adjournment rights are not among the families
  // that currently mint JOINT_MULTI_PARTY_CAPACITY), but the refusal is
  // explicit and tested rather than left to accident (see
  // tests/canonical-v2-proxy-meeting-product-parity.test.js,
  // "JOINT_MULTI_PARTY capacity").
  return null;
}

function projectedFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const attrs = entry.claim.attributes || {};
  const features = {};
  if (definition === 'PROXY_FILING_DEADLINE_DAYS') {
    addFeature(features, 'proxyFilingDeadline', deadlineValue(entry));
  } else if (definition === 'MEETING_DEADLINE_DAYS') {
    addFeature(features, 'meetingDeadline', deadlineValue(entry));
  } else if (definition === 'BOARD_RECOMMENDATION_INCLUSION') {
    addFeature(features, 'boardRecommendationInclusion', true);
  } else if (definition === 'MEETING_CONVENE_OBLIGATION') {
    addFeature(features, 'meetingConveneObligation', true);
  } else if (definition === 'RECORD_DATE_ESTABLISHMENT_PRESENT') {
    addFeature(features, 'meetingRecordDate', true);
  } else if (definition === 'BROKER_SEARCH_OBLIGATION_PRESENT') {
    addFeature(features, 'brokerSearchObligation', true);
  } else if (definition === 'PARENT_APPROVAL_OBLIGATION') {
    addFeature(features, 'parentApprovalRequired', true);
    addFeature(features, 'parentApprovalMechanism', attrs.approval_mechanism);
    addFeature(features, 'parentApprovalTiming', attrs.approval_timing);
  } else if (definition === 'MERGER_SUB_APPROVAL_OBLIGATION') {
    addFeature(features, 'mergerSubApprovalRequired', true);
    addFeature(features, 'mergerSubApprovalMechanism', attrs.approval_mechanism);
    addFeature(features, 'mergerSubApprovalTiming', attrs.approval_timing);
  } else if (definition === 'MEETING_ADJOURNMENT_REASON') {
    const reasonCode = entry.claim.canonical_value;
    addFeature(features, 'adjournmentRights', [{
      party: meetingParty(entry),
      reasons: [{ code: reasonCode, label: ADJOURNMENT_REASON_LABELS[reasonCode], text: entry.claim.raw_value }],
      maxAdjournments: null,
      maxDaysPerAdjournment: null,
      maxDaysTotal: null,
      text: entry.claim.raw_value,
    }]);
  } else if (definition === 'MEETING_ADJOURNMENT_MAX_COUNT') {
    addFeature(features, 'meetingAdjournmentMaxCount', Number(entry.claim.canonical_value));
    addFeature(features, 'adjournmentRights', [{
      party: meetingParty(entry),
      reasons: [],
      maxAdjournments: Number(entry.claim.canonical_value),
      maxDaysPerAdjournment: null,
      maxDaysTotal: null,
      text: entry.claim.raw_value,
    }]);
  } else if (definition === 'MEETING_ADJOURNMENT_MAX_DAYS') {
    addFeature(features, 'meetingAdjournmentMaxDays', Number(entry.claim.canonical_value));
    addFeature(features, 'adjournmentRights', [{
      party: meetingParty(entry),
      reasons: [],
      maxAdjournments: null,
      maxDaysPerAdjournment: attrs.limit_basis === 'PER_OCCASION' ? Number(entry.claim.canonical_value) : null,
      maxDaysTotal: attrs.limit_basis === 'AGGREGATE' ? Number(entry.claim.canonical_value) : null,
      dayKind: attrs.day_kind === 'BUSINESS' ? 'BUSINESS_DAYS' : 'CALENDAR_DAYS',
      text: entry.claim.raw_value,
    }]);
  }
  addFeature(features, 'mainConcept', entry.claim.raw_value);
  return features;
}

function mergeAdjournmentRights(existing, incoming) {
  const all = [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])];
  const byParty = new Map();
  for (const right of all) {
    const key = right.party || 'UNSPECIFIED';
    const current = byParty.get(key) || { party: right.party, reasons: [], maxAdjournments: null, maxDaysPerAdjournment: null, maxDaysTotal: null, text: '' };
    current.reasons = [...new Map([
      ...current.reasons,
      ...(Array.isArray(right.reasons) ? right.reasons : []),
    ].map((reason) => [reason.code || reason.label || canonicalJson(reason), reason])).values()];
    for (const field of ['maxAdjournments', 'maxDaysPerAdjournment', 'maxDaysTotal', 'dayKind']) {
      if (right[field] !== null && right[field] !== undefined) current[field] = right[field];
    }
    current.text = [...new Set([current.text, right.text].filter(Boolean))].join('\n');
    byParty.set(key, current);
  }
  return [...byParty.values()];
}

function mergeFeatures(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'adjournmentRights') target[key] = mergeAdjournmentRights(target[key], value);
    else addFeature(target, key, value);
  }
}

function featureClaims({ entry, dealId, excerptId, features }) {
  return Object.entries(features).map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_PROXY_MEETING_PRODUCT_FEATURE_CLAIM/V1', {
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

function evidenceConcept(item) {
  const kind = item?.attributes?.assertion_kind;
  return ['FILING_DEADLINE', 'MAILING_DEADLINE', 'RECOMMENDATION_INCLUSION'].includes(kind)
    ? 'COV-PROXY'
    : 'COV-MEETING';
}

function projectProxyMeetingProductSurfaces({ resolution, deal_id: dealId, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of filterResolvedEntriesForPublication(resolution.resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime)) {
    if (!SUPPORTED_DEFINITIONS.has(entry?.resolved_claim_definition_key)) continue;
    if (![
      'COV-PROXY',
      'COV-MEETING',
      'COV-PROXY-PARENT-APPROVAL',
      'COV-PROXY-MERGERSUB-APPROVAL',
    ].includes(entry.concept_key)) continue;
    const provisionId = entry.provision_instance?.provision_instance_id;
    if (!provisionId || !entry.claim?.claim_revision_id) continue;
    const excerptId = `native:${provisionId}`;
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      excerptId,
      conceptKey: entry.concept_key,
      sectionRef: entry.section_reference,
      features: {},
      quotes: [],
      claimRevisionIds: [],
    });
    const group = groups.get(provisionId);
    const features = projectedFeatures(entry);
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
      type: 'SEC',
      provision_type: 'SEC_FILING_MEETING',
      provision_subtype: group.conceptKey,
      section_ref: group.sectionRef,
      short_title: group.conceptKey === 'COV-PROXY'
        ? 'Proxy statement covenant'
        : group.conceptKey === 'COV-PROXY-PARENT-APPROVAL'
          ? 'Parent approval covenant'
          : group.conceptKey === 'COV-PROXY-MERGERSUB-APPROVAL'
            ? 'Merger Sub approval covenant'
            : 'Stockholder meeting covenant',
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

  const evidenceCards = resolution.open_world
    .filter((item) => item?.claim_definition_key === 'NATIVE_PROXY_MEETING_COVENANT_CANDIDATE')
    .map((item, ordinal) => ({
      id: contentId('CANONICAL_V2_PROXY_MEETING_EVIDENCE_CARD/V1', { deal_id: dealId, closure_id: item.closure_id, ordinal }),
      deal_id: dealId,
      excerpt_id: `open-world:${item.closure_id}`,
      type: 'SEC',
      provision_type: 'SEC_FILING_MEETING',
      provision_subtype: evidenceConcept(item),
      section_ref: item.section_reference,
      short_title: 'Deferred proxy or meeting evidence',
      primary_quote: item.raw_value,
      region_full_text: item.raw_value,
      full_text: item.raw_value,
      features: {},
      ai_metadata: { features: {} },
      canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
    }));

  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims: claims.sort((a, b) => a.id.localeCompare(b.id)),
    open_items: clone(resolution.open_world.filter((item) => item?.claim_definition_key === 'NATIVE_PROXY_MEETING_COVENANT_CANDIDATE')),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  PROJECTION_SCHEMA,
  NATIVE_SOURCE,
  EVIDENCE_SOURCE,
  SUPPORTED_DEFINITIONS,
  projectProxyMeetingProductSurfaces,
};
