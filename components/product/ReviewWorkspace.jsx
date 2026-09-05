import { useEffect, useMemo, useRef, useState } from 'react';
import { buildReviewView } from '../../lib/product/review-view';
import { displaySectionReference } from '../../lib/product/section-reference-display';
import legalSchema from '../../contracts/product/legal-schema.v1.json';
import ProposalCard from './ProposalCard';
import SourceContextPanel from './SourceContextPanel';

const headers = { 'Content-Type': 'application/json', 'X-PM-CSRF': 'same-origin' };

function Requirement({ item, onDecision, onSource, busy }) {
  const title = item.kind === 'COVERAGE' ? `${item.original.family_key || 'Section'} ${item.original.subject_kind}`
    : item.kind === 'IMMATERIAL_ROUTING' ? `Confirm ${displaySectionReference(item.original.section_reference)} is immaterial`
      : item.kind === 'EXCEPTION_LINK' ? 'Review exception relationship' : item.original.code || item.kind;
  return <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-white p-3 text-sm"><span className="font-semibold text-ink">{title}</span><span className="text-inkLight">{item.original.state || item.original.relationship_type || item.original.message}</span>{item.relationship_context ? <p className="basis-full rounded bg-paper p-2 text-xs text-inkMid"><strong>Exception:</strong> {item.relationship_context.from}<br/><strong>Applies to:</strong> {item.relationship_context.to}</p> : null}{item.source_span_ids?.length ? <button type="button" onClick={() => onSource(item.source_closure_id, item.source_span_ids[0])} className="text-xs font-semibold text-accent">View complete source closure</button> : null}<span className="ml-auto text-xs font-bold">{item.decision}</span>{item.decision === 'PENDING' ? <><button disabled={busy} type="button" onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-2 py-1 text-xs text-green-800">{item.kind === 'EXCEPTION_LINK' ? 'Accept' : 'Reviewed'}</button>{item.kind === 'EXCEPTION_LINK' ? <button disabled={busy} type="button" onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-2 py-1 text-xs">Reject</button> : null}<button disabled={busy} type="button" onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-2 py-1 text-xs text-red-700">Unresolved</button></> : null}</div>;
}

