#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileMarketCohortRequest,
  validateMarketCohortResult,
} = require('../lib/canonical-v2/market-cohort-query');
const {
  compileServingExactDetailRequest,
  validateServingExactDetailResult,
} = require('../lib/canonical-v2/serving-exact-detail');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { EXPECTED_RELEASE } = require('../lib/canonical-v2/vertical-slice-attestation');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const CANDIDATE = Object.freeze({
  corpus_release_id: 'd8630dc4dc8fc0a4d88d1e473cf111063b9e71ebc2f0616418236ec2e2f8d4f8',
  candidate_release_manifest_id: '2d85d6a990292023e5a9249d1b39acfc89512a72b14e58c79c5e4b660fd9cdf9',
  serving_namespace_id: '4e6495edaef5005885278927d445701d4e38e04fea87dd91031f70887e12063d',
  contract_fingerprint: '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d',
  application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
  governed_deal_key: 'deal:qxo-topbuild',
  row_serving_key: '3868d5c93daaf996970ecee752efd20b024618f55410200304c3998c970cfe93',
  row_payload_digest: 'f46964f52bb44ba216919cd0dd4afd5f9eeb80fabe5ce37f5dc86cdb1cd70e36',
  source_detail_reference_id: '529a50186117167276b7f9936afe3d7ec9f847485bbbc2c28de7cb356db40b91',
  exact_detail_package_digest: '11c58bf6a1126a20e58481ba422a510b1aec4861eefc6f352d119825010fcdb9',
});
const METRIC = Object.freeze({
  metric_key: 'REPRESENTATION_ACCURACY_STANDARD',
  metric_version: 1,
  concept_key: 'COND-B-REP',
  basis_key: 'ACCURACY_STANDARD_CODE',
  party: Object.freeze({
    role: 'CONDITION_BENEFICIARY',
    value: 'PARENT',
    capacity: 'ACQUIRER',
  }),
});
const MAX_RESULT_BYTES = 128 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(join(ROOT, 'supabase/.temp/linked-project.json'), 'utf8'));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to read outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  if (!line) return 'Canonical QXO serving verification failed.';
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(/((?:password|token|secret))=\S+/gi, '$1=[redacted]')
    .slice(0, 500);
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function marketRequest(subjectDealKey) {
  return compileMarketCohortRequest({
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    corpus_release_id: CANDIDATE.corpus_release_id,
    contract_fingerprint: CANDIDATE.contract_fingerprint,
    metric_key: METRIC.metric_key,
    metric_version: METRIC.metric_version,
    concept_key: METRIC.concept_key,
    party: METRIC.party,
    subject_deal_key: subjectDealKey,
    filters: {},
  });
}

function marketSql(request) {
  return `public.canonical_v2_market_cohort(
    p_environment => 'staging',
    p_serving_namespace_id => ${sqlText(request.serving_namespace_id)},
    p_corpus_release_id => ${sqlText(request.corpus_release_id)},
    p_contract_fingerprint => ${sqlText(request.contract_fingerprint)},
    p_cohort_digest => ${sqlText(request.cohort_digest)},
    p_metric_key => ${sqlText(request.metric_key)},
    p_metric_version => ${request.metric_version},
    p_concept_key => ${sqlText(request.concept_key)},
    p_party_role => ${sqlText(request.party.role)},
    p_party_value => ${sqlText(request.party.value)},
    p_party_capacity => ${sqlText(request.party.capacity)},
    p_basis_key => ${sqlText(request.basis_key)},
    p_subject_deal_key => ${request.subject_deal_key === null ? 'NULL' : sqlText(request.subject_deal_key)}
  )`;
}

function evidenceSql(subjectMarket, inventoryMarket, querySemanticsDigest) {
  return `SELECT jsonb_build_object(
    'active_pointer', public.canonical_v2_active_release('staging'),
    'query_page', public.canonical_v2_query_page(
      p_environment => 'staging',
      p_serving_namespace_id => '${CANDIDATE.serving_namespace_id}',
      p_corpus_release_id => '${CANDIDATE.corpus_release_id}',
      p_contract_fingerprint => '${CANDIDATE.contract_fingerprint}',
      p_query_semantics_digest => '${querySemanticsDigest}',
      p_metric_key => '${METRIC.metric_key}',
      p_metric_version => ${METRIC.metric_version},
      p_concept_key => '${METRIC.concept_key}',
      p_party_role => '${METRIC.party.role}',
      p_party_value => '${METRIC.party.value}',
      p_party_capacity => '${METRIC.party.capacity}',
      p_basis_key => '${METRIC.basis_key}',
      p_page_size => 2
    ),
    'subject_market', ${marketSql(subjectMarket)},
    'inventory_market', ${marketSql(inventoryMarket)},
    'exact_detail', public.canonical_v2_exact_detail(
      'staging',
      '${CANDIDATE.serving_namespace_id}',
      '${CANDIDATE.corpus_release_id}',
      '${CANDIDATE.contract_fingerprint}',
      '${CANDIDATE.application_deal_id}',
      '${CANDIDATE.row_serving_key}',
      '${CANDIDATE.source_detail_reference_id}'
    )
  ) AS evidence;`;
}

