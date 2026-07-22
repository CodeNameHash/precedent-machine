const {
  buildCandidateInputHead,
  buildCorrectionAuthorityMaterialisation,
  buildCorrectionDischargeMap,
  validateCandidateInputAuthoritySelection,
} = require('../../lib/canonical-v2/candidate-input-authority');

function buildFixtureCandidateInputAuthority({
  contractBundle,
  correctionMaterialisations = [],
  generation = 1,
  previousCandidateInputHeadId = null,
} = {}) {
  const correctionDischargeMap = buildCorrectionDischargeMap({
    contract_bundle: contractBundle,
    correction_materialisations: correctionMaterialisations,
  });
  const candidateInputHead = buildCandidateInputHead({
    generation,
    correction_discharge_map: correctionDischargeMap,
    previous_candidate_input_head_id: previousCandidateInputHeadId,
  });
  const correctionAuthorityMaterialisations = correctionMaterialisations.map((materialisation) => (
    buildCorrectionAuthorityMaterialisation({
      correction_materialisation: materialisation,
      contract_bundle: contractBundle,
    })
  )).sort((left, right) => (
    left.correction_application_id.localeCompare(right.correction_application_id)
  ));
  const correctionMaterialisationsForSelection = correctionAuthorityMaterialisations.map((item) => ({
    correction_output: item.correction_output,
    correction_discharge: item.correction_discharge,
  }));
  const selection = Object.freeze({
    candidate_input_head: candidateInputHead,
    correction_discharge_map: correctionDischargeMap,
    correction_materialisations: Object.freeze(correctionMaterialisationsForSelection),
    correction_authority_materialisations: Object.freeze(correctionAuthorityMaterialisations),
    active_correction_application_ids: Object.freeze(
      correctionDischargeMap.ordered_entries.map((entry) => entry.correction_application_id),
    ),
  });
  validateCandidateInputAuthoritySelection({
    authority_selection: selection,
    contract_bundle: contractBundle,
  });
  return selection;
}

module.exports = { buildFixtureCandidateInputAuthority };
