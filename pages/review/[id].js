import { useState, useEffect, useMemo, useCallback, useRef, useContext, createContext } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeal, useProvisions } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';
import { useToast } from '../../lib/useToast';
import { Breadcrumbs, SkeletonCard, EmptyState } from '../../components/UI';
import {
  parseFormattedDocument,
  stripFormattingMarkers,
} from '../../lib/parser-v2/format-renderer';
import {
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  labelForCode,
} from '../../lib/taxonomy';
import { getFeaturesForType, PROVISION_TYPES } from '../../lib/rubric';

/* ── Type & Term Labels ── */
const TYPE_LABELS = {
  'MAE-T': 'Material Adverse Effect (Target)',
  'MAE-B': 'Material Adverse Effect (Buyer)',
  'MAE': 'Material Adverse Effect',
  'MAE-DEF': 'Material Adverse Effect',
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
  'OTHER': 'Other Provisions',
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
  'OTHER':  { bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400',   hex: '#f9fafb' },
};

/* ── Recital provision-type hex colors (used for dots, ref chips, section heads) ── */
const TYPE_HEX = {
  STRUCT:   '#7459A6',
  CONSID:   '#2F8B7E',
  DEF:      '#4E6FA6',
  IOC:      '#B5862E',
  'IOC-T':  '#B5862E',
  'IOC-B':  '#B5862E',
  NOSOL:    '#A8538C',
  ANTI:     '#2F8FA8',
  COND:     '#5660B0',
  'COND-M': '#5660B0',
  'COND-B': '#5660B0',
  'COND-S': '#5660B0',
  TERMR:    '#C0673A',
  'TERMR-M':'#C0673A',
  'TERMR-B':'#C0673A',
  'TERMR-T':'#C0673A',
  TERMF:    '#B14E63',
  REP:      '#3F8A6A',
  'REP-T':  '#3F8A6A',
  'REP-B':  '#3F8A6A',
  COV:      '#6E8AA8',
  MAE:      '#8B5B3A',
  'MAE-T':  '#8B5B3A',
  'MAE-B':  '#8B5B3A',
  'MAE-DEF':'#8B5B3A',
  MISC:     '#8A8782',
  OTHER:    '#8A8782',
};

function typeHex(code) {
  return TYPE_HEX[code] || '#8A8782';
}

function typeTint(code, pct) {
  return `color-mix(in srgb, ${typeHex(code)} ${pct}%, transparent)`;
}

/* ── Sidebar grouping — parent groups with optional sub-types ── */
const SIDEBAR_GROUPS = [
  { label: 'Structure & Mechanics', types: ['STRUCT'] },
  { label: 'Consideration', types: ['CONSID'] },
  { label: 'Representations', children: [
    { label: 'Company / Target', type: 'REP-T' },
    { label: 'Buyer / Parent', type: 'REP-B' },
  ]},
  { label: 'Material Adverse Effect', types: ['MAE-DEF'] },
  { label: 'Interim Operating Covenants', types: ['IOC', 'IOC-T', 'IOC-B'] },
  { label: 'No-Solicitation / No-Shop', types: ['NOSOL'] },
  { label: 'Antitrust / Regulatory', types: ['ANTI'] },
  { label: 'Conditions to Closing', children: [
    { label: 'Mutual', type: 'COND-M' },
    { label: 'Buyer', type: 'COND-B' },
    { label: 'Seller', type: 'COND-S' },
    { label: 'Modifiers', type: 'COND' },
  ]},
  { label: 'Termination Rights', children: [
    { label: 'Mutual', type: 'TERMR-M' },
    { label: 'Buyer', type: 'TERMR-B' },
    { label: 'Target', type: 'TERMR-T' },
    { label: 'Unclassified', type: 'TERMR' },
  ]},
  { label: 'Termination Fees', types: ['TERMF'] },
  { label: 'Other Covenants', types: ['COV'] },
  { label: 'Definitions', types: ['DEF'] },
  { label: 'Miscellaneous / Boilerplate', types: ['MISC'] },
  { label: 'Other', types: ['OTHER'] },
];

function typeColor(code) {
  return TYPE_COLORS[code] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400', hex: '#f9fafb' };
}

/* Group provisions by type preserving document-order insertion, then enforce
   Mutual → Buyer → Target ordering for the TERMR party-specific groups. */
function groupProvisionsByType(provs) {
  const groups = {};
  provs.forEach(p => {
    const t = p.type || 'Other';
    if (!groups[t]) groups[t] = [];
    groups[t].push(p);
  });

  const termrOrder = ['TERMR-M', 'TERMR-B', 'TERMR-T'];
  const presentTermrKeys = termrOrder.filter(k => groups[k]);
  if (presentTermrKeys.length < 2) return groups;

  // Rebuild map: keep original key order, but the first time any TERMR-M/B/T
  // key is encountered, emit all present TERMR party-specific groups in
  // Mutual → Buyer → Target order.
  const ordered = {};
  let termrEmitted = false;
  for (const [key, val] of Object.entries(groups)) {
    if (termrOrder.includes(key)) {
      if (!termrEmitted) {
        for (const tk of presentTermrKeys) ordered[tk] = groups[tk];
        termrEmitted = true;
      }
      continue;
    }
    ordered[key] = val;
  }
  return ordered;
}

const FAV_LABELS = {
  'strong-buyer': { label: 'Strong Buyer', cls: 'bg-buyer/10 text-buyer', pos:  2 },
  'mod-buyer':    { label: 'Mod. Buyer',   cls: 'bg-buyer/10 text-buyer', pos:  1 },
  'buyer':        { label: 'Buyer',        cls: 'bg-buyer/10 text-buyer', pos:  1 },
  'neutral':      { label: 'Balanced',     cls: 'bg-gray-100 text-inkLight', pos: 0 },
  'mod-seller':   { label: 'Mod. Seller',  cls: 'bg-seller/10 text-seller', pos: -1 },
  'strong-seller':{ label: 'Strong Seller',cls: 'bg-seller/10 text-seller', pos: -2 },
  'seller':       { label: 'Seller',       cls: 'bg-seller/10 text-seller', pos: -1 },
};

function favBadge(fav) {
  return FAV_LABELS[(fav || '').toLowerCase()] || FAV_LABELS.neutral;
}

/* ── Favorability hue + soft fill (Recital) ── */
function favHue(fav) {
  const meta = favBadge(fav);
  if (meta.pos > 0) return 'var(--buyer)';
  if (meta.pos < 0) return 'var(--seller)';
  return 'var(--neutral)';
}
function favSoft(fav) {
  const hue = favHue(fav);
  return `color-mix(in srgb, ${hue} 13%, transparent)`;
}

/* ── 5-segment diverging favorability meter (seller ◄────► buyer) ── */
function FavMeter({ fav }) {
  const meta = favBadge(fav);
  const active = meta.pos + 2; // 0..4
  const hue = favHue(fav);
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i === active;
        const side = i < 2 ? 'var(--seller)' : i > 2 ? 'var(--buyer)' : 'var(--neutral)';
        return (
          <span
            key={i}
            style={{
              width: on ? 5 : 4,
              height: on ? 13 : 8,
              borderRadius: 2,
              background: on ? hue : `color-mix(in srgb, ${side} 22%, var(--line))`,
              transition: 'all .15s',
              display: 'inline-block',
            }}
          />
        );
      })}
    </span>
  );
}

/* ── Favorability pill (meter + label, tinted by hue) ── */
function FavPill({ fav }) {
  const meta = favBadge(fav);
  return (
    <span className="rec-fav-pill" style={{ color: favHue(fav), background: favSoft(fav) }}>
      <FavMeter fav={fav} />
      {meta.label}
    </span>
  );
}

