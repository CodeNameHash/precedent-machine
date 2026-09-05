'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const {
  buildAgreementDraft,
  canonicalLinkSourceSpanIds,
  canonicalProposalSourceSpanIds,
  canonicalRoutingDisagreements,
  canonicalRoutingDisposition,
  canonicalRoutingSet,
  compileResidualPass,
  compileRouting,
  sealSectionResult,
  validateAgreementDraft,
} = require('../lib/product/agreement-draft');
const { createProductAnalysisHandler } = require('../lib/product/analysis-handler');
const { callKey, createRecordedModelAdapter } = require('../lib/product/model-adapter');
const { withSectionLeaseHeartbeat } = require('../lib/product/analysis-runner');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { buildSourceClosure, substantiveSections } = require('../lib/product/source-context');

const ROOT = path.resolve(__dirname, '..');
const CONCHO_URL = 'https://www.sec.gov/Archives/edgar/data/1358071/000119312520271642/d32162dex21.htm';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts/product/legal-schema.v1.json'), 'utf8'));

async function conchoSource() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/concho-first-live-run/concho-raw-fetched.htm'));
  const fetchImpl = async () => ({
    status: 200,
    url: CONCHO_URL,
    headers: new Headers({ 'content-type': 'text/html', 'content-length': String(raw.length) }),
    body: null,
    arrayBuffer: async () => raw,
  });
  return createSecIntakeAdapter({ fetchImpl, clock: () => new Date('2026-09-04T12:00:00Z') }).intake({ url: CONCHO_URL });
}

function proposal(clientRef, groupRef, familyKey, subtypeKey, factType, statement, roles, quote, value = null, occurrence = 0) {
  return {
    client_ref: clientRef,
    group_ref: groupRef,
    family_key: familyKey,
    subtype_key: subtypeKey,
    fact_type: factType,
    statement,
    roles,
    value,
    evidence_quotes: [{ quote, occurrence }],
  };
}

function group(clientRef, familyKey, subtypeKey) {
  return { client_ref: clientRef, family_key: familyKey, subtype_key: subtypeKey };
}

