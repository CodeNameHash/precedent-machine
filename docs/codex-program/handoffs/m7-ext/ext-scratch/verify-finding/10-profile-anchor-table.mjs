'use strict';

/**
 * Q-0010: real-clause anchor table for every approved Work 3 profile.
 *
 * Each profile's required_expression_signature is matched to that family's
 * phase-2 terminal_rule_registry. Authority files are discovered in the
 * control directory (prefer -v2 over -v1 over an unversioned file). MAE is
 * the v1 file; the unversioned termination authority is not used.
 *
 * Span source:
 * - REGISTRY when a closure member carries a complete UTF-8 half-open span
 * - M4_EVIDENCE_EDGE when the span is taken from the M4 claim's evidence edges
 *   on the Work 3 analysis-set member (not a guessed shadow/m4 path)
 * - UNRESOLVED when the signature is absent or no span can be formed
 *
 * verified is true only after hashing canonical_text bytes at the span.
 * The registry's own text_sha256 is never trusted as proof.
 * Parent and nearest-M4 fields do not change verification.
 *
 * Every row also records:
 * - nearest M4 claim by evidence-edge span overlap on the Work 3
 *   analysis-set member (never a guessed shadow/m4/<id>.json path)
 * - parent_node_occurrence_id / parent_node_kind from the M2 index node
 */

import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(new URL(import.meta.url).pathname);
const CONTROL_DIR = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control',
);
const PROFILE_SET_PATH = resolve(
  CONTROL_DIR,
  'm7-v2-repair-family-work3-approved-profile-set.json',
);
const ANALYSIS_SET_PATH = resolve(
  CONTROL_DIR,
  'm7-v2-repair-work3-agreement-analysis-set.json',
);
const INDEX_SET_PATH = resolve(
  CONTROL_DIR,
  'm7-v2-repair-work3-agreement-index-set.json',
);

const ROW_KEYS = [
  'profile_id',
  'profile_key',
  'family_key',
  'classification_path',
  'signature',
  'agreement_id',
  'm4_claim_ids',
  'source_node_occurrence_id',
  'span_source',
  'start_byte',
  'end_byte',
  'text_sha256',
  'verified',
  'node_kind',
  'claims_on_node',
  'nearest_m4_claim_id',
  'nearest_m4_claim_definition_key',
  'nearest_m4_overlap_bytes',
  'parent_node_occurrence_id',
  'parent_node_kind',
];

const PRE_REVISION_TABLE_SHA256 = '6496657a7a6283f957039b574626032e0cefd7cfe8d35042592df77288849c5f';
const PRE_REVISION_TABLE_BYTES = 1471325;

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function familySlug(familyKey) {
  return String(familyKey).toLowerCase().replaceAll('_', '-');
}

function discoverAuthorityFiles(controlDir) {
  const names = readdirSync(controlDir)
    .filter((name) => name.startsWith('m7-v2-repair-contract-')
      && name.includes('-authoring-phase2-authority')
      && name.endsWith('.json'))
    .sort();
  const bySlug = new Map();
  for (const name of names) {
    const match = name.match(
      /^m7-v2-repair-contract-(.+)-authoring-phase2-authority(?:-v(\d+))?\.json$/,
    );
    if (!match) continue;
    const slug = match[1];
    const version = match[2] === undefined ? 0 : Number(match[2]);
    const list = bySlug.get(slug) ?? [];
    list.push({ name, version });
    bySlug.set(slug, list);
  }
  const chosen = new Map();
  const skipped = [];
  for (const [slug, list] of [...bySlug.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    list.sort((left, right) => right.version - left.version || left.name.localeCompare(right.name));
    chosen.set(slug, list[0].name);
    for (const extra of list.slice(1)) skipped.push(extra.name);
  }
  return { chosen, skipped, listed: names };
}

function completeSpan(span) {
  if (!span || typeof span !== 'object') return null;
  if (!Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)) return null;
  if (typeof span.text_sha256 !== 'string' || span.text_sha256.length === 0) return null;
  if (span.start_byte < 0 || span.end_byte < span.start_byte) return null;
  return {
    start_byte: span.start_byte,
    end_byte: span.end_byte,
    text_sha256: span.text_sha256,
  };
}

