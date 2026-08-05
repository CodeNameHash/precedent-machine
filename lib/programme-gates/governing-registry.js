'use strict';

const crypto = require('node:crypto');
const { readFileSync: readGoverningSourceBytes } = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parse: parseYaml } = require('yaml');

const { domainDigest } = require('./bytes');
const { ACCEPTANCE_DEFINITION_DESCRIPTORS } = require('./registry');
const { canonicalJson: canonicalContractJson } = require('../canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_INPUT_V1,
  compileFixtureContract,
  validateContractBundle,
} = require('../canonical-v2/contract-bundle');
const { validateVerticalSliceAttestation } = require('../canonical-v2/vertical-slice-attestation');

const GOVERNING_REGISTRY_PATH = path.resolve(
  __dirname,
  '../../docs/codex-program/programme-gates.yaml',
);
const REGISTRY_DIGEST_DOMAIN = 'PROGRAMME_GATE_REGISTRY/V2';
const BOOTSTRAP_NONCE = 'gate-status-bootstrap-2026-07-27-v1';

// D3 (2026-08-05): the registry could only ever report every pre-production
// gate as OPEN -- this loader threw if any gate's declared state was
// anything else. Two gates have their substantive work finished, reviewed
// and recorded (docs/certification/programme-gate-status.json), and stayed
// OPEN only because nothing could say otherwise. This section makes closure
// possible for exactly those two gates, by re-deriving their evidence live
// from primary sources every time the registry loads -- never by trusting a
// stored assertion. Every other gate has no verifier below and therefore has
// no path to anything but OPEN. The declared `state: OPEN` in the frozen v2
// contract above is untouched: this is a computed overlay, not a rewrite of
// the document.
const CLOSEABLE_PREPRODUCTION_GATE_IDS = Object.freeze([
  'P1_CONTRACT_BUNDLE_COMPLETE',
  'P1_VERTICAL_SLICE_PASS',
]);
const M1_CONTRACT_FREEZE_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';
const M1_CONTRACT_FREEZE_ACK_PATH = path.resolve(
  __dirname,
  '../../docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md',
);
// Pinned sha256 of the ack file above at the moment closure was wired up.
// Any future edit to that record -- including a change to its own claimed
// result -- changes this digest and the gate falls back to OPEN until the
// pin is deliberately updated alongside a fresh review of what changed.
const M1_CONTRACT_FREEZE_ACK_SHA256 = '988e710591e8a46f8b506bb1fe2bf3be148595934b4b197858c3480db0cd3309';
const P1_VERTICAL_SLICE_EVIDENCE_PATH = path.resolve(
  __dirname,
  '../../docs/certification/evidence/P1-VERTICAL-SLICE-ATTESTATION.json',
);

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

// Recompiles the exact bundle Ben approved on 2026-07-23 twice, uncached,
// straight from lib/canonical-v2/contract-bundle.js, and requires the two
// results to be byte-identical at the pinned fingerprint
// (TWO_UNCACHED_COMPILES_BYTE_IDENTICAL from the registry's own acceptance
// list for this gate, actually re-run rather than asserted), and requires
// validateContractBundle() to accept it (STRUCTURAL_BUNDLE_VALIDATION_PASS).
// The remaining two acceptance items -- M1_ACK_PASS and
// BEN_EXACT_BUNDLE_APPROVAL -- are facts about a human review that code
// cannot recompute; they are required to be present, in the exact recorded
// words, in a hash-pinned acknowledgement record, so a silent rewrite of
// what was approved is caught even though the approval itself cannot be.
function verifyContractBundleFreezeEvidence() {
  const first = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V1);
  const second = compileFixtureContract(FIXTURE_CONTRACT_INPUT_V1);
  if (canonicalContractJson(first) !== canonicalContractJson(second)) {
    throw new Error('the frozen M1 contract input does not compile deterministically');
  }
  if (first.fingerprint !== M1_CONTRACT_FREEZE_FINGERPRINT) {
    throw new Error('the frozen M1 contract input no longer compiles to the approved fingerprint');
  }
  if (validateContractBundle(first) !== true) {
    throw new Error('the frozen M1 contract bundle failed structural validation');
  }
  const ackBytes = readGoverningSourceBytes(M1_CONTRACT_FREEZE_ACK_PATH);
  const ackDigest = sha256Hex(ackBytes);
  if (ackDigest !== M1_CONTRACT_FREEZE_ACK_SHA256) {
    throw new Error('the M1 contract-freeze acknowledgement has drifted from its pinned record');
  }
  const ackText = ackBytes.toString('utf8');
  if (!/- milestone_id: `M1_CONTRACT_FREEZE`/.test(ackText)
    || !/- result: `PASS`/.test(ackText)
    || !/- ben_approval_result: `APPROVED`/.test(ackText)) {
    throw new Error('the M1 contract-freeze acknowledgement does not record a passing Ben-approved result');
  }
  return Object.freeze({
    contract_fingerprint: first.fingerprint,
    acknowledgement_path: 'docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md',
    acknowledgement_sha256: ackDigest,
  });
}

