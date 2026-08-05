'use strict';

const path = require('node:path');
const fs = require('node:fs');

const { canonicalJson, contentId } = require('../canonical-bytes');
const { QUERY_CONTAINED_ROUTE_FILES } = require('../../query-containment');

const REGISTER_SCHEMA = 'CANONICAL_V2_M3_FAMILY_PARITY_REGISTER/V3';
const STATUS_SCHEMA = 'CANONICAL_V2_M3_FAMILY_PARITY_STATUS/V3';
const MILESTONE_ID = 'M3_FULL_CORPUS_CERTIFICATION';
const SOURCE_KINDS = Object.freeze([
  'DERIVED_VALUE',
  'COMPARE_FIELD',
  'MARKET_FIELD',
  'QUERY_FIELD',
  'RENDERED_ROW',
  'SIDE_TABLE',
]);
const FAMILY_IDS = Object.freeze([
  'ANTITRUST_REGULATORY_EFFORTS',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CLOSING_CONDITIONS',
  'CONSIDERATION',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING_COVENANTS',
  'KEY_DEFINED_TERMS',
  'MAE_DEFINITION',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'NO_SHOP',
  'PROXY_MEETING_COVENANTS',
  'REPRESENTATIONS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION_FEE',
  'TERMINATION_RIGHTS',
]);
const SUPPLEMENTAL_OWNER_IDS = Object.freeze([
  'GENERAL_COVENANT_ROUTER',
  'MATERIAL_CONTRACTS',
  'NO_OTHER_REPS_FRAUD',
]);
const STATES = Object.freeze(['BLOCKED', 'OPEN', 'PASS']);
const SURFACE_KEYS = Object.freeze([
  'disposition',
  'evidence_paths',
  'source_kind',
  'source_locator',
  'source_path',
  'state',
  'surface_id',
  'wave',
]);
const ADAPTER_SET_VALUES = Object.freeze(['ALTERNATIVES']);
const WAVE_A_CHECKS = Object.freeze([
  'fixture_proof',
  'lexical_net',
  'producer',
  'registry',
  'resolver',
]);
const OPEN_DISPOSITION = 'FOLLOW_ON_REQUIRED';
const TERMINAL_DISPOSITIONS = Object.freeze([
  'APPROVED_DERIVED',
  'APPROVED_RETIRED',
  'EVIDENCE_ONLY',
  'NATIVE_COMPLETE',
]);
const LEGACY_SUPPORT_STATES = Object.freeze([
  'LIVE_LEGACY_CARD_FEATURES',
  'LIVE_LEGACY_DERIVATION',
]);
const NON_SEMANTIC_UNASSIGNED_REASONS = Object.freeze([
  'UNADJUDICATED_RETAINED_BOUNDED_',
  'UNSUPPORTED_NATIVE_CLAIM_DOWNGRADED_TO_BOUNDED_EVIDENCE',
]);
const REGISTER_PATH = path.resolve(
  __dirname,
  '../../../docs/codex-program/m3-family-parity-register.json',
);
const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const REGISTER_SEMANTICS = Object.freeze({
  disposition_field: 'APPROVED_SCOPE_DISPOSITION',
  state_field: 'EVIDENCE_RECORD_STATE_NOT_PRODUCT_SEMANTIC_COMPLETION',
  live_product_visibility: 'DERIVED_BY_VALIDATOR_FROM_EXACT_SOURCE_LOCATOR_AND_PROOF_PATHS',
  live_legacy_support: 'RECORDED_SEPARATELY_FROM_NATIVE_V2_SEMANTIC_COMPLETION',
});

class M3FamilyParityRegisterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3FamilyParityRegisterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new M3FamilyParityRegisterError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    fail('INVALID_PARITY_REGISTER', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function state(value, label) {
  if (!STATES.includes(value)) {
    fail('INVALID_PARITY_REGISTER', `${label} must use an allowed programme state.`, { value });
  }
  return value;
}

function repositoryPath(value, label) {
  text(value, label);
  if (
    value.startsWith('/')
    || value.includes('\\')
    || value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail('INVALID_PARITY_REGISTER', `${label} must be a safe repository-relative path.`);
  }
  const resolved = path.resolve(REPOSITORY_ROOT, value);
  if (!resolved.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) {
    fail('INVALID_PARITY_REGISTER', `${label} escapes the repository root.`);
  }
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    fail('PARITY_EVIDENCE_PATH_MISSING', `${label} does not exist.`, { path: value });
  }
  if ((!stat.isFile() && !stat.isDirectory()) || stat.isSymbolicLink()) {
    fail('PARITY_EVIDENCE_PATH_INVALID', `${label} must be a repository file or directory.`, { path: value });
  }
  return resolved;
}

function evidencePaths(value, label, itemState) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) {
    fail('INVALID_PARITY_REGISTER', `${label} must be an array of repository paths.`);
  }
  if (itemState === 'PASS' && value.length === 0) {
    fail('UNSUPPORTED_PARITY_PASS', `${label} must contain evidence before the item can pass.`);
  }
  value.forEach((entry, index) => repositoryPath(entry, `${label}[${index}]`));
  return value;
}

function stripCodeComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

// Source reads are memoised because the serving-path proof walks the same product files
// many times per register evaluation. Repository contents cannot change inside one
// validator run, so a per-process cache cannot mask a real change.
const rawSourceCache = new Map();
function readRawSource(modulePath) {
  if (rawSourceCache.has(modulePath)) return rawSourceCache.get(modulePath);
  let value = null;
  try {
    value = fs.readFileSync(repositoryPath(modulePath, 'serving path source'), 'utf8');
  } catch {
    value = null;
  }
  rawSourceCache.set(modulePath, value);
  return value;
}

const strippedSourceCache = new Map();
function readStrippedSource(modulePath) {
  if (strippedSourceCache.has(modulePath)) return strippedSourceCache.get(modulePath);
  const raw = readRawSource(modulePath);
  const value = raw === null ? null : stripCodeComments(raw);
  strippedSourceCache.set(modulePath, value);
  return value;
}

function jsonPointerResolves(pointer, sourcePath, label) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) {
    fail('INVALID_PARITY_LOCATOR', `${label} must use an RFC 6901 JSON pointer.`);
  }
  let value;
  try {
    value = JSON.parse(fs.readFileSync(repositoryPath(sourcePath, `${label}.source_path`), 'utf8'));
  } catch {
    fail('INVALID_PARITY_LOCATOR', `${label} source is not valid JSON.`);
  }
  for (const encoded of pointer.slice(1).split('/')) {
    const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
      return false;
    }
    value = value[key];
  }
  return true;
}

function exactLocatorResolves(sourcePath, sourceLocator, label) {
  const sourceStat = fs.lstatSync(repositoryPath(sourcePath, `${label}.source_path`));
  if (!sourceStat.isFile()) {
    fail('PARITY_LOCATOR_SOURCE_NOT_FILE', `${label}.source_path must name a source file.`);
  }
  if (sourcePath.endsWith('.json')) {
    return jsonPointerResolves(sourceLocator, sourcePath, label);
  }
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(sourceLocator)) {
    fail('INVALID_PARITY_LOCATOR', `${label} must be an exact JavaScript symbol.`);
  }
  const source = stripCodeComments(fs.readFileSync(
    repositoryPath(sourcePath, `${label}.source_path`),
    'utf8',
  ));
  const symbol = sourceLocator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${symbol}\\b`).test(source);
}

function validateCheck(check, label) {
  if (!exactKeys(check, ['evidence_paths', 'state'])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed Wave A check contract.`);
  }
  const checkState = state(check.state, `${label}.state`);
  evidencePaths(check.evidence_paths, `${label}.evidence_paths`, checkState);
}

