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
  compileProductAskQuery,
} = require('../lib/canonical-v2/product-ask-compiler');
const {
  compileProductBrowseQuery,
  listProductBrowseOptions,
} = require('../lib/canonical-v2/product-browse-compiler');
const {
  buildProductAskMappingRegistryManifest,
  PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
  normalizeProductAskPhrase,
  productAskMappingRegistryAdmission,
  productAskMappingRegistryPayloadDigest,
} = require('../lib/canonical-v2/product-ask-mapping-registry');
const {
  buildProductNavigationCatalogueManifest,
  navigationDefinitionPayloadDigest,
  productNavigationQueryAdmission,
  sourceNavigationCataloguePayloadDigest,
} = require('../lib/canonical-v2/product-navigation-catalogue');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_IR_SCHEMA,
  canonicalProductQueryIrBytes,
} = require('../lib/canonical-v2/product-query-ir');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const AGREEMENT_RESULT = Object.freeze({
  stable_id: 'AGREEMENT_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const PROCESS_RESULT = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const CVR_RESULT = Object.freeze({
  stable_id: 'CVR_MILESTONE_PASSAGE_RESULT',
  version: 1,
});
const PRE_V2_PRODUCT_NAVIGATION_ID =
  'b30038c5806fccbc3bf4e9e79feffb84220aff984bad361e61f8e31fc228b21d';
const PRE_V2_PRODUCT_NAVIGATION_PAYLOAD_DIGEST =
  '5a60e9b870cb5c3032f5d1df2166381c4a651c14dbee7d626395b5ed982f7179';
const V2_PRODUCT_NAVIGATION_ID =
  '716b65d47b91447857b119588cbe15e18917b90565b4fdc5f22b57bcebee1961';
const V2_PRODUCT_NAVIGATION_PAYLOAD_DIGEST =
  '7a2258ab2169a472c03cbb420596cb3a637014afe9533c5f2430b313c90f7eca';
const METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES = '{"cohort_contract":{"cohort_definition_id":"e6bcbdbe316c7391ab11e39d8fa2dbc6dd0b80e5352d12f165711bc984b9769f","cohort_definition_payload_digest":"b4827996ea5eae663805d7ebecf6c4542632c862524871f91ef4f6c9f25af159"},"coverage_contract":{"coverage_identity":"5bfa89491ff10fc6fe3021542ac40ab5f16b51cb8497c11678649ce423654f59","coverage_payload_digest":"8a20e84e7863ae92abe696ccf947b3e053c55a3cd07f5f4d622de24642c91f3e","covered_set_identity":"9859b566397cb515e7d419d3e4840d521f407af0158219814379f39bff295311","exclusions_identity":"bd5dcbcdf99538c2482e69b121ce52a8957575cffd96457017f8e83cbcbaf57f"},"detail_action_contract":{"actions":["PARENT_BOUND_PARAGRAPH_CONTEXT"]},"filter_contract":{"clauses":[{"completeness_semantics":"UNKNOWN_IF_NOT_ADMITTED","field_key":"process_phase","field_scope":"SAME_DEAL","field_version":1,"multiplicity":"ZERO_OR_ONE","operator":"EQ","value":"ADMITTED_VALUE"}]},"pagination_contract":{"cursor":null,"page_size":25},"presentation_contract":{"diversity":{"definition_id":"89153eff87621c98f3e362570d8217e95600c8ef3d3694ad113b8f6b4406a6a8","payload_digest":"da4b4e651931424d422359ed6ef1d7c74c5241c6f3c38ad3f9aef73abd562f4e"},"requested_columns":[{"field_key":"process_phase","field_version":1}],"sort":[{"direction":"ASC","field_key":"process_phase","field_version":1}]},"query_definition_id":"f8368787b985334f9121bcb0ee48fbb3ab8b5569f883935aa5c03b8edf4be759","release_contract":{"approved_pm_data_version_id":"e1ea0f882c9fc12f0d4fdce6bf352d58ac10afc34d41e7fe47d18ef72c2a0208","candidate_release_manifest_id":"6d04f28cfd9932f8bf794069059705bbfcc41c49145a62803ae988af2e44ecf9","candidate_release_manifest_payload_digest":"398169dab7ca863dc8854f6c063898ec288a23a85f81ba72032223d7a06d00cf","canonical_contract_identity":{"payload_digest":"96a2b75621fb83e51c55c7b908fd5c3d39c733c6674643f3f278e003bdca4356","stable_id":"CANONICAL_CONTRACT_BUNDLE","version":1},"navigation_catalogue_id":"716b65d47b91447857b119588cbe15e18917b90565b4fdc5f22b57bcebee1961","navigation_catalogue_payload_digest":"7a2258ab2169a472c03cbb420596cb3a637014afe9533c5f2430b313c90f7eca","product_field_catalogue_manifest_id":"72c0a4c5aee554fb7364c6dd68e62d4f2cc0ef9bdfe233bcaa38fc87ed725c0b","product_field_catalogue_payload_digest":"1f09f92223d2a9abb0bb02e779ba8f3a2790caade384d781f6200d7fec858d81"},"schema_version":"PRODUCT_QUERY_IR/V1","semantic_contract":{"domain_key":"PROCESS","evidence_requirement_ids":["EXACT_PASSAGE","EXACT_SOURCE_CITATION"],"predicate_admission_id":"f572c41a8c5e8cf9688a6dd564f830f395b40360090530d0fad6b2bb0408f64a","predicate_key":"EXCLUSIVITY_GRANTED","predicate_version":1,"result_definition":{"stable_id":"PROCESS_PHRASEBOOK_PASSAGE_RESULT","version":1}}}';
const METSERA_GRANTED_PRE_V2_SEMANTIC_QUERY_BODY = '{"cohort_contract":{"cohort_definition_id":"e6bcbdbe316c7391ab11e39d8fa2dbc6dd0b80e5352d12f165711bc984b9769f","cohort_definition_payload_digest":"b4827996ea5eae663805d7ebecf6c4542632c862524871f91ef4f6c9f25af159"},"coverage_contract":{"coverage_identity":"5bfa89491ff10fc6fe3021542ac40ab5f16b51cb8497c11678649ce423654f59","coverage_payload_digest":"8a20e84e7863ae92abe696ccf947b3e053c55a3cd07f5f4d622de24642c91f3e","covered_set_identity":"9859b566397cb515e7d419d3e4840d521f407af0158219814379f39bff295311","exclusions_identity":"bd5dcbcdf99538c2482e69b121ce52a8957575cffd96457017f8e83cbcbaf57f"},"detail_action_contract":{"actions":["PARENT_BOUND_PARAGRAPH_CONTEXT"]},"filter_contract":{"clauses":[{"completeness_semantics":"UNKNOWN_IF_NOT_ADMITTED","field_key":"process_phase","field_scope":"SAME_DEAL","field_version":1,"multiplicity":"ZERO_OR_ONE","operator":"EQ","value":"ADMITTED_VALUE"}]},"pagination_contract":{"cursor":null,"page_size":25},"presentation_contract":{"diversity":{"definition_id":"89153eff87621c98f3e362570d8217e95600c8ef3d3694ad113b8f6b4406a6a8","payload_digest":"da4b4e651931424d422359ed6ef1d7c74c5241c6f3c38ad3f9aef73abd562f4e"},"requested_columns":[{"field_key":"process_phase","field_version":1}],"sort":[{"direction":"ASC","field_key":"process_phase","field_version":1}]},"release_contract":{"approved_pm_data_version_id":"e1ea0f882c9fc12f0d4fdce6bf352d58ac10afc34d41e7fe47d18ef72c2a0208","candidate_release_manifest_id":"6d04f28cfd9932f8bf794069059705bbfcc41c49145a62803ae988af2e44ecf9","candidate_release_manifest_payload_digest":"398169dab7ca863dc8854f6c063898ec288a23a85f81ba72032223d7a06d00cf","canonical_contract_identity":{"payload_digest":"96a2b75621fb83e51c55c7b908fd5c3d39c733c6674643f3f278e003bdca4356","stable_id":"CANONICAL_CONTRACT_BUNDLE","version":1},"navigation_catalogue_id":"b30038c5806fccbc3bf4e9e79feffb84220aff984bad361e61f8e31fc228b21d","navigation_catalogue_payload_digest":"5a60e9b870cb5c3032f5d1df2166381c4a651c14dbee7d626395b5ed982f7179","product_field_catalogue_manifest_id":"72c0a4c5aee554fb7364c6dd68e62d4f2cc0ef9bdfe233bcaa38fc87ed725c0b","product_field_catalogue_payload_digest":"1f09f92223d2a9abb0bb02e779ba8f3a2790caade384d781f6200d7fec858d81"},"schema_version":"PRODUCT_QUERY_IR/V1","semantic_contract":{"domain_key":"PROCESS","evidence_requirement_ids":["EXACT_PASSAGE","EXACT_SOURCE_CITATION"],"predicate_admission_id":"f572c41a8c5e8cf9688a6dd564f830f395b40360090530d0fad6b2bb0408f64a","predicate_key":"EXCLUSIVITY_GRANTED","predicate_version":1,"result_definition":{"stable_id":"PROCESS_PHRASEBOOK_PASSAGE_RESULT","version":1}}}';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function identity(label) {
  return {
    stable_id: label,
    version: 1,
    payload_digest: digest(label),
  };
}

