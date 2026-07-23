#!/usr/bin/env node

// SPEC-QXO-TERMF-AMENDMENT-2026-07-23, Step 3 — staging script for the QXO
// company termination-fee reviewed fixture.
//
// SCOPE NOTE (read before extending): every OTHER scripts/canonical-v2-staging-
// qxo-*.mjs script writes through the ADMITTED pipeline (a reviewed-qxo-
// admitted-*-slice.js module built against a live, hash-verified SEC HTML
// capture already staged in canonical_v2_staging.intake_capture_receipts — see
// canonical-v2-staging-qxo-no-shop.mjs). No such admitted slice module exists
// yet for the termination-fee triggers this amendment adds, and building one
// blind (without a live Supabase session to verify the real
// convertSecHtmlToCanonicalText output against) risks exactly the
// "plausible-but-wrong" failure this programme's watchdog protocol exists to
// catch. This script therefore stays DRY-RUN ONLY: it builds and validates the
// REVIEWED (harness-built, hand-verified-quote) fixture from
// __fixtures__/canonical-v2/qxo-termination-fee-row.js — precisely the same
// regression-oracle status Landos's own reviewed-termination-fee-slice.js has
// always had (it has never been staged to a live project either) — and prints
// a deterministic attestation. It never calls `supabase db query` and never
// writes anything. Building the admitted counterpart and wiring a real
// DEAL_SCOPE_RUN write (mirroring canonical-v2-staging-qxo-no-shop.mjs) is a
// follow-up packet, not authorized here.
//
// Candidate-seed entry: NOT added. lib/canonical-v2/qxo-material-candidate-
// identity.js composes already-ADMITTED source_admission_manifest_ids into one
// combined candidate release; since this packet adds no new admitted source,
// there is nothing for that pattern to compose in yet.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV2 } = require('../lib/canonical-v2/contract-bundle');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { buildQxoTerminationFeeFixture } = require('../__fixtures__/canonical-v2/qxo-termination-fee-row');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const EXPECTED_TRIGGER_CODES = Object.freeze([
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
].sort());

function buildAttestation() {
  // SPEC-VERSIONED-CONTRACT-2026-07-23: this fixture's grounds carry the four
  // Ben-approved concept keys, so it must be governed by the versioned
  // contract (F2), not the frozen F1 default -- otherwise this attestation
  // would falsely claim F1 governance for a row built with F2-only concepts.
  const contractBundle = compileFixtureContractV2();
  const fixture = buildQxoTerminationFeeFixture({ contractBundle });

  validateSharedServingRow(fixture.row);
  // Fails loudly (throws) rather than silently if the fixture cannot be
  // rendered by the same adapter the live typed-market UI uses.
  adaptSharedServingRow(fixture.row);

  const effects = fixture.row.canonical_result.components[0].bounded_relationship_effects.map((row) => row.effect);
  const actualCodes = effects.map((effect) => effect.trigger_code).sort();
  if (canonicalJson(actualCodes) !== canonicalJson(EXPECTED_TRIGGER_CODES)) {
    throw new Error('QXO termination-fee fixture trigger codes have drifted from the spec-bound six.');
  }
  if (fixture.row.provenance.contract_fingerprint !== contractBundle.fingerprint) {
    throw new Error('QXO termination-fee fixture contract fingerprint has drifted.');
  }

  const body = {
    schema_version: 'QXO_TERMINATION_FEE_DRY_RUN_ATTESTATION/V1',
    mode: 'DRY_RUN_FIXTURE_ONLY',
    note: 'No live Supabase session was contacted. See the script header for why.',
    contract_fingerprint: contractBundle.fingerprint,
    governed_deal_key: fixture.row.governed_deal_key,
    deal_admission_id: fixture.row.deal_admission_id,
    corpus_release_id: fixture.corpusReleaseId,
    serving_namespace_id: fixture.servingNamespaceId,
    reviewed_mapping_id: fixture.harness.reviewed_mapping.reviewed_mapping_id,
    row_serving_key: fixture.row.row_serving_key,
    canonical_payload_digest: fixture.row.canonical_payload_digest,
    percent_of_deal_value: fixture.row.canonical_result.components[0].canonical_value,
    trigger_relationship_count: effects.length,
    trigger_codes_present: [...new Set(actualCodes)],
    exact_detail_package_digest: contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', fixture.detailPackage),
  };
  return { ...body, attestation_id: contentId('QXO_TERMINATION_FEE_DRY_RUN_ATTESTATION/V1', body) };
}

const mode = process.argv[2];
if (mode !== '--dry-run' || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-termination-fee.mjs --dry-run\n(This script is dry-run only until a live-admitted source pipeline is built; see its header comment.)');
}

try {
  process.stdout.write(`${canonicalJson(buildAttestation())}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'QXO termination-fee dry run failed.');
}
