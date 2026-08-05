#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REVIEW_PAGE = 'pages/review/[id].js';
const INVENTORY_OUT = 'docs/audit/legacy-layout-inventory.md';
const GAPS_OUT = 'docs/audit/m2-08-config-gaps.md';

const SURFACES = [
  {
    rank: 1,
    name: 'Structure & Mechanics',
    component: 'StructTable',
    slot: 'deal-mechanics',
    selector: 'STRUCT provisions; dealStructure, mergerForm, offer, closing, effects, effective-time, governance fields',
    status: 'gap',
    m206: 'Partial overlap only: consideration-hero and sec-meeting cover economics / SEC offer filings, not the full structure table.',
    config: 'structure-mechanics.config.js',
    reason: 'M2-06 has no single home for transaction form, merger mechanics, closing/effective-time mechanics, governance at close, and structural oddities.',
    selectorNeed: 'Select STRUCTURE_MECHANICS cards plus offer-related STRUCT-OFFER fields; group rows by transaction form, mechanics, governance, and oddities.',
  },
  {
    rank: 2,
    name: 'Antitrust / Regulatory Summary',
    component: 'AntitrustSummaryTable',
    slot: 'covenants',
    selector: 'ANTI provisions plus antitrust condition and TERMR outside-date context',
    status: 'gap',
    m206: 'No M2-06 config maps ANTI fields.',
    config: 'antitrust-regulatory.config.js',
    reason: 'Regulatory efforts, burdensome-condition caps, filing timing, litigation obligations, ticking-fee links, and clear-skies terms are structured but currently uncovered by configs.',
    selectorNeed: 'Select ANTITRUST_REGULATORY cards, related regulatory closing conditions, and outside-date extension cards for cross-linked antitrust mechanics.',
  },
  {
    rank: 3,
    name: 'MAE Definition Summary',
    component: 'MaeDefinitionSummary',
    slot: 'mae',
    selector: 'MAE-DEF / MAE-DEF-P and MAE-like DEF/REP provisions; carveouts, disproportionality, prevent-delay, test limbs',
    status: 'gap',
    m206: 'No M2-06 config maps MAE definition fields.',
    config: 'mae-definitions.config.js',
    reason: 'The schema card shows the definition, but not the lawyer-facing checklist of MAE test, carve-outs, disproportionate-impact clause, and parent/company split.',
    selectorNeed: 'Select MAE cards and definition cards whose subtype/category identifies Material Adverse Effect; split target and parent if both exist.',
  },
  {
    rank: 4,
    name: 'Termination Rights Summary',
    component: 'TermrRebuiltSummary',
    slot: 'termination',
    selector: 'TERMR-M / TERMR-B / TERMR-T provisions; outside date, extensions, vote failure, breach, change-of-recommendation, superior-proposal rights',
    status: 'gap',
    m206: 'tail-fee.config.js covers tail-fee mechanics only, not termination rights.',
    config: 'termination-rights.config.js',
    reason: 'Outside date, extension triggers, party-specific termination rights, fault exclusions, and vote standards remain a separate legacy surface.',
    selectorNeed: 'Select TERMINATION_RIGHT cards and related vote/approval cards; group mutual, buyer, and target rights.',
  },
  {
    rank: 5,
    name: 'Termination Fee Matrix',
    component: 'TermfRebuiltSummary',
    slot: 'termination',
    selector: 'TERMF provisions; target fee, reverse fee, regulatory ticking fee, tail mechanics, remedy effect',
    status: 'gap',
    m206: 'tail-fee.config.js maps only the tail mechanics subset.',
    config: 'termination-fees.config.js',
    reason: 'The broader fee matrix, reverse-termination fee, regulatory fee links, trigger matrix, and exclusive-remedy treatment are not covered by the tail-fee config.',
    selectorNeed: 'Select TERMINATION_FEE cards; group target fee, reverse fee, regulatory fee, tail, and remedy-effect mechanics.',
  },
  {
    rank: 6,
    name: 'General Covenants',
    component: 'CovSummaryTable / IocAffirmativeCovenantsTable / IocNegativeCovenantsTable',
    slot: 'covenants',
    selector: 'COV provisions plus IOC affirmative and negative covenant rows; efforts, access, public statements, insurance, ordinary-course restrictions',
    status: 'gap',
    m206: 'ioc-exceptions.config.js covers exception preambles, not affirmative/negative covenant substance.',
    config: 'general-covenants.config.js',
    reason: 'Positive obligations and non-IOC covenant mechanics remain only in the legacy grouped summary tables.',
    selectorNeed: 'Select COVENANT_OTHER and COVENANT_INTERIM_OPERATING cards; separate affirmative obligations, negative covenant baskets, and exception standards.',
  },
  {
    rank: 7,
    name: 'Approvals / Votes',
    component: 'CondSingleTable / TermrRebuiltSummary / StructTable',
    slot: 'conditions',
    selector: 'COND-M-STOCKHOLDER, TERMR-VOTE, STRUCT shareholder-approval fields; vote threshold, quorum, record-date, dual-class mechanics',
    status: 'gap',
    m206: 'conditions-m.config.js and sec-meeting.config.js cover existence / meeting mechanics, not vote-standard mechanics.',
    config: 'approvals-votes.config.js',
    reason: 'Approval condition existence is covered, but the required vote and meeting-law mechanics need a dedicated surface.',
    selectorNeed: 'Select stockholder-approval condition cards, vote-failure termination cards, and structure/meeting cards with approval-method fields.',
  },
  {
    rank: 8,
    name: 'Advisers / Fees / Expenses',
    component: 'MiscSummaryTable',
    slot: 'misc',
    selector: 'MISC provisions; fee-expense allocation, jurisdiction, governing law, specific performance, adviser fees where extracted',
    status: 'gap',
    m206: 'No M2-06 config maps non-termination fee/expense allocation or adviser-fee misc rows.',
    config: 'advisers-fees-expenses.config.js',
    reason: 'General expense allocation and adviser-fee economics are separate from antitrust fees and termination fees.',
    selectorNeed: 'Select MISC_BOILERPLATE cards with feeExpenseAllocation, adviser fee, expense, governing-law, and forum mechanics; filter boilerplate-only rows.',
  },
  {
    rank: 9,
    name: 'Representation Qualifiers',
    component: 'RepGeneralExceptionsTable / BringdownTable / RepKnowledgeNote',
    slot: 'reps',
    selector: 'REP-T / REP-B plus COND-B-REP / COND-S-REP; materiality, knowledge, bring-down tiers, SEC filing carve-outs, schedules',
    status: 'gap',
    m206: 'conditions-b/s configs show bring-down condition existence, not the rep-side qualifier and exception package.',
    config: 'representations-qualifiers.config.js',
    reason: 'Knowledge/materiality qualifiers, general rep exceptions, and bring-down linkage remain analytically important and are not captured by M2-06 configs.',
    selectorNeed: 'Select REPRESENTATION cards and related bring-down condition cards; group target reps, buyer reps, qualifier package, and bring-down tiers.',
  },
  {
    rank: 10,
    name: 'Consideration Hero',
    component: 'consideration-hero.config.js',
    slot: 'consideration',
    selector: 'CONSID / CONSID-CVR / CONSID-EQUITY and STRUCT-OFFER cards',
    status: 'mapped',
    m206: 'Mapped by consideration-hero.config.js.',
    config: '',
    reason: 'No M2-08 gap. Future detailed CVR review is intentionally deferred outside M2-08.',
    selectorNeed: '',
  },
  {
    rank: 11,
    name: 'Closing Conditions',
    component: 'CondSingleTable',
    slot: 'conditions',
    selector: 'COND-M / COND-B / COND-S provisions',
    status: 'mapped',
    m206: 'Mapped by conditions-m.config.js, conditions-b.config.js, and conditions-s.config.js.',
    config: '',
    reason: 'Core condition presence is mapped; richer analytical parity is handled by WP-M2-09.',
    selectorNeed: '',
  },
  {
    rank: 12,
    name: 'Material Contracts',
    component: 'RepMaterialContractsTable',
    slot: 'reps',
    selector: 'REP-T-MATERIAL-CONTRACTS buckets and thresholds',
    status: 'mapped',
    m206: 'Mapped by material-contracts.config.js.',
    config: '',
    reason: 'No M2-08 gap.',
    selectorNeed: '',
  },
  {
    rank: 13,
    name: 'No-Shop / Fiduciary-Out Stack',
    component: 'NoSol structured tables',
    slot: 'covenants',
    selector: 'NOSOL cards and Superior Proposal / Intervening Event definitions',
    status: 'mapped',
    m206: 'Mapped by nosol-noshop, nosol-superior, nosol-intervening, and nosol-fiduciary configs.',
    config: '',
    reason: 'No M2-08 gap.',
    selectorNeed: '',
  },
  {
    rank: 14,
    name: 'Employee Benefits',
    component: 'CompensationItemsTable / EmploymentMattersBlock',
    slot: 'covenants',
    selector: 'COV-EMPLOYEE compensationItems and legacy employee-benefit fields',
    status: 'mapped',
    m206: 'Mapped by employee-benefits.config.js.',
    config: '',
    reason: 'No M2-08 gap.',
    selectorNeed: '',
  },
  {
    rank: 15,
    name: 'SEC Meeting / Tender-Offer Filings',
    component: 'SecMeeting legacy rows / STRUCT-OFFER',
    slot: 'covenants',
    selector: 'COV-PROXY, COV-MEETING, STRUCT-OFFER SEC filing and meeting fields',
    status: 'mapped',
    m206: 'Mapped by sec-meeting.config.js.',
    config: '',
    reason: 'No M2-08 gap except approval vote standards, listed separately.',
    selectorNeed: '',
  },
  {
    rank: 16,
    name: 'No Other Reps / Fraud',
    component: 'NoOtherRepsFraudTable / lib/abry.js',
    slot: 'misc',
    // v1 reclassification (2026-08-02, R3): mirrors ABRY_CODES in
    // no-other-reps-fraud.config.js — old family codes retained for
    // historic rows, new element codes are the current landing spots.
    selector: 'MISC-ENTIRE, REP-T-NOREP, REP-B-NOREP, REP-B-ANTIRELIANCE, REP-T-NOOTHERREPS, REP-T-NONRELIANCE, REP-T-INDEPINVEST, REP-T-FRAUDCARVEOUT, REP-B-NOOTHERREPS, REP-B-NONRELIANCE, REP-B-INDEPINVEST, REP-B-FRAUDCARVEOUT',
    status: 'mapped',
    m206: 'Mapped by no-other-reps-fraud.config.js.',
    config: '',
    reason: 'No M2-08 gap.',
    selectorNeed: '',
  },
];

