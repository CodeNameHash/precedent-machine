#!/usr/bin/env node

import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
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
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
  compileFixtureContractV9,
  compileFixtureContractV10,
  compileFixtureContractV11,
  compileFixtureContractV12,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoNoShopClockParserBoundReviewSeed,
  validateQxoNoShopClockParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-no-shop-clock-parser-bridge');
const {
  buildQxoNoShopActionsParserBoundReviewSeed,
  validateQxoNoShopActionsParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-no-shop-actions-parser-bridge');
const {
  buildQxoNoShopActionsF6ParserBoundReviewSeed,
  validateQxoNoShopActionsF6ParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge');
const {
  buildQxoNoShopNestedDefinitionCandidateSupplement,
  validateQxoNoShopNestedDefinitionCandidateSupplement,
} = require('../lib/canonical-v2/qxo-no-shop-nested-definition-candidate-supplement');
const {
  buildQxoNoShopReviewedDefinitionGraphF6,
  buildQxoNoShopReviewedDefinitionGraphF6FailureIsolationAttestation,
  validateQxoNoShopReviewedDefinitionGraphF6,
} = require('../lib/canonical-v2/qxo-no-shop-reviewed-definition-graph-f6');
const {
  buildQxoNoShopExceptionSourceBindingF6,
  buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation,
  validateQxoNoShopExceptionSourceBindingF6,
} = require('../lib/canonical-v2/qxo-no-shop-exception-source-binding-f6');
const {
  buildQxoNoShopInlinePermissionF9,
  validateQxoNoShopInlinePermissionF9,
} = require('../lib/canonical-v2/qxo-no-shop-inline-permission-f9');
const {
  buildQxoNoShopNoticeSourceBindingF6,
  buildQxoNoShopNoticeSourceBindingF6FailureIsolationAttestation,
  validateQxoNoShopNoticeSourceBindingF6,
} = require('../lib/canonical-v2/qxo-no-shop-notice-source-binding-f6');
const {
  buildQxoNoShopNoticeSemanticClosureF6,
  buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation,
  validateQxoNoShopNoticeSemanticClosureF6,
} = require('../lib/canonical-v2/qxo-no-shop-notice-semantic-closure-f6');
const {
  buildQxoNoShopNoticeReviewMaterialisationF7,
  buildQxoNoShopNoticeReviewMaterialisationF7FailureIsolationAttestation,
  validateQxoNoShopNoticeReviewMaterialisationF7,
} = require('../lib/canonical-v2/qxo-no-shop-notice-review-materialisation-f7');
const {
  buildQxoNoShopDefinitionRelationshipsF8,
  buildQxoNoShopDefinitionRelationshipsF8FailureIsolationAttestation,
  validateQxoNoShopDefinitionRelationshipsF8,
} = require('../lib/canonical-v2/qxo-no-shop-definition-relationships-f8');
const {
  buildQxoNoShopNoticeReceiptF10,
  validateQxoNoShopNoticeReceiptF10,
} = require('../lib/canonical-v2/qxo-no-shop-notice-receipt-f10');
const {
  buildQxoNoShopDefinitionControlF11,
  validateQxoNoShopDefinitionControlF11,
} = require('../lib/canonical-v2/qxo-no-shop-definition-control-f11');
const {
  buildQxoNoShopDefinitionScopeClosureF13,
  buildQxoNoShopDefinitionScopeClosureF13FailureAttestation,
  validateQxoNoShopDefinitionScopeClosureF13,
} = require('../lib/canonical-v2/qxo-no-shop-definition-scope-closure-f13');
const {
  buildQxoNoShopNoticeRevisionF14,
  buildQxoNoShopNoticeRevisionF14FailureAttestation,
  validateQxoNoShopNoticeRevisionF14,
} = require('../lib/canonical-v2/qxo-no-shop-notice-revision-f14');
const {
  buildQxoNoShopCopyClockF15,
  buildQxoNoShopCopyClockF15FailureAttestation,
  validateQxoNoShopCopyClockF15,
} = require('../lib/canonical-v2/qxo-no-shop-copy-clock-f15');
const {
  buildQxoNoShopCopyDeliveryMetricF16,
  validateQxoNoShopCopyDeliveryMetricF16,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-metric-f16');
const {
  buildQxoNoShopCopyDeliveryClaimF17,
  validateQxoNoShopCopyDeliveryClaimF17,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-claim-f17');
const {
  buildQxoNoShopCopyDeliveryServingF18,
  buildComparabilityClass,
  validateQxoNoShopCopyDeliveryServingF18,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-serving-f18');
const {
  buildQxoNoShopCopyDeliveryCanonicalF19,
  validateQxoNoShopCopyDeliveryCanonicalF19,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19');
const {
  BASE_EXECUTOR_DEFINITION_DIGEST,
  CANDIDATE_EXECUTOR_NAME,
  CANDIDATE_INDEX_NAME,
  buildQxoNoShopCopyDeliveryQueryF20,
  validateQxoNoShopCopyDeliveryQueryF20,
} = require('../lib/canonical-v2/qxo-no-shop-copy-delivery-query-f20');
const {
  buildMetricScopedCandidateReleaseF23,
  releaseManifestAdmissionResolution,
  validateMetricScopedCandidateReleaseF23,
} = require('../lib/canonical-v2/metric-scoped-candidate-release-f23');
const {
  buildNoShopTimingCertificationF24,
  validateNoShopTimingCertificationF24,
} = require('../lib/canonical-v2/no-shop-timing-certification-f24');
const {
  buildNoShopActionsCertificationF25,
  validateNoShopActionsCertificationF25,
} = require('../lib/canonical-v2/no-shop-actions-certification-f25');
const {
  buildDealServingDirectoryRecord,
  validateOfflineCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
const {
  validateOfflineCandidateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');
const {
  compileOfflineInterpretedMarketCohortRequest,
} = require('../lib/canonical-v2/market-cohort-query');
const {
  buildClaimInterpretation,
  buildInterpretedPresentClaimRevision,
  validateClaimInterpretation,
  validateInterpretedPresentClaimRevision,
} = require('../lib/canonical-v2/claim-interpretation');
const {
  buildFixtureResultComponent,
} = require('../lib/canonical-v2/serving-projection');
const {
  buildQxoAdmittedNoShopActionsSlice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice');
const {
  buildQxoAdmittedNoShopActionsF6Slice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-f6-slice');
const {
  buildQxoAdmittedNoShopNoticeSlice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice');
const {
  buildQxoAdmittedNoShopRematchSlice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-rematch-slice');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const {
  validateResolvedCanonicalWriteSet,
} = require('../lib/canonical-v2/validate-write-set');

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
const ACTIONS_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-actions-staging-attestation.json',
);
const ACTIONS_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-actions-f6-staging-attestation.json',
);
const DEFINITIONS_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-definitions-f6-staging-attestation.json',
);
const DEFINITION_GRAPH_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-graph-f6-staging-attestation.json',
);
const EXCEPTION_SOURCE_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-exception-source-f6-staging-attestation.json',
);
const INLINE_PERMISSION_F9_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-inline-permission-f9-staging-attestation.json',
);
const NOTICE_SOURCE_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-source-f6-staging-attestation.json',
);
const NOTICE_SEMANTIC_CLOSURE_F6_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-semantic-closure-f6-staging-attestation.json',
);
const NOTICE_REVIEW_MATERIALISATION_F7_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-review-materialisation-f7-staging-attestation.json',
);
const NOTICE_DEFINITION_RELATIONSHIPS_F8_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-relationships-f8-staging-attestation.json',
);
const NOTICE_RECEIPT_F10_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-receipt-f10-staging-attestation.json',
);
const DEFINITION_CONTROL_F11_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-control-f11-staging-attestation.json',
);
const DEFINITION_SCOPE_F13_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-scope-closure-f13-staging-attestation.json',
);
const NOTICE_REVISION_F14_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-revision-f14-staging-attestation.json',
);
const COPY_CLOCK_F15_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-clock-f15-staging-attestation.json',
);
const COPY_DELIVERY_METRIC_F16_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-metric-f16-staging-attestation.json',
);
const COPY_DELIVERY_CLAIM_F17_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-claim-f17-staging-attestation.json',
);
const COPY_DELIVERY_SERVING_F18_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-serving-f18-staging-attestation.json',
);
const COPY_DELIVERY_CANONICAL_F19_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19-staging-attestation.json',
);
const COPY_DELIVERY_QUERY_F20_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-query-f20-staging-attestation.json',
);
const COPY_DELIVERY_RELEASE_F23_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-release-f23-staging-attestation.json',
);
const NO_SHOP_TIMING_F24_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-timing-f24-staging-attestation.json',
);
const NO_SHOP_ACTIONS_F25_FIXTURE_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-no-shop-actions-f25-staging-attestation.json',
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
      ...(process.env.QXO_STAGING_QUERY_TIMEOUT_MS
        ? {
          timeout: Number(process.env.QXO_STAGING_QUERY_TIMEOUT_MS),
        }
        : {}),
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

function buildSourceInputs(contractBundle = compileFixtureContract()) {
  const capture = readCapture();
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admission = buildVerifiedSecSourceAdmission({
    capture,
    conversion,
    verification,
  });
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
  return {
    contractBundle,
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  };
}

function verifyActionsF6FailureIsolation(bridgeInputs) {
  const changed = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_f6_slice,
  ));
  changed.action_occurrences[0].action_code = 'DRIFTED_ACTION';
  const outcomes = buildQxoNoShopActionsF6ParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_actions_f6_slice: changed,
  }).action_outcomes;
  if (outcomes[0].suppressed !== true
    || outcomes.slice(1).some((outcome) => outcome.suppressed)) {
    throw new Error('F6 action drift did not remain isolated to one occurrence.');
  }
  const dependencyDrift = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_f6_slice,
  ));
  dependencyDrift.action_occurrences.find(
    (occurrence) => occurrence.occurrence_key === 'A_FACILITATE',
  ).action_code = 'DRIFTED_ACTION';
  const dependencyOutcomes = buildQxoNoShopActionsF6ParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_actions_f6_slice: dependencyDrift,
  }).action_outcomes;
  const dependencyByKey = new Map(dependencyOutcomes.map(
    (outcome) => [outcome.occurrence_key, outcome],
  ));
  if (dependencyByKey.get('A_FURNISH_METHOD').failure_code
    !== 'ACTION_METHOD_DEPENDENCY_UNRESOLVED') {
    throw new Error('F6 furnishing survived its suppressed method dependency.');
  }
  if (dependencyByKey.get('A_DGCL_203_WAIVER').suppressed !== false) {
    throw new Error('The unresolved DGCL method question was treated as a frozen edge.');
  }
  if (dependencyByKey.get('A_ENCOURAGE').suppressed !== false) {
    throw new Error('F6 dependency suppression escaped to an independent action.');
  }
  const extra = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_f6_slice,
  ));
  extra.action_occurrences.push({
    ...extra.action_occurrences[0],
    occurrence_key: 'UNREVIEWED_EXTRA_ACTION',
  });
  let extraRejected = false;
  try {
    buildQxoNoShopActionsF6ParserBoundReviewSeed({
      ...bridgeInputs,
      reviewed_no_shop_actions_f6_slice: extra,
    });
  } catch (error) {
    extraRejected = error?.code === 'UNEXPECTED_ACTION_OCCURRENCE';
  }
  if (!extraRejected) {
    throw new Error('The closed F6 bridge accepted an unexpected action occurrence.');
  }
  return true;
}

function buildActionsF6Attestation() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const reviewedSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const bridgeInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_actions_f6_slice: reviewedSlice,
  };
  const seed = buildQxoNoShopActionsF6ParserBoundReviewSeed(bridgeInputs);
  validateQxoNoShopActionsF6ParserBoundReviewSeed({
    qxo_no_shop_actions_f6_parser_bound_review_seed: seed,
    ...bridgeInputs,
  });
  const sectionParent = admittedParserProposalEnvelope
    .structural_section_proposals
    .find((proposal) => (
      proposal.admitted_structural_section_proposal_id
        === seed.parser_binding.section_4_3_proposal_id
    ));
  if (!sectionParent) throw new Error('The F6 Section 4.3 parser parent is absent.');
  return {
    schema_version: 'QXO_NO_SHOP_ACTIONS_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: seed.authority_scope,
    contract_binding: seed.contract_binding,
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
        seed.parser_binding.retained_parser_residual_count,
      publication_blocked:
        admittedParserProposalEnvelope.publication_blocked,
    },
    reviewed_mapping_id:
      seed.reviewed_mapping_reference.reviewed_mapping_id,
    reviewed_mapping_payload_digest:
      seed.reviewed_mapping_reference.reviewed_mapping_payload_digest,
    action_dependencies: seed.action_outcomes.map((outcome) => ({
      occurrence_key: outcome.occurrence_key,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      action_occurrence_id:
        outcome.reference?.action_occurrence_id || null,
      action_occurrence_revision_id:
        outcome.reference?.action_occurrence_revision_id || null,
      claim_revision_id: outcome.reference?.claim_revision_id || null,
      action_code: outcome.reference?.action_code || null,
      source_limb_code: outcome.reference?.source_limb_code || null,
      knowledge_qualifier_code:
        outcome.reference?.knowledge_qualifier_code || null,
      method_of_action_occurrence_ids:
        outcome.reference?.method_of_action_occurrence_ids || [],
    })),
    deferred_semantic_families:
      reviewedSlice.reviewed_mapping.deferred_semantic_families,
    retained_source_residuals:
      reviewedSlice.reviewed_mapping.retained_residuals.map((residual) => ({
        residual_code: residual.residual_code,
        state: residual.state,
        publication_effect: residual.publication_effect,
        absolute_start: residual.absolute_start,
        absolute_end: residual.absolute_end,
        exact_bytes_digest: residual.exact_bytes_digest,
      })),
    seed_status: seed.status,
    failure_isolation_verified: verifyActionsF6FailureIsolation(bridgeInputs),
    qxo_no_shop_actions_f6_parser_bound_review_seed_id:
      seed.qxo_no_shop_actions_f6_parser_bound_review_seed_id,
    canonical_payload_digest: seed.canonical_payload_digest,
  };
}

