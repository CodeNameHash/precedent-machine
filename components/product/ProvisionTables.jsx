import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import EvidenceSidebar from './EvidenceSidebar';
import { SHOW_CODES_BY_DEFAULT, factIdOf, factSummaryText } from '../../lib/product/table-view';
import { marketLine } from '../../lib/product/comparison-tables';
import FeedbackDialog from './FeedbackDialog';
import { walk } from '../../lib/product/fact-components';

// Ben, 2026-09-14, on the scaled page: "sidebar width now good but font
// size not good". Every width, padding, gap, band height and the page
// title stay; each font size scaled above is raised by 1.3.
// Ben, 2026-09-14, comparing the deployed page with Deal Storylines at the
// same browser zoom ("zoom level is the same"): every dimension was about
// 1.7x the reference, so "please fix relative sizes". Every px below is the
// first reading scaled by 0.58: tabs 10 with 7 / 12 padding, header band
// 30 with its title at 11, body padding 14, header labels 7.5, cells 9.5,
// chips 7, cards 16 apart.
// Renders a lib/product/table-view.js buildTableView() result as the small
// tables of coded headline conclusions, pills per subject, that the
// published and Query pages show (mockup approved by Ben 2026-09-12/13):
// one section per family, group headers in capitals, a Term column with a
// "See provision" control, pills carrying a tone.
// Clicking a pill (or any populated cell) selects it and its row and opens
// the persistent EvidenceSidebar; it is never a modal.
//
// Visual style, Ben, 2026-09-14: "the background summary app lives on deal
// corpus - I want you to completely copy the visual style - including the
// page header." Then, the same day, comparing the result with his Deal
// Storylines app: "also font etc doesn't match the deal storylines page.
// Also their pages are 'cleaner' in style". Measured from that app's
// timeline page: each content block is a white card with a 1px #dcdcdc
// border, a 4px radius and no shadow; a header band about 52px tall in a
// soft tint with a 1px bottom border of the same hue, an icon at the left,
// the title in the tint's darker colour at 19px medium and a chevron at
// the right; a 24px body; labels uppercase at 12px, letter-spaced, grey;
// values near-black; a related detail in a tinted box. Here each provision
// section is one card (the green tint; the definitions section the blue),
// the tables inside keep their columns with header labels uppercase 12px
// grey, cells at 16px, pills as small rounded-[2px] tinted chips of 12px
// uppercase text, row separators 1px #ececec and no heavy borders; links
// are near-black with an underline under the pointer; the blue is the one
// accent, for buttons and the active tab.

const CARD = 'bg-white border-0 border-t-[10px] border-[#DCE3E1] overflow-hidden';
const CARD_BODY = 'p-[14px]';
// The header band's tints: green for provision sections, blue for the
// definitions section.
const TINTS = {
  green: { band: 'bg-[#F1F4F8] border-b border-[#DCE3E1] text-[#03203D]', box: 'bg-[#F1F4F8] text-[#03203D]' },
  blue: { band: 'bg-[#EAF0F6] border-b border-[#DCE3E1] text-[#0B3D71]', box: 'bg-[#EAF0F6] text-[#0B3D71]' },
};
// Ben, 2026-11-01: "Visually, if you look at structure mechanics, I think
// all the text is maybe small or not using the space well enough." Every
// size below is the 2026-09-14 reading raised by about one seventh: header
// labels 10.5, cells and subjects 14, quiet links 10, the detail control 11,
// sub-items 13. Widths, paddings and gaps stay.
const TH = 'border-b border-[#03203D] px-[10px] py-[8px] text-left text-[10.5px] font-ui font-medium uppercase tracking-[0.12em] text-[#6B7785]';
// Ben, 2026-11-01, round 3, on the phone: "some of the columns overlap with
// each other": a long word ("Oversubscription") breaks inside its cell
// rather than running into the next column, and below md the term column
// takes 34% of the table.
const TD = 'px-[10px] py-[10px] align-top [overflow-wrap:anywhere]';
const ROW = 'border-b border-[#DCE3E1] last:border-0';
// Ben, 2026-11-01: "The widths of columns vary a lot… more consistent widths
// throughout." Fixed layout: the term column 26%, the specifics column (display
// fact_text) 34% when shown, the other columns equal shares of what is left.
const TERM_WIDTH = 26;
const SPECIFICS_WIDTH = 34;
function columnWidths(columns, hasTerm) {
  const termShare = hasTerm ? TERM_WIDTH : 0;
  const specifics = columns.filter((column) => column.display === 'fact_text').length;
  const others = columns.length - specifics;
  const specificsShare = others > 0 ? SPECIFICS_WIDTH : (100 - termShare) / Math.max(specifics, 1);
  const otherShare = others > 0 ? (100 - termShare - specifics * specificsShare) / others : 0;
  return columns.map((column) => (column.display === 'fact_text' ? specificsShare : otherShare));
}
const TEXT = 'text-[14px] leading-relaxed text-[#33475E]';
const SUB_TEXT = 'text-[13px] leading-relaxed text-[#33475E]';
const SUBJECT = 'font-ui text-[14px] font-semibold text-[#03203D]';
const LINK = 'text-[11px] font-ui text-[#0B3D71] underline-offset-2 hover:underline';
const FOOT = 'border-t border-[#DCE3E1] bg-[#F1F4F8] px-[10px] py-[8px] align-top';
const FOOT_LABEL = 'text-[10.5px] font-ui font-medium uppercase tracking-[0.12em] text-[#6B7785]';
// Ben, 2026-09-14: "UI point, 'see provision' has too much visual hierarchy
// and color which distracts readability." Every "See provision" control and
// the § reference links used the same way (backing-fact lists, Other
// provisions, footers, the combined definition) are quiet: small, faint,
// no capitals, no weight, an underline only under the pointer, placed after
// the subject so they never compete with it.
const QUIET = 'text-[10px] font-ui font-normal normal-case tracking-normal text-[#6B7785] hover:underline hover:text-[#0B3D71]';
// Ben, 2026-09-14: "make the elements below the top level reps (e.g.
// Organization) collapsable and hide them initially but have a clear 'more
// detail' button or similar". The control under a row's subject.
const DETAIL = 'mt-[2.5px] block text-[11px] font-ui font-medium text-[#0B3D71] hover:underline';
// A pill: a small rounded-[2px] tinted chip, 12px uppercase text, no border.
const BADGE = 'inline-flex items-center rounded-full border border-[#B9C8DA] px-[6px] py-[1px] text-[10px] font-ui font-medium uppercase tracking-wide';

// Tones as soft tints with the tint's darker colour for the text (the
// Storylines green and blue, grey for the neutral readings).
const TONE_CLASSES = {
  neutral: 'bg-[#F1F4F8] text-[#33475E]',
  standard: 'bg-[#EAF0F6] text-[#0B3D71]',
  value: 'bg-[#F1F4F8] text-[#33475E]',
  term: 'bg-[#F1F4F8] text-[#33475E]',
  condition: 'bg-[#F1F4F8] text-[#03203D]',
  present: 'bg-[#F1F4F8] text-[#03203D]',
  missing: 'bg-white text-[#6B7785] border border-dashed border-[#B9C8DA]',
  warning: 'bg-[#FBF3E2] text-[#6B4A12]',
  info: 'bg-[#EAF0F6] text-[#0B3D71]',
  buyer: 'bg-[#03203D] text-white',
  seller: 'bg-[#EAF0F6] text-[#0B3D71]',
};

function toneClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

// Work package 12 (plan finding (76)). Ben, 2026-10-17: "odd under ongoing
// updates to have required within a stated period and required promptly.
// Also weird to have the 48 hours there. I know the pills are likely
// helpful for background comparison work etc but do we need to show them
// here? Consider this more generally on the UI pills etc." One page-wide
// setting: with codes hidden (the default, SHOW_CODES_BY_DEFAULT in
// lib/product/table-view.js, Ben's to decide) a coded cell shows the words
// it was read from, quietly, and still opens the sidebar; "Show codes"
// brings the pills up. Values and as-drafted text are words already.
const CodesContext = createContext(true);
// Ben, 2026-11-01: the as-drafted column of every table is behind one
// page-wide "Show specifics" control ("Maybe a little toggle which says
// 'show specifics.' Then I wouldn't have both."); off to start.
const SpecificsContext = createContext(false);
// Package 2: the market payload behind the Compare toggle. Null when the
// toggle is off, so a Cell renders exactly as it did before.
const MarketContext = createContext(null);
// Everything opens every collapsed group without changing the local state
// each group keeps for its own toggle.
const EverythingContext = createContext(false);
// A section's own Specifics pill opens that section's More detail groups.
const SectionOpenContext = createContext(false);

