#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
process.chdir(ROOT);
const OUTPUT_PATH = path.join(
  ROOT,
  'evidence/process-intelligence/baseline/product-field-source-inventory.json',
);
const SOURCE_BASELINE_COMMIT = 'c5737a59b01654d81380ff48771576d1f00e289f';
const CONTENT_ID_DOMAIN = 'PROCESS_INTELLIGENCE_PRODUCT_FIELD_SOURCE_INVENTORY/V1';
const SOURCE_FILES = Object.freeze([
  {
    path: 'lib/deals-index-columns.js',
    sha256: '3457984b065a277bc3aa18d34da62a7436325a7fe7ec0672ab0cbccd9473c1d3',
  },
  {
    path: 'lib/query/types.js',
    sha256: '7ff2577f958ab9f0337eebd8186cf283f9bae4be03ddcc88aff424fc55ae22b3',
  },
  {
    path: 'lib/query/field-meta.js',
    sha256: '4b74cfa416a2a811b929d03851e7b9cdc91654dc754b6c74756be8f47988bbb5',
  },
  {
    path: 'lib/query/derived-fields.js',
    sha256: '5d35d1dc874ee56c96e17e30df79d698d1a3dc4f6d9c5378279086f235ae539e',
  },
  {
    path: 'lib/query/resolve.js',
    sha256: 'c7d25168c0f08f413158342b12f46be4ae5e889012a2f9531a20d59df3ab01b5',
  },
  {
    path: 'lib/query/serving-registry-v1.json',
    sha256: 'ecbace4566431277bb96b34eead1c03cc3ca4ca7e10fe15bf0796bcfbb95e8de',
  },
]);
const EXPECTED_DEALS_FIELD_KEYS = Object.freeze([
  'deal',
  'signed',
  'buyer',
  'value',
  'type',
  'structure',
  'buyer_type',
  'sector',
  'law_firm',
  'lawyer',
  'law_firm_buyer',
  'law_firm_target',
  'lawyers_buyer',
  'lawyers_target',
  'merger_form',
]);
const PRESENTATION_SCOPE = Object.freeze({
  MATERIAL_CONTRACT: /contract|consent|scrape|assignment|changeofcontrol|redaction/i,
  MAE: /mae|carve|disproportion/i,
});

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { COLUMNS } = require('../lib/deals-index-columns');
const {
  PROVISION_CARD_TYPES,
  featureDefsForWpType,
  fieldDef,
} = require('../lib/query/types');
const { fieldsForProvisionType } = require('../lib/query/field-meta');
const { DERIVED_FIELDS } = require('../lib/query/derived-fields');
const {
  entryForKey,
  readRegistry,
} = require('../lib/query/resolve');

function fail(message) {
  throw new Error(`PROCESS_INTELLIGENCE_BASELINE_INVALID: ${message}`);
}

function compareCanonicalText(left, right) {
  const leftText = String(left);
  const rightText = String(right);
  if (leftText === rightText) return 0;
  return leftText < rightText ? -1 : 1;
}

function exactSourceFiles() {
  const sourcePaths = new Set();
  return SOURCE_FILES.map((source) => {
    if (!source || typeof source.path !== 'string' || !source.path) {
      fail('a pinned source file lacks a relative path');
    }
    if (path.isAbsolute(source.path) || source.path.split(path.sep).includes('..')) {
      fail(`pinned source path is not repository-relative: ${source.path}`);
    }
    if (sourcePaths.has(source.path)) {
      fail(`pinned source path is duplicated: ${source.path}`);
    }
    sourcePaths.add(source.path);
    const sourcePath = path.resolve(ROOT, source.path);
    if (!sourcePath.startsWith(`${ROOT}${path.sep}`)) {
      fail(`pinned source path escapes the repository: ${source.path}`);
    }
    const sourceStat = fs.lstatSync(sourcePath);
    if (!sourceStat.isFile()) {
      fail(`pinned source path is not a regular file: ${source.path}`);
    }
    const bytes = fs.readFileSync(sourcePath);
    const observedSha256 = sha256Hex(bytes);
    if (observedSha256 !== source.sha256) {
      fail(`${source.path} digest is ${observedSha256}, expected ${source.sha256}`);
    }
    return {
      path: source.path,
      sha256: source.sha256,
      byte_length: bytes.length,
      disposition: 'INCLUDE_PINNED_PRODUCT_SOURCE',
    };
  });
}