function memberNodeId(member) {
  if (!member || typeof member !== 'object') return null;
  if (typeof member.source_node_occurrence_id === 'string' && member.source_node_occurrence_id.length > 0) {
    return member.source_node_occurrence_id;
  }
  if (typeof member.node_occurrence_id === 'string' && member.node_occurrence_id.length > 0) {
    return member.node_occurrence_id;
  }
  return null;
}

function pickMember(members) {
  if (!Array.isArray(members) || members.length === 0) return null;
  const primary = members.find((member) => member?.closure_role === 'PRIMARY_RULE_NODE');
  if (primary) return primary;
  const withSpan = members.find((member) => completeSpan(member?.source_span));
  if (withSpan) return withSpan;
  return members[0];
}

function verifySpan(canonicalText, span) {
  if (typeof canonicalText !== 'string' || !span) return false;
  const bytes = Buffer.from(canonicalText, 'utf8');
  if (span.end_byte > bytes.length) return false;
  const slice = bytes.subarray(span.start_byte, span.end_byte);
  return sha256Hex(slice) === span.text_sha256;
}

function rowObject(fields) {
  const row = {};
  for (const key of ROW_KEYS) row[key] = fields[key];
  return row;
}

function emptyAnchor(profile, extras) {
  return rowObject({
    profile_id: profile.profile_id ?? null,
    profile_key: profile.profile_key ?? null,
    family_key: profile.family_key ?? null,
    classification_path: Array.isArray(profile.classification_path)
      ? [...profile.classification_path]
      : [],
    signature: typeof profile.required_expression_signature === 'string'
      ? profile.required_expression_signature
      : null,
    agreement_id: extras.agreement_id ?? null,
    m4_claim_ids: Array.isArray(extras.m4_claim_ids) ? [...extras.m4_claim_ids] : [],
    source_node_occurrence_id: extras.source_node_occurrence_id ?? null,
    span_source: extras.span_source ?? 'UNRESOLVED',
    start_byte: extras.start_byte ?? null,
    end_byte: extras.end_byte ?? null,
    text_sha256: extras.text_sha256 ?? null,
    verified: false,
    node_kind: extras.node_kind ?? null,
    claims_on_node: Number.isInteger(extras.claims_on_node) ? extras.claims_on_node : 0,
    nearest_m4_claim_id: extras.nearest_m4_claim_id ?? null,
    nearest_m4_claim_definition_key: extras.nearest_m4_claim_definition_key ?? 'NONE',
    nearest_m4_overlap_bytes: Number.isInteger(extras.nearest_m4_overlap_bytes)
      ? extras.nearest_m4_overlap_bytes
      : 0,
    parent_node_occurrence_id: extras.parent_node_occurrence_id ?? null,
    parent_node_kind: extras.parent_node_kind ?? 'NONE',
  });
}

function bump(map, key) {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}

function histogramObject(map, keySort) {
  const keys = [...map.keys()].sort(keySort);
  const out = {};
  for (const key of keys) out[key] = map.get(key);
  return out;
}

function loadIndexCache(indexSet, missingPaths) {
  const byAgreement = new Map();
  for (const member of indexSet.members ?? []) {
    const rel = member?.path;
    if (typeof rel !== 'string') {
      missingPaths.push('work3-index-set member missing path');
      continue;
    }
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) {
      missingPaths.push(rel);
      continue;
    }
    const record = loadJson(abs);
    const agreementId = record?.source_binding?.agreement_id;
    if (typeof agreementId !== 'string' || agreementId.length === 0) {
      missingPaths.push(`${rel} (no source_binding.agreement_id)`);
      continue;
    }
    byAgreement.set(agreementId, {
      path: rel,
      canonical_text: record.source_binding.canonical_text ?? null,
      nodes: new Map(
        (Array.isArray(record.nodes) ? record.nodes : [])
          .filter((node) => typeof node?.node_occurrence_id === 'string')
          .map((node) => [node.node_occurrence_id, node]),
      ),
    });
  }
  return byAgreement;
}

