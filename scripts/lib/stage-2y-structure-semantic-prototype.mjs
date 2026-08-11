import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  matchedClaimRow,
  renderSignature,
} from '../stage-2y-cd-measurement.mjs';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../../lib/canonical-v2/canonical-bytes');
const renderedRowPreview = require('../../lib/review-parity/rendered-row-preview.js');

const INPUT_SCHEMA = 'STAGE_2Y_STRUCTURE_PROTOTYPE_INPUTS/V1';
const CONTROL_SCHEMA = 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1';
const MAPPING_SCHEMA = 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1';
const DIFF_SCHEMA = 'STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF/V1';
const DECISION_CASE_IDS = Object.freeze([
  'CONCHO_6_9_A',
  'TOPBUILD_6_2',
  'REDHAT_3_01_3_02',
  'METSERA_7_04',
  'CONCHO_4_10_ANNEX_A',
]);
const RUN_FILES = Object.freeze([
  'run-manifest.json',
  'run-receipt.json',
  'resolution.json',
  'adapter-result.json',
  'validation.json',
  'section-location-scan.json',
]);

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_SEMANTIC_PROTOTYPE: ${message}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function repoPath(repoRoot, path) {
  const absolute = resolve(repoRoot, path);
  const local = relative(repoRoot, absolute);
  if (!local || local.startsWith('..') || isAbsolute(local)) fail(`path outside repository: ${path}`);
  return { absolute, local: local.split('\\').join('/') };
}

function bindingIndex(control) {
  const bindings = [
    ...(control.frozen_run_file_bindings || []),
    ...(control.supplemental_prototype_file_bindings || []),
    control.current_measurement_binding,
    control.current_projection_binding,
    control.current_baseline_binding,
    control.known_loss_adjustment_binding,
    control.baseline_manifest,
  ];
  return new Map(bindings.filter(Boolean).map((binding) => [binding.path, binding]));
}

function readBoundJson(repoRoot, path, bindings) {
  const safe = repoPath(repoRoot, path);
  const expected = bindings.get(safe.local);
  if (!expected) fail(`file is not sealed by M0 control: ${safe.local}`);
  const bytes = readFileSync(safe.absolute);
  if (bytes.length !== expected.byte_length || sha256Hex(bytes) !== expected.sha256) {
    fail(`sealed input drift: ${safe.local}`);
  }
  return { binding: clone(expected), value: JSON.parse(bytes.toString('utf8')) };
}

function assertAuthority(control, inputs) {
  if (control?.schema_version !== CONTROL_SCHEMA) fail('control schema drift');
  if (inputs?.schema_version !== INPUT_SCHEMA || inputs.rediscovery_permitted !== false) {
    fail('prototype input contract drift');
  }
  const authority = control.authority || {};
  for (const key of [
    'pin_changes', 'baseline_changes', 'saved_control_mutations',
    'release_receipts_created', 'current_selector_changes', 'model_calls',
    'phase_b_route_calls', 'product_writes', 'serving_changes',
  ]) {
    if (authority[key] !== 0) fail(`authority ${key} must remain zero`);
  }
  if (authority.database_target !== 'NONE'
    || authority.publication_authorisation !== 'NONE'
    || authority.internal_cutover_authorisation !== 'NONE'
    || authority.phase_b_status !== 'DEFERRED_LOCKED') {
    fail('M0 authority locks drifted');
  }
  const decisionIds = (inputs.cases || [])
    .filter((entry) => entry.set === 'DECISION')
    .map((entry) => entry.case_id);
  if (JSON.stringify(decisionIds) !== JSON.stringify(DECISION_CASE_IDS)) {
    fail('the five decision cases changed');
  }
}

function sourceCaseFor(sourcePrototype, input) {
  const cases = sourcePrototype?.runtime_cases;
  if (!Array.isArray(cases)) fail('sourcePrototype.runtime_cases is required');
  const matches = cases.filter((entry) => entry.case_id === input.case_id);
  if (matches.length !== 1) fail(`source case is not unique: ${input.case_id}`);
  const sourceCase = matches[0];
  const bytes = Buffer.from(sourceCase.canonical_text || '', 'utf8');
  if (bytes.length !== input.canonical_text_byte_length
    || sha256Hex(bytes) !== input.canonical_text_sha256) {
    fail(`source bytes drift: ${input.case_id}`);
  }
  if (!Array.isArray(sourceCase.nodes) || sourceCase.nodes.length === 0) {
    fail(`source nodes missing: ${input.case_id}`);
  }
  return sourceCase;
}

function sourceSpan(node) {
  const span = node?.extent_span || {};
  const start = span.start_byte ?? span.start;
  const end = span.end_byte ?? span.end;
  return Number.isInteger(start) && Number.isInteger(end) ? { start, end } : null;
}

function nodeLinks(nodes, documentSpan) {
  if (!documentSpan) return {
    deepest_node_occurrence_id: null,
    containing_node_occurrence_ids: [],
    overlapping_node_occurrence_ids: [],
  };
  const measured = nodes
    .map((node) => ({ node, span: sourceSpan(node) }))
    .filter((entry) => entry.span);
  const byId = new Map(nodes.map((node) => [node.node_occurrence_id, node]));
  const depthMemo = new Map();
  const depth = (node) => {
    if (depthMemo.has(node.node_occurrence_id)) return depthMemo.get(node.node_occurrence_id);
    let value = 0;
    let cursor = node;
    const visited = new Set();
    while (cursor?.parent_node_occurrence_id) {
      if (visited.has(cursor.node_occurrence_id)) fail('source node cycle during evidence linkage');
      visited.add(cursor.node_occurrence_id);
      cursor = byId.get(cursor.parent_node_occurrence_id);
      value += 1;
    }
    depthMemo.set(node.node_occurrence_id, value);
    return value;
  };
  const containing = measured
    .filter(({ span }) => span.start <= documentSpan.start && span.end >= documentSpan.end)
    .sort((left, right) => depth(right.node) - depth(left.node)
      || (left.span.end - left.span.start) - (right.span.end - right.span.start)
      || left.span.start - right.span.start
      || left.span.end - right.span.end
      || left.node.node_occurrence_id.localeCompare(right.node.node_occurrence_id));
  const overlapping = measured
    .filter(({ span }) => span.start < documentSpan.end && span.end > documentSpan.start)
    .map(({ node }) => node.node_occurrence_id);
  return {
    deepest_node_occurrence_id: containing[0]?.node?.node_occurrence_id || null,
    containing_node_occurrence_ids: containing.map(({ node }) => node.node_occurrence_id),
    overlapping_node_occurrence_ids: overlapping,
  };
}

function scanStarts(scan) {
  return new Map((scan?.resolved || []).map((row) => [row.section_reference, row.start]));
}

function sectionBase(reference, starts) {
  let candidate = reference;
  while (candidate) {
    if (starts.has(candidate)) return starts.get(candidate);
    const shorter = candidate.replace(/\([^()]+\)$/, '');
    if (shorter === candidate) break;
    candidate = shorter;
  }
  return null;
}

function evidenceSnapshot({ stage, row, claim, starts, nodes }) {
  const reference = row?.source_citation
    || row?.citation_validation?.derived_citation
    || row?.section_reference
    || claim?.attributes?.section_reference
    || null;
  const base = stage === 'RESOLUTION'
    ? row?.provision_instance?.absolute_start
    : stage === 'WRITE_SET' || stage === 'VALIDATION'
      ? 0
      : sectionBase(row?.section_reference || claim?.attributes?.section_reference, starts);
  return (claim?.evidence || row?.evidence || []).map((evidence) => {
    const start = evidence.absolute_start;
    const end = evidence.absolute_end;
    const documentSpan = Number.isInteger(start) && Number.isInteger(end)
      && Number.isInteger(base)
      ? { start: start + base, end: end + base }
      : null;
    return {
      original_evidence: clone(evidence),
      claim_evidence_id: evidence.claim_evidence_id || null,
      excerpt_id: evidence.excerpt_id || null,
      evidence_role: evidence.evidence_role || null,
      source_reference: reference,
      stage_coordinate_system: stage === 'WRITE_SET' || stage === 'VALIDATION'
        ? 'DOCUMENT_ABSOLUTE_UTF8_HALF_OPEN'
        : stage === 'RESOLUTION'
          ? 'PROVISION_RELATIVE_UTF8_HALF_OPEN'
          : 'SECTION_RELATIVE_UTF8_HALF_OPEN',
      stage_span: { start, end },
      document_span: documentSpan,
      source_nodes: nodeLinks(nodes, documentSpan),
    };
  });
}