function exactDealsFields() {
  const keys = COLUMNS.map((column) => column.key);
  if (canonicalJson(keys) !== canonicalJson(EXPECTED_DEALS_FIELD_KEYS)) {
    fail(`Deals-table fields changed: ${canonicalJson(keys)}`);
  }
  return COLUMNS.map((column, sourceOrder) => ({
    source_order: sourceOrder,
    field_key: column.key,
    label: column.label,
    current_filterable: column.filterable === true,
    current_filter_type: column.filterType || null,
    current_sortable: column.sortable === true,
    current_default_visible: column.defaultVisible === true,
    disposition: 'INCLUDE_CURRENT_DEALS_TABLE_FIELD',
    required_process_filter_disposition: 'INCLUDE_IN_RELEASE_ADMITTED_MORE_FILTERS_UNION',
  }));
}

function registrySource(registryEntries, requestedKey) {
  const entry = entryForKey(requestedKey);
  if (!entry) fail(`query field ${requestedKey} has no registry entry`);
  const index = registryEntries.indexOf(entry);
  if (index < 0) fail(`query field ${requestedKey} resolved outside the pinned registry`);
  return {
    source_kind: 'SERVING_REGISTRY_ENTRY',
    source_request_key: requestedKey,
    source_registry_index: index,
  };
}

function exactProvisionSurface(provisionType, registryEntries) {
  const surface = [...fieldsForProvisionType(provisionType)].sort((left, right) => (
    compareCanonicalText(left.label, right.label)
    || compareCanonicalText(left.key, right.key)
  ));
  const surfaceByKey = new Map(surface.map((field) => [field.key, field]));
  if (surfaceByKey.size !== surface.length) {
    fail(`${provisionType} exposes a duplicate final field key`);
  }

  const rawDefinitions = [
    ...featureDefsForWpType(provisionType),
    ...Object.entries(DERIVED_FIELDS)
      .filter(([, definition]) => definition.provisionType === provisionType)
      .map(([key]) => ({ key, derived: true })),
  ];
  const scope = PRESENTATION_SCOPE[provisionType];
  const scopedDefinitions = scope
    ? rawDefinitions.filter((definition) => (
      definition && definition.key && scope.test(definition.key)
    ))
    : rawDefinitions;
  const seen = new Set();
  const occurrences = [];

  for (const raw of scopedDefinitions) {
    if (!raw || !raw.key) continue;
    let definition;
    try {
      definition = fieldDef(provisionType, raw.key);
    } catch {
      continue;
    }
    if (!definition || !definition.type || seen.has(definition.key)) continue;
    seen.add(definition.key);
    const field = surfaceByKey.get(definition.key);
    if (!field) {
      fail(`${provisionType}/${definition.key} is missing from the query surface`);
    }
    const source = raw.derived === true
      ? {
        source_kind: 'DERIVED_QUERY_FIELD',
        source_request_key: raw.key,
        source_path: 'lib/query/derived-fields.js',
      }
      : registrySource(registryEntries, raw.key);
    occurrences.push({
      provision_type: provisionType,
      field_key: field.key,
      ...source,
    });
  }

  const occurrenceKeys = occurrences
    .map((occurrence) => occurrence.field_key)
    .sort(compareCanonicalText);
  const surfaceKeys = [...surfaceByKey.keys()].sort(compareCanonicalText);
  if (canonicalJson(occurrenceKeys) !== canonicalJson(surfaceKeys)) {
    fail(`${provisionType} source enumeration does not reproduce its query surface`);
  }

  const duplicateLabels = new Set();
  const labels = new Set();
  for (const field of surface) {
    const label = field.label.toLowerCase();
    if (labels.has(label)) duplicateLabels.add(label);
    labels.add(label);
  }
  if (duplicateLabels.size > 0) {
    fail(`${provisionType} exposes duplicate labels: ${[...duplicateLabels].join(', ')}`);
  }

  return { surface, occurrences };
}