function extractionResponse(sectionReference, families, sourceClosure) {
  const proposals = [];
  const groups = [];
  const links = [];
  if (sectionReference === '6.3') {
    groups.push(
      group('g-ns-prohibited', 'NO_SHOP', 'PROHIBITED_ACTION'),
      group('g-ns-exception', 'NO_SHOP', 'EXCEPTION_PREREQUISITE'),
      group('g-ns-notice', 'NO_SHOP', 'NOTICE_PERIOD'),
      group('g-ns-initial', 'NO_SHOP', 'INITIAL_MATCH_PERIOD'),
      group('g-ns-subsequent', 'NO_SHOP', 'SUBSEQUENT_MATCH_PERIOD'),
      group('g-ns-change', 'NO_SHOP', 'RECOMMENDATION_CHANGE'),
    );
    proposals.push(
      proposal('p-ns-prohibited', 'g-ns-prohibited', 'NO_SHOP', 'PROHIBITED_ACTION', 'PROHIBITED_ACTION',
        'The Company must not solicit or encourage a Company Competing Proposal.',
        { covenant_obligor: 'Company', prohibited_action: 'solicit or encourage a Company Competing Proposal' },
        'initiate, solicit, propose, knowingly encourage, or knowingly facilitate any inquiry or the making of any proposal or offer that constitutes, or could reasonably be expected to result in, a Company Competing Proposal'),
      proposal('p-ns-exception', 'g-ns-exception', 'NO_SHOP', 'EXCEPTION_PREREQUISITE', 'EXCEPTION_PREREQUISITE',
        'The Company may furnish information only after the stated proposal, confidentiality, adviser and fiduciary prerequisites are met.',
        { permitted_actor: 'Company and its Representatives', permitted_action: 'furnish information or engage in discussions', prerequisite: 'a bona fide written unsolicited proposal that did not arise from breach, plus the stated confidentiality, adviser and fiduciary findings' },
        'the Company receives a bona fide written Company Competing Proposal from such Person that was not solicited at any time following the execution of this Agreement'),
      proposal('p-ns-notice', 'g-ns-notice', 'NO_SHOP', 'NOTICE_PERIOD', 'NOTICE_PERIOD',
        'The Company must notify Parent within the shorter of one Business Day or 48 hours.',
        { notice_giver: 'Company', notice_recipient: 'Parent', notice_trigger: 'receipt of a Company Competing Proposal or related inquiry', period_value: '1', period_unit: 'BUSINESS_DAYS' },
        'within the shorter of one (1) Business Day or 48 hours', '1'),
      proposal('p-ns-initial', 'g-ns-initial', 'NO_SHOP', 'INITIAL_MATCH_PERIOD', 'INITIAL_MATCH_PERIOD',
        'The Company must give Parent three Business Days before a recommendation change.',
        { covenant_obligor: 'Company', beneficiary: 'Parent', period_value: '3', period_unit: 'BUSINESS_DAYS', restricted_action: 'effect a Company Change of Recommendation' },
        'three (3) Business Days in advance', '3'),
      proposal('p-ns-subsequent', 'g-ns-subsequent', 'NO_SHOP', 'SUBSEQUENT_MATCH_PERIOD', 'SUBSEQUENT_MATCH_PERIOD',
        'A material amendment starts a reduced one Business Day notice period.',
        { covenant_obligor: 'Company', beneficiary: 'Parent', amendment_trigger: 'material amendment or modification to the superior proposal', period_value: '1', period_unit: 'BUSINESS_DAYS' },
        'reduced to one (1) Business Day', '1'),
      proposal('p-ns-change', 'g-ns-change', 'NO_SHOP', 'RECOMMENDATION_CHANGE', 'RECOMMENDATION_CHANGE',
        'The Company Board may change its recommendation for a qualifying superior proposal only after the stated process.',
        { decision_maker: 'Company Board', action: 'effect a Company Change of Recommendation', permitted_trigger: 'a qualifying bona fide written Company Superior Proposal' },
        'the Company Board may effect a Company Change of Recommendation'),
    );
    links.push({ from_ref: 'p-ns-exception', to_ref: 'p-ns-prohibited', relationship_type: 'EXCEPTS', source_span_ids: [] });
  }
  if (sectionReference === '8.1') {
    groups.push(
      group('g-t-mutual', 'TERMINATION', 'MUTUAL_CONSENT'),
      group('g-t-outside', 'TERMINATION', 'OUTSIDE_DATE'),
      group('g-t-cure', 'TERMINATION', 'BREACH'),
    );
    proposals.push(
      proposal('p-t-mutual', 'g-t-mutual', 'TERMINATION', 'MUTUAL_CONSENT', 'TERMINATION_RIGHT',
        'The Company and Parent may terminate by mutual written consent.',
        { terminating_parties: ['Company', 'Parent'], action: 'terminate', trigger: 'mutual consent', writing_requirement: true },
        '(a) by mutual written consent of the Company and Parent;'),
      proposal('p-t-outside', 'g-t-outside', 'TERMINATION', 'OUTSIDE_DATE', 'OUTSIDE_DATE',
        'Either party may terminate if the Merger is not completed by April 30, 2021, subject to the causation bar.',
        { terminating_party: 'either Party', action: 'terminate', outside_date: '2021-04-30', transaction_not_completed_condition: 'Merger not consummated', breach_bar: 'unavailable to a party whose material covenant failure caused the delay' },
        'if the Merger shall not have been consummated on or before 5:00 p.m. Houston time, on April 30, 2021', '2021-04-30'),
      proposal('p-t-cure', 'g-t-cure', 'TERMINATION', 'BREACH', 'CURE_OR_NOTICE_PERIOD',
        'A curable breach has a 30-day cure period, capped at two Business Days before the End Date.',
        { terminating_party: 'non-breaching Party', breaching_party: 'other Party', action: 'terminate', breach_subject: 'representation, warranty, covenant or other agreement', closing_condition_failure_standard: 'would cause a specified closing condition to fail', cure_period: '30 days', outside_date_cap: 'two Business Days before the End Date' },
        'thirty (30) days after the giving of written notice to the breaching Party of such breach', '30'),
    );
  }
  if (sectionReference === '8.3') {
    groups.push(
      group('g-f-trigger', 'TERMINATION_FEE', 'FEE_TRIGGER'),
      group('g-f-tail', 'TERMINATION_FEE', 'TAIL_PERIOD'),
      group('g-f-expense', 'TERMINATION_FEE', 'EXPENSE_REIMBURSEMENT'),
      group('g-f-interest', 'TERMINATION_FEE', 'LATE_INTEREST'),
    );
    proposals.push(
      proposal('p-f-trigger', 'g-f-trigger', 'TERMINATION_FEE', 'FEE_TRIGGER', 'FEE_TRIGGER',
        'The Company must pay Parent the Company Termination Fee after Parent terminates for a Company recommendation change or no-shop breach.',
        { payer: 'Company', payee: 'Parent', payment_action: 'pay the Company Termination Fee', trigger: 'Parent terminates under Section 8.1(c) or 8.1(e)', payment_deadline: 'three Business Days after notice' },
        'If Parent terminates this Agreement pursuant to Section 8.1(c) (Company Change of Recommendation) or Section 8.1(e) (No Solicitation by the Company), then the Company shall pay Parent the Company Termination Fee'),
      proposal('p-f-tail', 'g-f-tail', 'TERMINATION_FEE', 'TAIL_PERIOD', 'TAIL_PERIOD',
        'The tail period is 12 months after termination.',
        { period_value: '12', period_unit: 'MONTHS', period_start: 'termination date', qualifying_event: 'entry into or completion of a qualifying competing transaction' },
        'within twelve (12) months after the date of such termination', '12'),
      proposal('p-f-expense', 'g-f-expense', 'TERMINATION_FEE', 'EXPENSE_REIMBURSEMENT', 'EXPENSE_REIMBURSEMENT',
        'Each party ordinarily bears its own transaction expenses.',
        { payer: 'each Party', payee: 'itself or its providers', reimbursable_cost_scope: 'expenses of preparing for, entering into and carrying out the Agreement', cap_or_amount: 'own expenses' },
        'each Party shall pay its own expenses incident to preparing for, entering into and carrying out this Agreement'),
      proposal('p-f-interest', 'g-f-interest', 'TERMINATION_FEE', 'LATE_INTEREST', 'LATE_INTEREST',
        'Overdue payments accrue interest at 8% per annum from the due date until payment.',
        { payer: 'defaulting Party', overdue_payment: 'amount due under Section 8.3', interest_standard: '8% per annum', accrual_start: 'date payment was required' },
        'interest shall accrue on such amount from the date such payment was required to be paid pursuant to the terms of this Agreement until the date of payment at the rate of 8% per annum'),
    );
    links.push({ from_ref: 'p-f-tail', to_ref: 'p-f-trigger', relationship_type: 'QUALIFIES', source_span_ids: [] });
  }
  if (sectionReference === 'Annex-A') {
    groups.push(group('g-f-amount', 'TERMINATION_FEE', 'FEE_AMOUNT'));
    proposals.push(proposal('p-f-amount', 'g-f-amount', 'TERMINATION_FEE', 'FEE_AMOUNT', 'FEE_AMOUNT',
      'The Company Termination Fee is $300,000,000.',
      { payer: 'Company', payee: 'Parent', amount: '300000000', currency: 'USD', defined_term: 'Company Termination Fee' },
      '“Company Termination Fee” means $300,000,000.', '300000000'));
  }
  const coverage = {};
  const fact_type_coverage = {};
  for (const familyKey of families) {
    const family = schema.families.find((item) => item.family_key === familyKey);
    coverage[familyKey] = proposals.some((item) => item.family_key === familyKey) ? 'FOUND' : 'NOT_FOUND';
    fact_type_coverage[familyKey] = Object.fromEntries(family.required_fact_types.map((factType) => [
      factType,
      proposals.some((item) => item.family_key === familyKey && item.fact_type === factType) ? 'FOUND' : 'NOT_FOUND',
    ]));
  }
  const components = [
    ...sourceClosure.operative,
    ...sourceClosure.chapeau,
    ...sourceClosure.definitions,
    ...sourceClosure.cross_references,
    sourceClosure.full_section,
  ];
  for (const item of proposals) {
    for (const evidence of item.evidence_quotes) {
      const component = components.find((candidate) => candidate.exact_text.includes(evidence.quote));
      assert.ok(component, `synthetic quote is outside source closure for ${item.client_ref}`);
      evidence.source_span_id = component.span_id;
    }
  }
  return { proposals, groups, links, coverage, fact_type_coverage };
}

