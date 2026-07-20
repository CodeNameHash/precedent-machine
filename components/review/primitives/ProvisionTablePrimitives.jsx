import { useState } from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import {
  getCitableQuotes,
  getCitableText,
  getCitableValue,
  getTaggedItemQuote,
  isCitableValue,
  isTaggedItem,
} from '../../../lib/citable.js';
import { HoverSource } from '../shared.js';
import { splitForCell } from '../table-configs/card-utils.js';
import { STANDARD_COLORS } from '../table-configs/standard-colors.js';
import { resolveRowFocus } from '../../review-v2/provisionIndexHelpers.js';
import { TERM_GRID_COLUMN } from '../table-configs/layout.js';

const { MATERIAL_CONTRACT_BUCKET_CODES, MATERIAL_CONTRACT_BUCKET_META } = taxonomy;

const PILL_TONES = {
  neutral: 'border-border bg-bg text-ink',
  present: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  missing: 'border-border bg-bg/60 text-inkFaint',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

function textValue(value) {
  const inner = isCitableValue(value) ? getCitableValue(value) : value;
  if (inner === null || inner === undefined || inner === '') return null;
  if (typeof inner === 'boolean') return inner ? 'Yes' : 'No';
  if (Array.isArray(inner)) return inner.map(textValue).filter(Boolean).join(', ');
  if (typeof inner === 'object') return inner.label || inner.text || inner.code || inner.value || JSON.stringify(inner);
  return String(inner);
}

function evidenceQuote(value, evidence, source) {
  if (typeof evidence === 'string' && evidence.trim()) return evidence.trim();
  const citable = getCitableText(value);
  if (citable) return citable;
  // Item 10: a TAGGED item (COR pill, MAE carve-out pill, ...) carries its
  // OWN verbatim on `.text` -- almost always with `quotes: []` (empty, not
  // absent). Prefer that per-item quote over the array/source fallbacks
  // below, which otherwise land on the whole card's primary_quote (the head
  // of the definition/clause the item is only one line of).
  if (isTaggedItem(value)) {
    const tagged = getTaggedItemQuote(value);
    if (tagged) return tagged;
  }
  const quotes = Array.isArray(evidence) ? evidence : getCitableQuotes(evidence);
  if (quotes.length) return quotes[0];
  return source?.primary_quote || source?.full_text || source?.region_full_text || null;
}

function romanize(index) {
  const numbers = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let n = Number(index) + 1;
  let out = '';
  for (const [value, numeral] of numbers) {
    while (n >= value) {
      out += numeral;
      n -= value;
    }
  }
  return out || String(index + 1);
}

// Item 13: default sourceLabel to `${source.short_title} — ${pillLabel}`
// when both exist and the caller hasn't passed one explicitly -- callers
// with a more specific label (e.g. a rep-qualifier row's own rep name) pass
// `sourceLabel` directly and win over this default.
function defaultSourceLabel(source, pillLabel) {
  const title = source && typeof source.short_title === 'string' ? source.short_title.trim() : '';
  const label = typeof pillLabel === 'string' ? pillLabel.trim() : '';
  if (title && label) return `${title} — ${label}`;
  return title || null;
}

export function EvidenceHoverSource({ value, evidence, source, quote, highlight, sourceLabel, pillLabel, children, as = 'span', className }) {
  const resolved = quote || evidenceQuote(value, evidence, source);
  const label = sourceLabel !== undefined ? sourceLabel : defaultSourceLabel(source, pillLabel);
  return (
    <HoverSource quote={resolved} highlight={highlight === undefined ? textValue(value) : highlight} sourceLabel={label} as={as} className={className}>
      {children}
    </HoverSource>
  );
}

export function PillCell({ value, label, tone = 'neutral', color, evidence, source, quote, highlight, sourceLabel, className = '', wrap = false }) {
  const text = label || textValue(value) || 'Not captured';
  // `color` (a shared standard-colour palette key) wins over `tone` so the same
  // legal standard reads the same colour everywhere it appears.
  const classes = (color && STANDARD_COLORS[color]) || PILL_TONES[tone] || PILL_TONES.neutral;
  // Default (`wrap` false) keeps every existing pill's single-line
  // truncate+ellipsis behaviour untouched. `wrap: true` is an opt-in escape
  // hatch for callers whose label is legitimately long prose (e.g. IOC
  // exception/restriction taxonomy labels) rather than a short code/value --
  // `truncate`'s `white-space: nowrap` gives the label an unbreakable
  // min-content width equal to its full single-line text, which `max-w-full`
  // cannot shrink below inside a `flex flex-wrap` container, so the pill
  // pushes past its cell/table edge instead of wrapping. Swapping to
  // `whitespace-normal break-words` drops that min-content width to its
  // longest single word, letting the pill wrap onto multiple lines and stay
  // inside its container instead.
  const textClass = wrap ? 'whitespace-normal break-words' : 'truncate';
  return (
    <EvidenceHoverSource value={value} evidence={evidence} source={source} quote={quote} highlight={highlight} sourceLabel={sourceLabel} pillLabel={text}>
      <span className={`inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[11px] font-medium ${classes} ${className}`.trim()}>
        <span className={textClass}>{text}</span>
      </span>
    </EvidenceHoverSource>
  );
}

// Phase B compact-column reshaping: the per-cell counterpart to
// ProvisionTable.jsx's FULL_TEXT_COLUMNS. Used by configs where a single
// "value"/"detail" cell legitimately carries BOTH short scalar rows (a
// month count, a percentage) AND occasional long prose rows (a raw clause,
// a concatenated list) — so the whole column can't be wholesale relocated
// behind a row-level expander without hiding the short values too. Renders
// the full text inline when short; when it exceeds `max`, shows a
// truncated preview plus the same "see text" <details> affordance
// ProvisionTable.jsx uses for whole-column relocation, so nothing is lost,
// only decluttered.
export function TruncatedWithSeeText({ text, evidence, source, max = 160, className = '' }) {
  const { value, short, truncated } = splitForCell(text, max);
  if (!value) return null;
  if (!truncated) {
    return (
      <EvidenceHoverSource evidence={evidence} source={source} as="span" className={className}>
        {value}
      </EvidenceHoverSource>
    );
  }
  return (
    <span className={className}>
      <EvidenceHoverSource evidence={evidence || value} source={source} as="span">
        {short}&hellip;
      </EvidenceHoverSource>
      <details className="mt-1">
        <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>
          See provision
        </summary>
        <div className="mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
          {value}
        </div>
      </details>
    </span>
  );
}

// Line-clamp counterpart to TruncatedWithSeeText, for header-table value
// cells that can carry very long prose (Ben, Bioverativ: consideration-hero
// rows). Same "see provision" reveal affordance and term-cell-seetext class,
// but the collapsed preview is the FULL text visually clipped to `lines`
// lines via CSS line-clamp rather than a hard character cut -- short values
// render unclamped and untouched. Opt-in: existing TruncatedWithSeeText call
// sites are unaffected; only configs that explicitly reach for this get the
// clamp.
export function ClampedWithSeeText({ text, evidence, source, lines = 3, className = '' }) {
  const value = text === null || text === undefined ? '' : String(text);
  if (!value) return null;
  // Rough long-value heuristic: ~3 lines at typical table-cell width is
  // comfortably north of 200 characters for this font/size.
  if (value.length <= 200) {
    return (
      <EvidenceHoverSource evidence={evidence} source={source} as="span" className={className}>
        {value}
      </EvidenceHoverSource>
    );
  }
  return (
    <div className={className}>
      <EvidenceHoverSource evidence={evidence || value} source={source} as="div">
        <div
          className="whitespace-pre-wrap break-words"
          style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {value}
        </div>
      </EvidenceHoverSource>
      <details className="mt-1">
        <summary className="term-cell-seetext" style={{ listStyle: 'none' }}>
          See provision
        </summary>
        <div className="mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
          {value}
        </div>
      </details>
    </div>
  );
}

export function ThresholdCellWithHoverQuote({ value, threshold, evidence, source, label = 'No threshold', className = '' }) {
  const text = textValue(threshold ?? value);
  if (!text) return <span className="text-inkFaint italic">{label}</span>;
  return (
    <EvidenceHoverSource value={threshold ?? value} evidence={evidence} source={source} as="span">
      <span className={`font-mono text-[11px] text-ink ${className}`.trim()}>{text}</span>
    </EvidenceHoverSource>
  );
}

export function CoverageChecklist({ items = [], emptyCopy = 'No checklist items captured.' }) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!rows.length) return <EmptyStateBranch copy={emptyCopy} />;
  return (
    <ul className="space-y-1" data-testid="coverage-checklist">
      {rows.map((item, index) => (
        <li key={item.id || item.label || index} className="flex items-start gap-2">
          <PillCell label={item.present ? 'Present' : 'Missing'} tone={item.present ? 'present' : 'missing'} evidence={item.evidence} source={item.source} />
          <span className="min-w-0 flex-1 text-xs text-ink">{item.label || textValue(item.value) || `Item ${index + 1}`}</span>
        </li>
      ))}
    </ul>
  );
}

