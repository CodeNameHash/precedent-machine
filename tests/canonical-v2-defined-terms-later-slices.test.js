'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV35 } = require('../lib/canonical-v2/contract-bundle');
const { projectKeyTermsMaeClaims } = require('../lib/canonical-v2/key-terms-mae-product-projection');
const { shapeDefinedTermsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const BUNDLE = compileFixtureContractV35();
const SOURCE = `Section 1.1 Definitions.
"Tax" means any tax, including those reported on a Tax Return.
"Tax Return" means any return, report or other document required to be filed with a Taxing Authority under applicable Law.
"Made Available" means made available to Parent in the virtual data room before the date of this Agreement.
"Ordinary Course" means the ordinary course of business consistent with past practice.`;

function envelope(definedTerm, body, crossReferenceTarget = null) {
  return {
    section_reference: '1.1',
    defined_term: definedTerm,
    definition_kind: 'TERM_DEFINITION',
    definition_head_quote: body.slice(0, body.indexOf(' means') + ' means'.length),
    definition_body_quote: body,
    cross_reference_target: crossReferenceTarget,
    owner_hint: null,
  };
}

async function resolveDefinitionEnvelopes({ source = SOURCE, envelopes, dealKey = 'defined-term-later-slice' }) {
  const receipt = await runNativeExtraction({
    source_text: source,
    document_hash: sha256Hex(Buffer.from(source, 'utf8')),
    section_references: ['1.1'],
    contract_bundle: BUNDLE,
    definitions: { known_definitions: [] },
    section_family_classifier: () => ({ section_family: 'KEY_DEFINED_TERMS', provenance: 'TEST' }),
    provider: async ({ governed_scope }) => ({
      provider_id: 'defined-term-later-slice-test/v1',
      model_id: 'stub',
      prompt: 'defined-term-later-slice-test',
      ...shapeDefinedTermsProposals({ definition_envelopes: envelopes, open_world_candidates: [] }, governed_scope.source_text),
    }),
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: BUNDLE,
    admitted_source_context: buildIdentityAdmittedSourceContext(source, {
      dealKey,
      dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
    }),
  });
}

test('later defined-term slices preserve four exact definition variants through resolution and product surfaces', async () => {
  const tax = '"Tax" means any tax, including those reported on a Tax Return.';
  const taxReturn = '"Tax Return" means any return, report or other document required to be filed with a Taxing Authority under applicable Law.';
  const madeAvailable = '"Made Available" means made available to Parent in the virtual data room before the date of this Agreement.';
  const ordinaryCourse = '"Ordinary Course" means the ordinary course of business consistent with past practice.';
  const resolution = await resolveDefinitionEnvelopes({
    envelopes: [
      envelope('Tax', tax, 'Tax Return'),
      envelope('Tax Return', taxReturn, 'Tax'),
      envelope('Made Available', madeAvailable),
      envelope('Ordinary Course', ordinaryCourse),
    ],
  });

  assert.equal(resolution.resolved.length, 4);
  assert.deepEqual(
    resolution.resolved.map((entry) => [entry.concept_key, entry.resolved_claim_definition_key]).sort(),
    [
      ['DEF-MADE-AVAILABLE', 'MADE_AVAILABLE_DEFINITION_RECORDED'],
      ['DEF-ORDINARY-COURSE', 'ORDINARY_COURSE_DEFINITION_RECORDED'],
      ['DEF-TAX', 'TAX_DEFINITION_RECORDED'],
      ['DEF-TAX-RETURN', 'TAX_RETURN_DEFINITION_RECORDED'],
    ],
  );
  for (const entry of resolution.resolved) {
    assert.equal(entry.claim.canonical_value, true);
    assert.equal(entry.claim.attributes.definition_equivalence, 'NOT_ASSERTED');
    assert.ok(entry.claim.attributes.definition_envelope.definition_body_quote.startsWith('"'));
  }
  const taxEntry = resolution.resolved.find((entry) => entry.concept_key === 'DEF-TAX');
  assert.equal(taxEntry.claim.attributes.definition_envelope.cross_reference_target, 'Tax Return');

  const product = projectKeyTermsMaeClaims({ resolved_entries: resolution.resolved });
  assert.equal(product.records.length, 4);
  for (const record of product.records) {
    assert.equal(record.market.market_statistics, 'NOT_CALCULATED');
    assert.equal(record.review.definition_equivalence, 'NOT_ASSERTED');
    assert.equal(record.query.value.definition_equivalence, 'NOT_ASSERTED');
    assert.ok(record.query.value.definition_envelope.definition_body_quote.length > 0);
  }
});

test('same label retains deal-specific variant text and never treats definitions as equivalent', async () => {
  const firstSource = 'Section 1.1 Definitions.\n"Tax" means any federal, state, local or foreign tax.';
  const secondSource = 'Section 1.1 Definitions.\n"Tax" means all Taxes imposed by any Taxing Authority, including interest and penalties.';
  const first = await resolveDefinitionEnvelopes({
    source: firstSource,
    envelopes: [envelope('Tax', '"Tax" means any federal, state, local or foreign tax.')],
    dealKey: 'tax-variant-one',
  });
  const second = await resolveDefinitionEnvelopes({
    source: secondSource,
    envelopes: [envelope('Tax', '"Tax" means all Taxes imposed by any Taxing Authority, including interest and penalties.')],
    dealKey: 'tax-variant-two',
  });
  assert.equal(first.resolved[0].concept_key, 'DEF-TAX');
  assert.equal(second.resolved[0].concept_key, 'DEF-TAX');
  assert.notEqual(
    first.resolved[0].claim.attributes.definition_envelope.definition_body_quote,
    second.resolved[0].claim.attributes.definition_envelope.definition_body_quote,
  );
  assert.equal(first.resolved[0].claim.attributes.definition_equivalence, 'NOT_ASSERTED');
  assert.equal(second.resolved[0].claim.attributes.definition_equivalence, 'NOT_ASSERTED');
});

test('mapping uses the exact defined-term identity, never a definition subtype or a longer label', async () => {
  const source = 'Section 1.1 Definitions.\n"Tax Liability" means an amount of Tax.\n"Ordinary Course" means ordinary conduct.';
  const result = await resolveDefinitionEnvelopes({
    source,
    envelopes: [
      envelope('Tax Liability', '"Tax Liability" means an amount of Tax.'),
      { ...envelope('Ordinary Course', '"Ordinary Course" means ordinary conduct.'), definition_kind: 'CROSS_REFERENCE' },
    ],
  });
  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0].concept_key, 'DEF-ORDINARY-COURSE');
  assert.equal(result.open_world.length, 1);
  assert.equal(result.open_world[0].reason, 'NATIVE_OPEN_WORLD_PROPOSAL');
});