function createSyntheticConchoModel({ failAtCall = null } = {}) {
  const routes = new Map([
    ['6.3', ['NO_SHOP']],
    ['6.4', ['NO_SHOP']],
    ['8.1', ['TERMINATION']],
    ['8.2', ['TERMINATION']],
    ['8.3', ['TERMINATION_FEE']],
    ['Annex-A', ['TERMINATION_FEE']],
  ]);
  const calls = [];
  return {
    calls,
    async complete({ call_kind: kind, prompt_version: promptVersion, request }) {
      calls.push({ kind, promptVersion, request });
      if (failAtCall && calls.length === failAtCall) throw new Error('synthetic provider interruption');
      const sectionReference = request.section_reference || request.source_closure?.section_reference;
      const families = routes.get(sectionReference) || [];
      if (kind === 'EXTRACTION') {
        for (const familyKey of families) {
          const contract = schema.families.find((item) => item.family_key === familyKey);
          assert.deepEqual(request.response_contract.allowed_fact_types_by_family[familyKey], contract.required_fact_types);
          assert.deepEqual(request.response_contract.allowed_subtypes_by_family[familyKey], contract.subtypes.map((subtype) => subtype.subtype_key));
        }
      }
      const response = kind === 'ROUTING'
        ? {
          families,
          disposition: families.length ? 'FAMILY_ASSIGNED' : 'IMMATERIAL',
          rationale: families.length ? 'Synthetic semantic classification' : 'Synthetic classification outside the three-family slice',
          deterministic_disagreements: (request.deterministic_family_evidence || [])
            .filter((item) => !families.includes(item.section_family))
            .map((item) => ({ family_key: item.section_family, reason: 'Synthetic semantic review rejected the deterministic label.' })),
        }
        : kind === 'RESIDUAL'
          ? { paragraphs: request.paragraphs.map((paragraph) => ({
            source_span_id: paragraph.source_span_id,
            disposition: families.length ? 'KNOWN_FAMILY' : 'IMMATERIAL',
            family_keys: families,
            rationale: families.length ? 'Covered by a routed family.' : 'No material residual in this fixture.',
          })) }
          : extractionResponse(sectionReference, families, request.source_closure);
      return {
        provider_id: 'SYNTHETIC_TEST_PROVIDER',
        model_id: 'SYNTHETIC_LEGAL_MODEL/V1',
        raw_request: request,
        raw_response: response,
        response,
        input_tokens: 100,
        output_tokens: 50,
        cost_microusd: 25,
        duration_ms: 5,
      };
    },
  };
}