function versionedIdentity(stableId) {
  return {
    stable_id: stableId,
    version: 1,
    payload_digest: digest(`${stableId}:1`),
  };
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
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

function productPatternIdentity(value) {
  return [
    value.domain_key,
    value.topic_key,
    value.pattern_key,
  ].join('\0');
}

function sourceNavigationIdentity(value) {
  return `${value.stable_id}\0${value.schema_version}`;
}

function sourceNavigationPatterns(source) {
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

function sourceNavigationCounts(source) {
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

function sourceNavigationAdmission(source) {
  const counts = sourceNavigationCounts(source);
  return {
    source_stable_id: source.stable_id,
    source_schema_version: source.schema_version,
    source_catalogue_version: source.definition.catalogue_version,
    source_payload_digest: sourceNavigationCataloguePayloadDigest(source),
    source_domain_count: counts.domains,
    source_topic_count: counts.topics,
    source_pattern_count: counts.patterns,
  };
}

function realAgreementNavigationSource() {
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
      hierarchy_contract: {
        levels: ['DOMAIN', 'TOPIC', 'PATTERN'],
        maximum_depth: 3,
        selected_topic_controls_pattern_membership: true,
        all_is_catalogue_navigation_not_union_query: true,
        remaining_distinctions_are_fields_or_predicates: true,
        display_only_entry_permitted: false,
      },
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
      admission_contract: {
        domain_topic_and_pattern_compile_to_one_query_ir: true,
        pattern_requires_exact_predicate_admission: true,
        unknown_domain_topic_pattern_or_predicate_has_runtime_path: false,
        failed_predicate_cannot_enter_through_passing_sibling: true,
        cross_domain_boolean_query_permitted_without_composite_contract: false,
        ask_and_browse_byte_equivalence_required: true,
      },
      authority_contract: {
        creates_runtime_navigation: false,
        creates_query_authority: false,
        creates_extraction_authority: false,
        creates_writer_authority: false,
        creates_serving_authority: false,
        creates_release_authority: false,
        creates_contract_freeze_authority: false,
      },
    },
  };
}

function realProcessV2NavigationSource() {
  return JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      'process/navigation/process-navigation-definition-catalogue.v2.json',
    ),
    'utf8',
  ));
}