function agreementInventory(registryEntries) {
  const fieldsByKey = new Map();
  const provisionTypes = [];
  const allOccurrences = [];

  for (const provisionType of PROVISION_CARD_TYPES) {
    const { surface, occurrences } = exactProvisionSurface(provisionType, registryEntries);
    allOccurrences.push(...occurrences);
    const disposition = surface.length === 0
      ? 'EXCLUDE_NO_USER_FACING_FIELDS_FROM_CURRENT_QUERY_SURFACE'
      : 'INCLUDE_CURRENT_AGREEMENT_PROVISION_TYPE';
    provisionTypes.push({
      provision_type: provisionType,
      current_user_facing_field_count: surface.length,
      disposition,
      disposition_reason: provisionType === 'SEC_FILING_MEETING'
        ? 'The pinned PM query surface returns zero user-facing fields for this type.'
        : 'The pinned PM query surface returns one or more user-facing fields for this type.',
    });

    for (const field of surface) {
      const occurrence = occurrences.find((candidate) => candidate.field_key === field.key);
      if (!occurrence) fail(`${provisionType}/${field.key} lacks a source occurrence`);
      const prior = fieldsByKey.get(field.key);
      const stableShape = {
        label: field.label,
        value_type: field.type,
        unit: field.unit,
        coded: field.coded,
        boolean: field.boolean,
        numeric: field.numeric,
      };
      if (prior && canonicalJson(prior.stable_shape) !== canonicalJson(stableShape)) {
        fail(`${field.key} changes label or type across provision types`);
      }
      const record = prior || {
        field_key: field.key,
        stable_shape: stableShape,
        provision_types: [],
        source_occurrences: [],
      };
      record.provision_types.push(provisionType);
      record.source_occurrences.push({
        provision_type: provisionType,
        source_kind: occurrence.source_kind,
        source_request_key: occurrence.source_request_key,
        ...(occurrence.source_registry_index === undefined
          ? { source_path: occurrence.source_path }
          : { source_registry_index: occurrence.source_registry_index }),
      });
      fieldsByKey.set(field.key, record);
    }
  }

  const fields = [...fieldsByKey.values()]
    .sort((left, right) => compareCanonicalText(left.field_key, right.field_key))
    .map((field) => ({
      field_key: field.field_key,
      ...field.stable_shape,
      provision_types: field.provision_types,
      source_occurrences: field.source_occurrences,
      disposition: 'INCLUDE_CURRENT_AGREEMENT_QUERY_FIELD',
      future_result_type_disposition: 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES',
      certified_data_disposition: 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES',
    }));

  if (fields.length !== 334) fail(`Agreement field count is ${fields.length}, expected 334`);
  if (allOccurrences.length !== 492) {
    fail(`Agreement field occurrence count is ${allOccurrences.length}, expected 492`);
  }
  const sec = provisionTypes.find((entry) => entry.provision_type === 'SEC_FILING_MEETING');
  if (!sec || sec.current_user_facing_field_count !== 0
    || sec.disposition !== 'EXCLUDE_NO_USER_FACING_FIELDS_FROM_CURRENT_QUERY_SURFACE') {
    fail('SEC_FILING_MEETING lacks its required express exclusion');
  }

  return {
    provision_types: provisionTypes,
    fields,
    field_occurrence_count: allOccurrences.length,
  };
}

function registryInventory(registry, agreementFields) {
  const entries = registry.entries;
  const activeIndexes = new Set(
    agreementFields.flatMap((field) => field.source_occurrences)
      .filter((source) => source.source_kind === 'SERVING_REGISTRY_ENTRY')
      .map((source) => source.source_registry_index),
  );
  const aliasClaimants = new Map();

  entries.forEach((entry, index) => {
    for (const alias of new Set([entry.key, ...(entry.aliases || [])])) {
      if (!aliasClaimants.has(alias)) aliasClaimants.set(alias, []);
      aliasClaimants.get(alias).push(index);
    }
  });

  const collisions = [...aliasClaimants.entries()]
    .filter(([, claimants]) => claimants.length > 1)
    .map(([alias, claimantIndexes]) => {
      const winner = entryForKey(alias);
      const winnerIndex = entries.indexOf(winner);
      if (winnerIndex < 0 || !claimantIndexes.includes(winnerIndex)) {
        fail(`alias ${alias} does not resolve to one of its claimants`);
      }
      return {
        alias,
        claimant_registry_indexes: claimantIndexes,
        resolved_registry_index: winnerIndex,
        resolved_registry_key: winner.key,
        current_resolution_rule: 'FIRST_REGISTRY_CLAIMANT_WINS',
        disposition: 'RECORDED_NONCANONICAL_ALIAS_COLLISION',
        successor_requirement: 'EXPLICIT_REVIEWED_ALIAS_MAPPING_REQUIRED',
      };
    })
    .sort((left, right) => compareCanonicalText(left.alias, right.alias));

  const inputs = entries.map((entry, index) => {
    const aliases = [...new Set([entry.key, ...(entry.aliases || [])])];
    const resolvedAliases = aliases.filter((alias) => entryForKey(alias) === entry);
    const shadowedAliases = aliases.filter((alias) => entryForKey(alias) !== entry);
    const included = activeIndexes.has(index);
    return {
      input_id: `SERVING_REGISTRY_ENTRY:${index}`,
      registry_index: index,
      key: entry.key,
      display_name: entry.displayName || null,
      value_type: entry.type || null,
      aliases,
      runtime_resolved_aliases: resolvedAliases,
      runtime_shadowed_aliases: shadowedAliases,
      source_of_truth: entry.sourceOfTruth || null,
      applies_to: entry.provenance?.appliesTo || null,
      provision_codes: entry.provenance?.provisionCodes || [],
      disposition: included
        ? 'INCLUDE_AS_CURRENT_AGREEMENT_QUERY_FIELD_SOURCE'
        : 'EXCLUDE_NOT_USED_BY_CURRENT_AGREEMENT_QUERY_SURFACE',
      disposition_reason: included
        ? 'At least one current user-facing Agreement field resolves from this exact registry row.'
        : 'No current user-facing Agreement field resolves from this exact registry row.',
    };
  });

  if (inputs.some((input) => !input.disposition)) {
    fail('one or more serving-registry inputs lack a disposition');
  }
  if (collisions.length !== 156) {
    fail(`registry alias collision count is ${collisions.length}, expected 156`);
  }

  return {
    declared_entry_count: registry.parsed?._meta?.entry_count ?? null,
    observed_entry_count: entries.length,
    declared_count_matches_observed: registry.parsed?._meta?.entry_count === entries.length,
    included_input_count: inputs.filter((input) => (
      input.disposition === 'INCLUDE_AS_CURRENT_AGREEMENT_QUERY_FIELD_SOURCE'
    )).length,
    excluded_input_count: inputs.filter((input) => (
      input.disposition === 'EXCLUDE_NOT_USED_BY_CURRENT_AGREEMENT_QUERY_SURFACE'
    )).length,
    alias_collision_count: collisions.length,
    alias_collisions: collisions,
    inputs,
  };
}

