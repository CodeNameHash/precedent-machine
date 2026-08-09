#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const EVIDENCE_PATHS = Object.freeze([
  'evidence/canonical-v2/stage-2y-k-residual-a.json',
  'evidence/canonical-v2/stage-2y-k-residual-b.json',
]);
const REGISTER_PATH = 'docs/codex-program/notes/stage-2y/unresolved-register.json';
const OUTPUT_PATH = 'evidence/canonical-v2/stage-2y-k-ownership-ledger.json';
const SCHEMA_VERSION = 'STAGE_2Y_K_OWNERSHIP_LEDGER/V1';
const EXPECTED = Object.freeze({ occurrences: 212, source_fixable: 184, no_fix: 28 });

const A_MECHANISMS = new Set([
  'RESOLVER_ANTECEDENT_PARTY_CONTEXT_MISSING',
  'RESOLVER_GOVERNING_PAYMENT_CONTEXT_NOT_CONSUMED',
  'RESOLVER_SECTION_REFERENCE_LIST_NORMALISATION_GAP',
  'RESOLVER_UNIQUE_QUOTE_EVIDENCE_GATE',
]);
const B_MECHANISMS = new Set([
  'RESOLVER_PARENT_APPROVAL_PATTERN_FALSE_POSITIVE',
  'RESOLVER_PRESENCE_FACT_REQUIRES_UNNEEDED_MEETING_REFERENCE',
]);
const D_MECHANISMS = new Set([
  'RESOLVER_MAE_DEFINED_TERM_OR_CONTINUING_VARIANT',
  'RESOLVER_PARTY_REFERENCE_LEXICON_GAP',
  'RESOLVER_STOCKHOLDER_ADOPTION_LEXICAL_VARIANT',
]);
const C_MECHANISMS = new Set([
  'RESOLVER_BURDEN_COMMITMENT_PATTERN_MISS',
  'RESOLVER_CONSULTATION_PATTERN_MISS',
  'RESOLVER_FILING_OBLIGATION_PATTERN_MISS',
  'RESOLVER_INFORMATION_PROTECTION_PATTERN_MISS',
  'RESOLVER_INFORMATION_SHARING_PATTERN_MISS',
  'RESOLVER_OBLIGOR_CORROBORATION_PATTERN_MISS',
  'RESOLVER_WITHDRAWAL_PERIOD_PATTERN_MISS',
  'RESOLVER_SCHEDULED_APPROVAL_LEXICAL_VARIANT',
  'RESOLVER_FRUSTRATION_KIND_DETECTION_OMISSION',
  'RESOLVER_OFFICER_CERTIFICATE_CONFIRMING_VARIANT',
  'RESOLVER_FINANCING_ASSERTION_CORROBORATION_MISS',
  'RESOLVER_FINANCING_SCOPE_CORROBORATION_MISS',
  'RESOLVER_GUARANTY_IN_EFFECT_LEGACY_PATTERN_HOLD',
  'RESOLVER_STANDARD_ENUM_GATE',
  'RESOLVER_THRESHOLD_SUBSTITUTION_PATTERN_MISS',
  'RESOLVER_MAE_CARVEOUT_PATTERN_MISS',
  'RESOLVER_MAE_CARVEOUT_PATTERN_OR_CODE_GAP',
  'RESOLVER_QUORUM_ABSENCE_LEXICAL_VARIANT',
  'RESOLVER_CONTROL_PARTY_CASE_NORMALISATION_GAP',
  'RESOLVER_TAX_CORROBORATION_PATTERN_MISS',
]);
const CORRECT_ABSTENTION_MECHANISMS = new Set([
  'CORRECT_ABSTENTION_BRING_DOWN_FRAGMENT_WITHOUT_SUBJECT',
  'CORRECT_ABSTENTION_FRUSTRATION_FRAGMENT_WITHOUT_RELIANCE_CHAPEAU',
  'CORRECT_ABSTENTION_PARTYLESS_BURDENSOME_FRAGMENT',
  'CORRECT_ABSTENTION_RATIO_QUOTE_WITHOUT_EXCHANGE_OPERATION',
  'CORRECT_ABSTENTION_PASSIVE_MEETING_CONTROL',
  'CORRECT_ABSTENTION_RELATIVE_DEADLINE',
  'CORRECT_ABSTENTION_INTERPRETIVE_ANNIVERSARY',
  'CORRECT_ABSTENTION_CROSS_FAMILY_LINKED_EVIDENCE',
  'CORRECT_ABSTENTION_LONG_TAIL_RESTRICTION',
  'CORRECT_ABSTENTION_UNSUPPORTED_SECTION_355_TREATMENT',
]);
const D_TAXONOMY_MECHANISMS = new Set([
  'TAXONOMY_DEFINED_APPROVAL_TERM_REQUIRES_DEFINITION_LINK',
  'TAXONOMY_GENERAL_COVENANT_DEFINITION_LINK_UNGOVERNED',
  'TAXONOMY_MUTUAL_GENERAL_COVENANT_PARTY_UNGOVERNED',
]);
const BEN_TAXONOMY_MECHANISMS = new Set([
  'TAXONOMY_BUYER_MAE_CONDITION_UNGOVERNED',
  'TAXONOMY_CITED_CONSIDERATION_VALUE_REQUIRES_CROSS_REFERENCE',
  'TAXONOMY_GAP_HOUR_NOTICE_PERIOD',
  'TAXONOMY_GAP_INTENDED_TREATMENT_CODEBOOK',
]);

