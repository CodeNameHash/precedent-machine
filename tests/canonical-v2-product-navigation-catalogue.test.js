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
  PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
  buildProductNavigationCatalogueManifest,
  navigationDefinitionPayloadDigest,
  productNavigationCataloguePayloadDigest,
  productNavigationQueryAdmission,
  sourceNavigationCataloguePayloadDigest,
  validateProductNavigationCatalogueManifest,
} = require('../lib/canonical-v2/product-navigation-catalogue');
const {
  listProcessBrowseOptions,
} = require('../lib/canonical-v2/process-browse-compiler');

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
            pattern(
              'CVR_REGULATORY_MILESTONE',
              'Regulatory milestone',
            ),
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

function dispositionIdentity(disposition) {
  return [
    disposition.source_stable_id,
    disposition.domain_key,
    disposition.topic_key,
    disposition.pattern_key,
  ].join('\0');
}

function sourceCatalogues({ includeCvr = false } = {}) {
  return [
    agreementSourceCatalogue(),
    ...(includeCvr ? [cvrSourceCatalogue()] : []),
    processSourceCatalogue(),
  ].sort((left, right) => compareText(
    sourceIdentity(left),
    sourceIdentity(right),
  ));
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

function includedDisposition(entry) {
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

function releaseAdmission(
  sources,
  {
    domainOrder = null,
    previousManifest = null,
  } = {},
) {
  const allPatterns = sources.flatMap(sourcePatterns);
  const includedDomains = [...new Set(allPatterns.map(
    (entry) => entry.domain_key,
  ))];
  const release = {
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
        `${left.source_stable_id}\0${left.source_schema_version}`,
        `${right.source_stable_id}\0${right.source_schema_version}`,
      )),
    pattern_dispositions: allPatterns
      .map(includedDisposition)
      .sort((left, right) => compareText(
        dispositionIdentity(left),
        dispositionIdentity(right),
      )),
    required_initial_domain_keys: ['AGREEMENT', 'PROCESS'],
    domain_order: domainOrder || includedDomains,
    enumeration_certification: {
      independent_source_enumeration_identity:
        identity('NAVIGATION_INDEPENDENT_SOURCE_ENUMERATION'),
      inclusion_exclusion_reconciliation_identity:
        identity('NAVIGATION_INCLUSION_EXCLUSION_RECONCILIATION'),
    },
    previous_catalogue_identity: previousManifest
      ? {
        manifest_id: previousManifest.manifest_id,
        payload_digest: previousManifest.canonical_payload_digest,
      }
      : null,
  };
  return release;
}

