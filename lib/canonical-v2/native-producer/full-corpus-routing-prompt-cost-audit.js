'use strict';

// Read-only audit. This module cannot create a provider, call a provider,
// admit a source, write a database, or create an execution manifest.

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex, utf8ByteLength, utf8Slice } = require('../canonical-bytes');
const { resolveDurableArtifactRoot } = require('../durable-artifact-root');
const { validateCaptureReceipt, validateCohortCaptureManifest } = require('../corpus-source-discovery-capture');
const { sectionizeAdmittedSource } = require('./deterministic-sectionizer');
const {
  SECTION_FAMILY_CLASSIFIER_VERSION,
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
  classifyDeterministicSectionFamilies,
} = require('./section-family-classifier');
const { getProducerPromptModule, listRegisteredSectionFamilies } = require('./producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-prompt-binding');

const FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA = 'M3_FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT/V1';
const AUDIT_STATUS = 'AUDIT_ONLY_NOT_EXECUTION_MANIFEST';
const UNRESOLVED_DISPOSITION = 'UNRESOLVED_REQUIRES_COVERAGE_ATTESTATION';
const EXPECTED_RECEIPT_COHORT_COUNT = 41;
const ACCEPTED_DETERMINISTIC_PROVENANCE = Object.freeze([
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
]);
const MODEL_PROFILE = Object.freeze({
  profile_id: 'TERRA_MEDIUM',
  model: 'gpt-5.6-terra',
  reasoning_effort: 'medium',
});
const EXPLICIT_PRICE_TIME_POLICY_SCHEMA = 'M3_AUDIT_EXPLICIT_PRICE_TIME_POLICY/V1';
const EXPLICIT_PRICE_TIME_EVALUATION_SCHEMA = 'M3_AUDIT_EXPLICIT_PRICE_TIME_EVALUATION/V1';

class FullCorpusRoutingPromptCostAuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FullCorpusRoutingPromptCostAuditError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new FullCorpusRoutingPromptCostAuditError(code, message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function deriveSectionTitle(tree, node) {
  const byId = new Map(tree.nodes.map((candidate) => [candidate.section_id, candidate]));
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (typeof current.heading === 'string' && current.heading.length > 0) return current.heading;
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
}

function validateCapturedRecord(record) {
  if (!exactKeys(record, ['conversion', 'discovery', 'receipt'])) {
    fail('CAPTURE_RECORD_INVALID', 'Each captured source must contain only discovery, receipt and conversion records.');
  }
  validateCaptureReceipt(record.receipt);
  const { discovery, receipt, conversion } = record;
  if (!isPlainObject(discovery) || !isPlainObject(conversion)
    || discovery.discovery_id !== receipt.discovery_id
    || discovery.occurrence_id !== receipt.occurrence_id
    || conversion.intake_capture_receipt_id !== receipt.capture_id
    || conversion.source_admission_status !== 'NOT_ATTEMPTED'
    || typeof discovery.deal_id !== 'string' || discovery.deal_id.length === 0
    || typeof conversion.canonical_text !== 'string'
    || sha256Hex(conversion.canonical_text) !== conversion.canonical_text_sha256
    || utf8ByteLength(conversion.canonical_text) !== conversion.canonical_text_byte_length) {
    fail('CAPTURE_RECORD_BINDING_INVALID', 'Captured source records must remain bound to their non-admitted receipt and canonical text.');
  }
  return record;
}

function buildWorkItem({ source, node, classification, text }) {
  const promptBuilder = getProducerPromptModule(classification.section_family);
  if (!promptBuilder) fail('UNREGISTERED_POSITIVE_FAMILY', `No prompt builder is registered for ${classification.section_family}.`);
  const scope = Object.freeze({
    schema_version: 'NATIVE_GOVERNED_SCOPE/V1',
    document_hash: source.conversion.canonical_text_sha256,
    section_reference: node.reference,
    section_id: node.section_id,
    parent_section_id: node.parent_section_id,
    kind: node.kind,
    depth: node.depth,
    start: node.start,
    end: node.end,
    text_sha256: node.text_sha256,
    source_text: text,
    ...(classification.covenant_side ? { covenant_side: classification.covenant_side } : {}),
  });
  const rawPrompt = promptBuilder({ source_text: text, governed_scope: scope, known_definitions: [] });
  const prompt = bindNativePromptToGovernedScope({ prompt: rawPrompt, governed_scope: scope });
  const workItemBody = {
    occurrence_id: source.receipt.occurrence_id,
    source_digest: source.conversion.canonical_text_sha256,
    section_id: node.section_id,
    section_reference: node.reference,
    family_id: classification.section_family,
    prompt_id: prompt.prompt_id,
    prompt_version: prompt.prompt_version,
    model_profile: MODEL_PROFILE.profile_id,
  };
  return Object.freeze({
    work_item_id: contentId('M3_FULL_CORPUS_AUDIT_WORK_ITEM/V1', workItemBody),
    ...workItemBody,
    section_kind: node.kind,
    section_text_sha256: node.text_sha256,
    section_text_byte_length: utf8ByteLength(text),
    prompt_binding_schema: prompt.prompt_binding_schema,
    prompt_digest: contentId('M3_FULL_CORPUS_AUDIT_PROMPT/V1', prompt),
    prompt_byte_length: utf8ByteLength(canonicalJson(prompt.messages)),
    classifier_provenance: classification.provenance,
    classifier_version: classification.classifier_version,
    ...(classification.covenant_side ? { covenant_side: classification.covenant_side } : {}),
  });
}

function aggregate(workItems, key, outputKey, universe = []) {
  const grouped = new Map();
  for (const value of universe) {
    grouped.set(value, {
      [outputKey]: value,
      positive_work_item_count: 0,
      total_prompt_bytes: 0,
      total_section_text_bytes: 0,
    });
  }
  for (const item of workItems) {
    const value = item[key];
    const current = grouped.get(value) || {
      [outputKey]: value,
      positive_work_item_count: 0,
      total_prompt_bytes: 0,
      total_section_text_bytes: 0,
    };
    current.positive_work_item_count += 1;
    current.total_prompt_bytes += item.prompt_byte_length;
    current.total_section_text_bytes += item.section_text_byte_length;
    grouped.set(value, current);
  }
  return Object.freeze([...grouped.values()]
    .sort((left, right) => String(left[outputKey]).localeCompare(String(right[outputKey])))
    .map((entry) => Object.freeze(entry)));
}

function conditionalFormulae() {
  return Object.freeze([
    Object.freeze({
      formula_id: 'PROMPT_API_EQUIVALENT',
      expression: 'total_prompt_bytes * explicit_cost_policy.prompt_price_per_byte',
      required_policy_fields: Object.freeze(['currency', 'prompt_price_per_byte']),
      result: null,
      status: 'EXPLICIT_COST_POLICY_REQUIRED',
    }),
    Object.freeze({
      formula_id: 'TWO_LANE_PROMPT_SERVICE_TIME',
      expression: 'total_prompt_bytes / (2 * explicit_lane_policy.prompt_bytes_per_second_per_lane)',
      required_policy_fields: Object.freeze(['prompt_bytes_per_second_per_lane']),
      result: null,
      status: 'EXPLICIT_LANE_POLICY_REQUIRED',
    }),
  ]);
}

function validateExplicitPriceTimePolicy(policy) {
  if (!exactKeys(policy, ['schema_version', 'policy_id', 'currency', 'prompt_price_per_byte', 'prompt_bytes_per_second_per_lane', 'lane_count', 'policy_digest'])
    || policy.schema_version !== EXPLICIT_PRICE_TIME_POLICY_SCHEMA
    || typeof policy.policy_id !== 'string' || policy.policy_id.length === 0 || policy.policy_id.trim() !== policy.policy_id
    || (policy.currency !== null && (typeof policy.currency !== 'string' || policy.currency.length === 0 || policy.currency.trim() !== policy.currency))
    || (policy.prompt_price_per_byte !== null && (!Number.isFinite(policy.prompt_price_per_byte) || policy.prompt_price_per_byte < 0))
    || (policy.prompt_bytes_per_second_per_lane !== null && (!Number.isFinite(policy.prompt_bytes_per_second_per_lane) || policy.prompt_bytes_per_second_per_lane <= 0))
    || (policy.lane_count !== null && (!Number.isSafeInteger(policy.lane_count) || policy.lane_count < 1))
    || typeof policy.policy_digest !== 'string') {
    fail('EXPLICIT_PRICE_TIME_POLICY_INVALID', 'A price/time policy must contain only explicit caller-supplied numeric rates.');
  }
  if (policy.prompt_price_per_byte === null && policy.prompt_bytes_per_second_per_lane === null) {
    fail('EXPLICIT_PRICE_TIME_POLICY_EMPTY', 'A price/time policy must supply at least one numeric rate.');
  }
  if (policy.prompt_price_per_byte !== null && policy.currency === null) {
    fail('EXPLICIT_PRICE_TIME_POLICY_CURRENCY_REQUIRED', 'A prompt price requires an explicit currency.');
  }
  if (policy.prompt_bytes_per_second_per_lane !== null && policy.lane_count === null) {
    fail('EXPLICIT_PRICE_TIME_POLICY_LANES_REQUIRED', 'A lane rate requires an explicit lane count.');
  }
  const body = { ...policy };
  delete body.policy_digest;
  if (policy.policy_digest !== contentId(EXPLICIT_PRICE_TIME_POLICY_SCHEMA, body)) {
    fail('EXPLICIT_PRICE_TIME_POLICY_DIGEST_INVALID', 'The price/time policy identity does not bind its supplied rates.');
  }
  return Object.freeze({ ...policy });
}

function buildExplicitPriceTimePolicy({
  policy_id: policyId,
  currency = null,
  prompt_price_per_byte: promptPricePerByte = null,
  prompt_bytes_per_second_per_lane: promptBytesPerSecondPerLane = null,
  lane_count: laneCount = null,
} = {}) {
  const body = {
    schema_version: EXPLICIT_PRICE_TIME_POLICY_SCHEMA,
    policy_id: policyId,
    currency,
    prompt_price_per_byte: promptPricePerByte,
    prompt_bytes_per_second_per_lane: promptBytesPerSecondPerLane,
    lane_count: laneCount,
  };
  return Object.freeze({ ...body, policy_digest: contentId(EXPLICIT_PRICE_TIME_POLICY_SCHEMA, body) });
}

function evaluateExplicitPriceTimePolicy({ audit, policy } = {}) {
  validateFullCorpusRoutingPromptCostAudit(audit);
  const resolvedPolicy = validateExplicitPriceTimePolicy(policy);
  const totalPromptBytes = audit.totals.prompt_bytes;
  const body = {
    schema_version: EXPLICIT_PRICE_TIME_EVALUATION_SCHEMA,
    status: AUDIT_STATUS,
    authority: Object.freeze({ provider_authority: 'NONE', execution_authority: 'NONE', production_authority: 'NONE' }),
    audit_id: audit.audit_id,
    policy_id: resolvedPolicy.policy_id,
    policy_digest: resolvedPolicy.policy_digest,
    total_prompt_bytes: totalPromptBytes,
    prompt_api_equivalent: resolvedPolicy.prompt_price_per_byte === null ? null : Object.freeze({
      currency: resolvedPolicy.currency,
      prompt_price_per_byte: resolvedPolicy.prompt_price_per_byte,
      computed_cost: totalPromptBytes * resolvedPolicy.prompt_price_per_byte,
    }),
    lane_time: resolvedPolicy.prompt_bytes_per_second_per_lane === null ? null : Object.freeze({
      lane_count: resolvedPolicy.lane_count,
      prompt_bytes_per_second_per_lane: resolvedPolicy.prompt_bytes_per_second_per_lane,
      computed_service_seconds: totalPromptBytes / (resolvedPolicy.lane_count * resolvedPolicy.prompt_bytes_per_second_per_lane),
    }),
  };
  return Object.freeze({ ...body, evaluation_id: contentId(EXPLICIT_PRICE_TIME_EVALUATION_SCHEMA, body) });
}

// The audit prices the same outer sections that a future run would route.
// It does not multiply a parent section into every child limb merely because
// a child inherits the parent's heading for classification purposes.
function dispatchableNodes(tree) {
  const nodes = tree.nodes.filter((node) => node.reference);
  const hasSectionDescendant = (candidate) => nodes.some((node) => {
    if (node.kind !== 'SECTION' || !node.parent_section_id) return false;
    let parent = node.parent_section_id;
    const byId = new Map(tree.nodes.map((item) => [item.section_id, item]));
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      if (parent === candidate.section_id) return true;
      seen.add(parent);
      parent = byId.get(parent)?.parent_section_id || null;
    }
    return false;
  });
  const primary = nodes.filter((node) => node.kind === 'SECTION'
    || (node.kind === 'ARTICLE' && !hasSectionDescendant(node)));
  if (primary.length > 0) return primary;
  return nodes.filter((node) => node.kind === 'SUBSECTION');
}

