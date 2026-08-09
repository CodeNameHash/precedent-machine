'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

let successor;

test.before(async () => {
  successor = await import('../scripts/canonical-v2-step-2x-k-blind-successor.mjs');
});

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeHermeticRepo() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'blind-successor-'));
  const run = 'hermetic-run';
  const runDir = join(repoRoot, 'evidence', 'canonical-v2', run);
  const payloadRelativePath = 'evidence/canonical-v2/_admitted-source-map-payloads/hermetic.deflate';
  const payloadPath = join(repoRoot, payloadRelativePath);
  const rawRelativePath = 'raw/hermetic.htm';
  const rawPath = join(repoRoot, rawRelativePath);
  const payloadBytes = Buffer.from('hermetic persisted source map');
  const rawBytes = Buffer.from('<html><body>hermetic source</body></html>');
  mkdirSync(dirname(payloadPath), { recursive: true });
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(payloadPath, payloadBytes);
  writeFileSync(rawPath, rawBytes);

  const reasons = [
    'CATEGORY_UNCORROBORATED',
    'CLAUSE_LABEL_NOT_IN_QUOTE',
    'QUALIFIER_KIND_UNCLASSIFIED',
    'TERMINATING_PARTY_REF_NOT_IN_QUOTE',
  ];
  const compiledCandidates = [];
  const reviewQueue = [];
  for (const reason of reasons) {
    for (let index = 0; index < 8; index += 1) {
      const id = `${reason}-${index}`;
      const closureId = `closure-${id}`;
      const claim = {
        claim_occurrence_id: id,
        claim_definition_key: 'HERMETIC_GENERIC_CLAIM',
        ordinal: index,
        raw_value: `operative text ${reason} ${index}`,
        closure_id: closureId,
        evidence: [],
      };
      compiledCandidates.push({
        ok: true,
        section_reference: '1',
        candidate: { kind: 'claim', claim, extraction_provenance: {} },
      });
      reviewQueue.push({
        has_resolution: false,
        original_claim_occurrence_id: id,
        closure_id: closureId,
        section_reference: '1',
        source_citation: '1',
        raw_value: claim.raw_value,
        reasons: [reason],
      });
    }
  }
  writeJson(join(runDir, 'run-receipt.json'), {
    run_receipt_id: 'hermetic-receipt',
    document_hash: sha256(rawBytes),
    resolved_sections: [],
    compiled_candidates: compiledCandidates,
  });
  writeJson(join(runDir, 'resolution.json'), {
    resolved: [], review_queue: reviewQueue, open_world: [], residuals: [],
  });
  writeJson(join(runDir, 'run-manifest.json'), {
    deal: 'hermetic', section_family: 'TERMINATION', agreement_date: '2026-01-01',
  });
  writeJson(join(runDir, 'source-reference.json'), {
    reused_committed_raw_html: rawRelativePath,
    admitted_source_capture_inputs: {
      source_map_payload_path: payloadRelativePath,
      source_map_compressed_sha256: sha256(payloadBytes),
    },
  });
  const baselinePath = join(repoRoot, 'baseline.json');
  writeJson(baselinePath, {
    runs: [{ run, importable: true, section_family: 'TERMINATION' }],
  });
  const cohortPath = join(repoRoot, 'cohort.json');
  writeJson(cohortPath, {
    schema_version: successor.COHORT_SCHEMA,
    baseline_manifest_path: 'baseline.json',
    baseline_manifest_sha256: sha256(readFileSync(baselinePath)),
    selection: 'ALL_IMPORTABLE_RUNS_WITH_SCOREABLE_REVIEW_HOLDBACKS',
    sampling_seed: 'hermetic-seed',
    stratum_count: 4,
    cards_per_stratum: 8,
  });
  return {
    repoRoot, run, runDir, cohortPath: 'cohort.json', payloadBytes, payloadPath,
    rawBytes, rawPath, compiledCandidates,
  };
}

