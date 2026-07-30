const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
  buildProductAskMappingRegistryManifest,
  normalizeProductAskPhrase,
  productAskMappingRegistryAdmission,
  productAskMappingRegistryPayloadDigest,
  validateProductAskMappingRegistryManifest,
} = require('../lib/canonical-v2/product-ask-mapping-registry');
const {
  buildProductNavigationCatalogueManifest,
  navigationDefinitionPayloadDigest,
  sourceNavigationCataloguePayloadDigest,
} = require('../lib/canonical-v2/product-navigation-catalogue');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function identity(stableId, version = 1) {
  return {
    stable_id: stableId,
    version,
    payload_digest: digest(`${stableId}:${version}`),
  };
}

function hierarchyContract() {
  return {
    levels: ['DOMAIN', 'TOPIC', 'PATTERN'],
    maximum_depth: 3,
    selected_topic_controls_pattern_membership: true,
    all_is_catalogue_navigation_not_union_query: true,
    remaining_distinctions_are_fields_or_predicates: true,
    display_only_entry_permitted: false,
  };
}

function admissionContract() {
  return {
    domain_topic_and_pattern_compile_to_one_query_ir: true,
    pattern_requires_exact_predicate_admission: true,
    unknown_domain_topic_pattern_or_predicate_has_runtime_path: false,
    failed_predicate_cannot_enter_through_passing_sibling: true,
    cross_domain_boolean_query_permitted_without_composite_contract: false,
    ask_and_browse_byte_equivalence_required: true,
  };
}

function authorityContract() {
  return {
    creates_runtime_navigation: false,
    creates_query_authority: false,
    creates_extraction_authority: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  };
}

function pattern(patternKey, label, predicateKey = patternKey) {
  return {
    pattern_key: patternKey,
    label,
    predicate_key: predicateKey,
    predicate_version: 1,
    predicate_shape: 'ATOMIC',
  };
}

function agreementSourceCatalogue() {
  return {
    object_kind: 'AGREEMENT_NAVIGATION_CATALOGUE_INPUT',
    stable_id: 'AGREEMENT_NAVIGATION_DEFINITION_CATALOGUE',
    schema_version: 'AGREEMENT_NAVIGATION_CATALOGUE_INPUT/V1',
    definition: {
      catalogue_version: 1,
      pm_wide_catalogue_binding: {
        combined_catalogue_stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
        agreement_domain_registry_stable_id: 'AGREEMENT',
        predicate_catalogue_stable_id:
          'AGREEMENT_DEAL_PROTECTION_PREDICATE_CATALOGUE',
        second_product_navigation_catalogue_permitted: false,
        agreement_contribution_is_additive_only: true,
      },
      hierarchy_contract: hierarchyContract(),
      domains: [{
        domain_key: 'AGREEMENT',
        label: 'Agreement',
        domain_registry_stable_id: 'AGREEMENT',
        topics: [{
          topic_key: 'DEAL_PROTECTIONS',
          label: 'Deal protections',
          predicate_catalogue_stable_id:
            'AGREEMENT_DEAL_PROTECTION_PREDICATE_CATALOGUE',
          patterns: [
            pattern('FIDUCIARY_OUT', 'Fiduciary out'),
            pattern('NO_SHOP', 'No-shop'),
          ],
        }],
      }],
      admission_contract: admissionContract(),
      authority_contract: authorityContract(),
    },
  };
}

function processSourceCatalogue() {
  return loadJson(
    'process/navigation/process-navigation-definition-catalogue.v2.json',
  );
}

