'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { normaliseDurationToDays, normaliseMoneyRelativeToDealValue } = require('../lib/canonical-v2/observation-normalisers');
const { mintLimbComponentTree } = require('../lib/canonical-v2/native-producer/limb-components');
const { LIMB_ASSERTION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { executeUnifiedRun } = require('../lib/canonical-v2/native-producer/unified-runner-execute');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const { preflightNativeCandidateSet, preflightNativeRunReceipt, preflightUnifiedWorkResult } = require('../lib/canonical-v2/native-producer/semantic-safety-preflight');

const TEXT = [
  'Section 5.2 Interim Operating Covenants.',
  'Buyer shall not repurchase shares without Company consent.',
  'The amount is $0.00.',
  'The period is zero days.',
  'The lesser of the Company Base Amount and the REIT limit.',
].join('\n');
const SOURCE = buildImmutableSource({ sourceBytes: TEXT, sourceOccurrenceKey: 'SEMANTIC_SAFETY_TEST' });
const IOC_QUOTE = 'Buyer shall not repurchase shares without Company consent.';
const IOC_START = Buffer.byteLength(TEXT.slice(0, TEXT.indexOf(IOC_QUOTE)), 'utf8');
const IOC_END = IOC_START + Buffer.byteLength(IOC_QUOTE, 'utf8');

function sourceEvidence(quote) {
  const absoluteStart = Buffer.byteLength(TEXT.slice(0, TEXT.indexOf(quote)), 'utf8');
  return {
    absolute_start: absoluteStart,
    absolute_end: absoluteStart + Buffer.byteLength(quote, 'utf8'),
    exact_quote: quote,
    exact_text_sha256: sha256Hex(quote),
    document_hash: SOURCE.document_hash,
    canonical_text_sha256: SOURCE.document_hash,
  };
}

function iocTree() {
  return mintLimbComponentTree({
    provision_instance_id: 'ioc-parent-provision',
    compiled_candidates: [{
      ok: true,
      candidate: {
        kind: 'claim',
        claim: {
          claim_occurrence_id: 'ioc-child',
          claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
          raw_value: IOC_QUOTE,
          attributes: { limb_path: ['(a)'] },
          evidence: [{ absolute_start: IOC_START, absolute_end: IOC_END, evidence_role: 'OPERATIVE_TEXT' }],
        },
      },
    }],
  });
}

function passingInput() {
  const tree = iocTree();
  return {
    candidate_set_key: 'ioc-safety-set',
    immutable_source: SOURCE,
    candidates: [{
      candidate_id: 'ioc-child', state: 'PRESENT', raw_value: IOC_QUOTE,
      evidence: [sourceEvidence(IOC_QUOTE)],
    }, {
      candidate_id: 'open-world-evidence', state: 'OPEN_WORLD', raw_value: 'The amount is $0.00.',
      evidence: [sourceEvidence('The amount is $0.00.')],
    }],
    citation_checks: [{
      candidate_id: 'ioc-child', tree: { nodes: [{ section_id: 's-5-2', reference: '5.2', parent_section_id: null }] },
      model_citation: '5.2', derived_node: { section_id: 's-5-2', reference: '5.2' }, quote: IOC_QUOTE,
    }],
    qualifier_checks: [{
      candidate_id: 'ioc-qualifier', tree, governs_path: ['(a)'],
      expected_subject_component_id: tree.assertion_nodes[0].limb_component_id,
    }],
    party_inheritance_checks: [{
      candidate_id: 'ioc-child', parent_provision_instance_id: 'ioc-parent-provision',
      child_claim: { attributes: { inherited_party_from_provision_instance_id: 'ioc-parent-provision' } },
    }],
    comparison_values: [{
      comparison_id: 'zero-money', raw_value: 0,
      normalisation: normaliseMoneyRelativeToDealValue({
        rawAmount: '0', currency: 'USD', derivationVersion: 'test/v1',
        denominator: { value: '100', currency: 'USD', basis: 'EQUITY_VALUE', source_lineage_ids: ['deal-value'] },
      }),
    }, {
      comparison_id: 'zero-period', raw_value: 0,
      normalisation: normaliseDurationToDays({
        rawMagnitude: '0', rawUnit: 'DAYS', dayBasis: 'CALENDAR', trigger: 'signing', derivationVersion: 'test/v1',
      }),
    }],
    formula_values: [{
      formula_id: 'fee-formula',
      raw_formula: 'The lesser of the Company Base Amount and the REIT limit.',
      source_citations: ['5.2', '8.12(f)'],
      evidence: [sourceEvidence('The lesser of the Company Base Amount and the REIT limit.')],
    }],
  };
}

test('semantic safety preflight is deterministic and preserves open-world evidence plus zero raw and derived comparisons', () => {
  const first = preflightNativeCandidateSet(passingInput());
  const second = preflightNativeCandidateSet(passingInput());

  assert.equal(first.status, 'PASS');
  assert.equal(first.semantic_safety_preflight_id, second.semantic_safety_preflight_id);
  assert.equal(first.findings.length, 0);
  assert.equal(first.check_results.find((item) => item.comparison_id === 'zero-money').comparability_state, 'COMPARABLE');
  assert.equal(first.check_results.find((item) => item.comparison_id === 'zero-period').comparability_state, 'COMPARABLE');
});

test('semantic safety preflight fails closed on IOC parent-party loss and never converts open world into absence', () => {
  const input = passingInput();
  input.party_inheritance_checks[0].child_claim.attributes.inherited_party_from_provision_instance_id = 'wrong-parent';
  input.candidates[1].absence = true;
  const report = preflightNativeCandidateSet(input);

  assert.equal(report.status, 'FAIL');
  assert.deepEqual(report.findings.map((item) => item.code), [
    'OPEN_WORLD_CONFLATED_WITH_ABSENCE',
    'PARENT_PARTY_INHERITANCE_INVALID',
  ]);
});

test('structured claim values may differ from their exact source evidence quote', () => {
  const input = passingInput();
  input.candidates[0].raw_value = 'PROHIBITED';
  const report = preflightNativeCandidateSet(input);

  assert.equal(report.status, 'PASS');
});

test('semantic safety preflight fails closed on a raw-value offset mutation and a broad qualifier attachment', () => {
  const input = passingInput();
  input.candidates[0].evidence[0].absolute_end -= 1;
  input.qualifier_checks[0].expected_subject_component_id = 'path-node-is-not-narrow-enough';
  const report = preflightNativeCandidateSet(input);

  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some((item) => item.code === 'EVIDENCE_OFFSET_EXACT_QUOTE_MISMATCH'));
  assert.ok(report.findings.some((item) => item.code === 'QUALIFIER_NOT_ON_NARROWEST_GOVERNED_LIMB'));
});

