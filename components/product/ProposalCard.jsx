import { useState } from 'react';

const badge = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

export default function ProposalCard({ entry, onDecision, onSource, busy }) {
  const { proposal, review_item: item, related_proposals: related, group_members: groupMembers = [] } = entry;
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(item?.edited_statement || proposal.statement);
  const [roles, setRoles] = useState(item?.edited_roles || proposal.roles);
  const [value, setValue] = useState(item?.edited_value ?? proposal.canonical_value ?? '');
  function updateRole(key, value, original) {
    let typed = value;
    if (Array.isArray(original)) typed = value.split(',').map((part) => part.trim()).filter(Boolean);
    else if (typeof original === 'number') typed = Number(value);
    else if (typeof original === 'boolean') typed = value === true || value === 'true';
    setRoles((current) => ({ ...current, [key]: typed }));
  }
  async function saveEdit() {
    await onDecision(item.item_id, 'EDITED', { statement, roles, value: proposal.canonical_value == null ? null : value });
    setEditing(false);
  }
  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm" data-testid="proposal-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{proposal.family_key} · {proposal.subtype_key}</p><button type="button" onClick={() => onSource(proposal.source_closure_id, proposal.source_span_ids[0])} className="mt-1 text-left text-base font-medium text-ink">{item?.edited_statement || proposal.statement} <span className="text-[10px] font-semibold uppercase text-accent">Source</span></button></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badge[item?.decision || 'PENDING']}`}>{item?.decision || 'PENDING'}</span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(item?.edited_roles || proposal.roles || {}).map(([key, value]) => <div key={key}><dt className="text-[10px] uppercase tracking-wide text-inkLight">{key.replaceAll('_', ' ')}</dt><dd className="flex items-start gap-1 text-sm text-inkMid"><span>{Array.isArray(value) ? value.join(', ') : String(value)}</span><button type="button" onClick={() => onSource(proposal.source_closure_id, proposal.source_span_ids[0])} className="text-[10px] font-semibold text-accent">Source</button></dd></div>)}
      </dl>
      {proposal.canonical_value != null ? <button type="button" onClick={() => onSource(proposal.source_closure_id, proposal.source_span_ids[0])} className="mt-2 text-left text-sm"><span className="text-inkLight">Canonical value:</span> {String(item?.edited_value ?? proposal.canonical_value)} <span className="text-xs font-semibold text-accent">Source</span></button> : null}
      {groupMembers.length > 1 ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid"><p className="font-semibold text-ink">Complete relationship group</p>{groupMembers.map((member) => <p key={member.proposal_id}>{member.proposal_id === proposal.proposal_id ? 'This fact' : member.statement}</p>)}</div> : null}
      {related.length ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid">{related.map(({ link, other }) => <p key={link.fact_link_id}><strong>{link.relationship_type}</strong> {other?.statement || other?.fact_type}</p>)}</div> : null}
      {editing ? <div className="mt-3 space-y-2"><textarea aria-label="Edited legal statement" value={statement} onChange={(event) => setStatement(event.target.value)} className="w-full rounded border border-border p-2 text-sm" />{proposal.canonical_value != null ? <label className="block text-xs font-semibold text-inkMid">Canonical value<input aria-label="Edited canonical value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label> : null}{Object.entries(roles).map(([key, roleValue]) => <label key={key} className="block text-xs font-semibold text-inkMid">{key.replaceAll('_', ' ')}{typeof roleValue === 'boolean' ? <input type="checkbox" checked={roleValue} onChange={(event) => updateRole(key, event.target.checked, roleValue)} className="ml-2" /> : <input value={Array.isArray(roleValue) ? roleValue.join(', ') : roleValue} type={typeof roleValue === 'number' ? 'number' : 'text'} onChange={(event) => updateRole(key, event.target.value, roleValue)} className="mt-1 block w-full rounded border border-border p-2 font-normal" />}</label>)}<div className="flex gap-2"><button type="button" onClick={saveEdit} className="rounded bg-ink px-3 py-1 text-xs text-white">Save edit</button><button type="button" onClick={() => setEditing(false)} className="text-xs">Cancel</button></div></div> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-3 py-1 text-green-800">Accept</button>
        <button type="button" disabled={busy} onClick={() => setEditing(true)} className="rounded border border-blue-700 px-3 py-1 text-blue-800">Edit</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-3 py-1">Reject</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-3 py-1 text-red-700">Mark unresolved</button>
        <button type="button" onClick={() => onSource(proposal.source_closure_id, proposal.source_span_ids[0])} className="ml-auto rounded bg-paper px-3 py-1 font-semibold text-accent">View source closure</button>
      </div>
    </article>
  );
}
