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
    // Carve-outs (fraud / willful-and-intentional breach) to the sole-and-
    // exclusive-remedy provision, exactly as the producer read them off the
    // clause -- published as EVIDENCE, not folded into a resolved soleRemedy
    // fact on this card. The sole-remedy LEGAL EFFECT is Remedies-owned (see
    // tests/canonical-v2-sole-remedy-resolution.test.js's dedicated resolver
    // and tests/canonical-v2-termination-product-parity.test.js's pinned
    // `deferred.features.soleRemedy === undefined` against this exact
    // mechanic shape); this file must not assert that determination itself.
    // Once a Remedies-family run has linked and validated a deal's carve-outs
    // (soleRemedyRemediesClaimLink is non-null), the resolver has ALREADY
    // stripped `carve_outs` off the mechanic by then, so this branch
    // contributes nothing new in that case -- see the "Landos" fixture in
    // the sole-remedy test. But when no Remedies-family run has processed a
    // deal at all -- Modiv, today -- the carve-out text extracted here by
    // the TERMINATION_FEE producer is the ONLY place it exists; dropping it
    // would silently discard a correctly-extracted fact. Two different rows
    // may want it (a carve-out to the effect-of-termination rule and a
    // carve-out to the sole-remedy cap are legally distinct facts, per
    // tests/termination-willful-breach-and-fee-required.test.js) -- this
    // does not decide between them, it only publishes the fact.
    ...(Array.isArray(mechanic.carve_outs) && mechanic.carve_outs.length
      ? { soleRemedyCarveOutEvidence: clone(mechanic.carve_outs) } : {}),
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

// ── Conditional termination-fee values (resolution.conditional_termination_fee_values) ──
// A small number of deals (today: Modiv's bespoke §7.3 parser --
// lib/canonical-v2/native-producer/modiv-termination-fee-source-parser.js)
// resolve the fee amount as a FORMULA rather than a flat figure: "the lesser
// of" a stated base amount -- which can itself vary by which termination
// branch is invoked -- and an unquantified cap (a REIT-qualifying-income
// ceiling, in Modiv's case). This is not a rendering nicety: showing the base
// amount alone would misstate the agreement (the fee IS capped), and showing
// nothing throws away a correctly-extracted fact. So the headline says
// exactly what the agreement says -- which figure applies for which branch,
// and that the whole thing is capped by the named defined term. See
// lib/canonical-v2/native-producer/conditional-termination-fee-value.js for
// the schema this reads.
const CONDITIONAL_FEE_SIDES = Object.freeze({
  SELLER: Object.freeze({ concept: 'TERMF-TARGET', feeKey: 'companyTerminationFee' }),
  BUYER: Object.freeze({ concept: 'TERMF-REVERSE', feeKey: 'reverseTerminationFee' }),
});

// "7.3(b)(i)" -> { base: "7.3(b)", limb: "(i)" }. A citation with no trailing
// parenthetical (shouldn't happen for this schema's closed BRANCHES enum, but
// handled rather than assumed) keeps the whole string as `base` with no limb.
function splitBranchCitation(citation) {
  const match = /^(.*?)(\([^()]+\))$/.exec(String(citation || ''));
  return match ? { base: match[1], limb: match[2] } : { base: String(citation || ''), limb: '' };
}

