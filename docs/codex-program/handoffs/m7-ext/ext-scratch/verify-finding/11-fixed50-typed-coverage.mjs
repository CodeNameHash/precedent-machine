'use strict';

/**
 * Q-0011: typed-value coverage of the fixed 50 review items.
 *
 * Intersects each identity member's source_node_occurrence_ids with M4
 * claims, classifies values by inspecting claim fields (not headers), and
 * greps *-parse.js plus candidate-resolution.js for a minted
 * claim_definition_key. A comment mention is not a producer.
 */

import { execFileSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const OUT_DIR = dirname(new URL(import.meta.url).pathname);
const PRODUCER_DIR = resolve(repoRoot, 'lib/canonical-v2/native-producer');

const IDENTITY_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
);
const LEDGER_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-baseline-ledger.json',
);
const ANALYSIS_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
);

const ENUM_TOKEN = /^[A-Z0-9][A-Z0-9_-]{0,79}$/;
const NUMERIC_STRING = /^-?[0-9]+(\.[0-9]+)?$/;
const DATE_STRING = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

const COVERAGE_BY_ORDINAL = Object.freeze({
  1: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the same-extent-as-pre-closing service-credit qualifier from the EMPLOYEE_SERVICE_CREDIT raw sentence M4 already holds.',
  },
  2: {
    category: 'NOT_AT_ALL',
    missing_fact: 'termination-right cure/condition prerequisites and reciprocal-breach proviso',
    line: 'Needs a fact no producer emits on this node: termination-right cure/condition prerequisites and the reciprocal-breach proviso. Intersecting claim raw is only the 86-character trigger opening.',
  },
  3: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; Ben accepted the existing GENERAL_COVENANT_PRESENT enum.',
  },
  4: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Note is a chapeau-visibility remark, not a missing legal fact. LEGAL_RESTRAINT_CONDITION already holds presence plus the restraint sentence.',
  },
  5: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; MAE_DEFINITION_PRONG already holds BUSINESS_EFFECTS.',
  },
  6: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type dual-knowledge and intent-as-to-material-breach from WILLFUL_BREACH_KNOWLEDGE_STANDARD (ACTUAL_OR_CONSTRUCTIVE plus the limb quote M4 already holds).',
  },
  7: {
    category: 'NOT_AT_ALL',
    missing_fact: 'representing party',
    line: 'Needs a fact no producer emits on this source-provision blob: representing party. Raw is a share-count list with no party field.',
  },
  8: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the materiality-to-amend and material-benefit-plan qualifiers from the IOC_RESTRICTION_PRESENT raw sentence M4 already holds.',
  },
  9: {
    category: 'PARTLY',
    missing_fact: 'inherited initial Superior Proposal Notice Period days',
    line: 'Subsequent-match 3 Business Days is already typed on NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS. Still needs the inherited initial Superior Proposal Notice Period days.',
  },
  10: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the charter/bylaws/agreement source of indemnification from the INDEMNIFICATION_CONTINUATION raw sentence M4 already holds.',
  },
  11: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; disclaimer presence is already held.',
  },
  12: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; REGULATORY_CONSULTATION_RIGHT already holds GOOD_FAITH_VIEWS.',
  },
  13: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type constrained party (Company) and consent-of party (Parent) from the APPRAISAL_SETTLEMENT_CONSENT raw sentence M4 already holds.',
  },
  14: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type/classify the held source-provision blob as a company capitalisation representation (M4 already emits CAPITALISATION_SOURCE_PROVISION on this node).',
  },
  15: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No additional legal fact demanded; note is a page-number source artefact on an already-typed APPRAISAL_RIGHTS_STATUS enum.',
  },
  16: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; dividend-coordination presence is already held.',
  },
  17: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; no-financing-condition acknowledgment is already held.',
  },
  18: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type guarantor and beneficiary from guarantor_ref plus the raw “to the Company” sentence M4 already holds.',
  },
  19: {
    category: 'PARTLY',
    missing_fact: 'most-favored-nation (MFN) term',
    line: 'Business/geographic-region scope and materiality-to-company-as-a-whole are in the NONCOMPETE raw. MFN is not held on this claim.',
  },
  20: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the mechanic as post-closing company bylaws from the MERGER_STRUCTURE_MECHANIC_PRESENT raw sentence M4 already holds.',
  },
  21: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; boilerplate mechanic presence is already held.',
  },
  22: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the counsel-consultation and stockholder-dissemination test from the MEETING_ADJOURNMENT_REASON raw sentence M4 already holds.',
  },
  23: {
    category: 'NOT_AT_ALL',
    missing_fact: 'outside-date tolling on specific-performance action; financing-source no-liability bar',
    line: 'Needs facts no producer emits on this node: outside-date tolling on a specific-performance action, and a financing-source no-liability bar. Intersecting raw is only the standard irreparable-harm grant.',
  },
  24: {
    category: 'NOT_AT_ALL',
    missing_fact: 'change-in-law tax-treatment carveout; alternative-structure cooperation',
    line: 'Needs facts no producer emits on this node: the change-in-law tax-treatment carveout and the alternative-structure cooperation proviso. Intersecting raw is only the main protection covenant.',
  },
  25: {
    category: 'NOT_AT_ALL',
    missing_fact: 'termination-fee trigger limb (Section 7.01(f))',
    line: 'Needs a fact no intersecting claim holds: termination-fee trigger limb Section 7.01(f). M4 on this node holds only TERMINATION_FEE_AMOUNT.',
  },
  26: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; source-provision presence is already held.',
  },
  27: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type as an IP-assignment representation with the material-IP and company-materiality qualifiers from the source-provision raw and INTELLECTUAL_PROPERTY topic M4 already holds.',
  },
  28: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type exculpation/indemnification, charter/bylaw source, and the six-year keep-in-place duration from the ADVANCEMENT_OF_EXPENSES and CHARTER_PROTECTION_CONTINUATION raw sentences M4 already holds.',
  },
  29: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; MAE_DEFINITION_PRONG already holds CONSUMMATION_PREVENTION.',
  },
  30: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; disclaimer presence is already held.',
  },
  31: {
    category: 'PARTLY',
    missing_fact: 'change-of-recommendation-effect proviso; outside-counsel consultation',
    line: 'Rule 14d-9 / 14e-2 safe-disclosure is already typed. Still needs the change-of-recommendation-effect proviso and outside-counsel consultation, which this claim’s raw does not hold.',
  },
  32: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; knowledge person-source and knowledge standard enums are already held.',
  },
  33: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type party, GAAP-and-Law carveout, industry-relative baseline, and disproportionality from MAE_CARVEOUT / MAE_DISPROPORTIONALITY_CARVEBACK values M4 already holds.',
  },
  34: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type terrorism, war, national-disaster, and cyber-attack subtypes from the ACTS_OF_WAR_TERRORISM raw sentence M4 already holds.',
  },
  35: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Same as the prior MAE carveout: re-type listed subtypes and the industry-relative disproportionality already held on this node.',
  },
  36: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type currency-exchange and interest-rate subtypes from the FINANCIAL_MARKETS raw sentence M4 already holds.',
  },
  37: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content; indebtedness bucket and USD threshold structure are already held.',
  },
  38: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type as a bilateral reasonable-best-efforts antitrust covenant from the source-provision raw M4 already holds.',
  },
  39: {
    category: 'NOT_AT_ALL',
    missing_fact: 'nested clause-number identity',
    line: 'Needs a fact no producer emits today: nested clause-number identity. The item has no source_node_occurrence_ids and no intersecting M4 claim.',
  },
  40: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision sentence as a stockholder-approval closing condition.',
  },
  41: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No comparison-entry legal fact demanded; note approves a mechanics provision without comparison.',
  },
  42: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision blob as D&O indemnification (same source-of-obligation content as the earlier indemnification note).',
  },
  43: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type ERISA-representation topic, representing party (Company), and the six-year lookback from the source-provision raw M4 already holds.',
  },
  44: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type access scope, purpose, and notice/hours/non-interference restrictions from the source-provision raw M4 already holds.',
  },
  45: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'No demanded legal content in the note; only an untyped source-provision blob is present.',
  },
  46: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision blob as an Acquired Companies definition and drop the intro text.',
  },
  47: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision blob as an MAE definition.',
  },
  48: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type parent-MAE impairment factors (prevent / materially delay / materially impair) and the consummation limb from the raw sentence M4 already holds.',
  },
  49: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision blob as merger topology / form-of-merger.',
  },
  50: {
    category: 'COVERABLE_FROM_M4',
    missing_fact: null,
    line: 'Re-type the held source-provision blob as an entire-agreement boilerplate provision.',
  },
});

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function rel(path) {
  return relative(repoRoot, path).split('\\').join('/');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort(compareText)) {
      out[key] = sortedObject(value[key]);
    }
    return out;
  }
  return value;
}

