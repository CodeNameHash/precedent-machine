import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals } from '../lib/useSupabaseData';
import { getDisplayAdvisors } from '../lib/canonical-advisors';
import { getDisplayAcquirer, getDisplayTarget } from '../lib/deal-display';
import DealsTable from '../components/DealsTable';
import { headlineConsiderationLabel } from '../components/review/table-logic';

HomePage.noLayout = true;

export default function HomePage() {
  const { user } = useUser();
  const router = useRouter();
  const { deals, loading } = useDeals();
  const [selected, setSelected] = useState(() => new Set());

  const totalProvisions = useMemo(
    () => (deals || []).reduce((sum, deal) => sum + (Number(deal.provision_count) || 0), 0),
    [deals]
  );

  // Enrich each deal with display names + CANONICALIZED advisors (read-time
  // canon layer over metadata.advisors_v2 — see lib/canonical-advisors.js).
  const rows = useMemo(
    () =>
      (deals || []).map((d) => {
        const meta = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
        const adv = getDisplayAdvisors(meta);
        const rawConsideration = meta.headlineConsiderationType || meta.headline_consideration_type || meta.considerationType || meta.consideration_type || null;
        const consideration = headlineConsiderationLabel(rawConsideration) || rawConsideration || null;
        return {
          id: d.id,
          date: d.announce_date || null,
          ultimateParent: getDisplayAcquirer(d),
          buyer: getDisplayAcquirer(d),
          seller: getDisplayTarget(d),
          value: d.value_usd,
          consideration,
          industry: d.sector || null,
          buyerFirms: adv.buyerFirms,
          buyerLawyers: adv.buyerLawyers,
          sellerFirms: adv.sellerFirms,
          sellerLawyers: adv.sellerLawyers,
        };
      }),
    [deals]
  );

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goCompare = () => {
    if (selected.size < 2) return;
    // Preserve deal order from the loaded list so the URL is deterministic.
    const ids = deals.filter((d) => selected.has(d.id)).map((d) => d.id);
    router.push(`/compare?ids=${ids.join(',')}`);
  };

  return (
    <>
      <Head>
        <title>Corpus</title>
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <TopBar user={user} />

        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 40px 120px' }}>

          <DealsTable
            rows={rows}
            loading={loading}
            dealsCount={deals.length}
            totalProvisions={totalProvisions}
            countsLoading={loading}
            selected={selected}
            onToggle={toggle}
            onOpen={(id) => router.push(`/review/${id}`)}
          />

          {/* Compare CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
            <CompareButton
              count={selected.size}
              disabled={selected.size < 2}
              onClick={goCompare}
            />
          </div>
        </main>
      </div>
    </>
  );
}

/* ─── Top bar ───────────────────────────────────────────────── */
function TopBar({ user }) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        padding: '0 22px',
      }}
    >
      <Link href="/" className="rec-wordmark">
        <span className="mark" />
        Corpus
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/search"
          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)', textDecoration: 'none' }}
        >
          Search precedents
        </Link>
        {user && (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>{user.name}</span>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                color: 'var(--accent-deep)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.02em',
              }}
            >
              {(user.name || 'U')
                .split(/\s+/)
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

function CompareButton({ count, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '-.005em',
        padding: '12px 22px',
        borderRadius: 9,
        border: '1px solid',
        borderColor: disabled ? 'var(--line)' : 'var(--accent-deep)',
        background: disabled ? 'var(--surface)' : 'var(--accent)',
        color: disabled ? 'var(--ink-faint)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .12s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {disabled
        ? count === 0
          ? 'Select 2 or more deals to compare'
          : 'Select at least one more deal'
        : `Compare ${count} selected deals`}
      <span aria-hidden="true">→</span>
    </button>
  );
}
