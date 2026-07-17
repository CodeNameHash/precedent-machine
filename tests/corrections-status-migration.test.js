const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const SQL = fs.readFileSync('supabase/corrections-status-schema.sql', 'utf8');

test('migration adds every column the spec lists, additive-safe', () => {
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied'/);
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS submitted_by text/);
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS reviewed_by text/);
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS reviewed_at timestamptz/);
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS card_id uuid/);
  assert.match(SQL, /ADD COLUMN IF NOT EXISTS claim_attribute text/);
});

test('migration constrains status to the three spec\'d values and indexes (status, created_at)', () => {
  assert.match(SQL, /CHECK \(status IN \('pending', 'applied', 'rejected'\)\)/);
  assert.match(SQL, /CREATE INDEX IF NOT EXISTS corrections_status_created_idx\s*\n\s*ON corrections\(status, created_at\)/);
});
