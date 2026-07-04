import { useState, useMemo } from 'react';
import {
  SIDEBAR_GROUPS,
  SYNTHETIC_SINGLE_PAGE_TYPES,
  typeColor,
  typeHex,
  getProvisionStatus,
} from './shared';
import { useViewMode } from '../ViewModeContext';

/* Short disambiguating label for one clause inside a merged multi-provision
   sidebar entry. Prefer a leading "Section X.YZ" / "Article" reference; else the
   first few words of the clause text; else an ordinal. */
function sideClauseSubLabel(p, i) {
  const text = (p && (p.full_text || p.text)) || '';
  const secRef = text.match(/^\s*(Section\s+\d+\.\d+[A-Za-z()]*|Article\s+[IVXLC]+)/i);
  if (secRef) return secRef[1].replace(/\s+/g, ' ').trim();
  const words = text.replace(/\[\[[^\]]*\]\]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  if (words) return words.length > 40 ? `${words.slice(0, 39)}…` : words;
  return `Clause ${i + 1}`;
}

/* ═══════════════════════════════════════════════════════════
   LEFT SIDEBAR — now acts as a FILTER, not a scroller
   ═══════════════════════════════════════════════════════════ */
export function Sidebar({ provsByType, provisions, activeFilter, onFilterType, onSelectProvision, activeProvId, onMoveProvision, onClose }) {
  const { isEdit } = useViewMode();
  // Drag-and-drop state: track the provision being dragged and the active
  // drop-target type so we can highlight it.
  const [dragProvId, setDragProvId] = useState(null);
  const [dropTargetType, setDropTargetType] = useState(null);

  // Drag-and-drop reclassification is an edit/correction control — disabled
  // entirely in user view (no-op the start/drop handlers rather than
  // threading `draggable={isEdit}` through every row).
  const handleDragStart = (e, provId) => {
    if (!isEdit) return;
    setDragProvId(provId);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(provId));
    } catch {
      // some browsers throw if setData is called too late — ignore
    }
  };
  const handleDragEnd = () => {
    setDragProvId(null);
    setDropTargetType(null);
  };
  const handleDragOver = (e, type) => {
    if (!dragProvId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetType !== type) setDropTargetType(type);
  };
  const handleDragLeave = (type) => {
    if (dropTargetType === type) setDropTargetType(null);
  };
  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEdit) return;
    const provId = dragProvId || e.dataTransfer.getData('text/plain');
    setDragProvId(null);
    setDropTargetType(null);
    if (!provId || !type) return;
    const prov = provisions.find((p) => String(p.id) === String(provId));
    if (!prov) return;
    if (prov.type === type) return; // no-op
    if (onMoveProvision) onMoveProvision(prov, type);
  };

  // Build the visible group structure — skip groups (and child types) with 0 provisions.
  // For DEF (Definitions), sort provisions alphabetically by category (the defined term).
  const sortDefsIfNeeded = (type, provs) => {
    if (type !== 'DEF') return provs;
    return [...provs].sort((a, b) =>
      String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' })
    );
  };

  const visibleGroups = useMemo(() => {
    return SIDEBAR_GROUPS
      .map((g) => {
        if (g.children && g.children.length > 0) {
          const childRows = g.children.map((c) => ({
            ...c,
            provs: sortDefsIfNeeded(c.type, provsByType[c.type] || []),
          }));
          const total = childRows.reduce((acc, c) => acc + c.provs.length, 0);
          // Per user: MAE renders flat (no children) when the deal has a
          // SINGLE Material Adverse Effect definition — the typical case where
          // one MAE applies to both Parent and Company. Show children only
          // when separate per-party definitions exist (or, in edge cases, more
          // than one MAE provision overall).
          const isMaeGroup = g.label === 'Material Adverse Effect';
          if (isMaeGroup && total === 1) {
            const sole = childRows.find((c) => c.provs.length > 0);
            return {
              label: g.label,
              types: sole ? [sole.type] : [],
              total: 1,
              provs: sole ? sole.provs : [],
              singleType: sole ? sole.type : null,
              maeAppliesToBoth: true,
            };
          }
          // For IOC, Termination Rights, and No-Solicitation: when any child
          // has content, keep ALL party-typed children visible (empty ones
          // read e.g. "Buyer / Parent (0)" with a "Not present" page when
          // clicked). For all other groups, drop children with zero
          // provisions as before.
          const isIocGroup = g.label === 'Interim Operating Covenants';
          const isTermrGroup = g.label === 'Termination Rights';
          const isNosolGroup = g.label === 'No-Solicitation / No-Shop';
          const presentChildren = (isIocGroup || isTermrGroup || isNosolGroup) && total > 0
            ? childRows
            : childRows.filter((c) => c.provs.length > 0);
          return { label: g.label, children: presentChildren, types: presentChildren.map((c) => c.type), total };
        }
        const types = (g.types || []).filter((t) => (provsByType[t] || []).length > 0);
        const total = types.reduce((acc, t) => acc + (provsByType[t] || []).length, 0);
        // For a single-type flat group, collect the provisions list for direct expansion.
        const provs = types.length === 1 ? sortDefsIfNeeded(types[0], provsByType[types[0]] || []) : [];
        return { label: g.label, types, total, provs, singleType: types.length === 1 ? types[0] : null };
      })
      .filter((g) => g.total > 0);
  }, [provsByType]);

  // Track collapsed state per parent group label and per child type code.
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    const init = {};
    SIDEBAR_GROUPS.forEach((g) => { init[g.label] = true; });
    return init;
  });
  const [collapsedTypes, setCollapsedTypes] = useState(() => {
    const init = {};
    Object.keys(provsByType).forEach((t) => { init[t] = true; });
    return init;
  });
  // Collapsed state for merged multi-provision category entries, keyed by
  // `${type}::${category}`. Default collapsed so a category that holds several
  // clauses reads as ONE sidebar row until expanded.
  const [collapsedCats, setCollapsedCats] = useState({});
  const toggleCat = (key) => setCollapsedCats((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  const [allCollapsed, setAllCollapsed] = useState(true);

  const toggleGroup = (label) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };
  const toggleType = (type) => {
    setCollapsedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCollapseAll = () => {
    if (allCollapsed) {
      // Expand all: set EVERY group/type to explicit false. The renderer
      // treats undefined as collapsed (collapsedGroups[label] !== false),
      // so leaving the maps empty would not actually expand anything.
      const groupsInit = {};
      SIDEBAR_GROUPS.forEach((g) => { groupsInit[g.label] = false; });
      const typesInit = {};
      Object.keys(provsByType).forEach((t) => { typesInit[t] = false; });
      setCollapsedGroups(groupsInit);
      setCollapsedTypes(typesInit);
      setAllCollapsed(false);
    } else {
      const groupsInit = {};
      SIDEBAR_GROUPS.forEach((g) => { groupsInit[g.label] = true; });
      const typesInit = {};
      Object.keys(provsByType).forEach((t) => { typesInit[t] = true; });
      setCollapsedGroups(groupsInit);
      setCollapsedTypes(typesInit);
      setAllCollapsed(true);
    }
  };

  const stats = useMemo(() => {
    const total = provisions.length;
    const approved = provisions.filter(p => getProvisionStatus(p) === 'approved').length;
    const flagged = provisions.filter(p => getProvisionStatus(p) === 'flagged').length;
    return { total, approved, flagged };
  }, [provisions]);

  // Status-color tokens for sidebar provision dots (Corpus palette).
  // Approved/flagged is the editor's QA workflow status — in user view every
  // dot stays neutral so it doesn't leak review-state to a non-editor.
  const statusDotColor = (status) => {
    if (!isEdit) return 'var(--ink-faint)';
    if (status === 'approved') return 'var(--buyer)';
    if (status === 'flagged')  return 'var(--accent)';
    return 'var(--ink-faint)';
  };

  // A single draggable provision row.
  const renderProvRow = (p, { indent = 18 } = {}) => {
    const status = getProvisionStatus(p);
    const isActive = p.id === activeProvId;
    const isDragging = dragProvId === p.id;
    return (
      <button
        key={p.id}
        draggable={isEdit}
        onDragStart={(e) => handleDragStart(e, p.id)}
        onDragEnd={handleDragEnd}
        onClick={() => onSelectProvision(p.id)}
        className={`rec-side-item${isActive ? ' active' : ''}`}
        style={{
          fontSize: 12.5,
          padding: '5px 10px',
          marginLeft: indent - 18,
          cursor: isDragging ? 'grabbing' : 'grab',
          opacity: isDragging ? 0.4 : 1,
        }}
        title={isEdit ? "Drag to a different category to reclassify" : undefined}
      >
        <span className="dot" style={{ background: statusDotColor(status) }} />
        <span className="truncate">{p.category || 'General'}</span>
      </button>
    );
  };

  // Render the per-provision list under a type. Provisions that share the same
  // category label are MERGED into a single entry (with a count badge) that
  // expands to the individual clauses on click — so e.g. two "Specific
  // Performance; Enforcement" clauses read as one row, not a confusing
  // duplicate. The type prop scopes the per-category collapse state.
  const renderProvList = (provs, type) => {
    // Group preserving first-seen order.
    const order = [];
    const byCat = new Map();
    for (const p of provs) {
      const cat = p.category || 'General';
      if (!byCat.has(cat)) { byCat.set(cat, []); order.push(cat); }
      byCat.get(cat).push(p);
    }
    return (
      <div className="mt-0.5" style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {order.map((cat) => {
          const items = byCat.get(cat);
          if (items.length === 1) return renderProvRow(items[0]);
          // Merged multi-provision entry.
          const key = `${type || items[0].type}::${cat}`;
          const expanded = collapsedCats[key] === false;
          const anyActive = items.some((p) => p.id === activeProvId);
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <button
                onClick={() => toggleCat(key)}
                className={`rec-side-item${anyActive && !expanded ? ' active' : ''}`}
                style={{ fontSize: 12.5, padding: '5px 10px' }}
                title={`${items.length} clauses under “${cat}” — click to ${expanded ? 'collapse' : 'expand'}`}
              >
                <span className="dot" style={{ background: 'var(--ink-faint)' }} />
                <span className="truncate" style={{ flex: 1 }}>{cat}</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginLeft: 4 }}>
                  {items.length}
                </span>
                <span style={{ fontSize: 9, color: 'var(--ink-faint)', marginLeft: 4 }}>
                  {expanded ? '▾' : '▸'}
                </span>
              </button>
              {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {items.map((p, i) => {
                    const status = getProvisionStatus(p);
                    const isActive = p.id === activeProvId;
                    const isDragging = dragProvId === p.id;
                    // Sub-label: prefer a section ref / first words to disambiguate.
                    const sub = sideClauseSubLabel(p, i);
                    return (
                      <button
                        key={p.id}
                        draggable={isEdit}
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectProvision(p.id)}
                        className={`rec-side-item${isActive ? ' active' : ''}`}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px 4px 26px',
                          cursor: isDragging ? 'grabbing' : 'grab',
                          opacity: isDragging ? 0.4 : 1,
                        }}
                        title={isEdit ? "Drag to a different category to reclassify" : undefined}
                      >
                        <span className="dot" style={{ background: statusDotColor(status) }} />
                        <span className="truncate" style={{ color: 'var(--ink-light)' }}>{sub}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside
      className="shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        width: 286,
        maxWidth: '86vw',
        background: 'var(--surface)',
        borderRight: '1px solid var(--line)',
      }}
    >
      {/* Provisions Navigation */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '18px 14px' }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: '0 8px 10px' }}
        >
          <span className="rec-side-eyebrow">Provisions</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCollapseAll}
              className="rec-side-eyebrow"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent-deep)',
              }}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-inkLight hover:text-ink transition-colors rounded hover:bg-paper"
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="1" y="2" width="14" height="12" rx="1" />
                  <path d="M5 2v12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* "All" filter button */}
          <button
            onClick={() => onFilterType(null)}
            className={`rec-side-item${activeFilter === null ? ' active' : ''}`}
          >
            <span
              className="dot"
              style={{ background: activeFilter === null ? 'var(--accent)' : 'var(--ink-faint)' }}
            />
            <span style={{ fontWeight: 600 }}>All provisions</span>
            <span className="count">{provisions.length}</span>
          </button>
          <div style={{ height: 6 }} />

          {visibleGroups.map((group) => {
            const groupCollapsed = collapsedGroups[group.label] !== false;
            const hasChildren = Array.isArray(group.children) && group.children.length > 0;
            const isFlatGroup = !hasChildren;
            // Determine the active filter's type set so we can detect when
            // the user has clicked this parent's combined view.
            const activeTypeSet = activeFilter === null
              ? []
              : (Array.isArray(activeFilter) ? activeFilter : [activeFilter]);
            // A group is the active filter when its full type set equals the
            // active filter's type set (so parent-combined and single-child
            // clicks render distinct active states).
            const groupTypes = hasChildren
              ? group.children.map((c) => c.type)
              : group.types;
            const groupTypeKey = [...groupTypes].sort().join(',');
            const activeTypeKey = [...activeTypeSet].sort().join(',');
            const isActiveFilter = groupTypeKey === activeTypeKey && activeTypeSet.length > 0;
            // Aggregate dot color: use first child/type's color.
            const repType = hasChildren ? group.children[0].type : group.types[0];
            const tc = typeColor(repType);

            // For flat groups, drops on the parent heading move the provision
            // to the group's primary type. For groups with children, the parent
            // heading is not itself a drop target (the children handle it).
            // Synthetic single-page groups (e.g. Material Contracts) are never
            // drop targets — dropping would "reclassify" to a UI-only type.
            const flatPrimaryType = isFlatGroup ? (group.singleType || group.types[0]) : null;
            const flatIsSynthetic = !!flatPrimaryType && SYNTHETIC_SINGLE_PAGE_TYPES.has(flatPrimaryType);
            const flatDropType = flatPrimaryType && !flatIsSynthetic ? flatPrimaryType : null;
            const isParentDropTarget = !!dragProvId && flatDropType && dropTargetType === flatDropType;
            // Parent groups with children get a combined-filter click handler
            // that passes all child types as an array.
            const parentClickHandler = isFlatGroup
              ? () => {
                  onFilterType(group.singleType || group.types[0]);
                  if (groupCollapsed) {
                    setCollapsedGroups((prev) => ({ ...prev, [group.label]: false }));
                  }
                }
              : () => {
                  onFilterType(group.children.map((c) => c.type));
                  if (groupCollapsed) {
                    setCollapsedGroups((prev) => ({ ...prev, [group.label]: false }));
                  }
                };
            return (
              <div key={group.label}>
                {/* Parent group heading */}
                <div
                  className={`rec-side-item${isActiveFilter ? ' active' : ''}`}
                  style={{
                    boxShadow: isParentDropTarget ? '0 0 0 2px var(--accent)' : 'none',
                  }}
                  onClick={parentClickHandler}
                  onDragOver={flatDropType ? (e) => handleDragOver(e, flatDropType) : undefined}
                  onDragLeave={flatDropType ? () => handleDragLeave(flatDropType) : undefined}
                  onDrop={flatDropType ? (e) => handleDrop(e, flatDropType) : undefined}
                  title={hasChildren ? `Show all ${group.label.toLowerCase()} combined` : undefined}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleGroup(group.label); }}
                    style={{
                      width: 16,
                      height: 16,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink-faint)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    aria-label={groupCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {groupCollapsed ? '+' : '–'}
                  </button>
                  <span className="dot" style={{ background: typeHex(repType) }} />
                  <span className="truncate" style={{ fontWeight: isActiveFilter ? 600 : 500 }}>
                    {group.label}
                    {group.maeAppliesToBoth && (
                      <span
                        className="italic"
                        style={{ color: 'var(--ink-faint)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}
                      >
                        (applies to Parent and Company)
                      </span>
                    )}
                  </span>
                  {/* Synthetic single-page groups: the label IS the page —
                      no count (matches the child-row treatment). */}
                  {!flatIsSynthetic && <span className="count">{group.total}</span>}
                </div>

                {/* Group expanded content */}
                {!groupCollapsed && (
                  <div>
                    {hasChildren ? (
                      <div
                        className="mt-0.5"
                        style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1 }}
                      >
                        {group.children.map((child) => {
                          const childCollapsed = collapsedTypes[child.type] !== false;
                          const childActive = activeFilter === child.type;
                          const isChildDropTarget = !!dragProvId && dropTargetType === child.type;
                          return (
                            <div key={child.type}>
                              <div
                                className={`rec-side-item${childActive ? ' active' : ''}`}
                                style={{
                                  fontSize: 12.5,
                                  padding: '5px 10px',
                                  boxShadow: isChildDropTarget ? '0 0 0 2px var(--accent)' : 'none',
                                }}
                                onClick={() => {
                                  onFilterType(child.type);
                                  if (childCollapsed) {
                                    setCollapsedTypes((prev) => ({ ...prev, [child.type]: false }));
                                  }
                                }}
                                onDragOver={(e) => handleDragOver(e, child.type)}
                                onDragLeave={() => handleDragLeave(child.type)}
                                onDrop={(e) => handleDrop(e, child.type)}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleType(child.type); }}
                                  style={{
                                    width: 14,
                                    height: 14,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--ink-faint)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 11,
                                    lineHeight: 1,
                                    flexShrink: 0,
                                  }}
                                  aria-label={childCollapsed ? 'Expand' : 'Collapse'}
                                >
                                  {childCollapsed ? '+' : '–'}
                                </button>
                                <span className="dot" style={{ background: typeHex(child.type) }} />
                                <span className="truncate">{child.label}</span>
                                {/* MAE / Material Contracts children are
                                    single-page synthetic groups — the child
                                    label IS the page, so don't show a count or
                                    a redundant per-provision sub-list under it
                                    (that's what duplicated "material adverse
                                    effect" beneath the child). */}
                                {!SYNTHETIC_SINGLE_PAGE_TYPES.has(child.type) && (
                                  <span className="count">{child.provs.length}</span>
                                )}
                              </div>
                              {!childCollapsed && !SYNTHETIC_SINGLE_PAGE_TYPES.has(child.type) && renderProvList(child.provs, child.type)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Flat group: directly render its provisions list.
                      // Synthetic single-page groups (Material Contracts) ARE
                      // the page — no per-provision sub-list under them.
                      !SYNTHETIC_SINGLE_PAGE_TYPES.has(group.singleType) && renderProvList(group.provs, group.singleType)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Footer (Corpus style) — editor QA workflow (approved /
          flagged / unreviewed counts), not deal content. Editors only. */}
      {isEdit && (
        <div className="rec-side-stats">
          <div className="rec-stat-bar">
            {stats.total > 0 && (
              <>
                <i style={{ width: `${(stats.approved / stats.total) * 100}%`, background: 'var(--buyer)' }} />
                <i style={{ width: `${(stats.flagged / stats.total) * 100}%`, background: 'var(--accent)' }} />
                <i style={{ flex: 1, background: 'var(--ink-faint)' }} />
              </>
            )}
          </div>
          <div className="rec-stat-row">
            <span className="lab">Approved</span>
            <span className="num">{stats.approved}</span>
          </div>
          <div className="rec-stat-row">
            <span className="lab">Needs review</span>
            <span className="num">{stats.flagged}</span>
          </div>
          <div className="rec-stat-row">
            <span className="lab">Unreviewed</span>
            <span className="num">{Math.max(0, stats.total - stats.approved - stats.flagged)}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
