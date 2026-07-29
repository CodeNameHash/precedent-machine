#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ACCEPTANCE_EXECUTABLE_CLOSURE_DIGEST,
  CONTRACT_CONFIGURATIONS,
  executableBindingsFor,
} = require('../lib/programme-gates/containment-contracts');
const {
  SECURITY_DISPOSITION_CONTRACT_CONFIGURATIONS,
} = require('../lib/programme-gates/security-disposition-contracts');
const {
  ISOLATION_CONTRACT_CONFIGURATIONS,
} = require('../lib/programme-gates/isolation-contracts');
const {
  REVIEW_CONTRACT_CONFIGURATIONS,
} = require('../lib/programme-gates/review-contracts');
const {
  CONTRACT_FREEZE_CONTRACT_CONFIGURATION,
} = require('../lib/programme-gates/contract-freeze-contracts');
const {
  ACCEPTANCE_PREDICATES,
} = require('../lib/programme-gates/predicates');
const {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
} = require('../lib/programme-gates/registry');
const { schemaFor } = require('../lib/programme-gates/schema-registry');
const {
  VALIDATOR_EXECUTABLE_FILES,
} = require('../lib/programme-gates/validator-executable');
const { domainDigest } = require('../lib/programme-gates/bytes');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_PATH = path.join(
  ROOT,
  'docs/codex-program/bootstrap-acceptance-source.json',
);
const SOURCE_MODULE_SEEDS = Object.freeze([
  'lib/programme-gates/registry.js',
  'lib/programme-gates/schema-registry.js',
  'lib/programme-gates/predicates.js',
  'lib/programme-gates/test-executable-registry.js',
  'lib/programme-gates/test-execution-attestation.js',
  'scripts/run-unimplemented-adversarial-test.mjs',
  'lib/programme-gates/validator.js',
  'lib/programme-gates/validator-executable.js',
  'lib/programme-gates/containment-contracts.js',
  'lib/programme-gates/containment-enumerator.js',
  'lib/programme-gates/containment-source-inventory.js',
  'lib/programme-gates/security-disposition-contracts.js',
  'lib/programme-gates/security-disposition-enumerator.js',
  'lib/programme-gates/isolation-contracts.js',
  'lib/programme-gates/isolation-enumerator.js',
  'lib/programme-gates/review-contracts.js',
  'lib/programme-gates/review-enumerator.js',
  'lib/programme-gates/git-authorship.js',
  'lib/programme-gates/review-artifact.js',
  'lib/programme-gates/contract-freeze-contracts.js',
]);

