const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-f5-candidate.mjs';
const RUNTIME = 'scripts/lib/canonical-v2-staging-runtime.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');
const runtime = fs.readFileSync(RUNTIME, 'utf8');

function assertOrdered(body, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const next = body.indexOf(needle, cursor + 1);
    assert.notEqual(next, -1, `Missing ordered runner step: ${needle}`);
    assert.ok(next > cursor, `Runner step is out of order: ${needle}`);
    cursor = next;
  }
}

test('QXO F5 runner pins the exact release and semantic-write identities before mutation', () => {
  assert.match(source, /candidateInputHeadId: '100f80b3ed7e0685f010e79597d16458eda681469375315d4b072e79fd36b9ea'/);
  assert.match(source, /candidateInputHeadDigest: '8a8188dc2da2bcd7eff4463487f663e0fa51fefd5b3a29d4189efd89f756db12'/);
  assert.match(source, /correctionDischargeMapId: 'b2c6f67f1e48acca7e9d4a95e78588cb984b646bc5c617647d71bc8ecfb7b5af'/);
  assert.match(source, /corpusReleaseId: '7980dc600883690a0b290abb679a5ea5ecbd3119f7de97fa0519f5ca82d883c7'/);
  assert.match(source, /servingNamespaceId: 'e7d2c4c0941d6b825ea47599826bdd8c3b8767f160241c112e5f5b34bd30de6d'/);
  assert.match(source, /candidateManifestId: 'aa407583e05b0ed01a1675e78321963a70b54624a2647541dc50b2ab558bdb02'/);
  assert.match(source, /importPlanId: '0f2a73c1d8d71e4e7e1978ae160f5aa0e23e66d7211ceb9a46941e80ba396da6'/);
  assert.match(source, /inputDigest: '9366e12f06acca88f48750274528944808bd00a2ebdf720cc751924c554b2598'/);
  assert.match(source, /receiptId: 'fa14bbeac2074e86429bbe30ebfcd69e6f069b148bcf20fe78e8537b309a526f'/);
  assert.match(source, /persistedObjectReferences: 84/);
  assert.match(source, /newSemanticObjects: 4/);
  assert.match(
    source,
    /canonicalJson\(actual\) !== canonicalJson\(EXPECTED_CANDIDATE\)[\s\S]*canonicalJson\(semanticWrite\) !== canonicalJson\(EXPECTED_SEMANTIC_WRITE\)/,
  );
  assert.ok(
    source.indexOf('assertIdentityPins(candidate);')
      < source.indexOf("currentStage = 'READ_INITIAL_STATE'"),
    'Identity pins must be checked before any mutable lifecycle state is read.',
  );
});

