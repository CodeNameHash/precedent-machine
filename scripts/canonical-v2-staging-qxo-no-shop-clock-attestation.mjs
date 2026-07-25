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
].includes(mode)
  || process.argv.length !== 3) {
  fail('Usage: node scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs --print|--verify|--actions-print|--actions-verify|--actions-f6-print|--actions-f6-verify');
}

try {
  const actionsF6Mode = mode.startsWith('--actions-f6-');
  const actionsMode = !actionsF6Mode && mode.startsWith('--actions-');
  const attestation = actionsF6Mode
    ? buildActionsF6Attestation()
    : actionsMode ? buildActionsAttestation() : buildAttestation();
  if (mode.endsWith('verify')) {
    const expected = JSON.parse(readFileSync(
      actionsF6Mode
        ? ACTIONS_F6_FIXTURE_PATH
        : actionsMode ? ACTIONS_FIXTURE_PATH : FIXTURE_PATH,
      'utf8',
    ));
    if (canonicalJson(attestation) !== canonicalJson(expected)) {
      throw new Error('The checked QXO no-shop staging attestation has drifted.');
    }
  }
  process.stdout.write(`${canonicalJson(attestation)}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : 'QXO no-shop clock attestation failed.');
}
