'use strict';

// PLAN.md Step 2B, the read half. Hermetic tests for
// lib/canonical-v2/local-staging-deal-reader.js -- no live Postgres
// connection, so this runs in ordinary `npm test`/CI. The stronger, live
// proof against a real local container with real written data (two real
// Modiv families, canonicalJson round trip through actual Postgres jsonb,
// the same synthetic fixture used here written durably instead of faked)
// is scripts/canonical-v2-local-staging-read-proof.js -- see
// docs/codex-program/notes/step-2b-read-half.md for its output.
//
// The fake client below implements exactly the query shapes this reader
// issues (WHERE canonical_payload->>'x' = $1, WHERE ... = ANY($1::text[]),
// and -- PLAN.md Step 2C1 -- WHERE document_hash = $1 against a real
// column, not a jsonb ->> extraction, for conditional_termination_fee_
// values) against an in-memory table of real rows produced by the real
// write-boundary code (buildNativeWriteSet, via
// tests/helpers/local-staging-read-fixture.js) -- so what is faked is the
// network/Postgres round trip, not the row shapes or the reassembly logic
// under test.

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  readDealFromLocalCanonicalV2Staging,
  readGovernedClaimsForDeal,
  readOpenWorldEvidenceForDeal,
  readRelationshipsForDeal,
  readConditionalTerminationFeeValuesForDeal,
  LocalStagingReadError,
  OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
} = require('../lib/canonical-v2/local-staging-deal-reader');
const { buildConditionalTerminationFeeValue } = require('../lib/canonical-v2/native-producer/conditional-termination-fee-value');
const { buildSyntheticMixedFixture } = require('./helpers/local-staging-read-fixture');

