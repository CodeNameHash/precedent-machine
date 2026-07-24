class ReviewRowBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReviewRowBindingError';
    this.code = code;
  }
}

const PARTY_KEYS = Object.freeze(['role', 'value', 'capacity']);
const CARDINALITIES = new Set(['EXACTLY_ONE', 'MANY_BY_GOVERNED_ORDINAL']);

function party(role, value, capacity) {
  return Object.freeze({ role, value, capacity });
}

function selector(concept_key, metric_key, partyValue, component_slot_key) {
  return Object.freeze({
    concept_key,
    concept_version: 1,
    metric_key,
    metric_version: 1,
    party: partyValue,
    component_slot_key,
  });
}

function rowTarget(section_id, group_id, row_id) {
  return Object.freeze({
    section_id,
    group_id,
    identity_kind: 'ROW_ID',
    identity_value: row_id,
  });
}

function provisionTarget(section_id, provision_code) {
  return Object.freeze({
    section_id,
    group_id: null,
    identity_kind: 'PROVISION_CODE',
    identity_value: provision_code,
  });
}

function rule(binding_key, canonical, review, cardinality = 'EXACTLY_ONE') {
  return Object.freeze({
    binding_key,
    canonical,
    review,
    cardinality,
  });
}

const F4_REVIEW_ROW_BINDING_RULES = Object.freeze([
  rule(
    'F4_CAPITALISATION_ACCURACY',
    selector(
      'COND-B-REP',
      'REPRESENTATION_ACCURACY_STANDARD',
      party('CONDITION_BENEFICIARY', 'PARENT', 'ACQUIRER'),
      'CAPITALISATION_LIMBS_I_AND_III',
    ),
    provisionTarget('representations-qualifiers', 'REP-T-CAP'),
  ),
  rule(
    'F4_NO_SHOP_PROHIBITED_ACTIONS',
    selector(
      'NOSOL-PROHIBIT',
      'NO_SHOP_PROHIBITED_ACTION',
      party('COVENANT_OBLIGOR', 'COMPANY', 'TARGET'),
      'PROHIBITED_ACTION',
    ),
    rowTarget('nosol', 'nosol-no-shop-core', 'nosol-noshop-prohibit'),
    'MANY_BY_GOVERNED_ORDINAL',
  ),
  rule(
    'F4_NO_SHOP_NOTICE',
    selector(
      'NOSOL-NOTICE',
      'NO_SHOP_NOTICE_PERIOD_DAYS',
      party('COVENANT_OBLIGOR', 'COMPANY', 'TARGET'),
      'NOTICE_PERIOD',
    ),
    rowTarget('nosol', 'nosol-notice', 'nosol-noshop-notice-hours'),
  ),
  rule(
    'F4_NO_SHOP_INITIAL_MATCH',
    selector(
      'NOSOL-MATCH',
      'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      party('RIGHT_HOLDER', 'PARENT', 'ACQUIRER'),
      'INITIAL_MATCH_PERIOD',
    ),
    rowTarget('nosol', 'nosol-matching', 'nosol-fiduciary-initial-match'),
  ),
  rule(
    'F4_NO_SHOP_SUBSEQUENT_MATCH',
    selector(
      'NOSOL-REMATCH',
      'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      party('RIGHT_HOLDER', 'PARENT', 'ACQUIRER'),
      'SUBSEQUENT_MATCH_PERIOD',
    ),
    rowTarget('nosol', 'nosol-matching', 'nosol-fiduciary-subsequent-match'),
  ),
  rule(
    'F4_MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD',
    selector(
      'REP-T-CONTRACTS',
      'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      party('REPRESENTATION_MAKER', 'COMPANY', 'TARGET'),
      'CASH_FLOW_THRESHOLD',
    ),
    // F4-specific until the shared row governs a per-deal presentation identity:
    // clause D is the first QXO AGGREGATE_PAYMENTS row, not the later customer row.
    rowTarget('material-contracts', null, 'material-contracts-AGGREGATE_PAYMENTS-1'),
  ),
  rule(
    'F4_SELLER_TERMINATION_FEE',
    selector(
      'TERMF-TARGET',
      'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      party('FEE_PAYER', 'COMPANY', 'TARGET'),
      'FEE_AMOUNT',
    ),
    rowTarget('termination-fees', null, 'termination-fees-COMPANY_TERMINATION_FEE'),
  ),
  rule(
    'F4_BUYER_TERMINATION_FEE',
    selector(
      'TERMF-REVERSE',
      'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
      party('FEE_PAYER', 'PARENT', 'BUYER'),
      'FEE_AMOUNT',
    ),
    rowTarget('termination-fees', null, 'termination-fees-REVERSE_TERMINATION_FEE'),
  ),
]);

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function partyKey(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).sort().join(',') !== [...PARTY_KEYS].sort().join(',')) return null;
  const values = PARTY_KEYS.map((key) => text(value[key]));
  return values.every(Boolean) ? values.join(':') : null;
}