function realV2ProductNavigationManifest() {
  const sources = [
    realAgreementNavigationSource(),
    realProcessV2NavigationSource(),
  ].sort((left, right) => compareText(
    sourceNavigationIdentity(left),
    sourceNavigationIdentity(right),
  ));
  const dispositions = sources
    .flatMap(sourceNavigationPatterns)
    .map((entry) => ({
      ...entry,
      decision: 'INCLUDE',
      certification_identity: versionedIdentity(
        [
          entry.domain_key,
          entry.predicate_key,
          entry.predicate_version,
          'NAVIGATION_CERTIFICATION',
        ].join('_'),
      ),
      exclusion_reason_code: null,
      exclusion_evidence_identity: null,
    }))
    .sort((left, right) => compareText(
      `${left.source_stable_id}\0${productPatternIdentity(left)}`,
      `${right.source_stable_id}\0${productPatternIdentity(right)}`,
    ));
  return buildProductNavigationCatalogueManifest({
    source_catalogues: sources,
    release_admission: {
      schema_version: 'PRODUCT_NAVIGATION_RELEASE_ADMISSION/V1',
      approved_pm_data_version_id: digest('approved-pm-data-version'),
      candidate_release_manifest_id: digest('candidate-release-manifest'),
      candidate_release_manifest_payload_digest:
        digest('candidate-release-manifest-payload'),
      catalogue_generator_identity:
        versionedIdentity('PRODUCT_NAVIGATION_CATALOGUE_GENERATOR'),
      source_catalogue_admissions: sources
        .map(sourceNavigationAdmission)
        .sort((left, right) => compareText(
          `${left.source_stable_id}\0${left.source_schema_version}`,
          `${right.source_stable_id}\0${right.source_schema_version}`,
        )),
      pattern_dispositions: dispositions,
      required_initial_domain_keys: ['AGREEMENT', 'PROCESS'],
      domain_order: ['AGREEMENT', 'PROCESS'],
      enumeration_certification: {
        independent_source_enumeration_identity:
          versionedIdentity('NAVIGATION_INDEPENDENT_SOURCE_ENUMERATION'),
        inclusion_exclusion_reconciliation_identity:
          versionedIdentity('NAVIGATION_INCLUSION_EXCLUSION_RECONCILIATION'),
      },
      previous_catalogue_identity: null,
    },
  });
}

function navigationDefinition({ includeCvr = false } = {}) {
  const domains = [
    {
      domain_key: 'AGREEMENT',
      label: 'Agreement',
      domain_registry_stable_id: 'AGREEMENT',
      topics: [{
        topic_key: 'DEAL_PROTECTIONS',
        label: 'Deal protections',
        predicate_catalogue_stable_id:
          'AGREEMENT_DEAL_PROTECTION_PREDICATE_CATALOGUE',
        patterns: [
          pattern('NO_SHOP', 'No-shop'),
        ],
      }],
    },
    {
      domain_key: 'PROCESS',
      label: 'Process',
      domain_registry_stable_id: 'PROCESS',
      topics: [{
        topic_key: 'EXCLUSIVITY',
        label: 'Exclusivity',
        predicate_catalogue_stable_id:
          'PROCESS_EXCLUSIVITY_PREDICATE_CATALOGUE',
        patterns: [
          pattern('EXCLUSIVITY_GRANTED', 'Exclusivity granted'),
        ],
      }],
    },
  ];
  if (includeCvr) {
    domains.splice(1, 0, {
      domain_key: 'CVR',
      label: 'CVR',
      domain_registry_stable_id: 'CVR',
      topics: [{
        topic_key: 'MILESTONES',
        label: 'Milestones',
        predicate_catalogue_stable_id:
          'CVR_MILESTONE_PREDICATE_CATALOGUE',
        patterns: [
          pattern('REGULATORY_MILESTONE', 'Regulatory milestone'),
        ],
      }],
    });
  }
  return {
    pm_wide_catalogue_binding: {
      combined_catalogue_stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
    },
    hierarchy_contract: {
      levels: ['DOMAIN', 'TOPIC', 'PATTERN'],
      maximum_depth: 3,
      display_only_entry_permitted: false,
      all_is_catalogue_navigation_not_union_query: true,
    },
    domains,
    admission_contract: {
      domain_topic_and_pattern_compile_to_one_query_ir: true,
    },
  };
}

function field({ key, result, domain }) {
  return {
    field_key: key,
    field_version: 1,
    permitted_result_definitions: [result.stable_id],
    filter_scope: 'SAME_DEAL',
    multiplicity: 'ZERO_OR_ONE',
    capabilities: {
      display: true,
      filter: true,
      sort: true,
    },
    supported_domains: [domain],
    permitted_operators: ['EQ'],
    completeness_semantics: 'UNKNOWN_IF_NOT_ADMITTED',
  };
}

function predicateAdmission({ domain, predicate, result, evidence }) {
  return {
    domain_key: domain,
    predicate_key: predicate,
    predicate_version: 1,
    admission_id: digest(`predicate:${domain}:${predicate}`),
    result_definitions: [clone(result)],
    evidence_requirement_ids: [...evidence],
  };
}

function queryAdmission(navigation, { includeCvr = false } = {}) {
  const fields = [
    field({
      key: 'agreement_term',
      result: AGREEMENT_RESULT,
      domain: 'AGREEMENT',
    }),
    field({
      key: 'process_phase',
      result: PROCESS_RESULT,
      domain: 'PROCESS',
    }),
  ];
  const predicates = [
    predicateAdmission({
      domain: 'AGREEMENT',
      predicate: 'NO_SHOP',
      result: AGREEMENT_RESULT,
      evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
    }),
    predicateAdmission({
      domain: 'PROCESS',
      predicate: 'EXCLUSIVITY_GRANTED',
      result: PROCESS_RESULT,
      evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
    }),
  ];
  if (includeCvr) {
    fields.splice(1, 0, field({
      key: 'cvr_milestone_status',
      result: CVR_RESULT,
      domain: 'CVR',
    }));
    predicates.splice(1, 0, predicateAdmission({
      domain: 'CVR',
      predicate: 'REGULATORY_MILESTONE',
      result: CVR_RESULT,
      evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
    }));
  }
  return {
    schema_version: PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
    approved_pm_data_version_id: digest('pm-data-version'),
    candidate_release_manifest_id: digest('candidate-release'),
    candidate_release_manifest_payload_digest: digest('candidate-payload'),
    canonical_contract_identity: identity('CANONICAL_CONTRACT_BUNDLE'),
    product_field_catalogue: {
      stable_id: 'PRODUCT_FIELD_CATALOGUE',
      manifest_id: digest('field-manifest'),
      payload_digest: digest('field-payload'),
      field_definitions: fields,
    },
    navigation_catalogue: {
      stable_id: 'PRODUCT_NAVIGATION_CATALOGUE',
      catalogue_id: digest('navigation-manifest'),
      payload_digest: sha256Hex(
        Buffer.from(canonicalJson(navigation), 'utf8'),
      ),
    },
    predicate_admissions: predicates,
    exact_detail_actions: [
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
    ],
    coverage_identities: [
      digest('agreement-coverage'),
      digest('process-coverage'),
      digest('cvr-coverage'),
    ],
    route_budget: {
      maximum_page_size: 50,
    },
  };
}