function loadAnalysisCache(analysisSet, missingPaths) {
  const byAgreement = new Map();
  for (const member of analysisSet.members ?? []) {
    const agreementId = member?.agreement_id;
    const rel = member?.agreement_analysis_binding?.path;
    if (typeof agreementId !== 'string' || typeof rel !== 'string') {
      missingPaths.push('work3-analysis-set member missing agreement_id or path');
      continue;
    }
    const abs = resolve(repoRoot, rel);
    if (!existsSync(abs)) {
      missingPaths.push(rel);
      continue;
    }
    const record = loadJson(abs);
    const claims = Array.isArray(record.claims) ? record.claims : [];
    const edges = Array.isArray(record.evidence_edges) ? record.evidence_edges : [];
    const claimById = new Map();
    const claimCountByNode = new Map();
    for (const claim of claims) {
      if (typeof claim?.analysis_claim_id === 'string') {
        claimById.set(claim.analysis_claim_id, claim);
      }
      for (const nodeId of claim?.source_node_occurrence_ids ?? []) {
        if (typeof nodeId === 'string' && nodeId.length > 0) {
          bump(claimCountByNode, nodeId);
        }
      }
    }
    const edgeById = new Map();
    for (const edge of edges) {
      if (typeof edge?.analysis_evidence_edge_id === 'string') {
        edgeById.set(edge.analysis_evidence_edge_id, edge);
      }
    }
    const claimEdgeSpans = [];
    for (const claim of claims) {
      if (typeof claim?.analysis_claim_id !== 'string') continue;
      const spans = [];
      for (const edgeId of claim.evidence_edge_ids ?? []) {
        const edge = edgeById.get(edgeId);
        const span = completeSpan(edge?.source_span);
        if (!span) continue;
        spans.push({
          start_byte: span.start_byte,
          end_byte: span.end_byte,
          source_node_occurrence_id: typeof edge.source_node_occurrence_id === 'string'
            ? edge.source_node_occurrence_id
            : null,
        });
      }
      claimEdgeSpans.push({
        analysis_claim_id: claim.analysis_claim_id,
        claim_definition_key: typeof claim.claim_definition_key === 'string'
          && claim.claim_definition_key.length > 0
          ? claim.claim_definition_key
          : 'NONE',
        source_node_occurrence_ids: Array.isArray(claim.source_node_occurrence_ids)
          ? claim.source_node_occurrence_ids.filter((id) => typeof id === 'string' && id.length > 0)
          : [],
        spans,
      });
    }
    byAgreement.set(agreementId, {
      path: rel,
      claimById,
      edgeById,
      claimCountByNode,
      claimEdgeSpans,
    });
  }
  return byAgreement;
}

