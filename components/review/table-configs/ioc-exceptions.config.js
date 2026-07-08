import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function isIocCard(card) {
  return card?.provision_type === 'COVENANT_INTERIM_OPERATING' || /^IOC(?:-|$)/.test(cardCode(card));
}
function isGeneralExceptionsCard(card) {
  const code = cardCode(card);
  const title = String(card?.short_title || '').trim();
  return code === 'IOC-GENERAL-EXCEPTIONS' || code === 'IOC-EXCEPTIONS' || /general\s+exceptions?/i.test(title);
}
function isNegativePreambleCard(card) {
  return cardCode(card) === 'IOC-NEGATIVE-PREAMBLE' || /negative\s+preamble/i.test(String(card?.short_title || ''));
}
function isPositivePreambleCard(card) {
  const code = cardCode(card);
  const title = String(card?.short_title || '').trim();
  return code === 'IOC-POSITIVE-PREAMBLE' || (/preamble/i.test(title) && !isNegativePreambleCard(card));
}
function partySide(card) {
  const scope = String(card?.party_scope || '').toUpperCase();
  return scope === 'BUYER' || scope === 'PARENT' ? 'buyer' : 'target';
}
function splitExceptionText(text) {
  const body = String(text || '').trim();
  if (!body) return [];
  const matches = [...body.matchAll(/\(([ivxlcdm]+|[a-z]|\d+)\)\s+/gi)];
  if (matches.length >= 2) {
    return matches.map((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : body.length;
      return body.slice(start, end).trim().replace(/[;,]\s*(?:or|and)?\s*$/, '');
    }).filter((part) => part.length > 8);
  }
  return body
    .split(/(?:\s*;\s+(?:and|or)?\s*)|(?:\.\s+(?=[A-Z(]))/)
    .map((part) => part.trim().replace(/[;,]\s*(?:or|and)?\s*$/, ''))
    .filter((part) => part.length > 12);
}
function labelForText(text) {
  const value = String(text || '').trim();
  if (/disclosure\s+(letter|schedule)/i.test(value)) return 'As disclosed';
  if (/required\s+by\s+(applicable\s+)?law/i.test(value)) return 'As required by law';
  if (/required\s+by\s+this\s+agreement|expressly\s+required\s+by\s+this\s+agreement/i.test(value)) return 'As contemplated by this Agreement';
  if (/consent/i.test(value)) return 'With consent';
  if (/covid|pandemic/i.test(value)) return 'Pandemic measures';
  if (/ordinary\s+course/i.test(value)) return 'Ordinary course';
  return value;
}
function entryFromItem(item, source) {
  if (!item) return null;
  if (typeof item === 'string') return { code: item.toLowerCase(), label: labelForText(item), text: item, source };
  if (typeof item === 'object') {
    const text = item.text || item.label || item.code || '';
    return {
      code: String(item.code || text).toUpperCase(),
      label: item.label || labelForText(text),
      text: item.text || null,
      source,
    };
  }
  return null;
}
function readableSignal(key, value) {
  if (value === null || value === undefined || value === '') return null;
  const inner = value && typeof value === 'object' && !Array.isArray(value) && 'value' in value && !('code' in value) ? value.value : value;
  if (typeof inner === 'boolean') return inner ? 'Yes' : 'No';
  if (Array.isArray(inner)) return inner.map((item) => readableSignal(key, item)).filter(Boolean).join(', ');
  if (typeof inner === 'object') return inner.label || inner.text || inner.code || null;
  const dict = taxonomyForFeatureKey(key);
  return (dict && labelForCode(String(inner), dict)) || String(inner);
}
function signal(key, label, value, card, tone = 'info') {
  const readable = readableSignal(key, value);
  if (!readable) return null;
  return {
    id: `${card?.id || cardCode(card)}-${key}-${readable}`,
    label: `${label}: ${readable}`,
    value,
    tone,
    evidence: value?.text || textOf(card),
    source: card,
  };
}
function sideSignals(cards) {
  const out = [];
  for (const card of cards) {
    const f = cardFeatures(card);
    out.push(signal('effortsStandard', 'Efforts', f.iocEffortsStandard || f.effortsStandard, card, 'info'));
    out.push(signal('consentStandard', 'Consent', f.iocConsentStandard || f.consentStandard, card, 'info'));
    out.push(signal('knowledgeQualifier', 'Knowledge', f.knowledgeQualifier, card, 'warning'));
    out.push(signal('dayCountDeadline', 'Deadline', f.dayCountDeadline || f.leadInPeriodDays || f.deadlineDays, card, 'neutral'));
  }
  const seen = new Set();
  return out.filter(Boolean).filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
}
function dedupe(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (!entry?.label) continue;
    const key = String(entry.code || entry.label).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
function entriesFromFeatures(cards, featureKey) {
  const out = [];
  for (const card of cards) {
    const list = cardFeatures(card)[featureKey];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const entry = entryFromItem(item, card);
      if (entry) out.push(entry);
    }
  }
  return dedupe(out);
}
function entriesFromText(card) {
  return dedupe(splitExceptionText(card?.primary_quote || card?.region_full_text).map((text) => entryFromItem(text, card)));
}
function formatEntries(entries) {
  if (!entries.length) return 'None extracted for this agreement.';
  const visible = entries.slice(0, 4).map((entry) => entry.label);
  const extra = entries.length - visible.length;
  return extra > 0 ? `${visible.join('\n')} \n(+${extra} more)` : visible.join('\n');
}
function renderEntries(entries, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource) return formatEntries(entries);
  if (!entries.length) return 'None extracted for this agreement.';
  return entries.map((entry) => React.createElement(EvidenceHoverSource, {
    key: `${entry.code || entry.label}-${entry.label}`,
    evidence: entry.text || textOf(entry.source),
    source: entry.source,
    as: 'div',
    className: 'mb-1',
  }, entry.label));
}
function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  return (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
}
function rowsForSide(cards, side, label) {
  const sideCards = cards.filter((card) => partySide(card) === side);
  if (!sideCards.length) return null;
  const positiveCards = sideCards.filter((card) => isPositivePreambleCard(card) || isGeneralExceptionsCard(card));
  const negativeCards = sideCards.filter(isNegativePreambleCard);
  const structuredPositive = dedupe([
    ...entriesFromFeatures(positiveCards, 'permittedExceptions'),
    ...entriesFromFeatures(positiveCards, 'generalExceptions'),
  ]);
  const generalCard = positiveCards.find(isGeneralExceptionsCard);
  const positive = structuredPositive.length ? structuredPositive : entriesFromText(generalCard);
  const negative = entriesFromFeatures(negativeCards, 'negativePreambleExceptions');
  return {
    id: `ioc-exceptions-${side}`,
    party: label,
    positive,
    negative,
    signals: sideSignals(sideCards),
    present: positive.length > 0 || negative.length > 0,
  };
}
const iocExceptionsConfig = {
  id: 'ioc-exceptions',
  title: 'IOC General Exceptions',
  layoutSlot: 'ioc',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isIocCard);
    return [
      rowsForSide(cards, 'target', 'Target / Company'),
      rowsForSide(cards, 'buyer', 'Parent / Buyer'),
    ].filter(Boolean);
  },
  columns: [
    { id: 'party', header: 'Party', width: '13rem', renderCell: (row) => row.party },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'positive', header: 'General / positive exceptions', renderCell: (row, ctx) => renderEntries(row.positive, ctx) },
    { id: 'negative', header: 'Negative-preamble exceptions', renderCell: (row, ctx) => renderEntries(row.negative, ctx) },
  ],
  empty: { copy: 'No IOC general-exceptions cards found.' },
};
export { iocExceptionsConfig, renderEntries, renderSignals, sideSignals };
