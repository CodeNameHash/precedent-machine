/**
 * lib/schema/topology-detector.js
 *
 * Classifies an ordered list of transaction steps into a deal topology.
 * Pure derivation over caller-supplied steps — no filesystem, no network.
 *
 * Step 2X-F (PLAN.md / DECISIONS.md §14):
 * - No matched pattern must yield UNDETERMINED, never a silent SINGLE_MERGER.
 * - DOUBLE_DUMMY requires a HoldCo signal; skywater/topbuild-shaped chains
 *   without HoldCo are REVERSE_TRIANGULAR_THEN_LLC.
 * - Explicitly simultaneous dual mergers (Modiv UPREIT) are PARALLEL_MERGERS.
 * - FORWARD_TRIANGULAR / REVERSE_TRIANGULAR remain reachable only via
 *   opts.singleStepTopology — no caller invents them from step_kind alone.
 */

'use strict';

const TOPOLOGIES = Object.freeze({
  SINGLE_MERGER: 'SINGLE_MERGER',
  FORWARD_TRIANGULAR: 'FORWARD_TRIANGULAR',
  REVERSE_TRIANGULAR: 'REVERSE_TRIANGULAR',
  TWO_STEP_TENDER: 'TWO_STEP_TENDER',
  DOUBLE_DUMMY: 'DOUBLE_DUMMY',
  REVERSE_TRIANGULAR_THEN_LLC: 'REVERSE_TRIANGULAR_THEN_LLC',
  PARALLEL_MERGERS: 'PARALLEL_MERGERS',
  MULTI_STEP_REORG: 'MULTI_STEP_REORG',
  UNDETERMINED: 'UNDETERMINED',
  OTHER: 'OTHER',
});

const CONCURRENCY = Object.freeze({
  SEQUENTIAL: 'SEQUENTIAL',
  PARALLEL: 'PARALLEL',
});

function sortedSteps(steps) {
  return [...(steps || [])].filter(Boolean).sort((a, b) => Number(a.step_order) - Number(b.step_order));
}

function stepsAreParallel(ordered, opts = {}) {
  if (opts.parallel === true) return true;
  if (ordered.length < 2) return false;
  return ordered.some((step) => step.concurrency === CONCURRENCY.PARALLEL);
}

function hasHoldCoSignal(ordered, opts = {}) {
  if (opts.holdCo === true) return true;
  return ordered.some((step) => /\bholdco\b/i.test(String(step.parent_entity || '')));
}

function deriveTopology(steps, opts = {}) {
  const ordered = sortedSteps(steps);
  const stepCount = ordered.length;
  if (stepCount === 0) {
    return {
      topology: TOPOLOGIES.UNDETERMINED,
      step_count: 0,
      primary_step_order: null,
      topology_needs_review: true,
      review_note: opts.reviewNote || 'No transaction steps detected.',
    };
  }
  if (stepCount >= 3) {
    return {
      topology: TOPOLOGIES.MULTI_STEP_REORG,
      step_count: stepCount,
      primary_step_order: ordered[0].step_order,
      topology_needs_review: Boolean(opts.needsReview),
      review_note: opts.reviewNote || null,
    };
  }
  if (stepCount === 2) {
    const kinds = ordered.map((s) => s.step_kind);
    if (stepsAreParallel(ordered, opts)) {
      return {
        topology: TOPOLOGIES.PARALLEL_MERGERS,
        step_count: stepCount,
        primary_step_order: ordered[0].step_order,
        topology_needs_review: Boolean(opts.needsReview),
        review_note: opts.reviewNote || null,
      };
    }
    if (kinds[0] === 'TENDER_OFFER' && kinds[1] === 'BACK_END_MERGER') {
      return {
        topology: TOPOLOGIES.TWO_STEP_TENDER,
        step_count: stepCount,
        primary_step_order: ordered[1].step_order,
        topology_needs_review: Boolean(opts.needsReview),
        review_note: opts.reviewNote || null,
      };
    }
    if (kinds[0] === 'MERGER' && kinds[1] === 'SUBSEQUENT_MERGER') {
      // Ben 2026-08-08: double dummy is real, but skywater/topbuild have no
      // HoldCo — they are reverse-triangular-then-LLC-conversion.
      const topology = hasHoldCoSignal(ordered, opts)
        ? TOPOLOGIES.DOUBLE_DUMMY
        : TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC;
      return {
        topology,
        step_count: stepCount,
        primary_step_order: ordered[0].step_order,
        topology_needs_review: Boolean(opts.needsReview),
        review_note: opts.reviewNote || null,
      };
    }
    return {
      topology: TOPOLOGIES.MULTI_STEP_REORG,
      step_count: stepCount,
      primary_step_order: ordered[0].step_order,
      topology_needs_review: true,
      review_note: opts.reviewNote || 'Two transaction steps do not match a known two-step pattern.',
    };
  }
  // Exactly one step. Prefer an explicit single-step topology when the caller
  // can distinguish forward vs reverse triangular; otherwise SINGLE_MERGER.
  // Callers that cannot affirm a merger must pass zero steps → UNDETERMINED.
  return {
    topology: opts.singleStepTopology || TOPOLOGIES.SINGLE_MERGER,
    step_count: 1,
    primary_step_order: ordered[0].step_order,
    topology_needs_review: Boolean(opts.needsReview),
    review_note: opts.reviewNote || null,
  };
}

