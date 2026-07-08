import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['materiality', 'Materiality qualifier', 'Qualifier', ['materialityQualifier', 'materialityScopeType']],
  ['knowledge', 'Knowledge qualifier', 'Qualifier', ['knowledgeQualifier', 'knowledgeStandard', 'knowledgeScopeType']],
  ['threshold', 'Dollar threshold', 'Qualifier', ['dollarThreshold']],
  ['lookback', 'Lookback period', 'Qualifier', ['lookbackPeriod']],
  ['schedule', 'Disclosure schedule exception', 'Exceptions', ['scheduleReference', 'disclosureScheduleException']],
  ['sec-filings', 'SEC filings carve-out', 'Exceptions', ['secFilingsExceptionCarvedOutReps', 'secFilingsCarvedOutReps']],
  ['bringdown', 'Linked bring-down standard', 'Bring-down', ['linkedBringDownStandard', 'bringDownStandard']],
  ['bringdown-tiers', 'Bring-down tiers', 'Bring-down', ['bringDownTiers']],
  ['scrape', 'Materiality scrape', 'Bring-down', ['materialityScrape', 'materialityScrapeScope']],
  ['specific', 'Specific features', 'Rep-specific', ['specificFeatures']],
];

function isRepQualifier(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'REPRESENTATION' || code.startsWith('REP') || code === 'COND-B-REP' || code === 'COND-S-REP' || /representation|bring.?down|knowledge|materiality/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const representationsQualifiersConfig = {
  id: 'representations-qualifiers',
  title: 'Representation Qualifiers',
  layoutSlot: 'reps',
  selectRows(reviewDeal) {
    return mappedRows('representations-qualifiers', selectCards(reviewDeal, isRepQualifier), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { representationsQualifiersConfig };
