'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildP9AcceptanceEvidenceEngineeringQueue,
  validateP9AcceptanceEvidenceEngineeringQueue,
} = require('../../lib/programme-gates/p9-acceptance-evidence-engineering-queue');
const {
  compileP9AcceptanceEvidenceInventory,
  loadLiveP9GateIds,
} = require('../../lib/programme-gates/p9-acceptance-evidence-inventory');
const {
  OUTPUT_DIRECTORY,
  buildAndWriteP9AcceptanceEvidence,
  writeContentAddressedP9AcceptanceEvidence,
} = require('../../lib/programme-gates/p9-acceptance-evidence-inventory-writer');

const ROOT = path.resolve(__dirname, '../..');

function temporaryDurableRoot() {
  return fs.mkdtempSync(path.join(ROOT, '.p9-evidence-writer-'));
}

function sourceBundle() {
  const p9GateIds = loadLiveP9GateIds({ repositoryRoot: ROOT });
  return {
    p9GateIds,
    inventory: compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot: ROOT }),
    queue: buildP9AcceptanceEvidenceEngineeringQueue({ p9GateIds, repositoryRoot: ROOT }),
  };
}

test('generates one bounded queue with 15 M3, 3 M4, 3 live-cutover and one completion candidate item', () => {
  const { p9GateIds, queue } = sourceBundle();
  assert.equal(validateP9AcceptanceEvidenceEngineeringQueue(queue, { p9GateIds, repositoryRoot: ROOT }), true);
  assert.deepEqual(queue.groups.map((group) => [group.queue_group_id, group.items.length]), [
    ['M3_CORPUS_CERTIFICATION', 15],
    ['M4_PRODUCTION_IMPORT', 3],
    ['LIVE_CUTOVER', 3],
    ['COMPLETION_CANDIDATE', 1],
  ]);
  assert.ok(queue.groups.every((group) => group.execution_authority === 'NONE'));
  assert.ok(queue.groups.flatMap((group) => group.items).every((item) => (
    item.work_state === 'UNIMPLEMENTED_PROPOSAL_QUEUE_ONLY'
  )));
  assert.equal(queue.source_definition_proposal_binding.live_record_count, 21);
  assert.equal(queue.source_definition_proposal_binding.completion_candidate_count, 1);
  assert.equal(queue.source_definition_proposal_binding.predicate_authority, 'NONE');
  const changedDefinitionProposal = structuredClone(queue);
  changedDefinitionProposal.source_definition_proposal_binding.definition_proposal_layer_id = '0'.repeat(64);
  assert.throws(
    () => validateP9AcceptanceEvidenceEngineeringQueue(changedDefinitionProposal, { p9GateIds, repositoryRoot: ROOT }),
    /not fail-closed/i,
  );
});

test('atomically writes proposal-only inventory and queue beneath an explicit durable root', () => {
  const root = temporaryDurableRoot();
  try {
    const { p9GateIds, inventory, queue } = sourceBundle();
    const first = writeContentAddressedP9AcceptanceEvidence({
      artifact_root: root,
      repository_root: ROOT,
      p9_gate_ids: p9GateIds,
      inventory,
      engineering_queue: queue,
    });
    assert.equal(first.status, 'WRITTEN');
    assert.equal(first.output_directory, path.join(root, OUTPUT_DIRECTORY));
    assert.ok(fs.existsSync(first.inventory.output_path));
    assert.ok(fs.existsSync(first.engineering_queue.output_path));
    const second = buildAndWriteP9AcceptanceEvidence({ artifact_root: root, repository_root: ROOT });
    assert.equal(second.status, 'ALREADY_PRESENT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('refuses a content-address collision and stale source or implementation bindings', () => {
  const root = temporaryDurableRoot();
  try {
    const { p9GateIds, inventory, queue } = sourceBundle();
    const directory = path.join(root, OUTPUT_DIRECTORY);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `inventory-${inventory.inventory_id}.json`), '{"different":true}\n');
    assert.throws(
      () => writeContentAddressedP9AcceptanceEvidence({
        artifact_root: root,
        repository_root: ROOT,
        p9_gate_ids: p9GateIds,
        inventory,
        engineering_queue: queue,
      }),
      { code: 'CONTENT_ADDRESS_COLLISION' },
    );
    const stale = structuredClone(inventory);
    stale.leaves[0].existing_implementation_citations[0].source.source_sha256 = '0'.repeat(64);
    assert.throws(
      () => writeContentAddressedP9AcceptanceEvidence({
        artifact_root: root,
        repository_root: ROOT,
        p9_gate_ids: p9GateIds,
        inventory: stale,
        engineering_queue: queue,
      }),
      /stale|fail-closed/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('writer has no predicate, provider, extraction, database or production authority', () => {
  const source = fs.readFileSync(path.join(
    ROOT,
    'lib/programme-gates/p9-acceptance-evidence-inventory-writer.js',
  ), 'utf8');
  for (const forbidden of ['acceptance_predicate', 'createCodex', 'produceCandidate', 'fetch(', 'supabase', 'INSERT INTO', 'activate_candidate_release']) {
    assert.equal(source.includes(forbidden), false, `writer must not include ${forbidden}`);
  }
});