function assertConsecutiveSteps(steps) {
  const ordered = sortedSteps(steps);
  for (let i = 0; i < ordered.length; i += 1) {
    const expected = i + 1;
    if (Number(ordered[i].step_order) !== expected) {
      throw new Error(`transaction_steps invariant failed: step_order must be consecutive starting at 1; expected ${expected}, got ${ordered[i].step_order}`);
    }
  }
}

function stepChainingWarnings(steps) {
  const ordered = sortedSteps(steps);
  const warnings = [];
  if (stepsAreParallel(ordered)) return warnings;
  for (let i = 1; i < ordered.length; i += 1) {
    const prior = ordered[i - 1];
    const current = ordered[i];
    const priorSurvivor = String(prior.surviving_entity || '').trim().toLowerCase();
    const currentDisappearing = String(current.disappearing_entity || '').trim().toLowerCase();
    const parent = String(current.parent_entity || prior.parent_entity || '').trim().toLowerCase();
    if (!priorSurvivor || !currentDisappearing) continue;
    if (priorSurvivor === currentDisappearing) continue;
    if (parent && currentDisappearing.includes(parent)) continue;
    warnings.push(`Step ${current.step_order} does not clearly chain from step ${prior.step_order}.`);
  }
  return warnings;
}

function enforceTransactionStepInvariants(steps, topologyRow = null) {
  const ordered = sortedSteps(steps);
  const topology = topologyRow || deriveTopology(ordered);
  if (ordered.length === 0) {
    if (topology.topology === TOPOLOGIES.UNDETERMINED) {
      return { warnings: [] };
    }
    throw new Error('transaction_steps invariant failed: at least one step required');
  }
  assertConsecutiveSteps(ordered);
  if (topology.topology === TOPOLOGIES.SINGLE_MERGER && ordered.length !== 1) {
    throw new Error('deal_topology invariant failed: SINGLE_MERGER cannot have multiple steps');
  }
  if (topology.topology === TOPOLOGIES.DOUBLE_DUMMY && ordered.length !== 2) {
    throw new Error('deal_topology invariant failed: DOUBLE_DUMMY must have two steps');
  }
  if (topology.topology === TOPOLOGIES.REVERSE_TRIANGULAR_THEN_LLC && ordered.length !== 2) {
    throw new Error('deal_topology invariant failed: REVERSE_TRIANGULAR_THEN_LLC must have two steps');
  }
  if (topology.topology === TOPOLOGIES.PARALLEL_MERGERS && ordered.length !== 2) {
    throw new Error('deal_topology invariant failed: PARALLEL_MERGERS must have two steps');
  }
  if (topology.topology === TOPOLOGIES.TWO_STEP_TENDER) {
    const kinds = ordered.map((s) => s.step_kind).join(',');
    if (kinds !== 'TENDER_OFFER,BACK_END_MERGER') {
      throw new Error('deal_topology invariant failed: TWO_STEP_TENDER must be TENDER_OFFER then BACK_END_MERGER');
    }
  }
  if (topology.topology === TOPOLOGIES.UNDETERMINED) {
    throw new Error('deal_topology invariant failed: UNDETERMINED cannot carry resolved steps');
  }
  return { warnings: stepChainingWarnings(ordered) };
}

function labelForTopology(topology) {
  const labels = {
    SINGLE_MERGER: 'Single-step merger',
    FORWARD_TRIANGULAR: 'Forward triangular merger',
    REVERSE_TRIANGULAR: 'Reverse triangular merger',
    TWO_STEP_TENDER: 'Two-step tender',
    DOUBLE_DUMMY: 'Double-dummy reorg',
    REVERSE_TRIANGULAR_THEN_LLC: 'Reverse triangular then LLC conversion',
    PARALLEL_MERGERS: 'Parallel / simultaneous mergers',
    MULTI_STEP_REORG: 'Multi-step reorg',
    UNDETERMINED: 'Undetermined topology',
    OTHER: 'Other topology',
  };
  return labels[topology] || 'Other topology';
}

module.exports = {
  TOPOLOGIES,
  CONCURRENCY,
  deriveTopology,
  enforceTransactionStepInvariants,
  labelForTopology,
  sortedSteps,
  stepChainingWarnings,
};
