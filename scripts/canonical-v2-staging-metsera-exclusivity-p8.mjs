#!/usr/bin/env node

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  compileMetseraExclusivityStagingPilot,
} = require('../lib/canonical-v2/metsera-exclusivity-staging-pilot');
const {
  loadSealedMetseraGoldEvidence,
} = require('../lib/canonical-v2/metsera-gold-evidence');

const USER_AGENT =
  'Deal Corpus canonical staging bengoodchild@gmail.com';

async function fetchSource(document) {
  const response = await fetch(document.officialUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(
      `SEC source ${document.accession} returned ${response.status}.`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const { sourceUniverse } = loadSealedMetseraGoldEvidence();
  const sourceBytesByAccession = new Map();
  for (const document of sourceUniverse.documents) {
    sourceBytesByAccession.set(
      document.accession,
      await fetchSource(document),
    );
  }
  const receipt = compileMetseraExclusivityStagingPilot(
    sourceBytesByAccession,
  );
  process.stdout.write(`${JSON.stringify({
    schema_version: receipt.schema_version,
    selected_passage_id: receipt.selected_passage_id,
    sealed_source_count: receipt.sealed_source_count,
    sealed_passage_count: receipt.sealed_passage_count,
    retained_scope_residual_count:
      receipt.retained_scope_residual_count,
    acquisition_receipt_id: receipt.acquisition_receipt_id,
    sec_completeness_receipt_id:
      receipt.sec_completeness_receipt_id,
    scope_receipt_id: receipt.scope_receipt_id,
    candidate_graph_id: receipt.candidate_graph_id,
    candidate_validation_receipt_id:
      receipt.candidate_validation_receipt_id,
    materialisation_receipt_id:
      receipt.materialisation_receipt_id,
    authority_limits: receipt.authority_limits,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
