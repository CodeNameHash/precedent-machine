const {
  canonicalJson,
} = require('./canonical-bytes');
const {
  listProcessBrowseOptions,
} = require('./process-browse-compiler');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_TEMPLATE_KEYS,
  compileProductQueryTemplate,
} = require('./product-query-ir');

class ProductBrowseCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductBrowseCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductBrowseCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_BROWSE_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_BROWSE_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireText(
  value,
  label,
  code = 'INVALID_PRODUCT_BROWSE_INPUT',
) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireArray(
  value,
  label,
  code = 'INVALID_PRODUCT_BROWSE_INPUT',
) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_BROWSE_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product Browse input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireProductAdmission(admission) {
  requireObject(
    admission,
    'Product query admission',
    'INVALID_PRODUCT_QUERY_ADMISSION',
  );
  if (admission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA) {
    fail(
      'INVALID_PRODUCT_QUERY_ADMISSION',
      'The Product query admission schema is not supported.',
    );
  }
}

function visibleDomainKeys(navigationDefinition, admission) {
  let listed;
  try {
    listed = listProcessBrowseOptions({
      navigation_definition: navigationDefinition,
      admission,
      selection: null,
    });
  } catch (error) {
    fail(
      {
        INVALID_PROCESS_BROWSE_INPUT: 'INVALID_PRODUCT_BROWSE_INPUT',
        INVALID_PROCESS_NAVIGATION_CATALOGUE:
          'INVALID_PRODUCT_NAVIGATION_CATALOGUE',
      }[error?.code] || error?.code || 'INVALID_PRODUCT_BROWSE_INPUT',
      (error?.message || 'The Product Browse catalogue is invalid.')
        .replace(/\bProcess\b/g, 'Product'),
      error?.details || {},
    );
  }
  return listed.options.map((option) => option.key);
}

function admittedPredicateIdentity(domainKey, predicateKey, predicateVersion) {
  return `${domainKey}\0${predicateKey}\0${predicateVersion}`;
}

function validateProductQueryTemplates({
  query_templates: queryTemplates,
  navigation_definition: navigationDefinition,
  admission,
}) {
  requireProductAdmission(admission);
  const templates = requireArray(queryTemplates, 'Product query templates');
  if (templates.length === 0) {
    fail(
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
      'The Product query template set cannot be empty.',
    );
  }
  templates.forEach((entry, index) => {
    const label = `Product query template ${index}`;
    requireExactKeys(
      entry,
      ['domain_key', 'query_template'],
      label,
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
    );
    requireText(
      entry.domain_key,
      `${label} domain_key`,
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
    );
    requireExactKeys(
      entry.query_template,
      PRODUCT_QUERY_TEMPLATE_KEYS,
      `${label} query_template`,
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
    );
  });
  const domainKeys = templates.map((entry) => entry.domain_key);
  if (new Set(domainKeys).size !== domainKeys.length) {
    fail(
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
      'The Product query template set contains a duplicate domain.',
    );
  }
  if (
    canonicalJson(domainKeys)
      !== canonicalJson([...domainKeys].sort())
  ) {
    fail(
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
      'Product query templates are not in canonical domain order.',
    );
  }
  const predicateAdmissions = requireArray(
    admission.predicate_admissions,
    'Product predicate admissions',
    'INVALID_PRODUCT_QUERY_ADMISSION',
  );
  const admittedDomainKeys = new Set(
    predicateAdmissions.map((predicate, index) => {
      requireObject(
        predicate,
        `Product predicate admission ${index}`,
        'INVALID_PRODUCT_QUERY_ADMISSION',
      );
      return requireText(
        predicate.domain_key,
        `Product predicate admission ${index} domain_key`,
        'INVALID_PRODUCT_QUERY_ADMISSION',
      );
    }),
  );
  for (const domainKey of domainKeys) {
    if (!admittedDomainKeys.has(domainKey)) {
      fail(
        'DOMAIN_QUERY_TEMPLATE_NOT_ADMITTED',
        'A Product query template has no admitted domain.',
        { domain_key: domainKey },
      );
    }
  }
  const visibleDomains = visibleDomainKeys(navigationDefinition, admission);
  for (const domainKey of visibleDomains) {
    if (!domainKeys.includes(domainKey)) {
      fail(
        'DOMAIN_QUERY_TEMPLATE_NOT_ADMITTED',
        'A visible Product domain has no governed query template.',
        { domain_key: domainKey },
      );
    }
  }
  if (
    canonicalJson(domainKeys)
      !== canonicalJson([...visibleDomains].sort())
  ) {
    fail(
      'INVALID_PRODUCT_QUERY_TEMPLATE_SET',
      'Product query template domains do not exactly match visible domains.',
      {
        template_domains: domainKeys,
        visible_domains: [...visibleDomains].sort(),
      },
    );
  }

  const admittedPredicates = new Set(predicateAdmissions.map((predicate) => (
    admittedPredicateIdentity(
      predicate.domain_key,
      predicate.predicate_key,
      predicate.predicate_version,
    )
  )));
  const templateByDomain = new Map(templates.map((entry) => [
    entry.domain_key,
    entry.query_template,
  ]));
  for (const domain of navigationDefinition.domains) {
    const queryTemplate = templateByDomain.get(domain.domain_key);
    if (!queryTemplate) continue;
    for (const topic of domain.topics) {
      for (const pattern of topic.patterns) {
        if (!admittedPredicates.has(admittedPredicateIdentity(
          domain.domain_key,
          pattern.predicate_key,
          pattern.predicate_version,
        ))) {
          continue;
        }
        compileProductQueryTemplate({
          admission,
          query_template: queryTemplate,
          domain_key: domain.domain_key,
          predicate_key: pattern.predicate_key,
          predicate_version: pattern.predicate_version,
        });
      }
    }
  }
  return templates;
}