// Loads the committed VerticalSliceAttestation and re-validates it against
// lib/canonical-v2/vertical-slice-attestation.js's real, tested predicate,
// which rebuilds the attestation from its own local_execution and
// staging_evidence fields and requires an exact match against the pinned
// fixture cases, contract fingerprint, release and authority identifiers.
// It never trusts the file's say-so beyond what that predicate re-derives.
function verifyVerticalSliceEvidence() {
  const bytes = readGoverningSourceBytes(P1_VERTICAL_SLICE_EVIDENCE_PATH);
  const evidence = JSON.parse(bytes.toString('utf8'));
  if (evidence.gate_id !== 'P1_VERTICAL_SLICE_PASS') {
    throw new Error('the vertical-slice evidence record is not bound to P1_VERTICAL_SLICE_PASS');
  }
  validateVerticalSliceAttestation(evidence);
  return Object.freeze({
    vertical_slice_attestation_id: evidence.vertical_slice_attestation_id,
    contract_fingerprint: evidence.contract_fingerprint,
  });
}

const CLOSEABLE_GATE_VERIFIERS = Object.freeze({
  P1_CONTRACT_BUNDLE_COMPLETE: verifyContractBundleFreezeEvidence,
  P1_VERTICAL_SLICE_PASS: verifyVerticalSliceEvidence,
});

// Builds the computed-status overlay for every declared pre-production gate.
// Fail-closed by construction, and defensively so: a gate with no verifier
// can never report anything but OPEN here, regardless of what its declared
// state claims -- this function does not trust a caller-supplied 'PASS' any
// more than the deleted layer's self-comparison did. A gate with a verifier
// reads PASS only if that verifier returns without throwing, and OPEN with
// the reason recorded on any failure -- missing file, hash drift, or a
// re-derived value that does not match. There is no path from "verifier
// absent or unsatisfied" to PASS.
function computePreproductionGateStatus(preproductionGates) {
  return Object.freeze(Object.fromEntries(preproductionGates.map((gate) => {
    const verify = CLOSEABLE_GATE_VERIFIERS[gate.id];
    if (!verify) {
      return [gate.id, Object.freeze({
        gate_id: gate.id, declared_state: gate.state, computed_state: 'OPEN',
        evidence: null, verification_unavailable_reason: 'NO_MECHANICAL_VERIFIER_IMPLEMENTED',
      })];
    }
    try {
      const evidence = verify();
      return [gate.id, Object.freeze({
        gate_id: gate.id, declared_state: gate.state, computed_state: 'PASS',
        evidence, verification_unavailable_reason: null,
      })];
    } catch (error) {
      return [gate.id, Object.freeze({
        gate_id: gate.id, declared_state: gate.state, computed_state: 'OPEN',
        evidence: null, verification_unavailable_reason: error.message,
      })];
    }
  })));
}

