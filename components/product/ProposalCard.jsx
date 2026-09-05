import { useEffect, useState } from 'react';

const badge = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

function withRequiredRoles(existing, requiredRoleKeys) {
  return Object.fromEntries([...new Set([...requiredRoleKeys, ...Object.keys(existing || {})])]
    .map((key) => [key, existing?.[key] ?? '']));
}

export default function ProposalCard({ entry, onDecision, onSource, availableSourceSpans = [], requiredRoleKeys = [], busy }) {
  const { proposal, review_item: item, related_proposals: related, group_members: groupMembers = [] } = entry;
  const savedRoles = item?.edited_roles || proposal.roles || {};
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(item?.edited_statement || proposal.statement);
  const [roles, setRoles] = useState(() => withRequiredRoles(savedRoles, requiredRoleKeys));
  const [value, setValue] = useState(item?.edited_value ?? proposal.canonical_value ?? '');
  const [selectedSourceSpanIds, setSelectedSourceSpanIds] = useState(item?.source_span_ids || proposal.source_span_ids || []);
  const invalid = proposal.validation_status !== 'VALID';
  const reviewContext = [...(proposal.unmatched_evidence || []), ...(proposal.context_only_evidence || [])];
  const savedSourceSpanIds = item?.source_span_ids || proposal.source_span_ids || [];
  const primarySourceSpanId = savedSourceSpanIds[0] || reviewContext[0]?.source_span_id;
  const missingRequiredRoles = requiredRoleKeys.filter((key) => roles[key] === undefined
    || roles[key] === null || roles[key] === '');
  const needsCitationRepair = savedSourceSpanIds.length === 0;
  const savedMissingRequiredRoles = requiredRoleKeys.filter((key) => savedRoles[key] === undefined
    || savedRoles[key] === null || savedRoles[key] === '');
  const repairSaved = item?.decision === 'EDITED' && !needsCitationRepair
    && savedMissingRequiredRoles.length === 0;
  useEffect(() => {
    if (editing) return;
    setStatement(item?.edited_statement || proposal.statement);
    setRoles(withRequiredRoles(savedRoles, requiredRoleKeys));
    setValue(item?.edited_value ?? proposal.canonical_value ?? '');
    setSelectedSourceSpanIds(savedSourceSpanIds);
  }, [editing, item, proposal]);
  function updateRole(key, value, original) {
    let typed = value;
    if (Array.isArray(original)) typed = value.split(',').map((part) => part.trim()).filter(Boolean);
    else if (typeof original === 'number') typed = Number(value);
    else if (typeof original === 'boolean') typed = value === true || value === 'true';
    setRoles((current) => ({ ...current, [key]: typed }));
  }
  async function saveEdit() {
    await onDecision(item.item_id, 'EDITED', { statement, roles, value: proposal.canonical_value == null ? null : value, source_span_ids: selectedSourceSpanIds });
    setEditing(false);
  }
  function toggleSourceSpan(spanId) {
    setSelectedSourceSpanIds((current) => current.includes(spanId)
      ? current.filter((id) => id !== spanId) : [...current, spanId]);
  }
  function startEditing() {
    setStatement(item?.edited_statement || proposal.statement);
    setRoles(withRequiredRoles(savedRoles, requiredRoleKeys));
    setValue(item?.edited_value ?? proposal.canonical_value ?? '');
    setSelectedSourceSpanIds(savedSourceSpanIds);
    setEditing(true);
  }
  function cancelEditing() {
    setSelectedSourceSpanIds(savedSourceSpanIds);
    setEditing(false);
  }
  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm" data-testid="proposal-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{proposal.family_key} · {proposal.subtype_key}</p><button type="button" onClick={() => onSource(proposal.source_closure_id, primarySourceSpanId)} className="mt-1 text-left text-base font-medium text-ink">{item?.edited_statement || proposal.statement} <span className="text-[10px] font-semibold uppercase text-accent">Source</span></button></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badge[item?.decision || 'PENDING']}`}>{item?.decision || 'PENDING'}</span>
      </div>
      {invalid ? <div className={`mt-3 rounded border p-3 text-xs ${repairSaved ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'}`}><p className="font-semibold">{repairSaved ? 'Correction saved in this review revision' : 'Proposal requires review before publication'}</p>{!repairSaved && needsCitationRepair ? <p className="mt-1">Invalid evidence requires citation repair. Select one or more exact source spans.</p> : null}{!repairSaved && savedMissingRequiredRoles.length > 0 ? <p className="mt-1">One or more required legal roles are missing. Complete the marked fields.</p> : null}{!repairSaved && !needsCitationRepair && savedMissingRequiredRoles.length === 0 ? <p className="mt-1">Review and correct the statement, roles or value recorded for this proposal.</p> : null}{reviewContext.map((evidence, index) => <button key={`${evidence.source_span_id}-${index}`} type="button" onClick={() => onSource(proposal.source_closure_id, evidence.source_span_id)} className="mt-2 block text-left font-semibold underline">Recorded review context: {evidence.quote}</button>)}</div> : null}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(item?.edited_roles || proposal.roles || {}).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase tracking-wide text-inkLight">{key.replaceAll('_', ' ')}</dt><dd className="flex items-start gap-1 text-sm text-inkMid"><span>{Array.isArray(value) ? value.join(', ') : String(value)}</span><button type="button" onClick={() => onSource(proposal.source_closure_id, primarySourceSpanId)} className="text-[10px] font-semibold text-accent">Source</button></dd></div>)}
      </dl>
      {proposal.canonical_value != null ? <button type="button" onClick={() => onSource(proposal.source_closure_id, primarySourceSpanId)} className="mt-2 text-left text-sm"><span className="text-inkLight">Canonical value:</span> {String(item?.edited_value ?? proposal.canonical_value)} <span className="text-xs font-semibold text-accent">Source</span></button> : null}
      {groupMembers.length > 1 ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid"><p className="font-semibold text-ink">Complete relationship group</p>{groupMembers.map((member) => <p key={member.proposal_id}>{member.proposal_id === proposal.proposal_id ? 'This fact' : member.statement}</p>)}</div> : null}
      {related.length ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid">{related.map(({ link, other }) => <p key={link.fact_link_id}><strong>{link.relationship_type}</strong> {other?.statement || other?.fact_type}</p>)}</div> : null}
      {editing ? <div className="mt-3 space-y-2"><textarea aria-label="Edited legal statement" value={statement} onChange={(event) => setStatement(event.target.value)} className="w-full rounded border border-border p-2 text-sm" />{proposal.canonical_value != null ? <label className="block text-xs font-semibold text-inkMid">Canonical value<input aria-label="Edited canonical value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label> : null}{Object.entries(roles).map(([key, roleValue]) => <label key={key} className="block text-xs font-semibold text-inkMid">{key.replaceAll('_', ' ')}{requiredRoleKeys.includes(key) ? ' *' : ''}{typeof roleValue === 'boolean' ? <input type="checkbox" checked={roleValue} onChange={(event) => updateRole(key, event.target.checked, roleValue)} className="ml-2" /> : <input required={requiredRoleKeys.includes(key)} value={Array.isArray(roleValue) ? roleValue.join(', ') : roleValue} type={typeof roleValue === 'number' ? 'number' : 'text'} onChange={(event) => updateRole(key, event.target.value, roleValue)} className="mt-1 block w-full rounded border border-border p-2 font-normal" />}</label>)}<fieldset className="rounded border border-border p-2"><legend className="px-1 text-xs font-semibold text-inkMid">Exact source citations</legend>{availableSourceSpans.map((span) => <div key={span.span_id} className="mt-1 flex items-start gap-2 text-xs text-inkMid"><label className="flex flex-1 gap-2"><input type="checkbox" checked={selectedSourceSpanIds.includes(span.span_id)} onChange={() => toggleSourceSpan(span.span_id)} /><span><strong>{span.kind}</strong>: {span.exact_text.slice(0, 180)}</span></label><button type="button" onClick={() => onSource(proposal.source_closure_id, span.span_id)} className="font-semibold text-accent">View full source</button></div>)}</fieldset><div className="flex gap-2"><button type="button" disabled={selectedSourceSpanIds.length === 0 || missingRequiredRoles.length > 0} onClick={saveEdit} className="rounded bg-ink px-3 py-1 text-xs text-white">Save edit</button><button type="button" onClick={cancelEditing} className="text-xs">Cancel</button></div></div> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={busy || invalid} onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-3 py-1 text-green-800">Accept</button>
        <button type="button" disabled={busy} onClick={startEditing} className="rounded border border-blue-700 px-3 py-1 text-blue-800">Edit</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-3 py-1">Reject</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-3 py-1 text-red-700">Mark unresolved</button>
        <button type="button" onClick={() => onSource(proposal.source_closure_id, primarySourceSpanId)} className="ml-auto rounded bg-paper px-3 py-1 font-semibold text-accent">View source closure</button>
      </div>
    </article>
  );
}