function validateSurface(surface, label) {
  // `adapter_set` is the only optional member. Ruling 1 (Ben, 2026-08-05): a surface naming
  // several adapters requires exact consumer proof for every one of them. Omitting the key
  // therefore means ALL_REQUIRED; the express value ALTERNATIVES is the sole opt-out.
  if (!exactKeys(surface, SURFACE_KEYS)
    && !exactKeys(surface, [...SURFACE_KEYS, 'adapter_set'])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed product-surface contract.`);
  }
  if (surface.adapter_set !== undefined && !ADAPTER_SET_VALUES.includes(surface.adapter_set)) {
    fail('INVALID_PARITY_REGISTER', `${label}.adapter_set may only be the express value ALTERNATIVES.`, {
      adapter_set: surface.adapter_set,
    });
  }
  text(surface.surface_id, `${label}.surface_id`);
  if (!SOURCE_KINDS.includes(surface.source_kind)) {
    fail('INVALID_PARITY_REGISTER', `${label}.source_kind is not governed.`, {
      source_kind: surface.source_kind,
    });
  }
  text(surface.source_path, `${label}.source_path`);
  text(surface.source_locator, `${label}.source_locator`);
  if (surface.source_path.startsWith('docs/')) {
    fail('INVALID_PARITY_SOURCE_PATH', `${label}.source_path cannot use a decision or design document as product-serving proof.`);
  }
  repositoryPath(surface.source_path, `${label}.source_path`);
  if (!exactLocatorResolves(surface.source_path, surface.source_locator, label)) {
    fail('PARITY_LOCATOR_NOT_FOUND', `${label}.source_locator does not resolve in source_path.`);
  }
  if (surface.wave !== 'FOLLOW_ON') {
    fail('INVALID_PARITY_REGISTER', `${label}.wave must be FOLLOW_ON.`);
  }
  const surfaceState = state(surface.state, `${label}.state`);
  evidencePaths(surface.evidence_paths, `${label}.evidence_paths`, surfaceState);
  const permittedDispositions = [OPEN_DISPOSITION, ...TERMINAL_DISPOSITIONS];
  if (!permittedDispositions.includes(surface.disposition)) {
    fail('INVALID_PARITY_REGISTER', `${label}.disposition is not governed.`);
  }
  if (surfaceState === 'PASS' && !TERMINAL_DISPOSITIONS.includes(surface.disposition)) {
    fail('OPEN_FOLLOW_ON_CANNOT_PASS', `${label} cannot pass while follow-on work is required.`);
  }
  if (surfaceState !== 'PASS' && surface.disposition !== OPEN_DISPOSITION) {
    fail('TERMINAL_DISPOSITION_NOT_PROVEN', `${label} cannot use a terminal disposition before it passes.`);
  }
  if (surface.disposition === 'APPROVED_RETIRED' && !surface.evidence_paths.some((evidencePath) => (
    evidencePath !== surface.source_path && !evidencePath.startsWith('tests/')
  ))) {
    fail('UNSUPPORTED_RETIRED_SURFACE', `${label} requires non-test evidence separate from the retired source.`);
  }
}

function validateFamily(family, index) {
  const label = `families[${index}]`;
  if (!exactKeys(family, [
    'design_path',
    'family_id',
    'product_surfaces',
    'wave_a',
  ])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed family contract.`);
  }
  text(family.family_id, `${label}.family_id`);
  text(family.design_path, `${label}.design_path`);
  if (!exactKeys(family.wave_a, ['checks', 'scope'])) {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a must match the closed Wave A contract.`);
  }
  if (family.wave_a.scope !== 'FIRST_NATIVE_SLICE') {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a.scope must be FIRST_NATIVE_SLICE.`);
  }
  if (!exactKeys(family.wave_a.checks, WAVE_A_CHECKS)) {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a.checks must contain every required build check.`);
  }
  WAVE_A_CHECKS.forEach((key) => validateCheck(
    family.wave_a.checks[key],
    `${label}.wave_a.checks.${key}`,
  ));
  if (!Array.isArray(family.product_surfaces) || family.product_surfaces.length === 0) {
    fail('INVALID_PARITY_REGISTER', `${label}.product_surfaces must not be empty.`);
  }
  family.product_surfaces.forEach((surface, surfaceIndex) => (
    validateSurface(surface, `${label}.product_surfaces[${surfaceIndex}]`)
  ));
}

function validateUnassignedSurface(surface, index) {
  const label = `unassigned_product_surfaces[${index}]`;
  if (!exactKeys(surface, [
    'reason',
    'source_kind',
    'source_locator',
    'source_path',
    'surface_id',
  ])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed unassigned-surface contract.`);
  }
  text(surface.surface_id, `${label}.surface_id`);
  if (!SOURCE_KINDS.includes(surface.source_kind)) {
    fail('INVALID_PARITY_REGISTER', `${label}.source_kind is not governed.`);
  }
  text(surface.source_path, `${label}.source_path`);
  text(surface.source_locator, `${label}.source_locator`);
  repositoryPath(surface.source_path, `${label}.source_path`);
  if (!exactLocatorResolves(surface.source_path, surface.source_locator, label)) {
    fail('PARITY_LOCATOR_NOT_FOUND', `${label}.source_locator does not resolve in source_path.`);
  }
  text(surface.reason, `${label}.reason`);
}

