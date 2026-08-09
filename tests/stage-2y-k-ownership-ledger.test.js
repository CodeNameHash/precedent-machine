'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

let ledgerModule;

test.before(async () => {
  ledgerModule = await import('../scripts/stage-2y-k-ownership-ledger.mjs');
});

test('Stage 2Y-K ownership ledger accounts for every residual occurrence without an unowned fixable row', () => {
  const ledger = ledgerModule.buildOwnershipLedger();
  assert.equal(ledger.schema_version, ledgerModule.SCHEMA_VERSION);
  assert.deepEqual(ledger.conservation, {
    occurrences: 212,
    source_fixable_occurrences: 184,
    source_no_fix_occurrences: 28,
    implementation_required_occurrences: 166,
    unowned_fixable_occurrences: 0,
  });
  assert.deepEqual(ledger.counts.by_fix_class, {
    NO_FIX: 28, PROMPT_CHANGE: 63, RESOLVER_SIDE: 98, TAXONOMY_DESIGN: 23,
  });
  assert.deepEqual(ledger.counts.by_primary_owner, {
    '2Y-A': 27, '2Y-B': 4, '2Y-C': 61, '2Y-D': 11, '2Y-L': 63,
    'BEN:TAXONOMY_OR_CODEBOOK': 12, CORRECT_ABSTENTION: 34,
  });
  assert.equal(new Set(ledger.occurrences.map((row) => row.occurrence_id)).size, 212);
  assert.equal(ledger.occurrences.filter((row) => row.implementation_required && !row.primary_owner).length, 0);
});

test('committed Stage 2Y-K ownership ledger is the deterministic rendering', () => {
  const ledger = ledgerModule.buildOwnershipLedger();
  const committed = readFileSync(resolve(__dirname, `../${ledgerModule.OUTPUT_PATH}`), 'utf8');
  assert.equal(committed, ledgerModule.renderLedger(ledger));
});
