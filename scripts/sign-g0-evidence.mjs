#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const YAML = require('yaml');
const {
  canonicalBytes,
  domainDigest,
  signatureBytes,
} = require('../lib/programme-gates/bytes');
const {
  collectContainmentEvidence,
} = require('../lib/programme-gates/containment-collector');
const {
  CONTAINMENT_RUNTIME,
  validateDeploymentBinding,
} = require('../lib/programme-gates/containment-runtime');
const {
  buildContainmentEvidenceSigningRequest,
  createContainmentSigningRequestAuthority,
} = require('../lib/programme-gates/containment-signing-request');
const {
  createContainmentSignedPreflightAuthority,
  preflightContainmentEvidenceSignature,
} = require('../lib/programme-gates/containment-signed-preflight');
const {
  buildContainmentStatusReadiness,
  createContainmentStatusReadinessAuthority,
} = require('../lib/programme-gates/containment-status-readiness');
const {
  createCurrentPublicationAuthority,
  loadCurrentProgrammePublication,
} = require('../lib/programme-gates/current-publication');
const {
  BOOTSTRAP_NONCE,
  createGoverningRegistryAuthority,
} = require('../lib/programme-gates/governing-registry');
const {
  buildIsolationObservationSource,
  PREVIEW_BRANCH,
} = require('../lib/programme-gates/isolation-collector');
const {
  buildIsolationReadiness,
  createIsolationReadinessAuthority,
} = require('../lib/programme-gates/isolation-readiness');
const {
  buildIsolationSigningRequest,
  createIsolationSigningAuthority,
  preflightIsolationSignature,
} = require('../lib/programme-gates/isolation-signing');
const {
  buildBenApproval,
  buildReviewSetInput,
} = require('../lib/programme-gates/review-artifact');
const {
  buildReviewApprovalReadiness,
  createReviewApprovalReadinessAuthority,
} = require('../lib/programme-gates/review-readiness');
const {
  buildReviewApprovalSigningRequest,
  createReviewApprovalSigningAuthority,
  preflightReviewApprovalSignature,
} = require('../lib/programme-gates/review-signing');
const {
  REGISTRY_DIGESTS,
  TRUSTED_PUBLIC_KEY_REGISTRY,
} = require('../lib/programme-gates/registry');
const {
  buildSecurityDispositionReadiness,
  createSecurityDispositionReadinessAuthority,
} = require('../lib/programme-gates/security-disposition-readiness');
const {
  buildSecurityDispositionSigningRequest,
  createSecurityDispositionSigningAuthority,
  preflightSecurityDispositionSignature,
} = require('../lib/programme-gates/security-disposition-signing');
const {
  programmeGateValidatorExecutableDigest,
} = require('../lib/programme-gates/validator-executable');
const {
  TEST_EXECUTABLE_SET_DOMAIN,
  expectedTestExecutableDigest,
  testExecutableFiles,
} = require('../lib/programme-gates/test-executable-registry');
const {
  attestTestExecutionRecord,
} = require('../lib/programme-gates/test-execution-attestation');
const {
  buildG0StatusReadiness,
  createG0SignedStatusAuthority,
  createG0StatusReadinessAuthority,
} = require('../lib/programme-gates/g0-status-readiness');
const {
  STATUS_ARTEFACT_ID_DOMAIN,
  STATUS_ARTEFACT_PAYLOAD_DOMAIN,
  createProgrammePublicationAuthority,
  gitBlobObjectId,
  planProgrammeStatusPublication,
} = require('../lib/programme-gates/publication');
const {
  executeProgrammeStatusPublication,
  remoteRef,
} = require('../lib/programme-gates/publication-executor');
const { validateSchema } = require('../lib/programme-gates/schema-registry');
const { verifySignature } = require('../lib/programme-gates/signatures');
const {
  attachProgrammeGateStatusSignature,
  unsignedProgrammeGateStatus,
} = require('../lib/programme-gates/status');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.resolve(
  ROOT,
  'docs/certification/evidence/G0-SECURITY-DISPOSITIONS-2026-07-28.json',
);
const GATE_TEST_FILES = testExecutableFiles('GATE-01');
const DEPLOY_CUTOVER_TEST_FILES = testExecutableFiles('DEPLOY-CUTOVER-01');
const PREVIEW_AUTH_TEST_FILES = testExecutableFiles('PREVIEW-AUTH-01');
const REVIEW_CONTEXT_TEST_FILES = testExecutableFiles('REVIEW-CONTEXT-01');
const VALIDATOR_KEY_ID = 'PROGRAMME_GATE_VALIDATOR_2026_07';
const BEN_APPROVER_KEY_ID = 'PROGRAMME_GATE_BEN_APPROVER_2026_07';
const STATUS_PUBLISHER_KEY_ID = 'PROGRAMME_STATUS_PUBLISHER_2026_07';
const PRODUCTION_ORIGIN = 'https://deal-corpus.vercel.app';
const PRODUCTION_ALIAS = 'deal-corpus.vercel.app';
const VERCEL_API_ORIGIN = 'https://api.vercel.com';
const VERCEL_TEAM_ID = 'team_Zu8dnrxhP3FY0BcfOZtQ4z71';
const VERCEL_PROJECT_ID = 'prj_pseZ68ISXsxADzNcffHTO2NuGM8b';
const REVIEW_BASIS_COMMIT = 'd62456a81567baf8bf6aef7ae0c6290567086a08';
const REVIEW_BASIS_ROOT = '6b5d7c2c0c57f4a6d7a508ae9cd5cf9f77370d53e956797504e080415eb7330a';
const REVIEW_ARTIFACT_SHA256 =
  '77ef5f3366f7019a31240cbea2b0825ff96566e7861e3df1f18221416be76ce7';
