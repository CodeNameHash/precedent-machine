const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/process-intelligence-storylines-baseline.mjs');
const INVENTORY_PATH = path.join(
  ROOT,
  'evidence/process-intelligence/baseline/storylines-evidence-inventory.json',
);
const CONTENT_ID_DOMAIN = 'PROCESS_INTELLIGENCE_STORYLINES_EVIDENCE_INVENTORY/V1';

function inventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

test('validates the committed Storylines prototype evidence inventory', () => {
  const output = execFileSync(process.execPath, [SCRIPT, '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /"result":"PASS"/);
});

test('binds the inventory to exact bytes without granting canonical authority', () => {
  const value = inventory();
  const identity = value.content_identity;
  delete value.content_identity;

  assert.equal(value.authority, 'PROTOTYPE_EVIDENCE_ONLY');
  assert.equal(value.canonical_authority_granted, false);
  assert.equal(identity.domain, CONTENT_ID_DOMAIN);
  assert.equal(identity.content_id, contentId(CONTENT_ID_DOMAIN, value));
  assert.equal(identity.canonical_payload_sha256, sha256Hex(canonicalJson(value)));
  assert.deepEqual(
    value.source_commits,
    {
      reviewed: {
        commit: '77688ad8dab2b34e0a62ddba2a87f0ba70fab215',
        tree: '917a5f7f876c54d84b329a6b12271bc9264df0cd',
        authored_at: '2026-07-27T12:49:55Z',
        subject: 'Phrasebook: ask bar first + Detailed filters cascade; index: column picker',
      },
      current: {
        commit: '356b8eaa27d9f904072da615139881dcb93eab0a',
        tree: '3783458662002c256f26c0110727666ce1d48337',
        authored_at: '2026-07-10T01:18:47-07:00',
        subject: 'Validator: open document-type set, occurrences as timeline denominator',
      },
    },
  );
});

test('dispositions all 82 selected reviewed repository inputs', () => {
  const inputs = inventory().selected_repository_inputs;
  assert.equal(inputs.length, 82);
  assert.ok(inputs.every((input) => (
    input.disposition === 'INCLUDE_AS_PROTOTYPE_EVIDENCE_ONLY'
    && input.canonical_authority_granted === false
    && /^[0-9a-f]{64}$/.test(input.sha256)
    && /^[0-9a-f]{40}$/.test(input.blob_oid)
    && input.byte_length > 0
  )));
  assert.equal(
    inputs.filter((input) => input.evidence_kind === 'PROTOTYPE_TEST_FIXTURE').length,
    39,
  );
});

test('records the reviewed-code deletion and live-database mismatch without choosing an authority', () => {
  const value = inventory();
  const delta = value.current_code_delta;
  assert.equal(delta.selected_change_count, 42);
  assert.equal(delta.deleted_selected_file_count, 42);
  assert.ok(delta.changes.every((change) => (
    change.status === 'D'
    && change.disposition === 'RECORD_PROTOTYPE_STATE_CHANGE_ONLY'
    && change.canonical_authority_granted === false
  )));
  assert.match(delta.interpretation, /live database still contains V5 tables/);
  assert.equal(value.canonical_authority_granted, false);
});

test('binds every review stage to an exact commit and file hash', () => {
  const reviews = inventory().review_record;
  assert.deepEqual(
    reviews.map((review) => review.stage),
    [
      'CODEX_REVIEW_BRIEF',
      'FABLE_ROUND_1',
      'FABLE_ROUND_2',
      'CODEX_FABLE_RECONCILIATION',
      'FABLE_ROUND_3_PASS',
    ],
  );
  assert.ok(reviews.every((review) => (
    review.commit === review.commit_metadata.commit
    && /^[0-9a-f]{64}$/.test(review.sha256)
    && review.byte_length > 0
    && review.disposition === 'INCLUDE_AS_REVIEW_HISTORY_ONLY'
    && review.canonical_authority_granted === false
  )));
});

test('records the complete vocabulary report without copied source quotations', () => {
  const vocabulary = inventory().vocabulary_evidence;
  assert.equal(vocabulary.term_rows.length, 38);
  assert.equal(vocabulary.posture_rows.length, 12);
  assert.equal(vocabulary.sweep_candidates.length, 282);
  assert.equal(vocabulary.quoted_source_text_included, false);
  for (const row of [...vocabulary.term_rows, ...vocabulary.posture_rows]) {
    assert.equal(row.canonical_authority_granted, false);
    assert.ok(row.examples.every((example) => (
      example.quoted_text_included === false
      && /^[0-9a-f]{64}$/.test(example.quoted_text_sha256)
      && !Object.hasOwn(example, 'span')
    )));
  }
  assert.ok(vocabulary.sweep_candidates.every((candidate) => (
    candidate.quoted_text_included === false
    && /^[0-9a-f]{64}$/.test(candidate.quoted_text_sha256)
    && !Object.hasOwn(candidate, 'quote')
    && candidate.canonical_authority_granted === false
  )));
});

test('records all seven typed NLP refusal reasons', () => {
  assert.deepEqual(
    inventory().typed_nlp_failure_evidence.reasons.map(
      ({ constant, reason }) => [constant, reason],
    ),
    [
      ['EMPTY_QUESTION', 'empty_question'],
      ['NOT_A_STRING', 'not_a_string'],
      ['NO_LEXICAL_CONTENT', 'no_lexical_content'],
      ['UNTYPED_DIMENSION', 'untyped_dimension'],
      ['NO_PATTERN_MATCH', 'no_pattern_match'],
      ['LLM_DECLINED', 'llm_declined'],
      ['LLM_PROPOSAL_INVALID', 'llm_proposal_invalid'],
    ],
  );
});

test('records the complete local extraction ledger and retry evidence without raw errors', () => {
  const runs = inventory().local_run_evidence;
  assert.equal(runs.files.length, 21);
  assert.deepEqual(
    {
      deal_count: runs.ledger_summary.deal_count,
      batches_total: runs.ledger_summary.batches_total,
      batches_done: runs.ledger_summary.batches_done,
      events_stored: runs.ledger_summary.events_stored,
      verified: runs.ledger_summary.verified,
      unverified: runs.ledger_summary.unverified,
    },
    {
      deal_count: 12,
      batches_total: 135,
      batches_done: 135,
      events_stored: 1026,
      verified: 996,
      unverified: 30,
    },
  );
  assert.equal(runs.retry_summary.entry_count, 47);
  assert.deepEqual(runs.retry_summary.kind_counts, [{ value: 'db_error', count: 47 }]);
  assert.equal(runs.retry_summary.raw_error_text_included, false);
  assert.ok(runs.files.every((file) => (
    file.raw_content_included === false
    && file.canonical_authority_granted === false
    && /^[0-9a-f]{64}$/.test(file.sha256)
  )));
});

test('records a read-only content-addressed database snapshot with full table dispositions', () => {
  const database = inventory().database_evidence;
  assert.equal(database.authority, 'READ_ONLY_PROTOTYPE_EVIDENCE');
  assert.equal(database.write_authority_granted, false);
  assert.equal(database.canonical_authority_granted, false);
  assert.equal(database.transaction.access_mode, 'READ_ONLY');
  assert.equal(database.transaction.isolation, 'repeatable read');
  assert.equal(database.schema.tables.length, 68);
  assert.equal(database.schema.columns.length, 686);
  assert.equal(database.schema.constraints.length, 305);
  assert.equal(database.table_snapshots.length, 68);
  assert.equal(database.raw_table_rows_included, false);
  assert.equal(database.release_watermark.all_releases.length, 5);
  assert.equal(database.release_watermark.latest.deal_watermark_count, 12);
  assert.ok(database.table_snapshots.every((snapshot) => (
    snapshot.disposition === 'INCLUDE_HASHED_TABLE_AS_PROTOTYPE_EVIDENCE_ONLY'
    && snapshot.canonical_authority_granted === false
    && /^[0-9a-f]{64}$/.test(snapshot.rows_sha256)
  )));
  const rowCount = (name) => database.table_snapshots.find(
    (snapshot) => snapshot.table_name === name,
  ).row_count;
  assert.equal(rowCount('pipeline_runs'), 177);
  assert.equal(rowCount('l2_revisions'), 7066);
  assert.equal(rowCount('releases'), 5);
  assert.equal(rowCount('resolver_flags'), 180);
});

test('preserves failed and partial pipeline runs and empty repair stores as evidence', () => {
  const database = inventory().database_evidence;
  const count = (stage, status) => Number(database.pipeline_run_summary.find(
    (row) => row.stage === stage && row.status === status,
  )?.run_count || 0);
  assert.equal(count('publish', 'failed'), 2);
  assert.equal(count('resolve', 'failed'), 4);
  assert.equal(count('resolve', 'partial'), 2);
  assert.deepEqual(database.repair_receipt_summary.event_corrections, []);
  assert.deepEqual(database.repair_receipt_summary.edit_overlays, []);
  assert.deepEqual(database.repair_receipt_summary.open_world_candidates, []);
  assert.equal(
    database.repair_receipt_summary.resolver_flags.reduce(
      (total, row) => total + Number(row.flag_count),
      0,
    ),
    180,
  );
});
