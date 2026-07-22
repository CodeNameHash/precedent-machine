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
const MODE = process.argv[2];
const ACTION_MODE = MODE === '--actions-verify';
const REMATCH_MODE = MODE === '--rematch-verify';
const BASE_CANDIDATE = Object.freeze({
  corpus_release_id: 'fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36',
  candidate_release_manifest_id: '620bcbba3b072f1a475989adad9e4ce708b4fce288fa59036e549dc82544b48d',
  serving_namespace_id: 'cb2d9e9db4e059b28d29f60012d25efec77b3eda2d33cf9911c434bcbb667b44',
  contract_fingerprint: '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d',
  application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
  governed_deal_key: 'deal:qxo-topbuild',
});
const ACTION_CANDIDATE = Object.freeze({
  ...BASE_CANDIDATE,
  corpus_release_id: '91cdee1d2cca11fdaa7141069c3daf9d048deabdbe36573bb214cafc7cf34430',
  candidate_release_manifest_id: 'db29af6e548def369bee9c2fbe2be16959078f9461746caa1854f4eeceaea43c',
  serving_namespace_id: '3ab6ca118c32bad5d5e9ce662a7c3f7cc06cddda03b7c717cccd6ed9dfa10a65',
});
const REMATCH_CANDIDATE = Object.freeze({
  ...BASE_CANDIDATE,
  corpus_release_id: 'd9157984ee4948046c3cf7d3195cb0136502cdf739fc24dfd05d0ae7c60f1f5a',
  candidate_release_manifest_id: 'a9cbb8810053d13ad76efcffc769ddf83ed22d1cb446493967f281489182d0b2',
  serving_namespace_id: 'efa8f7c2643448ad9380a4a16556d76f09879809c1d21e49f479e8cf070f204d',
});
const CANDIDATE = ACTION_MODE
  ? ACTION_CANDIDATE
  : REMATCH_MODE
    ? REMATCH_CANDIDATE
    : BASE_CANDIDATE;