if (process.env.PRODUCT_PHASE2_HELPER_ONLY !== '1') {
test('routing identity canonicalises set order and reports invalid enum type and value', () => {
  assert.deepEqual(canonicalRoutingSet(['TERMINATION', 'NO_SHOP', 'TERMINATION'], 'routing.families'), ['NO_SHOP', 'TERMINATION']);
  assert.deepEqual(canonicalRoutingDisagreements([
    { family_key: 'TERMINATION', reason: 'second' },
    { family_key: 'NO_SHOP', reason: 'first' },
    { family_key: 'TERMINATION', reason: 'second' },
  ]), [
    { family_key: 'NO_SHOP', reason: 'first' },
    { family_key: 'TERMINATION', reason: 'second' },
  ]);
  assert.deepEqual(canonicalRoutingDisagreements([
    { family_key: 'none', reason: 'placeholder' },
    { family_key: 'NO_SHOP', reason: 'valid' },
  ]), [{ family_key: 'NO_SHOP', reason: 'valid' }]);
  assert.throws(() => canonicalRoutingDisagreements([null]), /ROUTING_DISAGREEMENT_SHAPE/);
  assert.throws(() => canonicalRoutingDisagreements([{ family_key: 'NO_SHOP', reason: 'valid', extra: true }]), /ROUTING_DISAGREEMENT_SHAPE/);
  assert.throws(() => canonicalRoutingDisagreements([{ family_key: 'NO_SHOP', reason: '' }]), /MODEL_RESPONSE_SHAPE/);

  const call = { model_call_id: 'm'.repeat(64) };
  const node = { node_id: 'n'.repeat(64), reference: '1.1' };
  const first = compileRouting({
    response: {
      families: ['TERMINATION', 'NO_SHOP', 'TERMINATION'],
      disposition: 'FAMILY_ASSIGNED', rationale: 'same',
      deterministic_disagreements: [
        { family_key: 'TERMINATION_FEE', reason: 'not present' },
        { family_key: 'CLOSING_CONDITIONS', reason: 'not present' },
        { family_key: 'TERMINATION_FEE', reason: 'not present' },
      ],
    },
    call, node, deterministicEvidence: [],
  });
  const second = compileRouting({
    response: {
      families: ['NO_SHOP', 'TERMINATION'],
      disposition: 'FAMILY_ASSIGNED', rationale: 'same',
      deterministic_disagreements: [
        { family_key: 'CLOSING_CONDITIONS', reason: 'not present' },
        { family_key: 'TERMINATION_FEE', reason: 'not present' },
      ],
    },
    call, node, deterministicEvidence: [],
  });
  assert.equal(first.section_routing_id, second.section_routing_id);
  assert.deepEqual(first.families, ['NO_SHOP', 'TERMINATION']);
  assert.equal(canonicalRoutingDisposition(['FAMILY_ASSIGNED']), 'FAMILY_ASSIGNED');
  assert.equal(canonicalRoutingDisposition(['IMMATERIAL', 'FAMILY_ASSIGNED'], ['NO_SHOP']), 'FAMILY_ASSIGNED');
  assert.deepEqual(canonicalRoutingDisposition(['IMMATERIAL', 'FAMILY_ASSIGNED'], []), ['IMMATERIAL', 'FAMILY_ASSIGNED']);
  assert.deepEqual(canonicalRoutingDisposition(['FAMILY_ASSIGNED', 'IMMATERIAL']), ['FAMILY_ASSIGNED', 'IMMATERIAL']);
  assert.deepEqual(canonicalRoutingDisposition(['NOT_ALLOWED']), ['NOT_ALLOWED']);
  const singleEnumArray = compileRouting({
    response: { families: ['NO_SHOP'], disposition: ['FAMILY_ASSIGNED'], rationale: 'same', deterministic_disagreements: [] },
    call, node, deterministicEvidence: [],
  });
  const scalarEnum = compileRouting({
    response: { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'same', deterministic_disagreements: [] },
    call, node, deterministicEvidence: [],
  });
  assert.equal(singleEnumArray.section_routing_id, scalarEnum.section_routing_id);
  const coherentPair = compileRouting({
    response: { families: ['NO_SHOP'], disposition: ['IMMATERIAL', 'FAMILY_ASSIGNED'], rationale: 'same', deterministic_disagreements: [] },
    call, node, deterministicEvidence: [],
  });
  assert.equal(coherentPair.section_routing_id, scalarEnum.section_routing_id);
  assert.throws(() => compileRouting({
    response: { families: [], disposition: ['FAMILY_ASSIGNED', 'IMMATERIAL'], deterministic_disagreements: [] },
    call, node, deterministicEvidence: [],
  }), /ROUTING_DISPOSITION: \{"type":"array","value":\["FAMILY_ASSIGNED","IMMATERIAL"\]\}/);
  assert.throws(() => compileRouting({
    response: { families: ['NO_SHOP'], disposition: ['FAMILY_ASSIGNED', 'UNRESOLVED_UNUSUAL_PROVISION'], deterministic_disagreements: [] },
    call, node, deterministicEvidence: [],
  }), /ROUTING_DISPOSITION/);
  assert.throws(() => compileRouting({
    response: {
      families: [], disposition: 'IMMATERIAL',
      deterministic_disagreements: [{ family_key: 'none', reason: 'placeholder' }],
    },
    call, node, deterministicEvidence: [{ section_family: 'NO_SHOP' }],
  }), /ROUTING_EVIDENCE_UNRECONCILED/);
});

test('section sealing deduplicates identical content-addressed components before persistence', () => {
  const issue = { issue_id: 'i'.repeat(64), code: 'SAME' };
  const sealed = sealSectionResult({
    node_id: 'n'.repeat(64), section_reference: '1.1',
    source_closure: { source_closure_id: 'c'.repeat(64), spans: [] },
    model_calls: [], spans: [], proposals: [], groups: [], links: [],
    issues: [issue, issue], coverage: [],
  });
  assert.deepEqual(sealed.issues, [issue]);
});

test('fact-link source span sets have stable identity across duplicates and permutations', () => {
  const base = {
    schema_version: 'PRODUCT_FACT_LINK/V1', from_proposal_id: 'a'.repeat(64),
    to_proposal_id: 'b'.repeat(64), relationship_type: 'QUALIFIES',
  };
  const first = { ...base, source_span_ids: canonicalLinkSourceSpanIds(['z'.repeat(64), 'c'.repeat(64), 'z'.repeat(64)]) };
  const second = { ...base, source_span_ids: canonicalLinkSourceSpanIds(['c'.repeat(64), 'z'.repeat(64)]) };
  assert.deepEqual(first.source_span_ids, ['c'.repeat(64), 'z'.repeat(64)]);
  assert.equal(require('../lib/canonical-v2/canonical-bytes').contentId('PRODUCT_FACT_LINK/V1', first),
    require('../lib/canonical-v2/canonical-bytes').contentId('PRODUCT_FACT_LINK/V1', second));
});

test('proposal citation span sets have stable identity across duplicates and permutations', () => {
  const base = {
    schema_version: 'PRODUCT_PROPOSAL/V1', fact_occurrence_id: 'o'.repeat(64),
    statement: 'Same fact', roles: {},
  };
  const first = { ...base, source_span_ids: canonicalProposalSourceSpanIds(['z'.repeat(64), 'c'.repeat(64), 'z'.repeat(64)]) };
  const second = { ...base, source_span_ids: canonicalProposalSourceSpanIds(['c'.repeat(64), 'z'.repeat(64)]) };
  assert.deepEqual(first.source_span_ids, ['c'.repeat(64), 'z'.repeat(64)]);
  assert.equal(require('../lib/canonical-v2/canonical-bytes').contentId('PRODUCT_PROPOSAL/V1', first),
    require('../lib/canonical-v2/canonical-bytes').contentId('PRODUCT_PROPOSAL/V1', second));
});

test('section lease heartbeat renews during work, stops cleanly and blocks late output after ownership loss', async () => {
  let renewals = 0;
  let commitFinished = false;
  let commitStarted = false;
  let renewalDuringCommit = false;
  const options = {
    runId: crypto.randomUUID(), claim: { node_id: 'n'.repeat(64), attempt_token: crypto.randomUUID() },
    workerId: 'worker', leaseSeconds: 0.3,
  };
  const result = await withSectionLeaseHeartbeat({
    ...options,
    store: { renewSectionLease: async () => {
      renewals += 1;
      if (commitStarted && !commitFinished) renewalDuringCommit = true;
    } },
    action: async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return 'done';
    },
    commit: async (value) => {
      commitStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 120));
      commitFinished = true;
      return value;
    },
  });
  assert.equal(result, 'done');
  assert.equal(commitFinished, true);
  assert.equal(renewalDuringCommit, false);
  assert.ok(renewals >= 2);
  assert.ok(renewals >= 1);
  const stoppedAt = renewals;
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.equal(renewals, stoppedAt);
  await assert.rejects(() => withSectionLeaseHeartbeat({
    ...options,
    store: { renewSectionLease: async () => { throw new Error('stale section attempt'); } },
    action: () => new Promise((resolve) => setTimeout(() => resolve('late output'), 180)),
    commit: () => assert.fail('lost lease must fence commit'),
  }), /SECTION_LEASE_LOST/);
});

