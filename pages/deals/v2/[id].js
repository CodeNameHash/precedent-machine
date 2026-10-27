import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../../components/UI';
import { displayReviewLabel } from '../../../lib/product/review-labels';

// The released deal page (work package 53, plan finding (293)): one agreement
// as published — its facts grouped by family, with the words cited by the
// review, and the release's health warning when it carries one. It reads only
// the current release (the active release pointer), never a draft.
export default function ReleasedDealPage() {
  const { user } = useUser({ redirectTo: '/login' });
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return undefined;
    let cancelled = false;
    fetch('/api/product/published-facts', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        if (cancelled) return;
        setAgreement((body.agreements || []).find((entry) => entry.source_document_id === id) || null);
      })
      .catch(() => { if (!cancelled) setAgreement(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, user]);

  const families = useMemo(() => {
    const groups = new Map();
    for (const fact of agreement?.facts || []) {
      const key = fact.family_key || 'OTHER';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(fact);
    }
    return [...groups.entries()];
  }, [agreement]);

  const label = agreement ? String(agreement.agreement_label || '').split('/').pop() : '';

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Released deal' }]} />
      {loading ? <SkeletonCard /> : null}
      {!loading && !agreement ? (
        <EmptyState
          icon="+"
          title="No released agreement with that id"
          description="This page reads the current release only. If the agreement has not been released, open its review instead."
          action={<Link href="/" className="text-sm font-ui text-accent hover:underline">Back to the index</Link>}
        />
      ) : null}
      {agreement ? (
        <>
          <div>
            <p className="text-xs font-ui uppercase tracking-wide text-inkLight">Released {new Date(agreement.released_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <h1 className="font-display text-2xl text-ink">{label || 'Released agreement'}</h1>
            <p className="text-sm font-ui text-inkLight mt-1">{agreement.facts.length} published facts · run {String(agreement.run_id).slice(0, 8)}</p>
          </div>
          {agreement.released_with_warning ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="release-health-warning">
              <strong>Health warning.</strong> {agreement.release_warning?.detail || 'This release was published on the owner\'s acknowledgement, not a full lawyer attestation.'}
            </div>
          ) : null}
          {families.map(([family, facts]) => (
            <section key={family} className="space-y-2">
              <h2 className="font-display text-lg text-ink">{displayReviewLabel(family)}</h2>
              <div className="space-y-2">
                {facts.map((fact) => (
                  <article key={fact.review_item_id || fact.fact_id || fact.statement} className="rounded border border-border bg-white p-3">
                    <p className="text-sm text-ink">{fact.statement || fact.summary}</p>
                    {fact.headline?.label ? <p className="mt-1 text-xs font-ui text-inkLight">{fact.headline.label}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}
