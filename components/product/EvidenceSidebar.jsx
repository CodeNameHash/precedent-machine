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

// Visual style, Ben, 2026-09-14: "the background summary app lives on deal
// corpus - I want you to completely copy the visual style - including the
// page header." The sidebar is one of the deal page's white cards
// (pages/deals/[id].js): hairline border, soft shadow, `font-display`
// title, `font-ui` labels in ink-light, `font-body` text in ink, the small
// uppercase tracked badge with a rounded border, and its `text-accent`
// rounded buttons.
const BADGE = 'inline-flex items-center text-[10px] font-ui font-medium px-2 py-1 rounded border uppercase tracking-wider';
const LABEL = 'text-[10px] font-ui font-medium uppercase tracking-wider text-inkLight';
const BODY = 'font-body text-sm leading-relaxed text-ink';
const BUTTON = 'px-2 py-0.5 text-xs font-ui rounded border border-accent/30 text-accent hover:bg-accent/5 disabled:opacity-40 transition-colors';
const DECISION_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200', ACCEPTED: 'bg-green-50 text-green-700 border-green-200',
  EDITED: 'bg-sky-50 text-sky-700 border-sky-200', REJECTED: 'bg-gray-100 text-inkLight border-border', UNRESOLVED: 'bg-seller/10 text-seller border-seller/20',
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
    <span className={`${BADGE} ${DECISION_BADGE[decision]}`}>{DECISION_WORD[decision] || decision}</span>
    {reviewItem?.reviewed_at ? <p className="mt-1 text-xs font-ui text-inkLight">Decided {new Date(reviewItem.reviewed_at).toLocaleString()}</p> : null}
    {decision === 'EDITED' && reviewItem?.edited_headline ? <p className="mt-1 text-xs font-ui text-inkMid">This fact was edited before it was accepted.</p> : null}
    {reviewItem?.comment ? <p className="mt-1 rounded border border-border bg-bg/50 p-2 text-xs font-body text-inkMid" data-testid="evidence-saved-comment"><span className="font-ui font-medium text-ink">Comment:</span> {reviewItem.comment}</p> : null}
    {onDecision && reviewItem ? <div className="mt-2 flex flex-wrap gap-2 text-xs font-ui" data-testid="evidence-decision-controls">
      <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'ACCEPTED')} className={BUTTON}>Accept</button>
      <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'REJECTED')} className={BUTTON}>Reject</button>
      {decision !== 'PENDING' && onReset ? <button type="button" disabled={busy} onClick={() => onReset(reviewItem.item_id)} className="px-2 py-0.5 text-xs font-ui rounded border border-border text-inkMid hover:text-ink disabled:opacity-40 transition-colors">Revert to pending</button> : null}
      {onComment ? (commentOpen ? <span className="flex basis-full flex-wrap items-center gap-2">
        <textarea aria-label="Comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} className="w-full rounded border border-border px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
        <button type="button" disabled={busy} onClick={() => { onComment(reviewItem.item_id, commentDraft); setCommentOpen(false); }} className="px-2 py-1 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40">Save comment</button>
        <button type="button" onClick={() => setCommentOpen(false)} className="text-xs font-ui text-inkLight hover:text-ink">Cancel</button>
      </span> : <button type="button" onClick={() => setCommentOpen(true)} className="text-xs font-ui text-accent hover:underline">{reviewItem.comment ? 'Edit comment' : 'Add comment'}</button>) : null}
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
  return <div className="sticky bottom-0 border-t border-border bg-white px-6 py-3" data-testid="linked-definition" data-section={definition.section_key}>
    <p className={LABEL}>{definition.title}{definition.party && definition.exact ? <span className="ml-1 font-normal normal-case tracking-normal text-inkFaint">· {definition.party}</span> : null}</p>
    {definition.lines.length
      ? <ul className="mt-1 space-y-0.5" data-testid="linked-definition-summary">{definition.lines.map((line, index) => <li key={index} className="truncate font-body text-sm leading-relaxed text-ink" title={line}>{line}</li>)}</ul>
      : <p className="mt-1 text-xs font-ui text-inkLight" data-testid="linked-definition-summary">No definition of that party's Material Adverse Effect among the facts.</p>}
    {definition.fact_id
      ? <a href={`#provision-section-${definition.section_key}`} onClick={() => { if (onOpen) onOpen(definition); }} className={`mt-2 inline-block ${BUTTON}`} data-testid="full-definition">Full definition</a>
      : null}
  </div>;
}

