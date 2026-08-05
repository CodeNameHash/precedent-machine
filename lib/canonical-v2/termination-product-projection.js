'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { NORMALIZERS } = require('../row-market-stats/legal-normalizers');
const PROJECTION_SCHEMA = 'CANONICAL_V2_TERMINATION_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const RIGHT_DEFINITIONS = new Set([
  'TERMINATION_RIGHT_GRANT',
  'TERMINATION_OUTSIDE_DATE',
  'TERMINATION_CURE_PERIOD_DAYS',
]);
const FEE_DEFINITIONS = new Set([
  'TERMINATION_FEE_AMOUNT',
  'TERMINATION_FEE_TRIGGER',
  'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
]);
const RIGHT_EVIDENCE_SURFACES = new Set([
  'OUTSIDE_DATE_EXTENSION',
  'RESTRAINT_FINALITY',
  'VOTE_THRESHOLD',
  'BREACH_STANDARD',
  'PRE_VOTE_LIMIT',
]);
const FEE_EVIDENCE_SURFACES = new Set([
  'SOLE_REMEDY',
  'SOLE_REMEDY_EVIDENCE',
  'NAKED_NO_VOTE',
  'EXPENSE_REIMBURSEMENT',
  'LATE_PAYMENT_INTEREST',
  'TAIL_FEE_STRUCTURE',
]);

const RIGHT_TITLES = Object.freeze({
  'TERMR-MUTUAL': 'Mutual Consent',
  'TERMR-OUTSIDE': 'Outside Date',
  'TERMR-NOVOTE': 'Stockholder Vote Not Obtained',
  'TERMR-BREACH-T': 'Company Breach',
  'TERMR-BREACH-B': 'Buyer Breach',
  'TERMR-LEGAL': 'Legal Restraint',
  'TERMR-SUPERIOR': 'Superior Proposal',
  'TERMR-RECOMMEND': 'Change of Recommendation',
});
const FEE_TRIGGER_LABELS = Object.freeze({
  SUPERIOR_PROPOSAL_TERMINATION: 'Company terminates to accept a superior proposal',
  ACQUISITION_PROPOSAL_TAIL: 'Qualifying acquisition transaction during the tail period',
  CHANGE_IN_RECOMMENDATION_TERMINATION: 'Change in recommendation',
  NO_SOLICIT_BREACH_TERMINATION: 'No-solicitation breach',
  STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: 'Stockholder approval failure',
  OUTSIDE_DATE_TERMINATION: 'Outside date',
  // Both grounds are encoded by lib/canonical-v2/termination-fee-serving-
  // source.js (QXO/TopBuild §6.5(b)(iii)(C)(2) and §6.5(b)(iii)(D)) but had no
  // entry here, so triggerValue()'s fallback rendered them as lowercased
  // machine codes ("counterparty covenant breach termination"). The wording
  // matches lib/canonical-v2/termination-fee-trigger-presentation.js's
  // TRIGGER_LABELS, the repo's existing vocabulary for the same two codes,
  // reduced to this map's party-neutral pill register (that module resolves
  // "Company"/"Parent" from the effect's legal_operation; a code->label map
  // has no party in scope, so the covenant-breach label stays on the
  // taxonomy's own "counterparty" wording).
  COUNTERPARTY_COVENANT_BREACH_TERMINATION: 'Counterparty covenant breach',
  INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION: 'Intervening-event recommendation change',
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
    features[key] = [...new Map([].concat(features[key], value).map((item) => [canonicalJson(item), item])).values()];
  }
}

function claimQuote(entry) {
  return typeof entry?.claim?.raw_value === 'string' ? entry.claim.raw_value : '';
}

function partyCode(entry) {
  const capacity = entry?.party?.capacity || entry?.provision_instance?.party?.capacity;
  if (capacity === 'EITHER_PRINCIPAL_PARTY') return 'PARTY_MUTUAL';
  if (capacity === 'BUYER') return 'PARTY_BUYER';
  if (capacity === 'TARGET') return 'PARTY_TARGET';
  return null;
}

function rightCode(entry) {
  if (entry?.concept_key !== 'TERMR-BREACH') return entry?.concept_key;
  const capacity = entry?.party?.capacity || entry?.provision_instance?.party?.capacity;
  if (capacity === 'BUYER') return 'TERMR-BREACH-T';
  if (capacity === 'TARGET') return 'TERMR-BREACH-B';
  return null;
}

function rightFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const features = {};
  const quote = claimQuote(entry);
  addFeature(features, 'partyWhoCanTerminate', partyCode(entry));
  addFeature(features, 'terminationTriggers', entry.claim?.attributes?.trigger_kind);
  addFeature(features, 'mainConcept', quote);
  if (definition === 'TERMINATION_OUTSIDE_DATE') {
    addFeature(features, 'outsideDate', entry.claim.canonical_value);
    addFeature(features, 'outsideDateISO', entry.claim.canonical_value);
  }
  if (definition === 'TERMINATION_CURE_PERIOD_DAYS') {
    addFeature(features, 'curePeriod', entry.claim.canonical_value);
  }
  return features;
}

function formatUsd(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
    : value;
}

function triggerValue(entry) {
  const code = entry.claim.canonical_value;
  return {
    code,
    label: FEE_TRIGGER_LABELS[code] || String(code).replaceAll('_', ' ').toLowerCase(),
    text: claimQuote(entry),
  };
}

function feeFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const side = entry.concept_key === 'TERMF-REVERSE' ? 'BUYER' : 'SELLER';
  const feeKey = side === 'BUYER' ? 'reverseTerminationFee' : 'companyTerminationFee';
  const amountKey = side === 'BUYER' ? 'reverseFeeAmount' : 'feeAmount';
  const features = {};
  if (definition === 'TERMINATION_FEE_AMOUNT') {
    const amount = formatUsd(entry.claim.canonical_value);
    addFeature(features, feeKey, { amount, triggers: [] });
    addFeature(features, amountKey, amount);
  } else if (definition === 'TERMINATION_FEE_TRIGGER') {
    addFeature(features, feeKey, { triggers: [triggerValue(entry)] });
  } else if (definition === 'TERMINATION_FEE_TAIL_PERIOD_MONTHS') {
    addFeature(features, 'tailProvision', { period_months: entry.claim.canonical_value });
    addFeature(features, 'tailFeeWindowMonths', entry.claim.canonical_value);
  }
  return features;
}

function mergeFeature(features, key, value) {
  if (features[key] === undefined) {
    features[key] = value;
    return;
  }
  if (['companyTerminationFee', 'reverseTerminationFee', 'tailProvision'].includes(key)) {
    const current = features[key];
    features[key] = { ...current, ...value };
    if (Array.isArray(current.triggers) || Array.isArray(value.triggers)) {
      features[key].triggers = [...new Map([...(current.triggers || []), ...(value.triggers || [])]
        .map((item) => [item.code || canonicalJson(item), item])).values()];
    }
    return;
  }
  addFeature(features, key, value);
}

// LATE_PAYMENT_INTEREST arrives as PROSE (`benchmark_quote`, e.g. "the prime
// rate of Bank of America (or its successors or assigns) in effect on the date
// such payment was required to be made"). The producer is forbidden from
// deriving a rate basis itself (see termination-fee-producer-prompt.js: "Never
// derive a rate or day-count basis"), so the CODE is derived here, by the same
// deterministic classifier the market subterms on this very row already use --
// lib/row-market-stats/legal-normalizers.js#latePaymentRateBasis, reached
// through its NORMALIZERS registry. There is deliberately no second rate regex
// in this file or in the review config.
//
// OTHER_REFERENCE_RATE is that classifier's "I did not recognise this" bucket,
// not a rate it identified. A benchmark stated as a defined-term
// cross-reference -- "the Applicable Rate" -- is a POINTER to a definition
// elsewhere in the agreement, and lands there. Publishing it as a rate basis
// would tell every downstream consumer (the review row's label, the market
// rate-basis subterm, corpus stats) that a reference rate was extracted when
// none was. So no code is published in that case; the prose still is, and the
// review row states that the rate is unresolved.
const UNRESOLVED_RATE_BASIS_CODE = 'OTHER_REFERENCE_RATE';

function interestRateBasisCode(benchmarkQuote) {
  const prose = typeof benchmarkQuote === 'string' ? benchmarkQuote.trim() : '';
  if (!prose) return null;
  const [code] = NORMALIZERS.late_payment_rate_basis(prose) || [];
  return code && code !== UNRESOLVED_RATE_BASIS_CODE ? code : null;
}

function evidenceSurface(entry) {
  const why = entry?.attributes?.why_unmapped;
  return typeof why === 'string' ? why.split(':', 1)[0].trim() : null;
}

