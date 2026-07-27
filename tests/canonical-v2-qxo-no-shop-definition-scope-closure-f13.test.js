const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  AUTHORITY_SCOPE,
  __test,
  DEFINITION_SPECS,
  EXPECTED_ROOT_SPANS,
  MAX_CARRIER_BYTES,
} = require('../lib/canonical-v2/qxo-no-shop-definition-scope-closure-f13');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-scope-closure-f13-staging-attestation.json';
const MODULE =
  'lib/canonical-v2/qxo-no-shop-definition-scope-closure-f13.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('F13 closes the exact 19-token QXO notice root at fixed point', () => {
  const value = fixture();
  assert.equal(value.environment, 'STAGING');
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(value.inventory_summary.root_token_outcome_count, 19);
  assert.deepEqual(
    value.root_outcomes.map((entry) => entry.governed_ordinal),
    EXPECTED_ROOT_SPANS,
  );
  assert.deepEqual(
    [
      value.definition_scope_closure.fixed_point_state,
      value.definition_scope_closure.resolution_state,
      value.definition_scope_closure.unresolved_outcome_count,
    ],
    ['REACHED', 'RESOLVED_WITH_REVIEW_NOTE', 0],
  );
  assert.match(
    value.definition_scope_closure.definition_scope_closure_id,
    /^[a-f0-9]{64}$/,
  );
});

test('longest-match root outcomes do not emit nested Company tokens', () => {
  const outcomes = fixture().root_outcomes;
  assert.equal(outcomes.length, 19);
  assert.equal(
    outcomes.filter((entry) => entry.raw_source_form === 'Company').length,
    5,
  );
  assert.equal(
    outcomes.find((entry) => entry.governed_ordinal === 208222)
      .raw_source_form,
    'Company Board',
  );
  assert.equal(
    outcomes.find((entry) => entry.governed_ordinal === 208683)
      .raw_source_form,
    'Company Requests',
  );
  assert.equal(
    outcomes.filter(
      (entry) => entry.raw_source_form === 'Company Acquisition Proposal',
    ).length,
    5,
  );
  assert.equal(fixture().scan_policy.unreviewed_candidate_count, 0);
});

test('the reviewed source inventory has twelve exact reached nodes', () => {
  const value = fixture();
  assert.equal(value.inventory_summary.definition_occurrence_count, 12);
  assert.equal(DEFINITION_SPECS.length, 12);
  assert.deepEqual(new Map(DEFINITION_SPECS.map(
    (entry) => [entry.key, entry.body],
  )), new Map([
    ['GOVERNMENTAL_ENTITY', [38517, 38680]],
    ['PERSON', [38208, 38438]],
    ['SUBSIDIARY', [51283, 51636]],
    ['COMPANY_SHARES', [6021, 6086]],
    ['PARENT_SHARES', [4819, 4901]],
    ['PARENT_SHARE_ISSUANCE', [4819, 4955]],
    ['TITANIUM_MERGER', [4017, 4260]],
    ['FORWARD_MERGER', [4298, 4594]],
    ['MERGERS', [4626, 4678]],
    ['TRANSACTIONS', [4994, 5093]],
    ['COMPANY_ACQUISITION_PROPOSAL', [211611, 212793]],
    ['COMPANY_REQUEST', [208020, 208349]],
  ]));
  assert.deepEqual(
    DEFINITION_SPECS.find(
      (entry) => entry.key === 'FORWARD_MERGER',
    ).carrier,
    [4298, 4620],
  );
});

test('plural source forms resolve without aliases or self-edge authority', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /SOURCE_LOCAL_INFLECTION/);
  assert.match(source, /automatic_alias_authority: 'NONE'/);
  assert.match(
    source,
    /reachedDefinitionByKey\.get\(token\.definition_key\)[\s\S]*definition_occurrence_id === parentDefinitionId[\s\S]*token\.kind === 'DEFINITION_PLURAL'/,
  );
  assert.equal(
    fixture().root_outcomes.find(
      (entry) => entry.raw_source_form === 'Company Requests',
    ).disposition_code,
    'USES_DEFINITION',
  );
});