function readEvidence(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-serving-'));
  const file = join(directory, 'read-only.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10000ms';
${sql}
ROLLBACK;
`, { mode: 0o600 });
  try {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--linked', '--file', file, '--output', 'json'],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: MAX_RESULT_BYTES * 2 },
    );
    if (result.status !== 0) throw new Error(safeDiagnostic(`${result.stderr}\n${result.stdout}`));
    if (Buffer.byteLength(result.stdout, 'utf8') > MAX_RESULT_BYTES) {
      throw new Error('Canonical QXO serving response exceeded its bounded verification limit.');
    }
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.evidence) {
      throw new Error('Canonical QXO serving verification returned an invalid row set.');
    }
    return rows[0].evidence;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function assertActivePointer(pointer) {
  const expected = EXPECTED_RELEASE;
  if (!pointer
    || pointer.generation !== expected.generation
    || pointer.corpus_release_id !== expected.corpus_release_id
    || pointer.serving_namespace_id !== expected.serving_namespace_id
    || pointer.candidate_release_manifest_id !== expected.candidate_manifest_id
    || pointer.corpus_release_id === CANDIDATE.corpus_release_id
    || pointer.serving_namespace_id === CANDIDATE.serving_namespace_id) {
    throw new Error('Active staging release moved or the QXO candidate is no longer isolated.');
  }
}

function assertQueryPage(page, querySemanticsDigest) {
  if (page?.schema_version !== 'CANONICAL_QUERY_PAGE_RESULT/V2'
    || page.serving_namespace_id !== CANDIDATE.serving_namespace_id
    || page.corpus_release_id !== CANDIDATE.corpus_release_id
    || page.contract_fingerprint !== CANDIDATE.contract_fingerprint
    || page.query_semantics_digest !== querySemanticsDigest
    || page.total_count !== 1
    || page.page_count !== 1
    || page.next_cursor !== null
    || !Array.isArray(page.rows)
    || page.rows.length !== 1) {
    throw new Error('Inactive QXO query page is outside its bounded release partition.');
  }
  const row = page.rows[0];
  validateSharedServingRow(row);
  const componentSlots = row.canonical_result.components.map((component) => component.component_slot_key);
  if (row.row_serving_key !== CANDIDATE.row_serving_key
    || row.canonical_payload_digest !== CANDIDATE.row_payload_digest
    || row.governed_deal_key !== CANDIDATE.governed_deal_key
    || row.canonical_result.concept_key !== METRIC.concept_key
    || row.canonical_result.market_context.metric_key !== METRIC.metric_key
    || canonicalJson(row.canonical_result.party) !== canonicalJson(METRIC.party)
    || canonicalJson(componentSlots) !== canonicalJson([
      'CAPITALISATION_LIMBS_I_AND_III',
      'ACCURACY_EXCEPTION',
      'KNOWLEDGE_QUALIFIER_LIMB_I',
      'KNOWLEDGE_QUALIFIER_LIMB_III',
    ])) {
    throw new Error('Inactive QXO shared row identity or legal components have drifted.');
  }
  return row;
}

function assertMarkets(subject, inventory, row, subjectRequest, inventoryRequest) {
  validateMarketCohortResult(subject, subjectRequest);
  validateMarketCohortResult(inventory, inventoryRequest);
  const embedded = row.canonical_result.market_context.cohort;
  if (canonicalJson(embedded) !== canonicalJson({
    cohort_digest: subject.cohort_digest,
    counts: subject.counts,
    distribution: subject.distribution,
    exclusions: subject.exclusions,
  })) {
    throw new Error('Inactive QXO shared row and live subject cohort are not identical.');
  }
  if (inventory.counts.eligible_deals !== 1
    || inventory.counts.applicable_deals !== 1
    || inventory.counts.examined_deals !== 1
    || inventory.counts.present_deals !== 1
    || inventory.counts.comparable_deals !== 1
    || inventory.counts.distribution_deals !== 1
    || inventory.counts.excluded_deals !== 1
    || inventory.counts.observation_slots !== 1
    || inventory.counts.excluded_slots !== 1
    || inventory.distribution.length !== 1
    || inventory.distribution[0].canonical_value !== 'MAT_ALL_RESPECTS_DE_MINIMIS'
    || inventory.exclusions.length !== 1
    || inventory.exclusions[0].reason_code !== 'RESULT_NOT_COMPARABLE') {
    throw new Error('Inactive QXO market inventory lost its comparable or excluded terminal slot.');
  }
}

function assertExactDetail(result, row) {
  const request = compileServingExactDetailRequest({
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    corpus_release_id: CANDIDATE.corpus_release_id,
    contract_fingerprint: CANDIDATE.contract_fingerprint,
    application_deal_id: CANDIDATE.application_deal_id,
    row_serving_key: CANDIDATE.row_serving_key,
    source_detail_reference_id: CANDIDATE.source_detail_reference_id,
  });
  validateServingExactDetailResult(result, request);
  const detailPackage = result.package;
  const response = detailPackage.detail_payloads[0]?.response_body;
  const relationship = response?.relationships?.[0];
  if (result.exact_detail_package_digest !== CANDIDATE.exact_detail_package_digest
    || result.exact_detail_package_digest !== contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage)
    || canonicalJson(detailPackage.row) !== canonicalJson(row)
    || detailPackage.detail_payloads.length !== 1
    || response?.components?.length !== 4
    || response?.excerpts?.length !== 5
    || response?.relationships?.length !== 1
    || relationship.target_occurrence_ids.length !== 2
    || relationship.targets.length !== 2) {
    throw new Error('Inactive QXO exact detail is incomplete or outside the selected shared row.');
  }
}

function buildAttestation(evidence, querySemanticsDigest, subjectMarket, inventoryMarket) {
  assertActivePointer(evidence.active_pointer);
  const row = assertQueryPage(evidence.query_page, querySemanticsDigest);
  assertMarkets(evidence.subject_market, evidence.inventory_market, row, subjectMarket, inventoryMarket);
  assertExactDetail(evidence.exact_detail, row);
  const body = {
    schema_version: 'QXO_CAPITALISATION_INACTIVE_SERVING_ATTESTATION/V1',
    environment: 'staging',
    project_ref: PROJECT.ref,
    corpus_release_id: CANDIDATE.corpus_release_id,
    candidate_release_manifest_id: CANDIDATE.candidate_release_manifest_id,
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    active_release_generation: evidence.active_pointer.generation,
    active_pointer_unchanged: true,
    candidate_remains_inactive: true,
    rpc_calls: 4,
    query_rows: evidence.query_page.page_count,
    subject_cohort_deals: evidence.subject_market.counts.comparable_deals,
    inventory_observations: evidence.inventory_market.counts.observation_slots,
    inventory_exclusions: evidence.inventory_market.counts.excluded_slots,
    exact_detail_components: evidence.exact_detail.package.detail_payloads[0].response_body.components.length,
    exact_detail_excerpts: evidence.exact_detail.package.detail_payloads[0].response_body.excerpts.length,
    row_serving_key: CANDIDATE.row_serving_key,
    exact_detail_package_digest: CANDIDATE.exact_detail_package_digest,
  };
  return {
    ...body,
    attestation_id: contentId('QXO_CAPITALISATION_INACTIVE_SERVING_ATTESTATION/V1', body),
  };
}

if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
  fail('Usage: node scripts/canonical-v2-staging-qxo-capitalisation-serving.mjs --verify');
}

try {
  guardProject();
  const subjectMarket = marketRequest(CANDIDATE.governed_deal_key);
  const inventoryMarket = marketRequest(null);
  const querySemanticsDigest = contentId('QXO_CAPITALISATION_INACTIVE_QUERY/V1', {
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    corpus_release_id: CANDIDATE.corpus_release_id,
    metric: METRIC,
  });
  const evidence = readEvidence(evidenceSql(subjectMarket, inventoryMarket, querySemanticsDigest));
  process.stdout.write(`${canonicalJson(buildAttestation(
    evidence,
    querySemanticsDigest,
    subjectMarket,
    inventoryMarket,
  ))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical QXO serving verification failed.');
}
