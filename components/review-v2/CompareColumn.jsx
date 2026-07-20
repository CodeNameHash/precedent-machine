// Review page compare mode (Ben: "just the normal deal review page but with
// an extra column in the main review area for the added deal(s) — literally
// just bold it on the side"). One narrow column per compared deal beside
// each primary section, rendering the SAME section config through the SAME
// ProvisionTable / MaeSection / DefinitionsSection / ElectionCard the
// primary column uses — read-only (no card selection: the corpus sidebar
// stays scoped to the primary deal).

import Link from 'next/link';
import ProvisionTable from '../review/ProvisionTable';
import MaeSection from './MaeSection';
import ElectionCard from './ElectionCard';
import { DefinitionsSection } from './ProvisionIndex';
import { deriveElectionSummary, EMPTY_REVIEW_DEAL, MAE_SECTION_ID } from './sectionList';

const CONSIDERATION_SECTION_ID = 'consideration-hero';

// Bold column header band — styled like the section title bars' meta labels
// (10px, tracking) but font-weight 700 with the deal name in sentence case.
// The Market column passes `uppercase` for its all-caps "MARKET" band.
export function ColumnHeaderBand({ label, href = null, uppercase = false }) {
  const text = (
    <span
      className={`text-[10px] font-bold tracking-[0.08em] text-[#1F1F1F] ${uppercase ? 'uppercase tracking-[0.14em]' : ''}`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex items-center pb-2 mb-4 border-b-2 border-black" data-testid="compare-column-band">
      {href ? (
        <Link href={href} className="hover:underline min-w-0 truncate">{text}</Link>
      ) : text}
    </div>
  );
}

function EmptyBox({ children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em]">{children}</p>
    </div>
  );
}

// C (deal-to-market/compare robustness, Supabase-degraded incident): a
// failed compared-deal fetch used to be a dead end -- "Deal unavailable: …"
// with no way to try again short of reloading the whole review page. Now
// that compareData.js's useComparedDeals bounds the fetch with a timeout
// and exposes retry(), give the column a working retry affordance.
function ErrorBox({ onRetry, children }) {
  return (
    <div className="border border-[#E0E0E0] bg-white px-3 py-4">
      <p className="mtx-meta-label text-[9px] tracking-[0.14em] text-[#B14E63] mb-1.5">{children}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2F6DB5] hover:underline"
          data-testid="compare-column-retry"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function sectionRowCount(section, reviewDeal) {
  if (!section || !reviewDeal) return 0;
  if (section.id === '__definitions') return (reviewDeal.definitions || []).length;
  if (!section.config || typeof section.config.selectRows !== 'function') return 0;
  try {
    const rows = section.config.selectRows(reviewDeal);
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

// One compared-deal cell for one section. `column` comes straight from
// useComparedDeals: { id, name, reviewDeal, loading, error }.
export default function CompareSectionColumn({ section, column, onRetry }) {
  if (!column) return null;
  if (column.loading) return <EmptyBox>Loading deal…</EmptyBox>;
  if (column.error) return <ErrorBox onRetry={onRetry}>Deal data unavailable right now — retry</ErrorBox>;
  const reviewDeal = column.reviewDeal || EMPTY_REVIEW_DEAL;
  if (sectionRowCount(section, reviewDeal) === 0) {
    // Standard empty state: the section box exists (alignment holds) but
    // says plainly that this deal has nothing extracted here.
    return <EmptyBox>No extracted provisions for this section.</EmptyBox>;
  }
  if (section.id === '__definitions') {
    return <DefinitionsSection definitions={reviewDeal.definitions} />;
  }
  if (section.id === MAE_SECTION_ID) {
    return <MaeSection config={section.config} reviewDeal={reviewDeal} />;
  }
  const election = section.id === CONSIDERATION_SECTION_ID ? deriveElectionSummary(reviewDeal) : null;
  return (
    <>
      {election ? <ElectionCard election={election} /> : null}
      <ProvisionTable config={section.config} reviewDeal={reviewDeal} isEdit={false} />
    </>
  );
}
