import { useMemo, useState } from 'react';
import EvidenceSidebar from './EvidenceSidebar';
import { factIdOf, factSummaryText } from '../../lib/product/table-view';
import { walk } from '../../lib/product/fact-components';

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
// page header." The legacy deal summary (pages/deals/[id].js,
// pages/provisions/[id].js, components/UI.js) is the reference: white
// cards with a hairline border and soft shadow, `font-display` headings,
// `font-ui` metadata and labels in ink-light, small uppercase tracked badges
// with a rounded border, body text in `font-body`.

const CARD = 'bg-white border border-border rounded-lg shadow-sm overflow-hidden';
const TH = 'border-b border-border bg-bg/50 px-4 py-3 text-left text-xs font-ui font-medium text-inkLight';
const TD = 'px-4 py-3 align-top';
const LINK = 'text-xs font-ui text-accent hover:underline';
// Ben, 2026-09-14: "UI point, 'see provision' has too much visual hierarchy
// and color which distracts readability." Every "See provision" control and
// the § reference links used the same way (backing-fact lists, Other
// provisions, footers, the combined definition) are quiet: small, faint,
// no capitals, no weight, an underline only under the pointer, placed after
// the subject so they never compete with it.
const QUIET = 'text-[11px] font-ui font-normal normal-case tracking-normal text-inkFaint hover:underline hover:text-inkLight';
// Ben, 2026-09-14: "make the elements below the top level reps (e.g.
// Organization) collapsable and hide them initially but have a clear 'more
// detail' button or similar". The control under a row's subject.
const DETAIL = 'mt-1 block text-xs font-ui font-medium text-accent hover:underline';
const BADGE = 'inline-flex items-center text-[10px] font-ui font-medium px-2 py-1 rounded border uppercase tracking-wider';

// Tones in the legacy badge palette (the deal header's topology badge, the
// provision card's favourability pill, the AI badge).
const TONE_CLASSES = {
  neutral: 'bg-gray-100 text-inkLight border-border',
  standard: 'bg-sky-50 text-sky-700 border-sky-200',
  value: 'bg-gray-100 text-inkMid border-border',
  term: 'bg-gray-100 text-inkLight border-border',
  condition: 'bg-green-50 text-green-700 border-green-200',
  present: 'bg-green-50 text-green-700 border-green-200',
  missing: 'bg-gray-100 text-inkFaint border-dashed border-inkFaint/40',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  buyer: 'bg-buyer/10 text-buyer border-buyer/20',
  seller: 'bg-seller/10 text-seller border-seller/20',
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
      <span className="inline-flex flex-wrap gap-1" data-testid="table-multi">
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
    : (cell.kind === 'value' ? 'text-left font-ui text-sm text-ink' : 'text-left font-body text-sm text-ink leading-relaxed');
  const selectedClass = selected ? 'ring-2 ring-amber-400' : '';
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

function BackingFactList({ backing, tableKey, rowIndex, onSelect }) {
  return (
    <ul className="mt-1 space-y-0.5 pl-2" data-testid="backing-facts">
      {backing.map((entry, index) => (
        <li key={`${entry.fact_id}-${index}`}>
          <button type="button" data-testid="backing-fact" onClick={() => onSelect({ tableKey, rowIndex, columnId: null, componentId: null, factId: entry.fact_id })} className={QUIET}>
            {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}
          </button>
        </li>
      ))}
    </ul>
  );
}

// The row name itself opens the sidebar on the row's first fact, so the
// clause and its sourcing are reachable without a pill (Ben, 2026-09-13:
// "you should be able to see the side bar and sourcing not just by
// clicking the pills").
function TermCell({ row, tableKey, rowIndex, subIndex = null, onSelect, detail = null }) {
  const [expanded, setExpanded] = useState(false);
  const first = row.backing_facts[0] || null;
  return (
    <div>
      {first ? (
        <button type="button" data-testid="term-open" onClick={() => onSelect({ tableKey, rowIndex, subIndex, columnId: null, componentId: null, componentIds: [], factId: first.fact_id })} className="text-left font-ui text-sm font-medium text-ink hover:text-accent">{row.subject}</button>
      ) : <span className="font-ui text-sm font-medium text-ink">{row.subject}</span>}
      {row.backing_facts.length ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className={`ml-2 ${QUIET}`}
          data-testid="see-provision"
        >
          {expanded ? 'Hide provision' : 'See provision'}
        </button>
      ) : null}
      {row.subject_note ? <div className="mt-0.5 font-body text-xs text-inkLight" data-testid="subject-note">{row.subject_note}</div> : null}
      {expanded ? <BackingFactList backing={row.backing_facts} tableKey={tableKey} rowIndex={rowIndex} onSelect={onSelect} /> : null}
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
    <caption className="border-b border-border bg-bg/50 px-4 py-2 text-left text-[10px] font-ui font-medium uppercase tracking-wider text-inkLight" data-testid="table-group-header">{table.group_header}</caption>
  );
}

