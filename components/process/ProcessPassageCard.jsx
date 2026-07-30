import { actionInput, actionTarget, displayValue, exactCopyInput, sourceLabel } from './processResearchView';

function invoke(callback, input) { if (callback && input) callback(input); }

export default function ProcessPassageCard({ slot, onOpenSource, onOpenDetail, onCopyExactPassage, onShare, onSelectForExport, onSave, onRerun, onCorrection }) {
  if (slot.slot_state === 'UNAVAILABLE') return <article className="rounded border border-border bg-bg p-4" role="status"><h3 className="text-sm font-medium text-ink">Result unavailable</h3><p className="mt-1 text-sm text-inkLight">This checked result is unavailable.</p></article>;
  const actions = [
    ['OPEN_SOURCE', onOpenSource], ['OPEN_EXACT_DETAIL', onOpenDetail], ['COPY_EXACT_PASSAGE', onCopyExactPassage], ['SHARE_EXACT_RESULT', onShare], ['SELECT_FOR_EXPORT', onSelectForExport],
  ];
  return (
    <article className="rounded border border-border bg-white p-4" aria-label={`Passage from ${sourceLabel(slot)}`}>
      <blockquote className="whitespace-pre-wrap border-l-2 border-ink pl-3 text-sm leading-6 text-ink">{slot.preview?.content ?? slot.exact_content}</blockquote>
      <p className="mt-3 text-xs font-medium text-inkLight">{sourceLabel(slot)}</p>
      {slot.metadata?.length ? <dl className="mt-3 grid gap-2 sm:grid-cols-2">{slot.metadata.map((field) => <div key={`${field.field_reference?.field_key}:${field.field_reference?.field_version}`}><dt className="text-xs text-inkLight">{field.label}</dt><dd className="text-sm text-ink">{displayValue(field.value, field.typed_state)}</dd></div>)}</dl> : null}
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">{actions.map(([kind, callback]) => { const target = actionTarget(slot, kind); if (!target || !callback) return null; const input = kind === 'COPY_EXACT_PASSAGE' ? exactCopyInput(slot) : actionInput(slot, kind); return <button key={kind} type="button" onClick={() => invoke(callback, input)} className="text-xs font-medium text-ink underline">{target.accessible_name}</button>; })}{onSave ? <button type="button" onClick={() => onSave(actionInput(slot, 'OPEN_EXACT_DETAIL'))} className="text-xs font-medium text-ink underline">Save</button> : null}{onRerun ? <button type="button" onClick={() => onRerun(actionInput(slot, 'OPEN_EXACT_DETAIL'))} className="text-xs font-medium text-ink underline">Rerun</button> : null}{onCorrection ? <button type="button" onClick={() => onCorrection(actionInput(slot, 'OPEN_EXACT_DETAIL'))} className="text-xs font-medium text-ink underline">Suggest correction</button> : null}</div>
    </article>
  );
}
