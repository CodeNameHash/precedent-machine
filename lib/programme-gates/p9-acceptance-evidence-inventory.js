'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const { sha256Hex } = require('../canonical-v2/canonical-bytes');
const { domainDigest } = require('./bytes');
const {
  COMPLETION_GATE_ID,
  COMPLETE_P9_GATE_IDS,
  CURRENT_LIVE_P9_GATE_IDS,
  SECURITY_GATE_ID,
} = require('./p9-acceptance-definition-authority');

const SCHEMA_VERSION = 'P9AcceptanceEvidenceInventory/V2';
const INVENTORY_ID_DOMAIN = 'PROGRAMME_GATE_P9_ACCEPTANCE_EVIDENCE_INVENTORY/V2';
const PROPOSAL_STATE = 'PROPOSAL_ONLY_NO_PREDICATE_NO_PASS';
const BUILDABILITY = 'NOT_BUILDABLE';

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const CONTRACTS_PATH = 'docs/codex-program/canonical-contracts.md';
const GATES_PATH = 'docs/codex-program/programme-gates.yaml';
const ADVERSARIAL_TESTS_PATH = 'docs/codex-program/adversarial-tests.md';
const RECOVERY_MODULE_PATH = 'lib/programme-gates/p9-acceptance-definition-authority.js';
const RECOVERY_TEST_PATH = 'tests/programme-gates/p9-acceptance-definition-authority.spec.js';

function spec(gateId, phasePartition, contractLocator, hostileTestIds, missingMechanism) {
  return Object.freeze({
    gate_id: gateId,
    phase_partition: phasePartition,
    contract_locator: contractLocator,
    hostile_test_ids: Object.freeze(hostileTestIds),
    missing_mechanism: missingMechanism,
  });
}

