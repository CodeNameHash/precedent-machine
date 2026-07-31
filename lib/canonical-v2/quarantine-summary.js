// lib/canonical-v2/quarantine-summary.js
//
// Quarantine state (validateCanonicalWriteSet / validateResolvedCanonicalWriteSet's
// `quarantines` / `residuals` output, see lib/canonical-v2/validate-write-set.js) is
// currently only visible inside the validator's return value at write time -- it is
// not persisted to a queryable table (canonical-writer.js's `writeQuarantine` only
// stages quarantine rows in the in-memory/staging transaction used during a write;
// there is no durable, indexable quarantine store today). This module turns that
// buried state into a small, stable, standing summary so callers (an admin surface,
// a script, a test) can report "how much is quarantined right now" without knowing
// the validator's internal shape.
//
// Pure and deterministic: no I/O, no DB, no randomness. Given the same
// validationResult, always returns the same summary.

/**
 * @param {object} [validationResult] - the return value of
 *   validateCanonicalWriteSet / validateResolvedCanonicalWriteSet:
 *   { quarantines: [{ quarantine_id, reason_code, closure_id,
 *       affected_objects: [{ kind, object_id, source_object }], residual_ids }],
 *     residuals: [{ residual_id, reason_code, closure_id, ... }], ... }
 *   Any missing/malformed field is treated as empty -- this never throws.
 * @returns {{
 *   quarantined_closure_count: number,
 *   quarantined_row_count: number,
 *   residual_reason_counts: Record<string, number>,
 *   affected_object_ids: string[],
 * }}
 */
function summariseQuarantine(validationResult) {
  const quarantines = Array.isArray(validationResult && validationResult.quarantines)
    ? validationResult.quarantines
    : [];
  const residuals = Array.isArray(validationResult && validationResult.residuals)
    ? validationResult.residuals
    : [];

  let quarantined_row_count = 0;
  const seenObjectIds = new Set();
  const affected_object_ids = [];

  for (const quarantine of quarantines) {
    const affectedObjects = Array.isArray(quarantine && quarantine.affected_objects)
      ? quarantine.affected_objects
      : [];
    quarantined_row_count += affectedObjects.length;
    for (const affected of affectedObjects) {
      const objectId = affected && affected.object_id;
      if (objectId === undefined || objectId === null || seenObjectIds.has(objectId)) continue;
      seenObjectIds.add(objectId);
      affected_object_ids.push(objectId);
    }
  }

  const residual_reason_counts = {};
  for (const residual of residuals) {
    const reasonCode = (residual && residual.reason_code) || 'UNKNOWN';
    residual_reason_counts[reasonCode] = (residual_reason_counts[reasonCode] || 0) + 1;
  }

  return {
    quarantined_closure_count: quarantines.length,
    quarantined_row_count,
    residual_reason_counts,
    affected_object_ids,
  };
}

module.exports = { summariseQuarantine };