function buildAttestation() {
  const {
    contractBundle,
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs();
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

function buildDefinitionsF6Attestation() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  validateQxoNoShopNestedDefinitionCandidateSupplement({
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
    ...supplementInputs,
  });
  const sectionParent = admittedParserProposalEnvelope
    .structural_section_proposals
    .find((proposal) => (
      proposal.admitted_structural_section_proposal_id
        === supplement.parser_binding.section_4_3_proposal_id
    ));
  if (!sectionParent) {
    throw new Error('The F6 nested-definition Section 4.3 parser parent is absent.');
  }
  const existingCandidates = admittedParserProposalEnvelope.definition_candidates
    .filter((candidate) => (
      candidate.parent_structural_section_proposal_id
        === sectionParent.admitted_structural_section_proposal_id
    ))
    .map((candidate) => ({
      admitted_definition_candidate_id:
        candidate.admitted_definition_candidate_id,
      neutral_defined_term: candidate.neutral_defined_term,
      absolute_start: candidate.evidence_anchor.absolute_start,
      absolute_end: candidate.evidence_anchor.absolute_end,
      exact_bytes_digest: candidate.evidence_anchor.exact_bytes_digest,
    }));
  if (existingCandidates.some(
    (candidate) => ['Confidentiality Agreement', 'Company Request']
      .includes(candidate.neutral_defined_term),
  )) {
    throw new Error('A supplemental F6 nested definition already exists in parser output.');
  }
  const changed = JSON.parse(JSON.stringify(supplement));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopNestedDefinitionCandidateSupplement({
      qxo_no_shop_nested_definition_candidate_supplement: changed,
      ...supplementInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  if (!carrierDriftRejected) {
    throw new Error('The F6 nested-definition supplement accepted carrier drift.');
  }
  return {
    schema_version: 'QXO_NO_SHOP_DEFINITIONS_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: supplement.authority_scope,
    contract_binding: supplement.contract_binding,
    source_binding: supplement.source_binding,
    parser_binding: {
      ...supplement.parser_binding,
      section_4_3_absolute_start: sectionParent.evidence_anchor.absolute_start,
      section_4_3_absolute_end: sectionParent.evidence_anchor.absolute_end,
      section_4_3_exact_bytes_digest:
        sectionParent.evidence_anchor.exact_bytes_digest,
      publication_blocked: admittedParserProposalEnvelope.publication_blocked,
    },
    existing_section_4_3_definition_candidates: existingCandidates,
    supplemental_definition_candidates:
      supplement.supplemental_definition_candidates.map((candidate) => ({
        candidate_key: candidate.candidate_key,
        neutral_defined_term: candidate.neutral_defined_term,
        discovery_reason_code: candidate.discovery_reason_code,
        absolute_start: candidate.evidence_anchor.absolute_start,
        absolute_end: candidate.evidence_anchor.absolute_end,
        exact_bytes_digest: candidate.evidence_anchor.exact_bytes_digest,
        reviewed_supplemental_definition_candidate_id:
          candidate.reviewed_supplemental_definition_candidate_id,
        reviewed_disposition_required: candidate.reviewed_disposition_required,
      })),
    supplement_status: supplement.status,
    carrier_drift_rejected: carrierDriftRejected,
    qxo_no_shop_nested_definition_candidate_supplement_id:
      supplement.qxo_no_shop_nested_definition_candidate_supplement_id,
    canonical_payload_digest: supplement.canonical_payload_digest,
  };
}

function buildDefinitionGraphF6Attestation() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  const graphInputs = {
    ...supplementInputs,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  };
  const graph = buildQxoNoShopReviewedDefinitionGraphF6(graphInputs);
  validateQxoNoShopReviewedDefinitionGraphF6({
    qxo_no_shop_reviewed_definition_graph_f6: graph,
    ...graphInputs,
  });
  const changed = JSON.parse(JSON.stringify(graph));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopReviewedDefinitionGraphF6({
      qxo_no_shop_reviewed_definition_graph_f6: changed,
      ...graphInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  if (!carrierDriftRejected) {
    throw new Error('The F6 reviewed definition graph accepted carrier drift.');
  }
  const failedCompanyRequestGraph =
    buildQxoNoShopReviewedDefinitionGraphF6FailureIsolationAttestation(
      graphInputs,
      'COMPANY_REQUEST',
    );
  const failedCandidateOutcomes =
    failedCompanyRequestGraph.candidate_outcomes.filter(
      (outcome) => outcome.suppressed,
    );
  const baselineUnaffectedCueIds = graph.candidate_outcomes
    .filter((outcome) => outcome.definition_key !== 'COMPANY_REQUEST')
    .map((outcome) => outcome.definition_cue_id);
  const failedUnaffectedCueIds = failedCompanyRequestGraph.candidate_outcomes
    .filter((outcome) => outcome.definition_key !== 'COMPANY_REQUEST')
    .map((outcome) => outcome.definition_cue_id);
  const candidateFailureIsolationVerified =
    failedCandidateOutcomes.length === 1
    && failedCandidateOutcomes[0].definition_key === 'COMPANY_REQUEST'
    && failedCandidateOutcomes[0].failure_code === 'ATTESTED_CANDIDATE_FAILURE'
    && failedCompanyRequestGraph.candidate_dispositions.length === 5
    && failedCompanyRequestGraph.validated_semantic_graph.definition_cues.length === 5
    && canonicalJson(baselineUnaffectedCueIds)
      === canonicalJson(failedUnaffectedCueIds)
    && failedCompanyRequestGraph.reviewed_use_bindings.every(
      (binding) => binding.definition_key !== 'COMPANY_REQUEST',
    )
    && failedCompanyRequestGraph.definition_dependency_outcomes.filter(
      (outcome) => outcome.suppressed,
    ).length === 1
    && failedCompanyRequestGraph.definition_dependency_outcomes.find(
      (outcome) => outcome.suppressed,
    )?.container_definition_key === 'COMPANY_REQUEST'
    && failedCompanyRequestGraph.status
      .definition_candidate_dispositions_complete === false
    && failedCompanyRequestGraph.status.review_renderable === true
    && failedCompanyRequestGraph.status.publication_blocked === true;
  if (!candidateFailureIsolationVerified) {
    throw new Error('The F6 definition graph did not isolate one failed candidate.');
  }
  return {
    schema_version: 'QXO_NO_SHOP_DEFINITION_GRAPH_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: graph.authority_scope,
    contract_binding: graph.contract_binding,
    source_binding: graph.source_binding,
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        graph.parser_binding.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        graph.parser_binding.admitted_parser_proposal_envelope_payload_digest,
      parser_runtime_manifest_id: graph.parser_binding.parser_runtime_manifest_id,
      parser_candidates_mutated: graph.parser_binding.parser_candidates_mutated,
      retained_parser_residual_count:
        graph.parser_binding.retained_parser_residual_ids.length,
    },
    supplement_binding: graph.supplement_binding,
    governed_dependency_scopes: graph.governed_dependency_scopes,
    candidate_outcomes: graph.candidate_outcomes.map((outcome) => ({
      definition_key: outcome.definition_key,
      candidate_origin: outcome.candidate_origin,
      candidate_id: outcome.candidate_id,
      governed_ordinal: outcome.governed_ordinal,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      reviewed_definition_disposition_id:
        outcome.reviewed_definition_disposition_id,
      definition_cue_id: outcome.definition_cue_id,
    })),
    candidate_dispositions: graph.candidate_dispositions.map((disposition) => ({
      definition_key: disposition.definition_key,
      candidate_origin: disposition.candidate_origin,
      candidate_id: disposition.candidate_id,
      governed_ordinal: disposition.governed_ordinal,
      disposition_code: disposition.disposition_code,
      definition_cue_id: disposition.definition_cue_id,
    })),
    reviewed_use_bindings: graph.reviewed_use_bindings.map((binding) => ({
      definition_key: binding.definition_key,
      absolute_start: binding.absolute_start,
      absolute_end: binding.absolute_end,
      inventory_scope: binding.inventory_scope,
      purpose_codes: binding.purpose_codes,
    })),
    definition_dependency_edges: graph.definition_dependency_edges.map((edge) => ({
      container_definition_key: edge.container_definition_key,
      referenced_definition_key: edge.referenced_definition_key,
      governed_ordinal: edge.governed_ordinal,
    })),
    definition_dependency_outcomes: graph.definition_dependency_outcomes.map(
      (outcome) => ({
        container_definition_key: outcome.container_definition_key,
        referenced_definition_key: outcome.referenced_definition_key,
        governed_ordinal: outcome.governed_ordinal,
        suppressed: outcome.suppressed,
        failure_code: outcome.failure_code,
      }),
    ),
    retained_use_residuals: graph.retained_use_residuals,
    graph_summary: {
      validated_semantic_graph_id:
        graph.validated_semantic_graph.validated_semantic_graph_id,
      definition_cue_count:
        graph.validated_semantic_graph.definition_cues.length,
      definition_use_cue_count:
        graph.validated_semantic_graph.definition_use_cues.length,
    },
    graph_status: graph.status,
    carrier_drift_rejected: carrierDriftRejected,
    candidate_failure_isolation_verified: candidateFailureIsolationVerified,
    qxo_no_shop_reviewed_definition_graph_f6_id:
      graph.qxo_no_shop_reviewed_definition_graph_f6_id,
    canonical_payload_digest: graph.canonical_payload_digest,
  };
}

function buildExceptionSourceF6Attestation() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const reviewedSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const actionBridgeInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_actions_f6_slice: reviewedSlice,
  };
  const actionSeed = buildQxoNoShopActionsF6ParserBoundReviewSeed(
    actionBridgeInputs,
  );
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  const graphInputs = {
    ...supplementInputs,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  };
  const definitionGraph = buildQxoNoShopReviewedDefinitionGraphF6(graphInputs);
  const bindingInputs = {
    ...parserInputs,
    qxo_no_shop_actions_f6_parser_bound_review_seed: actionSeed,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  };
  const carrier = buildQxoNoShopExceptionSourceBindingF6(bindingInputs);
  validateQxoNoShopExceptionSourceBindingF6({
    qxo_no_shop_exception_source_binding_f6: carrier,
    ...bindingInputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopExceptionSourceBindingF6({
      qxo_no_shop_exception_source_binding_f6: changed,
      ...bindingInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  if (!carrierDriftRejected) {
    throw new Error('The F6 exception source carrier accepted identity drift.');
  }

  const furnishingFailure =
    buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation(
      bindingInputs,
      {
        prerequisite_code: 'ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED',
      },
    );
  const sharedFailure =
    buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation(
      bindingInputs,
      {
        prerequisite_code:
          'PROPOSAL_NOT_RESULTING_FROM_COVENANT_OBLIGOR_NO_SHOP_BREACH',
      },
    );
  const operationFailure =
    buildQxoNoShopExceptionSourceBindingF6FailureIsolationAttestation(
      bindingInputs,
      { effect_key: 'B_ENGAGE_DISCUSSIONS_EXCEPTION' },
    );
  const baselineEffectByKey = new Map(carrier.exception_effect_outcomes.map(
    (outcome) => [outcome.effect_key, outcome],
  ));
  const furnishingFailureByKey = new Map(
    furnishingFailure.exception_effect_outcomes.map(
      (outcome) => [outcome.effect_key, outcome],
    ),
  );
  const operationFailureByKey = new Map(
    operationFailure.exception_effect_outcomes.map(
      (outcome) => [outcome.effect_key, outcome],
    ),
  );
  const furnishingOnlySuppressed = [...furnishingFailureByKey].every(
    ([key, outcome]) => (
      key === 'FURNISH_NONPUBLIC_INFORMATION_EXCEPTION'
        ? outcome.failure_code === 'ACTION_SPECIFIC_PREREQUISITE_UNRESOLVED'
        : outcome.suppressed === false
          && outcome.qxo_no_shop_exception_effect_outcome_f6_id
            === baselineEffectByKey.get(key)
              .qxo_no_shop_exception_effect_outcome_f6_id
    ),
  );
  const sharedFailureSuppressesAll =
    sharedFailure.exception_effect_outcomes.every(
      (outcome) => outcome.failure_code === 'SHARED_PREREQUISITE_UNRESOLVED',
    );
  const oneOperationSuppressed = [...operationFailureByKey].every(
    ([key, outcome]) => (
      key === 'B_ENGAGE_DISCUSSIONS_EXCEPTION'
        ? outcome.failure_code === 'ATTESTED_EFFECT_FAILURE'
        : outcome.suppressed === false
          && outcome.qxo_no_shop_exception_effect_outcome_f6_id
            === baselineEffectByKey.get(key)
              .qxo_no_shop_exception_effect_outcome_f6_id
    ),
  );
  const residualsSurvive = [furnishingFailure, sharedFailure, operationFailure]
    .every((failed) => (
      canonicalJson(failed.unresolved_effects)
        === canonicalJson(carrier.unresolved_effects)
      && failed.status.review_renderable === true
      && failed.status.publication_blocked === true
    ));
  const failureIsolationVerified = furnishingOnlySuppressed
    && sharedFailureSuppressesAll
    && oneOperationSuppressed
    && residualsSurvive;
  if (!failureIsolationVerified) {
    throw new Error('The F6 exception source failures were not isolated.');
  }

  return {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    party_binding: carrier.party_binding,
    governed_scopes: carrier.governed_scopes,
    source_evidence: carrier.source_evidence.map((entry) => ({
      source_key: entry.source_key,
      governed_ordinal: entry.governed_ordinal,
      absolute_start: entry.semantic_span.absolute_start,
      absolute_end: entry.semantic_span.absolute_end,
      exact_bytes_digest: entry.semantic_span.exact_bytes_digest,
    })),
    prerequisite_outcomes: carrier.prerequisite_outcomes.map((outcome) => ({
      prerequisite_code: outcome.prerequisite_code,
      prerequisite_class: outcome.prerequisite_class,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      source_binding_id: outcome.source_binding
        ?.qxo_no_shop_exception_prerequisite_source_binding_f6_id || null,
      evidence_excerpt_count:
        outcome.source_binding?.evidence_excerpt_ids.length || 0,
      definition_use_binding_count:
        outcome.source_binding?.definition_use_binding_ids.length || 0,
      definition_dependency_edge_count:
        outcome.source_binding?.definition_dependency_edge_ids.length || 0,
    })),
    exception_effect_outcomes: carrier.exception_effect_outcomes.map((outcome) => ({
      effect_key: outcome.effect_key,
      action_occurrence_keys: outcome.action_occurrence_keys,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      source_binding_id: outcome.source_binding
        ?.qxo_no_shop_exception_effect_source_binding_f6_id || null,
      legal_operation: outcome.source_binding?.legal_operation || null,
      affected_action_code:
        outcome.source_binding?.affected_action_code || null,
      affected_action_occurrence_keys:
        outcome.source_binding?.affected_action_endpoints.map(
          (endpoint) => endpoint.occurrence_key,
        ) || [],
      evidence_excerpt_count:
        outcome.source_binding?.evidence_excerpt_ids.length || 0,
      definition_use_binding_count:
        outcome.source_binding?.definition_use_binding_ids.length || 0,
      definition_dependency_edge_count:
        outcome.source_binding?.definition_dependency_edge_ids.length || 0,
      governing_notice_obligation_revision_id:
        outcome.source_binding?.governing_notice_obligation_revision_id || null,
      relationship_effect_authority:
        outcome.source_binding?.relationship_effect_authority || null,
    })),
    inline_permission_source_binding: {
      source_binding_id: carrier.inline_permission_source_binding
        .qxo_no_shop_inline_permission_source_binding_f6_id,
      legal_operation:
        carrier.inline_permission_source_binding.legal_operation,
      qualified_action_outcomes:
        carrier.inline_permission_source_binding.qualified_action_outcomes.map(
          (outcome) => ({
            occurrence_key: outcome.occurrence_key,
            suppressed: outcome.suppressed,
            failure_code: outcome.failure_code,
          }),
        ),
      source_binding_complete:
        carrier.inline_permission_source_binding.source_binding_complete,
      relationship_effect_authority:
        carrier.inline_permission_source_binding.relationship_effect_authority,
    },
    unresolved_effects: carrier.unresolved_effects.map((residual) => ({
      action_occurrence_key: residual.action_occurrence_key,
      affected_action_code: residual.affected_action_code,
      action_occurrence_revision_id:
        residual.action_occurrence_revision_id,
      examined_permission_cluster_excerpt_id:
        residual.examined_permission_cluster_excerpt_id,
      reason_code: residual.reason_code,
      legal_operation: residual.legal_operation,
      absence_authority: residual.absence_authority,
      comparability_authority: residual.comparability_authority,
      unresolved_effect_id:
        residual.qxo_no_shop_unresolved_exception_effect_f6_id,
    })),
    retained_source_residuals: carrier.retained_source_residuals.map(
      (residual) => ({
        residual_code: residual.residual_code,
        governed_ordinal: residual.governed_ordinal,
        state: residual.state,
        absence_authority: residual.absence_authority,
        source_residual_id:
          residual.qxo_no_shop_exception_source_residual_f6_id,
      }),
    ),
    notice_dependency: {
      governed_notice_dependency:
        carrier.notice_dependency.governed_notice_dependency,
      first_sentence_notice_excerpt_id:
        carrier.notice_dependency.first_sentence_notice_excerpt_id,
      retained_definition_use_residual_id:
        carrier.notice_dependency.retained_definition_use_residual_id,
      notice_obligation_revision_id:
        carrier.notice_dependency.notice_obligation_revision_id,
      dependency_state: carrier.notice_dependency.dependency_state,
      absence_authority: carrier.notice_dependency.absence_authority,
    },
    definition_relationship_dependency: {
      reviewed_definition_use_binding_ids:
        carrier.definition_relationship_dependency
          .reviewed_definition_use_binding_ids,
      reviewed_definition_dependency_edge_ids:
        carrier.definition_relationship_dependency
          .reviewed_definition_dependency_edge_ids,
      canonical_definition_use_relationship_ids:
        carrier.definition_relationship_dependency
          .canonical_definition_use_relationship_ids,
      dependency_state:
        carrier.definition_relationship_dependency.dependency_state,
      relationship_authority:
        carrier.definition_relationship_dependency.relationship_authority,
    },
    binding_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_exception_source_binding_f6_id:
      carrier.qxo_no_shop_exception_source_binding_f6_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildInlinePermissionF9Attestation() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const actionsSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const actionSeed = buildQxoNoShopActionsF6ParserBoundReviewSeed({
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_actions_f6_slice: actionsSlice,
  });
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  const definitionGraph = buildQxoNoShopReviewedDefinitionGraphF6({
    ...supplementInputs,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  });
  const exceptionSourceBinding = buildQxoNoShopExceptionSourceBindingF6({
    ...parserInputs,
    qxo_no_shop_actions_f6_parser_bound_review_seed: actionSeed,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  });
  const materialisation = buildQxoNoShopInlinePermissionF9({
    sourceContext: admittedSourceContext,
    contractBundle,
    actionsSlice,
    exceptionSourceBinding,
  });
  validateQxoNoShopInlinePermissionF9({
    qxoNoShopInlinePermissionF9: materialisation,
    sourceContext: admittedSourceContext,
    contractBundle,
    actionsSlice,
    exceptionSourceBinding,
  });
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: materialisation.canonical_write_set,
    contractBundle,
    admittedSourceContexts: [admittedSourceContext],
    retainedCanonicalObjects: [],
  });
  if (validation.counts.residuals !== 0
    || validation.counts.quarantinedClosures !== 0
    || validation.publishableWriteSet.relationships.length !== 1
    || validation.publishableWriteSet.claims.length !== 10) {
    throw new Error('The exact F9 inline-permission graph did not validate cleanly.');
  }
  return {
    schema_version:
      'QXO_NO_SHOP_INLINE_PERMISSION_F9_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: 'POSITIVE_INLINE_PERMISSION_GRAPH_ONLY',
    contract_fingerprint: contractBundle.fingerprint,
    source_binding: {
      governed_deal_key: admittedSourceContext.governed_deal_key,
      deal_admission_id: admittedSourceContext.deal_admission_id,
      source_admission_manifest_id:
        admittedSourceContext.source_admission_manifest_id,
      document_hash: admittedSourceContext.document_hash,
      canonical_text_id: admittedSourceContext.canonical_text_id,
    },
    predecessor_bindings: {
      reviewed_actions_mapping_id:
        materialisation.reviewed_actions_mapping_id,
      reviewed_exception_source_binding_id:
        materialisation.reviewed_exception_source_binding_id,
    },
    materialisation_id:
      materialisation.qxo_no_shop_inline_permission_f9_id,
    semantic_closure_id: materialisation.semantic_closure_id,
    source_provision_instance_id:
      materialisation.relationship.source_occurrence_id,
    permission_component_id:
      materialisation.permission_component.provision_component_id,
    relationship_revision_id:
      materialisation.relationship.relationship_revision_id,
    qualified_action_occurrence_ids:
      materialisation.relationship.effect.qualified_action_occurrence_ids,
    permitted_action_code:
      materialisation.relationship.effect.permitted_action_code,
    action_claim_count: materialisation.action_claims.length,
    retained_source_residual_count:
      materialisation.retained_source_residual_count,
    validation_counts: validation.counts,
    status: materialisation.status,
  };
}

function exceptionSourceF6AttestationProjection(attestation) {
  return {
    schema_version: 'QXO_NO_SHOP_EXCEPTION_SOURCE_F6_STAGING_ATTESTATION/V1',
    environment: attestation.environment,
    authority_scope: attestation.authority_scope,
    contract_binding: attestation.contract_binding,
    source_binding: attestation.source_binding,
    upstream_bindings: attestation.upstream_bindings,
    source_evidence_count: attestation.source_evidence.length,
    source_evidence_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_EVIDENCE_ATTESTATION/V1',
      attestation.source_evidence,
    ),
    prerequisite_outcome_count: attestation.prerequisite_outcomes.length,
    prerequisite_outcomes_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_PREREQUISITE_OUTCOMES_ATTESTATION/V1',
      attestation.prerequisite_outcomes,
    ),
    supported_effect_outcome_count: attestation.exception_effect_outcomes.length,
    supported_effect_outcomes_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_EFFECT_OUTCOMES_ATTESTATION/V1',
      attestation.exception_effect_outcomes,
    ),
    inline_permission_source_binding_id:
      attestation.inline_permission_source_binding.source_binding_id,
    unresolved_effect_count: attestation.unresolved_effects.length,
    unresolved_effects_digest: contentId(
      'QXO_NO_SHOP_UNRESOLVED_EXCEPTION_EFFECTS_ATTESTATION/V1',
      attestation.unresolved_effects,
    ),
    retained_source_residual_count:
      attestation.retained_source_residuals.length,
    retained_source_residuals_digest: contentId(
      'QXO_NO_SHOP_EXCEPTION_SOURCE_RESIDUALS_ATTESTATION/V1',
      attestation.retained_source_residuals,
    ),
    notice_dependency_digest: contentId(
      'QXO_NO_SHOP_NOTICE_DEPENDENCY_ATTESTATION/V1',
      attestation.notice_dependency,
    ),
    definition_relationship_dependency_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_DEPENDENCY_ATTESTATION/V1',
      attestation.definition_relationship_dependency,
    ),
    reviewed_definition_dependency_edge_count:
      attestation.definition_relationship_dependency
        .reviewed_definition_dependency_edge_ids.length,
    binding_status: attestation.binding_status,
    carrier_drift_rejected: attestation.carrier_drift_rejected,
    failure_isolation_verified: attestation.failure_isolation_verified,
    qxo_no_shop_exception_source_binding_f6_id:
      attestation.qxo_no_shop_exception_source_binding_f6_id,
    canonical_payload_digest: attestation.canonical_payload_digest,
  };
}

function buildNoticeSourceF6Runtime() {
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const reviewedNoShopSlice = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const clockInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_slice: reviewedNoShopSlice,
  };
  const clockSeed = buildQxoNoShopClockParserBoundReviewSeed(clockInputs);
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  };
  const supplement = buildQxoNoShopNestedDefinitionCandidateSupplement(
    supplementInputs,
  );
  const graphInputs = {
    ...supplementInputs,
    qxo_no_shop_nested_definition_candidate_supplement: supplement,
  };
  const definitionGraph = buildQxoNoShopReviewedDefinitionGraphF6(graphInputs);
  const bindingInputs = {
    ...parserInputs,
    qxo_no_shop_clock_f6_parser_bound_review_seed: clockSeed,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  };
  const carrier = buildQxoNoShopNoticeSourceBindingF6(bindingInputs);
  validateQxoNoShopNoticeSourceBindingF6({
    qxo_no_shop_notice_source_binding_f6: carrier,
    ...bindingInputs,
  });
  return {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    bindingInputs,
    carrier,
    contractBundle,
  };
}