// This bridge exists only because the active G0 status compiler still needs
// the frozen G0 evidence descriptors. It never promotes a P1 or P9 gate.
const STATUS_COMPATIBILITY_G0_GATE_IDS = Object.freeze([
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
]);
const CURRENT_LIVE_P9_GATE_IDS = Object.freeze([
  'P9_SCOPE_EXACT',
  'P9_REGISTRY_DISPOSITIONS',
  'P9_MKT_WORK',
  'P9_BEN_RUNBOOK',
  'P9_NUMERIC',
  'P9_RENDER_PARITY',
  'P9_STRUCTURED_CLAIMS',
  'P9_PARTY_LINT',
  'P9_SHADOW_REEXTRACTION',
  'P9_IDENTITY_AND_DRIFT',
  'P9_BROWSER_A11Y_PERFORMANCE',
  'P9_STAGING_SMOKE_AND_ROLLBACK',
  'P9_DATABASE_SOAK',
  'P9_BACKUP_RESTORE',
  'P9_PREIMPORT_TRACEABILITY',
  'P9_SECURITY_AUTH',
  'P9_DEPLOYMENT_PARITY',
  'P9_IMPORT_PARITY',
  'P9_PROMOTION_ELIGIBILITY',
  'P9_CUTOVER_AUTHORISATION',
  'P9_POSTCUTOVER_SMOKE',
  'P9_TRACEABILITY',
  'P9_PROGRAMME_COMPLETION_ATTESTATION',
]);
const COMPLETION_GATE_ID = 'P9_PROGRAMME_COMPLETION_ATTESTATION';
const PHASE_12_SECURITY_GATE_ID = 'P9_SECURITY_AUTH';
const STATUS_COMPATIBILITY_WORK_CLASSES = Object.freeze({
  gate_status_bootstrap: Object.freeze({ all_of: Object.freeze([]) }),
  canonical_work_start: Object.freeze({ all_of: STATUS_COMPATIBILITY_G0_GATE_IDS }),
});