function selectorKey(value) {
  const conceptKey = text(value?.concept_key);
  const metricKey = text(value?.metric_key);
  const slotKey = text(value?.component_slot_key);
  const governedParty = partyKey(value?.party);
  if (!conceptKey
    || value?.concept_version !== 1
    || !metricKey
    || value?.metric_version !== 1
    || !slotKey
    || !governedParty) {
    return null;
  }
  return [conceptKey, '1', metricKey, '1', governedParty, slotKey].join('|');
}

function targetKey(value) {
  const sectionId = text(value?.section_id);
  const groupId = value?.group_id === null ? '' : text(value?.group_id);
  const kind = value?.identity_kind;
  const identity = text(value?.identity_value);
  if (!sectionId || groupId === null || !['ROW_ID', 'PROVISION_CODE'].includes(kind) || !identity) {
    return null;
  }
  return [sectionId, groupId, kind, kind === 'PROVISION_CODE' ? identity.toUpperCase() : identity].join('|');
}

function compileRules(rules) {
  if (!Array.isArray(rules) || !rules.length) {
    throw new ReviewRowBindingError('INVALID_BINDING_RULES', 'Review binding rules must be a non-empty array.');
  }
  const bindingKeys = new Set();
  const selectors = new Set();
  const targets = new Set();
  return rules.map((candidate) => {
    const bindingKey = text(candidate?.binding_key);
    const canonicalKey = selectorKey(candidate?.canonical);
    const reviewKey = targetKey(candidate?.review);
    if (!bindingKey || !canonicalKey || !reviewKey || !CARDINALITIES.has(candidate?.cardinality)) {
      throw new ReviewRowBindingError('INVALID_BINDING_RULE', 'A Review binding rule is malformed.');
    }
    if (bindingKeys.has(bindingKey) || selectors.has(canonicalKey) || targets.has(reviewKey)) {
      throw new ReviewRowBindingError(
        'DUPLICATE_BINDING_RULE',
        `${bindingKey} duplicates a governed selector or Review target.`,
      );
    }
    bindingKeys.add(bindingKey);
    selectors.add(canonicalKey);
    targets.add(reviewKey);
    return Object.freeze({
      ...candidate,
      canonical_key: canonicalKey,
      review_key: reviewKey,
    });
  });
}

function preparedMetadata(prepared) {
  if (!prepared || typeof prepared !== 'object' || Array.isArray(prepared)) {
    return { bindable: false, reason_code: 'INVALID_PREPARED_ROW' };
  }
  const governed = prepared.governed_binding;
  if (governed === null && prepared.resolution?.rowKind === 'REVIEWED_SOURCE_SPECIFIC') {
    return { bindable: false, reason_code: 'REVIEWED_SOURCE_SPECIFIC' };
  }
  if (!governed || typeof governed !== 'object' || Array.isArray(governed)) {
    return { bindable: false, reason_code: 'MISSING_GOVERNED_BINDING' };
  }
  const canonical = {
    concept_key: governed.concept_key,
    concept_version: governed.concept_version,
    metric_key: governed.metric_key,
    metric_version: governed.metric_version,
    party: governed.party,
    component_slot_key: governed.component_slot_key,
  };
  const canonicalKey = selectorKey(canonical);
  const rowKey = text(prepared.row_key);
  const resultOrdinal = governed.result_ordinal;
  const governedOrdinal = governed.governed_ordinal;
  if (!canonicalKey
    || !rowKey
    || !Number.isInteger(resultOrdinal)
    || resultOrdinal < 0
    || !Number.isInteger(governedOrdinal)
    || governedOrdinal < 0) {
    return { bindable: false, reason_code: 'INVALID_GOVERNED_BINDING' };
  }
  return {
    bindable: true,
    canonical,
    canonical_key: canonicalKey,
    row_key: rowKey,
    result_ordinal: resultOrdinal,
    governed_ordinal: governedOrdinal,
  };
}