test('section lease heartbeat drains a queued renewal before the final renewal and commit', async () => {
  let releaseQueued;
  let renewal = 0;
  let committed = false;
  const resultPromise = withSectionLeaseHeartbeat({
    runId: crypto.randomUUID(), claim: { node_id: 'q'.repeat(64), attempt_token: crypto.randomUUID() },
    workerId: 'worker', leaseSeconds: 0.3,
    store: { renewSectionLease: async () => {
      renewal += 1;
      if (renewal === 1) await new Promise((resolve) => { releaseQueued = resolve; });
    } },
    action: () => new Promise((resolve) => setTimeout(() => resolve('built'), 120)),
    commit: async (value) => { committed = true; return value; },
  });
  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.equal(committed, false);
  releaseQueued();
  assert.equal(await resultPromise, 'built');
  assert.equal(renewal, 2);
  assert.equal(committed, true);
});

test('residual pass preserves known replies and completes provider omissions as source-linked unresolved work', () => {
  const call = { model_call_id: 'm'.repeat(64) };
  const node = { node_id: 'n'.repeat(64), reference: '1.1' };
  const closure = { source_closure_id: 'c'.repeat(64) };
  const paragraphs = [{ span_id: 'a'.repeat(64) }, { span_id: 'b'.repeat(64) }];
  const completed = compileResidualPass({
    response: { paragraphs: [{
      source_span_id: paragraphs[0].span_id, disposition: 'IMMATERIAL', family_keys: [], rationale: 'Returned decision.',
    }] },
    call, node, closure, paragraphs,
  });
  assert.equal(completed.residualPass.dispositions.length, 2);
  assert.deepEqual(completed.residualPass.dispositions.map((item) => item.source_span_id), paragraphs.map((item) => item.span_id));
  assert.equal(completed.residualPass.dispositions[0].rationale, 'Returned decision.');
  assert.equal(completed.residualPass.dispositions[1].disposition, 'UNRESOLVED_UNUSUAL_PROVISION');
  assert.equal(completed.residualPass.dispositions[1].rationale, 'PROVIDER_OMITTED_REQUIRED_PARAGRAPH_DISPOSITION');
  assert.equal(completed.issues.length, 1);
  assert.deepEqual(completed.issues[0].source_span_ids, [paragraphs[1].span_id]);
  assert.equal(completed.coverage[1].state, 'UNRESOLVED');
  assert.equal(completed.coverage[1].model_call_id, call.model_call_id);

  const familySetFirst = compileResidualPass({
    response: { paragraphs: [{
      source_span_id: paragraphs[0].span_id, disposition: 'KNOWN_FAMILY',
      family_keys: ['TERMINATION', 'NO_SHOP', 'TERMINATION'], rationale: 'Known families.',
    }] },
    call, node, closure, paragraphs: [paragraphs[0]],
  });
  const familySetSecond = compileResidualPass({
    response: { paragraphs: [{
      source_span_id: paragraphs[0].span_id, disposition: 'KNOWN_FAMILY',
      family_keys: ['NO_SHOP', 'TERMINATION'], rationale: 'Known families.',
    }] },
    call, node, closure, paragraphs: [paragraphs[0]],
  });
  assert.equal(familySetFirst.residualPass.residual_pass_id, familySetSecond.residualPass.residual_pass_id);
  assert.deepEqual(familySetFirst.residualPass.dispositions[0].family_keys, ['NO_SHOP', 'TERMINATION']);

  assert.throws(() => compileResidualPass({
    response: { paragraphs: [
      { source_span_id: paragraphs[0].span_id, disposition: 'IMMATERIAL', family_keys: [], rationale: 'One.' },
      { source_span_id: paragraphs[0].span_id, disposition: 'IMMATERIAL', family_keys: [], rationale: 'Duplicate.' },
    ] },
    call, node, closure, paragraphs,
  }), /RESIDUAL_PARAGRAPH_DUPLICATE/);
  assert.throws(() => compileResidualPass({
    response: { paragraphs: [{ source_span_id: 'z'.repeat(64), disposition: 'IMMATERIAL', family_keys: [], rationale: 'Unknown.' }] },
    call, node, closure, paragraphs,
  }), /RESIDUAL_PARAGRAPH_UNKNOWN/);
});

