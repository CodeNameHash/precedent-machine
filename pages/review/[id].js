import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { getFeaturesForType } from '../../lib/rubric';

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
function humanizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatFeatureValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v;
  return String(v);
}

/* ── Per-type field display order — drives StructuredFeatures layout ── */
const FEATURE_DISPLAY_ORDER = {
  IOC: [
    'mainObligation', 'consentStandard', 'dollarThreshold', 'effortsStandard',
    'materialityQualifier', 'scheduleReference',
    'ordinaryCourseCarveout', 'requiredByLawCarveout', 'pandemicCarveout',
    'permittedExceptions', 'crossReferences',
  ],
  'COND-M': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  'COND-B': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'maeConditionStandalone', 'certificationRequired', 'dollarThreshold', 'dissentingSharesThreshold', 'scheduleReference'],
  'COND-S': ['mainCondition', 'bringDownStandard', 'tieredBringDown', 'tiers', 'fundsCondition', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  COND: ['mainCondition'],
  NOSOL: ['mainConcept', 'noticePeriod', 'matchingPeriod', 'subsequentMatching', 'subsequentMatchingPeriod', 'goShopWindow', 'informationRights', 'confidentialityRequired', 'fiduciaryOutStandard', 'fiduciaryCarveoutThreshold', 'superiorProposalPercentage', 'interveningEventProvision', 'standstillWaiver', 'dontAskDontWaive'],
  ANTI: ['mainConcept', 'effortsStandard', 'hellOrHighWater', 'divestitureCap', 'divestitureCapDescription', 'litigationObligation', 'partyControlsStrategy', 'filingDeadline', 'foreignFilingsRequired', 'interimOperatingRestrictions', 'pullAndRefileRight', 'burdensomConditionDefined'],
  TERMR: ['mainConcept', 'partyWhoCanTerminate', 'terminationTriggers', 'curePeriod', 'outsideDate', 'outsideDateMonths', 'extensionAvailable', 'extensionPeriod', 'extensionTrigger', 'superiorProposalTermination', 'faultBasedExclusion', 'tickingFee'],
  TERMF: ['mainConcept', 'triggerEvents', 'feeAmount', 'feePercentage', 'reverseFeeAmount', 'reverseFeePercentage', 'tailPeriod', 'soleRemedy', 'willfulBreachException', 'expenseReimbursement', 'expenseReimbursementCap', 'nakedNoVoteFee'],
  DEF: ['mainConcept', 'canonicalTerm', 'definitionText', 'carveOuts', 'carveOutsList', 'disproportionateImpactClause', 'disproportionateImpact', 'disproportionateImpactScope', 'knowledgeStandard', 'knowledgePersons', 'ordinaryCourseQualifier', 'pandemicCarveout', 'cyberSecurityCarveout', 'superiorProposalPercentage', 'acquisitionProposalPercentage', 'willfulBreachDefinition', 'crossReferences'],
  STRUCT: ['mainConcept', 'mergerForm', 'survivingEntity', 'closingConditionsPrecedent'],
  CONSID: ['mainConcept', 'considerationType', 'perShareAmount', 'exchangeRatio', 'equityAwardTreatment', 'outstandingInstruments', 'instrumentTreatments', 'vestingAcceleration', 'cutoffDate', 'cutoffTreatment', 'cashOutAmount', 'optionSpread', 'performanceTreatment', 'espp_treatment', 'parachuteCap', 'doubleTrigger', 'appraisalRightsAvailable', 'withholdingProvision', 'proration'],
  'REP-T': ['mainConcept', 'bringDownStandard', 'materialityQualifier', 'knowledgeQualifier', 'survivalPeriod', 'scheduleReference', 'crossReferences'],
  'REP-B': ['mainConcept', 'bringDownStandard', 'materialityQualifier', 'knowledgeQualifier', 'solvencyRepIncluded', 'financingRepIncluded', 'crossReferences'],
  COV: ['mainConcept', 'accessScope', 'indemnificationPeriod', 'employeeBenefitPeriod', 'financingCooperation', 'cvrIncluded'],
  MISC: ['mainConcept', 'governingLaw', 'jurisdictionExclusive', 'juryWaiver', 'specificPerformance', 'thirdPartyBeneficiaryExceptions'],
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
 *    when available, otherwise by the rubric's own order). */
function getFeatureSchema(typeKey) {
  const schema = getFeaturesForType(typeKey) || [];
  const schemaKeys = schema.map((f) => f.key);
  const order = FEATURE_DISPLAY_ORDER[typeKey] || [];
  const seen = new Set();
  const ordered = [];
  for (const k of order) {
    if (schemaKeys.includes(k)) {
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

/* ═══════════════════════════════════════════════════════════
   LEFT SIDEBAR — now acts as a FILTER, not a scroller
   ═══════════════════════════════════════════════════════════ */
function Sidebar({ provsByType, provisions, activeFilter, onFilterType, onSelectProvision, activeProvId }) {
  // Default to all categories collapsed
  const [collapsed, setCollapsed] = useState(() => {
    const init = {};
    Object.keys(provsByType).forEach(type => { init[type] = true; });
    return init;
  });
  const [allCollapsed, setAllCollapsed] = useState(true);

  const toggleType = (type) => {
    setCollapsed(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // When user clicks the category row, both filter AND expand it
  const handleCategoryClick = (type) => {
    onFilterType(type);
    // Expand it if currently collapsed
    if (collapsed[type]) {
      setCollapsed(prev => ({ ...prev, [type]: false }));
    }
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
                <div
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm font-ui transition-colors group cursor-pointer ${
                    isActiveFilter ? 'bg-accent/10' : 'hover:bg-bg'
                  }`}
                  onClick={() => handleCategoryClick(type)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {/* +/- toggle button — click to just expand/collapse without filtering */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleType(type); }}
                      className="w-5 h-5 flex items-center justify-center rounded text-inkFaint hover:text-ink hover:bg-bg shrink-0 font-mono text-sm leading-none"
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollapsed ? '+' : '–'}
                    </button>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${tc.dot}`} />
                    <span className={`font-medium truncate ${isActiveFilter ? 'text-accent' : 'text-ink'}`}>
                      {typeLabel(type)}
                    </span>
                    <span className="text-inkFaint text-xs">({provs.length})</span>
                  </span>
                </div>
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
   STRUCTURED FEATURES — renders the type-specific schema
   directly from ai_metadata.features. Falls back gracefully
   for older provisions that lack this payload.
   ═══════════════════════════════════════════════════════════ */
/* Small inline badge for a canonical taxonomy code (e.g. "WHOLLY_OWNED_SUB"). */
function CodeBadge({ code }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center font-ui font-medium text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap">
      {code}
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

function StructuredFeatures({ provision }) {
  const features = getStructuredFeatures(provision) || {};
  const exceptionLikeKeys = new Set(['permittedExceptions', 'carveOuts', 'carveOutsList']);

  // Schema keys for the provision type — always shown, with "—" if missing.
  const schemaKeys = getFeatureSchema(provision.type);

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
        {renderable.map(({ key, value, raw, empty, tiers }) => (
          <div
            key={key}
            className={`text-xs font-ui flex flex-col ${tiers ? 'sm:col-span-2' : ''}`}
          >
            <dt className="text-inkFaint">{humanizeKey(key)}</dt>
            <dd className={empty ? 'text-inkFaint/70 italic' : 'text-ink'}>
              {tiers ? (
                <BringDownTiersTable tiers={tiers} />
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
                <span className="text-ink">{value}</span>
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
const SECTION_REF_RE = /\b(Section\s+\d+(?:\.\d+)*[A-Za-z]?|Article\s+(?:[IVXLCDM]+|\d+))\b/g;

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
   PROVISION CARD — full text by default, structured summary opt-in
   ═══════════════════════════════════════════════════════════ */
function ProvisionCard({ provision, onEdit }) {
  const tc = typeColor(provision.type);
  const fav = favBadge(provision.ai_favorability);
  const status = getProvisionStatus(provision);
  const st = STATUS[status];
  const [showFullText, setShowFullText] = useState(false);

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

      {/* Structured summary ALWAYS at the top.
          For preamble entries, this surfaces section-wide shared fields
          (e.g. ordinaryCourseCarveout, requiredByLawCarveout) that are
          hidden on the non-preamble provisions of the same section. */}
      <div className="space-y-2">
        <StructuredFeatures provision={provision} />

        {/* Full text below — collapsible, default collapsed */}
        <div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowFullText((v) => !v); }}
            className="text-[10px] font-ui text-inkFaint hover:text-ink uppercase tracking-wider flex items-center gap-1"
          >
            <span>{showFullText ? '−' : '+'}</span>
            {showFullText ? 'Hide Full Text' : 'Show Full Text'}
          </button>
          {showFullText && (
            <div className="mt-2">
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
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROVISION TABLE — tabular view of all provisions of one type.
   Each row is a provision; columns are the type's feature keys.
   ═══════════════════════════════════════════════════════════ */
function formatCellValue(featureKey, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
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

function ProvisionTable({ provisions, type, onSelectProvision }) {
  const schemaKeys = getFeatureSchema(type);
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

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap sticky left-0 bg-bg/60 z-10">
                Category
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
              const features = getStructuredFeatures(p) || {};
              return (
                <tr key={p.id} className="hover:bg-bg/40 transition-colors">
                  <td className="px-3 py-2 align-top whitespace-nowrap sticky left-0 bg-white z-10">
                    <button
                      type="button"
                      onClick={() => onSelectProvision && onSelectProvision(p)}
                      className="text-left text-accent hover:underline font-medium"
                    >
                      {p.category || 'General'}
                    </button>
                  </td>
                  {columns.map((k) => {
                    const cell = formatCellValue(k, features[k]);
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
}) {
  const containerRef = useRef(null);
  const [reselectSelection, setReselectSelection] = useState(null);

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
  const regions = useMemo(() => {
    if (!plainText) return [];
    const found = [];
    const lowerSource = plainText.toLowerCase();
    const usedRanges = [];

    const ordered = [...provisions].sort((a, b) => {
      const aStart = a.start_char ?? a.startChar ?? a.sort_order ?? Infinity;
      const bStart = b.start_char ?? b.startChar ?? b.sort_order ?? Infinity;
      return aStart - bStart;
    });

    ordered.forEach(p => {
      // Use explicit positions only when not formatted — explicit indices
      // refer to the original raw text, not the marker-stripped form.
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
          found.push({ start: explicitStart, end: explicitEnd, provision: p });
          usedRanges.push([explicitStart, explicitEnd]);
          return;
        }
      }

      const pText = (p.full_text || '').trim();
      if (!pText) return;

      const searchFrom = usedRanges.length
        ? Math.max(...usedRanges.map(r => r[1]))
        : 0;

      const tryFind = (needle, from) =>
        lowerSource.indexOf(needle.toLowerCase(), from);

      let idx = tryFind(pText, searchFrom);
      let matchLen = pText.length;
      if (idx < 0) idx = tryFind(pText, 0);

      if (idx < 0 && pText.length > 120) {
        const chunk = pText.substring(0, 120);
        idx = tryFind(chunk, searchFrom);
        if (idx < 0) idx = tryFind(chunk, 0);
        if (idx >= 0) matchLen = Math.min(pText.length, plainText.length - idx);
      }

      if (idx >= 0) {
        found.push({ start: idx, end: idx + matchLen, provision: p });
        usedRanges.push([idx, idx + matchLen]);
      }
    });

    found.sort((a, b) => a.start - b.start || a.end - b.end);
    const deduped = [];
    for (const r of found) {
      const last = deduped[deduped.length - 1];
      if (!last || r.start >= last.end) deduped.push(r);
    }
    return deduped;
  }, [plainText, provisions, isFormatted]);

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
  const segments = [];
  if (!isFormatted) {
    let cursor = 0;
    regions.forEach((r, i) => {
      if (r.start > cursor) {
        segments.push({ type: 'text', content: plainText.slice(cursor, r.start), key: `t-${i}` });
      }
      segments.push({
        type: 'highlight',
        content: plainText.slice(r.start, r.end),
        provision: r.provision,
        key: `h-${r.provision.id || i}`,
      });
      cursor = r.end;
    });
    if (cursor < plainText.length) {
      segments.push({ type: 'text', content: plainText.slice(cursor), key: 'tail' });
    }
  }

  // Render helper for highlighted text within a block.
  const renderHighlightedText = (rawText, blockOffset) => {
    // blockOffset is the offset of rawText within plainText. Find regions that
    // intersect [blockOffset, blockOffset + rawText.length) and split.
    if (!rawText) return null;
    const end = blockOffset + rawText.length;
    const local = regions.filter(r => r.start < end && r.end > blockOffset);
    if (local.length === 0) return rawText;

    const out = [];
    let cur = blockOffset;
    local.forEach((r, idx) => {
      const s = Math.max(r.start, blockOffset);
      const e = Math.min(r.end, end);
      if (s > cur) out.push(<span key={`pt-${idx}`}>{plainText.slice(cur, s)}</span>);
      const p = r.provision;
      const tc = typeColor(p.type);
      const isHovered = hoveredProvId === p.id;
      out.push(
        <span
          key={`ph-${p.id || idx}`}
          id={`prov-${p.id}`}
          onClick={(ev) => { ev.stopPropagation(); onEditProvision(p); }}
          onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
          onMouseLeave={() => onHoverProv && onHoverProv(null)}
          className="relative cursor-pointer transition-colors rounded-sm"
          style={{
            backgroundColor: tc.hex || '#f9fafb',
            boxShadow: isHovered
              ? 'inset 3px 0 0 rgba(0,0,0,0.35)'
              : `inset 2px 0 0 ${tc.hex || '#e5e7eb'}`,
            paddingLeft: '3px',
            paddingRight: '2px',
          }}
          title={`${typeLabel(p.type)} -- ${p.category || 'General'}`}
        >
          {plainText.slice(s, e)}
        </span>
      );
      cur = e;
    });
    if (cur < end) out.push(<span key="pt-end">{plainText.slice(cur, end)}</span>);
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
        <div className="text-[10px] font-ui text-inkFaint">
          {regions.length} of {provisions.length} provisions highlighted &middot;{' '}
          {sourceText.length.toLocaleString()} chars
        </div>
      </div>

      {/* Document body */}
      <div ref={containerRef} className="p-6 md:p-12 max-h-[80vh] overflow-y-auto">
        {isFormatted ? (
          <div
            className="max-w-3xl mx-auto text-[15px] text-ink leading-[1.75]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {renderBlocks(blocks)}
          </div>
        ) : (
          <pre
            className="text-[14px] text-ink leading-[1.7] whitespace-pre-wrap break-words m-0"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {segments.map(seg => {
              if (seg.type === 'text') {
                return <span key={seg.key}>{seg.content}</span>;
              }
              const p = seg.provision;
              const tc = typeColor(p.type);
              const fav = favBadge(p.ai_favorability);
              const isHovered = hoveredProvId === p.id;
              return (
                <span
                  key={seg.key}
                  id={`prov-${p.id}`}
                  onClick={(e) => { e.stopPropagation(); onEditProvision(p); }}
                  onMouseEnter={() => onHoverProv && onHoverProv(p.id)}
                  onMouseLeave={() => onHoverProv && onHoverProv(null)}
                  className="relative cursor-pointer transition-colors rounded-sm"
                  style={{
                    backgroundColor: tc.hex || '#f9fafb',
                    boxShadow: isHovered
                      ? 'inset 3px 0 0 rgba(0,0,0,0.35)'
                      : `inset 2px 0 0 ${tc.hex || '#e5e7eb'}`,
                    paddingLeft: '4px',
                    paddingRight: '2px',
                  }}
                  title={`${typeLabel(p.type)} -- ${p.category || 'General'}`}
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

  // Read-only display value (always reflects the current provision text)
  const currentFullText = provision?.full_text || '';

  useEffect(() => {
    if (provision) {
      setEditType(provision.type || '');
      setEditCategory(provision.category || '');
      setEditFav(provision.ai_favorability || 'neutral');
      setFeatures(getFeatures(provision));
      setReason('');
    }
  }, [provision]);

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
      await onSave({
        id: provision.id,
        type: editType,
        category: editCategory,
        ai_favorability: editFav,
        reason: reason.trim() || undefined,
      });
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
  // When set, sidebar single-provision click filters the main view to just that one provision
  const [selectedProvId, setSelectedProvId] = useState(null);

  /* ── Tab state: "provisions" or "document" ── */
  const [activeTab, setActiveTab] = useState('provisions');

  /* ── Provisions sub-view: "cards" or "table" ── */
  const [provisionView, setProvisionView] = useState('table');

  /* ── Filtered provisions based on sidebar selection ── */
  const filteredProvisions = useMemo(() => {
    // Single-provision view wins over type filter
    if (selectedProvId) {
      const one = provisions.find(p => p.id === selectedProvId);
      return one ? [one] : [];
    }
    if (activeFilter === null) return provisions;
    return provisions.filter(p => p.type === activeFilter);
  }, [provisions, activeFilter, selectedProvId]);

  /* ── Group provisions by type (all, not filtered) ──
     Preserves natural insertion order (which mirrors document order) but
     enforces TERMR-M → TERMR-B → TERMR-T ordering for the three party-specific
     termination-rights groups so the sidebar reads Mutual → Buyer → Target. */
  const provsByType = useMemo(() => groupProvisionsByType(provisions), [provisions]);

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

  /* ── Sidebar filter handler ── */
  const handleFilterType = useCallback((type) => {
    setActiveFilter(type);
    setSelectedProvId(null); // clear single-provision view when changing type filter
    // When clicking a category title, default to the Table view so the user
    // sees all provisions of that type as rows side-by-side.
    if (type !== null) setProvisionView('table');
  }, []);

  /* ── Sidebar provision click — show ONLY that provision in the main view ── */
  const handleSidebarSelectProvision = useCallback((provId) => {
    setSelectedProvId(provId);
    const prov = provisions.find(p => p.id === provId);
    if (prov) setActiveFilter(prov.type);
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
                  title={hasSource ? 'Raw agreement text with provision highlights' : 'Raw text not stored yet — re-ingest to populate'}
                >
                  Full Document
                  {!hasSource && (
                    <span className="ml-1.5 text-[10px] text-inkFaint">(no raw text)</span>
                  )}
                </button>

                {/* Filter indicator */}
                {activeFilter && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-ui font-medium border ${typeColor(activeFilter).border} ${typeColor(activeFilter).bg} ${typeColor(activeFilter).text}`}>
                      Filtered: {typeLabel(activeFilter)}
                    </span>
                    <button
                      onClick={() => { setActiveFilter(null); setSelectedProvId(null); }}
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
                {/* Provisions Tab */}
                {activeTab === 'provisions' && (
                  <div className="space-y-4">
                    {/* Cards | Table view toggle */}
                    {filteredProvisions.length > 0 && (
                      <div className="flex items-center justify-end gap-1">
                        <div className="inline-flex border border-border rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setProvisionView('cards')}
                            className={`px-3 py-1 text-[11px] font-ui transition-colors ${
                              provisionView === 'cards'
                                ? 'bg-accent text-white'
                                : 'bg-white text-inkMid hover:bg-bg'
                            }`}
                          >
                            Cards
                          </button>
                          <button
                            type="button"
                            onClick={() => setProvisionView('table')}
                            className={`px-3 py-1 text-[11px] font-ui transition-colors border-l border-border ${
                              provisionView === 'table'
                                ? 'bg-accent text-white'
                                : 'bg-white text-inkMid hover:bg-bg'
                            }`}
                          >
                            Table
                          </button>
                        </div>
                      </div>
                    )}

                    {Object.entries(filteredProvsByType).map(([type, provs]) => {
                      const { preamble, rest } = splitPreamble(provs);
                      return (
                        <div key={type} className="space-y-2">
                          <h2 className="font-display text-lg text-ink flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${typeColor(type).dot}`} />
                            {typeLabel(type)}
                            <span className="text-sm font-ui text-inkFaint font-normal">({provs.length})</span>
                          </h2>
                          {provisionView === 'table' ? (
                            <div className="space-y-3">
                              {preamble && (
                                <div className="space-y-1">
                                  <h3 className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
                                    Section Overview
                                  </h3>
                                  <ProvisionCard
                                    provision={preamble}
                                    onEdit={handleEditProvision}
                                  />
                                </div>
                              )}
                              {rest.length > 0 && (
                                <ProvisionTable
                                  provisions={rest}
                                  type={type}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                            </div>
                          ) : (
                            provs.map(p => (
                              <ProvisionCard
                                key={p.id}
                                provision={p}
                                onEdit={handleEditProvision}
                              />
                            ))
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
  );
}
