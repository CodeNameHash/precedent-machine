const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  COMPILER_INPUT_SCHEMA_VERSION,
  GENERATOR_INPUT_SCHEMA_VERSION,
  IDENTITY_DOMAIN,
  MANIFEST_SCHEMA_VERSION,
  REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  REQUIRED_KIND_REGISTRY_SCHEMA_VERSION,
  REQUIRED_KIND_REGISTRY_STABLE_ID,
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');

function member(objectKind, stableId, schemaVersion, value = {}) {
  return {
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: schemaVersion,
    ...value,
  };
}

function canonicalDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function declarations(valuesByPath) {
  return Object.entries(valuesByPath)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([relativePath, value]) => ({
      relative_path: relativePath,
      object_kind: value.object_kind,
      stable_id: value.stable_id,
      schema_version: value.schema_version,
      canonical_bytes_digest: canonicalDigest(value),
    }));
}

function perKind(declaredMembers) {
  const counts = {};
  const versions = {};
  for (const entry of declaredMembers) {
    counts[entry.object_kind] = (counts[entry.object_kind] || 0) + 1;
    versions[entry.object_kind] ||= [];
    if (!versions[entry.object_kind].includes(entry.schema_version)) {
      versions[entry.object_kind].push(entry.schema_version);
      versions[entry.object_kind].sort();
    }
  }
  return {
    counts: Object.fromEntries(Object.entries(counts).sort()),
    versions: Object.fromEntries(Object.entries(versions).sort()),
  };
}

function refreshManifest(state) {
  state.manifest.members = declarations(state.valuesByPath);
  const kinds = perKind(state.manifest.members);
  state.manifest.per_kind_counts = kinds.counts;
  state.manifest.per_kind_schema_versions = kinds.versions;
}

function requirement(
  objectKind,
  allowedSchemaVersions,
  minimumCount = 1,
  maximumCount = minimumCount,
) {
  return {
    object_kind: objectKind,
    minimum_count: minimumCount,
    maximum_count: maximumCount,
    allowed_schema_versions: allowedSchemaVersions,
  };
}

function addRequiredKindRegistry(state, requiredKinds = null) {
  state.valuesByPath['governance/required-kinds.json'] = member(
    REQUIRED_KIND_REGISTRY_OBJECT_KIND,
    REQUIRED_KIND_REGISTRY_STABLE_ID,
    REQUIRED_KIND_REGISTRY_SCHEMA_VERSION,
    {
      required_kinds: requiredKinds || [
        requirement(
          REQUIRED_KIND_REGISTRY_OBJECT_KIND,
          [REQUIRED_KIND_REGISTRY_SCHEMA_VERSION],
          1,
          1,
        ),
        requirement('CLAIM_DEFINITION', ['CLAIM_DEFINITION/V1']),
        requirement('PROVISION_CONCEPT', ['PROVISION_CONCEPT/V1'], 2, 2),
      ],
    },
  );
  refreshManifest(state);
}

function writeJson(root, relativePath, value, pretty = false) {
  const file = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pretty ? `${JSON.stringify(value, null, 2)}\n` : canonicalJson(value));
}

function fixture(mutator = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-bundle-input-'));
  const valuesByPath = {
    'claims/knowledge.json': member(
      'CLAIM_DEFINITION',
      'KNOWLEDGE_QUALIFIER',
      'CLAIM_DEFINITION/V1',
      { canonical_value_type: 'BOOLEAN' },
    ),
    'concepts/no-shop.json': member(
      'PROVISION_CONCEPT',
      'NOSOL-PROHIBIT',
      'PROVISION_CONCEPT/V1',
      { family: 'NO_SHOP' },
    ),
    'concepts/termination-fee.json': member(
      'PROVISION_CONCEPT',
      'TERMF-TARGET',
      'PROVISION_CONCEPT/V1',
      { family: 'TERMINATION_FEE' },
    ),
  };
  let manifestMembers = declarations(valuesByPath);
  const kinds = perKind(manifestMembers);
  const state = {
    root,
    valuesByPath,
    manifest: {
      schema_version: MANIFEST_SCHEMA_VERSION,
      compiler_input_schema_version: COMPILER_INPUT_SCHEMA_VERSION,
      generator_input_schema_version: GENERATOR_INPUT_SCHEMA_VERSION,
      members: manifestMembers,
      per_kind_counts: kinds.counts,
      per_kind_schema_versions: kinds.versions,
    },
  };
  mutator(state);
  manifestMembers = state.manifest.members;
  for (const [relativePath, value] of Object.entries(state.valuesByPath)) {
    writeJson(root, relativePath, value, relativePath === 'concepts/no-shop.json');
  }
  writeJson(root, 'manifest.json', state.manifest, true);
  return root;
}

