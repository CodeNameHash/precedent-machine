'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContractV35,
  compileFixtureContractV36,
} = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  CANONICAL_VALUE_EXAMPLES,
  CONTROLLED_VOCABULARIES,
  RESPONSE_SHAPE,
} = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { projectAntitrustProductSurfaces } = require('../lib/canonical-v2/antitrust-product-projection');
const { executeDealCompare } = require('../lib/query/executors/deal-compare');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');
const { provisionFieldValue } = require('../lib/query/types');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');
const {
  SURFACE_DISPOSITIONS,
  dispositionForV1Surface,
  reclassifyAntitrustV1Card,
  validateAntitrustV1SurfaceDispositions,
} = require('../lib/canonical-v2/antitrust-v1-surface-disposition');

const PARENT_REGULATORY_PARTY = Object.freeze({
  role: 'REGULATORY_COVENANT_OBLIGOR', value: 'Parent', capacity: 'BUYER',
});
const MUTUAL_REGULATORY_PARTY = Object.freeze({
  role: 'REGULATORY_COVENANT_OBLIGOR', value: 'Neither party', capacity: 'EITHER_PRINCIPAL_PARTY',
});

const ADAPTER_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'adapter-result.json');
const DESIGN_PATH = path.join(__dirname, '..', 'docs', 'superpowers', 'specs', '2026-08-02-family-antitrust-regulatory-efforts-design.md');

function skechersSource() {
  return JSON.parse(fs.readFileSync(ADAPTER_PATH, 'utf8')).admitted_source_contexts[0].canonical_text.text;
}

function exactSpan(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end >= 0, `missing end marker: ${endMarker}`);
  return source.slice(start, end + endMarker.length);
}

function assertion(kind, quote, canonicalValue, extra = {}) {
  return {
    section_reference: '6.2',
    assertion_kind: kind,
    canonical_value: canonicalValue,
    obligor_party_scope: 'MUTUAL',
    obligor_party: 'Each of Parent and the Company',
    quote,
    ...extra,
  };
}

test('V36 adopts the expanded antitrust concepts and retires legacy V2 identities without mutating V35', () => {
  const previous = compileFixtureContractV35();
  const current = compileFixtureContractV36();
  const previousConcepts = new Set(previous.concepts.map(({ concept_key: key }) => key));
  const currentConcepts = new Set(current.concepts.map(({ concept_key: key }) => key));
  const currentClaims = new Set(current.claim_definitions.map(({ claim_definition_key: key }) => key));
  assert.equal(previousConcepts.has('ANTI-TIMING'), true);
  assert.equal(currentConcepts.has('ANTI-TIMING'), false);
  assert.equal(currentClaims.has('REGULATORY_TIMING_RESTRICTION'), false);
  for (const key of ['ANTI-AGREEMENTS', 'ANTI-COOPERATE', 'ANTI-INFO', 'ANTI-NOTIFY', 'ANTI-NOACTION']) assert.equal(currentConcepts.has(key), true, key);
  for (const key of ['REGULATORY_COOPERATION_OBLIGATION', 'REGULATORY_INFORMATION_SHARING_OBLIGATION', 'REGULATORY_NOTIFICATION_OBLIGATION', 'REGULATORY_FILING_TIMING_STANDARD']) assert.equal(currentClaims.has(key), true, key);
});

