const ACTION_KINDS = [
  ['OPEN_SOURCE', 'Open source'],
  ['OPEN_EXACT_DETAIL', 'Open detail'],
  ['COPY_EXACT_PASSAGE', 'Copy exact passage'],
  ['SHARE_EXACT_RESULT', 'Share exact result'],
  ['SELECT_FOR_EXPORT', 'Select for export'],
];

const SYNTHETIC_RELEASE = Object.freeze({
  approved_pm_data_version_id: 'synthetic-pm-data-version-process-preview-v1',
  candidate_release_manifest_id: 'synthetic-process-preview-release-v1',
  release_state: 'ACTIVE',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function citation(ordinal, section) {
  return {
    human_readable_source_label: `Synthetic agreement ${ordinal}, ${section}`,
    source_location_label: `${section}, paragraph ${ordinal}`,
    source_identity: `synthetic-source-${ordinal}`,
    source_interval: { start: ordinal * 100, end: ordinal * 100 + 99 },
  };
}

function filterSegmentKey(segment) {
  return `${segment.field_reference?.field_key}:${segment.field_reference?.field_version}:${JSON.stringify(segment.value)}`;
}

function shareReference(ordinal) {
  return `synthetic-process-share:${SYNTHETIC_RELEASE.candidate_release_manifest_id}:synthetic-result-${ordinal}`;
}

const PASSAGES = [
  'From and after the date of this Agreement until the earlier of the Effective Time and termination of this Agreement, the Company shall not, and shall cause its Representatives not to, solicit, initiate or knowingly encourage any inquiry, proposal or offer that constitutes, or could reasonably be expected to lead to, an Acquisition Proposal.',
  'The Company may furnish information to, and enter into discussions with, a person making an unsolicited bona fide written Acquisition Proposal only if the Company Board determines in good faith, after consultation with its financial adviser and outside legal counsel, that the proposal constitutes or could reasonably be expected to result in a Superior Proposal.',
  'Before taking any action permitted by this Section, the Company shall provide Parent with written notice of the identity of the person making the Acquisition Proposal and the material terms and conditions of that Acquisition Proposal, including copies of all written proposals and agreements.',
  'The Company shall keep Parent reasonably informed on a prompt basis of any material developments, discussions or negotiations regarding an Acquisition Proposal and shall provide Parent with copies of any material written correspondence received by the Company or its Representatives.',
  'The Company Board may make a Company Adverse Recommendation Change in response to an Intervening Event only after giving Parent at least four Business Days\' prior written notice of its intention to do so and negotiating with Parent in good faith during that period regarding any revisions to this Agreement proposed by Parent.',
  'The Company shall not enter into any agreement with respect to an Acquisition Proposal during the Notice Period, and Parent may deliver a binding written proposal to amend the terms of this Agreement at any time before the end of that period.',
  'Nothing in this Agreement shall prohibit the Company or the Company Board from complying with Rule 14d-9 or Rule 14e-2 under the Exchange Act, provided that any disclosure that has the effect of an Adverse Recommendation Change shall be subject to the notice and matching rights in this Section.',
  'The Company shall immediately cease and cause to be terminated all existing activities, discussions and negotiations with any person relating to an Acquisition Proposal, and shall request the prompt return or destruction of all confidential information previously furnished to that person.',
];

function actionTargets(ordinal) {
  return ACTION_KINDS.map(([actionKind, accessibleName]) => ({
    action_kind: actionKind,
    action_state: 'AVAILABLE',
    accessible_name: accessibleName,
    product_query_result_identity: `synthetic-result-${ordinal}`,
    citation_target_identity: `synthetic-citation-${ordinal}`,
    ...(actionKind === 'SHARE_EXACT_RESULT' ? {
      share_reference: shareReference(ordinal),
      approved_pm_data_version_id: SYNTHETIC_RELEASE.approved_pm_data_version_id,
      candidate_release_manifest_id: SYNTHETIC_RELEASE.candidate_release_manifest_id,
    } : {}),
  }));
}

function validSlot(content, index) {
  const ordinal = index + 1;
  return {
    slot_identity: `synthetic-slot-${ordinal}`,
    slot_state: 'VALID',
    product_query_result_identity: `synthetic-result-${ordinal}`,
    domain_key: 'PROCESS',
    exact_content: content,
    preview: { content, truncated: false },
    metadata: [
      { field_reference: { field_key: 'process_phase', field_version: 1 }, label: 'Process phase', value: 'PRE_SIGNING', typed_state: null },
      { field_reference: { field_key: 'notice_period_business_days', field_version: 1 }, label: 'Notice period', value: 4, typed_state: null },
    ],
    exact_citation: citation(ordinal, ordinal === 5 ? 'Board recommendation change' : 'No-shop covenant'),
    action_targets: actionTargets(ordinal),
  };
}

const resultSlots = PASSAGES.map(validSlot);
resultSlots.splice(4, 0, {
  slot_identity: 'synthetic-slot-unavailable-5',
  slot_state: 'UNAVAILABLE',
  failure: {
    failure_kind: 'SYNTHETIC_TYPED_UNAVAILABLE',
    disposition: 'UNAVAILABLE',
    user_message: 'This synthetic sibling is unavailable.',
  },
});

const sourceReaders = PASSAGES.map((content, index) => {
  const ordinal = index + 1;
  const exactCitation = citation(
    ordinal,
    ordinal === 5 ? 'Board recommendation change' : 'No-shop covenant',
  );
  return {
    product_query_result_identity: `synthetic-result-${ordinal}`,
    label: exactCitation.human_readable_source_label,
    exact_content: content,
    exact_citation: exactCitation,
    selected_evidence_identity: `synthetic-evidence-${ordinal}`,
    context_paragraphs_above: [
      `Synthetic earlier context ${ordinal}. This paragraph is admitted only for the selected passage.`,
      `Synthetic earlier context ${ordinal}, second paragraph. This paragraph remains local to the fixture.`,
    ],
    context_paragraphs_below: [
      `Synthetic later context ${ordinal}. This paragraph is admitted only for the selected passage.`,
      `Synthetic later context ${ordinal}, second paragraph. This paragraph remains local to the fixture.`,
    ],
    context_actions: [
      { label: 'One paragraph above', action_kind: 'EXPAND_CONTEXT_ABOVE', direction: 'ABOVE' },
      { label: 'One paragraph below', action_kind: 'EXPAND_CONTEXT_BELOW', direction: 'BELOW' },
      { label: 'Related drafting', action_kind: 'LIST_RELATED_PASSAGES' },
    ],
  };
});

const PROCESS_RESEARCH_PILOT_FIXTURE = deepFreeze({
  fixture_kind: 'SYNTHETIC_PROCESS_RESEARCH_PREVIEW_ONLY',
  immutable: true,
  release: SYNTHETIC_RELEASE,
  presentation: {
    fixture_notice: 'SYNTHETIC FIXTURE. PREVIEW ONLY. NOT CORPUS DATA.',
    understood_legal_question: {
      label: 'What no-shop process steps apply before a recommendation change?',
      domain_key: 'PROCESS',
      predicate_key: 'NO_SHOP_RECOMMENDATION_CHANGE',
      predicate_version: 1,
    },
    filter_sentence: {
      rendering_mode: 'ONE_COMPACT_PRACTITIONER_SENTENCE',
      subject: {
        label: 'What no-shop process steps apply before a recommendation change?',
        editable: true,
      },
      ordered_filter_segments: [
        {
          segment_ordinal: 1,
          field_reference: { field_key: 'process_phase', field_version: 1 },
          field_label: 'Process phase',
          practitioner_operator: 'is',
          value: 'PRE_SIGNING',
          editable: true,
          clearable: true,
        },
        {
          segment_ordinal: 2,
          field_reference: { field_key: 'notice_period_business_days', field_version: 1 },
          field_label: 'Notice period',
          practitioner_operator: 'is at least',
          value: 4,
          editable: true,
          clearable: true,
        },
      ],
    },
    view_contract: {
      default_view: 'ANSWER_FIRST_PASSAGES',
      permitted_views: ['ANSWER_FIRST_PASSAGES', 'DENSE_TABLE'],
      passage_and_table_use_same_payload: true,
      renderer_can_add_omit_reorder_or_change_content: false,
    },
    columns: [
      { field_reference: { field_key: 'process_phase', field_version: 1 }, label: 'Process phase' },
      { field_reference: { field_key: 'notice_period_business_days', field_version: 1 }, label: 'Notice period' },
    ],
    ordered_product_result_slot_identities: resultSlots.map((slot) => slot.slot_identity),
    result_slots: resultSlots,
    coverage: {
      coverage_certification_state: 'SYNTHETIC_NOT_A_COVERAGE_CLAIM',
      covered_deal_count: 8,
      excluded_deal_count: 0,
    },
    counts: {
      valid_result_count: 8,
      failed_result_count: 1,
      emitted_result_slot_count: 9,
    },
    empty_result: null,
  },
  navigation: {
    selected_pattern_key: 'no-shop-recommendation-change',
    topics: [
      {
        key: 'board-process',
        label: 'Board process',
        patterns: [
          { key: 'no-shop-recommendation-change', label: 'No-shop recommendation change' },
          { key: 'superior-proposal-notice', label: 'Superior proposal notice' },
        ],
      },
    ],
  },
  filter_fields: [
    {
      field_reference: { field_key: 'process_phase', field_version: 1 },
      label: 'Process phase',
      control_type: 'SELECT',
      value_options: ['PRE_SIGNING', 'POST_SIGNING'],
    },
    {
      field_reference: { field_key: 'notice_period_business_days', field_version: 1 },
      label: 'Notice period',
      control_type: 'NUMBER',
      value_options: [],
    },
  ],
  admitted_options_projection: [
    {
      field_reference: { field_key: 'process_phase', field_version: 1 },
      other_active_filter_segment_keys: [
        'notice_period_business_days:1:4',
      ],
      value_options: [
        { value: 'PRE_SIGNING', label: 'Pre-signing' },
      ],
    },
    {
      field_reference: { field_key: 'process_phase', field_version: 1 },
      other_active_filter_segment_keys: [],
      value_options: [
        { value: 'PRE_SIGNING', label: 'Pre-signing' },
        { value: 'POST_SIGNING', label: 'Post-signing' },
      ],
    },
  ],
  related_passages: [
    {
      slot_identity: 'synthetic-related-1',
      exact_content: 'For the avoidance of doubt, the Company may disclose a factually accurate description of Parent\'s proposal, the Company Board\'s recommendation and the consequences of the Merger to the extent required by applicable Law, so long as the disclosure does not constitute an Adverse Recommendation Change.',
      exact_citation: citation(9, 'Permitted disclosure'),
    },
    {
      slot_identity: 'synthetic-related-2',
      exact_content: 'If any material amendment to an Acquisition Proposal is made, the Company shall deliver a new notice to Parent and the applicable Notice Period shall recommence, except that the renewed period need not exceed two Business Days for an immaterial amendment.',
      exact_citation: citation(10, 'Renewed notice period'),
    },
  ],
  source_readers: sourceReaders,
  share_links: resultSlots
    .filter((slot) => slot.slot_state === 'VALID')
    .map((slot) => ({
      share_reference: shareReference(Number(slot.product_query_result_identity.split('-').pop())),
      product_query_result_identity: slot.product_query_result_identity,
      approved_pm_data_version_id: SYNTHETIC_RELEASE.approved_pm_data_version_id,
      candidate_release_manifest_id: SYNTHETIC_RELEASE.candidate_release_manifest_id,
      slot_identity: slot.slot_identity,
    })),
});

function getProcessResearchPilotFixture() {
  return PROCESS_RESEARCH_PILOT_FIXTURE;
}

function fixtureShareHref(shareReferenceValue) {
  return `#process-research-share=${encodeURIComponent(shareReferenceValue)}`;
}

function resolveProcessResearchPilotShare(fixture, shareReferenceValue) {
  const shareLink = fixture?.share_links?.find((candidate) => (
    candidate.share_reference === shareReferenceValue
  ));
  if (!shareLink) {
    return Object.freeze({ outcome: 'SHARE_REFERENCE_NOT_FOUND' });
  }
  if (fixture.release?.release_state !== 'ACTIVE') {
    return Object.freeze({
      outcome: 'RELEASE_NOT_ACTIVE',
      product_query_result_identity: shareLink.product_query_result_identity,
      approved_pm_data_version_id: shareLink.approved_pm_data_version_id,
      candidate_release_manifest_id: shareLink.candidate_release_manifest_id,
    });
  }
  const resultSlot = fixture.presentation?.result_slots?.find((candidate) => (
    candidate.slot_identity === shareLink.slot_identity
    && candidate.product_query_result_identity === shareLink.product_query_result_identity
  ));
  if (!resultSlot) return Object.freeze({ outcome: 'SHARE_RESULT_NOT_FOUND' });
  return Object.freeze({
    outcome: 'OPENED',
    product_query_result_identity: shareLink.product_query_result_identity,
    approved_pm_data_version_id: shareLink.approved_pm_data_version_id,
    candidate_release_manifest_id: shareLink.candidate_release_manifest_id,
    result_slot: resultSlot,
  });
}

function exactPassageCopyText(action) {
  const citationLabel = action?.citation?.human_readable_source_label
    || action?.citation?.source_location_label
    || 'Exact citation unavailable';
  return `${action?.exact_passage || ''}\n\n${citationLabel}`;
}

function admittedFixtureFilterOptions({
  fieldReference,
  activeFilterSegments = [],
  admittedOptionsProjection = [],
}) {
  const otherKeys = activeFilterSegments
    .filter((segment) => (
      segment.field_reference?.field_key !== fieldReference?.field_key
      || segment.field_reference?.field_version !== fieldReference?.field_version
    ))
    .map(filterSegmentKey)
    .sort();
  const projection = admittedOptionsProjection.find((candidate) => (
    candidate.field_reference?.field_key === fieldReference?.field_key
    && candidate.field_reference?.field_version === fieldReference?.field_version
    && JSON.stringify([...candidate.other_active_filter_segment_keys].sort()) === JSON.stringify(otherKeys)
  ));
  return Object.freeze([...(projection?.value_options || [])]);
}

function openProcessResearchPilotReader(sourceReader) {
  return {
    ...sourceReader,
    selected_exact_content: sourceReader.exact_content,
    context_above: [],
    context_below: [],
  };
}

function applyProcessResearchPilotContextAction(reader, action) {
  const direction = action?.direction;
  if (!reader || !['ABOVE', 'BELOW'].includes(direction)) {
    return Object.freeze({ outcome: 'INVALID_CONTEXT_ACTION', reader });
  }
  const key = direction === 'ABOVE' ? 'context_above' : 'context_below';
  const availableKey = direction === 'ABOVE'
    ? 'context_paragraphs_above'
    : 'context_paragraphs_below';
  const applied = reader[key] || [];
  const available = reader[availableKey] || [];
  if (applied.length >= available.length) {
    return Object.freeze({ outcome: 'CONTEXT_LIMIT_REACHED', reader });
  }
  const nextParagraph = available[applied.length];
  const nextReader = {
    ...reader,
    [key]: direction === 'ABOVE'
      ? [nextParagraph, ...applied]
      : [...applied, nextParagraph],
  };
  return Object.freeze({ outcome: 'CONTEXT_EXPANDED', reader: nextReader });
}

function openProcessResearchPilotRelatedPassage(passage) {
  return {
    product_query_result_identity: passage.slot_identity,
    selected_evidence_identity: passage.slot_identity,
    label: passage.exact_citation?.human_readable_source_label,
    exact_content: passage.exact_content,
    selected_exact_content: passage.exact_content,
    exact_citation: passage.exact_citation,
    context_actions: [],
    context_above: [],
    context_below: [],
  };
}

module.exports = {
  PROCESS_RESEARCH_PILOT_FIXTURE,
  getProcessResearchPilotFixture,
  fixtureShareHref,
  resolveProcessResearchPilotShare,
  exactPassageCopyText,
  admittedFixtureFilterOptions,
  openProcessResearchPilotReader,
  applyProcessResearchPilotContextAction,
  openProcessResearchPilotRelatedPassage,
};