// These are evidence pointers, not acceptance definitions. The source text and
// every pointer digest are read at compilation time below.
const LIVE_LEAF_SPECS = Object.freeze([
  spec('P9_SCOPE_EXACT', 'P9_CORPUS_CERTIFICATION', 'CorpusScopeManifest inventories the', ['SCOPE-OMISSION-01'], 'Complete corpus-scope certification validator'),
  spec('P9_REGISTRY_DISPOSITIONS', 'P9_CORPUS_CERTIFICATION', '`CandidateReleaseManifest` selects, through exact immutable inventory roots', ['OPEN-WORLD-DISPOSITION-TOTALITY-01'], 'Disposition-completeness reconciliation validator'),
  spec('P9_MKT_WORK', 'P9_CORPUS_CERTIFICATION', 'Published market statistics are a census of the eligible active-release', ['IMPORT-MARKET-PARITY-01'], 'Corpus-wide market-work certification harness'),
  spec('P9_BEN_RUNBOOK', 'P9_CORPUS_CERTIFICATION', '`ProgrammeStatusPublicationHead` is the sole mutable pointer', [], 'Operator runbook artefact and reviewed execution record'),
  spec('P9_NUMERIC', 'P9_CORPUS_CERTIFICATION', 'unit, exact numeric representation, basis schema, conversion rule and version', ['METRIC-LINEAGE-01'], 'Corpus-scale numeric and unit conformance harness'),
  spec('P9_RENDER_PARITY', 'P9_CORPUS_CERTIFICATION', 'Serving projection and one row contract', ['IMPORT-SEMANTIC-PARITY-01'], 'Fresh corpus render-parity generator'),
  spec('P9_STRUCTURED_CLAIMS', 'P9_CORPUS_CERTIFICATION', 'Typed claims, evidence and explicit states', ['ID-CLAIM-01'], 'Structured-claim conformance validator'),
  spec('P9_PARTY_LINT', 'P9_CORPUS_CERTIFICATION', 'where `party` is the complete governed', ['OPEN-WORLD-PARTY-01'], 'Corpus party and entity-class lint'),
  spec('P9_SHADOW_REEXTRACTION', 'P9_CORPUS_CERTIFICATION', '`ShadowReextractionAttestation` hashes its schema', ['SHADOW-REEXTRACTION-01'], 'Shadow re-extraction executor and comparator'),
  spec('P9_IDENTITY_AND_DRIFT', 'P9_CORPUS_CERTIFICATION', 'Definitions-first semantic objects and stable identity', ['ID-OBJECT-01'], 'Corpus-wide identity and drift reconciler'),
  spec('P9_BROWSER_A11Y_PERFORMANCE', 'P9_CORPUS_CERTIFICATION', 'The binding performance matrix covers every', ['QUERY-EXEC-01'], 'Corpus browser accessibility and performance harness'),
  spec('P9_STAGING_SMOKE_AND_ROLLBACK', 'P9_CORPUS_CERTIFICATION', 'No failed or partial restoration can be reported as rollback', ['FIRST-CANONICAL-LEGACY-ROLLBACK-01'], 'Consolidated staging smoke and rollback controller'),
  spec('P9_DATABASE_SOAK', 'P9_CORPUS_CERTIFICATION', 'The soak manifest selects the exact ReleaseQueryExecutionClassRegistry', ['CAPACITY-LOAD-01', 'QUERY-EXEC-01'], 'Load fixture builder and database soak harness'),
  spec('P9_BACKUP_RESTORE', 'P9_CORPUS_CERTIFICATION', 'LegacyBaselineRollbackRehearsalAttestation', ['LEGACY-RESTORATION-TRANSACTION-01'], 'Backup and restore drill controller'),
  spec('P9_PREIMPORT_TRACEABILITY', 'P9_CORPUS_CERTIFICATION', '`P9_PREIMPORT_TRACEABILITY` certifies only', ['TRACE-EXTENSION-01'], 'Pre-import traceability matrix generator'),
  spec('P9_SECURITY_AUTH', 'P9_PRODUCTION_ACCESS_PREREQUISITE', '`P9_SECURITY_AUTH` is the production-access security prerequisite', ['PREVIEW-AUTH-01', 'DEPLOY-CUTOVER-01'], 'Pre-access security review verifier and production-access fence'),
  spec('P9_DEPLOYMENT_PARITY', 'P10_PRODUCTION_IMPORT', 'DeploymentParityAttestation selects the DeploymentManifest', ['DEPLOYMENT-PARITY-FRESHNESS-01', 'DEPLOY-CUTOVER-01'], 'Inactive-production parity attestation executor'),
  spec('P9_IMPORT_PARITY', 'P10_PRODUCTION_IMPORT', 'ProductionImportAttestation and terminal ATTESTED head', ['IMPORT-LIFECYCLE-01'], 'Checkpointed production-import parity controller'),
  spec('P9_PROMOTION_ELIGIBILITY', 'P10_PRODUCTION_IMPORT', '`P9_PROMOTION_ELIGIBILITY` is `PASS` only', ['PROMOTION-EVIDENCE-01'], 'Candidate-promotion eligibility fence validator'),
  spec('P9_CUTOVER_AUTHORISATION', 'P11_CUTOVER', 'Ben then issues one immutable, expiring, one-use `CutoverAuthorisation`', ['DEPLOY-CUTOVER-01'], 'One-use cutover-authorisation controller'),
  spec('P9_POSTCUTOVER_SMOKE', 'P11_CUTOVER', 'matching passing PostCutoverSmokeAttestation permits the', ['POST-ACTIVATION-CONTROLLER-01'], 'Production post-cutover smoke executor'),
  spec('P9_TRACEABILITY', 'P9_TO_P11_CROSS_PHASE', '`P9_TRACEABILITY`\ncertifies exact bidirectional coverage', ['TRACE-EXTENSION-01'], 'End-to-end traceability matrix generator'),
  spec(COMPLETION_GATE_ID, 'P11_CUTOVER_TERMINAL', 'The completion validator first produces exact passing `P9_TRACEABILITY`', ['PROGRAMME-COMPLETE-01'], 'Programme-completion validator and terminal-pair publisher'),
]);

