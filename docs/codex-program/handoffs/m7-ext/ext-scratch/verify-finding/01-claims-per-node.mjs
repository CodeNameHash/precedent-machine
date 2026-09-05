'use strict';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);

const ANALYSIS_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const analysisSet = loadJson(ANALYSIS_SET_PATH);
const members = analysisSet.members;
if (!Array.isArray(members)) {
  throw new Error('analysis set has no members array');
}

const agreements = members.map((member) => {
  const agreementId = member.agreement_id;
  const binding = member.agreement_analysis_binding;
  const record = loadJson(resolve(repoRoot, binding.path));
  const claims = Array.isArray(record.claims) ? record.claims : [];
  const nodeCounts = new Map();
  for (const claim of claims) {
    const nodeId = claim?.source_node_occurrence_ids?.[0];
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      nodeCounts.set('__missing_or_invalid__', (nodeCounts.get('__missing_or_invalid__') ?? 0) + 1);
      continue;
    }
    nodeCounts.set(nodeId, (nodeCounts.get(nodeId) ?? 0) + 1);
  }
  const distinctNodes = [...nodeCounts.keys()].filter((key) => key !== '__missing_or_invalid__');
  const sharedNodes = [...nodeCounts.entries()]
    .filter(([key, count]) => key !== '__missing_or_invalid__' && count >= 2)
    .map(([node_id, claim_count]) => ({ node_id, claim_count }));
  return {
    agreement_id: agreementId,
    analysis_path: binding.path,
    m4_claim_count: claims.length,
    distinct_source_node_occurrence_ids_0: distinctNodes.length,
    nodes_with_two_or_more_claims: sharedNodes.length,
    missing_or_invalid_source_node_0: nodeCounts.get('__missing_or_invalid__') ?? 0,
    max_claims_on_one_node: nodeCounts.size === 0
      ? 0
      : Math.max(0, ...[...nodeCounts.entries()]
        .filter(([key]) => key !== '__missing_or_invalid__')
        .map(([, count]) => count)),
  };
});

const totals = agreements.reduce((acc, row) => {
  acc.m4_claim_count += row.m4_claim_count;
  acc.distinct_source_node_occurrence_ids_0 += row.distinct_source_node_occurrence_ids_0;
  acc.nodes_with_two_or_more_claims += row.nodes_with_two_or_more_claims;
  return acc;
}, {
  m4_claim_count: 0,
  distinct_source_node_occurrence_ids_0: 0,
  nodes_with_two_or_more_claims: 0,
});

process.stdout.write(`${JSON.stringify({
  analysis_set_id: analysisSet.agreement_analysis_set_id,
  agreement_count: agreements.length,
  agreements,
  totals,
}, null, 2)}\n`);
