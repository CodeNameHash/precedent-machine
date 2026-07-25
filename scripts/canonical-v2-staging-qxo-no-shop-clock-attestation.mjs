#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  buildAdmittedParserProposalEnvelope,
} = require('../lib/canonical-v2/admitted-parser-proposal-adapter');
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoNoShopClockParserBoundReviewSeed,
  validateQxoNoShopClockParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-no-shop-clock-parser-bridge');
const {
  buildQxoAdmittedNoShopNoticeSlice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const SOURCE = Object.freeze({
  retrieval_url_sha256:
    'c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e',
  response_bytes_sha256:
    'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d',
});
const DEAL_KEY = 'deal:qxo-topbuild';
const FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-clock-staging-attestation.json',
);
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(
    join(ROOT, 'supabase/.temp/linked-project.json'),
    'utf8',
  ));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  return (line || 'QXO no-shop clock staging read failed.')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(
      /((?:password|token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .slice(0, 500);
}

function readCapture() {
  guardProject();
  const sql = `SELECT canonical_payload
FROM canonical_v2_staging.intake_capture_receipts
WHERE retrieval_url_sha256='${SOURCE.retrieval_url_sha256}'
  AND response_bytes_sha256='${SOURCE.response_bytes_sha256}'
LIMIT 2;`;
  const result = spawnSync(
    'supabase',
    ['--workdir', ROOT, 'db', 'query', '--linked', '--output', 'json', sql],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 90_000,
      maxBuffer: 6 * 1024 * 1024,
      shell: false,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(safeDiagnostic(
      `${result.error?.message || ''}\n${result.stderr || ''}`,
    ));
  }
  if (Buffer.byteLength(result.stdout || '', 'utf8') > MAX_RESPONSE_BYTES) {
    throw new Error('QXO no-shop clock staging read exceeded its response limit.');
  }
  const rows = JSON.parse(result.stdout)?.rows;
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.canonical_payload) {
    throw new Error('The exact QXO staging capture must exist exactly once.');
  }
  return rows[0].canonical_payload;
}

function verifyFailureIsolation(bridgeInputs) {
  function requireNoticeOnlySuppressed(reviewedNoShopSlice, label) {
    const outcomes = buildQxoNoShopClockParserBoundReviewSeed({
      ...bridgeInputs,
      reviewed_no_shop_slice: reviewedNoShopSlice,
    }).clock_outcomes;
    if (outcomes[0].suppressed !== true || outcomes[1].suppressed !== false) {
      throw new Error(`${label} did not remain isolated to the notice clock.`);
    }
  }

  const noticeDrift = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  noticeDrift.claims.find(
    (claim) => claim.claim_definition_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  ).canonical_value = '2';
  const changedNoticeClaim = noticeDrift.claims.find(
    (claim) => claim.claim_definition_key === 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  const priorNoticeClaimId = changedNoticeClaim.claim_revision_id;
  changedNoticeClaim.claim_revision_id = 'f'.repeat(64);
  noticeDrift.reviewed_mapping.canonical_object_ids =
    noticeDrift.reviewed_mapping.canonical_object_ids
      .map((id) => (id === priorNoticeClaimId ? 'f'.repeat(64) : id))
      .sort();
  noticeDrift.reviewed_mapping.reviewed_mapping_id = 'e'.repeat(64);
  noticeDrift.reviewed_mapping.canonical_payload_digest = 'd'.repeat(64);
  requireNoticeOnlySuppressed(
    noticeDrift,
    'Coherent notice and aggregate-mapping drift',
  );

  const missingNoticeClaim = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  missingNoticeClaim.claims = missingNoticeClaim.claims.filter(
    (claim) => claim.claim_definition_key !== 'NO_SHOP_NOTICE_PERIOD_DAYS',
  );
  requireNoticeOnlySuppressed(missingNoticeClaim, 'Missing notice claim');

  const missingNoticeComponent = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  missingNoticeComponent.components = missingNoticeComponent.components.filter(
    (component) => component.component_key !== 'NOTICE_LIMB',
  );
  requireNoticeOnlySuppressed(
    missingNoticeComponent,
    'Missing notice component',
  );

  const missingNoticeExcerpt = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  delete missingNoticeExcerpt.excerpts.notice_clock;
  requireNoticeOnlySuppressed(missingNoticeExcerpt, 'Missing notice excerpt');

  const matchDrift = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  matchDrift.claims.find(
    (claim) => (
      claim.claim_definition_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'
    ),
  ).day_basis = 'ELAPSED';
  const matchOutcome = buildQxoNoShopClockParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_slice: matchDrift,
  }).clock_outcomes;
  if (matchOutcome[0].suppressed !== false
    || matchOutcome[1].suppressed !== true) {
    throw new Error('Match drift did not remain isolated to the match clock.');
  }

  let unknownFieldRejected = false;
  try {
    buildQxoNoShopClockParserBoundReviewSeed({
      ...bridgeInputs,
      unknown_authority: true,
    });
  } catch (_) {
    unknownFieldRejected = true;
  }
  if (!unknownFieldRejected) {
    throw new Error('The clock bridge accepted an unknown authority field.');
  }
  const withoutResultInputs = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_slice,
  ));
  delete withoutResultInputs.resultInputs;
  const withoutLegacyInputs = buildQxoNoShopClockParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_slice: withoutResultInputs,
  });
  const baseline = buildQxoNoShopClockParserBoundReviewSeed(bridgeInputs);
  if (canonicalJson(withoutLegacyInputs) !== canonicalJson(baseline)) {
    throw new Error('Legacy resultInputs affected the review-only clock seed.');
  }
  return true;
}