function readJson(path) { return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function assertion(condition, message) { if (!condition) throw new Error(message); }
function countBy(rows, valueFor) {
  const counts = new Map();
  for (const row of rows) {
    const value = valueFor(row);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}
function owner(step, rationale, supportingSteps = []) {
  return Object.freeze({
    disposition: 'IMPLEMENTATION_OWNED',
    primary_owner: step,
    supporting_owners: Object.freeze(supportingSteps),
    implementation_required: true,
    rationale,
  });
}
function correctAbstention(rationale) {
  return Object.freeze({
    disposition: 'CORRECT_ABSTENTION', primary_owner: 'CORRECT_ABSTENTION',
    supporting_owners: Object.freeze([]), implementation_required: false, rationale,
  });
}
function benDecision(rationale) {
  return Object.freeze({
    disposition: 'BEN_DECISION_REQUIRED', primary_owner: 'BEN:TAXONOMY_OR_CODEBOOK',
    supporting_owners: Object.freeze([]), implementation_required: false, rationale,
  });
}

function dispositionFor(row) {
  const mechanism = row.mechanism_verdict;
  if (CORRECT_ABSTENTION_MECHANISMS.has(mechanism)) {
    return correctAbstention('The occurrence evidence classifies this refusal as correct; no recovery step may force it to resolve.');
  }
  if (row.fix_class === 'PROMPT_CHANGE') {
    return owner('2Y-L', 'The exact census classifies this occurrence as a producer or prompt defect; 2Y-L owns the single digest invalidation.');
  }
  if (row.fix_class === 'RESOLVER_SIDE') {
    if (A_MECHANISMS.has(mechanism)) return owner('2Y-A', 'The named mechanism requires verified governing context, antecedent context, structural reference context, or exact evidence placement.');
    if (B_MECHANISMS.has(mechanism)) return owner('2Y-B', 'The named mechanism is a corroboration-semantics defect, not a missing phrase.');
    if (D_MECHANISMS.has(mechanism)) return owner('2Y-D', 'The named mechanism requires agreement-local term, party, or approval reference resolution.', ['2Y-C']);
    if (C_MECHANISMS.has(mechanism)) return owner('2Y-C', 'The named mechanism is an enum, phrase, pattern, normalisation, or corroboration-vocabulary gap.', ['2Y-B']);
    throw new Error(`unowned resolver mechanism: ${mechanism}`);
  }
  if (row.fix_class === 'TAXONOMY_DESIGN') {
    if (D_TAXONOMY_MECHANISMS.has(mechanism)) return owner('2Y-D', 'The required governed meaning already exists in the agreement and needs a verified definition or party link.', ['2Y-C']);
    if (BEN_TAXONOMY_MECHANISMS.has(mechanism)) return benDecision('This occurrence requires a new legal taxonomy or codebook shape. Engineering may preserve the evidence but Ben owns the value decision.');
    throw new Error(`unowned taxonomy mechanism: ${mechanism}`);
  }
  if (row.fix_class === 'NO_FIX') throw new Error(`NO_FIX occurrence is not a recognised correct abstention: ${mechanism}`);
  throw new Error(`unknown fix class: ${row.fix_class}`);
}

function buildOwnershipLedger() {
  const register = readJson(REGISTER_PATH);
  const evidence = EVIDENCE_PATHS.map((path) => ({ path, value: readJson(path) }));
  const occurrences = evidence.flatMap(({ path, value }) => value.occurrences.map((row) => ({ ...row, ownership_source: path })))
    .sort((left, right) => left.id.localeCompare(right.id));
  assertion(occurrences.length === EXPECTED.occurrences, `occurrence count ${occurrences.length} != ${EXPECTED.occurrences}`);
  assertion(new Set(occurrences.map((row) => row.id)).size === occurrences.length, 'occurrence ids are not unique');
  const sourceFixable = occurrences.filter((row) => row.fix_class !== 'NO_FIX');
  assertion(sourceFixable.length === EXPECTED.source_fixable, `source fixable count ${sourceFixable.length} != ${EXPECTED.source_fixable}`);
  assertion(occurrences.length - sourceFixable.length === EXPECTED.no_fix, 'NO_FIX count drift');

  const registerByPair = new Map(register.rows.map((row) => [`${row.family}\u0000${row.reason_code}`, row]));
  const pairCounts = new Map();
  for (const row of occurrences) {
    const key = `${row.family}\u0000${row.reason_code}`;
    assertion(registerByPair.has(key), `occurrence pair is absent from register: ${row.family}/${row.reason_code}`);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of pairCounts) {
    assertion(registerByPair.get(key).count === count, `register count drift for ${key.replace('\u0000', '/')}`);
  }

  const rows = occurrences.map((row) => {
    const ownership = dispositionFor(row);
    return Object.freeze({
      occurrence_id: row.id,
      deal: row.deal,
      family: row.family,
      reason_code: row.reason_code,
      state: row.state,
      mechanism_verdict: row.mechanism_verdict,
      fix_class: row.fix_class,
      source_fixable: row.fix_class !== 'NO_FIX',
      ...ownership,
      evidence: Object.freeze({
        ownership_source: row.ownership_source,
        run_path: row.run_path || row.winning_run || null,
        resolution_entry_path: row.resolution_entry_path || null,
        section_reference: row.section_reference || null,
      }),
    });
  });
  const unowned = rows.filter((row) => row.implementation_required && !/^2Y-(?:A|B|C|D|E|F|G|H|I|J|L)$/.test(row.primary_owner));
  assertion(unowned.length === 0, `fixable occurrences are unowned: ${unowned.map((row) => row.occurrence_id).join(',')}`);
  assertion(rows.filter((row) => row.source_fixable).length === EXPECTED.source_fixable, 'source-fixable conservation failed');

  const body = {
    schema_version: SCHEMA_VERSION,
    generated_from: {
      evidence: evidence.map(({ path }) => ({ path, sha256: sha256(readFileSync(resolve(ROOT, path))) })),
      unresolved_register: { path: REGISTER_PATH, sha256: sha256(readFileSync(resolve(ROOT, REGISTER_PATH))) },
    },
    conservation: {
      occurrences: rows.length,
      source_fixable_occurrences: rows.filter((row) => row.source_fixable).length,
      source_no_fix_occurrences: rows.filter((row) => !row.source_fixable).length,
      implementation_required_occurrences: rows.filter((row) => row.implementation_required).length,
      unowned_fixable_occurrences: unowned.length,
    },
    counts: {
      by_fix_class: countBy(rows, (row) => row.fix_class),
      by_disposition: countBy(rows, (row) => row.disposition),
      by_primary_owner: countBy(rows, (row) => row.primary_owner),
    },
    occurrences: rows,
  };
  return Object.freeze({ ...body, ledger_digest: `sha256:${sha256(canonical(body))}` });
}

function renderLedger(ledger) { return `${JSON.stringify(ledger, null, 2)}\n`; }
function main() {
  const [mode] = process.argv.slice(2);
  assertion(['--write', '--check'].includes(mode) && process.argv.length === 3, 'usage: node scripts/stage-2y-k-ownership-ledger.mjs --write|--check');
  const ledger = buildOwnershipLedger();
  const output = renderLedger(ledger);
  const outputPath = resolve(ROOT, OUTPUT_PATH);
  if (mode === '--write') writeFileSync(outputPath, output);
  assertion(existsSync(outputPath), `${relative(ROOT, outputPath)} is missing`);
  assertion(readFileSync(outputPath, 'utf8') === output, `${relative(ROOT, outputPath)} is stale`);
  process.stdout.write(`${ledger.conservation.occurrences} occurrences; ${ledger.conservation.source_fixable_occurrences} source-fixable; ${ledger.conservation.unowned_fixable_occurrences} unowned\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { OUTPUT_PATH, SCHEMA_VERSION, buildOwnershipLedger, renderLedger };