const CURRENT_V2_REGISTRY_CONTRACT = deepFreeze({
  schema: 'canonical-programme-gates/v2',
  yaml_parser_binding: {
    yaml_version: '1.2', package: 'yaml', package_version: '2.9.0',
    options: ['STRICT', 'UNIQUE_KEYS', 'NO_ALIASES'],
  },
  status_source: 'docs/codex-program/EXECUTION-LEDGER.md',
  status_format: 'HUMAN_READABLE_MARKDOWN_TABLE',
  signed_status_required_before_preproduction_work: false,
  default_state: 'OPEN',
  allowed_states: ['OPEN', 'PASS', 'FAIL', 'BLOCKED', 'DEFERRED_POST_CUTOVER'],
  review_model: {
    exact_milestones: [
      { id: 'M1_CONTRACT_FREEZE', purpose: 'CONTRACT_BUNDLE_READY_FOR_BEN_APPROVAL' },
      { id: 'M2_VERTICAL_SLICE', purpose: 'QXO_AND_METSERA_VERTICAL_SLICES_PASS' },
      { id: 'M3_FULL_CORPUS_CERTIFICATION', purpose: 'PHASE_9_QUALITY_WORK_COMPLETE' },
      { id: 'M4_PRE_CUTOVER', purpose: 'PRODUCTION_IMPORT_AND_ACTIVATION_READY' },
    ],
    reviewer: 'FABLE_OR_EQUIVALENT_HIGH_REASONING_REVIEWER',
    review_scope: 'DIFF_SINCE_PRIOR_REVIEWED_STATE',
    reviewer_inputs: ['DIFF', 'RELEVANT_CONTRACTS'],
    prior_conclusions_supplied: false,
    acknowledgement_directory: 'docs/acks',
    acknowledgement_required_fields: [
      'reviewed_commit_range', 'date', 'reviewer', 'findings', 'dispositions', 'result',
    ],
    acknowledgement_result_values: ['PASS', 'FAIL'],
    failed_review_action: 'BOUNDED_FIX_LIST_AND_FIX_DIFF_REVIEW_ONLY',
    additional_milestones_permitted: false,
    legal_semantic_diff_review: {
      applies_before_milestones: true,
      reviews_per_change: 1,
      fix_diff_rereviews_per_failed_review: 1,
      milestone_event: false,
    },
    milestone_three_lane_review: {
      applies_only_at: [
        'M1_CONTRACT_FREEZE', 'M2_VERTICAL_SLICE', 'M3_FULL_CORPUS_CERTIFICATION',
        'M4_PRE_CUTOVER',
      ],
      lanes: ['ARCHITECTURE', 'LEGAL', 'QUERY'],
    },
    evidence_binding: {
      passing_test_evidence_binds_code_tree: true,
      documentation_acknowledgement_execution_ledger_or_specification_manifest_only_commit_does_not_invalidate_or_rerun: true,
    },
    preproduction_approval: {
      only_artefact: 'M1_MARKDOWN_ACKNOWLEDGEMENT',
      signed_status_or_publication_authority: false,
    },
  },
  ben_approval_points: [
    'MATERIAL_CONTRACT_BUNDLE_FREEZE',
    'MATERIAL_TAXONOMY_OR_CODEBOOK_CHANGE',
    'PRODUCTION_IMPORT_WHERE_REQUIRED_BY_IMPORT_CONTRACT',
    'ONE_USE_PRODUCTION_CUTOVER',
  ],
  routine_branch_integration_deployment_or_ledger_work_requires_ben: false,
  merge_gates: {
    required_for_every_merge: ['npm_test', 'npm_run_build', 'main_remains_deployable'],
    extraction_change: ['node_scripts_eval_js', 'legal_semantic_diff_review'],
    registry_change: ['registry_drift_tests'],
    ingestion_change: ['ingest_qa_gates'],
    evidence_change: ['quote_verification_zero_flags'],
    contract_freeze: [
      'two_uncached_compiles_byte_identical', 'zero_missing_members',
      'zero_duplicate_identities', 'zero_conflicts', 'zero_dependency_cycles',
      'zero_unresolved_dependencies', 'M1_ack_pass', 'ben_exact_bundle_approval',
    ],
  },
  tier_a_pre_cutover: {
    state: 'ACTIVE',
    controls: [
      'NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION',
      'BEN_RUN_LOCAL_DRY_RUN_FIRST_CORPUS_WRITES_ONLY',
      'STAGING_ONLY_CREDENTIALS_IN_STAGING_AND_PREVIEW',
      'NO_PRODUCTION_CREDENTIAL_IN_PREVIEW',
      'NO_SERVICE_CREDENTIAL_IN_BROWSER_CODE',
      'VERCEL_DEPLOYMENT_PROTECTION_OR_SSO_ON_PREVIEWS',
      'NO_SECRETS_IN_EVIDENCE_PROMPTS_OR_COMMITTED_FILES',
      'EXISTING_LIVE_ROUTE_GUARD_TESTS_REMAIN_ACTIVE',
    ],
  },
  work_classes: {
    implementation_planning: { state: 'PASS', authority: 'CONTINUOUS_BOUNDED_BRANCH_WORK' },
    isolation_boundary_setup: { state: 'PASS', authority: 'TIER_A_ONLY' },
    snapshot_restore_and_preview: { state: 'PASS', authority: 'ISOLATED_STAGING_ONLY' },
    canonical_work_start: { state: 'PASS', authority: 'CONTINUOUS_BOUNDED_BRANCH_WORK' },
    vertical_slice_execution: {
      state: 'OPEN', opens_when: 'M1_CONTRACT_FREEZE_PASS_AND_BEN_BUNDLE_APPROVAL',
    },
    candidate_scope_and_extraction: { state: 'OPEN', opens_when: 'M2_VERTICAL_SLICE_PASS' },
    production_import: { state: 'OPEN', opens_when: 'ALL_PREIMPORT_GATES_INCLUDING_P9_SECURITY_AUTH_PASS' },
    production_cutover: {
      state: 'OPEN', opens_when: 'M4_PRE_CUTOVER_PASS_AND_ONE_USE_BEN_AUTHORISATION',
    },
    security_hardening: {
      state: 'OPEN', phase: 9,
      opens_when: 'BEFORE_ANY_CANONICAL_V2_PRODUCTION_CREDENTIAL_INACTIVE_IMPORT_OR_ACTIVATION',
    },
  },
  preproduction_gates: [
    {
      id: 'P1_CONTRACT_BUNDLE_COMPLETE', state: 'OPEN',
      acceptance: [
        'TWO_UNCACHED_COMPILES_BYTE_IDENTICAL', 'STRUCTURAL_BUNDLE_VALIDATION_PASS',
        'M1_ACK_PASS', 'BEN_EXACT_BUNDLE_APPROVAL',
      ],
    },
    {
      id: 'P1_VERTICAL_SLICE_PASS', state: 'OPEN',
      acceptance: ['QXO_AGREEMENT_CONTROL_SLICE_PASS', 'METSERA_PROCESS_SLICE_PASS', 'M2_ACK_PASS'],
    },
    ...CURRENT_LIVE_P9_GATE_IDS.map((id) => {
      if (id === PHASE_12_SECURITY_GATE_ID) {
        return {
          id, state: 'OPEN',
          acceptance: [
            'SECURITY_REVIEW_PASS',
            'ZERO_UNRESOLVED_CRITICAL_OR_HIGH_FINDINGS',
            'PRODUCTION_ACCESS_PRECONDITION_VERIFIED',
          ],
          prerequisite_for: [
            'CANONICAL_V2_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE',
            'INACTIVE_PRODUCTION_IMPORT',
            'PRODUCTION_ACTIVATION',
          ],
        };
      }
      if (id === COMPLETION_GATE_ID) {
        return {
          id, state: 'OPEN', terminal: true, bundle_frozen: true,
          acceptance: ['P9_TRACEABILITY_PASS', 'TERMINAL_COMPLETION_PAIR_PASS'],
        };
      }
      return { id, state: 'OPEN' };
    }),
  ].map((gate) => {
    if (gate.id !== 'P9_DEPLOYMENT_PARITY') return gate;
    return {
      ...gate,
      acceptance: [
        'production_release_statistics_root_equal',
        'live_physical_plan_fingerprint_root_equal',
        'live_query_plan_smoke_equal',
        'activation_parity_recheck_fresh_and_current',
      ],
      governing_test: 'DEPLOYMENT-PARITY-FRESHNESS-01',
      required_adversarial_tests: ['POST-ACTIVATION-CONTROLLER-01', 'DEPLOY-CUTOVER-01'],
    };
  }),
  production_import_and_cutover: {
    strictness: 'UNCHANGED',
    required_controls: [
      'EXACT_BUNDLE_DIGEST_VERIFICATION', 'COMPLETE_MEMBER_PARITY',
      'CHECKPOINTED_RESUMABLE_IMPORT', 'IMPORT_CHECKPOINT_REPLAY_NO_OP',
      'CONFLICTING_REPLAY_FAILS_CLOSED', 'ATOMIC_WHOLE_TUPLE_ACTIVATION',
      'POST_CUTOVER_SMOKE_WITH_ROLLBACK', 'ONE_USE_BEN_CUTOVER_AUTHORISATION',
      'P9_SECURITY_AUTH_PASS_BEFORE_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE',
    ],
  },
  phase_12_security_gates: {
    phase: 12,
    state: 'DEFERRED_POST_CUTOVER',
    blocks_cutover: false,
    gates: [
      'P10_SECURITY_01',
      'ROUTE_ACTION_THREE_WAY_INVENTORY',
      'DEFAULT_DENY_FULL_PROBE_SUITE',
      'EGRESS_DENY_BY_DEFAULT_CERTIFICATION',
      'ACTION_AUTH_MATRIX_AND_WHOLE_TUPLE_REVOCATION',
      'MALICIOUS_SOURCE_AND_SUBSTITUTION_SECURITY_SUITE',
      'SNAPSHOT_SECURITY_ATTESTATIONS',
    ].map((id) => ({ id, state: 'DEFERRED_POST_CUTOVER' })),
  },
});