test('leaf-first topology is derived and cycles are rejected', () => {
  const definitions = [
    { definition_occurrence_id: 'a', definition_key: 'A', governed_ordinal: 30 },
    { definition_occurrence_id: 'b', definition_key: 'B', governed_ordinal: 20 },
    { definition_occurrence_id: 'c', definition_key: 'C', governed_ordinal: 10 },
  ];
  const relationships = [
    {
      parent_scope_identity: 'a',
      selected_definition_occurrence_id: 'b',
    },
    {
      parent_scope_identity: 'b',
      selected_definition_occurrence_id: 'c',
    },
  ];
  assert.deepEqual(
    __test.deriveTopologicalOrder(definitions, relationships),
    {
      ordered_ids: ['c', 'b', 'a'],
      ordered_keys: ['C', 'B', 'A'],
      maximum_depth: 3,
    },
  );
  assert.throws(
    () => __test.deriveTopologicalOrder(definitions, [
      ...relationships,
      {
        parent_scope_identity: 'c',
        selected_definition_occurrence_id: 'a',
      },
    ]),
    (error) => error.code === 'DEFINITION_DEPENDENCY_CYCLE',
  );
});

test('overlapping scopes have one deepest semantic owner', () => {
  const token = {
    raw_form: 'Company',
    governed_ordinal: 208070,
    exact_span: { absolute_start: 208070, absolute_end: 208077 },
  };
  const owned = __test.ownedScopedTokens(
    [token],
    [{
      definition: {
        definition_occurrence_id: 'request',
        ordered_body_spans: [{ absolute_start: 208020, absolute_end: 208349 }],
      },
      tokens: [token],
    }],
  );
  assert.equal(owned.length, 1);
  assert.equal(owned[0].parentScopeIdentity, 'request');
});

test('blind candidates are individually reconciled without generic fallback', () => {
  const text = Buffer.alloc(38534, 0x20);
  text.write('The Company', 0, 'utf8');
  text.write('United States', 38521, 'utf8');
  const result = __test.buildBlindCandidateDispositions(
    text,
    [{
      absolute_start: 0,
      absolute_end: 11,
    }, {
      absolute_start: 38521,
      absolute_end: 38534,
    }],
    [{
      token_outcome_id: 'company-token',
      exact_source_span: { absolute_start: 4, absolute_end: 11 },
    }],
  );
  assert.equal(result.raw_observation_count, 2);
  assert.equal(result.candidate_count, 2);
  assert.deepEqual(
    result.dispositions.map((entry) => entry.disposition_code),
    [
      'MAPPED_TO_REVIEWED_TOKEN_OUTCOMES',
      'REVIEWED_SOURCE_CONTEXT_CONSTITUENT',
    ],
  );
  const contextual = result.dispositions[1];
  assert.equal(
    contextual.reviewed_reason_code,
    'JURISDICTION_CONTEXT_WITHIN_GOVERNMENTAL_ENTITY_DEFINITION',
  );
  assert.equal(contextual.semantic_transfer_authority, 'NONE');
  assert.equal(contextual.comparability_authority, 'NONE');
  const jurisdictionText = Buffer.alloc(4228, 0x20);
  jurisdictionText.write('State', 4211, 'utf8');
  jurisdictionText.write('Delaware', 4220, 'utf8');
  const jurisdictions = __test.buildBlindCandidateDispositions(
    jurisdictionText,
    [
      { absolute_start: 4211, absolute_end: 4216 },
      { absolute_start: 4220, absolute_end: 4228 },
    ],
    [],
  );
  assert.deepEqual(
    jurisdictions.dispositions.map((entry) => [
      entry.raw_source_form,
      entry.reviewed_reason_code,
      entry.semantic_transfer_authority,
      entry.comparability_authority,
    ]),
    [
      [
        'State',
        'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
        'NONE',
        'NONE',
      ],
      [
        'Delaware',
        'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
        'NONE',
        'NONE',
      ],
    ],
  );
  assert.equal(result.unreviewed_candidate_count, 0);
  assert.throws(
    () => __test.buildBlindCandidateDispositions(
      Buffer.from('Novel Proposition', 'utf8'),
      [{ absolute_start: 0, absolute_end: 17 }],
      [],
    ),
    (error) => error.code === 'UNRECONCILED_BLIND_CANDIDATE',
  );
});

