const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

test('Option A authority partition files are deterministic governed extracts', () => {
  const result = spawnSync(process.execPath, [
    'scripts/canonical-v2-optiona-authority-partition.mjs', '--check',
  ], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Verified 5 Option A authority-partition files/);

  const migration = fs.readFileSync(
    'sql/optionA/step0a-candidate-input-heads-by-contract.sql', 'utf8',
  );
  assert.match(migration, /PRIMARY KEY \(environment, contract_fingerprint\)/);
  assert.match(migration, /pinned F1 candidate input head is missing/);
  assert.match(migration, /authority partition key is not exact/);

  const verification = fs.readFileSync(
    'sql/optionA/step0e-verify-authority-partition.sql', 'utf8',
  );
  assert.match(verification, /canonical writer is not contract-partitioned/);
  assert.match(verification, /candidate importer is not contract-partitioned/);
  assert.match(verification, /candidate activation is not contract-partitioned/);
  assert.match(verification, /authority partition migration moved the pinned F1 head/);
});

test('Option A blocks fail closed and keep activation outside the packet', () => {
  const generator = fs.readFileSync(
    'scripts/canonical-v2-staging-qxo-termination-optionA.mjs', 'utf8',
  );
  const semanticGate = generator.indexOf('function semanticWriteGateSql');
  const importFiles = generator.indexOf("'04-import-dry-run.sql'");
  assert.ok(semanticGate >= 0 && semanticGate < importFiles);
  assert.match(generator, /exact termination DEAL_SCOPE_RUN receipt is not committed/);
  assert.match(generator, /termination semantic closure count mismatch/);
  assert.match(generator, /active staging pointer is not the exact pinned F1 pointer/);
  assert.match(generator, /inactive import changed the active staging pointer/);
  assert.doesNotMatch(generator, /canonical_v2_activate_candidate_release\s*\(/);

  for (const filename of [
    'sql/optionA/01-f2-authority-genesis-dry-run.sql',
    'sql/optionA/01-f2-authority-genesis-apply.sql',
  ]) {
    const genesis = fs.readFileSync(filename, 'utf8');
    assert.match(genesis, /exact F2 authority genesis head was not created/);
    assert.match(genesis, /F2 genesis moved the pinned F1 authority head/);
    assert.ok(genesis.indexOf('$f2_genesis_assert$;') < Math.max(
      genesis.lastIndexOf('ROLLBACK;'), genesis.lastIndexOf('COMMIT;'),
    ));
  }

  const widening = fs.readFileSync(
    'sql/optionA/step1-active-query-page-release-declared-fingerprint.sql', 'utf8',
  );
  assert.match(widening, /release_declared_fingerprint_assert/);
  assert.ok(widening.indexOf('$release_declared_fingerprint_assert$;') < widening.indexOf('COMMIT;'));
});
