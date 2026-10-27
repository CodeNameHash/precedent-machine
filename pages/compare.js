import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useUser } from '../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../components/UI';
import PwBar from '../components/chrome/PwBar';
import { displayReviewLabel } from '../lib/product/review-labels';
import { compareAcross } from '../lib/product/provision-compare';
import tableShapesV3 from '../contracts/product/table-shapes.v3.json';

// The comparison surface (work package 53, plan finding (295)). It is the
// summary view of the design note: one row per family and subtype, one column
// per agreement, each cell the facts that agreement states there. Released
// agreements are compared as released; every fact that was not lawyer-reviewed
// carries a warning on its own row, because the product assumes the model is
// right but says when no lawyer has checked it.
function label(fact) {
  return String(fact.statement || '').trim();
}

export default function ComparePage() {
  const { user } = useUser({ redirectTo: '/login' });
  const [agreements, setAgreements] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetch('/api/product/published-facts', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        if (cancelled) return;
        const list = body.agreements || [];
        setAgreements(list);
        setSelected(list.slice(0, 3).map((agreement) => agreement.source_document_id));
      })
      .catch((failure) => { if (!cancelled) { setAgreements([]); setError(failure.message); } });
    return () => { cancelled = true; };
  }, [user]);

  const columns = useMemo(() => (agreements || []).filter((agreement) => selected.includes(agreement.source_document_id)), [agreements, selected]);

  // The coded-cell comparison: rows are the schema's provisions, cells are the
  // answers the deal page shows (work package 54, finding (301)). It runs
  // whenever the compared releases carry coded conclusions.
  const codedRows = useMemo(() => (columns.length ? compareAcross(columns, tableShapesV3) : []), [columns]);
  const coded = codedRows.length > 0;

  const rows = useMemo(() => {
    const keyed = new Map();
    for (const agreement of columns) {
      for (const fact of agreement.facts || []) {
        const key = `${fact.family_key}\u001f${fact.subtype_key || ''}`;
        if (!keyed.has(key)) keyed.set(key, { family_key: fact.family_key, subtype_key: fact.subtype_key || null, bySource: new Map() });
        const row = keyed.get(key);
        if (!row.bySource.has(agreement.source_document_id)) row.bySource.set(agreement.source_document_id, []);
        row.bySource.get(agreement.source_document_id).push(fact);
      }
    }
    return [...keyed.values()].sort((left, right) => `${left.family_key}${left.subtype_key}`.localeCompare(`${right.family_key}${right.subtype_key}`));
  }, [columns]);

  const toggle = (id) => setSelected((current) => (current.includes(id)
    ? current.filter((entry) => entry !== id)
    : (current.length >= 3 ? current : [...current, id])));

  return (
    <div className="min-h-screen bg-white text-[#03203D]" data-testid="compare-page">
      <PwBar active="compare" />
      <div className="space-y-6 border-t-[10px] border-[#B9C8DA] px-[max(16px,min(6vw,96px))] py-[clamp(28px,4vw,56px)]">
  <Head><title>Compare agreements · Corpus</title></Head>
      <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Compare' }]} />
      <div>
        <p className="font-ui text-[12px] font-bold uppercase tracking-[0.1em] text-[#0B3D71]">Comparison</p>
        <h1 className="mt-[10px] font-sans font-extrabold leading-[.96] tracking-[-.05em]" style={{ fontSize: 'clamp(32px,4vw,56px)' }}>Compare agreements</h1>
        <p className="mt-[10px] max-w-[70ch] font-body text-[19px] leading-[1.35] text-[#33475E]">
          The same provision, side by side. A row that exists in one agreement and not another says so rather than disappearing.
        </p>
        {selected.length >= 3 ? <p className="mt-1 text-xs font-ui text-inkLight">Three at a time — clear one to add another.</p> : null}
      </div>

      {agreements === null ? <SkeletonCard /> : null}
      {error ? <p className="text-sm font-ui text-red-700">Published facts could not be read ({error}).</p> : null}
      {agreements && agreements.length === 0 && !error ? (
        <EmptyState
          icon="+"
          title="Nothing to compare yet"
          description="A comparison needs agreements. Publish a review, and its facts appear here."
          action={<Link href="/" className="text-sm font-ui text-accent hover:underline">Go to the index</Link>}
        />
      ) : null}

      {agreements && agreements.length > 0 ? (
        <section className="flex flex-wrap items-center gap-2" aria-label="Agreements to compare">
          {agreements.map((agreement) => {
            const active = selected.includes(agreement.source_document_id);
            return (
              <button
                key={agreement.source_document_id}
                type="button"
                onClick={() => toggle(agreement.source_document_id)}
                className={`rounded-full border px-3 py-1 text-xs font-ui ${active ? 'border-[#0B3D71] bg-[#0B3D71] text-white' : 'border-border text-inkMid'}`}
              >
                {agreement.agreement_label}
                {agreement.released_with_warning ? <span className="ml-1 text-amber-600" title="health warning">▲</span> : null}
              </button>
            );
          })}
        </section>
      ) : null}

      {coded ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" data-testid="coded-compare">
            <thead>
              <tr>
                <th className="w-56 border-b border-[#B9C8DA] p-2 text-left text-xs font-bold uppercase tracking-wide text-[#6B7785]">Provision</th>
                {columns.map((agreement) => (
                  <th key={agreement.source_document_id} className="border-b border-[#B9C8DA] p-2 text-left">
                    <div className="font-sans text-[15px] font-extrabold tracking-[-.03em] text-[#03203D]">{agreement.agreement_label}</div>
                    <div className="font-ui text-[11px] text-[#6B7785]">V2 · {agreement.facts.length} facts</div>
                  </th>
                ))}
                <th className="w-24 border-b border-[#B9C8DA] p-2 text-left text-xs font-bold uppercase tracking-wide text-[#6B7785]">n</th>
              </tr>
            </thead>
            <tbody>
              {codedRows.map((row) => (
                <tr key={`${row.table_key}-${row.row_label}`} className="align-top">
                  <th scope="row" className="border-b border-[#DCE3E1] p-2 text-left font-ui text-[12px] font-semibold text-[#33475E]">
                    {row.row_label}
                    <div className="font-normal text-[#6B7785]">{row.table_key}</div>
                  </th>
                  {columns.map((agreement) => {
                    const cells = row.by_source[agreement.source_document_id] || [];
                    return (
                      <td key={agreement.source_document_id} className="border-b border-[#DCE3E1] p-2">
                        {cells.length === 0 ? <span className="font-ui text-[11px] text-[#6B7785]">Not stated</span> : (
                          <div className="flex flex-wrap gap-[4px]">
                            {cells.map((cell, index) => (
                              <span key={`${cell.answer}-${index}`} className="inline-flex flex-col items-start gap-[2px]">
                                {cell.answer ? <span className="inline-flex items-center rounded-full bg-[#03203D] px-[9px] py-[2px] font-ui text-[11px] font-semibold text-white">{cell.answer}</span> : null}
                                {cell.condition ? <span className="inline-flex items-center rounded-full border border-[#B9C8DA] px-[9px] py-[2px] font-ui text-[11px] text-[#0B3D71]">{cell.condition}</span> : null}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-[#DCE3E1] p-2 font-ui text-[11px] text-[#6B7785]">{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 font-ui text-[11px] text-[#6B7785]">Every cell is the answer the deal page shows; n counts the agreements that state one.</p>
        </div>
      ) : null}

      {!coded && columns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-48 border-b border-border p-2 text-left text-xs font-bold uppercase tracking-wide text-inkMid">Provision</th>
                {columns.map((agreement) => (
                  <th key={agreement.source_document_id} className="border-b border-border p-2 text-left">
                    <div className="font-display text-base text-ink">{agreement.agreement_label}</div>
                    <div className="text-[11px] font-ui text-inkLight">
                      V2 · {agreement.facts.length} facts
                      {agreement.released_with_warning ? ' · health warning' : ''}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.family_key}-${row.subtype_key}`} className="align-top">
                  <th scope="row" className="border-b border-border/60 p-2 text-left text-xs font-semibold text-inkMid">
                    {displayReviewLabel(row.family_key)}
                    {row.subtype_key ? <div className="font-normal text-inkLight">{displayReviewLabel(row.subtype_key)}</div> : null}
                  </th>
                  {columns.map((agreement) => {
                    const facts = row.bySource.get(agreement.source_document_id) || [];
                    return (
                      <td key={agreement.source_document_id} className="border-b border-border/60 p-2">
                        {facts.length === 0 ? <span className="text-xs font-ui text-inkLight">Not stated</span> : (
                          <ul className="space-y-1">
                            {facts.map((fact) => (
                              <li key={fact.review_item_id || fact.fact_id || label(fact)} className="text-xs text-ink">
                                {label(fact)}
                                {fact.decided_by_role !== 'LAWYER' ? (
                                  <span className="ml-1 text-amber-600" title="Not lawyer-reviewed">▲</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] font-ui text-inkLight">▲ not lawyer-reviewed · every fact is shown as the model read it.</p>
        </div>
      ) : null}
      </div>
    </div>
  );
}