const authorityBrands = new WeakSet();

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const keys = Object.keys(value).sort(); const expected = [...allowedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new Error(`${label} has unsupported or missing fields`);
}
function requireExactOrder(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`${label} does not match the closed governing order`);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze); return Object.freeze(value);
}
function exactIds(entries, label) {
  if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry.id !== 'string')) throw new Error(`${label} must contain identified entries`);
  return entries.map((entry) => entry.id);
}
function validateCurrentRegistry(sourceRegistry) {
  requireExactKeys(sourceRegistry, Object.keys(CURRENT_V2_REGISTRY_CONTRACT), 'programme_gate_registry');
  if (sourceRegistry.schema !== CURRENT_V2_REGISTRY_CONTRACT.schema) throw new Error('governing registry schema is not canonical-programme-gates/v2');
  if (sourceRegistry.default_state !== 'OPEN' || !Array.isArray(sourceRegistry.allowed_states) || !sourceRegistry.allowed_states.includes('DEFERRED_POST_CUTOVER')) throw new Error('current governing registry state model is invalid');
  const preproductionIds = exactIds(sourceRegistry.preproduction_gates, 'preproduction_gates');
  const liveP9Ids = preproductionIds.filter((gateId) => gateId.startsWith('P9_'));
  requireExactOrder(liveP9Ids, CURRENT_LIVE_P9_GATE_IDS, 'live P9 registry');
  if (!preproductionIds.includes(PHASE_12_SECURITY_GATE_ID) || !preproductionIds.includes(COMPLETION_GATE_ID)) throw new Error('Ratified security and completion gates are missing from preproduction');
  if (sourceRegistry.preproduction_gates.some((gate) => gate.state !== 'OPEN')) throw new Error('live preproduction gates must remain OPEN in the current registry');
  const phase12 = sourceRegistry.phase_12_security_gates;
  if (!phase12 || phase12.phase !== 12 || phase12.state !== 'DEFERRED_POST_CUTOVER' || phase12.blocks_cutover !== false) throw new Error('Phase 12 security handling is invalid');
  const phase12Ids = exactIds(phase12.gates, 'phase_12_security_gates.gates');
  if (phase12Ids.includes(PHASE_12_SECURITY_GATE_ID) || phase12Ids.includes(COMPLETION_GATE_ID) || phase12.gates.some((gate) => gate.state !== 'DEFERRED_POST_CUTOVER')) throw new Error('Phase 12 security gate handling is invalid');
  const securityGate = sourceRegistry.preproduction_gates.find((gate) => gate.id === PHASE_12_SECURITY_GATE_ID);
  if (!securityGate || securityGate.state !== 'OPEN'
    || !isDeepStrictEqual(securityGate.prerequisite_for, [
      'CANONICAL_V2_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE',
      'INACTIVE_PRODUCTION_IMPORT',
      'PRODUCTION_ACTIVATION',
    ])) throw new Error('P9 security is not the closed production-access prerequisite');
  const completionGate = sourceRegistry.preproduction_gates.find((gate) => gate.id === COMPLETION_GATE_ID);
  if (!completionGate || completionGate.terminal !== true || completionGate.bundle_frozen !== true) throw new Error('P9 completion is not the bundle-frozen terminal leaf');
  if (!sourceRegistry.work_classes || typeof sourceRegistry.work_classes !== 'object' || Array.isArray(sourceRegistry.work_classes)) throw new TypeError('current governing registry work_classes must be an object');
  if (!isDeepStrictEqual(sourceRegistry, CURRENT_V2_REGISTRY_CONTRACT)) {
    throw new Error('current governing registry does not match the closed V2 contract');
  }
}
function compatibilityStatusGates() {
  const byGateId = new Map(ACCEPTANCE_DEFINITION_DESCRIPTORS.map((descriptor) => [descriptor.gate_id, descriptor]));
  return Object.freeze(STATUS_COMPATIBILITY_G0_GATE_IDS.map((gateId) => {
    const descriptor = byGateId.get(gateId);
    if (!descriptor) throw new Error(`active G0 status descriptor is unavailable: ${gateId}`);
    return Object.freeze({ id: gateId, evidence_contract: descriptor.evidence_contract, required_evidence_object_type: descriptor.evidence_object_type });
  }));
}

