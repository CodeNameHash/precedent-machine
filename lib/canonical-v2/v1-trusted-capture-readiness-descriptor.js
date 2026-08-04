'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const control = require('./v1-trusted-capture-control-contracts');
const capture = require('./v1-capture-evidence-proposal');
const replay = require('./v1-replay-evidence-proposal');

const SCHEMA = 'V1_TRUSTED_CAPTURE_READINESS_DESCRIPTOR/V1';
const STATUS = 'BLOCKED_NOT_EXECUTABLE';
const MISSING_REQUIREMENTS = Object.freeze([
  'TRUST_REGISTRY_AMENDMENT_FOR_CONTROLLER_AND_WORKER_SIGNATURES',
  'EXTERNAL_CONTROLLER_AND_WORKER_REGISTRATIONS',
  'APPROVED_READ_ONLY_DATABASE_AUTHORITY',
  'CONTROLLED_CAPTURE_WORKER_EXECUTION',
  'COMPLETE_40_BY_19_RENDER_SURFACE_CAPTURE',
  'TWO_INDEPENDENT_REPLAY_EXECUTIONS',
  'FINAL_SIGNATURE_VERIFICATION',
  'PASS_ISSUANCE_CONTROLLER',
]);

function requireNonTemporaryRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) throw new Error('V1 trusted capture readiness descriptor requires an absolute repository root.');
  const resolved = path.resolve(repositoryRoot);
  const temporaryRoots = [os.tmpdir(), '/tmp', '/var/tmp'].map((entry) => path.resolve(entry));
  if (temporaryRoots.some((temporaryRoot) => resolved === temporaryRoot || resolved.startsWith(`${temporaryRoot}${path.sep}`))) {
    throw new Error('V1 trusted capture readiness descriptor cannot use a temporary repository root.');
  }
  return resolved;
}

function moduleDigest(root, relativePath) {
  return sha256Hex(fs.readFileSync(path.join(root, relativePath)));
}
function schemaEntry(module_key, relative_path, schema_versions, root) {
  return Object.freeze({ module_key, relative_path, schema_versions: Object.freeze([...schema_versions]), source_sha256: moduleDigest(root, relative_path) });
}
function sourceModules(root) {
  return Object.freeze([
    schemaEntry('CONTROL', 'lib/canonical-v2/v1-trusted-capture-control-contracts.js', [
      control.FROZEN_PLAN_SCHEMA, control.CAPTURE_PREFLIGHT_SCHEMA, control.CAPTURE_APPROVAL_REQUEST_SCHEMA,
      control.WORKER_REGISTRATION_SCHEMA, control.SIGNED_RUN_HEAD_SCHEMA, control.SIGNED_RUN_EVENT_SCHEMA,
      control.RECONSTRUCTED_REFERENCE_SCHEMA,
    ], root),
    schemaEntry('CAPTURE', 'lib/canonical-v2/v1-capture-evidence-proposal.js', [
      capture.DATABASE_SNAPSHOT_IDENTITY_SCHEMA, capture.INPUT_PAGE_SCHEMA,
      capture.PARSED_SOURCE_ROW_SCHEMA, capture.SOURCE_CAPTURE_SCHEMA,
    ], root),
    schemaEntry('REPLAY', 'lib/canonical-v2/v1-replay-evidence-proposal.js', [
      replay.LOADED_MODULE_TRACE_SCHEMA, replay.SURFACE_OUTPUT_SCHEMA, replay.REPLAY_RECEIPT_SCHEMA,
      replay.SOURCE_DISPOSITION_SCHEMA, replay.REFERENCE_ARCHIVE_SCHEMA, replay.VALIDATOR_LEDGER_SCHEMA,
      replay.ACQUISITION_ATTESTATION_SCHEMA,
    ], root),
  ]);
}
function buildV1TrustedCaptureReadinessDescriptor({ repository_root = path.resolve(__dirname, '../..') } = {}) {
  const modules = sourceModules(requireNonTemporaryRepositoryRoot(repository_root));
  const body = {
    schema_version: SCHEMA,
    status: STATUS,
    authority: 'NONE',
    reconstructed_reference: control.buildReconstructedReferenceProposal(),
    source_modules: modules,
    missing_requirements: MISSING_REQUIREMENTS,
  };
  return Object.freeze({ ...body, readiness_descriptor_id: contentId(SCHEMA, body) });
}
function validateV1TrustedCaptureReadinessDescriptor(value, { repository_root = path.resolve(__dirname, '../..') } = {}) {
  const keys = ['authority', 'missing_requirements', 'readiness_descriptor_id', 'reconstructed_reference', 'schema_version', 'source_modules', 'status'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson(keys)
    || value.schema_version !== SCHEMA || value.status !== STATUS || value.authority !== 'NONE') {
    throw new Error('V1 trusted capture readiness descriptor must remain a blocked non-authoritative shape.');
  }
  const expected = buildV1TrustedCaptureReadinessDescriptor({ repository_root });
  if (canonicalJson(value) !== canonicalJson(expected)) throw new Error('V1 trusted capture readiness descriptor is stale or incomplete.');
  return expected;
}

module.exports = {
  SCHEMA,
  STATUS,
  MISSING_REQUIREMENTS,
  requireNonTemporaryRepositoryRoot,
  sourceModules,
  buildV1TrustedCaptureReadinessDescriptor,
  validateV1TrustedCaptureReadinessDescriptor,
};
