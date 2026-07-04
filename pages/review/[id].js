import { useState, useEffect, useMemo, useCallback, useRef, useContext, createContext, Fragment } from 'react';
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
import { CATEGORY_SUMMARY_FEATURES } from '../../lib/category-summary-features';
import {
  CANONICAL_CONDITIONS_M,
  CANONICAL_CONDITIONS_B,
  CANONICAL_CONDITIONS_S,
  conditionRowMatches,
  conditionDetailLines,
  CONDITION_ABSENT_COPY,
} from '../../lib/canonical-conditions';
import {
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  labelForCode,
  MATERIAL_CONTRACT_BUCKET_CODES,
  MATERIAL_CONTRACT_BUCKET_META,
  IOC_CATEGORY_CODES,
  IOC_CATEGORY_META,
  IOC_AFFIRMATIVE_STANDARDS,
  IOC_AFFIRMATIVE_SCOPE_CODES,
  IOC_AFFIRMATIVE_SCOPE_META,
  COMMON_EXCEPTION_CODES,
  COMMON_EXCEPTION_META,
  EXCEPTION_CODES,
} from '../../lib/taxonomy';
import {
  getAiMetadata,
  getStructuredFeatures,
  isTaggedItem,
  resolveTaggedLabel,
  isCitableValue,
  getCitableValue,
  getCitableQuotes,
  getCitableText,
  resolveEvidence,
  evidenceQuote,
  TOOLTIP_MAX,
  EVIDENCE_SLICE,
} from '../../lib/citable';
import { normalizeTermfFeatures } from '../../lib/termf';
import { getFeaturesForType, PROVISION_TYPES } from '../../lib/rubric';
import { resolveEditFields } from '../../lib/edit-schema';
import { isCanonicalCode } from '../../lib/expected-sets';
import { AddSectionItem } from '../../components/review/AddSectionItem';
import { TrustStrip } from '../../components/review/TrustStrip';
import { useViewMode, ViewModeToggle } from '../../components/ViewModeContext';
import {
  EvidenceContext,
  useShowEvidence,
  EvidenceQuote,
  humanizeBadgeText,
  CodeBadge,
  HoverSource,
  renderListAsBullets,
  pickFirstNonEmpty,
  renderSummaryRowValue,
  typeHex,
  typeColor,
  getProvisionStatus,
  SIDEBAR_GROUPS,
  SYNTHETIC_SINGLE_PAGE_TYPES,
  typeLabel,
  TYPE_LABELS,
  favBadge,
  getFeatures,
  isEmptyValue,
  humanizeKey,
  CustomTaxonomyContext,
  Pill,
  REVIEW_LABEL_COL_W,
  CitableHover,
  prettifyEnumValue,
} from '../../components/review/shared';
import { NosolFourTables } from '../../components/review/NosolFourTables';
import { NoOtherRepsFraudTable } from '../../components/review/NoOtherRepsFraudTable';
import { DealNavContext, TermCell } from '../../components/review/TermCell';
import { DocPopUnder } from '../../components/review/DocPopUnder';
import {
  termCellHoverQuote,
  knowledgeQualifierDisplay,
  isErisaBenefitsRep,
  sortByAgreementOrder,
  parseSectionParts,
  compareSectionParts,
  extractCrossQualificationSentence,
  buildBringdownTierLines,
  resolveCertifiedConditions,
  buildOutsideDateExtensionDetail,
  buildAocNoMaeLimbText,
  buildAocCitedCovenantsText,
  selectIocGeneralExceptionsItems,
  buildIocRowDisplayLabels,
  dedupeIocExceptionEntries,
  truncateAtWordBoundary,
  filterProvisionsForViewMode,
} from '../../components/review/table-logic';
import { ConsidTable } from '../../components/review/ConsiderationTables';
import { Sidebar } from '../../components/review/Sidebar';
import { FullDocumentView } from '../../components/review/FullDocumentView';
import { EditPanel } from '../../components/review/EditPanel';






function typeTint(code, pct) {
  return `color-mix(in srgb, ${typeHex(code)} ${pct}%, transparent)`;
}

// Audit fix batch item 9: the per-row bullet dot used by the Conditions and
// Termination Rights tables is meant to read like the Reps tables' row dot
// ("same visual as the reps rows" — see TermrRebuiltSummary/CondSingleTable
// below), but both were wired to their OWN section-identity color
// (typeHex('TERMR') / typeHex(sec.family)) instead of the Reps green. Pull
// the exact green from the REP-T/REP-B type-color entry so it can't drift
// from whatever the reps rows use — this constant is ONLY for those two
// tables' row dots; every other typeHex(...) call (section headers, ref
// chips, sidebar) keeps its own section-identity color untouched.
const REP_ROW_DOT_GREEN = typeHex('REP-T');




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



/* ── Favorability hue + soft fill (Corpus) ── */
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


/* getAiMetadata + getStructuredFeatures now live in lib/citable.js (imported). */


/* isTaggedItem + resolveTaggedLabel now live in lib/citable.js (imported). */



function formatFeatureValue(v) {
  if (v === null || v === undefined) return null;
  // Citable shape { value, text } — unwrap to the inner value. Tagged items
  // have `code` so they're distinguished from citable wraps.
  if (isCitableValue(v)) return formatFeatureValue(v.value);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v;
  return String(v);
}

/* ─── formatDurationWithUnits ──
 *  Append a units suffix to a bare numeric duration based on the feature
 *  key. Returns "<N> <unit>" when both inputs make sense, or null otherwise.
 *  Callers pass the bare value (after unwrap) and the feature key so this
 *  helper can pick the right unit without per-call configuration. */
function formatDurationWithUnits(value, featureKey) {
  if (value === null || value === undefined || value === '') return null;
  // Already a string with units? Pass through.
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    // If the string already mentions a unit, return as-is.
    if (/\b(day|days|month|months|year|years|hour|hours|business\s+day)/i.test(t)) return t;
    // Bare numeric string ("12") — fall through to unit selection below.
    if (!/^\d+(\.\d+)?$/.test(t)) return t;
    value = Number(t);
  }
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const key = String(featureKey || '');
  let unit = null;
  // Exact keys first.
  const EXACT = {
    noticePeriod: 'business days',
    initialMatchPeriodDays: 'business days',
    subsequentMatchPeriodDays: 'business days',
    curePeriod: 'business days',
    matchingPeriod: 'business days',
    subsequentMatchingPeriod: 'business days',
    cureDays: 'business days',
    hsrFilingDeadlineBusinessDays: 'business days',
    substantialComplianceDeadlineDays: 'days',
    mutualClosingDeadlineAfterConditionsDays: 'business days',
    goShopPeriodDays: 'days',
    extendedNegotiatingPeriodDays: 'days',
    refileCapWithoutConsent: null, // count, not duration
    tailPeriod: 'months',
    outsideDateMonths: 'months',
    survivalPeriod: 'months',
    tailFeeWindowMonths: 'months',
    employeeBenefitPeriod: 'months',
    protectionPeriodMonths: 'months',
    postProtectionPeriodMonths: 'months',
    indemnificationPeriod: 'years',
    secFilingsLookbackMonths: 'months',
    leadInPeriodDays: 'business days',
  };
  if (key in EXACT) {
    unit = EXACT[key];
  } else if (/Months$/.test(key)) {
    unit = 'months';
  } else if (/Years$/.test(key)) {
    unit = 'years';
  } else if (/(Days|Period)$/.test(key)) {
    unit = 'business days';
  }
  if (!unit) return String(value);
  return `${value} ${unit}`;
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
  // mainCondition column dropped — replaced by the CanonicalConditionsTable
  // (one row per canonical condition, e.g. Stockholder Approval, HSR Clearance).
  'COND-M': ['bringDownStandard', 'tieredBringDown', 'tiers', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  'COND-B': ['bringDownStandard', 'tieredBringDown', 'tiers', 'maeConditionStandalone', 'certificationRequired', 'dollarThreshold', 'dissentingSharesThreshold', 'scheduleReference'],
  'COND-S': ['bringDownStandard', 'tieredBringDown', 'tiers', 'fundsCondition', 'certificationRequired', 'dollarThreshold', 'scheduleReference'],
  COND: [],
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
  // Metsera fb2 block 2b: Knowledge Qualifier sits NEXT TO Materiality
  // Qualifier (it used to fall to the last column because it wasn't listed
  // here — getFeatureSchema appends unlisted schema keys after the ordered
  // ones). Column order: Term | Materiality | Knowledge | ...rest.
  'REP-T': ['materialityQualifier', 'knowledgeQualifier', 'dollarThreshold', 'lookbackPeriod', 'specificFeatures'],
  'REP-B': ['materialityQualifier', 'knowledgeQualifier', 'dollarThreshold', 'lookbackPeriod', 'specificFeatures'],
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
  'MAE-DEF-P',
  'MISC',
  'STRUCT',
  'OTHER',
]);

/* ═══════════════════════════════════════════════════════════
   STRUCTURED FEATURES — renders the type-specific schema
   directly from ai_metadata.features. Falls back gracefully
   for older provisions that lack this payload.
   ═══════════════════════════════════════════════════════════ */
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
  // Citable { value, quotes|text } (e.g. dollarThreshold) — unwrap to the inner
  // value + show the supporting quote, instead of stringifying the wrapper to
  // "[object Object]".
  if (isCitableValue(value)) {
    const inner = getCitableValue(value);
    const ev = getCitableText(value);
    const shown = (inner === null || inner === undefined || (typeof inner === 'object'))
      ? '' : String(inner);
    return (
      <span className="inline-flex flex-col gap-0.5">
        {shown && <span className="text-ink">{shown}</span>}
        {ev && (
          <span className="font-body text-[11px] text-inkFaint italic leading-relaxed">
            &ldquo;{ev}&rdquo;
          </span>
        )}
      </span>
    );
  }
  // Never stringify a bare object to "[object Object]".
  if (value !== null && typeof value === 'object') return <span className="text-inkFaint/70 italic">—</span>;
  return <span className="text-ink">{String(value)}</span>;
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

