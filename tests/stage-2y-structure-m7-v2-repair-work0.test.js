'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const BASE_COMMIT = 'b78a2b8c1f25b78f35116d2620c491b69215d0b6';
const CONTROL_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const RECEIPT_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/receipts';
const MANIFEST_PATH = `${CONTROL_ROOT}/m7-v2-repair-pre-work0-evidence-input-manifest.json`;
const AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-work0-bootstrap-authority.json`;
const REVIEW_PACKET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-review-packet.json';
const RECEIPT_PATH = `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work0.test.js';
const WORK1_7_AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-work1-7-authority.json`;
const WORK1_CORRECTION_AUTHORITY_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-contract-work1-correction-authority.json`;
const LATER_AUTHORITY_PATHS = [
  WORK1_CORRECTION_AUTHORITY_PATH,
  WORK1_7_AUTHORITY_PATH,
];

const RECORD_SPECS = [
  {
    key: 'fixed_sample_identity_manifest',
    path: `${CONTROL_ROOT}/m7-v2-repair-fixed-sample-identity-manifest.json`,
    idField: 'fixed_sample_identity_manifest_id',
  },
  {
    key: 'repair_baseline_ledger',
    path: `${CONTROL_ROOT}/m7-v2-repair-baseline-ledger.json`,
    idField: 'repair_baseline_ledger_id',
  },
  {
    key: 'calibration_question_ruling_map',
    path: `${CONTROL_ROOT}/m7-v2-repair-calibration-question-ruling-map.json`,
    idField: 'calibration_question_ruling_map_id',
  },
  {
    key: 'legacy_output_supersession_ledger',
    path: `${CONTROL_ROOT}/m7-v2-repair-legacy-output-supersession-ledger.json`,
    idField: 'legacy_output_supersession_ledger_id',
  },
];

const EXPECTED_FINALISER_COUNTS = {
  input_bindings: 73,
  sample_items: 50,
  repair_items: 38,
  control_items: 12,
  calibration_families: 25,
  calibration_questions: 75,
  legacy_analyses: 7,
  legacy_projections: 7,
  legacy_rows: 1111,
  legacy_support_ledgers: 8,
};

const EXPECTED_RECEIPT_COUNTS = {
  direct_input_binding_count: 73,
  fixed_sample_member_count: 50,
  repair_item_count: 38,
  control_item_count: 12,
  calibration_family_count: 25,
  calibration_question_count: 75,
  programme_ruling_count: 3,
  legacy_analysis_registration_count: 7,
  legacy_projection_registration_count: 7,
  legacy_support_binding_count: 8,
  legacy_row_registration_count: 1111,
  snapshot_binding_count: 11,
};

const REPAIR_ORDINALS = [
  1, 2, 4, 6, 7, 8, 9, 10, 13, 14, 15, 18, 19, 20, 22, 23, 24, 25, 27,
  28, 31, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50,
];
const CONTROL_ORDINALS = [3, 5, 11, 12, 16, 17, 21, 26, 29, 30, 32, 37];
const FRESH_QUESTION_ORDINALS = [2, 4, 45];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function clone(value) {
  return structuredClone(value);
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function countBy(values, keyOf) {
  const counts = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sortedNumbers(values) {
  return [...values].sort((left, right) => left - right);
}

function snapshot(paths) {
  return Object.fromEntries(paths.map((relativePath) => {
    const filePath = absolute(relativePath);
    if (!fs.existsSync(filePath)) return [relativePath, null];
    return [relativePath, sha256Hex(fs.readFileSync(filePath))];
  }));
}

function gitBlobOid(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(bytes).digest('hex');
}

function assertBindingMatchesFile(binding) {
  const bytes = fs.readFileSync(absolute(binding.path));
  assert.equal(binding.byte_length, bytes.length, `${binding.path} byte length`);
  assert.equal(binding.sha256, sha256Hex(bytes), `${binding.path} SHA-256`);
  assert.equal(binding.git_blob_oid, gitBlobOid(bytes), `${binding.path} Git blob OID`);
}

function assertBindingMatchesPinnedBlob(binding) {
  const bytes = execFileSync('git', ['cat-file', 'blob', binding.git_blob_oid], {
    cwd: ROOT,
    encoding: null,
  });
  assert.equal(binding.byte_length, bytes.length, `${binding.path} pinned byte length`);
  assert.equal(binding.sha256, sha256Hex(bytes), `${binding.path} pinned SHA-256`);
  assert.equal(binding.git_blob_oid, gitBlobOid(bytes), `${binding.path} pinned Git blob OID`);
}

function assertErrorCode(action, ErrorClass, code, label, messagePattern = null) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ErrorClass, `${label}: public error class`);
    assert.equal(error.code, code, `${label}: stable error code`);
    if (messagePattern) assert.match(error.message, messagePattern, `${label}: failure detail`);
    return true;
  }, label);
}

function literalModuleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