function pickEvidenceEdge(analysis, claimIds, preferredNodeId) {
  if (!analysis || !Array.isArray(claimIds) || claimIds.length === 0) {
    return { edge: null, why: 'NO_M4_CLAIM_IDS' };
  }
  const edges = [];
  let sawClaim = false;
  for (const claimId of claimIds) {
    const claim = analysis.claimById.get(claimId);
    if (!claim) continue;
    sawClaim = true;
    for (const edgeId of claim.evidence_edge_ids ?? []) {
      const edge = analysis.edgeById.get(edgeId);
      if (edge) edges.push(edge);
    }
  }
  if (!sawClaim) return { edge: null, why: 'M4_CLAIM_NOT_ON_ANALYSIS' };
  if (edges.length === 0) return { edge: null, why: 'M4_EVIDENCE_EDGE_MISSING' };
  if (preferredNodeId) {
    const matched = edges.filter((edge) => edge.source_node_occurrence_id === preferredNodeId);
    if (matched.length > 0) {
      matched.sort((left, right) => (left.ordinal ?? 0) - (right.ordinal ?? 0)
        || String(left.analysis_evidence_edge_id).localeCompare(String(right.analysis_evidence_edge_id)));
      return { edge: matched[0], why: null };
    }
  }
  edges.sort((left, right) => (left.ordinal ?? 0) - (right.ordinal ?? 0)
    || String(left.analysis_evidence_edge_id).localeCompare(String(right.analysis_evidence_edge_id)));
  return { edge: edges[0], why: null };
}

function nodeKindOf(member, index, nodeId) {
  if (typeof member?.node_kind === 'string' && member.node_kind.length > 0) {
    return member.node_kind;
  }
  if (index && typeof nodeId === 'string') {
    const node = index.nodes.get(nodeId);
    if (typeof node?.node_kind === 'string' && node.node_kind.length > 0) {
      return node.node_kind;
    }
  }
  return null;
}

function claimsOnNode(analysis, nodeId) {
  if (!analysis || typeof nodeId !== 'string') return 0;
  return analysis.claimCountByNode.get(nodeId) ?? 0;
}

function overlapBytes(leftStart, leftEnd, rightStart, rightEnd) {
  const start = Math.max(leftStart, rightStart);
  const end = Math.min(leftEnd, rightEnd);
  return end > start ? end - start : 0;
}

function nearestM4Fields(analysis, span) {
  const empty = {
    nearest_m4_claim_id: null,
    nearest_m4_claim_definition_key: 'NONE',
    nearest_m4_overlap_bytes: 0,
  };
  if (!analysis || !span) return empty;
  if (!Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)) return empty;
  let best = null;
  for (const claim of analysis.claimEdgeSpans ?? []) {
    for (const edge of claim.spans) {
      const overlap = overlapBytes(span.start_byte, span.end_byte, edge.start_byte, edge.end_byte);
      if (overlap <= 0) continue;
      const candidate = {
        nearest_m4_claim_id: claim.analysis_claim_id,
        nearest_m4_claim_definition_key: claim.claim_definition_key,
        nearest_m4_overlap_bytes: overlap,
      };
      if (
        !best
        || candidate.nearest_m4_overlap_bytes > best.nearest_m4_overlap_bytes
        || (
          candidate.nearest_m4_overlap_bytes === best.nearest_m4_overlap_bytes
          && String(candidate.nearest_m4_claim_id).localeCompare(String(best.nearest_m4_claim_id)) < 0
        )
      ) {
        best = candidate;
      }
    }
  }
  return best ?? empty;
}

function parentFields(index, nodeId) {
  if (!index || typeof nodeId !== 'string' || nodeId.length === 0) {
    return { parent_node_occurrence_id: null, parent_node_kind: 'NONE' };
  }
  const node = index.nodes.get(nodeId);
  const parentId = typeof node?.parent_node_occurrence_id === 'string'
    && node.parent_node_occurrence_id.length > 0
    ? node.parent_node_occurrence_id
    : null;
  if (!parentId) {
    return { parent_node_occurrence_id: null, parent_node_kind: 'NONE' };
  }
  const parent = index.nodes.get(parentId);
  return {
    parent_node_occurrence_id: parentId,
    parent_node_kind: typeof parent?.node_kind === 'string' && parent.node_kind.length > 0
      ? parent.node_kind
      : 'NONE',
  };
}

function graphFields(analysis, index, nodeId, span) {
  return {
    ...nearestM4Fields(analysis, span),
    ...parentFields(index, nodeId),
  };
}