test('the antitrust prompt covers every resolver-read attribute and every supported governed value', () => {
  const resolverSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'canonical-v2', 'native-producer', 'candidate-resolution.js'), 'utf8');
  const handlerSource = resolverSource.slice(
    resolverSource.indexOf('function handleRegulatoryEffortsCandidate'),
    resolverSource.indexOf('function handleFinancingCandidate'),
  );
  const resolverAttributeKeys = new Set([
    ...[...handlerSource.matchAll(/\battrs\.([a-z][a-z0-9_]*)/g)].map((match) => match[1]),
    ...[...handlerSource.matchAll(/exactAttribute\('([a-z][a-z0-9_]*)'\)/g)].map((match) => match[1]),
  ]);
  resolverAttributeKeys.delete('proposed_canonical_value');
  resolverAttributeKeys.delete('information_protection_kind');
  for (const key of resolverAttributeKeys) {
    assert.ok(RESPONSE_SHAPE.includes(`"${key}"`), `resolver attribute missing from prompt response shape: ${key}`);
  }
  assert.ok(RESPONSE_SHAPE.includes('"canonical_value"'));

  const definitions = new Map(compileFixtureContractV36().claim_definitions.map((definition) => [definition.claim_definition_key, definition]));
  const vocabularyBindings = {
    EFFORTS_STANDARD_VALUE: 'REGULATORY_EFFORTS_STANDARD',
    BURDEN_COMMITMENT_VALUE: 'REGULATORY_BURDEN_COMMITMENT',
    LITIGATION_OBLIGATION_VALUE: 'REGULATORY_LITIGATION_OBLIGATION',
    TIMING_AGREEMENT_VALUE: 'REGULATORY_TIMING_AGREEMENT_RESTRICTION',
    WITHDRAWAL_REFILING_VALUE: 'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION',
    FILING_TIMING_STANDARD_VALUE: 'REGULATORY_FILING_TIMING_STANDARD',
    STRATEGY_CONTROL_VALUE: 'REGULATORY_STRATEGY_CONTROL',
    CONSULTATION_RIGHT_VALUE: 'REGULATORY_CONSULTATION_RIGHT',
  };
  for (const [vocabularyKey, definitionKey] of Object.entries(vocabularyBindings)) {
    const expected = definitions.get(definitionKey).allowed_canonical_values;
    assert.deepEqual(CONTROLLED_VOCABULARIES[vocabularyKey], expected, vocabularyKey);
  }
  assert.equal(CONTROLLED_VOCABULARIES.BURDEN_COMMITMENT_VALUE.includes('NAMED_ASSET_CARVEOUT'), false);
  assert.deepEqual(CANONICAL_VALUE_EXAMPLES, {
    controlled_vocabulary_kind: 'REASONABLE_BEST_EFFORTS',
    boolean_obligation_kind: true,
    parsed_numeric_kind: null,
  });
  assert.ok(RESPONSE_SHAPE.includes('"canonical_value":null'));
  assert.equal(RESPONSE_SHAPE.includes('boolean true, or null'), false);
});

test('the inactive V1 antitrust routing inventory is complete and ANTI-FOREIGN routes to filing', () => {
  assert.deepEqual(validateAntitrustV1SurfaceDispositions(), {
    schema_version: 'CANONICAL_V2_ANTITRUST_V1_SURFACE_DISPOSITION/V1',
    authority_state: 'NONE',
    operation_state: 'NOT_ACTIVE_TEST_ONLY',
    surface_count: 13,
    inventory_complete: true,
  });
  assert.deepEqual(dispositionForV1Surface('ANTI-FOREIGN').governed_targets, ['ANTI-FILING', 'ANTI-STRATEGY', 'ANTI-COOPERATE', 'ANTI-INFO', 'ANTI-NOTIFY']);
  assert.equal(dispositionForV1Surface('ANTI-FOREIGN').residual_disposition, 'EXACT_OPEN_WORLD_EVIDENCE');
  assert.deepEqual(dispositionForV1Surface('ANTI-INTERIM').external_targets, ['EMPLOYEE_MATTERS', 'IOC']);
  assert.deepEqual(dispositionForV1Surface('ANTI-INTERIM').conditional_routes.map(({ target }) => target), ['ANTI-NOACTION', 'ANTI-BURDEN', 'ANTI-STRATEGY', 'EMPLOYEE_MATTERS', 'IOC']);
  assert.equal(dispositionForV1Surface('ANTI-INTERIM').residual_disposition, 'EXACT_OPEN_WORLD_EVIDENCE');
  assert.deepEqual(dispositionForV1Surface('ANTI-TIMING').governed_targets, ['ANTI-AGREEMENTS']);
  assert.throws(() => validateAntitrustV1SurfaceDispositions(SURFACE_DISPOSITIONS.slice(1)), /MISSING/);
  assert.throws(() => validateAntitrustV1SurfaceDispositions([...SURFACE_DISPOSITIONS, SURFACE_DISPOSITIONS[0]]), /DUPLICATE/);
  const droppedForeignResidual = SURFACE_DISPOSITIONS.map((entry) => (
    entry.v1_surface === 'ANTI-FOREIGN' ? { ...entry, residual_disposition: null } : entry
  ));
  assert.throws(() => validateAntitrustV1SurfaceDispositions(droppedForeignResidual), /TAMPERED/);
  const changedTarget = SURFACE_DISPOSITIONS.map((entry) => (
    entry.v1_surface === 'ANTI-FOREIGN' ? { ...entry, governed_targets: ['ANTI-FILING'] } : entry
  ));
  assert.throws(() => validateAntitrustV1SurfaceDispositions(changedTarget), /TAMPERED/);

  const routed = reclassifyAntitrustV1Card({
    card: { provision_subtype: 'ANTI-FOREIGN', primary_quote: 'Parent shall file under the German FDI Act and consult with the Company.' },
    atomic_facts: [{ atomic_fact: 'NAMED_REGIME_FILING_OR_DEADLINE', exact_quote: 'Parent shall file under the German FDI Act' }],
  });
  assert.equal(routed.governed_routes[0].target, 'ANTI-FILING');
  assert.equal(routed.exact_open_world_residuals[0].exact_quote, ' and consult with the Company.');
  assert.equal(routed.exact_open_world_residuals[0].source_start, 42);
  assert.equal(routed.operation_state, 'NOT_ACTIVE_TEST_ONLY');
  const fullCard = reclassifyAntitrustV1Card({
    card: {
      provision_subtype: 'ANTI-FOREIGN',
      primary_quote: 'Parent shall file under the German FDI Act.',
      region_full_text: 'Parent shall file under the German FDI Act. Company shall notify Parent of any regulator contact.',
    },
    atomic_facts: [{
      atomic_fact: 'NAMED_REGIME_FILING_OR_DEADLINE',
      exact_quote: 'Parent shall file under the German FDI Act.',
    }],
  });
  assert.equal(fullCard.exact_open_world_residuals[0].exact_quote, ' Company shall notify Parent of any regulator contact.');
  const nullRouted = reclassifyAntitrustV1Card({ card: { provision_subtype: null, primary_quote: 'Unclassified regulatory text.' } });
  assert.equal(nullRouted.source_surface, 'UNCLASSIFIED_NULL_SUBTYPE');
  assert.equal(nullRouted.exact_open_world_residuals[0].exact_quote, 'Unclassified regulatory text.');
});

