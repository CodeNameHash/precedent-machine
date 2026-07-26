const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  AUTHORITY_SCOPE,
  MAX_CARRIER_BYTES,
  RELATIONSHIP_SPECS,
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity,
  validateRelationshipSpecTopology,
} = require('../lib/canonical-v2/qxo-no-shop-definition-relationships-f8');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-definition-relationships-f8.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-relationships-f8-staging-attestation.json';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-qxo-no-shop-definition-relations-f8.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_bindings: {},
    notice_occurrence: {},
    definition_occurrences: [],
    source_party_context: {},
    relationship_outcomes: [],
    notice_revision_materialisation: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_definition_relationships_f8_id: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F8 relationship carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(
      changed,
    ),
    /identity has drifted/i,
  );

  const oversizedBody = {
    ...first,
    status: { retained: 'x'.repeat(MAX_CARRIER_BYTES) },
  };
  delete oversizedBody.qxo_no_shop_definition_relationships_f8_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_definition_relationships_f8_id: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(
      oversized,
    ),
    /exceeds its byte limit/i,
  );
});

test('staging pins the exact inactive F8 contract and immutable QXO lineage', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    'dd0f1d4afc02492edf1bbbebe1a6699498fd6c3d26d890254a151b1d8c7d0a80',
  );
  assert.equal(
    attestation.contract_binding.definition_effect_schema,
    'USES_DEFINITION_EFFECT/V2',
  );
  assert.equal(
    attestation.contract_binding.notice_schema_definition_id,
    'dc5a18df6d7e858bab742c9e7d7b04bb80429f1901e7a0a0144b8f689e56ec9b',
  );
  assert.equal(
    attestation.source_binding.document_hash,
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
  );
  assert.equal(
    attestation.upstream_bindings
      .qxo_no_shop_notice_review_materialisation_f7_id,
    '2d934013aba6d7571559696ecc2f0e063100798b2fea256e5804111dd9d3abba',
  );
});

test('F8 mints the stable notice and two neutral definition occurrences', () => {
  const attestation = fixture();
  assert.equal(
    attestation.notice_occurrence.notice_obligation_occurrence_id,
    '5bfba36963af3a1baec65d09a4fa479e21889ab522f66aaca89de348839c7440',
  );
  assert.deepEqual(
    [
      attestation.notice_occurrence.exact_source_span.absolute_start,
      attestation.notice_occurrence.exact_source_span.absolute_end,
    ],
    [207783, 208859],
  );
  assert.deepEqual(attestation.notice_occurrence.party, {
    role: 'COVENANT_OBLIGOR',
    value: 'COMPANY',
    capacity: 'TARGET',
  });
  assert.deepEqual(
    attestation.definition_occurrences.map((entry) => [
      entry.definition_key,
      entry.exact_declaration_span.absolute_start,
      entry.exact_declaration_span.absolute_end,
      entry.ordered_body_spans[0].absolute_start,
      entry.ordered_body_spans[0].absolute_end,
    ]),
    [
      ['COMPANY_REQUEST', 208354, 208369, 208020, 208349],
      ['COMPANY_ACQUISITION_PROPOSAL', 211573, 211601, 211611, 212793],
    ],
  );
  for (const occurrence of attestation.definition_occurrences) {
    assert.match(occurrence.neutral_definition_key, /^[a-f0-9]{64}$/);
    assert.notEqual(occurrence.neutral_definition_key, occurrence.definition_key);
  }
});

test('all seven exact uses map once to the correct legal role and endpoint field', () => {
  const relationships = fixture().relationships;
  assert.equal(relationships.length, 7);
  assert.deepEqual(
    relationships.map((entry) => [
      entry.governed_ordinal,
      entry.raw_use_form,
      entry.legal_role_code,
      entry.affected_endpoint.endpoint_kind,
      entry.affected_endpoint.affected_field_key,
    ]),
    [
      [
        207988,
        'Company Acquisition Proposal',
        'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'content_requirement_codes',
      ],
      [
        208321,
        'Company Acquisition Proposal',
        'NESTED_DEFINITION_DEPENDENCY',
        'DEFINITION_OCCURRENCE',
        'nested_definition_dependency',
      ],
      [
        208505,
        'Company Acquisition Proposal',
        'OPERATIVE_TRIGGER',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'trigger_expression',
      ],
      [
        208541,
        'Company Request',
        'OPERATIVE_TRIGGER',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'trigger_expression',
      ],
      [
        208683,
        'Company Requests',
        'OPERATIVE_OBLIGATION_OBJECT',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'copy_subject_codes',
      ],
      [
        208759,
        'Company Acquisition Proposal',
        'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'copy_subject_codes',
      ],
      [
        208830,
        'Company Acquisition Proposal',
        'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
        'NOTICE_OBLIGATION_OCCURRENCE',
        'copy_subject_codes',
      ],
    ],
  );
  assert.equal(new Set(
    relationships.map((entry) => entry.relationship_occurrence_id),
  ).size, 7);
  assert.equal(new Set(
    relationships.map((entry) => entry.relationship_effect_revision_id),
  ).size, 7);
  assert.deepEqual(
    relationships.map((entry) => entry.source_predecessor_review_resolution_ids),
    RELATIONSHIP_SPECS.map(
      (spec) => [...spec.upstream_review_resolution_ids].sort(),
    ),
  );
});

