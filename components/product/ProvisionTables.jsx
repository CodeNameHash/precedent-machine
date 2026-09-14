import { useMemo, useState } from 'react';
import EvidenceSidebar from './EvidenceSidebar';
import { factIdOf, factSummaryText } from '../../lib/product/table-view';
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

const CARD = 'bg-white border border-[#dcdcdc] rounded-[2px] overflow-hidden';
const CARD_BODY = 'p-[14px]';
// The header band's tints: green for provision sections, blue for the
// definitions section.
const TINTS = {
  green: { band: 'bg-[#e8f3ee] border-b border-[#cfe3d8] text-[#2f7a5b]', box: 'bg-[#e8f3ee] text-[#2f7a5b]' },
  blue: { band: 'bg-[#e9effa] border-b border-[#d0dbf3] text-[#2f56b8]', box: 'bg-[#e9effa] text-[#2f56b8]' },
};
const TH = 'border-b border-[#ececec] px-[7px] py-[4.5px] text-left text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]';
const TD = 'px-[7px] py-[7px] align-top';
const ROW = 'border-b border-[#ececec] last:border-0';
const TEXT = 'text-[12.5px] leading-relaxed text-[#1f1f1f]';
const SUBJECT = 'font-ui text-[12.5px] font-medium text-[#1f1f1f]';
const LINK = 'text-[9.5px] font-ui text-[#1f1f1f] underline-offset-2 hover:underline';
const FOOT = 'border-t border-[#ececec] bg-[#fafafa] px-[7px] py-[7px] align-top';
const FOOT_LABEL = 'text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]';
// Ben, 2026-09-14: "UI point, 'see provision' has too much visual hierarchy
// and color which distracts readability." Every "See provision" control and
// the § reference links used the same way (backing-fact lists, Other
// provisions, footers, the combined definition) are quiet: small, faint,
// no capitals, no weight, an underline only under the pointer, placed after
// the subject so they never compete with it.
const QUIET = 'text-[8.5px] font-ui font-normal normal-case tracking-normal text-inkFaint hover:underline hover:text-inkLight';
// Ben, 2026-09-14: "make the elements below the top level reps (e.g.
// Organization) collapsable and hide them initially but have a clear 'more
// detail' button or similar". The control under a row's subject.
const DETAIL = 'mt-[2.5px] block text-[9.5px] font-ui font-medium text-accent hover:underline';
// A pill: a small rounded-[2px] tinted chip, 12px uppercase text, no border.
const BADGE = 'inline-flex items-center rounded-full px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide';