test('approved antitrust design keeps foreign and interim cards as terminal content reclassification', () => {
  const design = fs.readFileSync(DESIGN_PATH, 'utf8');
  for (const required of [
    'Ben approved the expanded antitrust package on 2026-08-04.',
    '`ANTI-AGREEMENTS` owns timing agreements and withdrawal/refiling.',
    '`ANTI-FOREIGN` is retired as a concept.',
    'obligation or deadline becomes `ANTI-FILING`, with one exact named regime',
    '`ANTI-INTERIM` is retired as a concept.',
    '`ANTI-NOACTION`, `ANTI-BURDEN`, `ANTI-STRATEGY`, Employee Matters or IOC',
    'HSR remains separate. A mixed clause can produce multiple facts.',
    'Current production authority remains `NONE`.',
  ]) assert.ok(design.includes(required), `approved antitrust design is missing: ${required}`);

  const foreign = dispositionForV1Surface('ANTI-FOREIGN');
  const interim = dispositionForV1Surface('ANTI-INTERIM');
  assert.equal(foreign.disposition, 'RETIRED_CONTENT_RECLASSIFY');
  assert.ok(foreign.governed_targets.includes('ANTI-FILING'));
  assert.equal(interim.disposition, 'RETIRED_CONTENT_RECLASSIFY');
});