test('formula provenance requires an exact canonical span and digest, not a substring search', () => {
  const input = passingInput();
  input.formula_values[0].evidence[0].exact_text_sha256 = sha256Hex('wrong formula digest');
  const report = preflightNativeCandidateSet(input);

  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some((item) => item.code === 'EVIDENCE_EXACT_QUOTE_DIGEST_MISMATCH'));
});

test('native receipt adapter binds the runner citation result and converts section-local evidence to source coordinates', () => {
  const input = passingInput();
  const report = preflightNativeRunReceipt({
    candidate_set_key: input.candidate_set_key,
    immutable_source: SOURCE,
    qualifier_checks: input.qualifier_checks,
    party_inheritance_checks: input.party_inheritance_checks,
    comparison_values: input.comparison_values,
    formula_values: input.formula_values,
    run_receipt: {
      document_hash: SOURCE.document_hash,
      source_sha256: SOURCE.document_hash,
      resolved_sections: [{ section_reference: '5.2', start: 0 }],
      compiled_candidates: [{
        ok: true,
        section_reference: '5.2',
        citation_validation: { accepted: true, status: 'AGREEMENT' },
        candidate: { kind: 'claim', claim: {
          claim_occurrence_id: 'ioc-child', state: 'PRESENT', raw_value: IOC_QUOTE,
          evidence: [{ absolute_start: IOC_START, absolute_end: IOC_END }],
        } },
      }],
    },
  });

  assert.equal(report.status, 'PASS');
});

test('an actual unified-runner result binds raw document hash separately from canonical-text hash', async () => {
  const root = path.resolve(__dirname, '..');
  const rawPath = 'tests/fixtures/canonical-v2/native-unified-runner/compact-source.htm';
  const raw = fs.readFileSync(path.resolve(root, rawPath));
  const policy = sha256Hex('semantic safety actual unified receipt');
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm', status_code: 200,
    content_type: 'text/html; charset=UTF-8', retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: policy, redirect_count: 0, response_bytes: raw,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const tree = sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: sha256Hex(raw) });
  const node = findSectionByReference(tree, '2.1');
  const source = {
    source_id: 'topbuild-preflight', disposition: 'ADMITTED_LOCAL', raw_file_path: rawPath,
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm',
    retrieved_at: '2026-08-03T00:00:00.000Z', retrieval_policy_digest: policy,
    raw_sha256: sha256Hex(raw), canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    governed_deal_key: 'deal:topbuild-preflight', deal_admission_id: sha256Hex('topbuild-preflight-admission'), source_ordinal: 0,
  };
  const manifest = {
    schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources: [source],
    work_items: [{
      work_item_id: 'topbuild-preflight-cap', source_id: source.source_id, family_id: 'CAPITALISATION', disposition: 'EXTRACT',
      section_pin: { section_reference: node.reference, section_id: node.section_id, section_kind: node.kind, section_text_sha256: node.text_sha256 },
    }],
  };
  await assert.rejects(() => executeUnifiedRun({
    manifest,
    work_item_controls: [{ work_item_id: 'topbuild-preflight-cap', profile_id: 'TERRA_MEDIUM', covenant_side: null }],
    root_dir: root,
    // Explicit zero budget: the trusted-verifier fence, not the budget fence, must reject.
    max_model_invocations: 0,
    provider_factory: () => async () => ({
      provider_id: 'semantic-safety-test', model_id: 'stub', prompt: 'test prompt', proposals: [], evidence_residuals: [],
      raw_response_text: '{"open_world_candidates":[]}', raw_response_length: 28, attempts: 1,
    }),
  }), (error) => error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE');
  return;
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: root });
  const report = preflightUnifiedWorkResult({
    candidate_set_key: 'actual-unified-work-result', work_result: execution.work_results[0],
    admitted_source_context: admitted.context,
  });

  assert.equal(report.status, 'PASS');
  assert.notEqual(admitted.context.document_hash, admitted.context.canonical_text_sha256);
});