// Tones as soft tints with the tint's darker colour for the text (the
// Storylines green and blue, grey for the neutral readings).
const TONE_CLASSES = {
  neutral: 'bg-[#f3f3f3] text-[#555555]',
  standard: 'bg-[#e9effa] text-[#2f56b8]',
  value: 'bg-[#f3f3f3] text-[#333333]',
  term: 'bg-[#f3f3f3] text-[#555555]',
  condition: 'bg-[#e8f3ee] text-[#2f7a5b]',
  present: 'bg-[#e8f3ee] text-[#2f7a5b]',
  missing: 'bg-[#f3f3f3] text-inkFaint border border-dashed border-inkFaint/40',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-[#e9effa] text-[#2f56b8]',
  buyer: 'bg-buyer/10 text-buyer',
  seller: 'bg-seller/10 text-seller',
};

function toneClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

function Cell({ cell, tableKey, rowIndex, subIndex = null, selected, onSelect }) {
  if (cell.kind === 'dash') {
    return <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>;
  }
  if (Array.isArray(cell.values) && cell.values.length > 1) {
    return (
      <span className="inline-flex flex-wrap gap-[2.5px]" data-testid="table-multi">
        {cell.values.map((value, index) => (
          <Cell key={`${value.label}-${index}`} cell={{ ...value, column_id: cell.column_id }} tableKey={tableKey} rowIndex={rowIndex} subIndex={subIndex} selected={selected} onSelect={onSelect} />
        ))}
      </span>
    );
  }
  const isPill = cell.kind === 'pill';
  const testId = isPill ? 'table-pill' : (cell.kind === 'value' ? 'table-value' : 'table-text');
  const canSelect = (cell.component_ids || []).length > 0 || (cell.fact_ids || []).length > 0;
  const baseClass = isPill
    ? `${BADGE} ${toneClass(cell.tone)}`
    : (cell.kind === 'value' ? `text-left font-ui ${TEXT}` : `text-left font-body ${TEXT}`);
  // The selected pill is outlined in the accent, as the selected card in
  // Deal Storylines is (Ben, 2026-09-14: "I prefer this side bar behavior").
  const selectedClass = selected ? 'ring-2 ring-accent' : '';
  // Ben, 2026-09-14, on the MAE (aggregate) cell: "for the definition, take
  // out of table but when you click the MAE box and the side bar opens,
  // there is a fixed visual element at the bottom of the side bar that has
  // the MAE definition summary which you can click through to get the full
  // definition". No inline "definition" link: the cell carries its
  // link_section on the selection and the sidebar pins the summary.
  if (!canSelect) return <span className={baseClass}>{cell.label}</span>;
  const title = cell.defaulted ? 'Not stated for this row; shown as the column\'s default' : undefined;
  return (
    <button
      type="button"
      data-testid={testId}
      data-selected={selected || undefined}
      onClick={() => onSelect({
        tableKey,
        rowIndex,
        subIndex,
        columnId: cell.column_id,
        componentId: (cell.component_ids || [])[0] || null,
        componentIds: cell.component_ids || [],
        factId: (cell.fact_ids || [])[0] || null,
        linkSection: cell.link_section || null,
      })}
      className={`${baseClass} ${selectedClass}`}
      title={title}
      data-defaulted={cell.defaulted || undefined}
    >
      {cell.label}
    </button>
  );
}

// The row name itself opens the sidebar on the row's first fact, so the
// clause and its sourcing are reachable without a pill (Ben, 2026-09-13:
// "you should be able to see the side bar and sourcing not just by
// clicking the pills").
function TermCell({ row, tableKey, rowIndex, subIndex = null, onSelect, detail = null }) {
  const first = row.backing_facts[0] || null;
  // Ben, 2026-09-14: "I don't like the 'see provision' behaviour - it
  // shouldn't show the provision x-refs but instead should open the side
  // bar". The control opens the row's first fact in the sidebar, the way
  // the subject does; no list of section references.
  const openFirst = () => onSelect({ tableKey, rowIndex, subIndex, columnId: null, componentId: null, componentIds: [], factId: first.fact_id });
  return (
    <div className="font-ui text-[12.5px]">
      {first ? (
        <button type="button" data-testid="term-open" onClick={openFirst} className={`text-left underline-offset-2 hover:underline ${SUBJECT}`}>{row.subject}</button>
      ) : <span className={SUBJECT}>{row.subject}</span>}
      {first ? (
        <button type="button" onClick={openFirst} className={`ml-[4.5px] ${QUIET}`} data-testid="see-provision">See provision</button>
      ) : null}
      {row.subject_note ? <div className="mt-[1px] font-body text-[9.5px] text-[#6b6b6b]" data-testid="subject-note">{row.subject_note}</div> : null}
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

function GroupHeader({ table }) {
  if (!table.group_header) return null;
  return (
    <caption className="pb-[4.5px] text-left text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]" data-testid="table-group-header">{table.group_header}</caption>
  );
}

function AttributeGrid({ table, selection, onSelect }) {
  const row = table.rows[0];
  if (!row) return null;
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === 0;
  const lines = attributeLines(table, row);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" data-testid="provision-table" data-table-key={table.table_key} data-layout="attribute-grid">
        <GroupHeader table={table} />
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
            return (
              <tr key={column.column_id} className={ROW} data-testid="attribute-row" data-column-id={column.column_id}>
                <td className={`${TD} ${SUBJECT}`}>
                  <AttributeTerm header={column.header} backing={backing} tableKey={table.table_key} onSelect={onSelect} />
                </td>
                <td className={TD}>
                  {cell ? (
                    <Cell cell={cell} tableKey={table.table_key} rowIndex={0} selected={!!rowSelected && selection?.columnId === column.column_id} onSelect={onSelect} />
                  ) : <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>}
                </td>
              </tr>
            );
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
function OtherProvisions({ groups, tableKey, onSelect, label = 'Other provisions' }) {
  const [open, setOpen] = useState(false);
  const count = groups.reduce((total, group) => total + group.branches.length, 0);
  const select = (factId) => onSelect({ tableKey, rowIndex: 0, columnId: null, componentId: null, componentIds: [], factId });
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
    <div className="mt-[9.5px] rounded-[2px] border border-[#dcdcdc]" data-testid="other-provisions" data-open={open || undefined}>
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className={`flex w-full items-center justify-between px-[7px] py-[4.5px] text-left text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b] ${open ? 'border-b border-[#ececec]' : ''}`} data-testid="other-provisions-toggle">
        <span>{label} ({count})</span>
        <span className="text-inkFaint">{open ? '▾' : '▸'}</span>
      </button>
      {(
        <table className="w-full border-collapse text-left" data-testid="other-provisions-table" hidden={!open}>
          <thead>
            <tr>
              <th className={`w-[111.5px] ${TH}`}>Term</th>
              <th className={TH}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((group, index) => {
              const key = `${group.subtype_key}-${group.span_id}-${index}`;
              const lead = group.branches[0];
              const line = (
                <tr key={key} className={ROW} data-testid="other-provision" data-branches={group.branches.length > 1 ? group.branches.length : undefined}>
                  <td className={`${TD} ${SUBJECT}`}>
                    <span data-testid="other-provision-term">{group.term || ''}</span>
                    {lead.section_reference ? <span className={`ml-[4.5px] ${QUIET}`} data-testid="other-provision-ref">§ {lead.section_reference}</span> : null}
                  </td>
                  <td className={TD}>
                    <button type="button" data-testid="other-provision-line" onClick={() => select(lead.fact_id)} className={`text-left font-body underline-offset-2 hover:underline ${TEXT}`}>{group.common_text}</button>
                  </td>
                </tr>
              );
              if (group.branches.length === 1) return [line];
              return [line, ...group.branches.map((branch, branchIndex) => (
                <tr key={`${key}-${branchIndex}`} className={ROW} data-testid="other-provision-branch-row">
                  <td className={`${TD} pl-[18.5px] font-ui text-[12.5px] text-inkMid`} data-testid="other-provision-branch-term">{branch.term || ''}</td>
                  <td className={`${TD} pl-[18.5px]`}>
                    <button type="button" data-testid="other-provision-branch" onClick={() => select(branch.fact_id)} className="text-left font-body text-[12.5px] leading-relaxed text-inkMid underline-offset-2 hover:underline">{branch.text}</button>
                  </td>
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
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-[9.5px] text-[9.5px] font-ui text-[#6b6b6b]" data-testid="facts-without-readout">
      <button type="button" onClick={() => setOpen((current) => !current)} className={LINK}>
        {entries.length} fact{entries.length === 1 ? '' : 's'} without a coded readout · {open ? 'hide' : 'see provisions'}
      </button>
      {open ? (
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

const DEFINED_TERMS_KEY = 'defined-terms';

// A section's header band (Ben, 2026-09-14: "their pages are 'cleaner' in
// style"): the Storylines card header, about 52px tall in a soft tint with
// an icon at the left, the title at 19px medium in the tint's darker
// colour and a chevron at the far right; still the button that collapses
// the section (the chevron turns when it is collapsed).
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

function SectionHeading({ title, collapsed, onToggle, tint = 'green' }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={!collapsed} className={`flex min-h-[30px] w-full items-center gap-[7px] px-[14px] text-left ${TINTS[tint].band}`} data-testid="section-heading">
      <SectionIcon tint={tint} />
      <h3 className="flex-1 font-sans text-[14px] font-medium leading-snug">{title}</h3>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
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
      <td className={`${TD} font-body text-[12.5px] leading-relaxed text-inkMid`}>
        {open ? (term.definition || <span className="text-inkFaint">Definition not in the closure</span>) : <button type="button" onClick={() => setOpen(true)} className={LINK}>Show</button>}
      </td>
    </tr>
  );
}

function DefinedTermsSection({ terms, collapsed, onToggle }) {
  return (
    <section className={CARD} data-testid="defined-terms-appendix" data-collapsed={collapsed || undefined} id={`provision-section-${DEFINED_TERMS_KEY}`}>
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
function RowGroup({ table, row, rowIndex, selection, onSelect, initialOpen = false }) {
  const [open, setOpen] = useState(!!initialOpen);
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === rowIndex;
  const subRows = row.sub_rows || [];
  const detail = subRows.length ? { count: subRows.length, label: table.sub_rows_label || null, open, onToggle: () => setOpen((current) => !current) } : null;
  // A click selects one line: the sub-item clicked, or the row's
  // own line, never every line of the row (Ben, 2026-09-13:
  // "clicking one of the qualifications shouldn't cause the others
  // to turn orange").
  const line = (entry, key, sub, subIndex = null) => (
    <tr
      key={key}
      data-testid={sub ? 'table-sub-row' : 'table-row'}
      data-selected={rowSelected || undefined}
      className={`${ROW} ${rowSelected ? 'bg-accentDim' : ''}`}
    >
      {table.term_column ? (
        <td className={`${TD} ${sub ? 'pl-[18.5px] text-inkMid' : ''}`}>
          <TermCell row={entry} tableKey={table.table_key} rowIndex={rowIndex} subIndex={subIndex} onSelect={onSelect} detail={sub ? null : detail} />
        </td>
      ) : null}
      {entry.cells.map((cell, cellIndex) => (
        <td key={cell.column_id} className={TD}>
          <Cell
            cell={cell}
            tableKey={table.table_key}
            rowIndex={rowIndex}
            subIndex={subIndex}
            selected={!!rowSelected && (selection?.subIndex ?? null) === subIndex && selection?.columnId === cell.column_id}
            onSelect={onSelect}
          />
          {!table.term_column && !sub && cellIndex === 0 && detail ? <DetailControl {...detail} /> : null}
        </td>
      ))}
    </tr>
  );
  return (
    <>
      {line(row, `${row.subject}-${rowIndex}`, false)}
      {open ? subRows.map((subRow, subIndex) => line(subRow, `${row.subject}-${rowIndex}-${subIndex}`, true, subIndex)) : null}
    </>
  );
}

function Table({ table, selection, onSelect, initialSubRowsOpen = false }) {
  // Ben, 2026-09-14: "make negative covenant list collapsable (if it is
  // within the covenant section)". A table marked collapsible_rows folds its
  // rows behind a toggle above the header row; open to start.
  const [rowsOpen, setRowsOpen] = useState(true);
  if (table.layout === 'attribute grid') return <AttributeGrid table={table} selection={selection} onSelect={onSelect} />;
  const span = table.columns.length + (table.term_column ? 1 : 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" data-testid="provision-table" data-table-key={table.table_key}>
        <GroupHeader table={table} />
        {table.collapsible_rows ? (
          <thead>
            <tr>
              <td colSpan={span} className="pb-[4.5px]">
                <button type="button" onClick={() => setRowsOpen((current) => !current)} aria-expanded={rowsOpen} className={`flex w-full items-center justify-between text-left text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]`} data-testid="rows-toggle">
                  <span>{rowsOpen ? 'Hide' : 'Show'} {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'}</span>
                  <span className="text-inkFaint">{rowsOpen ? '▾' : '▸'}</span>
                </button>
              </td>
            </tr>
          </thead>
        ) : null}
        <thead hidden={table.collapsible_rows ? !rowsOpen : undefined}>
          <tr>
            {table.term_column ? (
              <th className={TH}>{table.term_column.header}</th>
            ) : null}
            {table.columns.map((column) => (
              <th key={column.column_id} className={TH}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody hidden={table.collapsible_rows ? !rowsOpen : undefined}>
          {table.rows.map((row, rowIndex) => {
            if (row.absent) {
              return (
                <tr key={`${row.subject}-${rowIndex}`} className={ROW} data-testid="table-row" data-absent="true">
                  {table.term_column ? (
                    <td className={TD}><span className={SUBJECT}>{row.subject}</span></td>
                  ) : null}
                  <td className={`${TD} font-ui text-[12.5px] text-[#6b6b6b]`} colSpan={table.columns.length} data-testid="table-absent">{table.absent_row_label}</td>
                </tr>
              );
            }
            return <RowGroup key={`${row.subject}-${rowIndex}`} table={table} row={row} rowIndex={rowIndex} selection={selection} onSelect={onSelect} initialOpen={initialSubRowsOpen} />;
          })}
        </tbody>
        {table.combined_definition ? (
          <tfoot>
            <tr data-testid="combined-definition">
              <td colSpan={table.columns.length + (table.term_column ? 1 : 0)} className={FOOT}>
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
              <td colSpan={table.columns.length + (table.term_column ? 1 : 0)} className={FOOT}>
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
}) {
  const factsById = useMemo(() => new Map((facts || []).map((fact) => [factIdOf(fact), fact])), [facts]);
  const [selection, setSelection] = useState(null);
  // Each section collapses on its heading; the bar above offers collapse /
  // expand all (Ben, 2026-09-13). Collapsed keys live here so a republish of
  // the table view keeps the reader's choice.
  // A coverage-only section (Miscellaneous / Boilerplate) starts collapsed
  // (Ben, 2026-09-12: one collapsed, expandable section after the operative
  // families).
  const [collapsed, setCollapsed] = useState(() => new Set((tableView?.sections || []).filter((section) => section.coverage_only).map((section) => section.section_key)));

  if (!tableView || tableView.sections.length === 0) return null;

  const selectedFact = selection ? factsById.get(selection.factId) || null : null;
  const allCollapsed = tableView.sections.every((section) => collapsed.has(section.section_key));
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
  const TAB = 'rounded-[2px] border px-[12px] py-[7px] text-[13px] font-ui leading-none transition-colors';
  const tabClass = (current) => `${TAB} ${current ? 'border-[#dcdcdc] bg-[#f3f3f3] text-[#1f1f1f]' : 'border-transparent text-[#6b6b6b] hover:text-[#1f1f1f]'}`;
  return (
    <div className="flex flex-wrap gap-[18.5px] lg:flex-nowrap" data-testid="provision-tables">
      {/* The sidebar is fixed to the viewport's right edge (Deal Storylines;
          Ben, 2026-09-14), so the tables keep its width clear while it is
          open. */}
      <div className={`min-w-0 flex-1 space-y-[16px] ${selectedFact ? 'lg:pr-[406px]' : ''}`} data-sidebar-open={selectedFact ? 'true' : undefined}>
        <div className="flex items-center gap-[4.5px]" data-testid="section-toggles">
          <button type="button" onClick={() => setAll(false)} disabled={collapsed.size === 0} className={tabClass(collapsed.size === 0)}>Expand all</button>
          <button type="button" onClick={() => setAll(true)} disabled={allCollapsed} className={tabClass(allCollapsed)}>Collapse all</button>
        </div>
        {tableView.sections.map((section) => {
          const isCollapsed = collapsed.has(section.section_key);
          return (
            <section key={section.section_key} className={CARD} data-testid="provision-section" data-collapsed={isCollapsed || undefined} id={`provision-section-${section.section_key}`}>
              <SectionHeading title={section.title} collapsed={isCollapsed} onToggle={() => toggleSection(section.section_key)} />
              {isCollapsed ? null : (
                <div className={CARD_BODY}>
                  <div className="space-y-[18.5px]">
                    {section.tables.map((table) => (
                      <div key={table.table_key}>
                        <Table table={table} selection={selection} onSelect={setSelection} initialSubRowsOpen={initialSubRowsOpen} />
                        {table.other_provisions?.length ? (
                          <OtherProvisions groups={table.other_provisions} tableKey={table.table_key} onSelect={setSelection} label={table.other_provisions_label || 'Other provisions'} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {section.facts_without_readout?.length ? (
                    <FactsWithoutReadout entries={section.facts_without_readout} sectionKey={section.section_key} onSelect={setSelection} />
                  ) : null}
                </div>
              )}
            </section>
          );
        })}
        {tableView.defined_terms.length ? (
          <DefinedTermsSection terms={tableView.defined_terms} collapsed={collapsed.has(DEFINED_TERMS_KEY)} onToggle={() => toggleSection(DEFINED_TERMS_KEY)} />
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
        />
      ) : null}
    </div>
  );
}