function nearestClaimOnRegistryNode(analysis, claimId, registryNodeId) {
  if (!analysis || typeof claimId !== 'string') return false;
  const claim = analysis.claimById.get(claimId);
  if (!claim || typeof registryNodeId !== 'string') return false;
  return (claim.source_node_occurrence_ids ?? []).includes(registryNodeId);
}

function renderMarkdown(summary) {
  const lines = [
    '# Q-0010 profile anchors',
    '',
    `Rows: **${summary.row_count}**. Verified: **${summary.verified_count}**. Unresolved: **${summary.unresolved_count}**. SHA mismatch: **${summary.sha_mismatch_count}**.`,
    '',
    `Accepted pre-revision table SHA-256: \`${summary.pre_revision_table_sha256}\` (${summary.pre_revision_table_bytes.toLocaleString('en-US')} bytes).`,
    '',
    'Verified means the SHA-256 of the canonical UTF-8 bytes at the span equals `text_sha256`. Unresolved means no registry match or no usable span. Parent and nearest-M4 fields do not change verification.',
    '',
    '## Unresolved profiles',
    '',
  ];
  if (summary.unresolved.length === 0) {
    lines.push('None.');
  } else {
    for (const item of summary.unresolved) {
      lines.push(`- \`${item.profile_key}\` (${item.family_key}): ${item.why}. Signature \`${item.signature}\`.`);
    }
  }
  lines.push('', '## Per family', '');
  lines.push('| Family | Profiles | Verified | Unresolved | SHA mismatch | Registry spans | M4 edges |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const family of summary.per_family) {
    lines.push(
      `| ${family.family_key} | ${family.profile_count} | ${family.verified} | ${family.unresolved} | ${family.sha_mismatch} | ${family.span_source.REGISTRY} | ${family.span_source.M4_EVIDENCE_EDGE} |`,
    );
  }
  lines.push('', '## node_kind', '');
  for (const [kind, count] of Object.entries(summary.node_kind_histogram)) {
    lines.push(`- ${kind}: ${count}`);
  }
  lines.push('', '## claims_on_node', '');
  for (const [count, rows] of Object.entries(summary.claims_on_node_histogram)) {
    lines.push(`- ${count}: ${rows}`);
  }
  const zero = summary.zero_claim_verified;
  lines.push('', '## Verified rows with claims_on_node = 0', '');
  lines.push(
    `Verified zero-claim rows: **${zero.count}**. Nearest M4 claim NONE: **${zero.nearest_none}**. Overlapping M4 claim: **${zero.overlapping}**. Of those overlapping, identity mismatch (nearest claim \`source_node_occurrence_id\` ≠ registry node): **${zero.identity_mismatch}**.`,
  );
  lines.push('', '| Family | Zero-claim verified | NONE | Overlapping | Identity mismatch |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const family of zero.by_family) {
    lines.push(
      `| ${family.family_key} | ${family.total} | ${family.nearest_none} | ${family.overlapping} | ${family.identity_mismatch} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const missingPaths = [];
  for (const required of [PROFILE_SET_PATH, ANALYSIS_SET_PATH, INDEX_SET_PATH]) {
    if (!existsSync(required)) missingPaths.push(required.slice(repoRoot.length + 1));
  }
  if (missingPaths.length > 0) {
    const failed = {
      error: 'required_control_file_missing',
      missing_paths: missingPaths,
    };
    writeFileSync(resolve(OUT_DIR, '10-profile-anchor-table.out'), `${JSON.stringify(failed, null, 2)}\n`);
    process.stderr.write(`${JSON.stringify(failed, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const profileSet = loadJson(PROFILE_SET_PATH);
  const profiles = Array.isArray(profileSet.profiles) ? [...profileSet.profiles] : [];
  profiles.sort((left, right) => String(left.profile_id ?? '').localeCompare(String(right.profile_id ?? '')));

  const analysisSet = loadJson(ANALYSIS_SET_PATH);
  const indexSet = loadJson(INDEX_SET_PATH);
  const indexes = loadIndexCache(indexSet, missingPaths);
  const analyses = loadAnalysisCache(analysisSet, missingPaths);

  const discovered = discoverAuthorityFiles(CONTROL_DIR);
  const authorities = new Map();
  for (const [slug, name] of discovered.chosen) {
    const rel = `evidence/canonical-v2/stage-2y-structure-migration/control/${name}`;
    const abs = resolve(CONTROL_DIR, name);
    if (!existsSync(abs)) {
      missingPaths.push(rel);
      continue;
    }
    const record = loadJson(abs);
    const registry = record?.source_terminal_successor_contract?.terminal_rule_registry;
    const bySignature = new Map();
    if (Array.isArray(registry)) {
      for (const entry of registry) {
        const signature = entry?.required_expression_signature;
        if (typeof signature !== 'string') continue;
        const list = bySignature.get(signature) ?? [];
        list.push(entry);
        bySignature.set(signature, list);
      }
    }
    authorities.set(slug, { rel, bySignature, registry_count: Array.isArray(registry) ? registry.length : 0 });
  }

  const rows = [];
  const unresolved = [];
  const familyStats = new Map();
  const nodeKindHist = new Map();
  const claimsHist = new Map();
  let verifiedCount = 0;
  let unresolvedCount = 0;
  let shaMismatchCount = 0;

  function familyBucket(familyKey) {
    if (!familyStats.has(familyKey)) {
      familyStats.set(familyKey, {
        family_key: familyKey,
        profile_count: 0,
        verified: 0,
        unresolved: 0,
        sha_mismatch: 0,
        span_source: { REGISTRY: 0, M4_EVIDENCE_EDGE: 0, UNRESOLVED: 0 },
      });
    }
    return familyStats.get(familyKey);
  }

  for (const profile of profiles) {
    const familyKey = profile.family_key ?? null;
    const slug = familyKey ? familySlug(familyKey) : null;
    const stats = familyBucket(familyKey ?? '<missing>');
    stats.profile_count += 1;

    const signature = profile.required_expression_signature;
    if (typeof signature !== 'string' || signature.length === 0) {
      const row = emptyAnchor(profile, { span_source: 'UNRESOLVED' });
      rows.push(row);
      unresolvedCount += 1;
      stats.unresolved += 1;
      stats.span_source.UNRESOLVED += 1;
      bump(nodeKindHist, '(null)');
      bump(claimsHist, '0');
      unresolved.push({
        profile_id: profile.profile_id ?? null,
        profile_key: profile.profile_key ?? null,
        family_key: familyKey,
        signature: null,
        why: 'MISSING_REQUIRED_EXPRESSION_SIGNATURE',
      });
      continue;
    }

    const authority = slug ? authorities.get(slug) : null;
    if (!authority) {
      const row = emptyAnchor(profile, { span_source: 'UNRESOLVED' });
      rows.push(row);
      unresolvedCount += 1;
      stats.unresolved += 1;
      stats.span_source.UNRESOLVED += 1;
      bump(nodeKindHist, '(null)');
      bump(claimsHist, '0');
      unresolved.push({
        profile_id: profile.profile_id ?? null,
        profile_key: profile.profile_key ?? null,
        family_key: familyKey,
        signature,
        why: 'MISSING_PHASE2_AUTHORITY_FILE',
      });
      continue;
    }

    const matches = authority.bySignature.get(signature) ?? [];
    if (matches.length === 0) {
      const row = emptyAnchor(profile, { span_source: 'UNRESOLVED' });
      rows.push(row);
      unresolvedCount += 1;
      stats.unresolved += 1;
      stats.span_source.UNRESOLVED += 1;
      bump(nodeKindHist, '(null)');
      bump(claimsHist, '0');
      unresolved.push({
        profile_id: profile.profile_id ?? null,
        profile_key: profile.profile_key ?? null,
        family_key: familyKey,
        signature,
        why: 'NO_REGISTRY_ENTRY_FOR_SIGNATURE',
      });
      continue;
    }

    const entry = matches[0];
    const agreementId = typeof entry.agreement_id === 'string' ? entry.agreement_id : null;
    const claimIds = Array.isArray(entry.m4_claim_ids) ? [...entry.m4_claim_ids] : [];
    const member = pickMember(entry.source_closure?.members);
    const registryNodeId = memberNodeId(member);
    const registrySpan = completeSpan(member?.source_span);
    const index = agreementId ? indexes.get(agreementId) ?? null : null;
    const analysis = agreementId ? analyses.get(agreementId) ?? null : null;

    if (agreementId && !index) {
      missingPaths.push(`m2 index for agreement ${agreementId}`);
    }
    if (agreementId && !analysis) {
      missingPaths.push(`m4 analysis for agreement ${agreementId}`);
    }

    let spanSource = null;
    let span = null;
    let nodeId = registryNodeId;
    let why = null;

    if (registrySpan) {
      spanSource = 'REGISTRY';
      span = registrySpan;
      nodeId = registryNodeId;
    } else {
      if (!analysis) {
        why = agreementId ? 'WORK3_ANALYSIS_NOT_FOUND' : 'REGISTRY_ENTRY_MISSING_AGREEMENT_ID';
      } else {
        const picked = pickEvidenceEdge(analysis, claimIds, registryNodeId);
        if (picked.edge && completeSpan(picked.edge.source_span)) {
          spanSource = 'M4_EVIDENCE_EDGE';
          span = completeSpan(picked.edge.source_span);
          nodeId = typeof picked.edge.source_node_occurrence_id === 'string'
            ? picked.edge.source_node_occurrence_id
            : registryNodeId;
        } else {
          why = picked.why ?? 'NO_COMPLETE_M4_EVIDENCE_SPAN';
        }
      }
    }

    if (!spanSource || !span) {
      const row = emptyAnchor(profile, {
        agreement_id: agreementId,
        m4_claim_ids: claimIds,
        source_node_occurrence_id: nodeId,
        span_source: 'UNRESOLVED',
        node_kind: nodeKindOf(member, index, nodeId),
        claims_on_node: claimsOnNode(analysis, nodeId),
        ...graphFields(analysis, index, nodeId, null),
      });
      rows.push(row);
      unresolvedCount += 1;
      stats.unresolved += 1;
      stats.span_source.UNRESOLVED += 1;
      bump(nodeKindHist, row.node_kind ?? '(null)');
      bump(claimsHist, String(row.claims_on_node));
      unresolved.push({
        profile_id: profile.profile_id ?? null,
        profile_key: profile.profile_key ?? null,
        family_key: familyKey,
        signature,
        why: why ?? 'SPAN_UNRESOLVED',
      });
      continue;
    }

    const verified = verifySpan(index?.canonical_text ?? null, span);
    if (verified) verifiedCount += 1;
    else if (typeof index?.canonical_text === 'string') shaMismatchCount += 1;
    const kind = spanSource === 'REGISTRY'
      ? nodeKindOf(member, index, nodeId)
      : nodeKindOf(null, index, nodeId) ?? nodeKindOf(member, index, nodeId);
    const claimCount = claimsOnNode(analysis, nodeId);
    const row = rowObject({
      profile_id: profile.profile_id ?? null,
      profile_key: profile.profile_key ?? null,
      family_key: familyKey,
      classification_path: Array.isArray(profile.classification_path)
        ? [...profile.classification_path]
        : [],
      signature,
      agreement_id: agreementId,
      m4_claim_ids: claimIds,
      source_node_occurrence_id: nodeId,
      span_source: spanSource,
      start_byte: span.start_byte,
      end_byte: span.end_byte,
      text_sha256: span.text_sha256,
      verified,
      node_kind: kind,
      claims_on_node: claimCount,
      ...graphFields(analysis, index, nodeId, span),
    });
    rows.push(row);
    stats.span_source[spanSource] += 1;
    if (verified) stats.verified += 1;
    else if (typeof index?.canonical_text === 'string') stats.sha_mismatch += 1;
    bump(nodeKindHist, kind ?? '(null)');
    bump(claimsHist, String(claimCount));
  }

  const uniqueMissing = [...new Set(missingPaths)].sort();
  const zeroClaimByFamily = new Map();
  function zeroClaimBucket(familyKey) {
    const key = familyKey ?? '<missing>';
    if (!zeroClaimByFamily.has(key)) {
      zeroClaimByFamily.set(key, {
        family_key: key,
        total: 0,
        nearest_none: 0,
        overlapping: 0,
        identity_mismatch: 0,
      });
    }
    return zeroClaimByFamily.get(key);
  }
  let zeroClaimVerified = 0;
  let zeroClaimNearestNone = 0;
  let zeroClaimOverlapping = 0;
  let zeroClaimIdentityMismatch = 0;
  for (const row of rows) {
    if (row.verified !== true || row.claims_on_node !== 0) continue;
    zeroClaimVerified += 1;
    const bucket = zeroClaimBucket(row.family_key);
    bucket.total += 1;
    const hasOverlap = typeof row.nearest_m4_claim_id === 'string'
      && row.nearest_m4_claim_id.length > 0
      && row.nearest_m4_overlap_bytes > 0;
    if (!hasOverlap) {
      zeroClaimNearestNone += 1;
      bucket.nearest_none += 1;
      continue;
    }
    zeroClaimOverlapping += 1;
    bucket.overlapping += 1;
    const analysis = row.agreement_id ? analyses.get(row.agreement_id) ?? null : null;
    const onRegistryNode = nearestClaimOnRegistryNode(
      analysis,
      row.nearest_m4_claim_id,
      row.source_node_occurrence_id,
    );
    if (!onRegistryNode) {
      zeroClaimIdentityMismatch += 1;
      bucket.identity_mismatch += 1;
    }
  }

  const summary = {
    row_count: rows.length,
    verified_count: verifiedCount,
    unresolved_count: unresolvedCount,
    sha_mismatch_count: shaMismatchCount,
    pre_revision_table_sha256: PRE_REVISION_TABLE_SHA256,
    pre_revision_table_bytes: PRE_REVISION_TABLE_BYTES,
    zero_claim_verified: {
      count: zeroClaimVerified,
      nearest_none: zeroClaimNearestNone,
      overlapping: zeroClaimOverlapping,
      identity_mismatch: zeroClaimIdentityMismatch,
      by_family: [...zeroClaimByFamily.values()]
        .sort((left, right) => left.family_key.localeCompare(right.family_key)),
    },
    per_family: [...familyStats.values()].sort((left, right) => left.family_key.localeCompare(right.family_key)),
    unresolved: unresolved.sort((left, right) => String(left.profile_id).localeCompare(String(right.profile_id))),
    node_kind_histogram: histogramObject(nodeKindHist, (left, right) => left.localeCompare(right)),
    claims_on_node_histogram: histogramObject(claimsHist, (left, right) => Number(left) - Number(right)),
    authority_files: Object.fromEntries(
      [...discovered.chosen.entries()].sort((left, right) => left[0].localeCompare(right[0])),
    ),
    skipped_authority_files: discovered.skipped,
    missing_paths: uniqueMissing,
  };

  const tablePath = resolve(OUT_DIR, '10-profile-anchor-table.json');
  const outPath = resolve(OUT_DIR, '10-profile-anchor-table.out');
  const mdPath = resolve(OUT_DIR, '10-PROFILE-ANCHORS.md');
  writeFileSync(tablePath, `${JSON.stringify(rows, null, 2)}\n`);
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(summary));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
