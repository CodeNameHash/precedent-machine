import { useEffect, useMemo, useState } from 'react';
import {
  commonRoleHelp,
  primaryProposalSource,
  presentCitationChoices,
  presentReviewEvidence,
  proposalRepairState,
} from '../../lib/product/review-presentation';
import { displaySectionReference } from '../../lib/product/section-reference-display';

const badge = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

function withRequiredRoles(existing, requiredRoleKeys) {
  return Object.fromEntries([...new Set([...requiredRoleKeys, ...Object.keys(existing || {})])]
    .map((key) => [key, existing?.[key] ?? '']));
}

function EvidenceGroup({ title, items, onOpen }) {
  if (items.length === 0) return null;
  return <section className="mt-3 rounded border border-red-200 bg-white/60 p-2"><h3 className="font-semibold">{title}</h3><div className="mt-1 space-y-2">{items.map((evidence, index) => <button key={`${evidence.source_span_id}-${index}`} type="button" onClick={() => onOpen(evidence)} className="block w-full rounded border border-border p-2 text-left font-normal"><span className="block font-semibold">{evidence.quote}</span><span className="mt-1 block text-inkMid">{evidence.reason} {evidence.section_reference} · {String(evidence.component_kind || 'source context').replaceAll('_', ' ').toLowerCase()}</span></button>)}</div></section>;
}

export function evidenceNavigationSource(evidence) {
  return {
    spanId: evidence.fallback_source_span_id || evidence.source_span_id,
    reviewContext: evidence.source_context || null,
  };
}

export function savedCitationNavigationSource(proposal, spanId) {
  if (!proposal?.source_span_ids?.includes(spanId)) return null;
  return { closureId: proposal.source_closure_id, spanId, reviewContext: null };
}