test('deal compare publishes every new antitrust field with its direct type', () => {
  const fields = fieldsForCompareCell('ANTITRUST_REGULATORY', ['all']);
  for (const key of [
    'burdenBaseline', 'divestitureCapAmount', 'divestitureCapCurrency', 'hsrFilingDeadlineDays',
    'hsrFilingDeadlineDayKind', 'regulatoryFilingFacts', 'regulatoryFilingRegimes',
    'regulatoryFilingTimingStandard', 'regulatoryFilingFixedDate',
    'regulatoryStrategyControlHolder', 'regulatoryStrategyScope',
    'consultationRightHolder', 'regulatoryCooperationRequired',
    'regulatoryInformationProtections', 'regulatoryInformationProtection', 'regulatoryNotificationRequired',
    'regulatoryNotificationTiming',
    'pullRefileProvisoDays', 'pullRefileProvisoDayKind',
    'regulatoryNonImpedimentRequired', 'regulatoryProhibitedAction',
    'regulatoryImpairmentEffect',
  ]) assert.ok(fields.includes(key), `missing compare field: ${key}`);

  const provision = { features: {
    regulatoryFilingFacts: [{ factKind: 'TIMING_STANDARD', filingRegime: 'German FDI Act', timingStandard: 'PROMPTLY' }],
    regulatoryFilingTimingStandard: 'AS_PROMPTLY_AS_PRACTICABLE',
    regulatoryInformationProtections: ['OUTSIDE_COUNSEL_ONLY', 'LEGAL_RESTRICTION'],
    regulatoryInformationProtection: 'OUTSIDE_COUNSEL_ONLY',
    regulatoryNotificationTiming: 'promptly',
    regulatoryNonImpedimentRequired: true,
    pullRefileProvisoDays: '2',
  } };
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryFilingTimingStandard').def.type, 'enum-or-list');
  assert.deepEqual(provisionFieldValue({ ai_metadata: { features: {
    regulatoryFilingTimingStandard: ['AS_PROMPTLY_AS_PRACTICABLE', 'FIXED_DATE'],
  } } }, 'ANTITRUST_REGULATORY', 'regulatoryFilingTimingStandard').value, [
    'AS_PROMPTLY_AS_PRACTICABLE', 'FIXED_DATE',
  ]);
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryFilingFacts').def.type, 'structured-list');
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryInformationProtections').def.type, 'structured-list');
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryInformationProtection').def.type, 'enum');
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryNotificationTiming').def.type, 'string');
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'regulatoryNonImpedimentRequired').def.type, 'boolean');
  assert.equal(provisionFieldValue(provision, 'ANTITRUST_REGULATORY', 'pullRefileProvisoDays').def.type, 'duration');
  assert.equal(provisionFieldValue({ features: { burdenBaseline: 'TARGET_ONLY' } }, 'ANTITRUST_REGULATORY', 'burdenBaseline').def.type, 'enum');
});

