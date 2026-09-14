import { useEffect, useMemo, useRef, useState } from 'react';
import { ComponentLayer } from './PublishedSummary';
import { walk, validateFactComponents } from '../../lib/product/fact-components';
import { displaySectionReference } from '../../lib/product/section-reference-display';
import { byteRangesToLayeredParts } from '../../lib/product/section-highlight';

// The persistent right-hand evidence sidebar behind a table pill (mockup
// approved by Ben 2026-09-12/13): the exact words of the supporting
// component, the clause with those words highlighted and its section
// reference, the full layer tree, the checks the code ran, the review trail
// (decision, edits, comments) and provenance (run generation, schema,
// prompt bundle, model). Not a modal -- a caller renders this in a
// persistent side column (see ProvisionTables.jsx).

const DECISION_BADGE = {
  PENDING: 'bg-amber-100 text-amber-900', ACCEPTED: 'bg-green-100 text-green-900',
  EDITED: 'bg-blue-100 text-blue-900', REJECTED: 'bg-slate-200 text-slate-700', UNRESOLVED: 'bg-red-100 text-red-800',
};

const DECISION_WORD = {
  PENDING: 'Needs review', ACCEPTED: 'Accepted', EDITED: 'Edited and accepted', REJECTED: 'Rejected', UNRESOLVED: 'Marked unresolved',
};

function findComponent(components, componentId) {
  for (const [component] of walk(components || [])) {
    if (component.component_id === componentId) return component;
  }
  return null;
}

function ReviewTrail({ reviewItem, onDecision, onComment, onReset, busy }) {
  const decision = reviewItem?.decision || 'PENDING';
  const [commentDraft, setCommentDraft] = useState(reviewItem?.comment || '');
  const [commentOpen, setCommentOpen] = useState(false);
  return <div data-testid="evidence-review-trail">
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DECISION_BADGE[decision]}`}>{DECISION_WORD[decision] || decision}</span>
    {reviewItem?.reviewed_at ? <p className="mt-1 text-[10px] text-inkLight">Decided {new Date(reviewItem.reviewed_at).toLocaleString()}</p> : null}
    {decision === 'EDITED' && reviewItem?.edited_headline ? <p className="mt-1 text-[11px] text-blue-900">This fact was edited before it was accepted.</p> : null}
    {reviewItem?.comment ? <p className="mt-1 rounded border border-green-200 bg-white/80 p-1 text-[11px] text-ink" data-testid="evidence-saved-comment"><span className="font-semibold text-green-800">Comment:</span> {reviewItem.comment}</p> : null}
    {onDecision && reviewItem ? <div className="mt-2 flex flex-wrap gap-2 text-[11px]" data-testid="evidence-decision-controls">
      <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'ACCEPTED')} className="rounded-none border border-green-700 px-2 py-0.5 text-green-800 disabled:opacity-40">Accept</button>
      <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'REJECTED')} className="rounded-none border border-slate-500 px-2 py-0.5">Reject</button>
      {decision !== 'PENDING' && onReset ? <button type="button" disabled={busy} onClick={() => onReset(reviewItem.item_id)} className="rounded-none border border-border px-2 py-0.5 text-inkMid">Revert to pending</button> : null}
      {onComment ? (commentOpen ? <span className="flex basis-full flex-wrap items-center gap-2">
        <textarea aria-label="Comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} className="w-full rounded-none border border-border p-1 text-xs font-normal" />
        <button type="button" disabled={busy} onClick={() => { onComment(reviewItem.item_id, commentDraft); setCommentOpen(false); }} className="rounded-none bg-ink px-2 py-0.5 text-white disabled:opacity-40">Save comment</button>
        <button type="button" onClick={() => setCommentOpen(false)} className="text-inkLight">Cancel</button>
      </span> : <button type="button" onClick={() => setCommentOpen(true)} className="font-semibold text-accent">{reviewItem.comment ? 'Edit comment' : 'Add comment'}</button>) : null}
    </div> : null}
  </div>;
}

// Ben, 2026-09-14, on the MAE (aggregate) cell of the representations
// table: "for the definition, take out of table but when you click the MAE
// box and the side bar opens, there is a fixed visual element at the bottom
// of the side bar that has the MAE definition summary which you can click
// through to get the full definition". Pinned to the sidebar's foot (the
// aside is the scroll pane, so sticky bottom-0 as its last child keeps it in
// view while the evidence scrolls): the linked section's title, the
// party, one summary line per definition prong (at most three, then "…"),
// and "Full definition", which jumps to the section's anchor and opens the
// definition fact in this sidebar.
function LinkedDefinition({ definition, onOpen }) {
  return <div className="sticky bottom-0 border-t border-border bg-white px-5 py-3" data-testid="linked-definition" data-section={definition.section_key}>
    <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">{definition.title}{definition.party && definition.exact ? <span className="ml-1 font-normal normal-case tracking-normal text-inkFaint">· {definition.party}</span> : null}</p>
    {definition.lines.length
      ? <ul className="mt-1 space-y-0.5" data-testid="linked-definition-summary">{definition.lines.map((line, index) => <li key={index} className="truncate font-serif text-[12px] leading-5 text-ink" title={line}>{line}</li>)}</ul>
      : <p className="mt-1 text-[11px] text-inkLight" data-testid="linked-definition-summary">No definition of that party's Material Adverse Effect among the facts.</p>}
    {definition.fact_id
      ? <a href={`#provision-section-${definition.section_key}`} onClick={() => { if (onOpen) onOpen(definition); }} className="mt-2 inline-block rounded border border-border px-2 py-0.5 text-[11px] font-ui font-medium text-ink hover:border-ink" data-testid="full-definition">Full definition</a>
      : null}
  </div>;
}

