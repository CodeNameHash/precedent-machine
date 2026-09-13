import { useMemo, useState } from 'react';
import EvidenceSidebar from './EvidenceSidebar';
import { factIdOf } from '../../lib/product/table-view';

// Renders a lib/product/table-view.js buildTableView() result as the small
// tables of coded headline conclusions, pills per subject, that the
// published and Query pages show (mockup approved by Ben 2026-09-12/13):
// one section band per family with a 2px rule and a coloured dot, group
// headers in capitals, uppercase tracked column headers, a Term column with
// a "See provision" control, square-cornered pills carrying a tone.
// Clicking a pill (or any populated cell) selects it and its row and opens
// the persistent EvidenceSidebar; it is never a modal.

const TONE_CLASSES = {
  neutral: 'border-border bg-paper text-inkMid',
  present: 'border-green-300 bg-green-50 text-green-800',
  missing: 'border-slate-300 bg-slate-100 text-slate-500',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
  buyer: 'border-buyer/40 bg-buyer/10 text-buyer',
  seller: 'border-seller/40 bg-seller/10 text-seller',
};

function toneClass(tone) {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral;
}

function Cell({ cell, tableKey, rowIndex, selected, onSelect }) {
  if (cell.kind === 'dash') {
    return <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>;
  }
  if (Array.isArray(cell.values) && cell.values.length > 1) {
    return (
      <span className="inline-flex flex-wrap gap-1" data-testid="table-multi">
        {cell.values.map((value, index) => (
          <Cell key={`${value.label}-${index}`} cell={{ ...value, column_id: cell.column_id }} tableKey={tableKey} rowIndex={rowIndex} selected={selected} onSelect={onSelect} />
        ))}
      </span>
    );
  }
  const isPill = cell.kind === 'pill';
  const testId = isPill ? 'table-pill' : (cell.kind === 'value' ? 'table-value' : 'table-text');
  const canSelect = (cell.component_ids || []).length > 0 || (cell.fact_ids || []).length > 0;
  const baseClass = isPill
    ? `inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-[11px] font-semibold ${toneClass(cell.tone)}`
    : 'text-left text-xs text-ink';
  const selectedClass = selected ? 'ring-2 ring-amber-400' : '';
  if (!canSelect) return <span className={baseClass}>{cell.label}</span>;
  return (
    <button
      type="button"
      data-testid={testId}
      data-selected={selected || undefined}
      onClick={() => onSelect({
        tableKey,
        rowIndex,
        columnId: cell.column_id,
        componentId: (cell.component_ids || [])[0] || null,
        factId: (cell.fact_ids || [])[0] || null,
      })}
      className={`${baseClass} ${selectedClass}`}
    >
      {cell.label}
    </button>
  );
}

