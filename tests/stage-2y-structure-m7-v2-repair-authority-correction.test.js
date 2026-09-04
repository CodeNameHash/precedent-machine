'use strict';

// The correction record beside the candidate replacement authority.
//
// The authority is sealed — its bytes, SHA-256, Git blob OID and record id are
// pinned in the contract, the manifest validator, the independent verifier and
// the Work 7 verifier — so a defect found after Ben approved it cannot be
// fixed by editing it. The correction record is how such a defect is recorded
// and recognised without editing the authority, and these cases pin the one
// property that makes writing it down safe: recognition is unconditional,
// application is not.

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const correctionModule = require('../lib/canonical-v2/m7-v2-authority-correction');

const {
  CORRECTION_PATH,
  CORRECTION_SCHEMA,
  PENDING_INFO_CODE,
  REPLACEMENT_AUTHORITY_PATH,
  acceptsCandidateRegistrationArgvToken,
  correctionInfoLines,
  effectiveAttemptRecordMembers,
  effectiveContractChanges,
  effectivePhaseArgv,
  loadAuthorityCorrection,
} = correctionModule;

const ROOT = path.resolve(__dirname, '..');
const VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const WORK4_CORRECTION_SUCCESSOR_MANIFEST_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json';
const CANDIDATE_REGISTRATION_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/'
  + `${'0'.repeat(64)}.json`;

function readAuthority() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, REPLACEMENT_AUTHORITY_PATH), 'utf8'));
}

function readCorrection() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, CORRECTION_PATH), 'utf8'));
}

function restamp(record) {
  const unsigned = { ...record };
  delete unsigned.correction_id;
  return {
    schema_version: CORRECTION_SCHEMA,
    correction_id: contentId(CORRECTION_SCHEMA, unsigned),
    ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
  };
}

// A tree containing only the two control records the module reads.
function prepareTree(t, correctionRecord, { canonical = true } = {}) {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-authority-correction-')),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const repositoryPath of [REPLACEMENT_AUTHORITY_PATH]) {
    const target = path.join(root, repositoryPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, repositoryPath), target);
  }
  if (correctionRecord !== null) {
    const target = path.join(root, CORRECTION_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, canonical
      ? `${canonicalJson(correctionRecord)}\n`
      : `${JSON.stringify(correctionRecord)}\n`);
  }
  return root;
}

function approved(record) {
  return restamp({
    ...record,
    approval: {
      state: 'BEN_APPROVED',
      ben_approval_id: 'BEN-M7-V2-CANDIDATE-REPLACEMENT-CORRECTION-1-20260904',
      approved_on: '2026-09-04',
    },
  });
}

