import React from 'react';
import {
  deriveSecMeetingSummary,
  enumLabel,
  formatAdjournmentLimits,
  formatDeadline,
} from '../../../lib/sec-meeting.js';
import { valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
import productCoverage from '../../../lib/canonical-v2/proxy-meeting-product-coverage.js';

const { coverageForSecRowId } = productCoverage;

const DIRECT_ROWS = [
  ['offerCommencementDeadline', 'Offer commencement'],
  ['scheduleTOFiling', 'Schedule TO / offer documents'],
  ['schedule14D9Filing', 'Schedule 14D-9'],
  ['stockholderListCovenant', 'Stockholder list / holder communications'],
  ['tenderOfferMinimumCondition', 'Tender-offer minimum condition'],
  ['acceptanceAndPaymentMechanics', 'Acceptance / payment'],
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
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
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy read `.text` before `.label`/`.code` (no
// redundancy check) and also fell back to formatDeadline(value) for a bare
// deadline-shaped object with no label/code/text. DIRECT_ROWS keys are all
// schema `string`-typed in practice, so that formatDeadline fallback was
// dead code here; deadline rows (proxy/mailing/meeting) format via
// formatDeadline() directly in deadlineRow(), not through valueText.
function pseudoProvision(card) {
  const features = cardFeatures(card);
  return { ...card, code: cardCode(card), category: card?.short_title, ai_metadata: { code: cardCode(card), features } };
}
function firstFeature(cards, key) {
  for (const card of cards) {
    const text = valueText(cardFeatures(card)[key]);
    if (text) return { text, card };
  }
  return null;
}
function firstCardWithFeature(cards, key, derivedValue = null) {
  const derivedText = String(derivedValue?.text || '').trim();
  if (derivedText) {
    const exact = cards.find((card) => textOf(card).includes(derivedText));
    if (exact) return exact;
  }
  return cards.find((card) => {
    const raw = cardFeatures(card)[key];
    if (raw === null || raw === undefined || raw === '') return false;
    if (Array.isArray(raw)) return raw.length > 0;
    if (typeof raw === 'object') return Object.keys(raw).length > 0;
    return Boolean(String(raw).trim());
  }) || null;
}
function hasSecSignal(card) {
  const code = cardCode(card);
  if (['COV-PROXY', 'COV-MEETING', 'STRUCT-OFFER'].includes(code)) return true;
  const features = cardFeatures(card);
  if (DIRECT_ROWS.some(([key]) => valueText(features[key]))) return true;
  if (['proxyFilingDeadline', 'mailingDeadline', 'meetingDeadline', 'adjournmentRights', 'meetingControlNotes', 'boardRecommendationInclusion', 'meetingConveneObligation'].some((key) => valueText(features[key]))) return true;
  return /proxy|stockholder|shareholder|Schedule\s+(?:TO|14D-9)|tender\s+offer|adjourn/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function deadlineRow(id, label, deadline, featureKey, sourceCard = null) {
  if (!deadline) return null;
  // `deadline` (the normalised { text, days, unit, trigger } object) rides
  // along on the row -- not just its formatted string -- so a consumer that
  // wants the pill-per-part rendering (number / unit pill / "after" /
  // reference pill) instead of a single flattened string has the pieces
  // without re-parsing formatDeadline()'s output. See
  // votes-approvals-meeting.config.js, the only current consumer of this.
  const row = {
    id: `sec-meeting-${id}`,
    label,
    subject: 'Proxy / meeting',
    detail: formatDeadline(deadline),
    evidence: textOf(sourceCard) || deadline.text || formatDeadline(deadline),
    sourceCard,
    present: true,
    deadline,
    featureKeys: [featureKey],
    marketSubterms: [
      {
        key: 'timing',
        label: 'Timing',
        featureKeys: [featureKey],
        kind: 'duration',
        role: 'metric',
        value: {
          strategy: 'feature_value',
          featureKeys: [featureKey],
          normalizer: 'deadline_duration',
        },
        semantics: {
          unit: 'days_equivalent',
          calendarBasis: 'mixed',
          requiredDimensions: ['unit', 'calendarBasis', 'trigger'],
          normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
        },
      },
      {
        key: 'trigger',
        label: 'Measured from',
        featureKeys: [featureKey],
        kind: 'categorical',
        value: {
          strategy: 'feature_value',
          featureKeys: [featureKey],
          normalizer: 'deadline_trigger',
        },
      },
    ],
  };
  return withSignal(row);
}
function adjournmentPartyIdentity(right) {
  const party = String(right?.party || 'UNSPECIFIED').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return `ADJOURNMENT_PARTY:${party || 'UNSPECIFIED'}`;
}
function adjournmentRows(rights, sourceCard = null) {
  return (rights || []).map((right, idx) => {
    const reasons = (right.reasons || []).map((reason) => valueText(reason)).filter(Boolean).join('; ');
    const limits = formatAdjournmentLimits(right).join('; ');
    const itemMatch = {
      itemIdentity: adjournmentPartyIdentity(right),
      identityKind: 'adjournment_party',
    };
    return withSignal({
      id: `sec-meeting-adjournment-${idx}`,
      label: 'Adjournment rights',
      subject: right.party ? enumLabel(right.party) : 'Meeting',
      detail: [reasons, limits, right.text].filter(Boolean).join('\n'),
      evidence: textOf(sourceCard) || right.text || reasons || limits,
      sourceCard,
      present: true,
      featureKeys: ['adjournmentRights'],
      marketPresence: {
        strategy: 'list_item',
        featureKeys: ['adjournmentRights'],
        ...itemMatch,
        missingState: 'absent',
      },
      marketSubterms: [
        {
          key: 'reasons',
          label: 'Permitted reasons',
          featureKeys: ['adjournmentRights'],
          kind: 'multi_select',
          value: { strategy: 'list_item_field', featureKeys: ['adjournmentRights'], ...itemMatch, path: 'reasons' },
        },
        {
          key: 'party',
          label: 'Party controlling adjournment',
          featureKeys: ['adjournmentRights'],
          kind: 'categorical',
          value: { strategy: 'list_item_field', featureKeys: ['adjournmentRights'], ...itemMatch, path: 'party' },
        },
        {
          key: 'maximum-adjournments',
          label: 'Maximum adjournments',
          featureKeys: ['adjournmentRights'],
          kind: 'numeric',
          role: 'metric',
          value: { strategy: 'list_item_field', featureKeys: ['adjournmentRights'], ...itemMatch, path: 'maxAdjournments' },
        },
        {
          key: 'maximum-days-each',
          label: 'Maximum days per adjournment',
          featureKeys: ['adjournmentRights'],
          kind: 'duration',
          role: 'metric',
          value: {
            strategy: 'list_item_field',
            featureKeys: ['adjournmentRights'],
            ...itemMatch,
            path: 'maxDaysPerAdjournment',
            normalizer: 'adjournment_duration',
            trigger: 'meeting_adjournment',
          },
          semantics: {
            unit: 'days_equivalent',
            calendarBasis: 'mixed',
            trigger: 'meeting_adjournment',
            requiredDimensions: ['unit', 'calendarBasis'],
            normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
          },
        },
        {
          key: 'maximum-days-total',
          label: 'Maximum aggregate adjournment period',
          featureKeys: ['adjournmentRights'],
          kind: 'duration',
          role: 'metric',
          value: {
            strategy: 'list_item_field',
            featureKeys: ['adjournmentRights'],
            ...itemMatch,
            path: 'maxDaysTotal',
            normalizer: 'adjournment_duration',
            trigger: 'meeting_adjournment',
          },
          semantics: {
            unit: 'days_equivalent',
            calendarBasis: 'mixed',
            trigger: 'meeting_adjournment',
            requiredDimensions: ['unit', 'calendarBasis'],
            normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
          },
        },
        {
          key: 'consent-override',
          label: 'Consent needed above the cap',
          featureKeys: ['adjournmentRights'],
          kind: 'categorical',
          role: 'exception',
          value: {
            strategy: 'list_item_field',
            featureKeys: ['adjournmentRights'],
            ...itemMatch,
            path: 'text',
            normalizer: 'adjournment_consent_override',
          },
        },
      ],
      // Normalised { party, reasons, maxAdjournments, maxDaysPerAdjournment,
      // maxDaysTotal, text } -- see deadlineRow()'s `deadline` field above
      // for why the structured value rides along unflattened.
      adjournment: right,
    });
  });
}
function directRows(cards) {
  const rows = [];
  for (const [key, label] of DIRECT_ROWS) {
    const hit = firstFeature(cards, key);
    if (!hit) continue;
    const id = `sec-meeting-${key}`;
    const coverage = coverageForSecRowId(id);
    rows.push(withSignal({
      id,
      label,
      subject: key === 'tenderOfferMinimumCondition' ? 'Condition' : 'SEC / offer',
      detail: hit.text,
      evidence: textOf(hit.card),
      sourceCard: hit.card,
      featureKeys: [key],
      marketProvisionCodes: key === 'tenderOfferMinimumCondition'
        ? ['COND-M-STOCKHOLDER']
        : ['STRUCT-OFFER'],
      marketPresence: {
        strategy: 'feature_non_empty',
        featureKeys: [key],
        missingState: 'absent',
      },
      marketSubterms: [{
        key: 'treatment',
        label,
        featureKeys: [key],
        kind: 'categorical',
        role: 'treatment',
        value: { strategy: 'feature_value', featureKeys: [key] },
      }],
      ownerFamily: coverage?.owner_id || null,
      governanceState: coverage?.governance_state || null,
      targetClaimKeys: coverage ? [...coverage.claim_keys] : [],
      present: true,
    }));
  }
  return rows;
}

function governedPresenceRows(cards) {
  const definitions = [
    ['boardRecommendationInclusion', 'Board recommendation in proxy statement', 'Proxy / meeting'],
    ['meetingConveneObligation', 'Convene and hold stockholder meeting', 'Meeting'],
  ];
  return definitions.flatMap(([key, label, subject]) => {
    const hit = firstFeature(cards, key);
    if (!hit || cardFeatures(hit.card)[key] !== true) return [];
    return [withSignal({
      id: `sec-meeting-${key}`,
      label,
      subject,
      detail: 'Required',
      evidence: textOf(hit.card),
      sourceCard: hit.card,
      present: true,
      featureKeys: [key],
      marketProvisionCodes: [key === 'boardRecommendationInclusion' ? 'COV-PROXY' : 'COV-MEETING'],
      marketPresence: {
        strategy: 'feature_non_empty',
        featureKeys: [key],
        missingState: 'absent',
      },
      marketSubterms: [{
        key: 'required',
        label,
        featureKeys: [key],
        kind: 'categorical',
        role: 'treatment',
        value: { strategy: 'feature_value', featureKeys: [key] },
      }],
    })];
  });
}

function evidenceFact(cards, pattern) {
  return cards.find((card) => ['COV-PROXY', 'COV-MEETING'].includes(cardCode(card))
    && pattern.test(textOf(card))) || null;
}

function meetingMechanicFactRows(cards) {
  const rows = [];
  const recordFeature = firstFeature(cards, 'meetingRecordDate') || firstFeature(cards, 'recordDate');
  const recordCard = recordFeature?.card || evidenceFact(
    cards,
    /\b(?:establish|set|fix|select)(?:es|ed|ing)?\b[\s\S]{0,120}\brecord date\b|\brecord date\b[\s\S]{0,120}\b(?:establish|set|fix|select)(?:es|ed|ing)?\b/i,
  );
  if (recordCard) {
    const coverage = coverageForSecRowId('sec-meeting-record-date');
    rows.push(withSignal({
      id: 'sec-meeting-record-date',
      label: 'Meeting record date',
      subject: 'Meeting',
      detail: recordFeature?.text || 'Required',
      evidence: textOf(recordCard),
      sourceCard: recordCard,
      featureKeys: recordFeature ? ['meetingRecordDate', 'recordDate'] : [],
      ownerFamily: coverage?.owner_id || null,
      governanceState: coverage?.governance_state || null,
      targetClaimKeys: coverage ? [...coverage.claim_keys] : [],
      marketState: recordFeature ? 'FEATURE_BACKED' : 'OPEN_NATIVE_FIELD',
      present: true,
    }));
  }

  const brokerCard = evidenceFact(
    cards,
    /\b(?:complet\w*|conduct\w*|perform\w*|commenc\w*|initiat\w*|undertak\w*)\b[\s\S]{0,100}\bbroker search\b|\bbroker search\b[\s\S]{0,100}\b(?:complet\w*|conduct\w*|perform\w*|commenc\w*|initiat\w*|undertak\w*)\b/i,
  );
  if (brokerCard) {
    const coverage = coverageForSecRowId('sec-meeting-broker-search');
    rows.push(withSignal({
      id: 'sec-meeting-broker-search',
      label: 'Broker search',
      subject: 'Proxy / meeting',
      detail: 'Required',
      evidence: textOf(brokerCard),
      sourceCard: brokerCard,
      featureKeys: [],
      ownerFamily: coverage?.owner_id || null,
      governanceState: coverage?.governance_state || null,
      targetClaimKeys: coverage ? [...coverage.claim_keys] : [],
      marketState: 'OPEN_NATIVE_FIELD',
      present: true,
    }));
  }
  return rows;
}
function signalFor(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: `${row.subject}: ${row.detail}`,
    value: row.detail,
    tone: row.subject === 'Condition' ? 'warning' : row.subject === 'Proxy / meeting' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}
function withSignal(row) {
  return { ...row, signals: [signalFor(row)].filter(Boolean) };
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
function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const secMeetingConfig = {
  id: 'sec-meeting',
  title: 'Shareholder Meeting / Proxy / Tender-Offer SEC Matters',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasSecSignal);
    if (!cards.length) return [];
    const summary = deriveSecMeetingSummary(cards.map(pseudoProvision));
    const proxyCard = firstCardWithFeature(cards, 'proxyFilingDeadline', summary.proxyFilingDeadline);
    const mailingCard = firstCardWithFeature(cards, 'mailingDeadline', summary.mailingDeadline);
    const meetingCard = firstCardWithFeature(cards, 'meetingDeadline', summary.meetingDeadline);
    const adjournmentCard = firstCardWithFeature(cards, 'adjournmentRights');
    const controlCard = firstCardWithFeature(cards, 'meetingControlNotes');
    return [
      deadlineRow('proxy-filing', summary.proxyFilingDeadline?.term || 'Proxy filing deadline', summary.proxyFilingDeadline, 'proxyFilingDeadline', proxyCard),
      deadlineRow('mailing', summary.mailingDeadline?.term || 'Proxy mailing', summary.mailingDeadline, 'mailingDeadline', mailingCard),
      deadlineRow('meeting', summary.meetingDeadline?.term || 'Shareholder meeting', summary.meetingDeadline, 'meetingDeadline', meetingCard),
      ...governedPresenceRows(cards),
      ...meetingMechanicFactRows(cards),
      ...adjournmentRows(summary.adjournmentRights, adjournmentCard),
      summary.meetingControlNotes ? withSignal({ id: 'sec-meeting-control', label: 'Meeting control notes', subject: 'Meeting', detail: summary.meetingControlNotes, evidence: textOf(controlCard) || summary.meetingControlNotes, sourceCard: controlCard, featureKeys: ['meetingControlNotes'], present: true }) : null,
      ...directRows(cards),
    ].filter(Boolean);
  },
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'subject', header: 'Subject', width: '12rem', renderCell: (row) => row.subject },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { renderDetail, renderSignals, secMeetingConfig, signalFor };
