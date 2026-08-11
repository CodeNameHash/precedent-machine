#!/usr/bin/env node

// Builds the report-only Stage 2Y M1 structure falsification prototype.
// The command has no database, provider, selector, pin, baseline, or product write.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSourcePrototype } from './lib/stage-2y-structure-source-prototype.mjs';
import { buildContextPrototype } from './lib/stage-2y-structure-context-prototype.mjs';
import { buildSemanticPrototype } from './lib/stage-2y-structure-semantic-prototype.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED_CONTROL = resolve(MIGRATION_ROOT, 'control/manifest.json');
const EXPECTED_INPUTS = resolve(MIGRATION_ROOT, 'control/prototype-inputs.json');
const EXPECTED_OUTPUT_ROOT = resolve(MIGRATION_ROOT, 'prototype/m1');
const M0_RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m0-control-freeze.json',
);
const RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m1-falsification-prototype.json',
);
const SOL_REVIEW_PATH = resolve(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m1-sol-technical-review.json',
);
const M1_BASE_COMMIT = '7e4b064c2f0f82f28f1ab83dfae90ece74934a8f';

const OUTPUT_SCHEMAS = Object.freeze({
  'agreement-index.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_INDEX/V1',
  'byte-ownership.json': 'STAGE_2Y_STRUCTURE_BYTE_OWNERSHIP/V1',
  'node-aliases.json': 'STAGE_2Y_STRUCTURE_NODE_ALIASES/V1',
  'structure-alternatives.json': 'STAGE_2Y_STRUCTURE_ALTERNATIVES/V1',
  'reference-edges.json': 'STAGE_2Y_STRUCTURE_REFERENCE_EDGES/V1',
  'context-facts.json': 'STAGE_2Y_STRUCTURE_CONTEXT_FACTS/V1',
  'current-semantic-mapping.json': 'STAGE_2Y_STRUCTURE_SEMANTIC_MAPPING/V1',
  'source-to-row-diff.json': 'STAGE_2Y_STRUCTURE_SOURCE_TO_ROW_DIFF/V1',
  'decision.json': 'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1',
});

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_PROTOTYPE: ${message}`);
}

function parseArgs(argv) {
  const allowed = new Set(['--control', '--inputs', '--output-root']);
  if (argv.length !== 8) {
    fail('requires only --control <path> --inputs <path> --output-root <path>');
  }
  const values = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || value.startsWith('--') || values.has(key)) {
      fail('requires each of --control, --inputs and --output-root exactly once');
    }
    values.set(key, resolve(value));
  }
  const parsed = {
    control: values.get('--control'),
    inputs: values.get('--inputs'),
    outputRoot: values.get('--output-root'),
  };
  if (parsed.control !== EXPECTED_CONTROL
    || parsed.inputs !== EXPECTED_INPUTS
    || parsed.outputRoot !== EXPECTED_OUTPUT_ROOT) {
    fail('paths must be the frozen M0 control, inputs and M1 report-only output root');
  }
  return parsed;
}

function readJson(absolutePath) {
  if (!existsSync(absolutePath)) fail(`missing ${repositoryPath(absolutePath)}`);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath);
  if (!value || value.startsWith('..')) fail(`path is outside repository: ${absolutePath}`);
  return value.split('\\').join('/');
}

function fileDigest(absolutePath) {
  return sha256Hex(readFileSync(absolutePath));
}

function valueDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function writeSealed(absolutePath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (existsSync(absolutePath)) {
    const current = readFileSync(absolutePath, 'utf8');
    if (current !== bytes) fail(`refuses to mutate sealed ${repositoryPath(absolutePath)}`);
    return Object.freeze({
      path: repositoryPath(absolutePath),
      byte_length: Buffer.byteLength(current, 'utf8'),
      sha256: sha256Hex(Buffer.from(current, 'utf8')),
    });
  }
  writeFileSync(absolutePath, bytes, { encoding: 'utf8', flag: 'wx' });
  return Object.freeze({
    path: repositoryPath(absolutePath),
    byte_length: Buffer.byteLength(bytes, 'utf8'),
    sha256: sha256Hex(Buffer.from(bytes, 'utf8')),
  });
}

function writeReviewPendingDraft(absolutePath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (existsSync(absolutePath)) {
    fail(`refuses to overwrite review-pending draft ${repositoryPath(absolutePath)}`);
  }
  writeFileSync(absolutePath, bytes, { encoding: 'utf8', flag: 'wx' });
  return Object.freeze({
    path: repositoryPath(absolutePath),
    byte_length: Buffer.byteLength(bytes, 'utf8'),
    sha256: sha256Hex(Buffer.from(bytes, 'utf8')),
  });
}

function assertControl(control, inputs, args) {
  if (control.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1') {
    fail('control schema drift');
  }
  if (inputs.schema_version !== 'STAGE_2Y_STRUCTURE_PROTOTYPE_INPUTS/V1') {
    fail('prototype-input schema drift');
  }
  if (control.source_commit !== '7ba2b9d4612cf95be5d0da4b06a56773e33d2f4e') {
    fail('source commit drift');
  }
  const binding = control.control_bindings?.['prototype-inputs.json'];
  if (!binding || binding.path !== repositoryPath(args.inputs)
    || binding.sha256 !== fileDigest(args.inputs)) {
    fail('prototype inputs do not match the M0 binding');
  }
  const authority = control.authority;
  const zero = [
    'pin_changes',
    'baseline_changes',
    'saved_control_mutations',
    'release_receipts_created',
    'current_selector_changes',
    'model_calls',
    'phase_b_route_calls',
    'product_writes',
    'serving_changes',
  ];
  for (const field of zero) if (authority?.[field] !== 0) fail(`authority ${field} is not zero`);
  for (const selector of [
    'structure_selector',
    'context_selector',
    'analysis_selector',
    'projection_selector',
  ]) {
    if (authority?.[selector] !== 'current') fail(`${selector} must remain current`);
  }
  if (authority?.database_target !== 'NONE'
    || authority?.publication_authorisation !== 'NONE'
    || authority?.internal_cutover_authorisation !== 'NONE'
    || authority?.phase_b_status !== 'DEFERRED_LOCKED') {
    fail('M0 authority locks drifted');
  }
  if (!Array.isArray(inputs.cases)
    || inputs.cases.filter((entry) => entry.set === 'DECISION').length !== 5
    || inputs.cases.filter((entry) => entry.set === 'CONFIRMATION').length !== 4) {
    fail('prototype case set drift');
  }
  const m0Receipt = readJson(M0_RECEIPT_PATH);
  if (m0Receipt.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1'
    || m0Receipt.stage !== 'M0'
    || m0Receipt.status !== 'PASS'
    || m0Receipt.input_digests?.control_manifest !== fileDigest(args.control)) {
    fail('M0 receipt does not bind the control manifest presented to M1');
  }
}

function byteOwnershipAssessment({ byteOwnership, agreementIndex, runtimeCases, inputs }) {
  const ledgers = Array.isArray(byteOwnership.cases) ? byteOwnership.cases : [];
  const indexCases = new Map((agreementIndex.cases || []).map((entry) => [entry.case_id, entry]));
  const runtimeByCase = new Map(runtimeCases.map((entry) => [entry.case_id, entry]));
  const expectedCaseIds = inputs.cases.map((entry) => entry.case_id);
  const suppliedCaseIds = ledgers.map((entry) => entry.case_id);
  const indexCaseIds = (agreementIndex.cases || []).map((entry) => entry.case_id);
  const runtimeCaseIds = runtimeCases.map((entry) => entry.case_id);
  const perSpanProofs = [];
  let expectedSelectedBytes = 0;
  let recomputedSelectedBytes = 0;
  let ownerCount = 0;
  let verifiedOwnerCount = 0;
  let caseBindingFailures = suppliedCaseIds.join('\n') === expectedCaseIds.join('\n') ? 0 : 1;
  let spanBindingFailures = 0;
  let partitionFailures = 0;
  let ownerNodeFailures = 0;
  let ownerDigestFailures = 0;
  let orphanLeafOwnerCount = 0;
  let declaredGapCount = 0;
  let declaredOverlapCount = 0;
  let declaredCompletionFailures = byteOwnership.complete === true
    && byteOwnership.case_count === ledgers.length ? 0 : 1;
  if (agreementIndex.case_count !== indexCaseIds.length
    || canonicalJson(indexCaseIds) !== canonicalJson(expectedCaseIds)
    || canonicalJson(runtimeCaseIds) !== canonicalJson(expectedCaseIds)
    || new Set(indexCaseIds).size !== indexCaseIds.length
    || new Set(runtimeCaseIds).size !== runtimeCaseIds.length) {
    caseBindingFailures += 1;
  }
  for (const [caseIndex, frozenCase] of inputs.cases.entries()) {
    const ledgerCase = ledgers[caseIndex];
    const indexCase = indexCases.get(frozenCase.case_id);
    const runtime = runtimeByCase.get(frozenCase.case_id);
    if (!ledgerCase || ledgerCase.case_id !== frozenCase.case_id
      || !indexCase || !runtime || typeof runtime.canonical_text !== 'string') {
      caseBindingFailures += 1;
      continue;
    }
    if (ledgerCase.complete !== true) declaredCompletionFailures += 1;
    const sourceBytes = Buffer.from(runtime.canonical_text, 'utf8');
    const nodes = new Map(indexCase.nodes.map((node) => [node.node_occurrence_id, node]));
    if (nodes.size !== indexCase.nodes.length) ownerNodeFailures += 1;
    const leafOwnerIds = indexCase.nodes.filter((node) =>
      ['SOURCE_TEXT', 'SOURCE_ARTEFACT'].includes(node.node_kind)
        && Array.isArray(node.owned_spans)
        && node.owned_spans.length === 1
        && (node.child_node_occurrence_ids || []).length === 0)
      .map((node) => node.node_occurrence_id).sort();
    const ledgerOwnerIds = [];
    const seenOwnerIds = new Set();
    if ((ledgerCase.spans || []).length !== frozenCase.spans.length) spanBindingFailures += 1;
    for (const [spanIndex, frozen] of frozenCase.spans.entries()) {
      const ledger = (ledgerCase.spans || [])[spanIndex];
      expectedSelectedBytes += frozen.byte_length;
      if (!ledger) {
        spanBindingFailures += 1;
        continue;
      }
      if (ledger.complete !== true) declaredCompletionFailures += 1;
      declaredGapCount += Array.isArray(ledger.gaps) ? ledger.gaps.length : 1;
      declaredOverlapCount += Array.isArray(ledger.overlaps) ? ledger.overlaps.length : 1;
      const selected = ledger.selected_span || {};
      const sourceDigest = sha256Hex(sourceBytes.subarray(frozen.start, frozen.end));
      if (ledger.section_reference !== frozen.section_reference
        || selected.start_byte !== frozen.start
        || selected.end_byte !== frozen.end
        || selected.byte_length !== frozen.byte_length
        || selected.text_sha256 !== frozen.text_sha256
        || sourceDigest !== frozen.text_sha256) {
        spanBindingFailures += 1;
      }
      const owners = Array.isArray(ledger.owners) ? ledger.owners : [];
      ownerCount += owners.length;
      let cursor = frozen.start;
      let covered = 0;
      let partitionValid = owners.length > 0;
      const ownerProofs = [];
      for (const owner of owners) {
        const node = nodes.get(owner.owner_node_occurrence_id);
        const length = owner.end_byte - owner.start_byte;
        const digest = Number.isInteger(owner.start_byte) && Number.isInteger(owner.end_byte)
          ? sha256Hex(sourceBytes.subarray(owner.start_byte, owner.end_byte)) : null;
        if (owner.start_byte !== cursor || !Number.isInteger(length) || length <= 0) {
          partitionValid = false;
        }
        cursor = owner.end_byte;
        covered += Number.isInteger(length) && length > 0 ? length : 0;
        if (seenOwnerIds.has(owner.owner_node_occurrence_id)) ownerNodeFailures += 1;
        seenOwnerIds.add(owner.owner_node_occurrence_id);
        ledgerOwnerIds.push(owner.owner_node_occurrence_id);
        const nodeValid = node
          && ['SOURCE_TEXT', 'SOURCE_ARTEFACT'].includes(owner.owner_kind)
          && node.node_kind === owner.owner_kind
          && (node.child_node_occurrence_ids || []).length === 0
          && canonicalJson(node.extent_span) === canonicalJson({
            coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
            start_byte: owner.start_byte,
            end_byte: owner.end_byte,
            text_sha256: owner.text_sha256,
          })
          && canonicalJson(node.owned_spans) === canonicalJson([node.extent_span])
          && (node.roles || []).includes('BYTE_OWNER');
        if (!nodeValid) ownerNodeFailures += 1;
        if (digest !== owner.text_sha256) ownerDigestFailures += 1;
        if (nodeValid && digest === owner.text_sha256) verifiedOwnerCount += 1;
        ownerProofs.push({
          owner_node_occurrence_id: owner.owner_node_occurrence_id,
          start_byte: owner.start_byte,
          end_byte: owner.end_byte,
          text_sha256: owner.text_sha256,
        });
      }
      if (cursor !== frozen.end
        || covered !== frozen.byte_length
        || ledger.selected_byte_count !== frozen.byte_length
        || ledger.exactly_once_byte_count !== covered
        || !partitionValid) {
        partitionFailures += 1;
      }
      recomputedSelectedBytes += covered;
      perSpanProofs.push({
        case_id: frozenCase.case_id,
        section_reference: frozen.section_reference,
        selected_span: {
          start_byte: frozen.start,
          end_byte: frozen.end,
          text_sha256: frozen.text_sha256,
        },
        owners: ownerProofs,
      });
    }
    const uniqueLedgerOwnerIds = [...new Set(ledgerOwnerIds)].sort();
    orphanLeafOwnerCount += leafOwnerIds.filter((id) => !uniqueLedgerOwnerIds.includes(id)).length;
    orphanLeafOwnerCount += uniqueLedgerOwnerIds.filter((id) => !leafOwnerIds.includes(id)).length;
  }
  const expectedLedgerCount = inputs.cases.reduce((sum, entry) => sum + entry.spans.length, 0);
  const ledgerCount = ledgers.reduce((sum, entry) => sum + (entry.spans || []).length, 0);
  const complete = ledgers.length === inputs.cases.length
    && ledgerCount === expectedLedgerCount
    && expectedSelectedBytes === recomputedSelectedBytes
    && ownerCount > 0
    && ownerCount === verifiedOwnerCount
    && caseBindingFailures === 0
    && spanBindingFailures === 0
    && partitionFailures === 0
    && ownerNodeFailures === 0
    && ownerDigestFailures === 0
    && orphanLeafOwnerCount === 0
    && declaredGapCount === 0
    && declaredOverlapCount === 0
    && declaredCompletionFailures === 0;
  return Object.freeze({
    covered_case_count: ledgers.length,
    expected_case_count: inputs.cases.length,
    ledger_count: ledgerCount,
    expected_ledger_count: expectedLedgerCount,
    expected_selected_byte_count: expectedSelectedBytes,
    recomputed_selected_byte_count: recomputedSelectedBytes,
    owner_count: ownerCount,
    verified_owner_count: verifiedOwnerCount,
    case_binding_failure_count: caseBindingFailures,
    span_binding_failure_count: spanBindingFailures,
    partition_failure_count: partitionFailures,
    owner_node_failure_count: ownerNodeFailures,
    owner_digest_failure_count: ownerDigestFailures,
    orphan_leaf_owner_count: orphanLeafOwnerCount,
    declared_gap_count: declaredGapCount,
    declared_overlap_count: declaredOverlapCount,
    declared_completion_failure_count: declaredCompletionFailures,
    proof_digest: contentId('STAGE_2Y_STRUCTURE_DECISION_BYTE_PROOF/V1', perSpanProofs),
    complete,
  });
}

const REQUIRED_CHAPEAU_FACT_TYPES = Object.freeze({
  CONCHO_6_9_A: Object.freeze({ limb_count: 4, direct_type_counts: Object.freeze({
    TIME_SCOPE: 1, ACTOR: 1, MODAL: 1, GOVERNING_PREDICATE: 1,
    PREDICATE_COMPLEMENT: 1, OBJECT: 1,
  }) }),
  TOPBUILD_6_2: Object.freeze({ limb_count: 4, direct_type_counts: Object.freeze({
    OBJECT: 1, MODAL: 1, GOVERNING_PREDICATE: 1, TIME_SCOPE: 1,
    RIGHT_HOLDER: 1, LIST_CONNECTIVE: 1,
  }) }),
  TOPBUILD_6_3: Object.freeze({ limb_count: 2, direct_type_counts: Object.freeze({
    OBJECT: 2, MODAL: 2, GOVERNING_PREDICATE: 2, TIME_SCOPE: 1,
    RIGHT_HOLDER: 1, LIST_CONNECTIVE: 1,
  }) }),
});

function inheritedProvenanceAssessment({
  contextFacts,
  agreementIndex,
  runtimeCases,
  inputs,
}) {
  const facts = Array.isArray(contextFacts.facts) ? contextFacts.facts : [];
  const scopes = Array.isArray(contextFacts.scope_edges) ? contextFacts.scope_edges : [];
  const factsById = new Map(facts.map((fact) => [fact.context_fact_id, fact]));
  const scopesById = new Map(scopes.map((edge) => [edge.scope_edge_id, edge]));
  const indexByCase = new Map((agreementIndex.cases || []).map((entry) => [entry.case_id, entry]));
  const runtimeByCase = new Map(runtimeCases.map((entry) => [entry.case_id, entry]));
  const expectedCaseIds = inputs.cases.map((entry) => entry.case_id);
  const suppliedCaseIds = (contextFacts.cases || []).map((entry) => entry.case_id);
  let verifiedFactCount = 0;
  let verifiedInheritedFactCount = 0;
  let verifiedScopeCount = 0;
  let factIdFailures = factsById.size === facts.length ? 0 : facts.length - factsById.size;
  let scopeIdFailures = scopesById.size === scopes.length ? 0 : scopes.length - scopesById.size;
  let sourceByteFailures = 0;
  let nodeBindingFailures = 0;
  let sourceContainmentFailures = 0;
  let sourceArtefactOverlapCount = 0;
  let relationshipFailures = 0;
  let caseLedgerFailures = suppliedCaseIds.join('\n') === expectedCaseIds.join('\n') ? 0 : 1;
  const nodeMaps = new Map();
  const sourceBytesByCase = new Map();
  for (const caseId of expectedCaseIds) {
    const indexCase = indexByCase.get(caseId);
    const runtime = runtimeByCase.get(caseId);
    if (!indexCase || !runtime || typeof runtime.canonical_text !== 'string') {
      nodeBindingFailures += 1;
      continue;
    }
    nodeMaps.set(caseId, new Map(indexCase.nodes.map((node) => [node.node_occurrence_id, node])));
    sourceBytesByCase.set(caseId, Buffer.from(runtime.canonical_text, 'utf8'));
  }
  for (const edge of scopes) {
    const nodes = nodeMaps.get(edge.case_id);
    const bytes = sourceBytesByCase.get(edge.case_id);
    const sourceNode = nodes?.get(edge.source_node_id);
    const targets = (edge.target_node_ids || []).map((id) => nodes?.get(id));
    const payload = {
      case_id: edge.case_id,
      edge_type: edge.edge_type,
      source_node_id: edge.source_node_id,
      target_node_ids: edge.target_node_ids,
      support: edge.support,
      rule_id: edge.rule_id,
      rule_version: edge.rule_version,
    };
    const edgeIdValid = edge.scope_edge_id
      === contentId('STAGE_2Y_STRUCTURE_SCOPE_EDGE/V1', payload);
    if (!edgeIdValid) scopeIdFailures += 1;
    const supportDigest = bytes && Number.isInteger(edge.support?.start_byte)
      && Number.isInteger(edge.support?.end_byte)
      ? sha256Hex(bytes.subarray(edge.support.start_byte, edge.support.end_byte)) : null;
    const edgeByteValid = supportDigest === edge.support?.text_sha256;
    if (!edgeByteValid) sourceByteFailures += 1;
    const edgeNodeValid = Boolean(sourceNode && targets.length > 0 && targets.every(Boolean));
    if (!edgeNodeValid) {
      nodeBindingFailures += 1;
    }
    const edgeContainmentValid = edgeNodeValid
      && sourceNode.extent_span.start_byte <= edge.support.start_byte
      && sourceNode.extent_span.end_byte >= edge.support.end_byte;
    if (edgeNodeValid && !edgeContainmentValid) {
      sourceContainmentFailures += 1;
    }
    const edgeStatusValid = edge.status === 'RESOLVED'
      && canonicalJson(edge.uncertainty) === canonicalJson({
        status: 'NONE', reason_codes: [], alternatives: [],
      });
    const edgeTypeValid = ['DIRECT_AT', 'GOVERNS', 'QUALIFIES', 'EXCEPTS']
      .includes(edge.edge_type);
    if (!edgeStatusValid || !edgeTypeValid) relationshipFailures += 1;
    if (edgeIdValid && edgeByteValid && edgeNodeValid && edgeContainmentValid
      && edgeStatusValid && edgeTypeValid) verifiedScopeCount += 1;
  }
  for (const fact of facts) {
    const nodes = nodeMaps.get(fact.case_id);
    const bytes = sourceBytesByCase.get(fact.case_id);
    const sourceNode = nodes?.get(fact.governing_source_node_id);
    const targetNode = nodes?.get(fact.target_node_id);
    const scope = scopesById.get(fact.scope_edge_id);
    const sourceSpanPayload = {
      start_byte: fact.source_span?.start_byte,
      end_byte: fact.source_span?.end_byte,
      text_sha256: fact.source_span?.text_sha256,
    };
    const payload = {
      case_id: fact.case_id,
      fact_type: fact.fact_type,
      value: fact.value,
      status: fact.status,
      target_node_id: fact.target_node_id,
      governing_source_node_id: fact.governing_source_node_id,
      source_span: sourceSpanPayload,
      scope_edge_id: fact.scope_edge_id,
      rule_id: fact.rule_id,
      rule_version: fact.rule_version,
    };
    const factIdValid = fact.context_fact_id
      === contentId('STAGE_2Y_STRUCTURE_CONTEXT_FACT/V1', payload);
    if (!factIdValid) factIdFailures += 1;
    const quote = bytes && Number.isInteger(sourceSpanPayload.start_byte)
      && Number.isInteger(sourceSpanPayload.end_byte)
      ? bytes.subarray(sourceSpanPayload.start_byte, sourceSpanPayload.end_byte).toString('utf8') : null;
    const quoteDigest = quote === null ? null : sha256Hex(Buffer.from(quote, 'utf8'));
    const factByteValid = fact.source_span?.coordinate_system
        === 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      && fact.source_span?.quote === quote
      && quoteDigest === sourceSpanPayload.text_sha256
      && fact.quote_sha256 === sourceSpanPayload.text_sha256;
    if (!factByteValid) {
      sourceByteFailures += 1;
    }
    const factNodeValid = Boolean(sourceNode && targetNode && scope);
    if (!factNodeValid) nodeBindingFailures += 1;
    const factContainmentValid = Boolean(sourceNode
      && sourceNode.extent_span.start_byte <= sourceSpanPayload.start_byte
      && sourceNode.extent_span.end_byte >= sourceSpanPayload.end_byte);
    if (sourceNode && !factContainmentValid) {
      sourceContainmentFailures += 1;
    }
    const artefactOverlap = [...(nodes?.values() || [])].some((node) =>
      node.node_kind === 'SOURCE_ARTEFACT'
        && node.extent_span.start_byte < sourceSpanPayload.end_byte
        && node.extent_span.end_byte > sourceSpanPayload.start_byte);
    if (artefactOverlap) sourceArtefactOverlapCount += 1;
    const directValid = fact.status === 'DIRECT'
      ? fact.governing_source_node_id === fact.target_node_id
      : fact.status === 'INHERITED'
        && fact.governing_source_node_id !== fact.target_node_id;
    const relationValid = scope
      && scope.case_id === fact.case_id
      && scope.source_node_id === fact.governing_source_node_id
      && (scope.target_node_ids || []).includes(fact.target_node_id)
      && canonicalJson(scope.support) === canonicalJson(sourceSpanPayload)
      && canonicalJson(fact.relationship_path) === canonicalJson([
        fact.governing_source_node_id, scope.edge_type, fact.target_node_id,
      ])
      && fact.inheritance === fact.status
      && fact.confidence === 'DETERMINISTIC_SOURCE_PROOF'
      && fact.resolution_status === 'RESOLVED'
      && canonicalJson(fact.uncertainty) === canonicalJson({
        status: 'NONE', reason_codes: [], alternatives: [],
      });
    if (!directValid || !relationValid) relationshipFailures += 1;
    const factValid = factIdValid && factByteValid && factNodeValid
      && factContainmentValid && !artefactOverlap && directValid && relationValid;
    if (factValid) {
      verifiedFactCount += 1;
      if (fact.status === 'INHERITED') verifiedInheritedFactCount += 1;
    }
  }
  for (const [ledgerIndex, ledger] of (contextFacts.cases || []).entries()) {
    const frozen = inputs.cases[ledgerIndex];
    const expectedFacts = facts.filter((fact) => fact.case_id === ledger.case_id)
      .map((fact) => fact.context_fact_id).sort();
    const expectedScopes = scopes.filter((edge) => edge.case_id === ledger.case_id)
      .map((edge) => edge.scope_edge_id).sort();
    if (ledger.case_id !== frozen?.case_id
      || ledger.set !== frozen?.set
      || canonicalJson(ledger.fact_ids) !== canonicalJson(expectedFacts)
      || canonicalJson(ledger.scope_edge_ids) !== canonicalJson(expectedScopes)) {
      caseLedgerFailures += 1;
    }
  }
  let verifiedDirectGoverningFacts = 0;
  let verifiedInheritedDeliveries = 0;
  let coveredInheritanceCases = 0;
  const chapeauProofs = [];
  for (const [caseId, requirement] of Object.entries(REQUIRED_CHAPEAU_FACT_TYPES)) {
    const nodes = [...(nodeMaps.get(caseId)?.values() || [])];
    const chapeaux = nodes.filter((node) => node.node_kind === 'CHAPEAU');
    const chapeau = chapeaux.length === 1 ? chapeaux[0] : null;
    const limbs = chapeau ? nodes.filter((node) => node.node_kind === 'LIMB'
      && node.parent_node_occurrence_id === chapeau.parent_node_occurrence_id) : [];
    let caseComplete = Boolean(chapeau && limbs.length === requirement.limb_count);
    const factProofs = [];
    for (const [factType, expectedCount] of Object.entries(requirement.direct_type_counts)) {
      const direct = facts.filter((fact) => fact.case_id === caseId
        && fact.fact_type === factType
        && fact.status === 'DIRECT'
        && fact.target_node_id === chapeau?.node_occurrence_id
        && fact.governing_source_node_id === chapeau?.node_occurrence_id);
      if (direct.length !== expectedCount) caseComplete = false;
      verifiedDirectGoverningFacts += direct.length === expectedCount ? direct.length : 0;
      for (const sourceFact of direct) {
        const inherited = facts.filter((fact) => fact.case_id === caseId
          && fact.fact_type === sourceFact.fact_type
          && fact.status === 'INHERITED'
          && fact.governing_source_node_id === sourceFact.governing_source_node_id
          && canonicalJson(fact.value) === canonicalJson(sourceFact.value)
          && canonicalJson(fact.source_span) === canonicalJson(sourceFact.source_span));
        const inheritedTargets = inherited.map((fact) => fact.target_node_id).sort();
        const expectedTargets = limbs.map((node) => node.node_occurrence_id).sort();
        if (canonicalJson(inheritedTargets) !== canonicalJson(expectedTargets)
          || inherited.some((fact) =>
            scopesById.get(fact.scope_edge_id)?.edge_type !== 'GOVERNS')) {
          caseComplete = false;
        }
        else verifiedInheritedDeliveries += inheritedTargets.length;
        factProofs.push({
          context_fact_id: sourceFact.context_fact_id,
          inherited_target_node_ids: inheritedTargets,
        });
      }
    }
    if (caseComplete) coveredInheritanceCases += 1;
    chapeauProofs.push({ case_id: caseId, complete: caseComplete, facts: factProofs });
  }
  let qualificationNodeCount = 0;
  let verifiedQualificationNodeCount = 0;
  let siblingScopeLeakCount = 0;
  const qualificationProofs = [];
  for (const caseId of expectedCaseIds) {
    const nodes = [...(nodeMaps.get(caseId)?.values() || [])];
    for (const node of nodes.filter((entry) => entry.node_kind === 'QUALIFICATION')) {
      qualificationNodeCount += 1;
      const parent = node.parent_node_occurrence_id;
      const parentNode = nodeMaps.get(caseId)?.get(parent);
      const edges = scopes.filter((edge) => edge.case_id === caseId
        && edge.source_node_id === node.node_occurrence_id);
      const localFacts = facts.filter((fact) => fact.case_id === caseId
        && fact.governing_source_node_id === node.node_occurrence_id);
      const valid = parentNode?.node_kind === 'LIMB'
        && edges.length > 0
        && localFacts.length > 0
        && edges.every((edge) => ['QUALIFIES', 'EXCEPTS'].includes(edge.edge_type)
          && canonicalJson(edge.target_node_ids) === canonicalJson([parent]))
        && localFacts.every((fact) => fact.target_node_id === parent);
      if (valid) verifiedQualificationNodeCount += 1;
      else siblingScopeLeakCount += 1;
      qualificationProofs.push({
        case_id: caseId,
        qualification_node_id: node.node_occurrence_id,
        parent_node_id: parent,
        scope_edge_ids: edges.map((edge) => edge.scope_edge_id).sort(),
        complete: valid,
      });
    }
  }
  let verifiedLocalDirectFacts = 0;
  const topbuild63Nodes = [...(nodeMaps.get('TOPBUILD_6_3')?.values() || [])];
  const topbuild63Chapeau = topbuild63Nodes.find((node) => node.node_kind === 'CHAPEAU');
  const topbuild63Limbs = topbuild63Nodes.filter((node) => node.node_kind === 'LIMB'
    && node.parent_node_occurrence_id === topbuild63Chapeau?.parent_node_occurrence_id);
  const cureFacts = facts.filter((fact) => fact.case_id === 'TOPBUILD_6_3'
    && fact.fact_type === 'CURE_CONDITION' && fact.status === 'DIRECT');
  if (cureFacts.length === 2
    && topbuild63Limbs.length === 2
    && canonicalJson(cureFacts.map((fact) => fact.target_node_id).sort())
      === canonicalJson(topbuild63Limbs.map((node) => node.node_occurrence_id).sort())) {
    verifiedLocalDirectFacts += 2;
  }
  const metseraNodes = [...(nodeMaps.get('METSERA_7_04')?.values() || [])]
    .filter((node) => node.node_kind === 'SENTENCE');
  const metseraTypes = ['ACTOR', 'MODAL', 'NEGATION', 'GOVERNING_PREDICATE',
    'CAUSATION_STANDARD', 'BREACH_STANDARD'];
  if (metseraNodes.length === 2) {
    for (const node of metseraNodes) {
      for (const factType of metseraTypes) {
        const matching = facts.filter((fact) => fact.case_id === 'METSERA_7_04'
          && fact.target_node_id === node.node_occurrence_id
          && fact.governing_source_node_id === node.node_occurrence_id
          && fact.status === 'DIRECT' && fact.fact_type === factType);
        if (matching.length === 1) verifiedLocalDirectFacts += 1;
      }
    }
  }
  const inheritedFacts = facts.filter((fact) => fact.status === 'INHERITED');
  const requiredDirectCount = 21;
  const requiredInheritedDeliveryCount = 66;
  const requiredLocalDirectFactCount = 14;
  const proof = {
    fact_ids: [...factsById.keys()].sort(),
    scope_edge_ids: [...scopesById.keys()].sort(),
    chapeau_closure: chapeauProofs,
    qualification_locality: qualificationProofs,
    verified_local_direct_fact_count: verifiedLocalDirectFacts,
  };
  const complete = suppliedCaseIds.join('\n') === expectedCaseIds.join('\n')
    && contextFacts.fact_count === facts.length
    && contextFacts.inherited_fact_count === inheritedFacts.length
    && contextFacts.scope_edge_count === scopes.length
    && verifiedFactCount === facts.length
    && verifiedInheritedFactCount === inheritedFacts.length
    && verifiedScopeCount === scopes.length
    && factIdFailures === 0
    && scopeIdFailures === 0
    && sourceByteFailures === 0
    && nodeBindingFailures === 0
    && sourceContainmentFailures === 0
    && sourceArtefactOverlapCount === 0
    && relationshipFailures === 0
    && caseLedgerFailures === 0
    && coveredInheritanceCases === Object.keys(REQUIRED_CHAPEAU_FACT_TYPES).length
    && verifiedDirectGoverningFacts === requiredDirectCount
    && verifiedInheritedDeliveries === requiredInheritedDeliveryCount
    && qualificationNodeCount > 0
    && verifiedQualificationNodeCount === qualificationNodeCount
    && siblingScopeLeakCount === 0
    && verifiedLocalDirectFacts === requiredLocalDirectFactCount;
  return Object.freeze({
    covered_case_count: suppliedCaseIds.length,
    expected_case_count: expectedCaseIds.length,
    fact_count: facts.length,
    verified_fact_count: verifiedFactCount,
    inherited_fact_count: inheritedFacts.length,
    verified_inherited_fact_count: verifiedInheritedFactCount,
    scope_edge_count: scopes.length,
    verified_scope_edge_count: verifiedScopeCount,
    fact_id_failure_count: factIdFailures,
    scope_id_failure_count: scopeIdFailures,
    source_byte_failure_count: sourceByteFailures,
    node_binding_failure_count: nodeBindingFailures,
    source_containment_failure_count: sourceContainmentFailures,
    source_artefact_overlap_count: sourceArtefactOverlapCount,
    relationship_failure_count: relationshipFailures,
    case_ledger_failure_count: caseLedgerFailures,
    required_inheritance_case_count: Object.keys(REQUIRED_CHAPEAU_FACT_TYPES).length,
    covered_inheritance_case_count: coveredInheritanceCases,
    required_direct_governing_fact_count: requiredDirectCount,
    verified_direct_governing_fact_count: verifiedDirectGoverningFacts,
    required_inherited_delivery_count: requiredInheritedDeliveryCount,
    verified_inherited_delivery_count: verifiedInheritedDeliveries,
    qualification_node_count: qualificationNodeCount,
    verified_qualification_node_count: verifiedQualificationNodeCount,
    sibling_scope_leak_count: siblingScopeLeakCount,
    required_local_direct_fact_count: requiredLocalDirectFactCount,
    verified_local_direct_fact_count: verifiedLocalDirectFacts,
    proof_digest: contentId('STAGE_2Y_STRUCTURE_DECISION_CONTEXT_PROOF/V1', proof),
    complete,
  });
}

function requireCount(value, field) {
  if (!Number.isInteger(value) || value < 0) fail(`${field} is missing or invalid`);
  return value;
}

function requireDigest(value, field) {
  if (!/^[0-9a-f]{64}$/.test(value || '')) fail(`${field} is not sha256`);
  return value;
}

function exactList(actual, expected, field) {
  if (!Array.isArray(actual)
    || actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) {
    fail(`${field} drift`);
  }
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

function expectedRowDifferences(expectedRows, currentRows) {
  const expectedByClaim = new Map(expectedRows.map((row) => [row.claim_revision_id, row]));
  const currentByClaim = new Map(currentRows.map((row) => [row.claim_revision_id, row]));
  const differences = [];
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
  return differences;
}

function recordCoverageFromPayloads(expectedRecords, mappedRecords) {
  const expected = new Map(expectedRecords.map((record) => [record.linkage_key, record]));
  const mapped = new Map(mappedRecords.map((record) => [record.linkage_key, record]));
  if (expected.size !== expectedRecords.length || mapped.size !== mappedRecords.length) {
    fail('current-record coverage payload contains duplicate linkage keys');
  }
  const missing = [...expected.keys()].filter((key) => !mapped.has(key)).sort();
  const unexpected = [...mapped.keys()].filter((key) => !expected.has(key)).sort();
  const identityMismatches = [];
  const stateMismatches = [];
  const valueMismatches = [];
  for (const [key, expectedRecord] of expected) {
    const actual = mapped.get(key);
    if (!actual) continue;
    if (canonicalJson({
      claim_occurrence_id: actual.claim_occurrence_id,
      claim_revision_id: actual.claim_revision_id,
      closure_id: actual.closure_id,
      claim_definition_key: actual.claim_definition_key,
    }) !== canonicalJson({
      claim_occurrence_id: expectedRecord.claim_occurrence_id,
      claim_revision_id: expectedRecord.claim_revision_id,
      closure_id: expectedRecord.closure_id,
      claim_definition_key: expectedRecord.claim_definition_key,
    })) {
      identityMismatches.push({
        linkage_key: key,
        expected_claim_occurrence_id: expectedRecord.claim_occurrence_id,
        mapped_claim_occurrence_id: actual.claim_occurrence_id,
        expected_claim_revision_id: expectedRecord.claim_revision_id,
        mapped_claim_revision_id: actual.claim_revision_id,
        expected_closure_id: expectedRecord.closure_id,
        mapped_closure_id: actual.closure_id,
        expected_claim_definition_key: expectedRecord.claim_definition_key,
        mapped_claim_definition_key: actual.claim_definition_key,
      });
    }
    if (actual.current_state !== expectedRecord.current_state) {
      stateMismatches.push({
        linkage_key: key,
        expected_state: expectedRecord.current_state,
        mapped_state: actual.current_state,
      });
    }
    if (canonicalJson({ raw_value: actual.raw_value, canonical_value: actual.canonical_value })
      !== canonicalJson({
        raw_value: expectedRecord.raw_value,
        canonical_value: expectedRecord.canonical_value,
      })) {
      valueMismatches.push({
        linkage_key: key,
        expected_raw_value: expectedRecord.raw_value,
        mapped_raw_value: actual.raw_value,
        expected_canonical_value: expectedRecord.canonical_value,
        mapped_canonical_value: actual.canonical_value,
      });
    }
  }
  return {
    missing,
    unexpected,
    identityMismatches,
    stateMismatches,
    valueMismatches,
  };
}

function evidenceCoverageFromRecords(records) {
  const spans = new Map();
  for (const record of records) {
    if (record.adapter_residual) continue;
    for (const stage of semanticRecordStages(record)) {
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
  const evidenceSpans = [...spans.values()]
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const unlinkedEvidenceSpans = evidenceSpans.filter((entry) => {
    const record = records.find((candidate) => candidate.linkage_key === entry.linkage_key);
    return !semanticRecordStages(record || {}).some((stage) => (stage?.evidence || []).some((evidence) =>
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
  return { evidenceSpans, unlinkedEvidenceSpans };
}

function semanticRecordStages(record) {
  return [record.proposal, record.resolution, record.open_world,
    ...(record.reviews || []), record.write_set, record.validation];
}

function claimSourceCoverageFromRecords({ caseId, records, nodes, aliases }) {
  const byId = new Map(nodes.map((node) => [node.node_occurrence_id, node]));
  if (byId.size !== nodes.length) fail(`${caseId} contains duplicate source node identifiers`);
  const currentEndpoints = new Set();
  const shadowEndpoints = new Set();
  const validAliases = aliases.map((alias) => {
    const target = byId.get(alias.shadow_node_occurrence_id);
    const currentEndpoint = `${alias.case_id}\0${alias.current_node_id}`;
    const shadowEndpoint = `${alias.case_id}\0${alias.shadow_node_occurrence_id}`;
    if (alias.case_id !== caseId
      || alias.cardinality !== 'ONE_TO_ONE'
      || !target
      || target.structure_revision_id !== alias.shadow_structure_revision_id
      || !(target.current_section_ids || []).includes(alias.current_node_id)
      || currentEndpoints.has(currentEndpoint)
      || shadowEndpoints.has(shadowEndpoint)) {
      fail(`${caseId} current-to-shadow alias does not bind the final source index`);
    }
    currentEndpoints.add(currentEndpoint);
    shadowEndpoints.add(shadowEndpoint);
    return { alias, target };
  });
  const claimRecords = records.filter((record) => !record.adapter_residual);
  for (const record of claimRecords) {
    const expectedMappings = semanticRecordStages(record).filter(Boolean)
      .flatMap((stage) => (stage.evidence || []).map((evidence) => {
        const span = evidence.document_span;
        const deepestId = evidence.source_nodes?.deepest_node_occurrence_id || null;
        const containingIds = [...new Set(
          evidence.source_nodes?.containing_node_occurrence_ids || [],
        )].sort();
        const deepest = byId.get(deepestId);
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
          && deepest
          && !hasContainingDescendant
          && deepest.extent_span.start_byte <= span.start
          && deepest.extent_span.end_byte >= span.end
          && containingIds.every((id) => {
            const node = byId.get(id);
            return node
              && node.extent_span.start_byte <= span.start
              && node.extent_span.end_byte >= span.end;
          });
        const selected = (sourceLinksValid ? validAliases : [])
          .filter(({ target }) => target.extent_span.start_byte <= span.start
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
          })[0];
        return {
          evidence_stage: stage.stage,
          claim_evidence_id: evidence.claim_evidence_id,
          excerpt_id: evidence.excerpt_id,
          evidence_role: evidence.evidence_role,
          document_span: JSON.parse(JSON.stringify(span)),
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
      }))
      .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
    const expected = {
      evidence_count: expectedMappings.length,
      evidence_without_source_node_links: expectedMappings.filter((entry) =>
        entry.source_links_valid === false).length,
      evidence_without_alias_paths: expectedMappings.filter((entry) =>
        entry.alias_path === null).length,
      source_node_occurrence_ids: [...new Set(expectedMappings
        .filter((entry) => entry.source_links_valid)
        .flatMap((entry) => entry.containing_source_node_occurrence_ids))].sort(),
      alias_paths: expectedMappings.filter((entry) => entry.alias_path !== null),
    };
    if (canonicalJson(record.claim_source_mapping) !== canonicalJson(expected)) {
      fail(`${caseId}:${record.linkage_key} claim source mapping drift`);
    }
  }
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
      'STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_SET/V1', payload),
  };
}

function mappedRowsFromRecords(records, runDirectory) {
  return records
    .filter((record) => record.resolution && record.current_projection?.status === 'ROW_EMITTED')
    .map((record) => ({
      claim_revision_id: record.resolution.claim_revision_id,
      run_directory: runDirectory,
      full_output_signature: record.current_projection.full_output_signature,
      row_id: record.current_projection.matching_row?.id || null,
      section_id: record.current_projection.section?.id || null,
    }))
    .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
}

function semanticAssessment(
  semanticMapping,
  sourceToRowDiff,
  inputs,
  control,
  referenceEdges,
  agreementIndex,
  nodeAliases,
) {
  const summary = semanticMapping.summary || {};
  const diffSummary = sourceToRowDiff.summary || {};

  const expectedCases = inputs.cases || [];
  const suppliedCases = semanticMapping.cases || [];
  exactList(suppliedCases.map((entry) => entry.case_id),
    expectedCases.map((entry) => entry.case_id), 'semantic case order');
  if (new Set(suppliedCases.map((entry) => entry.case_id)).size !== suppliedCases.length) {
    fail('semantic cases contain duplicate identifiers');
  }

  const decisionInputs = expectedCases.filter((entry) => entry.set === 'DECISION');
  const confirmationInputs = expectedCases.filter((entry) => entry.set === 'CONFIRMATION');
  const decisionCases = suppliedCases.filter((entry) => entry.set === 'DECISION');
  const confirmationCases = suppliedCases.filter((entry) => entry.set === 'CONFIRMATION');
  exactList(decisionCases.map((entry) => entry.case_id),
    decisionInputs.map((entry) => entry.case_id), 'semantic decision cases');
  exactList(confirmationCases.map((entry) => entry.case_id),
    confirmationInputs.map((entry) => entry.case_id), 'semantic confirmation cases');
  if (confirmationCases.some((entry) => entry.status !== 'CONFIRMATION_METADATA_ONLY')) {
    fail('confirmation semantic scope drift');
  }

  const baselinePath = resolve(REPO_ROOT, control.baseline_manifest.path);
  if (fileDigest(baselinePath) !== control.baseline_manifest.sha256) {
    fail('baseline manifest binding drift during cohort reconstruction');
  }
  const baseline = readJson(baselinePath);
  if (baseline.schema_version !== 'STAGE_2Y_CD_BASELINE_MANIFEST/V1'
    || baseline.manifest_id !== control.baseline_manifest.manifest_id
    || baseline.runs?.length !== 130) {
    fail('frozen 130-run baseline manifest drift');
  }
  const cohortDirectories = new Set(baseline.runs.map((entry) => entry.directory));
  const baselineByDirectory = new Map(baseline.runs.map((entry) => [entry.directory, entry]));
  const currentMeasurementPath = resolve(REPO_ROOT, control.current_measurement_binding.path);
  if (fileDigest(currentMeasurementPath) !== control.current_measurement_binding.sha256) {
    fail('current measurement binding drift during frozen-row reconstruction');
  }
  const frozenRowsByClaim = frozenProjectionIndex(readJson(currentMeasurementPath));
  const inputByCase = new Map(decisionInputs.map((entry) => [entry.case_id, entry]));
  const sourceCaseById = new Map((agreementIndex.cases || [])
    .map((entry) => [entry.case_id, entry]));
  const aliasesByCase = new Map(decisionInputs.map((entry) => [
    entry.case_id,
    (nodeAliases.aliases || []).filter((alias) => alias.case_id === entry.case_id),
  ]));
  if ((nodeAliases.collisions || []).length !== 0) fail('node alias collisions are not permitted');
  const decisionRuns = [];
  for (const entry of decisionCases) {
    const frozen = inputByCase.get(entry.case_id);
    if (!frozen || !Array.isArray(entry.runs)) fail(`semantic runs missing for ${entry.case_id}`);
    exactList(entry.runs.map((run) => run.run_directory), frozen.run_directories,
      `${entry.case_id} run order`);
    if (new Set(entry.runs.map((run) => run.run_directory)).size !== entry.runs.length) {
      fail(`${entry.case_id} contains duplicate run directories`);
    }
    for (const run of entry.runs) {
      const expectedMembership = cohortDirectories.has(run.run_directory);
      if (run.frozen_cohort_member !== expectedMembership) {
        fail(`${entry.case_id}:${run.run_directory} frozen cohort membership drift`);
      }
      const cohortEvidence = run.frozen_cohort_membership_evidence;
      if (cohortEvidence?.membership_rule
          !== 'RUN_DIRECTORY_EXACT_MATCH_IN_BOUND_130_RUN_BASELINE_MANIFEST'
        || cohortEvidence?.selected_run_directory !== run.run_directory
        || cohortEvidence?.member !== expectedMembership
        || canonicalJson(cohortEvidence?.baseline_manifest_binding)
          !== canonicalJson(control.baseline_manifest)
        || canonicalJson(cohortEvidence?.matched_baseline_run_entry)
          !== canonicalJson(baselineByDirectory.get(run.run_directory) || null)) {
        fail(`${entry.case_id}:${run.run_directory} cohort membership evidence drift`);
      }
      if (!Array.isArray(run.records)) fail(`${entry.case_id}:${run.run_directory} records missing`);

      const recordCoverage = run.current_record_coverage || {};
      if (!Array.isArray(recordCoverage.expected_records)
        || !Array.isArray(recordCoverage.mapped_records)) {
        fail(`${entry.case_id}:${run.run_directory} current-record oracle payloads missing`);
      }
      const coverage = recordCoverageFromPayloads(
        recordCoverage.expected_records,
        recordCoverage.mapped_records,
      );
      const expectedRecordChecks = {
        expected_record_count: recordCoverage.expected_records.length,
        mapped_record_count: recordCoverage.mapped_records.length,
        missing_record_count: coverage.missing.length,
        unexpected_record_count: coverage.unexpected.length,
        identity_mismatch_count: coverage.identityMismatches.length,
        state_mismatch_count: coverage.stateMismatches.length,
        value_mismatch_count: coverage.valueMismatches.length,
      };
      for (const [field, value] of Object.entries(expectedRecordChecks)) {
        if (recordCoverage[field] !== value) {
          fail(`${entry.case_id}:${run.run_directory} ${field} does not equal its payload`);
        }
      }
      for (const [field, value] of Object.entries({
        missing_linkage_keys: coverage.missing,
        unexpected_linkage_keys: coverage.unexpected,
        identity_mismatches: coverage.identityMismatches,
        state_mismatches: coverage.stateMismatches,
        value_mismatches: coverage.valueMismatches,
      })) {
        if (canonicalJson(recordCoverage[field]) !== canonicalJson(value)) {
          fail(`${entry.case_id}:${run.run_directory} ${field} drift`);
        }
      }
      const expectedRecordDigest = contentId(
        'STAGE_2Y_EXPECTED_CURRENT_RECORD_SET/V1',
        recordCoverage.expected_records,
      );
      const mappedRecordDigest = contentId(
        'STAGE_2Y_MAPPED_CURRENT_RECORD_SET/V1',
        recordCoverage.mapped_records,
      );
      if (recordCoverage.expected_records_digest !== expectedRecordDigest
        || recordCoverage.mapped_records_digest !== mappedRecordDigest) {
        fail(`${entry.case_id}:${run.run_directory} current-record child digest drift`);
      }

      const evidenceCoverage = run.evidence_coverage || {};
      if (!Array.isArray(evidenceCoverage.evidence_spans)
        || !Array.isArray(evidenceCoverage.unlinked_evidence_spans)) {
        fail(`${entry.case_id}:${run.run_directory} evidence oracle payloads missing`);
      }
      const recomputedEvidence = evidenceCoverageFromRecords(run.records);
      if (canonicalJson(evidenceCoverage.evidence_spans)
          !== canonicalJson(recomputedEvidence.evidenceSpans)
        || canonicalJson(evidenceCoverage.unlinked_evidence_spans)
          !== canonicalJson(recomputedEvidence.unlinkedEvidenceSpans)
        || evidenceCoverage.evidence_span_count !== recomputedEvidence.evidenceSpans.length
        || evidenceCoverage.evidence_spans_without_source_node_links
          !== recomputedEvidence.unlinkedEvidenceSpans.length
        || evidenceCoverage.evidence_span_set_digest !== contentId(
          'STAGE_2Y_MAPPED_EVIDENCE_SPAN_SET/V1',
          recomputedEvidence.evidenceSpans,
        )) {
        fail(`${entry.case_id}:${run.run_directory} evidence coverage drift`);
      }

      const sourceCase = sourceCaseById.get(entry.case_id);
      if (!sourceCase || !Array.isArray(sourceCase.nodes)) {
        fail(`${entry.case_id} source-index case is missing`);
      }
      const claimCoverage = claimSourceCoverageFromRecords({
        caseId: entry.case_id,
        records: run.records,
        nodes: sourceCase.nodes,
        aliases: aliasesByCase.get(entry.case_id) || [],
      });
      if (canonicalJson(run.claim_source_coverage) !== canonicalJson(claimCoverage)) {
        fail(`${entry.case_id}:${run.run_directory} claim source coverage drift`);
      }

      const rows = run.frozen_row_comparison || {};
      if (!Array.isArray(rows.expected_frozen_rows)
        || !Array.isArray(rows.mapped_current_rows)
        || !Array.isArray(rows.differences)) {
        fail(`${entry.case_id}:${run.run_directory} frozen-row oracle payloads missing`);
      }
      const expectedResolvedClaims = recordCoverage.expected_records
        .filter((record) => record.current_state === 'RESOLVED' && record.claim_revision_id)
        .map((record) => record.claim_revision_id);
      const expectedResolvedClaimIds = new Set(expectedResolvedClaims);
      if (expectedResolvedClaimIds.size !== expectedResolvedClaims.length) {
        fail(`${entry.case_id}:${run.run_directory} duplicate expected resolved claim revision`);
      }
      const expectedRows = expectedMembership
        ? [...frozenRowsByClaim.values()]
          .filter((row) => row.run_directory === run.run_directory
            && expectedResolvedClaimIds.has(row.claim_revision_id))
          .sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id))
        : [];
      const currentRows = expectedMembership
        ? mappedRowsFromRecords(run.records, run.run_directory)
        : [];
      const differences = expectedRowDifferences(expectedRows, currentRows);
      const changed = differences.filter((value) =>
        value.difference === 'CHANGED_ROW_SIGNATURE').length;
      const missing = differences.filter((value) =>
        value.difference === 'MISSING_FROZEN_ROW').length;
      const added = differences.filter((value) => value.difference === 'NEW_ROW').length;
      const unchanged = expectedRows.length - changed - missing;
      const expectedStatus = expectedMembership
        ? differences.length === 0 ? 'UNCHANGED' : 'CHANGED'
        : 'NOT_IN_FROZEN_COHORT';
      if (canonicalJson(rows.expected_frozen_rows) !== canonicalJson(expectedRows)
        || canonicalJson(rows.mapped_current_rows) !== canonicalJson(currentRows)
        || canonicalJson(rows.differences) !== canonicalJson(differences)
        || rows.status !== expectedStatus
        || rows.expected_frozen_row_count !== expectedRows.length
        || rows.mapped_current_row_count !== currentRows.length
        || rows.unchanged_row_count !== unchanged
        || rows.changed_signature_count !== changed
        || rows.missing_frozen_row_count !== missing
        || rows.new_row_count !== added
        || rows.expected_frozen_rows_digest !== contentId(
          'STAGE_2Y_EXPECTED_FROZEN_ROW_SET/V1', expectedRows)
        || rows.mapped_current_rows_digest !== contentId(
          'STAGE_2Y_MAPPED_CURRENT_ROW_SET/V1', currentRows)) {
        fail(`${entry.case_id}:${run.run_directory} frozen-row comparison drift`);
      }
      decisionRuns.push({ case_id: entry.case_id, run });
    }
  }
  if (decisionRuns.length !== 7) fail('the fixed decision scope must contain seven selected runs');
  const selectedCohortRuns = decisionRuns.filter(({ run }) => run.frozen_cohort_member);
  if (selectedCohortRuns.length !== 5) fail('the fixed decision scope must contain five baseline-cohort runs');
  const selectedCohortDirectories = [...new Set(selectedCohortRuns
    .map(({ run }) => run.run_directory))].sort();
  if (!selectedCohortDirectories.includes('concho-key-defined-terms-20260809-2xk-final')) {
    fail('Concho key-defined-terms baseline cohort run is absent');
  }

  const sum = (read) => decisionRuns.reduce((total, entry) => total + read(entry.run), 0);
  const recomputed = {
    case_count: suppliedCases.length,
    decision_case_count: decisionCases.length,
    confirmation_metadata_case_count: confirmationCases.length,
    semantic_record_count: sum((run) => run.records.length),
    expected_selected_current_record_count: sum((run) =>
      requireCount(run.current_record_coverage?.expected_record_count,
        `${run.run_directory}.expected_record_count`)),
    mapped_selected_current_record_count: sum((run) =>
      requireCount(run.current_record_coverage?.mapped_record_count,
        `${run.run_directory}.mapped_record_count`)),
    missing_current_record_count: sum((run) =>
      requireCount(run.current_record_coverage?.missing_record_count,
        `${run.run_directory}.missing_record_count`)),
    unexpected_mapped_record_count: sum((run) =>
      requireCount(run.current_record_coverage?.unexpected_record_count,
        `${run.run_directory}.unexpected_record_count`)),
    identity_mismatch_count: sum((run) =>
      requireCount(run.current_record_coverage?.identity_mismatch_count,
        `${run.run_directory}.identity_mismatch_count`)),
    state_mismatch_count: sum((run) =>
      requireCount(run.current_record_coverage?.state_mismatch_count,
        `${run.run_directory}.state_mismatch_count`)),
    value_mismatch_count: sum((run) =>
      requireCount(run.current_record_coverage?.value_mismatch_count,
        `${run.run_directory}.value_mismatch_count`)),
    evidence_span_count: sum((run) =>
      requireCount(run.evidence_coverage?.evidence_span_count,
        `${run.run_directory}.evidence_span_count`)),
    evidence_spans_without_source_node_links: sum((run) =>
      requireCount(run.evidence_coverage?.evidence_spans_without_source_node_links,
        `${run.run_directory}.evidence_spans_without_source_node_links`)),
    current_claim_record_count: sum((run) =>
      requireCount(run.claim_source_coverage?.current_claim_record_count,
        `${run.run_directory}.current_claim_record_count`)),
    current_claim_records_without_evidence: sum((run) =>
      requireCount(run.claim_source_coverage?.current_claim_records_without_evidence,
        `${run.run_directory}.current_claim_records_without_evidence`)),
    current_claim_records_without_source_node_links: sum((run) =>
      requireCount(run.claim_source_coverage?.current_claim_records_without_source_node_links,
        `${run.run_directory}.current_claim_records_without_source_node_links`)),
    current_claim_records_without_alias_paths: sum((run) =>
      requireCount(run.claim_source_coverage?.current_claim_records_without_alias_paths,
        `${run.run_directory}.current_claim_records_without_alias_paths`)),
  };
  recomputed.unexpected_state_changes = recomputed.missing_current_record_count
    + recomputed.unexpected_mapped_record_count
    + recomputed.identity_mismatch_count
    + recomputed.state_mismatch_count;
  recomputed.unexpected_value_changes = recomputed.value_mismatch_count;
  for (const [field, value] of Object.entries(recomputed)) {
    requireCount(summary[field], `semantic summary ${field}`);
    if (summary[field] !== value) fail(`semantic summary ${field} does not equal its child records`);
  }

  const semanticDigests = {
    expected_current_records_digest: contentId('STAGE_2Y_EXPECTED_CURRENT_RECORD_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        digest: requireDigest(run.current_record_coverage.expected_records_digest,
          `${run.run_directory}.expected_records_digest`),
      }))),
    mapped_current_records_digest: contentId('STAGE_2Y_MAPPED_CURRENT_RECORD_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        digest: requireDigest(run.current_record_coverage.mapped_records_digest,
          `${run.run_directory}.mapped_records_digest`),
      }))),
    evidence_span_coverage_digest: contentId('STAGE_2Y_MAPPED_EVIDENCE_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        digest: requireDigest(run.evidence_coverage.evidence_span_set_digest,
          `${run.run_directory}.evidence_span_set_digest`),
      }))),
    claim_source_mapping_digest: contentId(
      'STAGE_2Y_CURRENT_CLAIM_SOURCE_MAPPING_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        digest: requireDigest(run.claim_source_coverage.claim_source_mapping_digest,
          `${run.run_directory}.claim_source_mapping_digest`),
      }))),
  };
  for (const [field, digest] of Object.entries(semanticDigests)) {
    requireDigest(summary[field], `semantic summary ${field}`);
    if (summary[field] !== digest) fail(`semantic summary ${field} does not bind its child records`);
  }
  if (summary.selected_decision_run_count !== decisionRuns.length
    || summary.selected_baseline_cohort_run_count !== selectedCohortRuns.length) {
    fail('semantic selected-run cohort totals drift');
  }
  exactList(summary.selected_baseline_cohort_run_directories,
    selectedCohortDirectories, 'semantic selected baseline cohort directories');
  const cohortEvidenceDigest = contentId(
    'STAGE_2Y_SELECTED_BASELINE_COHORT_MEMBERSHIP/V1',
    decisionRuns.map(({ case_id: caseId, run }) => ({
      case_id: caseId,
      run_directory: run.run_directory,
      evidence: run.frozen_cohort_membership_evidence,
    })),
  );
  requireDigest(summary.baseline_cohort_membership_evidence_digest,
    'semantic summary baseline_cohort_membership_evidence_digest');
  if (summary.baseline_cohort_membership_evidence_digest !== cohortEvidenceDigest) {
    fail('semantic cohort membership digest does not bind its child evidence');
  }

  const records = Array.isArray(sourceToRowDiff.records) ? sourceToRowDiff.records : [];
  const findings = Array.isArray(sourceToRowDiff.decision_case_findings)
    ? sourceToRowDiff.decision_case_findings : [];
  exactList(findings.map((entry) => entry.case_id),
    decisionInputs.map((entry) => entry.case_id), 'decision finding cases');
  const qualifyingLossCases = findings
    .filter((entry) => entry.material_resolved_information_loss?.qualifies === true)
    .map((entry) => entry.case_id);
  exactList(qualifyingLossCases, ['TOPBUILD_6_2', 'METSERA_7_04'],
    'material resolved information-loss cases');

  const semanticRecordById = new Map();
  for (const { run } of decisionRuns) {
    for (const record of run.records) {
      if (semanticRecordById.has(record.semantic_record_id)) {
        fail(`duplicate semantic record id: ${record.semantic_record_id}`);
      }
      semanticRecordById.set(record.semantic_record_id, record);
    }
  }
  const topbuildFinding = findings.find((entry) => entry.case_id === 'TOPBUILD_6_2');
  const topbuildAnchors = (topbuildFinding?.restraint_claim_ids || [])
    .map((recordId) => semanticRecordById.get(recordId));
  const topbuildResolutionPartySpans = topbuildAnchors
    .filter((record) => record?.resolution?.party_source_span).length;
  const topbuildWriteSetPartySpans = topbuildAnchors
    .filter((record) => record?.write_set?.party_source_span).length;
  const topbuildQualifies = topbuildAnchors.length === 2
    && topbuildAnchors.every((record) => record
      && (record.current_state === 'RESOLVED'
        || record.current_projection?.status === 'ROW_EMITTED'))
    && topbuildResolutionPartySpans > topbuildWriteSetPartySpans;
  if (topbuildFinding?.resolution_party_source_span_count !== topbuildResolutionPartySpans
    || topbuildFinding?.write_set_party_source_span_count !== topbuildWriteSetPartySpans
    || topbuildFinding?.material_resolved_information_loss?.qualifies !== topbuildQualifies
    || canonicalJson(topbuildFinding?.material_resolved_information_loss?.measured_loss)
      !== canonicalJson({
        resolution_party_source_span_count: topbuildResolutionPartySpans,
        write_set_party_source_span_count: topbuildWriteSetPartySpans,
      })) {
    fail('TopBuild material resolved information-loss finding drift');
  }

  const metseraFinding = findings.find((entry) => entry.case_id === 'METSERA_7_04');
  const metseraRecord = semanticRecordById.get(metseraFinding?.semantic_record_id);
  const metseraSourceReferences = (referenceEdges.edges || []).filter((edge) =>
    edge.case_id === 'METSERA_7_04' && edge.edge_type === 'SECTION_REFERENCE').length;
  const metseraCurrentReferences = (metseraRecord?.resolution?.attributes
    ?.explicit_clause_cross_references || []).length
    || (metseraRecord?.resolution?.attributes?.explicit_clause_cross_reference ? 1 : 0);
  const metseraRowId = metseraRecord?.current_projection?.matching_row?.id || null;
  const metseraQualifies = Boolean(metseraRecord
    && (metseraRecord.current_state === 'RESOLVED'
      || metseraRecord.current_projection?.status === 'ROW_EMITTED')
    && metseraSourceReferences > metseraCurrentReferences);
  if (metseraFinding?.source_reference_occurrence_count !== metseraSourceReferences
    || metseraFinding?.current_explicit_cross_reference_count !== metseraCurrentReferences
    || metseraFinding?.row_id !== metseraRowId
    || metseraFinding?.material_resolved_information_loss?.qualifies !== metseraQualifies
    || canonicalJson(metseraFinding?.material_resolved_information_loss?.measured_loss)
      !== canonicalJson({
        source_reference_occurrence_count: metseraSourceReferences,
        current_explicit_cross_reference_count: metseraCurrentReferences,
        emitted_row_id: metseraRowId,
      })) {
    fail('Metsera material resolved information-loss finding drift');
  }

  const semanticRecordKeys = decisionRuns.flatMap(({ case_id: caseId, run }) =>
    run.records.map((record) => `${caseId}\0${run.run_directory}\0${record.semantic_record_id}`)).sort();
  const diffRecordKeys = records.map((record) =>
    `${record.case_id}\0${record.run_directory}\0${record.semantic_record_id}`).sort();
  if (new Set(diffRecordKeys).size !== diffRecordKeys.length
    || canonicalJson(diffRecordKeys) !== canonicalJson(semanticRecordKeys)) {
    fail('source-to-row records do not map one-to-one to semantic records');
  }
  const semanticByCompositeKey = new Map(decisionRuns.flatMap(({ case_id: caseId, run }) =>
    run.records.map((record) => [
      `${caseId}\0${run.run_directory}\0${record.semantic_record_id}`,
      record,
    ])));
  for (const diffRecord of records) {
    const key = `${diffRecord.case_id}\0${diffRecord.run_directory}\0${diffRecord.semantic_record_id}`;
    const semanticRecord = semanticByCompositeKey.get(key);
    const expectedSourceNodeIds = semanticRecord?.adapter_residual
      ? [] : semanticRecord?.claim_source_mapping?.source_node_occurrence_ids;
    if (!Array.isArray(diffRecord.source_node_occurrence_ids)
      || canonicalJson(diffRecord.source_node_occurrence_ids)
        !== canonicalJson(expectedSourceNodeIds)) {
      fail(`source-to-row source-node mapping drift: ${key}`);
    }
  }

  const rowCounts = {
    record_count: records.length,
    row_emitted: records.filter((entry) => entry.outcome === 'ROW_EMITTED').length,
    information_loss_records: records.filter((entry) =>
      ['OMITTED', 'UNRESOLVED', 'NO_ROUTE', 'RENDER_FAILURE'].includes(entry.outcome)).length,
    material_resolved_information_loss_case_count: qualifyingLossCases.length,
    expected_frozen_row_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.expected_frozen_row_count,
        `${run.run_directory}.expected_frozen_row_count`)),
    mapped_current_row_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.mapped_current_row_count,
        `${run.run_directory}.mapped_current_row_count`)),
    unchanged_frozen_row_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.unchanged_row_count,
        `${run.run_directory}.unchanged_row_count`)),
    changed_row_signature_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.changed_signature_count,
        `${run.run_directory}.changed_signature_count`)),
    missing_frozen_row_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.missing_frozen_row_count,
        `${run.run_directory}.missing_frozen_row_count`)),
    new_row_count: sum((run) =>
      requireCount(run.frozen_row_comparison?.new_row_count,
        `${run.run_directory}.new_row_count`)),
  };
  rowCounts.old_rows_changed = rowCounts.changed_row_signature_count
    + rowCounts.missing_frozen_row_count + rowCounts.new_row_count;
  for (const [field, value] of Object.entries(rowCounts)) {
    requireCount(diffSummary[field], `source-to-row summary ${field}`);
    if (diffSummary[field] !== value) fail(`source-to-row summary ${field} does not equal its child records`);
  }
  if (rowCounts.record_count !== recomputed.semantic_record_count) {
    fail('source-to-row record coverage does not equal semantic record coverage');
  }
  const outcomeCounts = Object.fromEntries([...new Set(records.map((entry) => entry.outcome))]
    .sort().map((outcome) => [outcome, records.filter((entry) => entry.outcome === outcome).length]));
  if (canonicalJson(diffSummary.outcomes) !== canonicalJson(outcomeCounts)) {
    fail('source-to-row outcome summary does not equal its records');
  }

  const rowDigests = {
    expected_frozen_rows_digest: contentId('STAGE_2Y_EXPECTED_FROZEN_ROW_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        cohort_member: run.frozen_cohort_member,
        digest: requireDigest(run.frozen_row_comparison.expected_frozen_rows_digest,
          `${run.run_directory}.expected_frozen_rows_digest`),
      }))),
    mapped_current_rows_digest: contentId('STAGE_2Y_MAPPED_CURRENT_ROW_COVERAGE/V1',
      decisionRuns.map(({ case_id: caseId, run }) => ({
        case_id: caseId,
        run_directory: run.run_directory,
        cohort_member: run.frozen_cohort_member,
        digest: requireDigest(run.frozen_row_comparison.mapped_current_rows_digest,
          `${run.run_directory}.mapped_current_rows_digest`),
      }))),
  };
  for (const [field, digest] of Object.entries(rowDigests)) {
    requireDigest(diffSummary[field], `source-to-row summary ${field}`);
    if (diffSummary[field] !== digest) fail(`source-to-row summary ${field} does not bind its child rows`);
  }

  return Object.freeze({
    mapped_case_count: recomputed.case_count,
    mapped_decision_case_count: recomputed.decision_case_count,
    confirmation_metadata_case_count: recomputed.confirmation_metadata_case_count,
    expected_selected_current_record_count: recomputed.expected_selected_current_record_count,
    mapped_selected_current_record_count: recomputed.mapped_selected_current_record_count,
    missing_current_record_count: recomputed.missing_current_record_count,
    unexpected_mapped_record_count: recomputed.unexpected_mapped_record_count,
    identity_mismatch_count: recomputed.identity_mismatch_count,
    state_mismatch_count: recomputed.state_mismatch_count,
    value_mismatch_count: recomputed.value_mismatch_count,
    evidence_span_count: recomputed.evidence_span_count,
    evidence_spans_without_source_node_links: recomputed.evidence_spans_without_source_node_links,
    current_claim_record_count: recomputed.current_claim_record_count,
    current_claim_records_without_evidence:
      recomputed.current_claim_records_without_evidence,
    current_claim_records_without_source_node_links:
      recomputed.current_claim_records_without_source_node_links,
    current_claim_records_without_alias_paths:
      recomputed.current_claim_records_without_alias_paths,
    expected_frozen_row_count: rowCounts.expected_frozen_row_count,
    mapped_current_row_count: rowCounts.mapped_current_row_count,
    unchanged_frozen_row_count: rowCounts.unchanged_frozen_row_count,
    changed_row_signature_count: rowCounts.changed_row_signature_count,
    missing_frozen_row_count: rowCounts.missing_frozen_row_count,
    new_row_count: rowCounts.new_row_count,
    old_rows_changed: rowCounts.old_rows_changed,
    information_loss_records: rowCounts.information_loss_records,
    material_resolved_information_loss_case_count:
      rowCounts.material_resolved_information_loss_case_count,
    cohort_membership_reconstructed: true,
    selected_decision_run_count: decisionRuns.length,
    selected_baseline_cohort_run_count: selectedCohortRuns.length,
    selected_baseline_cohort_run_directories: selectedCohortDirectories,
    baseline_cohort_membership_evidence_digest: cohortEvidenceDigest,
  });
}

function buildDecision({
  byteAssessment,
  contextAssessment,
  semanticAssessment: semantics,
  structureAlternatives,
}) {
  const legalAlternatives = (structureAlternatives.alternatives || [])
    .filter((entry) => entry.status === 'REQUIRES_BEN_LEGAL_JUDGEMENT');
  if (legalAlternatives.length !== 1
    || legalAlternatives[0].case_id !== 'REDHAT_3_01_3_02'
    || legalAlternatives[0].selected_alternative !== null) {
    fail('Red Hat legal parentage alternative is not recorded as unresolved');
  }
  const acceptance = Object.freeze({
    selected_byte_ownership_complete: byteAssessment.complete,
    inherited_context_has_exact_provenance: contextAssessment.complete,
    all_five_decision_cases_mapped: semantics.mapped_case_count === 9
      && semantics.mapped_decision_case_count === 5
      && semantics.confirmation_metadata_case_count === 4,
    current_claim_identities_states_and_values_preserved:
      semantics.expected_selected_current_record_count > 0
      && semantics.mapped_selected_current_record_count
        === semantics.expected_selected_current_record_count
      && semantics.missing_current_record_count === 0
      && semantics.unexpected_mapped_record_count === 0
      && semantics.identity_mismatch_count === 0
      && semantics.state_mismatch_count === 0
      && semantics.value_mismatch_count === 0,
    current_evidence_spans_linked_to_source_nodes: semantics.evidence_span_count > 0
      && semantics.evidence_spans_without_source_node_links === 0,
    all_current_claims_map_to_source_nodes: semantics.current_claim_record_count > 0
      && semantics.current_claim_record_count
        === semantics.expected_selected_current_record_count
      && semantics.current_claim_records_without_evidence === 0
      && semantics.current_claim_records_without_source_node_links === 0,
    aliases_preserve_current_claim_links: semantics.current_claim_record_count > 0
      && semantics.current_claim_records_without_alias_paths === 0,
    frozen_rows_preserved_in_both_directions: semantics.expected_frozen_row_count > 0
      && semantics.mapped_current_row_count === semantics.expected_frozen_row_count
      && semantics.unchanged_frozen_row_count === semantics.expected_frozen_row_count
      && semantics.changed_row_signature_count === 0
      && semantics.missing_frozen_row_count === 0
      && semantics.new_row_count === 0
      && semantics.old_rows_changed === 0,
    frozen_cohort_membership_reconstructed: semantics.cohort_membership_reconstructed
      && semantics.selected_decision_run_count === 7
      && semantics.selected_baseline_cohort_run_count === 5
      && semantics.selected_baseline_cohort_run_directories
        .includes('concho-key-defined-terms-20260809-2xk-final'),
    material_resolved_information_loss_exposed:
      semantics.material_resolved_information_loss_case_count === 2,
    unresolved_legal_parentage_is_typed_not_selected: legalAlternatives.length === 1,
  });
  const allPassed = Object.values(acceptance).every(Boolean);
  const unsignedDecisionPayload = Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_PROTOTYPE_DECISION/V1',
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
    stage: 'M1',
    base_commit: M1_BASE_COMMIT,
    proposed_decision: allPassed
      ? 'INCREMENTAL_RESTRUCTURE'
      : 'STOP_NEEDS_NEW_ARCH_REVIEW',
    basis: allPassed
      ? 'A shared source-index and provenanced-context seam is required before claim resolution. Current claim and row identities can be preserved through aliases.'
      : 'One or more falsification conditions failed. M2 is not authorised.',
    assessments: {
      byte_ownership: byteAssessment,
      inherited_context: contextAssessment,
      semantic_equivalence: semantics,
    },
    acceptance,
    legal_review: {
      status: 'REQUIRED_BEN_LEGAL_JUDGEMENT',
      reviewer: null,
      m2_blocking: false,
      required_before: 'PARENTAGE_SELECTION_OR_LEGAL_SCOPE_CHANGE',
      alternative_group_ids: legalAlternatives.map((entry) => entry.alternative_group_id),
      questions: legalAlternatives.map((entry) => entry.question),
      selected_alternatives: legalAlternatives.map((entry) => entry.selected_alternative),
    },
    m2_authorised: false,
    publication_authorisation: 'NONE',
  });
  const unsignedDecisionPayloadDigest = contentId(
    'STAGE_2Y_STRUCTURE_M1_UNSIGNED_DECISION/V1',
    unsignedDecisionPayload,
  );
  return Object.freeze({
    ...unsignedDecisionPayload,
    technical_review: {
      status: 'PENDING_SOL_REVIEW',
      reviewer: null,
      review_evidence_path: repositoryPath(SOL_REVIEW_PATH),
      unsigned_decision_payload_digest: unsignedDecisionPayloadDigest,
    },
  });
}

function buildReceipt({ control, outputBindings, shadowDigest }) {
  const currentReport = readJson(resolve(REPO_ROOT, control.current_measurement_binding.path));
  const byFamily = currentReport.current?.by_family || [];
  const openWorld = new Map(byFamily.map((entry) => [entry.family, entry.open_world]));
  const familyKeys = readJson(resolve(MIGRATION_ROOT, 'control/family-keys.json')).family_keys;
  const orderedOutputBindings = Object.entries(outputBindings).map(([name, binding]) => ({
    name,
    path: binding.path,
    schema_version: OUTPUT_SCHEMAS[name],
    byte_length: binding.byte_length,
    sha256: binding.sha256,
  }));
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
    packet_id: 'stage-2y-structure-m1-falsification-prototype',
    stage: 'M1',
    base_commit: M1_BASE_COMMIT,
    input_digests: {
      control_manifest: fileDigest(EXPECTED_CONTROL),
      prototype_inputs: fileDigest(EXPECTED_INPUTS),
      m0_receipt: fileDigest(M0_RECEIPT_PATH),
    },
    changed_files: [
      'scripts/stage-2y-structure-prototype.mjs',
      'scripts/lib/stage-2y-structure-source-prototype.mjs',
      'scripts/lib/stage-2y-structure-context-prototype.mjs',
      'scripts/lib/stage-2y-structure-semantic-prototype.mjs',
      'scripts/stage-2y-structure-m1-finalise.mjs',
      'scripts/stage-2y-structure-migration-validate.mjs',
      'tests/stage-2y-structure-prototype.test.js',
      ...Object.values(outputBindings).map((binding) => binding.path),
      repositoryPath(SOL_REVIEW_PATH),
      repositoryPath(RECEIPT_PATH),
    ],
    focused_checks: [
      { check: 'PROTOTYPE_INTERNAL_ASSERTIONS', result: 'PASS' },
      { check: 'PROTOTYPE_OUTPUT_SCHEMA', result: 'PASS' },
      { check: 'STAGE_2Y_STRUCTURE_PROTOTYPE_TEST', result: 'NOT_RUN' },
      { check: 'STRUCTURE_AND_INHERITANCE_GATE', result: 'NOT_RUN' },
      { check: 'TERMINATION_INHERITANCE_ADDITION', result: 'NOT_RUN' },
      { check: 'SOL_TECHNICAL_REVIEW', result: 'NOT_RUN' },
    ],
    model_calls: 0,
    phase_b_route_calls: 0,
    product_writes: 0,
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    database_target: 'NONE',
    release_receipts_created: 0,
    internal_cutover_authorisation: 'NONE',
    current_selector_changes: 0,
    publication_authorisation: 'NONE',
    serving_changes: 0,
    old_result_digest: control.current_measurement_binding.sha256,
    new_shadow_result_digest: shadowDigest,
    draft_output_bindings: orderedOutputBindings,
    draft_output_set_digest: contentId(
      'STAGE_2Y_STRUCTURE_M1_FINAL_OUTPUT_SET/V1',
      orderedOutputBindings,
    ),
    output_bindings: null,
    output_set_digest: null,
    technical_review_binding: null,
    expected_differences: [],
    unexpected_differences: [],
    open_world_by_family: Object.fromEntries(
      familyKeys.map((family) => [family, openWorld.get(family) || 0]),
    ),
    rollback_command: 'git revert --no-edit <M1_COMMIT_SHA>',
    rollback_result: 'NOT_RUN_REPORT_ONLY_NO_SELECTOR_OR_PRODUCT_EFFECT',
    status: 'STOPPED',
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const control = readJson(args.control);
  const inputs = readJson(args.inputs);
  assertControl(control, inputs, args);

  const sourcePrototype = await buildSourcePrototype({
    repoRoot: REPO_ROOT,
    control,
    inputs,
  });
  const contextPrototype = await buildContextPrototype({
    repoRoot: REPO_ROOT,
    control,
    inputs,
    sourcePrototype,
  });
  const semanticPrototype = await buildSemanticPrototype({
    repoRoot: REPO_ROOT,
    control,
    inputs,
    sourcePrototype,
    contextPrototype,
  });

  const byteAssessment = byteOwnershipAssessment({
    byteOwnership: sourcePrototype.byteOwnership,
    agreementIndex: sourcePrototype.agreementIndex,
    runtimeCases: sourcePrototype.runtime_cases,
    inputs,
  });
  const contextAssessment = inheritedProvenanceAssessment({
    contextFacts: contextPrototype.contextFacts,
    agreementIndex: sourcePrototype.agreementIndex,
    runtimeCases: sourcePrototype.runtime_cases,
    inputs,
  });
  const semantics = semanticAssessment(
    semanticPrototype.semanticMapping,
    semanticPrototype.sourceToRowDiff,
    inputs,
    control,
    contextPrototype.referenceEdges,
    sourcePrototype.agreementIndex,
    sourcePrototype.nodeAliases,
  );
  const decision = buildDecision({
    byteAssessment,
    contextAssessment,
    semanticAssessment: semantics,
    structureAlternatives: sourcePrototype.structureAlternatives,
  });

  const outputs = Object.freeze({
    'agreement-index.json': sourcePrototype.agreementIndex,
    'byte-ownership.json': sourcePrototype.byteOwnership,
    'node-aliases.json': sourcePrototype.nodeAliases,
    'structure-alternatives.json': sourcePrototype.structureAlternatives,
    'reference-edges.json': contextPrototype.referenceEdges,
    'context-facts.json': contextPrototype.contextFacts,
    'current-semantic-mapping.json': semanticPrototype.semanticMapping,
    'source-to-row-diff.json': semanticPrototype.sourceToRowDiff,
    'decision.json': decision,
  });
  for (const [name, schema] of Object.entries(OUTPUT_SCHEMAS)) {
    if (outputs[name]?.schema_version !== schema) fail(`${name} schema drift`);
  }
  const outputBindings = Object.fromEntries(
    Object.entries(outputs).map(([name, value]) => [
      name,
      name === 'decision.json'
        ? writeReviewPendingDraft(resolve(args.outputRoot, name), value)
        : writeSealed(resolve(args.outputRoot, name), value),
    ]),
  );
  const shadowDigest = valueDigest(
    Object.fromEntries(Object.entries(outputs).filter(([name]) => name !== 'decision.json')),
  );
  writeReviewPendingDraft(
    RECEIPT_PATH,
    buildReceipt({ control, outputBindings, shadowDigest }),
  );

  process.stdout.write(`${canonicalJson({
    status: decision.proposed_decision,
    decision_review: decision.technical_review.status,
    output_count: Object.keys(outputBindings).length,
    byte_ownership: byteAssessment,
    inherited_context: contextAssessment,
    semantic_equivalence: semantics,
    shadow_digest: shadowDigest,
  })}\n`);
}

await main();