function agreementNavigationCompilerFixture(mutator) {
  const sourceRoot = path.join(
    __dirname,
    '../contracts/canonical-v2/successor',
  );
  const sourcePaths = [
    'agreement/navigation/qxo-capitalisation-navigation-definition-catalogue.v1.json',
    'agreement/predicates/qxo-capex-restriction-predicate-catalogue.v1.json',
    'agreement/predicates/qxo-capitalisation-representation-predicate-catalogue.v1.json',
    'agreement/result-definitions/target-capex-restriction.v1.json',
    'agreement/result-definitions/target-capitalisation-bring-down.v3.json',
    'agreement/serving-exact-detail-action-definitions/result-composition-evidence.v1.json',
  ];
  return fixture((state) => {
    for (const relativePath of sourcePaths) {
      state.valuesByPath[relativePath] = JSON.parse(
        fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8'),
      );
    }
    mutator(state.valuesByPath);
    refreshManifest(state);
  });
}

function noShopSchemaFixture(mutator = () => {}) {
  return fixture((state) => {
    const value = member(
      'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
      'NO_SHOP_ACTION_OCCURRENCE',
      'NO_SHOP_SEMANTIC_SCHEMA_INPUT/V1',
      {
        authored_schema: {
          schema_key: 'NO_SHOP_ACTION_OCCURRENCE',
          schema_version: 1,
          record_schema: 'NO_SHOP_ACTION_OCCURRENCE/V1',
        },
      },
    );
    mutator(value);
    state.valuesByPath['schemas/no-shop-action-occurrence.json'] = value;
    refreshManifest(state);
  });
}

function servingMetricBindingFixture(mutator = () => {}) {
  return fixture((state) => {
    const value = member(
      'SERVING_METRIC_OPERATION_BINDING_INPUT',
      'TEST_METRIC_BINDING/V2',
      'SERVING_METRIC_OPERATION_BINDING_INPUT/V1',
      {
        authored_binding: {
          binding_key: 'TEST_METRIC_BINDING/V2',
          metric_version: 1,
          trigger_path_schema_version: 2,
        },
      },
    );
    mutator(value);
    state.valuesByPath['migration-inputs/test-metric-binding.json'] = value;
    refreshManifest(state);
  });
}

function servingTriggerPathSchemaFixture(mutator = () => {}) {
  return fixture((state) => {
    const value = member(
      'SERVING_TRIGGER_PATH_SCHEMA_INPUT',
      'TEST_TRIGGER_PATH',
      'SERVING_TRIGGER_PATH_SCHEMA_INPUT/V1',
      {
        authored_schema: {
          schema_key: 'TEST_TRIGGER_PATH',
          schema_version: 2,
        },
      },
    );
    mutator(value);
    state.valuesByPath['migration-inputs/test-trigger-path.json'] = value;
    refreshManifest(state);
  });
}

function codebookMigrationFixture(
  objectKind,
  stableId,
  orderedField,
  mutator = () => {},
) {
  return fixture((state) => {
    const value = member(
      objectKind,
      stableId,
      `${objectKind}/V1`,
      {
        authority: 'MIGRATION_INPUT_ONLY',
        source_fixture: 'FIXTURE_CONTRACT_INPUT_V12',
        [orderedField]: ['SECOND', 'FIRST'],
      },
    );
    mutator(value);
    state.valuesByPath[`migration-inputs/${objectKind.toLowerCase()}.json`] = value;
    refreshManifest(state);
  });
}

