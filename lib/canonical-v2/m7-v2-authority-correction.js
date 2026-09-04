'use strict';

// Correction record for the M7 V2 repair candidate replacement authority.
//
// The replacement authority is sealed: its bytes, SHA-256, Git blob OID and
// record id are pinned in three scripts and in the contract, so it cannot be
// edited to fix a defect found after Ben approved it. This module is the
// mechanism that lets a defect be *recorded and recognised* without editing
// it, and lets nothing take effect until Ben has approved the record itself.
//
// The record lives beside the authority, is content-addressed on
// `correction_id`, and binds the authority it corrects member for member. Any
// reader of the authority may call `loadAuthorityCorrection`:
//
// - the file is absent            -> `null`; every caller behaves as before.
// - present and PENDING_BEN       -> the record is returned, `effective` is
//                                    false, `correctionInfoLines` yields one
//                                    `CORRECTION_PENDING_BEN <id>` line, and
//                                    every applier below is the identity.
// - present and BEN_APPROVED with
//   a non-null `ben_approval_id`  -> `effective` is true and the appliers
//                                    return the corrected values.
// - present but its binding does
//   not match the authority bytes -> throws `AUTHORITY_BINDING_DRIFT`.
//
// Recognition is therefore unconditional and application is not: a validator
// that loads the record can say so on every run while still applying nothing,
// which is what "recorded but not yet authorised" has to mean if the record is
// to be worth writing down at all.
//
// The three appliers are the three corrections the record carries. Each takes
// the value the authority declares and returns the value that is in force:
//
// - `effectivePhaseArgv(phase, correction)` — the phase's
//   `exact_argv_with_run_limits`, with `['--registration', <path>]` appended
//   to the entry that runs the phase's `*-run.mjs` entrypoint.
// - `acceptsCandidateRegistrationArgvToken(token, correction)` — whether an
//   argv token naming a candidate registration is admissible; the manifest
//   validator's per-token roster check asks this before refusing a token it
//   does not otherwise recognise.
// - `effectiveAttemptRecordMembers(members, correction)` — the real-agreement
//   receipt guard's `attempt_record_members`, with the two renamed members
//   substituted.
//
// The Work 2/3/4 real-text successor scripts do not exist yet; they are the
// intended callers of the first and third. Nothing here reads or writes
// anything but the two records named below, spawns no process and computes no
// SHA-1: the authority's identity is checked by byte length and SHA-256
// against the bytes on disk, and by exact member equality against the pinned
// binding, which is what carries the Git blob OID.
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes.js');

const MIGRATION_CONTROL_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
// The parent authority's `permitted_writes.file_prefix_rules` allow exactly
// two filename prefixes in this control directory, `m7-v2-repair-contract-`
// and `m7-v2-repair-family-`. The record's first name dropped the `contract-`
// segment and so sat at a path no permission mechanism in either authority
// allowed -- not a prefix rule, not `exact_paths`, not
// `creation_only_exact_paths`, not `work1_write_exceptions`, and not inside
// the permitted candidate-registrations directory. Corrected 2026-09-04; the
// authority it corrects has always carried the `contract-` segment itself.
const CORRECTION_PATH =
  `${MIGRATION_CONTROL_ROOT}/m7-v2-repair-contract-candidate-replacement-authority-correction-1.json`;
const CORRECTION_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CANDIDATE_REPLACEMENT_AUTHORITY_CORRECTION/V1';
const REPLACEMENT_AUTHORITY_PATH =
  `${MIGRATION_CONTROL_ROOT}/m7-v2-repair-contract-candidate-replacement-authority.json`;
// The same pinned binding fd6f662d put in the contract, the manifest
// validator, verify-candidate and the Work 7 verifier. A correction whose
// binding differs from this in any member is not bound to this authority.
const REPLACEMENT_AUTHORITY_BINDING = Object.freeze({
  path: REPLACEMENT_AUTHORITY_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CANDIDATE_REPLACEMENT_AUTHORITY/V1',
  record_id_field: 'replacement_authority_id',
  record_id: '93d67c6ea53ed9b429f7467a3c5a52d982352957f3c9a1c3ac3e6350f54eab08',
  byte_length: 23976,
  sha256: '21f864a6473e069987f1c578bd5efaa447a5443225706e9a40bdbc0198468a17',
  git_blob_oid: 'a9970b6e3db301fcfdbcb904681fd3db7297fe77',
});
const CANDIDATE_REGISTRATION_ROOT =
  `${MIGRATION_CONTROL_ROOT}/m7-v2-repair-candidate-registrations`;
