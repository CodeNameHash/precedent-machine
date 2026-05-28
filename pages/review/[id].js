import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeal, useProvisions } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';
import { useToast } from '../../lib/useToast';
import { Breadcrumbs, SkeletonCard, EmptyState } from '../../components/UI';

/* ── Type & Category Labels ── */
const TYPE_LABELS = {
  'MAE-T': 'Material Adverse Effect (Target)',
  'MAE-B': 'Material Adverse Effect (Buyer)',
  'MAE': 'Material Adverse Effect',
  'IOC-T': 'Interim Operating Covenants (Target)',
  'IOC-B': 'Interim Operating Covenants (Buyer)',
  'IOC': 'Interim Operating Covenants',
  'COND-M': 'Conditions to Closing (Mutual)',
  'COND-B': 'Conditions to Closing (Buyer)',
  'COND-S': 'Conditions to Closing (Seller)',
  'COND': 'Conditions to Closing',
  'NOSOL': 'No-Solicitation / No-Shop',
  'ANTI': 'Antitrust / Regulatory',
  'TERMR-M': 'Termination Rights (Mutual)',
  'TERMR-B': 'Termination Rights (Buyer)',
  'TERMR-T': 'Termination Rights (Target)',
  'TERMR': 'Termination Rights',
  'TERMF': 'Termination Fees & Expenses',
  'REP-T': 'Representations & Warranties (Target)',
  'REP-B': 'Representations & Warranties (Buyer)',
  'REP': 'Representations & Warranties',
  'COV': 'Other Covenants',
  'DEF': 'Definitions',
  'STRUCT': 'Structure & Mechanics',
  'CONSID': 'Consideration',
  'MISC': 'Miscellaneous / Boilerplate',
};

function typeLabel(code) {
  return TYPE_LABELS[code] || code;
}