function expectCode(code) {
  return (error) => error?.code === code;
}

test('compiles a closed authored JSON set twice to byte-identical input identity', (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const first = compileCanonicalContractInput({ root_directory: root });
  const second = compileCanonicalContractInput({ root_directory: root });
  const identity = first.canonical_bundle_input_identity;
  const {
    canonical_bundle_input_identity_id: identityId,
    canonical_payload_digest: _identityPayloadDigest,
    ...identityBody
  } = identity;

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    identityId,
    contentId(IDENTITY_DOMAIN, identityBody),
  );
  assert.deepEqual(
    identity.ordered_entries.map((entry) => entry.relative_path),
    [
      'claims/knowledge.json',
      'concepts/no-shop.json',
      'concepts/termination-fee.json',
    ],
  );
  assert.deepEqual(identity.per_kind_counts, {
    CLAIM_DEFINITION: 1,
    PROVISION_CONCEPT: 2,
  });
  assert.deepEqual(identity.per_kind_schema_versions, {
    CLAIM_DEFINITION: ['CLAIM_DEFINITION/V1'],
    PROVISION_CONCEPT: ['PROVISION_CONCEPT/V1'],
  });
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.reason_code, 'GOVERNED_REQUIRED_KIND_REGISTRY_NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.deepEqual(first.authored_universe_assessment, {
    schema_version: 'CANONICAL_BUNDLE_INPUT_UNIVERSE_ASSESSMENT/V1',
    status: 'NOT_ASSESSED',
    required_kind_registry_binding: null,
    ordered_kind_results: [],
  });
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authored_members[0].canonical_value), true);
});