test('the nested definition is one relationship and only Company Request uses depend on it', () => {
  const byOrdinal = new Map(fixture().relationships.map(
    (entry) => [entry.governed_ordinal, entry],
  ));
  const nested = byOrdinal.get(208321);
  assert.equal(
    fixture().relationships.filter(
      (entry) => entry.governed_ordinal === 208321,
    ).length,
    1,
  );
  assert.deepEqual(nested.recursive_dependency_relationship_ids, []);
  assert.deepEqual(
    byOrdinal.get(208541).recursive_dependency_relationship_ids,
    [nested.relationship_effect_revision_id],
  );
  assert.deepEqual(
    byOrdinal.get(208683).recursive_dependency_relationship_ids,
    [nested.relationship_effect_revision_id],
  );
  for (const ordinal of [207988, 208505, 208759, 208830]) {
    assert.deepEqual(
      byOrdinal.get(ordinal).recursive_dependency_relationship_ids,
      [],
    );
  }
});

test('dependency topology rejects missing, self and forward targets instead of erasing them', () => {
  assert.equal(validateRelationshipSpecTopology(), true);
  for (const dependencyStart of [208320, 208541, 208759]) {
    const changed = RELATIONSHIP_SPECS.map((spec) => ({
      ...spec,
      recursive_dependency_start: spec.absolute_start === 208541
        ? dependencyStart
        : spec.recursive_dependency_start,
    }));
    assert.throws(
      () => validateRelationshipSpecTopology(changed),
      /invalid dependency target/i,
    );
  }
});

test('the plural use stays source-local and carries every required evidence role', () => {
  const plural = fixture().relationships.find(
    (entry) => entry.governed_ordinal === 208683,
  );
  assert.equal(
    plural.use_form_code,
    'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
  );
  assert.deepEqual(
    Object.keys(plural.evidence_by_role).sort(),
    [
      'DEFINITION_BODY',
      'DEFINITION_DECLARATION',
      'EXACT_USE',
      'PLURAL_RESOLUTION',
    ],
  );
  assert.equal(
    fixture().materialisation_status.plural_resolution_scope,
    'THIS_QXO_SOURCE_USE_ONLY',
  );
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  assert.match(moduleSource, /alias_authority: 'NONE'/);
  assert.match(moduleSource, /party_transfer: 'NONE'/);
  assert.match(
    moduleSource,
    /QXO_NO_SHOP_REVIEWED_DEFINITION_USE_BINDING_F6\/V1/,
  );
  assert.match(
    moduleSource,
    /QXO_NO_SHOP_DEFINITION_DEPENDENCY_EDGE_F6\/V1/,
  );
  assert.match(
    moduleSource,
    /QXO_NO_SHOP_REVIEWED_PLURAL_DEFINITION_USE_F6\/V1/,
  );
});

test('definition precedence ambiguity blocks comparison and notice publication', () => {
  const attestation = fixture();
  for (const relationship of attestation.relationships) {
    assert.equal(
      relationship.definition_precedence_review,
      'BLOCKING_CONFLICT_OR_OVERRIDE_UNRESOLVED',
    );
    assert.equal(
      relationship.interpretation_clarity_state,
      'REASONABLE_BUT_AMBIGUOUS',
    );
    assert.deepEqual(
      relationship.ambiguity_dimension_codes,
      ['DEFINITION_PRECEDENCE'],
    );
    assert.equal(
      relationship.comparison_state,
      'BLOCKED_DEFINITION_PRECEDENCE_UNRESOLVED',
    );
    assert.equal(
      relationship.publication_state,
      'REVIEW_ONLY_NOT_PUBLISHABLE',
    );
  }
  assert.equal(
    attestation.notice_revision_materialisation.notice_obligation_revision_id,
    null,
  );
  assert.equal(
    attestation.notice_revision_materialisation
      .definition_use_relationship_ids.length,
    7,
  );
  assert.equal(attestation.materialisation_status.review_renderable, true);
  assert.equal(attestation.materialisation_status.publication_blocked, true);
  assert.equal(attestation.materialisation_status.comparison_blocked, true);
  for (const key of [
    'absence_authority',
    'canonical_write_authority',
    'relationship_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(attestation.materialisation_status[key], 'NONE', key);
  }
  assert.equal(attestation.materialisation_status.release_eligible, false);
});

test('relationship failures are isolated and the staging proof remains one bounded read', () => {
  const attestation = fixture();
  assert.equal(attestation.carrier_drift_rejected, true);
  assert.equal(attestation.failure_isolation_verified, true);

  const runner = fs.readFileSync(RUNNER, 'utf8');
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  assert.match(runner, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.doesNotMatch(
    runner,
    /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|UPSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i,
  );

  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(
    moduleSource,
    /(?:supabase|canonical-writer|candidate-release|serving-projection|lib\/query)/i,
  );
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  for (const denied of [
    'lib/canonical-v2/contract-bundle.js',
    'lib/canonical-v2/canonical-writer.js',
    'lib/canonical-v2/candidate-release.js',
    'lib/canonical-v2/serving-projection.js',
    'sql/**',
    'supabase/**',
  ]) {
    assert.equal(allowlist.denied.includes(denied), true, denied);
  }
});
