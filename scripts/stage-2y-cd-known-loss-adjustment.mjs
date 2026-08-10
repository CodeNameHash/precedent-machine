#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonical,
  measurePinnedRuns,
  validateManifest,
} from './stage-2y-cd-measurement.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = path.join(ROOT, 'evidence/canonical-v2');
const MANIFEST_PATH = path.join(EVIDENCE, 'stage-2y-cd-baseline-manifest.json');
const REPORT_PATH = path.join(EVIDENCE, 'stage-2y-cd-report.json');
const OUTPUT_PATH = path.join(EVIDENCE, 'stage-2y-cd-known-loss-adjustment.json');
const SKECHERS_FIXED_CLAIM_ID = '9d47df05490185fbf8094acfe34c8c193addc2fe5a8a788487e77424cdd341fb';
const NO_SHOP_COLLAPSED_ACTION_VALUES = new Set([
  'CEASE_FURNISHING_INFORMATION',
  'CONTINUE_DISCUSSIONS',
  'CONTINUE_NEGOTIATIONS',
  'ENGAGE_IN_NEGOTIATIONS',
  'ENTER_ALTERNATIVE_AGREEMENT',
  'PARTICIPATE_IN_NEGOTIATIONS',
  'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
]);
const EXPECTED = Object.freeze({
  resolved_claims: 1526,
  mechanical_content_rows: 1241,
  dno: 25,
  no_shop_action: 21,
  no_shop_buyer_party: 59,
  no_shop_overlap: 5,
  no_shop_unique: 75,
  no_other_reps_fraud: 36,
  mae_definition: 108,
  identified_total: 244,
  rendered_mae_definition: 8,
  rendered_deduction_total: 144,
  not_rendered_total: 100,
  adjusted: 1097,
  percent_1dp: 71.9,
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileHash(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${canonical(value)}\n`);
  fs.renameSync(temporary, filePath);
}

function relativeFromRoot(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/gu, '/');
}

function expectEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(`${code}:${actual}:${expected}`);
}

function buildClaimIndex(manifest) {
  const claims = new Map();
  for (const run of manifest.runs) {
    const resolution = readJson(path.resolve(ROOT, run.resolution.path));
    for (const entry of resolution.resolved || []) {
      const claimId = entry?.claim?.claim_revision_id;
      if (!claimId) throw new Error(`KNOWN_LOSS_CLAIM_ID_MISSING:${run.directory}`);
      if (claims.has(claimId)) throw new Error(`KNOWN_LOSS_CLAIM_ID_DUPLICATED:${claimId}`);
      claims.set(claimId, {
        claim_revision_id: claimId,
        run: run.directory,
        deal: run.deal,
        family: run.family,
        section_reference: entry.section_reference || entry.claim.section_reference || null,
        claim_definition_key: entry.resolved_claim_definition_key || entry.claim.claim_definition_key,
        canonical_value: entry.claim.canonical_value,
        party: entry.party || entry.provision_instance?.party || null,
        provision_instance_id: entry.provision_instance?.provision_instance_id || null,
      });
    }
  }
  return claims;
}

function splitDuplicateGroups(current, claimIndex) {
  const exactGroups = new Map();
  for (const group of current.full_output_duplicate_groups || []) {
    for (const member of group.members || []) {
      const claim = claimIndex.get(member.claim_revision_id);
      if (!claim) throw new Error(`KNOWN_LOSS_GROUP_CLAIM_UNKNOWN:${member.claim_revision_id}`);
      const key = [
        group.family,
        group.deal,
        claim.provision_instance_id,
        group.signature,
      ].join('|');
      if (!exactGroups.has(key)) {
        exactGroups.set(key, {
          grouping_key: key,
          family: group.family,
          deal: group.deal,
          provision_instance_id: claim.provision_instance_id,
          rendered_output_signature: group.signature,
          members: [],
        });
      }
      exactGroups.get(key).members.push(claim);
    }
  }
  return [...exactGroups.values()]
    .map((group) => ({
      ...group,
      members: group.members.sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id)),
    }))
    .sort((left, right) => left.grouping_key.localeCompare(right.grouping_key));
}

function addReason(reasonMap, claim, reasonCode) {
  const existing = reasonMap.get(claim.claim_revision_id) || { claim, reason_codes: new Set() };
  existing.reason_codes.add(reasonCode);
  reasonMap.set(claim.claim_revision_id, existing);
}

function compactGroup(group) {
  return {
    grouping_key: group.grouping_key,
    deal: group.deal,
    provision_instance_id: group.provision_instance_id,
    rendered_output_signature: group.rendered_output_signature,
    member_claim_revision_ids: group.members.map((claim) => claim.claim_revision_id),
  };
}

function buildKnownLossAdjustment({ manifest, report, current }) {
  validateManifest(manifest);
  if (report?.schema_version !== 'STAGE_2Y_CD_REPORT/V1'
    || report.manifest_id !== manifest.manifest_id) throw new Error('KNOWN_LOSS_REPORT_BINDING_INVALID');
  if (canonical(report.current) !== canonical(current)) throw new Error('KNOWN_LOSS_REPORT_CURRENT_STALE');

  const claimIndex = buildClaimIndex(manifest);
  const exactGroups = splitDuplicateGroups(current, claimIndex);
  const repeatedExactGroups = exactGroups.filter((group) => group.members.length > 1);
  const reasons = new Map();

  const dnoGroups = repeatedExactGroups.filter((group) => group.family === 'DNO_INDEMNIFICATION');
  const dnoClaims = dnoGroups.flatMap((group) => group.members);
  dnoClaims.forEach((claim) => addReason(reasons, claim, 'DNO_SPECIFIC_MECHANIC_NOT_RENDERED'));

  const noShopActionEvidence = [];
  for (const group of repeatedExactGroups.filter((candidate) => candidate.family === 'NO_SHOP')) {
    for (const claim of group.members) {
      if (!NO_SHOP_COLLAPSED_ACTION_VALUES.has(claim.canonical_value)) continue;
      addReason(reasons, claim, 'NO_SHOP_ACTION_CODE_ABSENT_FROM_COMPOSITE_LABEL');
      noShopActionEvidence.push({
        ...claim,
        grouping_key: group.grouping_key,
        rendered_output_signature: group.rendered_output_signature,
        sibling_claim_revision_ids: group.members.map((member) => member.claim_revision_id),
      });
    }
  }

  const noShopBuyerClaims = [...claimIndex.values()]
    .filter((claim) => claim.family === 'NO_SHOP' && claim.party?.capacity === 'BUYER');
  noShopBuyerClaims.forEach((claim) => addReason(reasons, claim, 'NO_SHOP_BUYER_PARTY_NOT_RENDERED'));

  const noOtherRepsFraudClaims = [...claimIndex.values()]
    .filter((claim) => claim.family === 'NO_OTHER_REPS_FRAUD');
  noOtherRepsFraudClaims.forEach((claim) => addReason(reasons, claim, 'NO_OTHER_REPS_FRAUD_PARTY_NOT_RENDERED'));

  const maeClaims = [...claimIndex.values()].filter((claim) => claim.family === 'MAE_DEFINITION');
  maeClaims.forEach((claim) => addReason(reasons, claim, 'MAE_DEFINITION_PARTY_NOT_RENDERED'));

  const actionIds = new Set(noShopActionEvidence.map((claim) => claim.claim_revision_id));
  const buyerIds = new Set(noShopBuyerClaims.map((claim) => claim.claim_revision_id));
  const overlapIds = [...actionIds].filter((claimId) => buyerIds.has(claimId)).sort();
  const noShopUniqueIds = new Set([...actionIds, ...buyerIds]);
  const renderedClaimIds = new Set((current.full_output_duplicate_groups || [])
    .flatMap((group) => group.members || [])
    .map((member) => member.claim_revision_id));
  const affectedClaims = [...reasons.values()]
    .map(({ claim, reason_codes: reasonCodes }) => ({
      ...claim,
      reason_codes: [...reasonCodes].sort(),
      rendered_in_current_measurement: renderedClaimIds.has(claim.claim_revision_id),
    }))
    .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
  const deductedRenderedClaims = affectedClaims
    .filter((claim) => claim.rendered_in_current_measurement);
  const notRenderedKnownLossClaims = affectedClaims
    .filter((claim) => !claim.rendered_in_current_measurement);

  const resolvedClaims = current.totals.resolved;
  const mechanicalRows = current.totals.rendering_funnel.row_with_content;
  const adjustedRows = mechanicalRows - deductedRenderedClaims.length;
  const percent1dp = Math.round((adjustedRows / resolvedClaims) * 1000) / 10;

  expectEqual(resolvedClaims, EXPECTED.resolved_claims, 'KNOWN_LOSS_RESOLVED_COUNT_DRIFT');
  expectEqual(mechanicalRows, EXPECTED.mechanical_content_rows, 'KNOWN_LOSS_MECHANICAL_COUNT_DRIFT');
  expectEqual(dnoClaims.length, EXPECTED.dno, 'KNOWN_LOSS_DNO_COUNT_DRIFT');
  expectEqual(actionIds.size, EXPECTED.no_shop_action, 'KNOWN_LOSS_NO_SHOP_ACTION_COUNT_DRIFT');
  expectEqual(buyerIds.size, EXPECTED.no_shop_buyer_party, 'KNOWN_LOSS_NO_SHOP_BUYER_COUNT_DRIFT');
  expectEqual(overlapIds.length, EXPECTED.no_shop_overlap, 'KNOWN_LOSS_NO_SHOP_OVERLAP_DRIFT');
  expectEqual(noShopUniqueIds.size, EXPECTED.no_shop_unique, 'KNOWN_LOSS_NO_SHOP_UNION_DRIFT');
  expectEqual(noOtherRepsFraudClaims.length, EXPECTED.no_other_reps_fraud, 'KNOWN_LOSS_NO_OTHER_REPS_COUNT_DRIFT');
  expectEqual(maeClaims.length, EXPECTED.mae_definition, 'KNOWN_LOSS_MAE_COUNT_DRIFT');
  expectEqual(affectedClaims.length, EXPECTED.identified_total, 'KNOWN_LOSS_IDENTIFIED_TOTAL_DRIFT');
  expectEqual(
    maeClaims.filter((claim) => renderedClaimIds.has(claim.claim_revision_id)).length,
    EXPECTED.rendered_mae_definition,
    'KNOWN_LOSS_RENDERED_MAE_COUNT_DRIFT',
  );
  expectEqual(deductedRenderedClaims.length, EXPECTED.rendered_deduction_total, 'KNOWN_LOSS_RENDERED_DEDUCTION_DRIFT');
  expectEqual(notRenderedKnownLossClaims.length, EXPECTED.not_rendered_total, 'KNOWN_LOSS_NOT_RENDERED_COUNT_DRIFT');
  expectEqual(adjustedRows, EXPECTED.adjusted, 'KNOWN_LOSS_ADJUSTED_COUNT_DRIFT');
  expectEqual(percent1dp, EXPECTED.percent_1dp, 'KNOWN_LOSS_PERCENT_DRIFT');
  if (reasons.has(SKECHERS_FIXED_CLAIM_ID)) throw new Error('SKECHERS_FIXED_CLAIM_WRONGLY_DEDUCTED');
  if (!claimIndex.has(SKECHERS_FIXED_CLAIM_ID)) throw new Error('SKECHERS_FIXED_CLAIM_MISSING');

  const body = {
    schema_version: 'STAGE_2Y_CD_KNOWN_LOSS_ADJUSTMENT/V1',
    label: 'KNOWN_LOSS_ADJUSTED_NOT_HUMAN_ACCEPTED',
    authority: {
      human_acceptance: false,
      human_accepted_rows: null,
      model_calls: 0,
      product_writes: false,
      publication_authorisation: 'NONE',
      serving_activated: false,
    },
    sources: {
      baseline_manifest: {
        path: relativeFromRoot(MANIFEST_PATH),
        sha256: fileHash(MANIFEST_PATH),
        manifest_id: manifest.manifest_id,
        input_set_digest: manifest.input_set_digest,
      },
      phase_cd_report: {
        path: relativeFromRoot(REPORT_PATH),
        sha256: fileHash(REPORT_PATH),
        schema_version: report.schema_version,
      },
    },
    method: {
      grouping_key: 'family|deal|provision_instance_id|rendered_output_signature',
      statement: 'Deduct only the four enumerated known information-loss rules. This is not human acceptance.',
      rules: [
        {
          rule_id: 'DNO',
          count: dnoClaims.length,
          test: 'Every D&O claim in an exact grouping-key group with more than one claim.',
        },
        {
          rule_id: 'NO_SHOP',
          count: noShopUniqueIds.size,
          test: 'Union of the selected absent action-code claims and all Buyer-party claims. Count overlaps once.',
          collapsed_action_canonical_values: [...NO_SHOP_COLLAPSED_ACTION_VALUES].sort(),
        },
        {
          rule_id: 'NO_OTHER_REPS_FRAUD',
          count: noOtherRepsFraudClaims.length,
          test: 'Every resolved No Other Reps / Fraud claim because its party is not rendered.',
        },
        {
          rule_id: 'MAE_DEFINITION',
          count: maeClaims.length,
          test: 'Every resolved MAE Definition claim because its party is not rendered.',
        },
      ],
    },
    summary: {
      mechanical_content_rows: mechanicalRows,
      identified_known_loss_claims: affectedClaims.length,
      rendered_known_loss_deduction_rows: deductedRenderedClaims.length,
      known_loss_claims_already_not_rendered: notRenderedKnownLossClaims.length,
      known_loss_adjusted_rows: adjustedRows,
      resolved_claim_denominator: resolvedClaims,
      known_loss_adjusted_rate: adjustedRows / resolvedClaims,
      known_loss_adjusted_percent_1dp: percent1dp,
      human_acceptance_status: 'NOT_MEASURED',
    },
    rule_counts: {
      identified: {
        DNO: dnoClaims.length,
        NO_SHOP: noShopUniqueIds.size,
        NO_OTHER_REPS_FRAUD: noOtherRepsFraudClaims.length,
        MAE_DEFINITION: maeClaims.length,
      },
      rendered_deductions: {
        DNO: dnoClaims.filter((claim) => renderedClaimIds.has(claim.claim_revision_id)).length,
        NO_SHOP: [...noShopUniqueIds].filter((claimId) => renderedClaimIds.has(claimId)).length,
        NO_OTHER_REPS_FRAUD: noOtherRepsFraudClaims
          .filter((claim) => renderedClaimIds.has(claim.claim_revision_id)).length,
        MAE_DEFINITION: maeClaims.filter((claim) => renderedClaimIds.has(claim.claim_revision_id)).length,
      },
    },
    reason_counts: {
      DNO_SPECIFIC_MECHANIC_NOT_RENDERED: dnoClaims.length,
      NO_SHOP_ACTION_CODE_ABSENT_FROM_COMPOSITE_LABEL: actionIds.size,
      NO_SHOP_BUYER_PARTY_NOT_RENDERED: buyerIds.size,
      NO_OTHER_REPS_FRAUD_PARTY_NOT_RENDERED: noOtherRepsFraudClaims.length,
      MAE_DEFINITION_PARTY_NOT_RENDERED: maeClaims.length,
    },
    overlaps: {
      no_shop_action_and_buyer_party: {
        count: overlapIds.length,
        claim_revision_ids: overlapIds,
      },
    },
    affected_claim_count: affectedClaims.length,
    affected_claims: affectedClaims,
    rendered_deduction_claim_count: deductedRenderedClaims.length,
    rendered_deduction_claim_revision_ids: deductedRenderedClaims
      .map((claim) => claim.claim_revision_id),
    not_rendered_known_loss_claim_count: notRenderedKnownLossClaims.length,
    not_rendered_known_loss_claim_revision_ids: notRenderedKnownLossClaims
      .map((claim) => claim.claim_revision_id),
    supporting_group_evidence: {
      dno_exact_duplicate_groups: dnoGroups.map(compactGroup),
      no_shop_collapsed_action_claims: noShopActionEvidence
        .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id)),
    },
    non_deduction_checks: [{
      claim_revision_id: SKECHERS_FIXED_CLAIM_ID,
      deal: 'skechers',
      family: 'NO_SHOP',
      status: 'NOT_IN_KNOWN_LOSS_SET',
      reason: 'The fixed governed recommendation-change claim does not meet any of the four known-loss rules.',
    }],
  };
  return { ...body, adjustment_id: sha256(canonical(body)) };
}

function recompute() {
  const manifest = readJson(MANIFEST_PATH);
  const report = readJson(REPORT_PATH);
  const current = measurePinnedRuns(manifest);
  return buildKnownLossAdjustment({ manifest, report, current });
}

function parseArgs(argv) {
  if (argv.length < 1 || argv.length > 2 || !['--write', '--check'].includes(argv[0])) {
    throw new Error('USAGE: --write [output-path] | --check [output-path]');
  }
  return { mode: argv[0], outputPath: argv[1] ? path.resolve(argv[1]) : OUTPUT_PATH };
}

function main() {
  const { mode, outputPath } = parseArgs(process.argv.slice(2));
  const adjustment = recompute();
  if (mode === '--write') {
    writeJson(outputPath, adjustment);
    process.stdout.write(`Known-loss adjustment written: ${adjustment.summary.known_loss_adjusted_rows} rows, ${adjustment.summary.known_loss_adjusted_percent_1dp}%\n`);
    return;
  }
  if (!fs.existsSync(outputPath) || canonical(readJson(outputPath)) !== canonical(adjustment)) {
    throw new Error(`STALE_KNOWN_LOSS_ADJUSTMENT:${outputPath}`);
  }
  process.stdout.write(`Known-loss adjustment valid: ${adjustment.summary.known_loss_adjusted_rows} rows, ${adjustment.summary.known_loss_adjusted_percent_1dp}%\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; }
}

export {
  NO_SHOP_COLLAPSED_ACTION_VALUES,
  buildClaimIndex,
  buildKnownLossAdjustment,
  recompute,
  splitDuplicateGroups,
};