const CANDIDATE_REGISTRATION_PATH_PATTERN = new RegExp(
  `^${CANDIDATE_REGISTRATION_ROOT}/[0-9a-f]{64}\\.json$`,
);
// `effective_argv_suffix[1]` on the argv correction is this placeholder, not a
// path: the successor phases have no registration yet, and the interim policy
// mints a new one before every evidence run. The applier substitutes the
// caller's chosen registration path, and the token check admits any path under
// the candidate root.
const REGISTRATION_PATH_PLACEHOLDER = '<candidate registration path>';
const REGISTRATION_ARGV_FLAG = '--registration';
const PENDING_INFO_CODE = 'CORRECTION_PENDING_BEN';
const PENDING_STATE = 'PENDING_BEN';
const APPROVED_STATE = 'BEN_APPROVED';
const RUN_ENTRYPOINT_SUFFIX = '-run.mjs';

const RECORD_KEYS = Object.freeze([
  'approval',
  'correction_id',
  'corrections',
  'drafted_by',
  'drafted_on',
  'parent_authority_binding',
  'replacement_authority_binding',
  'schema_version',
]);
const APPROVAL_KEYS = Object.freeze([
  'approved_on', 'approver', 'ben_approval_id', 'state',
]);
// The authority this record corrects names its approver and pattern-checks its
// own approval id; a record that amends it may not be weaker than it is.
const APPROVER = 'BEN_GOODCHILD';
const BEN_APPROVAL_ID = /^BEN-[A-Z0-9-]{8,}$/;
const BINDING_KEYS = Object.freeze([
  'byte_length', 'git_blob_oid', 'path', 'record_id', 'record_id_field',
  'schema_version', 'sha256',
]);
const ARGV_CORRECTION_KEYS = Object.freeze([
  'change', 'code', 'effective_argv_suffix', 'phase_keys',
]);
const RENAME_CORRECTION_KEYS = Object.freeze(['code', 'renames']);
const CONTRACT_CHANGE_CORRECTION_KEYS = Object.freeze([
  'ben_ruling', 'code', 'contract_change', 'discarded_per_effect',
  'evaluation', 'preserved_explicitly', 'rationale', 'retained_per_effect',
  'size_basis',
]);
// The one contract change this record carries. Its first draft named an
// outcome in a single string, `PROFILE_RESULTS_SCOPED_TO_OCCURRENCE_FAMILY`,
// which reads two ways: evaluate all 25 families and store one family's
// entries, or evaluate one family only. The second makes
// `compatible_cross_family_match_count` a structural zero, so the NO_OUTPUT
// gate that requires it to be zero can never refuse, `FAMILY_CORRECTION_
// PENDING` can never be raised from profile evidence, and V2's family becomes
// V1's M4 family by assumption rather than by matching. Ben ruled on
// 2026-09-04 to keep the misfiling check, so the change is spelled out in
// members that cannot be read the second way.
const EVALUATION_UNCHANGED = 'ALL_25_FAMILIES_UNCHANGED';
const ARGV_CORRECTION_CODE = 'EXACT_ARGV_REGISTRATION_FLAG';
const RENAME_CORRECTION_CODE = 'ATTEMPT_RECORD_MEMBER_NAMES';
const CONTRACT_CHANGE_CORRECTION_CODE = 'CONTRACT_CHANGE_ADDED';
// Every code this schema can express, in canonical order. A record carries a
// SUBSET of these, not all of them: the roster was a fixed three, which forced
// a record to carry corrections that were not ready. The argv correction is
// held until its applier is reachable from the site that decides a successor
// manifest's argv, and the rename correction until Q-0025 settles the field
// names it would rename the authority to match.
const CORRECTION_CODES = Object.freeze([
  ARGV_CORRECTION_CODE, RENAME_CORRECTION_CODE, CONTRACT_CHANGE_CORRECTION_CODE,
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_256 = /^[0-9a-f]{64}$/;

class AuthorityCorrectionError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AuthorityCorrectionError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new AuthorityCorrectionError(code, detail);
}

function assert(condition, code, detail = '') {
  if (!condition) fail(code, detail);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Repository-relative, no traversal, no symlink, regular file. A path this
// module reads is one of two literals, so this only has to refuse a root that
// redirects them.
function readRepositoryFile(repoRoot, repositoryPath) {
  assert(typeof repoRoot === 'string' && repoRoot.length > 0,
    'INVALID_OPTIONS', 'repoRoot');
  const absolute = path.resolve(repoRoot, ...repositoryPath.split('/'));
  const prefix = `${path.resolve(repoRoot)}${path.sep}`;
  assert(absolute.startsWith(prefix), 'PATH_SAFETY', repositoryPath);
  let stat;
  try {
    stat = fs.lstatSync(absolute);
  } catch {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
  return fs.readFileSync(absolute);
}

function parseJson(bytes, code, detail) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return fail(code, detail);
  }
}

function validateApproval(approval) {
  assert(exactKeys(approval, APPROVAL_KEYS),
    'CORRECTION_CONTRACT_DRIFT', 'approval');
  assert(approval.approver === APPROVER,
    'CORRECTION_CONTRACT_DRIFT', 'approval names an approver other than Ben');
  if (approval.state === PENDING_STATE) {
    assert(approval.ben_approval_id === null && approval.approved_on === null,
      'CORRECTION_CONTRACT_DRIFT', 'pending approval carries an approval id');
    return false;
  }
  assert(approval.state === APPROVED_STATE, 'CORRECTION_CONTRACT_DRIFT', 'approval state');
  assert(typeof approval.ben_approval_id === 'string'
    && BEN_APPROVAL_ID.test(approval.ben_approval_id)
    && typeof approval.approved_on === 'string'
    && DATE.test(approval.approved_on),
  'CORRECTION_CONTRACT_DRIFT', 'approved correction without an approval id and date');
  return true;
}

// A record carries at least one correction, each code at most once, in the
// canonical order of CORRECTION_CODES. Each present correction is validated
// against its own key set; an absent one is simply not carried.
function validateCorrections(corrections) {
  assert(Array.isArray(corrections) && corrections.length > 0,
    'CORRECTION_CONTRACT_DRIFT', 'corrections roster is empty');
  const codes = corrections.map((entry) => entry?.code);
  assert(codes.every((code) => CORRECTION_CODES.includes(code))
    && new Set(codes).size === codes.length
    && same(codes, CORRECTION_CODES.filter((code) => codes.includes(code))),
  'CORRECTION_CONTRACT_DRIFT', 'corrections roster');
  const byCode = new Map(corrections.map((entry) => [entry.code, entry]));
  const argvCorrection = byCode.get(ARGV_CORRECTION_CODE);
  const renameCorrection = byCode.get(RENAME_CORRECTION_CODE);
  const contractCorrection = byCode.get(CONTRACT_CHANGE_CORRECTION_CODE);
  if (argvCorrection !== undefined) validateArgvCorrection(argvCorrection);
  if (renameCorrection !== undefined) validateRenameCorrection(renameCorrection);
  if (contractCorrection !== undefined) validateContractCorrection(contractCorrection);
}

function validateArgvCorrection(argvCorrection) {
  assert(exactKeys(argvCorrection, ARGV_CORRECTION_KEYS)
    && Array.isArray(argvCorrection.phase_keys)
    && argvCorrection.phase_keys.length > 0
    && argvCorrection.phase_keys.every((key) => typeof key === 'string' && key.length > 0)
    && new Set(argvCorrection.phase_keys).size === argvCorrection.phase_keys.length
    && typeof argvCorrection.change === 'string' && argvCorrection.change.length > 0
    && Array.isArray(argvCorrection.effective_argv_suffix)
    && argvCorrection.effective_argv_suffix.length === 2
    && argvCorrection.effective_argv_suffix[0] === REGISTRATION_ARGV_FLAG
    && argvCorrection.effective_argv_suffix[1] === REGISTRATION_PATH_PLACEHOLDER,
  'CORRECTION_CONTRACT_DRIFT', ARGV_CORRECTION_CODE);
}

function validateRenameCorrection(renameCorrection) {
  assert(exactKeys(renameCorrection, RENAME_CORRECTION_KEYS)
    && isPlainObject(renameCorrection.renames)
    && Object.keys(renameCorrection.renames).length > 0
    && Object.entries(renameCorrection.renames).every(([from, to]) =>
      typeof from === 'string' && from.length > 0
      && typeof to === 'string' && to.length > 0 && to !== from),
  'CORRECTION_CONTRACT_DRIFT', RENAME_CORRECTION_CODE);
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0
    && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

function validateContractCorrection(contractCorrection) {
  assert(exactKeys(contractCorrection, CONTRACT_CHANGE_CORRECTION_KEYS)
    && typeof contractCorrection.contract_change === 'string'
    && contractCorrection.contract_change.length > 0
    && typeof contractCorrection.rationale === 'string'
    && contractCorrection.rationale.length > 0,
  'CORRECTION_CONTRACT_DRIFT', CONTRACT_CHANGE_CORRECTION_CODE);
  // The members that stop this being readable as evaluate-one-family-only.
  assert(contractCorrection.evaluation === EVALUATION_UNCHANGED,
    'CORRECTION_CONTRACT_DRIFT', 'contract change does not keep all 25 families evaluated');
  assert(nonEmptyStrings(contractCorrection.retained_per_effect)
    && nonEmptyStrings(contractCorrection.discarded_per_effect)
    && nonEmptyStrings(contractCorrection.preserved_explicitly),
  'CORRECTION_CONTRACT_DRIFT', 'contract change does not say what it keeps, drops and preserves');
  assert(isPlainObject(contractCorrection.size_basis)
    && typeof contractCorrection.size_basis.measured === 'string'
    && contractCorrection.size_basis.measured.length > 0
    && typeof contractCorrection.size_basis.target === 'string'
    && contractCorrection.size_basis.target.length > 0,
  'CORRECTION_CONTRACT_DRIFT', 'contract change does not separate measured from target');
  assert(typeof contractCorrection.ben_ruling === 'string'
    && contractCorrection.ben_ruling.length > 0,
  'CORRECTION_CONTRACT_DRIFT', 'contract change carries no ruling');
}

// The binding is checked twice over: member for member against the pinned
// binding, and byte length plus SHA-256 against the authority actually in the
// tree. Either check failing is AUTHORITY_BINDING_DRIFT — a correction that
// names other bytes is not a correction to this authority.
function validateAuthorityBinding(repoRoot, record) {
  const binding = record.replacement_authority_binding;
  assert(exactKeys(binding, BINDING_KEYS),
    'AUTHORITY_BINDING_DRIFT', 'replacement_authority_binding');
  assert(same(binding, REPLACEMENT_AUTHORITY_BINDING),
    'AUTHORITY_BINDING_DRIFT', REPLACEMENT_AUTHORITY_PATH);
  const bytes = readRepositoryFile(repoRoot, REPLACEMENT_AUTHORITY_PATH);
  assert(bytes !== null, 'AUTHORITY_BINDING_DRIFT', REPLACEMENT_AUTHORITY_PATH);
  assert(bytes.length === binding.byte_length && sha256Hex(bytes) === binding.sha256,
    'AUTHORITY_BINDING_DRIFT', REPLACEMENT_AUTHORITY_PATH);
  const authority = parseJson(bytes, 'AUTHORITY_BINDING_DRIFT', REPLACEMENT_AUTHORITY_PATH);
  assert(authority?.schema_version === binding.schema_version
    && authority[binding.record_id_field] === binding.record_id,
  'AUTHORITY_BINDING_DRIFT', REPLACEMENT_AUTHORITY_PATH);
  assert(same(record.parent_authority_binding, authority.parent_authority_binding),
    'AUTHORITY_BINDING_DRIFT', 'parent_authority_binding');
  return authority;
}

/**
 * Loads the correction record beside the replacement authority.
 *
 * Returns `null` when the file is absent. Otherwise returns the validated
 * record with its own identity and its binding to the authority proved, and
 * `effective` set only for a BEN_APPROVED record carrying an approval id.
 */
function loadAuthorityCorrection({ repoRoot } = {}) {
  const bytes = readRepositoryFile(repoRoot, CORRECTION_PATH);
  if (bytes === null) return null;
  const record = parseJson(bytes, 'CORRECTION_IDENTITY_DRIFT', CORRECTION_PATH);
  assert(exactKeys(record, RECORD_KEYS)
    && record.schema_version === CORRECTION_SCHEMA
    && typeof record.correction_id === 'string'
    && HEX_256.test(record.correction_id),
  'CORRECTION_CONTRACT_DRIFT', CORRECTION_PATH);
  assert(bytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8')),
    'CORRECTION_IDENTITY_DRIFT', 'canonical bytes');
  // The identity covers what Ben reads and not the approval block, so the id
  // is the SAME before and after approval. It covered the approval block
  // first, which meant approving rewrote the id and "Ben approved <id>" could
  // never be checked against the record that ends up effective.
  const unsigned = { ...record };
  delete unsigned.correction_id;
  delete unsigned.approval;
  assert(contentId(CORRECTION_SCHEMA, unsigned) === record.correction_id,
    'CORRECTION_IDENTITY_DRIFT', CORRECTION_PATH);
  assert(record.drafted_by === 'LEAD'
    && typeof record.drafted_on === 'string' && DATE.test(record.drafted_on),
  'CORRECTION_CONTRACT_DRIFT', 'drafting');
  const authority = validateAuthorityBinding(repoRoot, record);
  validateCorrections(record.corrections);
  const effective = validateApproval(record.approval);
  return Object.freeze({
    path: CORRECTION_PATH,
    correction_id: record.correction_id,
    record,
    bytes,
    authority,
    effective,
    state: record.approval.state,
  });
}

/**
 * The INFO lines a caller should report for this correction. One line while it
 * is pending; none once it is approved, because an approved correction shows
 * up in what the appliers return instead.
 */
function correctionInfoLines(correction) {
  if (correction === null || correction === undefined) return [];
  if (correction.effective) return [];
  return [`${PENDING_INFO_CODE} ${correction.correction_id}`];
}

function correctionEntry(correction, code) {
  if (correction === null || correction === undefined || !correction.effective) return null;
  return correction.record.corrections.find((entry) => entry.code === code) ?? null;
}

/**
 * The `exact_argv_with_run_limits` in force for one replacement-authority
 * phase. Unchanged unless the correction is effective and names this phase, in
 * which case the entry that runs the phase's own `*-run.mjs` entrypoint gains
 * the `--registration <path>` suffix.
 */
function effectivePhaseArgv(phase, correction, registrationPath = null) {
  assert(isPlainObject(phase) && Array.isArray(phase.exact_argv_with_run_limits),
    'INVALID_OPTIONS', 'phase');
  const entries = clone(phase.exact_argv_with_run_limits);
  const entry = correctionEntry(correction, ARGV_CORRECTION_CODE);
  if (entry === null || !entry.phase_keys.includes(phase.phase_key)) return entries;
  const runEntrypoints = new Set((phase.entrypoints ?? []).filter(
    (entrypoint) => entrypoint.endsWith(RUN_ENTRYPOINT_SUFFIX),
  ));
  const suffix = entry.effective_argv_suffix.map((token) =>
    (token === REGISTRATION_PATH_PLACEHOLDER && registrationPath !== null
      ? registrationPath : token));
  return entries.map((candidate) =>
    (candidate.argv.some((token) => runEntrypoints.has(token))
      ? { ...candidate, argv: [...candidate.argv, ...suffix] }
      : candidate));
}

/**
 * Whether an argv token naming a candidate registration is admissible. False
 * for every token while the correction is pending or absent, which is what
 * keeps the authority's committed argv rosters closed.
 */
function acceptsCandidateRegistrationArgvToken(token, correction) {
  if (correctionEntry(correction, ARGV_CORRECTION_CODE) === null) return false;
  return typeof token === 'string' && CANDIDATE_REGISTRATION_PATH_PATTERN.test(token);
}

/**
 * The attempt-record member names in force. Unchanged unless the correction is
 * effective, in which case the two renamed members are substituted in place.
 */
function effectiveAttemptRecordMembers(members, correction) {
  assert(Array.isArray(members), 'INVALID_OPTIONS', 'members');
  const entry = correctionEntry(correction, RENAME_CORRECTION_CODE);
  if (entry === null) return [...members];
  return members.map((member) => entry.renames[member] ?? member);
}

/**
 * The contract changes the correction adds to the authority's own
 * `contract_changes_authorised`. Empty while the correction is pending.
 */
function effectiveContractChanges(correction) {
  const entry = correctionEntry(correction, CONTRACT_CHANGE_CORRECTION_CODE);
  return entry === null ? [] : [entry.contract_change];
}

module.exports = {
  APPROVED_STATE,
  AuthorityCorrectionError,
  CANDIDATE_REGISTRATION_PATH_PATTERN,
  CORRECTION_PATH,
  CORRECTION_SCHEMA,
  PENDING_INFO_CODE,
  PENDING_STATE,
  REGISTRATION_ARGV_FLAG,
  REGISTRATION_PATH_PLACEHOLDER,
  REPLACEMENT_AUTHORITY_BINDING,
  REPLACEMENT_AUTHORITY_PATH,
  acceptsCandidateRegistrationArgvToken,
  correctionInfoLines,
  effectiveAttemptRecordMembers,
  effectiveContractChanges,
  effectivePhaseArgv,
  loadAuthorityCorrection,
};