const REVIEW_ARTIFACT_BYTE_SIZE = 16759182;
const APPROVAL_INTENT = 'AUTHORISE_ISOLATED_STAGING_CANONICAL_IMPLEMENTATION';
const OWNER_AUTHORITY_ALLOWED_PATHS = Object.freeze([
  '.github/phase-allowlists/wp-agreement-comparable-result-order-v1.json',
  '.github/phase-allowlists/wp-agreement-comparable-result-ordering-contract-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-compiler-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-current-root-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-freeze-candidate-assembler-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-pre-review-package-assembler-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-pre-review-source-closure-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-bundle-reviewed-registry-assembler-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-current-review-generator-v1.json',
  '.github/phase-allowlists/wp-canonical-contract-root-agreement-validator-wiring-v1.json',
  '.github/phase-allowlists/wp-canonical-qxo-capitalisation-f27.json',
  '.github/phase-allowlists/wp-canonical-required-kind-registry-generator-v1.json',
  '.github/phase-allowlists/wp-canonical-successor-root-v1.json',
  '.github/phase-allowlists/wp-contract-freeze-predecessor-source-anchor-v1.json',
  '.github/phase-allowlists/wp-contract-review-source-binding-v1.json',
  '.github/phase-allowlists/wp-contract-review-source-package-v2.json',
  '.github/phase-allowlists/wp-g0-owner-authority.json',
  '.github/phase-allowlists/wp-metsera-gold-evidence-v1.json',
  '.github/phase-allowlists/wp-p0-executable-digest-reconciliation-v1.json',
  '.github/phase-allowlists/wp-p1-complete-universe-test-reconciliation-v1.json',
  '.github/phase-allowlists/wp-p1-contract-freeze-review-controller-v1.json',
  '.github/phase-allowlists/wp-p1-contract-freeze-review-registration-v1.json',
  '.github/phase-allowlists/wp-p1-review-controller-domain-authority-v1.json',
  '.github/phase-allowlists/wp-p1-review-controller-specification-root-v1.json',
  '.github/phase-allowlists/wp-p1-review-controller-test-digest-reconciliation-v1.json',
  '.github/phase-allowlists/wp-pi-spark-premerge-review-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-evidence-integration-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-pi-integration-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-release-review-high-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-root-regeneration-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-shared-consumer-v2.json',
  '.github/phase-allowlists/wp-pilot-freeze-signer-path-closure-v1.json',
  '.github/phase-allowlists/wp-pilot-freeze-test-reconciliation-v1.json',
  '.github/phase-allowlists/wp-pilot-integration-preflight-evidence-v1.json',
  '.github/phase-allowlists/wp-pilot-integration-state-preflight-v1.json',
  '.github/phase-allowlists/wp-pm-execution-ledger-v1.json',
  '.github/phase-allowlists/wp-process-agreement-identity-v1.json',
  '.github/phase-allowlists/wp-process-bidder-track-event-membership-v1.json',
  '.github/phase-allowlists/wp-process-bidder-track-identity-v1.json',
  '.github/phase-allowlists/wp-process-candidate-graph-v1.json',
  '.github/phase-allowlists/wp-process-candidate-validator-v1.json',
  '.github/phase-allowlists/wp-process-controlled-code-registry-contract-v1.json',
  '.github/phase-allowlists/wp-process-deal-fact-projection-v1.json',
  '.github/phase-allowlists/wp-process-event-identity-v1.json',
  '.github/phase-allowlists/wp-process-event-slot-binding-contract-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-challenge-catalogue-validation-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-completeness-challenge-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-contracts-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-pilot-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-predicate-catalogue-v2.json',
  '.github/phase-allowlists/wp-process-exclusivity-predicate-machine-rules-v2.json',
  '.github/phase-allowlists/wp-process-exclusivity-predicate-runtime-v2.json',
  '.github/phase-allowlists/wp-process-exclusivity-result-v1.json',
  '.github/phase-allowlists/wp-process-exclusivity-runtime-v1.json',
  '.github/phase-allowlists/wp-process-field-navigation-contracts-v1.json',
  '.github/phase-allowlists/wp-process-filter-compiler-v1.json',
  '.github/phase-allowlists/wp-process-generic-outcome-interface-v1.json',
  '.github/phase-allowlists/wp-process-intelligence-baseline-v1.json',
  '.github/phase-allowlists/wp-process-intelligence-storylines-baseline-v1.json',
  '.github/phase-allowlists/wp-process-lexical-enumerator-v1.json',
  '.github/phase-allowlists/wp-process-narration-occurrence-v1.json',
  '.github/phase-allowlists/wp-process-navigation-catalogue-v2.json',
  '.github/phase-allowlists/wp-process-p1-event-participant-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-integrity-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-narration-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-objects-v1.json',
  '.github/phase-allowlists/wp-process-p1-passage-serving-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-result-action-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-source-universe-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p1-track-phase-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-process-p4-query-ir-contracts-v1.json',
  '.github/phase-allowlists/wp-process-p4-query-runtime-v1.json',
  '.github/phase-allowlists/wp-process-p7-stage3-corrections-v1.json',
  '.github/phase-allowlists/wp-process-p7-stage3-interface-closure-v1.json',
  '.github/phase-allowlists/wp-process-paragraph-context-v1.json',
  '.github/phase-allowlists/wp-process-participant-identity-v1.json',
  '.github/phase-allowlists/wp-process-passage-identity-v1.json',
  '.github/phase-allowlists/wp-process-passage-order-v1.json',
  '.github/phase-allowlists/wp-process-phase-identity-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-product-result-adapter-contract-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-product-result-set-adapter-contract-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-product-result-set-bridge-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-result-admission-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-result-identity-v1.json',
  '.github/phase-allowlists/wp-process-phrasebook-shared-row-bridge-v1.json',
  '.github/phase-allowlists/wp-process-position-identity-v1.json',
  '.github/phase-allowlists/wp-process-predicate-witness-v2.json',
  '.github/phase-allowlists/wp-process-product-field-catalogue-v1.json',
  '.github/phase-allowlists/wp-process-product-field-source-registry-v1.json',
  '.github/phase-allowlists/wp-process-product-navigation-catalogue-v1.json',
  '.github/phase-allowlists/wp-process-product-result-contract-membership-v1.json',
  '.github/phase-allowlists/wp-process-related-passages-v1.json',
  '.github/phase-allowlists/wp-process-relationship-identity-v1.json',
  '.github/phase-allowlists/wp-process-research-components-v1.json',
  '.github/phase-allowlists/wp-process-research-entry-v1.json',
  '.github/phase-allowlists/wp-process-research-interactions-v1.json',
  '.github/phase-allowlists/wp-process-scope-enumerator-v1.json',
  '.github/phase-allowlists/wp-process-sec-completeness-oracle-runtime-v1.json',
  '.github/phase-allowlists/wp-process-semantic-enumerator-v1.json',
  '.github/phase-allowlists/wp-process-shared-authority-consumer-v1.json',
  '.github/phase-allowlists/wp-process-source-acquisition-runtime-v1.json',
  '.github/phase-allowlists/wp-process-status-consumer-v1.json',
  '.github/phase-allowlists/wp-process-temporal-expression-v1.json',
  '.github/phase-allowlists/wp-process-vertical-slice-contract-v1.json',
  '.github/phase-allowlists/wp-process-vertical-slice-gate-registration-v1.json',
  '.github/phase-allowlists/wp-process-vertical-slice-specification-root-v1.json',
  '.github/phase-allowlists/wp-product-ask-mapping-registry-v1.json',
  '.github/phase-allowlists/wp-product-query-action-compilers-v1.json',
  '.github/phase-allowlists/wp-product-query-action-contracts-v1.json',
  '.github/phase-allowlists/wp-product-query-contract-v1.json',
  '.github/phase-allowlists/wp-product-query-entry-compilers-v1.json',
  '.github/phase-allowlists/wp-product-query-ir-v1.json',
  '.github/phase-allowlists/wp-product-query-result-compiler-v1.json',
  '.github/phase-allowlists/wp-product-query-result-contract-v1.json',
  '.github/phase-allowlists/wp-product-query-result-set-agreement-v2.json',
  '.github/phase-allowlists/wp-product-query-result-set-compiler-v1.json',
  '.github/phase-allowlists/wp-product-result-action-compilers-v1.json',
  '.github/phase-allowlists/wp-product-result-action-contracts-v1.json',
  '.github/phase-allowlists/wp-product-result-presentation-compiler-v1.json',
  '.github/phase-allowlists/wp-product-result-presentation-contract-v1.json',
  '.github/phase-allowlists/wp-product-source-reader-contract-v1.json',
  '.github/phase-allowlists/wp-product-source-reader-runtime-v1.json',
  '.github/phase-allowlists/wp-programme-current-state-active-units-v1.json',
  '.github/phase-allowlists/wp-programme-current-state-freeze-blockers-v1.json',
  '.github/phase-allowlists/wp-programme-successor-publication-v2.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-agreement-navigation-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-agreement-predicate-one-way-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-agreement-predicate-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-f28-market-contract-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-f28-market-runtime-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-f28-product-result-runtime-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-f28-signed-duration-fix-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-f28-staging-proof-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-product-result-contract-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-product-result-runtime-v1.json',
  '.github/phase-allowlists/wp-qxo-capitalisation-successor-contracts-v1.json',
  '.github/phase-allowlists/wp-qxo-f27-protected-pilot-permission-v1.json',
  '.github/phase-allowlists/wp-shared-authority-deal-fact-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-shared-authority-entity-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-shared-authority-entity-kernels-v1.json',
  '.github/phase-allowlists/wp-shared-authority-professional-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-shared-authority-projection-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-shared-authority-structure-control-kernels-v1.json',
  '.github/phase-allowlists/wp-shared-authority-transaction-contract-inputs-v1.json',
  '.github/phase-allowlists/wp-shared-authority-transaction-kernels-v1.json',
  '.github/phase-allowlists/wp-shared-consideration-package-v1.json',
  '.github/pm-integration/current-state.json',
  '.github/pm-integration/window.schema.json',
  '.github/workflows/programme-gate-sign-g0.yml',
  '.github/workflows/programme-gate-sign-successor.yml',
  '.phase-id',
  '.phase-raw-id',
  '__fixtures__/canonical-v2/process-research-pilot.js',
  '__fixtures__/canonical-v2/qxo-capitalisation-bring-down-f27.json',
  'components/process/ProcessAsk.jsx',
  'components/process/ProcessBrowse.jsx',
  'components/process/ProcessCoverageState.jsx',
  'components/process/ProcessFilterEditor.jsx',
  'components/process/ProcessFilterSentence.jsx',
  'components/process/ProcessPassageCard.jsx',
  'components/process/ProcessPassageList.jsx',
  'components/process/ProcessRelatedPassages.jsx',
  'components/process/ProcessResearchSurface.jsx',
  'components/process/ProcessResultsTable.jsx',
  'components/process/ProcessSourceReader.jsx',
  'components/process/processResearchView.js',
  'components/query/QueryLaunchBox.jsx',
  'contracts/canonical-v2/successor/agreement/capitalisation-semantic-schema-inputs/capitalisation-representation.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/buyer-termination-fee-percent-of-deal-value.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/general-materiality-qualifier.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/ioc-capex-threshold-percent-of-deal-value.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/knowledge-qualifier.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/material-contract-cash-flow-threshold-percent-of-deal-value.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-copy-delivery-period-days.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-exception-prerequisite.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-initial-match-period-days.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-notice-period-days.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-prohibited-action.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/no-shop-subsequent-match-period-days.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/representation-accuracy-exception.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/representation-accuracy-standard.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/representation-measurement-date.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/retrospective-lookback.v1.json',
  'contracts/canonical-v2/successor/agreement/claim-definitions/seller-termination-fee-percent-of-deal-value.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/covenant-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/exception-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/fee-amount-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/match-period-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/material-contract-criterion.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/notice-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/representation-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/restricted-action.v1.json',
  'contracts/canonical-v2/successor/agreement/component-definitions/termination-trigger-limb.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/dated-representation-treatment.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/general-materiality-qualifier-state.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/knowledge-qualifier-state.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-exception-denominator.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-exception.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-standard.v3.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-materiality-scrape.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-measurement-date-signing-offset.v1.json',
  'contracts/canonical-v2/successor/agreement/market-metric-definitions/retrospective-lookback-state.v1.json',
  'contracts/canonical-v2/successor/agreement/migration-inputs/claim-state-codebook.v1.json',
  'contracts/canonical-v2/successor/agreement/migration-inputs/party-tuple-shape.v1.json',
  'contracts/canonical-v2/successor/agreement/migration-inputs/residual-reason-codebook.v1.json',
  'contracts/canonical-v2/successor/agreement/navigation/qxo-capitalisation-navigation-definition-catalogue.v1.json',
  'contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/no-shop-action-comparison-rollup.v1.json',
  'contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/no-shop-action-occurrence.v1.json',
  'contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/no-shop-exception-effect.v1.json',
  'contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/no-shop-inline-permission-effect.v1.json',
  'contracts/canonical-v2/successor/agreement/no-shop-semantic-schema-inputs/no-shop-notice-obligation.v6.json',
  'contracts/canonical-v2/successor/agreement/parser-proposal-boundary-definitions/parser-v2-structural-definition-proposal.v1.json',
  'contracts/canonical-v2/successor/agreement/policies/claim-interpretation-policy.v2.json',
  'contracts/canonical-v2/successor/agreement/policies/money-denominator-precision-policy.v1.json',
  'contracts/canonical-v2/successor/agreement/predicates/qxo-capitalisation-representation-predicate-catalogue.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/cond-b-rep.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/ioc-capex.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/ioc-general-except.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/nosol-except.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/nosol-match.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/nosol-notice.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/nosol-prohibit.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/nosol-rematch.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/rep-t-cap.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/rep-t-contracts.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termf-reverse.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termf-tail.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termf-target.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-breach.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-nosol-breach.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-novote.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-outside.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-recommend.v1.json',
  'contracts/canonical-v2/successor/agreement/provision-concepts/termr-superior.v1.json',
  'contracts/canonical-v2/successor/agreement/query/agreement-comparable-result-ordering.v1.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/brings-down.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/brings-down.v3.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/contained-in.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/excepted-by.v3.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/triggered-by.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/uses-definition.v3.json',
  'contracts/canonical-v2/successor/agreement/relationship-definitions/uses-definition.v4.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/brings-down-effect.v1.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/brings-down-effect.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/contained-in-effect.v1.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/excepted-by-effect.v1.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/termination-fee-trigger-effect.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/uses-definition-effect.v2.json',
  'contracts/canonical-v2/successor/agreement/relationship-effect-schemas/uses-definition-effect.v3.json',
  'contracts/canonical-v2/successor/agreement/result-definitions/target-capitalisation-bring-down.v3.json',
  'contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/accuracy-standard-claim-evidence.v1.json',
  'contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/result-component-claim-evidence.v1.json',
  'contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/result-composition-evidence.v1.json',
  'contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/reviewed-source-specific-open-world-evidence.v1.json',
  'contracts/canonical-v2/successor/agreement/serving-exact-detail-action-definitions/termination-fee-trigger-evidence.v2.json',
  'contracts/canonical-v2/successor/agreement/serving-metric-operation-binding-inputs/buyer-termination-fee-percent-of-deal-value.v2.json',
  'contracts/canonical-v2/successor/agreement/serving-metric-operation-binding-inputs/seller-termination-fee-percent-of-deal-value.v2.json',
  'contracts/canonical-v2/successor/agreement/serving-trigger-path-schema-inputs/termination-fee-trigger-path.v2.json',
  'contracts/canonical-v2/successor/governance/canonical-bundle-input-required-kind-registry.v1.json',
  'contracts/canonical-v2/successor/manifest.json',
  'contracts/canonical-v2/successor/process/actions/process-release-pinned-citation-and-share.v1.json',
  'contracts/canonical-v2/successor/process/actions/process-rerun-on-active-release.v1.json',
  'contracts/canonical-v2/successor/process/actions/process-saved-query-definition.v1.json',
  'contracts/canonical-v2/successor/process/actions/process-selected-result-export.v1.json',
  'contracts/canonical-v2/successor/process/agreements/process-agreement.v1.json',
  'contracts/canonical-v2/successor/process/bidder-tracks/bidder-track.v1.json',
  'contracts/canonical-v2/successor/process/domain/process-domain-registry.v1.json',
  'contracts/canonical-v2/successor/process/events/process-event.v1.json',
  'contracts/canonical-v2/successor/process/fields/process-field-definition-catalogue.v1.json',
  'contracts/canonical-v2/successor/process/gates/process-vertical-slice-pass.v1.json',
  'contracts/canonical-v2/successor/process/integrity/process-semantic-or-source-integrity-revocation-cause.v1.json',
  'contracts/canonical-v2/successor/process/integrity/process-serving-containment-policy.v1.json',
  'contracts/canonical-v2/successor/process/narration/process-narration-occurrence.v1.json',
  'contracts/canonical-v2/successor/process/navigation/process-navigation-definition-catalogue.v1.json',
  'contracts/canonical-v2/successor/process/navigation/process-navigation-definition-catalogue.v2.json',
  'contracts/canonical-v2/successor/process/occurrence-slots/process-event.v1.json',
  'contracts/canonical-v2/successor/process/occurrence-slots/process-narration.v1.json',
  'contracts/canonical-v2/successor/process/participants/process-participant.v1.json',
  'contracts/canonical-v2/successor/process/passages/process-passage.v1.json',
  'contracts/canonical-v2/successor/process/phases/process-phase.v1.json',
  'contracts/canonical-v2/successor/process/positions/process-position.v1.json',
  'contracts/canonical-v2/successor/process/predicates/exclusivity-completeness-challenge-catalogue.v1.json',
  'contracts/canonical-v2/successor/process/predicates/exclusivity-completeness-challenge-protocol.v1.json',
  'contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v1.json',
  'contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
  'contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v1.json',
  'contracts/canonical-v2/successor/process/predicates/process-predicate-witness.v2.json',
  'contracts/canonical-v2/successor/process/query/process-ask-query-compiler.v1.json',
  'contracts/canonical-v2/successor/process/query/process-browse-query-compiler.v1.json',
  'contracts/canonical-v2/successor/process/query/process-query-ir.v1.json',
  'contracts/canonical-v2/successor/process/registries/process-controlled-code-registry.v2.json',
  'contracts/canonical-v2/successor/process/relationships/process-relationship.v1.json',
  'contracts/canonical-v2/successor/process/relationships/process-relationship.v2.json',
  'contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
  'contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
  'contracts/canonical-v2/successor/process/serving/bounded-inline-passage-preview.v1.json',
  'contracts/canonical-v2/successor/process/serving/parent-bound-paragraph-context.v1.json',
  'contracts/canonical-v2/successor/process/serving/related-passage-child-collection.v1.json',
  'contracts/canonical-v2/successor/process/source-acquisition/external-source-acquisition-manifest.v1.json',
  'contracts/canonical-v2/successor/process/source-acquisition/source-universe-completeness.v1.json',
  'contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
  'contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
  'contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
  'contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
  'contracts/canonical-v2/successor/product/query/product-release-pinned-citation-and-share.v1.json',
  'contracts/canonical-v2/successor/product/query/product-rerun-on-active-release.v1.json',
  'contracts/canonical-v2/successor/product/query/product-result-presentation-definition.v1.json',
  'contracts/canonical-v2/successor/product/query/product-saved-query-definition.v1.json',
  'contracts/canonical-v2/successor/product/query/product-selected-result-export.v1.json',
  'contracts/canonical-v2/successor/product/query/product-source-reader-definition.v1.json',
  'contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
  'contracts/canonical-v2/successor/product/query/qxo-capitalisation-product-result-adapter.v1.json',
  'contracts/canonical-v2/successor/shared/deal-facts/deal-fact-resolution-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/deal-facts/source-deal-fact-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/entities/entity-identity-bridge.v1.json',
  'contracts/canonical-v2/successor/shared/entities/entity-name-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/entities/entity-subject.v1.json',
  'contracts/canonical-v2/successor/shared/field-definitions/shared-deal-field-catalogue.v1.json',
  'contracts/canonical-v2/successor/shared/professionals/lawyer-firm-affiliation-relationship.v1.json',
  'contracts/canonical-v2/successor/shared/professionals/professional-assignment-relationship.v1.json',
  'contracts/canonical-v2/successor/shared/projections/canonical-deal-fact-projection.v1.json',
  'contracts/canonical-v2/successor/shared/temporal/temporal-expression.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/consideration-package.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/deal-participant-relationship.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/share-purchase-interest-component.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/source-transaction-leg-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/transaction-control-outcome-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/transaction-leg-resolution-occurrence.v1.json',
  'contracts/canonical-v2/successor/shared/transactions/transaction-structure-resolution-occurrence.v1.json',
  'docs/CODEX-PROGRAM.md',
  'docs/certification/PM-PROCESS-CONCURRENCY-RULE.md',
  'docs/codex-program/EXECUTION-LEDGER.md',
  'docs/codex-program/adversarial-tests.md',
  'docs/codex-program/bootstrap-acceptance-source.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/specification-manifest.json',
  'docs/superpowers/plans/2026-07-27-qxo-capitalisation-bring-down-f27-plan.md',
  'docs/superpowers/specs/2026-07-27-qxo-capitalisation-bring-down-f27-design.md',
  'evidence/process-intelligence/baseline/product-field-source-inventory.json',
  'evidence/process-intelligence/baseline/storylines-evidence-inventory.json',
  'evidence/process-intelligence/freeze/exclusivity-challenge-blind-input-manifest.json',
  'evidence/process-intelligence/freeze/exclusivity-question-reconciliation.v1.json',
  'evidence/process-intelligence/freeze/exclusivity-reconciliation-independence.v1.json',
  'evidence/process-intelligence/metsera-gold/exclusivity-gold.v1.json',
  'evidence/process-intelligence/metsera-gold/source-universe.v1.json',
  'evidence/process-intelligence/pilot/metsera-admitted-source-universe.v1.json',
  'evidence/process-intelligence/pilot/metsera-source-enumeration-a.json',
  'evidence/process-intelligence/pilot/metsera-source-enumeration-b.json',
  'evidence/process-intelligence/pilot/metsera-source-reconciliation.v1.json',
  'evidence/process-intelligence/pilot/metsera-source-universe-candidate-b.json',
  'evidence/process-intelligence/pilot/metsera-source-universe-manifest.json',
  'lib/canonical-v2/agreement-comparable-result-order.js',
  'lib/canonical-v2/agreement-navigation-contract-input-validator.js',
  'lib/canonical-v2/agreement-query-ordering-contract-input-validator.js',
  'lib/canonical-v2/agreement-representation-predicate-contract-input-validator.js',
  'lib/canonical-v2/canonical-contract-bundle-compiler.js',
  'lib/canonical-v2/canonical-contract-bundle-current-root.js',
  'lib/canonical-v2/canonical-contract-bundle-freeze-candidate-assembler.js',
  'lib/canonical-v2/canonical-contract-bundle-pre-review-package-assembler.js',
  'lib/canonical-v2/canonical-contract-bundle-pre-review-source-closure.js',
  'lib/canonical-v2/canonical-contract-bundle-reviewed-registry-assembler.js',
  'lib/canonical-v2/canonical-contract-input-compiler.js',
  'lib/canonical-v2/canonical-contract-technical-relationship-validator.js',
  'lib/canonical-v2/contract-bundle.js',
  'lib/canonical-v2/deal-participant-relationship.js',
  'lib/canonical-v2/entity-identity-bridge.js',
  'lib/canonical-v2/entity-name-occurrence.js',
  'lib/canonical-v2/entity-subject.js',
  'lib/canonical-v2/feature-flags.js',
  'lib/canonical-v2/metsera-gold-evidence.js',
  'lib/canonical-v2/process-agreement-identity.js',
  'lib/canonical-v2/process-ask-compiler.js',
  'lib/canonical-v2/process-bidder-track-event-membership.js',
  'lib/canonical-v2/process-bidder-track-identity.js',
  'lib/canonical-v2/process-browse-compiler.js',
  'lib/canonical-v2/process-candidate-graph.js',
  'lib/canonical-v2/process-candidate-validator.js',
  'lib/canonical-v2/process-contract-input-validator.js',
  'lib/canonical-v2/process-deal-fact-projection.js',
  'lib/canonical-v2/process-event.js',
  'lib/canonical-v2/process-exclusivity-contract.js',
  'lib/canonical-v2/process-exclusivity-pilot.js',
  'lib/canonical-v2/process-exclusivity-result.js',
  'lib/canonical-v2/process-field-navigation-contract-input-validator.js',
  'lib/canonical-v2/process-filter-compiler.js',
  'lib/canonical-v2/process-gate-contract-input-validator.js',
  'lib/canonical-v2/process-integrity-contract-input-validator.js',
  'lib/canonical-v2/process-lexical-enumerator.js',
  'lib/canonical-v2/process-narration-occurrence.js',
  'lib/canonical-v2/process-paragraph-context.js',
  'lib/canonical-v2/process-participant-identity.js',
  'lib/canonical-v2/process-passage-identity.js',
  'lib/canonical-v2/process-passage-order.js',
  'lib/canonical-v2/process-phase-identity.js',
  'lib/canonical-v2/process-phrasebook-product-result-set-bridge.js',
  'lib/canonical-v2/process-phrasebook-result-admission.js',
  'lib/canonical-v2/process-phrasebook-result.js',
  'lib/canonical-v2/process-phrasebook-shared-row-bridge.js',
  'lib/canonical-v2/process-position-identity.js',
  'lib/canonical-v2/process-predicate-contract-input-validator.js',
  'lib/canonical-v2/process-query-contract-input-validator.js',
  'lib/canonical-v2/process-query-ir.js',
  'lib/canonical-v2/process-related-passages.js',
  'lib/canonical-v2/process-relationship.js',
  'lib/canonical-v2/process-result-action-contract-input-validator.js',
  'lib/canonical-v2/process-scope-enumerator.js',
  'lib/canonical-v2/process-sec-completeness-oracle.js',
  'lib/canonical-v2/process-semantic-enumerator.js',
  'lib/canonical-v2/process-serving-contract-input-validator.js',
  'lib/canonical-v2/process-source-acquisition-contract-input-validator.js',
  'lib/canonical-v2/process-source-acquisition.js',
  'lib/canonical-v2/process-temporal-expression.js',
  'lib/canonical-v2/product-ask-compiler.js',
  'lib/canonical-v2/product-ask-mapping-registry.js',
  'lib/canonical-v2/product-browse-compiler.js',
  'lib/canonical-v2/product-citation-share-compiler.js',
  'lib/canonical-v2/product-field-catalogue.js',
  'lib/canonical-v2/product-field-source-registry.js',
  'lib/canonical-v2/product-navigation-catalogue.js',
  'lib/canonical-v2/product-query-action-contract-input-validator.js',
  'lib/canonical-v2/product-query-contract-input-validator.js',
  'lib/canonical-v2/product-query-ir.js',
  'lib/canonical-v2/product-query-result-compiler.js',
  'lib/canonical-v2/product-query-result-contract-input-validator.js',
  'lib/canonical-v2/product-query-result-set-compiler.js',
  'lib/canonical-v2/product-rerun-compiler.js',
  'lib/canonical-v2/product-result-action-contract-input-validator.js',
  'lib/canonical-v2/product-result-presentation-compiler.js',
  'lib/canonical-v2/product-result-presentation-contract-input-validator.js',
  'lib/canonical-v2/product-saved-query-compiler.js',
  'lib/canonical-v2/product-selected-result-export-compiler.js',
  'lib/canonical-v2/product-source-reader-compiler.js',
  'lib/canonical-v2/product-source-reader-contract-input-validator.js',
  'lib/canonical-v2/qxo-capitalisation-contract-input-validator.js',
  'lib/canonical-v2/qxo-capitalisation-cross-view-release-f27.js',
  'lib/canonical-v2/qxo-capitalisation-cross-view-release-f28.js',
  'lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter.js',
  'lib/canonical-v2/qxo-capitalisation-parser-source-closure-f27.js',
  'lib/canonical-v2/qxo-capitalisation-product-result-adapter.js',
  'lib/canonical-v2/reviewed-qxo-capitalisation-f27.js',
  'lib/canonical-v2/reviewed-qxo-capitalisation-f28.js',
  'lib/canonical-v2/share-purchase-interest-component.js',
  'lib/canonical-v2/shared-authority-consumed-contract-manifest.js',
  'lib/canonical-v2/shared-authority-contract-input-validator.js',
  'lib/canonical-v2/transaction-control-outcome.js',
  'lib/canonical-v2/transaction-leg.js',
  'lib/canonical-v2/transaction-structure-resolution.js',
  'lib/programme-gates/contract-freeze-contracts.js',
  'lib/programme-gates/contract-freeze-review-registration.js',
  'lib/programme-gates/contract-freeze-review-tasks.js',
  'lib/programme-gates/current-publication.js',
  'lib/programme-gates/g0-status-readiness.js',
  'lib/programme-gates/git-authorship.js',
  'lib/programme-gates/integration-window.js',
  'lib/programme-gates/pilot-integration-preflight.js',
  'lib/programme-gates/predicates.js',
  'lib/programme-gates/registry.js',
  'lib/programme-gates/review-artifact.js',
  'lib/programme-gates/review-contracts.js',
  'lib/programme-gates/review-controller.js',
  'lib/programme-gates/review-enumerator.js',
  'lib/programme-gates/review-evidence.js',
  'lib/programme-gates/review-readiness.js',
  'lib/programme-gates/review-signing.js',
  'lib/programme-gates/schema-registry.js',
  'lib/programme-gates/test-executable-registry.js',
  'lib/programme-gates/vertical-slice-permission.js',
  'lib/schema/canonical/contract-v2/manifest.json',
  'lib/schema/canonical/contract-v2/relationship-definitions/brings-down.v2.json',
  'lib/schema/canonical/contract-v2/relationship-definitions/uses-definition.v3.json',
  'lib/schema/canonical/contract-v2/relationship-effect-schemas/brings-down-effect.v1.json',
  'lib/schema/canonical/contract-v2/relationship-effect-schemas/uses-definition-effect.v2.json',
  'pages/index.js',
  'pages/query/process/pilot.js',
  'scripts/canonical-v2-staging-qxo-capitalisation-f27.mjs',
  'scripts/canonical-v2-staging-qxo-capitalisation-f28.mjs',
  'scripts/generate-bootstrap-acceptance-source.mjs',
  'scripts/generate-canonical-contract-current-review.mjs',
  'scripts/generate-canonical-v2-required-kind-registry.mjs',
  'scripts/generate-canonical-v2-successor-manifest.mjs',
  'scripts/generate-programme-current-state.mjs',
  'scripts/generate-qxo-capitalisation-f27-fixture.mjs',
  'scripts/pilot-integration-preflight.mjs',
  'scripts/process-intelligence-baseline.mjs',
  'scripts/process-intelligence-storylines-baseline.mjs',
  'scripts/run-p1-contract-freeze-reviews.mjs',
  'scripts/sign-g0-evidence.mjs',
  'scripts/verify-codex-program-spec.mjs',
  'scripts/verify-programme-status-publication.mjs',
  'tests/canonical-v2-agreement-comparable-result-order.test.js',
  'tests/canonical-v2-agreement-navigation-contract-input.test.js',
  'tests/canonical-v2-agreement-query-ordering-contract-input.test.js',
  'tests/canonical-v2-agreement-representation-predicate-contract-input.test.js',
  'tests/canonical-v2-canonical-contract-bundle-compiler.test.js',
  'tests/canonical-v2-canonical-contract-bundle-current-root.test.js',
  'tests/canonical-v2-canonical-contract-bundle-freeze-candidate-assembler.test.js',
  'tests/canonical-v2-canonical-contract-bundle-pre-review-package-assembler.test.js',
  'tests/canonical-v2-canonical-contract-bundle-pre-review-source-closure.test.js',
  'tests/canonical-v2-canonical-contract-bundle-reviewed-registry-assembler.test.js',
  'tests/canonical-v2-canonical-contract-current-review-generator.test.js',
  'tests/canonical-v2-canonical-contract-excepted-by-effect.test.js',
  'tests/canonical-v2-canonical-contract-input-compiler.test.js',
  'tests/canonical-v2-canonical-contract-relationship-input-validator.test.js',
  'tests/canonical-v2-canonical-contract-source-tree.test.js',
  'tests/canonical-v2-canonical-contract-technical-relationship-effects.test.js',
  'tests/canonical-v2-contract-bundle-versions.test.js',
  'tests/canonical-v2-deal-participant-relationship.test.js',
  'tests/canonical-v2-entity-identity-bridge.test.js',
  'tests/canonical-v2-entity-name-occurrence.test.js',
  'tests/canonical-v2-entity-subject.test.js',
  'tests/canonical-v2-metsera-gold-evidence.test.js',
  'tests/canonical-v2-process-agreement-identity.test.js',
  'tests/canonical-v2-process-bidder-track-event-membership-contract-input.test.js',
  'tests/canonical-v2-process-bidder-track-event-membership.test.js',
  'tests/canonical-v2-process-bidder-track-identity.test.js',
  'tests/canonical-v2-process-candidate-graph.test.js',
  'tests/canonical-v2-process-candidate-validator.test.js',
  'tests/canonical-v2-process-contract-input.test.js',
  'tests/canonical-v2-process-controlled-code-registry-contract-input.test.js',
  'tests/canonical-v2-process-event-participant-contract-input.test.js',
  'tests/canonical-v2-process-event-slot-binding-contract-input.test.js',
  'tests/canonical-v2-process-event.test.js',
  'tests/canonical-v2-process-exclusivity-challenge-catalogue-contract-input.test.js',
  'tests/canonical-v2-process-exclusivity-completeness-challenge.test.js',
  'tests/canonical-v2-process-exclusivity-contract-input.test.js',
  'tests/canonical-v2-process-exclusivity-contract.test.js',
  'tests/canonical-v2-process-exclusivity-pilot.test.js',
  'tests/canonical-v2-process-exclusivity-predicate-catalogue-v2-contract-input.test.js',
  'tests/canonical-v2-process-exclusivity-result.test.js',
  'tests/canonical-v2-process-field-navigation-contract-input.test.js',
  'tests/canonical-v2-process-filter-compiler.test.js',
  'tests/canonical-v2-process-integrity-contract-input.test.js',
  'tests/canonical-v2-process-lexical-enumerator.test.js',
  'tests/canonical-v2-process-narration-occurrence.test.js',
  'tests/canonical-v2-process-object-contract-input.test.js',
  'tests/canonical-v2-process-paragraph-context.test.js',
  'tests/canonical-v2-process-participant-identity.test.js',
  'tests/canonical-v2-process-passage-identity.test.js',
  'tests/canonical-v2-process-passage-order.test.js',
  'tests/canonical-v2-process-passage-serving-contract-input.test.js',
  'tests/canonical-v2-process-phase-identity.test.js',
  'tests/canonical-v2-process-phrasebook-product-result-set-bridge.test.js',
  'tests/canonical-v2-process-phrasebook-result-admission.test.js',
  'tests/canonical-v2-process-phrasebook-result.test.js',
  'tests/canonical-v2-process-phrasebook-shared-row-bridge.test.js',
  'tests/canonical-v2-process-position-identity.test.js',
  'tests/canonical-v2-process-predicate-witness-v2-contract-input.test.js',
  'tests/canonical-v2-process-query-contract-input.test.js',
  'tests/canonical-v2-process-query-runtime.test.js',
  'tests/canonical-v2-process-related-passages.test.js',
  'tests/canonical-v2-process-relationship.test.js',
  'tests/canonical-v2-process-research-components.test.js',
  'tests/canonical-v2-process-research-entry.test.js',
  'tests/canonical-v2-process-result-action-contract-input.test.js',
  'tests/canonical-v2-process-scope-enumerator.test.js',
  'tests/canonical-v2-process-sec-completeness-oracle.test.js',
  'tests/canonical-v2-process-semantic-enumerator.test.js',
  'tests/canonical-v2-process-shared-authority-integration.test.js',
  'tests/canonical-v2-process-source-acquisition-contract-input.test.js',
  'tests/canonical-v2-process-source-acquisition.test.js',
  'tests/canonical-v2-process-temporal-expression.test.js',
  'tests/canonical-v2-process-track-phase-contract-input.test.js',
  'tests/canonical-v2-process-vertical-slice-contract-input.test.js',
  'tests/canonical-v2-product-ask-mapping-registry.test.js',
  'tests/canonical-v2-product-field-catalogue.test.js',
  'tests/canonical-v2-product-field-source-registry.test.js',
  'tests/canonical-v2-product-navigation-catalogue.test.js',
  'tests/canonical-v2-product-query-action-compilers.test.js',
  'tests/canonical-v2-product-query-action-contract-input.test.js',
  'tests/canonical-v2-product-query-contract-input.test.js',
  'tests/canonical-v2-product-query-entry-compilers.test.js',
  'tests/canonical-v2-product-query-ir.test.js',
  'tests/canonical-v2-product-query-result-compiler.test.js',
  'tests/canonical-v2-product-query-result-contract-input.test.js',
  'tests/canonical-v2-product-query-result-set-compiler.test.js',
  'tests/canonical-v2-product-result-action-compilers.test.js',
  'tests/canonical-v2-product-result-action-contract-input.test.js',
  'tests/canonical-v2-product-result-presentation-compiler.test.js',
  'tests/canonical-v2-product-result-presentation-contract-input.test.js',
  'tests/canonical-v2-product-source-reader-compiler.test.js',
  'tests/canonical-v2-product-source-reader-contract-input.test.js',
  'tests/canonical-v2-qxo-capitalisation-contract-input.test.js',
  'tests/canonical-v2-qxo-capitalisation-cross-view-release-f27.test.js',
  'tests/canonical-v2-qxo-capitalisation-cross-view-release-f28.test.js',
  'tests/canonical-v2-qxo-capitalisation-f28-product-result-adapter.test.js',
  'tests/canonical-v2-qxo-capitalisation-parser-source-closure-f27.test.js',
  'tests/canonical-v2-qxo-capitalisation-product-result-adapter.test.js',
  'tests/canonical-v2-qxo-capitalisation-product-result-contract.test.js',
  'tests/canonical-v2-required-kind-registry-generator.test.js',
  'tests/canonical-v2-reviewed-qxo-capitalisation-f27.test.js',
  'tests/canonical-v2-reviewed-qxo-capitalisation-f28.test.js',
  'tests/canonical-v2-share-purchase-interest-component.test.js',
  'tests/canonical-v2-shared-authority-consumed-contract.test.js',
  'tests/canonical-v2-shared-authority-contract-input.test.js',
  'tests/canonical-v2-shared-authority-deal-fact-contract-input.test.js',
  'tests/canonical-v2-shared-authority-professional-contract-input.test.js',
  'tests/canonical-v2-shared-authority-projection-contract-input.test.js',
  'tests/canonical-v2-shared-authority-transaction-contract-input.test.js',
  'tests/canonical-v2-shared-consideration-package-contract-input.test.js',
  'tests/canonical-v2-staging-qxo-capitalisation-f27.test.js',
  'tests/canonical-v2-staging-qxo-capitalisation-f28.test.js',
  'tests/canonical-v2-successor-manifest.test.js',
  'tests/canonical-v2-transaction-control-outcome.test.js',
  'tests/canonical-v2-transaction-leg.test.js',
  'tests/canonical-v2-transaction-structure-resolution.test.js',
  'tests/contract-freeze-review-tasks.test.js',
  'tests/fixtures/canonical-v2/qxo-capitalisation-f27-inputs.js',
  'tests/fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs.js',
  'tests/p1-contract-freeze-review-registration.test.js',
  'tests/process-intelligence-baseline.test.js',
  'tests/process-intelligence-storylines-baseline.test.js',
  'tests/programme-gates-schema-registry.test.js',
  'tests/programme-gates/bootstrap-acceptance-source.spec.js',
  'tests/programme-gates/containment-evidence.spec.js',
  'tests/programme-gates/contract-freeze-predicates.spec.js',
  'tests/programme-gates/current-publication.spec.js',
  'tests/programme-gates/g0-signer-workflow.spec.js',
  'tests/programme-gates/g0-status-readiness.spec.js',
  'tests/programme-gates/git-authorship.spec.js',
  'tests/programme-gates/integration-window.spec.js',
  'tests/programme-gates/pilot-integration-preflight.spec.js',
  'tests/programme-gates/predicates.spec.js',
  'tests/programme-gates/process-vertical-slice-registration.spec.js',
  'tests/programme-gates/programme-status-consumer.spec.js',
  'tests/programme-gates/programme-status-successor.spec.js',
  'tests/programme-gates/publication-executor.spec.js',
  'tests/programme-gates/review-artifact.spec.js',
  'tests/programme-gates/review-contracts.spec.js',
  'tests/programme-gates/review-controller.spec.js',
  'tests/programme-gates/review-evidence.spec.js',
  'tests/programme-gates/review-readiness-signing.spec.js',
  'tests/programme-gates/validator.spec.js',
  'tests/query-containment.test.js',
]);