// Wave B is published as exact, structured evidence.  It must not be
// reverse-engineered into an allocation, a rate, or a unified legal
// standard.  The names below deliberately match the existing query and
// review fields where the source itself supplies that fact.
function waveBEvidenceFeatures(entry, family) {
  const mechanic = entry?.attributes?.structured_mechanic;
  if (!mechanic || typeof mechanic !== 'object') return {};
  const crossReference = mechanic.explicit_clause_cross_reference || null;
  if (family === 'TERMINATION_RIGHTS') {
    if (mechanic.surface === 'OUTSIDE_DATE_EXTENSION') return {
      outsideDateExtension: clone(mechanic),
      ...(mechanic.maximum_exercises !== null && mechanic.maximum_exercises !== undefined
        ? { extensionMaxExercises: mechanic.maximum_exercises } : {}),
      ...(crossReference ? { explicitClauseCrossReference: clone(crossReference) } : {}),
    };
    if (mechanic.surface === 'RESTRAINT_FINALITY') return {
      restraintFinality: clone(mechanic.finality_terms_present || []),
      ...(mechanic.other_finality_terms?.length ? { otherRestraintFinalityTerms: clone(mechanic.other_finality_terms) } : {}),
      ...(crossReference ? { explicitClauseCrossReference: clone(crossReference) } : {}),
    };
    if (mechanic.surface === 'BREACH_STANDARD') return {
      statedBreachStandard: clone(mechanic),
      ...(crossReference ? { explicitClauseCrossReference: clone(crossReference) } : {}),
    };
    return { terminationWaveBEvidence: clone(mechanic) };
  }
  if (mechanic.surface === 'SOLE_REMEDY_EVIDENCE') return {
    soleRemedyFeeContext: {
      payment_context_quote: mechanic.payment_context_quote || null,
      source_section_reference: entry.section_reference,
    },
    soleRemedyRemediesClaimLink: mechanic.remedies_claim_link || null,
  };
  if (mechanic.surface === 'LATE_PAYMENT_INTEREST') {
    const basis = interestRateBasisCode(mechanic.benchmark_quote);
    return {
      interestOnLatePayment: true,
      latePaymentInterestBenchmark: mechanic.benchmark_quote || null,
      latePaymentInterestDueDateReference: mechanic.due_date_reference_quote || null,
      // Absent, never null, when the classifier did not resolve one: a null
      // interestRateBasis would still be a published rate-basis field.
      ...(basis ? { interestRateBasis: basis } : {}),
    };
  }
  if (mechanic.surface === 'TAIL_FEE_STRUCTURE') return {
    tailProvision: clone(mechanic),
    tailFeeStructureEvidence: clone(mechanic),
  };
  return { terminationFeeWaveBEvidence: clone(mechanic) };
}

function evidenceCard(entry, dealId, family, ordinal) {
  const surface = evidenceSurface(entry);
  const id = entry.closure_id || contentId('CANONICAL_V2_OPEN_WORLD_EVIDENCE_CARD/V1', {
    deal_id: dealId,
    family,
    surface,
    raw_value: entry.raw_value,
    ordinal,
  });
  const detail = String(entry?.attributes?.why_unmapped || '').replace(/^[^:]+:\s*/, '').trim() || null;
  const structuredMechanic = entry?.attributes?.structured_mechanic || null;
  const features = {
    canonicalV2OpenWorldEvidence: {
      surface,
      detail,
      reason: entry.reason,
      ...(structuredMechanic ? { structuredMechanic: clone(structuredMechanic) } : {}),
    },
    ...waveBEvidenceFeatures(entry, family),
  };
  return {
    id,
    provision_instance_id: id,
    deal_id: dealId,
    excerpt_id: `native-open-world:${id}`,
    type: family === 'TERMINATION_RIGHTS' ? 'TERMR' : 'TERMF',
    provision_type: family === 'TERMINATION_RIGHTS' ? 'TERMINATION_RIGHT' : 'TERMINATION_FEE',
    provision_subtype: 'OPEN-WORLD',
    section_ref: entry.section_reference,
    short_title: 'Deferred Evidence',
    primary_quote: entry.raw_value || '',
    region_full_text: entry.raw_value || '',
    full_text: entry.raw_value || '',
    features,
    ai_metadata: { features },
    canonical_v2_lineage: {
      source: EVIDENCE_SOURCE,
      closure_id: entry.closure_id || null,
    },
  };
}