function buildAuditFromCaptureRecords({ cohort_manifest: cohortManifest, capture_records: captureRecords } = {}) {
  validateCohortCaptureManifest(cohortManifest);
  if (!Array.isArray(captureRecords) || cohortManifest.receipt_associations.length !== EXPECTED_RECEIPT_COHORT_COUNT
    || captureRecords.length !== EXPECTED_RECEIPT_COHORT_COUNT) {
    fail('RECEIPT_COHORT_MISMATCH', `The audit requires exactly ${EXPECTED_RECEIPT_COHORT_COUNT} captured receipt occurrences.`);
  }
  const associations = new Map(cohortManifest.receipt_associations.map((item) => [item.receipt_id, item]));
  if (associations.size !== EXPECTED_RECEIPT_COHORT_COUNT) fail('RECEIPT_COHORT_MISMATCH', 'Receipt identities must be unique.');

  const sources = captureRecords.map(validateCapturedRecord)
    .sort((left, right) => left.receipt.occurrence_id.localeCompare(right.receipt.occurrence_id));
  const seenReceipts = new Set();
  const seenOccurrences = new Set();
  for (const source of sources) {
    const association = associations.get(source.receipt.receipt_id);
    if (!association || association.discovery_id !== source.receipt.discovery_id
      || association.occurrence_id !== source.receipt.occurrence_id
      || seenReceipts.has(source.receipt.receipt_id) || seenOccurrences.has(source.receipt.occurrence_id)) {
      fail('RECEIPT_COHORT_BINDING_INVALID', 'Every receipt occurrence must appear once and preserve its cohort binding.');
    }
    seenReceipts.add(source.receipt.receipt_id);
    seenOccurrences.add(source.receipt.occurrence_id);
  }
  if (seenReceipts.size !== associations.size) fail('RECEIPT_COHORT_BINDING_INVALID', 'The captured receipt set is incomplete.');

  const families = listRegisteredSectionFamilies();
  const workItems = [];
  const seenWorkItemKeys = new Set();
  const sourceFamilyMatrix = [];
  const sourceRows = [];
  for (const source of sources) {
    const sourceText = source.conversion.canonical_text;
    const tree = sectionizeAdmittedSource({ source_text: sourceText, document_hash: source.conversion.canonical_text_sha256 });
    const signalsByFamily = new Map();
    for (const node of dispatchableNodes(tree)) {
      const text = utf8Slice(sourceText, node.start, node.end);
      const classifications = classifyDeterministicSectionFamilies({
        title: deriveSectionTitle(tree, node),
        article_context: node.article_context || null,
        source_text: text,
      });
      for (const classification of classifications) {
        if (!ACCEPTED_DETERMINISTIC_PROVENANCE.includes(classification.provenance)
          || !families.includes(classification.section_family)) continue;
        const workItemKey = canonicalJson([
          source.receipt.occurrence_id,
          node.section_id,
          classification.section_family,
        ]);
        if (seenWorkItemKeys.has(workItemKey)) continue;
        seenWorkItemKeys.add(workItemKey);
        const workItem = buildWorkItem({ source, node, classification, text });
        workItems.push(workItem);
        const items = signalsByFamily.get(workItem.family_id) || [];
        items.push(workItem.work_item_id);
        signalsByFamily.set(workItem.family_id, items);
      }
    }
    for (const familyId of families) {
      const positiveWorkItemIds = signalsByFamily.get(familyId) || [];
      sourceFamilyMatrix.push(Object.freeze({
        occurrence_id: source.receipt.occurrence_id,
        source_digest: source.conversion.canonical_text_sha256,
        family_id: familyId,
        disposition: positiveWorkItemIds.length > 0
          ? 'POSITIVE_DETERMINISTIC_SIGNAL'
          : UNRESOLVED_DISPOSITION,
        positive_work_item_ids: Object.freeze([...positiveWorkItemIds].sort()),
      }));
    }
    sourceRows.push(Object.freeze({
      occurrence_id: source.receipt.occurrence_id,
      deal_id: source.discovery.deal_id,
      receipt_id: source.receipt.receipt_id,
      source_digest: source.conversion.canonical_text_sha256,
      source_text_bytes: source.conversion.canonical_text_byte_length,
      positive_work_item_count: 0,
    }));
  }
  const itemBySource = aggregate(workItems, 'occurrence_id', 'occurrence_id');
  const sourceWorkTotals = new Map(itemBySource.map((row) => [row.occurrence_id, row]));
  const populatedSourceRows = Object.freeze(sourceRows.map((row) => Object.freeze({
    ...row,
    positive_work_item_count: sourceWorkTotals.get(row.occurrence_id)?.positive_work_item_count || 0,
    total_prompt_bytes: sourceWorkTotals.get(row.occurrence_id)?.total_prompt_bytes || 0,
  })));
  const sortedWorkItems = Object.freeze([...workItems].sort((left, right) => left.work_item_id.localeCompare(right.work_item_id)));
  const familyDistribution = aggregate(sortedWorkItems, 'family_id', 'family_id', families);
  const receiptAssociations = Object.freeze([...cohortManifest.receipt_associations]
    .sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id)));
  const body = {
    schema_version: FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA,
    status: AUDIT_STATUS,
    authority: Object.freeze({
      source_admission_authority: 'NONE', provider_authority: 'NONE', database_authority: 'NONE',
      production_authority: 'NONE', execution_authority: 'NONE',
    }),
    receipt_cohort: Object.freeze({
      cohort_capture_manifest_id: cohortManifest.cohort_capture_manifest_id,
      receipt_count: EXPECTED_RECEIPT_COHORT_COUNT,
      receipt_cohort_digest: contentId('M3_FULL_CORPUS_AUDIT_RECEIPT_COHORT/V1', receiptAssociations),
    }),
    classifier: Object.freeze({
      version: SECTION_FAMILY_CLASSIFIER_VERSION,
      accepted_provenance: ACCEPTED_DETERMINISTIC_PROVENANCE,
    }),
    implementation_bindings: currentImplementationBindings(),
    model_profile: MODEL_PROFILE,
    registered_families: Object.freeze(families),
    sources: populatedSourceRows,
    source_family_matrix: Object.freeze(sourceFamilyMatrix),
    work_items: sortedWorkItems,
    distributions: Object.freeze({
      by_family: familyDistribution,
      by_source: aggregate(sortedWorkItems, 'occurrence_id', 'occurrence_id', sources.map((source) => source.receipt.occurrence_id)),
      by_deal: aggregate(
        sortedWorkItems.map((item) => ({ ...item, deal_id: sources.find((source) => source.receipt.occurrence_id === item.occurrence_id).discovery.deal_id })),
        'deal_id',
        'deal_id',
        [...new Set(sources.map((source) => source.discovery.deal_id))],
      ),
    }),
    totals: Object.freeze({
      source_count: sources.length,
      source_text_bytes: sources.reduce((total, source) => total + source.conversion.canonical_text_byte_length, 0),
      positive_work_item_count: sortedWorkItems.length,
      prompt_bytes: sortedWorkItems.reduce((total, item) => total + item.prompt_byte_length, 0),
      unresolved_source_family_cell_count: sourceFamilyMatrix.filter((cell) => cell.disposition === UNRESOLVED_DISPOSITION).length,
    }),
    conditional_lane_time_and_api_equivalent_formulae: conditionalFormulae(),
  };
  return Object.freeze({ ...body, audit_id: contentId(FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA, body) });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail('CAPTURE_ARTIFACT_UNREADABLE', `Could not read ${file}: ${error.message}`);
  }
}

