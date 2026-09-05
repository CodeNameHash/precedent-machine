import { displaySectionReference } from '../../lib/product/section-reference-display';

export function findingResolutionCommand(findings, selections) {
  return findings.flatMap((item) => {
    if (item.original.state === 'NOT_RUN') return [];
    const selected = selections[item.item_id];
    if (selected?.disposition === 'PUBLISHED_FACT') return [{
      finding_item_id: item.item_id,
      disposition: selected.disposition,
      published_fact_review_item_id: selected.published_fact_review_item_id || '',
    }];
    if (selected?.disposition === 'REVIEWED_OMISSION') return [{
      finding_item_id: item.item_id,
      disposition: selected.disposition,
      omission_reason: selected.omission_reason || '',
    }];
    return [];
  });
}

export default function FindingResolutionFields({ findings, facts, selections, onChange, busy, onSource }) {
  if (!findings.length) return null;
  return <section className="space-y-3" data-testid="finding-resolution-fields">
    <h3 className="text-sm font-semibold">Resolve model findings</h3>
    <p className="text-sm text-inkLight">Acknowledging a finding does not resolve it. Link it to a corrected final fact, or explain why it is omitted. An unresolved finding still blocks release.</p>
    {findings.map((item, index) => {
      const selected = selections[item.item_id] || {};
      const original = item.original;
      const factType = original.subject_kind === 'FACT_TYPE' ? original.subject_id?.split(':').pop() : null;
      const choices = facts.filter((fact) => (!item.structure_node_id || fact.structure_node_id === item.structure_node_id)
        && (!item.family_key || fact.family_key === item.family_key)
        && (!factType || fact.fact_type === factType));
      const notRun = original.state === 'NOT_RUN';
      return <fieldset key={item.item_id} className="min-w-0 rounded border border-border p-3 text-sm">
        <legend className="px-1 font-medium">Finding {index + 1}: {(original.code || original.subject_kind || item.kind).replaceAll('_', ' ')}</legend>
        {item.family_key ? <p>{item.family_key.replaceAll('_', ' ')}</p> : null}
        {original.section_reference ? <p>{displaySectionReference(original.section_reference)}</p> : null}
        {original.message || original.reason ? <p className="my-2 whitespace-pre-wrap">{original.message || original.reason}</p> : null}
        {onSource && item.source_span_ids?.length ? <button type="button" onClick={() => onSource(item.source_closure_id, item.source_span_ids[0])} className="mb-2 text-xs font-semibold text-accent">View finding source</button> : null}
        {notRun ? <p className="text-red-700">This work did not run. A review decision cannot mark it complete.</p> : <>
          <select aria-label={`Finding ${index + 1} resolution`} disabled={busy} value={selected.disposition || 'UNRESOLVED'} onChange={(event) => onChange(item.item_id, { disposition: event.target.value, published_fact_review_item_id: '', omission_reason: '' })} className="block w-full rounded border border-border p-2 text-sm">
            <option value="UNRESOLVED">Unresolved</option>
            <option value="PUBLISHED_FACT">Resolved by a final fact</option>
            <option value="REVIEWED_OMISSION">Reviewed omission</option>
          </select>
          {selected.disposition === 'PUBLISHED_FACT' ? <select required aria-label={`Finding ${index + 1} final fact`} disabled={busy} value={selected.published_fact_review_item_id || ''} onChange={(event) => onChange(item.item_id, { ...selected, published_fact_review_item_id: event.target.value })} className="mt-2 block w-full rounded border border-border p-2 text-sm">
            <option value="">Select the final fact that resolves this finding</option>
            {choices.map((fact) => <option key={fact.review_item_id} value={fact.review_item_id}>{fact.statement}</option>)}
          </select> : null}
          {selected.disposition === 'REVIEWED_OMISSION' ? <textarea required aria-label={`Finding ${index + 1} omission reason`} disabled={busy} value={selected.omission_reason || ''} onChange={(event) => onChange(item.item_id, { ...selected, omission_reason: event.target.value })} placeholder="Explain the legal reason for omitting this finding." className="mt-2 block w-full rounded border border-border p-2 text-sm" /> : null}
        </>}
      </fieldset>;
    })}
  </section>;
}