function localDependencySpecifiers(source) {
  return [
    ...source.matchAll(/\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g),
    ...source.matchAll(/\b(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"](\.[^'"]+)['"]/g),
  ].map((match) => match[1]);
}

function resolveLocalDependency(importer, specifier) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  const candidates = path.posix.extname(base)
    ? [base]
    : [base, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.js`];
  return candidates.find((candidate) => (
    !candidate.startsWith('../')
    && fs.existsSync(path.join(ROOT, candidate))
    && fs.statSync(path.join(ROOT, candidate)).isFile()
  )) || null;
}

function completeRuntimeSourceModules() {
  const pending = [...new Set([...SOURCE_MODULE_SEEDS, ...VALIDATOR_EXECUTABLE_FILES])];
  const discovered = new Set();
  const unresolved = [];
  while (pending.length > 0) {
    const relativePath = pending.shift();
    if (discovered.has(relativePath)) continue;
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      unresolved.push({ importer: 'ROOT_SEED', specifier: relativePath });
      continue;
    }
    discovered.add(relativePath);
    if (!/\.(?:js|mjs)$/.test(relativePath)) continue;
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const specifier of localDependencySpecifiers(source)) {
      const resolved = resolveLocalDependency(relativePath, specifier);
      if (resolved) pending.push(resolved);
      else unresolved.push({ importer: relativePath, specifier });
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`bootstrap runtime source has unresolved local dependencies: ${
      JSON.stringify(unresolved)
    }`);
  }
  return [...discovered].sort();
}

function exactInputs(configuration, claimKey) {
  if (configuration.claim_inputs?.[claimKey]) {
    return configuration.claim_inputs[claimKey];
  }
  const paths = Array.isArray(configuration.claim_paths[claimKey])
    ? configuration.claim_paths[claimKey]
    : [configuration.claim_paths[claimKey]];
  return paths.map((jsonPointer) => ({
    member_type: configuration.evidence_schema_id.replace(/\/V1$/, ''),
    json_pointer: jsonPointer,
  }));
}

const configurations = [
  ...CONTRACT_CONFIGURATIONS,
  ...SECURITY_DISPOSITION_CONTRACT_CONFIGURATIONS,
  ...ISOLATION_CONTRACT_CONFIGURATIONS,
  ...REVIEW_CONTRACT_CONFIGURATIONS,
  CONTRACT_FREEZE_CONTRACT_CONFIGURATION,
];

const definitions = configurations.map((configuration) => {
  const descriptor = ACCEPTANCE_DEFINITION_DESCRIPTORS.find(
    (candidate) => candidate.gate_id === configuration.gate_id,
  );
  if (!descriptor || descriptor.activation_state !== 'ACTIVE') {
    throw new Error(`${configuration.gate_id} lacks one active bootstrap descriptor`);
  }
  const predicates = ACCEPTANCE_PREDICATES[configuration.gate_id];
  if (!predicates) {
    throw new Error(`${configuration.gate_id} lacks frozen predicates`);
  }
  const executableBindings = executableBindingsFor(configuration);
  return {
    descriptor,
    evidence_schema: schemaFor(configuration.evidence_schema_id),
    evidence_subject_type: configuration.evidence_subject_type,
    evidence_subject_identity_fields: configuration.evidence_subject_identity_fields || [
      'gate_id',
      'code_commit',
      'runtime_deployment_id',
      'environment',
    ],
    member_universe: {
      universe_id: configuration.universe_id,
      ordering_rule: 'UTF8_MEMBER_TYPE_THEN_ID',
      duplicate_effect: 'OPEN',
      missing_or_extra_effect: 'OPEN',
      enumerator_executable_digest:
        executableBindings.member_enumerator.executable_digest,
      enumerator_transitive_source_closure_digest:
        ACCEPTANCE_EXECUTABLE_CLOSURE_DIGEST,
    },
    member_schemas: configuration.member_schema_set.map((entry) => ({
      ...entry,
      json_schema: schemaFor(entry.schema_id),
    })),
    ordered_claim_predicates: descriptor.ordered_claim_keys.map((claimKey) => {
      const predicate = predicates[claimKey];
      if (typeof predicate !== 'function') {
        throw new Error(`${configuration.gate_id}/${claimKey} lacks a predicate`);
      }
      return {
        claim_key: claimKey,
        result_type: 'BOOLEAN',
        exact_input_member_types_and_paths: exactInputs(configuration, claimKey),
        measurement_language: 'ECMASCRIPT_FUNCTION_SOURCE_V1',
        measurement_source: predicate.toString(),
        measurement_executable_digest:
          executableBindings.predicates[claimKey].executable_digest,
        measurement_transitive_source_closure_digest:
          ACCEPTANCE_EXECUTABLE_CLOSURE_DIGEST,
        comparison_operator: 'EQUALS',
        expected_typed_value: true,
      };
    }),
  };
});

const runtimeSourcePaths = completeRuntimeSourceModules();
const runtimeSourceModules = runtimeSourcePaths.map((relativePath) => {
  const bytes = fs.readFileSync(path.join(ROOT, relativePath));
  return {
    path: relativePath,
    byte_length: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    utf8_source: bytes.toString('utf8'),
  };
});
const runtimeSourceSetDigest = domainDigest(
  'PROGRAMME_GATE_BOOTSTRAP_RUNTIME_SOURCE_SET/V1',
  runtimeSourceModules.map(({ path: sourcePath, byte_length, sha256 }) => ({
    path: sourcePath,
    byte_length,
    sha256,
  })),
);
const source = {
  schema_version: 'ProgrammeGateBootstrapAcceptanceSource/V1',
  authority: 'ROOT_INDEPENDENT_REVIEWED_BOOTSTRAP_ACCEPTANCE_SOURCE',
  definition_count: 11,
  genesis_gate_count: 10,
  ordered_gate_ids: definitions.map((definition) => definition.descriptor.gate_id),
  definitions,
  acceptance_executable_closure_digest: ACCEPTANCE_EXECUTABLE_CLOSURE_DIGEST,
  validator_executable_files: VALIDATOR_EXECUTABLE_FILES,
  runtime_source_set_digest: runtimeSourceSetDigest,
  local_dependency_closure: {
    resolver: 'STATIC_RELATIVE_REQUIRE_IMPORT_EXPORT/V1',
    seed_paths: [...new Set([...SOURCE_MODULE_SEEDS, ...VALIDATOR_EXECUTABLE_FILES])].sort(),
    unresolved_local_dependencies: [],
  },
  runtime_source_modules: runtimeSourceModules,
};

if (source.ordered_gate_ids.length !== source.definition_count
  || new Set(source.ordered_gate_ids).size !== source.definition_count
  || source.ordered_gate_ids.at(-1) !== 'P1_CONTRACT_FREEZE_ATTESTED') {
  throw new Error('bootstrap acceptance source does not contain the closed eleven-gate order');
}

const output = `${JSON.stringify(source, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, 'utf8') !== output) {
    throw new Error('bootstrap acceptance source is not reproducible');
  }
} else {
  fs.writeFileSync(OUTPUT_PATH, output, { encoding: 'utf8' });
}