// A minimal fake of the one pg surface this reader uses: async
// query(text, values) -> { rows }. Dispatches on the table name named in
// the query text (every query this reader issues names exactly one table)
// and applies the same two predicate shapes the real SQL uses: equality on
// a top-level jsonb key, or ANY(array) membership on one.
function fakeClient(tables) {
  return {
    async query(text, values) {
      const tableMatch = /FROM canonical_v2_staging\.(\w+)/.exec(text);
      if (!tableMatch) throw new Error(`fake client cannot route query: ${text}`);
      const rows = tables[tableMatch[1]] || [];
      let field;
      let mode;
      // Real-column equality (no jsonb ->>' before the '=') must be checked
      // BEFORE the jsonb ->>'document_hash' = $1 shape below, or a real-
      // column query would match that regex too and route through the
      // wrong (payload-based) filter for a table that has no such payload
      // field to filter on.
      if (/(?<!')document_hash = \$1/.test(text)) { field = 'document_hash'; mode = 'eq'; } else if (/document_hash' = \$1/.test(text)) { field = 'document_hash'; mode = 'eq'; } else if (/parent_provision_instance_id' = ANY/.test(text)) { field = 'parent_provision_instance_id'; mode = 'any'; } else if (/closure_id = ANY/.test(text)) {
        // PLAN.md Step 2B3: claims are fetched by closure OR subject so that
        // an unresolvable subject actually reaches ORPHAN_CLAIM_REVISION.
        // The old form selected on the very ids it then checked against,
        // which made that guard structurally unreachable.
        const closures = values[0] || [];
        const subjects = values[1] || [];
        const matched = rows.filter((row) => closures.includes(row.closure_id)
          || subjects.includes(row.subject_occurrence_id));
        return { rows: matched.map((row) => ({ canonical_payload: row })) };
      } else if (/subject_occurrence_id' = ANY/.test(text)) { field = 'subject_occurrence_id'; mode = 'any'; } else if (/candidate_id' = ANY/.test(text)) { field = 'candidate_id'; mode = 'any'; } else if (/open_world_candidate_occurrence_id' = ANY/.test(text)) { field = 'open_world_candidate_occurrence_id'; mode = 'any'; } else if (/source_occurrence_id' = ANY/.test(text)) { field = 'source_occurrence_id'; mode = 'any'; } else {
        throw new Error(`fake client cannot route predicate: ${text}`);
      }
      const matched = mode === 'eq'
        ? rows.filter((row) => row[field] === values[0])
        : rows.filter((row) => values[0].includes(row[field]));
      // conditional_termination_fee_values is the one table where the
      // routing field (document_hash) is a real COLUMN, not part of
      // canonical_payload -- unlike every other table faked here, whose
      // routing field genuinely is inside the real payload. So its fake
      // rows carry { document_hash, payload } and only `payload` -- never
      // the wrapper -- is what a real `SELECT canonical_payload` would hand
      // back.
      if (tableMatch[1] === 'conditional_termination_fee_values') {
        return { rows: matched.map((row) => ({ canonical_payload: row.payload })) };
      }
      return { rows: matched.map((row) => ({ canonical_payload: row })) };
    },
  };
}

let fixture;
test.before(async () => {
  fixture = await buildSyntheticMixedFixture();
});

function tablesFromFixture() {
  const { writeSet } = fixture;
  return {
    provision_instances: writeSet.provisions,
    claim_revisions: writeSet.claims,
    excerpts: writeSet.excerpts,
    open_world_candidates: writeSet.open_world_candidates,
    open_world_candidate_occurrences: writeSet.open_world_candidate_occurrences,
    open_world_evidence_references: writeSet.open_world_evidence_references,
    relationship_revisions: [],
  };
}

test('readGovernedClaimsForDeal reassembles resolution.json-shaped resolved[] entries', async () => {
  const client = fakeClient(tablesFromFixture());
  const resolved = await readGovernedClaimsForDeal({ client, documentHash: fixture.documentHash });
  assert.equal(resolved.length, 1);
  const [entry] = resolved;
  assert.equal(entry.resolved_claim_definition_key, fixture.writeSet.claims[0].claim_definition_key);
  assert.equal(entry.concept_key, fixture.writeSet.provisions[0].concept_key);
  assert.equal(entry.provision_instance.provision_instance_id, fixture.writeSet.claims[0].subject_occurrence_id);
  assert.equal(canonicalJson(entry.claim), canonicalJson(fixture.writeSet.claims[0]));
  // Known gap, documented on the module: section_reference does not survive
  // the persisted write-set, so it must come back null, not fabricated.
  assert.equal(entry.section_reference, null);
});

test('readGovernedClaimsForDeal round-trips byte-identical through canonicalJson', async () => {
  const client = fakeClient(tablesFromFixture());
  const resolved = await readGovernedClaimsForDeal({ client, documentHash: fixture.documentHash });
  assert.equal(canonicalJson(resolved[0].claim), canonicalJson(fixture.writeSet.claims[0]));
  assert.equal(canonicalJson(resolved[0].provision_instance), canonicalJson(fixture.writeSet.provisions[0]));
});

test('readOpenWorldEvidenceForDeal returns the {candidate, occurrence, evidenceReferences} shape open-world-evidence-serving.js expects', async () => {
  const client = fakeClient(tablesFromFixture());
  const bundles = await readOpenWorldEvidenceForDeal({ client, documentHash: fixture.documentHash });
  assert.equal(bundles.length, 1);
  const [bundle] = bundles;
  assert.equal(bundle.candidate.candidate_id, fixture.writeSet.open_world_candidates[0].candidate_id);
  assert.equal(bundle.occurrence.candidate_id, bundle.candidate.candidate_id);
  assert.equal(bundle.evidenceReferences.length, fixture.writeSet.open_world_evidence_references.length);
  assert.ok(bundle.evidenceReferences.length > 0);
});

// The open-world-evidence-serving.js module IS the serving-side reader this
// task's brief names as already built; proving this reader's output feeds
// it directly (not a lookalike shape) is the strongest form of "the shape
// the projection modules already expect".
test('readOpenWorldEvidenceForDeal output feeds buildOpenWorldEvidenceCard directly, without adaptation', async () => {
  const { buildOpenWorldEvidenceCard } = require('../lib/canonical-v2/open-world-evidence-serving');
  const client = fakeClient(tablesFromFixture());
  const [bundle] = await readOpenWorldEvidenceForDeal({ client, documentHash: fixture.documentHash });
  const card = buildOpenWorldEvidenceCard(bundle);
  assert.equal(card.is_governed_claim, false);
  assert.equal(card.governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
});

test('readGovernedClaimsForDeal output feeds buildGovernedClaimSummaryCard directly, without adaptation', async () => {
  const { buildGovernedClaimSummaryCard } = require('../lib/canonical-v2/open-world-evidence-serving');
  const client = fakeClient(tablesFromFixture());
  const [entry] = await readGovernedClaimsForDeal({ client, documentHash: fixture.documentHash });
  const card = buildGovernedClaimSummaryCard(entry.claim);
  assert.equal(card.is_governed_claim, true);
});

// ── The governed/open-world distinction, proven both directions. ──

test('governed claims and open-world evidence come back distinguishable: the marker is present on one kind and absent on the other', async () => {
  const client = fakeClient(tablesFromFixture());
  const resolved = await readGovernedClaimsForDeal({ client, documentHash: fixture.documentHash });
  const bundles = await readOpenWorldEvidenceForDeal({ client, documentHash: fixture.documentHash });

  assert.equal(
    Object.prototype.hasOwnProperty.call(resolved[0].claim, 'evidence_governance'),
    false,
    'a governed claim must not carry the open-world marker',
  );
  for (const row of [bundles[0].candidate, bundles[0].occurrence, ...bundles[0].evidenceReferences]) {
    assert.equal(row.evidence_governance, OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER);
  }
});

test('readGovernedClaimsForDeal refuses a claim row that has been tampered to carry the open-world marker', async () => {
  const tables = tablesFromFixture();
  const tampered = { ...tables.claim_revisions[0], evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER };
  const client = fakeClient({ ...tables, claim_revisions: [tampered] });
  await assert.rejects(
    () => readGovernedClaimsForDeal({ client, documentHash: fixture.documentHash }),
    (err) => err.code === 'GOVERNED_ROW_CARRIES_OPEN_WORLD_MARKER',
  );
});

test('readOpenWorldEvidenceForDeal refuses a candidate row missing the open-world marker', async () => {
  const tables = tablesFromFixture();
  const { evidence_governance: _drop, ...untamperedShapeMissingMarker } = tables.open_world_candidates[0];
  const client = fakeClient({ ...tables, open_world_candidates: [untamperedShapeMissingMarker] });
  await assert.rejects(
    () => readOpenWorldEvidenceForDeal({ client, documentHash: fixture.documentHash }),
    (err) => err.code === 'MISSING_OPEN_WORLD_MARKER',
  );
});

// ── The empty-read guard: the specific failure this step exists to avoid. ──

test('readDealFromLocalCanonicalV2Staging throws rather than reporting success for a deal with no data', async () => {
  const client = fakeClient({
    provision_instances: [], claim_revisions: [], open_world_candidates: [],
    open_world_candidate_occurrences: [], open_world_evidence_references: [], relationship_revisions: [],
  });
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({ client, documentHash: 'no-such-document', env: { NODE_ENV: 'test' } }),
    (err) => err instanceof LocalStagingReadError && err.code === 'EMPTY_DEAL_READ',
  );
});

test('expectNonEmpty: false permits a genuinely empty deal without throwing', async () => {
  const client = fakeClient({
    provision_instances: [], claim_revisions: [], open_world_candidates: [],
    open_world_candidate_occurrences: [], open_world_evidence_references: [], relationship_revisions: [],
  });
  const result = await readDealFromLocalCanonicalV2Staging({
    client, documentHash: 'no-such-document', env: { NODE_ENV: 'test' }, expectNonEmpty: false,
  });
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.open_world, []);
});

