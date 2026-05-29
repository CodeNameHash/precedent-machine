import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals, useProvisions } from '../lib/useSupabaseData';
import { SIDEBAR_GROUPS, typeHex, sidebarTypeOrder } from '../lib/sidebar-groups';

ComparePage.noLayout = true;

/* The "All" pseudo-filter is the default selection. */
const ALL = '__ALL__';

export default function ComparePage() {
  const router = useRouter();
  const { user } = useUser();
  const { deals: allDeals, loading: dealsLoading } = useDeals();

  // Parse selected deal ids from URL.
  const idList = useMemo(() => {
    const raw = router.query.ids;
    if (!raw) return [];
    const s = Array.isArray(raw) ? raw[0] : raw;
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }, [router.query.ids]);

  // Active sidebar filter: either ALL, a group label (parent), or a single type code.
  const [activeFilter, setActiveFilter] = useState({ kind: 'all' });

  // Resolve the deal objects (preserve URL order).
  const selectedDeals = useMemo(() => {
    if (!allDeals || allDeals.length === 0) return [];
    const byId = Object.fromEntries(allDeals.map((d) => [d.id, d]));
    return idList.map((id) => byId[id]).filter(Boolean);
  }, [allDeals, idList]);

  const removeDeal = (id) => {
    const next = idList.filter((x) => x !== id);
    if (next.length === 0) {
      router.push('/');
    } else {
      router.replace({ pathname: '/compare', query: { ids: next.join(',') } }, undefined, {
        shallow: true,
      });
    }
  };

  return (
    <>
      <Head>
        <title>Compare deals · Precedent Machine</title>
      </Head>

      <div
        className="flex flex-col"
        style={{ minHeight: '100vh', background: 'var(--paper)' }}
      >
        <TopBar user={user} />

        {/* Back + chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 22px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-light)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Back
          </Link>
          <span style={{ color: 'var(--line)' }}>|</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
            }}
          >
            Comparing
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedDeals.map((d) => (
              <DealChip key={d.id} deal={d} onRemove={() => removeDeal(d.id)} />
            ))}
            {selectedDeals.length === 0 && !dealsLoading && (
              <span style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>No deals selected.</span>
            )}
          </div>
        </div>

        {/* Main split */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {selectedDeals.length > 0 ? (
            <CompareBody
              deals={selectedDeals}
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
            />
          ) : (
            <div style={{ flex: 1, padding: '60px 40px', textAlign: 'center' }}>
              <p style={{ color: 'var(--ink-light)', fontSize: 14 }}>
                {dealsLoading ? 'Loading deals…' : (
                  <>
                    Pick deals on the{' '}
                    <Link href="/" style={{ color: 'var(--accent-deep)' }}>
                      home page
                    </Link>{' '}
                    to start a comparison.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Top bar (mirrors review/[id].js) ──────────────────────── */
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

function DealChip({ deal, onRemove }) {
  const label = `${deal.acquirer || '?'} / ${deal.target || '?'}`;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 4px 4px 10px',
        background: 'var(--accent-soft)',
        color: 'var(--accent-deep)',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          width: 18,
          height: 18,
          border: 'none',
          background: 'transparent',
          color: 'var(--accent-deep)',
          cursor: 'pointer',
          borderRadius: '50%',
          fontSize: 12,
          lineHeight: 1,
          display: 'grid',
          placeItems: 'center',
        }}
        title="Remove from comparison"
      >
        ✕
      </button>
    </span>
  );
}

/* ─── Body: sidebar + columns ──────────────────────────────── */
function CompareBody({ deals, activeFilter, setActiveFilter }) {
  // Fan-out one useProvisions per deal. Hooks must be called unconditionally,
  // so we cap to a reasonable upper bound and slice — in practice the user
  // selects 2-4 deals, never enough to brush against this.
  const MAX_DEALS = 8;
  const slots = Array.from({ length: MAX_DEALS }, (_, i) => deals[i]);
  /* eslint-disable react-hooks/rules-of-hooks */
  const provisionResults = slots.map((d) => useProvisions({ deal_id: d?.id }));
  /* eslint-enable react-hooks/rules-of-hooks */

  const dealProvisions = deals.map((_, i) => provisionResults[i]);

  // Aggregate counts by type across all selected deals — drives sidebar visibility.
  const countsByType = useMemo(() => {
    const out = {};
    for (const dp of dealProvisions) {
      for (const p of dp.provisions || []) {
        const t = p.type || 'OTHER';
        out[t] = (out[t] || 0) + 1;
      }
    }
    return out;
  }, [dealProvisions]);

  const totalProvisions = useMemo(
    () => Object.values(countsByType).reduce((a, b) => a + b, 0),
    [countsByType]
  );

  return (
    <>
      <CompareSidebar
        countsByType={countsByType}
        totalProvisions={totalProvisions}
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          padding: '24px 24px 80px',
        }}
      >
        <FilterHeader activeFilter={activeFilter} countsByType={countsByType} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${deals.length}, minmax(280px, 1fr))`,
            gap: 18,
            marginTop: 18,
          }}
        >
          {deals.map((deal, i) => (
            <DealColumn
              key={deal.id}
              deal={deal}
              provisions={dealProvisions[i].provisions || []}
              loading={dealProvisions[i].loading}
              activeFilter={activeFilter}
            />
          ))}
        </div>
      </main>
    </>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────── */
function CompareSidebar({ countsByType, totalProvisions, activeFilter, onChange }) {
  // Build the visible group list — skip empty groups so the sidebar isn't noisy.
  const visibleGroups = useMemo(() => {
    return SIDEBAR_GROUPS.map((g) => {
      if (g.children) {
        const presentChildren = g.children
          .map((c) => ({ ...c, count: countsByType[c.type] || 0 }))
          .filter((c) => c.count > 0);
        const total = presentChildren.reduce((a, c) => a + c.count, 0);
        return { ...g, presentChildren, total };
      }
      const types = (g.types || []).filter((t) => (countsByType[t] || 0) > 0);
      const total = types.reduce((a, t) => a + (countsByType[t] || 0), 0);
      return { ...g, presentTypes: types, total };
    }).filter((g) => g.total > 0);
  }, [countsByType]);

  const isActive = (kind, value) => {
    if (kind === 'all') return activeFilter.kind === 'all';
    if (kind === 'group') return activeFilter.kind === 'group' && activeFilter.label === value;
    if (kind === 'type') return activeFilter.kind === 'type' && activeFilter.type === value;
    return false;
  };

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        padding: '18px 14px',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '0 8px 10px' }}>
        <span className="rec-side-eyebrow">Provisions</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => onChange({ kind: 'all' })}
          className={`rec-side-item${isActive('all') ? ' active' : ''}`}
        >
          <span
            className="dot"
            style={{ background: isActive('all') ? 'var(--accent)' : 'var(--ink-faint)' }}
          />
          <span style={{ fontWeight: 600 }}>All provisions</span>
          <span className="count">{totalProvisions}</span>
        </button>

        {visibleGroups.map((g) => {
          if (g.children) {
            const groupActive = isActive('group', g.label);
            return (
              <div key={g.label} style={{ marginTop: 4 }}>
                <button
                  onClick={() => onChange({ kind: 'group', label: g.label })}
                  className={`rec-side-item${groupActive ? ' active' : ''}`}
                >
                  <span
                    className="dot"
                    style={{ background: typeHex(g.presentChildren[0]?.type || 'OTHER') }}
                  />
                  <span style={{ flex: 1 }}>{g.label}</span>
                  <span className="count">{g.total}</span>
                </button>
                <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {g.presentChildren.map((c) => (
                    <button
                      key={c.type}
                      onClick={() => onChange({ kind: 'type', type: c.type, label: c.label })}
                      className={`rec-side-item${isActive('type', c.type) ? ' active' : ''}`}
                      style={{ fontSize: 12.5, padding: '5px 10px' }}
                    >
                      <span className="dot" style={{ background: typeHex(c.type) }} />
                      <span style={{ flex: 1 }}>{c.label}</span>
                      <span className="count">{c.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          // Flat single-type group (or multi-type aggregated group)
          const groupActive = isActive('group', g.label);
          const repColor = typeHex(g.presentTypes[0] || 'OTHER');
          return (
            <button
              key={g.label}
              onClick={() => onChange({ kind: 'group', label: g.label })}
              className={`rec-side-item${groupActive ? ' active' : ''}`}
            >
              <span className="dot" style={{ background: repColor }} />
              <span style={{ flex: 1 }}>{g.label}</span>
              <span className="count">{g.total}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

/* ─── Filter heading above the columns ─────────────────────── */
function FilterHeader({ activeFilter, countsByType }) {
  let label = 'All Provisions';
  let sub = 'All extracted provisions across the selected deals';
  let color = 'var(--accent)';

  if (activeFilter.kind === 'group') {
    label = activeFilter.label;
    const group = SIDEBAR_GROUPS.find((g) => g.label === activeFilter.label);
    if (group) {
      const types = group.children ? group.children.map((c) => c.type) : group.types || [];
      const rep = types[0] || 'OTHER';
      color = typeHex(rep);
      sub = group.children
        ? `${types.length} sub-types · ${types.reduce((a, t) => a + (countsByType[t] || 0), 0)} provisions`
        : `${types.reduce((a, t) => a + (countsByType[t] || 0), 0)} provisions`;
    }
  } else if (activeFilter.kind === 'type') {
    label = activeFilter.label || activeFilter.type;
    color = typeHex(activeFilter.type);
    sub = `${countsByType[activeFilter.type] || 0} provisions of type ${activeFilter.type}`;
  }

  return (
    <div className="rec-type-head" style={{ margin: '4px 0 0' }}>
      <span className="th-dot" style={{ background: color }} />
      <h2>{label}</h2>
      <span className="ct">{sub}</span>
      <span className="rule" />
    </div>
  );
}

/* ─── Single deal column ───────────────────────────────────── */
function DealColumn({ deal, provisions, loading, activeFilter }) {
  // Filter and sort.
  const order = useMemo(() => sidebarTypeOrder(), []);

  const filtered = useMemo(() => {
    let list = provisions || [];
    if (activeFilter.kind === 'group') {
      const group = SIDEBAR_GROUPS.find((g) => g.label === activeFilter.label);
      if (group) {
        const types = group.children ? group.children.map((c) => c.type) : group.types || [];
        const set = new Set(types);
        list = list.filter((p) => set.has(p.type));
      }
    } else if (activeFilter.kind === 'type') {
      list = list.filter((p) => p.type === activeFilter.type);
    }
    // Stable sort by sidebar order, then preserve original order for ties.
    return [...list].sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [provisions, activeFilter, order]);

  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--paper)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            marginBottom: 2,
          }}
        >
          {deal.agreement_type || 'Acquisition'}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-.01em',
            color: 'var(--ink)',
          }}
        >
          {deal.acquirer} <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>/</span>{' '}
          {deal.target}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-faint)',
            marginTop: 4,
          }}
        >
          {loading ? '…' : `${filtered.length} provision${filtered.length === 1 ? '' : 's'}`}
        </div>
      </header>

      <div style={{ padding: '10px 10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <ProvisionSkeleton />
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '24px 10px',
              textAlign: 'center',
              fontSize: 12.5,
              color: 'var(--ink-faint)',
              fontStyle: 'italic',
            }}
          >
            No provisions in this category.
          </div>
        ) : (
          filtered.map((p) => <ProvisionCard key={p.id} provision={p} dealId={deal.id} />)
        )}
      </div>
    </section>
  );
}

function ProvisionSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--line-soft)',
            borderRadius: 8,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ height: 10, width: '40%', background: 'var(--line)', borderRadius: 4 }} />
          <div style={{ height: 12, width: '80%', background: 'var(--line-soft)', borderRadius: 4 }} />
          <div style={{ height: 12, width: '60%', background: 'var(--line-soft)', borderRadius: 4 }} />
        </div>
      ))}
    </>
  );
}

/* ─── Provision card ──────────────────────────────────────── */
const FAV_META = {
  'strong-buyer':  { label: 'Strong Buyer',  hue: 'var(--buyer)' },
  'mod-buyer':     { label: 'Mod. Buyer',    hue: 'var(--buyer)' },
  'buyer':         { label: 'Buyer',         hue: 'var(--buyer)' },
  'neutral':       { label: 'Balanced',      hue: 'var(--neutral)' },
  'mod-seller':    { label: 'Mod. Seller',   hue: 'var(--seller)' },
  'strong-seller': { label: 'Strong Seller', hue: 'var(--seller)' },
  'seller':        { label: 'Seller',        hue: 'var(--seller)' },
};

function favMeta(fav) {
  return FAV_META[(fav || '').toLowerCase()] || FAV_META.neutral;
}

function ProvisionCard({ provision, dealId }) {
  const router = useRouter();
  const fav = favMeta(provision.ai_favorability);
  const hexColor = typeHex(provision.type);

  const onOpen = () => {
    router.push(`/review/${dealId}?provision=${provision.id}`);
  };

  const text = (provision.full_text || '').trim();

  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderLeft: `3px solid ${hexColor}`,
        borderRadius: 8,
        padding: '11px 13px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 14px -10px rgba(40,30,10,.4)';
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, var(--line))';
        e.currentTarget.style.borderLeftColor = hexColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = 'var(--line)';
        e.currentTarget.style.borderLeftColor = hexColor;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.06em',
            color: 'var(--ink-light)',
            padding: '1.5px 6px',
            borderRadius: 4,
            border: '1px solid var(--line)',
            background: 'var(--paper)',
          }}
        >
          {provision.type}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink-mid)',
            letterSpacing: '-.005em',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={provision.category || ''}
        >
          {provision.category || 'General'}
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: fav.hue,
            padding: '1.5px 6px',
            borderRadius: 999,
            background: `color-mix(in srgb, ${fav.hue} 12%, transparent)`,
            whiteSpace: 'nowrap',
          }}
        >
          {fav.label}
        </span>
      </div>
      {text && (
        <div
          className="line-clamp-3"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 12.5,
            lineHeight: 1.45,
            color: 'var(--ink-light)',
          }}
        >
          {text}
        </div>
      )}
    </button>
  );
}