test('root compiler rejects Agreement predicate semantic drift', (t) => {
  const root = agreementNavigationCompilerFixture((valuesByPath) => {
    valuesByPath[
      'agreement/predicates/qxo-capitalisation-representation-predicate-catalogue.v1.json'
    ].definition.invented_authority = true;
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    expectCode('INVALID_AGREEMENT_REPRESENTATION_PREDICATE_INPUT'),
  );
});

test('root compiler rejects Agreement navigation semantic drift', (t) => {
  const root = agreementNavigationCompilerFixture((valuesByPath) => {
    valuesByPath[
      'agreement/navigation/qxo-capitalisation-navigation-definition-catalogue.v1.json'
    ].definition.invented_authority = true;
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    expectCode('INVALID_AGREEMENT_NAVIGATION_CATALOGUE_INPUT'),
  );
});

test('accepts a valid no-shop semantic schema input envelope', (t) => {
  const root = noShopSchemaFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const compiled = compileCanonicalContractInput({ root_directory: root });
  const member = compiled.authored_members.find(
    (entry) => entry.object_kind === 'NO_SHOP_SEMANTIC_SCHEMA_INPUT',
  );

  assert.equal(member.stable_id, 'NO_SHOP_ACTION_OCCURRENCE');
  assert.equal(member.canonical_value.authored_schema.schema_version, 1);
});

test('rejects mutated no-shop semantic schema input envelopes', (t) => {
  const mutations = [
    (value) => {
      value.stable_id = 'NO_SHOP_WRONG_KEY';
    },
    (value) => {
      value.schema_version = 'NO_SHOP_SEMANTIC_SCHEMA_INPUT/V2';
    },
    (value) => {
      value.authored_schema.schema_key = '';
    },
    (value) => {
      value.authored_schema.schema_version = 0;
    },
    (value) => {
      value.authored_schema.schema_version = 1.5;
    },
    (value) => {
      value.semantic_schema_definition_id = 'generated';
    },
    (value) => {
      value.semantic_schema_definition_payload_digest = 'generated';
    },
  ];

  for (const mutate of mutations) {
    const root = noShopSchemaFixture(mutate);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    assert.throws(
      () => compileCanonicalContractInput({ root_directory: root }),
      expectCode('INVALID_CANONICAL_BUNDLE_NO_SHOP_SEMANTIC_SCHEMA_INPUT'),
    );
  }
});

test('accepts serving migration inputs and preserves authored list order', (t) => {
  const roots = [
    servingMetricBindingFixture(),
    servingTriggerPathSchemaFixture(),
    codebookMigrationFixture(
      'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT',
      'FIXTURE_CONTRACT_INPUT_V12_CLAIM_STATES',
      'ordered_values',
    ),
  ];
  for (const root of roots) {
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  }

  const metric = compileCanonicalContractInput({ root_directory: roots[0] })
    .authored_members.find(
      (entry) => entry.object_kind === 'SERVING_METRIC_OPERATION_BINDING_INPUT',
    );
  const trigger = compileCanonicalContractInput({ root_directory: roots[1] })
    .authored_members.find(
      (entry) => entry.object_kind === 'SERVING_TRIGGER_PATH_SCHEMA_INPUT',
    );
  const codebook = compileCanonicalContractInput({ root_directory: roots[2] })
    .authored_members.find(
      (entry) => entry.object_kind === 'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT',
    );

  assert.equal(metric.canonical_value.authored_binding.metric_version, 1);
  assert.equal(trigger.canonical_value.authored_schema.schema_version, 2);
  assert.deepEqual(codebook.canonical_value.ordered_values, ['SECOND', 'FIRST']);
});

test('rejects mutated serving metric-operation binding inputs', (t) => {
  const mutations = [
    (value) => {
      value.stable_id = 'WRONG_BINDING/V2';
    },
    (value) => {
      value.schema_version = 'SERVING_METRIC_OPERATION_BINDING_INPUT/V2';
    },
    (value) => {
      value.authored_binding.binding_key = '';
    },
    (value) => {
      value.authored_binding.metric_version = 0;
    },
    (value) => {
      value.authored_binding.metric_version = 1.5;
    },
    (value) => {
      value.authored_binding.trigger_path_schema_version = 0;
    },
    (value) => {
      value.authored_binding.trigger_path_schema_version = 1.5;
    },
    (value) => {
      value.metric_operation_binding_definition_id = 'generated';
    },
  ];

  for (const mutate of mutations) {
    const root = servingMetricBindingFixture(mutate);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    assert.throws(
      () => compileCanonicalContractInput({ root_directory: root }),
      expectCode('INVALID_CANONICAL_BUNDLE_SERVING_METRIC_OPERATION_BINDING_INPUT'),
    );
  }
});

test('rejects mutated serving trigger-path schema inputs', (t) => {
  const mutations = [
    (value) => {
      value.stable_id = 'WRONG_TRIGGER_PATH';
    },
    (value) => {
      value.schema_version = 'SERVING_TRIGGER_PATH_SCHEMA_INPUT/V2';
    },
    (value) => {
      value.authored_schema.schema_key = '';
    },
    (value) => {
      value.authored_schema.schema_version = 0;
    },
    (value) => {
      value.authored_schema.schema_version = 1.5;
    },
    (value) => {
      value.trigger_path_schema_definition_id = 'generated';
    },
  ];

  for (const mutate of mutations) {
    const root = servingTriggerPathSchemaFixture(mutate);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    assert.throws(
      () => compileCanonicalContractInput({ root_directory: root }),
      expectCode('INVALID_CANONICAL_BUNDLE_SERVING_TRIGGER_PATH_SCHEMA_INPUT'),
    );
  }
});

test('rejects mutated codebook and tuple-shape migration inputs', (t) => {
  const configs = [
    [
      'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT',
      'FIXTURE_CONTRACT_INPUT_V12_CLAIM_STATES',
      'ordered_values',
    ],
    [
      'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
      'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
      'ordered_fields',
    ],
    [
      'RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT',
      'FIXTURE_CONTRACT_INPUT_V12_RESIDUAL_REASON_CODES',
      'ordered_values',
    ],
  ];
  const mutations = [
    (value) => {
      value.schema_version = `${value.object_kind}/V2`;
    },
    (value) => {
      value.stable_id = 'WRONG_STABLE_ID';
    },
    (value) => {
      value.source_fixture = 'OTHER_FIXTURE';
    },
    (value) => {
      value.authority = 'FINAL_CODEBOOK';
    },
    (value, orderedField) => {
      value[orderedField] = [];
    },
    (value, orderedField) => {
      value[orderedField] = ['VALID', ''];
    },
    (value, orderedField) => {
      value[orderedField] = ['DUPLICATE', 'DUPLICATE'];
    },
    (value) => {
      value.definition_id = 'generated';
    },
  ];

  for (const [objectKind, stableId, orderedField] of configs) {
    for (const mutate of mutations) {
      const root = codebookMigrationFixture(
        objectKind,
        stableId,
        orderedField,
        (value) => mutate(value, orderedField),
      );
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      assert.throws(
        () => compileCanonicalContractInput({ root_directory: root }),
        expectCode(`INVALID_CANONICAL_BUNDLE_${objectKind}`),
      );
    }
  }
});

test('mechanically closes the authored kind universe without claiming bundle or gate authority', (t) => {
  const root = fixture((state) => addRequiredKindRegistry(state));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const first = compileCanonicalContractInput({ root_directory: root });
  const second = compileCanonicalContractInput({ root_directory: root });
  const assessment = first.authored_universe_assessment;

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(assessment.status, 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY');
  assert.equal(
    assessment.required_kind_registry_binding.relative_path,
    'governance/required-kinds.json',
  );
  assert.deepEqual(
    assessment.ordered_kind_results.map((result) => [result.object_kind, result.status]),
    [
      [REQUIRED_KIND_REGISTRY_OBJECT_KIND, 'PASS'],
      ['CLAIM_DEFINITION', 'PASS'],
      ['PROVISION_CONCEPT', 'PASS'],
    ],
  );
  assert.equal(first.disposition.status, 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE');
  assert.equal(first.disposition.reason_code, 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
  assert.equal(Object.hasOwn(first, 'canonical_contract_bundle'), false);
});

test('binds valid required-kind registry changes into the input identity', (t) => {
  const firstRoot = fixture((state) => addRequiredKindRegistry(state));
  const secondRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[2].allowed_schema_versions = [
        'PROVISION_CONCEPT/V1',
        'PROVISION_CONCEPT/V2',
      ];
    refreshManifest(state);
  });
  t.after(() => fs.rmSync(firstRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(secondRoot, { recursive: true, force: true }));

  const first = compileCanonicalContractInput({ root_directory: firstRoot });
  const second = compileCanonicalContractInput({ root_directory: secondRoot });

  assert.notEqual(
    first.canonical_bundle_input_identity.canonical_bundle_input_identity_id,
    second.canonical_bundle_input_identity.canonical_bundle_input_identity_id,
  );
  assert.ok(first.canonical_bundle_input_identity.ordered_entries.some(
    (entry) => entry.object_kind === REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  ));
});

test('reports missing and undeclared kinds together in deterministic order', (t) => {
  const root = fixture((state) => {
    addRequiredKindRegistry(state, [
      requirement(
        REQUIRED_KIND_REGISTRY_OBJECT_KIND,
        [REQUIRED_KIND_REGISTRY_SCHEMA_VERSION],
        1,
        1,
      ),
      requirement('CLAIM_DEFINITION', ['CLAIM_DEFINITION/V1']),
      requirement('MISSING_ALPHA', ['MISSING_ALPHA/V1']),
      requirement('MISSING_ZETA', ['MISSING_ZETA/V1']),
    ]);
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    (error) => {
      assert.equal(error.code, 'CANONICAL_BUNDLE_INPUT_UNIVERSE_MISMATCH');
      assert.deepEqual(error.details, {
        missing_required_kinds: ['MISSING_ALPHA', 'MISSING_ZETA'],
        undeclared_authored_kinds: ['PROVISION_CONCEPT'],
        count_mismatches: [],
        schema_version_mismatches: [],
      });
      return true;
    },
  );
});

test('rejects required-kind count bounds and unsupported member schema versions', (t) => {
  const belowMinimumRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[1].minimum_count = 2;
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[1].maximum_count = 2;
    refreshManifest(state);
  });
  const aboveMaximumRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[2].minimum_count = 1;
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[2].maximum_count = 1;
    refreshManifest(state);
  });
  const unsupportedSchemaRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[1].allowed_schema_versions = ['CLAIM_DEFINITION/V2'];
    refreshManifest(state);
  });
  t.after(() => fs.rmSync(belowMinimumRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(aboveMaximumRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(unsupportedSchemaRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: belowMinimumRoot }),
    (error) => error.code === 'CANONICAL_BUNDLE_INPUT_UNIVERSE_MISMATCH'
      && error.details.count_mismatches[0].object_kind === 'CLAIM_DEFINITION',
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: aboveMaximumRoot }),
    (error) => error.code === 'CANONICAL_BUNDLE_INPUT_UNIVERSE_MISMATCH'
      && error.details.count_mismatches[0].object_kind === 'PROVISION_CONCEPT',
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: unsupportedSchemaRoot }),
    (error) => error.code === 'CANONICAL_BUNDLE_INPUT_UNIVERSE_MISMATCH'
      && error.details.schema_version_mismatches[0].unsupported_schema_versions[0]
        === 'CLAIM_DEFINITION/V1',
  );
});

