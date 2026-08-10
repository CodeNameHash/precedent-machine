// Review V2 ("Mergertrace") — config decorations. The v1 table configs under
// components/review/table-configs are reused UNMODIFIED; this module clones
// the handful that need v2-specific presentation. Most swap only their
// render functions (selectRows untouched, same row data/tests/hasRows
// semantics as v1); two (structure-mechanics, consideration-hero) also wrap
// selectRows to add/drop ROWS for v2's election-card and closing-timing
// presentation — v1 keeps the original config (and original rows)
// unmodified either way, since v1 imports the base configs directly, never
// through this module.
//
//  1. Representations (Company + Parent): lookback pills ("Since Jan 30,
//     2025") get a muted approximate-period suffix measured back from the
//     deal's agreement/announce date — "(≈8 mos)" under a year, "(≈2.7 yrs)"
//     otherwise. Decorated from ROW DATA (the card's own lookbackDateISO
//     feature, falling back to parsing the "Since <date>" label), never from
//     rendered JSX. Bring-down pills that ever carry a "Since <date>" label
//     are covered by the same helper.
//  2. Material Contracts: pill placement swapped — contract type renders as
//     plain first-column text (keeping the evidence hover), the THRESHOLD
//     renders as the pill (amber for monetary amounts, neutral grey for
//     "Any"/no threshold).
//  3. Structure & Mechanics: Outside Date / Marketing Period / Ticking Fee
//     rows (deriveClosingTimingRows) are folded into the SAME table, right
//     after Closing timing — not a separate floating card (Ben, round 2).
//  4. Consideration: when the deal carries an election (ElectionCard
//     renders above this table — see pages/review/[id].js), the rows the
//     card already covers (per-share consideration, exchange ratio /
//     formula, proration & election mechanics) are dropped from the table
//     so the same economics don't appear twice (Ben, round 2).

import React from 'react';
import { PillCell, EvidenceHoverSource } from '../review/primitives/ProvisionTablePrimitives';
import { cardFeatures } from '../review/table-configs/card-utils';
import { deriveClosingTimingRows, deriveElectionSummary } from './sectionList';

/* ── approximate lookback period ─────────────────────────────────────────── */

