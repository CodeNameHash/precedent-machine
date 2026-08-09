'use strict';

/**
 * lib/canonical-v2/open-world-promotion-gate.js
 *
 * PLAN.md Step 2X-G / DECISIONS.md §14–§15: open-world → governed promotion
 * is gated on corpus RECURRENCE IN DEALS (three or four), not a percentage;
 * plus a confidence check; plus a fail-closed collision check against
 * concepts we already govern (including the Step 2X-J CONSUME set).
 *
 * A percentage is the wrong instrument for a concept that surfaces a
 * handful of times — at seven deals one recurrence is 14%. Ben ruled
 * 2026-08-08: promote at three or four deals with confidence + collision.
 *
 * This module does NOT invent taxonomy. It answers "may this candidate be
 * promoted?" Fail-closed: any collision, HOLD scaffold, or under-threshold
 * recurrence refuses. Callers that land a promotion still own the
 * vocabulary/resolver edit and the replay proof.
 *
 * Related: lib/expected-sets.js holds the older V1 provision-code expected-
 * set machinery (core/common/rare fractions). 2X-G reuses the corpus-
 * growth idea but replaces the fraction thresholds with absolute deal
 * counts for open-world shapes.
 */

const fs = require('fs');
const path = require('path');

/** Ben: promote at three or four deals — floor is three. */
const MIN_PROMOTION_DEAL_COUNT = 3;
/** Prefer four when available; never treat a percentage as the gate. */
const PREFERRED_PROMOTION_DEAL_COUNT = 4;

/**
 * Step 2X-B HOLD scaffolds (DECISIONS.md §15). Promotion must not travel
 * through these relaxed patterns — they stay report-only until a corpus
 * pass with quotes is reviewed.
 */
const HOLD_SCAFFOLD_MODULES = Object.freeze([
  'lib/vocab/guaranty-assertion-legacy.js',
  'lib/vocab/tax-cooperation-legacy.js',
  'lib/vocab/general-covenant-rubric-presentation.js',
]);

/**
 * Confidence levels for a promotion candidate. HIGH requires corroborating
 * quotes on every counted deal and a single stable identity key.
 */
const CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  REJECT: 'REJECT',
});

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v != null && v !== ''))].sort();
}

/**
 * Parse Step 2X-J disposition markdown for vocabulary names marked CONSUME.
 * Fail-closed: if the file is missing or unparseable, returns an empty set
 * and callers must treat "unknown governed set" as a collision risk only
 * when an explicit governed_concept_key / claim_definition_key is supplied.
 */
function loadStep2xJConsumeVocabularies({
  dispositionsPath = path.join(
    __dirname,
    '..',
    '..',
    'docs',
    'codex-program',
    'notes',
    'step-2x-j-vocabulary-dispositions.md',
  ),
} = {}) {
  if (!fs.existsSync(dispositionsPath)) {
    return Object.freeze({
      ok: false,
      reason: 'STEP_2X_J_DISPOSITIONS_MISSING',
      consume: Object.freeze(new Set()),
      path: dispositionsPath,
    });
  }
  const text = fs.readFileSync(dispositionsPath, 'utf8');
  const consume = new Set();
  // Table rows: | `NAME` | ... | **CONSUME** | ...
  for (const line of text.split('\n')) {
    if (!line.includes('**CONSUME**')) continue;
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) consume.add(m[1]);
  }
  return Object.freeze({
    ok: true,
    reason: null,
    consume: Object.freeze(consume),
    path: dispositionsPath,
  });
}

/**
 * Confidence from deal recurrence + quote coverage + identity stability.
 * Does not itself authorise promotion — evaluatePromotionGate does.
 */
function assessPromotionConfidence({
  deal_ids = [],
  quotes_by_deal = {},
  identity_keys = [],
} = {}) {
  const deals = uniqueSorted(deal_ids);
  const identities = uniqueSorted(identity_keys);
  const dealsWithQuotes = deals.filter((d) => {
    const quotes = quotes_by_deal[d];
    return Array.isArray(quotes) && quotes.some((q) => typeof q === 'string' && q.trim().length > 0);
  });

  if (deals.length < MIN_PROMOTION_DEAL_COUNT) {
    return Object.freeze({
      level: CONFIDENCE.REJECT,
      reason: 'BELOW_MIN_DEAL_RECURRENCE',
      deal_count: deals.length,
      deals_with_quotes: dealsWithQuotes.length,
      identity_count: identities.length,
    });
  }
  if (identities.length !== 1) {
    return Object.freeze({
      level: CONFIDENCE.REJECT,
      reason: identities.length === 0 ? 'MISSING_IDENTITY' : 'UNSTABLE_IDENTITY',
      deal_count: deals.length,
      deals_with_quotes: dealsWithQuotes.length,
      identity_count: identities.length,
    });
  }
  if (dealsWithQuotes.length < deals.length) {
    return Object.freeze({
      level: CONFIDENCE.LOW,
      reason: 'INCOMPLETE_QUOTE_COVERAGE',
      deal_count: deals.length,
      deals_with_quotes: dealsWithQuotes.length,
      identity_count: identities.length,
    });
  }
  if (deals.length >= PREFERRED_PROMOTION_DEAL_COUNT) {
    return Object.freeze({
      level: CONFIDENCE.HIGH,
      reason: 'PREFERRED_DEAL_RECURRENCE_WITH_QUOTES',
      deal_count: deals.length,
      deals_with_quotes: dealsWithQuotes.length,
      identity_count: identities.length,
    });
  }
  return Object.freeze({
    level: CONFIDENCE.MEDIUM,
    reason: 'MIN_DEAL_RECURRENCE_WITH_QUOTES',
    deal_count: deals.length,
    deals_with_quotes: dealsWithQuotes.length,
    identity_count: identities.length,
  });
}

