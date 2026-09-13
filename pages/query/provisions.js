import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard, ErrorState } from '../../components/UI';
import PublishedSummary from '../../components/product/PublishedSummary.jsx';
import { displayReviewLabel } from '../../lib/product/review-labels';
import legalSchemaV2 from '../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../contracts/product/table-shapes.v3.json';

// The provision rail: one link per table-shapes section, in shape order, so
// a reader can jump straight to (say) Termination Fees across every
// agreement shown below (mockup approved by Ben 2026-09-12/13).
function ProvisionRail({ sections }) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Provision sections" className="hidden w-48 shrink-0 lg:block" data-testid="provision-rail">
      <p className="text-[10px] font-bold uppercase tracking-wide text-inkFaint">Jump to</p>
      <ul className="mt-2 space-y-1 text-xs">
        {sections.map((section) => (
          <li key={section.section_key}>
            <a href={`#provision-section-${section.section_key}`} className="text-inkMid hover:text-accent">{section.title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

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
        <div className="flex gap-8">
          <ProvisionRail sections={tableShapesV3.sections} />
          <div className="min-w-0 flex-1 space-y-8">
            {agreementsWithFacts.map((agreement) => (
              <div key={agreement.source_document_id} className="space-y-2">
                <h2 className="font-display text-lg text-ink border-b border-border pb-1">{agreement.agreement_label}</h2>
                <PublishedSummary
                  groups={[{ family_key: 'ALL', collapsed: false, facts: agreement.facts }]}
                  tableShapes={tableShapesV3}
                  legalSchema={legalSchemaV2}
                />
              </div>
            ))}
          </div>
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
