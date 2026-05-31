import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '../lib/useUser';
import { useDeals, useProvisions } from '../lib/useSupabaseData';
import { SIDEBAR_GROUPS, typeHex, sidebarTypeOrder, findGroupForType } from '../lib/sidebar-groups';
import { CATEGORY_SUMMARY_FEATURES } from '../lib/category-summary-features';

ComparePage.noLayout = true;

const MAX_DEALS = 8;

export default function ComparePage() {
  const router = useRouter();
  const { user } = useUser();
  const { deals: allDeals, loading: dealsLoading } = useDeals();

  const idList = useMemo(() => {
    const raw = router.query.ids;
    if (!raw) return [];
    const s = Array.isArray(raw) ? raw[0] : raw;
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }, [router.query.ids]);

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
        style={{ height: '100vh', background: 'var(--paper)', overflow: 'hidden' }}
      >
        <TopBar user={user} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 22px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
            flexWrap: 'wrap',
            flexShrink: 0,
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

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {selectedDeals.length > 0 ? (
            <CompareBody deals={selectedDeals} />
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

/* ─── Top bar ─────────────────────────────────────────────── */
function TopBar({ user }) {
  return (
    <header
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        padding: '0 22px',
        flexShrink: 0,
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

/* ─── Helpers for keying provisions across deals ──────────── */
function normalizeKey(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A "row key" matches comparable provisions across deals: same type + same
// normalized category. We fall back to the provision id so unique items still
// render in the table (each as their own row).
function rowKeyFor(p) {
  const cat = normalizeKey(p.category);
  if (cat) return `${p.type}::${cat}`;
  return `${p.type}::__${p.id}`;
}

function rowLabelFor(p) {
  return p.category || '(uncategorized)';
}

/* ─── Body: sidebar + main pane ───────────────────────────── */
function CompareBody({ deals }) {
  // Fan-out useProvisions calls — hooks must be called unconditionally, so we
  // call MAX_DEALS hooks every render and only consume the active ones.
  const slots = Array.from({ length: MAX_DEALS }, (_, i) => deals[i]);
  /* eslint-disable react-hooks/rules-of-hooks */
  const provisionResults = slots.map((d) => useProvisions({ deal_id: d?.id }));
  /* eslint-enable react-hooks/rules-of-hooks */
  const dealProvisions = deals.map((_, i) => provisionResults[i]);

  // Active filter (group/type/all) + active row (for side-by-side detail).
  const [activeFilter, setActiveFilter] = useState({ kind: 'all' });
  const [activeRowKey, setActiveRowKey] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  // View mode at the top of the main pane: 'summary' (feature matrix) or
  // 'provisions' (one row per comparable provision, with snippet cells).
  const [viewMode, setViewMode] = useState('summary');

  // Reset selected row when the filter changes (keeps detail in sync).
  useEffect(() => {
    setActiveRowKey(null);
  }, [activeFilter.kind, activeFilter.label, activeFilter.type]);

  // Pivot: by row key, collect one slot per deal.
  // rowsByGroup: { groupLabel: [ { key, label, type, perDeal: [p|null,…] } ] }
  const { rowsByGroup, rowsByType, allRows, countsByType } = useMemo(() => {
    const counts = {};
    // First pass — count types across deals.
    for (const dp of dealProvisions) {
      for (const p of dp.provisions || []) {
        counts[p.type || 'OTHER'] = (counts[p.type || 'OTHER'] || 0) + 1;
      }
    }

    // Pivot.
    const pivot = new Map(); // rowKey → { key, label, type, perDeal }
    deals.forEach((deal, dealIdx) => {
      const list = dealProvisions[dealIdx]?.provisions || [];
      for (const p of list) {
        const key = rowKeyFor(p);
        if (!pivot.has(key)) {
          pivot.set(key, {
            key,
            label: rowLabelFor(p),
            type: p.type || 'OTHER',
            perDeal: deals.map(() => null),
          });
        }
        // If multiple provisions in one deal hash to the same row, prefer the
        // longest text so the comparison shows the substantive one.
        const slot = pivot.get(key).perDeal[dealIdx];
        if (!slot || (p.full_text || '').length > (slot.full_text || '').length) {
          pivot.get(key).perDeal[dealIdx] = p;
        }
      }
    });

    const order = sidebarTypeOrder();
    const all = [...pivot.values()].sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      const ax = ai === -1 ? 999 : ai;
      const bx = bi === -1 ? 999 : bi;
      if (ax !== bx) return ax - bx;
      return a.label.localeCompare(b.label);
    });

    const byGroup = {};
    const byType = {};
    for (const row of all) {
      const g = findGroupForType(row.type);
      const label = g ? g.group.label : 'Other';
      if (!byGroup[label]) byGroup[label] = [];
      byGroup[label].push(row);

      if (!byType[row.type]) byType[row.type] = [];
      byType[row.type].push(row);
    }

    return { rowsByGroup: byGroup, rowsByType: byType, allRows: all, countsByType: counts };
  }, [deals, dealProvisions]);

  const totalProvisions = useMemo(
    () => Object.values(countsByType).reduce((a, b) => a + b, 0),
    [countsByType]
  );

  const toggleGroup = (label) => {
    setCollapsedGroups((s) => ({ ...s, [label]: !s[label] }));
  };

  // Resolve which rows feed the main pane based on the active filter.
  const visibleRows = useMemo(() => {
    if (activeFilter.kind === 'all') return allRows;
    if (activeFilter.kind === 'group') return rowsByGroup[activeFilter.label] || [];
    if (activeFilter.kind === 'type') return rowsByType[activeFilter.type] || [];
    if (activeFilter.kind === 'row') {
      const r = allRows.find((x) => x.key === activeFilter.key);
      return r ? [r] : [];
    }
    return allRows;
  }, [activeFilter, allRows, rowsByGroup, rowsByType]);

  const activeRow = useMemo(() => {
    if (!activeRowKey) return null;
    return allRows.find((r) => r.key === activeRowKey) || null;
  }, [activeRowKey, allRows]);

  return (
    <>
      <CompareSidebar
        deals={deals}
        rowsByGroup={rowsByGroup}
        rowsByType={rowsByType}
        totalProvisions={totalProvisions}
        countsByType={countsByType}
        activeFilter={activeFilter}
        onChangeFilter={(f) => {
          setActiveFilter(f);
          // Selecting an individual provision via sidebar also opens detail.
          if (f.kind === 'row') setActiveRowKey(f.key);
        }}
        collapsedGroups={collapsedGroups}
        toggleGroup={toggleGroup}
      />

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <FilterHeader
          activeFilter={activeFilter}
          countsByType={countsByType}
          visibleRows={visibleRows}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          showTabs={!activeRow}
        />

        {activeRow ? (
          <SideBySideDetail
            row={activeRow}
            deals={deals}
            onClose={() => setActiveRowKey(null)}
          />
        ) : viewMode === 'summary' ? (
          <SummaryView
            deals={deals}
            dealProvisions={dealProvisions}
            activeFilter={activeFilter}
            rowsByGroup={rowsByGroup}
            rowsByType={rowsByType}
            allRows={allRows}
            onSelectRow={(key) => setActiveRowKey(key)}
          />
        ) : (
          <CompareTable
            deals={deals}
            rows={visibleRows}
            onSelectRow={(key) => setActiveRowKey(key)}
            loading={dealProvisions.some((dp) => dp?.loading)}
          />
        )}
      </main>
    </>
  );
}

/* ─── Sidebar with collapsible groups + individual items ──── */
function CompareSidebar({
  deals,
  rowsByGroup,
  rowsByType,
  totalProvisions,
  countsByType,
  activeFilter,
  onChangeFilter,
  collapsedGroups,
  toggleGroup,
}) {
  const visibleGroups = useMemo(() => {
    return SIDEBAR_GROUPS
      .map((g) => {
        const rows = rowsByGroup[g.label] || [];
        if (rows.length === 0) return null;
        return { ...g, rows };
      })
      .filter(Boolean);
  }, [rowsByGroup]);

  const isFilterActive = (kind, value, secondary) => {
    if (kind === 'all') return activeFilter.kind === 'all';
    if (kind === 'group') return activeFilter.kind === 'group' && activeFilter.label === value;
    if (kind === 'type') return activeFilter.kind === 'type' && activeFilter.type === value;
    if (kind === 'row') return activeFilter.kind === 'row' && activeFilter.key === value;
    return false;
  };

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
        padding: '14px 12px',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '0 8px 8px' }}>
        <span className="rec-side-eyebrow">Provisions</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => onChangeFilter({ kind: 'all' })}
          className={`rec-side-item${isFilterActive('all') ? ' active' : ''}`}
        >
          <span className="dot" style={{ background: 'var(--accent)' }} />
          <span style={{ fontWeight: 600 }}>All provisions</span>
          <span className="count">{totalProvisions}</span>
        </button>

        {visibleGroups.map((g) => {
          const collapsed = !!collapsedGroups[g.label];
          const groupActive = isFilterActive('group', g.label);
          const repColor = typeHex(g.rows[0]?.type || 'OTHER');

          return (
            <div key={g.label} style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <button
                  onClick={() => toggleGroup(g.label)}
                  title={collapsed ? 'Expand' : 'Collapse'}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--ink-faint)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    width: 18,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {collapsed ? '+' : '−'}
                </button>
                <button
                  onClick={() => onChangeFilter({ kind: 'group', label: g.label })}
                  className={`rec-side-item${groupActive ? ' active' : ''}`}
                  style={{ flex: 1 }}
                >
                  <span className="dot" style={{ background: repColor }} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{g.label}</span>
                  <span className="count">{g.rows.length}</span>
                </button>
              </div>

              {!collapsed && (
                <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {g.children ? (
                    // Group has named children (e.g. Reps → Target/Buyer). Show
                    // each child as a sub-header with individual provisions
                    // nested below.
                    g.children.map((c) => {
                      const childRows = (rowsByType[c.type] || []);
                      if (childRows.length === 0) return null;
                      return (
                        <ChildBucket
                          key={c.type}
                          label={c.label}
                          type={c.type}
                          rows={childRows}
                          deals={deals}
                          activeFilter={activeFilter}
                          onChangeFilter={onChangeFilter}
                        />
                      );
                    })
                  ) : (
                    // Flat group — just list rows directly.
                    g.rows.map((row) => (
                      <ProvisionSideItem
                        key={row.key}
                        row={row}
                        deals={deals}
                        active={isFilterActive('row', row.key)}
                        onClick={() => onChangeFilter({ kind: 'row', key: row.key, label: row.label })}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function ChildBucket({ label, type, rows, deals, activeFilter, onChangeFilter }) {
  const [collapsed, setCollapsed] = useState(false);
  const isActive = activeFilter.kind === 'type' && activeFilter.type === type;
  return (
    <div style={{ marginTop: 3 }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            width: 16,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {collapsed ? '+' : '−'}
        </button>
        <button
          onClick={() => onChangeFilter({ kind: 'type', type, label })}
          className={`rec-side-item${isActive ? ' active' : ''}`}
          style={{ flex: 1, fontSize: 12.5, padding: '5px 8px' }}
        >
          <span className="dot" style={{ background: typeHex(type) }} />
          <span style={{ flex: 1 }}>{label}</span>
          <span className="count">{rows.length}</span>
        </button>
      </div>
      {!collapsed && (
        <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map((row) => (
            <ProvisionSideItem
              key={row.key}
              row={row}
              deals={deals}
              active={activeFilter.kind === 'row' && activeFilter.key === row.key}
              onClick={() => onChangeFilter({ kind: 'row', key: row.key, label: row.label })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProvisionSideItem({ row, deals, active, onClick }) {
  const present = row.perDeal.filter(Boolean).length;
  const total = deals.length;
  return (
    <button
      onClick={onClick}
      className={`rec-side-item${active ? ' active' : ''}`}
      style={{ fontSize: 12, padding: '4px 8px 4px 14px', lineHeight: 1.3 }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: typeHex(row.type),
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={row.label}
      >
        {row.label}
      </span>
      <span
        className="count"
        style={{
          color: present === total ? 'var(--ink-mid)' : 'var(--ink-faint)',
          fontWeight: present === total ? 600 : 400,
        }}
      >
        {present}/{total}
      </span>
    </button>
  );
}

/* ─── Header above main pane ─────────────────────────────── */
function FilterHeader({ activeFilter, countsByType, visibleRows, viewMode, onChangeViewMode, showTabs }) {
  let label = 'All Provisions';
  let color = 'var(--accent)';
  let sub = `${visibleRows.length} comparable row${visibleRows.length === 1 ? '' : 's'}`;

  if (activeFilter.kind === 'group') {
    label = activeFilter.label;
    const group = SIDEBAR_GROUPS.find((g) => g.label === activeFilter.label);
    if (group) {
      const types = group.children ? group.children.map((c) => c.type) : group.types || [];
      color = typeHex(types[0] || 'OTHER');
    }
  } else if (activeFilter.kind === 'type') {
    label = activeFilter.label || activeFilter.type;
    color = typeHex(activeFilter.type);
  } else if (activeFilter.kind === 'row') {
    label = activeFilter.label || 'Provision';
    const r = visibleRows[0];
    if (r) color = typeHex(r.type);
    sub = 'Side-by-side';
  }

  return (
    <div
      style={{
        padding: '14px 22px 0',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
        background: 'var(--surface)',
      }}
    >
      <div className="rec-type-head" style={{ margin: 0 }}>
        <span className="th-dot" style={{ background: color }} />
        <h2>{label}</h2>
        <span className="ct">{sub}</span>
        <span className="rule" />
      </div>
      {showTabs && (
        <div style={{ display: 'flex', gap: 0, marginTop: 10 }}>
          <ViewTab
            label="Summary"
            active={viewMode === 'summary'}
            onClick={() => onChangeViewMode('summary')}
          />
          <ViewTab
            label="Provisions"
            active={viewMode === 'provisions'}
            onClick={() => onChangeViewMode('provisions')}
          />
        </div>
      )}
    </div>
  );
}

function ViewTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: '8px 14px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '.10em',
        textTransform: 'uppercase',
        color: active ? 'var(--accent-deep)' : 'var(--ink-faint)',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

/* ─── Summary view: feature × deal matrix ────────────────── */

// Canonical feature lists for high-value provision types. These mirror the
// review-page CATEGORY_SUMMARY_FEATURES + a hand-curated extension for the
// other types. Order = display order. If a type isn't in this map, we fall
// back to "auto" mode: pull every feature key that has data in any deal.
// SUMMARY_FEATURE_SPECS retired — compare now uses the shared CATEGORY_SUMMARY_FEATURES (lib/category-summary-features.js), the same spec the review table view uses.

function isEmptyVal(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

// Features are stored at provision.ai_metadata.features (which may be a JSON
// string). Returns {} when there's nothing — never null.
function readFeatures(provision) {
  if (!provision) return {};
  let meta = provision.ai_metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { return {}; }
  }
  if (!meta || typeof meta !== 'object') return {};
  const f = meta.features;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return {};
  return f;
}

// Pull a feature value for a deal: first non-empty match across `keys` across
// any provision of `types` in that deal.
function pickFeatureValue(provisions, types, keys) {
  const typeSet = new Set(types);
  for (const p of provisions) {
    if (!typeSet.has(p.type)) continue;
    const f = readFeatures(p);
    for (const k of keys) {
      if (!isEmptyVal(f[k])) return { value: f[k], key: k, provision: p };
    }
  }
  return null;
}

function SummaryView({
  deals,
  dealProvisions,
  activeFilter,
  rowsByGroup,
  rowsByType,
  allRows,
  onSelectRow,
}) {
  // Determine which type(s) we're summarizing.
  const activeTypes = useMemo(() => {
    if (activeFilter.kind === 'type') return [activeFilter.type];
    if (activeFilter.kind === 'group') {
      const g = SIDEBAR_GROUPS.find((x) => x.label === activeFilter.label);
      if (!g) return [];
      return g.children ? g.children.map((c) => c.type) : g.types || [];
    }
    if (activeFilter.kind === 'all') {
      // Across the whole document, show the same group-level summary by
      // stacking each group's matrix below the next.
      return null; // sentinel — render group-by-group
    }
    return [];
  }, [activeFilter]);

  // Pull each deal's provisions array once.
  const perDealProvs = useMemo(
    () => deals.map((_, i) => dealProvisions[i]?.provisions || []),
    [deals, dealProvisions]
  );

  if (activeTypes === null) {
    // ALL view: render group-by-group summary stacks.
    const visibleGroups = SIDEBAR_GROUPS.filter((g) => {
      const rows = rowsByGroup[g.label] || [];
      return rows.length > 0;
    });
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px 80px' }}>
        {visibleGroups.map((g) => {
          const types = g.children ? g.children.map((c) => c.type) : g.types || [];
          return (
            <SummaryMatrix
              key={g.label}
              title={g.label}
              color={typeHex(types[0] || 'OTHER')}
              types={types}
              deals={deals}
              perDealProvs={perDealProvs}
              rowsForTypes={types.flatMap((t) => rowsByType[t] || [])}
              onSelectRow={onSelectRow}
              compact
            />
          );
        })}
      </div>
    );
  }

  if (activeTypes.length === 0) {
    return (
      <div style={{ padding: 40, color: 'var(--ink-faint)', fontSize: 13 }}>
        Nothing to summarize.
      </div>
    );
  }

  // Single type or group: one matrix, full-height.
  const rows =
    activeFilter.kind === 'type'
      ? rowsByType[activeFilter.type] || []
      : (rowsByGroup[activeFilter.label] || []);
  const title =
    activeFilter.kind === 'type'
      ? activeFilter.label || activeFilter.type
      : activeFilter.label;
  const color = typeHex(activeTypes[0]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px 80px' }}>
      <SummaryMatrix
        title={title}
        color={color}
        types={activeTypes}
        deals={deals}
        perDealProvs={perDealProvs}
        rowsForTypes={rows}
        onSelectRow={onSelectRow}
      />
    </div>
  );
}

function SummaryMatrix({
  title,
  color,
  types,
  deals,
  perDealProvs,
  rowsForTypes,
  onSelectRow,
  compact,
}) {
  // Build the feature row list: union of (a) any explicit spec entries for the
  // active types, and (b) any auto-discovered feature keys that have data in
  // at least one deal but aren't already in the spec.
  const featureRows = useMemo(() => {
    const out = [];
    const seenKeys = new Set();
    // Explicit spec entries first, in the order they appear in the type's spec.
    for (const t of types) {
      // Shared spec — single source of truth with the review page's table view.
      const spec = CATEGORY_SUMMARY_FEATURES[t] || [];
      for (const row of spec) {
        const sig = row.label;
        if (seenKeys.has(sig)) continue;
        seenKeys.add(sig);
        out.push({ label: row.label, keys: row.keys || [] });
      }
    }
    // Auto-discovered keys: union of feature keys across deals for the active
    // types, excluding ones already covered by the spec keys.
    const specKeys = new Set();
    for (const row of out) for (const k of row.keys) specKeys.add(k);
    const autoKeys = new Set();
    for (const provs of perDealProvs) {
      for (const p of provs) {
        if (!types.includes(p.type)) continue;
        const f = readFeatures(p);
        for (const k of Object.keys(f)) {
          if (specKeys.has(k)) continue;
          if (isEmptyVal(f[k])) continue;
          autoKeys.add(k);
        }
      }
    }
    for (const k of [...autoKeys].sort()) {
      out.push({ label: humanizeKey(k), keys: [k], auto: true });
    }
    return out;
  }, [types, perDealProvs]);

  // For each (row, deal) compute the cell value.
  const cells = useMemo(() => {
    return featureRows.map((row) => {
      const perDeal = perDealProvs.map((provs) => pickFeatureValue(provs, types, row.keys));
      const presentCount = perDeal.filter(Boolean).length;
      return { row, perDeal, presentCount };
    });
  }, [featureRows, perDealProvs, types]);

  // Drop rows where no deal has data — keeps the matrix tight.
  const populated = cells.filter((c) => c.presentCount > 0);

  return (
    <section style={{ marginBottom: 28 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
        <h3
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: compact ? 15 : 18,
            fontWeight: 500,
            letterSpacing: '-.01em',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
          }}
        >
          {populated.length} feature{populated.length === 1 ? '' : 's'}
        </span>
      </header>

      {populated.length === 0 ? (
        <div
          style={{
            padding: '12px 14px',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            fontSize: 12.5,
            border: '1px solid var(--line-soft)',
            borderRadius: 8,
            background: 'var(--surface)',
          }}
        >
          No structured features extracted for {title} in the selected deals.
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: 12.5,
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: 220 }} />
              {deals.map((d) => (
                <col key={d.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th style={hdrCellStyle()}>Feature</th>
                {deals.map((d) => (
                  <th key={d.id} style={hdrCellStyle()}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9.5,
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-faint)',
                      }}
                    >
                      {d.agreement_type || 'Acquisition'}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--ink)',
                        marginTop: 2,
                      }}
                    >
                      {d.acquirer}{' '}
                      <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>/</span>{' '}
                      {d.target}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {populated.map(({ row, perDeal }) => (
                <tr key={row.label}>
                  <td
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--line-soft)',
                      verticalAlign: 'top',
                      background: 'var(--surface)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--ink)',
                        fontSize: 12.5,
                        lineHeight: 1.3,
                      }}
                    >
                      {row.label}
                    </div>
                    {row.auto && (
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9.5,
                          color: 'var(--ink-faint)',
                          letterSpacing: '.06em',
                          marginTop: 2,
                        }}
                      >
                        {row.keys[0]}
                      </div>
                    )}
                  </td>
                  {perDeal.map((hit, i) => (
                    <td
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--line-soft)',
                        borderLeft: '1px solid var(--line-soft)',
                        verticalAlign: 'top',
                        background: 'var(--surface)',
                        cursor: hit ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (hit && onSelectRow) {
                          // Open side-by-side detail for the row that owns this
                          // provision so the user can see the full text.
                          const key = rowKeyFor(hit.provision);
                          onSelectRow(key);
                        }
                      }}
                    >
                      {hit ? (
                        <SummaryCell hit={hit} />
                      ) : (
                        <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryCell({ hit }) {
  const text = formatFeatureValue(hit.value);
  const evidence = getCitableTextFromValue(hit.value);
  const [showQuote, setShowQuote] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 12.5,
          lineHeight: 1.45,
          color: 'var(--ink)',
          wordBreak: 'break-word',
        }}
      >
        {text || <span style={{ fontStyle: 'italic', color: 'var(--ink-faint)' }}>(empty)</span>}
        {evidence && (
          <button
            type="button"
            onClick={() => setShowQuote((s) => !s)}
            title={evidence}
            style={{
              marginLeft: 6,
              fontSize: 10,
              color: 'var(--ink-faint)',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 3,
              padding: '0 4px',
              cursor: 'pointer',
              verticalAlign: 'middle',
            }}
          >
            quote
          </button>
        )}
      </div>
      {evidence && showQuote && (
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 11.5,
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 3,
            padding: '4px 6px',
            lineHeight: 1.4,
          }}
        >
          &ldquo;{evidence}&rdquo;
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          color: 'var(--ink-faint)',
          letterSpacing: '.04em',
        }}
        title={hit.provision.category}
      >
        from {hit.provision.category || hit.provision.type}
      </div>
    </div>
  );
}

const HUMANIZE_OVERRIDES = {
  mae: 'MAE',
  hsr: 'HSR',
  ip: 'IP',
};
function humanizeKey(k) {
  if (!k) return '';
  return String(k)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .map((w) => HUMANIZE_OVERRIDES[w] || (w[0] || '').toUpperCase() + w.slice(1))
    .join(' ');
}

/* ─── Default table view: rows × deals ───────────────────── */
function CompareTable({ deals, rows, onSelectRow, loading }) {
  if (loading && rows.length === 0) {
    return (
      <div style={{ padding: 30, color: 'var(--ink-faint)', fontSize: 13 }}>Loading provisions…</div>
    );
  }
  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, color: 'var(--ink-faint)', fontSize: 13, fontStyle: 'italic' }}>
        No provisions in this category across the selected deals.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px 80px' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: 12.5,
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: 220 }} />
          {deals.map((d) => (
            <col key={d.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={hdrCellStyle()}>Provision</th>
            {deals.map((d) => (
              <th key={d.id} style={hdrCellStyle()}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-faint)',
                  }}
                >
                  {d.agreement_type || 'Acquisition'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginTop: 2,
                  }}
                >
                  {d.acquirer}{' '}
                  <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>/</span>{' '}
                  {d.target}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={() => onSelectRow(row.key)}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--paper)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '';
              }}
            >
              <td style={rowLabelCellStyle(row.type)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: typeHex(row.type),
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9.5,
                      color: 'var(--ink-faint)',
                      letterSpacing: '.06em',
                    }}
                  >
                    {row.type}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    fontSize: 13,
                    lineHeight: 1.3,
                  }}
                >
                  {row.label}
                </div>
              </td>
              {row.perDeal.map((p, i) => (
                <td key={i} style={cellStyle()}>
                  {p ? <CellSnippet provision={p} /> : <EmptyCell />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hdrCellStyle() {
  return {
    textAlign: 'left',
    background: 'var(--surface)',
    padding: '10px 12px',
    borderBottom: '1px solid var(--line)',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  };
}

function rowLabelCellStyle(type) {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line-soft)',
    borderLeft: `3px solid ${typeHex(type)}`,
    background: 'var(--surface)',
    verticalAlign: 'top',
    minWidth: 180,
  };
}

function cellStyle() {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--line-soft)',
    borderLeft: '1px solid var(--line-soft)',
    verticalAlign: 'top',
    background: 'var(--surface)',
  };
}

function EmptyCell() {
  return (
    <div
      style={{
        color: 'var(--ink-faint)',
        fontStyle: 'italic',
        fontSize: 12,
      }}
    >
      —
    </div>
  );
}

function CellSnippet({ provision }) {
  const fav = (provision.ai_favorability || '').toLowerCase();
  const favColor =
    fav.includes('buyer') ? 'var(--buyer)' :
    fav.includes('seller') ? 'var(--seller)' :
    'var(--neutral)';
  const text = (provision.full_text || '').trim();
  const snippet = text.length > 280 ? text.slice(0, 280) + '…' : text;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {provision.ai_favorability && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: favColor,
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{ width: 5, height: 5, borderRadius: '50%', background: favColor }}
          />
          {provision.ai_favorability}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 12.5,
          lineHeight: 1.45,
          color: 'var(--ink-light)',
        }}
      >
        {snippet || <span style={{ fontStyle: 'italic', color: 'var(--ink-faint)' }}>(no text)</span>}
      </div>
    </div>
  );
}

/* ─── Side-by-side detail panel ──────────────────────────── */
function SideBySideDetail({ row, deals, onClose }) {
  const router = useRouter();
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px 80px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          onClick={onClose}
          style={{
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink-mid)',
            padding: '5px 10px',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          ← Back to table
        </button>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-faint)',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
          }}
        >
          {row.type} · {row.label}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${deals.length}, minmax(280px, 1fr))`,
          gap: 16,
        }}
      >
        {deals.map((deal, i) => {
          const p = row.perDeal[i];
          return (
            <DetailCard
              key={deal.id}
              deal={deal}
              provision={p}
              rowType={row.type}
              onOpenInReview={() => {
                if (p) router.push(`/review/${deal.id}?provision=${p.id}`);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function DetailCard({ deal, provision, rowType, onOpenInReview }) {
  const hex = typeHex(rowType);
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderTop: `3px solid ${hex}`,
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
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
            fontSize: 15.5,
            fontWeight: 500,
            color: 'var(--ink)',
          }}
        >
          {deal.acquirer} <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>/</span>{' '}
          {deal.target}
        </div>
      </header>

      {provision ? (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {provision.ai_favorability && (
            <FavTag fav={provision.ai_favorability} />
          )}
          {provision.full_text && (
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {provision.full_text}
            </div>
          )}
          {(() => {
            const f = readFeatures(provision);
            return Object.keys(f).length > 0 ? <FeaturesBlock features={f} /> : null;
          })()}
          <button
            onClick={onOpenInReview}
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink-mid)',
              padding: '6px 12px',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Open in review →
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: '36px 16px',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          Not present in this deal.
        </div>
      )}
    </section>
  );
}

function FavTag({ fav }) {
  const lower = (fav || '').toLowerCase();
  const color =
    lower.includes('buyer') ? 'var(--buyer)' :
    lower.includes('seller') ? 'var(--seller)' :
    'var(--neutral)';
  return (
    <span
      style={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: 10.5,
        color,
        fontWeight: 600,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {fav}
    </span>
  );
}

function FeaturesBlock({ features }) {
  // Render a compact key/value list of structured features. Keys with array
  // values get bullets; nested objects get stringified.
  const entries = Object.entries(features).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && Object.keys(v).length === 0) return false;
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <div
      style={{
        borderTop: '1px solid var(--line-soft)',
        paddingTop: 10,
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        Features
      </div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: 11.5 }}>
          <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{k}</span>
          <span style={{ color: 'var(--ink-mid)' }}>{formatFeatureValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

function formatFeatureValue(v) {
  if (v == null) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === 'object' ? (x.text || x.label || x.code || JSON.stringify(x)) : String(x)))
      .join(', ');
  }
  if (typeof v === 'object') {
    // Citable wrapper { value, text } — render the value only here; the
    // SummaryCell shows the supporting quote on hover. Tagged items have
    // `code` and prefer the label.
    if ('value' in v && !('code' in v)) {
      return formatFeatureValue(v.value);
    }
    return v.text || v.label || v.code || JSON.stringify(v);
  }
  return String(v);
}

function getCitableTextFromValue(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if ('value' in v && !('code' in v) && typeof v.text === 'string' && v.text.trim()) {
    return v.text.trim();
  }
  return null;
}