function AttributeGrid({ table, selection, onSelect }) {
  const row = table.rows[0];
  if (!row) return null;
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === 0;
  const lines = attributeLines(table, row);
  return (
    <div className={CARD}>
      <table className="w-full border-collapse text-left" data-testid="provision-table" data-table-key={table.table_key} data-layout="attribute-grid">
        <GroupHeader table={table} />
        <thead>
          <tr>
            <th className={`w-48 ${TH}`}>Term</th>
            <th className={TH}>Provision</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((column) => {
            const cell = row.cells.find((candidate) => candidate.column_id === column.column_id);
            const backing = row.backing_facts.filter((entry) => (cell?.fact_ids || []).includes(entry.fact_id));
            return (
              <tr key={column.column_id} className="border-b border-border last:border-0" data-testid="attribute-row" data-column-id={column.column_id}>
                <td className={`${TD} font-ui text-sm font-medium text-ink`}>
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
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <span>{header}</span>
      {backing.length ? (
        <button type="button" onClick={() => setExpanded((current) => !current)} className={`ml-2 ${QUIET}`} data-testid="see-provision">
          {expanded ? 'Hide provision' : 'See provision'}
        </button>
      ) : null}
      {expanded ? <BackingFactList backing={backing} tableKey={tableKey} rowIndex={0} onSelect={onSelect} /> : null}
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
function OtherProvisions({ groups, tableKey, onSelect }) {
  const count = groups.reduce((total, group) => total + group.branches.length, 0);
  const open = (factId) => onSelect({ tableKey, rowIndex: 0, columnId: null, componentId: null, factId });
  const reference = (entry) => (entry.section_reference ? <span className={`ml-2 ${QUIET}`}>§ {entry.section_reference}</span> : null);
  return (
    <details className="mt-2 px-1" data-testid="other-provisions">
      <summary className={`cursor-pointer select-none ${LINK}`} data-testid="other-provisions-toggle">Other provisions ({count})</summary>
      <ul className="mt-2 space-y-2 pl-2">
        {groups.map((group, index) => (
          <li key={`${group.subtype_key}-${group.span_id}-${index}`} data-testid="other-provision" data-branches={group.branches.length > 1 ? group.branches.length : undefined}>
            <button type="button" data-testid="other-provision-line" onClick={() => open(group.branches[0].fact_id)} className="text-left font-body text-sm leading-relaxed text-ink hover:text-accent">{group.common_text}</button>
            {group.branches.length === 1 ? reference(group.branches[0]) : (
              <>
                <p className="mt-1 text-[10px] font-ui font-medium uppercase tracking-wider text-inkFaint">Branches</p>
                <ul className="mt-1 space-y-1 border-l border-border pl-3" data-testid="other-provision-branches">
                  {group.branches.map((branch, branchIndex) => (
                    <li key={`${branch.fact_id}-${branchIndex}`}>
                      <button type="button" data-testid="other-provision-branch" onClick={() => open(branch.fact_id)} className="text-left font-body text-sm leading-relaxed text-inkMid hover:text-accent">{branch.text}</button>
                      {reference(branch)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Facts of the section's families that carry no readout: evidence the tables
// cannot place, listed so nothing is hidden and each opens in the sidebar.
function FactsWithoutReadout({ entries, sectionKey, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 px-1 text-xs font-ui text-inkLight" data-testid="facts-without-readout">
      <button type="button" onClick={() => setOpen((current) => !current)} className={LINK}>
        {entries.length} fact{entries.length === 1 ? '' : 's'} without a coded readout · {open ? 'hide' : 'see provisions'}
      </button>
      {open ? (
        <ul className="mt-1 space-y-0.5 pl-2">
          {entries.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`}>
              <button type="button" data-testid="backing-fact" onClick={() => onSelect({ tableKey: `${sectionKey}:without-readout`, rowIndex: index, columnId: null, componentId: null, factId: entry.fact_id })} className="hover:text-ink underline decoration-dotted">
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

// A section heading in the legacy deal page's style (a `font-display
// text-lg` heading over its cards), still a button that collapses the
// section, with the show / hide word on the right.
function SectionHeading({ title, collapsed, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="mb-3 flex w-full items-baseline justify-between gap-3 text-left" data-testid="section-heading">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <span className="text-xs font-ui text-inkFaint" aria-hidden="true">{collapsed ? 'show' : 'hide'}</span>
    </button>
  );
}

// Defined terms as a table under a collapsible heading like every section,
// each term collapsed to start: the term on its line, the definition on a
// click (Ben, 2026-09-13).
function DefinedTermRow({ term }) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-border last:border-0" data-testid="defined-term-row" data-open={open || undefined}>
      <td className={TD}>
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} className="text-left font-ui text-sm font-medium text-ink hover:text-accent" data-testid="defined-term-toggle">{term.term}</button>
        {term.section_reference ? <span className="ml-2 text-xs font-ui text-inkFaint">§ {term.section_reference}</span> : null}
      </td>
      <td className={`${TD} font-body text-sm leading-relaxed text-inkMid`}>
        {open ? (term.definition || <span className="text-inkFaint">Definition not in the closure</span>) : <button type="button" onClick={() => setOpen(true)} className={LINK}>Show</button>}
      </td>
    </tr>
  );
}

function DefinedTermsSection({ terms, collapsed, onToggle }) {
  return (
    <section data-testid="defined-terms-appendix" data-collapsed={collapsed || undefined} id={`provision-section-${DEFINED_TERMS_KEY}`}>
      <SectionHeading title="Defined Terms" collapsed={collapsed} onToggle={onToggle} />
      {collapsed ? null : (
        <div className={CARD}>
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
      className={`border-b border-border last:border-0 ${rowSelected ? 'bg-accentDim' : ''}`}
    >
      {table.term_column ? (
        <td className={`${TD} ${sub ? 'pl-8 text-inkMid' : ''}`}>
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
  if (table.layout === 'attribute grid') return <AttributeGrid table={table} selection={selection} onSelect={onSelect} />;
  return (
    <div className={CARD}>
      <table className="w-full border-collapse text-left" data-testid="provision-table" data-table-key={table.table_key}>
        <GroupHeader table={table} />
        <thead>
          <tr>
            {table.term_column ? (
              <th className={TH}>{table.term_column.header}</th>
            ) : null}
            {table.columns.map((column) => (
              <th key={column.column_id} className={TH}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => {
            if (row.absent) {
              return (
                <tr key={`${row.subject}-${rowIndex}`} className="border-b border-border last:border-0" data-testid="table-row" data-absent="true">
                  {table.term_column ? (
                    <td className={TD}><span className="font-ui text-sm font-medium text-ink">{row.subject}</span></td>
                  ) : null}
                  <td className={`${TD} font-ui text-sm text-inkLight`} colSpan={table.columns.length} data-testid="table-absent">{table.absent_row_label}</td>
                </tr>
              );
            }
            return <RowGroup key={`${row.subject}-${rowIndex}`} table={table} row={row} rowIndex={rowIndex} selection={selection} onSelect={onSelect} initialOpen={initialSubRowsOpen} />;
          })}
        </tbody>
        {table.combined_definition ? (
          <tfoot>
            <tr data-testid="combined-definition">
              <td colSpan={table.columns.length + (table.term_column ? 1 : 0)} className="border-t border-border bg-bg/50 px-4 py-3 align-top">
                <div className="text-[10px] font-ui font-medium uppercase tracking-wider text-inkLight">{table.combined_definition.label}</div>
                <div className="mt-1 font-body text-sm leading-relaxed text-ink">
                  <span className="font-medium">“{table.combined_definition.term}”</span>
                  {table.combined_definition.text ? <span className="text-inkMid"> · {table.combined_definition.text}</span> : null}
                  <button
                    type="button"
                    data-testid="backing-fact"
                    onClick={() => onSelect({ tableKey: table.table_key, rowIndex: null, columnId: null, componentId: (table.combined_definition.component_ids || [])[0] || null, factId: table.combined_definition.fact_id })}
                    className={`ml-2 ${QUIET}`}
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
              <td colSpan={table.columns.length + (table.term_column ? 1 : 0)} className="border-t border-border bg-bg/50 px-4 py-3 align-top">
                <div className="text-[10px] font-ui font-medium uppercase tracking-wider text-inkLight">{table.footer.label}</div>
                {table.footer.entries.map((entry, index) => (
                  <div key={`${entry.fact_id}-${index}`} className="mt-1 font-body text-sm leading-relaxed text-ink">
                    <span>{entry.text}</span>
                    <button
                      type="button"
                      data-testid="backing-fact"
                      onClick={() => onSelect({ tableKey: table.table_key, rowIndex: null, columnId: null, componentId: (entry.component_ids || [])[0] || null, factId: entry.fact_id })}
                      className={`ml-2 ${QUIET}`}
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

  return (
    <div className="flex flex-wrap gap-6 lg:flex-nowrap" data-testid="provision-tables">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex justify-end gap-3 text-xs font-ui text-accent" data-testid="section-toggles">
          <button type="button" onClick={() => setAll(false)} disabled={collapsed.size === 0} className="hover:underline disabled:text-inkFaint disabled:no-underline">Expand all</button>
          <button type="button" onClick={() => setAll(true)} disabled={allCollapsed} className="hover:underline disabled:text-inkFaint disabled:no-underline">Collapse all</button>
        </div>
        {tableView.sections.map((section) => {
          const isCollapsed = collapsed.has(section.section_key);
          return (
            <section key={section.section_key} data-testid="provision-section" data-collapsed={isCollapsed || undefined} id={`provision-section-${section.section_key}`}>
              <SectionHeading title={section.title} collapsed={isCollapsed} onToggle={() => toggleSection(section.section_key)} />
              {isCollapsed ? null : (
                <>
                  <div className="space-y-3 overflow-x-auto">
                    {section.tables.map((table) => (
                      <div key={table.table_key}>
                        <Table table={table} selection={selection} onSelect={setSelection} initialSubRowsOpen={initialSubRowsOpen} />
                        {table.other_provisions?.length ? (
                          <OtherProvisions groups={table.other_provisions} tableKey={table.table_key} onSelect={setSelection} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {section.facts_without_readout?.length ? (
                    <FactsWithoutReadout entries={section.facts_without_readout} sectionKey={section.section_key} onSelect={setSelection} />
                  ) : null}
                </>
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
        />
      ) : null}
    </div>
  );
}
