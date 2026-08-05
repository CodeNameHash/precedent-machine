const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/process-intelligence-baseline.mjs');
const INVENTORY_PATH = path.join(
  ROOT,
  'evidence/process-intelligence/baseline/product-field-source-inventory.json',
);
const CONTENT_ID_DOMAIN = 'PROCESS_INTELLIGENCE_PRODUCT_FIELD_SOURCE_INVENTORY/V1';
const SOURCE_FILES = [
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
];
const DEALS_FIELD_KEYS = [
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
];

function inventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

test('reproduces the committed product field source inventory', () => {
  const output = execFileSync(process.execPath, [SCRIPT, '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /"result":"PASS"/);
});

test('uses the script repository as its source root and makes check mode write-free', () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'process-intelligence-baseline-'));
  const unrelatedWorkingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'process-intelligence-cwd-'));
  const fixtureScript = path.join(fixtureRoot, 'scripts/process-intelligence-baseline.mjs');
  const fixtureOutput = path.join(
    fixtureRoot,
    'evidence/process-intelligence/baseline/product-field-source-inventory.json',
  );

  try {
    fs.mkdirSync(path.dirname(fixtureScript), { recursive: true });
    fs.copyFileSync(SCRIPT, fixtureScript);
    fs.symlinkSync(path.join(ROOT, 'lib'), path.join(fixtureRoot, 'lib'), 'dir');

    assert.throws(() => execFileSync(process.execPath, [fixtureScript, '--check'], {
      cwd: unrelatedWorkingDirectory,
      encoding: 'utf8',
      stdio: 'pipe',
    }));
    assert.equal(fs.existsSync(fixtureOutput), false);

    const first = execFileSync(process.execPath, [fixtureScript], {
      cwd: unrelatedWorkingDirectory,
      encoding: 'utf8',
    });
    const firstBytes = fs.readFileSync(fixtureOutput);
    const second = execFileSync(process.execPath, [fixtureScript], {
      cwd: unrelatedWorkingDirectory,
      encoding: 'utf8',
    });
    const secondBytes = fs.readFileSync(fixtureOutput);

    assert.match(first, /"result":"PASS"/);
    assert.match(second, /"result":"PASS"/);
    assert.deepEqual(secondBytes, firstBytes);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(unrelatedWorkingDirectory, { recursive: true, force: true });
  }
});

