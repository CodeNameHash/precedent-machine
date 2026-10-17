import { useMemo, useState } from 'react';
import { renderHeadline, renderLayer } from '../../lib/product/fact-components';
import { displayReviewLabel } from '../../lib/product/review-labels';
import { displaySectionReference } from '../../lib/product/section-reference-display';
import { buildTableView } from '../../lib/product/table-view';
import ProvisionTables from './ProvisionTables';

const VALUE_KINDS = new Set(['THRESHOLD', 'PERIOD', 'PERCENTAGE', 'DATE', 'AMOUNT']);
const REFERENCE_KINDS = new Set(['DEFINED_TERM', 'CROSS_REFERENCE']);

function CanonicalValue({ value }) {
  if (!value || value.canonical === undefined) return null;
  return <span className="ml-1 rounded bg-paper px-1 text-[11px] font-semibold text-accent" data-testid="canonical-value">{value.unit ? `${value.canonical} ${value.unit}` : String(value.canonical)}</span>;
}

// Ben, 2026-10-17 (plan finding (47)), on the 2.01 Consideration package
// tree: "hitting 'show detail' doesn't add much...just smae stuff again?
// Also, we should better indent the (i) and (ii) for the right to receive
// that is shown". A parent whose children together cover its words is
// shown as its children, each indented one level, with no line of its own
// and no toggle (the join of the children was the repeated detail); a
// parent with words of its own shows them with its children indented
// beneath, no toggle; list elements such as (i) and (ii) are separate
// indented lines; every line is one text style, left-aligned. This
// supersedes the closed-by-default detail of 2026-09-14 ("hide detail
// under the full layer tree as the default"): the tree is open throughout.
function normaliseTreeWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Words that may sit between the children of a parent they cover: the
// connectives of a list ("(i) ... and (ii) ...", "either ... or ...").
const CONNECTIVES = new Set(['and', 'or', 'plus', 'either', 'both', 'as', 'well', 'nor', 'together']);

export function childrenCoverParent(component) {
  const children = Array.isArray(component?.children) ? component.children.filter((child) => child && typeof child.text === 'string' && child.text) : [];
  if (children.length === 0 || typeof component.text !== 'string') return false;
  const anchored = [component, ...children].every((item) => Number.isSafeInteger(item.start_byte) && Number.isSafeInteger(item.end_byte));
  let remainder;
  if (anchored) {
    // The parent's text outside its children's byte ranges.
    const bytes = new TextEncoder().encode(component.text);
    const decoder = new TextDecoder();
    const ranges = children.map((child) => [Math.max(0, child.start_byte - component.start_byte), Math.min(bytes.length, child.end_byte - component.start_byte)])
      .filter(([start, end]) => end > start).sort((left, right) => left[0] - right[0]);
    const pieces = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
      if (start > cursor) pieces.push(decoder.decode(bytes.subarray(cursor, start)));
      cursor = Math.max(cursor, end);
    }
    if (cursor < bytes.length) pieces.push(decoder.decode(bytes.subarray(cursor)));
    remainder = pieces.join(' ');
  } else {
    remainder = component.text;
    for (const child of children) {
      const index = remainder.indexOf(child.text);
      if (index === -1) return false;
      remainder = `${remainder.slice(0, index)} ${remainder.slice(index + child.text.length)}`;
    }
  }
  const leftover = normaliseTreeWords(remainder).split(' ').filter(Boolean);
  return leftover.every((word) => CONNECTIVES.has(word));
}

function ComponentNode({ display, raw, initiallyExpanded, onComponentSelect, selectedComponentId, selectedComponentIds = null }) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const isReference = REFERENCE_KINDS.has(display.kind);
  const hoverText = display.resolves_to?.text || null;
  const showsValue = VALUE_KINDS.has(display.kind);
  const isSelected = (!!selectedComponentId && raw.component_id === selectedComponentId)
    || (Array.isArray(selectedComponentIds) && selectedComponentIds.includes(raw.component_id));
  const covered = display.has_children && childrenCoverParent(raw);
  const children = display.has_children
    ? <ComponentLayer components={raw.children} initiallyExpanded={initiallyExpanded} onComponentSelect={onComponentSelect} selectedComponentId={selectedComponentId} selectedComponentIds={selectedComponentIds} />
    : null;
  if (covered) {
    return <li className={isSelected ? 'mt-1 rounded bg-amber-100 ring-1 ring-amber-400' : 'mt-1'} data-testid="component-node" data-kind={display.kind} data-covered="true" data-selected={isSelected || undefined}>
      {children}
    </li>;
  }
  return <li className={isSelected ? 'mt-1 rounded bg-amber-100 ring-1 ring-amber-400' : 'mt-1'} data-testid="component-node" data-kind={display.kind} data-selected={isSelected || undefined}>
    <div className="block text-left">
      {display.gap_before ? <span className="mr-1 text-inkLight" data-testid="gap-marker">[...]</span> : null}
      {isReference && hoverText ? (
        <button
          type="button"
          onClick={() => { setResolvedOpen((current) => !current); if (onComponentSelect) onComponentSelect(raw); }}
          title={hoverText}
          className="text-left text-ink"
          data-testid="reference-term"
          data-origin={display.origin}
        >
          {display.text}
        </button>
      ) : (
        <span
          className="text-ink"
          data-testid={display.inherited ? 'inherited-word' : undefined}
          data-origin={display.origin}
          onClick={onComponentSelect ? () => onComponentSelect(raw) : undefined}
        >
          {display.text}
        </span>
      )}
      {showsValue ? <CanonicalValue value={display.value} /> : null}
    </div>
    {isReference && hoverText && resolvedOpen ? <p className="ml-4 text-[11px] text-inkLight" data-testid="resolved-text">&rarr; {hoverText}</p> : null}
    {children}
  </li>;
}