/* ── Provision Type Colors (pastel backgrounds for highlights) ── */
const TYPE_COLORS = {
  'MAE':    { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'MAE-T':  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'MAE-B':  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800',    dot: 'bg-red-400',    hex: '#fef2f2' },
  'IOC':    { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'IOC-T':  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'IOC-B':  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-800',  dot: 'bg-amber-400',  hex: '#fffbeb' },
  'COND':   { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400',   hex: '#eff6ff' },
  'COND-M': { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400',   hex: '#eff6ff' },
  'COND-B': { bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-800',    dot: 'bg-sky-400',    hex: '#f0f9ff' },
  'COND-S': { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-400', hex: '#eef2ff' },
  'NOSOL':  { bg: 'bg-purple-50',  border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400', hex: '#faf5ff' },
  'ANTI':   { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-800',   dot: 'bg-teal-400',   hex: '#f0fdfa' },
  'TERMR':  { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-M':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-B':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMR-T':{ bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800', dot: 'bg-orange-400', hex: '#fff7ed' },
  'TERMF':  { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-800',   dot: 'bg-rose-400',   hex: '#fff1f2' },
  'REP':    { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-T':  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-800',dot: 'bg-emerald-400',hex: '#ecfdf5' },
  'REP-B':  { bg: 'bg-green-50',   border: 'border-green-200',  text: 'text-green-800',  dot: 'bg-green-400',  hex: '#f0fdf4' },
  'COV':    { bg: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-800',   dot: 'bg-cyan-400',   hex: '#ecfeff' },
  'DEF':    { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
  'STRUCT': { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-800', dot: 'bg-violet-400', hex: '#f5f3ff' },
  'CONSID': { bg: 'bg-lime-50',    border: 'border-lime-200',   text: 'text-lime-800',   dot: 'bg-lime-400',   hex: '#f7fee7' },
  'MISC':   { bg: 'bg-stone-50',   border: 'border-stone-200',  text: 'text-stone-700',  dot: 'bg-stone-400',  hex: '#fafaf9' },
};

function typeColor(code) {
  return TYPE_COLORS[code] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400', hex: '#f9fafb' };
}

const FAV_LABELS = {
  'strong-buyer': { label: 'Strong Buyer', cls: 'bg-buyer/10 text-buyer' },
  'mod-buyer':    { label: 'Mod. Buyer',   cls: 'bg-buyer/10 text-buyer' },
  'buyer':        { label: 'Buyer',         cls: 'bg-buyer/10 text-buyer' },
  'neutral':      { label: 'Neutral',       cls: 'bg-gray-100 text-inkLight' },
  'mod-seller':   { label: 'Mod. Seller',   cls: 'bg-seller/10 text-seller' },
  'strong-seller':{ label: 'Strong Seller', cls: 'bg-seller/10 text-seller' },
  'seller':       { label: 'Seller',        cls: 'bg-seller/10 text-seller' },
};

function favBadge(fav) {
  return FAV_LABELS[(fav || '').toLowerCase()] || FAV_LABELS.neutral;
}

/* ── Review Status ── */
const STATUS = {
  approved: { label: 'Approved', dot: 'bg-buyer', cls: 'text-buyer' },
  flagged:  { label: 'Needs Review', dot: 'bg-amber-400', cls: 'text-amber-600' },
  unreviewed: { label: 'Unreviewed', dot: 'bg-inkFaint', cls: 'text-inkFaint' },
};

function getProvisionStatus(p) {
  if (p._status === 'approved') return 'approved';
  if (p._status === 'flagged') return 'flagged';
  return 'unreviewed';
}

/* ── Parse features from ai_metadata ── */
function getFeatures(provision) {
  if (!provision.ai_metadata) return [];
  const meta = typeof provision.ai_metadata === 'string'
    ? (() => { try { return JSON.parse(provision.ai_metadata); } catch { return {}; } })()
    : provision.ai_metadata;
  if (meta.key_terms) return meta.key_terms;
  if (meta.features) return Object.entries(meta.features).map(([k, v]) => `${k}: ${v}`);
  return [];
}

/* ── Parse structured content from provision text ── */
function parseProvisionText(text) {
  if (!text) return { header: '', subclauses: [], exceptions: [] };

  const lines = text.split(/\n/);
  let header = '';
  const subclauses = [];
  const exceptions = [];
  let inExceptions = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect exception/carve-out lines
    const isException = /^(\((?:[ivxlcdm]+|[a-z]|\d+)\)|[-*]|•|except|provided|other than|excluding|notwithstanding)/i.test(trimmed);
    const isSubclause = /^(\([A-Z]\)|\(\d+\)|Section\s)/i.test(trimmed);

    if (!header && !isException && !isSubclause) {
      header = trimmed;
    } else if (isException || inExceptions) {
      inExceptions = true;
      exceptions.push(trimmed);
    } else if (isSubclause) {
      subclauses.push(trimmed);
    } else if (header) {
      // Additional text after header, before exceptions
      subclauses.push(trimmed);
    }
  }

  // If no structured content found, use first sentence as header
  if (!header && text.length > 0) {
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    header = firstSentence ? firstSentence[0] : text.substring(0, 200);
  }

  return { header, subclauses, exceptions };
}

/* ═══════════════════════════════════════════════════════════
   LEFT SIDEBAR — now acts as a FILTER, not a scroller
   ═══════════════════════════════════════════════════════════ */
function Sidebar({ provsByType, provisions, activeFilter, onFilterType, onSelectProvision, activeProvId }) {
  const [collapsed, setCollapsed] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(false);

  const toggleType = (type) => {
    setCollapsed(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCollapseAll = () => {
    if (allCollapsed) {
      // Expand all
      setCollapsed({});
      setAllCollapsed(false);
    } else {
      // Collapse all
      const newCollapsed = {};
      Object.keys(provsByType).forEach(type => { newCollapsed[type] = true; });
      setCollapsed(newCollapsed);
      setAllCollapsed(true);
    }
  };

  const stats = useMemo(() => {
    const total = provisions.length;
    const approved = provisions.filter(p => getProvisionStatus(p) === 'approved').length;
    const flagged = provisions.filter(p => getProvisionStatus(p) === 'flagged').length;
    return { total, approved, flagged };
  }, [provisions]);

  return (
    <div className="w-[280px] shrink-0 bg-white border-r border-border flex flex-col h-full overflow-hidden">
      {/* Provisions Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <div className="flex items-center justify-between px-2 mb-3">
          <h3 className="font-ui text-[10px] font-medium text-inkFaint uppercase tracking-wider">
            Provisions
          </h3>
          <button
            onClick={handleCollapseAll}
            className="text-[10px] font-ui text-accent hover:text-accent/80 transition-colors"
          >
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        </div>

        <div className="space-y-1">
          {/* "All" filter button */}
          <button
            onClick={() => onFilterType(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-ui transition-colors ${
              activeFilter === null
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-inkMid hover:bg-bg hover:text-ink'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0 bg-inkFaint" />
            <span className="font-medium">All Provisions</span>
            <span className="text-inkFaint text-xs ml-auto">({provisions.length})</span>
          </button>

          {Object.entries(provsByType).map(([type, provs]) => {
            const isCollapsed = collapsed[type];
            const tc = typeColor(type);
            const isActiveFilter = activeFilter === type;
            return (
              <div key={type}>
                <button
                  onClick={() => onFilterType(type)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm font-ui transition-colors group ${
                    isActiveFilter ? 'bg-accent/10' : 'hover:bg-bg'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tc.dot}`} />
                    <span className={`font-medium truncate ${isActiveFilter ? 'text-accent' : 'text-ink'}`}>
                      {typeLabel(type)}
                    </span>
                    <span className="text-inkFaint text-xs">({provs.length})</span>
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                    className={`text-inkFaint transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                    onClick={(e) => { e.stopPropagation(); toggleType(type); }}
                  >
                    <path d="M4 2l4 4-4 4" />
                  </svg>
                </button>
                {!isCollapsed && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {provs.map(p => {
                      const status = getProvisionStatus(p);
                      const st = STATUS[status];
                      const isActive = p.id === activeProvId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSelectProvision(p.id)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs font-ui transition-colors ${
                            isActive
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-inkMid hover:bg-bg hover:text-ink'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                          <span className="truncate">{p.category || 'General'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="border-t border-border px-4 py-3 space-y-1.5 bg-bg/50">
        <div className="flex items-center justify-between text-xs font-ui">
          <span className="text-inkLight">Total</span>
          <span className="text-ink font-medium">{stats.total}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-ui">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-buyer" />
            <span className="text-inkLight">Approved</span>
          </span>
          <span className="text-buyer font-medium">{stats.approved}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-ui">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-inkLight">Flagged</span>
          </span>
          <span className="text-amber-600 font-medium">{stats.flagged}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROVISION CARD — structured display with formatting
   ═══════════════════════════════════════════════════════════ */
function ProvisionCard({ provision, onEdit }) {
  const tc = typeColor(provision.type);
  const fav = favBadge(provision.ai_favorability);
  const status = getProvisionStatus(provision);
  const st = STATUS[status];
  const features = getFeatures(provision);
  const parsed = useMemo(() => parseProvisionText(provision.full_text), [provision.full_text]);

  return (
    <div
      id={`prov-${provision.id}`}
      onClick={() => onEdit(provision)}
      className={`bg-white border rounded-lg shadow-sm p-4 cursor-pointer hover:border-accent transition-colors ${tc.border}`}
    >
      {/* Header row: type badge + category + status */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium ${tc.bg} ${tc.text} ${tc.border} border`}>
          {typeLabel(provision.type)}
        </span>
        <span className="text-xs font-ui font-medium text-inkMid">{provision.category || 'General'}</span>
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-ui font-medium ${fav.cls}`}>
          {fav.label}
        </span>
      </div>

      {/* Structured provision content */}
      <div className="space-y-2">
        {/* Main concept/obligation as header */}
        {parsed.header && (
          <p className="font-body text-sm text-ink leading-relaxed font-medium">
            {parsed.header.length > 300 ? parsed.header.substring(0, 300) + '...' : parsed.header}
          </p>
        )}

        {/* Sub-clauses as indented items */}
        {parsed.subclauses.length > 0 && (
          <div className="ml-3 space-y-1">
            {parsed.subclauses.slice(0, 5).map((sc, i) => (
              <p key={i} className="font-body text-xs text-inkMid leading-relaxed flex items-start gap-1.5">
                <span className="text-inkFaint mt-0.5 shrink-0">--</span>
                <span>{sc.length > 200 ? sc.substring(0, 200) + '...' : sc}</span>
              </p>
            ))}
            {parsed.subclauses.length > 5 && (
              <p className="text-[10px] font-ui text-inkFaint italic">
                +{parsed.subclauses.length - 5} more sub-clauses
              </p>
            )}
          </div>
        )}

        {/* Exceptions/carve-outs as bulleted list */}
        {parsed.exceptions.length > 0 && (
          <div className="ml-3 mt-1 pl-3 border-l-2 border-amber-200 bg-amber-50/50 rounded-r py-1">
            <p className="text-[10px] font-ui font-medium text-amber-700 uppercase tracking-wider mb-1">
              Exceptions / Carve-outs
            </p>
            <ul className="space-y-0.5">
              {parsed.exceptions.slice(0, 4).map((ex, i) => (
                <li key={i} className="font-body text-xs text-inkMid leading-relaxed flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5 shrink-0">&bull;</span>
                  <span>{ex.length > 200 ? ex.substring(0, 200) + '...' : ex}</span>
                </li>
              ))}
              {parsed.exceptions.length > 4 && (
                <li className="text-[10px] font-ui text-inkFaint italic ml-4">
                  +{parsed.exceptions.length - 4} more exceptions
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Fallback: if no structured content, show raw text */}
        {!parsed.header && parsed.subclauses.length === 0 && parsed.exceptions.length === 0 && provision.full_text && (
          <p className="font-body text-sm text-ink leading-relaxed line-clamp-3">
            {provision.full_text}
          </p>
        )}
      </div>

      {/* Features as chips */}
      {features.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {features.map((f, i) => (
            <span key={i} className="text-[10px] font-ui px-2 py-0.5 rounded bg-bg text-inkMid border border-border">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FULL DOCUMENT VIEW — reconstructed from provisions
   ═══════════════════════════════════════════════════════════ */
function FullDocumentView({ provisions, onEditProvision }) {
  // Sort provisions in agreement order: sort_order first, then by section
  // number (e.g. "1.01" < "1.02" < "2.01"), then by startChar / id.
  // No grouping by type — render top-to-bottom like reading on EDGAR.
  const sorted = useMemo(() => {
    const parseSectionNum = (s) => {
      if (!s) return [Infinity, Infinity];
      const m = String(s).match(/(\d+)\.(\d+)/);
      if (!m) return [Infinity, Infinity];
      return [parseInt(m[1], 10), parseInt(m[2], 10)];
    };

    return [...provisions].sort((a, b) => {
      // 1. sort_order (most reliable)
      if (a.sort_order != null && b.sort_order != null) {
        return a.sort_order - b.sort_order;
      }
      if (a.sort_order != null) return -1;
      if (b.sort_order != null) return 1;

      // 2. Section number (e.g. "1.01" vs "1.02")
      const aSec = a.section_number || a.sectionNumber;
      const bSec = b.section_number || b.sectionNumber;
      const [aMaj, aMin] = parseSectionNum(aSec);
      const [bMaj, bMin] = parseSectionNum(bSec);
      if (aMaj !== bMaj) return aMaj - bMaj;
      if (aMin !== bMin) return aMin - bMin;

      // 3. Character position in source
      const aStart = a.start_char ?? a.startChar ?? Infinity;
      const bStart = b.start_char ?? b.startChar ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;

      // 4. Stable fallback
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [provisions]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-inkFaint font-ui">No provisions to display.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-6 md:p-8">
      <div className="space-y-0">
        {sorted.map((p, idx) => {
          const tc = typeColor(p.type);
          const fav = favBadge(p.ai_favorability);
          return (
            <div
              key={p.id}
              className={`relative border-l-3 pl-4 py-3 cursor-pointer hover:opacity-90 transition-opacity ${tc.border}`}
              style={{ backgroundColor: tc.hex || '#f9fafb', borderLeftWidth: '3px' }}
              onClick={() => onEditProvision(p)}
            >
              {/* Floating label */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border ${tc.border} ${tc.bg} ${tc.text}`}>
                  {typeLabel(p.type)}
                </span>
                <span className="text-[10px] font-ui text-inkMid">{p.category || 'General'}</span>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-ui font-medium ${fav.cls}`}>
                  {fav.label}
                </span>
              </div>

              {/* Provision text */}
              <p className="font-body text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
                {p.full_text || '(no text)'}
              </p>

              {/* Separator between provisions */}
              {idx < sorted.length - 1 && (
                <div className="absolute bottom-0 left-4 right-0 border-b border-border/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROVISION LABEL (floating pill on highlighted text)
   ═══════════════════════════════════════════════════════════ */
function ProvisionLabel({ provision, isExpanded, onToggle, onEdit }) {
  const tc = typeColor(provision.type);
  const fav = favBadge(provision.ai_favorability);
  const features = getFeatures(provision);
  const fullLabel = `${typeLabel(provision.type)} > ${provision.category || 'General'}`;

  return (
    <div className="relative inline-block">
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border transition-all cursor-pointer ${tc.border} ${tc.bg} ${tc.text}`}
      >
        <span className="truncate max-w-[280px]">{fullLabel}</span>
      </button>
      {isExpanded && (
        <div
          className="absolute left-0 top-full mt-1 z-30 bg-white border border-border rounded-lg shadow-lg p-3 min-w-[280px] max-w-[360px] animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div>
              <p className="text-xs font-ui font-medium text-ink">{typeLabel(provision.type)}</p>
              <p className="text-xs font-ui text-inkMid">{provision.category || 'General'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-ui font-medium ${fav.cls}`}>
                {fav.label}
              </span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-ui ${STATUS[getProvisionStatus(provision)].cls}`}>
                {STATUS[getProvisionStatus(provision)].label}
              </span>
            </div>
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {features.map((f, i) => (
                  <span key={i} className="text-[10px] font-ui px-2 py-0.5 rounded bg-bg text-inkMid border border-border">
                    {f}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(provision); }}
              className="w-full px-3 py-1.5 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HIGHLIGHTED DOCUMENT RENDERER (for agreement source text)
   ═══════════════════════════════════════════════════════════ */
function DocumentRenderer({
  sourceText,
  provisions,
  expandedLabel,
  onToggleLabel,
  onEditProvision,
  onTextSelect,
  provisionRefs,
  definitionTerms,
  hoveredDef,
  onDefHover,
  onDefLeave,
}) {
  // Build highlight regions by matching provision text against source
  const regions = useMemo(() => {
    if (!sourceText) return [];
    const found = [];
    const lowerSource = sourceText.toLowerCase();

    provisions.forEach(p => {
      if (!p.full_text) return;
      // Try exact match first, then normalized match
      const pText = p.full_text.trim();
      let idx = lowerSource.indexOf(pText.toLowerCase());

      // If exact match fails, try matching a significant chunk (first 120 chars)
      if (idx < 0 && pText.length > 120) {
        const chunk = pText.substring(0, 120).toLowerCase();
        idx = lowerSource.indexOf(chunk);
      }

      if (idx >= 0) {
        // Use the length of text actually found (for partial matches)
        const matchLen = idx === lowerSource.indexOf(pText.toLowerCase())
          ? pText.length
          : Math.min(pText.length, sourceText.length - idx);
        found.push({ start: idx, end: idx + matchLen, provision: p });
      }
    });

    // Sort by start position and remove overlaps
    found.sort((a, b) => a.start - b.start);
    const deduped = [];
    for (const r of found) {
      if (deduped.length === 0 || r.start >= deduped[deduped.length - 1].end) {
        deduped.push(r);
      }
    }
    return deduped;
  }, [sourceText, provisions]);

  // Handle text selection for "Create Provision" floating button
  const contentRef = useRef(null);
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      onTextSelect(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 10) {
      onTextSelect(null);
      return;
    }

    // Check if selection is inside our content area
    if (contentRef.current && contentRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelect({ text, rect });
    }
  }, [onTextSelect]);

  if (!sourceText) return null;

  // Build segments: alternating plain text and highlighted provisions
  const segments = [];
  let cursor = 0;

  regions.forEach((r, i) => {
    // Plain text before this highlight
    if (r.start > cursor) {
      segments.push({ type: 'text', content: sourceText.slice(cursor, r.start), key: `t-${i}` });
    }
    // Highlighted provision
    segments.push({ type: 'highlight', content: sourceText.slice(r.start, r.end), provision: r.provision, key: `h-${i}` });
    cursor = r.end;
  });
  // Remaining text
  if (cursor < sourceText.length) {
    segments.push({ type: 'text', content: sourceText.slice(cursor), key: 'tail' });
  }

  // Find definition terms in plain text segments
  const renderTextWithDefs = (text, keyPrefix) => {
    if (!definitionTerms || definitionTerms.length === 0) return text;

    const parts = [];
    let partIdx = 0;

    for (const def of definitionTerms) {
      const termLower = def.term.toLowerCase();
      let searchFrom = 0;
      let lastEnd = 0;
      const rLower = text.toLowerCase();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const idx = rLower.indexOf(termLower, searchFrom);
        if (idx < 0) break;
        // Only match whole-word-ish occurrences
        const before = idx > 0 ? rLower[idx - 1] : ' ';
        const after = idx + termLower.length < rLower.length ? rLower[idx + termLower.length] : ' ';
        if (/[a-z0-9]/i.test(before) || /[a-z0-9]/i.test(after)) {
          searchFrom = idx + 1;
          continue;
        }
        // Push text before match
        if (idx > lastEnd) {
          parts.push(<span key={`${keyPrefix}-${partIdx++}`}>{text.slice(lastEnd, idx)}</span>);
        }
        // Push the defined term with hover
        parts.push(
          <span
            key={`${keyPrefix}-def-${partIdx++}`}
            className="border-b border-dotted border-inkFaint cursor-help relative"
            onMouseEnter={(e) => onDefHover(def, e)}
            onMouseLeave={onDefLeave}
          >
            {text.slice(idx, idx + def.term.length)}
          </span>
        );
        lastEnd = idx + def.term.length;
        searchFrom = lastEnd;
      }
      if (parts.length > 0) {
        if (lastEnd < text.length) {
          parts.push(<span key={`${keyPrefix}-${partIdx++}`}>{text.slice(lastEnd)}</span>);
        }
        return <>{parts}</>;
      }
    }

    return text;
  };

  return (
    <div
      ref={contentRef}
      className="font-body text-ink leading-relaxed text-[15px] whitespace-pre-wrap"
      onMouseUp={handleMouseUp}
    >
      {segments.map(seg => {
        if (seg.type === 'text') {
          return <span key={seg.key}>{renderTextWithDefs(seg.content, seg.key)}</span>;
        }

        const p = seg.provision;
        const tc = typeColor(p.type);
        const isExpanded = expandedLabel === p.id;

        return (
          <span
            key={seg.key}
            id={`prov-${p.id}`}
            ref={el => { if (provisionRefs.current) provisionRefs.current[p.id] = el; }}
            className={`relative ${tc.bg} border-l-2 ${tc.border} px-1 -mx-1 cursor-pointer transition-colors hover:opacity-90`}
            onClick={() => onEditProvision(p)}
          >
            {/* Floating label */}
            <span className="block mb-1 -ml-1">
              <ProvisionLabel
                provision={p}
                isExpanded={isExpanded}
                onToggle={(e) => { if (e) e.stopPropagation(); onToggleLabel(p.id); }}
                onEdit={onEditProvision}
              />
            </span>
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT PANEL (slide-in from right)
   ═══════════════════════════════════════════════════════════ */
function EditPanel({
  provision,
  allTypes,
  allCategories,
  onClose,
  onSave,
  onApprove,
  onFlag,
  onDelete,
  onProposeCode,
}) {
  const [editType, setEditType] = useState(provision?.type || '');
  const [editCategory, setEditCategory] = useState(provision?.category || '');
  const [editFav, setEditFav] = useState(provision?.ai_favorability || 'neutral');
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (provision) {
      setEditType(provision.type || '');
      setEditCategory(provision.category || '');
      setEditFav(provision.ai_favorability || 'neutral');
      setFeatures(getFeatures(provision));
    }
  }, [provision]);

  const filteredCategories = useMemo(() => {
    if (!editType || !allCategories) return [];
    return allCategories.filter(c =>
      c.provision_type?.key === editType
    ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [editType, allCategories]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      id: provision.id,
      type: editType,
      category: editCategory,
      ai_favorability: editFav,
    });
    setSaving(false);
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures(prev => [...prev, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const removeFeature = (idx) => {
    setFeatures(prev => prev.filter((_, i) => i !== idx));
  };

  if (!provision) return null;

  const tc = typeColor(provision.type);

  return (
    <div className="w-[400px] shrink-0 bg-white border-l border-border flex flex-col h-full overflow-hidden animate-slide-up">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-border flex items-center justify-between ${tc.bg}`}>
        <h3 className="font-display text-sm text-ink font-medium truncate pr-2">
          Edit Provision
        </h3>
        <button onClick={onClose} className="p-1 text-inkLight hover:text-ink transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Classification */}
        <div className="space-y-3">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Classification</h4>

          <div>
            <label className="block text-xs font-ui text-inkLight mb-1">Type</label>
            <select
              value={editType}
              onChange={e => { setEditType(e.target.value); setEditCategory(''); }}
              className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            >
              <option value="">Select type...</option>
              {allTypes.map(t => (
                <option key={t.key || t} value={t.key || t}>
                  {typeLabel(t.key || t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-ui text-inkLight mb-1">Category</label>
            {filteredCategories.length > 0 ? (
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
              >
                <option value="">Select category...</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="Category name"
                className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-ui text-inkLight mb-1">Favorability</label>
            <select
              value={editFav}
              onChange={e => setEditFav(e.target.value)}
              className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
            >
              <option value="strong-buyer">Strong Buyer</option>
              <option value="mod-buyer">Moderate Buyer</option>
              <option value="buyer">Buyer</option>
              <option value="neutral">Neutral</option>
              <option value="seller">Seller</option>
              <option value="mod-seller">Moderate Seller</option>
              <option value="strong-seller">Strong Seller</option>
            </select>
          </div>
        </div>

        {/* Text Preview */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Provision Text</h4>
          <div className={`p-3 rounded border ${tc.border} ${tc.bg} max-h-48 overflow-y-auto`}>
            <p className="font-body text-xs text-ink leading-relaxed whitespace-pre-wrap">
              {provision.full_text ? (
                provision.full_text.length > 500
                  ? provision.full_text.substring(0, 500) + '...'
                  : provision.full_text
              ) : '(no text)'}
            </p>
          </div>
          <p className="text-[10px] font-ui text-inkFaint">
            {provision.full_text ? `${provision.full_text.length} characters` : ''}
            {' '}-- Select text in the document to adjust boundaries
          </p>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Features</h4>
          <div className="flex flex-wrap gap-1">
            {features.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-ui px-2 py-0.5 rounded bg-bg text-inkMid border border-border">
                {f}
                <button
                  onClick={() => removeFeature(i)}
                  className="text-inkFaint hover:text-seller ml-0.5"
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              placeholder="Add feature..."
              className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              onKeyDown={e => e.key === 'Enter' && addFeature()}
            />
            <button
              onClick={addFeature}
              disabled={!newFeature.trim()}
              className="px-2 py-1 text-xs font-ui bg-bg border border-border rounded hover:bg-border/50 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Related Definitions */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Related Definitions</h4>
          <p className="text-xs font-ui text-inkFaint italic">
            Definition linking is available after provisions are fully classified.
          </p>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="border-t border-border p-4 space-y-2 bg-bg/30">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-3 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(provision)}
            className="flex-1 px-3 py-1.5 text-xs font-ui bg-buyer/10 text-buyer border border-buyer/20 rounded hover:bg-buyer/20 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onFlag(provision)}
            className="flex-1 px-3 py-1.5 text-xs font-ui bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
          >
            Flag
          </button>
          <button
            onClick={() => onDelete(provision)}
            className="px-3 py-1.5 text-xs font-ui bg-seller/10 text-seller border border-seller/20 rounded hover:bg-seller/20 transition-colors"
          >
            Delete
          </button>
        </div>
        <button
          onClick={() => onProposeCode(provision)}
          className="w-full px-3 py-1.5 text-xs font-ui border border-dashed border-accent/40 text-accent rounded hover:bg-accent/5 transition-colors"
        >
          Propose New Code
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CREATE PROVISION FLOATING BUTTON
   ═══════════════════════════════════════════════════════════ */
function CreateProvisionButton({ selection, onCreateProvision }) {
  if (!selection || !selection.rect) return null;

  const style = {
    position: 'fixed',
    top: selection.rect.bottom + 8,
    left: selection.rect.left + (selection.rect.width / 2) - 75,
    zIndex: 50,
  };

  return (
    <div style={style} className="animate-slide-up">
      <button
        onMouseDown={(e) => { e.preventDefault(); onCreateProvision(selection.text); }}
        className="px-4 py-2 text-xs font-ui bg-accent text-white rounded-lg shadow-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2v8M2 6h8" />
        </svg>
        Create Provision
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEFINITION TOOLTIP
   ═══════════════════════════════════════════════════════════ */
function DefinitionTooltip({ def, position }) {
  if (!def || !position) return null;

  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-lg shadow-lg p-3 max-w-sm animate-slide-up"
      style={{ top: position.y - 8, left: position.x, transform: 'translateY(-100%)' }}
    >
      <p className="font-ui text-xs font-medium text-ink mb-1">{def.term}</p>
      <p className="font-body text-xs text-inkMid leading-relaxed">{def.text}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN REVIEW PAGE
   ═══════════════════════════════════════════════════════════ */
ReviewPage.noLayout = true;

export default function ReviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser({ redirectTo: '/login' });
  const { deal, loading: dealLoading } = useDeal(id);
  const { provisions: rawProvisions, loading: provsLoading, refetch: refetchProvs } = useProvisions({ deal_id: id });
  const { addToast } = useToast();

  /* ── Agreement Source ── */
  const [agreementSource, setAgreementSource] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setSourceLoading(true);
    fetch(`/api/agreement-source?deal_id=${id}`)
      .then(r => r.json())
      .then(d => { setAgreementSource(d.agreement_source); setSourceLoading(false); })
      .catch(() => setSourceLoading(false));
  }, [id]);

  /* ── Provision Types & Categories ── */
  const [provTypes, setProvTypes] = useState([]);
  const [provCategories, setProvCategories] = useState([]);

  useEffect(() => {
    fetch('/api/provision-types')
      .then(r => r.json())
      .then(d => {
        setProvTypes(d.provision_types || []);
        setProvCategories(d.provision_categories || []);
      })
      .catch(() => {});
  }, []);

  /* ── Augment provisions with local review status ── */
  const [statusOverrides, setStatusOverrides] = useState({});

  const provisions = useMemo(() => {
    return rawProvisions.map(p => ({
      ...p,
      _status: statusOverrides[p.id] || 'unreviewed',
    }));
  }, [rawProvisions, statusOverrides]);

  /* ── Sidebar filter state ── */
  const [activeFilter, setActiveFilter] = useState(null);

  /* ── Tab state: "provisions" or "document" ── */
  const [activeTab, setActiveTab] = useState('provisions');

  /* ── Filtered provisions based on sidebar selection ── */
  const filteredProvisions = useMemo(() => {
    if (activeFilter === null) return provisions;
    return provisions.filter(p => p.type === activeFilter);
  }, [provisions, activeFilter]);

  /* ── Group provisions by type (all, not filtered) ── */
  const provsByType = useMemo(() => {
    const groups = {};
    provisions.forEach(p => {
      const t = p.type || 'Other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(p);
    });
    return groups;
  }, [provisions]);

  /* ── Group filtered provisions by type ── */
  const filteredProvsByType = useMemo(() => {
    const groups = {};
    filteredProvisions.forEach(p => {
      const t = p.type || 'Other';
      if (!groups[t]) groups[t] = [];
      groups[t].push(p);
    });
    return groups;
  }, [filteredProvisions]);

  /* ── Extract definition terms from DEF provisions ── */
  const definitionTerms = useMemo(() => {
    return provisions
      .filter(p => p.type === 'DEF')
      .map(p => ({
        term: p.category || 'Definition',
        text: p.full_text ? p.full_text.substring(0, 300) : '',
      }))
      .filter(d => d.term && d.text);
  }, [provisions]);

  /* ── UI State ── */
  const [editingProvision, setEditingProvision] = useState(null);
  const [expandedLabel, setExpandedLabel] = useState(null);
  const [textSelection, setTextSelection] = useState(null);
  const [hoveredDef, setHoveredDef] = useState(null);
  const [defPosition, setDefPosition] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const provisionRefs = useRef({});

  // Close expanded label when clicking outside
  useEffect(() => {
    const handleClick = () => setExpandedLabel(null);
    const handleEscape = () => {
      if (editingProvision) setEditingProvision(null);
      else setExpandedLabel(null);
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('pm:escape', handleEscape);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('pm:escape', handleEscape);
    };
  }, [editingProvision]);

  /* ── Sidebar filter handler ── */
  const handleFilterType = useCallback((type) => {
    setActiveFilter(type);
  }, []);

  /* ── Sidebar provision click — select & open edit panel ── */
  const handleSidebarSelectProvision = useCallback((provId) => {
    const prov = provisions.find(p => p.id === provId);
    if (prov) {
      setEditingProvision(prov);
      // Also filter to that provision's type for context
      setActiveFilter(prov.type);
    }
  }, [provisions]);

  /* ── Edit provision ── */
  const handleEditProvision = useCallback((provision) => {
    setEditingProvision(provision);
    setExpandedLabel(null);
  }, []);

  /* ── Save edits ── */
  const handleSaveProvision = useCallback(async (updates) => {
    try {
      const resp = await fetch('/api/provisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addToast('Provision updated', 'success');
      refetchProvs();
      setEditingProvision(null);
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  }, [addToast, refetchProvs]);

  /* ── Approve ── */
  const handleApprove = useCallback((provision) => {
    setStatusOverrides(prev => ({ ...prev, [provision.id]: 'approved' }));
    addToast(`"${provision.category || 'Provision'}" approved`, 'success');
  }, [addToast]);

  /* ── Flag ── */
  const handleFlag = useCallback((provision) => {
    setStatusOverrides(prev => ({ ...prev, [provision.id]: 'flagged' }));
    addToast(`"${provision.category || 'Provision'}" flagged for review`, 'info');
  }, [addToast]);

  /* ── Delete ── */
  const handleDelete = useCallback(async (provision) => {
    if (!window.confirm(`Delete this provision? This cannot be undone.`)) return;
    try {
      const resp = await fetch('/api/provisions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provision.id }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addToast('Provision deleted', 'success');
      setEditingProvision(null);
      refetchProvs();
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  }, [addToast, refetchProvs]);

  /* ── Propose New Code ── */
  const handleProposeCode = useCallback((provision) => {
    addToast('New code proposal submitted for review', 'info');
    setEditingProvision(null);
  }, [addToast]);

  /* ── Create Provision from Selection ── */
  const handleCreateProvision = useCallback(async (text) => {
    if (!id) return;
    try {
      const resp = await fetch('/api/provisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: id,
          full_text: text,
          type: 'MISC',
          category: 'Uncategorized',
          ai_favorability: 'neutral',
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addToast('Provision created -- edit to classify', 'success');
      refetchProvs();
      setTextSelection(null);
      // Open the new provision for editing
      if (data.provision) {
        setEditingProvision({ ...data.provision, _status: 'unreviewed' });
      }
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  }, [id, addToast, refetchProvs]);

  /* ── Definition hover ── */
  const handleDefHover = useCallback((def, event) => {
    const rect = event.target.getBoundingClientRect();
    setHoveredDef(def);
    setDefPosition({ x: rect.left, y: rect.top });
  }, []);

  const handleDefLeave = useCallback(() => {
    setHoveredDef(null);
    setDefPosition(null);
  }, []);

  /* ── Toggle label ── */
  const handleToggleLabel = useCallback((provId) => {
    setExpandedLabel(prev => prev === provId ? null : provId);
  }, []);

  /* ── Loading States ── */
  const isLoading = dealLoading || provsLoading || sourceLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center py-12 space-y-2">
          <p className="text-inkFaint font-ui">Deal not found.</p>
          <Link href="/deals" className="text-accent text-sm font-ui hover:underline">
            Back to Deals
          </Link>
        </div>
      </div>
    );
  }

  const dealLabel = `${deal.acquirer} / ${deal.target}`;
  const hasSource = agreementSource && agreementSource.full_text;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-lg font-bold tracking-widest text-ink">
            PRECEDENT MACHINE
          </Link>
          <span className="text-inkFaint font-ui text-xs">/</span>
          <Link href="/deals" className="text-xs font-ui text-inkFaint hover:text-ink transition-colors">
            Deals
          </Link>
          <span className="text-inkFaint font-ui text-xs">/</span>
          <Link href={`/deals/${id}`} className="text-xs font-ui text-inkFaint hover:text-ink transition-colors">
            {dealLabel}
          </Link>
          <span className="text-inkFaint font-ui text-xs">/</span>
          <span className="text-xs font-ui text-inkMid font-medium">Review</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-inkLight hover:text-ink transition-colors rounded hover:bg-bg"
            title="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="14" height="12" rx="1" />
              <path d="M5 2v12" />
            </svg>
          </button>
          {user && (
            <span className="text-xs text-inkFaint font-ui">{user.name}</span>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <Sidebar
            provsByType={provsByType}
            provisions={provisions}
            activeFilter={activeFilter}
            onFilterType={handleFilterType}
            onSelectProvision={handleSidebarSelectProvision}
            activeProvId={editingProvision?.id}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 md:p-8">
            {/* Deal Header */}
            <div className="mb-6">
              <h1 className="font-display text-2xl text-ink">{dealLabel}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm font-ui text-inkLight">
                {deal.sector && <span>Sector: <span className="text-inkMid">{deal.sector}</span></span>}
                {deal.value_usd && <span>Value: <span className="text-inkMid">${(deal.value_usd / 1e9).toFixed(1)}B</span></span>}
                {deal.announce_date && <span>Date: <span className="text-inkMid">{new Date(deal.announce_date).toLocaleDateString()}</span></span>}
                <span className="text-inkFaint">
                  {provisions.length} provision{provisions.length !== 1 ? 's' : ''} classified
                </span>
              </div>
            </div>

            {/* Tab System */}
            {provisions.length > 0 && (
              <div className="flex items-center gap-1 mb-4 border-b border-border">
                <button
                  onClick={() => setActiveTab('provisions')}
                  className={`px-4 py-2 text-sm font-ui transition-colors border-b-2 -mb-px ${
                    activeTab === 'provisions'
                      ? 'border-accent text-accent font-medium'
                      : 'border-transparent text-inkLight hover:text-ink'
                  }`}
                >
                  Provisions
                </button>
                <button
                  onClick={() => setActiveTab('document')}
                  className={`px-4 py-2 text-sm font-ui transition-colors border-b-2 -mb-px ${
                    activeTab === 'document'
                      ? 'border-accent text-accent font-medium'
                      : 'border-transparent text-inkLight hover:text-ink'
                  }`}
                >
                  Full Document
                </button>
                {hasSource && (
                  <button
                    onClick={() => setActiveTab('source')}
                    className={`px-4 py-2 text-sm font-ui transition-colors border-b-2 -mb-px ${
                      activeTab === 'source'
                        ? 'border-accent text-accent font-medium'
                        : 'border-transparent text-inkLight hover:text-ink'
                    }`}
                  >
                    Source Text
                  </button>
                )}

                {/* Filter indicator */}
                {activeFilter && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border ${typeColor(activeFilter).border} ${typeColor(activeFilter).bg} ${typeColor(activeFilter).text}`}>
                      Filtered: {typeLabel(activeFilter)}
                    </span>
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="text-[10px] font-ui text-inkFaint hover:text-ink"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content */}
            {provisions.length > 0 ? (
              <>
                {/* Provisions Tab (card view) */}
                {activeTab === 'provisions' && (
                  <div className="space-y-4">
                    {Object.entries(filteredProvsByType).map(([type, provs]) => (
                      <div key={type} className="space-y-2">
                        <h2 className="font-display text-lg text-ink flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${typeColor(type).dot}`} />
                          {typeLabel(type)}
                          <span className="text-sm font-ui text-inkFaint font-normal">({provs.length})</span>
                        </h2>
                        {provs.map(p => (
                          <ProvisionCard
                            key={p.id}
                            provision={p}
                            onEdit={handleEditProvision}
                          />
                        ))}
                      </div>
                    ))}
                    {filteredProvisions.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-inkFaint font-ui">No provisions match this filter.</p>
                        <button
                          onClick={() => setActiveFilter(null)}
                          className="text-accent text-sm font-ui hover:underline mt-2"
                        >
                          Show all provisions
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Document Tab (reconstructed from provisions) */}
                {activeTab === 'document' && (
                  <FullDocumentView
                    provisions={filteredProvisions}
                    onEditProvision={handleEditProvision}
                  />
                )}

                {/* Source Text Tab (only if available) */}
                {activeTab === 'source' && hasSource && (
                  <div className="bg-white border border-border rounded-lg shadow-sm p-6 md:p-8">
                    <DocumentRenderer
                      sourceText={agreementSource.full_text}
                      provisions={filteredProvisions}
                      expandedLabel={expandedLabel}
                      onToggleLabel={handleToggleLabel}
                      onEditProvision={handleEditProvision}
                      onTextSelect={setTextSelection}
                      provisionRefs={provisionRefs}
                      definitionTerms={definitionTerms}
                      hoveredDef={hoveredDef}
                      onDefHover={handleDefHover}
                      onDefLeave={handleDefLeave}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon="+"
                title="No provisions found"
                description="This deal has no parsed provisions yet. Ingest an agreement to get started."
                action={
                  <Link href="/ingest" className="inline-block px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors">
                    Go to Ingest
                  </Link>
                }
              />
            )}
          </div>
        </div>

        {/* Right Edit Panel */}
        {editingProvision && (
          <EditPanel
            provision={editingProvision}
            allTypes={provTypes.length > 0 ? provTypes : Object.keys(TYPE_LABELS).map(k => ({ key: k, label: TYPE_LABELS[k] }))}
            allCategories={provCategories}
            onClose={() => setEditingProvision(null)}
            onSave={handleSaveProvision}
            onApprove={handleApprove}
            onFlag={handleFlag}
            onDelete={handleDelete}
            onProposeCode={handleProposeCode}
          />
        )}
      </div>

      {/* Floating Create Provision Button */}
      <CreateProvisionButton
        selection={textSelection}
        onCreateProvision={handleCreateProvision}
      />

      {/* Definition Tooltip */}
      <DefinitionTooltip def={hoveredDef} position={defPosition} />
    </div>
  );
}