function requireCommit(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a Git commit ID`);
  }
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
  }
  return value;
}

function requireDeploymentId(value) {
  if (typeof value !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(value)) {
    throw new TypeError('expected deployment ID is invalid');
  }
  return value;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function childEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  delete environment.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  delete environment.VERCEL_TOKEN;
  return environment;
}

function previewAccessMatrix() {
  const value = process.env.PROGRAMME_GATE_PREVIEW_ACCESS_MATRIX_JSON;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('protected preview access matrix evidence is unavailable');
  }
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('protected preview access matrix evidence is not an array');
  }
  return parsed;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    env: options.env || childEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function successful(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${command} execution failed`);
  }
  return result.stdout.trim();
}

function specificationRoot() {
  const output = successful(process.execPath, [
    'scripts/verify-codex-program-spec.mjs',
  ]);
  const match = output.match(
    /CODEX programme specification PASS ([a-f0-9]{64})/,
  );
  if (!match) {
    throw new Error('the governing programme specification did not verify');
  }
  return match[1];
}

function testResult(
  testId,
  testFiles,
  codeCommit,
  environment,
  attestTestExecution,
) {
  const args = ['--test', ...testFiles];
  const startedAt = new Date().toISOString();
  const result = run(process.execPath, args, {
    env: childEnvironment({
      NODE_ENV: 'test',
    }),
  });
  const completedAt = new Date().toISOString();
  const executableMembers = testFiles.map((file) => {
    const bytes = fs.readFileSync(path.resolve(ROOT, file));
    return {
      path: file,
      byte_length: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const executableDigest = domainDigest(
    TEST_EXECUTABLE_SET_DOMAIN,
    executableMembers,
  );
  if (executableDigest !== expectedTestExecutableDigest(testId)) {
    throw new Error(`${testId} executable set does not match the frozen registry`);
  }
  const unsignedRecord = Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: testId,
    code_commit: codeCommit,
    environment,
    command_digest: domainDigest(
      'PROGRAMME_GATE_TEST_COMMAND/V1',
      { executable: process.execPath, args },
    ),
    executable_digest: executableDigest,
    started_at: startedAt,
    completed_at: completedAt,
    exit_code: result.status,
    output_digest: domainDigest(
      'PROGRAMME_GATE_TEST_OUTPUT/V1',
      { stdout: result.stdout, stderr: result.stderr },
    ),
  });
  const record = attestTestExecution(unsignedRecord);
  if (record.exit_code !== 0) throw new Error(`${testId} did not pass`);
  return record;
}

function vercelToken() {
  const token = process.env.VERCEL_TOKEN;
  if (typeof token !== 'string' || token.length < 20) {
    throw new Error('protected Vercel metadata token is unavailable');
  }
  return token;
}

async function vercelDeployment(identifier, token) {
  const url = new URL(
    `/v13/deployments/${encodeURIComponent(identifier)}`,
    VERCEL_API_ORIGIN,
  );
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('protected Vercel deployment lookup failed');
  }
  return response.json();
}

