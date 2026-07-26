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
  compileFixtureContractV6,
  compileFixtureContractV7,
  compileFixtureContractV8,
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
  buildQxoAdmittedNoShopActionsSlice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice');
const {
  buildQxoAdmittedNoShopActionsF6Slice,
} = require('../lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-f6-slice');
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
  return { bindingInputs, carrier, contractBundle };
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
].includes(mode)
  || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs --print|--verify|--actions-print|--actions-verify|--actions-f6-print|--actions-f6-verify|--definitions-f6-print|--definitions-f6-verify|--definition-graph-f6-print|--definition-graph-f6-verify|--exception-source-f6-print|--exception-source-f6-verify|--inline-permission-f9-print|--inline-permission-f9-verify|--notice-source-f6-print|--notice-source-f6-verify|--notice-semantic-closure-f6-print|--notice-semantic-closure-f6-verify|--notice-review-materialisation-f7-print|--notice-review-materialisation-f7-verify|--notice-definition-relationships-f8-print|--notice-definition-relationships-f8-verify');
}

try {
  const inlinePermissionF9Mode =
    mode.startsWith('--inline-permission-f9-');
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
  const attestation = inlinePermissionF9Mode
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
      inlinePermissionF9Mode
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
