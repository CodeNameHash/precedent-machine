const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  WP_TABLES,
  lintSql,
  tableBody,
} = require('../../../scripts/lint-schema-fields');

const sqlPath = path.join(__dirname, '..', '..', '..', 'supabase', 'schema-03-card-model.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

test('schema-03 creates every explicit WP-SCHEMA-03 table', () => {
  for (const table of WP_TABLES) {
    assert.ok(tableBody(sql, table), `${table} exists`);
  }
});

test('schema-03 guardrail rejects jsonb and missing quote spans', () => {
  assert.deepEqual(lintSql(sql), []);

  const withJsonb = sql.replace('review_notes text', 'review_notes jsonb');
  assert.ok(lintSql(withJsonb).some((issue) => /provision_cards: jsonb/i.test(issue)));

  const withoutSpan = sql.replace('source_span_start integer NOT NULL,\n  source_span_end integer NOT NULL,\n  verbatim_quote text NOT NULL,', 'verbatim_quote text NOT NULL,');
  assert.ok(lintSql(withoutSpan).some((issue) => /source_span_start/i.test(issue)));
});

test('schema-03 keeps closing condition cited provisions as a link table', () => {
  const body = tableBody(sql, 'closing_condition_cited_provisions');
  assert.match(body, /tier_id uuid NOT NULL REFERENCES public\.closing_condition_bring_down_tiers/);
  assert.match(body, /cited_card_id uuid REFERENCES public\.provision_cards/);
  assert.match(body, /cited_ref_text text NOT NULL/);
  assert.doesNotMatch(body, /jsonb/i);
});