function candidateClaim(row) {
  return row?.candidate?.claim || null;
}

function sectionMatches(reference, input) {
  if (!reference) return false;
  return input.sections.some((target) => reference === target || reference.startsWith(`${target}(`));
}

function overlapsSelected(evidence, input) {
  return evidence.some((entry) => entry.document_span
    && input.spans.some((span) => entry.document_span.start < span.end
      && entry.document_span.end > span.start));
}

function snapshot(stage, row, claim, starts, nodes) {
  return {
    stage,
    claim_revision_id: claim?.claim_revision_id || row?.claim_revision_id || null,
    claim_occurrence_id: claim?.claim_occurrence_id || row?.original_claim_occurrence_id || null,
    subject_occurrence_id: claim?.subject_occurrence_id || null,
    closure_id: claim?.closure_id || row?.closure_id || null,
    evidence_ids: clone(claim?.evidence_ids || []),
    publication_state: claim?.publication_state || null,
    section_reference: row?.section_reference || claim?.attributes?.section_reference || null,
    source_citation: row?.source_citation || row?.citation_validation?.derived_citation || null,
    state: claim?.state || null,
    raw_value: claim?.raw_value ?? row?.raw_value ?? null,
    canonical_value: claim?.canonical_value ?? row?.canonical_value ?? null,
    claim_definition_key: claim?.claim_definition_key || row?.claim_definition_key || null,
    resolved_claim_definition_key: row?.resolved_claim_definition_key || null,
    has_resolution: typeof row?.has_resolution === 'boolean' ? row.has_resolution : null,
    attributes: clone(claim?.attributes || row?.attributes || {}),
    party: clone(row?.party ?? null),
    party_source_span: clone(row?.party_source_span ?? null),
    provision_instance: clone(row?.provision_instance ?? null),
    extraction_provenance: clone(row?.candidate?.extraction_provenance ?? row?.extraction_provenance ?? null),
    governing_context_quote: row?.governing_context_quote ?? null,
    structure_context: clone(row?.structure_context ?? null),
    evidence: evidenceSnapshot({ stage, row, claim, starts, nodes }),
  };
}

function renderCurrent(manifest, resolution, resolvedEntry) {
  try {
    const rendered = renderedRowPreview.previewClaimSection({
      run: { manifest, resolution },
      resolved_entry: resolvedEntry,
    });
    const signature = renderSignature(rendered);
    return {
      status: 'ROW_EMITTED',
      full_output_signature: signature.digest,
      section: signature.payload.section,
      row_selection: signature.payload.row_selection,
      matching_row: matchedClaimRow(signature.payload),
      full_output: signature.payload,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      error_code: error?.code || String(error?.message || 'UNKNOWN').split(':')[0],
      message: error?.message || String(error),
    };
  }
}

function recordKey(occurrenceId, closureId, payload) {
  if (occurrenceId) return `occurrence:${occurrenceId}`;
  if (closureId) return `closure:${closureId}`;
  return `residual:${contentId('STAGE_2Y_STRUCTURE_SEMANTIC_RESIDUAL/V1', payload)}`;
}

function assertUniqueStageIdentity(seenByStage, stage, value, runDirectory) {
  const tokens = [];
  if (value?.claim_occurrence_id) {
    tokens.push(`occurrence:${value.claim_occurrence_id}`);
  } else if (value?.closure_id) {
    tokens.push(`closure:${value.closure_id}`);
  }
  if (value?.claim_revision_id) tokens.push(`revision:${value.claim_revision_id}`);
  if (tokens.length === 0) return;
  if (!seenByStage.has(stage)) seenByStage.set(stage, new Set());
  const seen = seenByStage.get(stage);
  for (const token of tokens) {
    if (seen.has(token)) {
      fail(`duplicate ${stage} stable identity in ${runDirectory}: ${token}`);
    }
  }
  for (const token of tokens) seen.add(token);
}

function selectedSnapshot(stage, row, claim, starts, nodes, input) {
  const value = snapshot(stage, row, claim, starts, nodes);
  const reference = value.source_citation || value.section_reference;
  return sectionMatches(reference, input) || overlapsSelected(value.evidence, input)
    ? value
    : null;
}

function currentSnapshot(record) {
  if (record.resolution) return record.resolution;
  const unresolvedReview = (record.reviews || []).find((row) => row.has_resolution === false);
  if (unresolvedReview) return unresolvedReview;
  if (record.open_world) return record.open_world;
  return record.proposal || null;
}

function comparableRecord(linkageKey, state, value) {
  return {
    linkage_key: linkageKey,
    current_state: state,
    claim_occurrence_id: value?.claim_occurrence_id
      || (linkageKey.startsWith('occurrence:') ? linkageKey.slice('occurrence:'.length) : null),
    claim_revision_id: value?.claim_revision_id || null,
    closure_id: value?.closure_id || null,
    claim_definition_key: value?.resolved_claim_definition_key
      || value?.claim_definition_key
      || null,
    raw_value: value?.raw_value ?? null,
    canonical_value: value?.canonical_value ?? null,
  };
}

function buildExpectedCurrentRecords({ input, receipt, resolution, starts, nodes }) {
  const expected = new Map();
  const proposalKeysByClosure = new Map();
  const resolvedKeysByRevision = new Map();
  const put = (key, state, value, priority) => {
    const previous = expected.get(key);
    if (!previous || priority >= previous.priority) {
      expected.set(key, { ...comparableRecord(key, state, value), priority });
    }
  };

  for (const row of receipt.value.compiled_candidates || []) {
    const claim = candidateClaim(row);
    if (!claim) continue;
    const value = selectedSnapshot('PROPOSAL', row, claim, starts, nodes, input);
    if (!value) continue;
    const key = recordKey(claim.claim_occurrence_id, claim.closure_id, row);
    put(key, 'ATTEMPTED', value, 0);
    if (claim.closure_id) proposalKeysByClosure.set(claim.closure_id, key);
  }
  for (const row of resolution.value.resolved || []) {
    const value = selectedSnapshot('RESOLUTION', row, row.claim, starts, nodes, input);
    if (!value) continue;
    const key = recordKey(row.claim?.claim_occurrence_id, row.claim?.closure_id, row);
    put(key, 'RESOLVED', value, 3);
    if (row.claim?.claim_revision_id) resolvedKeysByRevision.set(row.claim.claim_revision_id, key);
  }
  for (const row of resolution.value.open_world || []) {
    const value = selectedSnapshot('OPEN_WORLD', row, null, starts, nodes, input);
    if (!value) continue;
    const key = proposalKeysByClosure.get(row.closure_id)
      || recordKey(null, row.closure_id, row);
    put(key, 'OPEN_WORLD', value, 1);
  }
  for (const row of resolution.value.review_queue || []) {
    const value = selectedSnapshot('REVIEW', row, null, starts, nodes, input);
    if (!value) continue;
    const key = (row.has_resolution === true && row.claim_revision_id
      ? resolvedKeysByRevision.get(row.claim_revision_id)
      : null)
      || (row.original_claim_occurrence_id
        ? recordKey(row.original_claim_occurrence_id, row.closure_id, row)
        : proposalKeysByClosure.get(row.closure_id))
      || recordKey(null, row.closure_id, row);
    put(key, row.has_resolution === true ? 'RESOLVED' : 'REVIEW', value,
      row.has_resolution === true ? 2 : 2);
  }
  return new Map([...expected.entries()].map(([key, value]) => {
    const { priority, ...record } = value;
    return [key, record];
  }));
}