test('source context follows transitive cross-references without importing policy machinery', () => {
  const text = [
    'AGREEMENT AND PLAN OF MERGER', '', 'ARTICLE I', 'TERMINATION', '',
    'Section 1.1. First.', 'Parent may terminate subject to Section 1.2.', '',
    'Section 1.2. Second.', 'The condition in Section 1.3 applies.', '',
    'Section 1.3. Third.', '“Deadline” means April 30, 2027.',
  ].join('\n');
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sha256('closure-source'),
    canonical_text: text, canonical_text_sha256: sha256(text), retrieval_url: CONCHO_URL,
    final_url: CONCHO_URL, filing_accession: '0001193125-20-271642', exhibit_filename: 'd32162dex21.htm', source_map_id: sha256('map'),
  };
  const structure = buildAgreementStructure({ agreement_id: sourceDocument.source_document_id, canonical_text: text, canonical_text_sha256: sha256(text) });
  const closure = buildSourceClosure({ sourceDocument, agreementStructure: structure, nodeId: structure.nodes.find((node) => node.reference === '1.1').node_id });
  const crossTexts = closure.spans.filter((span) => span.kind === 'CROSS_REFERENCE').map((span) => span.exact_text);
  assert.ok(crossTexts.some((value) => value.includes('Section 1.2')));
  assert.ok(crossTexts.some((value) => value.includes('Section 1.3')));
  assert.equal(closure.context_diagnostics.traversal_complete, true);
  assert.deepEqual(closure.context_diagnostics.unresolved_section_references, []);
  assert.doesNotMatch(JSON.stringify(closure), /M4|receipt|authority|AgreementIndex|policy_digest/);
});