async function vercelApi(pathname, token, search = {}) {
  const url = new URL(pathname, VERCEL_API_ORIGIN);
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  for (const [key, value] of Object.entries(search)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('protected Vercel API lookup failed');
  return response.json();
}

async function vercelEnvironmentRecords(token, target, gitBranch = null) {
  const payload = await vercelApi(
    `/v10/projects/${VERCEL_PROJECT_ID}/env`,
    token,
    { target, decrypt: 'true', gitBranch },
  );
  if (!Array.isArray(payload.envs)) {
    throw new Error('protected Vercel environment lookup returned no records');
  }
  return payload.envs;
}

async function vercelProductionEnvironment(token) {
  const payload = await vercelApi(
    `/v3/env/pull/${VERCEL_PROJECT_ID}/production`,
    token,
  );
  const environment = payload && payload.env;
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('protected Vercel production environment lookup failed');
  }
  return environment;
}

function stagingSupabaseSecretKey() {
  const value = process.env.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  if (typeof value !== 'string' || !/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('protected staging Supabase secret key is unavailable');
  }
  return value;
}

async function fetchObservation(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
  };
}

function automationBypassSecret(project) {
  const matches = Object.entries(project.protectionBypass || {})
    .filter(([, value]) => value && value.scope === 'automation-bypass');
  if (matches.length !== 1) {
    throw new Error('one protected automation bypass credential is required');
  }
  return matches[0][0];
}