function recordCoverage(expectedRecords, mappedRecords) {
  const mapped = new Map(mappedRecords
    .filter((record) => !record.adapter_residual)
    .map((record) => [record.linkage_key,
      comparableRecord(record.linkage_key, record.current_state, currentSnapshot(record))]));
  const missing = [...expectedRecords.keys()].filter((key) => !mapped.has(key));
  const unexpected = [...mapped.keys()].filter((key) => !expectedRecords.has(key));
  const identityMismatches = [];
  const stateMismatches = [];
  const valueMismatches = [];
  for (const [key, expected] of expectedRecords) {
    const actual = mapped.get(key);
    if (!actual) continue;
    if (canonicalJson({
      claim_occurrence_id: actual.claim_occurrence_id,
      claim_revision_id: actual.claim_revision_id,
      closure_id: actual.closure_id,
      claim_definition_key: actual.claim_definition_key,
    }) !== canonicalJson({
      claim_occurrence_id: expected.claim_occurrence_id,
      claim_revision_id: expected.claim_revision_id,
      closure_id: expected.closure_id,
      claim_definition_key: expected.claim_definition_key,
    })) {
      identityMismatches.push({
        linkage_key: key,
        expected_claim_occurrence_id: expected.claim_occurrence_id,
        mapped_claim_occurrence_id: actual.claim_occurrence_id,
        expected_claim_revision_id: expected.claim_revision_id,
        mapped_claim_revision_id: actual.claim_revision_id,
        expected_closure_id: expected.closure_id,
        mapped_closure_id: actual.closure_id,
        expected_claim_definition_key: expected.claim_definition_key,
        mapped_claim_definition_key: actual.claim_definition_key,
      });
    }
    if (actual.current_state !== expected.current_state) {
      stateMismatches.push({
        linkage_key: key,
        expected_state: expected.current_state,
        mapped_state: actual.current_state,
      });
    }
    if (canonicalJson({ raw_value: actual.raw_value, canonical_value: actual.canonical_value })
      !== canonicalJson({ raw_value: expected.raw_value, canonical_value: expected.canonical_value })) {
      valueMismatches.push({
        linkage_key: key,
        expected_raw_value: expected.raw_value,
        mapped_raw_value: actual.raw_value,
        expected_canonical_value: expected.canonical_value,
        mapped_canonical_value: actual.canonical_value,
      });
    }
  }
  const expectedValues = [...expectedRecords.values()]
    .sort((left, right) => left.linkage_key.localeCompare(right.linkage_key));
  const mappedValues = [...mapped.values()]
    .sort((left, right) => left.linkage_key.localeCompare(right.linkage_key));
  return {
    expected_record_count: expectedValues.length,
    mapped_record_count: mappedValues.length,
    missing_record_count: missing.length,
    unexpected_record_count: unexpected.length,
    identity_mismatch_count: identityMismatches.length,
    state_mismatch_count: stateMismatches.length,
    value_mismatch_count: valueMismatches.length,
    missing_linkage_keys: missing.sort(),
    unexpected_linkage_keys: unexpected.sort(),
    identity_mismatches: identityMismatches,
    state_mismatches: stateMismatches,
    value_mismatches: valueMismatches,
    expected_records: expectedValues,
    mapped_records: mappedValues,
    expected_records_digest: contentId('STAGE_2Y_EXPECTED_CURRENT_RECORD_SET/V1', expectedValues),
    mapped_records_digest: contentId('STAGE_2Y_MAPPED_CURRENT_RECORD_SET/V1', mappedValues),
  };
}

function evidenceCoverage(mappedRecords) {
  const spans = new Map();
  for (const record of mappedRecords) {
    if (record.adapter_residual) continue;
    for (const stage of [record.proposal, record.resolution, record.open_world,
      ...(record.reviews || []), record.write_set, record.validation]) {
      for (const evidence of stage?.evidence || []) {
        const identity = {
          linkage_key: record.linkage_key,
          evidence_role: evidence.evidence_role,
          document_span: evidence.document_span,
          source_reference: evidence.source_reference,
        };
        const key = canonicalJson(identity);
        if (!spans.has(key)) spans.set(key, { ...identity, stage: stage.stage });
      }
    }
  }
  const values = [...spans.values()].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const withoutLinks = values.filter((entry) => {
    const record = mappedRecords.find((candidate) => candidate.linkage_key === entry.linkage_key);
    const stages = [record?.proposal, record?.resolution, record?.open_world,
      ...(record?.reviews || []), record?.write_set, record?.validation];
    return !stages.some((stage) => (stage?.evidence || []).some((evidence) =>
      canonicalJson({
        linkage_key: record.linkage_key,
        evidence_role: evidence.evidence_role,
        document_span: evidence.document_span,
        source_reference: evidence.source_reference,
      }) === canonicalJson({
        linkage_key: entry.linkage_key,
        evidence_role: entry.evidence_role,
        document_span: entry.document_span,
        source_reference: entry.source_reference,
      }) && evidence.source_nodes?.containing_node_occurrence_ids?.length > 0));
  });
  return {
    evidence_span_count: values.length,
    evidence_spans_without_source_node_links: withoutLinks.length,
    evidence_spans: values,
    unlinked_evidence_spans: withoutLinks,
    evidence_span_set_digest: contentId('STAGE_2Y_MAPPED_EVIDENCE_SPAN_SET/V1', values),
  };
}

function recordEvidence(record) {
  return [
    record.proposal,
    record.resolution,
    record.open_world,
    ...(record.reviews || []),
    record.write_set,
    record.validation,
  ].filter(Boolean).flatMap((stage) => (stage.evidence || []).map((evidence) => ({
    stage: stage.stage,
    evidence,
  })));
}

