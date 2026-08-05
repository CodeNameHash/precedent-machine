'use strict';

const { canonicalJson } = require('./canonical-bytes');

const ANTITRUST_V1_SURFACE_DISPOSITION_SCHEMA = 'CANONICAL_V2_ANTITRUST_V1_SURFACE_DISPOSITION/V1';
const ANTITRUST_V1_CONTENT_ROUTING_SCHEMA = 'CANONICAL_V2_ANTITRUST_V1_CONTENT_ROUTING/V1';
const PRODUCTION_AUTHORITY = 'NONE';
const OPERATION_STATE = 'NOT_ACTIVE_TEST_ONLY';
const CURRENT_ANTITRUST_TARGETS = Object.freeze([
  'ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-AGREEMENTS', 'ANTI-FILING',
  'ANTI-STRATEGY', 'ANTI-CONSULT', 'ANTI-NOACTION', 'ANTI-COOPERATE', 'ANTI-INFO', 'ANTI-NOTIFY',
]);

const SURFACE_DISPOSITIONS = Object.freeze([
  Object.freeze({ v1_surface: 'ANTI-EFFORTS', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-COOPERATE']) }),
  Object.freeze({ v1_surface: 'ANTI-BURDEN', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-BURDEN', 'ANTI-LITIGATION']) }),
  Object.freeze({ v1_surface: 'ANTI-LITIGATION', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-LITIGATION', 'ANTI-BURDEN']) }),
  Object.freeze({ v1_surface: 'ANTI-TIMING', disposition: 'RETIRED_CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-AGREEMENTS']) }),
  Object.freeze({ v1_surface: 'ANTI-FILING', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-FILING']) }),
  Object.freeze({
    v1_surface: 'ANTI-FOREIGN',
    disposition: 'RETIRED_CONTENT_RECLASSIFY',
    governed_targets: Object.freeze(['ANTI-FILING', 'ANTI-STRATEGY', 'ANTI-COOPERATE', 'ANTI-INFO', 'ANTI-NOTIFY']),
    conditional_routes: Object.freeze([
      Object.freeze({ atomic_fact: 'NAMED_REGIME_FILING_OR_DEADLINE', target: 'ANTI-FILING' }),
      Object.freeze({ atomic_fact: 'REGULATORY_STRATEGY_CONTROL', target: 'ANTI-STRATEGY' }),
      Object.freeze({ atomic_fact: 'REGULATORY_COOPERATION', target: 'ANTI-COOPERATE' }),
      Object.freeze({ atomic_fact: 'REGULATORY_INFORMATION_SHARING', target: 'ANTI-INFO' }),
      Object.freeze({ atomic_fact: 'REGULATORY_NOTIFICATION', target: 'ANTI-NOTIFY' }),
    ]),
    residual_disposition: 'EXACT_OPEN_WORLD_EVIDENCE',
  }),
  Object.freeze({ v1_surface: 'ANTI-COOPERATE', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-COOPERATE', 'ANTI-STRATEGY', 'ANTI-CONSULT', 'ANTI-INFO', 'ANTI-NOTIFY']) }),
  Object.freeze({ v1_surface: 'ANTI-CONSULT', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-CONSULT', 'ANTI-NOTIFY']) }),
  Object.freeze({ v1_surface: 'ANTI-INFO', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-INFO']) }),
  Object.freeze({ v1_surface: 'ANTI-NOTIFY', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-NOTIFY', 'ANTI-CONSULT']) }),
  Object.freeze({ v1_surface: 'ANTI-NOACTION', disposition: 'CONTENT_RECLASSIFY', governed_targets: Object.freeze(['ANTI-NOACTION']) }),
  Object.freeze({
    v1_surface: 'ANTI-INTERIM',
    disposition: 'RETIRED_CONTENT_RECLASSIFY',
    governed_targets: Object.freeze(['ANTI-NOACTION', 'ANTI-BURDEN', 'ANTI-STRATEGY']),
    external_targets: Object.freeze(['EMPLOYEE_MATTERS', 'IOC']),
    conditional_routes: Object.freeze([
      Object.freeze({ atomic_fact: 'REGULATORY_NON_IMPEDIMENT', target: 'ANTI-NOACTION' }),
      Object.freeze({ atomic_fact: 'REGULATORY_REMEDY_OR_CLOSING_MECHANIC', target: 'ANTI-BURDEN' }),
      Object.freeze({ atomic_fact: 'REGULATORY_CONTROL_MECHANIC', target: 'ANTI-STRATEGY' }),
      Object.freeze({ atomic_fact: 'RULE_14D_10_EMPLOYEE_MECHANIC', target: 'EMPLOYEE_MATTERS' }),
      Object.freeze({ atomic_fact: 'UNRELATED_OPERATING_CONSENT', target: 'IOC' }),
    ]),
    residual_disposition: 'EXACT_OPEN_WORLD_EVIDENCE',
  }),
  Object.freeze({ v1_surface: 'UNCLASSIFIED_NULL_SUBTYPE', disposition: 'CONTENT_RECLASSIFY_OR_EXACT_OPEN_WORLD', governed_targets: CURRENT_ANTITRUST_TARGETS, residual_disposition: 'EXACT_OPEN_WORLD_EVIDENCE' }),
]);

function dispositionForV1Surface(v1Surface) {
  return SURFACE_DISPOSITIONS.find(({ v1_surface: surface }) => surface === v1Surface) || null;
}

function validateAntitrustV1SurfaceDispositions(dispositions = SURFACE_DISPOSITIONS) {
  if (!Array.isArray(dispositions)) throw new TypeError('dispositions must be an array');
  const expected = new Set(SURFACE_DISPOSITIONS.map(({ v1_surface: surface }) => surface));
  const observed = new Set();
  for (const entry of dispositions) {
    if (!entry || typeof entry !== 'object' || !expected.has(entry.v1_surface)) throw new Error('ANTITRUST_V1_SURFACE_UNKNOWN');
    if (observed.has(entry.v1_surface)) throw new Error('ANTITRUST_V1_SURFACE_DUPLICATE');
    observed.add(entry.v1_surface);
    if (!entry.disposition || !Array.isArray(entry.governed_targets)) throw new Error('ANTITRUST_V1_SURFACE_DISPOSITION_INCOMPLETE');
    const canonicalEntry = dispositionForV1Surface(entry.v1_surface);
    if (!canonicalEntry || canonicalJson(entry) !== canonicalJson(canonicalEntry)) throw new Error('ANTITRUST_V1_SURFACE_DISPOSITION_TAMPERED');
    if (['ANTI-FOREIGN', 'ANTI-INTERIM'].includes(entry.v1_surface)
      && (entry.residual_disposition !== 'EXACT_OPEN_WORLD_EVIDENCE'
        || !Array.isArray(entry.conditional_routes)
        || entry.conditional_routes.length === 0)) {
      throw new Error('ANTITRUST_V1_RETIRED_SURFACE_ROUTES_INCOMPLETE');
    }
  }
  if (observed.size !== expected.size) throw new Error('ANTITRUST_V1_SURFACE_DISPOSITION_MISSING');
  return Object.freeze({
    schema_version: ANTITRUST_V1_SURFACE_DISPOSITION_SCHEMA,
    authority_state: PRODUCTION_AUTHORITY,
    operation_state: OPERATION_STATE,
    surface_count: observed.size,
    inventory_complete: true,
  });
}

function sourceTextForCard(card) {
  const value = card?.region_full_text || card?.full_text || card?.primary_quote;
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('card must contain exact source text');
  return value;
}

function exactUncoveredSpans(sourceText, covered) {
  const spans = [];
  let index = 0;
  while (index < sourceText.length) {
    while (index < sourceText.length && covered[index]) index += 1;
    const start = index;
    while (index < sourceText.length && !covered[index]) index += 1;
    if (index > start) {
      const exactQuote = sourceText.slice(start, index);
      if (/\S/.test(exactQuote)) spans.push(Object.freeze({
        reason: 'UNCONSUMED_V1_CARD_TEXT',
        exact_quote: exactQuote,
        source_start: start,
        source_end: index,
      }));
    }
  }
  return spans;
}

function reclassifyAntitrustV1Card({ card, atomic_facts: atomicFacts = [] } = {}) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) throw new TypeError('card must be an object');
  if (!Array.isArray(atomicFacts)) throw new TypeError('atomic_facts must be an array');
  const sourceText = sourceTextForCard(card);
  const sourceSurface = typeof card.provision_subtype === 'string' && card.provision_subtype
    ? card.provision_subtype : 'UNCLASSIFIED_NULL_SUBTYPE';
  const disposition = dispositionForV1Surface(sourceSurface);
  if (!disposition) throw new Error('ANTITRUST_V1_SURFACE_UNKNOWN');
  const conditionalTargets = new Map((disposition.conditional_routes || []).map(({ atomic_fact: fact, target }) => [fact, target]));
  const allowedTargets = new Set([...(disposition.governed_targets || []), ...(disposition.external_targets || [])]);
  const covered = new Uint8Array(sourceText.length);
  const governedRoutes = atomicFacts.map((fact, ordinal) => {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) throw new TypeError('each atomic fact must be an object');
    const inferredTarget = conditionalTargets.get(fact.atomic_fact);
    const target = fact.target || inferredTarget;
    if (!target || !allowedTargets.has(target) || (inferredTarget && target !== inferredTarget)) throw new Error('ANTITRUST_V1_ATOMIC_ROUTE_NOT_ALLOWED');
    if (typeof fact.exact_quote !== 'string' || !fact.exact_quote) throw new Error('ANTITRUST_V1_ATOMIC_QUOTE_REQUIRED');
    const start = sourceText.indexOf(fact.exact_quote);
    if (start < 0) throw new Error('ANTITRUST_V1_ATOMIC_QUOTE_NOT_IN_SOURCE');
    covered.fill(1, start, start + fact.exact_quote.length);
    return Object.freeze({
      ordinal, atomic_fact: fact.atomic_fact || null, target,
      exact_quote: fact.exact_quote, source_start: start, source_end: start + fact.exact_quote.length,
    });
  });
  const exactOpenWorldResiduals = exactUncoveredSpans(sourceText, covered);
  return Object.freeze({
    schema_version: ANTITRUST_V1_CONTENT_ROUTING_SCHEMA,
    authority_state: PRODUCTION_AUTHORITY,
    operation_state: OPERATION_STATE,
    source_surface: sourceSurface,
    disposition: disposition.disposition,
    governed_routes: Object.freeze(governedRoutes),
    exact_open_world_residuals: Object.freeze(exactOpenWorldResiduals),
  });
}

module.exports = {
  ANTITRUST_V1_SURFACE_DISPOSITION_SCHEMA,
  ANTITRUST_V1_CONTENT_ROUTING_SCHEMA,
  CURRENT_ANTITRUST_TARGETS,
  OPERATION_STATE,
  PRODUCTION_AUTHORITY,
  SURFACE_DISPOSITIONS,
  dispositionForV1Surface,
  reclassifyAntitrustV1Card,
  validateAntitrustV1SurfaceDispositions,
};