// Item 17 (r4): optional onSelectCard/resolveCard/selectedCardId wire each
// grouped sub-row to the ClauseSidebar, the same way ProvisionTable.jsx's
// generic <tr> loop does -- see nosol-section.config.js's buildGroups(),
// which threads a `card` field onto the rows it hands GroupedSubRows.
// Callers that don't pass onSelectCard (ioc-exceptions, termination-rights,
// conditions configs, as of this change) render exactly as before: no click
// handler, no cursor-pointer, no dead affordance.
export function GroupedSubRows({ groups = [], emptyCopy = 'No grouped rows captured.', onSelectCard, resolveCard, selectedCardId }) {
  // Item 2 (r6): conditions.config.js's row.seeText used to be a whole
  // pre-rendered <details> node squeezed inline into the label cell's own
  // grid column -- the same "expansion distorts the column it's inside"
  // defect flagged on the reps table and ported off ProvisionTable.jsx's
  // generic path there. GroupedSubRows owns its own expandedRowId here
  // (it's a real component, not a bare renderCell function, so it can hold
  // this state itself rather than needing it threaded in) -- callers that
  // pass raw expansion content via row.seeTextContent get the SAME
  // full-width block-below-the-row treatment; callers still passing a
  // pre-rendered row.seeText node (nosol-section.config.js,
  // termination-rights) fall back to the prior inline rendering unchanged.
  const [expandedRowId, setExpandedRowId] = useState(null);
  const visibleGroups = Array.isArray(groups) ? groups.filter((group) => group && Array.isArray(group.rows) && group.rows.length) : [];
  if (!visibleGroups.length) return <EmptyStateBranch copy={emptyCopy} />;
  return (
    <div className="space-y-2" data-testid="grouped-sub-rows">
      {visibleGroups.map((group, groupIndex) => (
        <div key={group.id || group.label || groupIndex} className="rounded border border-border bg-bg/30">
          <div className="border-b border-border px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-inkFaint">
            {group.label || `Group ${groupIndex + 1}`}
          </div>
          <div className="divide-y divide-border">
            {group.rows.map((row, rowIndex) => {
              const rowCard = onSelectCard && typeof resolveCard === 'function' ? resolveCard(row) : null;
              const rowCardKey = rowCard ? (rowCard.id || rowCard.provision_instance_id) : null;
              const isSelectedRow = Boolean(rowCardKey) && selectedCardId === rowCardKey;
              const rowKey = row.id || row.label || rowIndex;
              const objectSource = row.source && typeof row.source === 'object' ? row.source : null;
              const source = objectSource || row.card || row.sourceCard || rowCard
                || (Array.isArray(row.sourceCards) ? row.sourceCards[0] : null);
              const fallbackProvisionText = typeof row.evidence === 'string' && row.evidence.trim()
                ? row.evidence.trim()
                : (source?.primary_quote || source?.region_full_text || null);
              // Grouped rows should follow the same universal contract as
              // ProvisionTable's flat rows. A source-backed substantive row
              // always exposes its clause, even when its config only supplied
              // evidence/card metadata and no bespoke seeTextContent node.
              const expansionContent = row.seeTextContent || fallbackProvisionText;
              const hasFullWidthExpansion = Boolean(expansionContent);
              const isExpanded = hasFullWidthExpansion && expandedRowId === rowKey;
              return (
                <div key={rowKey}>
                  <div
                    className={`grid gap-2 px-2 py-1.5${rowCard ? ' mtx-row-clickable' : ''}`}
                    style={{
                      gridTemplateColumns: `${TERM_GRID_COLUMN} 1fr`,
                      ...(rowCard ? { cursor: 'pointer', ...(isSelectedRow ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' } : {}) } : {}),
                    }}
                    onClick={rowCard ? () => onSelectCard(rowCard, resolveRowFocus(row)) : undefined}
                  >
                    <span>
                      <span className="text-[11px] font-medium text-ink">{row.label || `Row ${rowIndex + 1}`}</span>
                      {hasFullWidthExpansion ? (
                        <button
                          type="button"
                          className="term-cell-seetext mt-1 block"
                          style={{ listStyle: 'none' }}
                          onClick={(e) => { e.stopPropagation(); setExpandedRowId((cur) => (cur === rowKey ? null : rowKey)); }}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? 'Hide provision' : 'See provision'}
                        </button>
                      ) : (
                        /* Item 8: an optional per-row "See provision" expander,
                           rendered under the LABEL (left) cell -- legacy
                           callers (nosol-section.config.js#rowNode,
                           termination-rights row builders) pass a
                           pre-rendered row.seeText node instead. */
                        row.seeText || null
                      )}
                    </span>
                    <EvidenceHoverSource value={row.value} evidence={row.evidence} source={row.source} as="span" className="text-xs text-ink">
                      {row.children || textValue(row.value) || row.detail || <span className="text-inkFaint italic">Not captured</span>}
                    </EvidenceHoverSource>
                  </div>
                  {isExpanded ? (
                    <div className="mtx-provision-expansion-row border-t border-dashed border-border bg-bg/20 px-2 py-2">
                      <div className="whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight">
                        {expansionContent}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// A footer STRIP for a ProvisionTable section (rendered by ProvisionTable
// via config.renderFooter, outside the <table> body -- never a mid-table
// row). Summarizes how many of a family's canonical/standard items are
// actually present on this deal, with the absent ones listed (greyed) so
// the gap is still visible without cluttering the row list with "Not
// found" filler rows. Built generically (present/total/absentItems) so any
// config with a canonical checklist -- Closing Conditions today, IOC /
// Material Contracts later -- can reuse it via the same renderFooter hook.
export function CoverageFooter({ presentCount = 0, totalCount = 0, absentItems = [], label = 'items present' }) {
  const absent = Array.isArray(absentItems) ? absentItems.filter(Boolean) : [];
  return (
    <div className="border-t border-border bg-bg/40 px-3 py-2 text-[11px] text-inkFaint" data-testid="coverage-footer">
      <span className="font-medium text-ink">{presentCount} of {totalCount} {label}</span>
      {absent.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-inkFaint" style={{ listStyle: 'none' }}>
            {absent.length} not included
          </summary>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {absent.map((item, index) => (
              <span
                key={item.id || item.label || index}
                title={item.code || undefined}
                className="inline-flex items-center rounded border border-border bg-bg/60 px-1.5 py-0.5 text-inkFaint"
              >
                {item.label || `Item ${index + 1}`}
              </span>
            ))}
          </span>
        </details>
      ) : null}
    </div>
  );
}

export function RomanNumeralOrdinal({ index = 0, children, className = '' }) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`.trim()} data-testid="roman-numeral-ordinal">
      <span className="text-[10px] font-medium uppercase text-inkFaint">({romanize(index)})</span>
      <span>{children}</span>
    </span>
  );
}

export function EmptyStateBranch({ copy = 'No matching provisions found.', children }) {
  return (
    <div className="rounded border border-dashed border-border bg-bg/40 px-3 py-2 text-xs italic text-inkFaint" data-testid="empty-state-branch">
      {children || copy}
    </div>
  );
}

export function ComputedRollupHeader({ label, value, detail, evidence, source, tone = 'info' }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-border bg-bg/50 px-2 py-1.5" data-testid="computed-rollup-header">
      <span className="text-[10px] font-medium uppercase tracking-wider text-inkFaint">{label}</span>
      <PillCell value={value} tone={tone} evidence={evidence} source={source} />
      {detail ? <span className="text-[11px] text-inkFaint">{detail}</span> : null}
    </div>
  );
}

export {
  getCitableQuotes,
  getCitableText,
  getCitableValue,
  isCitableValue,
  MATERIAL_CONTRACT_BUCKET_CODES,
  MATERIAL_CONTRACT_BUCKET_META,
};
