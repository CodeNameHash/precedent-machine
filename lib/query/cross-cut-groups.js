// r13 item 2 (Ben, NOSOL results grouping — "all intervening event matters
// together"): PROVISION_CROSS_CUT renders one column per requested field,
// flat, in whatever order the payload asked for them. For a field-dense
// family like no-solicitation that reads as a wall of unrelated columns —
// this groups them under ordered, Ben-facing headings instead.
//
// Deliberately a per-provision-type map (GROUP_SPECS) with only the NOSOL
// family populated today, so another provision type can get its own spec
// later without touching the grouping mechanics below. Provision types with
// no spec fall back to a single ungrouped bucket (heading: null), so the
// page's existing flat rendering is unchanged for everything else.
//
// Pulled into a plain-Node module (rather than left inline in the JSX page)
// so the group-assignment logic can be unit-tested without a React runtime
// — same split as lib/query/result-title.js.

// Ordered first-match-wins list of {heading, test(fieldKey) -> boolean}.
// Order matters: interveningEventStandard deliberately matches "Fiduciary
// out" (rule 2) before "Intervening event" (rule 3) — it's a
// change-of-recommendation standard, not the event definition itself.
const NOSOL_GROUPS = [
  { heading: 'No-shop scope', test: /prohibited|noShop|solicit|standstill|privateWaiver/i },
  { heading: 'Fiduciary out', test: /fiduciary|interveningEventStandard|changeRec|adverseRec|boardRec/i },
  { heading: 'Intervening event', test: /interveningEvent/i },
  { heading: 'Superior proposal & match rights', test: /superior|matching|matchRight|topping|lastLook/i },
  { heading: 'Force the vote', test: /forceTheVote/i },
  { heading: 'Notice & information', test: /notice|notif|information|consult/i },
  { heading: 'Enforcement & remedies', test: /standstill|specificPerformance|breach/i },
  { heading: 'Other terms', test: /.*/ },
];

// provision_type values that count as the "no-solicitation family" on the
// query surface. Today that's a single COVENANT_NO_SOLICITATION type (party
// scope rides the appliesToParty field instead — see
// lib/query/filter-labels.js's PROVISION_TYPE_LABELS comment) but NOSOL-B/
// NOSOL-M are listed defensively in case those ever surface as distinct
// query-surface provision_type keys.
const NOSOL_PROVISION_TYPES = new Set(['COVENANT_NO_SOLICITATION', 'NOSOL-B', 'NOSOL-M']);

const GROUP_SPECS = {
  COVENANT_NO_SOLICITATION: NOSOL_GROUPS,
  'NOSOL-B': NOSOL_GROUPS,
  'NOSOL-M': NOSOL_GROUPS,
};

function groupSpecFor(provisionType) {
  return GROUP_SPECS[provisionType] || null;
}

function assignGroup(fieldKey, spec) {
  const key = String(fieldKey || '');
  for (const group of spec) {
    if (group.test.test(key)) return group.heading;
  }
  return 'Other terms';
}

/**
 * groupColumnsForCrossCut(provisionType, columns) -> [{ heading, columns }]
 *
 * `columns` is PROVISION_CROSS_CUT's result.columns (each `{ field, label,
 * ... }`). Returns an ordered array of non-empty groups, each carrying the
 * subset of `columns` (in their original relative order) assigned to it.
 * When `provisionType` has no group spec, returns a single group with
 * `heading: null` and every column — i.e. today's flat rendering,
 * unchanged.
 */
function groupColumnsForCrossCut(provisionType, columns) {
  const cols = columns || [];
  const spec = groupSpecFor(provisionType);
  if (!spec) return cols.length ? [{ heading: null, columns: cols }] : [];

  const byHeading = new Map();
  for (const group of spec) byHeading.set(group.heading, []);
  for (const col of cols) {
    const heading = assignGroup(col.field, spec);
    byHeading.get(heading).push(col);
  }
  return spec
    .map((group) => ({ heading: group.heading, columns: byHeading.get(group.heading) }))
    .filter((group) => group.columns.length > 0);
}

module.exports = { groupColumnsForCrossCut, NOSOL_PROVISION_TYPES };