function queryTemplate({ result, evidence, fieldKey, coverage }) {
  return {
    result_definition: clone(result),
    evidence_requirement_ids: [...evidence],
    cohort: {
      cohort_definition_id: digest(`${coverage}:cohort`),
      cohort_definition_payload_digest: digest(`${coverage}:cohort-payload`),
    },
    filters: [{
      field_key: fieldKey,
      field_version: 1,
      operator: 'EQ',
      value: 'ADMITTED_VALUE',
    }],
    sort: [{
      field_key: fieldKey,
      field_version: 1,
      direction: 'ASC',
    }],
    diversity: {
      definition_id: digest(`${coverage}:diversity`),
      payload_digest: digest(`${coverage}:diversity-payload`),
    },
    requested_columns: [{
      field_key: fieldKey,
      field_version: 1,
    }],
    pagination: {
      page_size: 25,
      cursor: null,
    },
    detail_actions: ['PARENT_BOUND_PARAGRAPH_CONTEXT'],
    coverage: {
      coverage_identity: digest(coverage),
      coverage_payload_digest: digest(`${coverage}:payload`),
      covered_set_identity: digest(`${coverage}:covered`),
      exclusions_identity: digest(`${coverage}:exclusions`),
    },
  };
}

function queryTemplates({ includeCvr = false } = {}) {
  const templates = [
    {
      domain_key: 'AGREEMENT',
      query_template: queryTemplate({
        result: AGREEMENT_RESULT,
        evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'agreement_term',
        coverage: 'agreement-coverage',
      }),
    },
    {
      domain_key: 'PROCESS',
      query_template: queryTemplate({
        result: PROCESS_RESULT,
        evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'process_phase',
        coverage: 'process-coverage',
      }),
    },
  ];
  if (includeCvr) {
    templates.splice(1, 0, {
      domain_key: 'CVR',
      query_template: queryTemplate({
        result: CVR_RESULT,
        evidence: ['EXACT_CVR_TERM', 'EXACT_SOURCE_CITATION'],
        fieldKey: 'cvr_milestone_status',
        coverage: 'cvr-coverage',
      }),
    });
  }
  return templates;
}

function concept({
  domain,
  topic,
  patternKey,
  predicate,
  label,
}) {
  return {
    domain_key: domain,
    topic_key: topic,
    pattern_key: patternKey,
    predicate_key: predicate,
    predicate_version: 1,
    label,
  };
}

const AGREEMENT_CONCEPT = Object.freeze(concept({
  domain: 'AGREEMENT',
  topic: 'DEAL_PROTECTIONS',
  patternKey: 'NO_SHOP',
  predicate: 'NO_SHOP',
  label: 'No-shop',
}));
const PROCESS_CONCEPT = Object.freeze(concept({
  domain: 'PROCESS',
  topic: 'EXCLUSIVITY',
  patternKey: 'EXCLUSIVITY_GRANTED',
  predicate: 'EXCLUSIVITY_GRANTED',
  label: 'Exclusivity granted',
}));
const CVR_CONCEPT = Object.freeze(concept({
  domain: 'CVR',
  topic: 'MILESTONES',
  patternKey: 'REGULATORY_MILESTONE',
  predicate: 'REGULATORY_MILESTONE',
  label: 'Regulatory milestone',
}));

function productNavigationPatterns(manifest) {
  return manifest.navigation_definition.domains.flatMap((domain) => (
    domain.topics.flatMap((topic) => topic.patterns.map((entry) => ({
      domain_key: domain.domain_key,
      topic_key: topic.topic_key,
      pattern_key: entry.pattern_key,
      predicate_key: entry.predicate_key,
      predicate_version: entry.predicate_version,
      label: entry.label,
    })))
  ));
}

