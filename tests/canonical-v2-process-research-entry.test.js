const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  isCanonicalV2ProcessPilotUiEnabled,
} = require('../lib/canonical-v2/feature-flags');
const {
  PROCESS_RESEARCH_PILOT_FIXTURE,
  getProcessResearchPilotFixture,
} = require('../__fixtures__/canonical-v2/process-research-pilot');

const ROOT = path.join(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function assertFrozenDeep(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertFrozenDeep(child);
}

test('the Process preview flag is server-only and requires an explicit preview environment', () => {
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({}), false);
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({ CANONICAL_V2_PROCESS_PILOT_UI_ENABLED: 'true' }), false);
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({ VERCEL_ENV: 'preview' }), false);
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({ CANONICAL_V2_PROCESS_PILOT_UI_ENABLED: 'true', VERCEL_ENV: 'production' }), false);
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({ CANONICAL_V2_PROCESS_PILOT_UI_ENABLED: 'true', VERCEL_ENV: 'preview' }), true);
  assert.equal(isCanonicalV2ProcessPilotUiEnabled({ CANONICAL_V2_PROCESS_PILOT_UI_ENABLED: 'yes', VERCEL_ENV: 'preview' }), true);
});

test('the pilot route redirects in production before it can render a fixture', () => {
  const page = source('pages/query/process/pilot.js');
  assert.match(page, /export function getServerSideProps\(\)/);
  assert.match(page, /if \(!isCanonicalV2ProcessPilotUiEnabled\(\)\)/);
  assert.match(page, /destination: '\/'/);
  assert.match(page, /permanent: false/);
  assert.match(page, /getProcessResearchPilotFixture\(\)/);
});

test('the pilot fixture is deeply immutable and is the sole Product payload for both views', () => {
  assert.equal(getProcessResearchPilotFixture(), PROCESS_RESEARCH_PILOT_FIXTURE);
  assertFrozenDeep(PROCESS_RESEARCH_PILOT_FIXTURE);
  const presentation = PROCESS_RESEARCH_PILOT_FIXTURE.presentation;
  assert.equal(presentation.view_contract.passage_and_table_use_same_payload, true);
  assert.deepEqual(
    presentation.ordered_product_result_slot_identities,
    presentation.result_slots.map((slot) => slot.slot_identity),
  );
  assert.match(source('pages/query/process/pilot.js'), /presentation=\{fixture\.presentation\}/);
  assert.match(source('components/process/ProcessResearchSurface.jsx'), /<ProcessResultsTable presentation=\{presentation\}/);
  assert.match(source('components/process/ProcessResearchSurface.jsx'), /<ProcessPassageList presentation=\{presentation\}/);
});

test('the fixture has eight distinct exact passages and one typed unavailable sibling', () => {
  const slots = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.result_slots;
  const validSlots = slots.filter((slot) => slot.slot_state === 'VALID');
  const unavailableSlots = slots.filter((slot) => slot.slot_state === 'UNAVAILABLE');
  assert.equal(validSlots.length, 8);
  assert.equal(unavailableSlots.length, 1);
  assert.equal(new Set(validSlots.map((slot) => slot.slot_identity)).size, 8);
  assert.equal(new Set(validSlots.map((slot) => slot.exact_content)).size, 8);
  for (const slot of validSlots) {
    assert.match(slot.exact_content, /\.$/);
    assert.equal(slot.preview.content, slot.exact_content);
    assert.equal(slot.preview.truncated, false);
    assert.equal(typeof slot.exact_citation.human_readable_source_label, 'string');
    assert.equal(slot.action_targets.every((target) => target.action_state === 'AVAILABLE'), true);
  }
  assert.equal(unavailableSlots[0].failure.failure_kind, 'SYNTHETIC_TYPED_UNAVAILABLE');
});

test('the fixture supplies renderer navigation, filters, source context and verbatim related drafting', () => {
  const fixture = PROCESS_RESEARCH_PILOT_FIXTURE;
  assert.equal(fixture.fixture_kind, 'SYNTHETIC_PROCESS_RESEARCH_PREVIEW_ONLY');
  assert.equal(fixture.presentation.filter_sentence.ordered_filter_segments.length >= 2, true);
  assert.equal(fixture.navigation.topics.length > 0, true);
  assert.equal(fixture.filter_fields.length >= 2, true);
  assert.equal(fixture.related_passages.length >= 2, true);
  assert.equal(fixture.related_passages.every((passage) => passage.exact_content.endsWith('.') && passage.exact_citation), true);
  assert.equal(fixture.source_readers.length, 8);
  assert.equal(
    new Set(fixture.source_readers.map((reader) => reader.product_query_result_identity)).size,
    8,
  );
  assert.equal(
    fixture.source_readers.every((reader) => (
      reader.context_actions.some((action) => action.action_kind === 'EXPAND_CONTEXT_ABOVE')
      && reader.context_actions.some((action) => action.action_kind === 'EXPAND_CONTEXT_BELOW')
      && reader.context_actions.some((action) => action.action_kind === 'LIST_RELATED_PASSAGES')
    )),
    true,
  );
  assert.doesNotMatch(JSON.stringify(fixture), /\bCVR\b|Metsera/i);
});

test('each source action opens only the reader bound to the selected Product result', () => {
  const page = source('pages/query/process/pilot.js');
  assert.match(page, /candidate\.product_query_result_identity === action\.product_query_result_identity/);
  assert.match(page, /setReader\(selectedReader \|\| null\)/);
  for (const slot of PROCESS_RESEARCH_PILOT_FIXTURE.presentation.result_slots.filter(
    (candidate) => candidate.slot_state === 'VALID',
  )) {
    const reader = PROCESS_RESEARCH_PILOT_FIXTURE.source_readers.find(
      (candidate) => candidate.product_query_result_identity === slot.product_query_result_identity,
    );
    assert.ok(reader);
    assert.equal(reader.exact_content, slot.exact_content);
    assert.deepEqual(reader.exact_citation, slot.exact_citation);
  }
});

test('the entry has no network, source, database, execution or authority dependency', () => {
  const page = source('pages/query/process/pilot.js');
  const fixture = source('__fixtures__/canonical-v2/process-research-pilot.js');
  for (const contents of [page, fixture]) {
    assert.doesNotMatch(contents, /\bfetch\s*\(|XMLHttpRequest|WebSocket|readFile|createClient|supabase|serving-client|extract(?:ion)?|query\/run|authority.*(?:grant|write)|writeFile/i);
  }
  assert.doesNotMatch(page, /from ['"][^'"]*(?:canonical-v2\/serving|query\/engine|source)[^'"]*['"]/i);
});

test('the home link is proven at static generation and the legacy launch box cannot infer the flag', () => {
  const home = source('pages/index.js');
  const launch = source('components/query/QueryLaunchBox.jsx');
  assert.match(home, /processPilotUiEnabled: isCanonicalV2ProcessPilotUiEnabled\(\)/);
  assert.match(home, /processPilotUiEnabled && \(/);
  assert.match(home, /href="\/query\/process\/pilot"/);
  assert.match(launch, /processPilotUiEnabled = false/);
  assert.match(launch, /processPilotUiEnabled && \(/);
  assert.match(launch, /href="\/query\/process\/pilot"/);
});
