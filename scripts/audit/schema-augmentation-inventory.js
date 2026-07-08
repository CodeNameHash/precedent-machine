#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const OUT = 'docs/audit/m2-09-schema-augmentations.md';
const CONFIG_DIR = 'components/review/table-configs';

const FAMILIES = [
  {
    family: 'Conditions',
    components: ['CondSingleTable'],
    configs: ['conditions-m.config.js', 'conditions-b.config.js', 'conditions-s.config.js'],
    legacy: 'Condition term/detail rows and present/absent ordering.',
    required: [
      ['canonicalCode', 'canonical-condition-code pill on each row'],
      ['effortsStandard', 'efforts-standard pill on antitrust-clearance rows'],
      ['consentStandard', 'consent-standard pill on third-party-consent rows'],
      ['materialityScrapeBoolean', 'materiality-scrape yes/no badge on bring-down rows'],
    ],
  },
  {
    family: 'Material Contracts',
    components: ['RepMaterialContractsTable'],
    configs: ['material-contracts.config.js'],
    legacy: 'Bucket rows, thresholds, roman ordering, and coverage checklist.',
    required: [
      ['materialContractsBuckets', 'canonical bucket pills with also-covered synonyms'],
      ['materialContractsDollarThresholds', 'threshold cell with hover quote'],
      ['MATERIAL_CONTRACT_BUCKET_META.synonyms', 'top-of-table coverage percentage rollup'],
    ],
  },
  {
    family: 'IOC / General Covenants',
    components: ['IocGeneralExceptionsTableSingle', 'IocNegativeCovenantsTableSingle', 'IocAffirmativeCovenantsTableSingle', 'CovSummaryTable'],
    configs: ['ioc-exceptions.config.js', 'general-covenants.config.js'],
    legacy: 'Exception matrix plus affirmative/negative covenant summary rows.',
    required: [
      ['iocEffortsStandard', 'efforts-standard pill per covenant subrow'],
      ['iocConsentStandard', 'consent-standard pill per covenant subrow'],
      ['knowledgeQualifier', 'knowledge scope/type badge'],
      ['dayCountDeadline', 'day-count deadline column where present'],
    ],
  },
  {
    family: 'Tail Fee / Fees',
    components: ['CategoryFeatureSummaryTable'],
    configs: ['tail-fee.config.js', 'termination-fees.config.js'],
    legacy: 'Tail-fee and termination-fee rows with fee amount/detail text.',
    required: [
      ['tailDurationMonths', 'tail duration pill'],
      ['triggerRules', 'triggering-events pill list'],
      ['terminationFees', 'fee amount with hover quote'],
    ],
  },
  {
    family: 'NoSol',
    components: ['CategoryFeatureSummaryTable'],
    configs: ['nosol-noshop.config.js', 'nosol-superior.config.js', 'nosol-intervening.config.js', 'nosol-fiduciary.config.js'],
    legacy: 'Separate no-shop, superior-proposal, intervening-event, and fiduciary-out tables.',
    required: [
      ['matchingRightBusinessDays', 'matching-right days pill per subrow'],
      ['fiduciaryOutStandard', 'fiduciary-out standard pill'],
      ['interveningEventScope', 'grouped subrow under the NoSol stack'],
    ],
  },
  {
    family: 'Rep Materiality / Qualifiers',
    components: ['RepMaterialContractsTable', 'RepGeneralExceptionsTable', 'BringdownTable'],
    configs: ['representations-qualifiers.config.js'],
    legacy: 'Per-rep materiality, knowledge, schedule, and bring-down detail rows.',
    required: [
      ['materialityQualifier', 'materiality-tier pill'],
      ['knowledgeQualifier', 'knowledge-qualifier pill'],
      ['rw-general-lookback-scopes.js', 'scope pill from lookback vocabulary'],
      ['rw-sec-filings-portions-excluded.js', 'SEC filings carve-out scope pill'],
    ],
  },
  {
    family: 'MAE / Definitions',
    components: ['CategoryFeatureSummaryTable'],
    configs: ['mae-definitions.config.js'],
    legacy: 'Definition detail text and MAE carve-out wording.',
    required: [
      ['maeLimbType', 'ONE_LIMB vs TWO_LIMB pill'],
      ['carveouts', 'MAE carve-out category pill groups'],
      ['disproportionateImpactClause', 'disproportionate-impact clause pill'],
      ['preventDelayProng', 'prevent-delay prong pill'],
    ],
  },
  {
    family: 'Antitrust / Regulatory',
    components: ['AntitrustSummaryTable'],
    configs: ['antitrust-regulatory.config.js'],
    legacy: 'Regulatory efforts, caps, filings, litigation, and remedy rows.',
    required: [
      ['burdensomeConditionLimit', 'BURDEN_COMMITMENT / remedies-cap pill'],
      ['effortsStandard', 'efforts-standard pill'],
      ['hsrFilingDeadline', 'HSR filing deadline business-day pill'],
      ['tickingFee', 'ticking-fee pill'],
    ],
  },
  {
    family: 'Structure / Mechanics',
    components: ['StructTable'],
    configs: ['structure-mechanics.config.js', 'consideration-hero.config.js'],
    legacy: 'Transaction form, merger mechanics, closing/effective-time mechanics, and governance rows.',
    required: [
      ['dealStructure', 'transaction-form pill'],
      ['mergerForm', 'topology pill'],
      ['section251h', '251(h) badge'],
      ['backendMergerMechanic', 'back-end / top-up badge'],
      ['appraisalRightsAvailable', 'appraisal-rights badge'],
    ],
  },
  {
    family: 'Termination Rights',
    components: ['CategoryFeatureSummaryTable'],
    configs: ['termination-rights.config.js'],
    legacy: 'Termination trigger/right rows and outside-date detail text.',
    required: [
      ['outsideDate', 'outside-date pill'],
      ['recommendationChangeTermination', 'fiduciary-termination-right badge'],
      ['terminationTriggers', 'termination-trigger pill list'],
      ['breachStandard', 'breach-threshold pill'],
    ],
  },
  {
    family: 'SEC / Meeting',
    components: ['CondSingleTable'],
    configs: ['sec-meeting.config.js', 'approvals-votes.config.js'],
    legacy: 'Proxy/tender filing, meeting, vote, and adjournment detail rows.',
    required: [
      ['proxyFilingDeadline', 'proxy-filing-deadline pill'],
      ['voteThreshold', 'vote-mechanic pill'],
      ['adjournmentRights', 'adjournment-rights pill'],
    ],
  },
  {
    family: 'Approvals / Votes',
    components: ['CondSingleTable'],
    configs: ['approvals-votes.config.js'],
    legacy: 'Approval condition existence and meeting mechanics.',
    required: [
      ['voteThreshold', 'vote-standard pill'],
      ['quorumRequirement', 'quorum pill'],
      ['dualClassTreatment', 'dual-class treatment pill'],
      ['recordDate', 'record-date mechanic pill'],
    ],
  },
  {
    family: 'Employee Benefits',
    components: ['CompensationItemsTable'],
    configs: ['employee-benefits.config.js'],
    legacy: 'Compensation item rows and employment covenant detail text.',
    required: [
      ['compensationItems', 'structured compensation object rows'],
      ['comparisonGroup', 'comparison-group pill'],
      ['benefitStandard', 'benefit-standard pill'],
      ['bundling', 'aggregate/bundled-test badge'],
    ],
  },
  {
    family: 'No Other Reps / Fraud',
    components: ['CategoryFeatureSummaryTable'],
    configs: ['no-other-reps-fraud.config.js'],
    legacy: 'Abry four-question checklist and fraud silence/detail rows.',
    required: [
      ['noOtherRepsScope', 'scope pill'],
      ['nonRelianceScope', 'non-reliance scope pill'],
      ['fraudCarveout', 'fraud carve-out badge'],
    ],
  },
  {
    family: 'Advisers / Fees / Expenses',
    components: ['MiscSummaryTable'],
    configs: ['advisers-fees-expenses.config.js'],
    legacy: 'General fee/expense, adviser, governing-law, forum, and remedy rows.',
    required: [
      ['feeExpenseAllocation', 'fee/expense allocation pill'],
      ['feeExpenseExceptions', 'expense-exceptions pill list'],
      ['adviserFees', 'adviser-fee badge'],
    ],
  },
];

