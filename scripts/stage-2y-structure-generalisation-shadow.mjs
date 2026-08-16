#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { indexAgreement } = require('../lib/canonical-v2/agreement-index');
const { compileContext } = require('../lib/canonical-v2/context-compilation');
const { adaptCompoundFamily, policyForFamily } = require('../lib/canonical-v2/family-compound-adapter');
const { projectAgreement } = require('../lib/canonical-v2/agreement-projection');
const {
  applyAmbiguityGate,
  applySelectionModeGate,
  buildBaseAnalysis,
  deriveSemanticPolicy,
  selectFamilySections,
} = require('../lib/canonical-v2/m7-deterministic-generalisation');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const REQUIRED_ARGS = new Set(['--authority', '--agreement-manifest', '--output-root']);

function argsFrom(argv) {
  if (argv.length !== 6) throw new Error('exactly three named arguments are required');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!REQUIRED_ARGS.has(key) || result[key]) throw new Error(`invalid argument: ${key}`);
    result[key] = argv[index + 1];
  }
  if (Object.keys(result).length !== 3) throw new Error('argument set mismatch');
  return result;
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function fileBinding(relativePath) {
  const bytes = fs.readFileSync(absolute(relativePath));
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function writeJson(relativePath, value) {
  const bytes = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), bytes);
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function validateAuthority(authority) {
  const unsigned = structuredClone(authority);
  const correctionSchemas = [
    'STAGE_2Y_M7_ROW_CORRECTION_AUTHORITY/V1',
    'STAGE_2Y_M7_COMPARISON_ENTRY_CORRECTION_AUTHORITY/V1',
  ];
  const idKey = correctionSchemas.includes(authority.schema_version)
    ? 'correction_authority_id'
    : 'authority_digest';
  delete unsigned[idKey];
  if (!['STAGE_2Y_M7_GENERALISATION_AUTHORITY/V1', ...correctionSchemas].includes(authority.schema_version)
    || authority.authority_state !== 'BEN_AUTHORISED_REPORT_ONLY'
    || contentId(authority.schema_version, unsigned) !== authority[idKey]
    || authority.limits.model_call_count !== 0
    || authority.prohibited_effects.length === 0) {
    throw new Error('M7 authority mismatch');
  }
  for (const input of authority.input_bindings) {
    if (canonicalJson(fileBinding(input.path)) !== canonicalJson(input)) {
      throw new Error(`authority input drift: ${input.path}`);
    }
  }
}

function updateAdapterForGates(index, selectedInputs, result) {
  const propositions = applySelectionModeGate(
    selectedInputs,
    applyAmbiguityGate(index, result.propositions),
  );
  const stateByClaim = new Map(propositions.flatMap((proposition) =>
    proposition.member_analysis_claim_ids.map((id) => [id, proposition])));
  const memberLedger = result.member_ledger.map((entry) => {
    const proposition = stateByClaim.get(entry.analysis_claim_id);
    return {
      ...entry,
      compound_proposition_id: proposition.compound_proposition_id,
      disposition: proposition.proposition_validation_state === 'COMPLETE'
        ? 'ABSORBED_IN_COMPLETE_PROPOSITION'
        : 'MISSING_REQUIRED_ROLE',
      missing_required_roles: proposition.missing_required_roles,
    };
  });
  const unsigned = {
    ...result,
    propositions,
    member_ledger: memberLedger,
    complete_proposition_count: propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length,
    incomplete_proposition_count: propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length,
  };
  delete unsigned.compound_adapter_result_id;
  delete unsigned.schema_version;
  return {
    schema_version: 'STAGE_2Y_M5_COMPOUND_ADAPTER_RESULT/V1',
    compound_adapter_result_id: contentId('STAGE_2Y_M5_COMPOUND_ADAPTER_RESULT/V1', unsigned),
    ...unsigned,
  };
}

function correctedAnalysis(baseAnalysis, familyResults) {
  const propositions = familyResults.flatMap((entry) => entry.propositions)
    .sort((left, right) => left.family_key.localeCompare(right.family_key)
      || left.compound_proposition_id.localeCompare(right.compound_proposition_id));
  const result = structuredClone(baseAnalysis);
  result.compound_propositions = propositions;
  result.m5_correction = {
    schema_version: 'STAGE_2Y_M5_ANALYSIS_CORRECTION/V1',
    semantic_projection_collection: 'compound_propositions',
    old_claim_disposition: 'MEMBER_FACTS_ONLY',
    incomplete_projection_rule: 'REVIEW_ONLY_NOT_NORMAL_ROW',
    ambiguity_rule: 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION_AND_FLAG_THE_REASON',
    model_call_count: 0,
  };
  result.counts = {
    ...result.counts,
    compound_propositions: propositions.length,
    complete_compound_propositions: propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length,
    incomplete_compound_propositions: propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length,
  };
  delete result.agreement_analysis_id;
  result.agreement_analysis_id = contentId('AGREEMENT_ANALYSIS/V1', result);
  return result;
}