function claimSourceMapping(record, nodes, aliases) {
  const byId = new Map(nodes.map((node) => [node.node_occurrence_id, node]));
  const currentEndpoints = new Set();
  const shadowEndpoints = new Set();
  const validAliases = aliases.map((alias) => {
    const target = byId.get(alias.shadow_node_occurrence_id);
    const currentEndpoint = `${alias.case_id}\0${alias.current_node_id}`;
    const shadowEndpoint = `${alias.case_id}\0${alias.shadow_node_occurrence_id}`;
    if (!target
      || alias.cardinality !== 'ONE_TO_ONE'
      || target.structure_revision_id !== alias.shadow_structure_revision_id
      || !(target.current_section_ids || []).includes(alias.current_node_id)
      || currentEndpoints.has(currentEndpoint)
      || shadowEndpoints.has(shadowEndpoint)) {
      fail(`invalid current-to-shadow alias for ${record.linkage_key}`);
    }
    currentEndpoints.add(currentEndpoint);
    shadowEndpoints.add(shadowEndpoint);
    return { alias, target };
  });
  const evidenceMappings = recordEvidence(record).map(({ stage, evidence }) => {
    const span = evidence.document_span;
    const deepestId = evidence.source_nodes?.deepest_node_occurrence_id || null;
    const deepest = byId.get(deepestId);
    const containingIds = [...new Set(
      evidence.source_nodes?.containing_node_occurrence_ids || [],
    )].sort();
    const hasContainingDescendant = containingIds.some((id) => {
      if (id === deepestId) return false;
      let cursor = byId.get(id);
      const visited = new Set();
      while (cursor?.parent_node_occurrence_id) {
        if (visited.has(cursor.node_occurrence_id)) return true;
        visited.add(cursor.node_occurrence_id);
        if (cursor.parent_node_occurrence_id === deepestId) return true;
        cursor = byId.get(cursor.parent_node_occurrence_id);
      }
      return false;
    });
    const sourceLinksValid = Number.isInteger(span?.start)
      && Number.isInteger(span?.end)
      && span.end > span.start
      && containingIds.length > 0
      && containingIds.every((id) => {
        const node = byId.get(id);
        return node
          && node.extent_span.start_byte <= span.start
          && node.extent_span.end_byte >= span.end;
      })
      && deepest
      && !hasContainingDescendant
      && deepest.extent_span.start_byte <= span.start
      && deepest.extent_span.end_byte >= span.end;
    const candidates = sourceLinksValid
      ? validAliases.filter(({ target }) =>
        target.extent_span.start_byte <= span.start
          && target.extent_span.end_byte >= span.end)
        .sort((left, right) => {
          const leftLength = left.target.extent_span.end_byte
            - left.target.extent_span.start_byte;
          const rightLength = right.target.extent_span.end_byte
            - right.target.extent_span.start_byte;
          return leftLength - rightLength
            || left.target.extent_span.start_byte - right.target.extent_span.start_byte
            || left.target.extent_span.end_byte - right.target.extent_span.end_byte
            || left.target.node_occurrence_id.localeCompare(right.target.node_occurrence_id)
            || left.alias.current_node_id.localeCompare(right.alias.current_node_id)
            || left.alias.basis.localeCompare(right.alias.basis);
        })
      : [];
    const selected = candidates[0] || null;
    return {
      evidence_stage: stage,
      claim_evidence_id: evidence.claim_evidence_id,
      excerpt_id: evidence.excerpt_id,
      evidence_role: evidence.evidence_role,
      document_span: clone(span),
      source_links_valid: sourceLinksValid,
      deepest_source_node_occurrence_id: deepestId,
      containing_source_node_occurrence_ids: containingIds,
      alias_path: selected ? {
        current_node_id: selected.alias.current_node_id,
        shadow_node_occurrence_id: selected.alias.shadow_node_occurrence_id,
        shadow_structure_revision_id: selected.alias.shadow_structure_revision_id,
        alias_basis: selected.alias.basis,
        mapping_basis: 'SAME_CANONICAL_UTF8_SPAN_CONTAINMENT',
      } : null,
    };
  }).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return {
    evidence_count: evidenceMappings.length,
    evidence_without_source_node_links: evidenceMappings.filter((entry) =>
      entry.source_links_valid === false).length,
    evidence_without_alias_paths: evidenceMappings.filter((entry) =>
      entry.alias_path === null).length,
    source_node_occurrence_ids: [...new Set(evidenceMappings
      .filter((entry) => entry.source_links_valid)
      .flatMap((entry) => entry.containing_source_node_occurrence_ids))].sort(),
    alias_paths: evidenceMappings.filter((entry) => entry.alias_path !== null),
  };
}

function claimSourceCoverage(records) {
  const claimRecords = records.filter((record) => !record.adapter_residual);
  const payload = claimRecords.map((record) => ({
    semantic_record_id: record.semantic_record_id,
    linkage_key: record.linkage_key,
    current_state: record.current_state,
    claim_source_mapping: record.claim_source_mapping,
  }));
  return {
    current_claim_record_count: claimRecords.length,
    current_claim_records_without_evidence: claimRecords.filter((record) =>
      record.claim_source_mapping.evidence_count === 0).length,
    current_claim_records_without_source_node_links: claimRecords.filter((record) =>
      record.claim_source_mapping.source_node_occurrence_ids.length === 0
        || record.claim_source_mapping.evidence_without_source_node_links > 0).length,
    current_claim_records_without_alias_paths: claimRecords.filter((record) =>
      record.claim_source_mapping.alias_paths.length === 0
        || record.claim_source_mapping.evidence_without_alias_paths > 0).length,
    claim_source_mapping_digest: contentId(
      'STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_SET/V1',
      payload,
    ),
  };
}

function buildRunMapping({
  input,
  sourceCase,
  runDirectory,
  runRole,
  artefacts,
  frozenProjectionByClaim,
  cohortRunByDirectory,
  baselineManifestBinding,
  aliases,
}) {
  const { manifest, receipt, resolution, adapter, validation, scan } = artefacts;
  const starts = scanStarts(scan.value);
  const nodes = sourceCase.nodes;
  const baselineCohortEntry = cohortRunByDirectory.get(runDirectory) || null;
  const cohortMember = baselineCohortEntry !== null;
  const expectedCurrentRecords = buildExpectedCurrentRecords({
    input,
    receipt,
    resolution,
    starts,
    nodes,
  });
  const records = new Map();
  const stableIdentitiesByStage = new Map();
  const proposalsByClosure = new Map();
  const ensure = (key) => {
    if (!records.has(key)) records.set(key, { key, proposal: null, resolution: null, open_world: null, reviews: [], write_set: null, validation: null });
    return records.get(key);
  };

  for (const row of receipt.value.compiled_candidates || []) {
    const claim = candidateClaim(row);
    if (!claim) continue;
    const value = snapshot('PROPOSAL', row, claim, starts, nodes);
    if (!sectionMatches(value.source_citation, input) && !overlapsSelected(value.evidence, input)) continue;
    assertUniqueStageIdentity(stableIdentitiesByStage, 'PROPOSAL', value, runDirectory);
    const key = recordKey(claim.claim_occurrence_id, claim.closure_id, row);
    ensure(key).proposal = value;
    if (claim.closure_id) proposalsByClosure.set(claim.closure_id, key);
  }
  for (const row of resolution.value.resolved || []) {
    const claim = row.claim;
    const value = snapshot('RESOLUTION', row, claim, starts, nodes);
    if (!sectionMatches(value.source_citation || value.section_reference, input)
      && !overlapsSelected(value.evidence, input)) continue;
    assertUniqueStageIdentity(stableIdentitiesByStage, 'RESOLUTION', value, runDirectory);
    const key = recordKey(claim?.claim_occurrence_id, claim?.closure_id, row);
    const record = ensure(key);
    record.resolution = value;
    record.resolved_entry = row;
  }
  for (const row of resolution.value.open_world || []) {
    const value = snapshot('OPEN_WORLD', row, null, starts, nodes);
    if (!sectionMatches(value.source_citation || value.section_reference, input)
      && !overlapsSelected(value.evidence, input)) continue;
    assertUniqueStageIdentity(stableIdentitiesByStage, 'OPEN_WORLD', value, runDirectory);
    const key = proposalsByClosure.get(row.closure_id)
      || recordKey(null, row.closure_id, row);
    ensure(key).open_world = value;
  }
  for (const row of resolution.value.review_queue || []) {
    const value = snapshot('REVIEW', row, null, starts, nodes);
    if (!sectionMatches(value.source_citation || value.section_reference, input)) continue;
    assertUniqueStageIdentity(stableIdentitiesByStage, 'REVIEW', value, runDirectory);
    let key = row.original_claim_occurrence_id
      ? recordKey(row.original_claim_occurrence_id, row.closure_id, row)
      : proposalsByClosure.get(row.closure_id);
    if (row.has_resolution === true && row.claim_revision_id) {
      key = [...records.entries()].find(([, record]) =>
        record.resolution?.claim_revision_id === row.claim_revision_id)?.[0] || key;
    }
    ensure(key || recordKey(null, row.closure_id, row)).reviews.push(value);
  }

  const attachClaims = (claims, stage) => {
    for (const claim of claims || []) {
      const key = recordKey(claim.claim_occurrence_id, claim.closure_id, claim);
      if (!records.has(key)) continue;
      const value = snapshot(stage, claim, claim, starts, nodes);
      assertUniqueStageIdentity(stableIdentitiesByStage, stage, value, runDirectory);
      records.get(key)[stage === 'WRITE_SET' ? 'write_set' : 'validation'] = value;
    }
  };
  attachClaims(adapter.value.write_set?.claims, 'WRITE_SET');
  attachClaims(validation.value.publishableWriteSet?.claims, 'VALIDATION');

  for (const residual of adapter.value.residuals || []) {
    if (!sectionMatches(residual.section_reference, input)) continue;
    const key = recordKey(null, null, { runDirectory, residual });
    ensure(key).adapter_residual = { ...clone(residual), missing_stable_id: true };
  }

  const finalRecords = [...records.values()].map((record) => {
    const currentState = record.resolution ? 'RESOLVED'
      : record.reviews.some((row) => row && row.stage === 'REVIEW') ? 'REVIEW'
        : record.open_world ? 'OPEN_WORLD' : 'ATTEMPTED';
    const projection = record.resolution
      ? renderCurrent(manifest.value, resolution.value, record.resolved_entry)
      : { status: 'NOT_ATTEMPTED_NON_RESOLVED' };
    const frozenProjection = record.resolution
      ? frozenProjectionByClaim.get(record.resolution.claim_revision_id) || null
      : null;
    const projectionEquivalence = !cohortMember
      ? 'NOT_IN_FROZEN_COHORT'
      : !record.resolution
        ? 'NOT_APPLICABLE_NON_RESOLVED'
        : frozenProjection
          ? projection.status === 'ROW_EMITTED'
            && projection.full_output_signature === frozenProjection.full_output_signature
            ? 'UNCHANGED'
            : 'CHANGED'
          : projection.status === 'ROW_EMITTED'
            ? 'CHANGED_NEW_ROW'
            : 'UNCHANGED_NO_ROW';
    const { resolved_entry: ignored, ...serialisable } = record;
    return {
      semantic_record_id: contentId('STAGE_2Y_STRUCTURE_SEMANTIC_RECORD/V1', {
        case_id: input.case_id,
        run_directory: runDirectory,
        key: record.key,
      }),
      linkage_key: record.key,
      linkage_rule: record.key.startsWith('occurrence:')
        ? 'CLAIM_OCCURRENCE_ID'
        : record.key.startsWith('closure:') ? 'CLOSURE_ID_FALLBACK' : 'CONTENT_ID_RESIDUAL',
      current_state: currentState,
      ...serialisable,
      current_projection: projection,
      frozen_projection: frozenProjection,
      projection_equivalence: projectionEquivalence,
    };
  });
  finalRecords.sort((left, right) => left.semantic_record_id.localeCompare(right.semantic_record_id));
  for (const record of finalRecords) {
    if (!record.adapter_residual) {
      record.claim_source_mapping = claimSourceMapping(record, nodes, aliases);
    }
  }
  const currentRecordCoverage = recordCoverage(expectedCurrentRecords, finalRecords);
  const currentEvidenceCoverage = evidenceCoverage(finalRecords);
  const currentClaimSourceCoverage = claimSourceCoverage(finalRecords);
  const rowComparison = compareFrozenRows({
    cohortMember,
    expectedCurrentRecords,
    mappedRecords: finalRecords,
    frozenProjectionByClaim,
    runDirectory,
  });
  return {
    run_directory: runDirectory,
    run_role: runRole,
    frozen_cohort_member: cohortMember,
    frozen_cohort_membership_evidence: {
      membership_rule: 'RUN_DIRECTORY_EXACT_MATCH_IN_BOUND_130_RUN_BASELINE_MANIFEST',
      selected_run_directory: runDirectory,
      baseline_manifest_binding: clone(baselineManifestBinding),
      matched_baseline_run_entry: clone(baselineCohortEntry),
      member: cohortMember,
    },
    deal: manifest.value.deal,
    family: manifest.value.section_family,
    input_bindings: {
      'run-manifest.json': manifest.binding,
      'run-receipt.json': receipt.binding,
      'resolution.json': resolution.binding,
      'adapter-result.json': adapter.binding,
      'validation.json': validation.binding,
      'section-location-scan.json': scan.binding,
    },
    records: finalRecords,
    current_record_coverage: currentRecordCoverage,
    evidence_coverage: currentEvidenceCoverage,
    claim_source_coverage: currentClaimSourceCoverage,
    frozen_row_comparison: rowComparison,
    counts: {
      attempted: finalRecords.filter((record) => record.proposal).length,
      resolved: finalRecords.filter((record) => record.current_state === 'RESOLVED').length,
      open_world: finalRecords.filter((record) => record.current_state === 'OPEN_WORLD').length,
      review: finalRecords.filter((record) => record.current_state === 'REVIEW').length,
      residual: finalRecords.filter((record) => record.adapter_residual).length,
      row_emitted: finalRecords.filter((record) => record.current_projection.status === 'ROW_EMITTED').length,
    },
  };
}