function releaseCompiledMapping({
  key,
  phrase,
  phraseClass,
  target,
}) {
  return {
    mapping_key: key,
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

function releaseBoundaryMapping({
  key,
  phrase,
  phraseClass,
  outcome,
  choices = [],
  nearest = [],
}) {
  return {
    mapping_key: key,
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
    choices: choices.map(clone).sort((left, right) => compareText(
      productPatternIdentity(left),
      productPatternIdentity(right),
    )),
    nearest_supported_concepts: nearest.map(clone).sort(
      (left, right) => compareText(
        productPatternIdentity(left),
        productPatternIdentity(right),
      ),
    ),
  };
}

function realV2ProductAskInputs(
  navigationManifest,
  metseraPhrasePredicateKey,
) {
  const patterns = productNavigationPatterns(navigationManifest);
  const patternByPredicate = new Map(patterns.map((entry) => [
    entry.predicate_key,
    entry,
  ]));
  const noShop = patternByPredicate.get('NO_SHOP');
  const granted = patternByPredicate.get('EXCLUSIVITY_GRANTED');
  const metseraTarget = patternByPredicate.get(metseraPhrasePredicateKey);
  const entries = patterns.flatMap((entry, index) => {
    const serial = String(index + 1).padStart(4, '0');
    return [
      releaseCompiledMapping({
        key: `map-${serial}-practitioner`,
        phrase: `Show ${entry.domain_key} ${entry.pattern_key} precedents`,
        phraseClass: 'PRACTITIONER_PHRASE',
        target: entry,
      }),
      releaseCompiledMapping({
        key: `map-${serial}-synonym`,
        phrase: `Find drafting for ${entry.domain_key} ${entry.pattern_key}`,
        phraseClass: 'DRAFTING_SYNONYM',
        target: entry,
      }),
    ];
  });
  entries.push(
    releaseCompiledMapping({
      key: 'map-9000-metsera',
      phrase: 'Did the target grant exclusivity?',
      phraseClass: 'PRACTITIONER_PHRASE',
      target: metseraTarget,
    }),
    releaseCompiledMapping({
      key: 'map-9001-abbreviation',
      phrase: 'Show agr no shop',
      phraseClass: 'ABBREVIATION',
      target: noShop,
    }),
    releaseCompiledMapping({
      key: 'map-9002-misspelling',
      phrase: 'Did the target grant excluisvity?',
      phraseClass: 'ORDINARY_MISSPELLING',
      target: granted,
    }),
    releaseBoundaryMapping({
      key: 'map-9901-adjacent',
      phrase: 'Show confidentiality restrictions',
      phraseClass: 'LEGALLY_ADJACENT_NEGATIVE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [noShop],
    }),
    releaseBoundaryMapping({
      key: 'map-9902-ambiguous',
      phrase: 'Show exclusivity',
      phraseClass: 'AMBIGUOUS_LEGAL_PHRASE',
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      choices: [noShop, granted],
    }),
    releaseBoundaryMapping({
      key: 'map-9903-unsupported',
      phrase: 'Show reverse termination fees',
      phraseClass: 'UNSUPPORTED_PHRASE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [granted],
    }),
  );
  entries.sort((left, right) => compareText(
    left.mapping_key,
    right.mapping_key,
  ));
  const patternDispositions = patterns.map((entry) => ({
    domain_key: entry.domain_key,
    topic_key: entry.topic_key,
    pattern_key: entry.pattern_key,
    predicate_key: entry.predicate_key,
    predicate_version: entry.predicate_version,
    decision: 'INCLUDE',
    mapping_keys: entries
      .filter((mappingEntry) => (
        mappingEntry.outcome === 'COMPILED'
        && productPatternIdentity(mappingEntry)
          === productPatternIdentity(entry)
      ))
      .map((mappingEntry) => mappingEntry.mapping_key)
      .sort(compareText),
    certification_identity: versionedIdentity(
      [
        entry.domain_key,
        entry.predicate_key,
        entry.predicate_version,
        'ASK_CERTIFICATION',
      ].join('_'),
    ),
    exclusion_reason_code: null,
    exclusion_evidence_identity: null,
  })).sort((left, right) => compareText(
    productPatternIdentity(left),
    productPatternIdentity(right),
  ));
  return {
    navigation_catalogue_manifest: navigationManifest,
    release_admission: {
      schema_version: 'PRODUCT_ASK_MAPPING_RELEASE_ADMISSION/V1',
      registry_version: 1,
      approved_pm_data_version_id:
        navigationManifest.approved_pm_data_version_id,
      candidate_release_manifest_id:
        navigationManifest.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        navigationManifest.candidate_release_manifest_payload_digest,
      navigation_catalogue_identity: {
        manifest_id: navigationManifest.manifest_id,
        payload_digest: navigationDefinitionPayloadDigest(
          navigationManifest.navigation_definition,
        ),
      },
      registry_compiler_identity:
        versionedIdentity('PRODUCT_ASK_MAPPING_REGISTRY_COMPILER'),
      entries,
      pattern_dispositions: patternDispositions,
      certification: {
        independent_enumeration_identity:
          versionedIdentity('ASK_INDEPENDENT_ENUMERATION'),
        mapping_reconciliation_identity:
          versionedIdentity('ASK_MAPPING_RECONCILIATION'),
        query_goldens_identity: versionedIdentity('ASK_QUERY_GOLDENS'),
        utterance_suite_identity: versionedIdentity('ASK_UTTERANCE_SUITE'),
      },
      previous_registry_identity: null,
    },
    previous_manifest: null,
  };
}

function mapping({
  key,
  phrase,
  phraseClass,
  outcome,
  target = null,
  choices = [],
  nearest = [],
}) {
  const definition = {
    mapping_key: key,
    phrase,
    normalized_phrase: normalizeProductAskPhrase(phrase),
    phrase_class: phraseClass,
    outcome,
    domain_key: target?.domain_key || null,
    topic_key: target?.topic_key || null,
    pattern_key: target?.pattern_key || null,
    predicate_key: target?.predicate_key || null,
    predicate_version: target?.predicate_version || null,
    concept_label: target?.label || null,
    choices: clone(choices),
    nearest_supported_concepts: clone(nearest),
  };
  return {
    ...definition,
    mapping_definition_id: contentId(
      'PRODUCT_ASK_MAPPING_DEFINITION/V1',
      definition,
    ),
  };
}

function mappings({ includeCvr = false } = {}) {
  const entries = [
    mapping({
      key: 'ASK-001',
      phrase: 'How is the no-shop drafted?',
      phraseClass: 'PRACTITIONER_PHRASE',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-002',
      phrase: 'What does the exclusivity clause say?',
      phraseClass: 'DRAFTING_SYNONYM',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-003',
      phrase: 'Did the target grant exclusivity?',
      phraseClass: 'PRACTITIONER_PHRASE',
      outcome: 'COMPILED',
      target: PROCESS_CONCEPT,
    }),
    mapping({
      key: 'ASK-004',
      phrase: 'NS',
      phraseClass: 'ABBREVIATION',
      outcome: 'COMPILED',
      target: AGREEMENT_CONCEPT,
    }),
    mapping({
      key: 'ASK-005',
      phrase: 'Did the target grant excluisvity?',
      phraseClass: 'ORDINARY_MISSPELLING',
      outcome: 'COMPILED',
      target: PROCESS_CONCEPT,
    }),
    mapping({
      key: 'ASK-006',
      phrase: 'Was the buyer interested?',
      phraseClass: 'LEGALLY_ADJACENT_NEGATIVE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [PROCESS_CONCEPT],
    }),
    mapping({
      key: 'ASK-007',
      phrase: 'Show me exclusivity',
      phraseClass: 'AMBIGUOUS_LEGAL_PHRASE',
      outcome: 'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
      choices: [AGREEMENT_CONCEPT, PROCESS_CONCEPT],
    }),
    mapping({
      key: 'ASK-008',
      phrase: 'What did the bankers think?',
      phraseClass: 'UNSUPPORTED_PHRASE',
      outcome: 'TYPED_UNSUPPORTED',
      nearest: [PROCESS_CONCEPT],
    }),
  ];
  if (includeCvr) {
    entries.push(mapping({
      key: 'ASK-009',
      phrase: 'Show regulatory milestone drafting',
      phraseClass: 'DRAFTING_SYNONYM',
      outcome: 'COMPILED',
      target: CVR_CONCEPT,
    }));
  }
  return entries;
}

function rehashRegistry(registry) {
  const body = clone(registry);
  delete body.manifest_id;
  delete body.canonical_payload_digest;
  registry.manifest_id = contentId(
    PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    body,
  );
  registry.canonical_payload_digest =
    productAskMappingRegistryPayloadDigest(registry);
  return registry;
}

function mappingRegistry(admission, { includeCvr = false } = {}) {
  const registry = {
    schema_version: PRODUCT_ASK_MAPPING_REGISTRY_MANIFEST_SCHEMA,
    stable_id: 'PRODUCT_ASK_MAPPING_REGISTRY',
    registry_version: 1,
    approved_pm_data_version_id: admission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      admission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      admission.candidate_release_manifest_payload_digest,
    basis: {
      navigation_catalogue_identity: {
        manifest_id: admission.navigation_catalogue.catalogue_id,
        payload_digest: admission.navigation_catalogue.payload_digest,
      },
      registry_compiler_identity:
        identity('PRODUCT_ASK_MAPPING_REGISTRY_COMPILER'),
      certification: {
        independent_enumeration_identity:
          identity('ASK_INDEPENDENT_ENUMERATION'),
        mapping_reconciliation_identity:
          identity('ASK_MAPPING_RECONCILIATION'),
        query_goldens_identity: identity('ASK_QUERY_GOLDENS'),
        utterance_suite_identity: identity('ASK_UTTERANCE_SUITE'),
      },
      previous_registry_identity: null,
    },
    entries: mappings({ includeCvr }),
    pattern_coverage: [],
    pattern_exclusions: [],
    difference: {
      previous_manifest_id: null,
      added_mapping_keys: [],
      removed_mapping_keys: [],
      changed_mapping_keys: [],
      unchanged_mapping_keys: [],
    },
    counts: {
      navigation_pattern_count: includeCvr ? 3 : 2,
      covered_pattern_count: includeCvr ? 3 : 2,
      excluded_pattern_count: 0,
      mapping_count: includeCvr ? 9 : 8,
      compiled_mapping_count: includeCvr ? 6 : 5,
      boundary_mapping_count: 3,
    },
    manifest_id: digest('temporary-manifest'),
    canonical_payload_digest: digest('temporary-payload'),
  };
  return rehashRegistry(registry);
}

function mappingAdmission(registry) {
  return {
    stable_id: registry.stable_id,
    registry_version: registry.registry_version,
    manifest_id: registry.manifest_id,
    payload_digest: registry.canonical_payload_digest,
    navigation_catalogue_identity:
      clone(registry.basis.navigation_catalogue_identity),
  };
}

function fixture({ includeCvr = false } = {}) {
  const navigation = navigationDefinition({ includeCvr });
  const admission = queryAdmission(navigation, { includeCvr });
  const registry = mappingRegistry(admission, { includeCvr });
  return {
    navigation,
    admission,
    templates: queryTemplates({ includeCvr }),
    registry,
    registryAdmission: mappingAdmission(registry),
  };
}

function realV2ProductFixture({
  metseraPhrasePredicateKey = 'EXCLUSIVITY_GRANTED',
} = {}) {
  const navigationManifest = realV2ProductNavigationManifest();
  const askInputs = realV2ProductAskInputs(
    navigationManifest,
    metseraPhrasePredicateKey,
  );
  const registry = buildProductAskMappingRegistryManifest(askInputs);
  const navigation = navigationManifest.navigation_definition;
  const admission = queryAdmission(navigation);
  admission.approved_pm_data_version_id =
    navigationManifest.approved_pm_data_version_id;
  admission.candidate_release_manifest_id =
    navigationManifest.candidate_release_manifest_id;
  admission.candidate_release_manifest_payload_digest =
    navigationManifest.candidate_release_manifest_payload_digest;
  admission.navigation_catalogue =
    productNavigationQueryAdmission(navigationManifest);
  admission.predicate_admissions.push(predicateAdmission({
    domain: 'PROCESS',
    predicate: 'EXCLUSIVITY_REQUESTED',
    result: PROCESS_RESULT,
    evidence: ['EXACT_PASSAGE', 'EXACT_SOURCE_CITATION'],
  }));
  return {
    navigation,
    navigationManifest,
    admission,
    templates: queryTemplates(),
    registry,
    registryAdmission:
      productAskMappingRegistryAdmission(registry, askInputs),
  };
}

function semanticQueryBodyWithoutDerivedIdentity(queryIr) {
  const body = clone(queryIr);
  delete body.query_definition_id;
  return body;
}

function normalisePreV2NavigationBinding(queryBody) {
  const body = clone(queryBody);
  body.release_contract.navigation_catalogue_id =
    PRE_V2_PRODUCT_NAVIGATION_ID;
  body.release_contract.navigation_catalogue_payload_digest =
    PRE_V2_PRODUCT_NAVIGATION_PAYLOAD_DIGEST;
  return body;
}

function askInput(state, question) {
  return {
    question,
    mapping_registry: state.registry,
    mapping_registry_admission: state.registryAdmission,
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
  };
}

function browseInput(state, selection) {
  return {
    selection,
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
  };
}

test('lists the dynamic Agreement and Process Browse hierarchy', () => {
  const state = fixture();
  const domains = listProductBrowseOptions({
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
    selection: null,
  });
  assert.deepEqual(domains.options, [
    { key: 'AGREEMENT', label: 'Agreement' },
    { key: 'PROCESS', label: 'Process' },
  ]);
  const topics = listProductBrowseOptions({
    navigation_definition: state.navigation,
    admission: state.admission,
    query_templates: state.templates,
    selection: {
      domain_key: 'PROCESS',
      topic_key: null,
    },
  });
  assert.deepEqual(topics.options, [
    { key: 'EXCLUSIVITY', label: 'Exclusivity' },
  ]);
});

test('compiles Agreement and Process Browse paths to Product Query IR', () => {
  const state = fixture();
  const agreement = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'AGREEMENT',
    topic_key: 'DEAL_PROTECTIONS',
    pattern_key: 'NO_SHOP',
  }));
  const process = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'EXCLUSIVITY_GRANTED',
  }));
  assert.equal(agreement.query_ir.schema_version, PRODUCT_QUERY_IR_SCHEMA);
  assert.equal(
    agreement.query_ir.semantic_contract.domain_key,
    'AGREEMENT',
  );
  assert.equal(process.query_ir.schema_version, PRODUCT_QUERY_IR_SCHEMA);
  assert.equal(process.query_ir.semantic_contract.domain_key, 'PROCESS');
});

