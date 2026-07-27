const path = require('node:path');

const GOVERNING_REGISTRY_PATH = path.resolve(
  __dirname,
  '../../docs/codex-program/programme-gates.yaml',
);
const REGISTRY_DIGEST_DOMAIN = 'PROGRAMME_GATE_REGISTRY/V1';
const BOOTSTRAP_NONCE = 'gate-status-bootstrap-2026-07-27-v1';

const EXPECTED_GATE_IDS = Object.freeze([
  'G0_MARKET_STATS_CONTAINED',
  'G0_BROAD_CORPUS_ROUTES_CONTAINED',
  'G0_ZAYO_DISPOSITION',
  'G0_CLAUDE_CREDENTIAL_ROTATION',
  'G0_SUPABASE_SECRET_DISPOSITION',
  'G0_STAGING_SUPABASE_ISOLATED',
  'G0_STAGING_VERCEL_ISOLATED',
  'G0_STAGING_ACCESS_PROTECTED',
  'G0_EXACT_DIGEST_REVIEW_SET',
  'G0_BEN_SPEC_APPROVAL',
  'P1_CONTRACT_FREEZE_ATTESTED',
  'P1_VERTICAL_SLICE_PASS',
  'P9_SCOPE_EXACT',
  'P9_REGISTRY_DISPOSITIONS',
  'P9_MKT_WORK',
  'P9_BEN_RUNBOOK',
  'P9_NUMERIC',
  'P9_RENDER_PARITY',
  'P9_STRUCTURED_CLAIMS',
  'P9_PARTY_LINT',
  'P9_SECURITY_AUTH',
  'P9_SHADOW_REEXTRACTION',
  'P9_IDENTITY_AND_DRIFT',
  'P9_BROWSER_A11Y_PERFORMANCE',
  'P9_STAGING_SMOKE_AND_ROLLBACK',
  'P9_DATABASE_SOAK',
  'P9_BACKUP_RESTORE',
  'P9_PREIMPORT_TRACEABILITY',
  'P9_IMPORT_PARITY',
  'P9_PROMOTION_ELIGIBILITY',
  'P9_DEPLOYMENT_PARITY',
  'P9_CUTOVER_AUTHORISATION',
  'P9_POSTCUTOVER_SMOKE',
  'P9_TRACEABILITY',
  'P9_PROGRAMME_COMPLETION_ATTESTATION',
]);

const EXPECTED_WORK_CLASS_IDS = Object.freeze([
  'specification_review',
  'gate_status_bootstrap',
  'emergency_containment',
  'implementation_planning',
  'isolation_boundary_setup',
  'snapshot_restore_and_preview',
  'canonical_work_start',
  'vertical_slice_execution',
  'candidate_scope_and_extraction',
  'production_import',
  'cutover_authorisation_issue',
  'production_cutover',
  'programme_complete',
]);

const authorityBrands = new WeakSet();

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
}

