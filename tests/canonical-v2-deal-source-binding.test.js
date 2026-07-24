const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildDealIdentityAuthorityAttestation,
  buildDealIdentityManifest,
} = require('../lib/canonical-v2/deal-identity');
const {
  buildDealSourceBinding,
  buildDealSourceOrderingDefinition,
  buildDocumentRoleDefinition,
  buildDocumentRoleRegistry,
  buildDocumentRoleRegistryAuthority,
  validateDealSourceBinding,
} = require('../lib/canonical-v2/deal-source-binding');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');

const id = (value) => contentId('DEAL_SOURCE_BINDING_TEST/V1', value);

function fixture() {
  const accession = '0001193125-25-141748';
  const exhibitPath = 'd30505dex21.htm';
  const url = `https://www.sec.gov/Archives/edgar/data/1840574/${accession.replaceAll('-', '')}/${exhibitPath}`;
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: '2026-07-24T21:02:33.849Z',
    retrieval_policy_digest: id('retrieval-policy'),
    redirect_count: 0,
    response_bytes: Buffer.from(
      '<html><body><h1>AGREEMENT AND PLAN OF MERGER</h1><p>Parties agree.</p></body></html>',
      'utf8',
    ),
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const sourceAdmissionBundle = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const dealIdentityManifest = buildDealIdentityManifest({
    immutable_deal_seed: {
      kind: 'BEN_APPROVED_IMPORT_IDENTITY',
      authority: 'BEN_FREEZE_GATE',
      value: 'TEST_IMPORT_IDENTITY_001',
    },
  });
  const dealIdentityAuthorityAttestation = buildDealIdentityAuthorityAttestation({
    deal_identity_manifest: dealIdentityManifest,
    authority_reference_id: id('ben-approval'),
  });
  const roleDefinition = buildDocumentRoleDefinition({
    document_role_key: 'AGREEMENT',
    definition_version: 1,
    contract_fingerprint: id('contract'),
    definition_text: 'The principal transaction agreement.',
    required_text_anchors: ['AGREEMENT AND PLAN OF MERGER'],
  });
  const orderingDefinition = buildDealSourceOrderingDefinition({ definition_version: 1 });
  const roleRegistry = buildDocumentRoleRegistry({
    contract_fingerprint: id('contract'),
    document_role_definitions: [roleDefinition],
  });
  const roleRegistryAuthority = buildDocumentRoleRegistryAuthority({
    document_role_registry: roleRegistry,
    freeze_gate_attestation_id: id('freeze-gate'),
    ben_approval_id: id('role-registry-ben-approval'),
  });
  const sourceLocator = {
    source_system: 'SEC_EDGAR',
    issuer_cik: '1840574',
    accession,
    source_version: null,
    exhibit_path: exhibitPath,
    retrieval_url_sha256: capture.retrieval_url_sha256,
    source_admission_manifest_id:
      sourceAdmissionBundle.source_admission_manifest.source_admission_manifest_id,
  };
  const canonicalBytes = Buffer.from(conversion.canonical_text, 'utf8');
  const anchor = Buffer.from('AGREEMENT AND PLAN OF MERGER', 'utf8');
  const start = canonicalBytes.indexOf(anchor);
  assert.ok(start >= 0);
  const roleEvidenceSpans = [{
    start,
    end: start + anchor.length,
    text_sha256: sha256Hex(anchor),
  }];
  const input = {
    deal_identity_manifest: dealIdentityManifest,
    deal_identity_authority_attestation: dealIdentityAuthorityAttestation,
    capture,
    conversion,
    verification,
    source_admission_bundle: sourceAdmissionBundle,
    source_locator: sourceLocator,
    document_role_registry: roleRegistry,
    document_role_registry_authority: roleRegistryAuthority,
    document_role_key: 'AGREEMENT',
    role_evidence_spans: roleEvidenceSpans,
    ordering_definition: orderingDefinition,
  };
  return {
    ...input,
    input,
    dealIdentityManifest,
    roleDefinition,
    roleRegistry,
    roleRegistryAuthority,
    orderingDefinition,
    sourceLocator,
    roleEvidenceSpans,
  };
}

test('builds one exact source-backed binding without certifying the document universe', () => {
  const { input } = fixture();
  const binding = buildDealSourceBinding(input);

  assert.equal(binding.document_universe_status, 'NOT_CERTIFIED');
  assert.equal(binding.deal_wide_absence_status, 'BLOCKED');
  assert.equal(binding.source_ordinal, null);
  assert.equal(
    binding.source_ordinal_status,
    'BLOCKED_PENDING_CERTIFIED_DOCUMENT_UNIVERSE',
  );
  assert.equal(binding.document_role_key, 'AGREEMENT');
  assert.equal(
    binding.document_hash,
    input.source_admission_bundle.immutable_source_document.response_bytes_sha256,
  );
  assert.equal(binding.canonical_text_sha256, input.conversion.canonical_text_sha256);
  assert.notEqual(binding.document_hash, binding.canonical_text_sha256);
  assert.equal(validateDealSourceBinding({ binding, ...input }), true);
  assert.equal(Object.isFrozen(binding), true);
  assert.equal(Object.isFrozen(binding.role_evidence), true);
});

