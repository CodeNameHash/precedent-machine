'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  METSERA_DEAL_ID,
  METSERA_OCCURRENCE_ID,
} = require('../lib/canonical-v2/metsera-pilot-extension-proposal');
const { buildMetseraComprehensiveSelectionReview } = require('../lib/canonical-v2/metsera-comprehensive-selection-review');
const {
  buildMetseraPilotExtensionReadiness,
} = require('../lib/canonical-v2/metsera-pilot-extension-readiness');
const {
  DARK_INTEGRATION_CONFIGURATION_SCHEMA,
  buildDarkIntegrationPreflight,
} = require('../lib/canonical-v2/dark-integration-preflight');
const { buildPromptBudgetPolicy } = require('../lib/canonical-v2/native-producer/unified-prompt-budget-preflight');
const { makeRecord } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';

function comprehensiveSelectionReview() {
  const receipt = makeRecord({
    dealId: METSERA_DEAL_ID,
    occurrenceId: METSERA_OCCURRENCE_ID,
    url: METSERA_URL,
    sourceText: 'Section 6.03 Reasonable Best Efforts; Notification. Pfizer and Metsera shall use reasonable best efforts.',
  });
  return buildMetseraComprehensiveSelectionReview({ receipt_record: receipt, repository_root: ROOT });
}

function darkPreflight() {
  return buildDarkIntegrationPreflight({
    configuration: {
      schema_version: DARK_INTEGRATION_CONFIGURATION_SCHEMA,
      authority: {
        production_authority: 'NONE',
        production_corpus_write_authority: 'NONE',
        production_import_authority: 'NONE',
        production_activation_authority: 'NONE',
      },
      durable_artifact_root: ROOT,
    },
    environment: {},
  });
}

function input(overrides = {}) {
  return {
    comprehensive_selection_review: comprehensiveSelectionReview(),
    durable_artifact_root: ROOT,
    dark_integration_preflight: darkPreflight(),
    prompt_budget_policy: buildPromptBudgetPolicy({
      policy_id: 'M3_METSERA_EXTENSION_PROMPT_BUDGET',
      policy_version: 1,
      prompt_byte_ceiling: 64 * 1024,
    }),
    successor_m1_authority: undefined,
    ...overrides,
  };
}

function blockerCodes(readiness) {
  return readiness.blockers.map((entry) => entry.code);
}

test('binds the complete Metsera selection review but never makes it executable before review issuance', () => {
  const first = buildMetseraPilotExtensionReadiness(input());
  const second = buildMetseraPilotExtensionReadiness(input());
  assert.equal(first.status, 'BLOCKED');
  assert.equal(first.readiness_id, second.readiness_id);
  assert.equal(first.comprehensive_selection_review_id, input().comprehensive_selection_review.review_id);
  assert.equal(first.durable_artifact_root, ROOT);
  assert.equal(first.dark_integration_preflight_id, input().dark_integration_preflight.preflight_id);
  assert.equal(first.prompt_budget_policy_id, 'M3_METSERA_EXTENSION_PROMPT_BUDGET');
  assert.deepEqual(first.execution_sources, []);
  assert.deepEqual(first.work_items, []);
  assert.equal(first.execution_state, 'NOT_STARTED');
  assert.equal(first.provider_launch_authority, 'NOT_GRANTED');
  assert.equal(first.source_admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.ok(blockerCodes(first).includes('BLOCKED_ROUTING_CLASSIFIER_SEMANTICS'));
  assert.ok(blockerCodes(first).includes('METSERA_COMPREHENSIVE_SELECTION_REVIEW_NOT_ISSUED'));
  assert.ok(blockerCodes(first).includes('METSERA_SUCCESSOR_M1_AUTHORITY_NOT_PROVED'));
});

test('fails closed for a missing policy, mismatched dark root, a malformed comprehensive review, or the superseded one-item proposal', () => {
  const missingPolicy = buildMetseraPilotExtensionReadiness(input({ prompt_budget_policy: undefined }));
  assert.equal(missingPolicy.status, 'BLOCKED');
  assert.ok(blockerCodes(missingPolicy).includes('METSERA_PROMPT_BUDGET_POLICY_INVALID'));

  const mismatchedDark = buildMetseraPilotExtensionReadiness(input({
    dark_integration_preflight: buildDarkIntegrationPreflight({
      configuration: {
        schema_version: DARK_INTEGRATION_CONFIGURATION_SCHEMA,
        authority: {
          production_authority: 'NONE',
          production_corpus_write_authority: 'NONE',
          production_import_authority: 'NONE',
          production_activation_authority: 'NONE',
        },
        durable_artifact_root: path.dirname(ROOT),
      },
      environment: {},
    }),
  }));
  assert.ok(blockerCodes(mismatchedDark).includes('METSERA_DARK_INTEGRATION_NOT_CLOSED'));

  const invalidReview = structuredClone(input().comprehensive_selection_review);
  invalidReview.deterministic_candidate_work_items.push({ work_item_id: 'pretend-authority' });
  const malformed = buildMetseraPilotExtensionReadiness(input({ comprehensive_selection_review: invalidReview }));
  assert.ok(blockerCodes(malformed).includes('METSERA_COMPREHENSIVE_SELECTION_REVIEW_INVALID'));
  assert.ok(!blockerCodes(malformed).includes('METSERA_COMPREHENSIVE_SELECTION_REVIEW_NOT_ISSUED'));

  const superseded = buildMetseraPilotExtensionReadiness(input({
    comprehensive_selection_review: undefined,
    extension_manifest: require('../lib/canonical-v2/metsera-pilot-extension-proposal').buildMetseraPilotExtensionProposal({
      receipt_record: makeRecord({
        dealId: METSERA_DEAL_ID,
        occurrenceId: METSERA_OCCURRENCE_ID,
        url: METSERA_URL,
        sourceText: 'Section 6.03 Reasonable Best Efforts; Notification. Text.',
      }),
    }),
  }));
  assert.ok(blockerCodes(superseded).includes('METSERA_COMPREHENSIVE_SELECTION_REVIEW_INVALID'));
});

test('readiness module contains no provider, network, database, or execution launch path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/metsera-pilot-extension-readiness.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|provider_factory|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /METSERA_COMPREHENSIVE_SELECTION_REVIEW_NOT_ISSUED/);
});
