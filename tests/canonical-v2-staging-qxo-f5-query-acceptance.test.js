const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-f5-query-acceptance.mjs';
const RUNTIME = 'scripts/lib/canonical-v2-staging-runtime.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');
const runtime = fs.readFileSync(RUNTIME, 'utf8');

test('F5 query acceptance pins the exact inactive release and unchanged active pointer', () => {
  assert.match(source, /contractFingerprint: 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478'/);
  assert.match(source, /corpusReleaseId: '7980dc600883690a0b290abb679a5ea5ecbd3119f7de97fa0519f5ca82d883c7'/);
  assert.match(source, /servingNamespaceId: 'e7d2c4c0941d6b825ea47599826bdd8c3b8767f160241c112e5f5b34bd30de6d'/);
  assert.match(source, /candidateManifestId: 'aa407583e05b0ed01a1675e78321963a70b54624a2647541dc50b2ab558bdb02'/);
  assert.match(source, /importPlanId: '0f2a73c1d8d71e4e7e1978ae160f5aa0e23e66d7211ceb9a46941e80ba396da6'/);
  assert.match(source, /corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3'/);
  assert.match(source, /generation: 10/);
  assert.match(source, /canonicalJson\(after\) !== canonicalJson\(before\)/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.match(source, /queryFunctionDigest: '09fac06072089d8446bd6a72c640d3d99c80024157ce4507d3860f4c50dd0457'/);
  assert.match(source, /pg_get_functiondef\(proc\.oid\)/);
  assert.match(source, /active_corpus_release_pointers\|canonical_v2_activate_candidate_release/);
});

test('F5 fee acceptance keeps buyer and seller separate with percentage, precision and pathways', () => {
  assert.match(source, /SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/);
  assert.match(source, /BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/);
  assert.match(source, /conceptKey: 'TERMF-TARGET'/);
  assert.match(source, /conceptKey: 'TERMF-REVERSE'/);
  assert.match(source, /row\.cells\.percent_of_deal_value !== '3\.52941176'/);
  assert.match(source, /row\.display_metadata\.denominator_precision !== 'APPROXIMATE'/);
  assert.match(source, /EXPECTED_PATHWAYS/);
  assert.match(source, /EXPECTED_TRIGGER_CODES/);
  assert.match(source, /typed_fee_pathways_per_side: EXPECTED_PATHWAYS\.length/);
  assert.match(source, /distinct_fee_trigger_codes_per_side: EXPECTED_TRIGGER_CODES\.length/);
  assert.match(source, /side: 'SELLER'/);
  assert.match(source, /side: 'BUYER'/);
});

test('F5 acceptance proves duration semantics, refinements and exact source actions', () => {
  assert.match(source, /DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL/);
  assert.match(source, /raw_magnitude: '24'/);
  assert.match(source, /raw_unit: 'HOURS'/);
  assert.match(source, /DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE/);
  assert.match(source, /canonical_value: '4'/);
  assert.match(source, /adviser_either: 'Jones Day'/);
  assert.match(source, /lawyer_either: 'Scott Barshay'/);
  assert.match(source, /trigger_code: 'OUTSIDE_DATE_TERMINATION'/);
  assert.match(source, /payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION'/);
  assert.match(source, /canonicalJson\(row\.cells\.source\) !== canonicalJson\(row\.source_actions\[0\]\)/);
  assert.match(source, /source_detail_reference_id/);
});

test('material contracts remains a typed exclusion instead of plausible market data', () => {
  assert.match(source, /row_kind: 'INCOMPLETE_CANONICAL_RESULT'/);
  assert.match(source, /result_completeness: 'INCOMPLETE_NOVEL_SEMANTIC'/);
  assert.match(source, /market_comparability: 'NOT_CERTIFIED'/);
  assert.match(source, /exclusion_reason: 'RESULT_INCOMPLETE'/);
  assert.match(source, /measurement_period_mapping_state: 'UNMAPPED_FROZEN_TAXONOMY'/);
  assert.match(source, /governed_reason_codes: \['UNMAPPED_MEASUREMENT_PERIOD'\]/);
  assert.match(source, /canonical_numeric_value: null/);
  assert.match(source, /metricKey: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE'/);
  assert.match(source, /result\.result\.total_count !== 0/);
  assert.match(source, /result\.result\.cohort_summary\.statistics\.state !== 'NO_VALUES'/);
  assert.match(source, /comparable_material_contract_rows: materialContracts\.result\.total_count/);
});

test('each acceptance request uses one bounded pinned RPC and leaves no durable cache write', () => {
  assert.match(source, /databaseCalls !== beforeCalls \+ 1/);
  assert.match(source, /databaseCalls !== 7/);
  assert.match(source, /sqlReadOnlyQueryClient\(\)/);
  assert.match(runtime, /name !== 'canonical_v2_query_page_v2'/);
  assert.match(runtime, /runSql\(`SELECT \$\{call\} AS result;`, \{ commit: false \}\)/);
  assert.doesNotMatch(
    `${source}\n${runtime.slice(runtime.indexOf('function sqlReadOnlyQueryClient()'))}`,
    /public\.canonical_v2_activate_candidate_release|environment:\s*'production'/,
  );
});