function loadRun(repoRoot, runDirectory, bindings) {
  if (!/^[a-z0-9-]+$/.test(runDirectory)) fail(`invalid sealed run directory: ${runDirectory}`);
  const read = (name) => readBoundJson(repoRoot, `evidence/canonical-v2/${runDirectory}/${name}`, bindings);
  return {
    manifest: read('run-manifest.json'),
    receipt: read('run-receipt.json'),
    resolution: read('resolution.json'),
    adapter: read('adapter-result.json'),
    validation: read('validation.json'),
    scan: read('section-location-scan.json'),
  };
}

function additionalEvidence(repoRoot, input, bindings) {
  return (input.additional_evidence_paths || []).map((path) => {
    const artefact = readBoundJson(repoRoot, path, bindings);
    return { binding: artefact.binding, value: artefact.value };
  });
}

function frozenProjectionIndex(report) {
  const index = new Map();
  for (const group of report?.current?.full_output_duplicate_groups || []) {
    for (const member of group.members || []) {
      if (!member.claim_revision_id) continue;
      if (index.has(member.claim_revision_id)) {
        fail(`frozen row claim is duplicated: ${member.claim_revision_id}`);
      }
      index.set(member.claim_revision_id, {
        claim_revision_id: member.claim_revision_id,
        run_directory: member.run,
        section_reference: member.section_reference,
        full_output_signature: group.signature,
        row_id: group.full_output?.rows?.find((row) => row.matches_claim_key)?.id || null,
        section_id: group.full_output?.section?.id || null,
      });
    }
  }
  return index;
}

function compareFrozenRows({
  cohortMember,
  expectedCurrentRecords,
  mappedRecords,
  frozenProjectionByClaim,
  runDirectory,
}) {
  if (!cohortMember) {
    return {
      status: 'NOT_IN_FROZEN_COHORT',
      expected_frozen_row_count: 0,
      mapped_current_row_count: 0,
      unchanged_row_count: 0,
      changed_signature_count: 0,
      missing_frozen_row_count: 0,
      new_row_count: 0,
      expected_frozen_rows_digest: contentId('STAGE_2Y_EXPECTED_FROZEN_ROW_SET/V1', []),
      mapped_current_rows_digest: contentId('STAGE_2Y_MAPPED_CURRENT_ROW_SET/V1', []),
      expected_frozen_rows: [],
      mapped_current_rows: [],
      differences: [],
    };
  }
  const expectedResolvedClaims = [...expectedCurrentRecords.values()]
    .filter((record) => record.current_state === 'RESOLVED' && record.claim_revision_id)
    .map((record) => record.claim_revision_id);
  const expectedResolvedClaimIds = new Set(expectedResolvedClaims);
  if (expectedResolvedClaimIds.size !== expectedResolvedClaims.length) {
    fail(`duplicate expected resolved claim revision in ${runDirectory}`);
  }
  const expectedRows = [...frozenProjectionByClaim.values()]
    .filter((row) => row.run_directory === runDirectory
      && expectedResolvedClaimIds.has(row.claim_revision_id))
    .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
  const currentRows = mappedRecords
    .filter((record) => record.resolution && record.current_projection.status === 'ROW_EMITTED')
    .map((record) => ({
      claim_revision_id: record.resolution.claim_revision_id,
      run_directory: runDirectory,
      full_output_signature: record.current_projection.full_output_signature,
      row_id: record.current_projection.matching_row?.id || null,
      section_id: record.current_projection.section?.id || null,
    }))
    .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
  const expectedByClaim = new Map(expectedRows.map((row) => [row.claim_revision_id, row]));
  const currentByClaim = new Map(currentRows.map((row) => [row.claim_revision_id, row]));
  const differences = [];
  let unchanged = 0;
  for (const expected of expectedRows) {
    const actual = currentByClaim.get(expected.claim_revision_id);
    if (!actual) {
      differences.push({
        difference: 'MISSING_FROZEN_ROW',
        claim_revision_id: expected.claim_revision_id,
        expected_signature: expected.full_output_signature,
        mapped_signature: null,
      });
    } else if (actual.full_output_signature !== expected.full_output_signature) {
      differences.push({
        difference: 'CHANGED_ROW_SIGNATURE',
        claim_revision_id: expected.claim_revision_id,
        expected_signature: expected.full_output_signature,
        mapped_signature: actual.full_output_signature,
      });
    } else {
      unchanged += 1;
    }
  }
  for (const actual of currentRows) {
    if (expectedByClaim.has(actual.claim_revision_id)) continue;
    differences.push({
      difference: 'NEW_ROW',
      claim_revision_id: actual.claim_revision_id,
      expected_signature: null,
      mapped_signature: actual.full_output_signature,
    });
  }
  const changed = differences.filter((entry) => entry.difference === 'CHANGED_ROW_SIGNATURE').length;
  const missing = differences.filter((entry) => entry.difference === 'MISSING_FROZEN_ROW').length;
  const added = differences.filter((entry) => entry.difference === 'NEW_ROW').length;
  return {
    status: differences.length === 0 ? 'UNCHANGED' : 'CHANGED',
    expected_frozen_row_count: expectedRows.length,
    mapped_current_row_count: currentRows.length,
    unchanged_row_count: unchanged,
    changed_signature_count: changed,
    missing_frozen_row_count: missing,
    new_row_count: added,
    expected_frozen_rows_digest: contentId('STAGE_2Y_EXPECTED_FROZEN_ROW_SET/V1', expectedRows),
    mapped_current_rows_digest: contentId('STAGE_2Y_MAPPED_CURRENT_ROW_SET/V1', currentRows),
    expected_frozen_rows: expectedRows,
    mapped_current_rows: currentRows,
    differences,
  };
}