function hermeticModules(fixture, disposition) {
  const calls = { load: 0, adopt: 0, admitted: 0, resolve: 0 };
  const runnerModule = {
    DEAL_PINS: { hermetic: {} },
    loadAndVerifySource({ rawHtmlPath }) {
      calls.load += 1;
      assert.deepEqual(readFileSync(resolve(fixture.repoRoot, rawHtmlPath)), fixture.rawBytes);
      return { conversion: { canonical_text: fixture.rawBytes.toString('utf8') } };
    },
    resolveContainedEvidenceFile(repoRoot, path) {
      assert.equal(repoRoot, fixture.repoRoot);
      return resolve(repoRoot, path);
    },
    adoptStoredSourceMapPayload({ verified, absolutePayloadPath }) {
      calls.adopt += 1;
      assert.deepEqual(readFileSync(absolutePayloadPath), fixture.payloadBytes);
      return { verified, sourceMapCompressedSha256: sha256(fixture.payloadBytes) };
    },
    buildAdmittedContext({ locallyValidatedConversion, recordedSourceMapProvenance }) {
      calls.admitted += 1;
      assert.ok(locallyValidatedConversion);
      assert.equal(recordedSourceMapProvenance.source_map_compressed_sha256, sha256(fixture.payloadBytes));
      return {
        admittedSourceContext: {
          governed_deal_key: 'hermetic',
          canonical_text: { text: fixture.rawBytes.toString('utf8') },
        },
      };
    },
  };
  const resolverModule = {
    compileContract: () => ({}),
    computeSectionCandidatesForLexicalDigest: () => [],
    buildLexicalDisagreementReceipt: () => ({}),
    resolveCandidates({ run_receipt: runReceipt }) {
      calls.resolve += 1;
      if (disposition === 'RESOLVED') {
        return {
          resolved: runReceipt.compiled_candidates.map((entry) => ({
            section_reference: entry.section_reference,
            generic_claim_key: entry.candidate.claim.claim_definition_key,
            compiled_candidate: entry,
          })),
          review_queue: [], open_world: [], residuals: [],
        };
      }
      return {
        resolved: [],
        review_queue: runReceipt.compiled_candidates.map((entry) => ({
          has_resolution: false,
          original_claim_occurrence_id: entry.candidate.claim.claim_occurrence_id,
          reasons: ['STILL_REVIEW'],
        })),
        open_world: [],
        residuals: [],
      };
    },
  };
  return { calls, runnerModule, resolverModule };
}

test('the frozen successor cohort deterministically selects 96 blinded review hold-backs', () => {
  const cohortPath = 'tests/fixtures/canonical-v2/step-2x-k-blind-successor-cohort.json';
  const first = successor.buildBlindSuccessorSample({ cohortPath });
  const second = successor.buildBlindSuccessorSample({ cohortPath });

  assert.deepEqual(first, second);
  assert.equal(first.sample.sample_id, 'fbc99534518b4b3608eee77c60cd514adb0a0407614519a6250da3f8c6ff65b8');
  assert.equal(first.key.key_id, 'fbb5619c194d9f32db47c930783ebc1e019bbf6a7485784fe1766f7ba538503d');
  assert.equal(first.sample.cards.length, 96);
  assert.equal(first.key.cards.length, 96);
  assert.equal(first.key.population_count, 1439);
  assert.deepEqual(first.key.unscoreable_exclusions, []);
  assert.ok(first.key.cards.every((card) => (
    typeof card.source_binding.source_reference_sha256 === 'string'
      && (card.source_binding.source_map_payload === null
        || (typeof card.source_binding.source_map_payload.path === 'string'
          && typeof card.source_binding.source_map_payload.sha256 === 'string'))
  )));

  const byStratum = Map.groupBy(first.key.cards, (card) => card.stratum);
  assert.equal(byStratum.size, 12);
  for (const cards of byStratum.values()) assert.equal(cards.length, 8);
  for (const stratum of [
    'REVIEW:CATEGORY_UNCORROBORATED',
    'REVIEW:CLAUSE_LABEL_NOT_IN_QUOTE',
    'REVIEW:QUALIFIER_KIND_UNCLASSIFIED',
    'REVIEW:TERMINATING_PARTY_REF_NOT_IN_QUOTE',
  ]) assert.equal(byStratum.get(stratum).length, 8);

  for (const card of first.sample.cards) {
    assert.deepEqual(Object.keys(card).sort(), [
      'card_id', 'deal', 'family', 'section_reference', 'source_citation', 'source_text',
    ]);
  }
  assert.match(first.sample.successor_notice, /NOT_EXACT_REPLAY/);
});