function manifestInputs(options = {}) {
  const sources = sourceCatalogues(options);
  return {
    source_catalogues: sources,
    release_admission: releaseAdmission(sources, {
      domainOrder: options.includeCvr
        ? ['AGREEMENT', 'PROCESS', 'CVR']
        : ['AGREEMENT', 'PROCESS'],
    }),
  };
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function resignManifest(manifest) {
  delete manifest.manifest_id;
  delete manifest.canonical_payload_digest;
  const body = clone(manifest);
  manifest.manifest_id = contentId(
    PRODUCT_NAVIGATION_CATALOGUE_MANIFEST_SCHEMA,
    body,
  );
  manifest.canonical_payload_digest =
    productNavigationCataloguePayloadDigest(manifest);
  return manifest;
}

test('builds one deterministic Agreement and Process navigation catalogue', () => {
  const first = buildProductNavigationCatalogueManifest(manifestInputs());
  const second = buildProductNavigationCatalogueManifest(manifestInputs());

  assert.equal(first.manifest_id, second.manifest_id);
  assert.equal(
    first.canonical_payload_digest,
    second.canonical_payload_digest,
  );
  assert.deepEqual(
    first.navigation_definition.domains.map((domain) => domain.domain_key),
    ['AGREEMENT', 'PROCESS'],
  );
  assert.equal(first.counts.source_catalogue_count, 2);
  assert.equal(first.counts.source_domain_count, 2);
  assert.equal(first.counts.source_topic_count, 2);
  assert.equal(first.counts.source_pattern_count, 43);
  assert.equal(first.counts.admitted_pattern_count, 43);
  assert.equal(first.counts.excluded_pattern_count, 0);
  assert.equal(first.pattern_certifications.length, 43);
  assert.equal(first.difference.added_pattern_definition_ids.length, 43);
  assert.equal(
    first.navigation_definition.hierarchy_contract.maximum_depth,
    3,
  );
  assertDeepFrozen(first);
});

test('feeds the existing dynamic Browse compiler without an adapter', () => {
  const manifest = buildProductNavigationCatalogueManifest(manifestInputs());
  const queryNavigationAdmission = productNavigationQueryAdmission(manifest);
  const predicateAdmission = (domainKey, predicateKey) => ({
    domain_key: domainKey,
    predicate_key: predicateKey,
    predicate_version: 1,
  });
  const admission = {
    navigation_catalogue: queryNavigationAdmission,
    predicate_admissions: [
      predicateAdmission('AGREEMENT', 'NO_SHOP'),
      predicateAdmission('PROCESS', 'EXCLUSIVITY_GRANTED'),
      predicateAdmission('PROCESS', 'EXCLUSIVITY_EXTENSION'),
    ],
  };
  const domains = listProcessBrowseOptions({
    navigation_definition: manifest.navigation_definition,
    admission,
    selection: null,
  });
  assert.deepEqual(domains.options, [
    { key: 'AGREEMENT', label: 'Agreement' },
    { key: 'PROCESS', label: 'Process' },
  ]);

  const topics = listProcessBrowseOptions({
    navigation_definition: manifest.navigation_definition,
    admission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: null,
    },
  });
  assert.deepEqual(topics.options, [
    { key: 'EXCLUSIVITY', label: 'Exclusivity' },
  ]);

  const patterns = listProcessBrowseOptions({
    navigation_definition: manifest.navigation_definition,
    admission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
    },
  });
  assert.deepEqual(
    patterns.options.map((entry) => entry.key),
    ['EXCLUSIVITY_GRANTED', 'EXCLUSIVITY_EXTENSION'],
  );
  assert.equal(
    queryNavigationAdmission.payload_digest,
    navigationDefinitionPayloadDigest(manifest.navigation_definition),
  );
});

test('makes all 41 governed Process predicates executable Browse Patterns', () => {
  const manifest = buildProductNavigationCatalogueManifest(manifestInputs());
  const processPatterns = manifest.navigation_definition.domains
    .find((domain) => domain.domain_key === 'PROCESS')
    .topics.find((topic) => topic.topic_key === 'EXCLUSIVITY')
    .patterns;
  const admission = {
    navigation_catalogue: productNavigationQueryAdmission(manifest),
    predicate_admissions: processPatterns.map((entry) => ({
      domain_key: 'PROCESS',
      predicate_key: entry.predicate_key,
      predicate_version: entry.predicate_version,
    })),
  };
  const listed = listProcessBrowseOptions({
    navigation_definition: manifest.navigation_definition,
    admission,
    selection: {
      domain_key: 'PROCESS',
      topic_key: 'EXCLUSIVITY',
    },
  });

  assert.equal(processPatterns.length, 41);
  assert.deepEqual(
    listed.options.map((entry) => entry.predicate_key),
    processPatterns.map((entry) => entry.predicate_key),
  );
});