function StructuredFeatures({ provision, allProvisions }) {
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
  const features = (() => {
    const raw = getStructuredFeatures(provision) || {};
    // P4 task 2: for REP-T/REP-B, derive linkedBringDownStandard at render
    // time from current COND-B-REP/COND-S-REP tiers. Falls back to the
    // stamped feature when no tier matches. This way edits to the COND
    // bring-down tiers propagate without re-ingest.
    if (
      provision &&
      (provision.type === 'REP-T' || provision.type === 'REP-B') &&
      Array.isArray(allProvisions)
    ) {
      const computed = computeBringDownStandardForRep(provision, allProvisions, provision.type);
      if (computed && computed.code) {
        return {
          ...raw,
          linkedBringDownStandard: { code: computed.code, label: computed.label || computed.code },
        };
      }
    }
    return raw;
  })();
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
/* ── Lead / headline derivation for the Corpus card ── */
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
  const { isEdit } = useViewMode();
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
          {/* Approved / Needs review / Unreviewed is the editor's QA workflow
              status, not deal content — editors only. */}
          {isEdit && <RecStatusTag status={status} />}
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

  // Proviso on the affirmative chapeau (e.g. "provided that no action with
  // respect to matters specifically addressed by any provision of Section
  // 5.2(b) shall be deemed a breach of this sentence ...").
  const provisoRaw = features.chapeauProviso ?? features.proviso;
  const provisoText = isCitableValue(provisoRaw) ? getCitableValue(provisoRaw) : provisoRaw;
  const hasProviso = typeof provisoText === 'string' && provisoText.trim().length > 0;

  if (limbsRaw.length === 0 && exceptionEntries.length === 0 && !hasProviso) return null;

  const renderLimb = (limb) => {
    // affirmativeLimbs shape: { obligation_code, obligation_label, text }
    if (limb && typeof limb === 'object' && (limb.obligation_label || limb.text) && !limb.obligation) {
      return limb.obligation_label || limb.text;
    }
    // positiveObligations limb shape (from the preamble / affirmative-chapeau
    // extraction): { obligation, materialityQualifier, efforts_standard, appliesTo }.
    // Render the obligation phrase plus a compact "(efforts; qualifier)" annotation.
    if (limb && typeof limb === 'object' && limb.obligation) {
      const base = String(limb.obligation).trim();
      const ann = [];
      const humanize = (s) => String(s).replace(/_/g, ' ').toLowerCase();
      if (limb.efforts_standard) ann.push(humanize(limb.efforts_standard));
      const mq = limb.materialityQualifier;
      if (mq && mq !== 'FLAT') ann.push(humanize(mq));
      if (Array.isArray(limb.appliesTo) && limb.appliesTo.length > 0) {
        ann.push(limb.appliesTo.map((a) => humanize(a)).join(', '));
      }
      return ann.length ? `${base} — ${ann.join('; ')}` : base;
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

      {hasProviso && (
        <div className="pl-3 border-l-2 border-sky-200 bg-sky-50/40 rounded-r py-1.5 pr-2">
          <p className="text-[10px] font-ui font-medium text-sky-700 uppercase tracking-wider mb-1">
            Proviso
          </p>
          <p className="text-xs font-ui text-ink">{provisoText.trim()}</p>
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

function PreambleCard({ provision, onEdit, allProvisions }) {
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
    <StructuredFeatures provision={provision} allProvisions={allProvisions} />
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
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider ${REVIEW_LABEL_COL_W}`}>Type</th>
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
    // limbRe matches against limb.obligation text on the preamble's
    // positiveObligations array so this bucket pulls ONLY its own limb's
    // standard/scope rather than every limb's combined.
    limbRe: /ordinary\s+course/i,
    // Default the "applies to" pills to the typical scope for this bucket;
    // unioned with whatever the extractor stamps so the canonical baseline
    // always shows and extraction adds deal-specific extras.
    defaultScopeCodes: ['BUSINESS'],
  },
  {
    code: 'IOC-PRESERVE',
    name: 'Preservation of Business Relationships',
    catRe: /(?:preservation|preserve).*relationship/i,
    limbRe: /(?:preserv\w*|maintain)\s+(?:intact\s+)?(?:its\s+)?(?:relationship|present\s+business)/i,
    defaultScopeCodes: ['CUSTOMERS', 'SUPPLIERS', 'EMPLOYEES', 'GOVERNMENTAL_ENTITIES'],
  },
  {
    // P9: renamed per user. "Maintain Business" is the canonical bucket name.
    code: 'IOC-MAINTAIN',
    name: 'Maintain Business',
    catRe: /maintain.*(?:business|organization|assets)/i,
    limbRe: /maintain.*(?:business|organization|assets|properties)/i,
    defaultScopeCodes: ['BUSINESS_ORGANIZATION', 'ASSETS'],
  },
  {
    code: 'IOC-NOACTION',
    name: 'General No-Action Restriction',
    catRe: /no\s+action/i,
    limbRe: /no\s+action|not\s+(?:take|engage)/i,
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

function IocAffirmativeCovenantsTableSingle({ iocProvisions, partyLabel, onSelectProvision }) {
  const matches = useMemo(
    () => findIocAffirmativeMatches(iocProvisions),
    [iocProvisions],
  );
  if (matches.length === 0) {
    // Render the empty placeholder for the Buyer side (or any caller that
    // requested explicit "Not present" rendering via partyLabel). Otherwise
    // return null to preserve the original "hide when empty" behavior.
    if (!partyLabel) return null;
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            {partyLabel} — Affirmative Covenants
          </p>
        </div>
        <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
          None extracted for this agreement.
        </div>
      </div>
    );
  }

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

  // Robust standard-code resolver. Maps ANY of (a) tagged item with .code,
  // (b) UPPER_SNAKE string like "COMMERCIALLY_REASONABLE_EFFORTS", or
  // (c) free-text phrase like "commercially reasonable efforts" to the
  // canonical IOC_AFFIRMATIVE_STANDARDS code. Returns null when nothing maps.
  const standardCodeFromValue = (val) => {
    if (val == null || val === '') return null;
    const inner = isCitableValue(val) ? getCitableValue(val) : val;
    if (inner == null || inner === '') return null;
    if (isTaggedItem(inner)) {
      const c = String(inner.code || '').toUpperCase().replace(/[\s-]+/g, '_');
      if (IOC_AFFIRMATIVE_STANDARDS[c]) return c;
      // Fall through to synonym match on the tagged item's label/text.
      const phrase = inner.label || inner.text || '';
      if (phrase) return standardCodeFromValue(phrase);
      return null;
    }
    if (typeof inner === 'string') {
      const t = inner.trim();
      if (!t) return null;
      // Direct dict match: UPPER_SNAKE or whitespace-normalised.
      const upper = t.toUpperCase().replace(/[\s-]+/g, '_');
      if (IOC_AFFIRMATIVE_STANDARDS[upper]) return upper;
      // Synonym regex match against the meta — handles "Commercially
      // reasonable efforts", "in all material respects", "Flat", etc.
      for (const [code, meta] of Object.entries(IOC_AFFIRMATIVE_STANDARD_META || {})) {
        for (const re of (meta.synonyms || [])) {
          if (re.test(t)) return code;
        }
      }
    }
    return null;
  };

  // Robust scope-code resolver — same shape, against IOC_AFFIRMATIVE_SCOPE.
  // Returns an ARRAY of codes (a free-text scope can mention several parties).
  const scopeCodesFromValue = (val) => {
    if (val == null || val === '') return [];
    const inner = isCitableValue(val) ? getCitableValue(val) : val;
    if (inner == null || inner === '') return [];
    if (Array.isArray(inner)) return inner.flatMap(scopeCodesFromValue);
    if (isTaggedItem(inner)) {
      const c = String(inner.code || '').toUpperCase().replace(/[\s-]+/g, '_');
      if (IOC_AFFIRMATIVE_SCOPE_CODES[c]) return [c];
      const phrase = inner.label || inner.text || '';
      return phrase ? scopeCodesFromValue(phrase) : [];
    }
    if (typeof inner === 'string') {
      const t = inner.trim();
      if (!t) return [];
      const upper = t.toUpperCase().replace(/[\s-]+/g, '_');
      if (IOC_AFFIRMATIVE_SCOPE_CODES[upper]) return [upper];
      // Synonym match against the meta — collect EVERY code whose regex
      // fires (so "customers, suppliers, employees and governmental
      // entities" yields all four pills).
      const hits = [];
      for (const [code, meta] of Object.entries(IOC_AFFIRMATIVE_SCOPE_META || {})) {
        for (const re of (meta.synonyms || [])) {
          if (re.test(t)) { hits.push(code); break; }
        }
      }
      return hits;
    }
    return [];
  };

  // For a preamble provision whose features include a positiveObligations or
  // affirmativeLimbs array, pick the limb that matches the given bucket via
  // bucket.limbRe (matched against limb.obligation). Without this filter, a
  // single preamble provision would surface EVERY limb's standard/scope on
  // EVERY bucket row — the source of the "wrong standard" bug.
  const matchingLimb = (features, bucket) => {
    const limbs = Array.isArray(features.affirmativeLimbs) ? features.affirmativeLimbs
      : Array.isArray(features.positiveObligations) ? features.positiveObligations
      : [];
    if (limbs.length === 0 || !bucket || !bucket.limbRe) return null;
    for (const limb of limbs) {
      if (!limb || typeof limb !== 'object') continue;
      const phrase = String(limb.obligation || limb.text || limb.label || '');
      if (phrase && bucket.limbRe.test(phrase)) return limb;
    }
    return null;
  };

  // Standards for a bucket+provision. Pulls (1) the matching limb's standard
  // if positiveObligations exists, ELSE (2) the provision's top-level
  // standard/materiality. Empty → canonical FLAT pill.
  const standardCodesFor = (provision, bucket) => {
    const f = getStructuredFeatures(provision) || {};
    const out = [];
    const seen = new Set();
    const push = (code) => { if (code && !seen.has(code)) { seen.add(code); out.push(code); } };

    const limb = matchingLimb(f, bucket);
    if (limb) {
      push(standardCodeFromValue(limb.efforts_standard));
      push(standardCodeFromValue(limb.effortsStandard));
      push(standardCodeFromValue(limb.materialityQualifier));
      push(standardCodeFromValue(limb.materiality));
    } else {
      // No limb match → use top-level features. Only fall back to scanning
      // all limbs when the provision has neither top-level standards nor a
      // matched limb (last resort so something shows).
      push(standardCodeFromValue(f.effortsStandard));
      push(standardCodeFromValue(f.materialityQualifier));
      if (out.length === 0) {
        const limbs = Array.isArray(f.affirmativeLimbs) ? f.affirmativeLimbs
          : Array.isArray(f.positiveObligations) ? f.positiveObligations
          : [];
        for (const l of limbs) {
          if (!l || typeof l !== 'object') continue;
          push(standardCodeFromValue(l.efforts_standard || l.effortsStandard));
          push(standardCodeFromValue(l.materialityQualifier || l.materiality));
        }
      }
    }
    if (out.length === 0) out.push('FLAT');
    return out;
  };

  // Scope codes for a bucket+provision. Always UNIONS the bucket's
  // defaultScopeCodes with extracted codes — defaults express the canonical
  // meaning of the bucket, extraction adds deal-specific extras (and may
  // re-affirm defaults). Mirrors the user's expectation that Preservation
  // should always at least surface the canonical relationship pills.
  const scopeCodesFor = (provision, bucket) => {
    const f = getStructuredFeatures(provision) || {};
    const out = [];
    const seen = new Set();
    const push = (code) => { if (code && !seen.has(code)) { seen.add(code); out.push(code); } };

    // 1. Extracted codes — prefer the matching limb's scope/appliesTo so
    //    each bucket row pulls only its own limb (not every limb's).
    const limb = matchingLimb(f, bucket);
    if (limb) {
      scopeCodesFromValue(limb.appliesTo).forEach(push);
      scopeCodesFromValue(limb.applies_to).forEach(push);
      scopeCodesFromValue(limb.scope).forEach(push);
    } else {
      [f.appliesTo, f.applies_to, f.scope, f.appliesto].forEach((v) => scopeCodesFromValue(v).forEach(push));
    }

    // 2. The split per-obligation provisions (IOC-ORDINARY / IOC-PRESERVE /
    //    IOC-MAINTAIN emitted by splitIocPreamble) carry EMPTY features — the
    //    verbatim enumeration lives in their full_text ("… customers,
    //    suppliers, licensors, licensees, Governmental Entities …"). Derive
    //    scope pills from the text itself so the noun list is COMPLETE per
    //    the agreement (the licensors/licensees miss).
    if (out.length === 0 && typeof provision.full_text === 'string') {
      scopeCodesFromValue(provision.full_text).forEach(push);
    }

    // 3. Canonical defaults ONLY when nothing is extractable — showing
    //    default pills (Customers/Employees) the agreement doesn't enumerate
    //    while omitting ones it does was actively misleading.
    if (out.length === 0) {
      for (const code of (bucket.defaultScopeCodes || [])) push(code);
    }
    return out;
  };

  // Render a list of canonical codes as small clickable pills.
  const renderCodePills = (codes, dict, quote) => {
    if (!codes || codes.length === 0) return <span className="text-inkFaint/70 italic">—</span>;
    return (
      <span className="inline-flex flex-wrap gap-1">
        {codes.map((code) => (
          <HoverSource key={code} quote={quote}>
            <span className="inline-flex items-center text-[10px] font-ui font-medium px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 whitespace-nowrap">
              {dict[code] || code}
            </span>
          </HoverSource>
        ))}
      </span>
    );
  };

  const title = partyLabel
    ? `${partyLabel} — Affirmative Covenants`
    : 'Affirmative Covenants';
  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Covenant</th>
              {/* Audit block 8 (superseded — see punch-list-2): sibling ths
                  must NOT carry width classes so Standard/Applies To absorb
                  the remaining width. That alone wasn't the whole story: the
                  Covenant column still measured 231px because the BODY cell
                  below also needs the fixed-width class + whitespace-normal.
                  With `whitespace-nowrap` on the body <td> and no explicit
                  width there, a long covenant name's unbreakable text forces
                  table-layout:fixed to grow the column past its max-width —
                  a real browser quirk, not spec behavior. Compare the
                  Structure & Mechanics "Term" column (row ~3877) which pins
                  the width on BOTH th and td and wraps instead of nowrap. */}
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Standard</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Applies To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matches.map(({ bucket, provision }) => {
              const stdCodes = standardCodesFor(provision, bucket);
              const scopeCodes = scopeCodesFor(provision, bucket);
              const rowQuote = (typeof provision?.full_text === 'string' && provision.full_text.trim())
                ? provision.full_text
                : null;
              return (
                <tr key={bucket.code} className="hover:bg-bg/40 transition-colors align-top">
                  <td className={`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                    <HoverSource quote={rowQuote}>
                      <button
                        type="button"
                        onClick={() => onSelectProvision && onSelectProvision(provision)}
                        className="text-left text-accent hover:underline font-medium"
                      >
                        {bucket.name}
                      </button>
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {renderCodePills(stdCodes, IOC_AFFIRMATIVE_STANDARDS, rowQuote)}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {renderCodePills(scopeCodes, IOC_AFFIRMATIVE_SCOPE_CODES, rowQuote)}
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

/* Public wrapper: side-gated render. When `side` is provided the wrapper
 * renders ONLY that party's half (matches the REP-T/REP-B sidebar split —
 * clicking the Company/Target IOC child only shows the Target half, etc.).
 * When `side` is null/undefined (parent IOC group view) both halves render. */
function IocAffirmativeCovenantsTable({ iocProvisions, onSelectProvision, side }) {
  const targetProvs = (iocProvisions || []).filter((p) => p.type !== 'IOC-B');
  const buyerProvs = (iocProvisions || []).filter((p) => p.type === 'IOC-B');
  const showTarget = !side || side === 'target';
  const showBuyer = !side || side === 'buyer';
  return (
    <div className="space-y-3">
      {showTarget && (
        <IocAffirmativeCovenantsTableSingle
          iocProvisions={targetProvs}
          partyLabel="Target / Company"
          onSelectProvision={onSelectProvision}
        />
      )}
      {showBuyer && (
        <IocAffirmativeCovenantsTableSingle
          iocProvisions={buyerProvs}
          partyLabel="Parent / Buyer"
          onSelectProvision={onSelectProvision}
        />
      )}
    </div>
  );
}

/* ── IOC General Exceptions table (Bringdown-style box)
 *    Renders the section-wide permittedExceptions (scope=preamble) and/or
 *    the items extracted from the consolidated General Exceptions provision.
 *
 *    P8 item 1: when a IOC-NEGATIVE-PREAMBLE provision is present the parser
 *    has split the section preamble in two — the "positive" half (affirmative
 *    duties + section-wide carve-outs) and the "negative" half (lead-in to
 *    the negative-covenants list). We collect each half's exception list,
 *    dedupe by code, and render THREE groups (apply-to-both / positive-only /
 *    negative-only) so the user can spot asymmetric carve-outs. When the
 *    negative preamble is absent (older / single-preamble agreements) we
 *    fall back to the existing single-list rendering.
 *
 *    Returns null when nothing meaningful is available. */
function IocGeneralExceptionsTableSingle({ iocProvisions, generalExceptionsProv, partyLabel, onSelectProvision }) {
  const showEvidence = useShowEvidence();

  // Identify positive vs negative preamble provisions among this party's
  // IOC provisions. "Negative" is the explicit IOC-NEGATIVE-PREAMBLE code;
  // "positive" is either an explicit IOC-POSITIVE-PREAMBLE code OR the
  // first non-negative preamble provision (the legacy "General / Preamble"
  // bucket carries permittedExceptions on the positive side).
  const { negativeProv, positiveProv } = useMemo(() => {
    let neg = null;
    let pos = null;
    for (const p of iocProvisions || []) {
      const meta = getAiMetadata(p) || {};
      const code = String(meta.code || p.code || '');
      if (!neg && code === 'IOC-NEGATIVE-PREAMBLE') { neg = p; continue; }
      if (!pos && code === 'IOC-POSITIVE-PREAMBLE') { pos = p; continue; }
    }
    if (!pos) {
      // Fall back to the legacy "General / Preamble" provision as the positive side.
      for (const p of iocProvisions || []) {
        if (p === neg) continue;
        if (isPreambleProvision(p)) { pos = p; break; }
      }
    }
    return { negativeProv: neg, positiveProv: pos };
  }, [iocProvisions]);

  // Extract the exception list for a single preamble provision. Returns
  // [{ code, label, text, source }] with code synthesized from the label
  // when the item is a bare string (so dedupe still works).
  const extractList = (prov, featureKey) => {
    if (!prov) return [];
    const f = getStructuredFeatures(prov) || {};
    const list = Array.isArray(f[featureKey]) ? f[featureKey] : [];
    const out = [];
    for (const item of list) {
      if (isTaggedItem(item)) {
        const label = resolveTaggedLabel(featureKey, item) || item.code;
        out.push({
          code: String(item.code).toUpperCase(),
          label: String(label),
          text: item.text || null,
          source: prov,
        });
      } else if (typeof item === 'string' && item.trim()) {
        const label = item.trim();
        out.push({
          code: `__STR:${label.toLowerCase()}`,
          label,
          text: null,
          source: prov,
        });
      }
    }
    return out;
  };

  // Collect the positive-side exception list — PREAMBLE-ONLY per user request.
  // The General Exceptions table mirrors the REPs preamble pattern: it shows
  // section-wide carve-outs introduced at the top of the IOC article, NOT
  // exceptions extracted from individual negative sub-clauses. So we only
  // accept items from:
  //   (a) the IOC-POSITIVE-PREAMBLE provision's permittedExceptions / general
  //       exceptions list, or
  //   (b) any permittedExceptions item explicitly marked scope === 'preamble'
  //       (legacy preambles emitted across multiple provisions), or
  //   (c) the consolidated General Exceptions provision (generalExceptionsProv).
  // Items from sub-clause provisions without an explicit preamble scope are
  // skipped — they're sub-clause-specific carve-outs and belong with their
  // negative covenant, not the section-wide General Exceptions box.
  const positiveList = useMemo(() => {
    const raw = [];
    // Item 1 fix: collapsing/deduping now runs ONCE at the end via the pure
    // dedupeIocExceptionEntries (table-logic.js) — collect every raw entry
    // here unfiltered so a genuinely distinct code (e.g. REQUIRED_BY_AGREEMENT)
    // is never dropped by an earlier ad-hoc alias map. See that function's
    // header comment for why REQUIRED_BY_AGREEMENT must NOT be aliased away.
    const push = (entry) => { raw.push(entry); };

    // 1. Items from the positive preamble provision (the IOC intro). Accept
    //    ALL of its permittedExceptions (it IS the preamble — no scope filter
    //    needed). Plus accept any explicit scope=preamble item from any other
    //    IOC provision (legacy multi-preamble extractions).
    //    Audit fix batch item 3: ALSO accept the consolidated General
    //    Exceptions row itself, matched by code/category via
    //    isIocGeneralExceptions() — NOT by party-typed equality with
    //    positiveProv. Some deals (Metsera) split their IOC preamble into
    //    party-suffixed sub-clause rows (typed IOC-T/IOC-B) plus a separate
    //    bare-IOC "General Exceptions" preamble row; isPreambleProvision()
    //    only matches category "Preamble" / "General/Preamble", so that bare
    //    row never became `positiveProv` and its structured
    //    permittedExceptions were skipped entirely — falling through to the
    //    raw full_text regex-splitter in step 2 below, which produced a raw
    //    mid-sentence blob instead of the 4 structured pills already in the
    //    DB. Matching on isIocGeneralExceptions(p) picks up that row
    //    regardless of its type/party suffix.
    // Build the per-provision plain-data rows the pure selector operates on
    // (table-logic.js's selectIocGeneralExceptionsItems), which decides both
    // (a) which raw items count as structured exceptions and (b) whether the
    // raw-text fallback below must be skipped — `source` is opaque to that
    // function, so the provision itself passes straight through onto each
    // returned item for hover/click-to-source attribution.
    const sourceRows = (iocProvisions || [])
      .filter((p) => p !== negativeProv)
      .map((p) => {
        const f = getStructuredFeatures(p) || {};
        return {
          isNegativePreamble: false,
          isPositivePreamble: p === positiveProv,
          isGeneralExceptionsRow: p === generalExceptionsProv || isIocGeneralExceptions(p),
          permittedExceptions: Array.isArray(f.permittedExceptions) ? f.permittedExceptions : [],
          generalExceptions: Array.isArray(f.generalExceptions) ? f.generalExceptions : [],
          source: p,
        };
      });
    const { items, skipTextFallback } = selectIocGeneralExceptionsItems(sourceRows);
    for (const { item, source } of items) {
      if (isTaggedItem(item)) {
        const label = resolveTaggedLabel('permittedExceptions', item) || item.code;
        push({
          code: String(item.code).toUpperCase(),
          label: String(label),
          text: item.text || null,
          source,
        });
      } else if (typeof item === 'string' && item.trim()) {
        const label = item.trim();
        push({
          code: `__STR:${label.toLowerCase()}`,
          label,
          text: null,
          source,
        });
      }
    }

    // 2. Consolidated General Exceptions provision's split text items — ONLY
    //    as a fallback when step 1 found no structured permittedExceptions /
    //    generalExceptions on that row. Otherwise this raw full_text regex
    //    splitter would duplicate the clean structured pills with a raw
    //    mid-sentence blob (the audit-fix-batch item 3 symptom).
    if (generalExceptionsProv && !skipTextFallback) {
      const text = generalExceptionsProv.full_text || generalExceptionsProv.text || '';
      const split = text ? splitGeneralExceptionsItems(text) : [];
      for (const t of split) {
        const label = String(t).trim();
        if (!label) continue;
        push({
          code: `__STR:${label.toLowerCase()}`,
          label,
          text: label,
          source: generalExceptionsProv,
        });
      }
    }

    return dedupeIocExceptionEntries(raw, EXCEPTION_CODES);
  }, [iocProvisions, generalExceptionsProv, negativeProv, positiveProv]);

  // Negative-side exception list comes from the IOC-NEGATIVE-PREAMBLE
  // provision's negativePreambleExceptions feature (rubric: list-tagged).
  const negativeList = useMemo(() => {
    if (!negativeProv) return [];
    const seen = new Set();
    const out = [];
    for (const entry of extractList(negativeProv, 'negativePreambleExceptions')) {
      if (seen.has(entry.code)) continue;
      seen.add(entry.code);
      out.push(entry);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negativeProv]);

  const title = partyLabel
    ? `${partyLabel} — General Exceptions`
    : 'General Exceptions';

  // ── Single-list (legacy) rendering path ───────────────────────────────
  //  Used when there's NO negative preamble (most existing data) — just
  //  show the positive-side list as before.
  const hasNegativeSide = negativeList.length > 0;

  if (!hasNegativeSide) {
    if (positiveList.length === 0) {
      if (!partyLabel) return null;
      return (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-bg/60 border-b border-border">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
              {title}
            </p>
          </div>
          <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
            None extracted for this agreement.
          </div>
        </div>
      );
    }
    const MAX_ITEMS = 4;
    const visibleRows = positiveList.slice(0, MAX_ITEMS);
    const overflowCount = Math.max(0, positiveList.length - visibleRows.length);
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            {title}
          </p>
        </div>
        <IocExceptionsMiniRows
          rows={visibleRows}
          showEvidence={showEvidence}
          onSelectProvision={onSelectProvision}
        />
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

  // ── Three-group comparison rendering path ─────────────────────────────
  //  Both a positive and a negative preamble exist; compute the
  //  intersection + per-side differences and render three sub-groups.
  const posByCode = new Map(positiveList.map((r) => [r.code, r]));
  const negByCode = new Map(negativeList.map((r) => [r.code, r]));
  const both = [];
  const posOnly = [];
  const negOnly = [];
  for (const r of positiveList) {
    if (negByCode.has(r.code)) {
      // Prefer the positive-side row (it tends to carry richer text); fall back to neg.
      both.push(r);
    } else {
      posOnly.push(r);
    }
  }
  for (const r of negativeList) {
    if (!posByCode.has(r.code)) negOnly.push(r);
  }

  const hasAsymmetry = posOnly.length > 0 || negOnly.length > 0;
  const allEmpty = both.length === 0 && posOnly.length === 0 && negOnly.length === 0;

  if (allEmpty) {
    if (!partyLabel) return null;
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            {title}
          </p>
        </div>
        <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
          None extracted for this agreement.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {title}
        </p>
      </div>
      {hasAsymmetry && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs rounded-none">
          <span className="italic">
            Asymmetric carve-outs detected — review the differences below.
          </span>
        </div>
      )}
      <div className="divide-y divide-border">
        <IocExceptionsGroup
          subtitle="Apply to both"
          rows={both}
          emptyHint="No carve-outs appear on both sides."
          showEvidence={showEvidence}
          onSelectProvision={onSelectProvision}
        />
        <IocExceptionsGroup
          subtitle="Positive only"
          rows={posOnly}
          emptyHint="Positive preamble adds no extra carve-outs."
          accent="positive"
          showEvidence={showEvidence}
          onSelectProvision={onSelectProvision}
        />
        <IocExceptionsGroup
          subtitle="Negative only"
          rows={negOnly}
          emptyHint="Negative preamble adds no extra carve-outs."
          accent="negative"
          showEvidence={showEvidence}
          onSelectProvision={onSelectProvision}
        />
      </div>
    </div>
  );
}

/* Inline row table — shared between single-list and three-group renderings.
 * Two columns: exception label (clickable to source provision) + verbatim
 * text (clickable to evidence highlight). */
function IocExceptionsMiniRows({ rows, onSelectProvision }) {
  if (!rows || rows.length === 0) return null;
  // Clean pill list per user request — was a 2-column table with verbatim
  // text inline that read as a "horrific list". Each canonical exception
  // renders as one shared Pill (block 2: same size/padding everywhere); the
  // verbatim text moves to a hover tooltip and is reachable via click (jump
  // to the source provision in the editor).
  return (
    <div className="px-3 py-3 flex flex-wrap gap-1.5">
      {rows.map((row, i) => {
        const hoverQuote = row.text || (row.source && row.source.full_text) || null;
        const handleClick = row.source && onSelectProvision
          ? () => onSelectProvision(row.source)
          : undefined;
        return (
          <Pill key={`${row.code}-${i}`} text={row.label} quote={hoverQuote} onClick={handleClick} />
        );
      })}
    </div>
  );
}

/* Labeled sub-group container used in the three-group comparison view.
 * Renders a subtitle bar + the inline rows table; empty groups render a
 * single italic hint row so the user sees that the comparison was performed. */
function IocExceptionsGroup({ subtitle, rows, emptyHint, accent, showEvidence, onSelectProvision }) {
  const subtitleStyle =
    accent === 'positive' ? 'text-emerald-800 bg-emerald-50/60'
    : accent === 'negative' ? 'text-rose-800 bg-rose-50/60'
    : 'text-inkFaint bg-bg/40';
  return (
    <div>
      <div className={`px-3 py-1.5 ${subtitleStyle}`}>
        <p className="text-[10px] font-ui font-medium uppercase tracking-wider">
          {subtitle}
          <span className="ml-1 normal-case font-normal opacity-70">
            ({rows ? rows.length : 0})
          </span>
        </p>
      </div>
      {rows && rows.length > 0 ? (
        <IocExceptionsMiniRows
          rows={rows}
          showEvidence={showEvidence}
          onSelectProvision={onSelectProvision}
        />
      ) : (
        <div className="px-3 py-2 text-[11px] font-ui italic text-inkFaint">
          {emptyHint || 'None.'}
        </div>
      )}
    </div>
  );
}

/* Public wrapper: render Target / Company half first, then Parent / Buyer
 * half (with "Not present" placeholder when no IOC-B provisions exist). */
function IocGeneralExceptionsTable({ iocProvisions, generalExceptionsProv, onSelectProvision, side }) {
  const targetProvs = (iocProvisions || []).filter((p) => p.type !== 'IOC-B');
  const buyerProvs = (iocProvisions || []).filter((p) => p.type === 'IOC-B');
  // The consolidated `generalExceptionsProv` (if any) is tied to whichever IOC
  // section it appeared in — use its `type` to assign it to the right half.
  const gxIsBuyer = generalExceptionsProv && generalExceptionsProv.type === 'IOC-B';
  const showTarget = !side || side === 'target';
  const showBuyer = !side || side === 'buyer';
  return (
    <div className="space-y-3">
      {showTarget && (
        <IocGeneralExceptionsTableSingle
          iocProvisions={targetProvs}
          generalExceptionsProv={gxIsBuyer ? null : generalExceptionsProv}
          partyLabel="Target / Company"
          onSelectProvision={onSelectProvision}
        />
      )}
      {showBuyer && (
        <IocGeneralExceptionsTableSingle
          iocProvisions={buyerProvs}
          generalExceptionsProv={gxIsBuyer ? generalExceptionsProv : null}
          partyLabel="Parent / Buyer"
          onSelectProvision={onSelectProvision}
        />
      )}
    </div>
  );
}

/* ─── IOC Negative Covenants table — bringdown-style.
 *     Rows are negative-restriction IOC sub-clause provisions (everything in
 *     the IOC list that isn't an affirmative bucket: not IOC-ORDINARY /
 *     IOC-PRESERVE / IOC-MAINTAIN / IOC-NOACTION). The Details cell composes
 *     a compact one-line summary from the relevant features. */
function IocNegativeCovenantsTableSingle({ iocProvisions, partyLabel, onSelectProvision, deal }) {
  const affCodes = new Set(['IOC-ORDINARY', 'IOC-PRESERVE', 'IOC-MAINTAIN', 'IOC-NOACTION', 'IOC-AFFIRMATIVE', 'IOC-OTHER-AFFIRMATIVE', 'IOC-GENERAL-EXCEPTIONS', 'IOC-EXCEPTIONS']);
  const negative = (iocProvisions || []).filter((p) => {
    if (isPreambleProvision(p)) return false;
    if (isIocAffirmative(p)) return false;
    if (isIocGeneralExceptions(p)) return false;
    const meta = getAiMetadata(p) || {};
    const code = String(meta.code || p.code || '');
    if (affCodes.has(code)) return false;
    return true;
  });
  const title = partyLabel
    ? `${partyLabel} — Negative Covenants`
    : 'Negative Covenants';
  if (negative.length === 0) {
    if (!partyLabel) return null;
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            {title}
          </p>
        </div>
        <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
          None extracted for this agreement.
        </div>
      </div>
    );
  }
  // P5 item 1: Sort by IOC_CATEGORY_CODES position. For each provision, derive
  // its canonical category code from features.dollarThresholdsByCategory[0].code
  // when present; otherwise fuzzy-match the provision.category against the
  // synonym regexes in IOC_CATEGORY_META. Unmatched rows fall back to
  // alphabetical (sorted to the tail after canonical-coded rows).
  const codeOrder = Object.keys(IOC_CATEGORY_CODES);
  const codeOrderIdx = new Map(codeOrder.map((c, i) => [c, i]));
  const resolveIocCode = (p) => {
    const feats = getStructuredFeatures(p) || {};
    const dt = Array.isArray(feats.dollarThresholdsByCategory) ? feats.dollarThresholdsByCategory : null;
    if (dt && dt.length > 0) {
      const c = String((dt[0] && (dt[0].code || dt[0].bucket)) || '').toUpperCase();
      if (c && codeOrderIdx.has(c)) return c;
    }
    const cat = String(p.category || '');
    if (cat) {
      for (const [code, entry] of Object.entries(IOC_CATEGORY_META)) {
        const syns = entry.synonyms || [];
        for (const re of syns) {
          if (re.test(cat)) return code;
        }
      }
    }
    return null;
  };
  // Metsera fb2 block 2e/4b: AGREEMENT ORDER first — natural sort by
  // features.sectionNumber (5.01(b)(i) < 5.01(b)(ii) < 5.02) when present.
  // Rows without a parseable section number fall back to the previous
  // canonical IOC_CATEGORY_CODES order (then alphabetical), after sectioned
  // rows.
  const iocSecOf = (p) => (getStructuredFeatures(p) || {}).sectionNumber;
  const canonicalSorted = [...negative].sort((a, b) => {
    const aCode = resolveIocCode(a);
    const bCode = resolveIocCode(b);
    const aIdx = aCode ? codeOrderIdx.get(aCode) : Infinity;
    const bIdx = bCode ? codeOrderIdx.get(bCode) : Infinity;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return String(a.category || '').localeCompare(String(b.category || ''));
  });
  const sorted = sortByAgreementOrder(canonicalSorted, iocSecOf);

  // Audit fix batch item 4 — IOC limb naming. Several deals (Metsera) reuse
  // the SAME raw p.category text ("Mergers, Acquisitions, Dispositions") for
  // every sub-clause under a combined article header, so 3 negative-covenant
  // rows read as identical labels with no way to tell which limb is which —
  // even though each row already carries its OWN resolved canonical code
  // (resolveIocCode, used above for sorting). Build the display label from
  // that code's canonical taxonomy label instead of the raw shared category
  // text; if rows still collide after that (e.g. two genuinely-INDEBTEDNESS
  // rows), append the row's own section-number pill as a final
  // disambiguator. Never touches stored data — display only.
  const displayLabelByKey = buildIocRowDisplayLabels(sorted.map((p) => {
    const code = resolveIocCode(p);
    return {
      key: p.id,
      canonicalLabel: code && IOC_CATEGORY_META[code] && IOC_CATEGORY_META[code].label,
      fallbackLabel: p.category,
      sectionNumber: (getStructuredFeatures(p) || {}).sectionNumber,
    };
  }));
  const displayLabelFor = (p) => displayLabelByKey.get(p.id) || p.category || 'General';

  // Per-row cell builders — split the old single "Details" composition into
  // dedicated Threshold and Exceptions columns per user request.
  // Threshold: dollarThreshold + the few related qualifier fields (settlement
  // cap, lead-in window) composed inline. Empty → italic "No threshold".
  const thresholdFor = (p) => {
    const f = getStructuredFeatures(p) || {};
    const bits = [];
    // Audit block 6e: CapEx/Settlement threshold cells could show a verbose
    // descriptive sentence AND a separate pill carrying the very same dollar
    // figure (once as the raw dollarThreshold sentence, again from the
    // Settlement-cap / permittedExceptions figures). De-dupe by the extracted
    // amount, and compact any bit that's a long sentence down to just its $
    // figure — the full sentence is already reachable via the row's evidence
    // hover, never duplicated in-cell.
    const AMOUNT_RE = /\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand))?/i;
    const seenAmounts = new Set();
    const pushBit = (bitText) => {
      if (!bitText) return;
      const m = bitText.match(AMOUNT_RE);
      let compact = (m && bitText.trim().length > m[0].length + 20) ? m[0] : bitText;
      const ampKey = m ? m[0].replace(/[$,\s]/g, '').toLowerCase() : null;
      if (ampKey) {
        if (seenAmounts.has(ampKey)) return;
        seenAmounts.add(ampKey);
        // Audit block 7: reuse the fee hero's "≈X% of deal value" computation
        // for the plain-dollar threshold pill (not the label-prefixed
        // compounds, where a bare suffix would read ambiguously). Omitted
        // when deal value is unknown — subtle, muted-in-place, not a
        // separate row.
        if (compact.trim() === m[0].trim()) {
          const pct = pctOfDealValue(m[0], deal);
          if (pct) compact = `${compact} (≈${pct}%)`;
        }
      }
      bits.push(compact);
    };
    const push = (label, val) => {
      if (val === null || val === undefined || val === '' || val === false) return;
      if (Array.isArray(val) && val.length === 0) return;
      const u = isCitableValue(val) ? getCitableValue(val) : val;
      if (u === null || u === undefined || u === '' || u === false) return;
      if (typeof u === 'boolean') { if (u) pushBit(label); return; }
      if (Array.isArray(u)) {
        const t = u.map((x) => isTaggedItem(x) ? (x.label || x.code) : String(x)).filter(Boolean).join(', ');
        if (t) pushBit(label ? `${label}: ${t}` : t);
        return;
      }
      if (isTaggedItem(u)) { pushBit(label ? `${label}: ${u.label || u.code}` : (u.label || u.code)); return; }
      pushBit(label ? `${label}: ${String(u)}` : String(u));
    };
    push(null, f.dollarThreshold);
    push('Settlement cap', f.interimSettlementCap);
    push('Lead-in (days)', f.leadInPeriodDays);
    // Surface monetary thresholds carried on permittedExceptions items (the
    // extractor tags dollar-cap carve-outs MONETARY_THRESHOLD and attaches
    // thresholdIndividual / thresholdAggregate). Per user request these read
    // in the Threshold column ("$250K ind. / $2M agg.") rather than being
    // buried as an exception pill.
    const fmtUsd = (n) => {
      if (n === null || n === undefined || n === '') return null;
      const num = typeof n === 'number' ? n : Number(String(n).replace(/[$,]/g, ''));
      if (!Number.isFinite(num)) return typeof n === 'string' ? n : null;
      if (num >= 1_000_000 && num % 100_000 === 0) return `$${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
      if (num >= 1_000 && num % 1_000 === 0) return `$${(num / 1_000).toFixed(0)}K`;
      return `$${num.toLocaleString('en-US')}`;
    };
    const excList = Array.isArray(f.permittedExceptions) ? f.permittedExceptions : [];
    for (const item of excList) {
      if (!item || typeof item !== 'object') continue;
      const ind = fmtUsd(item.thresholdIndividual);
      const agg = fmtUsd(item.thresholdAggregate);
      if (ind || agg) {
        const parts = [];
        if (ind) parts.push(`${ind} ind.`);
        if (agg) parts.push(`${agg} agg.`);
        pushBit(parts.join(' / '));
      }
    }
    return bits.length ? bits.join(' · ') : null;
  };

  // Exceptions: canonical pills from permittedExceptions + consentStandard
  // + the common carveout booleans. Maps free-text/legacy codes onto the new
  // COMMON_EXCEPTION_CODES so cross-deal comparison reads as pills.
  const exceptionPillsFor = (p) => {
    const f = getStructuredFeatures(p) || {};
    const codes = [];
    const seen = new Set();
    const push = (code) => {
      if (!code) return;
      const norm = String(code).toUpperCase().replace(/[\s-]+/g, '_');
      if (seen.has(norm)) return;
      // Map any code into COMMON_EXCEPTION_CODES; unknown codes default to
      // OTHER_SPECIFIC so the cell never reads as raw UPPER_SNAKE noise.
      if (COMMON_EXCEPTION_CODES[norm]) {
        seen.add(norm); codes.push(norm); return;
      }
      // Try synonym match against the COMMON_EXCEPTION_META labels.
      for (const [k, meta] of Object.entries(COMMON_EXCEPTION_META || {})) {
        for (const re of (meta.synonyms || [])) {
          if (re.test(String(code))) { if (!seen.has(k)) { seen.add(k); codes.push(k); } return; }
        }
      }
      // Fallback bucket per user request.
      if (!seen.has('OTHER_SPECIFIC')) { seen.add('OTHER_SPECIFIC'); codes.push('OTHER_SPECIFIC'); }
    };
    const consumeItem = (item) => {
      if (!item) return;
      if (isTaggedItem(item)) { push(item.code || item.label || item.text); return; }
      if (typeof item === 'string') { push(item); return; }
      if (typeof item === 'object' && (item.label || item.text)) push(item.label || item.text);
    };
    const list = Array.isArray(f.permittedExceptions) ? f.permittedExceptions : [];
    for (const item of list) consumeItem(item);
    if (f.consentStandard) push('WITH_CONSENT');
    if (f.requiredByLawCarveout) push('REQUIRED_BY_LAW');
    if (f.pandemicCarveout) push('PANDEMIC');
    if (f.ordinaryCourseCarveout) push('ORDINARY_COURSE');
    return codes;
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Restriction</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Threshold</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Exceptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((p) => {
              const rowQuote = (typeof p?.full_text === 'string' && p.full_text.trim())
                ? p.full_text
                : null;
              const thrText = thresholdFor(p);
              const excCodes = exceptionPillsFor(p);
              return (
                <tr key={p.id} className="align-top hover:bg-bg/40">
                  <td className="px-3 py-2 text-ink font-medium">
                    <HoverSource quote={rowQuote}>
                      <button
                        type="button"
                        onClick={() => onSelectProvision && onSelectProvision(p)}
                        className="text-left text-accent hover:underline font-medium"
                      >
                        {displayLabelFor(p)}
                      </button>
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    <HoverSource quote={rowQuote} as="div">
                      {thrText
                        ? (
                          <span className="inline-flex flex-wrap gap-1">
                            {thrText.split(' · ').map((bit, i) => (
                              <Pill key={i} text={bit} tone="amount" />
                            ))}
                          </span>
                        )
                        : <span className="italic text-inkFaint">No threshold</span>}
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {excCodes.length > 0 ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {excCodes.map((code) => (
                          <Pill key={code} text={COMMON_EXCEPTION_CODES[code] || code} quote={rowQuote} />
                        ))}
                      </span>
                    ) : (
                      <span className="italic text-inkFaint">No exceptions</span>
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

/* Public wrapper: render Target / Company half first, then Parent / Buyer
 * half (with "Not present" placeholder when no IOC-B provisions exist). */
function IocNegativeCovenantsTable({ iocProvisions, onSelectProvision, side, deal }) {
  const targetProvs = (iocProvisions || []).filter((p) => p.type !== 'IOC-B');
  const buyerProvs = (iocProvisions || []).filter((p) => p.type === 'IOC-B');
  const showTarget = !side || side === 'target';
  const showBuyer = !side || side === 'buyer';
  return (
    <div className="space-y-3">
      {showTarget && (
        <IocNegativeCovenantsTableSingle
          iocProvisions={targetProvs}
          partyLabel="Target / Company"
          onSelectProvision={onSelectProvision}
          deal={deal}
        />
      )}
      {showBuyer && (
        <IocNegativeCovenantsTableSingle
          iocProvisions={buyerProvs}
          partyLabel="Parent / Buyer"
          onSelectProvision={onSelectProvision}
          deal={deal}
        />
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
  'REP-T': ['mainConcept', 'crossReferences', 'linkedBringDownStandard', 'solvencyRepIncluded', 'solvency_rep_included', 'financingRepIncluded', 'financing_rep_included', 'materialityScrape', 'materiality_scrape', 'bringDownStandard', 'bring_down_standard', 'scheduleReference', 'schedule_reference', 'sufficientFundsRepPresent', 'sufficient_funds_rep_present', 'sufficientFundsRepDetails', 'sufficient_funds_rep_details', 'solvencyRepPresent', 'solvency_rep_present', 'solvencyRepDetails', 'solvency_rep_details', 'antiRelianceRepPresent', 'anti_reliance_rep_present', 'antiRelianceRepText', 'anti_reliance_rep_text', 'parentLitigationRepPresent', 'parent_litigation_rep_present', 'parentOwnershipRepPresent', 'parent_ownership_rep_present', 'parentBrokersRepPresent', 'parent_brokers_rep_present',
    // Fully-removed REP fields (per P2 cleanup) — hidden from per-row table:
    'survivalPeriod', 'survival_period',
    'secFilingsExceptionScope', 'sec_filings_exception_scope',
    'secFilingsLookbackMonths', 'sec_filings_lookback_months',
    'secFilingsExcludedSections', 'sec_filings_excluded_sections',
    'secFilingsCarvedOutReps', 'sec_filings_carved_out_reps',
    'knowledgeStandard', 'knowledge_standard',
    'disclosureSchedulesRequired', 'disclosure_schedules_required',
    'disclosureSchedulesException', 'disclosure_schedules_exception',
    'maeQualifiedReps', 'mae_qualified_reps',
    'topCustomersSuppliersRepPresent', 'top_customers_suppliers_rep_present',
    'topCustomersSuppliersDefinition', 'top_customers_suppliers_definition',
    'materialContractsBuckets', 'material_contracts_buckets',
    'materialContractsDollarThresholds', 'material_contracts_dollar_thresholds',
    'materialContractsRedactionsPermitted', 'material_contracts_redactions_permitted',
    'permittedRedactionsDefinition', 'permitted_redactions_definition',
    'materialityScrapePresent', 'materiality_scrape_present',
    'materialityScrapeLanguage', 'materiality_scrape_language',
    'maeLimbs', 'mae_limbs',
    // P7 item 22: deleted Stage-1 REP feature bloat. Hide for back-compat
    // — extracts persisted before this commit may still carry these keys.
    'environmentalLawsList', 'environmental_laws_list',
    'environmentalPermitsHeld', 'environmental_permits_held',
    'environmentalLiabilities', 'environmental_liabilities',
    'hazardousMaterialsScope', 'hazardous_materials_scope',
    'ipRegistrations', 'ip_registrations',
    'ipLicensesIn', 'ip_licenses_in',
    'ipLicensesOut', 'ip_licenses_out',
    'ipInfringementClaims', 'ip_infringement_claims',
    'ipTradeSecretsProtection', 'ip_trade_secrets_protection',
    'taxReturnsFiled', 'tax_returns_filed',
    'taxAuditsPending', 'tax_audits_pending',
    'taxClosingAgreements', 'tax_closing_agreements',
    'taxNoNotices', 'tax_no_notices',
    'taxSection355', 'tax_section_355',
    'taxAttributes', 'tax_attributes',
    'itSystemsScope', 'it_systems_scope',
    'cybersecurityIncidents', 'cybersecurity_incidents',
    'dataPrivacyCompliance', 'data_privacy_compliance',
    'personalInfoBreaches', 'personal_info_breaches',
    'pendingLitigation', 'pending_litigation',
    'governmentInvestigations', 'government_investigations',
    'outstandingOrders', 'outstanding_orders',
    // Fields that ONLY surface inside REP_SPECIFIC_FEATURE_SPECS (per
    // matching rep category). Hide as columns so they don't appear on
    // every rep row.
    'absenceOfChangesStartDate', 'absence_of_changes_start_date',
    'absenceOfChangesType', 'absence_of_changes_type',
    'absenceOfChangesExceptions', 'absence_of_changes_exceptions',
    'undisclosedLiabilitiesExceptions', 'undisclosed_liabilities_exceptions',
    // ERISA-specific features — Specific Features only.
    'erisaPlansListed', 'erisa_plans_listed',
    'erisaCompliance', 'erisa_compliance',
    'erisaTitleIVPlans', 'erisa_title_iv_plans',
    'erisaMultiemployer', 'erisa_multiemployer',
    'erisaParachutePayments', 'erisa_parachute_payments',
    // Audit fix batch item 1 (reps-table raw-column leak): MetsFB2 batch-2
    // fields (AoC "no MAE" limb / cited-covenant cites, No-Other-Reps /
    // Non-Reliance, knowledge scope) live on the FEATURES['REP-T'] schema for
    // getFeatureSchema's ordering/specificFeatures purposes, but must never
    // surface as raw per-row columns — they render inside the "Specific
    // Features" cell (REP_SPECIFIC_FEATURE_SPECS) or the Knowledge Qualifier
    // hover instead. sectionNumber hidden defensively (not currently on this
    // schema, but used for row sorting — see bySection above — so it must
    // never leak as a column if it's ever added to the rubric schema).
    'aocNoMaePresent', 'aoc_no_mae_present',
    'aocNoMaeSinceDate', 'aoc_no_mae_since_date',
    'aocOrdinaryCourseLimb', 'aoc_ordinary_course_limb',
    'aocCitedCovenantSections', 'aoc_cited_covenant_sections',
    'aocCitedCovenantNames', 'aoc_cited_covenant_names',
    'noOtherRepsPresent', 'no_other_reps_present',
    'noOtherRepsParty', 'no_other_reps_party',
    'nonRelianceClause', 'non_reliance_clause',
    'extraContractualClaimsWaived', 'extra_contractual_claims_waived',
    'fraudCarveout', 'fraud_carveout',
    'knowledgeScope', 'knowledge_scope',
    // knowledgeScopeType landed on this same schema via #71 (merged into this
    // branch after the item-1 audit) — same leak pattern, same fix: hide it
    // defensively rather than let it reappear as a raw column.
    'knowledgeScopeType', 'knowledge_scope_type',
    'sectionNumber', 'section_number',
  ],
  'REP-B': ['mainConcept', 'crossReferences', 'linkedBringDownStandard', 'solvencyRepIncluded', 'solvency_rep_included', 'financingRepIncluded', 'financing_rep_included', 'materialityScrape', 'materiality_scrape', 'bringDownStandard', 'bring_down_standard', 'scheduleReference', 'schedule_reference', 'sufficientFundsRepPresent', 'sufficient_funds_rep_present', 'sufficientFundsRepDetails', 'sufficient_funds_rep_details', 'solvencyRepPresent', 'solvency_rep_present', 'solvencyRepDetails', 'solvency_rep_details', 'antiRelianceRepPresent', 'anti_reliance_rep_present', 'antiRelianceRepText', 'anti_reliance_rep_text', 'parentLitigationRepPresent', 'parent_litigation_rep_present', 'parentOwnershipRepPresent', 'parent_ownership_rep_present', 'parentBrokersRepPresent', 'parent_brokers_rep_present',
    // Fully-removed REP fields (per P2 cleanup) — hidden from per-row table:
    'survivalPeriod', 'survival_period',
    'secFilingsExceptionScope', 'sec_filings_exception_scope',
    'secFilingsLookbackMonths', 'sec_filings_lookback_months',
    'secFilingsExcludedSections', 'sec_filings_excluded_sections',
    'secFilingsCarvedOutReps', 'sec_filings_carved_out_reps',
    'knowledgeStandard', 'knowledge_standard',
    'disclosureSchedulesRequired', 'disclosure_schedules_required',
    'disclosureSchedulesException', 'disclosure_schedules_exception',
    'maeQualifiedReps', 'mae_qualified_reps',
    'topCustomersSuppliersRepPresent', 'top_customers_suppliers_rep_present',
    'topCustomersSuppliersDefinition', 'top_customers_suppliers_definition',
    'materialContractsBuckets', 'material_contracts_buckets',
    'materialContractsDollarThresholds', 'material_contracts_dollar_thresholds',
    'materialContractsRedactionsPermitted', 'material_contracts_redactions_permitted',
    'permittedRedactionsDefinition', 'permitted_redactions_definition',
    'materialityScrapePresent', 'materiality_scrape_present',
    'materialityScrapeLanguage', 'materiality_scrape_language',
    'maeLimbs', 'mae_limbs',
    // P7 item 22: deleted Stage-1 REP feature bloat. Hide for back-compat
    // — extracts persisted before this commit may still carry these keys.
    'environmentalLawsList', 'environmental_laws_list',
    'environmentalPermitsHeld', 'environmental_permits_held',
    'environmentalLiabilities', 'environmental_liabilities',
    'hazardousMaterialsScope', 'hazardous_materials_scope',
    'ipRegistrations', 'ip_registrations',
    'ipLicensesIn', 'ip_licenses_in',
    'ipLicensesOut', 'ip_licenses_out',
    'ipInfringementClaims', 'ip_infringement_claims',
    'ipTradeSecretsProtection', 'ip_trade_secrets_protection',
    'taxReturnsFiled', 'tax_returns_filed',
    'taxAuditsPending', 'tax_audits_pending',
    'taxClosingAgreements', 'tax_closing_agreements',
    'taxNoNotices', 'tax_no_notices',
    'taxSection355', 'tax_section_355',
    'taxAttributes', 'tax_attributes',
    'itSystemsScope', 'it_systems_scope',
    'cybersecurityIncidents', 'cybersecurity_incidents',
    'dataPrivacyCompliance', 'data_privacy_compliance',
    'personalInfoBreaches', 'personal_info_breaches',
    'pendingLitigation', 'pending_litigation',
    'governmentInvestigations', 'government_investigations',
    'outstandingOrders', 'outstanding_orders',
    // Audit fix batch item 1: same MetsFB2 batch-2 fields as REP-T above —
    // Specific Features cell / Knowledge Qualifier hover only, never a column.
    'aocNoMaePresent', 'aoc_no_mae_present',
    'aocNoMaeSinceDate', 'aoc_no_mae_since_date',
    'aocOrdinaryCourseLimb', 'aoc_ordinary_course_limb',
    'aocCitedCovenantSections', 'aoc_cited_covenant_sections',
    'aocCitedCovenantNames', 'aoc_cited_covenant_names',
    'noOtherRepsPresent', 'no_other_reps_present',
    'noOtherRepsParty', 'no_other_reps_party',
    'nonRelianceClause', 'non_reliance_clause',
    'extraContractualClaimsWaived', 'extra_contractual_claims_waived',
    'fraudCarveout', 'fraud_carveout',
    'knowledgeScope', 'knowledge_scope',
    // knowledgeScopeType landed on this same schema via #71 (merged into this
    // branch after the item-1 audit) — same leak pattern, same fix: hide it
    // defensively rather than let it reappear as a raw column.
    'knowledgeScopeType', 'knowledge_scope_type',
    'sectionNumber', 'section_number',
    // Fields that ONLY surface inside REP_SPECIFIC_FEATURE_SPECS (per
    // matching rep category). Hide as columns so they don't appear on
    // every rep row.
    'absenceOfChangesStartDate', 'absence_of_changes_start_date',
    'absenceOfChangesType', 'absence_of_changes_type',
    'absenceOfChangesExceptions', 'absence_of_changes_exceptions',
    'undisclosedLiabilitiesExceptions', 'undisclosed_liabilities_exceptions',
    // ERISA-specific features — Specific Features only.
    'erisaPlansListed', 'erisa_plans_listed',
    'erisaCompliance', 'erisa_compliance',
    'erisaTitleIVPlans', 'erisa_title_iv_plans',
    'erisaMultiemployer', 'erisa_multiemployer',
    'erisaParachutePayments', 'erisa_parachute_payments',
  ],
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
    // Start date FIRST so the look-back framing leads. Type renders via the
    // ABSENCE_OF_CHANGES_TYPES taxonomy so HYBRID reads as the verbose phrase
    // ("Hybrid (General operating covenant and specific IOCs cited)").
    // Exceptions always renders — empty list shows canonical "None".
    categoryRegex: /absence\s+of\s+(?:certain\s+)?changes(?:\s+(?:or|and)\s+events)?|no\s+(?:material\s+)?changes/i,
    rows: [
      { label: 'Start date', keys: ['absenceOfChangesStartDate'] },
      { label: 'Type', keys: ['absenceOfChangesType'] },
      { label: 'Exceptions', keys: ['absenceOfChangesExceptions'], alwaysRender: true, emptyAs: 'None' },
      // Audit fix batch item 1: the "no MAE since [date]" limb and the
      // ordinary-course limb's cited-covenant cross-references were leaking
      // as raw columns (aocNoMaePresent, aocCitedCovenantNames, etc — see
      // HIDDEN_TABLE_COLUMNS above). They belong HERE, inside the AoC rep's
      // Specific Features cell, with custom renderers (not the generic
      // renderFeatureCell, which stringifies aocCitedCovenantNames's
      // {section,name} objects as "[object Object]").
      { label: 'No MAE limb', keys: ['aocNoMaePresent'], render: renderAocNoMaeLimb },
      { label: 'Cited covenants', keys: ['aocCitedCovenantNames'], render: renderAocCitedCovenants },
    ],
  },
  {
    // No Undisclosed Liabilities. Matches both the standalone rep and the
    // synthetic REP-T-NOLIAB row split out of SEC Documents; Financial
    // Statements (clause (e)). Exceptions always renders so cross-deal
    // comparison has a consistent row even when none are specified.
    categoryRegex: /undisclosed\s+liabilities|\bno\s+liabilities\b/i,
    rows: [
      { label: 'Exceptions', keys: ['undisclosedLiabilitiesExceptions'], alwaysRender: true, emptyAs: 'None' },
    ],
  },
  // P7 item 22: ERISA kept (5 keys still on REP-T schema). Environment / IP /
  // Tax / IT-Cyber / Litigation feature-list specs deleted along with their
  // backing schema keys — those categories simply aren't surfaced as a
  // per-rep-row "Specific Features" cell anymore.
  //
  // hoverQuote: for these boolean indicators we don't want the verbatim text
  // inline — the cell just shows Yes / No and the supporting quote moves to a
  // hover tooltip, so the row reads as a compact checklist.
  {
    categoryRegex: /erisa|employee\s+benefit/i,
    rows: [
      { label: 'Plans listed', keys: ['erisaPlansListed'], hoverQuote: true },
      { label: 'Compliance', keys: ['erisaCompliance'], hoverQuote: true },
      { label: 'Title IV plans', keys: ['erisaTitleIVPlans'], hoverQuote: true },
      { label: 'Multiemployer', keys: ['erisaMultiemployer'], hoverQuote: true },
      { label: 'Parachute payments', keys: ['erisaParachutePayments'], hoverQuote: true },
    ],
  },
];

// Audit fix batch item 1 — AoC "No MAE since [date]" term treatment. Renders
// as prose ("No MAE since January 1, 2025"), never a raw boolean/date column.
function renderAocNoMaeLimb(raw, features) {
  const inner = isCitableValue(raw) ? getCitableValue(raw) : raw;
  const dateRaw = features ? features.aocNoMaeSinceDate : null;
  const dateInner = isCitableValue(dateRaw) ? getCitableValue(dateRaw) : dateRaw;
  const text = buildAocNoMaeLimbText(inner, dateInner);
  if (!text) return null;
  const quote =
    (isCitableValue(dateRaw) && getCitableText(dateRaw)) ||
    (isCitableValue(raw) && getCitableText(raw)) ||
    null;
  return quote ? <HoverSource quote={quote}>{text}</HoverSource> : <span>{text}</span>;
}

// Audit fix batch item 1 — AoC ordinary-course limb's cited covenant sections,
// resolved deterministically (post-pass) to { section, name } pairs. Renders
// as "5.01(a) Dividends and Distributions, 5.01(d) M&A/Dispositions, …" — a
// null name falls back to the section alone. Never the generic array
// stringifier (which would print "[object Object]" for these objects).
function renderAocCitedCovenants(raw) {
  const inner = isCitableValue(raw) ? getCitableValue(raw) : raw;
  const text = buildAocCitedCovenantsText(inner);
  if (!text) return null;
  const quote = isCitableValue(raw) ? getCitableText(raw) : null;
  return quote ? <HoverSource quote={quote}>{text}</HoverSource> : <span>{text}</span>;
}

function findRepSpec(provision) {
  const cat = String(provision?.category || '');
  for (const spec of REP_SPECIFIC_FEATURE_SPECS) {
    if (spec.categoryRegex.test(cat)) return spec;
  }
  return null;
}

function renderRepSpecificFeaturesCell(provision) {
  const spec = findRepSpec(provision);
  const features = getStructuredFeatures(provision) || {};
  const partOfRep = features.partOfRep;
  const alsoSurfacedAs = Array.isArray(features.alsoSurfacedAs) ? features.alsoSurfacedAs : null;
  // No spec match — fall back to JUST the cross-reference if either side is
  // present (e.g. on the FinStmt rep, surface that No-Liab is also a row).
  const rows = [];
  if (spec) {
    for (const row of spec.rows) {
      let captured = null; // { key, raw }
      for (const key of row.keys) {
        const raw = features[key];
        // P9 item 2(c): unwrap citable / tagged shapes BEFORE the empty-check
        // so a {value: false, text: "..."} or {value: "", text: "..."} reads
        // as empty rather than rendering an empty "Specific Features" row.
        let probe = raw;
        if (isCitableValue(probe)) probe = getCitableValue(probe);
        const empty =
          probe === null || probe === undefined || probe === '' || probe === false ||
          (Array.isArray(probe) && probe.length === 0) ||
          (isTaggedItem(probe) && !probe.code && !probe.label);
        if (!empty) { captured = { key, raw }; break; }
      }
      if (captured) {
        if (row.render) {
          // Custom row renderer (e.g. AoC No-MAE limb / cited covenants) —
          // compute eagerly and skip the row entirely if it has nothing to
          // show, rather than rendering an empty label with a blank value.
          const node = row.render(captured.raw, features);
          if (node) rows.push({ label: row.label, node });
        } else {
          rows.push({ label: row.label, key: captured.key, raw: captured.raw, hoverQuote: !!row.hoverQuote });
        }
      } else if (row.alwaysRender) {
        // Surface the row as the canonical empty marker (e.g. "None") so
        // cross-deal comparison has a stable, present row.
        rows.push({ label: row.label, key: row.keys[0], emptyAs: row.emptyAs || 'None' });
      }
    }
  }
  if (rows.length === 0 && !partOfRep && !alsoSurfacedAs) return null;
  return (
    <dl className="space-y-1">
      {partOfRep && (
        <div className="text-[10px] italic text-inkFaint">
          Also appears in <span className="not-italic font-medium text-inkMid">{String(partOfRep)}</span> (clause (e))
        </div>
      )}
      {alsoSurfacedAs && alsoSurfacedAs.length > 0 && (
        <div className="text-[10px] italic text-inkFaint">
          Also surfaced separately as{' '}
          <span className="not-italic font-medium text-inkMid">
            {alsoSurfacedAs.join(', ')}
          </span>
        </div>
      )}
      {rows.map(({ label, key, raw, emptyAs, hoverQuote, node }) => (
        <div key={label} className="flex flex-col">
          <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{label}</dt>
          <dd className="text-[11px]">
            {node !== undefined ? node : emptyAs ? (
              <span className="italic text-inkFaint">{emptyAs}</span>
            ) : hoverQuote ? (
              renderRepCellWithHoverQuote(key, raw)
            ) : (
              renderFeatureCell(key, raw)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Render a boolean-ish citable cell as just Yes / No (or its resolved text),
// with the verbatim supporting quote behind a hover. Keeps the ERISA-style
// checklist tight instead of showing the full provision text inline.
function renderRepCellWithHoverQuote(featureKey, raw) {
  let display;
  let quote = null;
  if (isCitableValue(raw)) {
    const inner = getCitableValue(raw);
    quote = getCitableText(raw);
    if (typeof inner === 'boolean') display = inner ? 'Yes' : 'No';
    else if (isTaggedItem(inner)) display = resolveTaggedLabel(featureKey, inner) || inner.code;
    else if (inner === null || inner === undefined || inner === '') display = '—';
    else display = String(inner);
  } else if (typeof raw === 'boolean') {
    display = raw ? 'Yes' : 'No';
  } else if (isTaggedItem(raw)) {
    display = resolveTaggedLabel(featureKey, raw) || raw.code;
  } else if (raw === null || raw === undefined || raw === '') {
    display = '—';
  } else {
    display = String(raw);
  }
  const node = <span>{display}</span>;
  return quote ? <HoverSource quote={quote}>{node}</HoverSource> : node;
}

// Compute "N months (since YYYY-MM-DD)" from a months count + an announce date.
function computeLookbackText(months /* announceDate unused: months-from-signing only */) {
  if (months === null || months === undefined || months === '') return null;
  const m = Number(months);
  if (!Number.isFinite(m) || m <= 0) return String(months);
  // Per user: show the MONTHS measured from signing, not a computed date.
  return `${m} months prior to signing`;
}

/* Coerce a lookback value into "X months prior to signing".
 *  - bare number / numeric string → that many months
 *  - a date (e.g. "Since January 30, 2025" / "2025-01-30") → months between
 *    that date and the signing date, rounded.
 *  - anything else → the cleaned string as a last resort.
 * The user always wants the MONTHS framing, never a raw "Since <date>". */
function lookbackToMonths(rawValue, signingDate) {
  let v = isCitableValue(rawValue) ? getCitableValue(rawValue) : rawValue;
  if (isTaggedItem(v)) v = v.label || v.code;
  if (v === null || v === undefined || v === '') return null;
  // Numeric month count.
  if (typeof v === 'number' || /^\s*\d{1,3}\s*$/.test(String(v))) {
    return computeLookbackText(Number(String(v).trim()));
  }
  const s = String(v).trim();
  // Try to pull a date out of the string ("Since January 30, 2025", "1/30/25").
  const dateMatch = s.match(/(?:[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})|(?:\d{4}-\d{2}-\d{2})|(?:\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const base = signingDate ? new Date(signingDate) : null;
  if (dateMatch && base && !isNaN(base.getTime())) {
    const d = new Date(dateMatch[0]);
    if (!isNaN(d.getTime())) {
      let months = (base.getFullYear() - d.getFullYear()) * 12 + (base.getMonth() - d.getMonth());
      if (base.getDate() < d.getDate()) months -= 1;
      if (months > 0) return `${months} months prior to signing`;
    }
  }
  // No usable date/number → return the cleaned phrase (strip a leading "Since").
  return s.replace(/^since\s+/i, '').trim() || null;
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
        return prettifyEnumValue(featureKey, String(item));
      })
      .join('; ');
  }
  if (isTaggedItem(raw)) {
    return resolveTaggedLabel(featureKey, raw) || raw.code;
  }
  // P3 item 7: append explicit units to bare numeric duration cells.
  if (typeof raw === 'number') {
    const withUnits = formatDurationWithUnits(raw, featureKey);
    if (withUnits) return withUnits;
  }
  const v = formatFeatureValue(raw);
  if (v === null || v === undefined || v === '') return null;
  // FIX BATCH item 4: this is the generic per-provision feature-cell path
  // (distinct from renderSummaryRowValue's NosolFourTables path) — route any
  // bare enum-shaped string through the same taxonomy-lookup + humanize
  // fallback so no raw code (e.g. "RBE_NOT_TO", "POSITIVE_ONLY") can leak
  // through here either.
  return prettifyEnumValue(featureKey, String(v));
}


// Render a single feature cell value (tagged object → code+label, otherwise text).
function renderFeatureCell(featureKey, raw) {
  // P7 item 25: list-valued cells render as bullets (universally).
  if (Array.isArray(raw)) {
    const bullets = renderListAsBullets(featureKey, raw);
    if (bullets) return bullets;
    return <div className="text-inkFaint/70 italic">—</div>;
  }
  // P7 item 25: a citable wrapper around a list value — render the list as
  // bullets; wrapper-level quotes are hover-only per the design contract.
  if (isCitableValue(raw) && Array.isArray(getCitableValue(raw))) {
    const innerList = getCitableValue(raw);
    const wrapperQuotes = getCitableQuotes(raw);
    const bullets = renderListAsBullets(featureKey, innerList);
    return (
      <div className="whitespace-pre-wrap break-words">
        <CitableHover quotes={wrapperQuotes}>
          {bullets || <span className="text-inkFaint/70 italic">—</span>}
        </CitableHover>
      </div>
    );
  }
  if (isTaggedItem(raw)) {
    const label = resolveTaggedLabel(featureKey, raw) || raw.code;
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <CodeBadge code={raw.code} />
        <span>{label}</span>
      </div>
    );
  }
  // Citable value — render the inner value; the quote(s) are hover-only per
  // the design contract (was an in-cell amber EvidenceQuote block).
  if (isCitableValue(raw)) {
    const inner = getCitableValue(raw);
    const quotes = getCitableQuotes(raw);
    const cell = formatCellValue(featureKey, inner);
    return (
      <div className="whitespace-pre-wrap break-words">
        <CitableHover quotes={quotes}>
          <span className={cell === null ? 'text-inkFaint/70 italic' : ''}>
            {cell === null ? '—' : cell}
          </span>
        </CitableHover>
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
  const showEvidence = useShowEvidence();

  // Hero pair: dealStructure + mergerForm pulled from the first STRUCT-MERGER
  // (or any STRUCT provision) that carries them. Track the SOURCE provision +
  // citable quote so the synthesized Deal Structure row can link to source
  // the same way the Merger Form row does.
  let heroDealStructure = null;
  let heroMergerForm = null;
  let dealStructureSource = null; // { provision, quote }
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (!heroDealStructure && f.dealStructure) {
      const rawDs = f.dealStructure;
      const ds = isCitableValue(rawDs) ? getCitableValue(rawDs) : rawDs;
      heroDealStructure = isTaggedItem(ds)
        ? (resolveTaggedLabel('dealStructure', ds) || ds.label || ds.code)
        : String(ds);
      // Capture the source: prefer citable text, then tagged-item text,
      // then a 400-char slice of the provision text.
      const quote =
        (isCitableValue(rawDs) && getCitableText(rawDs)) ||
        (isTaggedItem(ds) && ds.text) ||
        (p.full_text ? p.full_text.slice(0, 400) : null);
      dealStructureSource = { provision: p, quote };
    }
    if (!heroMergerForm && f.mergerForm) {
      const mf = isCitableValue(f.mergerForm) ? getCitableValue(f.mergerForm) : f.mergerForm;
      heroMergerForm = isTaggedItem(mf)
        ? (resolveTaggedLabel('mergerForm', mf) || mf.label || mf.code)
        : String(mf);
    }
    if (heroDealStructure && heroMergerForm) break;
  }

  // Heuristic fallback when the extractor didn't populate the canonical
  // fields: scan the union of provision text for unambiguous structural
  // signals. Conservative — only sets values where the language is
  // unmistakable, otherwise leaves the slot empty so the user can tell the
  // extractor needs tuning.
  if (!heroDealStructure || !heroMergerForm) {
    const joined = provisions
      .map((p) => (p.full_text || '').trim())
      .filter(Boolean)
      .join('\n\n');
    if (joined) {
      if (!heroDealStructure) {
        if (/\bTender\s+Offer\b/i.test(joined) || /\bExchange\s+Offer\b/i.test(joined)) {
          heroDealStructure = 'Two-step Tender Offer';
        } else if (/\bScheme\s+of\s+Arrangement\b/i.test(joined)) {
          heroDealStructure = 'Scheme of Arrangement';
        } else if (/\bAsset\s+Purchase\b/i.test(joined)) {
          heroDealStructure = 'Asset Purchase';
        } else if (/\bagreement\s+and\s+plan\s+of\s+merger\b/i.test(joined)) {
          heroDealStructure = 'One-step Merger';
        }
      }
      if (!heroMergerForm) {
        // "Merger Sub shall merge with and into Company; Company is surviving"
        // is the canonical reverse-triangular form.
        const subIntoCompany = /(?:Merger\s+Sub|Sub).{0,80}?merge\s+with\s+and\s+into\s+(?:the\s+)?Company/i.test(joined);
        const companyIntoParent = /(?:the\s+)?Company.{0,80}?merge\s+with\s+and\s+into\s+(?:Parent|Acquir\w+|Buyer)/i.test(joined);
        const companyIntoSub = /(?:the\s+)?Company.{0,80}?merge\s+with\s+and\s+into\s+(?:Merger\s+Sub|Sub)/i.test(joined);
        if (subIntoCompany) heroMergerForm = 'Reverse Triangular Merger';
        else if (companyIntoSub) heroMergerForm = 'Forward Triangular Merger';
        else if (companyIntoParent) heroMergerForm = 'Direct Merger';
      }
    }
  }

  // Per-category condensed rendering + forced row order. We classify each
  // STRUCT provision into one of: merger / closing / effects / effective /
  // other, render only the most informative fields per row (no duplicate
  // text alongside the canonical pill), and sort according to STRUCT_ORDER
  // regardless of document position so the page reads:
  //
  //   1. Merger Form    (was "The Merger")
  //   2. Closing        (location + timing + deadline)
  //   3. Effects        (just the cited statute, e.g. "DGCL § 259")
  //   4. Effective Time (short phrasing: "Upon filing with DE SOS")
  //   5. Anything else  (mainConcept fallback, then alphabetical)
  const STRUCT_ORDER = ['merger', 'closing', 'effects', 'effective', 'other'];

  const classifyStruct = (p) => {
    const cat = (p.category || '').toLowerCase();
    if (cat.includes('effective')) return 'effective';
    if (cat.includes('effect') && cat.includes('merger')) return 'effects';
    if (cat.includes('closing')) return 'closing';
    if (cat.includes('merger') && !cat.includes('agreement')) return 'merger';
    return 'other';
  };

  // Render a tagged value as just the canonical label (the "button" form) —
  // strip the verbatim text companion so we don't show both label and
  // duplicate prose. Used for mergerForm.
  const renderMergerFormCell = (raw) => {
    if (!raw) return <span className="italic text-inkFaint">Not specified</span>;
    if (isCitableValue(raw)) raw = getCitableValue(raw);
    if (isTaggedItem(raw)) {
      const label = resolveTaggedLabel('mergerForm', raw) || raw.label || raw.code;
      // Audit block 6b: pass the resolved LABEL, not just the raw code — a
      // raw taxonomy code without underscores (e.g. a PascalCase slug) falls
      // through CodeBadge's fallback humanizer unchanged and leaks into the
      // pill verbatim.
      return <CodeBadge code={raw.code} label={label} />;
    }
    // Plain string — render as a pill too
    return <CodeBadge code={String(raw)} />;
  };

  // Shorten a long Effective Time provision to its essence:
  // "Upon filing of the Certificate of Merger with the Delaware Secretary of
  // State" rather than the whole sentence.
  const shortEffectiveTime = (features) => {
    const explicit = features.effectiveTimeShort;
    if (explicit) {
      const v = isCitableValue(explicit) ? getCitableValue(explicit) : explicit;
      if (v) return String(v);
    }
    // Heuristic short-form derivation from mainConcept / provision text.
    // Look for "filing ... with ... Secretary of State" phrasing and
    // compress to "Upon filing with <State> SOS".
    const concept = features.mainConcept || '';
    const m = String(concept).match(/filing\s+(?:of\s+(?:the\s+)?Certificate(?:\s+of\s+Merger)?\s+)?with\s+(?:the\s+)?(?:Secretary\s+of\s+State\s+of\s+(?:the\s+State\s+of\s+)?)?([A-Z][a-zA-Z]+)/i);
    if (m) return `Upon filing with ${m[1]} Secretary of State`;
    return null; // caller falls back to mainConcept
  };

  // Compact reference to the statute that "Effects of Merger" cites
  // (typically DGCL § 259 / § 251 / etc.).
  const shortEffectsRef = (features) => {
    const explicit = features.effectsOfMergerReference;
    if (explicit) {
      const v = isCitableValue(explicit) ? getCitableValue(explicit) : explicit;
      if (v) return String(v);
    }
    const text = features.mainConcept || '';
    const m = String(text).match(/(?:DGCL|Delaware\s+General\s+Corporation\s+Law)[^.]{0,40}?(?:§|Section)\s*(\d+(?:\([a-z]\))?)/i);
    if (m) return `DGCL § ${m[1]}`;
    return null;
  };

  // Block 6: shorten verbose governance rows to one-line shorthand — the
  // Certificate of Incorporation row reads "Per Exhibit A", Bylaws "Per
  // Merger Sub's bylaws", Directors & Officers "Per Merger Sub". Derived
  // from the extracted values / provision text where the pattern is
  // unmistakable; the full text stays available on hover (row HoverSource).
  const shortGovernance = (p, features) => {
    const cat = String(p.category || '');
    const text = [
      typeof features.mainConcept === 'string' ? features.mainConcept : '',
      String(p.full_text || '').slice(0, 1200),
    ].join(' ');
    // Audit block 6c: a single provision's category sometimes covers BOTH
    // topics at once ("Certificate of Incorporation / Bylaws") — the
    // charter-first branch below would match on the "charter" alternative
    // and return only the charter half, silently dropping the bylaws
    // treatment. Detect the combined case first and render both halves.
    const isCharterCat = /certificate\s+of\s+incorporation|charter/i.test(cat);
    const isBylawsCat = /bylaws/i.test(cat);
    if (isCharterCat && isBylawsCat) {
      const exMatch = text.match(/Exhibit\s+([A-Z])\b/i);
      const charterHalf = exMatch
        ? `per Exhibit ${exMatch[1].toUpperCase()}`
        : (/certificate\s+of\s+incorporation\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text) ? "per Merger Sub's" : null);
      const bylawsHalf = /bylaws\s+of\s+(?:the\s+)?Merger\s+Sub|Merger\s+Sub(?:'s)?[^.]{0,60}bylaws/i.test(text)
        ? "per Merger Sub's"
        : (exMatch ? `per Exhibit ${exMatch[1].toUpperCase()}` : null);
      if (charterHalf || bylawsHalf) {
        const parts = [];
        if (charterHalf) parts.push(`Charter: ${charterHalf}`);
        if (bylawsHalf) parts.push(`Bylaws: ${bylawsHalf}`);
        return parts.join(' · ');
      }
      return null;
    }
    if (isCharterCat) {
      const ex = text.match(/Exhibit\s+([A-Z])\b/i);
      if (ex) return `Per Exhibit ${ex[1].toUpperCase()}`;
      if (/certificate\s+of\s+incorporation\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text)) {
        return "Per Merger Sub's certificate of incorporation";
      }
      return null;
    }
    if (/bylaws/i.test(cat)) {
      if (/bylaws\s+of\s+(?:the\s+)?Merger\s+Sub|Merger\s+Sub(?:'s)?[^.]{0,60}bylaws/i.test(text)) {
        return "Per Merger Sub's bylaws";
      }
      const ex = text.match(/Exhibit\s+([A-Z])\b/i);
      if (ex) return `Per Exhibit ${ex[1].toUpperCase()}`;
      return null;
    }
    if (/directors?\s*(?:&|and)\s*officers?|directors?\s+of\s+the\s+surviving|officers?\s+of\s+the\s+surviving/i.test(cat)) {
      if (/(?:directors?|officers?)\s+of\s+(?:the\s+)?Merger\s+Sub/i.test(text)) {
        return 'Per Merger Sub';
      }
      return null;
    }
    return null;
  };

  const rows = provisions.map((p) => {
    const features = getStructuredFeatures(p) || {};
    const kind = classifyStruct(p);
    let displayCategory = p.category || 'General';
    let cells;
    if (kind === 'merger') {
      displayCategory = 'Merger Form';
      cells = [{ key: 'mergerForm', raw: features.mergerForm, render: renderMergerFormCell }];
    } else if (kind === 'closing') {
      // Only surface Closing Deadline as its own row when it carries
      // information distinct from closingTiming — otherwise the user sees
      // the exact same sentence repeated under two labels.
      // P8 item 7: unwrap citable / object shapes on BOTH sides before the
      // equality check so a {value: "X", text: "..."} vs bare "X" pairing
      // still matches and the duplicate row is suppressed.
      const unwrap = (v) => {
        if (v === null || v === undefined) return '';
        let cur = v;
        if (isCitableValue(cur)) cur = getCitableValue(cur);
        if (cur === null || cur === undefined) return '';
        if (typeof cur === 'object') {
          // Tagged item ({code,label,text}) or similar — prefer the verbatim
          // text, then label, then JSON for a stable string-comparable form.
          return String(cur.text || cur.label || cur.value || JSON.stringify(cur)).trim();
        }
        return String(cur).trim();
      };
      const explicitDeadlineRaw = features.mutualClosingDeadlineAfterConditionsDays
        ?? features.closingDeadline
        ?? null;
      const explicitDeadlineStr = unwrap(explicitDeadlineRaw);
      const closingTimingStr = unwrap(features.closingTiming);
      cells = [
        { key: 'closingLocation', raw: features.closingLocation },
        { key: 'closingTiming', raw: features.closingTiming },
      ];
      if (
        explicitDeadlineStr !== ''
        && explicitDeadlineStr !== closingTimingStr
      ) {
        cells.push({
          key: 'closingDeadline',
          label: 'Closing Deadline',
          raw: typeof explicitDeadlineRaw === 'number'
            ? `${explicitDeadlineRaw} days after conditions satisfied`
            : explicitDeadlineRaw,
        });
      }
    } else if (kind === 'effects') {
      const ref = shortEffectsRef(features);
      cells = [{ key: 'effectsRef', raw: ref || features.mainConcept }];
    } else if (kind === 'effective') {
      const shortTime = shortEffectiveTime(features);
      cells = [{ key: 'effectiveTime', raw: shortTime || features.mainConcept }];
    } else {
      const short = shortGovernance(p, features);
      cells = short
        ? [{
            key: 'mainConcept',
            raw: short,
            // One-line shorthand only; full text lives in the row hover.
            render: (raw) => <div className="line-clamp-1">{raw}</div>,
          }]
        : [{ key: 'mainConcept', raw: features.mainConcept }];
    }
    return { p, kind, cells, displayCategory };
  });

  // Force canonical ordering.
  rows.sort((a, b) => {
    const ai = STRUCT_ORDER.indexOf(a.kind);
    const bi = STRUCT_ORDER.indexOf(b.kind);
    if (ai !== bi) return ai - bi;
    return String(a.displayCategory).localeCompare(String(b.displayCategory));
  });

  // Humanize a canonical UPPER_SNAKE deal-structure code to readable speech:
  //   ONE_STEP_MERGER          -> "One-step merger"
  //   TWO_STEP_TENDER_OFFER    -> "Two-step tender offer"
  //   SCHEME_OF_ARRANGEMENT    -> "Scheme of arrangement"
  // Already-humanized strings ("One-step Merger" from the heuristic
  // fallback) pass through unchanged.
  const humanizeDealStructure = (s) => {
    if (!s || typeof s !== 'string') return s;
    if (!/^[A-Z][A-Z0-9_]+$/.test(s)) return s; // already human-cased
    return s
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/\b(one|two|three|four|five)\s+step/i, (m) => m.replace(/\s+/, '-'));
  };

  // Synthesize a "Deal Structure" row at the very top of the table — this
  // used to live in a separate hero box but the user wants it as a regular
  // table row in human speech, AND clickable to source like Merger Form.
  //
  // Source resolution:
  //   - When extracted from a STRUCT provision, dealStructureSource carries
  //     { provision, quote } captured above.
  //   - For the heuristic fallback (no extracted value), find the "The Merger"
  //     STRUCT provision and use a short slice as the source quote.
  if (heroDealStructure) {
    const humanized = humanizeDealStructure(heroDealStructure);
    let src = dealStructureSource;
    if (!src) {
      // Heuristic-fallback path: pick the "merger" STRUCT provision (or any
      // STRUCT provision with text) so the click still jumps somewhere useful.
      const mergerProv = provisions.find((p) => /merger/i.test(p.category || '') && p.full_text)
        || provisions.find((p) => p.full_text);
      if (mergerProv) {
        src = { provision: mergerProv, quote: mergerProv.full_text.slice(0, 400) };
      }
    }
    rows.unshift({
      // Synthesized provision id; the synth-row label-click handler below
      // routes the click to `useShowEvidence(synthEvidence)` rather than
      // opening the edit panel. Carry the source quote on the synth p so
      // the table render finds it.
      p: {
        id: '__synth_deal_structure',
        category: 'Deal Structure',
        _synthEvidence: src?.quote || null,
      },
      kind: 'structure',
      displayCategory: 'Deal Structure',
      cells: [{
        key: 'dealStructure',
        raw: humanized,
        // Canonical taxonomy value — render as a CodeBadge pill (same
        // visual treatment as Merger Form below) so it's clear this is a
        // normalized value selected from a dictionary, not free text.
        render: (raw) =>
          raw
            ? <CodeBadge code={raw} />
            : <span className="italic text-inkFaint">Not specified</span>,
      }],
    });
  }

  return (
    <div className="space-y-3">
{/* Hero box removed — Deal Structure + Merger Form render as the first
        two rows of the table below so all structure info lives in one place
        and reads as human speech, not as a separate styled callout. */}
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Structure &amp; Mechanics
        </p>
      </div>
      <table className="min-w-full text-xs font-ui">
        <thead className="bg-bg/60 border-b border-border">
          <tr>
            <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Term</th>
            <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ p, cells, displayCategory }) => {
            const isSynth = typeof p.id === 'string' && p.id.startsWith('__synth');
            // Resolve a source quote for the row — for synth rows use the
            // captured _synthEvidence; for real rows take the first cell with a
            // citable / tagged quote, falling back to the provision's full_text
            // (all via the shared resolveEvidence path).
            const buildRowQuote = () => {
              if (isSynth) return p._synthEvidence || null;
              for (const c of cells) {
                const q = evidenceQuote(c.raw, { fallbackToFullText: false });
                if (q) return q;
              }
              return evidenceQuote(null, { provision: p });
            };
            const rowQuote = buildRowQuote();
            const detailsClickable = !!(rowQuote && showEvidence);
            const truncateTip = (s, n = 220) => {
              const t = String(s || '').trim().replace(/\s+/g, ' ');
              return t.length > n ? t.slice(0, n) + '…' : t;
            };
            return (
            <tr key={p.id} className="hover:bg-bg/40 transition-colors align-top">
              <td className="px-3 py-2 whitespace-normal break-words">
                {isSynth ? (
                  p._synthEvidence ? (
                    <button
                      type="button"
                      onClick={() => showEvidence(p._synthEvidence)}
                      className="text-left text-accent hover:underline font-medium"
                      title={truncateTip(p._synthEvidence)}
                    >
                      {displayCategory}
                    </button>
                  ) : (
                    <span className="text-ink font-medium">{displayCategory}</span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectProvision && onSelectProvision(p)}
                    className="text-left text-accent hover:underline font-medium"
                  >
                    {displayCategory}
                  </button>
                )}
              </td>
              <td
                className={`px-3 py-2 text-ink ${detailsClickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                onClick={detailsClickable ? () => showEvidence(rowQuote) : undefined}
              >
                <HoverSource quote={rowQuote} as="div">
                  {cells.length === 1 ? (
                    <div>
                      {cells[0].render
                        ? cells[0].render(cells[0].raw)
                        : renderFeatureCell(cells[0].key, cells[0].raw)}
                    </div>
                  ) : (
                    <dl className="space-y-1">
                      {cells.map(({ key, raw, label, render }) => (
                        <div key={key} className="flex flex-col">
                          <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{label || humanizeKey(key)}</dt>
                          <dd>{render ? render(raw) : renderFeatureCell(key, raw)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </HoverSource>
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

/* ═══════════════════════════════════════════════════════════
   STRUCTURED SUMMARY VIEW — used for multi-code types (NOSOL,
   ANTI) where each provision is its own concept and the
   row-based table format leaves most cells empty. Renders each
   provision as a card with label/value rows for the same
   features the table would show, plus a collapsible text body.
   ═══════════════════════════════════════════════════════════ */
function StructuredSummaryCard({ provision, type, onSelectProvision }) {
  const showEvidence = useShowEvidence();
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
            // Every row's value is cited back to the source: prefer the
            // value's own citable/tagged quote, fall back to a focused snippet
            // of the provision's full_text containing the value. Wrap the
            // value cell in HoverSource + click-to-evidence so the user can
            // always see what supports the displayed value — matches the
            // user's repeated "everything must link to source" requirement.
            const rowQuote = evidenceQuote(raw, { provision });
            const wrap = (node) => (
              <HoverSource quote={rowQuote} as="span">
                {rowQuote && showEvidence ? (
                  <button
                    type="button"
                    onClick={() => showEvidence(rowQuote)}
                    className="text-left cursor-pointer hover:underline decoration-dotted decoration-accent/60 underline-offset-2"
                  >
                    {node}
                  </button>
                ) : node}
              </HoverSource>
            );
            // Tagged single value → ONE canonical pill carrying the resolved
            // label (not a bare humanized code).
            if (isTaggedItem(raw)) {
              const label = resolveTaggedLabel(key, raw) || humanizeBadgeText(raw.code);
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="text-sm text-ink">
                    {wrap(<CodeBadge code={raw.code} label={label} />)}
                  </dd>
                </div>
              );
            }
            // List value → bulleted list (humanized labels for tagged items).
            if (Array.isArray(raw)) {
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="text-sm text-ink flex-1">
                    <ul className="list-disc list-inside space-y-0.5">
                      {raw.map((item, idx) => {
                        const itemQuote = (isTaggedItem(item) && item.text) || rowQuote;
                        const itemNode = isTaggedItem(item)
                          ? <CodeBadge code={item.code} label={resolveTaggedLabel(key, item) || humanizeBadgeText(item.code)} />
                          : <span>{String(item)}</span>;
                        return (
                          <li key={idx} className="leading-relaxed">
                            <HoverSource quote={itemQuote} as="span">
                              {itemQuote && showEvidence ? (
                                <button
                                  type="button"
                                  onClick={() => showEvidence(itemQuote)}
                                  className="text-left cursor-pointer hover:underline decoration-dotted decoration-accent/60 underline-offset-2"
                                >
                                  {itemNode}
                                </button>
                              ) : itemNode}
                            </HoverSource>
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              );
            }
            // Scalar value (incl. citable-wrapped scalar).
            const val = formatFeatureValue(raw);
            if (val === null || val === undefined || val === '') return null;
            return (
              <div key={key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <dt className="font-ui text-[11px] text-inkFaint uppercase tracking-wider sm:w-48 shrink-0">
                  {humanizeKey(key)}
                </dt>
                <dd className="text-sm text-ink whitespace-pre-wrap break-words flex-1">
                  {wrap(<span>{Array.isArray(val) ? val.join('; ') : String(val)}</span>)}
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

/* P4 task 3: Clear-Skies IOC fallback renderer. When the ANTI Clear-Skies row
 * has no direct hit, scan IOC provisions for restrictions that approximate a
 * clear-skies covenant (acquisition / merger / joint venture / business
 * combination / asset sale / new line of business / investment). Returns a
 * React node with the matched concepts + clickable section refs. */
const CLEAR_SKIES_CONCEPT_RE = /(?:acquisition|merger|joint\s+venture|business\s+combination|asset\s+sale|new\s+line\s+of\s+business|investment)/i;
function renderClearSkiesIocFallback(allProvisions, side) {
  const ALL = Array.isArray(allProvisions) ? allProvisions : [];
  // side === 'company': target IOC restricts company action — type IOC or IOC-T.
  // side === 'parent':  parent IOC restricts parent action — type IOC-B.
  const matches = ALL.filter((p) => {
    if (!p) return false;
    if (side === 'parent') {
      return p.type === 'IOC-B';
    }
    return p.type === 'IOC' || p.type === 'IOC-T';
  }).filter((p) => CLEAR_SKIES_CONCEPT_RE.test(String(p.category || '')));

  if (matches.length === 0) {
    return <span className="italic text-inkFaint">Not present in this agreement</span>;
  }

  // Build concept-label set for the prose: lowercase the matched regex chunks.
  const conceptSet = new Set();
  for (const p of matches) {
    const m = CLEAR_SKIES_CONCEPT_RE.exec(String(p.category || ''));
    if (m) conceptSet.add(m[0].toLowerCase());
  }
  const conceptList = Array.from(conceptSet).join(', ');

  // Per the table design contract, no section citations render in-cell —
  // the source language is reachable on hover; matched IOC provisions are
  // navigable from their own section.
  const hoverQuote = matches
    .map((p) => String(p.full_text || '').trim())
    .filter(Boolean)
    .join('\n\n') || null;

  return (
    <HoverSource quote={hoverQuote}>
      <span className="text-ink">
        No standalone clear-skies covenant. IOC restricts {conceptList} (see interim operating covenants).
      </span>
    </HoverSource>
  );
}

// CATEGORY_SUMMARY_FEATURES now lives in lib/category-summary-features.js

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

function CategoryFeatureSummaryTable({ provisions, type, onSelectProvision, hideProvisionsList, excludeProvisionIds, allProvisions, deal }) {
  const spec = CATEGORY_SUMMARY_FEATURES[type] || [];
  const excludeSet = excludeProvisionIds instanceof Set ? excludeProvisionIds : null;
  const showEvidence = useShowEvidence();
  // Synthesize outsideDateMonths from announce_date + outsideDate when the
  // extractor left months null but the parties' calendar dates are known.
  // Returns a number (rounded) or null.
  const computeOutsideDateMonths = () => {
    if (!deal || !deal.announce_date) return null;
    let outsideDateStr = null;
    for (const p of provisions) {
      const f = getStructuredFeatures(p) || {};
      const raw = f.outsideDate;
      const unwrapped = isCitableValue(raw) ? getCitableValue(raw) : raw;
      if (typeof unwrapped === 'string' && unwrapped.trim()) {
        outsideDateStr = unwrapped.trim();
        break;
      }
    }
    if (!outsideDateStr) return null;
    const od = new Date(outsideDateStr);
    const ad = new Date(deal.announce_date);
    if (Number.isNaN(od.getTime()) || Number.isNaN(ad.getTime())) return null;
    const monthsFloat = (od.getFullYear() - ad.getFullYear()) * 12 + (od.getMonth() - ad.getMonth()) + (od.getDate() - ad.getDate()) / 30.4375;
    return Math.round(monthsFloat);
  };
  const derivedOutsideDateMonths = computeOutsideDateMonths();

  // For each spec row, resolve its hit. MAE rows with `maeCode` resolve via
  // findCarveoutByCode against features.carveouts (taxonomy-tagged list).
  // P4 task 3: rows can declare an optional `customRender(provisions, allProvisions)`
  // which short-circuits the default value-resolution path. The shared spec
  // (lib/category-summary-features.js) carries a string `customRenderKey`
  // marker instead of a function (so the data module stays React-free); map it
  // back to the local renderer here. Legacy inline `customRender` still honored.
  const CUSTOM_RENDERERS = {
    clearSkiesIocCompany: (provisions, allProvisions) => renderClearSkiesIocFallback(allProvisions, 'company'),
    clearSkiesIocParent: (provisions, allProvisions) => renderClearSkiesIocFallback(allProvisions, 'parent'),
  };
  const rawRows = spec.map((row, originalIdx) => {
    let hit = null;
    if (row.maeCode) {
      hit = findCarveoutByCode(provisions, row.maeCode);
      if (!hit && row.keys && row.keys.length > 0) {
        hit = pickFirstNonEmpty(provisions, row.keys);
      }
    } else if (row.keys && row.keys.length > 0) {
      hit = pickFirstNonEmpty(provisions, row.keys);
    }
    // Synthesize outsideDateMonths from announce_date + outsideDate when the
    // extractor didn't populate it but we can compute the gap from the deal
    // record. Renders as "<N> months (calculated)".
    if (!hit && row.keys && row.keys.includes('outsideDateMonths') && derivedOutsideDateMonths !== null) {
      hit = {
        value: `${derivedOutsideDateMonths} months (calculated from agreement date)`,
        key: 'outsideDateMonths',
        provision: null,
      };
    }
    // Public-deal default: reps don't survive closing in a public-target M&A
    // merger agreement. When the deal has an SEC-filings rep (REP-T-SEC) and
    // the extractor didn't emit a survival value, synthesize the canonical
    // public-deal answer so the row doesn't read "Not present".
    if (!hit && row.keys) {
      const survivalKeys = new Set(['repsSurvivalPresent', 'repsSurvivalDuration', 'repsSurvivalExceptions']);
      const isSurvivalRow = row.keys.some((k) => survivalKeys.has(k));
      if (isSurvivalRow) {
        const sections = (deal && deal.metadata && Array.isArray(deal.metadata.classified_sections))
          ? deal.metadata.classified_sections
          : [];
        const isPublic = sections.some((s) => s && (s.code === 'REP-T-SEC' || s.code === 'REP-T-PROXY'));
        if (isPublic) {
          if (row.keys.includes('repsSurvivalPresent')) {
            hit = { value: 'No — public-target deal; representations do not survive Closing', key: 'repsSurvivalPresent', provision: null };
          } else if (row.keys.includes('repsSurvivalDuration')) {
            hit = { value: '0 (public-target deal)', key: 'repsSurvivalDuration', provision: null };
          } else if (row.keys.includes('repsSurvivalExceptions')) {
            hit = { value: 'None — public-target deal', key: 'repsSurvivalExceptions', provision: null };
          }
        }
      }
    }
    const customRender = row.customRender || (row.customRenderKey ? CUSTOM_RENDERERS[row.customRenderKey] : null) || null;
    return { label: row.label, hit, lookupKey: (row.keys && row.keys[0]) || row.maeCode || null, originalIdx, customRender };
  });
  // P3 item 5: stable sort — populated rows first (in original order), then
  // "Not present" rows (in original order). Keeps the summary scannable.
  const rows = [...rawRows].sort((a, b) => {
    const aPresent = a.hit !== null && a.hit !== undefined;
    const bPresent = b.hit !== null && b.hit !== undefined;
    if (aPresent !== bPresent) return aPresent ? -1 : 1;
    return a.originalIdx - b.originalIdx;
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
                <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Feature</th>
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
                rows.map((row) => {
                  // P4 task 3: per-row customRender escape hatch. When the
                  // default hit is null AND a customRender is supplied, the
                  // renderer is called with (provisions, allProvisions) and
                  // its return value replaces the default value cell.
                  const customNode = row.customRender && !row.hit
                    ? row.customRender(provisions, allProvisions || provisions)
                    : null;
                  // Compose a source quote for click-to-source via the shared
                  // resolveEvidence path (citable quotes → tagged text →
                  // provision full_text fallback).
                  const quote = row.hit
                    ? evidenceQuote(row.hit.value, { provision: row.hit.provision })
                    : null;
                  const clickable = !!(quote && showEvidence) && !customNode;
                  const onClick = clickable ? () => showEvidence(quote) : undefined;
                  return (
                    <tr key={row.label} className="hover:bg-bg/40 transition-colors">
                      <td className={`px-3 py-2 align-top whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                        {/* FB3: TermCell is the ONE shared wrapper for
                            card click-through (Surface 1) + "see text"
                            pop-under (Surface 2) — degrades to a plain
                            label when this row has no backing provision
                            (row.hit null / customRender rows). */}
                        <TermCell provision={row.hit && row.hit.provision} quote={quote}>
                          {clickable ? (
                            <HoverSource quote={quote}>
                              <span className="text-left text-accent hover:underline font-medium">
                                {row.label}
                              </span>
                            </HoverSource>
                          ) : (
                            <span className="text-ink font-medium">{row.label}</span>
                          )}
                        </TermCell>
                      </td>
                      <td
                        className={`px-3 py-2 align-top text-ink whitespace-pre-wrap break-words ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                        onClick={onClick}
                      >
                        <HoverSource quote={quote} as="div">
                          {customNode !== null && customNode !== undefined
                            ? customNode
                            : renderSummaryRowValue(row.hit, row.lookupKey)}
                        </HoverSource>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!hideProvisionsList && (() => {
        const filtered = excludeSet
          ? sortedProvs.filter((p) => !excludeSet.has(p.id))
          : sortedProvs;
        if (filtered.length === 0) return null;
        return (
        <div className="bg-bg/40 border border-border rounded-lg px-3 py-2">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1.5">
            Provisions in this section
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {filtered.map((p) => (
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
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TERMF — 3-section rebuild (P4 Task 1)
   ═══════════════════════════════════════════════════════════
   Replaces the generic CategoryFeatureSummaryTable for TERMF with:
     • TermfHero          — top-of-page headline (fee + % + naked-no-vote)
     • TermfTriggerMatrix — bringdown-style table of canonical triggers
     • TermfTailMechanics — tail-fee structural detail (only when present) */

/* SectionRef (the font-mono click-to-source citation chip) is gone: per the
 * table design contract, section citations never render as table content —
 * the mono-font chips were also the "font is off in some places" bug. */

// Unwrap citable + format a single scalar value for the TERMF hero.
// Parse a USD amount from a number, a citable wrapper, an object {amount},
// or a string like "$190,000,000" / "$190 million" / "$1.3 billion". Returns a
// Number of dollars, or null if nothing parseable.
function parseDollarAmount(raw) {
  let v = isCitableValue(raw) ? getCitableValue(raw) : raw;
  if (v && typeof v === 'object' && !Array.isArray(v)) v = v.amount != null ? v.amount : v.value;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const s = v.replace(/,/g, '');
  const m = s.match(/\$?\s*(\d+(?:\.\d+)?)\s*(billion|bn|million|mm|m|thousand|k)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'billion' || unit === 'bn') n *= 1e9;
  else if (unit === 'million' || unit === 'mm' || unit === 'm') n *= 1e6;
  else if (unit === 'thousand' || unit === 'k') n *= 1e3;
  return n;
}

// Audit block 7: reusable "$X (≈Y% of deal value)" computation, shared
// between the TERMF hero (which pioneered the pattern) and IOC threshold
// pills. Returns the percentage as a string (no "%" suffix) or null when
// the deal value is unknown, the amount doesn't parse, or the ratio would
// be a nonsensical >100%. `decimals` defaults tighter than the hero's — IOC
// thresholds are usually a small fraction of a percent (e.g. "≈0.04%"),
// where the hero's 1-decimal rounding would collapse to "0.0%".
function pctOfDealValue(amountRaw, deal, decimals = 2) {
  const dv = deal && Number(deal.value_usd);
  if (!dv || !Number.isFinite(dv) || dv <= 0) return null;
  const amountNum = parseDollarAmount(amountRaw);
  if (!amountNum) return null;
  const pct = (amountNum / dv) * 100;
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return pct.toFixed(decimals);
}

function termfHeroDisplay(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const inner = isCitableValue(raw) ? getCitableValue(raw) : raw;
  if (inner === null || inner === undefined || inner === '' || inner === false) return null;
  if (isTaggedItem(inner)) return inner.label || inner.code || null;
  if (typeof inner === 'boolean') return inner ? 'Yes' : null;
  return String(inner);
}

// Pull a single citable quote from any of the supplied raw values.
function termfFirstQuote(...raws) {
  for (const raw of raws) {
    if (!isCitableValue(raw)) continue;
    const q = getCitableQuotes(raw);
    if (q.length > 0) return q[0];
  }
  return null;
}

/* Canonical TERMF trigger specs (used by TermfTriggerMatrix). Each spec
 * carries:
 *   - label:       row title
 *   - match:       (provision) => boolean ; matches deal provisions
 *   - getClauses:  (matchedProv, features) => string[] of section refs
 *   - getFee:      (matchedProv, features) => string|null ; fee amount cell */
const TERMF_TRIGGER_SPECS = [
  {
    key: 'nakedNoVote',
    label: 'Naked No-Vote',
    match: (p) => /no\s*-?\s*vote|naked/i.test(p.category || ''),
  },
  {
    key: 'recommendationChange',
    label: 'Recommendation Change',
    match: (p) => /recommendation\s+change|adverse\s+recommendation/i.test(p.category || ''),
  },
  {
    key: 'companyTermSuperior',
    label: 'Company Termination for Superior Proposal',
    match: (p) => /superior\s+proposal/i.test(p.category || ''),
  },
  // Tail row is handled separately (always present when tailFeeWindowMonths
  // is populated; uses tailFeeActivatingClauses).
];

// Extract section references from a provision: prefer features.triggerTerminationClauses;
// fall back to scanning full_text for /Section\s+\d+\.\d+(?:\(\w+\))*/g.
function termfExtractClauseRefs(prov, features) {
  const out = [];
  const ttc = features ? features.triggerTerminationClauses : null;
  if (Array.isArray(ttc)) {
    for (const item of ttc) {
      if (typeof item === 'string' && item.trim()) out.push(item.trim());
    }
  }
  if (out.length === 0 && prov && typeof prov.full_text === 'string') {
    const re = /Section\s+\d+\.\d+(?:\([A-Za-z0-9]+\))*/g;
    const seen = new Set();
    let m;
    while ((m = re.exec(prov.full_text)) !== null) {
      const ref = m[0];
      if (!seen.has(ref)) {
        seen.add(ref);
        out.push(ref);
      }
      if (out.length >= 4) break;
    }
  }
  return out;
}

// Extract the per-trigger fee amount: prefer features.triggers[] entries
// (P3 schema: { name, terminationClauses, feeAmount, feeAmountPct }).
function termfTriggerFee(spec, prov, features, fallback) {
  if (features && Array.isArray(features.triggers)) {
    for (const t of features.triggers) {
      if (!t || typeof t !== 'object') continue;
      const name = String(t.name || '').toLowerCase();
      const m = (() => {
        if (spec.key === 'nakedNoVote') return /no\s*-?\s*vote|naked/i.test(name);
        if (spec.key === 'recommendationChange') return /recommendation/i.test(name);
        if (spec.key === 'companyTermSuperior') return /superior/i.test(name);
        return false;
      })();
      if (m) {
        const fa = t.feeAmount || t.fee_amount;
        const pct = t.feeAmountPct || t.fee_amount_pct;
        if (fa) return String(fa);
        if (pct) return `${pct}%`;
      }
    }
  }
  // Per-row fallbacks.
  if (spec.key === 'nakedNoVote' && features) {
    const v = termfHeroDisplay(features.nakedNoVoteFeeAmount);
    if (v) return v;
  }
  return fallback || 'Same as headline';
}

/* TermfTriggerMatrix — bringdown-style mini-table. Rows for canonical
 * triggers + a "Tail Fee" row when tailFeeWindowMonths is populated. */
function TermfTriggerMatrix({ provisions, allProvisions, deal }) {
  const showEvidence = useShowEvidence();
  // Headline fallbacks for the Fee Amount cell.
  const headlineHit = pickFirstNonEmpty(provisions, ['feeAmount', 'companyTerminationFee']);
  const headlineFee = (() => {
    if (!headlineHit) return null;
    return termfHeroDisplay(headlineHit.value);
  })();

  // PRIMARY: one row per derived trigger object. The normalizer flattens each
  // fee provision's `companyTerminationFee.triggers` strings into a top-level
  // `triggers[]` of { name, terminationClauses, feeAmount, feeAmountPct,
  // sourceText }. A single "Company Termination Fee" provision therefore yields
  // one row per actual trigger — Superior Proposal / Recommendation Change /
  // No-Vote / End-Date — instead of trying to match 3 hardcoded category specs
  // (which never matched the real provision categories). De-dupe by name.
  let rows = [];
  const seenTrigger = new Set();
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (!Array.isArray(f.triggers)) continue;
    for (const t of f.triggers) {
      if (!t || typeof t !== 'object') continue;
      const name = String(t.name || '').trim();
      if (!name) continue;
      const dedupKey = name.toLowerCase();
      if (seenTrigger.has(dedupKey)) continue;
      seenTrigger.add(dedupKey);
      const clauses = Array.isArray(t.terminationClauses) && t.terminationClauses.length
        ? t.terminationClauses
        : termfExtractClauseRefs(p, f);
      const fee = t.feeAmount
        ? String(t.feeAmount)
        : (t.feeAmountPct ? `${t.feeAmountPct}%` : (headlineFee || 'Same as headline'));
      rows.push({
        spec: { key: `trigger-${dedupKey}`, label: name },
        matched: { full_text: t.sourceText || p.full_text || '' },
        clauses,
        party: t.party || null,
        fee,
      });
    }
  }

  // FALLBACK (older data with no derived triggers): the legacy 3 category specs.
  if (rows.length === 0) {
    rows = TERMF_TRIGGER_SPECS.map((spec) => {
      const matched = provisions.find(spec.match) || null;
      const f = matched ? getStructuredFeatures(matched) : null;
      const clauses = matched ? termfExtractClauseRefs(matched, f) : [];
      const fee = matched ? termfTriggerFee(spec, matched, f, headlineFee) : null;
      return { spec, matched, clauses, fee };
    });
  }

  // (No tail row here — the dedicated Tail Mechanics table below covers the
  // tail fee in full; a "Tail Fee" trigger row only added a redundant
  // "who can terminate = N/A" line.)

  // Headline % of equity value (folded in from the old hero per user request).
  const pctHit = pickFirstNonEmpty(provisions, ['feePercentage', 'terminationFeePercentEquityValue']);
  const headlinePct = (() => {
    if (!pctHit) return null;
    const v = termfHeroDisplay(pctHit.value);
    if (!v) return null;
    return /^\d+(\.\d+)?$/.test(String(v).trim()) ? `${v}%` : v;
  })();
  const headlineFeeQuote = headlineHit ? termfFirstQuote(headlineHit.value) : null;

  // Computed fee-as-% of deal value. Merger agreements state a fixed dollar fee
  // and almost never a "% of equity value" figure (so headlinePct is usually
  // null), but the user wants the ratio. Parse the headline dollar amount and
  // divide by the deal's value_usd; label it as an approximation.
  const computedPct = (() => {
    if (headlinePct) return null; // contract gave an explicit %, prefer it
    const dv = deal && Number(deal.value_usd);
    if (!dv || !Number.isFinite(dv) || dv <= 0) return null;
    const raw = headlineHit ? (isCitableValue(headlineHit.value) ? getCitableValue(headlineHit.value) : headlineHit.value) : null;
    const feeNum = parseDollarAmount(raw != null ? raw : headlineFee);
    if (!feeNum) return null;
    const pct = (feeNum / dv) * 100;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
    return pct.toFixed(1);
  })();

  // Naked no-vote row: show the amount when present, an explicit "No" when not.
  const nakedHit = pickFirstNonEmpty(provisions, ['nakedNoVoteFeePresent', 'nakedNoVoteFee']);
  const nakedPresent = (() => {
    if (!nakedHit) return false;
    const v = isCitableValue(nakedHit.value) ? getCitableValue(nakedHit.value) : nakedHit.value;
    return v === true || v === 'true' || v === 'yes';
  })();
  const nakedAmount = termfHeroDisplay(pickFirstNonEmpty(provisions, ['nakedNoVoteFeeAmount'])?.value);

  const allRows = rows;

  // Sort: present rows first (matched non-null), absent rows to the bottom.
  const sorted = [...allRows].sort((a, b) => {
    const aP = !!a.matched;
    const bP = !!b.matched;
    if (aP !== bP) return aP ? -1 : 1;
    return 0;
  });

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Termination Fee — Triggers
        </p>
        {(headlineFee || headlinePct) && (
          <span className="text-[11px] font-ui text-inkMid flex items-center gap-1.5">
            <Pill text={headlineFee || '—'} quote={headlineFeeQuote} tone="amount" />
            {headlinePct && <span className="text-inkFaint">{headlinePct} of equity value</span>}
            {!headlinePct && computedPct && (
              <span className="text-inkFaint">≈{computedPct}% of deal value (computed)</span>
            )}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Trigger</th>
              {/* Audit block 8: dropped the sibling width classes — with
                  ALL three columns explicitly sized, table-fixed scaled them
                  proportionally to fill the table's rendered width (Trigger
                  measured 296px instead of 190px). Only the label column is
                  pinned; the rest flex. */}
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Who Can Terminate</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => {
              if (!row.matched) {
                return (
                  <tr key={row.spec.key} className="align-top">
                    <td className="px-3 py-2 italic text-inkFaint">{row.spec.label}</td>
                    <td className="px-3 py-2 italic text-inkFaint">—</td>
                    <td className="px-3 py-2 italic text-inkFaint">Not present</td>
                  </tr>
                );
              }
              // Per the table design contract, section/clause citations never
              // render as cell content — the row's quote (full trigger text)
              // is reachable via hover only.
              const quote = (typeof row.matched?.full_text === 'string' && row.matched.full_text.trim())
                ? row.matched.full_text
                : null;
              const clickable = !!(quote && showEvidence);
              return (
                <tr key={row.spec.key} className="align-top hover:bg-bg/40">
                  <td className="px-3 py-2 text-ink">
                    <HoverSource quote={quote} as="div">
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => showEvidence(quote)}
                          className="text-left text-accent hover:underline font-medium"
                        >
                          {row.spec.label}
                        </button>
                      ) : (
                        <span className="font-medium text-ink">{row.spec.label}</span>
                      )}
                    </HoverSource>
                  </td>
                  <td className="px-3 py-2 text-ink whitespace-nowrap">
                    {row.party || <span className="italic text-inkFaint">—</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.fee ? <Pill text={row.fee} tone="amount" /> : <span className="italic text-inkFaint">—</span>}
                  </td>
                </tr>
              );
            })}
            {/* Naked no-vote — explicit "No" when the deal carries no such fee. */}
            <tr className="align-top hover:bg-bg/40">
              <td className="px-3 py-2 text-ink font-medium">Naked no-vote fee</td>
              <td className="px-3 py-2 text-inkFaint whitespace-nowrap">—</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {nakedPresent
                  ? <Pill text={nakedAmount || 'Yes'} tone="amount" />
                  : <span className="italic text-inkFaint">No</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Parse the tail's activating-clause sentences into concise canonical
// { ref, label } pairs — the actual termination scenarios that arm the tail
// fee (End Date / No-Vote / Breach / Recommendation Change), drawn from the
// "Section X.YZ (Label)" sub-references inside each clause. Across the
// precedents the tail is armed by a deal-specific subset of the termination
// rights, so surfacing each labelled scenario (vs one long sentence) makes the
// scope readable and comparable.
function parseTailTriggerClauses(clauses) {
  const out = [];
  const seen = new Set();
  const labelled = /(Section\s+\d+\.\d+(?:\([A-Za-z0-9]+\))*)\s*\(([^)]{2,60})\)/g;
  for (const c of (clauses || [])) {
    if (typeof c !== 'string') continue;
    let m;
    let found = false;
    labelled.lastIndex = 0;
    while ((m = labelled.exec(c)) !== null) {
      found = true;
      const ref = m[1];
      const label = m[2].trim();
      const key = `${ref}|${label}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push({ ref, label }); }
    }
    if (!found) {
      const refs = c.match(/Section\s+\d+\.\d+(?:\([A-Za-z0-9]+\))*/g) || [];
      for (const r of refs) {
        const k = r.toLowerCase();
        if (!seen.has(k)) { seen.add(k); out.push({ ref: r, label: null }); }
      }
    }
  }
  return out;
}

// truncateAtWordBoundary now lives in table-logic.js (fix batch item 6 —
// clause-boundary-aware truncation, testable without a JSX harness).

/* TermfTailMechanics — only renders when tailFeeWindowMonths is populated. */
function TermfTailMechanics({ provisions, allProvisions }) {
  const showEvidence = useShowEvidence();
  // Locate the provision that holds the tail-fee fields (prefer one with
  // tailFeeWindowMonths). Combine features across provisions defensively.
  let source = null;
  let combined = {};
  for (const p of provisions) {
    const f = getStructuredFeatures(p) || {};
    if (
      f.tailFeeWindowMonths !== null && f.tailFeeWindowMonths !== undefined && f.tailFeeWindowMonths !== ''
    ) {
      source = p;
      combined = { ...combined, ...f };
      break;
    }
    combined = { ...combined, ...f };
  }
  const window = combined.tailFeeWindowMonths;
  if (window === null || window === undefined || window === '') return null;

  const baseThreshold = (() => {
    // Compare against acquisitionTransactionPctThreshold from NOSOL.
    for (const p of allProvisions || []) {
      if (!p) continue;
      const f = getStructuredFeatures(p) || {};
      const v = f.acquisitionTransactionPctThreshold;
      if (v === null || v === undefined || v === '') continue;
      const inner = isCitableValue(v) ? getCitableValue(v) : v;
      if (inner !== null && inner !== undefined && inner !== '') return inner;
    }
    return null;
  })();

  const activating = (() => {
    const v = combined.tailFeeActivatingClauses;
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim());
    return [];
  })();

  const sameRequiredRaw = combined.tailFeeSameProposalRequired;
  const sameRequired = isCitableValue(sameRequiredRaw) ? getCitableValue(sameRequiredRaw) : sameRequiredRaw;
  // Whether the tail fee requires the SAME proposal (one announced during
  // pendency) vs ANY later proposal turns on the article in the language —
  // "a bona fide … Proposal" (any) vs "the/such bona fide … Proposal" (same).
  // Per user: this is the real distinction, so derive it from the text when the
  // boolean flag is absent. NOTE: `activating` must be declared above this —
  // referencing it before its `const` is a temporal-dead-zone crash.
  const proposalScopeLabel = (() => {
    if (sameRequired === true || sameRequired === 'true' || sameRequired === 'yes') {
      return 'Same proposal — must be the proposal announced during pendency';
    }
    if (sameRequired === false || sameRequired === 'false' || sameRequired === 'no') {
      return 'Any proposal — any later Company Takeover Proposal triggers';
    }
    const propTerm = '(?:Company\\s+)?(?:Takeover|Alternative|Acquisition)\\s+(?:Proposal|Transaction)';
    const txt = [source ? source.full_text : '', ...activating].filter(Boolean).join('  ');
    const hasThe = new RegExp(`\\b(?:the|such)\\s+bona\\s+fide\\b`, 'i').test(txt)
      || new RegExp(`\\b(?:the\\s+same|such)\\s+${propTerm}`, 'i').test(txt);
    const hasA = /\ba\s+bona\s+fide\b/i.test(txt)
      || new RegExp(`\\ba\\s+(?:bona\\s+fide\\s+)?${propTerm}`, 'i').test(txt);
    if (hasThe && !hasA) return 'Same proposal — language refers to "the"/"such" proposal';
    if (hasA) return 'Any proposal — language refers to "a …" proposal';
    return null;
  })();

  const windowDisplay = (() => {
    const inner = isCitableValue(window) ? getCitableValue(window) : window;
    const formatted = formatDurationWithUnits(inner, 'tailFeeWindowMonths') || `${inner} months`;
    // Audit block 5: the extractor sometimes returns the whole verbatim tail
    // clause — with its own internal section cites — instead of a clean
    // duration. Strip citation fragments and cap length; the full clause
    // stays reachable via this row's evidence hover (quote, below).
    const cleaned = stripSectionCitations(String(formatted));
    return cleaned.length > 60 ? `${cleaned.slice(0, 59)}…` : cleaned;
  })();
  const thresholdRaw = combined.tailFeeThresholdPct;
  const thresholdInner = isCitableValue(thresholdRaw) ? getCitableValue(thresholdRaw) : thresholdRaw;
  const thresholdDisplay = (() => {
    if (thresholdInner === null || thresholdInner === undefined || thresholdInner === '') return null;
    if (typeof thresholdInner === 'number' || /^\d+(\.\d+)?$/.test(String(thresholdInner).trim())) {
      return `${thresholdInner}%`;
    }
    return String(thresholdInner);
  })();
  const thresholdDiffers = (() => {
    if (thresholdInner === null || thresholdInner === undefined) return false;
    if (baseThreshold === null || baseThreshold === undefined) return false;
    return String(thresholdInner).trim() !== String(baseThreshold).trim();
  })();

  const Row = ({ label, children, quote }) => {
    const clickable = !!(quote && showEvidence);
    return (
      <tr className="align-top hover:bg-bg/40">
        <td className={`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>{label}</td>
        <td
          className={`px-3 py-2 text-ink ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
          onClick={clickable ? () => showEvidence(quote) : undefined}
        >
          <HoverSource quote={quote} as="div">{children}</HoverSource>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Tail Mechanics
        </p>
      </div>
      <table className="min-w-full text-xs font-ui">
        <tbody className="divide-y divide-border">
          <Row label="Tail window" quote={termfFirstQuote(combined.tailFeeWindowMonths)}>
            {windowDisplay}
          </Row>
          <Row
            label="Threshold % for Company Takeover (tail)"
            quote={termfFirstQuote(combined.tailFeeThresholdPct)}
          >
            {thresholdDisplay ? (
              <>
                <span>{thresholdDisplay}</span>
                {thresholdDiffers && (
                  <span className="text-inkMid italic ml-1">
                    (higher than base Acquisition Proposal threshold if applicable)
                  </span>
                )}
              </>
            ) : (
              <span className="italic text-inkFaint">Not specified</span>
            )}
          </Row>
          <Row label="Termination scenarios that arm the tail" quote={activating.join('\n\n') || null}>
            {(() => {
              // Plain-English scenario labels only — the § reference chip
              // (font-mono, citation-styled) is dropped per the table design
              // contract; the row's quote (above) carries the source text.
              const parsed = parseTailTriggerClauses(activating);
              if (parsed.length > 0) {
                const labels = parsed.map((t) => t.label).filter(Boolean);
                if (labels.length > 0) {
                  return <span>{labels.join(', ')}</span>;
                }
              }
              if (activating.length > 0) {
                return (
                  <ul className="space-y-0.5">
                    {activating.map((c, i) => (
                      <li key={i}>
                        <HoverSource quote={c}>{truncateAtWordBoundary(c, 200)}</HoverSource>
                      </li>
                    ))}
                  </ul>
                );
              }
              return <span className="italic text-inkFaint">Not specified</span>;
            })()}
          </Row>
          <Row label="Triggering proposal (same vs any)" quote={termfFirstQuote(combined.tailFeeSameProposalRequired)}>
            {proposalScopeLabel || <span className="italic text-inkFaint">Not specified</span>}
          </Row>
        </tbody>
      </table>
    </div>
  );
}

/* TermfRemedyEffect — surfaces facts the extractor captures but the hero /
 * matrix / tail components never showed: sole-and-exclusive remedy, the
 * Fraud / Willful-Breach exception, effect of termination, late-payment
 * interest, and expense reimbursement. Reads the (augmented) provisions —
 * nested originals are still present alongside the derived flat keys. Renders
 * nothing when every row is empty. */
function TermfRemedyEffect({ provisions }) {
  const showEvidence = useShowEvidence();

  // Combine features across the TERMF provisions (each fee-type is its own
  // provision, so the remedy / effect facts are spread across several).
  let combined = {};
  for (const p of provisions || []) {
    const f = getStructuredFeatures(p) || {};
    combined = { ...combined, ...f };
  }

  const asText = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      if (typeof v.text === 'string' && v.text.trim()) return v.text.trim();
      if (Array.isArray(v.quotes)) {
        const q = v.quotes.find((x) => typeof x === 'string' && x.trim());
        if (q) return q.trim();
      }
    }
    return null;
  };
  const quoteOf = (v) => (isCitableValue(v) ? (getCitableQuotes(v)[0] || null) : null);

  // Sole & exclusive remedy.
  const soleRaw = combined.soleAndExclusiveRemedy;
  const soleBool = combined.feeSoleAndExclusiveRemedy === true
    || combined.soleRemedy === true
    || (isCitableValue(soleRaw) ? getCitableValue(soleRaw) === true : soleRaw === true);
  const soleText = asText(soleRaw);

  // Fraud / willful-breach exception(s).
  const exceptions = Array.isArray(combined.feeSoleRemedyExceptions)
    ? combined.feeSoleRemedyExceptions.filter((x) => typeof x === 'string' && x.trim())
    : [];
  const wbeText = asText(combined.willfulBreachException);
  if (wbeText && !exceptions.includes(wbeText)) exceptions.push(wbeText);

  // Effect of termination.
  const effect = asText(combined.effectOfTermination);

  // Interest on late payment.
  const interest = combined.interestOnLatePayment;
  const interestText = (() => {
    if (!interest || typeof interest !== 'object') return asText(interest);
    const rate = interest.rate ? String(interest.rate) : null;
    const base = interest.base ? String(interest.base) : null;
    if (rate && base) return `${rate} on ${base}`;
    return rate || base || null;
  })();

  // Expense reimbursement.
  const expenseCap = combined.expenseReimbursementCap
    ? String(combined.expenseReimbursementCap) : null;
  const expenseTriggers = (combined.expenseReimbursement && Array.isArray(combined.expenseReimbursement.triggers))
    ? combined.expenseReimbursement.triggers.filter((x) => typeof x === 'string' && x.trim())
    : [];

  const hasAny = soleBool || soleText || exceptions.length > 0 || effect || interestText || expenseCap || expenseTriggers.length > 0;
  if (!hasAny) return null;

  const Row = ({ label, children, quote }) => {
    const clickable = !!(quote && showEvidence);
    return (
      <tr className="align-top hover:bg-bg/40">
        <td className={`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>{label}</td>
        <td
          className={`px-3 py-2 text-ink ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
          onClick={clickable ? () => showEvidence(quote) : undefined}
        >
          <HoverSource quote={quote} as="div">{children}</HoverSource>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Remedy &amp; Effect
        </p>
      </div>
      <table className="min-w-full text-xs font-ui">
        <tbody className="divide-y divide-border">
          {(soleBool || soleText) && (
            <Row label="Sole &amp; exclusive remedy" quote={soleText || quoteOf(soleRaw)}>
              {soleBool ? 'Yes' : 'No'}
            </Row>
          )}
          {exceptions.length > 0 && (
            <Row label="Fraud / Willful-Breach exception" quote={exceptions.join('\n\n')}>
              Yes — carved out of the fee/sole-remedy bar
            </Row>
          )}
          {/* Audit block 5: "Effect of termination" (Agreement becomes void,
              specified provisions survive) is a GENERAL post-termination
              provision, not fee-specific — it belongs with the Boilerplate
              Summary, not this fee table. Point there instead of repeating
              (or truncating) the clause here. */}
          {effect && (
            <tr className="align-top">
              <td colSpan={2} className="px-3 py-2 text-[11px] font-ui italic text-inkFaint">
                General post-termination effects and remedies: see Boilerplate Summary.
              </td>
            </tr>
          )}
          {interestText && (
            <Row label="Interest on late payment">
              {interestText}
            </Row>
          )}
          {(expenseCap || expenseTriggers.length > 0) && (
            <Row label="Expense reimbursement">
              {expenseCap && <Pill text={`Cap: ${expenseCap}`} tone="amount" />}
              {expenseTriggers.length > 0 && (
                <div className="text-[11px] text-inkMid mt-1">{expenseTriggers.join(', ')}</div>
              )}
            </Row>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* TermfRebuiltSummary — top-level wrapper rendered by ProvisionTable when
 * type === 'TERMF'. Stacks the Hero / Trigger Matrix / Tail Mechanics /
 * Remedy & Effect. */
function TermfRebuiltSummary({ provisions, allProvisions, onSelectProvision, deal }) {
  // The TERMF extractor stores nested feature objects (companyTerminationFee,
  // tailProvision, …) but the three child components read FLAT keys. Augment
  // each provision's features with the derived flat keys (additive — keeps the
  // nested shapes) so the hero / matrix / tail / remedy children resolve them
  // through getStructuredFeatures unchanged. Shallow-clone so the shared
  // provision objects (reused elsewhere on the page) are never mutated.
  const augmented = (provisions || []).map((p) => {
    const meta = getAiMetadata(p) || {};
    const feats = meta.features && typeof meta.features === 'object' ? meta.features : {};
    return { ...p, ai_metadata: { ...meta, features: normalizeTermfFeatures(feats) } };
  });
  const fullList = allProvisions || provisions || [];
  // Sort provisions for the trailing "Provisions in this section" list.
  const sortedProvs = [...augmented].sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || ''), undefined, { sensitivity: 'base' }),
  );
  return (
    <div className="space-y-3">
      {/* Headline fee/% is folded into the Trigger table header (TermfHero
          removed per user feedback — the standalone amount/% card added little). */}
      <TermfTriggerMatrix provisions={augmented} allProvisions={fullList} deal={deal} />
      <TermfTailMechanics provisions={augmented} allProvisions={fullList} />
      <TermfRemedyEffect provisions={augmented} allProvisions={fullList} />
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

/* ════════════════════════════════════════════════════════════════════════
 * TERMINATION RIGHTS (non-fee) — rebuilt as a rich canonical table mirroring
 * the Termination-Fees pattern, per user. One row per canonical termination
 * right (present / "Not present"), with Who-Can-Terminate, the key negotiated
 * terms, and a § cite (hover-to-source). Below it: an Outside-Date /
 * Extensions sub-table and a cross-cutting "breach standard that blocks
 * termination" row (the proximate/principal-cause fault carve-out).
 * ════════════════════════════════════════════════════════════════════════ */
// family: which side may terminate — drives the full-span header grouping.
const TERMR_CANONICAL = [
  { key: 'mutual',    label: 'Mutual consent',              codes: ['TERMR-MUTUAL'], family: 'mutual' },
  { key: 'outside',   label: 'Outside / End Date',          codes: ['TERMR-OUTSIDE', 'TERMR-EXTENSION'], family: 'mutual' },
  { key: 'legal',     label: 'Legal restraint / order',     codes: ['TERMR-LEGAL'], family: 'mutual' },
  { key: 'vote',      label: 'Stockholder vote not obtained', codes: ['TERMR-VOTE'], family: 'mutual' },
  { key: 'breachT',   label: 'Company (Target) breach',     codes: ['TERMR-BREACH-T'], whoHint: 'Parent / Buyer', family: 'buyer' },
  { key: 'recommend', label: 'Change of Recommendation',    codes: ['TERMR-RECOMMEND'], whoHint: 'Parent / Buyer', family: 'buyer' },
  { key: 'breachB',   label: 'Parent (Buyer) breach',       codes: ['TERMR-BREACH-B'], whoHint: 'Company / Target', family: 'target' },
  { key: 'superior',  label: 'Superior Proposal',           codes: ['TERMR-SUPERIOR'], whoHint: 'Company / Target', family: 'target' },
];

const TERMR_FAMILY_LABELS = {
  mutual: 'Mutual / Either Party',
  buyer: 'Buyer / Parent May Terminate',
  target: 'Company / Target May Terminate',
};

// Canonical breach standards that block a party's right to terminate. Exact
// wording matters (per user) — classify the fault carve-out into one of these.
const TERMR_FAULT_STANDARDS = [
  { code: 'PRIMARILY_ATTRIBUTABLE', label: 'Primarily attributable to / caused by the terminating party', re: /primaril(?:y|ies)\s+(?:attributable|caused|result)/i },
  { code: 'PRINCIPAL_CAUSE', label: 'Terminating party was the principal cause', re: /principal\s+cause|principally\s+caused/i },
  { code: 'PROXIMATE_CAUSE', label: 'Proximate cause', re: /proximate(?:ly)?\s+cause/i },
  { code: 'MATERIAL_BREACH', label: "Terminating party's material breach caused the failure", re: /material\s+breach/i },
  { code: 'ANY_BREACH', label: "Any breach by the terminating party caused the failure", re: /breach\s+of\s+any\s+(?:covenant|representation|obligation)|failure\s+(?:on\s+the\s+part\s+of\s+such\s+party\s+)?to\s+(?:perform|comply)/i },
];

// Resolve the vote standard for the "Stockholder vote not obtained" right
// (e.g. "majority of outstanding common"). Primary source is the TERMR-VOTE
// provision's own voteThreshold field — that field exists precisely for this.
// When a deal's TERMR-VOTE provision didn't capture it, fall back to
// shareholder-approval-related fields on the deal's STRUCT / COND-M
// (Stockholder Approval condition) provisions per user request; otherwise the
// row omits the vote standard rather than guessing. Audit block 4b: the old
// mainCondition fallback dumped a raw, un-summarized condition sentence into
// the row — dropped. Only the dedicated (summarized) voteThreshold field is
// ever shown; the row renders nothing rather than leaking raw prose.
function termrVoteStandard(f, allProvisions) {
  const u = (v) => (isCitableValue(v) ? getCitableValue(v) : v);
  const own = u(f.voteThreshold);
  if (own) return String(own);
  for (const p of allProvisions || []) {
    if (!p) continue;
    const type = String(p.type || '');
    if (type !== 'COND-M' && type !== 'STRUCT' && type !== 'STRUCT-MERGER') continue;
    if (!/stockholder|shareholder/i.test(String(p.category || ''))) continue;
    const pf = getStructuredFeatures(p) || {};
    const vt = u(pf.voteThreshold);
    if (vt) return String(vt);
  }
  return null;
}

// Audit block 4a: materialityStandard often carries the clause verbatim,
// including its own internal section cross-references ("...the condition
// set forth in Section 7.02(a) or Section 7.02(b) would not be then
// satisfied"). Strip those citation fragments — the substance survives
// without pointing back into the agreement's own numbering; the full
// sentence remains reachable via the row's evidence hover.
function stripSectionCitations(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/,?\s*(?:as\s+)?set\s+forth\s+in\s+Sections?\s+\d+(?:\.\d+)*(?:\([a-zA-Z0-9]+\))*(?:\s*(?:,|or|and)\s*Sections?\s+\d+(?:\.\d+)*(?:\([a-zA-Z0-9]+\))*)*/gi, '')
    .replace(/,?\s*pursuant\s+to\s+Sections?\s+\d+(?:\.\d+)*(?:\([a-zA-Z0-9]+\))*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
}

// Compose the "key terms" cell for a canonical right from its features.
// `ctx` carries cross-row detail the per-right features don't have on their
// own: outsideRows (folded-in Outside-Date/Extension detail) and voteStandard
// (resolved via termrVoteStandard, which may fall back to STRUCT/COND).
function termrKeyTerms(key, f, ctx = {}) {
  const u = (v) => (isCitableValue(v) ? getCitableValue(v) : v);
  const bits = [];
  // Mutual consent: the row title already says "Mutual consent" — per user,
  // no separate key-term chip is needed here.
  if (key === 'outside') {
    for (const r of ctx.outsideRows || []) bits.push(`${r.label}: ${r.value}`);
  }
  if (key === 'legal') {
    if (u(f.restraintFinality)) bits.push('Order must be final & non-appealable');
    else bits.push('Legal restraint in effect');
  }
  if (key === 'vote') {
    bits.push(ctx.voteStandard ? `Required vote: ${ctx.voteStandard}` : 'Required stockholder vote not obtained');
  }
  if (key === 'breachT' || key === 'breachB') {
    const cd = u(f.cureDays);
    if (cd) bits.push(`Cure period: ${cd} days`);
    const ms = u(f.materialityStandard);
    if (ms) bits.push(stripSectionCitations(String(ms)));
  }
  if (key === 'superior') {
    bits.push(u(f.feeRequired) ? 'Termination fee payable' : 'No fee specified');
  }
  if (key === 'recommend' && u(f.preVoteOnlyWindow)) bits.push('Available pre-stockholder-vote only');
  return bits;
}


// Classify the fault-based exclusion standard ("primarily attributable" /
// "principal cause" / "proximate cause") from the carve-out language — the
// breach standard that blocks a party's right to terminate.
function termrFaultStandard(text) {
  if (typeof text !== 'string') return null;
  for (const s of TERMR_FAULT_STANDARDS) {
    if (s.re.test(text)) return s.label;
  }
  return 'Fault-based carve-out present (see language)';
}

function TermrRebuiltSummary({ provisions, allProvisions, onSelectProvision }) {
  const showEvidence = useShowEvidence();
  const u = (v) => (isCitableValue(v) ? getCitableValue(v) : v);

  // Gather every termination-RIGHT provision across the deal (so the one rich
  // table shows the full picture regardless of which party sub-page is open).
  const pool = (allProvisions && allProvisions.length ? allProvisions : provisions) || [];
  const termrProvs = pool.filter((p) => p && typeof p.type === 'string' && p.type.startsWith('TERMR'));
  // Boilerplate sometimes lands under a TERMR code (amendment / waiver / expenses
  // / effect-of-termination). When several provisions share a canonical code,
  // prefer a non-boilerplate one, and among those prefer the one that actually
  // carries a fee requirement (fixes e.g. a duplicate Superior-Proposal row
  // where the real right has the fee but a mis-coded preamble was picked first).
  const isTermrBoilerplate = (p) =>
    /amendment|waiver|expenses|effect\s+of\s+termination|fees\s+and\s+expenses/i.test(String(p.category || ''));
  const hasFee = (p) => {
    const fr = (getStructuredFeatures(p) || {}).feeRequired;
    const v = isCitableValue(fr) ? getCitableValue(fr) : fr;
    return v === true || (!!v && typeof v === 'object');
  };
  const byCode = (codes) => {
    const matches = termrProvs.filter((p) =>
      codes.includes(String((getAiMetadata(p) || {}).code || p.code || '')));
    if (matches.length === 0) return null;
    const nonBoiler = matches.filter((p) => !isTermrBoilerplate(p));
    const pickFrom = nonBoiler.length ? nonBoiler : matches;
    return pickFrom.find(hasFee) || pickFrom[0];
  };

  // Outside-date detail (from TERMR-OUTSIDE) — computed BEFORE the canonical
  // rows so it can be folded directly into the "Outside / End Date" row's Key
  // Terms cell instead of living in a separate table below (per user).
  const outsideProv = byCode(['TERMR-OUTSIDE', 'TERMR-EXTENSION']);
  const of = outsideProv ? (getStructuredFeatures(outsideProv) || {}) : {};
  // fb2 block 3g: the extension detail is a single derived line read from the
  // TERMR-OUTSIDE features' stored text — "Automatic extension to <date>" /
  // "Either party may elect to extend …" only when the source supports that
  // phrasing, appending "available only if all other conditions remain
  // capable of satisfaction" only when the source says so. Never invented;
  // falls back to the raw stored fields when no phrasing is derivable.
  const extensionDetail = outsideProv ? buildOutsideDateExtensionDetail(of) : null;
  const outsideRows = outsideProv ? [
    { label: 'Outside / End Date', value: u(of.outsideDate), raw: of.outsideDate },
    { label: 'Period from signing', value: u(of.outsideDateMonths), raw: of.outsideDateMonths },
    extensionDetail
      ? { label: 'Extension', value: extensionDetail, raw: of.outsideDateExtension || of.extensionConditions }
      : { label: 'Extension terms / who elects', value: u(of.outsideDateExtensionConditions) || u(of.extensionConditions), raw: of.outsideDateExtensionConditions || of.extensionConditions },
  ].filter((r) => r && r.value !== null && r.value !== undefined && r.value !== '') : [];

  // Build the canonical rows. The Outside-Date row's "quote" prefers the
  // TERMR-OUTSIDE provision (whose detail is now folded into this row) over
  // the generic TERMR-EXTENSION/mutual match.
  const rows = TERMR_CANONICAL.map((spec) => {
    const prov = spec.key === 'outside' ? (outsideProv || byCode(spec.codes)) : byCode(spec.codes);
    const f = prov ? (getStructuredFeatures(prov) || {}) : {};
    const ctx = spec.key === 'outside' ? { outsideRows }
      : spec.key === 'vote' ? { voteStandard: termrVoteStandard(f, pool) }
      : {};
    return {
      spec,
      prov,
      terms: prov ? termrKeyTerms(spec.key, f, ctx) : [],
      quote: prov && typeof prov.full_text === 'string' && prov.full_text.trim() ? prov.full_text : null,
    };
  });

  // Cross-cutting fault-based exclusion (the breach standard that blocks the
  // right to terminate). The end-date right is the canonical home of this gate,
  // so prefer the TERMR-OUTSIDE provision's faultBasedExclusion; otherwise fall
  // back to the first populated one across all rights.
  const faultOf = (p) => {
    const fbe = (getStructuredFeatures(p) || {}).faultBasedExclusion;
    const txt = fbe && typeof fbe === 'object' ? fbe.text : (typeof fbe === 'string' ? fbe : null);
    return txt && String(txt).trim() ? String(txt).trim() : null;
  };
  let faultText = outsideProv ? faultOf(outsideProv) : null;
  if (!faultText) {
    for (const p of termrProvs) {
      const txt = faultOf(p);
      if (txt) { faultText = txt; break; }
    }
  }
  const faultStandard = faultText ? termrFaultStandard(faultText) : null;

  const Cell = ({ quote, children, className }) => {
    const clickable = !!(quote && showEvidence);
    return (
      <td
        className={`px-3 py-2 text-ink ${className || ''} ${clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
        onClick={clickable ? () => showEvidence(quote) : undefined}
      >
        <HoverSource quote={quote} as="div">{children}</HoverSource>
      </td>
    );
  };

  return (
    <div className="space-y-3">
      {/* Canonical termination rights */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            Termination Rights
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs font-ui">
            <thead className="bg-bg/60 border-b border-border">
              <tr>
                <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Right</th>
                <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Key Terms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {['mutual', 'buyer', 'target'].map((fam) => {
                const famRows = rows.filter((r) => r.spec.family === fam);
                if (famRows.length === 0) return null;
                // fb2 block 3a: status dot bullet on every termination-right
                // row (same visual as the reps rows).
                const termrDot = (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: REP_ROW_DOT_GREEN,
                      flexShrink: 0,
                    }}
                  />
                );
                // Audit fix batch item 10: absent termination rights used to
                // render as their own greyed inline placeholder row per
                // right. Per the ticket, this family should get the
                // SAME (a)(c)(d) treatment as Conditions — canonical present
                // rights render as full rows, and canonical rights with no
                // matching provision collapse into ONE strikethrough
                // "not included" pill strip at the bottom of the family
                // block (see CondSingleTable's absentRows / "Conditions not
                // included" strip above — identical pattern, reused here).
                const presentFamRows = famRows.filter((row) => row.prov);
                const absentFamRows = famRows.filter((row) => !row.prov);
                return (
                  <Fragment key={fam}>
                    {/* fb2 block 3c: clearer subtitle styling for the family
                        header rows, matching the reps-side section titles. */}
                    <tr className="bg-bg/60 border-t-2 border-border">
                      <td colSpan={2} className="px-3 py-2.5 text-xs font-ui font-semibold text-inkMid uppercase tracking-wider">
                        {TERMR_FAMILY_LABELS[fam]}
                      </td>
                    </tr>
                    {presentFamRows.map((row) => (
                      <tr key={row.spec.key} className="align-top hover:bg-bg/40">
                        <Cell quote={row.quote} className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {termrDot}
                            {row.spec.label}
                          </span>
                        </Cell>
                        <Cell quote={row.quote}>
                          {row.terms.length > 0
                            ? <ul className="space-y-0.5">{row.terms.map((t, i) => <li key={i}>{t}</li>)}</ul>
                            : <span className="italic text-inkFaint">—</span>}
                        </Cell>
                      </tr>
                    ))}
                    {absentFamRows.length > 0 && (
                      <tr className="bg-bg/20">
                        <td colSpan={2} className="px-3 py-2">
                          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1">
                            Termination rights not included
                          </p>
                          <span className="flex flex-wrap gap-1.5">
                            {absentFamRows.map((row) => (
                              <span
                                key={row.spec.key}
                                className="inline-flex items-center text-[10px] font-ui px-1.5 py-0.5 rounded border bg-bg/40 text-inkFaint/70 border-border line-through"
                                title={CONDITION_ABSENT_COPY}
                              >
                                {row.spec.label}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breach standard that blocks termination — its own table, canonical
          wording (per user: specific words matter). Audit block 6d: omit
          the whole sub-table entirely when nothing was found, rather than
          rendering a one-row "No fault-based carve-out found" table. */}
      {faultStandard && (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-bg/60 border-b border-border">
            <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
              Breach Standard Blocking the Right to Terminate
            </p>
          </div>
          <table className="min-w-full text-xs font-ui">
            <tbody className="divide-y divide-border">
              <tr className="align-top hover:bg-bg/40">
                <td className={`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>Standard</td>
                <td
                  className={`px-3 py-2 text-ink ${faultText && showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
                  onClick={faultText && showEvidence ? () => showEvidence(faultText) : undefined}
                >
                  <HoverSource quote={faultText} as="div">
                    {faultStandard}
                  </HoverSource>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
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

/* P3 item 15: derive Bring Down Standard at RENDER time from the current
 * COND-B-REP / COND-S-REP bringDownTiers. This way edits to the COND tiers
 * propagate to every REP's bring-down standard without re-ingest. Falls back
 * to the stamped `linkedBringDownStandard` (set by linkBringDownToReps at
 * extract time) when no tier in allProvisions matches this REP. */
function computeBringDownStandardForRep(provision, allProvisions, repSide) {
  if (!provision || !provision.features) return null;
  const repType = repSide || provision.type;
  if (repType !== 'REP-T' && repType !== 'REP-B') return null;
  const condCode = repType === 'REP-T' ? 'COND-B-REP' : 'COND-S-REP';
  if (!Array.isArray(allProvisions)) return null;

  // Pull rep section number (best-effort).
  const f = getStructuredFeatures(provision) || {};
  const repSection = String(
    f.sectionNumber || provision.section_number || ''
  ).toLowerCase().trim();

  // Walk COND provisions' bringDownTiers and try to match against this rep.
  // Match priorities: (a) explicit reps_covered text contains this section
  // number; (b) tagged stamp on the rep already references a tier index.
  let catchAll = null;
  for (const cond of allProvisions) {
    if (!cond || cond.code !== condCode) continue;
    const cf = getStructuredFeatures(cond) || {};
    const tiers = Array.isArray(cf.bringDownTiers) ? cf.bringDownTiers : [];
    for (const tier of tiers) {
      if (!tier || typeof tier !== 'object') continue;
      const stdCode = tier.standard || tier.standardCode || tier.standard_code || null;
      const stdLabel = tier.standard_label || tier.standardLabel || stdCode || null;
      if (!stdCode) continue;
      const reps = String(tier.reps_covered || tier.repsCovered || '');
      // Catch-all detection.
      if (!catchAll && /\ball\s+other\b|\bremaining\b|\bcatch[\s-]*all\b/i.test(reps)) {
        catchAll = { code: stdCode, label: stdLabel, source: cond };
      }
      // Explicit section-number match.
      if (repSection && reps) {
        // Match either "3.05" or "3.05(a)".
        const re = new RegExp(`\\b${repSection.replace(/[.\\()]/g, (m) => '\\' + m)}\\b`, 'i');
        if (re.test(reps)) {
          return { code: stdCode, label: stdLabel, source: cond };
        }
        // Bare-number match: tier says "3.05", rep is "3.05(b)".
        const bare = repSection.replace(/\([a-z0-9]+\)$/i, '');
        if (bare !== repSection) {
          const reBare = new RegExp(`\\b${bare.replace(/[.\\]/g, '\\$&')}\\b`, 'i');
          if (reBare.test(reps)) {
            return { code: stdCode, label: stdLabel, source: cond };
          }
        }
      }
    }
  }
  if (catchAll) return catchAll;

  // Fallback: use the stamped value left by linkBringDownToReps at extract
  // time. Existing data has this stamp; new data without it returns null.
  const stamp = f.linkedBringDownStandard;
  if (isTaggedItem(stamp)) {
    return { code: stamp.code, label: stamp.label || stamp.code, source: null };
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
    // Anti-Reliance / No Other Reps placeholder removed: the No Other Reps /
    // Fraud (Abry) summary section (sidebar, end of the R&W block) is now
    // the ONE place that answers this — see components/review/
    // NoOtherRepsFraudTable.js + lib/abry.js. A second checklist row here
    // would duplicate (and could disagree with) that answer.
    { label: 'Parent Litigation',        match: { code: 'REP-B-LIT', categoryRegex: /\blitig/i } },
    { label: 'Parent Ownership of Company Stock', match: { code: 'REP-B-NOINTEREST', categoryRegex: /\bownership\b|company\s+(?:capital\s+)?stock|share\s+ownership/i } },
    { label: 'Brokers identified',       match: { code: 'REP-B-BROKERS', categoryRegex: /broker|finder/i } },
  ],
  'REP-T': [
    { label: 'Sufficiency of Assets',    match: { code: 'REP-T-SUFFICIENCY' } },
    { label: 'Top Customers / Suppliers', match: { code: 'REP-T-TOP-CUSTOMERS' } },
    // P9 item 3: Material Contracts removed from the REP-T expected-reps list
    // because it now has its own __MATERIAL_CONTRACTS sidebar page. Keeping it
    // here would re-add the provision via augmentRepsWithExpectedPlaceholders'
    // allProvisions externalHits pass (which finds REP-T-MATERIAL-CONTRACTS
    // via code match), undoing the filter at line 11930.
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

// Reps bring-down: one line PER TIER, faithful to the extracted tiers
// (Metsera fb2 block 3e — REPEAT-FAILURE fix). The previous per-group
// renderer (commit 4358e43) over-collapsed: it relabelled the catch-all tier
// "All other reps" even when the drafting read "All Company representations
// … OTHER THAN Section 3.01 (first sentence only), …" (dropping the
// exclusions), truncated resolved names to "a, b, c +N" (dropping the
// "(first sentence only)" qualifiers), de-duplicated lines, and re-sorted
// tiers. A rep can legitimately sit under TWO tiers (excluded from the MAE
// tier AND listed under in-all-material-respects) — every tier must render
// as extracted: '<group description> → <standard headline>'. Section cites
// resolve to rep names with parenthetical qualifiers preserved
// (buildBringdownTierLines, unit-tested against the live Metsera shape).
function BringdownTable({ provisions, repsType }) {
  const condProvs = (provisions || []).filter((p) => isCondRepProvision(p, repsType));
  const tiers = [];
  for (const cp of condProvs) {
    const f = getStructuredFeatures(cp) || {};
    if (Array.isArray(f.bringDownTiers)) {
      for (const t of f.bringDownTiers) {
        if (t && typeof t === 'object') tiers.push(t);
      }
    }
  }
  if (tiers.length === 0) return null;

  // Section → rep-name map for resolving cited sections against this side's
  // rep provisions (features.sectionNumber → category).
  const repPool = (provisions || []).filter((p) => p.type === repsType);
  const nameBySec = {};
  for (const rp of repPool) {
    const sec = String(((getStructuredFeatures(rp) || {}).sectionNumber) || '').trim();
    if (sec && !nameBySec[sec]) nameBySec[sec] = rp.category;
  }

  const rows = buildBringdownTierLines(tiers, nameBySec);

  return (
    <div className="space-y-0.5">
      {rows.map((r, i) => (
        <p key={i} className="text-[11px] font-ui text-inkMid">
          <span className={r.general ? 'text-inkFaint' : 'text-ink font-medium'}>{r.group}</span>
          <span className="text-inkFaint"> → </span>
          <span>{r.std}</span>
        </p>
      ))}
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

/* Which side of the deal an MAE definition belongs to. "Parent" / "Buyer" /
 * "Acquiror" MAE → parent; everything else (Company / Target, or the generic
 * unqualified MAE) → company. Used to split the MAE sidebar entry into two
 * clearly-labeled pages. */
function maeDefinitionSide(p) {
  const cat = String(p?.category || '');
  const code = String((getAiMetadata(p) || {}).code || p?.code || '');
  if (/parent|buyer|acquir|purchaser/i.test(cat) || /parent|buyer|-B\b/i.test(code)) return 'parent';
  return 'company';
}

/* P8 item 3: synthesize a "Material Contracts" sidebar group from REP-T
 * provisions whose code / category / features mark them as the Material
 * Contracts bucket source. Pure UI detection — keeps the parser unchanged. */
function isMaterialContractsProvision(p) {
  if (!p) return false;
  // Restrict to REP-T (the only place this surfaces) so we never pull a
  // BOILERPLATE / MISC provision that happens to mention "material contracts".
  const t = String(p.type || '');
  if (t !== 'REP-T') return false;
  const meta = getAiMetadata(p) || {};
  const code = String(meta.code || p.code || '');
  if (code === 'REP-T-MATERIAL-CONTRACTS') return true;
  if (/material\s+contracts/i.test(String(p.category || ''))) return true;
  const f = getStructuredFeatures(p) || {};
  const buckets = f.materialContractsBuckets;
  if (Array.isArray(buckets) && buckets.length > 0) return true;
  return false;
}

/* ─── REP knowledge note: italic line above the REP table reading
 *     "Knowledge standard: <KNOWLEDGE_STANDARDS label or italic 'Not specified'>".
 *     Pulled from the first REP provision with non-null `knowledgeStandard`. */
function RepKnowledgeNote({ provisions, allProvisions }) {
  // Resolve the knowledge STANDARD (actual / actual-after-inquiry / etc.) and
  // the PERSONS it attaches to (executive officers / a named schedule list),
  // each as a pill with click-to-source.
  //
  // SOURCE OF TRUTH: prefer the "Knowledge" defined term in DEF (the actual
  // definition the agreement uses), falling back to features that may have
  // been stamped on individual reps. The DEF is the canonical anchor so the
  // pill resolves to the same standard cross-deal.
  let standardLabel = null;
  let standardQuote = null;
  let standardCode = null;
  let persons = [];        // array of { label, quote, code }
  let defQuote = null;     // the "knowledge means ..." definition sentence

  const normStandard = (raw) => {
    const v = isCitableValue(raw) ? getCitableValue(raw) : raw;
    if (!v) return null;
    if (isTaggedItem(v)) return resolveTaggedLabel('knowledgeStandard', v) || v.label || v.code;
    const s = String(v).toLowerCase();
    if (/after\s+(?:due|reasonable)\s+inquiry/.test(s) || /actual-knowledge-after/.test(s)) return 'Knowledge after reasonable inquiry';
    if (/constructive/.test(s)) return 'Constructive knowledge';
    if (/actual/.test(s)) return 'Actual knowledge';
    return String(v);
  };
  const codeOf = (raw) => {
    const v = isCitableValue(raw) ? getCitableValue(raw) : raw;
    if (isTaggedItem(v)) return v.code || null;
    return null;
  };

  // 1. CANONICAL: look up the "Knowledge" defined term in the full provision
  //    pool and read its features. Match by category (defined-term name).
  const knowledgeDef = (() => {
    for (const p of allProvisions || []) {
      if (p.type !== 'DEF') continue;
      const cat = String(p.category || '').trim();
      if (/^knowledge(?:\s+of\s+(?:the\s+)?(?:company|parent))?$/i.test(cat)) return p;
      if (/^(?:company|parent)(?:'s)?\s+knowledge$/i.test(cat)) return p;
    }
    return null;
  })();
  if (knowledgeDef) {
    const f = getStructuredFeatures(knowledgeDef) || {};
    if (f.knowledgeStandard) {
      standardLabel = normStandard(f.knowledgeStandard);
      standardCode = codeOf(f.knowledgeStandard);
      standardQuote = evidenceQuote(f.knowledgeStandard, { provision: knowledgeDef, focusOn: 'knowledge' })
        || (typeof knowledgeDef.full_text === 'string' ? knowledgeDef.full_text : null);
    }
    if (Array.isArray(f.knowledgePersons)) {
      for (const item of f.knowledgePersons) {
        if (!item) continue;
        if (isTaggedItem(item)) {
          const lbl = resolveTaggedLabel('knowledgePersons', item) || item.label || item.code;
          if (lbl) persons.push({ label: lbl, code: item.code || null, quote: item.text || standardQuote || null });
        } else if (typeof item === 'string' && item.trim()) {
          persons.push({ label: item.trim(), code: null, quote: standardQuote || null });
        }
      }
    }
    defQuote = standardQuote;
  }

  // 2. FALLBACK: if the DEF didn't surface anything (older extracts, no
  //    Knowledge definition extracted), scan rep features.
  if (!standardLabel) {
    for (const p of provisions || []) {
      const f = getStructuredFeatures(p) || {};
      if (!standardLabel && f.knowledgeStandard) {
        standardLabel = normStandard(f.knowledgeStandard);
        standardCode = codeOf(f.knowledgeStandard);
        standardQuote = evidenceQuote(f.knowledgeStandard, { provision: p, focusOn: 'knowledge' });
      }
      if (persons.length === 0 && f.knowledgePersons) {
        const raw = isCitableValue(f.knowledgePersons) ? getCitableValue(f.knowledgePersons) : f.knowledgePersons;
        const q = evidenceQuote(f.knowledgePersons, { provision: p, focusOn: 'knowledge' });
        const list = Array.isArray(raw) ? raw : [raw];
        for (const item of list) {
          if (!item) continue;
          const lbl = isTaggedItem(item) ? (item.label || item.code) : String(item).trim();
          if (lbl) persons.push({ label: lbl, code: isTaggedItem(item) ? (item.code || null) : null, quote: (isTaggedItem(item) && item.text) || q });
        }
      }
      if (!defQuote && (f.knowledgeStandard || f.knowledgePersons)) {
        defQuote = standardQuote || null;
      }
      if (standardLabel && persons.length > 0) break;
    }
  }

  if (!standardLabel && persons.length === 0) {
    return (
      <p className="text-[11px] font-ui italic text-inkMid px-1">
        Knowledge standard: <span className="text-inkFaint">Not specified</span>
      </p>
    );
  }

  // Two labelled sub-answers per request: the Standard and the Group, both
  // canonical pills clickable to the Knowledge defined-term source.
  return (
    <div className="px-1 text-[11px] font-ui text-inkMid flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="italic">Knowledge standard:</span>
        {standardLabel
          ? <Pill text={standardLabel} quote={standardQuote} tone="standard" />
          : <span className="text-inkFaint">Not specified</span>
        }
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="italic">Knowledge group:</span>
        {persons.length > 0
          ? persons.map((pn, i) => (
              <Pill key={i} text={pn.label} quote={pn.quote} tone="person" />
            ))
          : <span className="text-inkFaint">Not specified</span>
        }
      </div>
    </div>
  );
}

/* ─── Per-rep Materiality Qualifier cell. The materialityQualifier value for a
 *     SINGLE rep may itself be one code or a list mixing MAE-flavored and
 *     plain-materiality codes. We render canonical pills, and when a rep mixes
 *     both we frame it as "Generally [MAE] and some elements [material to the
 *     Company]" (majority code wins the "Generally" slot). Scope (to the
 *     Company / inline) is read from the MAT_MATERIAL_* code. Each pill is
 *     click-to-source. Returns null when no qualifier is present so the table
 *     cell falls back to its default empty rendering. */
/* Empty qualifier cell — a dash that still hovers/clicks to the row's source
 * provision text (audit block 9a), so the reader can verify the absence
 * directly rather than trusting the app's negative claim blindly. Shared by
 * the materiality and knowledge qualifier cells. */
function EmptyCellDash({ provision }) {
  const showEvidence = useShowEvidence();
  const rowQuote = termCellHoverQuote(provision);
  if (!rowQuote || !showEvidence) {
    return <span className="text-inkFaint italic">—</span>;
  }
  return (
    <HoverSource quote={rowQuote}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); showEvidence(rowQuote); }}
        className="text-inkFaint italic cursor-pointer hover:underline decoration-dotted"
      >
        —
      </button>
    </HoverSource>
  );
}

/* ─── Per-rep Knowledge Qualifier cell (Metsera fb2 block 2c). States the
 *     SCOPE when the extracted feature carries it: "Partial: <detail>" when
 *     the feature's text names specific sub-clauses / sentences, "Entire rep"
 *     when an explicit whole-rep scope was extracted. When no scope info
 *     exists (the common case today — the extractor emits a bare boolean),
 *     render just the standard pill; scope is never invented. */
function KnowledgeQualifierCell({ rawValue, provision, knowledgeScope }) {
  const display = knowledgeQualifierDisplay(rawValue);
  if (!display) return <EmptyCellDash provision={provision} />;
  const label = (display.code
    && resolveTaggedLabel('knowledgeQualifier', { code: display.code, label: display.label }))
    || display.label
    || 'Knowledge-qualified';
  // Audit fix batch item 1: knowledgeScope (the "Knowledge" DEF provision's
  // verbatim definition, stamped deterministically post-pass) must never be
  // a per-row column — it belongs here, folded into the qualifier's hover so
  // a lawyer can see what "knowledge" means for this rep without leaving the
  // table.
  const scopeText = typeof knowledgeScope === 'string' ? knowledgeScope.trim() : '';
  const baseQuote = display.quote || termCellHoverQuote(provision);
  const quote = scopeText
    ? (baseQuote ? `${baseQuote}\n\n— Knowledge definition —\n${scopeText}` : `— Knowledge definition —\n${scopeText}`)
    : baseQuote;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap text-[11px] text-inkMid">
      <Pill text={label} quote={quote} tone="standard" />
      {display.scope === 'partial' && (
        <span className="italic">Partial{display.detail ? `: ${display.detail}` : ''}</span>
      )}
      {display.scope === 'entire' && <span className="italic">Entire rep</span>}
    </span>
  );
}

function MaterialityQualifierCell({ rawValue, provision }) {
  const emptyDash = <EmptyCellDash provision={provision} />;
  const inner = isCitableValue(rawValue) ? getCitableValue(rawValue) : rawValue;
  if (inner === null || inner === undefined || inner === '') return emptyDash;
  const items = Array.isArray(inner) ? inner : [inner];

  let maeCount = 0, matCount = 0;
  let maeQuote = null, matQuote = null;
  let maeLabel = 'MAE';
  let matLabel = null;
  const fallbackQuote = evidenceQuote(rawValue, { provision });

  for (const item of items) {
    if (item === null || item === undefined || item === '') continue;
    const code = isTaggedItem(item) ? String(item.code || '').toUpperCase() : String(item).toUpperCase();
    const lbl = isTaggedItem(item) ? (resolveTaggedLabel('materialityQualifier', item) || item.label || item.code) : String(item);
    const q = (isTaggedItem(item) && item.text) || fallbackQuote;
    if (!code) continue;
    if (code.includes('MAE')) {
      maeCount++;
      if (!maeQuote) { maeQuote = q; maeLabel = code.includes('AGGREGATE') ? 'MAE (aggregate)' : 'MAE'; }
    } else if (code.includes('MATERIAL')) {
      matCount++;
      if (!matQuote) {
        matQuote = q;
        // "Material to the Company" (whole-rep scope) is a meaningful distinct
        // label; plain inline / unscoped materiality both read "Material (to
        // the rep)" per user — they're the same sort of qualifier.
        matLabel = code.includes('TO_COMPANY') ? 'Material to the Company'
          : code.includes('SCRAPE') ? 'Materiality scrape'
          : 'Material (to the rep)';
      }
    } else {
      // Unknown / other materiality code — surface its label as a neutral pill.
      if (!matLabel) { matLabel = lbl; matQuote = q; matCount++; }
    }
  }

  if (maeCount === 0 && matCount === 0) return emptyDash;

  // Mixed within this rep → "Generally X and some elements Y".
  if (maeCount > 0 && matCount > 0) {
    const maeMajor = maeCount >= matCount;
    return (
      <span className="inline-flex items-center gap-1 flex-wrap text-[11px] text-inkMid">
        <span className="italic">Generally</span>
        <Pill text={maeMajor ? maeLabel : (matLabel || 'Material (to the rep)')} quote={maeMajor ? maeQuote : matQuote} tone="materiality" />
        <span className="italic">and some elements</span>
        <Pill text={maeMajor ? (matLabel || 'Material (to the rep)') : maeLabel} quote={maeMajor ? matQuote : maeQuote} tone="materiality" />
      </span>
    );
  }
  if (maeCount > 0) return <Pill text={maeLabel} quote={maeQuote} tone="materiality" />;
  return <Pill text={matLabel || 'Material (to the rep)'} quote={matQuote} tone="materiality" />;
}

/* ─── REP General Exceptions table: bringdown-style. Rows = SEC filings
 *     carve-out (scope + lookback + excluded sections + carved-out reps),
 *     schedule references, materiality scrape language, materiality scrape
 *     applies-to. Each empty row renders "Not present in this agreement". */
function RepGeneralExceptionsTable({ provisions, dealAnnounceDate }) {
  // P5 item 5(d): preamble fallback. When a per-rep features object is silent,
  // fall back to the REP-T-PREAMBLE / REP-B-PREAMBLE pseudo-provision's
  // features (one per side). Also accept the legacy single-key names.
  const preamblePros = (provisions || []).filter((p) => {
    const c = String(p?.code || '').toUpperCase();
    return c === 'REP-T-PREAMBLE' || c === 'REP-B-PREAMBLE';
  });
  const preambleFeats = preamblePros.map((p) => getStructuredFeatures(p) || {});
  const pickKey = (keys) => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    // 1) First scan all non-preamble provisions for any non-empty key.
    for (const p of provisions || []) {
      const f = getStructuredFeatures(p) || {};
      for (const key of keyList) {
        const raw = f[key];
        if (raw === null || raw === undefined || raw === '' || raw === false) continue;
        if (Array.isArray(raw) && raw.length === 0) continue;
        return raw;
      }
    }
    // 2) Fall back to the dedicated preamble pseudo-provisions.
    for (const f of preambleFeats) {
      for (const key of keyList) {
        const raw = f[key];
        if (raw === null || raw === undefined || raw === '' || raw === false) continue;
        if (Array.isArray(raw) && raw.length === 0) continue;
        return raw;
      }
    }
    return null;
  };
  const renderVal = (key, raw) => {
    if (raw === null || raw === undefined) {
      return <span className="italic text-inkFaint">Not present in this agreement</span>;
    }
    return renderFeatureCell(key, raw);
  };
  // P5 item 5(d): "Lookback (months)" row gains a computed "since YYYY-MM-DD"
  // suffix from secFilingsExceptionLookbackDate, or computeLookbackText when
  // only months + announce date are present.
  // Extract the standard SEC-filings cut-off sub-phrase from a longer scope /
  // evidence sentence. The model frequently captures the cut-off verbatim but
  // parks it inside secFilingsLookbackMonths.quotes (value:null) or inside
  // secFilingsExceptionScope rather than the dedicated secFilingsExceptionLookback
  // field, so renderLookbackVal needs to recover it from whatever text we have.
  const deriveCutoffPhrase = () => {
    // Gather candidate text from EVERY provision's (and preamble's) months /
    // scope / language fields — not just pickKey's first hit, since that may
    // land on the REP-T-SEC timeliness sentence (which has no cut-off) rather
    // than the REP-T-PREAMBLE exception sentence (which does).
    const candidates = [];
    const pushCitable = (raw) => {
      if (!raw) return;
      if (isCitableValue(raw)) {
        for (const q of getCitableQuotes(raw)) candidates.push(q);
        const v = getCitableValue(raw);
        if (typeof v === 'string') candidates.push(v);
      } else if (typeof raw === 'string') {
        candidates.push(raw);
      }
    };
    const scanKeys = ['secFilingsLookbackMonths', 'secFilingsExceptionScope', 'secFilingsExceptionLanguage', 'secFilingsExceptionLookback'];
    for (const p of provisions || []) {
      const f = getStructuredFeatures(p) || {};
      for (const k of scanKeys) pushCitable(f[k]);
    }
    for (const f of preambleFeats) {
      for (const k of scanKeys) pushCitable(f[k]);
    }
    // Cut-off phrase patterns, most-specific first.
    const patterns = [
      /(?:at\s+least\s+)?(?:\w+\s+)?\(?\d+\)?\s+business\s+days?\s+(?:prior\s+to|before)\s+the\s+date\s+(?:of\s+this\s+Agreement|hereof)/i,
      /the\s+business\s+day\s+immediately\s+preceding\s+the\s+date\s+(?:of\s+this\s+Agreement|hereof)/i,
      /(?:at\s+least\s+)?(?:\w+\s+)?\(?\d+\)?\s+days?\s+(?:prior\s+to|before)\s+(?:the\s+date\s+(?:of\s+this\s+Agreement|hereof)|signing)/i,
    ];
    for (const text of candidates) {
      for (const re of patterns) {
        const m = text.match(re);
        if (m) return m[0].replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  };

  const renderLookbackVal = () => {
    const dateRaw = pickKey(['secFilingsExceptionLookbackDate']);
    const months = pickKey(['secFilingsLookbackMonths']);
    const txt = pickKey(['secFilingsExceptionLookback']);
    let monthsVal = months;
    if (isCitableValue(monthsVal)) monthsVal = getCitableValue(monthsVal);
    let txtVal = txt;
    if (isCitableValue(txtVal)) txtVal = getCitableValue(txtVal);
    let dateVal = dateRaw;
    if (isCitableValue(dateVal)) dateVal = getCitableValue(dateVal);
    // Recover the verbatim exception cut-off phrase up front. CRITICAL: this
    // must be computed BEFORE the "all empty" guard below — pickKey frequently
    // resolves secFilingsLookbackMonths to the REP-T-PREAMBLE's citable
    // wrapper whose value is null (the phrase lives in its .text), so
    // monthsVal/txtVal/dateVal can all be empty even though the cut-off IS
    // recoverable. Without this, the row short-circuited to "Not present"
    // (the Verve "at least two (2) Business Days" bug).
    const derived = deriveCutoffPhrase();
    if (!monthsVal && !txtVal && !dateVal && !derived) {
      return <span className="italic text-inkFaint">Not present in this agreement</span>;
    }
    // Be loyal to the source. If the agreement gave us a verbatim phrase, show
    // it verbatim — that's the truth, regardless of unit (day / week / month /
    // year / "since DATE"). If it gave us an absolute calendar date, show that.
    // Only synthesize "X months prior to signing" when the months count is
    // CORROBORATED (txt explicitly says "month"/"year") — never trust a bare
    // sub-3 months value, because that's almost always extraction confusion
    // between "one business day" / "one week" and a months count.
    if (txtVal) return <span>{String(txtVal)}</span>;
    if (dateVal) return <span>{`As of ${String(dateVal).slice(0, 10)}`}</span>;
    // Prefer the VERBATIM exception cut-off phrase (computed above) BEFORE
    // falling back to a bare months number. The months value is frequently
    // scraped from a DIFFERENT rep — the SEC-filings timeliness rep ("timely
    // filed all reports … [24 months]") — which is not the same concept as the
    // "Except as disclosed … prior to X" exception cut-off this row is about.
    // Showing the wrong rep's "24 months" (or nothing) instead of the actual
    // day-based cut-off was the Verve bug.
    if (derived) return <span>{derived}</span>;
    if (monthsVal && /^\d+$/.test(String(monthsVal).trim())) {
      const n = Number(String(monthsVal).trim());
      // Months synthesis only when the value is plausibly a month count AND no
      // verbatim day/date cut-off was recovered above. Sub-3 with no verbatim
      // corroboration is dropped — extraction can't distinguish "1 month" from
      // "1 business day" without the phrase.
      if (n >= 3) return <span>{`${n} months prior to signing`}</span>;
    }
    return <span className="italic text-inkFaint">Cut-off period not captured verbatim in source</span>;
  };
  const showEvidence = useShowEvidence();
  const extractQuote = (raw) => evidenceQuote(raw, { fallbackToFullText: false });
  const renderLabelCell = (label, quote) => {
    const clickable = !!(quote && showEvidence);
    if (clickable) {
      return (
        <HoverSource quote={quote}>
          <button
            type="button"
            onClick={() => showEvidence(quote)}
            className="text-left text-accent hover:underline font-medium"
          >
            {label}
          </button>
        </HoverSource>
      );
    }
    return <span className="text-ink font-medium">{label}</span>;
  };

  // ── SEC Filings exception — rendered as ONE row whose Details cell carries
  //    sub-headings, mirroring the STRUCT "Merger" row treatment. Audit
  //    block 3: the cell used to LEAD with the verbatim scope sentence and
  //    only append the derived Cut-Off phrase second — inverted per the
  //    table design contract (canonical/derived value in the cell, verbatim
  //    source on hover only). Cut-Off now leads; the scope sentence is never
  //    printed in the cell, only carried as hover/click-to-source text on
  //    the label + Cut-Off row. ──
  const scopeRaw = pickKey(['secFilingsExceptionScope', 'secFilingsExceptionLanguage']);
  const scopeQuote = extractQuote(scopeRaw);
  const secSubRows = [
    { label: 'Cut-Off', custom: 'lookback' },
    { label: 'Portions Excluded', keys: ['secFilingsExceptionExclusions', 'secFilingsExcludedSections'] },
    { label: 'Carved-out Reps', keys: ['secFilingsExceptionCarvedOutReps', 'secFilingsCarvedOutReps'] },
  ];
  const secValues = secSubRows.map((sr) => {
    if (sr.custom === 'lookback') {
      const lookbackRaw = pickKey(['secFilingsExceptionLookbackDate']) || pickKey(['secFilingsLookbackMonths']) || pickKey(['secFilingsExceptionLookback']);
      // The derived Cut-Off phrase is frequently recovered FROM the scope
      // sentence (deriveCutoffPhrase scans secFilingsExceptionScope among
      // other fields) — the scope quote is still the right hover evidence
      // even when the lookback field itself has no citable text of its own.
      return { ...sr, present: lookbackRaw !== null || !!scopeQuote, node: renderLookbackVal(), quote: extractQuote(lookbackRaw) || scopeQuote };
    }
    const v = pickKey(sr.keys);
    return { ...sr, present: v !== null && v !== undefined, node: v != null ? renderFeatureCell(sr.keys[0], v) : null, quote: extractQuote(v) };
  });
  const secAnyPresent = secValues.some((s) => s.present) || scopeRaw !== null;
  const secRowQuote = secValues.find((s) => s.quote)?.quote || scopeQuote || null;

  const disclosureRaw = pickKey(['disclosureLetterReference', 'disclosureSchedulesReference', 'scheduleReference', 'schedule_reference']);
  // Metsera fb2 block 2f: the cell shows only the disclosure STANDARD phrase.
  // When the stored reference carries a cross-qualification sentence
  // ("disclosure in any section shall be deemed to qualify … to the extent
  // that it is reasonably apparent on its face"), extract THAT sentence for
  // the cell; the full stored text stays reachable via hover/click.
  const disclosureFullText = (() => {
    if (typeof disclosureRaw === 'string') return disclosureRaw;
    if (isCitableValue(disclosureRaw)) {
      const t = getCitableText(disclosureRaw);
      if (t) return t;
      const inner = getCitableValue(disclosureRaw);
      return typeof inner === 'string' ? inner : null;
    }
    return null;
  })();
  let disclosureStandard = extractCrossQualificationSentence(disclosureFullText);
  // Audit fix batch item 7: disclosureRaw is whichever scheduleReference-ish
  // value pickKey finds FIRST across every rep, in provision order — for a
  // fresh deal that's routinely the Reps Preamble's OWN scheduleReference,
  // which is just a short label ("Company Disclosure Letter"), not the
  // preamble's cross-qualification sentence. That sentence lives in the
  // preamble PROVISION's full_text, not its scheduleReference feature — e.g.
  // Metsera's Article III preamble reads "...the disclosure in any section
  // shall be deemed to qualify or apply to other sections and subsections in
  // this Article III to the extent that it is reasonably apparent on its
  // face that such disclosure also qualifies or applies to such other
  // sections and subsections...". The existing pattern already matches this
  // real phrasing ("reasonably apparent") — it just never saw the text,
  // because disclosureFullText was the short label instead of the preamble's
  // full text. Fall back to scanning the preamble provisions' verbatim text
  // (already computed above as preamblePros) before giving up.
  let disclosureStandardSourceText = disclosureFullText;
  if (!disclosureStandard) {
    for (const p of preamblePros) {
      const found = extractCrossQualificationSentence(p.full_text);
      if (found) {
        disclosureStandard = found;
        disclosureStandardSourceText = p.full_text;
        break;
      }
    }
  }
  const disclosureQuote = extractQuote(disclosureRaw) || disclosureStandardSourceText;

  // Audit block 2: this table is called for BOTH REP-T and REP-B. The
  // Buyer/Parent side routinely has no SEC-filings exception or disclosure-
  // schedule reference (SEC reporting reps are almost always Target-only) —
  // when EVERY row would be empty, collapse the whole table to a single
  // muted line instead of a header framing two "Not present" rows. Never
  // "Not present" — extraction may simply have missed it.
  //
  // Audit fix batch item 2: this box is a SUPPLEMENT that sits ABOVE the
  // main per-rep table (see caller comment: "render FIRST so they anchor
  // the top of the page"), summarizing SEC-filings-exception / disclosure-
  // schedule data — it is NOT a statement about the reps section as a
  // whole. When there IS underlying rep data for this party (the normal
  // case — Buyer reps essentially never carry a SEC-filings exception),
  // rendering "None extracted for this agreement." here reads as if
  // nothing was extracted for the ENTIRE Buyer reps section, directly
  // above a fully-populated table that contradicts it. Render nothing in
  // that case; only show the placeholder when this party truly has no
  // reps at all (so the claim is actually true).
  if (!secAnyPresent && disclosureRaw === null) {
    if (Array.isArray(provisions) && provisions.length > 0) return null;
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
          None extracted for this agreement.
        </div>
      </div>
    );
  }

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
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Item</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* SEC Filings — one row, sub-headed Details cell. */}
            <tr className="align-top">
              <td className="px-3 py-2 whitespace-nowrap">{renderLabelCell('SEC Filings', secRowQuote)}</td>
              <td className="px-3 py-2 text-ink">
                {secAnyPresent ? (
                  <dl className="space-y-1.5">
                    {secValues.filter((s) => s.present).map((s) => (
                      <div key={s.label} className="flex flex-col">
                        <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{s.label}</dt>
                        <dd className="whitespace-pre-wrap break-words">
                          {/* Every sub-row cites its supporting text on hover +
                              click-to-source. */}
                          <HoverSource quote={s.quote} as="div">
                            <span
                              className={s.quote && showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}
                              onClick={s.quote && showEvidence ? () => showEvidence(s.quote) : undefined}
                            >
                              {s.node || <span className="text-inkFaint/70 italic">—</span>}
                            </span>
                          </HoverSource>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span className="italic text-inkFaint">Not present in this agreement</span>
                )}
              </td>
            </tr>
            {/* Disclosure Schedules — standard phrase only in the cell
                (fb2 2f); the full stored reference lives in the hover. */}
            <tr className="align-top">
              <td className="px-3 py-2 whitespace-nowrap">{renderLabelCell('Disclosure Schedules', disclosureQuote)}</td>
              <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                {disclosureRaw != null ? (
                  <HoverSource quote={disclosureQuote} as="div">
                    <span
                      className={disclosureQuote && showEvidence ? 'cursor-pointer hover:bg-yellow-50' : ''}
                      onClick={disclosureQuote && showEvidence ? () => showEvidence(disclosureQuote) : undefined}
                    >
                      {disclosureStandard
                        ? <span>{disclosureStandard}</span>
                        : renderFeatureCell('disclosureLetterReference', disclosureRaw)}
                    </span>
                  </HoverSource>
                ) : (
                  <span className="italic text-inkFaint">Not present in this agreement</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── REP Material Contracts table: checklist of the canonical 16 buckets
 *     in MATERIAL_CONTRACT_BUCKET_CODES. Each row matches against the
 *     deal's materialContractsBuckets (tagged list) + per-bucket dollar
 *     thresholds. Buckets the deal does not address render with an italic
 *     "Not present in this agreement" cell — same checklist pattern as
 *     ExpectedRepsTable. */
// Lowercase roman numeral for a 1-based index — matches the agreement's own
// "(i) (ii) (iii)..." Material Contracts sub-clause numbering.
function romanizeLower(num) {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const map = [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
  let n = num, out = '';
  for (const [v, s] of map) { while (n >= v) { out += s; n -= v; } }
  return `(${out})`;
}

function RepMaterialContractsTable({ provisions, onSelectProvision }) {
  const { isEdit } = useViewMode();
  const showEvidence = useShowEvidence();
  const [showCoverage, setShowCoverage] = useState(false);
  let source = null;
  for (const p of provisions || []) {
    const meta = getAiMetadata(p) || {};
    const code = String(meta.code || p.code || '');
    if (code === 'REP-T-MATERIAL-CONTRACTS') { source = p; break; }
    if (/material\s+contracts/i.test(p.category || '')) { source = p; break; }
  }
  const f = source ? (getStructuredFeatures(source) || {}) : {};
  const buckets = Array.isArray(f.materialContractsBuckets) ? f.materialContractsBuckets : [];
  const thresholds = Array.isArray(f.materialContractsDollarThresholds) ? f.materialContractsDollarThresholds : [];

  const threshByCode = new Map();
  for (const t of thresholds) {
    if (!t || typeof t !== 'object') continue;
    const k = String(t.bucket || t.code || '').toUpperCase();
    if (k) threshByCode.set(k, t.threshold ?? t.value ?? t.qualifier ?? null);
  }

  const normThreshold = (raw) => {
    if (raw === null || raw === undefined || raw === '') return { text: null, quotes: null };
    if (isCitableValue(raw)) {
      const inner = getCitableValue(raw);
      const q = getCitableQuotes(raw);
      const text = typeof inner === 'object' && inner !== null
        ? (inner.label || inner.code || null) : (inner === '' ? null : String(inner));
      return { text, quotes: q && q.length ? q : null };
    }
    if (typeof raw === 'object') return { text: raw.label || raw.text || raw.code || null, quotes: null };
    return { text: String(raw), quotes: null };
  };

  // PRIMARY: one row per ACTUAL extracted sub-clause, in document order. The
  // agreement's enumerated (i)-(xxi) list is the truth — many clauses are
  // deal-specific and several share a canonical code, so a canonical-only
  // checklist can never show them all. Each row carries its own threshold +
  // canonical-bucket tag + verbatim source (hover + click).
  const clauseRows = buckets.map((b, i) => {
    const tagged = isTaggedItem(b);
    const code = tagged ? String(b.code || '').toUpperCase() : '';
    const canonicalLabel = code && MATERIAL_CONTRACT_BUCKET_CODES[code] ? MATERIAL_CONTRACT_BUCKET_CODES[code] : null;
    // A bucket is "canonical" when it carries a real taxonomy code (anything
    // but the OTHER catch-all). Canonical buckets render as just a clickable
    // pill; OTHER / untagged buckets render their free-text label.
    const isCanonical = !!(code && code !== 'OTHER' && canonicalLabel);
    const ownLabel = tagged ? (b.label && b.label !== canonicalLabel ? b.label : null) : (typeof b === 'string' ? b : null);
    const label = isCanonical ? canonicalLabel : (ownLabel || canonicalLabel || `Contract type ${i + 1}`);
    const text = tagged ? (b.text || null) : (typeof b === 'string' ? b : null);
    const threshRaw = (tagged && (b.threshold ?? b.qualifier)) ?? (code ? threshByCode.get(code) : null) ?? null;
    const thr = normThreshold(threshRaw);
    return { key: `${code || 'x'}-${i}`, code, canonicalLabel, isCanonical, label, text, thrText: thr.text, thrQuotes: thr.quotes };
  });

  const presentCodes = new Set(buckets.map((b) => isTaggedItem(b) ? String(b.code || '').toUpperCase() : '').filter(Boolean));
  // A single enumerated material-contracts sub-clause routinely bundles
  // multiple concepts (e.g. Landos's first bucket: "(A) limits the freedom to
  // compete ... (B) providing most favored nation rights ... or exclusivity
  // obligations ... (C) right of first refusal ..."). The model tags the
  // whole sub-clause with ONE bucket code (NONCOMPETE), so the coverage
  // checklist wrongly reported EXCLUSIVITY_MFN as "not covered". Re-scan each
  // bucket's verbatim text against every bucket's synonyms and mark any
  // additional concept it explicitly covers as present too. Per user: "two
  // things covered in one provision — check your logic there."
  for (const b of buckets) {
    const text = isTaggedItem(b) ? (b.text || '') : (typeof b === 'string' ? b : '');
    if (!text || text.length < 8) continue;
    for (const [code, meta] of Object.entries(MATERIAL_CONTRACT_BUCKET_META || {})) {
      if (presentCodes.has(code)) continue;
      for (const re of (meta.synonyms || [])) {
        if (re.test(text)) { presentCodes.add(code); break; }
      }
    }
  }
  const canonicalCodes = Object.keys(MATERIAL_CONTRACT_BUCKET_CODES);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Material Contracts <span className="text-inkFaint/70">({clauseRows.length})</span>
        </p>
        {source && onSelectProvision && (
          <button
            type="button"
            onClick={() => onSelectProvision(source)}
            className="text-[10px] font-ui text-accent hover:underline"
          >
            view source
          </button>
        )}
      </div>

      {clauseRows.length === 0 ? (
        <p className="px-3 py-3 text-xs font-ui italic text-inkFaint">
          {isEdit
            ? 'No material-contract sub-clauses extracted (re-extract REP-T to populate).'
            : 'No material-contract sub-clauses found.'}
        </p>
      ) : (
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              {/* Audit block 8: this table had it backwards — the label
                  column (Contract Type) carried no width while the VALUE
                  column (Threshold) was pinned to 190px, so Contract Type
                  ballooned to fill the rest (measured 336px). Standard
                  convention is the reverse: label column fixed, value
                  column flexes. */}
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Contract Type</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Threshold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clauseRows.map((row, idx) => {
              const quote = row.text || null;
              const clickable = quote && showEvidence;
              return (
                <tr key={row.key} className="align-top hover:bg-bg/40">
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <span className="text-inkFaint/60 font-mono text-[10px] mt-0.5 shrink-0">{romanizeLower(idx + 1)}</span>
                      <div className="min-w-0">
                        <HoverSource quote={quote} as="div">
                          {row.isCanonical ? (
                            // Canonical bucket → render as just the pill (clickable to source).
                            clickable ? (
                              <button
                                type="button"
                                onClick={() => showEvidence(quote)}
                                className="inline-flex items-center text-[11px] font-ui font-medium px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
                              >
                                {row.canonicalLabel}
                              </button>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-ui font-medium px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                {row.canonicalLabel}
                              </span>
                            )
                          ) : clickable ? (
                            <button
                              type="button"
                              onClick={() => showEvidence(quote)}
                              className="text-left text-accent hover:underline font-medium"
                            >
                              {row.label}
                            </button>
                          ) : (
                            <span className="text-ink font-medium">{row.label}</span>
                          )}
                        </HoverSource>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {row.thrText ? (
                      <HoverSource quote={(row.thrQuotes && row.thrQuotes[0]) || quote} as="div">
                        <span
                          className={clickable ? 'cursor-pointer hover:bg-yellow-50' : ''}
                          onClick={(row.thrQuotes && row.thrQuotes[0] && showEvidence) ? () => showEvidence(row.thrQuotes[0]) : (clickable ? () => showEvidence(quote) : undefined)}
                        >
                          {row.thrText}
                        </span>
                      </HoverSource>
                    ) : (
                      <span className="italic text-inkFaint/70">No $ threshold</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Secondary: collapsed canonical-coverage strip for cross-deal comparison. */}
      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setShowCoverage((v) => !v)}
          className="w-full px-3 py-1.5 text-left text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider hover:bg-bg/40 flex items-center gap-1"
        >
          <span>{showCoverage ? '▾' : '▸'}</span>
          Canonical coverage ({presentCodes.size}/{canonicalCodes.length})
        </button>
        {showCoverage && (
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {canonicalCodes.map((code) => {
              const present = presentCodes.has(code);
              return (
                <span
                  key={code}
                  className={`inline-flex items-center text-[10px] font-ui px-1.5 py-0.5 rounded border ${
                    present
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-bg/40 text-inkFaint/70 border-border line-through'
                  }`}
                  title={present ? 'Present' : 'Not addressed'}
                >
                  {MATERIAL_CONTRACT_BUCKET_CODES[code]}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Canonical Closing Conditions table (per COND family).
 *     Rows = canonical conditions; for each row scan the provided provisions
 *     for a category match and either list the matching provisions (clickable
 *     to source) or render "Not present in this agreement". Two-col layout
 *     mirrors the bringdown / IOC affirmative tables. */
/* ── Canonical Closing Conditions lists (per family).
 *    Each row has:
 *      - label: human-readable canonical name
 *      - re:    regex against provision.category to match deal provisions
 *      - alwaysRender: when true, the row renders even if no provision
 *        matches (used for MAE which we always want to surface). When
 *        false (default), the row only renders if at least one provision
 *        matches.
 *      - tenderOnly: when true, the row only renders for tender-offer deals.
 *      - maeSide: 'target' | 'parent' — when set, the Details cell pulls
 *        from the matching side's MAE definition even when no condition
 *        provision was extracted. */
// CANONICAL_CONDITIONS_M/B/S now live in lib/canonical-conditions.js (imported above).

/* ── Build the Details cell content for a canonical-condition row.
 *    Composes a multi-line description from the matched provisions'
 *    features: verbatim closing-condition quote, threshold, bringdown
 *    standard, cure period, materiality scrape, etc. Each composed line
 *    is independently clickable to source via useShowEvidence(). */
// Extract just the compliance/materiality "standard" PHRASE from a
// condition's one-sentence AI summary (mainCondition/mainConcept) — e.g.
// "in all material respects" — rather than the whole paraphrased sentence
// (block 5: covenant-performance and bring-down rows show the standard
// only). Order matters: check the more specific phrase first.
const CONDITION_STANDARD_PHRASES = [
  { re: /in all material respects/i, label: 'In all material respects' },
  { re: /in all respects/i, label: 'In all respects' },
  { re: /material\s+adverse\s+effect|\bmae\b/i, label: 'MAE standard' },
  { re: /de\s+minimis/i, label: 'De minimis' },
];
function extractConditionStandard(text) {
  const t = String(text || '');
  for (const p of CONDITION_STANDARD_PHRASES) {
    if (p.re.test(t)) return p.label;
  }
  return null;
}

/* CanonicalConditionDetails — the "Standard / Detail" cell for one closing-
 * condition row. Per the table design contract, this NEVER renders the raw
 * provision sentence (the row's own HoverSource wrapper already surfaces the
 * source quote on hover) — only derived, plain-English facts. Four condition
 * types get bespoke, compact treatment (block 5): Reps Bring-Down, Covenant
 * Performance, No-MAE, and Officer's Certificate. `certifies` (officer's-
 * certificate rows only) is the list of sibling condition labels this
 * certificate covers, computed by the caller (CondSingleTable) from sibling
 * rows' certificationRequired flags. */
function CanonicalConditionDetails({ row, matches, allProvisions, certifies }) {
  const label = String(row.label || '');
  const isBringDown = /Bring[\s-]*Down/i.test(label);
  const isCovenant = /Covenant Performance/i.test(label);
  const isNoMae = /Material Adverse Effect/i.test(label);
  const isCert = /Officer.?s Certificate/i.test(label);
  const u = (v) => (isCitableValue(v) ? getCitableValue(v) : v);

  if (isCert) {
    if (matches.length === 0 && (!certifies || certifies.length === 0)) {
      return <span className="italic text-inkFaint">{CONDITION_ABSENT_COPY}</span>;
    }
    return certifies && certifies.length > 0
      ? <span className="text-ink">Certifies: {certifies.join(', ')}</span>
      : <span className="italic text-inkFaint">Certifies the closing conditions (specific items not extracted)</span>;
  }

  if (isBringDown) {
    // When tiers were extracted, the compact "tier → standard" summary
    // renders separately via <BringdownTable> (CondSingleTable) — this cell
    // only needs a fallback for the rare untiered case.
    for (const p of matches) {
      const f = getStructuredFeatures(p) || {};
      if (Array.isArray(f.bringDownTiers) && f.bringDownTiers.length > 0) return null;
    }
    for (const p of matches) {
      const f = getStructuredFeatures(p) || {};
      const std = extractConditionStandard(f.mainCondition) || extractConditionStandard(f.mainConcept);
      if (std) return <span className="text-ink">{std}</span>;
    }
    return <span className="italic text-inkFaint">Standard not specified</span>;
  }

  if (isCovenant) {
    for (const p of matches) {
      const f = getStructuredFeatures(p) || {};
      const std = extractConditionStandard(f.mainCondition) || extractConditionStandard(f.mainConcept);
      if (std) return <span className="text-ink">{std}</span>;
    }
    return <span className="italic text-inkFaint">Standard not specified</span>;
  }

  if (isNoMae) {
    let continuing = null;
    for (const p of matches) {
      const f = getStructuredFeatures(p) || {};
      const t = `${typeof f.mainCondition === 'string' ? f.mainCondition : ''} ${p.full_text || ''}`;
      if (/continu(?:ing|e[ds]?)\s+(?:to\s+(?:be|exist)|material\s+adverse\s+effect|effect)/i.test(t)) {
        continuing = true;
        break;
      }
    }
    const isParentSide = (p) => /parent|buyer|acquir|purchaser/i.test(p?.category || '');
    const maeProvs = (allProvisions || []).filter(isMaeDefinitionProvision);
    const maeDef = row.maeSide === 'parent'
      ? (maeProvs.find(isParentSide) || null)
      : (maeProvs.find((p) => !isParentSide(p)) || maeProvs[0] || null);
    const limbs = maeDef ? u((getStructuredFeatures(maeDef) || {}).maeLimbs) : null;
    const limbsLabel = limbs === 'TWO_LIMB' ? 'Two-limb' : limbs === 'ONE_LIMB' ? 'One-limb' : null;
    return (
      <span className="text-ink inline-flex items-center gap-1.5 flex-wrap">
        <span>{continuing === true ? 'MAE must be continuing at Closing' : 'Continuing requirement not specified'}</span>
        {limbsLabel && <Pill text={limbsLabel} tone="standard" />}
      </span>
    );
  }

  // Every other condition row: structured facts only (condition summary,
  // threshold, cure period, materiality scrape, schedule reference) — never
  // the raw provision sentence. conditionDetailLines is the shared pure
  // builder (lib/canonical-conditions.js), unit-tested against real shapes.
  const lines = [];
  for (const p of matches) {
    for (const line of conditionDetailLines(getStructuredFeatures(p) || {})) lines.push(line);
  }

  if (lines.length === 0) {
    // A matched row is PRESENT even when no displayable detail was extracted.
    // Rendering the absent copy here is a false affirmative absence — the bug
    // that blanked the whole Mutual Conditions section on deals whose COND-M
    // features carried only booleans/summaries.
    return matches.length > 0
      ? <span className="italic text-inkFaint">Present (detail not extracted)</span>
      : <span className="italic text-inkFaint">{CONDITION_ABSENT_COPY}</span>;
  }

  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <div key={i} className="flex flex-col">
          {/* fb2 block 3b: the generic summary line used to carry a
              "Condition" label inside the value cell — redundant (the whole
              column IS the condition detail), so it renders label-less. */}
          {line.label !== 'Condition' && (
            <dt className="text-[10px] text-inkFaint uppercase tracking-wider">{line.label}</dt>
          )}
          <dd className="text-[11px] text-ink">{String(line.value)}</dd>
        </div>
      ))}
    </div>
  );
}

/* P8 item 2: small italic banner above the canonical-conditions tables that
 * summarizes the Frustration-of-Conditions meta-rule when present. Reads
 * the {frustrationApplies, frustrationTest, frustrationLanguage} features
 * from the (single) COND-FRUSTRATE provision; clicking [view source] pops
 * the verbatim language into the FullDocumentView via useShowEvidence. */
function CondFrustrationBanner({ allProvisions, onSelectProvision }) {
  const showEvidence = useShowEvidence();
  // Find the COND-FRUSTRATE provision. Match by code in ai_metadata or on
  // the provision itself; tolerate the (rare) duplicated case by taking the
  // first hit.
  const prov = useMemo(() => {
    for (const p of allProvisions || []) {
      const meta = getAiMetadata(p) || {};
      const code = String(meta.code || p.code || '');
      if (code === 'COND-FRUSTRATE') return p;
    }
    return null;
  }, [allProvisions]);

  if (!prov) return null;
  const features = getStructuredFeatures(prov) || {};

  // Unwrap citable wrappers before pulling enum / text values.
  const unwrap = (v) => (isCitableValue(v) ? getCitableValue(v) : v);
  const present = unwrap(features.frustrationOfConditionsPresent);
  if (present === false) return null; // explicit "no rule" — skip.

  const appliesRaw = unwrap(features.frustrationApplies);
  const testRaw = unwrap(features.frustrationTest);
  const languageRaw = features.frustrationLanguage;
  const languageText = (() => {
    if (typeof languageRaw === 'string') return languageRaw;
    if (isCitableValue(languageRaw)) {
      const q = getCitableQuotes(languageRaw);
      if (q.length > 0) return q[0];
      const inner = getCitableValue(languageRaw);
      return typeof inner === 'string' ? inner : null;
    }
    return null;
  })();

  const partyLabel = (() => {
    const code = typeof appliesRaw === 'object' && appliesRaw ? appliesRaw.code : appliesRaw;
    switch (code) {
      case 'MUTUAL': return 'Mutual';
      case 'PARENT_ONLY': return 'Parent only';
      case 'COMPANY_ONLY': return 'Company only';
      default: return null;
    }
  })();
  const testLabel = (() => {
    const code = typeof testRaw === 'object' && testRaw ? testRaw.code : testRaw;
    switch (code) {
      case 'PRIMARY_CAUSE': return 'primarily caused';
      case 'PRINCIPAL_CAUSE': return 'principal cause';
      case 'MATERIAL_BREACH': return 'material breach';
      case 'WILLFUL_BREACH': return 'willful breach';
      case 'ANY_BREACH': return 'any breach';
      case 'OTHER': return 'other test';
      default: return null;
    }
  })();

  // Always render the banner when COND-FRUSTRATE is present, even if the
  // party / test enums weren't extracted. The labeled fallback text keeps
  // the banner informative either way.
  const partyText = partyLabel || 'Both parties';
  const testText = testLabel || 'the test';

  const sourceQuote = languageText || prov.full_text || prov.text || null;
  const canShowSource = !!(sourceQuote && showEvidence);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm px-3 py-2">
      <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1">
        Frustration of Conditions
      </p>
      <p className="text-xs font-ui italic text-ink leading-relaxed">
        {partyText} — neither party may rely on the failure of a condition if
        that party&rsquo;s {testText} caused the failure.{' '}
        {canShowSource ? (
          <button
            type="button"
            onClick={() => showEvidence(sourceQuote)}
            className="not-italic text-accent hover:underline font-medium"
          >
            [view source]
          </button>
        ) : onSelectProvision ? (
          <button
            type="button"
            onClick={() => onSelectProvision(prov)}
            className="not-italic text-accent hover:underline font-medium"
          >
            [view source]
          </button>
        ) : null}
      </p>
    </div>
  );
}

// CanonicalConditionsTable (per-family variant) removed — dead code.
// CondSingleTable below is the live Closing-Conditions renderer.

/* ════════════════════════════════════════════════════════════════════════
 * CondSingleTable — ONE Closing-Conditions table with full-span Mutual /
 * Buyer / Target header rows (per user: "one big table … splitting into
 * mutual / buyer / seller is better than 3 tables"). Each family's canonical
 * conditions render as a present/absent checklist (like the IOC / material-
 * contracts tables) with the standard / detail and a click-to-source.
 * Reuses CANONICAL_CONDITIONS_*, CanonicalConditionDetails and BringdownTable.
 * ════════════════════════════════════════════════════════════════════════ */
const COND_FAMILY_SECTIONS = [
  { family: 'COND-M', label: 'Mutual Conditions', list: CANONICAL_CONDITIONS_M, repsType: 'REP-T' },
  { family: 'COND-B', label: "Buyer's Conditions — to Parent / Merger Sub's obligation", list: CANONICAL_CONDITIONS_B, repsType: 'REP-T' },
  { family: 'COND-S', label: "Target's Conditions — to the Company's obligation", list: CANONICAL_CONDITIONS_S, repsType: 'REP-B' },
];

function CondSingleTable({ allProvisions, onSelectProvision }) {
  const pool = allProvisions || [];

  // Tender-offer deal? (gates the Tender Offer Minimum Condition row.)
  const isTenderDeal = useMemo(() => {
    for (const p of pool) {
      if (/tender\s+offer|acceptance\s+time|exchange\s+offer/i.test(String(p && p.full_text || ''))) return true;
    }
    return false;
  }, [pool]);

  // Parent-approval required? (gates the Parent stockholder-approval row.)
  const parentApprovalRequired = useMemo(() => {
    for (const p of pool) {
      const f = getStructuredFeatures(p) || {};
      const raw = isCitableValue(f.shareholderApprovalMethodParent)
        ? getCitableValue(f.shareholderApprovalMethodParent)
        : f.shareholderApprovalMethodParent;
      const code = typeof raw === 'object' && raw ? raw.code : raw;
      const s = String(code || '').toUpperCase();
      if (s === 'SPECIAL_MEETING' || s === 'WRITTEN_CONSENT' || s === 'SIGN_AND_CONSENT') return true;
    }
    return false;
  }, [pool]);

  // Build the per-family row sets up front (present rows first, absent last).
  const sections = COND_FAMILY_SECTIONS.map((sec) => {
    const famProvs = pool.filter((p) => p && p.type === sec.family);
    const rowsRaw = sec.list.filter((row) => {
      if (row.tenderOnly && !isTenderDeal) return false;
      if (row.requireParentApproval && !parentApprovalRequired) return false;
      return true;
    });
    const rows = rowsRaw
      .map((row, originalIdx) => {
        // Match on category regex OR, when the canonical row names a featureKey,
        // on any provision that populates that structured feature (e.g. the
        // tender-offer minimum condition is often categorized "Stockholder
        // Approval" but carries features.tenderOfferMinimumCondition).
        const matches = famProvs.filter((p) => {
          const f = getStructuredFeatures(p) || {};
          const code = f.canonicalCode || (p && p.ai_metadata && p.ai_metadata.code) || null;
          if (conditionRowMatches(row, p, code)) return true;
          if (row.featureKey) {
            const v = f[row.featureKey];
            if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) return true;
          }
          return false;
        });
        const present = matches.length > 0 || !!row.alwaysRender;
        return { row, matches, present, originalIdx };
      })
      .sort((a, b) => (a.present !== b.present ? (a.present ? -1 : 1) : a.originalIdx - b.originalIdx));

    // Officer's-certificate rows — which sibling conditions does the
    // certificate certify? Metsera fb2 block 3f: the certificationRequired
    // quote names the certified sections ("… the conditions set forth in
    // Section 7.02(a), Section 7.02(b) and Section 7.02(c) have been
    // satisfied"). Parse those cites and RESOLVE each against the sibling
    // condition rows (features.sectionNumber, else the leading clause letter
    // of the provision text) so the cell reads NAMES, not cites:
    // "Certifies: reps bring-down, covenant performance, no MAE".
    const certQuote = (() => {
      for (const p of famProvs) {
        const f = getStructuredFeatures(p) || {};
        const raw = f.certificationRequired;
        if (raw === undefined || raw === null) continue;
        const texts = isCitableValue(raw) ? [...getCitableQuotes(raw)] : [];
        if (raw && typeof raw === 'object' && typeof raw.text === 'string') texts.push(raw.text);
        for (const t of texts) {
          if (/Sections?\s+\d/i.test(String(t || ''))) return String(t);
        }
      }
      return null;
    })();
    const famRowsInfo = rows.map(({ row, matches }) => ({
      label: row.label,
      matches: matches.map((p) => ({
        sectionNumber: (getStructuredFeatures(p) || {}).sectionNumber,
        fullText: p.full_text,
      })),
    }));
    let certifies = certQuote ? resolveCertifiedConditions(certQuote, famRowsInfo) : [];
    if (certifies.length === 0) {
      // Fallback for extracts whose certificationRequired carries no cite-
      // bearing quote: the boolean convention (reps bring-down + covenant
      // performance rows carry certificationRequired === true).
      for (const { row, matches } of rows) {
        if (/Officer.?s Certificate/i.test(row.label)) continue;
        const certified = matches.some((p) => {
          const f = getStructuredFeatures(p) || {};
          const v = isCitableValue(f.certificationRequired) ? getCitableValue(f.certificationRequired) : f.certificationRequired;
          return v === true;
        });
        if (certified) certifies.push(row.label.replace(/\s*\(Parent\)$/, '').toLowerCase());
      }
    }

    return { ...sec, famProvs, rows, certifies };
  });

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          Closing Conditions
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs font-ui">
          <thead className="bg-bg/60 border-b border-border">
            <tr>
              <th className={`px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider whitespace-nowrap ${REVIEW_LABEL_COL_W}`}>Condition</th>
              <th className="px-3 py-2 text-left font-medium text-inkFaint uppercase tracking-wider">Standard / Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sections.map((sec) => {
              // fb2 block 3d: absent canonical conditions no longer render as
              // per-row "Not found …" rows — they collapse into ONE compact
              // "Conditions not included" strip at the bottom of the family
              // block (same pattern as the Material Contracts canonical-
              // coverage checklist).
              const presentRows = sec.rows.filter(({ row, matches }) => matches.length > 0 || row.alwaysRender);
              const absentRows = sec.rows.filter(({ row, matches }) => matches.length === 0 && !row.alwaysRender);
              const famDot = (
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    background: REP_ROW_DOT_GREEN,
                    flexShrink: 0,
                  }}
                />
              );
              return (
              <Fragment key={sec.family}>
                {/* Full-span family header row — clearer subtitle styling
                    (fb2 block 3c), matching the reps-side section titles. */}
                <tr className="bg-bg/60 border-t-2 border-border">
                  <td colSpan={2} className="px-3 py-2.5 text-xs font-ui font-semibold text-inkMid uppercase tracking-wider">
                    {sec.label}
                  </td>
                </tr>
                {/* Block 5e: the "Present: Yes" chip column is dropped — a
                    populated Detail cell already means present. */}
                {presentRows.map(({ row, matches }) => {
                  const primary = matches[0];
                  const quote = primary && typeof primary.full_text === 'string' ? primary.full_text : null;
                  return (
                    <tr key={`${sec.family}-${row.label}`} className="align-top hover:bg-bg/40">
                      {/* fb2 block 3a: status dot bullet (same visual as the
                          reps rows) on every condition row. */}
                      <td className={`px-3 py-2 text-ink font-medium whitespace-normal break-words ${REVIEW_LABEL_COL_W}`}>
                        {primary && onSelectProvision ? (
                          <button type="button" onClick={() => onSelectProvision(primary)} className="text-left text-accent hover:underline font-medium inline-flex items-center gap-2">
                            {famDot}
                            {row.label}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {famDot}
                            {row.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink whitespace-pre-wrap break-words">
                        <HoverSource quote={quote} as="div">
                          <CanonicalConditionDetails
                            row={row}
                            matches={matches}
                            allProvisions={pool}
                            certifies={sec.certifies}
                          />
                          {/Bring[\s-]*Down/i.test(row.label) && (
                            <div className="mt-1">
                              <BringdownTable
                                provisions={pool}
                                repsType={sec.repsType}
                              />
                            </div>
                          )}
                        </HoverSource>
                      </td>
                    </tr>
                  );
                })}
                {absentRows.length > 0 && (
                  <tr className="bg-bg/20">
                    <td colSpan={2} className="px-3 py-2">
                      <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider mb-1">
                        Conditions not included
                      </p>
                      <span className="flex flex-wrap gap-1.5">
                        {absentRows.map(({ row }) => (
                          <span
                            key={row.label}
                            className="inline-flex items-center text-[10px] font-ui px-1.5 py-0.5 rounded border bg-bg/40 text-inkFaint/70 border-border line-through"
                            title={CONDITION_ABSENT_COPY}
                          >
                            {row.label}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Render ONE MAE definition (target-side or parent-side) as a stacked block:
 *    - eyebrow + hero with one-limb / two-limb label
 *    - simple list of carveouts (each clickable to source, like IOC General
 *      Exceptions) — pulled from features.carveouts.
 */
function MaeSinglePartySummary({ provision, partyLabel, onSelectProvision }) {
  const { isEdit } = useViewMode();
  const f = getStructuredFeatures(provision) || {};

  // Derive limbs: maeLimbs (preferred) -> preventDelayProng (fallback).
  let limbsLabel = null;
  const rawLimbs = isCitableValue(f.maeLimbs) ? getCitableValue(f.maeLimbs) : f.maeLimbs;
  if (rawLimbs === 'ONE_LIMB' || rawLimbs === 'TWO_LIMB') {
    limbsLabel = rawLimbs === 'TWO_LIMB'
      ? 'Two-limb: effect on the entity + ability to consummate'
      : 'One-limb: effect on the entity only';
  } else {
    const pdRaw = isCitableValue(f.preventDelayProng) ? getCitableValue(f.preventDelayProng) : f.preventDelayProng;
    if (pdRaw === true) limbsLabel = 'Two-limb: effect on the entity + ability to consummate';
    else if (pdRaw === false) limbsLabel = 'One-limb: effect on the entity only';
  }

  // Pull the prevent/delay text quote (citable) for click-to-source on the
  // "Two-limb" hero.
  const pdRawFull = f.preventDelayProng;
  const pdText = isCitableValue(pdRawFull) ? getCitableText(pdRawFull) : null;
  const showEvidence = useShowEvidence();

  // Build the list of carveouts. carveouts is a tagged list — { code, label, text }.
  // Accept BOTH casings: the DEF extraction prompt emits `carveOuts` (capital
  // O) while the Stage-1 schema uses `carveouts` — reading only one caused the
  // "No carve-outs extracted" message even after a successful re-extract.
  const carveouts = Array.isArray(f.carveouts) ? f.carveouts
    : Array.isArray(f.carveOuts) ? f.carveOuts
    : Array.isArray(f.carveOutsList) ? f.carveOutsList
    : [];

  // Disproportionate-effect carveback: the subset of carve-outs that STILL
  // count toward an MAE to the extent they disproportionately affect the
  // Company vs. industry peers. Identify by CANONICAL CODE (not clause letter)
  // so we can badge each carve-out and summarize.
  const dispList = Array.isArray(f.disproportionateImpactCarveouts) ? f.disproportionateImpactCarveouts : [];
  const dispCodes = new Set(
    dispList.map((x) => isTaggedItem(x) ? String(x.code || '').toUpperCase() : String(x || '').toUpperCase()).filter(Boolean),
  );
  // Also accept a boolean/text disproportionate clause flag.
  const dispClauseRaw = f.disproportionateImpactClause ?? f.disproportionateEffectClause;
  const dispClause = isCitableValue(dispClauseRaw) ? getCitableValue(dispClauseRaw) : dispClauseRaw;
  const hasDisproportionate = dispCodes.size > 0 || (dispClause && dispClause !== false);
  const dispClauseQuote = (isCitableValue(dispClauseRaw) && getCitableText(dispClauseRaw))
    || (typeof dispClause === 'string' ? dispClause : null);

  return (
    <section className="space-y-3">
      <header className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] text-inkFaint uppercase tracking-wider">{partyLabel}</span>
        <h3 className="font-display text-base text-ink">{provision.category || partyLabel + ' MAE'}</h3>
      </header>
      <div
        className="bg-white border-2 rounded-lg shadow-sm px-5 py-4 cursor-pointer"
        style={{ borderColor: '#C9A788' }}
        onClick={() => {
          if (pdText) showEvidence(pdText);
          else if (provision.full_text) showEvidence(provision.full_text.slice(0, 600));
        }}
        title={pdText ? 'View prevent/delay prong in source' : ''}
      >
        <div className="font-mono text-[10px] text-inkFaint uppercase tracking-wider">MAE Test</div>
        <div className="font-display text-lg text-ink font-medium mt-1">
          {limbsLabel || (
            <span className="italic text-inkFaint text-sm">
              {isEdit ? 'Limbs not extracted (re-ingest to populate)' : 'Not available'}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-bg/60 border-b border-border flex items-center justify-between">
          <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
            Carve-outs
          </p>
          <p className="text-[10px] font-ui text-inkFaint">{carveouts.length}</p>
        </div>
        {/* Disproportionate-effect carveback banner — names the canonical
            carve-outs it applies to (NOT the (A)/(B) clause letters). */}
        {hasDisproportionate && (
          <div
            className={`px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[11px] font-ui text-amber-900 ${dispClauseQuote && showEvidence ? 'cursor-pointer' : ''}`}
            onClick={dispClauseQuote && showEvidence ? () => showEvidence(dispClauseQuote) : undefined}
            title={dispClauseQuote || ''}
          >
            <span className="font-medium">Disproportionate-effect carveback applies</span>
            {dispCodes.size > 0 && (
              <span className="text-amber-800">
                {' '}— to: {[...dispCodes].map((c) => labelForCarveoutCode(c) || humanizeBadgeText(c)).join(', ')}
              </span>
            )}
          </div>
        )}
        {carveouts.length === 0 ? (
          <p className="px-3 py-3 text-xs font-ui italic text-inkFaint">
            {isEdit
              ? 'No carve-outs extracted (re-ingest to populate `carveouts` list with MAE_CARVEOUT codes).'
              : 'No carve-outs found.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {carveouts.map((c, i) => {
              const label = c?.label || labelForCarveoutCode(c?.code) || c?.code || `Carve-out ${i + 1}`;
              const quote = c?.text || null;
              const cCode = isTaggedItem(c) ? String(c.code || '').toUpperCase() : '';
              const subjectToDisp = cCode && dispCodes.has(cCode);
              return (
                <li
                  key={i}
                  className="px-3 py-2 hover:bg-bg/40 cursor-pointer"
                  onClick={() => {
                    if (quote) showEvidence(quote);
                    else onSelectProvision && onSelectProvision(provision);
                  }}
                  title={quote || ''}
                >
                  <div className="text-xs font-ui text-ink font-medium flex items-center gap-1.5 flex-wrap">
                    {isTaggedItem(c) && c.code ? <CodeBadge code={c.code} /> : null}
                    <span>{label}</span>
                    {subjectToDisp && (
                      <span className="inline-flex items-center text-[9px] font-ui font-medium px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide">
                        Disp. carveback
                      </span>
                    )}
                  </div>
                  {quote && (
                    <div className="text-[11px] font-body text-inkLight mt-0.5 italic line-clamp-2">
                      "{quote}"
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// Map a MAE_CARVEOUT_CODES code to its human label (best-effort). We do not
// import the dict here at module top — instead resolveTaggedLabel handles
// the lookup. This local helper just falls back gracefully when the tagged
// item already has a label.
function labelForCarveoutCode(code) {
  if (!code) return null;
  try {
    return resolveTaggedLabel('carveouts', { code, label: null, text: '' }) || null;
  } catch {
    return null;
  }
}

function MaeDefinitionSummary({ allProvisions, onSelectProvision, side }) {
  const maeProvs = (allProvisions || []).filter(isMaeDefinitionProvision);

  const companyMae = maeProvs.find((p) => maeDefinitionSide(p) === 'company')
    || (side === 'company' ? maeProvs[0] : null);
  const parentMae = maeProvs.find((p) => maeDefinitionSide(p) === 'parent') || null;

  // When a side is requested (the sidebar split passes it), render ONLY that
  // side. Falls back to rendering both when no side is given (legacy callers).
  const renderCompany = !side || side === 'company';
  const renderParent = !side || side === 'parent';

  const target = renderCompany ? companyMae : null;
  const parent = renderParent ? parentMae : null;

  if (!target && !parent) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm px-5 py-4">
        <p className="text-xs font-ui italic text-inkFaint">
          No {side === 'parent' ? 'Parent / Buyer ' : side === 'company' ? 'Company / Target ' : ''}Material Adverse Effect definition found in this agreement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {target && (
        <MaeSinglePartySummary
          provision={target}
          partyLabel="Company / Target"
          onSelectProvision={onSelectProvision}
        />
      )}
      {parent && parent !== target && (
        <MaeSinglePartySummary
          provision={parent}
          partyLabel="Parent / Buyer"
          onSelectProvision={onSelectProvision}
        />
      )}
    </div>
  );
}

/* P5 item 3: small wrapper that adds click-to-source behavior to every
 * populated row cell in the generic ProvisionTable. For tagged/citable values
 * the evidence text is the quote; for bare values that happen to be wrapped
 * in citable shape we use the first quote; for purely bare values we fall back
 * to a 400-char slice of provision.full_text. "—" / "Not present" cells are
 * non-interactive. Uses useShowEvidence (same as CategoryFeatureSummaryTable). */
function CellWithSource({ provision, featureKey, raw, isEmpty, children, className }) {
  const showEvidence = useShowEvidence();
  // Audit block 9a: an empty cell (dash) still offers the row's source
  // provision on hover, so the reader can verify the absence directly
  // rather than trusting a negative claim blindly. A feature-level quote
  // wins when there is one; an empty cell has none, so fall back to the
  // provision's own full text.
  const quote = isEmpty
    ? ((typeof provision?.full_text === 'string' && provision.full_text.trim()) ? provision.full_text : null)
    : evidenceQuote(raw, { provision });
  if (!quote || !showEvidence) {
    return <div className={className || 'whitespace-pre-wrap break-words'}>{children}</div>;
  }
  return (
    <HoverSource quote={quote} as="div">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); showEvidence(quote); }}
        className={`${className || 'whitespace-pre-wrap break-words'} text-left hover:underline decoration-dotted decoration-accent/60 underline-offset-2 cursor-pointer`}
      >
        {children}
      </button>
    </HoverSource>
  );
}

function ProvisionTable({ provisions, type, onSelectProvision, onAddProvision, allProvisions, deal }) {
  // STRUCT and CONSID get specialized layouts — see dedicated components above.
  if (type === 'STRUCT') {
    return <StructTable provisions={provisions} onSelectProvision={onSelectProvision} />;
  }
  if (type === 'CONSID') {
    return <ConsidTable provisions={provisions} onSelectProvision={onSelectProvision} onAddProvision={onAddProvision} />;
  }
  // NOSOL (P3 item 1): 4 stacked mini-tables — Cease Discussions / Change of
  // Recommendation Framework / Key Definitions / Other Restrictions. These
  // are the canonical rendering; a per-provision MultiCodeStructLikeTable
  // used to also mount here, duplicating the same data across a fifth table
  // full of empty rows (audit block 1) — removed.
  if (type === 'NOSOL' || type === 'NOSOL-T' || type === 'NOSOL-B') {
    // Whole-section-empty guard (audit block 2): no provisions at all for
    // this party. "None extracted" rather than "Not present" — extraction
    // may simply have missed it; we never affirmatively assert absence.
    if (!provisions || provisions.length === 0) {
      return (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
            None extracted for this agreement.
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <NosolFourTables provisions={provisions} />
      </div>
    );
  }
  // ANTI: 2-row summary table (Standard of Efforts + Burden Cap), then a
  // separate "Other" section for takeover-statute "no inconsistent action"
  // provisions that were mis-classified into ANTI.
  if (type === 'ANTI') {
    const takeoverProvs = provisions.filter(isTakeoverStatuteProvision);
    const mainProvs = provisions.filter((p) => !isTakeoverStatuteProvision(p));
    // P3 item 11: cross-populate certain ANTI rows from COND / TERMR
    // provisions when the ANTI feature is empty. We do this by appending
    // matching TERMR-M / COND-M provisions to the provisions list passed
    // into the summary table — pickFirstNonEmpty then walks them as a
    // fallback when an ANTI provision doesn't supply the field.
    const condTermrFallback = (allProvisions || provisions).filter(
      (p) => p && (
        p.code === 'TERMR-M' ||
        p.code === 'TERMR-OUTSIDE' ||
        (p.type === 'TERMR' && /law\s+or\s+order|injunction|impediment/i.test(p.category || '')) ||
        (p.type === 'COND' || p.type === 'COND-M') && /injunction|hsr|regulatory/i.test(p.category || '')
      ) && !mainProvs.includes(p),
    );
    const mainProvsAugmented = [...mainProvs, ...condTermrFallback];
    return (
      <div className="space-y-3">
        <CategoryFeatureSummaryTable
          deal={deal}
          provisions={mainProvsAugmented}
          type="ANTI"
          onSelectProvision={onSelectProvision}
          allProvisions={allProvisions || provisions}
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
          deal={deal}
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
    // Rebuilt rich canonical table (one row per termination right) mirroring
    // the Termination-Fees pattern. Shows the full picture from all TERMR
    // provisions regardless of which party sub-page is open.
    return (
      <TermrRebuiltSummary
        provisions={provisions}
        allProvisions={allProvisions || provisions}
        onSelectProvision={onSelectProvision}
      />
    );
  }
  if (type === 'TERMF') {
    return (
      <TermfRebuiltSummary
        provisions={provisions}
        allProvisions={allProvisions || provisions}
        onSelectProvision={onSelectProvision}
        deal={deal}
      />
    );
  }
  if (type === 'COND' || type === 'COND-M' || type === 'COND-B' || type === 'COND-S') {
    // One combined Closing-Conditions table with full-span Mutual / Buyer /
    // Target header rows (per user) — built from ALL COND provisions so the
    // whole picture shows regardless of which family sub-page is open.
    return (
      <div className="space-y-3">
        <CondFrustrationBanner
          allProvisions={allProvisions || provisions}
          onSelectProvision={onSelectProvision}
        />
        <CondSingleTable
          allProvisions={allProvisions || provisions}
          onSelectProvision={onSelectProvision}
        />
      </div>
    );
  }
  if (type === 'IOC' || type === 'IOC-T' || type === 'IOC-B') {
    // The IOC Affirmative / General Exceptions / Negative Covenants tables
    // above already surface every IOC-level fact worth reading. The legacy
    // 3-row CategoryFeatureSummaryTable here (Schedule Reference / Materiality
    // Qualifier / Parent IOC Buckets) added nothing on top of those and read
    // as a stale footer, so it is intentionally not rendered.
    return null;
  }
  if (type === 'COV') {
    return (
      <CategoryFeatureSummaryTable
          deal={deal}
        provisions={provisions}
        type="COV"
        onSelectProvision={onSelectProvision}
      />
    );
  }

  // REP-T / REP-B: present in AGREEMENT ORDER (the canonical sequence the deal
  // itself uses), not by classification/insertion accident. Metsera fb2 block
  // 2e: primary key is features.sectionNumber with a NATURAL sort (3.02 <
  // 3.10); rows without a parseable section number fall back to document
  // position (ai_metadata.startChar) and sort after sectioned rows. Synthetic
  // "_notPresent" placeholders stay last.
  if (type === 'REP-T' || type === 'REP-B') {
    const startOf = (p) => {
      const meta = getAiMetadata(p) || {};
      return typeof meta.startChar === 'number' ? meta.startChar : Number.POSITIVE_INFINITY;
    };
    const real = provisions.filter((p) => !p._notPresent);
    const placeholders = provisions.filter((p) => !!p._notPresent);
    const byStartChar = [...real].sort((a, b) => startOf(a) - startOf(b));
    const bySection = sortByAgreementOrder(
      byStartChar,
      (p) => (getStructuredFeatures(p) || {}).sectionNumber,
    );
    provisions = [...bySection, ...placeholders];
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

  // Block 8/9b: every review table gets a small uppercase title. The reps
  // tables were missing one — name them per side; other types reuse their
  // canonical type label.
  const tableTitle = type === 'REP-T'
    ? 'Representations & Warranties — Company'
    : type === 'REP-B'
      ? 'Representations & Warranties — Parent & Merger Sub'
      : typeLabel(type);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-bg/60 border-b border-border">
        <p className="text-[10px] font-ui font-medium text-inkFaint uppercase tracking-wider">
          {tableTitle}
        </p>
      </div>
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
                    <td className="px-3 py-2 align-top whitespace-normal break-words sticky left-0 bg-bg/30 z-10">
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
                  {/* Metsera fb2 block 2a (REPEAT-FAILURE fix): the Term cell
                      hovers to the row's provision source for EVERY row. The
                      earlier hover fix (audit block 9a, commit 686530d) only
                      covered VALUE cells via CellWithSource /
                      MaterialityQualifierCell — this first column never went
                      through either renderer, so rows whose qualifier cell was
                      empty appeared to have no hover at all. The wiring below
                      (HoverSource quote={termCellHoverQuote(p)}) is asserted
                      by tests/reps-table-display.test.js — do not remove. */}
                  <td className="px-3 py-2 align-top whitespace-normal break-words sticky left-0 bg-white z-10">
                    <HoverSource quote={termCellHoverQuote(p)}>
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
                    </HoverSource>
                  </td>
                  {columns.map((k) => {
                    const raw = features[k];
                    // Materiality qualifier — render as canonical pill(s).
                    // Handles a single rep that mixes MAE + plain-materiality
                    // codes ("Generally MAE and some elements material to the
                    // Company"). Applies to any type that surfaces the column.
                    if (k === 'materialityQualifier' || k === 'materialityQualifiers') {
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[320px] text-ink">
                          <MaterialityQualifierCell rawValue={raw} provision={p} />
                        </td>
                      );
                    }
                    // Knowledge qualifier — canonical pill + extracted scope
                    // ("Partial: …" / "Entire rep") when available (fb2 2c).
                    if (k === 'knowledgeQualifier' || k === 'knowledgeQualifiers') {
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[320px] text-ink">
                          <KnowledgeQualifierCell rawValue={raw} provision={p} knowledgeScope={features.knowledgeScope} />
                        </td>
                      );
                    }
                    // REP synthetic: rolled-up "Specific Features" column.
                    // Metsera fb2 block 2d: the ERISA / Employee Benefits rep
                    // renders a clean dash here — the per-plan boolean
                    // checklist read as clutter (details remain on drill-in).
                    if ((type === 'REP-T' || type === 'REP-B') && k === 'specificFeatures') {
                      const cell = isErisaBenefitsRep(p) ? null : renderRepSpecificFeaturesCell(p);
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[360px] text-ink">
                          {cell || <span className="text-inkFaint italic">—</span>}
                        </td>
                      );
                    }
                    // REP synthetic: lookback period from secFilingsLookbackMonths.
                    // Unwrap citable / tagged shapes so we never render [object Object].
                    if ((type === 'REP-T' || type === 'REP-B') && k === 'lookbackPeriod') {
                      const signing = p?.deal?.announce_date || p?.deal_announce_date || null;
                      // ALWAYS frame as "X months prior to signing" — prefer the
                      // numeric month-count, then convert a stored date string.
                      const txt = lookbackToMonths(features.secFilingsLookbackMonths, signing)
                        || lookbackToMonths(features.lookbackPeriod, signing);
                      const rawForQuote = features.lookbackPeriod || features.secFilingsLookbackMonths;
                      return (
                        <td key={k} className="px-3 py-2 align-top max-w-[200px] text-ink">
                          <CellWithSource
                            provision={p}
                            featureKey={k}
                            raw={rawForQuote}
                            isEmpty={!txt}
                          >
                            {txt || <span className="text-inkFaint italic">—</span>}
                          </CellWithSource>
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
                            <CellWithSource provision={p} featureKey={k} raw={raw} isEmpty={false}>
                              {synth}
                            </CellWithSource>
                          </td>
                        );
                      }
                    }
                    // Tagged value (single object) — render as a CodeBadge
                    // pill for canonical-taxonomy fields (REP qualifiers,
                    // efforts standards, etc.) so the user can tell at a
                    // glance which values came from a normalized dictionary
                    // versus free text. Falls back to plain label for non-
                    // canonical contexts (e.g. when the resolved label is
                    // the same as a free-text quote).
                    if (isTaggedItem(raw)) {
                      const label = resolveTaggedLabel(k, raw) || raw.code;
                      const PILL_KEYS = new Set([
                        'materialityQualifier',
                        'knowledgeQualifier',
                        'effortsStandard',
                        'consentStandard',
                        'mergerForm',
                        'dealStructure',
                        'considerationType',
                        'exchangeRatioType',
                        'controllingParty',
                        'appliesToParty',
                        'partyWhoCanTerminate',
                        'parentRemedyObligation',
                        'knowledgeStandard',
                      ]);
                      const renderAsPill = PILL_KEYS.has(k);
                      return (
                        <td
                          key={k}
                          className="px-3 py-2 align-top max-w-[260px] text-ink"
                        >
                          <CellWithSource provision={p} featureKey={k} raw={raw} isEmpty={false} className="">
                            {renderAsPill
                              ? <CodeBadge code={raw.code} label={label} />
                              : <span>{label}</span>}
                          </CellWithSource>
                        </td>
                      );
                    }
                    // P9 item 4: route list-valued cells through
                    // renderFeatureCell (which uses renderListAsBullets) so
                    // arrays render as <ul><li> bullets instead of being
                    // joined with "; " by formatCellValue. Strings and other
                    // scalars still use formatCellValue for units/cleanup.
                    const isListShape =
                      Array.isArray(raw) ||
                      (isCitableValue(raw) && Array.isArray(getCitableValue(raw)));
                    if (isListShape) {
                      const inner = Array.isArray(raw) ? raw : getCitableValue(raw);
                      const isEmptyList = !inner || inner.length === 0;
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2 align-top max-w-[360px] ${
                            isEmptyList ? 'text-inkFaint/70 italic' : 'text-ink'
                          }`}
                        >
                          <CellWithSource
                            provision={p}
                            featureKey={k}
                            raw={raw}
                            isEmpty={isEmptyList}
                          >
                            {isEmptyList ? '—' : renderFeatureCell(k, raw)}
                          </CellWithSource>
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
                        <CellWithSource
                          provision={p}
                          featureKey={k}
                          raw={raw}
                          isEmpty={cell === null}
                        >
                          {cell === null ? '—' : cell}
                        </CellWithSource>
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
   CREATE PROVISION FLOATING BUTTON
   ═══════════════════════════════════════════════════════════ */
function CreateProvisionButton({ selection, onCreateProvision, addContext }) {
  if (!selection || !selection.rect) return null;

  const style = {
    position: 'fixed',
    top: selection.rect.bottom + 8,
    left: selection.rect.left + (selection.rect.width / 2) - 75,
    zIndex: 50,
  };

  // In add-from-section mode (#17), create with the section's type/category so
  // the "+ Add <noun>" flow lands the selected clause in the right section.
  const opts = addContext ? { type: addContext.type, category: addContext.defaultCategory || undefined } : {};
  const label = addContext ? `Create ${addContext.noun || 'provision'}` : 'Create Provision';
  return (
    <div style={style} className="animate-slide-up">
      <button
        onMouseDown={(e) => { e.preventDefault(); onCreateProvision(selection.text, opts); }}
        className="px-4 py-2 text-xs font-ui bg-accent text-white rounded-lg shadow-lg hover:bg-accent/90 transition-colors flex items-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2v8M2 6h8" />
        </svg>
        {label}
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
   P5 item 6: ADVISORS EDITOR MODAL
   ───────────────────────────────────────────────────────────
   Edits deal.metadata.advisors. PATCH /api/deals only ships a
   merged metadata so other metadata keys (custom_taxonomy_extensions,
   etc.) survive untouched.
   ═══════════════════════════════════════════════════════════ */
function AdvisorsEditorModal({ deal, onClose, onSaved }) {
  const initial = useMemo(() => {
    const arr = Array.isArray(deal?.metadata?.advisors) ? deal.metadata.advisors : [];
    // Defensive clone so edits don't mutate the deal object.
    return arr.map((a) => ({
      firm: a.firm || '',
      party: a.party || '',
      partner: a.partner || '',
      role: a.role || '',
    }));
  }, [deal]);
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };
  const addRow = () => {
    setRows((prev) => [...prev, { firm: '', party: 'company', partner: '', role: 'legal' }]);
  };

  const handleSave = async () => {
    if (!deal?.id) return;
    setSaving(true);
    setError(null);
    try {
      const cleaned = rows
        .map((r) => ({
          firm: (r.firm || '').trim(),
          party: r.party || '',
          partner: (r.partner || '').trim() || undefined,
          role: r.role || '',
        }))
        .filter((r) => r.firm); // drop empty firm rows
      const nextMetadata = { ...(deal.metadata || {}), advisors: cleaned };
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deal.id, metadata: nextMetadata }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-sm text-ink font-medium">Edit Advisors</h3>
          <button onClick={onClose} className="p-1 text-inkLight hover:text-ink" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {rows.length === 0 && (
            <p className="text-xs font-ui italic text-inkFaint">No advisors yet. Click "+ Add advisor" to add one.</p>
          )}
          {rows.map((r, idx) => (
            <div key={idx} className="border border-border rounded p-2 grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <label className="block text-[10px] font-ui text-inkFaint uppercase tracking-wider mb-0.5">Firm</label>
                <input
                  value={r.firm}
                  onChange={(e) => updateRow(idx, { firm: e.target.value })}
                  className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="e.g. Wachtell Lipton"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] font-ui text-inkFaint uppercase tracking-wider mb-0.5">Party</label>
                <select
                  value={r.party}
                  onChange={(e) => updateRow(idx, { party: e.target.value })}
                  className="w-full border border-border rounded px-2 py-1 text-xs font-ui bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">--</option>
                  <option value="parent">Parent</option>
                  <option value="company">Company</option>
                  <option value="special_committee">Special Committee</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-ui text-inkFaint uppercase tracking-wider mb-0.5">Role</label>
                <select
                  value={r.role}
                  onChange={(e) => updateRow(idx, { role: e.target.value })}
                  className="w-full border border-border rounded px-2 py-1 text-xs font-ui bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">--</option>
                  <option value="legal">Legal</option>
                  <option value="financial">Financial</option>
                  <option value="tax">Tax</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-ui text-inkFaint uppercase tracking-wider mb-0.5">Partner</label>
                <input
                  value={r.partner}
                  onChange={(e) => updateRow(idx, { partner: e.target.value })}
                  className="w-full border border-border rounded px-2 py-1 text-xs font-ui focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="optional"
                />
              </div>
              <div className="col-span-1 pt-3 text-right">
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="w-6 h-6 inline-flex items-center justify-center rounded text-inkFaint hover:bg-red-50 hover:text-red-600"
                  title="Remove advisor"
                  aria-label="Remove advisor"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="text-xs font-ui text-accent hover:underline mt-2"
          >
            + Add advisor
          </button>
          {error && <p className="text-xs font-ui text-red-600 mt-2">{error}</p>}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-ui border border-border rounded hover:bg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXTRACTION STATUS PILL — surfaces deal.metadata.extract_status and
   exposes per-type re-extract buttons + a re-classify shortcut. Driven
   by the split ingest pipeline (POST /api/ingest/classify and
   /api/ingest/extract-type). Renders nothing when no classify run has
   been recorded.
   ═══════════════════════════════════════════════════════════ */

const EXTRACTION_TYPE_LABELS = {
  'REP-T': 'Target reps',
  'REP-B': 'Buyer reps',
  IOC: 'Interim operating covenants',
  NOSOL: 'No-solicitation',
  ANTI: 'Antitrust / regulatory',
  COND: 'Closing conditions',
  TERMR: 'Termination rights',
  TERMF: 'Termination fees',
  STRUCT: 'Structure',
  CONSID: 'Consideration',
  COV: 'Other covenants',
  MISC: 'Miscellaneous',
  DEF: 'Definitions',
  MAE: 'Material adverse effect',
  OTHER: 'Other / unclassified',
};

function collapseTypeForExtraction(t) {
  if (!t) return null;
  if (t === 'IOC-T' || t === 'IOC-B') return 'IOC';
  if (t === 'TERMR-M' || t === 'TERMR-B' || t === 'TERMR-T') return 'TERMR';
  if (t === 'COND-M' || t === 'COND-B' || t === 'COND-S') return 'COND';
  return t;
}

function ExtractionStatusPill({ deal, provisions, onRefetch }) {
  const [expanded, setExpanded] = useState(false);
  const [busyType, setBusyType] = useState(null);
  const [reclassifying, setReclassifying] = useState(false);

  const md = deal?.metadata || {};
  const breakdown = md.classify_breakdown || null;
  const extractStatus = md.extract_status || {};
  // Audit fix batch item 8: a re-classify (POST /api/ingest/classify) or a
  // reprocess run wipes deal.metadata.extract_status to {} unconditionally
  // (see pages/api/ingest/classify.js / scripts/reprocess.js), expecting the
  // per-type /api/ingest/extract-type flow to repopulate it. Deals whose
  // structured features were instead patched in place by a targeted script
  // (e.g. the MetsFB2 batch-2 field additions) never go through that
  // per-type marker, so extract_status stays permanently empty even though
  // every provision is fully extracted — the banner then reads
  // "0/N TYPES COMPLETE" on a deal with nothing left to extract. When
  // extract_status carries no data at all, derive completeness from the
  // provisions themselves instead of trusting an absent status map: a type
  // counts as done if every provision classified into it already has a
  // non-empty structured features object.
  const hasExtractStatusData = Object.keys(extractStatus).length > 0;
  const derivedDoneTypes = useMemo(() => {
    if (hasExtractStatusData || !Array.isArray(provisions) || provisions.length === 0) return new Set();
    const byType = {};
    for (const p of provisions) {
      const c = collapseTypeForExtraction(p.type);
      if (!c) continue;
      (byType[c] || (byType[c] = [])).push(p);
    }
    const done = new Set();
    for (const [t, provs] of Object.entries(byType)) {
      if (provs.length > 0 && provs.every((p) => {
        const f = getStructuredFeatures(p);
        return !!f && Object.keys(f).length > 0;
      })) {
        done.add(t);
      }
    }
    return done;
  }, [provisions, hasExtractStatusData]);

  // Build the per-type-group list from the classify breakdown.
  const typeGroups = useMemo(() => {
    if (!breakdown) return [];
    const collapsed = {};
    for (const [t, n] of Object.entries(breakdown)) {
      const c = collapseTypeForExtraction(t);
      if (!c) continue;
      collapsed[c] = (collapsed[c] || 0) + n;
    }
    return Object.entries(collapsed).sort((a, b) => b[1] - a[1]);
  }, [breakdown]);

  if (!breakdown) {
    // No classify run yet — show a subtle "configure" hint linking to ingest.
    return (
      <div style={{ marginTop: 4, marginBottom: 4 }}>
        <Link
          href={`/ingest?deal_id=${deal.id}`}
          className="text-[10px] font-ui uppercase tracking-wider text-inkFaint hover:text-accent"
          style={{ textDecoration: 'none' }}
        >
          Manage ingest →
        </Link>
      </div>
    );
  }

  const total = typeGroups.length;
  const done = typeGroups.filter(([t]) => (
    hasExtractStatusData ? extractStatus[t]?.status === 'done' : derivedDoneTypes.has(t)
  )).length;
  const failed = hasExtractStatusData
    ? typeGroups.filter(([t]) => extractStatus[t]?.status === 'failed').length
    : 0;
  const allDone = total > 0 && done === total;

  const extractOne = async (type) => {
    setBusyType(type);
    try {
      const resp = await fetch('/api/ingest/extract-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id, type }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Extract failed');
      await onRefetch?.();
    } catch (err) {
      console.warn('[extract] failed', type, err);
    }
    setBusyType(null);
  };

  const reclassify = async () => {
    if (!confirm('Re-classify this deal? Existing classify output will be replaced and per-type extract status reset.')) return;
    setReclassifying(true);
    try {
      const resp = await fetch('/api/ingest/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Re-classify failed');
      await onRefetch?.();
    } catch (err) {
      alert('Re-classify failed: ' + err.message);
    }
    setReclassifying(false);
  };

  const summaryLabel = allDone
    ? `Extraction: complete (${done}/${total} types)`
    : failed > 0
    ? `Extraction: ${done}/${total} types done · ${failed} failed`
    : `Extraction: ${done}/${total} types complete`;

  return (
    <div style={{ marginTop: 4, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 4,
            background: allDone ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--paper)',
            color: failed > 0 ? 'var(--seller)' : allDone ? 'var(--accent-deep)' : 'var(--ink-mid)',
            border: `1px solid ${failed > 0 ? 'var(--seller)' : allDone ? 'var(--accent)' : 'var(--line)'}`,
            cursor: 'pointer',
          }}
        >
          {summaryLabel} {expanded ? '▾' : '▸'}
        </button>
        <Link
          href={`/ingest?deal_id=${deal.id}`}
          className="text-[10px] font-ui uppercase tracking-wider text-inkFaint hover:text-accent"
          style={{ textDecoration: 'none' }}
        >
          Manage ingest →
        </Link>
        <button
          type="button"
          onClick={reclassify}
          disabled={reclassifying}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 4,
            background: 'transparent',
            color: reclassifying ? 'var(--ink-faint)' : 'var(--ink-light)',
            border: '1px solid var(--line)',
            cursor: reclassifying ? 'not-allowed' : 'pointer',
          }}
        >
          {reclassifying ? 'Re-classifying…' : 'Re-classify'}
        </button>
      </div>
      {expanded && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: 'var(--paper)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {typeGroups.map(([type, sectionCount]) => {
            const st = extractStatus[type] || {};
            // Audit fix batch item 8: keep the per-row badge consistent with
            // the header summary above — when extract_status is empty
            // deal-wide, fall back to the same provisions-derived signal
            // rather than showing "pending" on a type that's actually done.
            const derivedDone = !hasExtractStatusData && derivedDoneTypes.has(type);
            const status = busyType === type ? 'extracting' : (st.status || (derivedDone ? 'done' : 'pending'));
            return (
              <div
                key={type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 6px',
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1, color: 'var(--ink)' }}>
                  {EXTRACTION_TYPE_LABELS[type] || type}
                  <span style={{ color: 'var(--ink-faint)', marginLeft: 6, fontSize: 11 }}>
                    ({type}) · {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
                    {status === 'done' && typeof st.inserted === 'number' && (
                      <> · {st.inserted} provisions</>
                    )}
                    {status === 'done' && typeof st.completed_at === 'string' && (
                      <> · {new Date(st.completed_at).toLocaleString()}</>
                    )}
                    {status === 'failed' && st.error && (
                      <> · <span style={{ color: 'var(--seller)' }}>{st.error}</span></>
                    )}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '.1em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background:
                      status === 'done'
                        ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                        : status === 'extracting'
                        ? 'var(--accent-soft)'
                        : status === 'failed'
                        ? 'color-mix(in srgb, var(--seller) 12%, transparent)'
                        : 'var(--paper)',
                    color:
                      status === 'done'
                        ? 'var(--accent-deep)'
                        : status === 'extracting'
                        ? 'var(--accent-deep)'
                        : status === 'failed'
                        ? 'var(--seller)'
                        : 'var(--ink-faint)',
                    border: `1px solid ${
                      status === 'done'
                        ? 'var(--accent)'
                        : status === 'extracting'
                        ? 'var(--accent)'
                        : status === 'failed'
                        ? 'var(--seller)'
                        : 'var(--line)'
                    }`,
                  }}
                >
                  {status}
                </span>
                <button
                  type="button"
                  onClick={() => extractOne(type)}
                  disabled={busyType !== null}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: 'var(--surface)',
                    color: busyType !== null ? 'var(--ink-faint)' : 'var(--ink)',
                    border: '1px solid var(--line)',
                    cursor: busyType !== null ? 'not-allowed' : 'pointer',
                  }}
                >
                  {status === 'done' ? 'Re-extract' : 'Extract'}
                </button>
              </div>
            );
          })}
        </div>
      )}
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
  const { isEdit } = useViewMode();
  const { user } = useUser({ redirectTo: '/login' });
  const { deal, loading: dealLoading, refetch: refetchDeal } = useDeal(id);
  // P5 item 6: advisors editor modal toggle.
  const [advisorsModalOpen, setAdvisorsModalOpen] = useState(false);
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
    // Fix batch item 5: SECTION-LEFTOVER (internal coverage plumbing — text
    // not claimed by any provision) is edit-mode-only. Filtering here, at the
    // single choke point every downstream grouping/sidebar/filter view reads
    // from, means the type never needs re-excluding per render path.
    return filterProvisionsForViewMode(rawProvisions, isEdit).map(p => ({
      ...p,
      _status: statusOverrides[p.id] || 'unreviewed',
    }));
  }, [rawProvisions, statusOverrides, isEdit]);

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

  /* P5 item 7: evidence selection-mode state. When `selectionMode` is set,
   * the FullDocumentView listens for mouse-up + selection and, on Confirm,
   * calls `selectionMode.onSelect(text)` then clears the mode.
   *
   * P8 item 4 (verify): endSelectionMode now also returns the active tab to
   * 'provisions' so the user lands back on the editor with the newly-added
   * quote visible without having to click the tab themselves. */
  const [selectionMode, setSelectionMode] = useState(null);
  const startSelectionMode = useCallback(({ onSelect, label }) => {
    setSelectionMode({ active: true, onSelect, label: label || 'evidence' });
    setActiveTab('document');
  }, []);
  const endSelectionMode = useCallback(() => {
    setSelectionMode(null);
    setActiveTab('provisions');
  }, []);

  /* ── FB3 Surface 2: "see text" in-place document pop-under. Opened by any
   *    <TermCell> via DealNavContext; renders the raw agreement text
   *    windowed around the provision's span WITHOUT navigating away — the
   *    Provisions tab underneath keeps its scroll position because it never
   *    unmounts (the sheet is a fixed overlay, mounted/unmounted separately
   *    below). ── */
  const [docSheet, setDocSheet] = useState({ open: false, provision: null, quote: null });
  const openSeeText = useCallback(({ provision, quote }) => {
    setDocSheet({ open: true, provision, quote: quote || (provision && provision.full_text) || null });
  }, []);
  const closeSeeText = useCallback(() => {
    setDocSheet((s) => ({ ...s, open: false }));
  }, []);
  const dealNavCtxValue = useMemo(
    () => ({ dealId: id, openSeeText }),
    [id, openSeeText],
  );

  const evidenceCtxValue = useMemo(
    () => ({ showEvidence, selectionMode, startSelectionMode, endSelectionMode }),
    [showEvidence, selectionMode, startSelectionMode, endSelectionMode],
  );

  /* ── P5 item 8: deal-scoped custom taxonomy extensions ────────────────── */
  const customTaxonomyCtxValue = useMemo(() => ({
    extensions: (deal && deal.metadata && deal.metadata.custom_taxonomy_extensions) || {},
  }), [deal]);

  const handleSaveCustomTaxonomyOption = useCallback(async (featureKey, option) => {
    if (!deal || !deal.id) throw new Error('Deal not loaded');
    if (!featureKey || !option || !option.code) throw new Error('Invalid option');
    const existing = (deal.metadata && deal.metadata.custom_taxonomy_extensions) || {};
    const forKey = Array.isArray(existing[featureKey]) ? existing[featureKey] : [];
    // Dedupe by code (replace if exists; append otherwise).
    const filtered = forKey.filter((e) => e && e.code !== option.code);
    filtered.push({
      code: option.code,
      label: option.label || option.code,
      ...(option.synonyms ? { synonyms: option.synonyms } : {}),
    });
    const nextExtensions = { ...existing, [featureKey]: filtered };
    const nextMetadata = { ...(deal.metadata || {}), custom_taxonomy_extensions: nextExtensions };
    const res = await fetch('/api/deals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deal.id, metadata: nextMetadata }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    if (refetchDeal) refetchDeal();
    addToast(`Added custom option "${option.label}"`, 'success');
  }, [deal, refetchDeal, addToast]);

  /* ── Provisions sub-view: "cards" or "table" ── */
  const [provisionView, setProvisionView] = useState('table');
  // Per-section collapse state — keyed by provision type. Default: all expanded.
  const [collapsedSections, setCollapsedSections] = useState(() => new Set());
  const toggleSectionCollapse = useCallback((type) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

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
    // IOC-T expansion: bare-IOC provisions (from older extracts that didn't
    // emit IOC-T/IOC-B suffixes) are promoted to Company/Target whenever the
    // active filter touches IOC-T AND the deal has no actual IOC-B
    // provisions. Fires for: a direct IOC-T child click, AND a parent-group
    // click (filter array includes both IOC-T and IOC-B — Buyer presence in
    // the filter doesn't change that bare-IOC means Target here).
    const hasIocT = filterTypes.includes('IOC-T');
    const hasIocBProvisions = provisions.some(p => p.type === 'IOC-B');
    const effectiveTypes = new Set(filterTypes);
    if (hasIocT && !hasIocBProvisions) effectiveTypes.add('IOC');
    // NOSOL-T expansion mirrors IOC-T: bare NOSOL provisions count as
    // Company/Target so the Company/Target page populates.
    const hasNosolT = filterTypes.includes('NOSOL-T');
    if (hasNosolT) effectiveTypes.add('NOSOL');
    return sortByTypeOrder(provisions.filter(p => effectiveTypes.has(p.type)));
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
      const companyMae = maeProvs.filter((p) => maeDefinitionSide(p) === 'company');
      const parentMae = maeProvs.filter((p) => maeDefinitionSide(p) === 'parent');
      if (companyMae.length > 0) groups['MAE-DEF'] = companyMae;
      if (parentMae.length > 0) groups['MAE-DEF-P'] = parentMae;
    }
    // P8 item 3: synthesize a Material Contracts sidebar entry from any
    // REP-T provision whose code / category / features identify it as the
    // Material Contracts bucket source. The sidebar shows it under the
    // Representations group; clicking it routes to a synthetic page that
    // renders only the RepMaterialContractsTable + matching provision card.
    const mcProvs = (provisions || []).filter(isMaterialContractsProvision);
    if (mcProvs.length > 0) {
      groups['__MATERIAL_CONTRACTS'] = mcProvs;
      // NOTE: the material-contracts provisions deliberately REMAIN in the
      // REP-T (Company/Target) bucket too, so they still list under that
      // sidebar subheading. Clicking one routes to the standalone Material
      // Contracts table (see handleSidebarSelectProvision) rather than the
      // near-empty REP-T single-provision view.
    }
    // No Other Reps / Fraud (Abry) summary — ALWAYS shown (unlike Material
    // Contracts above, which only appears when a matching provision exists):
    // the whole point of this section is to affirmatively answer "Not
    // present in this agreement" / "Silent on fraud" when the deal lacks
    // these clauses, so the sidebar entry must never disappear. A one-item
    // sentinel keeps the group non-empty for the Sidebar's `total > 0`
    // visibility filter; NoOtherRepsFraudTable ignores it and derives its
    // answers from the deal's full `provisions` list directly (the Abry
    // fields can land on any provision type/code — see lib/abry.js).
    if ((provisions || []).length > 0) {
      groups['__ABRY'] = [{ id: '__abry_sentinel__', type: '__ABRY' }];
    }
    // IOC party promotion: the classifier currently tags BOTH target-side
    // and (rare) buyer-side IOC sections as bare 'IOC' (no party suffix). So
    // sidebar children IOC-T / IOC-B never light up on existing data. ~all M&A
    // agreements have only the TARGET's interim operating covenants — when a
    // deal has bare-IOC provisions AND no explicit IOC-B provisions, fold the
    // bare IOC pool into IOC-T so the sidebar reads "Company / Target" with
    // the right count. (When a deal genuinely has both, a future classifier
    // update will emit IOC-T / IOC-B directly; both will then show side-by-side.)
    if (groups['IOC'] && groups['IOC'].length > 0 && !groups['IOC-B']) {
      groups['IOC-T'] = [...(groups['IOC-T'] || []), ...groups['IOC']];
      delete groups['IOC'];
    }
    // Always-show Buyer/Parent IOC child: when ANY IOC exists, synthesize an
    // empty IOC-B entry so the sidebar shows "Buyer / Parent (0)" rather than
    // hiding it. Clicking the empty child renders the IOC tables with the
    // Parent halves reading "Not present in this agreement".
    const anyIoc = !!(groups['IOC-T'] || groups['IOC-B']);
    if (anyIoc && !groups['IOC-B']) groups['IOC-B'] = [];
    // Same always-show treatment for TERMR per user request — when any TERMR
    // exists, surface Mutual / Buyer / Target in the sidebar even when empty
    // so the parent group renders all three as stacked sections (with "Not
    // present in this agreement" for the empty ones). Unclassified (bare
    // TERMR) keeps its existing "only when present" behaviour.
    const anyTermr = !!(groups['TERMR-M'] || groups['TERMR-B'] || groups['TERMR-T'] || groups['TERMR']);
    if (anyTermr) {
      if (!groups['TERMR-M']) groups['TERMR-M'] = [];
      if (!groups['TERMR-B']) groups['TERMR-B'] = [];
      if (!groups['TERMR-T']) groups['TERMR-T'] = [];
    }
    // NOSOL party split — same pattern as IOC. Classifier emits bare NOSOL
    // (no party suffix); ~all M&A agreements only have a Company no-shop, so
    // promote bare NOSOL to NOSOL-T and synthesize an empty NOSOL-B child so
    // the sidebar shows "Buyer / Parent (0)" with a "Not present" placeholder
    // page. When the classifier learns party detection, both populated
    // children will render side-by-side.
    if (groups['NOSOL'] && groups['NOSOL'].length > 0) {
      groups['NOSOL-T'] = [...(groups['NOSOL-T'] || []), ...groups['NOSOL']];
      delete groups['NOSOL'];
    }
    const anyNosol = !!(groups['NOSOL-T'] || groups['NOSOL-B']);
    if (anyNosol) {
      if (!groups['NOSOL-T']) groups['NOSOL-T'] = [];
      if (!groups['NOSOL-B']) groups['NOSOL-B'] = [];
    }
    return groups;
  }, [provisions]);

  /* ── Group filtered provisions by type ──
   *  Synthesize MAE-DEF and __MATERIAL_CONTRACTS the same way provsByType
   *  does so the per-type render loop picks them up. activeFilter on these
   *  synthetic types would otherwise yield 0 provisions and render the
   *  empty-state. */
  const filteredProvsByType = useMemo(() => {
    const groups = groupProvisionsByType(filteredProvisions);
    // When the active filter targets a synthetic group, repopulate it from
    // ALL provisions (not the filtered set, which dropped them). MAE splits
    // into Company (MAE-DEF) and Parent (MAE-DEF-P) sides.
    const maeFilterActive = (t) => activeFilter === t || (Array.isArray(activeFilter) && activeFilter.includes(t));
    const maeSource = (maeFilterActive('MAE-DEF') || maeFilterActive('MAE-DEF-P'))
      ? (provisions || [])
      : filteredProvisions;
    const allMae = maeSource.filter(isMaeDefinitionProvision);
    const companyMae = allMae.filter((p) => maeDefinitionSide(p) === 'company');
    const parentMae = allMae.filter((p) => maeDefinitionSide(p) === 'parent');
    if (companyMae.length > 0) groups['MAE-DEF'] = companyMae;
    if (parentMae.length > 0) groups['MAE-DEF-P'] = parentMae;
    if (activeFilter === '__MATERIAL_CONTRACTS' || (Array.isArray(activeFilter) && activeFilter.includes('__MATERIAL_CONTRACTS'))) {
      const mcProvs = (provisions || []).filter(isMaterialContractsProvision);
      if (mcProvs.length > 0) groups['__MATERIAL_CONTRACTS'] = mcProvs;
    } else {
      const mcProvs = filteredProvisions.filter(isMaterialContractsProvision);
      if (mcProvs.length > 0) groups['__MATERIAL_CONTRACTS'] = mcProvs;
    }
    // No Other Reps / Fraud (Abry) — always present (see the matching
    // comment in provsByType above); a filtered view can drop the sentinel,
    // so re-synthesize it here too whenever the deal has any provisions.
    if ((provisions || []).length > 0) {
      groups['__ABRY'] = [{ id: '__abry_sentinel__', type: '__ABRY' }];
    }
    // IOC party promotion + section synthesis (mirrors REPs):
    //   • When activeFilter touches IOC-T (single child click OR parent-group
    //     array), promote bare-IOC provisions into IOC-T AND drop the bare
    //     IOC group so we don't render duplicate sections.
    //   • Synthesize an empty IOC-B section ONLY when the user expects to see
    //     the Parent half: a parent-group click (array contains both), a
    //     direct Buyer/Parent click (activeFilter === 'IOC-B'), or the All
    //     Provisions view (activeFilter === null) when any IOC exists. A
    //     direct Company/Target click suppresses the IOC-B section.
    const iocTFilterActive = activeFilter === 'IOC-T' || (Array.isArray(activeFilter) && activeFilter.includes('IOC-T'));
    if (iocTFilterActive) {
      const bareIoc = (provisions || []).filter((p) => p.type === 'IOC');
      if (bareIoc.length > 0) groups['IOC-T'] = [...(groups['IOC-T'] || []), ...bareIoc];
      delete groups['IOC'];
    } else if (groups['IOC'] && groups['IOC'].length > 0 && !groups['IOC-B']) {
      groups['IOC-T'] = [...(groups['IOC-T'] || []), ...groups['IOC']];
      delete groups['IOC'];
    }
    const isParentIocClick = Array.isArray(activeFilter) && activeFilter.includes('IOC-T') && activeFilter.includes('IOC-B');
    const isIocBOnlyClick = activeFilter === 'IOC-B';
    const isAllProvisions = activeFilter === null;
    const wantIocBSection = isParentIocClick || isIocBOnlyClick || (isAllProvisions && (groups['IOC-T'] || groups['IOC-B']));
    if (wantIocBSection && !groups['IOC-B']) groups['IOC-B'] = [];

    // TERMR section synthesis — mirrors the IOC pattern. Parent-group click
    // synthesizes all three party-typed children (Mutual / Buyer / Target);
    // direct child click synthesizes just that child (so its empty page still
    // renders); All Provisions synthesizes all three when any TERMR exists.
    const termrChildren = ['TERMR-M', 'TERMR-B', 'TERMR-T'];
    const termrArr = Array.isArray(activeFilter) ? activeFilter : [];
    const isParentTermrClick = termrChildren.every((t) => termrArr.includes(t));
    const isTermrChildClick = typeof activeFilter === 'string' && termrChildren.includes(activeFilter);
    const anyTermrPresent = !!(groups['TERMR-M'] || groups['TERMR-B'] || groups['TERMR-T'] || groups['TERMR']);
    if (isParentTermrClick) {
      for (const t of termrChildren) if (!groups[t]) groups[t] = [];
    } else if (isTermrChildClick && !groups[activeFilter]) {
      groups[activeFilter] = [];
    } else if (isAllProvisions && anyTermrPresent) {
      for (const t of termrChildren) if (!groups[t]) groups[t] = [];
    }

    // NOSOL promotion + section synthesis — mirrors IOC. Bare NOSOL provisions
    // (from extracts that didn't emit NOSOL-T/NOSOL-B) belong to Company/Target
    // by convention. Parent-group click → both NOSOL-T and NOSOL-B sections;
    // direct child click → just that one; All Provisions → both when any NOSOL.
    const nosolArr = Array.isArray(activeFilter) ? activeFilter : [];
    const isParentNosolClick = nosolArr.includes('NOSOL-T') && nosolArr.includes('NOSOL-B');
    const isNosolTChildClick = activeFilter === 'NOSOL-T';
    const isNosolBChildClick = activeFilter === 'NOSOL-B';
    const nosolTFilterActive = isParentNosolClick || isNosolTChildClick || (Array.isArray(activeFilter) && activeFilter.includes('NOSOL-T'));
    if (nosolTFilterActive) {
      const bareNosol = (provisions || []).filter((p) => p.type === 'NOSOL');
      if (bareNosol.length > 0) groups['NOSOL-T'] = [...(groups['NOSOL-T'] || []), ...bareNosol];
      delete groups['NOSOL'];
    } else if (groups['NOSOL'] && groups['NOSOL'].length > 0) {
      groups['NOSOL-T'] = [...(groups['NOSOL-T'] || []), ...groups['NOSOL']];
      delete groups['NOSOL'];
    }
    const anyNosolFilt = !!(groups['NOSOL-T'] || groups['NOSOL-B']);
    if (isParentNosolClick && !groups['NOSOL-B']) groups['NOSOL-B'] = [];
    if (isNosolBChildClick && !groups['NOSOL-B']) groups['NOSOL-B'] = [];
    if (isNosolTChildClick && !groups['NOSOL-T']) groups['NOSOL-T'] = [];
    if (isAllProvisions && anyNosolFilt) {
      if (!groups['NOSOL-B']) groups['NOSOL-B'] = [];
      if (!groups['NOSOL-T']) groups['NOSOL-T'] = [];
    }

    // Collapse the COND and TERMR party families (COND-M/B/S, TERMR-M/B/T) into
    // a SINGLE section each. CondSingleTable / TermrRebuiltSummary already render
    // every family in ONE table with full-span Mutual/Buyer/Seller header rows,
    // so leaving the party types as separate keys made the page render that same
    // table three times. Rebuild the map order-preserving (the family takes the
    // slot of its first-seen member) so section order is unchanged.
    const FAMILY_OF = {
      'COND-M': 'COND', 'COND-B': 'COND', 'COND-S': 'COND',
      'TERMR-M': 'TERMR', 'TERMR-B': 'TERMR', 'TERMR-T': 'TERMR',
    };
    const collapsed = {};
    for (const [k, v] of Object.entries(groups)) {
      const target = FAMILY_OF[k] || k;
      collapsed[target] = [...(collapsed[target] || []), ...v];
    }
    // fb2 blocks 4a/4b: render sections in SIDEBAR_GROUPS order (Structure →
    // Consideration → Reps → MAE → Material Contracts → IOC → No-Sol → Anti →
    // Conditions → Termination Rights → Fees → rest; Seller/Target before
    // Buyer). Synthesized groups (empty IOC-B / NOSOL-B / TERMR children,
    // MAE-DEF, __MATERIAL_CONTRACTS) are appended above in whatever order the
    // synthesis code runs — without this sort they'd fall to the page bottom.
    const orderedEntries = Object.entries(collapsed).sort((a, b) => {
      const ai = TYPE_SORT_ORDER.has(a[0]) ? TYPE_SORT_ORDER.get(a[0]) : 9999;
      const bi = TYPE_SORT_ORDER.has(b[0]) ? TYPE_SORT_ORDER.get(b[0]) : 9999;
      return ai - bi;
    });
    return Object.fromEntries(orderedEntries);
  }, [filteredProvisions, provisions, activeFilter, TYPE_SORT_ORDER]);

  /* ── Identify the first IOC-flavored type in the rendered order. The
   *    IOC affirmative / general-exceptions / negative tables render a
   *    Target + Buyer split that pulls from BOTH IOC-T and IOC-B provisions,
   *    so we only want them to render ONCE per page (on the first
   *    encountered IOC type) instead of duplicating across IOC / IOC-T /
   *    IOC-B sections. */
  const firstIocType = useMemo(() => {
    const keys = Object.keys(filteredProvsByType);
    return keys.find((k) => k === 'IOC' || k === 'IOC-T' || k === 'IOC-B') || null;
  }, [filteredProvsByType]);

  /* ── All filtered IOC provisions (any IOC flavor) — passed to the IOC
   *    tables on the firstIocType section so the Target + Buyer split
   *    can see both halves regardless of which section the user lands on. */
  const allFilteredIocProvisions = useMemo(() => {
    return filteredProvisions.filter((p) =>
      p.type === 'IOC' || p.type === 'IOC-T' || p.type === 'IOC-B'
    );
  }, [filteredProvisions]);

  // Derive the IOC side-gate from the ACTIVE FILTER, not from each loop's
  // type. A direct child click sets activeFilter to a single string and we
  // gate the off side. A parent-group click sets it to an array (or null),
  // so we render BOTH halves (Target with content, Parent reading "Not
  // present in this agreement").
  const iocSide = (() => {
    if (activeFilter === 'IOC-T') return 'target';
    if (activeFilter === 'IOC-B') return 'buyer';
    return null;
  })();

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

  // On phones the 286px sidebar would crush the content column, so default it
  // closed below the md breakpoint (it becomes an overlay when toggled open).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

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
    const prov = provisions.find(p => p.id === provId);
    // Material Contracts provisions live under the REP-T (Company/Target)
    // subheading too, but the useful view for them is the standalone buckets
    // table, NOT a single-provision REP-T page (which would show only the
    // general-exceptions + expected-rep placeholders). Route the click to the
    // synthetic Material Contracts page so it renders exactly like its own
    // top-level section.
    if (prov && isMaterialContractsProvision(prov)) {
      setSelectedProvId(null);
      setActiveFilter('__MATERIAL_CONTRACTS');
      setProvisionView('table');
      setExpandedLabel(null);
      return;
    }
    setSelectedProvId(provId);
    if (prov) {
      setActiveFilter(prov.type);
      // Auto-open the right edit panel so a single sidebar click on a
      // provision swaps the right-side toolbar to the editor for that item.
      // User view: no editing, so leave the panel closed — the main content
      // still switches to this provision's card via setSelectedProvId above.
      if (isEdit) setEditingProvision(prov);
      setExpandedLabel(null);
    }
    // Single-provision selection should use the card view so the user can
    // see the full structured summary + collapsible text for that one item.
    setProvisionView('cards');
  }, [provisions, isEdit]);

  /* ── Edit provision ── */
  const handleEditProvision = useCallback((provision) => {
    // User view: keep the click-to-evidence behavior (highlight + jump below)
    // but never mount the edit panel — no editing/save affordances for users.
    if (isEdit) setEditingProvision(provision);
    setExpandedLabel(null);
    // Pre-mark the provision's section in the document (without switching tabs)
    // so when the user opens the Full Document tab it's already scrolled to and
    // clearly highlighted. Use a focused chunk of the provision's full_text.
    if (provision && typeof provision.full_text === 'string' && provision.full_text.trim()) {
      // Pass (most of) the provision text so the document highlight covers the
      // WHOLE provision, matching the sidebar (#12) — not just a 240-char snippet.
      // Capped so a pathologically long provision doesn't bloat the matcher.
      const chunk = provision.full_text.trim().slice(0, 2000);
      setHighlightedQuote(chunk);
      setHighlightedQuoteNonce((n) => n + 1);
    }
  }, [isEdit]);

  // Open the editor for a provision by id (used by the trust strip's unverified-
  // quote "Edit" action, which only carries provision_id).
  const handleEditProvisionById = useCallback((provId) => {
    const p = (provisions || []).find((x) => x.id === provId);
    if (p) handleEditProvision(p);
  }, [provisions, handleEditProvision]);

  // FB3 Surface 1: the provision card page (pages/review/[id]/provision/
  // [provisionId].js) can't mount EditPanel itself (needs deal/allTypes/
  // allCategories + this page's save/approve/flag/delete handlers — see the
  // FB3 brief). Instead its "Edit" link comes back here with ?edit=<id>,
  // and this effect opens the same edit panel the tables already use.
  useEffect(() => {
    if (!router.isReady || !isEdit) return;
    const editId = router.query.edit;
    if (typeof editId === 'string' && editId) handleEditProvisionById(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.edit, isEdit, provisions]);

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
    // Jump straight to the provision's CURRENT text in the document (highlight
    // + scroll-into-view) instead of dropping the user at the top to scroll
    // through the whole agreement. A leading chunk is a reliable anchor.
    const current = (provision.full_text || '').trim();
    if (current) {
      showEvidence(current.slice(0, 240));
    } else {
      setActiveTab('document');
    }
  }, [showEvidence]);

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

  /* ── Add-from-selection mode (#17: select source text, never paste) ──
     When set, the user is picking the clause in the document for a new
     provision of addContext.type. */
  const [addContext, setAddContext] = useState(null); // { type, defaultCategory, noun }
  const handleBeginAdd = useCallback((ctx) => {
    if (!ctx || !ctx.type) return;
    setAddContext(ctx);
    setEditingProvision(null);
    setActiveTab('document');
    addToast(`Select the clause for the new ${ctx.noun || 'item'} in the document`, 'info');
  }, [addToast]);
  const handleCancelAdd = useCallback(() => setAddContext(null), []);

  /* ── Create Provision from Selection ── */
  const handleCreateProvision = useCallback(async (text, opts = {}) => {
    if (!id) return;
    const body = (text || '').trim();
    if (!body) { addToast('Select the clause text in the document first', 'error'); return; }
    try {
      const resp = await fetch('/api/provisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: id,
          full_text: body,
          type: opts.type || 'MISC',
          category: opts.category || 'Uncategorized',
          ai_favorability: 'neutral',
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      addToast('Item added from selected text — edit to classify & enrich', 'success');
      refetchProvs();
      setTextSelection(null);
      setAddContext(null); // exit add-from-selection mode
      // Open the new provision for editing (set type/category/features).
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
    <CustomTaxonomyContext.Provider value={customTaxonomyCtxValue}>
    <DealNavContext.Provider value={dealNavCtxValue}>
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
            Corpus
          </Link>
          <div className="flex items-center gap-2 text-[12.5px] text-inkFaint">
            <span style={{ color: 'var(--line)' }}>/</span>
            <Link href="/deals" className="text-inkFaint hover:text-ink transition-colors">
              Deals
            </Link>
            <span style={{ color: 'var(--line)' }}>/</span>
            <Link href={`/review/${id}`} className="text-inkFaint hover:text-ink transition-colors">
              {dealLabel}
            </Link>
            <span style={{ color: 'var(--line)' }}>/</span>
            <span className="text-inkMid font-medium">Review</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle />
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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop — tap to dismiss the overlaid sidebar */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Left Sidebar — in-flow on md+, fixed overlay on mobile */}
        {sidebarOpen && (
          <div className="max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl">
            <Sidebar
              provsByType={provsByType}
              provisions={provisions}
              activeFilter={activeFilter}
              onFilterType={handleFilterType}
              onSelectProvision={handleSidebarSelectProvision}
              activeProvId={editingProvision?.id}
              onMoveProvision={handleMoveProvision}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '34px clamp(14px, 4vw, 40px) 120px' }}>
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
              {/* P5 item 6: Edit affordance for advisors. Always show the Edit
                  button; show the chip row when at least one advisor exists. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 8, marginBottom: 8, alignItems: 'center' }}>
                {Array.isArray(deal.metadata?.advisors) && deal.metadata.advisors.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                {isEdit && (() => {
                  const hasAdvisors = Array.isArray(deal.metadata?.advisors) && deal.metadata.advisors.length > 0;
                  // When advisors exist, render a compact "+" chip next to the
                  // pills (matches their styling) to add more. When none exist,
                  // keep the explicit "+ Add advisors" call-to-action.
                  if (hasAdvisors) {
                    return (
                      <button
                        type="button"
                        onClick={() => setAdvisorsModalOpen(true)}
                        title="Add or edit advisors"
                        style={{
                          fontFamily: 'inherit',
                          fontSize: 11,
                          lineHeight: 1,
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px dashed #c4c2bd',
                          background: '#fff',
                          color: '#6a665f',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        +
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => setAdvisorsModalOpen(true)}
                      className="text-[10px] font-ui uppercase tracking-wider text-accent hover:underline"
                      style={{ padding: '3px 6px' }}
                    >
                      + Add advisors
                    </button>
                  );
                })()}
              </div>
              {isEdit && (
                <ExtractionStatusPill
                  deal={deal}
                  provisions={provisions}
                  onRefetch={async () => {
                    await refetchDeal?.();
                    await refetchProvs?.();
                  }}
                />
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
                {/* "Classified" is a pipeline-stage stat (extraction status),
                    not deal content — editor-only, like the trust strip below. */}
                {isEdit && (
                  <div className="m">
                    <span className="k">Classified</span>
                    <span className="v">
                      {provisions.length} provision{provisions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              {isEdit && (
                <TrustStrip dealId={id} onJump={showEvidence} onEditProvisionById={handleEditProvisionById} />
              )}
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
                      // fb2 block 4c: an EMPTY buyer-side section collapses to
                      // a single inline line ("IOC (Buyer) — None") instead of
                      // a numbered header framing a stack of empty tables.
                      if ((type === 'IOC-B' || type === 'NOSOL-B') && provs.filter((p) => !p._notPresent).length === 0) {
                        return (
                          <div key={type} className="flex items-center gap-2 py-1 px-1">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 7,
                                height: 7,
                                borderRadius: 2,
                                background: typeHex(type),
                                flexShrink: 0,
                              }}
                            />
                            <span className="text-xs font-ui text-inkFaint">
                              <span className="font-medium text-inkMid">
                                {type === 'IOC-B' ? 'IOC (Buyer)' : 'No-Shop (Buyer)'}
                              </span>
                              {' — None'}
                            </span>
                          </div>
                        );
                      }
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
                      // P8 item 3: Material Contracts is its own sidebar page —
                      // pull the matching REP-T provisions OUT of the regular
                      // REP-T page so they don't render twice. The synthetic
                      // page is handled by its own type branch further down.
                      if (type === 'REP-T') {
                        rest = rest.filter((p) => !isMaterialContractsProvision(p));
                      }
                      // Block 9a: REP preamble pseudo-provisions (codes
                      // REP-T-PREAMBLE / REP-B-PREAMBLE, category "Reps
                      // Preamble") never render as per-rep table rows — their
                      // content is already summarized above the table by
                      // RepGeneralExceptionsTable / RepKnowledgeNote.
                      if (type === 'REP-T' || type === 'REP-B') {
                        rest = rest.filter((p) => {
                          const code = String((getAiMetadata(p) || {}).code || p.code || '').toUpperCase();
                          if (code === 'REP-T-PREAMBLE' || code === 'REP-B-PREAMBLE') return false;
                          if (/reps?\s+preamble/i.test(String(p.category || ''))) return false;
                          return true;
                        });
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
                      const isCollapsed = collapsedSections.has(type);
                      return (
                        <div key={type} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => toggleSectionCollapse(type)}
                            className="rec-type-head w-full text-left cursor-pointer"
                            aria-expanded={!isCollapsed}
                          >
                            <span className="ix">{String(typeIdx + 1).padStart(2, '0')}</span>
                            <span className="th-dot" style={{ background: typeHex(type) }} />
                            <h2>{typeLabel(type)}</h2>
                            <span
                              className="inline-flex items-center text-inkFaint text-sm select-none"
                              aria-hidden="true"
                              style={{ marginLeft: 4 }}
                            >
                              {isCollapsed ? '▸' : '▾'}
                            </span>
                            <span className="rule" />
                          </button>
                          {/* COV (Other Covenants) renders the PW diligence
                              summary table in 'table' view (via
                              CategoryFeatureSummaryTable inside ProvisionTable);
                              cards view continues to render the per-provision
                              ProvisionCard stack unchanged. */}
                          {!isCollapsed && ((provisionView === 'table') ? (
                            <div className="space-y-3">
                              {showPreambleCard && (
                                <PreambleCard
                                  provision={preamble}
                                  onEdit={handleEditProvision}
                                  allProvisions={provisions}
                                />
                              )}
                              {/* IOC tables render PER SECTION (like REPs): each
                                  child type's section emits its OWN tables, with `side`
                                  derived from the loop's `type` so IOC-T section shows the
                                  Target half (with content) and IOC-B section shows the
                                  Buyer half (which placeholder-renders "Not present in
                                  this agreement" for empty groups). A bare-IOC section
                                  (rare — only when the deal genuinely has both party-typed
                                  and unclassified provisions) shows both halves. */}
                              {isIocType && (
                                <IocAffirmativeCovenantsTable
                                  iocProvisions={provs}
                                  onSelectProvision={handleEditProvision}
                                  side={type === 'IOC-T' ? 'target' : type === 'IOC-B' ? 'buyer' : null}
                                />
                              )}
                              {isIocType && (
                                <IocGeneralExceptionsTable
                                  iocProvisions={provs}
                                  generalExceptionsProv={iocGeneralExceptions}
                                  onSelectProvision={handleEditProvision}
                                  side={type === 'IOC-T' ? 'target' : type === 'IOC-B' ? 'buyer' : null}
                                />
                              )}
                              {isIocType && (
                                <IocNegativeCovenantsTable
                                  iocProvisions={provs.filter((p) => !isPreambleProvision(p))}
                                  onSelectProvision={handleEditProvision}
                                  side={type === 'IOC-T' ? 'target' : type === 'IOC-B' ? 'buyer' : null}
                                  deal={deal}
                                />
                              )}
                              {(type === 'REP-T' || type === 'REP-B') && (
                                <RepKnowledgeNote provisions={rest} allProvisions={provisions} />
                              )}
                              {/* P3 item 2: General Exceptions apply to the
                                  ENTIRE reps section — render FIRST so they
                                  anchor the top of the page. */}
                              {(type === 'REP-T' || type === 'REP-B') && (
                                <RepGeneralExceptionsTable
                                  provisions={provs}
                                  dealAnnounceDate={deal?.announce_date || null}
                                />
                              )}
                              {/* P3 item 3: BringdownTable moved out of REP
                                  page; it now renders inside the matching
                                  COND canonical row (CanonicalConditionDetails). */}
                              {/* P8 item 3: RepMaterialContractsTable moved
                                  out of the inline REP-T page; it now renders
                                  on its own __MATERIAL_CONTRACTS sidebar page
                                  (branch below) so the buckets aren't buried. */}
                              {type === '__MATERIAL_CONTRACTS' && (
                                <RepMaterialContractsTable
                                  provisions={provs}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {/* No Other Reps / Fraud (Abry) — a deal-wide
                                  summary, not a per-type provision list, so it
                                  scans the FULL `provisions` array (any
                                  provision, any type/code) rather than the
                                  `provs`/`rest` derived for this loop
                                  iteration (which for '__ABRY' is just the
                                  visibility sentinel synthesized above). */}
                              {type === '__ABRY' && (
                                <NoOtherRepsFraudTable allProvisions={provisions} />
                              )}
                              {(type === 'MAE-DEF' || type === 'MAE-DEF-P') && (
                                <MaeDefinitionSummary
                                  allProvisions={provisions}
                                  onSelectProvision={handleEditProvision}
                                  side={type === 'MAE-DEF-P' ? 'parent' : 'company'}
                                />
                              )}
                              {rest.length > 0 && type === 'DEF' && (
                                <DefinitionsList
                                  provisions={rest}
                                  onSelectProvision={handleEditProvision}
                                />
                              )}
                              {type !== 'DEF' && type !== 'MAE-DEF' && type !== 'MAE-DEF-P' && type !== '__MATERIAL_CONTRACTS' && type !== '__ABRY' && (() => {
                                const restAugmented = (type === 'REP-T' || type === 'REP-B')
                                  ? augmentRepsWithExpectedPlaceholders(rest, type, provisions)
                                  : rest;
                                if (!restAugmented || restAugmented.length === 0) {
                                  // Empty TERMR child section (Mutual / Buyer / Target) — render a
                                  // "Not present" placeholder rather than disappearing so the parent-
                                  // group view stacks reads cleanly. IOC empties placeholder via their
                                  // own table wrappers above; non-children types render nothing.
                                  if (type === 'TERMR-M' || type === 'TERMR-B' || type === 'TERMR-T') {
                                    return (
                                      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                                        <div className="px-3 py-3 text-xs font-ui italic text-inkFaint">
                                          None extracted for this agreement.
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }
                                return (
                                  <ProvisionTable
                                    provisions={restAugmented}
                                    type={type}
                                    onSelectProvision={handleEditProvision}
                                    // ConsidTable/EquityAwardTable render their own inline
                                    // "+ Add" affordance whenever onAddProvision is truthy —
                                    // withhold it in user view (editors only).
                                    onAddProvision={isEdit ? handleBeginAdd : undefined}
                                    allProvisions={provisions}
                                    deal={deal}
                                  />
                                );
                              })()}
                              {/* (Removed) The matching REP-T provision cards
                                  that used to render below the buckets table
                                  on the Material Contracts page — the buckets
                                  table + per-row source links cover it; the
                                  card stack was redundant clutter. */}
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
                          ))}
                          {/* Add-an-item affordance — a FOOTER under the
                              section's content (not floating by the header), so
                              it reads as "append to this list": capture a
                              provision the extractor missed for this section. */}
                          {isEdit && !isCollapsed && !SYNTHETIC_SINGLE_PAGE_TYPES.has(type) && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <AddSectionItem
                                type={type}
                                defaultCategory={(rest && rest[0] && rest[0].category) || ''}
                                onBeginAdd={handleBeginAdd}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredProvisions.length === 0 && Object.keys(filteredProvsByType).length === 0 && (
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

        {/* Mobile backdrop for the edit panel (tap to close). isEdit-gated
            defensively — editingProvision should already be null in user
            view since the handlers above never set it there. */}
        {isEdit && editingProvision && (
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-[55]"
            onClick={() => setEditingProvision(null)}
          />
        )}

        {/* Right Edit Panel — editors only. No editing/save affordances in
            user view; see handleEditProvision / handleSidebarSelectProvision. */}
        {isEdit && editingProvision && (
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
            deal={deal}
            onSaveCustomTaxonomyOption={handleSaveCustomTaxonomyOption}
          />
        )}
      </div>

      {/* Add-from-selection mode banner (#17): prompt to pick the clause. Editors only. */}
      {isEdit && addContext && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-accent text-white rounded-lg shadow-lg px-4 py-2 text-xs font-ui flex items-center gap-3 animate-slide-up">
          <span>Select the clause for the new <b>{addContext.noun}</b> in the document, then click “Create”.</span>
          <button type="button" onClick={handleCancelAdd} className="underline opacity-90 hover:opacity-100">Cancel</button>
        </div>
      )}

      {/* Floating Create Provision Button — editors only (hidden while re-selecting text too). */}
      {isEdit && !reselectingProvId && (
        <CreateProvisionButton
          selection={textSelection}
          onCreateProvision={handleCreateProvision}
          addContext={addContext}
        />
      )}

      {/* Definition Tooltip */}
      <DefinitionTooltip def={hoveredDef} position={defPosition} />

      {/* P5 item 6: Advisors editor modal — editors only. */}
      {isEdit && advisorsModalOpen && deal && (
        <AdvisorsEditorModal
          deal={deal}
          onClose={() => setAdvisorsModalOpen(false)}
          onSaved={() => {
            if (refetchDeal) refetchDeal();
            addToast('Advisors updated', 'success');
          }}
        />
      )}
      {/* FB3 Surface 2: in-place document pop-under, opened by any TermCell's
          "see text" link via DealNavContext. Fixed-position overlay — mounting
          it here (outside the scrolling provisions column) means opening/
          closing it never touches that column's scroll position. */}
      <DocPopUnder
        open={docSheet.open}
        dealId={id}
        provision={docSheet.provision}
        quote={docSheet.quote}
        sourceText={hasSource ? agreementSource.full_text : null}
        docTitle={hasSource ? agreementSource.title : null}
        isEdit={isEdit}
        onEditProvision={handleEditProvision}
        onClose={closeSeeText}
      />
    </div>
    </EvidenceContext.Provider>
    </DealNavContext.Provider>
    </CustomTaxonomyContext.Provider>
  );
}