function normaliseReviewIdentity(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const sectionId = text(entry.section_id);
  const groupId = entry.group_id == null ? null : text(entry.group_id);
  const rowId = entry.row_id == null ? null : text(entry.row_id);
  const provisionCode = entry.provision_code == null ? null : text(entry.provision_code)?.toUpperCase();
  if (!sectionId || (entry.group_id != null && !groupId) || (!rowId && !provisionCode)) return null;
  return {
    section_id: sectionId,
    group_id: groupId,
    row_id: rowId,
    provision_code: provisionCode,
  };
}

function reviewTargetMatches(target, identity) {
  if (target.section_id !== identity.section_id || target.group_id !== identity.group_id) return false;
  if (target.identity_kind === 'ROW_ID') return target.identity_value === identity.row_id;
  return target.identity_value.toUpperCase() === identity.provision_code;
}

function findPreparedReviewBinding(bindingResult, reviewIdentity) {
  const identity = normaliseReviewIdentity(reviewIdentity);
  if (!identity || !Array.isArray(bindingResult?.bindings)) return null;
  const matches = bindingResult.bindings.filter(
    (binding) => reviewTargetMatches(binding.review_identity, identity),
  );
  if (matches.length > 1) {
    throw new ReviewRowBindingError(
      'AMBIGUOUS_BOUND_REVIEW_ROW',
      'A normal Review row resolved to more than one governed binding.',
    );
  }
  return matches[0] || null;
}