function buildAttestation() {
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admission = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
  const contractBundle = compileFixtureContract();
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      admission.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  const parserInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  };
  const admittedParserProposalEnvelope =
    buildAdmittedParserProposalEnvelope(parserInputs);
  const reviewedNoShopSlice = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const bridgeInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_slice: reviewedNoShopSlice,
  };
  const seed = buildQxoNoShopClockParserBoundReviewSeed(bridgeInputs);
  validateQxoNoShopClockParserBoundReviewSeed({
    qxo_no_shop_clock_parser_bound_review_seed: seed,
    ...bridgeInputs,
  });
  const failureIsolationVerified = verifyFailureIsolation(bridgeInputs);
  const sectionParent = admittedParserProposalEnvelope
    .structural_section_proposals
    .find((proposal) => (
      proposal.admitted_structural_section_proposal_id
        === seed.parser_binding.section_4_3_proposal_id
    ));
  if (!sectionParent) throw new Error('The attested Section 4.3 parser parent is absent.');
  return {
    schema_version: 'QXO_NO_SHOP_CLOCK_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: seed.authority_scope,
    source_binding: seed.source_binding,
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        seed.parser_binding.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        seed.parser_binding.admitted_parser_proposal_envelope_payload_digest,
      section_4_3_proposal_id: seed.parser_binding.section_4_3_proposal_id,
      section_4_3_absolute_start:
        sectionParent.evidence_anchor.absolute_start,
      section_4_3_absolute_end:
        sectionParent.evidence_anchor.absolute_end,
      section_4_3_exact_bytes_digest:
        sectionParent.evidence_anchor.exact_bytes_digest,
      retained_parser_residual_count:
        seed.parser_binding.retained_parser_residual_summary.count,
      publication_blocked:
        admittedParserProposalEnvelope.publication_blocked,
    },
    reviewed_mapping_id:
      seed.reviewed_mapping_reference.reviewed_mapping_id,
    clock_dependencies: seed.clock_outcomes.map((outcome) => ({
      clock_key: outcome.clock_key,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      claim_revision_id: outcome.reference?.claim_revision_id || null,
      clock_excerpt_id: outcome.reference?.clock_excerpt_id || null,
      raw_duration: outcome.reference?.raw_duration || null,
      canonical_duration: outcome.reference?.canonical_duration || null,
      normalisation_payload_digest:
        outcome.reference?.normalisation_payload_digest || null,
    })),
    seed_status: seed.status,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_clock_parser_bound_review_seed_id:
      seed.qxo_no_shop_clock_parser_bound_review_seed_id,
    canonical_payload_digest: seed.canonical_payload_digest,
  };
}

const mode = process.argv[2];
if (!['--print', '--verify'].includes(mode) || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs --print|--verify');
}

try {
  const attestation = buildAttestation();
  if (mode === '--verify') {
    const expected = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
    if (canonicalJson(attestation) !== canonicalJson(expected)) {
      throw new Error('The checked QXO no-shop clock staging attestation has drifted.');
    }
  }
  process.stdout.write(`${canonicalJson(attestation)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'QXO no-shop clock attestation failed.');
}