test('a pending correction is recognised and applies nothing', async (t) => {
  const authority = readAuthority();
  const correction = loadAuthorityCorrection({ repoRoot: ROOT });

  await t.test('the committed record is bound, content-addressed and pending', () => {
    assert.notEqual(correction, null);
    assert.equal(correction.state, 'PENDING_BEN');
    assert.equal(correction.effective, false);
    assert.equal(correction.path, CORRECTION_PATH);
    const record = readCorrection();
    assert.equal(record.schema_version, CORRECTION_SCHEMA);
    assert.equal(record.drafted_by, 'LEAD');
    assert.equal(record.drafted_on, '2026-09-04');
    assert.deepEqual(record.approval, {
      state: 'PENDING_BEN',
      ben_approval_id: null,
      approved_on: null,
    });
    assert.deepEqual(record.parent_authority_binding, authority.parent_authority_binding);
    assert.deepEqual(
      record.replacement_authority_binding,
      correctionModule.REPLACEMENT_AUTHORITY_BINDING,
    );
    assert.deepEqual(
      record.corrections.map((entry) => entry.code),
      ['EXACT_ARGV_REGISTRATION_FLAG', 'ATTEMPT_RECORD_MEMBER_NAMES', 'CONTRACT_CHANGE_ADDED'],
    );
    assert.deepEqual(
      record.corrections[0].phase_keys,
      authority.phases.map((phase) => phase.phase_key),
    );
    assert.deepEqual(record.corrections[1].renames, {
      parser_hit_or_abstain_per_claim: 'parser_hit_or_abstain',
      definition_resolution_rule_ids: 'definition_resolution',
    });
    assert.equal(
      record.corrections[2].contract_change,
      'PROFILE_RESULTS_SCOPED_TO_OCCURRENCE_FAMILY',
    );
    const unsigned = { ...record };
    delete unsigned.correction_id;
    assert.equal(contentId(CORRECTION_SCHEMA, unsigned), record.correction_id);
    assert.deepEqual(
      fs.readFileSync(path.join(ROOT, CORRECTION_PATH)),
      Buffer.from(`${canonicalJson(record)}\n`, 'utf8'),
    );
  });

  await t.test('one INFO line, and every applier is the identity', () => {
    assert.deepEqual(
      correctionInfoLines(correction),
      [`${PENDING_INFO_CODE} ${correction.correction_id}`],
    );
    for (const phase of authority.phases) {
      assert.deepEqual(
        effectivePhaseArgv(phase, correction),
        phase.exact_argv_with_run_limits,
      );
    }
    const members = authority.real_agreement_receipt_guard.attempt_record_members;
    assert.deepEqual(effectiveAttemptRecordMembers(members, correction), members);
    assert.deepEqual(effectiveContractChanges(correction), []);
    assert.equal(
      acceptsCandidateRegistrationArgvToken(CANDIDATE_REGISTRATION_PATH, correction),
      false,
    );
  });

  // A tree with no correction record at all behaves exactly as it did before
  // the record existed: no load, no line, no application.
  await t.test('an absent record is null and reports nothing', (subtest) => {
    const root = prepareTree(subtest, null);
    assert.equal(loadAuthorityCorrection({ repoRoot: root }), null);
    assert.deepEqual(correctionInfoLines(null), []);
    assert.deepEqual(
      effectivePhaseArgv(authority.phases[0], null),
      authority.phases[0].exact_argv_with_run_limits,
    );
    assert.equal(acceptsCandidateRegistrationArgvToken(CANDIDATE_REGISTRATION_PATH, null), false);
  });

  await t.test('the manifest validator reports the pending record and still passes', () => {
    const run = childProcess.spawnSync('node', [
      VALIDATOR_PATH, WORK4_CORRECTION_SUCCESSOR_MANIFEST_PATH,
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(
      run.stderr.includes(`${PENDING_INFO_CODE} ${correction.correction_id}`),
      run.stderr,
    );
    const result = JSON.parse(run.stdout);
    assert.equal(result.status, 'PASS_NARROWING_EXECUTION_MANIFEST');
    assert.equal(result.work, 'WORK4');
    assert.equal(result.candidate_stage_state, 'VERIFIED_CANDIDATE_BOUND');
  });
});

test('an approved correction applies its corrections and stops reporting itself pending', async (t) => {
  const authority = readAuthority();
  const root = prepareTree(t, approved(readCorrection()));
  const correction = loadAuthorityCorrection({ repoRoot: root });

  await t.test('approval with an approval id makes it effective', () => {
    assert.equal(correction.state, 'BEN_APPROVED');
    assert.equal(correction.effective, true);
    assert.deepEqual(correctionInfoLines(correction), []);
    assert.notEqual(correction.correction_id, readCorrection().correction_id);
  });

  await t.test('the run entrypoint argv gains the --registration suffix', () => {
    for (const phase of authority.phases) {
      const entries = effectivePhaseArgv(phase, correction);
      const runEntrypoint = phase.entrypoints.find((entry) => entry.endsWith('-run.mjs'));
      assert.ok(runEntrypoint);
      const before = phase.exact_argv_with_run_limits;
      assert.equal(entries.length, before.length);
      for (let index = 0; index < entries.length; index += 1) {
        const names = before[index].argv.includes(runEntrypoint);
        assert.deepEqual(
          entries[index].argv,
          names
            ? [...before[index].argv, '--registration', '<candidate registration path>']
            : before[index].argv,
        );
        assert.equal(entries[index].max_runs, before[index].max_runs);
      }
    }
    // With a chosen registration the placeholder is substituted, and the
    // validator's per-token roster admits the path it names.
    const entries = effectivePhaseArgv(
      authority.phases[0], correction, CANDIDATE_REGISTRATION_PATH,
    );
    const withFlag = entries.find((entry) => entry.argv.includes('--registration'));
    assert.equal(withFlag.argv[withFlag.argv.length - 1], CANDIDATE_REGISTRATION_PATH);
    assert.equal(
      acceptsCandidateRegistrationArgvToken(CANDIDATE_REGISTRATION_PATH, correction),
      true,
    );
    assert.equal(acceptsCandidateRegistrationArgvToken('evidence/elsewhere.json', correction), false);
  });

  await t.test('the two renamed attempt-record members are accepted', () => {
    const members = authority.real_agreement_receipt_guard.attempt_record_members;
    const effective = effectiveAttemptRecordMembers(members, correction);
    assert.equal(effective.length, members.length);
    assert.ok(effective.includes('parser_hit_or_abstain'));
    assert.ok(effective.includes('definition_resolution'));
    assert.ok(!effective.includes('parser_hit_or_abstain_per_claim'));
    assert.ok(!effective.includes('definition_resolution_rule_ids'));
    for (const member of members) {
      if (member === 'parser_hit_or_abstain_per_claim'
        || member === 'definition_resolution_rule_ids') continue;
      assert.ok(effective.includes(member));
    }
    assert.deepEqual(
      effectiveContractChanges(correction),
      ['PROFILE_RESULTS_SCOPED_TO_OCCURRENCE_FAMILY'],
    );
  });

  // BEN_APPROVED without an approval id is not an approval.
  await t.test('an approval state without an approval id is refused', (subtest) => {
    const record = restamp({
      ...readCorrection(),
      approval: { state: 'BEN_APPROVED', ben_approval_id: null, approved_on: null },
    });
    const unapproved = prepareTree(subtest, record);
    assert.throws(() => loadAuthorityCorrection({ repoRoot: unapproved }), (error) => {
      assert.equal(error.code, 'CORRECTION_CONTRACT_DRIFT');
      return true;
    });
  });
});

test('a correction that is not bound to the authority is refused', async (t) => {
  await t.test('a drifted binding fails AUTHORITY_BINDING_DRIFT', (subtest) => {
    const record = readCorrection();
    const drifted = restamp({
      ...record,
      replacement_authority_binding: {
        ...record.replacement_authority_binding,
        sha256: 'f'.repeat(64),
      },
    });
    const root = prepareTree(subtest, drifted);
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'AUTHORITY_BINDING_DRIFT');
      assert.ok(error.message.includes(REPLACEMENT_AUTHORITY_PATH), error.message);
      return true;
    });
  });

  await t.test('a drifted parent binding fails AUTHORITY_BINDING_DRIFT', (subtest) => {
    const record = readCorrection();
    const drifted = restamp({
      ...record,
      parent_authority_binding: {
        ...record.parent_authority_binding,
        sha256: 'f'.repeat(64),
      },
    });
    const root = prepareTree(subtest, drifted);
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'AUTHORITY_BINDING_DRIFT');
      return true;
    });
  });

  await t.test('an authority whose bytes are not the bound bytes fails', (subtest) => {
    const root = prepareTree(subtest, readCorrection());
    fs.appendFileSync(path.join(root, REPLACEMENT_AUTHORITY_PATH), '\n');
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'AUTHORITY_BINDING_DRIFT');
      return true;
    });
  });

  await t.test('a stale content id fails CORRECTION_IDENTITY_DRIFT', (subtest) => {
    const record = readCorrection();
    const stale = { ...record, drafted_on: '2026-09-05' };
    const root = prepareTree(subtest, stale);
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'CORRECTION_IDENTITY_DRIFT');
      return true;
    });
  });

  await t.test('non-canonical bytes fail CORRECTION_IDENTITY_DRIFT', (subtest) => {
    const root = prepareTree(subtest, readCorrection(), { canonical: false });
    fs.writeFileSync(
      path.join(root, CORRECTION_PATH),
      `${JSON.stringify(readCorrection(), null, 2)}\n`,
    );
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'CORRECTION_IDENTITY_DRIFT');
      return true;
    });
  });

  await t.test('a correction missing one of the three corrections is refused', (subtest) => {
    const record = readCorrection();
    const short = restamp({
      ...record,
      corrections: record.corrections.slice(0, 2),
    });
    const root = prepareTree(subtest, short);
    assert.throws(() => loadAuthorityCorrection({ repoRoot: root }), (error) => {
      assert.equal(error.code, 'CORRECTION_CONTRACT_DRIFT');
      return true;
    });
  });
});
