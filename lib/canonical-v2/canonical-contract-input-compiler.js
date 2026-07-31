const fs = require('node:fs');
const path = require('node:path');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateAuthoredRelationshipInputs,
} = require('./canonical-contract-relationship-input-validator');
const {
  validateAuthoredTechnicalRelationshipInputs,
} = require('./canonical-contract-technical-relationship-validator');
const {
  validateAuthoredExceptedByInputs,
} = require('./canonical-contract-excepted-by-validator');
const {
  validateAuthoredNoShopSchemaInputs,
} = require('./canonical-contract-no-shop-schema-input-validator');
const {
  validateAuthoredRemainingMigrationInputs,
} = require('./canonical-contract-remaining-migration-input-validator');
const {
  validateAuthoredSharedAuthorityInputs,
} = require('./shared-authority-contract-input-validator');
const {
  validateAuthoredProcessInputs,
} = require('./process-contract-input-validator');
const {
  validateAuthoredProcessPredicateInputs,
} = require('./process-predicate-contract-input-validator');
const {
  validateAuthoredProcessServingInputs,
} = require('./process-serving-contract-input-validator');
const {
  validateAuthoredProcessSourceAcquisitionInputs,
} = require('./process-source-acquisition-contract-input-validator');
const {
  validateAuthoredProcessIntegrityInputs,
} = require('./process-integrity-contract-input-validator');
const {
  validateAuthoredProcessResultActionInputs,
} = require('./process-result-action-contract-input-validator');
const {
  validateAuthoredProcessFieldNavigationInputs,
} = require('./process-field-navigation-contract-input-validator');
const {
  validateAuthoredProcessQueryInputs,
} = require('./process-query-contract-input-validator');
const {
  validateAuthoredProcessGateInputs,
} = require('./process-gate-contract-input-validator');
const {
  validateAuthoredProductQueryInputs,
} = require('./product-query-contract-input-validator');
const {
  validateAuthoredProductQueryActionInputs,
} = require('./product-query-action-contract-input-validator');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');
const {
  validateAuthoredProductCandidateWriteInputs,
} = require('./product-candidate-write-contract-input-validator');
const {
  validateAuthoredProductResultActionInputs,
} = require('./product-result-action-contract-input-validator');
const {
  validateAuthoredProductSourceReaderInputs,
} = require('./product-source-reader-contract-input-validator');
const {
  validateAuthoredProductResultPresentationInputs,
} = require('./product-result-presentation-contract-input-validator');
const {
  validateAuthoredAgreementQueryOrderingInputs,
} = require('./agreement-query-ordering-contract-input-validator');
const {
  validateAuthoredAgreementRepresentationPredicateInputs,
} = require('./agreement-representation-predicate-contract-input-validator');
const {
  validateAuthoredAgreementNavigationInputs,
} = require('./agreement-navigation-contract-input-validator');
const {
  validateAuthoredQxoCapitalisationInputs,
} = require('./qxo-capitalisation-contract-input-validator');
const {
  validateAuthoredGovernedResidualInputs,
} = require('./governed-residual-contract-input-validator');
const {
  validateAuthoredPilotMarketMetricInputs,
} = require('./pilot-market-metric-contract-input-validator');
const {
  validateAuthoredPilotResultDefinitionInputs,
} = require('./pilot-result-definition-input-validator');
const {
  validateAuthoredProductServingInputs,
} = require('./product-serving-contract-input-validator');
const {
  validateAuthoredProcessPilotAdmissionAdapterContractInputs,
} = require('./metsera-exclusivity-process-phrasebook-admission-adapter-contract-input-validator');

const MANIFEST_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_MANIFEST/V1';
const COMPILER_INPUT_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_COMPILER/V1';
const GENERATOR_INPUT_SCHEMA_VERSION = 'CANONICAL_BUNDLE_GENERATOR_INPUT/V1';
const IDENTITY_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_IDENTITY/V1';
const COMPILATION_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_COMPILATION/V1';
const DISPOSITION_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_DISPOSITION/V1';
const REQUIRED_KIND_REGISTRY_OBJECT_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const REQUIRED_KIND_REGISTRY_STABLE_ID = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const REQUIRED_KIND_REGISTRY_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V1';
const UNIVERSE_ASSESSMENT_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_UNIVERSE_ASSESSMENT/V1';
const IDENTITY_DOMAIN = 'CANONICAL_BUNDLE_INPUT/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

class CanonicalContractInputCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractInputCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractInputCompilerError(code, message, details);
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requirePlainObject(value, label, code = 'INVALID_CANONICAL_BUNDLE_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be a JSON object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label, code = 'INVALID_CANONICAL_BUNDLE_INPUT') {
  requirePlainObject(value, label, code);
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} fields do not match the contract.`, {
      label,
      expected,
      actual,
    });
  }
}

function requireNonEmptyString(value, label, code = 'INVALID_CANONICAL_BUNDLE_INPUT') {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`, { label });
  }
  return value;
}

function validateRelativeJsonPath(value, label) {
  requireNonEmptyString(value, label, 'INVALID_CANONICAL_BUNDLE_INPUT_PATH');
  if (
    value.includes('\0')
    || value.includes('\\')
    || path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value.split('/').some((part) => part === '' || part === '.' || part === '..')
    || !value.endsWith('.json')
  ) {
    fail(
      'INVALID_CANONICAL_BUNDLE_INPUT_PATH',
      `${label} must be a normalised, non-escaping relative JSON path.`,
      { label, relative_path: value },
    );
  }
  return value;
}

function isWithinRoot(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function parseJsonFile(filePath, label) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail('CANONICAL_BUNDLE_INPUT_READ_FAILED', `Could not read ${label}.`, {
      label,
      cause_code: error.code || null,
    });
  }
  try {
    return JSON.parse(source);
  } catch {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_JSON', `${label} is not valid JSON.`, { label });
  }
}

function resolveRegularFile(root, relativePath, label) {
  const requested = path.resolve(root, ...relativePath.split('/'));
  if (!isWithinRoot(root, requested)) {
    fail('CANONICAL_BUNDLE_INPUT_PATH_ESCAPE', `${label} escapes the input root.`, {
      label,
      relative_path: relativePath,
    });
  }

  let stat;
  try {
    stat = fs.lstatSync(requested);
  } catch (error) {
    fail('CANONICAL_BUNDLE_INPUT_FILE_MISSING', `${label} does not exist.`, {
      label,
      relative_path: relativePath,
      cause_code: error.code || null,
    });
  }
  if (stat.isSymbolicLink()) {
    fail('CANONICAL_BUNDLE_INPUT_SYMLINK_NOT_ALLOWED', `${label} cannot be a symbolic link.`, {
      label,
      relative_path: relativePath,
    });
  }
  if (!stat.isFile()) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_FILE', `${label} must be a regular file.`, {
      label,
      relative_path: relativePath,
    });
  }

  const actual = fs.realpathSync(requested);
  if (!isWithinRoot(root, actual)) {
    fail('CANONICAL_BUNDLE_INPUT_PATH_ESCAPE', `${label} resolves outside the input root.`, {
      label,
      relative_path: relativePath,
    });
  }
  return actual;
}

function enumerateJsonFiles(root, manifestRelativePath) {
  const files = [];

  function walk(directory, relativeDirectory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareStrings(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        fail(
          'CANONICAL_BUNDLE_INPUT_SYMLINK_NOT_ALLOWED',
          'The canonical bundle input tree cannot contain symbolic links.',
          { relative_path: relativePath },
        );
      }
      if (stat.isDirectory()) {
        walk(absolutePath, relativePath);
      } else if (stat.isFile()) {
        if (relativePath.endsWith('.json') && relativePath !== manifestRelativePath) {
          files.push(relativePath);
        }
      } else {
        fail(
          'INVALID_CANONICAL_BUNDLE_INPUT_FILE',
          'The canonical bundle input tree contains an unsupported filesystem entry.',
          { relative_path: relativePath },
        );
      }
    }
  }

  walk(root, '');
  return files.sort(compareStrings);
}

function validateStringArray(
  value,
  label,
  code = 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    fail(code, `${label} must be an array of non-empty strings.`, {
      label,
    });
  }
  const ordered = [...value].sort(compareStrings);
  if (new Set(value).size !== value.length || canonicalJson(ordered) !== canonicalJson(value)) {
    fail(
      code,
      `${label} must contain unique strings in stable order.`,
      { label },
    );
  }
}