function callCatalogue({
  navigationDefinition,
  admission,
  selection,
}) {
  try {
    return listProcessBrowseOptions({
      navigation_definition: navigationDefinition,
      admission,
      selection,
    });
  } catch (error) {
    fail(
      {
        INVALID_PROCESS_BROWSE_INPUT: 'INVALID_PRODUCT_BROWSE_INPUT',
        INVALID_PROCESS_NAVIGATION_CATALOGUE:
          'INVALID_PRODUCT_NAVIGATION_CATALOGUE',
      }[error?.code] || error?.code || 'INVALID_PRODUCT_BROWSE_INPUT',
      (error?.message || 'The Product Browse catalogue is invalid.')
        .replace(/\bProcess\b/g, 'Product'),
      error?.details || {},
    );
  }
}

function listProductBrowseOptions({
  navigation_definition: navigationDefinition,
  admission,
  query_templates: queryTemplates,
  selection,
}) {
  validateProductQueryTemplates({
    query_templates: queryTemplates,
    navigation_definition: navigationDefinition,
    admission,
  });
  return deepFreeze(clone(callCatalogue({
    navigationDefinition,
    admission,
    selection,
  })));
}

function compileProductBrowseQuery({
  selection,
  navigation_definition: navigationDefinition,
  admission,
  query_templates: queryTemplates,
}) {
  requireExactKeys(selection, [
    'domain_key',
    'topic_key',
    'pattern_key',
  ], 'Product Browse query selection');
  for (const key of ['domain_key', 'topic_key', 'pattern_key']) {
    requireText(selection[key], `Product Browse query selection ${key}`);
  }
  const templates = validateProductQueryTemplates({
    query_templates: queryTemplates,
    navigation_definition: navigationDefinition,
    admission,
  });
  if (selection.domain_key === 'ALL') {
    if (
      selection.topic_key !== 'ALL'
      || selection.pattern_key !== 'ALL'
    ) {
      fail(
        'INVALID_PRODUCT_BROWSE_INPUT',
        'An ALL Product selection must use ALL at every navigation level.',
      );
    }
    return deepFreeze(clone(callCatalogue({
      navigationDefinition,
      admission,
      selection: {
        domain_key: 'ALL',
        topic_key: null,
      },
    })));
  }

  const catalogueResult = callCatalogue({
    navigationDefinition,
    admission,
    selection: {
      domain_key: selection.domain_key,
      topic_key: selection.topic_key,
    },
  });
  if (catalogueResult.outcome !== 'CATALOGUE_NAVIGATION') {
    return deepFreeze(clone(catalogueResult));
  }
  const pattern = catalogueResult.options.find(
    (option) => option.key === selection.pattern_key,
  );
  if (!pattern) {
    return deepFreeze({
      outcome: 'TYPED_UNSUPPORTED',
      reason: 'NAVIGATION_SELECTION_NOT_ADMITTED',
      nearest_supported_concepts: clone(catalogueResult.options),
      query_ir: null,
    });
  }
  const selectedTemplate = templates.find(
    (entry) => entry.domain_key === selection.domain_key,
  );
  if (!selectedTemplate) {
    fail(
      'DOMAIN_QUERY_TEMPLATE_NOT_ADMITTED',
      'The selected Product domain has no governed query template.',
      { domain_key: selection.domain_key },
    );
  }
  const queryIr = compileProductQueryTemplate({
    admission,
    query_template: selectedTemplate.query_template,
    domain_key: selection.domain_key,
    predicate_key: pattern.predicate_key,
    predicate_version: pattern.predicate_version,
  });
  return deepFreeze({
    outcome: 'COMPILED',
    selection: clone(selection),
    understood_legal_question: {
      domain_key: selection.domain_key,
      topic_key: selection.topic_key,
      pattern_key: selection.pattern_key,
      predicate_key: pattern.predicate_key,
      predicate_version: pattern.predicate_version,
      label: pattern.label,
    },
    query_ir: queryIr,
  });
}

module.exports = {
  ProductBrowseCompilerError,
  compileProductBrowseQuery,
  listProductBrowseOptions,
  validateProductQueryTemplates,
};