const MONTH_INDEX = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// UTC ms for a YYYY-MM-DD string (no Date-string parsing — a UTC-midnight
// ISO date parsed in a behind-UTC timezone can roll back a day).
function isoToUtcMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// UTC ms for the "Jan 30, 2025" shape resolveLookback renders into "Since …"
// labels (fallback when a row carries no lookbackDateISO feature).
function sinceLabelToUtcMs(label) {
  const m = /Since\s+([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/.exec(String(label || ''));
  if (!m || MONTH_INDEX[m[1]] === undefined) return null;
  return Date.UTC(Number(m[3]), MONTH_INDEX[m[1]], Number(m[2]));
}

// "≈8 mos" under 12 months, "≈2.7 yrs" from there up. Null when the pair
// doesn't parse or the lookback isn't actually in the past.
export function approxPeriodLabel(fromMs, toMs) {
  if (fromMs === null || toMs === null) return null;
  const days = Math.round((toMs - fromMs) / 86400000);
  if (days <= 0) return null;
  const months = Math.round(days / 30.4375);
  if (months < 12) return months <= 1 ? '≈1 mo' : `≈${months} mos`;
  return `≈${(days / 365.25).toFixed(1)} yrs`;
}

// The card's own lookbackDateISO claim is the trustworthy signal (same
// reasoning as resolveLookback in representations-qualifiers.config.js);
// tolerate a tagged/citable wrapper just in case.
function lookbackIsoMs(card) {
  const raw = cardFeatures(card).lookbackDateISO;
  if (!raw) return null;
  if (typeof raw === 'string') return isoToUtcMs(raw);
  if (typeof raw === 'object') return isoToUtcMs(raw.value ?? raw.text ?? null);
  return null;
}

// label (string) -> label + muted suffix (React node), or the original
// string when there's nothing to append.
function withApproxSuffix(label, fromMs, agreementMs) {
  const approx = approxPeriodLabel(fromMs, agreementMs);
  if (!approx) return label;
  return React.createElement(
    React.Fragment,
    null,
    label,
    React.createElement('span', { className: 'mtx-approx' }, ` (${approx})`),
  );
}

// Clones a rep row with decorated lookback / bring-down pill labels. Only
// 'rep' rows carry lookback/bringDown; everything else passes through.
function decorateRepRow(row, agreementMs) {
  if (!row || row.kind !== 'rep' || agreementMs === null) return row;
  let next = row;
  if (row.lookback && typeof row.lookback.label === 'string') {
    const fromMs = lookbackIsoMs(row.card) ?? sinceLabelToUtcMs(row.lookback.label);
    const label = withApproxSuffix(row.lookback.label, fromMs, agreementMs);
    if (label !== row.lookback.label) next = { ...next, lookback: { ...row.lookback, label } };
  }
  // Bring-down pills read "Bringdown: MAE" today, but if one ever carries a
  // "Since <date>" the same suffix applies.
  if (row.bringDown && typeof row.bringDown.label === 'string' && /Since\s/.test(row.bringDown.label)) {
    const fromMs = sinceLabelToUtcMs(row.bringDown.label);
    const label = withApproxSuffix(row.bringDown.label, fromMs, agreementMs);
    if (label !== row.bringDown.label) next = { ...next, bringDown: { ...row.bringDown, label } };
  }
  return next;
}

// Reps configs render through config.renderBody on the live page (see
// ProvisionTable.jsx's renderBody hook), so the body wrapper is the one that
// matters; the legacy columns are decorated too so both paths agree.
function decorateRepsConfig(config, agreementMs) {
  if (agreementMs === null) return config;
  return {
    ...config,
    columns: (config.columns || []).map((column) => (
      (column.id === 'lookback' || column.id === 'term') && typeof column.renderCell === 'function'
        ? { ...column, renderCell: (row, ctx) => column.renderCell(decorateRepRow(row, agreementMs), ctx) }
        : column
    )),
    renderBody: (rows, ctx) => config.renderBody(
      (rows || []).map((row) => decorateRepRow(row, agreementMs)),
      ctx,
    ),
  };
}

/* ── Material Contracts: pill placement swap ─────────────────────────────── */

// Contract type as plain first-column text (13px medium ink comes from the
// .mtx first-column rule), keeping the evidence hover the old pill carried.
function renderContractTypeText(row) {
  const term = React.createElement(
    EvidenceHoverSource,
    { value: row.code, evidence: row.evidence, source: row.source, highlight: null, as: 'span', className: 'font-medium text-ink' },
    row.label,
  );
  const exclusionText = Array.isArray(row.scopeExclusions) && row.scopeExclusions.length
    ? `Excludes: ${row.scopeExclusions.join(', ')}`
    : null;
  if (!exclusionText) return term;
  return React.createElement(React.Fragment, null,
    React.createElement('div', null, term),
    React.createElement('div', null, exclusionText));
}

// Threshold as the pill: amber family (warning tone) for monetary amounts,
// neutral grey for "Any" / type-based triggers with no dollar floor.
function renderThresholdPill(row) {
  const label = row.threshold || 'Any';
  const monetary = /\$/.test(String(label));
  return React.createElement(PillCell, {
    label,
    tone: monetary ? 'warning' : 'neutral',
    evidence: row.evidence,
    source: row.source,
  });
}

function decorateMaterialContractsConfig(config) {
  return {
    ...config,
    // id is preserved so ProvisionTable's FULL_TEXT_COLUMNS still relocates
    // the 'evidence' column behind the first-column "see text" expander.
    columns: (config.columns || []).map((column) => {
      if (column.id === 'bucket') return { ...column, renderCell: renderContractTypeText };
      if (column.id === 'threshold') return { ...column, renderCell: renderThresholdPill };
      return column;
    }),
  };
}

/* ── Structure & Mechanics: fold in the closing-timing rows ─────────────── */

// Inserted right after 'structure-mechanics-closing-timing' (the row this
// data is most closely related to); after 'structure-mechanics-closing-
// location' if closing-timing is absent for some reason; otherwise
// prepended. Never a separate table (Ben, round 2: "belongs inside
// Structure & Mechanics ... not floating first").
function decorateStructureMechanicsConfig(config) {
  return {
    ...config,
    selectRows(reviewDeal) {
      const base = config.selectRows(reviewDeal) || [];
      const extra = deriveClosingTimingRows(reviewDeal);
      if (!extra.length) return base;
      let insertAt = base.findIndex((r) => r.id === 'structure-mechanics-closing-timing');
      if (insertAt === -1) insertAt = base.findIndex((r) => r.id === 'structure-mechanics-closing-location');
      insertAt = insertAt === -1 ? 0 : insertAt + 1;
      return [...base.slice(0, insertAt), ...extra, ...base.slice(insertAt)];
    },
  };
}

/* ── Consideration: drop rows the election card already covers ──────────── */

// Rows superseded by ElectionCard's own option/proration presentation once
// a deal has a genuine election (deriveElectionSummary gated on
// prorationMechanics.electionType — same gate ElectionCard itself uses, see
// pages/review/[id].js). Consideration type / appraisal rights /
// withholding / CVR / "other provisions" rows are untouched — the card
// doesn't cover those.
const ELECTION_SUPERSEDED_ROW_IDS = new Set([
  'consideration-hero-per-share',
  'consideration-hero-exchangeRatio',
  'consideration-hero-exchangeRatioText',
  'consideration-hero-prorationMechanics',
  'consideration-hero-electionMechanics',
]);

function decorateConsiderationHeroConfig(config) {
  return {
    ...config,
    selectRows(reviewDeal) {
      const base = config.selectRows(reviewDeal) || [];
      const election = deriveElectionSummary(reviewDeal);
      if (!election) return base;
      return base.filter((row) => !ELECTION_SUPERSEDED_ROW_IDS.has(row.id));
    },
  };
}

/* ── entry point ─────────────────────────────────────────────────────────── */

const REP_CONFIG_IDS = new Set(['representations-qualifiers', 'parent-representations-qualifiers']);

// agreementIso: the deal's signing/announce date (deal.announce_date),
// YYYY-MM-DD. Configs that need no decoration pass through untouched.
export function decorateConfigForV2(config, { agreementIso } = {}) {
  if (!config) return config;
  if (REP_CONFIG_IDS.has(config.id)) return decorateRepsConfig(config, isoToUtcMs(agreementIso));
  if (config.id === 'material-contracts') return decorateMaterialContractsConfig(config);
  if (config.id === 'structure-mechanics') return decorateStructureMechanicsConfig(config);
  if (config.id === 'consideration-hero') return decorateConsiderationHeroConfig(config);
  return config;
}
