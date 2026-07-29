#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_PATH = path.join(
  ROOT,
  'evidence/process-intelligence/baseline/storylines-evidence-inventory.json',
);
const CONTENT_ID_DOMAIN = 'PROCESS_INTELLIGENCE_STORYLINES_EVIDENCE_INVENTORY/V1';
const DATABASE_ID_DOMAIN = 'PROCESS_INTELLIGENCE_STORYLINES_DATABASE_SNAPSHOT/V1';
const DATABASE_SCHEMA_ID_DOMAIN = 'PROCESS_INTELLIGENCE_STORYLINES_DATABASE_SCHEMA/V1';
const REVIEWED_COMMIT = '77688ad8dab2b34e0a62ddba2a87f0ba70fab215';
const CURRENT_COMMIT = '356b8eaa27d9f904072da615139881dcb93eab0a';
const REVIEW_ARTIFACTS = Object.freeze([
  {
    stage: 'CODEX_REVIEW_BRIEF',
    commit: REVIEWED_COMMIT,
    path: 'docs/review/CODEX-REVIEW-BRIEF.md',
  },
  {
    stage: 'FABLE_ROUND_1',
    commit: '383ffeefa2ea4457578e3ccba12b83156f29e11e',
    path: 'docs/review/PROCESS-INTELLIGENCE-ADVERSARIAL-REVIEW.md',
  },
  {
    stage: 'FABLE_ROUND_2',
    commit: '76aa3ead126ff08864af18b77d91ac10d858e567',
    path: 'docs/review/PROCESS-INTELLIGENCE-REVIEW-ROUND-2.md',
  },
  {
    stage: 'CODEX_FABLE_RECONCILIATION',
    commit: '367aaf9ff3eb3d824bd9b46a4997c55592d819cb',
    path: 'docs/review/PROCESS-INTELLIGENCE-REVIEW-ROUND-2.md',
  },
  {
    stage: 'FABLE_ROUND_3_PASS',
    commit: '4ee4dcbc716e555b455e39d55734fd9b5d2d89bb',
    path: 'docs/review/PROCESS-INTELLIGENCE-REVIEW-ROUND-2.md',
  },
]);
const EXPECTED_TYPED_FAILURES = Object.freeze([
  ['EMPTY_QUESTION', 'empty_question'],
  ['NOT_A_STRING', 'not_a_string'],
  ['NO_LEXICAL_CONTENT', 'no_lexical_content'],
  ['UNTYPED_DIMENSION', 'untyped_dimension'],
  ['NO_PATTERN_MATCH', 'no_pattern_match'],
  ['LLM_DECLINED', 'llm_declined'],
  ['LLM_PROPOSAL_INVALID', 'llm_proposal_invalid'],
]);
const REQUIRED_DATABASE_TABLES = new Set([
  'edit_overlays',
  'event_corrections',
  'l2_revisions',
  'open_world_candidates',
  'pipeline_runs',
  'releases',
  'resolver_flags',
  'vocab_versions',
]);
const SELECTED_SOURCE_PATTERN = /^(?:migrations\/20260724|lib\/(?:publish|storylines|query-nl)\/|tests\/fixtures\/(?:rules|review)\/|docs\/reports\/term-posture-vocabulary\.json$)/;
const SOURCE_PATHSPECS = Object.freeze([
  'migrations/20260724*',
  'lib/publish',
  'lib/storylines',
  'lib/query-nl',
  'tests/fixtures/rules',
  'tests/fixtures/review',
  'docs/reports/term-posture-vocabulary.json',
]);

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

