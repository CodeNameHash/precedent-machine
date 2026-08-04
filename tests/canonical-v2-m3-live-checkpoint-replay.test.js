'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeIocProposals,
  shapeTerminationProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

const sourceFixture = JSON.parse(fs.readFileSync(path.join(
  __dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', 'adapter-result.json',
), 'utf8'));
const admittedSourceContext = sourceFixture.admitted_source_contexts[0];
const sourceText = admittedSourceContext.canonical_text.text;
const contractBundle = compileFixtureContractV34();

// Focused, verbatim records from the M3 pilot checkpoints. Their parent
// source and checkpoint IDs are immutable pins, rather than regenerated
// model output.
const LIVE_CHECKPOINTS = Object.freeze({
  ioc: Object.freeze({
    checkpoint_id: '0e6d2b22288b9f20fccc71e136a75b6a6a2de16332d81998c62bf34c04e4c4a4',
    review_packet_id: 'ff3711be465cce52edd29ed599ee975582ca5c15536bb813b7e46756c3c8dbb3',
    assertion: Object.freeze({
      section_reference: '4.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'CHARTER', threshold_basis: null,
      quote: 'adopt any amendments to the Charter or its bylaws or, in the case of any Subsidiary that is not a corporation, similar applicable organizational documents;',
    }),
  }),
  termination: Object.freeze({
    checkpoint_id: '58f79ba80274cc9d7f43093c46fdf388bdcbd797dccbb93c6c8347e077bbe38f',
    review_packet_id: 'ed8f645fd3871d728d27523fdfd9c300eb3f41acc20a4a68ffbf24aa6403e279',
    parsed: Object.freeze({
      termination_right_assertions: [
        { section_reference: '6.3(a)', assertion_kind: 'RIGHT_GRANT', trigger_kind: 'RECOMMENDATION_CHANGE', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', quote: 'the Parent Board shall have made a Parent Adverse Recommendation Change' },
        { section_reference: '6.3(a)', assertion_kind: 'RIGHT_GRANT', trigger_kind: 'RECOMMENDATION_CHANGE', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', quote: 'the Parent Board shall have made a Parent Intervening Event Recommendation Change' },
        { section_reference: '6.3(a)', assertion_kind: 'RIGHT_GRANT', trigger_kind: 'NO_SOLICITATION_BREACH', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', quote: 'Parent or any of its Representatives (acting on behalf of Parent) materially breaches its obligations under Section ‎‎4.4' },
        { section_reference: '6.3(a)', assertion_kind: 'CURE_PERIOD', trigger_kind: 'NO_SOLICITATION_BREACH', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', day_kind: 'BUSINESS', period_kind: 'CURE', quote: 'such breach is not curable or, if curable is not cured prior to the earlier of (A) the fifth business day after written notice thereof is given by the Company to Parent and (B) the date that is three business days prior to the Outside Date' },
        { section_reference: '6.3(b)', assertion_kind: 'RIGHT_GRANT', trigger_kind: 'BREACH', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', quote: 'there has been a breach or inaccuracy of any representation, warranty, covenant or agreement made by Parent, Titanium Merger Sub or Forward Merger Sub in this Agreement' },
        { section_reference: '6.3(b)', assertion_kind: 'CURE_PERIOD', trigger_kind: 'BREACH', terminating_party_scope: 'ONE_PARTY', terminating_party: 'the Company', day_kind: 'CALENDAR', period_kind: 'CURE', quote: 'such breach or inaccuracy or failure to be true is not curable by the Outside Date or, if capable of being cured by the Outside Date, shall not have been cured prior to the earlier of (x) thirty (30) days after written notice thereof is given by the Company to Parent or (y) the Outside Date' },
      ],
      wave_b_mechanics: [
        { surface: 'PRE_VOTE_LIMIT', section_reference: '6.3(a)', quote: 'at any time prior to the receipt of the Parent Stockholder Approval', detail: 'The termination right is limited to the period before receipt of the Parent Stockholder Approval.' },
        { surface: 'BREACH_STANDARD', section_reference: '6.3(b)', quote: 'such breach or inaccuracy or failure to be true would result in the failure to satisfy one or more of the conditions set forth in Sections ‎5.3(a)(i) or ‎5.3(a)(ii)', detail: 'The breach or inaccuracy must cause failure of one or more specified closing conditions.', related_clause_reference: 'Sections ‎5.3(a)(i) or ‎5.3(a)(ii)', cross_reference_quote: 'Sections ‎5.3(a)(i) or ‎5.3(a)(ii)' },
      ],
      open_world_candidates: [{ observed_quote: 'provided that the Company is not then in breach of any representation, warranty, covenant or agreement under this Agreement such that Parent would have the right to terminate this Agreement under Section ‎6.4(b)', why_unmapped: 'This is a condition on the Company\'s exercise of its breach termination right and resembles a cross-referenced reciprocal breach right, not a separate termination-right grant in this clause.', nearest_concept: 'BREACH' }],
    }),
  }),
});

async function replay({ sectionReference, familyId, covenantSide = null, shape }) {
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: admittedSourceContext.document_hash,
    section_references: [sectionReference],
    section_family_assignments: [{ section_reference: sectionReference, family_id: familyId, ...(covenantSide ? { covenant_side: covenantSide } : {}) }],
    contract_bundle: contractBundle,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: scope }) => ({
      provider_id: 'm3-live-checkpoint-replay/v1', model_id: 'recorded', prompt: 'm3-live-checkpoint-replay/v1', ...shape(scope.source_text),
    }),
  });
  return { receipt, resolution: resolveCandidates({ run_receipt: receipt, contract_vocabulary: contractBundle, admitted_source_context: admittedSourceContext }) };
}

test('M3 live IOC checkpoint inherits only the TARGET parent chapeau with exact source evidence', async () => {
  const { assertion } = LIVE_CHECKPOINTS.ioc;
  assert.ok(sourceText.includes(assertion.quote));
  const { resolution } = await replay({
    sectionReference: '4.1', familyId: 'INTERIM_OPERATING', covenantSide: 'TARGET',
    shape: (scopeText) => shapeIocProposals({ ioc_restriction_assertions: [assertion], open_world_candidates: [] }, scopeText, { covenant_side: 'TARGET' }),
  });
  assert.equal(resolution.resolved.length, 1);
  const resolved = resolution.resolved[0];
  assert.deepEqual(resolved.party, { role: 'IOC_COVENANT_OBLIGOR', value: 'the Company', capacity: 'TARGET' });
  assert.equal(Buffer.from(sourceText, 'utf8').subarray(resolved.party_source_span.absolute_start, resolved.party_source_span.absolute_end).toString('utf8'), 'the Company will not, and will not permit any of its Subsidiaries, to:');
});

test('M3 live termination checkpoint keeps grant, trigger and cross-reference evidence without resolving new standards', async () => {
  const { parsed } = LIVE_CHECKPOINTS.termination;
  const { receipt, resolution } = await replay({
    sectionReference: '6.3', familyId: 'TERMINATION',
    shape: (scopeText) => shapeTerminationProposals(parsed, scopeText),
  });
  assert.equal(receipt.compiled_candidate_count, 9);
  assert.deepEqual(resolution.resolution_receipt.counts, {
    compiled_candidates: 9, resolved: 2, auto_pass: 0, review_queue: 6,
    open_world: 3, residuals: 0, provisions: 2, limb_component_trees: 0, ioc_restriction_components: 0,
  });
  for (const item of resolution.resolved) {
    assert.deepEqual(item.party, { role: 'TERMINATION_RIGHT_HOLDER', value: 'the Company', capacity: 'TARGET' });
    assert.match(item.claim.attributes.termination_grant_context.grant_quote, /This Agreement may be terminated[\s\S]*by the Company if:/);
    assert.equal(item.claim.attributes.termination_grant_context.trigger_limb_quote, item.claim.raw_value);
  }
  assert.equal(resolution.open_world.length, 3);
  assert.ok(resolution.review_queue.every((item) => !item.reasons.includes('TERMINATING_PARTY_REF_NOT_IN_QUOTE')));
  assert.equal(sha256Hex(Buffer.from(sourceText, 'utf8')), '7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d');
});
