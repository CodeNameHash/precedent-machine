import { useState } from 'react';
import { renderHeadline, renderLayer } from '../../lib/product/fact-components';
import { displayReviewLabel } from '../../lib/product/review-labels';
import { displaySectionReference } from '../../lib/product/section-reference-display';

const VALUE_KINDS = new Set(['THRESHOLD', 'PERIOD', 'PERCENTAGE', 'DATE', 'AMOUNT']);
const REFERENCE_KINDS = new Set(['DEFINED_TERM', 'CROSS_REFERENCE']);

function CanonicalValue({ value }) {
  if (!value || value.canonical === undefined) return null;
  return <span className="ml-1 rounded bg-paper px-1 text-[11px] font-semibold text-accent" data-testid="canonical-value">{value.unit ? `${value.canonical} ${value.unit}` : String(value.canonical)}</span>;
}

function ComponentNode({ display, raw, initiallyExpanded }) {
  const [open, setOpen] = useState(!!initiallyExpanded);
  const [resolvedOpen, setResolvedOpen] = useState(!!initiallyExpanded);
  const isReference = REFERENCE_KINDS.has(display.kind);
  const hoverText = display.resolves_to?.text || null;
  const showsValue = VALUE_KINDS.has(display.kind);
  return <li className="mt-1" data-testid="component-node" data-kind={display.kind}>
    <span className="inline-flex flex-wrap items-baseline gap-1">
      {display.gap_before ? <span className="text-inkLight" data-testid="gap-marker">[...]</span> : null}
      {isReference && hoverText ? (
        <button
          type="button"
          onClick={() => setResolvedOpen((current) => !current)}
          title={hoverText}
          className={`underline decoration-dotted ${display.inherited ? 'italic text-inkLight' : 'text-ink'}`}
          data-testid="reference-term"
          data-origin={display.origin}
        >
          {display.text}
        </button>
      ) : (
        <span
          className={display.inherited ? 'italic text-inkLight' : 'text-ink'}
          data-testid={display.inherited ? 'inherited-word' : undefined}
          data-origin={display.origin}
        >
          {display.text}
        </span>
      )}
      {showsValue ? <CanonicalValue value={display.value} /> : null}
      {display.has_children ? (
        <button type="button" onClick={() => setOpen((current) => !current)} className="text-xs font-semibold text-accent" data-testid="descend-control">
          {open ? 'Hide detail' : 'Show detail'}
        </button>
      ) : null}
    </span>
    {isReference && hoverText && resolvedOpen ? <p className="ml-4 text-[11px] text-inkLight" data-testid="resolved-text">&rarr; {hoverText}</p> : null}
    {display.has_children && open ? <ComponentLayer components={raw.children} initiallyExpanded={initiallyExpanded} /> : null}
  </li>;
}

function ComponentLayer({ components, initiallyExpanded }) {
  const displayed = renderLayer(components);
  return <ul className="mt-1 space-y-1 border-l border-border pl-3">
    {displayed.map((display, index) => <ComponentNode key={display.component_id} display={display} raw={components[index]} initiallyExpanded={initiallyExpanded} />)}
  </ul>;
}

function PublishedFact({ fact, onSource, initiallyExpanded }) {
  const [open, setOpen] = useState(!!initiallyExpanded);
  const headline = renderHeadline(fact);
  const firstSpanId = fact.components?.[0]?.source_span_id || null;
  return <li className="rounded border border-border bg-white p-3" data-testid="published-fact">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        {fact.section_reference ? <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">{displaySectionReference(fact.section_reference)}</p> : null}
        <p className="text-sm text-ink" data-testid="fact-headline">{headline}</p>
      </div>
      <div className="flex items-center gap-2">
        {onSource ? <button type="button" onClick={() => onSource(fact.source_closure_id, firstSpanId)} className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold text-accent" data-testid="citation-button">Source</button> : null}
        <button type="button" onClick={() => setOpen((current) => !current)} className="rounded bg-ink px-2 py-0.5 text-[11px] font-semibold text-white" data-testid="fact-descend-control">
          {open ? 'Hide layers' : 'Show layers'}
        </button>
      </div>
    </div>
    {open ? <ComponentLayer components={fact.components} initiallyExpanded={initiallyExpanded} /> : null}
  </li>;
}

export default function PublishedSummary({ groups, onSource, initiallyExpanded = false }) {
  return <section aria-labelledby="published-summary-heading" className="space-y-6" data-testid="published-summary">
    <h2 id="published-summary-heading" className="font-display text-2xl text-ink">Published summary</h2>
    {(groups || []).map((group) => <div key={group.family_key} data-testid="published-family">
      <h3 className="font-display text-lg text-ink border-b border-border pb-1">{displayReviewLabel(group.family_key)}</h3>
      <ul className="mt-2 space-y-2">{group.facts.map((fact) => <PublishedFact key={fact.fact_id} fact={fact} onSource={onSource} initiallyExpanded={initiallyExpanded} />)}</ul>
    </div>)}
  </section>;
}
