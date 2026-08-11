#!/usr/bin/env node

// Seals the Stage 2Y structure-migration control packet from existing evidence.
// It does not select runs, call a provider, change a baseline, or write product data.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonical as measurementCanonical,
  discoverBaselineRuns,
  validateManifest,
} from './stage-2y-cd-measurement.mjs';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  rebuildAdmittedSourcePrimitives,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const {
  sectionizeAdmittedSource,
  findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  PRODUCER_PROMPT_REGISTRY_SCHEMA,
  listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const BASELINE_MANIFEST_PATH =
  'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json';
const CURRENT_REPORT_PATH = 'evidence/canonical-v2/stage-2y-cd-report.json';
const BASELINE_PATH = 'evidence/canonical-v2/stage-2y-cd-baseline.json';
const KNOWN_LOSS_PATH =
  'evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json';
const CURRENT_ROWS_PATH = 'evidence/canonical-v2/stage-2y-n-rendered-rows.json';
const EXPECTED_BASE_COMMIT = '7ba2b9d4612cf95be5d0da4b06a56773e33d2f4e';

const EXPECTED_MEASUREMENTS = Object.freeze({
  attempted: 2201,
  resolved: 1526,
  review: 675,
  open_world: 1701,
  route_available: 1351,
  mechanical_successes: 1241,
  cautious_known_loss_adjusted: 1097,
  grouped_feature_fail_closed: 109,
  routed_no_row: 1,
  no_approved_output_owner: 175,
});

const PROTOTYPE_CASES = Object.freeze([
  Object.freeze({
    case_id: 'CONCHO_6_9_A',
    set: 'DECISION',
    deal: 'concho',
    run_directories: ['concho-employee-matters-20260809-2xk-final'],
    sections: ['6.9(a)'],
    required_features: [
      'CHAPEAU',
      'FOUR_LIMBS',
      'TWO_LOCAL_PROVISOS',
      'MONTH_COUNT_UNRESOLVED',
    ],
  }),
  Object.freeze({
    case_id: 'TOPBUILD_6_2',
    set: 'DECISION',
    deal: 'topbuild',
    run_directories: ['topbuild-termination-20260809-2xk-r3-final'],
    sections: ['6.2'],
    required_features: [
      'MUTUAL_GRANT',
      'FOUR_LIMBS',
      'CAUSATION_PROVISOS',
    ],
  }),
  Object.freeze({
    case_id: 'REDHAT_3_01_3_02',
    set: 'DECISION',
    deal: 'redhat',
    run_directories: [
      'redhat-representations-20260809-2xk-final',
      'redhat-representations-20260808-2xl-replay',
    ],
    run_roles: {
      'redhat-representations-20260809-2xk-final': 'FROZEN_COHORT_CURRENT',
      'redhat-representations-20260808-2xl-replay': 'HISTORICAL_69_CASE_WORKLOAD',
    },
    additional_evidence_paths: [
      'evidence/canonical-v2/redhat-representations-20260808-r1/native-producer-recorded-response-3.01.json',
      'evidence/canonical-v2/redhat-representations-20260808-r1/native-producer-recorded-response-3.02.json',
    ],
    sections: ['3.01', '3.02'],
    packet: true,
    required_features: [
      'WRITTEN_PARENTAGE',
      'THREE_UNNUMBERED_SENTENCES',
      'MODEL_PATHS_NOT_SOURCE_PARENTAGE',
    ],
  }),
  Object.freeze({
    case_id: 'METSERA_7_04',
    set: 'DECISION',
    deal: 'metsera',
    run_directories: ['metsera-closing-conditions-20260809-2xk-final'],
    sections: ['7.04'],
    required_features: ['RECIPROCAL_SENTENCES', 'FOUR_REFERENCE_OCCURRENCES'],
  }),
  Object.freeze({
    case_id: 'CONCHO_4_10_ANNEX_A',
    set: 'DECISION',
    deal: 'concho',
    run_directories: [
      'concho-representations-r1a-20260809-2xk-final',
      'concho-key-defined-terms-20260809-2xk-final',
    ],
    run_roles: {
      'concho-representations-r1a-20260809-2xk-final': 'SUPPLEMENTAL_NON_COHORT',
      'concho-key-defined-terms-20260809-2xk-final': 'DEFINITION_TARGET',
    },
    additional_evidence_paths: [
      'evidence/canonical-v2/stage-2y-d-defined-term-replay.json',
    ],
    sections: ['4.10', 'Annex-A'],
    required_features: ['DEFINED_TERM_USE', 'DEFINITION_TARGET', 'EXACT_LINK'],
  }),
  Object.freeze({
    case_id: 'TOPBUILD_6_3',
    set: 'CONFIRMATION',
    deal: 'topbuild',
    run_directories: ['topbuild-termination-20260809-2xk-r3-final'],
    sections: ['6.3'],
    required_features: ['LIMB_INHERITANCE_CONFIRMATION'],
  }),
  Object.freeze({
    case_id: 'REDHAT_5_07',
    set: 'CONFIRMATION',
    deal: 'redhat',
    run_directories: ['redhat-general-covenants-20260809-2xk-final'],
    sections: ['5.07'],
    required_features: ['UNNUMBERED_SENTENCE_CONFIRMATION'],
  }),
  Object.freeze({
    case_id: 'METSERA_9_03',
    set: 'CONFIRMATION',
    deal: 'metsera',
    run_directories: ['metsera-key-defined-terms-20260809-2xk-final'],
    sections: ['9.03'],
    required_features: ['REFERENCE_CONFIRMATION'],
  }),
  Object.freeze({
    case_id: 'CONCHO_6_11_6_16_6_20',
    set: 'CONFIRMATION',
    deal: 'concho',
    run_directories: ['concho-general-covenants-20260809-2xk-final'],
    sections: ['6.11', '6.16', '6.20'],
    required_features: ['BARE_SENTENCE_CONFIRMATION'],
  }),
]);

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_CONTROL: ${message}`);
}

function parseArgs(argv) {
  const allowed = new Set([
    '--base-commit',
    '--output-root',
    '--write-receipt',
    '--row-gate-result',
  ]);
  const args = {
    baseCommit: null,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    writeReceipt: false,
    rowGateResult: null,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!allowed.has(key)) fail(`unknown argument ${key}`);
    if (key === '--write-receipt') {
      args.writeReceipt = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`${key} requires a value`);
    index += 1;
    if (key === '--base-commit') args.baseCommit = value;
    if (key === '--output-root') args.outputRoot = resolve(value);
    if (key === '--row-gate-result') args.rowGateResult = value;
  }
  if (!/^[0-9a-f]{40}$/.test(args.baseCommit || '')) {
    fail('--base-commit must be a full commit SHA');
  }
  if (args.baseCommit !== EXPECTED_BASE_COMMIT) {
    fail(`base commit must remain ${EXPECTED_BASE_COMMIT}`);
  }
  if (args.outputRoot !== DEFAULT_OUTPUT_ROOT) {
    fail(`output root must remain ${DEFAULT_OUTPUT_ROOT}`);
  }
  if (args.writeReceipt && args.rowGateResult !== 'PASS') {
    fail('--write-receipt requires --row-gate-result PASS');
  }
  return args;
}

function readJson(repositoryPath) {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, repositoryPath), 'utf8'));
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath);
  if (!value || value.startsWith('..')) fail(`path is outside repository: ${absolutePath}`);
  return value.split('\\').join('/');
}

function fileBinding(repositoryRelativePath) {
  const absolutePath = resolve(REPO_ROOT, repositoryRelativePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`missing bound file ${repositoryRelativePath}`);
  }
  const bytes = readFileSync(absolutePath);
  return Object.freeze({
    path: repositoryRelativePath,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  });
}

function writeSealed(absolutePath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (existsSync(absolutePath)) {
    const current = readFileSync(absolutePath, 'utf8');
    if (current !== bytes) fail(`refuses to mutate sealed file ${repositoryPath(absolutePath)}`);
    return fileBinding(repositoryPath(absolutePath));
  }
  writeFileSync(absolutePath, bytes, { encoding: 'utf8', flag: 'wx' });
  return fileBinding(repositoryPath(absolutePath));
}

function assertBaselineManifest(manifest) {
  if (manifest.schema_version !== 'STAGE_2Y_CD_BASELINE_MANIFEST/V1') {
    fail('baseline manifest schema drift');
  }
  if (manifest.manifest_id
    !== '57c92c68b3e3b0ce63c036ebb15effa892612a28c1b149bf6154e2989d058b30') {
    fail('baseline manifest identity drift');
  }
  if (!Array.isArray(manifest.runs) || manifest.runs.length !== 130) {
    fail('baseline manifest must contain exactly 130 runs');
  }
  if (manifest.selection?.rule
    !== 'HIGHEST_RESOLVED_COUNT_THEN_LEXICAL_DIRECTORY') {
    fail('baseline run-selection rule drift');
  }
  validateManifest(manifest);
  const discovered = discoverBaselineRuns();
  if (measurementCanonical(discovered) !== measurementCanonical(manifest.runs)) {
    fail('frozen 130-run selection disagrees with the current governed selection rule');
  }
}

function assertCurrentMeasurements(report, knownLoss) {
  const totals = report.current?.totals;
  const measured = {
    attempted: totals?.attempted,
    resolved: totals?.resolved,
    review: totals?.review,
    open_world: totals?.open_world,
    route_available: totals?.rendering_funnel?.route_available,
    mechanical_successes: totals?.rendering_funnel?.row_with_content,
    cautious_known_loss_adjusted: knownLoss.summary?.known_loss_adjusted_rows,
    grouped_feature_fail_closed:
      totals?.render_failures?.CLAIM_FEATURE_ROW_NOT_UNIQUE,
    routed_no_row: totals?.render_failures?.CLAIM_RENDERED_NO_ROW,
    no_approved_output_owner: totals?.render_failures?.FAMILY_NOT_RENDERABLE,
  };
  for (const [key, expected] of Object.entries(EXPECTED_MEASUREMENTS)) {
    if (measured[key] !== expected) {
      fail(`measurement ${key} drifted: expected ${expected}, got ${measured[key]}`);
    }
  }
  return Object.freeze(measured);
}

function bindRunFiles(baselineManifest) {
  const bindings = [];
  for (const run of baselineManifest.runs) {
    for (const named of [run.run_manifest, run.resolution]) {
      const binding = fileBinding(named.path);
      if (binding.sha256 !== named.sha256) {
        fail(`${named.path} disagrees with the frozen baseline manifest`);
      }
    }
    const runRoot = resolve(REPO_ROOT, 'evidence/canonical-v2', run.directory);
    if (!existsSync(runRoot) || !statSync(runRoot).isDirectory()) {
      fail(`missing frozen run directory ${run.directory}`);
    }
    for (const name of readdirSync(runRoot).sort()) {
      const absolutePath = resolve(runRoot, name);
      if (statSync(absolutePath).isFile()) {
        bindings.push(fileBinding(repositoryPath(absolutePath)));
      }
    }
  }
  const unique = new Map(bindings.map((binding) => [binding.path, binding]));
  return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function bindPrototypeSupplementalFiles(baselineManifest) {
  const cohortRuns = new Set(baselineManifest.runs.map((run) => run.directory));
  const paths = new Set();
  for (const specification of PROTOTYPE_CASES) {
    for (const runDirectory of specification.run_directories) {
      if (cohortRuns.has(runDirectory)) continue;
      const runRoot = resolve(REPO_ROOT, 'evidence/canonical-v2', runDirectory);
      if (!existsSync(runRoot) || !statSync(runRoot).isDirectory()) {
        fail(`missing supplemental prototype run ${runDirectory}`);
      }
      for (const name of readdirSync(runRoot).sort()) {
        const absolutePath = resolve(runRoot, name);
        if (statSync(absolutePath).isFile()) paths.add(repositoryPath(absolutePath));
      }
    }
    for (const evidencePath of specification.additional_evidence_paths || []) {
      paths.add(evidencePath);
    }
  }
  return [...paths].sort().map(fileBinding);
}

function buildCohort(baselineManifest) {
  const agreements = new Map();
  for (const run of baselineManifest.runs) {
    const sourceChainPath =
      `evidence/canonical-v2/${run.directory}/source-reference.json`;
    const source = readJson(sourceChainPath);
    const admitted = source.admitted_source_capture_inputs;
    if (!admitted?.immutable_source_document_id || !admitted.raw_html_path) {
      fail(`run ${run.directory} has no frozen admitted-source identity`);
    }
    const rawBinding = fileBinding(admitted.raw_html_path);
    if (rawBinding.sha256 !== admitted.raw_bytes_sha256) {
      fail(`raw source hash drift for ${run.directory}`);
    }
    const key = admitted.immutable_source_document_id;
    const existing = agreements.get(key) || {
      agreement_id: key,
      deal: source.deal,
      admitted_source_path: admitted.raw_html_path,
      source_chain_paths: [],
      source_map_payload_path: admitted.source_map_payload_path,
      canonical_text_byte_length: source.canonical_text_byte_length,
      canonical_text_sha256: source.canonical_text_sha256,
      raw_source_byte_length: rawBinding.byte_length,
      raw_source_sha256: rawBinding.sha256,
      run_identifiers: [],
    };
    if (existing.canonical_text_sha256 !== source.canonical_text_sha256
      || existing.canonical_text_byte_length !== source.canonical_text_byte_length
      || existing.admitted_source_path !== admitted.raw_html_path) {
      fail(`conflicting admitted source records for ${key}`);
    }
    existing.source_chain_paths.push(sourceChainPath);
    existing.run_identifiers.push(run.directory);
    agreements.set(key, existing);
  }
  const records = [...agreements.values()]
    .map((agreement) => ({
      ...agreement,
      source_chain_paths: [...new Set(agreement.source_chain_paths)].sort(),
      run_identifiers: [...new Set(agreement.run_identifiers)].sort(),
    }))
    .sort((left, right) => left.deal.localeCompare(right.deal));
  if (records.length !== 7) fail(`expected 7 unique agreement sources, got ${records.length}`);
  if (records.reduce((sum, record) => sum + record.run_identifiers.length, 0) !== 130) {
    fail('cohort run membership does not cover the 130-run manifest exactly once');
  }
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_COHORT_AGREEMENTS/V1',
    source_manifest_id: baselineManifest.manifest_id,
    agreement_count: records.length,
    run_count: 130,
    agreements: records,
  });
}

function buildPrototypeInputs() {
  const sourceCache = new Map();
  function sourceFor(runDirectory) {
    const sourceReference = readJson(
      `evidence/canonical-v2/${runDirectory}/source-reference.json`,
    );
    const sourceId =
      sourceReference.admitted_source_capture_inputs?.immutable_source_document_id;
    if (!sourceCache.has(sourceId)) {
      const absoluteRun = resolve(REPO_ROOT, 'evidence/canonical-v2', runDirectory);
      const primitives = rebuildAdmittedSourcePrimitives({
        runDirectory: absoluteRun,
        repoRoot: REPO_ROOT,
      });
      const sourceText = primitives.conversion.canonical_text;
      const tree = sectionizeAdmittedSource({
        source_text: sourceText,
        document_hash: sourceReference.document_hash,
      });
      if (tree.source_sha256 !== sourceReference.canonical_text_sha256
        || tree.source_byte_length !== sourceReference.canonical_text_byte_length) {
        fail(`sectionizer input drift for ${runDirectory}`);
      }
      sourceCache.set(sourceId, { sourceReference, tree });
    }
    return sourceCache.get(sourceId);
  }

  const cases = PROTOTYPE_CASES.map((specification) => {
    const primary = sourceFor(specification.run_directories[0]);
    const spans = specification.sections.map((sectionReference) => {
      const node = findSectionByReference(primary.tree, sectionReference);
      if (!node) fail(`${specification.case_id} cannot locate ${sectionReference}`);
      return Object.freeze({
        section_reference: sectionReference,
        start: node.start,
        end: node.end,
        byte_length: node.end - node.start,
        text_sha256: node.text_sha256,
        current_section_id: node.section_id,
      });
    });
    return Object.freeze({
      ...specification,
      run_roles: specification.run_roles || Object.fromEntries(
        specification.run_directories.map((runDirectory) => [
          runDirectory,
          'FROZEN_COHORT_CURRENT',
        ]),
      ),
      source_path:
        primary.sourceReference.admitted_source_capture_inputs.raw_html_path,
      raw_source_sha256: primary.sourceReference.raw_bytes_sha256,
      raw_source_byte_length: primary.sourceReference.raw_bytes_length,
      source_chain_path:
        `evidence/canonical-v2/${specification.run_directories[0]}/source-reference.json`,
      immutable_source_document_id:
        primary.sourceReference.admitted_source_capture_inputs.immutable_source_document_id,
      sectionizer_document_hash: primary.sourceReference.document_hash,
      canonical_text_sha256: primary.sourceReference.canonical_text_sha256,
      canonical_text_byte_length: primary.sourceReference.canonical_text_byte_length,
      spans,
      packet_span: specification.packet
        ? Object.freeze({ start: spans[0].start, end: spans.at(-1).end })
        : null,
    });
  });
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_PROTOTYPE_INPUTS/V1',
    input_rule: 'FROZEN_SECTIONIZER_UTF8_BYTE_SPANS',
    rediscovery_permitted: false,
    decision_case_count: cases.filter((entry) => entry.set === 'DECISION').length,
    confirmation_case_count:
      cases.filter((entry) => entry.set === 'CONFIRMATION').length,
    cases,
  });
}

function buildDiffContract() {
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_DIFF_CONTRACT/V1',
    comparison_unit: 'CLAIM_REVISION',
    claim_identity_fields: [
      'claim_occurrence_id',
      'claim_definition_key',
      'deal',
      'family',
      'section_reference',
    ],
    stage_specific_identity_fields: [
      'proposal_claim_revision_id',
      'resolution_claim_revision_id',
      'write_set_claim_revision_id',
      'validation_claim_revision_id',
    ],
    semantic_fields: [
      'state',
      'raw_value',
      'canonical_value',
      'party',
      'capacity',
      'scope',
      'attributes',
      'evidence_roles',
      'evidence_spans',
      'source_node_links',
      'context_facts',
      'relationships',
      'family_route',
      'output_fields',
      'omissions',
      'publication_state',
    ],
    semantic_equivalence: {
      exact_fields: [
        'state',
        'canonical_value',
        'party',
        'capacity',
        'scope',
        'attributes',
        'evidence_roles',
        'evidence_spans',
        'relationships',
        'family_route',
        'output_fields',
        'publication_state',
      ],
      alias_permitted_fields: ['source_node_links'],
      omission_requires_disposition: true,
      legal_scope_change_requires_ben: true,
      technical_identity_change_requires_sol: true,
    },
    stop_conditions: [
      'UNEXPECTED_RESOLVED_VALUE_CHANGE',
      'UNEXPECTED_RESOLVED_STATE_CHANGE',
      'OPEN_WORLD_INCREASE_IN_ANY_FAMILY',
      'EVIDENCE_SPAN_NOT_CONSTRUCTIBLE',
      'UNAPPROVED_MATERIAL_OMISSION',
    ],
  });
}

function buildAuthority() {
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_AUTHORITY/V1',
    authorised_stages: ['M0', 'M1'],
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    phase_b_status: 'DEFERRED_LOCKED',
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    database_target: 'NONE',
    release_receipts_created: 0,
    internal_cutover_authorisation: 'NONE',
    current_selector_changes: 0,
    model_calls: 0,
    phase_b_route_calls: 0,
    product_writes: 0,
    publication_authorisation: 'NONE',
    serving_changes: 0,
  });
}

function staticModuleBindings() {
  const exact = [
    'lib/canonical-v2/contract-bundle.js',
    'lib/canonical-v2/native-producer/producer-prompt-registry.js',
    'lib/review-parity/rendered-row-preview.js',
    'lib/canonical-v2/publication-disposition.js',
    'lib/canonical-v2/publication-serving-filter.js',
    'lib/programme-gates/current-publication.js',
    'lib/programme-gates/publication.js',
    'lib/programme-gates/publication-executor.js',
  ];
  const policyFiles = readdirSync(resolve(REPO_ROOT, 'lib/canonical-v2'))
    .filter((name) => name.endsWith('policy.js') || name.includes('policy-'))
    .map((name) => `lib/canonical-v2/${name}`);
  return [...new Set([...exact, ...policyFiles])]
    .sort()
    .map(fileBinding);
}

function buildReceipt({ controlManifest, measurements, rowGateResult }) {
  const byFamily = readJson(CURRENT_REPORT_PATH).current.by_family;
  const openWorld = new Map(byFamily.map((entry) => [entry.family, entry.open_world]));
  return Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    packet_id: 'stage-2y-structure-m0-control-freeze',
    stage: 'M0',
    base_commit: EXPECTED_BASE_COMMIT,
    input_digests: {
      control_manifest: fileBinding(
        'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json',
      ).sha256,
      baseline_manifest: fileBinding(BASELINE_MANIFEST_PATH).sha256,
      current_measurement: fileBinding(CURRENT_REPORT_PATH).sha256,
      known_loss_adjustment: fileBinding(KNOWN_LOSS_PATH).sha256,
    },
    changed_files: [
      'scripts/stage-2y-structure-migration-control.mjs',
      'scripts/stage-2y-structure-migration-validate.mjs',
      'evidence/canonical-v2/stage-2y-structure-migration/control/manifest.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/cohort-agreements.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/family-keys.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/prototype-inputs.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/diff-contract.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/expected-differences.json',
      'evidence/canonical-v2/stage-2y-structure-migration/control/authority.json',
      'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m0-control-freeze.json',
    ],
    focused_checks: [
      { check: 'ROW_AND_MEASUREMENT_GATE', result: rowGateResult },
      { check: 'BOUND_FILE_HASHES', result: 'PASS' },
      { check: 'FIXED_MEASUREMENTS', result: 'PASS', measurements },
      { check: 'CONTROL_SCHEMA_PREFLIGHT', result: 'PASS' },
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
    old_result_digest: controlManifest.current_measurement_binding.sha256,
    new_shadow_result_digest: null,
    expected_differences: [],
    unexpected_differences: [],
    open_world_by_family: Object.fromEntries(
      listRegisteredSectionFamilies().map((family) => [family, openWorld.get(family) || 0]),
    ),
    rollback_command: 'git revert --no-edit <M0_COMMIT_SHA>',
    rollback_result: 'NOT_RUN_REPORT_ONLY_NO_SELECTOR_OR_PRODUCT_EFFECT',
    status: 'PASS',
  });
}

function main() {
  const args = parseArgs(process.argv);
  const baselineManifest = readJson(BASELINE_MANIFEST_PATH);
  assertBaselineManifest(baselineManifest);
  const currentReport = readJson(CURRENT_REPORT_PATH);
  const knownLoss = readJson(KNOWN_LOSS_PATH);
  const measurements = assertCurrentMeasurements(currentReport, knownLoss);

  const cohort = buildCohort(baselineManifest);
  const familyKeys = Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_FAMILY_KEYS/V1',
    registry_schema: PRODUCER_PROMPT_REGISTRY_SCHEMA,
    registry_source: fileBinding(
      'lib/canonical-v2/native-producer/producer-prompt-registry.js',
    ),
    family_count: 25,
    family_keys: listRegisteredSectionFamilies(),
  });
  if (new Set(familyKeys.family_keys).size !== 25
    || [...familyKeys.family_keys].sort().join('\n')
      !== familyKeys.family_keys.join('\n')) {
    fail('family registry must contain 25 unique sorted keys');
  }
  const prototypeInputs = buildPrototypeInputs();
  const diffContract = buildDiffContract();
  const expectedDifferences = Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_EXPECTED_DIFFERENCES/V1',
    entries: [],
    approval_rule:
      'SOL_FOR_TECHNICAL_IDENTITY_OR_EQUIVALENCE;BEN_FOR_LEGAL_VALUE_SCOPE_GROUPING_OR_MATERIAL_OMISSION',
  });
  const authority = buildAuthority();

  const controlRoot = resolve(args.outputRoot, 'control');
  const controls = [
    ['cohort-agreements.json', cohort],
    ['family-keys.json', familyKeys],
    ['prototype-inputs.json', prototypeInputs],
    ['diff-contract.json', diffContract],
    ['expected-differences.json', expectedDifferences],
    ['authority.json', authority],
  ];
  const controlBindings = Object.fromEntries(
    controls.map(([name, value]) => {
      const binding = writeSealed(resolve(controlRoot, name), value);
      return [name, binding];
    }),
  );

  const baselineBinding = fileBinding(BASELINE_MANIFEST_PATH);
  const currentMeasurementBinding = fileBinding(CURRENT_REPORT_PATH);
  const manifest = Object.freeze({
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1',
    source_commit: args.baseCommit,
    purpose: 'M0_M1_REPORT_ONLY_STRUCTURE_FALSIFICATION',
    baseline_manifest: {
      ...baselineBinding,
      manifest_id: baselineManifest.manifest_id,
      run_count: baselineManifest.runs.length,
      selection: baselineManifest.selection,
    },
    fixed_measurements: measurements,
    current_measurement_binding: currentMeasurementBinding,
    current_baseline_binding: fileBinding(BASELINE_PATH),
    known_loss_adjustment_binding: fileBinding(KNOWN_LOSS_PATH),
    current_projection_binding: fileBinding(CURRENT_ROWS_PATH),
    contract_and_policy_bindings: staticModuleBindings(),
    frozen_run_file_bindings: bindRunFiles(baselineManifest),
    supplemental_prototype_file_bindings:
      bindPrototypeSupplementalFiles(baselineManifest),
    control_bindings: controlBindings,
    authority,
  });
  const manifestBinding = writeSealed(resolve(controlRoot, 'manifest.json'), manifest);

  if (args.writeReceipt) {
    const receipt = buildReceipt({
      controlManifest: manifest,
      measurements,
      rowGateResult: args.rowGateResult,
    });
    writeSealed(
      resolve(args.outputRoot, 'receipts/stage-2y-structure-m0-control-freeze.json'),
      receipt,
    );
  }
  process.stdout.write(`${canonicalJson({
    status: 'PASS',
    manifest: manifestBinding,
    receipt_written: args.writeReceipt,
    agreement_count: cohort.agreement_count,
    family_count: familyKeys.family_count,
    decision_case_count: prototypeInputs.decision_case_count,
    confirmation_case_count: prototypeInputs.confirmation_case_count,
  })}\n`);
}

main();