const NOTICE_SPECS = Object.freeze({
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
const ACTION_SPECS = Object.freeze([
  Object.freeze({
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    concept_key: 'NOSOL-PROHIBIT',
    basis_key: 'PROHIBITED_ACTION_CODE',
    party: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
    row_serving_key: 'a62379be99684c6ccaaee5768e48a59f4e9f010ddaafe363021f1b0888552153',
    row_payload_digest: '8c3f32c26e858b591708128c72080d4c83b4b258ed0bbd7cad7ea32dc46a0d90',
    source_detail_reference_id: '47139f908694dc1a6a5ea82e5fb3027db90c9b30214639b26c6c5566ff07bc63',
    exact_detail_package_digest: 'ffc4a8dc9e836b58917943a87e6f91bcf28e6cdc4d6fa49622c306e79bfba356',
    canonical_value: 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
    expected_label: 'Solicit, assist, initiate, encourage or facilitate',
    relationship_count: 1,
    excerpt_count: 3,
    exception_operation: 'PERMITS_LIMITED_INFORMATION_SHARING',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    concept_key: 'NOSOL-PROHIBIT',
    basis_key: 'PROHIBITED_ACTION_CODE',
    party: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
    row_serving_key: '2796cdb838d1639bc63b8e3d66644db4a1a3168a9385160c706a530bb37a7ecd',
    row_payload_digest: '191963e1f3773afb6eff23aea9ef4afd57a7dd3c5bb9704d1316ca725e3a94c5',
    source_detail_reference_id: '48781227e2c0d26448a9cd799f2f5d88956ee9621e8074a8f4a09b6d2e631cd6',
    exact_detail_package_digest: 'ab7d5e8e670e52ec382c9c66145825766610c1ca536d7deec9ee82595e271283',
    canonical_value: 'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
    expected_label: 'Enter, continue or participate in discussions or negotiations',
    relationship_count: 1,
    excerpt_count: 3,
    exception_operation: 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    concept_key: 'NOSOL-PROHIBIT',
    basis_key: 'PROHIBITED_ACTION_CODE',
    party: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
    row_serving_key: '05b93b619e7283b368e4aea64083cf39ad5cee63d742a8b229e870f1390e0c64',
    row_payload_digest: '3f0700e0086adde0f39f04919052cf3fd23a4b95332a89faeb3270f9912f18a1',
    source_detail_reference_id: '4e0a50986393e52fa16fb022807d3f97caa6132c4edc8a728dd389b57bf2c7e9',
    exact_detail_package_digest: '0ed39f71a58d0b4a9d3682406a29d64a00b83f6225f27e0a3b8efc4058614a74',
    canonical_value: 'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
    expected_label: 'Enter an alternative transaction agreement',
    relationship_count: 0,
    excerpt_count: 2,
    exception_operation: null,
  }),
  Object.freeze({
    metric_key: 'NO_SHOP_PROHIBITED_ACTION',
    concept_key: 'NOSOL-PROHIBIT',
    basis_key: 'PROHIBITED_ACTION_CODE',
    party: Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' }),
    row_serving_key: 'afbc3c84db9a54a3b5f2e211302b4a0ef18071c590b4dde1b440e1d0d5a15be5',
    row_payload_digest: '2d96e3014d3aac39cefc77c8d3de798b3522fe9d4f2e5fd88c91b6f8bae18b64',
    source_detail_reference_id: '0dff71758ce5a81fee89e03d445840736ec396913590851e7e3a264816d0332f',
    exact_detail_package_digest: '936aa24a543e098b9c577f6d56b4a2dfde533a55b74305fabd44b07967fa1d9d',
    canonical_value: 'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
    expected_label: 'Approve, authorise or announce an intention to do any prohibited action',
    relationship_count: 0,
    excerpt_count: 2,
    exception_operation: null,
  }),
]);
const REMATCH_SPEC = Object.freeze({
  metric_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
  concept_key: 'NOSOL-REMATCH',
  basis_key: 'DAYS:BUSINESS:MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
  party: Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' }),
  row_serving_key: 'c57a62f804b1b4b46daced08ede88a5e0ce3022a03fee3ecf2e419840b791f24',
  row_payload_digest: '9b078692fa1e2c30e4dde607eabef2ce6872813042ecad8990a66f557c425817',
  source_detail_reference_id: 'ba93b9d154e8b84f398d58e9b4f2ac9df99df518ead09678b276ca84e2f1e3e6',
  exact_detail_package_digest: '178ee1a488f4b7daa77503d7e7a2ca596fd2caf40b3b82cc2f0c279ac8412e38',
  canonical_value: '4',
  day_basis: 'BUSINESS',
  clock_text: 'a new four (4) business day notice period',
  expected_label: '4 business days',
});
const SPECS = NOTICE_SPECS;
const MAX_RESULT_BYTES = 256 * 1024;

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
    p_page_size => ${ACTION_MODE ? 4 : REMATCH_MODE ? 1 : 2}
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
  if (ACTION_MODE) {
    const detailFields = ACTION_SPECS.map((spec, index) => (
      `'action_detail_${index}', ${exactDetailSql(spec)}`
    ));
    return `SELECT jsonb_build_object(
    'active_pointer', public.canonical_v2_active_release('staging'),
    'action_query', ${querySql(ACTION_SPECS[0], digests.action)},
    'action_subject', ${marketSql(requests.actionSubject)},
    'action_inventory', ${marketSql(requests.actionInventory)},
    ${detailFields.join(',\n    ')}
  ) AS evidence;`;
  }
  if (REMATCH_MODE) {
    return `SELECT jsonb_build_object(
    'active_pointer', public.canonical_v2_active_release('staging'),
    'rematch_query', ${querySql(REMATCH_SPEC, digests.rematch)},
    'rematch_subject', ${marketSql(requests.rematchSubject)},
    'rematch_inventory', ${marketSql(requests.rematchInventory)},
    'rematch_detail', ${exactDetailSql(REMATCH_SPEC)}
  ) AS evidence;`;
  }
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

function assertActionQueryPage(page, semanticsDigest) {
  if (page?.schema_version !== 'CANONICAL_QUERY_PAGE_RESULT/V1'
    || page.serving_namespace_id !== CANDIDATE.serving_namespace_id
    || page.corpus_release_id !== CANDIDATE.corpus_release_id
    || page.query_semantics_digest !== semanticsDigest
    || page.total_count !== ACTION_SPECS.length
    || page.page_count !== ACTION_SPECS.length
    || page.next_cursor !== null
    || page.rows?.length !== ACTION_SPECS.length) {
    throw new Error('Inactive QXO prohibited-action query page is outside its release partition.');
  }
  const rowsByValue = new Map();
  page.rows.forEach((row) => {
    validateSharedServingRow(row);
    const value = row.canonical_result.market_context.subject_observation.canonical_value;
    if (rowsByValue.has(value)) throw new Error('Inactive QXO prohibited-action query returned a duplicate value.');
    rowsByValue.set(value, row);
  });
  return ACTION_SPECS.map((spec) => {
    const row = rowsByValue.get(spec.canonical_value);
    const adapted = row && adaptSharedServingRow(row);
    const metric = adapted?.data.byRow[adapted.row_key]?.metrics?.[spec.metric_key];
    const legalTerms = metric?.subject?.legalTerms || [];
    const exception = legalTerms.find((term) => term.key === 'permitted_exception');
    const conditions = legalTerms.find((term) => term.key === 'exception_conditions');
    if (!row
      || row.row_serving_key !== spec.row_serving_key
      || row.canonical_payload_digest !== spec.row_payload_digest
      || row.governed_deal_key !== CANDIDATE.governed_deal_key
      || row.canonical_result.concept_key !== spec.concept_key
      || canonicalJson(row.canonical_result.party) !== canonicalJson(spec.party)
      || metric?.subject?.label !== spec.expected_label
      || row.canonical_result.components[0].bounded_relationship_effects.length !== spec.relationship_count) {
      throw new Error(`Inactive QXO prohibited-action row ${spec.canonical_value} has drifted.`);
    }
    if (spec.exception_operation) {
      const effect = row.canonical_result.components[0].bounded_relationship_effects[0]?.effect;
      if (effect?.legal_operation !== spec.exception_operation
        || !exception
        || !conditions
        || !conditions.value.includes('before stockholder approval')
        || !conditions.value.includes('fiduciary duties')) {
        throw new Error(`Inactive QXO prohibited-action exception ${spec.canonical_value} is incomplete.`);
      }
    } else if (exception || conditions) {
      throw new Error(`Inactive QXO prohibited-action row ${spec.canonical_value} invented an exception.`);
    }
    return row;
  });
}

function assertActionMarkets(subject, inventory, rows, subjectRequest, inventoryRequest) {
  validateMarketCohortResult(subject, subjectRequest);
  validateMarketCohortResult(inventory, inventoryRequest);
  const emptyCounts = Object.values(subject.counts).every((value) => value === 0);
  if (!emptyCounts || subject.distribution.length !== 0 || subject.exclusions.length !== 0) {
    throw new Error('Inactive QXO prohibited-action selected-deal exclusion has drifted.');
  }
  rows.forEach((row) => {
    const embedded = row.canonical_result.market_context.cohort;
    if (canonicalJson(embedded) !== canonicalJson({
      cohort_digest: subject.cohort_digest,
      counts: subject.counts,
      distribution: subject.distribution,
      exclusions: subject.exclusions,
    })) throw new Error('Inactive QXO prohibited-action embedded market cohort has drifted.');
  });
  const expectedValues = ACTION_SPECS.map((spec) => spec.canonical_value).sort();
  const actualValues = inventory.distribution.map((item) => item.canonical_value).sort();
  if (inventory.counts.eligible_deals !== 1
    || inventory.counts.applicable_deals !== 1
    || inventory.counts.examined_deals !== 1
    || inventory.counts.present_deals !== 1
    || inventory.counts.comparable_deals !== 1
    || inventory.counts.distribution_deals !== 1
    || inventory.counts.excluded_deals !== 0
    || inventory.counts.observation_slots !== ACTION_SPECS.length
    || inventory.counts.excluded_slots !== 0
    || canonicalJson(actualValues) !== canonicalJson(expectedValues)
    || inventory.distribution.some((item) => item.subject_count !== 1 || item.deal_count !== 1)
    || inventory.exclusions.length !== 0) {
    throw new Error('Inactive QXO prohibited-action market inventory has drifted.');
  }
}

function assertActionExactDetail(spec, result, row) {
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
  const relationships = response?.relationships || [];
  const exactTexts = response?.excerpts?.map((excerpt) => excerpt.exact_text) || [];
  if (result.exact_detail_package_digest !== spec.exact_detail_package_digest
    || result.exact_detail_package_digest !== contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage)
    || canonicalJson(detailPackage.row) !== canonicalJson(row)
    || response?.components?.length !== 1
    || relationships.length !== spec.relationship_count
    || exactTexts.length !== spec.excerpt_count
    || claim?.canonical_value !== spec.canonical_value
    || claim?.unit !== null
    || claim?.day_basis !== null
    || !exactTexts.includes(claim.raw_value)
    || !exactTexts.some((text) => text.length > claim.raw_value.length && text.includes(claim.raw_value))) {
    throw new Error(`Inactive QXO prohibited-action exact detail ${spec.canonical_value} is incomplete.`);
  }
  if (spec.exception_operation
    && relationships[0]?.effect?.legal_operation !== spec.exception_operation) {
    throw new Error(`Inactive QXO prohibited-action exact exception ${spec.canonical_value} has drifted.`);
  }
}

function buildActionAttestation(evidence, requests, digests) {
  assertActivePointer(evidence.active_pointer);
  const rows = assertActionQueryPage(evidence.action_query, digests.action);
  assertActionMarkets(
    evidence.action_subject,
    evidence.action_inventory,
    rows,
    requests.actionSubject,
    requests.actionInventory,
  );
  ACTION_SPECS.forEach((spec, index) => assertActionExactDetail(
    spec,
    evidence[`action_detail_${index}`],
    rows[index],
  ));
  const body = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_INACTIVE_SERVING_ATTESTATION/V1',
    environment: 'staging',
    project_ref: PROJECT.ref,
    corpus_release_id: CANDIDATE.corpus_release_id,
    candidate_release_manifest_id: CANDIDATE.candidate_release_manifest_id,
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    active_release_generation: evidence.active_pointer.generation,
    active_pointer_unchanged: true,
    candidate_remains_inactive: true,
    rpc_calls: 8,
    query_rows: rows.length,
    inventory_observations: evidence.action_inventory.counts.observation_slots,
    exact_detail_packages: ACTION_SPECS.length,
    exact_detail_excerpts: ACTION_SPECS.reduce((sum, spec) => sum + spec.excerpt_count, 0),
    typed_exception_rows: ACTION_SPECS.filter((spec) => spec.exception_operation).length,
  };
  return { ...body, attestation_id: contentId('QXO_NO_SHOP_ACTIONS_INACTIVE_SERVING_ATTESTATION/V1', body) };
}

