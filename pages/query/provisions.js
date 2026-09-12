import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard, ErrorState } from '../../components/UI';
import { PublishedFact } from '../../components/product/PublishedSummary.jsx';
import { displayReviewLabel } from '../../lib/product/review-labels';
import legalSchemaV2 from '../../contracts/product/legal-schema.v2.json';

export const NO_FACTS_MESSAGE = 'No published layered facts yet. Facts appear here after a V2 review is published.';

export const QUERYABLE_FAMILIES = legalSchemaV2.families
  .filter((family) => family.state === 'DEFINED' && family.coverage_only !== true);

// Pure presentational body: takes already-fetched agreements so it can be
// rendered and tested without the page's auth redirect or data fetching.
export function QueryProvisionsBody({
  agreements, error, families, familyKey, subtypeKey, onFamilyChange, onSubtypeChange,
}) {
  const selectedFamily = families.find((family) => family.family_key === familyKey) || null;
  const agreementsWithFacts = (agreements || []).filter((agreement) => agreement.facts.length > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Review', href: '/review' },
        { label: 'Query published provisions' },
      ]} />

      <div>
        <h1 className="font-display text-2xl text-ink">Query published provisions</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Accepted, published facts across every agreement, grouped by family and subtype.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="text-sm font-ui text-inkMid">
          Family
          <select
            className="mt-1 block w-64 rounded border border-border bg-white px-2 py-1 text-sm text-ink"
            value={familyKey}
            onChange={(event) => onFamilyChange(event.target.value)}
          >
            <option value="">All families</option>
            {families.map((family) => (
              <option key={family.family_key} value={family.family_key}>{displayReviewLabel(family.family_key)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-ui text-inkMid">
          Subtype
          <select
            className="mt-1 block w-64 rounded border border-border bg-white px-2 py-1 text-sm text-ink disabled:opacity-50"
            value={subtypeKey}
            onChange={(event) => onSubtypeChange(event.target.value)}
            disabled={!selectedFamily}
          >
            <option value="">All subtypes</option>
            {(selectedFamily?.subtypes || []).map((subtype) => (
              <option key={subtype.subtype_key} value={subtype.subtype_key}>{subtype.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {!error && agreements === null ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!error && agreements !== null && agreementsWithFacts.length === 0 ? (
        <EmptyState icon="" title="No published facts" description={NO_FACTS_MESSAGE} />
      ) : null}

      {!error && agreementsWithFacts.length > 0 ? (
        <div className="space-y-8">
          {agreementsWithFacts.map((agreement) => (
            <div key={agreement.source_document_id} className="space-y-2">
              <h2 className="font-display text-lg text-ink border-b border-border pb-1">{agreement.agreement_label}</h2>
              <ul className="mt-2 space-y-2">
                {agreement.facts.map((fact) => (
                  <PublishedFact key={fact.review_item_id} fact={fact} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function QueryProvisionsPage() {
  useUser({ redirectTo: '/login' });

  const [familyKey, setFamilyKey] = useState('');
  const [subtypeKey, setSubtypeKey] = useState('');
  const [agreements, setAgreements] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSubtypeKey('');
  }, [familyKey]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const params = new URLSearchParams();
    if (familyKey) params.set('family', familyKey);
    if (subtypeKey) params.set('subtype', subtypeKey);
    const query = params.toString();
    fetch(`/api/product/published-facts${query ? `?${query}` : ''}`)
      .then((response) => {
        if (!response.ok) throw new Error(`published-facts request failed: ${response.status}`);
        return response.json();
      })
      .then((body) => { if (!cancelled) setAgreements(body.agreements || []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [familyKey, subtypeKey]);

  return (
    <QueryProvisionsBody
      agreements={agreements}
      error={error}
      families={QUERYABLE_FAMILIES}
      familyKey={familyKey}
      subtypeKey={subtypeKey}
      onFamilyChange={setFamilyKey}
      onSubtypeChange={setSubtypeKey}
    />
  );
}