function stripComments(source) {
  let out = '';
  let i = 0;
  let state = 'code';
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        i += 2;
        out += '  ';
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        i += 2;
        out += '  ';
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        state = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out += ch;
      } else {
        out += ' ';
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    out += ch;
    if (ch === '\\' && i + 1 < source.length) {
      out += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === state) state = 'code';
    i += 1;
  }
  return out;
}

function quotedKeyInActiveSource(active, key) {
  const single = `'${key}'`;
  const double = `"${key}"`;
  return active.includes(single) || active.includes(double);
}

function listProducerSearchFiles() {
  const parseFiles = readdirSync(PRODUCER_DIR)
    .filter((name) => name.endsWith('-parse.js'))
    .sort(compareText)
    .map((name) => resolve(PRODUCER_DIR, name));
  const resolver = resolve(PRODUCER_DIR, 'candidate-resolution.js');
  return [...parseFiles, resolver];
}

function runGrep(key, files) {
  const relFiles = files.map(rel);
  const command = [
    'rg',
    '-n',
    '-F',
    '--glob',
    '*-parse.js',
    '--glob',
    'candidate-resolution.js',
    key,
    'lib/canonical-v2/native-producer',
  ].join(' ');
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(
      'rg',
      ['-n', '-F', '--glob', '*-parse.js', '--glob', 'candidate-resolution.js', key, PRODUCER_DIR],
      { encoding: 'utf8', cwd: repoRoot },
    );
  } catch (error) {
    exitCode = typeof error.status === 'number' ? error.status : 1;
    stdout = error.stdout ? String(error.stdout) : '';
    stderr = error.stderr ? String(error.stderr) : '';
  }
  return {
    command,
    exit_code: exitCode,
    stdout,
    stderr,
    files_searched: relFiles,
  };
}