function validateRequiredKindRegistry(registry) {
  const code = 'INVALID_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
  requireExactKeys(registry, [
    'object_kind',
    'stable_id',
    'schema_version',
    'required_kinds',
  ], 'canonical bundle input required-kind registry', code);
  if (
    registry.object_kind !== REQUIRED_KIND_REGISTRY_OBJECT_KIND
    || registry.stable_id !== REQUIRED_KIND_REGISTRY_STABLE_ID
    || registry.schema_version !== REQUIRED_KIND_REGISTRY_SCHEMA_VERSION
  ) {
    fail(code, 'Required-kind registry identity does not match the governed contract.', {
      object_kind: registry.object_kind,
      stable_id: registry.stable_id,
      schema_version: registry.schema_version,
    });
  }
  if (!Array.isArray(registry.required_kinds) || registry.required_kinds.length === 0) {
    fail(code, 'Required-kind registry must contain a non-empty required_kinds array.');
  }

  const seen = new Set();
  let previousKind = null;
  const requiredKinds = registry.required_kinds.map((entry, index) => {
    const label = `required-kind registry.required_kinds[${index}]`;
    requireExactKeys(entry, [
      'object_kind',
      'minimum_count',
      'maximum_count',
      'allowed_schema_versions',
    ], label, code);
    const objectKind = requireNonEmptyString(entry.object_kind, `${label}.object_kind`, code);
    if (seen.has(objectKind)) {
      fail(
        'DUPLICATE_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND',
        'Required-kind registry object kinds must be unique.',
        { object_kind: objectKind },
      );
    }
    seen.add(objectKind);
    if (previousKind !== null && compareStrings(previousKind, objectKind) >= 0) {
      fail(
        'UNSTABLE_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_ORDER',
        'Required-kind registry entries must be strictly ordered by object_kind.',
        { previous_object_kind: previousKind, object_kind: objectKind },
      );
    }
    previousKind = objectKind;
    if (!Number.isSafeInteger(entry.minimum_count) || entry.minimum_count < 1) {
      fail(code, `${label}.minimum_count must be a positive safe integer.`, {
        object_kind: objectKind,
        minimum_count: entry.minimum_count,
      });
    }
    if (
      !Number.isSafeInteger(entry.maximum_count)
      || entry.maximum_count !== entry.minimum_count
    ) {
      fail(
        code,
        `${label}.maximum_count must be a safe integer equal to minimum_count.`,
        {
          object_kind: objectKind,
          minimum_count: entry.minimum_count,
          maximum_count: entry.maximum_count,
        },
      );
    }
    validateStringArray(entry.allowed_schema_versions, `${label}.allowed_schema_versions`, code);
    return clone(entry);
  });

  const selfRequirement = requiredKinds.find(
    (entry) => entry.object_kind === REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  );
  if (
    !selfRequirement
    || selfRequirement.minimum_count !== 1
    || selfRequirement.maximum_count !== 1
    || canonicalJson(selfRequirement.allowed_schema_versions)
      !== canonicalJson([REQUIRED_KIND_REGISTRY_SCHEMA_VERSION])
  ) {
    fail(
      'INVALID_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_SELF_REQUIREMENT',
      'Required-kind registry must require exactly one copy of its own governed schema.',
    );
  }
  return requiredKinds;
}

