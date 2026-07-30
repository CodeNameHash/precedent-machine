const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/process',
);

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const relationship = read(
  'relationships/process-relationship.v2.json',
);
const registry = read(
  'registries/process-controlled-code-registry.v2.json',
);

test('replaces both predecessor contracts with sole active v2 members', () => {
  assert.equal(
    fs.existsSync(path.join(
      ROOT,
      'relationships/process-relationship.v1.json',
    )),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(
      ROOT,
      'registries/process-controlled-code-registry.v1.json',
    )),
    false,
  );
  assert.equal(relationship.definition.logical_type_version, 2);
  assert.equal(registry.definition.registry_version, 2);
});

test('preserves the ProcessRelationship stable identity exactly', () => {
  assert.equal(
    relationship.definition.relationship_identity.stable_id_domain,
    'PROCESS_RELATIONSHIP/V1',
  );
  assert.deepEqual(
    relationship.definition.relationship_identity.stable_id_inputs,
    [
      'frozen_contract_pair_digest',
      'governed_deal_admission_id',
      'relationship_definition_key_and_version',
      'source_process_object_kind_and_id',
      'target_process_object_kind_and_id',
      'process_relationship_slot_key',
      'governed_ordinal',
    ],
  );
});

test('binds relationship revision v2 to stable endpoint records only', () => {
  const revision = relationship.definition.revision_identity;
  assert.equal(
    revision.revision_id_domain,
    'PROCESS_RELATIONSHIP_REVISION/V2',
  );
  assert.deepEqual(revision.immutable_inputs, [
    'evidence_edges',
    'process_relationship_id',
    'relationship_effect',
    'relationship_state',
    'relationship_type_code',
    'source_process_object_kind_and_id',
    'target_process_object_kind_and_id',
    'temporal_expression_revision_id',
  ]);
  assert.deepEqual(revision.prohibited_inputs, [
    'source_revision_id',
    'target_revision_id',
  ]);
  assert.equal(
    revision.endpoint_records_equal_validated_relationship_identity,
    true,
  );
  assert.equal(
    revision.endpoint_revisions_may_contain_relationship_revision_id,
    true,
  );
  assert.equal(
    revision.relationship_revision_may_contain_endpoint_revision_ids,
    false,
  );
});

test('governs one directed evidenced membership without semantic inference', () => {
  assert.deepEqual(
    relationship.definition.bidder_track_event_membership_contract,
    {
      relationship_type_code: 'BIDDER_TRACK_EVENT_MEMBERSHIP',
      source_logical_type: 'BidderTrack',
      source_definition_stable_id: 'BIDDER_TRACK',
      target_logical_type: 'ProcessEvent',
      target_definition_stable_id: 'PROCESS_EVENT',
      relationship_effect: {
        effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
      },
      relationship_state: 'PRESENT',
      one_membership_per_stable_track_event_pair: true,
      same_frozen_contract_pair_required: true,
      same_governed_deal_required: true,
      exact_evidence_edges_required: true,
      chronology_date_economics_names_or_labels_can_establish_membership:
        false,
    },
  );
});

test('registry v2 contains the exact closed relationship type set', () => {
  const relationshipTypes = registry.definition.process_owned_registries.find(
    (entry) => (
      entry.registry_stable_id === 'PROCESS_RELATIONSHIP_TYPE_REGISTRY'
    ),
  );
  assert.deepEqual(relationshipTypes.codes, [
    'AMENDMENT',
    'BIDDER_TRACK_EVENT_MEMBERSHIP',
    'CONTINUATION',
    'CROSS_REFERENCE',
    'RESPONSE',
    'RETELLING',
    'SUPERSESSION',
  ]);
});