function Cell({ cell, tableKey, rowIndex, subIndex = null, subject = null, selected, onSelect }) {
  const showCodes = useContext(CodesContext);
  const market = useContext(MarketContext);
  if (cell.kind === 'dash') {
    return <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>;
  }
  if (Array.isArray(cell.values) && cell.values.length > 1) {
    // Ben, 2026-11-01: "we don't have to use pills ... it makes it a bit hard
    // to read." Several readings in one cell stack one under another as
    // words; as pills they wrap in a row.
    const stacked = !showCodes || !cell.values.some((value) => value.kind === 'pill');
    return (
      <span className={stacked ? 'flex flex-col gap-[1px]' : 'inline-flex flex-wrap gap-[2.5px]'} data-testid="table-multi">
        {cell.values.map((value, index) => (
          <Cell key={`${value.label}-${index}`} cell={{ ...value, column_id: cell.column_id, ...(index === cell.values.length - 1 && cell.suffix && !cell.values.some((candidate) => candidate.suffix) ? { suffix: cell.suffix } : {}) }} tableKey={tableKey} rowIndex={rowIndex} subIndex={subIndex} subject={subject} selected={selected} onSelect={onSelect} />
        ))}
      </span>
    );
  }
  const isPill = cell.kind === 'pill';
  const asWords = isPill && !showCodes;
  const testId = asWords ? 'table-words' : isPill ? 'table-pill' : (cell.kind === 'value' ? 'table-value' : 'table-text');
  const canSelect = (cell.component_ids || []).length > 0 || (cell.fact_ids || []).length > 0;
  const baseClass = asWords
    ? `text-left font-body ${TEXT}`
    : isPill
      ? `${BADGE} ${toneClass(cell.tone)}`
      : (cell.kind === 'value' ? `text-left font-ui ${TEXT}` : `text-left font-body ${TEXT}`);
  // Ben, 2026-11-01: "we don't have to use pills. I'm not sure they're
  // necessarily the best approach for these things because it makes it a
  // bit hard to read." With the codes off (the default on every surface) a
  // coded cell shows the answer in the schema's words, set as text, no
  // chip; the words it was read from ride on the title. This supersedes the
  // 2026-10-17 words-first reading (the cited fragment as the cell), which
  // read as the agreement's fragments rather than as answers.
  // A suffix_of column follows the answer ("$135.11 per share of Company
  // Common Stock"; "14 calendar days after the agreement date").
  // A suffix read from the fact's words begins with its own punctuation
  // ("Required, within two (2) business days").
  const suffix = cell.suffix && cell.suffix.label ? (cell.suffix.label.startsWith(',') ? cell.suffix.label : ` ${cell.suffix.label}`) : '';
  const shown = `${cell.label}${suffix}`;
  // Ben, 2026-11-01, round 2: "In subsequent match period, you can't have 2
  // business days and 3 business days"; "'shall cause' and… 'shall
  // instruct.' Why do we get two different things? It is because there are
  // different obligations, which should be clear." A reading of a cell read
  // from several facts says, under it, what its fact says.
  const qualifier = cell.qualifier ? <span className="block font-ui text-[11px] leading-snug text-[#6B7785]" data-testid="reading-qualifier">{cell.qualifier}</span> : null;
  // "where it says 'bring down standard' and there are multiple standards
  // for one thing, I would say 'various'": the readings ride on the title.
  const manyTitle = Array.isArray(cell.many) ? cell.many.map((value) => value.label).join('; ') : null;
  // The selected pill is outlined in the accent, as the selected card in
  // Deal Storylines is (Ben, 2026-09-14: "I prefer this side bar behavior").
  const selectedClass = selected ? 'ring-2 ring-accent' : '';
  const selectPayload = {
    tableKey,
    rowIndex,
    subIndex,
    columnId: cell.column_id,
    componentId: (cell.component_ids || [])[0] || null,
    componentIds: cell.component_ids || [],
    factId: (cell.fact_ids || [])[0] || null,
    linkSection: cell.link_section || null,
    value: cell.code || cell.label || null,
    subject,
    cellCode: cell.code || null,
    cellLabel: cell.label || null,
    factIds: cell.fact_ids || [],
  };
  // Ben, 2026-09-14, on the MAE (aggregate) cell: "for the definition, take
  // out of table but when you click the MAE box and the side bar opens,
  // there is a fixed visual element at the bottom of the side bar that has
  // the MAE definition summary which you can click through to get the full
  // definition". No inline "definition" link: the cell carries its
  // link_section on the selection and the sidebar pins the summary.
  const content = !canSelect
    ? <span className={baseClass} data-testid={asWords ? 'table-words' : undefined} data-code={asWords ? cell.code : undefined} title={manyTitle || undefined}>{shown}{qualifier}</span>
    : (() => {
      const title = manyTitle ? manyTitle : cell.defaulted ? 'Not stated for this row; shown as the column\'s default'
        : (cell.reparsed ? 'Re-read from the cited words; the stored number differed'
          : (cell.derived === 'from_components' ? 'Read from the per-share forms below; no fact codes the type'
            : (asWords && cell.words ? `Read from: ${cell.words}` : undefined)));
      return (
        <button
          type="button"
          data-testid={testId}
          data-selected={selected || undefined}
          onClick={() => onSelect(selectPayload)}
          className={`${baseClass} ${selectedClass}`}
          title={title}
          data-defaulted={cell.defaulted || undefined}
          data-reparsed={cell.reparsed || undefined}
          data-code={asWords ? cell.code : undefined}
          data-many={manyTitle ? 'true' : undefined}
        >
          {shown}{qualifier}
        </button>
      );
    })();
  // Package 2: one quiet line under the coded answer. It opens the same
  // cell (the sidebar), never a new interaction. Only a real cell reading
  // gets a line: not a dash, not as-drafted text.
  const marketKey = market && subject && cell.column_id ? `${tableKey}|${subject}|${cell.column_id}` : null;
  const distribution = marketKey ? market.cells?.[marketKey] : null;
  const line = distribution && (cell.kind === 'pill' || cell.kind === 'value') && cell.label
    ? marketLine(distribution, cell.code || cell.label)
    : null;
  return (
    <span className="flex flex-col items-start gap-[1px]">
      {content}
      {line ? (
        <button
          type="button"
          data-testid="market-line"
          data-market={line.kind}
          onClick={() => onSelect(selectPayload)}
          className="block text-left font-ui text-[11px] leading-snug text-[#6B7785] hover:underline hover:text-[#0B3D71]"
        >
          {line.text}
        </button>
      ) : null}
    </span>
  );
}

