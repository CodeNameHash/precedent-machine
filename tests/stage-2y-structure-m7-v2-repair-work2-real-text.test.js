'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const LIB = '../scripts/stage-2y-structure-m7-v2-repair-work2-real-text-lib.mjs';

async function loadLib() {
  return import(LIB);
}

test('Work 2 real-text scripts refuse a run without --registration', async () => {
  const { parseArgv, Work2RealTextError } = await loadLib();
  assert.throws(
    () => parseArgv(['node', 'scripts/stage-2y-structure-m7-v2-repair-work2-real-text-run.mjs']),
    (error) => error instanceof Work2RealTextError
      && error.code === 'WORK2_REAL_TEXT_INVALID'
      && /--registration is mandatory/.test(error.message),
  );
});

test('Work 2 real-text validate names the agreement on withheld, hash, and occurrence failures', async () => {
  const {
    OUTPUT_ROOT,
    validateOutputs,
    writeJson,
  } = await loadLib();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w2-real-text-'));
  const agreementId = 'a'.repeat(64);
  const analysisPath = `${OUTPUT_ROOT}/${agreementId}.agreement-analysis.json`;
  const sourceText = 'The Company shall pay the Parent.';
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
  const spanSha = sha256Hex(sourceBytes);
  const analysis = {
    agreement_id: agreementId,
    governed_input_occurrence_ids: ['claim-1'],
    source_closures: [{
      source_closure_id: 'closure-1',
      source_node_occurrence_id: 'node-1',
      governing_start_byte: 0,
      governing_end_byte: sourceBytes.length,
      spans: [{ start_byte: 0, end_byte: sourceBytes.length, text_sha256: spanSha }],
      context_spans: [],
    }],
    dispositions: [],
  };
  writeJson(root, analysisPath, analysis);
  const indexPath = 'fixture/index.json';
  writeJson(root, indexPath, {
    source_binding: { canonical_text: sourceText },
  });
  const m4Path = 'fixture/m4.json';
  writeJson(root, m4Path, { claims: [{ claim_occurrence_id: 'claim-1' }] });
  const contextPath = 'fixture/m3.json';
  writeJson(root, contextPath, {
    agreement_index_binding: { agreement_index_id: 'index-1' },
  });
  const sets = {
    analysisSet: { record: { members: [{
      agreement_id: agreementId,
      agreement_analysis_binding: { path: m4Path },
    }] } },
    indexSet: { record: { members: [{
      agreement_id: agreementId,
      agreement_index_binding: { path: indexPath, record_id: 'index-1' },
    }] } },
    contextSet: { record: { members: [{
      agreement_id: agreementId,
      context_compilation_binding: { path: contextPath },
    }] } },
  };
  const registration = { record: { candidate_registration_id: 'reg-1' } };

  const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'w2-real-text-missing-'));
  const withheld = validateOutputs({ root: missingRoot, registration, sets });
  assert.equal(withheld.failures[0].agreement_id, agreementId);
  assert.equal(withheld.failures[0].code, 'MISSING_ANALYSIS');

  const corrupt = structuredClone(analysis);
  corrupt.source_closures[0].spans[0].text_sha256 = '0'.repeat(64);
  writeJson(root, analysisPath, corrupt);
  const hashed = validateOutputs({ root, registration, sets });
  assert.equal(hashed.failures.some((row) => row.agreement_id === agreementId
    && row.code === 'CLOSURE_HASH'), true);

  const drifted = structuredClone(analysis);
  drifted.governed_input_occurrence_ids = ['claim-changed'];
  writeJson(root, analysisPath, drifted);
  const occurrences = validateOutputs({ root, registration, sets });
  assert.equal(occurrences.failures.some((row) => row.agreement_id === agreementId
    && row.code === 'OCCURRENCE_SET_MISMATCH'), true);
});

test('Work 2 real-text validate refuses synthetic fixture text', async () => {
  const { OUTPUT_ROOT, validateOutputs, writeJson } = await loadLib();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w2-real-text-synth-'));
  const agreementId = 'b'.repeat(64);
  writeJson(root, `${OUTPUT_ROOT}/${agreementId}.agreement-analysis.json`, {
    agreement_id: agreementId,
    governed_input_occurrence_ids: ['claim-1'],
    source_closures: [],
    dispositions: [],
  });
  writeJson(root, 'fixture/index.json', {
    source_binding: { canonical_text: 'shall PartyA and PartyB family shall all_of' },
  });
  writeJson(root, 'fixture/m4.json', { claims: [{ claim_occurrence_id: 'claim-1' }] });
  writeJson(root, 'fixture/m3.json', {
    agreement_index_binding: { agreement_index_id: 'index-1' },
  });
  const result = validateOutputs({
    root,
    registration: { record: { candidate_registration_id: 'reg-1' } },
    sets: {
      analysisSet: { record: { members: [{
        agreement_id: agreementId,
        agreement_analysis_binding: { path: 'fixture/m4.json' },
      }] } },
      indexSet: { record: { members: [{
        agreement_id: agreementId,
        agreement_index_binding: { path: 'fixture/index.json', record_id: 'index-1' },
      }] } },
      contextSet: { record: { members: [{
        agreement_id: agreementId,
        context_compilation_binding: { path: 'fixture/m3.json' },
      }] } },
    },
  });
  assert.equal(result.failures.some((row) => row.agreement_id === agreementId
    && row.code === 'SYNTHETIC_FIXTURE'), true);
});
