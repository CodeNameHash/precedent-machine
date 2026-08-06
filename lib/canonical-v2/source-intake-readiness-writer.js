'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const {
  buildInitialImportProposalPacket,
  validateInitialImportProposalPacket,
} = require('./governed-identity-proposal-packet');
const {
  POLICY_SCHEMA,
} = require('./routine-primary-source-disposition-policy');
const {
  TOPBUILD_SECOND_OCCURRENCE_ID,
  validateTopBuildOrdinaryMultiOccurrenceDispositionPacket,
} = require('./topbuild-ordinary-multi-occurrence-disposition-packet');
const {
  INITIAL_IMPORT_POLICY_ONLY_BLOCKER,
  INITIAL_IMPORT_POLICY_STATUS,
  SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  buildSourceIntakeReadiness,
} = require('./source-intake-readiness');
const { validateCaptureReceipt, validateCohortCaptureManifest } = require('./corpus-source-discovery-capture');

const MATERIALISATION_SCHEMA = 'M3_SOURCE_INTAKE_READINESS_MATERIALISATION/V1';
const OUTPUT_DIRECTORY = 'm3-source-intake-readiness';
const COHORT_DIRECTORY = 'm3-corpus-source-capture';
const PENDING_IDENTITY_PACKET_FILE = 'governed-identity-initial-import-proposal-packet.json';

class SourceIntakeReadinessWriterError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceIntakeReadinessWriterError'; this.code = code; }
}

function fail(code, message) { throw new SourceIntakeReadinessWriterError(code, message); }
function exactKeys(value, keys) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function isInside(root, candidate) { const relative = path.relative(root, candidate); return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); }
function readJson(file, code) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { fail(code, `Could not read JSON input ${file}: ${error.message}`); } }

