#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  RIGHT_EVIDENCE_SURFACES,
  projectTerminationRightsProductSurfaces,
} = require('../../lib/canonical-v2/termination-product-projection');

const DEFAULT_RUN_IDS = Object.freeze([
  'concho-termination-20260809-2xk-final',
  'metsera-termination-20260809-2xk-final',
  'redhat-termination-20260809-2xk-final',
  'skechers-termination-20260809-2xk-final',
  'skywater-termination-20260809-2xk-final',
  'topbuild-termination-20260809-2xk-r3-final',
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function compactError(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error),
  };
}

function reviewCounts(reviewQueue) {
  const resolvedOverlap = reviewQueue.filter((item) => item.has_resolution === true).length;
  return {
    total: reviewQueue.length,
    resolved_overlap: resolvedOverlap,
    unresolved: reviewQueue.length - resolvedOverlap,
  };
}

function evidenceSurface(entry) {
  const why = entry?.attributes?.why_unmapped;
  return typeof why === 'string' ? why.split(':', 1)[0].trim() : null;
}

function claimId(entry) {
  return entry?.claim?.claim_revision_id || null;
}

function evidenceIdentity(entry) {
  const evidence = entry?.claim?.evidence?.[0];
  return {
    excerpt_id: evidence?.excerpt_id || null,
    absolute_start: evidence?.absolute_start ?? null,
    absolute_end: evidence?.absolute_end ?? null,
  };
}

function duplicateSignature(entry) {
  const attrs = entry?.claim?.attributes || {};
  return JSON.stringify([
    entry.section_reference || null,
    entry.concept_key || null,
    entry.resolved_claim_definition_key || null,
    entry.claim?.raw_value || null,
    entry.claim?.canonical_value ?? null,
    attrs.assertion_kind || null,
    attrs.trigger_kind || null,
    attrs.terminating_party_scope || null,
    attrs.terminating_party_ref || null,
  ]);
}

function groupsWithMoreThanOne(entries, keyFor) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function duplicateClaimGroups(resolved) {
  return groupsWithMoreThanOne(resolved, duplicateSignature).map((entries) => ({
    section_reference: entries[0].section_reference,
    concept_key: entries[0].concept_key,
    definition_key: entries[0].resolved_claim_definition_key,
    raw_value: entries[0].claim?.raw_value || '',
    claim_revision_ids: entries.map(claimId).sort(),
    party_capacities: entries.map((entry) => entry.party?.capacity || null).sort(),
    provision_instance_ids: entries.map((entry) => entry.provision_instance?.provision_instance_id || null).sort(),
  })).sort((a, b) => a.claim_revision_ids[0].localeCompare(b.claim_revision_ids[0]));
}

function sharedExcerptGroups(resolved) {
  return groupsWithMoreThanOne(resolved, (entry) => evidenceIdentity(entry).excerpt_id).map((entries) => ({
    excerpt_id: evidenceIdentity(entries[0]).excerpt_id,
    claim_revision_ids: entries.map(claimId).sort(),
    definition_keys: [...new Set(entries.map((entry) => entry.resolved_claim_definition_key))].sort(),
    concept_keys: [...new Set(entries.map((entry) => entry.concept_key))].sort(),
  })).sort((a, b) => a.excerpt_id.localeCompare(b.excerpt_id));
}

function flattenRows(selected) {
  return selected.flatMap((container) => (
    Array.isArray(container.groups)
      ? container.groups.flatMap((group) => group.rows || [])
      : [container]
  ));
}

function hasContent(row) {
  if (!row?.present) return false;
  if (Array.isArray(row.value) && row.value.length > 0) return true;
  if (row.value !== null && row.value !== undefined && row.value !== '') return true;
  return typeof row.evidence === 'string' && row.evidence.length > 0;
}

function reasonForUnrendered(entry, projectedCard, cardsForCode, projectionError) {
  if (projectionError) return 'PROJECTION_ABORTED_FOR_DEAL';
  if (!projectedCard) return 'CLAIM_NOT_PROJECTED';
  if (entry.concept_key === 'TERMR-SUPERIOR') return 'ROUTED_TO_NO_SHOP_SECTION';
  if (projectedCard.provision_subtype === 'TERMR-NOSOL-BREACH') return 'NO_TERMINATION_RIGHT_ROW_FOR_CODE';
  if (cardsForCode.length > 1) return 'ROW_SELECTS_ONE_CARD_FOR_CODE';
  return 'NO_RENDERED_ROW_USES_PROJECTED_CARD';
}

