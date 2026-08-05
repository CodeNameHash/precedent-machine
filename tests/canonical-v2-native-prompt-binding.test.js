'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { createAnthropicProvider, shapeClosingConditionProposals, shapeRegulatoryEffortsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { PROMPT_BINDING_SCHEMA, bindNativePromptToGovernedScope } = require('../lib/canonical-v2/native-producer/native-prompt-binding');
const { diagnosticAdmittedSource } = require('./helpers/diagnostic-admitted-source');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));
const CONTRACT_BUNDLE = compileFixtureContract();

function pilotInput(workItemId) {
  const workItem = MANIFEST.work_items.find((item) => item.work_item_id === workItemId);
  assert.ok(workItem, `missing pilot work item ${workItemId}`);
  const source = MANIFEST.sources.find((candidate) => candidate.source_id === workItem.source_id);
  assert.ok(source, `missing pilot source ${workItem.source_id}`);
  const admitted = diagnosticAdmittedSource({ source, root_dir: ROOT });
  const node = findSectionByReference(admitted.tree, workItem.section_pin.section_reference);
  assert.ok(node, `missing admitted section ${workItem.section_pin.section_reference}`);
  return { workItem, admitted, node };
}

function responseForFamily(familyId) {
  if (familyId === 'MAE_DEFINITION') {
    return { mae_definition_instances: [], open_world_candidates: [] };
  }
  if (familyId === 'CAPITALISATION') {
    return {
      representation_instances: [],
      bring_down_conditions: [],
      open_world_candidates: [],
      share_count_assertions: [],
    };
  }
  throw new Error(`missing minimal response for ${familyId}`);
}

test('receipt and provider send the same governed prompt for Modiv 8.12(g) and Skechers 3.7', async () => {
  for (const workItemId of ['modiv-mae-definition-8-12-g', 'skechers-capitalisation-3-7']) {
    const { workItem, admitted, node } = pilotInput(workItemId);
    let sentMessages = null;
    const provider = createAnthropicProvider({
      maxRetries: 0,
      client: {
        messages: {
          async create(request) {
            sentMessages = request.messages;
            return { content: [{ text: JSON.stringify(responseForFamily(workItem.family_id)) }] };
          },
        },
      },
    });
    const receipt = await runNativeExtraction({
      source_text: admitted.context.canonical_text.text,
      document_hash: admitted.context.document_hash,
      section_references: [node.reference],
      section_family_assignments: [{
        section_reference: node.reference,
        family_id: workItem.family_id,
      }],
      contract_bundle: CONTRACT_BUNDLE,
      definitions: { known_definitions: [] },
      provider,
    });

    const sentPrompt = sentMessages.map((message) => message.content).join('\n');
    assert.match(sentPrompt, new RegExp(`GOVERNED SECTION REFERENCE: ${node.reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(sentPrompt, new RegExp(`Every emitted section_reference must equal ${JSON.stringify(node.reference).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} exactly`));
    assert.match(sentPrompt, /one contiguous byte-identical substring of SOURCE TEXT/);
    assert.match(sentPrompt, /Preserve punctuation exactly/);
    assert.match(sentPrompt, /Omit the assertion if you cannot copy its quote exactly/);
    assert.equal(
      receipt.resolved_sections[0].prompt_digest,
      contentId('NATIVE_EXTRACTION_RUN_PROMPT/V1', sentMessages),
      `${workItemId}: receipt digest must cover the literal provider messages`,
    );
  }
});

test('the binding rejects a relative scope and attaches the immutable binding marker', () => {
  const prompt = bindNativePromptToGovernedScope({
    prompt: { prompt_id: 'test', prompt_version: 1, messages: [{ role: 'user', content: 'SOURCE TEXT: x' }] },
    governed_scope: { section_reference: '8.12(g)' },
  });
  assert.equal(prompt.prompt_binding_schema, PROMPT_BINDING_SCHEMA);
  assert.match(prompt.messages[0].content, /Every emitted section_reference must equal "8\.12\(g\)" exactly/);
  assert.match(prompt.messages[0].content, /Do not use a relative subsection label/);
  assert.ok(Object.isFrozen(prompt));
  assert.ok(Object.isFrozen(prompt.messages));
});

test('quote mutations fail closed instead of normalising punctuation or omitted words', () => {
  const antitrust = shapeRegulatoryEffortsProposals({
    regulatory_efforts_assertions: [{
      quote: 'The parties shall take all actions under this Agreement. including required filings.',
    }],
    open_world_candidates: [],
  }, 'The parties shall take all actions under this Agreement, including required filings.');
  assert.equal(antitrust.proposals.length, 0);
  assert.deepEqual(antitrust.evidence_residuals.map((residual) => residual.reason), [
    'REGULATORY_EFFORTS_QUOTE_UNVERIFIED',
  ]);

  const closing = shapeClosingConditionProposals({
    closing_condition_assertions: [{
      quote: 'The Registration Statement shall not be the subject of pending or threatened in writing proceeding seeking a stop order.',
    }],
    open_world_candidates: [],
  }, 'The Registration Statement shall not be the subject of any stop order or pending or threatened in writing proceeding seeking a stop order.');
  assert.equal(closing.proposals.length, 0);
  assert.deepEqual(closing.evidence_residuals.map((residual) => residual.reason), [
    'CLOSING_CONDITION_QUOTE_UNVERIFIED',
  ]);
});