test('readDealFromLocalCanonicalV2Staging does not report success when it silently found nothing for a real, known-populated document_hash queried under the wrong key', async () => {
  // Guards against the specific regression this step exists to prevent: a
  // reader whose join is broken (wrong field, wrong table) still returns
  // `{ resolved: [], ... }` -- a shape a careless caller could mistake for
  // "this deal has no data" instead of "this reader is broken". Querying by
  // a document_hash that is NOT the fixture's must still throw, proving the
  // guard is live rather than coincidentally satisfied by the empty-table case above.
  const client = fakeClient(tablesFromFixture());
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({
      client, documentHash: 'deadbeef-not-a-real-document-hash', env: { NODE_ENV: 'test' },
    }),
    (err) => err instanceof LocalStagingReadError && err.code === 'EMPTY_DEAL_READ',
  );
});

test('readDealFromLocalCanonicalV2Staging succeeds and returns non-empty for the real document_hash', async () => {
  const client = fakeClient(tablesFromFixture());
  const result = await readDealFromLocalCanonicalV2Staging({
    client, documentHash: fixture.documentHash, env: { NODE_ENV: 'test' },
  });
  assert.equal(result.resolved.length, 1);
  assert.equal(result.open_world.length, 1);
});

// ── Fails closed in a production-shaped runtime, and never even queries. ──

