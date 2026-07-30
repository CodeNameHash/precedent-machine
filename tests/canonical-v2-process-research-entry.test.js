const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  isCanonicalV2ProcessPilotUiEnabled,
} = require('../lib/canonical-v2/feature-flags');
const {
  PROCESS_RESEARCH_PILOT_FIXTURE,
  admittedFixtureFilterOptions,
  applyProcessResearchPilotContextAction,
  exactPassageCopyText,
  fixtureSlotSatisfiesFilterSegments,
  getProcessResearchPilotFixture,
  isAdmittedFixtureFilterValue,
  openProcessResearchPilotReader,
  openProcessResearchPilotRelatedPassage,
  resolveProcessResearchPilotShare,
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
  assert.equal(fixture.admitted_options_projection.length >= 2, true);
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

test('the synthetic share reference is release-pinned and refuses an inactive release', () => {
  const slot = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.result_slots.find(
    (candidate) => candidate.slot_state === 'VALID',
  );
  const shareAction = slot.action_targets.find(
    (candidate) => candidate.action_kind === 'SHARE_EXACT_RESULT',
  );
  const opened = resolveProcessResearchPilotShare(
    PROCESS_RESEARCH_PILOT_FIXTURE,
    shareAction.share_reference,
  );
  assert.equal(opened.outcome, 'OPENED');
  assert.equal(opened.product_query_result_identity, slot.product_query_result_identity);
  assert.equal(
    opened.approved_pm_data_version_id,
    PROCESS_RESEARCH_PILOT_FIXTURE.release.approved_pm_data_version_id,
  );
  assert.equal(opened.result_slot, slot);

  const inactiveFixture = {
    ...PROCESS_RESEARCH_PILOT_FIXTURE,
    release: { ...PROCESS_RESEARCH_PILOT_FIXTURE.release, release_state: 'INACTIVE' },
  };
  const refused = resolveProcessResearchPilotShare(inactiveFixture, shareAction.share_reference);
  assert.equal(refused.outcome, 'RELEASE_NOT_ACTIVE');
  assert.equal(refused.product_query_result_identity, slot.product_query_result_identity);
  assert.equal(refused.approved_pm_data_version_id, opened.approved_pm_data_version_id);
});

test('the fixture copy payload is exact passage text followed by its exact citation', () => {
  const slot = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.result_slots.find(
    (candidate) => candidate.slot_state === 'VALID',
  );
  const copyAction = slot.action_targets.find(
    (candidate) => candidate.action_kind === 'COPY_EXACT_PASSAGE',
  );
  const text = exactPassageCopyText({
    ...copyAction,
    exact_passage: slot.exact_content,
    citation: slot.exact_citation,
  });
  assert.equal(text, `${slot.exact_content}\n\n${slot.exact_citation.human_readable_source_label}`);
});

test('fixed-value filter options use the exact projection after other active segments apply', () => {
  const sentence = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.filter_sentence;
  const phase = sentence.ordered_filter_segments[0];
  assert.deepEqual(
    admittedFixtureFilterOptions({
      fieldReference: phase.field_reference,
      activeFilterSegments: sentence.ordered_filter_segments,
      admittedOptionsProjection: PROCESS_RESEARCH_PILOT_FIXTURE.admitted_options_projection,
    }),
    [{ value: 'PRE_SIGNING', label: 'Pre-signing' }],
  );
  assert.deepEqual(
    admittedFixtureFilterOptions({
      fieldReference: phase.field_reference,
      activeFilterSegments: [phase],
      admittedOptionsProjection: PROCESS_RESEARCH_PILOT_FIXTURE.admitted_options_projection,
    }),
    [
      { value: 'PRE_SIGNING', label: 'Pre-signing' },
    ],
  );
});

test('arbitrary and stale values are not admitted by the exact filter projection', () => {
  const sentence = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.filter_sentence;
  const notice = sentence.ordered_filter_segments[1];
  const input = {
    fieldReference: notice.field_reference,
    activeFilterSegments: sentence.ordered_filter_segments,
    admittedOptionsProjection: PROCESS_RESEARCH_PILOT_FIXTURE.admitted_options_projection,
  };
  assert.deepEqual(admittedFixtureFilterOptions(input), [
    { value: 4, label: '4 business days' },
  ]);
  assert.equal(isAdmittedFixtureFilterValue({ ...input, value: 999 }), false);
  assert.equal(isAdmittedFixtureFilterValue({ ...input, value: '4' }), false);
  assert.equal(isAdmittedFixtureFilterValue({ ...input, value: 4 }), true);
});

test('switching from numeric Notice period to Process phase clears the stale value before Apply', () => {
  const sentence = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.filter_sentence;
  const phase = sentence.ordered_filter_segments[0];
  const notice = sentence.ordered_filter_segments[1];
  const phaseInput = {
    fieldReference: phase.field_reference,
    activeFilterSegments: sentence.ordered_filter_segments,
    admittedOptionsProjection: PROCESS_RESEARCH_PILOT_FIXTURE.admitted_options_projection,
  };
  const phaseOptions = admittedFixtureFilterOptions(phaseInput);
  assert.equal(notice.value, 4);
  assert.equal(phaseOptions.some((option) => option.value === notice.value), false);

  const editorSource = source('components/process/ProcessFilterEditor.jsx');
  const handler = editorSource.match(
    /onChange=\{\(event\) => \{ (setSelectedFieldIdentity\(event\.target\.value\); setValue\(''\);) \}\}/,
  );
  assert.ok(handler);
  let selectedFieldIdentity = 'notice_period_business_days:1';
  let selectedValue = notice.value;
  new Function(
    'event',
    'setSelectedFieldIdentity',
    'setValue',
    handler[1],
  )(
    { target: { value: 'process_phase:1' } },
    (next) => { selectedFieldIdentity = next; },
    (next) => { selectedValue = next; },
  );
  assert.equal(selectedFieldIdentity, 'process_phase:1');
  assert.equal(selectedValue, '');
  assert.equal(
    isAdmittedFixtureFilterValue({ ...phaseInput, value: selectedValue }),
    false,
  );
});

test('every displayed valid result satisfies every initial active filter segment', () => {
  const segments = PROCESS_RESEARCH_PILOT_FIXTURE.presentation
    .filter_sentence.ordered_filter_segments;
  const validSlots = PROCESS_RESEARCH_PILOT_FIXTURE.presentation.result_slots
    .filter((slot) => slot.slot_state === 'VALID');
  assert.equal(validSlots.length, 8);
  assert.equal(
    validSlots.every((slot) => fixtureSlotSatisfiesFilterSegments(slot, segments)),
    true,
  );
  assert.equal(
    validSlots.every((slot) => fixtureSlotSatisfiesFilterSegments(slot, [segments[0]])),
    true,
  );
  assert.equal(
    validSlots.every((slot) => fixtureSlotSatisfiesFilterSegments(slot, [segments[1]])),
    true,
  );
});

test('context adds one admitted paragraph, preserves selected evidence and isolates invalid actions', () => {
  const source = PROCESS_RESEARCH_PILOT_FIXTURE.source_readers[0];
  const reader = openProcessResearchPilotReader(source);
  const above = source.context_actions.find((action) => action.direction === 'ABOVE');
  const first = applyProcessResearchPilotContextAction(reader, above);
  assert.equal(first.outcome, 'CONTEXT_EXPANDED');
  assert.equal(first.reader.context_above.length, 1);
  assert.equal(first.reader.context_above[0], source.context_paragraphs_above[0]);
  assert.equal(first.reader.selected_evidence_identity, reader.selected_evidence_identity);
  assert.equal(first.reader.selected_exact_content, reader.selected_exact_content);

  const second = applyProcessResearchPilotContextAction(first.reader, above);
  assert.equal(second.outcome, 'CONTEXT_EXPANDED');
  assert.equal(second.reader.context_above.length, 2);
  const limited = applyProcessResearchPilotContextAction(second.reader, above);
  assert.equal(limited.outcome, 'CONTEXT_LIMIT_REACHED');
  assert.equal(limited.reader, second.reader);

  const invalid = applyProcessResearchPilotContextAction(second.reader, { action_kind: 'UNADMITTED' });
  assert.equal(invalid.outcome, 'INVALID_CONTEXT_ACTION');
  assert.equal(invalid.reader, second.reader);
  assert.equal(invalid.reader.selected_exact_content, reader.selected_exact_content);
});

test('related drafting opens the exact related passage and citation in the local reader', () => {
  const related = PROCESS_RESEARCH_PILOT_FIXTURE.related_passages[0];
  const reader = openProcessResearchPilotRelatedPassage(related);
  assert.equal(reader.selected_exact_content, related.exact_content);
  assert.equal(reader.exact_citation, related.exact_citation);
  assert.equal(reader.selected_evidence_identity, related.slot_identity);
});

test('each source action opens only the reader bound to the selected Product result', () => {
  const page = source('pages/query/process/pilot.js');
  assert.match(page, /candidate\.product_query_result_identity === action\.product_query_result_identity/);
  assert.match(page, /openProcessResearchPilotReader\(selectedReader\)/);
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

test('the bounded runtime acceptance inventory needs an explicit preview origin', async (t) => {
  const origin = process.env.PROCESS_RESEARCH_PILOT_RUNTIME_ORIGIN;
  if (!origin) {
    t.skip('No Process research preview origin was supplied.');
    return;
  }
  const response = await fetch(`${origin}/query/process/pilot`);
  assert.equal(response.ok, true);
  const body = await response.text();
  assert.match(body, /SYNTHETIC FIXTURE/);
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