async function diagnoseResolution({ resolution, dealId, runId }) {
  const reviewModule = await import('../../components/review/table-configs/termination-rights.config.js');
  const projectionResult = { projection: null, error: null };
  try {
    projectionResult.projection = projectTerminationRightsProductSurfaces({ resolution, deal_id: dealId });
  } catch (error) {
    projectionResult.error = compactError(error);
  }

  const projectionErrorAttribution = [];
  if (projectionResult.error) {
    for (const entry of resolution.resolved) {
      try {
        projectTerminationRightsProductSurfaces({
          resolution: { resolved: [entry], open_world: [] },
          deal_id: dealId,
        });
      } catch (error) {
        projectionErrorAttribution.push({
          claim_revision_id: claimId(entry),
          concept_key: entry.concept_key || null,
          definition_key: entry.resolved_claim_definition_key || null,
          error: compactError(error),
        });
      }
    }
  }

  const cards = projectionResult.projection?.cards || [];
  const selected = projectionResult.projection
    ? reviewModule.terminationRightsConfig.selectRows({ cards })
    : [];
  const rows = flattenRows(selected);
  const rowsWithContent = rows.filter(hasContent);
  const governedRows = rowsWithContent.filter((row) => row.sourceCard?.canonical_v2_lineage?.source === NATIVE_SOURCE);
  const deferredRows = rowsWithContent.filter((row) => row.sourceCard?.canonical_v2_lineage?.source === EVIDENCE_SOURCE);
  const renderedClaimIds = new Set(governedRows.flatMap((row) => row.sourceCard?.canonical_v2_lineage?.claim_revision_ids || []));
  const projectedCardByClaim = new Map();
  for (const card of cards) {
    for (const id of card.canonical_v2_lineage?.claim_revision_ids || []) projectedCardByClaim.set(id, card);
  }
  const cardsByCode = new Map();
  for (const card of cards.filter((item) => item.canonical_v2_lineage?.source === NATIVE_SOURCE)) {
    if (!cardsByCode.has(card.provision_subtype)) cardsByCode.set(card.provision_subtype, []);
    cardsByCode.get(card.provision_subtype).push(card);
  }

  const resolvedItems = resolution.resolved.map((entry) => {
    const id = claimId(entry);
    const projectedCard = projectedCardByClaim.get(id) || null;
    const cardCode = projectedCard?.provision_subtype || entry.concept_key;
    const rendered = renderedClaimIds.has(id);
    return {
      claim_revision_id: id,
      section_reference: entry.section_reference || null,
      definition_key: entry.resolved_claim_definition_key || null,
      concept_key: entry.concept_key || null,
      party_capacity: entry.party?.capacity || null,
      provision_instance_id: entry.provision_instance?.provision_instance_id || null,
      raw_value: entry.claim?.raw_value || '',
      evidence: evidenceIdentity(entry),
      projected_card_id: projectedCard?.id || null,
      projected_code: projectedCard?.provision_subtype || null,
      renders_with_content: rendered,
      no_row_reason: rendered
        ? null
        : reasonForUnrendered(entry, projectedCard, cardsByCode.get(cardCode) || [], projectionResult.error),
    };
  });

  const openWorldItems = resolution.open_world.map((entry) => {
    const surface = evidenceSurface(entry);
    const eligible = RIGHT_EVIDENCE_SURFACES.has(surface);
    const card = cards.find((item) => item.canonical_v2_lineage?.closure_id === entry.closure_id);
    const rendered = Boolean(card && deferredRows.some((row) => row.sourceCard?.id === card.id));
    return {
      closure_id: entry.closure_id || null,
      section_reference: entry.section_reference || null,
      surface,
      raw_value: entry.raw_value || '',
      projection_eligible: eligible,
      renders_with_content: rendered,
      no_row_reason: rendered ? null : (projectionResult.error ? 'PROJECTION_ABORTED_FOR_DEAL' : 'OPEN_WORLD_SURFACE_NOT_ROUTED'),
    };
  });

  const duplicateRows = [...cardsByCode.entries()]
    .filter(([, codeCards]) => codeCards.length > 1)
    .map(([code, codeCards]) => ({
      code,
      projected_card_ids: codeCards.map((card) => card.id).sort(),
      rendered_card_ids: governedRows.filter((row) => row.sourceCard?.provision_subtype === code).map((row) => row.sourceCard.id).sort(),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const review = reviewCounts(resolution.review_queue);
  return {
    run_id: runId,
    deal_id: dealId,
    counts: {
      attempted_compiled_candidates: resolution.resolution_receipt?.counts?.compiled_candidates ?? null,
      resolved: resolution.resolved.length,
      open_world: resolution.open_world.length,
      review_queue_total: review.total,
      review_queue_resolved_overlap: review.resolved_overlap,
      review_queue_unresolved: review.unresolved,
      projected_governed_cards: cards.filter((card) => card.canonical_v2_lineage?.source === NATIVE_SOURCE).length,
      rendered_governed_rows_with_content: governedRows.length,
      resolved_claims_with_rendered_row_content: resolvedItems.filter((item) => item.renders_with_content).length,
      resolved_claims_without_rendered_row_content: resolvedItems.filter((item) => !item.renders_with_content).length,
      projected_deferred_cards: cards.filter((card) => card.canonical_v2_lineage?.source === EVIDENCE_SOURCE).length,
      rendered_deferred_rows_with_content: deferredRows.length,
    },
    projection_error: projectionResult.error,
    projection_error_attribution: projectionErrorAttribution,
    duplicate_claim_groups: duplicateClaimGroups(resolution.resolved),
    shared_excerpt_groups: sharedExcerptGroups(resolution.resolved),
    multiple_cards_competing_for_one_row: duplicateRows,
    resolved_items: resolvedItems,
    open_world_items: openWorldItems,
    review_items: resolution.review_queue.map((item) => ({
      closure_id: item.closure_id || null,
      claim_revision_id: item.claim_revision_id || null,
      section_reference: item.section_reference || null,
      concept_key: item.concept_key || null,
      definition_key: item.resolved_claim_definition_key || null,
      has_resolution: item.has_resolution === true,
      reasons: item.reasons || [],
      raw_value: item.raw_value || '',
    })),
  };
}

function sumCounts(deals, key) {
  return deals.reduce((sum, deal) => sum + (deal.counts[key] || 0), 0);
}

function aggregate(deals) {
  const keys = [
    'attempted_compiled_candidates',
    'resolved',
    'open_world',
    'review_queue_total',
    'review_queue_resolved_overlap',
    'review_queue_unresolved',
    'projected_governed_cards',
    'rendered_governed_rows_with_content',
    'resolved_claims_with_rendered_row_content',
    'resolved_claims_without_rendered_row_content',
    'projected_deferred_cards',
    'rendered_deferred_rows_with_content',
  ];
  const counts = Object.fromEntries(keys.map((key) => [key, sumCounts(deals, key)]));
  const resolvedItems = deals.flatMap((deal) => deal.resolved_items);
  counts.resolved_items_by_definition = Object.fromEntries(
    [...new Set(resolvedItems.map((item) => item.definition_key))].sort().map((definition) => {
      const items = resolvedItems.filter((item) => item.definition_key === definition);
      return [definition, {
        total: items.length,
        renders_with_content: items.filter((item) => item.renders_with_content).length,
        no_row: items.filter((item) => !item.renders_with_content).length,
      }];
    }),
  );
  counts.no_row_reasons = Object.fromEntries(
    [...new Set(resolvedItems.map((item) => item.no_row_reason).filter(Boolean))].sort().map((reason) => [
      reason,
      resolvedItems.filter((item) => item.no_row_reason === reason).length,
    ]),
  );
  counts.duplicate_legal_fact_groups = deals.reduce((sum, deal) => sum + deal.duplicate_claim_groups.length, 0);
  counts.claims_in_duplicate_legal_fact_groups = deals.reduce(
    (sum, deal) => sum + deal.duplicate_claim_groups.reduce((dealSum, group) => dealSum + group.claim_revision_ids.length, 0),
    0,
  );
  return counts;
}

async function readJsonWithDigest(filePath) {
  const bytes = await fs.readFile(filePath);
  return { value: JSON.parse(bytes), sha256: sha256(bytes) };
}

async function diagnoseRuns({ evidenceRoot, runIds = DEFAULT_RUN_IDS }) {
  const deals = [];
  for (const runId of runIds) {
    const runDir = path.join(evidenceRoot, runId);
    const resolutionFile = path.join(runDir, 'resolution.json');
    const manifestFile = path.join(runDir, 'run-manifest.json');
    const [{ value: resolution, sha256: resolutionSha }, { value: manifest, sha256: manifestSha }] = await Promise.all([
      readJsonWithDigest(resolutionFile),
      readJsonWithDigest(manifestFile),
    ]);
    const deal = await diagnoseResolution({ resolution, dealId: manifest.deal, runId });
    deals.push({
      ...deal,
      source: {
        producer_commit: manifest.code_provenance?.commit || null,
        producer_working_tree_clean: manifest.code_provenance?.working_tree_clean ?? null,
        resolution_sha256: resolutionSha,
        run_manifest_sha256: manifestSha,
      },
    });
  }
  const totals = aggregate(deals);
  return {
    schema_version: 'CANONICAL_V2_TERMINATION_RENDER_DIAGNOSIS/V1',
    scope: {
      run_ids: [...runIds],
      current_code_commit: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      claimed_missing_row_count: 79,
      reproduced_missing_row_count: totals.resolved_claims_without_rendered_row_content,
      claimed_count_reproduced: totals.resolved_claims_without_rendered_row_content === 79,
      counting_rule: 'A resolved claim renders with content only when its claim_revision_id is in the native card selected by a present Review row. A deal projection error marks all resolved claims in that deal as not rendered.',
    },
    totals,
    deals,
  };
}

function parseArgs(argv) {
  const args = { runIds: [...DEFAULT_RUN_IDS] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--evidence-root') args.evidenceRoot = argv[++index];
    else if (argv[index] === '--output') args.output = argv[++index];
    else if (argv[index] === '--run-id') {
      if (!args.explicitRuns) args.runIds = [];
      args.explicitRuns = true;
      args.runIds.push(argv[++index]);
    } else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!args.evidenceRoot) throw new Error('Usage: --evidence-root <directory> [--output <file>] [--run-id <id>]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await diagnoseRuns(args);
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) await fs.writeFile(args.output, text);
  else process.stdout.write(text);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

export {
  DEFAULT_RUN_IDS,
  diagnoseResolution,
  diagnoseRuns,
  reviewCounts,
};