test('real Skechers bytes produce separate cooperation, information, notification, strategy, consultation and non-impediment claims', async () => {
  const source = skechersSource();
  const cooperationQuote = exactSpan(
    source,
    'Each of Parent and the Company will use reasonable efforts to (A) cooperate and coordinate',
    'with the other in the making of such filings;',
  );
  const informationQuote = exactSpan(
    source,
    'the Company and the Buyer Parties shall (and shall cause their respective Affiliates to), subject to any restrictions under applicable laws, (i) promptly notify',
    'before sharing any information provided to any Governmental Authority with another Party on an “outside counsel” only basis.',
  );
  const strategyQuote = exactSpan(
    source,
    'Parent shall have the right to control and (having taken into consideration in good faith all comments, proposals and suggestions made by the Company) direct',
    'including in dealing with any Governmental Authority with respect thereto.',
  );
  const noActionQuote = exactSpan(
    source,
    'none of the Company, Parent or Merger Sub (or any of their respective Affiliates) shall enter into any agreement, transaction or any agreement to effect any transaction',
    'obtain all other authorizations, consents, Orders and approvals of Governmental Authorities necessary for the consummation of the Transactions in accordance with the terms and conditions of this Agreement.',
  );
  const assertions = [
    assertion('COOPERATION_OBLIGATION', cooperationQuote, true, { cooperation_scope_ref: 'the making of such filings' }),
    assertion('INFORMATION_SHARING_OBLIGATION', informationQuote, true, {
      obligor_party: 'the Company and the Buyer Parties',
      information_scope_ref: 'copies of (or, in the case of oral communications, advise the others of the contents of) any material communication',
      information_protection_kinds: ['LEGAL_RESTRICTION', 'OUTSIDE_COUNSEL_ONLY', 'VALUATION_REDACTION', 'PRIVILEGE_REDACTION'],
    }),
    assertion('NOTIFICATION_OBLIGATION', informationQuote, true, {
      obligor_party: 'the Company and the Buyer Parties',
      notification_event_ref: 'any material communication received by such Person from a Governmental Authority in connection with the Merger',
      notification_timing_ref: 'promptly',
    }),
    assertion('STRATEGY_CONTROL', strategyQuote, 'PARENT_CONTROL', {
      obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent',
      control_holder_party: 'Parent', strategy_scope_ref: 'process, strategy and determinations',
    }),
    assertion('CONSULTATION_RIGHT', strategyQuote, 'GOOD_FAITH_VIEWS', {
      obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent', right_holder_party: 'the Company',
    }),
    assertion('NON_IMPEDIMENT_COVENANT', noActionQuote, true, {
      obligor_party: 'none of the Company, Parent or Merger Sub (or any of their respective Affiliates)',
      prohibited_action_ref: 'enter into any agreement, transaction or any agreement to effect any transaction',
      impairment_effect_ref: 'materially and adversely affect or materially delay',
    }),
  ];
  const contract = compileFixtureContractV36();
  let livePrompt = null;
  const provider = createAnthropicProvider({
    maxRetries: 0,
    client: { messages: { create: async (request) => {
      livePrompt = request.messages[0].content;
      return { id: 'skechers-provider-response', content: [{ text: JSON.stringify({ regulatory_efforts_assertions: assertions, open_world_candidates: [] }) }] };
    } } },
  });
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: ['6.2'],
    section_family_assignments: [{ section_reference: '6.2', family_id: 'ANTITRUST_REGULATORY' }],
    contract_bundle: contract,
    definitions: { known_definitions: [] },
    provider,
  });
  assert.match(livePrompt, /MANDATORY_DEFEND/);
  assert.match(livePrompt, /burden_term_ref/);
  assert.match(livePrompt, /information_protection_kinds/);
  assert.match(livePrompt, /notification_timing_ref/);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok), JSON.stringify(receipt.compiled_candidates, null, 2));
  assert.equal(receipt.compiled_candidates.length, assertions.length, JSON.stringify(receipt.evidence_residuals, null, 2));
  const dealId = 'skechers-antitrust-expanded';
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contract,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, { dealKey: dealId, dealAdmissionId: sha256Hex(`deal-admission:${dealId}`) }),
  });
  assert.ok(resolution.review_queue.every((item) => item.has_resolution && item.reasons.length === 0), JSON.stringify(resolution.review_queue, null, 2));
  assert.equal(resolution.resolved.length, assertions.length, JSON.stringify({ review: resolution.review_queue, open: resolution.open_world, residuals: resolution.residuals }, null, 2));
  const definitions = new Set(resolution.resolved.map(({ resolved_claim_definition_key: key }) => key));
  for (const key of ['REGULATORY_COOPERATION_OBLIGATION', 'REGULATORY_INFORMATION_SHARING_OBLIGATION', 'REGULATORY_NOTIFICATION_OBLIGATION', 'REGULATORY_STRATEGY_CONTROL', 'REGULATORY_CONSULTATION_RIGHT', 'REGULATORY_NON_IMPEDIMENT_COVENANT']) assert.equal(definitions.has(key), true, key);

  const projection = projectAntitrustProductSurfaces({ resolution, deal_id: dealId });
  const subtypes = new Set(projection.cards.map(({ provision_subtype: subtype }) => subtype));
  for (const subtype of ['ANTI-COOPERATE', 'ANTI-INFO', 'ANTI-NOTIFY', 'ANTI-STRATEGY', 'ANTI-CONSULT', 'ANTI-NOACTION']) assert.equal(subtypes.has(subtype), true, subtype);
  const config = await import('../components/review/table-configs/antitrust-regulatory.config.js');
  const mappedRows = config.mappedAntitrustRows(projection.cards);
  const rowIds = new Set(mappedRows.map(({ id }) => id));
  for (const id of ['antitrust-regulatory-cooperation', 'antitrust-regulatory-information-sharing', 'antitrust-regulatory-notification', 'antitrust-regulatory-strategy-control', 'antitrust-regulatory-consultation', 'antitrust-regulatory-clear-skies']) assert.equal(rowIds.has(id), true, id);
  const infoLabels = mappedRows.find(({ id }) => id === 'antitrust-regulatory-information-sharing').signals.map(({ label }) => label);
  assert.ok(infoLabels.some((label) => label.includes('LEGAL_RESTRICTION') && label.includes('OUTSIDE_COUNSEL_ONLY') && label.includes('VALUATION_REDACTION') && label.includes('PRIVILEGE_REDACTION')));
  const notifyLabels = mappedRows.find(({ id }) => id === 'antitrust-regulatory-notification').signals.map(({ label }) => label);
  assert.ok(notifyLabels.includes('promptly'));

  const compare = executeDealCompare({ deal_ids: [dealId], provision_types: ['ANTITRUST_REGULATORY'], included_field_groups: ['all'], highlight_deltas: false }, {
    deals: [{ id: dealId, acquirer: 'Parent', target: 'Skechers', metadata: {} }],
    provisions: projection.cards,
  });
  const fields = new Map(compare.rows[0].cells[0].key_fields.map(({ field, value }) => [field, value]));
  assert.equal(fields.get('regulatoryCooperationRequired'), true);
  assert.deepEqual(fields.get('regulatoryInformationProtections'), ['LEGAL_RESTRICTION', 'OUTSIDE_COUNSEL_ONLY', 'VALUATION_REDACTION', 'PRIVILEGE_REDACTION']);
  assert.equal(fields.get('regulatoryNotificationRequired'), true);
  assert.equal(fields.get('regulatoryNotificationTiming'), 'promptly');
  assert.equal(fields.get('regulatoryStrategyControlHolder'), 'Parent');
  assert.equal(fields.get('consultationRightHolder'), 'the Company');
  assert.equal(fields.get('regulatoryNonImpedimentRequired'), true);
});

