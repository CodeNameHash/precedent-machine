const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildDealIdentityAuthorityAttestation,
  IDENTITY_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  buildDealIdentityManifest,
  validateDealIdentityAuthorityAttestation,
  validateDealIdentityManifest,
} = require('../lib/canonical-v2/deal-identity');

const id = (value) => contentId('DEAL_IDENTITY_TEST/V1', value);

function seed(overrides = {}) {
  return {
    kind: 'BEN_APPROVED_IMPORT_IDENTITY',
    authority: 'BEN_FREEZE_GATE',
    value: 'ELI_LILLY_VERVE_2025',
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildDealIdentityManifest({
    immutable_deal_seed: seed(),
    ...overrides,
  });
}

test('builds one closed, deterministic and deeply frozen V1 identity manifest', () => {
  const manifest = build({
    reviewed_supersession_reference_ids: [id('superseded-b'), id('superseded-a')],
  });

  assert.equal(manifest.schema_version, MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.deal_identity_schema_version, IDENTITY_SCHEMA_VERSION);
  assert.deepEqual(manifest.reviewed_supersession_reference_ids, [
    id('superseded-a'),
    id('superseded-b'),
  ].sort());
  assert.equal(validateDealIdentityManifest(manifest), true);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.immutable_deal_seed), true);
  assert.equal(Object.isFrozen(manifest.reviewed_supersession_reference_ids), true);
  assert.equal(
    canonicalJson(manifest),
    canonicalJson(build({
      reviewed_supersession_reference_ids: [id('superseded-a'), id('superseded-b')],
    })),
  );
});

test('governed deal key hashes only identity version and immutable seed', () => {
  const first = build({
    reviewed_supersession_reference_ids: [id('old-identity-a')],
  });
  const second = build({
    reviewed_supersession_reference_ids: [id('old-identity-b')],
  });
  const expected = contentId('GOVERNED_DEAL_KEY/V1', {
    deal_identity_schema_version: IDENTITY_SCHEMA_VERSION,
    immutable_deal_seed: seed(),
  });

  assert.equal(first.governed_deal_key, expected);
  assert.equal(second.governed_deal_key, expected);
  assert.notEqual(first.deal_identity_manifest_id, second.deal_identity_manifest_id);
});

test('party names, dates, document identities and source hashes cannot enter the key seed', () => {
  for (const [field, value] of Object.entries({
    buyer_name: 'Eli Lilly and Company',
    target_name: 'Verve Therapeutics, Inc.',
    agreement_date: '2025-06-16',
    immutable_source_document_id: id('source-document'),
    source_admission_manifest_id: id('source-admission'),
    document_hash: id('document-hash'),
  })) {
    assert.throws(() => build({
      immutable_deal_seed: { ...seed(), [field]: value },
    }), (error) => error.code === 'INVALID_DEAL_IDENTITY');
  }
});

test('rejects application UUIDs presented under application or source-locator authority', () => {
  const applicationUuid = '320a3899-0d74-42d6-a412-3a962997d6ca';
  for (const authority of [
    'APPLICATION_DATABASE',
    'application database',
    'LEGACY_APPLICATION_DB',
    'SOURCE_LOCATOR',
    'legacy-source-locator',
  ]) {
    assert.throws(() => build({
      immutable_deal_seed: seed({
        authority,
        value: applicationUuid,
      }),
    }), (error) => error.code === 'PROHIBITED_DEAL_IDENTITY_AUTHORITY');
  }
  assert.throws(() => build({
    immutable_deal_seed: seed({ value: applicationUuid }),
  }), (error) => error.code === 'PROHIBITED_DEAL_IDENTITY_VALUE');
});

test('accepts only the two governed seed kinds', () => {
  const external = build({
    immutable_deal_seed: seed({
      kind: 'EXTERNAL_TRANSACTION_ID',
      authority: 'REGULATOR_TRANSACTION_REGISTER',
      value: 'TX-2025-0042',
    }),
  });
  assert.equal(validateDealIdentityManifest(external), true);

  for (const kind of ['SOURCE_LOCATOR', 'APPLICATION_DATABASE_ID', '', null]) {
    assert.throws(() => build({
      immutable_deal_seed: seed({ kind }),
    }), (error) => error.code === 'INVALID_DEAL_IDENTITY');
  }
});

test('authority proof is content-addressed separately and does not rekey the deal manifest', () => {
  const manifest = build();
  const first = buildDealIdentityAuthorityAttestation({
    deal_identity_manifest: manifest,
    authority_reference_id: id('ben-approval-v1'),
  });
  const replacement = buildDealIdentityAuthorityAttestation({
    deal_identity_manifest: manifest,
    authority_reference_id: id('ben-approval-v2'),
  });

  assert.equal(first.deal_identity_manifest_id, manifest.deal_identity_manifest_id);
  assert.equal(replacement.deal_identity_manifest_id, manifest.deal_identity_manifest_id);
  assert.equal(first.governed_deal_key, manifest.governed_deal_key);
  assert.equal(replacement.governed_deal_key, manifest.governed_deal_key);
  assert.notEqual(
    first.deal_identity_authority_attestation_id,
    replacement.deal_identity_authority_attestation_id,
  );
  assert.equal(validateDealIdentityAuthorityAttestation({
    attestation: first,
    deal_identity_manifest: manifest,
  }), true);
  assert.throws(() => buildDealIdentityAuthorityAttestation({
    deal_identity_manifest: manifest,
    authority_reference_id: 'short',
  }), (error) => error.code === 'INVALID_DEAL_IDENTITY');
});

test('requires canonical bounded text and unique reviewed supersession references', () => {
  for (const patch of [
    { authority: ' BEN_FREEZE_GATE' },
    { authority: 'BEN_FREEZE_GATE ' },
    { authority: `A${'x'.repeat(160)}` },
    { value: ' VERGE_LILLY_2025' },
    { value: `V${'x'.repeat(512)}` },
    { value: 'VERVE\u0000LILLY' },
  ]) {
    assert.throws(() => build({
      immutable_deal_seed: seed(patch),
    }), (error) => error.code === 'INVALID_DEAL_IDENTITY');
  }
  assert.throws(() => build({
    reviewed_supersession_reference_ids: [id('duplicate'), id('duplicate')],
  }), (error) => error.code === 'DUPLICATE_DEAL_IDENTITY_SUPERSESSION');
});

test('validator rejects tampering, stale IDs, non-canonical ordering and extra fields', () => {
  const manifest = build({
    reviewed_supersession_reference_ids: [id('a'), id('b')],
  });
  const mutations = [
    { ...structuredClone(manifest), governed_deal_key: id('tampered-key') },
    { ...structuredClone(manifest), deal_identity_manifest_id: id('tampered-manifest') },
    {
      ...structuredClone(manifest),
      immutable_deal_seed: {
        ...structuredClone(manifest.immutable_deal_seed),
        value: 'A_DIFFERENT_TRANSACTION',
      },
    },
    {
      ...structuredClone(manifest),
      reviewed_supersession_reference_ids:
        [...manifest.reviewed_supersession_reference_ids].reverse(),
    },
    { ...structuredClone(manifest), application_deal_id: 'legacy-id' },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () => validateDealIdentityManifest(mutation),
      (error) => ['INVALID_DEAL_IDENTITY', 'STALE_DEAL_IDENTITY'].includes(error.code),
    );
  }
});
