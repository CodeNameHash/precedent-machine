'use strict';

const spine = require('./m7-v2-profile-authoring');

module.exports = Object.freeze({
  MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING:
    spine.MAE_DEFINITION_PHASE2_PROPOSAL_AUTHORITY_BINDING,
  MAE_DEFINITION_PHASE2_PROPOSAL_CODES: spine.MAE_DEFINITION_PHASE2_PROPOSAL_CODES,
  MAE_DEFINITION_PHASE2_PROPOSAL_KEYS: spine.MAE_DEFINITION_PHASE2_PROPOSAL_KEYS,
  MAE_DEFINITION_PHASE4_AUTHORITY_BYTES: spine.MAE_DEFINITION_PHASE4_AUTHORITY_BYTES,
  MAE_DEFINITION_PHASE4_AUTHORITY_ID: spine.MAE_DEFINITION_PHASE4_AUTHORITY_ID,
  MAE_DEFINITION_PHASE4_AUTHORITY_PATH: spine.MAE_DEFINITION_PHASE4_AUTHORITY_PATH,
  MAE_DEFINITION_PHASE4_AUTHORITY_SCHEMA: spine.MAE_DEFINITION_PHASE4_AUTHORITY_SCHEMA,
  MAE_DEFINITION_PHASE4_AUTHORITY_SHA256: spine.MAE_DEFINITION_PHASE4_AUTHORITY_SHA256,
  MAE_DEFINITION_PHASE4_CANDIDATE_SCHEMA: spine.MAE_DEFINITION_PHASE4_CANDIDATE_SCHEMA,
  MAE_DEFINITION_PHASE4_REVIEW_CODES: spine.MAE_DEFINITION_PHASE4_REVIEW_CODES,
  MAE_DEFINITION_PHASE4_REVIEW_INPUT_KEYS: spine.MAE_DEFINITION_PHASE4_REVIEW_INPUT_KEYS,
  MAE_DEFINITION_PHASE4_REVIEW_OUTPUT_KEYS: spine.MAE_DEFINITION_PHASE4_REVIEW_OUTPUT_KEYS,
  MAE_DEFINITION_PHASE4_SCHEDULE_SHA256: spine.MAE_DEFINITION_PHASE4_SCHEDULE_SHA256,
  maeDefinitionProposalPartitionCanonicalTuple:
    spine.maeDefinitionProposalPartitionCanonicalTuple,
  maeDefinitionProposalPartition: spine.maeDefinitionProposalPartition,
  maeDefinitionTerminalCarveoutCode: spine.maeDefinitionTerminalCarveoutCode,
  prepareMaeDefinitionFamilyProfilePackageReview:
    spine.prepareMaeDefinitionFamilyProfilePackageReview,
  prepareMaeDefinitionFamilyProposal: spine.prepareMaeDefinitionFamilyProposal,
  prepareMaeDefinitionWork3BenInventorySessionDisposition:
    spine.prepareMaeDefinitionWork3BenInventorySessionDisposition,
  prepareMaeDefinitionWork3FamilyPackageRegistration:
    spine.prepareMaeDefinitionWork3FamilyPackageRegistration,
  prepareMaeDefinitionWork3FamilyPackageSeal:
    spine.prepareMaeDefinitionWork3FamilyPackageSeal,
  prepareMaeDefinitionWork3StageBBlueprintProposal:
    spine.prepareMaeDefinitionWork3StageBBlueprintProposal,
  prepareMaeDefinitionWork3UnapprovedInventoryReview:
    spine.prepareMaeDefinitionWork3UnapprovedInventoryReview,
});
