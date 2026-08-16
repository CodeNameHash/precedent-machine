#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const PREPARATION_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m5-preparation.json');
const M4_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m4-agreement-analysis.json');
const PROPOSAL_ROOT = resolve(ROOT, 'preparation/m5/proposed-role-schemas');
const PACK_ROOT = resolve(ROOT, 'preparation/m5/calibration-packs');
const SCHEMA_ROOT = resolve(ROOT, 'control/family-role-schemas');
const AUTHORITY_ROOT = resolve(ROOT, 'control/family-execution-authorities');
const RULING_PATH = resolve(ROOT, 'control/m5-programme-rulings.json');
const RECEIPT_PATH = resolve(ROOT, 'receipts/stage-2y-structure-m5-schema-approval.json');
const APPROVAL_ID = 'BEN_M5_PROGRAMME_RULES_2026_08_12';
const APPROVED_AT = '2026-08-12T14:26:04.000Z';
const APPROVER = 'BEN_GOODCHILD';

const REQUIRED_PROHIBITIONS = [
  'NO_RUNNER_INPUT',
  'NO_COMPLETE_TRANSITION',
  'NO_RENDERING',
  'NO_APPROVAL_INFERENCE',
  'NO_RAW_SOURCE_REPARSE',
  'NO_PROJECTION_ROLE_FILL',
  'NO_CROSS_FAMILY_CONTENT_DUPLICATION',
];

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M5_APPROVE:${code}: ${detail}`);
}

function repoPath(path) {
  const value = relative(REPO_ROOT, path).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', path);
  return value;
}

function bytes(path) {
  return readFileSync(path);
}

function json(path) {
  return JSON.parse(bytes(path));
}

function binding(path, extra = {}) {
  const value = bytes(path);
  return { path: repoPath(path), byte_length: value.length, sha256: sha256Hex(value), ...extra };
}

function unsigned(value, ...members) {
  const copy = structuredClone(value);
  for (const member of members) delete copy[member];
  return copy;
}

function writeCanonical(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${canonicalJson(value)}\n`);
}

function rulingRecord() {
  const rulings = [
    {
      programme_question_id: 'PROGRAMME-Q01',
      ruling_id: 'M5-RULING-ONE-OPERATIVE-LIMB',
      selection: 'ONE_COMPOUND_PROPOSITION',
      legal_rule: 'Each independently operative authored limb is one proposition. Each limb retains its own standard, conditions and exceptions.',
      user_note: 'Each limb has its own standard. Each limb should track its own standard.',
    },
    {
      programme_question_id: 'PROGRAMME-Q02',
      ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER',
      selection: 'ONE_OWNER_WITH_LINKED_CONSUMERS',
      legal_rule: 'Save each legal fact once under its proper family. Other families may display that fact through a stable link.',
      user_note: 'Agreed after clarification that this concerns duplicate storage across families, not separate limb standards.',
    },
    {
      programme_question_id: 'PROGRAMME-Q03',
      ruling_id: 'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
      selection: 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION',
      legal_rule: 'Do not infer a required role from missing or ambiguous support. Fail and flag only the dependent proposition.',
      user_note: 'Flag the absence or ambiguity.',
    },
  ];
  const record = {
    schema_version: 'STAGE_2Y_M5_PROGRAMME_RULINGS/V1',
    ruling_record_id: null,
    approval_id: APPROVAL_ID,
    approver: APPROVER,
    approved_at: APPROVED_AT,
    scope: 'ALL_25_REGISTERED_FAMILIES',
    authoritative_for_stage: 'M5',
    rulings,
    limitations: {
      m6_authorised: false,
      product_treatment_changed: false,
      capitalisation_unparked: false,
      model_calls_authorised: false,
    },
  };
  record.ruling_record_id = contentId(record.schema_version, unsigned(record, 'ruling_record_id'));
  return record;
}

function approvedSchema(familyKey, proposal, proposalPath, packPath, rulingBinding) {
  const generatedClaimKeys = proposal.claim_definition_scope.included_claim_definition_keys.length === 0
    ? proposal.subtype_profiles.map((profile) => profile.profile_id.replace('::', '_'))
    : null;
  const schema = {
    schema_version: 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1',
    family_role_schema_id: null,
    payload_digest: null,
    family_key: familyKey,
    role_schema_version: proposal.role_schema_version,
    approval_state: 'BEN_APPROVED_AND_SEALED',
    approval_id: APPROVAL_ID,
    approver: APPROVER,
    approved_at: APPROVED_AT,
    source_proposal_binding: binding(proposalPath),
    calibration_pack_binding: binding(packPath),
    ruling_bindings: [
      { ...rulingBinding, ruling_id: 'M5-RULING-ONE-OPERATIVE-LIMB', question_id: `${familyKey}-Q01`, approval_id: APPROVAL_ID, approver: APPROVER },
      { ...rulingBinding, ruling_id: 'M5-RULING-ONE-SEMANTIC-OWNER', question_id: `${familyKey}-Q02`, approval_id: APPROVAL_ID, approver: APPROVER },
      { ...rulingBinding, ruling_id: 'M5-RULING-FAIL-DEPENDENT-PROPOSITION', question_id: `${familyKey}-Q03`, approval_id: APPROVAL_ID, approver: APPROVER },
    ],
    claim_definition_scope: {
      ...structuredClone(proposal.claim_definition_scope),
      included_claim_definition_keys: generatedClaimKeys || structuredClone(proposal.claim_definition_scope.included_claim_definition_keys),
    },
    subtype_profiles: proposal.subtype_profiles.map((profile, index) => ({
      ...structuredClone(profile),
      claim_definition_keys: profile.claim_definition_keys.length === 0 ? [generatedClaimKeys[index]] : structuredClone(profile.claim_definition_keys),
      unresolved_legal_question_ids: [],
    })),
    cross_family_dependencies: structuredClone(proposal.cross_family_dependencies),
    prohibitions: [...REQUIRED_PROHIBITIONS],
  };
  const payload = unsigned(schema, 'family_role_schema_id', 'payload_digest');
  schema.payload_digest = sha256Hex(canonicalJson(payload));
  schema.family_role_schema_id = contentId(schema.schema_version, { ...payload, payload_digest: schema.payload_digest });
  return schema;
}

