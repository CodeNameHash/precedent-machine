import React from 'react';
import {
  CANONICAL_CONDITIONS_B,
  CANONICAL_CONDITIONS_M,
  CANONICAL_CONDITIONS_S,
  CONDITION_ABSENT_COPY,
  conditionDetailLines,
  conditionRowMatches,
} from '../../../lib/canonical-conditions.js';
import taxonomy from '../../../lib/taxonomy.js';
import { cardFeatures } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}

function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}

function cardToProvision(card) {
  const code = cardCode(card);
  const features = cardFeatures(card);
  return {
    id: card.id || card.provision_instance_id,
    type: code.startsWith('COND-') ? code.split('-').slice(0, 2).join('-') : 'COND-M',
    category: card.short_title || '',
    full_text: textOf(card),
    sourceCard: card,
    features: {
      ...features,
      canonicalCode: code,
      // Ben: "see text" (and every other mainCondition consumer -- the
      // covenant-standard sniff, conditionDetailLines' "Condition:" line)
      // must show the REAL clause, not the AI's one-sentence summary --
      // mainCondition/mainConcept are documented in lib/schema/features.js
      // as fallback one-sentence summaries, not verbatim text. Mirrors the
      // IOC fix (textOf(c) || valueText(mainObligation)): the real captured
      // quote/region wins whenever one exists; the AI summary is the last
      // resort for the rare card with no captured text at all.
      mainCondition: textOf(card) || features.mainCondition || features.mainConcept,
      sectionNumber: features.sectionNumber || card.section_ref || '',
    },
  };
}

function detailText(matches) {
  if (!matches.length) return CONDITION_ABSENT_COPY;
  return matches
    .map((match) => {
      const lines = conditionDetailLines(match.features);
      if (!lines.length) return 'Present, detail not extracted';
      return lines.map((line) => `${line.label}: ${line.value}`).join('\n');
    })
    .join('\n\n');
}

function unwrap(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value && !('code' in value)) return value.value;
  return value;
}

function readableFeatureValue(key, value) {
  const inner = unwrap(value);
  if (inner === null || inner === undefined || inner === '') return null;
  if (typeof inner === 'boolean') return inner ? 'Yes' : 'No';
  if (Array.isArray(inner)) return inner.map((item) => readableFeatureValue(key, item)).filter(Boolean).join(', ');
  if (typeof inner === 'object') return inner.label || inner.text || inner.code || null;
  const dict = taxonomyForFeatureKey(key);
  return (dict && labelForCode(String(inner), dict)) || String(inner);
}

function evidenceFor(value, provision) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
    if (Array.isArray(value.quotes)) return value.quotes.find((quote) => typeof quote === 'string' && quote.trim()) || provision.full_text;
  }
  return provision.full_text;
}

function signal(id, label, value, provision, tone = 'info') {
  const readable = readableFeatureValue(id, value);
  if (!readable) return null;
  return {
    id: `${provision.id || provision.features.canonicalCode}-${id}-${readable}`,
    label: `${label}: ${readable}`,
    value,
    tone,
    evidence: evidenceFor(value, provision),
    source: provision.sourceCard,
  };
}

function materialityScrapeSignal(provision) {
  const f = provision.features || {};
  if (typeof f.materialityScrapeBoolean === 'boolean') return signal('materialityScrapeBoolean', 'Scrape', f.materialityScrapeBoolean, provision, 'warning');
  if (typeof f.materialityScrapePresent === 'boolean') return signal('materialityScrapePresent', 'Scrape', f.materialityScrapePresent, provision, 'warning');
  return signal('materialityScrape', 'Scrape', f.materialityScrape || f.materialityScrapeLanguage, provision, 'warning');
}

