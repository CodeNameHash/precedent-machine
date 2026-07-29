const {
  canonicalJson,
  sha256Hex,
} = require('./canonical-bytes');
const {
  compileProcessQueryTemplate,
} = require('./process-query-ir');

class ProcessBrowseCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessBrowseCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessBrowseCompilerError(code, message, details);
}

function requireObject(value, label, code = 'INVALID_PROCESS_BROWSE_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_BROWSE_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireText(value, label, code = 'INVALID_PROCESS_BROWSE_INPUT') {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PROCESS_BROWSE_INPUT',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
}

function requireArray(value, label, code = 'INVALID_PROCESS_BROWSE_INPUT') {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail('INVALID_PROCESS_BROWSE_INPUT', 'The Browse input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function processBrowseNavigationPayloadDigest(navigationDefinition) {
  requireObject(navigationDefinition, 'Process navigation definition');
  return sha256Hex(Buffer.from(canonicalJson(navigationDefinition), 'utf8'));
}

function predicateIdentity(domainKey, predicateKey, predicateVersion) {
  return `${domainKey}\0${predicateKey}\0${predicateVersion}`;
}

function admittedPredicateIdentities(admission) {
  requireObject(admission, 'Process query admission');
  return new Set(
    requireArray(
      admission.predicate_admissions,
      'Process query predicate admissions',
    ).map((predicate, index) => {
      requireObject(predicate, `Predicate admission ${index}`);
      requireText(predicate.domain_key, `Predicate admission ${index} domain_key`);
      requireText(
        predicate.predicate_key,
        `Predicate admission ${index} predicate_key`,
      );
      requirePositiveInteger(
        predicate.predicate_version,
        `Predicate admission ${index} predicate_version`,
      );
      return predicateIdentity(
        predicate.domain_key,
        predicate.predicate_key,
        predicate.predicate_version,
      );
    }),
  );
}

function validatePattern(pattern, label) {
  requireExactKeys(pattern, [
    'pattern_key',
    'label',
    'predicate_key',
    'predicate_version',
    'predicate_shape',
  ], label, 'INVALID_PROCESS_NAVIGATION_CATALOGUE');
  requireText(
    pattern.pattern_key,
    `${label} pattern_key`,
    'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
  requireText(
    pattern.label,
    `${label} label`,
    'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
  requireText(
    pattern.predicate_key,
    `${label} predicate_key`,
    'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
  requirePositiveInteger(
    pattern.predicate_version,
    `${label} predicate_version`,
    'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
  requireText(
    pattern.predicate_shape,
    `${label} predicate_shape`,
    'INVALID_PROCESS_NAVIGATION_CATALOGUE',
  );
}

function validateNavigationDefinition(navigationDefinition, admission) {
  const code = 'INVALID_PROCESS_NAVIGATION_CATALOGUE';
  requireObject(navigationDefinition, 'Process navigation definition', code);
  for (const key of [
    'pm_wide_catalogue_binding',
    'hierarchy_contract',
    'domains',
    'admission_contract',
  ]) {
    if (!Object.hasOwn(navigationDefinition, key)) {
      fail(code, `Process navigation definition has no ${key}.`);
    }
  }
  requireObject(
    navigationDefinition.pm_wide_catalogue_binding,
    'PM-wide navigation binding',
    code,
  );
  if (
    navigationDefinition.pm_wide_catalogue_binding.combined_catalogue_stable_id
    !== admission?.navigation_catalogue?.stable_id
  ) {
    fail(code, 'The navigation definition does not bind the admitted PM-wide catalogue.');
  }
  if (
    processBrowseNavigationPayloadDigest(navigationDefinition)
    !== admission.navigation_catalogue.payload_digest
  ) {
    fail(code, 'The navigation definition payload does not match the admitted digest.');
  }
  requireObject(
    navigationDefinition.hierarchy_contract,
    'Navigation hierarchy contract',
    code,
  );
  if (
    canonicalJson(navigationDefinition.hierarchy_contract.levels)
      !== canonicalJson(['DOMAIN', 'TOPIC', 'PATTERN'])
    || navigationDefinition.hierarchy_contract.maximum_depth !== 3
    || navigationDefinition.hierarchy_contract.display_only_entry_permitted
      !== false
    || navigationDefinition.hierarchy_contract
      .all_is_catalogue_navigation_not_union_query !== true
  ) {
    fail(code, 'The navigation hierarchy is not the governed three-level hierarchy.');
  }

  const domains = requireArray(
    navigationDefinition.domains,
    'Navigation domains',
    code,
  );
  if (domains.length === 0) {
    fail(code, 'The navigation catalogue has no domain.');
  }
  const domainKeys = new Set();
  for (const [domainIndex, domain] of domains.entries()) {
    const domainLabel = `Navigation domain ${domainIndex}`;
    requireExactKeys(domain, [
      'domain_key',
      'label',
      'domain_registry_stable_id',
      'topics',
    ], domainLabel, code);
    requireText(domain.domain_key, `${domainLabel} domain_key`, code);
    requireText(domain.label, `${domainLabel} label`, code);
    requireText(
      domain.domain_registry_stable_id,
      `${domainLabel} domain_registry_stable_id`,
      code,
    );
    if (domainKeys.has(domain.domain_key)) {
      fail(code, 'The navigation catalogue contains a duplicate domain.');
    }
    domainKeys.add(domain.domain_key);
    const topicKeys = new Set();
    for (const [topicIndex, topic] of requireArray(
      domain.topics,
      `${domainLabel} topics`,
      code,
    ).entries()) {
      const topicLabel = `${domainLabel} topic ${topicIndex}`;
      requireExactKeys(topic, [
        'topic_key',
        'label',
        'predicate_catalogue_stable_id',
        'patterns',
      ], topicLabel, code);
      requireText(topic.topic_key, `${topicLabel} topic_key`, code);
      requireText(topic.label, `${topicLabel} label`, code);
      requireText(
        topic.predicate_catalogue_stable_id,
        `${topicLabel} predicate_catalogue_stable_id`,
        code,
      );
      if (topicKeys.has(topic.topic_key)) {
        fail(code, 'The navigation catalogue contains a duplicate topic.');
      }
      topicKeys.add(topic.topic_key);
      const patternKeys = new Set();
      for (const [patternIndex, pattern] of requireArray(
        topic.patterns,
        `${topicLabel} patterns`,
        code,
      ).entries()) {
        validatePattern(pattern, `${topicLabel} pattern ${patternIndex}`);
        if (patternKeys.has(pattern.pattern_key)) {
          fail(code, 'The navigation catalogue contains a duplicate pattern.');
        }
        patternKeys.add(pattern.pattern_key);
      }
    }
  }
  return domains;
}

function admittedPatternsForTopic(domain, topic, admittedPredicates) {
  return topic.patterns.filter((pattern) => admittedPredicates.has(
    predicateIdentity(
      domain.domain_key,
      pattern.predicate_key,
      pattern.predicate_version,
    ),
  ));
}

function listProcessBrowseOptions({
  navigation_definition: navigationDefinition,
  admission,
  selection,
}) {
  const domains = validateNavigationDefinition(navigationDefinition, admission);
  const admittedPredicates = admittedPredicateIdentities(admission);
  if (selection !== null) {
    requireExactKeys(selection, [
      'domain_key',
      'topic_key',
    ], 'Browse catalogue selection');
    if (selection.domain_key !== null) {
      requireText(selection.domain_key, 'Browse selection domain_key');
    }
    if (selection.topic_key !== null) {
      requireText(selection.topic_key, 'Browse selection topic_key');
    }
    if (
      selection.topic_key !== null
      && (
        selection.domain_key === null
        || selection.domain_key === 'ALL'
      )
    ) {
      fail(
        'INVALID_PROCESS_BROWSE_INPUT',
        'A Browse topic requires one selected domain.',
      );
    }
  }

  if (
    selection === null
    || selection.domain_key === null
    || selection.domain_key === 'ALL'
  ) {
    const options = domains
      .filter((domain) => domain.topics.some(
        (topic) => (
          admittedPatternsForTopic(domain, topic, admittedPredicates).length > 0
        ),
      ))
      .map((domain) => ({
        key: domain.domain_key,
        label: domain.label,
      }));
    return deepFreeze({
      outcome: 'CATALOGUE_NAVIGATION',
      next_level: 'DOMAIN',
      selection: {
        domain_key: null,
        topic_key: null,
      },
      options,
      query_ir: null,
    });
  }

  const domain = domains.find(
    (candidate) => candidate.domain_key === selection.domain_key,
  );
  if (!domain) {
    const admittedDomains = domains.filter((candidate) => (
      candidate.topics.some((topic) => (
        admittedPatternsForTopic(
          candidate,
          topic,
          admittedPredicates,
        ).length > 0
      ))
    ));
    return deepFreeze({
      outcome: 'TYPED_UNSUPPORTED',
      reason: 'DOMAIN_NOT_ADMITTED',
      nearest_supported_concepts: admittedDomains.map((candidate) => ({
        key: candidate.domain_key,
        label: candidate.label,
      })),
      query_ir: null,
    });
  }
  if (selection.topic_key === null) {
    const options = domain.topics
      .filter(
        (topic) => (
          admittedPatternsForTopic(domain, topic, admittedPredicates).length > 0
        ),
      )
      .map((topic) => ({
        key: topic.topic_key,
        label: topic.label,
      }));
    return deepFreeze({
      outcome: 'CATALOGUE_NAVIGATION',
      next_level: 'TOPIC',
      selection: {
        domain_key: domain.domain_key,
        topic_key: null,
      },
      options,
      query_ir: null,
    });
  }

  const topic = domain.topics.find(
    (candidate) => candidate.topic_key === selection.topic_key,
  );
  if (!topic) {
    const admittedTopics = domain.topics.filter(
      (candidate) => (
        admittedPatternsForTopic(
          domain,
          candidate,
          admittedPredicates,
        ).length > 0
      ),
    );
    return deepFreeze({
      outcome: 'TYPED_UNSUPPORTED',
      reason: 'TOPIC_NOT_ADMITTED',
      nearest_supported_concepts: admittedTopics.map((candidate) => ({
        key: candidate.topic_key,
        label: candidate.label,
      })),
      query_ir: null,
    });
  }
  const options = admittedPatternsForTopic(
    domain,
    topic,
    admittedPredicates,
  ).map((pattern) => ({
    key: pattern.pattern_key,
    label: pattern.label,
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
  }));
  return deepFreeze({
    outcome: 'CATALOGUE_NAVIGATION',
    next_level: 'PATTERN',
    selection: {
      domain_key: domain.domain_key,
      topic_key: topic.topic_key,
    },
    options,
    query_ir: null,
  });
}

function compileProcessBrowseQuery({
  selection,
  navigation_definition: navigationDefinition,
  admission,
  query_template: queryTemplate,
}) {
  requireExactKeys(selection, [
    'domain_key',
    'topic_key',
    'pattern_key',
  ], 'Browse query selection');
  for (const key of ['domain_key', 'topic_key', 'pattern_key']) {
    requireText(selection[key], `Browse query selection ${key}`);
  }
  if (selection.domain_key === 'ALL') {
    return listProcessBrowseOptions({
      navigation_definition: navigationDefinition,
      admission,
      selection: {
        domain_key: 'ALL',
        topic_key: null,
      },
    });
  }

  const domains = validateNavigationDefinition(navigationDefinition, admission);
  const domain = domains.find(
    (candidate) => candidate.domain_key === selection.domain_key,
  );
  const topic = domain?.topics.find(
    (candidate) => candidate.topic_key === selection.topic_key,
  );
  const pattern = topic?.patterns.find(
    (candidate) => candidate.pattern_key === selection.pattern_key,
  );
  const admittedPredicates = admittedPredicateIdentities(admission);
  if (
    !domain
    || !topic
    || !pattern
    || !admittedPredicates.has(predicateIdentity(
      domain.domain_key,
      pattern.predicate_key,
      pattern.predicate_version,
    ))
  ) {
    const nearest = topic
      ? admittedPatternsForTopic(domain, topic, admittedPredicates).map(
        (candidate) => ({
          predicate_key: candidate.predicate_key,
          predicate_version: candidate.predicate_version,
          label: candidate.label,
        }),
      )
      : [];
    return deepFreeze({
      outcome: 'TYPED_UNSUPPORTED',
      reason: 'NAVIGATION_SELECTION_NOT_ADMITTED',
      nearest_supported_concepts: nearest,
      query_ir: null,
    });
  }

  const queryIr = compileProcessQueryTemplate({
    admission,
    query_template: queryTemplate,
    domain_key: domain.domain_key,
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
  });
  return deepFreeze({
    outcome: 'COMPILED',
    selection: clone(selection),
    understood_legal_question: {
      domain_key: domain.domain_key,
      predicate_key: pattern.predicate_key,
      predicate_version: pattern.predicate_version,
      label: pattern.label,
    },
    query_ir: queryIr,
  });
}

module.exports = {
  ProcessBrowseCompilerError,
  compileProcessBrowseQuery,
  listProcessBrowseOptions,
  processBrowseNavigationPayloadDigest,
};