function moduleSourceDigest(modulePath) {
  return sha256Hex(fs.readFileSync(modulePath));
}

function currentImplementationBindings() {
  const modules = Object.freeze({
    audit: moduleSourceDigest(__filename),
    deterministic_sectionizer: moduleSourceDigest(require.resolve('./deterministic-sectionizer')),
    section_family_classifier: moduleSourceDigest(require.resolve('./section-family-classifier')),
    producer_prompt_registry: moduleSourceDigest(require.resolve('./producer-prompt-registry')),
    native_prompt_binding: moduleSourceDigest(require.resolve('./native-prompt-binding')),
  });
  return Object.freeze({
    modules,
    implementation_digest: contentId('M3_FULL_CORPUS_AUDIT_IMPLEMENTATION/V1', modules),
  });
}

function loadCaptureRecords(artifactRoot) {
  const captureRoot = path.join(artifactRoot, 'm3-corpus-source-capture');
  if (!fs.existsSync(captureRoot)) fail('CAPTURE_ARTIFACT_MISSING', 'The captured corpus directory is missing.');
  const records = [];
  for (const entry of fs.readdirSync(captureRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(captureRoot, entry.name);
    records.push({
      discovery: readJson(path.join(directory, 'discovery.json')),
      receipt: readJson(path.join(directory, 'intake-receipt.json')),
      conversion: readJson(path.join(directory, 'canonical-conversion.json')),
    });
  }
  return records;
}

function buildFullCorpusRoutingPromptCostAudit({ artifact_root: artifactRoot } = {}) {
  const root = resolveDurableArtifactRoot({ root: artifactRoot, certificationMode: true, requireExisting: true });
  const captureRoot = path.join(root, 'm3-corpus-source-capture');
  return buildAuditFromCaptureRecords({
    cohort_manifest: readJson(path.join(captureRoot, 'cohort-capture-manifest.json')),
    capture_records: loadCaptureRecords(root),
  });
}

function validateFullCorpusRoutingPromptCostAudit(audit, { artifact_root: artifactRoot } = {}) {
  if (!isPlainObject(audit) || audit.schema_version !== FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA
    || audit.status !== AUDIT_STATUS || !audit.authority
    || Object.values(audit.authority).some((value) => value !== 'NONE')
    || audit.receipt_cohort?.receipt_count !== EXPECTED_RECEIPT_COHORT_COUNT
    || typeof audit.implementation_bindings?.implementation_digest !== 'string'
    || audit.implementation_bindings.implementation_digest !== currentImplementationBindings().implementation_digest
    || audit.totals?.source_count !== EXPECTED_RECEIPT_COHORT_COUNT
    || audit.source_family_matrix?.some((cell) => ![UNRESOLVED_DISPOSITION, 'POSITIVE_DETERMINISTIC_SIGNAL'].includes(cell.disposition))) {
    fail('AUDIT_INVALID', 'The audit is not a valid non-authoritative full-corpus routing audit.');
  }
  const body = { ...audit };
  delete body.audit_id;
  if (audit.audit_id !== contentId(FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA, body)) fail('AUDIT_ID_INVALID', 'The audit identity does not bind its content.');
  if (artifactRoot !== undefined) {
    const rebuilt = buildFullCorpusRoutingPromptCostAudit({ artifact_root: artifactRoot });
    if (canonicalJson(rebuilt) !== canonicalJson(audit)) fail('AUDIT_REBUILD_MISMATCH', 'The audit does not match a fresh rebuild from its bound artifact root.');
  }
  return true;
}

module.exports = {
  FULL_CORPUS_ROUTING_PROMPT_COST_AUDIT_SCHEMA,
  AUDIT_STATUS,
  UNRESOLVED_DISPOSITION,
  EXPECTED_RECEIPT_COHORT_COUNT,
  MODEL_PROFILE,
  ACCEPTED_DETERMINISTIC_PROVENANCE,
  EXPLICIT_PRICE_TIME_POLICY_SCHEMA,
  EXPLICIT_PRICE_TIME_EVALUATION_SCHEMA,
  FullCorpusRoutingPromptCostAuditError,
  buildAuditFromCaptureRecords,
  buildFullCorpusRoutingPromptCostAudit,
  validateFullCorpusRoutingPromptCostAudit,
  buildExplicitPriceTimePolicy,
  validateExplicitPriceTimePolicy,
  evaluateExplicitPriceTimePolicy,
};
