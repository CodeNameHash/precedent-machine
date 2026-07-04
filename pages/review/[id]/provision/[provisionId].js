import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeal, useProvisions } from '../../../../lib/useSupabaseData';
import { useViewMode } from '../../../../components/ViewModeContext';
import { Breadcrumbs, SkeletonCard, EmptyState } from '../../../../components/UI';
import { getStructuredFeatures, evidenceQuote } from '../../../../lib/citable';
import {
  typeLabel,
  typeHex,
  favBadge,
  humanizeKey,
  renderSummaryRowValue,
  EvidenceQuote,
} from '../../../../components/review/shared';
import { buildProvisionFamily, getSectionNumber } from '../../../../components/review/provision-family';
import { DocPopUnder } from '../../../../components/review/DocPopUnder';
import { filterProvisionsForViewMode } from '../../../../components/review/table-logic';

/* ── One structured feature as a labeled pill/row. Reuses
 *    renderSummaryRowValue (the same renderer table cells use) so a value
 *    reads identically here as it does in the section tables — no bespoke
 *    per-type rendering reinvented for this page. ── */
function FeatureRow({ featureKey, value, provision }) {
  const rendered = renderSummaryRowValue({ value, key: featureKey, provision }, featureKey);
  // The SAME quote-resolution path every table cell uses: citable quotes ->
  // tagged .text -> a focused snippet of the provision's full_text. Handles
  // bare scalars too (the common case), unlike reading value.quotes directly.
  const quote = evidenceQuote(value, { provision });
  return (
    <div className="rec-term">
      <dt className="k">{humanizeKey(featureKey)}</dt>
      <dd className="v">
        {rendered}
        <EvidenceQuote text={quote} dense />
      </dd>
    </div>
  );
}

function FeatureGrid({ provision }) {
  const features = getStructuredFeatures(provision);
  if (!features) return null;
  const keys = Object.keys(features);
  if (keys.length === 0) return null;
  return (
    <dl className="rec-terms">
      {keys.map((k) => (
        <FeatureRow key={k} featureKey={k} value={features[k]} provision={provision} />
      ))}
    </dl>
  );
}

/* One constituent part: curated features at the TOP, full verbatim text
 * BELOW — the FB3 layout contract. `onSeeText` opens the Surface 2
 * document pop-under scoped to this part's own text. */