export default function EvidenceSidebar({
  fact, componentId = null, componentIds = null, reviewItem = null, provenance = null, sectionText = null,
  onDecision = null, onComment = null, onReset = null, onClose = null, busy = false,
  linkedDefinition = null, onOpenDefinition = null, initialTreeOpen = false,
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
  const [treeOpen, setTreeOpen] = useState(!!initialTreeOpen);
  const ownComponents = useMemo(() => (fact.components || []).filter((item) => item && (item.origin === 'OWN' || !item.origin)), [fact]);

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
      className={`-mb-px border-b-2 px-1 pb-2 text-sm font-ui transition-colors ${tab === key ? 'border-accent font-medium text-ink' : 'border-transparent text-inkLight hover:text-ink'}`}>{label}</button>
  );
  return <aside ref={asideRef} className="sticky top-0 max-h-screen w-full max-w-sm shrink-0 self-start overflow-y-auto bg-white border border-border rounded-lg shadow-sm text-sm" data-testid="evidence-sidebar" aria-label="Evidence">
    <div className="border-b border-border px-6 pt-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          {fact.section_reference ? <p className="text-xs font-ui text-inkLight" data-testid="evidence-eyebrow">{displaySectionReference(fact.section_reference)}</p> : null}
          <p className="mt-1 font-display text-2xl text-ink">{fact.headline?.label || 'Evidence'}</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Close evidence" className="text-xl leading-none text-inkLight hover:text-ink">×</button> : null}
      </div>
      <div className="mt-4 flex gap-5" role="tablist" data-testid="evidence-tabs">
        {tabButton('detail', 'Detail', 'evidence-tab-detail')}
        {tabButton('source', 'Source', 'evidence-tab-source')}
        {tabButton('comments', 'Comments', 'evidence-tab-comments')}
      </div>
    </div>
    <div className="space-y-4 px-6 py-4">
    {tab !== 'detail' ? null : <>
    <section data-testid="evidence-words">
      <p className={LABEL}>Exact words</p>
      {components.length > 1 ? <p className="mt-1 text-xs font-ui text-inkLight" data-testid="evidence-basis-count">Read together, {components.length} components</p> : null}
      {component ? components.map((item) => <p key={item.component_id} className={`mt-1 ${BODY}`}>&ldquo;{item.text}&rdquo;</p>) : <p className="mt-1 text-xs font-ui text-inkLight">The whole fact is marked in the clause below; select a pill for the words behind one reading.</p>}
    </section>

    {clauseParts ? <section data-testid="evidence-clause">
      <p className={LABEL}>Clause</p>
      <pre className={`mt-1 whitespace-pre-wrap ${BODY}`}>{(() => {
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
      {/* Ben, 2026-09-14: "in right hand side bar - hide detail under the
          full layer tree as the default. Also call it Interpretation Tree
          and also why do we show the greyed out text and the rest? Can't we
          just do the bit in highlight and below?" The tree is closed to
          start, its nodes' detail closed too, and it shows the fact's own
          components only (the inherited chapeau and the representing
          words that precede them are context, not this fact). */}
      <button type="button" onClick={() => setTreeOpen((current) => !current)} aria-expanded={treeOpen} className={`${LABEL} flex w-full items-center justify-between text-left`} data-testid="interpretation-tree-toggle">
        <span>Interpretation Tree</span>
        <span className="font-normal normal-case tracking-normal text-inkFaint">{treeOpen ? 'hide' : 'show'}</span>
      </button>
      {treeOpen ? <ComponentLayer components={ownComponents} initiallyExpanded={false} selectedComponentId={componentId} selectedComponentIds={citedIds} /> : null}
    </section>
    </>}

    {tab !== 'source' ? null : <>
    <section data-testid="evidence-checks">
      <p className={LABEL}>Checks the code ran</p>
      {checks.length === 0
        ? <p className="mt-1 text-xs font-ui text-green-700">All structural checks passed.</p>
        : <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs font-ui text-seller">{checks.map((problem, index) => <li key={index}>{problem}</li>)}</ul>}
    </section>

    <section data-testid="evidence-provenance">
      <p className={LABEL}>Provenance</p>
      {provenance ? <dl className="mt-1 space-y-0.5 text-xs font-ui text-inkMid">
        {provenance.run_id ? <div><dt className="inline font-medium text-inkLight">Run: </dt><dd className="inline">{provenance.run_id}{provenance.generation ? ` (generation ${provenance.generation})` : ''}</dd></div> : null}
        {provenance.schema_version ? <div><dt className="inline font-medium text-inkLight">Schema: </dt><dd className="inline">{provenance.schema_version}</dd></div> : null}
        {provenance.prompt_bundle ? <div><dt className="inline font-medium text-inkLight">Prompt bundle: </dt><dd className="inline">{provenance.prompt_bundle}</dd></div> : null}
        {provenance.model ? <div><dt className="inline font-medium text-inkLight">Model: </dt><dd className="inline">{provenance.model}</dd></div> : null}
      </dl> : <p className="mt-1 text-xs font-ui text-inkLight">Provenance unavailable.</p>}
    </section>
    </>}

    {tab !== 'comments' ? null : (
    <section data-testid="evidence-review-trail-section">
      <p className={LABEL}>Review trail</p>
      <div className="mt-1">
        <ReviewTrail reviewItem={reviewItem} onDecision={onDecision} onComment={onComment} onReset={onReset} busy={busy} />
      </div>
    </section>
    )}
    </div>
    {linkedDefinition ? <LinkedDefinition definition={linkedDefinition} onOpen={onOpenDefinition} /> : null}
  </aside>;
}