export function ComponentLayer({ components, initiallyExpanded, onComponentSelect, selectedComponentId, selectedComponentIds = null }) {
  const displayed = renderLayer(components);
  return <ul className="mt-1 space-y-1 border-l border-border pl-3 text-left">
    {displayed.map((display, index) => <ComponentNode key={display.component_id} display={display} raw={components[index]} initiallyExpanded={initiallyExpanded} onComponentSelect={onComponentSelect} selectedComponentId={selectedComponentId} selectedComponentIds={selectedComponentIds} />)}
  </ul>;
}

export function PublishedFact({ fact, onSource, initiallyExpanded, aids = null, annotation = null, onComponentSelect = null, selectedComponentId = null }) {
  const [open, setOpen] = useState(!!initiallyExpanded);
  const headline = renderHeadline(fact);
  const firstSpanId = fact.components?.[0]?.source_span_id || null;
  const headlineProps = onComponentSelect
    ? { onClick: () => onComponentSelect(fact), role: 'button', tabIndex: 0, className: 'cursor-pointer text-sm text-ink' }
    : { className: 'text-sm text-ink' };
  return <li className="rounded border border-border bg-white p-3" data-testid="published-fact">
    {annotation}
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        {fact.section_reference ? <p className="text-[10px] font-bold uppercase tracking-wide text-inkLight">{displaySectionReference(fact.section_reference)}</p> : null}
        <p {...headlineProps} data-testid="fact-headline">{headline}</p>
      </div>
      <div className="flex items-center gap-2">
        {onSource ? <button type="button" onClick={() => onSource(fact.source_closure_id, firstSpanId)} className="rounded border border-border px-2 py-0.5 text-[11px] font-semibold text-accent" data-testid="citation-button">Source</button> : null}
        <button type="button" onClick={() => setOpen((current) => !current)} className="rounded bg-ink px-2 py-0.5 text-[11px] font-semibold text-white" data-testid="fact-descend-control">
          {open ? 'Hide layers' : 'Show layers'}
        </button>
      </div>
    </div>
    {aids}
    {open ? <ComponentLayer components={fact.components} initiallyExpanded={initiallyExpanded} onComponentSelect={onComponentSelect} selectedComponentId={selectedComponentId} /> : null}
  </li>;
}

// `view` picks between the table-based layout (mockup approved by Ben
// 2026-09-12/13) and the original layer-descent layout. Left unset, it
// defaults to 'tables' only when `tableShapes` resolves a table for at
// least one fact -- so callers that pass no `tableShapes` (V1 output, or a
// caller not yet updated for the table view) keep rendering exactly as
// before.
export default function PublishedSummary({
  groups, onSource, initiallyExpanded = false, view = null,
  tableShapes = null, legalSchema = null, reviewItemsByFactId = null,
  provenanceByFactId = null, sectionTextByFactId = null,
  onDecision = null, onComment = null, onReset = null,
  heading = 'Published summary',
}) {
  const flatFacts = useMemo(() => (groups || []).flatMap((group) => group.facts), [groups]);
  const tableView = useMemo(
    () => (tableShapes ? buildTableView({ facts: flatFacts, tableShapes, legalSchema }) : null),
    [tableShapes, legalSchema, flatFacts],
  );
  const hasTables = !!(tableView && tableView.sections.some((section) => section.tables.some((table) => table.rows.length > 0)));
  const resolvedView = view || (hasTables ? 'tables' : 'layers');

  // `heading` null drops the section title: the lawyer preview follows the
  // deal page (pages/deals/[id].js), whose header card is followed directly
  // by the first section heading (Ben, 2026-09-14: "completely copy the
  // visual style - including the page header").
  const labelled = heading ? { 'aria-labelledby': 'published-summary-heading' } : { 'aria-label': 'Published summary' };
  if (resolvedView === 'tables' && tableView) {
    return <section {...labelled} className="space-y-6" data-testid="published-summary">
      {heading ? <h2 id="published-summary-heading" className="font-display text-2xl text-ink">{heading}</h2> : null}
      <ProvisionTables
        tableView={tableView}
        facts={flatFacts}
        reviewItemsByFactId={reviewItemsByFactId}
        provenanceByFactId={provenanceByFactId}
        sectionTextByFactId={sectionTextByFactId}
        onDecision={onDecision}
        onComment={onComment}
        onReset={onReset}
      />
    </section>;
  }

  return <section {...labelled} className="space-y-6" data-testid="published-summary">
    {heading ? <h2 id="published-summary-heading" className="font-display text-2xl text-ink">{heading}</h2> : null}
    {(groups || []).map((group) => group.collapsed
      ? <details key={group.family_key} data-testid="published-family" data-collapsed="true">
        <summary className="cursor-pointer font-display text-lg text-ink border-b border-border pb-1">{displayReviewLabel(group.family_key)} <span className="text-sm text-inkLight">({group.facts.length} boilerplate {group.facts.length === 1 ? 'rule' : 'rules'}, click to expand)</span></summary>
        <ul className="mt-2 space-y-2">{group.facts.map((fact) => <PublishedFact key={fact.fact_id} fact={fact} onSource={onSource} initiallyExpanded={initiallyExpanded} />)}</ul>
      </details>
      : <div key={group.family_key} data-testid="published-family">
        <h3 className="font-display text-lg text-ink border-b border-border pb-1">{displayReviewLabel(group.family_key)}</h3>
        <ul className="mt-2 space-y-2">{group.facts.map((fact) => <PublishedFact key={fact.fact_id} fact={fact} onSource={onSource} initiallyExpanded={initiallyExpanded} />)}</ul>
      </div>)}
  </section>;
}