test('recorded model adapter binds a raw response to the exact call request', async () => {
  const input = { call_kind: 'ROUTING', prompt_version: 'V1', request: { section_reference: '1.1' } };
  const rawResponse = { families: [], disposition: 'IMMATERIAL', deterministic_disagreements: [] };
  const model = createRecordedModelAdapter({
    schema_version: 'PRODUCT_MODEL_RECORDING/V1',
    calls: [{ call_key: callKey(input), provider_id: 'RECORDED', model_id: 'MODEL/V1', raw_response: rawResponse }],
  });
  assert.deepEqual((await model.complete(input)).response, rawResponse);
  await assert.rejects(() => model.complete({ ...input, request: { section_reference: '1.2' } }), /RECORDING_MISS/);
  assert.equal(model.assertExhausted(), true);
  const unused = createRecordedModelAdapter({
    schema_version: 'PRODUCT_MODEL_RECORDING/V1',
    calls: [{ call_key: callKey({ ...input, request: { section_reference: 'unused' } }), provider_id: 'A', model_id: 'A', raw_response: {} }],
  });
  assert.throws(() => unused.assertExhausted(), /RECORDING_UNUSED/);
  assert.throws(() => createRecordedModelAdapter({
    schema_version: 'PRODUCT_MODEL_RECORDING/V1',
    calls: [
      { call_key: callKey(input), provider_id: 'A', model_id: 'A', raw_response: {} },
      { call_key: callKey(input), provider_id: 'B', model_id: 'B', raw_response: {} },
    ],
  }), /RECORDING_DUPLICATE_KEY/);
});

