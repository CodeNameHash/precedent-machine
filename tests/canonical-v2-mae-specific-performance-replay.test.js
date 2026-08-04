'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { createAnthropicProvider, shapeSpecificPerformanceRemedyProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { buildSpecificPerformanceRemediesProducerPrompt } = require('../lib/canonical-v2/native-producer/specific-performance-remedies-producer-prompt');
const { maeCarveoutCorroborated, resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'),
  'utf8',
));
const CONTRACT = compileFixtureContractV34();

function pilotSection(workItemId) {
  const workItem = MANIFEST.work_items.find((item) => item.work_item_id === workItemId);
  const source = MANIFEST.sources.find((item) => item.source_id === workItem.source_id);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  const node = findSectionByReference(admitted.tree, workItem.section_pin.section_reference);
  assert.ok(node, `${workItemId}: pinned section exists`);
  return {
    workItem,
    admitted,
    text: Buffer.from(admitted.context.canonical_text.text, 'utf8').subarray(node.start, node.end).toString('utf8'),
  };
}

function exact(text, expression) {
  const match = text.match(expression);
  assert.ok(match, `missing exact source text for ${expression}`);
  return match[0];
}

test('Modiv 8.12(g) immutable replay uses the governed citation and only corroborated carve-outs', async () => {
  const pilot = pilotSection('modiv-mae-definition-8-12-g');
  const businessProng = exact(pilot.text, /\(i\) has resulted in,[\s\S]*?taken as a whole,/);
  const economyCarveout = exact(pilot.text, /\(b\) general economic,[\s\S]*?foregoing;/);
  const complianceCarveout = exact(pilot.text, /\(f\) the taking of any action expressly required or prohibited by this Agreement or the omission of any action expressly prohibited by this Agreement;/);
  const acquirorIdentity = exact(pilot.text, /\(j\) the identity of Parent or any of its Affiliates as the acquiror of the Company and the Partnership;/);
  assert.ok(maeCarveoutCorroborated('ECONOMY_GENERAL', economyCarveout));
  assert.ok(maeCarveoutCorroborated('COMPLIANCE_WITH_AGREEMENT', complianceCarveout));
  assert.equal(maeCarveoutCorroborated('COMPLIANCE_WITH_AGREEMENT', acquirorIdentity), false);

  const response = {
    mae_definition_instances: [{
      section_reference: '8.12(g)',
      defined_term: 'Company Material Adverse Effect',
      definition_subject: 'the Company and the Company Subsidiaries',
      prong_assertions: [{
        prong_code: 'BUSINESS_EFFECTS',
        prong_label: '(i)',
        quote: businessProng,
        limb_path: ['(i)'],
      }],
      carveout_assertions: [
        { carveout_code: 'ECONOMY_GENERAL', clause_label: '(b)', quote: economyCarveout, limb_path: ['(b)'] },
        { carveout_code: 'COMPLIANCE_WITH_AGREEMENT', clause_label: '(f)', quote: complianceCarveout, limb_path: ['(f)'] },
        { carveout_code: null, clause_label: '(j)', quote: acquirorIdentity, limb_path: ['(j)'] },
      ],
      disproportionality_assertions: [],
    }],
    open_world_candidates: [],
  };
  let sentMessages = null;
  const provider = createAnthropicProvider({
    maxRetries: 0,
    client: {
      messages: {
        async create(request) {
          sentMessages = request.messages;
          return { content: [{ text: JSON.stringify(response) }] };
        },
      },
    },
  });
  const receipt = await runNativeExtraction({
    source_text: pilot.admitted.context.canonical_text.text,
    document_hash: pilot.admitted.context.document_hash,
    section_references: ['8.12(g)'],
    section_family_assignments: [{ section_reference: '8.12(g)', family_id: 'MAE_DEFINITION' }],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    provider,
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: pilot.admitted.context,
  });

  assert.match(sentMessages[0].content, /GOVERNED SECTION REFERENCE: 8\.12\(g\)/);
  assert.match(sentMessages[0].content, /Every emitted section_reference must equal "8\.12\(g\)" exactly/);
  assert.equal(receipt.citation_residual_count, 0);
  assert.equal(receipt.evidence_residual_count, 0);
  assert.deepEqual(
    resolution.resolved.map((entry) => entry.resolved_claim_definition_key).sort(),
    ['MAE_CARVEOUT', 'MAE_CARVEOUT', 'MAE_DEFINITION_PRONG'],
  );
  assert.deepEqual(resolution.review_queue.filter((entry) => !entry.has_resolution).map((entry) => entry.reasons), [
    ['MAE_CARVEOUT_UNCORROBORATED'],
  ]);
});