test('binds the observational baseline to exact source bytes and a content identity', () => {
  const value = inventory();
  const identity = value.content_identity;
  delete value.content_identity;

  assert.equal(value.authority, 'OBSERVATIONAL_BASELINE_ONLY');
  assert.equal(value.canonical_authority_granted, false);
  assert.equal(
    value.source_baseline_commit,
    'c5737a59b01654d81380ff48771576d1f00e289f',
  );
  assert.equal(identity.domain, CONTENT_ID_DOMAIN);
  assert.equal(identity.content_id, contentId(CONTENT_ID_DOMAIN, value));
  assert.equal(identity.canonical_payload_sha256, sha256Hex(canonicalJson(value)));
  assert.deepEqual(
    value.source_files.map(({ path: sourcePath, sha256 }) => ({ path: sourcePath, sha256 })),
    SOURCE_FILES,
  );
  assert.doesNotMatch(fs.readFileSync(SCRIPT, 'utf8'), /\.toLocale(?:LowerCase|UpperCase)\s*\(/);
  assert.doesNotMatch(fs.readFileSync(SCRIPT, 'utf8'), /\.localeCompare\s*\(/);
});

test('records all 15 current Deals-table fields and their future filter requirement', () => {
  const fields = inventory().deals_table.fields;
  assert.equal(fields.length, 15);
  assert.deepEqual(fields.map((field) => field.field_key), DEALS_FIELD_KEYS);
  assert.ok(fields.every((field) => (
    field.disposition === 'INCLUDE_CURRENT_DEALS_TABLE_FIELD'
    && field.required_process_filter_disposition
      === 'INCLUDE_IN_RELEASE_ADMITTED_MORE_FILTERS_UNION'
  )));
  assert.deepEqual(
    fields.filter((field) => !field.current_filterable).map((field) => field.field_key),
    ['deal', 'lawyers_buyer', 'lawyers_target'],
  );
});

test('records the exact 334-field Agreement surface without silent loss', () => {
  const agreement = inventory().agreement_query_surface;
  assert.equal(agreement.provision_type_count, 17);
  assert.equal(agreement.distinct_user_facing_field_count, 334);
  assert.equal(agreement.field_occurrence_count, 492);
  assert.equal(new Set(agreement.fields.map((field) => field.field_key)).size, 334);
  assert.ok(agreement.fields.every((field) => (
    field.disposition === 'INCLUDE_CURRENT_AGREEMENT_QUERY_FIELD'
    && field.source_occurrences.length > 0
    && field.future_result_type_disposition
      === 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES'
    && field.certified_data_disposition
      === 'NOT_PROVABLE_FROM_PINNED_PRODUCT_SOURCES'
  )));
  assert.equal(
    agreement.fields.reduce((total, field) => total + field.source_occurrences.length, 0),
    492,
  );
});

test('gives SEC_FILING_MEETING an express exclusion', () => {
  const sec = inventory().agreement_query_surface.provision_types.find(
    (entry) => entry.provision_type === 'SEC_FILING_MEETING',
  );
  assert.deepEqual(sec, {
    provision_type: 'SEC_FILING_MEETING',
    current_user_facing_field_count: 0,
    disposition: 'EXCLUDE_NO_USER_FACING_FIELDS_FROM_CURRENT_QUERY_SURFACE',
    disposition_reason:
      'The pinned PM query surface returns zero user-facing fields for this type.',
  });
});

test('dispositions every registry input and records the source count defect', () => {
  const registry = inventory().serving_registry;
  assert.equal(registry.declared_entry_count, 698);
  assert.equal(registry.observed_entry_count, 699);
  assert.equal(registry.declared_count_matches_observed, false);
  assert.equal(registry.included_input_count, 328);
  assert.equal(registry.excluded_input_count, 371);
  assert.equal(registry.inputs.length, 699);
  assert.ok(registry.inputs.every((input) => (
    input.input_id === `SERVING_REGISTRY_ENTRY:${input.registry_index}`
    && typeof input.disposition === 'string'
    && input.disposition.length > 0
  )));
});

test('records every alias collision with one current winner and no silent claimant loss', () => {
  const registry = inventory().serving_registry;
  assert.equal(registry.alias_collision_count, 156);
  assert.equal(registry.alias_collisions.length, 156);
  for (const collision of registry.alias_collisions) {
    assert.ok(collision.claimant_registry_indexes.length > 1);
    assert.ok(collision.claimant_registry_indexes.includes(collision.resolved_registry_index));
    assert.equal(collision.current_resolution_rule, 'FIRST_REGISTRY_CLAIMANT_WINS');
    assert.equal(collision.disposition, 'RECORDED_NONCANONICAL_ALIAS_COLLISION');
    assert.equal(
      collision.successor_requirement,
      'EXPLICIT_REVIEWED_ALIAS_MAPPING_REQUIRED',
    );
  }
});

test('preserves distinct antitrust and general reverse-fee amount paths', () => {
  const fields = inventory().agreement_query_surface.fields;
  const antitrust = fields.find((field) => field.field_key === 'amount');
  const general = fields.find((field) => field.field_key === 'reverseFeeAmount');
  const antitrustSource = antitrust.source_occurrences.find(
    (source) => source.provision_type === 'TERMINATION_FEE',
  );
  const generalSource = general.source_occurrences.find(
    (source) => source.provision_type === 'TERMINATION_FEE',
  );

  assert.deepEqual(
    {
      request: antitrustSource.source_request_key,
      registry_index: antitrustSource.source_registry_index,
    },
    { request: 'reverseFeeAmount', registry_index: 24 },
  );
  assert.deepEqual(
    {
      request: generalSource.source_request_key,
      registry_index: generalSource.source_registry_index,
    },
    { request: 'reverseTerminationFee', registry_index: 525 },
  );
});

test('keeps query-time derived fields separate from registry authority', () => {
  const fields = inventory().agreement_query_surface.fields;
  const derived = fields.filter((field) => (
    field.source_occurrences.some((source) => source.source_kind === 'DERIVED_QUERY_FIELD')
  ));
  assert.deepEqual(
    derived.map((field) => field.field_key),
    ['feePctOfDealValue', 'reverseFeePctOfDealValue'],
  );
  assert.ok(derived.every((field) => field.source_occurrences.every((source) => (
    source.source_kind === 'DERIVED_QUERY_FIELD'
    && source.source_path === 'lib/query/derived-fields.js'
    && !Object.hasOwn(source, 'source_registry_index')
  ))));
});
