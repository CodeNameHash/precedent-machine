const { contentId } = require('../canonical-v2/canonical-bytes');

const COMMIT_RE = /^[a-f0-9]{40}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const ACK_SCHEMA = 'M1_CONTRACT_FREEZE_ACKNOWLEDGEMENT/V1';
const PERMISSION_SCHEMA = 'M1_VERTICAL_SLICE_EXECUTION_PERMISSION/V1';
const FIELD_ORDER = Object.freeze([
  'schema_version',
  'milestone_id',
  'reviewed_commit_range',
  'reviewed_commit',
  'date',
  'reviewer',
  'findings',
  'dispositions',
  'result',
  'bundle_id',
  'contract_bundle_digest',
  'canonical_payload_digest',
  'substantive_member_count',
  'dependency_edge_count',
  'ben_approval_reference',
  'ben_approval_result',
  'authority',
]);

class M1MilestonePermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'M1MilestonePermissionError';
    this.code = 'M1_VERTICAL_SLICE_EXECUTION_NOT_AUTHORISED';
  }
}

function fail(message) {
  throw new M1MilestonePermissionError(message);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    fail(`${label} fields do not match the closed M1 contract.`);
  }
}

function parseM1Acknowledgement(markdown) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown, 'utf8') > 16_384) {
    fail('M1 acknowledgement must be bounded UTF-8 Markdown.');
  }
  const matches = [...markdown.matchAll(/^- ([a-z_]+): `([^`\r\n]+)`$/gm)];
  const keys = matches.map((match) => match[1]);
  if (JSON.stringify(keys) !== JSON.stringify(FIELD_ORDER)) {
    fail('M1 acknowledgement fields or order do not match the closed format.');
  }
  return Object.freeze(Object.fromEntries(
    matches.map((match) => [match[1], match[2]]),
  ));
}

function requireM1VerticalSliceExecutionPermission({
  acknowledgement_markdown,
  current_bundle,
}) {
  requireExactKeys(current_bundle, [
    'bundle_id',
    'contract_bundle_digest',
    'canonical_payload_digest',
    'substantive_member_count',
    'dependency_edge_count',
    'compile_status',
    'cycle_status',
  ], 'Current bundle');
  const acknowledgement = parseM1Acknowledgement(acknowledgement_markdown);
  const [rangeStart, rangeEnd] = acknowledgement.reviewed_commit_range.split('..');
  if (
    acknowledgement.schema_version !== ACK_SCHEMA
    || acknowledgement.milestone_id !== 'M1_CONTRACT_FREEZE'
    || !COMMIT_RE.test(rangeStart || '')
    || !COMMIT_RE.test(rangeEnd || '')
    || acknowledgement.reviewed_commit !== rangeEnd
    || acknowledgement.reviewer
      !== 'INDEPENDENT_HIGH_REASONING_STAGE4_REVIEW_SET'
    || acknowledgement.findings !== 'NONE_BLOCKING'
    || acknowledgement.dispositions !== 'ALL_FINDINGS_CLOSED_OR_M2_DEFERRED'
    || acknowledgement.result !== 'PASS'
    || acknowledgement.ben_approval_result !== 'APPROVED'
    || acknowledgement.authority !== 'ISOLATED_STAGING_VERTICAL_SLICE_ONLY'
    || !DIGEST_RE.test(acknowledgement.bundle_id)
    || !DIGEST_RE.test(acknowledgement.contract_bundle_digest)
    || !DIGEST_RE.test(acknowledgement.canonical_payload_digest)
    || acknowledgement.bundle_id !== current_bundle.bundle_id
    || acknowledgement.contract_bundle_digest
      !== current_bundle.contract_bundle_digest
    || acknowledgement.canonical_payload_digest
      !== current_bundle.canonical_payload_digest
    || Number(acknowledgement.substantive_member_count)
      !== current_bundle.substantive_member_count
    || Number(acknowledgement.dependency_edge_count)
      !== current_bundle.dependency_edge_count
    || current_bundle.compile_status !== 'PASS'
    || current_bundle.cycle_status !== 'PASS'
  ) {
    fail('M1 acknowledgement does not bind the exact complete bundle and approval.');
  }
  const acknowledgementPayload = {
    ...acknowledgement,
    substantive_member_count: Number(acknowledgement.substantive_member_count),
    dependency_edge_count: Number(acknowledgement.dependency_edge_count),
  };
  return Object.freeze({
    schema_version: PERMISSION_SCHEMA,
    m1_acknowledgement_id: contentId(ACK_SCHEMA, acknowledgementPayload),
    reviewed_commit: acknowledgement.reviewed_commit,
    bundle_id: acknowledgement.bundle_id,
    contract_bundle_digest: acknowledgement.contract_bundle_digest,
    canonical_payload_digest: acknowledgement.canonical_payload_digest,
    ben_approval_reference: acknowledgement.ben_approval_reference,
    vertical_slice_execution: 'PASS',
    authority_source: 'M1_ACKNOWLEDGEMENT_AND_EXACT_BUNDLE_APPROVAL',
    production_authority: 'NONE',
  });
}

module.exports = {
  ACK_SCHEMA,
  FIELD_ORDER,
  M1MilestonePermissionError,
  PERMISSION_SCHEMA,
  parseM1Acknowledgement,
  requireM1VerticalSliceExecutionPermission,
};