function validateSupplementalOwner(owner, index) {
  const label = `supplemental_owners[${index}]`;
  if (!exactKeys(owner, ['first_slice', 'owner_id', 'owner_kind', 'ownership_path', 'product_surfaces'])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed supplemental-owner contract.`);
  }
  text(owner.owner_id, `${label}.owner_id`);
  text(owner.owner_kind, `${label}.owner_kind`);
  text(owner.ownership_path, `${label}.ownership_path`);
  if (!exactKeys(owner.first_slice, ['evidence_paths', 'state'])) fail('INVALID_PARITY_REGISTER', `${label}.first_slice is invalid.`);
  evidencePaths(owner.first_slice.evidence_paths, `${label}.first_slice.evidence_paths`, state(owner.first_slice.state, `${label}.first_slice.state`));
  if (!Array.isArray(owner.product_surfaces) || owner.product_surfaces.length === 0) fail('INVALID_PARITY_REGISTER', `${label}.product_surfaces must not be empty.`);
  owner.product_surfaces.forEach((surface, surfaceIndex) => validateSurface(surface, `${label}.product_surfaces[${surfaceIndex}]`));
}

function allProductSurfaces(register) {
  return [
    ...register.families.flatMap((family) => family.product_surfaces),
    ...register.supplemental_owners.flatMap((owner) => owner.product_surfaces),
  ];
}

function validateLiveLegacySupport(register) {
  if (!Array.isArray(register.live_legacy_support)) {
    fail('INVALID_PARITY_REGISTER', 'live_legacy_support must be an array.');
  }
  const knownSurfaceIds = new Set(allProductSurfaces(register).map((surface) => surface.surface_id));
  const seen = new Set();
  register.live_legacy_support.forEach((entry, index) => {
    const label = `live_legacy_support[${index}]`;
    if (!exactKeys(entry, ['evidence_paths', 'state', 'surface_id'])) {
      fail('INVALID_PARITY_REGISTER', `${label} must match the closed live-legacy contract.`);
    }
    text(entry.surface_id, `${label}.surface_id`);
    if (!knownSurfaceIds.has(entry.surface_id) || seen.has(entry.surface_id)) {
      fail('INVALID_PARITY_REGISTER', `${label}.surface_id must name one unique registered product surface.`);
    }
    seen.add(entry.surface_id);
    if (!LEGACY_SUPPORT_STATES.includes(entry.state)) {
      fail('INVALID_PARITY_REGISTER', `${label}.state must name a governed live-legacy state.`);
    }
    if (!Array.isArray(entry.evidence_paths) || entry.evidence_paths.length === 0) {
      fail('UNSUPPORTED_LIVE_LEGACY_SUPPORT', `${label}.evidence_paths must identify live legacy support.`);
    }
    entry.evidence_paths.forEach((evidencePath, evidenceIndex) => (
      repositoryPath(evidencePath, `${label}.evidence_paths[${evidenceIndex}]`)
    ));
    if (!entry.evidence_paths.some((evidencePath) => !evidencePath.startsWith('tests/'))) {
      fail('UNSUPPORTED_LIVE_LEGACY_SUPPORT', `${label} cannot use test-only legacy proof.`);
    }
  });
}

function validateM3FamilyParityRegister(register) {
  if (!exactKeys(register, [
    'families',
    'live_legacy_support',
    'milestone_id',
    'schema',
    'semantics',
    'source_kinds',
    'supplemental_owners',
    'unassigned_product_surfaces',
  ])) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register does not match its closed contract.');
  }
  if (register.schema !== REGISTER_SCHEMA || register.milestone_id !== MILESTONE_ID) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register has the wrong authority binding.');
  }
  if (canonicalJson(register.semantics) !== canonicalJson(REGISTER_SEMANTICS)) {
    fail('INVALID_PARITY_REGISTER', 'The V3 register must separate approved scope from live product visibility.');
  }
  if (canonicalJson(register.source_kinds) !== canonicalJson(SOURCE_KINDS)) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register source-kind universe changed.');
  }
  if (!Array.isArray(register.families) || register.families.length !== FAMILY_IDS.length) {
    fail('INVALID_PARITY_REGISTER', `The M3 family parity register must contain exactly ${FAMILY_IDS.length} designed families.`);
  }
  register.families.forEach(validateFamily);
  if (!Array.isArray(register.supplemental_owners)) {
    fail('INVALID_PARITY_REGISTER', 'supplemental_owners must be an array.');
  }
  register.supplemental_owners.forEach(validateSupplementalOwner);
  const supplementalOwnerIds = register.supplemental_owners
    .map((owner) => owner.owner_id)
    .sort();
  if (canonicalJson(supplementalOwnerIds) !== canonicalJson(SUPPLEMENTAL_OWNER_IDS)) {
    fail('INVALID_PARITY_REGISTER', 'The supplemental owner universe must remain unique and complete.');
  }
  const familyIds = register.families.map((family) => family.family_id);
  if (canonicalJson(familyIds) !== canonicalJson(FAMILY_IDS)) {
    fail('INVALID_PARITY_REGISTER', `The exact ${FAMILY_IDS.length}-family design universe must remain unique, complete and sorted.`);
  }
  if (!Array.isArray(register.unassigned_product_surfaces)) {
    fail('INVALID_PARITY_REGISTER', 'unassigned_product_surfaces must be an array.');
  }
  register.unassigned_product_surfaces.forEach(validateUnassignedSurface);
  validateLiveLegacySupport(register);
  const surfaceIds = [
    ...allProductSurfaces(register).map((surface) => surface.surface_id),
    ...register.unassigned_product_surfaces.map((surface) => surface.surface_id),
  ];
  if (new Set(surfaceIds).size !== surfaceIds.length) {
    fail('INVALID_PARITY_REGISTER', 'Product surface IDs must be unique across the register.');
  }
  const surfacesBySource = new Map();
  allProductSurfaces(register).forEach((surface) => {
    const key = `${surface.source_path}\u0000${surface.source_locator}`;
    const prior = surfacesBySource.get(key) || [];
    prior.push(surface);
    surfacesBySource.set(key, prior);
  });
  for (const [key, surfaces] of surfacesBySource) {
    if (surfaces.some((surface) => surface.disposition === 'APPROVED_RETIRED')
      && surfaces.some((surface) => surface.disposition !== 'APPROVED_RETIRED'
        && TERMINAL_DISPOSITIONS.includes(surface.disposition))) {
      fail('RETIRED_SOURCE_COLLISION', 'A retired product surface cannot share its exact source with a non-retired terminal surface.', {
        key,
        surface_ids: surfaces.map((surface) => surface.surface_id),
      });
    }
  }
  return register;
}

// Ruling 2 (Ben, 2026-08-05): proof must resolve the complete import specifier to the exact
// repository path and to the exported symbol the consumer actually executes. Basename
// matching is not acceptable. Ambiguous specifiers, dynamic imports, unresolved re-exports
// and test-only paths all fail closed.
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_BINDING = /(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const ESM_BINDING = /import\s+([^;'"]*?)\s+from\s*['"]([^'"]+)['"]/g;

function parseBindingClause(clause) {
  const trimmed = clause.trim();
  const named = [];
  const braces = trimmed.match(/\{([^}]*)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const [imported, alias] = piece.split(/\s*(?::|\s+as\s+)\s*/);
      if (!/^[A-Za-z_$][\w$]*$/.test(imported)) continue;
      named.push({ imported, local: (alias || imported).trim() });
    }
  }
  const star = trimmed.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  const bare = trimmed
    .replace(/\{[^}]*\}/g, '')
    .replace(/\*\s+as\s+[A-Za-z_$][\w$]*/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z_$][\w$]*$/.test(part));
  return { namespace: star ? star[1] : (bare[0] || null), named };
}

// Exported identifiers of an adapter, read statically. A shape this parser cannot read
// fully under-reports, which fails closed instead of inventing an export.
const moduleExportedNameCache = new Map();
function moduleExportedNames(modulePath) {
  if (moduleExportedNameCache.has(modulePath)) return moduleExportedNameCache.get(modulePath);
  const computed = computeModuleExportedNames(modulePath);
  moduleExportedNameCache.set(modulePath, computed);
  return computed;
}

function computeModuleExportedNames(modulePath) {
  const source = readStrippedSource(modulePath);
  if (source === null) return new Set();
  const names = new Set();
  const block = source.match(/module\.exports\s*=\s*(?:Object\.freeze\s*\(\s*)?\{([^{}]*)\}/);
  if (block) {
    for (const part of block[1].split(',')) {
      const name = part.trim().split(/\s*:\s*/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const match of source.matchAll(/(?:^|[^.\w$])exports\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  if (/(?:^|[^.\w$])export\s+default\b/m.test(source) || /(?:^|[^.\w$])exports\.default\s*=/.test(source)) {
    names.add('default');
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

function referencedBeyondImport(source, local) {
  const matches = source.match(new RegExp(`\\b${local.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'));
  return Array.isArray(matches) && matches.length > 1;
}

// The exact export names a consumer proves it executes off an adapter. This is the
// name-level form of the ruling 2 proof; `consumerExecutesAdapter` is the boolean view of
// exactly the same truth conditions, so the two can never disagree.
function executedAdapterExportNames(consumerPath, adapterPath) {
  const executed = new Set();
  if (consumerPath.endsWith('.json') || isGovernanceOrTestPath(consumerPath)) return executed;
  const source = readStrippedSource(consumerPath);
  if (source === null) return executed;
  const files = productSourceFiles();
  for (const match of source.matchAll(DYNAMIC_IMPORT)) {
    if (resolveRelativeSpecifier(consumerPath, match[1], files) === adapterPath) return new Set();
  }
  const exported = moduleExportedNames(adapterPath);
  if (exported.size === 0) return executed;
  const bindings = [
    ...[...source.matchAll(REQUIRE_BINDING)].map((match) => [match[1], match[2]]),
    ...[...source.matchAll(ESM_BINDING)].map((match) => [match[1], match[2]]),
  ];
  for (const [clause, specifier] of bindings) {
    if (resolveRelativeSpecifier(consumerPath, specifier, files) !== adapterPath) continue;
    const { namespace, named } = parseBindingClause(clause);
    for (const { imported, local } of named) {
      if (exported.has(imported) && referencedBeyondImport(source, local)) executed.add(imported);
    }
    // A namespace or default binding proves execution either by member access
    // (`ns.thing(...)`) or by destructuring a real export off it (`const { thing } = ns`).
    if (namespace) {
      for (const name of exported) {
        if (new RegExp(`\\b${namespace}\\s*\\.\\s*${name}\\b`).test(source)
          || new RegExp(`\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*${namespace}\\b`).test(source)) {
          executed.add(name);
        }
      }
    }
  }
  return executed;
}

function consumerExecutesAdapter(consumerPath, adapterPath) {
  return executedAdapterExportNames(consumerPath, adapterPath).size > 0;
}

const PRODUCT_SOURCE_ROOTS = Object.freeze(['pages', 'lib', 'components']);
const PRODUCT_SOURCE_EXTENSIONS = Object.freeze(['.js', '.jsx', '.mjs']);

function listProductSourceFiles() {
  const files = new Set();
  const visit = (relativeDirectory) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(REPOSITORY_ROOT, relativeDirectory), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) visit(relativePath);
      else if (PRODUCT_SOURCE_EXTENSIONS.includes(path.extname(entry.name))) files.add(relativePath);
    }
  };
  PRODUCT_SOURCE_ROOTS.forEach(visit);
  return files;
}