test('filing timing, HSR day kind, provisos, burden baselines and currency stay exact and non-derived', () => {
  const resolved = (id, conceptKey, definitionKey, value, quote, attributes, party = PARENT_REGULATORY_PARTY) => ({
    resolved_claim_definition_key: definitionKey,
    concept_key: conceptKey,
    section_reference: '6.2',
    party,
    provision_instance: { provision_instance_id: `provision:${id}`, party },
    claim: { claim_revision_id: `claim:${id}`, raw_value: quote, canonical_value: value, attributes },
  });
  const projection = projectAntitrustProductSurfaces({
    deal_id: 'antitrust-exact-boundaries',
    resolution: { resolved: [
      resolved('hsr-calendar', 'ANTI-FILING', 'HSR_FILING_DEADLINE_DAYS', '10', 'Parent shall file under the HSR Act within ten (10) calendar days.', { filing_regime_ref: 'HSR Act', day_kind: 'CALENDAR' }),
      resolved('foreign-qual', 'ANTI-FILING', 'REGULATORY_FILING_TIMING_STANDARD', 'AS_PROMPTLY_AS_PRACTICABLE', 'Parent shall file under the German FDI Act as promptly as practicable.', { filing_regime_ref: 'German FDI Act', timing_relation: 'as promptly as practicable' }),
      resolved('foreign-fixed', 'ANTI-FILING', 'REGULATORY_FILING_TIMING_STANDARD', 'FIXED_DATE', 'Parent shall file under the FCC Rules no later than December 31, 2026.', { filing_regime_ref: 'FCC Rules', fixed_date_ref: 'December 31, 2026' }),
      resolved('cap-eur', 'ANTI-BURDEN', 'REGULATORY_DIVESTITURE_CAP_AMOUNT', '10000000', 'Parent shall not be required to accept a remedy above €10,000,000.', { currency: 'EUR' }),
      resolved('cap-usd-decimal', 'ANTI-BURDEN', 'REGULATORY_DIVESTITURE_CAP_AMOUNT', '1500000.50', 'Parent shall not be required to accept a remedy above $1,500,000.50.', { currency: 'USD' }),
      resolved('baseline', 'ANTI-BURDEN', 'REGULATORY_BURDEN_COMMITMENT', 'BURDENSOME_CONDITION', 'Parent shall not be required to accept a Detriment measured against the Company and its Subsidiaries, taken as a whole.', { burden_term_ref: 'Detriment', burden_baseline: 'TARGET_ONLY', burden_baseline_ref: 'the Company and its Subsidiaries, taken as a whole' }),
      resolved('refile', 'ANTI-AGREEMENTS', 'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION', 'MUTUAL_CONSENT', 'Neither party shall withdraw and refile without consent, provided Parent may withdraw if it refiles within 2 business days.', { withdrawal_exception_ref: 'provided Parent may withdraw if it refiles within 2 business days', withdrawal_refile_period_days: '2', withdrawal_refile_day_kind: 'BUSINESS' }, MUTUAL_REGULATORY_PARTY),
    ], open_world: [] },
  });
  const hsr = projection.cards.find((card) => card.id === 'provision:hsr-calendar');
  assert.equal(hsr.features.hsrFilingDeadlineDays, 10);
  assert.equal(hsr.features.hsrFilingDeadlineDayKind, 'CALENDAR');
  assert.equal(Object.hasOwn(hsr.features, 'hsrFilingDeadlineBusinessDays'), false);
  const eur = projection.cards.find((card) => card.id === 'provision:cap-eur');
  assert.equal(eur.features.divestitureCapAmount, '10000000');
  assert.equal(eur.features.divestitureCapCurrency, 'EUR');
  assert.equal(Object.hasOwn(eur.features, 'divestitureCap'), false);
  assert.equal(Object.hasOwn(eur.features, 'derivedUsdAmount'), false);
  assert.equal(provisionFieldValue(eur, 'ANTITRUST_REGULATORY', 'divestitureCap').value, null);
  const usdDecimal = projection.cards.find((card) => card.id === 'provision:cap-usd-decimal');
  assert.equal(usdDecimal.features.divestitureCapAmount, '1500000.50');
  assert.equal(usdDecimal.features.divestitureCap, 1500000.5);
  assert.equal(provisionFieldValue(usdDecimal, 'ANTITRUST_REGULATORY', 'divestitureCap').value, 1500000.5);
  const refile = projection.cards.find((card) => card.id === 'provision:refile');
  assert.equal(refile.features.pullRefileProvisoDays, '2');
  assert.equal(refile.features.pullRefileProvisoDayKind, 'BUSINESS');
  const timing = projection.cards.filter((card) => card.provision_subtype === 'ANTI-FILING').map((card) => card.features.regulatoryFilingTimingStandard).filter(Boolean).sort();
  assert.deepEqual(timing, ['AS_PROMPTLY_AS_PRACTICABLE', 'FIXED_DATE']);
});