export default function ProposalCard({
  entry, onDecision, onSource, availableSourceSpans = [], availablePropositionGroups = [],
  availableProposals = [],
  structureNodes = [], requiredRoleKeys = [], busy,
}) {
  const { proposal, review_item: item, related_proposals: related, group_members: groupMembers = [] } = entry;
  const savedRoles = item?.edited_roles || proposal.roles || {};
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(item?.edited_statement || proposal.statement);
  const [roles, setRoles] = useState(() => withRequiredRoles(savedRoles, requiredRoleKeys));
  const [value, setValue] = useState(item?.edited_value ?? proposal.canonical_value ?? '');
  const [selectedSourceSpanIds, setSelectedSourceSpanIds] = useState(item?.source_span_ids || proposal.source_span_ids || []);
  const [citationFilter, setCitationFilter] = useState('');
  const savedGroupSelection = Object.hasOwn(item || {}, 'edited_proposition_group_id')
    ? item.edited_proposition_group_id ?? '' : '__UNCHANGED__';
  const [groupSelection, setGroupSelection] = useState(savedGroupSelection);
  const canEditGroup = item?.kind === 'PROPOSAL';
  const invalid = proposal.validation_status !== 'VALID';
  const reviewEvidence = useMemo(
    () => presentReviewEvidence(proposal, structureNodes), [proposal, structureNodes],
  );
  const savedSourceSpanIds = item?.source_span_ids || proposal.source_span_ids || [];
  const primarySource = primaryProposalSource(savedSourceSpanIds, reviewEvidence);
  const primarySourceLabel = savedSourceSpanIds.length > 1
    ? `Citation 1 of ${savedSourceSpanIds.length}` : 'Source';
  const missingRequiredRoles = requiredRoleKeys.filter((key) => roles[key] === undefined
    || roles[key] === null || roles[key] === '');
  const repair = useMemo(
    () => proposalRepairState({ proposal, savedRoles, requiredRoleKeys, savedSourceSpanIds }),
    [proposal, savedRoles, requiredRoleKeys, savedSourceSpanIds],
  );
  const editSaved = item?.decision === 'EDITED';
  const citationChoices = useMemo(() => presentCitationChoices({
    spans: availableSourceSpans, nodes: structureNodes,
    ownedStructureNodeId: proposal.structure_node_id,
    selectedIds: selectedSourceSpanIds, filter: citationFilter,
  }), [availableSourceSpans, structureNodes, proposal.structure_node_id, selectedSourceSpanIds, citationFilter]);
  const compatibleGroups = availablePropositionGroups.filter((group) => (
    group.family_key === proposal.family_key && group.subtype_key === proposal.subtype_key
  )).map((group) => {
    const node = structureNodes.find((candidate) => candidate.node_id === group.structure_node_id);
    const members = availableProposals.filter((candidate) => (
      candidate.proposition_group_id === group.proposition_group_id
    ));
    const section = node?.reference ? displaySectionReference(node.reference) : 'Section unavailable';
    const description = members.map((member) => member.statement).filter(Boolean).join(' / ') || 'Recorded group';
    return { ...group, label: `${section}: ${description} (${group.proposition_group_id.slice(0, 12)})` };
  });
  useEffect(() => {
    if (editing) return;
    setStatement(item?.edited_statement || proposal.statement);
    setRoles(withRequiredRoles(savedRoles, requiredRoleKeys));
    setValue(item?.edited_value ?? proposal.canonical_value ?? '');
    setSelectedSourceSpanIds(savedSourceSpanIds);
    setGroupSelection(savedGroupSelection);
  }, [editing, item, proposal, requiredRoleKeys, savedRoles, savedSourceSpanIds, savedGroupSelection]);
  function updateRole(key, nextValue, original) {
    let typed = nextValue;
    if (Array.isArray(original)) typed = nextValue.split(',').map((part) => part.trim()).filter(Boolean);
    else if (typeof original === 'number') typed = Number(nextValue);
    else if (typeof original === 'boolean') typed = nextValue === true || nextValue === 'true';
    setRoles((current) => ({ ...current, [key]: typed }));
  }
  async function saveEdit() {
    const groupEdit = groupSelection === '__UNCHANGED__' ? {}
      : { proposition_group_id: groupSelection === '' ? null : groupSelection };
    await onDecision(item.item_id, 'EDITED', {
      statement, roles, value: proposal.canonical_value == null ? null : value,
      source_span_ids: selectedSourceSpanIds, ...groupEdit,
    });
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
    setGroupSelection(savedGroupSelection);
    setCitationFilter('');
    setEditing(true);
  }
  function cancelEditing() {
    setSelectedSourceSpanIds(savedSourceSpanIds);
    setGroupSelection(savedGroupSelection);
    setCitationFilter('');
    setEditing(false);
  }
  function openEvidence(evidence) {
    const source = evidenceNavigationSource(evidence);
    onSource(proposal.source_closure_id, source.spanId, source.reviewContext);
  }
  function openPrimarySource() {
    onSource(proposal.source_closure_id, primarySource.spanId, primarySource.reviewContext);
  }
  function openSavedCitation(spanId) {
    const source = savedCitationNavigationSource({ ...proposal, source_span_ids: savedSourceSpanIds }, spanId);
    if (source) onSource(source.closureId, source.spanId, source.reviewContext);
  }
  return (
    <article className="rounded-lg border border-border bg-white p-4 shadow-sm" data-testid="proposal-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{proposal.family_key} · {proposal.subtype_key}</p><button type="button" onClick={openPrimarySource} className="mt-1 text-left text-base font-medium text-ink">{item?.edited_statement || proposal.statement} <span className="text-[10px] font-semibold uppercase text-accent">{primarySourceLabel}</span></button></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badge[item?.decision || 'PENDING']}`}>{item?.decision || 'PENDING'}</span>
      </div>
      {invalid ? <div className={`mt-3 rounded border p-3 text-xs ${editSaved ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-red-200 bg-red-50 text-red-900'}`}>
        <p className="font-semibold">{editSaved ? 'Edit saved in this review revision' : 'Proposal requires review before publication'}</p>
        {editSaved ? <p className="mt-1">The saved citation selection still requires lawyer assessment for support, scope and legal sufficiency.</p> : null}
        {repair.hasUnmatchedEvidence && !repair.needsCitationSelection ? <p className="mt-1">At least one citation is saved, but one or more claimed quotes did not match the source. Review each failed quote and select the source spans that support the edited statement.</p> : null}
        {repair.hasUnmatchedEvidence && repair.needsCitationSelection ? <p className="mt-1">One or more claimed quotes did not match the source. A failed quote is not an exact citation. Select the source spans that support the edited statement.</p> : null}
        {!repair.hasUnmatchedEvidence && repair.needsCitationSelection ? <p className="mt-1">No exact source citation is saved. Select one or more source spans that support the edited statement.</p> : null}
        {repair.missingRequiredRoles.length > 0 ? <div className="mt-2"><p className="font-semibold">Missing required roles</p><ul className="mt-1 list-disc space-y-1 pl-5">{repair.missingRequiredRoles.map((role) => <li key={role.key}><strong>{role.label}:</strong> {role.help || 'Complete this marked field.'}</li>)}</ul></div> : null}
        <EvidenceGroup title="Claimed quotes that did not match the source" items={reviewEvidence.unmatched} onOpen={openEvidence} />
        <EvidenceGroup title="Supporting context outside the owned section" items={reviewEvidence.contextOnly} onOpen={openEvidence} />
      </div> : null}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(item?.edited_roles || proposal.roles || {}).map(([key, roleValue]) => <div key={key}><dt className="text-[10px] uppercase tracking-wide text-inkLight">{commonRoleHelp(key).label}</dt><dd className="flex items-start gap-1 text-sm text-inkMid"><span>{Array.isArray(roleValue) ? roleValue.join(', ') : String(roleValue)}</span><button type="button" onClick={openPrimarySource} className="text-[10px] font-semibold text-accent">{primarySourceLabel}</button></dd></div>)}
      </dl>
      {proposal.canonical_value != null ? <button type="button" onClick={openPrimarySource} className="mt-2 text-left text-sm"><span className="text-inkLight">Canonical value:</span> {String(item?.edited_value ?? proposal.canonical_value)} <span className="text-xs font-semibold text-accent">{primarySourceLabel}</span></button> : null}
      {!editing && savedSourceSpanIds.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-inkMid">Saved citations</span>{savedSourceSpanIds.map((spanId, index) => <button key={spanId} type="button" onClick={() => openSavedCitation(spanId)} className="rounded border border-border px-2 py-1 font-semibold text-accent">Citation {index + 1}</button>)}</div> : null}
      {groupMembers.length > 1 ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid"><p className="font-semibold text-ink">Original AI group, for context</p>{groupMembers.map((member) => <p key={member.proposal_id}>{member.proposal_id === proposal.proposal_id ? 'This fact' : member.statement}</p>)}</div> : null}
      {related.length ? <div className="mt-3 rounded bg-paper p-2 text-xs text-inkMid">{related.map(({ link, other }) => <p key={link.fact_link_id}><strong>{link.relationship_type}</strong> {other?.statement || other?.fact_type}</p>)}</div> : null}
      {canEditGroup ? <label className="mt-3 block text-xs font-semibold text-inkMid">Summary group<span className="mt-0.5 block font-normal text-inkLight">Choose the group saved in the accepted summary. Standalone fact is an explicit lawyer choice.</span><select aria-label="Summary group" disabled={!editing || busy} value={groupSelection} onChange={(event) => setGroupSelection(event.target.value)} className="mt-1 block w-full rounded border border-border p-2 font-normal disabled:bg-paper"><option value="__UNCHANGED__">Keep current grouping</option><option value="">Standalone fact</option>{compatibleGroups.map((group) => <option key={group.proposition_group_id} value={group.proposition_group_id}>{group.label}</option>)}</select></label> : null}
      {editing ? <div className="mt-3 space-y-2">
        <textarea aria-label="Edited legal statement" value={statement} onChange={(event) => setStatement(event.target.value)} className="w-full rounded border border-border p-2 text-sm" />
        {proposal.canonical_value != null ? <label className="block text-xs font-semibold text-inkMid">Canonical value<input aria-label="Edited canonical value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label> : null}
        {Object.entries(roles).map(([key, roleValue]) => {
          const role = commonRoleHelp(key);
          return <label key={key} className="block text-xs font-semibold text-inkMid"><span>{role.label}{requiredRoleKeys.includes(key) ? ' *' : ''}</span>{role.help ? <span className="mt-0.5 block font-normal text-inkLight">{role.help}</span> : null}{typeof roleValue === 'boolean' ? <input aria-label={`Edited ${role.label}`} type="checkbox" checked={roleValue} onChange={(event) => updateRole(key, event.target.checked, roleValue)} className="ml-2" /> : <input aria-label={`Edited ${role.label}`} required={requiredRoleKeys.includes(key)} value={Array.isArray(roleValue) ? roleValue.join(', ') : roleValue} type={typeof roleValue === 'number' ? 'number' : 'text'} onChange={(event) => updateRole(key, event.target.value, roleValue)} className="mt-1 block w-full rounded border border-border p-2 font-normal" />}</label>;
        })}
        <fieldset className="rounded border border-border p-2"><legend className="px-1 text-xs font-semibold text-inkMid">Source citations selected by the lawyer</legend><label className="mb-2 block text-xs font-semibold text-inkMid">Filter source spans<input aria-label="Filter source spans" value={citationFilter} onChange={(event) => setCitationFilter(event.target.value)} placeholder="Search source text, section or span type" className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label>{citationChoices.length === 0 ? <p className="text-xs text-inkLight">No source spans match this filter.</p> : citationChoices.map((choice) => <div key={choice.span_id} className="mt-2 flex items-start gap-2 border-t border-border pt-2 text-xs text-inkMid"><label className="flex flex-1 gap-2"><input type="checkbox" checked={choice.selected} onChange={() => toggleSourceSpan(choice.span_id)} /><span><span className="block text-[10px] font-semibold uppercase tracking-wide text-inkLight">{choice.section_reference} · {choice.ownership_label} · {choice.breadth_label}</span><strong>{choice.kind}</strong>: {choice.exact_text.slice(0, 180)}</span></label><button type="button" onClick={() => onSource(proposal.source_closure_id, choice.span_id)} className="font-semibold text-accent">View full source</button></div>)}</fieldset>
        <div className="flex gap-2"><button type="button" disabled={busy || selectedSourceSpanIds.length === 0 || missingRequiredRoles.length > 0} onClick={saveEdit} className="rounded bg-ink px-3 py-1 text-xs text-white disabled:opacity-40">Save edit</button><button type="button" disabled={busy} onClick={cancelEditing} className="text-xs">Cancel</button></div>
      </div> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={busy || invalid} onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-3 py-1 text-green-800">Accept</button>
        <button type="button" disabled={busy} onClick={startEditing} className="rounded border border-blue-700 px-3 py-1 text-blue-800">Edit</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-3 py-1">Reject</button>
        <button type="button" disabled={busy} onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-3 py-1 text-red-700">Mark unresolved</button>
        <button type="button" onClick={openPrimarySource} className="ml-auto rounded bg-paper px-3 py-1 font-semibold text-accent">{savedSourceSpanIds.length > 1 ? `View citation 1 of ${savedSourceSpanIds.length}` : 'View source closure'}</button>
      </div>
    </article>
  );
}
