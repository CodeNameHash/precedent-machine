#!/usr/bin/env node
'use strict';

/**
 * scripts/review-parity-build-cases.js
 *
 * Builds the Material Contracts case set from data ALREADY COMMITTED to this
 * repository. No database, no credentials, no network, no model call --
 * every V2 side here comes from a recorded provider response replayed
 * through the real producer/resolver/projection code.
 *
 *   node scripts/review-parity-build-cases.js [--check]
 *
 *   --check  regenerate in memory and fail (exit 1) if the committed case
 *            files differ. Use this to prove the generator is deterministic
 *            without touching the working tree.
 *
 * WHAT THIS SCRIPT PROVES, AND WHAT IT DOES NOT
 *
 * It produces four cases. Exactly one has both sides. The other three carry
 * real legacy cards and an honest `unavailable` on the V2 side, because no
 * committed artefact in this repository contains a Canonical V2 resolution
 * for the Material Contracts family on those deals. That is a finding about
 * the corpus, not a gap in the harness, and it is recorded as data so the
 * report states it rather than a human having to remember it.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'review-parity', 'cases', 'material-contracts');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV27 } = require('../lib/canonical-v2/contract-bundle');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeMaterialContractsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectMaterialContractsProductSurfaces } = require('../lib/canonical-v2/material-contracts-product-projection');

const DARK_REVIEW_FIXTURE = 'tests/fixtures/canonical-v2/legacy-card-bridge/material-contracts-dark-review.json';

// Deals whose real production provision_cards are committed. Sourced from
// tests/fixtures/canonical-v2/v1v2-comparator/*.json, which are recorded
// exports of production `provision_cards`.
const V1_SNAPSHOT_DEALS = [
  { deal_id: 'dfaa71fa-modiv', deal_label: 'Global Net Lease / Modiv Industrial', file: 'tests/fixtures/canonical-v2/v1v2-comparator/modiv-v1-provision-snapshot.json' },
  { deal_id: 'af4940e1-skechers', deal_label: 'Beach Acquisition / Skechers', file: 'tests/fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json' },
  { deal_id: '7dc3a05f-topbuild', deal_label: 'QXO / TopBuild', file: 'tests/fixtures/canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json' },
];

const V2_UNAVAILABLE_REASON = 'No committed artefact in this repository contains a Canonical V2 resolution for the MATERIAL_CONTRACTS family on this deal. The three committed live-run resolutions (modiv-first-live-run, skechers-first-live-run, f28-third-live-run) resolve only concept_key REP-T-CAP, so projectMaterialContractsProductSurfaces returns zero cards for all of them. Producing this side requires either production access or an extraction run; the harness has neither.';

/**
 * Replay the recorded Material Contracts provider response for the
 * Landos/AbbVie agreement through the real producer -> resolver ->
 * projection chain. Deterministic: the provider is a pure function of the
 * committed fixture.
 */
async function buildLandosProjection() {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, DARK_REVIEW_FIXTURE), 'utf8'));
  const agreement = fs.readFileSync(path.join(REPO_ROOT, fixture.real_source_file), 'utf8');
  if (!agreement.includes(fixture.material_contract_criterion.quote)) {
    throw new Error('the recorded criterion quote is no longer present in the committed agreement text');
  }
  const sourceText = `Section ${fixture.section_reference} Contracts.\n\n${fixture.material_contract_criterion.quote}\n`;
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-material-contracts-dark-bridge',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: `deal:${fixture.deal_id}`,
    deal_admission_id: sha256Hex(`deal-admission:${fixture.deal_id}`),
    source_ordinal: 0,
  });
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: sha256Hex(Buffer.from(sourceText, 'utf8')),
    section_references: [fixture.section_reference],
    contract_bundle: compileFixtureContractV27(),
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeMaterialContractsProposals({
        material_contract_criteria: [{
          section_reference: fixture.section_reference,
          ...fixture.material_contract_criterion,
        }],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'material-contracts-dark-bridge-fixture/v1',
        model_id: 'recorded-fixture',
        prompt: 'material-contracts-dark-bridge-fixture/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: compileFixtureContractV27(),
    admitted_source_context: admittedSourceContext,
  });
  return {
    fixture,
    projection: projectMaterialContractsProductSurfaces({ resolution, deal_id: fixture.deal_id }),
  };
}

