import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['efforts', 'Efforts standard', 'Efforts', ['effortsStandard', 'antitrustEffortsStandard']],
  ['filings', 'Regulatory filings', 'Timing', ['hsrFilingDeadline', 'foreignFilings', 'regulatoryFilingsDeadline']],
  ['approvals', 'Required approvals', 'Approvals', ['antitrustApprovals', 'regulatoryApprovals']],
  ['litigation', 'Regulatory litigation obligation', 'Litigation', ['litigationObligation', 'parentLitigationObligation']],
  ['consultation', 'Consultation / cooperation tier', 'Process', ['consultationTier', 'cooperationStandard']],
  ['remedies', 'Remedy obligation', 'Remedies', ['remedyObligation', 'divestitureObligation']],
  ['burden-cap', 'Burdensome-condition cap', 'Caps', ['burdensomeConditionLimit', 'burdenBaseline', 'hellOrHighWater']],
  ['clear-skies', 'Clear-skies covenant', 'Conduct', ['clearSkies', 'clearSkiesObligation']],
  ['timing-agreements', 'Timing agreements', 'Conduct', ['timingAgreement', 'timingAgreementText', 'noInconsistentAction']],
  ['outside-date', 'Regulatory outside-date linkage', 'Termination', ['outsideDateExtension', 'antitrustOutsideDateExtension', 'tickingFee']],
];

function isAntitrust(card) {
  return cardType(card) === 'ANTITRUST_REGULATORY' || cardCode(card).startsWith('ANTI') || /antitrust|regulatory|HSR|competition/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const antitrustRegulatoryConfig = {
  id: 'antitrust-regulatory',
  title: 'Antitrust / Regulatory',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    return mappedRows('antitrust-regulatory', selectCards(reviewDeal, isAntitrust), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { antitrustRegulatoryConfig };
