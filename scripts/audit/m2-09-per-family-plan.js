#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { buildInventory } = require('./schema-augmentation-inventory');

const PLAN_OUT = 'docs/audit/m2-09-per-family-plan.md';
const QUEUE_OUT = 'docs/review-queue/m2-09-per-family-rebuild-plan.json';

const PRIMITIVES_BY_FAMILY = {
  Conditions: ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource', 'EmptyStateBranch'],
  'Material Contracts': ['PillCell', 'ThresholdCellWithHoverQuote', 'CoverageChecklist', 'RomanNumeralOrdinal', 'EvidenceHoverSource', 'ComputedRollupHeader'],
  'IOC / General Covenants': ['PillCell', 'ThresholdCellWithHoverQuote', 'GroupedSubRows', 'EvidenceHoverSource', 'ComputedRollupHeader'],
  'Tail Fee / Fees': ['PillCell', 'ThresholdCellWithHoverQuote', 'EvidenceHoverSource'],
  NoSol: ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'Rep Materiality / Qualifiers': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'MAE / Definitions': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'Antitrust / Regulatory': ['PillCell', 'ThresholdCellWithHoverQuote', 'GroupedSubRows', 'EvidenceHoverSource', 'ComputedRollupHeader'],
  'Structure / Mechanics': ['PillCell', 'ThresholdCellWithHoverQuote', 'GroupedSubRows', 'EvidenceHoverSource'],
  'Termination Rights': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'SEC / Meeting': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'Approvals / Votes': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'Employee Benefits': ['PillCell', 'GroupedSubRows', 'EvidenceHoverSource'],
  'No Other Reps / Fraud': ['PillCell', 'CoverageChecklist', 'EvidenceHoverSource', 'EmptyStateBranch'],
  'Advisers / Fees / Expenses': ['PillCell', 'EvidenceHoverSource'],
};

function requiredAugmentations(row) {
  return row.augmentations.filter((item) => item.required);
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function familySpec(row) {
  const augmentations = requiredAugmentations(row);
  return {
    family: row.family,
    legacy: [
      `Carry forward the legacy shape from ${row.components.map((name) => `\`${name}\``).join(', ')}.`,
      row.legacy,
    ],
    augmentations,
    primitives: PRIMITIVES_BY_FAMILY[row.family] || ['PillCell', 'EvidenceHoverSource'],
    spec: [
      'Render canonical/schema pills before free-text values where a structured field exists.',
      'Render the value cell next, preserving the legacy ordering and grouping.',
      'Attach evidence hover-source data to each card-backed value.',
      'Use grouped subrows where the legacy table represented related variants in one analytical surface.',
    ],
  };
}

function buildPlan(repoRoot = process.cwd()) {
  return buildInventory(repoRoot).map(familySpec);
}

function planMarkdown(rows, generatedAt) {
  const lines = [
    `# M2-09 Per-Family Rebuild Plan — ${generatedAt}`,
    '',
    'WP-M2-09 Step 1c reconciliation of the legacy JSX audit and schema-augmentation inventory.',
    '',
    'Approval question for Ben: approve this batch as the target spec for Step 2 primitives and Step 3 per-family config enrichment.',
    '',
  ];
  for (const row of rows) {
    lines.push(`## ${row.family}`);
    lines.push('');
    lines.push('### Legacy Features');
    for (const item of row.legacy) lines.push(`- ${item}`);
    lines.push('');
    lines.push('### Schema Augmentations');
    for (const item of row.augmentations) {
      lines.push(`- \`${item.field}\`: ${item.display}`);
    }
    lines.push('');
    lines.push('### Rebuilt-Table Spec');
    for (const item of row.spec) lines.push(`- ${item}`);
    lines.push('');
    lines.push(`Primitives: ${row.primitives.map((primitive) => `\`${primitive}\``).join(', ')}.`);
    lines.push('');
  }
  return lines.join('\n');
}

function queueEntry(rows, generatedAt) {
  const familySummary = rows.map((row) => `${row.family}: ${row.augmentations.map((item) => item.field).join(', ')}`).join('\n');
  return {
    id: 'm2-09-per-family-rebuild-plan',
    created_at: generatedAt,
    kind: 'canonical',
    title: 'Approve M2-09 per-family rebuild plan',
    summary: `Codex reconciled the legacy JSX audit with the schema augmentation inventory. Approving this entry authorizes Steps 2-4 to build the shared render primitives, enrich each config to the per-family spec, and restore schema-first only after analytical parity is met.\n\nRequired augmentation set:\n${familySummary}`,
    evidence: [
      { label: 'Per-family plan', url: 'docs/audit/m2-09-per-family-plan.md' },
      { label: 'Legacy JSX inventory', url: 'docs/audit/m2-09-legacy-inventory.md' },
      { label: 'Schema augmentations', url: 'docs/audit/m2-09-schema-augmentations.md' },
      { label: 'Primitives inventory', url: 'docs/audit/m2-09-primitives-needed.md' },
    ],
    choices: [
      {
        key: 'approve',
        label: 'Approve batch plan',
        codex_action: 'proceed with WP-M2-09 Steps 2-4 against the approved per-family rebuild plan',
      },
      {
        key: 'modify',
        label: 'Approve with changes',
        codex_action: 'await Ben-authored modifications to docs/audit/m2-09-per-family-plan.md before Step 2',
      },
      {
        key: 'defer',
        label: 'Defer M2-09',
        codex_action: 'halt WP-M2-09 before primitive extraction and leave schema-first default blocked',
      },
    ],
    resolution: null,
    resolved_at: null,
    resolved_by: null,
  };
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.replace(/\s+$/, '')}\n`);
}

function main() {
  const generatedAt = new Date().toISOString();
  const rows = buildPlan();
  writeFile(PLAN_OUT, planMarkdown(rows, generatedAt));
  writeFile(QUEUE_OUT, JSON.stringify(queueEntry(rows, generatedAt), null, 2));
  process.stdout.write(`M2-09 per-family plan: ${rows.length} families, queue entry ${QUEUE_OUT}\n`);
}

if (require.main === module) main();

module.exports = {
  buildPlan,
  familySpec,
  planMarkdown,
  queueEntry,
};
