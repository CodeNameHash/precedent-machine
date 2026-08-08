import React from 'react';
import { conditionsBConfig, conditionsMConfig, conditionsSConfig } from './conditions-m.config.js';
import { cardCode, cardFeatures, labelOf, splitForCell, triggerThresholdLabel, valueText } from './card-utils.js';
import { STANDARD_TEXT, standardColorKey } from './standard-colors.js';
import { voteStandard } from './vote-standard.js';
import bringDownTiers from '../../../lib/bring-down-tiers.js';
import { CONDITION_ABSENT_COPY } from '../../../lib/canonical-conditions.js';

const { bringDownTreatmentCodes, recoverBringDownFromCard } = bringDownTiers;

// Consolidates the three party-scoped condition tables (Mutual / Buyer /
// Seller) into the ONE grouped table the legacy pre-schema page showed,
// instead of three separate accordion sections. Reuses conditionsMConfig /
// conditionsBConfig / conditionsSConfig's row-building UNCHANGED (matching,
// canonical-code resolution, present/absent computation all stay exactly as
// those configs already compute them) -- only the presentation shell
// changes: two columns (Condition / Standard & Detail), grouped bands, a
// coverage footer instead of inline "Not found" rows, and synthesized
// values instead of a raw clause dump.

const GROUP_SPECS = [
  { id: 'mutual', label: 'Mutual conditions', config: conditionsMConfig, party: 'M' },
  { id: 'buyer', label: "Buyer's conditions — to Parent / Merger Sub's obligation", config: conditionsBConfig, party: 'B' },
  { id: 'seller', label: "Target's conditions — to the Company's obligation", config: conditionsSConfig, party: 'S' },
];

// Defensive presentation-layer guard, discovered against live Metsera data:
// some canonical rows with no `codes` (regex-only, e.g. the no-code "No
// Material Adverse Effect (Parent)" row) or rows whose regex fallback is
// generic enough to also match the OTHER party's category text (e.g.
// Seller's "Covenant Performance (Parent)" regex matching the Buyer's
// "Target Covenant Compliance" card on the word "Covenant...Compliance")
// can pick up a card that belongs to a different party's band entirely.
// conditionRowMatches()/CANONICAL_CONDITIONS_* in lib/canonical-conditions.js
// are the shared matcher this wrapper is told to reuse UNCHANGED, so this
// does not touch matching -- it only refuses to let a match whose OWN
// canonical code carries a different party letter (M/B/S) than the band
// it's being rendered under stand in as that band's row content. A match
// with no code at all (pure regex hit, no code to check) is left alone.
function bandAligned(provision, party) {
  const code = provision?.features?.canonicalCode;
  if (!code) return true;
  if (code === 'COND-FRUSTRATE') return party === 'M';
  const seg = String(code).split('-')[1];
  return !seg || seg === party;
}

// Canonical rubric code (last "-"-delimited segment, e.g. COND-M-STOCKHOLDER
// -> STOCKHOLDER) -> friendly Condition-column label. Ambiguity flagged in
// the work-package report: the spec's example map only names STOCKHOLDER,
// REG, LEGAL, REP, COV, CERT, MAE. S4/LISTING/DISSENT/FUNDS are extended
// here from the existing canonical-conditions.js row labels for parity
// (no bespoke Standard/Detail synthesis exists for those four -- they fall
// through to the generic threshold/cure/schedule renderer below).
const CONDITION_FAMILY_LABELS = {
  STOCKHOLDER: 'Stockholder Approval',
  REG: 'Antitrust / Regulatory Clearance',
  LEGAL: 'No Legal Restraint',
  REP: 'Accuracy of Representations',
  COV: 'Covenant Compliance',
  CERT: "Officer's Certificate",
  MAE: 'No Material Adverse Effect',
  S4: 'S-4 / Proxy Effective',
  LISTING: 'Stock Exchange Listing',
  DISSENT: 'Dissenting Shares Threshold',
  FUNDS: 'Financing / Sufficient Funds',
  FRUSTRATE: 'Condition Frustration / Prevention',
};

// Rows without a canonical code (matched by category regex only, e.g. the
// no-code "No Material Adverse Effect (Parent)" row) fall back to a
// label-sniff so their family-specific synthesis still applies.
function deriveFamily(row, code) {
  if (code) return String(code).split('-').pop();
  if (/material\s+adverse\s+effect/i.test(row.label || '')) return 'MAE';
  return null;
}

function friendlyLabel(family, fallback) {
  return (family && CONDITION_FAMILY_LABELS[family]) || fallback;
}

// AC (raw code hidden, exposed only on hover): the friendly label is the
// only visible text; the raw canonical code -- if one exists -- rides along
// as a native `title` tooltip, the existing lightweight hover affordance
// (EvidenceHoverSource is for quote evidence, not label metadata, so a
// native title attribute is the correct-weight tool here).
function conditionLabelNode(row, code, family) {
  const label = friendlyLabel(family, row.label);
  return React.createElement('span', { title: code || undefined }, label);
}