function cvrSourceCatalogue() {
  return {
    object_kind: 'CVR_NAVIGATION_CATALOGUE_INPUT',
    stable_id: 'CVR_NAVIGATION_DEFINITION_CATALOGUE',
    schema_version: 'CVR_NAVIGATION_CATALOGUE_INPUT/V1',
    definition: {
      catalogue_version: 1,
      pm_wide_catalogue_binding: {
        combined_catalogue_stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
        cvr_domain_registry_stable_id: 'CVR',
        predicate_catalogue_stable_id: 'CVR_MILESTONE_PREDICATE_CATALOGUE',
        second_product_navigation_catalogue_permitted: false,
        cvr_contribution_is_additive_only: true,
      },
      hierarchy_contract: hierarchyContract(),
      domains: [{
        domain_key: 'CVR',
        label: 'CVR',
        domain_registry_stable_id: 'CVR',
        topics: [{
          topic_key: 'MILESTONES',
          label: 'Milestones',
          predicate_catalogue_stable_id:
            'CVR_MILESTONE_PREDICATE_CATALOGUE',
          patterns: [
            pattern('CVR_REGULATORY_MILESTONE', 'Regulatory milestone'),
          ],
        }],
      }],
      admission_contract: admissionContract(),
      authority_contract: authorityContract(),
    },
  };
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceIdentity(source) {
  return `${source.stable_id}\0${source.schema_version}`;
}

function patternIdentity(value) {
  return [
    value.domain_key,
    value.topic_key,
    value.pattern_key,
  ].join('\0');
}

function sourceCounts(source) {
  const domains = source.definition.domains;
  return {
    domains: domains.length,
    topics: domains.reduce(
      (total, domain) => total + domain.topics.length,
      0,
    ),
    patterns: domains.reduce(
      (domainTotal, domain) => domainTotal + domain.topics.reduce(
        (topicTotal, topic) => topicTotal + topic.patterns.length,
        0,
      ),
      0,
    ),
  };
}

function sourceAdmission(source) {
  const counts = sourceCounts(source);
  return {
    source_stable_id: source.stable_id,
    source_schema_version: source.schema_version,
    source_catalogue_version: source.definition.catalogue_version,
    source_payload_digest:
      sourceNavigationCataloguePayloadDigest(source),
    source_domain_count: counts.domains,
    source_topic_count: counts.topics,
    source_pattern_count: counts.patterns,
  };
}

function sourcePatterns(source) {
  return source.definition.domains.flatMap((domain) => (
    domain.topics.flatMap((topic) => topic.patterns.map((entry) => ({
      source_stable_id: source.stable_id,
      domain_key: domain.domain_key,
      topic_key: topic.topic_key,
      pattern_key: entry.pattern_key,
      predicate_key: entry.predicate_key,
      predicate_version: entry.predicate_version,
    })))
  ));
}

function includedNavigationDisposition(entry) {
  return {
    ...entry,
    decision: 'INCLUDE',
    certification_identity: identity(
      [
        entry.domain_key,
        entry.predicate_key,
        entry.predicate_version,
        'NAVIGATION_CERTIFICATION',
      ].join('_'),
    ),
    exclusion_reason_code: null,
    exclusion_evidence_identity: null,
  };
}

function navigationManifest({ includeCvr = false } = {}) {
  const sources = [
    agreementSourceCatalogue(),
    ...(includeCvr ? [cvrSourceCatalogue()] : []),
    processSourceCatalogue(),
  ].sort((left, right) => compareText(
    sourceIdentity(left),
    sourceIdentity(right),
  ));
  const allPatterns = sources.flatMap(sourcePatterns);
  const domainOrder = includeCvr
    ? ['AGREEMENT', 'PROCESS', 'CVR']
    : ['AGREEMENT', 'PROCESS'];
  return buildProductNavigationCatalogueManifest({
    source_catalogues: sources,
    release_admission: {
      schema_version: 'PRODUCT_NAVIGATION_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: digest('approved-pm-data-version'),
      candidate_release_manifest_id: digest('candidate-release-manifest'),
      candidate_release_manifest_payload_digest:
        digest('candidate-release-manifest-payload'),
      catalogue_generator_identity:
        identity('PRODUCT_NAVIGATION_CATALOGUE_GENERATOR'),
      source_catalogue_admissions: sources
        .map(sourceAdmission)
        .sort((left, right) => compareText(
          sourceIdentity({
            stable_id: left.source_stable_id,
            schema_version: left.source_schema_version,
          }),
          sourceIdentity({
            stable_id: right.source_stable_id,
            schema_version: right.source_schema_version,
          }),
        )),
      pattern_dispositions: allPatterns
        .map(includedNavigationDisposition)
        .sort((left, right) => compareText(
          [
            left.source_stable_id,
            patternIdentity(left),
          ].join('\0'),
          [
            right.source_stable_id,
            patternIdentity(right),
          ].join('\0'),
        )),
      required_initial_domain_keys: ['AGREEMENT', 'PROCESS'],
      domain_order: domainOrder,
      enumeration_certification: {
        independent_source_enumeration_identity:
          identity('NAVIGATION_INDEPENDENT_SOURCE_ENUMERATION'),
        inclusion_exclusion_reconciliation_identity:
          identity('NAVIGATION_INCLUSION_EXCLUSION_RECONCILIATION'),
      },
      previous_catalogue_identity: null,
    },
  });
}

function navigationPatterns(manifest) {
  return manifest.navigation_definition.domains.flatMap((domain) => (
    domain.topics.flatMap((topic) => (
      topic.patterns.map((entry) => ({
        domain_key: domain.domain_key,
        topic_key: topic.topic_key,
        pattern_key: entry.pattern_key,
        predicate_key: entry.predicate_key,
        predicate_version: entry.predicate_version,
        label: entry.label,
      }))
    ))
  ));
}

function concept(entry) {
  return {
    domain_key: entry.domain_key,
    topic_key: entry.topic_key,
    pattern_key: entry.pattern_key,
    predicate_key: entry.predicate_key,
    predicate_version: entry.predicate_version,
    label: entry.label,
  };
}

function compiledMapping({
  mappingKey,
  phrase,
  phraseClass,
  target,
}) {
  return {
    mapping_key: mappingKey,
    phrase,
    normalized_phrase: normalizeProductAskPhrase(phrase),
    phrase_class: phraseClass,
    outcome: 'COMPILED',
    domain_key: target.domain_key,
    topic_key: target.topic_key,
    pattern_key: target.pattern_key,
    predicate_key: target.predicate_key,
    predicate_version: target.predicate_version,
    concept_label: target.label,
    choices: [],
    nearest_supported_concepts: [],
  };
}

function boundaryMapping({
  mappingKey,
  phrase,
  phraseClass,
  outcome,
  choices = [],
  nearest = [],
}) {
  return {
    mapping_key: mappingKey,
    phrase,
    normalized_phrase: normalizeProductAskPhrase(phrase),
    phrase_class: phraseClass,
    outcome,
    domain_key: null,
    topic_key: null,
    pattern_key: null,
    predicate_key: null,
    predicate_version: null,
    concept_label: null,
    choices: choices.map(concept).sort((left, right) => compareText(
      patternIdentity(left),
      patternIdentity(right),
    )),
    nearest_supported_concepts: nearest.map(concept).sort(
      (left, right) => compareText(
        patternIdentity(left),
        patternIdentity(right),
      ),
    ),
  };
}

function askReleaseAdmission(
  manifest,
  {
    registryVersion = 1,
    previousManifest = null,
  } = {},
) {
  const patterns = navigationPatterns(manifest);
  const entries = patterns.flatMap((entry, index) => {
    const serial = String(index + 1).padStart(4, '0');
    return [
      compiledMapping({
        mappingKey: `map-${serial}-practitioner`,
        phrase: `show ${entry.domain_key} ${entry.pattern_key} examples`,
        phraseClass: 'PRACTITIONER_PHRASE',
        target: entry,
      }),
      compiledMapping({
        mappingKey: `map-${serial}-synonym`,
        phrase: `find drafting for ${entry.domain_key} ${entry.pattern_key}`,
        phraseClass: 'DRAFTING_SYNONYM',
        target: entry,
      }),
    ];
  });
  entries.push(
    compiledMapping({
      mappingKey: 'map-9001-abbreviation',
      phrase: 'show agr no shop',
      phraseClass: 'ABBREVIATION',
      target: patterns[0],
    }),
    compiledMapping({
      mappingKey: 'map-9002-misspelling',
      phrase: 'show agrement no shpo',
      phraseClass: 'ORDINARY_MISSPELLING',
      target: patterns[0],
    }),
    boundaryMapping({
      mappingKey: 'map-9901-adjacent',
      phrase: 'show confidentiality restrictions',
      phraseClass: 'LEGALLY_ADJACENT_NEGATIVE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [patterns[0]],
    }),
    boundaryMapping({
      mappingKey: 'map-9902-ambiguous',
      phrase: 'show exclusivity',
      phraseClass: 'AMBIGUOUS_LEGAL_PHRASE',
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      choices: [patterns[0], patterns.find(
        (entry) => entry.domain_key === 'PROCESS',
      )],
    }),
    boundaryMapping({
      mappingKey: 'map-9903-unsupported',
      phrase: 'show reverse termination fees',
      phraseClass: 'UNSUPPORTED_PHRASE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [patterns[1]],
    }),
  );
  entries.sort((left, right) => compareText(
    left.mapping_key,
    right.mapping_key,
  ));
  const dispositions = patterns.map((entry) => ({
    domain_key: entry.domain_key,
    topic_key: entry.topic_key,
    pattern_key: entry.pattern_key,
    predicate_key: entry.predicate_key,
    predicate_version: entry.predicate_version,
    decision: 'INCLUDE',
    mapping_keys: entries
      .filter((mapping) => (
        mapping.outcome === 'COMPILED'
        && patternIdentity(mapping) === patternIdentity(entry)
      ))
      .map((mapping) => mapping.mapping_key)
      .sort(compareText),
    certification_identity: identity(
      `ASK_COVERAGE_${entry.domain_key}_${entry.pattern_key}`,
    ),
    exclusion_reason_code: null,
    exclusion_evidence_identity: null,
  })).sort((left, right) => compareText(
    patternIdentity(left),
    patternIdentity(right),
  ));
  return {
    schema_version: 'PRODUCT_ASK_MAPPING_RELEASE_ADMISSION/V1',
    registry_version: registryVersion,
    approved_pm_data_version_id: manifest.approved_pm_data_version_id,
    candidate_release_manifest_id: manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      manifest.candidate_release_manifest_payload_digest,
    navigation_catalogue_identity: {
      manifest_id: manifest.manifest_id,
      payload_digest:
        navigationDefinitionPayloadDigest(manifest.navigation_definition),
    },
    registry_compiler_identity:
      identity('PRODUCT_ASK_MAPPING_REGISTRY_COMPILER'),
    entries,
    pattern_dispositions: dispositions,
    certification: {
      independent_enumeration_identity:
        identity('ASK_INDEPENDENT_ENUMERATION'),
      mapping_reconciliation_identity:
        identity('ASK_MAPPING_RECONCILIATION'),
      query_goldens_identity: identity('ASK_QUERY_GOLDENS'),
      utterance_suite_identity: identity('ASK_UTTERANCE_SUITE'),
    },
    previous_registry_identity: previousManifest
      ? {
        manifest_id: previousManifest.manifest_id,
        payload_digest: previousManifest.canonical_payload_digest,
        registry_version: previousManifest.registry_version,
      }
      : null,
  };
}

function inputs(options = {}) {
  const navigation = navigationManifest(options);
  return {
    navigation_catalogue_manifest: navigation,
    release_admission: askReleaseAdmission(navigation),
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function resignManifest(manifest) {
  const body = clone(manifest);
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  manifest.manifest_id = contentId(
    PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    body,
  );
  manifest.canonical_payload_digest =
    productAskMappingRegistryPayloadDigest(manifest);
  return manifest;
}

test('builds one deterministic Agreement and Process Ask registry', () => {
  const buildInputs = inputs();
  const first = buildProductAskMappingRegistryManifest(buildInputs);
  const second = buildProductAskMappingRegistryManifest(buildInputs);

  assert.equal(first.manifest_id, second.manifest_id);
  assert.equal(
    first.canonical_payload_digest,
    second.canonical_payload_digest,
  );
  assert.equal(first.counts.navigation_pattern_count, 43);
  assert.equal(first.counts.covered_pattern_count, 43);
  assert.equal(first.counts.excluded_pattern_count, 0);
  assert.equal(first.counts.compiled_mapping_count, 88);
  assert.equal(first.counts.boundary_mapping_count, 3);
  assert.equal(first.difference.added_mapping_keys.length, 91);
  assert.deepEqual(
    [...new Set(first.pattern_coverage.map(
      (entry) => entry.domain_key,
    ))],
    ['AGREEMENT', 'PROCESS'],
  );
  assertDeepFrozen(first);
});

test('gives every one of the 41 Process Browse Patterns checked Ask phrases', () => {
  const buildInputs = inputs();
  const manifest = buildProductAskMappingRegistryManifest(buildInputs);
  const processCoverage = manifest.pattern_coverage.filter(
    (entry) => entry.domain_key === 'PROCESS',
  );
  const entryByKey = new Map(manifest.entries.map((entry) => [
    entry.mapping_key,
    entry,
  ]));

  assert.equal(processCoverage.length, 41);
  assert.equal(
    manifest.pattern_exclusions.some(
      (entry) => entry.domain_key === 'PROCESS',
    ),
    false,
  );
  for (const coverage of processCoverage) {
    assert.ok(coverage.mapping_keys.length >= 1);
    for (const mappingKey of coverage.mapping_keys) {
      const mapping = entryByKey.get(mappingKey);
      assert.equal(mapping.outcome, 'COMPILED');
      assert.equal(mapping.pattern_key, coverage.pattern_key);
      assert.equal(mapping.predicate_key, coverage.predicate_key);
    }
  }
});

test('produces a bounded admission for one later PM-wide Ask compiler', () => {
  const buildInputs = inputs();
  const manifest = buildProductAskMappingRegistryManifest(buildInputs);
  const admission = productAskMappingRegistryAdmission(
    manifest,
    buildInputs,
  );
  assert.equal(admission.stable_id, 'PRODUCT_ASK_MAPPING_REGISTRY');
  assert.equal(admission.registry_version, 1);
  assert.equal(admission.manifest_id, manifest.manifest_id);
  assert.equal(
    admission.navigation_catalogue_identity.manifest_id,
    buildInputs.navigation_catalogue_manifest.manifest_id,
  );
  assertDeepFrozen(admission);
});

test('requires exact Ask coverage for every admitted Browse Pattern', () => {
  const missingDisposition = inputs();
  missingDisposition.release_admission.pattern_dispositions.pop();
  assert.throws(
    () => buildProductAskMappingRegistryManifest(missingDisposition),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );

  const missingMapping = inputs();
  missingMapping.release_admission.pattern_dispositions[0]
    .mapping_keys.pop();
  assert.throws(
    () => buildProductAskMappingRegistryManifest(missingMapping),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );
});

test('records an explicit Ask exclusion without removing the Browse Pattern', () => {
  const buildInputs = inputs();
  const disposition = buildInputs.release_admission
    .pattern_dispositions.at(-1);
  const removedKeys = new Set(disposition.mapping_keys);
  buildInputs.release_admission.entries = buildInputs.release_admission
    .entries.filter((entry) => !removedKeys.has(entry.mapping_key));
  disposition.decision = 'EXCLUDE';
  disposition.mapping_keys = [];
  disposition.certification_identity = null;
  disposition.exclusion_reason_code = 'ASK_LANGUAGE_NOT_YET_CERTIFIED';
  disposition.exclusion_evidence_identity =
    identity('ASK_LANGUAGE_SCOPE_DECISION');

  const manifest = buildProductAskMappingRegistryManifest(buildInputs);
  assert.equal(manifest.counts.navigation_pattern_count, 43);
  assert.equal(manifest.counts.covered_pattern_count, 42);
  assert.equal(manifest.counts.excluded_pattern_count, 1);
  assert.equal(manifest.pattern_exclusions[0].pattern_key, disposition.pattern_key);
});

test('rejects one normalized phrase with Agreement and Process meanings', () => {
  const buildInputs = inputs();
  const agreement = buildInputs.release_admission.entries.find(
    (entry) => (
      entry.outcome === 'COMPILED'
      && entry.domain_key === 'AGREEMENT'
    ),
  );
  const process = buildInputs.release_admission.entries.find(
    (entry) => (
      entry.outcome === 'COMPILED'
      && entry.domain_key === 'PROCESS'
    ),
  );
  process.phrase = `${agreement.phrase}?`;
  process.normalized_phrase = normalizeProductAskPhrase(process.phrase);
  assert.throws(
    () => buildProductAskMappingRegistryManifest(buildInputs),
    (error) => (
      error.code === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION'
      && /more than one legal meaning/.test(error.message)
    ),
  );
});

test('rejects a phrase that points to a different Pattern than its coverage', () => {
  const buildInputs = inputs();
  const mappingKey = buildInputs.release_admission
    .pattern_dispositions[0].mapping_keys[0];
  const mapping = buildInputs.release_admission.entries.find(
    (entry) => entry.mapping_key === mappingKey,
  );
  const other = navigationPatterns(
    buildInputs.navigation_catalogue_manifest,
  )[1];
  Object.assign(mapping, {
    domain_key: other.domain_key,
    topic_key: other.topic_key,
    pattern_key: other.pattern_key,
    predicate_key: other.predicate_key,
    predicate_version: other.predicate_version,
    concept_label: other.label,
  });
  assert.throws(
    () => buildProductAskMappingRegistryManifest(buildInputs),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );
});

test('enforces checked ambiguity and unsupported boundaries', () => {
  const ambiguous = inputs();
  const ambiguousEntry = ambiguous.release_admission.entries.find(
    (entry) => entry.phrase_class === 'AMBIGUOUS_LEGAL_PHRASE',
  );
  ambiguousEntry.choices.pop();
  assert.throws(
    () => buildProductAskMappingRegistryManifest(ambiguous),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );

  const unsupported = inputs();
  const unsupportedEntry = unsupported.release_admission.entries.find(
    (entry) => entry.phrase_class === 'UNSUPPORTED_PHRASE',
  );
  unsupportedEntry.nearest_supported_concepts = [];
  assert.throws(
    () => buildProductAskMappingRegistryManifest(unsupported),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );
});

test('adds a future CVR domain without registry compiler change', () => {
  const navigation = navigationManifest({ includeCvr: true });
  const buildInputs = {
    navigation_catalogue_manifest: navigation,
    release_admission: askReleaseAdmission(navigation),
  };
  const manifest = buildProductAskMappingRegistryManifest(buildInputs);
  assert.equal(manifest.counts.navigation_pattern_count, 44);
  assert.equal(manifest.counts.covered_pattern_count, 44);
  assert.ok(manifest.pattern_coverage.some(
    (entry) => entry.domain_key === 'CVR',
  ));
  assert.ok(manifest.entries.some(
    (entry) => entry.domain_key === 'CVR',
  ));
});

test('requires at least one covered Agreement and Process Pattern', () => {
  const buildInputs = inputs();
  const agreementDispositions = buildInputs.release_admission
    .pattern_dispositions.filter(
      (disposition) => disposition.domain_key === 'AGREEMENT',
    );
  const removedKeys = new Set(agreementDispositions.flatMap(
    (disposition) => disposition.mapping_keys,
  ));
  buildInputs.release_admission.entries = buildInputs.release_admission
    .entries.filter((entry) => !removedKeys.has(entry.mapping_key));
  for (const disposition of agreementDispositions) {
    disposition.decision = 'EXCLUDE';
    disposition.mapping_keys = [];
    disposition.certification_identity = null;
    disposition.exclusion_reason_code = 'ASK_LANGUAGE_NOT_YET_CERTIFIED';
    disposition.exclusion_evidence_identity =
      identity(`ASK_EXCLUSION_${disposition.pattern_key}`);
  }
  assert.throws(
    () => buildProductAskMappingRegistryManifest(buildInputs),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );
});

test('rejects navigation drift after the registry release was checked', () => {
  const buildInputs = inputs();
  const manifest = buildProductAskMappingRegistryManifest(buildInputs);
  assert.throws(
    () => validateProductAskMappingRegistryManifest(manifest, {
      ...buildInputs,
      navigation_catalogue_manifest:
        navigationManifest({ includeCvr: true }),
    }),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION',
  );
});

test('requires a registry version increase when Ask meaning changes', () => {
  const initialInputs = inputs();
  const initial = buildProductAskMappingRegistryManifest(initialInputs);
  const stale = {
    navigation_catalogue_manifest:
      initialInputs.navigation_catalogue_manifest,
    release_admission: askReleaseAdmission(
      initialInputs.navigation_catalogue_manifest,
      { previousManifest: initial },
    ),
    previous_manifest: initial,
  };
  stale.release_admission.entries[0].phrase += ' please';
  stale.release_admission.entries[0].normalized_phrase =
    normalizeProductAskPhrase(stale.release_admission.entries[0].phrase);
  assert.throws(
    () => buildProductAskMappingRegistryManifest(stale),
    (error) => (
      error.code === 'INVALID_PRODUCT_ASK_MAPPING_RELEASE_ADMISSION'
      && /without a registry version increase/.test(error.message)
    ),
  );
});

test('records an exact successor difference after a versioned phrase change', () => {
  const initialInputs = inputs();
  const initial = buildProductAskMappingRegistryManifest(initialInputs);
  const successorAdmission = askReleaseAdmission(
    initialInputs.navigation_catalogue_manifest,
    {
      registryVersion: 2,
      previousManifest: initial,
    },
  );
  successorAdmission.entries[0].phrase += ' please';
  successorAdmission.entries[0].normalized_phrase =
    normalizeProductAskPhrase(successorAdmission.entries[0].phrase);
  const successor = buildProductAskMappingRegistryManifest({
    navigation_catalogue_manifest:
      initialInputs.navigation_catalogue_manifest,
    release_admission: successorAdmission,
    previous_manifest: initial,
  });
  assert.equal(successor.registry_version, 2);
  assert.deepEqual(
    successor.difference.changed_mapping_keys,
    [successor.entries[0].mapping_key],
  );
  assert.equal(successor.difference.added_mapping_keys.length, 0);
  assert.equal(successor.difference.removed_mapping_keys.length, 0);
  assert.equal(successor.difference.unchanged_mapping_keys.length, 90);
});

test('rejects changed or correctly rehashed registry content', () => {
  const buildInputs = inputs();
  const changed = clone(
    buildProductAskMappingRegistryManifest(buildInputs),
  );
  changed.entries[0].phrase = 'find a different legal concept';
  assert.throws(
    () => validateProductAskMappingRegistryManifest(changed, buildInputs),
    (error) => error.code
      === 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST',
  );

  const rehashed = clone(
    buildProductAskMappingRegistryManifest(buildInputs),
  );
  rehashed.entries[0].phrase += ' now';
  rehashed.entries[0].normalized_phrase =
    normalizeProductAskPhrase(rehashed.entries[0].phrase);
  const { mapping_definition_id: ignored, ...definition } =
    rehashed.entries[0];
  rehashed.entries[0].mapping_definition_id = contentId(
    'PRODUCT_ASK_MAPPING_DEFINITION/V1',
    definition,
  );
  resignManifest(rehashed);
  assert.throws(
    () => validateProductAskMappingRegistryManifest(rehashed, buildInputs),
    (error) => (
      error.code === 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST'
      && /checked release admission/.test(error.message)
    ),
  );
});

test('the compiler has no LLM, fetch, database, write, serving, or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-ask-mapping-registry.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|writeFile|supabase|process\.env|activateRelease|serveResult|openai)\b/i,
  );
  const buildInputs = inputs();
  assert.equal(
    canonicalJson(buildProductAskMappingRegistryManifest(buildInputs)),
    canonicalJson(buildProductAskMappingRegistryManifest(buildInputs)),
  );
});