export default function EvidenceSidebar({
  fact, componentId = null, componentIds = null, reviewItem = null, provenance = null, sectionText = null,
  onDecision = null, onComment = null, onReset = null, onClose = null, busy = false,
  linkedDefinition = null, onOpenDefinition = null,
}) {
  if (!fact) return null;
  // A coded cell may rest on several components read together (a merger
  // form on the merging party, the "with and into" operation, the party
  // merged into and the survivor; Ben, 2026-09-13: "it's actually the
  // combined fact ... that makes it a reverse triangular"). Every cited
  // component is the basis: all are quoted, marked in the clause and lit in
  // the tree.
  const citedIds = Array.isArray(componentIds) && componentIds.length ? componentIds : (componentId ? [componentId] : []);
  const components = citedIds.map((id) => findComponent(fact.components, id)).filter(Boolean);
  const component = components[0] || null;
  const highlightRanges = useMemo(() => components
    .filter((item) => Number.isSafeInteger(item.start_byte) && Number.isSafeInteger(item.end_byte))
    .map((item) => ({ start_byte: item.start_byte, end_byte: item.end_byte }))
    .sort((left, right) => left.start_byte - right.start_byte), [components]);
  // The whole fact (its own words, first to last byte) is marked lightly
  // and the cited words strongly, so a qualifier reads inside its
  // representation. A row opened without a cited component shows the
  // fact's extent alone.
  const factExtent = useMemo(() => {
    const own = [...walk(fact.components || [])].map(([item]) => item)
      .filter((item) => (item.origin === 'OWN' || !item.origin) && Number.isSafeInteger(item.start_byte) && Number.isSafeInteger(item.end_byte));
    if (!own.length) return [];
    return [{ start_byte: Math.min(...own.map((item) => item.start_byte)), end_byte: Math.max(...own.map((item) => item.end_byte)) }];
  }, [fact]);
  const clauseParts = useMemo(() => {
    if (!sectionText || !Number.isSafeInteger(sectionText.start_byte) || (highlightRanges.length === 0 && factExtent.length === 0)) return null;
    return byteRangesToLayeredParts(sectionText.exact_text, sectionText.start_byte, highlightRanges, factExtent);
  }, [sectionText, highlightRanges, factExtent]);
  // The marked words sit in the middle of the sidebar's own scroll pane
  // when a selection opens (Ben, 2026-09-13: "make the qualifier middle of
  // the view pane on the side bar").
  const asideRef = useRef(null);
  const markRef = useRef(null);
  useEffect(() => {
    const aside = asideRef.current;
    const mark = markRef.current;
    if (!aside || !mark) return;
    const target = mark.offsetTop - aside.clientHeight / 2 + mark.offsetHeight / 2;
    if (typeof aside.scrollTo === 'function') aside.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    else aside.scrollTop = Math.max(0, target);
  }, [fact, citedIds.join(','), clauseParts]);
  const checks = useMemo(() => validateFactComponents(fact), [fact]);

  // Sticky: the sidebar's top follows the viewport, so a pill clicked half-way
  // down a long page opens its evidence beside it, not at the page top (Ben,
  // 2026-09-13). Its own contents scroll when they exceed the viewport.
  // Deal Storylines / Corpus panel (Ben, 2026-09-13): a white column with
  // the section reference as eyebrow, the headline as a large title, an X
  // to close, and three tabs. Detail holds the words, the clause and the
  // tree; Source the checks and provenance; Comments the review trail.
  const [tab, setTab] = useState('detail');
  const tabButton = (key, label, testId) => (
    <button type="button" onClick={() => setTab(key)} data-testid={testId} aria-selected={tab === key} role="tab"
      className={`-mb-px border-b-2 px-1 pb-2 text-[13px] ${tab === key ? 'border-accent font-semibold text-ink' : 'border-transparent text-inkLight hover:text-ink'}`}>{label}</button>
  );
  return <aside ref={asideRef} className="sticky top-0 max-h-screen w-full max-w-sm shrink-0 self-start overflow-y-auto border-l border-border bg-white text-sm" data-testid="evidence-sidebar" aria-label="Evidence">
    <div className="border-b border-border px-5 pt-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          {fact.section_reference ? <p className="text-[12px] text-inkLight" data-testid="evidence-eyebrow">{displaySectionReference(fact.section_reference)}</p> : null}
          <p className="mt-1 font-sans text-2xl font-semibold tracking-tight text-ink">{fact.headline?.label || 'Evidence'}</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Close evidence" className="text-xl leading-none text-inkLight hover:text-ink">×</button> : null}
      </div>
      <div className="mt-4 flex gap-5" role="tablist" data-testid="evidence-tabs">
        {tabButton('detail', 'Detail', 'evidence-tab-detail')}
        {tabButton('source', 'Source', 'evidence-tab-source')}
        {tabButton('comments', 'Comments', 'evidence-tab-comments')}
      </div>
    </div>
    <div className="space-y-4 px-5 py-4">
    {tab !== 'detail' ? null : <>
    <section data-testid="evidence-words">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Exact words</p>
      {components.length > 1 ? <p className="mt-1 text-[10px] text-inkLight" data-testid="evidence-basis-count">Read together, {components.length} components</p> : null}
      {component ? components.map((item) => <p key={item.component_id} className="mt-1 font-serif text-[13px] leading-6 text-ink">&ldquo;{item.text}&rdquo;</p>) : <p className="mt-1 text-xs text-inkLight">The whole fact is marked in the clause below; select a pill for the words behind one reading.</p>}
    </section>

    {clauseParts ? <section data-testid="evidence-clause">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Clause</p>
      <pre className="mt-1 whitespace-pre-wrap font-serif text-[13px] leading-6 text-ink">{(() => {
        let anchored = false;
        return clauseParts.map((part, index) => {
          if (part.level === 'strong') {
            const ref = anchored ? undefined : markRef; anchored = true;
            return <mark key={index} ref={ref} className="bg-amber-200" data-level="strong">{part.text}</mark>;
          }
          if (part.level === 'light') {
            const ref = anchored || highlightRanges.length ? undefined : markRef; if (!highlightRanges.length) anchored = true;
            return <mark key={index} ref={ref} className="bg-amber-50 text-ink" data-level="light">{part.text}</mark>;
          }
          return <span key={index}>{part.text}</span>;
        });
      })()}</pre>
    </section> : null}

    <section data-testid="evidence-layers">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Full layer tree</p>
      <ComponentLayer components={fact.components} initiallyExpanded selectedComponentId={componentId} selectedComponentIds={citedIds} />
    </section>
    </>}

    {tab !== 'source' ? null : <>
    <section data-testid="evidence-checks">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Checks the code ran</p>
      {checks.length === 0
        ? <p className="mt-1 text-[11px] text-green-800">All structural checks passed.</p>
        : <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-red-700">{checks.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    </section>

    <section data-testid="evidence-provenance">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Provenance</p>
      {provenance ? <dl className="mt-1 space-y-0.5 text-[11px] text-inkMid">
        {provenance.run_id ? <div><dt className="inline font-semibold text-inkLight">Run: </dt><dd className="inline">{provenance.run_id}{provenance.generation ? ` (generation ${provenance.generation})` : ''}</dd></div> : null}
        {provenance.schema_version ? <div><dt className="inline font-semibold text-inkLight">Schema: </dt><dd className="inline">{provenance.schema_version}</dd></div> : null}
        {provenance.prompt_bundle ? <div><dt className="inline font-semibold text-inkLight">Prompt bundle: </dt><dd className="inline">{provenance.prompt_bundle}</dd></div> : null}
        {provenance.model ? <div><dt className="inline font-semibold text-inkLight">Model: </dt><dd className="inline">{provenance.model}</dd></div> : null}
      </dl> : <p className="mt-1 text-[11px] text-inkLight">Provenance unavailable.</p>}
    </section>
    </>}

    {tab !== 'comments' ? null : (
    <section data-testid="evidence-review-trail-section">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">Review trail</p>
      <div className="mt-1">
        <ReviewTrail reviewItem={reviewItem} onDecision={onDecision} onComment={onComment} onReset={onReset} busy={busy} />
      </div>
    </section>
    )}
    </div>
    {linkedDefinition ? <LinkedDefinition definition={linkedDefinition} onOpen={onOpenDefinition} /> : null}
  </aside>;
}