/* ── Status tag (Approved / Needs review / Unreviewed) ── */
function RecStatusTag({ status }) {
  const s = STATUS[status] || STATUS.unreviewed;
  const color =
    status === 'approved' ? 'var(--buyer)' :
    status === 'flagged'  ? 'var(--accent)' :
    'var(--ink-faint)';
  return (
    <span className="rec-status-tag">
      <span className="d" style={{ background: color }} />
      {s.label}
    </span>
  );
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

/* ── Parse ai_metadata (handles string-vs-object payloads) ── */
function getAiMetadata(provision) {
  if (!provision || !provision.ai_metadata) return null;
  if (typeof provision.ai_metadata === 'string') {
    try { return JSON.parse(provision.ai_metadata); } catch { return null; }
  }
  return provision.ai_metadata;
}

/* ── Parse structured features object from ai_metadata ── */
function getStructuredFeatures(provision) {
  const meta = getAiMetadata(provision);
  if (!meta || !meta.features) return null;
  const feats = meta.features;
  // Treat empty object as "no features"
  if (typeof feats !== 'object' || Array.isArray(feats)) return null;
  const keys = Object.keys(feats);
  if (keys.length === 0) return null;
  return feats;
}

/* ── Parse features from ai_metadata (flat chip list for backward-compat) ── */
function getFeatures(provision) {
  const meta = getAiMetadata(provision);
  if (!meta) return [];
  if (meta.key_terms) return meta.key_terms;
  if (meta.features && typeof meta.features === 'object' && !Array.isArray(meta.features)) {
    return Object.entries(meta.features)
      .filter(([, v]) => {
        if (v === null || v === undefined || v === '' || v === false) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      })
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.length} item${v.length === 1 ? '' : 's'}`;
        if (typeof v === 'boolean') return k;
        if (v && typeof v === 'object' && 'code' in v) {
          return `${k}: ${v.label || v.code}`;
        }
        return `${k}: ${v}`;
      });
  }
  return [];
}

/* ── Tagged-item helpers ──
 * A "tagged item" is a {code, label, text} object produced by the parser
 * when it maps a free-text exception/qualifier to a canonical taxonomy code.
 */
function isTaggedItem(v) {
  return (
    v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.code === 'string' &&
    v.code.length > 0
  );
}

function resolveTaggedLabel(featureKey, item) {
  if (!isTaggedItem(item)) return null;
  if (item.label && typeof item.label === 'string') return item.label;
  const dict = taxonomyForFeatureKey(featureKey);
  return labelForCode(item.code, dict || {}) || item.code;
}

/* ── Friendly label conversion (camelCase / snake_case → Title Case) ── */
// Feature keys whose human-readable label should override the default
// camelCase humanization. Keeps the underlying data key intact (e.g.
// `mainConcept` in the rubric / DB) while presenting "Provision" in the UI.
const HUMANIZE_KEY_OVERRIDES = {
  mainConcept: 'Provision',
};

function humanizeKey(key) {
  if (HUMANIZE_KEY_OVERRIDES[key]) return HUMANIZE_KEY_OVERRIDES[key];
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatFeatureValue(v) {
  if (v === null || v === undefined) return null;
  // Citable shape { value, text } — unwrap to the inner value. Tagged items
  // have `code` so they're distinguished from citable wraps.
  if (isCitableValue(v)) return formatFeatureValue(v.value);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v;
  return String(v);
}

/* ── Stage 5: Citation / evidence helpers ──
 *
 * A "citable" value is the parser's { value, text } wrapper for a boolean /
 * enum / number that carries a verbatim source quote. Tagged items
 * ({ code, label, text }) are distinct: they have a `code` field. The
 * EvidenceContext lets any nested renderer pop the quote into the full-doc
 * view without prop-drilling. */
function isCitableValue(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'value' in v &&
    !('code' in v)
  );
}

function getCitableValue(v) {
  return isCitableValue(v) ? v.value : v;
}

function getCitableText(v) {
  if (!isCitableValue(v)) return null;
  const t = v.text;
  if (typeof t !== 'string') return null;
  return t.trim() || null;
}

const EvidenceContext = createContext({ showEvidence: null });

function useShowEvidence() {
  const ctx = useContext(EvidenceContext);
  return ctx && typeof ctx.showEvidence === 'function' ? ctx.showEvidence : null;
}

/* ── EvidenceQuote: the small italic block rendered beneath a citable value.
 *    Clicking jumps to the Full Document tab and highlights the quote.
 *    Renders an italic "(no evidence captured)" placeholder when text is empty. */
function EvidenceQuote({ text, dense }) {
  const showEvidence = useShowEvidence();
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return (
      <span className={`block ${dense ? 'text-[10px]' : 'text-[11px]'} font-ui italic text-inkFaint/70 mt-0.5`}>
        (no evidence captured)
      </span>
    );
  }
  const handleClick = () => {
    if (showEvidence) showEvidence(trimmed);
  };
  const cls = `block ${dense ? 'text-[10px]' : 'text-[11px]'} font-ui italic mt-0.5 ${
    showEvidence
      ? 'text-amber-700 hover:text-amber-900 cursor-pointer hover:underline decoration-dotted'
      : 'text-amber-700'
  }`;
  // Keep quotes from blowing up the cell width
  const display = trimmed.length > 240 ? trimmed.slice(0, 237) + '…' : trimmed;
  return (
    <span
      className={cls}
      onClick={showEvidence ? handleClick : undefined}
      title={showEvidence ? 'Click to view in document' : trimmed}
    >
      &ldquo;{display}&rdquo;
      {showEvidence ? <span className="not-italic text-amber-500 ml-1">&rarr;</span> : null}
    </span>
  );
}

/* ── Per-type field display order — drives StructuredFeatures layout ── */
const FEATURE_DISPLAY_ORDER = {
  // IOC table — drop the redundant 'mainObligation' and 'consentStandard'
  // columns (category column already conveys the obligation) and lead with
  // permittedExceptions so the most-compared field is first.
  IOC: [
    'permittedExceptions', 'dollarThreshold', 'effortsStandard',
    'crossReferences',
  ],
  'COND-M': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  'COND-B': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'maeConditionStandalone', 'certificationRequired', 'dollarThreshold', 'dissentingSharesThreshold', 'scheduleReference'],
  'COND-S': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'fundsCondition', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  COND: ['mainCondition'],
  // NOSOL table — 5 most-compared deal-protection terms only.
  // Everything else (info rights, go-shop, standstill, percentages, etc.)
  // still lives on each provision's structured summary; it's just hidden
  // from the category-level matrix to keep cross-deal comparison clean.
  NOSOL: [
    'fiduciaryEngageStandard',
    'fiduciaryFinalStandard',
    'noticePeriod',
    'noticeContent',
    'matchingPeriod',
    'interveningEventTermination',
    'forceTheVote',
    'forceTheVoteDetails',
  ],
  // Canonical ANTI display order: effortsStandard first (the headline), then
  // the burden cap / divestiture limit fields, then No Inconsistent Action
  // (appliesToParty), then everything else (filing, cooperation/control, etc.).
  // ANTI summary: per user request, the summary table renders just Term
  // (category) + Details (mainConcept). Per-feature columns (burdensome
  // condition defined, divestiture cap, etc.) are intentionally suppressed
  // here — they remain visible on the per-provision drill-in / edit panel.
  ANTI: ['mainConcept'],
  TERMR: ['mainConcept', 'partyWhoCanTerminate', 'terminationTriggers', 'curePeriod', 'outsideDate', 'outsideDateMonths', 'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'superiorProposalTermination', 'faultBasedExclusion', 'tickingFee'],
  TERMF: ['mainConcept', 'triggerEvents', 'feeAmount', 'feePercentage', 'reverseFeeAmount', 'reverseFeePercentage', 'tailPeriod', 'soleRemedy', 'willfulBreachException', 'expenseReimbursement', 'expenseReimbursementCap', 'nakedNoVoteFee'],
  // DEF: pared down to just the two things the user cares about — where the
  // definition appears in the agreement and whether it's an inline definition
  // (extracted from the body of another section) vs. a Definitions-section
  // entry. Everything else still lives on the provision itself via the full
  // text — no structured summary needed.
  DEF: ['sourceSection', 'inlineDefinition'],
  STRUCT: ['dealStructure', 'mergerForm', 'mainConcept', 'survivingEntity', 'closingConditionsPrecedent'],
  CONSID: ['mainConcept', 'considerationType', 'perShareAmount', 'exchangeRatio', 'equityAwardTreatment', 'outstandingInstruments', 'instrumentTreatments', 'vestingAcceleration', 'cutoffDate', 'cutoffTreatment', 'cashOutAmount', 'optionSpread', 'performanceTreatment', 'espp_treatment', 'parachuteCap', 'doubleTrigger', 'appraisalRightsAvailable', 'withholdingProvision', 'proration'],
  // PW diligence cleanup: REP-T / REP-B per-row table shows ONLY these four
  // columns. Specific-rep items (Sufficient Funds, Solvency, Anti-Reliance,
  // Top Customers definition, Material Contracts buckets, etc.) live ONLY on
  // (a) the individual provision card drill-in, (b) the ExpectedRepsTable
  // present/not-present checklist, and (c) the respective sub-code mini-table.
  // PW diligence cleanup v2:
  //   * knowledgeQualifier dropped from per-row table (now an above-table note)
  //   * lookbackPeriod added (synthesized "N months (since YYYY-MM-DD)" from
  //     secFilingsLookbackMonths + deal.announce_date)
  //   * specificFeatures synthetic column injected at render time by
  //     renderSpecificFeaturesCell() — collapses absenceOfChangesType /
  //     undisclosedLiabilitiesExceptions / materialContractsRedactionsPermitted
  //     / topCustomersSuppliersDefinition / etc. into one <dl> per row.
  'REP-T': ['materialityQualifier', 'survivalPeriod', 'dollarThreshold', 'lookbackPeriod', 'specificFeatures'],
  'REP-B': ['materialityQualifier', 'survivalPeriod', 'dollarThreshold', 'lookbackPeriod', 'specificFeatures'],
  COV: ['mainConcept', 'accessScope', 'indemnificationPeriod', 'employeeBenefitPeriod', 'financingCooperation', 'cvrIncluded'],
  MISC: ['mainConcept', 'governingLaw', 'jurisdictionExclusive', 'juryWaiver', 'specificPerformance', 'thirdPartyBeneficiaryExceptions'],
  OTHER: ['mainConcept', 'summary', 'crossReferences'],
};

function getOrderedFeatureKeys(typeKey, featuresObj) {
  const order = FEATURE_DISPLAY_ORDER[typeKey] || [];
  const seen = new Set();
  const ordered = [];
  for (const k of order) {
    if (k in featuresObj) {
      ordered.push(k);
      seen.add(k);
    }
  }
  for (const k of Object.keys(featuresObj)) {
    if (!seen.has(k)) ordered.push(k);
  }
  return ordered;
}

/* ── Return the expected feature schema keys for a provision type
 *    (drawn from the rubric FEATURES, ordered by FEATURE_DISPLAY_ORDER
 *    when available, otherwise by the rubric's own order).
 *
 *    If `code` is supplied AND the rubric has a code-specific feature schema
 *    (e.g. TERMR-OUTSIDE), use that more-specific schema so per-code provisions
 *    only display fields that actually apply to them. */
function getFeatureSchema(typeKey, code) {
  const schema = getFeaturesForType(typeKey, code) || [];
  const schemaKeys = schema.map((f) => f.key);
  // Allow FEATURE_DISPLAY_ORDER to inject synthetic columns (computed at
  // render time, not stored in DB / rubric). These are explicitly enumerated
  // here so we don't accidentally surface unrelated keys.
  const SYNTHETIC_KEYS = new Set(['specificFeatures', 'lookbackPeriod']);
  const order = FEATURE_DISPLAY_ORDER[code] || FEATURE_DISPLAY_ORDER[typeKey] || [];
  const seen = new Set();
  const ordered = [];
  for (const k of order) {
    if (schemaKeys.includes(k) || SYNTHETIC_KEYS.has(k)) {
      ordered.push(k);
      seen.add(k);
    }
  }
  for (const k of schemaKeys) {
    if (!seen.has(k)) ordered.push(k);
  }
  return ordered;
}

/* ── Parse structured content from provision text ── */
// Conservative exception detection: only treat a line as an exception if it
// BEGINS with one of these markers. Bullets/list markers alone are not enough.
const EXCEPTION_PREFIX_RE = /^(except\b|other than\b|provided that\b|provided,\s*however,?\s*that\b|notwithstanding\b)/i;

function parseProvisionText(text) {
  if (!text) return { header: '', subclauses: [], exceptions: [] };

  const lines = text.split(/\n/);
  let header = '';
  const subclauses = [];
  const exceptions = [];
  let inExceptions = false;
  let substantiveCharsSoFar = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Subclause markers: "(A)", "(1)", or a leading "Section X.XX" cross-reference.
    // BUT: do not treat the provision's own leading "SECTION X.XX. Title."
    // heading as a subclause — that's the natural prefix of the provision body
    // and belongs in the header. We only treat "Section ..." as a subclause
    // once we already have header text captured.
    const isSubclause =
      /^(\([A-Z]\)|\(\d+\))/i.test(trimmed) ||
      (!!header && /^Section\s/i.test(trimmed));
    // Only treat as an exception if it begins with one of the explicit markers
    // AND we already have substantive provision text (at least 50 chars).
    const startsWithExceptionMarker = EXCEPTION_PREFIX_RE.test(trimmed);
    const isException = startsWithExceptionMarker && substantiveCharsSoFar >= 50;

    if (!header && !isException && !isSubclause) {
      header = trimmed;
      substantiveCharsSoFar += trimmed.length;
    } else if (isException || inExceptions) {
      inExceptions = true;
      exceptions.push(trimmed);
    } else if (isSubclause) {
      subclauses.push(trimmed);
      substantiveCharsSoFar += trimmed.length;
    } else if (header) {
      // Additional text after header, before exceptions
      subclauses.push(trimmed);
      substantiveCharsSoFar += trimmed.length;
    }
  }

  // If no structured content found, use first sentence as header
  if (!header && text.length > 0) {
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    header = firstSentence ? firstSentence[0] : text.substring(0, 200);
  }

  return { header, subclauses, exceptions };
}

/* ── Detect "General / Preamble" provisions ── */
function isPreambleProvision(provision) {
  const cat = (provision?.category || '').toLowerCase().trim();
  if (!cat) return false;
  if (cat === 'preamble') return true;
  // Match "general / preamble", "general/preamble", "general preamble" etc.
  return /^general\s*\/?\s*preamble$/i.test(cat);
}

/* ── Split a list of provisions into [preamble, rest] for category views.
 *    Returns the first preamble provision (if any) and all remaining ones. */
function splitPreamble(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) {
    return { preamble: null, rest: provisions || [] };
  }
  const idx = provisions.findIndex(isPreambleProvision);
  if (idx < 0) return { preamble: null, rest: provisions };
  const preamble = provisions[idx];
  const rest = provisions.filter((_, i) => i !== idx);
  return { preamble, rest };
}

/* ── IOC preamble buckets: separate the consolidated "Affirmative Covenants"
 *    and "General Exceptions" provisions out of the main IOC table. These
 *    appear in a dedicated section above the table of negative restrictions. */
function isIocAffirmative(p) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  const code = meta.code || p.code || '';
  if (code === 'IOC-AFFIRMATIVE' || code === 'IOC-OTHER-AFFIRMATIVE') return true;
  const cat = typeof p.category === 'string' ? p.category.trim() : '';
  // Match: "Affirmative Covenants", "Other Affirmative Obligations",
  // "[PROPOSED] Affirmative ...", and similar variants.
  return /affirmative\s+(covenants?|obligations?)/i.test(cat);
}
function isIocGeneralExceptions(p) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  const code = meta.code || p.code || '';
  if (code === 'IOC-GENERAL-EXCEPTIONS' || code === 'IOC-EXCEPTIONS') return true;
  const cat = typeof p.category === 'string' ? p.category.trim() : '';
  // Match: "General Exceptions", "[PROPOSED] General Exceptions", etc.
  return /general\s+exceptions?/i.test(cat);
}
function splitIocPreambleBuckets(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) {
    return { affirmative: null, generalExceptions: null, rest: provisions || [] };
  }
  let affirmative = null;
  let generalExceptions = null;
  const rest = [];
  for (const p of provisions) {
    if (!affirmative && isIocAffirmative(p)) affirmative = p;
    else if (!generalExceptions && isIocGeneralExceptions(p)) generalExceptions = p;
    else rest.push(p);
  }
  return { affirmative, generalExceptions, rest };
}

/* ── Section-wide shared features — hidden on non-preamble provisions in
 *    section-style types (e.g. IOC) where the preamble carries them once. */
const SHARED_FEATURE_KEYS_BY_TYPE = {
  IOC: new Set([
    'requiredByLawCarveout',
    'pandemicCarveout',
    'covidCarveout',
    'ordinaryCourseCarveout',
    'materialityQualifier',
  ]),
};

function isSharedFeature(featureKey, typeKey) {
  const set = SHARED_FEATURE_KEYS_BY_TYPE[typeKey];
  if (!set) return false;
  return set.has(featureKey);
}

/* ── Types that should NOT show a "Section Preamble" card above their
 *    summary table. These sections either have no meaningful structured
 *    preamble (Termination Rights / Termination Fee), are flat lists
 *    (Definitions, Misc, Other), or have their own structural layout. */
const SKIP_PREAMBLE_CARD_TYPES = new Set([
  'TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T',
  'TERMF',
  'COND', 'COND-M', 'COND-B', 'COND-S',
  'DEF',
  'MAE-DEF',
  'MISC',
  'STRUCT',
  'OTHER',
]);

/* ═══════════════════════════════════════════════════════════
   LEFT SIDEBAR — now acts as a FILTER, not a scroller
   ═══════════════════════════════════════════════════════════ */
function Sidebar({ provsByType, provisions, activeFilter, onFilterType, onSelectProvision, activeProvId, onMoveProvision }) {
  // Drag-and-drop state: track the provision being dragged and the active
  // drop-target type so we can highlight it.
  const [dragProvId, setDragProvId] = useState(null);
  const [dropTargetType, setDropTargetType] = useState(null);

  const handleDragStart = (e, provId) => {
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
          const presentChildren = g.children
            .map((c) => ({ ...c, provs: sortDefsIfNeeded(c.type, provsByType[c.type] || []) }))
            .filter((c) => c.provs.length > 0);
          const total = presentChildren.reduce((acc, c) => acc + c.provs.length, 0);
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

  // Status-color tokens for sidebar provision dots (Recital palette).
  const statusDotColor = (status) => {
    if (status === 'approved') return 'var(--buyer)';
    if (status === 'flagged')  return 'var(--accent)';
    return 'var(--ink-faint)';
  };

  // Render the per-provision list under a type. Each row is draggable.
  const renderProvList = (provs) => (
    <div className="mt-0.5" style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {provs.map(p => {
        const status = getProvisionStatus(p);
        const isActive = p.id === activeProvId;
        const isDragging = dragProvId === p.id;
        return (
          <button
            key={p.id}
            draggable
            onDragStart={(e) => handleDragStart(e, p.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectProvision(p.id)}
            className={`rec-side-item${isActive ? ' active' : ''}`}
            style={{
              fontSize: 12.5,
              padding: '5px 10px',
              cursor: isDragging ? 'grabbing' : 'grab',
              opacity: isDragging ? 0.4 : 1,
            }}
            title="Drag to a different category to reclassify"
          >
            <span className="dot" style={{ background: statusDotColor(status) }} />
            <span className="truncate">{p.category || 'General'}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <aside
      className="shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        width: 286,
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
            const flatDropType = isFlatGroup ? (group.singleType || group.types[0]) : null;
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
                  </span>
                  <span className="count">{group.total}</span>
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
                                <span className="count">{child.provs.length}</span>
                              </div>
                              {!childCollapsed && renderProvList(child.provs)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Flat group: directly render its provisions list.
                      renderProvList(group.provs)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Footer (Recital style) */}
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
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════
   STRUCTURED FEATURES — renders the type-specific schema
   directly from ai_metadata.features. Falls back gracefully
   for older provisions that lack this payload.
   ═══════════════════════════════════════════════════════════ */
/* Small inline badge for a canonical taxonomy code (e.g. "WHOLLY_OWNED_SUB"). */
// Humanize a taxonomy code for display: "ACCELERATED_VESTING" → "Accelerated Vesting".
// Falls back to the raw code if it doesn't look like an UPPER_SNAKE code.
function humanizeBadgeText(code) {
  if (!code) return '';
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) return code;
  return code
    .toLowerCase()
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function CodeBadge({ code }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center font-ui font-medium text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
      {humanizeBadgeText(code)}
    </span>
  );
}

/* Render a single tagged item as: [CODE] Canonical label
 *                                  "original verbatim text" (italic gray) */
function TaggedItem({ featureKey, item }) {
  if (!isTaggedItem(item)) {
    // Backward compat: legacy free-text string
    return (
      <span className="font-body text-xs text-inkMid leading-relaxed">
        {typeof item === 'string' ? item : JSON.stringify(item)}
      </span>
    );
  }
  const label = resolveTaggedLabel(featureKey, item);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <CodeBadge code={item.code} />
        <span className="text-xs font-ui font-semibold text-ink">{label}</span>
      </div>
      {item.text && (
        <p className="font-body text-[11px] text-inkFaint italic leading-relaxed pl-1">
          &ldquo;{item.text}&rdquo;
        </p>
      )}
    </div>
  );
}

/* Render a single (non-list) tagged value inline. Falls back to text. */
function TaggedValue({ featureKey, value }) {
  if (isTaggedItem(value)) {
    const label = resolveTaggedLabel(featureKey, value);
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-baseline gap-1.5 flex-wrap">
          <CodeBadge code={value.code} />
          <span className="text-ink">{label}</span>
        </span>
        {value.text && (
          <span className="font-body text-[11px] text-inkFaint italic leading-relaxed">
            &ldquo;{value.text}&rdquo;
          </span>
        )}
      </span>
    );
  }
  return <span className="text-ink">{String(value)}</span>;
}

/* Returns true when a feature value is considered "empty" for display. */
function isEmptyValue(raw) {
  if (raw === null || raw === undefined) return true;
  if (raw === '') return true;
  if (Array.isArray(raw) && raw.length === 0) return true;
  // Citable shape — empty if the inner value is empty AND there is no quote.
  if (isCitableValue(raw)) {
    const inner = getCitableValue(raw);
    const hasInner = !(inner === null || inner === undefined || inner === '');
    if (hasInner) return false;
    return !getCitableText(raw);
  }
  return false;
}

/* ── Detect tiered bring-down feature values. ── */
function isBringDownTiers(featureKey, value) {
  if (featureKey !== 'bringDownTiers') return false;
  return Array.isArray(value) && value.length > 0 && value.every(
    (v) => v && typeof v === 'object' && !Array.isArray(v),
  );
}

/* ── Render a tiered bring-down value as a compact inline table. ── */
function BringDownTiersTable({ tiers }) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="min-w-full text-[11px] font-ui border border-border rounded">
        <thead className="bg-bg/60">
          <tr>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
              Reps Covered
            </th>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
              Standard
            </th>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
              Exceptions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tiers.map((t, i) => {
            const reps = t.reps_covered || t.repsCovered || '';
            const stdCode = t.standard || t.standardCode || null;
            const stdLabel = t.standard_label || t.standardLabel || stdCode || '';
            const exceptions = t.exceptions || '';
            return (
              <tr key={i} className="align-top">
                <td className="px-2 py-1 text-ink whitespace-pre-wrap break-words">
                  {reps || <span className="text-inkFaint/70 italic">—</span>}
                </td>
                <td className="px-2 py-1 text-ink">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {stdCode ? <CodeBadge code={stdCode} /> : null}
                    <span>{stdLabel || (stdCode ? '' : '—')}</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-inkMid whitespace-pre-wrap break-words">
                  {exceptions || <span className="text-inkFaint/70 italic">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── COV-EMPLOYEE compensationItems — render as a proper table ── */
function isCompensationItemsList(featureKey, value) {
  if (featureKey !== 'compensationItems') return false;
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((v) => v && typeof v === 'object' && !Array.isArray(v));
}

function CompensationItemsTable({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="min-w-full text-[11px] font-ui border border-border rounded">
        <thead className="bg-bg/60">
          <tr>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
              Item
            </th>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">
              Standard
            </th>
            <th className="px-2 py-1 text-left font-medium text-inkFaint uppercase tracking-wider">
              Text
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it, i) => {
            const itemCode = it.item || it.itemCode || null;
            const itemLabel = it.item_label || it.itemLabel || itemCode || '';
            const stdCode = it.standard_code || it.standardCode || null;
            const stdLabel = it.standard_label || it.standardLabel || stdCode || '';
            const txt = it.text || '';
            return (
              <tr key={i} className="align-top">
                <td className="px-2 py-1 text-ink whitespace-nowrap">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {itemCode ? <CodeBadge code={itemCode} /> : null}
                    <span>{itemLabel || (itemCode ? '' : '—')}</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-ink">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {stdCode ? <CodeBadge code={stdCode} /> : null}
                    <span>{stdLabel || (stdCode ? '' : '—')}</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-inkMid whitespace-pre-wrap break-words">
                  {txt
                    ? <span className="font-body italic">&ldquo;{txt}&rdquo;</span>
                    : <span className="text-inkFaint/70 italic">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── COV-EMPLOYEE dedicated renderer — replaces StructuredFeatures for
 *    Employee Matters provisions so compensationItems renders as a table
 *    and the rest of the key/value fields render as a clean list. ── */
function EmploymentMattersBlock({ provision }) {
  const features = getStructuredFeatures(provision) || {};
  const schemaKeys = getFeatureSchema(provision.type, provision.code);
  const extraKeys = Object.keys(features).filter((k) => !schemaKeys.includes(k));
  const allKeys = [...schemaKeys, ...extraKeys];

  // Pull compensationItems out — it gets its own table block.
  const compItems = Array.isArray(features.compensationItems) ? features.compensationItems : null;

  const renderable = [];
  for (const k of allKeys) {
    if (k === 'compensationItems') continue; // handled separately
    const raw = features[k];
    if (isEmptyValue(raw)) {
      renderable.push({ key: k, value: null, raw: null, empty: true });
      continue;
    }
    const value = formatFeatureValue(raw);
    if (value === null || value === undefined || value === '') {
      renderable.push({ key: k, value: null, raw: null, empty: true });
      continue;
    }
    renderable.push({ key: k, value, raw, empty: false });
  }

  return (
    <div className="bg-bg/40 border border-border rounded-md p-3 space-y-3">
      <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
        Employee Matters Covenant
      </p>

      {compItems && compItems.length > 0 && (
        <div>
          <p className="text-xs font-ui font-medium text-inkMid mb-1">
            Compensation &amp; Benefits:
          </p>
          <CompensationItemsTable items={compItems} />
        </div>
      )}

      {renderable.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {renderable.map(({ key, value, raw, empty }) => (
            <div key={key} className="text-xs font-ui flex flex-col">
              <dt className="text-inkFaint">{humanizeKey(key)}</dt>
              <dd className={empty ? 'text-inkFaint/70 italic' : 'text-ink'}>
                {empty ? (
                  <span>None</span>
                ) : isTaggedItem(raw) ? (
                  <TaggedValue featureKey={key} value={raw} />
                ) : Array.isArray(value) ? (
                  <ul className="list-disc list-inside space-y-0.5">
                    {value.map((v, i) => (
                      <li key={i} className="text-inkMid">{String(v)}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-ink">{value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function StructuredFeatures({ provision }) {
  // COV-EMPLOYEE gets a dedicated renderer (compensationItems as a table).
  if (provision && provision.code === 'COV-EMPLOYEE') {
    return <EmploymentMattersBlock provision={provision} />;
  }
  // Definitions don't get a structured summary — the full text IS the
  // summary, and the only metadata we surface (sourceSection + whether it's
  // an inline definition) is more naturally shown as inline chips on the
  // card header. Suppress the box here.
  if (provision && (provision.type === 'DEF' || provision.type === 'DEFINITIONS')) {
    return null;
  }
  const features = getStructuredFeatures(provision) || {};
  const exceptionLikeKeys = new Set(['permittedExceptions', 'carveOuts', 'carveOutsList']);

  // Schema keys for the provision type — always shown, with "—" if missing.
  // Pass the canonical code so code-specific schemas (e.g. TERMR-OUTSIDE)
  // narrow the displayed fields appropriately.
  const schemaKeys = getFeatureSchema(provision.type, provision.code);

  // Merge in any extra keys actually present in the data that aren't in the
  // schema (forward-compat / legacy data).
  const extraKeys = Object.keys(features).filter((k) => !schemaKeys.includes(k));
  const allKeys = [...schemaKeys, ...extraKeys];

  // On non-preamble provisions in section-style types, hide section-wide
  // shared fields (they're carried once on the preamble entry).
  const hideShared = !isPreambleProvision(provision);

  const renderable = [];
  const exceptionsFields = [];

  for (const k of allKeys) {
    if (hideShared && isSharedFeature(k, provision.type)) continue;
    const raw = features[k];

    // Tagged or plain LIST (e.g. permittedExceptions, carveOuts) — render in
    // exception/carve-out section regardless of contents (even when empty).
    if (exceptionLikeKeys.has(k) || isListTaxonomyKey(k)) {
      exceptionsFields.push({ key: k, items: Array.isArray(raw) ? raw : [] });
      continue;
    }

    // Tiered bring-down: render as inline table cell (full row width).
    if (isBringDownTiers(k, raw)) {
      renderable.push({ key: k, value: null, raw, empty: false, tiers: raw });
      continue;
    }

    // compensationItems (COV-EMPLOYEE shape): render as full-width sub-table.
    if (isCompensationItemsList(k, raw)) {
      renderable.push({ key: k, value: null, raw, empty: false, compItems: raw });
      continue;
    }

    if (isEmptyValue(raw)) {
      renderable.push({ key: k, value: null, raw: null, empty: true });
      continue;
    }

    const value = formatFeatureValue(raw);
    if (value === null || value === undefined || value === '') {
      renderable.push({ key: k, value: null, raw: null, empty: true });
      continue;
    }
    renderable.push({ key: k, value, raw, empty: false });
  }

  if (renderable.length === 0 && exceptionsFields.length === 0) return null;

  return (
    <div className="bg-bg/40 border border-border rounded-md p-3 space-y-2">
      <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
        Structured Summary
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {renderable.map(({ key, value, raw, empty, tiers, compItems }) => (
          <div
            key={key}
            className={`text-xs font-ui flex flex-col ${tiers || compItems ? 'sm:col-span-2' : ''}`}
          >
            <dt className="text-inkFaint">{humanizeKey(key)}</dt>
            <dd className={empty ? 'text-inkFaint/70 italic' : 'text-ink'}>
              {tiers ? (
                <BringDownTiersTable tiers={tiers} />
              ) : compItems ? (
                <CompensationItemsTable items={compItems} />
              ) : empty ? (
                <span>None</span>
              ) : isTaggedItem(raw) ? (
                <TaggedValue featureKey={key} value={raw} />
              ) : Array.isArray(value) ? (
                <ul className="list-disc list-inside space-y-0.5">
                  {value.map((v, i) => (
                    <li key={i} className="text-inkMid">{String(v)}</li>
                  ))}
                </ul>
              ) : (
                <>
                  <span className="text-ink">{value}</span>
                  {isCitableValue(raw) ? <EvidenceQuote text={getCitableText(raw)} /> : null}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {exceptionsFields.map((field) => (
        <div
          key={field.key}
          className="mt-2 pl-3 border-l-2 border-amber-200 bg-amber-50/40 rounded-r py-1.5 pr-2"
        >
          <p className="text-[10px] font-ui font-medium text-amber-700 uppercase tracking-wider mb-1">
            {humanizeKey(field.key)}
          </p>
          {field.items.length === 0 ? (
            <p className="text-[11px] font-ui text-inkFaint/70 italic">None</p>
          ) : (
            <ul className="space-y-1.5">
              {field.items.map((ex, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 mt-1 shrink-0">&bull;</span>
                  <div className="flex-1 min-w-0">
                    <TaggedItem featureKey={field.key} item={ex} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Render full provision text with section refs bolded ── */
const SECTION_REF_RE = /(§\s?\d+(?:\.\d+)*|\b(?:Section|Sections)\s+\d+(?:\.\d+)*[A-Za-z]?|\bArticle\s+(?:[IVXLCDM]+|\d+))/g;

function renderFullTextWithRefs(text) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  let m;
  let i = 0;
  SECTION_REF_RE.lastIndex = 0;
  while ((m = SECTION_REF_RE.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    parts.push(<strong key={`ref-${i++}`}>{m[0]}</strong>);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

/* ═══════════════════════════════════════════════════════════
   PROVISION CARD — shows BOTH structured summary AND full text
   together by default. Summary is the digest, full text is the
   source — they're shown back-to-back for context.
   ═══════════════════════════════════════════════════════════ */
/* ── Lead / headline derivation for the Recital card ── */
function getLeadText(provision) {
  const features = getStructuredFeatures(provision) || {};
  const candidates = [
    features.mainConcept,
    features.mainObligation,
    features.mainCondition,
    features.summary,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (isTaggedItem(c)) {
      const lbl = resolveTaggedLabel('mainConcept', c);
      if (lbl) return lbl;
    }
  }
  // Fall back to first sentence of full text
  if (provision.full_text) {
    const { header } = parseProvisionText(provision.full_text);
    if (header) return header;
    return provision.full_text.slice(0, 240);
  }
  return provision.category || 'Provision';
}

/* ── Derive a §-style ref code shown in the meta-row chip. ── */
function getRefCode(provision) {
  const meta = getAiMetadata(provision) || {};
  // Prefer an explicit section ref captured on the provision; otherwise
  // try to extract a "Section X.YY" / "Article X" from the full text head.
  const sectionRef =
    provision.section_ref ||
    meta.section_ref ||
    meta.sectionRef ||
    null;
  if (sectionRef) return String(sectionRef);
  const txt = provision.full_text || '';
  const m = txt.match(/§\s?\d+(?:\.\d+)*|Section\s+\d+(?:\.\d+)*[A-Za-z]?|Article\s+(?:[IVXLCDM]+|\d+)/i);
  if (m) return m[0];
  // Final fallback: provision.code (e.g. "TERMR-OUTSIDE") or the type code.
  if (provision.code) return provision.code;
  if (meta.code) return meta.code;
  return provision.type || '§';
}

/* ── Collect "key terms" for the card grid from structured features.
 *    We pick a handful of high-signal fields, format their values as
 *    short strings, and (if odd) span the last one across both cols.
 *    Returns [] when nothing usable is found. ── */
function getCardTerms(provision) {
  const features = getStructuredFeatures(provision);
  if (!features) return [];
  const schemaKeys = getFeatureSchema(provision.type, provision.code);
  // Skip fields that already show up elsewhere on the card.
  const skip = new Set([
    'mainConcept', 'mainObligation', 'mainCondition', 'summary',
    'permittedExceptions', 'carveOuts', 'carveOutsList',
    'affirmativeLimbs', 'positiveObligations',
    'compensationItems',
    'pandemicCarveout', 'covidCarveout', 'ordinaryCourseCarveout', 'requiredByLawCarveout',
  ]);
  const out = [];
  const keys = [...schemaKeys, ...Object.keys(features).filter((k) => !schemaKeys.includes(k))];
  for (const k of keys) {
    if (skip.has(k)) continue;
    const raw = features[k];
    if (isEmptyValue(raw)) continue;
    // Render tagged values to label; lists to "n items"; bools to Yes/No.
    let display = null;
    if (isTaggedItem(raw)) {
      display = resolveTaggedLabel(k, raw) || raw.code;
    } else if (Array.isArray(raw)) {
      if (raw.length === 0) continue;
      if (raw.every((v) => typeof v === 'string')) {
        display = raw.join('; ');
      } else if (raw.every((v) => isTaggedItem(v))) {
        display = raw.map((v) => resolveTaggedLabel(k, v) || v.code).join('; ');
      } else {
        display = `${raw.length} item${raw.length === 1 ? '' : 's'}`;
      }
    } else if (typeof raw === 'boolean') {
      display = raw ? 'Yes' : 'No';
    } else {
      display = String(raw);
    }
    if (!display) continue;
    out.push({ k, label: humanizeKey(k), value: display, raw });
    if (out.length >= 6) break;
  }
  return out;
}

/* ── Collect carve-outs / permitted exceptions for the Carve-outs block. ── */
function getCardCarveouts(provision) {
  const features = getStructuredFeatures(provision);
  if (!features) return [];
  const out = [];
  const seen = new Set();
  const pushItem = (raw, key) => {
    let s = null;
    if (isTaggedItem(raw)) {
      s = resolveTaggedLabel(key, raw) || raw.code;
    } else if (typeof raw === 'string' && raw.trim()) {
      s = raw.trim();
    }
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  const lists = ['permittedExceptions', 'carveOuts', 'carveOutsList'];
  for (const k of lists) {
    const list = features[k];
    if (Array.isArray(list)) list.forEach((item) => pushItem(item, k));
  }
  const bools = [
    ['requiredByLawCarveout', 'Required by law'],
    ['ordinaryCourseCarveout', 'Ordinary course of business'],
    ['pandemicCarveout', 'Pandemic measures'],
    ['covidCarveout', 'COVID measures'],
  ];
  for (const [k, label] of bools) {
    if (features[k] === true && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/* ── Card lead text + key terms + carve-outs renderer ── */
function ProvisionCard({ provision, onEdit }) {
  const [open, setOpen] = useState(false);
  const status = getProvisionStatus(provision);
  const refCode = getRefCode(provision);
  const lead = getLeadText(provision);
  const terms = getCardTerms(provision);
  const carveouts = getCardCarveouts(provision);
  const tHex = typeHex(provision.type);

  // For Employee Benefits / Employee Matters COV provisions, render the
  // Type | Standard | Time Period summary INSIDE this card (below the
  // source text). buildEmployeeBenefitsSummary works on a list; pass a
  // single-element list scoped to THIS provision so each Employee
  // Benefits card shows its own breakdown.
  const employeeBenefitsSummary = useMemo(() => {
    if (!isEmployeeBenefitsProvision(provision)) return null;
    return buildEmployeeBenefitsSummary([provision]);
  }, [provision]);

  const handleCardClick = (e) => {
    // Only open edit panel when clicking the card body (not the source toggle).
    if (e.target.closest('.rec-source-toggle') || e.target.closest('.rec-source-body')) return;
    onEdit && onEdit(provision);
  };

  return (
    <article
      id={`prov-${provision.id}`}
      className="rec-card cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="rec-card-body">
        {/* Meta row */}
        <div className="rec-card-meta">
          <span
            className="rec-chip-code"
            style={{
              color: tHex,
              background: typeTint(provision.type, 11),
              borderColor: typeTint(provision.type, 30),
            }}
          >
            {refCode}
          </span>
          <span className="rec-card-cat">{provision.category || 'General'}</span>
          <FavPill fav={provision.ai_favorability} />
          <RecStatusTag status={status} />
        </div>

        {/* Lead — plain-English headline */}
        {lead && <p className="rec-lead">{lead}</p>}

        {/* Key-terms grid */}
        {terms.length > 0 && (
          <dl className="rec-terms">
            {terms.map((t, i) => {
              const span = terms.length % 2 === 1 && i === terms.length - 1;
              return (
                <div key={t.k} className={`rec-term${span ? ' span2' : ''}`}>
                  <dt className="k">{t.label}</dt>
                  <dd className="v">{t.value}</dd>
                </div>
              );
            })}
          </dl>
        )}

        {/* Carve-outs */}
        {carveouts.length > 0 && (
          <div className="rec-carveouts">
            <div className="co-head">
              Carve-outs &amp; exceptions
              <span className="n">{carveouts.length}</span>
            </div>
            <ul>
              {carveouts.map((c, i) => (
                <li key={i}>
                  <span className="m">—</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source text (collapsible) */}
        {provision.full_text && (
          <div className="rec-source">
            <button
              type="button"
              className={`rec-source-toggle${open ? ' open' : ''}`}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            >
              <span className="car">›</span>
              {open ? 'Hide source text' : `Source text · ${refCode}`}
            </button>
            {open && (
              <div className="rec-source-body">
                {renderFullTextWithRefs(provision.full_text)}
              </div>
            )}
          </div>
        )}

        {/* Employee Benefits Treatment table — rendered inside the Employee
            Benefits / Employee Matters provision card so it sits next to
            the structured features grid. Stop click propagation so clicking
            the table or its action buttons doesn't open the edit panel. */}
        {employeeBenefitsSummary && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <EmployeeBenefitsTreatmentTable
              summary={employeeBenefitsSummary}
              onSelectProvision={onEdit}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════
   PREAMBLE CARD — compact card shown ABOVE the summary table on
   category pages. Shows a focused structured summary of the
   section preamble (visible by default) and a collapsible full
   text (hidden by default).
   ═══════════════════════════════════════════════════════════ */

// Render the IOC preamble's positiveObligations + exceptions as two
// simple lists. Returns null if there's nothing meaningful to show.
function IocPreambleSummary({ features }) {
  if (!features) return null;

  // Limbs may come from the legacy positiveObligations (AI-extracted) or
  // the newer affirmativeLimbs (regex-extracted from the consolidated
  // "Affirmative Covenants" provision). Both render as a numbered list.
  const limbsRaw = Array.isArray(features.affirmativeLimbs) && features.affirmativeLimbs.length > 0
    ? features.affirmativeLimbs
    : Array.isArray(features.positiveObligations)
    ? features.positiveObligations
    : [];

  // Exceptions / carve-outs aggregated from the standard IOC carveout
  // fields. Each entry is { label, value? } so we render boolean carveouts
  // as a bullet and "permittedExceptions" items as their resolved labels.
  const exceptionEntries = [];

  const pushBoolCarveout = (key, label) => {
    const v = features[key];
    if (v === true) {
      exceptionEntries.push({ key, label });
      return;
    }
    if (isTaggedItem(v)) {
      const resolved = resolveTaggedLabel(key, v) || v.code;
      exceptionEntries.push({ key, label: `${label}: ${resolved}` });
      return;
    }
    if (typeof v === 'string' && v.trim()) {
      exceptionEntries.push({ key, label: `${label}: ${v.trim()}` });
    }
  };

  pushBoolCarveout('requiredByLawCarveout', 'Required by law');
  pushBoolCarveout('ordinaryCourseCarveout', 'Ordinary course of business');
  pushBoolCarveout('pandemicCarveout', 'Pandemic measures');
  pushBoolCarveout('covidCarveout', 'COVID measures');

  const permitted = Array.isArray(features.permittedExceptions)
    ? features.permittedExceptions
    : [];
  for (const item of permitted) {
    if (isTaggedItem(item)) {
      const lbl = resolveTaggedLabel('permittedExceptions', item) || item.code;
      exceptionEntries.push({ key: 'permittedExceptions', label: lbl, item });
    } else if (typeof item === 'string' && item.trim()) {
      exceptionEntries.push({ key: 'permittedExceptions', label: item.trim() });
    }
  }

  if (limbsRaw.length === 0 && exceptionEntries.length === 0) return null;

  const renderLimb = (limb) => {
    // affirmativeLimbs shape: { obligation_code, obligation_label, text }
    if (limb && typeof limb === 'object' && (limb.obligation_label || limb.text)) {
      return limb.obligation_label || limb.text;
    }
    if (isTaggedItem(limb)) {
      const lbl = resolveTaggedLabel('positiveObligations', limb) || limb.code;
      return lbl;
    }
    return String(limb);
  };

  return (
    <div className="bg-bg/40 border border-border rounded-md p-3 space-y-3">
      <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
        Structured Summary
      </p>

      {limbsRaw.length > 0 && (
        <div>
          <p className="text-xs font-ui font-medium text-inkMid mb-1">
            Positive Obligations:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-xs font-ui text-ink">
            {limbsRaw.map((limb, i) => (
              <li key={i}>{renderLimb(limb)}</li>
            ))}
          </ol>
        </div>
      )}

      {exceptionEntries.length > 0 && (
        <div className="pl-3 border-l-2 border-amber-200 bg-amber-50/40 rounded-r py-1.5 pr-2">
          <p className="text-[10px] font-ui font-medium text-amber-700 uppercase tracking-wider mb-1">
            Exceptions / Carve-outs
          </p>
          <ul className="space-y-1">
            {exceptionEntries.map((ex, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-ui">
                <span className="text-amber-500 mt-0.5 shrink-0">&bull;</span>
                <span className="text-ink">{ex.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreambleCard({ provision, onEdit }) {
  const [showFullText, setShowFullText] = useState(false);
  const tc = typeColor(provision.type);
  const features = getStructuredFeatures(provision) || {};

  // For IOC preambles, render a focused summary (limbs + exceptions only).
  // For other section types, fall back to the generic StructuredFeatures.
  const isIocPreamble =
    provision.type === 'IOC' ||
    provision.type === 'IOC-T' ||
    provision.type === 'IOC-B';

  const summary = isIocPreamble ? (
    <IocPreambleSummary features={features} />
  ) : (
    <StructuredFeatures provision={provision} />
  );

  return (
    <div
      className={`bg-white border rounded-lg shadow-sm p-4 ${tc.border}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-xs font-ui font-semibold text-ink uppercase tracking-wider">
          Section Preamble
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowFullText((v) => !v); }}
            className="px-2 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors text-inkMid flex items-center gap-1"
          >
            <span>{showFullText ? '−' : '+'}</span>
            {showFullText ? 'Hide Full Text' : 'Show Full Text'}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(provision); }}
              className="px-2 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors text-inkMid"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {summary || (
        <p className="text-xs font-ui text-inkFaint italic">
          No structured summary available.
        </p>
      )}

      {showFullText && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1">
            Full Text
          </p>
          {provision.full_text ? (
            <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {renderFullTextWithRefs(provision.full_text)}
            </p>
          ) : (
            <p className="font-ui text-xs text-inkFaint italic">No text available.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IOC PREAMBLE SECTION — top-of-page panel showing the
   consolidated "Affirmative Covenants" and "General Exceptions"
   provisions side-by-side. These come BEFORE the table of
   enumerated negative restrictions.
   ═══════════════════════════════════════════════════════════ */
/* Split a "General Exceptions" / section-wide carve-outs blob into a list
 * of structured items. Tries to split on:
 *   - enumerated sub-clauses ("(i)", "(ii)", "(a)", "(b)") at the start of an item
 *   - "Except as ... ; (i) ... ; (ii) ..." patterns
 *   - semicolons or "; or" separators
 *   - sentence boundaries as a last resort
 * Returns an array of trimmed string items (de-duped, length > 8). */
function splitGeneralExceptionsItems(text) {
  if (!text || typeof text !== 'string') return [];
  let body = text.trim();
  // Strip leading framing like "Except as ..." and "Notwithstanding ...".
  // Keep it as a "preface" so the reader still sees the framing if present.
  const items = [];

  // Try enumerated sub-clause splitting first.
  const enumeratedRe = /\(([ivxlcdm]+|[a-z]|\d+)\)\s+/gi;
  const matches = [];
  let m;
  while ((m = enumeratedRe.exec(body)) !== null) {
    matches.push({ index: m.index, marker: m[0] });
  }
  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].marker.length;
      const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
      const t = body.substring(start, end).trim().replace(/[;,]\s*(?:or|and)?\s*$/, '');
      if (t.length > 8) items.push(t);
    }
    return items;
  }

  // Fallback: split on "; " or " and " between clauses. Keep it conservative.
  const parts = body
    .split(/(?:\s*;\s+(?:and|or)?\s*)|(?:\.\s+(?=[A-Z(]))/)
    .map((s) => s.trim().replace(/[;,]\s*(?:or|and)?\s*$/, ''))
    .filter((s) => s.length > 12);
  return parts;
}

function IocBucketCard({ provision, title, onEdit }) {
  const [showFullText, setShowFullText] = useState(false);
  if (!provision) return null;
  const features = getStructuredFeatures(provision) || {};
  const limbs = Array.isArray(features.affirmativeLimbs) ? features.affirmativeLimbs : [];
  const isGeneralExceptions = isIocGeneralExceptions(provision);
  const exceptionItems = isGeneralExceptions && (provision.full_text || provision.text)
    ? splitGeneralExceptionsItems(provision.full_text || provision.text)
    : [];

  const renderLimb = (limb) => {
    if (limb && typeof limb === 'object' && (limb.obligation_label || limb.text)) {
      return limb.obligation_label || limb.text;
    }
    if (isTaggedItem(limb)) {
      const lbl = resolveTaggedLabel('affirmativeLimbs', limb) || limb.code;
      return lbl;
    }
    return String(limb);
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h4 className="text-xs font-ui font-semibold text-ink uppercase tracking-wider">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowFullText((v) => !v); }}
            className="px-2 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors text-inkMid flex items-center gap-1"
          >
            <span>{showFullText ? '−' : '+'}</span>
            {showFullText ? 'Hide Full Text' : 'Show Full Text'}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(provision); }}
              className="px-2 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors text-inkMid"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {limbs.length > 0 ? (
        <ol className="list-decimal list-inside space-y-1 text-xs font-ui text-ink">
          {limbs.map((limb, i) => (
            <li key={i}>{renderLimb(limb)}</li>
          ))}
        </ol>
      ) : isGeneralExceptions && exceptionItems.length > 0 ? (
        <ul className="list-disc list-inside space-y-1 text-xs font-ui text-ink">
          {exceptionItems.map((item, i) => (
            <li key={i} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap">
          {provision.full_text || provision.text || ''}
        </p>
      )}

      {showFullText && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1">
            Full Text
          </p>
          {provision.full_text ? (
            <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {renderFullTextWithRefs(provision.full_text)}
            </p>
          ) : (
            <p className="font-ui text-xs text-inkFaint italic">No text available.</p>
          )}
        </div>
      )}
    </div>
  );
}

function IocPreambleSection({ affirmative, generalExceptions, onEdit }) {
  if (!affirmative && !generalExceptions) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-ui font-semibold text-inkMid uppercase tracking-wider">
        Affirmative Covenants &amp; Section-Wide Exceptions
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {affirmative && (
          <IocBucketCard
            provision={affirmative}
            title="Affirmative Covenants"
            onEdit={onEdit}
          />
        )}
        {generalExceptions && (
          <IocBucketCard
            provision={generalExceptions}
            title="General Exceptions"
            onEdit={onEdit}
          />
        )}
      </div>
    </div>
  );
}

/* ── Employee Benefits summary box (Bringdown-style). Shown above the COV
 *    Employee Benefits provisions on the Other Covenants page. Reads the
 *    standards the provision sets for each comp/benefit item (base salary,
 *    bonus, benefits, severance, LTI, …) and lists each populated row.
 *    Returns null when no relevant features are present so the box stays
 *    out of the way for other COV types. */
const EMPLOYEE_BENEFITS_ROWS = [
  { label: 'Base Salary',          itemCodes: ['BASE_SALARY'],
    keys: ['baseSalaryStandard', 'baseSalary'],
    periodKeys: ['baseSalaryPeriod', 'baseSalaryTimePeriod'] },
  { label: 'Bonus',                itemCodes: ['TARGET_BONUS', 'ANNUAL_BONUS_PAID'],
    keys: ['bonusStandard', 'targetBonusStandard'],
    periodKeys: ['bonusPeriod', 'targetBonusPeriod', 'bonusTimePeriod'] },
  { label: 'Benefits',             itemCodes: ['HEALTH_WELFARE', 'RETIREMENT', 'OTHER_BENEFITS'],
    keys: ['benefitsStandard', 'healthWelfareStandard'],
    periodKeys: ['benefitsPeriod', 'healthWelfarePeriod'] },
  { label: 'Severance',            itemCodes: ['SEVERANCE'],
    keys: ['severanceStandard'],
    periodKeys: ['severancePeriod', 'severanceTimePeriod'] },
  { label: 'Long-Term Incentive',  itemCodes: ['LONG_TERM_INCENTIVE', 'EQUITY_AWARDS'],
    keys: ['ltiStandard', 'longTermIncentiveStandard'],
    periodKeys: ['ltiPeriod', 'longTermIncentivePeriod'] },
];

// Format months/duration → friendly text. Numbers become "N months";
// strings pass through. Used by the Time Period column to coerce
// protectionPeriodMonths (number) into something readable.
function formatBenefitsPeriod(v) {
  if (v === null || v === undefined || v === '' || v === false) return null;
  if (typeof v === 'number') {
    return `${v} month${v === 1 ? '' : 's'}`;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  if (isTaggedItem(v)) {
    return v.label || v.text || v.code;
  }
  return String(v);
}

function isEmployeeBenefitsProvision(p) {
  if (!p) return false;
  const cat = String(p?.category || '').toLowerCase();
  if (!cat) return false;
  return /employee[^a-z]*benefits|benefits[^a-z]*continuation|employee\s+matters|continuing\s+employees/i.test(cat);
}

function buildEmployeeBenefitsSummary(covProvisions) {
  const ebProvs = (covProvisions || []).filter(isEmployeeBenefitsProvision);
  if (ebProvs.length === 0) return null;
  const rows = [];
  // Section-wide protection period — used as the fallback Time Period for
  // every row when nothing more specific is set per item.
  let fallbackPeriod = null;
  for (const p of ebProvs) {
    const f = getStructuredFeatures(p) || {};
    fallbackPeriod = fallbackPeriod
      || formatBenefitsPeriod(f.protectionPeriodMonths)
      || formatBenefitsPeriod(f.protectionPeriod)
      || formatBenefitsPeriod(f.employeeBenefitPeriod);
    if (fallbackPeriod) break;
  }

  for (const spec of EMPLOYEE_BENEFITS_ROWS) {
    let standardText = null;
    let periodText = null;
    let source = null;
    for (const p of ebProvs) {
      const f = getStructuredFeatures(p) || {};
      // 1. Explicit per-key feature (most reliable when present).
      for (const k of spec.keys) {
        const v = f[k];
        if (v === null || v === undefined || v === '' || v === false) continue;
        if (isTaggedItem(v)) {
          standardText = resolveTaggedLabel(k, v) || v.code;
        } else {
          standardText = String(v);
        }
        source = p;
        break;
      }
      // Look for an explicit per-item period via well-known feature keys.
      if (!periodText) {
        for (const pk of (spec.periodKeys || [])) {
          const v = f[pk];
          const fmt = formatBenefitsPeriod(v);
          if (fmt) { periodText = fmt; break; }
        }
      }
      if (standardText && periodText) break;
      // 2. compensationItems array (the canonical shape).
      const items = Array.isArray(f.compensationItems) ? f.compensationItems : [];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const itemCode = String(item.item || item.code || '').toUpperCase();
        if (!spec.itemCodes.includes(itemCode)) continue;
        if (!standardText) {
          const std = item.standard_label || item.standardLabel || item.standard_code || item.standardCode;
          if (std) {
            standardText = String(std);
            source = p;
          }
        }
        if (!periodText) {
          const itemPeriod = formatBenefitsPeriod(
            item.timePeriod || item.time_period || item.duration || item.period,
          );
          if (itemPeriod) periodText = itemPeriod;
        }
        if (standardText && periodText) break;
      }
      if (standardText && periodText) break;
    }
    if (standardText) {
      rows.push({
        label: spec.label,
        value: standardText,
        // Fall back to the section-wide protection period when nothing more
        // specific is available, so each row still has a Time Period.
        period: periodText || fallbackPeriod || null,
        source,
      });
    }
  }
  if (rows.length === 0) return null;
  return { rows, ebProvs };
}

