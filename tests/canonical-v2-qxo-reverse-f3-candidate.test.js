const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  QXO_REVERSE_F3_CONTRACT_FINGERPRINT,
  QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
  QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS,
  QXO_RICH_DEAL_DIMENSIONS,
  QXO_RICH_DEAL_DIMENSIONS_DIGEST,
  QXO_SELLER_TERMINATION_REVIEWED_MAPPING_ID,
  buildQxoReverseCombinedCandidateSeed,
  buildQxoReverseF4CombinedCandidateSeed,
  qxoReverseCombinedCandidateReleaseId,
  qxoReverseF4CombinedCandidateReleaseId,
  qxoReverseF4CombinedServingNamespaceId,
} = require('../lib/canonical-v2/qxo-reverse-candidate-identity');
const {
  buildQxoReverseF3AuthorityGenesis,
} = require('../lib/canonical-v2/qxo-reverse-f3-authority');
const {
  buildQxoReverseF3Candidate,
} = require('../lib/canonical-v2/qxo-reverse-f3-candidate');
const {
  buildQxoReverseF4AuthorityGenesis,
} = require('../lib/canonical-v2/qxo-reverse-f4-authority');
const {
  QXO_MATERIAL_REVIEWED_MAPPING_ID,
} = require('../lib/canonical-v2/qxo-material-candidate-identity');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');

const BUYER_MAPPING_ID = 'f'.repeat(64);
const SELLER_MAPPING_ID = 'e'.repeat(64);

function f3Seed(overrides = {}) {
  return buildQxoReverseCombinedCandidateSeed({
    contractFingerprint: QXO_REVERSE_F3_CONTRACT_FINGERPRINT,
    materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
    sellerTerminationReviewedMappingId: QXO_SELLER_TERMINATION_REVIEWED_MAPPING_ID,
    reverseTerminationReviewedMappingId: BUYER_MAPPING_ID,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
    servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
    queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    ...overrides,
  });
}

function f4Seed(overrides = {}) {
  return buildQxoReverseF4CombinedCandidateSeed({
    contractFingerprint: QXO_REVERSE_F4_CONTRACT_FINGERPRINT,
    materialReviewedMappingId: QXO_MATERIAL_REVIEWED_MAPPING_ID,
    sellerTerminationReviewedMappingId: SELLER_MAPPING_ID,
    reverseTerminationReviewedMappingId: BUYER_MAPPING_ID,
    dealDimensions: QXO_RICH_DEAL_DIMENSIONS,
    servingProjectionVersion: SERVING_PROJECTION_VERSION_V2,
    queryProjectionContractDigest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    ...overrides,
  });
}

test('rejected F3 identity remains deterministic historical evidence', () => {
  const first = f3Seed();
  assert.equal(canonicalJson(first), canonicalJson(f3Seed()));
  assert.equal(first.schema_version, 'QXO_REVERSE_F3_COMBINED_CANDIDATE_SEED/V1');
  assert.equal(first.contract_fingerprint, QXO_REVERSE_F3_CONTRACT_FINGERPRINT);
  assert.equal(first.deal_dimension_profile_digest, QXO_RICH_DEAL_DIMENSIONS_DIGEST);
  assert.ok(QXO_REVERSE_PRIOR_SEMANTIC_CLOSURE_IDS.includes(
    '6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2',
  ));
  assert.match(qxoReverseCombinedCandidateReleaseId(first), /^[a-f0-9]{64}$/);
});

test('F3 can never be regenerated or published after failed legal review', () => {
  assert.throws(
    () => buildQxoReverseF3Candidate(),
    /failed adversarial legal review/,
  );
  const script = fs.readFileSync(
    path.resolve(__dirname, '../scripts/canonical-v2-staging-qxo-reverse-f3.mjs'),
    'utf8',
  );
  assert.match(script, /failed adversarial legal review/);
  assert.doesNotMatch(script, /canonical_v2_import_candidate_release/);
});