function joinWithOr(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

// ['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)'] -> '§7.3(b)(i), (ii) or (iii)'.
// Falls back to listing full citations when they don't all share one base
// clause -- never silently drops a branch that doesn't fit the shorthand.
function formatBranchCitations(branches) {
  const parsed = branches.map(splitBranchCitation);
  const base = parsed[0]?.base;
  const shareBase = Boolean(base) && parsed.every((p) => p.base === base && p.limb);
  if (shareBase) return `§${base}${joinWithOr(parsed.map((p) => p.limb))}`;
  return branches.map((b) => `§${b}`).join(', ');
}

// Groups same-amount branches together -- the agreement itself does this
// ("(x) if payable under (i), (ii) or (iii), $10,000,000, or (y) if payable
// under (iv) or (v), $15,000,000"), and it is what makes the headline
// readable instead of repeating the same figure branch by branch. Insertion
// order is preserved so the headline reads in the branches' own order.
function groupConditionalFeeValues(values) {
  const groups = new Map();
  for (const value of values) {
    const key = `${value.base_amount}|${value.currency}`;
    if (!groups.has(key)) groups.set(key, { amountLabel: formatUsd(value.base_amount), branches: [] });
    groups.get(key).branches.push(value.triggering_branch);
  }
  return [...groups.values()];
}

// The schema behind resolution.conditional_termination_fee_values currently
// enforces operator === 'LOWER_OF' (see conditional-termination-fee-value.js)
// -- "the lesser of" is the only meaning this file will render. A future
// operator this file doesn't recognise is shown literally rather than
// silently read as "lesser of": a wrong "lesser of" is a confidently wrong
// legal claim, and an unrecognised operator failing loud is safer than that.
function conditionalOperatorPhrase(operator) {
  return operator === 'LOWER_OF' ? 'Lesser of' : `[${operator} of]`;
}

// The full honest headline: which figure applies for which branch, and the
// named cap the whole thing is subject to. Deliberately NOT a single number
// -- e.g. Modiv's Company Termination Fee is $10,000,000 for some branches
// and $15,000,000 for others, and either one can be reduced by the REIT
// Requirements cap. Showing one figure alone would misstate the agreement;
// showing nothing would throw away a correctly-extracted fact.
function conditionalFeeHeadline(values) {
  if (!values.length) return null;
  const groups = groupConditionalFeeValues(values);
  const amountsText = joinWithOr(groups.map((g) => `${g.amountLabel} (${formatBranchCitations(g.branches)})`));
  const capTermRef = values[0].reit_limit_cap_term_ref;
  const operatorPhrase = conditionalOperatorPhrase(values[0].operator);
  return capTermRef ? `${operatorPhrase} ${amountsText} and the ${capTermRef} cap` : `${operatorPhrase} ${amountsText}`;
}

// Full-fidelity companion to the headline: every branch's formula, verbatim,
// for a reader who wants the exact defined-term chain and citations rather
// than the summarised prose. Nothing is grouped or dropped here.
function conditionalFeeAmountsEvidence(values) {
  return values.map((value) => clone(value));
}

// One synthetic governed card per fee side (SELLER -> TERMF-TARGET,
// BUYER -> TERMF-REVERSE), seeded from conditional_termination_fee_values
// rather than from resolution.resolved -- these values are not modelled as
// claims tied to a provision_instance_id, so they cannot flow through
// project()'s normal per-claim loop below. The provisionId is content-
// addressed (deal + side), so it is stable across runs and cannot collide
// with a real provision_instance_id. Evidence quotes are the ACTUAL
// defined-term formula text (raw_formula), deduped -- the truest citation
// available for "why does this row say what it says".
function conditionalFeeCardSeed(dealId, side, values) {
  const meta = CONDITIONAL_FEE_SIDES[side];
  if (!meta || !values.length) return null;
  const provisionId = contentId('CANONICAL_V2_CONDITIONAL_TERMINATION_FEE_CARD/V1', { deal_id: dealId, fee_side: side });
  const sectionMatch = /^\d+(?:\.\d+)*/.exec(values[0].triggering_branch || '');
  const features = {};
  addFeature(features, meta.feeKey, { amount: conditionalFeeHeadline(values), triggers: [] });
  addFeature(features, 'conditionalFeeAmounts', conditionalFeeAmountsEvidence(values));
  return {
    provisionId,
    conceptKey: meta.concept,
    excerptId: `native-conditional-fee:${provisionId}`,
    sectionRef: sectionMatch ? sectionMatch[0] : null,
    quotes: [...new Set(values.map((v) => v.raw_formula).filter(Boolean))],
    features,
    claimRevisionIds: values.map((v) => v.conditional_termination_fee_value_id).filter(Boolean),
    claimDefinitionKeys: ['CONDITIONAL_TERMINATION_FEE_VALUE'],
  };
}

function project({ resolution, dealId, family, definitions, evidenceSurfaces, codeFor, featuresFor, type, projectionName, extraGroups }) {
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
  // Synthetic seeds (today: conditional termination-fee values -- see
  // conditionalFeeCardSeed above) that are not claims tied to a
  // provision_instance_id, so they cannot flow through the loop above. Each
  // seed owns a content-addressed provisionId that cannot collide with a
  // real one, so this never merges into, or overwrites, a claim-derived
  // group -- it can only ever add a new one.
  for (const seed of (extraGroups || [])) {
    if (!seed || groups.has(seed.provisionId)) continue;
    groups.set(seed.provisionId, {
      provisionId: seed.provisionId,
      conceptKey: seed.conceptKey,
      excerptId: seed.excerptId,
      sectionRef: seed.sectionRef,
      quotes: [...(seed.quotes || [])],
      features: {},
      claimRevisionIds: [...(seed.claimRevisionIds || [])],
      claimDefinitionKeys: [...(seed.claimDefinitionKeys || [])],
    });
    const seedGroup = groups.get(seed.provisionId);
    for (const [key, value] of Object.entries(seed.features || {})) mergeFeature(seedGroup.features, key, value);
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

// dealId is validated defensively here too (not just inside project()) so an
// invalid deal_id can never reach contentId() inside conditionalFeeCardSeed
// -- an invalid deal_id still surfaces project()'s existing clear TypeError,
// unchanged, rather than a confusing failure from this seeding step.
function conditionalFeeExtraGroups(resolution, dealId) {
  if (typeof dealId !== 'string' || !dealId) return [];
  const values = Array.isArray(resolution?.conditional_termination_fee_values)
    ? resolution.conditional_termination_fee_values
    : [];
  const bySide = new Map();
  for (const value of values) {
    if (!value || !CONDITIONAL_FEE_SIDES[value.fee_side]) continue;
    if (!bySide.has(value.fee_side)) bySide.set(value.fee_side, []);
    bySide.get(value.fee_side).push(value);
  }
  return [...bySide.entries()]
    .map(([side, sideValues]) => conditionalFeeCardSeed(dealId, side, sideValues))
    .filter(Boolean);
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
    extraGroups: conditionalFeeExtraGroups(resolution, dealId),
  });
}

module.exports = {
  EVIDENCE_SOURCE,
  FEE_EVIDENCE_SURFACES,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  RIGHT_EVIDENCE_SURFACES,
  conditionalFeeHeadline,
  formatBranchCitations,
  waveBEvidenceFeatures,
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
};