function AddFact({ section, analysis, onAdd, busy }) {
  const [open, setOpen] = useState(false);
  const [familyKey, setFamilyKey] = useState(legalSchema.families[0].family_key);
  const family = legalSchema.families.find((item) => item.family_key === familyKey);
  const [subtypeKey, setSubtypeKey] = useState(family.subtypes[0].subtype_key);
  const subtype = family.subtypes.find((item) => item.subtype_key === subtypeKey) || family.subtypes[0];
  const [factType, setFactType] = useState(family.required_fact_types[0]);
  const [statement, setStatement] = useState('');
  const [roles, setRoles] = useState(Object.fromEntries([...subtype.required_roles, ...(subtype.optional_roles || [])].map((role) => [role, ''])));
  const [value, setValue] = useState('');
  const closure = analysis.source_closures.find((item) => item.structure_node_id === section.node.node_id);
  const spans = analysis.spans.filter((span) => span.source_closure_ids?.includes(closure?.source_closure_id));
  const [spanId, setSpanId] = useState('');
  function changeFamily(value) {
    const next = legalSchema.families.find((item) => item.family_key === value);
    const nextSubtype = next.subtypes[0];
    setFamilyKey(value); setSubtypeKey(nextSubtype.subtype_key); setFactType(next.required_fact_types[0]);
    setRoles(Object.fromEntries([...nextSubtype.required_roles, ...(nextSubtype.optional_roles || [])].map((role) => [role, ''])));
  }
  function changeSubtype(value) {
    const next = family.subtypes.find((item) => item.subtype_key === value);
    setSubtypeKey(value);
    setRoles(Object.fromEntries([...next.required_roles, ...(next.optional_roles || [])].map((role) => [role, ''])));
  }
  if (!open) return <button type="button" onClick={() => { setOpen(true); setSpanId(spans[0]?.span_id || ''); }} className="text-xs font-semibold text-accent">+ Add missing fact</button>;
  return <form className="rounded-lg border border-accent/30 bg-white p-4" onSubmit={(event) => { event.preventDefault(); onAdd({ structure_node_id: section.node.node_id, source_closure_id: closure.source_closure_id, family_key: familyKey, subtype_key: subtypeKey, fact_type: factType, statement, roles: Object.fromEntries(Object.entries(roles).filter(([, roleValue]) => roleValue !== '')), value: value || null, source_span_ids: [spanId] }).then(() => setOpen(false)); }}>
    <p className="mb-3 text-sm font-semibold">Add a source-linked missing fact</p><div className="grid gap-2 sm:grid-cols-3"><select aria-label="Family" value={familyKey} onChange={(event) => changeFamily(event.target.value)} className="rounded border border-border p-2 text-xs">{legalSchema.families.filter((item) => item.state === 'DEFINED').map((item) => <option key={item.family_key}>{item.family_key}</option>)}</select><select aria-label="Subtype" value={subtype.subtype_key} onChange={(event) => changeSubtype(event.target.value)} className="rounded border border-border p-2 text-xs">{family.subtypes.map((item) => <option key={item.subtype_key}>{item.subtype_key}</option>)}</select><select aria-label="Fact type" value={factType} onChange={(event) => setFactType(event.target.value)} className="rounded border border-border p-2 text-xs">{family.required_fact_types.map((item) => <option key={item}>{item}</option>)}</select></div><textarea required aria-label="Missing fact statement" value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Plain legal English" className="mt-2 w-full rounded border border-border p-2 text-sm" /><label className="mt-2 block text-xs font-semibold text-inkMid">Canonical value, when applicable<input aria-label="Missing fact canonical value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(roles).map(([role, roleValue]) => <label key={role} className="text-xs font-semibold text-inkMid">{role.replaceAll('_', ' ')}{subtype.required_roles.includes(role) ? ' *' : ''}<input required={subtype.required_roles.includes(role)} value={roleValue} onChange={(event) => setRoles((current) => ({ ...current, [role]: event.target.value }))} className="mt-1 block w-full rounded border border-border p-2 font-normal" /></label>)}</div><select required aria-label="Source span" value={spanId} onChange={(event) => setSpanId(event.target.value)} className="mt-2 w-full rounded border border-border p-2 text-xs">{spans.map((span) => <option value={span.span_id} key={span.span_id}>{span.kind}: {span.exact_text.slice(0, 100)}</option>)}</select><div className="mt-3 flex gap-2"><button disabled={busy} className="rounded bg-ink px-3 py-1 text-xs text-white">Add fact</button><button type="button" onClick={() => setOpen(false)} className="text-xs">Cancel</button></div>
  </form>;
}