test('QXO F5 runner uses only the bounded staging runtime and exact staging project', () => {
  assert.match(source, /from '\.\/lib\/canonical-v2-staging-runtime\.mjs'/);
  assert.match(source, /createCanonicalV2StagingRuntime\(\{[\s\S]*maxSqlBytes: 2 \* 1024 \* 1024[\s\S]*maxResponseBytes: 4 \* 1024 \* 1024[\s\S]*maxProcessBufferBytes: 6 \* 1024 \* 1024/);
  assert.match(source, /currentStage = 'GUARD_PROJECT';\s*guardProject\(\);\s*currentStage = 'BUILD_AND_CERTIFY'/);
  assert.match(runtime, /ref: 'sjumbznveyyiizhwvixj'/);
  assert.match(runtime, /name: 'deal-corpus-canonical-v2-staging'/);
  assert.match(runtime, /ref !== CANONICAL_V2_STAGING_PROJECT\.ref[\s\S]*linked\.ref !== CANONICAL_V2_STAGING_PROJECT\.ref[\s\S]*linked\.name !== CANONICAL_V2_STAGING_PROJECT\.name/);
  assert.match(runtime, /BEGIN\$\{readOnly \? ' TRANSACTION READ ONLY' : ''\}/);
  assert.doesNotMatch(`${source}\n${runtime}`, /\bproduction\b/i);
});

test('QXO F5 runner uses a new semantic-write key and certifies three approximate money rows', () => {
  assert.match(source, /const OPERATION = 'DEAL_SCOPE_RUN'/);
  assert.match(source, /const IDEMPOTENCY_KEY = 'QXO_MONEY_DENOMINATOR_PRECISION_F5_DEAL_SCOPE_V2'/);
  assert.match(source, /approximateMoneyRows: 3/);
  assert.match(source, /approximate_money_rows: EXPECTED_COUNTS\.approximateMoneyRows/);
  assert.match(source, /money_precision_mismatches: 0/);
  assert.match(
    source,
    /canonical_payload #>> '\{canonical_result,components,0,unit\}'[\s\S]*canonical_payload #>> '\{incomplete_canonical_result,components,0,unit\}'[\s\S]*='PERCENT_OF_DEAL_VALUE'/,
  );
  assert.match(
    source,
    /canonical_payload #>> '\{canonical_result,components,0,denominator,precision\}'[\s\S]*canonical_payload #>> '\{incomplete_canonical_result,components,0,denominator,precision\}'[\s\S]*='APPROXIMATE'/,
  );
  assert.match(
    source,
    /canonical_payload #>> '\{canonical_result,components,0,claim_attributes,denominator_precision\}'[\s\S]*canonical_payload #>> '\{incomplete_canonical_result,components,0,claim_attributes,denominator_precision\}'[\s\S]*='APPROXIMATE'[\s\S]*denominator_precision='APPROXIMATE'/,
  );
});

test('QXO F5 runner resolves persisted semantic dependencies once and writes only new objects', () => {
  assert.match(source, /PERSISTED_CANONICAL_OBJECT_REFERENCE\/V1/);
  assert.match(source, /WITH requested AS[\s\S]*jsonb_to_recordset[\s\S]*stored AS/);
  assert.equal((source.match(/table: '/g) || []).length, 14);
  assert.match(source, /Object\.entries\(PERSISTED_OBJECTS\)\.map[\s\S]*storedArms\.join\('\\n    UNION ALL'\)/);
  assert.match(source, /conflicts beyond publication closure/);
  assert.match(source, /persisted_object_references: Object\.freeze\(persistedObjectReferences\)/);
  assert.match(source, /persisted_semantic_object_references:[\s\S]*new_semantic_objects:/);
  assert.doesNotMatch(source, /ON CONFLICT|UPDATE canonical_v2_staging|DELETE FROM canonical_v2_staging/i);
});

test('QXO F5 import is rollback-first and rollback rehearsal reimports the identical candidate', () => {
  const importMode = source.slice(
    source.indexOf("if (mode === '--import')"),
    source.indexOf('assertSemanticWritten(initialSemanticState);'),
  );
  assertOrdered(importMode, [
    "currentStage = 'DRY_RUN_SEMANTIC_WRITE'",
    "currentStage = 'APPLY_SEMANTIC_WRITE'",
    "currentStage = 'DRY_RUN_CANDIDATE_IMPORT'",
    "currentStage = 'IMPORT_INACTIVE_CANDIDATE'",
    'assertCandidateImported(imported, candidate);',
  ]);

  const rehearsal = source.slice(source.indexOf("currentStage = 'ROLLBACK_INACTIVE_CANDIDATE'"));
  assertOrdered(rehearsal, [
    "currentStage = 'ROLLBACK_INACTIVE_CANDIDATE'",
    'await rollbackInactiveCandidateRelease({',
    'assertCandidateAbsent(absent);',
    'assertActivePointer(candidate, absent);',
    "currentStage = 'RECHECK_AUTHORITY_FOR_REIMPORT'",
    "currentStage = 'REIMPORT_IDENTICAL_CANDIDATE'",
    'await importCandidateRelease({',
    'assertCandidateImported(reimported, candidate);',
    'assertActivePointer(candidate, reimported);',
    "'ROLLED_BACK_AND_REIMPORTED'",
  ]);
});

test('QXO F5 lifecycle proves active-pointer immutability and has no activation path', () => {
  assert.match(
    source,
    /function assertActivePointer\(candidate, state\) \{[\s\S]*canonicalJson\(state\.active_pointer\) !== canonicalJson\(candidate\.inputs\.active_pointer\)[\s\S]*inactive F5 lifecycle changed the active staging pointer/,
  );
  for (const state of [
    'initialCandidateState',
    'beforeImport',
    'imported',
    'absent',
    'reimported',
  ]) {
    assert.match(source, new RegExp(`assertActivePointer\\(candidate, ${state}\\);`));
  }
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(
    source,
    /activateCandidateRelease|canonical_v2_activate_candidate_release|active_corpus_release_pointers\s+(?:SET|UPDATE|INSERT|DELETE)/i,
  );
  assert.doesNotMatch(source, /environment:\s*'production'|p_environment:\s*'production'/);
});