function assessAuthoredInputUniverse(authoredMembers, perKindCounts, perKindSchemaVersions) {
  const registries = authoredMembers.filter(
    (member) => member.object_kind === REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  );
  if (registries.length === 0) {
    return {
      schema_version: UNIVERSE_ASSESSMENT_SCHEMA_VERSION,
      status: 'NOT_ASSESSED',
      required_kind_registry_binding: null,
      ordered_kind_results: [],
    };
  }
  if (registries.length !== 1) {
    fail(
      'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY_CARDINALITY',
      'Authored input must contain at most one governed required-kind registry.',
      { actual_count: registries.length },
    );
  }

  const registryMember = registries[0];
  const requiredKinds = validateRequiredKindRegistry(registryMember.canonical_value);
  const requiredKindSet = new Set(requiredKinds.map((entry) => entry.object_kind));
  const missingRequiredKinds = [];
  const countMismatches = [];
  const schemaVersionMismatches = [];

  for (const entry of requiredKinds) {
    const actualCount = perKindCounts[entry.object_kind] || 0;
    if (actualCount === 0) {
      missingRequiredKinds.push(entry.object_kind);
    } else if (
      actualCount < entry.minimum_count
      || (entry.maximum_count !== null && actualCount > entry.maximum_count)
    ) {
      countMismatches.push({
        object_kind: entry.object_kind,
        minimum_count: entry.minimum_count,
        maximum_count: entry.maximum_count,
        actual_count: actualCount,
      });
    }
    const actualSchemaVersions = perKindSchemaVersions[entry.object_kind] || [];
    const unsupportedSchemaVersions = actualSchemaVersions.filter(
      (version) => !entry.allowed_schema_versions.includes(version),
    );
    if (unsupportedSchemaVersions.length > 0) {
      schemaVersionMismatches.push({
        object_kind: entry.object_kind,
        allowed_schema_versions: entry.allowed_schema_versions,
        actual_schema_versions: actualSchemaVersions,
        unsupported_schema_versions: unsupportedSchemaVersions,
      });
    }
  }

  const undeclaredAuthoredKinds = Object.keys(perKindCounts)
    .filter((objectKind) => !requiredKindSet.has(objectKind))
    .sort(compareStrings);
  if (
    missingRequiredKinds.length > 0
    || undeclaredAuthoredKinds.length > 0
    || countMismatches.length > 0
    || schemaVersionMismatches.length > 0
  ) {
    fail(
      'CANONICAL_BUNDLE_INPUT_UNIVERSE_MISMATCH',
      'Authored input does not match the governed required-kind registry.',
      {
        missing_required_kinds: missingRequiredKinds,
        undeclared_authored_kinds: undeclaredAuthoredKinds,
        count_mismatches: countMismatches,
        schema_version_mismatches: schemaVersionMismatches,
      },
    );
  }

  return {
    schema_version: UNIVERSE_ASSESSMENT_SCHEMA_VERSION,
    status: 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
    required_kind_registry_binding: {
      relative_path: registryMember.relative_path,
      stable_id: registryMember.stable_id,
      schema_version: registryMember.schema_version,
      canonical_bytes_digest: registryMember.canonical_bytes_digest,
    },
    ordered_kind_results: requiredKinds.map((entry) => ({
      object_kind: entry.object_kind,
      minimum_count: entry.minimum_count,
      maximum_count: entry.maximum_count,
      actual_count: perKindCounts[entry.object_kind],
      allowed_schema_versions: entry.allowed_schema_versions,
      actual_schema_versions: perKindSchemaVersions[entry.object_kind],
      status: 'PASS',
    })),
  };
}

