#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { createCandidateGoverningContext } = require('../lib/canonical-v2/native-producer/candidate-governing-context');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_PATH = resolve(ROOT, 'evidence/canonical-v2/stage-2y-a-context-availability-census.json');
const FRAGMENT_SET_PATH = resolve(ROOT, 'evidence/canonical-v2/open-world-promotion/candidates/b607809bd087e801f20e924e987289711ddaab0ed9e37c07b7c6418f5f7ffe6c/candidate-set.v1.json');
const SCHEMA_VERSION = 'STAGE_2Y_A_CONTEXT_AVAILABILITY_CENSUS/V1';

const TARGETS = Object.freeze({
  NO_SHOP: Object.freeze({ state: 'HELD', reasons: Object.freeze([
    'NO_SHOP_ACTION_UNCORROBORATED',
    'NO_SHOP_PERIOD_ROLE_UNCORROBORATED',
    'NO_SHOP_PREREQUISITE_UNCORROBORATED',
  ]) }),
  DNO_INDEMNIFICATION: Object.freeze({ state: 'HELD', reasons: Object.freeze(['DNO_KIND_UNCORROBORATED']) }),
  EMPLOYEE_MATTERS: Object.freeze({ state: 'HELD', reasons: Object.freeze([
    'EMPLOYEE_KIND_UNCORROBORATED', 'ITEM_OR_STANDARD_UNCORROBORATED',
  ]) }),
  TERMINATION: Object.freeze({ state: 'HELD', reasons: Object.freeze([
    'TERMINATING_PARTY_REF_NOT_IN_QUOTE', 'TRIGGER_KIND_UNCORROBORATED', 'PERIOD_KIND_UNCORROBORATED',
  ]) }),
  INTERIM_OPERATING: Object.freeze({ state: 'HELD', reasons: Object.freeze([
    'IOC_ATTACHMENT_TARGET_QUOTE_MISSING',
    'IOC_ATTACHMENT_TARGET_ZERO_MATCHES',
    'IOC_ATTACHMENT_TARGET_MULTIPLE_MATCHES',
    'IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION',
    'IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED',
  ]) }),
  CLOSING_CONDITIONS: Object.freeze({
    state: 'HELD', reasons: Object.freeze(['CONDITION_KIND_UNCORROBORATED']),
    assertion_kinds: Object.freeze(['FRUSTRATION_CAUSATION', 'FRUSTRATION_BREACH']),
  }),
  TERMINATION_FEE: Object.freeze({
    state: 'MIXED', reasons: Object.freeze(['FEE_SIDE_UNCORROBORATED', 'SOLE_REMEDY_CARVEOUT_QUOTE_UNCORROBORATED']),
  }),
});

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function digest(value) {
  return `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
}

function reasonCodes(row) {
  return Array.isArray(row?.reasons) ? row.reasons.filter((value) => typeof value === 'string')
    : typeof row?.reason === 'string' ? [row.reason] : [];
}

function rowState(bucket) {
  return bucket === 'review_queue' ? 'HELD' : 'OPEN_WORLD';
}

function sourceCandidates(receipt) {
  return (receipt?.compiled_candidates || []).filter((entry) => entry?.candidate?.claim);
}

function selectSourceCandidate(row, candidates) {
  const direct = (field, route) => {
    if (typeof row?.[field] !== 'string') return null;
    const matches = candidates.filter((entry) => entry.candidate.claim[field === 'original_claim_occurrence_id'
      ? 'claim_occurrence_id' : field] === row[field]);
    return matches.length === 1 ? { status: 'UNIQUE', route, claim: matches[0].candidate.claim }
      : matches.length > 1 ? { status: 'AMBIGUOUS', route } : null;
  };
  const byOccurrence = direct('original_claim_occurrence_id', 'ORIGINAL_CLAIM_OCCURRENCE_ID');
  if (byOccurrence) return byOccurrence;
  const byRevision = direct('claim_revision_id', 'CLAIM_REVISION_ID');
  if (byRevision) return byRevision;
  const byClosure = direct('closure_id', 'CLOSURE_ID');
  if (byClosure) return byClosure;
  const quote = typeof row?.raw_value === 'string' ? row.raw_value : null;
  const matches = quote == null ? [] : candidates.filter((entry) => (
    entry.candidate.claim.claim_definition_key === row.generic_claim_key
      && entry.candidate.claim.raw_value === quote
  ));
  return matches.length === 1 ? { status: 'UNIQUE', route: 'EXACT_GENERIC_KEY_AND_RAW_VALUE', claim: matches[0].candidate.claim }
    : matches.length > 1 ? { status: 'AMBIGUOUS', route: 'EXACT_GENERIC_KEY_AND_RAW_VALUE' }
      : { status: 'NOT_LOCATED', route: null };
}

function evidenceState(row, claim) {
  const stored = Array.isArray(row?.evidence) ? row.evidence : null;
  const source = Array.isArray(claim?.evidence) ? claim.evidence : null;
  if (!stored || stored.length === 0) return 'STORED_EVIDENCE_MISSING';
  if (!source || source.length === 0) return 'SOURCE_CANDIDATE_EVIDENCE_MISSING';
  return canonicalJson(stored) === canonicalJson(source)
    ? 'EXACT_EVIDENCE_PRESERVED' : 'STORED_SOURCE_EVIDENCE_CONFLICT';
}

function contextFor({ row, selected, service }) {
  if (selected.status !== 'UNIQUE') {
    return Object.freeze({ status: 'UNDETERMINED', reason: `SOURCE_CANDIDATE_${selected.status}` });
  }
  return service.forCandidate({ entry: row, claim: selected.claim });
}

function contextSummary(context) {
  if (context.status !== 'RESOLVED') {
    return Object.freeze({
      status: 'UNDETERMINED',
      reason: context.reason,
      leaf_available: false,
      chapeau_available: false,
      structural_host_context_available: false,
      exact_operational_span: null,
    });
  }
  const chapeauAvailable = Array.isArray(context.chapeau) && context.chapeau.length > 0;
  return Object.freeze({
    status: 'RESOLVED',
    reason: null,
    leaf_available: Boolean(context.leaf),
    chapeau_available: chapeauAvailable,
    structural_host_context_available: Boolean(context.item) && !context.markerless && chapeauAvailable,
    exact_operational_span: Object.freeze({
      start_byte: context.operative.start_byte,
      end_byte: context.operative.end_byte,
      exact_bytes_digest: context.operative.exact_bytes_digest,
    }),
  });
}

function rowIdentity({ run, bucket, index, row }) {
  return digest({ run, bucket, index, closure_id: row?.closure_id || null, reasons: reasonCodes(row) });
}

function tally(records, field) {
  const values = new Map();
  for (const record of records) {
    const value = field(record);
    values.set(value, (values.get(value) || 0) + 1);
  }
  return Object.freeze(Object.fromEntries([...values.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)))));
}

function contextRecord({ run, family, bucket, index, row, selected, context }) {
  const summary = contextSummary(context);
  const claim = selected.status === 'UNIQUE' ? selected.claim : null;
  return Object.freeze({
    record_id: rowIdentity({ run, bucket, index, row }),
    run_id: run,
    family,
    state: rowState(bucket),
    source_path: `${bucket}[${index}]`,
    section_reference: row.section_reference || row.attributes?.section_reference || null,
    reason_codes: Object.freeze(reasonCodes(row).sort()),
    assertion_kind: claim?.attributes?.assertion_kind || row.attributes?.assertion_kind || null,
    source_candidate: Object.freeze({ status: selected.status, route: selected.route || null }),
    evidence_preservation: evidenceState(row, claim),
    context: summary,
  });
}

function targetMatches({ family, bucket, row, selected }) {
  const target = TARGETS[family];
  if (!target) return false;
  if (target.state !== 'MIXED' && target.state !== rowState(bucket)) return false;
  if (!reasonCodes(row).some((reason) => target.reasons.includes(reason))) return false;
  const kind = selected.status === 'UNIQUE' ? selected.claim.attributes?.assertion_kind : row.attributes?.assertion_kind;
  return !target.assertion_kinds || target.assertion_kinds.includes(kind);
}

function loadRun(root, run) {
  const directory = resolve(root, 'evidence/canonical-v2', run);
  const required = ['run-manifest.json', 'run-receipt.json', 'resolution.json', 'adapter-result.json'];
  const absent = required.filter((file) => !existsSync(resolve(directory, file)));
  if (absent.length) return Object.freeze({ run, status: 'ARTIFACT_MISSING', absent: Object.freeze(absent) });
  const manifest = readJson(resolve(directory, 'run-manifest.json'));
  const receipt = readJson(resolve(directory, 'run-receipt.json'));
  const resolution = readJson(resolve(directory, 'resolution.json'));
  const source = readJson(resolve(directory, 'adapter-result.json')).admitted_source_contexts?.[0] || null;
  return Object.freeze({ run, status: 'LOADED', manifest, receipt, resolution, source });
}

function runContextRecords(loaded) {
  const sections = new Map((loaded.receipt.resolved_sections || []).map((section) => [section.section_reference, section]));
  const service = createCandidateGoverningContext({ admittedSourceContext: loaded.source, sectionsByReference: sections });
  const candidates = sourceCandidates(loaded.receipt);
  const records = [];
  for (const bucket of ['review_queue', 'open_world']) {
    for (const [index, row] of (loaded.resolution[bucket] || []).entries()) {
      const selected = selectSourceCandidate(row, candidates);
      if (!targetMatches({ family: loaded.manifest.section_family, bucket, row, selected })) continue;
      records.push(contextRecord({
        run: loaded.run, family: loaded.manifest.section_family, bucket, index, row, selected,
        context: contextFor({ row, selected, service }),
      }));
    }
  }
  return Object.freeze(records);
}

function fragmentRecord({ exclusion, loaded }) {
  const evidence = exclusion.evidence;
  const candidates = sourceCandidates(loaded.receipt);
  const section = (loaded.receipt.resolved_sections || [])
    .find((entry) => entry.section_reference === evidence.section_reference);
  if (!section) {
    return Object.freeze({
      record_id: digest({ exclusion, missing_section: evidence.section_reference }), run_id: evidence.run_id,
      source_candidate: Object.freeze({ status: 'SECTION_UNAVAILABLE', route: null }),
      evidence_preservation: 'NOT_ASSESSABLE',
      context: Object.freeze({ status: 'UNDETERMINED', reason: 'SECTION_UNAVAILABLE', leaf_available: false, chapeau_available: false, structural_host_context_available: false, exact_operational_span: null }),
    });
  }
  const matches = (loaded.resolution.open_world || []).filter((row) => {
    const edge = row.evidence?.find((item) => item.evidence_role === 'OPERATIVE_TEXT') || row.evidence?.[0];
    return edge?.excerpt_id === evidence.excerpt_id
      && edge.absolute_start === evidence.absolute_start_byte - section.start
      && edge.absolute_end === evidence.absolute_end_byte - section.start
      && row.raw_value === evidence.quote_utf8;
  });
  if (matches.length !== 1) {
    return Object.freeze({
      record_id: digest({ exclusion, source_match_count: matches.length }), run_id: evidence.run_id,
      source_candidate: Object.freeze({ status: matches.length === 0 ? 'OPEN_WORLD_ROW_NOT_LOCATED' : 'OPEN_WORLD_ROW_AMBIGUOUS', route: null }),
      evidence_preservation: 'NOT_ASSESSABLE',
      context: Object.freeze({ status: 'UNDETERMINED', reason: matches.length === 0 ? 'OPEN_WORLD_ROW_NOT_LOCATED' : 'OPEN_WORLD_ROW_AMBIGUOUS', leaf_available: false, chapeau_available: false, structural_host_context_available: false, exact_operational_span: null }),
    });
  }
  const [row] = matches;
  const sections = new Map((loaded.receipt.resolved_sections || []).map((section) => [section.section_reference, section]));
  const selected = selectSourceCandidate(row, candidates);
  const service = createCandidateGoverningContext({ admittedSourceContext: loaded.source, sectionsByReference: sections });
  const context = contextFor({ row, selected, service });
  return Object.freeze({
    ...contextRecord({ run: loaded.run, family: loaded.manifest.section_family, bucket: 'open_world', index: (loaded.resolution.open_world || []).indexOf(row), row, selected, context }),
    fragment_exclusion: true,
  });
}

function groupedSummary(records) {
  const groups = new Map();
  for (const record of records) {
    for (const reason of record.reason_codes || ['UNSPECIFIED']) {
      const key = `${record.family || 'UNKNOWN'}\0${record.state || 'OPEN_WORLD'}\0${reason}`;
      const list = groups.get(key) || [];
      list.push(record);
      groups.set(key, list);
    }
  }
  return Object.freeze([...groups.entries()].map(([key, rows]) => {
    const [family, state, reason_code] = key.split('\0');
    return Object.freeze({
      family, state, reason_code, occurrences: rows.length,
      context_resolved: rows.filter((row) => row.context.status === 'RESOLVED').length,
      leaf_available: rows.filter((row) => row.context.leaf_available).length,
      chapeau_available: rows.filter((row) => row.context.chapeau_available).length,
      structural_host_context_available: rows.filter((row) => row.context.structural_host_context_available).length,
      undetermined_reasons: tally(rows.filter((row) => row.context.status !== 'RESOLVED'), (row) => row.context.reason),
      evidence_preservation: tally(rows, (row) => row.evidence_preservation),
    });
  }).sort((left, right) => left.family.localeCompare(right.family)
    || left.state.localeCompare(right.state) || left.reason_code.localeCompare(right.reason_code)));
}

export function buildCensus({ root = ROOT } = {}) {
  const evidenceRoot = resolve(root, 'evidence/canonical-v2');
  const names = readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort();
  const loaded = names.map((run) => loadRun(root, run));
  const targetRecords = loaded.filter((run) => run.status === 'LOADED').flatMap(runContextRecords)
    .sort((left, right) => byteOrder(left.record_id, right.record_id));
  const fragmentSet = readJson(resolve(root, 'evidence/canonical-v2/open-world-promotion/candidates/b607809bd087e801f20e924e987289711ddaab0ed9e37c07b7c6418f5f7ffe6c/candidate-set.v1.json'));
  const fragments = fragmentSet.exclusions.filter((entry) => entry.reason === 'FRAGMENT');
  const loadedByRun = new Map(loaded.filter((run) => run.status === 'LOADED').map((run) => [run.run, run]));
  const fragmentRecords = fragments.map((entry) => {
    const run = loadedByRun.get(entry.evidence.run_id);
    return run ? fragmentRecord({ exclusion: entry, loaded: run }) : Object.freeze({
      record_id: digest({ entry, missing_run: entry.evidence.run_id }), run_id: entry.evidence.run_id,
      source_candidate: Object.freeze({ status: 'RUN_ARTIFACT_MISSING', route: null }), evidence_preservation: 'NOT_ASSESSABLE',
      context: Object.freeze({ status: 'UNDETERMINED', reason: 'RUN_ARTIFACT_MISSING', leaf_available: false, chapeau_available: false, structural_host_context_available: false, exact_operational_span: null }),
    });
  }).sort((left, right) => byteOrder(left.record_id, right.record_id));
  const fragmentSummary = Object.freeze({
    historical_surface_fragment_exclusions: fragments.length,
    resolved_with_chapeau: fragmentRecords.filter((row) => row.context.status === 'RESOLVED' && row.context.chapeau_available).length,
    structural_host_context_available: fragmentRecords.filter((row) => row.context.structural_host_context_available).length,
    candidate_host_binding_performed: false,
    context_undetermined_reasons: tally(fragmentRecords.filter((row) => row.context.status !== 'RESOLVED'), (row) => row.context.reason),
    evidence_preservation: tally(fragmentRecords, (row) => row.evidence_preservation),
  });
  const body = {
    schema_version: SCHEMA_VERSION,
    mode: Object.freeze({ model_calls: 0, product_writes: false, artifact_write_only: true, serving: false, classification_or_disposition_changes: false }),
    corpus: Object.freeze({ selected_final_runs: names.length, loaded_runs: loaded.filter((run) => run.status === 'LOADED').length, unavailable_runs: loaded.filter((run) => run.status !== 'LOADED').map((run) => ({ run_id: run.run, reason: run.status, absent: run.absent })) }),
    target_selection: TARGETS,
    targeted_context_summary: groupedSummary(targetRecords),
    targeted_records: targetRecords,
    fragment_structural_census: Object.freeze({ ...fragmentSummary, records: fragmentRecords }),
  };
  return Object.freeze({ ...body, census_digest: digest(body) });
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const modes = process.argv.slice(2);
  if (modes.length !== 1 || !['--write', '--check'].includes(modes[0])) {
    throw new Error('STAGE_2Y_A_CONTEXT_AVAILABILITY_CENSUS_REQUIRES_EXACTLY_ONE_MODE');
  }
  const output = buildCensus();
  if (modes[0] === '--write') writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  else {
    if (!existsSync(OUTPUT_PATH) || readFileSync(OUTPUT_PATH, 'utf8') !== `${JSON.stringify(output, null, 2)}\n`) {
      throw new Error('STALE_STAGE_2Y_A_CONTEXT_AVAILABILITY_CENSUS');
    }
  }
}
