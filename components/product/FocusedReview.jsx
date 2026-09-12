import { useMemo, useState } from 'react';
import ProposalCard from './ProposalCard';
import { PublishedFact } from './PublishedSummary';
import { Requirement } from './ReviewWorkspace';
import { displayReviewLabel } from '../../lib/product/review-labels';
import { displaySectionReference } from '../../lib/product/section-reference-display';
import { byteRangesToParts, firstCitedByte } from '../../lib/product/section-highlight';
import { contract, walk } from '../../lib/product/fact-components';
import { buildEditedComponents } from '../../lib/product/component-edit';

const COMPONENT_KINDS = contract.component.component_kinds;

// All OWN-origin component byte ranges in a fact, for a headline click.
function ownComponentRanges(components) {
  const ranges = [];
  for (const [component] of walk(components || [])) {
    if (component.origin === 'OWN' && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte)) {
      ranges.push({ start_byte: component.start_byte, end_byte: component.end_byte });
    }
  }
  return ranges;
}

// A newer component_id needs no content hash; validateFactComponents only
// requires it to be present and unique within the tree.
let componentIdCounter = 0;
function nextComponentId() {
  componentIdCounter += 1;
  return `new-component-${Date.now()}-${componentIdCounter}`;
}

// Component-level edit of a layered fact (plan 5B.4), shown above the
// ProposalCard for a proposal that carries FACT_COMPONENTS/V2. Each existing
// component's verbatim text is an input; "Add component" appends a
// top-level sibling. Save recomputes byte ranges from the section's own
// text (lib/product/component-edit.js) and blocks when a text is missing or
// not unique in the section.
export function ComponentEditor({ proposal, item, sectionText, onDecision, busy }) {
  const baseComponents = item?.edited_components || proposal.components;
  const [edits, setEdits] = useState({});
  const [removed, setRemoved] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const removedSet = new Set(removed);
  const nodes = [...walk(baseComponents)].filter(([component]) => !removedSet.has(component.component_id));
  function updateText(componentId, value) {
    setEdits((current) => ({ ...current, [componentId]: value }));
  }
  function removeComponent(componentId) {
    setRemoved((current) => [...current, componentId]);
  }
  function addComponent() {
    setAdditions((current) => [...current, { id: nextComponentId(), kind: COMPONENT_KINDS[0], text: '' }]);
  }
  function updateAddition(id, patch) {
    setAdditions((current) => current.map((addition) => (addition.id === id ? { ...addition, ...patch } : addition)));
  }
  function removeAddition(id) {
    setAdditions((current) => current.filter((addition) => addition.id !== id));
  }
  async function save() {
    setError('');
    if (!sectionText || !Number.isSafeInteger(sectionText.start_byte)) {
      setError('Section text is unavailable.');
      return;
    }
    const { components, problems } = buildEditedComponents({
      components: baseComponents,
      edits: new Map(Object.entries(edits)),
      removed: removedSet,
      additions,
      sectionText: sectionText.exact_text,
      sectionStartByte: sectionText.start_byte,
      sectionSpanId: sectionText.span_id,
    });
    if (problems.length > 0) {
      setError(`Text must appear exactly once in the section as written: ${problems.map((problem) => `"${problem.text}"`).join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      await onDecision(item.item_id, 'EDITED', { statement: item?.edited_statement || proposal.statement, components });
      setEdits({});
      setRemoved([]);
      setAdditions([]);
    } catch {
      setError('Not saved. Try again.');
    }
    setSaving(false);
  }
  return <div className="mt-2 rounded border border-border bg-paper p-2" data-testid="component-editor">
    <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Components</p>
    <ul className="mt-1 space-y-1">
      {nodes.map(([component]) => <li key={component.component_id} className="flex flex-wrap items-center gap-2 text-xs" data-testid="component-edit-row">
        <span className="w-32 shrink-0 text-[10px] uppercase tracking-wide text-inkLight">{component.kind}</span>
        <input
          aria-label={`Component text: ${component.label || component.kind}`}
          defaultValue={Object.hasOwn(edits, component.component_id) ? edits[component.component_id] : component.text}
          onChange={(event) => updateText(component.component_id, event.target.value)}
          className="min-w-0 flex-1 rounded border border-border p-1 font-normal"
        />
        <button type="button" disabled={busy || saving} onClick={() => removeComponent(component.component_id)} className="text-red-700">Remove</button>
      </li>)}
    </ul>
    {additions.map((addition) => <div key={addition.id} className="mt-1 flex flex-wrap items-center gap-2 text-xs" data-testid="component-addition-row">
      <select aria-label="New component kind" value={addition.kind} onChange={(event) => updateAddition(addition.id, { kind: event.target.value })} className="rounded border border-border p-1 font-normal">
        {COMPONENT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
      </select>
      <input aria-label="New component text" value={addition.text} onChange={(event) => updateAddition(addition.id, { text: event.target.value })} className="min-w-0 flex-1 rounded border border-border p-1 font-normal" />
      <button type="button" disabled={busy || saving} onClick={() => removeAddition(addition.id)} className="text-red-700">Remove</button>
    </div>)}
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <button type="button" disabled={busy || saving} onClick={addComponent} className="font-semibold text-accent">Add component</button>
      <button type="button" disabled={busy || saving} onClick={save} className="rounded bg-ink px-2 py-1 text-white disabled:opacity-40">Save components</button>
    </div>
    {error ? <p className="mt-1 text-[11px] text-red-700" role="alert" data-testid="component-editor-error">{error}</p> : null}
  </div>;
}

const badge = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

// Row colour follows the decision so the state of a fact is visible without
// reading the badge. Selection for highlighting is shown as a ring instead.
const rowTone = {
  PENDING: 'border-border bg-white',
  ACCEPTED: 'border-green-300 bg-green-50',
  EDITED: 'border-blue-300 bg-blue-50',
  REJECTED: 'border-slate-300 bg-slate-100 text-slate-500',
  UNRESOLVED: 'border-red-300 bg-red-50',
};

const decisionWord = {
  PENDING: 'Needs review', ACCEPTED: 'Accepted', EDITED: 'Edited and accepted', REJECTED: 'Rejected', UNRESOLVED: 'Marked unresolved',
};

export function CommentBox({ item, busy, onComment }) {
  const [draft, setDraft] = useState(item?.comment || '');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const saved = item?.comment || '';
  if (!item) return null;
  async function save(text) {
    setStatus('Saving…');
    try {
      await onComment(item.item_id, text);
      setStatus(text ? 'Comment saved' : 'Comment removed');
      setOpen(false);
    } catch { setStatus('Not saved. Try again.'); }
  }
  if (!open) return <>
    <button type="button" onClick={() => { setDraft(saved); setOpen(true); setStatus(''); }} className="font-semibold text-accent">{saved ? 'Edit comment' : 'Add comment'}</button>
    {status ? <span role="status" className={`font-semibold ${status.startsWith('Not') ? 'text-red-700' : 'text-green-800'}`}>{status}</span> : null}
  </>;
  return <div className="mt-1 basis-full" data-testid="fact-comment">
    <textarea aria-label="Comment" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} placeholder="Your note on this fact, for the record" className="w-full rounded border border-border p-2 text-xs font-normal" />
    <div className="mt-1 flex items-center gap-2 text-[11px]">
      <button type="button" disabled={busy || draft.trim() === saved || draft.trim() === ''} onClick={() => save(draft)} className="rounded bg-ink px-2 py-0.5 text-white disabled:opacity-40">Save comment</button>
      {saved ? <button type="button" disabled={busy} onClick={() => { setDraft(''); save(null); }} className="text-red-700">Remove</button> : null}
      {status ? <span role="status" className={status.startsWith('Not') ? 'text-red-700' : 'text-inkLight'}>{status}</span> : null}
      <button type="button" onClick={() => { setDraft(saved); setOpen(false); }} className="ml-auto text-inkLight">Cancel</button>
    </div>
  </div>;
}

const HELD_CODES = new Set([
  'UNSUPPORTED_SUBTYPE', 'UNSUPPORTED_FACT_TYPE', 'UNSUPPORTED_PROPOSITION_GROUP_MEMBER',
  'DUPLICATE_PROPOSITION_GROUP', 'UNSUPPORTED_FACT_LINK',
]);

function heldStatement(item) {
  const message = item?.original?.message;
  if (typeof message !== 'string') return null;
  try {
    const parsed = JSON.parse(message);
    const value = Array.isArray(parsed) ? parsed[0] : parsed;
    return typeof value?.statement === 'string' && value.statement.trim() ? value.statement.trim() : null;
  } catch { return null; }
}

export function sectionFacts(section, spansById) {
  const entries = section.proposals.map((entry) => {
    const spanIds = entry.review_item?.source_span_ids || entry.proposal.source_span_ids || [];
    const spans = spanIds.map((id) => spansById.get(id)).filter(Boolean);
    return { entry, spans, order: firstCitedByte(spans) };
  }).sort((left, right) => left.order - right.order);
  const groups = [];
  for (const fact of entries) {
    const key = fact.entry.proposal.proposition_group_id || `single:${fact.entry.proposal.proposal_id}`;
    let group = groups.find((candidate) => candidate.key === key);
    if (!group) { group = { key, facts: [] }; groups.push(group); }
    group.facts.push(fact);
  }
  return groups;
}

function SectionText({ text, marks }) {
  const parts = useMemo(() => byteRangesToParts(text.exact_text, text.start_byte, marks), [text, marks]);
  return <pre className="whitespace-pre-wrap font-serif text-[13px] leading-6 text-ink" data-testid="focused-section-text">{parts.map((part, index) => part.marked ? <mark key={index} className="bg-amber-200">{part.text}</mark> : <span key={index}>{part.text}</span>)}</pre>;
}

function FactRow({ fact, selected, onSelect, onDecision, onComment, onReset, onSource, busy, cardProps, onSelectComponent, selectedComponentId, sectionText }) {
  const [open, setOpen] = useState(false);
  const { proposal, review_item: item } = fact.entry;
  const decision = item?.decision || 'PENDING';
  const invalid = proposal.validation_status !== 'VALID';
  const hasComponents = !!proposal.headline && Array.isArray(proposal.components) && proposal.components.length > 0;
  const publishedFact = hasComponents
    ? { ...proposal, headline: item?.edited_headline || proposal.headline, components: item?.edited_components || proposal.components }
    : null;
  const aids = <>
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge[decision]}`}>{decisionWord[decision] || displayReviewLabel(decision)}</span>
    {decision === 'EDITED' && item?.edited_statement && item.edited_statement !== proposal.statement ? <p className="mt-1 text-[11px] text-blue-900">Original: <span className="line-through">{proposal.statement}</span></p> : null}
    {item?.reviewed_at ? <p className="mt-1 text-[10px] text-inkLight">Decided {new Date(item.reviewed_at).toLocaleString()}</p> : null}
    {item?.comment ? <p className="mt-1 rounded border border-green-200 bg-white/80 p-1 text-[11px] text-ink" data-testid="saved-comment"><span className="font-semibold text-green-800">Comment saved{item.commented_at ? ` ${new Date(item.commented_at).toLocaleString()}` : ''}:</span> {item.comment}</p> : null}
    {invalid ? <p className="mt-1 text-[11px] text-red-700">Requires edit before it can be accepted.</p> : null}
    <div className="mt-1 flex basis-full flex-wrap gap-2 text-[11px]">
      <button type="button" disabled={busy || invalid || !item} onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-2 py-0.5 text-green-800 disabled:opacity-40">Accept</button>
      <button type="button" disabled={busy || !item} onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-2 py-0.5">Reject</button>
      <button type="button" disabled={busy || !item} onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-2 py-0.5 text-red-700">Unresolved</button>
      {decision !== 'PENDING' ? <button type="button" disabled={busy} onClick={() => onReset(item.item_id)} className="rounded border border-border px-2 py-0.5 text-inkMid">Revert to pending</button> : null}
      <CommentBox item={item} busy={busy} onComment={onComment} />
      <button type="button" onClick={() => setOpen((current) => !current)} className="ml-auto font-semibold text-accent">{open ? 'Hide detail' : 'Roles, citations and edit'}</button>
    </div>
    {open ? <div className="mt-2">
      {hasComponents ? <ComponentEditor proposal={proposal} item={item} sectionText={sectionText} onDecision={onDecision} busy={busy} /> : null}
      <ProposalCard entry={fact.entry} busy={busy} onSource={onSource} onDecision={onDecision} {...cardProps} />
    </div> : null}
  </>;
  return <li className={`rounded border p-2 ${rowTone[decision] || rowTone.PENDING} ${selected ? 'ring-2 ring-amber-400' : ''}`} data-testid="focused-fact" data-decision={decision}>
    {hasComponents ? (
      <PublishedFact
        fact={publishedFact}
        onSource={onSource}
        aids={aids}
        onComponentSelect={(selection) => onSelectComponent(publishedFact, selection)}
        selectedComponentId={selectedComponentId}
      />
    ) : <>
      <div className="flex flex-wrap items-start gap-2">
        <button type="button" onClick={onSelect} className={`flex-1 text-left text-sm ${decision === 'REJECTED' ? 'line-through' : 'text-ink'}`}><span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-accent">{displayReviewLabel(proposal.subtype_key)}</span>{item?.edited_statement || proposal.statement}</button>
      </div>
      {aids}
    </>}
  </li>;
}

export function FocusedSection({ section, analysis, busy, command, openSource, cardPropsFor, lookFor = null }) {
  const spansById = useMemo(() => new Map((analysis.spans || []).map((span) => [span.span_id, span])), [analysis.spans]);
  const groups = useMemo(() => sectionFacts(section, spansById), [section, spansById]);
  const [selectedId, setSelectedId] = useState(null);
  const [componentSelection, setComponentSelection] = useState(null);
  const [showChecks, setShowChecks] = useState(false);
  const text = section.source_closure?.full_section_span_id ? spansById.get(section.source_closure.full_section_span_id) : null;
  const selected = groups.flatMap((group) => group.facts).find((fact) => fact.entry.proposal.proposal_id === selectedId) || null;
  const activeComponentSelection = componentSelection && componentSelection.proposalId === selectedId ? componentSelection : null;
  const held = section.review_items.filter((item) => item.kind === 'ISSUE' && HELD_CODES.has(item.original?.code));
  const otherChecks = section.review_items.filter((item) => !held.includes(item));
  const factCount = groups.reduce((total, group) => total + group.facts.length, 0);
  function decide(itemId, decision, edits = {}) {
    return command({ type: 'DECIDE_ITEM', item_id: itemId, decision, ...edits });
  }
  function comment(itemId, text) {
    return command({ type: 'COMMENT_ITEM', item_id: itemId, comment: text });
  }
  function reset(itemId) {
    return command({ type: 'RESET_ITEM', item_id: itemId });
  }
  function selectFact(proposalId) {
    setSelectedId((current) => (current === proposalId ? null : proposalId));
    setComponentSelection(null);
  }
  // Clicking the headline (selection === proposal) highlights every OWN
  // component; clicking one component highlights just its own byte range.
  function selectComponent(proposal, selection) {
    setSelectedId(proposal.proposal_id);
    setComponentSelection(selection === proposal
      ? { proposalId: proposal.proposal_id, componentId: null, ranges: ownComponentRanges(proposal.components) }
      : { proposalId: proposal.proposal_id, componentId: selection.component_id, ranges: [{ start_byte: selection.start_byte, end_byte: selection.end_byte }] });
  }
  const decided = groups.flatMap((group) => group.facts).filter((fact) => (fact.entry.review_item?.decision || 'PENDING') !== 'PENDING').length;
  return <section id={`section-${section.node.node_id}`} className="scroll-mt-40 rounded-xl border border-border bg-paper p-4" data-testid="focused-section">
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
      <h3 className="font-display text-xl text-ink">{displaySectionReference(section.routing.section_reference)} {section.heading || 'Agreement section'}</h3>
      <p className="text-xs text-inkLight">{factCount} proposed fact{factCount === 1 ? '' : 's'} in {groups.length} group{groups.length === 1 ? '' : 's'} · {decided} of {factCount} decided{held.length ? ` · ${held.length} held, not shown as facts` : ''}{otherChecks.length ? ` · ${otherChecks.length} other check${otherChecks.length === 1 ? '' : 's'}` : ''}</p>
    </div>
    {lookFor ? <p className="mt-2 rounded border border-accent/30 bg-white p-2 text-sm text-ink" data-testid="section-look-for"><span className="font-semibold text-accent">Look for: </span>{lookFor}</p> : null}
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div className="max-h-[70vh] overflow-auto rounded border border-border bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">Provision as written{selected ? ' · cited words highlighted' : ''}</p>
        {text ? <SectionText text={text} marks={selected ? (activeComponentSelection ? activeComponentSelection.ranges : selected.spans) : []} /> : <p className="text-sm text-inkLight">Section text unavailable.</p>}
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">What the draft says · click a fact to see its cited words</p>
        {groups.length === 0 ? <p className="text-sm text-inkLight">No proposed fact for this section.</p> : null}
        <ol className="space-y-2">{groups.map((group) => <li key={group.key} className={group.facts.length > 1 ? 'rounded border border-dashed border-border p-1' : ''}>{group.facts.length > 1 ? <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-inkLight">One legal effect, {group.facts.length} facts</p> : null}<ul className="space-y-1">{group.facts.map((fact) => <FactRow key={fact.entry.proposal.proposal_id} fact={fact} busy={busy} selected={selectedId === fact.entry.proposal.proposal_id} onSelect={() => selectFact(fact.entry.proposal.proposal_id)} onDecision={decide} onComment={comment} onReset={reset} onSource={openSource} cardProps={cardPropsFor(fact.entry)} onSelectComponent={selectComponent} selectedComponentId={selectedId === fact.entry.proposal.proposal_id ? activeComponentSelection?.componentId || null : null} sectionText={text} />)}</ul></li>)}</ol>
        {held.length ? <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950" data-testid="focused-held"><p className="font-semibold">Proposed by the model but held, not shown as facts</p><ul className="mt-1 list-disc space-y-1 pl-5">{held.map((item) => <li key={item.item_id}>{heldStatement(item) || `${displayReviewLabel(item.original?.code)} finding`}</li>)}</ul></div> : null}
        {otherChecks.length ? <div className="mt-3"><button type="button" onClick={() => setShowChecks((current) => !current)} className="text-xs font-semibold text-accent">{showChecks ? 'Hide' : 'Show'} {otherChecks.length} other review check{otherChecks.length === 1 ? '' : 's'}</button>{showChecks ? <div className="mt-2 space-y-2">{otherChecks.map((item) => <Requirement key={item.item_id} item={item} analysis={analysis} busy={busy} onSource={openSource} onDecision={decide} />)}</div> : null}</div> : null}
      </div>
    </div>
  </section>;
}

export default function FocusedReview({ view, analysis, focus, busy, command, openSource, cardPropsFor, allSectionsHref, brief = null }) {
  const lookFor = new Map((brief?.sections || []).map((item) => [item.reference, item.look_for]));
  const sections = focus.map((reference) => ({
    reference,
    section: view.sections.find((candidate) => candidate.routing.section_reference === reference) || null,
  }));
  const missing = sections.filter((item) => !item.section).map((item) => item.reference);
  const found = sections.filter((item) => item.section);
  return <section aria-labelledby="focused-review-heading" className="space-y-4">
    <div className="border-b border-border pb-2">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">Focused review</p>
      <h2 id="focused-review-heading" className="font-display text-2xl text-ink">{found.length} provision{found.length === 1 ? '' : 's'} selected for discussion</h2>
      <p className="text-sm text-inkLight">Each provision is shown as written beside what the draft says about it. {allSectionsHref ? <a href={allSectionsHref} className="font-semibold text-accent">Show all sections</a> : null}</p>
      <p className="mt-1 text-xs text-inkMid">Jump to: {sections.filter((item) => item.section).map((item) => <a key={item.reference} href={`#section-${item.section.node.node_id}`} className="mr-2 font-semibold text-accent">{displaySectionReference(item.reference)}</a>)}</p>
      {missing.length ? <p className="mt-1 text-xs text-red-700">Not found in this agreement: {missing.join(', ')}</p> : null}
    </div>
    {brief ? <div className="rounded-xl border border-accent/40 bg-white p-4" data-testid="review-brief">
      <p className="text-xs font-bold uppercase tracking-wide text-accent">{brief.title}</p>
      <p className="mt-1 text-sm text-ink">{brief.intro}</p>
      {brief.ask?.length ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-inkMid">{brief.ask.map((line, index) => <li key={index}>{line}</li>)}</ol> : null}
      <p className="mt-2 text-xs text-inkLight">Each section below starts with what to look for. Comments are saved with the fact and read by the assistant; an edit is compared with the original wording to understand the correction.</p>
    </div> : null}
    {sections.filter((item) => item.section).map((item) => <FocusedSection key={item.section.node.node_id} section={item.section} analysis={analysis} busy={busy} command={command} openSource={openSource} cardPropsFor={cardPropsFor} lookFor={lookFor.get(item.reference) || null} />)}
  </section>;
}