test('burden baselines are mutually exclusive at resolution', async () => {
  async function resolveBaseline({ quote, obligor, baseline, baselineRef }) {
    const contract = compileFixtureContractV36();
    const provider = createAnthropicProvider({
      maxRetries: 0,
      client: { messages: { create: async () => ({
        id: `baseline-${baseline}`,
        content: [{ text: JSON.stringify({
          regulatory_efforts_assertions: [assertion('BURDEN_COMMITMENT', quote, 'BURDENSOME_CONDITION', {
            obligor_party_scope: 'ONE_PARTY',
            obligor_party: obligor,
            burden_term_ref: 'Detriment',
            burden_baseline: baseline,
            burden_baseline_ref: baselineRef,
          })],
          open_world_candidates: [],
        }) }],
      }) } },
    });
    const source = `Section 6.2 Regulatory Matters.\n${quote}`;
    const receipt = await runNativeExtraction({
      source_text: source,
      document_hash: sha256Hex(Buffer.from(source, 'utf8')),
      section_references: ['6.2'],
      section_family_assignments: [{ section_reference: '6.2', family_id: 'ANTITRUST_REGULATORY' }],
      contract_bundle: contract,
      definitions: { known_definitions: [] },
      provider,
    });
    return resolveCandidates({
      run_receipt: receipt,
      contract_vocabulary: contract,
      admitted_source_context: buildIdentityAdmittedSourceContext(source, {
        dealKey: `baseline-${baseline}-${sha256Hex(quote).slice(0, 8)}`,
        dealAdmissionId: sha256Hex(`admission:${quote}:${baseline}`),
      }),
    });
  }

  const targetRef = 'the Company and its Subsidiaries, taken as a whole';
  const target = await resolveBaseline({
    quote: `Parent shall not be required to accept a Detriment measured against ${targetRef}.`,
    obligor: 'Parent', baseline: 'TARGET_ONLY', baselineRef: targetRef,
  });
  assert.equal(target.resolved.length, 1);

  const buyerRef = 'Parent and its Subsidiaries, taken as a whole';
  const buyer = await resolveBaseline({
    quote: `The Company shall not be required to accept a Detriment measured against ${buyerRef}.`,
    obligor: 'The Company', baseline: 'BUYER_ONLY', baselineRef: buyerRef,
  });
  assert.equal(buyer.resolved.length, 1);

  const combinedRef = 'Parent and the Company and their respective Subsidiaries, taken as a whole';
  const combined = await resolveBaseline({
    quote: `Parent shall not be required to accept a Detriment measured against ${combinedRef}.`,
    obligor: 'Parent', baseline: 'COMBINED_ENTITY', baselineRef: combinedRef,
  });
  assert.equal(combined.resolved.length, 1);

  const wrongTarget = await resolveBaseline({
    quote: `Parent shall not be required to accept a Detriment measured against ${combinedRef}.`,
    obligor: 'Parent', baseline: 'TARGET_ONLY', baselineRef: combinedRef,
  });
  assert.equal(wrongTarget.resolved.length, 0);
  assert.ok(wrongTarget.review_queue.some(({ reasons }) => reasons.includes('BURDEN_BASELINE_UNCORROBORATED')));

  const sizeRef = 'the Company, notionally a business the size of Parent, taken as a whole';
  const wrongSizeAsTarget = await resolveBaseline({
    quote: `Parent shall not be required to accept a Detriment measured against ${sizeRef}.`,
    obligor: 'Parent', baseline: 'TARGET_ONLY', baselineRef: sizeRef,
  });
  assert.equal(wrongSizeAsTarget.resolved.length, 0);
  assert.ok(wrongSizeAsTarget.review_queue.some(({ reasons }) => reasons.includes('BURDEN_BASELINE_UNCORROBORATED')));
});