function resolveProducer(key, searchFiles, fileCache) {
  const mintHits = [];
  for (const abs of searchFiles) {
    const cached = fileCache.get(abs);
    if (quotedKeyInActiveSource(cached.active, key)) {
      mintHits.push(rel(abs));
    }
  }
  const grep = runGrep(key, searchFiles);
  if (mintHits.length === 0) {
    return {
      producer_module: 'NO_PRODUCER',
      mint_files: [],
      grep,
    };
  }
  return {
    producer_module: mintHits[0],
    mint_files: mintHits,
    grep,
  };
}

function fieldCount(value) {
  if (!value || typeof value !== 'object') return 0;
  return Object.keys(value).length;
}

function isWholeSentence(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 40) return false;
  if (!/\s/.test(trimmed)) return false;
  return /[a-z]/.test(trimmed) && trimmed.split(/\s+/).length >= 8;
}

function looksLikeDate(value) {
  return typeof value === 'string' && DATE_STRING.test(value.trim());
}

function classifyTypedValue(claim) {
  const revision = claim?.legacy_claim_revision && typeof claim.legacy_claim_revision === 'object'
    ? claim.legacy_claim_revision
    : {};
  const canonical = Object.prototype.hasOwnProperty.call(revision, 'canonical_value')
    ? revision.canonical_value
    : undefined;
  const raw = revision.raw_value;
  const kinds = [];

  if (typeof canonical === 'number' && Number.isFinite(canonical)) {
    kinds.push('numeric');
  } else if (typeof canonical === 'string' && NUMERIC_STRING.test(canonical.trim())) {
    kinds.push('numeric');
  }

  if (looksLikeDate(canonical)) kinds.push('date');

  if (
    typeof canonical === 'string'
    && ENUM_TOKEN.test(canonical)
    && !NUMERIC_STRING.test(canonical)
    && !looksLikeDate(canonical)
  ) {
    kinds.push('enum');
  }

  if (typeof canonical === 'boolean') kinds.push('presence_boolean');

  if (isWholeSentence(raw)) kinds.push('untyped_whole_sentence_raw');

  const uniqueKinds = [...new Set(kinds)];
  return {
    kinds: uniqueKinds,
    carries_typed_value: uniqueKinds.some((kind) => kind !== 'untyped_whole_sentence_raw'),
    canonical_js_type: canonical === null ? 'null' : typeof canonical,
    canonical_value: canonical === undefined ? null : canonical,
    unit: revision.unit ?? null,
    day_basis: revision.day_basis ?? null,
    denominator: revision.denominator ?? null,
    state: revision.state ?? null,
    raw_value_char_length: typeof raw === 'string' ? raw.length : 0,
    raw_is_whole_sentence: isWholeSentence(raw),
    field_counts: {
      claim_top_level: fieldCount(claim),
      legacy_claim_revision: fieldCount(revision),
      attributes: fieldCount(revision.attributes),
    },
  };
}