function project({ resolution, dealId, family, definitions, evidenceSurfaces, codeFor, featuresFor, type, projectionName }) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution.resolved and resolution.open_world must be arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  for (const entry of resolution.resolved) {
    if (!definitions.has(entry?.resolved_claim_definition_key)) continue;
    const conceptKey = codeFor(entry);
    const provisionId = entry?.provision_instance?.provision_instance_id;
    if (!conceptKey || !provisionId || !entry?.claim?.claim_revision_id) continue;
    const excerptId = `native:${provisionId}`;
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      conceptKey,
      excerptId,
      sectionRef: entry.section_reference,
      quotes: [],
      features: {},
      claimRevisionIds: [],
      claimDefinitionKeys: [],
    });
    const group = groups.get(provisionId);
    if (group.conceptKey !== conceptKey) throw new Error('one provision cannot project to two termination concepts');
    const features = featuresFor(entry);
    for (const [key, value] of Object.entries(features)) mergeFeature(group.features, key, value);
    if (claimQuote(entry)) group.quotes.push(claimQuote(entry));
    group.claimRevisionIds.push(entry.claim.claim_revision_id);
    group.claimDefinitionKeys.push(entry.resolved_claim_definition_key);
  }
  const governedCards = [...groups.values()].map((group) => {
    const primaryQuote = [...new Set(group.quotes)].join('\n');
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: group.excerptId,
      type,
      provision_type: family === 'TERMINATION_RIGHTS' ? 'TERMINATION_RIGHT' : 'TERMINATION_FEE',
      provision_subtype: group.conceptKey,
      section_ref: group.sectionRef,
      short_title: family === 'TERMINATION_RIGHTS' ? RIGHT_TITLES[group.conceptKey] : group.conceptKey,
      primary_quote: primaryQuote,
      region_full_text: primaryQuote,
      full_text: primaryQuote,
      features: group.features,
      ai_metadata: { features: group.features },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
        claim_definition_keys: [...new Set(group.claimDefinitionKeys)].sort(),
      },
    };
  });
  const claims = governedCards.flatMap((card) => Object.entries(card.features).map(([attribute, value]) => ({
    id: contentId(`CANONICAL_V2_${family}_PRODUCT_FEATURE_CLAIM/V1`, {
      provision_instance_id: card.provision_instance_id,
      attribute,
      value,
    }),
    deal_id: dealId,
    excerpt_id: card.excerpt_id,
    attribute,
    canonical: value,
    verbatim: card.primary_quote,
    evidence_quote: card.primary_quote,
    provenance: {
      code: card.provision_subtype,
      feature_value: value,
      source: NATIVE_SOURCE,
      source_claim_definition_keys: card.canonical_v2_lineage.claim_definition_keys,
      source_claim_revision_ids: card.canonical_v2_lineage.claim_revision_ids,
    },
  })));
  const openEntries = resolution.open_world.filter((entry) => evidenceSurfaces.has(evidenceSurface(entry)));
  const evidenceCards = openEntries.map((entry, ordinal) => evidenceCard(entry, dealId, family, ordinal));
  const body = {
    deal_id: dealId,
    family,
    source: NATIVE_SOURCE,
    cards: [...governedCards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims: claims.sort((a, b) => a.id.localeCompare(b.id)),
    open_items: openEntries.map((entry) => ({
      surface: evidenceSurface(entry),
      closure_id: entry.closure_id || null,
      evidence: entry.raw_value || '',
      ...(entry?.attributes?.structured_mechanic
        ? { structured_mechanic: clone(entry.attributes.structured_mechanic) }
        : {}),
    })),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_kind: projectionName,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

function projectTerminationRightsProductSurfaces({ resolution, deal_id: dealId } = {}) {
  return project({
    resolution,
    dealId,
    family: 'TERMINATION_RIGHTS',
    definitions: RIGHT_DEFINITIONS,
    evidenceSurfaces: RIGHT_EVIDENCE_SURFACES,
    codeFor: rightCode,
    featuresFor: rightFeatures,
    type: 'TERMR',
    projectionName: 'TERMINATION_RIGHTS',
  });
}

function projectTerminationFeeProductSurfaces({ resolution, deal_id: dealId } = {}) {
  return project({
    resolution,
    dealId,
    family: 'TERMINATION_FEE',
    definitions: FEE_DEFINITIONS,
    evidenceSurfaces: FEE_EVIDENCE_SURFACES,
    codeFor: (entry) => entry.concept_key,
    featuresFor: feeFeatures,
    type: 'TERMF',
    projectionName: 'TERMINATION_FEE',
  });
}

module.exports = {
  EVIDENCE_SOURCE,
  FEE_EVIDENCE_SURFACES,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  RIGHT_EVIDENCE_SURFACES,
  waveBEvidenceFeatures,
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
};
