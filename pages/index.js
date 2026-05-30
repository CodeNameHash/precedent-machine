import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals } from '../lib/useSupabaseData';

HomePage.noLayout = true;

export default function HomePage() {
  const { user } = useUser();
  const router = useRouter();
  const { deals, loading } = useDeals();
  const [selected, setSelected] = useState(() => new Set());
  const [counts, setCounts] = useState({}); // { [dealId]: number }
  const [countsLoading, setCountsLoading] = useState(false);

  // Fetch provision counts per deal in parallel once deals are loaded.
  useEffect(() => {
    if (!deals || deals.length === 0) return;
    let cancelled = false;
    setCountsLoading(true);
    Promise.all(
      deals.map((d) =>
        fetch(`/api/provisions?deal_id=${d.id}`)
          .then((r) => r.json())
          .then((j) => [d.id, (j.provisions || []).length])
          .catch(() => [d.id, 0])
      )
    ).then((entries) => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries));
      setCountsLoading(false);
    });
    return () => { cancelled = true; };
  }, [deals]);

  const totalProvisions = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts]
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
        <title>Precedent Machine</title>
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <TopBar user={user} />

        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '48px 40px 120px' }}>
          {/* Hero */}
          <div style={{ marginBottom: 36 }}>
            <div className="rec-deal-eyebrow">Precedent Machine</div>
            <h1 className="rec-deal-title" style={{ maxWidth: 720 }}>
              Cross-deal comparison for M&amp;A agreements
            </h1>
          </div>

          <div style={{ height: 1, background: 'var(--line)', margin: '0 0 28px' }} />

          {/* Deals panel */}
          <section
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 13,
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                padding: '16px 22px',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint)',
                }}
              >
                Deals
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)', alignSelf: 'center' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-faint)',
                }}
              >
                {loading ? '…' : `${deals.length} deal${deals.length === 1 ? '' : 's'}`}
                {!countsLoading && totalProvisions > 0 && (
                  <> · {totalProvisions} provisions</>
                )}
              </span>
            </header>

            <div style={{ padding: 22 }}>
              {loading ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                  }}
                >
                  <SkeletonDealCard />
                  <SkeletonDealCard />
                </div>
              ) : deals.length === 0 ? (
                <EmptyDeals />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                  }}
                >
                  {deals.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      selected={selected.has(d.id)}
                      onToggle={() => toggle(d.id)}
                      provisionCount={counts[d.id]}
                      countsLoading={countsLoading && counts[d.id] === undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

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
        Recital
        <span className="tag">Precedent</span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

/* ─── Deal card ─────────────────────────────────────────────── */
function DealCard({ deal, selected, onToggle, provisionCount, countsLoading }) {
  const date = deal.announce_date
    ? new Date(deal.announce_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--line)'}`,
        boxShadow: selected ? '0 0 0 1px var(--accent) inset' : 'none',
        borderRadius: 12,
        padding: '18px 18px 16px',
        cursor: 'pointer',
        transition: 'border-color .12s, box-shadow .12s, transform .12s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 168,
      }}
    >
      {/* Checkbox top-right */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--ink-faint)'}`,
          background: selected ? 'var(--accent)' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontSize: 12,
          lineHeight: 1,
          transition: 'all .12s',
        }}
      >
        {selected ? '✓' : ''}
      </span>

      {/* Eyebrow */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        {deal.agreement_type || 'Acquisition'}
        {date && <> · {date}</>}
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 19,
          lineHeight: 1.2,
          fontWeight: 500,
          letterSpacing: '-.01em',
          color: 'var(--ink)',
          paddingRight: 28, // avoid the checkbox
        }}
      >
        {deal.acquirer || 'Unknown'} <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>/</span>{' '}
        {deal.target || 'Unknown'}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 'auto' }}>
        <Meta label="Provisions" value={countsLoading ? '…' : provisionCount ?? '—'} />
        {deal.sector && <Meta label="Sector" value={deal.sector} />}
      </div>

      {/* Advisors (Stage 4) — small chip block, capped at 4. */}
      {Array.isArray(deal.metadata?.advisors) && deal.metadata.advisors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {deal.metadata.advisors.slice(0, 4).map((a, idx) => {
            const partyLabel =
              a.party === 'parent' ? 'P'
              : a.party === 'company' ? 'C'
              : a.party === 'special_committee' ? 'SC'
              : '';
            return (
              <span
                key={`${a.firm}-${a.party}-${idx}`}
                title={`${a.firm}${a.partner ? ' — ' + a.partner : ''} (${a.role}${a.party ? ', ' + a.party : ''})`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid var(--line)',
                  background: 'var(--paper)',
                  color: 'var(--ink-mid)',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.firm.replace(/, LLP$/, '').replace(/ LLP$/, '').split(',')[0]}
                {partyLabel && <span style={{ color: 'var(--ink-faint)' }}> · {partyLabel}</span>}
              </span>
            );
          })}
          {deal.metadata.advisors.length > 4 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--ink-faint)',
              padding: '2px 6px',
            }}>
              +{deal.metadata.advisors.length - 4} more
            </span>
          )}
        </div>
      )}

      {/* Review action + manage-ingest link (split pipeline entry) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, gap: 6 }}>
        <Link
          href={`/ingest?deal_id=${deal.id}`}
          onClick={(e) => e.stopPropagation()}
          title="Classify only, extract a specific type, or re-ingest"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-light)',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--line)',
            background: 'var(--paper)',
          }}
        >
          Manage ingest
        </Link>
        <Link
          href={`/review/${deal.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-deep)',
            textDecoration: 'none',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--line)',
            background: 'var(--paper)',
          }}
        >
          Review →
        </Link>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-mid)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SkeletonDealCard() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 18,
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ height: 10, width: '40%', background: 'var(--line-soft)', borderRadius: 4 }} />
      <div style={{ height: 18, width: '70%', background: 'var(--line)', borderRadius: 4 }} />
      <div style={{ height: 14, width: '55%', background: 'var(--line-soft)', borderRadius: 4 }} />
      <div style={{ height: 14, width: '35%', background: 'var(--line-soft)', borderRadius: 4 }} />
    </div>
  );
}

function EmptyDeals() {
  return (
    <div style={{ padding: '36px 12px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          color: 'var(--ink-mid)',
          marginBottom: 8,
        }}
      >
        No deals ingested yet
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-light)', maxWidth: 460, margin: '0 auto' }}>
        Use the ingest pipeline (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          POST /api/ingest/segment-v2
        </code>) to parse a merger agreement and seed your first deal. See{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>HANDOFF.md</code> for the
        full pipeline.
      </p>
    </div>
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