async function buildFiles() {
  const files = new Map();

  const { fixture, projection } = await buildLandosProjection();
  files.set('landos-abbvie.projection.json', `${JSON.stringify(projection, null, 2)}\n`);
  files.set('landos-abbvie.case.json', `${JSON.stringify({
    schema: 'REVIEW_PARITY_CASE/V1',
    family_id: 'MATERIAL_CONTRACTS',
    deal_id: fixture.deal_id,
    deal_label: 'Bespin (AbbVie) / Landos Biopharma',
    notes: 'Both sides reachable offline. Legacy cards are the committed dark-review fixture. The V2 side is the real material-contracts product projection, produced by replaying the recorded provider response in that same fixture through the real producer/resolver/projection chain (scripts/review-parity-build-cases.js). Zero model calls. NOTE: the committed legacy cards for this deal carry no Material Contracts card at all, so the legacy view of this family is legitimately empty -- the comparison result is a V2 ADDITION, and that is the true reading of these two committed artefacts, not a harness defect.',
    legacy: {
      cards_file: DARK_REVIEW_FIXTURE,
      cards_path: 'legacy_cards',
    },
    v2: {
      projection_file: 'tests/fixtures/review-parity/cases/material-contracts/landos-abbvie.projection.json',
    },
  }, null, 2)}\n`);

  for (const deal of V1_SNAPSHOT_DEALS) {
    files.set(`${deal.deal_id}.case.json`, `${JSON.stringify({
      schema: 'REVIEW_PARITY_CASE/V1',
      family_id: 'MATERIAL_CONTRACTS',
      deal_id: deal.deal_id,
      deal_label: deal.deal_label,
      notes: 'Legacy cards are recorded production provision_cards. CAVEAT: that snapshot carries only id / provision_type / provision_subtype / section_ref / primary_quote / region_hash / extraction_version -- it has no `features` and no `ai_metadata`, which is what the production legacy table actually renders from. The legacy view built from it therefore falls through material-contracts.config.js\'s rowsFromText() text-mining path, not the rowsFromFeatures() path production uses. It is real data in the real shape, but it is NOT the production legacy view, and a parity claim must not be based on it.',
      legacy: {
        cards_file: deal.file,
        cards_path: 'cards',
      },
      v2: {
        unavailable: V2_UNAVAILABLE_REASON,
      },
    }, null, 2)}\n`);
  }

  return files;
}

async function main(argv) {
  const check = argv.includes('--check');
  const files = await buildFiles();

  if (check) {
    const problems = [];
    for (const [name, content] of [...files.entries()].sort()) {
      const target = path.join(OUT_DIR, name);
      if (!fs.existsSync(target)) {
        problems.push(`missing: ${path.relative(REPO_ROOT, target)}`);
        continue;
      }
      if (fs.readFileSync(target, 'utf8') !== content) {
        problems.push(`differs: ${path.relative(REPO_ROOT, target)}`);
      }
    }
    if (problems.length) {
      process.stderr.write(`review-parity-build-cases --check failed:\n  ${problems.join('\n  ')}\n`);
      return 1;
    }
    process.stdout.write(`review-parity-build-cases --check: ${files.size} file(s) match\n`);
    return 0;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, content] of [...files.entries()].sort()) {
    fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8');
    process.stdout.write(`wrote ${path.relative(REPO_ROOT, path.join(OUT_DIR, name))}\n`);
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`review-parity-build-cases: ${error && error.stack ? error.stack : error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildFiles, buildLandosProjection, main };