test('makes Ask and Browse byte-identical for the same legal meaning', () => {
  const state = fixture();
  const ask = compileProductAskQuery(askInput(
    state,
    '  HOW is the no-shop drafted?!  ',
  ));
  const browse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'AGREEMENT',
    topic_key: 'DEAL_PROTECTIONS',
    pattern_key: 'NO_SHOP',
  }));
  assert.equal(ask.outcome, 'COMPILED');
  assert.deepEqual(ask.query_ir, browse.query_ir);
  assert.equal(
    canonicalProductQueryIrBytes(ask.query_ir).toString('utf8'),
    canonicalProductQueryIrBytes(browse.query_ir).toString('utf8'),
  );

  const processAsk = compileProductAskQuery(askInput(
    state,
    'Did the target grant exclusivity?',
  ));
  const processBrowse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'EXCLUSIVITY_GRANTED',
  }));
  assert.equal(processAsk.outcome, 'COMPILED');
  assert.equal(
    processAsk.query_ir.semantic_contract.domain_key,
    'PROCESS',
  );
  assert.deepEqual(processAsk.query_ir, processBrowse.query_ir);
  assert.equal(
    canonicalProductQueryIrBytes(processAsk.query_ir).toString('utf8'),
    canonicalProductQueryIrBytes(processBrowse.query_ir).toString('utf8'),
  );
});