async function collectLiveIsolationSource({ codeCommit, previewDeploymentId }) {
  const token = vercelToken();
  const productionDeploymentBefore = await vercelDeployment(PRODUCTION_ALIAS, token);
  const [
    previewDeployment,
    productionEnvironment,
    previewEnvironmentRecords,
    project,
  ] = await Promise.all([
    vercelDeployment(previewDeploymentId, token),
    vercelProductionEnvironment(token),
    vercelEnvironmentRecords(token, 'preview', PREVIEW_BRANCH),
    vercelApi(`/v9/projects/${VERCEL_PROJECT_ID}`, token),
  ]);
  const stagingServiceKey = stagingSupabaseSecretKey();
  const productionUrl = productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  const previewUrl = `https://${previewDeployment.url}/api/canonical-v2/review-context?dealId=7dc3a05f-b170-4d59-a255-b7103cca16e1`;
  const [
    productionDmlResponse,
    unauthenticatedResponse,
    authorisedResponse,
  ] = await Promise.all([
    fetchObservation(`${productionUrl}/rest/v1/deals?id=is.null`, {
      method: 'DELETE',
      headers: {
        apikey: stagingServiceKey,
        authorization: `Bearer ${stagingServiceKey}`,
        prefer: 'return=minimal',
      },
    }),
    fetchObservation(previewUrl),
    fetchObservation(previewUrl, {
      headers: {
        'x-vercel-protection-bypass': automationBypassSecret(project),
      },
    }),
  ]);
  const productionDeploymentAfter = await vercelDeployment(PRODUCTION_ALIAS, token);
  const previewActions = previewAccessMatrix();
  return buildIsolationObservationSource({
    observedAt: new Date().toISOString(),
    codeCommit,
    projectId: VERCEL_PROJECT_ID,
    previewDeploymentId,
    productionEnvironment,
    previewEnvironmentRecords,
    stagingServiceKey,
    productionDmlResponse,
    previewDeployment,
    productionDeploymentBefore,
    productionDeploymentAfter,
    unauthenticatedResponse,
    authorisedResponse,
    previewRuntimeResponse: authorisedResponse,
    sourcePreviewRouteActions: previewActions,
    builtPreviewRouteActions: previewActions,
    previewRouteActions: previewActions,
  });
}