function conditionSignals(row, matches) {
  const baseCode = (row.codes && row.codes[0]) || (matches[0] && matches[0].features.canonicalCode) || null;
  const out = baseCode ? [{
    id: `${row.label}-canonical-code`,
    label: baseCode,
    value: baseCode,
    tone: matches.length ? 'neutral' : 'missing',
    evidence: matches[0] && matches[0].full_text,
    source: matches[0] && matches[0].sourceCard,
    // AC6: a raw canonical code (e.g. COND-M-STOCKHOLDER) is editor metadata,
    // not reader content. Tagged so renderSignals can drop it in the default
    // Reviewer view — the Term column already shows the friendly condition name.
    isCanonicalCode: true,
  }] : [];
  for (const provision of matches) {
    const f = provision.features || {};
    out.push(signal('effortsStandard', 'Efforts', f.effortsStandard || f.antitrustEffortsStandard, provision, 'info'));
    out.push(signal('consentStandard', 'Consent', f.consentStandard, provision, 'info'));
    out.push(materialityScrapeSignal(provision));
    // Skechers cross-deal parity gap: no Metsera claim, but sits on the same
    // No Legal Impediment / COND-M-LEGAL card as the rest of this row.
    out.push(signal('governmentProceedingConditionPresent', 'Government proceeding', f.governmentProceedingConditionPresent, provision, 'warning'));
    const approvals = Array.isArray(f.antitrustApprovals) ? f.antitrustApprovals : [];
    for (const approval of approvals) out.push(signal('antitrustApprovals', 'Approval', approval, provision, 'present'));
  }
  const seen = new Set();
  return out
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  // AC6: only hide the raw canonical-code pill when we KNOW we're in the
  // read view (isEdit === false). When the mode is unknown (undefined, e.g.
  // direct unit-test renders) we stay permissive and show it.
  const signals = ctx?.isEdit === false
    ? row.signals.filter((item) => !item.isCanonicalCode)
    : row.signals;
  if (!PillCell) return signals.map((item) => item.label).join('\n');
  return signals.map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.source, as: 'span' }, row.detail);
}

function createConditionsConfig({ id, title, rows: canonicalRows, empty }) {
  function selectRows(reviewDeal) {
    const conditionCards = (reviewDeal?.cards || [])
      .filter((card) => card?.provision_type === 'CLOSING_CONDITION')
      .map(cardToProvision);
    if (!conditionCards.length) return [];

    return canonicalRows
      .filter((row) => !row.tenderOnly && !row.requireParentApproval)
      .map((row, originalIdx) => {
        const matches = conditionCards.filter((provision) => {
          const code = provision.features.canonicalCode || null;
          return conditionRowMatches(row, provision, code);
        });
        return {
          id: `${id}-${row.label}`,
          label: row.label,
          matches,
          present: matches.length > 0 || !!row.alwaysRender,
          detail: detailText(matches),
          signals: conditionSignals(row, matches),
          evidence: matches[0] && matches[0].full_text,
          source: matches[0] && matches[0].sourceCard,
          originalIdx,
        };
      })
      .sort((a, b) => (a.present !== b.present ? (a.present ? -1 : 1) : a.originalIdx - b.originalIdx));
  }

  return {
    id,
    title,
    layoutSlot: 'conditions',
    selectRows,
    columns: [
      {
        id: 'term',
        header: 'Term',
        width: '18rem',
        renderCell: (row) => row.label,
      },
      {
        id: 'signals',
        header: 'Provision',
        width: '18rem',
        renderCell: renderSignals,
      },
      {
        id: 'provision',
        header: 'Provision',
        renderCell: renderDetail,
      },
    ],
    empty: { copy: empty },
  };
}

const conditionsMConfig = createConditionsConfig({
  id: 'conditions-m',
  title: 'Closing Conditions — Mutual',
  rows: CANONICAL_CONDITIONS_M,
  empty: 'No mutual closing-condition cards found.',
});

const conditionsBConfig = createConditionsConfig({
  id: 'conditions-b',
  title: 'Closing Conditions — Buyer',
  rows: CANONICAL_CONDITIONS_B,
  empty: 'No buyer closing-condition cards found.',
});

const conditionsSConfig = createConditionsConfig({
  id: 'conditions-s',
  title: 'Closing Conditions — Seller',
  rows: CANONICAL_CONDITIONS_S,
  empty: 'No seller closing-condition cards found.',
});

export { cardToProvision, conditionSignals, conditionsBConfig, conditionsMConfig, conditionsSConfig, createConditionsConfig, renderDetail, renderSignals };