function buildRematchAttestation(evidence, requests, digests) {
  assertActivePointer(evidence.active_pointer);
  const row = assertQueryPage(REMATCH_SPEC, evidence.rematch_query, digests.rematch);
  assertMarkets(
    REMATCH_SPEC,
    evidence.rematch_subject,
    evidence.rematch_inventory,
    row,
    requests.rematchSubject,
    requests.rematchInventory,
  );
  assertExactDetail(REMATCH_SPEC, evidence.rematch_detail, row);
  const body = {
    schema_version: 'QXO_NO_SHOP_REMATCH_INACTIVE_SERVING_ATTESTATION/V1',
    environment: 'staging',
    project_ref: PROJECT.ref,
    corpus_release_id: CANDIDATE.corpus_release_id,
    candidate_release_manifest_id: CANDIDATE.candidate_release_manifest_id,
    serving_namespace_id: CANDIDATE.serving_namespace_id,
    active_release_generation: evidence.active_pointer.generation,
    active_pointer_unchanged: true,
    candidate_remains_inactive: true,
    rpc_calls: 5,
    query_rows: evidence.rematch_query.page_count,
    inventory_observations: evidence.rematch_inventory.counts.observation_slots,
    exact_detail_packages: 1,
    exact_detail_excerpts: evidence.rematch_detail.package.detail_payloads[0].response_body.excerpts.length,
    subsequent_match_business_days: REMATCH_SPEC.canonical_value,
  };
  return { ...body, attestation_id: contentId('QXO_NO_SHOP_REMATCH_INACTIVE_SERVING_ATTESTATION/V1', body) };
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

if (process.argv.length !== 3 || !['--verify', '--actions-verify', '--rematch-verify'].includes(MODE)) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-serving.mjs --verify|--actions-verify|--rematch-verify');
}