function buildInventory() {
  const sourceFiles = exactSourceFiles();
  const dealsFields = exactDealsFields();
  const registry = readRegistry();
  const agreement = agreementInventory(registry.entries);
  const servingRegistry = registryInventory(registry, agreement.fields);

  if (servingRegistry.observed_entry_count !== 699) {
    fail(`serving registry contains ${servingRegistry.observed_entry_count} entries, expected 699`);
  }
  if (servingRegistry.included_input_count !== 328
    || servingRegistry.excluded_input_count !== 371) {
    fail('serving-registry inclusion and exclusion counts changed');
  }

  const payload = {
    schema_version: 'ProcessIntelligenceProductFieldSourceInventory/V1',
    authority: 'OBSERVATIONAL_BASELINE_ONLY',
    canonical_authority_granted: false,
    source_baseline_commit: SOURCE_BASELINE_COMMIT,
    source_files: sourceFiles,
    deals_table: {
      field_count: dealsFields.length,
      fields: dealsFields,
    },
    agreement_query_surface: {
      provision_type_count: agreement.provision_types.length,
      provision_types: agreement.provision_types,
      distinct_user_facing_field_count: agreement.fields.length,
      field_occurrence_count: agreement.field_occurrence_count,
      fields: agreement.fields,
    },
    serving_registry: servingRegistry,
    source_limits: {
      future_result_type_support: 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES',
      certified_data_presence: 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES',
      semantic_alias_equivalence: 'NOT_PROVABLE_FROM_REGISTRY_ORDER',
    },
    successor_requirements: [
      'REPLACE_FIRST_CLAIMANT_ALIAS_RESOLUTION_WITH_EXPLICIT_REVIEWED_MAPPING',
      'REJECT_DUPLICATE_ACTIVE_MEANINGS',
      'RECORD_SUPPORTED_RESULT_TYPE_FOR_EACH_ADMITTED_FIELD',
      'RECORD_CERTIFIED_DATA_STATUS_FOR_EACH_ADMITTED_FIELD',
      'RECORD_ONE_INCLUSION_OR_EXCLUSION_DISPOSITION_FOR_EACH_SOURCE_INPUT',
    ],
  };
  const canonicalPayload = canonicalJson(payload);
  return {
    ...payload,
    content_identity: {
      scheme: 'CANONICAL_CONTENT_ID/V1',
      domain: CONTENT_ID_DOMAIN,
      content_id: contentId(CONTENT_ID_DOMAIN, payload),
      canonical_payload_sha256: sha256Hex(canonicalPayload),
    },
  };
}

function outputBytes(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function main() {
  const inventory = buildInventory();
  const output = outputBytes(inventory);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, 'utf8') !== output) {
      fail('committed product field source inventory is not reproducible');
    }
  } else {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, output);
  }
  process.stdout.write(`${JSON.stringify({
    result: 'PASS',
    output_path: path.relative(ROOT, OUTPUT_PATH),
    content_id: inventory.content_identity.content_id,
    deals_table_fields: inventory.deals_table.field_count,
    agreement_fields: inventory.agreement_query_surface.distinct_user_facing_field_count,
    agreement_occurrences: inventory.agreement_query_surface.field_occurrence_count,
    registry_entries: inventory.serving_registry.observed_entry_count,
    registry_alias_collisions: inventory.serving_registry.alias_collision_count,
  })}\n`);
}

main();