const SECURITY_PREREQUISITE = Object.freeze({
  gate_id: SECURITY_GATE_ID,
  phase_partition: 'P9_PRODUCTION_ACCESS_PREREQUISITE',
  governing_registry_locator: '- id: P9_SECURITY_AUTH',
  state: 'LIVE_OPEN',
  blocks_production_credential: true,
  blocks_inactive_import: true,
  blocks_activation: true,
  disposition: 'INCLUDED_IN_P9_ACCEPTANCE_EVIDENCE_LEAVES',
  authority: 'NONE',
});

function sameOrder(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function requireRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute path');
  }
  return repositoryRoot;
}

function loadLiveP9GateIds({ repositoryRoot = REPOSITORY_ROOT } = {}) {
  const root = requireRepositoryRoot(repositoryRoot);
  const registry = YAML.parse(fs.readFileSync(path.join(root, GATES_PATH), 'utf8'))?.programme_gate_registry;
  if (!registry || !Array.isArray(registry.preproduction_gates)) {
    throw new Error('governing P9 gate registry is unavailable');
  }
  return Object.freeze(registry.preproduction_gates
    .map((gate) => gate?.id)
    .filter((gateId) => typeof gateId === 'string' && gateId.startsWith('P9_')));
}

function readAnchoredSource(repositoryRoot, sourcePath, locator, label) {
  const absolutePath = path.resolve(repositoryRoot, sourcePath);
  if (!absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`${label} escapes repository root`);
  }
  if (!fs.existsSync(absolutePath)) throw new Error(`${label} source is missing: ${sourcePath}`);
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!source.includes(locator)) {
    throw new Error(`${label} locator is missing from ${sourcePath}`);
  }
  return Object.freeze({
    source_path: sourcePath,
    source_sha256: sha256Hex(Buffer.from(source, 'utf8')),
    locator,
    locator_sha256: sha256Hex(Buffer.from(locator, 'utf8')),
  });
}

function gateRegistryAnchor(repositoryRoot, gateId) {
  return readAnchoredSource(repositoryRoot, GATES_PATH, `- id: ${gateId}`, `P9 gate ${gateId}`);
}

function inventoryAnchor(repositoryRoot, gateId) {
  return Object.freeze({
    anchor_kind: 'GOVERNING_GATE_REGISTRY_ENTRY',
    source: gateRegistryAnchor(repositoryRoot, gateId),
  });
}

function hostileScenarioReferences(repositoryRoot, hostileTestIds) {
  return Object.freeze(hostileTestIds.map((testId) => Object.freeze({
    test_id: testId,
    evidence_state: 'DOCUMENTED_SCENARIO_ONLY_NOT_EXECUTABLE',
    source: readAnchoredSource(repositoryRoot, ADVERSARIAL_TESTS_PATH, testId, `hostile test ${testId}`),
  })));
}

function recoveryImplementationCitations(repositoryRoot) {
  return Object.freeze([
    Object.freeze({
      citation_kind: 'RECOVERY_SCAFFOLD_MODULE_ONLY',
      source: readAnchoredSource(repositoryRoot, RECOVERY_MODULE_PATH, 'compileP9AcceptanceDefinitionAuthority', 'P9 recovery module'),
    }),
    Object.freeze({
      citation_kind: 'RECOVERY_SCAFFOLD_TEST_ONLY',
      source: readAnchoredSource(repositoryRoot, RECOVERY_TEST_PATH, 'hostile drift cannot remove security or completion', 'P9 recovery test'),
    }),
  ]);
}

