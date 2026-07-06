import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

NewHomePage.noLayout = true;

function encodePayload(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 10e9 ? 0 : 1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(date) {
  if (!date) return '-';
  return String(date).slice(0, 7);
}

function queryHref(kind, payload) {
  return `/newhome/query/${kind}/adhoc?payload=${encodePayload(payload)}`;
}

export default function NewHomePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ sector: '', year: '', size: '' });
  const [sort, setSort] = useState('signing_desc');
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    fetch('/api/newhome')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    setFilters({
      sector: typeof router.query.sector === 'string' ? router.query.sector : '',
      year: typeof router.query.year === 'string' ? router.query.year : '',
      size: typeof router.query.size === 'string' ? router.query.size : '',
    });
    setSort(typeof router.query.sort === 'string' ? router.query.sort : 'signing_desc');
  }, [router.isReady]);

  useEffect(() => {
    if (!router.isReady) return;
    const query = {};
    if (filters.sector) query.sector = filters.sector;
    if (filters.year) query.year = filters.year;
    if (filters.size) query.size = filters.size;
    if (sort !== 'signing_desc') query.sort = sort;
    const same = Object.keys(query).length === Object.keys(router.query).length &&
      Object.keys(query).every((key) => router.query[key] === query[key]);
    if (!same) router.replace({ pathname: '/newhome', query }, undefined, { shallow: true });
  }, [filters, sort, router.isReady]);

  const deals = data?.deals || [];
  const years = useMemo(() => [...new Set(deals.map((deal) => deal.signing_date && String(deal.signing_date).slice(0, 4)).filter(Boolean))].sort().reverse(), [deals]);
  const sectors = useMemo(() => [...new Set(deals.map((deal) => deal.sector).filter(Boolean))].sort(), [deals]);
  const sizes = ['<$1B', '$1B-$10B', '>$10B'];

  const visibleDeals = useMemo(() => {
    const rows = deals.filter((deal) => {
      if (filters.sector && deal.sector !== filters.sector) return false;
      if (filters.year && String(deal.signing_date || '').slice(0, 4) !== filters.year) return false;
      if (filters.size && deal.value_band !== filters.size) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === 'value_desc') return Number(b.value || 0) - Number(a.value || 0);
      if (sort === 'value_asc') return Number(a.value || 0) - Number(b.value || 0);
      if (sort === 'name_asc') return a.deal_name.localeCompare(b.deal_name);
      return String(b.signing_date || '').localeCompare(String(a.signing_date || ''));
    });
  }, [deals, filters, sort]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (data?.search_index || [])
      .filter((hit) => `${hit.label} ${hit.detail}`.toLowerCase().includes(q))
      .slice(0, 15);
  }, [search, data]);

  const selectedIds = [...selected].filter((id) => deals.some((deal) => deal.id === id));
  const compareHref = queryHref('deal-compare', {
    deal_ids: selectedIds.slice(0, 4),
    provision_types: ['CONSIDERATION', 'COVENANT_NO_SOLICITATION', 'TERMINATION_FEE', 'TERMINATION_RIGHT'],
    highlight_deltas: true,
    included_field_groups: ['primary', 'qualifiers'],
  });
  const crossCutHref = queryHref('provision-cross-cut', {
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: null,
    deal_ids: selectedIds,
    columns: ['no_shop_type', 'fiduciary_out', 'go_shop', 'matching_rights_days'],
    sort_by: 'deal_signing_date_desc',
  });

  function submitSearch(e) {
    e.preventDefault();
    const first = suggestions[0];
    if (first) router.push(first.href);
    else if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <>
      <Head>
        <title>Corpus New Home</title>
      </Head>
      <div className="nh">
        <header className="top">
          <Link href="/newhome" className="brand"><span />Corpus</Link>
          <form className="search" onSubmit={submitSearch}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals, provisions, defined terms" />
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((hit, index) => (
                  <button key={`${hit.type}-${hit.href}-${index}`} type="button" onClick={() => router.push(hit.href)}>
                    <b>{hit.label}</b>
                    <small>{hit.type} · {hit.detail}</small>
                  </button>
                ))}
              </div>
            )}
          </form>
          <Link href="/newhome/library" className="nav">Library</Link>
          <span className="login">Login</span>
        </header>

        {error ? <main className="wrap"><div className="empty">{error}</div></main> : (
          <main>
            <section className="editorial">
              <div className="wrap">
                <div className="sectionHead">
                  <h1>Featured queries</h1>
                  <p>Cross-deal outputs from the current corpus.</p>
                </div>
                <div className="tiles">
                  {(data?.featured_queries || Array.from({ length: 6 })).map((query, index) => query ? (
                    <Link key={query.id} href={query.disabled ? '/newhome' : query.href} className={`tile ${query.disabled ? 'disabled' : ''}`}>
                      <small>{query.query_kind.replace(/_/g, ' ')}</small>
                      <strong>{query.title}</strong>
                      <span>{query.preview}</span>
                    </Link>
                  ) : <div key={index} className="tile loading" />)}
                </div>

                <div className="sectionHead snapshotsHead">
                  <h2>Market snapshots</h2>
                  <p>Live-computed from populated structured fields.</p>
                </div>
                <div className="snapshots">
                  {(data?.market_snapshots || Array.from({ length: 6 })).map((snap, index) => snap ? (
                    <Link key={snap.title} href={snap.href || '/newhome'} className="snapshot">
                      <small>{snap.provision_type.replace(/_/g, ' ')}</small>
                      <strong>{snap.title}</strong>
                      <SnapshotBody snap={snap} />
                    </Link>
                  ) : <div key={index} className="snapshot loading" />)}
                </div>
              </div>
            </section>

            <section className="operational">
              <div className="wrap">
                <div className="opsHead">
                  <div>
                    <h2>Deals ({deals.length})</h2>
                    <p>{visibleDeals.length} visible</p>
                  </div>
                  <div className="filters">
                    <select value={filters.sector} onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}>
                      <option value="">Sector</option>
                      {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
                    </select>
                    <select value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}>
                      <option value="">Year</option>
                      {years.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <select value={filters.size} onChange={(e) => setFilters((f) => ({ ...f, size: e.target.value }))}>
                      <option value="">Size</option>
                      {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                    <select value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="signing_desc">Newest</option>
                      <option value="value_desc">Value high</option>
                      <option value="value_asc">Value low</option>
                      <option value="name_asc">Name</option>
                    </select>
                    <div className="newQuery">
                      <button type="button" onClick={() => setNewOpen((v) => !v)}>+ New query</button>
                      {newOpen && <NewQueryMenu deals={deals} />}
                    </div>
                  </div>
                </div>

                {selectedIds.length >= 2 && (
                  <div className="bulk">
                    <Link href={compareHref}>+ Compare selected deals</Link>
                    <Link href={crossCutHref}>+ Cross-cut selected deals</Link>
                  </div>
                )}

                <div className="tableShell">
                  <table>
                    <thead>
                      <tr>
                        <th />
                        <th>Deal name</th>
                        <th>Parties</th>
                        <th>Signing</th>
                        <th>Value</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan="6" className="rowLoading" /></tr>) : visibleDeals.map((deal) => (
                        <tr key={deal.id} onClick={() => router.push(`/review/${deal.id}`)}>
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(deal.id)} onChange={() => setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(deal.id)) next.delete(deal.id);
                              else next.add(deal.id);
                              return next;
                            })} />
                          </td>
                          <td><b>{deal.deal_name}</b></td>
                          <td>{deal.parties}</td>
                          <td>{fmtDate(deal.signing_date)}</td>
                          <td>{fmtMoney(deal.value)}</td>
                          <td>{deal.consideration_type || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>
      <style jsx global>{`
        .nh { min-height: 100vh; background: var(--paper); color: var(--ink); }
        .top { height: 64px; display: grid; grid-template-columns: 180px minmax(260px, 1fr) auto auto; gap: 18px; align-items: center; padding: 0 28px; border-bottom: 1px solid var(--line); background: var(--surface); position: sticky; top: 0; z-index: 20; }
        .brand { color: var(--ink); text-decoration: none; font-size: 22px; font-weight: 600; display: inline-flex; align-items: center; gap: 9px; }
        .brand span { width: 9px; height: 9px; border-radius: 2px; background: var(--accent); display: inline-block; }
        .search { position: relative; }
        .search input, select, .newQuery button { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 7px; height: 34px; padding: 0 11px; font: inherit; font-size: 13px; color: var(--ink); }
        .suggestions { position: absolute; top: 39px; left: 0; right: 0; background: #fff; border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 18px 50px rgba(0,0,0,.12); overflow: hidden; z-index: 30; }
        .suggestions button { width: 100%; display: flex; justify-content: space-between; gap: 14px; padding: 10px 12px; border: 0; background: #fff; text-align: left; cursor: pointer; }
        .suggestions button:hover { background: var(--paper-2); }
        .suggestions small { color: var(--ink-light); white-space: nowrap; }
        .nav, .login { color: var(--accent-deep); font-size: 13px; font-weight: 600; text-decoration: none; }
        .login { color: var(--ink-light); }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 0 34px; }
        .editorial { padding: 40px 0 38px; background: linear-gradient(#fff, var(--paper)); border-bottom: 1px solid var(--line); }
        .sectionHead, .opsHead { display: flex; align-items: flex-end; justify-content: space-between; gap: 22px; margin-bottom: 18px; }
        h1, h2 { font-size: 24px; line-height: 1.1; margin: 0; font-weight: 650; letter-spacing: 0; }
        p { margin: 5px 0 0; color: var(--ink-light); font-size: 13px; }
        .tiles, .snapshots { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .tile, .snapshot { min-height: 142px; border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 16px; text-decoration: none; color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
        .tile:hover, .snapshot:hover { border-color: var(--accent); }
        .tile small, .snapshot small { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: .12em; }
        .tile strong, .snapshot strong { font-size: 17px; line-height: 1.2; }
        .tile span { color: var(--ink-light); font-size: 13px; margin-top: auto; }
        .disabled { opacity: .45; pointer-events: none; }
        .snapshotsHead { margin-top: 32px; }
        .snapshot { min-height: 160px; }
        .spark { display: flex; align-items: flex-end; gap: 4px; height: 48px; margin-top: auto; }
        .bar { flex: 1; min-width: 8px; background: var(--accent); border-radius: 3px 3px 0 0; opacity: .82; }
        .metric { margin-top: auto; font-size: 24px; font-weight: 650; }
        .metric small { display: block; margin-top: 4px; }
        .operational { padding: 34px 0 80px; }
        .filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .filters select { width: auto; min-width: 108px; }
        .newQuery { position: relative; }
        .newQuery button { min-width: 112px; cursor: pointer; color: #fff; background: var(--accent); border-color: var(--accent); }
        .nh .menu { position: absolute; right: 0; top: 40px; width: 240px; background: #fff; border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 18px 50px rgba(0,0,0,.12); z-index: 10; overflow: hidden; }
        .nh .menu a { display: block; padding: 10px 12px; color: var(--ink); text-decoration: none; font-size: 13px; }
        .nh .menu a:hover { background: var(--paper-2); }
        .bulk { display: flex; gap: 10px; margin: -4px 0 12px; }
        .bulk a { border: 1px solid var(--accent); color: var(--accent-deep); background: #fff; border-radius: 7px; padding: 8px 11px; text-decoration: none; font-size: 13px; font-weight: 600; }
        .tableShell { border: 1px solid var(--line); border-radius: 8px; overflow: auto; background: #fff; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: var(--ink-faint); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; background: var(--paper-2); }
        th, td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
        tbody tr { cursor: pointer; }
        tbody tr:hover { background: color-mix(in srgb, var(--accent) 5%, #fff); }
        .rowLoading { height: 38px; background: linear-gradient(90deg, var(--line-soft), #fff, var(--line-soft)); }
        .empty { margin-top: 40px; border: 1px solid var(--line); background: #fff; border-radius: 8px; padding: 24px; color: var(--seller); }
        @media (max-width: 820px) {
          .top { grid-template-columns: 1fr; height: auto; padding: 14px; }
          .tiles, .snapshots { grid-template-columns: 1fr; }
          .sectionHead, .opsHead { align-items: flex-start; flex-direction: column; }
          .wrap { padding: 0 16px; }
          .filters { justify-content: flex-start; }
        }
      `}</style>
    </>
  );
}