test('unmatched expanded antitrust output remains exact open-world evidence', () => {
  const quote = 'Parent shall discuss any other regulatory issue with the Company.';
  const resolution = {
    resolved: [],
    open_world: [{
      closure_id: 'open-antitrust-1', section_reference: '6.2', raw_value: quote,
      reason: 'NATIVE_OPEN_WORLD_PROPOSAL', claim_definition_key: 'OPEN_WORLD_CLAIM',
      extraction_provenance: { prompt_id: 'native-producer-antitrust-regulatory/v1' },
    }],
  };
  const projection = projectAntitrustProductSurfaces({ resolution, deal_id: 'antitrust-open-world' });
  assert.equal(projection.open_items.length, 1);
  assert.equal(projection.cards[0].primary_quote, quote);
  assert.equal(projection.cards[0].canonical_v2_lineage.source, 'CANONICAL_V2_OPEN_WORLD_EVIDENCE');
});

test('an unresolved antitrust exactness rejection remains visible in Review and open items', async () => {
  const quote = 'Parent shall control regulatory strategy after consultation with the Company.';
  const resolution = {
    resolved: [],
    open_world: [],
    review_queue: [{
      closure_id: 'review-antitrust-1',
      section_reference: '6.2',
      raw_value: quote,
      reasons: ['STRATEGY_SHAPE_NOT_EXACT'],
      has_resolution: false,
      concept_family: 'ANTI-STRATEGY',
    }],
  };
  const projection = projectAntitrustProductSurfaces({ resolution, deal_id: 'antitrust-review-queue' });
  assert.equal(projection.open_items.length, 1);
  assert.equal(projection.open_items[0].evidence_bucket, 'REVIEW_QUEUE');
  assert.equal(projection.cards.length, 1);
  assert.equal(projection.cards[0].primary_quote, quote);
  assert.equal(projection.cards[0].canonical_v2_lineage.reason, 'STRATEGY_SHAPE_NOT_EXACT');
  assert.equal(projection.cards[0].features.antitrustUnresolvedEvidence, true);
  assert.equal(projection.cards[0].features.antitrustReviewReason, 'STRATEGY_SHAPE_NOT_EXACT');
  const { mappedAntitrustRows } = await import('../components/review/table-configs/antitrust-regulatory.config.js');
  const rows = mappedAntitrustRows(projection.cards);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Needs review');
  assert.equal(rows[0].detail, 'STRATEGY_SHAPE_NOT_EXACT');
  assert.equal(rows[0].evidence, quote);
});

test('modern Review renders burden architecture, exact amount, currency and baseline', async () => {
  const resolved = (id, definitionKey, value, quote, attributes) => ({
    resolved_claim_definition_key: definitionKey,
    concept_key: 'ANTI-BURDEN',
    section_reference: '6.2',
    party: PARENT_REGULATORY_PARTY,
    provision_instance: { provision_instance_id: 'provision:burden-review', party: PARENT_REGULATORY_PARTY },
    claim: { claim_revision_id: `claim:${id}`, raw_value: quote, canonical_value: value, attributes },
  });
  const baselineRef = 'the Company and its Subsidiaries, taken as a whole';
  const architectureQuote = `Parent shall not accept a remedy above USD 10,000,000 measured against ${baselineRef}.`;
  const projection = projectAntitrustProductSurfaces({
    deal_id: 'burden-review',
    resolution: { resolved: [
      resolved('architecture', 'REGULATORY_BURDEN_COMMITMENT', 'CAPPED_QUANTITATIVE', architectureQuote, {
        burden_baseline: 'TARGET_ONLY', burden_baseline_ref: baselineRef,
      }),
      resolved('amount', 'REGULATORY_DIVESTITURE_CAP_AMOUNT', '10000000', architectureQuote, { currency: 'USD' }),
    ] },
  });
  const { mappedAntitrustRows } = await import('../components/review/table-configs/antitrust-regulatory.config.js');
  const row = mappedAntitrustRows(projection.cards).find(({ id }) => id === 'antitrust-regulatory-divestiture-cap');
  assert.ok(row);
  assert.deepEqual(row.signals.map(({ label }) => label), [
    'Divestiture cap: quantitative',
    'USD 10000000',
    'Target only',
  ]);
  assert.equal(row.detail, baselineRef);
});
