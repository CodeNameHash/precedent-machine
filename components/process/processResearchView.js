export const PASSAGE_VIEW = 'ANSWER_FIRST_PASSAGES';
export const TABLE_VIEW = 'DENSE_TABLE';

export function presentationSlots(presentation) {
  return Array.isArray(presentation?.result_slots) ? presentation.result_slots : [];
}

export function visibleSlots(presentation) {
  return presentationSlots(presentation).filter((slot) => slot?.slot_state === 'VALID' || slot?.slot_state === 'UNAVAILABLE');
}

export function actionTarget(slot, actionKind) {
  return (slot?.action_targets || []).find((target) => (
    target.action_kind === actionKind && target.action_state === 'AVAILABLE'
  )) || null;
}

export function actionInput(slot, actionKind) {
  const target = actionTarget(slot, actionKind);
  if (!target) return null;
  return { ...target };
}

export function exactCopyInput(slot) {
  if (!actionTarget(slot, 'COPY_EXACT_PASSAGE') || typeof slot?.exact_content !== 'string') return null;
  return {
    ...actionInput(slot, 'COPY_EXACT_PASSAGE'),
    exact_passage: slot.exact_content,
    citation: slot.exact_citation || null,
  };
}

export function displayValue(value, typedState) {
  if (typedState) return typedState.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined || value === '') return 'Not supplied';
  if (typeof value === 'object') return value.label || value.value || value.state || 'Unavailable';
  return String(value);
}

export function sourceLabel(slot) {
  return slot?.exact_citation?.human_readable_source_label
    || slot?.exact_citation?.source_location_label
    || 'Checked source';
}

export function isAdmittedCvr(slot) {
  return slot?.domain_key === 'CVR';
}

export function editorSelection(segment) {
  return segment ? [segment] : [];
}