function requireExactOrder(actual, expected, label) {
  if (!Array.isArray(actual)
    || actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} does not match the closed governing order`);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validateRegistry(sourceRegistry) {
  if (!sourceRegistry || typeof sourceRegistry !== 'object' || Array.isArray(sourceRegistry)) {
    throw new TypeError('programme_gate_registry must be an object');
  }
  if (sourceRegistry.schema !== 'canonical-programme-gates/v1') {
    throw new Error('governing registry schema is not canonical-programme-gates/v1');
  }
  if (!Array.isArray(sourceRegistry.gates) || sourceRegistry.gates.length !== 35) {
    throw new Error('governing registry must contain exactly 35 gates');
  }
  if (!sourceRegistry.work_classes
    || typeof sourceRegistry.work_classes !== 'object'
    || Array.isArray(sourceRegistry.work_classes)) {
    throw new TypeError('governing registry work_classes must be an object');
  }

  const gateIds = sourceRegistry.gates.map((gate) => gate && gate.id);
  const workClassIds = Object.keys(sourceRegistry.work_classes);
  requireExactOrder(gateIds, EXPECTED_GATE_IDS, 'gate registry');
  requireExactOrder(workClassIds, EXPECTED_WORK_CLASS_IDS, 'work-class registry');

  for (const gate of sourceRegistry.gates) {
    if (!gate || typeof gate !== 'object' || Array.isArray(gate)) {
      throw new TypeError('every governing gate must be an object');
    }
    if (typeof gate.evidence_contract !== 'string' || gate.evidence_contract.length === 0) {
      throw new TypeError(`governing gate ${gate.id} has no evidence contract`);
    }
    if (typeof gate.required_evidence_object_type !== 'string'
      || gate.required_evidence_object_type.length === 0) {
      throw new TypeError(`governing gate ${gate.id} has no evidence object type`);
    }
  }

  const dependencyIds = new Set([...gateIds, ...workClassIds]);
  for (const [workClassId, definition] of Object.entries(sourceRegistry.work_classes)) {
    if (!definition || !Array.isArray(definition.all_of)) {
      throw new TypeError(`work class ${workClassId} must contain an all_of array`);
    }
    if (definition.all_of.some((dependency) => !dependencyIds.has(dependency))) {
      throw new Error(`work class ${workClassId} contains an unknown dependency`);
    }
  }

  const bootstrap = sourceRegistry.work_classes.gate_status_bootstrap;
  if (bootstrap.authority_model !== 'TEMPORARY_ONE_USE'
    || bootstrap.predecessor !== 'NONE'
    || bootstrap.nonce !== BOOTSTRAP_NONCE
    || bootstrap.terminal_condition?.required_generation !== 1
    || bootstrap.terminal_condition?.required_predecessor !== 'NONE'
    || bootstrap.terminal_condition?.consume_nonce !== true
    || bootstrap.terminal_condition?.expires_immediately !== true) {
    throw new Error('gate_status_bootstrap does not contain the closed one-use contract');
  }
  const programmeComplete = sourceRegistry.work_classes.programme_complete;
  if (programmeComplete.terminal_pair_required !== true
    || programmeComplete.terminal_pair_contract
      !== 'PROPOSED_STATUS_PLUS_POST_COMPLETION_TRACE/V1') {
    throw new Error('programme_complete does not contain the terminal-pair contract');
  }
}

function createGoverningRegistryAuthority(dependencies) {
  requireExactKeys(
    dependencies,
    ['readFileSync', 'parseYaml', 'domainDigest'],
    'governing registry dependencies',
  );
  const readFileSync = requireFunction(dependencies.readFileSync, 'readFileSync');
  const parseYaml = requireFunction(dependencies.parseYaml, 'parseYaml');
  const domainDigest = requireFunction(dependencies.domainDigest, 'domainDigest');

  const sourceBytes = readFileSync(GOVERNING_REGISTRY_PATH);
  const sourceText = Buffer.isBuffer(sourceBytes)
    ? sourceBytes.toString('utf8')
    : String(sourceBytes);
  const parsed = parseYaml(sourceText);
  requireExactKeys(parsed, ['programme_gate_registry'], 'governing registry document');
  validateRegistry(parsed.programme_gate_registry);

  const sourceRegistry = deepFreeze(structuredClone(parsed.programme_gate_registry));
  const digest = domainDigest(REGISTRY_DIGEST_DOMAIN, sourceRegistry);
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new TypeError('governing registry digest must be a SHA-256 digest');
  }

  const authority = Object.freeze({
    source_path: GOVERNING_REGISTRY_PATH,
    digest_domain: REGISTRY_DIGEST_DOMAIN,
    digest,
    gates: sourceRegistry.gates,
    work_classes: sourceRegistry.work_classes,
    gate_ids: EXPECTED_GATE_IDS,
    work_class_ids: EXPECTED_WORK_CLASS_IDS,
    supported_gate_ids: Object.freeze(EXPECTED_GATE_IDS.slice(0, 10)),
    bootstrap_nonce: BOOTSTRAP_NONCE,
  });
  authorityBrands.add(authority);
  return authority;
}

function requireGoverningRegistryAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a loaded governing registry authority is required');
  }
  return value;
}

module.exports = {
  BOOTSTRAP_NONCE,
  EXPECTED_GATE_IDS,
  EXPECTED_WORK_CLASS_IDS,
  GOVERNING_REGISTRY_PATH,
  REGISTRY_DIGEST_DOMAIN,
  createGoverningRegistryAuthority,
  requireGoverningRegistryAuthority,
};