test('refuses to run in a production-shaped environment, without issuing any query', async () => {
  const client = {
    query: async () => { throw new Error('must not be called in production'); },
  };
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({
      client, documentHash: fixture.documentHash, env: { NODE_ENV: 'production' },
    }),
    (err) => err instanceof LocalStagingReadError && err.code === 'RUNTIME_NOT_PERMITTED',
  );
  await assert.rejects(
    () => readDealFromLocalCanonicalV2Staging({
      client, documentHash: fixture.documentHash, env: { VERCEL: '1', VERCEL_ENV: 'production' },
    }),
    (err) => err instanceof LocalStagingReadError && err.code === 'RUNTIME_NOT_PERMITTED',
  );
});

test('permits a Vercel preview environment, the same as every other Canonical V2 serving source', async () => {
  const client = fakeClient(tablesFromFixture());
  const result = await readDealFromLocalCanonicalV2Staging({
    client, documentHash: fixture.documentHash, env: { VERCEL: '1', VERCEL_ENV: 'preview' },
  });
  assert.equal(result.resolved.length, 1);
});

// ── Relationships: implemented, unit-tested against a synthetic row. No
// importable run in this project's committed baseline publishes any
// relationship rows (verified directly -- see this module's header), so
// there is nothing durable to prove this against yet; this is coverage for
// the code path, not a claim that it has been proven against a real run. ──

test('readRelationshipsForDeal joins relationship_revisions onto provision_instances via source_occurrence_id', async () => {
  const tables = tablesFromFixture();
  const provisionId = tables.provision_instances[0].provision_instance_id;
  const relationship = {
    schema_version: 'RELATIONSHIP_REVISION/V1',
    relationship_revision_id: 'synthetic-relationship-1',
    relationship_occurrence_id: 'synthetic-relationship-occurrence-1',
    source_occurrence_id: provisionId,
    relationship_definition_key: 'SYNTHETIC_RELATIONSHIP',
    relationship_definition_version: 1,
    ordinal: 0,
    state: 'PRESENT',
    raw_scope: null,
    scope: null,
    applicability: null,
    not_examined: null,
    failure: null,
    target_occurrence_ids: [],
    effect: null,
    attributes: {},
    taxonomy_codes: {},
    resolver_version: 'TEST/V1',
  };
  const client = fakeClient({ ...tables, relationship_revisions: [relationship] });
  const relationships = await readRelationshipsForDeal({ client, documentHash: fixture.documentHash });
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].relationship.relationship_revision_id, 'synthetic-relationship-1');
  assert.equal(relationships[0].provision_instance.provision_instance_id, provisionId);
});

// ── Conditional termination-fee values (PLAN.md Step 2C1). ──
//
// The defect this step closes is invisible with only one deal in the
// table -- these tests exist specifically to prove isolation with TWO, the
// same shape as this step's own live proof
// (scripts/canonical-v2-conditional-fee-two-deal-isolation-proof.js), just
// hermetic.

const CONDFEE_DEAL_A_DOCUMENT_HASH = 'a'.repeat(64);
const CONDFEE_DEAL_B_DOCUMENT_HASH = 'b'.repeat(64);

function buildTwoDealConditionalFeeValueTable() {
  const dealARow = buildConditionalTerminationFeeValue({
    fee_side: 'SELLER',
    triggering_branch: '7.3(b)(i)',
    base_amount: '1000000',
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'Deal A REIT Requirements',
    defined_term_lineage: ['Deal A Termination Fee', 'Deal A Base Amount'],
    source_citations: ['7.3(b)(i)', '8.1'],
    raw_formula: 'Deal A formula',
  });
  const dealBRow = buildConditionalTerminationFeeValue({
    fee_side: 'BUYER',
    triggering_branch: '7.3(c)',
    base_amount: '2000000',
    currency: 'USD',
    operator: 'LOWER_OF',
    reit_limit_cap_term_ref: 'Deal B REIT Requirements',
    defined_term_lineage: ['Deal B Termination Fee', 'Deal B Base Amount'],
    source_citations: ['7.3(c)', '8.2'],
    raw_formula: 'Deal B formula',
  });
  return {
    dealARow,
    dealBRow,
    conditional_termination_fee_values: [
      { document_hash: CONDFEE_DEAL_A_DOCUMENT_HASH, payload: dealARow },
      { document_hash: CONDFEE_DEAL_B_DOCUMENT_HASH, payload: dealBRow },
    ],
  };
}

