import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../components/review-v2/MergertraceStyles';
import QueryLaunchBox from '../components/query/QueryLaunchBox';
import { buildDealFilterPayload } from '../components/query/QueryFilterControls';
import { COLUMNS, getColumn, defaultVisibleKeys, signedYear } from '../lib/deals-index-columns';
import { getServiceSupabase } from '../lib/supabase';
const { getHomeStaticProps } = require('../lib/home-static-props');

// F3: ISR snapshot — fetches the same { deals, search_index } shape as
// /api/home server-side at build/revalidate time, so the deals table
// renders with real data on first paint with no client fetch wait. The
// client-side fetch in HomePage still runs and hydrates over this if
// there's a fresher payload; the table itself never re-blanks in between
// (see the `data` fallback in the fetch effect below). Fail-soft logic
// (Supabase env absent at build time, etc.) lives in
// lib/home-static-props.js so it's unit-testable without a JSX transform.
export async function getStaticProps() {
  return getHomeStaticProps(getServiceSupabase);
}

HomePage.noLayout = true;

const COLUMNS_STORAGE_KEY = 'deals_index_columns_v1';
const VALUE_BANDS = ['<$1B', '$1B-$10B', '>$10B'];

function encodePayload(payload) {
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 10e9 ? 0 : 1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// "May 4, 2025" — full date, not the old month-year slice. The T00:00:00
// suffix keeps Date() in local time so the day doesn't shift across the UTC
// boundary.
function fmtFullDate(date) {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function queryHref(kind, payload) {
  return `/query/${kind}/adhoc?payload=${encodePayload(payload)}`;
}

// Ben: "if someone types a type of provision it should load a query page
// that summarizes how that term operates across the corpus" — not a
// per-deal hit. A small vocabulary of provision-type synonyms; the first
// match against the typed search string wins. `label`/`plural` drive the
// "How <label> operate(s) across the corpus" sentence below.
const PROVISION_VOCAB = [
  { type: 'MATERIAL_CONTRACT', patterns: [/material contracts?/], label: 'material contracts', plural: true },
  { type: 'TERMINATION_FEE', patterns: [/termination fees?/], label: 'termination fees', plural: true },
  { type: 'COVENANT_NO_SOLICITATION', patterns: [/no.shop/, /no.solicitation/, /\bnosol\b/], label: 'no-shop / no-solicitation covenants', plural: true },
  { type: 'REPRESENTATION', patterns: [/^reps$/, /representations?/], label: 'representations', plural: true },
  { type: 'MAE', patterns: [/\bmae\b/, /material adverse effect/], label: 'the MAE standard', plural: false },
  { type: 'COVENANT_INTERIM_OPERATING', patterns: [/interim operating/, /\bioc\b/], label: 'interim operating covenants', plural: true },
  { type: 'ANTITRUST_REGULATORY', patterns: [/antitrust/, /regulatory approval/], label: 'antitrust / regulatory provisions', plural: true },
  { type: 'CLOSING_CONDITION', patterns: [/closing conditions?/, /^conditions?$/], label: 'closing conditions', plural: true },
  { type: 'TERMINATION_RIGHT', patterns: [/termination rights?/], label: 'termination rights', plural: true },
  { type: 'CONSIDERATION', patterns: [/consideration/], label: 'consideration', plural: false },
];

function matchProvisionVocab(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  for (const entry of PROVISION_VOCAB) {
    if (entry.patterns.some((re) => re.test(q))) return entry;
  }
  return null;
}

// Ben r15, item 8: typing a specific FEATURE term ("force the vote") should
// FIRST offer "<Feature> across all deals →" — a SHOW_ALL query listing
// every deal with has/hasn't + value (payload: filters carry
// { provision_type, field, mode: 'all' }). Verified field keys from
// lib/query/field-meta.js fieldsForProvisionType().
const FEATURE_VOCAB = [
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', label: 'Force the vote', patterns: [/force.the.vote/, /\bftv\b/] },
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', label: 'Go-shop', patterns: [/go.shop/] },
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'dontAskDontWaive', label: 'Don’t-ask-don’t-waive', patterns: [/don.?t.ask.don.?t.waive/, /\bdadw\b/] },
  { provision_type: 'COVENANT_NO_SOLICITATION', field: 'interveningEventProvision', label: 'Intervening event provision', patterns: [/intervening event/] },
  { provision_type: 'REPRESENTATION', field: 'materialityScrape', label: 'Materiality scrape', patterns: [/materiality scrape/] },
  { provision_type: 'ANTITRUST_REGULATORY', field: 'hellOrHighWater', label: 'Hell-or-high-water', patterns: [/hell.or.high.water/, /\bhohw\b/] },
  { provision_type: 'MISC_BOILERPLATE', field: 'specificPerformance', label: 'Specific performance', patterns: [/specific performance/] },
  { provision_type: 'TERMINATION_FEE', field: 'nakedNoVoteFee', label: 'Naked no-vote fee', patterns: [/naked no.vote/] },
  { provision_type: 'CONSIDERATION', field: 'appraisalRightsAvailable', label: 'Appraisal rights', patterns: [/appraisal rights?/] },
  { provision_type: 'MISC_BOILERPLATE', field: 'juryWaiver', label: 'Jury trial waiver', patterns: [/jury (trial )?waiver/] },
];

function matchFeatureVocab(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return null;
  for (const entry of FEATURE_VOCAB) {
    if (entry.patterns.some((re) => re.test(q))) return entry;
  }
  return null;
}

// Module-scope so repeated searches for the same provision type share one
// fetch instead of re-hitting /api/query/field-options every keystroke.
const crossCutColumnsCache = new Map();
function fieldsForCrossCut(provisionType) {
  if (!crossCutColumnsCache.has(provisionType)) {
    crossCutColumnsCache.set(provisionType, fetch(`/api/query/field-options?provision_type=${encodeURIComponent(provisionType)}`)
      .then((r) => r.json())
      .then((json) => (json.fields || []).slice(0, 4).map((f) => f.key))
      .catch(() => []));
  }
  return crossCutColumnsCache.get(provisionType);
}

function readColumnsFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function renderCell(col, deal) {
  if (col.key === 'deal') {
    return <><b>{deal.buyer_display || 'Buyer'}</b> {' / '}{deal.target_display || 'Target'}</>;
  }
  if (col.key === 'signed') {
    const full = fmtFullDate(deal.signing_date);
    return <span>{full || '-'}</span>;
  }
  if (col.key === 'value') {
    const money = fmtMoney(deal.value);
    if (money) return <span className="numCell">{money}</span>;
    if (deal.value_provenance && deal.value_provenance.kind === 'no_stated_value') {
      return <span className="numCell naVal" title={deal.value_provenance.note || 'No stated headline transaction value'}>n/a</span>;
    }
    return <span className="numCell">-</span>;
  }
  if (['law_firm_buyer', 'law_firm_target', 'lawyers_buyer', 'lawyers_target', 'reverse_fee', 'go_shop'].includes(col.key)) {
    const value = col.accessor(deal);
    if (value) return value;
    return <span className="muted" title="not extracted for this deal">&mdash;</span>;
  }
  const value = col.accessor(deal);
  return value == null || value === '' ? '-' : value;
}

function ColumnHeaderPopover({ col, sort, onSort, activeFilters, options, onToggleFilter, onClearFilter, isOpen, onToggleOpen }) {
  const activeSort = sort.key === col.key;
  const filterCount = (activeFilters || []).length;
  return (
    <th className={activeSort || filterCount ? 'active' : ''}>
      <div className="thWrap">
        <button type="button" className="thBtn" onClick={(e) => { e.stopPropagation(); onToggleOpen(col.key); }}>
          <span>{col.label}</span>
          {col.coverage ? <span className="coverage">{col.coverage}</span> : null}
          {activeSort ? <span className="marker">{sort.dir === 'asc' ? '▲' : '▼'}</span> : null}
          {filterCount ? <span className="funnel" title={`${filterCount} filter${filterCount > 1 ? 's' : ''} active`}>&#9660;</span> : null}
        </button>
        {isOpen && (
          <div className="popover" onClick={(e) => e.stopPropagation()}>
            {col.sortable && (
              <div className="popSort">
                <button type="button" className={activeSort && sort.dir === 'asc' ? 'sel' : ''} onClick={() => onSort(col.key, 'asc')}>Sort ascending</button>
                <button type="button" className={activeSort && sort.dir === 'desc' ? 'sel' : ''} onClick={() => onSort(col.key, 'desc')}>Sort descending</button>
              </div>
            )}
            {col.filterable && (
              <div className="popList">
                {(options || []).length === 0 && <div className="popEmpty">No values</div>}
                {(options || []).map((opt) => (
                  <label key={opt}>
                    <input type="checkbox" checked={(activeFilters || []).includes(opt)} onChange={() => onToggleFilter(col.key, opt)} />
                    <span>{opt}</span>
                  </label>
                ))}
                {filterCount > 0 && <button type="button" className="popClear" onClick={() => onClearFilter(col.key)}>Clear filter</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
}

export default function HomePage({ initialData }) {
  const router = useRouter();
  // F3: seed from the ISR snapshot (getStaticProps) so first paint already
  // has the deal table, instead of starting blank and waiting on the
  // client-side /api/home fetch below. The fetch effect only replaces
  // `data` on success — a slower/failing client fetch never blanks a table
  // that's already showing snapshot data.
  const [data, setData] = useState(() => initialData || null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'signed', dir: 'desc' });
  const [filters, setFilters] = useState({});
  const [visibleCols, setVisibleCols] = useState(() => defaultVisibleKeys());
  const [openHeader, setOpenHeader] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Deal-filter state, lifted out of QueryLaunchBox so a DEAL_TO_MARKET row
  // pick (handled here, via the table) can build the same deal_filter the
  // box's own inline kinds (FILTER_THEN_LIST, MARKET_RANGE) use.
  const [dealFilterValues, setDealFilterValues] = useState({ consideration_type: '', buyer: '', law_firm: '', sector: '', signing_year: '' });
  const dealFilter = useMemo(() => buildDealFilterPayload(dealFilterValues), [dealFilterValues]);

  // Pick-mode: DEAL_TO_MARKET and DEAL_COMPARE use the main table as their
  // deal picker instead of a second picker inside the launch box (Ben:
  // "they should just use the main deal list below as the picker"). `pickMode`
  // is null or the active kind; `pickSelection` accumulates clicked deal ids
  // for DEAL_COMPARE (DEAL_TO_MARKET fires immediately on the first click).
  const [pickMode, setPickMode] = useState(null);
  const [pickSelection, setPickSelection] = useState([]);
  const [crossCutRunning, setCrossCutRunning] = useState(false);

  // Esc / Cancel clears the running selection (Ben r15, item 4). Pick-mode
  // itself stays armed while the launch box is open on a deal-picking tab —
  // the box disarms it when the tab changes or the box collapses.
  const cancelPick = () => { setPickSelection([]); };
  // Bug fix (Ben, wave-3 QA -- Deal compare / Deal to market pick mode never
  // armed): this handler used to be a plain inline function, so it got a
  // NEW identity every render. QueryLaunchBox's cleanup effect depends on
  // this identity (`[onRequestDealPick]`), so every parent re-render fired
  // the OLD cleanup (onRequestDealPick(null)) an instant after the click
  // that armed pick-mode set it -- the .pickBanner never had a chance to
  // paint and a deal-row click just fell through to the plain navigate
  // branch. useCallback with an empty dep array keeps this handler's
  // identity stable across every re-render.
  const handleRequestDealPick = useCallback((kind) => { setPickMode(kind); setPickSelection([]); }, []);

  useEffect(() => {
    if (!pickMode) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') cancelPick(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickMode]);

  useEffect(() => {
    fetch('/api/home')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const stored = readColumnsFromStorage();
    if (stored) setVisibleCols(stored);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleCols)); } catch {}
  }, [visibleCols]);

  // Read URL params once router is ready: new form (sort=<key>_<dir>,
  // f_<key>=csv) plus back-compat for the old dropdown params.
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    const nextFilters = {};
    if (typeof q.sector === 'string' && q.sector) nextFilters.sector = q.sector.split(',');
    if (typeof q.year === 'string' && q.year) nextFilters.signed = q.year.split(',');
    if (typeof q.size === 'string' && q.size) nextFilters.value = q.size.split(',');
    for (const [key, value] of Object.entries(q)) {
      if (key.startsWith('f_') && typeof value === 'string' && value) {
        nextFilters[key.slice(2)] = value.split(',').filter(Boolean);
      }
    }
    setFilters(nextFilters);

    if (typeof q.sort === 'string' && q.sort) {
      const m = q.sort.match(/^(.+)_(asc|desc)$/);
      if (m && getColumn(m[1])) {
        setSort({ key: m[1], dir: m[2] });
      } else if (q.sort === 'signing_desc') setSort({ key: 'signed', dir: 'desc' });
      else if (q.sort === 'value_desc') setSort({ key: 'value', dir: 'desc' });
      else if (q.sort === 'value_asc') setSort({ key: 'value', dir: 'asc' });
      else if (q.sort === 'name_asc') setSort({ key: 'deal', dir: 'asc' });
    }
  }, [router.isReady]);

  useEffect(() => {
    if (!router.isReady) return;
    const query = {};
    if (sort.key !== 'signed' || sort.dir !== 'desc') query.sort = `${sort.key}_${sort.dir}`;
    for (const [key, values] of Object.entries(filters)) {
      if (Array.isArray(values) && values.length) query[`f_${key}`] = values.join(',');
    }
    const same = Object.keys(query).length === Object.keys(router.query).length &&
      Object.keys(query).every((key) => router.query[key] === query[key]);
    if (!same) router.replace({ pathname: '/', query }, undefined, { shallow: true });
  }, [filters, sort, router.isReady]);

  // Stable identity (not a fresh [] every render) — this array is passed to
  // QueryLaunchBox, whose deals effect keys on it.
  const deals = useMemo(() => data?.deals || [], [data]);

  const columnOptions = useMemo(() => {
    const map = {};
    for (const col of COLUMNS) {
      if (!col.filterable) continue;
      if (col.filterType === 'band') { map[col.key] = VALUE_BANDS; continue; }
      if (col.filterType === 'year') {
        map[col.key] = [...new Set(deals.map(signedYear).filter(Boolean))].sort().reverse();
        continue;
      }
      const getter = col.filterValue || col.accessor;
      map[col.key] = [...new Set(deals.map((deal) => getter(deal)).filter(Boolean))].sort();
    }
    return map;
  }, [deals]);

  const visibleDeals = useMemo(() => {
    let rows = deals.filter((deal) => {
      for (const [key, allowed] of Object.entries(filters)) {
        if (!Array.isArray(allowed) || !allowed.length) continue;
        const col = getColumn(key);
        if (!col) continue;
        const getter = col.filterValue || col.accessor;
        if (!allowed.includes(getter(deal))) return false;
      }
      return true;
    });
    const sortCol = getColumn(sort.key);
    if (sortCol) {
      const getter = sortCol.sortValue || sortCol.accessor;
      rows = [...rows].sort((a, b) => {
        const av = getter(a);
        const bv = getter(b);
        let cmp;
        if (typeof av === 'number' || typeof bv === 'number') cmp = (Number(av) || 0) - (Number(bv) || 0);
        else cmp = String(av || '').localeCompare(String(bv || ''));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [deals, filters, sort]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (data?.search_index || [])
      .filter((hit) => `${hit.label} ${hit.detail}`.toLowerCase().includes(q))
      .slice(0, 15);
  }, [search, data]);

  // Ben: typing a provision type (e.g. "material contracts") shouldn't just
  // surface one deal that happens to mention it — it should offer a
  // corpus-wide summary of how that term operates. r15 item 8 adds an even
  // more specific first hit: a FEATURE term ("force the vote") offers
  // "<Feature> across all deals →", the SHOW_ALL listing. Order in the
  // dropdown: feature show-all, provision cross-cut, then per-deal hits.
  const crossCutMatch = useMemo(() => matchProvisionVocab(search), [search]);
  const showAllMatch = useMemo(() => matchFeatureVocab(search), [search]);

  function runShowAll(entry) {
    if (!entry) return;
    const payload = {
      filters: [{ provision_type: entry.provision_type, field: entry.field, mode: 'all' }],
      deal_filter: {},
      sort_by: 'deal_signing_date_desc',
      columns: ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'],
    };
    router.push(queryHref('filter-then-list', payload));
  }

  function runCrossCutTerm(entry) {
    if (!entry || crossCutRunning) return;
    setCrossCutRunning(true);
    fieldsForCrossCut(entry.type).then((columns) => {
      const payload = {
        provision_type: entry.type,
        provision_subtype: null,
        deal_ids: deals.map((d) => d.id),
        columns,
        sort_by: 'deal_signing_date_desc',
      };
      router.push(queryHref('provision-cross-cut', payload));
    }).finally(() => setCrossCutRunning(false));
  }

  // r15 item 4: the floating "Compare N deals →" action for table-picked
  // deals (the secondary picker; the box's typeahead is the primary one).
  const pickCompareHref = queryHref('deal-compare', {
    deal_ids: pickSelection,
    provision_types: ['CONSIDERATION', 'TERMINATION_FEE', 'COVENANT_NO_SOLICITATION'],
    highlight_deltas: true,
    included_field_groups: ['primary', 'qualifiers'],
  });

  function submitSearch(e) {
    e.preventDefault();
    if (showAllMatch) { runShowAll(showAllMatch); return; }
    if (crossCutMatch) { runCrossCutTerm(crossCutMatch); return; }
    const first = suggestions[0];
    if (first) router.push(first.href);
  }

  function handleSort(key, dir) {
    setSort({ key, dir });
    setOpenHeader(null);
  }

  function handleToggleFilter(key, value) {
    setFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  function handleClearFilter(key) {
    setFilters((prev) => ({ ...prev, [key]: [] }));
  }

  function toggleColumn(key) {
    setVisibleCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const activeColumns = COLUMNS.filter((col) => visibleCols.includes(col.key));

  return (
    <>
      <Head>
        <title>Corpus</title>
      </Head>
      <MergertraceStyles />
      <div className="mtx nh" onClick={() => { setOpenHeader(null); setPickerOpen(false); }}>
        <header className="top">
          <Link href="/" className="brand"><span />Corpus</Link>
          <form className="search" onSubmit={submitSearch} onClick={(e) => e.stopPropagation()}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals, provisions, defined terms" />
            {(showAllMatch || crossCutMatch || suggestions.length > 0) && (
              <div className="suggestions">
                {showAllMatch && (
                  <button type="button" className="crossCutHit" onClick={() => runShowAll(showAllMatch)}>
                    <b>{showAllMatch.label} across all deals →</b>
                    <small>every deal, has / hasn&rsquo;t &middot; with the term as written</small>
                  </button>
                )}
                {crossCutMatch && (
                  <button type="button" className="crossCutHit" disabled={crossCutRunning} onClick={() => runCrossCutTerm(crossCutMatch)}>
                    <b>How {crossCutMatch.label} {crossCutMatch.plural ? 'operate' : 'operates'} across the corpus →</b>
                    <small>how a provision works across deals &middot; every deal in the corpus</small>
                  </button>
                )}
                {suggestions.map((hit, index) => (
                  <button key={`${hit.type}-${hit.href}-${index}`} type="button" onClick={() => router.push(hit.href)}>
                    <b>{hit.label}</b>
                    <small>{hit.type} &middot; {hit.detail}</small>
                  </button>
                ))}
              </div>
            )}
          </form>
          <Link href="/library" className="nav">Library</Link>
          <span className="login">Login</span>
        </header>

        {/* F3: a failed client refresh should never blank a table that
            already has snapshot/prior data — only show the error state when
            there's truly nothing to render. */}
        {error && !data ? <main className="wrap"><div className="empty">{error}</div></main> : (
          <main>
            <section className="operational">
              <div className="wrap">
                {/* Query surface — its own bordered panel, clearly separate
                    from the deal list below (Ben r15, item 6). */}
                <div className="querySurface">
                  <QueryLaunchBox
                    showTitle
                    bordered={false}
                    deals={deals}
                    dealFilterValues={dealFilterValues}
                    onDealFilterValuesChange={setDealFilterValues}
                    onRequestDealPick={handleRequestDealPick}
                    pickSelection={pickSelection}
                    onPickSelectionChange={setPickSelection}
                  />
                  {pickMode && (
                    <div className="pickBanner" onClick={(e) => e.stopPropagation()}>
                      <span>
                        {pickMode === 'DEAL_TO_MARKET' && 'Click a deal in the list below to test it against the market.'}
                        {pickMode === 'DEAL_COMPARE' && `Tick deals in the list below to compare${pickSelection.length ? ` — ${pickSelection.length} picked` : ''}.`}
                      </span>
                      <button type="button" className="pickCancel" onClick={cancelPick}>Clear (Esc)</button>
                    </div>
                  )}
                </div>

                {/* Deal list — its own surface with its own header band, in
                    the same voice as the review page's grey title bars. */}
                <div className="listSurface">
                  <div className="listTitleBar">
                    <span className="listTitleMain">Deal list</span>
                    <span className="listTitleSub">
                      {data ? `${visibleDeals.length === deals.length ? deals.length : `${visibleDeals.length} of ${deals.length}`} deals — click a row to open its agreement` : 'Loading…'}
                    </span>
                    <div className="opsActions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="gearBtn" onClick={() => setPickerOpen((v) => !v)} title="Choose columns">
                        Columns
                      </button>
                      {pickerOpen && (
                        <div className="picker">
                          {COLUMNS.map((col) => (
                            <label key={col.key}>
                              <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                              <span>{col.label}</span>
                              {col.coverage ? <small>{col.coverage}</small> : null}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="tableShell">
                    <table>
                      <thead>
                        <tr onClick={(e) => e.stopPropagation()}>
                          {pickMode === 'DEAL_COMPARE' && <th className="checkCol" />}
                          {activeColumns.map((col) => (
                            <ColumnHeaderPopover
                              key={col.key}
                              col={col}
                              sort={sort}
                              onSort={handleSort}
                              activeFilters={filters[col.key]}
                              options={columnOptions[col.key]}
                              onToggleFilter={handleToggleFilter}
                              onClearFilter={handleClearFilter}
                              isOpen={openHeader === col.key}
                              onToggleOpen={(key) => setOpenHeader((prev) => (prev === key ? null : key))}
                            />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {!data ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={activeColumns.length + (pickMode === 'DEAL_COMPARE' ? 1 : 0)} className="rowLoading" /></tr>) : visibleDeals.map((deal) => {
                          const picked = pickMode === 'DEAL_COMPARE' && pickSelection.includes(deal.id);
                          const rowAction = () => {
                            if (pickMode === 'DEAL_TO_MARKET') {
                              const payload = { deal_id: deal.id, comparison_set_filter: dealFilter, provision_types: null };
                              router.push(queryHref('deal-to-market', payload));
                              cancelPick();
                              return;
                            }
                            if (pickMode === 'DEAL_COMPARE') {
                              setPickSelection((prev) => (prev.includes(deal.id) ? prev.filter((id) => id !== deal.id) : [...prev, deal.id]));
                              return;
                            }
                            router.push(`/review/${deal.id}`);
                          };
                          return (
                        <tr
                          key={deal.id}
                          className={picked ? 'rowPicked' : undefined}
                          onClick={rowAction}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              rowAction();
                            }
                          }}
                        >
                          {/* r15 item 4: no permanent checkbox column ("get
                              rid of all the tick boxes") — ticks appear only
                              while Compare deals is picking. */}
                          {pickMode === 'DEAL_COMPARE' && (
                            <td className="checkCol">
                              <span className={`pickMark${picked ? ' pickMarkOn' : ''}`}>{picked ? '✓' : ''}</span>
                            </td>
                          )}
                          {activeColumns.map((col) => (
                            <td key={col.key}>{renderCell(col, deal)}</td>
                          ))}
                        </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* r15 item 4: floating action for table-picked deals — both
                    of Ben's instincts honored (typeahead in the box AND a
                    Compare button that appears when rows are ticked). */}
                {pickMode === 'DEAL_COMPARE' && pickSelection.length >= 1 && (
                  <div className="floatCompare" onClick={(e) => e.stopPropagation()}>
                    {pickSelection.length >= 2 ? (
                      <Link href={pickCompareHref} className="floatCompareBtn">Compare {pickSelection.length} deals →</Link>
                    ) : (
                      <span className="floatCompareHint">1 deal ticked — pick at least one more</span>
                    )}
                  </div>
                )}
              </div>
            </section>
          </main>
        )}
      </div>
      <style jsx global>{`
        .nh { min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--mtx-sans); }
        .top { height: 64px; display: grid; grid-template-columns: 180px minmax(260px, 1fr) auto auto; gap: 18px; align-items: center; padding: 0 28px; border-bottom: 1px solid var(--line); background: var(--surface); position: sticky; top: 0; z-index: 20; }
        .brand { color: var(--ink); text-decoration: none; font-size: 20px; font-weight: 650; display: inline-flex; align-items: center; gap: 9px; font-family: var(--mtx-sans); }
        .brand span { width: 8px; height: 8px; border-radius: 0; background: var(--accent); display: inline-block; }
        .search { position: relative; }
        .search input { width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 0; height: 34px; padding: 0 11px; font: inherit; font-size: 13px; color: var(--ink); font-family: var(--mtx-sans); }
        .suggestions { position: absolute; top: 39px; left: 0; right: 0; background: #fff; border: 1px solid var(--line); border-radius: 0; box-shadow: 0 12px 32px rgba(0,0,0,.10); overflow: hidden; z-index: 30; }
        .suggestions button { width: 100%; display: flex; justify-content: space-between; gap: 14px; padding: 10px 12px; border: 0; background: #fff; text-align: left; cursor: pointer; font-family: var(--mtx-sans); }
        .suggestions button:hover { background: var(--paper-2); }
        .suggestions small { color: var(--ink-light); white-space: nowrap; }
        .crossCutHit { background: var(--paper-2, #F6F6F6) !important; border-bottom: 1px solid var(--line) !important; }
        .crossCutHit b { color: var(--accent-deep); }
        .nav, .login { color: var(--accent-deep); font-size: 13px; font-weight: 600; text-decoration: none; }
        .login { color: var(--ink-light); }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 0 34px; }
        .operational { padding: 34px 0 80px; }
        /* r15 item 6: the query box and the deal list are two clearly
           separate surfaces — each its own bordered panel with its own grey
           title band, with clear air between them (Ben: "need a better
           visual separation into the deal list"). */
        .querySurface { border: 1px solid var(--line); background: #fff; }
        .listSurface { border: 1px solid var(--line); background: #fff; margin-top: 26px; }
        .listTitleBar { display: flex; align-items: baseline; gap: 10px; padding: 7px 14px; border-bottom: 1px solid var(--line); background: var(--paper-2, #F6F6F6); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink); font-family: var(--mtx-sans); }
        .listTitleMain { flex: 0 0 auto; }
        .listTitleSub { flex: 1; font-weight: 400; text-transform: none; letter-spacing: 0; font-size: 11px; color: var(--ink-light); }
        .pickBanner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 16px; background: var(--paper-2, #F6F6F6); border-top: 1px solid var(--line); font-size: 12px; color: var(--ink); font-family: var(--mtx-sans); }
        .pickCancel { border: 1px solid var(--line); background: #fff; font-size: 11px; font-weight: 600; padding: 4px 10px; cursor: pointer; font-family: var(--mtx-sans); color: var(--ink-light); }
        .pickCancel:hover { color: var(--ink); border-color: var(--ink-light); }
        .floatCompare { position: fixed; bottom: 28px; right: 36px; z-index: 60; }
        .floatCompareBtn { display: inline-block; background: var(--ink); color: #fff; border: 1px solid var(--ink); padding: 11px 18px; font-size: 13px; font-weight: 650; text-decoration: none; font-family: var(--mtx-sans); box-shadow: 0 8px 24px rgba(0,0,0,.18); }
        .floatCompareBtn:hover { background: #000; }
        .floatCompareHint { display: inline-block; background: #fff; color: var(--ink-light); border: 1px solid var(--line); padding: 11px 18px; font-size: 12px; font-family: var(--mtx-sans); box-shadow: 0 8px 24px rgba(0,0,0,.12); }
        h2 { font-size: 22px; line-height: 1.1; margin: 0; font-weight: 650; font-family: var(--mtx-sans); }
        p { margin: 5px 0 0; color: var(--ink-light); font-size: 13px; }
        .opsActions { position: relative; }
        .gearBtn { border: 1px solid var(--line); background: #fff; border-radius: 0; height: 32px; padding: 0 12px; font-size: 12px; font-weight: 600; font-family: var(--mtx-sans); color: var(--ink); cursor: pointer; }
        .gearBtn:hover { border-color: var(--accent); }
        .picker { position: absolute; right: 0; top: 38px; width: 240px; background: #fff; border: 1px solid var(--line); border-radius: 0; box-shadow: 0 12px 32px rgba(0,0,0,.10); z-index: 40; padding: 6px 0; max-height: 340px; overflow-y: auto; }
        .picker label { display: flex; align-items: center; gap: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
        .picker label:hover { background: var(--paper-2); }
        .picker small { margin-left: auto; color: var(--ink-faint); font-family: var(--mtx-mono); font-size: 10px; }
        .tableShell { border: none; border-radius: 0; overflow: auto; background: #fff; }
        .rowPicked { background: rgba(31, 31, 31, 0.05); }
        .rowPicked:hover { background: rgba(31, 31, 31, 0.08); }
        .pickMark { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 1px solid var(--line); color: var(--ink); font-size: 11px; font-weight: 700; }
        .pickMarkOn { background: var(--ink); color: #fff; border-color: var(--ink); }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; color: var(--ink-faint); font-size: 9px; text-transform: uppercase; letter-spacing: .14em; background: var(--paper-2); font-weight: 700; font-family: var(--mtx-sans); position: relative; }
        th.checkCol, td.checkCol { width: 34px; }
        th, td { padding: 10px 12px; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
        td { font-family: var(--mtx-sans); }
        td .numCell, .numCell { font-variant-numeric: tabular-nums; }
        td .muted { color: var(--ink-faint); }
        td .naVal { color: var(--ink-light); cursor: help; }
        tbody tr { cursor: pointer; }
        tbody tr:hover { background: var(--paper-2); }
        .rowLoading { height: 38px; background: linear-gradient(90deg, var(--line-soft), #fff, var(--line-soft)); }
        .empty { margin-top: 40px; border: 1px solid var(--line); background: #fff; border-radius: 0; padding: 24px; }
        .thWrap { position: relative; }
        .thBtn { display: flex; align-items: center; gap: 6px; border: 0; background: transparent; cursor: pointer; padding: 0; font: inherit; text-transform: inherit; letter-spacing: inherit; color: inherit; font-family: var(--mtx-sans); }
        th.active .thBtn { color: var(--ink); }
        .thBtn .coverage { font-family: var(--mtx-mono); font-size: 9px; color: var(--ink-faint); text-transform: none; letter-spacing: normal; }
        .thBtn .marker, .thBtn .funnel { font-size: 8px; }
        .popover { position: absolute; top: 100%; left: 0; margin-top: 6px; width: 220px; background: #fff; border: 1px solid var(--line); border-radius: 0; box-shadow: 0 12px 32px rgba(0,0,0,.12); z-index: 40; padding: 6px 0; text-transform: none; letter-spacing: normal; font-weight: 400; }
        .popSort { display: flex; flex-direction: column; border-bottom: 1px solid var(--line-soft); padding-bottom: 4px; margin-bottom: 4px; }
        .popSort button { text-align: left; border: 0; background: transparent; padding: 7px 12px; font-size: 12px; cursor: pointer; font-family: var(--mtx-sans); color: var(--ink); }
        .popSort button:hover, .popSort button.sel { background: var(--paper-2); }
        .popList { max-height: 220px; overflow-y: auto; }
        .popList label { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
        .popList label:hover { background: var(--paper-2); }
        .popEmpty { padding: 8px 12px; font-size: 12px; color: var(--ink-faint); }
        .popClear { width: 100%; text-align: left; border: 0; border-top: 1px solid var(--line-soft); background: transparent; padding: 7px 12px; font-size: 12px; cursor: pointer; color: var(--ink-light); margin-top: 4px; font-family: var(--mtx-sans); }
        .popClear:hover { color: var(--ink); }
        @media (max-width: 820px) {
          .top { grid-template-columns: 1fr; height: auto; padding: 14px; }
          .listTitleBar { flex-wrap: wrap; }
          .wrap { padding: 0 16px; }
        }
      `}</style>
    </>
  );
}