function replayRows(additional, input) {
  const replay = additional.find((entry) => entry.value?.schema_version === 'STAGE_2Y_D_DEFINED_TERM_REPLAY/V2');
  if (!replay) return [];
  return (replay.value.ledger_rows || [])
    .filter((row) => input.run_directories.includes(row.representation_run)
      && input.sections.includes(row.section_reference))
    .map((row) => ({ ...clone(row), does_not_override_current_state: true }));
}

function contextSlice(contextPrototype, caseId) {
  const select = (artefact, keys) => {
    for (const key of keys) {
      if (Array.isArray(artefact?.[key])) {
        const direct = artefact[key].filter((row) => row?.case_id === caseId);
        if (direct.length) return clone(direct);
      }
    }
    const block = artefact?.cases?.find?.((row) => row.case_id === caseId);
    return block ? clone(block) : [];
  };
  return {
    context_facts: select(contextPrototype?.contextFacts, ['facts', 'context_facts']),
    reference_edges: select(contextPrototype?.referenceEdges, ['edges', 'reference_edges']),
  };
}

function diffOutcome(record) {
  if (record.adapter_residual) return { outcome: 'OMITTED', detail: 'ADAPTER_RESIDUAL_NO_ROW' };
  if (record.current_state === 'OPEN_WORLD' || record.current_state === 'REVIEW') {
    return { outcome: 'UNRESOLVED', detail: `${record.current_state}_NO_ROW` };
  }
  if (record.current_state !== 'RESOLVED') return { outcome: 'OMITTED', detail: 'ATTEMPTED_NO_CURRENT_DISPOSITION' };
  if (record.current_projection.status === 'ROW_EMITTED') return { outcome: 'ROW_EMITTED', detail: 'CURRENT_ROW_SNAPSHOT' };
  if (record.current_projection.error_code === 'FAMILY_NOT_RENDERABLE') {
    return { outcome: 'NO_ROUTE', detail: 'RESOLVED_NO_APPROVED_OUTPUT_OWNER' };
  }
  return { outcome: 'RENDER_FAILURE', detail: record.current_projection.error_code || 'UNKNOWN' };
}

function decisionFinding(caseMapping) {
  const records = caseMapping.runs.flatMap((run) => run.records.map((record) => ({ run, record })));
  const byOccurrence = (id) => records.find(({ record }) => record.linkage_key === `occurrence:${id}`)?.record || null;
  if (caseMapping.case_id === 'CONCHO_6_9_A') {
    const period = byOccurrence('763260be023ca4cb9627767607db25c11a0f409179122637de6e9f3ce058e115');
    const proviso = byOccurrence('8170d5dd0d1c3ccd38ea2dedba320e7de59250ae4388626386c978923f994ee2');
    if (!period || period.current_state !== 'REVIEW' || !proviso) fail('Concho 6.9(a) decision anchors drifted');
    return {
      finding: 'CHAPEAU_AND_LOCAL_PROVISOS_ARE_NOT_COMPLETE_ROW_INPUTS',
      period_claim: { semantic_record_id: period.semantic_record_id, current_state: period.current_state },
      local_proviso_claim: { semantic_record_id: proviso.semantic_record_id, current_state: proviso.current_state },
      current_rows_do_not_supply_inherited_subject_or_governing_verb: true,
    };
  }
  if (caseMapping.case_id === 'TOPBUILD_6_2') {
    const restraint = records.filter(({ record }) => [
      '3ccd0cd6650e6d4b94b65e8cb16edd70c659bd9e07de1b5242d810a0dcbe61ec',
      '6eec69a40657eb5f627df4344a392cc71603c285729bf0386b11fe3452fcd8a0',
    ].includes(record.resolution?.claim_revision_id));
    if (restraint.length !== 2) fail('TopBuild 6.2 restraint anchors drifted');
    return {
      finding: 'PARTY_SOURCE_PROVENANCE_AND_CAUSATION_PROVISOS_DO_NOT_SURVIVE_TO_WRITE_SET_OR_ROW',
      restraint_claim_ids: restraint.map(({ record }) => record.semantic_record_id),
      resolution_party_source_span_count: restraint.filter(({ record }) => record.resolution.party_source_span).length,
      write_set_party_source_span_count: restraint.filter(({ record }) => record.write_set?.party_source_span).length,
    };
  }
  if (caseMapping.case_id === 'REDHAT_3_01_3_02') {
    const historical = caseMapping.runs.find((run) => run.run_role === 'HISTORICAL_69_CASE_WORKLOAD');
    const limbs = historical?.records.filter((record) => record.open_world?.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'
      && record.open_world?.raw_value).length || 0;
    const residuals = historical?.records.filter((record) => record.adapter_residual).length || 0;
    if (limbs !== 68 || residuals !== 1) fail(`Red Hat 69-case workload drifted: ${limbs}+${residuals}`);
    return {
      finding: 'MODEL_LIMB_PATHS_ARE_NOT_SOURCE_PARENTAGE',
      historical_unmapped_limb_claims: limbs,
      historical_adapter_residuals: residuals,
      current_resolved_rows: caseMapping.runs
        .filter((run) => run.run_role === 'FROZEN_COHORT_CURRENT')
        .reduce((count, run) => count + run.counts.row_emitted, 0),
    };
  }
  if (caseMapping.case_id === 'METSERA_7_04') {
    const current = records.find(({ record }) => record.resolution?.claim_revision_id
      === '7490a23a2cc41cb78ce7260d45ae80a7795b2453bd2fe45672243a61107eddb9')?.record;
    if (!current) fail('Metsera 7.04 resolved anchor drifted');
    const sourceText = caseMapping.source.selected_text || '';
    return {
      finding: 'ONE_ROW_COLLAPSES_RECIPROCAL_SENTENCES_AND_REFERENCE_OCCURRENCES',
      semantic_record_id: current.semantic_record_id,
      current_explicit_cross_reference_count: (current.resolution.attributes?.explicit_clause_cross_references || []).length
        || (current.resolution.attributes?.explicit_clause_cross_reference ? 1 : 0),
      source_reference_occurrence_count: (sourceText.match(/Section\s+7\.0[123]/g) || []).length,
      row_id: current.current_projection.matching_row?.id || null,
    };
  }
  if (caseMapping.case_id === 'CONCHO_4_10_ANNEX_A') {
    const uses = records.filter(({ record }) => [
      'e5f4f1222045d1cb48c16c4bf12db90435ed3470d91558a26ace312efe868e6d',
      'd006867e9664c974d076c312ad1613df5b6f035ad8f054aba661ad48a1680330',
    ].includes(record.open_world?.closure_id));
    if (uses.length !== 2 || caseMapping.replay_outcomes.length !== 2) {
      fail('Concho 4.10 defined-term anchors drifted');
    }
    return {
      finding: 'DEFINED_TERM_REPLAY_MUST_REMAIN_DISTINCT_FROM_CURRENT_OPEN_WORLD_STATE',
      current_use_states: uses.map(({ record }) => ({ semantic_record_id: record.semantic_record_id, state: record.current_state })),
      replay_effective_codes: caseMapping.replay_outcomes.map((row) => row.effective_code),
      selected_definition_claim_occurrence_ids: [...new Set(caseMapping.replay_outcomes
        .flatMap((row) => row.selected_definition_claim_occurrence_ids || []))],
    };
  }
  fail(`missing decision finding: ${caseMapping.case_id}`);
}