function readCurrentCohortReceiptRecords({ artifact_root: artifactRoot } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  const cohortDirectory = path.join(root, COHORT_DIRECTORY);
  const manifestPath = path.join(cohortDirectory, 'cohort-capture-manifest.json');
  if (!isInside(root, manifestPath) || !fs.existsSync(manifestPath)) fail('CURRENT_COHORT_MISSING', 'current 41-source cohort manifest is missing.');
  const cohortManifest = readJson(manifestPath, 'CURRENT_COHORT_READ_FAILED');
  const records = [];
  for (const entry of fs.readdirSync(cohortDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(cohortDirectory, entry.name);
    const files = ['intake-receipt.json', 'discovery.json', 'capture.json', 'canonical-conversion.json', 'canonical-verification.json'];
    if (!files.every((name) => fs.existsSync(path.join(directory, name)))) continue;
    records.push(Object.freeze({
      receipt: readJson(path.join(directory, 'intake-receipt.json'), 'CURRENT_COHORT_READ_FAILED'),
      discovery: readJson(path.join(directory, 'discovery.json'), 'CURRENT_COHORT_READ_FAILED'),
      capture: readJson(path.join(directory, 'capture.json'), 'CURRENT_COHORT_READ_FAILED'),
      conversion: readJson(path.join(directory, 'canonical-conversion.json'), 'CURRENT_COHORT_READ_FAILED'),
      verification: readJson(path.join(directory, 'canonical-verification.json'), 'CURRENT_COHORT_READ_FAILED'),
    }));
  }
  try { validateCohortCaptureManifest(cohortManifest); } catch (error) { fail(error?.code || 'CURRENT_COHORT_INVALID', error?.message || 'current cohort manifest did not validate.'); }
  const associations = new Map(cohortManifest.receipt_associations.map((item) => [item.occurrence_id, item]));
  const seen = new Set();
  for (const record of records) {
    try { validateCaptureReceipt(record.receipt); } catch (error) { fail(error?.code || 'CURRENT_COHORT_INVALID', error?.message || 'current intake receipt did not validate.'); }
    const association = associations.get(record.receipt.occurrence_id);
    if (!association || seen.has(record.receipt.occurrence_id)
      || association.receipt_id !== record.receipt.receipt_id
      || association.discovery_id !== record.discovery.discovery_id
      || record.receipt.discovery_id !== record.discovery.discovery_id
      || record.receipt.capture_id !== record.capture.intake_capture_receipt_id
      || record.receipt.conversion_id !== record.conversion.canonical_text_id
      || record.receipt.verification_id !== record.verification.verification_manifest_id
      || record.capture.response_bytes_sha256 !== record.receipt.raw_sha256
      || record.verification.verification_status !== 'PASS'
      || record.verification.source_admission_status !== 'NOT_ATTEMPTED'
      || record.conversion.source_admission_status !== 'NOT_ATTEMPTED'
      || record.discovery.admission_authority !== 'NOT_ADMISSION_AUTHORITY') {
      fail('CURRENT_COHORT_BINDING_INVALID', 'stored cohort receipt, discovery, capture, conversion, and verification bindings are not exact.');
    }
    seen.add(record.receipt.occurrence_id);
  }
  if (records.length !== 41 || seen.size !== associations.size || associations.size !== 41) fail('CURRENT_COHORT_CARDINALITY_INVALID', 'current Phase 1 cohort must contain exactly 41 bound source occurrences.');
  return Object.freeze({ cohort_manifest: cohortManifest, receipt_records: Object.freeze(records.sort((left, right) => left.discovery.occurrence_id.localeCompare(right.discovery.occurrence_id))) });
}

function buildCurrentRoutinePolicy(cohort) {
  const byDeal = new Map();
  for (const record of cohort.receipt_records) {
    const rows = byDeal.get(record.discovery.deal_id) || [];
    rows.push(record); byDeal.set(record.discovery.deal_id, rows);
  }
  const rows = [...byDeal.entries()].map(([dealId, records]) => {
    const primary = records.filter(({ discovery }) => discovery.occurrence_kind === 'METADATA_PRIMARY_SEC_OCCURRENCE');
    if (primary.length !== 1) fail('CURRENT_ROUTINE_POLICY_INVALID', 'each current deal must retain exactly one metadata primary occurrence.');
    const additional = records.filter(({ discovery }) => discovery.occurrence_kind === 'DECLARED_ADDITIONAL_SEC_OCCURRENCE');
    return Object.freeze({
      deal_id: dealId,
      primary_occurrence_id: primary[0].discovery.occurrence_id,
      primary_source_url_sha256: sha256Hex(primary[0].discovery.source_metadata.source_url),
      additional_occurrence_ids: additional.map(({ discovery }) => discovery.occurrence_id).sort(),
      proposed_disposition: additional.length === 0 ? 'PROPOSED_ROUTINE_PRIMARY_DISPOSITION_REVIEW_REQUIRED' : 'PROPOSED_ORDINARY_MULTI_OCCURRENCE_INCLUSION_REVIEW_REQUIRED',
      admission_authority: 'NOT_ADMISSION_AUTHORITY', source_admission_status: 'NOT_ATTEMPTED', deal_admission_status: 'NOT_ATTEMPTED',
    });
  }).sort((left, right) => left.deal_id.localeCompare(right.deal_id));
  const body = { schema_version: POLICY_SCHEMA, status: 'PROPOSED_NOT_AUTHORITY', cohort_capture_manifest_id: cohort.cohort_manifest.cohort_capture_manifest_id, routine_primary_source_dispositions: rows, admission_authority: 'NOT_ADMISSION_AUTHORITY', source_admission_status: 'NOT_ATTEMPTED', deal_admission_status: 'NOT_ATTEMPTED' };
  return Object.freeze({ ...body, policy_id: contentId(POLICY_SCHEMA, body) });
}

function buildCurrentTopBuildPacket(cohort, primaryOccurrenceId) {
  const byOccurrence = new Map(cohort.receipt_records.map((record) => [record.discovery.occurrence_id, record]));
  const primary = byOccurrence.get(primaryOccurrenceId);
  const corroborating = byOccurrence.get(TOPBUILD_SECOND_OCCURRENCE_ID);
  if (!primary || !corroborating || primary.discovery.deal_id !== corroborating.discovery.deal_id) fail('TOPBUILD_PRIMARY_OCCURRENCE_MISSING', 'current TopBuild binding is incomplete.');
  const bind = (record, evidence_role) => Object.freeze({ occurrence_id: record.discovery.occurrence_id, discovery_id: record.discovery.discovery_id, receipt_id: record.receipt.receipt_id, source_url: record.discovery.source_metadata.source_url, raw_sha256: record.receipt.raw_sha256, canonical_text_sha256: record.conversion.canonical_text_sha256, evidence_role });
  const body = { schema_version: 'M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_PACKET/V1', status: 'NOT_ISSUED', cohort_capture_manifest_id: cohort.cohort_manifest.cohort_capture_manifest_id, deal_id: primary.discovery.deal_id, occurrences: Object.freeze([bind(primary, 'PRIMARY_EVIDENCE_UNREDACTED_TOPBUILD'), bind(corroborating, 'CORROBORATING_EVIDENCE_REDACTED_QXO')]), legal_findings: Object.freeze({ same_executed_agreement: true, matched_section_count: 62, total_section_count: 63, section_7_7_redaction_delta: Object.freeze({ redacted_item_count: 2, redaction_kind: 'EMAIL_ADDRESS_ONLY' }) }), proposed_treatment: 'ORDINARY_MULTI_OCCURRENCE_INCLUSION', non_conclusions: Object.freeze({ exclusion: 'NOT_CONCLUDED', exact_duplicate: 'NOT_CONCLUDED', separate_version: 'NOT_CONCLUDED' }), execution_sources: Object.freeze([]), admission_authority: 'NOT_ADMISSION_AUTHORITY', source_admission_status: 'NOT_ATTEMPTED', deal_admission_status: 'NOT_ATTEMPTED' };
  return Object.freeze({ ...body, packet_id: contentId(body.schema_version, body) });
}

function readCurrentPendingIdentityPacket({ artifact_root: artifactRoot } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  const packetPath = path.join(root, PENDING_IDENTITY_PACKET_FILE);
  if (!isInside(root, packetPath) || !fs.existsSync(packetPath)) fail('PENDING_IDENTITY_PACKET_MISSING', 'current pending forty-row identity packet is missing.');
  const packet = readJson(packetPath, 'PENDING_IDENTITY_PACKET_READ_FAILED');
  try { validateInitialImportProposalPacket(packet); } catch (error) {
    fail(error?.code || 'PENDING_IDENTITY_PACKET_INVALID', error?.message || 'pending identity packet did not validate.');
  }
  if (packet.status !== INITIAL_IMPORT_POLICY_STATUS
    || packet.admission_authority !== 'NONE' || packet.source_admission_authority !== 'NONE'
    || packet.deal_admission_authority !== 'NONE') {
    fail('IDENTITY_POLICY_PACKET_STATUS_INVALID', 'only the current adopted identity-seed policy packet with no issuance or admission authority may enter this readiness receipt.');
  }
  return Object.freeze({ packet, packet_path: packetPath });
}

function buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot } = {}) {
  const cohort = readCurrentCohortReceiptRecords({ artifact_root: artifactRoot });
  const pending = readCurrentPendingIdentityPacket({ artifact_root: artifactRoot });
  const routinePolicy = buildCurrentRoutinePolicy(cohort);
  const topBuildCorroboratingRecord = cohort.receipt_records.find(({ discovery }) => (
    discovery.occurrence_id === TOPBUILD_SECOND_OCCURRENCE_ID
  ));
  const primaryOccurrenceId = topBuildCorroboratingRecord?.discovery?.primary_occurrence_relationship?.primary_occurrence_id;
  if (typeof primaryOccurrenceId !== 'string' || !primaryOccurrenceId) {
    fail('TOPBUILD_PRIMARY_OCCURRENCE_MISSING', 'current cohort does not bind the declared TopBuild corroborating occurrence to one primary occurrence.');
  }
  const topBuildPacket = buildCurrentTopBuildPacket(cohort, primaryOccurrenceId);
  validateTopBuildOrdinaryMultiOccurrenceDispositionPacket(topBuildPacket);
  const readiness = buildSourceIntakeReadiness({
    ...cohort,
    governed_deal_identity_authority: pending.packet,
    routine_primary_policy: routinePolicy,
    topbuild_disposition_packet: topBuildPacket,
    ordinary_reviewed_dispositions: [],
  });
  const expectedBlockers = [
    INITIAL_IMPORT_POLICY_ONLY_BLOCKER,
    'UNISSUED_DEAL_IDENTITIES',
    ...SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  ];
  if (readiness.status !== 'BLOCKED' || canonicalJson(readiness.blockers) !== canonicalJson(expectedBlockers)
    || readiness.execution_sources.length !== 0 || readiness.admission_authority !== 'NOT_ADMISSION_AUTHORITY'
    || readiness.source_admission_status !== 'NOT_ATTEMPTED' || readiness.deal_admission_status !== 'NOT_ATTEMPTED'
    || readiness.source_intake_authority.authority !== 'NONE'
    || readiness.source_intake_authority.trusted_controller_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || readiness.source_intake_authority.trusted_registry_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || readiness.caller_authority_diagnostic.authority !== 'NONE') {
    fail('CURRENT_READINESS_NOT_FAIL_CLOSED', 'current readiness receipt did not preserve the exact proposal-only blockers.');
  }
  const body = {
    schema_version: MATERIALISATION_SCHEMA,
    status: 'BLOCKED_PROPOSAL_ONLY_NOT_AUTHORITY',
    input_bindings: Object.freeze({
      cohort_capture_manifest_id: cohort.cohort_manifest.cohort_capture_manifest_id,
      source_occurrence_count: cohort.receipt_records.length,
      pending_identity_packet_id: pending.packet.initial_import_proposal_packet_id,
      pending_identity_packet_sha256: sha256Hex(fs.readFileSync(pending.packet_path)),
      routine_primary_policy_id: routinePolicy.policy_id,
      topbuild_ordinary_multi_occurrence_packet_id: topBuildPacket.packet_id,
    }),
    readiness_receipt: readiness,
    execution_sources: Object.freeze([]),
    database_authority: 'NONE',
    production_authority: 'NONE',
  };
  return Object.freeze({ ...body, materialisation_id: contentId(MATERIALISATION_SCHEMA, body) });
}