function EmployeeBenefitsTreatmentTable({ summary, onSelectProvision }) {
  if (!summary) return null;
  const { rows } = summary;
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Employee Benefits Treatment
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider w-[180px]">Type</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Standard</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[160px]">Time Period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-bg/40 transition-colors align-top">
                <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">{row.label}</td>
                <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                  {row.source && onSelectProvision ? (
                    <button
                      type="button"
                      onClick={() => onSelectProvision(row.source)}
                      className="text-left text-ink hover:underline"
                    >
                      {row.value}
                    </button>
                  ) : (
                    <span>{row.value}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                  {row.period || <span className="text-inkFaint/70 italic">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── IOC Affirmative Covenants table (Bringdown-style box)
 *    Shows one row per known affirmative-covenant sub-code in this IOC
 *    section: Ordinary Course, Preservation of Relationships, Maintain
 *    Business Organization, etc. Falls back to category match if no codes
 *    are present. Returns null when nothing matches. */
const IOC_AFFIRMATIVE_BUCKETS = [
  {
    code: 'IOC-ORDINARY',
    name: 'Ordinary Course Obligation',
    catRe: /ordinary\s+course/i,
    defaultAppliesTo: 'Business operations',
  },
  {
    code: 'IOC-PRESERVE',
    name: 'Preservation of Business Relationships',
    catRe: /(?:preservation|preserve).*relationship/i,
    defaultAppliesTo: 'Customers, suppliers, employees, governmental entities',
  },
  {
    code: 'IOC-MAINTAIN',
    name: 'Maintain Business Organization & Material Assets',
    catRe: /maintain.*(?:business|organization|assets)/i,
    defaultAppliesTo: 'Officers, key employees, properties, assets',
  },
  {
    code: 'IOC-NOACTION',
    name: 'General No-Action Restriction',
    catRe: /no\s+action/i,
  },
  // No New Lines of Business is a NEGATIVE covenant — intentionally NOT
  // included here. It falls through to the main IOC sub-clause table below.
];

// Codes/categories that identify a "No New Lines of Business" provision —
// used to exclude it from the affirmative-covenants box so it stays in the
// negative sub-clause table where it belongs.
function isNoNewLinesOfBusiness(p) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  const code = String(meta.code || p.code || '');
  if (code === 'IOC-NEWLINE') return true;
  const cat = String(p?.category || '');
  return /new\s+lines?\s+of\s+business|no\s+new\s+line\s+of\s+business/i.test(cat);
}

function findIocAffirmativeMatches(iocProvisions) {
  if (!Array.isArray(iocProvisions) || iocProvisions.length === 0) return [];
  const used = new Set();
  const matches = [];
  for (const bucket of IOC_AFFIRMATIVE_BUCKETS) {
    let hit = null;
    for (const p of iocProvisions) {
      if (used.has(p.id)) continue;
      const meta = getAiMetadata(p) || {};
      const code = String(meta.code || p.code || '');
      if (code === bucket.code) { hit = p; break; }
    }
    if (!hit) {
      for (const p of iocProvisions) {
        if (used.has(p.id)) continue;
        const cat = String(p?.category || '');
        if (bucket.catRe.test(cat)) { hit = p; break; }
      }
    }
    if (hit) {
      used.add(hit.id);
      matches.push({ bucket, provision: hit });
    }
  }
  return matches;
}

function IocAffirmativeCovenantsTable({ iocProvisions, onSelectProvision }) {
  const matches = useMemo(
    () => findIocAffirmativeMatches(iocProvisions),
    [iocProvisions],
  );
  if (matches.length === 0) return null;

  // Resolve a raw string standard code (e.g. "COMMERCIALLY_REASONABLE_EFFORTS")
  // to its human label by looking it up in the EFFORTS_STANDARDS taxonomy.
  // Falls back to a basic humanize on the raw string when no dict entry exists
  // so the UI never shows UPPER_SNAKE codes.
  const humanizeEffortsString = (raw) => {
    if (!raw || typeof raw !== 'string') return raw;
    const s = raw.trim();
    if (!s) return null;
    // Try the EFFORTS_STANDARDS dict first.
    const dict = taxonomyForFeatureKey('effortsStandard') || {};
    const fromDict = labelForCode(s, dict);
    if (fromDict) return fromDict;
    // Generic UPPER_SNAKE -> Title Case fallback (only if it actually looks
    // like a code — otherwise return the raw string untouched so we don't
    // mangle real prose).
    if (/^[A-Z][A-Z0-9_-]+$/.test(s)) {
      return s
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return s;
  };

  // Pull the efforts standard for THIS provision. Prefer the canonical
  // tagged effortsStandard; fall back to any obligation's efforts_standard
  // (used on the affirmativeLimbs / positiveObligations arrays).
  const standardFor = (provision) => {
    const f = getStructuredFeatures(provision) || {};
    if (isTaggedItem(f.effortsStandard)) {
      return resolveTaggedLabel('effortsStandard', f.effortsStandard) || f.effortsStandard.label || f.effortsStandard.code;
    }
    if (typeof f.effortsStandard === 'string' && f.effortsStandard.trim()) {
      return humanizeEffortsString(f.effortsStandard);
    }
    // Try the obligation arrays — they each carry their own efforts_standard.
    const limbs = Array.isArray(f.affirmativeLimbs) ? f.affirmativeLimbs
      : Array.isArray(f.positiveObligations) ? f.positiveObligations
      : [];
    for (const limb of limbs) {
      if (!limb || typeof limb !== 'object') continue;
      const es = limb.efforts_standard || limb.effortsStandard;
      if (!es) continue;
      if (typeof es === 'string' && es.trim()) return humanizeEffortsString(es);
      if (isTaggedItem(es)) {
        return resolveTaggedLabel('effortsStandard', es) || es.label || es.code;
      }
    }
    return null;
  };

  // Pull the scope / "applies to" text. Prefer a per-bucket structured field;
  // fall back to bucket-level defaults so the canonical rows always read well.
  const appliesToFor = (provision, bucket) => {
    const f = getStructuredFeatures(provision) || {};
    const fromText = (v) => {
      if (!v) return null;
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (Array.isArray(v)) {
        const parts = v
          .map((x) => (typeof x === 'string' ? x.trim() : (x && (x.label || x.text)) || ''))
          .filter(Boolean);
        return parts.length ? parts.join(', ') : null;
      }
      if (typeof v === 'object' && (v.label || v.text)) return v.label || v.text;
      return null;
    };
    const candidates = [f.scope, f.appliesTo, f.appliesto, f.applies_to];
    for (const c of candidates) {
      const v = fromText(c);
      if (v) return v;
    }
    // Look on the obligation arrays for a per-limb scope.
    const limbs = Array.isArray(f.affirmativeLimbs) ? f.affirmativeLimbs
      : Array.isArray(f.positiveObligations) ? f.positiveObligations
      : [];
    for (const limb of limbs) {
      if (!limb || typeof limb !== 'object') continue;
      const v = fromText(limb.scope) || fromText(limb.appliesTo);
      if (v) return v;
    }
    return bucket.defaultAppliesTo || null;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Affirmative Covenants
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[260px]">Covenant</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[220px]">Standard</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Applies To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matches.map(({ bucket, provision }) => {
              const std = standardFor(provision);
              const scope = appliesToFor(provision, bucket);
              return (
                <tr key={bucket.code} className="hover:bg-bg/40 transition-colors align-top">
                  <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectProvision && onSelectProvision(provision)}
                      className="text-left text-accent hover:underline font-medium"
                    >
                      {bucket.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                    {std || <span className="text-inkFaint/70 italic">—</span>}
                  </td>
                  <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                    {scope || <span className="text-inkFaint/70 italic">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── IOC General Exceptions table (Bringdown-style box)
 *    Renders the section-wide permittedExceptions (scope=preamble) and/or
 *    the items extracted from the consolidated General Exceptions provision.
 *    Returns null when nothing meaningful is available. */
function IocGeneralExceptionsTable({ iocProvisions, generalExceptionsProv, onSelectProvision }) {
  const rows = useMemo(() => {
    const out = [];

    // 1. Pull permittedExceptions from any IOC provision where scope === 'preamble'
    //    (canonical section-wide carve-outs). Fall back to any permittedExceptions
    //    when no scoped version exists.
    const seenLabels = new Set();
    const addException = (label, source) => {
      if (!label) return;
      const key = String(label).toLowerCase().trim();
      if (!key || seenLabels.has(key)) return;
      seenLabels.add(key);
      out.push({ label: String(label), source });
    };

    const scoped = [];
    const unscoped = [];
    for (const p of iocProvisions || []) {
      const f = getStructuredFeatures(p) || {};
      const list = Array.isArray(f.permittedExceptions) ? f.permittedExceptions : [];
      for (const item of list) {
        const scope = item && typeof item === 'object' ? item.scope : null;
        if (scope === 'preamble') scoped.push({ item, source: p });
        else unscoped.push({ item, source: p });
      }
    }
    const exceptionItems = scoped.length > 0 ? scoped : unscoped;
    for (const { item, source } of exceptionItems) {
      if (isTaggedItem(item)) {
        const lbl = resolveTaggedLabel('permittedExceptions', item) || item.code;
        addException(lbl, source);
      } else if (typeof item === 'string' && item.trim()) {
        addException(item.trim(), source);
      }
    }

    // 2. If we have a consolidated General Exceptions provision, also pull
    //    its split items as additional rows (they're usually the most useful).
    if (generalExceptionsProv) {
      const text = generalExceptionsProv.full_text || generalExceptionsProv.text || '';
      const items = text ? splitGeneralExceptionsItems(text) : [];
      for (const t of items) addException(t, generalExceptionsProv);
    }

    return out;
  }, [iocProvisions, generalExceptionsProv]);

  if (rows.length === 0) return null;
  // Cap at 4 — items 5+ tend to belong to specific provisions and add noise
  // when surfaced as section-wide exceptions.
  const MAX_ITEMS = 4;
  const visibleRows = rows.slice(0, MAX_ITEMS);
  const overflowCount = Math.max(0, rows.length - visibleRows.length);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          General Exceptions
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider w-12">#</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Exception</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row, i) => (
              <tr key={i} className="hover:bg-bg/40 transition-colors align-top">
                <td className="px-3 py-2 text-inkFaint whitespace-nowrap">{i + 1}</td>
                <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                  {row.source && onSelectProvision ? (
                    <button
                      type="button"
                      onClick={() => onSelectProvision(row.source)}
                      className="text-left text-ink hover:underline"
                    >
                      {row.label}
                    </button>
                  ) : (
                    <span>{row.label}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflowCount > 0 && (
        <div className="px-3 py-1.5 bg-bg/40 border-t border-border">
          <p className="text-[11px] font-ui italic text-inkFaint">
            (+{overflowCount} more in specific provisions)
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CATEGORY OVERVIEW — section overview line per provision +
   collapsible full-text view shown ABOVE the summary table on
   category pages.
   ═══════════════════════════════════════════════════════════ */
function getOverviewLine(provision) {
  const features = getStructuredFeatures(provision);
  if (features) {
    if (typeof features.mainConcept === 'string' && features.mainConcept.trim()) {
      return features.mainConcept.trim();
    }
    if (isTaggedItem(features.mainConcept)) {
      const lbl = resolveTaggedLabel('mainConcept', features.mainConcept);
      if (lbl) return lbl;
    }
    if (typeof features.mainObligation === 'string' && features.mainObligation.trim()) {
      return features.mainObligation.trim();
    }
    if (typeof features.mainCondition === 'string' && features.mainCondition.trim()) {
      return features.mainCondition.trim();
    }
  }
  // Fall back to first sentence of full text
  if (provision.full_text) {
    const { header } = parseProvisionText(provision.full_text);
    return header || provision.full_text.slice(0, 200);
  }
  return '';
}

function CategoryOverview({ provisions, onSelectProvision }) {
  const [expanded, setExpanded] = useState(false);
  const [openProvIds, setOpenProvIds] = useState(() => new Set());

  if (!provisions || provisions.length === 0) return null;

  const toggleProv = (id) => {
    setOpenProvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Section Overview
        </h3>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-2 py-1 text-[11px] font-ui border border-border rounded hover:bg-bg transition-colors text-inkMid flex items-center gap-1"
        >
          <span>{expanded ? '−' : '+'}</span>
          {expanded ? 'Hide Full Provision Texts' : 'Show Full Provision Texts'}
        </button>
      </div>

      <ul className="space-y-1.5">
        {provisions.map((p) => {
          const line = getOverviewLine(p);
          return (
            <li key={p.id} className="flex items-start gap-2 text-xs font-ui">
              <span className="text-inkFaint mt-1 shrink-0">•</span>
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectProvision && onSelectProvision(p)}
                  className="font-medium text-accent hover:underline mr-1"
                >
                  {p.category || 'General'}:
                </button>
                <span className="text-inkMid">{line || <em className="text-inkFaint">No summary.</em>}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {expanded && (
        <div className="pt-3 border-t border-border space-y-2">
          {provisions.map((p) => {
            const isOpen = openProvIds.has(p.id);
            return (
              <div key={p.id} className="border border-border rounded">
                <button
                  type="button"
                  onClick={() => toggleProv(p.id)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-bg text-xs font-ui"
                >
                  <span className="font-medium text-ink truncate">
                    {p.category || 'General'}
                  </span>
                  <span className="text-inkFaint font-mono text-sm leading-none">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 py-2 border-t border-border bg-bg/30">
                    {p.full_text ? (
                      <p className="font-body text-xs text-ink leading-relaxed whitespace-pre-wrap">
                        {renderFullTextWithRefs(p.full_text)}
                      </p>
                    ) : (
                      <p className="font-ui text-xs text-inkFaint italic">No text available.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROVISION TABLE — tabular view of all provisions of one type.
   Each row is a provision; columns are the type's feature keys.
   ═══════════════════════════════════════════════════════════ */

// Per-type column denylist. These features are intentionally hidden from
// the summary table (either redundant with the row's main concept, captured
// inline in the exceptions column, or moved to the preamble section).
const HIDDEN_TABLE_COLUMNS = {
  IOC: ['mainObligation', 'mainConcept', 'pandemicCarveout', 'requiredByLawCarveout', 'ordinaryCourseCarveout', 'scheduleReference', 'affirmativeLimbs', 'consentStandard'],
  'IOC-T': ['mainObligation', 'mainConcept', 'pandemicCarveout', 'requiredByLawCarveout', 'ordinaryCourseCarveout', 'scheduleReference', 'affirmativeLimbs', 'consentStandard'],
  'IOC-B': ['mainObligation', 'mainConcept', 'pandemicCarveout', 'requiredByLawCarveout', 'ordinaryCourseCarveout', 'scheduleReference', 'affirmativeLimbs', 'consentStandard'],
  // REP-T/REP-B: rubric schema includes 'mainConcept' but the column is the
  // same as the "Term" column in the table, so hide it as a defensive measure.
  // Also hide crossReferences per user request.
  // Specific-rep presence flags (fundamental, sufficient funds, solvency,
  // anti-reliance, parent litigation/ownership/brokers) belong as their own
  // rep rows via sub-codes (REP-B-FUNDS, REP-B-SOLVENCY, REP-B-ANTIRELIANCE,
  // etc.), not as boolean columns on every rep. Hide them defensively.
  'REP-T': ['mainConcept', 'crossReferences', 'linkedBringDownStandard', 'solvencyRepIncluded', 'solvency_rep_included', 'financingRepIncluded', 'financing_rep_included', 'materialityScrape', 'materiality_scrape', 'bringDownStandard', 'bring_down_standard', 'scheduleReference', 'schedule_reference', 'fundamentalRep', 'fundamental_rep', 'sufficientFundsRepPresent', 'sufficient_funds_rep_present', 'sufficientFundsRepDetails', 'sufficient_funds_rep_details', 'solvencyRepPresent', 'solvency_rep_present', 'solvencyRepDetails', 'solvency_rep_details', 'antiRelianceRepPresent', 'anti_reliance_rep_present', 'antiRelianceRepText', 'anti_reliance_rep_text', 'parentLitigationRepPresent', 'parent_litigation_rep_present', 'parentOwnershipRepPresent', 'parent_ownership_rep_present', 'parentBrokersRepPresent', 'parent_brokers_rep_present'],
  'REP-B': ['mainConcept', 'crossReferences', 'linkedBringDownStandard', 'solvencyRepIncluded', 'solvency_rep_included', 'financingRepIncluded', 'financing_rep_included', 'materialityScrape', 'materiality_scrape', 'bringDownStandard', 'bring_down_standard', 'scheduleReference', 'schedule_reference', 'fundamentalRep', 'fundamental_rep', 'sufficientFundsRepPresent', 'sufficient_funds_rep_present', 'sufficientFundsRepDetails', 'sufficient_funds_rep_details', 'solvencyRepPresent', 'solvency_rep_present', 'solvencyRepDetails', 'solvency_rep_details', 'antiRelianceRepPresent', 'anti_reliance_rep_present', 'antiRelianceRepText', 'anti_reliance_rep_text', 'parentLitigationRepPresent', 'parent_litigation_rep_present', 'parentOwnershipRepPresent', 'parent_ownership_rep_present', 'parentBrokersRepPresent', 'parent_brokers_rep_present'],
  COND: ['certificationRequired', 'dollarThreshold', 'scheduleReference', 'bringDownTiers', 'maeConditionStandalone', 'maeStandaloneCondition', 'dissentingSharesThreshold', 'dissentingShares', 'dissentingSharesPct'],
  'COND-M': ['certificationRequired', 'dollarThreshold', 'scheduleReference', 'bringDownTiers', 'maeConditionStandalone', 'maeStandaloneCondition', 'dissentingSharesThreshold', 'dissentingShares', 'dissentingSharesPct'],
  'COND-B': ['certificationRequired', 'dollarThreshold', 'scheduleReference', 'bringDownTiers', 'maeConditionStandalone', 'maeStandaloneCondition', 'dissentingSharesThreshold', 'dissentingShares', 'dissentingSharesPct'],
  'COND-S': ['certificationRequired', 'dollarThreshold', 'scheduleReference', 'bringDownTiers', 'maeConditionStandalone', 'maeStandaloneCondition', 'dissentingSharesThreshold', 'dissentingShares', 'dissentingSharesPct'],
  // TERMR family — strip the table down to just the provision name + a
  // single "Term" cell (synthesized below for TERMR-OUTSIDE rows). Every
  // other column is hidden — the per-provision drill-in still shows the
  // full structured feature set.
  // Drop the long-tail termination fields from the per-row table — the
  // synthesized "Term" cell for TERMR-OUTSIDE already encodes extensions,
  // and the rest read as noise. The drill-in panel still shows everything.
  // We list every spelling variant we have ever seen the parser emit so
  // future schema drift doesn't silently leak columns back into the table.
  TERMR: [
    'terminationTriggers', 'curePeriod', 'partyWhoCanTerminate', 'faultBasedExclusion',
    'tickingFee', 'superiorProposalTermination', 'restraintFinality', 'restraintScope',
    'voteFailureContext', 'voteThreshold',
    'outsideDate', 'outsideDateMonths',
    'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'extensionConsentParty',
    // New extras to hide:
    'fundsCondition', 'funds_condition',
    'fundsConditionExcluded', 'funds_condition_excluded',
    'fundsConditionExclusion', 'funds_condition_exclusion',
    'executionMethod', 'execution_method',
    'writtenConsentRequired', 'written_consent_required',
    'extensionConditions', 'extension_conditions',
    'extensionConditionsRequired', 'extension_conditions_required',
    'outsideDateExtension', 'outside_date_extension',
    'outsideDateExtensionCondition', 'outside_date_extension_condition',
  ],
  'TERMR-M': [
    'terminationTriggers', 'curePeriod', 'partyWhoCanTerminate', 'faultBasedExclusion',
    'tickingFee', 'superiorProposalTermination', 'restraintFinality', 'restraintScope',
    'voteFailureContext', 'voteThreshold',
    'outsideDate', 'outsideDateMonths',
    'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'extensionConsentParty',
    'fundsCondition', 'funds_condition',
    'fundsConditionExcluded', 'funds_condition_excluded',
    'fundsConditionExclusion', 'funds_condition_exclusion',
    'executionMethod', 'execution_method',
    'writtenConsentRequired', 'written_consent_required',
    'extensionConditions', 'extension_conditions',
    'extensionConditionsRequired', 'extension_conditions_required',
    'outsideDateExtension', 'outside_date_extension',
    'outsideDateExtensionCondition', 'outside_date_extension_condition',
  ],
  'TERMR-B': [
    'terminationTriggers', 'curePeriod', 'partyWhoCanTerminate', 'faultBasedExclusion',
    'tickingFee', 'superiorProposalTermination', 'restraintFinality', 'restraintScope',
    'voteFailureContext', 'voteThreshold',
    'outsideDate', 'outsideDateMonths',
    'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'extensionConsentParty',
    'fundsCondition', 'funds_condition',
    'fundsConditionExcluded', 'funds_condition_excluded',
    'fundsConditionExclusion', 'funds_condition_exclusion',
    'executionMethod', 'execution_method',
    'writtenConsentRequired', 'written_consent_required',
    'extensionConditions', 'extension_conditions',
    'extensionConditionsRequired', 'extension_conditions_required',
    'outsideDateExtension', 'outside_date_extension',
    'outsideDateExtensionCondition', 'outside_date_extension_condition',
  ],
  'TERMR-T': [
    'terminationTriggers', 'curePeriod', 'partyWhoCanTerminate', 'faultBasedExclusion',
    'tickingFee', 'superiorProposalTermination', 'restraintFinality', 'restraintScope',
    'voteFailureContext', 'voteThreshold',
    'outsideDate', 'outsideDateMonths',
    'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'extensionConsentParty',
    'fundsCondition', 'funds_condition',
    'fundsConditionExcluded', 'funds_condition_excluded',
    'fundsConditionExclusion', 'funds_condition_exclusion',
    'executionMethod', 'execution_method',
    'writtenConsentRequired', 'written_consent_required',
    'extensionConditions', 'extension_conditions',
    'extensionConditionsRequired', 'extension_conditions_required',
    'outsideDateExtension', 'outside_date_extension',
    'outsideDateExtensionCondition', 'outside_date_extension_condition',
  ],
  COV: ['financingCooperation', 'cvrIncluded'],
};

// voteThreshold is only relevant on TERMR-VOTE rows — keep it visible there
// but hidden on every other TERMR row. We don't have a dedicated TERMR-VOTE
// type denylist key, so handle the inverse via getHiddenColumnsForRow.
function getHiddenColumnsForType(type) {
  return new Set(HIDDEN_TABLE_COLUMNS[type] || []);
}

/* ─── REP per-row "Specific Features" column spec ──
 *    Match a rep provision's category against the regex; render a compact
 *    <dl> of label/value pairs for the rep-specific subset that applies to
 *    that rep. Keeps the main REP table to four columns (materiality, survival,
 *    dollar, lookback) plus this single rolled-up details column.
 */
const REP_SPECIFIC_FEATURE_SPECS = [
  {
    categoryRegex: /absence\s+of\s+changes|absence\s+of\s+certain\s+changes/i,
    rows: [
      { label: 'Type', keys: ['absenceOfChangesType'] },
      { label: 'Start date', keys: ['absenceOfChangesStartDate'] },
      { label: 'Exceptions', keys: ['absenceOfChangesExceptions'] },
    ],
  },
  {
    categoryRegex: /undisclosed\s+liabilities|no\s+liabilities/i,
    rows: [
      { label: 'Exceptions', keys: ['undisclosedLiabilitiesExceptions'] },
    ],
  },
  {
    categoryRegex: /material\s+contracts/i,
    rows: [
      { label: 'Redactions permitted', keys: ['materialContractsRedactionsPermitted'] },
      { label: 'Permitted redactions', keys: ['permittedRedactionsDefinition'] },
    ],
  },
  {
    categoryRegex: /(?:top|significant|major|key)\s+customers|suppliers/i,
    rows: [
      { label: 'Definition', keys: ['topCustomersSuppliersDefinition'] },
    ],
  },
  {
    categoryRegex: /sec\s+(?:documents|filings|reports)|reports\s+and\s+financial/i,
    rows: [
      { label: 'Exception scope', keys: ['secFilingsExceptionScope'] },
      { label: 'Excluded sections', keys: ['secFilingsExcludedSections'] },
      { label: 'Carved-out reps', keys: ['secFilingsCarvedOutReps'] },
    ],
  },
];

function findRepSpec(provision) {
  const cat = String(provision?.category || '');
  for (const spec of REP_SPECIFIC_FEATURE_SPECS) {
    if (spec.categoryRegex.test(cat)) return spec;
  }
  return null;
}

function renderRepSpecificFeaturesCell(provision) {
  const spec = findRepSpec(provision);
  if (!spec) return null;
  const features = getStructuredFeatures(provision) || {};
  const rows = [];
  for (const row of spec.rows) {
    for (const key of row.keys) {
      const raw = features[key];
      if (raw === null || raw === undefined || raw === '' || raw === false) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      rows.push({ label: row.label, key, raw });
      break;
    }
  }
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-1">
      {rows.map(({ label, key, raw }) => (
        <div key={label} className="flex flex-col">
          <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{label}</dt>
          <dd className="text-[11px]">{renderFeatureCell(key, raw)}</dd>
        </div>
      ))}
    </dl>
  );
}

// Compute "N months (since YYYY-MM-DD)" from a months count + an announce date.
function computeLookbackText(months, announceDate) {
  if (months === null || months === undefined || months === '') return null;
  const m = Number(months);
  if (!Number.isFinite(m) || m <= 0) return String(months);
  const base = announceDate ? new Date(announceDate) : null;
  if (!base || isNaN(base.getTime())) return `${m} months`;
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() - m);
  const iso = d.toISOString().slice(0, 10);
  return `${m} months (since ${iso})`;
}

function formatCellValue(featureKey, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  // Citable wrapper — operate on the unwrapped value.
  if (isCitableValue(raw)) {
    raw = getCitableValue(raw);
    if (raw === null || raw === undefined || raw === '') return null;
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    // Render list of items (tagged items show their label/code; plain strings as-is)
    return raw
      .map((item) => {
        if (isTaggedItem(item)) {
          const label = resolveTaggedLabel(featureKey, item);
          return label || item.code;
        }
        return String(item);
      })
      .join('; ');
  }
  if (isTaggedItem(raw)) {
    return resolveTaggedLabel(featureKey, raw) || raw.code;
  }
  const v = formatFeatureValue(raw);
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

// Render a single feature cell value (tagged object → code+label, otherwise text).
function renderFeatureCell(featureKey, raw) {
  if (isTaggedItem(raw)) {
    const label = resolveTaggedLabel(featureKey, raw) || raw.code;
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <CodeBadge code={raw.code} />
        <span>{label}</span>
      </div>
    );
  }
  // Citable value — render the inner value normally, then the quote beneath.
  if (isCitableValue(raw)) {
    const inner = getCitableValue(raw);
    const evidence = getCitableText(raw);
    const cell = formatCellValue(featureKey, inner);
    return (
      <div className="whitespace-pre-wrap break-words">
        <span className={cell === null ? 'text-inkFaint/70 italic' : ''}>
          {cell === null ? '—' : cell}
        </span>
        <EvidenceQuote text={evidence} />
      </div>
    );
  }
  const cell = formatCellValue(featureKey, raw);
  return (
    <div className={`whitespace-pre-wrap break-words ${cell === null ? 'text-inkFaint/70 italic' : ''}`}>
      {cell === null ? '—' : cell}
    </div>
  );
}

/* ─── STRUCT table: only show a tiny set of columns per row, and only the
 *     columns that are relevant for that row's canonical concept. The rubric
 *     packs many fields into a single STRUCT type — this presentation peels
 *     them apart so each row reads as one focused statement. */
function StructTable({ provisions, onSelectProvision }) {
  // Hero pair: dealStructure + mergerForm pulled from the first STRUCT-MERGER
  // (or any STRUCT provision) that carries them. Rendered above the table.
  let heroDealStructure = null;
  let heroMergerForm = null;
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (!heroDealStructure && f.dealStructure) {
      const ds = isCitableValue(f.dealStructure) ? getCitableValue(f.dealStructure) : f.dealStructure;
      heroDealStructure = isTaggedItem(ds)
        ? (resolveTaggedLabel('dealStructure', ds) || ds.label || ds.code)
        : String(ds);
    }
    if (!heroMergerForm && f.mergerForm) {
      const mf = isCitableValue(f.mergerForm) ? getCitableValue(f.mergerForm) : f.mergerForm;
      heroMergerForm = isTaggedItem(mf)
        ? (resolveTaggedLabel('mergerForm', mf) || mf.label || mf.code)
        : String(mf);
    }
    if (heroDealStructure && heroMergerForm) break;
  }

  // For "The Merger" we just show mergerForm; for "Closing" we show
  // closingLocation + closingTiming. Everything else falls back to a generic
  // mainConcept view.
  const rows = provisions.map((p) => {
    const features = getStructuredFeatures(p) || {};
    const cat = (p.category || '').toLowerCase();
    let cells;
    if (cat.includes('merger') && !cat.includes('agreement')) {
      cells = [{ key: 'mergerForm', raw: features.mergerForm }];
    } else if (cat.includes('closing')) {
      cells = [
        { key: 'closingLocation', raw: features.closingLocation },
        { key: 'closingTiming', raw: features.closingTiming },
      ];
    } else {
      cells = [{ key: 'mainConcept', raw: features.mainConcept }];
    }
    return { p, cells };
  });

  return (
    <div className="space-y-3">
      {(heroDealStructure || heroMergerForm) && (
        <div className="bg-white border-2 border-violet-300 rounded-lg shadow-sm px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-inkFaint uppercase tracking-wider">Deal Structure</div>
            <div className="font-display text-lg text-ink font-medium">
              {heroDealStructure || <span className="italic text-inkFaint text-sm">Not specified</span>}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-inkFaint uppercase tracking-wider">Merger Form</div>
            <div className="font-display text-lg text-ink font-medium">
              {heroMergerForm || <span className="italic text-inkFaint text-sm">Not specified</span>}
            </div>
          </div>
        </div>
      )}
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <table className="min-w-full text-xs font-ui">
        <thead className="bg-bg/60 border-b border-border">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[180px]">Term</th>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ p, cells }) => (
            <tr key={p.id} className="hover:bg-bg/40 transition-colors align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onSelectProvision && onSelectProvision(p)}
                  className="text-left text-accent hover:underline font-medium"
                >
                  {p.category || 'General'}
                </button>
              </td>
              <td className="px-3 py-2 text-ink">
                {cells.length === 1 ? (
                  <div>{renderFeatureCell(cells[0].key, cells[0].raw)}</div>
                ) : (
                  <dl className="space-y-1">
                    {cells.map(({ key, raw }) => (
                      <div key={key} className="flex flex-col">
                        <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{humanizeKey(key)}</dt>
                        <dd>{renderFeatureCell(key, raw)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

/* ─── CONSID category page layout:
 *     1. Equity Award Treatment table at the TOP — one row per equity
 *        instrument (Options, RSUs, PSUs, ESPP, etc.) with columns:
 *        Instrument | Outstanding | Treatment | Vesting | Cash-Out Formula | Cutoff.
 *     2. Conversion of Shares / Exchange / Withholding / Dissent table below —
 *        only NON-equity provisions, with equity-specific columns hidden.
 *
 *     The parser's expandConsidEquityByInstrument() splits each CONSID-EQUITY
 *     provision into one row per instrument (instrumentType set per row). We
 *     also handle the pre-expansion shape (parallel outstandingInstruments +
 *     instrumentTreatments arrays) and a regex fallback against the raw text
 *     when the structured equity fields are entirely empty. */

// Equity-specific column keys: these should NEVER appear in the lower
// "Conversion of Shares" table (they only make sense for the equity table).
const CONSID_EQUITY_COLUMN_KEYS = new Set([
  'instrumentType',
  'outstandingInstruments',
  'instrumentTreatments',
  'outstandingCount',
  'vestingAcceleration',
  'cashOutAmount',
  'optionSpread',
  'performanceTreatment',
  'espp_treatment',
  'cutoffDate',
  'cutoffTreatment',
  'equityAwardTreatment',
  'doubleTrigger',
  'parachuteCap',
]);

// Heuristic regex for equity instrument names in raw text (case-c fallback).
// Order matters: PSU before RSU, RESTRICTED_STOCK before STOCK_OPTIONS, etc.
const EQUITY_TEXT_PATTERNS = [
  { code: 'PSU', label: 'PSUs', re: /Company\s+(?:Performance(?:-based)?\s+(?:Stock\s+Units?|RSUs?)|PSUs?)/i },
  { code: 'RSU', label: 'RSUs', re: /Company\s+(?:Restricted\s+Stock\s+Units?|RSUs?)/i },
  { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', re: /Company\s+Restricted\s+Stock\s+Awards?/i },
  { code: 'STOCK_OPTIONS', label: 'Stock Options', re: /Company\s+Stock\s+Options?/i },
  { code: 'ESPP', label: 'ESPP', re: /(?:Company\s+)?ESPP|Employee\s+Stock\s+Purchase\s+Plan/i },
  { code: 'SAR', label: 'SARs', re: /Stock\s+Appreciation\s+Rights?|SARs?/i },
  { code: 'WARRANT', label: 'Warrants', re: /Company\s+Warrants?/i },
];

// Detect whether a provision is an equity-award row. Prefers the
// ai_metadata.code === 'CONSID-EQUITY' marker, falls back to the category
// label since p.code is not present on rows fetched from the provisions API.
function isConsidEquityProvision(p) {
  const meta = getAiMetadata(p) || {};
  if (meta.code === 'CONSID-EQUITY') return true;
  const cat = String(p?.category || '').toLowerCase();
  if (cat.includes('equity award') || cat.includes('stock plan') || cat.includes('treatment of equity')) {
    return true;
  }
  const f = getStructuredFeatures(p) || {};
  if (isTaggedItem(f.instrumentType)) return true;
  const insts = f.outstandingInstruments;
  if (Array.isArray(insts) && insts.length > 0) return true;
  return false;
}

// Build the equity-award rows. Handles three data shapes:
//  (a) Post-expansion: one provision per instrument; f.instrumentType set.
//  (b) Pre-expansion: f.outstandingInstruments + f.instrumentTreatments arrays.
//  (c) No structured equity fields — regex-scan p.full_text for instrument names.
function buildEquityRows(equityProvisions) {
  const rows = [];
  for (const p of equityProvisions) {
    const f = getStructuredFeatures(p) || {};
    const insts = Array.isArray(f.outstandingInstruments) ? f.outstandingInstruments : [];
    const treatments = Array.isArray(f.instrumentTreatments) ? f.instrumentTreatments : [];

    // (a) instrumentType already populated (typical post-expander case).
    // Use THIS row's own treatment — prefer the singular `equityAwardTreatment`
    // when present, otherwise find a parallel treatment that matches this
    // instrument's code, otherwise (only as a last resort) treatments[0].
    // Picking treatments[0] blindly is what caused fully-accelerated rows to
    // be mis-labeled "Partially Accelerated" when the array also contained
    // a different instrument's treatment.
    if (isTaggedItem(f.instrumentType)) {
      const myCode = String(f.instrumentType.code || '').toUpperCase();
      let myTreatment = null;
      if (isTaggedItem(f.equityAwardTreatment)) {
        myTreatment = f.equityAwardTreatment;
      } else if (insts.length > 0) {
        // Try to match by instrument code in the parallel array.
        const idx = insts.findIndex(
          (inst) => isTaggedItem(inst) && String(inst.code || '').toUpperCase() === myCode,
        );
        if (idx >= 0 && idx < treatments.length) {
          myTreatment = treatments[idx];
        }
      }
      if (myTreatment === null && treatments.length === 1) {
        // Only one treatment in the array → safe to use it.
        myTreatment = treatments[0];
      }
      rows.push({
        key: `${p.id}-single`,
        provision: p,
        instrument: f.instrumentType,
        outstandingCount: f.outstandingCount ?? null,
        treatment: myTreatment,
        vesting: f.vestingAcceleration ?? null,
        cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
        cutoff: f.cutoffDate ?? null,
      });
      continue;
    }

    // (b) parallel arrays of instruments + treatments — each row picks its
    // OWN treatment by index (the parallel-array contract).
    if (insts.length > 0) {
      insts.forEach((inst, i) => {
        rows.push({
          key: `${p.id}-${i}`,
          provision: p,
          instrument: inst,
          outstandingCount: f.outstandingCount ?? null,
          treatment: treatments[i] ?? null,
          vesting: f.vestingAcceleration ?? null,
          cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
          cutoff: f.cutoffDate ?? null,
        });
      });
      continue;
    }

    // (c) no structured equity data — scan raw text for instrument names.
    const text = String(p?.full_text || '');
    const found = text ? EQUITY_TEXT_PATTERNS.filter(({ re }) => re.test(text)) : [];
    if (found.length === 0) {
      rows.push({
        key: `${p.id}-unknown`,
        provision: p,
        instrument: { code: 'UNKNOWN', label: p.category || 'Equity Award' },
        outstandingCount: null,
        treatment: null,
        vesting: f.vestingAcceleration ?? null,
        cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
        cutoff: f.cutoffDate ?? null,
      });
    } else {
      const seenCodes = new Set();
      found.forEach(({ code, label }, i) => {
        if (seenCodes.has(code)) return;
        seenCodes.add(code);
        rows.push({
          key: `${p.id}-text-${i}`,
          provision: p,
          instrument: { code, label },
          outstandingCount: null,
          treatment: null,
          vesting: f.vestingAcceleration ?? null,
          cashOut: f.cashOutAmount ?? f.optionSpread ?? null,
          cutoff: f.cutoffDate ?? null,
        });
      });
    }
  }

  // De-dupe rows sharing the same provision + instrument code + treatment code.
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    const instCode = isTaggedItem(r.instrument) ? r.instrument.code : String(r.instrument || '');
    const trCode = isTaggedItem(r.treatment) ? r.treatment.code : '';
    const sig = `${r.provision.id}::${instCode}::${trCode}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(r);
  }
  return deduped;
}

function EquityAwardTable({ rows, onSelectProvision }) {
  if (!rows || rows.length === 0) return null;
  // Render a tagged value as JUST a humanized badge (no duplicate text label).
  // The badge text is the canonical short phrase via humanizeBadgeText().
  // Falls back to plain text when not tagged.
  const renderTagged = (v) => {
    if (isTaggedItem(v)) {
      return <CodeBadge code={v.code} />;
    }
    if (v === null || v === undefined || v === '') {
      return <span className="text-inkFaint/70 italic">—</span>;
    }
    return <span className="whitespace-pre-wrap break-words">{String(v)}</span>;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-lime-50 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-lime-900 uppercase tracking-wider">
          Equity Treatment
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Instrument</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Treatment</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Vesting</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Cutoff Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const instLabel = isTaggedItem(row.instrument)
                ? (resolveTaggedLabel('instrumentType', row.instrument) || row.instrument.label || humanizeBadgeText(row.instrument.code))
                : String(row.instrument || 'Instrument');
              return (
                <tr key={row.key} className="hover:bg-bg/40 transition-colors">
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectProvision && onSelectProvision(row.provision)}
                      className="text-left text-accent hover:underline font-medium"
                    >
                      {instLabel}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top text-ink max-w-[320px]">
                    {renderTagged(row.treatment)}
                  </td>
                  <td className="px-3 py-2 align-top text-ink max-w-[240px]">
                    {renderTagged(row.vesting)}
                  </td>
                  <td className="px-3 py-2 align-top text-ink whitespace-nowrap">
                    {row.cutoff ?? <span className="text-inkFaint/70 italic">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Detect the CONSID "Conversion of Shares / Effect on Capital Stock" provision
// — this is the row that carries the merger consideration paid out for the
// company's common stock. We synthesize a "Common Stock" row at the top of
// the Equity Treatment table from it so users always see the per-share amount.
function isConsidConvertProvision(p) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  if (meta.code === 'CONSID-CONVERT') return true;
  const cat = String(p?.category || '').toLowerCase();
  if (cat) {
    if (cat.includes('conversion of shares')) return true;
    if (cat.includes('effect on capital stock')) return true;
    if (cat.includes('merger consideration')) return true;
    if (cat.includes('treatment of capital stock')) return true;
  }
  return false;
}

// Build a synthetic Common Stock row from the CONSID-CONVERT provision. We
// use the per-share amount / merger consideration directly (no instrument
// treatment formula needed — Common Stock simply receives the headline price).
function buildCommonStockRow(convertProv) {
  if (!convertProv) return null;
  const f = getStructuredFeatures(convertProv) || {};
  const per = f.perShareAmount;
  const ct = f.considerationType;
  // Compose a human-readable treatment string from per-share + consid type.
  let treatmentText = null;
  if (per && ct) {
    const ctLabel = isTaggedItem(ct)
      ? (resolveTaggedLabel('considerationType', ct) || ct.label || ct.code)
      : String(ct);
    treatmentText = `Converted into ${per}${ctLabel ? ` (${ctLabel})` : ''}`;
  } else if (per) {
    treatmentText = `Converted into ${per} per share`;
  } else if (ct) {
    const ctLabel = isTaggedItem(ct)
      ? (resolveTaggedLabel('considerationType', ct) || ct.label || ct.code)
      : String(ct);
    treatmentText = `Converted into ${ctLabel}`;
  } else {
    treatmentText = 'Converted into the Merger Consideration';
  }
  return {
    key: `${convertProv.id}-common-stock`,
    provision: convertProv,
    instrument: { code: 'COMMON_STOCK', label: 'Common Stock' },
    outstandingCount: null,
    treatment: treatmentText,
    vesting: null,
    cashOut: null,
    cutoff: null,
  };
}

function ConsidTable({ provisions, onSelectProvision }) {
  // Partition: equity-award provisions vs. everything else.
  const equityProvisions = provisions.filter(isConsidEquityProvision);
  const otherProvisions = provisions.filter((p) => !isConsidEquityProvision(p));

  const equityRows = buildEquityRows(equityProvisions);

  // Find the CONSID-CONVERT provision (carries the headline per-share amount).
  let convertProv = provisions.find(isConsidConvertProvision);
  if (!convertProv) {
    convertProv = otherProvisions.find((p) => {
      const f = getStructuredFeatures(p) || {};
      return f.perShareAmount || f.considerationType;
    }) || otherProvisions[0] || null;
  }
  const commonStockRow = buildCommonStockRow(convertProv);
  if (commonStockRow) {
    const alreadyHasCommonStock = equityRows.some((r) =>
      isTaggedItem(r.instrument) && r.instrument.code === 'COMMON_STOCK'
    );
    if (!alreadyHasCommonStock) {
      equityRows.unshift(commonStockRow);
    }
  }

  // Build the headline price + consideration-type hero block. Scan all
  // provisions for the first non-empty perShareAmount + considerationType.
  let heroPerShare = null;
  let heroConsidType = null;
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (!heroPerShare && f.perShareAmount) heroPerShare = String(f.perShareAmount);
    if (!heroConsidType && f.considerationType) {
      heroConsidType = isTaggedItem(f.considerationType)
        ? (resolveTaggedLabel('considerationType', f.considerationType) || f.considerationType.label || f.considerationType.code)
        : String(f.considerationType);
    }
    if (heroPerShare && heroConsidType) break;
  }

  // Detect CVR presence — used to rewrite the displayed consideration type
  // as "Cash and a CVR" when the deal pays a mix of cash + CVR. We look at
  // the consideration type code/label, any provision flagged as CVR, and
  // the raw text as a final fallback. Be defensive: only override the label
  // when we have strong evidence of CVR + cash.
  const detectCvr = () => {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const ct = f.considerationType;
      if (isTaggedItem(ct)) {
        const codeStr = String(ct.code || '').toLowerCase();
        const lblStr = String(ct.label || '').toLowerCase();
        if (codeStr.includes('cvr') || lblStr.includes('cvr') || lblStr.includes('contingent value')) return true;
      } else if (typeof ct === 'string' && /cvr|contingent\s+value/i.test(ct)) {
        return true;
      }
      if (f.cvrIncluded === true) return true;
      const meta = getAiMetadata(p) || {};
      const code = String(meta.code || p.code || '').toUpperCase();
      if (code.includes('CVR')) return true;
      const cat = String(p?.category || '').toLowerCase();
      if (cat.includes('cvr') || cat.includes('contingent value right')) return true;
    }
    return false;
  };
  const detectCash = () => {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const ct = f.considerationType;
      if (isTaggedItem(ct)) {
        const codeStr = String(ct.code || '').toLowerCase();
        const lblStr = String(ct.label || '').toLowerCase();
        if (codeStr.includes('cash') || lblStr.includes('cash')) return true;
      } else if (typeof ct === 'string' && /cash/i.test(ct)) {
        return true;
      }
    }
    return false;
  };
  const hasCvr = detectCvr();
  const hasCash = hasCvr ? detectCash() : false;
  if (hasCvr && hasCash) {
    heroConsidType = 'Cash and a CVR';
  }

  // Find appraisalRightsAvailable across all CONSID provisions (first non-null).
  let appraisalAvailable = null;
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    const raw = f.appraisalRightsAvailable;
    if (raw === null || raw === undefined) continue;
    // Unwrap citable { value, text } shape if present.
    const unwrapped = isCitableValue(raw) ? raw.value : raw;
    if (unwrapped === null || unwrapped === undefined) continue;
    appraisalAvailable = unwrapped;
    break;
  }

  // Exchange Ratio — only render when considerationType references stock.
  // Pulls exchangeRatio + exchangeRatioType from any CONSID provision (incl.
  // CONSID-EXCHANGE-RATIO sub-code which carries ratioType + value).
  const considTypeStr = String(heroConsidType || '').toLowerCase();
  const showExchangeRatio = considTypeStr.includes('stock') || considTypeStr.includes('mixed');
  let exchangeRatioValue = null;
  let exchangeRatioType = null;
  if (showExchangeRatio) {
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const v = isCitableValue(f.exchangeRatio) ? getCitableValue(f.exchangeRatio) : f.exchangeRatio;
      if (!exchangeRatioValue && v) exchangeRatioValue = String(v);
      const v2raw = f.exchangeRatioType ?? f.ratioType;
      const v2 = isCitableValue(v2raw) ? getCitableValue(v2raw) : v2raw;
      if (!exchangeRatioType && v2) {
        exchangeRatioType = isTaggedItem(v2)
          ? (resolveTaggedLabel('exchangeRatioType', v2) || v2.label || v2.code)
          : String(v2);
      }
      // Sub-code CONSID-EXCHANGE-RATIO carries the canonical `value` + `ratioType`.
      if (!exchangeRatioValue && f.value) exchangeRatioValue = String(f.value);
      if (exchangeRatioValue && exchangeRatioType) break;
    }
  }

  // Format per-share for display ("47.50" -> "$47.50", "$47.50" -> "$47.50").
  const formatPerShare = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.startsWith('$')) return s;
    if (/^[\d,.]+$/.test(s)) return `$${s}`;
    return s;
  };
  const heroPriceText = formatPerShare(heroPerShare);

  const renderAppraisalValue = (v) => {
    if (v && typeof v === 'object') {
      // Tagged item { code, label, text } or citable { value, text } —
      // resolve to the inner human label / value.
      if ('label' in v) return v.label;
      if ('value' in v) return renderAppraisalValue(v.value);
      if ('text' in v) return v.text;
    }
    if (v === true || v === 'yes' || v === 'true') return 'Yes';
    if (v === false || v === 'no' || v === 'false') return 'No';
    return String(v);
  };

  return (
    <div className="space-y-3">
      {/* Hero block: headline price + consideration type + appraisal rights. */}
      {(heroPriceText || heroConsidType || appraisalAvailable !== null) && (
        <div className="bg-white border-2 border-lime-300 rounded-lg shadow-sm px-5 py-4">
          {heroPriceText && (
            <div
              className="font-display font-semibold text-ink leading-tight"
              style={{ fontSize: '30px' }}
            >
              {heroPriceText}
              <span className="text-sm font-ui font-normal text-inkMid ml-2">per share</span>
            </div>
          )}
          {heroConsidType && (
            <div className="mt-1 text-xs font-ui font-medium text-lime-900 uppercase tracking-wider">
              {heroConsidType}
            </div>
          )}
          {showExchangeRatio && (exchangeRatioValue || exchangeRatioType) && (
            <div className="mt-2 pt-2 border-t border-lime-200 text-xs font-ui text-inkMid">
              <span className="font-medium text-inkFaint uppercase tracking-wider mr-2">
                Exchange Ratio:
              </span>
              <span className="text-ink font-medium">
                {exchangeRatioValue || '—'}
                {exchangeRatioType ? ` (${exchangeRatioType})` : ''}
              </span>
            </div>
          )}
          {appraisalAvailable !== null && (
            <div className="mt-2 pt-2 border-t border-lime-200 text-xs font-ui text-inkMid">
              <span className="font-medium text-inkFaint uppercase tracking-wider mr-2">
                Appraisal Rights Available:
              </span>
              <span className="text-ink font-medium">
                {renderAppraisalValue(appraisalAvailable)}
              </span>
            </div>
          )}
        </div>
      )}

      {equityRows.length > 0 && (
        <EquityAwardTable rows={equityRows} onSelectProvision={onSelectProvision} />
      )}

      {/* Other CONSID provisions — list as clickable links, NOT a detail table. */}
      {otherProvisions.length > 0 && (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-bg/60 border-b border-border">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
              Other Consideration Provisions
            </p>
          </div>
          <ul className="divide-y divide-border">
            {otherProvisions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectProvision && onSelectProvision(p)}
                  className="w-full text-left px-4 py-2 hover:bg-bg/40 transition-colors flex items-center gap-2"
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: typeHex(p.type),
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-sm text-accent font-medium hover:underline">
                    {p.category || 'General'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STRUCTURED SUMMARY VIEW — used for multi-code types (NOSOL,
   ANTI) where each provision is its own concept and the
   row-based table format leaves most cells empty. Renders each
   provision as a card with label/value rows for the same
   features the table would show, plus a collapsible text body.
   ═══════════════════════════════════════════════════════════ */
function StructuredSummaryCard({ provision, type, onSelectProvision }) {
  const [showText, setShowText] = useState(false);
  const features = getStructuredFeatures(provision) || {};
  // Honor the same column list the table would use (FEATURE_DISPLAY_ORDER +
  // hidden-column denylist), so the summary and the table show the same set.
  const explicit = FEATURE_DISPLAY_ORDER[type];
  let keys = Array.isArray(explicit) && explicit.length > 0
    ? explicit.slice()
    : Object.keys(features);
  const hidden = getHiddenColumnsForType(type);
  if (hidden.size > 0) keys = keys.filter((k) => !hidden.has(k));

  // Build rows, skipping empty values for a clean summary.
  const rows = [];
  for (const k of keys) {
    const raw = features[k];
    if (raw === null || raw === undefined || raw === '') continue;
    if (Array.isArray(raw) && raw.length === 0) continue;
    if (raw === false) continue;
    rows.push({ key: k, raw });
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg/40 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectProvision && onSelectProvision(provision)}
          className="text-left font-display text-base text-accent hover:underline font-medium"
        >
          {provision.category || 'General'}
        </button>
        {provision.code && (
          <span className="shrink-0">
            <CodeBadge code={provision.code} />
          </span>
        )}
      </div>
      {rows.length > 0 ? (
        <dl className="px-4 py-3 space-y-2">
          {rows.map(({ key, raw }) => {
            // Tagged single value → humanized badge
            if (isTaggedItem(raw)) {
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="text-sm text-ink">
                    <CodeBadge code={raw.code} />
                  </dd>
                </div>
              );
            }
            // List value → bulleted list (humanized badges for tagged items)
            if (Array.isArray(raw)) {
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="text-sm text-ink flex-1">
                    <ul className="list-disc list-inside space-y-0.5">
                      {raw.map((item, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {isTaggedItem(item) ? (
                            <CodeBadge code={item.code} />
                          ) : (
                            <span>{String(item)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              );
            }
            // Scalar value
            const val = formatFeatureValue(raw);
            if (val === null || val === undefined || val === '') return null;
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                  {humanizeKey(key)}
                </dt>
                <dd className="text-sm text-ink whitespace-pre-wrap break-words flex-1">
                  {Array.isArray(val) ? val.join('; ') : String(val)}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <div className="px-4 py-3 text-xs font-ui text-inkFaint italic">
          No structured features extracted for this provision.
        </div>
      )}
      <div className="border-t border-border px-4 py-2 bg-bg/20">
        <button
          type="button"
          onClick={() => setShowText((s) => !s)}
          className="text-[11px] font-ui text-accent hover:text-accent/80"
        >
          {showText ? '− Hide Text' : '+ Show Text'}
        </button>
        {showText && provision.full_text && (
          <div className="mt-2 text-xs font-body text-inkMid whitespace-pre-wrap leading-relaxed">
            {provision.full_text}
          </div>
        )}
      </div>
    </div>
  );
}

function StructuredSummaryView({ provisions, type, onSelectProvision }) {
  return (
    <div className="space-y-3">
      {provisions.map((p) => (
        <StructuredSummaryCard
          key={p.id}
          provision={p}
          type={type}
          onSelectProvision={onSelectProvision}
        />
      ))}
    </div>
  );
}

/* ── Per-category aggregated 2-column summary table for NOSOL and ANTI.
 *    Scans every provision in the category and picks the FIRST non-empty
 *    value for each canonical feature in CATEGORY_SUMMARY_FEATURES. Below
 *    the table, lists the underlying provisions as small clickable links. */
// ── Stage 2: per-sub-code mini-table specs ──
// Mirrors the CATEGORY_SUMMARY_FEATURES shape but keyed by canonical code
// (e.g. 'CONSID-CVR'). Each sub-code ships with a 3-row spec ready to drop
// into the existing CategoryFeatureSummaryTable render path.
const SUBCODE_SUMMARY_FEATURES = {
  'CONSID-CVR': [
    { label: 'Triggers',     keys: ['triggers'] },
    { label: 'Milestones',   keys: ['milestones'] },
    { label: 'Max Payment',  keys: ['maxPayment'] },
    { label: 'Term',         keys: ['term'] },
    { label: 'Transferable', keys: ['transferable'] },
  ],
  'CONSID-COLLAR': [
    { label: 'Collar Type',  keys: ['collarType'] },
    { label: 'Upper Bound',  keys: ['upperBound'] },
    { label: 'Lower Bound',  keys: ['lowerBound'] },
    { label: 'Language',     keys: ['language'] },
  ],
  'CONSID-TICKING': [
    { label: 'Rate',         keys: ['rate'] },
    { label: 'Start Date',   keys: ['startDate'] },
    { label: 'Formula',      keys: ['escalationFormula'] },
  ],
  'CONSID-EXCHANGE-RATIO': [
    { label: 'Ratio Type',   keys: ['ratioType'] },
    { label: 'Value',        keys: ['value'] },
  ],
  'CONSID-WALKAWAY': [
    { label: 'Holder',       keys: ['holder', 'marketOutHolder'] },
    { label: 'Threshold',    keys: ['threshold'] },
  ],
  'COV-APPRAISAL': [
    { label: 'Parent Info Rights',                 keys: ['parentInfoRights'] },
    { label: 'Parent Participation / Control',     keys: ['parentParticipationOrControl'] },
    { label: 'Settlement Consent',                 keys: ['settlementConsent'] },
    { label: 'Payment Consent',                    keys: ['paymentConsent'] },
  ],
  'COV-PAYAGENT': [
    { label: 'Company Consent Required',           keys: ['companyConsent'] },
    { label: 'Transfer-Agent Exception',           keys: ['transferAgentException'] },
    { label: 'Other Agent Formulation',            keys: ['otherAgentFormulation'] },
  ],
  'COV-MARKETING': [
    { label: 'Period (Business Days)',             keys: ['periodBusinessDays'] },
    { label: 'Commencement Trigger',               keys: ['commencement'] },
  ],
  'COV-PROXY': [
    { label: 'Proxy Filing Deadline',              keys: ['proxyFilingDeadline'] },
    { label: 'Special Meeting Deadline',           keys: ['specialMeetingDeadline'] },
    { label: 'Meeting Delay Permitted',            keys: ['meetingDelayPermitted'] },
    { label: 'Meeting Delay Conditions',           keys: ['meetingDelayConditions'] },
  ],
  'COV-DO': [
    { label: 'Insurance Cap',                      keys: ['insuranceCap'] },
    { label: 'Advancement of Expenses',            keys: ['advancementOfExpenses'] },
    { label: 'Notification Consequences',          keys: ['notificationConsequences'] },
    { label: 'Additional Terms',                   keys: ['additionalTerms'] },
  ],
  'TERMF-RTF-ANTI': [
    { label: 'Triggers',                           keys: ['triggers'] },
    { label: 'Amount',                             keys: ['amount'] },
    { label: 'Sole Remedy',                        keys: ['soleRemedy'] },
    { label: 'Exceptions',                         keys: ['exceptions'] },
    { label: 'Specific Performance Barred',        keys: ['specificPerformanceBar'] },
  ],
  'TERMF-REIMBURSE': [
    { label: 'Triggers',                           keys: ['triggers'] },
    { label: 'Cap',                                keys: ['cap'] },
  ],
  'REP-B-FUNDS': [
    { label: 'Scope',                              keys: ['scope'] },
    { label: 'Covers Merger Consideration',        keys: ['coversMergerConsideration'] },
    { label: 'Covers Reverse Termination Fee',     keys: ['coversReverseTermFee'] },
    { label: 'Covers Expenses',                    keys: ['coversExpenses'] },
  ],
  'REP-B-SOLVENCY': [
    { label: 'Language',                           keys: ['language', 'solvencyRepDetails'] },
  ],
  'REP-B-ANTIRELIANCE': [
    { label: 'Language',                           keys: ['language', 'antiRelianceRepText'] },
  ],
  'REP-T-SUFFICIENCY': [
    { label: 'Language',                           keys: ['language'] },
  ],
  'REP-T-TOP-CUSTOMERS': [
    { label: 'Definition',                         keys: ['definition', 'topCustomersSuppliersDefinition'] },
    { label: 'Coverage',                           keys: ['coverage'] },
  ],
  'REP-T-MATERIAL-CONTRACTS': [
    { label: 'Buckets',                            keys: ['materialContractsBuckets'] },
    { label: 'Per-Bucket Dollar Thresholds',       keys: ['materialContractsDollarThresholds'] },
    { label: 'Redactions Permitted',               keys: ['materialContractsRedactionsPermitted'] },
    { label: 'Permitted Redactions',               keys: ['permittedRedactionsDefinition'] },
  ],
};

// ─── MAE carveout codes (kept in sync with lib/taxonomy.js MAE_CARVEOUT_META).
// Used by the MAE summary rows to look up a carveout by code inside any
// `features.carveouts` list (DEF or REP-T provision) and render Present /
// Not present uniformly.
const MAE_CARVEOUT_LABELS = {
  ECONOMY_GENERAL: 'General economic conditions',
  INDUSTRY_GENERAL: 'Industry-wide conditions',
  FINANCIAL_MARKETS: 'Financial / capital / credit market conditions',
  ACTS_OF_WAR_TERRORISM: 'Acts of war, armed hostilities, or terrorism',
  NATURAL_DISASTERS: 'Natural disasters or acts of God',
  PANDEMIC: 'Pandemic / epidemic / public health crisis',
  ANNOUNCEMENT_OR_PENDENCY: 'Announcement or pendency of the transaction',
  COMPLIANCE_WITH_AGREEMENT: 'Compliance with the terms of this Agreement',
  ACTIONS_REQUESTED_BY_PARENT: 'Actions taken at the request or with consent of Parent',
  CHANGE_IN_LAW: 'Changes in applicable law or regulation',
  CHANGE_IN_GAAP: 'Changes in GAAP or accounting principles',
  STOCK_PRICE_CHANGES: 'Changes in trading price or volume of stock',
  FAILURE_TO_MEET_PROJECTIONS: 'Failure to meet internal projections or forecasts',
  PRICING_MFN: 'Most-favored-nation pricing actions',
  EXECUTIVE_ACTION: 'Executive orders / sanctions / tariffs',
  TARIFFS: 'Tariffs / trade barriers',
  GOVERNMENT_SHUTDOWNS: 'Government shutdowns / civil unrest',
  CLINICAL_RESULTS: 'Clinical trial results (life sciences)',
  FDA_DISCUSSIONS: 'FDA discussions or correspondence (life sciences)',
  FDA_APPROVALS_COMPETITOR_ENTRY: 'FDA approvals of competitor products / competitor entry',
  SUPPLY_CHAIN: 'Supply chain disruptions',
  PRICING_REIMBURSEMENT: 'Pricing / reimbursement changes (healthcare)',
  MEDICAL_ORGS_STATEMENTS: 'Statements by medical / scientific organizations',
  PATENTS_EXCLUSIVITY: 'Patent expirations / loss of exclusivity',
  PARENT_ACTIONS_OR_INACTION: 'Acts or omissions of Parent / Buyer',
  EMPLOYEE_DEPARTURES: 'Loss of employees or executive departures',
  OTHER: 'Other carve-out',
};

// Scan a provision list's `carveouts` (and `disproportionateImpactCarveouts` /
// `nonDisproportionateImpactCarveouts` if present) for an entry with the given
// code. Returns the first matching tagged item, or null if none.
function findCarveoutByCode(provisions, code) {
  if (!provisions || provisions.length === 0) return null;
  const codeUpper = String(code).toUpperCase();
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    const lists = [
      f.carveouts,
      f.carveOuts,
      f.carveOutsList,
      f.disproportionateImpactCarveouts,
      f.nonDisproportionateImpactCarveouts,
    ];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (isTaggedItem(item) && String(item.code).toUpperCase() === codeUpper) {
          return { value: { code: item.code, label: item.label || MAE_CARVEOUT_LABELS[codeUpper] || item.code, text: item.text }, key: 'carveouts', provision: p };
        }
        // Tolerate string-only entries that look like the code label.
        if (typeof item === 'string') {
          const lbl = MAE_CARVEOUT_LABELS[codeUpper];
          if (lbl && item.toLowerCase().includes(lbl.split('/')[0].trim().toLowerCase().slice(0, 12))) {
            return { value: { code: codeUpper, label: lbl, text: item }, key: 'carveouts', provision: p };
          }
        }
      }
    }
  }
  return null;
}

const CATEGORY_SUMMARY_FEATURES = {
  // ─── NOSOL — Paul Weiss diligence checklist q120–q140 ───────────────────
  NOSOL: [
    // Preserve the existing 7 fiduciary-out / notice / matching rows at the top.
    { label: 'Fiduciary Out — Engagement Standard', keys: ['fiduciaryEngageStandard', 'fiduciaryOutStandard'] },
    { label: 'Fiduciary Out — Final Determination',  keys: ['fiduciaryFinalStandard', 'fiduciaryOutStandard'] },
    { label: 'Notice Period',                         keys: ['noticePeriod'] },
    { label: 'Notice Content',                        keys: ['noticeContent'] },
    { label: 'Matching Period',                       keys: ['matchingPeriod', 'initialMatchPeriodDays'] },
    { label: 'Intervening Event Termination',         keys: ['interveningEventTermination', 'interveningEventProvision'] },
    { label: 'Force the Vote',                        keys: ['forceTheVote', 'forceTheVoteDetails'] },
    // Go-shop
    { label: 'Go-Shop Present',                       keys: ['goShopPresent'] },
    { label: 'Go-Shop Period (days)',                 keys: ['goShopPeriodDays', 'goShopWindow'] },
    { label: 'Go-Shop Excluded Parties',              keys: ['goShopExcludedParties'] },
    { label: 'Extended Negotiating Period (days)',    keys: ['extendedNegotiatingPeriodDays'] },
    // Waivers
    { label: 'Standstill Waiver Permitted',           keys: ['standstillWaiverPermitted', 'standstillWaiver'] },
    { label: 'Anti-Clubbing Waiver Permitted',        keys: ['antiClubbingWaiverPermitted'] },
    // Info required for alternative proposals
    { label: 'Info Required — Bidder Identity',       keys: ['infoRequiredBidderIdentity'] },
    { label: 'Info Required — Communications & Drafts', keys: ['infoRequiredCommunicationsDrafts'] },
    { label: 'Info Required — Financing Papers',      keys: ['infoRequiredFinancingPapers'] },
    // Definitions
    { label: 'Acceptable Confidentiality Agreement Definition', keys: ['acceptableConfidentialityAgreementDefinition'] },
    { label: 'Acquisition Transaction Definition',    keys: ['acquisitionTransactionDefinition'] },
    { label: 'Acquisition Transaction % Threshold',   keys: ['acquisitionTransactionPctThreshold'] },
    // Board change / superior-proposal / company termination
    { label: 'Board Change for Intervening Event',    keys: ['boardChangeForInterveningEvent'] },
    { label: 'Intervening Event Definition',          keys: ['interveningEventDefinition'] },
    { label: 'Board Change for Superior Proposal',    keys: ['boardChangeForSuperiorProposal'] },
    { label: 'Board Change Standard',                 keys: ['boardChangeStandard'] },
    { label: 'Company Termination for Superior Proposal', keys: ['companyTerminationForSuperior'] },
    { label: 'Company Termination Conditions',        keys: ['companyTerminationForSuperiorConditions'] },
    // Representative breach + match periods + parent termination
    { label: 'Representative Breach Deemed Company Breach', keys: ['representativeBreachIsCompanyBreach'] },
    { label: 'Representatives Standard',              keys: ['representativesStandard'] },
    { label: 'Initial Match Period (business days)',  keys: ['initialMatchPeriodDays', 'matchingPeriod'] },
    { label: 'Subsequent Match Period (business days)', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'] },
    { label: 'Parent Termination Right for Nonsolicit Breach', keys: ['parentTerminationRightForNonsolicitBreach'] },
  ],

  // ─── ANTI — Paul Weiss diligence checklist q68–q91 + q82–q83 ────────────
  ANTI: [
    // Preserve existing Standard of Efforts + Burden Cap headline rows.
    { label: 'Standard of Efforts',                   keys: ['effortsStandard'] },
    { label: 'Burden Cap',                            keys: ['burdenCap', 'divestitureCap', 'divestitureCapDescription'] },
    // Strategy / filings
    { label: 'Regulatory Strategy Control',           keys: ['regulatoryStrategyControl', 'controllingParty'] },
    { label: 'HSR Filing Deadline (business days)',   keys: ['hsrFilingDeadlineBusinessDays'] },
    { label: 'Other Regulatory Filing Deadlines',     keys: ['otherRegulatoryFilingDeadlines', 'filingDeadline'] },
    { label: 'Substantial Compliance Deadline (days)', keys: ['substantialComplianceDeadlineDays'] },
    // Pull-and-refile + timing agreements
    { label: 'Pull-and-Refile — Company Consent Required', keys: ['pullAndRefileCompanyConsent'] },
    { label: 'Refile Cap Without Company Consent',    keys: ['refileCapWithoutConsent'] },
    { label: 'Timing Agreements Prohibited',          keys: ['timingAgreementsProhibited'] },
    // Clear-skies
    { label: 'Clear-Skies — Company',                 keys: ['clearSkiesCompany'] },
    { label: 'Clear-Skies — Company Scope',           keys: ['clearSkiesCompanyScope'] },
    { label: 'Clear-Skies — Parent',                  keys: ['clearSkiesParent'] },
    { label: 'Clear-Skies — Parent Scope',            keys: ['clearSkiesParentScope'] },
    // Remedy + litigation obligations
    { label: 'Parent Remedy Obligation',              keys: ['parentRemedyObligation'] },
    { label: 'Efforts Standard Differs by Remedy',    keys: ['effortsStandardDiffersByRemedy'] },
    { label: 'Parent Litigation Obligation',          keys: ['parentLitigationObligation', 'litigationObligation'] },
    // Burdensome condition rows (q82–q83)
    { label: 'Burdensome Condition Present (Closing Condition)', keys: ['burdensomeConditionPresent', 'burdensomConditionDefined'] },
    { label: 'Burdensome Condition Scope',            keys: ['burdensomeConditionScope'] },
    { label: 'Burdensome Condition in Termination Triggers', keys: ['burdensomeConditionInTerminationTriggers'] },
    // Law/orders termination right (mirrored from TERMR)
    { label: 'Law/Orders Termination Right Present',  keys: ['lawOrderTerminationPresent'] },
    { label: 'Law/Orders Termination Scope',          keys: ['lawOrderTerminationScope'] },
    { label: 'Final and Nonappealable Required',      keys: ['finalAndNonappealableRequired'] },
    { label: 'Terminating Party Breach Carveout',     keys: ['terminationCarveoutForOwnBreach'] },
    // Cooperation / filings
    { label: 'Regulatory Closing Conditions / Required Filings', keys: ['foreignFilingsRequired', 'regulatoryClosingConditions'] },
    { label: 'Springing Regulatory Conditions',       keys: ['springingRegulatoryConditions'] },
    { label: 'Regulatory Info / Cooperation Covenant Scope', keys: ['regulatoryCooperationScope', 'controllingParty'] },
    { label: 'Regulatory Cooperation Covenant Carveout', keys: ['regulatoryCooperationCarveout'] },
  ],

  // ─── TERMR — Paul Weiss diligence checklist q83–q99 ─────────────────────
  TERMR: [
    { label: 'Outside Date',                          keys: ['outsideDate'] },
    { label: 'Outside Date (months)',                 keys: ['outsideDateMonths'] },
    { label: 'Extension Structure Present',           keys: ['outsideDateExtension', 'extensionAvailable'] },
    { label: 'Extension Party',                       keys: ['extensionParty', 'extensionConsentParty'] },
    { label: 'Extension Mutual or Unilateral',        keys: ['extensionMutualOrUnilateral'] },
    { label: 'Extension Period',                      keys: ['extensionPeriod'] },
    { label: 'Extension Max Exercises',               keys: ['extensionMaxExercises'] },
    { label: 'Extension Trigger',                     keys: ['extensionTrigger', 'extensionConditions', 'outsideDateExtensionConditions'] },
    { label: 'Closing Deadline After Conditions Satisfied (days)', keys: ['mutualClosingDeadlineAfterConditionsDays'] },
    { label: 'Closing Timing Provisions',             keys: ['closingTimingProvisions', 'closingTiming'] },
    { label: 'Government Proceeding Closing Condition Present', keys: ['governmentProceedingConditionPresent'] },
    { label: 'Absence of Enjoining Law/Order Condition Present', keys: ['absenceOfEnjoiningOrderPresent'] },
    { label: 'Absence-of-Enjoining-Order Details',    keys: ['absenceOfEnjoiningOrderDetails'] },
    { label: 'Law/Orders Termination Right Present',  keys: ['lawOrderTerminationPresent'] },
    { label: 'Law/Orders Termination Scope',          keys: ['lawOrderTerminationScope'] },
    { label: 'Final and Nonappealable Required',      keys: ['finalAndNonappealableRequired', 'restraintFinality'] },
    { label: 'Termination Carveout for Own Breach',   keys: ['terminationCarveoutForOwnBreach', 'faultBasedExclusion'] },
    { label: 'Lost Premium Damages Pursuit',          keys: ['lostPremiumDamagesPursuit'] },
    { label: 'Lost Premium Damages Conditions',       keys: ['lostPremiumDamagesConditions'] },
    { label: 'Market-Out / Walkaway Holder',          keys: ['marketOutHolder', 'holder'] },
    { label: 'Party Who Can Terminate',               keys: ['partyWhoCanTerminate'] },
    { label: 'Termination Triggers',                  keys: ['terminationTriggers', 'triggerEvents'] },
    { label: 'Cure Period',                           keys: ['curePeriod', 'cureDays'] },
    { label: 'Tender Offer Minimum Condition',        keys: ['tenderOfferMinimumCondition'] },
    { label: 'Vote Threshold',                        keys: ['voteThreshold'] },
  ],

  // ─── TERMF — Paul Weiss diligence checklist q141–q152 + q198–q200 ──────
  TERMF: [
    { label: 'Company Termination Fee Amount',        keys: ['feeAmount', 'companyTerminationFee'] },
    { label: 'Fee % of Equity Value',                 keys: ['terminationFeePercentEquityValue', 'feePercentage'] },
    { label: 'Fee Trigger Events',                    keys: ['triggerEvents'] },
    { label: 'Fee / Reimbursement on Naked No-Vote',  keys: ['nakedNoVoteFeePresent', 'nakedNoVoteFee'] },
    { label: 'Naked No-Vote Fee Amount',              keys: ['nakedNoVoteFeeAmount'] },
    { label: 'Tail Fee — End-Date Trigger',           keys: ['tailFeeTriggerEndDate'] },
    { label: 'Tail Fee — Naked No-Vote Trigger',      keys: ['tailFeeTriggerNakedNoVote'] },
    { label: 'Tail Fee — Alt Announced During Pendency', keys: ['tailFeeTriggerAltAnnouncedDuringPendency'] },
    { label: 'Tail Fee — Consummated During Tail',    keys: ['tailFeeTriggerConsummatedDuringTail'] },
    { label: 'Tail Period (months)',                  keys: ['tailPeriod'] },
    { label: 'Termination Fee Sole Remedy',           keys: ['feeSoleAndExclusiveRemedy', 'soleRemedy', 'soleAndExclusiveRemedy'] },
    { label: 'Exceptions to Sole Remedy',             keys: ['feeSoleRemedyExceptions', 'willfulBreachException'] },
    { label: 'Remedy Bar After Termination Fee',      keys: ['remedyBarAfterFee'] },
    { label: 'Antitrust RTF Present',                 keys: ['reverseFeeAmount', 'reverseTerminationFee'] },
    { label: 'Antitrust RTF Triggers',                keys: ['triggers'] },
    { label: 'Antitrust RTF Amount',                  keys: ['reverseFeeAmount', 'amount'] },
    { label: 'Antitrust RTF Sole Remedy',             keys: ['soleRemedy'] },
    { label: 'Antitrust RTF Exceptions',              keys: ['exceptions'] },
    { label: 'Acquirer Expense Reimbursement Obligation', keys: ['expenseReimbursement'] },
    { label: 'Acquirer Expense Reimbursement Triggers', keys: ['triggers'] },
    { label: 'Acquirer Expense Reimbursement Cap',    keys: ['expenseReimbursementCap', 'cap'] },
  ],

  // ─── MAE — Paul Weiss diligence checklist q20–q37 ───────────────────────
  // Rows are scanned across the supplied provisions (typically the REP-T or
  // DEF "Material Adverse Effect" definition). Carveout rows resolve via
  // findCarveoutByCode against features.carveouts (taxonomy MAE_CARVEOUT_CODES).
  MAE: [
    { label: 'Disproportionate Impact Carveouts',     keys: ['disproportionateImpactCarveouts'] },
    { label: 'Non-Disproportionate Impact Carveouts', keys: ['nonDisproportionateImpactCarveouts'] },
    { label: 'Prevent / Delay Prong Present',         keys: ['preventDelayProng'] },
    { label: 'Reps Including Prevent / Delay Prong',  keys: ['preventDelayRepsCovered'] },
    { label: 'All Carveouts (canonical list)',        keys: ['carveouts', 'carveOuts', 'carveOutsList'] },
    { label: 'Pricing MFNs Carveout',                 keys: [], maeCode: 'PRICING_MFN' },
    { label: 'Executive Action Carveout',             keys: [], maeCode: 'EXECUTIVE_ACTION' },
    { label: 'Tariffs Carveout',                      keys: [], maeCode: 'TARIFFS' },
    { label: 'Government Shutdowns Carveout',         keys: [], maeCode: 'GOVERNMENT_SHUTDOWNS' },
    { label: 'Clinical Results Carveout',             keys: [], maeCode: 'CLINICAL_RESULTS' },
    { label: 'FDA Discussions Carveout',              keys: [], maeCode: 'FDA_DISCUSSIONS' },
    { label: 'FDA Approvals / Competitor Entry Carveout', keys: [], maeCode: 'FDA_APPROVALS_COMPETITOR_ENTRY' },
    { label: 'Supply Chain / Manufacturing Carveout', keys: [], maeCode: 'SUPPLY_CHAIN' },
    { label: 'Pricing / Reimbursement Developments Carveout', keys: [], maeCode: 'PRICING_REIMBURSEMENT' },
    { label: 'Medical Organizations / Regulators Carveout', keys: [], maeCode: 'MEDICAL_ORGS_STATEMENTS' },
    { label: 'Patents / Exclusivity Carveout',        keys: [], maeCode: 'PATENTS_EXCLUSIVITY' },
    { label: 'Parent Actions / Inaction Carveout',    keys: [], maeCode: 'PARENT_ACTIONS_OR_INACTION' },
    { label: 'Employee Departures Carveout',          keys: [], maeCode: 'EMPLOYEE_DEPARTURES' },
    { label: 'Pandemic Carveout',                     keys: ['pandemicCarveout'], maeCode: 'PANDEMIC' },
    { label: 'Other Carveouts',                       keys: [], maeCode: 'OTHER' },
  ],

  // ─── COND-M / COND-B / COND-S — Paul Weiss q41–q43, q82, q88–q99 ───────
  'COND-M': [
    { label: 'Main Condition',                        keys: ['mainCondition', 'mainConcept'] },
    { label: 'Burdensome Condition Present',          keys: ['burdensomeConditionPresent'] },
    { label: 'Burdensome Condition Scope',            keys: ['burdensomeConditionScope'] },
    { label: 'Stockholder Approval Required',         keys: ['stockholderApprovalRequired', 'stockholderApproval'] },
    { label: 'Regulatory Approvals Required',         keys: ['regulatoryApprovals', 'requiredApprovals'] },
    { label: 'HSR Clearance',                         keys: ['hsrClearance', 'antitrustClearance'] },
    { label: 'MAE as Closing Condition',              keys: ['maeConditionStandalone', 'maeStandaloneCondition'] },
    { label: 'Materiality Scrape Present',            keys: ['materialityScrapePresent', 'materialityScrape'] },
    { label: 'Materiality Scrape Language',           keys: ['materialityScrapeLanguage'] },
    { label: 'Government Proceeding Condition',       keys: ['governmentProceedingConditionPresent'] },
    { label: 'Absence of Enjoining Order Present',    keys: ['absenceOfEnjoiningOrderPresent'] },
    { label: 'Absence of Enjoining Order Details',    keys: ['absenceOfEnjoiningOrderDetails'] },
    { label: 'Closing Deadline After Conditions (days)', keys: ['mutualClosingDeadlineAfterConditionsDays'] },
    { label: 'Bring-Down Standard',                   keys: ['bringDownStandard', 'bringDownTiers'] },
    { label: 'Cure Periods',                          keys: ['curePeriod', 'cureDays'] },
    { label: 'Officer Certification Required',        keys: ['certificationRequired'] },
    { label: 'Tender Offer Minimum Condition',        keys: ['tenderOfferMinimumCondition'] },
    { label: 'Dollar Threshold',                      keys: ['dollarThreshold'] },
    { label: 'Schedule Reference',                    keys: ['scheduleReference'] },
  ],
  'COND-B': [
    { label: 'Main Condition',                        keys: ['mainCondition', 'mainConcept'] },
    { label: 'Burdensome Condition Present',          keys: ['burdensomeConditionPresent'] },
    { label: 'Burdensome Condition Scope',            keys: ['burdensomeConditionScope'] },
    { label: 'Reps Bring-Down',                       keys: ['bringDownTiers', 'bringDownStandard'] },
    { label: 'MAE as Closing Condition',              keys: ['maeConditionStandalone'] },
    { label: 'Materiality Scrape Present',            keys: ['materialityScrapePresent', 'materialityScrape'] },
    { label: 'Materiality Scrape Language',           keys: ['materialityScrapeLanguage'] },
    { label: 'Government Proceeding Condition',       keys: ['governmentProceedingConditionPresent'] },
    { label: 'Absence of Enjoining Order Present',    keys: ['absenceOfEnjoiningOrderPresent'] },
    { label: 'Absence of Enjoining Order Details',    keys: ['absenceOfEnjoiningOrderDetails'] },
    { label: 'Closing Deadline After Conditions (days)', keys: ['mutualClosingDeadlineAfterConditionsDays'] },
    { label: 'Dissenting Shares Threshold',           keys: ['dissentingSharesThreshold'] },
    { label: 'Cure Periods',                          keys: ['curePeriod', 'cureDays'] },
    { label: 'Officer Certification Required',        keys: ['certificationRequired'] },
    { label: 'Dollar Threshold',                      keys: ['dollarThreshold'] },
    { label: 'Schedule Reference',                    keys: ['scheduleReference'] },
  ],
  'COND-S': [
    { label: 'Main Condition',                        keys: ['mainCondition', 'mainConcept'] },
    { label: 'Burdensome Condition Present',          keys: ['burdensomeConditionPresent'] },
    { label: 'Burdensome Condition Scope',            keys: ['burdensomeConditionScope'] },
    { label: 'Reps Bring-Down',                       keys: ['bringDownTiers', 'bringDownStandard'] },
    { label: 'Funds Availability as Condition',       keys: ['fundsCondition'] },
    { label: 'Materiality Scrape Present',            keys: ['materialityScrapePresent', 'materialityScrape'] },
    { label: 'Materiality Scrape Language',           keys: ['materialityScrapeLanguage'] },
    { label: 'Government Proceeding Condition',       keys: ['governmentProceedingConditionPresent'] },
    { label: 'Absence of Enjoining Order Present',    keys: ['absenceOfEnjoiningOrderPresent'] },
    { label: 'Absence of Enjoining Order Details',    keys: ['absenceOfEnjoiningOrderDetails'] },
    { label: 'Closing Deadline After Conditions (days)', keys: ['mutualClosingDeadlineAfterConditionsDays'] },
    { label: 'Cure Periods',                          keys: ['curePeriod', 'cureDays'] },
    { label: 'Officer Certification Required',        keys: ['certificationRequired'] },
    { label: 'Dollar Threshold',                      keys: ['dollarThreshold'] },
    { label: 'Schedule Reference',                    keys: ['scheduleReference'] },
  ],

  // ─── IOC — Paul Weiss q100–q114 ────────────────────────────────────────
  IOC: [
    { label: 'Affirmative IOC Scope',                 keys: ['positiveObligations', 'affirmativeLimbs'] },
    { label: 'Efforts Standard for Company IOCs',     keys: ['effortsStandard'] },
    { label: 'Company IOC Exceptions',                keys: ['permittedExceptions'] },
    { label: 'Ordinary Course / Past Practice Defined', keys: ['ordinaryCourseCarveout'] },
    { label: 'Target IOC Buckets',                    keys: ['dollarThresholdsByCategory'] },
    { label: 'Lead-In Allows Action After No Response', keys: ['leadInAllowsActionAfterNoResponse'] },
    { label: 'Lead-In Period (days)',                 keys: ['leadInPeriodDays'] },
    { label: 'Settlement Restrictions Cap',           keys: ['interimSettlementCap'] },
    { label: 'Settlement Cap — Non-Payment Excluded', keys: ['interimSettlementNonPaymentExcluded'] },
    { label: 'New / Amended Contracts Scope',         keys: ['interimNewContractsScope'] },
    { label: 'Per-Category Dollar Thresholds',        keys: ['dollarThresholdsByCategory', 'dollarThreshold'] },
    { label: 'Salary / Bonus Increase Exceptions',    keys: ['salaryIncreaseExceptions', 'bonusIncreaseExceptions'] },
    { label: 'New Hire Exceptions',                   keys: ['newHireExceptions'] },
    { label: 'Retention Bonus Restrictions',          keys: ['retentionBonusRestrictions'] },
    { label: 'Benefit Plan Restrictions',             keys: ['benefitPlanRestrictions'] },
    { label: 'Equity Award Restrictions',             keys: ['equityAwardRestrictions'] },
    { label: 'Materiality Qualifier (section-wide)',  keys: ['materialityQualifier'] },
    { label: 'Required-by-Law Carveout',              keys: ['requiredByLawCarveout'] },
    { label: 'Pandemic / COVID Carveout',             keys: ['pandemicCarveout'] },
    { label: 'Schedule Reference',                    keys: ['scheduleReference'] },
    { label: 'Parent / Buyer IOC Buckets',            keys: ['parentBuyerIocBuckets'] },
  ],

  // ─── COV — Paul Weiss q115–q119 ────────────────────────────────────────
  COV: [
    { label: 'TSA Contemplated',                      keys: ['tsaContemplated'] },
    { label: 'Financing Cooperation Present',         keys: ['financingCooperationPresent', 'financingCooperation'] },
    { label: 'Financing Cooperation Scope',           keys: ['financingCooperationScope'] },
    { label: 'Financing Cooperation Breach is Condition', keys: ['financingCooperationBreachIsCondition'] },
    { label: 'Public Statements — Parent Recommendation Carveout', keys: ['publicStatementsCarveoutParent'] },
    { label: 'Public Statements — Company Carveout',  keys: ['publicStatementsCarveoutCompany'] },
    { label: 'Public Statements — Joint Approval',    keys: ['publicStatementsJointApproval'] },
    { label: 'Covenant Compliance Closing Standard',  keys: ['covenantComplianceStandard'] },
    { label: 'D&O Insurance Cap',                     keys: ['insuranceCap'] },
    { label: 'D&O Indemnification Tail Period',       keys: ['indemnificationPeriod'] },
    { label: 'D&O Advancement of Expenses',           keys: ['advancementOfExpenses'] },
    { label: 'D&O Notification Consequences',         keys: ['notificationConsequences'] },
    { label: 'Employee Benefit Continuation Period',  keys: ['employeeBenefitPeriod'] },
    { label: 'CVR Agreement Included',                keys: ['cvrIncluded'] },
    { label: 'Access Scope',                          keys: ['accessScope'] },
  ],

  // ─── MISC — preserve existing 10 rows, then PW q163–q184 ────────────────
  MISC: [
    // Existing 10 boilerplate rows preserved at the top.
    { label: 'Governing Law',              keys: ['governingLaw'] },
    { label: 'Jurisdiction',               keys: ['jurisdictionExclusive', 'jurisdiction'] },
    { label: 'Jury Trial Waiver',          keys: ['juryWaiver'] },
    { label: 'Specific Performance',       keys: ['specificPerformance'] },
    { label: 'Third-Party Beneficiaries',  keys: ['thirdPartyBeneficiaryExceptions', 'thirdPartyBeneficiaries'] },
    { label: 'Notices Address',            keys: ['noticesAddress'] },
    { label: 'Amendments Requirement',     keys: ['amendmentsRequirement'] },
    { label: 'Waiver Standard',            keys: ['waiverStandard'] },
    { label: 'Severability',               keys: ['severability'] },
    { label: 'Counterparts / Electronic',  keys: ['counterparts'] },
    // PW q163–q184 additions
    { label: 'Termination Exception for Bad Behavior', keys: ['terminationExceptionForBadBehavior'] },
    { label: 'Lost Premium Damages Pursuit', keys: ['lostPremiumDamagesPursuit'] },
    { label: 'Fee / Expense Allocation',   keys: ['feeExpenseAllocation'] },
    { label: 'Mutual Specific Performance Right', keys: ['specificPerformanceMutual'] },
    { label: 'Company Right to Force Parent to Close', keys: ['companyRightToForceClose'] },
    { label: 'Company Force-Close Conditions', keys: ['companyForceCloseConditions'] },
    { label: 'Limitations on Specific Performance', keys: ['specificPerformanceLimitations'] },
    { label: 'Bond / Security Required for SP', keys: ['bondSecurityRequiredForSP'] },
    { label: 'Willful Breach Definition',  keys: ['willfulBreachDefinition'] },
    { label: 'Willful Breach Requires Actual Knowledge', keys: ['willfulBreachRequiresActualKnowledge'] },
    { label: 'Willful Breach Covers Omissions', keys: ['willfulBreachCoversOmissions'] },
    { label: 'Willful Breach Limited to Material', keys: ['willfulBreachLimitedToMaterial'] },
    { label: 'Reps Survival Present',      keys: ['repsSurvivalPresent'] },
    { label: 'Reps Survival Duration',     keys: ['repsSurvivalDuration'] },
    { label: 'Reps Survival Exceptions',   keys: ['repsSurvivalExceptions'] },
    { label: 'Parent Assignment Right',    keys: ['parentAssignmentRight'] },
    { label: 'Parent Assignment Conditions', keys: ['parentAssignmentConditions'] },
    { label: 'Company Consent for Assignment', keys: ['companyConsentForAssignment'] },
    { label: 'Assignment Exceptions',      keys: ['assignmentExceptions'] },
    { label: 'Assignment Restrictions',    keys: ['assignmentRestrictions'] },
    { label: 'No Excuse Post-Closing Present', keys: ['noExcusePostClosingPresent'] },
    { label: 'No Setoff Present',          keys: ['noSetoffPresent'] },
  ],
};

// Aliases so the dispatcher can pass the parent-type spec for sub-codes.
CATEGORY_SUMMARY_FEATURES['COND'] = CATEGORY_SUMMARY_FEATURES['COND-M'];
CATEGORY_SUMMARY_FEATURES['IOC-T'] = CATEGORY_SUMMARY_FEATURES['IOC'];
CATEGORY_SUMMARY_FEATURES['IOC-B'] = CATEGORY_SUMMARY_FEATURES['IOC'];
CATEGORY_SUMMARY_FEATURES['TERMR-M'] = CATEGORY_SUMMARY_FEATURES['TERMR'];
CATEGORY_SUMMARY_FEATURES['TERMR-B'] = CATEGORY_SUMMARY_FEATURES['TERMR'];
CATEGORY_SUMMARY_FEATURES['TERMR-T'] = CATEGORY_SUMMARY_FEATURES['TERMR'];

// Heuristic: detect ANTI provisions that are really takeover-statute
// "no inconsistent action" boilerplate. These get pulled out of the main
// ANTI summary table and rendered separately below.
function isTakeoverStatuteProvision(p) {
  if (!p) return false;
  const cat = String(p?.category || '').toLowerCase();
  if (!cat) return false;
  if (/takeover\s+statute/i.test(cat)) return true;
  if (/state\s+takeover/i.test(cat)) return true;
  // "No Inconsistent Action" can mean (a) ANTI-NOACTION (a real antitrust
  // covenant) or (b) state takeover statute carveout. Disambiguate by
  // looking for the takeover/state-statute reference in the full text.
  if (/no\s+inconsistent\s+action/i.test(cat)) {
    const text = String(p?.full_text || '').toLowerCase();
    if (/takeover\s+statute|state\s+takeover|moratorium\s+statute|business\s+combination\s+statute/.test(text)) {
      return true;
    }
  }
  return false;
}

// Pull the first non-empty value across `provisions` for any of `keys`.
function pickFirstNonEmpty(provisions, keys) {
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    for (const k of keys) {
      const v = f[k];
      if (v === null || v === undefined || v === '' || v === false) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      return { value: v, key: k, provision: p };
    }
  }
  return null;
}

// Render a single row's value cell. Returns either a React node (for italic
// "Not present" placeholder, list count+snippet, or tagged label) or a string.
function renderSummaryRowValue(hit, featureKeyForLookup) {
  if (hit === null || hit === undefined) {
    return (
      <span className="italic text-inkFaint">Not present in this agreement</span>
    );
  }
  let v = hit.value;
  const key = hit.key || featureKeyForLookup;

  // Unwrap citable wrapper.
  if (isCitableValue(v)) v = getCitableValue(v);

  // Tagged single value → show the resolved label.
  if (isTaggedItem(v)) {
    const label = resolveTaggedLabel(key, v) || v.label || v.code;
    return <span>{label}</span>;
  }

  // List value → "N items · first, second, third…"
  if (Array.isArray(v)) {
    if (v.length === 0) {
      return <span className="italic text-inkFaint">Not present in this agreement</span>;
    }
    const labels = v.map((item) => {
      if (isTaggedItem(item)) return resolveTaggedLabel(key, item) || item.label || item.code;
      if (item && typeof item === 'object') {
        return String(item.label || item.text || item.obligation || JSON.stringify(item)).trim();
      }
      return String(item);
    }).filter(Boolean);
    const snippet = labels.slice(0, 3).join(', ');
    const more = labels.length > 3 ? '…' : '';
    const count = `${labels.length} item${labels.length === 1 ? '' : 's'}`;
    return <span>{count} · {snippet}{more}</span>;
  }

  // Boolean / scalar.
  if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
  if (v === null || v === undefined || v === '') {
    return <span className="italic text-inkFaint">Not present in this agreement</span>;
  }
  return <span>{String(v)}</span>;
}

function CategoryFeatureSummaryTable({ provisions, type, onSelectProvision }) {
  const spec = CATEGORY_SUMMARY_FEATURES[type] || [];

  // For each spec row, resolve its hit. MAE rows with `maeCode` resolve via
  // findCarveoutByCode against features.carveouts (taxonomy-tagged list).
  const rows = spec.map((row) => {
    let hit = null;
    if (row.maeCode) {
      hit = findCarveoutByCode(provisions, row.maeCode);
      if (!hit && row.keys && row.keys.length > 0) {
        hit = pickFirstNonEmpty(provisions, row.keys);
      }
    } else if (row.keys && row.keys.length > 0) {
      hit = pickFirstNonEmpty(provisions, row.keys);
    }
    return { label: row.label, hit, lookupKey: (row.keys && row.keys[0]) || row.maeCode || null };
  });

  // Sort the provision links by category for stable display.
  const sortedProvs = [...provisions].sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' })
  );

  const titleLabel = (() => {
    if (type === 'NOSOL') return 'No-Solicitation Summary';
    if (type === 'ANTI')  return 'Antitrust Summary';
    if (type === 'MISC')  return 'Boilerplate Summary';
    if (type === 'MAE')   return 'Material Adverse Effect Summary';
    if (type === 'TERMR' || type === 'TERMR-M' || type === 'TERMR-B' || type === 'TERMR-T') return 'Termination Rights Summary';
    if (type === 'TERMF') return 'Termination Fee Summary';
    if (type === 'COV')   return 'Covenants Summary';
    if (type === 'IOC' || type === 'IOC-T' || type === 'IOC-B') return 'Interim Operating Covenants Summary';
    if (type === 'COND' || type === 'COND-M' || type === 'COND-B' || type === 'COND-S') return 'Closing Conditions Summary';
    return `${type} Summary`;
  })();

  return (
    <div className="space-y-3">
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            {titleLabel}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs font-ui">
            <thead className="bg-bg/60 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-72">Feature</th>
                <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-xs font-ui italic text-inkFaint">
                    No structured summary features defined for this section.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.label} className="hover:bg-bg/40 transition-colors">
                    <td className="px-3 py-2 align-top text-ink font-medium whitespace-nowrap">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 align-top text-ink whitespace-pre-wrap break-words">
                      {renderSummaryRowValue(row.hit, row.lookupKey)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sortedProvs.length > 0 && (
        <div className="bg-bg/40 border border-border rounded-lg px-3 py-2">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1.5">
            Provisions in this section
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {sortedProvs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectProvision && onSelectProvision(p)}
                  className="text-xs font-ui text-accent hover:underline"
                >
                  {p.category || 'General'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── NOSOL / ANTI table — same Term/Details visual layout as StructTable.
 *     Each provision is one row. The Details column stacks the type's
 *     FEATURE_DISPLAY_ORDER fields as <dt>/<dd> pairs (skipping empties)
 *     so the multi-code section reads like a clean key/value summary —
 *     no per-feature columns with mostly-empty cells, no card stacks. */
function MultiCodeStructLikeTable({ provisions, type, onSelectProvision }) {
  // Sort provisions by category for stable reading order.
  const sorted = [...provisions].sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || '')));

  const schemaKeys = (FEATURE_DISPLAY_ORDER[type] || []).filter(
    (k) => !getHiddenColumnsForType(type).has(k),
  );

  const rows = sorted.map((p) => {
    const features = getStructuredFeatures(p) || {};
    const cells = schemaKeys
      .map((key) => ({ key, raw: features[key] }))
      .filter(({ raw }) => !isEmptyValue(raw));
    return { p, cells };
  });

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <table className="min-w-full text-xs font-ui">
        <thead className="bg-bg/60 border-b border-border">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[220px]">Term</th>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ p, cells }) => (
            <tr key={p.id} className="hover:bg-bg/40 transition-colors align-top">
              <td className="px-3 py-2 align-top">
                <button
                  type="button"
                  onClick={() => onSelectProvision && onSelectProvision(p)}
                  className="text-left text-accent hover:underline font-medium"
                >
                  {p.category || 'General'}
                </button>
              </td>
              <td className="px-3 py-2 text-ink">
                {cells.length === 0 ? (
                  <span className="text-inkFaint/70 italic">—</span>
                ) : (
                  <dl className="space-y-1">
                    {cells.map(({ key, raw }) => (
                      <div key={key} className="flex flex-col">
                        <dt className="text-[10px] text-inkFaint uppercase tracking-wider">
                          {humanizeKey(key)}
                        </dt>
                        <dd>{renderFeatureCell(key, raw)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── BRINGDOWN TABLE — for REP-T / REP-B category pages.
 *     Pulls bringDownTiers from the matching COND provision (COND-B-REP for
 *     REP-T, COND-S-REP for REP-B) and renders the tiers grouped by standard:
 *     "General Standard" (the catch-all tier) + "Higher Standards" (each
 *     non-catch-all tier with its list of covered reps). */
function isCondRepProvision(p, repsType) {
  if (!p) return false;
  const meta = getAiMetadata(p) || {};
  const code = meta.code || p.code || '';
  if (repsType === 'REP-T' && code === 'COND-B-REP') return true;
  if (repsType === 'REP-B' && code === 'COND-S-REP') return true;
  return false;
}

function isCatchAllRepsCovered(reps) {
  if (!reps) return false;
  const s = String(reps).toLowerCase().trim();
  if (!s) return false;
  // Heuristics: "all other reps", "the remaining reps", "all reps", "each
  // representation", "all representations except", "general" / "default".
  if (/\ball\s+(?:other\s+)?(?:reps|representations)\b/.test(s)) return true;
  if (/\b(?:remaining|other|each|every)\s+(?:reps|representations)\b/.test(s)) return true;
  if (/^general\b/.test(s) || /^default\b/.test(s)) return true;
  if (/\bexcept\b/.test(s)) return true;
  return false;
}

// Pull a dollar/threshold value from a tier and/or its source provision.
// Tries tier.dollarThreshold, tier.threshold, then features.dollarThreshold,
// then scans the provision's full_text for the first currency value as a
// last-resort fallback.
function pickTierThreshold(tier, sourceProv) {
  if (tier) {
    const v = tier.dollarThreshold ?? tier.threshold ?? tier.dollar_threshold;
    if (v !== null && v !== undefined && v !== '') return String(v);
  }
  if (sourceProv) {
    const f = getStructuredFeatures(sourceProv) || {};
    const dt = f.dollarThreshold;
    if (dt !== null && dt !== undefined && dt !== '') return String(dt);
    const text = String(sourceProv.full_text || '');
    if (text) {
      const m = text.match(/\$\s?[\d,]+(?:\.\d+)?(?:\s?(?:million|billion|thousand))?/i);
      if (m) return m[0];
    }
  }
  return null;
}

// Find the names of the REP provisions a tier covers. Uses the
// `linkedBringDownStandard` stamp left on each REP by linkBringDownToReps,
// matching tier.standard / tier.standardCode. Falls back to free-text
// section-number matching against tier.reps_covered (scans for "Section
// X.YZ" references and maps to REP provisions by section number).
function findCoveredRepNames(tier, repProvisions) {
  if (!Array.isArray(repProvisions) || repProvisions.length === 0) return [];
  const tierStdCode = (
    tier?.standard ||
    tier?.standardCode ||
    tier?.standard_code ||
    ''
  );
  const names = [];
  const seen = new Set();
  const pushName = (nm) => {
    if (!nm) return;
    const key = String(nm).toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(nm);
  };
  if (tierStdCode) {
    for (const rep of repProvisions) {
      const f = getStructuredFeatures(rep) || {};
      const stamp = f.linkedBringDownStandard;
      const stampCode = isTaggedItem(stamp) ? stamp.code : stamp;
      if (stampCode && String(stampCode) === String(tierStdCode)) {
        pushName(rep.category || '');
      }
    }
  }
  // Fallback: scan tier.repsCovered for explicit section references and
  // resolve them against the REP provisions' sectionNumber stamps. This
  // recovers names for the company-side (REP-T) case where the AI sometimes
  // doesn't stamp linkedBringDownStandard back onto every covered rep.
  if (names.length === 0) {
    const repsText = String(tier?.reps_covered || tier?.repsCovered || '');
    if (repsText) {
      const sectionRefs = new Set();
      // Match "Section 3.5", "Section 3.05", "Section 3.5(a)", "3.5", etc.
      const re = /(?:Section\s+)?(\d+\.\d+(?:\(\w+\))?)/gi;
      let m;
      while ((m = re.exec(repsText)) !== null) {
        sectionRefs.add(m[1].toLowerCase());
      }
      if (sectionRefs.size > 0) {
        for (const rep of repProvisions) {
          const f = getStructuredFeatures(rep) || {};
          const sn = String(f.sectionNumber || rep.section_number || '').toLowerCase();
          if (sn && sectionRefs.has(sn)) pushName(rep.category || '');
        }
      }
    }
  }
  return names;
}

/* Canonical "always look for these" reps. When a deal is missing one, we
 * synthesize a placeholder row in the main REP list so the absence is loud
 * instead of silent. Sub-codes match first; fallback to category-regex for
 * reps that don't have a dedicated sub-code (Parent Litigation/Ownership/
 * Brokers). */
const EXPECTED_REPS = {
  'REP-B': [
    { label: 'Sufficient Funds',         match: { code: 'REP-B-FUNDS' } },
    { label: 'Solvency',                 match: { code: 'REP-B-SOLVENCY' } },
    { label: 'Anti-Reliance / No Other Reps', match: { code: 'REP-B-ANTIRELIANCE' } },
    { label: 'Parent Litigation',        match: { categoryRegex: /\blitig/i } },
    { label: 'Parent Ownership of Company Stock', match: { categoryRegex: /\bownership\b|company\s+(?:capital\s+)?stock|share\s+ownership/i } },
    { label: 'Brokers & Finders',        match: { categoryRegex: /broker|finder/i } },
  ],
  'REP-T': [
    { label: 'Sufficiency of Assets',    match: { code: 'REP-T-SUFFICIENCY' } },
    { label: 'Top Customers / Suppliers', match: { code: 'REP-T-TOP-CUSTOMERS' } },
    { label: 'Material Contracts',       match: { code: 'REP-T-MATERIAL-CONTRACTS' } },
  ],
};

function findExpectedRepMatch(list, match) {
  if (match.code) {
    const byCode = list.find((p) => (p.code || '').toUpperCase() === match.code.toUpperCase());
    if (byCode) return byCode;
  }
  if (match.categoryRegex) {
    return list.find((p) => match.categoryRegex.test(p.category || '')) || null;
  }
  return null;
}

/** Augment the rendered REP list with synthetic "_notPresent" rows for any
 *  expected reps that the parser didn't find. Real provisions pass through
 *  unchanged. The optional `allProvisions` lets the matcher pick up reps
 *  stamped outside REP-T/REP-B (e.g. anti-reliance in COV / MISC). */
function augmentRepsWithExpectedPlaceholders(list, repsType, allProvisions) {
  const expected = EXPECTED_REPS[repsType];
  if (!expected || !Array.isArray(list)) return list || [];
  const placeholders = [];
  const externalHits = [];
  const inListIds = new Set((list || []).map((p) => p.id));
  for (const spec of expected) {
    let hit = findExpectedRepMatch(list, spec.match);
    if (!hit && Array.isArray(allProvisions) && spec.match.code) {
      // Look across the full provision list for a code match (e.g.
      // anti-reliance stamped on a COV provision).
      hit = findExpectedRepMatch(allProvisions, spec.match);
      if (hit && !inListIds.has(hit.id)) externalHits.push(hit);
    }
    if (hit) continue;
    placeholders.push({
      id: `__not_present__${repsType}__${spec.label}`,
      type: repsType,
      code: spec.match.code || null,
      category: spec.label,
      full_text: '',
      ai_metadata: null,
      _notPresent: true,
    });
  }
  return [...list, ...externalHits, ...placeholders];
}

function BringdownTable({ provisions, repsType, onSelectProvision }) {
  // Find the matching COND-B-REP / COND-S-REP provision.
  const condProvs = (provisions || []).filter((p) => isCondRepProvision(p, repsType));
  // Gather tiers from any matching provisions — remember which provision
  // each tier came from so we can pull thresholds / text as a fallback.
  const tiers = [];
  for (const cp of condProvs) {
    const f = getStructuredFeatures(cp) || {};
    if (Array.isArray(f.bringDownTiers)) {
      for (const t of f.bringDownTiers) {
        if (t && typeof t === 'object') tiers.push({ tier: t, source: cp });
      }
    }
  }

  if (tiers.length === 0) return null;

  // Identify the catch-all tier (the "general standard"). Heuristic: the
  // tier whose reps_covered matches isCatchAllRepsCovered. If none match,
  // assume the LAST tier is the catch-all (drafters typically state the
  // general standard last, after enumerating higher-standard exceptions).
  let generalIdx = tiers.findIndex(({ tier: t }) => isCatchAllRepsCovered(t.reps_covered || t.repsCovered));
  if (generalIdx < 0) generalIdx = tiers.length - 1;
  const generalEntry = tiers[generalIdx];
  const higherEntries = tiers.filter((_, i) => i !== generalIdx);

  const tierStdLabel = (t) =>
    t.standard_label || t.standardLabel || t.standard || t.standardCode || '(unspecified)';

  // REP provisions in this category — used to enumerate which reps each
  // higher-standard tier covers (via the linkedBringDownStandard stamp).
  const repProvs = (provisions || []).filter((p) => p.type === repsType);

  // Group higher tier entries by standard label so all reps under the same
  // standard render together. Each entry contributes its reps_covered text
  // + any matched REP provision names. Also captures the matched provisions
  // themselves so we can wire the names as buttons that jump to the source.
  const higherByStandard = new Map();
  const namesToProvs = new Map(); // lowercase name -> provision
  for (const rep of repProvs) {
    const nm = String(rep.category || '').toLowerCase().trim();
    if (nm) namesToProvs.set(nm, rep);
  }
  for (const entry of higherEntries) {
    const { tier: t } = entry;
    const stdLabel = tierStdLabel(t);
    const reps = t.reps_covered || t.repsCovered || '';
    const matchedNames = findCoveredRepNames(t, repProvs);
    const bucket = higherByStandard.get(stdLabel) || { reps: [], names: new Set() };
    if (reps) bucket.reps.push(reps);
    for (const nm of matchedNames) bucket.names.add(nm);
    higherByStandard.set(stdLabel, bucket);
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Bringdown Standards
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[200px]">Tier</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Standard</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {generalEntry && (
              <tr className="align-top">
                <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">
                  General Standard
                </td>
                <td className="px-3 py-2 text-ink">
                  <div className="text-sm leading-relaxed">{tierStdLabel(generalEntry.tier)}</div>
                  {(generalEntry.tier.exceptions || generalEntry.tier.reps_covered) && (
                    <div className="text-[11px] text-inkMid mt-0.5">
                      {generalEntry.tier.reps_covered && (
                        <span className="italic">{generalEntry.tier.reps_covered}</span>
                      )}
                      {generalEntry.tier.exceptions && (
                        <span>{generalEntry.tier.reps_covered ? ' — ' : ''}{generalEntry.tier.exceptions}</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )}
            {Array.from(higherByStandard.entries()).map(([stdLabel, bucket]) => {
              const nameList = Array.from(bucket.names);
              return (
                <tr key={stdLabel} className="align-top">
                  <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">
                    Higher Standard
                  </td>
                  <td className="px-3 py-2 text-ink">
                    <div className="text-sm leading-relaxed font-medium">{stdLabel}</div>
                    {nameList.length > 0 && (
                      <div className="text-[11px] text-inkMid mt-0.5">
                        {nameList.map((nm, i) => {
                          const prov = namesToProvs.get(String(nm).toLowerCase().trim());
                          return (
                            <span key={nm}>
                              {i > 0 && ', '}
                              {prov && onSelectProvision ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectProvision(prov)}
                                  className="text-accent hover:underline"
                                >
                                  {nm}
                                </button>
                              ) : (
                                <span>{nm}</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {nameList.length === 0 && bucket.reps.length > 0 && (
                      <ul className="list-disc list-inside text-[11px] text-inkMid mt-0.5 space-y-0.5">
                        {bucket.reps.map((reps, i) => (
                          <li key={i} className="whitespace-pre-wrap">{reps}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── DEFINITIONS LIST — for the DEF category page.
 *     User wants no preamble, no summary table, no structured features view.
 *     Just an alphabetical list of all defined terms, each clickable to open
 *     the edit panel. Renders as a multi-column grid for compactness. */
// Prefer the actual defined term over the canonical-code label. For
// inline-extracted defs, features.canonicalTerm holds the verbatim phrase
// (e.g. "Company Material Adverse Effect"). Fallback to features.term, then
// to the broader category, then to a placeholder.
function definitionLabel(p) {
  const feats = getStructuredFeatures(p) || {};
  return (
    feats.canonicalTerm ||
    feats.term ||
    p.category ||
    'Definition'
  );
}

function DefinitionsList({ provisions, onSelectProvision }) {
  const sorted = [...(provisions || [])].sort((a, b) =>
    String(definitionLabel(a)).localeCompare(String(definitionLabel(b)), undefined, { sensitivity: 'base' })
  );
  if (sorted.length === 0) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Defined Terms
        </p>
        <p className="text-[10px] font-ui text-inkFaint">{sorted.length}</p>
      </div>
      <ul className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
        {sorted.map((p) => {
          const label = definitionLabel(p);
          return (
            <li key={p.id} className="truncate">
              <button
                type="button"
                onClick={() => onSelectProvision && onSelectProvision(p)}
                className="text-left text-sm text-accent hover:underline font-ui"
                title={label}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Synthesize a concise "Term" cell for a TERMR-OUTSIDE provision. Pulls the
// outside-date date / month-count and any extension fields and composes:
//   "<outsideDate or N months> · Extensions: <period> by <trigger> (consent: <party>)"
// or "(none)" if no extension is available. Returns a plain string (no JSX).
// Returns null for non-OUTSIDE TERMR rows.
function buildTermrOutsideTermText(provision) {
  if (!provision) return null;
  const meta = getAiMetadata(provision) || {};
  const code = String(meta.code || provision.code || '');
  if (code !== 'TERMR-OUTSIDE') return null;
  const f = getStructuredFeatures(provision) || {};

  const labelOf = (key, v) => {
    if (v === null || v === undefined || v === '' || v === false) return null;
    if (isTaggedItem(v)) return resolveTaggedLabel(key, v) || v.code;
    if (Array.isArray(v)) {
      const parts = v
        .map((item) => (isTaggedItem(item) ? (resolveTaggedLabel(key, item) || item.code) : String(item)))
        .filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    return String(v);
  };

  // Compose the date portion: prefer an explicit outsideDate; else the month-count.
  const datePart = (() => {
    if (f.outsideDate) return String(f.outsideDate);
    if (f.outsideDateMonths !== null && f.outsideDateMonths !== undefined && f.outsideDateMonths !== '') {
      return `${f.outsideDateMonths} months`;
    }
    return null;
  })();

  const extAvailable = f.extensionAvailable;
  const extAvailableTruthy = extAvailable === true || extAvailable === 'true' || extAvailable === 'yes';
  const extAvailableFalsy = extAvailable === false || extAvailable === 'false' || extAvailable === 'no';

  const extPeriod = labelOf('extensionPeriod', f.extensionPeriod);
  const extTrigger = labelOf('extensionTrigger', f.extensionTrigger);
  const extParty = labelOf('extensionConsentParty', f.extensionConsentParty);
  const anyExtField = extPeriod || extTrigger || extParty;

  let extPart;
  if (extAvailableFalsy && !anyExtField) {
    extPart = 'Extensions: (none)';
  } else if (!extAvailableTruthy && !anyExtField) {
    extPart = null;
  } else {
    const bits = [];
    if (extPeriod) bits.push(extPeriod);
    if (extTrigger) bits.push(`by ${extTrigger}`);
    if (extParty) bits.push(`(consent: ${extParty})`);
    extPart = `Extensions: ${bits.length > 0 ? bits.join(' ') : 'available'}`;
  }

  if (!datePart && !extPart) return null;
  return [datePart, extPart].filter(Boolean).join(' · ');
}

/* ─── MAE DEFINITION SUMMARY — renders the PW MAE checklist (q20–q37) at
 *     the top of the REP-T page. Pulls features from any REP-T provision
 *     whose category matches /material\s+adverse\s+effect/i OR any DEF
 *     provision similarly matched. If neither found, renders the full spec
 *     with all-"Not present" rows. */
function isMaeDefinitionProvision(p) {
  if (!p) return false;
  const cat = String(p?.category || '');
  if (/material\s+adverse\s+effect/i.test(cat)) return true;
  // ai_metadata.code may carry MAE-DEF or similar sub-codes
  const meta = getAiMetadata(p) || {};
  const code = String(meta.code || p?.code || '');
  if (/MAE/i.test(code) && /(DEF|MATERIAL|ADVERSE)/i.test(code)) return true;
  return false;
}

/* ─── REP knowledge note: italic line above the REP table reading
 *     "Knowledge standard: <KNOWLEDGE_STANDARDS label or italic 'Not specified'>".
 *     Pulled from the first REP provision with non-null `knowledgeStandard`. */
function RepKnowledgeNote({ provisions }) {
  let label = null;
  for (const p of provisions || []) {
    const f = getStructuredFeatures(p) || {};
    const raw = isCitableValue(f.knowledgeStandard) ? getCitableValue(f.knowledgeStandard) : f.knowledgeStandard;
    if (!raw) continue;
    if (isTaggedItem(raw)) {
      label = resolveTaggedLabel('knowledgeStandard', raw) || raw.label || raw.code;
    } else if (typeof raw === 'string') {
      label = raw;
    }
    if (label) break;
  }
  return (
    <p className="text-[11px] font-ui italic text-inkMid px-1">
      Knowledge standard: {label ? <span className="text-ink not-italic">{label}</span> : <span className="text-inkFaint">Not specified</span>}
    </p>
  );
}

/* ─── REP General Exceptions table: bringdown-style. Rows = SEC filings
 *     carve-out (scope + lookback + excluded sections + carved-out reps),
 *     schedule references, materiality scrape language, materiality scrape
 *     applies-to. Each empty row renders "Not present in this agreement". */
function RepGeneralExceptionsTable({ provisions }) {
  const pickKey = (key) => {
    for (const p of provisions || []) {
      const f = getStructuredFeatures(p) || {};
      const raw = f[key];
      if (raw === null || raw === undefined || raw === '' || raw === false) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      return raw;
    }
    return null;
  };
  const renderVal = (key, raw) => {
    if (raw === null || raw === undefined) {
      return <span className="italic text-inkFaint">Not present in this agreement</span>;
    }
    return renderFeatureCell(key, raw);
  };
  const rows = [
    { label: 'SEC Filings — Scope', key: 'secFilingsExceptionScope' },
    { label: 'SEC Filings — Lookback (months)', key: 'secFilingsLookbackMonths' },
    { label: 'SEC Filings — Excluded sections', key: 'secFilingsExcludedSections' },
    { label: 'SEC Filings — Carved-out reps', key: 'secFilingsCarvedOutReps' },
    { label: 'Disclosure schedules (required)', key: 'disclosureSchedulesRequired' },
    { label: 'Disclosure schedules (exception)', key: 'disclosureSchedulesException' },
    { label: 'Materiality scrape language', key: 'materialityScrapeLanguage' },
    { label: 'Materiality scrape applies to', key: 'maeQualifiedReps' },
  ];
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          General Exceptions
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap w-[260px]">Item</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const v = pickKey(r.key);
              return (
                <tr key={r.label} className="align-top">
                  <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">{r.label}</td>
                  <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">{renderVal(r.key, v)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── REP Material Contracts table: only rendered when a REP-T-MATERIAL-CONTRACTS
 *     provision (or any REP provision with materialContractsBuckets) is present.
 *     Columns: Bucket | Threshold | Notes. */
function RepMaterialContractsTable({ provisions, onSelectProvision }) {
  // Find the source provision: prefer one whose code or category matches.
  let source = null;
  for (const p of provisions || []) {
    const meta = getAiMetadata(p) || {};
    const code = String(meta.code || p.code || '');
    if (code === 'REP-T-MATERIAL-CONTRACTS') { source = p; break; }
    if (/material\s+contracts/i.test(p.category || '')) { source = p; break; }
  }
  if (!source) return null;
  const f = getStructuredFeatures(source) || {};
  const buckets = Array.isArray(f.materialContractsBuckets) ? f.materialContractsBuckets : [];
  const thresholds = Array.isArray(f.materialContractsDollarThresholds) ? f.materialContractsDollarThresholds : [];
  if (buckets.length === 0 && thresholds.length === 0) return null;
  // Build a per-bucket threshold lookup. The thresholds array may carry
  // { bucket, threshold } objects keyed by code or label.
  const threshByCode = new Map();
  for (const t of thresholds) {
    if (!t || typeof t !== 'object') continue;
    const k = String(t.bucket || t.code || '').toUpperCase();
    threshByCode.set(k, t.threshold || t.value || null);
  }
  const redactionsPermittedRaw = f.materialContractsRedactionsPermitted;
  const redactionsDef = f.permittedRedactionsDefinition;
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Material Contracts
        </p>
        {onSelectProvision && (
          <button
            type="button"
            onClick={() => onSelectProvision(source)}
            className="text-[10px] font-ui text-accent hover:underline"
          >
            view source
          </button>
        )}
      </div>
      <table className="min-w-full text-xs font-ui">
        <thead className="bg-bg/60 border-b border-border">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider w-[280px]">Bucket</th>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider w-[180px]">Threshold</th>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {buckets.length === 0 ? (
            <tr>
              <td className="px-3 py-2 italic text-inkFaint" colSpan={3}>No buckets extracted</td>
            </tr>
          ) : buckets.map((b, i) => {
            const code = isTaggedItem(b) ? String(b.code).toUpperCase() : null;
            const label = isTaggedItem(b)
              ? (resolveTaggedLabel('materialContractsBuckets', b) || b.label || b.code)
              : String(b);
            const threshold = code ? (threshByCode.get(code) || (thresholds[i]?.threshold)) : (thresholds[i]?.threshold);
            return (
              <tr key={i} className="align-top">
                <td className="px-3 py-2 text-ink font-medium">{label}</td>
                <td className="px-3 py-2 text-ink">{threshold || <span className="italic text-inkFaint">—</span>}</td>
                <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                  {isTaggedItem(b) && b.text ? b.text : <span className="italic text-inkFaint">—</span>}
                </td>
              </tr>
            );
          })}
          {(redactionsPermittedRaw !== undefined || redactionsDef) && (
            <tr className="align-top bg-bg/30">
              <td className="px-3 py-2 text-ink font-medium">Redactions permitted</td>
              <td className="px-3 py-2 text-ink">
                {redactionsPermittedRaw === true ? 'Yes' : redactionsPermittedRaw === false ? 'No' : <span className="italic text-inkFaint">—</span>}
              </td>
              <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                {redactionsDef || <span className="italic text-inkFaint">—</span>}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MaeDefinitionSummary({ allProvisions, onSelectProvision }) {
  const maeProvs = (allProvisions || []).filter(isMaeDefinitionProvision);
  // Derive a one-or-two-limb hero label from features.maeLimbs (preferred) or
  // features.preventDelayProng as a fallback. The user's headline question is
  // "impact on Company only" vs "impact on Company + ability to consummate".
  let limbsLabel = null;
  for (const p of maeProvs) {
    const f = getStructuredFeatures(p) || {};
    const rawLimbs = isCitableValue(f.maeLimbs) ? getCitableValue(f.maeLimbs) : f.maeLimbs;
    if (rawLimbs === 'ONE_LIMB' || rawLimbs === 'TWO_LIMB') {
      limbsLabel = rawLimbs === 'TWO_LIMB'
        ? 'Two-limb: impact on Company + ability to consummate'
        : 'One-limb: impact on Company only';
      break;
    }
    const pd = isCitableValue(f.preventDelayProng) ? getCitableValue(f.preventDelayProng) : f.preventDelayProng;
    if (pd === true) {
      limbsLabel = 'Two-limb: impact on Company + ability to consummate';
      break;
    }
    if (pd === false) {
      limbsLabel = 'One-limb: impact on Company only';
      break;
    }
  }
  return (
    <div className="space-y-3">
      <div className="bg-white border-2 rounded-lg shadow-sm px-5 py-4" style={{ borderColor: '#C9A788' }}>
        <div className="font-mono text-[10px] text-inkFaint uppercase tracking-wider">MAE Test</div>
        <div className="font-display text-lg text-ink font-medium mt-1">
          {limbsLabel || <span className="italic text-inkFaint text-sm">Not yet extracted (re-ingest to populate maeLimbs)</span>}
        </div>
      </div>
      <CategoryFeatureSummaryTable
        provisions={maeProvs}
        type="MAE"
        onSelectProvision={onSelectProvision}
      />
    </div>
  );
}

function ProvisionTable({ provisions, type, onSelectProvision }) {
  // STRUCT and CONSID get specialized layouts — see dedicated components above.
  if (type === 'STRUCT') {
    return <StructTable provisions={provisions} onSelectProvision={onSelectProvision} />;
  }
  if (type === 'CONSID') {
    return <ConsidTable provisions={provisions} onSelectProvision={onSelectProvision} />;
  }
  // NOSOL: render in the same Term/Details format as StructTable —
  // each provision is one row; the Details cell stacks the relevant feature
  // labels/values from the type's FEATURE_DISPLAY_ORDER (skipping empties).
  if (type === 'NOSOL') {
    return (
      <MultiCodeStructLikeTable
        provisions={provisions}
        type={type}
        onSelectProvision={onSelectProvision}
      />
    );
  }
  // ANTI: 2-row summary table (Standard of Efforts + Burden Cap), then a
  // separate "Other" section for takeover-statute "no inconsistent action"
  // provisions that were mis-classified into ANTI.
  if (type === 'ANTI') {
    const takeoverProvs = provisions.filter(isTakeoverStatuteProvision);
    const mainProvs = provisions.filter((p) => !isTakeoverStatuteProvision(p));
    return (
      <div className="space-y-3">
        <CategoryFeatureSummaryTable
          provisions={mainProvs}
          type="ANTI"
          onSelectProvision={onSelectProvision}
        />
        {takeoverProvs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-ui font-semibold text-inkMid uppercase tracking-wider">
              Other
            </h4>
            <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
              <ul className="divide-y divide-border">
                {takeoverProvs.map((p) => (
                  <li key={p.id} className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelectProvision && onSelectProvision(p)}
                      className="text-left text-accent hover:underline font-medium text-xs font-ui"
                    >
                      Takeover Statutes
                    </button>
                    <p className="text-[11px] text-inkMid font-ui mt-0.5">
                      {p.category || ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
  // MISC: render as a 2-column antitrust-style summary table. Below the
  // table, list each MISC provision as a clickable link (the
  // CategoryFeatureSummaryTable already does this).
  if (type === 'MISC') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type="MISC"
        onSelectProvision={onSelectProvision}
      />
    );
  }

  // ── PW diligence checklist — every PW question is a row in the per-type
  //    summary table. Missing rows render an explicit "Not present in this
  //    agreement" italic placeholder so the user can see at one glance what
  //    is populated vs. missing across the full 201-column PW spec.
  if (type === 'TERMR' || type === 'TERMR-M' || type === 'TERMR-B' || type === 'TERMR-T') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type="TERMR"
        onSelectProvision={onSelectProvision}
      />
    );
  }
  if (type === 'TERMF') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type="TERMF"
        onSelectProvision={onSelectProvision}
      />
    );
  }
  if (type === 'COND' || type === 'COND-M' || type === 'COND-B' || type === 'COND-S') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type={CATEGORY_SUMMARY_FEATURES[type] ? type : 'COND-M'}
        onSelectProvision={onSelectProvision}
      />
    );
  }
  if (type === 'IOC' || type === 'IOC-T' || type === 'IOC-B') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type="IOC"
        onSelectProvision={onSelectProvision}
      />
    );
  }
  if (type === 'COV') {
    return (
      <CategoryFeatureSummaryTable
        provisions={provisions}
        type="COV"
        onSelectProvision={onSelectProvision}
      />
    );
  }

  const schemaKeys = getFeatureSchema(type);
  // For multi-code provision types (NOSOL, ANTI), the table is simplified:
  // just Term + Provision (mainConcept). Full features remain available via
  // the card view when the user drills into a specific provision.
  const isMultiCode =
    PROVISION_TYPES.find((t) => t.key === type)?.classificationMode === 'multi';
  // If no schema, fall back to whatever keys exist in the data.
  let columns = schemaKeys;
  if (columns.length === 0) {
    const allKeys = new Set();
    provisions.forEach((p) => {
      const feats = getStructuredFeatures(p);
      if (feats) Object.keys(feats).forEach((k) => allKeys.add(k));
    });
    columns = Array.from(allKeys);
  }
  if (isMultiCode) {
    // If FEATURE_DISPLAY_ORDER defines explicit columns for this multi-code
    // type (e.g. NOSOL's 5 deal-protection terms), honor them. Otherwise
    // fall back to just the mainConcept column.
    const explicit = FEATURE_DISPLAY_ORDER[type];
    if (Array.isArray(explicit) && explicit.length > 0) {
      columns = explicit.slice();
    } else {
      columns = ['mainConcept'];
    }
    // Also apply hidden-column denylist for multi-code types.
    const hidden = getHiddenColumnsForType(type);
    if (hidden.size > 0) {
      columns = columns.filter((k) => !hidden.has(k));
    }
  } else {
    // Apply per-type hidden-column denylist (Change 3).
    const hidden = getHiddenColumnsForType(type);
    if (hidden.size > 0) {
      columns = columns.filter((k) => !hidden.has(k));
    }
  }

  // Special case: re-add voteThreshold only for TERMR rows whose own code is
  // TERMR-VOTE. We detect this by scanning the provisions in the slice — if
  // any provision has code === 'TERMR-VOTE' AND has a voteThreshold value,
  // add the column back so it's visible for those rows.
  const isTermrFamily = type === 'TERMR' || type === 'TERMR-M' || type === 'TERMR-B' || type === 'TERMR-T';
  if (isTermrFamily) {
    const hasVoteCode = provisions.some(
      (p) => p.code === 'TERMR-VOTE' && (getStructuredFeatures(p) || {}).voteThreshold !== undefined,
    );
    if (hasVoteCode && !columns.includes('voteThreshold') && schemaKeys.includes('voteThreshold')) {
      columns = [...columns, 'voteThreshold'];
    }
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap sticky left-0 bg-bg/60 z-10">
                Term
              </th>
              {columns.map((k) => (
                <th
                  key={k}
                  className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap"
                >
                  {humanizeKey(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {provisions.map((p) => {
              if (p._notPresent) {
                return (
                  <tr key={p.id} className="bg-bg/30">
                    <td className="px-3 py-2 align-top whitespace-nowrap sticky left-0 bg-bg/30 z-10">
                      <span className="inline-flex items-center gap-2 italic text-inkFaint">
                        <span
                          style={{
                            display: 'inline-block',
                            width: 7,
                            height: 7,
                            borderRadius: 2,
                            background: 'var(--line)',
                            flexShrink: 0,
                          }}
                        />
                        {p.category}
                      </span>
                    </td>
                    <td
                      colSpan={Math.max(columns.length, 1)}
                      className="px-3 py-2 italic text-inkFaint"
                    >
                      Not present in this agreement
                    </td>
                  </tr>
                );
              }
              const features = getStructuredFeatures(p) || {};
              return (
                <tr key={p.id} className="hover:bg-paper transition-colors">
                  <td className="px-3 py-2 align-top whitespace-nowrap sticky left-0 bg-white z-10">
                    <button
                      type="button"
                      onClick={() => onSelectProvision && onSelectProvision(p)}
                      className="text-left text-accentDeep hover:underline font-semibold inline-flex items-center gap-2"
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          borderRadius: 2,
                          background: typeHex(p.type),
                          flexShrink: 0,
                        }}
                      />
                      {p.category || 'General'}
                    </button>
                  </td>
                  {columns.map((k) => {
                    const raw = features[k];
                    // REP synthetic: rolled-up "Specific Features" column.
                    if ((type === 'REP-T' || type === 'REP-B') && k === 'specificFeatures') {
                      const cell = renderRepSpecificFeaturesCell(p);
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[360px] text-ink">
                          {cell || <span className="text-inkFaint italic">—</span>}
                        </td>
                      );
                    }
                    // REP synthetic: lookback period from secFilingsLookbackMonths.
                    if ((type === 'REP-T' || type === 'REP-B') && k === 'lookbackPeriod') {
                      const months = features.secFilingsLookbackMonths
                        ?? (features.lookbackPeriod ? null : null);
                      const txt = features.lookbackPeriod
                        || computeLookbackText(months, p?.deal?.announce_date || p?.deal_announce_date || null);
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[200px] text-ink">
                          {txt ? <span>{txt}</span> : <span className="text-inkFaint italic">—</span>}
                        </td>
                      );
                    }
                    // TERMR-OUTSIDE — synthesize the "Term" cell (mainConcept)
                    // from outside-date + extension fields into a single
                    // readable string. Other cells render normally.
                    if (isTermrFamily && k === 'mainConcept') {
                      const synth = buildTermrOutsideTermText(p);
                      if (synth) {
                        return (
                          <td key={k} className="px-3 py-2 align-top max-w-[420px] text-ink">
                            <div className="whitespace-pre-wrap break-words">{synth}</div>
                          </td>
                        );
                      }
                    }
                    // Tagged value (single object) — render JUST the resolved
                    // label (the canonical phrase) without the code badge.
                    // The code badge is redundant noise for table cells
                    // where the label already communicates the standard.
                    if (isTaggedItem(raw)) {
                      const label = resolveTaggedLabel(k, raw) || raw.code;
                      return (
                        <td
                          key={k}
                          className="px-3 py-2 align-top max-w-[260px] text-ink"
                        >
                          <span>{label}</span>
                        </td>
                      );
                    }
                    const cell = formatCellValue(k, raw);
                    return (
                      <td
                        key={k}
                        className={`px-3 py-2 align-top max-w-[260px] ${
                          cell === null ? 'text-inkFaint/70 italic' : 'text-ink'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {cell === null ? '—' : cell}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FULL DOCUMENT VIEW — renders raw agreement text with
   provision-position highlight overlays. Reads like EDGAR.
   ═══════════════════════════════════════════════════════════ */
function FullDocumentView({
  sourceText,
  title,
  provisions,
  onEditProvision,
  hoveredProvId,
  onHoverProv,
  reselectingProvLabel,
  isReselecting,
  onConfirmReselect,
  onCancelReselect,
  highlightedQuote,
  highlightedQuoteNonce,
}) {
  const containerRef = useRef(null);
  const [reselectSelection, setReselectSelection] = useState(null);

  /* ── Stage 5: evidence-quote highlight overlay.
   *    When `highlightedQuote` is set, scan the DOM after render for the
   *    quote text (case-insensitive, whitespace-tolerant), wrap the first
   *    match in a transient yellow span, scroll it into view, and remove
   *    the overlay after a few seconds. */
  useEffect(() => {
    if (!highlightedQuote || !containerRef.current) return undefined;
    const root = containerRef.current;
    const target = String(highlightedQuote).trim();
    if (!target) return undefined;

    // Use whitespace-tolerant matching by working off a normalized version
    // of each text node's data and remembering original offsets.
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    const needle = normalize(target);
    if (!needle) return undefined;
    const needleLower = needle.toLowerCase();

    // Find the FIRST text-node range containing the needle. For simplicity
    // we restrict to per-text-node matches (covers ~99% of quotes which are
    // short, in-paragraph excerpts). A more elaborate cross-node match is
    // possible but not worth the complexity here.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let foundNode = null;
    let foundIdx = -1;
    let n;
    while ((n = walker.nextNode())) {
      const nodeText = n.data;
      if (!nodeText) continue;
      const normalized = normalize(nodeText).toLowerCase();
      const idx = normalized.indexOf(needleLower);
      if (idx >= 0) {
        // Map normalized index back to raw index (best-effort).
        // Walk nodeText, skipping consecutive whitespace, until we've
        // consumed `idx` normalized characters.
        let normPos = 0;
        let rawPos = 0;
        let prevSpace = true;
        while (rawPos < nodeText.length && normPos < idx) {
          const ch = nodeText[rawPos];
          if (/\s/.test(ch)) {
            if (!prevSpace) { normPos++; prevSpace = true; }
          } else {
            normPos++;
            prevSpace = false;
          }
          rawPos++;
        }
        // Now find end position by consuming needle length normalized chars.
        let endRaw = rawPos;
        let consumed = 0;
        prevSpace = true;
        while (endRaw < nodeText.length && consumed < needle.length) {
          const ch = nodeText[endRaw];
          if (/\s/.test(ch)) {
            if (!prevSpace) { consumed++; prevSpace = true; }
          } else {
            consumed++;
            prevSpace = false;
          }
          endRaw++;
        }
        if (endRaw > rawPos) {
          foundNode = n;
          foundIdx = rawPos;
          // Stash end position via closure
          n.__hlEnd = endRaw;
          break;
        }
      }
    }

    if (!foundNode) return undefined;

    let span;
    try {
      const range = document.createRange();
      range.setStart(foundNode, foundIdx);
      range.setEnd(foundNode, foundNode.__hlEnd);
      span = document.createElement('span');
      span.className = 'bg-yellow-200 ring-1 ring-yellow-400 rounded px-0.5';
      span.dataset.evidenceHighlight = '1';
      range.surroundContents(span);
      // Scroll into view
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Pulse animation via inline style transition
      span.style.transition = 'background-color 1.6s ease-out';
      setTimeout(() => {
        if (span && span.style) {
          // Keep some highlight but soften after pulse
          span.style.backgroundColor = '';
        }
      }, 1800);
    } catch {
      // Range surroundContents can throw if the range crosses element
      // boundaries — silently skip in that rare case.
    }

    return () => {
      // Cleanup: unwrap the span on unmount or when the quote changes.
      if (span && span.parentNode) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
      }
    };
    // Re-run when the quote changes OR when the same quote is re-clicked
    // (nonce bump forces re-mount of the highlight even if quote is identical).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedQuote, highlightedQuoteNonce, sourceText]);

  // Track selection while in re-select mode
  useEffect(() => {
    if (!isReselecting) {
      setReselectSelection(null);
      return undefined;
    }

    const handleSelectionChange = () => {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (!sel || sel.isCollapsed) {
        setReselectSelection(null);
        return;
      }
      const text = sel.toString();
      if (!text || !text.trim()) {
        setReselectSelection(null);
        return;
      }
      // Must be inside our document container
      if (!containerRef.current || !sel.anchorNode || !containerRef.current.contains(sel.anchorNode)) {
        return;
      }
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setReselectSelection({ text, rect });
      } catch {
        setReselectSelection(null);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (typeof window !== 'undefined') {
          const sel = window.getSelection();
          if (sel) sel.removeAllRanges();
        }
        setReselectSelection(null);
        if (onCancelReselect) onCancelReselect();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isReselecting, onCancelReselect]);

  const handleConfirmReselect = () => {
    if (!reselectSelection || !onConfirmReselect) return;
    const text = reselectSelection.text;
    if (typeof window !== 'undefined') {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }
    setReselectSelection(null);
    onConfirmReselect(text);
  };

  // Detect whether the stored text uses our formatting markers. If so we
  // render structured blocks; otherwise we fall back to the legacy <pre>
  // rendering for older deals ingested before formatting was added.
  const isFormatted = useMemo(
    () => !!sourceText && sourceText.includes('[[') && sourceText.includes(']]'),
    [sourceText]
  );

  // Plain text version of the source (no markers). Used to locate provision
  // text via indexOf without the markers throwing off positions.
  const plainText = useMemo(
    () => (sourceText ? (isFormatted ? stripFormattingMarkers(sourceText) : sourceText) : ''),
    [sourceText, isFormatted]
  );

  // Parsed block structure (only used when isFormatted).
  const blocks = useMemo(
    () => (isFormatted ? parseFormattedDocument(sourceText) : []),
    [sourceText, isFormatted]
  );

  // Build highlight regions as offsets into the plain (marker-stripped) text.
  // Both the structured renderer and the legacy <pre> rely on these.
  //
  // Strategy: match SHORTEST provisions first (they're more specific — e.g.
  // a 200-char DEF that lives inside a 5000-char NOSOL). Allow overlapping
  // regions; the renderer layers them so shorter (more specific) provisions
  // sit on top of longer ones.
  //
  // Tolerant matching, in order: explicit char positions (legacy unformatted
  // ingests only) → exact case-insensitive → whitespace-normalized → first 200
  // chars (signature) → first 60 chars → "SECTION X.XX" header for provisions
  // that begin with a section heading.
  const { regions, unmatched } = useMemo(() => {
    if (!plainText) return { regions: [], unmatched: [] };

    const lowerSource = plainText.toLowerCase();

    // Pre-compute whitespace-normalized source. We keep an index map from
    // normalized offset → original offset so we can translate matches back.
    const normMap = [];
    let normalizedSource = '';
    {
      let prevWasSpace = false;
      for (let i = 0; i < plainText.length; i++) {
        const ch = plainText[i];
        const isWs = /\s/.test(ch);
        if (isWs) {
          if (!prevWasSpace) {
            normalizedSource += ' ';
            normMap.push(i);
            prevWasSpace = true;
          }
        } else {
          normalizedSource += ch.toLowerCase();
          normMap.push(i);
          prevWasSpace = false;
        }
      }
      // sentinel so normMap[normalizedSource.length] is valid
      normMap.push(plainText.length);
    }

    const normalize = (s) => {
      let out = '';
      let prevWasSpace = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const isWs = /\s/.test(ch);
        if (isWs) {
          if (!prevWasSpace) {
            out += ' ';
            prevWasSpace = true;
          }
        } else {
          out += ch.toLowerCase();
          prevWasSpace = false;
        }
      }
      return out.trim();
    };

    // Match against the normalized source and translate back. Returns
    // [start, end] in original plainText offsets, or null.
    const findNormalized = (needle) => {
      const n = normalize(needle);
      if (!n) return null;
      const idx = normalizedSource.indexOf(n);
      if (idx < 0) return null;
      const start = normMap[idx];
      const endNorm = idx + n.length;
      const end = normMap[Math.min(endNorm, normMap.length - 1)];
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return [start, end];
    };

    // Match a provision against the source using a cascade of strategies.
    // Returns { start, end, strategy } or null.
    const matchProvision = (p) => {
      // Legacy explicit positions, only when source is not formatted.
      if (!isFormatted) {
        const explicitStart = p.start_char ?? p.startChar;
        const explicitEnd = p.end_char ?? p.endChar;
        if (
          Number.isFinite(explicitStart) &&
          Number.isFinite(explicitEnd) &&
          explicitStart >= 0 &&
          explicitEnd <= plainText.length &&
          explicitEnd > explicitStart
        ) {
          return { start: explicitStart, end: explicitEnd, strategy: 'explicit' };
        }
      }

      const pText = (p.full_text || '').trim();
      if (!pText) return null;

      // 1. Exact case-insensitive.
      const exactIdx = lowerSource.indexOf(pText.toLowerCase());
      if (exactIdx >= 0) {
        return { start: exactIdx, end: exactIdx + pText.length, strategy: 'exact' };
      }

      // 2. Whitespace-normalized full text.
      const normHit = findNormalized(pText);
      if (normHit) {
        return { start: normHit[0], end: normHit[1], strategy: 'normalized' };
      }

      // 3. First 200-char signature, normalized. Use the actual provision
      //    length so the highlight covers what the AI extracted.
      if (pText.length > 200) {
        const sig = pText.substring(0, 200);
        const sigHit = findNormalized(sig);
        if (sigHit) {
          const end = Math.min(sigHit[0] + pText.length, plainText.length);
          return { start: sigHit[0], end, strategy: 'signature-200' };
        }
      }

      // 4. First 60-char signature for shorter provisions.
      if (pText.length > 60) {
        const sig = pText.substring(0, 60);
        const sigHit = findNormalized(sig);
        if (sigHit) {
          const end = Math.min(sigHit[0] + pText.length, plainText.length);
          return { start: sigHit[0], end, strategy: 'signature-60' };
        }
      }

      // 5. "SECTION X.XX" header. If the provision begins with a section
      //    number, find that section header in the document.
      const sectionMatch = pText.match(/^(SECTION\s+\d+\.\d+|Section\s+\d+\.\d+|ARTICLE\s+[IVXLCDM]+|Article\s+[IVXLCDM]+)/);
      if (sectionMatch) {
        const header = sectionMatch[0];
        // Look case-sensitively (sections are usually all-caps) then fallback.
        let hIdx = plainText.indexOf(header);
        if (hIdx < 0) hIdx = lowerSource.indexOf(header.toLowerCase());
        if (hIdx >= 0) {
          const end = Math.min(hIdx + pText.length, plainText.length);
          return { start: hIdx, end, strategy: 'section-header' };
        }
      }

      // 6. Defined-term anchor — DEF provisions usually start with `"Term"`.
      const defMatch = pText.match(/^\s*[“"]([^"”]+)[”"]\s+(?:shall mean|means|has the meaning)/i);
      if (defMatch) {
        const term = defMatch[1];
        // Search for the quoted term in the source.
        const candidates = [`"${term}"`, `“${term}”`, `"${term}"`];
        for (const c of candidates) {
          const cIdx = plainText.indexOf(c);
          if (cIdx >= 0) {
            const end = Math.min(cIdx + pText.length, plainText.length);
            return { start: cIdx, end, strategy: 'defined-term' };
          }
        }
      }

      return null;
    };

    // Sort by full_text length ASCENDING so shorter (more specific) provisions
    // claim their positions first. Provisions with no text sort last.
    const ordered = [...provisions].sort((a, b) => {
      const aLen = (a.full_text || '').length || Infinity;
      const bLen = (b.full_text || '').length || Infinity;
      return aLen - bLen;
    });

    const matched = [];
    const notMatched = [];
    ordered.forEach((p) => {
      const hit = matchProvision(p);
      if (hit) {
        matched.push({ start: hit.start, end: hit.end, provision: p, strategy: hit.strategy });
      } else {
        notMatched.push(p);
      }
    });

    // Sort matched regions for rendering. Primary: start ascending.
    // Secondary: end descending (so the longest region containing this
    // start is emitted first, ahead of shorter nested regions). The
    // renderer assumes this ordering when layering.
    matched.sort((a, b) => a.start - b.start || b.end - a.end);

    return { regions: matched, unmatched: notMatched };
  }, [plainText, provisions, isFormatted]);

  // Collapsible unmatched-provisions panel toggle.
  const [showUnmatched, setShowUnmatched] = useState(false);

  if (!sourceText) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm p-8 text-center">
        <p className="text-inkFaint font-ui text-sm">
          No raw agreement text stored for this deal.
        </p>
        <p className="text-inkFaint font-ui text-xs mt-2">
          Re-ingest the agreement to populate the Full Document view.
        </p>
      </div>
    );
  }

  // Build alternating segments for the legacy <pre> renderer (used when the
  // stored text does not contain formatting markers — i.e. older ingests).
  // Regions may overlap, so we slice at every breakpoint and emit one span
  // per atomic slice, layered by nesting innermost (shortest) on top.
  const segments = [];
  if (!isFormatted) {
    // Collect all breakpoints.
    const breakpoints = new Set([0, plainText.length]);
    regions.forEach((r) => {
      breakpoints.add(Math.max(0, r.start));
      breakpoints.add(Math.min(plainText.length, r.end));
    });
    const bps = Array.from(breakpoints).sort((a, b) => a - b);

    for (let i = 0; i < bps.length - 1; i++) {
      const segStart = bps[i];
      const segEnd = bps[i + 1];
      if (segEnd <= segStart) continue;
      const covering = regions.filter((r) => r.start <= segStart && r.end >= segEnd);
      if (covering.length === 0) {
        segments.push({ type: 'text', content: plainText.slice(segStart, segEnd), key: `t-${segStart}` });
      } else {
        // Innermost (shortest) provision wins as the foreground highlight.
        const innermost = covering.reduce((best, r) =>
          (r.end - r.start) < (best.end - best.start) ? r : best
        );
        segments.push({
          type: 'highlight',
          content: plainText.slice(segStart, segEnd),
          provision: innermost.provision,
          layers: covering.length,
          key: `h-${segStart}-${innermost.provision.id || ''}`,
        });
      }
    }
  }

  // Render helper for highlighted text within a block. Handles overlapping
  // regions by slicing at every breakpoint and rendering the innermost
  // (shortest) provision as the visible highlight for each slice. Outer
  // (larger) provisions still receive a click-target via the wrapping span,
  // but the visual foreground is the most specific provision.
  const renderHighlightedText = (rawText, blockOffset) => {
    if (!rawText) return null;
    const blockEnd = blockOffset + rawText.length;
    const local = regions.filter((r) => r.start < blockEnd && r.end > blockOffset);
    if (local.length === 0) return rawText;

    // Breakpoints inside this block.
    const bpSet = new Set([blockOffset, blockEnd]);
    local.forEach((r) => {
      bpSet.add(Math.max(blockOffset, r.start));
      bpSet.add(Math.min(blockEnd, r.end));
    });
    const bps = Array.from(bpSet).sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < bps.length - 1; i++) {
      const segStart = bps[i];
      const segEnd = bps[i + 1];
      if (segEnd <= segStart) continue;
      const covering = local.filter((r) => r.start <= segStart && r.end >= segEnd);
      const text = plainText.slice(segStart, segEnd);
      if (covering.length === 0) {
        out.push(<span key={`pt-${segStart}`}>{text}</span>);
        continue;
      }
      // Innermost (shortest) is the visible highlight.
      const innermost = covering.reduce((best, r) =>
        (r.end - r.start) < (best.end - best.start) ? r : best
      );
      const p = innermost.provision;
      const tHex = typeHex(p.type);
      const isHovered = hoveredProvId === p.id;
      // When this slice is covered by multiple regions, show a faint
      // gutter-stack indicator to hint at nesting depth.
      const stackBorders = covering.length > 1
        ? `inset ${2 + (covering.length - 1) * 2}px 0 0 ${tHex}`
        : `inset 2px 0 0 ${tHex}`;
      out.push(
        <span
          key={`ph-${segStart}-${p.id || i}`}
          id={`prov-${p.id}`}
          onClick={(ev) => { ev.stopPropagation(); onEditProvision(p); }}
          onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
          onMouseLeave={() => onHoverProv && onHoverProv(null)}
          className="relative cursor-pointer transition-colors rounded-sm"
          style={{
            backgroundColor: isHovered
              ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
              : 'var(--accent-soft)',
            boxShadow: stackBorders,
            paddingLeft: '3px',
            paddingRight: '2px',
          }}
          title={
            covering.length > 1
              ? `${typeLabel(p.type)} -- ${p.category || 'General'} (${covering.length} overlapping provisions)`
              : `${typeLabel(p.type)} -- ${p.category || 'General'}`
          }
        >
          {text}
        </span>
      );
    }
    return out;
  };

  // Walk parsed blocks and compute the running offset of each block's plain
  // text content within `plainText`. Used so we know where in the global
  // offset space each block's inline content lives, so we can intersect with
  // provision regions for highlighting.
  const renderInlineTokens = (inlineTokens, startOffset) => {
    if (!inlineTokens) return null;
    const out = [];
    let off = startOffset;
    inlineTokens.forEach((tok, i) => {
      const t = tok.text || '';
      if (tok.type === 'ref') {
        out.push(<span key={`r-${i}`} className="doc-ref">{renderHighlightedText(t, off)}</span>);
      } else if (tok.type === 'defined') {
        out.push(<span key={`d-${i}`} className="doc-defined">{renderHighlightedText(t, off)}</span>);
      } else {
        out.push(<span key={`t-${i}`}>{renderHighlightedText(t, off)}</span>);
      }
      off += t.length;
    });
    return out;
  };

  // Walk blocks producing React nodes and tracking the offset into plainText.
  const renderBlocks = (blockList) => {
    const nodes = [];
    let cursor = 0;
    // The plainText has identical leading content to each block in order; we
    // sync up by searching for each block's leading characters from `cursor`.
    // This is robust against whitespace differences between blocks and the
    // joined plain text.

    const blockPlainLen = (b) => {
      if (b.type === 'paragraph' || b.type === 'section') {
        return (b.inline || []).reduce((s, t) => s + (t.text || '').length, 0)
          + (b.type === 'section' ? (b.number.length + b.title.length + 4) : 0);
      }
      if (b.type === 'article') return b.number.length + b.title.length + 1;
      if (b.type === 'article_title') return b.text.length;
      if (b.type === 'center') return b.text.length;
      if (b.type === 'toc') return 0; // handled separately
      return 0;
    };

    blockList.forEach((b, i) => {
      if (b.type === 'article') {
        nodes.push(
          <div key={`a-${i}`} className="doc-article">
            <div className="text-center font-display text-xl font-bold mt-10 mb-1 tracking-wider">
              {b.number}
            </div>
            {b.title && (
              <div className="text-center font-display text-lg mb-6 italic">
                {b.title}
              </div>
            )}
          </div>
        );
        // Advance cursor past this block's plain text (best-effort).
        const consume = `${b.number}${b.title ? '\n' + b.title : ''}`;
        const idx = plainText.indexOf(consume, cursor);
        if (idx >= 0) cursor = idx + consume.length;
      } else if (b.type === 'article_title') {
        nodes.push(
          <div key={`at-${i}`} className="text-center font-display text-lg mb-6 italic">
            {b.text}
          </div>
        );
        const idx = plainText.indexOf(b.text, cursor);
        if (idx >= 0) cursor = idx + b.text.length;
      } else if (b.type === 'center') {
        nodes.push(
          <div key={`c-${i}`} className="text-center font-display text-2xl mt-8 mb-6 tracking-wide">
            {b.text}
          </div>
        );
        const idx = plainText.indexOf(b.text, cursor);
        if (idx >= 0) cursor = idx + b.text.length;
      } else if (b.type === 'toc') {
        nodes.push(
          <div key={`toc-${i}`} className="doc-toc my-8 p-5 bg-bg/50 rounded-lg border border-border text-sm">
            {b.children.map((c, j) => {
              if (c.type === 'toc_heading') {
                return (
                  <div key={j} className="text-center font-display text-xl font-bold mb-4 tracking-wider">
                    {c.text}
                  </div>
                );
              }
              if (c.type === 'toc_article') {
                return (
                  <div key={j} className="mt-4 mb-1 text-center font-display font-bold">
                    {c.number}{c.title ? ` -- ${c.title}` : ''}
                  </div>
                );
              }
              if (c.type === 'toc_entry') {
                return (
                  <div key={j} className="flex items-baseline gap-2 py-0.5">
                    <span className="text-inkMid">{c.number}.</span>
                    <span className="flex-1 truncate">{c.title}</span>
                    {c.page && (
                      <>
                        <span className="flex-1 border-b border-dotted border-inkFaint/40 mx-1 mb-1" />
                        <span className="text-inkMid tabular-nums">{c.page}</span>
                      </>
                    )}
                  </div>
                );
              }
              if (c.type === 'toc_text') {
                return (
                  <div key={j} className="text-inkMid my-2">
                    {renderInlineTokens(c.inline, 0)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
        // Advance past the TOC region. The TOC blocks in plainText end before
        // the body preamble ("This AGREEMENT...") or the first body ARTICLE.
        const tocStart = plainText.indexOf('TABLE OF CONTENTS', cursor);
        if (tocStart >= 0) {
          const candidates = [
            plainText.indexOf('This AGREEMENT', tocStart + 'TABLE OF CONTENTS'.length),
            plainText.indexOf('ARTICLE I\n', tocStart + 'TABLE OF CONTENTS'.length),
            plainText.indexOf('WHEREAS', tocStart + 'TABLE OF CONTENTS'.length),
          ].filter(x => x > 0);
          cursor = candidates.length > 0
            ? Math.min(...candidates)
            : tocStart + 'TABLE OF CONTENTS'.length;
        }
      } else if (b.type === 'section') {
        // Find offset of section heading in plainText
        const headingStr = `${b.number} ${b.title}`.trim();
        // Sync cursor on the section number
        const idx = plainText.indexOf(b.number, cursor);
        if (idx >= 0) cursor = idx;
        const sectionStart = cursor;
        // Section body inline text starts after "number title. " (roughly)
        // We render headings as their own styled elements then body inline.
        // Compute inlineStart = offset where the inline text begins.
        // In plainText, the section likely reads: "SECTION X.XX. Title. body..."
        // Skip past number + title in plainText:
        const numLen = b.number.length;
        let inlineStart = sectionStart + numLen;
        // skip whitespace + title + ". " sequence
        const after = plainText.substring(inlineStart);
        const titleIdx = b.title ? after.indexOf(b.title) : -1;
        if (titleIdx >= 0) {
          inlineStart += titleIdx + b.title.length;
          // skip optional ". "
          while (inlineStart < plainText.length && /[. \n]/.test(plainText[inlineStart])) {
            inlineStart++;
          }
        }
        cursor = inlineStart;
        const inlineLen = (b.inline || []).reduce((s, t) => s + (t.text || '').length, 0);
        nodes.push(
          <p key={`s-${i}`} className="my-3 leading-relaxed">
            <span className="font-bold font-display">{b.number} </span>
            {b.title && <span className="font-bold">{b.title}. </span>}
            {renderInlineTokens(b.inline, cursor)}
          </p>
        );
        cursor += inlineLen;
      } else if (b.type === 'paragraph') {
        const text = (b.inline || []).map(t => t.text || '').join('');
        const idx = text ? plainText.indexOf(text.substring(0, Math.min(80, text.length)), cursor) : -1;
        if (idx >= 0) cursor = idx;
        const inlineStart = cursor;
        nodes.push(
          <p key={`p-${i}`} className="my-3 leading-relaxed">
            {renderInlineTokens(b.inline, inlineStart)}
          </p>
        );
        cursor += text.length;
      }
    });

    return nodes;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm">
      {/* Re-select banner */}
      {isReselecting && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-xs font-ui text-amber-800">
            Select the correct text for <span className="font-semibold">{reselectingProvLabel || 'provision'}</span>{' '}
            -- click and drag to highlight, then click &quot;Use Selection&quot;.
          </div>
          <button
            type="button"
            onClick={onCancelReselect}
            className="px-2 py-1 text-[11px] font-ui border border-amber-300 text-amber-800 rounded hover:bg-amber-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Document header bar (EDGAR-style) */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg/40">
        <div>
          <p className="font-ui text-[10px] uppercase tracking-wider text-inkFaint">
            Agreement
          </p>
          <p className="font-display text-sm text-ink">{title || 'Agreement'}</p>
        </div>
        <div className="text-[10px] font-ui text-inkFaint text-right">
          <div>
            {regions.length} of {provisions.length} provisions highlighted &middot;{' '}
            {sourceText.length.toLocaleString()} chars
          </div>
          {unmatched.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnmatched((v) => !v)}
              className="mt-0.5 underline decoration-dotted hover:text-ink transition-colors"
            >
              {showUnmatched ? 'Hide' : 'Show'} {unmatched.length} unmatched
            </button>
          )}
        </div>
      </div>

      {/* Unmatched provisions list — collapsible */}
      {showUnmatched && unmatched.length > 0 && (
        <div className="border-b border-border px-6 py-3 bg-amber-50/40 max-h-48 overflow-y-auto">
          <p className="font-ui text-[10px] uppercase tracking-wider text-amber-800 mb-2">
            Unmatched provisions ({unmatched.length})
          </p>
          <ul className="space-y-1">
            {unmatched.map((p) => {
              const tc = typeColor(p.type);
              const preview = (p.full_text || '').trim().slice(0, 100);
              return (
                <li key={p.id} className="text-[11px] font-ui flex items-start gap-2">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border shrink-0 ${tc.border} ${tc.bg} ${tc.text}`}
                  >
                    {typeLabel(p.type)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditProvision(p)}
                    className="text-left text-inkMid hover:text-ink transition-colors truncate"
                    title={p.full_text || ''}
                  >
                    <span className="text-ink">{p.category || 'General'}</span>
                    {preview && <span className="text-inkFaint"> — {preview}{preview.length === 100 ? '…' : ''}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Document body */}
      <div ref={containerRef} className="p-6 md:p-12 max-h-[80vh] overflow-y-auto">
        {isFormatted ? (
          <div
            className="max-w-3xl mx-auto text-[15px] text-ink leading-[1.75]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {renderBlocks(blocks)}
          </div>
        ) : (
          <pre
            className="text-[14px] text-ink leading-[1.7] whitespace-pre-wrap break-words m-0"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {segments.map(seg => {
              if (seg.type === 'text') {
                return <span key={seg.key}>{seg.content}</span>;
              }
              const p = seg.provision;
              const tHex = typeHex(p.type);
              const fav = favBadge(p.ai_favorability);
              const isHovered = hoveredProvId === p.id;
              const layers = seg.layers || 1;
              const stackBorders = layers > 1
                ? `inset ${2 + (layers - 1) * 2}px 0 0 ${tHex}`
                : `inset 2px 0 0 ${tHex}`;
              return (
                <span
                  key={seg.key}
                  id={`prov-${p.id}`}
                  onClick={(e) => { e.stopPropagation(); onEditProvision(p); }}
                  onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
                  onMouseLeave={() => onHoverProv && onHoverProv(null)}
                  className="relative cursor-pointer transition-colors rounded-sm"
                  style={{
                    backgroundColor: isHovered
                      ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                      : 'var(--accent-soft)',
                    boxShadow: stackBorders,
                    paddingLeft: '4px',
                    paddingRight: '2px',
                  }}
                  title={
                    layers > 1
                      ? `${typeLabel(p.type)} -- ${p.category || 'General'} (${layers} overlapping provisions)`
                      : `${typeLabel(p.type)} -- ${p.category || 'General'}`
                  }
                >
                  {isHovered && (
                    <span
                      className={`absolute z-20 -top-6 left-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border whitespace-nowrap shadow-sm ${tc.border} ${tc.bg} ${tc.text}`}
                      style={{ fontFamily: 'inherit' }}
                    >
                      <span>{typeLabel(p.type)}</span>
                      <span className="text-inkFaint">&middot;</span>
                      <span>{p.category || 'General'}</span>
                      <span className={`ml-1 px-1 rounded ${fav.cls}`}>{fav.label}</span>
                    </span>
                  )}
                  {seg.content}
                </span>
              );
            })}
          </pre>
        )}
      </div>

      {/* Floating "Use This Text" button while re-selecting */}
      {isReselecting && reselectSelection && reselectSelection.rect && (
        <div
          style={{
            position: 'fixed',
            top: reselectSelection.rect.bottom + 8,
            left: Math.max(
              8,
              reselectSelection.rect.left + (reselectSelection.rect.width / 2) - 80
            ),
            zIndex: 60,
          }}
          className="animate-slide-up"
        >
          <button
            onMouseDown={(e) => { e.preventDefault(); handleConfirmReselect(); }}
            className="px-4 py-2 text-xs font-ui bg-accent text-white rounded-lg shadow-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-6" />
            </svg>
            Use This Text
          </button>
        </div>
      )}
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
   FEATURE FIELD EDITOR
   Renders an editable input matched to a rubric feature schema entry.
   Supported types: text, boolean, enum, tagged, list, list-tagged,
   currency, percentage, duration, object, tiers (and unknown → JSON).
   ═══════════════════════════════════════════════════════════ */
// Constant marker for the "Other / not applicable" escape hatch. We store
// the picker selection as this sentinel and emit a free-text payload only
// when the user explicitly opts into it. We deliberately do NOT silently
// fall back to text when a taxonomy is available — the user has to choose.
const EDIT_OTHER_CODE = '__OTHER__';

function FeatureFieldEditor({ field, value, onChange }) {
  const label = humanizeKey(field.key);
  const taxonomy = taxonomyForFeatureKey(field.key);
  const taxonomyEntries = taxonomy ? Object.entries(taxonomy) : null;

  // Citable fields are edited as { value, text }. The picker / input below
  // edits the INNER value; we add a dedicated evidence textarea beneath. We
  // delegate to a recursive editor by unwrapping the value, swapping in a
  // wrapping onChange that re-builds { value, text }.
  if (field.citable && !taxonomy) {
    const wrapped = isCitableValue(value) ? value : { value: value ?? null, text: '' };
    const innerField = { ...field, citable: false };
    const onInnerChange = (next) => {
      if (next === null && !wrapped.text) {
        onChange(null);
        return;
      }
      onChange({ value: next, text: wrapped.text || '' });
    };
    const onTextChange = (e) => {
      const text = e.target.value;
      if (text === '' && (wrapped.value === null || wrapped.value === undefined)) {
        onChange(null);
        return;
      }
      onChange({ value: wrapped.value ?? null, text });
    };
    return (
      <div className="space-y-1">
        <FeatureFieldEditor field={innerField} value={wrapped.value} onChange={onInnerChange} />
        <label className="block text-[10px] font-ui text-amber-700 italic">
          Evidence (verbatim quote from the agreement)
        </label>
        <textarea
          value={wrapped.text || ''}
          onChange={onTextChange}
          rows={2}
          placeholder="Paste the supporting sentence here..."
          className="w-full border border-amber-200 rounded px-2 py-1 text-[11px] font-ui bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>
    );
  }

  // Decide effective input type. Editor enforcement rules:
  //   1. If the field key has a taxonomy dictionary, ALWAYS render a picker
  //      (single or list). Free text is only available via an explicit
  //      "Other / not applicable" escape hatch.
  //   2. If the rubric declares type: 'enum' with options:[...], render a
  //      <select> of those options. Same Other escape hatch.
  //   3. Otherwise honor the rubric type.
  let effType = field.type || 'text';
  if (taxonomy && (effType === 'list' || effType === 'list-tagged' || isListTaxonomyKey(field.key))) {
    effType = 'list-tagged';
  } else if (taxonomy) {
    // single tagged. Covers type: 'text' on a taxonomy-backed key too — the
    // editor must force the picker, even if the legacy schema says text.
    effType = 'tagged';
  }

  const labelEl = (
    <label className="block text-[11px] font-ui text-inkLight mb-0.5" title={field.label || label}>
      {label}
    </label>
  );

  // ── Helper renderer: code picker + Other escape hatch ────────────────
  // Used by both the single-tagged and list-tagged paths. `current` is the
  // current item ({code,label,text} or null). `onPick` is called with the
  // next item (or null when cleared).
  const renderTaggedPicker = (current, onPick, opts = {}) => {
    const small = !!opts.small;
    const inputCls = small
      ? 'w-full border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white'
      : 'w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white';
    const txtCls = small
      ? 'flex-1 border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent'
      : 'w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent';

    const item = current && typeof current === 'object'
      ? current
      : { code: '', label: '', text: '' };

    // Has the user opted into Other-mode for this row? We detect it from
    // the stored item: code === EDIT_OTHER_CODE OR (code is empty but text
    // is non-empty AND not a known dictionary code).
    const hasKnownCode = !!(item.code && taxonomy && taxonomy[item.code]);
    const isOther = item.code === EDIT_OTHER_CODE || (!hasKnownCode && !!item.text);

    const pickValue = isOther ? EDIT_OTHER_CODE : (item.code || '');

    return (
      <div className="space-y-1">
        <select
          value={pickValue}
          onChange={(e) => {
            const choice = e.target.value;
            if (choice === '') {
              // cleared — drop the item
              onPick(null);
              return;
            }
            if (choice === EDIT_OTHER_CODE) {
              onPick({ ...item, code: EDIT_OTHER_CODE, label: 'Other / not applicable' });
              return;
            }
            // a real dictionary code
            onPick({ ...item, code: choice, label: (taxonomy && taxonomy[choice]) || '' });
          }}
          className={inputCls}
        >
          <option value="">-- select code --</option>
          {taxonomyEntries && taxonomyEntries.map(([code, lbl]) => (
            <option key={code} value={code}>{code} -- {lbl}</option>
          ))}
          <option value={EDIT_OTHER_CODE}>-- Other / not applicable (free text) --</option>
        </select>
        {isOther && (
          <p className="text-[10px] font-ui text-amber-700 italic">
            Other selected. This value will not be comparable across deals.
          </p>
        )}
        <input
          value={item.text || ''}
          onChange={(e) => {
            const text = e.target.value;
            // Preserve current code/Other selection.
            const nextCode = item.code || (text ? EDIT_OTHER_CODE : '');
            const nextLabel = nextCode === EDIT_OTHER_CODE
              ? 'Other / not applicable'
              : (taxonomy && taxonomy[nextCode]) || item.label || '';
            onPick(text || nextCode ? { ...item, code: nextCode, label: nextLabel, text } : null);
          }}
          placeholder="Verbatim text from agreement..."
          className={txtCls}
        />
      </div>
    );
  };

  // Boolean
  if (effType === 'boolean') {
    const checked = value === true;
    return (
      <div>
        <label className="flex items-center gap-2 text-xs font-ui text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-border focus:ring-1 focus:ring-accent"
          />
          <span title={field.label || label}>{label}</span>
        </label>
      </div>
    );
  }

  // Enum (no taxonomy, plain options[]) — render select w/ Other escape hatch.
  if (effType === 'enum' && Array.isArray(field.options)) {
    const isKnown = field.options.includes(value);
    const isOther = !isKnown && value != null && value !== '';
    const pickValue = isOther ? EDIT_OTHER_CODE : (value == null ? '' : String(value));
    return (
      <div className="space-y-1">
        {labelEl}
        <select
          value={pickValue}
          onChange={(e) => {
            const choice = e.target.value;
            if (choice === '') return onChange(null);
            if (choice === EDIT_OTHER_CODE) {
              onChange(typeof value === 'string' ? value : '');
              return;
            }
            onChange(choice);
          }}
          className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
        >
          <option value="">--</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          <option value={EDIT_OTHER_CODE}>-- Other / not applicable (free text) --</option>
        </select>
        {isOther && (
          <>
            <p className="text-[10px] font-ui text-amber-700 italic">
              Other selected. This value will not be comparable across deals.
            </p>
            <input
              value={value == null ? '' : String(value)}
              onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
              placeholder="Free-text value..."
              className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </>
        )}
      </div>
    );
  }

  // Single tagged value: { code, label, text } — taxonomy-enforced picker.
  if (effType === 'tagged') {
    const item = isTaggedItem(value)
      ? value
      : (value && typeof value === 'string'
        ? { code: EDIT_OTHER_CODE, label: 'Other / not applicable', text: value }
        : { code: '', label: '', text: '' });
    return (
      <div>
        {labelEl}
        {taxonomyEntries
          ? renderTaggedPicker(item, (next) => onChange(next), { small: false })
          : (
            // No taxonomy in scope — fall back to plain text input but with
            // the tagged shape so the rest of the renderer is consistent.
            <input
              value={item.text || ''}
              onChange={(e) => {
                const text = e.target.value;
                onChange(text ? { code: '', label: '', text } : null);
              }}
              placeholder="Verbatim text from agreement..."
              className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            />
          )}
      </div>
    );
  }

  // List of tagged items — each item gets its own picker.
  if (effType === 'list-tagged') {
    const items = Array.isArray(value) ? value : [];
    const update = (idx, next) => {
      const copy = items.slice();
      if (next === null) copy.splice(idx, 1);
      else copy[idx] = next;
      onChange(copy);
    };
    const add = () => onChange([...items, { code: '', label: '', text: '' }]);
    return (
      <div>
        {labelEl}
        <div className="space-y-1.5">
          {items.length === 0 && (
            <p className="text-[11px] font-ui text-inkFaint italic">None</p>
          )}
          {items.map((it, idx) => {
            const itemObj = isTaggedItem(it)
              ? it
              : (typeof it === 'string'
                ? { code: EDIT_OTHER_CODE, label: 'Other / not applicable', text: it }
                : { code: '', label: '', text: '' });
            return (
              <div key={idx} className="border border-border rounded p-1.5 space-y-1 bg-white">
                {taxonomyEntries
                  ? renderTaggedPicker(itemObj, (next) => update(idx, next), { small: true })
                  : (
                    <input
                      value={itemObj.text || ''}
                      onChange={(e) => update(idx, { ...itemObj, text: e.target.value })}
                      placeholder="Verbatim text..."
                      className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => update(idx, null)}
                    className="px-1.5 py-0.5 text-[11px] font-ui text-inkFaint hover:text-seller border border-border rounded"
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={add}
            className="w-full px-2 py-1 text-[11px] font-ui border border-dashed border-border text-inkMid rounded hover:bg-bg/50 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // Plain list (strings)
  if (effType === 'list') {
    const items = Array.isArray(value) ? value : [];
    const update = (idx, next) => {
      const copy = items.slice();
      if (next === null) copy.splice(idx, 1);
      else copy[idx] = next;
      onChange(copy);
    };
    return (
      <div>
        {labelEl}
        <div className="space-y-1">
          {items.length === 0 && (
            <p className="text-[11px] font-ui text-inkFaint italic">None</p>
          )}
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-1">
              <input
                value={typeof it === 'string' ? it : (it == null ? '' : JSON.stringify(it))}
                onChange={(e) => update(idx, e.target.value)}
                className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => update(idx, null)}
                className="px-1.5 py-0.5 text-[11px] font-ui text-inkFaint hover:text-seller border border-border rounded"
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="w-full px-2 py-1 text-[11px] font-ui border border-dashed border-border text-inkMid rounded hover:bg-bg/50 transition-colors"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // Currency / percentage / duration
  if (effType === 'currency' || effType === 'percentage' || effType === 'duration') {
    const placeholder = effType === 'currency' ? 'e.g. $25,000,000'
      : effType === 'percentage' ? 'e.g. 5%'
      : 'e.g. 30 days';
    return (
      <div>
        {labelEl}
        <input
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : v);
          }}
          placeholder={placeholder}
          className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    );
  }

  // Object / tiers / unknown structured: JSON textarea fallback
  if (effType === 'object' || effType === 'tiers' || (value && typeof value === 'object')) {
    const display = value == null ? '' : JSON.stringify(value, null, 2);
    return (
      <div>
        {labelEl}
        <textarea
          value={display}
          onChange={(e) => {
            const t = e.target.value;
            if (t.trim() === '') { onChange(null); return; }
            try {
              onChange(JSON.parse(t));
            } catch {
              // Preserve in-progress invalid JSON as a string so the user can fix it.
              onChange(t);
            }
          }}
          rows={4}
          className="w-full border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="JSON value"
        />
      </div>
    );
  }

  // Default: plain text
  return (
    <div>
      {labelEl}
      <input
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v);
        }}
        className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
      />
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
  onReselectText,
}) {
  const [editType, setEditType] = useState(provision?.type || '');
  const [editCategory, setEditCategory] = useState(provision?.category || '');
  const [editFav, setEditFav] = useState(provision?.ai_favorability || 'neutral');
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  // Structured (schema-driven) feature edits — keyed by feature key.
  const [editedFeatures, setEditedFeatures] = useState({});
  // Initial structured features snapshot, used for dirty detection.
  const [initialFeatures, setInitialFeatures] = useState({});

  // Read-only display value (always reflects the current provision text)
  const currentFullText = provision?.full_text || '';

  useEffect(() => {
    if (provision) {
      setEditType(provision.type || '');
      setEditCategory(provision.category || '');
      setEditFav(provision.ai_favorability || 'neutral');
      setFeatures(getFeatures(provision));
      setReason('');
      const structured = getStructuredFeatures(provision) || {};
      // Deep clone via JSON so subsequent mutations don't reach back into
      // the raw provision payload.
      const cloned = JSON.parse(JSON.stringify(structured));
      setEditedFeatures(cloned);
      setInitialFeatures(JSON.parse(JSON.stringify(structured)));
    }
  }, [provision]);

  // Schema-driven feature list for the active type/code.
  const featureSchema = useMemo(() => {
    if (!provision) return [];
    return getFeaturesForType(editType || provision.type, provision.code) || [];
  }, [editType, provision]);

  // Dedupe by key — some rubric entries (e.g. IOC permittedExceptions) appear
  // twice with different scopes; the editor only needs one row per key.
  const dedupedSchema = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const f of featureSchema) {
      if (!f || !f.key || seen.has(f.key)) continue;
      seen.add(f.key);
      out.push(f);
    }
    return out;
  }, [featureSchema]);

  const featuresDirty = useMemo(() => {
    return JSON.stringify(editedFeatures || {}) !== JSON.stringify(initialFeatures || {});
  }, [editedFeatures, initialFeatures]);

  const classificationDirty = useMemo(() => {
    if (!provision) return false;
    return (
      (provision.type || '') !== editType ||
      (provision.category || '') !== editCategory ||
      (provision.ai_favorability || 'neutral') !== editFav
    );
  }, [provision, editType, editCategory, editFav]);

  const isDirty = featuresDirty || classificationDirty;

  const setFeatureValue = (key, value) => {
    setEditedFeatures((prev) => ({ ...prev, [key]: value }));
  };

  const filteredCategories = useMemo(() => {
    if (!editType || !allCategories) return [];
    return allCategories.filter(c =>
      c.provision_type?.key === editType
    ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [editType, allCategories]);

  const handleSave = async () => {
    if (!provision?.id) return;
    setSaving(true);
    try {
      const payload = {
        id: provision.id,
        type: editType,
        category: editCategory,
        ai_favorability: editFav,
        reason: reason.trim() || undefined,
      };
      if (featuresDirty) {
        // Only ship the features sub-object — the API merges it into the
        // existing ai_metadata so other keys (rubric_code, etc.) are preserved.
        payload.ai_metadata = { features: editedFeatures };
      }
      await onSave(payload);
    } catch {
      // parent already surfaced a toast; keep panel open so the user can retry
    } finally {
      setSaving(false);
    }
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
            <label className="block text-xs font-ui text-inkLight mb-1">Term</label>
            {filteredCategories.length > 0 ? (
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white"
              >
                <option value="">Select term...</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.label}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                placeholder="Term name"
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

        {/* Provision Text (read-only — boundary changes via Re-select Text) */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Provision Text</h4>
          <label className="block text-xs font-ui text-inkLight mb-1">Current text</label>
          <div
            className={`w-full p-3 rounded border ${tc.border} ${tc.bg} font-body text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto`}
          >
            {currentFullText || <span className="italic text-inkFaint">(no text)</span>}
          </div>
          <p className="text-[10px] font-ui text-inkFaint">
            {`${currentFullText.length} characters`}
            {' '}-- text is read-only to keep it aligned with the agreement source
          </p>
          <button
            type="button"
            onClick={() => onReselectText && onReselectText(provision)}
            className="w-full px-3 py-1.5 text-xs font-ui border border-accent/40 text-accent rounded hover:bg-accent/5 transition-colors"
          >
            Re-select Text from Document
          </button>
        </div>

        {/* Structured Summary (schema-driven editable fields) */}
        {dedupedSchema.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Structured Summary</h4>
            <div className="space-y-2">
              {dedupedSchema.map((field) => (
                <FeatureFieldEditor
                  key={field.key}
                  field={field}
                  value={editedFeatures[field.key]}
                  onChange={(v) => setFeatureValue(field.key, v)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Features (legacy free-text chips for forward-compat / non-schema fields) */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Tags</h4>
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
              list={`feature-keys-${provision.id}`}
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              placeholder="Add tag..."
              className="flex-1 border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
              onKeyDown={e => e.key === 'Enter' && addFeature()}
            />
            {/* Autocomplete from rubric FEATURES for this provision type so
                features are uniformly coded across deals on ingest. */}
            <datalist id={`feature-keys-${provision.id}`}>
              {getFeatureSchema(editType || provision.type, provision.code).map((k) => (
                <option key={k} value={k}>{humanizeKey(k)}</option>
              ))}
            </datalist>
            <button
              onClick={addFeature}
              disabled={!newFeature.trim()}
              className="px-2 py-1 text-xs font-ui bg-bg border border-border rounded hover:bg-border/50 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Correction Reason (optional, fuels the learning system) */}
        <div className="space-y-2">
          <h4 className="font-ui text-xs font-medium text-inkFaint uppercase tracking-wider">Why this change?</h4>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Optional — helps train future suggestions"
            className="w-full border border-border rounded px-3 py-1.5 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
          />
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
            disabled={saving || !isDirty}
            className="flex-1 px-3 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={!isDirty ? 'No changes to save' : undefined}
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
  // When set, sidebar single-provision click filters the main view to just that one provision
  const [selectedProvId, setSelectedProvId] = useState(null);

  /* ── Tab state: "provisions" or "document" ── */
  const [activeTab, setActiveTab] = useState('provisions');

  /* ── Stage 5: highlight a verbatim quote in the Full Document tab.
   *    Set by EvidenceQuote click; consumed by FullDocumentView. */
  const [highlightedQuote, setHighlightedQuote] = useState(null);
  const [highlightedQuoteNonce, setHighlightedQuoteNonce] = useState(0);
  const showEvidence = useCallback((quote) => {
    if (!quote || typeof quote !== 'string') return;
    setHighlightedQuote(quote);
    setHighlightedQuoteNonce((n) => n + 1);
    setActiveTab('document');
  }, []);
  const evidenceCtxValue = useMemo(() => ({ showEvidence }), [showEvidence]);

  /* ── Provisions sub-view: "cards" or "table" ── */
  const [provisionView, setProvisionView] = useState('table');

  // Stable type sort order derived from SIDEBAR_GROUPS so the main view
  // mirrors the sidebar layout (Structure → Consideration → Reps → IOC → ...).
  const TYPE_SORT_ORDER = useMemo(() => {
    const order = new Map();
    let idx = 0;
    for (const g of SIDEBAR_GROUPS) {
      if (Array.isArray(g.children)) {
        for (const child of g.children) {
          if (child && child.type && !order.has(child.type)) order.set(child.type, idx++);
        }
      } else if (Array.isArray(g.types)) {
        for (const t of g.types) {
          if (!order.has(t)) order.set(t, idx++);
        }
      }
    }
    return order;
  }, []);

  const sortByTypeOrder = useCallback((arr) => {
    return [...arr].sort((a, b) => {
      const aIdx = TYPE_SORT_ORDER.has(a.type) ? TYPE_SORT_ORDER.get(a.type) : 9999;
      const bIdx = TYPE_SORT_ORDER.has(b.type) ? TYPE_SORT_ORDER.get(b.type) : 9999;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return 0;
    });
  }, [TYPE_SORT_ORDER]);

  /* ── Filtered provisions based on sidebar selection ── */
  const filteredProvisions = useMemo(() => {
    // Single-provision view wins over type filter
    if (selectedProvId) {
      const one = provisions.find(p => p.id === selectedProvId);
      return one ? [one] : [];
    }
    if (activeFilter === null) {
      // "All Provisions" — render in sidebar order so the page mirrors the nav.
      return sortByTypeOrder(provisions);
    }
    const filterTypes = Array.isArray(activeFilter) ? activeFilter : [activeFilter];
    return sortByTypeOrder(provisions.filter(p => filterTypes.includes(p.type)));
  }, [provisions, activeFilter, selectedProvId, sortByTypeOrder]);

  /* ── Group provisions by type (all, not filtered) ──
     Preserves natural insertion order (which mirrors document order) but
     enforces TERMR-M → TERMR-B → TERMR-T ordering for the three party-specific
     termination-rights groups so the sidebar reads Mutual → Buyer → Target. */
  const provsByType = useMemo(() => {
    const groups = groupProvisionsByType(provisions);
    // Synthesize a MAE-DEF group from any provision (DEF or REP-T) whose
    // category matches the MAE definition. The user wants MAE as its own
    // standalone section (not buried inside REP-T).
    const maeProvs = (provisions || []).filter(isMaeDefinitionProvision);
    if (maeProvs.length > 0) {
      groups['MAE-DEF'] = maeProvs;
    }
    return groups;
  }, [provisions]);

  /* ── Group filtered provisions by type ── */
  const filteredProvsByType = useMemo(() => groupProvisionsByType(filteredProvisions), [filteredProvisions]);

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
  const [hoveredProvId, setHoveredProvId] = useState(null);
  const provisionRefs = useRef({});

  /* ── Re-select Text mode ── */
  const [reselectingProvId, setReselectingProvId] = useState(null);
  const [reselectingProvLabel, setReselectingProvLabel] = useState('');

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

  /* ── Sidebar filter handler — accepts a single type, an array of types
   *     (for parent-group "show all children combined" clicks), or null
   *     to clear the filter. */
  const handleFilterType = useCallback((type) => {
    // Normalize: empty array → null; single-element array → string
    let next = type;
    if (Array.isArray(type)) {
      if (type.length === 0) next = null;
      else if (type.length === 1) next = type[0];
    }
    setActiveFilter(next);
    setSelectedProvId(null); // clear single-provision view when changing type filter
    // When clicking a category title, default to the Table view so the user
    // sees all provisions of that type as rows side-by-side.
    if (next !== null) setProvisionView('table');
  }, []);

  /* ── Sidebar provision click — show ONLY that provision in the main view ── */
  const handleSidebarSelectProvision = useCallback((provId) => {
    setSelectedProvId(provId);
    const prov = provisions.find(p => p.id === provId);
    if (prov) {
      setActiveFilter(prov.type);
      // Auto-open the right edit panel so a single sidebar click on a
      // provision swaps the right-side toolbar to the editor for that item.
      setEditingProvision(prov);
      setExpandedLabel(null);
    }
    // Single-provision selection should use the card view so the user can
    // see the full structured summary + collapsible text for that one item.
    setProvisionView('cards');
  }, [provisions]);

  /* ── Edit provision ── */
  const handleEditProvision = useCallback((provision) => {
    setEditingProvision(provision);
    setExpandedLabel(null);
  }, []);

  /* ── Save edits ── */
  const handleSaveProvision = useCallback(async (updates) => {
    if (!updates || !updates.id) {
      addToast('Error: missing provision id', 'error');
      throw new Error('missing provision id');
    }
    try {
      const resp = await fetch('/api/provisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      addToast('Provision updated', 'success');
      await refetchProvs();
      setEditingProvision(null);
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
      throw err;
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

  /* ── Drag-and-drop: move provision between sidebar categories ── */
  const handleMoveProvision = useCallback(async (provision, newType) => {
    if (!provision || !newType || provision.type === newType) return;
    try {
      const resp = await fetch('/api/provisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provision.id, type: newType, category: '' }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      addToast(`Moved to ${typeLabel(newType)}`, 'success');
      await refetchProvs();
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  }, [addToast, refetchProvs]);

  /* ── Propose New Code ── */
  const handleProposeCode = useCallback((provision) => {
    addToast('New code proposal submitted for review', 'info');
    setEditingProvision(null);
  }, [addToast]);

  /* ── Re-select Text: enter mode ── */
  const handleReselectText = useCallback((provision) => {
    if (!provision || !provision.id) return;
    const label = `${typeLabel(provision.type)} -- ${provision.category || 'General'}`;
    setReselectingProvId(provision.id);
    setReselectingProvLabel(label);
    setEditingProvision(null);
    setActiveTab('document');
  }, []);

  /* ── Re-select Text: exit mode ── */
  const handleCancelReselect = useCallback(() => {
    setReselectingProvId(null);
    setReselectingProvLabel('');
  }, []);

  /* ── Re-select Text: confirm with new text ── */
  const handleConfirmReselect = useCallback(async (newText) => {
    const provId = reselectingProvId;
    if (!provId || !newText || !newText.trim()) return;
    try {
      const resp = await fetch('/api/provisions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provId, full_text: newText }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      addToast('Provision text updated', 'success');
      await refetchProvs();
      setReselectingProvId(null);
      setReselectingProvLabel('');
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    }
  }, [reselectingProvId, addToast, refetchProvs]);

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
    <EvidenceContext.Provider value={evidenceCtxValue}>
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header
        className="bg-surface border-b border-line flex items-center justify-between shrink-0"
        style={{ height: 56, padding: '0 22px' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="rec-wordmark">
            <span className="mark" />
            Recital
            <span className="tag">Precedent</span>
          </Link>
          <div className="flex items-center gap-2 text-[12.5px] text-inkFaint">
            <span style={{ color: 'var(--line)' }}>/</span>
            <Link href="/deals" className="text-inkFaint hover:text-ink transition-colors">
              Deals
            </Link>
            <span style={{ color: 'var(--line)' }}>/</span>
            <Link href={`/deals/${id}`} className="text-inkFaint hover:text-ink transition-colors">
              {dealLabel}
            </Link>
            <span style={{ color: 'var(--line)' }}>/</span>
            <span className="text-inkMid font-medium">Review</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-inkLight hover:text-ink transition-colors rounded hover:bg-paper"
            title="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="14" height="12" rx="1" />
              <path d="M5 2v12" />
            </svg>
          </button>
          {user && (
            <>
              <span className="text-[12.5px] text-inkLight">{user.name}</span>
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
                {(user.name || 'U').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </>
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
            onMoveProvision={handleMoveProvision}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '34px 40px 120px' }}>
            {/* Deal Header */}
            <div style={{ marginBottom: 26 }}>
              <div className="rec-deal-eyebrow">
                {deal.agreement_type || 'Merger Agreement'}
                {deal.announce_date && (
                  <> · {new Date(deal.announce_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</>
                )}
              </div>
              <h1 className="rec-deal-title">
                {deal.acquirer} <span className="vs">acquires</span> {deal.target}
              </h1>
              {Array.isArray(deal.metadata?.advisors) && deal.metadata.advisors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 8, marginBottom: 8 }}>
                  {deal.metadata.advisors.map((a, idx) => {
                    const partyLabel =
                      a.party === 'parent' ? 'Parent'
                      : a.party === 'company' ? 'Company'
                      : a.party === 'special_committee' ? 'Special Committee'
                      : null;
                    const roleLabel = a.role ? a.role.charAt(0).toUpperCase() + a.role.slice(1) : '';
                    return (
                      <span
                        key={`${a.firm}-${a.party}-${idx}`}
                        title={`${a.firm}${a.partner ? ' — ' + a.partner : ''} (${roleLabel}${partyLabel ? ', ' + partyLabel : ''})`}
                        style={{
                          fontFamily: 'inherit',
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid #d4d2cd',
                          background: '#fafaf8',
                          color: '#3a3633',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{a.firm.replace(/, LLP$/, '').replace(/ LLP$/, '')}</span>
                        {partyLabel && <span style={{ color: '#8a8782' }}> · {partyLabel}</span>}
                        {a.partner && <span style={{ color: '#8a8782' }}> · {a.partner}</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="rec-deal-meta">
                {deal.sector && (
                  <div className="m">
                    <span className="k">Sector</span>
                    <span className="v">{deal.sector}</span>
                  </div>
                )}
                {deal.value_usd && (
                  <div className="m">
                    <span className="k">Value</span>
                    <span className="v">${(deal.value_usd / 1e9).toFixed(1)}B</span>
                  </div>
                )}
                {deal.structure && (
                  <div className="m">
                    <span className="k">Structure</span>
                    <span className="v">{deal.structure}</span>
                  </div>
                )}
                {deal.governing_law && (
                  <div className="m">
                    <span className="k">Governing law</span>
                    <span className="v">{deal.governing_law}</span>
                  </div>
                )}
                <div className="m">
                  <span className="k">Classified</span>
                  <span className="v">
                    {provisions.length} provision{provisions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab System */}
            {provisions.length > 0 && (
              <div className="rec-tabs">
                <button
                  type="button"
                  onClick={() => setActiveTab('provisions')}
                  className={`rec-tab${activeTab === 'provisions' ? ' active' : ''}`}
                >
                  Provisions
                  <span className="badge-no">{provisions.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('document')}
                  className={`rec-tab${activeTab === 'document' ? ' active' : ''}`}
                  title={hasSource ? 'Raw agreement text with provision highlights' : 'Raw text not stored yet — re-ingest to populate'}
                >
                  Full Document
                  {!hasSource && (
                    <span className="ml-1.5 text-[10px] text-inkFaint">(no raw text)</span>
                  )}
                </button>

                {/* Cards | Table view toggle — only on Provisions tab */}
                {activeTab === 'provisions' && (
                  <div className="rec-view-toggle">
                    <button
                      type="button"
                      onClick={() => setProvisionView('cards')}
                      className={provisionView === 'cards' ? 'on' : ''}
                    >
                      Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvisionView('table')}
                      className={provisionView === 'table' ? 'on' : ''}
                    >
                      Table
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Filter chip */}
            {activeFilter && (() => {
              const isMulti = Array.isArray(activeFilter);
              let label;
              if (isMulti) {
                const sorted = [...activeFilter].sort().join(',');
                const match = SIDEBAR_GROUPS.find((g) => {
                  const childTypes = g.children
                    ? g.children.map((c) => c.type)
                    : (g.types || []);
                  return [...childTypes].sort().join(',') === sorted;
                });
                label = match ? `${match.label} (all)` : activeFilter.map(typeLabel).join(' + ');
              } else {
                label = typeLabel(activeFilter);
              }
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 18,
                    marginTop: -6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-light)',
                      letterSpacing: '.04em',
                    }}
                  >
                    Filtered · {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setActiveFilter(null); setSelectedProvId(null); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-deep)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    clear
                  </button>
                </div>
              );
            })()}

            {/* Tab Content */}
            {provisions.length > 0 ? (
              <>
                {/* Provisions Tab */}
                {activeTab === 'provisions' && (
                  <div className="space-y-4">

                    {Object.entries(filteredProvsByType).map(([type, provsRaw], typeIdx) => {
                      // Alphabetical sort for DEF so definitions read like a glossary.
                      const provs = type === 'DEF'
                        ? [...provsRaw].sort((a, b) =>
                            String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' })
                          )
                        : provsRaw;
                      const { preamble, rest: restAfterSplit } = splitPreamble(provs);
                      // Only show a preamble card for section-style types that
                      // have a meaningful structured preamble (e.g. IOC, REP-*,
                      // NOSOL, ANTI). Termination / Definitions / Misc / Other
                      // sections skip the preamble entirely — the preamble
                      // provision is suppressed from the table as well so it
                      // doesn't show up as a contentless "General / Preamble"
                      // row.
                      const showPreambleCard =
                        !!preamble && !SKIP_PREAMBLE_CARD_TYPES.has(type);
                      let rest;
                      if (showPreambleCard) {
                        rest = restAfterSplit;
                      } else if (SKIP_PREAMBLE_CARD_TYPES.has(type)) {
                        // Drop ALL preamble provisions (there may be more than
                        // one) from the table for these section types.
                        rest = provs.filter((p) => !isPreambleProvision(p));
                      } else {
                        rest = provs;
                      }
                      // For IOC: pull the consolidated "Affirmative Covenants"
                      // and "General Exceptions" provisions out of the main
                      // table and render them in a dedicated section above.
                      const isIocType = type === 'IOC' || type === 'IOC-T' || type === 'IOC-B';
                      let iocAffirmative = null;
                      let iocGeneralExceptions = null;
                      if (isIocType) {
                        const buckets = splitIocPreambleBuckets(rest);
                        iocAffirmative = buckets.affirmative;
                        iocGeneralExceptions = buckets.generalExceptions;
                        rest = buckets.rest;
                        // Also pull the per-bucket affirmative covenant sub-codes
                        // (IOC-ORDINARY / IOC-PRESERVE / IOC-MAINTAIN / etc.)
                        // out of the main table — they're shown in the
                        // Affirmative Covenants box above. Defensive guard:
                        // never pull a "No New Lines of Business" provision
                        // here — it's a NEGATIVE covenant and belongs in the
                        // sub-clause table below.
                        const affMatches = findIocAffirmativeMatches(rest)
                          .filter((m) => !isNoNewLinesOfBusiness(m.provision));
                        const pulledIds = new Set(affMatches.map((m) => m.provision.id));
                        if (pulledIds.size > 0) {
                          rest = rest.filter((p) => !pulledIds.has(p.id));
                        }
                      }
                      return (
                        <div key={type} className="space-y-2">
                          <div className="rec-type-head">
                            <span className="ix">{String(typeIdx + 1).padStart(2, '0')}</span>
                            <span className="th-dot" style={{ background: typeHex(type) }} />
                            <h2>{typeLabel(type)}</h2>
                            <span className="ct">{provs.length}</span>
                            <span className="rule" />
                          </div>
                          {/* COV (Other Covenants) renders the PW diligence
                              summary table in 'table' view (via
                              CategoryFeatureSummaryTable inside ProvisionTable);
                              cards view continues to render the per-provision
                              ProvisionCard stack unchanged. */}
                          {(provisionView === 'table') ? (
                            <div className="space-y-3">
                              {showPreambleCard && (
                                <PreambleCard
                                  provision={preamble}
                                  onEdit={handleEditProvision}
                                />
                              )}
                              {isIocType && (
                                <IocAffirmativeCovenantsTable
                                  iocProvisions={provs}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {isIocType && (
                                <IocGeneralExceptionsTable
                                  iocProvisions={provs}
                                  generalExceptionsProv={iocGeneralExceptions}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {(type === 'REP-T' || type === 'REP-B') && (
                                <BringdownTable
                                  provisions={provisions}
                                  repsType={type}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {(type === 'REP-T' || type === 'REP-B') && (
                                <RepKnowledgeNote provisions={rest} />
                              )}
                              {(type === 'REP-T' || type === 'REP-B') && (
                                <RepGeneralExceptionsTable provisions={rest} />
                              )}
                              {type === 'REP-T' && (
                                <RepMaterialContractsTable
                                  provisions={rest}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {type === 'MAE-DEF' && (
                                <MaeDefinitionSummary
                                  allProvisions={provisions}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {rest.length > 0 && type === 'DEF' && (
                                <DefinitionsList
                                  provisions={rest}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {type !== 'DEF' && type !== 'MAE-DEF' && (() => {
                                const restAugmented = (type === 'REP-T' || type === 'REP-B')
                                  ? augmentRepsWithExpectedPlaceholders(rest, type, provisions)
                                  : rest;
                                if (!restAugmented || restAugmented.length === 0) return null;
                                return (
                                  <ProvisionTable
                                    provisions={restAugmented}
                                    type={type}
                                    onSelectProvision={handleEditProvision}
                                  />
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Employee Benefits Treatment table now
                                  renders INSIDE each Employee Benefits
                                  ProvisionCard, so no top-level injection
                                  here — avoids the duplicate render. */}
                              {provs.map(p => (
                                <ProvisionCard
                                  key={p.id}
                                  provision={p}
                                  onEdit={handleEditProvision}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredProvisions.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-inkFaint font-ui">No provisions match this filter.</p>
                        <button
                          onClick={() => { setActiveFilter(null); setSelectedProvId(null); }}
                          className="text-accent text-sm font-ui hover:underline mt-2"
                        >
                          Show all provisions
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Document Tab — raw agreement text with highlighted provisions */}
                {activeTab === 'document' && (
                  <FullDocumentView
                    sourceText={hasSource ? agreementSource.full_text : null}
                    title={hasSource ? agreementSource.title : null}
                    provisions={filteredProvisions}
                    onEditProvision={handleEditProvision}
                    hoveredProvId={hoveredProvId}
                    onHoverProv={setHoveredProvId}
                    isReselecting={!!reselectingProvId}
                    reselectingProvLabel={reselectingProvLabel}
                    onConfirmReselect={handleConfirmReselect}
                    onCancelReselect={handleCancelReselect}
                    highlightedQuote={highlightedQuote}
                    highlightedQuoteNonce={highlightedQuoteNonce}
                  />
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
            onReselectText={handleReselectText}
          />
        )}
      </div>

      {/* Floating Create Provision Button (hidden while re-selecting text) */}
      {!reselectingProvId && (
        <CreateProvisionButton
          selection={textSelection}
          onCreateProvision={handleCreateProvision}
        />
      )}

      {/* Definition Tooltip */}
      <DefinitionTooltip def={hoveredDef} position={defPosition} />
    </div>
    </EvidenceContext.Provider>
  );
}