test('real Concho SEC source reaches a reproducible, coherent draft with all-family routing and residual coverage', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const model = createSyntheticConchoModel();
  const persistedSections = [];
  const draft = await buildAgreementDraft({
    sourceDocument,
    agreementStructure,
    legalSchema: schema,
    model,
    onSectionComplete: async (result) => persistedSections.push(result.section_result_id),
  });
  validateAgreementDraft(draft, { sourceDocument, agreementStructure, legalSchema: schema });
  assert.equal(draft.sections.length, substantiveSections(agreementStructure).length);
  assert.equal(model.calls.filter((call) => call.kind === 'ROUTING').length, draft.sections.length);
  assert.ok(model.calls.find((call) => call.kind === 'ROUTING' && call.request.section_reference === '6.3').request.deterministic_family_evidence.length > 0);
  assert.equal(persistedSections.length, draft.sections.length);
  assert.deepEqual(new Set(draft.proposals.map((item) => item.family_key)), new Set(['TERMINATION', 'TERMINATION_FEE', 'NO_SHOP']));
  assert.ok(draft.fact_links.some((item) => item.relationship_type === 'EXCEPTS'));
  assert.ok(draft.fact_links.some((item) => item.relationship_type === 'QUALIFIES'));
  assert.equal(draft.proposals.every((item) => item.validation_status === 'VALID'), true);
  assert.equal(draft.proposals.every((item) => item.model_call_id && item.source_span_ids.length > 0), true);
  assert.deepEqual(new Set(draft.coverage_assertions.filter((item) => item.subject_kind === 'FAMILY' && item.state === 'FOUND').map((item) => item.family_key)), new Set(['TERMINATION', 'TERMINATION_FEE', 'NO_SHOP']));
  assert.equal(draft.coverage_assertions.filter((item) => item.subject_kind === 'FAMILY').length, 25);
  assert.equal(draft.residual_passes.length, draft.sections.length);
  assert.equal(draft.model_calls.length, (draft.sections.length * 2) + 6);
  assert.equal(new Set(draft.model_calls.map((item) => item.model_call_id)).size, draft.model_calls.length);
  assert.equal(sourceDocument.raw_sha256, '3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6');
  assert.equal(sourceDocument.canonical_text_sha256, '30d929c76ab9cd2bddecf3f2df2f2ec107146c2ae31b241110c9923ef03e3be5');
});

test('invalid evidence, missing roles and inconsistent coverage fail closed', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const model = {
    async complete({ call_kind: kind, request }) {
      return {
        provider_id: 'TEST', model_id: 'TEST',
        response: kind === 'ROUTING'
          ? {
            families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED',
            deterministic_disagreements: (request.deterministic_family_evidence || [])
              .filter((item) => item.section_family !== 'NO_SHOP')
              .map((item) => ({ family_key: item.section_family, reason: 'test disagreement' })),
          }
          : kind === 'RESIDUAL'
            ? { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'Covered by No-Shop.' })) }
            : {
            groups: [group('g', 'NO_SHOP', 'PROHIBITED_ACTION')],
            proposals: [{ ...proposal('p', 'g', 'NO_SHOP', 'PROHIBITED_ACTION', 'PROHIBITED_ACTION', 'Bad', { covenant_obligor: 'Company' }, 'words not in the agreement'),
              evidence_quotes: [{ quote: 'words not in the agreement', source_span_id: request.source_closure.full_section.span_id, occurrence: 0 }] }],
            links: [], coverage: { NO_SHOP: 'FOUND' },
            fact_type_coverage: { NO_SHOP: Object.fromEntries(schema.families.find((item) => item.family_key === 'NO_SHOP').required_fact_types.map((key) => [key, key === 'PROHIBITED_ACTION' ? 'FOUND' : 'NOT_FOUND'])) },
          },
      };
    },
  };
  await assert.rejects(
    () => require('../lib/product/agreement-draft').buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model, node }),
    /PROPOSAL_EXACT_SPAN/,
  );
});

test('Review read handler is GET-only, private and bounded', async () => {
  const response = () => ({
    statusCode: null, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const handler = createProductAnalysisHandler({
    getClient: () => ({}),
    storeFactory: () => ({ getAgreementAnalysis: async (runId) => ({ schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: runId }) }),
  });
  const badMethod = response();
  await handler({ method: 'POST', query: { id: crypto.randomUUID() } }, badMethod);
  assert.equal(badMethod.statusCode, 405);
  const badId = response();
  await handler({ method: 'GET', query: { id: 'bad' } }, badId);
  assert.equal(badId.statusCode, 400);
  const ok = response();
  await handler({ method: 'GET', query: { id: crypto.randomUUID() } }, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['Cache-Control'], 'private, no-store');
});
}

module.exports = { CONCHO_URL, conchoSource, createSyntheticConchoModel, extractionResponse, schema };
