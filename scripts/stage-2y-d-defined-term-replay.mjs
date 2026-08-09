#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { sha256Hex, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { buildSemanticSpan } = require('../lib/canonical-v2/source-structure');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  OUTCOMES,
  FINAL_CORPUS_DEFINED_TERM_BINDINGS,
  FINAL_CORPUS_DEFINED_TERM_CALIBRATION,
  buildFinalCorpusSameDealDefinedTermIndex,
  resolveSameDealDefinedTerm,
} = require('../lib/canonical-v2/native-producer/same-deal-defined-term-resolution');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-d-defined-term-replay.json');
const EXPECTED_BY_DEAL = Object.freeze({ concho: 23, metsera: 21, redhat: 11, skechers: 14, skywater: 13, topbuild: 9 });
const EXPECTED_TOTAL = 91;
const EXPECTED_DEFINITION_OUTCOMES = Object.freeze({ NO_DEFINITION: 21, RESOLVED: 70 });
const EXPECTED_INTEGRATION_DISPOSITIONS = Object.freeze({ RESOLVED: 80, REVIEW: 11 });
const EXPECTED_AFTER_EVIDENCE_REPAIR = Object.freeze({
  counts_by_definition_outcome: Object.freeze({ NO_DEFINITION: 3, RESOLVED: 88 }),
  counts_by_resolver_disposition: Object.freeze({ RESOLVED: 75, REVIEW: 16 }),
});
const CONTRACT = compileFixtureContractV38();
const KNOWLEDGE_STANDARD_CODES = new Set(['ACTUAL', 'CONSTRUCTIVE', 'AFTER_INQUIRY']);
const INTEGRATION_REASONS = Object.freeze({
  KNOWLEDGE_STANDARD_CONFLICT: 'REPRESENTATION_KNOWLEDGE_STANDARD_CONFLICT',
});
const RUNS = Object.freeze([
  ['concho', 'concho-representations-r1a-20260809-2xk-final'],
  ['concho', 'concho-representations-r1b-20260809-2xk-final'],
  ['concho', 'concho-representations-r1c-20260809-2xk-final'],
  ['concho', 'concho-representations-r1d-20260809-2xk-final'],
  ['metsera', 'metsera-representations-r1a-20260809-2xk-final'],
  ['metsera', 'metsera-representations-r1b-20260809-2xk-final'],
  ['metsera', 'metsera-representations-r1c-20260809-2xk-final'],
  ['redhat', 'redhat-representations-20260809-2xk-final'],
  ['skechers', 'skechers-representations-r1b-20260809-2xk-final'],
  ['skechers', 'skechers-representations-r1c-20260809-2xk-final'],
  ['skechers', 'skechers-representations-r1d-20260809-2xk-final'],
  ['skywater', 'skywater-representations-r1b-20260809-2xk-final'],
  ['skywater', 'skywater-representations-r1d-20260809-2xk-final'],
  ['topbuild', 'topbuild-representations-20260809-2xk-r3-final'],
]);
const DEFINITION_GAP_SOURCE_PROOF = Object.freeze({
  skywater: Object.freeze({
    start: 'When used in this Agreement, “knowledge” means',
    end: 'set forth on Section 10.14 of the Parent Disclosure Schedules.',
    expected_codes: Object.freeze({ TARGET: 'ACTUAL', BUYER: 'ACTUAL' }),
  }),
  topbuild: Object.freeze({
    start: 'The term “Knowledge,” when used in this Agreement',
    end: 'after due inquiry of such person’s direct reports.',
    expected_codes: Object.freeze({ TARGET: 'AFTER_INQUIRY', BUYER: 'AFTER_INQUIRY' }),
  }),
});