function SnapshotBody({ snap }) {
  const result = snap.result;
  if (!result) return <span className="metric">No data<small>{snap.error || 'Not populated'}</small></span>;
  if (result.stats) {
    const median = result.stats.median == null ? '-' : Number(result.stats.median).toFixed(1).replace(/\.0$/, '');
    return (
      <>
        <span className="metric">{median}<small>n={result.n}</small></span>
        <Bars items={result.distribution.map((x) => x.count)} />
      </>
    );
  }
  const top = result.distribution?.[0];
  return (
    <>
      <span className="metric">{top ? `${Math.round(top.percent * 100)}%` : '-'}<small>{top ? top.value : `n=${result.n}`}</small></span>
      <Bars items={(result.distribution || []).map((x) => x.count)} />
    </>
  );
}

function Bars({ items }) {
  const max = Math.max(1, ...items);
  return <span className="spark">{items.slice(0, 10).map((count, i) => <span key={i} className="bar" style={{ height: `${Math.max(6, (count / max) * 48)}px` }} />)}</span>;
}

function NewQueryMenu({ deals }) {
  const ids = (deals || []).slice(0, 4).map((deal) => deal.id);
  const firstId = ids[0];
  const links = [
    ['Deal compare', 'deal-compare', { deal_ids: ids.slice(0, 4), provision_types: ['CONSIDERATION', 'TERMINATION_FEE'], highlight_deltas: true, included_field_groups: ['primary'] }],
    ['Provision cross-cut', 'provision-cross-cut', { provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: null, deal_ids: ids, columns: ['go_shop', 'matching_rights_days'], sort_by: 'deal_signing_date_desc' }],
    ['Market range', 'market-range', { provision_type: 'TERMINATION_FEE', field_path: 'fee_amount_percent', deal_filter: {}, chart_kind: 'HISTOGRAM' }],
    ['Filter then list', 'filter-then-list', { filters: [], sort_by: 'deal_signing_date_desc', columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'] }],
    ['Deal to market', 'deal-to-market', { deal_id: firstId, comparison_set_filter: {}, provision_types: null }],
  ];
  return <div className="menu">{links.map(([label, kind, payload]) => <Link key={kind} href={queryHref(kind, payload)}>{label}</Link>)}</div>;
}