/**
 * Fail-closed collision check.
 *
 * A promotion that TARGETS an already-governed concept (synonym widen /
 * ungating a held value into its registered claim definition) is NOT a
 * collision — that is the intended compounding win. A collision is proposing
 * a NEW concept key / vocabulary name that duplicates something 2X-J already
 * marks CONSUME, or routing through a 2X-B HOLD scaffold.
 */
function checkPromotionCollision({
  proposed_concept_key = null,
  proposed_vocabulary_name = null,
  target_governed_concept_key = null,
  target_claim_definition_key = null,
  promotion_mechanism = null,
  consume_vocabularies = null,
} = {}) {
  if (HOLD_SCAFFOLD_MODULES.includes(promotion_mechanism)) {
    return Object.freeze({
      ok: false,
      reason: 'HOLD_SCAFFOLD_MECHANISM',
      detail: promotion_mechanism,
    });
  }
  if (typeof promotion_mechanism === 'string'
    && /guaranty-assertion-legacy|tax-cooperation-legacy|general-covenant-rubric-presentation/.test(promotion_mechanism)) {
    return Object.freeze({
      ok: false,
      reason: 'HOLD_SCAFFOLD_MECHANISM',
      detail: promotion_mechanism,
    });
  }

  const consume = consume_vocabularies || loadStep2xJConsumeVocabularies().consume;

  // New vocabulary name that 2X-J already owns as CONSUME → refuse duplicate.
  if (proposed_vocabulary_name && consume.has(proposed_vocabulary_name) && !target_governed_concept_key) {
    return Object.freeze({
      ok: false,
      reason: 'COLLIDES_WITH_2X_J_CONSUME',
      detail: proposed_vocabulary_name,
    });
  }

  // Proposing a fresh concept key that equals an already-governed target
  // without declaring the target is a silent rename collision.
  if (proposed_concept_key && target_governed_concept_key
    && proposed_concept_key !== target_governed_concept_key) {
    return Object.freeze({
      ok: false,
      reason: 'CONCEPT_KEY_MISMATCH',
      detail: `${proposed_concept_key} != ${target_governed_concept_key}`,
    });
  }

  // Synonym / ungate into an existing governed slot: require the target.
  if (!target_governed_concept_key && !target_claim_definition_key && proposed_concept_key) {
    // Novel concept proposal — allowed only when it does not collide with CONSUME names.
    if (consume.has(proposed_concept_key)) {
      return Object.freeze({
        ok: false,
        reason: 'COLLIDES_WITH_2X_J_CONSUME',
        detail: proposed_concept_key,
      });
    }
  }

  return Object.freeze({ ok: true, reason: null, detail: null });
}

/**
 * Full gate evaluation for one open-world promotion candidate.
 *
 * @param {object} candidate
 * @param {string[]} candidate.deal_ids
 * @param {object} candidate.quotes_by_deal — deal_id → string[]
 * @param {string[]} candidate.identity_keys — stable shape id (e.g. reason+value)
 * @param {string|null} candidate.proposed_concept_key
 * @param {string|null} candidate.proposed_vocabulary_name
 * @param {string|null} candidate.target_governed_concept_key
 * @param {string|null} candidate.target_claim_definition_key
 * @param {string|null} candidate.promotion_mechanism — module path that would land it
 * @param {Set<string>|null} candidate.consume_vocabularies — inject for tests
 */
function evaluatePromotionGate(candidate = {}) {
  const deals = uniqueSorted(candidate.deal_ids || []);
  const confidence = assessPromotionConfidence({
    deal_ids: deals,
    quotes_by_deal: candidate.quotes_by_deal || {},
    identity_keys: candidate.identity_keys || [],
  });
  const collision = checkPromotionCollision({
    proposed_concept_key: candidate.proposed_concept_key || null,
    proposed_vocabulary_name: candidate.proposed_vocabulary_name || null,
    target_governed_concept_key: candidate.target_governed_concept_key || null,
    target_claim_definition_key: candidate.target_claim_definition_key || null,
    promotion_mechanism: candidate.promotion_mechanism || null,
    consume_vocabularies: candidate.consume_vocabularies || null,
  });

  const dealOk = deals.length >= MIN_PROMOTION_DEAL_COUNT;
  const confidenceOk = confidence.level === CONFIDENCE.HIGH || confidence.level === CONFIDENCE.MEDIUM;
  const ok = dealOk && confidenceOk && collision.ok === true;

  return Object.freeze({
    ok,
    deal_count: deals.length,
    deals,
    min_deal_count: MIN_PROMOTION_DEAL_COUNT,
    preferred_deal_count: PREFERRED_PROMOTION_DEAL_COUNT,
    confidence,
    collision,
    refusals: Object.freeze([
      ...(!dealOk ? ['BELOW_MIN_DEAL_RECURRENCE'] : []),
      ...(!confidenceOk ? [`CONFIDENCE_${confidence.level}`] : []),
      ...(!collision.ok ? [collision.reason] : []),
    ]),
  });
}

module.exports = Object.freeze({
  MIN_PROMOTION_DEAL_COUNT,
  PREFERRED_PROMOTION_DEAL_COUNT,
  HOLD_SCAFFOLD_MODULES,
  CONFIDENCE,
  loadStep2xJConsumeVocabularies,
  assessPromotionConfidence,
  checkPromotionCollision,
  evaluatePromotionGate,
});
