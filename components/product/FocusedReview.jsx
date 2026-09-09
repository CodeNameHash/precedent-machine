import { useMemo, useState } from 'react';
import ProposalCard from './ProposalCard';
import { Requirement } from './ReviewWorkspace';
import { displayReviewLabel } from '../../lib/product/review-labels';
import { displaySectionReference } from '../../lib/product/section-reference-display';
import { byteRangesToParts, firstCitedByte } from '../../lib/product/section-highlight';

const badge = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

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

function FactRow({ fact, selected, onSelect, onDecision, onSource, busy, cardProps }) {
  const [open, setOpen] = useState(false);
  const { proposal, review_item: item } = fact.entry;
  const decision = item?.decision || 'PENDING';
  const invalid = proposal.validation_status !== 'VALID';
  return <li className={`rounded border p-2 ${selected ? 'border-amber-400 bg-amber-50' : 'border-border bg-white'}`} data-testid="focused-fact">
    <div className="flex flex-wrap items-start gap-2">
      <button type="button" onClick={onSelect} className="flex-1 text-left text-sm text-ink"><span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-accent">{displayReviewLabel(proposal.subtype_key)}</span>{item?.edited_statement || proposal.statement}</button>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge[decision]}`}>{displayReviewLabel(decision)}</span>
    </div>
    {invalid ? <p className="mt-1 text-[11px] text-red-700">Requires edit before it can be accepted.</p> : null}
    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
      <button type="button" disabled={busy || invalid || !item} onClick={() => onDecision(item.item_id, 'ACCEPTED')} className="rounded border border-green-700 px-2 py-0.5 text-green-800 disabled:opacity-40">Accept</button>
      <button type="button" disabled={busy || !item} onClick={() => onDecision(item.item_id, 'REJECTED')} className="rounded border border-slate-500 px-2 py-0.5">Reject</button>
      <button type="button" disabled={busy || !item} onClick={() => onDecision(item.item_id, 'UNRESOLVED')} className="rounded border border-red-600 px-2 py-0.5 text-red-700">Unresolved</button>
      <button type="button" onClick={() => setOpen((current) => !current)} className="ml-auto font-semibold text-accent">{open ? 'Hide detail' : 'Roles, citations and edit'}</button>
    </div>
    {open ? <div className="mt-2"><ProposalCard entry={fact.entry} busy={busy} onSource={onSource} onDecision={onDecision} {...cardProps} /></div> : null}
  </li>;
}

export function FocusedSection({ section, analysis, busy, command, openSource, cardPropsFor }) {
  const spansById = useMemo(() => new Map((analysis.spans || []).map((span) => [span.span_id, span])), [analysis.spans]);
  const groups = useMemo(() => sectionFacts(section, spansById), [section, spansById]);
  const [selectedId, setSelectedId] = useState(null);
  const [showChecks, setShowChecks] = useState(false);
  const text = section.source_closure?.full_section_span_id ? spansById.get(section.source_closure.full_section_span_id) : null;
  const selected = groups.flatMap((group) => group.facts).find((fact) => fact.entry.proposal.proposal_id === selectedId) || null;
  const held = section.review_items.filter((item) => item.kind === 'ISSUE' && HELD_CODES.has(item.original?.code));
  const otherChecks = section.review_items.filter((item) => !held.includes(item));
  const factCount = groups.reduce((total, group) => total + group.facts.length, 0);
  function decide(itemId, decision, edits = {}) {
    return command({ type: 'DECIDE_ITEM', item_id: itemId, decision, ...edits });
  }
  return <section id={`section-${section.node.node_id}`} className="scroll-mt-40 rounded-xl border border-border bg-paper p-4" data-testid="focused-section">
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
      <h3 className="font-display text-xl text-ink">{displaySectionReference(section.routing.section_reference)} {section.heading || 'Agreement section'}</h3>
      <p className="text-xs text-inkLight">{factCount} proposed fact{factCount === 1 ? '' : 's'} in {groups.length} group{groups.length === 1 ? '' : 's'}{held.length ? ` · ${held.length} held, not shown as facts` : ''}{otherChecks.length ? ` · ${otherChecks.length} other check${otherChecks.length === 1 ? '' : 's'}` : ''}</p>
    </div>
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div className="max-h-[70vh] overflow-auto rounded border border-border bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">Provision as written{selected ? ' · cited words highlighted' : ''}</p>
        {text ? <SectionText text={text} marks={selected ? selected.spans : []} /> : <p className="text-sm text-inkLight">Section text unavailable.</p>}
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-inkLight">What the draft says · click a fact to see its cited words</p>
        {groups.length === 0 ? <p className="text-sm text-inkLight">No proposed fact for this section.</p> : null}
        <ol className="space-y-2">{groups.map((group) => <li key={group.key} className={group.facts.length > 1 ? 'rounded border border-dashed border-border p-1' : ''}>{group.facts.length > 1 ? <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-inkLight">One legal effect, {group.facts.length} facts</p> : null}<ul className="space-y-1">{group.facts.map((fact) => <FactRow key={fact.entry.proposal.proposal_id} fact={fact} busy={busy} selected={selectedId === fact.entry.proposal.proposal_id} onSelect={() => setSelectedId((current) => current === fact.entry.proposal.proposal_id ? null : fact.entry.proposal.proposal_id)} onDecision={decide} onSource={openSource} cardProps={cardPropsFor(fact.entry)} />)}</ul></li>)}</ol>
        {held.length ? <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950" data-testid="focused-held"><p className="font-semibold">Proposed by the model but held, not shown as facts</p><ul className="mt-1 list-disc space-y-1 pl-5">{held.map((item) => <li key={item.item_id}>{heldStatement(item) || `${displayReviewLabel(item.original?.code)} finding`}</li>)}</ul></div> : null}
        {otherChecks.length ? <div className="mt-3"><button type="button" onClick={() => setShowChecks((current) => !current)} className="text-xs font-semibold text-accent">{showChecks ? 'Hide' : 'Show'} {otherChecks.length} other review check{otherChecks.length === 1 ? '' : 's'}</button>{showChecks ? <div className="mt-2 space-y-2">{otherChecks.map((item) => <Requirement key={item.item_id} item={item} analysis={analysis} busy={busy} onSource={openSource} onDecision={decide} />)}</div> : null}</div> : null}
      </div>
    </div>
  </section>;
}

export default function FocusedReview({ view, analysis, focus, busy, command, openSource, cardPropsFor, allSectionsHref }) {
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
    {sections.filter((item) => item.section).map((item) => <FocusedSection key={item.section.node.node_id} section={item.section} analysis={analysis} busy={busy} command={command} openSource={openSource} cardPropsFor={cardPropsFor} />)}
  </section>;
}
