import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['test', 'MAE test', 'Definition', ['maeTest', 'mainConcept']],
  ['limbs', 'MAE limbs', 'Definition', ['maeLimbType', 'maeLimbs']],
  ['carveouts', 'Carve-outs', 'Carve-outs', ['carveouts', 'maeCarveouts']],
  ['exceptions', 'Exceptions to carve-outs', 'Carve-outs', ['carveoutExceptions', 'maeCarveoutExceptions']],
  ['disproportionate', 'Disproportionate-impact clause', 'Exceptions', ['disproportionateImpactClause', 'disproportionalityClause']],
  ['prevent-delay', 'Prevent / delay prong', 'Definition', ['preventDelayProng', 'maePreventDelay']],
  ['target-parent', 'Target / parent split', 'Scope', ['maeParty', 'partyScope']],
];

function isMae(card) {
  const code = cardCode(card);
  return cardType(card) === 'MAE' || code.includes('MAE') || /material adverse effect|\bMAE\b/i.test(`${card?.short_title || ''} ${card?.defined_term || ''} ${textOf(card)}`);
}

const maeDefinitionsConfig = {
  id: 'mae-definitions',
  title: 'Material Adverse Effect',
  layoutSlot: 'mae',
  selectRows(reviewDeal) {
    return mappedRows('mae-definitions', selectCards(reviewDeal, isMae), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { maeDefinitionsConfig };
