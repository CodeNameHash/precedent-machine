'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  getProducerPromptModule,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  RESPONSE_SHAPE,
  buildSpecificPerformanceRemediesProducerPrompt,
} = require('../lib/canonical-v2/native-producer/specific-performance-remedies-producer-prompt');
const {
  getFamilyAdapter,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  loadSourceForDiagnostic,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const {
  utf8Slice,
} = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));

const PROMPT_ADAPTER_COMPATIBILITY = Object.freeze([
  Object.freeze({
    family_id: 'SPECIFIC_PERFORMANCE_REMEDIES',
    prompt_builder: buildSpecificPerformanceRemediesProducerPrompt,
    response_shape: RESPONSE_SHAPE,
    required_response_lists: ['remedy_assertions', 'open_world_candidates'],
  }),
]);

test('specific-performance prompt and adapter response contracts remain compatible', () => {
  for (const entry of PROMPT_ADAPTER_COMPATIBILITY) {
    const adapter = getFamilyAdapter(entry.family_id);
    const responseShape = JSON.parse(entry.response_shape);
    assert.ok(adapter, entry.family_id);
    assert.equal(getProducerPromptModule(entry.family_id), entry.prompt_builder);
    assert.equal(adapter.prompt_builder, entry.prompt_builder);
    assert.deepEqual(adapter.required_response_lists, entry.required_response_lists);
    assert.deepEqual(Object.keys(responseShape), entry.required_response_lists);
    assert.deepEqual(Object.keys(responseShape.remedy_assertions[0]), ['assertion_kind', 'quote']);
  }
});

test('TopBuild Section 7.6 enters the specific-performance prompt with its equitable relief and limitations', () => {
  const workItem = MANIFEST.work_items.find((item) => item.work_item_id === 'topbuild-remedies-specific-performance-7-6');
  const source = MANIFEST.sources.find((item) => item.source_id === workItem.source_id);
  const admitted = loadSourceForDiagnostic({ source, root_dir: ROOT });
  const section = findSectionByReference(admitted.tree, workItem.section_pin.section_reference);
  const sourceText = utf8Slice(admitted.context.canonical_text.text, section.start, section.end);
  const prompt = getProducerPromptModule(workItem.family_id)({
    source_text: sourceText,
    governed_scope: { section_reference: section.reference },
  });
  const content = prompt.messages[0].content;

  assert.equal(section.section_id, workItem.section_pin.section_id);
  assert.equal(section.text_sha256, workItem.section_pin.section_text_sha256);
  assert.equal(prompt.prompt_id, 'native-producer-specific-performance-remedies/v1');
  assert.match(content, /equitable-relief or force-consummation right/);
  assert.match(content, /condition gates, termination limits, non-waiver language, bond or security waivers/);
  assert.match(content, /shall be entitled to an injunction or injunctions, specific performance or other equitable relief/);
  assert.match(content, /if each of the conditions set forth in Section ‎5\.1 and Section ‎5\.2 have been satisfied or waived/);
  assert.match(content, /except where this Agreement is validly terminated in accordance with Article ‎VI/);
  assert.match(content, /waives any requirement for the security or posting of any bond/);
  assert.match(content, /automatically extended until the date that is five \(5\) business days after/);
});
