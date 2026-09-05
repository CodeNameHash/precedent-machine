'use strict';

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRootFrom } from './repo-root.mjs';

const repoRoot = repoRootFrom(import.meta.url);
const require = createRequire(resolve(repoRoot, 'package.json'));
const { consolidateAnalysis } = require(
  resolve(repoRoot, 'lib/canonical-v2/agreement-analysis-consolidation.js'),
);

const MANIFEST_PATH = resolve(
  repoRoot,
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json',
);
const AGREEMENT_PREFIX = '06ec3016';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadBoundRecord(binding) {
  if (!binding || typeof binding.path !== 'string') {
    throw new Error('binding is missing a path');
  }
  return {
    record: loadJson(resolve(repoRoot, binding.path)),
    binding,
  };
}

const manifest = loadJson(MANIFEST_PATH);
const registrationBinding = manifest.candidate_registration_binding?.registration_binding;
if (!registrationBinding) {
  throw new Error('successor manifest is missing candidate_registration_binding.registration_binding');
}
const registration = loadJson(resolve(repoRoot, registrationBinding.path));

const semanticByRole = new Map(
  (registration.semantic_input_bindings ?? []).map((entry) => [entry.input_role, entry.binding]),
);
for (const role of [
  'BASE_ANALYSIS_SET',
  'AGREEMENT_INDEX_SET',
  'CONTEXT_COMPILATION_SET',
  'APPROVED_FAMILY_PACKET_SET',
  'APPROVED_FAMILY_PROFILE_SET',
  'APPROVED_STRUCTURE_DISPOSITION_SET',
]) {
  if (!semanticByRole.has(role)) {
    throw new Error(`candidate registration is missing semantic input ${role}`);
  }
}

const baseAnalysisSet = loadBoundRecord(semanticByRole.get('BASE_ANALYSIS_SET'));
const agreementIndexSet = loadBoundRecord(semanticByRole.get('AGREEMENT_INDEX_SET'));
const contextCompilationSet = loadBoundRecord(semanticByRole.get('CONTEXT_COMPILATION_SET'));
const approvedFamilyPackets = loadBoundRecord(semanticByRole.get('APPROVED_FAMILY_PACKET_SET'));
const approvedFamilyProfileSet = loadBoundRecord(semanticByRole.get('APPROVED_FAMILY_PROFILE_SET'));
const approvedStructureDispositions = loadBoundRecord(
  semanticByRole.get('APPROVED_STRUCTURE_DISPOSITION_SET'),
);

const matchingAnalyses = baseAnalysisSet.record.members.filter(
  (member) => typeof member.agreement_id === 'string'
    && member.agreement_id.startsWith(AGREEMENT_PREFIX),
);
if (matchingAnalyses.length !== 1) {
  throw new Error(
    `expected exactly one analysis member with prefix ${AGREEMENT_PREFIX}, got ${matchingAnalyses.length}`,
  );
}
const selectedMember = matchingAnalyses[0];
const selectedAgreementId = selectedMember.agreement_id;
const baseAnalysis = {
  ...loadBoundRecord(selectedMember.agreement_analysis_binding),
  sourceSet: baseAnalysisSet,
};

const matchingContexts = contextCompilationSet.record.members.filter(
  (member) => member.agreement_id === selectedAgreementId,
);
if (matchingContexts.length !== 1) {
  throw new Error(
    `expected exactly one context compilation member for ${selectedAgreementId}, got ${matchingContexts.length}`,
  );
}
const contextCompilation = {
  ...loadBoundRecord(matchingContexts[0].context_compilation_binding),
  sourceSet: contextCompilationSet,
};

const wantedIndexId = contextCompilation.record.agreement_index_binding?.agreement_index_id;
const matchingIndexes = agreementIndexSet.record.members.filter(
  (binding) => binding.record_id === wantedIndexId,
);
if (matchingIndexes.length !== 1) {
  throw new Error(
    `expected exactly one agreement-index member for ${wantedIndexId}, got ${matchingIndexes.length}`,
  );
}
const agreementIndex = {
  ...loadBoundRecord(matchingIndexes[0]),
  sourceSet: agreementIndexSet,
};

const governance = {
  candidate_registration_id: registration.candidate_registration_id,
  candidate_registration_verification:
    manifest.candidate_registration_binding.independent_verification,
  candidate_registration_binding: registrationBinding,
  code_bindings: [
    { role: 'COMPILER', binding: registration.code_bindings.compiler },
    { role: 'DETERMINISTIC_GENERATOR', binding: registration.code_bindings.deterministic_generator },
    { role: 'CONTRACT_VALIDATOR', binding: registration.code_bindings.contract_validator },
  ],
  semantic_input_bindings: registration.semantic_input_bindings.map((entry) => ({
    role: entry.input_role,
    binding: entry.binding,
  })),
  family_profile_set_binding: registration.family_profile_set_binding,
  structure_disposition_set_binding: registration.structure_disposition_set_binding,
  view_policy_binding: registration.view_policy_binding,
  predecessor_receipt_bindings: registration.predecessor_receipt_bindings,
};

const input = {
  baseAnalysis,
  agreementIndex,
  contextCompilation,
  approvedFamilyPackets,
  approvedFamilyProfileSet,
  approvedStructureDispositions,
  governance,
};

let result;
try {
  const compiled = consolidateAnalysis(input);
  result = {
    status: 'NO_ERROR',
    agreement_id: selectedAgreementId,
    compiled_agreement_id: compiled?.agreement_id ?? null,
    compiled_schema_version: compiled?.schema_version ?? null,
  };
} catch (error) {
  result = {
    status: 'ERROR',
    agreement_id: selectedAgreementId,
    error_name: error?.name ?? null,
    first_error_message: error?.message ?? String(error),
  };
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
