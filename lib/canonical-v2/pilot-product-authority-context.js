const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('./canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundle,
} = require('./canonical-contract-bundle-compiler');
const {
  validateCandidateReleaseManifest,
} = require('./candidate-release');
const {
  buildPilotProductFieldCatalogueManifest,
} = require('./pilot-product-field-catalogue');
const {
  productFieldCatalogueQueryAdmission,
} = require('./product-field-catalogue');
const {
  buildProductNavigationCatalogueManifest,
  productNavigationQueryAdmission,
  sourceNavigationCataloguePayloadDigest,
} = require('./product-navigation-catalogue');

const agreementNavigationSource = require(
  '../../contracts/canonical-v2/successor/agreement/navigation/qxo-capitalisation-navigation-definition-catalogue.v1.json',
);
const processNavigationSource = require(
  '../../contracts/canonical-v2/successor/process/navigation/process-navigation-definition-catalogue.v2.json',
);
const processPredicateCatalogue = require(
  '../../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);
const agreementRepresentationPredicateCatalogue = require(
  '../../contracts/canonical-v2/successor/agreement/predicates/qxo-capitalisation-representation-predicate-catalogue.v1.json',
);
const agreementCovenantPredicateCatalogue = require(
  '../../contracts/canonical-v2/successor/agreement/predicates/qxo-capex-restriction-predicate-catalogue.v1.json',
);
const targetCapitalisationResult = require(
  '../../contracts/canonical-v2/successor/agreement/result-definitions/target-capitalisation-bring-down.v3.json',
);
const targetCapexResult = require(
  '../../contracts/canonical-v2/successor/agreement/result-definitions/target-capex-restriction.v1.json',
);
const resultCompositionEvidenceAction = require(
  '../../contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/result-composition-evidence.v1.json',
);
const resultComponentClaimEvidenceAction = require(
  '../../contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/result-component-claim-evidence.v1.json',
);
const sharedFieldCatalogue = require(
  '../../contracts/canonical-v2/successor/shared/field-definitions/shared-deal-field-catalogue.v1.json',
);
const processFieldCatalogue = require(
  '../../contracts/canonical-v2/successor/process/fields/process-field-definition-catalogue.v1.json',
);

const PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA =
  'PILOT_PRODUCT_AUTHORITY_CONTEXT/V1';
const AUTHORITY_LIMITS = Object.freeze({
  query_execution: 'NONE',
  source_read: 'NONE',
  extraction: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});
class PilotProductAuthorityContextError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotProductAuthorityContextError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new PilotProductAuthorityContextError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the closed contract.`, {
      actual,
      expected: required,
    });
  }
}

function compilerInput(proposal, inputCompilation) {
  return {
    canonical_contract_input_compilation: inputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  };
}

function rebuildCurrentRoot(inputCompilation) {
  let proposal;
  let bundle;
  try {
    proposal = assembleCanonicalContractBundleCurrentRootProposal({
      canonical_contract_input_compilation: inputCompilation,
    });
    bundle = compileCanonicalContractBundle(compilerInput(proposal, inputCompilation));
  } catch (error) {
    fail('INVALID_CURRENT_ROOT_COMPILATION', 'The supplied current-root compilation is invalid.', {
      cause: error.code || error.message,
    });
  }
  return { proposal, bundle };
}

function validateCompiledBundle(value, expected) {
  const code = 'INVALID_COMPILED_BUNDLE_METADATA';
  requireExactKeys(value, [
    'schema_version',
    'canonical_contract_bundle_members',
    'canonical_contract_bundle_projection',
    'contract_bundle_id',
    'contract_bundle_digest',
    'canonical_contract_bundle_member_root',
    'canonical_contract_bundle_required_kind_set_root',
    'compile_report',
    'compile_report_digest',
    'dependency_cycle_report',
    'cycle_report_digest',
    'canonical_payload_digest',
    'disposition',
  ], 'compiled_contract_bundle', code);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'The compiled bundle is not the exact current-root compiler output.');
  }
  return clone(value);
}

function sourceValues(bundle) {
  const values = [];
  for (const member of bundle.canonical_contract_bundle_members) {
    const source = JSON.parse(Buffer.from(member.source_bytes_base64, 'base64').toString('utf8'));
    values.push(...source.ordered_authored_members.map((entry) => entry.canonical_value));
  }
  return values;
}

function exactBundleSource(bundle, expected, label) {
  const matches = sourceValues(bundle).filter((value) => (
    value?.object_kind === expected.object_kind
      && value?.stable_id === expected.stable_id
      && value?.schema_version === expected.schema_version
  ));
  if (matches.length !== 1 || canonicalJson(matches[0]) !== canonicalJson(expected)) {
    fail('BUNDLE_SOURCE_CONTRACT_MISMATCH', `${label} is absent from the exact compiled bundle.`);
  }
  return clone(matches[0]);
}

function validateCandidateRelease(manifest) {
  try {
    validateCandidateReleaseManifest(manifest);
  } catch (error) {
    fail('INVALID_CANDIDATE_RELEASE_MANIFEST', 'The candidate release manifest is invalid.', {
      cause: error.message,
    });
  }
  return clone(manifest);
}

function identity(domain, body) {
  return contentId(domain, body);
}

function sourcePayloadDigest(source) {
  return sha256Hex(Buffer.from(canonicalJson(source), 'utf8'));
}

function sourceAdmission(source) {
  const domains = source.definition.domains;
  const topicCount = domains.reduce((count, domain) => count + domain.topics.length, 0);
  const patternCount = domains.reduce(
    (count, domain) => count + domain.topics.reduce(
      (topicTotal, topic) => topicTotal + topic.patterns.length,
      0,
    ),
    0,
  );
  return {
    source_stable_id: source.stable_id,
    source_schema_version: source.schema_version,
    source_catalogue_version: source.definition.catalogue_version,
    source_payload_digest: sourceNavigationCataloguePayloadDigest(source),
    source_domain_count: domains.length,
    source_topic_count: topicCount,
    source_pattern_count: patternCount,
  };
}

function pmDataVersionId({ bundle, candidateRelease, sources }) {
  return identity('PILOT_PM_DATA_VERSION/V1', {
    contract_bundle_id: bundle.contract_bundle_id,
    contract_bundle_digest: bundle.contract_bundle_digest,
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: candidateRelease.canonical_payload_digest,
    source_contracts: sources.map((source) => ({
      object_kind: source.object_kind,
      stable_id: source.stable_id,
      schema_version: source.schema_version,
      source_payload_digest: sourcePayloadDigest(source),
    })).sort((left, right) => (
      canonicalJson(left).localeCompare(canonicalJson(right))
    )),
  });
}

function navigationReleaseAdmission({ pmDataVersionId, candidateRelease, bundle, sources }) {
  const binding = {
    approved_pm_data_version_id: pmDataVersionId,
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: candidateRelease.canonical_payload_digest,
    contract_bundle_id: bundle.contract_bundle_id,
    contract_bundle_digest: bundle.contract_bundle_digest,
  };
  const patterns = sources.flatMap((source) => source.definition.domains.flatMap(
    (domain) => domain.topics.flatMap((topic) => topic.patterns.map((pattern) => ({
      source_stable_id: source.stable_id,
      domain_key: domain.domain_key,
      topic_key: topic.topic_key,
      pattern_key: pattern.pattern_key,
      predicate_key: pattern.predicate_key,
      predicate_version: pattern.predicate_version,
    }))),
  ));
  const patternIdentity = (pattern) => canonicalJson([
    pattern.source_stable_id,
    pattern.domain_key,
    pattern.topic_key,
    pattern.pattern_key,
  ]);
  return {
    schema_version: 'PRODUCT_NAVIGATION_RELEASE_ADMISSION/V1',
    approved_pm_data_version_id: pmDataVersionId,
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: candidateRelease.canonical_payload_digest,
    catalogue_generator_identity: {
      stable_id: 'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_GENERATOR',
      version: 1,
      payload_digest: identity('PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_GENERATOR/V1', binding),
    },
    source_catalogue_admissions: sources.map(sourceAdmission).sort((left, right) => (
      canonicalJson(left).localeCompare(canonicalJson(right))
    )),
    pattern_dispositions: patterns.map((pattern) => ({
      ...pattern,
      decision: 'INCLUDE',
      certification_identity: {
        stable_id: 'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_PATTERN_CERTIFICATION',
        version: 1,
        payload_digest: identity(
          'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_PATTERN_CERTIFICATION/V1',
          { ...binding, pattern },
        ),
      },
      exclusion_reason_code: null,
      exclusion_evidence_identity: null,
    })).sort((left, right) => patternIdentity(left).localeCompare(patternIdentity(right))),
    required_initial_domain_keys: ['AGREEMENT', 'PROCESS'],
    domain_order: ['AGREEMENT', 'PROCESS'],
    enumeration_certification: {
      independent_source_enumeration_identity: {
        stable_id: 'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_ENUMERATION',
        version: 1,
        payload_digest: identity(
          'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_ENUMERATION/V1',
          { ...binding, source_catalogue_admissions: sources.map(sourceAdmission) },
        ),
      },
      inclusion_exclusion_reconciliation_identity: {
        stable_id: 'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_RECONCILIATION',
        version: 1,
        payload_digest: identity(
          'PILOT_PRODUCT_AUTHORITY_CONTEXT_NAVIGATION_RECONCILIATION/V1',
          { ...binding, patterns },
        ),
      },
    },
    previous_catalogue_identity: null,
  };
}

function certificationIdentities(fieldManifest, navigationManifest, predicateAdmissions) {
  return {
    field_enumeration: clone(fieldManifest.basis.source_registry.enumeration_certification),
    field_certifications: fieldManifest.field_definitions.map((field) => ({
      field_key: field.field_key,
      field_version: field.field_version,
      certification_identity: clone(field.certification_identity),
    })),
    navigation_enumeration: clone(navigationManifest.basis.enumeration_certification),
    navigation_pattern_certifications: navigationManifest.pattern_certifications.map((entry) => clone(entry)),
    predicate_admission_ids: predicateAdmissions.map(
      (admission) => admission.admission_id,
    ).sort(),
  };
}

function agreementPredicateAdmission({
  bundle,
  candidateRelease,
  pmDataVersion,
  agreementNavigation,
  predicateCatalogue,
  resultDefinition,
  detailAction,
}) {
  const code = 'INVALID_AGREEMENT_PREDICATE_AUTHORITY_SOURCE';
  const admissions = predicateCatalogue.definition?.predicate_admissions;
  if (!Array.isArray(admissions) || admissions.length !== 1) {
    fail(code, 'The Agreement predicate catalogue must contain one closed admission.');
  }
  const source = admissions[0];
  const matchingPatterns = agreementNavigation.definition.domains
    .flatMap((domain) => domain.topics.map((topic) => ({ domain, topic })))
    .filter(({ topic }) => (
      topic.predicate_catalogue_stable_id === predicateCatalogue.stable_id
    ))
    .flatMap(({ domain, topic }) => topic.patterns.map((pattern) => ({
      domain_key: domain.domain_key,
      topic_key: topic.topic_key,
      ...pattern,
    })))
    .filter((pattern) => (
      pattern.predicate_key === source.predicate_key
      && pattern.predicate_version === source.predicate_version
    ));
  if (
    matchingPatterns.length !== 1
    || predicateCatalogue.definition.domain_key !== 'AGREEMENT'
    || matchingPatterns[0].domain_key !== 'AGREEMENT'
    || matchingPatterns[0].topic_key !== predicateCatalogue.definition.topic_key
    || resultDefinition.stable_id !== source.result_definition_stable_id
    || resultDefinition.authored_definition?.result_key
      !== source.result_definition_stable_id
    || resultDefinition.authored_definition?.result_version
      !== source.result_definition_version
    || detailAction.stable_id !== source.exact_detail_action_stable_id
    || detailAction.action_version !== source.exact_detail_action_version
    || detailAction.whole_document_permission !== false
  ) {
    fail(code, 'The Agreement predicate does not close over its navigation, result and action.');
  }
  const identityInput = {
    approved_pm_data_version_id: pmDataVersion,
    candidate_release_manifest_id:
      candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateRelease.canonical_payload_digest,
    contract_bundle_id: bundle.contract_bundle_id,
    contract_bundle_digest: bundle.contract_bundle_digest,
    predicate_catalogue_stable_id: predicateCatalogue.stable_id,
    predicate_catalogue_payload_digest:
      sourcePayloadDigest(predicateCatalogue),
    result_definition_stable_id: resultDefinition.stable_id,
    result_definition_payload_digest:
      sourcePayloadDigest(resultDefinition),
    exact_detail_action_stable_id: detailAction.stable_id,
    exact_detail_action_payload_digest:
      sourcePayloadDigest(detailAction),
  };
  return {
    domain_key: 'AGREEMENT',
    predicate_key: source.predicate_key,
    predicate_version: source.predicate_version,
    admission_id: identity(
      'PILOT_PRODUCT_AUTHORITY_CONTEXT_PREDICATE_ADMISSION/V1',
      identityInput,
    ),
    result_definitions: [{
      stable_id: source.result_definition_stable_id,
      version: source.result_definition_version,
    }],
    evidence_requirement_ids: [
      'EXACT_CLAIM',
      'EXACT_SOURCE_CITATION',
    ],
  };
}

function buildContext(input) {
  const code = 'INVALID_PILOT_PRODUCT_AUTHORITY_CONTEXT_INPUT';
  requireExactKeys(input, [
    'canonical_contract_input_compilation',
    'compiled_contract_bundle',
    'candidate_release_manifest',
  ], 'authority-context input', code);
  const rebuilt = rebuildCurrentRoot(input.canonical_contract_input_compilation);
  const bundle = validateCompiledBundle(input.compiled_contract_bundle, rebuilt.bundle);
  const candidateRelease = validateCandidateRelease(input.candidate_release_manifest);
  const agreementNavigation = exactBundleSource(bundle, agreementNavigationSource, 'Agreement navigation contract');
  const processNavigation = exactBundleSource(bundle, processNavigationSource, 'Process navigation contract');
  const predicateCatalogue = exactBundleSource(bundle, processPredicateCatalogue, 'Process predicate catalogue');
  const representationPredicateCatalogue = exactBundleSource(
    bundle,
    agreementRepresentationPredicateCatalogue,
    'Agreement representation predicate catalogue',
  );
  const covenantPredicateCatalogue = exactBundleSource(
    bundle,
    agreementCovenantPredicateCatalogue,
    'Agreement covenant predicate catalogue',
  );
  const capitalisationResult = exactBundleSource(
    bundle,
    targetCapitalisationResult,
    'Target capitalisation result definition',
  );
  const capexResult = exactBundleSource(
    bundle,
    targetCapexResult,
    'Target capex result definition',
  );
  const compositionAction = exactBundleSource(
    bundle,
    resultCompositionEvidenceAction,
    'Agreement result composition action',
  );
  const claimEvidenceAction = exactBundleSource(
    bundle,
    resultComponentClaimEvidenceAction,
    'Agreement result-component claim-evidence action',
  );
  const sharedFields = exactBundleSource(bundle, sharedFieldCatalogue, 'Shared field catalogue');
  const processFields = exactBundleSource(bundle, processFieldCatalogue, 'Process field catalogue');
  if (!predicateCatalogue.definition.ordinary_question_contract.mandatory_predicate_keys.includes('EXCLUSIVITY_GRANTED')) {
    fail('MISSING_EXCLUSIVITY_GRANTED_PREDICATE', 'The exact Process predicate catalogue does not admit EXCLUSIVITY_GRANTED.');
  }
  const authoritySources = [
    agreementNavigation,
    processNavigation,
    predicateCatalogue,
    representationPredicateCatalogue,
    covenantPredicateCatalogue,
    capitalisationResult,
    capexResult,
    compositionAction,
    claimEvidenceAction,
    sharedFields,
    processFields,
  ];
  const derivedPmDataVersionId = pmDataVersionId({
    bundle,
    candidateRelease,
    sources: authoritySources,
  });
  const release = {
    approved_pm_data_version_id: derivedPmDataVersionId,
    candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: candidateRelease.canonical_payload_digest,
  };
  const fieldManifest = buildPilotProductFieldCatalogueManifest(release);
  const sources = [agreementNavigation, processNavigation].sort((left, right) => (
    `${left.stable_id}\0${left.schema_version}`.localeCompare(
      `${right.stable_id}\0${right.schema_version}`,
    )
  ));
  const navigationManifest = buildProductNavigationCatalogueManifest({
    source_catalogues: sources,
    release_admission: navigationReleaseAdmission({
      pmDataVersionId: derivedPmDataVersionId,
      candidateRelease,
      bundle,
      sources,
    }),
  });
  const predicateAdmission = {
    domain_key: 'PROCESS',
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    admission_id: identity('PILOT_PRODUCT_AUTHORITY_CONTEXT_PREDICATE_ADMISSION/V1', {
      approved_pm_data_version_id: derivedPmDataVersionId,
      candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest: candidateRelease.canonical_payload_digest,
      contract_bundle_id: bundle.contract_bundle_id,
      contract_bundle_digest: bundle.contract_bundle_digest,
      predicate_catalogue_payload_digest: sourcePayloadDigest(predicateCatalogue),
      predicate_key: 'EXCLUSIVITY_GRANTED',
      predicate_version: 1,
    }),
    result_definitions: [{
      stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      version: 1,
    }],
    evidence_requirement_ids: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
  };
  const predicateAdmissions = [
    agreementPredicateAdmission({
      bundle,
      candidateRelease,
      pmDataVersion: derivedPmDataVersionId,
      agreementNavigation,
      predicateCatalogue: representationPredicateCatalogue,
      resultDefinition: capitalisationResult,
      detailAction: compositionAction,
    }),
    agreementPredicateAdmission({
      bundle,
      candidateRelease,
      pmDataVersion: derivedPmDataVersionId,
      agreementNavigation,
      predicateCatalogue: covenantPredicateCatalogue,
      resultDefinition: capexResult,
      detailAction: claimEvidenceAction,
    }),
    predicateAdmission,
  ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const coverageIdentities = predicateAdmissions.map((admission) => identity(
    'PILOT_PRODUCT_AUTHORITY_CONTEXT_COVERAGE_ADMISSION/V1',
    {
      approved_pm_data_version_id: derivedPmDataVersionId,
      candidate_release_manifest_id:
        candidateRelease.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        candidateRelease.canonical_payload_digest,
      contract_bundle_id: bundle.contract_bundle_id,
      contract_bundle_digest: bundle.contract_bundle_digest,
      domain_key: admission.domain_key,
      predicate_key: admission.predicate_key,
      predicate_version: admission.predicate_version,
    },
  )).sort();
  const fieldQueryAdmission =
    productFieldCatalogueQueryAdmission(fieldManifest);
  const navigationQueryAdmission =
    productNavigationQueryAdmission(navigationManifest);
  const productQueryAdmissionContext = {
    schema_version: 'PRODUCT_QUERY_ADMISSION_CONTEXT/V1',
    approved_pm_data_version_id: derivedPmDataVersionId,
    candidate_release_manifest_id:
      candidateRelease.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateRelease.canonical_payload_digest,
    canonical_contract_identity: {
      stable_id: 'CANONICAL_CONTRACT_BUNDLE',
      version: 1,
      payload_digest: bundle.canonical_payload_digest,
    },
    product_field_catalogue: fieldQueryAdmission,
    navigation_catalogue: navigationQueryAdmission,
    predicate_admissions: predicateAdmissions,
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'PROCESS_NARRATION_EVIDENCE',
      'RESULT_COMPOSITION_EVIDENCE',
      'RESULT_COMPONENT_CLAIM_EVIDENCE',
    ],
    coverage_identities: coverageIdentities,
    route_budget: {
      maximum_page_size: 12,
    },
  };
  const body = {
    schema_version: PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
    approved_pm_data_version_id: derivedPmDataVersionId,
    canonical_contract_bundle: {
      contract_bundle_id: bundle.contract_bundle_id,
      contract_bundle_digest: bundle.contract_bundle_digest,
      canonical_payload_digest: bundle.canonical_payload_digest,
    },
    candidate_release_manifest: {
      candidate_release_manifest_id: candidateRelease.candidate_release_manifest_id,
      canonical_payload_digest: candidateRelease.canonical_payload_digest,
      corpus_release_id: candidateRelease.corpus_release_id,
    },
    product_field_catalogue_manifest: fieldManifest,
    product_field_catalogue_query_admission: fieldQueryAdmission,
    product_navigation_catalogue_manifest: navigationManifest,
    product_navigation_catalogue_query_admission:
      navigationQueryAdmission,
    predicate_catalogue_bindings: [
      {
        domain_key: 'AGREEMENT',
        stable_id: representationPredicateCatalogue.stable_id,
        schema_version: representationPredicateCatalogue.schema_version,
        source_payload_digest:
          sourcePayloadDigest(representationPredicateCatalogue),
      },
      {
        domain_key: 'AGREEMENT',
        stable_id: covenantPredicateCatalogue.stable_id,
        schema_version: covenantPredicateCatalogue.schema_version,
        source_payload_digest:
          sourcePayloadDigest(covenantPredicateCatalogue),
      },
      {
        domain_key: 'PROCESS',
        stable_id: predicateCatalogue.stable_id,
        schema_version: predicateCatalogue.schema_version,
        source_payload_digest: sourcePayloadDigest(predicateCatalogue),
      },
    ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
    predicate_admissions: predicateAdmissions,
    product_query_admission_context: productQueryAdmissionContext,
    certification_identities: certificationIdentities(
      fieldManifest,
      navigationManifest,
      predicateAdmissions,
    ),
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    authority_context_id: contentId(PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA, body),
    ...body,
  };
}

function compilePilotProductAuthorityContext(input) {
  return deepFreeze(clone(buildContext(input)));
}

function validatePilotProductAuthorityContext(value, input) {
  const rebuilt = buildContext(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('PILOT_PRODUCT_AUTHORITY_CONTEXT_DRIFT', 'The authority context no longer matches its verified inputs.');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
  PilotProductAuthorityContextError,
  compilePilotProductAuthorityContext,
  validatePilotProductAuthorityContext,
};
