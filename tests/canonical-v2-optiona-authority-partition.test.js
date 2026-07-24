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
  assert.match(generator, /shared deal-value excerpt mismatch/);
  assert.match(generator, /reuse exactly the pinned material deal-value excerpt/);
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
  const serving = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const servingStart = serving.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page',
  );
  const servingEnd = serving.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context',
  );
  const packetStart = widening.indexOf(
    'CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page',
  );
  const packetEnd = widening.indexOf('\n$$;', packetStart);
  assert.equal(
    widening.slice(packetStart, packetEnd + 4).trim(),
    serving.slice(servingStart, servingEnd).trim(),
  );
  assert.match(widening, /release_declared_fingerprint_assert/);
  assert.ok(widening.indexOf('$release_declared_fingerprint_assert$;') < widening.indexOf('COMMIT;'));
});

test('generated Option A packet is pinned, bounded and inactive', () => {
  const root = 'sql/optionA/generated';
  const attestation = JSON.parse(fs.readFileSync(`${root}/ATTESTATION.json`, 'utf8'));
  assert.equal(attestation.contract_fingerprint, '46553f1a743dbf9f4ebfd07bff20939f66a57c4973826b5619c8bdfd196b1b83');
  assert.equal(attestation.corpus_release_id, '1b70bbc8b615e1195a71ba5f9ce9aad88542e2dce4c402813e372fea9277d2b6');
  assert.equal(attestation.candidate_release_import_plan_id, 'dd26b85607cc53ea78e74455724db2eab970c4c22c2196f25f4f17343f63ab86');
  assert.equal(attestation.termination_semantic_closure_id, '6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2');
  assert.equal(attestation.termination_deal_scope_input_digest, '4bc0b3b0dca0832212cad00e83b7bbc595e5119708953e51c62ee192dd3f8db7');

  const before = fs.readFileSync(`${root}/01-verify-before.sql`, 'utf8');
  const semanticDryRun = fs.readFileSync(`${root}/02-termination-deal-scope-dry-run.sql`, 'utf8');
  const semanticApply = fs.readFileSync(`${root}/03-termination-deal-scope-apply.sql`, 'utf8');
  const importDryRun = fs.readFileSync(`${root}/04-import-dry-run.sql`, 'utf8');
  const importApply = fs.readFileSync(`${root}/05-import-apply.sql`, 'utf8');
  const after = fs.readFileSync(`${root}/06-verify-after.sql`, 'utf8');
  assert.match(before, /active staging pointer is not the exact pinned F1 pointer/);
  assert.match(before, /one or more prior QXO semantic closures are missing/);
  assert.match(semanticDryRun, /exact termination DEAL_SCOPE_RUN receipt is not committed/);
  assert.match(
    semanticDryRun,
    /"deal":\{"deal_key":"deal:qxo-topbuild","deal_admission_id":"62b8b828c534273c68dcd48cec3fbbcb4f912ac3f477dbdc377de5ac47954c8f","document_hash":"abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d"\}/,
  );
  assert.doesNotMatch(semanticDryRun, /"deal":\{[^}]*"dimensions"/);
  assert.match(
    semanticDryRun,
    /closure_id='6e59b62130b2c0bac205251bf936c7aaca55b84ed9251971a1528870b17672a2'\) <> 8 THEN\s+RAISE EXCEPTION 'termination semantic closure count mismatch: excerpts'/,
  );
  assert.match(
    semanticDryRun,
    /excerpt_id='56224984beed0f058c61f7af92667fdf3c983a65dc742052946af979e40b7dee'[\s\S]*closure_id='a08b15c095464e265205ffd87ec380a85e37e9867c9701551b7b59759ed0cab5'[\s\S]*canonical_payload_digest=canonical_v2_staging\.payload_digest\([\s\S]*RAISE EXCEPTION 'shared deal-value excerpt mismatch'/,
  );
  assert.match(semanticDryRun, /ROLLBACK;\s*$/);
  assert.match(semanticApply, /exact termination DEAL_SCOPE_RUN receipt is not committed/);
  assert.match(semanticApply, /COMMIT;\s*$/);
  for (const sql of [importDryRun, importApply]) {
    assert.ok(sql.indexOf('exact termination DEAL_SCOPE_RUN receipt is not committed')
      < sql.indexOf('canonical_v2_recheck_candidate_input_head'));
    assert.ok(sql.indexOf('canonical_v2_recheck_candidate_input_head')
      < sql.indexOf('canonical_v2_import_candidate_release'));
    assert.doesNotMatch(sql, /canonical_v2_activate_candidate_release\s*\(/);
    assert.ok(Buffer.byteLength(sql, 'utf8') < 512 * 1024);
  }
  assert.match(after, /inactive import changed the active staging pointer/);
  assert.match(after, /the exact F2 candidate release record is missing/);
});