function buildNoticeSourceF6Attestation() {
  const {
    bindingInputs,
    carrier,
  } = buildNoticeSourceF6Runtime();
  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopNoticeSourceBindingF6({
      qxo_no_shop_notice_source_binding_f6: changed,
      ...bindingInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  const failedPlural =
    buildQxoNoShopNoticeSourceBindingF6FailureIsolationAttestation(
      bindingInputs,
    );
  const failureIsolationVerified =
    failedPlural.plural_definition_use_resolution === null
    && failedPlural.definition_relationship_dependency === null
    && failedPlural.status.review_renderable === true
    && failedPlural.status.publication_blocked === true
    && failedPlural.field_source_bindings.every((binding, index) => (
      binding.qxo_no_shop_notice_field_source_binding_f6_id
        === carrier.field_source_bindings[index]
          .qxo_no_shop_notice_field_source_binding_f6_id
    ));
  if (!carrierDriftRejected || !failureIsolationVerified) {
    throw new Error('The F6 notice carrier safety attestation failed.');
  }

  return {
    schema_version: 'QXO_NO_SHOP_NOTICE_SOURCE_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    source_evidence_count: carrier.source_evidence.length,
    source_evidence_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_EVIDENCE_ATTESTATION/V1',
      carrier.source_evidence.map((entry) => ({
        source_key: entry.source_key,
        governed_ordinal: entry.governed_ordinal,
        absolute_start: entry.semantic_span.absolute_start,
        absolute_end: entry.semantic_span.absolute_end,
        exact_bytes_digest: entry.semantic_span.exact_bytes_digest,
      })),
    ),
    field_source_binding_count: carrier.field_source_bindings.length,
    field_source_bindings_digest: contentId(
      'QXO_NO_SHOP_NOTICE_FIELD_SOURCE_BINDINGS_ATTESTATION/V1',
      carrier.field_source_bindings,
    ),
    first_clock_claim_revision_id:
      carrier.notice_timing_source_binding.existing_review_claim_revision_id,
    copy_clock_claim_revision_id:
      carrier.copy_timing_source_binding.claim_revision_id,
    copy_clock_normalisation_payload_digest:
      carrier.copy_timing_source_binding.normalisation_payload_digest,
    plural_definition_use_resolution_id:
      carrier.plural_definition_use_resolution
        .qxo_no_shop_reviewed_plural_definition_use_f6_id,
    reviewed_definition_use_count:
      carrier.definition_relationship_dependency
        .reviewed_definition_use_binding_ids.length + 1,
    reviewed_definition_dependency_edge_count:
      carrier.definition_relationship_dependency
        .reviewed_definition_dependency_edge_ids.length,
    retained_source_residual_count:
      carrier.retained_source_residuals.length,
    retained_source_residuals_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_RESIDUALS_ATTESTATION/V1',
      carrier.retained_source_residuals,
    ),
    notice_obligation_materialisation:
      carrier.notice_obligation_materialisation,
    binding_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_notice_source_binding_f6_id:
      carrier.qxo_no_shop_notice_source_binding_f6_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildNoticeSemanticClosureF6Attestation() {
  const {
    carrier: noticeSourceCarrier,
    contractBundle,
  } = buildNoticeSourceF6Runtime();
  const closureInputs = {
    contract_bundle: contractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const carrier = buildQxoNoShopNoticeSemanticClosureF6(closureInputs);
  validateQxoNoShopNoticeSemanticClosureF6({
    qxo_no_shop_notice_semantic_closure_f6: carrier,
    ...closureInputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopNoticeSemanticClosureF6({
      qxo_no_shop_notice_semantic_closure_f6: changed,
      ...closureInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }

  const initialFailure =
    buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation(
      closureInputs,
      'INITIAL_CLOCK',
    );
  const copyFailure =
    buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation(
      closureInputs,
      'COPY_CLOCK',
    );
  const definitionFailure =
    buildQxoNoShopNoticeSemanticClosureF6FailureIsolationAttestation(
      closureInputs,
      { kind: 'DEFINITION_USE', absolute_start: 208321 },
    );
  const baselineDefinitionByStart = new Map(
    carrier.definition_use_outcomes.map(
      (outcome) => [outcome.absolute_start, outcome],
    ),
  );
  const definitionFailureByStart = new Map(
    definitionFailure.definition_use_outcomes.map(
      (outcome) => [outcome.absolute_start, outcome],
    ),
  );
  const definitionFailureIsolated = [...definitionFailureByStart].every(
    ([start, outcome]) => (
      start === 208321
        ? outcome.suppressed === true
        : outcome.qxo_no_shop_notice_definition_use_outcome_f6_id
          === baselineDefinitionByStart.get(start)
            .qxo_no_shop_notice_definition_use_outcome_f6_id
    ),
  ) && definitionFailure.definition_dependency_outcome.suppressed === true;
  const failureIsolationVerified =
    initialFailure.initial_notice_clock_outcome.suppressed === true
    && initialFailure.copy_clock_outcome.resolution
      .qxo_no_shop_reviewed_copy_clock_referent_f6_id
        === carrier.copy_clock_outcome.resolution
          .qxo_no_shop_reviewed_copy_clock_referent_f6_id
    && initialFailure.definition_use_outcomes.every((outcome, index) => (
      outcome.qxo_no_shop_notice_definition_use_outcome_f6_id
        === carrier.definition_use_outcomes[index]
          .qxo_no_shop_notice_definition_use_outcome_f6_id
    ))
    && copyFailure.copy_clock_outcome.suppressed === true
    && copyFailure.initial_notice_clock_outcome.resolution
      .clock_scope_resolution
      .qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id
        === carrier.initial_notice_clock_outcome.resolution
          .clock_scope_resolution
          .qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id
    && copyFailure.definition_use_outcomes.every((outcome, index) => (
      outcome.qxo_no_shop_notice_definition_use_outcome_f6_id
        === carrier.definition_use_outcomes[index]
          .qxo_no_shop_notice_definition_use_outcome_f6_id
    ))
    && definitionFailureIsolated
    && definitionFailure.initial_notice_clock_outcome.resolution
      .clock_scope_resolution
      .qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id
        === carrier.initial_notice_clock_outcome.resolution
          .clock_scope_resolution
          .qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id
    && definitionFailure.copy_clock_outcome.resolution
      .qxo_no_shop_reviewed_copy_clock_referent_f6_id
        === carrier.copy_clock_outcome.resolution
          .qxo_no_shop_reviewed_copy_clock_referent_f6_id;
  if (!carrierDriftRejected || !failureIsolationVerified) {
    throw new Error('The F6 notice semantic closure safety attestation failed.');
  }

  return {
    schema_version:
      'QXO_NO_SHOP_NOTICE_SEMANTIC_CLOSURE_F6_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_binding: carrier.upstream_binding,
    initial_notice_clock: {
      suppressed: carrier.initial_notice_clock_outcome.suppressed,
      existing_claim_revision_id:
        carrier.initial_notice_clock_outcome.resolution
          .clock_scope_resolution.existing_claim_revision_id,
      trigger_operator:
        carrier.initial_notice_clock_outcome.resolution
          .trigger_expression.operator,
      trigger_codes:
        carrier.initial_notice_clock_outcome.resolution
          .trigger_expression.operands.map((operand) => operand.trigger_code),
      trigger_expression_id:
        carrier.initial_notice_clock_outcome.resolution
          .trigger_expression
          .qxo_no_shop_reviewed_notice_trigger_expression_f6_id,
      clock_scope_resolution_id:
        carrier.initial_notice_clock_outcome.resolution
          .clock_scope_resolution
          .qxo_no_shop_reviewed_initial_notice_clock_scope_f6_id,
      canonical_trigger_expression_id:
        carrier.initial_notice_clock_outcome.resolution
          .trigger_expression.canonical_trigger_expression_id,
    },
    copy_clock: {
      suppressed: carrier.copy_clock_outcome.suppressed,
      existing_claim_revision_id:
        carrier.copy_clock_outcome.resolution.existing_claim_revision_id,
      raw_referent: carrier.copy_clock_outcome.resolution.raw_referent,
      canonical_trigger_code:
        carrier.copy_clock_outcome.resolution.canonical_trigger_code,
      receipt_object_resolution:
        carrier.copy_clock_outcome.resolution.receipt_object_resolution,
      copy_subject_association_resolution:
        carrier.copy_clock_outcome.resolution
          .copy_subject_association_resolution,
      item_or_batch_cardinality_resolution:
        carrier.copy_clock_outcome.resolution
          .item_or_batch_cardinality_resolution,
      copy_clock_referent_resolution_id:
        carrier.copy_clock_outcome.resolution
          .qxo_no_shop_reviewed_copy_clock_referent_f6_id,
    },
    definition_use_outcomes: carrier.definition_use_outcomes.map(
      (outcome) => ({
        definition_key: outcome.definition_key,
        absolute_start: outcome.absolute_start,
        absolute_end: outcome.absolute_end,
        suppressed: outcome.suppressed,
        resolution_kind: outcome.resolution?.resolution_kind || null,
        upstream_review_resolution_id:
          outcome.resolution?.upstream_review_resolution_id || null,
        canonical_definition_use_relationship_id:
          outcome.resolution?.canonical_definition_use_relationship_id || null,
      }),
    ),
    definition_dependency_outcome: {
      suppressed: carrier.definition_dependency_outcome.suppressed,
      failure_code: carrier.definition_dependency_outcome.failure_code,
      upstream_review_resolution_id:
        carrier.definition_dependency_outcome.resolution
          ?.upstream_review_resolution_id || null,
      canonical_definition_use_relationship_id:
        carrier.definition_dependency_outcome.resolution
          ?.canonical_definition_use_relationship_id || null,
    },
    source_residual_dispositions: carrier.source_residual_dispositions,
    contract_representation_gap: carrier.contract_representation_gap,
    notice_materialisation: carrier.notice_materialisation,
    closure_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_notice_semantic_closure_f6_id:
      carrier.qxo_no_shop_notice_semantic_closure_f6_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildNoticeReviewMaterialisationF7Attestation() {
  const {
    carrier: noticeSourceCarrier,
    contractBundle: f6ContractBundle,
  } = buildNoticeSourceF6Runtime();
  const closureInputs = {
    contract_bundle: f6ContractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const closure = buildQxoNoShopNoticeSemanticClosureF6(closureInputs);
  const materialisationInputs = {
    contract_bundle: compileFixtureContractV7(),
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  };
  const carrier = buildQxoNoShopNoticeReviewMaterialisationF7(
    materialisationInputs,
  );
  validateQxoNoShopNoticeReviewMaterialisationF7({
    qxo_no_shop_notice_review_materialisation_f7: carrier,
    ...materialisationInputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopNoticeReviewMaterialisationF7({
      qxo_no_shop_notice_review_materialisation_f7: changed,
      ...materialisationInputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }

  const initialFailure =
    buildQxoNoShopNoticeReviewMaterialisationF7FailureIsolationAttestation(
      materialisationInputs,
      'INITIAL_NOTICE',
    );
  const copyFailure =
    buildQxoNoShopNoticeReviewMaterialisationF7FailureIsolationAttestation(
      materialisationInputs,
      'COPY_CLOCK',
    );
  const failureIsolationVerified =
    initialFailure.initial_notice_outcome.suppressed === true
    && initialFailure.copy_clock_outcome.interpretation
      .interpretation_payload_id
        === carrier.copy_clock_outcome.interpretation
          .interpretation_payload_id
    && initialFailure.copy_clock_outcome.clock_scope.clock_scope_id
      === carrier.copy_clock_outcome.clock_scope.clock_scope_id
    && copyFailure.copy_clock_outcome.suppressed === true
    && copyFailure.initial_notice_outcome.trigger_expression
      .trigger_expression_id
        === carrier.initial_notice_outcome.trigger_expression
          .trigger_expression_id
    && copyFailure.initial_notice_outcome.clock_scope.clock_scope_id
      === carrier.initial_notice_outcome.clock_scope.clock_scope_id
    && initialFailure.status.review_renderable === true
    && copyFailure.status.review_renderable === true;
  if (!carrierDriftRejected || !failureIsolationVerified) {
    throw new Error('The F7 notice materialisation safety attestation failed.');
  }

  return {
    schema_version:
      'QXO_NO_SHOP_NOTICE_REVIEW_MATERIALISATION_F7_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_binding: carrier.upstream_binding,
    review_notice_occurrence: carrier.review_notice_occurrence,
    initial_notice: {
      trigger_expression_id:
        carrier.initial_notice_outcome.trigger_expression
          .trigger_expression_id,
      trigger_operator:
        carrier.initial_notice_outcome.trigger_expression.operator,
      trigger_codes:
        carrier.initial_notice_outcome.trigger_expression.operands,
      operand_sufficiency_code:
        carrier.initial_notice_outcome.trigger_expression
          .operand_sufficiency_code,
      clock_scope_id:
        carrier.initial_notice_outcome.clock_scope.clock_scope_id,
      timing_claim_revision_id:
        carrier.initial_notice_outcome.clock_scope
          .timing_claim_revision_id,
      application_scope_code:
        carrier.initial_notice_outcome.clock_scope
          .application_scope_code,
      qualifier_combination_operator:
        carrier.initial_notice_outcome.clock_scope
          .qualifier_combination_operator,
      temporal_operator:
        carrier.initial_notice_outcome.clock_scope.temporal_operator,
      qualifier_codes:
        carrier.initial_notice_outcome.clock_scope.qualifier_codes,
      resolution_state:
        carrier.initial_notice_outcome.clock_scope.resolution_state,
    },
    copy_clock: {
      interpretation_payload_id:
        carrier.copy_clock_outcome.interpretation
          .interpretation_payload_id,
      clarity_state:
        carrier.copy_clock_outcome.interpretation.clarity_state,
      primary_interpretation_code:
        carrier.copy_clock_outcome.interpretation
          .primary_interpretation.code,
      alternative_interpretation_codes:
        carrier.copy_clock_outcome.interpretation
          .alternative_interpretations.map((entry) => entry.code),
      ambiguity_dimension_codes:
        carrier.copy_clock_outcome.interpretation
          .ambiguity_dimension_codes,
      lawyer_note_digest:
        carrier.copy_clock_outcome.interpretation.lawyer_note_digest,
      clock_scope_id:
        carrier.copy_clock_outcome.clock_scope.clock_scope_id,
      timing_claim_revision_id:
        carrier.copy_clock_outcome.clock_scope.timing_claim_revision_id,
      qualifier_codes:
        carrier.copy_clock_outcome.timing_semantics.qualifier_codes,
      qualifier_combination_operator:
        carrier.copy_clock_outcome.timing_semantics
          .qualifier_combination_operator,
      temporal_operator:
        carrier.copy_clock_outcome.timing_semantics.temporal_operator,
      raw_duration:
        carrier.copy_clock_outcome.timing_semantics.raw_duration,
      canonical_duration:
        carrier.copy_clock_outcome.timing_semantics.canonical_duration,
      raw_receipt_referent:
        carrier.copy_clock_outcome.clock_scope.raw_receipt_referent,
      item_or_batch_cardinality_state:
        carrier.copy_clock_outcome.clock_scope
          .item_or_batch_cardinality_state,
      comparability_effect_code:
        carrier.copy_clock_outcome.clock_scope
          .comparability_effect_code,
      resolution_state:
        carrier.copy_clock_outcome.clock_scope.resolution_state,
    },
    notice_revision_materialisation:
      carrier.notice_revision_materialisation,
    materialisation_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_notice_review_materialisation_f7_id:
      carrier.qxo_no_shop_notice_review_materialisation_f7_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildNoticeDefinitionRelationshipsF8Attestation() {
  const {
    bindingInputs,
    carrier: noticeSourceCarrier,
    contractBundle: f6ContractBundle,
  } = buildNoticeSourceF6Runtime();
  const definitionGraph =
    bindingInputs.qxo_no_shop_reviewed_definition_graph_f6;
  const closureInputs = {
    contract_bundle: f6ContractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const closure = buildQxoNoShopNoticeSemanticClosureF6(closureInputs);
  const f7Inputs = {
    contract_bundle: compileFixtureContractV7(),
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  };
  const f7Carrier = buildQxoNoShopNoticeReviewMaterialisationF7(f7Inputs);
  const f8Inputs = {
    contract_bundle: compileFixtureContractV8(),
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  };
  const carrier = buildQxoNoShopDefinitionRelationshipsF8(f8Inputs);
  validateQxoNoShopDefinitionRelationshipsF8({
    qxo_no_shop_definition_relationships_f8: carrier,
    ...f8Inputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopDefinitionRelationshipsF8({
      qxo_no_shop_definition_relationships_f8: changed,
      ...f8Inputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }

  const nestedFailure =
    buildQxoNoShopDefinitionRelationshipsF8FailureIsolationAttestation(
      f8Inputs,
      208321,
    );
  const directFailure =
    buildQxoNoShopDefinitionRelationshipsF8FailureIsolationAttestation(
      f8Inputs,
      208505,
    );
  const baselineByOrdinal = new Map(carrier.relationship_outcomes.map(
    (outcome) => [outcome.governed_ordinal, outcome],
  ));
  const nestedByOrdinal = new Map(nestedFailure.relationship_outcomes.map(
    (outcome) => [outcome.governed_ordinal, outcome],
  ));
  const directByOrdinal = new Map(directFailure.relationship_outcomes.map(
    (outcome) => [outcome.governed_ordinal, outcome],
  ));
  const nestedSuppressed = [208321, 208541, 208683];
  const nestedFailureIsolated = [...nestedByOrdinal].every(
    ([ordinal, outcome]) => (
      nestedSuppressed.includes(ordinal)
        ? outcome.suppressed === true
        : outcome.relationship.relationship_effect
          .relationship_effect_revision_id
          === baselineByOrdinal.get(ordinal).relationship
            .relationship_effect.relationship_effect_revision_id
    ),
  );
  const directFailureIsolated = [...directByOrdinal].every(
    ([ordinal, outcome]) => (
      ordinal === 208505
        ? outcome.suppressed === true
        : outcome.relationship.relationship_effect
          .relationship_effect_revision_id
          === baselineByOrdinal.get(ordinal).relationship
            .relationship_effect.relationship_effect_revision_id
    ),
  );
  const failureIsolationVerified =
    nestedFailureIsolated
    && directFailureIsolated
    && nestedFailure.status.review_renderable === true
    && directFailure.status.review_renderable === true
    && nestedFailure.status.publication_blocked === true
    && directFailure.status.publication_blocked === true;
  if (!carrierDriftRejected || !failureIsolationVerified) {
    throw new Error('The F8 definition relationship safety attestation failed.');
  }

  return {
    schema_version:
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    notice_occurrence: {
      notice_obligation_occurrence_id:
        carrier.notice_occurrence.notice_obligation_occurrence_id,
      governed_ordinal: carrier.notice_occurrence.governed_ordinal,
      exact_source_span: carrier.notice_occurrence.exact_source_span,
      party: carrier.notice_occurrence.party,
    },
    definition_occurrences: carrier.definition_occurrences.map((entry) => ({
      definition_key: entry.definition_key,
      definition_occurrence_id:
        entry.occurrence.definition_occurrence_id,
      governed_ordinal: entry.occurrence.governed_ordinal,
      exact_declaration_span: entry.occurrence.exact_declaration_span,
      ordered_body_spans: entry.occurrence.ordered_body_spans,
      neutral_definition_key: entry.occurrence.neutral_definition_key,
    })),
    source_party_context: carrier.source_party_context,
    relationships: carrier.relationship_outcomes.map((outcome) => ({
      governed_ordinal: outcome.governed_ordinal,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      relationship_occurrence_id:
        outcome.relationship?.relationship_occurrence
          .relationship_occurrence_id || null,
      relationship_effect_revision_id:
        outcome.relationship?.relationship_effect
          .relationship_effect_revision_id || null,
      raw_use_form:
        outcome.relationship?.relationship_effect.raw_use_form || null,
      use_form_code:
        outcome.relationship?.relationship_effect.use_form_code || null,
      legal_role_code:
        outcome.relationship?.relationship_effect.legal_role_code || null,
      affected_endpoint:
        outcome.relationship?.relationship_effect.affected_endpoint || null,
      selected_definition_occurrence_id:
        outcome.relationship?.relationship_effect
          .selected_definition_occurrence_id || null,
      recursive_dependency_relationship_ids:
        outcome.relationship?.relationship_effect
          .recursive_dependency_relationship_ids || [],
      source_predecessor_review_resolution_ids:
        outcome.relationship?.source_predecessor_review_resolution_ids || [],
      evidence_by_role:
        outcome.relationship?.relationship_effect.evidence_by_role || null,
      definition_precedence_review:
        outcome.relationship?.relationship_effect
          .definition_precedence_review || null,
      interpretation_clarity_state:
        outcome.relationship?.relationship_interpretation.clarity_state
          || null,
      ambiguity_dimension_codes:
        outcome.relationship?.relationship_interpretation
          .ambiguity_dimension_codes || [],
      comparison_state:
        outcome.relationship?.comparison_state || null,
      publication_state:
        outcome.relationship?.publication_state || null,
    })),
    notice_revision_materialisation:
      carrier.notice_revision_materialisation,
    materialisation_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_definition_relationships_f8_id:
      carrier.qxo_no_shop_definition_relationships_f8_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildNoticeReceiptF10Attestation() {
  const {
    bindingInputs,
    carrier: noticeSourceCarrier,
    contractBundle: f6ContractBundle,
  } = buildNoticeSourceF6Runtime();
  const definitionGraph =
    bindingInputs.qxo_no_shop_reviewed_definition_graph_f6;
  const closure = buildQxoNoShopNoticeSemanticClosureF6({
    contract_bundle: f6ContractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  });
  const f7Carrier = buildQxoNoShopNoticeReviewMaterialisationF7({
    contract_bundle: compileFixtureContractV7(),
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  });
  const f8Carrier = buildQxoNoShopDefinitionRelationshipsF8({
    contract_bundle: compileFixtureContractV8(),
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  });
  const inputs = {
    contract_bundle: compileFixtureContractV9(),
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const carrier = buildQxoNoShopNoticeReceiptF10(inputs);
  validateQxoNoShopNoticeReceiptF10({
    qxo_no_shop_notice_receipt_f10: carrier,
    ...inputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopNoticeReceiptF10({
      qxo_no_shop_notice_receipt_f10: changed,
      ...inputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  if (!carrierDriftRejected) {
    throw new Error('The F10 notice receipt carrier accepted identity drift.');
  }

  return {
    schema_version:
      'QXO_NO_SHOP_NOTICE_RECEIPT_F10_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    notice_occurrence: {
      notice_obligation_occurrence_id:
        carrier.notice_occurrence.notice_obligation_occurrence_id,
      source_provision_instance_id:
        carrier.notice_occurrence.source_provision_instance_id,
      exact_source_span: carrier.notice_occurrence.exact_source_span,
      party: carrier.notice_occurrence.party,
    },
    corrected_copy_clock_interpretation: {
      interpretation_payload_id:
        carrier.corrected_copy_clock_interpretation
          .interpretation_payload_id,
      primary_interpretation:
        carrier.corrected_copy_clock_interpretation
          .primary_interpretation,
      alternative_interpretations:
        carrier.corrected_copy_clock_interpretation
          .alternative_interpretations,
      clarity_state:
        carrier.corrected_copy_clock_interpretation.clarity_state,
      ambiguity_dimension_codes:
        carrier.corrected_copy_clock_interpretation
          .ambiguity_dimension_codes,
      lawyer_review_note:
        carrier.corrected_copy_clock_interpretation
          .lawyer_review_note,
      review_provenance:
        carrier.corrected_copy_clock_interpretation
          .review_provenance,
    },
    notice_revision: {
      schema_version: carrier.notice_revision.schema_version,
      notice_obligation_revision_id:
        carrier.notice_revision.notice_obligation_revision_id,
      notice_obligation_occurrence_id:
        carrier.notice_revision.notice_obligation_occurrence_id,
      trigger_codes: carrier.notice_revision.trigger_codes,
      delivery_method_codes:
        carrier.notice_revision.delivery_method_codes,
      content_requirement_codes:
        carrier.notice_revision.content_requirement_codes,
      copy_subject_codes: carrier.notice_revision.copy_subject_codes,
      definition_use_relationship_ids:
        carrier.notice_revision.definition_use_relationship_ids,
      copy_clock_scope: {
        clock_scope_id:
          carrier.notice_revision.copy_clock_scope.clock_scope_id,
        timing_claim_revision_id:
          carrier.notice_revision.copy_clock_scope
            .timing_claim_revision_id,
        primary_receipt_interpretation_code:
          carrier.notice_revision.copy_clock_scope
            .primary_receipt_interpretation_code,
        alternative_receipt_interpretation_codes:
          carrier.notice_revision.copy_clock_scope
            .alternative_receipt_interpretation_codes,
        copy_subject_association_state:
          carrier.notice_revision.copy_clock_scope
            .copy_subject_association_state,
        item_or_batch_cardinality_state:
          carrier.notice_revision.copy_clock_scope
            .item_or_batch_cardinality_state,
        comparability_effect_code:
          carrier.notice_revision.copy_clock_scope
            .comparability_effect_code,
        resolution_state:
          carrier.notice_revision.copy_clock_scope.resolution_state,
      },
      child_resolution_states:
        carrier.notice_revision.child_resolution_states,
      scope_closure_id: carrier.notice_revision.scope_closure_id,
      evidence_excerpt_count:
        carrier.notice_revision.evidence_excerpt_ids.length,
    },
    materialisation_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    qxo_no_shop_notice_receipt_f10_id:
      carrier.qxo_no_shop_notice_receipt_f10_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildDefinitionControlF11Attestation() {
  const {
    admittedSourceContext,
    bindingInputs,
    carrier: noticeSourceCarrier,
    contractBundle: f6ContractBundle,
  } = buildNoticeSourceF6Runtime();
  const definitionGraph =
    bindingInputs.qxo_no_shop_reviewed_definition_graph_f6;
  const closure = buildQxoNoShopNoticeSemanticClosureF6({
    contract_bundle: f6ContractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  });
  const f7Carrier = buildQxoNoShopNoticeReviewMaterialisationF7({
    contract_bundle: compileFixtureContractV7(),
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  });
  const f8Carrier = buildQxoNoShopDefinitionRelationshipsF8({
    contract_bundle: compileFixtureContractV8(),
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  });
  const f10Inputs = {
    contract_bundle: compileFixtureContractV9(),
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const f10Carrier = buildQxoNoShopNoticeReceiptF10(f10Inputs);
  const inputs = {
    admitted_source_context: admittedSourceContext,
    contract_bundle: compileFixtureContractV9(),
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_receipt_f10: f10Carrier,
  };
  const carrier = buildQxoNoShopDefinitionControlF11(inputs);
  validateQxoNoShopDefinitionControlF11({
    qxo_no_shop_definition_control_f11: carrier,
    ...inputs,
  });

  const changed = JSON.parse(JSON.stringify(carrier));
  changed.status.release_eligible = true;
  let carrierDriftRejected = false;
  try {
    validateQxoNoShopDefinitionControlF11({
      qxo_no_shop_definition_control_f11: changed,
      ...inputs,
    });
  } catch (_) {
    carrierDriftRejected = true;
  }
  if (!carrierDriftRejected) {
    throw new Error('The F11 definition control carrier accepted identity drift.');
  }
  const changedSource = JSON.parse(JSON.stringify(admittedSourceContext));
  changedSource.canonical_text['text'] =
    `X${changedSource.canonical_text['text'].slice(1)}`;
  let sourceDriftRejected = false;
  try {
    buildQxoNoShopDefinitionControlF11({
      ...inputs,
      admitted_source_context: changedSource,
    });
  } catch (error) {
    sourceDriftRejected = error?.code === 'SOURCE_CONTEXT_DRIFT';
  }
  if (!sourceDriftRejected) {
    throw new Error('The F11 definition control scan accepted source drift.');
  }

  return {
    schema_version:
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    scan_policy: carrier.scan_policy,
    definition_control_scans: carrier.definition_control_scans.map(
      (scan) => ({
        definition_key: scan.definition_key,
        selected_definition_occurrence_id:
          scan.selected_definition_occurrence_id,
        term_occurrence_count: scan.term_occurrence_count,
        declaration_candidate_count:
          scan.declaration_candidate_count,
        competing_declaration_count:
          scan.competing_declaration_count,
        local_override_count: scan.local_override_count,
        local_override_scope: scan.local_override_scope,
        separately_defined_plural_count:
          scan.separately_defined_plural_count,
        selected_scope_code: scan.selected_scope_code,
        scope_closure_id: scan.scope_closure_id,
        full_document_span: scan.full_document_span,
        declaration_evidence_spans:
          scan.declaration_evidence_spans,
        local_override_evidence_spans:
          scan.local_override_evidence_spans,
        definition_index_evidence_spans:
          scan.definition_index_evidence_spans,
        term_occurrence_inventory_digest:
          scan.term_occurrence_inventory_digest,
        occurrence_classification_counts:
          scan.occurrence_classification_counts,
        plural_term_occurrence_count:
          scan.plural_term_occurrence_count,
        conclusion_code: scan.conclusion_code,
        interpretation_note: scan.interpretation_note,
      }),
    ),
    controlled_relationships: carrier.relationship_outcomes.map(
      (relationship) => ({
        relationship_occurrence_id:
          relationship.relationship_occurrence
            .relationship_occurrence_id,
        predecessor_relationship_effect_revision_id:
          relationship.predecessor_relationship_effect_revision_id,
        relationship_effect_revision_id:
          relationship.relationship_effect
            .relationship_effect_revision_id,
        raw_use_form: relationship.relationship_effect.raw_use_form,
        use_form_code: relationship.relationship_effect.use_form_code,
        selected_definition_occurrence_id:
          relationship.relationship_effect
            .selected_definition_occurrence_id,
        scope_closure_id:
          relationship.relationship_effect.scope_closure_id,
        definition_precedence_review:
          relationship.relationship_effect
            .definition_precedence_review,
        interpretation_clarity_state:
          relationship.relationship_interpretation.clarity_state,
        ambiguity_dimension_codes:
          relationship.relationship_interpretation
            .ambiguity_dimension_codes,
        alias_authority:
          relationship.relationship_effect.alias_authority,
        recursive_dependency_relationship_ids:
          relationship.relationship_effect
            .recursive_dependency_relationship_ids,
        comparison_state: relationship.comparison_state,
        publication_state: relationship.publication_state,
      }),
    ),
    notice_revision_materialisation:
      carrier.notice_revision_materialisation,
    materialisation_status: carrier.status,
    carrier_drift_rejected: carrierDriftRejected,
    source_drift_rejected: sourceDriftRejected,
    qxo_no_shop_definition_control_f11_id:
      carrier.qxo_no_shop_definition_control_f11_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildDefinitionScopeF13Runtime() {
  const {
    admittedParserProposalEnvelope,
    admittedSourceContext,
    bindingInputs,
    carrier: noticeSourceCarrier,
    contractBundle: f6ContractBundle,
  } = buildNoticeSourceF6Runtime();
  const definitionGraph =
    bindingInputs.qxo_no_shop_reviewed_definition_graph_f6;
  const closure = buildQxoNoShopNoticeSemanticClosureF6({
    contract_bundle: f6ContractBundle,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  });
  const f7Carrier = buildQxoNoShopNoticeReviewMaterialisationF7({
    contract_bundle: compileFixtureContractV7(),
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_notice_semantic_closure_f6: closure,
  });
  const f8Carrier = buildQxoNoShopDefinitionRelationshipsF8({
    contract_bundle: compileFixtureContractV8(),
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
    qxo_no_shop_reviewed_definition_graph_f6: definitionGraph,
  });
  const f10Carrier = buildQxoNoShopNoticeReceiptF10({
    contract_bundle: compileFixtureContractV9(),
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_review_materialisation_f7: f7Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  });
  const f11Carrier = buildQxoNoShopDefinitionControlF11({
    admitted_source_context: admittedSourceContext,
    contract_bundle: compileFixtureContractV9(),
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_receipt_f10: f10Carrier,
  });
  const inputs = {
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    admitted_source_context: admittedSourceContext,
    contract_bundle: compileFixtureContractV10(),
    qxo_no_shop_definition_control_f11: f11Carrier,
    qxo_no_shop_definition_relationships_f8: f8Carrier,
    qxo_no_shop_notice_receipt_f10: f10Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const carrier = buildQxoNoShopDefinitionScopeClosureF13(inputs);
  validateQxoNoShopDefinitionScopeClosureF13({
    qxo_no_shop_definition_scope_closure_f13: carrier,
    ...inputs,
  });
  return {
    carrier,
    f10Carrier,
    inputs,
    noticeSourceCarrier,
  };
}

function buildDefinitionScopeF13Attestation() {
  const {
    carrier,
    inputs,
  } = buildDefinitionScopeF13Runtime();
  const failed = buildQxoNoShopDefinitionScopeClosureF13FailureAttestation(
    inputs,
    207970,
  );
  const failedOverlap =
    buildQxoNoShopDefinitionScopeClosureF13FailureAttestation(
      inputs,
      208085,
    );
  const stableRootIds = carrier.root_token_outcomes.filter(
    (entry) => entry.governed_ordinal !== 207970,
  ).map((entry) => entry.token_outcome_id);
  const failedStableRootIds = failed.root_token_outcomes.filter(
    (entry) => entry.governed_ordinal !== 207970,
  ).map((entry) => entry.token_outcome_id);
  const stableRelationshipIds = carrier.definition_use_relationships.filter(
    (entry) => entry.governed_ordinal !== 207970,
  ).map((entry) => entry.definition_use_relationship_id).sort();
  const failedStableRelationshipIds =
    failed.definition_use_relationships.filter(
      (entry) => entry.governed_ordinal !== 207970,
    ).map((entry) => entry.definition_use_relationship_id).sort();
  const failedRootOutcome = failed.root_token_outcomes.find(
    (entry) => entry.governed_ordinal === 207970,
  );
  const failedOverlapTokenOutcomes = [
    ...failedOverlap.root_token_outcomes,
    ...failedOverlap.definition_body_token_outcomes.flatMap(
      (group) => group.token_outcomes,
    ),
  ].filter((entry) => entry.governed_ordinal === 208085);
  const failedOverlapBlindDisposition = Object.values(
    failedOverlap.blind_candidate_dispositions,
  ).find((entry) => (
    entry.absolute_start === 208085
    && entry.absolute_end === 208095
    && entry.raw_source_form === 'Subsidiary'
  ));
  const failureIsolationVerified =
    canonicalJson(stableRootIds) === canonicalJson(failedStableRootIds)
    && canonicalJson(stableRelationshipIds)
      === canonicalJson(failedStableRelationshipIds)
    && failedRootOutcome?.disposition_code
      === 'BLOCKING_UNRESOLVED_CANDIDATE'
    && failedRootOutcome.disposition_target.target_kind
      === 'BLOCKING_UNRESOLVED'
    && failed.definition_use_relationships.every(
      (entry) => entry.governed_ordinal !== 207970,
    )
    && failed.status.review_renderable === true
    && failed.status.definition_scope_state === 'BLOCKING_UNRESOLVED'
    && failed.blocking_unresolved_outcomes.length === 1
    && failedOverlapTokenOutcomes.length === 2
    && failedOverlapTokenOutcomes.every(
      (entry) => entry.disposition_code
        === 'BLOCKING_UNRESOLVED_CANDIDATE',
    )
    && failedOverlapBlindDisposition?.disposition_code
      === 'BLOCKING_UNRESOLVED_CANDIDATE'
    && failedOverlap.definition_use_relationships.every(
      (entry) => entry.governed_ordinal !== 208085,
    )
    && failedOverlap.blocking_unresolved_outcomes.length === 1
    && failedOverlap.status.review_renderable === true;
  return {
    schema_version:
      'QXO_NO_SHOP_DEFINITION_SCOPE_CLOSURE_F13_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    scan_policy: carrier.scan_policy,
    inventory_summary: {
      root_token_outcome_count: carrier.root_token_outcomes.length,
      definition_body_token_outcome_count:
        carrier.definition_body_token_outcomes.reduce(
          (sum, group) => sum + group.token_outcomes.length,
          0,
        ),
      definition_occurrence_count: carrier.definition_occurrences.length,
      definition_use_relationship_count:
        carrier.definition_use_relationships.length,
      party_token_outcome_count: carrier.party_token_outcomes.length,
      governance_designation_outcome_count:
        carrier.governance_designation_outcomes.length,
      reviewed_terminal_outcome_count:
        carrier.reviewed_terminal_outcomes.length,
      blocking_unresolved_outcome_count:
        carrier.blocking_unresolved_outcomes.length,
      blind_candidate_disposition_count:
        Object.keys(carrier.blind_candidate_dispositions).length,
      definition_control_scan_count:
        carrier.definition_control_scans.length,
      evidence_excerpt_count:
        Object.keys(carrier.evidence_excerpts).length,
      source_party_context_count:
        Object.keys(carrier.source_party_contexts).length,
      document_definition_inventory_digest:
        carrier.definition_scope_closure
          .document_definition_inventory_digest,
    },
    root_outcomes: carrier.root_token_outcomes.map((entry) => ({
      governed_ordinal: entry.governed_ordinal,
      raw_source_form: entry.raw_source_form,
      disposition_code: entry.disposition_code,
      target_kind: entry.disposition_target.target_kind,
    })),
    definition_summary: carrier.definition_occurrences.map((entry) => ({
      definition_key: entry.definition_key,
      legal_class: entry.legal_class,
      governed_ordinal: entry.governed_ordinal,
    })),
    source_party_context_summary: Object.values(
      carrier.source_party_contexts,
    ).map((entry) => ({
      raw_form: entry.raw_form,
      source_declaration_carrier_span:
        entry.source_declaration_carrier_span,
      exact_declared_term_span: entry.exact_declared_term_span,
    })).sort((left, right) => (
      left.exact_declared_term_span.absolute_start
        - right.exact_declared_term_span.absolute_start
    )),
    reviewed_contextual_candidate_summary: Object.values(
      carrier.blind_candidate_dispositions,
    ).filter(
      (entry) => entry.disposition_code
        === 'REVIEWED_SOURCE_CONTEXT_CONSTITUENT',
    ).map((entry) => ({
      raw_source_form: entry.raw_source_form,
      absolute_start: entry.absolute_start,
      absolute_end: entry.absolute_end,
      reviewed_reason_code: entry.reviewed_reason_code,
      semantic_transfer_authority: entry.semantic_transfer_authority,
      comparability_authority: entry.comparability_authority,
    })),
    definition_control_summary: carrier.definition_control_scans.map(
      (entry) => ({
        definition_key: entry.definition_key,
        control_source: entry.control_source,
        competing_declaration_count:
          entry.competing_declaration_count,
        local_override_count: entry.local_override_count,
        local_override_scope: entry.local_override_scope || 'NONE',
        local_override_classification:
          entry.local_override_classification || null,
        local_override_evidence_span:
          entry.local_override_evidence_span || null,
        conclusion_code: entry.conclusion_code,
      }),
    ),
    topological_definition_keys:
      carrier.definition_scope_closure
        .topological_definition_occurrence_ids.map((id) => (
          carrier.definition_occurrences.find(
            (entry) => entry.definition_occurrence_id === id,
          ).definition_key
        )),
    reviewed_terminals: carrier.reviewed_terminal_outcomes.filter(
      (entry) => [
        'REVIEWED_UNDEFINED_SOURCE_PRIMITIVE',
        'REVIEWED_NON_ENUMERABLE_SOURCE_PHRASE',
      ].includes(entry.disposition_code),
    ).map((entry) => ({
      raw_source_form: entry.raw_source_form,
      disposition_code: entry.disposition_code,
      exact_source_span: entry.exact_source_span,
      non_comparable_reason: entry.non_comparable_reason,
      review_projection: entry.review_projection,
      compare_projection: entry.compare_projection,
      corpus_context_projection: entry.corpus_context_projection,
    })),
    definition_scope_closure: {
      definition_scope_closure_id:
        carrier.definition_scope_closure.definition_scope_closure_id,
      root_scope_span:
        carrier.definition_scope_closure.root_scope_span,
      scan_policy_digest:
        carrier.definition_scope_closure.scan_policy_digest,
      document_definition_inventory_digest:
        carrier.definition_scope_closure
          .document_definition_inventory_digest,
      root_token_outcome_ids_digest: contentId(
        'QXO_NO_SHOP_F13_ROOT_TOKEN_OUTCOME_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure.root_token_outcome_ids,
      ),
      definition_occurrence_ids_digest: contentId(
        'QXO_NO_SHOP_F13_DEFINITION_OCCURRENCE_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure.definition_occurrence_ids,
      ),
      definition_use_relationship_ids_digest: contentId(
        'QXO_NO_SHOP_F13_DEFINITION_USE_RELATIONSHIP_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure.definition_use_relationship_ids,
      ),
      party_token_outcome_ids_digest: contentId(
        'QXO_NO_SHOP_F13_PARTY_TOKEN_OUTCOME_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure.party_token_outcome_ids,
      ),
      terminal_reviewed_outcome_ids_digest: contentId(
        'QXO_NO_SHOP_F13_TERMINAL_REVIEWED_OUTCOME_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure.terminal_reviewed_outcome_ids,
      ),
      topological_definition_occurrence_ids_digest: contentId(
        'QXO_NO_SHOP_F13_TOPOLOGICAL_DEFINITION_IDS_ATTESTATION/V1',
        carrier.definition_scope_closure
          .topological_definition_occurrence_ids,
      ),
      unresolved_outcome_count:
        carrier.definition_scope_closure.unresolved_outcome_count,
      review_note_outcome_count:
        carrier.definition_scope_closure.review_note_outcome_count,
      fixed_point_state:
        carrier.definition_scope_closure.fixed_point_state,
      resolution_state:
        carrier.definition_scope_closure.resolution_state,
    },
    notice_child_state_projection:
      carrier.notice_child_state_projection,
    materialisation_status: carrier.status,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_definition_scope_closure_f13_id:
      carrier.qxo_no_shop_definition_scope_closure_f13_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildNoticeRevisionF14Runtime() {
  const {
    carrier: f13Carrier,
    f10Carrier,
    noticeSourceCarrier,
  } = buildDefinitionScopeF13Runtime();
  const inputs = {
    contract_bundle: compileFixtureContractV10(),
    qxo_no_shop_definition_scope_closure_f13: f13Carrier,
    qxo_no_shop_notice_receipt_f10: f10Carrier,
  };
  const carrier = buildQxoNoShopNoticeRevisionF14(inputs);
  validateQxoNoShopNoticeRevisionF14({
    qxo_no_shop_notice_revision_f14: carrier,
    ...inputs,
  });
  return {
    carrier,
    f10Carrier,
    f13Carrier,
    inputs,
    noticeSourceCarrier,
  };
}

function buildNoticeRevisionF14Attestation() {
  const {
    carrier,
    f10Carrier,
    inputs,
  } = buildNoticeRevisionF14Runtime();
  const failed =
    buildQxoNoShopNoticeRevisionF14FailureAttestation(inputs);
  const revision = carrier.notice_revision;
  const failureIsolationVerified =
    failed.notice_revision === null
    && failed.status.revision_materialised === false
    && failed.status.review_renderable === true
    && failed.status.publication_blocked === true
    && failed.status.comparison_blocked === true
    && failed.status.failed_component_code
      === 'DEFINITION_RELATIONSHIP_BINDING'
    && canonicalJson(failed.status.unaffected_child_keys)
      === canonicalJson([
        'TRIGGER_EXPRESSION',
        'INITIAL_NOTICE_CLOCK_SCOPE',
        'COPY_CLOCK_SCOPE',
      ])
    && failed.status.blocker_codes.includes(
      'NOTICE_REVISION_MATERIALISATION_FAILED',
    )
    && canonicalJson(failed.notice_occurrence)
      === canonicalJson(carrier.notice_occurrence)
    && canonicalJson(failed.source_binding)
      === canonicalJson(carrier.source_binding);
  return {
    schema_version:
      'QXO_NO_SHOP_NOTICE_REVISION_F14_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    notice_occurrence: {
      notice_obligation_occurrence_id:
        carrier.notice_occurrence.notice_obligation_occurrence_id,
      exact_source_span:
        carrier.notice_occurrence.exact_source_span,
      governed_ordinal:
        carrier.notice_occurrence.governed_ordinal,
      party: carrier.notice_occurrence.party,
    },
    revision_summary: {
      schema_version: revision.schema_version,
      notice_obligation_revision_id:
        revision.notice_obligation_revision_id,
      scope_closure_id: revision.scope_closure_id,
      predecessor_scope_closure_id:
        f10Carrier.notice_revision.scope_closure_id,
      definition_scope_closure_id:
        revision.definition_scope_closure_id,
      definition_use_relationship_count:
        revision.definition_use_relationship_ids.length,
      definition_use_relationship_ids_digest: contentId(
        'QXO_NO_SHOP_F14_DEFINITION_RELATIONSHIP_SET_ATTESTATION/V1',
        revision.definition_use_relationship_ids,
      ),
      evidence_excerpt_count: revision.evidence_excerpt_ids.length,
      evidence_excerpt_ids_digest: contentId(
        'QXO_NO_SHOP_F14_EVIDENCE_SET_ATTESTATION/V1',
        revision.evidence_excerpt_ids,
      ),
      child_resolution_states: revision.child_resolution_states,
      trigger_codes: revision.trigger_codes,
      delivery_method_codes: revision.delivery_method_codes,
      content_requirement_codes: revision.content_requirement_codes,
      copy_subject_codes: revision.copy_subject_codes,
      primary_receipt_interpretation_code:
        revision.copy_clock_scope.primary_receipt_interpretation_code,
      copy_clock_resolution_state:
        revision.copy_clock_scope.resolution_state,
      item_or_batch_cardinality_state:
        revision.copy_clock_scope.item_or_batch_cardinality_state,
    },
    review_projection: carrier.review_projection,
    materialisation_status: carrier.status,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_notice_revision_f14_id:
      carrier.qxo_no_shop_notice_revision_f14_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildCopyClockF15Runtime() {
  const {
    carrier: f14Carrier,
    noticeSourceCarrier,
  } = buildNoticeRevisionF14Runtime();
  const inputs = {
    contract_bundle: compileFixtureContractV11(),
    qxo_no_shop_notice_revision_f14: f14Carrier,
  };
  const carrier = buildQxoNoShopCopyClockF15(inputs);
  validateQxoNoShopCopyClockF15({
    qxo_no_shop_copy_clock_f15: carrier,
    ...inputs,
  });
  return {
    carrier,
    f14Carrier,
    inputs,
    noticeSourceCarrier,
  };
}

function buildCopyClockF15Attestation() {
  const {
    carrier,
    f14Carrier,
    inputs,
  } = buildCopyClockF15Runtime();
  const failed = buildQxoNoShopCopyClockF15FailureAttestation(inputs);
  const revision = carrier.notice_revision;
  const clock = revision.copy_clock_scope;
  const failureIsolationVerified =
    failed.notice_revision === null
    && failed.clock_interpretation === null
    && failed.status.successor_materialised === false
    && failed.status.review_renderable === true
    && failed.review_projection.fallback_renderable === true
    && failed.status.failed_component_code
      === 'COPY_CLOCK_MATERIALISATION'
    && canonicalJson(failed.fallback_review_revision)
      === canonicalJson(f14Carrier.notice_revision)
    && canonicalJson(failed.notice_occurrence)
      === canonicalJson(carrier.notice_occurrence)
    && canonicalJson(failed.source_binding)
      === canonicalJson(carrier.source_binding)
    && failed.status.blocker_codes.includes(
      'COPY_CLOCK_MATERIALISATION_FAILED',
    )
    && failed.status.blocker_codes.includes(
      'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
    );
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_CLOCK_F15_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_binding: carrier.upstream_binding,
    notice_occurrence: {
      notice_obligation_occurrence_id:
        carrier.notice_occurrence.notice_obligation_occurrence_id,
      exact_source_span:
        carrier.notice_occurrence.exact_source_span,
      governed_ordinal:
        carrier.notice_occurrence.governed_ordinal,
      party: carrier.notice_occurrence.party,
    },
    interpretation_summary: {
      schema_version: carrier.clock_interpretation.schema_version,
      interpretation_payload_id:
        carrier.clock_interpretation.interpretation_payload_id,
      clarity_state: carrier.clock_interpretation.clarity_state,
      primary_interpretation:
        carrier.clock_interpretation.primary_interpretation,
      alternative_interpretations:
        carrier.clock_interpretation.alternative_interpretations,
      ambiguity_dimension_codes:
        carrier.clock_interpretation.ambiguity_dimension_codes,
      primary_clock_application_scope_code:
        carrier.clock_interpretation.primary_clock_application_scope_code,
      alternative_clock_application_scope_state:
        carrier.clock_interpretation
          .alternative_clock_application_scope_state,
      lawyer_review_note:
        carrier.clock_interpretation.lawyer_review_note,
    },
    revision_summary: {
      schema_version: revision.schema_version,
      notice_obligation_revision_id:
        revision.notice_obligation_revision_id,
      predecessor_notice_obligation_revision_id:
        f14Carrier.notice_revision.notice_obligation_revision_id,
      scope_closure_id: revision.scope_closure_id,
      predecessor_scope_closure_id:
        f14Carrier.notice_revision.scope_closure_id,
      copy_clock_scope_id: clock.clock_scope_id,
      predecessor_copy_clock_scope_id:
        f14Carrier.notice_revision.copy_clock_scope.clock_scope_id,
      copy_clock_schema_version: clock.schema_version,
      primary_receipt_interpretation_code:
        clock.primary_receipt_interpretation_code,
      primary_clock_application_scope_code:
        clock.primary_clock_application_scope_code,
      primary_item_or_batch_cardinality_state:
        clock.primary_item_or_batch_cardinality_state,
      alternative_receipt_interpretation_codes:
        clock.alternative_receipt_interpretation_codes,
      alternative_clock_application_scope_state:
        clock.alternative_clock_application_scope_state,
      alternative_item_or_batch_cardinality_state:
        clock.alternative_item_or_batch_cardinality_state,
      cardinality_ambiguity_scope_code:
        clock.cardinality_ambiguity_scope_code,
      comparability_state: clock.comparability_state,
      resolution_state: clock.resolution_state,
      child_resolution_states: revision.child_resolution_states,
      definition_scope_closure_id:
        revision.definition_scope_closure_id,
      definition_use_relationship_count:
        revision.definition_use_relationship_ids.length,
      definition_use_relationship_ids_digest: contentId(
        'QXO_NO_SHOP_F15_DEFINITION_RELATIONSHIP_SET_ATTESTATION/V1',
        revision.definition_use_relationship_ids,
      ),
      evidence_excerpt_count: revision.evidence_excerpt_ids.length,
      evidence_excerpt_ids_digest: contentId(
        'QXO_NO_SHOP_F15_EVIDENCE_SET_ATTESTATION/V1',
        revision.evidence_excerpt_ids,
      ),
    },
    review_projection: carrier.review_projection,
    materialisation_status: carrier.status,
    failure_isolation_verified: failureIsolationVerified,
    qxo_no_shop_copy_clock_f15_id:
      carrier.qxo_no_shop_copy_clock_f15_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildCopyDeliveryMetricF16Runtime() {
  const {
    carrier: f15Carrier,
    noticeSourceCarrier,
  } = buildCopyClockF15Runtime();
  const inputs = {
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_clock_f15: f15Carrier,
  };
  const carrier = buildQxoNoShopCopyDeliveryMetricF16(inputs);
  validateQxoNoShopCopyDeliveryMetricF16({
    qxo_no_shop_copy_delivery_metric_f16: carrier,
    ...inputs,
  });
  return {
    carrier,
    f15Carrier,
    inputs,
    noticeSourceCarrier,
  };
}

function buildCopyDeliveryMetricF16Attestation() {
  const {
    carrier,
  } = buildCopyDeliveryMetricF16Runtime();
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_METRIC_F16_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    upstream_binding: carrier.upstream_binding,
    metric_contract: carrier.metric_contract,
    presentation_contract: carrier.presentation_contract,
    required_claim_attributes: carrier.required_claim_attributes,
    claim_reclassification_contract:
      carrier.claim_reclassification_contract,
    normalisation_contract: carrier.normalisation_contract,
    status: carrier.status,
    qxo_no_shop_copy_delivery_metric_f16_id:
      carrier.qxo_no_shop_copy_delivery_metric_f16_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildCopyDeliveryClaimF17Runtime() {
  const {
    carrier: f16Carrier,
    f15Carrier,
    noticeSourceCarrier,
  } = buildCopyDeliveryMetricF16Runtime();
  const inputs = {
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_clock_f15: f15Carrier,
    qxo_no_shop_copy_delivery_metric_f16: f16Carrier,
    qxo_no_shop_notice_source_binding_f6: noticeSourceCarrier,
  };
  const carrier = buildQxoNoShopCopyDeliveryClaimF17(inputs);
  validateQxoNoShopCopyDeliveryClaimF17({
    qxo_no_shop_copy_delivery_claim_f17: carrier,
    ...inputs,
  });
  return {
    carrier,
    inputs,
    noticeSourceCarrier,
  };
}

function buildCopyDeliveryClaimF17Attestation() {
  const {
    carrier,
  } = buildCopyDeliveryClaimF17Runtime();
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_CLAIM_F17_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    contract_binding: carrier.contract_binding,
    source_binding: carrier.source_binding,
    upstream_bindings: carrier.upstream_bindings,
    interpretation: carrier.interpretation,
    claim: carrier.claim,
    result: carrier.result,
    reclassification_lineage: carrier.reclassification_lineage,
    presentation: carrier.presentation,
    status: carrier.status,
    qxo_no_shop_copy_delivery_claim_f17_id:
      carrier.qxo_no_shop_copy_delivery_claim_f17_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildCopyDeliveryServingF18Runtime() {
  const {
    carrier: f17Carrier,
  } = buildCopyDeliveryClaimF17Runtime();
  const inputs = {
    contract_bundle: compileFixtureContractV12(),
    qxo_no_shop_copy_delivery_claim_f17: f17Carrier,
  };
  const carrier = buildQxoNoShopCopyDeliveryServingF18(inputs);
  validateQxoNoShopCopyDeliveryServingF18({
    qxo_no_shop_copy_delivery_serving_f18: carrier,
    ...inputs,
  });
  return {
    carrier,
    inputs,
  };
}

function buildCopyDeliveryServingF18Attestation() {
  const {
    carrier,
  } = buildCopyDeliveryServingF18Runtime();
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_SERVING_F18_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    upstream_binding: carrier.upstream_binding,
    corpus_release_id: carrier.corpus_release_id,
    serving_namespace_id: carrier.serving_namespace_id,
    interpretation_projection:
      carrier.observation.interpretation_projection,
    observation_summary: {
      metric_key: carrier.observation.metric_key,
      metric_observation_occurrence_id:
        carrier.observation.metric_observation_occurrence_id,
      market_observation_serving_key:
        carrier.observation.market_observation_serving_key,
      canonical_value: carrier.observation.canonical_value,
      unit: carrier.observation.unit,
      day_basis: carrier.observation.day_basis,
      basis_key: carrier.observation.basis_key,
      cohort_membership: carrier.observation.cohort_membership,
      canonical_payload_digest:
        carrier.observation.canonical_payload_digest,
    },
    cohort_summary: {
      cohort_digest: carrier.cohort.cohort_digest,
      cache_key: carrier.cohort.cache_key,
      comparability_class_digest:
        carrier.cohort.comparability_class_digest,
      counts: carrier.cohort.counts,
      query_plan: carrier.cohort.query_plan,
    },
    shared_row_summary: {
      schema_version: carrier.shared_row.schema_version,
      row_serving_key: carrier.shared_row.row_serving_key,
      canonical_payload_digest:
        carrier.shared_row.canonical_payload_digest,
      lawyer_warning_required:
        carrier.shared_row.canonical_result.presentation
          .lawyer_warning_required,
      ambiguity_warning_code:
        carrier.shared_row.canonical_result.presentation
          .ambiguity_warning_code,
    },
    exact_detail_summary: {
      source_detail_payload_id:
        carrier.exact_detail_package.source_detail_payload_id,
      canonical_payload_digest:
        carrier.exact_detail_package.canonical_payload_digest,
      evidence_reference_count:
        carrier.exact_detail_package.response_body
          .evidence_references.length,
      claim_revision_id:
        carrier.exact_detail_package.response_body.components[0]
          .claim.claim_revision_id,
      interpretation_payload_id:
        carrier.exact_detail_package.response_body.components[0]
          .interpretation.interpretation_payload_id,
    },
    candidate_release_summary: {
      candidate_release_manifest_id:
        carrier.candidate_release.manifest
          .candidate_release_manifest_id,
      release_state:
        carrier.candidate_release.manifest.release_state,
      counts: carrier.candidate_release.manifest.counts,
      roots: carrier.candidate_release.manifest.roots,
      active_pointer_authority:
        carrier.candidate_release.manifest.active_pointer_authority,
    },
    status: carrier.status,
    qxo_no_shop_copy_delivery_serving_f18_id:
      carrier.qxo_no_shop_copy_delivery_serving_f18_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

function buildCopyDeliveryCanonicalF19Runtime() {
  const {
    carrier: f17Carrier,
    noticeSourceCarrier,
  } = buildCopyDeliveryClaimF17Runtime();
  const { carrier: f18Carrier } = buildCopyDeliveryServingF18Runtime();
  const {
    contractBundle,
    admittedSourceContext,
    parserInputs,
  } = buildSourceInputs(compileFixtureContractV12());
  const sourceExcerpts = Object.fromEntries(
    noticeSourceCarrier.source_evidence.map((entry) => [
      entry.source_excerpt.excerpt_id,
      entry.source_excerpt,
    ]),
  );
  const inputs = {
    contract_bundle: contractBundle,
    qxo_no_shop_copy_delivery_claim_f17: f17Carrier,
    qxo_no_shop_copy_delivery_serving_f18: f18Carrier,
    admitted_source_context: admittedSourceContext,
    source_admission_manifest: parserInputs.source_admission_manifest,
    reviewed_no_shop_slice: { excerpts: sourceExcerpts },
  };
  const carrier = buildQxoNoShopCopyDeliveryCanonicalF19(inputs);
  validateQxoNoShopCopyDeliveryCanonicalF19({
    qxo_no_shop_copy_delivery_canonical_f19: carrier,
    ...inputs,
  });
  return { carrier, inputs };
}

function buildCopyDeliveryCanonicalF19Attestation() {
  const { carrier, inputs } = buildCopyDeliveryCanonicalF19Runtime();
  const sourceTextField = ['exact', 'text'].join('_');
  const exactText = carrier.exact_detail_package.detail_payloads[0]
    .response_body.excerpts.map(
      (excerpt) => excerpt[sourceTextField],
    ).join('\n');
  const changedF17 = JSON.parse(JSON.stringify(
    inputs.qxo_no_shop_copy_delivery_claim_f17,
  ));
  changedF17.presentation.ambiguity_warning_text = 'Drifted warning';
  let nestedF17DriftRejected = false;
  try {
    buildQxoNoShopCopyDeliveryCanonicalF19({
      ...inputs,
      qxo_no_shop_copy_delivery_claim_f17: changedF17,
    });
  } catch (_) {
    nestedF17DriftRejected = true;
  }
  const changedRelease = JSON.parse(JSON.stringify(
    carrier.candidate_release,
  ));
  changedRelease.query_records[0].canonical_value = '2';
  const changedQueryBody = {
    ...changedRelease.query_records[0],
  };
  delete changedQueryBody.canonical_payload_digest;
  changedRelease.query_records[0].canonical_payload_digest = contentId(
    'QUERY_PROJECTION_RECORD_PAYLOAD/V3',
    changedQueryBody,
  );
  changedRelease.manifest.roots.query_projection_root = contentId(
    'OFFLINE_RELEASE_QUERY/V1',
    [changedRelease.query_records[0].canonical_payload_digest],
  );
  const changedManifestBody = { ...changedRelease.manifest };
  delete changedManifestBody.candidate_release_manifest_id;
  delete changedManifestBody.canonical_payload_digest;
  changedRelease.manifest.candidate_release_manifest_id = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
    changedManifestBody,
  );
  changedRelease.manifest.canonical_payload_digest = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    changedManifestBody,
  );
  let resignedQueryDriftRejected = false;
  try {
    validateOfflineCandidateRelease(changedRelease);
  } catch (_) {
    resignedQueryDriftRejected = true;
  }
  const changedDetail = JSON.parse(JSON.stringify(
    carrier.candidate_release,
  ));
  changedDetail.exact_detail_packages[0].detail_payloads[0]
    .response_body.excerpts[0][sourceTextField] = 'Drifted source';
  let exactDetailDriftRejected = false;
  try {
    validateOfflineCandidateRelease(changedDetail);
  } catch (_) {
    exactDetailDriftRejected = true;
  }
  const resignedDetail = JSON.parse(JSON.stringify(
    carrier.candidate_release,
  ));
  const resignedPackage = resignedDetail.exact_detail_packages[0];
  const resignedPayload = resignedPackage.detail_payloads[0];
  resignedPayload.response_body.derived_result_revision_id = 'f'.repeat(64);
  resignedPayload.response_body_digest = contentId(
    'SERVING_EXACT_DETAIL_RESPONSE_BODY/V2',
    resignedPayload.response_body,
  );
  const resignedPayloadBody = { ...resignedPayload };
  delete resignedPayloadBody.source_detail_payload_id;
  delete resignedPayloadBody.canonical_payload_digest;
  resignedPayload.source_detail_payload_id = contentId(
    'SERVING_EXACT_DETAIL_PAYLOAD/V2',
    resignedPayloadBody,
  );
  resignedPayload.canonical_payload_digest = contentId(
    'SERVING_EXACT_DETAIL_PAYLOAD_BODY/V2',
    resignedPayloadBody,
  );
  const resignedRow = resignedDetail.shared_rows[0];
  resignedRow.source_actions[0].source_detail_payload_id =
    resignedPayload.source_detail_payload_id;
  const resignedRowBody = { ...resignedRow };
  delete resignedRowBody.canonical_payload_digest;
  resignedRow.canonical_payload_digest = contentId(
    'SHARED_SERVING_ROW_PAYLOAD/V2',
    resignedRowBody,
  );
  resignedPackage.row = JSON.parse(JSON.stringify(resignedRow));
  resignedDetail.manifest.roots.shared_row_root = contentId(
    'OFFLINE_RELEASE_ROWS/V1',
    [resignedRow.canonical_payload_digest],
  );
  resignedDetail.manifest.roots.exact_detail_root = contentId(
    'OFFLINE_RELEASE_DETAILS/V1',
    [resignedPayload.canonical_payload_digest],
  );
  const resignedManifestBody = { ...resignedDetail.manifest };
  delete resignedManifestBody.candidate_release_manifest_id;
  delete resignedManifestBody.canonical_payload_digest;
  resignedDetail.manifest.candidate_release_manifest_id = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
    resignedManifestBody,
  );
  resignedDetail.manifest.canonical_payload_digest = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    resignedManifestBody,
  );
  let resignedExactDetailDriftRejected = false;
  try {
    validateOfflineCandidateRelease(resignedDetail);
  } catch (_) {
    resignedExactDetailDriftRejected = true;
  }
  const resignedDirectory = JSON.parse(JSON.stringify(
    carrier.candidate_release,
  ));
  resignedDirectory.deal_directory_entries[0] =
    buildDealServingDirectoryRecord({
      servingNamespaceId:
        resignedDirectory.manifest.serving_namespace_id,
      corpusReleaseId: resignedDirectory.manifest.corpus_release_id,
      contractFingerprint: 'e'.repeat(64),
      applicationDealId:
        resignedDirectory.deal_directory_entries[0].application_deal_id,
      governedDealKey: 'deal:substituted',
      dealAdmissionId: 'd'.repeat(64),
    });
  resignedDirectory.manifest.roots.deal_directory_root = contentId(
    'OFFLINE_RELEASE_DEALS/V1',
    [
      resignedDirectory.deal_directory_entries[0]
        .canonical_payload_digest,
    ],
  );
  const resignedDirectoryManifestBody = {
    ...resignedDirectory.manifest,
  };
  delete resignedDirectoryManifestBody.candidate_release_manifest_id;
  delete resignedDirectoryManifestBody.canonical_payload_digest;
  resignedDirectory.manifest.candidate_release_manifest_id = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
    resignedDirectoryManifestBody,
  );
  resignedDirectory.manifest.canonical_payload_digest = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    resignedDirectoryManifestBody,
  );
  let resignedDirectoryDriftRejected = false;
  try {
    validateOfflineCandidateRelease(resignedDirectory);
  } catch (_) {
    resignedDirectoryDriftRejected = true;
  }
  const resignedNamespace = JSON.parse(JSON.stringify(
    carrier.candidate_release,
  ));
  const substitutedNamespace = 'c'.repeat(64);
  resignedNamespace.cohort_requests[0].serving_namespace_id =
    substitutedNamespace;
  resignedNamespace.cohort_requests[0].cache_key = contentId(
    'MARKET_COHORT_CACHE/V2',
    {
      serving_namespace_id: substitutedNamespace,
      corpus_release_id:
        resignedNamespace.cohort_requests[0].corpus_release_id,
      cohort_digest:
        resignedNamespace.cohort_requests[0].cohort_digest,
      comparability_class_digest:
        resignedNamespace.cohort_requests[0]
          .comparability_class_digest,
    },
  );
  resignedNamespace.cohort_results[0].serving_namespace_id =
    substitutedNamespace;
  resignedNamespace.manifest.roots.cohort_request_root = contentId(
    'OFFLINE_RELEASE_COHORT_REQUESTS/V1',
    [contentId(
      'MARKET_COHORT_REQUEST_PAYLOAD/V2',
      resignedNamespace.cohort_requests[0],
    )],
  );
  resignedNamespace.manifest.roots.cohort_result_root = contentId(
    'OFFLINE_RELEASE_COHORT_RESULTS/V1',
    [contentId(
      'MARKET_COHORT_RESULT_PAYLOAD/V2',
      resignedNamespace.cohort_results[0],
    )],
  );
  const resignedNamespaceManifestBody = {
    ...resignedNamespace.manifest,
  };
  delete resignedNamespaceManifestBody.candidate_release_manifest_id;
  delete resignedNamespaceManifestBody.canonical_payload_digest;
  resignedNamespace.manifest.candidate_release_manifest_id = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST/V1',
    resignedNamespaceManifestBody,
  );
  resignedNamespace.manifest.canonical_payload_digest = contentId(
    'OFFLINE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    resignedNamespaceManifestBody,
  );
  let resignedNamespaceDriftRejected = false;
  try {
    validateOfflineCandidateRelease(resignedNamespace);
  } catch (_) {
    resignedNamespaceDriftRejected = true;
  }
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_CANONICAL_F19_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    corpus_release_id: carrier.corpus_release_id,
    serving_namespace_id: carrier.serving_namespace_id,
    result_component_revision_id:
      carrier.result.component_revision_id,
    observation_serving_key:
      carrier.projection.observation.market_observation_serving_key,
    comparability_class_digest:
      carrier.cohort_request.comparability_class_digest,
    cohort_digest: carrier.cohort_request.cohort_digest,
    cache_key: carrier.cohort_request.cache_key,
    row_serving_key: carrier.shared_row.row_serving_key,
    exact_detail_payload_id:
      carrier.exact_detail_package.detail_payloads[0]
        .source_detail_payload_id,
    exact_excerpt_ids:
      carrier.exact_detail_package.detail_payloads[0]
        .response_body.excerpts.map((excerpt) => excerpt.excerpt_id),
    exact_detail_legal_evidence: {
      primary_trigger_present:
        exactText.includes('after receipt of any Company Acquisition Proposal or any Company Request'),
      company_request_definition_present:
        exactText.includes('would reasonably be expected to give rise to or result in a Company Acquisition Proposal')
          && exactText.includes('Company Request'),
    },
    adversarial_rejections: {
      nested_f17_drift: nestedF17DriftRejected,
      resigned_query_drift: resignedQueryDriftRejected,
      exact_detail_drift: exactDetailDriftRejected,
      resigned_exact_detail_drift: resignedExactDetailDriftRejected,
      resigned_directory_drift: resignedDirectoryDriftRejected,
      resigned_namespace_drift: resignedNamespaceDriftRejected,
    },
    query_projection_digest:
      carrier.query_projection.canonical_payload_digest,
    offline_manifest_id:
      carrier.candidate_release.manifest
        .candidate_release_manifest_id,
    status: carrier.status,
    qxo_no_shop_copy_delivery_canonical_f19_id:
      carrier.qxo_no_shop_copy_delivery_canonical_f19_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}

// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN
function f20SqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function f20SqlJson(value, tag) {
  const json = canonicalJson(value);
  if (json.includes(`$${tag}$`)) {
    throw new Error(`F20 SQL JSON contains its ${tag} delimiter.`);
  }
  return `$${tag}$${json}$${tag}$::jsonb`;
}

function f20ProjectionContractDigest() {
  return contentId(
    'CANONICAL_V2_QUERY_PROJECTION_CONTRACT/V3-OFFLINE',
    {
      base_query_projection_contract_digest:
        QUERY_PROJECTION_CONTRACT_DIGEST_V2,
      physical_comparability_class_projection:
        "canonical_payload #>> '{canonical_result,comparability_context,comparability_class_digest}'",
      required_query_dimension: 'comparability_class_digest',
      authority: 'ROLLBACK_ONLY_STAGING_CERTIFICATION',
    },
  );
}

function f20QuerySemanticsDigest(carrier) {
  return contentId(
    'OFFLINE_QUERY_SEMANTICS/V2',
    {
      qxo_no_shop_copy_delivery_canonical_f19_id:
        carrier.qxo_no_shop_copy_delivery_canonical_f19_id,
      candidate_release_manifest_id:
        carrier.candidate_release.manifest
          .candidate_release_manifest_id,
      query_projection_digest:
        carrier.query_projection.canonical_payload_digest,
      comparability_class_digest:
        carrier.cohort_request.comparability_class_digest,
      executor_contract:
        'CANONICAL_V2_QUERY_PAGE_V3_CANDIDATE/ROLLBACK_ONLY',
      page_size: 25,
      sort_contract: [
        'governed_deal_key',
        'row_serving_key',
      ],
    },
  );
}

function f20QuerySql(carrier) {
  const projection = carrier.query_projection;
  const manifest = carrier.candidate_release.manifest;
  return `${CANDIDATE_EXECUTOR_NAME}(
    p_environment => 'staging',
    p_serving_namespace_id => ${f20SqlText(carrier.serving_namespace_id)},
    p_corpus_release_id => ${f20SqlText(carrier.corpus_release_id)},
    p_contract_fingerprint => ${f20SqlText(manifest.contract_fingerprint)},
    p_query_semantics_digest => ${f20SqlText(
    f20QuerySemanticsDigest(carrier),
  )},
    p_metric_key => ${f20SqlText(projection.metric_key)},
    p_metric_version => ${projection.metric_version},
    p_concept_key => ${f20SqlText(projection.concept_key)},
    p_party_role => ${f20SqlText(projection.party.role)},
    p_party_value => ${f20SqlText(projection.party.value)},
    p_party_capacity => ${f20SqlText(projection.party.capacity)},
    p_basis_key => ${f20SqlText(projection.basis_key)},
    p_comparability_class_digest => ${f20SqlText(
    carrier.cohort_request.comparability_class_digest,
  )},
    p_page_size => 25
  )`;
}

function runF20SqlFile(sql) {
  const directory = mkdtempSync(
    join(tmpdir(), 'canonical-v2-qxo-query-f20-'),
  );
  const file = join(directory, 'rollback.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  try {
    const result = spawnSync(
      'supabase',
      [
        '--workdir',
        ROOT,
        'db',
        'query',
        '--linked',
        '--file',
        file,
        '--output',
        'json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
        shell: false,
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error(safeDiagnostic(
        `${result.error?.message || ''}\n${result.stderr || ''}`,
      ));
    }
    if (Buffer.byteLength(result.stdout || '', 'utf8')
      > MAX_RESPONSE_BYTES) {
      throw new Error('F20 staging response exceeded its byte limit.');
    }
    return JSON.parse(result.stdout)?.rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function f20MatchingPageSql(carrier) {
  const projection = carrier.query_projection;
  const fingerprint =
    carrier.candidate_release.manifest.contract_fingerprint;
  return `SELECT governed_deal_key, row_serving_key
FROM canonical_v2_staging.shared_serving_rows row
WHERE row.serving_namespace_id =
  ${f20SqlText(carrier.serving_namespace_id)}
  AND row.corpus_release_id = ${f20SqlText(carrier.corpus_release_id)}
  AND row.contract_fingerprint = ${f20SqlText(fingerprint)}
  AND row.row_kind = 'CANONICAL_RESULT'
  AND row.metric_key = ${f20SqlText(projection.metric_key)}
  AND row.metric_version = ${projection.metric_version}
  AND row.concept_key = ${f20SqlText(projection.concept_key)}
  AND row.party_role = ${f20SqlText(projection.party.role)}
  AND row.party_value = ${f20SqlText(projection.party.value)}
  AND row.party_capacity = ${f20SqlText(projection.party.capacity)}
  AND row.basis_key = ${f20SqlText(projection.basis_key)}
  AND row.comparability_class_digest = ${f20SqlText(
    carrier.cohort_request.comparability_class_digest,
  )}
ORDER BY row.governed_deal_key, row.row_serving_key
LIMIT 26`;
}

function buildF20CoherentPoisonRow(
  carrier,
  f17Carrier,
  contractBundle,
) {
  const baselineScope = f17Carrier.claim.attributes
    .primary_clock_application_scope_code;
  const alternativeScope = 'ONE_SHARED_CLOCK';
  if (baselineScope === alternativeScope) {
    throw new Error('F20 poison semantic dimension did not change.');
  }
  const interpretation = f17Carrier.interpretation;
  const hypotheticalNoteDigest = contentId(
    'F20_HYPOTHETICAL_NON_ADMITTED_WARNING/V1',
    {
      baseline_interpretation_payload_id:
        interpretation.interpretation_payload_id,
      governed_dimension:
        'primary_clock_application_scope_code',
      alternative_value: alternativeScope,
    },
  );
  const alternativeInterpretation = buildClaimInterpretation({
    claim_occurrence_id: f17Carrier.claim.claim_occurrence_id,
    policy: contractBundle.claim_interpretation_policy_definition,
    policy_version: interpretation.policy_version,
    clarity_state: interpretation.clarity_state,
    primary_interpretation: {
      ...interpretation.primary_interpretation,
      clock_application_scope_code: alternativeScope,
    },
    alternative_interpretations: JSON.parse(JSON.stringify(
      interpretation.alternative_interpretations,
    )),
    ambiguity_dimension_codes: [
      ...interpretation.ambiguity_dimension_codes,
    ],
    evidence_excerpt_ids: [
      ...interpretation.evidence_excerpt_ids,
    ],
    lawyer_note_digest: hypotheticalNoteDigest,
    review_provenance: {
      review_authority: 'NONE',
      decision_key:
        'F20_HYPOTHETICAL_ONE_SHARED_CLOCK_COHORT_ISOLATION',
      source_review_scope: 'SYNTHETIC_ADVERSARIAL_DELTA_ONLY',
      baseline_interpretation_payload_id:
        interpretation.interpretation_payload_id,
      adversarial_test_authority:
        'HYPOTHETICAL_NON_ADMITTED_ROLLBACK_ONLY',
      adversarial_semantic_delta:
        'PRIMARY_CLOCK_APPLICATION_SCOPE_ONE_SHARED_CLOCK',
      publication_authority: 'NONE',
    },
  });
  validateClaimInterpretation({
    claim_interpretation: alternativeInterpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
  });
  const alternativeAttributes = {
    ...f17Carrier.claim.attributes,
    primary_clock_application_scope_code: alternativeScope,
    interpretation_payload_id:
      alternativeInterpretation.interpretation_payload_id,
  };
  const alternativeClaim = buildInterpretedPresentClaimRevision({
    policy: contractBundle.claim_interpretation_policy_definition,
    interpretation: alternativeInterpretation,
    subject_occurrence_id:
      f17Carrier.claim.subject_occurrence_id,
    claim_definition_key:
      f17Carrier.claim.claim_definition_key,
    claim_definition_version:
      f17Carrier.claim.claim_definition_version,
    ordinal: f17Carrier.claim.ordinal,
    raw_value: f17Carrier.claim.raw_value,
    canonical_value: f17Carrier.claim.canonical_value,
    unit: f17Carrier.claim.unit,
    day_basis: f17Carrier.claim.day_basis,
    denominator: f17Carrier.claim.denominator,
    scope: f17Carrier.claim.scope,
    attributes: alternativeAttributes,
    allowed_attributes: Object.keys(f17Carrier.claim.attributes),
    codebooks: {},
    taxonomy_codes: f17Carrier.claim.taxonomy_codes,
    evidence: f17Carrier.claim.evidence,
    extraction_version:
      f17Carrier.claim.extraction_version,
    normalisation_version:
      f17Carrier.claim.normalisation_version,
    derivation_version:
      'F20_HYPOTHETICAL_NON_ADMITTED_ADVERSARIAL/V1',
  });
  validateInterpretedPresentClaimRevision({
    claim: alternativeClaim,
    interpretation: alternativeInterpretation,
    policy: contractBundle.claim_interpretation_policy_definition,
    allowed_attributes: Object.keys(f17Carrier.claim.attributes),
    codebooks: {},
    expected_attributes: alternativeAttributes,
  });
  const alternativeCompositionScopeClosureId = contentId(
    'COMPOSITION_SCOPE_CLOSURE/V2',
    {
      claim_revision_id: alternativeClaim.claim_revision_id,
      interpretation_payload_id:
        alternativeInterpretation.interpretation_payload_id,
      relationship_revision_ids: [],
    },
  );
  const alternativeResult = buildFixtureResultComponent({
    deal_admission_id: carrier.shared_row.deal_admission_id,
    result_key: f17Carrier.result.result_key,
    result_version: f17Carrier.result.result_version,
    concept_key: f17Carrier.result.concept_key,
    party: f17Carrier.result.party,
    value_slot_key: f17Carrier.result.value_slot_key,
    ordinal: f17Carrier.result.ordinal,
    claim: alternativeClaim,
    relationships: [],
    composition_scope_closure_id:
      alternativeCompositionScopeClosureId,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const changedInterpretation = {
    ...f17Carrier,
    interpretation: alternativeInterpretation,
    claim: alternativeClaim,
    result: alternativeResult,
  };
  const alternativeClass = buildComparabilityClass(
    changedInterpretation,
  );
  const baselineClassDigest =
    carrier.cohort_request.comparability_class_digest;
  if (alternativeClass.comparability_class_digest
      === baselineClassDigest) {
    throw new Error('F20 governed poison class did not rekey.');
  }
  const row = JSON.parse(JSON.stringify(carrier.shared_row));
  const baselineContext =
    row.canonical_result.comparability_context;
  const hypotheticalWarning = {
    required: true,
    code:
      'HYPOTHETICAL_NON_ADMITTED_ADVERSARIAL_INTERPRETATION',
    text:
      'Synthetic one-shared-clock interpretation used only to test cohort isolation; not a source-backed or admitted reading.',
    lawyer_note_digest: hypotheticalNoteDigest,
  };
  const alternativeContext = {
    ...baselineContext,
    interpretation_payload_id:
      alternativeInterpretation.interpretation_payload_id,
    comparability_class_digest:
      alternativeClass.comparability_class_digest,
    primary_semantic_class:
      alternativeClass.primary_semantic_class,
    alternative_semantic_classes:
      alternativeClass.alternative_semantic_classes,
    lawyer_warning: hypotheticalWarning,
  };
  row.canonical_result.comparability_context =
    JSON.parse(JSON.stringify(alternativeContext));
  const component = row.canonical_result.components[0];
  component.component_occurrence_id =
    alternativeResult.component_occurrence_id;
  component.component_revision_id =
    alternativeResult.component_revision_id;
  component.component_slot_key =
    alternativeResult.value_slot_key;
  component.governed_ordinal = alternativeResult.ordinal;
  component.claim_schema_version =
    alternativeClaim.schema_version;
  component.claim_occurrence_id =
    alternativeClaim.claim_occurrence_id;
  component.claim_revision_id =
    alternativeClaim.claim_revision_id;
  component.interpretation_payload_id =
    alternativeInterpretation.interpretation_payload_id;
  component.raw_value =
    JSON.parse(JSON.stringify(alternativeClaim.raw_value));
  component.canonical_value =
    JSON.parse(JSON.stringify(alternativeClaim.canonical_value));
  component.unit = alternativeClaim.unit;
  component.day_basis = alternativeClaim.day_basis;
  component.denominator =
    JSON.parse(JSON.stringify(alternativeClaim.denominator));
  component.derivation_version =
    alternativeClaim.derivation_version;
  component.comparability_context =
    JSON.parse(JSON.stringify(alternativeContext));
  row.provenance.owner_occurrence_id =
    alternativeResult.component_occurrence_id;
  row.provenance.owner_revision_id =
    alternativeResult.component_revision_id;
  row.provenance.interpretation_payload_id =
    alternativeInterpretation.interpretation_payload_id;
  row.source_actions = [];
  row.canonical_result.source_detail_state = {
    state: 'UNAVAILABLE',
    reason_code:
      'HYPOTHETICAL_NON_ADMITTED_ADVERSARIAL_ROW',
  };

  const alternativeRequest =
    compileOfflineInterpretedMarketCohortRequest({
      authority_scope: carrier.cohort_request.authority_scope,
      integration_admission_id:
        carrier.cohort_request.integration_admission_id,
      serving_namespace_id: carrier.serving_namespace_id,
      corpus_release_id: carrier.corpus_release_id,
      contract_fingerprint:
        carrier.candidate_release.manifest.contract_fingerprint,
      metric_key: carrier.cohort_request.metric_key,
      metric_version: carrier.cohort_request.metric_version,
      concept_key: carrier.cohort_request.concept_key,
      party: carrier.cohort_request.party,
      subject_deal_key: carrier.cohort_request.subject_deal_key,
      comparability_class_digest:
        alternativeClass.comparability_class_digest,
      filters: carrier.cohort_request.filters,
    });
  row.canonical_result.market_context.cohort
    .comparability_class_digest =
      alternativeClass.comparability_class_digest;
  row.canonical_result.market_context.cohort.cohort_digest =
    alternativeRequest.cohort_digest;

  const observation = carrier.projection.observation;
  const observationOccurrenceBody = {
    schema_version: 'METRIC_OBSERVATION_OCCURRENCE/V2',
    deal_key: observation.deal_key,
    deal_admission_id: observation.deal_admission_id,
    concept_key: observation.concept_key,
    metric_key: observation.metric_key,
    metric_version: observation.metric_version,
    party: observation.party,
    result_key: observation.result_key,
    result_version: observation.result_version,
    owner_type: observation.owner_type,
    owner_occurrence_id:
      alternativeResult.component_occurrence_id,
    scope_type: observation.scope_type,
    scope_id: alternativeResult.component_occurrence_id,
    value_slot_key: observation.value_slot_key,
    ordinal: observation.ordinal,
    comparability_class_digest:
      alternativeClass.comparability_class_digest,
  };
  const observationOccurrenceId = contentId(
    'METRIC_OBSERVATION_OCCURRENCE/V2',
    observationOccurrenceBody,
  );
  const observationServingKey = contentId(
    'MARKET_OBSERVATION/V2',
    {
      corpus_release_id: carrier.corpus_release_id,
      metric_observation_occurrence_id:
        observationOccurrenceId,
    },
  );
  row.provenance.metric_observation_occurrence_id =
    observationOccurrenceId;
  row.provenance.market_observation_serving_key =
    observationServingKey;
  row.canonical_result.market_context.subject_observation
    .market_observation_serving_key = observationServingKey;
  row.canonical_result.market_context.subject_observation
    .comparability_class_digest =
      alternativeClass.comparability_class_digest;

  const resultOccurrenceId = contentId(
    'DERIVED_RESULT_OCCURRENCE/V2',
    {
      deal_admission_id: row.deal_admission_id,
      result_key: row.canonical_result.result_key,
      result_version: row.canonical_result.result_version,
      concept_key: row.canonical_result.concept_key,
      party: row.canonical_result.party,
      result_ordinal: component.governed_ordinal,
      comparability_class_digest:
        alternativeClass.comparability_class_digest,
    },
  );
  const resultRevisionId = contentId(
    'DERIVED_RESULT_REVISION/V2',
    {
      derived_result_occurrence_id: resultOccurrenceId,
      component_revision_ids: [component.component_revision_id],
      interpretation_payload_ids: [
        component.interpretation_payload_id,
      ],
      comparability_class_digest:
        alternativeClass.comparability_class_digest,
      result_completeness: 'COMPLETE',
      market_comparability:
        'COMPARABLE_WITH_GOVERNED_AMBIGUITY',
    },
  );
  row.canonical_result.derived_result_occurrence_id =
    resultOccurrenceId;
  row.canonical_result.derived_result_revision_id =
    resultRevisionId;
  row.row_serving_key = contentId('RESULT_SERVING_ROW/V2', {
    corpus_release_id: row.corpus_release_id,
    derived_result_occurrence_id: resultOccurrenceId,
  });
  const propagatedInterpretationIds = [
    row.canonical_result.comparability_context
      .interpretation_payload_id,
    component.comparability_context.interpretation_payload_id,
    component.interpretation_payload_id,
    row.provenance.interpretation_payload_id,
  ];
  if (new Set(propagatedInterpretationIds).size !== 1
    || propagatedInterpretationIds[0]
      !== alternativeInterpretation.interpretation_payload_id) {
    throw new Error(
      'F20 hypothetical interpretation identity did not propagate.',
    );
  }
  if (alternativeInterpretation.lawyer_note_digest
      !== row.canonical_result.comparability_context
        .lawyer_warning.lawyer_note_digest
    || canonicalJson(alternativeInterpretation.review_provenance)
      .includes('BEN_APPROVED')
    || alternativeInterpretation.review_provenance.review_authority
      !== 'NONE'
    || alternativeInterpretation.review_provenance
      .publication_authority !== 'NONE') {
    throw new Error(
      'F20 hypothetical warning or review authority did not remain non-admitted.',
    );
  }
  delete row.canonical_payload_digest;
  row.canonical_payload_digest = contentId(
    'SHARED_SERVING_ROW_PAYLOAD/V2',
    row,
  );
  validateOfflineCandidateSharedServingRow(row);
  return {
    row,
    comparabilityClass: alternativeClass,
    semanticProof: {
      governed_dimension:
        'primary_clock_application_scope_code',
      baseline_value: baselineScope,
      alternative_value: alternativeScope,
      baseline_comparability_class_digest:
        baselineClassDigest,
      alternative_comparability_class_digest:
        alternativeClass.comparability_class_digest,
      alternative_primary_semantic_class:
        alternativeClass.primary_semantic_class,
      shared_row_validation: 'PASSED',
      interpretation_validation: 'PASSED',
      claim_revision_validation: 'PASSED',
      interpretation_identity_propagation: 'PASSED',
      interpretation_warning_digest_alignment: 'PASSED',
      review_authority: 'HYPOTHETICAL_NON_ADMITTED_ONLY',
      warning_authority: 'HYPOTHETICAL_NON_ADMITTED_ONLY',
      admission_state:
        'HYPOTHETICAL_NON_ADMITTED_ROLLBACK_ONLY',
      alternative_interpretation_payload_id:
        alternativeInterpretation.interpretation_payload_id,
      alternative_claim_revision_id:
        alternativeClaim.claim_revision_id,
      alternative_component_revision_id:
        alternativeResult.component_revision_id,
      alternative_row_serving_key: row.row_serving_key,
      alternative_row_payload_digest:
        row.canonical_payload_digest,
    },
  };
}

function f20RollbackSql(carrier, f17Carrier, contractBundle) {
  const row = carrier.shared_row;
  const observation = carrier.projection.observation;
  const manifest = carrier.candidate_release.manifest;
  const directory = carrier.deal_directory_entry;
  const classDigest =
    carrier.cohort_request.comparability_class_digest;
  const poison = buildF20CoherentPoisonRow(
    carrier,
    f17Carrier,
    contractBundle,
  );
  const poisonRow = poison.row;
  const poisonClassDigest =
    poison.comparabilityClass.comparability_class_digest;
  const releasePayload = {
    schema_version: 'F20_ROLLBACK_RELEASE_ADMISSION/V1',
    authority: 'ROLLBACK_ONLY_STAGING_CERTIFICATION',
    candidate_manifest: manifest,
    serving_projection_version: 'canonical-v2-serving/v3-offline',
    query_projection_contract_digest:
      f20ProjectionContractDigest(),
    response_schema_version: 'MARKET_COHORT_RESULT/V2',
  };
  const releasePayloadDigest = contentId(
    'F20_ROLLBACK_RELEASE_ADMISSION/V1',
    releasePayload,
  );
  const querySql = f20QuerySql(carrier);
  const matchingPageSql = f20MatchingPageSql(carrier);
  const explainedSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF)
${matchingPageSql}`;
  return `BEGIN;
SET LOCAL lock_timeout = '2000ms';
SET LOCAL statement_timeout = '15000ms';
SELECT pg_advisory_xact_lock(20260726, 20);

DO $f20_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'canonical_v2_staging'
      AND table_name = 'shared_serving_rows'
      AND column_name = 'comparability_class_digest'
  ) OR to_regclass(
    'canonical_v2_staging.${CANDIDATE_INDEX_NAME}'
  ) IS NOT NULL OR EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'canonical_v2_staging'
      AND proc.proname = 'canonical_v2_query_page_v3_candidate'
  ) THEN
    RAISE EXCEPTION 'F20 candidate DDL already exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases
    WHERE corpus_release_id = ${f20SqlText(carrier.corpus_release_id)}
  ) OR EXISTS (
    SELECT 1 FROM canonical_v2_staging.shared_serving_rows
    WHERE corpus_release_id = ${f20SqlText(carrier.corpus_release_id)}
  ) OR EXISTS (
    SELECT 1 FROM canonical_v2_staging.query_response_cache
    WHERE corpus_release_id = ${f20SqlText(carrier.corpus_release_id)}
  ) THEN
    RAISE EXCEPTION 'F20 exact release has pre-existing state';
  END IF;
  IF (
    SELECT encode(digest(pg_get_functiondef(proc.oid), 'sha256'), 'hex')
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'canonical_v2_query_page_v2'
      AND proc.proargnames[1] = 'p_environment'
    LIMIT 1
  ) IS DISTINCT FROM ${f20SqlText(BASE_EXECUTOR_DEFINITION_DIGEST)} THEN
    RAISE EXCEPTION 'F20 pinned V2 executor drifted';
  END IF;
END
$f20_guard$;

ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  DROP CONSTRAINT fixture_corpus_releases_projection_version_check,
  DROP CONSTRAINT fixture_corpus_releases_projection_contract_check,
  DROP CONSTRAINT fixture_corpus_releases_response_schema_version_check;
ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  ADD CONSTRAINT fixture_corpus_releases_projection_version_check
    CHECK (projection_version IN (
      'canonical-v2-serving/v1',
      'canonical-v2-serving/v2',
      'canonical-v2-serving/v3-offline'
    )),
  ADD CONSTRAINT fixture_corpus_releases_projection_contract_check CHECK (
    (projection_version = 'canonical-v2-serving/v1'
      AND query_projection_contract_digest IS NULL)
    OR (projection_version = 'canonical-v2-serving/v2'
      AND query_projection_contract_digest =
        ${f20SqlText(QUERY_PROJECTION_CONTRACT_DIGEST_V2)})
    OR (projection_version = 'canonical-v2-serving/v3-offline'
      AND query_projection_contract_digest =
        ${f20SqlText(f20ProjectionContractDigest())})
  ),
  ADD CONSTRAINT fixture_corpus_releases_response_schema_version_check
    CHECK (response_schema_version IN (
      'MARKET_COHORT_RESULT/V1',
      'MARKET_COHORT_RESULT/V2'
    ));

ALTER TABLE canonical_v2_staging.shared_serving_rows
  ADD COLUMN comparability_class_digest text
  GENERATED ALWAYS AS (
    canonical_payload #>>
      '{canonical_result,comparability_context,comparability_class_digest}'
  ) STORED;
ALTER TABLE canonical_v2_staging.shared_serving_rows
  ADD CONSTRAINT canonical_v2_shared_rows_f20_class_digest_check
  CHECK (
    comparability_class_digest IS NULL
    OR comparability_class_digest ~ '^[a-f0-9]{64}$'
  );
CREATE INDEX ${CANDIDATE_INDEX_NAME}
  ON canonical_v2_staging.shared_serving_rows (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    concept_key,
    metric_key,
    metric_version,
    party_role,
    party_value,
    party_capacity,
    basis_key,
    comparability_class_digest,
    governed_deal_key,
    row_serving_key
  )
  WHERE row_kind = 'CANONICAL_RESULT'
    AND comparability_class_digest IS NOT NULL;

DO $f20_executor$
DECLARE
  source_definition text;
  transformed_definition text;
  next_definition text;
  candidate_identity text;
BEGIN
  SELECT pg_get_functiondef(proc.oid)
  INTO source_definition
  FROM pg_proc proc
  JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'canonical_v2_query_page_v2'
    AND proc.proargnames[1] = 'p_environment'
  LIMIT 1;
  transformed_definition := source_definition;

  next_definition := replace(
    transformed_definition,
    'CREATE OR REPLACE FUNCTION public.canonical_v2_query_page_v2(',
    'CREATE OR REPLACE FUNCTION ${CANDIDATE_EXECUTOR_NAME}('
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 function-name transform failed';
  END IF;
  transformed_definition := next_definition;

  next_definition := replace(
    transformed_definition,
    'p_basis_key text, p_sector text DEFAULT NULL::text',
    'p_basis_key text, p_comparability_class_digest text, p_sector text DEFAULT NULL::text'
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 parameter transform failed';
  END IF;
  transformed_definition := next_definition;

  next_definition := replace(
    transformed_definition,
    ' SECURITY DEFINER',
    ' SECURITY INVOKER'
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 invoker transform failed';
  END IF;
  transformed_definition := next_definition;

  next_definition := replace(
    transformed_definition,
    '    OR coalesce(length(trim(p_basis_key)), 0) = 0',
    E'    OR coalesce(length(trim(p_basis_key)), 0) = 0\\n    OR p_comparability_class_digest IS NULL\\n    OR p_comparability_class_digest !~ ''^[a-f0-9]{64}$'''
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 validation transform failed';
  END IF;
  transformed_definition := next_definition;

  next_definition := replace(
    transformed_definition,
    E'    ''basis_key'', p_basis_key,\\n',
    E'    ''basis_key'', p_basis_key,\\n    ''comparability_class_digest'', p_comparability_class_digest,\\n'
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 cache-identity transform failed';
  END IF;
  transformed_definition := next_definition;

  next_definition := replace(
    transformed_definition,
    E'      AND row.basis_key = p_basis_key\\n',
    E'      AND row.basis_key = p_basis_key\\n      AND row.comparability_class_digest = p_comparability_class_digest\\n'
  );
  IF next_definition = transformed_definition THEN
    RAISE EXCEPTION 'F20 class-predicate transform failed';
  END IF;
  transformed_definition := next_definition;

  EXECUTE transformed_definition;
  SELECT proc.oid::regprocedure::text
  INTO candidate_identity
  FROM pg_proc proc
  JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'canonical_v2_staging'
    AND proc.proname = 'canonical_v2_query_page_v3_candidate'
  LIMIT 1;
  EXECUTE 'REVOKE ALL ON FUNCTION ' || candidate_identity || ' FROM PUBLIC';
END
$f20_executor$;

INSERT INTO canonical_v2_staging.fixture_corpus_releases (
  corpus_release_id,
  candidate_manifest_id,
  frozen_pair_root_id,
  contract_fingerprint,
  projection_version,
  query_projection_contract_digest,
  response_schema_version,
  canonical_payload,
  canonical_payload_digest
) VALUES (
  ${f20SqlText(carrier.corpus_release_id)},
  ${f20SqlText(manifest.candidate_release_manifest_id)},
  ${f20SqlText(row.frozen_pair_id)},
  ${f20SqlText(manifest.contract_fingerprint)},
  'canonical-v2-serving/v3-offline',
  ${f20SqlText(f20ProjectionContractDigest())},
  'MARKET_COHORT_RESULT/V2',
  ${f20SqlJson(releasePayload, 'f20_release')},
  ${f20SqlText(releasePayloadDigest)}
);
INSERT INTO canonical_v2_staging.deal_serving_directory (
  serving_namespace_id,
  corpus_release_id,
  contract_fingerprint,
  application_deal_id,
  governed_deal_key,
  deal_admission_id,
  deal_serving_directory_record_id,
  canonical_payload_digest
) VALUES (
  ${f20SqlText(carrier.serving_namespace_id)},
  ${f20SqlText(carrier.corpus_release_id)},
  ${f20SqlText(manifest.contract_fingerprint)},
  ${f20SqlText(directory.application_deal_id)}::uuid,
  ${f20SqlText(directory.governed_deal_key)},
  ${f20SqlText(directory.deal_admission_id)},
  ${f20SqlText(directory.deal_serving_directory_record_id)},
  ${f20SqlText(directory.canonical_payload_digest)}
);
INSERT INTO canonical_v2_staging.shared_serving_rows (
  serving_namespace_id, corpus_release_id, row_serving_key,
  contract_fingerprint, governed_deal_key, concept_key, metric_key,
  metric_version, party_role, party_value, party_capacity, basis_key,
  sector, buyer, merger_form, adviser_firms, lawyers, announce_year,
  deal_value_usd, canonical_numeric_value, fee_side, payer_capacity,
  payee_capacity, trigger_codes, payment_timings, trigger_conditions,
  criterion_code, contract_scope_code, cash_flow_direction_code,
  measurement_period_code, comparison_operator, canonical_payload,
  canonical_payload_digest
) VALUES (
  ${f20SqlText(carrier.serving_namespace_id)},
  ${f20SqlText(carrier.corpus_release_id)},
  ${f20SqlText(row.row_serving_key)},
  ${f20SqlText(manifest.contract_fingerprint)},
  ${f20SqlText(row.governed_deal_key)},
  ${f20SqlText(observation.concept_key)},
  ${f20SqlText(observation.metric_key)},
  ${observation.metric_version},
  ${f20SqlText(observation.party.role)},
  ${f20SqlText(observation.party.value)},
  ${f20SqlText(observation.party.capacity)},
  ${f20SqlText(observation.basis_key)},
  NULL, 'QXO', NULL, '{}'::text[], '{}'::text[], 2024, NULL,
  ${Number(carrier.query_projection.canonical_value)},
  NULL, NULL, NULL, '{}'::text[], '{}'::text[], '{}'::text[],
  NULL, NULL, NULL, NULL, NULL,
  ${f20SqlJson(row, 'f20_row')},
  ${f20SqlText(row.canonical_payload_digest)}
), (
  ${f20SqlText(carrier.serving_namespace_id)},
  ${f20SqlText(carrier.corpus_release_id)},
  ${f20SqlText(poisonRow.row_serving_key)},
  ${f20SqlText(manifest.contract_fingerprint)},
  ${f20SqlText(poisonRow.governed_deal_key)},
  ${f20SqlText(observation.concept_key)},
  ${f20SqlText(observation.metric_key)},
  ${observation.metric_version},
  ${f20SqlText(observation.party.role)},
  ${f20SqlText(observation.party.value)},
  ${f20SqlText(observation.party.capacity)},
  ${f20SqlText(observation.basis_key)},
  NULL, 'QXO', NULL, '{}'::text[], '{}'::text[], 2024, NULL,
  ${Number(carrier.query_projection.canonical_value)},
  NULL, NULL, NULL, '{}'::text[], '{}'::text[], '{}'::text[],
  NULL, NULL, NULL, NULL, NULL,
  ${f20SqlJson(poisonRow, 'f20_poison')},
  ${f20SqlText(poisonRow.canonical_payload_digest)}
);

CREATE OR REPLACE FUNCTION pg_temp.f20_explain_plan()
RETURNS jsonb
LANGUAGE plpgsql
AS $f20_plan_function$
DECLARE
  plan_body jsonb;
BEGIN
  EXECUTE $f20_explained_sql$${explainedSql}$f20_explained_sql$
    INTO plan_body;
  RETURN plan_body;
END
$f20_plan_function$;

CREATE TEMP TABLE f20_execution_results (
  explain_plan jsonb NOT NULL,
  cold_result jsonb NOT NULL,
  warm_result jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO f20_execution_results (
  explain_plan,
  cold_result,
  warm_result
)
WITH plan AS MATERIALIZED (
  SELECT pg_temp.f20_explain_plan() AS body
), cold AS MATERIALIZED (
  SELECT ${querySql} AS body
  FROM plan
  WHERE plan.body IS NOT NULL
), warm AS MATERIALIZED (
  SELECT ${querySql} AS body
  FROM cold
  WHERE cold.body IS NOT NULL
)
SELECT plan.body, cold.body, warm.body
FROM plan CROSS JOIN cold CROSS JOIN warm;

SELECT jsonb_build_object(
  'transaction', jsonb_build_object(
    'cold_result', result.cold_result,
    'warm_result', result.warm_result,
    'cache_entry', (
      SELECT jsonb_build_object(
        'row_count', count(*)::integer,
        'physical_request', (jsonb_agg(cache.physical_request))->0,
        'response_bytes', max(cache.response_payload_bytes)
      )
      FROM canonical_v2_staging.query_response_cache cache
      WHERE cache.serving_namespace_id =
        ${f20SqlText(carrier.serving_namespace_id)}
        AND cache.corpus_release_id =
          ${f20SqlText(carrier.corpus_release_id)}
        AND cache.query_semantics_digest =
          ${f20SqlText(f20QuerySemanticsDigest(carrier))}
    ),
    'cohort_probe', jsonb_build_object(
      'same_metric_all_classes', (
        SELECT count(*)::integer
        FROM canonical_v2_staging.shared_serving_rows probe
        WHERE probe.serving_namespace_id =
          ${f20SqlText(carrier.serving_namespace_id)}
          AND probe.corpus_release_id =
            ${f20SqlText(carrier.corpus_release_id)}
          AND probe.metric_key = ${f20SqlText(observation.metric_key)}
      ),
      'exact_class_rows', (
        SELECT count(*)::integer
        FROM canonical_v2_staging.shared_serving_rows probe
        WHERE probe.serving_namespace_id =
          ${f20SqlText(carrier.serving_namespace_id)}
          AND probe.corpus_release_id =
            ${f20SqlText(carrier.corpus_release_id)}
          AND probe.metric_key = ${f20SqlText(observation.metric_key)}
          AND probe.comparability_class_digest =
            ${f20SqlText(classDigest)}
      ),
      'poison_class_rows', (
        SELECT count(*)::integer
        FROM canonical_v2_staging.shared_serving_rows probe
        WHERE probe.serving_namespace_id =
          ${f20SqlText(carrier.serving_namespace_id)}
          AND probe.corpus_release_id =
            ${f20SqlText(carrier.corpus_release_id)}
          AND probe.metric_key = ${f20SqlText(observation.metric_key)}
          AND probe.comparability_class_digest =
            ${f20SqlText(poisonClassDigest)}
      )
    ),
    'active_pointer_before', public.canonical_v2_active_release('staging'),
    'explain_plan', result.explain_plan
  ),
  'base_executor_definition_digest', (
    SELECT encode(digest(pg_get_functiondef(proc.oid), 'sha256'), 'hex')
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'canonical_v2_query_page_v2'
      AND proc.proargnames[1] = 'p_environment'
    LIMIT 1
  ),
  'candidate_executor_definition', (
    SELECT pg_get_functiondef(proc.oid)
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'canonical_v2_staging'
      AND proc.proname = 'canonical_v2_query_page_v3_candidate'
    LIMIT 1
  ),
  'candidate_security_definer', (
    SELECT proc.prosecdef
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'canonical_v2_staging'
      AND proc.proname = 'canonical_v2_query_page_v3_candidate'
    LIMIT 1
  ),
  'candidate_public_execute_granted', EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(proc.proacl, acldefault('f', proc.proowner))
    ) privilege
    WHERE namespace.nspname = 'canonical_v2_staging'
      AND proc.proname = 'canonical_v2_query_page_v3_candidate'
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ),
  'candidate_index_definition', (
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'canonical_v2_staging'
      AND indexname = ${f20SqlText(CANDIDATE_INDEX_NAME)}
  ),
  'explained_sql_digest', ${f20SqlText(sha256Hex(Buffer.from(
    matchingPageSql,
    'utf8',
  )))},
  'poison_semantic_proof',
    ${f20SqlJson(poison.semanticProof, 'f20_poison_proof')}
) AS evidence
FROM f20_execution_results result;
ROLLBACK;`;
}

function f20PostRollbackSql(carrier) {
  const fingerprint =
    carrier.candidate_release.manifest.contract_fingerprint;
  return `SELECT jsonb_build_object(
  'release_rows', (
    SELECT count(*)::integer
    FROM canonical_v2_staging.fixture_corpus_releases
    WHERE corpus_release_id = ${f20SqlText(carrier.corpus_release_id)}
  ),
  'directory_rows', (
    SELECT count(*)::integer
    FROM canonical_v2_staging.deal_serving_directory
    WHERE serving_namespace_id =
      ${f20SqlText(carrier.serving_namespace_id)}
      AND corpus_release_id =
        ${f20SqlText(carrier.corpus_release_id)}
  ),
  'shared_row_rows', (
    SELECT count(*)::integer
    FROM canonical_v2_staging.shared_serving_rows
    WHERE serving_namespace_id =
      ${f20SqlText(carrier.serving_namespace_id)}
      AND corpus_release_id =
        ${f20SqlText(carrier.corpus_release_id)}
  ),
  'cache_rows', (
    SELECT count(*)::integer
    FROM canonical_v2_staging.query_response_cache
    WHERE serving_namespace_id =
      ${f20SqlText(carrier.serving_namespace_id)}
      AND corpus_release_id =
        ${f20SqlText(carrier.corpus_release_id)}
  ),
  'class_column_exists', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'canonical_v2_staging'
      AND table_name = 'shared_serving_rows'
      AND column_name = 'comparability_class_digest'
  ),
  'candidate_index_exists', to_regclass(
    'canonical_v2_staging.${CANDIDATE_INDEX_NAME}'
  ) IS NOT NULL,
  'candidate_function_exists', EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'canonical_v2_staging'
      AND proc.proname = 'canonical_v2_query_page_v3_candidate'
  ),
  'active_pointer_after', public.canonical_v2_active_release('staging'),
  'base_executor_definition_digest', (
    SELECT encode(digest(pg_get_functiondef(proc.oid), 'sha256'), 'hex')
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.proname = 'canonical_v2_query_page_v2'
      AND proc.proargnames[1] = 'p_environment'
    LIMIT 1
  ),
  'contract_fingerprint', ${f20SqlText(fingerprint)}
) AS evidence;`;
}

function buildCopyDeliveryQueryF20Runtime() {
  guardProject();
  const {
    carrier: f19Carrier,
    inputs: f19Inputs,
  } =
    buildCopyDeliveryCanonicalF19Runtime();
  const transactionRows = runF20SqlFile(
    f20RollbackSql(
      f19Carrier,
      f19Inputs.qxo_no_shop_copy_delivery_claim_f17,
      f19Inputs.contract_bundle,
    ),
  );
  if (!Array.isArray(transactionRows)
    || transactionRows.length !== 1
    || !transactionRows[0]?.evidence) {
    throw new Error('F20 rollback transaction returned invalid evidence.');
  }
  const postRows = runF20SqlFile(f20PostRollbackSql(f19Carrier));
  if (!Array.isArray(postRows)
    || postRows.length !== 1
    || !postRows[0]?.evidence) {
    throw new Error('F20 post-rollback verification returned invalid evidence.');
  }
  const transactionEvidence = transactionRows[0].evidence;
  const postEvidence = postRows[0].evidence;
  delete postEvidence.contract_fingerprint;
  const execution = {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20_EXECUTION/V2',
    environment: 'STAGING',
    authority_scope: 'ROLLBACK_ONLY_STAGING_CERTIFICATION',
    query_semantics_digest: f20QuerySemanticsDigest(f19Carrier),
    comparability_class_digest:
      f19Carrier.cohort_request.comparability_class_digest,
    poison_semantic_proof:
      transactionEvidence.poison_semantic_proof,
    explained_sql_digest:
      transactionEvidence.explained_sql_digest,
    base_executor: {
      name: 'canonical_v2_query_page_v2',
      definition_digest:
        transactionEvidence.base_executor_definition_digest,
    },
    candidate_executor: {
      name: CANDIDATE_EXECUTOR_NAME,
      definition:
        transactionEvidence.candidate_executor_definition,
      security_definer:
        transactionEvidence.candidate_security_definer,
      public_execute_granted:
        transactionEvidence.candidate_public_execute_granted,
    },
    candidate_index: {
      name: CANDIDATE_INDEX_NAME,
      definition:
        transactionEvidence.candidate_index_definition,
    },
    transaction: transactionEvidence.transaction,
    post_rollback: postEvidence,
  };
  const contractBundle = compileFixtureContractV12();
  const carrier = buildQxoNoShopCopyDeliveryQueryF20({
    contract_bundle: contractBundle,
    qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
    staging_execution: execution,
  });
  validateQxoNoShopCopyDeliveryQueryF20({
    qxo_no_shop_copy_delivery_query_f20: carrier,
    contract_bundle: contractBundle,
    qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
    staging_execution: execution,
  });
  return {
    carrier,
    contractBundle,
    f19Carrier,
    execution,
  };
}

function buildCopyDeliveryQueryF20Attestation() {
  const runtime = buildCopyDeliveryQueryF20Runtime();
  const {
    carrier,
    contractBundle,
    f19Carrier,
    execution,
  } = runtime;
  const mutatedF19 = JSON.parse(JSON.stringify(f19Carrier));
  mutatedF19.status.publication_blocked = false;
  let nestedF19DriftRejected = false;
  try {
    buildQxoNoShopCopyDeliveryQueryF20({
      contract_bundle: contractBundle,
      qxo_no_shop_copy_delivery_canonical_f19: mutatedF19,
      staging_execution: execution,
    });
  } catch (_) {
    nestedF19DriftRejected = true;
  }
  const mutatedPlan = JSON.parse(JSON.stringify(execution));
  const planStack = [mutatedPlan.transaction.explain_plan];
  let indexMutated = false;
  while (planStack.length && !indexMutated) {
    const value = planStack.pop();
    if (Array.isArray(value)) {
      planStack.push(...value);
    } else if (value && typeof value === 'object') {
      if (value['Index Name']
          === CANDIDATE_INDEX_NAME) {
        value['Index Name'] = 'substituted_index';
        indexMutated = true;
      } else {
        planStack.push(...Object.values(value));
      }
    }
  }
  let planDriftRejected = false;
  try {
    buildQxoNoShopCopyDeliveryQueryF20({
      contract_bundle: contractBundle,
      qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
      staging_execution: mutatedPlan,
    });
  } catch (_) {
    planDriftRejected = true;
  }
  const mutatedResult = JSON.parse(JSON.stringify(execution));
  mutatedResult.transaction.warm_result.rows[0]
    .canonical_result.components[0].canonical_value = '2';
  let resultDriftRejected = false;
  try {
    buildQxoNoShopCopyDeliveryQueryF20({
      contract_bundle: contractBundle,
      qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
      staging_execution: mutatedResult,
    });
  } catch (_) {
    resultDriftRejected = true;
  }
  const mutatedRollback = JSON.parse(JSON.stringify(execution));
  mutatedRollback.post_rollback.cache_rows = 1;
  let rollbackResidueRejected = false;
  try {
    buildQxoNoShopCopyDeliveryQueryF20({
      contract_bundle: contractBundle,
      qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
      staging_execution: mutatedRollback,
    });
  } catch (_) {
    rollbackResidueRejected = true;
  }
  const mutatedClass = JSON.parse(JSON.stringify(execution));
  mutatedClass.transaction.cohort_probe.exact_class_rows = 2;
  let poisonClassLeakRejected = false;
  try {
    buildQxoNoShopCopyDeliveryQueryF20({
      contract_bundle: contractBundle,
      qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
      staging_execution: mutatedClass,
    });
  } catch (_) {
    poisonClassLeakRejected = true;
  }
  return {
    schema_version:
      'QXO_NO_SHOP_COPY_DELIVERY_QUERY_F20_STAGING_ATTESTATION/V2',
    environment: 'STAGING',
    authority_scope: carrier.authority_scope,
    upstream_f19_id:
      carrier.upstream_binding
        .qxo_no_shop_copy_delivery_canonical_f19_id,
    query_certification: carrier.query_certification,
    adversarial_rejections: {
      nested_f19_drift: nestedF19DriftRejected,
      plan_drift: planDriftRejected,
      result_drift: resultDriftRejected,
      rollback_residue: rollbackResidueRejected,
      poison_class_leak: poisonClassLeakRejected,
    },
    status: carrier.status,
    qxo_no_shop_copy_delivery_query_f20_id:
      carrier.qxo_no_shop_copy_delivery_query_f20_id,
    canonical_payload_digest: carrier.canonical_payload_digest,
  };
}
// F20_ROLLBACK_ONLY_STAGING_CERTIFICATION_END

// F23_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN
function f23PointerSql() {
  return `SELECT public.canonical_v2_active_release('staging')
  AS active_pointer;`;
}

function f23RollbackSql(bundle) {
  const manifest = bundle.manifest;
  const admissionId = manifest.metric_serving_admission_ids[0];
  return `BEGIN;
SET LOCAL lock_timeout = '2000ms';
SET LOCAL statement_timeout = '15000ms';
SELECT pg_advisory_xact_lock(20260727, 23);

DO $f23_guard$
BEGIN
  IF to_regclass(
    'canonical_v2_staging.metric_serving_admission_f23_probe'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'F23 staging probe already exists';
  END IF;
END
$f23_guard$;

CREATE TABLE canonical_v2_staging.metric_serving_admission_f23_probe (
  candidate_release_manifest_id text PRIMARY KEY
    CHECK (
      candidate_release_manifest_id ~ '^[a-f0-9]{64}$'
    ),
  metric_serving_admission_id text NOT NULL
    CHECK (
      metric_serving_admission_id ~ '^[a-f0-9]{64}$'
    ),
  manifest jsonb NOT NULL,
  shared_row jsonb NOT NULL,
  exact_detail_package jsonb NOT NULL,
  cohort_request jsonb NOT NULL,
  cohort_result jsonb NOT NULL,
  query_record jsonb NOT NULL
);
ALTER TABLE
  canonical_v2_staging.metric_serving_admission_f23_probe
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON
  canonical_v2_staging.metric_serving_admission_f23_probe
  FROM PUBLIC;

INSERT INTO
  canonical_v2_staging.metric_serving_admission_f23_probe (
    candidate_release_manifest_id,
    metric_serving_admission_id,
    manifest,
    shared_row,
    exact_detail_package,
    cohort_request,
    cohort_result,
    query_record
  )
VALUES (
  ${f20SqlText(manifest.candidate_release_manifest_id)},
  ${f20SqlText(admissionId)},
  ${f20SqlJson(manifest, 'f23_manifest')},
  ${f20SqlJson(bundle.shared_rows[0], 'f23_row')},
  ${f20SqlJson(
    bundle.exact_detail_packages[0],
    'f23_detail',
  )},
  ${f20SqlJson(bundle.cohort_requests[0], 'f23_request')},
  ${f20SqlJson(bundle.cohort_results[0], 'f23_result')},
  ${f20SqlJson(bundle.query_records[0], 'f23_query')}
);

SELECT jsonb_build_object(
  'manifest_rows', count(*)::integer,
  'bound_carriers', sum(
    (
      (shared_row ->> 'metric_serving_admission_id') =
        metric_serving_admission_id
    )::integer
    + (
      (exact_detail_package #>>
        '{row,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (cohort_request ->> 'metric_serving_admission_id') =
        metric_serving_admission_id
    )::integer
    + (
      (cohort_result ->> 'metric_serving_admission_id') =
        metric_serving_admission_id
    )::integer
    + (
      (query_record ->> 'metric_serving_admission_id') =
        metric_serving_admission_id
    )::integer
  )::integer,
  'manifest_admission_exact', bool_and(
    (manifest -> 'metric_serving_admission_ids') =
      jsonb_build_array(metric_serving_admission_id)
  ),
  'release_manifest_id_exact', bool_and(
    (manifest ->> 'candidate_release_manifest_id') =
      candidate_release_manifest_id
  ),
  'active_pointer_during',
    public.canonical_v2_active_release('staging')
) AS evidence
FROM canonical_v2_staging.metric_serving_admission_f23_probe;
ROLLBACK;`;
}

function f23PostRollbackSql() {
  return `SELECT jsonb_build_object(
  'probe_table_exists', to_regclass(
    'canonical_v2_staging.metric_serving_admission_f23_probe'
  ) IS NOT NULL,
  'active_pointer_after',
    public.canonical_v2_active_release('staging')
) AS evidence;`;
}

function oneEvidenceRow(rows, label, key = 'evidence') {
  if (!Array.isArray(rows)
    || rows.length !== 1
    || !Object.hasOwn(rows[0], key)) {
    throw new Error(`${label} returned invalid evidence.`);
  }
  return rows[0][key];
}

function buildCopyDeliveryReleaseF23Attestation() {
  guardProject();
  const {
    carrier: f19Carrier,
  } = buildCopyDeliveryCanonicalF19Runtime();
  const bundle = buildMetricScopedCandidateReleaseF23({
    qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
  });
  validateMetricScopedCandidateReleaseF23(bundle);
  const resolution = releaseManifestAdmissionResolution(bundle);
  const activePointerBefore = oneEvidenceRow(
    runF20SqlFile(f23PointerSql()),
    'F23 active pointer precheck',
    'active_pointer',
  );
  const transaction = oneEvidenceRow(
    runF20SqlFile(f23RollbackSql(bundle)),
    'F23 rollback transaction',
  );
  const postRollback = oneEvidenceRow(
    runF20SqlFile(f23PostRollbackSql()),
    'F23 post-rollback check',
  );
  if (transaction.manifest_rows !== 1
    || transaction.bound_carriers !== 5
    || transaction.manifest_admission_exact !== true
    || transaction.release_manifest_id_exact !== true
    || canonicalJson(transaction.active_pointer_during)
      !== canonicalJson(activePointerBefore)
    || postRollback.probe_table_exists !== false
    || canonicalJson(postRollback.active_pointer_after)
      !== canonicalJson(activePointerBefore)) {
    throw new Error(
      'F23 rollback proof changed staging state or lost admission identity.',
    );
  }
  const body = {
    schema_version:
      'QXO_COPY_DELIVERY_RELEASE_F23_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope:
      'ROLLBACK_ONLY_METRIC_SCOPED_RELEASE_F23',
    project_ref: PROJECT.ref,
    candidate_release_bundle: bundle,
    release_manifest_resolution: resolution,
    staging_execution: {
      database_calls: 3,
      immediate_retries: 0,
      statement_timeout_ms: 15000,
      lock_timeout_ms: 2000,
      transaction,
      post_rollback: postRollback,
      active_pointer_before: activePointerBefore,
      active_pointer_unchanged: true,
      rollback_verified: true,
      durable_rows_written: 0,
    },
    authority: {
      active_release_authority: 'NONE',
      active_query_authority: 'NONE',
      active_pointer_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
    status: {
      publication_blocked: true,
      release_eligible: false,
      blocker_codes: [
        'ACTIVE_RELEASE_ACTIVATION_REQUIRED',
      ],
    },
  };
  return {
    ...body,
    qxo_copy_delivery_release_f23_staging_attestation_id:
      contentId(
        'QXO_COPY_DELIVERY_RELEASE_F23_STAGING_ATTESTATION/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'QXO_COPY_DELIVERY_RELEASE_F23_STAGING_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  };
}
// F23_ROLLBACK_ONLY_STAGING_CERTIFICATION_END

// F24_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN
function buildNoShopTimingF24Runtime() {
  const {
    carrier: f19Carrier,
  } = buildCopyDeliveryCanonicalF19Runtime();
  const f23Bundle = buildMetricScopedCandidateReleaseF23({
    qxo_no_shop_copy_delivery_canonical_f19: f19Carrier,
  });
  const {
    carrier: f15Carrier,
  } = buildCopyClockF15Runtime();
  const {
    contractBundle,
    admittedSourceContext,
  } = buildSourceInputs(compileFixtureContractV12());
  const noticeSlice = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const rematchSlice = buildQxoAdmittedNoShopRematchSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const inputs = {
    contract_bundle: contractBundle,
    f23_candidate_release_bundle: f23Bundle,
    qxo_no_shop_copy_clock_f15: f15Carrier,
    admitted_source_context: admittedSourceContext,
    reviewed_no_shop_notice_slice: noticeSlice,
    reviewed_no_shop_rematch_slice: rematchSlice,
  };
  const bundle = buildNoShopTimingCertificationF24(inputs);
  validateNoShopTimingCertificationF24({
    no_shop_timing_certification_f24: bundle,
    ...inputs,
  });
  return { bundle, inputs };
}

function f24RollbackSql(bundle) {
  const records = bundle.timing_certifications.map((carrier) => ({
    metric_key: carrier.observation.metric_key,
    metric_serving_admission_id:
      carrier.metric_serving_admission
        .metric_serving_admission_id,
    carrier,
  }));
  return `BEGIN;
SET LOCAL lock_timeout = '2000ms';
SET LOCAL statement_timeout = '15000ms';
SELECT pg_advisory_xact_lock(20260727, 24);

DO $f24_guard$
BEGIN
  IF to_regclass(
    'canonical_v2_staging.no_shop_timing_f24_probe'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'F24 staging probe already exists';
  END IF;
END
$f24_guard$;

CREATE TABLE canonical_v2_staging.no_shop_timing_f24_probe (
  metric_key text PRIMARY KEY,
  metric_serving_admission_id text UNIQUE NOT NULL
    CHECK (
      metric_serving_admission_id ~ '^[a-f0-9]{64}$'
    ),
  carrier jsonb NOT NULL
);
ALTER TABLE
  canonical_v2_staging.no_shop_timing_f24_probe
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON
  canonical_v2_staging.no_shop_timing_f24_probe
  FROM PUBLIC;

INSERT INTO canonical_v2_staging.no_shop_timing_f24_probe (
  metric_key,
  metric_serving_admission_id,
  carrier
)
SELECT
  record.metric_key,
  record.metric_serving_admission_id,
  record.carrier
FROM jsonb_to_recordset(
  ${f20SqlJson(records, 'f24_timing_records')}
) AS record(
  metric_key text,
  metric_serving_admission_id text,
  carrier jsonb
);

SELECT jsonb_build_object(
  'timing_rows', count(*)::integer,
  'distinct_admissions',
    count(DISTINCT metric_serving_admission_id)::integer,
  'bound_carriers', sum(
    (
      (carrier #>>
        '{metric_serving_admission,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{observation,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{cohort_request,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{cohort_result,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{query_projection,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
  )::integer,
  'metric_keys',
    jsonb_agg(metric_key ORDER BY metric_key),
  'active_pointer_during',
    public.canonical_v2_active_release('staging')
) AS evidence
FROM canonical_v2_staging.no_shop_timing_f24_probe;
ROLLBACK;`;
}

function f24PostRollbackSql() {
  return `SELECT jsonb_build_object(
  'probe_table_exists', to_regclass(
    'canonical_v2_staging.no_shop_timing_f24_probe'
  ) IS NOT NULL,
  'active_pointer_after',
    public.canonical_v2_active_release('staging')
) AS evidence;`;
}

function buildNoShopTimingF24Attestation() {
  guardProject();
  const { bundle } = buildNoShopTimingF24Runtime();
  const activePointerBefore = oneEvidenceRow(
    runF20SqlFile(f23PointerSql()),
    'F24 active pointer precheck',
    'active_pointer',
  );
  const transaction = oneEvidenceRow(
    runF20SqlFile(f24RollbackSql(bundle)),
    'F24 rollback transaction',
  );
  const postRollback = oneEvidenceRow(
    runF20SqlFile(f24PostRollbackSql()),
    'F24 post-rollback check',
  );
  const expectedMetrics = [
    'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    'NO_SHOP_NOTICE_PERIOD_DAYS',
    'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
  ];
  if (transaction.timing_rows !== 3
    || transaction.distinct_admissions !== 3
    || transaction.bound_carriers !== 15
    || canonicalJson(transaction.metric_keys)
      !== canonicalJson(expectedMetrics)
    || canonicalJson(transaction.active_pointer_during)
      !== canonicalJson(activePointerBefore)
    || postRollback.probe_table_exists !== false
    || canonicalJson(postRollback.active_pointer_after)
      !== canonicalJson(activePointerBefore)) {
    throw new Error(
      'F24 rollback proof changed staging state or lost timing identity.',
    );
  }
  const body = {
    schema_version:
      'QXO_NO_SHOP_TIMING_F24_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope:
      'ROLLBACK_ONLY_NO_SHOP_TIMING_F24',
    project_ref: PROJECT.ref,
    timing_certification_bundle: bundle,
    staging_execution: {
      database_calls: 3,
      immediate_retries: 0,
      statement_timeout_ms: 15000,
      lock_timeout_ms: 2000,
      insert_shape: 'ONE_SET_BASED_JSONB_TO_RECORDSET',
      transaction,
      post_rollback: postRollback,
      active_pointer_before: activePointerBefore,
      active_pointer_unchanged: true,
      rollback_verified: true,
      durable_rows_written: 0,
    },
    authority: bundle.manifest.authority,
    status: bundle.manifest.status,
  };
  return {
    ...body,
    qxo_no_shop_timing_f24_staging_attestation_id:
      contentId(
        'QXO_NO_SHOP_TIMING_F24_STAGING_ATTESTATION/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_TIMING_F24_STAGING_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  };
}
// F24_ROLLBACK_ONLY_STAGING_CERTIFICATION_END

// F25_ROLLBACK_ONLY_STAGING_CERTIFICATION_BEGIN
function buildNoShopActionsF25Runtime() {
  const f24Attestation = JSON.parse(readFileSync(
    NO_SHOP_TIMING_F24_FIXTURE_PATH,
    'utf8',
  ));
  const contractBundle = compileFixtureContractV6();
  const {
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs(contractBundle);
  const reviewedSlice = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const actionSeed = buildQxoNoShopActionsF6ParserBoundReviewSeed({
    ...parserInputs,
    admitted_parser_proposal_envelope:
      admittedParserProposalEnvelope,
    reviewed_no_shop_actions_f6_slice: reviewedSlice,
  });
  const supplementInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope:
      admittedParserProposalEnvelope,
  };
  const supplement =
    buildQxoNoShopNestedDefinitionCandidateSupplement(
      supplementInputs,
    );
  const definitionGraph =
    buildQxoNoShopReviewedDefinitionGraphF6({
      ...supplementInputs,
      qxo_no_shop_nested_definition_candidate_supplement:
        supplement,
    });
  const exceptionCarrier =
    buildQxoNoShopExceptionSourceBindingF6({
      ...parserInputs,
      qxo_no_shop_actions_f6_parser_bound_review_seed:
        actionSeed,
      qxo_no_shop_reviewed_definition_graph_f6:
        definitionGraph,
    });
  const inputs = {
    f24_timing_certification_bundle:
      f24Attestation.timing_certification_bundle,
    contract_bundle_v6: contractBundle,
    admitted_source_context_v6: admittedSourceContext,
    reviewed_no_shop_actions_f6_slice: reviewedSlice,
    qxo_no_shop_exception_source_binding_f6:
      exceptionCarrier,
  };
  const bundle = buildNoShopActionsCertificationF25(inputs);
  validateNoShopActionsCertificationF25({
    no_shop_actions_certification_f25: bundle,
    ...inputs,
  });
  return { bundle, inputs };
}

function f25RollbackSql(bundle) {
  const records = bundle.categorical_certifications.map(
    (carrier) => ({
      metric_key: carrier.observation.metric_key,
      metric_serving_admission_id:
        carrier.metric_serving_admission
          .metric_serving_admission_id,
      carrier,
    }),
  );
  return `BEGIN;
SET LOCAL lock_timeout = '2000ms';
SET LOCAL statement_timeout = '15000ms';
SELECT pg_advisory_xact_lock(20260727, 25);

DO $f25_guard$
BEGIN
  IF to_regclass(
    'canonical_v2_staging.no_shop_actions_f25_probe'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'F25 staging probe already exists';
  END IF;
END
$f25_guard$;

CREATE TABLE canonical_v2_staging.no_shop_actions_f25_probe (
  metric_key text PRIMARY KEY,
  metric_serving_admission_id text UNIQUE NOT NULL
    CHECK (
      metric_serving_admission_id ~ '^[a-f0-9]{64}$'
    ),
  carrier jsonb NOT NULL
);
ALTER TABLE
  canonical_v2_staging.no_shop_actions_f25_probe
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON
  canonical_v2_staging.no_shop_actions_f25_probe
  FROM PUBLIC;

INSERT INTO canonical_v2_staging.no_shop_actions_f25_probe (
  metric_key,
  metric_serving_admission_id,
  carrier
)
SELECT
  record.metric_key,
  record.metric_serving_admission_id,
  record.carrier
FROM jsonb_to_recordset(
  ${f20SqlJson(records, 'f25_categorical_records')}
) AS record(
  metric_key text,
  metric_serving_admission_id text,
  carrier jsonb
);

SELECT jsonb_build_object(
  'categorical_rows', count(*)::integer,
  'distinct_admissions',
    count(DISTINCT metric_serving_admission_id)::integer,
  'bound_carriers', sum(
    (
      (carrier #>>
        '{metric_serving_admission,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{observation,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{cohort_result,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
    + (
      (carrier #>>
        '{query_projection,metric_serving_admission_id}') =
        metric_serving_admission_id
    )::integer
  )::integer,
  'metric_keys',
    jsonb_agg(metric_key ORDER BY metric_key),
  'active_pointer_during',
    public.canonical_v2_active_release('staging')
) AS evidence
FROM canonical_v2_staging.no_shop_actions_f25_probe;
ROLLBACK;`;
}

function f25PostRollbackSql() {
  return `SELECT jsonb_build_object(
  'probe_table_exists', to_regclass(
    'canonical_v2_staging.no_shop_actions_f25_probe'
  ) IS NOT NULL,
  'active_pointer_after',
    public.canonical_v2_active_release('staging')
) AS evidence;`;
}

function buildNoShopActionsF25Attestation() {
  guardProject();
  const { bundle } = buildNoShopActionsF25Runtime();
  const activePointerBefore = oneEvidenceRow(
    runF20SqlFile(f23PointerSql()),
    'F25 active pointer precheck',
    'active_pointer',
  );
  const transaction = oneEvidenceRow(
    runF20SqlFile(f25RollbackSql(bundle)),
    'F25 rollback transaction',
  );
  const postRollback = oneEvidenceRow(
    runF20SqlFile(f25PostRollbackSql()),
    'F25 post-rollback check',
  );
  const expectedMetrics = [
    'NO_SHOP_ACTION_KNOWLEDGE_QUALIFIER',
    'NO_SHOP_EXCEPTION_EFFECT',
    'NO_SHOP_EXCEPTION_PREREQUISITE',
    'NO_SHOP_INLINE_PERMISSION_EFFECT',
    'NO_SHOP_PROHIBITED_ACTION',
  ];
  const requestAdmissions =
    bundle.combined_market_request.metric_bindings.map(
      (entry) => entry.metric_serving_admission_id,
    ).sort();
  if (transaction.categorical_rows !== 5
    || transaction.distinct_admissions !== 5
    || transaction.bound_carriers !== 20
    || canonicalJson(transaction.metric_keys)
      !== canonicalJson(expectedMetrics)
    || canonicalJson(requestAdmissions)
      !== canonicalJson(
        bundle.manifest.new_metric_serving_admission_ids,
      )
    || bundle.combined_market_request.database_call_budget !== 1
    || bundle.combined_market_request.immediate_retries !== 0
    || canonicalJson(transaction.active_pointer_during)
      !== canonicalJson(activePointerBefore)
    || postRollback.probe_table_exists !== false
    || canonicalJson(postRollback.active_pointer_after)
      !== canonicalJson(activePointerBefore)) {
    throw new Error(
      'F25 rollback proof changed staging state or lost categorical identity.',
    );
  }
  const body = {
    schema_version:
      'QXO_NO_SHOP_ACTIONS_F25_STAGING_ATTESTATION/V1',
    environment: 'STAGING',
    authority_scope:
      'ROLLBACK_ONLY_NO_SHOP_ACTIONS_F25',
    project_ref: PROJECT.ref,
    actions_certification_bundle: bundle,
    staging_execution: {
      database_calls: 3,
      immediate_retries: 0,
      statement_timeout_ms: 15000,
      lock_timeout_ms: 2000,
      insert_shape: 'ONE_SET_BASED_JSONB_TO_RECORDSET',
      serving_request_database_call_budget:
        bundle.combined_market_request.database_call_budget,
      transaction,
      post_rollback: postRollback,
      active_pointer_before: activePointerBefore,
      active_pointer_unchanged: true,
      rollback_verified: true,
      durable_rows_written: 0,
    },
    authority: bundle.manifest.authority,
    status: bundle.manifest.status,
  };
  return {
    ...body,
    qxo_no_shop_actions_f25_staging_attestation_id:
      contentId(
        'QXO_NO_SHOP_ACTIONS_F25_STAGING_ATTESTATION/V1',
        body,
      ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_F25_STAGING_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  };
}
// F25_ROLLBACK_ONLY_STAGING_CERTIFICATION_END

function verifyActionsFailureIsolation(bridgeInputs) {
  const missingFirstAction = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_slice,
  ));
  missingFirstAction.claims = missingFirstAction.claims.filter(
    (claim) => claim.canonical_value
      !== 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
  );
  missingFirstAction.actionClaims = missingFirstAction.actionClaims.filter(
    (claim) => claim.canonical_value
      !== 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
  );
  const firstActionOutcomes = buildQxoNoShopActionsParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_actions_slice: missingFirstAction,
  }).action_outcomes;
  if (firstActionOutcomes[0].suppressed !== true
    || firstActionOutcomes.slice(1).some((outcome) => outcome.suppressed)) {
    throw new Error('Missing first action did not remain isolated to that action.');
  }

  const missingPrerequisite = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_slice,
  ));
  missingPrerequisite.claims = missingPrerequisite.claims.filter(
    (claim) => claim.canonical_value !== 'NO_PRIOR_BREACH',
  );
  missingPrerequisite.prerequisiteClaims =
    missingPrerequisite.prerequisiteClaims.filter(
      (claim) => claim.canonical_value !== 'NO_PRIOR_BREACH',
    );
  const prerequisiteOutcomes = buildQxoNoShopActionsParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_actions_slice: missingPrerequisite,
  });
  if (prerequisiteOutcomes.exception_context_outcome.suppressed !== true
    || prerequisiteOutcomes.exception_context_outcome.failure_code
      !== 'EXCEPTION_SOURCE_MAPPING_REQUIRES_CORRECTION'
    || prerequisiteOutcomes.action_outcomes.some((outcome) => outcome.suppressed)) {
    throw new Error('Missing prerequisite did not remain isolated to exception context.');
  }

  const withoutResultInputs = JSON.parse(JSON.stringify(
    bridgeInputs.reviewed_no_shop_actions_slice,
  ));
  delete withoutResultInputs.resultInputs;
  const baseline = buildQxoNoShopActionsParserBoundReviewSeed(bridgeInputs);
  const withoutLegacyInputs = buildQxoNoShopActionsParserBoundReviewSeed({
    ...bridgeInputs,
    reviewed_no_shop_actions_slice: withoutResultInputs,
  });
  if (canonicalJson(withoutLegacyInputs) !== canonicalJson(baseline)) {
    throw new Error('Legacy resultInputs affected the review-only actions seed.');
  }

  let unknownFieldRejected = false;
  try {
    buildQxoNoShopActionsParserBoundReviewSeed({
      ...bridgeInputs,
      unknown_authority: true,
    });
  } catch (_) {
    unknownFieldRejected = true;
  }
  if (!unknownFieldRejected) {
    throw new Error('The actions bridge accepted an unknown authority field.');
  }

  for (const alteredSlice of [
    (() => {
      const value = JSON.parse(JSON.stringify(
        bridgeInputs.reviewed_no_shop_actions_slice,
      ));
      value.reviewed_mapping = { untrusted: true };
      return value;
    })(),
    (() => {
      const value = JSON.parse(JSON.stringify(
        bridgeInputs.reviewed_no_shop_actions_slice,
      ));
      value.claims.push({
        claim_revision_id: 'f'.repeat(64),
        claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
        subject_occurrence_id: 'unvalidated-extra-subject',
        ordinal: 999,
        canonical_value: 'UNREVIEWED_LEGAL_PROPOSITION',
      });
      return value;
    })(),
    (() => {
      const value = JSON.parse(JSON.stringify(
        bridgeInputs.reviewed_no_shop_actions_slice,
      ));
      value.claims = Array.from(
        { length: 129 },
        () => value.claims[0],
      );
      return value;
    })(),
  ]) {
    let rejected = false;
    try {
      buildQxoNoShopActionsParserBoundReviewSeed({
        ...bridgeInputs,
        reviewed_no_shop_actions_slice: alteredSlice,
      });
    } catch (_) {
      rejected = true;
    }
    if (!rejected) {
      throw new Error('The actions bridge accepted unvalidated review material.');
    }
  }
  return true;
}

function buildActionsAttestation() {
  const {
    contractBundle,
    admittedSourceContext,
    admittedParserProposalEnvelope,
    parserInputs,
  } = buildSourceInputs();
  const reviewedNoShopActionsSlice = buildQxoAdmittedNoShopActionsSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  const bridgeInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_actions_slice: reviewedNoShopActionsSlice,
  };
  const seed = buildQxoNoShopActionsParserBoundReviewSeed(bridgeInputs);
  validateQxoNoShopActionsParserBoundReviewSeed({
    qxo_no_shop_actions_parser_bound_review_seed: seed,
    ...bridgeInputs,
  });
  const sectionParent = admittedParserProposalEnvelope
    .structural_section_proposals
    .find((proposal) => (
      proposal.admitted_structural_section_proposal_id
        === seed.parser_binding.section_4_3_proposal_id
    ));
  if (!sectionParent) throw new Error('The attested Section 4.3 parser parent is absent.');
  return {
    schema_version: 'QXO_NO_SHOP_ACTIONS_STAGING_ATTESTATION/V1',
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
    reviewed_action_reference_set_id:
      seed.reviewed_mapping_reference.action_reference_set_id,
    rejected_source_reviewed_mapping_id:
      seed.reviewed_mapping_reference.source_reviewed_mapping_id,
    action_dependencies: seed.action_outcomes.map((outcome) => ({
      action_key: outcome.action_key,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
      claim_revision_id: outcome.reference?.claim.claim_revision_id || null,
      provision_component_id:
        outcome.reference?.provision_component_id || null,
      evidence_excerpt_id: outcome.reference?.evidence_excerpt_id || null,
    })),
    exception_context_dependency: {
      suppressed: seed.exception_context_outcome.suppressed,
      failure_code: seed.exception_context_outcome.failure_code,
      prerequisite_count:
        seed.exception_context_outcome.reference
          ?.ordered_prerequisite_claims.length || 0,
      relationship_count:
        seed.exception_context_outcome.reference
          ?.ordered_relationships.length || 0,
      relationship_effect_authority:
        seed.exception_context_outcome.reference
          ?.relationship_effect_authority || null,
    },
    seed_status: seed.status,
    failure_isolation_verified: verifyActionsFailureIsolation(bridgeInputs),
    qxo_no_shop_actions_parser_bound_review_seed_id:
      seed.qxo_no_shop_actions_parser_bound_review_seed_id,
    canonical_payload_digest: seed.canonical_payload_digest,
  };
}

const mode = process.argv[2];
if (![
  '--print',
  '--verify',
  '--actions-print',
  '--actions-verify',
  '--actions-f6-print',
  '--actions-f6-verify',
  '--definitions-f6-print',
  '--definitions-f6-verify',
  '--definition-graph-f6-print',
  '--definition-graph-f6-verify',
  '--exception-source-f6-print',
  '--exception-source-f6-verify',
  '--inline-permission-f9-print',
  '--inline-permission-f9-verify',
  '--notice-source-f6-print',
  '--notice-source-f6-verify',
  '--notice-semantic-closure-f6-print',
  '--notice-semantic-closure-f6-verify',
  '--notice-review-materialisation-f7-print',
  '--notice-review-materialisation-f7-verify',
  '--notice-definition-relationships-f8-print',
  '--notice-definition-relationships-f8-verify',
  '--notice-receipt-f10-print',
  '--notice-receipt-f10-verify',
  '--definition-control-f11-print',
  '--definition-control-f11-verify',
  '--definition-scope-f13-print',
  '--definition-scope-f13-verify',
  '--notice-revision-f14-print',
  '--notice-revision-f14-verify',
  '--copy-clock-f15-print',
  '--copy-clock-f15-verify',
  '--copy-delivery-metric-f16-print',
  '--copy-delivery-metric-f16-verify',
  '--copy-delivery-claim-f17-print',
  '--copy-delivery-claim-f17-verify',
  '--copy-delivery-serving-f18-print',
  '--copy-delivery-serving-f18-verify',
  '--copy-delivery-canonical-f19-print',
  '--copy-delivery-canonical-f19-verify',
  '--copy-delivery-query-f20-print',
  '--copy-delivery-query-f20-verify',
  '--copy-delivery-release-f23-print',
  '--copy-delivery-release-f23-verify',
  '--no-shop-timing-f24-print',
  '--no-shop-timing-f24-verify',
  '--no-shop-actions-f25-print',
  '--no-shop-actions-f25-verify',
].includes(mode)
  || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs [supported attestation print/verify mode, including --no-shop-actions-f25-print|--no-shop-actions-f25-verify]');
}

try {
  const noShopActionsF25Mode =
    mode.startsWith('--no-shop-actions-f25-');
  const noShopTimingF24Mode =
    !noShopActionsF25Mode
    && mode.startsWith('--no-shop-timing-f24-');
  const copyDeliveryReleaseF23Mode =
    !noShopTimingF24Mode
    && mode.startsWith('--copy-delivery-release-f23-');
  const copyDeliveryQueryF20Mode = !copyDeliveryReleaseF23Mode
    &&
    mode.startsWith('--copy-delivery-query-f20-');
  const copyDeliveryCanonicalF19Mode = !copyDeliveryQueryF20Mode
    &&
    mode.startsWith('--copy-delivery-canonical-f19-');
  const copyDeliveryServingF18Mode = !copyDeliveryCanonicalF19Mode
    &&
    mode.startsWith('--copy-delivery-serving-f18-');
  const copyDeliveryClaimF17Mode = !copyDeliveryServingF18Mode
    &&
    mode.startsWith('--copy-delivery-claim-f17-');
  const copyDeliveryMetricF16Mode = !copyDeliveryClaimF17Mode
    &&
    mode.startsWith('--copy-delivery-metric-f16-');
  const copyClockF15Mode = !copyDeliveryMetricF16Mode
    &&
    mode.startsWith('--copy-clock-f15-');
  const noticeRevisionF14Mode = !copyClockF15Mode
    &&
    mode.startsWith('--notice-revision-f14-');
  const definitionScopeF13Mode = !noticeRevisionF14Mode
    &&
    mode.startsWith('--definition-scope-f13-');
  const definitionControlF11Mode = !definitionScopeF13Mode
    &&
    mode.startsWith('--definition-control-f11-');
  const noticeReceiptF10Mode =
    !definitionControlF11Mode
    && mode.startsWith('--notice-receipt-f10-');
  const inlinePermissionF9Mode =
    !noticeReceiptF10Mode && mode.startsWith('--inline-permission-f9-');
  const noticeDefinitionRelationshipsF8Mode =
    !inlinePermissionF9Mode
    && mode.startsWith('--notice-definition-relationships-f8-');
  const noticeReviewMaterialisationF7Mode =
    !noticeDefinitionRelationshipsF8Mode
    &&
    mode.startsWith('--notice-review-materialisation-f7-');
  const noticeSemanticClosureF6Mode = !noticeReviewMaterialisationF7Mode
    && mode.startsWith('--notice-semantic-closure-f6-');
  const noticeSourceF6Mode = !noticeSemanticClosureF6Mode
    && mode.startsWith('--notice-source-f6-');
  const exceptionSourceF6Mode = !noticeSemanticClosureF6Mode
    && !noticeSourceF6Mode
    && mode.startsWith('--exception-source-f6-');
  const definitionGraphF6Mode = !noticeSemanticClosureF6Mode
    && !noticeSourceF6Mode && !exceptionSourceF6Mode
    && mode.startsWith('--definition-graph-f6-');
  const definitionsF6Mode = !noticeSemanticClosureF6Mode
    && !noticeSourceF6Mode && !exceptionSourceF6Mode && !definitionGraphF6Mode
    && mode.startsWith('--definitions-f6-');
  const actionsF6Mode = !definitionsF6Mode && mode.startsWith('--actions-f6-');
  const actionsMode = !actionsF6Mode && mode.startsWith('--actions-');
  const attestation = noShopActionsF25Mode
    ? buildNoShopActionsF25Attestation()
    : noShopTimingF24Mode
    ? buildNoShopTimingF24Attestation()
    : copyDeliveryReleaseF23Mode
    ? buildCopyDeliveryReleaseF23Attestation()
    : copyDeliveryQueryF20Mode
    ? buildCopyDeliveryQueryF20Attestation()
    : copyDeliveryCanonicalF19Mode
    ? buildCopyDeliveryCanonicalF19Attestation()
    : copyDeliveryServingF18Mode
    ? buildCopyDeliveryServingF18Attestation()
    : copyDeliveryClaimF17Mode
    ? buildCopyDeliveryClaimF17Attestation()
    : copyDeliveryMetricF16Mode
    ? buildCopyDeliveryMetricF16Attestation()
    : copyClockF15Mode
    ? buildCopyClockF15Attestation()
    : noticeRevisionF14Mode
    ? buildNoticeRevisionF14Attestation()
    : definitionScopeF13Mode
    ? buildDefinitionScopeF13Attestation()
    : definitionControlF11Mode
    ? buildDefinitionControlF11Attestation()
    : noticeReceiptF10Mode
    ? buildNoticeReceiptF10Attestation()
    : inlinePermissionF9Mode
    ? buildInlinePermissionF9Attestation()
    : noticeDefinitionRelationshipsF8Mode
    ? buildNoticeDefinitionRelationshipsF8Attestation()
    : noticeReviewMaterialisationF7Mode
    ? buildNoticeReviewMaterialisationF7Attestation()
    : noticeSemanticClosureF6Mode
    ? buildNoticeSemanticClosureF6Attestation()
    : noticeSourceF6Mode
    ? buildNoticeSourceF6Attestation()
    : exceptionSourceF6Mode
    ? buildExceptionSourceF6Attestation()
    : definitionGraphF6Mode
    ? buildDefinitionGraphF6Attestation()
    : definitionsF6Mode
    ? buildDefinitionsF6Attestation()
    : actionsF6Mode
    ? buildActionsF6Attestation()
    : actionsMode ? buildActionsAttestation() : buildAttestation();
  const emittedAttestation = exceptionSourceF6Mode
    ? exceptionSourceF6AttestationProjection(attestation)
    : attestation;
  if (mode.endsWith('verify')) {
    const expected = JSON.parse(readFileSync(
      noShopActionsF25Mode
        ? NO_SHOP_ACTIONS_F25_FIXTURE_PATH
        : noShopTimingF24Mode
        ? NO_SHOP_TIMING_F24_FIXTURE_PATH
        : copyDeliveryReleaseF23Mode
        ? COPY_DELIVERY_RELEASE_F23_FIXTURE_PATH
        : copyDeliveryQueryF20Mode
        ? COPY_DELIVERY_QUERY_F20_FIXTURE_PATH
        : copyDeliveryCanonicalF19Mode
        ? COPY_DELIVERY_CANONICAL_F19_FIXTURE_PATH
        : copyDeliveryServingF18Mode
        ? COPY_DELIVERY_SERVING_F18_FIXTURE_PATH
        : copyDeliveryClaimF17Mode
        ? COPY_DELIVERY_CLAIM_F17_FIXTURE_PATH
        : copyDeliveryMetricF16Mode
        ? COPY_DELIVERY_METRIC_F16_FIXTURE_PATH
        : copyClockF15Mode
        ? COPY_CLOCK_F15_FIXTURE_PATH
        : noticeRevisionF14Mode
        ? NOTICE_REVISION_F14_FIXTURE_PATH
        : definitionScopeF13Mode
        ? DEFINITION_SCOPE_F13_FIXTURE_PATH
        : definitionControlF11Mode
        ? DEFINITION_CONTROL_F11_FIXTURE_PATH
        : noticeReceiptF10Mode
        ? NOTICE_RECEIPT_F10_FIXTURE_PATH
        : inlinePermissionF9Mode
        ? INLINE_PERMISSION_F9_FIXTURE_PATH
        : noticeDefinitionRelationshipsF8Mode
        ? NOTICE_DEFINITION_RELATIONSHIPS_F8_FIXTURE_PATH
        : noticeReviewMaterialisationF7Mode
        ? NOTICE_REVIEW_MATERIALISATION_F7_FIXTURE_PATH
        : noticeSemanticClosureF6Mode
        ? NOTICE_SEMANTIC_CLOSURE_F6_FIXTURE_PATH
        : noticeSourceF6Mode
        ? NOTICE_SOURCE_F6_FIXTURE_PATH
        : exceptionSourceF6Mode
        ? EXCEPTION_SOURCE_F6_FIXTURE_PATH
        : definitionGraphF6Mode
        ? DEFINITION_GRAPH_F6_FIXTURE_PATH
        : definitionsF6Mode
        ? DEFINITIONS_F6_FIXTURE_PATH
        : actionsF6Mode
        ? ACTIONS_F6_FIXTURE_PATH
        : actionsMode ? ACTIONS_FIXTURE_PATH : FIXTURE_PATH,
      'utf8',
    ));
    if (canonicalJson(emittedAttestation) !== canonicalJson(expected)) {
      throw new Error('The checked QXO no-shop staging attestation has drifted.');
    }
  }
  process.stdout.write(`${canonicalJson(emittedAttestation)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'QXO no-shop clock attestation failed.');
}
