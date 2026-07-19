// Q3 (perf quick-wins, Jul 2026): the shaping logic behind
// /api/deals?id=<id>&view=header — a slim deal row for the review page's
// masthead. Split out of the route (which uses ESM `import`, not
// require()-able from plain node:test) so it's testable and so the column
// list has exactly one definition.
//
// Column list audited against every field components/review-v2/DealHeader.jsx
// and components/review-v2/sectionList.js read off `deal`/`deal.metadata`,
// plus deal_facts/advisors_v2/merger_form/topology per the perf-package spec.
// Deliberately excludes metadata.full_text / classified_sections /
// extraction_runs — the bulk of a full deal row (735KB-1.5MB raw) that the
// header never reads.
const DEAL_HEADER_SELECT = [
  'id',
  'acquirer',
  'target',
  'value_usd',
  'announce_date',
  'sector',
  'created_at',
  'created_by',
  'ingest_status:metadata->>ingest_status',
  'ultimateParent:metadata->>ultimateParent',
  'ultimate_parent:metadata->>ultimate_parent',
  'parent_entity:metadata->>parent_entity',
  'acquirerUltimateParent:metadata->>acquirerUltimateParent',
  'acquirer_ultimate_parent:metadata->>acquirer_ultimate_parent',
  'acquirer_display:metadata->>acquirer_display',
  'target_display:metadata->>target_display',
  'target_entity:metadata->>target_entity',
  'advisors_v2:metadata->advisors_v2',
  'advisors:metadata->advisors',
  'deal_facts:metadata->deal_facts',
  'merger_form:metadata->>merger_form',
  'headlineConsiderationType:metadata->>headlineConsiderationType',
  'headline_consideration_type:metadata->>headline_consideration_type',
  'considerationType:metadata->>considerationType',
  'consideration_type:metadata->>consideration_type',
].join(', ');

function headerRowToDeal(row) {
  const metadata = {
    ...(row.ingest_status ? { ingest_status: row.ingest_status } : {}),
    ...(row.ultimateParent ? { ultimateParent: row.ultimateParent } : {}),
    ...(row.ultimate_parent ? { ultimate_parent: row.ultimate_parent } : {}),
    ...(row.parent_entity ? { parent_entity: row.parent_entity } : {}),
    ...(row.acquirerUltimateParent ? { acquirerUltimateParent: row.acquirerUltimateParent } : {}),
    ...(row.acquirer_ultimate_parent ? { acquirer_ultimate_parent: row.acquirer_ultimate_parent } : {}),
    ...(row.acquirer_display ? { acquirer_display: row.acquirer_display } : {}),
    ...(row.target_display ? { target_display: row.target_display } : {}),
    ...(row.target_entity ? { target_entity: row.target_entity } : {}),
    ...(row.advisors_v2 ? { advisors_v2: row.advisors_v2 } : {}),
    ...(row.advisors ? { advisors: row.advisors } : {}),
    ...(row.deal_facts ? { deal_facts: row.deal_facts } : {}),
    ...(row.merger_form ? { merger_form: row.merger_form } : {}),
    ...(row.headlineConsiderationType ? { headlineConsiderationType: row.headlineConsiderationType } : {}),
    ...(row.headline_consideration_type ? { headline_consideration_type: row.headline_consideration_type } : {}),
    ...(row.considerationType ? { considerationType: row.considerationType } : {}),
    ...(row.consideration_type ? { consideration_type: row.consideration_type } : {}),
  };

  return {
    id: row.id,
    acquirer: row.acquirer,
    target: row.target,
    value_usd: row.value_usd,
    announce_date: row.announce_date,
    sector: row.sector,
    created_at: row.created_at,
    created_by: row.created_by,
    metadata,
  };
}

module.exports = { DEAL_HEADER_SELECT, headerRowToDeal };