function TermCell({ row, tableKey, rowIndex, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <span className="font-medium text-ink">{row.subject}</span>
      {row.backing_facts.length ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent"
          data-testid="see-provision"
        >
          {expanded ? 'Hide provision' : 'See provision'}
        </button>
      ) : null}
      {expanded ? (
        <ul className="mt-1 space-y-0.5 pl-2 text-[11px] text-inkLight" data-testid="backing-facts">
          {row.backing_facts.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`}>
              <button
                type="button"
                data-testid="backing-fact"
                onClick={() => onSelect({
                  tableKey, rowIndex, columnId: null, componentId: null, factId: entry.fact_id,
                })}
                className="underline decoration-dotted"
              >
                {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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

function AttributeGrid({ table, selection, onSelect }) {
  const row = table.rows[0];
  if (!row) return null;
  const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === 0;
  const lines = attributeLines(table, row);
  return (
    <table className="w-full border-separate border-spacing-0 border border-border bg-white text-left text-xs" data-testid="provision-table" data-table-key={table.table_key} data-layout="attribute-grid">
      {table.group_header ? (
        <caption className="border-b border-border bg-paper px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink" data-testid="table-group-header">{table.group_header}</caption>
      ) : null}
      <thead>
        <tr>
          <th className="w-48 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-inkFaint">Term</th>
          <th className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-inkFaint">Provision</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((column) => {
          const cell = row.cells.find((candidate) => candidate.column_id === column.column_id);
          const backing = row.backing_facts.filter((entry) => (cell?.fact_ids || []).includes(entry.fact_id));
          return (
            <tr key={column.column_id} data-testid="attribute-row" data-column-id={column.column_id}>
              <td className="border-b border-lineSoft px-3 py-2 align-top font-medium text-ink">
                <AttributeTerm header={column.header} backing={backing} tableKey={table.table_key} onSelect={onSelect} />
              </td>
              <td className="border-b border-lineSoft px-3 py-2 align-top">
                {cell ? (
                  <Cell cell={cell} tableKey={table.table_key} rowIndex={0} selected={!!rowSelected && selection?.columnId === column.column_id} onSelect={onSelect} />
                ) : <span className="text-inkFaint" data-testid="table-dash" aria-hidden="true">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AttributeTerm({ header, backing, tableKey, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <span>{header}</span>
      {backing.length ? (
        <button type="button" onClick={() => setExpanded((current) => !current)} className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent" data-testid="see-provision">
          {expanded ? 'Hide provision' : 'See provision'}
        </button>
      ) : null}
      {expanded ? (
        <ul className="mt-1 space-y-0.5 pl-2 text-[11px] font-normal text-inkLight" data-testid="backing-facts">
          {backing.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`}>
              <button type="button" data-testid="backing-fact" onClick={() => onSelect({ tableKey, rowIndex: 0, columnId: null, componentId: null, factId: entry.fact_id })} className="underline decoration-dotted">
                {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Facts of the section's families that carry no readout: evidence the tables
// cannot place, listed so nothing is hidden and each opens in the sidebar.
function FactsWithoutReadout({ entries, sectionKey, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 text-[11px] text-inkLight" data-testid="facts-without-readout">
      <button type="button" onClick={() => setOpen((current) => !current)} className="font-semibold text-accent">
        {entries.length} fact{entries.length === 1 ? '' : 's'} without a coded readout · {open ? 'hide' : 'see provisions'}
      </button>
      {open ? (
        <ul className="mt-1 space-y-0.5 pl-2">
          {entries.map((entry, index) => (
            <li key={`${entry.fact_id}-${index}`}>
              <button type="button" data-testid="backing-fact" onClick={() => onSelect({ tableKey: `${sectionKey}:without-readout`, rowIndex: index, columnId: null, componentId: null, factId: entry.fact_id })} className="underline decoration-dotted">
                {entry.section_reference ? `§ ${entry.section_reference}` : entry.fact_id}{entry.headline ? ` · ${entry.headline}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Table({ table, selection, onSelect }) {
  if (table.layout === 'attribute grid') return <AttributeGrid table={table} selection={selection} onSelect={onSelect} />;
  return (
    <table className="w-full border-separate border-spacing-0 border border-border bg-white text-left text-xs" data-testid="provision-table" data-table-key={table.table_key}>
      {table.group_header ? (
        <caption className="border-b border-border bg-paper px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-ink" data-testid="table-group-header">
          {table.group_header}
        </caption>
      ) : null}
      <thead>
        <tr>
          {table.term_column ? (
            <th className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-inkFaint">{table.term_column.header}</th>
          ) : null}
          {table.columns.map((column) => (
            <th key={column.column_id} className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-inkFaint">{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.flatMap((row, rowIndex) => {
          const rowSelected = selection?.tableKey === table.table_key && selection?.rowIndex === rowIndex;
          const line = (entry, key, sub) => (
            <tr
              key={key}
              data-testid={sub ? 'table-sub-row' : 'table-row'}
              data-selected={rowSelected || undefined}
              className={rowSelected ? 'bg-accentDim' : undefined}
            >
              {table.term_column ? (
                <td className={`border-b border-lineSoft px-3 py-2 align-top ${sub ? 'pl-8 text-inkMid' : ''}`}>
                  <TermCell row={entry} tableKey={table.table_key} rowIndex={rowIndex} onSelect={onSelect} />
                </td>
              ) : null}
              {entry.cells.map((cell) => (
                <td key={cell.column_id} className="border-b border-lineSoft px-3 py-2 align-top">
                  <Cell
                    cell={cell}
                    tableKey={table.table_key}
                    rowIndex={rowIndex}
                    selected={!!rowSelected && selection?.columnId === cell.column_id}
                    onSelect={onSelect}
                  />
                </td>
              ))}
            </tr>
          );
          return [
            line(row, `${row.subject}-${rowIndex}`, false),
            ...(row.sub_rows || []).map((subRow, subIndex) => line(subRow, `${row.subject}-${rowIndex}-${subIndex}`, true)),
          ];
        })}
      </tbody>
    </table>
  );
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
}) {
  const factsById = useMemo(() => new Map((facts || []).map((fact) => [factIdOf(fact), fact])), [facts]);
  const [selection, setSelection] = useState(null);

  if (!tableView || tableView.sections.length === 0) return null;

  const selectedFact = selection ? factsById.get(selection.factId) || null : null;

  return (
    <div className="flex flex-wrap gap-6 lg:flex-nowrap" data-testid="provision-tables">
      <div className="min-w-0 flex-1 space-y-8">
        {tableView.sections.map((section) => (
          <section key={section.section_key} data-testid="provision-section" id={`provision-section-${section.section_key}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <h3 className="whitespace-nowrap font-display text-lg text-ink">{section.title}</h3>
              <span className="h-[2px] flex-1 bg-border" />
            </div>
            <div className="space-y-4 overflow-x-auto">
              {section.tables.map((table) => (
                <Table key={table.table_key} table={table} selection={selection} onSelect={setSelection} />
              ))}
            </div>
            {section.facts_without_readout?.length ? (
              <FactsWithoutReadout entries={section.facts_without_readout} sectionKey={section.section_key} onSelect={setSelection} />
            ) : null}
          </section>
        ))}
        {tableView.defined_terms.length ? (
          <section data-testid="defined-terms-appendix">
            <h3 className="mb-2 border-b border-border pb-1 font-display text-lg text-ink">Defined Terms</h3>
            <dl className="space-y-2 text-xs">
              {tableView.defined_terms.map((term) => (
                <div key={term.component_id}>
                  <dt className="font-semibold text-ink">{term.term}</dt>
                  {term.definition ? <dd className="text-inkLight">{term.definition}</dd> : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>
      {selectedFact ? (
        <EvidenceSidebar
          fact={selectedFact}
          componentId={selection.componentId}
          reviewItem={reviewItemsByFactId ? reviewItemsByFactId.get(selection.factId) || null : null}
          provenance={provenanceByFactId ? provenanceByFactId.get(selection.factId) || null : null}
          sectionText={sectionTextByFactId ? sectionTextByFactId.get(selection.factId) || null : null}
          onDecision={onDecision}
          onComment={onComment}
          onReset={onReset}
          onClose={() => setSelection(null)}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
