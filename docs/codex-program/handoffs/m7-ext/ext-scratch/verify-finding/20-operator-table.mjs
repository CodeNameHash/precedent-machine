'use strict';

/**
 * Q-0020: operator table for Ben. Authority cells are copied from the
 * repair plan §5.2 or the termination temporal Phase 1 overlay. Missing
 * cells are UNDEFINED. Examples are sha-verified real-text spans.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { sha256Hex } = require(resolve(repoRoot, 'lib/canonical-v2/canonical-bytes.js'));

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const INDEX_SET_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-index-set.json',
);
const PHASE1_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-temporal-phase1-authority.json',
);
const PLAN_PATH = resolve(
  repoRoot,
  'docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md',
);

const UNDEFINED = 'UNDEFINED';
const PLAN_SOURCE = 'docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md §5.2 (lines 459–469)';
const PHASE1_SOURCE = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-temporal-phase1-authority.json policy_overlay';

const OPERATORS = Object.freeze([
  {
    operator: 'ALL_OF',
    example_needles: ['each of the following', 'all of the following', 'both of the following'],
    plan_listed: true,
    serialisation: 'ALL_OF(child, …)',
  },
  {
    operator: 'ANY_OF',
    example_needles: ['any of the following', 'either of the following'],
    plan_listed: true,
    serialisation: 'ANY_OF(child, …)',
  },
  {
    operator: 'NOT',
    example_needles: [' shall not ', ' will not '],
    plan_listed: true,
    serialisation: 'NOT(child)',
  },
  {
    operator: 'IF_THEN',
    example_needles: ['If ', 'if the Company'],
    plan_listed: true,
    serialisation: 'IF_THEN(condition, consequent)',
  },
  {
    operator: 'EXCEPTION_TO',
    example_needles: ['except as', 'except that', 'provided that', 'provided, however'],
    plan_listed: true,
    serialisation: 'EXCEPTION_TO(base, exception)',
  },
  {
    operator: 'OVERRIDES',
    example_needles: ['notwithstanding'],
    plan_listed: true,
    serialisation: UNDEFINED,
  },
  {
    operator: 'DEEMS_AS',
    example_needles: ['shall be deemed', 'deemed to'],
    plan_listed: true,
    serialisation: UNDEFINED,
  },
  {
    operator: 'EARLIER_OF',
    example_needles: ['earlier of'],
    plan_listed: true,
    serialisation: 'EARLIER_OF(child, …)',
  },
  {
    operator: 'LATER_OF',
    example_needles: ['later of'],
    plan_listed: true,
    serialisation: 'LATER_OF(child, …)',
  },
  {
    operator: 'TO_EXTENT',
    example_needles: ['to the extent'],
    plan_listed: true,
    serialisation: UNDEFINED,
  },
  {
    operator: 'CONSEQUENCE_MODIFIER',
    example_needles: [],
    plan_listed: true,
    serialisation: UNDEFINED,
  },
  {
    operator: 'BEFORE',
    example_needles: ['prior to the Effective Time', 'prior to the'],
    plan_listed: false,
    serialisation: 'BEFORE(SUBJECT_EVENT, TEMPORAL_BOUNDARY)',
  },
  {
    operator: 'ON_OR_BEFORE',
    example_needles: ['on or before', 'on or prior to'],
    plan_listed: false,
    serialisation: 'ON_OR_BEFORE(SUBJECT_EVENT, TEMPORAL_BOUNDARY)',
  },
  {
    operator: 'OFFSET_AFTER',
    example_needles: ['Business Days after', 'days after'],
    plan_listed: false,
    serialisation: 'OFFSET_AFTER(ANCHOR, OFFSET_AMOUNT)',
  },
  {
    operator: 'OFFSET_BEFORE',
    example_needles: ['Business Days before', 'days prior to'],
    plan_listed: false,
    serialisation: 'OFFSET_BEFORE(ANCHOR, OFFSET_AMOUNT)',
  },
  {
    operator: 'CAPABLE',
    example_needles: ['incapable of being cured', 'capable of being cured'],
    plan_listed: false,
    serialisation: 'CAPABLE(TEST)',
  },
]);

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort(compareText)) out[key] = sortedObject(value[key]);
    return out;
  }
  return value;
}

function charIndexToByte(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function verifySlice(canonicalBytes, start, end) {
  if (!canonicalBytes || !Number.isInteger(start) || !Number.isInteger(end)) {
    return { start_byte: start ?? null, end_byte: end ?? null, text_sha256: null, verified: false };
  }
  if (start < 0 || end < start || end > canonicalBytes.length) {
    return { start_byte: start, end_byte: end, text_sha256: null, verified: false };
  }
  return {
    start_byte: start,
    end_byte: end,
    text_sha256: sha256Hex(canonicalBytes.subarray(start, end)),
    verified: true,
  };
}

function childRolesFromContract(contract) {
  if (!contract) return UNDEFINED;
  return (contract.allowed_child_contracts ?? []).map((child) => ({
    allowed_child_kinds: child.allowed_child_kinds ?? null,
    allowed_expression_result_kinds: child.allowed_expression_result_kinds ?? null,
    allowed_fact_value_kinds: child.allowed_fact_value_kinds ?? null,
    role: child.role ?? null,
  }));
}

function findExample(agreements, needles) {
  for (const needle of needles) {
    for (const agreement of agreements) {
      const index = agreement.text.indexOf(needle);
      if (index < 0) continue;
      const start = charIndexToByte(agreement.text, index);
      const end = start + Buffer.byteLength(needle, 'utf8');
      const span = verifySlice(agreement.bytes, start, end);
      return {
        agreement_id: agreement.agreement_id,
        needle,
        span,
        text: needle,
      };
    }
  }
  return null;
}

function main() {
  const missing = [];
  for (const required of [INDEX_SET_PATH, PHASE1_PATH, PLAN_PATH]) {
    if (!existsSync(required)) missing.push(required);
  }
  if (missing.length > 0) {
    process.stderr.write(`${JSON.stringify({ error: 'missing', missing }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const planText = readFileSync(PLAN_PATH, 'utf8');
  const planHasVocabulary = /The minimum V2 operator vocabulary is:/.test(planText);
  const phase1 = loadJson(PHASE1_PATH);
  const overlay = phase1.policy_overlay ?? {};
  const newContracts = new Map(
    (overlay.new_operator_contracts ?? []).map((row) => [row.operator, row]),
  );
  const earlierOf = (overlay.existing_operator_extensions ?? [])
    .find((row) => row.base_operator === 'EARLIER_OF') ?? null;

  const indexSet = loadJson(INDEX_SET_PATH);
  const agreements = [];
  for (const member of indexSet.members ?? []) {
    if (typeof member?.path !== 'string') continue;
    const abs = resolve(repoRoot, member.path);
    if (!existsSync(abs)) continue;
    const record = loadJson(abs);
    const text = record?.source_binding?.canonical_text;
    const agreementId = record?.source_binding?.agreement_id;
    if (typeof text !== 'string' || typeof agreementId !== 'string') continue;
    agreements.push({ agreement_id: agreementId, text, bytes: Buffer.from(text, 'utf8') });
  }
  agreements.sort((left, right) => compareText(left.agreement_id, right.agreement_id));

  let shaVerified = 0;
  const rows = [];
  for (const spec of OPERATORS) {
    const contract = newContracts.get(spec.operator) ?? null;
    const fromPhase1 = Boolean(contract) || spec.operator === 'EARLIER_OF';
    const definition = contract?.semantics
      ?? (spec.operator === 'BEFORE' && contract ? 'STRICT temporal relation' : null)
      ?? (spec.operator === 'ON_OR_BEFORE' && contract ? 'INCLUSIVE temporal relation' : null)
      ?? (spec.operator === 'EARLIER_OF' && earlierOf
        ? `Phase 1 extends allowed fact value kinds to ${earlierOf.resulting_allowed_fact_value_kinds.join(', ')}; otherwise byte semantics unchanged`
        : null)
      ?? (spec.plan_listed
        ? 'Listed in the §5.2 minimum vocabulary. The plan states that each operator has fixed arity, child types, order, precedence, scope and serialisation, but does not specify those fields per operator.'
        : UNDEFINED);
    const example = findExample(agreements, spec.example_needles);
    if (example?.span.verified) shaVerified += 1;
    rows.push({
      arity: contract?.arity ?? UNDEFINED,
      canonical_serialisation: spec.serialisation,
      child_roles_and_types: childRolesFromContract(contract),
      definition: definition ?? UNDEFINED,
      example,
      operator: spec.operator,
      precedence: UNDEFINED,
      scope_rule: contract?.result_kind
        ? `result_kind=${contract.result_kind}${contract.relation ? `; relation=${contract.relation}` : ''}${contract.ordered ? '; ordered children' : ''}`
        : UNDEFINED,
      source: fromPhase1 && contract
        ? PHASE1_SOURCE
        : spec.operator === 'EARLIER_OF'
          ? `${PLAN_SOURCE}; ${PHASE1_SOURCE} existing_operator_extensions`
          : spec.plan_listed
            ? PLAN_SOURCE
            : PHASE1_SOURCE,
    });
  }

  const tablePayload = sortedObject({ rows });
  const tableSha = sha256Hex(Buffer.from(`${JSON.stringify(tablePayload, null, 2)}\n`, 'utf8'));
  const report = sortedObject({
    schema: 'Q-0020-OPERATOR-TABLE/V1',
    plan_vocabulary_present: planHasVocabulary,
    phase1_authority_id: phase1.temporal_phase1_authority_id ?? null,
    counts: {
      operators: rows.length,
      sha_verified_example_spans: shaVerified,
      undefined_arity: rows.filter((row) => row.arity === UNDEFINED).length,
    },
    table_sha256: tableSha,
    rows,
  });

  writeFileSync(resolve(OUT_DIR, '20-operator-table.json'), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# Operator table (Q-0020)',
    '',
    'Authority cells are copied from the repair plan §5.2 minimum vocabulary or the termination temporal Phase 1 overlay. Where those records do not specify a field, the cell is `UNDEFINED` for Ben. Examples are the first sha-verified occurrence of a connective phrase in the ten Work 3 canonical texts.',
    '',
    '| Operator | Arity | Child roles / types | Precedence | Scope | Serialisation | Source | Example |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const roles = row.child_roles_and_types === UNDEFINED
      ? UNDEFINED
      : row.child_roles_and_types.map((child) => child.role).join(', ');
    const example = row.example?.span.verified
      ? `\`${row.example.text}\` ${row.example.agreement_id.slice(0, 12)} ${row.example.span.start_byte}–${row.example.span.end_byte}`
      : '—';
    lines.push(
      `| ${row.operator} | ${row.arity} | ${roles} | ${row.precedence} | ${row.scope_rule} | ${row.canonical_serialisation} | ${row.source.includes('phase1') || row.source.includes('temporal') ? 'phase-1 temporal' : 'plan §5.2'} | ${example} |`,
    );
  }
  lines.push('', '## Definitions copied from the authorities', '');
  for (const row of rows) {
    lines.push(`- **${row.operator}**: ${row.definition}`);
  }
  writeFileSync(resolve(OUT_DIR, '20-OPERATOR-TABLE.md'), `${lines.join('\n')}\n`);
  const out = [
    `operators ${rows.length}`,
    `undefined_arity ${report.counts.undefined_arity}`,
    `sha_verified_example_spans ${shaVerified}`,
    `table_sha256 ${tableSha}`,
    `plan_vocabulary_present ${planHasVocabulary}`,
  ];
  writeFileSync(resolve(OUT_DIR, '20-operator-table.out'), `${out.join('\n')}\n`);
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