function leafRecord(repositoryRoot, leafSpec) {
  const gateId = leafSpec.gate_id;
  return Object.freeze({
    gate_id: gateId,
    inventory_state: gateId === COMPLETION_GATE_ID
      ? 'LIVE_RATIFIED_BUNDLE_FROZEN_TERMINAL_LEAF'
      : 'LIVE_P9_LEAF',
    proposal_state: PROPOSAL_STATE,
    pass_issuance: 'PROHIBITED',
    buildability: BUILDABILITY,
    phase_partition: leafSpec.phase_partition,
    required_user_decision: null,
    governing_contract_paragraph_anchors: Object.freeze([
      inventoryAnchor(repositoryRoot, gateId),
      Object.freeze({
        anchor_kind: 'GOVERNING_CONTRACT_PARAGRAPH',
        source: readAnchoredSource(repositoryRoot, CONTRACTS_PATH, leafSpec.contract_locator, `P9 contract ${gateId}`),
      }),
    ]),
    hostile_test_references: hostileScenarioReferences(repositoryRoot, leafSpec.hostile_test_ids),
    hostile_test_coverage_state: leafSpec.hostile_test_ids.length === 0
      ? 'NO_DOCUMENTED_SCENARIO_ID'
      : 'DOCUMENTED_SCENARIO_ONLY_NOT_EXECUTABLE',
    existing_implementation_citations: recoveryImplementationCitations(repositoryRoot),
    implementation_state: 'RECOVERY_SCAFFOLD_ONLY_NO_GATE_MECHANISM',
    missing_mechanism: leafSpec.missing_mechanism,
  });
}

function inventoryPayload(inventory) {
  return {
    schema_version: inventory.schema_version,
    live_p9_gate_ids: inventory.live_p9_gate_ids,
    complete_p9_gate_ids: inventory.complete_p9_gate_ids,
    proposal_state: inventory.proposal_state,
    leaves: inventory.leaves,
    security_prerequisite: inventory.security_prerequisite,
  };
}

function compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot = REPOSITORY_ROOT }) {
  if (!sameOrder(p9GateIds, CURRENT_LIVE_P9_GATE_IDS)) {
    throw new Error('live P9 gate inventory differs from the recorded governing conflict');
  }
  const root = requireRepositoryRoot(repositoryRoot);
  const leaves = LIVE_LEAF_SPECS.map((leafSpec) => leafRecord(root, leafSpec));
  const inventory = {
    schema_version: SCHEMA_VERSION,
    inventory_id: '0'.repeat(64),
    inventory_digest: '0'.repeat(64),
    live_p9_gate_ids: Object.freeze([...CURRENT_LIVE_P9_GATE_IDS]),
    complete_p9_gate_ids: Object.freeze([...COMPLETE_P9_GATE_IDS]),
    proposal_state: PROPOSAL_STATE,
    leaves: Object.freeze(leaves),
    security_prerequisite: Object.freeze({
      ...SECURITY_PREREQUISITE,
      source: readAnchoredSource(root, GATES_PATH, SECURITY_PREREQUISITE.governing_registry_locator, 'P9 security prerequisite'),
    }),
  };
  const digest = domainDigest(INVENTORY_ID_DOMAIN, inventoryPayload(inventory));
  inventory.inventory_id = digest;
  inventory.inventory_digest = digest;
  const definitionProposal = require('./p9-definition-proposal-layer')
    .buildP9DefinitionProposalLayerFromInventory({ inventory, repository_root: root });
  inventory.definition_proposal_binding = require('./p9-definition-proposal-layer').proposalBinding(definitionProposal);
  return Object.freeze(inventory);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!sameOrder(actual, wanted)) throw new Error(`${label} has unsupported or missing fields`);
}