test('rejects silent loss of one source Pattern decision', () => {
  const inputs = manifestInputs();
  inputs.release_admission.pattern_dispositions.pop();
  assert.throws(
    () => buildProductNavigationCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('rejects a changed source even when the changed source is valid JSON', () => {
  const inputs = manifestInputs();
  inputs.source_catalogues[0].definition.domains[0].label =
    'Agreement provisions';
  assert.throws(
    () => buildProductNavigationCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('rejects duplicate predicate meaning and display-only hierarchy entries', () => {
  const duplicate = manifestInputs();
  const agreementPatterns = duplicate.source_catalogues[0]
    .definition.domains[0].topics[0].patterns;
  agreementPatterns[1].predicate_key = agreementPatterns[0].predicate_key;
  assert.throws(
    () => buildProductNavigationCatalogueManifest(duplicate),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE',
  );

  const displayOnly = manifestInputs();
  displayOnly.source_catalogues[0]
    .definition.domains[0].topics[0].patterns = [];
  assert.throws(
    () => buildProductNavigationCatalogueManifest(displayOnly),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE',
  );
});

test('rejects any source contribution that grants runtime authority', () => {
  const inputs = manifestInputs();
  inputs.source_catalogues[0]
    .definition.authority_contract.creates_runtime_navigation = true;
  assert.throws(
    () => buildProductNavigationCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_SOURCE_CATALOGUE',
  );
});

test('requires certification for every included Pattern', () => {
  const inputs = manifestInputs();
  inputs.release_admission.pattern_dispositions[0]
    .certification_identity = null;
  assert.throws(
    () => buildProductNavigationCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('records an explicit exclusion and never emits that Pattern', () => {
  const inputs = manifestInputs();
  const disposition = inputs.release_admission.pattern_dispositions.find(
    (entry) => entry.pattern_key === 'FIDUCIARY_OUT',
  );
  disposition.decision = 'EXCLUDE';
  disposition.certification_identity = null;
  disposition.exclusion_reason_code = 'NOT_IN_FIRST_PRODUCT_SCOPE';
  disposition.exclusion_evidence_identity =
    identity('FIDUCIARY_OUT_SCOPE_DECISION');

  const manifest = buildProductNavigationCatalogueManifest(inputs);
  assert.equal(manifest.counts.admitted_pattern_count, 42);
  assert.equal(manifest.counts.excluded_pattern_count, 1);
  assert.equal(manifest.source_exclusions[0].pattern_key, 'FIDUCIARY_OUT');
  const agreementPatterns = manifest.navigation_definition.domains
    .find((domain) => domain.domain_key === 'AGREEMENT')
    .topics[0].patterns;
  assert.deepEqual(
    agreementPatterns.map((entry) => entry.pattern_key),
    ['NO_SHOP'],
  );
});

test('refuses a first catalogue without both Agreement and Process', () => {
  const process = [processSourceCatalogue()];
  const inputs = {
    source_catalogues: process,
    release_admission: releaseAdmission(process, {
      domainOrder: ['PROCESS'],
    }),
  };
  assert.throws(
    () => buildProductNavigationCatalogueManifest(inputs),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('rejects a domain-order list that omits or invents an included domain', () => {
  const missing = manifestInputs();
  missing.release_admission.domain_order = ['AGREEMENT'];
  assert.throws(
    () => buildProductNavigationCatalogueManifest(missing),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );

  const invented = manifestInputs();
  invented.release_admission.domain_order = [
    'AGREEMENT',
    'PROCESS',
    'CVR',
  ];
  assert.throws(
    () => buildProductNavigationCatalogueManifest(invented),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('adds a future CVR domain without compiler code change', () => {
  const manifest = buildProductNavigationCatalogueManifest(
    manifestInputs({ includeCvr: true }),
  );
  assert.deepEqual(
    manifest.navigation_definition.domains.map((domain) => domain.domain_key),
    ['AGREEMENT', 'PROCESS', 'CVR'],
  );
  const cvr = manifest.navigation_definition.domains[2];
  assert.equal(cvr.topics[0].topic_key, 'MILESTONES');
  assert.equal(
    cvr.topics[0].patterns[0].predicate_key,
    'CVR_REGULATORY_MILESTONE',
  );
  assert.equal(manifest.counts.source_catalogue_count, 3);
  assert.equal(manifest.counts.admitted_pattern_count, 44);
});

test('records an exact successor difference after an admitted label change', () => {
  const initialInputs = manifestInputs();
  const initial = buildProductNavigationCatalogueManifest(initialInputs);
  const sources = sourceCatalogues();
  sources[0].definition.domains[0].topics[0].patterns[1].label =
    'No-shop covenant';
  sources[0].definition.catalogue_version = 2;
  const successorAdmission = releaseAdmission(sources, {
    domainOrder: ['AGREEMENT', 'PROCESS'],
    previousManifest: initial,
  });
  const successor = buildProductNavigationCatalogueManifest({
    source_catalogues: sources,
    release_admission: successorAdmission,
    previous_manifest: initial,
  });

  assert.equal(successor.difference.previous_manifest_id, initial.manifest_id);
  assert.equal(successor.difference.changed_patterns.length, 1);
  assert.equal(
    successor.difference.changed_patterns[0].pattern_key,
    'NO_SHOP',
  );
  assert.equal(
    successor.difference.unchanged_pattern_definition_ids.length,
    42,
  );
});

test('rejects changed source meaning without a source catalogue version increase', () => {
  const initial = buildProductNavigationCatalogueManifest(manifestInputs());
  const sources = sourceCatalogues();
  sources[0].definition.domains[0].topics[0].patterns[1].label =
    'No-shop covenant';
  const successorAdmission = releaseAdmission(sources, {
    domainOrder: ['AGREEMENT', 'PROCESS'],
    previousManifest: initial,
  });
  assert.throws(
    () => buildProductNavigationCatalogueManifest({
      source_catalogues: sources,
      release_admission: successorAdmission,
      previous_manifest: initial,
    }),
    (error) => error.code === 'INVALID_PRODUCT_NAVIGATION_RELEASE_ADMISSION',
  );
});

test('rejects a changed or rehashed manifest', () => {
  const manifest = clone(
    buildProductNavigationCatalogueManifest(manifestInputs()),
  );
  manifest.navigation_definition.domains[0].label = 'Contracts';
  assert.throws(
    () => validateProductNavigationCatalogueManifest(manifest),
    (error) => error.code
      === 'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );

  const rehashed = clone(
    buildProductNavigationCatalogueManifest(manifestInputs()),
  );
  rehashed.manifest_id = digest('attacker-manifest-id');
  rehashed.canonical_payload_digest = digest('attacker-payload');
  assert.throws(
    () => validateProductNavigationCatalogueManifest(rehashed),
    (error) => error.code
      === 'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );
});

test('rejects correctly rehashed semantic forgery', () => {
  const forgedSource = clone(
    buildProductNavigationCatalogueManifest(manifestInputs()),
  );
  forgedSource.pattern_certifications[0].source_stable_id =
    'FORGED_NAVIGATION_SOURCE';
  resignManifest(forgedSource);
  assert.throws(
    () => validateProductNavigationCatalogueManifest(forgedSource),
    (error) => error.code
      === 'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );

  const forgedDifference = clone(
    buildProductNavigationCatalogueManifest(manifestInputs()),
  );
  forgedDifference.difference.added_pattern_definition_ids[0] =
    digest('invented-pattern-definition');
  forgedDifference.difference.added_pattern_definition_ids.sort();
  resignManifest(forgedDifference);
  assert.throws(
    () => validateProductNavigationCatalogueManifest(forgedDifference),
    (error) => error.code
      === 'INVALID_PRODUCT_NAVIGATION_CATALOGUE_MANIFEST',
  );
});

test('the compiler has no fetch, database, write, serving, or activation path', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../lib/canonical-v2/product-navigation-catalogue.js',
    ),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /\b(?:fetch|writeFile|supabase|process\.env|activateRelease|serveResult)\b/,
  );
  assert.equal(
    canonicalJson(
      buildProductNavigationCatalogueManifest(manifestInputs()),
    ),
    canonicalJson(
      buildProductNavigationCatalogueManifest(manifestInputs()),
    ),
  );
});