function assertion(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function relativePath(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function runPath(name, file) {
  const path = resolve(ROOT, 'evidence/canonical-v2', name, file);
  assertion(existsSync(path), `missing artefact: ${relativePath(path)}`);
  return path;
}

function loadRun(name) {
  const directory = resolve(ROOT, 'evidence/canonical-v2', name);
  return Object.freeze({
    name,
    directory,
    receipt: readJson(runPath(name, 'run-receipt.json')),
    resolution: readJson(runPath(name, 'resolution.json')),
    adapter: readJson(runPath(name, 'adapter-result.json')),
    manifest: readJson(runPath(name, 'run-manifest.json')),
  });
}

function sourceFor(run) {
  const sources = run.adapter.admitted_source_contexts;
  assertion(Array.isArray(sources) && sources.length === 1, `${run.name}: expected one admitted source`);
  const source = sources[0];
  assertion(typeof source?.canonical_text?.text === 'string', `${run.name}: canonical source text missing`);
  assertion(source.document_hash === run.receipt.document_hash, `${run.name}: admitted source document hash mismatch`);
  return source;
}

function definitionGapSourceProof(deal, source) {
  const spec = DEFINITION_GAP_SOURCE_PROOF[deal];
  assertion(spec, `no source-proof specification for ${deal}`);
  const text = source.canonical_text.text;
  const characterStart = text.indexOf(spec.start);
  assertion(characterStart >= 0, `${deal}: definition source-proof start missing`);
  assertion(text.indexOf(spec.start, characterStart + 1) === -1, `${deal}: definition source-proof start is not unique`);
  const characterEndMarker = text.indexOf(spec.end, characterStart);
  assertion(characterEndMarker >= characterStart, `${deal}: definition source-proof end missing`);
  const characterEnd = characterEndMarker + spec.end.length;
  const quote = text.slice(characterStart, characterEnd);
  const documentStart = Buffer.byteLength(text.slice(0, characterStart), 'utf8');
  const documentEnd = documentStart + Buffer.byteLength(quote, 'utf8');
  return Object.freeze({
    document_hash: source.document_hash,
    document_byte_span: Object.freeze({ start: documentStart, end: documentEnd }),
    quote,
    exact_bytes_digest: sha256Hex(Buffer.from(quote, 'utf8')),
    expected_codes: spec.expected_codes,
    diagnostic_only_not_kdt_evidence: true,
  });
}

function sectionFor(receipt, reference, label) {
  const matches = (receipt.resolved_sections || []).filter((section) => section.section_reference === reference);
  assertion(matches.length === 1, `${label}: missing or duplicate section ${reference}`);
  return matches[0];
}

export function verifyEvidenceEdge({ source, section, edge, expectedRole = null, expectedQuote = null, label = 'evidence' }) {
  assertion(edge && typeof edge === 'object', `${label}: evidence missing`);
  assertion(!expectedRole || edge.evidence_role === expectedRole, `${label}: wrong evidence role`);
  assertion(typeof edge.claim_evidence_id === 'string' && edge.claim_evidence_id.length > 0, `${label}: claim evidence identity missing`);
  assertion(typeof edge.excerpt_id === 'string' && edge.excerpt_id.length > 0, `${label}: excerpt identity missing`);
  assertion(Number.isInteger(edge.absolute_start) && Number.isInteger(edge.absolute_end) && edge.absolute_end > edge.absolute_start,
    `${label}: invalid section-relative byte span`);
  assertion(Number.isInteger(section.start) && Number.isInteger(section.end), `${label}: section document span missing`);
  const documentStart = section.start + edge.absolute_start;
  const documentEnd = section.start + edge.absolute_end;
  assertion(documentStart >= section.start && documentEnd <= section.end, `${label}: evidence outside section`);
  const quote = utf8Slice(source.canonical_text.text, documentStart, documentEnd);
  assertion(expectedQuote == null || quote === expectedQuote, `${label}: stored quote does not re-slice from source`);
  const span = buildSemanticSpan(source, documentStart, documentEnd);
  const digest = sha256Hex(Buffer.from(quote, 'utf8'));
  assertion(span.exact_bytes_digest === digest, `${label}: semantic digest mismatch`);
  return Object.freeze({
    claim_evidence_id: edge.claim_evidence_id,
    excerpt_id: edge.excerpt_id,
    evidence_role: edge.evidence_role,
    section_relative_span: Object.freeze({ start: edge.absolute_start, end: edge.absolute_end }),
    document_byte_span: Object.freeze({ start: documentStart, end: documentEnd }),
    quote,
    exact_bytes_digest: digest,
    semantic_span_id: span.semantic_span_id,
  });
}

function useCandidateFor(receipt, row, label) {
  const evidenceId = row.evidence?.find((edge) => edge.evidence_role === 'OPERATIVE_TEXT')?.claim_evidence_id;
  assertion(typeof evidenceId === 'string', `${label}: OPERATIVE_TEXT use evidence missing`);
  const matches = (receipt.compiled_candidates || []).filter((entry) => {
    const claim = entry?.candidate?.claim;
    return entry?.ok === true
      && claim?.claim_definition_key === row.claim_definition_key
      && (claim.evidence || []).some((edge) => edge.claim_evidence_id === evidenceId);
  });
  assertion(matches.length === 1, `${label}: use candidate identity missing or ambiguous`);
  return matches[0];
}

function definitionClaimsFor(receipt, ids, label) {
  const wanted = new Set(ids);
  const matches = (receipt.compiled_candidates || []).filter((entry) => wanted.has(entry?.candidate?.claim?.claim_occurrence_id));
  assertion(matches.length === wanted.size, `${label}: selected definition claim missing or duplicate`);
  return matches.map((entry) => entry.candidate.claim).sort((left, right) => left.claim_occurrence_id.localeCompare(right.claim_occurrence_id));
}

function definitionSelection({ result, receipt, source, label }) {
  if (result.outcome !== OUTCOMES.RESOLVED) return Object.freeze([]);
  const claims = definitionClaimsFor(receipt, result.provenance.source_claim_occurrence_ids, label);
  const selected = [];
  for (const claim of claims) {
    const section = sectionFor(receipt, claim.attributes.section_reference, `${label}:${claim.claim_occurrence_id}`);
    const edges = claim.evidence || [];
    assertion(edges.length > 0, `${label}: selected definition evidence missing`);
    selected.push(Object.freeze({
      claim_occurrence_id: claim.claim_occurrence_id,
      section_reference: claim.attributes.section_reference,
      section_document_byte_span: Object.freeze({ start: section.start, end: section.end }),
      evidence: Object.freeze(edges.map((edge) => verifyEvidenceEdge({
        source, section, edge, label: `${label}:${claim.claim_occurrence_id}:${edge.claim_evidence_id}`,
      }))),
    }));
  }
  const expectedIds = [...result.provenance.definition_evidence_ids].sort();
  const actualIds = selected.flatMap((claim) => claim.evidence.map((edge) => edge.claim_evidence_id)).sort();
  assertion(JSON.stringify(actualIds) === JSON.stringify(expectedIds), `${label}: selected definition evidence identity drift`);
  return Object.freeze(selected);
}

function countBy(items, valueFor) {
  const counts = new Map();
  for (const item of items) {
    const value = valueFor(item);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function integrationDisposition({ definitionOutcome, effectiveCode, currentModelCode, label }) {
  if (definitionOutcome === OUTCOMES.RESOLVED) {
    if (effectiveCode !== currentModelCode) {
      return Object.freeze({
        disposition: 'REVIEW',
        reason: INTEGRATION_REASONS.KNOWLEDGE_STANDARD_CONFLICT,
        effective_code_source: 'SAME_DEAL_DEFINED_TERM',
      });
    }
    return Object.freeze({
      disposition: 'RESOLVED',
      reason: null,
      effective_code_source: 'SAME_DEAL_DEFINED_TERM',
    });
  }
  if (definitionOutcome === OUTCOMES.NO_DEFINITION) {
    assertion(KNOWLEDGE_STANDARD_CODES.has(currentModelCode), `${label}: NO_DEFINITION requires a registered current model code`);
    return Object.freeze({
      disposition: 'RESOLVED',
      reason: null,
      effective_code_source: 'REGISTERED_CURRENT_MODEL_FALLBACK',
    });
  }
  return Object.freeze({
    disposition: 'REVIEW',
    reason: `REPRESENTATION_DEFINED_TERM_${definitionOutcome}`,
    effective_code_source: null,
  });
}

function replayCandidateThroughResolver({ run, source, candidateEntry, index, label }) {
  const resolution = resolveCandidates({
    run_receipt: { ...run.receipt, compiled_candidates: [candidateEntry] },
    contract_vocabulary: CONTRACT,
    admitted_source_context: source,
    agreement_date: run.manifest.agreement_date,
    same_deal_defined_terms: index,
  });
  const held = resolution.review_queue.filter((entry) => entry.has_resolution === false);
  if (resolution.resolved.length === 1 && held.length === 0 && resolution.open_world.length === 0) {
    return Object.freeze({
      disposition: 'RESOLVED',
      reason: null,
      resolved_claim_definition_key: resolution.resolved[0].resolved_claim_definition_key,
      model_calls: 0,
    });
  }
  if (resolution.resolved.length === 0 && held.length === 1 && resolution.open_world.length === 0) {
    assertion(held[0].reasons.length === 1, `${label}: resolver replay returned multiple review reasons`);
    return Object.freeze({
      disposition: 'REVIEW',
      reason: held[0].reasons[0],
      resolved_claim_definition_key: null,
      model_calls: 0,
    });
  }
  throw new Error(`${label}: resolver replay did not produce one settled disposition: ${JSON.stringify({
    resolved: resolution.resolved.length,
    held: held.length,
    open_world: resolution.open_world.map((entry) => entry.reason),
  })}`);
}

function definitionGapClassification({ deal, side, definitionOutcome, modelCode }) {
  if (definitionOutcome !== OUTCOMES.NO_DEFINITION) return null;
  if (deal === 'skywater') {
    return Object.freeze({
      classification: 'FALSE_NO_DEFINITION_MISSING_KDT_EVIDENCE',
      expected_definition_code_after_evidence_repair: 'ACTUAL',
      expected_resolver_disposition_after_evidence_repair: modelCode === 'ACTUAL' ? 'RESOLVED' : 'REVIEW',
    });
  }
  if (deal === 'topbuild' && side === 'BUYER') {
    return Object.freeze({
      classification: 'FALSE_NO_DEFINITION_MISSING_KDT_EVIDENCE',
      expected_definition_code_after_evidence_repair: 'AFTER_INQUIRY',
      expected_resolver_disposition_after_evidence_repair: modelCode === 'AFTER_INQUIRY' ? 'RESOLVED' : 'REVIEW',
    });
  }
  assertion(deal === 'skechers' && side === 'BUYER', `unexpected true NO_DEFINITION fallback: ${deal}/${side}`);
  return Object.freeze({
    classification: 'TRUE_AGREEMENT_DEFINITION_ABSENCE',
    expected_definition_code_after_evidence_repair: null,
    expected_resolver_disposition_after_evidence_repair: 'RESOLVED',
  });
}

function buildLedgerRow({ deal, run, keyRun, index, keySource, row, resolutionIndex }) {
  const label = `${run.name}:open_world[${resolutionIndex}]`;
  assertion(row.reason === 'REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED', `${label}: wrong historical reason`);
  const source = sourceFor(run);
  assertion(source.document_hash === keySource.document_hash && source.document_hash === keyRun.receipt.document_hash,
    `${label}: representation and current final key-defined-term documents differ`);
  const candidateEntry = useCandidateFor(run.receipt, row, label);
  const claim = candidateEntry.candidate.claim;
  const section = sectionFor(run.receipt, row.section_reference, label);
  const useEdge = (row.evidence || []).filter((edge) => edge.evidence_role === 'OPERATIVE_TEXT');
  assertion(useEdge.length === 1, `${label}: expected exactly one OPERATIVE_TEXT use`);
  const use = verifyEvidenceEdge({ source, section, edge: useEdge[0], expectedRole: 'OPERATIVE_TEXT', label });
  const side = row.attributes?.representation_side;
  assertion(side === 'TARGET' || side === 'BUYER', `${label}: representation side missing`);
  const modelCode = row.canonical_value;
  assertion(typeof modelCode === 'string' && modelCode.length > 0, `${label}: current model code missing`);
  const result = resolveSameDealDefinedTerm({
    index,
    term_ref: 'Knowledge',
    use_party: side,
    requested_kind: 'KNOWLEDGE_STANDARD',
    use_evidence: row.evidence,
  });
  assertion(result.outcome !== OUTCOMES.INERT, `${label}: calibrated index became inert`);
  const selectedDefinitions = definitionSelection({ result, receipt: keyRun.receipt, source: keySource, label });
  const effectiveCode = result.outcome === OUTCOMES.RESOLVED ? result.value : modelCode;
  const expectedIntegration = integrationDisposition({
    definitionOutcome: result.outcome,
    effectiveCode,
    currentModelCode: modelCode,
    label,
  });
  const resolverReplay = replayCandidateThroughResolver({ run, source, candidateEntry, index, label });
  assertion(resolverReplay.disposition === expectedIntegration.disposition,
    `${label}: helper disposition ${expectedIntegration.disposition} disagrees with resolver ${resolverReplay.disposition}`);
  assertion(resolverReplay.reason === expectedIntegration.reason,
    `${label}: helper reason ${expectedIntegration.reason} disagrees with resolver ${resolverReplay.reason}`);
  const gapClassification = definitionGapClassification({
    deal,
    side,
    definitionOutcome: result.outcome,
    modelCode,
  });
  return Object.freeze({
    ledger_id: sha256Hex(`${run.name}\0${row.closure_id || claim.claim_occurrence_id}\0${use.claim_evidence_id}`),
    deal,
    representation_run: run.name,
    representation_run_receipt_id: run.receipt.run_receipt_id,
    document_hash: source.document_hash,
    section_reference: row.section_reference,
    representation_side: side,
    section_document_byte_span: Object.freeze({ start: section.start, end: section.end }),
    claim_occurrence_id: claim.claim_occurrence_id || null,
    closure_id: row.closure_id || null,
    use,
    definition_outcome: result.outcome,
    effective_code: effectiveCode,
    current_model_code: modelCode,
    integration_disposition: resolverReplay.disposition,
    integration_reason: resolverReplay.reason,
    effective_code_source: expectedIntegration.effective_code_source,
    resolver_replay: resolverReplay,
    definition_gap_classification: gapClassification,
    calibration_id: FINAL_CORPUS_DEFINED_TERM_CALIBRATION.calibration_id,
    selected_definition_claim_occurrence_ids: result.provenance?.source_claim_occurrence_ids || [],
    selected_definitions: selectedDefinitions,
    typed_absence_or_conflict: result.outcome === OUTCOMES.NO_DEFINITION
      ? Object.freeze({ type: OUTCOMES.NO_DEFINITION, requested_kind: 'KNOWLEDGE_STANDARD', requested_party: side })
      : result.outcome === OUTCOMES.RESOLVED ? null : Object.freeze({ type: result.outcome }),
  });
}

export function assertReplayIntegrity(replay, sourcesByDocumentHash) {
  assertion(Array.isArray(replay?.ledger_rows), 'ledger rows missing');
  assertion(replay.ledger_rows.length === EXPECTED_TOTAL, `ledger count drift: expected ${EXPECTED_TOTAL}, got ${replay.ledger_rows.length}`);
  for (const [deal, proof] of Object.entries(replay.definition_evidence_gap_report.source_proof_by_deal)) {
    const source = sourcesByDocumentHash.get(proof.document_hash);
    assertion(source, `${deal}: source proof has unknown document`);
    const quote = utf8Slice(source.canonical_text.text, proof.document_byte_span.start, proof.document_byte_span.end);
    assertion(quote === proof.quote, `${deal}: definition source-proof quote drift`);
    assertion(sha256Hex(Buffer.from(quote, 'utf8')) === proof.exact_bytes_digest, `${deal}: definition source-proof digest drift`);
    assertion(proof.diagnostic_only_not_kdt_evidence === true, `${deal}: source proof must remain diagnostic only`);
  }
  const useIds = new Set();
  for (const row of replay.ledger_rows) {
    assertion(typeof row.document_hash === 'string' && sourcesByDocumentHash.has(row.document_hash), `unknown document for ${row.ledger_id}`);
    assertion(typeof row.claim_occurrence_id === 'string' || typeof row.closure_id === 'string', `missing use identity for ${row.ledger_id}`);
    const useIdentity = `${row.representation_run}\0${row.claim_occurrence_id || row.closure_id}\0${row.use.claim_evidence_id}`;
    assertion(!useIds.has(useIdentity), `duplicate use: ${useIdentity}`);
    useIds.add(useIdentity);
    const source = sourcesByDocumentHash.get(row.document_hash);
    assertion(row.use.section_relative_span.start >= 0
      && row.use.document_byte_span.start === row.section_document_byte_span.start + row.use.section_relative_span.start
      && row.use.document_byte_span.end === row.section_document_byte_span.start + row.use.section_relative_span.end
      && row.use.document_byte_span.end <= row.section_document_byte_span.end, `use section-relative span mismatch for ${row.ledger_id}`);
    const useQuote = utf8Slice(source.canonical_text.text, row.use.document_byte_span.start, row.use.document_byte_span.end);
    assertion(useQuote === row.use.quote, `use quote mismatch for ${row.ledger_id}`);
    assertion(sha256Hex(Buffer.from(useQuote, 'utf8')) === row.use.exact_bytes_digest, `use digest mismatch for ${row.ledger_id}`);
    const useSpan = buildSemanticSpan(source, row.use.document_byte_span.start, row.use.document_byte_span.end);
    assertion(useSpan.semantic_span_id === row.use.semantic_span_id, `use semantic span mismatch for ${row.ledger_id}`);
    for (const definition of row.selected_definitions) for (const edge of definition.evidence) {
      assertion(edge.section_relative_span.start >= 0
        && edge.document_byte_span.start === definition.section_document_byte_span.start + edge.section_relative_span.start
        && edge.document_byte_span.end === definition.section_document_byte_span.start + edge.section_relative_span.end
        && edge.document_byte_span.end <= definition.section_document_byte_span.end, `definition section-relative span mismatch for ${row.ledger_id}`);
      const quote = utf8Slice(source.canonical_text.text, edge.document_byte_span.start, edge.document_byte_span.end);
      assertion(quote === edge.quote, `definition quote mismatch for ${row.ledger_id}`);
      assertion(sha256Hex(Buffer.from(quote, 'utf8')) === edge.exact_bytes_digest, `definition digest mismatch for ${row.ledger_id}`);
      const span = buildSemanticSpan(source, edge.document_byte_span.start, edge.document_byte_span.end);
      assertion(span.semantic_span_id === edge.semantic_span_id, `definition semantic span mismatch for ${row.ledger_id}`);
    }
  }
  const byDeal = countBy(replay.ledger_rows, (row) => row.deal);
  assertion(JSON.stringify(byDeal) === JSON.stringify(EXPECTED_BY_DEAL), 'per-deal conservation drift');
  const definitionOutcomes = countBy(replay.ledger_rows, (row) => row.definition_outcome);
  assertion(JSON.stringify(definitionOutcomes) === JSON.stringify(EXPECTED_DEFINITION_OUTCOMES), 'definition outcome conservation drift');
  const integrationDispositions = countBy(replay.ledger_rows, (row) => row.integration_disposition);
  assertion(JSON.stringify(integrationDispositions) === JSON.stringify(EXPECTED_INTEGRATION_DISPOSITIONS), 'integration disposition conservation drift');
  const resolverDispositions = countBy(replay.ledger_rows, (row) => row.resolver_replay.disposition);
  assertion(JSON.stringify(resolverDispositions) === JSON.stringify(EXPECTED_INTEGRATION_DISPOSITIONS), 'actual resolver disposition conservation drift');
  for (const row of replay.ledger_rows) {
    assertion(row.resolver_replay.disposition === row.integration_disposition, `resolver/helper disposition drift: ${row.ledger_id}`);
    assertion(row.resolver_replay.reason === row.integration_reason, `resolver/helper reason drift: ${row.ledger_id}`);
    assertion(row.resolver_replay.model_calls === 0, `resolver replay model-call drift: ${row.ledger_id}`);
  }
  const skechersConflicts = replay.ledger_rows.filter((row) => row.deal === 'skechers'
    && row.definition_outcome === OUTCOMES.RESOLVED
    && row.effective_code === 'AFTER_INQUIRY'
    && row.current_model_code === 'ACTUAL');
  assertion(skechersConflicts.length === 11, `Skechers effective-code conflict drift: ${skechersConflicts.length}`);
  for (const row of skechersConflicts) {
    assertion(row.integration_disposition === 'REVIEW', `Skechers conflict must review: ${row.ledger_id}`);
    assertion(row.integration_reason === INTEGRATION_REASONS.KNOWLEDGE_STANDARD_CONFLICT, `Skechers conflict reason drift: ${row.ledger_id}`);
    assertion(row.effective_code_source === 'SAME_DEAL_DEFINED_TERM', `Skechers effective-code source drift: ${row.ledger_id}`);
  }
  const consistentDefinitions = replay.ledger_rows.filter((row) => row.definition_outcome === OUTCOMES.RESOLVED
    && row.integration_disposition === 'RESOLVED');
  assertion(consistentDefinitions.length === 59, `consistent definition integration count drift: ${consistentDefinitions.length}`);
  for (const row of consistentDefinitions) {
    assertion(row.integration_reason === null, `consistent definition reason drift: ${row.ledger_id}`);
    assertion(row.effective_code_source === 'SAME_DEAL_DEFINED_TERM', `consistent definition source drift: ${row.ledger_id}`);
  }
  const noDefinitionFallbacks = replay.ledger_rows.filter((row) => row.definition_outcome === OUTCOMES.NO_DEFINITION);
  assertion(noDefinitionFallbacks.length === 21, `NO_DEFINITION fallback count drift: ${noDefinitionFallbacks.length}`);
  for (const row of noDefinitionFallbacks) {
    assertion(row.integration_disposition === 'RESOLVED', `NO_DEFINITION fallback must resolve: ${row.ledger_id}`);
    assertion(row.integration_reason === null, `NO_DEFINITION fallback reason drift: ${row.ledger_id}`);
    assertion(row.effective_code_source === 'REGISTERED_CURRENT_MODEL_FALLBACK', `NO_DEFINITION fallback source drift: ${row.ledger_id}`);
  }
  const falseAbsences = noDefinitionFallbacks.filter((row) => (
    row.definition_gap_classification?.classification === 'FALSE_NO_DEFINITION_MISSING_KDT_EVIDENCE'
  ));
  assertion(falseAbsences.length === 18, `false NO_DEFINITION count drift: ${falseAbsences.length}`);
  assertion(JSON.stringify(countBy(falseAbsences, (row) => row.deal)) === JSON.stringify({ skywater: 13, topbuild: 5 }),
    'false NO_DEFINITION deal split drift');
  const trueFallbacks = noDefinitionFallbacks.filter((row) => (
    row.definition_gap_classification?.classification === 'TRUE_AGREEMENT_DEFINITION_ABSENCE'
  ));
  assertion(trueFallbacks.length === 3, `true fallback count drift: ${trueFallbacks.length}`);
  assertion(trueFallbacks.every((row) => row.deal === 'skechers' && row.representation_side === 'BUYER'),
    'true fallback identity drift');
  return true;
}

export function buildReplay() {
  const keyByDeal = new Map();
  const sourcesByDocumentHash = new Map();
  for (const [deal, binding] of Object.entries(FINAL_CORPUS_DEFINED_TERM_BINDINGS)) {
    const name = binding.key_defined_term_run;
    const run = loadRun(name);
    const source = sourceFor(run);
    assertion(run.manifest.section_family === 'KEY_DEFINED_TERMS', `${name}: not a KEY_DEFINED_TERMS final run`);
    assertion(run.receipt.run_receipt_id === binding.key_defined_term_run_receipt_id, `${name}: wrong final receipt identity`);
    assertion(run.receipt.document_hash === binding.document_hash, `${name}: wrong final receipt hash`);
    assertion(source.document_hash === binding.document_hash, `${name}: admitted source document hash mismatch`);
    assertion(!sourcesByDocumentHash.has(source.document_hash), `${name}: shared source requires explicit multi-deal handling`);
    sourcesByDocumentHash.set(source.document_hash, source);
    const index = buildFinalCorpusSameDealDefinedTermIndex({
      binding,
      key_defined_term_receipt: run.receipt,
      admitted_source_context: source,
    });
    assertion(index.status === 'CALIBRATED', `${name}: current final index was not calibrated`);
    keyByDeal.set(deal, { run, source, index });
  }
  const ledgerRows = [];
  for (const [deal, name] of RUNS) {
    const run = loadRun(name);
    assertion(run.manifest.section_family === 'REPRESENTATIONS', `${name}: not a REPRESENTATIONS final run`);
    const key = keyByDeal.get(deal);
    assertion(key, `${name}: current final key-defined-term receipt unavailable`);
    assertion(run.receipt.document_hash === key.run.receipt.document_hash, `${name}: wrong document for current final key-defined-term receipt`);
    const rows = run.resolution.open_world || [];
    rows.forEach((row, index) => {
      if (row.reason === 'REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED') {
        ledgerRows.push(buildLedgerRow({ deal, run, keyRun: key.run, index: key.index, keySource: key.source, row, resolutionIndex: index }));
      }
    });
  }
  ledgerRows.sort((left, right) => left.deal.localeCompare(right.deal)
    || left.representation_run.localeCompare(right.representation_run)
    || left.section_reference.localeCompare(right.section_reference)
    || left.ledger_id.localeCompare(right.ledger_id));
  const falseNoDefinitions = ledgerRows.filter((row) => (
    row.definition_gap_classification?.classification === 'FALSE_NO_DEFINITION_MISSING_KDT_EVIDENCE'
  ));
  const trueFallbacks = ledgerRows.filter((row) => (
    row.definition_gap_classification?.classification === 'TRUE_AGREEMENT_DEFINITION_ABSENCE'
  )).map((row) => Object.freeze({
    ledger_id: row.ledger_id,
    deal: row.deal,
    representation_run: row.representation_run,
    section_reference: row.section_reference,
    representation_side: row.representation_side,
    claim_occurrence_id: row.claim_occurrence_id,
    quote: row.use.quote,
  }));
  const sourceProofByDeal = Object.freeze(Object.fromEntries(
    Object.keys(DEFINITION_GAP_SOURCE_PROOF).map((deal) => [
      deal,
      definitionGapSourceProof(deal, keyByDeal.get(deal).source),
    ]),
  ));
  const replay = Object.freeze({
    schema_version: 'STAGE_2Y_D_DEFINED_TERM_REPLAY/V2',
    publication: 'WITHHELD',
    model_calls: 0,
    writes: false,
    serving: false,
    calibration: FINAL_CORPUS_DEFINED_TERM_CALIBRATION,
    selected_representation_runs: RUNS.map(([, name]) => name),
    selected_current_final_key_defined_term_runs: Object.fromEntries(
      Object.entries(FINAL_CORPUS_DEFINED_TERM_BINDINGS).map(([deal, binding]) => [deal, binding.key_defined_term_run]),
    ),
    expected_historical_reason: 'REPRESENTATION_KNOWLEDGE_STANDARD_UNCORROBORATED',
    expected_historical_rows: EXPECTED_TOTAL,
    counts_by_deal: countBy(ledgerRows, (row) => row.deal),
    counts_by_definition_outcome: countBy(ledgerRows, (row) => row.definition_outcome),
    counts_by_integration_disposition: countBy(ledgerRows, (row) => row.integration_disposition),
    counts_by_integration_reason: countBy(ledgerRows, (row) => row.integration_reason || 'NONE'),
    counts_by_resolver_replay_disposition: countBy(ledgerRows, (row) => row.resolver_replay.disposition),
    counts_by_effective_code: countBy(ledgerRows, (row) => row.effective_code),
    definition_evidence_gap_report: Object.freeze({
      status: 'OPEN_EVIDENCE_REPAIR_REQUIRED',
      false_no_definition_count: falseNoDefinitions.length,
      false_no_definition_by_deal: countBy(falseNoDefinitions, (row) => row.deal),
      source_proof_by_deal: sourceProofByDeal,
      affected_ledger_ids: Object.freeze(falseNoDefinitions.map((row) => row.ledger_id)),
      expected_after_evidence_repair: EXPECTED_AFTER_EVIDENCE_REPAIR,
      expected_counts_are_projection_not_executed_replay: true,
    }),
    true_fallbacks: Object.freeze(trueFallbacks),
    topbuild_buyer_no_definition_count: ledgerRows.filter((row) => row.deal === 'topbuild' && row.typed_absence_or_conflict?.type === OUTCOMES.NO_DEFINITION && row.typed_absence_or_conflict.requested_party === 'BUYER').length,
    ledger_rows: ledgerRows,
  });
  assertReplayIntegrity(replay, sourcesByDocumentHash);
  assertion(replay.topbuild_buyer_no_definition_count === 5, `TopBuild Buyer NO_DEFINITION drift: ${replay.topbuild_buyer_no_definition_count}`);
  return replay;
}

export function main(argv = process.argv.slice(2)) {
  assertion(argv.length === 1 && (argv[0] === '--write' || argv[0] === '--check'), 'usage: node scripts/stage-2y-d-defined-term-replay.mjs --write|--check');
  const output = `${JSON.stringify(buildReplay(), null, 2)}\n`;
  if (argv[0] === '--write') {
    writeFileSync(OUTPUT_PATH, output);
    process.stdout.write(`${relativePath(OUTPUT_PATH)}\n`);
    return;
  }
  assertion(existsSync(OUTPUT_PATH), `replay evidence missing: ${relativePath(OUTPUT_PATH)}`);
  assertion(readFileSync(OUTPUT_PATH, 'utf8') === output, `replay evidence drift: run node ${relativePath(fileURLToPath(import.meta.url))} --write`);
  process.stdout.write(`${relativePath(OUTPUT_PATH)}: checked\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