const EXTRA_SOURCE_FILES = [
  'lib/canonical-conditions.js',
  'lib/rep-materiality.js',
  'lib/category-summary-features.js',
  'lib/vocab/ioc-components.js',
  'lib/vocab/ioc-categories.js',
  'lib/vocab/ioc-other-exclusions.js',
  'lib/vocab/rw-general-lookback-scopes.js',
  'lib/vocab/rw-sec-filings-portions-excluded.js',
  'docs/vocab/FROZEN-party_role-v1.json',
  'docs/vocab/FROZEN-triggerCode-v1.json',
];

function readIfExists(repoRoot, file) {
  const full = path.join(repoRoot, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function extractConfigKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/features\.([A-Za-z][A-Za-z0-9_]*)/g)) keys.add(match[1]);
  const keyArrayPatterns = [
    /keys:\s*\[([^\]]*)\]/g,
    /\[\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*,\s*(?:['"][^'"]+['"]\s*,\s*)?\[([^\]]*)\]\s*\]/g,
    /\[((?:\s*['"][A-Za-z][A-Za-z0-9_]+['"]\s*,?)+)\]\.some\(\(key\)[\s\S]{0,120}?features\[key\]/g,
  ];
  for (const pattern of keyArrayPatterns) {
    for (const match of source.matchAll(pattern)) {
      for (const key of extractQuotedItems(match[1])) keys.add(key);
    }
  }
  return Array.from(keys).sort();
}

function extractQuotedItems(text) {
  return Array.from(text.matchAll(/['"]([A-Za-z][A-Za-z0-9_]*)['"]/g)).map((match) => match[1]);
}

function sourceCitations(repoRoot, field, configFiles) {
  const files = [
    ...configFiles.map((file) => path.join(CONFIG_DIR, file)),
    ...EXTRA_SOURCE_FILES,
  ];
  return files.filter((file) => readIfExists(repoRoot, file).includes(field));
}

function buildInventory(repoRoot = process.cwd()) {
  return FAMILIES.map((family) => {
    const configKeys = new Set();
    for (const config of family.configs) {
      const source = readIfExists(repoRoot, path.join(CONFIG_DIR, config));
      for (const key of extractConfigKeys(source)) configKeys.add(key);
    }
    const required = family.required.map(([field, display]) => ({ field, display, required: true }));
    const discovered = Array.from(configKeys)
      .filter((field) => !required.some((item) => item.field === field))
      .map((field) => ({ field, display: defaultDisplay(field), required: false }));
    const augmentations = [...required, ...discovered].map((item) => ({
      ...item,
      sources: sourceCitations(repoRoot, item.field, family.configs),
      legacy: family.legacy,
    }));
    return { ...family, augmentations };
  });
}

function defaultDisplay(field) {
  return `${field} as an evidence-backed structured value where populated`;
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function markdown(rows, generatedAt) {
  const lines = [
    `# M2-09 Schema Augmentations — ${generatedAt}`,
    '',
    'WP-M2-09 Step 1b inventory of structured schema-card fields and vocabularies that should enrich the rebuilt schema-first tables beyond the legacy JSX shapes.',
    '',
    'Cross-cutting augmentation: every rendered value that traces to a card should carry provenance-bundle hover-source data and the future click-to-open-source-overlay seam.',
    '',
  ];
  for (const row of rows) {
    lines.push(`## ${row.family}`);
    lines.push('');
    lines.push(`Legacy components: ${row.components.map((name) => `\`${name}\``).join(', ')}.`);
    lines.push(`Schema configs: ${row.configs.map((name) => `\`${name}\``).join(', ')}.`);
    lines.push('');
    lines.push('| Field / source signal | Required | Legacy showed | Rebuilt table should show | Source citation(s) |');
    lines.push('|---|---|---|---|---|');
    for (const item of row.augmentations) {
      lines.push(`| ${mdCell(item.field)} | ${item.required ? 'yes' : 'no'} | ${mdCell(item.legacy)} | ${mdCell(item.display)} | ${mdCell(item.sources.length ? item.sources.join(', ') : row.configs.map((name) => path.join(CONFIG_DIR, name)).join(', '))} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.replace(/\s+$/, '')}\n`);
}

function main() {
  const generatedAt = new Date().toISOString();
  const rows = buildInventory();
  writeFile(OUT, markdown(rows, generatedAt));
  const augmentationCount = rows.reduce((sum, row) => sum + row.augmentations.length, 0);
  process.stdout.write(`Schema augmentation inventory: ${rows.length} families, ${augmentationCount} augmentation rows\n`);
}

if (require.main === module) main();

module.exports = {
  FAMILIES,
  buildInventory,
  extractConfigKeys,
  markdown,
};
