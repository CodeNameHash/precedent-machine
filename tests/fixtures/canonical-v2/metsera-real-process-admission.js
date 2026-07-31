const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const {
  compileMetseraExclusivityProcessPhrasebookAdmission,
} = require(
  '../../../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission',
);
const {
  compileProcessExclusivityPilotMaterialisation,
} = require('../../../lib/canonical-v2/process-exclusivity-pilot');

function materialisationInputFixture() {
  const fixturePath = path.join(
    __dirname,
    '../../canonical-v2-process-exclusivity-pilot.test.js',
  );
  const source = fs.readFileSync(fixturePath, 'utf8');
  const end = source.indexOf('\nfunction setPredicateDimensions');
  const fixtureSource = source.slice(0, end)
    .replaceAll('September 4, 2025', 'August 17, 2025')
    .replaceAll('September 8, 2025', 'August 17, 2025')
    .replace(
      "'METSERA_EXCLUSIVITY_GRANTED_EVIDENCE'",
      "'EXCLUSIVITY_GRANTED'",
    )
    .replace(
      "evidence('PROCESS_NARRATION', narrationInterval)",
      "evidence('EXCLUSIVITY_GRANTED', narrationInterval)",
    );
  const fixtureModule = new Module(fixturePath);
  fixtureModule.filename = fixturePath;
  fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
  fixtureModule._compile(
    `${fixtureSource}\nmodule.exports = { metseraFixture };`,
    fixturePath,
  );
  const input = fixtureModule.exports.metseraFixture();
  input.source_documents[0].citation_identity = {
    form_type: 'DEFM14A',
    filed_on: '2025-10-09',
    issuer_name: 'Metsera',
    source_location_label: 'Background of the Merger',
  };
  return input;
}

function buildMetseraRealProcessAdmission({
  authority_context: authorityContext,
  authority_input: authorityInput,
}) {
  const materialisationInput = materialisationInputFixture();
  const materialisationReceipt =
    compileProcessExclusivityPilotMaterialisation(materialisationInput);
  return compileMetseraExclusivityProcessPhrasebookAdmission({
    materialisation_input: materialisationInput,
    materialisation_receipt: materialisationReceipt,
    candidate_release_binding: {
      candidate_release_manifest_id:
        authorityContext.candidate_release_manifest
          .candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        authorityContext.candidate_release_manifest
          .canonical_payload_digest,
      corpus_release_id:
        authorityContext.candidate_release_manifest.corpus_release_id,
    },
    pilot_product_authority_context: authorityContext,
    pilot_product_authority_input: authorityInput,
  });
}

module.exports = {
  buildMetseraRealProcessAdmission,
};