test('rejects duplicate, reordered and invalid required-kind registry entries', (t) => {
  const duplicateRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds.splice(2, 0, {
        ...state.valuesByPath['governance/required-kinds.json'].required_kinds[1],
      });
    refreshManifest(state);
  });
  const reorderedRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    [
      state.valuesByPath['governance/required-kinds.json'].required_kinds[1],
      state.valuesByPath['governance/required-kinds.json'].required_kinds[2],
    ] = [
      state.valuesByPath['governance/required-kinds.json'].required_kinds[2],
      state.valuesByPath['governance/required-kinds.json'].required_kinds[1],
    ];
    refreshManifest(state);
  });
  const invalidSelfRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[0].allowed_schema_versions = [
        REQUIRED_KIND_REGISTRY_SCHEMA_VERSION,
        'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY/V2',
      ];
    refreshManifest(state);
  });
  t.after(() => fs.rmSync(duplicateRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(reorderedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(invalidSelfRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: duplicateRoot }),
    expectCode('DUPLICATE_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: reorderedRoot }),
    expectCode('UNSTABLE_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_ORDER'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: invalidSelfRoot }),
    expectCode('INVALID_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_SELF_REQUIREMENT'),
  );
});

test('rejects malformed required-kind bounds and schema-version sets', (t) => {
  const boundsRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[1].maximum_count = 0;
    refreshManifest(state);
  });
  const versionsRoot = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds.json']
      .required_kinds[1].allowed_schema_versions = [
        'CLAIM_DEFINITION/V1',
        'CLAIM_DEFINITION/V1',
      ];
    refreshManifest(state);
  });
  t.after(() => fs.rmSync(boundsRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(versionsRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: boundsRoot }),
    expectCode('INVALID_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: versionsRoot }),
    expectCode('INVALID_CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY'),
  );
});