test('role evidence must match exact canonical bytes and the governed role anchors', () => {
  const { input, roleEvidenceSpans } = fixture();
  for (const role_evidence_spans of [
    [{ ...roleEvidenceSpans[0], start: roleEvidenceSpans[0].start + 1 }],
    [{ ...roleEvidenceSpans[0], text_sha256: id('wrong-evidence') }],
    [],
  ]) {
    assert.throws(
      () => buildDealSourceBinding({ ...input, role_evidence_spans }),
      (error) => ['INVALID_ROLE_EVIDENCE', 'ROLE_EVIDENCE_MISMATCH'].includes(error.code),
    );
  }
  const unsupportedRole = buildDocumentRoleDefinition({
    document_role_key: 'PRESS_RELEASE',
    definition_version: 1,
    contract_fingerprint: id('contract'),
    definition_text: 'A transaction announcement.',
    required_text_anchors: ['FOR IMMEDIATE RELEASE'],
  });
  assert.throws(() => buildDealSourceBinding({
    ...input,
    document_role_key: unsupportedRole.document_role_key,
  }), (error) => error.code === 'DOCUMENT_ROLE_NOT_GOVERNED');
});

test('raw and canonical hashes, admitted lineage and identities cannot be substituted', () => {
  const { input } = fixture();
  const binding = buildDealSourceBinding(input);
  const mutations = [
    { document_hash: binding.canonical_text_sha256 },
    { canonical_text_sha256: binding.document_hash },
    { immutable_source_document_id: id('other-source') },
    { source_admission_manifest_id: id('other-admission') },
    { source_admission_preparation_receipt_id: id('other-preparation') },
    { semantic_extraction_input_envelope_id: id('other-envelope') },
    { verification_manifest_id: id('other-verification') },
    { governed_deal_key: id('caller-chosen-deal') },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => validateDealSourceBinding({
        binding: { ...structuredClone(binding), ...mutation },
        ...input,
      }),
      (error) => error.code === 'STALE_DEAL_SOURCE_BINDING',
    );
  }
});

test('binding cannot invent an ordinal before the complete document universe is certified', () => {
  const { input } = fixture();
  const binding = buildDealSourceBinding(input);
  for (const source_ordinal of [0, 1, 2]) {
    assert.throws(() => validateDealSourceBinding({
      binding: { ...structuredClone(binding), source_ordinal },
      ...input,
    }), (error) => error.code === 'STALE_DEAL_SOURCE_BINDING');
  }
  assert.throws(
    () => buildDealSourceBinding({ ...input, known_sources: [] }),
    (error) => error.code === 'INVALID_DEAL_SOURCE_BINDING',
  );
});

test('role, evidence, ordering and deal identity changes rekey the binding', () => {
  const { input, roleEvidenceSpans, roleDefinition } = fixture();
  const original = buildDealSourceBinding(input);
  const transactionRole = buildDocumentRoleDefinition({
    document_role_key: 'TRANSACTION_AGREEMENT',
    definition_version: 1,
    contract_fingerprint: id('contract'),
    definition_text: 'A principal agreement governing a transaction.',
    required_text_anchors: ['AGREEMENT AND PLAN OF MERGER'],
  });
  const expandedRegistry = buildDocumentRoleRegistry({
    contract_fingerprint: id('contract'),
    document_role_definitions: [roleDefinition, transactionRole],
  });
  const expandedRegistryAuthority = buildDocumentRoleRegistryAuthority({
    document_role_registry: expandedRegistry,
    freeze_gate_attestation_id: id('freeze-gate'),
    ben_approval_id: id('expanded-role-registry-ben-approval'),
  });
  const changedRole = buildDealSourceBinding({
    ...input,
    document_role_registry: expandedRegistry,
    document_role_registry_authority: expandedRegistryAuthority,
    document_role_key: transactionRole.document_role_key,
  });
  const changedOrdering = buildDealSourceBinding({
    ...input,
    ordering_definition: buildDealSourceOrderingDefinition({ definition_version: 2 }),
  });
  const expandedEvidence = buildDealSourceBinding({
    ...input,
    role_evidence_spans: [{
      ...roleEvidenceSpans[0],
      end: roleEvidenceSpans[0].end + 1,
      text_sha256: sha256Hex(
        Buffer.from(input.conversion.canonical_text, 'utf8').subarray(
          roleEvidenceSpans[0].start,
          roleEvidenceSpans[0].end + 1,
        ),
      ),
    }],
  });

  assert.notEqual(original.deal_source_binding_id, changedRole.deal_source_binding_id);
  assert.notEqual(original.deal_source_binding_id, changedOrdering.deal_source_binding_id);
  assert.notEqual(original.deal_source_binding_id, expandedEvidence.deal_source_binding_id);
});

test('an internally consistent but unauthorised replacement role registry is rejected', () => {
  const { input, roleDefinition } = fixture();
  const invented = buildDocumentRoleDefinition({
    document_role_key: 'PRESS_RELEASE',
    definition_version: 1,
    contract_fingerprint: id('contract'),
    definition_text: 'Invented role with a misleading anchor.',
    required_text_anchors: ['AGREEMENT AND PLAN OF MERGER'],
  });
  const replacementRegistry = buildDocumentRoleRegistry({
    contract_fingerprint: id('contract'),
    document_role_definitions: [roleDefinition, invented],
  });
  assert.throws(() => buildDealSourceBinding({
    ...input,
    document_role_registry: replacementRegistry,
    document_role_key: invented.document_role_key,
  }), (error) => error.code === 'STALE_DOCUMENT_ROLE_REGISTRY_AUTHORITY');
});

test('caller-supplied deal keys, display data and hand-written ordinals are rejected', () => {
  const { input } = fixture();
  for (const extra of [
    { governed_deal_key: 'deal:verve-lilly' },
    { application_deal_id: '320a3899-0d74-42d6-a412-3a962997d6ca' },
    { buyer_name: 'Eli Lilly and Company' },
    { target_name: 'Verve Therapeutics, Inc.' },
    { source_ordinal: 1 },
    { known_sources: [] },
  ]) {
    assert.throws(
      () => buildDealSourceBinding({ ...input, ...extra }),
      (error) => error.code === 'INVALID_DEAL_SOURCE_BINDING',
    );
  }
});
