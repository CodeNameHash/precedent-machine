import { displayValue } from './processResearchView';

export default function ProcessFilterSentence({ sentence, onEditSubject, onEditSegment, onClearSegment }) {
  if (!sentence) return null;
  return (
    <section className="rounded border border-border bg-bg px-4 py-3" aria-label="Active Process research filters">
      <span className="text-sm text-ink">{sentence.subject?.label}</span>
      {sentence.subject?.editable ? <button type="button" onClick={() => onEditSubject?.(sentence.subject)} className="ml-2 text-xs font-medium text-inkLight underline">Edit question</button> : null}
      {(sentence.ordered_filter_segments || []).map((segment) => (
        <span key={`${segment.field_reference?.field_key}:${segment.segment_ordinal}`} className="text-sm text-ink">{' '}where {segment.field_label} {segment.practitioner_operator} {displayValue(segment.value)}{segment.editable ? <button type="button" onClick={() => onEditSegment?.(segment)} aria-label={`Edit ${segment.field_label}`} className="ml-1 text-xs text-inkLight underline">Edit</button> : null}{segment.clearable ? <button type="button" onClick={() => onClearSegment?.(segment)} aria-label={`Clear ${segment.field_label}`} className="ml-1 text-xs text-inkLight underline">Clear</button> : null}</span>
      ))}
    </section>
  );
}