function AcceptedSummary({ summary, metrics, onSource, active }) {
  const facts = summary.families.flatMap((family) => family.facts);
  const statement = (sourceId) => facts.find((fact) => fact.source_id === sourceId)?.statement || sourceId;
  return <section className="space-y-4" data-testid="accepted-summary"><div className={`rounded-xl border p-4 ${active ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}><h2 className="font-display text-xl text-ink">{active ? 'Active key-provisions release' : 'Inactive release candidate'}</h2><p className="mt-1 text-sm text-inkMid">{metrics.proposal_count} proposals reviewed, {metrics.proposal_errors} corrected or rejected, {metrics.proposal_omissions} omissions added, {metrics.review_time_seconds}s review time.</p></div>{summary.families.map((family) => <div key={family.family_key}><h3 className="mb-2 text-sm font-bold tracking-wide text-ink">{family.family_key.replaceAll('_', ' ')}</h3>{family.facts.length ? <div className="space-y-2">{family.facts.map((fact) => <article key={fact.review_item_id} className="rounded-lg border border-border bg-white p-4"><p className="font-medium text-ink">{fact.statement}</p><button type="button" onClick={() => onSource(fact.source_closure_id, fact.source_span_ids[0])} className="mt-1 text-xs font-semibold text-accent">{fact.subtype_key} · {fact.fact_type} · {fact.source_span_ids.length} source citation{fact.source_span_ids.length === 1 ? '' : 's'} · View source</button></article>)}</div> : <p className="text-sm text-inkLight">No accepted facts.</p>}</div>)}{summary.relationships.length ? <div><h3 className="mb-2 text-sm font-bold tracking-wide text-ink">ACCEPTED EXCEPTIONS</h3><div className="space-y-2">{summary.relationships.map((relationship) => <article key={relationship.review_item_id} className="rounded-lg border border-border bg-white p-4 text-sm"><p><strong>Exception:</strong> {statement(relationship.from_proposal_id)}</p><p><strong>Applies to:</strong> {statement(relationship.to_proposal_id)}</p><button type="button" onClick={() => onSource(relationship.source_closure_id, relationship.source_span_ids[0])} className="mt-2 text-xs font-semibold text-accent">View complete source closure</button></article>)}</div></div> : null}</section>;
}

export function ReleaseEvaluation({ state, onEvaluate, busy }) {
  const facts = state.summary.families.flatMap((family) => family.facts);
  const prior = state.release_evaluation_input;
  const [inventory, setInventory] = useState(() => (prior?.inventory || []).map((item) => ({
    ...item,
    ...(prior.reconciliation || []).find((candidate) => candidate.inventory_item_id === item.inventory_item_id),
  })));
  const [citations, setCitations] = useState(() => Object.fromEntries(facts.map((fact) => [fact.review_item_id,
    (prior?.citation_assessments || []).find((item) => item.review_item_id === fact.review_item_id)
      || { exact: false, legally_sufficient: false, narrow: false }] )));
  const [elapsedMinutes, setElapsedMinutes] = useState(prior?.elapsed_minutes ?? '');
  const [developerAssisted, setDeveloperAssisted] = useState(prior?.developer_assisted === true);
  const [attested, setAttested] = useState(prior?.independent_inventory_attested === true);
  const evaluation = state.release_evaluation;
  function updateInventory(id, values) {
    setInventory((current) => current.map((item) => item.inventory_item_id === id ? { ...item, ...values } : item));
  }
  function addInventoryItem() {
    setInventory((current) => [...current, {
      inventory_item_id: crypto.randomUUID(), description: '', severity: 'MATERIAL',
      disposition: 'UNRESOLVED', review_item_id: '', omission_reason: '',
    }]);
  }
  async function submit(event) {
    event.preventDefault();
    await onEvaluate({
      type: 'EVALUATE_RELEASE',
      inventory: inventory.map(({ inventory_item_id, description, severity }) => ({ inventory_item_id, description, severity })),
      reconciliation: inventory.map((item) => ({
        inventory_item_id: item.inventory_item_id,
        disposition: item.disposition,
        ...(item.disposition === 'PUBLISHED_FACT' ? { review_item_id: item.review_item_id } : {}),
        ...(item.disposition === 'REVIEWED_OMISSION' ? { omission_reason: item.omission_reason } : {}),
      })),
      citation_assessments: facts.map((fact) => ({ review_item_id: fact.review_item_id, ...citations[fact.review_item_id] })),
      elapsed_minutes: Number(elapsedMinutes),
      developer_assisted: developerAssisted,
      lawyer_attestation: attested,
      independent_inventory_attestation: attested,
    });
  }
  return <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-white p-4" data-testid="release-evaluation-form">
    <div><h2 className="font-display text-lg text-ink">Supervised candidate evaluation</h2><p className="text-sm text-inkLight">Record one critical or material legal point per row. Reconcile each point, assess every candidate citation, and certify the review.</p></div>
    <div className="space-y-2">{inventory.map((item, index) => <div key={item.inventory_item_id} className="grid gap-2 rounded border border-border p-3 sm:grid-cols-6">
      <input required aria-label={`Inventory item ${index + 1}`} value={item.description} onChange={(event) => updateInventory(item.inventory_item_id, { description: event.target.value })} placeholder="One atomic legal point" className="sm:col-span-3 rounded border border-border p-2 text-sm" />
      <select aria-label={`Severity ${index + 1}`} value={item.severity} onChange={(event) => updateInventory(item.inventory_item_id, { severity: event.target.value })} className="rounded border border-border p-2 text-xs"><option>CRITICAL</option><option>MATERIAL</option></select>
      <select aria-label={`Reconciliation ${index + 1}`} value={item.disposition} onChange={(event) => updateInventory(item.inventory_item_id, { disposition: event.target.value })} className="sm:col-span-2 rounded border border-border p-2 text-xs"><option value="UNRESOLVED">Unresolved</option><option value="PUBLISHED_FACT">Published fact</option><option value="REVIEWED_OMISSION">Reviewed omission</option></select>
      {item.disposition === 'PUBLISHED_FACT' ? <select required aria-label={`Published fact ${index + 1}`} value={item.review_item_id} onChange={(event) => updateInventory(item.inventory_item_id, { review_item_id: event.target.value })} className="sm:col-span-5 rounded border border-border p-2 text-xs"><option value="">Select published fact</option>{facts.map((fact) => <option key={fact.review_item_id} value={fact.review_item_id}>{fact.family_key}: {fact.statement}</option>)}</select> : null}
      {item.disposition === 'REVIEWED_OMISSION' ? <input required aria-label={`Omission reason ${index + 1}`} value={item.omission_reason} onChange={(event) => updateInventory(item.inventory_item_id, { omission_reason: event.target.value })} placeholder="Reason for reviewed omission" className="sm:col-span-5 rounded border border-border p-2 text-sm" /> : null}
      <button type="button" onClick={() => setInventory((current) => current.filter((candidate) => candidate.inventory_item_id !== item.inventory_item_id))} className="text-xs text-red-700">Remove</button>
    </div>)}</div>
    <button type="button" onClick={addInventoryItem} className="text-xs font-semibold text-accent">+ Add inventory item</button>
    <div className="space-y-2"><h3 className="text-sm font-semibold">Published citation assessments</h3>{facts.map((fact) => <fieldset key={fact.review_item_id} className="rounded border border-border p-3 text-sm"><legend className="px-1 font-medium">{fact.statement}</legend>{[['exact', 'Exact'], ['legally_sufficient', 'Legally sufficient'], ['narrow', 'Narrow']].map(([key, label]) => <label key={key} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={citations[fact.review_item_id]?.[key] === true} onChange={(event) => setCitations((current) => ({ ...current, [fact.review_item_id]: { ...current[fact.review_item_id], [key]: event.target.checked } }))} />{label}</label>)}</fieldset>)}</div>
    <label className="block text-sm font-semibold">Total process and review time, minutes<input required min="0" step="0.1" type="number" value={elapsedMinutes} onChange={(event) => setElapsedMinutes(event.target.value)} className="mt-1 block rounded border border-border p-2 font-normal" /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={developerAssisted} onChange={(event) => setDeveloperAssisted(event.target.checked)} />A developer assisted this run</label>
    <label className="flex items-start gap-2 rounded bg-paper p-3 text-sm"><input required type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />I certify that I am the lawyer reviewer, that the inventory was prepared independently before review of the candidate result, and that I made or approved the final decisions, reconciliation, citation assessments, and agreement-level coverage confirmation.</label>
    <button disabled={busy || inventory.length === 0 || !attested} className="rounded bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Evaluate candidate against fixed bars</button>
    {evaluation ? <div className={`rounded p-3 text-sm ${evaluation.passed ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`} data-testid="release-evaluation-result"><strong>{evaluation.passed ? 'All fixed release bars pass.' : 'Release is blocked.'}</strong><p className="mt-2">Entered total: {evaluation.diagnostics.review_time_minutes} minutes. Measured review duration: {evaluation.diagnostics.measured_review_time_seconds} seconds.</p><ul className="mt-2 list-disc pl-5">{Object.entries(evaluation.bars).map(([bar, passed]) => <li key={bar}>{passed ? 'Pass' : 'Fail'}: {bar.replaceAll('_', ' ')}</li>)}</ul></div> : null}
  </form>;
}

export default function ReviewWorkspace({ runId }) {
  const [workspace, setWorkspace] = useState(null);
  const [source, setSource] = useState(null);
  const [sourceSelection, setSourceSelection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pendingAction = useRef(null);
  async function load() {
    setError('');
    const response = await fetch(`/api/product/review/${runId}`, { cache: 'no-store' });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Review could not load'); setWorkspace(value);
  }
  useEffect(() => { load().catch((failure) => setError(failure.message)); }, [runId]);
  const view = useMemo(() => workspace ? buildReviewView(workspace) : null, [workspace]);
  async function command(value) {
    setBusy(true); setError('');
    const signature = JSON.stringify(value);
    const pending = pendingAction.current?.signature === signature
      ? pendingAction.current : { signature, idempotencyKey: crypto.randomUUID() };
    pendingAction.current = pending;
    try {
      const response = await fetch(`/api/product/review/${runId}`, { method: 'POST', headers, body: JSON.stringify({ expected_version: workspace.review.version, idempotency_key: pending.idempotencyKey, command: value }) });
      const result = await response.json();
      if (!response.ok) { const failure = new Error(result.message || result.error || 'Review action failed'); failure.status = response.status; throw failure; }
      pendingAction.current = null; setWorkspace(result); return result;
    } catch (failure) {
      if (failure.status && failure.status < 500 && failure.status !== 409) pendingAction.current = null;
      try { await load(); } catch {}
      setError(`${failure.message}. Current server state was reloaded; retry the same action if needed.`);
      throw failure;
    } finally { setBusy(false); }
  }
  async function loadSource() {
    const response = await fetch(`/api/product/review/${runId}/source`, { cache: 'no-store' });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Source could not load'); setSource(value);
  }
  async function openSource(closureId, spanId) {
    const span = workspace.analysis.spans.find((item) => item.span_id === spanId);
    const resolvedClosureId = closureId || span?.source_closure_ids?.[0] || null;
    setSourceSelection({ closureId: resolvedClosureId, span });
    if (!source) await loadSource().catch((failure) => setError(failure.message));
  }
  if (!workspace) return <div className="p-8">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => load().catch((failure) => setError(failure.message))} className="mt-3 rounded border border-border px-3 py-2 text-sm">Retry review load</button></> : 'Loading Review…'}</div>;
  const state = workspace.review.state;
  const candidate = workspace.review.release_history?.[0] || null;
  const candidateActive = Boolean(candidate && workspace.review.active_release_id === candidate.release_id);
  return <div className="mx-auto max-w-6xl space-y-6 pb-20">
    <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-border bg-white/95 px-4 py-3 backdrop-blur"><div><p className="text-xs uppercase tracking-wide text-inkLight">25-family lawyer review</p><h1 className="font-display text-xl text-ink">{workspace.analysis.source_document.parties?.join(' / ') || 'Agreement analysis'}</h1></div><div className="ml-auto text-right text-xs text-inkMid"><p>{view.pending_count} pending · {view.unresolved_count} unresolved</p><p>{view.residual_paragraph_count} residual paragraphs · {view.unusual_provision_count} unusual</p><p>Revision {workspace.review.version}</p></div>{state.status === 'DRAFT' ? <><button disabled={busy} type="button" onClick={() => command({ type: 'SAVE_PROGRESS' })} className="rounded border border-border px-3 py-2 text-xs font-semibold">Save progress</button><button disabled={busy || !view.can_publish} type="button" onClick={() => command({ type: 'PUBLISH' })} className="rounded bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Finalise inactive candidate</button></> : <><button disabled={busy} type="button" onClick={() => command({ type: 'REOPEN' })} className="rounded border border-border px-3 py-2 text-xs font-semibold">Revise candidate</button>{candidate && state.release_evaluation?.passed === true && !candidateActive ? <button disabled={busy} type="button" onClick={() => command({ type: 'ACTIVATE_RELEASE', release_id: candidate.release_id })} className="rounded bg-green-800 px-4 py-2 text-xs font-semibold text-white">Activate evaluated release</button> : null}{candidateActive && candidate.supersedes_release_id ? <button disabled={busy} type="button" onClick={() => command({ type: 'ROLLBACK_RELEASE' })} className="rounded bg-red-800 px-4 py-2 text-xs font-semibold text-white">Roll back active release</button> : null}</>}</header>
    {error ? <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}<button type="button" onClick={() => (sourceSelection && !source ? loadSource() : load()).catch((failure) => setError(failure.message))} className="ml-3 underline">Retry load</button></p> : null}
    {state.status === 'PUBLISHED' ? <><AcceptedSummary summary={state.summary} metrics={state.metrics} onSource={openSource} active={candidateActive} /><ReleaseEvaluation state={state} busy={busy} onEvaluate={command} /></> : <>
      <section className="rounded-xl border border-border bg-paper p-4"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg text-ink">Agreement coverage</h2><p className="text-sm text-inkLight">Review every flagged disposition, then confirm the agreement as a whole.</p></div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={state.agreement_coverage.decision === 'ACCEPTED'} onChange={(event) => command({ type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: event.target.checked })} />Coverage confirmed</label></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{workspace.analysis.sections.map((section) => <div key={section.section_routing_id} className="rounded bg-white p-2 text-xs"><strong>{displaySectionReference(section.section_reference)}</strong><br/><span className="text-inkLight">{section.disposition}{section.families.length ? ` · ${section.families.join(', ')}` : ''}</span></div>)}</div></section>
      {view.agreement_items.length ? <section className="space-y-2"><h2 className="font-display text-lg text-ink">Agreement-level findings</h2>{view.agreement_items.map((item) => <Requirement key={item.item_id} item={item} busy={busy} onSource={openSource} onDecision={(itemId, decision) => command({ type: 'DECIDE_ITEM', item_id: itemId, decision })} />)}</section> : null}
      {view.sections.map((section) => <section id={`section-${section.node.node_id}`} key={section.node.node_id} className="space-y-3"><div className="flex items-end justify-between border-b border-border pb-2"><div><p className="text-xs font-bold uppercase tracking-wide text-accent">{displaySectionReference(section.routing.section_reference)}</p><h2 className="font-display text-xl text-ink">{section.node.title || section.routing.rationale || 'Agreement section'}</h2></div><AddFact section={section} analysis={workspace.analysis} busy={busy} onAdd={(fact) => command({ type: 'ADD_MISSING_FACT', ...fact })} /></div>{section.proposals.map((entry) => <ProposalCard key={entry.proposal.proposal_id} entry={entry} busy={busy} onSource={openSource} onDecision={(itemId, decision, edits = {}) => command({ type: 'DECIDE_ITEM', item_id: itemId, decision, ...edits })} />)}{section.review_items.map((item) => <Requirement key={item.item_id} item={item} busy={busy} onSource={openSource} onDecision={(itemId, decision) => command({ type: 'DECIDE_ITEM', item_id: itemId, decision })} />)}{section.proposals.length === 0 && section.review_items.length === 0 ? <p className="text-sm text-inkLight">No proposal or flagged disposition.</p> : null}</section>)}
      <section className="rounded-xl border border-border bg-white p-4"><h2 className="font-display text-lg">Revision history</h2><div className="mt-2 flex flex-wrap gap-2">{workspace.review.revisions.filter((revision) => revision.event_type !== 'PUBLISH').map((revision) => <button disabled={busy || revision.version === workspace.review.version} type="button" key={revision.version} onClick={() => command({ type: 'RESTORE', restore_version: revision.version })} className="rounded border border-border px-2 py-1 text-xs">Restore v{revision.version} · {revision.event_type}</button>)}</div></section>
    </>}
    <SourceContextPanel open={Boolean(sourceSelection)} onClose={() => setSourceSelection(null)} source={source} span={sourceSelection?.span} closureSpans={workspace.analysis.spans.filter((item) => item.source_closure_ids?.includes(sourceSelection?.closureId))} loading={!source} />
  </div>;
}
