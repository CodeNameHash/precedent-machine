#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  queryCanonicalResultPage,
} = require('../lib/canonical-v2/query-result');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = createCanonicalV2StagingRuntime({
  root: ROOT,
  tempPrefix: 'canonical-v2-qxo-f5-query-acceptance-',
  operationLabel: 'Canonical QXO F5 query acceptance',
});
const {
  guardProject,
  runSql,
  sqlReadOnlyQueryClient,
  sqlText,
} = runtime;

const EXPECTED = Object.freeze({
  contractFingerprint: 'f80a77651d1b6a6a9eec8ac67526a8704f498761cbb22a67e6ceb4716abb5478',
  corpusReleaseId: '7980dc600883690a0b290abb679a5ea5ecbd3119f7de97fa0519f5ca82d883c7',
  servingNamespaceId: 'e7d2c4c0941d6b825ea47599826bdd8c3b8767f160241c112e5f5b34bd30de6d',
  candidateManifestId: 'aa407583e05b0ed01a1675e78321963a70b54624a2647541dc50b2ab558bdb02',
  importPlanId: '0f2a73c1d8d71e4e7e1978ae160f5aa0e23e66d7211ceb9a46941e80ba396da6',
  sellerRowKey: 'b96f7386871aff20be254518e3fe80de64d22a595bd679abe75d1a472d4e378e',
  buyerRowKey: '416607e9089e0c07b7a547f4b7aa1d44217faf75b4eb9ab31b28ac7b43b9d6da',
  noticeRowKey: 'aa3c9da59f2d814b857ecc39381760667ea8605e00dba878b76dc3616ec130a7',
  initialMatchRowKey: 'bd864b21db35719c331f7f74e829a247278845cfdd998725306f751d6651bd0b',
  materialIncompleteRowKey: '88e276003062cfd72fb442b876e47a97ba05876accd1a1a91988c69b9bbcb6c2',
  queryFunctionDigest: '09fac06072089d8446bd6a72c640d3d99c80024157ce4507d3860f4c50dd0457',
});
const EXPECTED_ACTIVE_POINTER = Object.freeze({
  candidate_release_manifest_id: '4e955c415bcb4c4e32e818bad11f82e48e247c3e12efee9a5e120d927a6ecf98',
  canonical_payload_digest: '82ee7e81a98fefc5f0ab84e41a0e1d69740dfabdb576d64cecd5245981d9c269',
  corpus_release_id: 'c9c19dc1ad92496953ee04f52b4a8dc575ea21ab9502acfd449a9299055817d3',
  correction_input_root: 'aa260ffdf873a51a93b23f6f85173de1a1183e21ade0668aa5a45977cb0f8012',
  correction_input_seal_id: '7fe908d2a5e359f8f87bb8f72e204a90fa4e25a73da4f8588be1350f6ba2a8bd',
  environment: 'staging',
  generation: 10,
  pointer_id: '4db4e0c928420e7082de7aedfbda43f4772d48233dc9ca75c56995686b6c28fe',
  previous_pointer_id: '0509b4a3db02e4a01bb3cbc4e393c60f8bed473426b3e20050789f14f90f21f3',
  schema_version: 'FIXTURE_ACTIVE_RELEASE_POINTER/V2',
  serving_namespace_id: '9270602408312e80a65c0ce46b895fa2c8f07d1c676aef5bd171029edd209b68',
});
const EXPECTED_PATHWAYS = Object.freeze([
  'IMMEDIATE_NO_SOLICIT_BREACH',
  'IMMEDIATE_NO_VOTE_WITH_LATENT_RIGHT',
  'IMMEDIATE_OUTSIDE_DATE_WITH_LATENT_RIGHT',
  'IMMEDIATE_RECOMMENDATION_CHANGE',
  'TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE',
  'TAIL_NO_SOLICIT_BREACH',
  'TAIL_NO_VOTE',
  'TAIL_OTHER_COVENANT_BREACH',
  'TAIL_OUTSIDE_DATE',
]);
const EXPECTED_TRIGGER_CODES = Object.freeze([
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'OUTSIDE_DATE_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function readState() {
  const rows = runSql(`SELECT jsonb_build_object(
    'active_pointer', (SELECT canonical_payload
      FROM canonical_v2_staging.active_corpus_release_pointers
      WHERE environment='staging'),
    'release', (SELECT jsonb_build_object(
      'corpus_release_id', release.corpus_release_id,
      'contract_fingerprint', release.contract_fingerprint,
      'candidate_manifest_id', release.candidate_manifest_id,
      'serving_namespace_id', receipt.serving_namespace_id,
      'candidate_release_import_plan_id', receipt.candidate_release_import_plan_id,
      'import_state', receipt.import_state
    )
      FROM canonical_v2_staging.fixture_corpus_releases release
      JOIN canonical_v2_staging.candidate_release_import_receipts receipt
        USING (corpus_release_id)
      WHERE release.corpus_release_id=${sqlText(EXPECTED.corpusReleaseId)}),
    'query_cache_rows', (SELECT count(*)
      FROM canonical_v2_staging.query_response_cache
      WHERE corpus_release_id=${sqlText(EXPECTED.corpusReleaseId)}),
    'query_function_definition', (SELECT pg_get_functiondef(proc.oid)
      FROM pg_proc proc
      JOIN pg_namespace namespace ON namespace.oid=proc.pronamespace
      WHERE namespace.nspname='public'
        AND proc.proname='canonical_v2_query_page_v2'
        AND proc.pronargs=37),
    'material_incomplete', (SELECT jsonb_build_object(
      'row_kind', row_kind,
      'row_serving_key', row_serving_key,
      'contract_fingerprint', contract_fingerprint,
      'concept_key', concept_key,
      'metric_key', metric_key,
      'canonical_numeric_value', canonical_numeric_value,
      'denominator_precision', denominator_precision,
      'result_completeness',
        canonical_payload #>> '{incomplete_canonical_result,result_completeness}',
      'market_comparability',
        canonical_payload #>> '{incomplete_canonical_result,market_comparability}',
      'exclusion_reason',
        canonical_payload #>> '{incomplete_canonical_result,metric_exclusion,exclusion_reason}',
      'measurement_period_mapping_state',
        canonical_payload #>> '{incomplete_canonical_result,components,0,claim_attributes,measurement_period_mapping_state}',
      'governed_reason_codes',
        canonical_payload #> '{incomplete_canonical_result,governed_reason_codes}'
    )
      FROM canonical_v2_staging.shared_serving_rows
      WHERE corpus_release_id=${sqlText(EXPECTED.corpusReleaseId)}
        AND row_serving_key=${sqlText(EXPECTED.materialIncompleteRowKey)})
  ) AS state;`, { readOnly: true });
  if (rows.length !== 1 || !rows[0]?.state) {
    fail('The exact F5 query acceptance state could not be read.');
  }
  return rows[0].state;
}

function assertInitialState(state) {
  const contract = compileFixtureContractV5();
  const queryFunctionDefinition = state.query_function_definition;
  const queryFunctionDigest = typeof queryFunctionDefinition === 'string'
    ? createHash('sha256').update(queryFunctionDefinition).digest('hex')
    : null;
  if (contract.fingerprint !== EXPECTED.contractFingerprint
    || canonicalJson(state.active_pointer) !== canonicalJson(EXPECTED_ACTIVE_POINTER)
    || canonicalJson(state.release) !== canonicalJson({
      corpus_release_id: EXPECTED.corpusReleaseId,
      contract_fingerprint: EXPECTED.contractFingerprint,
      candidate_manifest_id: EXPECTED.candidateManifestId,
      serving_namespace_id: EXPECTED.servingNamespaceId,
      candidate_release_import_plan_id: EXPECTED.importPlanId,
      import_state: 'IMPORTED_COMPLETE',
    })) {
    fail('The F5 contract, inactive release or active pointer identity has drifted.');
  }
  if (queryFunctionDigest !== EXPECTED.queryFunctionDigest
    || !/CREATE OR REPLACE FUNCTION public\.canonical_v2_query_page_v2\(/.test(
      queryFunctionDefinition,
    )
    || /active_corpus_release_pointers|canonical_v2_activate_candidate_release/i.test(
      queryFunctionDefinition,
    )) {
    fail('The deployed pinned query function is not the reviewed pointer-immutable definition.');
  }
  if (canonicalJson(state.material_incomplete) !== canonicalJson({
    row_kind: 'INCOMPLETE_CANONICAL_RESULT',
    row_serving_key: EXPECTED.materialIncompleteRowKey,
    contract_fingerprint: EXPECTED.contractFingerprint,
    concept_key: 'REP-T-CONTRACTS',
    metric_key: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    canonical_numeric_value: null,
    denominator_precision: 'APPROXIMATE',
    result_completeness: 'INCOMPLETE_NOVEL_SEMANTIC',
    market_comparability: 'NOT_CERTIFIED',
    exclusion_reason: 'RESULT_INCOMPLETE',
    measurement_period_mapping_state: 'UNMAPPED_FROZEN_TAXONOMY',
    governed_reason_codes: ['UNMAPPED_MEASUREMENT_PERIOD'],
  })) {
    fail('Material Contracts must remain an explicit, typed F5 exclusion.');
  }
}

function requestFor({
  metricKey,
  conceptKey,
  party,
  filters = {},
  columnFilters = {},
}) {
  return {
    serving_namespace_id: EXPECTED.servingNamespaceId,
    corpus_release_id: EXPECTED.corpusReleaseId,
    contract_fingerprint: EXPECTED.contractFingerprint,
    intent: 'MARKET_RANGE',
    metric_key: metricKey,
    metric_version: 1,
    concept_key: conceptKey,
    party,
    filters,
    selected_columns: null,
    column_filters: columnFilters,
    page_size: 25,
    cursor: null,
  };
}

function assertSourceIdentity(row) {
  if (row.source_actions.length !== 1
    || canonicalJson(row.cells.source) !== canonicalJson(row.source_actions[0])) {
    fail('The query row must expose its exact source action once.');
  }
  const action = row.source_actions[0];
  for (const key of [
    'action_definition_id',
    'action_definition_payload_digest',
    'parent_edge_id',
    'source_detail_payload_id',
    'source_detail_reference_id',
  ]) {
    if (!SHA256_RE.test(action[key] || '')) {
      fail(`The query row has an invalid ${key}.`);
    }
  }
  if (!action.detail_kind || !action.action_slot_key || !Number.isInteger(action.governed_ordinal)) {
    fail('The query row source action is not typed and addressable.');
  }
}

function assertExactSingleRow(result, expectedRowKey) {
  if (result.result.corpus_release_id !== EXPECTED.corpusReleaseId
    || result.result.serving_namespace_id !== EXPECTED.servingNamespaceId
    || result.result.contract_fingerprint !== EXPECTED.contractFingerprint
    || result.result.total_count !== 1
    || result.result.page_count !== 1
    || result.result.rows.length !== 1
    || result.result.rows[0].row_serving_key !== expectedRowKey
    || result.result.rows[0].governed_deal_key !== 'deal:qxo-topbuild') {
    fail('The bounded query did not return the exact pinned F5 row.');
  }
  assertSourceIdentity(result.result.rows[0]);
  return result.result.rows[0];
}

function assertExactEmptyResult(result) {
  if (result.result.corpus_release_id !== EXPECTED.corpusReleaseId
    || result.result.serving_namespace_id !== EXPECTED.servingNamespaceId
    || result.result.contract_fingerprint !== EXPECTED.contractFingerprint
    || result.result.total_count !== 0
    || result.result.page_count !== 0
    || result.result.rows.length !== 0
    || result.result.cohort_summary.statistics.state !== 'NO_VALUES') {
    fail('The incomplete Material Contracts result entered a comparable query cohort.');
  }
}

function assertFeeRow(result, { expectedRowKey, side, payer, payee }) {
  const row = assertExactSingleRow(result, expectedRowKey);
  const triggers = row.cells.triggers;
  const uniqueTriggerCodes = [...new Set(triggers.map((item) => item.trigger_code))].sort();
  if (row.cells.percent_of_deal_value !== '3.52941176'
    || row.cells.raw_value !== '$600,000,000'
    || row.cells.fee_side.code !== side
    || canonicalJson(row.cells.payer) !== canonicalJson(payer)
    || canonicalJson(row.cells.payee) !== canonicalJson(payee)
    || canonicalJson(triggers.map((item) => item.pathway_code)) !== canonicalJson(EXPECTED_PATHWAYS)
    || canonicalJson(uniqueTriggerCodes) !== canonicalJson(EXPECTED_TRIGGER_CODES)
    || row.display_metadata.denominator_precision !== 'APPROXIMATE'
    || result.result.cohort_summary.counts.approximate_result_rows !== 1
    || result.result.cohort_summary.statistics.median !== '3.52941176') {
    fail(`The ${side.toLowerCase()} fee query lost its governed value, side, pathways or precision.`);
  }
}

function assertNoticeRow(result) {
  const row = assertExactSingleRow(result, EXPECTED.noticeRowKey);
  if (result.request.basis_key !== 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL'
    || canonicalJson(row.cells.duration) !== canonicalJson({
      canonical_value: '1',
      canonical_unit: 'DAYS',
      raw_value: 'twenty-four (24) hours after receipt',
      raw_magnitude: '24',
      raw_unit: 'HOURS',
    })
    || row.cells.day_basis.code !== 'ELAPSED'
    || row.cells.trigger.code !== 'RECEIPT_OF_COMPETING_PROPOSAL') {
    fail('The notice-period query did not preserve 24 source hours and one comparable elapsed day.');
  }
}

function assertInitialMatchRow(result) {
  const row = assertExactSingleRow(result, EXPECTED.initialMatchRowKey);
  if (result.request.basis_key !== 'DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE'
    || canonicalJson(row.cells.duration) !== canonicalJson({
      canonical_value: '4',
      canonical_unit: 'DAYS',
      raw_value: 'four (4) business days’ prior written notice',
      raw_magnitude: '4',
      raw_unit: 'DAYS',
    })
    || row.cells.day_basis.code !== 'BUSINESS'
    || row.cells.trigger.code !== 'SUPERIOR_PROPOSAL_NOTICE') {
    fail('The initial-match query lost its distinct four-business-day semantics.');
  }
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
    fail('Usage: node scripts/canonical-v2-staging-qxo-f5-query-acceptance.mjs --verify');
  }
  guardProject();
  const before = readState();
  assertInitialState(before);

  const underlyingClient = sqlReadOnlyQueryClient();
  let databaseCalls = 0;
  const countedClient = Object.freeze({
    rpc(name, params) {
      databaseCalls += 1;
      return underlyingClient.rpc(name, params);
    },
  });
  const execute = async (request) => {
    const beforeCalls = databaseCalls;
    const result = await queryCanonicalResultPage({
      client: countedClient,
      request,
      timeoutMs: 10_000,
    });
    if (databaseCalls !== beforeCalls + 1) {
      fail('Each F5 query request must perform exactly one bounded database RPC.');
    }
    return result;
  };

  const sellerRequest = requestFor({
    metricKey: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    conceptKey: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
  });
  const sellerRefinedRequest = requestFor({
    metricKey: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    conceptKey: 'TERMF-TARGET',
    party: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    filters: {
      sector: 'Building products',
      buyer: 'QXO',
      merger_form: 'Reverse triangular merger',
      adviser_either: 'Jones Day',
      lawyer_either: 'Scott Barshay',
      year_from: 2026,
      year_to: 2026,
      min_value_usd: '16999999999',
      max_value_usd: '17000000001',
    },
    columnFilters: {
      min_percent_of_deal_value: '3.5',
      max_percent_of_deal_value: '3.6',
      fee_side: 'SELLER',
      payer_capacity: 'TARGET',
      payee_capacity: 'BUYER',
      trigger_code: 'OUTSIDE_DATE_TERMINATION',
    },
  });
  const buyerRequest = requestFor({
    metricKey: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    conceptKey: 'TERMF-REVERSE',
    party: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
  });
  const buyerRefinedRequest = requestFor({
    metricKey: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    conceptKey: 'TERMF-REVERSE',
    party: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    filters: { buyer: 'QXO' },
    columnFilters: {
      fee_side: 'BUYER',
      payer_capacity: 'BUYER',
      payee_capacity: 'TARGET',
      payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    },
  });

  const seller = await execute(sellerRequest);
  const sellerRefined = await execute(sellerRefinedRequest);
  const buyer = await execute(buyerRequest);
  const buyerRefined = await execute(buyerRefinedRequest);
  const notice = await execute(requestFor({
    metricKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    conceptKey: 'NOSOL-NOTICE',
    party: { role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' },
  }));
  const initialMatch = await execute(requestFor({
    metricKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    conceptKey: 'NOSOL-MATCH',
    party: { role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' },
  }));
  const materialContracts = await execute(requestFor({
    metricKey: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    conceptKey: 'REP-T-CONTRACTS',
    party: { role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' },
  }));

  const sellerIdentity = {
    expectedRowKey: EXPECTED.sellerRowKey,
    side: 'SELLER',
    payer: { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' },
    payee: { role: 'FEE_PAYEE', value: 'PARENT', capacity: 'BUYER' },
  };
  const buyerIdentity = {
    expectedRowKey: EXPECTED.buyerRowKey,
    side: 'BUYER',
    payer: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    payee: { role: 'FEE_PAYEE', value: 'COMPANY', capacity: 'TARGET' },
  };
  assertFeeRow(seller, sellerIdentity);
  assertFeeRow(sellerRefined, sellerIdentity);
  assertFeeRow(buyer, buyerIdentity);
  assertFeeRow(buyerRefined, buyerIdentity);
  assertNoticeRow(notice);
  assertInitialMatchRow(initialMatch);
  assertExactEmptyResult(materialContracts);

  if (databaseCalls !== 7
    || seller.result.rows[0].row_serving_key !== sellerRefined.result.rows[0].row_serving_key
    || buyer.result.rows[0].row_serving_key !== buyerRefined.result.rows[0].row_serving_key) {
    fail('F5 refinements changed row identity or exceeded the seven-call acceptance ceiling.');
  }

  const after = readState();
  assertInitialState(after);
  if (canonicalJson(after) !== canonicalJson(before)) {
    fail('F5 query acceptance changed the inactive release, active pointer or durable cache.');
  }

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    corpus_release_id: EXPECTED.corpusReleaseId,
    contract_fingerprint: EXPECTED.contractFingerprint,
    active_pointer_unchanged: true,
    active_generation: EXPECTED_ACTIVE_POINTER.generation,
    database_rpc_calls: databaseCalls,
    seller_fee_percent: seller.result.rows[0].cells.percent_of_deal_value,
    buyer_fee_percent: buyer.result.rows[0].cells.percent_of_deal_value,
    typed_fee_pathways_per_side: EXPECTED_PATHWAYS.length,
    distinct_fee_trigger_codes_per_side: EXPECTED_TRIGGER_CODES.length,
    notice_period_days: notice.result.rows[0].cells.duration.canonical_value,
    notice_source_hours: notice.result.rows[0].cells.duration.raw_magnitude,
    initial_match_period_days: initialMatch.result.rows[0].cells.duration.canonical_value,
    material_contracts: 'RESULT_INCOMPLETE',
    comparable_material_contract_rows: materialContracts.result.total_count,
    durable_query_cache_rows: Number(after.query_cache_rows),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'F5 query acceptance failed.'}\n`);
  process.exit(1);
});