test('a review hold-back with no raw candidate is recorded as unscoreable', () => {
  const result = successor.populationFromRun({
    run: 'run-1',
    deal: 'deal-1',
    family: 'TERMINATION',
    hashes: {},
    runReceipt: { compiled_candidates: [] },
    resolution: {
      review_queue: [{
        has_resolution: false,
        closure_id: 'missing',
        reasons: ['REASON'],
        raw_value: 'source text',
      }],
    },
  });

  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.exclusions, [{
    source_run: 'run-1',
    old_channel: 'REVIEW',
    source_index: 0,
    closure_id: 'missing',
    reason: 'NO_RAW_CANDIDATE_MATCH',
  }]);
});

test('an ambiguous raw-candidate join fails closed', () => {
  assert.throws(
    () => successor.populationFromRun({
      run: 'run-1',
      deal: 'deal-1',
      family: 'TERMINATION',
      hashes: {},
      runReceipt: {
        compiled_candidates: ['one', 'two'].map((id) => ({
          candidate: { claim: { claim_occurrence_id: id, closure_id: 'shared' } },
        })),
      },
      resolution: {
        review_queue: [{
          has_resolution: false,
          closure_id: 'shared',
          reasons: ['REASON'],
          raw_value: 'source text',
        }],
      },
    }),
    (error) => error.code === 'SOURCE_CANDIDATE_JOIN_AMBIGUOUS'
      && error.details.match_count === 2,
  );
});

test('an original candidate id must exist exactly once in compiled candidates', () => {
  const build = (compiledCandidates) => () => successor.populationFromRun({
    run: 'run-1',
    deal: 'deal-1',
    family: 'TERMINATION',
    hashes: {},
    runReceipt: { compiled_candidates: compiledCandidates },
    resolution: {
      review_queue: [{
        has_resolution: false,
        original_claim_occurrence_id: 'named-id',
        reasons: ['REASON'],
        raw_value: 'source text',
      }],
    },
  });
  assert.throws(
    build([]),
    (error) => error.code === 'SOURCE_CANDIDATE_ORIGINAL_ID_INVALID'
      && error.details.match_count === 0,
  );
  const duplicate = {
    candidate: { claim: { claim_occurrence_id: 'named-id', closure_id: 'closure' } },
  };
  assert.throws(
    build([duplicate, duplicate]),
    (error) => error.code === 'SOURCE_CANDIDATE_ORIGINAL_ID_INVALID'
      && error.details.match_count === 2,
  );
});