const args = argsFrom(process.argv.slice(2));
const authorityPath = args['--authority'];
const manifestPath = args['--agreement-manifest'];
const outputRoot = args['--output-root'];
const rowCorrectionMode = authorityPath === `${BASE}/control/m7-row-correction-authority.json`
  && manifestPath === `${BASE}/control/m7-generalisation-cohort-row-correction.json`
  && outputRoot === `${BASE}/shadow/m7-generalisation-row-correction`;
const comparisonEntryCorrectionMode = authorityPath === `${BASE}/control/m7-comparison-entry-correction-authority.json`
  && manifestPath === `${BASE}/control/m7-generalisation-cohort-comparison-entry-correction.json`
  && outputRoot === `${BASE}/shadow/m7-generalisation-comparison-entry-correction`;
const correctionMode = rowCorrectionMode || comparisonEntryCorrectionMode;
const originalMode = authorityPath === `${BASE}/control/m7-generalisation-authority.json`
  && manifestPath === `${BASE}/control/m7-generalisation-cohort.json`
  && outputRoot === `${BASE}/shadow/m7-generalisation`;
if (!correctionMode && !originalMode) {
  throw new Error('governed M7 path mismatch');
}
const RECEIPT_PATH = `${BASE}/receipts/stage-2y-structure-m7-generalisation${comparisonEntryCorrectionMode
  ? '-comparison-entry-correction'
  : rowCorrectionMode ? '-row-correction' : ''}.json`;