test('readConditionalTerminationFeeValuesForDeal scopes by the document_hash COLUMN, not anything in the payload', async () => {
  const table = buildTwoDealConditionalFeeValueTable();
  const client = fakeClient({ conditional_termination_fee_values: table.conditional_termination_fee_values });

  const dealARows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: CONDFEE_DEAL_A_DOCUMENT_HASH });
  assert.equal(dealARows.length, 1);
  assert.equal(canonicalJson(dealARows[0]), canonicalJson(table.dealARow));

  const dealBRows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: CONDFEE_DEAL_B_DOCUMENT_HASH });
  assert.equal(dealBRows.length, 1);
  assert.equal(canonicalJson(dealBRows[0]), canonicalJson(table.dealBRow));
});

test('two-deal isolation: neither deal\'s conditional fee value read carries the other\'s row -- this is the defect Step 2C1 closes', async () => {
  const table = buildTwoDealConditionalFeeValueTable();
  const client = fakeClient({ conditional_termination_fee_values: table.conditional_termination_fee_values });

  const dealARows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: CONDFEE_DEAL_A_DOCUMENT_HASH });
  const dealBRows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: CONDFEE_DEAL_B_DOCUMENT_HASH });

  assert.ok(
    !dealARows.some((row) => row.conditional_termination_fee_value_id === table.dealBRow.conditional_termination_fee_value_id),
    'Deal A\'s read must not contain Deal B\'s row',
  );
  assert.ok(
    !dealBRows.some((row) => row.conditional_termination_fee_value_id === table.dealARow.conditional_termination_fee_value_id),
    'Deal B\'s read must not contain Deal A\'s row',
  );
});

test('readConditionalTerminationFeeValuesForDeal returns [] for a document_hash with no rows, without throwing', async () => {
  const table = buildTwoDealConditionalFeeValueTable();
  const client = fakeClient({ conditional_termination_fee_values: table.conditional_termination_fee_values });
  const rows = await readConditionalTerminationFeeValuesForDeal({ client, documentHash: 'c'.repeat(64) });
  assert.deepEqual(rows, []);
});

test('readDealFromLocalCanonicalV2Staging carries conditional_termination_fee_values scoped to the requested deal, alongside resolved/open_world/relationships', async () => {
  const table = buildTwoDealConditionalFeeValueTable();
  const tables = { ...tablesFromFixture(), ...table };
  const client = fakeClient(tables);
  const result = await readDealFromLocalCanonicalV2Staging({ client, documentHash: fixture.documentHash, env: { NODE_ENV: 'test' } });
  // The fixture's own document_hash is neither Deal A's nor Deal B's, so its
  // read must carry NEITHER synthetic conditional-fee row even though both
  // are present in the same fake table.
  assert.deepEqual(result.conditional_termination_fee_values, []);
});

test('a deal whose ONLY data is a conditional termination fee value is not reported as empty', async () => {
  const table = buildTwoDealConditionalFeeValueTable();
  const client = fakeClient({
    provision_instances: [], claim_revisions: [], open_world_candidates: [],
    open_world_candidate_occurrences: [], open_world_evidence_references: [], relationship_revisions: [],
    conditional_termination_fee_values: table.conditional_termination_fee_values,
  });
  const result = await readDealFromLocalCanonicalV2Staging({
    client, documentHash: CONDFEE_DEAL_A_DOCUMENT_HASH, env: { NODE_ENV: 'test' },
  });
  assert.deepEqual(result.resolved, []);
  assert.deepEqual(result.open_world, []);
  assert.equal(result.conditional_termination_fee_values.length, 1);
  assert.equal(canonicalJson(result.conditional_termination_fee_values[0]), canonicalJson(table.dealARow));
});

test('readRelationshipsForDeal refuses a relationship row tampered to carry the open-world marker', async () => {
  const tables = tablesFromFixture();
  const provisionId = tables.provision_instances[0].provision_instance_id;
  const tampered = {
    relationship_revision_id: 'tampered', source_occurrence_id: provisionId, evidence_governance: OPEN_WORLD_EVIDENCE_GOVERNANCE_MARKER,
  };
  const client = fakeClient({ ...tables, relationship_revisions: [tampered] });
  await assert.rejects(
    () => readRelationshipsForDeal({ client, documentHash: fixture.documentHash }),
    (err) => err.code === 'GOVERNED_ROW_CARRIES_OPEN_WORLD_MARKER',
  );
});