function fail(message) {
  throw new Error(`PROCESS_INTELLIGENCE_STORYLINES_BASELINE_INVALID: ${message}`);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value`);
  return value;
}

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

function gitFile(root, commit, filePath) {
  return git(root, ['show', `${commit}:${filePath}`], { encoding: null });
}

function commitMetadata(root, commit) {
  const [observedCommit, tree, authoredAt, subject] = git(
    root,
    ['show', '-s', '--format=%H%n%T%n%aI%n%s', commit],
  ).trimEnd().split('\n');
  if (observedCommit !== commit) fail(`commit ${commit} did not resolve exactly`);
  return {
    commit,
    tree,
    authored_at: authoredAt,
    subject,
  };
}

function selectedRepositoryInputs(storylinesRoot) {
  const raw = git(
    storylinesRoot,
    ['ls-tree', '-r', '-l', '-z', REVIEWED_COMMIT],
    { encoding: null },
  );
  const inputs = raw.toString('utf8').split('\0')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      if (tab < 0) fail(`cannot parse git tree row ${line}`);
      const [mode, objectType, blobOid, byteLength] = line.slice(0, tab).split(/\s+/);
      return {
        path: line.slice(tab + 1),
        mode,
        object_type: objectType,
        blob_oid: blobOid,
        byte_length: Number(byteLength),
      };
    })
    .filter((entry) => SELECTED_SOURCE_PATTERN.test(entry.path))
    .map((entry) => {
      const bytes = gitFile(storylinesRoot, REVIEWED_COMMIT, entry.path);
      if (bytes.length !== entry.byte_length) {
        fail(`${entry.path} byte length differs from its git tree`);
      }
      let evidenceKind;
      if (entry.path.startsWith('migrations/')) evidenceKind = 'PROTOTYPE_DATABASE_CONTRACT';
      else if (entry.path.startsWith('lib/publish/')) evidenceKind = 'PROTOTYPE_RELEASE_LOGIC';
      else if (entry.path.startsWith('lib/query-nl/')) evidenceKind = 'PROTOTYPE_NLP_LOGIC';
      else if (entry.path.startsWith('lib/storylines/')) evidenceKind = 'PROTOTYPE_SERVING_LOGIC';
      else if (entry.path.startsWith('tests/fixtures/')) evidenceKind = 'PROTOTYPE_TEST_FIXTURE';
      else evidenceKind = 'PROTOTYPE_VOCABULARY_REPORT';
      return {
        ...entry,
        sha256: sha256Hex(bytes),
        evidence_kind: evidenceKind,
        disposition: 'INCLUDE_AS_PROTOTYPE_EVIDENCE_ONLY',
        canonical_authority_granted: false,
      };
    });
  if (inputs.length !== 82) {
    fail(`selected repository input count is ${inputs.length}, expected 82`);
  }
  return inputs;
}

function currentCodeDelta(storylinesRoot) {
  const raw = git(storylinesRoot, [
    'diff',
    '--name-status',
    '--no-renames',
    '-z',
    `${REVIEWED_COMMIT}..${CURRENT_COMMIT}`,
    '--',
    ...SOURCE_PATHSPECS,
  ], { encoding: null }).toString('utf8').split('\0').filter(Boolean);
  if (raw.length % 2 !== 0) fail('cannot parse current-code delta');
  const changes = [];
  for (let index = 0; index < raw.length; index += 2) {
    changes.push({
      status: raw[index],
      path: raw[index + 1],
      disposition: 'RECORD_PROTOTYPE_STATE_CHANGE_ONLY',
      canonical_authority_granted: false,
    });
  }
  if (changes.length !== 42 || changes.some((change) => change.status !== 'D')) {
    fail('reviewed-to-current selected delta is not the expected 42 deletions');
  }
  return {
    reviewed_commit: REVIEWED_COMMIT,
    current_commit: CURRENT_COMMIT,
    selected_change_count: changes.length,
    deleted_selected_file_count: changes.length,
    changes,
    interpretation:
      'Current Storylines code deleted these reviewed files. The captured live database still contains V5 tables. Neither state has canonical PM authority.',
  };
}

function reviewRecord(storylinesRoot) {
  return REVIEW_ARTIFACTS.map((artifact) => {
    const bytes = gitFile(storylinesRoot, artifact.commit, artifact.path);
    return {
      ...artifact,
      commit_metadata: commitMetadata(storylinesRoot, artifact.commit),
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      disposition: 'INCLUDE_AS_REVIEW_HISTORY_ONLY',
      canonical_authority_granted: false,
    };
  });
}

function sanitizedExamples(examples) {
  return examples.map((example) => ({
    target: example.target,
    event_type: example.event_type,
    occurrence_id: example.id,
    quoted_text_byte_length: Buffer.byteLength(example.span, 'utf8'),
    quoted_text_sha256: sha256Hex(example.span),
    quoted_text_included: false,
  }));
}

function vocabularyEvidence(storylinesRoot) {
  const reportPath = 'docs/reports/term-posture-vocabulary.json';
  const bytes = gitFile(storylinesRoot, REVIEWED_COMMIT, reportPath);
  const report = JSON.parse(bytes.toString('utf8'));
  if (report.termRows.length !== 38
    || report.postureRows.length !== 12
    || report.sweep.length !== 282) {
    fail('vocabulary report counts changed');
  }
  const sanitizeRow = (row, kind) => ({
    kind,
    key: row.key,
    label: row.label,
    occurrence_count: row.count,
    deals: row.deals,
    examples: sanitizedExamples(row.examples),
    disposition: 'INCLUDE_AS_PROTOTYPE_VOCABULARY_EVIDENCE_ONLY',
    canonical_authority_granted: false,
  });
  return {
    source_path: reportPath,
    source_commit: REVIEWED_COMMIT,
    source_byte_length: bytes.length,
    source_sha256: sha256Hex(bytes),
    quoted_source_text_included: false,
    term_rows: report.termRows.map((row) => sanitizeRow(row, 'TERM')),
    posture_rows: report.postureRows.map((row) => sanitizeRow(row, 'POSTURE')),
    sweep_candidates: report.sweep.map((candidate, sourceOrder) => ({
      source_order: sourceOrder,
      kind: candidate.kind,
      target: candidate.target,
      prototype_verified: candidate.verified === true,
      proposed_key: candidate.proposed_key,
      label: candidate.label,
      quoted_text_byte_length: Buffer.byteLength(candidate.quote, 'utf8'),
      quoted_text_sha256: sha256Hex(candidate.quote),
      quoted_text_included: false,
      disposition: 'INCLUDE_AS_PROTOTYPE_CANDIDATE_EVIDENCE_ONLY',
      canonical_authority_granted: false,
    })),
  };
}

function typedFailureEvidence(storylinesRoot) {
  const sourcePath = 'lib/query-nl/failures.js';
  const bytes = gitFile(storylinesRoot, REVIEWED_COMMIT, sourcePath);
  const source = bytes.toString('utf8');
  const reasons = [...source.matchAll(/^\s{2}([A-Z_]+): '([^']+)',?$/gm)]
    .map((match) => ({
      constant: match[1],
      reason: match[2],
      disposition: 'INCLUDE_AS_PROTOTYPE_TYPED_REFUSAL_EVIDENCE_ONLY',
      canonical_authority_granted: false,
    }));
  const observed = reasons.map(({ constant, reason }) => [constant, reason]);
  if (canonicalJson(observed) !== canonicalJson(EXPECTED_TYPED_FAILURES)) {
    fail('typed NLP failure reasons changed');
  }
  return {
    source_path: sourcePath,
    source_commit: REVIEWED_COMMIT,
    source_byte_length: bytes.length,
    source_sha256: sha256Hex(bytes),
    reasons,
  };
}

function walkFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([value, count]) => ({ value, count }));
}

function localRunEvidence(storylinesRoot) {
  const runRoot = path.join(storylinesRoot, '.extract-runs');
  const files = walkFiles(runRoot).map((absolutePath) => {
    const bytes = fs.readFileSync(absolutePath);
    return {
      path: path.relative(storylinesRoot, absolutePath),
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      disposition: 'INCLUDE_FILE_IDENTITY_AS_PROTOTYPE_RUN_EVIDENCE_ONLY',
      raw_content_included: false,
      canonical_authority_granted: false,
    };
  });
  if (files.length !== 21) fail(`local run file count is ${files.length}, expected 21`);

  const ledger = JSON.parse(fs.readFileSync(path.join(runRoot, 'ledger.json'), 'utf8'));
  const deals = Object.values(ledger.deals);
  const sum = (key) => deals.reduce((total, deal) => total + deal[key], 0);
  const ledgerSummary = {
    updated_at: ledger.updated_at,
    deal_count: deals.length,
    batches_total: sum('batches_total'),
    batches_done: sum('batches_done'),
    batches_quarantined: sum('batches_quarantined'),
    events_stored: sum('events_stored'),
    events_duplicate: sum('events_duplicate'),
    verified: sum('verified'),
    unverified: sum('unverified'),
    status_counts: countBy(deals.map((deal) => deal.status)),
  };
  if (ledgerSummary.deal_count !== 12
    || ledgerSummary.batches_total !== 135
    || ledgerSummary.batches_done !== 135
    || ledgerSummary.events_stored !== 1026) {
    fail('local extraction ledger summary changed');
  }

  const retryRows = fs.readFileSync(path.join(runRoot, 'retry-queue.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const batchParagraphs = retryRows.map((row) => row.batch_paras);
  const retrySummary = {
    entry_count: retryRows.length,
    kind_counts: countBy(retryRows.map((row) => row.kind)),
    deal_counts: countBy(retryRows.map((row) => row.deal)),
    batch_paragraph_count: {
      minimum: Math.min(...batchParagraphs),
      maximum: Math.max(...batchParagraphs),
      total: batchParagraphs.reduce((total, count) => total + count, 0),
    },
    raw_error_text_included: false,
  };
  if (retrySummary.entry_count !== 47
    || retrySummary.kind_counts.length !== 1
    || retrySummary.kind_counts[0].value !== 'db_error') {
    fail('local retry summary changed');
  }

  return {
    files,
    ledger_summary: ledgerSummary,
    retry_summary: retrySummary,
    authority: 'PROTOTYPE_RUN_EVIDENCE_ONLY',
    canonical_authority_granted: false,
  };
}

function identity(domain, payload) {
  return {
    scheme: 'CANONICAL_CONTENT_ID/V1',
    domain,
    content_id: contentId(domain, payload),
    canonical_payload_sha256: sha256Hex(canonicalJson(payload)),
  };
}

function databaseEvidence(databaseObservationPath) {
  const observation = JSON.parse(fs.readFileSync(databaseObservationPath, 'utf8'));
  if (observation.schema_version !== 'StorylinesDatabaseObservation/V1'
    || observation.authority !== 'READ_ONLY_PROTOTYPE_EVIDENCE'
    || observation.write_authority_granted !== false
    || observation.transaction?.access_mode !== 'READ_ONLY'
    || observation.transaction?.isolation !== 'repeatable read') {
    fail('database observation is not a read-only repeatable snapshot');
  }
  if (observation.schema.tables.length !== 68
    || observation.schema.columns.length !== 686
    || observation.table_snapshots.length !== 68) {
    fail('database observation schema counts changed');
  }
  const snapshots = observation.table_snapshots.map((snapshot) => ({
    ...snapshot,
    evidence_kind: REQUIRED_DATABASE_TABLES.has(snapshot.table_name)
      ? 'REQUIRED_PROCESS_PROTOTYPE_TABLE'
      : 'SUPPORTING_STORYLINES_PROTOTYPE_TABLE',
    disposition: 'INCLUDE_HASHED_TABLE_AS_PROTOTYPE_EVIDENCE_ONLY',
    canonical_authority_granted: false,
  }));
  if (snapshots.some((snapshot) => (
    !/^[0-9a-f]{64}$/.test(snapshot.rows_sha256)
    || !Number.isSafeInteger(snapshot.row_count)
  ))) {
    fail('one or more table snapshots is invalid');
  }
  for (const tableName of REQUIRED_DATABASE_TABLES) {
    if (!snapshots.some((snapshot) => snapshot.table_name === tableName)) {
      fail(`required database table ${tableName} is absent`);
    }
  }
  const rowCount = (tableName) => snapshots.find(
    (snapshot) => snapshot.table_name === tableName,
  ).row_count;
  if (rowCount('pipeline_runs') !== 177
    || rowCount('l2_revisions') !== 7066
    || rowCount('releases') !== 5
    || observation.release_watermark?.latest?.deal_watermark_count !== 12) {
    fail('database evidence counts changed');
  }
  const pipelineRuns = observation.pipeline_run_summary.reduce(
    (total, row) => total + Number(row.run_count),
    0,
  );
  const revisions = observation.l2_revision_summary.reduce(
    (total, row) => total + Number(row.revision_count),
    0,
  );
  if (pipelineRuns !== 177 || revisions !== 7066) {
    fail('database summary does not reconcile to table counts');
  }

  const schemaPayload = {
    database_identity_sha256: observation.database_identity_sha256,
    schema: observation.schema,
  };
  const snapshotPayload = {
    database_identity_sha256: observation.database_identity_sha256,
    transaction: observation.transaction,
    table_snapshots: snapshots,
    release_watermark: observation.release_watermark,
  };
  return {
    ...observation,
    table_snapshots: snapshots,
    schema_identity: identity(DATABASE_SCHEMA_ID_DOMAIN, schemaPayload),
    snapshot_identity: identity(DATABASE_ID_DOMAIN, snapshotPayload),
    raw_table_rows_included: false,
    canonical_authority_granted: false,
  };
}

function buildInventory(storylinesRoot, databaseObservationPath) {
  const observedHead = git(storylinesRoot, ['rev-parse', 'HEAD']).trim();
  if (observedHead !== CURRENT_COMMIT) {
    fail(`Storylines HEAD is ${observedHead}, expected ${CURRENT_COMMIT}`);
  }
  if (git(storylinesRoot, ['status', '--porcelain=v1']).trim() !== '') {
    fail('Storylines tracked worktree is not clean');
  }

  const payload = {
    schema_version: 'ProcessIntelligenceStorylinesEvidenceInventory/V1',
    authority: 'PROTOTYPE_EVIDENCE_ONLY',
    canonical_authority_granted: false,
    source_commits: {
      reviewed: commitMetadata(storylinesRoot, REVIEWED_COMMIT),
      current: commitMetadata(storylinesRoot, CURRENT_COMMIT),
    },
    selected_repository_inputs: selectedRepositoryInputs(storylinesRoot),
    current_code_delta: currentCodeDelta(storylinesRoot),
    review_record: reviewRecord(storylinesRoot),
    vocabulary_evidence: vocabularyEvidence(storylinesRoot),
    typed_nlp_failure_evidence: typedFailureEvidence(storylinesRoot),
    local_run_evidence: localRunEvidence(storylinesRoot),
    database_evidence: databaseEvidence(databaseObservationPath),
    authority_limits: [
      'NO_STORYLINES_ROW_IS_A_CANONICAL_PM_FACT',
      'NO_STORYLINES_REPAIR_IS_AN_APPROVED_PM_REPAIR_RULE',
      'NO_STORYLINES_VOCABULARY_ITEM_IS_AN_APPROVED_PM_VOCABULARY_ITEM',
      'NO_STORYLINES_NLP_RESULT_IS_A_CERTIFIED_PM_RESULT',
      'NO_DATABASE_CREDENTIAL_OR_RAW_TABLE_ROW_IS_INCLUDED',
      'NO_DATABASE_WRITE_OR_DUAL_WRITE_AUTHORITY_IS_GRANTED',
    ],
    successor_requirements: [
      'ADJUDICATE_EACH_PROTOTYPE_CANDIDATE_BEFORE_CANONICAL_USE',
      'SEAL_SOURCE_FILINGS_INDEPENDENTLY_FOR_VERTICAL_SLICE_EXECUTION',
      'USE_PM_SHARED_FACTS_AND_PROFESSIONALS_AS_CANONICAL_INPUTS',
      'PRESERVE_TYPED_REFUSAL_FOR_UNSUPPORTED_NLP_REQUESTS',
      'BIND_EACH_PROCESS_RELEASE_TO_CANONICAL_CONTRACT_CODE_DATA_AND_CERTIFICATION',
    ],
  };
  return {
    ...payload,
    content_identity: identity(CONTENT_ID_DOMAIN, payload),
  };
}

function validateCommittedInventory(inventory) {
  const payload = structuredClone(inventory);
  const observedIdentity = payload.content_identity;
  delete payload.content_identity;
  const expectedIdentity = identity(CONTENT_ID_DOMAIN, payload);
  if (canonicalJson(observedIdentity) !== canonicalJson(expectedIdentity)) {
    fail('committed Storylines evidence content identity is invalid');
  }
  if (inventory.authority !== 'PROTOTYPE_EVIDENCE_ONLY'
    || inventory.canonical_authority_granted !== false) {
    fail('committed Storylines evidence grants unexpected authority');
  }
  if (inventory.selected_repository_inputs.some((input) => (
    input.disposition !== 'INCLUDE_AS_PROTOTYPE_EVIDENCE_ONLY'
    || input.canonical_authority_granted !== false
  ))) {
    fail('one or more selected source inputs lacks its required disposition');
  }
  if (inventory.database_evidence.table_snapshots.some((snapshot) => (
    snapshot.disposition !== 'INCLUDE_HASHED_TABLE_AS_PROTOTYPE_EVIDENCE_ONLY'
    || snapshot.canonical_authority_granted !== false
  ))) {
    fail('one or more database inputs lacks its required disposition');
  }
  return inventory;
}

function main() {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(OUTPUT_PATH)) fail('committed Storylines evidence inventory is absent');
    const inventory = validateCommittedInventory(
      JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')),
    );
    process.stdout.write(`${JSON.stringify({
      result: 'PASS',
      output_path: path.relative(ROOT, OUTPUT_PATH),
      content_id: inventory.content_identity.content_id,
      repository_inputs: inventory.selected_repository_inputs.length,
      database_tables: inventory.database_evidence.table_snapshots.length,
      vocabulary_rows: inventory.vocabulary_evidence.term_rows.length
        + inventory.vocabulary_evidence.posture_rows.length,
      vocabulary_candidates: inventory.vocabulary_evidence.sweep_candidates.length,
    })}\n`);
    return;
  }

  const storylinesRootValue = optionValue('--storylines-root');
  const databaseObservationValue = optionValue('--database-observation');
  if (!storylinesRootValue || !databaseObservationValue) {
    fail('generation requires --storylines-root and --database-observation');
  }
  const storylinesRoot = path.resolve(storylinesRootValue);
  const databaseObservationPath = path.resolve(databaseObservationValue);
  const inventory = buildInventory(storylinesRoot, databaseObservationPath);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    result: 'PASS',
    output_path: path.relative(ROOT, OUTPUT_PATH),
    content_id: inventory.content_identity.content_id,
    repository_inputs: inventory.selected_repository_inputs.length,
    database_tables: inventory.database_evidence.table_snapshots.length,
    vocabulary_rows: inventory.vocabulary_evidence.term_rows.length
      + inventory.vocabulary_evidence.posture_rows.length,
    vocabulary_candidates: inventory.vocabulary_evidence.sweep_candidates.length,
  })}\n`);
}

main();
