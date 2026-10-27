import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../components/UI';
import { displayReviewLabel } from '../lib/product/review-labels';

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
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Compare' }]} />
      <div>
        <h1 className="font-display text-2xl text-ink">Compare agreements</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          The same provision, side by side. A row that exists in one agreement and not another says so rather than disappearing.
        </p>
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

      {columns.length > 0 ? (
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
  );
}