test('locks the real v2 Metsera Ask and Browse paths to one fixed Query IR', () => {
  const state = realV2ProductFixture();
  const expectedV2QueryIr = JSON.parse(
    METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES,
  );
  const ask = compileProductAskQuery(askInput(
    state,
    'Did the target grant exclusivity?',
  ));
  const browse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'EXCLUSIVITY_GRANTED',
  }));

  assert.equal(
    state.navigationManifest.manifest_id,
    V2_PRODUCT_NAVIGATION_ID,
  );
  assert.equal(
    navigationDefinitionPayloadDigest(state.navigation),
    V2_PRODUCT_NAVIGATION_PAYLOAD_DIGEST,
  );
  assert.equal(
    expectedV2QueryIr.release_contract.navigation_catalogue_id,
    V2_PRODUCT_NAVIGATION_ID,
  );
  assert.equal(
    expectedV2QueryIr.release_contract
      .navigation_catalogue_payload_digest,
    V2_PRODUCT_NAVIGATION_PAYLOAD_DIGEST,
  );
  assert.equal(
    canonicalProductQueryIrBytes(expectedV2QueryIr).toString('utf8'),
    METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES,
  );
  assert.equal(
    canonicalProductQueryIrBytes(ask.query_ir).toString('utf8'),
    METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES,
  );
  assert.equal(
    canonicalProductQueryIrBytes(browse.query_ir).toString('utf8'),
    METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES,
  );
  assert.equal(
    ask.query_ir.semantic_contract.predicate_key,
    'EXCLUSIVITY_GRANTED',
  );
  assert.equal(ask.query_ir.semantic_contract.predicate_version, 1);
  assert.equal(
    browse.query_ir.semantic_contract.predicate_key,
    'EXCLUSIVITY_GRANTED',
  );
  assert.equal(browse.query_ir.semantic_contract.predicate_version, 1);

  const expectedPreV2Body = normalisePreV2NavigationBinding(
    semanticQueryBodyWithoutDerivedIdentity(expectedV2QueryIr),
  );
  assert.equal(
    canonicalJson(expectedPreV2Body),
    METSERA_GRANTED_PRE_V2_SEMANTIC_QUERY_BODY,
  );
  assert.equal(
    canonicalJson(normalisePreV2NavigationBinding(
      semanticQueryBodyWithoutDerivedIdentity(ask.query_ir),
    )),
    METSERA_GRANTED_PRE_V2_SEMANTIC_QUERY_BODY,
  );
  assert.equal(
    canonicalJson(normalisePreV2NavigationBinding(
      semanticQueryBodyWithoutDerivedIdentity(browse.query_ir),
    )),
    METSERA_GRANTED_PRE_V2_SEMANTIC_QUERY_BODY,
  );

  const hostile = realV2ProductFixture({
    metseraPhrasePredicateKey: 'EXCLUSIVITY_REQUESTED',
  });
  const hostileAsk = compileProductAskQuery(askInput(
    hostile,
    'Did the target grant exclusivity?',
  ));
  assert.equal(
    hostileAsk.query_ir.semantic_contract.predicate_key,
    'EXCLUSIVITY_REQUESTED',
  );
  assert.throws(
    () => assert.equal(
      canonicalProductQueryIrBytes(hostileAsk.query_ir).toString('utf8'),
      METSERA_GRANTED_V2_PRODUCT_QUERY_IR_BYTES,
    ),
    { code: 'ERR_ASSERTION' },
  );
});

test('adds a later CVR domain without a compiler change', () => {
  const state = fixture({ includeCvr: true });
  const browse = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'CVR',
    topic_key: 'MILESTONES',
    pattern_key: 'REGULATORY_MILESTONE',
  }));
  const ask = compileProductAskQuery(askInput(
    state,
    'Show regulatory milestone drafting',
  ));
  assert.equal(browse.query_ir.semantic_contract.domain_key, 'CVR');
  assert.deepEqual(ask.query_ir, browse.query_ir);
});