// Review mode: the answer stays the page's table; "See reason" opens the
// provision text and the interpretation tree inline under the row, with the
// same review commands the old workspace uses.
function ReviewComponents({ components = [], level = 0 }) {
  return (
    <ul className={`${level ? 'mt-[3px] space-y-[2px] border-l border-[#DCE3E1] pl-[10px]' : 'space-y-[3px]'}`} data-testid="review-reason-tree">
      {components.map((component) => (
        <li key={component.component_id} className="font-body text-[12px] leading-snug text-[#33475E]">
          <span className="font-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6B7785]">{component.kind}</span>
          {component.label ? <span className="ml-[5px] font-ui text-[10px] text-[#6B7785]">{component.label}</span> : null}
          <span className="ml-[5px]">“{component.text}”</span>
          {component.children?.length ? <ReviewComponents components={component.children} level={level + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function ReviewReasonPanel({ fact, reviewItem, sectionText, onDecision, onComment, busy = false }) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState(reviewItem?.comment || '');
  if (!fact) return null;
  const decision = reviewItem?.decision || 'PENDING';
  return (
    <div className="border-t border-[#DCE3E1] bg-[#F8FAFC] px-[14px] py-[12px]" data-testid="review-reason">
      <div className="grid gap-[12px] lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="font-ui text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#6B7785]">Provision text</p>
          <p className="mt-[4px] max-h-[220px] overflow-y-auto whitespace-pre-wrap font-body text-[12px] leading-relaxed text-[#33475E]" data-testid="review-reason-text">
            {sectionText?.exact_text || 'The full section text is not available for this fact.'}
          </p>
        </div>
        <div>
          <p className="font-ui text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#6B7785]">Interpretation tree</p>
          <div className="mt-[4px] max-h-[220px] overflow-y-auto">
            {fact.components?.length ? <ReviewComponents components={fact.components} /> : <p className="font-body text-[12px] text-[#6B7785]">No component tree for this fact.</p>}
          </div>
        </div>
      </div>
      <div className="mt-[10px] flex flex-wrap items-center gap-[6px]" data-testid="review-reason-actions">
        <span className="mr-[4px] font-ui text-[10px] text-[#6B7785]">Decision: {decision}</span>
        {onDecision && reviewItem ? <>
          <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'ACCEPTED')} className="rounded-full bg-[#03203D] px-[12px] py-[4px] font-ui text-[10.5px] font-semibold text-white disabled:opacity-40">Agree</button>
          <button type="button" disabled={busy} onClick={() => onDecision(reviewItem.item_id, 'REJECTED')} className="rounded-full border border-[#B9C8DA] bg-white px-[12px] py-[4px] font-ui text-[10.5px] font-semibold text-[#0B3D71] disabled:opacity-40">Disagree</button>
        </> : null}
        {onComment && reviewItem ? (
          <button type="button" onClick={() => setCommentOpen((current) => !current)} className="rounded-full border border-[#B9C8DA] bg-white px-[12px] py-[4px] font-ui text-[10.5px] font-semibold text-[#0B3D71]">Comment</button>
        ) : null}
      </div>
      {commentOpen && reviewItem ? (
        <div className="mt-[7px] flex flex-wrap items-center gap-[6px]">
          <textarea aria-label="Review comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} className="min-w-[220px] flex-1 rounded-[2px] border border-[#B9C8DA] px-[8px] py-[5px] font-ui text-[11px] focus:outline-none focus:ring-1 focus:ring-[#03203D]" />
          <button type="button" disabled={busy || !commentDraft.trim()} onClick={() => { onComment(reviewItem.item_id, commentDraft.trim()); setCommentOpen(false); }} className="rounded-full bg-[#03203D] px-[12px] py-[4px] font-ui text-[10.5px] font-semibold text-white disabled:opacity-40">Save comment</button>
          <button type="button" onClick={() => setCommentOpen(false)} className="font-ui text-[10.5px] text-[#6B7785]">Cancel</button>
        </div>
      ) : null}
      {reviewItem?.comment ? <p className="mt-[6px] font-body text-[11px] text-[#33475E]"><span className="font-ui font-semibold">Comment:</span> {reviewItem.comment}</p> : null}
    </div>
  );
}

// The row name itself opens the sidebar on the row's first fact, so the
// clause and its sourcing are reachable without a pill (Ben, 2026-09-13:
// "you should be able to see the side bar and sourcing not just by
// clicking the pills").
function TermCell({ row, tableKey, rowIndex, subIndex = null, onSelect, detail = null, sub = false, reviewMode = false, reasonOpen = false, onReason = null }) {
  const first = row.backing_facts[0] || null;
  const subjectClass = sub ? 'font-ui text-[13px] font-medium text-[#33475E]' : SUBJECT;
  // Ben, 2026-09-14: "I don't like the 'see provision' behaviour - it
  // shouldn't show the provision x-refs but instead should open the side
  // bar". The control opens the row's first fact in the sidebar, the way
  // the subject does; no list of section references.
  const openFirst = () => onSelect({ tableKey, rowIndex, subIndex, columnId: null, componentId: null, componentIds: [], factId: first.fact_id });
  return (
    <div className={`font-ui ${sub ? 'text-[13px]' : 'text-[14px]'}`}>
      {first ? (
        <button type="button" data-testid="term-open" onClick={openFirst} className={`text-left underline-offset-2 hover:underline ${subjectClass}`}>{row.subject}</button>
      ) : <span className={subjectClass}>{row.subject}</span>}
      {/* A value or vocabulary column filled on this line alone folds in
          here as a trailing detail ("Notice period · 4 business days"):
          Ben, 2026-10-17, "'period' as a column is wasteful as it only
          applies to one provision? Consider that point generally?"
          (lib/product/table-view.js applyColumnRules). */}
      {(row.trailing_details || []).map((detail) => (
        <button
          key={detail.column_id}
          type="button"
          data-testid="trailing-detail"
          title={detail.header || undefined}
          onClick={() => onSelect({ tableKey, rowIndex, subIndex, columnId: detail.column_id, componentId: (detail.cell.component_ids || [])[0] || null, componentIds: detail.cell.component_ids || [], factId: (detail.cell.fact_ids || [])[0] || first?.fact_id || null, linkSection: detail.cell.link_section || null })}
          className={`ml-[4.5px] text-left font-ui ${TEXT} underline-offset-2 hover:underline`}
        >
          {`· ${detail.label}`}
        </button>
      ))}
      {first ? (
        <button type="button" onClick={openFirst} className={`ml-[4.5px] ${QUIET}`} data-testid="see-provision">See provision</button>
      ) : null}
      {reviewMode && onReason ? (
        <button type="button" onClick={onReason} aria-expanded={reasonOpen} className={`ml-[4.5px] ${QUIET}`} data-testid="see-reason">{reasonOpen ? 'Hide reason' : 'See reason'}</button>
      ) : null}
      {row.subject_note ? <div className="mt-[1px] font-body text-[11px] text-[#6b6b6b]" data-testid="subject-note">{row.subject_note}</div> : null}
      {detail ? <DetailControl {...detail} /> : null}
    </div>
  );
}

// Ben, 2026-09-14: "also make the elements below the top level reps (e.g.
// Organization) collapsable and hide them initially but have a clear 'more
// detail' button or similar" and, on the equity awards table, "say
// 'Exceptions' and show the sub rows". Under the subject: "More detail (N)"
// (or the table's sub_rows_label, "Exceptions (N)"), "Less detail" once
// open.
function DetailControl({ count, label, open, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className={DETAIL} data-testid="more-detail" data-open={open || undefined}>
      {open ? '▾ Less detail' : `▸ ${label || 'More detail'} (${count})`}
    </button>
  );
}

// The legacy Structure & Mechanics shape (TopBuild print p.1): one line per
// attribute, TERM / PROVISION, for the single agreement row. Each line lists
// the facts behind it under "See provision".
// Per-step lines (Merger form / Surviving entity, step 1 and step 2) belong
// to a double merger. For any other structure the step-2 lines are hidden
// and the step-1 lines drop their "(Step 1)" suffix (Ben, 2026-09-13:
// "merger form (step 2) shows - and it shouldn't there is no step 2").
function attributeLines(table, row) {
  const perStep = table.per_step_structure || null;
  const dealStructure = row.cells.find((cell) => cell.column_id === 'dealStructure');
  const double = !!perStep && dealStructure?.code === 'DOUBLE_MERGER';
  const stepOf = new Map();
  for (const step of perStep?.steps || []) {
    stepOf.set(step.form_column_id, step.step);
    stepOf.set(step.surviving_entity_column_id, step.step);
  }
  return table.columns
    .filter((column) => double || !stepOf.has(column.column_id) || stepOf.get(column.column_id) === 1)
    .map((column) => ({
      ...column,
      header: !double && stepOf.get(column.column_id) === 1 ? column.header.replace(/\s*\(step 1\)/i, '') : column.header,
    }));
}

// Ben, 2026-11-01, on the interim covenants: "the visual hierarchy is
// weird with the affirmative covenant, 'general terms.' Fix that". A table's
// group header is a sub-heading of the section (13px semibold, the page's
// navy, a little space above), not a grey caption the size of the column
// labels. The lead note under it names an election ("Consideration type:
// Mixed election. Each share receives, at the holder's election, one of the
// options below.").
function GroupHeader({ table }) {
  if (!table.group_header && !table.lead_note) return null;
  return (
    <caption className="pb-[6px] text-left" data-testid="table-group-header">
      {table.group_header ? <span className="block font-sans text-[13px] font-semibold tracking-[-.01em] text-[#03203D]">{table.group_header}</span> : null}
      {table.lead_note ? <span className={`mt-[2px] block font-body ${TEXT}`} data-testid="table-lead-note">{table.lead_note}</span> : null}
    </caption>
  );
}

function AttributeGrid({ table, selection, onSelect }) {
  const row = table.rows[0];
  if (!row) return null;
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === 0;
  const lines = attributeLines(table, row);
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left" data-testid="provision-table" data-table-key={table.table_key} data-layout="attribute-grid">
        <GroupHeader table={table} />
        <colgroup><col className="w-[34%] md:w-[26%]" /><col /></colgroup>
        <thead>
          <tr>
            <th className={`w-[111.5px] ${TH}`}>Term</th>
            <th className={TH}>Summary</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((column) => {
            const cell = row.cells.find((candidate) => candidate.column_id === column.column_id);
            const backing = row.backing_facts.filter((entry) => (cell?.fact_ids || []).includes(entry.fact_id));
            // Ben, 2026-11-01, round 2: "I'd rather have 'consideration
            // type' and then, immediately under it, have the components
            // laid out ... maybe as a subrow or something"; "There are two
            // options." The type cell's options are sub-rows right under
            // it: on an election one per option, named ("Mixed election",
            // "Cash election"), each saying what a share receives; on a
            // plain package one per component, named by its form.
            const options = Array.isArray(cell?.options) ? cell.options : [];
            const optionRows = options.map((option, index) => (
              <tr key={`${column.column_id}-option-${index}`} className={`${ROW} ${rowSelected && selection?.columnId === column.column_id ? 'bg-accentDim' : ''}`} data-testid="attribute-option" data-option-kind={cell.options_kind}>
                <td className={`${TD} pl-[18.5px]`}>
                  <span className="font-ui text-[13px] font-medium text-[#33475E]">{cell.options_kind === 'election' && option.label ? `Option: ${option.label}` : (option.label || 'Every option')}</span>
                </td>
                <td className={TD}>
                  <button
                    type="button"
                    data-testid="attribute-option-text"
                    onClick={() => onSelect({ tableKey: table.table_key, rowIndex: 0, subIndex: null, columnId: column.column_id, componentId: (option.component_ids || [])[0] || null, componentIds: option.component_ids || [], factId: option.fact_id || (option.fact_ids || [])[0] || null })}
                    className={`text-left font-ui ${TEXT} underline-offset-2 hover:underline`}
                  >
                    {option.text}
                  </button>
                </td>
              </tr>
            ));
            return [
              <tr key={column.column_id} className={ROW} data-testid="attribute-row" data-column-id={column.column_id}>
                <td className={`${TD} ${SUBJECT}`}>
                  <AttributeTerm header={column.header} backing={backing} tableKey={table.table_key} onSelect={onSelect} />
                </td>
                <td className={TD}>
                  {cell ? (
                    <Cell cell={cell} tableKey={table.table_key} rowIndex={0} subject={row.subject || table.term_column?.header || table.group_header || table.table_key} selected={!!rowSelected && selection?.columnId === column.column_id} onSelect={onSelect} />
                  ) : <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>}
                </td>
              </tr>,
              ...optionRows,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttributeTerm({ header, backing, tableKey, onSelect }) {
  const first = backing[0] || null;
  return (
    <div>
      <span>{header}</span>
      {first ? (
        <button type="button" onClick={() => onSelect({ tableKey, rowIndex: 0, columnId: null, componentId: null, componentIds: [], factId: first.fact_id })} className={`ml-[4.5px] ${QUIET}`} data-testid="see-provision">See provision</button>
      ) : null}
    </div>
  );
}
// Ben, 2026-09-14, on the § 1.03 filing facts: "I'd try to render them as a
// hidden 'other provisions' section under the main structure and mechanics
// parts - needs to be high level - Company files CoM and other required
// docs which must be acceptable to Parent", and "consider if you can show
// them as one fact in the layer tree with 'Branches' for the different
// clauses/'or's etc on UI". A collapsed block under the grid, one line per
// group (table-view groupOtherProvisions): the words the group shares, then
// its branches indented, one per fact. Every line opens its own fact in the
// evidence sidebar the way a backing fact does.
// Work package 12 (plan finding (76)). Ben, 2026-10-17: "why do we have a
// summary column here?" The Summary column is rendered only when some
// line's summary says more than its term (not empty, not the term again);
// otherwise the term alone opens the fact.
function summarySaysMore(lines) {
  const normalise = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return lines.some(([term, text]) => normalise(text) && normalise(text) !== normalise(term));
}

function otherProvisionMarketLines({ fact, group, tableKey, market }) {
  if (!market || !fact) return [];
  const cells = Array.isArray(fact.conclusions?.cells)
    ? fact.conclusions.cells
    : Object.entries(fact.conclusions?.cells || {}).map(([columnId, cell]) => ({ ...cell, column_id: columnId }));
  const out = [];
  for (const cell of cells) {
    if (!cell?.column_id) continue;
    const value = cell.code || cell.label || cell.text;
    if (!value) continue;
    const key = `${tableKey}|${group.term || 'Other provisions'}|${cell.column_id}`;
    const distribution = market.cells?.[key];
    if (!distribution) continue;
    out.push({ key: `${cell.column_id}:${value}`, line: marketLine(distribution, value) });
  }
  return out;
}

function OtherProvisionMarket({ lines, factId, onSelect }) {
  if (!lines.length) return null;
  return lines.map(({ key, line }) => (
    <button
      key={key}
      type="button"
      data-testid="market-line"
      data-market={line.kind}
      onClick={() => onSelect({ factId })}
      className="mt-[1px] block text-left font-ui text-[11px] leading-snug text-[#6B7785] hover:underline hover:text-[#0B3D71]"
    >
      {line.text}
    </button>
  ));
}

function OtherProvisions({ groups, tableKey, onSelect, label = 'Other provisions', factsById = null }) {
  const forced = useContext(EverythingContext);
  const market = useContext(MarketContext);
  const [open, setOpen] = useState(false);
  const effectiveOpen = forced || open;
  const count = groups.reduce((total, group) => total + group.branches.length, 0);
  const withSummary = summarySaysMore(groups.flatMap((group) => [[group.term, group.common_text], ...group.branches.map((branch) => [branch.term, branch.text])]));
  const select = (factId, subject = null) => onSelect({ tableKey, rowIndex: 0, columnId: null, componentId: null, componentIds: [], factId, subject });
  // Ben, 2026-09-14, on the first rendering (a list of lines with § marks):
  // "It should look like the rest of the table structure etc and for now no
  // summary is fine but ultimately we want to get to summary". The same
  // card, header and Term / Provision columns as the grid above it; the
  // Term is a summary from the fact's component labels ("it needs to be a
  // summary of the provision on the right etc - like in the normal course.
  // Not just a sec ref...!"), the section reference quiet beside it; a
  // sentence cut into branches is one row with its branches indented under
  // it, each with its own term, the way a row's sub-items are.
  return (
    <div className="mt-[9.5px] rounded-[2px] border border-[#dcdcdc]" data-testid="other-provisions" data-open={effectiveOpen || undefined}>
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={effectiveOpen} className={`flex w-full items-center justify-between px-[7px] py-[4.5px] text-left text-[11px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b] ${effectiveOpen ? 'border-b border-[#ececec]' : ''}`} data-testid="other-provisions-toggle">
        <span>{label} ({count})</span>
        <span className="text-inkFaint">{effectiveOpen ? '▾' : '▸'}</span>
      </button>
      {(
        <table className="w-full border-collapse text-left" data-testid="other-provisions-table" data-summary-column={withSummary ? 'true' : 'false'} hidden={!effectiveOpen}>
          <colgroup>
            <col className="w-[34%] md:w-[26%]" />
            {withSummary ? <col /> : null}
          </colgroup>
          <thead>
            <tr>
              <th className={withSummary ? `w-[111.5px] ${TH}` : TH}>Term</th>
              {withSummary ? <th className={TH}>Summary</th> : null}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group, index) => {
              const key = `${group.subtype_key}-${group.span_id}-${index}`;
              const lead = group.branches[0];
              const line = (
                <tr key={key} className={ROW} data-testid="other-provision" data-branches={group.branches.length > 1 ? group.branches.length : undefined}>
                  <td className={`${TD} ${SUBJECT}`}>
                    {withSummary
                      ? <span data-testid="other-provision-term">{group.term || ''}</span>
                      : <button type="button" data-testid="other-provision-term" onClick={() => select(lead.fact_id, group.term)} className="text-left underline-offset-2 hover:underline">{group.term || ''}</button>}
                    {lead.section_reference ? <span className={`ml-[4.5px] ${QUIET}`} data-testid="other-provision-ref">§ {lead.section_reference}</span> : null}
                    {market ? <OtherProvisionMarket lines={otherProvisionMarketLines({ fact: factsById?.get(lead.fact_id), group, tableKey, market })} factId={lead.fact_id} onSelect={(entry) => select(entry.factId, group.term)} /> : null}
                  </td>
                  {withSummary ? <td className={TD}>
                    <button type="button" data-testid="other-provision-line" onClick={() => select(lead.fact_id, group.term)} className={`text-left font-body underline-offset-2 hover:underline ${TEXT}`}>{group.common_text}</button>
                  </td> : null}
                </tr>
              );
              if (group.branches.length === 1) return [line];
              return [line, ...group.branches.map((branch, branchIndex) => (
                <tr key={`${key}-${branchIndex}`} className={ROW} data-testid="other-provision-branch-row">
                  <td className={`${TD} pl-[18.5px] font-ui text-[13px] text-inkMid`} data-testid="other-provision-branch-term">{withSummary ? (branch.term || '') : <button type="button" onClick={() => select(branch.fact_id, group.term)} className="text-left underline-offset-2 hover:underline">{branch.term || ''}</button>}
                    {market ? <OtherProvisionMarket lines={otherProvisionMarketLines({ fact: factsById?.get(branch.fact_id), group, tableKey, market })} factId={branch.fact_id} onSelect={(entry) => select(entry.factId, group.term)} /> : null}
                  </td>
                  {withSummary ? <td className={`${TD} pl-[18.5px]`}>
                    <button type="button" data-testid="other-provision-branch" onClick={() => select(branch.fact_id, group.term)} className={`text-left font-body ${SUB_TEXT} underline-offset-2 hover:underline`}>{branch.text}</button>
                  </td> : null}
                </tr>
              ))];
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Facts of the section's families that carry no readout: evidence the tables
// cannot place, listed so nothing is hidden and each opens in the sidebar.
function FactsWithoutReadout({ entries, sectionKey, onSelect }) {
  const forced = useContext(EverythingContext);
  const [open, setOpen] = useState(false);
  const effectiveOpen = forced || open;
  return (
    <div className="mt-[9.5px] text-[11px] font-ui text-[#6b6b6b]" data-testid="facts-without-readout">
      <button type="button" onClick={() => setOpen((current) => !current)} className={LINK}>
        {entries.length} fact{entries.length === 1 ? '' : 's'} without a coded readout · {effectiveOpen ? 'hide' : 'see provisions'}
      </button>
      {effectiveOpen ? (
        <ul className="mt-[2.5px] space-y-[1px] pl-[4.5px]">
          {entries.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`}>
              <button type="button" data-testid="backing-fact" onClick={() => onSelect({ tableKey: `${sectionKey}:without-readout`, rowIndex: index, columnId: null, componentId: null, factId: entry.fact_id })} className="text-[#1f1f1f] underline-offset-2 hover:underline">
                {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}{entry.headline ? ` · ${entry.headline}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Work package 17 (manager, 2026-10-18): the facts validation held, under
// their section with the reason in plain words, in the same quiet style as
// the facts without a readout, so an empty table says why (NCS 3.4).
function HeldFacts({ entries, sectionKey, onSelect }) {
  const forced = useContext(EverythingContext);
  const [open, setOpen] = useState(false);
  const effectiveOpen = forced || open;
  return (
    <div className="mt-[6px] text-[11px] font-ui text-[#6b6b6b]" data-testid="held-facts">
      <button type="button" onClick={() => setOpen((current) => !current)} className={LINK}>
        {entries.length} fact{entries.length === 1 ? '' : 's'} held by validation · {effectiveOpen ? 'hide' : 'see why'}
      </button>
      {effectiveOpen ? (
        <ul className="mt-[2.5px] space-y-[1px] pl-[4.5px]">
          {entries.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`} data-testid="held-fact">
              <button type="button" onClick={() => onSelect({ tableKey: `${sectionKey}:held`, rowIndex: index, columnId: null, componentId: null, factId: entry.fact_id })} className="text-[#1f1f1f] underline-offset-2 hover:underline">
                {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}{entry.headline ? ` · ${entry.headline}` : ''}
              </button>
              <span data-testid="held-fact-reason">{` — ${entry.reason}`}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const DEFINED_TERMS_KEY = 'defined-terms';

// A section's header band (Ben, 2026-09-14: "their pages are 'cleaner' in
// style"): the Storylines card header, about 52px tall in a soft tint with
// an icon at the left, the title at 19px medium in the tint's darker
// colour and a chevron at the far right; still the button that collapses
// the section (the chevron turns when it is collapsed).
// Work package 26 (plan finding (232), 2026-10-22) put the article's
// REPRESENTATION_QUALIFICATION facts above each representation table. Ben,
// 2026-11-01: "Directly under reps and warranties, you have this text ...
// Get rid of that because that's what you have under the general
// exceptions, and you need it twice." The block is gone from the page; the
// General Exceptions table (lib/product/table-view.js splitLeadingTable)
// carries the same facts, and the view still exposes them as
// table.article_qualifications for other surfaces.

function SectionIcon({ tint }) {
  return tint === 'blue' ? (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5V5.5" /><path d="M8 7h8" /><path d="M8 11h6" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h6" />
    </svg>
  );
}

// Ben, 2026-11-01, round 3, on the phone: "there should be a little menu
// button at the bottom of the page that allows you to jump between different
// sections of the merger agreement ... something that's light and doesn't
// impact readability". Below lg (where the rail is hidden) a small fixed
// button at the bottom right opens a list of the sections; a pick scrolls
// to the section and closes the list.
function SectionJump({ sections }) {
  const [open, setOpen] = useState(false);
  if (!sections || sections.length === 0) return null;
  return (
    <div className="fixed bottom-[14px] right-[14px] z-30 lg:hidden" data-testid="section-jump">
      {open ? (
        <nav aria-label="Jump to a section" className="mb-[6px] max-h-[60vh] w-[240px] overflow-y-auto rounded-[2px] border border-[#B9C8DA] bg-white">
          {sections.map((section) => (
            <a key={section.section_key} href={`#provision-section-${section.section_key}`} onClick={(event) => { event.preventDefault(); setOpen(false); window.dispatchEvent(new CustomEvent('pm:open-section', { detail: { sectionKey: section.section_key } })); window.setTimeout(() => document.getElementById(`provision-section-${section.section_key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className="block border-b border-[#DCE3E1] px-[12px] py-[8px] font-ui text-[13px] text-[#03203D] last:border-0 hover:bg-[#F1F4F8]" data-testid="section-jump-item">{section.title}</a>
          ))}
        </nav>
      ) : null}
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="ml-auto flex items-center gap-[6px] rounded-full border border-[#B9C8DA] bg-[#03203D] px-[12px] py-[7px] font-ui text-[12px] font-semibold text-white" data-testid="section-jump-toggle">
        {open ? 'Close' : 'Sections'}
      </button>
    </div>
  );
}

function SectionHeading({ title, collapsed, onToggle, tint = 'green', specificsOn = null, onSpecifics = null, onReport = null }) {
  return (
    <div className="flex items-stretch">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed} className={`flex min-h-[38px] min-w-0 flex-1 items-center gap-[7px] px-[14px] py-[8px] text-left ${TINTS[tint].band}`} data-testid="section-heading">
        <SectionIcon tint={tint} />
        <h3 className="flex-1 font-sans text-[17px] font-semibold leading-snug tracking-[-.02em]">{title}</h3>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {onSpecifics ? (
        <button
          type="button"
          onClick={onSpecifics}
          aria-pressed={specificsOn === true}
          data-testid="section-specifics"
          className={`shrink-0 border-l border-[#DCE3E1] px-[11px] font-ui text-[10px] font-semibold uppercase tracking-[0.08em] ${specificsOn ? 'bg-[#03203D] text-white' : 'bg-white text-[#0B3D71] hover:bg-[#EAF0F6]'}`}
        >
          Specifics
        </button>
      ) : null}
      {onReport ? (
        <button type="button" onClick={onReport} data-testid="section-report" className="shrink-0 border-l border-[#DCE3E1] px-[10px] font-ui text-[10px] font-medium text-[#6B7785] hover:bg-[#EAF0F6] hover:text-[#0B3D71]">Report</button>
      ) : null}
    </div>
  );
}

// Defined terms as a table under a collapsible heading like every section,
// each term collapsed to start: the term on its line, the definition on a
// click (Ben, 2026-09-13).
function DefinedTermRow({ term }) {
  const [open, setOpen] = useState(false);
  return (
    <tr className={ROW} data-testid="defined-term-row" data-open={open || undefined}>
      <td className={TD}>
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className={`text-left underline-offset-2 hover:underline ${SUBJECT}`} data-testid="defined-term-toggle">{term.term}</button>
        {term.section_reference ? <span className={`ml-[4.5px] ${QUIET}`}>§ {term.section_reference}</span> : null}
      </td>
      <td className={`${TD} font-body ${TEXT}`}>
        {open ? (term.definition || <span className="text-inkFaint">Definition not in the closure</span>) : <button type="button" onClick={() => setOpen(true)} className={LINK}>Show</button>}
        {open && term.note ? <div className={`mt-[2px] ${QUIET}`} data-testid="defined-term-note">{term.note}</div> : null}
      </td>
    </tr>
  );
}

function DefinedTermsSection({ terms, collapsed, onToggle }) {
  return (
    <section className={`${CARD} scroll-mt-[70px]`} data-testid="defined-terms-appendix" data-collapsed={collapsed || undefined} id={`provision-section-${DEFINED_TERMS_KEY}`}>
      <SectionHeading title="Defined Terms" collapsed={collapsed} onToggle={onToggle} tint="blue" />
      {collapsed ? null : (
        <div className={`${CARD_BODY} overflow-x-auto`}>
          <table className="w-full border-collapse text-left" data-testid="defined-terms-table">
            <thead><tr>
              <th className={TH}>Term</th>
              <th className={TH}>Definition</th>
            </tr></thead>
            <tbody>{terms.map((term) => <DefinedTermRow key={term.component_id} term={term} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// One row and its sub-rows. The sub-rows are hidden to start and open on
// the DetailControl under the subject; the state is the row's own, so
// opening one row's detail leaves the others closed. `initialOpen` lets a
// caller (and the render tests) start every row open.
// Ben, 2026-11-01, on the equity awards table: "Company stock option: I'd
// show out-of-the-money as an exception, indented below in a new row, but
// it'll be a little bit smaller, indented underneath company stock option."
// A table whose sub-items are exceptions (sub_rows_label) starts with them
// open, indented and a size smaller; every other table's sub-items (the
// limbs of a representation) stay behind "More detail" (Ben, 2026-09-14).
function RowGroup({ table, row, rowIndex, selection, onSelect, initialOpen = false, columns = null, reviewMode = false, factsById = null, reviewItemsByFactId = null, sectionTextByFactId = null, onDecision = null, onComment = null, busy = false, initialReasonFactId = null }) {
  const forced = useContext(EverythingContext) || useContext(SectionOpenContext);
  const [open, setOpen] = useState(!!initialOpen || !!table.sub_rows_label);
  const reasonFactId = reviewMode ? (row.backing_facts?.[0]?.fact_id || null) : null;
  const [reasonOpen, setReasonOpen] = useState(Boolean(initialReasonFactId && reasonFactId === initialReasonFactId));
  const reasonFact = reasonFactId && factsById ? factsById.get(reasonFactId) || null : null;
  const effectiveOpen = forced || open;
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === rowIndex;
  const subRows = row.sub_rows || [];
  const shownColumns = columns || table.columns;
  const shownIds = new Set(shownColumns.map((column) => column.column_id));
  const detail = subRows.length ? { count: subRows.length, label: table.sub_rows_label || null, open: effectiveOpen, onToggle: () => setOpen((current) => !current) } : null;
  // A click selects one line: the sub-item clicked, or the row's
  // own line, never every line of the row (Ben, 2026-09-13:
  // "clicking one of the qualifications shouldn't cause the others
  // to turn orange").
  const line = (entry, key, sub, subIndex = null) => (
    <tr
      key={key}
      data-testid={sub ? 'table-sub-row' : 'table-row'}
      data-selected={rowSelected || undefined}
      className={`${ROW} ${rowSelected ? 'bg-accentDim' : ''} ${sub ? 'text-[13px]' : ''}`}
    >
      {table.term_column ? (
        <td className={`${TD} ${sub ? 'pl-[18.5px] text-inkMid' : ''}`}>
          <TermCell row={entry} tableKey={table.table_key} rowIndex={rowIndex} subIndex={subIndex} onSelect={onSelect} detail={sub ? null : detail} sub={sub} reviewMode={reviewMode && !sub} reasonOpen={!sub && reasonOpen} onReason={!sub ? () => setReasonOpen((current) => !current) : null} />
        </td>
      ) : null}
      {/* Ben, 2026-11-01, on the equity awards table: "Warrants: are there
          only warrants, or no warrants or whatever?" A row with nothing
          coded says what its fact says, across the columns. */}
      {!sub && entry.summary_fallback ? (
        <td className={`${TD} font-body ${TEXT}`} colSpan={shownColumns.length} data-testid="row-summary-fallback">{entry.summary_fallback}</td>
      ) : shownColumns.map((column) => entry.cells.find((candidate) => candidate.column_id === column.column_id) || { column_id: column.column_id, kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] }).map((cell, cellIndex) => (
        <td key={cell.column_id} className={`${TD} ${sub ? SUB_TEXT : ''}`}>
          <Cell
            cell={cell}
            tableKey={table.table_key}
            rowIndex={rowIndex}
            subIndex={subIndex}
            subject={entry.subject}
            selected={!!rowSelected && (selection?.subIndex ?? null) === subIndex && selection?.columnId === cell.column_id}
            onSelect={onSelect}
          />
          {!table.term_column && !sub && cellIndex === 0 && detail ? <DetailControl {...detail} /> : null}
        </td>
      ))}
    </tr>
  );
  const reasonRow = reasonFactId && reasonOpen ? (
    <tr data-testid="review-reason-row" className="border-b border-[#DCE3E1]">
      <td colSpan={(shownColumns.length || 0) + (table.term_column ? 1 : 0)} className="p-0">
        <ReviewReasonPanel
          fact={reasonFact}
          reviewItem={reviewItemsByFactId ? reviewItemsByFactId.get(reasonFactId) || null : null}
          sectionText={sectionTextByFactId ? sectionTextByFactId.get(reasonFactId) || null : null}
          onDecision={onDecision}
          onComment={onComment}
          busy={busy}
        />
      </td>
    </tr>
  ) : null;
  return (
    <>
      {line(row, `${row.subject}-${rowIndex}`, false)}
      {reasonRow}
      {effectiveOpen ? subRows.map((subRow, subIndex) => line(subRow, `${row.subject}-${rowIndex}-${subIndex}`, true, subIndex)) : null}
    </>
  );
}

// Ben, 2026-11-01, on the Skechers per-share table: "there's an election.
// It's this thing or it's this thing." Rows carrying an election_group are
// set out under one heading line per option, in the order the options first
// appear; rows of no option follow.
function groupedRows(rows) {
  const groups = [];
  const rest = [];
  rows.forEach((row, rowIndex) => {
    if (!row.election_group) { rest.push({ row, rowIndex }); return; }
    let group = groups.find((candidate) => candidate.label === row.election_group);
    if (!group) { group = { label: row.election_group, rows: [] }; groups.push(group); }
    group.rows.push({ row, rowIndex });
  });
  return { groups, rest };
}

function Table({ table, selection, onSelect, initialSubRowsOpen = false, reviewMode = false, factsById = null, reviewItemsByFactId = null, sectionTextByFactId = null, onDecision = null, onComment = null, busy = false, initialReasonFactId = null }) {
  // Ben, 2026-09-14: "make negative covenant list collapsable (if it is
  // within the covenant section)". A table marked collapsible_rows folds its
  // rows behind a toggle above the header row; open to start.
  // Ben, 2026-11-01, round 3: "I'd have the other protections sort of
  // hidden. You have to click to open them." (rows_start_collapsed).
  const forced = useContext(EverythingContext);
  const [rowsOpen, setRowsOpen] = useState(!table.rows_start_collapsed);
  const effectiveRowsOpen = forced || rowsOpen;
  const showSpecifics = useContext(SpecificsContext);
  if (table.layout === 'attribute grid') return <AttributeGrid table={table} selection={selection} onSelect={onSelect} />;
  // Ben, 2026-11-01: the as-drafted column stays behind "Show specifics".
  const columns = table.columns.filter((column) => !column.specifics || showSpecifics);
  const span = columns.length + (table.term_column ? 1 : 0);
  const { groups, rest } = groupedRows(table.rows);
  const renderRow = (row, rowIndex) => {
    if (row.absent) {
      return (
        <tr key={`${row.subject}-${rowIndex}`} className={ROW} data-testid="table-row" data-absent="true" {...(row.held ? { 'data-held': 'true' } : {})}>
          {table.term_column ? (
            <td className={TD}><span className={SUBJECT}>{row.subject}</span></td>
          ) : null}
          {/* Work package 16: a row whose only fact is held by validation carries its own words (absent_label) in place of the table's absent label. */}
          <td className={`${TD} font-ui text-[14px] text-[#6b6b6b]`} colSpan={columns.length} data-testid="table-absent">{row.absent_label || table.absent_row_label}</td>
        </tr>
      );
    }
    return <RowGroup key={`${row.subject}-${rowIndex}`} table={table} row={row} rowIndex={rowIndex} selection={selection} onSelect={onSelect} initialOpen={initialSubRowsOpen} columns={columns} reviewMode={reviewMode} factsById={factsById} reviewItemsByFactId={reviewItemsByFactId} sectionTextByFactId={sectionTextByFactId} onDecision={onDecision} onComment={onComment} busy={busy} initialReasonFactId={initialReasonFactId} />;
  };
  return (
    <div className="overflow-x-auto">
      {/* Ben, 2026-11-01, round 3, on an iPhone at half width: "some of the
          columns overlap with each other ... maybe just allow natural
          scrolling of the tables." Below md the table keeps a minimum width
          per column and scrolls inside its wrapper. */}
      <table className="w-full min-w-[var(--table-min)] table-fixed border-collapse text-left md:min-w-0" style={{ '--table-min': columns.length >= 2 ? `${Math.min(760, 220 + 170 * columns.length)}px` : '0px' }} data-testid="provision-table" data-table-key={table.table_key}>
        <GroupHeader table={table} />
        <colgroup>
          {table.term_column ? <col className="w-[34%] md:w-[26%]" /> : null}
          {columnWidths(columns, !!table.term_column).map((width, index) => <col key={columns[index].column_id} style={{ width: `${width}%` }} />)}
        </colgroup>
        {table.collapsible_rows ? (
          <thead>
            <tr>
              <td colSpan={span} className="pb-[4.5px]">
                <button type="button" onClick={() => setRowsOpen((current) => !current)} aria-expanded={effectiveRowsOpen} className={`flex w-full items-center justify-between text-left text-[11px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]`} data-testid="rows-toggle">
                  <span>{effectiveRowsOpen ? 'Hide' : 'Show'} {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</span>
                  <span className="text-inkFaint">{effectiveRowsOpen ? '▾' : '▸'}</span>
                </button>
              </td>
            </tr>
          </thead>
        ) : null}
        <thead hidden={table.collapsible_rows ? !effectiveRowsOpen : undefined}>
          <tr>
            {table.term_column ? (
              <th className={TH}>{table.term_column.header}</th>
            ) : null}
            {columns.map((column) => (
              <th key={column.column_id} className={TH}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody hidden={table.collapsible_rows ? !effectiveRowsOpen : undefined}>
          {groups.flatMap((group) => [
            <tr key={`group-${group.label}`} data-testid="election-group" className="border-b border-[#DCE3E1]">
              <td colSpan={span} className={`${TD} pb-[4px] pt-[12px] font-ui text-[14px] font-semibold text-[#03203D]`}>{group.label}</td>
            </tr>,
            ...group.rows.map(({ row, rowIndex }) => renderRow(row, rowIndex)),
          ])}
          {rest.map(({ row, rowIndex }) => renderRow(row, rowIndex))}
        </tbody>
        {table.combined_definition ? (
          <tfoot>
            <tr data-testid="combined-definition">
              <td colSpan={span} className={FOOT}>
                <div className={FOOT_LABEL}>{table.combined_definition.label}</div>
                <div className={`mt-[2.5px] font-body ${TEXT}`}>
                  <span className="font-medium">“{table.combined_definition.term}”</span>
                  {table.combined_definition.text ? <span className="text-inkMid"> · {table.combined_definition.text}</span> : null}
                  <button
                    type="button"
                    data-testid="backing-fact"
                    onClick={() => onSelect({ tableKey: table.table_key, rowIndex: null, columnId: null, componentId: (table.combined_definition.component_ids || [])[0] || null, factId: table.combined_definition.fact_id })}
                    className={`ml-[4.5px] ${QUIET}`}
                  >
                    {table.combined_definition.section_reference ? `§ ${table.combined_definition.section_reference}` : 'See provision'}
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        ) : null}
        {table.footer && table.footer.entries.length ? (
          <tfoot>
            <tr data-testid="table-footer">
              <td colSpan={span} className={FOOT}>
                <div className={FOOT_LABEL}>{table.footer.label}</div>
                {table.footer.entries.map((entry, index) => (
                  <div key={`${entry.fact_id}-${index}`} className={`mt-[2.5px] font-body ${TEXT}`}>
                    <span>{entry.text}</span>
                    <button
                      type="button"
                      data-testid="backing-fact"
                      onClick={() => onSelect({ tableKey: table.table_key, rowIndex: null, columnId: null, componentId: (entry.component_ids || [])[0] || null, factId: entry.fact_id })}
                      className={`ml-[4.5px] ${QUIET}`}
                    >
                      {entry.section_reference ? `§ ${entry.section_reference}` : 'See provision'}
                    </button>
                  </div>
                ))}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

// Ben, 2026-09-14: "for the definition, take out of table but when you
// click the MAE box and the side bar opens, there is a fixed visual element
// at the bottom of the side bar that has the MAE definition summary which
// you can click through to get the full definition". The element's
// contents for a selection whose cell links to a section: the section's
// title, the MAE definition prong facts of the party whose table the cell
// sits in (the Parent tables are keyed parent-*; the seller's conditions
// bear on Parent's representations), every prong when none names that
// party, any MAE_DEFINITION fact when there is no prong at all; one summary
// line per fact (factSummaryText), at most three, then "…".
const PARENT_PARTY_TABLE = /^parent-|^conditions-s-/;
const DEFINITION_LINES = 3;

function factParty(fact) {
  const rowLabel = fact?.conclusions?.row_label;
  if (typeof rowLabel === 'string' && rowLabel.trim()) return rowLabel.trim();
  for (const [component] of walk(fact?.components || [])) {
    if (component.kind === 'ACTOR') return component.label || component.text || '';
  }
  return '';
}

function linkedDefinitionFor(selection, tableView, facts) {
  const sectionKey = selection.linkSection;
  const section = (tableView?.sections || []).find((candidate) => candidate.section_key === sectionKey) || null;
  const party = PARENT_PARTY_TABLE.test(String(selection.tableKey || '')) ? 'Parent' : 'Company';
  const family = (facts || []).filter((fact) => fact && fact.family_key === 'MAE_DEFINITION' && fact.validation_status !== 'INVALID');
  const prongs = family.filter((fact) => fact.subtype_key === 'MAE_DEFINITION_PRONG');
  const ofParty = prongs.filter((fact) => factParty(fact).toLowerCase().includes(party.toLowerCase()));
  const chosen = ofParty.length ? ofParty : (prongs.length ? prongs : family);
  const lines = chosen.map((fact) => factSummaryText(fact)).filter((text) => typeof text === 'string' && text.trim());
  return {
    section_key: sectionKey,
    table_key: section?.tables?.[0]?.table_key || `${sectionKey}-table`,
    title: section?.title || 'Material Adverse Effect',
    party,
    exact: ofParty.length > 0,
    fact_id: chosen.length ? factIdOf(chosen[0]) : null,
    lines: lines.length > DEFINITION_LINES ? [...lines.slice(0, DEFINITION_LINES), '…'] : lines,
  };
}

function feedbackForSelection({ selection, tableView }) {
  if (!selection) return null;
  let section = null;
  let table = null;
  let row = null;
  for (const candidate of tableView?.sections || []) {
    const found = (candidate.tables || []).find((entry) => entry.table_key === selection.tableKey);
    if (!found) continue;
    section = candidate;
    table = found;
    row = (found.rows || [])[selection.rowIndex] || null;
    break;
  }
  if (!table) return null;
  return {
    section_key: section?.section_key || null,
    section_title: section?.title || null,
    table_key: table.table_key,
    row_subject: selection.subject || row?.subject || null,
    column_id: selection.columnId || null,
    cell_code: selection.cellCode || null,
    cell_label: selection.cellLabel || null,
    fact_ids: selection.factIds || (selection.factId ? [selection.factId] : []),
  };
}

function marketForSelection({ selection, tableView, market, runId }) {
  if (!selection || !market || !selection.columnId) return null;
  let subject = selection.subject || null;
  for (const section of subject ? [] : (tableView?.sections || [])) {
    const table = (section.tables || []).find((candidate) => candidate.table_key === selection.tableKey);
    if (!table) continue;
    const row = (table.rows || [])[selection.rowIndex];
    if (!row) break;
    subject = selection.subIndex == null ? row.subject : row.sub_rows?.[selection.subIndex]?.subject;
    break;
  }
  if (!subject) return null;
  const key = `${selection.tableKey}|${subject}|${selection.columnId}`;
  const distribution = market.cells?.[key];
  if (!distribution) return null;
  const selectedValue = selection.value;
  const entries = Object.entries(distribution.codes || {}).map(([code, entry]) => ({
    code,
    label: entry.label || code,
    count: Number(entry.count || 0),
    run_ids: entry.run_ids || [],
    self: code === selectedValue || entry.label === selectedValue,
  })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  return { label: subject, total: Number(distribution.total || 0), entries, runs: market.runs || {}, run_id: runId || null };
}

export default function ProvisionTables({
  tableView,
  facts = [],
  reviewItemsByFactId = null,
  provenanceByFactId = null,
  sectionTextByFactId = null,
  onDecision = null,
  onComment = null,
  onReset = null,
  busy = false,
  initialSubRowsOpen = false,
  // Ben, 2026-09-14: "have the top level interpretation tree items shown".
  initialTreeOpen = true,
  // A selection to open with (static renders and tests; the page starts
  // with none).
  initialSelection = null,
  // Work package 12: whether the code pills show (one page-wide setting);
  // the default is SHOW_CODES_BY_DEFAULT, Ben's to decide.
  initialShowCodes = SHOW_CODES_BY_DEFAULT,
  // Ben, 2026-11-01: the as-drafted columns behind "Show specifics"; off to start.
  initialShowSpecifics = false,
  // Package 2: the run whose market line is read; the optional payload for
  // static renders/tests; and the two test-only starting states.
  runId = null,
  initialMarket = null,
  initialCompare = false,
  initialEverything = false,
  // The review page renders the same tables with an inline See reason panel.
  mode = 'read',
  initialReasonFactId = null,
}) {
  const [showCodes, setShowCodes] = useState(initialShowCodes);
  const [specificsSections, setSpecificsSections] = useState(() => new Set(initialShowSpecifics ? (tableView?.sections || []).map((section) => section.section_key) : []));
  const toggleSpecifics = (sectionKey) => setSpecificsSections((current) => {
    const next = new Set(current);
    if (next.has(sectionKey)) next.delete(sectionKey); else next.add(sectionKey);
    return next;
  });
  const [everything, setEverything] = useState(!!initialEverything);
  const [compare, setCompare] = useState(!!initialCompare);
  const [market, setMarket] = useState(initialMarket || null);
  const [feedback, setFeedback] = useState(null);
  const factsById = useMemo(() => new Map((facts || []).map((fact) => [factIdOf(fact), fact])), [facts]);
  const [selection, setSelection] = useState(initialSelection);
  // Each section collapses on its heading; the bar above offers collapse /
  // expand all (Ben, 2026-09-13). Collapsed keys live here so a republish of
  // the table view keeps the reader's choice.
  // A coverage-only section (Miscellaneous / Boilerplate) starts collapsed
  // (Ben, 2026-09-12: one collapsed, expandable section after the operative
  // families).
  const [collapsed, setCollapsed] = useState(() => new Set((tableView?.sections || []).filter((section) => section.coverage_only).map((section) => section.section_key)));

  // Ben's "Compare" setting is remembered per browser; every access is
  // guarded, and the read happens after mount so the server HTML is stable.
  useEffect(() => {
    try { if (window.localStorage.getItem('pm-compare') === '1') setCompare(true); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('pm-compare', compare ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [compare]);
  // The market payload loads only when Compare is on, and only once per run.
  useEffect(() => {
    if (!compare || !runId || market) return undefined;
    let cancelled = false;
    fetch(`/api/product/compare/market?run=${encodeURIComponent(runId)}`, { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setMarket(body); })
      .catch(() => { if (!cancelled) setMarket(null); });
    return () => { cancelled = true; };
  }, [compare, runId, market]);
  useEffect(() => { setMarket(initialMarket || null); }, [runId, initialMarket]);
  // A rail or Sections-menu click expands the target section before the
  // browser scrolls to it; scroll-mt-[70px] keeps it below the 58px PwBar.
  useEffect(() => {
    const openSection = (event) => {
      const sectionKey = event?.detail?.sectionKey;
      if (!sectionKey) return;
      setCollapsed((current) => {
        if (!current.has(sectionKey)) return current;
        const next = new Set(current);
        next.delete(sectionKey);
        return next;
      });
    };
    window.addEventListener('pm:open-section', openSection);
    return () => window.removeEventListener('pm:open-section', openSection);
  }, []);

  if (!tableView || tableView.sections.length === 0) return null;

  const effectiveCodes = everything ? false : showCodes;
  const effectiveCollapsed = everything ? new Set() : collapsed;
  const selectedFact = selection ? factsById.get(selection.factId) || null : null;
  const allCollapsed = tableView.sections.every((section) => effectiveCollapsed.has(section.section_key));
  const toggleSection = (key) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const setAll = (collapse) => setCollapsed(collapse ? new Set([...tableView.sections.map((section) => section.section_key), DEFINED_TERMS_KEY]) : new Set());
  const linkedDefinition = selection?.linkSection ? linkedDefinitionFor(selection, tableView, facts) : null;
  // "Full definition": jump to the definitions section (its heading carries
  // id provision-section-<key> above, open or collapsed) and open the
  // definition fact in the sidebar the way a backing fact opens.
  const openDefinition = (definition) => {
    if (!definition) return;
    setCollapsed((current) => { if (!current.has(definition.section_key)) return current; const next = new Set(current); next.delete(definition.section_key); return next; });
    if (definition.fact_id) setSelection({ tableKey: definition.table_key, rowIndex: null, subIndex: null, columnId: null, componentId: null, componentIds: [], factId: definition.fact_id, linkSection: null });
  };

  // Ben, 2026-09-14: "their pages are 'cleaner' in style". The Storylines
  // filter-tab row under the header rule carries the section toggles as
  // plain text tabs: 17px, the one that names the page's current state
  // (Expand all once everything is open, Collapse all once everything is
  // closed) on a light grey block with a 1px border, the other plain; the
  // right side, the reference's search box, stays empty. The sections
  // follow as cards 28px apart.
  // Ben, 2026-11-01: the toolbar controls are pills in the page language:
  // mist border, blue text, white fill, navy when pressed.
  const TAB = 'rounded-full border px-[12px] py-[7px] text-[12px] font-ui font-semibold leading-none transition-colors';
  const tabClass = (current) => `${TAB} ${current ? 'border-[#03203D] bg-[#03203D] text-white' : 'border-[#B9C8DA] bg-white text-[#0B3D71] hover:border-[#03203D]'}`;
  return (
    <EverythingContext.Provider value={everything}>
    <MarketContext.Provider value={compare ? market : null}>
    <CodesContext.Provider value={effectiveCodes}>
    <SpecificsContext.Provider value={false}>
    <div className="flex flex-wrap gap-[18.5px] lg:flex-nowrap" data-testid="provision-tables" data-show-codes={effectiveCodes ? 'true' : 'false'} data-show-specifics={everything || specificsSections.size ? 'true' : 'false'} data-everything={everything ? 'true' : undefined} data-compare={compare ? 'true' : 'false'}>
      {/* The sidebar is fixed to the viewport's right edge (Deal Storylines;
          Ben, 2026-09-14) and the page keeps its width when it opens. The
          tables used to take 406px of right padding while a fact was
          selected, so every table reflowed on a click. Ben, 2026-10-17:
          "when I clicked 'see provision' on 'definition' in 'intervening
          event mechanics' the main body of the page leapt around, it should
          stay static and the left hand side should just come up" (plan
          finding (42)): the panel comes up over the page, as the Storylines
          panel does ("the page scrolls under it", finding (37)). */}
      <div className="min-w-0 flex-1 space-y-[16px]" data-sidebar-open={selectedFact ? 'true' : undefined}>
        <div className={`flex flex-wrap items-center gap-[4.5px] ${selectedFact ? 'lg:pr-[406px]' : ''}`} data-testid="section-toggles">
          <button type="button" onClick={() => setAll(false)} disabled={effectiveCollapsed.size === 0} className={tabClass(effectiveCollapsed.size === 0)}>Expand all</button>
          <button type="button" onClick={() => setAll(true)} disabled={allCollapsed} className={tabClass(allCollapsed)}>Collapse all</button>
          <button type="button" onClick={() => setEverything((current) => !current)} aria-pressed={everything} className={tabClass(everything)} data-testid="everything-toggle">Everything</button>
          <button type="button" onClick={() => setCompare((current) => !current)} aria-pressed={compare} className={tabClass(compare)} data-testid="compare-toggle">{compare ? 'Hide compare' : 'Compare'}</button>
          <button type="button" onClick={() => setShowCodes((current) => !current)} aria-pressed={effectiveCodes} disabled={everything} className={`${tabClass(effectiveCodes)} disabled:opacity-40`} data-testid="codes-toggle">{effectiveCodes ? 'Hide codes' : 'Show codes'}</button>
        </div>
        <SectionJump sections={tableView.sections} />
        {tableView.sections.map((section) => {
          const isCollapsed = effectiveCollapsed.has(section.section_key);
          const sectionSpecifics = everything || specificsSections.has(section.section_key);
          return (
            <section key={section.section_key} className={`${CARD} scroll-mt-[70px]`} data-testid="provision-section" data-collapsed={isCollapsed || undefined} id={`provision-section-${section.section_key}`}>
              <SectionHeading
                title={section.title}
                collapsed={isCollapsed}
                onToggle={() => toggleSection(section.section_key)}
                specificsOn={sectionSpecifics}
                onSpecifics={() => { if (isCollapsed) toggleSection(section.section_key); toggleSpecifics(section.section_key); }}
                onReport={() => setFeedback({ section_key: section.section_key, section_title: section.title })}
              />
              {isCollapsed ? null : (
                <SpecificsContext.Provider value={sectionSpecifics}>
                <SectionOpenContext.Provider value={sectionSpecifics}>
                <div className={CARD_BODY}>
                  <div className="space-y-[18.5px]">
                    {/* Ben, 2026-11-01, round 2: a table embedded under the
                        consideration type (the per-share and election
                        options tables) is shown only with the specifics. */}
                    {section.tables.filter((table) => !table.embedded_in || sectionSpecifics).map((table) => (
                      <div key={table.table_key} data-embedded={table.embedded_in || undefined}>
                        {table.other_provisions_only ? null : <Table table={table} selection={selection} onSelect={setSelection} initialSubRowsOpen={initialSubRowsOpen} reviewMode={mode === 'review'} factsById={factsById} reviewItemsByFactId={reviewItemsByFactId} sectionTextByFactId={sectionTextByFactId} onDecision={onDecision} onComment={onComment} busy={busy} initialReasonFactId={initialReasonFactId} />}
                        {table.other_provisions?.length ? (
                          <OtherProvisions groups={table.other_provisions} tableKey={table.table_key} onSelect={setSelection} label={table.other_provisions_label || 'Other provisions'} factsById={factsById} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {section.facts_without_readout?.length ? (
                    <FactsWithoutReadout entries={section.facts_without_readout} sectionKey={section.section_key} onSelect={setSelection} />
                  ) : null}
                  {section.held_facts?.length ? (
                    <HeldFacts entries={section.held_facts} sectionKey={section.section_key} onSelect={setSelection} />
                  ) : null}
                </div>
                </SectionOpenContext.Provider>
                </SpecificsContext.Provider>
              )}
            </section>
          );
        })}
        {tableView.defined_terms.length ? (
          <DefinedTermsSection terms={tableView.defined_terms} collapsed={effectiveCollapsed.has(DEFINED_TERMS_KEY)} onToggle={() => toggleSection(DEFINED_TERMS_KEY)} />
        ) : null}
      </div>
      {selectedFact ? (
        <EvidenceSidebar
          fact={selectedFact}
          componentId={selection.componentId}
          componentIds={selection.componentIds || null}
          reviewItem={reviewItemsByFactId ? reviewItemsByFactId.get(selection.factId) || null : null}
          provenance={provenanceByFactId ? provenanceByFactId.get(selection.factId) || null : null}
          sectionText={sectionTextByFactId ? sectionTextByFactId.get(selection.factId) || null : null}
          onDecision={onDecision}
          onComment={onComment}
          onReset={onReset}
          onClose={() => setSelection(null)}
          busy={busy}
          linkedDefinition={linkedDefinition}
          onOpenDefinition={openDefinition}
          initialTreeOpen={initialTreeOpen}
          market={marketForSelection({ selection, tableView, market: compare ? market : null, runId })}
          onFeedback={() => setFeedback(feedbackForSelection({ selection, tableView }))}
        />
      ) : null}
    </div>
    </SpecificsContext.Provider>
    </CodesContext.Provider>
    <FeedbackDialog open={Boolean(feedback)} context={feedback} runId={runId} onClose={() => setFeedback(null)} />
    </MarketContext.Provider>
    </EverythingContext.Provider>
  );
}
