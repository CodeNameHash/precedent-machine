import {
  CANONICAL_CONDITIONS_B,
  CANONICAL_CONDITIONS_M,
  CANONICAL_CONDITIONS_S,
  CONDITION_ABSENT_COPY,
  conditionDetailLines,
  conditionRowMatches,
} from '../../../lib/canonical-conditions.js';

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}

function cardToProvision(card) {
  const code = cardCode(card);
  return {
    id: card.id || card.provision_instance_id,
    type: code.startsWith('COND-') ? code.split('-').slice(0, 2).join('-') : 'COND-M',
    category: card.short_title || '',
    full_text: card.primary_quote || card.region_full_text || '',
    features: {
      canonicalCode: code,
      mainCondition: card.primary_quote || card.region_full_text || '',
      sectionNumber: card.section_ref || '',
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
        id: 'provision',
        header: 'Provision',
        renderCell: (row) => row.detail,
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

export { cardToProvision, conditionsBConfig, conditionsMConfig, conditionsSConfig, createConditionsConfig };