function executionAuthority(familyKey, schema, schemaBytes) {
  const authority = {
    schema_version: 'STAGE_2Y_M5_FAMILY_EXECUTION_AUTHORITY/V1',
    authority_digest: null,
    authority_state: 'ACTIVE_FOR_ONE_APPROVED_FAMILY_SHADOW_COMPARISON',
    stage: 'M5',
    family_key: familyKey,
    approval_id: APPROVAL_ID,
    approver: APPROVER,
    approved_role_schema_binding: {
      path: `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/${familyKey}.json`,
      byte_length: schemaBytes.length,
      sha256: sha256Hex(schemaBytes),
      schema_version: schema.schema_version,
      family_key: familyKey,
      family_role_schema_id: schema.family_role_schema_id,
      payload_digest: schema.payload_digest,
      approval_id: APPROVAL_ID,
    },
  };
  authority.authority_digest = sha256Hex(canonicalJson(unsigned(authority, 'authority_digest')));
  return authority;
}

function main() {
  const preparation = json(PREPARATION_RECEIPT);
  const m4 = json(M4_RECEIPT);
  if (preparation.status !== 'PASS_PREPARATION_ONLY'
    || preparation.lifecycle_state !== 'SEALED_PREPARATION_ONLY'
    || preparation.metrics.family_count !== 25
    || preparation.metrics.open_legal_question_count !== 75) {
    fail('PREPARATION_RECEIPT_INVALID', preparation.status);
  }
  if (m4.stage !== 'M4' || m4.status !== 'PASS' || m4.lifecycle_state !== 'SEALED') {
    fail('M4_RECEIPT_INVALID', m4.status);
  }

  writeCanonical(RULING_PATH, rulingRecord());
  const rulingBinding = binding(RULING_PATH);
  const schemaBindings = [];
  const authorityBindings = [];

  for (const family of preparation.family_order) {
    const familyKey = family.family_key;
    const proposalPath = resolve(PROPOSAL_ROOT, `${familyKey}.json`);
    const packPath = resolve(PACK_ROOT, `${familyKey}.json`);
    const proposal = json(proposalPath);
    if (proposal.status !== 'PROPOSED_AWAITING_BEN_APPROVAL'
      || proposal.family_key !== familyKey
      || proposal.open_legal_question_ids.length !== 3) {
      fail('PROPOSAL_INVALID', familyKey);
    }
    const schema = approvedSchema(familyKey, proposal, proposalPath, packPath, rulingBinding);
    const schemaPath = resolve(SCHEMA_ROOT, `${familyKey}.json`);
    writeCanonical(schemaPath, schema);
    const schemaBytes = bytes(schemaPath);
    const authority = executionAuthority(familyKey, schema, schemaBytes);
    const authorityPath = resolve(AUTHORITY_ROOT, `${familyKey}.json`);
    writeCanonical(authorityPath, authority);
    schemaBindings.push(binding(schemaPath, { family_key: familyKey, family_role_schema_id: schema.family_role_schema_id, payload_digest: schema.payload_digest }));
    authorityBindings.push(binding(authorityPath, { family_key: familyKey, authority_digest: authority.authority_digest }));
  }

  const receipt = {
    schema_version: 'STAGE_2Y_M5_SCHEMA_APPROVAL_RECEIPT/V1',
    receipt_id: null,
    stage: 'M5',
    lifecycle_state: 'SEALED',
    status: 'PASS',
    approval_id: APPROVAL_ID,
    approver: APPROVER,
    approved_at: APPROVED_AT,
    preparation_receipt_binding: binding(PREPARATION_RECEIPT, { receipt_id: preparation.receipt_id }),
    m4_receipt_binding: binding(M4_RECEIPT, { output_set_digest: m4.output_set_digest }),
    programme_ruling_binding: { ...rulingBinding, ruling_record_id: json(RULING_PATH).ruling_record_id },
    approved_role_schema_bindings: schemaBindings,
    family_execution_authority_bindings: authorityBindings,
    metrics: { family_count: 25, approved_role_schema_count: 25, ruling_count: 3, runner_eligible_family_count: 25 },
    effects: { model_calls: 0, product_writes: 0, serving_changes: 0, selector_changes: 0, m6_outputs: 0 },
  };
  receipt.receipt_id = contentId(receipt.schema_version, unsigned(receipt, 'receipt_id'));
  writeCanonical(RECEIPT_PATH, receipt);
  process.stdout.write(`${canonicalJson({ status: 'PASS', receipt: repoPath(RECEIPT_PATH), receipt_id: receipt.receipt_id, approved_role_schema_count: 25 })}\n`);
}

main();
