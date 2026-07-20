import { conditionGroups } from '../../components/review/table-configs/conditions.config.js';
import {
  affirmativeRows,
  buildIocExceptionsRows,
  buildOtherRestrictionsRows,
  fragmentCards,
  iocCardsForParty,
  negativeCovenantGroups,
  renderNegativeRow,
} from '../../components/review/table-configs/ioc-exceptions.config.js';
import { buildGroups as buildNosolGroups } from '../../components/review/table-configs/nosol-section.config.js';
import { resolveMarketMetricRow } from './adapter.js';

const SECTION_FAMILIES = Object.freeze({
  'antitrust-regulatory': 'ANTI',
  conditions: 'COND',
  'employee-benefits': 'EMPBEN',
  'general-covenants': 'COV',
  'ioc-exceptions': 'IOC',
  'parent-ioc-exceptions': 'IOC',
  'mae-definitions': 'MAE',
  'material-contracts': 'REP-T',
  'misc-boilerplate': 'MISC',
  'no-other-reps-fraud': 'REP',
  nosol: 'NOSOL',
  'parent-representations-qualifiers': 'REP-B',
  'representations-qualifiers': 'REP-T',
  'structure-mechanics': 'STRUCT',
  'tail-fee': 'TERMF',
  'termination-fees': 'TERMF',
  'termination-rights': 'TERMR',
  'votes-approvals-meeting': 'VOTE',
});

function flattenGroupedRows(groups, path = []) {
  const out = [];
  for (const group of groups || []) {
    const groupPath = [...path, group.id || group.label || 'group'];
    if (Array.isArray(group.rows)) {
      for (const row of group.rows) {
        if (Array.isArray(row?.rows)) out.push(...flattenGroupedRows([row], groupPath));
        else out.push({ row, groupPath });
      }
    }
  }
  return out;
}

function definitionRows(reviewDeal) {
  return (reviewDeal?.definitions || [])
    .filter((definition) => definition?.defined_term)
    .map((definition) => ({
      ...definition,
      id: `definition-${String(definition.defined_term).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label: definition.defined_term,
    }));
}

function iocRows(sectionId, reviewDeal) {
  const party = sectionId === 'parent-ioc-exceptions' ? 'Parent' : 'Company';
  const cards = iocCardsForParty(reviewDeal, party);
  if (!cards.length) return [];
  const negative = negativeCovenantGroups(cards).map((group) => renderNegativeRow({
    id: `ioc-neg-${group.band}-${group.code}`,
    code: group.code,
    band: group.band,
    cards: group.cards,
  }));
  return [
    ...affirmativeRows(cards),
    ...buildIocExceptionsRows(cards),
    ...negative,
    ...buildOtherRestrictionsRows(fragmentCards(cards)),
  ];
}

function rowsForSection(section, reviewDeal) {
  const id = section?.id;
  if (id === '__definitions') return definitionRows(reviewDeal).map((row) => ({ row, groupPath: ['definitions'] }));
  if (id === 'nosol') return flattenGroupedRows(buildNosolGroups(reviewDeal));
  if (id === 'conditions') return flattenGroupedRows(conditionGroups(reviewDeal));
  if (id === 'ioc-exceptions' || id === 'parent-ioc-exceptions') {
    return iocRows(id, reviewDeal).map((row) => ({ row, groupPath: [id] }));
  }

  let selected = [];
  try {
    selected = section?.config?.selectRows?.(reviewDeal) || [];
  } catch {
    selected = [];
  }
  if (id === 'termination-rights') {
    return flattenGroupedRows(selected[0]?.groups || []);
  }
  return selected.map((row) => ({ row, groupPath: [id || 'section'] }));
}

export function enumerateMarketSectionRows(section, reviewDeal) {
  return rowsForSection(section, reviewDeal).filter(({ row }) => row && row.id);
}

export function resolveMarketSectionRows(section, reviewDeal, context = {}) {
  const sectionId = section?.id || context.sectionId || 'section';
  const entries = enumerateMarketSectionRows(section, reviewDeal);
  const rows = entries.map(({ row, groupPath }) => ({
    ...resolveMarketMetricRow(row, {
      ...context,
      sectionId,
      configId: section?.config?.id || sectionId,
      provisionFamily: context.provisionFamily || SECTION_FAMILIES[sectionId],
    }),
    groupPath,
  }));
  return {
    sectionId,
    title: section?.title || section?.config?.title || sectionId,
    rows,
    rowCount: rows.length,
    comparableRowCount: rows.filter((entry) => entry.metrics.some((metric) => metric.comparison.status === 'comparable')).length,
    nonComparableRowCount: rows.filter((entry) => entry.metrics.every((metric) => metric.comparison.status === 'non_comparable')).length,
    invalidRowCount: rows.filter((entry) => entry.errors.length > 0).length,
  };
}