function validateCurrentSourceIntakeReadinessMaterialisation({ materialisation, artifact_root: artifactRoot } = {}) {
  const keys = ['schema_version', 'status', 'input_bindings', 'readiness_receipt', 'execution_sources', 'database_authority', 'production_authority', 'materialisation_id'];
  if (!exactKeys(materialisation, keys) || materialisation.schema_version !== MATERIALISATION_SCHEMA
    || materialisation.status !== 'BLOCKED_PROPOSAL_ONLY_NOT_AUTHORITY'
    || !Array.isArray(materialisation.execution_sources) || materialisation.execution_sources.length !== 0
    || materialisation.database_authority !== 'NONE' || materialisation.production_authority !== 'NONE') {
    fail('SOURCE_INTAKE_READINESS_MATERIALISATION_INVALID', 'readiness materialisation must remain a blocked proposal-only receipt.');
  }
  const rebuilt = buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot });
  if (canonicalJson(rebuilt) !== canonicalJson(materialisation)) fail('SOURCE_INTAKE_READINESS_MATERIALISATION_STALE', 'readiness materialisation did not recompute from current exact inputs.');
  return rebuilt;
}

function writeCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot, materialisation } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  validateCurrentSourceIntakeReadinessMaterialisation({ materialisation, artifact_root: root });
  const outputDirectory = path.join(root, OUTPUT_DIRECTORY);
  const outputPath = path.join(outputDirectory, `readiness-${materialisation.materialisation_id}.json`);
  if (!isInside(root, outputDirectory) || !isInside(root, outputPath)) fail('SOURCE_INTAKE_READINESS_OUTPUT_PATH_INVALID', 'readiness output must stay inside durable artefact root.');
  const bytes = Buffer.from(`${JSON.stringify(materialisation, null, 2)}\n`, 'utf8');
  if (fs.existsSync(outputPath)) {
    if (!fs.readFileSync(outputPath).equals(bytes)) fail('CONTENT_ADDRESS_COLLISION', 'readiness output path already contains different bytes.');
    return Object.freeze({ status: 'ALREADY_PRESENT', materialisation_id: materialisation.materialisation_id, output_path: outputPath });
  }
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(outputDirectory, `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    try { fs.writeFileSync(descriptor, bytes); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    try { fs.linkSync(temporaryPath, outputPath); } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (!fs.readFileSync(outputPath).equals(bytes)) fail('CONTENT_ADDRESS_COLLISION', 'concurrent readiness writer created different bytes.');
      return Object.freeze({ status: 'ALREADY_PRESENT', materialisation_id: materialisation.materialisation_id, output_path: outputPath });
    }
    const directoryDescriptor = fs.openSync(outputDirectory, 'r');
    try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }
    return Object.freeze({ status: 'WRITTEN', materialisation_id: materialisation.materialisation_id, output_path: outputPath });
  } catch (error) {
    if (error instanceof SourceIntakeReadinessWriterError) throw error;
    fail('SOURCE_INTAKE_READINESS_OUTPUT_WRITE_FAILED', `could not atomically write readiness output: ${error.message}`);
  } finally {
    try { fs.unlinkSync(temporaryPath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
}

function tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot } = {}) {
  const first = buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot });
  const second = buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot });
  const third = buildCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot });
  if (canonicalJson(first) !== canonicalJson(second) || canonicalJson(first) !== canonicalJson(third)) {
    fail('SOURCE_INTAKE_READINESS_TRIPLE_REBUILD_MISMATCH', 'readiness receipt did not deterministically triple-rebuild.');
  }
  return writeCurrentSourceIntakeReadinessMaterialisation({ artifact_root: artifactRoot, materialisation: first });
}

module.exports = {
  MATERIALISATION_SCHEMA,
  OUTPUT_DIRECTORY,
  SourceIntakeReadinessWriterError,
  readCurrentCohortReceiptRecords,
  readCurrentPendingIdentityPacket,
  buildCurrentRoutinePolicy,
  buildCurrentTopBuildPacket,
  buildCurrentSourceIntakeReadinessMaterialisation,
  validateCurrentSourceIntakeReadinessMaterialisation,
  writeCurrentSourceIntakeReadinessMaterialisation,
  tripleRebuildAndWriteCurrentSourceIntakeReadinessMaterialisation,
};