test('an importable run missing required evidence fails sample generation', () => {
  const fixture = makeHermeticRepo();
  try {
    unlinkSync(join(fixture.runDir, 'run-receipt.json'));
    assert.throws(
      () => successor.buildBlindSuccessorSample({
        repoRoot: fixture.repoRoot,
        cohortPath: fixture.cohortPath,
      }),
      (error) => error.code === 'IMPORTABLE_RUN_EVIDENCE_MISSING'
        && error.details.missing.includes('receiptPath'),
    );
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('an importable run without persisted source-map binding fails sample generation', () => {
  const fixture = makeHermeticRepo();
  try {
    writeJson(join(fixture.runDir, 'source-reference.json'), {
      reused_committed_raw_html: 'raw/hermetic.htm',
      admitted_source_capture_inputs: {},
    });
    assert.throws(
      () => successor.buildBlindSuccessorSample({
        repoRoot: fixture.repoRoot,
        cohortPath: fixture.cohortPath,
      }),
      (error) => error.code === 'SOURCE_MAP_BINDING_REQUIRED',
    );
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('candidate identities are deal-scoped and collision-checked within a deal', () => {
  const base = {
    source_candidate_id: 'candidate-1',
    family: 'TERMINATION',
    section_reference: '1',
    source_citation: '1(a)',
    source_text: 'source text',
  };
  const crossDeal = successor.deduplicatePopulation([
    { ...base, deal: 'deal-1', source_run: 'run-1' },
    { ...base, deal: 'deal-2', source_run: 'run-2' },
  ]);
  assert.equal(crossDeal.length, 2);

  assert.throws(
    () => successor.deduplicatePopulation([
      { ...base, deal: 'deal-1', source_run: 'run-1' },
      { ...base, deal: 'deal-1', source_run: 'run-2', source_text: 'different text' },
    ]),
    (error) => error.code === 'SOURCE_CANDIDATE_ID_COLLISION',
  );
});

test('a source candidate with mixed projections gets one conservative disposition', () => {
  const outcomes = successor.indexCurrentOutcomes({
      runReceipt: {
        compiled_candidates: [{
          ok: true,
          candidate: {
            kind: 'claim',
            claim: { claim_occurrence_id: 'candidate-1' },
          },
        }],
      },
      resolution: {
        resolved: [{
          compiled_candidate: { candidate: { claim: { claim_occurrence_id: 'candidate-1' } } },
        }],
        review_queue: [{
          has_resolution: false,
          original_claim_occurrence_id: 'candidate-1',
          reasons: ['REASON'],
        }],
      },
    });
  assert.deepEqual(outcomes.get('candidate-1'), {
    channel: 'REVIEW',
    reasons: ['REASON'],
    observed_channels: ['REVIEW', 'RESOLVED'],
  });
});

test('a governed remint is attributed to its exact source evidence span', () => {
  const sourceClaim = {
    claim_occurrence_id: 'source-candidate',
    claim_definition_key: 'GENERIC_QUALIFIER',
    raw_value: 'in all material respects',
    evidence: [{
      document_ordinal: 0,
      absolute_start: 100,
      absolute_end: 124,
      evidence_role: 'OPERATIVE_TEXT',
    }],
  };
  const outcomes = successor.indexCurrentOutcomes({
    runReceipt: {
      compiled_candidates: [{
        ok: true,
        section_reference: '3.01',
        candidate: { kind: 'claim', claim: sourceClaim },
      }],
    },
    resolution: {
      resolved: [{
        section_reference: '3.01',
        generic_claim_key: 'GENERIC_QUALIFIER',
        compiled_candidate: {
          candidate: {
            claim: {
              claim_occurrence_id: 'governed-remint',
              raw_value: sourceClaim.raw_value,
              evidence: sourceClaim.evidence,
            },
          },
        },
      }],
    },
  });

  assert.deepEqual(outcomes.get('source-candidate'), {
    channel: 'RESOLVED', reasons: [], observed_channels: ['RESOLVED'],
  });
  assert.equal(outcomes.has('governed-remint'), false);
});

test('a governed remint with ambiguous source spans fails closed', () => {
  const sourceClaim = {
    claim_definition_key: 'GENERIC_QUALIFIER',
    raw_value: 'in all material respects',
    evidence: [{
      document_ordinal: 0,
      absolute_start: 100,
      absolute_end: 124,
      evidence_role: 'OPERATIVE_TEXT',
    }],
  };
  assert.throws(
    () => successor.indexCurrentOutcomes({
      runReceipt: {
        compiled_candidates: ['source-one', 'source-two'].map((claimOccurrenceId) => ({
          ok: true,
          section_reference: '3.01',
          candidate: {
            kind: 'claim',
            claim: { ...sourceClaim, claim_occurrence_id: claimOccurrenceId },
          },
        })),
      },
      resolution: {
        resolved: [{
          section_reference: '3.01',
          generic_claim_key: 'GENERIC_QUALIFIER',
          compiled_candidate: {
            candidate: {
              claim: {
                claim_occurrence_id: 'governed-remint',
                raw_value: sourceClaim.raw_value,
                evidence: sourceClaim.evidence,
              },
            },
          },
        }],
      },
    }),
    (error) => error.code === 'CURRENT_RESOLVED_LINEAGE_AMBIGUOUS'
      && error.details.match_count === 2,
  );
});

test('surviving source attributes disambiguate identical evidence spans', () => {
  const evidence = [{
    document_ordinal: 0,
    absolute_start: 100,
    absolute_end: 124,
    evidence_role: 'OPERATIVE_TEXT',
  }];
  const outcomes = successor.indexCurrentOutcomes({
    runReceipt: {
      compiled_candidates: ['(i)', '(ii)'].map((path, index) => ({
        ok: true,
        section_reference: '3.01',
        candidate: {
          kind: 'claim',
          claim: {
            claim_occurrence_id: `source-${index}`,
            claim_definition_key: 'GENERIC_QUALIFIER',
            raw_value: 'in all material respects',
            evidence,
            attributes: { attachment: { position: 'ITEM', governs_path: [path] } },
          },
        },
      })),
    },
    resolution: {
      resolved: [{
        section_reference: '3.01',
        generic_claim_key: 'GENERIC_QUALIFIER',
        compiled_candidate: {
          candidate: {
            claim: {
              claim_occurrence_id: 'governed-remint',
              raw_value: 'in all material respects',
              evidence,
              attributes: {
                attachment: { position: 'ITEM', governs_path: ['(ii)'] },
                answer_provenance: { tag: 'MECHANICAL' },
              },
            },
          },
        },
      }],
    },
  });

  assert.deepEqual(outcomes.get('source-1'), {
    channel: 'RESOLVED', reasons: [], observed_channels: ['RESOLVED'],
  });
  assert.equal(outcomes.has('source-0'), false);
});

test('the preserved claim ordinal disambiguates otherwise identical source candidates', () => {
  const evidence = [{
    document_ordinal: 0,
    absolute_start: 100,
    absolute_end: 124,
    evidence_role: 'OPERATIVE_TEXT',
  }];
  const attributes = { attachment: { position: 'ITEM', governs_path: ['(iii)'] } };
  const outcomes = successor.indexCurrentOutcomes({
    runReceipt: {
      compiled_candidates: [2, 3].map((ordinal) => ({
        ok: true,
        section_reference: '3.01',
        candidate: {
          kind: 'claim',
          claim: {
            claim_occurrence_id: `source-${ordinal}`,
            claim_definition_key: 'GENERIC_QUALIFIER',
            ordinal,
            raw_value: 'in all material respects',
            evidence,
            attributes,
          },
        },
      })),
    },
    resolution: {
      resolved: [{
        section_reference: '3.01',
        generic_claim_key: 'GENERIC_QUALIFIER',
        compiled_candidate: {
          candidate: {
            claim: {
              claim_occurrence_id: 'governed-remint',
              ordinal: 2,
              raw_value: 'in all material respects',
              evidence,
              attributes,
            },
          },
        },
      }],
    },
  });

  assert.deepEqual(outcomes.get('source-2'), {
    channel: 'RESOLVED', reasons: [], observed_channels: ['RESOLVED'],
  });
  assert.equal(outcomes.has('source-3'), false);
});

test('an exact source span wins over a containing parent carrier', () => {
  const childEvidence = [{
    document_ordinal: 0,
    absolute_start: 120,
    absolute_end: 144,
    evidence_role: 'OPERATIVE_TEXT',
  }];
  const outcomes = successor.indexCurrentOutcomes({
    runReceipt: {
      compiled_candidates: [
        {
          ok: true,
          section_reference: '6.10',
          candidate: {
            kind: 'claim',
            claim: {
              claim_occurrence_id: 'parent-carrier',
              claim_definition_key: 'GENERIC_DNO',
              raw_value: 'parent text with six years and more text',
              evidence: [{
                document_ordinal: 0,
                absolute_start: 100,
                absolute_end: 180,
                evidence_role: 'OPERATIVE_TEXT',
              }],
            },
          },
        },
        {
          ok: true,
          section_reference: '6.10',
          candidate: {
            kind: 'claim',
            claim: {
              claim_occurrence_id: 'exact-child',
              claim_definition_key: 'GENERIC_DNO',
              raw_value: 'six years',
              evidence: childEvidence,
            },
          },
        },
      ],
    },
    resolution: {
      resolved: [{
        section_reference: '6.10',
        generic_claim_key: 'GENERIC_DNO',
        compiled_candidate: {
          candidate: {
            claim: {
              claim_occurrence_id: 'governed-remint',
              raw_value: 'six years',
              evidence: childEvidence,
            },
          },
        },
      }],
    },
  });

  assert.deepEqual(outcomes.get('exact-child'), {
    channel: 'RESOLVED', reasons: [], observed_channels: ['RESOLVED'],
  });
  assert.equal(outcomes.has('parent-carrier'), false);
});

test('targeted scoring ignores unrelated multi-channel carriers', () => {
  const outcomes = successor.indexCurrentOutcomes({
    candidateIds: new Set(['target']),
    runReceipt: {
      compiled_candidates: [
        { ok: true, candidate: { kind: 'claim', claim: { claim_occurrence_id: 'target' } } },
        { ok: true, candidate: { kind: 'claim', claim: { claim_occurrence_id: 'unrelated' } } },
      ],
    },
    resolution: {
      resolved: [{
        compiled_candidate: { candidate: { claim: { claim_occurrence_id: 'target' } } },
      }],
      review_queue: [{
        has_resolution: false,
        original_claim_occurrence_id: 'unrelated',
        reasons: ['REVIEW_REASON'],
      }],
      open_world: [{
        original_claim_occurrence_id: 'unrelated',
        reason: 'OPEN_WORLD_REASON',
      }],
    },
  });

  assert.deepEqual([...outcomes], [['target', {
    channel: 'RESOLVED', reasons: [], observed_channels: ['RESOLVED'],
  }]]);
});

test('scoring rejects a key changed after deterministic selection', async () => {
  const cohortPath = 'tests/fixtures/canonical-v2/step-2x-k-blind-successor-cohort.json';
  const generated = successor.buildBlindSuccessorSample({ cohortPath });
  const changed = structuredClone(generated.key);
  changed.cards[0].source_run = 'substituted-run';

  await assert.rejects(
    successor.scoreBlindSuccessor({ cohortPath, key: changed, runnerModule: {} }),
    (error) => error.code === 'SCORE_KEY_NOT_FROZEN',
  );
});

test('hermetic end-to-end scoring reconstructs and adopts source bytes deterministically', async () => {
  const fixture = makeHermeticRepo();
  try {
    const generated = successor.buildBlindSuccessorSample({
      repoRoot: fixture.repoRoot,
      cohortPath: fixture.cohortPath,
    });
    assert.equal(generated.sample.cards.length, 32);
    assert.equal(generated.key.cards.length, 32);
    assert.deepEqual(generated.key.cards[0].source_binding.source_map_payload, {
      path: 'evidence/canonical-v2/_admitted-source-map-payloads/hermetic.deflate',
      sha256: sha256(fixture.payloadBytes),
    });

    const acceptedModules = hermeticModules(fixture, 'RESOLVED');
    const accepted = await successor.scoreBlindSuccessor({
      repoRoot: fixture.repoRoot,
      cohortPath: fixture.cohortPath,
      key: generated.key,
      runnerModule: acceptedModules.runnerModule,
      resolverModule: acceptedModules.resolverModule,
    });
    const repeated = await successor.scoreBlindSuccessor({
      repoRoot: fixture.repoRoot,
      cohortPath: fixture.cohortPath,
      key: generated.key,
      runnerModule: acceptedModules.runnerModule,
      resolverModule: acceptedModules.resolverModule,
    });
    assert.equal(JSON.stringify(accepted), JSON.stringify(repeated));
    assert.equal(accepted.score_id, '028552c39b4016d2cdabc61c9f6b7f16b92d9ab4674ed6f3176cf1755d0999fc');
    assert.equal(accepted.acceptance.accepted, true);
    assert.equal(accepted.acceptance.all_cards_accounted, true);
    assert.deepEqual(accepted.acceptance.unnamed_historical_strata_exact_comparison, {
      available: false,
      gate_applied: false,
      reason: 'EXACT_STRATUM_IDENTITIES_AND_CARD_MEMBERSHIP_LOST',
    });
    assert.deepEqual(acceptedModules.calls, { load: 2, adopt: 2, admitted: 2, resolve: 4 });

    const refusedModules = hermeticModules(fixture, 'REVIEW');
    const refused = await successor.scoreBlindSuccessor({
      repoRoot: fixture.repoRoot,
      cohortPath: fixture.cohortPath,
      key: generated.key,
      runnerModule: refusedModules.runnerModule,
      resolverModule: refusedModules.resolverModule,
    });
    assert.equal(refused.acceptance.all_cards_accounted, true);
    assert.equal(refused.acceptance.accepted, false);
    assert.ok(refused.results.every((result) => result.current_channel === 'REVIEW'));
    assert.notEqual(refused.score_id, accepted.score_id);
    assert.deepEqual(refusedModules.calls, { load: 1, adopt: 1, admitted: 1, resolve: 2 });
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('the CLI keeps the key outside the public sample directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blind-successor-cli-'));
  try {
    const publicDirectory = join(directory, 'public');
    const privateKeyPath = join(directory, 'private', 'key.json');
    const cohortPath = join(__dirname, 'fixtures', 'canonical-v2', 'step-2x-k-blind-successor-cohort.json');
    const scriptPath = join(__dirname, '..', 'scripts', 'canonical-v2-step-2x-k-blind-successor.mjs');
    const success = spawnSync(process.execPath, [
      scriptPath, 'sample', '--cohort', cohortPath, '--out-dir', publicDirectory,
      '--key-out', privateKeyPath,
    ], { encoding: 'utf8' });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(existsSync(join(publicDirectory, 'sample.json')), true);
    assert.equal(existsSync(join(publicDirectory, 'key.json')), false);
    assert.equal(existsSync(privateKeyPath), true);

    const refused = spawnSync(process.execPath, [
      scriptPath, 'sample', '--cohort', cohortPath, '--out-dir', publicDirectory,
      '--key-out', join(publicDirectory, 'secret-key.json'),
    ], { encoding: 'utf8' });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /KEY_OUTPUT_NOT_SEPARATE/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the CLI rejects a symlinked key directory that resolves inside the public sample directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blind-successor-cli-symlink-'));
  try {
    const publicDirectory = join(directory, 'public');
    const privateDirectory = join(directory, 'private');
    mkdirSync(publicDirectory);
    symlinkSync(publicDirectory, privateDirectory, 'dir');
    const cohortPath = join(__dirname, 'fixtures', 'canonical-v2', 'step-2x-k-blind-successor-cohort.json');
    const scriptPath = join(__dirname, '..', 'scripts', 'canonical-v2-step-2x-k-blind-successor.mjs');
    const result = spawnSync(process.execPath, [
      scriptPath, 'sample', '--cohort', cohortPath, '--out-dir', publicDirectory,
      '--key-out', join(privateDirectory, 'key.json'),
    ], { encoding: 'utf8' });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /KEY_OUTPUT_NOT_SEPARATE/);
    assert.equal(existsSync(join(publicDirectory, 'key.json')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
