const EMPTY_STATES = {
  not_applicable: {
    label: 'N/A',
    title: 'This field does not apply to this deal structure.',
    tone: 'muted',
  },
  silent: {
    label: 'Silent',
    title: 'The agreement is silent on this point.',
    tone: 'muted',
  },
  extraction_pending: {
    label: 'Extraction pending',
    title: 'This field needs a targeted re-extract before it can be trusted.',
    tone: 'info',
    action: 'reextract',
  },
  needs_review: {
    label: 'Needs review',
    title: 'This field needs lawyer or operator review.',
    tone: 'warning',
    action: 'review',
  },
};

function renderEmpty(feature) {
  const policy = (feature && feature.whenEmpty) || 'needs_review';
  const state = EMPTY_STATES[policy] || EMPTY_STATES.needs_review;
  return {
    kind: 'empty',
    state: policy in EMPTY_STATES ? policy : 'needs_review',
    label: state.label,
    title: state.title,
    tone: state.tone,
    action: state.action || null,
    featureKey: feature && feature.key ? feature.key : null,
  };
}

module.exports = {
  EMPTY_STATES,
  renderEmpty,
};