function clipUtf8(text, maxBytes) {
  if (typeof text !== 'string') return null;
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString('utf8');
}

function intersectingClaims(claims, itemNodes) {
  if (itemNodes.size === 0) return [];
  const hits = [];
  for (const claim of claims) {
    const claimNodes = Array.isArray(claim.source_node_occurrence_ids)
      ? claim.source_node_occurrence_ids
      : [];
    if (!claimNodes.some((id) => itemNodes.has(id))) continue;
    hits.push(claim);
  }
  hits.sort((left, right) => {
    const keyCmp = compareText(left.claim_definition_key ?? '', right.claim_definition_key ?? '');
    if (keyCmp !== 0) return keyCmp;
    return compareText(left.analysis_claim_id ?? '', right.analysis_claim_id ?? '');
  });
  return hits;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Fixed-50 typed-value coverage (Q-0011)');
  lines.push('');
  lines.push('Each row is one of the 50 frozen review items. Claims are M4 analysis claims whose `source_node_occurrence_ids` intersect the item’s nodes. Typed-value kinds come from inspecting `legacy_claim_revision` fields, not headers. `NO_PRODUCER` means the key is not minted as a string in `*-parse.js` or `candidate-resolution.js` (comment mentions do not count).');
  lines.push('');
  lines.push(`- **COVERABLE_FROM_M4:** ${report.counts.coverable_from_m4}`);
  lines.push(`- **PARTLY:** ${report.counts.partly}`);
  lines.push(`- **NOT_AT_ALL:** ${report.counts.not_at_all}`);
  lines.push(`- Distinct claim keys with **NO_PRODUCER:** ${report.counts.distinct_no_producer_keys}`);
  lines.push(`- Intersecting claim rows: ${report.counts.intersecting_claim_rows}`);
  lines.push('');
  lines.push('| # | Family | Decision | Claim keys | Typed kinds | Producer | Coverage | One-line judgment |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of report.items) {
    const keys = item.claims.length === 0
      ? '—'
      : item.claims.map((claim) => `\`${claim.claim_definition_key}\``).join('<br>');
    const kinds = item.claims.length === 0
      ? '—'
      : item.claims.map((claim) => (claim.typed_value.kinds.length ? claim.typed_value.kinds.join(', ') : 'none')).join('<br>');
    const producers = item.claims.length === 0
      ? '—'
      : [...new Set(item.claims.map((claim) => claim.producer_module))].map((p) => `\`${p}\``).join('<br>');
    const family = item.family_key ?? '—';
    const note = item.coverage.line.replace(/\|/g, '\\|');
    lines.push(`| ${item.sample_ordinal} | ${family} | ${item.original_decision} | ${keys} | ${kinds} | ${producers} | **${item.coverage.category}** | ${note} |`);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('| --- | ---: |');
  lines.push(`| COVERABLE_FROM_M4 | ${report.counts.coverable_from_m4} |`);
  lines.push(`| PARTLY | ${report.counts.partly} |`);
  lines.push(`| NOT_AT_ALL | ${report.counts.not_at_all} |`);
  lines.push(`| Total | ${report.items.length} |`);
  lines.push('');
  if (report.no_producer_keys.length > 0) {
    lines.push('## NO_PRODUCER keys');
    lines.push('');
    lines.push('Each key was grepped in `lib/canonical-v2/native-producer/*-parse.js` and `candidate-resolution.js`. A comment mention is not a mint.');
    lines.push('');
    for (const row of report.no_producer_keys) {
      lines.push(`### \`${row.claim_definition_key}\``);
      lines.push('');
      lines.push('```');
      lines.push(`$ ${row.grep.command}`);
      lines.push(`exit ${row.grep.exit_code}`);
      lines.push(row.grep.stdout.length === 0 ? '(empty)' : row.grep.stdout.replace(/\s+$/, ''));
      lines.push('```');
      lines.push('');
      lines.push(`Files searched: ${row.grep.files_searched.join(', ')}`);
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderOut(report) {
  const lines = [];
  lines.push(`items ${report.items.length}`);
  lines.push(`coverable_from_m4 ${report.counts.coverable_from_m4}`);
  lines.push(`partly ${report.counts.partly}`);
  lines.push(`not_at_all ${report.counts.not_at_all}`);
  lines.push(`distinct_claim_keys ${report.counts.distinct_claim_keys}`);
  lines.push(`distinct_no_producer_keys ${report.counts.distinct_no_producer_keys}`);
  lines.push(`intersecting_claim_rows ${report.counts.intersecting_claim_rows}`);
  lines.push(`items_with_zero_claims ${report.counts.items_with_zero_claims}`);
  lines.push('no_producer_keys');
  for (const row of report.no_producer_keys) {
    lines.push(`  ${row.claim_definition_key} grep_exit=${row.grep.exit_code} stdout_bytes=${Buffer.byteLength(row.grep.stdout, 'utf8')}`);
  }
  lines.push('commands');
  for (const cmd of report.commands) {
    lines.push(`  ${cmd.command} exit=${cmd.exit_code}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const identity = loadJson(IDENTITY_PATH);
  const ledger = loadJson(LEDGER_PATH);
  const analysisSet = loadJson(ANALYSIS_SET_PATH);
  const members = identity.members;
  if (!Array.isArray(members) || members.length !== 50) {
    throw new Error(`expected 50 identity members, got ${members?.length}`);
  }

  const ledgerById = new Map();
  for (const entry of ledger.entries ?? []) {
    ledgerById.set(entry.review_item_id, entry);
  }

  const analysisByAgreement = new Map();
  for (const member of analysisSet.members ?? []) {
    const record = loadJson(resolve(repoRoot, member.agreement_analysis_binding.path));
    analysisByAgreement.set(member.agreement_id, {
      path: member.agreement_analysis_binding.path,
      claims: Array.isArray(record.claims) ? record.claims : [],
    });
  }

  const searchFiles = listProducerSearchFiles();
  const fileCache = new Map();
  for (const abs of searchFiles) {
    const source = readFileSync(abs, 'utf8');
    fileCache.set(abs, { source, active: stripComments(source) });
  }

  const producerCache = new Map();
  const items = [];
  for (const member of [...members].sort((a, b) => a.sample_ordinal - b.sample_ordinal)) {
    const led = ledgerById.get(member.review_item_id);
    if (!led) {
      throw new Error(`ledger missing review_item_id ${member.review_item_id}`);
    }
    const analysis = analysisByAgreement.get(member.agreement_id);
    if (!analysis) {
      throw new Error(`analysis set missing agreement ${member.agreement_id}`);
    }
    const itemNodes = new Set(
      (member.source_node_occurrence_ids ?? []).filter((id) => typeof id === 'string' && id.length > 0),
    );
    const hits = intersectingClaims(analysis.claims, itemNodes);
    const claims = hits.map((claim) => {
      const key = claim.claim_definition_key;
      if (!producerCache.has(key)) {
        producerCache.set(key, resolveProducer(key, searchFiles, fileCache));
      }
      const producer = producerCache.get(key);
      const typed = classifyTypedValue(claim);
      return {
        analysis_claim_id: claim.analysis_claim_id ?? null,
        claim_definition_key: key,
        family: claim.family ?? null,
        section_reference: claim.section_reference ?? null,
        source_node_occurrence_ids: [...(claim.source_node_occurrence_ids ?? [])].sort(compareText),
        typed_value: typed,
        producer_module: producer.producer_module,
        mint_files: producer.mint_files,
        no_producer_grep: producer.producer_module === 'NO_PRODUCER' ? producer.grep : null,
        raw_value_excerpt: clipUtf8(claim.legacy_claim_revision?.raw_value ?? '', 240),
      };
    });

    const coverage = COVERAGE_BY_ORDINAL[member.sample_ordinal];
    if (!coverage) {
      throw new Error(`missing coverage judgment for ordinal ${member.sample_ordinal}`);
    }

    items.push({
      sample_ordinal: member.sample_ordinal,
      review_item_id: member.review_item_id,
      family_key: member.family_key ?? null,
      item_kind: member.item_kind,
      agreement_id: member.agreement_id,
      source_node_occurrence_ids: [...itemNodes].sort(compareText),
      analysis_path: analysis.path,
      original_decision: led.original_decision,
      original_note: led.original_note ?? null,
      repair_class: led.repair_class ?? null,
      claims,
      coverage,
    });
  }

  const noProducerKeys = [...producerCache.entries()]
    .filter(([, value]) => value.producer_module === 'NO_PRODUCER')
    .map(([key, value]) => ({
      claim_definition_key: key,
      grep: value.grep,
    }))
    .sort((a, b) => compareText(a.claim_definition_key, b.claim_definition_key));

  const counts = {
    coverable_from_m4: items.filter((item) => item.coverage.category === 'COVERABLE_FROM_M4').length,
    partly: items.filter((item) => item.coverage.category === 'PARTLY').length,
    not_at_all: items.filter((item) => item.coverage.category === 'NOT_AT_ALL').length,
    distinct_claim_keys: producerCache.size,
    distinct_no_producer_keys: noProducerKeys.length,
    intersecting_claim_rows: items.reduce((acc, item) => acc + item.claims.length, 0),
    items_with_zero_claims: items.filter((item) => item.claims.length === 0).length,
  };

  const commands = [
    {
      command: `node ${rel(resolve(OUT_DIR, '11-fixed50-typed-coverage.mjs'))}`,
      exit_code: 0,
    },
    ...noProducerKeys.map((row) => ({
      command: row.grep.command,
      exit_code: row.grep.exit_code,
    })),
  ];

  const report = sortedObject({
    schema: 'Q-0011-FIXED50-TYPED-COVERAGE/V1',
    identity_manifest_id: identity.fixed_sample_identity_manifest_id,
    repair_baseline_ledger_id: ledger.repair_baseline_ledger_id,
    agreement_analysis_set_id: analysisSet.agreement_analysis_set_id,
    producer_search: {
      directory: rel(PRODUCER_DIR),
      files: searchFiles.map(rel),
    },
    counts,
    no_producer_keys: noProducerKeys,
    items,
    commands,
  });

  writeFileSync(
    resolve(OUT_DIR, '11-fixed50-typed-coverage.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(resolve(OUT_DIR, '11-fixed50-typed-coverage.out'), renderOut(report));
  writeFileSync(resolve(OUT_DIR, '11-FIXED50-COVERAGE.md'), renderMarkdown(report));
  process.stdout.write(renderOut(report));
}

main();
