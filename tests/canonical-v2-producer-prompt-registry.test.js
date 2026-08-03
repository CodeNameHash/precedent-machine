'use strict';

/**
 * tests/canonical-v2-producer-prompt-registry.test.js
 *
 * Covers the producer-prompt-registry seam (docs/superpowers/specs/
 * 2026-08-02-family-termination-rights-design.md section 3, "Dispatch
 * seam"): producer-prompt-registry.js, section-family-classifier.js, their
 * wiring into native-extraction-run.js's dispatch, and
 * candidate-resolution.js's SECTION_FAMILY_AI_UNVERIFIED blocking
 * condition.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  PRODUCER_PROMPT_REGISTRY_SCHEMA,
  getProducerPromptModule,
  listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { buildCapitalisationProducerPrompt } = require('../lib/canonical-v2/native-producer/capitalisation-producer-prompt');
const { buildNoShopProducerPrompt } = require('../lib/canonical-v2/native-producer/no-shop-producer-prompt');
const { buildTerminationProducerPrompt } = require('../lib/canonical-v2/native-producer/termination-producer-prompt');
const { buildAntitrustRegulatoryProducerPrompt } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { buildRepresentationsProducerPrompt } = require('../lib/canonical-v2/native-producer/representations-producer-prompt');
const { buildNoOtherRepsFraudProducerPrompt } = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-producer');
const {
  SECTION_FAMILY_CLASSIFIER_VERSION,
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_AI_CLASSIFIED,
  SECTION_FAMILY_MANIFEST_ASSIGNED,
  SECTION_FAMILY_AI_UNVERIFIED,
  classifySectionFamily,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─── producer-prompt-registry.js ───

test('registry: CAPITALISATION is registered to the unchanged buildCapitalisationProducerPrompt function', () => {
  assert.equal(getProducerPromptModule('CAPITALISATION'), buildCapitalisationProducerPrompt);
});

test('registry: NO_SHOP is registered to the unchanged buildNoShopProducerPrompt function', () => {
  assert.equal(getProducerPromptModule('NO_SHOP'), buildNoShopProducerPrompt);
});

// TERMINATION is now registered (family-termination-rights slice, docs/
// superpowers/specs/2026-08-02-family-termination-rights-design.md section
// 3) -- this is the seam's pre-existing rule finally getting a producer.
test('registry: TERMINATION is registered to the unchanged buildTerminationProducerPrompt function', () => {
  assert.equal(getProducerPromptModule('TERMINATION'), buildTerminationProducerPrompt);
});

test('registry: ANTITRUST_REGULATORY is registered to its own prompt builder', () => {
  assert.equal(getProducerPromptModule('ANTITRUST_REGULATORY'), buildAntitrustRegulatoryProducerPrompt);
});

test('registry: REPRESENTATIONS is registered to its native qualifier producer', () => {
  assert.equal(getProducerPromptModule('REPRESENTATIONS'), buildRepresentationsProducerPrompt);
});

test('registry: NO_OTHER_REPS_FRAUD is registered to its native prompt', () => {
  assert.equal(getProducerPromptModule('NO_OTHER_REPS_FRAUD'), buildNoOtherRepsFraudProducerPrompt);
});

test('registry: unknown/unregistered family returns null -- fail closed, never a capitalisation fallback', () => {
  assert.equal(getProducerPromptModule('SOME_UNKNOWN_FAMILY'), null);
  assert.equal(getProducerPromptModule(''), null);
  assert.equal(getProducerPromptModule(null), null);
  assert.equal(getProducerPromptModule(undefined), null);
});

test('registry: composed adapter prompt families are registered', () => {
  assert.deepEqual(
    listRegisteredSectionFamilies(),
    ['ANTITRUST_REGULATORY', 'APPRAISAL_DISSENTERS_RIGHTS', 'CAPITALISATION', 'CLOSING_CONDITIONS', 'CONSIDERATION', 'DIVIDENDS', 'DNO_INDEMNIFICATION', 'EMPLOYEE_MATTERS', 'FINANCING_COVENANTS', 'GENERAL_COVENANTS', 'GUARANTY_FINANCING_PARTY', 'INTERIM_OPERATING', 'KEY_DEFINED_TERMS', 'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MERGER_STRUCTURE_CLOSING', 'MISC_BOILERPLATE', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP', 'PROXY_MEETING', 'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TAX_MATTERS', 'TERMINATION', 'TERMINATION_FEE'],
  );
});

test('classifier stage 1: regulatory-efforts titles classify ANTITRUST_REGULATORY, while takeover and rep titles do not', async () => {
  assert.equal((await classifySectionFamily({ title: 'Regulatory Cooperation' })).section_family, 'ANTITRUST_REGULATORY');
  assert.notEqual((await classifySectionFamily({ title: 'State Takeover Statutes' })).section_family, 'ANTITRUST_REGULATORY');
  assert.notEqual((await classifySectionFamily({ title: 'Regulatory Matters' })).section_family, 'ANTITRUST_REGULATORY');
});

test('classifier stage 1: Company and Parent representations articles route to REPRESENTATIONS', async () => {
  for (const title of ['Representations and Warranties of the Company', 'Representations and Warranties of Parent']) {
    // eslint-disable-next-line no-await-in-loop
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'REPRESENTATIONS');
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
  }
});

test('registry: schema constant is exported', () => {
  assert.equal(PRODUCER_PROMPT_REGISTRY_SCHEMA, 'NATIVE_PRODUCER_PROMPT_REGISTRY/V1');
});

// ─── section-family-classifier.js: stage 1 ───

test('classifier stage 1: a termination-rights title classifies TERMINATION, rule-classified', async () => {
  const result = await classifySectionFamily({ title: 'Termination' });
  assert.equal(result.section_family, 'TERMINATION');
  assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
  assert.equal(result.classifier_version, SECTION_FAMILY_CLASSIFIER_VERSION);
  assert.equal(result.declined_reason, null);
});

test('classifier stage 1: the TERMF exclusion -- fee/expense/effect-of-termination titles never classify TERMINATION', async () => {
  const termfTitles = [
    'Termination Fee',
    'Company Termination Fees',
    'Fees and Expenses',
    'Expense Reimbursement',
    'Expenses and Other Payments',
    'Effect of Termination',
    'Sole and Exclusive Remedy',
  ];
  for (const title of termfTitles) {
    // eslint-disable-next-line no-await-in-loop
    const result = await classifySectionFamily({ title });
    assert.notEqual(result.section_family, 'TERMINATION', `expected "${title}" to NOT classify TERMINATION`);
  }
});

// docs/superpowers/specs/2026-08-02-family-termination-fee-design.md
// section 3: the TERMF exclusion above is now claimed by its own family,
// TERMINATION_FEE, rule-classified at stage 1 -- registered in
// producer-prompt-registry.js in this same slice (see that file's own
// registration comment).
test('classifier stage 1: fee/break-up/expense-reimbursement/effect-of-termination/sole-remedy titles classify TERMINATION_FEE, rule-classified', async () => {
  const termfTitles = [
    'Termination Fee',
    'Company Termination Fees',
    'Fees and Expenses',
    'Expense Reimbursement',
    'Expenses and Other Payments',
    'Effect of Termination',
    'Sole and Exclusive Remedy',
  ];
  for (const title of termfTitles) {
    // eslint-disable-next-line no-await-in-loop
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'TERMINATION_FEE', `expected "${title}" to classify TERMINATION_FEE`);
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
    assert.equal(result.declined_reason, null);
  }
});

// docs/superpowers/specs/2026-08-02-family-no-shop-design.md section 3:
// NO_SHOP's own stage-1 title rule, registered in producer-prompt-
// registry.js in this same slice.
test('classifier stage 1: "No Solicitation" / "Non-Solicitation" / "No-Shop" titles classify NO_SHOP, rule-classified', async () => {
  const noShopTitles = ['No Solicitation', 'No Solicitation; Other Offers', 'Non-Solicitation of Transactions', 'No-Shop Provisions'];
  for (const title of noShopTitles) {
    // eslint-disable-next-line no-await-in-loop
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'NO_SHOP', `expected "${title}" to classify NO_SHOP`);
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
    assert.equal(result.declined_reason, null);
  }
});

test('classifier stage 1: the NO_SHOP title exclusion -- personnel/customer non-solicitation titles never classify NO_SHOP', async () => {
  const excludedTitles = ['Non-Solicitation of Employees', 'Non-Solicitation of Customers', 'Employee Non-Solicitation'];
  for (const title of excludedTitles) {
    // eslint-disable-next-line no-await-in-loop
    const result = await classifySectionFamily({ title });
    assert.notEqual(result.section_family, 'NO_SHOP', `expected "${title}" to NOT classify NO_SHOP`);
  }
});

test('classifier stage 1: a title with no "termination" word does not match, stage 2 not engaged without a provider', async () => {
  const result = await classifySectionFamily({ title: 'Representations Concerning the Company' });
  assert.equal(result.section_family, null);
  assert.equal(result.provenance, null);
  assert.equal(result.declined_reason, 'NO_STAGE_2_PROVIDER');
});

// ─── section-family-classifier.js: stage 2 ───

test('classifier stage 2: a well-formed provider response classifies with AI provenance', async () => {
  const result = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => ({ section_family: 'CAPITALISATION' }),
  });
  assert.equal(result.section_family, 'CAPITALISATION');
  assert.equal(result.provenance, SECTION_FAMILY_AI_CLASSIFIED);
  assert.equal(result.declined_reason, null);
});

test('classifier stage 2: a malformed response is a typed decline, never an empty success', async () => {
  const emptyString = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => ({ section_family: '' }),
  });
  assert.equal(emptyString.section_family, null);
  assert.equal(emptyString.declined_reason, 'STAGE_2_MALFORMED_RESPONSE');

  const nonObject = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => null,
  });
  assert.equal(nonObject.section_family, null);
  assert.equal(nonObject.declined_reason, 'STAGE_2_MALFORMED_RESPONSE');

  const missingKey = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => ({}),
  });
  assert.equal(missingKey.section_family, null);
  assert.equal(missingKey.declined_reason, 'STAGE_2_MALFORMED_RESPONSE');
});

test('classifier stage 2: an explicit decline is respected, never guessed past', async () => {
  const result = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => ({ declined: true }),
  });
  assert.equal(result.section_family, null);
  assert.equal(result.declined_reason, 'STAGE_2_DECLINED');
});

test('classifier stage 2: a throwing provider is a typed decline, never an unhandled rejection', async () => {
  const result = await classifySectionFamily({
    title: 'Miscellaneous',
    classifier_provider: async () => { throw new Error('boom'); },
  });
  assert.equal(result.section_family, null);
  assert.equal(result.declined_reason, 'STAGE_2_PROVIDER_ERROR');
  assert.equal(result.error, 'boom');
});

test('classifier: stage 1 always wins over stage 2 -- a matching title never reaches the injected provider', async () => {
  let called = false;
  const result = await classifySectionFamily({
    title: 'Termination',
    classifier_provider: async () => { called = true; return { section_family: 'CAPITALISATION' }; },
  });
  assert.equal(called, false);
  assert.equal(result.section_family, 'TERMINATION');
  assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
});

// ─── native-extraction-run.js: dispatch through the registry ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);
const qxoFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n',
].join('');
const DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';

function locateInGovernedScope(governedScope, quote) {
  const bytes = Buffer.from(governedScope.source_text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = bytes.indexOf(needle);
  if (start < 0) throw new Error(`fixture quote not found in governed scope: ${quote}`);
  return { start, end: start + needle.length };
}

function makeClaimProposal({ subjectSeed, quote, absoluteStart, absoluteEnd }) {
  const subjectOccurrenceId = contentId('REGISTRY_TEST_SUBJECT/V1', subjectSeed);
  const excerptId = contentId('REGISTRY_TEST_EXCERPT/V1', { quote, absoluteStart, absoluteEnd });
  return {
    kind: 'claim',
    proposal_kind: 'GOVERNED',
    subject_occurrence_id: subjectOccurrenceId,
    claim_definition_key: 'REGISTRY_TEST_CLAIM_CANDIDATE',
    claim_definition_version: 1,
    ordinal: 0,
    state: 'PRESENT',
    raw_value: quote,
    canonical_value: null,
    attributes: {},
    allowed_attributes: [],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [{
      evidence_role: 'OPERATIVE_TEXT',
      excerpt_id: excerptId,
      document_ordinal: 0,
      absolute_start: absoluteStart,
      absolute_end: absoluteEnd,
      ordinal: 0,
    }],
    extraction_version: 'REGISTRY_TEST/V1',
    normalisation_version: 'REGISTRY_TEST/V1',
    derivation_version: 'REGISTRY_TEST/V1',
  };
}

function stubProducerProvider() {
  return async ({ governed_scope: governedScope }) => {
    const { start, end } = locateInGovernedScope(governedScope, LIMB_I_QUOTE);
    return {
      provider_id: 'registry-test-stub/v1',
      model_id: 'stub-model',
      prompt: 'registry-test-stub-prompt-v1',
      proposals: [makeClaimProposal({
        subjectSeed: { section_reference: governedScope.section_reference, quote: LIMB_I_QUOTE },
        quote: LIMB_I_QUOTE,
        absoluteStart: start,
        absoluteEnd: end,
      })],
      evidence_residuals: [],
    };
  };
}

test('native-extraction-run default (no classifier): every section dispatches CAPITALISATION, unclassified provenance -- pure-refactor default', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
  });

  assert.equal(receipt.resolved_sections.length, 1);
  assert.equal(receipt.resolved_sections[0].section_family, 'CAPITALISATION');
  assert.equal(receipt.resolved_sections[0].section_family_provenance, null);
  assert.equal(receipt.undispatched_sections.length, 0);
  assert.equal(receipt.compiled_candidate_count, 1);
  assert.equal(receipt.compiled_candidates[0].section_family, 'CAPITALISATION');
  assert.equal(receipt.compiled_candidates[0].section_family_provenance, null);
});

test('native-extraction-run with classifier: stage 1 classifies TERMINATION from title, and it is now REGISTERED -- the producer is dispatched, never fails closed (family-termination-rights slice)', async () => {
  const terminationText = [
    'ARTICLE VIII\n\nTermination\n\n',
    'Section 8.1 Termination. This Agreement may be terminated at any time ',
    'prior to the Effective Time by mutual written consent of the Company ',
    'and Parent by action of their respective boards of directors.\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(terminationText, 'utf8'));
  let providerCalled = false;

  const receipt = await runNativeExtraction({
    source_text: terminationText,
    document_hash: documentHash,
    section_references: ['8.1'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async () => {
      providerCalled = true;
      return {
        provider_id: 'registry-test-stub/v1', model_id: 'stub-model', prompt: 'registry-test-stub-prompt-v1',
        proposals: [], evidence_residuals: [],
      };
    },
    section_family_classifier: async () => ({ section_family: 'CAPITALISATION' }), // should never be called: stage 1 matches first
  });

  assert.equal(providerCalled, true, 'TERMINATION is now registered -- the producer IS dispatched');
  assert.equal(receipt.resolved_sections[0].section_family, 'TERMINATION');
  assert.equal(receipt.resolved_sections[0].section_family_provenance, SECTION_FAMILY_RULE_CLASSIFIED);
  assert.notEqual(receipt.resolved_sections[0].prompt_id, null);
  assert.notEqual(receipt.resolved_sections[0].producer_receipt, null);
  assert.equal(receipt.undispatched_sections.length, 0);
  assert.equal(receipt.compiled_candidate_count, 0);
  assert.equal(receipt.compiled_candidates.length, 0);
  assert.equal(receipt.coverage_proxies.length, 1);
  assert.equal(receipt.limb_enumeration_scan.length, 1);
});

test('native-extraction-run with classifier: an UNKNOWN family still fails closed -- no producer, no candidates, never a capitalisation fallback (proves the fail-closed contract independent of TERMINATION\'s own registration)', async () => {
  const documentHash = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
  let providerCalled = false;

  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: documentHash,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async () => { providerCalled = true; return { proposals: [], evidence_residuals: [] }; },
    section_family_classifier: async () => ({ section_family: 'SOME_UNKNOWN_FAMILY' }),
  });

  assert.equal(providerCalled, false, 'no producer is dispatched for an unregistered family');
  assert.equal(receipt.resolved_sections[0].section_family, 'SOME_UNKNOWN_FAMILY');
  assert.equal(receipt.resolved_sections[0].prompt_id, null);
  assert.equal(receipt.resolved_sections[0].producer_receipt, null);
  assert.equal(receipt.undispatched_sections.length, 1);
  assert.equal(receipt.undispatched_sections[0].section_family, 'SOME_UNKNOWN_FAMILY');
  assert.equal(receipt.compiled_candidate_count, 0);
  assert.equal(receipt.compiled_candidates.length, 0);
});

test('native-extraction-run with classifier: stage 2 AI-classifies a registered family and dispatches it, provenance visible in the receipt', async () => {
  let registeredFamilies = null;
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
    section_family_classifier: async (input) => {
      registeredFamilies = input.registered_families;
      return { section_family: 'CAPITALISATION' };
    },
  });

  assert.equal(receipt.resolved_sections[0].section_family, 'CAPITALISATION');
  assert.equal(receipt.resolved_sections[0].section_family_provenance, SECTION_FAMILY_AI_CLASSIFIED);
  assert.equal(receipt.compiled_candidate_count, 1);
  assert.equal(receipt.compiled_candidates[0].section_family_provenance, SECTION_FAMILY_AI_CLASSIFIED);
  assert.equal(receipt.undispatched_sections.length, 0);
  assert.deepEqual(registeredFamilies, listRegisteredSectionFamilies());
});

test('native-extraction-run dispatches an exact manifest assignment without a classifier call', async () => {
  let governedSide = null;
  const baseProvider = stubProducerProvider();
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async (input) => {
      governedSide = input.governed_scope.covenant_side;
      return baseProvider(input);
    },
    section_family_assignments: [{
      section_reference: '3.1(b)',
      family_id: 'CAPITALISATION',
      covenant_side: 'TARGET',
    }],
  });

  assert.equal(governedSide, 'TARGET');
  assert.equal(receipt.resolved_sections[0].section_family, 'CAPITALISATION');
  assert.equal(
    receipt.resolved_sections[0].section_family_provenance,
    SECTION_FAMILY_MANIFEST_ASSIGNED,
  );
  assert.equal(
    receipt.compiled_candidates[0].section_family_provenance,
    SECTION_FAMILY_MANIFEST_ASSIGNED,
  );
});

test('manifest assignment fails closed on incomplete, unknown or mixed classifier input', async () => {
  const base = {
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
  };
  await assert.rejects(
    () => runNativeExtraction({ ...base, section_family_assignments: [] }),
    (error) => error.code === 'INVALID_INPUT',
  );
  await assert.rejects(
    () => runNativeExtraction({
      ...base,
      section_family_assignments: [{
        section_reference: '3.1(b)', family_id: 'UNKNOWN_FAMILY',
      }],
    }),
    (error) => error.code === 'INVALID_INPUT',
  );
  await assert.rejects(
    () => runNativeExtraction({
      ...base,
      section_family_assignments: [{
        section_reference: '3.1(b)', family_id: 'CAPITALISATION',
      }],
      section_family_classifier: async () => ({ section_family: 'CAPITALISATION' }),
    }),
    (error) => error.code === 'INVALID_INPUT',
  );
});

test('native-extraction-run stage 2 can reach each non-capitalisation registered family without a default fallback', async () => {
  const expectedFamilies = ['TERMINATION_FEE', 'NO_SHOP', 'MAE_DEFINITION', 'TERMINATION', 'NO_OTHER_REPS_FRAUD'];
  let nextFamily = 0;
  let producerCalls = 0;
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)', '3.1(b)', '3.1(b)', '3.1(b)', '3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ section_family: sectionFamily }) => {
      assert.equal(sectionFamily, expectedFamilies[producerCalls]);
      producerCalls += 1;
      return {
        provider_id: 'all-families-registry-test/v1', model_id: 'stub-model', prompt: 'all-families-registry-test-prompt/v1',
        proposals: [], evidence_residuals: [],
      };
    },
    section_family_classifier: async ({ registered_families: registeredFamilies }) => {
      assert.deepEqual(registeredFamilies, listRegisteredSectionFamilies());
      return { section_family: expectedFamilies[nextFamily++] };
    },
  });

  assert.equal(producerCalls, expectedFamilies.length);
  assert.deepEqual(receipt.resolved_sections.map((section) => section.section_family), expectedFamilies);
  assert.ok(receipt.resolved_sections.every((section) => section.section_family_provenance === SECTION_FAMILY_AI_CLASSIFIED));
  assert.equal(receipt.undispatched_sections.length, 0);
});

test('native-extraction-run with classifier: an AI decline/malformed response is a fail-closed skip, never a capitalisation fallback', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async () => { throw new Error('must never be called'); },
    section_family_classifier: async () => ({ declined: true }),
  });

  assert.equal(receipt.resolved_sections[0].section_family, null);
  assert.equal(receipt.resolved_sections[0].section_family_provenance, null);
  assert.equal(receipt.undispatched_sections.length, 1);
  assert.equal(receipt.undispatched_sections[0].declined_reason, 'STAGE_2_DECLINED');
  assert.equal(receipt.compiled_candidate_count, 0);
});

test('native-extraction-run: section_family_classifier must be a function when supplied', async () => {
  await assert.rejects(() => runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
    section_family_classifier: 'not-a-function',
  }), (err) => {
    assert.equal(err.code, 'INVALID_INPUT');
    return true;
  });
});

// ─── candidate-resolution.js: SECTION_FAMILY_AI_UNVERIFIED blocking condition ───

test('candidate-resolution: an AI-classified section carries SECTION_FAMILY_AI_UNVERIFIED on its open-world candidates, never a silently-clean one', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
    section_family_classifier: async () => ({ section_family: 'CAPITALISATION' }),
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: {
      document_hash: DOCUMENT_HASH,
      governed_deal_key: 'registry-test-deal',
    },
  });

  // The synthetic REGISTRY_TEST_CLAIM_CANDIDATE key is unmapped, so this
  // lands in open_world -- exercising pushOpenWorld's wiring.
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].section_family_ai_unverified, SECTION_FAMILY_AI_UNVERIFIED);
});

test('candidate-resolution: a default (unclassified) CAPITALISATION section carries no section-family blocking condition', async () => {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: stubProducerProvider(),
  });

  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: {
      document_hash: DOCUMENT_HASH,
      governed_deal_key: 'registry-test-deal',
    },
  });

  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].section_family_ai_unverified, null);
});
