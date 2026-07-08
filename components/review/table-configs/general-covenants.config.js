import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['ordinary-course', 'Ordinary-course covenant', 'Interim operating', ['ordinaryCourseConduct', 'absenceConductedOrdinaryCourse']],
  ['no-mae', 'No MAE / no changes limb', 'Interim operating', ['absenceNoMAE', 'aocNoMaePresent']],
  ['specified-iocs', 'Specified interim operating covenants', 'Interim operating', ['absenceSpecifiedIOCs', 'negativeCovenantBaskets']],
  ['negative', 'Negative covenant restrictions', 'Restrictions', ['negativeCovenant', 'restrictedActions']],
  ['affirmative', 'Affirmative covenants', 'Affirmative', ['affirmativeCovenants', 'positiveObligations']],
  ['efforts', 'General efforts standard', 'Efforts', ['effortsStandard', 'reasonableBestEfforts']],
  ['access', 'Access / information rights', 'Access', ['accessRights', 'informationAccess']],
  ['public-statements', 'Public statements', 'Communications', ['publicStatements', 'publicStatementExceptions']],
  ['insurance', 'D&O / insurance covenant', 'Insurance', ['insuranceCap', 'insurancePeriod', 'doInsurance']],
  ['financing', 'Financing cooperation', 'Financing', ['financingCooperation']],
];

function isGeneralCovenant(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'COVENANT_OTHER' || type === 'COVENANT_INTERIM_OPERATING' || code.startsWith('COV') || code.startsWith('IOC') || /covenant|ordinary course|access|public statements/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const generalCovenantsConfig = {
  id: 'general-covenants',
  title: 'General Covenants',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    return mappedRows('general-covenants', selectCards(reviewDeal, isGeneralCovenant), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '12rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { generalCovenantsConfig };
