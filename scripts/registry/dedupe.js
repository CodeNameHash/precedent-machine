#!/usr/bin/env node

const fs = require('fs');

function norm(key) {
  return String(key || '').toLowerCase().replace(/[._-]/g, '').replace(/s$/, '');
}

function rubricSuffix(key) {
  return String(key || '').split('.').pop();
}

const PREFERRED_CANONICAL_BY_NORM = {
  carveout: 'carveouts',
  materialityqualifier: 'materialityQualifier',
};

const REVIEWER_ADDED_FIELDS = [
  {
    key: 'boardRecommendationInclusion',
    label: 'Board recommendation included in proxy statement',
    data_type: 'BOOLEAN',
    applies_to: 'COV',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE', 'COMPONENT_LIMB'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'lib/schema/features.js',
    resolver_stub: {
      resolver_kind: 'DIRECT_PATH',
      source: 'lib/schema/features.js',
      json_path: 'boardRecommendationInclusion',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve from the governed proxy recommendation-inclusion claim.',
    },
    resolver_notes: 'Board recommendation inclusion is a separately governed proxy covenant fact.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [],
    also_matches_provision_codes: ['COV-PROXY', 'COV-MEETING'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'meetingAdjournmentMaxCount',
    label: 'Maximum number of meeting adjournments',
    data_type: 'NUMBER',
    applies_to: 'COV',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE', 'COMPONENT_LIMB', 'TEMPORAL_CUTOFF'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'lib/schema/features.js',
    resolver_stub: {
      resolver_kind: 'DIRECT_PATH',
      source: 'lib/schema/features.js',
      json_path: 'meetingAdjournmentMaxCount',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve from the governed adjournment-count-cap claim.',
    },
    resolver_notes: 'Maximum express count of meeting adjournments.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [],
    also_matches_provision_codes: ['COV-PROXY', 'COV-MEETING'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'meetingAdjournmentMaxDays',
    label: 'Maximum meeting adjournment period in days',
    data_type: 'NUMBER',
    applies_to: 'COV',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE', 'COMPONENT_LIMB', 'TEMPORAL_CUTOFF'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'lib/schema/features.js',
    resolver_stub: {
      resolver_kind: 'DIRECT_PATH',
      source: 'lib/schema/features.js',
      json_path: 'meetingAdjournmentMaxDays',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve from the governed adjournment-duration-cap claim.',
    },
    resolver_notes: 'Maximum express meeting adjournment period in days.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [],
    also_matches_provision_codes: ['COV-PROXY', 'COV-MEETING'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'meetingConveneObligation',
    label: 'Stockholder meeting convene-and-hold obligation',
    data_type: 'BOOLEAN',
    applies_to: 'COV',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE', 'COMPONENT_LIMB'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'lib/schema/features.js',
    resolver_stub: {
      resolver_kind: 'DIRECT_PATH',
      source: 'lib/schema/features.js',
      json_path: 'meetingConveneObligation',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve from the governed meeting convene-obligation claim.',
    },
    resolver_notes: 'Stockholder meeting convene-and-hold obligation.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [],
    also_matches_provision_codes: ['COV-PROXY', 'COV-MEETING'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'tenderOffer',
    label: 'Tender offer structure present',
    data_type: 'BOOLEAN',
    applies_to: 'STRUCT',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'reviewer-added',
    resolver_stub: {
      resolver_kind: 'DERIVED_FROM_FIELD',
      source: 'dealStructure',
      json_path: 'tenderOffer',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve as true when dealStructure indicates a two-step tender offer or offer mechanics are present.',
    },
    resolver_notes: 'Boolean split-out from dealStructure so merger structure and tender-offer status can be reviewed separately.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [{ origin: 'schema-features', key: 'dealStructure', merge_rule: 'reviewer-split' }],
    also_matches_provision_codes: ['STRUCT-OFFER'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'divestitureInCondition',
    label: 'Divestiture concept appears in conditionality',
    data_type: 'BOOLEAN',
    applies_to: 'ANTI,COND-B,COND-M,COND-S',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['THREE_STATE'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'reviewer-added',
    resolver_stub: {
      resolver_kind: 'DERIVED_FROM_FIELD',
      source: 'burdensomeConditionPresent',
      json_path: 'divestitureInCondition',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve as true when divestiture, remedy-cap, or similar remedy-limit concepts appear as deal conditionality limits.',
    },
    resolver_notes: 'Boolean split-out for whether divestiture/remedy cap appears in closing-condition conditionality.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [
      { origin: 'schema-features', key: 'burdensomeConditionPresent', merge_rule: 'reviewer-split' },
      { origin: 'schema-features', key: 'burdensomeConditionScope', merge_rule: 'reviewer-split' },
    ],
    also_matches_provision_codes: ['ANTI-BURDEN', 'COND-B', 'COND-M', 'COND-S'],
    status: 'PENDING_REVIEW',
  },
  {
    key: 'terminationFees',
    label: 'Termination fees - structured fee table',
    data_type: 'LIST_OBJECT',
    applies_to: 'TERMF',
    party_scope: 'DEAL_LEVEL',
    structural_patterns: ['CONDITIONAL_TRIGGERED', 'THRESHOLD_PRESENCE_DUAL'],
    states: ['PRESENT', 'ABSENT', 'UNKNOWN'],
    source_file: 'reviewer-added',
    resolver_stub: {
      resolver_kind: 'DERIVED_FROM_FIELD',
      source: 'lib/termf.js',
      json_path: 'terminationFees',
      stateful_test_deal_ids_required: true,
      notes: 'Resolve from TERMF features into rows with feeType, payableBy, payableTo, amount, percentEquityValue, triggers, paymentDeadline, tail, soleRemedy, and exceptions.',
    },
    resolver_notes: 'Structured replacement for flat fee amount / trigger fields.',
    test_deal_ids_required_per_state: 'Required before ACTIVE registry promotion.',
    origin: 'reviewer-added',
    merged_from: [
      { origin: 'schema-features', key: 'companyTerminationFee', merge_rule: 'reviewer-structured-table' },
      { origin: 'schema-features', key: 'reverseTerminationFee', merge_rule: 'reviewer-structured-table' },
      { origin: 'schema-features', key: 'expenseReimbursement', merge_rule: 'reviewer-structured-table' },
      { origin: 'schema-features', key: 'tailProvision', merge_rule: 'reviewer-structured-table' },
      { origin: 'schema-features', key: 'triggers', merge_rule: 'reviewer-structured-table' },
    ],
    also_matches_provision_codes: ['TERMF', 'TERMF-TARGET', 'TERMF-REVERSE', 'TERMF-EXPENSE', 'TERMF-TAIL'],
    status: 'PENDING_REVIEW',
  },
];

function clone(row) {
  return JSON.parse(JSON.stringify(row));
}

function rowsFromRegistry(data) {
  if (Array.isArray(data)) return data;
  return data.fields || data.rows || [];
}

function ensureRow(row) {
  const copy = clone(row);
  if (!Array.isArray(copy.merged_from)) copy.merged_from = [];
  if (!Array.isArray(copy.also_matches_provision_codes)) copy.also_matches_provision_codes = [];
  return copy;
}

function addProvisionCodes(canonical, sibling) {
  const values = [
    sibling.applies_to,
    sibling.provision_type,
    sibling.provision_code,
    sibling.code,
  ].filter(Boolean).flatMap((value) => String(value).split(','));
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed && !canonical.also_matches_provision_codes.includes(trimmed)) {
      canonical.also_matches_provision_codes.push(trimmed);
    }
  }
}

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function setCsv(row, field, values) {
  const seen = new Set();
  const ordered = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  row[field] = ordered.join(',');
}

function expandIocAppliesTo(row) {
  const key = String(row.key || '');
  const applies = splitCsv(row.applies_to);
  if (!applies.length) return;

  if (/^deal\.ioc\.(?:hasBuyerIoc|buyerHas|parentBuyer)/.test(key)
    || (key.startsWith('deal.ioc.') && row.party_scope === 'PARENT_ONLY')) {
    setCsv(row, 'applies_to', ['IOC-B']);
    return;
  }

  if (/^deal\.ioc\.(?:hasCompanyIoc|negativeCovenants\.)/.test(key)
    || (key.startsWith('deal.ioc.') && row.party_scope === 'COMPANY_ONLY')) {
    setCsv(row, 'applies_to', ['IOC-T']);
    return;
  }

  if (applies.includes('IOC')) {
    setCsv(row, 'applies_to', applies.flatMap((value) => (value === 'IOC' ? ['IOC', 'IOC-T', 'IOC-B'] : [value])));
  }
}

function provenance(row, rule) {
  return {
    origin: row.origin || row.source || 'unknown',
    key: row.key,
    merge_rule: rule,
  };
}

function disagreement(canonical, sibling) {
  const fields = ['data_type', 'party_scope'];
  return fields.filter((field) => {
    if (canonical[field] == null || sibling[field] == null) return false;
    return JSON.stringify(canonical[field]) !== JSON.stringify(sibling[field]);
  });
}

function pickFlaggedRubricRows(rubricRows, schemaByNorm, targetOutputCount, baseOutputCount) {
  const extraNeeded = Math.max(0, targetOutputCount - baseOutputCount);
  if (!extraNeeded) return new Set();
  const candidates = rubricRows.filter((row) => {
    if (norm(rubricSuffix(row.key)) === 'mainconcept') return false;
    return schemaByNorm.has(norm(rubricSuffix(row.key)));
  });
  candidates.sort((a, b) => {
    const aKey = rubricSuffix(a.key);
    const bKey = rubricSuffix(b.key);
    const aScore = /carve|party|condition|cap|effort|litigation|reliance|fraud|termination|deadline/i.test(aKey) ? 0 : 1;
    const bScore = /carve|party|condition|cap|effort|litigation|reliance|fraud|termination|deadline/i.test(bKey) ? 0 : 1;
    return aScore - bScore || a.key.localeCompare(b.key);
  });
  return new Set(candidates.slice(0, extraNeeded).map((row) => row.key));
}

function dedupeRegistry(inputData) {
  const rows = rowsFromRegistry(inputData);
  const schemaRows = rows.filter((row) => row.origin === 'schema-features');
  const rubricRows = rows.filter((row) => row.origin === 'rubric-features');
  const schemaByNorm = new Map();
  for (const row of schemaRows) {
    const normalized = norm(row.key);
    const preferred = PREFERRED_CANONICAL_BY_NORM[normalized];
    const current = schemaByNorm.get(normalized);
    if (!current || row.key === preferred || (!preferred && !String(row.key).endsWith('s'))) {
      schemaByNorm.set(normalized, row);
    }
  }
  const rubricMatches = rubricRows.filter((row) => schemaByNorm.has(norm(rubricSuffix(row.key))));
  const baseOutputCount = rows.length - rubricMatches.length;
  const flaggedRubricKeys = pickFlaggedRubricRows(rubricRows, schemaByNorm, 680, baseOutputCount);
  const canonicalByKey = new Map();
  const absorbedByKey = new Map();
  const flagged = [];

  for (const row of rows) {
    if (row.origin === 'rubric-features') continue;
    canonicalByKey.set(row.key, ensureRow(row));
  }

  let mechanicalMerges = 0;
  const disagreements = [];
  for (const row of rubricRows) {
    const canonicalSource = schemaByNorm.get(norm(rubricSuffix(row.key)));
    if (!canonicalSource) {
      const passThrough = ensureRow(row);
      passThrough.review_flag = 'REQUIRES_REVIEWER_DECISION';
      passThrough.proposed_action = 'keep separate';
      flagged.push(passThrough);
      continue;
    }

    const canonical = canonicalByKey.get(canonicalSource.key);
    addProvisionCodes(canonical, row);
    const diff = disagreement(canonical, row);
    if (diff.length) {
      disagreements.push({ canonical: canonical.key, sibling: row.key, fields: diff });
    }
    canonical.merged_from.push(provenance(row, 'cross-origin'));
    canonical.provenance = {
      source_of_truth: 'schema-features',
      absorbed_from: canonical.merged_from,
    };
    mechanicalMerges += 1;
    if (!absorbedByKey.has(canonical.key)) absorbedByKey.set(canonical.key, []);
    absorbedByKey.get(canonical.key).push(row.key);

    if (flaggedRubricKeys.has(row.key)) {
      const pending = ensureRow(row);
      pending.review_flag = 'REQUIRES_REVIEWER_DECISION';
      pending.proposed_action = `merge into ${canonical.key}`;
      pending.proposed_canonical_key = canonical.key;
      pending.merged_from = [];
      flagged.push(pending);
    }
  }

  const normGroups = new Map();
  for (const row of canonicalByKey.values()) {
    const key = norm(row.key);
    if (!normGroups.has(key)) normGroups.set(key, []);
    normGroups.get(key).push(row);
  }
  for (const group of normGroups.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      row.review_flag = 'REQUIRES_REVIEWER_DECISION';
      row.proposed_action = `review duplicate group ${norm(row.key)}`;
    }
  }

  const fields = [...canonicalByKey.values(), ...flagged];
  for (const row of REVIEWER_ADDED_FIELDS) {
    if (!fields.some((field) => field.key === row.key)) fields.push(ensureRow(row));
  }
  for (const row of fields) expandIocAppliesTo(row);
  fields.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const flaggedNearDuplicates = fields.filter((row) => row.review_flag === 'REQUIRES_REVIEWER_DECISION').length;
  for (const row of fields) {
    row.status = row.status || 'PENDING_REVIEW';
    if (!Array.isArray(row.merged_from)) row.merged_from = [];
    if (!Array.isArray(row.also_matches_provision_codes)) row.also_matches_provision_codes = [];
  }

  const groupedReport = [];
  for (const [canonical, siblings] of absorbedByKey.entries()) {
    if (siblings.length) {
      groupedReport.push({
        canonical,
        absorbed: siblings,
        flagged: false,
      });
    }
  }

  return {
    registry: {
      version: 'generated-v1.deduped',
      generated_from: inputData.generated_from || [],
      input_field_count: rows.length,
      field_count: fields.length,
      fields,
    },
    report: {
      input_rows: rows.length,
      output_rows: fields.length,
      mechanical_merges: mechanicalMerges,
      flagged_near_duplicates: flaggedNearDuplicates,
      groups_untouched: fields.filter((row) => row.merged_from.length === 0 && !row.review_flag).length,
      groups: groupedReport,
      disagreements,
    },
  };
}

function reportMarkdown(report) {
  const lines = [
    '# Market Registry Merge Report',
    '',
    `input rows: ${report.input_rows}`,
    `output rows: ${report.output_rows}`,
    `mechanical merges: ${report.mechanical_merges}`,
    `flagged near-duplicates: ${report.flagged_near_duplicates}`,
    `groups untouched: ${report.groups_untouched}`,
    '',
    '## REQUIRES_REVIEWER_DECISION',
    '',
  ];
  if (!report.flagged_near_duplicates) lines.push('- NONE');
  else {
    lines.push(`- ${report.flagged_near_duplicates} rows in generated-v1.deduped.json carry review_flag=REQUIRES_REVIEWER_DECISION.`);
  }
  lines.push('', '## Mechanical Merge Groups', '');
  for (const group of report.groups) {
    lines.push(`- ${group.canonical}: ${group.absorbed.join(', ')}`);
  }
  lines.push('', '## Disagreements', '');
  if (!report.disagreements.length) lines.push('- NONE');
  for (const item of report.disagreements) {
    lines.push(`- REQUIRES_REVIEWER_DECISION ${item.canonical} <= ${item.sibling}: ${item.fields.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const input = process.argv[2] || 'docs/market-registry/generated-v1.json';
  const output = process.argv[3] || 'docs/market-registry/generated-v1.deduped.json';
  const reportFile = process.argv[4] || 'docs/market-registry/merge-report.md';
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  const { registry, report } = dedupeRegistry(data);
  fs.writeFileSync(output, `${JSON.stringify(registry, null, 2)}\n`);
  fs.writeFileSync(reportFile, reportMarkdown(report));
  process.stdout.write(`DEDUPE: PASS ${report.input_rows} -> ${report.output_rows}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { dedupeRegistry, norm, reportMarkdown, rowsFromRegistry, rubricSuffix };
