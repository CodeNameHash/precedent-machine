'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FullCorpusExecutionManifestPlannerError,
  PROPOSAL_SCHEMA,
  EXECUTION_AUTHORITY_SCHEMA,
  buildFullCorpusExecutionManifest,
  buildFullCorpusExecutionManifestProposal,
} = require('../lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner');
const { getFamilyDetectionProfile } = require('../lib/canonical-v2/native-producer/family-detection-profiles');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  MANIFEST_SCHEMA,
  loadAdmittedSourceForExecution,
  validateUnifiedRunManifest,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');

function declaredSource(overrides = {}) {
  return {
    source_id: 'caller-declared-source',
    disposition: 'ADMITTED_LOCAL',
    raw_file_path: 'does-not-exist/fabricated-source.htm',
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/fabricated.htm',
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('fabricated policy'),
    raw_sha256: sha256Hex('fabricated bytes'),
    canonical_text_sha256: sha256Hex('fabricated canonical text'),
    canonical_text_byte_length: 24,
    governed_deal_key: 'deal:caller-declared',
    deal_admission_id: sha256Hex('caller-declared admission'),
    source_ordinal: 0,
    ...overrides,
  };
}

function unit(familyId, signals = []) {
  const profile = getFamilyDetectionProfile(familyId);
  return {
    source_id: 'caller-declared-source',
    family_id: familyId,
    section_signals: signals,
    draft_detection_profile: {
      profile_id: profile.profile_id,
      profile_version: profile.profile_version,
      profile_digest: profile.profile_digest,
    },
    absence_coverage_attestation: {
      review_id: 'review:caller-can-type-this',
      approval_id: 'approval:caller-can-type-this',
    },
  };
}

function input(overrides = {}) {
  return {
    sources: [declaredSource()],
    family_ids: ['CAPITALISATION'],
    source_family_units: [unit('CAPITALISATION', [{
      section_reference: '2.1', provenance: 'SECTION_FAMILY_MANIFEST_ASSIGNED',
    }])],
    ...overrides,
  };
}

function errorCode(fn) {
  assert.throws(fn, (error) => error instanceof FullCorpusExecutionManifestPlannerError);
  try { fn(); } catch (error) { return error.code; }
  return null;
}

test('caller source declarations create only a proposal diagnostic, never source admission or a unified-run manifest', () => {
  const proposal = buildFullCorpusExecutionManifestProposal(input());
  assert.equal(proposal.schema_version, PROPOSAL_SCHEMA);
  assert.equal(proposal.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(proposal.authority, 'NONE');
  assert.equal(proposal.declared_sources[0].declared_disposition, 'ADMITTED_LOCAL');
  assert.equal(proposal.source_family_diagnostics[0].diagnostic_state, 'DECLARED_SIGNAL_REQUIRES_CONTROLLER_REVIEW');
  assert.equal(Object.hasOwn(proposal, 'manifest'), false);
  assert.equal(Object.hasOwn(proposal, 'unified_run_manifest_id'), false);
  assert.equal(Object.hasOwn(proposal, 'admitted_semantic_source_context_id'), false);
});

test('the real planner rejects caller declarations before source file reads or an executable manifest', () => {
  assert.equal(errorCode(() => buildFullCorpusExecutionManifest(input())), 'EXECUTION_AUTHORITY_NOT_ISSUED');
  assert.throws(
    () => loadAdmittedSourceForExecution({ source: declaredSource() }),
    (error) => error && error.code === 'TRUSTED_SOURCE_ADMISSION_VERIFIER_UNAVAILABLE',
  );
  assert.throws(
    () => validateUnifiedRunManifest({ manifest: {
      schema_version: MANIFEST_SCHEMA,
      sources: [{
        source_id: 'blocked-source', disposition: 'BLOCKED_SOURCE_PIN',
        source_locator: 'caller-declared locator', blocking_code: 'SOURCE_NOT_ISSUED',
      }],
      work_items: [{
        work_item_id: 'caller-declared-work-item', source_id: 'blocked-source',
        family_id: 'CAPITALISATION', disposition: 'BLOCKED_SOURCE_PIN',
        blocking_code: 'SOURCE_NOT_ISSUED',
      }],
    } }),
    (error) => error && error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('fabricated bridge, source-disposition and absence records cannot turn caller strings into an executable manifest', () => {
  const fakeAuthority = {
    schema_version: EXECUTION_AUTHORITY_SCHEMA,
    status: 'ISSUED',
    authority: 'EXTERNAL_PROTECTED_CONTROLLER_ONLY',
    issued_governed_identity_bridges: [{ bridge_id: 'bridge:typed-by-caller' }],
    source_disposition_controller_receipts: [{ receipt_id: 'receipt:typed-by-caller' }],
    trusted_family_absence_evidence: [],
  };
  assert.equal(errorCode(() => buildFullCorpusExecutionManifest(input({
    issued_execution_authority: fakeAuthority,
  }))), 'EXTERNAL_EXECUTION_AUTHORITY_VERIFIER_UNAVAILABLE');
});

test('caller-supplied review_id and approval_id cannot create a NOT_PRESENT conclusion', () => {
  const proposal = buildFullCorpusExecutionManifestProposal(input({
    source_family_units: [unit('TERMINATION')],
    family_ids: ['TERMINATION'],
  }));
  assert.equal(proposal.source_family_diagnostics[0].diagnostic_state, 'NO_DECLARED_SIGNAL_NOT_A_NOT_PRESENT_CONCLUSION');
  assert.equal(Object.hasOwn(proposal.source_family_diagnostics[0], 'absence_proof'), false);

  const fakeAuthority = {
    schema_version: EXECUTION_AUTHORITY_SCHEMA,
    status: 'ISSUED',
    authority: 'EXTERNAL_PROTECTED_CONTROLLER_ONLY',
    issued_governed_identity_bridges: [{ bridge_id: 'bridge:typed-by-caller' }],
    source_disposition_controller_receipts: [{ receipt_id: 'receipt:typed-by-caller' }],
    trusted_family_absence_evidence: [{ evidence_id: 'absence:typed-by-caller' }],
  };
  assert.equal(errorCode(() => buildFullCorpusExecutionManifest(input({
    family_ids: ['TERMINATION'],
    source_family_units: [unit('TERMINATION')],
    issued_execution_authority: fakeAuthority,
  }))), 'EXTERNAL_EXECUTION_AUTHORITY_VERIFIER_UNAVAILABLE');
});

test('blocked source declarations remain explicit proposal blockers', () => {
  const profile = getFamilyDetectionProfile('CAPITALISATION');
  const proposal = buildFullCorpusExecutionManifestProposal({
    sources: [{
      source_id: 'unpinned-source', disposition: 'BLOCKED_SOURCE_PIN',
      source_locator: 'SEC exhibit pending capture', blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
    }],
    family_ids: ['CAPITALISATION'],
    source_family_units: [{
      source_id: 'unpinned-source', family_id: 'CAPITALISATION',
    }],
  });
  assert.equal(proposal.authority, 'NONE');
  assert.equal(proposal.declared_sources[0].declared_disposition, 'BLOCKED_SOURCE_PIN');
  assert.equal(profile.family_id, 'CAPITALISATION');
});