function validateP9AcceptanceEvidenceInventory(inventory, {
  p9GateIds,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  const expected = compileP9AcceptanceEvidenceInventory({ p9GateIds, repositoryRoot });
  exactKeys(inventory, Object.keys(expected), 'P9 acceptance evidence inventory');
  if (inventory.schema_version !== SCHEMA_VERSION
    || inventory.proposal_state !== PROPOSAL_STATE
    || inventory.inventory_id !== expected.inventory_id
    || inventory.inventory_digest !== expected.inventory_digest
    || !sameOrder(inventory.live_p9_gate_ids, CURRENT_LIVE_P9_GATE_IDS)
    || !sameOrder(inventory.complete_p9_gate_ids, COMPLETE_P9_GATE_IDS)
    || !Array.isArray(inventory.leaves)
    || inventory.leaves.length !== COMPLETE_P9_GATE_IDS.length) {
    throw new Error('P9 acceptance evidence inventory is not fail-closed');
  }
  const security = inventory.security_prerequisite;
  if (!security || security.gate_id !== SECURITY_GATE_ID
    || security.phase_partition !== 'P9_PRODUCTION_ACCESS_PREREQUISITE'
    || security.state !== 'LIVE_OPEN'
    || security.blocks_production_credential !== true
    || security.blocks_inactive_import !== true
    || security.blocks_activation !== true
    || security.authority !== 'NONE'
    || security.disposition !== 'INCLUDED_IN_P9_ACCEPTANCE_EVIDENCE_LEAVES'
    || !inventory.leaves.some((leaf) => leaf.gate_id === SECURITY_GATE_ID)) {
    throw new Error('P9 security gate is misclassified');
  }
  for (const [index, leaf] of inventory.leaves.entries()) {
    const gateId = COMPLETE_P9_GATE_IDS[index];
    const completion = gateId === COMPLETION_GATE_ID;
    if (!leaf || leaf.gate_id !== gateId
      || leaf.inventory_state !== (completion ? 'LIVE_RATIFIED_BUNDLE_FROZEN_TERMINAL_LEAF' : 'LIVE_P9_LEAF')
      || leaf.proposal_state !== PROPOSAL_STATE
      || leaf.pass_issuance !== 'PROHIBITED'
      || leaf.buildability !== BUILDABILITY
      || leaf.required_user_decision !== null
      || !Array.isArray(leaf.governing_contract_paragraph_anchors)
      || leaf.governing_contract_paragraph_anchors.length !== 2
      || !Array.isArray(leaf.hostile_test_references)
      || !Array.isArray(leaf.existing_implementation_citations)
      || leaf.existing_implementation_citations.length === 0
      || leaf.implementation_state !== 'RECOVERY_SCAFFOLD_ONLY_NO_GATE_MECHANISM'
      || typeof leaf.missing_mechanism !== 'string'
      || leaf.missing_mechanism.length === 0) {
      throw new Error(`P9 acceptance evidence leaf ${gateId} is not fail-closed`);
    }
  }
  const definitionLayer = require('./p9-definition-proposal-layer');
  if (!inventory.definition_proposal_binding || typeof inventory.definition_proposal_binding !== 'object') {
    throw new Error('P9 acceptance evidence inventory has no P9 definition proposal binding');
  }
  const expectedDefinitionProposal = definitionLayer.buildP9DefinitionProposalLayerFromInventory({
    inventory: {
      ...inventory,
      definition_proposal_binding: undefined,
    },
    repository_root: repositoryRoot,
  });
  const expectedDefinitionBinding = definitionLayer.proposalBinding(expectedDefinitionProposal);
  if (JSON.stringify(inventory.definition_proposal_binding) !== JSON.stringify(expectedDefinitionBinding)) {
    throw new Error('P9 acceptance evidence inventory definition proposal binding is stale');
  }
  if (JSON.stringify(inventoryPayload(inventory)) !== JSON.stringify(inventoryPayload(expected))) {
    throw new Error('P9 acceptance evidence inventory sources or citations are stale');
  }
  return true;
}

module.exports = {
  BUILDABILITY,
  INVENTORY_ID_DOMAIN,
  SECURITY_PREREQUISITE,
  SECURITY_GATE_ID,
  PROPOSAL_STATE,
  SCHEMA_VERSION,
  compileP9AcceptanceEvidenceInventory,
  inventoryPayload,
  loadLiveP9GateIds,
  validateP9AcceptanceEvidenceInventory,
};