function createGoverningRegistryAuthority(...callerInputs) {
  if (callerInputs.length !== 0) {
    throw new TypeError('governing registry authority accepts no caller-authored source, parser, or digest input');
  }
  const sourceBytes = readGoverningSourceBytes(GOVERNING_REGISTRY_PATH);
  const sourceText = Buffer.isBuffer(sourceBytes) ? sourceBytes.toString('utf8') : String(sourceBytes);
  const parsed = parseYaml(sourceText, {
    strict: true,
    uniqueKeys: true,
    merge: false,
    maxAliasCount: 0,
  });
  requireExactKeys(parsed, ['programme_gate_registry'], 'governing registry document');
  validateCurrentRegistry(parsed.programme_gate_registry);
  const sourceRegistry = deepFreeze(structuredClone(parsed.programme_gate_registry));
  const digest = domainDigest(REGISTRY_DIGEST_DOMAIN, sourceRegistry);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new TypeError('governing registry digest must be a SHA-256 digest');
  const authority = Object.freeze({
    source_path: GOVERNING_REGISTRY_PATH,
    digest_domain: REGISTRY_DIGEST_DOMAIN,
    digest,
    source_registry: sourceRegistry,
    live_p9_gate_ids: CURRENT_LIVE_P9_GATE_IDS,
    security_prerequisite_gate_id: PHASE_12_SECURITY_GATE_ID,
    completion_gate_id: COMPLETION_GATE_ID,
    completion_gate_live: true,
    gates: compatibilityStatusGates(),
    work_classes: STATUS_COMPATIBILITY_WORK_CLASSES,
    gate_ids: STATUS_COMPATIBILITY_G0_GATE_IDS,
    work_class_ids: Object.freeze(Object.keys(STATUS_COMPATIBILITY_WORK_CLASSES)),
    supported_gate_ids: STATUS_COMPATIBILITY_G0_GATE_IDS,
    bootstrap_nonce: BOOTSTRAP_NONCE,
    closeable_preproduction_gate_ids: CLOSEABLE_PREPRODUCTION_GATE_IDS,
    preproduction_gate_status: computePreproductionGateStatus(sourceRegistry.preproduction_gates),
  });
  authorityBrands.add(authority); return authority;
}
function requireGoverningRegistryAuthority(value) {
  if (!authorityBrands.has(value)) throw new TypeError('a loaded governing registry authority is required');
  return value;
}

module.exports = {
  BOOTSTRAP_NONCE, CLOSEABLE_PREPRODUCTION_GATE_IDS, COMPLETION_GATE_ID, CURRENT_LIVE_P9_GATE_IDS,
  GOVERNING_REGISTRY_PATH, PHASE_12_SECURITY_GATE_ID, REGISTRY_DIGEST_DOMAIN,
  STATUS_COMPATIBILITY_G0_GATE_IDS,
  computePreproductionGateStatus, createGoverningRegistryAuthority,
  requireGoverningRegistryAuthority, validateCurrentRegistry,
  verifyContractBundleFreezeEvidence, verifyVerticalSliceEvidence,
};