function materialResolvedInformationLoss(caseMapping, finding) {
  const records = caseMapping.runs.flatMap((run) => run.records);
  const bySemanticId = new Map(records.map((record) => [record.semantic_record_id, record]));
  const hasResolvedOrEmittedAnchor = (record) => Boolean(record
    && (record.current_state === 'RESOLVED'
      || record.current_projection?.status === 'ROW_EMITTED'));

  if (finding.finding === 'PARTY_SOURCE_PROVENANCE_AND_CAUSATION_PROVISOS_DO_NOT_SURVIVE_TO_WRITE_SET_OR_ROW') {
    const anchorIds = (finding.restraint_claim_ids || [])
      .filter((semanticRecordId) => hasResolvedOrEmittedAnchor(bySemanticId.get(semanticRecordId)));
    const sourceSpanLoss = finding.resolution_party_source_span_count
      > finding.write_set_party_source_span_count;
    return {
      qualifies: anchorIds.length > 0 && sourceSpanLoss,
      resolved_or_emitted_anchor_semantic_record_ids: anchorIds,
      measured_loss: {
        resolution_party_source_span_count: finding.resolution_party_source_span_count,
        write_set_party_source_span_count: finding.write_set_party_source_span_count,
      },
    };
  }

  if (finding.finding === 'ONE_ROW_COLLAPSES_RECIPROCAL_SENTENCES_AND_REFERENCE_OCCURRENCES') {
    const record = bySemanticId.get(finding.semantic_record_id);
    const referenceLoss = finding.source_reference_occurrence_count
      > finding.current_explicit_cross_reference_count;
    return {
      qualifies: hasResolvedOrEmittedAnchor(record) && referenceLoss,
      resolved_or_emitted_anchor_semantic_record_ids:
        hasResolvedOrEmittedAnchor(record) ? [finding.semantic_record_id] : [],
      measured_loss: {
        source_reference_occurrence_count: finding.source_reference_occurrence_count,
        current_explicit_cross_reference_count: finding.current_explicit_cross_reference_count,
        emitted_row_id: finding.row_id,
      },
    };
  }

  return {
    qualifies: false,
    resolved_or_emitted_anchor_semantic_record_ids: [],
    measured_loss: null,
  };
}