function validatePerKindDeclarations(manifest, derivedCounts, derivedSchemaVersions) {
  requirePlainObject(
    manifest.per_kind_counts,
    'manifest.per_kind_counts',
    'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
  );
  for (const [kind, count] of Object.entries(manifest.per_kind_counts)) {
    requireNonEmptyString(kind, 'manifest.per_kind_counts key', 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
    if (!Number.isSafeInteger(count) || count < 1) {
      fail(
        'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
        'manifest.per_kind_counts values must be positive safe integers.',
        { object_kind: kind, count },
      );
    }
  }
  if (canonicalJson(manifest.per_kind_counts) !== canonicalJson(derivedCounts)) {
    fail(
      'CANONICAL_BUNDLE_INPUT_KIND_COUNT_MISMATCH',
      'Manifest per-kind counts do not match the authored members.',
      { declared: manifest.per_kind_counts, derived: derivedCounts },
    );
  }

  requirePlainObject(
    manifest.per_kind_schema_versions,
    'manifest.per_kind_schema_versions',
    'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
  );
  for (const [kind, versions] of Object.entries(manifest.per_kind_schema_versions)) {
    validateStringArray(versions, `manifest.per_kind_schema_versions.${kind}`);
  }
  if (canonicalJson(manifest.per_kind_schema_versions) !== canonicalJson(derivedSchemaVersions)) {
    fail(
      'CANONICAL_BUNDLE_INPUT_KIND_SCHEMA_VERSION_MISMATCH',
      'Manifest per-kind schema versions do not match the authored members.',
      {
        declared: manifest.per_kind_schema_versions,
        derived: derivedSchemaVersions,
      },
    );
  }
}

function derivePerKindDeclarations(entries) {
  const counts = new Map();
  const versions = new Map();
  for (const entry of entries) {
    counts.set(entry.object_kind, (counts.get(entry.object_kind) || 0) + 1);
    if (!versions.has(entry.object_kind)) versions.set(entry.object_kind, new Set());
    versions.get(entry.object_kind).add(entry.schema_version);
  }

  const perKindCounts = {};
  const perKindSchemaVersions = {};
  for (const kind of [...counts.keys()].sort(compareStrings)) {
    perKindCounts[kind] = counts.get(kind);
    perKindSchemaVersions[kind] = [...versions.get(kind)].sort(compareStrings);
  }
  return { perKindCounts, perKindSchemaVersions };
}

function validateManifest(manifest, manifestRelativePath) {
  requireExactKeys(manifest, [
    'schema_version',
    'compiler_input_schema_version',
    'generator_input_schema_version',
    'members',
    'per_kind_counts',
    'per_kind_schema_versions',
  ], 'canonical bundle input manifest', 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
  if (manifest.schema_version !== MANIFEST_SCHEMA_VERSION) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST', 'Manifest schema version is not supported.');
  }
  if (manifest.compiler_input_schema_version !== COMPILER_INPUT_SCHEMA_VERSION) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST', 'Compiler input schema version is not supported.');
  }
  if (manifest.generator_input_schema_version !== GENERATOR_INPUT_SCHEMA_VERSION) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST', 'Generator input schema version is not supported.');
  }
  if (!Array.isArray(manifest.members) || manifest.members.length === 0) {
    fail(
      'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
      'Manifest members must be an explicit non-empty array.',
    );
  }

  const paths = new Set();
  const identities = new Set();
  let previousPath = null;
  const entries = manifest.members.map((member, index) => {
    const label = `manifest.members[${index}]`;
    requireExactKeys(member, [
      'relative_path',
      'object_kind',
      'stable_id',
      'schema_version',
      'canonical_bytes_digest',
    ], label, 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
    const relativePath = validateRelativeJsonPath(member.relative_path, `${label}.relative_path`);
    if (relativePath === manifestRelativePath) {
      fail(
        'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
        'The manifest cannot list itself as an authored member.',
        { relative_path: relativePath },
      );
    }
    requireNonEmptyString(member.object_kind, `${label}.object_kind`, 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
    requireNonEmptyString(member.stable_id, `${label}.stable_id`, 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
    requireNonEmptyString(member.schema_version, `${label}.schema_version`, 'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST');
    if (!SHA256_RE.test(member.canonical_bytes_digest || '')) {
      fail(
        'INVALID_CANONICAL_BUNDLE_INPUT_MANIFEST',
        `${label}.canonical_bytes_digest must be a lowercase SHA-256 digest.`,
      );
    }
    if (paths.has(relativePath)) {
      fail(
        'DUPLICATE_CANONICAL_BUNDLE_INPUT_PATH',
        'Manifest member paths must be unique.',
        { relative_path: relativePath },
      );
    }
    paths.add(relativePath);
    const identity = canonicalJson([member.object_kind, member.stable_id]);
    if (identities.has(identity)) {
      fail(
        'DUPLICATE_CANONICAL_BUNDLE_INPUT_IDENTITY',
        'Manifest (object_kind, stable_id) pairs must be unique.',
        { object_kind: member.object_kind, stable_id: member.stable_id },
      );
    }
    identities.add(identity);
    if (previousPath !== null && compareStrings(previousPath, relativePath) >= 0) {
      fail(
        'UNSTABLE_CANONICAL_BUNDLE_INPUT_ORDER',
        'Manifest members must be strictly ordered by relative_path.',
        { previous_relative_path: previousPath, relative_path: relativePath },
      );
    }
    previousPath = relativePath;
    return clone(member);
  });

  return entries;
}

function emptyValidationRoots() {
  return {
    missing_input_root: contentId('CANONICAL_BUNDLE_INPUT_MISSING_ROOT/V1', []),
    extra_input_root: contentId('CANONICAL_BUNDLE_INPUT_EXTRA_ROOT/V1', []),
    duplicate_input_root: contentId('CANONICAL_BUNDLE_INPUT_DUPLICATE_ROOT/V1', []),
    conflicting_input_root: contentId('CANONICAL_BUNDLE_INPUT_CONFLICT_ROOT/V1', []),
  };
}

function compileCanonicalContractInput({
  root_directory: rootDirectory,
  manifest_path: manifestPath = 'manifest.json',
} = {}) {
  requireNonEmptyString(
    rootDirectory,
    'root_directory',
    'INVALID_CANONICAL_BUNDLE_INPUT_COMPILER_ARGUMENT',
  );
  const manifestRelativePath = validateRelativeJsonPath(manifestPath, 'manifest_path');

  let root;
  try {
    root = fs.realpathSync(path.resolve(rootDirectory));
  } catch (error) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_ROOT', 'root_directory does not exist.', {
      cause_code: error.code || null,
    });
  }
  if (!fs.lstatSync(root).isDirectory()) {
    fail('INVALID_CANONICAL_BUNDLE_INPUT_ROOT', 'root_directory must be a directory.');
  }

  const manifestFile = resolveRegularFile(root, manifestRelativePath, 'manifest');
  const manifest = parseJsonFile(manifestFile, 'manifest');
  const declaredEntries = validateManifest(manifest, manifestRelativePath);
  const actualPaths = enumerateJsonFiles(root, manifestRelativePath);
  const declaredPaths = declaredEntries.map((entry) => entry.relative_path);
  const actualSet = new Set(actualPaths);
  const declaredSet = new Set(declaredPaths);
  const missing = declaredPaths.filter((relativePath) => !actualSet.has(relativePath));
  const extra = actualPaths.filter((relativePath) => !declaredSet.has(relativePath));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      'CANONICAL_BUNDLE_INPUT_CLOSED_SET_MISMATCH',
      'Manifest membership does not exactly match the JSON files under the input root.',
      { missing, extra },
    );
  }

  const seenActualFiles = new Set();
  const authoredMembers = declaredEntries.map((declared, index) => {
    const file = resolveRegularFile(root, declared.relative_path, `member ${declared.relative_path}`);
    if (seenActualFiles.has(file)) {
      fail(
        'DUPLICATE_CANONICAL_BUNDLE_INPUT_FILE',
        'Different manifest paths resolve to the same authored member file.',
        { relative_path: declared.relative_path },
      );
    }
    seenActualFiles.add(file);
    const value = parseJsonFile(file, `member ${declared.relative_path}`);
    requirePlainObject(
      value,
      `member ${declared.relative_path}`,
      'INVALID_CANONICAL_BUNDLE_INPUT_MEMBER',
    );
    for (const key of ['object_kind', 'stable_id', 'schema_version']) {
      if (value[key] !== declared[key]) {
        fail(
          'CANONICAL_BUNDLE_INPUT_MEMBER_METADATA_MISMATCH',
          `Member ${declared.relative_path} does not match manifest ${key}.`,
          {
            relative_path: declared.relative_path,
            field: key,
            declared: declared[key],
            actual: value[key],
          },
        );
      }
    }
    const canonicalBytes = Buffer.from(canonicalJson(value), 'utf8');
    const canonicalBytesDigest = sha256Hex(canonicalBytes);
    if (canonicalBytesDigest !== declared.canonical_bytes_digest) {
      fail(
        'CANONICAL_BUNDLE_INPUT_DIGEST_MISMATCH',
        `Member ${declared.relative_path} canonical bytes do not match the manifest digest.`,
        {
          relative_path: declared.relative_path,
          declared: declared.canonical_bytes_digest,
          actual: canonicalBytesDigest,
        },
      );
    }
    return {
      relative_path: declared.relative_path,
      object_kind: declared.object_kind,
      stable_id: declared.stable_id,
      schema_version: declared.schema_version,
      canonical_bytes_digest: canonicalBytesDigest,
      canonical_byte_length: canonicalBytes.length,
      contract_ordinal: index,
      canonical_value: clone(value),
    };
  });
  validateAuthoredRelationshipInputs(authoredMembers);
  validateAuthoredTechnicalRelationshipInputs(authoredMembers);
  validateAuthoredExceptedByInputs(authoredMembers);
  validateAuthoredNoShopSchemaInputs(authoredMembers);
  validateAuthoredRemainingMigrationInputs(authoredMembers);
  validateAuthoredSharedAuthorityInputs(authoredMembers);
  validateAuthoredProcessInputs(authoredMembers);
  validateAuthoredProcessPredicateInputs(authoredMembers);
  validateAuthoredProcessServingInputs(authoredMembers);
  validateAuthoredProcessSourceAcquisitionInputs(authoredMembers);
  validateAuthoredProcessIntegrityInputs(authoredMembers);
  validateAuthoredProcessResultActionInputs(authoredMembers);
  validateAuthoredProcessFieldNavigationInputs(authoredMembers);
  validateAuthoredProcessQueryInputs(authoredMembers);
  validateAuthoredProcessGateInputs(authoredMembers);
  validateAuthoredProductQueryInputs(authoredMembers);
  validateAuthoredProductQueryActionInputs(authoredMembers);
  validateAuthoredProductQueryResultInputs(authoredMembers);
  validateAuthoredProductCandidateWriteInputs(authoredMembers);
  validateAuthoredProductResultActionInputs(authoredMembers);
  validateAuthoredProductSourceReaderInputs(authoredMembers);
  validateAuthoredProductResultPresentationInputs(authoredMembers);
  validateAuthoredAgreementQueryOrderingInputs(authoredMembers);
  validateAuthoredAgreementRepresentationPredicateInputs(authoredMembers);
  validateAuthoredAgreementNavigationInputs(authoredMembers);
  validateAuthoredQxoCapitalisationInputs(authoredMembers);
  validateAuthoredGovernedResidualInputs(authoredMembers);
  validateAuthoredPilotMarketMetricInputs(authoredMembers);
  validateAuthoredPilotResultDefinitionInputs(authoredMembers);
  validateAuthoredProductServingInputs(authoredMembers);
  validateAuthoredProcessPilotAdmissionAdapterContractInputs(authoredMembers);

  const orderedEntries = authoredMembers.map((member) => ({
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    canonical_bytes_digest: member.canonical_bytes_digest,
  }));
  const { perKindCounts, perKindSchemaVersions } = derivePerKindDeclarations(authoredMembers);
  validatePerKindDeclarations(manifest, perKindCounts, perKindSchemaVersions);
  const authoredUniverseAssessment = assessAuthoredInputUniverse(
    authoredMembers,
    perKindCounts,
    perKindSchemaVersions,
  );

  const manifestPayloadDigest = contentId(
    'CANONICAL_BUNDLE_INPUT_MANIFEST_PAYLOAD/V1',
    manifest,
  );
  const manifestId = contentId('CANONICAL_BUNDLE_INPUT_MANIFEST/V1', {
    schema_version: manifest.schema_version,
    canonical_payload_digest: manifestPayloadDigest,
  });
  const identityBody = {
    schema_version: IDENTITY_SCHEMA_VERSION,
    root_input_manifest_id: manifestId,
    root_input_manifest_payload_digest: manifestPayloadDigest,
    compiler_input_schema_version: manifest.compiler_input_schema_version,
    generator_input_schema_version: manifest.generator_input_schema_version,
    ordered_entries: orderedEntries,
    per_kind_counts: perKindCounts,
    per_kind_schema_versions: perKindSchemaVersions,
    validation_roots: emptyValidationRoots(),
  };
  const identityPayloadDigest = contentId(
    'CANONICAL_BUNDLE_INPUT_IDENTITY_PAYLOAD/V1',
    identityBody,
  );
  const identity = {
    ...identityBody,
    canonical_payload_digest: identityPayloadDigest,
    canonical_bundle_input_identity_id: contentId(IDENTITY_DOMAIN, identityBody),
  };

  return deepFreeze({
    schema_version: COMPILATION_SCHEMA_VERSION,
    canonical_bundle_input_identity: identity,
    authored_members: authoredMembers,
    authored_universe_assessment: authoredUniverseAssessment,
    disposition: {
      schema_version: DISPOSITION_SCHEMA_VERSION,
      status: authoredUniverseAssessment.status === 'NOT_ASSESSED'
        ? 'INCOMPLETE_UNIVERSE'
        : 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE',
      reason_code: authoredUniverseAssessment.status === 'NOT_ASSESSED'
        ? 'GOVERNED_REQUIRED_KIND_REGISTRY_NOT_SUPPLIED'
        : 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED',
      freeze_eligible: false,
      canonical_contract_bundle_authority: 'NONE',
      p1_gate_status: 'NOT_EVALUATED',
    },
  });
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  COMPILER_INPUT_SCHEMA_VERSION,
  GENERATOR_INPUT_SCHEMA_VERSION,
  IDENTITY_SCHEMA_VERSION,
  COMPILATION_SCHEMA_VERSION,
  DISPOSITION_SCHEMA_VERSION,
  REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  REQUIRED_KIND_REGISTRY_STABLE_ID,
  REQUIRED_KIND_REGISTRY_SCHEMA_VERSION,
  UNIVERSE_ASSESSMENT_SCHEMA_VERSION,
  IDENTITY_DOMAIN,
  CanonicalContractInputCompilerError,
  compileCanonicalContractInput,
};