function bindPreparedRowsToReviewRows({
  prepared_rows,
  review_rows,
  rules = F4_REVIEW_ROW_BINDING_RULES,
} = {}) {
  if (!Array.isArray(prepared_rows) || !Array.isArray(review_rows)) {
    throw new ReviewRowBindingError(
      'INVALID_BINDING_INPUT',
      'prepared_rows and review_rows must both be arrays.',
    );
  }
  const compiledRules = compileRules(rules);
  const ruleBySelector = new Map(compiledRules.map((item) => [item.canonical_key, item]));
  const errors = [];
  const reviewEntries = [];
  review_rows.forEach((entry, index) => {
    const identity = normaliseReviewIdentity(entry);
    if (!identity) {
      errors.push(Object.freeze({
        code: 'INVALID_REVIEW_ROW_IDENTITY',
        review_row_index: index,
      }));
      return;
    }
    reviewEntries.push({ entry, identity });
  });
  const rowsByBinding = new Map(compiledRules.map((item) => [item.binding_key, []]));
  const isolated = [];
  const preparedEntries = [];
  prepared_rows.forEach((prepared, index) => {
    const metadata = preparedMetadata(prepared);
    if (!metadata.bindable) {
      isolated.push(Object.freeze({ prepared, reason_code: metadata.reason_code }));
      return;
    }
    preparedEntries.push({ prepared, metadata, index });
  });

  const excludedEntries = new Set();
  const isolateDuplicates = (entries, reasonCode, errorFields) => {
    entries.forEach((entry) => {
      excludedEntries.add(entry);
      isolated.push(Object.freeze({
        prepared: entry.prepared,
        reason_code: reasonCode,
        canonical: Object.freeze(entry.metadata.canonical),
      }));
    });
    errors.push(Object.freeze({ code: reasonCode, ...errorFields }));
  };
  const entriesByRowKey = Map.groupBy
    ? Map.groupBy(preparedEntries, (entry) => entry.metadata.row_key)
    : preparedEntries.reduce((map, entry) => {
      const key = entry.metadata.row_key;
      map.set(key, [...(map.get(key) || []), entry]);
      return map;
    }, new Map());
  for (const [rowKey, entries] of entriesByRowKey) {
    if (entries.length > 1) {
      isolateDuplicates(entries, 'DUPLICATE_PREPARED_ROW', { row_key: rowKey });
    }
  }
  const entriesBySlot = new Map();
  preparedEntries.filter((entry) => !excludedEntries.has(entry)).forEach((entry) => {
    const slotKey = `${entry.metadata.canonical_key}|${entry.metadata.result_ordinal}|${entry.metadata.governed_ordinal}`;
    entriesBySlot.set(slotKey, [...(entriesBySlot.get(slotKey) || []), entry]);
  });
  for (const [slotKey, entries] of entriesBySlot) {
    if (entries.length > 1) {
      isolateDuplicates(entries, 'DUPLICATE_CANONICAL_SLOT', { canonical_slot_key: slotKey });
    }
  }

  preparedEntries.filter((entry) => !excludedEntries.has(entry)).forEach(({ prepared, metadata }) => {
    const bindingRule = ruleBySelector.get(metadata.canonical_key);
    if (!bindingRule) {
      isolated.push(Object.freeze({
        prepared,
        reason_code: 'NO_GOVERNED_REVIEW_BINDING',
        canonical: Object.freeze(metadata.canonical),
      }));
      return;
    }
    rowsByBinding.get(bindingRule.binding_key).push({ prepared, metadata });
  });

  const bindings = [];
  for (const bindingRule of compiledRules) {
    const canonicalMatches = rowsByBinding.get(bindingRule.binding_key);
    if (!canonicalMatches.length) continue;
    if (bindingRule.cardinality === 'EXACTLY_ONE' && canonicalMatches.length !== 1) {
      canonicalMatches.forEach(({ prepared, metadata }) => isolated.push(Object.freeze({
        prepared,
        reason_code: 'AMBIGUOUS_CANONICAL_BINDING',
        canonical: Object.freeze(metadata.canonical),
      })));
      errors.push(Object.freeze({
        code: 'AMBIGUOUS_CANONICAL_BINDING',
        binding_key: bindingRule.binding_key,
      }));
      continue;
    }
    const reviewMatches = reviewEntries.filter(
      ({ identity }) => reviewTargetMatches(bindingRule.review, identity),
    );
    if (reviewMatches.length > 1) {
      canonicalMatches.forEach(({ prepared, metadata }) => isolated.push(Object.freeze({
        prepared,
        reason_code: 'AMBIGUOUS_REVIEW_ROW_BINDING',
        canonical: Object.freeze(metadata.canonical),
        intended_review_identity: bindingRule.review,
      })));
      errors.push(Object.freeze({
        code: 'AMBIGUOUS_REVIEW_ROW_BINDING',
        binding_key: bindingRule.binding_key,
      }));
      continue;
    }
    if (reviewMatches.length === 0) {
      canonicalMatches.forEach(({ prepared, metadata }) => isolated.push(Object.freeze({
        prepared,
        reason_code: 'REVIEW_ROW_NOT_FOUND',
        canonical: Object.freeze(metadata.canonical),
        intended_review_identity: bindingRule.review,
      })));
      continue;
    }
    const ordered = [...canonicalMatches].sort(
      (left, right) => left.metadata.result_ordinal - right.metadata.result_ordinal
        || left.metadata.governed_ordinal - right.metadata.governed_ordinal
        || left.metadata.row_key.localeCompare(right.metadata.row_key),
    );
    bindings.push(Object.freeze({
      binding_key: bindingRule.binding_key,
      review_identity: bindingRule.review,
      review_row: reviewMatches[0].entry,
      prepared_rows: Object.freeze(ordered.map(({ prepared }) => prepared)),
    }));
  }

  return Object.freeze({
    schema_version: 'CANONICAL_REVIEW_ROW_BINDING_RESULT/V2',
    bindings: Object.freeze(bindings),
    isolated: Object.freeze(isolated),
    errors: Object.freeze(errors),
  });
}

compileRules(F4_REVIEW_ROW_BINDING_RULES);

module.exports = {
  F4_REVIEW_ROW_BINDING_RULES,
  ReviewRowBindingError,
  bindPreparedRowsToReviewRows,
  findPreparedReviewBinding,
  preparedMetadata,
};
