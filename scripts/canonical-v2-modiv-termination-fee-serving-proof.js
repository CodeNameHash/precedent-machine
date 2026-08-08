#!/usr/bin/env node
// PLAN.md Step 2C. Proves the ONE piece of wiring this step owns: that
// pages/api/review/[id]/cards.js's actual call site --
// attachCanonicalTerminationFeeServing() -- serves real TERMINATION_FEE
// cards for Modiv out of the real local canonical_v2_staging container,
// through the same registry cards.js reaches, not a test double.
//
// Deliberately does NOT touch Supabase (getServiceSupabase(), the `deals`
// table fetchReviewDealCards() reads). This repo's authority for production
// data access is NONE, and this project's Supabase credentials are not known
// to be a disposable non-production project -- so this script builds the
// minimal reviewDeal shape fetchReviewDealCards()+attachCanonicalV2Preview()
// would hand to attachCanonicalTerminationFeeServing() by hand, and proves
// the ONE function cards.js actually calls, end to end, against the real
// canonical_v2_staging container instead. Same discipline as
// scripts/canonical-v2-local-staging-read-proof.js, which proves the read
// half the same way.
//
// Usage:
//   node scripts/canonical-v2-modiv-termination-fee-serving-proof.js [db-url]
// [db-url] defaults to LOCAL_CANONICAL_V2_DB_URL or
// postgres://postgres:pm@localhost:55433/pm (this step's pm-pg3 container).
//
// Requires the database already durably holds Modiv's termination-fee run --
// scripts/canonical-v2-local-durable-write.js
// evidence/canonical-v2/modiv-termination-fee-20260807-replay <db-url>.

'use strict';

const { Client } = require('pg');

const serving = require('../lib/canonical-v2/termination-fee-serving-source');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');

let failures = 0;
function check(label, condition, detail) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
}

// The shape fetchReviewDealCards() + attachCanonicalV2Preview() hand to
// attachCanonicalTerminationFeeServing() in the real route -- only the
// fields this switch and the fee table config actually read.
function minimalReviewDeal() {
  return {
    dealId: serving.MODIV_DEAL_ID,
    cards: [], // No legacy TERMF cards asserted here -- this proof is about
    // the canonical source, not the legacy fallback merge (that is
    // tests/canonical-v2-termination-fee-serving-switch.test.js's job).
    value_usd: 1_500_000_000, // Approximate GNL/Modiv deal value, for the % calc only.
  };
}

async function verifyDatabaseHoldsTheRun(dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const counts = await client.query(
      `SELECT
         (SELECT count(*) FROM canonical_v2_staging.provision_instances
            WHERE canonical_payload->>'document_hash' = $1
              AND canonical_payload->>'concept_key' IN ('TERMF-TARGET','TERMF-REVERSE','TERMF-TAIL','REM-SOLE')) AS termf_provisions,
         (SELECT count(*) FROM canonical_v2_staging.conditional_termination_fee_values) AS conditional_values`,
      [serving.MODIV_DOCUMENT_HASH],
    );
    return counts.rows[0];
  } finally {
    await client.end();
  }
}

async function main() {
  const dbUrl = process.argv[2]
    || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:pm@localhost:55433/pm';

  console.log('--- Step 1: the database actually holds the Modiv termination-fee run ---');
  const dbCounts = await verifyDatabaseHoldsTheRun(dbUrl);
  console.log(JSON.stringify(dbCounts));
  check('provision_instances holds the termination-fee concept keys (written by canonical-v2-local-durable-write.js)',
    Number(dbCounts.termf_provisions) > 0, `found ${dbCounts.termf_provisions}`);
  check('conditional_termination_fee_values holds Modiv rows (Step 4A3\'s write, this step\'s read)',
    Number(dbCounts.conditional_values) > 0, `found ${dbCounts.conditional_values}`);

  const env = {
    NODE_ENV: 'test',
    CANONICAL_V2_TERMINATION_FEE_SERVING: 'ENABLED_LOCAL_PREPRODUCTION',
    LOCAL_CANONICAL_V2_DB_URL: dbUrl,
  };

  console.log('\n--- Step 2: attachCanonicalTerminationFeeServing(), the EXACT function cards.js calls ---');
  const reviewDeal = minimalReviewDeal();
  const served = await serving.attachCanonicalTerminationFeeServing(reviewDeal, { env });

  check('serving flag stamped true', served[serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD] === true);
  const outcome = served[serving.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD];
  console.log('source status:', JSON.stringify(outcome));
  check('source state is ATTACHED, not NOT_REGISTERED or FAILED', outcome.state === serving.TERMINATION_FEE_SOURCE_STATE.ATTACHED);

  const cards = served[serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD];
  check('at least one real card came back from the database', Array.isArray(cards) && cards.length > 0, `count=${cards && cards.length}`);

  const conceptKeys = cards.map((c) => c.provision_subtype);
  console.log('concept keys served:', conceptKeys.join(', '));
  check('a TERMF-TARGET (Company/SELLER fee) card is present', conceptKeys.includes('TERMF-TARGET'));
  check('a TERMF-REVERSE (Parent/BUYER fee) card is present', conceptKeys.includes('TERMF-REVERSE'));
  check('a TERMF-TAIL card is present', conceptKeys.includes('TERMF-TAIL'));

  const headlineText = canonicalJson(cards);
  check('the $10,000,000 SELLER conditional-fee headline reaches the served payload',
    headlineText.includes('10000000'));
  check('the $15,000,000 BUYER conditional-fee headline reaches the served payload',
    headlineText.includes('15000000'));

  console.log('\n--- Step 3: the wire trim keeps what a browser would receive ---');
  const wired = trimReviewDealForWire(served);
  check('canonical_v2_termination_fee_cards survives the wire trim', Array.isArray(wired[serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD]));
  check('canonical_v2_termination_fee_serving_enabled survives the wire trim', wired[serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD] === true);

  console.log('\n--- Step 4: the actual review-table config renders rows from the served payload ---');
  const config = await import('../components/review/table-configs/termination-fees.config.js');
  const rows = config.terminationFeesConfig.selectRows(wired);
  console.log(`rendered ${rows.length} rows:`);
  for (const row of rows) {
    console.log(`  [${row.id}] ${row.detail || row.short_title || ''}`.slice(0, 140));
  }
  check('the review table renders a provenance row stating the source is CANONICAL', rows.some((r) => r.id === 'termination-fees-serving-source' && r.servingSourceState === 'CANONICAL'));
  check('the review table renders at least one substantive fee row (not just the provenance banner)', rows.length > 1);

  console.log('\n--- Step 5: production denial is unchanged for this exact deal id ---');
  const productionEnv = { ...env, VERCEL: '1', VERCEL_ENV: 'production' };
  // A DB url that would throw an ECONNREFUSED-shaped error if the builder
  // ever tried to use it -- proving the gate short-circuits BEFORE the
  // database is touched, not merely that the final answer happens to look
  // the same. If this check ever starts failing loud instead of passing
  // quiet, that is the guard actually firing -- see this script's own
  // removal-proves-it run in the step's notes.
  const poisonedEnv = { ...productionEnv, LOCAL_CANONICAL_V2_DB_URL: 'postgres://nobody:nobody@127.0.0.1:1/nope' };
  const productionReviewDeal = minimalReviewDeal();
  const deniedInProduction = await serving.attachCanonicalTerminationFeeServing(productionReviewDeal, { env: poisonedEnv });
  check('production denial returns the exact same object reference (no field added, DB never reached)', deniedInProduction === productionReviewDeal);
  check('the denied payload carries none of the serving fields', deniedInProduction[serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD] === undefined);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