async function deploymentBinding({
  codeCommit,
  deploymentId,
  environment,
  specificationDigest,
}) {
  const token = vercelToken();
  const [originDeployment, deployment] = await Promise.all([
    vercelDeployment(PRODUCTION_ALIAS, token),
    vercelDeployment(deploymentId, token),
  ]);
  if (originDeployment.projectId !== VERCEL_PROJECT_ID
    || deployment.projectId !== VERCEL_PROJECT_ID) {
    throw new Error('the deployment does not belong to the frozen Vercel project');
  }
  validateDeploymentBinding({
    deployment,
    originDeployment,
    deploymentId,
    environment,
    codeCommit,
    specificationRoot: specificationDigest,
  });
  return deployment;
}

function buildProductionOutput() {
  successful('npm', ['run', 'build'], {
    env: childEnvironment({
      NODE_ENV: 'production',
    }),
  });
}

function containmentRuntime() {
  return Object.freeze({
    ...CONTAINMENT_RUNTIME,
    runCommand(command, args, options = {}) {
      return CONTAINMENT_RUNTIME.runCommand(command, args, {
        ...options,
        env: childEnvironment(options.env),
      });
    },
  });
}

function governingGates() {
  return createGoverningRegistryAuthority({
    readFileSync(file) {
      return fs.readFileSync(file);
    },
    parseYaml(source) {
      return YAML.parse(source);
    },
    domainDigest,
  }).gates;
}

function protectedPrivateKey(environmentName, keyId) {
  const pem = process.env[environmentName];
  if (typeof pem !== 'string' || pem.length === 0) {
    throw new Error(`protected ${keyId} signing key is unavailable`);
  }
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`protected ${keyId} signing key is not Ed25519`);
  }
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find(
    (entry) => entry.key_id === keyId,
  );
  if (!trusted) throw new Error(`trusted ${keyId} public key is unavailable`);
  const derivedPublic = crypto.createPublicKey(privateKey).export({
    type: 'spki',
    format: 'pem',
  });
  const trustedPublic = crypto.createPublicKey(trusted.public_key_pem).export({
    type: 'spki',
    format: 'pem',
  });
  if (!crypto.timingSafeEqual(
    crypto.createHash('sha256').update(derivedPublic).digest(),
    crypto.createHash('sha256').update(trustedPublic).digest(),
  )) {
    throw new Error(`protected ${keyId} key does not match the trusted public key`);
  }
  return privateKey;
}

function privateValidatorKey() {
  return protectedPrivateKey(
    'PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM',
    VALIDATOR_KEY_ID,
  );
}

function privateBenApproverKey() {
  return protectedPrivateKey(
    'PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM',
    BEN_APPROVER_KEY_ID,
  );
}

function privateStatusPublisherKey() {
  return protectedPrivateKey(
    'PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM',
    STATUS_PUBLISHER_KEY_ID,
  );
}

function signatureFor(request, privateKey) {
  return crypto.sign(
    null,
    Buffer.from(request.signing_frame_base64, 'base64'),
    privateKey,
  ).toString('base64');
}

function signatureForBytes(bytes, privateKey) {
  return crypto.sign(null, bytes, privateKey).toString('base64');
}

function publicationMode() {
  const mode = process.env.PROGRAMME_STATUS_PUBLICATION_MODE || 'GENESIS';
  if (!['GENESIS', 'SUCCESSOR'].includes(mode)) {
    throw new Error('programme status publication mode is invalid');
  }
  return mode;
}

function reviewBasis(mode) {
  if (mode === 'GENESIS') {
    return Object.freeze({
      codeCommit: REVIEW_BASIS_COMMIT,
      specificationRoot: REVIEW_BASIS_ROOT,
      artifactSha256: REVIEW_ARTIFACT_SHA256,
      artifactByteSize: REVIEW_ARTIFACT_BYTE_SIZE,
    });
  }
  return Object.freeze({
    codeCommit: requireCommit(
      process.env.PROGRAMME_GATE_REVIEW_BASIS_COMMIT,
      'review basis commit',
    ),
    specificationRoot: requireDigest(
      process.env.PROGRAMME_GATE_REVIEW_BASIS_ROOT,
      'review basis specification root',
    ),
    artifactSha256: null,
    artifactByteSize: null,
  });
}

function reviewArtifact(basis) {
  const reviewPath = process.env.PROGRAMME_GATE_COLD_REVIEW_BUNDLE;
  if (typeof reviewPath !== 'string' || !path.isAbsolute(reviewPath)) {
    throw new Error('cold-review bundle path is unavailable');
  }
  const bytes = fs.readFileSync(reviewPath);
  const reviewArtifactSha256 = sha256(bytes);
  if (basis.artifactByteSize !== null
    && (bytes.length !== basis.artifactByteSize
      || reviewArtifactSha256 !== basis.artifactSha256)) {
    throw new Error('cold-review bundle bytes do not match the frozen reviewed artefact');
  }
  const bundle = JSON.parse(bytes.toString('utf8'));
  if (bundle.code_commit !== basis.codeCommit
    || bundle.specification_root !== basis.specificationRoot) {
    throw new Error('cold-review bundle does not match the frozen basis root');
  }
  return {
    bundle,
    reviewArtifactByteSize: bytes.length,
    reviewArtifactSha256,
  };
}

