'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  createAnthropicProvider,
  NativeProducerAnthropicError,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  getProducerPromptModule,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  produceCandidateProposals,
} = require('../lib/canonical-v2/native-producer/provider-interface');

const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });

const CASES = Object.freeze([
  Object.freeze({
    family: 'TERMINATION_FEE',
    sourceText: 'Parent shall pay the Company the "Parent Termination Fee" of $10.',
    response: Object.freeze({
      fee_amount_assertions: Object.freeze([Object.freeze({
        section_reference: '1.1',
        quote: 'Parent shall pay the Company the "Parent Termination Fee" of $10.',
        fee_side: 'BUYER',
        payer_party: 'Parent',
        fee_term_ref: 'Parent Termination Fee',
      })]),
      fee_trigger_assertions: Object.freeze([]),
      tail_period_assertions: Object.freeze([]),
      open_world_candidates: Object.freeze([]),
    }),
    expectedClaimKey: 'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE',
  }),
  Object.freeze({
    family: 'NO_SHOP',
    sourceText: 'The Company shall not solicit an Acquisition Proposal.',
    response: Object.freeze({
      no_shop_action_assertions: Object.freeze([Object.freeze({
        section_reference: '1.2',
        quote: 'The Company shall not solicit an Acquisition Proposal.',
        action_code: 'SOLICIT',
        covenant_obligor: 'The Company',
      })]),
      exception_prerequisite_assertions: Object.freeze([]),
      period_assertions: Object.freeze([]),
      open_world_candidates: Object.freeze([]),
    }),
    expectedClaimKey: 'NATIVE_NO_SHOP_ACTION_CANDIDATE',
  }),
  Object.freeze({
    family: 'MAE_DEFINITION',
    sourceText: 'Material Adverse Effect means an effect adverse to the business.',
    response: Object.freeze({
      mae_definition_instances: Object.freeze([Object.freeze({
        section_reference: '1.3',
        defined_term: 'Material Adverse Effect',
        definition_subject: 'the business',
        prong_assertions: Object.freeze([Object.freeze({
          quote: 'an effect adverse to the business',
          prong_code: 'BUSINESS_EFFECTS',
          prong_label: null,
          limb_path: Object.freeze([]),
        })]),
        carveout_assertions: Object.freeze([]),
        disproportionality_assertions: Object.freeze([]),
      })]),
      open_world_candidates: Object.freeze([]),
    }),
    expectedClaimKey: 'NATIVE_MAE_DEFINITION_PRONG_CANDIDATE',
  }),
  Object.freeze({
    family: 'TERMINATION',
    sourceText: 'Either Parent or the Company may terminate this Agreement by mutual written consent.',
    response: Object.freeze({
      termination_right_assertions: Object.freeze([Object.freeze({
        section_reference: '1.4',
        quote: 'Either Parent or the Company may terminate this Agreement by mutual written consent.',
        assertion_kind: 'RIGHT_GRANT',
        trigger_kind: 'MUTUAL_CONSENT',
        terminating_party_scope: 'EITHER_PARTY',
        terminating_party: 'Either Parent or the Company',
        deadline_term: null,
        day_kind: null,
        period_kind: null,
      })]),
      open_world_candidates: Object.freeze([]),
    }),
    expectedClaimKey: 'NATIVE_TERMINATION_RIGHT_CANDIDATE',
  }),
  Object.freeze({
    family: 'REPRESENTATIONS',
    sourceText: 'The Company represents and warrants that this representation is true and correct in all material respects.',
    response: Object.freeze({
      representation_instances: Object.freeze([Object.freeze({
        section_reference: '3.1',
        party_making: 'The Company',
        chapeau_quote: 'The Company represents and warrants that',
        limbs: Object.freeze([]),
        qualifiers: Object.freeze([Object.freeze({
          kind: 'ACCURACY',
          code: 'MAT_ALL_MATERIAL',
          quote: 'true and correct in all material respects',
          attachment: Object.freeze({
            position: 'ITEM',
            governs_path: Object.freeze(['3.1']),
            ambiguity_signals: Object.freeze({ items_grammatically_parallel: false }),
          }),
        })]),
        definition_uses: Object.freeze([]),
        cross_references: Object.freeze([]),
      })]),
      bring_down_conditions: Object.freeze([]),
      open_world_candidates: Object.freeze([]),
    }),
    expectedClaimKey: 'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE',
  }),
]);

for (const familyCase of CASES) {
  test(`live provider dispatches ${familyCase.family} through its registered prompt and response shaper`, async () => {
    const governedScope = {
      deal_key: `deal:provider-${familyCase.family.toLowerCase()}`,
      governed_intervals: [familyCase.response.section_reference || '1'],
      source_text: familyCase.sourceText,
    };
    let request = null;
    const client = {
      messages: {
        async create(value) {
          request = value;
          return { content: [{ text: JSON.stringify(familyCase.response) }] };
        },
      },
    };
    const provider = createAnthropicProvider({ model: 'family-dispatch-test', client, maxRetries: 0 });
    const result = await produceCandidateProposals({
      governed_scope: governedScope,
      definitions: DEFINITIONS,
      contract_bundle: CONTRACT_BUNDLE,
      section_family: familyCase.family,
      provider,
    });

    const expectedPrompt = getProducerPromptModule(familyCase.family)({
      source_text: familyCase.sourceText,
      governed_scope: governedScope,
      known_definitions: [],
    });
    assert.deepEqual(request.messages, expectedPrompt.messages);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0].claim_definition_key, familyCase.expectedClaimKey);
  });
}

test('live provider rejects a response shaped for a different family', async () => {
  const client = {
    messages: {
      async create() {
        return { content: [{ text: JSON.stringify({
          representation_instances: [],
          bring_down_conditions: [],
          open_world_candidates: [],
        }) }] };
      },
    },
  };
  const provider = createAnthropicProvider({ model: 'family-dispatch-test', client, maxRetries: 0 });

  await assert.rejects(() => produceCandidateProposals({
    governed_scope: { deal_key: 'deal:wrong-shape', source_text: 'No solicitation.' },
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'NO_SHOP',
    provider,
  }), (error) => (
    error instanceof NativeProducerAnthropicError
      && error.code === 'RETRIES_EXHAUSTED'
      && error.details.last_code === 'SCHEMA_MISSING_KEY'
  ));
});

test('the omitted-family default and explicit CAPITALISATION path remain byte-compatible', async () => {
  const response = JSON.stringify({
    representation_instances: [],
    bring_down_conditions: [],
    open_world_candidates: [],
  });
  const makeProvider = () => createAnthropicProvider({
    model: 'family-dispatch-test',
    maxRetries: 0,
    client: { messages: { async create() { return { content: [{ text: response }] }; } } },
  });
  const input = {
    governed_scope: { deal_key: 'deal:capitalisation-default', source_text: 'Capitalisation.' },
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
  };
  const omitted = await produceCandidateProposals({ ...input, provider: makeProvider() });
  const explicit = await produceCandidateProposals({
    ...input,
    section_family: 'CAPITALISATION',
    provider: makeProvider(),
  });

  assert.deepEqual(explicit, omitted);
});
