import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../../components/UI';
import PublishedSummary from '../../../components/product/PublishedSummary';
import { groupPublishedFacts } from '../../../lib/product/published-layers';
import legalSchemaV2 from '../../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../../contracts/product/table-shapes.v3.json';

// The released deal page is the deal page (work package 53, plan finding
// (294)): the same provision tables and evidence renderer the lawyer preview
// uses, fed by the current release instead of a draft. Header: the parties and
// the agreement date, not the SEC URL, and the release's health warning when
// it carries one.
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

  const groups = useMemo(() => (agreement ? groupPublishedFacts(agreement.facts, legalSchemaV2) : []), [agreement]);
  const parties = (agreement?.parties || []).map((party) => (typeof party === 'string' ? party : party?.name)).filter(Boolean);
  const date = agreement?.agreement_date
    ? new Date(agreement.agreement_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const unreviewed = (agreement?.facts || []).filter((fact) => fact.decided_by_role !== 'LAWYER').length;

  return (
    <div className="space-y-6">
  <Head><title>Released agreement · Corpus</title></Head>
      <Breadcrumbs items={[{ label: 'Index', href: '/' }, { label: 'Released agreement' }]} />
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
          <header className="space-y-1">
            <p className="text-xs font-ui uppercase tracking-wide text-inkLight">
              Released {new Date(agreement.released_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="font-display text-2xl text-ink">{agreement.agreement_label}</h1>
            <p className="text-sm font-ui text-inkLight">
              {date ? `${date} · ` : ''}{agreement.facts.length} facts
              {agreement.retrieval_url ? <> · <a href={agreement.retrieval_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">SEC exhibit</a></> : null}
            </p>
          </header>
          {agreement.released_with_warning ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="release-health-warning">
              <strong>Health warning.</strong> {agreement.release_warning?.detail || 'This release was published on the owner\'s acknowledgement, not a full lawyer attestation.'}
            </div>
          ) : null}
          {unreviewed > 0 ? (
            <p className="text-xs font-ui text-inkLight" data-testid="not-lawyer-reviewed">
              {unreviewed} of {agreement.facts.length} facts have not been lawyer-reviewed; they are shown as the model read them.
            </p>
          ) : null}
          <PublishedSummary
            groups={groups}
            tableShapes={tableShapesV3}
            legalSchema={legalSchemaV2}
            heading={null}
            onSource={() => { if (agreement.retrieval_url) window.open(agreement.retrieval_url, '_blank', 'noopener'); }}
          />
        </>
      ) : null}
    </div>
  );
}