test('TopBuild 7.6 rejects a bare equitable-relief grant and retains the operative premise', () => {
  const pilot = pilotSection('topbuild-remedies-specific-performance-7-6');
  const fullGrant = exact(pilot.text, /The parties acknowledge and agree that irreparable harm would occur[\s\S]*?executed in connection herewith\./);
  const bareGrant = exact(pilot.text, /It is accordingly agreed that,[\s\S]*?executed in connection herewith\./);
  const bare = shapeSpecificPerformanceRemedyProposals({
    remedy_assertions: [{ assertion_kind: 'SPECIFIC_PERFORMANCE', quote: bareGrant }],
    open_world_candidates: [],
  }, pilot.text);
  const complete = shapeSpecificPerformanceRemedyProposals({
    remedy_assertions: [{ assertion_kind: 'SPECIFIC_PERFORMANCE', quote: fullGrant }],
    open_world_candidates: [],
  }, pilot.text);
  const prompt = buildSpecificPerformanceRemediesProducerPrompt({
    source_text: pilot.text,
    governed_scope: { section_reference: '7.6' },
  });

  assert.equal(bare.proposals.length, 0);
  assert.deepEqual(bare.evidence_residuals.map((entry) => entry.reason), [
    'SPECIFIC_PERFORMANCE_OPERATIVE_PREMISE_UNVERIFIED',
  ]);
  assert.equal(complete.proposals.length, 1);
  assert.deepEqual(complete.evidence_residuals, []);
  assert.equal(prompt.prompt_version, 2);
  assert.match(prompt.messages[0].content, /irreparable harm would occur and money damages would not be an adequate remedy/);
  assert.match(prompt.messages[0].content, /condition gates, termination limits, non-waiver language, bond or security waivers/);
});

test('TopBuild 7.6 publishes only the governed specific-performance assertion and keeps a litigation extension open-world', async () => {
  const pilot = pilotSection('topbuild-remedies-specific-performance-7-6');
  const fullGrant = exact(pilot.text, /The parties acknowledge and agree that irreparable harm would occur[\s\S]*?executed in connection herewith\./);
  const litigationExtension = exact(pilot.text, /If on the date of any termination of this Agreement,[\s\S]*?entry of final order with respect to such Action\./);
  const provider = async ({ governed_scope: scope }) => ({
    provider_id: 'recorded-topbuild-7-6-replay/v1',
    model_id: 'recorded-provider-output',
    prompt: 'recorded-topbuild-7-6-replay/v1',
    ...shapeSpecificPerformanceRemedyProposals({
      remedy_assertions: [
        { assertion_kind: 'SPECIFIC_PERFORMANCE', quote: fullGrant },
        { assertion_kind: 'LITIGATION_EXTENSION', quote: litigationExtension },
      ],
      open_world_candidates: [],
    }, scope.source_text),
  });
  const receipt = await runNativeExtraction({
    source_text: pilot.admitted.context.canonical_text.text,
    document_hash: pilot.admitted.context.document_hash,
    section_references: ['7.6'],
    section_family_assignments: [{ section_reference: '7.6', family_id: 'SPECIFIC_PERFORMANCE_REMEDIES' }],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    provider,
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: pilot.admitted.context,
  });

  assert.equal(receipt.resolved_sections[0].section_reference, '7.6');
  assert.deepEqual(resolution.resolved.map((entry) => entry.claim.attributes.assertion_kind), ['SPECIFIC_PERFORMANCE']);
  assert.equal(resolution.resolved[0].resolved_claim_definition_key, 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT');
  assert.match(resolution.resolved[0].claim.raw_value, /irreparable harm would occur/);
  assert.match(resolution.resolved[0].claim.raw_value, /money damages would not be an adequate remedy/);
  assert.equal(resolution.open_world.length, 1);
  assert.equal(resolution.open_world[0].attributes.assertion_kind, 'LITIGATION_EXTENSION');
  assert.equal(resolution.open_world[0].reason, 'M3_CARRIER_ASSERTION_KIND_OUT_OF_ENUM');
});

test('a source-exact specific-performance grant resolves when its governed source has no operative premise', () => {
  const source = 'Section 9.09 Specific Performance. It is accordingly agreed that the parties shall be entitled to an injunction or injunctions, specific performance, or other equitable relief, to prevent breaches or threatened or anticipated breaches of this Agreement and to enforce specifically the terms and provisions of this Agreement.';
  const shaped = shapeSpecificPerformanceRemedyProposals({
    remedy_assertions: [{ assertion_kind: 'SPECIFIC_PERFORMANCE', quote: source.slice(source.indexOf('It is accordingly agreed')) }],
    open_world_candidates: [],
  }, source);
  assert.equal(shaped.proposals.length, 1);
  assert.deepEqual(shaped.evidence_residuals, []);
});