test('M7 V2 repair Work 0 freezes evidence without running semantic code', async (t) => {
  const manifest = readJson(MANIFEST_PATH);
  const authority = readJson(AUTHORITY_PATH);
  const governedPaths = authority.permitted_commit_paths;
  const bytesBefore = snapshot(governedPaths);

  for (const spec of RECORD_SPECS) {
    assert.ok(
      fs.existsSync(absolute(spec.path)),
      `Work 0 finaliser must create ${spec.path} before this test`,
    );
  }

  const finaliser = await import('../scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs');
  const validator = await import('../scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs');

  try {
    await t.test('the frozen authority admits only Work 0 evidence mechanics', () => {
      assert.equal(authority.base_commit, BASE_COMMIT);
      assert.equal(manifest.adopted_plan_commit, BASE_COMMIT);
      assert.equal(manifest.constraints.direct_binding_count, 73);
      assert.equal(manifest.constraints.transitive_admission, 'NONE');
      assert.equal(manifest.constraints.v1_semantic_admission, 'FORBIDDEN');
      assert.equal(manifest.constraints.work0_only, true);
      assert.equal(manifest.constraints.work1_7_authorised, false);
      assert.equal(manifest.constraints.m8_authorised, false);

      assert.deepEqual(
        manifest.input_bindings.map((binding) => binding.ordinal),
        Array.from({ length: 73 }, (_, index) => index + 1),
      );
      assert.ok(manifest.input_bindings.every((binding) => binding.v2_admissible === false));
      assert.deepEqual(countBy(manifest.input_bindings, (binding) => binding.purpose), {
        WORK0_FAILURE_EVIDENCE: 6,
        PROVENANCE_ONLY: 10,
        WORK0_QUESTION_IDENTITY_ONLY: 26,
        WORK0_SOURCE_IDENTITY: 9,
        FAILURE_REGISTRATION_ONLY: 22,
      });
      assert.ok(manifest.input_bindings.every((binding) => !/ROLE_SCHEMA|EXECUTION_AUTHORITY/.test(binding.role)));

      assert.equal(authority.pre_work0_candidate_paths.length, 2);
      assert.equal(authority.permitted_changed_paths.length, 10);
      assert.equal(authority.permitted_commit_paths.length, 12);
      assert.equal(new Set(authority.permitted_commit_paths).size, 12);
      assert.deepEqual(
        authority.permitted_commit_paths,
        [...authority.pre_work0_candidate_paths, ...authority.permitted_changed_paths],
      );
      assert.equal(
        authority.pre_work0_candidate_paths.some((entry) => authority.permitted_changed_paths.includes(entry)),
        false,
      );

      const gitAdd = authority.permitted_commands.find((command) => (
        command[0] === 'git' && command[1] === 'add'
      ));
      assert.ok(gitAdd, 'exact staged add command');
      assert.deepEqual(gitAdd.slice(gitAdd.indexOf('--') + 1), authority.permitted_commit_paths);
      assert.ok(!authority.permitted_commands.some((command) => command.includes('push')));
      assert.equal(authority.repository_actions.push_to_remote_branch, 'NOT_AUTHORISED_WORK0');
      assert.equal(authority.command_run_limits.repository_pushes, 0);
      assert.equal(authority.command_run_limits.work1_7_commands, 0);
      assert.equal(authority.command_run_limits.m8_commands, 0);
      assert.equal(authority.command_run_limits.m5_m6_m7_runners, 0);
      assert.equal(authority.command_run_limits.model_commands, 0);
      assert.equal(authority.next_authority_requirement.currently_authorised, false);
      assert.equal(authority.next_authority_requirement.state, 'REQUIRED_BEFORE_WORK1');
      assert.ok(authority.permitted_commit_paths.every((entry) => !/work(?:1|1-7)|m8/i.test(entry)));
      assert.ok(authority.permitted_commit_paths.every((entry) => !/stage-2y-structure-m[0-4]/i.test(entry)));
      assert.deepEqual(
        fs.readdirSync(absolute(CONTROL_ROOT))
          .filter((entry) => /m7-v2-repair.*work(?:1|1-7).*authority/i.test(entry))
          .map((entry) => `${CONTROL_ROOT}/${entry}`)
          .sort(),
        [...LATER_AUTHORITY_PATHS].sort(),
      );
      assert.ok(authority.prohibitions.includes('NO_M0_M4_BYTE_CHANGES'));
      assert.ok(authority.prohibitions.includes('NO_V1_SEMANTIC_ADMISSION'));
      assert.ok(authority.prohibitions.includes('NO_WORK1_7'));
      assert.ok(authority.prohibitions.includes('NO_M8'));
      assert.ok(authority.prohibitions.includes('NO_NETWORK_WRITES_OR_PUSH'));

      assert.deepEqual(authority.zero_effect_expectations, {
        baseline_changes: 0,
        database_writes: 0,
        m0_m4_mutations: 0,
        m8_actions: 0,
        model_calls: 0,
        network_writes: 0,
        pin_changes: 0,
        product_writes: 0,
        publication_changes: 0,
        repository_pushes: 0,
        selector_changes: 0,
        serving_changes: 0,
        unbound_network_reads: 0,
        v2_analysis_runs: 0,
        v2_projection_runs: 0,
      });
      assert.deepEqual(Object.keys(authority.intended_evidence_root).sort(), ['path', 'schema_version']);
      assert.equal(authority.intended_evidence_root.path, RECEIPT_PATH);
    });

    const first = await finaliser.finaliseWork0({ repoRoot: ROOT, write: false });
    const second = await finaliser.finaliseWork0({ repoRoot: ROOT, write: false });

    await t.test('the finaliser reproduces four canonical records byte for byte', () => {
      assert.deepEqual(first, second);
      assert.deepEqual(Object.keys(first.records), RECORD_SPECS.map((spec) => spec.key));
      assert.deepEqual(Object.keys(first.bindings).sort(), [
        'activation_confirmation',
        'bootstrap_authority',
        'outputs',
        'pre_work0_manifest',
      ]);
      assert.deepEqual(first.counts, EXPECTED_FINALISER_COUNTS);

      for (const spec of RECORD_SPECS) {
        const record = first.records[spec.key];
        const bytes = fs.readFileSync(absolute(spec.path));
        assert.deepEqual(JSON.parse(bytes), record, `${spec.key} written record`);
        assert.equal(bytes.toString('utf8'), `${canonicalJson(record)}\n`, `${spec.key} canonical bytes`);
        assert.equal(
          record[spec.idField],
          contentId(record.schema_version, without(record, spec.idField)),
          `${spec.key} self ID`,
        );
        assert.equal(
          validator.validateCanonicalRecord({
            record,
            bytes,
            schemaVersion: record.schema_version,
            idField: spec.idField,
          }),
          true,
        );
      }
    });

    await t.test('the fixed sample preserves all 50 identities and detects source drift', () => {
      const fixed = first.records.fixed_sample_identity_manifest;
      assert.equal(fixed.state, 'FROZEN_RESAMPLE_REQUIRES_NEW_AUTHORITY');
      assert.equal(fixed.counts.total_items, 50);
      assert.equal(fixed.counts.unique_agreement_count, 9);
      assert.equal(fixed.members.length, 50);
      assert.deepEqual(fixed.members.map((member) => member.sample_ordinal), Array.from({ length: 50 }, (_, index) => index + 1));
      assert.equal(new Set(fixed.members.map((member) => member.review_item_id)).size, 50);
      assert.deepEqual(countBy(fixed.members, (member) => member.item_kind), {
        SOURCE_TO_ROW: 36,
        REVIEW_ONLY_NO_NORMAL_ROW: 13,
        PARSER_AMBIGUITY: 1,
      });
      assert.deepEqual(countBy(fixed.members, (member) => member.source_kind), {
        SEALED_SEVEN: 34,
        ADDITIVE_THREE: 16,
      });
      assert.equal(fixed.members.filter((member) => member.prior_row_id !== null).length, 36);
      assert.equal(
        new Set(fixed.members.flatMap((member) => member.source_node_occurrence_ids)).size,
        49,
      );

      const ambiguity = fixed.members.find((member) => member.sample_ordinal === 39);
      assert.equal(ambiguity.ambiguity_id, '21f1bca531ca44030c615da1e88a933704ee74402a35f5aa36982fb1bbb21e00');
      assert.equal(ambiguity.source_excerpt_sha256, '75beb6bb93b368073110d0a8f28dd4d038ba357281a509618b70567dd527cfb7');
      assert.ok(ambiguity.source_spans.some((span) => (
        span.start_byte === 229260
        && span.end_byte === 229525
        && span.text_sha256 === '75beb6bb93b368073110d0a8f28dd4d038ba357281a509618b70567dd527cfb7'
      )));

      const sourceIndexes = new Map();
      for (const member of fixed.members) {
        if (!sourceIndexes.has(member.agreement_id)) {
          sourceIndexes.set(member.agreement_id, {
            value: readJson(member.agreement_index_binding.path),
            binding: member.agreement_index_binding,
          });
        }
      }
      const reviewPacket = readJson(REVIEW_PACKET_PATH);
      assert.equal(
        validator.validateFixedSampleIdentity({ record: fixed, reviewPacket, sourceIndexes }),
        true,
      );

      const wrongOrdinal = clone(fixed);
      wrongOrdinal.members[0].sample_ordinal = 50;
      assertErrorCode(
        () => validator.validateFixedSampleIdentity({ record: wrongOrdinal, reviewPacket, sourceIndexes }),
        validator.Work0ValidationError,
        'SAMPLE_IDENTITY_DRIFT',
        'sample ordinal drift',
      );

      const wrongSource = clone(fixed);
      const sourceMember = wrongSource.members.find((member) => member.source_spans.length > 0);
      sourceMember.source_spans[0].text_sha256 = '0'.repeat(64);
      assertErrorCode(
        () => validator.validateFixedSampleIdentity({ record: wrongSource, reviewPacket, sourceIndexes }),
        validator.Work0ValidationError,
        'SAMPLE_IDENTITY_DRIFT',
        'sample source identity drift',
      );
    });

    await t.test('the repair baseline fixes membership independently of the 19/31 decisions', () => {
      const baseline = first.records.repair_baseline_ledger;
      assert.equal(baseline.state, 'FAILED_HUMAN_REVIEW_REPAIR_BASELINE_FROZEN');
      assert.equal(baseline.gate_state, 'FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR');
      assert.deepEqual(baseline.counts, {
        total_items: 50,
        repair_items: 38,
        control_items: 12,
        correct_decisions: 19,
        incorrect_decisions: 31,
        fresh_work5_questions: 3,
        repair_class_counts: {
          MATERIAL_MEANING_OMITTED_OR_HIDDEN: 21,
          CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE: 14,
          SOURCE_ARTEFACT: 1,
          FALSE_PARSER_AMBIGUITY: 1,
          APPROVED_NO_COMPARISON: 1,
          CLEAN_CONTROL: 12,
        },
      });
      assert.equal(baseline.entries.length, 50);
      assert.deepEqual(
        sortedNumbers(baseline.entries.filter((entry) => entry.repair_membership === 'REPAIR').map((entry) => entry.sample_ordinal)),
        REPAIR_ORDINALS,
      );
      assert.deepEqual(
        sortedNumbers(baseline.entries.filter((entry) => entry.repair_membership === 'CONTROL').map((entry) => entry.sample_ordinal)),
        CONTROL_ORDINALS,
      );
      assert.deepEqual(
        sortedNumbers(baseline.entries.filter((entry) => entry.requires_fresh_work5_question).map((entry) => entry.sample_ordinal)),
        FRESH_QUESTION_ORDINALS,
      );
      assert.ok(
        baseline.entries
          .filter((entry) => FRESH_QUESTION_ORDINALS.includes(entry.sample_ordinal))
          .every((entry) => (
            entry.repair_membership === 'REPAIR'
            && entry.fresh_work5_question_state === 'REQUIRED_CONTRADICTORY_OR_INSUFFICIENT_RECORD'
          )),
      );
      assert.ok(
        baseline.entries
          .filter((entry) => !FRESH_QUESTION_ORDINALS.includes(entry.sample_ordinal))
          .every((entry) => entry.fresh_work5_question_state === 'NOT_REQUIRED_BY_WORK0'),
      );
    });

    await t.test('all 75 calibration questions map to the three sealed programme rulings', () => {
      const mapping = first.records.calibration_question_ruling_map;
      assert.equal(mapping.state, 'SEALED_PROGRAMME_RULINGS_REBOUND_NO_HISTORICAL_PACK_REWRITE');
      assert.deepEqual(mapping.counts, {
        family_count: 25,
        question_count: 75,
        programme_ruling_count: 3,
      });
      assert.equal(mapping.families.length, 25);
      assert.ok(mapping.families.every((family) => family.question_mappings.length === 3));

      const questionMappings = mapping.families.flatMap((family) => family.question_mappings);
      assert.equal(questionMappings.length, 75);
      assert.equal(new Set(questionMappings.map((entry) => entry.family_question_id)).size, 75);
      const rulingBySuffix = {
        Q01: 'M5-RULING-ONE-OPERATIVE-LIMB',
        Q02: 'M5-RULING-ONE-SEMANTIC-OWNER',
        Q03: 'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
      };
      for (const entry of questionMappings) {
        const suffix = entry.family_question_id.slice(-3);
        assert.equal(entry.ruling_id, rulingBySuffix[suffix], entry.family_question_id);
      }
      assert.deepEqual(countBy(questionMappings, (entry) => entry.ruling_id), {
        'M5-RULING-ONE-OPERATIVE-LIMB': 25,
        'M5-RULING-ONE-SEMANTIC-OWNER': 25,
        'M5-RULING-FAIL-DEPENDENT-PROPOSITION': 25,
      });
    });

    await t.test('all 1,111 historical V1 rows are unique and non-consumable by V2', () => {
      const legacy = first.records.legacy_output_supersession_ledger;
      assert.equal(legacy.state, 'FAILED_HUMAN_REVIEW_NOT_CONSUMABLE');
      assert.equal(legacy.counts.analysis_files, 7);
      assert.equal(legacy.counts.projection_files, 7);
      assert.equal(legacy.counts.compound_propositions, 1111);
      assert.equal(legacy.counts.normal_rows, 1111);
      assert.equal(legacy.counts.omission_records, 1111);
      assert.equal(legacy.counts.support_ledgers, 8);
      assert.equal(legacy.analysis_registrations.length, 7);
      assert.equal(legacy.projection_registrations.length, 7);
      assert.equal(legacy.support_ledger_bindings.length, 8);
      assert.equal(legacy.row_registrations.length, 1111);
      assert.equal(new Set(legacy.row_registrations.map((row) => row.row_id)).size, 1111);
      assert.equal(
        new Set(legacy.row_registrations.map((row) => row.source_compound_proposition_id)).size,
        1111,
      );
      assert.equal(
        legacy.analysis_registrations.reduce((sum, entry) => sum + entry.compound_proposition_count, 0),
        1111,
      );
      assert.equal(
        legacy.projection_registrations.reduce((sum, entry) => sum + entry.normal_row_count, 0),
        1111,
      );
      assert.equal(
        legacy.projection_registrations.reduce((sum, entry) => sum + entry.omission_record_count, 0),
        1111,
      );
      const registrations = [
        ...legacy.analysis_registrations,
        ...legacy.projection_registrations,
        ...legacy.support_ledger_bindings,
        ...legacy.row_registrations,
      ];
      assert.ok(registrations.every((entry) => entry.v2_admissible === false));
      assert.ok(registrations.every((entry) => entry.supersession_state === 'FAILED_HUMAN_REVIEW_NOT_CONSUMABLE'));
      assert.deepEqual(legacy.v2_consumer_gate, {
        v1_semantic_admission: 'FORBIDDEN',
        active_m7_v2_dispatch_count: 0,
        enforcement_state: 'AUTHORITY_REJECTS_V1_INPUT',
      });
    });

    await t.test('activation must match every confirmed byte and identity field', () => {
      const confirmation = first.bindings.activation_confirmation;
      assert.equal(
        finaliser.validateActivationConfirmation({ authority, manifest, confirmation }),
        true,
      );

      const mutations = [
        ['state', (value) => { value.state = 'CONFIRMED'; }],
        ['approver', (value) => { value.approver = 'SOMEONE_ELSE'; }],
        ['date', (value) => { value.confirmed_on = '2026-08-15'; }],
        ['verbatim text', (value) => { value.verbatim_confirmation += ' '; }],
        ['authority path', (value) => { value.authority_binding.path += '.drift'; }],
        ['authority schema', (value) => { value.authority_binding.schema_version += '.drift'; }],
        ['authority bytes', (value) => { value.authority_binding.byte_length += 1; }],
        ['authority SHA', (value) => { value.authority_binding.sha256 = '0'.repeat(64); }],
        ['authority ID', (value) => { value.authority_binding.authority_id = '0'.repeat(64); }],
        ['manifest path', (value) => { value.manifest_binding.path += '.drift'; }],
        ['manifest schema', (value) => { value.manifest_binding.schema_version += '.drift'; }],
        ['manifest bytes', (value) => { value.manifest_binding.byte_length += 1; }],
        ['manifest SHA', (value) => { value.manifest_binding.sha256 = '0'.repeat(64); }],
        ['manifest ID', (value) => { value.manifest_binding.manifest_id = '0'.repeat(64); }],
      ];
      for (const [label, mutate] of mutations) {
        const drifted = clone(confirmation);
        mutate(drifted);
        assertErrorCode(
          () => finaliser.validateActivationConfirmation({ authority, manifest, confirmation: drifted }),
          finaliser.Work0FinalisationError,
          'ACTIVATION_CONFIRMATION_INVALID',
          `activation ${label}`,
        );
      }
    });

    await t.test('canonical bytes, self IDs and base bindings fail closed on in-memory drift', () => {
      const sourceBinding = manifest.input_bindings[0];
      const sourceBytes = fs.readFileSync(absolute(sourceBinding.path));
      assert.equal(validator.validateInputBinding({ binding: sourceBinding, bytes: sourceBytes }), true);
      assertErrorCode(
        () => validator.validateInputBinding({
          binding: sourceBinding,
          bytes: Buffer.concat([sourceBytes, Buffer.from('\n')]),
        }),
        validator.Work0ValidationError,
        'BASE_BLOB_DRIFT',
        'base blob byte drift',
      );
      const wrongBinding = { ...sourceBinding, sha256: '0'.repeat(64) };
      assertErrorCode(
        () => validator.validateInputBinding({ binding: wrongBinding, bytes: sourceBytes }),
        validator.Work0ValidationError,
        'BASE_BLOB_DRIFT',
        'base binding digest drift',
      );

      const spec = RECORD_SPECS[0];
      const record = first.records[spec.key];
      const prettyBytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
      assertErrorCode(
        () => validator.validateCanonicalRecord({
          record,
          bytes: prettyBytes,
          schemaVersion: record.schema_version,
          idField: spec.idField,
        }),
        validator.Work0ValidationError,
        'CANONICAL_JSON_DRIFT',
        'noncanonical JSON',
      );
      const wrongId = clone(record);
      wrongId[spec.idField] = '0'.repeat(64);
      assertErrorCode(
        () => validator.validateCanonicalRecord({
          record: wrongId,
          bytes: Buffer.from(`${canonicalJson(wrongId)}\n`, 'utf8'),
          schemaVersion: wrongId.schema_version,
          idField: spec.idField,
        }),
        validator.Work0ValidationError,
        'RECORD_IDENTITY_DRIFT',
        'self ID drift',
      );
    });

    await t.test('the read-only validator returns a canonical non-circular evidence root', async () => {
      const validation = await validator.validateWork0({ repoRoot: ROOT, writeReceipt: false });
      assert.equal(validation.ok, true);
      assert.ok(
        ['FINALISATION_PREVIEW', 'PERSISTENT_READ_ONLY'].includes(validation.mode),
        `unexpected validation mode ${validation.mode}`,
      );
      assert.equal(validation.receipt_path, RECEIPT_PATH);
      assert.equal(validation.manifest_id, manifest.manifest_id);
      assert.equal(validation.authority_id, authority.authority_id);

      const receipt = validation.receipt;
      assert.equal(receipt.schema_version, 'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1');
      assert.equal(receipt.stage, 'M7_V2_REPAIR_WORK0');
      assert.equal(receipt.lifecycle_state, 'SEALED_WORK0_ONLY');
      assert.equal(receipt.status, 'PASS_WORK0_EVIDENCE_ROOT_ONLY');
      assert.equal(receipt.base_commit, BASE_COMMIT);
      assert.equal(receipt.evidence_root_id, contentId(
        receipt.schema_version,
        without(receipt, 'evidence_root_id'),
      ));
      assert.equal(validation.receipt_id, receipt.evidence_root_id);
      assert.deepEqual(receipt.counts, EXPECTED_RECEIPT_COUNTS);
      assert.deepEqual(validation.counts, EXPECTED_RECEIPT_COUNTS);
      assert.deepEqual(receipt.effects, authority.zero_effect_expectations);
      assert.deepEqual(receipt.next_authority, {
        work1_7_authorised: false,
        m8_authorised: false,
        required_before_work1: 'SEPARATE_AUTHORITY_BINDING_COMPLETED_WORK0_EVIDENCE_ROOT',
        required_binding_field: 'work0_evidence_root_binding',
      });
      assert.deepEqual(receipt.activation_confirmation, first.bindings.activation_confirmation);
      assert.equal(receipt.evidence_input_bindings.length, 73);
      assert.equal(receipt.work0_record_bindings.length, 4);
      assert.deepEqual(
        receipt.work0_record_bindings.map((binding) => binding.path),
        RECORD_SPECS.map((spec) => spec.path),
      );

      const expectedSnapshotPaths = [
        ...authority.pre_work0_candidate_paths,
        ...authority.permitted_changed_paths,
      ].filter((entry) => entry !== RECEIPT_PATH);
      assert.equal(receipt.snapshot_bindings.length, 11);
      assert.deepEqual(
        receipt.snapshot_bindings.map((binding) => binding.path).sort(),
        expectedSnapshotPaths.sort(),
      );
      assert.ok(!receipt.snapshot_bindings.some((binding) => binding.path === RECEIPT_PATH));
      assert.equal(Object.hasOwn(receipt, 'receipt_self_binding'), false);
      assert.equal(Object.hasOwn(receipt, 'sha256'), false);
      assert.equal(Object.hasOwn(receipt, 'git_blob_oid'), false);
      for (const binding of receipt.snapshot_bindings) assertBindingMatchesPinnedBlob(binding);
      for (const binding of receipt.work0_record_bindings) assertBindingMatchesFile(binding);

      const expectedIndexBindings = receipt.snapshot_bindings.map((binding) => ({
        path: binding.path,
        git_blob_oid: binding.git_blob_oid,
      }));
      assert.equal(validator.validateIndexBlobBindings({
        actual: expectedIndexBindings,
        expected: expectedIndexBindings,
      }), true);
      const wrongStagedBlob = clone(expectedIndexBindings);
      wrongStagedBlob[0].git_blob_oid = '0'.repeat(40);
      assertErrorCode(
        () => validator.validateIndexBlobBindings({
          actual: wrongStagedBlob,
          expected: expectedIndexBindings,
        }),
        validator.Work0ValidationError,
        'SNAPSHOT_BINDING_DRIFT',
        'staged index blob mismatch',
      );
      assertErrorCode(
        () => validator.validateIndexBlobBindings({
          actual: expectedIndexBindings.slice(1),
          expected: expectedIndexBindings,
        }),
        validator.Work0ValidationError,
        'SNAPSHOT_BINDING_DRIFT',
        'ancestor tree binding omission',
      );

      const expectedChecks = [
        'ACTIVATION_CONFIRMATION',
        'BASE_INPUT_BINDINGS',
        'CORE_STATUS_DOCS',
        'FIXED_SAMPLE_IDENTITY',
        'REPAIR_BASELINE',
        'CALIBRATION_RULING_MAP',
        'LEGACY_V1_SUPERSESSION',
        'STATIC_DEPENDENCY_BOUNDARY',
        'ZERO_EFFECTS',
        'FINALISATION_SCOPE',
        'PERSISTENT_SNAPSHOT',
      ];
      assert.deepEqual(receipt.checks, expectedChecks.map((check_id) => ({ check_id, status: 'PASS' })));
      assert.equal(
        validator.validateCanonicalRecord({
          record: receipt,
          bytes: Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8'),
          schemaVersion: receipt.schema_version,
          idField: 'evidence_root_id',
        }),
        true,
      );

      const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8');
      const exactLaterAuthorityRecords = LATER_AUTHORITY_PATHS.map((authorityPath) => ({
        path: authorityPath,
        bytes: fs.readFileSync(absolute(authorityPath)),
      }));
      assert.equal(validator.validateLaterAuthority({
        authorityRecords: exactLaterAuthorityRecords,
        receipt,
        receiptBytes,
      }), true);
      assert.equal(validator.validateLaterAuthority({
        authorityRecords: [...exactLaterAuthorityRecords].reverse(),
        receipt,
        receiptBytes,
      }), true);

      for (const omittedPath of [null, ...LATER_AUTHORITY_PATHS]) {
        assertErrorCode(
          () => validator.validateLaterAuthority({
            authorityRecords: omittedPath === null
              ? []
              : exactLaterAuthorityRecords.filter(({ path: authorityPath }) => (
                authorityPath !== omittedPath
              )),
            receipt,
            receiptBytes,
          }),
          validator.Work0ValidationError,
          'LATER_AUTHORITY_DRIFT',
          `later authority omission ${omittedPath ?? 'all'}`,
        );
      }

      const wrongLaterAuthority = readJson(WORK1_7_AUTHORITY_PATH);
      wrongLaterAuthority.work0_evidence_root_binding.evidence_root_id = '0'.repeat(64);
      const wrongLaterUnsigned = clone(wrongLaterAuthority);
      delete wrongLaterUnsigned.authority_digest;
      delete wrongLaterUnsigned.authority_id;
      wrongLaterAuthority.authority_digest = sha256Hex(canonicalJson(wrongLaterUnsigned));
      wrongLaterAuthority.authority_id = contentId(wrongLaterAuthority.schema_version, {
        ...wrongLaterUnsigned,
        authority_digest: wrongLaterAuthority.authority_digest,
      });
      assertErrorCode(
        () => validator.validateLaterAuthority({
          authorityRecords: exactLaterAuthorityRecords.map((authorityRecord) => (
            authorityRecord.path === WORK1_7_AUTHORITY_PATH
              ? {
                path: WORK1_7_AUTHORITY_PATH,
                bytes: Buffer.from(`${canonicalJson(wrongLaterAuthority)}\n`, 'utf8'),
              }
              : authorityRecord
          )),
          receipt,
          receiptBytes,
        }),
        validator.Work0ValidationError,
        'LATER_AUTHORITY_DRIFT',
        'later authority evidence-root drift',
        /work0 evidence-root binding/,
      );

      const wrongCorrectionAuthority = readJson(WORK1_CORRECTION_AUTHORITY_PATH);
      wrongCorrectionAuthority.parent_authority_binding.record_id = '0'.repeat(64);
      wrongCorrectionAuthority.correction_authority_id = contentId(
        wrongCorrectionAuthority.schema_version,
        without(wrongCorrectionAuthority, 'correction_authority_id'),
      );
      assertErrorCode(
        () => validator.validateLaterAuthority({
          authorityRecords: [
            exactLaterAuthorityRecords.find(({ path: authorityPath }) => (
              authorityPath === WORK1_7_AUTHORITY_PATH
            )),
            {
              path: WORK1_CORRECTION_AUTHORITY_PATH,
              bytes: Buffer.from(`${canonicalJson(wrongCorrectionAuthority)}\n`, 'utf8'),
            },
          ],
          receipt,
          receiptBytes,
        }),
        validator.Work0ValidationError,
        'LATER_AUTHORITY_DRIFT',
        'later correction authority parent drift',
        /later correction parent authority binding/,
      );

      const substitutePrimaryAuthority = readJson(WORK1_7_AUTHORITY_PATH);
      substitutePrimaryAuthority.rollback.before_commit =
        'REMOVE_ONLY_UNCOMMITTED_OUTPUTS_IN_CURRENT_WORK_EXACT_DELTA_TEST_SUBSTITUTION';
      const substitutePrimaryUnsigned = clone(substitutePrimaryAuthority);
      delete substitutePrimaryUnsigned.authority_digest;
      delete substitutePrimaryUnsigned.authority_id;
      substitutePrimaryAuthority.authority_digest = sha256Hex(canonicalJson(substitutePrimaryUnsigned));
      substitutePrimaryAuthority.authority_id = contentId(substitutePrimaryAuthority.schema_version, {
        ...substitutePrimaryUnsigned,
        authority_digest: substitutePrimaryAuthority.authority_digest,
      });
      const substitutePrimaryBytes = Buffer.from(
        `${canonicalJson(substitutePrimaryAuthority)}\n`,
        'utf8',
      );
      const substituteCorrectionAuthority = readJson(WORK1_CORRECTION_AUTHORITY_PATH);
      substituteCorrectionAuthority.parent_authority_binding.record_id =
        substitutePrimaryAuthority.authority_id;
      substituteCorrectionAuthority.parent_authority_binding.byte_length =
        substitutePrimaryBytes.length;
      substituteCorrectionAuthority.parent_authority_binding.sha256 =
        sha256Hex(substitutePrimaryBytes);
      substituteCorrectionAuthority.parent_authority_binding.git_blob_oid =
        gitBlobOid(substitutePrimaryBytes);
      substituteCorrectionAuthority.correction_authority_id = contentId(
        substituteCorrectionAuthority.schema_version,
        without(substituteCorrectionAuthority, 'correction_authority_id'),
      );
      const substituteCorrectionBytes = Buffer.from(
        `${canonicalJson(substituteCorrectionAuthority)}\n`,
        'utf8',
      );
      assertErrorCode(
        () => validator.validateLaterAuthority({
          authorityRecords: [
            { path: WORK1_7_AUTHORITY_PATH, bytes: substitutePrimaryBytes },
            { path: WORK1_CORRECTION_AUTHORITY_PATH, bytes: substituteCorrectionBytes },
          ],
          receipt,
          receiptBytes,
        }),
        validator.Work0ValidationError,
        'LATER_AUTHORITY_DRIFT',
        'self-consistent later authority byte substitution',
        /exact authority pin drift/,
      );
      assertErrorCode(
        () => validator.validateLaterAuthority({
          authorityRecords: [
            exactLaterAuthorityRecords[0],
            exactLaterAuthorityRecords[0],
          ],
          receipt,
          receiptBytes,
        }),
        validator.Work0ValidationError,
        'LATER_AUTHORITY_DRIFT',
        'duplicate later authority',
      );
      assertErrorCode(
        () => validator.validateLaterAuthority({
          authorityRecords: [
            exactLaterAuthorityRecords.find(({ path: authorityPath }) => (
              authorityPath === WORK1_7_AUTHORITY_PATH
            )),
            {
              path: `${CONTROL_ROOT}/m7-v2-repair-work1-unexpected-authority.json`,
              bytes: exactLaterAuthorityRecords.find(({ path: authorityPath }) => (
                authorityPath === WORK1_CORRECTION_AUTHORITY_PATH
              )).bytes,
            },
          ],
          receipt,
          receiptBytes,
        }),
        validator.Work0ValidationError,
        'LATER_AUTHORITY_DRIFT',
        'unexpected later authority',
        /invalid, duplicate or unexpected later authority/,
      );
    });

    await t.test('the staged and snapshot path sets are exact allow-lists', () => {
      assert.equal(
        validator.validateStagedAllowlist({
          actual: authority.permitted_commit_paths,
          expected: authority.permitted_commit_paths,
        }),
        true,
      );
      assertErrorCode(
        () => validator.validateStagedAllowlist({
          actual: [...authority.permitted_commit_paths, 'work1-not-authorised.json'],
          expected: authority.permitted_commit_paths,
        }),
        validator.Work0ValidationError,
        'STAGED_ALLOWLIST_DRIFT',
        'extra staged path',
      );
      assertErrorCode(
        () => validator.validateStagedAllowlist({
          actual: authority.permitted_commit_paths.slice(1),
          expected: authority.permitted_commit_paths,
        }),
        validator.Work0ValidationError,
        'STAGED_ALLOWLIST_DRIFT',
        'missing staged path',
      );
    });

    await t.test('Work 0 scripts have no semantic M5, M6 or M7 dependency', () => {
      const allowedRelativeImports = new Set([
        '../lib/canonical-v2/canonical-bytes',
        '../lib/canonical-v2/canonical-bytes.js',
        './stage-2y-structure-m7-v2-repair-work0-finalise.mjs',
        './stage-2y-structure-m7-v2-repair-work0-validate.mjs',
        '../scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs',
        '../scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs',
      ]);
      for (const scriptPath of [FINALISER_PATH, VALIDATOR_PATH, TEST_PATH]) {
        const source = fs.readFileSync(absolute(scriptPath), 'utf8');
        const specifiers = literalModuleSpecifiers(source);
        for (const specifier of specifiers) {
          assert.ok(
            specifier.startsWith('node:') || allowedRelativeImports.has(specifier),
            `${scriptPath} imports unauthorised module ${specifier}`,
          );
        }
        assert.ok(!specifiers.some((specifier) => /family-compound-adapter/.test(specifier)));
        assert.ok(!specifiers.some((specifier) => /agreement-projection/.test(specifier)));
        assert.ok(!specifiers.some((specifier) => /m7-deterministic-generalisation/.test(specifier)));
        const nonLiteralDynamicImports = [...source.matchAll(/\bimport\s*\(([^)]*)\)/g)]
          .filter((match) => !/^\s*['"][^'"]+['"]\s*$/.test(match[1]));
        assert.deepEqual(nonLiteralDynamicImports, [], `${scriptPath} non-literal dynamic import`);
      }

      const validatorSource = fs.readFileSync(absolute(VALIDATOR_PATH), 'utf8');
      assert.match(
        validatorSource,
        /function writeReceiptExclusive[\s\S]*?fsConstants\.O_EXCL[\s\S]*?fsConstants\.O_NOFOLLOW[\s\S]*?while \(offset < bytes\.length\)[\s\S]*?writeSync\([\s\S]*?fsyncSync\([\s\S]*?closeSync\(/,
        'receipt publication must use exclusive no-follow full-write and sync operations',
      );
      assert.match(
        validatorSource,
        /function removeCreatedReceipt[\s\S]*?unlinkSync\(absolutePath\)/,
        'receipt write failure must remove only the receipt created by this invocation',
      );
      assert.match(
        validatorSource,
        /writeReceiptExclusive\(receiptAbsolutePath, proposedReceiptBytes\)[\s\S]*?catch \(error\) \{\s*removeCreatedReceipt\(receiptAbsolutePath, error\)/,
        'post-write finalisation failure must roll back the newly created receipt',
      );
      assert.match(
        validatorSource,
        /function worktreeLaterAuthorityPaths[\s\S]*?lstatSync\(absoluteDirectory\)[\s\S]*?if \(error\.code === 'ENOENT'\) return \[\];[\s\S]*?directoryStat\.isSymbolicLink\(\)[\s\S]*?!directoryStat\.isDirectory\(\)[\s\S]*?readdirSync\(absoluteDirectory[\s\S]*?if \(error\.code === 'ENOENT'\) return \[\];/,
        'persistent later-authority discovery must treat an absent worktree control root as an empty overlay and reject invalid roots',
      );
    });
  } finally {
    assert.deepEqual(
      snapshot(governedPaths),
      bytesBefore,
      'write:false finalisation, validation and negative checks must not change governed bytes',
    );
  }
});