function governanceDiff(codeCommit, basis) {
  const ancestry = run('git', [
    'merge-base',
    '--is-ancestor',
    basis.codeCommit,
    codeCommit,
  ]);
  if (ancestry.status !== 0) {
    throw new Error('owner-authority commit is not a descendant of the reviewed basis');
  }
  const changedPaths = successful('git', [
    'diff',
    '--name-only',
    basis.codeCommit,
    codeCommit,
    '--',
  ]).split('\n').filter(Boolean).sort();
  const allowedPaths = [...OWNER_AUTHORITY_ALLOWED_PATHS].sort();
  const allowed = new Set(allowedPaths);
  const unexpectedPaths = changedPaths.filter((changedPath) => !allowed.has(changedPath));
  if (changedPaths.length === 0 || unexpectedPaths.length > 0) {
    throw new Error('owner-authority governance diff is empty or exceeds its closed path set');
  }
  const patchResult = run('git', [
    'diff',
    '--binary',
    '--no-ext-diff',
    basis.codeCommit,
    codeCommit,
    '--',
    ...changedPaths,
  ]);
  if (patchResult.status !== 0) {
    throw new Error('owner-authority governance patch could not be read');
  }
  return Object.freeze({
    basis_code_commit: basis.codeCommit,
    authorised_code_commit: codeCommit,
    changed_paths: changedPaths,
    allowed_path_set_digest: domainDigest(
      'PROGRAMME_GATE_OWNER_AUTHORITY_ALLOWED_PATH_SET/V1',
      allowedPaths,
    ),
    patch_digest: domainDigest(
      'PROGRAMME_GATE_OWNER_AUTHORITY_PATCH/V1',
      {
        basis_code_commit: basis.codeCommit,
        authorised_code_commit: codeCommit,
        patch_sha256: sha256(Buffer.from(patchResult.stdout, 'utf8')),
      },
    ),
    unexpected_paths: unexpectedPaths,
  });
}

function evidenceResult(candidate, preflight) {
  if (preflight.evidence_validation.valid !== true
    || preflight.evidence_validation.state !== 'PASS'
    || !preflight.signed_envelope) {
    throw new Error(`${candidate.gate_id} signed evidence failed preflight`);
  }
  return {
    gate_id: candidate.gate_id,
    evidence_validation: preflight.evidence_validation,
    signed_envelope: preflight.signed_envelope,
    validation_input: {
      evidenceSubject: candidate.evidence_subject,
      evidenceObject: candidate.evidence_object,
      members: candidate.members,
      memberSchemaSet: candidate.member_schema_set,
      testResults: candidate.test_results,
    },
  };
}