try {
  guardProject();
  const requests = ACTION_MODE ? {
    actionSubject: marketRequest(ACTION_SPECS[0], CANDIDATE.governed_deal_key),
    actionInventory: marketRequest(ACTION_SPECS[0], null),
  } : REMATCH_MODE ? {
    rematchSubject: marketRequest(REMATCH_SPEC, CANDIDATE.governed_deal_key),
    rematchInventory: marketRequest(REMATCH_SPEC, null),
  } : {
    noticeSubject: marketRequest(SPECS.notice, CANDIDATE.governed_deal_key),
    noticeInventory: marketRequest(SPECS.notice, null),
    matchSubject: marketRequest(SPECS.match, CANDIDATE.governed_deal_key),
    matchInventory: marketRequest(SPECS.match, null),
  };
  const digests = ACTION_MODE ? {
    action: contentId('QXO_NO_SHOP_ACTIONS_INACTIVE_QUERY/V1', {
      serving_namespace_id: CANDIDATE.serving_namespace_id,
      corpus_release_id: CANDIDATE.corpus_release_id,
      metric: ACTION_SPECS[0].metric_key,
    }),
  } : REMATCH_MODE ? {
    rematch: contentId('QXO_NO_SHOP_REMATCH_INACTIVE_QUERY/V1', {
      serving_namespace_id: CANDIDATE.serving_namespace_id,
      corpus_release_id: CANDIDATE.corpus_release_id,
      metric: REMATCH_SPEC.metric_key,
    }),
  } : Object.fromEntries(Object.entries(SPECS).map(([key, spec]) => [key, contentId(
    'QXO_NO_SHOP_INACTIVE_QUERY/V1',
    { serving_namespace_id: CANDIDATE.serving_namespace_id, corpus_release_id: CANDIDATE.corpus_release_id, metric: spec },
  )]));
  const evidence = readEvidence(evidenceSql(requests, digests));
  process.stdout.write(`${canonicalJson(ACTION_MODE
    ? buildActionAttestation(evidence, requests, digests)
    : REMATCH_MODE
      ? buildRematchAttestation(evidence, requests, digests)
      : buildAttestation(evidence, requests, digests))}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'Canonical QXO no-shop serving verification failed.');
}
