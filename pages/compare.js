import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../components/UI';
import { displayReviewLabel } from '../lib/product/review-labels';

// The comparison surface (work package 53, plan finding (290)): released
// agreements side by side, one column each, the same facts in the same order.
// A comparison needs at least two releases; until then it says so and points
// at the index. It reads only released facts (the current-release pointer),
// never a draft, so what a reader compares is what was published.
function labelFor(agreement) {
  const url = String(agreement.agreement_label || '');
  const file = url.split('/').pop();
  return file ? file.replace(/[-_]/g, ' ') : String(agreement.source_document_id || '').slice(0, 12);
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
      .then((body) => { if (!cancelled) setAgreements(body.agreements || []); })
      .catch((failure) => { if (!cancelled) { setAgreements([]); setError(failure.message); } });
    return () => { cancelled = true; };
  }, [user]);

  const columns = useMemo(() => (agreements || []).filter((agreement) => selected.includes(agreement.source_document_id)), [agreements, selected]);
  const toggle = (id) => setSelected((current) => (current.includes(id)
    ? current.filter((entry) => entry !== id)
    : (current.length >= 3 ? current : [...current, id])));

  return (
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Compare' }]} />
      {columns.some((agreement) => agreement.released_with_warning) ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="release-health-warning">
          <strong>Health warning.</strong> At least one compared release was published on the owner's acknowledgement, not a full lawyer attestation.
        </div>
      ) : null}
      <div>
        <h1 className="font-display text-2xl text-ink">Compare agreements</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Pick two or three released agreements; each gets a column, and every fact is shown under the same family heading on both sides.
        </p>
      </div>

      {agreements === null ? <SkeletonCard /> : null}
      {error ? <p className="text-sm font-ui text-red-700">Published facts could not be read ({error}).</p> : null}
      {agreements && agreements.length < 1 && !error ? (
        <EmptyState
          icon="+"
          title="Nothing to compare yet"
          description="A comparison needs released agreements. Publish a review, and its released facts appear here."
          action={<Link href="/" className="text-sm font-ui text-accent hover:underline">Go to the index</Link>}
        />
      ) : null}

      {agreements && agreements.length > 0 ? (
        <section className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-ui uppercase tracking-wide text-inkLight">Agreements</span>
          {agreements.map((agreement) => (
            <button
              key={agreement.source_document_id}
              type="button"
              onClick={() => toggle(agreement.source_document_id)}
              className={`rounded-full border px-3 py-1 text-xs font-ui ${selected.includes(agreement.source_document_id) ? 'border-accent bg-accent/10 text-accent' : 'border-border text-inkMid'}`}
            >
              {labelFor(agreement)}
            </button>
          ))}
          {selected.length >= 3 ? <span className="text-xs font-ui text-inkLight">Three at a time.</span> : null}
        </section>
      ) : null}

      {columns.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((agreement) => (
            <div key={agreement.source_document_id} className="space-y-3">
              <h2 className="font-display text-lg text-ink">{labelFor(agreement)}</h2>
              {agreement.facts.length === 0 ? <p className="text-sm font-ui text-inkLight">No facts.</p> : null}
              {Object.entries(agreement.facts.reduce((groups, fact) => {
                const key = fact.family_key || 'OTHER';
                (groups[key] = groups[key] || []).push(fact);
                return groups;
              }, {})).map(([family, facts]) => (
                <div key={family}>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-inkMid">{displayReviewLabel(family)}</h3>
                  <ul className="space-y-1">
                    {facts.map((fact) => (
                      <li key={fact.review_item_id || fact.fact_id || fact.statement} className="rounded border border-border bg-white p-2 text-xs text-ink">
                        {fact.statement || fact.summary || 'Untitled fact'}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