async function main() {
  const mode = publicationMode();
  const basis = reviewBasis(mode);
  const codeCommit = requireCommit(process.env.GITHUB_SHA, 'GITHUB_SHA');
  const expectedCommit = requireCommit(
    process.env.EXPECTED_PROGRAMME_COMMIT,
    'expected programme commit',
  );
  if (codeCommit !== expectedCommit
    || successful('git', ['rev-parse', 'HEAD']) !== expectedCommit
    || successful('git', ['status', '--porcelain']) !== '') {
    throw new Error('signer does not have the exact clean requested main commit');
  }
  const remoteMain = successful('git', [
    'ls-remote',
    '--refs',
    'origin',
    'refs/heads/main',
  ]).split(/\s+/)[0];
  if (remoteMain !== expectedCommit) {
    throw new Error('requested commit is not the exact current origin main');
  }
  const currentRef = mode === 'SUCCESSOR'
    ? loadCurrentProgrammePublication({
      authority: createCurrentPublicationAuthority({
        canonicalBytes,
        domainDigest,
        keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
        validateSchema,
        verifySignature,
      }),
      repositoryRoot: ROOT,
      remote: 'origin',
    })
    : {
      ref: 'refs/heads/programme-status-publication-head',
      state: 'ABSENT',
      observed_git_object_id: 'NONE',
      status_artefact_id: 'NONE',
      generation: 0,
    };
  if (mode === 'SUCCESSOR'
    && currentRef.observed_git_object_id !== requireCommit(
      process.env.EXPECTED_PROGRAMME_PREDECESSOR_COMMIT,
      'expected programme predecessor commit',
    )) {
    throw new Error('protected publication predecessor does not match the request');
  }
  const deploymentId = requireDeploymentId(
    process.env.EXPECTED_VERCEL_DEPLOYMENT_ID,
  );
  const previewDeploymentId = requireDeploymentId(
    process.env.EXPECTED_VERCEL_PREVIEW_DEPLOYMENT_ID,
  );
  const environment = 'PRODUCTION';
  const specificationDigest = specificationRoot();
  const privateKey = privateValidatorKey();
  const attestTestExecution = (record) => attestTestExecutionRecord({
    record,
    attesterKeyId: VALIDATOR_KEY_ID,
    sign: (bytes) => signatureForBytes(bytes, privateKey),
  });
  await deploymentBinding({
    codeCommit,
    deploymentId,
    environment,
    specificationDigest,
  });
  buildProductionOutput();

  const containmentBundle = await collectContainmentEvidence({
    runtime: containmentRuntime(),
    root: ROOT,
    origin: PRODUCTION_ORIGIN,
    environment,
    codeCommit,
    deploymentId,
    specificationRoot: specificationDigest,
    gates: governingGates(),
    attestTestExecution,
  });
  const gateTest = testResult(
    'GATE-01',
    GATE_TEST_FILES,
    codeCommit,
    environment,
    attestTestExecution,
  );
  const deployCutoverTest = testResult(
    'DEPLOY-CUTOVER-01',
    DEPLOY_CUTOVER_TEST_FILES,
    codeCommit,
    environment,
    attestTestExecution,
  );
  const reviewContextTest = testResult(
    'REVIEW-CONTEXT-01',
    REVIEW_CONTEXT_TEST_FILES,
    codeCommit,
    environment,
    attestTestExecution,
  );
  const previewAuthTest = testResult(
    'PREVIEW-AUTH-01',
    PREVIEW_AUTH_TEST_FILES,
    codeCommit,
    environment,
    attestTestExecution,
  );
  const securityObservedAt = new Date().toISOString();
  const verificationTime = securityObservedAt;
  const securitySource = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const securityBundle = buildSecurityDispositionReadiness({
    authority: createSecurityDispositionReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: securityObservedAt,
      verificationTime,
    }),
    source: securitySource,
    testResult: gateTest,
  });
  const isolationSource = await collectLiveIsolationSource({
    codeCommit,
    previewDeploymentId,
  });
  const isolationVerificationTime = new Date().toISOString();
  const isolationBundle = buildIsolationReadiness({
    authority: createIsolationReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: isolationSource.observed_at,
      verificationTime: isolationVerificationTime,
    }),
    source: isolationSource,
    gateTestResult: gateTest,
    deployCutoverTestResult: deployCutoverTest,
    previewAuthTestResult: previewAuthTest,
  });
  const validatorExecutableDigest = programmeGateValidatorExecutableDigest({
    root: ROOT,
  });
  const benPrivateKey = privateBenApproverKey();
  const publisherPrivateKey = privateStatusPublisherKey();

  const reviewVerificationTime = new Date().toISOString();
  const reviewArtefact = reviewArtifact(basis);
  const reviewSet = buildReviewSetInput({
      at: reviewVerificationTime,
      bundle: reviewArtefact.bundle,
      expectedCodeCommit: basis.codeCommit,
      expectedSpecificationRoot: basis.specificationRoot,
      keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
      repositoryRoot: ROOT,
      reviewArtifactByteSize: reviewArtefact.reviewArtifactByteSize,
      reviewArtifactSha256: reviewArtefact.reviewArtifactSha256,
      signIndependence: (bytes) => signatureForBytes(bytes, privateKey),
      validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
      validatorExecutableDigest,
      validatorKeyId: VALIDATOR_KEY_ID,
  });
  const approvalTime = new Date().toISOString();
  const benApproval = buildBenApproval({
    approvedAt: approvalTime,
    approvedCodeCommit: codeCommit,
    approvedRoot: specificationDigest,
    approvalIntent: process.env.PROGRAMME_GATE_APPROVAL_INTENT,
    approverKeyId: BEN_APPROVER_KEY_ID,
    githubActorId: process.env.GITHUB_ACTOR_ID,
    githubActorLogin: process.env.GITHUB_ACTOR,
    githubRunId: process.env.GITHUB_RUN_ID,
    governanceDiff: governanceDiff(codeCommit, basis),
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    nonce: crypto.randomUUID(),
    reviewArtifactByteSize: reviewArtefact.reviewArtifactByteSize,
    reviewArtifactSha256: reviewArtefact.reviewArtifactSha256,
    reviewSetEvidenceId: reviewSet.verification.evidence_id,
    reviewedCodeCommit: basis.codeCommit,
    reviewedRoot: basis.specificationRoot,
    signApproval: (bytes) => signatureForBytes(bytes, benPrivateKey),
    verificationTime: approvalTime,
  });
  const reviewObservedAt = new Date().toISOString();
  const reviewBundle = buildReviewApprovalReadiness({
    authority: createReviewApprovalReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: reviewObservedAt,
      verificationTime: reviewObservedAt,
    }),
    reviewSet: {
      members: reviewSet.members,
      authority: reviewSet.authority,
    },
    benApproval: {
      record: benApproval.record,
      authority: benApproval.authority,
    },
    gateTestResult: gateTest,
    reviewContextTestResult: reviewContextTest,
  });
  const reviewSigningAuthority = createReviewApprovalSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime: reviewObservedAt,
    reviewSetAuthority: reviewSet.authority,
    benApprovalAuthority: benApproval.authority,
  });
  const reviewPreflights = reviewBundle.candidates.map((candidate) => {
    const signingRequest = buildReviewApprovalSigningRequest({
      authority: reviewSigningAuthority,
      bundle: reviewBundle,
      candidate,
    });
    return preflightReviewApprovalSignature({
      authority: reviewSigningAuthority,
      bundle: reviewBundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
  });
  const reviewEvidence = reviewBundle.candidates.map(
    (candidate, index) => evidenceResult(candidate, reviewPreflights[index]),
  );

  const securityAuthority = createSecurityDispositionSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime,
  });
  const securityEvidence = securityBundle.candidates.map((candidate) => {
    const signingRequest = buildSecurityDispositionSigningRequest({
      authority: securityAuthority,
      bundle: securityBundle,
      candidate,
    });
    const preflight = preflightSecurityDispositionSignature({
      authority: securityAuthority,
      bundle: securityBundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
    return evidenceResult(candidate, preflight);
  });
  const isolationAuthority = createIsolationSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime: isolationVerificationTime,
  });
  const isolationEvidence = isolationBundle.candidates.map((candidate) => {
    const signingRequest = buildIsolationSigningRequest({
      authority: isolationAuthority,
      bundle: isolationBundle,
      candidate,
    });
    const preflight = preflightIsolationSignature({
      authority: isolationAuthority,
      bundle: isolationBundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
    return evidenceResult(candidate, preflight);
  });

  const containmentSigningAuthority = createContainmentSigningRequestAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime,
  });
  const containmentPreflightAuthority = createContainmentSignedPreflightAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorExecutableDigests: [validatorExecutableDigest],
    verificationTime,
  });
  const gateById = new Map(governingGates().map((gate) => [gate.id, gate]));
  const containmentPreflights = containmentBundle.candidates.map((candidate) => {
    const gate = gateById.get(candidate.gate_id);
    if (!gate) throw new Error(`governing gate ${candidate.gate_id} is unavailable`);
    const signingRequest = buildContainmentEvidenceSigningRequest({
      authority: containmentSigningAuthority,
      bundle: containmentBundle,
      candidate,
      gate,
    });
    return preflightContainmentEvidenceSignature({
      authority: containmentPreflightAuthority,
      bundle: containmentBundle,
      candidate,
      gate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
  });
  const containmentEvidence = containmentBundle.candidates.map(
    (candidate, index) => evidenceResult(candidate, containmentPreflights[index]),
  );
  const containmentStatusReadiness = buildContainmentStatusReadiness({
    authority: createContainmentStatusReadinessAuthority({
      codeCommit,
      environment,
      keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
      specificationRoot: specificationDigest,
      validatorExecutableDigest,
      validatorKeyId: VALIDATOR_KEY_ID,
      verificationTime,
    }),
    bundle: containmentBundle,
    signedPreflights: containmentPreflights,
  });
  if (containmentStatusReadiness.readiness_state
      !== 'READY_FOR_REMAINING_G0_EVIDENCE'
    || containmentStatusReadiness.formal_status_state !== 'OPEN'
    || containmentStatusReadiness.status_publication_attempted !== false) {
    throw new Error('containment evidence did not produce exact unsigned status readiness');
  }
  const g0ReadinessAuthority = createG0StatusReadinessAuthority({
    specificationRoot: specificationDigest,
    codeCommit,
    environment,
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime: reviewObservedAt,
    reviewSigningAuthority,
    ...(mode === 'SUCCESSOR' ? {
      generation: currentRef.generation + 1,
      predecessorStatusId: currentRef.status_artefact_id,
      bootstrapState: 'CONSUMED',
    } : {}),
  });
  const g0StatusReadiness = buildG0StatusReadiness({
    authority: g0ReadinessAuthority,
    containment: {
      bundle: containmentBundle,
      signedPreflights: containmentPreflights,
    },
    security: {
      bundle: securityBundle,
      signedPreflights: securityEvidence.map((entry) => ({
        preflight_type: 'ProgrammeGateSecurityDispositionSignedPreflight/V1',
        gate_id: entry.gate_id,
        evidence_validation: entry.evidence_validation,
        signed_envelope: entry.signed_envelope,
      })),
    },
    isolation: {
      bundle: isolationBundle,
      signedPreflights: isolationEvidence.map((entry) => ({
        preflight_type: 'ProgrammeGateIsolationSignedPreflight/V1',
        gate_id: entry.gate_id,
        evidence_validation: entry.evidence_validation,
        signed_envelope: entry.signed_envelope,
      })),
    },
    review: {
      bundle: reviewBundle,
      signedPreflights: reviewPreflights,
    },
  });
  if (g0StatusReadiness.readiness_state !== 'READY_FOR_STATUS_SIGNATURE'
    || g0StatusReadiness.formal_status_state !== 'OPEN'
    || g0StatusReadiness.bootstrap_nonce_consumed !== (mode === 'SUCCESSOR')
    || g0StatusReadiness.status_publication_attempted !== false) {
    throw new Error('ten-gate evidence did not produce exact unsigned G0 status readiness');
  }

  const signedStatusAuthority = createG0SignedStatusAuthority({
    authority: g0ReadinessAuthority,
    verifyStatusSignature(status) {
      return verifySignature({
        keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
        keyId: STATUS_PUBLISHER_KEY_ID,
        role: 'STATUS_PUBLISHER',
        domain: 'PROGRAMME_GATE_STATUS/V2',
        payload: unsignedProgrammeGateStatus(status),
        signature: status.signature,
        at: reviewObservedAt,
      });
    },
  });
  const statusSignature = signatureForBytes(
    signatureBytes({
      domain: 'PROGRAMME_GATE_STATUS/V2',
      role: 'STATUS_PUBLISHER',
      payload: g0StatusReadiness.unsigned_status,
    }),
    publisherPrivateKey,
  );
  const signedStatus = attachProgrammeGateStatusSignature({
    authority: signedStatusAuthority,
    unsignedStatus: g0StatusReadiness.unsigned_status,
    signature: statusSignature,
  });
  const statusArtefactId = domainDigest(
    STATUS_ARTEFACT_ID_DOMAIN,
    signedStatus,
  );
  const unsignedPublicationHead = {
    schema_version: 'ProgrammeStatusPublicationHead/V1',
    generation: signedStatus.generation,
    predecessor_git_object_id: mode === 'SUCCESSOR'
      ? currentRef.observed_git_object_id
      : 'NONE',
    status_git_object_id: gitBlobObjectId(signedStatus, canonicalBytes),
    status_artefact_id: statusArtefactId,
    status_artefact_payload_digest: domainDigest(
      STATUS_ARTEFACT_PAYLOAD_DOMAIN,
      signedStatus,
    ),
    publisher_key_id: STATUS_PUBLISHER_KEY_ID,
    signature_algorithm: 'Ed25519',
  };
  const publicationHead = {
    ...unsignedPublicationHead,
    signature: signatureForBytes(
      signatureBytes({
        domain: 'PROGRAMME_GATE_PUBLICATION_HEAD/V1',
        role: 'STATUS_PUBLISHER',
        payload: unsignedPublicationHead,
      }),
      publisherPrivateKey,
    ),
  };
  validateSchema('ProgrammeStatusPublicationHead/V1', publicationHead);
  const publicationAuthority = createProgrammePublicationAuthority({
    statusAuthority: signedStatusAuthority,
    canonicalBytes,
    domainDigest,
    validatePublicationHeadSchema: validateSchema,
    verifyPublicationHeadSignature(head) {
      const { signature, ...unsignedHead } = head;
      return verifySignature({
        keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
        keyId: STATUS_PUBLISHER_KEY_ID,
        role: 'STATUS_PUBLISHER',
        domain: 'PROGRAMME_GATE_PUBLICATION_HEAD/V1',
        payload: unsignedHead,
        signature,
        at: reviewObservedAt,
      });
    },
  });
  const publicationPlan = planProgrammeStatusPublication({
    authority: publicationAuthority,
    status: signedStatus,
    evidenceCandidates: g0StatusReadiness.evidence_candidates,
    publicationHead,
    currentRef,
    bootstrapNonce: mode === 'SUCCESSOR' ? 'NONE' : BOOTSTRAP_NONCE,
    commitIdentity: {
      author_name: 'Programme Gate Publisher',
      author_email: 'bengoodchild@gmail.com',
      timestamp: String(Math.floor(Date.parse(reviewObservedAt) / 1000)),
      timezone: '+0000',
      message: `Publish programme gate status generation ${signedStatus.generation}`,
    },
  });
  const exactMainBeforePublication = successful('git', [
    'ls-remote',
    '--refs',
    'origin',
    'refs/heads/main',
  ]).split(/\s+/)[0];
  if (exactMainBeforePublication !== expectedCommit) {
    throw new Error('origin main changed before status publication');
  }
  if (mode === 'SUCCESSOR'
    && remoteRef(ROOT, 'origin', currentRef.ref) !== currentRef.observed_git_object_id) {
    throw new Error('publication predecessor changed before status publication');
  }
  const publicationReceipt = executeProgrammeStatusPublication({
    plan: publicationPlan,
    repositoryRoot: ROOT,
    remote: 'origin',
  });

  const output = {
    schema_version: 'ProgrammeGateG0SignedEvidenceBundle/V2',
    specification_root: specificationDigest,
    code_commit: codeCommit,
    runtime_deployment_id: deploymentId,
    environment,
    containment_observed_at: containmentBundle.observed_at,
    security_observed_at: securityObservedAt,
    isolation_observed_at: isolationSource.observed_at,
    review_observed_at: reviewObservedAt,
    validator_executable_digest: validatorExecutableDigest,
    validator_configuration_digest: REGISTRY_DIGESTS.validator_configuration,
    validator_key_id: VALIDATOR_KEY_ID,
    security_attestation_source_digest: securityBundle.attestation_source_digest,
    isolation_source_digest: isolationBundle.isolation_source_digest,
    containment_status_readiness: {
      readiness_state: containmentStatusReadiness.readiness_state,
      passing_gate_ids: containmentStatusReadiness.passing_gate_ids,
      formal_status_state: containmentStatusReadiness.formal_status_state,
      status_publication_attempted:
        containmentStatusReadiness.status_publication_attempted,
    },
    g0_status_readiness: {
      ...g0StatusReadiness,
      status_signature: signedStatus.signature,
      formal_status_state: 'PASS',
      bootstrap_nonce_consumed: true,
      status_publication_attempted: true,
    },
    programme_gate_status_v2: signedStatus,
    programme_status_publication_head: publicationHead,
    programme_status_publication_receipt: publicationReceipt,
    evidence: [
      ...containmentEvidence,
      ...securityEvidence,
      ...isolationEvidence,
      ...reviewEvidence,
    ],
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

await main();