function PartCard({ part, dealId, isEdit, onSeeText, showHeader }) {
  const tHex = typeHex(part.type);
  const fav = favBadge(part.ai_favorability);
  const sectionNumber = getSectionNumber(part);
  return (
    <article className="rec-card">
      <div className="rec-card-body">
        {showHeader && (
          <div className="rec-card-meta">
            <span
              className="rec-chip-code"
              style={{ color: tHex, borderColor: tHex + '55' }}
            >
              {sectionNumber ? `§ ${sectionNumber}` : typeLabel(part.type)}
            </span>
            <span className="rec-card-cat">{part.category || 'General'}</span>
            <span className={`rec-fav-pill ${fav.cls}`}>{fav.label}</span>
            {isEdit && (
              <Link
                href={`/review/${dealId}?mode=edit&edit=${part.id}`}
                className="ml-auto text-[11px] font-ui text-accent hover:underline"
              >
                Edit &rarr;
              </Link>
            )}
          </div>
        )}

        <FeatureGrid provision={part} />

        {part.full_text && (
          <div className="rec-source">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-ui uppercase tracking-wider text-inkFaint">
                Full text
              </p>
              <button
                type="button"
                onClick={() => onSeeText({ provision: part, quote: part.full_text })}
                className="term-cell-seetext"
              >
                see in document
              </button>
            </div>
            <div className="rec-source-body">{part.full_text}</div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ProvisionCardPage() {
  const router = useRouter();
  const { id: dealId, provisionId } = router.query;
  const { isEdit } = useViewMode();
  const { deal, loading: dealLoading } = useDeal(dealId);
  const { provisions: rawProvisions, loading: provsLoading } = useProvisions({ deal_id: dealId });

  // Same choke point as the main review page (components/review/table-logic.js):
  // SECTION-LEFTOVER gating + [PROPOSED] category-prefix stripping outside
  // edit mode, so this standalone card page can't leak either behind the
  // main table view's back.
  const provisions = useMemo(
    () => filterProvisionsForViewMode(rawProvisions, isEdit),
    [rawProvisions, isEdit],
  );

  const target = useMemo(
    () => (provisions || []).find((p) => p.id === provisionId) || null,
    [provisions, provisionId],
  );

  const family = useMemo(() => {
    if (!target) return { isSplit: false, parts: [], parent: null };
    return buildProvisionFamily(target, provisions || []);
  }, [target, provisions]);

  /* ── Surface 2, reachable from this page too: "see in document" opens the
   *    same pop-under used in the table view. Fetched lazily (only once a
   *    part is actually shown) since this page's primary job is the card,
   *    not the raw document. ── */
  const [agreementSource, setAgreementSource] = useState(null);
  const [docSheet, setDocSheet] = useState({ open: false, provision: null, quote: null });
  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/agreement-source?deal_id=${dealId}`)
      .then((r) => r.json())
      .then((d) => setAgreementSource(d.agreement_source))
      .catch(() => {});
  }, [dealId]);

  const loading = dealLoading || provsLoading;
  const [collapsedWhole, setCollapsedWhole] = useState(true);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!deal || !target) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <EmptyState
          icon="?"
          title="Provision not found"
          description="This provision may have been deleted, or the link is out of date."
          action={
            <Link
              href={dealId ? `/review/${dealId}` : '/deals'}
              className="inline-block px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors"
            >
              &larr; Back to review
            </Link>
          }
        />
      </div>
    );
  }

  const dealLabel = `${deal.acquirer} / ${deal.target}`;
  const { isSplit, parts, parent } = family;
  const sectionNumber = getSectionNumber(target);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 md:px-0 space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Deals', href: '/deals' },
          { label: dealLabel, href: `/review/${dealId}` },
          { label: typeLabel(target.type) },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-ink">
            {sectionNumber ? `Section ${sectionNumber}` : typeLabel(target.type)} &mdash; {target.category || 'General'}
          </h1>
          <p className="text-sm text-inkLight font-ui mt-0.5">
            {typeLabel(target.type)}
            {isSplit && (
              <span className="ml-2 text-[11px] font-ui px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Reassembled from {parts.length} extracted parts
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/review/${dealId}${isEdit ? '?mode=edit' : ''}`}
          className="shrink-0 px-3 py-1.5 text-xs font-ui border border-border rounded hover:bg-bg transition-colors"
        >
          &larr; Back to review
        </Link>
      </div>

      {/* The provision AS A WHOLE — for a split provision this is a
          reassembled view of every constituent part in section order;
          collapsed by default (the parts below carry the real detail) but
          expandable so the lawyer can read the section as continuous prose. */}
      {isSplit && parent && (
        <div className="rec-card">
          <div className="rec-card-body">
            <button
              type="button"
              className={`rec-source-toggle${collapsedWhole ? '' : ' open'}`}
              onClick={() => setCollapsedWhole((v) => !v)}
            >
              <span className="car">&rsaquo;</span>
              {collapsedWhole ? 'Show full section text (reassembled)' : 'Hide full section text'}
            </button>
            {!collapsedWhole && (
              <div className="rec-source-body mt-2">{parent.full_text}</div>
            )}
          </div>
        </div>
      )}

      {/* Constituent parts — each gets the FB3 layout contract: curated
          features at the TOP, full verbatim text BELOW. */}
      <div className="space-y-4">
        {parts.map((part) => (
          <PartCard
            key={part.id}
            part={part}
            dealId={dealId}
            isEdit={isEdit}
            showHeader
            onSeeText={({ provision, quote }) => setDocSheet({ open: true, provision, quote })}
          />
        ))}
      </div>

      <DocPopUnder
        open={docSheet.open}
        dealId={dealId}
        provision={docSheet.provision}
        quote={docSheet.quote}
        sourceText={agreementSource && agreementSource.full_text}
        docTitle={agreementSource && agreementSource.title}
        isEdit={isEdit}
        onClose={() => setDocSheet({ open: false, provision: null, quote: null })}
      />
    </div>
  );
}