test('failed exact occurrences cannot survive through duplicate projections', () => {
  const text = Buffer.from('Subsidiary', 'utf8');
  const result = __test.buildBlindCandidateDispositions(
    text,
    [{ absolute_start: 0, absolute_end: text.length }],
    [
      {
        token_outcome_id: 'root-blocked',
        disposition_code: 'BLOCKING_UNRESOLVED_CANDIDATE',
        exact_source_span: { absolute_start: 0, absolute_end: text.length },
      },
      {
        token_outcome_id: 'nested-blocked',
        disposition_code: 'BLOCKING_UNRESOLVED_CANDIDATE',
        exact_source_span: { absolute_start: 0, absolute_end: text.length },
      },
    ],
  );
  assert.equal(
    result.dispositions[0].disposition_code,
    'BLOCKING_UNRESOLVED_CANDIDATE',
  );
  assert.deepEqual(
    result.dispositions[0].mapped_token_outcome_ids,
    ['nested-blocked', 'root-blocked'],
  );
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /blockingOutcomeByKey\.get\(\[[\s\S]*token\.exact_span\.absolute_start/);
  assert.match(source, /FAILURE_PROJECTION_DRIFT/);
});

test('F13 binds F11 effects and carries resolvable evidence records', () => {
  const value = fixture();
  assert.equal(value.inventory_summary.definition_control_scan_count, 12);
  assert.equal(value.inventory_summary.evidence_excerpt_count, 100);
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /relationship_source: 'F11_CONTROLLED_EFFECT'/);
  assert.match(source, /controlled_relationship_effect_revision_id/);
  assert.match(source, /controlled_effect_payload_digest/);
  assert.match(source, /F11_RELATIONSHIP_SET_DRIFT/);
  assert.match(source, /EVIDENCE_REFERENCE_UNRESOLVED/);
  assert.match(source, /evidenceIdentityInvalid/);
  assert.doesNotMatch(source, /LEAF_FIRST_KEYS/);
});

test('legal source classes, declaration anchors and local override are explicit', () => {
  const value = fixture();
  assert.deepEqual(
    value.definition_summary.reduce((counts, entry) => ({
      ...counts,
      [entry.legal_class]: (counts[entry.legal_class] || 0) + 1,
    }), {}),
    {
      TRUE_DEFINITION: 5,
      INSTRUMENT_DESIGNATION: 2,
      TRANSACTION_DESIGNATION: 5,
    },
  );
  const transactions = value.definition_control_summary.find(
    (entry) => entry.definition_key === 'TRANSACTIONS',
  );
  assert.equal(transactions.local_override_count, 1);
  assert.equal(
    transactions.local_override_classification,
    'LOCAL_SCOPE_OVERRIDE_REFERENCE',
  );
  assert.equal(
    transactions.local_override_scope,
    'ARTICLE_III_AND_SECTION_4_7_ONLY_INAPPLICABLE_TO_SECTION_4_3_C',
  );
  assert.deepEqual(
    [
      transactions.local_override_evidence_span.absolute_start,
      transactions.local_override_evidence_span.absolute_end,
      transactions.local_override_evidence_span.exact_bytes_digest,
    ],
    [
      401406,
      401606,
      '4766984cad84ef8c5e7416685587ab3c1a327453b310414825d65dd60fac3851',
    ],
  );
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /INSTRUMENT_DESIGNATION/);
  assert.match(source, /TRANSACTION_DESIGNATION/);
  assert.doesNotMatch(source, /'SOURCE_DESIGNATION'/);
  assert.match(source, /Company: Object\.freeze\(\[3677, 3735\]\)/);
  assert.match(source, /Company: Object\.freeze\(\[3724, 3731\]\)/);
  assert.match(source, /carrier: Object\.freeze\(\[5574, 5637\]\)/);
  assert.match(source, /ARTICLE_III_AND_SECTION_4_7_ONLY_INAPPLICABLE_TO_SECTION_4_3_C/);
  assert.match(source, /local_override_evidence_span/);
  assert.match(source, /401406, 401606/);
  assert.match(source, /4766984cad84ef8c5e7416685587ab3c1a327453b310414825d65dd60fac3851/);
  assert.match(source, /AGREEMENT_DECLARATION_CARRIER/);
  assert.match(source, /local_override_classification: reviewedOverrideSpan[\s\S]*LOCAL_SCOPE_OVERRIDE_REFERENCE/);
  assert.match(source, /carrier: Object\.freeze\(\[4298, 4620\]\)/);
  assert.match(source, /b67acdce216a4e91eaa23cd24c6050e7ddbbb21fcddd010dc91440f48743c442/);
  assert.doesNotMatch(
    source,
    /raw_form: 'State of Delaware',[\s\S]{0,80}kind: 'STATUTE_DESIGNATION'/,
  );
});

