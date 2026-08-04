'use strict';

const { domainDigest } = require('./bytes');
const {
  COMPLETION_RATIFICATION,
  PROPOSAL_STATE,
  compileP9AcceptanceEvidenceInventory,
  validateP9AcceptanceEvidenceInventory,
} = require('./p9-acceptance-evidence-inventory');
const {
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS,
} = require('./p9-acceptance-definition-authority');

const SCHEMA_VERSION = 'P9AcceptanceEvidenceEngineeringQueue/V1';
const QUEUE_ID_DOMAIN = 'PROGRAMME_GATE_P9_ACCEPTANCE_EVIDENCE_ENGINEERING_QUEUE/V1';
const QUEUE_STATE = 'PROPOSAL_ONLY_UNIMPLEMENTED_NO_EXECUTION_AUTHORITY';

const PARTITIONS = Object.freeze([
  Object.freeze({
    queue_group_id: 'M3_CORPUS_CERTIFICATION',
    phase: 'M3',
    gate_ids: Object.freeze(CURRENT_LIVE_P9_GATE_IDS.slice(0, 15)),
  }),
  Object.freeze({
    queue_group_id: 'M4_PRODUCTION_IMPORT',
    phase: 'M4',
    gate_ids: Object.freeze(CURRENT_LIVE_P9_GATE_IDS.slice(15, 18)),
  }),
  Object.freeze({
    queue_group_id: 'LIVE_CUTOVER',
    phase: 'CUTOVER',
    gate_ids: Object.freeze(CURRENT_LIVE_P9_GATE_IDS.slice(18, 21)),
  }),
  Object.freeze({
    queue_group_id: 'COMPLETION_CANDIDATE',
    phase: 'COMPLETION',
    gate_ids: Object.freeze([COMPLETION_GATE_ID]),
  }),
]);

function sameOrder(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function queuePayload(queue) {
  return {
    schema_version: queue.schema_version,
    queue_state: queue.queue_state,
    source_inventory_id: queue.source_inventory_id,
    source_inventory_digest: queue.source_inventory_digest,
    source_definition_proposal_binding: queue.source_definition_proposal_binding,
    groups: queue.groups,
  };
}

function groupFromInventory(partition, inventory) {
  const byGateId = new Map(inventory.leaves.map((leaf) => [leaf.gate_id, leaf]));
  return Object.freeze({
    queue_group_id: partition.queue_group_id,
    phase: partition.phase,
    execution_authority: 'NONE',
    items: Object.freeze(partition.gate_ids.map((gateId) => {
      const leaf = byGateId.get(gateId);
      if (!leaf) throw new Error(`P9 engineering queue leaf is missing: ${gateId}`);
      return Object.freeze({
        gate_id: gateId,
        work_state: 'UNIMPLEMENTED_PROPOSAL_QUEUE_ONLY',
        missing_mechanism: leaf.missing_mechanism,
        implementation_state: leaf.implementation_state,
        required_user_decision: leaf.required_user_decision,
        source_inventory_digest: inventory.inventory_digest,
        source_definition_proposal_layer_id: inventory.definition_proposal_binding.definition_proposal_layer_id,
      });
    })),
  });
}

function buildP9AcceptanceEvidenceEngineeringQueue({ p9GateIds, repositoryRoot } = {}) {
  const inventory = compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot });
  validateP9AcceptanceEvidenceInventory(inventory, { p9GateIds, repositoryRoot });
  const queue = {
    schema_version: SCHEMA_VERSION,
    queue_id: '0'.repeat(64),
    queue_digest: '0'.repeat(64),
    queue_state: QUEUE_STATE,
    source_inventory_id: inventory.inventory_id,
    source_inventory_digest: inventory.inventory_digest,
    source_definition_proposal_binding: inventory.definition_proposal_binding,
    groups: Object.freeze(PARTITIONS.map((partition) => groupFromInventory(partition, inventory))),
  };
  const digest = domainDigest(QUEUE_ID_DOMAIN, queuePayload(queue));
  queue.queue_id = digest;
  queue.queue_digest = digest;
  return Object.freeze(queue);
}

function validateP9AcceptanceEvidenceEngineeringQueue(queue, { p9GateIds, repositoryRoot } = {}) {
  const expected = buildP9AcceptanceEvidenceEngineeringQueue({ p9GateIds, repositoryRoot });
  if (!queue || typeof queue !== 'object' || Array.isArray(queue)
    || queue.schema_version !== SCHEMA_VERSION
    || queue.queue_state !== QUEUE_STATE
    || queue.queue_id !== expected.queue_id
    || queue.queue_digest !== expected.queue_digest
    || queue.source_inventory_id !== expected.source_inventory_id
    || queue.source_inventory_digest !== expected.source_inventory_digest
    || JSON.stringify(queue.source_definition_proposal_binding) !== JSON.stringify(expected.source_definition_proposal_binding)
    || !Array.isArray(queue.groups)
    || queue.groups.length !== PARTITIONS.length
    || JSON.stringify(queuePayload(queue)) !== JSON.stringify(queuePayload(expected))) {
    throw new Error('P9 acceptance evidence engineering queue is not fail-closed');
  }
  for (const [index, group] of queue.groups.entries()) {
    const partition = PARTITIONS[index];
    if (!group || group.queue_group_id !== partition.queue_group_id
      || group.phase !== partition.phase
      || group.execution_authority !== 'NONE'
      || !Array.isArray(group.items)
      || !sameOrder(group.items.map((item) => item.gate_id), partition.gate_ids)
      || group.items.some((item) => item.work_state !== 'UNIMPLEMENTED_PROPOSAL_QUEUE_ONLY'
        || item.implementation_state !== 'RECOVERY_SCAFFOLD_ONLY_NO_GATE_MECHANISM'
        || item.source_inventory_digest !== queue.source_inventory_digest
        || item.source_definition_proposal_layer_id !== queue.source_definition_proposal_binding.definition_proposal_layer_id
        || typeof item.missing_mechanism !== 'string'
        || item.missing_mechanism.length === 0)) {
      throw new Error(`P9 acceptance evidence engineering queue group ${partition.queue_group_id} is not fail-closed`);
    }
  }
  const completion = queue.groups.at(-1).items[0];
  if (completion.gate_id !== COMPLETION_GATE_ID
    || completion.required_user_decision !== COMPLETION_RATIFICATION) {
    throw new Error('P9 completion candidate is not pending ratification');
  }
  return true;
}

module.exports = {
  PARTITIONS,
  QUEUE_ID_DOMAIN,
  QUEUE_STATE,
  SCHEMA_VERSION,
  buildP9AcceptanceEvidenceEngineeringQueue,
  queuePayload,
  validateP9AcceptanceEvidenceEngineeringQueue,
};