test('F4 identity binds the rejected predecessor without mutating it', () => {
  const first = f4Seed();
  const second = f4Seed();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.schema_version, 'QXO_REVERSE_F4_COMBINED_CANDIDATE_SEED/V1');
  assert.equal(first.contract_fingerprint, QXO_REVERSE_F4_CONTRACT_FINGERPRINT);
  assert.equal(first.predecessor_contract_fingerprint, QXO_REVERSE_F3_CONTRACT_FINGERPRINT);
  assert.equal(
    first.rejected_predecessor_semantic_closure_id,
    QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  );
  assert.ok(
    QXO_REVERSE_F4_PRIOR_SEMANTIC_CLOSURE_IDS.includes(
      QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
    ),
  );
  assert.match(qxoReverseF4CombinedCandidateReleaseId(first), /^[a-f0-9]{64}$/);
  assert.match(qxoReverseF4CombinedServingNamespaceId(first), /^[a-f0-9]{64}$/);
  assert.notEqual(
    qxoReverseF4CombinedCandidateReleaseId(first),
    qxoReverseF4CombinedCandidateReleaseId(f4Seed({
      reverseTerminationReviewedMappingId: 'd'.repeat(64),
    })),
  );
});

test('F4 identity refuses contract, predecessor family and deal-dimension drift', () => {
  assert.throws(
    () => f4Seed({ contractFingerprint: QXO_REVERSE_F3_CONTRACT_FINGERPRINT }),
    /F4 versioned contract/,
  );
  assert.throws(
    () => f4Seed({ materialReviewedMappingId: '0'.repeat(64) }),
    /reviewed material-contract mapping/,
  );
  assert.throws(
    () => f4Seed({ dealDimensions: { ...QXO_RICH_DEAL_DIMENSIONS, sector: 'Industrials' } }),
    /reviewed rich QXO dimensions/,
  );
  assert.throws(
    () => f4Seed({ servingProjectionVersion: 'canonical-v2-serving/v1' }),
    /frozen v2 serving contract/,
  );
});

test('F3 and F4 correction authorities are separate immutable generations', () => {
  const f3 = buildQxoReverseF3AuthorityGenesis();
  const f4 = buildQxoReverseF4AuthorityGenesis();
  assert.equal(f3.candidate_input_head.generation, 1);
  assert.equal(f4.candidate_input_head.generation, 1);
  assert.notEqual(
    f3.candidate_input_head.candidate_input_head_id,
    f4.candidate_input_head.candidate_input_head_id,
  );
  assert.equal(
    f4.candidate_input_head.candidate_input_head_id,
    '5891c0424afd3eadda631b9a5cfdf37764e1d657bde91041ca9a13ad54655821',
  );
  assert.equal(
    f4.candidate_input_head.canonical_payload_digest,
    'f7325a655d34e761bd2a2040d5f42d91238ac51a5e5d50ea1b44fd70619bf57f',
  );
  assert.equal(
    f4.receipt.receiptId,
    '217705cb474748bd414516ec66df30eb7b139abd6b0977c3d84b1a18cb426d28',
  );
});