test('treats ALL as catalogue navigation and never as a union query', () => {
  const state = fixture();
  const result = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'ALL',
    topic_key: 'ALL',
    pattern_key: 'ALL',
  }));
  assert.equal(result.outcome, 'CATALOGUE_NAVIGATION');
  assert.equal(result.next_level, 'DOMAIN');
  assert.equal(result.query_ir, null);
  assert.throws(
    () => compileProductBrowseQuery(browseInput(state, {
      domain_key: 'ALL',
      topic_key: 'EXCLUSIVITY',
      pattern_key: 'EXCLUSIVITY_GRANTED',
    })),
    { code: 'INVALID_PRODUCT_BROWSE_INPUT' },
  );
});

test('returns typed results for unknown, ambiguous and unsupported Ask text', () => {
  const state = fixture();
  const unknown = compileProductAskQuery(askInput(
    state,
    'Give me a legal answer that was never certified',
  ));
  assert.equal(unknown.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(unknown.reason, 'NO_CHECKED_MAPPING');
  assert.equal(unknown.query_ir, null);

  const ambiguous = compileProductAskQuery(askInput(
    state,
    'Show me exclusivity',
  ));
  assert.equal(
    ambiguous.outcome,
    'AMBIGUOUS_REQUIRES_LEGAL_CHOICE',
  );
  assert.equal(ambiguous.choices.length, 2);
  assert.equal(ambiguous.query_ir, null);

  const unsupported = compileProductAskQuery(askInput(
    state,
    'Was the buyer interested?',
  ));
  assert.equal(unsupported.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(unsupported.nearest_supported_concepts.length, 1);
  assert.equal(unsupported.query_ir, null);
});

test('fails closed when a visible domain has no governed template', () => {
  const state = fixture();
  state.templates.pop();
  assert.throws(
    () => listProductBrowseOptions({
      navigation_definition: state.navigation,
      admission: state.admission,
      query_templates: state.templates,
      selection: null,
    }),
    (error) => (
      error.code === 'DOMAIN_QUERY_TEMPLATE_NOT_ADMITTED'
      && error.details.domain_key === 'PROCESS'
    ),
  );
});

test('does not display a domain whose template cannot compile each Pattern', () => {
  const state = fixture();
  state.templates[1].query_template.evidence_requirement_ids = [
    'EXACT_SOURCE_CITATION',
  ];
  assert.throws(
    () => listProductBrowseOptions({
      navigation_definition: state.navigation,
      admission: state.admission,
      query_templates: state.templates,
      selection: null,
    }),
    { code: 'EVIDENCE_REQUIREMENTS_NOT_ADMITTED' },
  );
});

test('rejects stale release and navigation bindings', () => {
  const staleRelease = fixture();
  staleRelease.admission.candidate_release_manifest_id =
    digest('other-release');
  assert.throws(
    () => compileProductAskQuery(askInput(
      staleRelease,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );

  const staleNavigation = fixture();
  staleNavigation.admission.navigation_catalogue.catalogue_id =
    digest('other-navigation');
  assert.throws(
    () => compileProductAskQuery(askInput(
      staleNavigation,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );
});

test('rejects changed and correctly rehashed registry content', () => {
  const changed = fixture();
  changed.registry.entries[0].phrase = 'Changed without rehashing';
  assert.throws(
    () => compileProductAskQuery(askInput(
      changed,
      'How is the no-shop drafted?',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );

  const rehashed = fixture();
  rehashed.registry.entries[0].phrase = 'Changed and rehashed';
  rehashed.registry.entries[0].normalized_phrase =
    normalizeProductAskPhrase(rehashed.registry.entries[0].phrase);
  const {
    mapping_definition_id: ignored,
    ...definition
  } = rehashed.registry.entries[0];
  rehashed.registry.entries[0].mapping_definition_id = contentId(
    'PRODUCT_ASK_MAPPING_DEFINITION/V1',
    definition,
  );
  rehashRegistry(rehashed.registry);
  assert.throws(
    () => compileProductAskQuery(askInput(
      rehashed,
      'Changed and rehashed',
    )),
    { code: 'INVALID_PRODUCT_ASK_MAPPING_REGISTRY' },
  );
});

test('rejects a newly admitted mapping that points to the wrong predicate', () => {
  const state = fixture();
  const entry = state.registry.entries[0];
  entry.predicate_key = 'EXCLUSIVITY_GRANTED';
  const {
    mapping_definition_id: ignored,
    ...definition
  } = entry;
  entry.mapping_definition_id = contentId(
    'PRODUCT_ASK_MAPPING_DEFINITION/V1',
    definition,
  );
  rehashRegistry(state.registry);
  state.registryAdmission = mappingAdmission(state.registry);
  assert.throws(
    () => compileProductAskQuery(askInput(
      state,
      'How is the no-shop drafted?',
    )),
    { code: 'STALE_PRODUCT_ASK_MAPPING' },
  );
});

test('returns typed unsupported for an unadmitted Browse selection', () => {
  const state = fixture();
  const result = compileProductBrowseQuery(browseInput(state, {
    domain_key: 'PROCESS',
    topic_key: 'EXCLUSIVITY',
    pattern_key: 'NOT_ADMITTED',
  }));
  assert.equal(result.outcome, 'TYPED_UNSUPPORTED');
  assert.equal(result.reason, 'NAVIGATION_SELECTION_NOT_ADMITTED');
  assert.equal(result.query_ir, null);
});

test('keeps the unit outside prohibited runtime and product paths', () => {
  const sourceFiles = [
    'lib/canonical-v2/product-ask-compiler.js',
    'lib/canonical-v2/product-browse-compiler.js',
  ];
  const prohibited = [
    'components/',
    'data/',
    'pages/',
    'sql/',
    'supabase/',
    'fetch(',
    'XMLHttpRequest',
    'openai',
    'anthropic',
  ];
  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(
      path.join(__dirname, '..', relativePath),
      'utf8',
    );
    for (const marker of prohibited) {
      assert.equal(source.includes(marker), false, `${relativePath}: ${marker}`);
    }
  }
});