function lineNumber(source, needle) {
  const idx = source.indexOf(needle);
  if (idx < 0) return null;
  return source.slice(0, idx).split(/\r?\n/).length;
}

function buildInventory(repoRoot = process.cwd()) {
  const pagePath = path.join(repoRoot, REVIEW_PAGE);
  const source = fs.readFileSync(pagePath, 'utf8');
  return SURFACES.map((surface) => ({
    ...surface,
    source_file: REVIEW_PAGE,
    source_line: lineNumber(source, surface.component.split(' / ')[0]) || lineNumber(source, surface.component.split(' ')[0]),
    detected: surface.component.endsWith('.config.js') || source.includes(surface.component.split(' / ')[0]) || source.includes(surface.component.split(' ')[0]),
  }));
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function inventoryMarkdown(rows, generatedAt) {
  const lines = [
    `# Legacy Layout Inventory — ${generatedAt}`,
    '',
    'WP-M2-08 Step 1 static inventory of structured review-page surfaces against the M2-06 config set.',
    '',
    '| Rank | Surface | Slot | Legacy selector | M2-06 mapping | Status | Source |',
    '|---:|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    const source = row.source_line ? `${row.source_file}:${row.source_line}` : row.source_file;
    lines.push(`| ${row.rank} | ${mdCell(row.name)} | ${mdCell(row.slot)} | ${mdCell(row.selector)} | ${mdCell(row.m206)} | ${row.status} | ${source} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function gapsMarkdown(rows, generatedAt) {
  const gaps = rows.filter((row) => row.status === 'gap');
  const lines = [
    `# M2-08 Config Gaps — ${generatedAt}`,
    '',
    `Gaps found: ${gaps.length}.`,
    '',
    '| Priority | Legacy surface | Why not covered by M2-06 | Proposed config | Data selector needed |',
    '|---:|---|---|---|---|',
  ];
  for (const row of gaps) {
    lines.push(`| ${row.rank} | ${mdCell(row.name)} | ${mdCell(row.reason)} | \`${row.config}\` | ${mdCell(row.selectorNeed)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.replace(/\s+$/, '')}\n`);
}

function main() {
  const generatedAt = new Date().toISOString();
  const rows = buildInventory();
  writeFile(INVENTORY_OUT, inventoryMarkdown(rows, generatedAt));
  writeFile(GAPS_OUT, gapsMarkdown(rows, generatedAt));
  process.stdout.write(`Layout inventory: ${rows.length} surfaces, ${rows.filter((row) => row.status === 'gap').length} gaps\n`);
}

if (require.main === module) main();

module.exports = {
  SURFACES,
  buildInventory,
  gapsMarkdown,
  inventoryMarkdown,
};
