const test = require('node:test');
const assert = require('node:assert/strict');

const { summariseQuarantine } = require('../lib/canonical-v2/quarantine-summary');

function residual({ residualId, closureId, reasonCode }) {
  return {
    residual_id: residualId,
    closure_id: closureId,
    reason_code: reasonCode,
    contract_key: null,
    upstream_residual: null,
    source_object: {},
  };
}

function quarantine({ quarantineId, closureId, affectedObjects, residualIds }) {
  return {
    quarantine_id: quarantineId,
    reason_code: 'UNRESOLVED_RESIDUAL',
    closure_id: closureId,
    affected_objects: affectedObjects,
    residual_ids: residualIds,
  };
}

test('summariseQuarantine counts a mixed validation result correctly', () => {
  // Two quarantined closures (three affected rows total, two residual reason
  // codes) plus a clean/publishable closure that never shows up in
  // `quarantines`/`residuals` -- mirroring validateCanonicalWriteSet's output
  // shape, where only unresolved closures produce residuals/quarantines.
  const validationResult = {
    accepted: true,
    publishableWriteSet: { deal: {}, provisions: [{ id: 'clean-provision-1' }] },
    residuals: [
      residual({ residualId: 'res-1', closureId: 'closure-a', reasonCode: 'INVALID_TAXONOMY_CODE' }),
      residual({ residualId: 'res-2', closureId: 'closure-a', reasonCode: 'INVALID_TAXONOMY_CODE' }),
      residual({ residualId: 'res-3', closureId: 'closure-b', reasonCode: 'EVIDENCE_REFERENCE_UNRESOLVED' }),
    ],
    quarantines: [
      quarantine({
        quarantineId: 'quarantine-a',
        closureId: 'closure-a',
        affectedObjects: [
          { kind: 'provisions', object_id: 'provision-1', source_object: {} },
          { kind: 'components', object_id: 'component-1', source_object: {} },
        ],
        residualIds: ['res-1', 'res-2'],
      }),
      quarantine({
        quarantineId: 'quarantine-b',
        closureId: 'closure-b',
        affectedObjects: [
          { kind: 'claims', object_id: 'claim-1', source_object: {} },
        ],
        residualIds: ['res-3'],
      }),
    ],
    quarantinedClosureIds: ['closure-a', 'closure-b'],
    counts: { publishable: 1, residuals: 3, quarantinedClosures: 2 },
  };

  const summary = summariseQuarantine(validationResult);

  assert.deepEqual(summary, {
    quarantined_closure_count: 2,
    quarantined_row_count: 3,
    residual_reason_counts: {
      INVALID_TAXONOMY_CODE: 2,
      EVIDENCE_REFERENCE_UNRESOLVED: 1,
    },
    affected_object_ids: ['provision-1', 'component-1', 'claim-1'],
  });
});

test('summariseQuarantine dedupes an object_id affected by more than one quarantine', () => {
  const validationResult = {
    residuals: [
      residual({ residualId: 'res-1', closureId: 'closure-a', reasonCode: 'UNKNOWN_ATTRIBUTE' }),
    ],
    quarantines: [
      quarantine({
        quarantineId: 'quarantine-a',
        closureId: 'closure-a',
        affectedObjects: [
          { kind: 'provisions', object_id: 'shared-1', source_object: {} },
          { kind: 'provisions', object_id: 'shared-1', source_object: {} },
        ],
        residualIds: ['res-1'],
      }),
    ],
  };

  const summary = summariseQuarantine(validationResult);

  assert.equal(summary.quarantined_row_count, 2);
  assert.deepEqual(summary.affected_object_ids, ['shared-1']);
});

test('summariseQuarantine returns zeroes, not errors, for a clean validation result', () => {
  const validationResult = {
    accepted: true,
    publishableWriteSet: { deal: {}, provisions: [] },
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
    counts: { publishable: 0, residuals: 0, quarantinedClosures: 0 },
  };

  assert.deepEqual(summariseQuarantine(validationResult), {
    quarantined_closure_count: 0,
    quarantined_row_count: 0,
    residual_reason_counts: {},
    affected_object_ids: [],
  });
});

test('summariseQuarantine handles undefined/malformed input without throwing', () => {
  assert.deepEqual(summariseQuarantine(undefined), {
    quarantined_closure_count: 0,
    quarantined_row_count: 0,
    residual_reason_counts: {},
    affected_object_ids: [],
  });
  assert.deepEqual(summariseQuarantine({}), {
    quarantined_closure_count: 0,
    quarantined_row_count: 0,
    residual_reason_counts: {},
    affected_object_ids: [],
  });
  assert.deepEqual(summariseQuarantine({ quarantines: null, residuals: null }), {
    quarantined_closure_count: 0,
    quarantined_row_count: 0,
    residual_reason_counts: {},
    affected_object_ids: [],
  });
});

test('summariseQuarantine is deterministic across repeated calls on the same input', () => {
  const validationResult = {
    residuals: [
      residual({ residualId: 'res-1', closureId: 'closure-a', reasonCode: 'STATE_DETAIL_REQUIRED' }),
    ],
    quarantines: [
      quarantine({
        quarantineId: 'quarantine-a',
        closureId: 'closure-a',
        affectedObjects: [{ kind: 'claims', object_id: 'claim-9', source_object: {} }],
        residualIds: ['res-1'],
      }),
    ],
  };

  const first = summariseQuarantine(validationResult);
  const second = summariseQuarantine(validationResult);
  assert.deepEqual(first, second);
});