function resolveRelativeSpecifier(fromFile, specifier, files) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.join(path.posix.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}/index.js`, `${base}/index.jsx`]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

let productSourceFileCache = null;
function productSourceFiles() {
  if (!productSourceFileCache) productSourceFileCache = listProductSourceFiles();
  return productSourceFileCache;
}

// The import edges of one module, as the parser sees them and never as text: the source of
// a real ImportDeclaration, ImportExpression or re-export, and the single string argument
// of a real `require(...)` call. A specifier that merely LOOKS like one -- named in a
// comment, quoted inside prose, assembled from a template literal -- is not an edge,
// because none of those load a module. `null` means the module could not be parsed at all.
//
// This deliberately reuses the ruling 3 toolchain declared further down (function
// declarations hoist). There is exactly one parser in this file, and this walk must not be
// allowed to become a second, weaker one.
function moduleImportSpecifiers(source, filePath) {
  const program = parseModuleSource(source, filePath);
  if (!program) return null;
  const specifiers = [];
  walkAst(program, (node) => {
    if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression'
      || node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration')
      && node.source && node.source.type === 'Literal'
      && typeof node.source.value === 'string') {
      // A type-only import is erased before runtime, so it loads nothing and serves nobody.
      if (node.importKind !== 'type' && node.exportKind !== 'type') {
        specifiers.push(node.source.value);
      }
      return undefined;
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier'
      && node.callee.name === 'require' && node.arguments.length === 1
      && node.arguments[0].type === 'Literal'
      && typeof node.arguments[0].value === 'string') {
      specifiers.push(node.arguments[0].value);
    }
    return undefined;
  });
  return specifiers;
}

// Modules a user can actually reach: everything imported, transitively, from a Next.js
// route that is not one of the 503 containment handlers. A route file listed in
// QUERY_CONTAINED_ROUTE_FILES answers ROUTE_CONTAINED, so code only reachable through it
// is integrated but unserved. An unresolvable specifier simply does not extend the set.
//
// The fail-closed direction, chosen deliberately: this set is monotone TOWARDS visible.
// `liveProductVisibility` only answers NATIVE_VISIBLE/DERIVED_VISIBLE when every proving
// consumer is a member, and `servedExportUsage` mines members for locator entry symbols,
// so an extra member can only ever push a surface towards a PASS, never away from one. A
// module the parser cannot read therefore does NOT join the set and lends no edges: an
// unreadable account of what a module does can never be evidence that it serves a user.
// The same answer covers a module that cannot be read off disk at all. Refusals are
// recorded rather than swallowed -- see `unparseableServedCandidates`.
//
// Known residual, recorded so it is not mistaken for rigour it does not have: a
// syntactically real `require` inside a branch that never executes is still an edge here.
// This is a static import graph, not an execution trace, and excluding such an edge would
// need value-flow analysis -- the same deliberate over-approximation ruling 3 documents.
function servedModuleClosure({ files, entryPoints, readSource }) {
  const reachable = new Set();
  const unparseable = new Set();
  const pending = [...entryPoints];
  while (pending.length > 0) {
    const file = pending.pop();
    if (reachable.has(file) || unparseable.has(file)) continue;
    const source = readSource(file);
    const specifiers = typeof source === 'string' ? moduleImportSpecifiers(source, file) : null;
    if (specifiers === null) {
      unparseable.add(file);
      continue;
    }
    reachable.add(file);
    for (const specifier of specifiers) {
      const resolved = resolveRelativeSpecifier(file, specifier, files);
      if (resolved && !reachable.has(resolved)) pending.push(resolved);
    }
  }
  return { reachable, unparseable };
}

let servedModuleCache = null;
let servedModuleRefusalCache = null;
function servedModules() {
  if (servedModuleCache) return servedModuleCache;
  const files = productSourceFiles();
  const contained = new Set(Object.values(QUERY_CONTAINED_ROUTE_FILES));
  // A page behind the design route guard answers notFound in production, so it is not a
  // served entry point and must not lend serving proof to anything it imports. This stays a
  // text test on purpose: its only failure mode is over-exclusion, which is the safe
  // direction, and an unreadable page reads as guarded.
  const designGuarded = (file) => {
    try {
      return /design\/route-guard|designPreviewEnabled/.test(
        fs.readFileSync(path.join(REPOSITORY_ROOT, file), 'utf8'),
      );
    } catch {
      return true;
    }
  };
  const entryPoints = [...files].filter((file) => file.startsWith('pages/')
    && !contained.has(file)
    && !designGuarded(file));
  const { reachable, unparseable } = servedModuleClosure({
    files,
    entryPoints,
    readSource: readRawSource,
  });
  servedModuleCache = reachable;
  servedModuleRefusalCache = Object.freeze([...unparseable].sort());
  return reachable;
}

// The modules the served walk refused because it could not parse or read them. Empty is the
// expected state. A non-empty list means the register is under-reporting serving somewhere
// and is a defect to fix, never a result to accept.
function unparseableServedCandidates() {
  servedModules();
  return servedModuleRefusalCache;
}

// Non-test/docs candidate paths named anywhere on a surface: source_path plus every
// evidence_paths entry, deduplicated.
function candidatePaths(surface) {
  return [...new Set([surface.source_path, ...surface.evidence_paths])];
}

function isGovernanceOrTestPath(candidate) {
  return candidate.startsWith('tests/') || candidate.startsWith('docs/');
}

function isInternalCanonicalV2Path(candidate) {
  return candidate.startsWith('lib/canonical-v2/');
}

// The exact V2 projector/adapter a surface claims to be served by: any lib/canonical-v2/
// file named on the surface (source_path or evidence_paths). A DERIVED_VALUE surface with
// no such file names its own source_path as the adapter -- there is no separate V2
// projector to point to, so the derivation function itself is what must have a real
// consumer.
function nativeAdapterCandidates(surface) {
  const named = candidatePaths(surface).filter((candidate) => !isGovernanceOrTestPath(candidate));
  const canonicalV2Adapters = named.filter(isInternalCanonicalV2Path);
  return canonicalV2Adapters.length > 0 ? canonicalV2Adapters : [surface.source_path];
}

// A real product consumer is a file distinct from the adapter, not a test, not a decision
// or governance document, and not another internal lib/canonical-v2/ file (canonical-v2
// code citing other canonical-v2 code proves nothing about the served product). It must
// literally import/require the exact adapter module -- legacy provision_cards, claims, or
// transaction_steps that merely share a matching string code are not proof.
// Every proving consumer for a surface, or null when the surface is unproven. Ruling 1
// (Ben, 2026-08-05): when a surface names several adapters, each one needs its own exact
// consumer proof. Only the express `adapter_set: 'ALTERNATIVES'` marking accepts one.
function provingProductConsumers(surface) {
  const adapters = nativeAdapterCandidates(surface);
  // The proving consumer must be bound to THIS surface, otherwise any proven adapter and
  // consumer pair elsewhere in the repository would clear any row. Two archetypes:
  // when the surface's own file is the adapter, some other named product file must
  // execute it; otherwise the surface's own file is what has to execute its adapters.
  const named = candidatePaths(surface).filter((candidate) => !isGovernanceOrTestPath(candidate));
  const consumerCandidates = adapters.includes(surface.source_path)
    ? named.filter((candidate) => (
      !isInternalCanonicalV2Path(candidate) && candidate !== surface.source_path
    ))
    : [surface.source_path];
  const proofs = adapters.map((adapterPath) => consumerCandidates.find(
    (candidate) => candidate !== adapterPath && consumerExecutesAdapter(candidate, adapterPath),
  ) || null);
  if (surface.adapter_set === 'ALTERNATIVES') {
    const proven = proofs.find(Boolean);
    return proven ? [proven] : null;
  }
  if (proofs.length === 0 || proofs.some((proof) => proof === null)) return null;
  return [...new Set(proofs)];
}

function hasRealProductConsumerProof(surface) {
  return provingProductConsumers(surface) !== null;
}

// ---------------------------------------------------------------------------------------
// Ruling 3 (Ben, 2026-08-05): the strict H1 locator rule.
//
// An import proves that a module is loaded. It does not prove that the ONE symbol a
// surface claims -- its `source_locator` -- is on the executed path. A surface may only
// read as visible when there is a complete demonstrable path: served entry point ->
// (transitive imports, `servedModules`) -> proving consumer -> exact adapter import
// (ruling 2) -> intra-module call graph -> the locator itself.
//
// The analysis is a real AST, never a guess. Modules are parsed with acorn (ESTree);
// JSX is lowered by sucrase first when acorn rejects the raw source. Anything this
// analysis cannot read with confidence -- an unparseable module, a duplicated module-level
// binding, an unresolved re-export, a locator that no reachable code evaluates -- yields
// NO proof. Failing closed can only under-report serving, never invent it.
//
// Deliberate over-approximation, recorded so it is not mistaken for rigour it does not
// have: a bare identifier reference from reachable code counts as a call edge, because
// `rows.map(parseDeadlineText)` executes the locator exactly as `parseDeadlineText()`
// does. Distinguishing the two would need value-flow analysis and would drop genuine
// higher-order serving paths.
// ---------------------------------------------------------------------------------------

// Parsers are resolved lazily: a missing parser must fail closed at the proof, not crash
// the register at require time.
let parserToolchain;
function moduleParsers() {
  if (parserToolchain === undefined) {
    let acorn = null;
    let sucrase = null;
    try {
      // eslint-disable-next-line global-require
      acorn = require('next/dist/compiled/acorn');
    } catch {
      acorn = null;
    }
    try {
      // eslint-disable-next-line global-require
      sucrase = require('sucrase');
    } catch {
      sucrase = null;
    }
    parserToolchain = { acorn, sucrase };
  }
  return parserToolchain;
}

const ACORN_OPTIONS = Object.freeze({
  ecmaVersion: 'latest',
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  allowAwaitOutsideFunction: true,
  allowHashBang: true,
  allowSuperOutsideMethod: true,
});

function parseModuleSource(source, filePath) {
  const { acorn, sucrase } = moduleParsers();
  if (!acorn) return null;
  try {
    return acorn.parse(source, ACORN_OPTIONS);
  } catch {
    // Almost always JSX. Lower it and retry; if that still fails the module is opaque.
  }
  if (!sucrase) return null;
  try {
    const lowered = sucrase.transform(source, {
      transforms: ['jsx'],
      filePath: filePath || 'module.jsx',
      production: true,
    }).code;
    return acorn.parse(lowered, ACORN_OPTIONS);
  } catch {
    return null;
  }
}

const AST_SKIP_KEYS = Object.freeze(new Set(['type', 'start', 'end', 'loc', 'range', 'comments']));

// `visit` may return false to prune the subtree.
function walkAst(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    if (AST_SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (child && typeof child === 'object') walkAst(child, visit);
  }
}

const FUNCTION_NODES = Object.freeze(new Set([
  'ArrowFunctionExpression',
  'ClassDeclaration',
  'ClassExpression',
  'FunctionDeclaration',
  'FunctionExpression',
]));

function isFunctionValued(node) {
  return Boolean(node) && FUNCTION_NODES.has(node.type);
}

// A name is "referenced" only in value position. Non-computed member properties and
// non-computed object keys are text, not bindings, so they never create a call edge.
function isValuePositionIdentifier(node, parent, key) {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && !parent.computed && key === 'property') return false;
  // A declarator's own name is a binding, not a use. Counting it would make every
  // top-level binding reachable from itself and hollow out the reachability rule.
  if (parent.type === 'VariableDeclarator' && key === 'id') return false;
  if (parent.type === 'Property' && !parent.computed && key === 'key') return false;
  if (parent.type === 'MethodDefinition' && !parent.computed && key === 'key') return false;
  if (parent.type === 'PropertyDefinition' && !parent.computed && key === 'key') return false;
  if (parent.type === 'LabeledStatement' && key === 'label') return false;
  if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return false;
  if (parent.type === 'ExportSpecifier' || parent.type === 'ImportSpecifier') return false;
  if (parent.type === 'MetaProperty') return false;
  return true;
}

// Walks with parent/key context so `isValuePositionIdentifier` can be applied.
function walkWithParent(node, parent, key, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walkWithParent(child, parent, key, visit);
    return;
  }
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
  if (visit(node, parent, key) === false) return;
  for (const childKey of Object.keys(node)) {
    if (AST_SKIP_KEYS.has(childKey)) continue;
    const child = node[childKey];
    if (child && typeof child === 'object') walkWithParent(child, node, childKey, visit);
  }
}

function patternNames(pattern, into) {
  walkWithParent(pattern, null, null, (node, parent, key) => {
    if (parent && parent.type === 'AssignmentPattern' && key === 'right') return false;
    if (parent && parent.type === 'Property' && !parent.computed && key === 'key') return false;
    if (node.type === 'Identifier') into.add(node.name);
    return undefined;
  });
}

// Every name bound inside a function body. Subtracting these from the referenced set is a
// cheap stand-in for scope analysis that errs toward FEWER call edges, never more.
function localBindingNames(functionNode) {
  const locals = new Set();
  (functionNode.params || []).forEach((param) => patternNames(param, locals));
  if (functionNode.id && functionNode.id.name) locals.add(functionNode.id.name);
  walkAst(functionNode.body, (node) => {
    if (node.type === 'VariableDeclarator') patternNames(node.id, locals);
    if (node.type === 'FunctionDeclaration' && node.id) locals.add(node.id.name);
    if (node.type === 'ClassDeclaration' && node.id) locals.add(node.id.name);
    if (node.type === 'CatchClause' && node.param) patternNames(node.param, locals);
    if ((node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
      && node !== functionNode) {
      (node.params || []).forEach((param) => patternNames(param, locals));
    }
    return undefined;
  });
  return locals;
}

function collectReferences(root, into) {
  walkWithParent(root, null, null, (node, parent, key) => {
    if (node.type === 'Identifier' && isValuePositionIdentifier(node, parent, key)) into.add(node.name);
    return undefined;
  });
}

// Every identifier-shaped token evaluated inside a body: value identifiers, non-computed
// property names, and string literals. This is the vocabulary the non-function locator
// rule is tested against.
function collectTokens(root, into) {
  walkAst(root, (node) => {
    if (node.type === 'Identifier') into.add(node.name);
    if (node.type === 'Literal' && typeof node.value === 'string') into.add(node.value);
    if (node.type === 'PrivateIdentifier') into.add(node.name);
    return undefined;
  });
}

function isCommonJsExportTarget(node) {
  if (!node || node.type !== 'MemberExpression' || node.computed) return null;
  const { object, property } = node;
  if (object.type === 'Identifier' && object.name === 'module'
    && property.type === 'Identifier' && property.name === 'exports') {
    return { kind: 'MODULE_EXPORTS', name: null };
  }
  if (object.type === 'Identifier' && object.name === 'exports' && property.type === 'Identifier') {
    return { kind: 'EXPORTS_MEMBER', name: property.name };
  }
  return null;
}

function unwrapObjectFreeze(node) {
  if (node && node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && !node.callee.computed
    && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object'
    && node.callee.property.type === 'Identifier' && node.callee.property.name === 'freeze'
    && node.arguments.length === 1) {
    return node.arguments[0];
  }
  return node;
}

// `module.exports = {...}` and `export { a, b }` are export manifests. They name symbols;
// they do not execute them. Treating a manifest as executed top-level code would make
// every export of a module reachable and hollow out the whole rule.
function isExportManifestStatement(statement) {
  if (statement.type === 'ExportNamedDeclaration' && !statement.declaration) return true;
  if (statement.type === 'ExportAllDeclaration') return true;
  if (statement.type === 'ExportDefaultDeclaration'
    && statement.declaration.type === 'Identifier') return true;
  if (statement.type !== 'ExpressionStatement'
    || statement.expression.type !== 'AssignmentExpression') return false;
  const target = isCommonJsExportTarget(statement.expression.left);
  if (!target) return false;
  const value = unwrapObjectFreeze(statement.expression.right);
  return value.type === 'ObjectExpression' || value.type === 'Identifier';
}

function recordBinding(bindings, name, kind) {
  if (!name) return;
  bindings.set(name, bindings.has(name) ? 'AMBIGUOUS' : kind);
}

function recordDeclarationBindings(bindings, declaration) {
  if (!declaration) return;
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
    if (declaration.id) recordBinding(bindings, declaration.id.name, 'FUNCTION');
    return;
  }
  if (declaration.type !== 'VariableDeclaration') return;
  for (const declarator of declaration.declarations) {
    if (declarator.id.type === 'Identifier') {
      recordBinding(
        bindings,
        declarator.id.name,
        isFunctionValued(declarator.init) ? 'FUNCTION' : 'VALUE',
      );
      continue;
    }
    const names = new Set();
    patternNames(declarator.id, names);
    names.forEach((name) => recordBinding(bindings, name, 'VALUE'));
  }
}

function recordExportLocals(exportLocals, statement) {
  if (statement.type === 'ExportNamedDeclaration') {
    if (statement.declaration) {
      const names = new Map();
      const declaration = statement.declaration;
      if (declaration.id && declaration.id.name) names.set(declaration.id.name, declaration.id.name);
      if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          const bound = new Set();
          patternNames(declarator.id, bound);
          bound.forEach((name) => names.set(name, name));
        }
      }
      names.forEach((local, exported) => exportLocals.set(exported, local));
      return;
    }
    for (const specifier of statement.specifiers) {
      // `export { a } from './x'` re-exports a symbol this module never binds. Unresolved
      // re-export -> no local -> no proof.
      const local = statement.source ? null : specifier.local.name;
      exportLocals.set(specifier.exported.name || specifier.exported.value, local);
    }
    return;
  }
  if (statement.type === 'ExportDefaultDeclaration') {
    const declaration = statement.declaration;
    if (declaration.type === 'Identifier') exportLocals.set('default', declaration.name);
    else if (declaration.id && declaration.id.name) exportLocals.set('default', declaration.id.name);
    else exportLocals.set('default', null);
    return;
  }
  if (statement.type !== 'ExpressionStatement'
    || statement.expression.type !== 'AssignmentExpression') return;
  const target = isCommonJsExportTarget(statement.expression.left);
  if (!target) return;
  const value = unwrapObjectFreeze(statement.expression.right);
  if (target.kind === 'EXPORTS_MEMBER') {
    exportLocals.set(target.name, value.type === 'Identifier' ? value.name : null);
    return;
  }
  if (value.type !== 'ObjectExpression') return;
  for (const property of value.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    const exported = property.key.type === 'Identifier' ? property.key.name : property.key.value;
    if (typeof exported !== 'string') continue;
    exportLocals.set(exported, property.value.type === 'Identifier' ? property.value.name : null);
  }
}

function analyseModuleSource(source, filePath) {
  const program = parseModuleSource(source, filePath);
  if (!program) return null;
  const bindings = new Map();
  const functions = new Map();
  const exportLocals = new Map();
  const topLevelReferences = new Set();

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        recordBinding(bindings, specifier.local.name, 'IMPORTED');
      }
      continue;
    }
    recordExportLocals(exportLocals, statement);
    const declaration = statement.type === 'ExportNamedDeclaration'
      || statement.type === 'ExportDefaultDeclaration'
      ? statement.declaration
      : statement;
    recordDeclarationBindings(bindings, declaration);
    if (isExportManifestStatement(statement)) continue;
    // Top-level code runs the moment the module is imported, so it always seeds
    // reachability -- but only the part outside function bodies actually runs.
    walkWithParent(declaration, null, null, (node, parent, key) => {
      if (isFunctionValued(node)) return false;
      if (node.type === 'Identifier' && isValuePositionIdentifier(node, parent, key)) {
        topLevelReferences.add(node.name);
      }
      return undefined;
    });
  }

  // Intra-module call graph: one node per module-level function binding.
  const registerFunction = (name, node) => {
    if (!name || functions.has(name)) return;
    const references = new Set();
    const tokens = new Set();
    collectReferences(node.body === undefined ? node : node.body, references);
    collectTokens(node.body === undefined ? node : node.body, tokens);
    (node.params || []).forEach((param) => {
      collectReferences(param, references);
      collectTokens(param, tokens);
    });
    localBindingNames(node).forEach((local) => references.delete(local));
    functions.set(name, { references, tokens });
  };
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration'
      || statement.type === 'ExportDefaultDeclaration'
      ? statement.declaration
      : statement;
    if (!declaration) continue;
    if ((declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration')
      && declaration.id) {
      registerFunction(declaration.id.name, declaration);
      continue;
    }
    if (declaration.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && isFunctionValued(declarator.init)) {
        registerFunction(declarator.id.name, declarator.init);
      }
    }
  }
  return { bindings, functions, exportLocals, topLevelReferences };
}

const moduleAnalysisCache = new Map();
function analyseModule(modulePath) {
  if (moduleAnalysisCache.has(modulePath)) return moduleAnalysisCache.get(modulePath);
  const source = readRawSource(modulePath);
  const analysis = source === null ? null : analyseModuleSource(source, modulePath);
  moduleAnalysisCache.set(modulePath, analysis);
  return analysis;
}

function reachableNames(analysis, entrySymbols) {
  const seen = new Set();
  const pending = [...entrySymbols, ...analysis.topLevelReferences];
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const node = analysis.functions.get(name);
    if (!node) continue;
    for (const reference of node.references) {
      if (!seen.has(reference)) pending.push(reference);
    }
  }
  return seen;
}

// The documented locator rules. `rule` is the single place a future ruling can change how
// each locator shape is proved, and every negative answer carries its reason.
//
//  1. FUNCTION_CALL_PATH -- the locator is a module-level function (or class) binding. It
//     must sit in the call-graph closure of the symbols a served consumer executes, plus
//     whatever top-level code runs on import. This is the motivating transitive case:
//     sec-meeting.config.js imports deriveSecMeetingSummary, which calls normaliseDeadline,
//     which calls parseDeadlineText.
//  2. MODULE_BINDING_PATH -- the locator is a module-level value or imported binding (a
//     rendered config object, a lookup table). Same closure test: some reachable code, or
//     the served consumer's own import, must actually reference it.
//  3. NON_FUNCTION_EVALUATION_SITE -- the locator is not a binding at all: it is a feature
//     key, property name or string key (`percentage_of_equity`, `feePctOfDealValue`). The
//     call rule cannot apply to a key, so the rule chosen here is that the key must be
//     EVALUATED on a reachable path: it must appear inside the body of a function that is
//     itself reachable. A key that only appears in a top-level literal, in dead code, or
//     nowhere but a comment does NOT prove -- being defined is not being served. That is
//     why `feePctOfDealValue`, which exists only as a key of the top-level DERIVED_FIELDS
//     literal, cannot prove, while `percentage_of_equity`, which is read inside
//     buildTerminationFees(), can.
//  4. Everything else is UNPROVEN, including an unparseable module and a locator whose
//     module-level binding is declared more than once.
function locatorServingProof({ source, filePath, entrySymbols, locator }) {
  const analysis = typeof source === 'string'
    ? analyseModuleSource(source, filePath)
    : analyseModule(filePath);
  if (!analysis) {
    return Object.freeze({ proven: false, rule: 'UNPROVEN', reason: 'MODULE_NOT_PARSEABLE' });
  }
  const binding = analysis.bindings.get(locator);
  if (binding === 'AMBIGUOUS') {
    return Object.freeze({ proven: false, rule: 'UNPROVEN', reason: 'LOCATOR_BINDING_AMBIGUOUS' });
  }
  const reachable = reachableNames(analysis, entrySymbols);
  if (binding) {
    if (reachable.has(locator)) {
      return Object.freeze({
        proven: true,
        rule: binding === 'FUNCTION' ? 'FUNCTION_CALL_PATH' : 'MODULE_BINDING_PATH',
        reason: null,
      });
    }
    return Object.freeze({
      proven: false,
      rule: 'UNPROVEN',
      reason: 'LOCATOR_BINDING_UNREACHABLE',
    });
  }
  const site = [...reachable]
    .filter((name) => analysis.functions.has(name) && analysis.functions.get(name).tokens.has(locator))
    .sort()[0];
  if (site) {
    return Object.freeze({ proven: true, rule: 'NON_FUNCTION_EVALUATION_SITE', reason: site });
  }
  return Object.freeze({
    proven: false,
    rule: 'UNPROVEN',
    reason: 'LOCATOR_NOT_EVALUATED_ON_A_REACHABLE_PATH',
  });
}

// Reverse index over served product modules: which exports of each module some served,
// non-test consumer actually executes. Built once, because a surface whose source_path is
// the CONSUMER (it names separate lib/canonical-v2 adapters) has to learn its own entry
// symbols from whoever imports it.
let servedExportUsageCache = null;
function servedExportUsage() {
  if (servedExportUsageCache) return servedExportUsageCache;
  const files = productSourceFiles();
  const usage = new Map();
  for (const consumer of servedModules()) {
    if (isGovernanceOrTestPath(consumer) || consumer.endsWith('.json')) continue;
    const source = readStrippedSource(consumer);
    if (source === null) continue;
    const specifiers = new Set();
    for (const match of source.matchAll(REQUIRE_BINDING)) specifiers.add(match[2]);
    for (const match of source.matchAll(ESM_BINDING)) specifiers.add(match[2]);
    for (const specifier of specifiers) {
      const target = resolveRelativeSpecifier(consumer, specifier, files);
      if (!target || target === consumer) continue;
      const names = executedAdapterExportNames(consumer, target);
      if (names.size === 0) continue;
      const known = usage.get(target) || new Set();
      names.forEach((name) => known.add(name));
      usage.set(target, known);
    }
  }
  servedExportUsageCache = usage;
  return usage;
}

// The export names of the surface's own source file that a proven, served path executes,
// mapped to the local bindings those exports name inside that file.
function locatorEntrySymbols(surface, consumers) {
  const locatorModule = surface.source_path;
  const adapters = nativeAdapterCandidates(surface);
  const executed = new Set();
  if (adapters.includes(locatorModule)) {
    // The surface's own file IS the adapter: its proving consumers are the entry.
    for (const consumer of consumers) {
      for (const name of executedAdapterExportNames(consumer, locatorModule)) executed.add(name);
    }
  } else {
    // The surface's own file is the CONSUMER of separate V2 adapters. Its entry symbols are
    // whatever a served product module executes off it.
    for (const name of servedExportUsage().get(locatorModule) || []) executed.add(name);
  }
  const analysis = analyseModule(locatorModule);
  if (!analysis) return new Set();
  const locals = new Set();
  for (const name of executed) {
    const local = analysis.exportLocals.get(name);
    // An export whose local binding cannot be resolved (re-export, computed member,
    // expression default) contributes nothing rather than a guess.
    if (local) locals.add(local);
  }
  return locals;
}

const servingPathCache = new Map();
function servingPathReachesLocator(surface, consumers) {
  // A JSON source_path carries an RFC 6901 pointer, not a JavaScript symbol.
  // `exactLocatorResolves` has already resolved the pointer against the file, and there is
  // no call graph in a data file, so the call rule is inapplicable rather than failed.
  if (surface.source_path.endsWith('.json')) {
    return Object.freeze({ proven: true, rule: 'JSON_POINTER_LOCATOR', reason: null });
  }
  const key = canonicalJson([
    surface.source_path,
    surface.source_locator,
    surface.adapter_set || 'ALL_REQUIRED',
    [...consumers].sort(),
    [...candidatePaths(surface)].sort(),
  ]);
  if (servingPathCache.has(key)) return servingPathCache.get(key);
  const proof = locatorServingProof({
    filePath: surface.source_path,
    entrySymbols: locatorEntrySymbols(surface, consumers),
    locator: surface.source_locator,
  });
  servingPathCache.set(key, proof);
  return proof;
}

function liveProductVisibility(surface) {
  if (surface.state !== 'PASS') return 'NOT_VISIBLE';
  if (!exactLocatorResolves(surface.source_path, surface.source_locator, 'product surface')) {
    return 'LOCATOR_UNVERIFIED';
  }
  if (surface.disposition === 'APPROVED_RETIRED') return 'RETIRED_NOT_RENDERED';
  if (surface.disposition === 'EVIDENCE_ONLY') return 'EVIDENCE_VISIBLE';
  if (surface.disposition === 'APPROVED_DERIVED' || surface.disposition === 'NATIVE_COMPLETE') {
    const derived = surface.disposition === 'APPROVED_DERIVED';
    const consumers = provingProductConsumers(surface);
    if (!consumers) return 'NATIVE_UNVERIFIED';
    // An import proves integration, not serving. A consumer no live route reaches cannot
    // put the V2 value in front of a user, so it must not read as visible.
    if (!consumers.every((consumer) => servedModules().has(consumer))) {
      return derived ? 'DERIVED_INTEGRATED_NOT_SERVED' : 'NATIVE_INTEGRATED_NOT_SERVED';
    }
    // Ruling 3: the last gate on a visibility claim. A reached module is not a reached
    // symbol -- the exact source_locator must sit on the executed path. This gate only
    // ever withdraws a positive claim, so it cannot promote an unserved row, and it runs
    // last so an already-negative answer keeps its more specific reason.
    if (!servingPathReachesLocator(surface, consumers).proven) return 'NATIVE_UNVERIFIED';
    return derived ? 'DERIVED_VISIBLE' : 'NATIVE_VISIBLE';
  }
  return 'NOT_VISIBLE';
}

function legacyProductVisibility(surface, register) {
  const support = register?.live_legacy_support?.find((entry) => entry.surface_id === surface?.surface_id);
  return support?.state || 'NO_LEGACY_SUPPORT';
}

function isNativeSemanticCompletion(surface) {
  return ['NATIVE_VISIBLE', 'DERIVED_VISIBLE', 'RETIRED_NOT_RENDERED'].includes(
    liveProductVisibility(surface),
  );
}

function isNativeSemanticBlocker(surface) {
  return surface.disposition !== 'EVIDENCE_ONLY' && !isNativeSemanticCompletion(surface);
}

function isNonSemanticReviewHold(surface) {
  return NON_SEMANTIC_UNASSIGNED_REASONS.some((reasonPrefix) => surface.reason.startsWith(reasonPrefix));
}

function familyCompletionState(family) {
  const waveAComplete = WAVE_A_CHECKS.every((key) => family.wave_a.checks[key].state === 'PASS');
  if (!waveAComplete) return 'WAVE_A_OPEN';
  if (family.product_surfaces.some(isNativeSemanticBlocker)) {
    return 'FOLLOW_ON_OPEN';
  }
  return 'FAMILY_COMPLETE';
}

function supplementalOwnerCompletionState(owner) {
  if (owner.first_slice.state !== 'PASS') return 'FIRST_SLICE_OPEN';
  if (owner.product_surfaces.some(isNativeSemanticBlocker)) return 'FOLLOW_ON_OPEN';
  return 'OWNER_COMPLETE';
}

// An evidence-only surface is a review hold. It is not a native-serving blocker.
function listM3ProductParityBlockers(register) {
  validateM3FamilyParityRegister(register);
  const blockers = register.families.flatMap((family) => family.product_surfaces
    .filter(isNativeSemanticBlocker)
    .map((surface) => Object.freeze({
      family_id: family.family_id,
      owner_id: null,
      surface_id: surface.surface_id,
      source_kind: surface.source_kind,
      source_path: surface.source_path,
      source_locator: surface.source_locator,
      disposition: surface.disposition,
      live_product_visibility: liveProductVisibility(surface),
      semantic_completion: false,
    })))
    .concat(register.supplemental_owners.flatMap((owner) => owner.product_surfaces
      .filter(isNativeSemanticBlocker)
      .map((surface) => Object.freeze({
        family_id: null,
        owner_id: owner.owner_id,
        surface_id: surface.surface_id,
        source_kind: surface.source_kind,
        source_path: surface.source_path,
        source_locator: surface.source_locator,
        disposition: surface.disposition,
        live_product_visibility: liveProductVisibility(surface),
        semantic_completion: false,
      }))));
  const unassigned = register.unassigned_product_surfaces
    .filter((surface) => !isNonSemanticReviewHold(surface))
    .map((surface) => Object.freeze({
    family_id: null,
    owner_id: null,
    surface_id: surface.surface_id,
    source_kind: surface.source_kind,
    source_path: surface.source_path,
    source_locator: surface.source_locator,
    disposition: 'UNASSIGNED',
    live_product_visibility: 'UNASSIGNED',
    semantic_completion: false,
    }));
  return Object.freeze([...blockers, ...unassigned].sort(
    (left, right) => left.surface_id.localeCompare(right.surface_id),
  ));
}

function buildM3FamilyParityStatus(register) {
  validateM3FamilyParityRegister(register);
  const familyStates = register.families.map((family) => ({
    family_id: family.family_id,
    completion_state: familyCompletionState(family),
  }));
  const supplementalOwnerStates = register.supplemental_owners.map((owner) => ({
    owner_id: owner.owner_id,
    completion_state: supplementalOwnerCompletionState(owner),
  }));
  const body = {
    schema_version: STATUS_SCHEMA,
    register_id: contentId(REGISTER_SCHEMA, register),
    milestone_id: MILESTONE_ID,
    state: familyStates.every((family) => family.completion_state === 'FAMILY_COMPLETE')
      && supplementalOwnerStates.every((owner) => owner.completion_state === 'OWNER_COMPLETE')
      && register.unassigned_product_surfaces.every(isNonSemanticReviewHold)
      ? 'FAMILY_COMPLETE'
      : 'BLOCKED',
    family_states: familyStates,
    supplemental_owner_states: supplementalOwnerStates,
    unassigned_product_surface_ids: register.unassigned_product_surfaces
      .filter((surface) => !isNonSemanticReviewHold(surface))
      .map((surface) => surface.surface_id)
      .sort(),
    review_hold_ids: register.unassigned_product_surfaces
      .filter(isNonSemanticReviewHold)
      .map((surface) => surface.surface_id)
      .sort(),
  };
  return Object.freeze({
    ...body,
    m3_family_parity_status_id: contentId(STATUS_SCHEMA, body),
  });
}

function validateM3FamilyParityStatus(status) {
  if (!exactKeys(status, [
    'family_states',
    'm3_family_parity_status_id',
    'milestone_id',
    'register_id',
    'schema_version',
    'state',
    'supplemental_owner_states',
    'unassigned_product_surface_ids',
    'review_hold_ids',
  ]) || status.schema_version !== STATUS_SCHEMA || status.milestone_id !== MILESTONE_ID) {
    fail('INVALID_PARITY_STATUS', 'A governed M3 family parity status is required.');
  }
  const { m3_family_parity_status_id: statusId, ...body } = status;
  if (statusId !== contentId(STATUS_SCHEMA, body)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status identity does not match its content.');
  }
  if (!['BLOCKED', 'FAMILY_COMPLETE'].includes(status.state)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status has an invalid state.');
  }
  if (!Array.isArray(status.family_states) || status.family_states.length !== FAMILY_IDS.length) {
    fail('INVALID_PARITY_STATUS', `The M3 family parity status must cover all ${FAMILY_IDS.length} families.`);
  }
  const statusFamilyIds = status.family_states.map((family, index) => {
    if (!exactKeys(family, ['completion_state', 'family_id'])
      || !['FAMILY_COMPLETE', 'FOLLOW_ON_OPEN', 'WAVE_A_OPEN'].includes(family.completion_state)) {
      fail('INVALID_PARITY_STATUS', `family_states[${index}] is invalid.`);
    }
    return family.family_id;
  });
  if (canonicalJson(statusFamilyIds) !== canonicalJson(FAMILY_IDS)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status does not cover the exact family universe.');
  }
  if (!Array.isArray(status.supplemental_owner_states)
    || status.supplemental_owner_states.length !== SUPPLEMENTAL_OWNER_IDS.length) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status must cover all supplemental owners.');
  }
  const statusOwnerIds = status.supplemental_owner_states.map((owner, index) => {
    if (!exactKeys(owner, ['completion_state', 'owner_id'])
      || !['FIRST_SLICE_OPEN', 'FOLLOW_ON_OPEN', 'OWNER_COMPLETE'].includes(owner.completion_state)) {
      fail('INVALID_PARITY_STATUS', `supplemental_owner_states[${index}] is invalid.`);
    }
    return owner.owner_id;
  }).sort();
  if (canonicalJson(statusOwnerIds) !== canonicalJson(SUPPLEMENTAL_OWNER_IDS)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status does not cover the exact supplemental owner universe.');
  }
  if (!Array.isArray(status.unassigned_product_surface_ids)
    || status.unassigned_product_surface_ids.some((surfaceId) => typeof surfaceId !== 'string' || !surfaceId)
    || canonicalJson(status.unassigned_product_surface_ids)
      !== canonicalJson([...new Set(status.unassigned_product_surface_ids)].sort())) {
    fail('INVALID_PARITY_STATUS', 'Unassigned product surface IDs must be unique and sorted.');
  }
  if (!Array.isArray(status.review_hold_ids)
    || status.review_hold_ids.some((surfaceId) => typeof surfaceId !== 'string' || !surfaceId)
    || canonicalJson(status.review_hold_ids)
      !== canonicalJson([...new Set(status.review_hold_ids)].sort())) {
    fail('INVALID_PARITY_STATUS', 'Review-hold IDs must be unique and sorted.');
  }
  const complete = status.family_states.every(
    (family) => family.completion_state === 'FAMILY_COMPLETE',
  ) && status.supplemental_owner_states.every(
    (owner) => owner.completion_state === 'OWNER_COMPLETE',
  ) && status.unassigned_product_surface_ids.length === 0;
  if ((status.state === 'FAMILY_COMPLETE') !== complete) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status conflicts with its family and product-surface states.');
  }
  return status;
}

const CURRENT_M3_FAMILY_PARITY_REGISTER = deepFreeze(require(REGISTER_PATH));
const CURRENT_M3_FAMILY_PARITY_STATUS = buildM3FamilyParityStatus(
  CURRENT_M3_FAMILY_PARITY_REGISTER,
);

module.exports = {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  FAMILY_IDS,
  LEGACY_SUPPORT_STATES,
  M3FamilyParityRegisterError,
  MILESTONE_ID,
  OPEN_DISPOSITION,
  REGISTER_PATH,
  REGISTER_SCHEMA,
  REGISTER_SEMANTICS,
  SOURCE_KINDS,
  STATUS_SCHEMA,
  SUPPLEMENTAL_OWNER_IDS,
  TERMINAL_DISPOSITIONS,
  WAVE_A_CHECKS,
  buildM3FamilyParityStatus,
  familyCompletionState,
  isNativeSemanticCompletion,
  isNativeSemanticBlocker,
  analyseModuleSource,
  consumerExecutesAdapter,
  executedAdapterExportNames,
  legacyProductVisibility,
  liveProductVisibility,
  locatorServingProof,
  moduleImportSpecifiers,
  servedModuleClosure,
  servedModules,
  servingPathReachesLocator,
  unparseableServedCandidates,
  supplementalOwnerCompletionState,
  listM3ProductParityBlockers,
  validateM3FamilyParityRegister,
  validateM3FamilyParityStatus,
};
