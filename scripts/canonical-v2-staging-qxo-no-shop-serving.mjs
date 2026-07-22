#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileMarketCohortRequest, validateMarketCohortResult } = require('../lib/canonical-v2/market-cohort-query');
const { compileServingExactDetailRequest, validateServingExactDetailResult } = require('../lib/canonical-v2/serving-exact-detail');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { EXPECTED_RELEASE } = require('../lib/canonical-v2/vertical-slice-attestation');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({ ref: 'sjumbznveyyiizhwvixj', name: 'deal-corpus-canonical-v2-staging' });
const CANDIDATE = Object.freeze({
  corpus_release_id: 'fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36',
  candidate_release_manifest_id: '620bcbba3b072f1a475989adad9e4ce708b4fce288fa59036e549dc82544b48d',
  serving_namespace_id: 'cb2d9e9db4e059b28d29f60012d25efec77b3eda2d33cf9911c434bcbb667b44',
  contract_fingerprint: '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d',
  application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
  governed_deal_key: 'deal:qxo-topbuild',
});
const SPECS = Object.freeze({
  notice: Object.freeze({
    metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    concept_key: 'NOSOL-NOTICE',
    basis_key: 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL',
    party: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
    row_serving_key: '324be50f920725e1c4eb86b29da4503e32815745611c305b29b34c47ea596188',
    row_payload_digest: '583420c23cbf2cb812ba6f878e33d1881a71d81dbc2a0d7f3b877e85d6662b0c',
    source_detail_reference_id: 'b5c43d56c4db43f71b80b3b34853cb10f03894486c152754bb5de83aa3fb7b08',
    exact_detail_package_digest: '325bb3fe87f36a5a86531703b1d2d0ff80743b62b1d4f7256ccfc5cb3510c595',
    canonical_value: '1',
    day_basis: 'ELAPSED',
    clock_text: 'twenty-four (24) hours after receipt',
    expected_label: '1 elapsed day',
  }),
  match: Object.freeze({
    metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    concept_key: 'NOSOL-MATCH',
    basis_key: 'DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE',
    party: Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' }),
    row_serving_key: '030f96f256f2ba43fb71469d69f62f45ec4e408b85dd7285a055134664be342f',
    row_payload_digest: '53ac26f9f1dced3f97e337a17508e53946eca9952486385927c020231575f9e0',
    source_detail_reference_id: 'd5d3313c2abb83ec8802fd2ec20136c8ea38bfd535c4905c41ff0f612454f4fd',
    exact_detail_package_digest: '63c48962481c45b08a0885fc024965f11b86f28745bbdc9c4e4fb72ec42bd59b',
    canonical_value: '4',
    day_basis: 'BUSINESS',
    clock_text: 'four (4) business days’ prior written notice',
    expected_label: '4 business days',
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

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function marketRequest(spec, subjectDealKey) {
  return compileMarketCohortRequest({
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    corpus_release_id: CANDIDATE.corpus_release_id,
    contract_fingerprint: CANDIDATE.contract_fingerprint,
    metric_key: spec.metric_key,
    metric_version: 1,
    concept_key: spec.concept_key,
    party: spec.party,
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

function querySql(spec, semanticsDigest) {
  return `public.canonical_v2_query_page(
    p_environment => 'staging',
    p_serving_namespace_id => '${CANDIDATE.serving_namespace_id}',
    p_corpus_release_id => '${CANDIDATE.corpus_release_id}',
    p_contract_fingerprint => '${CANDIDATE.contract_fingerprint}',
    p_query_semantics_digest => '${semanticsDigest}',
    p_metric_key => '${spec.metric_key}',
    p_metric_version => 1,
    p_concept_key => '${spec.concept_key}',
    p_party_role => '${spec.party.role}',
    p_party_value => '${spec.party.value}',
    p_party_capacity => '${spec.party.capacity}',
    p_basis_key => '${spec.basis_key}',
    p_page_size => 2
  )`;
}

function exactDetailSql(spec) {
  return `public.canonical_v2_exact_detail(
    'staging',
    '${CANDIDATE.serving_namespace_id}',
    '${CANDIDATE.corpus_release_id}',
    '${CANDIDATE.contract_fingerprint}',
    '${CANDIDATE.application_deal_id}',
    '${spec.row_serving_key}',
    '${spec.source_detail_reference_id}'
  )`;
}

function evidenceSql(requests, digests) {
  return `SELECT jsonb_build_object(
    'active_pointer', public.canonical_v2_active_release('staging'),
    'notice_query', ${querySql(SPECS.notice, digests.notice)},
    'match_query', ${querySql(SPECS.match, digests.match)},
    'notice_subject', ${marketSql(requests.noticeSubject)},
    'notice_inventory', ${marketSql(requests.noticeInventory)},
    'match_subject', ${marketSql(requests.matchSubject)},
    'match_inventory', ${marketSql(requests.matchInventory)},
    'notice_detail', ${exactDetailSql(SPECS.notice)},
    'match_detail', ${exactDetailSql(SPECS.match)}
  ) AS evidence;`;
}

function readEvidence(sql) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-no-shop-serving-'));
  const file = join(directory, 'read-only.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='10000ms';
${sql}
ROLLBACK;
`, { mode: 0o600 });
  try {
    const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: MAX_RESULT_BYTES * 2,
    });
    if (result.status !== 0) throw new Error('Canonical QXO no-shop serving verification failed.');
    if (Buffer.byteLength(result.stdout, 'utf8') > MAX_RESULT_BYTES) {
      throw new Error('Canonical QXO no-shop serving response exceeded its bounded verification limit.');
    }
    const rows = JSON.parse(result.stdout)?.rows;
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.evidence) {
      throw new Error('Canonical QXO no-shop serving verification returned an invalid row set.');
    }
    return rows[0].evidence;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function assertActivePointer(pointer) {
  if (!pointer
    || pointer.generation !== EXPECTED_RELEASE.generation
    || pointer.corpus_release_id !== EXPECTED_RELEASE.corpus_release_id
    || pointer.serving_namespace_id !== EXPECTED_RELEASE.serving_namespace_id
    || pointer.candidate_release_manifest_id !== EXPECTED_RELEASE.candidate_manifest_id
    || pointer.corpus_release_id === CANDIDATE.corpus_release_id) {
    throw new Error('Active staging release moved or the combined QXO candidate is no longer isolated.');
  }
}

function assertQueryPage(spec, page, semanticsDigest) {
  if (page?.schema_version !== 'CANONICAL_QUERY_PAGE_RESULT/V1'
    || page.serving_namespace_id !== CANDIDATE.serving_namespace_id
    || page.corpus_release_id !== CANDIDATE.corpus_release_id
    || page.query_semantics_digest !== semanticsDigest
    || page.total_count !== 1
    || page.page_count !== 1
    || page.next_cursor !== null
    || page.rows?.length !== 1) {
    throw new Error(`Inactive QXO ${spec.metric_key} query page is outside its release partition.`);
  }
  const row = page.rows[0];
  validateSharedServingRow(row);
  const adapted = adaptSharedServingRow(row);
  const metric = adapted.data.byRow[adapted.row_key]?.metrics?.[spec.metric_key];
  if (row.row_serving_key !== spec.row_serving_key
    || row.canonical_payload_digest !== spec.row_payload_digest
    || row.governed_deal_key !== CANDIDATE.governed_deal_key
    || row.canonical_result.concept_key !== spec.concept_key
    || row.canonical_result.market_context.metric_key !== spec.metric_key
    || canonicalJson(row.canonical_result.party) !== canonicalJson(spec.party)
    || metric?.subject?.label !== spec.expected_label) {
    throw new Error(`Inactive QXO ${spec.metric_key} shared row or UI adapter has drifted.`);
  }
  return row;
}

function assertMarkets(spec, subject, inventory, row, subjectRequest, inventoryRequest) {
  validateMarketCohortResult(subject, subjectRequest);
  validateMarketCohortResult(inventory, inventoryRequest);
  const embedded = row.canonical_result.market_context.cohort;
  if (canonicalJson(embedded) !== canonicalJson({
    cohort_digest: subject.cohort_digest,
    counts: subject.counts,
    distribution: subject.distribution,
    exclusions: subject.exclusions,
  })) throw new Error(`Inactive QXO ${spec.metric_key} embedded market cohort has drifted.`);
  if (inventory.counts.eligible_deals !== 1
    || inventory.counts.applicable_deals !== 1
    || inventory.counts.examined_deals !== 1
    || inventory.counts.present_deals !== 1
    || inventory.counts.comparable_deals !== 1
    || inventory.counts.distribution_deals !== 1
    || inventory.counts.excluded_deals !== 0
    || inventory.counts.observation_slots !== 1
    || inventory.counts.excluded_slots !== 0
    || inventory.distribution.length !== 1
    || inventory.distribution[0].canonical_value !== spec.canonical_value
    || inventory.exclusions.length !== 0) {
    throw new Error(`Inactive QXO ${spec.metric_key} market inventory has drifted.`);
  }
}

function assertExactDetail(spec, result, row) {
  const request = compileServingExactDetailRequest({
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    corpus_release_id: CANDIDATE.corpus_release_id,
    contract_fingerprint: CANDIDATE.contract_fingerprint,
    application_deal_id: CANDIDATE.application_deal_id,
    row_serving_key: spec.row_serving_key,
    source_detail_reference_id: spec.source_detail_reference_id,
  });
  validateServingExactDetailResult(result, request);
  const detailPackage = result.package;
  const response = detailPackage.detail_payloads[0]?.response_body;
  const claim = response?.components?.[0]?.claim;
  const exactTexts = response?.excerpts?.map((excerpt) => excerpt.exact_text) || [];
  if (result.exact_detail_package_digest !== spec.exact_detail_package_digest
    || result.exact_detail_package_digest !== contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage)
    || canonicalJson(detailPackage.row) !== canonicalJson(row)
    || response?.components?.length !== 1
    || response?.relationships?.length !== 0
    || response?.excerpts?.length !== 2
    || claim?.raw_value !== spec.clock_text
    || claim?.canonical_value !== spec.canonical_value
    || claim?.unit !== 'DAYS'
    || claim?.day_basis !== spec.day_basis
    || !exactTexts.includes(spec.clock_text)
    || !exactTexts.some((text) => text.length > spec.clock_text.length && text.includes(spec.clock_text))) {
    throw new Error(`Inactive QXO ${spec.metric_key} exact detail is incomplete.`);
  }
}

function buildAttestation(evidence, requests, digests) {
  assertActivePointer(evidence.active_pointer);
  const noticeRow = assertQueryPage(SPECS.notice, evidence.notice_query, digests.notice);
  const matchRow = assertQueryPage(SPECS.match, evidence.match_query, digests.match);
  assertMarkets(SPECS.notice, evidence.notice_subject, evidence.notice_inventory, noticeRow,
    requests.noticeSubject, requests.noticeInventory);
  assertMarkets(SPECS.match, evidence.match_subject, evidence.match_inventory, matchRow,
    requests.matchSubject, requests.matchInventory);
  assertExactDetail(SPECS.notice, evidence.notice_detail, noticeRow);
  assertExactDetail(SPECS.match, evidence.match_detail, matchRow);
  const body = {
    schema_version: 'QXO_NO_SHOP_INACTIVE_SERVING_ATTESTATION/V1',
    environment: 'staging',
    project_ref: PROJECT.ref,
    corpus_release_id: CANDIDATE.corpus_release_id,
    candidate_release_manifest_id: CANDIDATE.candidate_release_manifest_id,
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    active_release_generation: evidence.active_pointer.generation,
    active_pointer_unchanged: true,
    candidate_remains_inactive: true,
    rpc_calls: 9,
    query_rows: evidence.notice_query.page_count + evidence.match_query.page_count,
    inventory_observations: evidence.notice_inventory.counts.observation_slots
      + evidence.match_inventory.counts.observation_slots,
    exact_detail_packages: 2,
    exact_detail_excerpts: evidence.notice_detail.package.detail_payloads[0].response_body.excerpts.length
      + evidence.match_detail.package.detail_payloads[0].response_body.excerpts.length,
    normalised_notice_days: SPECS.notice.canonical_value,
    business_match_days: SPECS.match.canonical_value,
  };
  return { ...body, attestation_id: contentId('QXO_NO_SHOP_INACTIVE_SERVING_ATTESTATION/V1', body) };
}

if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-serving.mjs --verify');
}

try {
  guardProject();
  const requests = {
    noticeSubject: marketRequest(SPECS.notice, CANDIDATE.governed_deal_key),
    noticeInventory: marketRequest(SPECS.notice, null),
    matchSubject: marketRequest(SPECS.match, CANDIDATE.governed_deal_key),
    matchInventory: marketRequest(SPECS.match, null),
  };
  const digests = Object.fromEntries(Object.entries(SPECS).map(([key, spec]) => [key, contentId(
    'QXO_NO_SHOP_INACTIVE_QUERY/V1',
    { serving_namespace_id: CANDIDATE.serving_namespace_id, corpus_release_id: CANDIDATE.corpus_release_id, metric: spec },
  )]));
  const evidence = readEvidence(evidenceSql(requests, digests));
  process.stdout.write(`${canonicalJson(buildAttestation(evidence, requests, digests))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical QXO no-shop serving verification failed.');
}