test('generated F4 packet is inactive-only and has the exact release shape', () => {
  const root = path.resolve(__dirname, '..');
  const script = fs.readFileSync(
    path.join(root, 'scripts/canonical-v2-staging-qxo-reverse-f4.mjs'),
    'utf8',
  );
  const builder = fs.readFileSync(
    path.join(root, 'lib/canonical-v2/qxo-reverse-f4-candidate.js'),
    'utf8',
  );
  const attestation = JSON.parse(fs.readFileSync(
    path.join(root, 'sql/qxo-reverse-f4/generated/ATTESTATION.json'),
    'utf8',
  ));
  const packet = fs.readdirSync(path.join(root, 'sql/qxo-reverse-f4/generated'))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => fs.readFileSync(
      path.join(root, 'sql/qxo-reverse-f4/generated', name),
      'utf8',
    ))
    .join('\n');
  const verifyBefore = fs.readFileSync(
    path.join(root, 'sql/qxo-reverse-f4/generated/03-verify-before.sql'),
    'utf8',
  );
  const verifyAfter = fs.readFileSync(
    path.join(root, 'sql/qxo-reverse-f4/generated/08-verify-after.sql'),
    'utf8',
  );
  const combined = [script, builder, packet].join('\n');

  assert.equal(attestation.status, 'GENERATED_INACTIVE_NOT_APPLIED');
  assert.equal(attestation.contract_fingerprint, QXO_REVERSE_F4_CONTRACT_FINGERPRINT);
  assert.deepEqual(
    {
      observations: attestation.observations,
      exclusions: attestation.exclusions,
      shared_rows: attestation.shared_rows,
      query_records: attestation.query_records,
      exact_detail_packages: attestation.exact_detail_packages,
    },
    {
      observations: 10,
      exclusions: 2,
      shared_rows: 11,
      query_records: 10,
      exact_detail_packages: 11,
    },
  );
  assert.equal(
    attestation.candidate_seed_digest,
    contentId('QXO_REVERSE_F4_COMBINED_CANDIDATE_SEED/V1', f4Seed({
      sellerTerminationReviewedMappingId: attestation.seller_reviewed_mapping_id
        || SELLER_MAPPING_ID,
      reverseTerminationReviewedMappingId: attestation.reverse_reviewed_mapping_id,
    })),
  );
  assert.match(builder, /compileFixtureContractV4/);
  assert.match(builder, /termination_fee_semantic_write_set/);
  assert.match(script, /QXO_TWO_SIDED_TERMINATION_FEE_F4_DEAL_SCOPE_V1/);
  assert.match(script, /MAX_IMPORT_PLAN_BYTES/);
  assert.match(script, /MAX_PACKET_BYTES/);
  assert.match(script, /canonical_payload=expected\.value/);
  assert.match(script, /candidate_release_correction_input_seals/);
  assert.match(script, /candidate_release_correction_discharges/);
  assert.match(script, /allowAbsent: true/);
  assert.match(
    packet,
    /canonical_v2_recheck_candidate_input_head[\s\S]*canonical_v2_write/,
  );
  const provisionAnchorClosures = verifyBefore.match(
    /FROM unnest\(ARRAY\[(.*?)\]::text\[\]\) required\(closure_id\)[\s\S]*required predecessor QXO semantic closure is missing/,
  );
  assert.ok(provisionAnchorClosures);
  assert.doesNotMatch(
    provisionAnchorClosures[1],
    /a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5/,
  );
  assert.match(
    verifyBefore,
    /shared predecessor semantic payload set mismatch: excerpts[\s\S]*a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5/,
  );
  const predecessorGate = verifyBefore.slice(
    verifyBefore.indexOf('shared predecessor semantic payload set mismatch: validated_semantic_graphs') - 1200,
    verifyBefore.indexOf('shared predecessor semantic payload set mismatch: quarantines') + 100,
  );
  assert.match(
    predecessorGate,
    /jsonb_array_elements[\s\S]*stored\.canonical_payload=expected\.value[\s\S]*stored\.canonical_payload_digest=canonical_v2_staging\.payload_digest\(expected\.value\)/,
  );
  assert.doesNotMatch(
    predecessorGate,
    /SELECT count\(\*\) FROM canonical_v2_staging\.(?:excerpts|provision_instances)[\s\S]*OR \(SELECT count\(\*\)[\s\S]*shared predecessor semantic payload set mismatch/,
  );
  assert.doesNotMatch(
    verifyAfter,
    /payload_digest\(expected\.value->'canonical_payload'\)/,
  );
  assert.match(
    verifyAfter,
    /JOIN canonical_v2_staging\.deal_serving_directory stored[\s\S]*stored\.application_deal_id=\(expected\.value->>'application_deal_id'\)::uuid[\s\S]*stored\.canonical_payload_digest=expected\.value->>'canonical_payload_digest'/,
  );
  assert.ok(attestation.transport_bounds.generated_sql_packet_bytes <= 6 * 1024 * 1024);
  assert.ok(
    Object.values(attestation.transport_bounds.generated_sql_file_bytes)
      .every((bytes) => bytes <= 1536 * 1024),
  );
  assert.doesNotMatch(combined, /activateCandidateRelease|canonical_v2_activate_candidate_release/);
  assert.doesNotMatch(combined, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(combined, /supabase\s+db\s+(?:push|query)/);
});

test('the F4 SQL executor is locked to the isolated staging project and bounded packet roots', () => {
  const root = path.resolve(__dirname, '..');
  const executor = fs.readFileSync(
    path.join(root, 'scripts/canonical-v2-staging-sql-executor.mjs'),
    'utf8',
  );
  assert.match(executor, /EXPECTED_STAGING_PROJECT_REF = 'sjumbznveyyiizhwvixj'/);
  assert.match(executor, /supabase',[\s\S]*'db', 'query', '--linked', '--file'/);
  assert.match(executor, /MAX_SQL_FILE_BYTES/);
  assert.match(executor, /MAX_SQL_PACKET_BYTES/);
  assert.match(executor, /realpathSync/);
  assert.doesNotMatch(executor, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(executor, /shell:\s*true/);
});
