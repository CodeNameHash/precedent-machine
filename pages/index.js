import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals } from '../lib/useSupabaseData';
import { getDisplayAdvisors } from '../lib/canonical-advisors';

HomePage.noLayout = true;

/* Compact deal-value format: 9420000000 → "$9.4B", 137500000 → "$137.5M". */
function fmtValue(v) {
  const n = typeof v === 'number' ? v : v ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const trim = (x) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (n >= 1e9) return `$${trim(n / 1e9)}B`;
  if (n >= 1e6) return `$${trim(n / 1e6)}M`;
  if (n >= 1e3) return `$${trim(n / 1e3)}K`;
  return `$${n}`;
}

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const EM_DASH = '—';

export default function HomePage() {
  const { user } = useUser();
  const router = useRouter();
  const { deals, loading } = useDeals();
  const [selected, setSelected] = useState(() => new Set());
  const [counts, setCounts] = useState({}); // { [dealId]: number }
  const [countsLoading, setCountsLoading] = useState(false);

  // Filters + sort
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('');
  const [firm, setFirm] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

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

  // Enrich each deal with display names + CANONICALIZED advisors (read-time
  // canon layer over metadata.advisors_v2 — see lib/canonical-advisors.js).
  const rows = useMemo(
    () =>
      (deals || []).map((d) => {
        const meta = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
        const adv = getDisplayAdvisors(meta);
        return {
          id: d.id,
          date: d.announce_date || null,
          buyer: meta.acquirer_display || meta.parent_entity || d.acquirer || null,
          seller: meta.target_display || d.target || null,
          value: d.value_usd,
          industry: d.sector || null,
          buyerFirms: adv.buyerFirms,
          buyerLawyers: adv.buyerLawyers,
          sellerFirms: adv.sellerFirms,
          sellerLawyers: adv.sellerLawyers,
        };
      }),
    [deals]
  );

  const industries = useMemo(
    () => [...new Set(rows.map((r) => r.industry).filter(Boolean))].sort(),
    [rows]
  );
  const firms = useMemo(
    () => [...new Set(rows.flatMap((r) => [...r.buyerFirms, ...r.sellerFirms]))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) =>
        [r.buyer, r.seller, ...r.buyerFirms, ...r.sellerFirms, ...r.buyerLawyers, ...r.sellerLawyers]
          .some((s) => s && s.toLowerCase().includes(q))
      );
    }
    if (industry) out = out.filter((r) => r.industry === industry);
    if (firm) out = out.filter((r) => r.buyerFirms.includes(firm) || r.sellerFirms.includes(firm));
    return out;
  }, [rows, query, industry, firm]);

  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r) => {
      if (sort.key === 'value') {
        const n = typeof r.value === 'number' ? r.value : r.value ? Number(r.value) : NaN;
        return Number.isFinite(n) ? n : null;
      }
      return r.date ? new Date(r.date).getTime() : null;
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // nulls last regardless of direction
      if (vb === null) return -1;
      return (va - vb) * dir;
    });
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  };

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
        <title>Recital</title>
      </Head>

      <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
        <TopBar user={user} />

        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 40px 120px' }}>
          {/* Hero */}
          <div style={{ marginBottom: 36 }}>
            <div className="rec-deal-eyebrow">Recital</div>
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

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 px-[22px] py-3 border-b border-border">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by party, firm, or lawyer…"
                aria-label="Filter deals"
                className="font-ui text-xs px-2.5 py-1.5 rounded border border-border bg-white text-ink placeholder:text-inkFaint focus:outline-none focus:border-accent w-64"
              />
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                aria-label="Filter by industry"
                className="font-ui text-xs px-2 py-1.5 rounded border border-border bg-white text-ink focus:outline-none focus:border-accent"
              >
                <option value="">All industries</option>
                {industries.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                aria-label="Filter by law firm"
                className="font-ui text-xs px-2 py-1.5 rounded border border-border bg-white text-ink focus:outline-none focus:border-accent"
              >
                <option value="">All firms</option>
                {firms.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {(query || industry || firm) && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setIndustry(''); setFirm(''); }}
                  className="font-ui text-xs text-inkLight hover:text-ink underline decoration-dotted"
                >
                  Clear
                </button>
              )}
              <span className="ml-auto font-mono text-[11px] text-inkFaint">
                {loading ? '' : `${sorted.length} of ${rows.length}`}
              </span>
            </div>

            {loading ? (
              <SkeletonTable />
            ) : deals.length === 0 ? (
              <EmptyDeals />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-xs font-ui">
                  <thead className="bg-bg/60 border-b border-border">
                    <tr>
                      <th className="px-3 py-2 w-8" aria-label="Select for comparison" />
                      <SortTh label="Date" active={sort.key === 'date'} dir={sort.dir} onClick={() => toggleSort('date')} />
                      <Th>Buyer</Th>
                      <Th>Seller</Th>
                      <SortTh label="Value" active={sort.key === 'value'} dir={sort.dir} onClick={() => toggleSort('value')} />
                      <Th>Industry</Th>
                      <Th>Buyer Firm</Th>
                      <Th>Buyer Lawyers</Th>
                      <Th>Seller Firm</Th>
                      <Th>Seller Lawyers</Th>
                      <th className="px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center italic text-inkFaint">
                          No deals match the current filters.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((r) => (
                        <DealRow
                          key={r.id}
                          row={r}
                          selected={selected.has(r.id)}
                          onToggle={() => toggle(r.id)}
                          onOpen={() => router.push(`/review/${r.id}`)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
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

/* ─── Table cells ───────────────────────────────────────────── */
function Th({ children }) {
  return (
    <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  );
}

function SortTh({ label, active, dir, onClick }) {
  return (
    <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink ${active ? 'text-ink' : ''}`}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        <span aria-hidden="true" className={active ? 'text-accent' : 'text-inkFaint/60'}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▾'}
        </span>
      </button>
    </th>
  );
}

function Dash() {
  return <span className="text-inkFaint/70">{EM_DASH}</span>;
}

function DealRow({ row, selected, onToggle, onOpen }) {
  const date = fmtDate(row.date);
  const value = fmtValue(row.value);
  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      tabIndex={0}
      className="hover:bg-bg/40 transition-colors cursor-pointer"
    >
      <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label="Select deal for comparison"
          className="accent-[var(--accent)] cursor-pointer"
        />
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-inkMid">
        {date || <Dash />}
      </td>
      <td className="px-3 py-2 align-top font-semibold text-ink max-w-[240px]">
        {row.buyer || <Dash />}
      </td>
      <td className="px-3 py-2 align-top font-semibold text-ink max-w-[240px]">
        {row.seller || <Dash />}
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-ink">
        {value || <Dash />}
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-inkMid">
        {row.industry || <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-ink max-w-[240px]">
        {row.buyerFirms.length ? row.buyerFirms.join('; ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-inkMid max-w-[240px]">
        {row.buyerLawyers.length ? row.buyerLawyers.join(', ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-ink max-w-[240px]">
        {row.sellerFirms.length ? row.sellerFirms.join('; ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top text-inkMid max-w-[240px]">
        {row.sellerLawyers.length ? row.sellerLawyers.join(', ') : <Dash />}
      </td>
      <td className="px-3 py-2 align-top whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
        <Link
          href={`/ingest?deal_id=${row.id}`}
          title="Classify only, extract a specific type, or re-ingest"
          className="font-mono text-[10px] uppercase tracking-wider text-inkLight hover:text-accentDeep"
        >
          Ingest
        </Link>
      </td>
    </tr>
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

function SkeletonTable() {
  return (
    <div className="p-[22px] space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-3 rounded bg-lineSoft" style={{ width: '10%' }} />
          <div className="h-3 rounded bg-line" style={{ width: '18%' }} />
          <div className="h-3 rounded bg-line" style={{ width: '18%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '8%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '14%' }} />
          <div className="h-3 rounded bg-lineSoft" style={{ width: '14%' }} />
        </div>
      ))}
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