test('party contexts retain compact declaration carriers and exact terms', () => {
  const value = fixture();
  assert.equal(value.inventory_summary.source_party_context_count, 4);
  assert.deepEqual(
    value.source_party_context_summary.map((entry) => entry.raw_form),
    ['Parent', 'Titanium Merger Sub', 'Forward Merger Sub', 'Company'],
  );
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /source_party_contexts: sourcePartyContexts/);
  assert.match(source, /buildSourcePartyContexts/);
  assert.match(source, /source_declaration_carrier_span: compactSourceSpan/);
  assert.match(source, /exact_declared_term_span: compactSourceSpan/);
  assert.match(source, /partyContextInvalid/);
  assert.match(source, /governed_entity_party_context_id:[\s\S]*sourcePartyContextIdByRaw\.get\('Company'\)/);
});

test('jurisdiction candidates remain reviewed context without statute or market authority', () => {
  assert.deepEqual(
    fixture().reviewed_contextual_candidate_summary.map((entry) => [
      entry.raw_source_form,
      entry.reviewed_reason_code,
      entry.semantic_transfer_authority,
      entry.comparability_authority,
    ]),
    [
      [
        'State',
        'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
        'NONE',
        'NONE',
      ],
      [
        'Delaware',
        'JURISDICTION_CONTEXT_WITHIN_STATUTE_LONG_FORM',
        'NONE',
        'NONE',
      ],
      [
        'United States',
        'JURISDICTION_CONTEXT_WITHIN_GOVERNMENTAL_ENTITY_DEFINITION',
        'NONE',
        'NONE',
      ],
    ],
  );
});

test('forced failure replaces the disposition and removes its graph edge', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /BLOCKING_UNRESOLVED_CANDIDATE/);
  assert.match(source, /blockingOutcomeByKey/);
  assert.match(
    source,
    /resolvedOwnedTokens = ownedTokens\.filter\([\s\S]*governed_ordinal !== failedOrdinal/,
  );
  assert.match(source, /test-only failure target must resolve to one semantic owner/);
});

test('EBITDA and the open Transactions phrase remain visible non-comparable terminals', () => {
  const terminals = fixture().reviewed_terminals;
  assert.deepEqual(
    terminals.map((entry) => entry.raw_source_form),
    ['other transactions contemplated hereby', 'EBITDA'],
  );
  for (const terminal of terminals) {
    assert.equal(
      terminal.review_projection,
      'VISIBLE_WITH_EVIDENCE_AND_REASON',
    );
    assert.equal(terminal.compare_projection, 'EXPLICITLY_NON_COMPARABLE');
    assert.equal(
      terminal.corpus_context_projection,
      'EXPLICITLY_NON_COMPARABLE',
    );
    assert.ok(terminal.non_comparable_reason.length > 20);
  }
  assert.deepEqual(
    terminals.map((entry) => [
      entry.exact_source_span.absolute_start,
      entry.exact_source_span.absolute_end,
    ]),
    [[4998, 5036], [212714, 212720]],
  );
});

test('F13 removes only the definition-scope blocker', () => {
  const value = fixture();
  assert.deepEqual(value.materialisation_status.blocker_codes, [
    'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
    'NOTICE_REVISION_MATERIALISATION_DEFERRED',
  ]);
  assert.deepEqual(
    value.notice_child_state_projection.child_resolution_states,
    [
      {
        child_key: 'DEFINITION_SCOPE',
        resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
      },
      {
        child_key: 'DEFINITION_USES',
        resolution_state: 'RESOLVED_CLEAR',
      },
      {
        child_key: 'DEFINITION_DEPENDENCY',
        resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
      },
    ],
  );
  assert.equal(
    value.notice_child_state_projection.notice_obligation_revision_id,
    null,
  );
});

test('review remains renderable while every live authority stays denied', () => {
  const status = fixture().materialisation_status;
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.comparison_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const key of [
    'absence_authority',
    'canonical_write_authority',
    'publication_authority',
    'relationship_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[key], 'NONE', key);
  }
  assert.equal(fixture().failure_isolation_verified, true);
  assert.equal(MAX_CARRIER_BYTES, 256 * 1024);
});

test('the F13 attestation is one bounded staging read with no write path', () => {
  const runner = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runner, /--definition-scope-f13-print/);
  assert.match(runner, /--definition-scope-f13-verify/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  assert.doesNotMatch(
    runner,
    /canonical-v2-staging-qxo-no-shop\.mjs/,
  );
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(source, /supabase|fetch\(|canonicalWriter|writeSet/);
});