export async function buildSemanticPrototype({
  repoRoot,
  control,
  inputs,
  sourcePrototype,
  contextPrototype,
} = {}) {
  if (typeof repoRoot !== 'string' || !repoRoot) fail('repoRoot is required');
  assertAuthority(control, inputs);
  const bindings = bindingIndex(control);
  const baselineManifest = readBoundJson(
    repoRoot,
    control.baseline_manifest.path,
    bindings,
  );
  if (baselineManifest.value?.schema_version !== 'STAGE_2Y_CD_BASELINE_MANIFEST/V1'
    || baselineManifest.value?.manifest_id !== control.baseline_manifest.manifest_id
    || baselineManifest.value?.runs?.length !== 130) {
    fail('bound 130-run baseline manifest drift');
  }
  const cohortRunByDirectory = new Map(
    baselineManifest.value.runs.map((run) => [run.directory, run]),
  );
  if (cohortRunByDirectory.size !== baselineManifest.value.runs.length) {
    fail('bound baseline manifest contains duplicate run directories');
  }
  const currentMeasurement = readBoundJson(
    repoRoot,
    control.current_measurement_binding.path,
    bindings,
  );
  const frozenProjectionByClaim = frozenProjectionIndex(currentMeasurement.value);
  const cases = [];
  for (const input of inputs.cases) {
    const sourceCase = sourceCaseFor(sourcePrototype, input);
    const source = {
      immutable_source_document_id: input.immutable_source_document_id,
      canonical_text_sha256: input.canonical_text_sha256,
      canonical_text_byte_length: input.canonical_text_byte_length,
      selected_spans: clone(input.spans),
      selected_node_occurrence_ids: sourceCase.nodes.map((node) => node.node_occurrence_id),
      selected_text: input.spans.map((span) => Buffer.from(sourceCase.canonical_text, 'utf8').subarray(span.start, span.end).toString('utf8')).join('\n'),
    };
    if (input.set !== 'DECISION') {
      cases.push({
        case_id: input.case_id,
        set: input.set,
        deal: input.deal,
        sections: clone(input.sections),
        required_features: clone(input.required_features),
        status: 'CONFIRMATION_METADATA_ONLY',
        source,
      });
      continue;
    }
    const additional = additionalEvidence(repoRoot, input, bindings);
    const aliases = (sourcePrototype.nodeAliases?.aliases || [])
      .filter((alias) => alias.case_id === input.case_id);
    const runs = input.run_directories.map((runDirectory) => buildRunMapping({
      input,
      sourceCase,
      runDirectory,
      runRole: input.run_roles?.[runDirectory] || null,
      artefacts: loadRun(repoRoot, runDirectory, bindings),
      frozenProjectionByClaim,
      cohortRunByDirectory,
      baselineManifestBinding: baselineManifest.binding,
      aliases,
    }));
    const caseMapping = {
      case_id: input.case_id,
      set: input.set,
      deal: input.deal,
      sections: clone(input.sections),
      required_features: clone(input.required_features),
      source,
      context: contextSlice(contextPrototype, input.case_id),
      runs,
      additional_evidence_bindings: additional.map((entry) => entry.binding),
      replay_outcomes: replayRows(additional, input),
    };
    const finding = decisionFinding(caseMapping);
    caseMapping.decision_finding = {
      ...finding,
      material_resolved_information_loss: materialResolvedInformationLoss(caseMapping, finding),
    };
    cases.push(caseMapping);
  }

  const decisionRecords = cases
    .filter((entry) => entry.set === 'DECISION')
    .flatMap((entry) => entry.runs.flatMap((run) => run.records.map((record) => ({ case: entry, run, record }))));
  const diffRecords = decisionRecords.map(({ case: entry, run, record }) => ({
    diff_record_id: contentId('STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF_RECORD/V1', {
      case_id: entry.case_id,
      run_directory: run.run_directory,
      semantic_record_id: record.semantic_record_id,
    }),
    case_id: entry.case_id,
    run_directory: run.run_directory,
    run_role: run.run_role,
    family: run.family,
    semantic_record_id: record.semantic_record_id,
    linkage_key: record.linkage_key,
    current_state: record.current_state,
    source_node_occurrence_ids: clone(
      record.claim_source_mapping?.source_node_occurrence_ids || [],
    ),
    current_projection: clone(record.current_projection),
    frozen_projection: clone(record.frozen_projection),
    projection_equivalence: record.projection_equivalence,
    ...diffOutcome(record),
  }));
  const informationLoss = diffRecords.filter((entry) =>
    ['OMITTED', 'UNRESOLVED', 'NO_ROUTE', 'RENDER_FAILURE'].includes(entry.outcome)).length;
  const materialResolvedInformationLossCaseCount = cases.filter((entry) =>
    entry.set === 'DECISION'
      && entry.decision_finding?.material_resolved_information_loss?.qualifies === true).length;
  const decisionRuns = cases
    .filter((entry) => entry.set === 'DECISION')
    .flatMap((entry) => entry.runs.map((run) => ({ case_id: entry.case_id, run })));
  const expectedRecordCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.expected_record_count, 0);
  const mappedRecordCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.mapped_record_count, 0);
  const missingRecordCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.missing_record_count, 0);
  const unexpectedRecordCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.unexpected_record_count, 0);
  const identityMismatchCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.identity_mismatch_count, 0);
  const stateMismatchCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.state_mismatch_count, 0);
  const valueMismatchCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.current_record_coverage.value_mismatch_count, 0);
  const evidenceSpanCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.evidence_coverage.evidence_span_count, 0);
  const unlinkedEvidenceSpanCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.evidence_coverage.evidence_spans_without_source_node_links, 0);
  const currentClaimRecordCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.claim_source_coverage.current_claim_record_count, 0);
  const currentClaimRecordsWithoutEvidence = decisionRuns.reduce((sum, { run }) =>
    sum + run.claim_source_coverage.current_claim_records_without_evidence, 0);
  const currentClaimRecordsWithoutSourceNodeLinks = decisionRuns.reduce((sum, { run }) =>
    sum + run.claim_source_coverage.current_claim_records_without_source_node_links, 0);
  const currentClaimRecordsWithoutAliasPaths = decisionRuns.reduce((sum, { run }) =>
    sum + run.claim_source_coverage.current_claim_records_without_alias_paths, 0);
  const expectedFrozenRowCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.expected_frozen_row_count, 0);
  const mappedCurrentRowCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.mapped_current_row_count, 0);
  const unchangedFrozenRowCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.unchanged_row_count, 0);
  const changedRowSignatureCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.changed_signature_count, 0);
  const missingFrozenRowCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.missing_frozen_row_count, 0);
  const newRowCount = decisionRuns.reduce((sum, { run }) =>
    sum + run.frozen_row_comparison.new_row_count, 0);
  const oldRowsChanged = changedRowSignatureCount + missingFrozenRowCount + newRowCount;
  const expectedRecordDigest = contentId('STAGE_2Y_EXPECTED_CURRENT_RECORD_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      digest: run.current_record_coverage.expected_records_digest,
    })));
  const mappedRecordDigest = contentId('STAGE_2Y_MAPPED_CURRENT_RECORD_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      digest: run.current_record_coverage.mapped_records_digest,
    })));
  const evidenceSpanDigest = contentId('STAGE_2Y_MAPPED_EVIDENCE_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      digest: run.evidence_coverage.evidence_span_set_digest,
    })));
  const expectedFrozenRowsDigest = contentId('STAGE_2Y_EXPECTED_FROZEN_ROW_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      cohort_member: run.frozen_cohort_member,
      digest: run.frozen_row_comparison.expected_frozen_rows_digest,
    })));
  const mappedCurrentRowsDigest = contentId('STAGE_2Y_MAPPED_CURRENT_ROW_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      cohort_member: run.frozen_cohort_member,
      digest: run.frozen_row_comparison.mapped_current_rows_digest,
    })));
  const selectedBaselineCohortRunDirectories = [...new Set(decisionRuns
    .filter(({ run }) => run.frozen_cohort_member)
    .map(({ run }) => run.run_directory))].sort();
  const baselineCohortMembershipEvidenceDigest = contentId(
    'STAGE_2Y_SELECTED_BASELINE_COHORT_MEMBERSHIP/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      evidence: run.frozen_cohort_membership_evidence,
    })),
  );
  const claimSourceMappingDigest = contentId(
    'STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_COVERAGE/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      digest: run.claim_source_coverage.claim_source_mapping_digest,
    })),
  );

  const semanticMapping = {
    schema_version: MAPPING_SCHEMA,
    purpose: 'Fixed-case report-only mapping of current semantic artefacts onto the proposed source tree.',
    authority: {
      model_calls: 0,
      phase_b_route_calls: 0,
      product_writes: 0,
      publication_authorisation: 'NONE',
      current_selector_changes: 0,
    },
    source_commit: control.source_commit,
    coordinate_system: 'DOCUMENT_ABSOLUTE_UTF8_HALF_OPEN',
    primary_linkage_rule: 'CLAIM_OCCURRENCE_ID',
    replay_rule: 'REPLAY_OUTCOMES_ARE_COMPARATORS_AND_DO_NOT_OVERRIDE_CURRENT_RESOLUTION',
    cases,
    summary: {
      case_count: cases.length,
      decision_case_count: cases.filter((entry) => entry.set === 'DECISION').length,
      confirmation_metadata_case_count: cases.filter((entry) => entry.set === 'CONFIRMATION').length,
      semantic_record_count: decisionRecords.length,
      expected_selected_current_record_count: expectedRecordCount,
      mapped_selected_current_record_count: mappedRecordCount,
      missing_current_record_count: missingRecordCount,
      unexpected_mapped_record_count: unexpectedRecordCount,
      identity_mismatch_count: identityMismatchCount,
      state_mismatch_count: stateMismatchCount,
      value_mismatch_count: valueMismatchCount,
      evidence_span_count: evidenceSpanCount,
      evidence_spans_without_source_node_links: unlinkedEvidenceSpanCount,
      current_claim_record_count: currentClaimRecordCount,
      current_claim_records_without_evidence: currentClaimRecordsWithoutEvidence,
      current_claim_records_without_source_node_links:
        currentClaimRecordsWithoutSourceNodeLinks,
      current_claim_records_without_alias_paths: currentClaimRecordsWithoutAliasPaths,
      unexpected_state_changes: missingRecordCount + unexpectedRecordCount
        + identityMismatchCount + stateMismatchCount,
      unexpected_value_changes: valueMismatchCount,
      expected_current_records_digest: expectedRecordDigest,
      mapped_current_records_digest: mappedRecordDigest,
      evidence_span_coverage_digest: evidenceSpanDigest,
      claim_source_mapping_digest: claimSourceMappingDigest,
      selected_decision_run_count: decisionRuns.length,
      selected_baseline_cohort_run_count: decisionRuns
        .filter(({ run }) => run.frozen_cohort_member).length,
      selected_baseline_cohort_run_directories: selectedBaselineCohortRunDirectories,
      baseline_cohort_membership_evidence_digest: baselineCohortMembershipEvidenceDigest,
    },
  };
  const sourceToRowDiff = {
    schema_version: DIFF_SCHEMA,
    purpose: 'Current source-to-row outcomes. This artefact does not repair or replace a renderer.',
    projection_method: 'EXISTING_STAGE_2Y_CD_RENDER_SIGNATURE_AND_MATCHED_ROW',
    records: diffRecords,
    decision_case_findings: cases
      .filter((entry) => entry.set === 'DECISION')
      .map((entry) => ({ case_id: entry.case_id, ...clone(entry.decision_finding) })),
    summary: {
      record_count: diffRecords.length,
      row_emitted: diffRecords.filter((entry) => entry.outcome === 'ROW_EMITTED').length,
      information_loss_records: informationLoss,
      material_resolved_information_loss_case_count: materialResolvedInformationLossCaseCount,
      old_rows_changed: oldRowsChanged,
      expected_frozen_row_count: expectedFrozenRowCount,
      mapped_current_row_count: mappedCurrentRowCount,
      unchanged_frozen_row_count: unchangedFrozenRowCount,
      changed_row_signature_count: changedRowSignatureCount,
      missing_frozen_row_count: missingFrozenRowCount,
      new_row_count: newRowCount,
      expected_frozen_rows_digest: expectedFrozenRowsDigest,
      mapped_current_rows_digest: mappedCurrentRowsDigest,
      outcomes: Object.fromEntries([...new Set(diffRecords.map((entry) => entry.outcome))]
        .sort()
        .map((outcome) => [outcome, diffRecords.filter((entry) => entry.outcome === outcome).length])),
    },
  };
  return { semanticMapping, sourceToRowDiff };
}
