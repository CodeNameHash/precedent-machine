'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const start = sql.indexOf('  -- Immutable publication sidecars.');
const end = sql.indexOf("  FOR item IN\n    SELECT ordered_item.value\n    FROM jsonb_array_elements(\n      coalesce(p_write_set->'conditional_termination_fee_values'", start);
const block = sql.slice(start, end);

test('SQL writer recomputes immutable publication authority and sidecar identities before storing either', () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(block, /CANONICAL_V2_CALIBRATION_AUTHORITY\/V1', item - 'calibration_authority_id'/);
  assert.match(block, /CANONICAL_V2_PUBLICATION_DISPOSITION\/V2', item - 'decision_id'/);
  assert.match(block, /publication_input_digest' !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(block, /item->>'disposition' = 'PUBLISHED'/);
  assert.match(block, /item->'prior_eligible_decision_id' IS DISTINCT FROM 'null'::jsonb/);
  assert.match(block, /jsonb_each\(item->'risk_signals'\)/);
  assert.match(block, /jsonb_array_elements\(p_write_set->'claims'\)/);
});