const authority = readJson(authorityPath);
validateAuthority(authority);
const manifest = readJson(manifestPath);
const structuralPolicy = readJson(`${BASE}/control/structural-policy.json`);
const baseSemanticPolicy = readJson(`${BASE}/control/semantic-policy.json`);
const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`).family_order_contract.families;
const viewPolicy = readJson(`${BASE}/control/m6-view-policy.json`);
if (manifest.schema_version !== 'STAGE_2Y_M7_GENERALISATION_COHORT/V1'
  || manifest.agreements.length !== 3
  || manifest.registered_family_count !== 25) {
  throw new Error('M7 cohort mismatch');
}

const allBindings = [];
const agreementResults = [];
const openWorldMembers = [];
const ambiguityMembers = [];

for (const agreement of manifest.agreements) {
  const canonicalBinding = fileBinding(agreement.canonical_source_binding.path);
  const rawBinding = fileBinding(agreement.raw_source_binding.path);
  if (canonicalJson(canonicalBinding) !== canonicalJson(agreement.canonical_source_binding)
    || canonicalJson(rawBinding) !== canonicalJson(agreement.raw_source_binding)) {
    throw new Error(`cohort source drift: ${agreement.candidate_key}`);
  }
  const canonicalText = fs.readFileSync(absolute(canonicalBinding.path), 'utf8');
  const index = indexAgreement({
    agreement_id: agreement.agreement_id,
    deal: agreement.candidate_key,
    canonical_text: canonicalText,
    canonical_text_id: agreement.canonical_text_id,
    canonical_text_sha256: canonicalBinding.sha256,
    immutable_source_document_id: agreement.immutable_source_document_id,
    raw_source_sha256: rawBinding.sha256,
    raw_source_byte_length: rawBinding.byte_length,
    source_path: canonicalBinding.path,
    source_bindings: {
      governed_deal_key: agreement.governed_deal_key,
      source_admission_manifest_id: agreement.source_admission_manifest_id,
    },
  }, structuralPolicy);
  const agreementRoot = `${outputRoot}/${agreement.candidate_key}`;
  const indexPath = `${agreementRoot}/m2/agreement-index.json`;
  const indexBytes = Buffer.from(`${canonicalJson(index)}\n`, 'utf8');
  const indexBinding = writeJson(indexPath, index);
  const selectedInputs = selectFamilySections(index, familyOrder);
  if (canonicalJson(selectedInputs) !== canonicalJson(agreement.family_input_states)) {
    throw new Error(`family input state drift: ${agreement.candidate_key}`);
  }

  const derived = deriveSemanticPolicy(baseSemanticPolicy, index, indexPath, indexBytes);
  const semanticPolicyPath = `${agreementRoot}/m3/derived-semantic-policy.json`;
  const semanticPolicyBinding = writeJson(semanticPolicyPath, derived.policy);
  const context = compileContext(derived.focusNodeIds, index, derived.policy);
  const contextBinding = writeJson(`${agreementRoot}/m3/context-compilation.json`, context);
  const baseAnalysis = buildBaseAnalysis(index, context, selectedInputs);
  const baseAnalysisBinding = writeJson(`${agreementRoot}/m4/agreement-analysis.json`, baseAnalysis);

  const familyResults = [];
  for (const family of familyOrder) {
    const policy = policyForFamily(family.family_key, family.wave);
    const rawResult = adaptCompoundFamily(baseAnalysis, index, context, policy);
    const result = updateAdapterForGates(index, selectedInputs, rawResult);
    familyResults.push(result);
    allBindings.push(writeJson(`${agreementRoot}/m5/families/${String(family.ordinal).padStart(2, '0')}-${family.family_key}.json`, result));
  }
  const analysis = correctedAnalysis(baseAnalysis, familyResults);
  const analysisBinding = writeJson(`${agreementRoot}/m5/agreement-analysis.json`, analysis);
  const projection = projectAgreement(analysis, viewPolicy);
  const projectionBinding = writeJson(`${agreementRoot}/m6/agreement-projection.json`, projection);
  if (projection.counts.normal_row_count < 1) {
    throw new Error(`M7_NO_COMPLETE_END_TO_END_PROPOSITION: ${agreement.candidate_key}`);
  }

  for (const input of selectedInputs.filter((entry) => entry.state !== 'RECORDED_INPUT_BINDING')) {
    const member = {
      agreement_id: agreement.agreement_id,
      candidate_key: agreement.candidate_key,
      family_key: input.family_key,
      baseline_state: 'NO_LEGACY_BASELINE',
      reason_code: input.state,
      dependent_claim_state: 'NO_CLAIM_CREATED',
    };
    openWorldMembers.push({
      schema_version: 'STAGE_2Y_M7_OPEN_WORLD_OCCURRENCE/V1',
      open_world_occurrence_id: contentId('STAGE_2Y_M7_OPEN_WORLD_OCCURRENCE/V1', member),
      ...member,
    });
  }
  for (const ambiguity of index.ambiguities) {
    const member = {
      agreement_id: agreement.agreement_id,
      candidate_key: agreement.candidate_key,
      ambiguity,
      dependent_compound_proposition_ids: analysis.compound_propositions
        .filter((entry) => entry.diagnostic_codes.includes('M2_STRUCTURE_AMBIGUITY_DEPENDENCY'))
        .map((entry) => entry.compound_proposition_id),
      reviewed_disposition: 'OPEN_REQUIRES_LAWYER_REVIEW',
    };
    ambiguityMembers.push({
      schema_version: 'STAGE_2Y_M7_ADDITIVE_AMBIGUITY/V1',
      additive_ambiguity_id: contentId('STAGE_2Y_M7_ADDITIVE_AMBIGUITY/V1', member),
      ...member,
    });
  }

  allBindings.push(indexBinding, semanticPolicyBinding, contextBinding, baseAnalysisBinding, analysisBinding, projectionBinding);
  agreementResults.push({
    candidate_key: agreement.candidate_key,
    agreement_id: agreement.agreement_id,
    governed_deal_key: agreement.governed_deal_key,
    agreement_index_id: index.agreement_index_id,
    context_compilation_id: context.context_compilation_id,
    agreement_analysis_id: analysis.agreement_analysis_id,
    agreement_projection_id: projection.agreement_projection_id,
    family_input_states: selectedInputs,
    counts: {
      focus_nodes: derived.focusNodeIds.length,
      m2_ambiguities: index.ambiguities.length,
      source_claims: baseAnalysis.claims.length,
      complete_propositions: analysis.counts.complete_compound_propositions,
      incomplete_propositions: analysis.counts.incomplete_compound_propositions,
      normal_rows: projection.counts.normal_row_count,
      review_rows: projection.counts.review_row_count,
    },
    baseline_state: 'NO_LEGACY_BASELINE',
  });
}

openWorldMembers.sort((left, right) => left.open_world_occurrence_id.localeCompare(right.open_world_occurrence_id));
ambiguityMembers.sort((left, right) => left.additive_ambiguity_id.localeCompare(right.additive_ambiguity_id));
agreementResults.sort((left, right) => left.candidate_key.localeCompare(right.candidate_key));
allBindings.sort((left, right) => left.path.localeCompare(right.path));

const ambiguityLedger = {
  schema_version: 'STAGE_2Y_M7_ADDITIVE_AMBIGUITY_LEDGER/V1',
  combined_corpus_state: 'ADDITIVE_THREE_ONLY_PENDING_CORPUS_AUDIT',
  members: ambiguityMembers,
  count: ambiguityMembers.length,
};
ambiguityLedger.ledger_id = contentId(ambiguityLedger.schema_version, ambiguityLedger);
const ambiguityBinding = writeJson(`${outputRoot}/ambiguity-ledger.json`, ambiguityLedger);

const openWorldLedger = {
  schema_version: 'STAGE_2Y_M7_ADDITIVE_OPEN_WORLD_LEDGER/V1',
  baseline_rule: 'NO_LEGACY_BASELINE_NOT_A_MIGRATION_INCREASE',
  members: openWorldMembers,
  total: openWorldMembers.length,
  counts_by_family: Object.fromEntries(familyOrder.map((family) => [
    family.family_key,
    openWorldMembers.filter((entry) => entry.family_key === family.family_key).length,
  ])),
};
openWorldLedger.ledger_id = contentId(openWorldLedger.schema_version, openWorldLedger);
const openWorldBinding = writeJson(`${outputRoot}/additive-open-world.json`, openWorldLedger);

const sealedReceiptPaths = [
  `${BASE}/receipts/stage-2y-structure-m2-agreement-index.json`,
  `${BASE}/receipts/stage-2y-structure-m3-context-compilation.json`,
  `${BASE}/receipts/stage-2y-structure-m5-family-adapters-correction.json`,
  `${BASE}/receipts/stage-2y-structure-m6-agreement-projection${comparisonEntryCorrectionMode
    ? '-comparison-entry-correction'
    : rowCorrectionMode ? '-row-correction' : ''}.json`,
];
const sealedReceiptBindings = sealedReceiptPaths.map(fileBinding);
const sealedSevenDigest = contentId('STAGE_2Y_M7_SEALED_SEVEN_DIGEST/V1', sealedReceiptBindings);
const combinedCorpusDigest = contentId('STAGE_2Y_M7_COMBINED_TEN_CORPUS/V1', {
  sealed_seven_digest: sealedSevenDigest,
  additive_agreement_ids: agreementResults.map((entry) => entry.agreement_id).sort(),
});
const generalisation = {
  schema_version: 'STAGE_2Y_M7_GENERALISATION_RESULT/V1',
  stage: comparisonEntryCorrectionMode
    ? 'M7_COMPARISON_ENTRY_CORRECTION'
    : rowCorrectionMode ? 'M7_ROW_CORRECTION' : 'M7',
  status: 'PASS_ADDITIVE_ENTRY',
  authority_binding: fileBinding(authorityPath),
  cohort_binding: fileBinding(manifestPath),
  source_admission_receipt_binding: fileBinding(`${BASE}/receipts/stage-2y-structure-m7-source-admission.json`),
  sealed_receipt_bindings: sealedReceiptBindings,
  sealed_seven_digest: sealedSevenDigest,
  combined_ten_corpus_digest: combinedCorpusDigest,
  agreement_results: agreementResults,
  output_bindings: [...allBindings, ambiguityBinding, openWorldBinding].sort((left, right) => left.path.localeCompare(right.path)),
  counts: {
    additive_agreements: agreementResults.length,
    combined_agreements: 10,
    complete_propositions: agreementResults.reduce((sum, entry) => sum + entry.counts.complete_propositions, 0),
    incomplete_propositions: agreementResults.reduce((sum, entry) => sum + entry.counts.incomplete_propositions, 0),
    normal_rows: agreementResults.reduce((sum, entry) => sum + entry.counts.normal_rows, 0),
    additive_ambiguities: ambiguityMembers.length,
    additive_open_world: openWorldMembers.length,
  },
  effects: {
    network_reads: 0,
    model_calls: 0,
    database_writes: 0,
    product_writes: 0,
    serving_changes: 0,
    publications: 0,
    selector_changes: 0,
  },
};
generalisation.generalisation_result_id = contentId(generalisation.schema_version, generalisation);
const resultBinding = writeJson(`${outputRoot}/generalisation-result.json`, generalisation);

const receipt = {
  schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
  stage: comparisonEntryCorrectionMode
    ? 'M7_GENERALISATION_COMPARISON_ENTRY_CORRECTION'
    : rowCorrectionMode ? 'M7_GENERALISATION_ROW_CORRECTION' : 'M7_GENERALISATION',
  lifecycle_state: 'SEALED_REPORT_ONLY',
  status: 'PASS',
  authority_binding: fileBinding(authorityPath),
  cohort_binding: fileBinding(manifestPath),
  source_admission_receipt_binding: fileBinding(`${BASE}/receipts/stage-2y-structure-m7-source-admission.json`),
  generalisation_result_binding: resultBinding,
  sealed_receipt_bindings: sealedReceiptBindings,
  sealed_seven_digest: sealedSevenDigest,
  combined_ten_corpus_digest: combinedCorpusDigest,
  agreement_results: agreementResults,
  output_bindings: [...generalisation.output_bindings, resultBinding].sort((left, right) => left.path.localeCompare(right.path)),
  counts: generalisation.counts,
  effects: generalisation.effects,
};
receipt.receipt_id = contentId(receipt.schema_version, receipt);
writeJson(RECEIPT_PATH, receipt);
process.stdout.write(`${RECEIPT_PATH}\n${receipt.receipt_id}\n`);
