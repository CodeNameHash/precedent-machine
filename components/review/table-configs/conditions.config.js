import React from 'react';
import { conditionsBConfig, conditionsMConfig, conditionsSConfig } from './conditions-m.config.js';
import { splitForCell, valueText } from './card-utils.js';

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
  { id: 'mutual', label: 'Mutual', config: conditionsMConfig, party: 'M' },
  { id: 'buyer', label: "Buyer's", config: conditionsBConfig, party: 'B' },
  { id: 'seller', label: "Seller's", config: conditionsSConfig, party: 'S' },
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

function mkChip(PillCell, keyId, label, tone, provision, evidence) {
  if (!PillCell || !label) return null;
  return React.createElement(PillCell, {
    key: keyId,
    label,
    tone,
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

function tierTone(standard) {
  const code = String(standard || '').toUpperCase();
  if (code.includes('MAE')) return 'warning';
  if (code.includes('DE_MINIMIS')) return 'neutral';
  return 'info';
}

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
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see text'),
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
    React.createElement('span', { className: 'text-[11px] text-ink' }, `${short}…`),
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see definition'),
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
        React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see full list'),
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
  ['dollarThreshold', 'Threshold'],
  ['curePeriod', 'Cure period'],
  ['cureDays', 'Cure period'],
  ['scheduleReference', 'Schedule reference'],
];

function genericChips(PillCell, matches, primary) {
  const chips = [];
  for (const [key, label] of GENERIC_FIELDS) {
    const raw = firstDefined(matches, key);
    if (raw === undefined) continue;
    const text = valueText(raw);
    if (!text) continue;
    chips.push(mkChip(PillCell, `generic-${key}`, `${label}: ${text}`, 'neutral', primary));
  }
  return chips;
}

// Standard/Detail column synthesis, keyed by canonical family. Universal
// flags (certificationRequired, continuingRequirement, maeStandaloneCondition)
// apply regardless of family since they can appear on any condition card.
function buildStandardDetail(row, family, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const matches = row.matches || [];
  const primary = matches[0];
  const chips = [];

  const certificationRequired = firstDefined(matches, 'certificationRequired');
  if (typeof certificationRequired === 'boolean') {
    chips.push(mkChip(PillCell, 'flag-cert', certificationRequired ? 'Certification required' : 'No certification required', certificationRequired ? 'present' : 'missing', primary));
  }
  const continuingRequirement = firstDefined(matches, 'continuingRequirement');
  if (typeof continuingRequirement === 'boolean') {
    chips.push(mkChip(PillCell, 'flag-continuing', continuingRequirement ? 'Must not be continuing' : 'Continuing not required', continuingRequirement ? 'warning' : 'neutral', primary));
  }
  const maeStandalone = firstDefined(matches, 'maeStandaloneCondition');
  if (isTruthyBoolLike(maeStandalone)) {
    chips.push(mkChip(PillCell, 'flag-mae-standalone', 'Standalone MAE condition', 'info', primary));
  }

  if (family === 'REP' || family === 'COV') {
    const tiers = matches.flatMap((provision) => (
      Array.isArray(provision?.features?.bringDownTiers)
        ? provision.features.bringDownTiers.map((tier) => ({ tier, provision }))
        : []
    ));
    if (tiers.length) {
      tiers.forEach(({ tier, provision }, index) => {
        const label = taggedLabel(tier) || 'Bring-down standard';
        chips.push(mkChip(PillCell, `tier-${index}`, label, tierTone(tier.standard), provision, taggedEvidence(tier, provision)));
      });
    } else {
      const ccs = firstDefined(matches, 'covenantComplianceStandard');
      if (ccs) chips.push(mkChip(PillCell, 'covenant-standard', taggedLabel(ccs) || valueText(ccs), 'info', primary, taggedEvidence(ccs, primary)));
    }
  } else if (family === 'REG') {
    const approvals = matches.flatMap((provision) => (
      Array.isArray(provision?.features?.antitrustApprovals)
        ? provision.features.antitrustApprovals.map((approval) => ({ approval, provision }))
        : []
    ));
    if (approvals.length) {
      approvals.forEach(({ approval, provision }, index) => {
        chips.push(mkChip(PillCell, `approval-${index}`, taggedLabel(approval) || valueText(approval), 'present', provision, taggedEvidence(approval, provision)));
      });
    } else {
      const regulatoryApprovals = firstDefined(matches, 'regulatoryApprovals');
      if (regulatoryApprovals) {
        chips.push(mkChip(PillCell, 'regulatory-approvals', valueText(regulatoryApprovals), 'neutral', primary));
      } else {
        const hsr = firstDefined(matches, 'hsrClearance');
        if (typeof hsr === 'boolean') {
          chips.push(mkChip(PillCell, 'hsr-clearance', hsr ? 'HSR clearance' : 'No HSR clearance condition', hsr ? 'present' : 'missing', primary));
        }
      }
    }
  } else if (family === 'STOCKHOLDER') {
    const required = firstDefined(matches, 'stockholderApprovalRequired');
    if (typeof required === 'boolean') {
      chips.push(mkChip(PillCell, 'stockholder-required', required ? 'Approval required' : 'Approval not required', required ? 'present' : 'missing', primary));
    }
  } else if (family === 'LEGAL') {
    const present = firstDefined(matches, 'absenceOfEnjoiningOrderPresent');
    if (typeof present === 'boolean') {
      const details = firstDefined(matches, 'absenceOfEnjoiningOrderDetails');
      chips.push(mkChip(PillCell, 'legal-restraint', present ? 'No legal restraint clause' : 'No legal restraint clause absent', present ? 'present' : 'missing', primary, details));
    }
  } else if (family !== 'MAE' && family !== 'CERT') {
    chips.push(...genericChips(PillCell, matches, primary));
  }

  const validChips = chips.filter(Boolean);
  const definedTerms = definedTermsNode(matches);
  const clause = clauseSeeText(valueText(firstDefined(matches, 'mainCondition')));

  return React.createElement(
    'div',
    { className: 'space-y-1' },
    validChips.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, validChips) : null,
    definedTerms,
    clause,
  );
}

function buildGroupRow(row, ctx) {
  const code = row.matches?.[0]?.features?.canonicalCode || null;
  const family = deriveFamily(row, code);
  return {
    id: row.id,
    label: conditionLabelNode(row, code, family),
    children: buildStandardDetail(row, family, ctx),
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
    const rows = presentRows.map((row) => buildGroupRow(row, ctx));
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
          emptyCopy: 'No closing conditions found.',
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

export { CONDITION_FAMILY_LABELS, conditionGroups, conditionsConfig, deriveFamily };