test('rejects multiple required-kind registry members before selecting authority', (t) => {
  const root = fixture((state) => {
    addRequiredKindRegistry(state);
    state.valuesByPath['governance/required-kinds-copy.json'] = {
      ...state.valuesByPath['governance/required-kinds.json'],
      stable_id: 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY_COPY',
    };
    refreshManifest(state);
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: root }),
    expectCode('CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY_CARDINALITY'),
  );
});

test('canonicalises member bytes so source JSON formatting does not change the identity', (t) => {
  const firstRoot = fixture();
  const secondRoot = fixture();
  t.after(() => fs.rmSync(firstRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(secondRoot, { recursive: true, force: true }));

  const source = JSON.parse(fs.readFileSync(path.join(secondRoot, 'claims/knowledge.json'), 'utf8'));
  fs.writeFileSync(
    path.join(secondRoot, 'claims/knowledge.json'),
    `{\n  "schema_version": ${JSON.stringify(source.schema_version)},\n`
      + `  "stable_id": ${JSON.stringify(source.stable_id)},\n`
      + `  "canonical_value_type": ${JSON.stringify(source.canonical_value_type)},\n`
      + `  "object_kind": ${JSON.stringify(source.object_kind)}\n}\n`,
  );

  assert.equal(
    canonicalJson(compileCanonicalContractInput({ root_directory: firstRoot })),
    canonicalJson(compileCanonicalContractInput({ root_directory: secondRoot })),
  );
});

test('rejects missing and extra JSON members before compiling', (t) => {
  const missingRoot = fixture((state) => {
    delete state.valuesByPath['concepts/no-shop.json'];
  });
  const extraRoot = fixture((state) => {
    state.valuesByPath['unlisted.json'] = member('CLAIM_DEFINITION', 'UNLISTED', 'CLAIM_DEFINITION/V1');
  });
  t.after(() => fs.rmSync(missingRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(extraRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: missingRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_CLOSED_SET_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: extraRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_CLOSED_SET_MISMATCH'),
  );
});

test('rejects duplicate paths and conflicting (object_kind, stable_id) identities', (t) => {
  const duplicatePathRoot = fixture((state) => {
    state.manifest.members.splice(1, 0, { ...state.manifest.members[0] });
  });
  const conflictingIdentityRoot = fixture((state) => {
    state.manifest.members[2].object_kind = state.manifest.members[1].object_kind;
    state.manifest.members[2].stable_id = state.manifest.members[1].stable_id;
  });
  t.after(() => fs.rmSync(duplicatePathRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(conflictingIdentityRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: duplicatePathRoot }),
    expectCode('DUPLICATE_CANONICAL_BUNDLE_INPUT_PATH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: conflictingIdentityRoot }),
    expectCode('DUPLICATE_CANONICAL_BUNDLE_INPUT_IDENTITY'),
  );
});

test('rejects manifest/member metadata conflicts and canonical digest drift', (t) => {
  const metadataRoot = fixture((state) => {
    state.manifest.members[0].schema_version = 'CLAIM_DEFINITION/V2';
    state.manifest.per_kind_schema_versions.CLAIM_DEFINITION = ['CLAIM_DEFINITION/V2'];
  });
  const digestRoot = fixture((state) => {
    state.valuesByPath['claims/knowledge.json'].canonical_value_type = 'TRISTATE';
  });
  t.after(() => fs.rmSync(metadataRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(digestRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: metadataRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_MEMBER_METADATA_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: digestRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_DIGEST_MISMATCH'),
  );
});

test('rejects incorrect per-kind counts and schema-version declarations', (t) => {
  const countRoot = fixture((state) => {
    state.manifest.per_kind_counts.PROVISION_CONCEPT = 3;
  });
  const versionRoot = fixture((state) => {
    state.manifest.per_kind_schema_versions.PROVISION_CONCEPT = [
      'PROVISION_CONCEPT/V1',
      'PROVISION_CONCEPT/V2',
    ];
  });
  t.after(() => fs.rmSync(countRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(versionRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: countRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_KIND_COUNT_MISMATCH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: versionRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_KIND_SCHEMA_VERSION_MISMATCH'),
  );
});

test('rejects traversal paths, symlinks and manifest reordering', (t) => {
  const traversalRoot = fixture((state) => {
    state.manifest.members[0].relative_path = '../outside.json';
  });
  const symlinkRoot = fixture();
  fs.symlinkSync(
    path.join(symlinkRoot, 'claims/knowledge.json'),
    path.join(symlinkRoot, 'linked.json'),
  );
  const reorderedRoot = fixture((state) => {
    [state.manifest.members[0], state.manifest.members[1]] = [
      state.manifest.members[1],
      state.manifest.members[0],
    ];
  });
  t.after(() => fs.rmSync(traversalRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(symlinkRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(reorderedRoot, { recursive: true, force: true }));

  assert.throws(
    () => compileCanonicalContractInput({ root_directory: traversalRoot }),
    expectCode('INVALID_CANONICAL_BUNDLE_INPUT_PATH'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: symlinkRoot }),
    expectCode('CANONICAL_BUNDLE_INPUT_SYMLINK_NOT_ALLOWED'),
  );
  assert.throws(
    () => compileCanonicalContractInput({ root_directory: reorderedRoot }),
    expectCode('UNSTABLE_CANONICAL_BUNDLE_INPUT_ORDER'),
  );
});