function firstDefined(matches, key) {
  for (const provision of matches || []) {
    const value = provision?.features?.[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

function isTruthyBoolLike(value) {
  return value === true || value === 'true';
}

function mkChip(PillCell, keyId, label, tone, provision, evidence, color) {
  if (!PillCell || !label) return null;
  return React.createElement(PillCell, {
    key: keyId,
    label,
    tone,
    color,
    evidence: evidence || provision?.full_text,
    source: provision?.sourceCard,
  });
}

function taggedLabel(item) {
  return (item && (item.label || item.standard_label || item.code || item.standard || item.name)) || null;
}

function taggedEvidence(item, provision) {
  const quotes = item && item.quotes;
  return (Array.isArray(quotes) ? quotes[0] : quotes) || provision?.full_text;
}

// Bring-down ladder: each rep-accuracy tier's canonical standard mapped to a
// friendly phrase, a tone, and a stringency RANK so the tiers render in the
// order a lawyer reads a bring-down (fundamental -> capitalization -> general
// material -> MAE-qualified), not the arbitrary order they were extracted in.
const BRINGDOWN_STANDARDS = {
  ALL_RESPECTS: { label: 'True in all respects', tone: 'info', rank: 0 },
  MAT_ALL_RESPECTS: { label: 'True in all respects', tone: 'info', rank: 0 },
  DE_MINIMIS: { label: 'True except for de minimis inaccuracies', tone: 'neutral', rank: 1 },
  ALL_RESPECTS_DE_MINIMIS: { label: 'True except for de minimis inaccuracies', tone: 'neutral', rank: 1 },
  MAT_ALL_RESPECTS_DE_MINIMIS: { label: 'True except for de minimis inaccuracies', tone: 'neutral', rank: 1 },
  ALL_MATERIAL: { label: 'True in all material respects', tone: 'info', rank: 2 },
  MAT_ALL_MATERIAL: { label: 'True in all material respects', tone: 'info', rank: 2 },
  MATERIALITY_SCRAPE: { label: 'Materiality qualifiers disregarded', tone: 'warning', rank: 2.5 },
  MAT_MATERIALITY_SCRAPE: { label: 'Materiality qualifiers disregarded', tone: 'warning', rank: 2.5 },
  MAE_QUALIFIED: { label: 'True except where failure would not cause an MAE', tone: 'warning', rank: 3 },
  MAT_MAE_QUALIFIED: { label: 'True except where failure would not cause an MAE', tone: 'warning', rank: 3 },
};

const BRINGDOWN_CODES_BY_RANK = {
  0: ['ALL_RESPECTS', 'MAT_ALL_RESPECTS'],
  1: ['DE_MINIMIS', 'ALL_RESPECTS_DE_MINIMIS', 'MAT_ALL_RESPECTS_DE_MINIMIS'],
  2: ['ALL_MATERIAL', 'MAT_ALL_MATERIAL'],
  2.5: ['MATERIALITY_SCRAPE', 'MAT_MATERIALITY_SCRAPE'],
  3: ['MAE_QUALIFIED', 'MAT_MAE_QUALIFIED'],
};

function tierCode(tier) {
  return String((tier && (tier.standard || tier.code || tier.label)) || '').toUpperCase();
}

function tierMeta(tier) {
  return BRINGDOWN_STANDARDS[tierCode(tier)]
    || { label: taggedLabel(tier) || 'Bring-down standard', tone: 'info', rank: 9 };
}

function accuracyMarketSubterms(matches) {
  const byRank = new Map();
  for (const provision of matches || []) {
    for (const tier of Array.isArray(provision?.features?.bringDownTiers) ? provision.features.bringDownTiers : []) {
      for (const code of bringDownTreatmentCodes(tier)) {
        const meta = tierMeta({ standard: code });
        const key = meta.rank === 9 ? `${meta.rank}:${code}` : String(meta.rank);
        if (!byRank.has(key)) {
          byRank.set(key, {
            meta,
            rank: meta.rank,
            codes: new Set(BRINGDOWN_CODES_BY_RANK[meta.rank] || [code]),
          });
        }
        byRank.get(key).codes.add(code);
      }
    }
  }
  return [...byRank.entries()]
    .sort(([, left], [, right]) => left.rank - right.rank)
    .map(([key, { rank, meta, codes }]) => ({
      key: `bring-down-${key}`,
      label: meta.label,
      featureKeys: ['bringDownTiers'],
      kind: 'presence',
      role: 'treatment',
      presence: {
        strategy: 'list_item',
        featureKeys: ['bringDownTiers'],
        itemCodes: [...codes],
        missingState: 'absent',
      },
    }));
}

const CONDITION_DEAL_VALUE_NORMALISATION = {
  type: 'percent_of_deal_value',
  denominator: 'deal_value_usd',
  basisPolicy: 'stratify_by_basis',
  missingPolicy: 'exclude',
};

function conditionTermSubterm(key, label, featureKeys, conditionFamily) {
  return {
    key,
    label,
    featureKeys,
    kind: 'categorical',
    value: {
      strategy: 'feature_value',
      featureKeys,
      normalizer: 'condition_term',
      conditionFamily,
    },
  };
}

function conditionMarketSubterms(family, matches) {
  let subterms = [];
  if (family === 'REP') return accuracyMarketSubterms(matches);
  if (family === 'COV') {
    subterms = [conditionTermSubterm(
      'compliance-standard',
      'Compliance standard',
      ['covenantComplianceStandard'],
      'COV',
    )];
  } else if (family === 'REG') {
    subterms = [
      {
        key: 'required-approvals',
        label: 'Required approvals',
        featureKeys: ['antitrustApprovals'],
        kind: 'multi_select',
      },
      {
        key: 'hsr-condition',
        label: 'HSR clearance condition',
        featureKeys: ['hsrClearance'],
        kind: 'categorical',
      },
    ];
  } else if (family === 'STOCKHOLDER') {
    subterms = [
      conditionTermSubterm('approval-standard', 'Approval standard', ['approvalDefinition'], 'STOCKHOLDER_STANDARD'),
      conditionTermSubterm('approval-scope', 'Approvals required', ['mainCondition'], 'STOCKHOLDER_SCOPE'),
    ];
  } else if (family === 'LEGAL') {
    subterms = [
      conditionTermSubterm('restraint-type', 'Legal-restraint formulation', ['absenceOfEnjoiningOrderDetails'], 'LEGAL'),
      {
        key: 'restraint-condition',
        label: 'Absence of restraint required',
        featureKeys: ['absenceOfEnjoiningOrderPresent'],
        kind: 'categorical',
      },
      {
        key: 'government-proceeding',
        label: 'Government proceeding condition',
        featureKeys: ['governmentProceedingConditionPresent'],
        kind: 'categorical',
      },
      {
        key: 'burdensome-condition',
        label: 'Burdensome condition',
        featureKeys: ['burdensomeConditionPresent'],
        kind: 'categorical',
      },
      conditionTermSubterm('burdensome-scope', 'Burdensome-condition scope', ['burdensomeConditionScope'], 'LEGAL'),
    ];
  } else if (family === 'MAE') {
    subterms = [
      {
        key: 'continuing',
        label: 'MAE must be continuing at closing',
        featureKeys: ['continuingRequirement'],
        kind: 'categorical',
      },
      {
        key: 'standalone',
        label: 'Standalone MAE condition',
        featureKeys: ['maeConditionStandalone'],
        kind: 'categorical',
      },
    ];
  } else if (family === 'CERT') {
    subterms = [
      conditionTermSubterm('certificate-scope', 'Certificate scope', ['mainCondition'], 'CERT'),
      {
        key: 'certificate-required',
        label: "Officer's certificate required",
        featureKeys: ['certificationRequired'],
        kind: 'categorical',
      },
    ];
  } else if (family === 'S4') {
    subterms = [{
      key: 's4-components',
      label: 'S-4 condition components',
      featureKeys: ['s4ConditionComponents'],
      kind: 'multi_select',
    }];
  } else if (family === 'LISTING') {
    subterms = [conditionTermSubterm('listing-venue', 'Listing venue', ['listingVenue'], 'LISTING')];
  } else if (family === 'DISSENT') {
    subterms = [{
      key: 'dissent-threshold',
      label: 'Dissenting-shares threshold',
      featureKeys: ['dissentingSharesThreshold'],
      kind: 'numeric',
      semantics: { unit: 'percent' },
    }];
  } else if (family === 'FUNDS') {
    subterms = [
      {
        key: 'funds-condition',
        label: 'Funds availability condition',
        featureKeys: ['fundsCondition'],
        kind: 'categorical',
      },
      conditionTermSubterm('funds-formulation', 'Funds condition formulation', ['mainCondition'], 'FUNDS'),
    ];
  } else if (family === 'FRUSTRATE') {
    subterms = [
      conditionTermSubterm('causation-standard', 'Causation standard', ['frustrationCausationStandard'], 'FRUSTRATE'),
      conditionTermSubterm('breach-standard', 'Breach standard', ['frustrationBreachStandard'], 'FRUSTRATE'),
    ];
  }

  if (firstDefined(matches, 'dollarThreshold') !== undefined) {
    subterms.push({
      key: 'dollar-threshold',
      label: 'Dollar threshold',
      featureKeys: ['dollarThreshold'],
      kind: 'money',
      semantics: {
        unit: 'usd',
        cadence: 'one_time',
        normalisation: CONDITION_DEAL_VALUE_NORMALISATION,
      },
    });
  }
  return subterms;
}

// The officer's-certificate row certifies the OTHER substantive conditions in
// its own band, so it lists them by name instead of a bare "certification
// required" boolean.
const CERT_CERTIFIES = {
  REP: 'Reps bring-down',
  COV: 'Covenant performance',
  MAE: 'No MAE',
};

// Builds a { "3.02(a)": "Capitalization; Subsidiaries", ... } lookup from the
// condition card's citedProvisionNames so the bring-down's reps_covered
// section cites resolve to rep names (ported from the legacy renderer).
function repNameBySection(matches) {
  const map = {};
  for (const provision of matches || []) {
    const ownSection = sectionNumberForCard(provision);
    if (ownSection && labelOf(provision)) map[ownSection] = labelOf(provision);
    const cited = provision?.features?.citedProvisionNames;
    if (Array.isArray(cited)) {
      for (const item of cited) {
        if (item && item.section && item.name) map[String(item.section)] = item.name;
      }
    }
  }
  return map;
}

function sectionNumberForCard(card) {
  const fromFeatures = cardFeatures(card).sectionNumber || card?.section_number;
  if (fromFeatures) return String(fromFeatures).trim();
  const sectionRef = String(card?.section_ref || '');
  const match = sectionRef.match(/\d+(?:\.\d+)+(?:\([a-z0-9]+\))*/i);
  return match ? match[0] : null;
}

function repTypeForBringDownCondition(code) {
  if (code === 'COND-B-REP') return 'REP-T';
  if (code === 'COND-S-REP') return 'REP-B';
  return null;
}

function isCatchAllBringDownTier(covered) {
  return /^all\s+(?:company\s+|parent\s+)?representations/i.test(covered)
    || /\ball\s+other\b/i.test(covered)
    || /representations?\s+(?:and\s+warranties\s+)?other than/i.test(covered);
}

// Resolve a "3.05(a)(i)(x)"-style section key to its rep name via PREFIX
// matching. nameBySec (built from citedProvisionNames) doesn't always carry
// the exact sub-clause key the bring-down text cites -- real Metsera data has
// "3.05(a)" cited (-> "No Conflict; Required Filings and Consents") but never
// the deeper "3.05(a)(i)(x)" the reps_covered sentence names -- so trailing
// sub-clause parens are stripped one group at a time ("(a)(i)(x)" ->
// "(a)(i)" -> "(a)" -> none) until a nameBySec hit is found. Returns null
// (never the bare section string) when nothing resolves.
function resolveSectionName(base, subs, nameBySec) {
  const groups = subs ? (subs.match(/\([a-z0-9]+\)/gi) || []) : [];
  for (let i = groups.length; i >= 0; i -= 1) {
    const key = `${base}${groups.slice(0, i).join('')}`;
    if (nameBySec[key]) return nameBySec[key];
  }
  return null;
}

// Replace "Section 3.02(a)" cites in a reps_covered description with the
// resolved rep names, preserving free-text qualifiers. Ported from the
// legacy resolveRepsCoveredText and extended (AC #10) so a "Section 3.02(b)
// through Section 3.02(e)" range collapses to the single resolved NAME
// (never a bare "3.02(b) through (e)" section-number chip), and every
// remaining cite falls through resolveSectionName's prefix matching so a
// sub-clause the extractor cited deeper than nameBySec knows about (e.g.
// "3.05(a)(i)(x)") still resolves to a name instead of leaking as text.
function resolveRepsCovered(text, nameBySec) {
  let s = String(text || '');
  if (!s) return s;
  s = s.replace(
    /Section\s+(\d+(?:\.\d+)*)((?:\([a-z0-9]+\))+)\s+through\s+Section\s+\1((?:\([a-z0-9]+\))+)/gi,
    (all, base, from) => resolveSectionName(base, from, nameBySec) || `${base}${from}`,
  );
  return s.replace(/Section\s+(\d+(?:\.\d+)*)((?:\([a-z0-9]+\))*)/gi, (all, base, subs) => (
    resolveSectionName(base, subs, nameBySec) || all
  ));
}

// Some covenant-compliance condition cards (e.g. the buyer-covenant COND-S-COV)
// carry no covenantComplianceStandard claim, only the clause text. Sniff the
// standard from the clause so the row isn't blank (legacy parity).
function covenantStandardFromText(mc) {
  const t = String(mc || '').toLowerCase();
  if (/in all material respects/.test(t)) return 'In all material respects';
  if (/in all respects/.test(t)) return 'In all respects';
  return null;
}

// Reorders adapter labels like "All In Material Respects" into natural
// "In all material respects" (Ben's read).
function prettyMaterialityLabel(s) {
  const str = String(s || '');
  return str
    .replace(/^all in (.+?) respects$/i, (m, mid) => `In all ${mid.toLowerCase()} respects`)
    .replace(/^all in respects$/i, 'In all respects');
}

// Splits a resolved reps_covered description into one chip per rep, depth- and
// range-aware so "Capitalization; Subsidiaries" stays whole and "3.02(b)
// through (e)" isn't split. Ported from the legacy splitBringdownCoveredPills.
function splitBringdownCoveredPills(group) {
  const text = String(group || '').trim();
  if (!text) return [];
  const parts = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    const commaBreak = depth === 0 && ch === ',';
    const andBreak = depth === 0 && /^\s+and\s+/i.test(text.slice(i)) && !/\bthrough\s*$/i.test(cur);
    if (commaBreak || andBreak) {
      const clean = cur.trim();
      if (clean) parts.push(clean);
      if (andBreak) i += text.slice(i).match(/^\s+and\s+/i)[0].length - 1;
      cur = '';
      continue;
    }
    cur += ch;
  }
  const clean = cur.trim().replace(/^and\s+/i, '');
  if (clean) parts.push(clean);
  return parts.length ? parts : [text];
}

// Short bring-down labels for the per-rep pill on the Representations table
// (Ben round 6: "Bringdown: MAE"), keyed by tierMeta rank. The Reps table's
// per-rep linkedBringDownStandard claim is a uniform MAE mis-stamp on Metsera;
// the AUTHORITATIVE per-rep standard is this closing-condition tiering, so the
// Reps pill derives from here to stay consistent with the Conditions section.
const SHORT_BRINGDOWN_BY_RANK = { 0: 'In all respects', 1: 'De minimis', 2: 'In all material respects', 3: 'MAE' };
function normRepName(name) {
  return String(name || '')
    .split(/\s+[—–-]\s+/)[0]
    .toLowerCase()
    .replace(/[.;,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
// Map<normalized rep name, { short, rank, colorKey }> built from the accuracy-
// of-reps closing-condition bringDownTiers. The MAE "all others" catch-all tier
// is intentionally NOT mapped -- any rep absent from the map defaults to MAE.
function buildRepBringDownMap(reviewDeal) {
  const cards = reviewDeal?.cards || [];
  const carriers = cards
    .map((card) => {
      const recovered = recoverBringDownFromCard(card);
      const repType = repTypeForBringDownCondition(recovered.provisionCode);
      return recovered.tiers.length && repType
        ? { card, recovered, repType }
        : null;
    })
    .filter(Boolean);
  const map = new Map();
  map.catchAllByRepType = new Map();
  if (!carriers.length) return map;

  const explicit = new Map();
  const catchAll = new Map();
  for (const { card, recovered, repType } of carriers) {
    // Resolve cites against the representations on the SAME side. Condition
    // citations are a useful fallback, but must never supply the other side's
    // labels when one condition was extracted more completely than the other.
    const sameSideReps = cards.filter((candidate) => String(cardCode(candidate) || '').startsWith(`${repType}-`));
    const nameBySec = repNameBySection(sameSideReps);
    for (const [section, name] of Object.entries(repNameBySection([card]))) {
      if (!nameBySec[section]) nameBySec[section] = name;
    }
    for (const tier of recovered.tiers) {
      const meta = tierMeta(tier);
      const standard = String(tier.standard || tier.standardCode || tier.standard_code || '').trim();
      if (!standard) continue;
      const covered = String(tier.reps_covered || tier.repsCovered || '').trim();
      const value = { short: SHORT_BRINGDOWN_BY_RANK[meta.rank] || meta.label, rank: meta.rank, colorKey: standardColorKey(meta.label), standard };
      if (isCatchAllBringDownTier(covered)) {
        const key = repType;
        if (!catchAll.has(key)) catchAll.set(key, []);
        catchAll.get(key).push(value);
        continue;
      }
      if (!covered) continue;
      for (const part of splitBringdownCoveredPills(covered).map((token) => resolveRepsCovered(token, nameBySec))) {
        const key = normRepName(part);
        if (!key) continue;
        const candidateKey = `${repType}:${key}`;
        if (!explicit.has(candidateKey)) explicit.set(candidateKey, []);
        explicit.get(candidateKey).push(value);
      }
    }
  }

  for (const [candidateKey, values] of explicit) {
    const standards = new Set(values.map((value) => value.standard));
    if (standards.size === 1) map.set(candidateKey, values[0]);
  }
  for (const [repType, values] of catchAll) {
    const standards = new Set(values.map((value) => value.standard));
    if (standards.size === 1) map.catchAllByRepType.set(repType, values[0]);
  }
  return map;
}

function hasRecoverableBringDownContext(reviewDeal) {
  return (reviewDeal?.cards || []).some((card) => recoverBringDownFromCard(card).tiers.length > 0);
}

// Rep bring-down rendered as Ben's grouped structure: each standard is a
// sub-heading ordered lowest-materiality-first (de minimis -> material -> MAE
// "all others" last), with the reps brought down to that standard rendered as
// individual chips underneath.
function bringDownNode(matches, PillCell) {
  const tiers = (matches || []).flatMap((provision) => (
    Array.isArray(provision?.features?.bringDownTiers)
      ? provision.features.bringDownTiers.map((tier) => ({ tier, meta: tierMeta(tier) }))
      : []
  ));
  if (!tiers.length) return null;
  const nameBySec = repNameBySection(matches);
  const sorted = tiers.slice().sort((a, b) => a.meta.rank - b.meta.rank);
  return React.createElement(
    'div',
    { className: 'space-y-2' },
    sorted.map(({ tier, meta }, index) => {
      const covered = String(tier.reps_covered || tier.repsCovered || '').trim();
      const general = /^all\s+(?:company\s+|parent\s+)?representations/i.test(covered)
        || /\ball\s+other\b/i.test(covered)
        || /representations?\s+(?:and\s+warranties\s+)?other than/i.test(covered);
      // Split the RAW section-cite text into tokens first, THEN resolve each
      // token to a name -- never the other way round. A resolved rep name can
      // itself contain the word "and" (e.g. "No Conflict; Required Filings
      // and Consents"), which the depth-aware splitter would otherwise mistake
      // for a list separator and cut the name in half.
      const parts = general
        ? ['All other representations']
        : (covered ? splitBringdownCoveredPills(covered).map((part) => resolveRepsCovered(part, nameBySec)) : ['Specified representations']);
      const colorKey = standardColorKey(meta.label);
      const repsNode = PillCell
        ? React.createElement(
            'div',
            { className: 'flex flex-wrap gap-1' },
            parts.map((part, partIndex) => React.createElement(PillCell, { key: partIndex, label: part, tone: 'neutral', color: colorKey })),
          )
        : React.createElement('div', { className: 'max-w-[42rem] text-[11px] leading-5 text-inkLight' }, parts.join(', '));
      return React.createElement(
        'div',
        { key: `bd-${index}`, className: 'space-y-1' },
        React.createElement('div', { className: `text-[11px] font-semibold uppercase tracking-wide ${(colorKey && STANDARD_TEXT[colorKey]) || 'text-inkFaint'}` }, meta.label),
        repsNode,
        bringDownTreatmentCodes(tier).includes('MAT_MATERIALITY_SCRAPE')
          ? React.createElement('div', { className: 'text-[10px] font-medium text-amber-700' }, 'Materiality qualifiers disregarded')
          : null,
      );
    }),
  );
}

// Synthesizes the actual stockholder-vote standard from the approval
// definition, so the chip reads "Majority of outstanding shares" (the thing
// that matters) rather than a generic "Approval required" boolean. The
// synthesizer itself now lives in ./vote-standard.js (shared with
// votes-approvals-meeting + termination-rights).

// Small, always-collapsed "see text" affordance for the AI's synthesized
// mainCondition sentence. Distinct from TruncatedWithSeeText: that helper
// renders short strings inline once under its length cap, which mainCondition
// sentences (~80-150 chars) frequently clear -- inlining exactly the raw
// clause summary the spec says must never be inline-dumped. This always
// collapses, regardless of length, and is opened by user action only.
function clauseSeeText(text) {
  if (!text) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      text,
    ),
  );
}

// Defined-term synthesis: short synthesized portion inline, full text
// collapsed behind click-to-open. Reuses the same word-boundary truncation
// TruncatedWithSeeText is built on (splitForCell) so short definitions still
// render fully inline without a pointless empty expander.
function definitionNode(text) {
  const { value, short, truncated } = splitForCell(text, 90);
  if (!value) return null;
  if (!truncated) return React.createElement('span', { className: 'text-[11px] text-ink' }, value);
  return React.createElement(
    'span',
    null,
    // E (truncation sweep): drop the literal "…" -- the details/"See
    // provision" affordance right below is the tail-hiding mechanism.
    React.createElement('span', { className: 'text-[11px] text-ink' }, short),
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        value,
      ),
    ),
  );
}

function definedTermsNode(matches) {
  const nodes = [];
  const approvalDefinition = firstDefined(matches, 'approvalDefinition');
  if (approvalDefinition) {
    nodes.push(React.createElement(
      'div',
      { key: 'approval-definition', className: 'text-[11px] text-inkLight' },
      React.createElement('span', { className: 'mr-1 text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, 'Defined term:'),
      definitionNode(String(approvalDefinition)),
    ));
  }

  const citedRaw = (matches || []).flatMap((provision) => (
    Array.isArray(provision?.features?.citedProvisionNames) ? provision.features.citedProvisionNames : []
  ));
  if (citedRaw.length) {
    const seen = new Set();
    const items = citedRaw.filter((item) => {
      const key = `${item?.name || ''}|${item?.section || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const preview = items.slice(0, 2).map((item) => item.name).filter(Boolean).join(', ');
    const shortLabel = items.length > 2 ? `${preview} +${items.length - 2} more` : preview;
    nodes.push(React.createElement(
      'div',
      { key: 'cited-provisions', className: 'text-[11px] text-inkLight' },
      React.createElement('span', { className: 'mr-1 text-[10px] font-medium uppercase tracking-wider text-inkFaint' }, `Reps covered (${items.length}):`),
      React.createElement('span', null, shortLabel || 'See list'),
      React.createElement(
        'details',
        { className: 'mt-1' },
        React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
        React.createElement(
          'ul',
          { className: 'mt-1 max-w-[36rem] list-disc pl-4 text-[11px] leading-5 text-inkLight' },
          items.map((item, index) => React.createElement(
            'li',
            { key: index },
            `${item.name || 'Unnamed'}${item.section ? ` (§${item.section})` : ''}`,
          )),
        ),
      ),
    ));
  }

  if (!nodes.length) return null;
  return React.createElement('div', { className: 'space-y-1' }, nodes);
}

// Generic fallback for canonical families with no bespoke synthesis wired up
// (S4 / LISTING / DISSENT / FUNDS today -- no matched Metsera data existed
// to design against). Surfaces whatever short structured fields exist
// instead of silently showing nothing.
const GENERIC_FIELDS = [
  ['curePeriod', 'Cure period'],
  ['cureDays', 'Cure period'],
  ['scheduleReference', 'Schedule reference'],
];

// Item 3 (r6): a closing condition's dollarThreshold is a monetary TRIGGER
// (the figure that activates the condition), not a monetary EXCEPTION -- it
// gets the shared triggerThresholdLabel() ("Trigger: $X") rather than this
// generic loop's own "Threshold: $X" wording, so it reads identically to
// every other config's trigger-amount pill (ioc-exceptions.config.js).
// r13 (featureKey threading): also returns which registry attribute(s) fed
// the chips actually pushed, so buildStandardDetail can thread featureKeys
// ONLY when exactly one field fired -- a generic S4/LISTING/DISSENT/FUNDS
// row is genuinely single-attribute most of the time (e.g. just cureDays),
// but the loop CAN combine dollarThreshold + cureDays + scheduleReference on
// the same row, and a multi-field row has no single comparable feature to
// send the sidebar.
function genericChips(PillCell, matches, primary) {
  const chips = [];
  const keys = [];
  const dollarRaw = firstDefined(matches, 'dollarThreshold');
  const dollarText = dollarRaw === undefined ? null : valueText(dollarRaw);
  if (dollarText) {
    chips.push(mkChip(PillCell, 'generic-dollarThreshold', triggerThresholdLabel(dollarText), 'neutral', primary));
    keys.push('dollarThreshold');
  }
  for (const [key, label] of GENERIC_FIELDS) {
    const raw = firstDefined(matches, key);
    if (raw === undefined) continue;
    const text = valueText(raw);
    if (!text) continue;
    chips.push(mkChip(PillCell, `generic-${key}`, `${label}: ${text}`, 'neutral', primary));
    keys.push(key);
  }
  return { chips, keys };
}

// Standard/Detail column synthesis, keyed by canonical family. `bandFamilies`
// is the list of substantive families present in this row's band, used by the
// officer's-certificate row to name what it certifies.
function buildStandardDetail(row, family, ctx, bandFamilies) {
  const PillCell = ctx?.primitives?.PillCell;
  const matches = row.matches || [];
  const primary = matches[0];
  const chips = [];
  let mainNode = null;
  // r13 (featureKey threading parity): the registry attribute(s) that
  // actually define THIS row's rendered value -- threaded onto the row so
  // ClauseSidebar can request a real corpus distribution instead of the
  // quieter "doesn't map to a single comparable feature" state. Only set
  // when the row's value traces to one attribute; families whose value is
  // synthesized from several fields at once (REG's multi-approval list,
  // CERT's cross-referenced bandFamilies pills) get none -- see per-branch
  // comments below.
  let featureKeys = null;
  let marketSubterms = null;

  if (family === 'REP') {
    // Rep bring-down: grouped by standard, lowest-materiality-first, reps under
    // each as chips (see bringDownNode). Covenant-compliance falls to a chip.
    mainNode = bringDownNode(matches, PillCell);
    if (mainNode) {
      featureKeys = ['bringDownTiers'];
      marketSubterms = accuracyMarketSubterms(matches);
    } else {
      const ccs = firstDefined(matches, 'covenantComplianceStandard');
      if (ccs) {
        chips.push(mkChip(PillCell, 'covenant-standard', prettyMaterialityLabel(taggedLabel(ccs) || valueText(ccs)), 'info', primary, taggedEvidence(ccs, primary), standardColorKey(taggedLabel(ccs) || valueText(ccs))));
        featureKeys = ['covenantComplianceStandard'];
      }
    }
  } else if (family === 'COV') {
    const ccs = firstDefined(matches, 'covenantComplianceStandard');
    if (ccs) {
      chips.push(mkChip(PillCell, 'covenant-standard', prettyMaterialityLabel(taggedLabel(ccs) || valueText(ccs)), 'info', primary, taggedEvidence(ccs, primary), standardColorKey(taggedLabel(ccs) || valueText(ccs))));
      featureKeys = ['covenantComplianceStandard'];
    } else {
      // Sniffed from mainCondition prose, not a registry attribute of its
      // own -- no clean feature to compare against the peer set.
      const sniffed = covenantStandardFromText(firstDefined(matches, 'mainCondition'));
      if (sniffed) chips.push(mkChip(PillCell, 'covenant-standard-sniff', sniffed, 'info', primary, firstDefined(matches, 'mainCondition'), standardColorKey(sniffed)));
    }
  } else if (family === 'REG') {
    // Antitrust: HSR plus the SCHEDULED_APPROVALS the agreement lists in a
    // schedule (surfaced with its section reference), not a vague catch-all.
    const approvals = matches.flatMap((provision) => (
      Array.isArray(provision?.features?.antitrustApprovals)
        ? provision.features.antitrustApprovals.map((approval) => ({ approval, provision }))
        : []
    ));
    const sectionRef = firstDefined(matches, 'sectionNumber');
    if (approvals.length) {
      // Multiple approvals compound into one list -- not a single comparable
      // value (and antitrustApprovals' own distribution wouldn't read as
      // "this row's value" the way a scalar attribute's does).
      approvals.forEach(({ approval, provision }, index) => {
        const code = String((approval && (approval.code || approval.standard || approval.label)) || '').toUpperCase();
        let label = taggedLabel(approval) || valueText(approval);
        if (code.includes('HSR')) label = 'HSR waiting period expired or terminated';
        else if (code.includes('SCHEDUL')) label = sectionRef ? `Scheduled regulatory approvals (§${sectionRef})` : 'Scheduled regulatory approvals';
        chips.push(mkChip(PillCell, `approval-${index}`, label, 'present', provision, taggedEvidence(approval, provision)));
      });
    } else {
      const hsr = firstDefined(matches, 'hsrClearance');
      if (typeof hsr === 'boolean') {
        chips.push(mkChip(PillCell, 'hsr-clearance', hsr ? 'HSR waiting period expired or terminated' : 'No HSR clearance condition', hsr ? 'present' : 'missing', primary));
        featureKeys = ['hsrClearance'];
      }
    }
  } else if (family === 'STOCKHOLDER') {
    // Show the actual vote standard ("Majority of outstanding shares"), not a
    // generic "Approval required"; the full definition stays in the collapse.
    const def = firstDefined(matches, 'approvalDefinition');
    const std = voteStandard(def);
    if (std) {
      chips.push(mkChip(PillCell, 'vote-std', std, 'present', primary, def ? String(def) : undefined));
      featureKeys = ['approvalDefinition'];
    } else if (firstDefined(matches, 'stockholderApprovalRequired') === true) {
      chips.push(mkChip(PillCell, 'vote-req', 'Stockholder approval required', 'present', primary));
      featureKeys = ['stockholderApprovalRequired'];
    }
  } else if (family === 'LEGAL') {
    const present = firstDefined(matches, 'absenceOfEnjoiningOrderPresent');
    if (typeof present === 'boolean') {
      const details = firstDefined(matches, 'absenceOfEnjoiningOrderDetails');
      chips.push(mkChip(PillCell, 'legal-restraint', present ? 'No legal restraint' : 'No legal restraint (absent)', present ? 'present' : 'missing', primary, details));
      featureKeys = ['absenceOfEnjoiningOrderPresent'];
    }
    if (firstDefined(matches, 'governmentProceedingConditionPresent') === true) {
      chips.push(mkChip(PillCell, 'government-proceeding', 'No blocking governmental proceeding', 'present', primary));
      featureKeys = null;
    }
    if (firstDefined(matches, 'burdensomeConditionPresent') === true) {
      const scope = valueText(firstDefined(matches, 'burdensomeConditionScope'));
      chips.push(mkChip(PillCell, 'burdensome-condition', scope ? `Burdensome condition: ${scope}` : 'Burdensome condition limitation', 'warning', primary));
      featureKeys = null;
    }
  } else if (family === 'MAE') {
    // The condition name ("No Material Adverse Effect") is already the TERM
    // column, so the right column only carries the continuing-effect qualifier.
    const continuing = isTruthyBoolLike(firstDefined(matches, 'continuingRequirement'));
    chips.push(mkChip(
      PillCell,
      'mae-continuing',
      continuing ? 'MAE must be continuing at closing' : 'Continuing requirement not specified',
      continuing ? 'warning' : 'neutral',
      primary,
      firstDefined(matches, 'mainCondition'),
    ));
    featureKeys = ['continuingRequirement'];
  } else if (family === 'CERT') {
    // One pill per condition the officer's certificate certifies (the other
    // substantive families present in this same band) -- derived from
    // bandFamilies, not a single registry attribute, so no featureKeys there.
    const uniq = [...new Set((bandFamilies || []).filter((f) => CERT_CERTIFIES[f]).map((f) => CERT_CERTIFIES[f]))];
    if (uniq.length) {
      uniq.forEach((label, index) => chips.push(mkChip(PillCell, `cert-${index}`, label, 'present', primary, firstDefined(matches, 'mainCondition'))));
    } else if (firstDefined(matches, 'certificationRequired') === true) {
      chips.push(mkChip(PillCell, 'cert-req', "Officer's certificate required", 'present', primary));
      featureKeys = ['certificationRequired'];
    }
  } else if (family === 'S4') {
    const components = [].concat(firstDefined(matches, 's4ConditionComponents') || []);
    if (components.length) {
      components.forEach((component, index) => chips.push(mkChip(
        PillCell, `s4-component-${index}`, valueText(component), 'present', primary,
      )));
      featureKeys = ['s4ConditionComponents'];
    } else {
      const generic = genericChips(PillCell, matches, primary);
      chips.push(...generic.chips);
      if (generic.keys.length === 1) featureKeys = [generic.keys[0]];
    }
  } else if (family === 'LISTING') {
    const venue = valueText(firstDefined(matches, 'listingVenue'));
    if (venue) {
      chips.push(mkChip(PillCell, 'listing-venue', `Listing: ${venue}`, 'present', primary));
      featureKeys = ['listingVenue'];
    } else {
      const generic = genericChips(PillCell, matches, primary);
      chips.push(...generic.chips);
      if (generic.keys.length === 1) featureKeys = [generic.keys[0]];
    }
  } else if (family === 'FUNDS') {
    if (firstDefined(matches, 'fundsCondition') === true) {
      chips.push(mkChip(PillCell, 'funds-condition', 'Funds availability required', 'present', primary));
      featureKeys = ['fundsCondition'];
    }
    const generic = genericChips(PillCell, matches, primary);
    chips.push(...generic.chips);
    if (generic.keys.length === 1 && !featureKeys) featureKeys = [generic.keys[0]];
    else if (generic.keys.length) featureKeys = null;
  } else if (family === 'FRUSTRATE') {
    const causation = valueText(firstDefined(matches, 'frustrationCausationStandard'));
    const breach = valueText(firstDefined(matches, 'frustrationBreachStandard'));
    if (causation) chips.push(mkChip(PillCell, 'frustration-causation', causation, 'warning', primary));
    if (breach) chips.push(mkChip(PillCell, 'frustration-breach', breach, 'warning', primary));
    if (causation && !breach) featureKeys = ['frustrationCausationStandard'];
    if (breach && !causation) featureKeys = ['frustrationBreachStandard'];
  } else {
    // DISSENT and other legacy-only fields: thread the one
    // field this row's chips came from ONLY when exactly one fired -- e.g. a
    // cureDays-only row is genuinely 1:1, but a row combining
    // dollarThreshold + cureDays has no single comparable feature.
    const generic = genericChips(PillCell, matches, primary);
    chips.push(...generic.chips);
    if (generic.keys.length === 1) featureKeys = [generic.keys[0]];
  }

  if (!marketSubterms) marketSubterms = conditionMarketSubterms(family, matches);

  // AC #9: the "see text" affordance follows ONE rule for every family/band --
  // present iff this row has clause text (mainCondition, falling back to
  // mainConcept/raw quote text in cardToProvision), absent otherwise. This is
  // computed once, here, AFTER all family branches above (never inside one of
  // them), so no family can special-case its way into a different rule.
  // Item 8 (round 3): the clause expander used to be appended INSIDE this
  // node (the row's value/right cell); it now renders separately, under the
  // row's LABEL (left) cell via GroupedSubRows' row.seeText, matching every
  // other family -- so this returns { node, seeText } instead of one node.
  const validChips = chips.filter(Boolean);
  const mainConditionText = valueText(firstDefined(matches, 'mainCondition'));

  const node = React.createElement(
    'div',
    { className: 'space-y-1.5' },
    validChips.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, validChips) : null,
    mainNode,
  );
  // Item 2 (r5): the row's own card/quote -- matches[0] is the provision
  // this row's chips/text were built FROM (see mkChip's provision?.sourceCard
  // above), so it's the correct clicked-through card for THIS row, not the
  // whole Closing Conditions section.
  // Item 2 (r6): seeTextContent is raw text -- GroupedSubRows renders the
  // full-width expansion itself now, rather than receiving a pre-built
  // <details> node (clauseSeeText stays defined/used elsewhere in this file
  // for the smaller nested Defined-term / Reps-covered expanders, which are
  // not the row-level "whole column squeezed" defect this fixes).
  return {
    node,
    seeTextContent: mainConditionText,
    card: primary?.sourceCard || null,
    evidence: mainConditionText || primary?.full_text || null,
    featureKeys,
    marketSubterms: marketSubterms?.length ? marketSubterms : null,
  };
}

// Splits each party band's full canonical row list (present + absent, as
// createConditionsConfig already computes it) into rows that actually have
// a matching card (rendered inline, synthesized) vs rows with none --
// including canonical rows the old config force-rendered via alwaysRender
// with placeholder "Not found" copy. Absence now lives in the coverage
// footer only, never as an inline row.
function conditionGroups(reviewDeal, ctx) {
  return GROUP_SPECS.map((spec) => {
    const rawRows = spec.config.selectRows(reviewDeal) || [];
    const allRows = rawRows.map((row) => ({
      ...row,
      matches: (row.matches || []).filter((provision) => bandAligned(provision, spec.party)),
    }));
    const presentRows = allRows.filter((row) => (row.matches || []).length > 0);
    const withFamily = presentRows.map((row) => {
      const code = row.matches?.[0]?.features?.canonicalCode || null;
      return { row, code, family: deriveFamily(row, code) };
    });
    const bandFamilies = withFamily.map((x) => x.family).filter(Boolean);
    const rows = withFamily.map(({ row, code, family }) => {
      const detail = buildStandardDetail(row, family, ctx, bandFamilies);
      return {
        id: row.id,
        label: conditionLabelNode(row, code, family),
        children: detail.node,
        // Item 2 (r6): raw expansion text (not a pre-rendered <details>
        // node) -- GroupedSubRows renders this in its own full-width block
        // below the row instead of squeezed inline into the label cell (see
        // GroupedSubRows in ProvisionTablePrimitives.jsx).
        seeTextContent: detail.seeTextContent,
        // Item 2 (r5): wires each condition row to its own backing card --
        // see GroupedSubRows in ProvisionTablePrimitives.jsx.
        card: detail.card,
        evidence: detail.evidence,
        // r13: see buildStandardDetail's featureKeys comment -- null for
        // families whose row value is synthesized from more than one field.
        featureKeys: detail.featureKeys,
        marketSubterms: detail.marketSubterms,
        marketProvisionCodes: code ? [code] : undefined,
      };
    });
    return { id: spec.id, label: spec.label, rows, allRows, presentRows };
  });
}

function renderConditionsFooter(rows, ctx) {
  const CoverageFooter = ctx?.primitives?.CoverageFooter;
  const reviewDeal = rows && rows[0] && rows[0].reviewDeal;
  if (!CoverageFooter || !reviewDeal) return null;
  const groups = conditionGroups(reviewDeal, ctx);
  const presentCount = groups.reduce((sum, group) => sum + group.presentRows.length, 0);
  const totalCount = groups.reduce((sum, group) => sum + group.allRows.length, 0);
  const absentItems = groups.flatMap((group) => (
    group.allRows
      .filter((row) => (row.matches || []).length === 0)
      .map((row) => ({ id: `${group.id}-${row.id}`, label: `${group.label}: ${row.label}` }))
  ));
  return React.createElement(CoverageFooter, {
    presentCount,
    totalCount,
    absentItems,
    label: 'standard conditions present',
  });
}

const conditionsConfig = {
  id: 'conditions',
  title: 'Closing Conditions',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    // Row-shape independent of ctx (primitives) so hasRows checks in
    // pages/review/[id].js (which call selectRows without ctx) still work;
    // the actual grouped body is rebuilt with primitives at render time via
    // the 'body' column below.
    const hasAny = GROUP_SPECS.some((spec) => (spec.config.selectRows(reviewDeal) || []).length > 0);
    if (!hasAny) return [];
    return [{ id: 'conditions-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const groups = conditionGroups(row.reviewDeal, ctx);
        return React.createElement(GroupedSubRows, {
          groups: groups.map((group) => ({ id: group.id, label: group.label, rows: group.rows })),
          emptyCopy: CONDITION_ABSENT_COPY,
          // Item 2 (r5): same onSelectCard/resolveCard/selectedCardId wiring
          // nosol-section.config.js's buildGroups() already uses -- resolveCard
          // just needs row.card, which conditionGroups() now sets above.
          onSelectCard: ctx.onSelectCard,
          resolveCard: ctx.resolveCard,
          selectedCardId: ctx.selectedCardId,
        });
      },
    },
  ],
  // Coverage footer strip (bottom of the table, not a mid-table row): "N of
  // M standard conditions present" plus the absent ones, greyed. Reuses the
  // generic CoverageFooter primitive so IOC / Material-Contracts can adopt
  // the same renderFooter hook later.
  renderFooter: renderConditionsFooter,
};

export { CONDITION_FAMILY_LABELS, buildRepBringDownMap, conditionGroups, conditionsConfig, deriveFamily, hasRecoverableBringDownContext, normRepName };
