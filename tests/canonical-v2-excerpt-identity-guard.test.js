'use strict';

/**
 * tests/canonical-v2-excerpt-identity-guard.test.js
 *
 * Regression guard for Step 2D1 defect 2: `canonical_v2_write`'s excerpt
 * identity guard (supabase/canonical-v2-foundation.sql, the two checks
 * inside the `excerpts` FOR loop) used to compare a WHOLE-PAYLOAD digest
 * where it should compare only the seven fields that define `excerpt_id`
 * itself (excerpt_definition_key, excerpt_definition_version,
 * excerpt_definition_payload_digest, ordered_component_assignments,
 * excerpt_purpose, transformation_or_redaction_version, output_text_hash --
 * exactly lib/canonical-v2/source-structure.js's buildExcerpt() `identity`
 * object). TERMINATION and TERMINATION_FEE legitimately quote the identical
 * sentence and share excerpt_id by design, per ADR-001 in
 * docs/core/OPERATING-RULES.md, while their source_occurrence_id
 * legitimately differs between the two families' independent runs. The old
 * guard read that as a conflict and rolled back whichever family's write
 * reached the excerpt loop second, silently dropping 12 of 211 resolved
 * TERMINATION claims. Live-container proof of that exact pair coexisting is
 * recorded in docs/codex-program/notes/step-2d1-runner-and-writer.md.
 *
 * This test proves the two ends of the fix directly against a real
 * Postgres, independent of the modiv fixtures: (1) two writes of the same
 * excerpt_id differing ONLY in source_occurrence_id both succeed, and (2) a
 * genuinely forged sibling -- same excerpt_id, but a DIFFERENT
 * output_text_hash, one of the seven identity-defining fields -- is still
 * refused. The fix must never be loosened into accepting a real identity
 * mismatch; this second case is what proves that separately from the
 * first.
 *
 * Uses FIXTURE_DEAL_EXTRACTION_RUN rather than DEAL_SCOPE_RUN because
 * DEAL_SCOPE_RUN independently re-derives excerpt_id from an admitted
 * source document's real bytes before this guard ever runs (a different,
 * complementary anti-forgery check -- 'DEAL_SCOPE_RUN excerpt identity or
 * source bytes are invalid', supabase/canonical-v2-foundation.sql ~3790),
 * which makes it structurally impossible to hand-construct a forged
 * identity under DEAL_SCOPE_RUN without hitting that check first instead of
 * the one this test targets. FIXTURE_DEAL_EXTRACTION_RUN reaches the same
 * shared excerpts loop (supabase/canonical-v2-foundation.sql ~8538) without
 * that pre-check, which is exactly why the loop's own guard has to be
 * correct on its own terms -- it is the only defense for any operation that
 * does not re-derive identity from source bytes.
 *
 * Requires a live local Postgres with supabase/canonical-v2-foundation.sql
 * applied (see docs/codex-program/notes/step-4a-durable-write.md for setup:
 * scripts/lib/canonical-v2-local-setup.sql first, then the foundation
 * file). Skipped entirely when LOCAL_CANONICAL_V2_DB_URL is unset -- this
 * is a live-infrastructure proof, not a CI-portable unit test; CI has
 * neither Docker nor Postgres, so message-string and digest-based coverage
 * for this same guard lives in tests/canonical-v2-live-extraction-run-
 * call-timeout-wired.test.js's siblings and the schema/authority-partition
 * digest pins, both of which run everywhere.
 *
 *   LOCAL_CANONICAL_V2_DB_URL=postgres://postgres:postgres@localhost:PORT/postgres \
 *     node --test tests/canonical-v2-excerpt-identity-guard.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildCanonicalWriteInputDigest } = require('../lib/canonical-v2/canonical-write-envelope');

const DB_URL = process.env.LOCAL_CANONICAL_V2_DB_URL || null;

// The seven fields buildExcerpt() in lib/canonical-v2/source-structure.js
// hashes into EXCERPT/V1's content id -- deliberately fabricated rather
// than derived from a real admitted source, because FIXTURE_DEAL_
// EXTRACTION_RUN's shared excerpts loop never re-verifies them against
// source bytes (only DEAL_SCOPE_RUN does, earlier in the same function).
const IDENTITY = Object.freeze({
  excerpt_definition_key: 'SINGLE_OPERATIVE_SPAN',
  excerpt_definition_version: 1,
  excerpt_definition_payload_digest: sha256Hex('step-2d1-excerpt-definition'),
  ordered_component_assignments: [{
    component_slot_key: 'PRIMARY',
    governed_slot_ordinal: 0,
    semantic_span_id: sha256Hex('step-2d1-semantic-span'),
  }],
  excerpt_purpose: 'LEGAL_EVIDENCE',
  transformation_or_redaction_version: 'IDENTITY_UTF8/V1',
  output_text_hash: sha256Hex('the quick brown fox jumps over the lazy dog'),
});
const EXCERPT_ID = contentId('EXCERPT/V1', IDENTITY);
const DEAL = Object.freeze({ deal_key: 'step-2d1-excerpt-identity-guard-probe', schema_version: 'DEAL/PROBE' });

function excerptRow(overrides = {}) {
  return {
    schema_version: 'EXCERPT/V1',
    excerpt_id: EXCERPT_ID,
    excerpt_definition_id: sha256Hex('step-2d1-excerpt-definition-id'),
    ...IDENTITY,
    source_content_id: sha256Hex('step-2d1-source-content'),
    source_occurrence_id: sha256Hex('step-2d1-source-occurrence-A'),
    canonical_text_id: sha256Hex('step-2d1-canonical-text'),
    document_hash: sha256Hex('step-2d1-document'),
    absolute_start: 0,
    absolute_end: 44,
    exact_bytes_digest: IDENTITY.output_text_hash,
    exact_text: 'the quick brown fox jumps over the lazy dog',
    closure_id: sha256Hex('step-2d1-excerpt-closure'),
    ...overrides,
  };
}

async function callWrite(client, { idempotencyKey, excerpt }) {
  const operation = 'FIXTURE_DEAL_EXTRACTION_RUN';
  const writeSet = {
    sources: [],
    source_admissions: [],
    deal: DEAL,
    excerpts: [excerpt],
  };
  const residuals = [];
  const quarantines = [];
  const inputDigest = buildCanonicalWriteInputDigest({
    operation, idempotencyKey, writeSet, residuals, quarantines,
  });
  const receiptBody = {
    operation,
    idempotencyKey,
    inputDigest,
    status: 'COMMITTED',
    publishableObjectCount: 1,
    residualCount: 0,
    quarantinedClosureCount: 0,
  };
  const receipt = { receiptId: contentId('CANONICAL_WRITE_RECEIPT/V1', receiptBody), ...receiptBody };

  await client.query('BEGIN');
  try {
    const result = await client.query(
      `SELECT public.canonical_v2_write($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb) AS result`,
      ['staging', operation, idempotencyKey, inputDigest, JSON.stringify(writeSet), JSON.stringify(residuals), JSON.stringify(quarantines), JSON.stringify(receipt)],
    );
    await client.query('COMMIT');
    return { ok: true, result: result.rows[0].result };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, message: err.message };
  }
}

test(
  'two writes of the same excerpt_id differing only in source_occurrence_id both commit (the legitimate TERMINATION/TERMINATION_FEE shape)',
  { skip: !DB_URL },
  async () => {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const first = await callWrite(client, {
        idempotencyKey: 'STEP_2D1_GUARD_TEST_LEGITIMATE_A',
        excerpt: excerptRow({ source_occurrence_id: sha256Hex('step-2d1-source-occurrence-A') }),
      });
      assert.equal(first.ok, true, `first write must commit: ${first.message || ''}`);
      assert.equal(first.result.status, 'COMMITTED');

      const second = await callWrite(client, {
        idempotencyKey: 'STEP_2D1_GUARD_TEST_LEGITIMATE_B',
        excerpt: excerptRow({ source_occurrence_id: sha256Hex('step-2d1-source-occurrence-B') }),
      });
      assert.equal(
        second.ok,
        true,
        `second write (same excerpt_id, different source_occurrence_id only) must also commit, not be `
          + `treated as a conflict: ${second.message || ''}`,
      );
      assert.equal(second.result.status, 'COMMITTED');

      const stored = await client.query(
        'SELECT count(*)::int AS n FROM canonical_v2_staging.excerpts WHERE excerpt_id = $1',
        [EXCERPT_ID],
      );
      assert.equal(stored.rows[0].n, 1, 'exactly one row: the second write must not have inserted a duplicate PK');
    } finally {
      await client.end();
    }
  },
);

test(
  'a forged sibling sharing excerpt_id but a different output_text_hash is still refused',
  { skip: !DB_URL },
  async () => {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const genuine = await callWrite(client, {
        idempotencyKey: 'STEP_2D1_GUARD_TEST_COLLISION_GENUINE',
        excerpt: excerptRow(),
      });
      assert.equal(genuine.ok, true, `setup write must commit: ${genuine.message || ''}`);

      const forgedOutputTextHash = sha256Hex('a completely different quote than the one this excerpt_id names');
      assert.notEqual(forgedOutputTextHash, IDENTITY.output_text_hash);
      const forged = await callWrite(client, {
        idempotencyKey: 'STEP_2D1_GUARD_TEST_COLLISION_FORGED',
        excerpt: excerptRow({ output_text_hash: forgedOutputTextHash }),
      });
      assert.equal(forged.ok, false, 'a write claiming the same excerpt_id with a different output_text_hash must be refused');
      assert.match(
        forged.message,
        /canonical excerpt identity conflict/,
        'must be refused specifically by the excerpt identity guard, not some other error',
      );

      const stored = await client.query(
        `SELECT canonical_payload->>'output_text_hash' AS output_text_hash
         FROM canonical_v2_staging.excerpts WHERE excerpt_id = $1`,
        [EXCERPT_ID],
      );
      assert.equal(
        stored.rows[0].output_text_hash,
        IDENTITY.output_text_hash,
        'the stored row must still carry the genuine output_text_hash -- the refused write must not have corrupted it',
      );
    } finally {
      await client.end();
    }
  },
);
