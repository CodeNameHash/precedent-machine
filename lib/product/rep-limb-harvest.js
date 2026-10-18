'use strict';

// Q5 (plan, Ben 2026-09-13 21:25 UTC): "Canonical limb names for the other
// eighteen representations ... harvest the row_detail values the extractor
// produced per representation across those runs, cluster them, and put a
// proposed canonical list per representation to Ben in one note for his
// decision". Decision 31 (Ben, on the Organization sub-items): "are these
// items in Term canonical and being used across all deals? They need to be
// so they can be compared". Ben decides the names; the code only proposes.
//
// Pure functions over a run's proposal rows: harvest the representation
// readouts (table representations-qualifiers-table and its Parent twin),
// cluster the row_detail values per representation row by the words they
// share, and propose one canonical name per cluster (an existing
// detail_labels_by_row label when the cluster holds one, else the most used
// member). Nothing here changes contracts/product/table-shapes.v3.json.

const REPRESENTATION_TABLES = Object.freeze(['representations-qualifiers-table', 'parent-representations-qualifiers-table']);

// Words that say nothing about which limb a name is.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'from', 'into',
  'is', 'are', 'be', 'been', 'has', 'have', 'its', 'their', 'that', 'this', 'such', 'any', 'all', 'each',
  'no', 'not', 'none', 'other', 'than', 'under', 'per', 'respect', 'regarding', 'relating', 'related', 'applicable',
  'company', 'companys', 'parent', 'parents', 'merger', 'sub', 'subs',
  // A materiality qualifier names the standard, not the limb.
  'material', 'materially', 'materiality',
]);

// Words that mark a limb's scope: two names that differ on one of these
// are different limbs however alike their other words (the seeded list
// keeps "Subsidiaries: due organization ..." apart from the Company's own).
const SCOPE_WORDS = new Set(['subsidiari']);

// The likeness two names need to be one limb. 0.6 keeps "Securities law
// filings exception" apart from "Exception: HSR Act and Foreign Merger
// Control Law filings" (0.56) and folds "No Tax sharing or indemnity
// agreements" with "No Tax sharing, Tax allocation or Tax indemnification
// agreements" (0.79), read on Metsera generation 8 and NCS generations 4
// and 5.
const DEFAULT_THRESHOLD = 0.6;

// A small stemmer, applied until nothing changes: plurals, -ly, -ing,
// -ed, the -ation/-ization/-ification families, -ence/-ance, -ity, -ness
// and a trailing -al, with a doubled final consonant collapsed, so that
// "qualified"/"qualification", "filings"/"filing", "organizational"/
// "organization"/"organized" and "valid"/"validly" share a stem without a
// dictionary.
const STEM_RULES = [
  ['izations', 'iz', 5], ['ization', 'iz', 5], ['ifications', 'ifi', 5], ['ification', 'ifi', 5],
  ['ations', '', 5], ['ation', '', 5], ['ences', '', 5], ['ence', '', 5], ['ances', '', 5], ['ance', '', 5],
  ['ities', '', 5], ['ity', '', 5], ['ness', '', 4], ['ings', '', 5], ['ing', '', 4], ['ies', 'i', 4], ['ied', 'i', 4],
  ['ly', '', 4], ['ed', '', 4], ['es', '', 3], ['s', '', 3], ['al', '', 5], ['iz', '', 5],
];
function stemOnce(word) {
  for (const [suffix, replacement, minimum] of STEM_RULES) {
    if (word.length > minimum && word.endsWith(suffix)) {
      if (suffix === 'es' && word.endsWith('ses')) continue;
      if (suffix === 's' && word.endsWith('ss')) continue;
      return `${word.slice(0, -suffix.length)}${replacement}`;
    }
  }
  return word;
}
function stem(word) {
  let w = word;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = stemOnce(w);
    if (next === w) break;
    w = next;
  }
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && !/[aeiou]/.test(w[w.length - 1])) w = w.slice(0, -1);
  return w;
}

function tokens(text) {
  const raw = String(text || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!raw) return [];
  return raw.split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => stem(word))
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function tokenSet(text) {
  return new Set(tokens(text));
}

// A name's scope: a "Scope: rest" prefix as the extractor writes one
// ("Subsidiaries: ...", "Non-U.S. Benefit Plans: ...", "Transaction
// effect: ...") or a scope word anywhere in it. Two names of different
// scopes are different limbs; likeness is read on the rest.
function splitScope(name) {
  const match = String(name || '').match(/^([^:]{2,60}):\s+(.+)$/);
  if (match) return { scope: tokens(match[1]).sort().join('+'), rest: match[2] };
  const set = tokenSet(name);
  return { scope: [...set].filter((token) => SCOPE_WORDS.has(token)).sort().join('+'), rest: name };
}

// Tokens most of a row's names carry ("tax" under Taxes, "plan" under
// ERISA) say which row a name is on, not which limb; they are left out of
// the likeness when the row has enough names to tell (ten or more, the
// token in more than three of them and in more than three in ten).
function commonTokens(sets, { share = 0.3, minimumNames = 10, minimumCount = 4 } = {}) {
  const counts = new Map();
  for (const set of sets) for (const token of set) counts.set(token, (counts.get(token) || 0) + 1);
  const common = new Set();
  if (sets.length < minimumNames) return common;
  for (const [token, count] of counts) if (count >= minimumCount && count / sets.length > share) common.add(token);
  return common;
}

function withoutCommon(set, common) {
  const kept = new Set([...set].filter((token) => !common.has(token)));
  return kept.size ? kept : set;
}

// Two names' likeness: half the share of their union they both carry
// (Jaccard), half the share of the shorter one the longer carries
// (containment), so "Taxes paid or accrued" sits with "All taxes paid or
// accrued when due" and "No default" does not sit with "Validity and
// enforceability".
function similarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = a.size + b.size - shared;
  const jaccard = shared / union;
  const containment = shared / Math.min(a.size, b.size);
  return 0.5 * jaccard + 0.5 * containment;
}

// The representation readouts of a run's proposals:
// { run_id, proposal_id, section_reference, table_key, row_label,
//   row_detail (null for a whole-row fact), summary, subtype_key,
//   validation_status }.
function harvestRepresentationReadouts(run, { sectionReferences = new Map() } = {}) {
  const out = [];
  for (const row of run.tables.product_proposals || []) {
    const conclusions = row.payload?.conclusions;
    if (!conclusions || !REPRESENTATION_TABLES.includes(conclusions.table_key)) continue;
    const detail = typeof conclusions.row_detail === 'string' && conclusions.row_detail.trim() ? conclusions.row_detail.trim() : null;
    out.push({
      run_id: run.run_id,
      proposal_id: row.proposal_id,
      section_reference: sectionReferences.get(row.structure_node_id) || null,
      table_key: conclusions.table_key,
      row_label: typeof conclusions.row_label === 'string' ? conclusions.row_label.trim() : '',
      row_detail: detail,
      summary: row.payload?.headline?.summary || null,
      subtype_key: row.subtype_key || null,
      validation_status: row.validation_status || null,
    });
  }
  return out;
}

// Groups the readouts of several runs by table and row label, then clusters
// each row's detail names. `existingLabels` is detail_labels_by_row from the
// table shape (row label -> canonical names already decided).
function clusterRowDetails(readouts, { existingLabels = {}, threshold = DEFAULT_THRESHOLD } = {}) {
  const byName = new Map();
  for (const readout of readouts) {
    if (!readout.row_detail) continue;
    const entry = byName.get(readout.row_detail) || { name: readout.row_detail, ...splitScope(readout.row_detail), readouts: [] };
    entry.readouts.push(readout);
    byName.set(readout.row_detail, entry);
  }
  const common = commonTokens([...byName.values()].map((entry) => tokenSet(entry.rest)));
  for (const entry of byName.values()) entry.set = withoutCommon(tokenSet(entry.rest), common);
  const existing = new Set(existingLabels || []);
  // Names in use order: the most used first, then the shortest, so the
  // cluster a name joins is anchored on the name the extractor repeated.
  const names = [...byName.values()].sort((a, b) => b.readouts.length - a.readouts.length
    || a.set.size - b.set.size || a.name.localeCompare(b.name));
  const clusters = [];
  for (const entry of names) {
    const { scope } = entry;
    let best = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      if (cluster.scope !== scope) continue;
      // A name that is already canonical anchors its own cluster: two
      // canonical names never merge.
      if (existing.has(entry.name) && cluster.members.some((member) => existing.has(member.name))) continue;
      // Two different names the extractor gave in one run to facts of one
      // section are two limbs of that section, not one limb named twice.
      if (cluster.members.some((member) => sharesRunAndSection(member, entry))) continue;
      let score = 0;
      for (const member of cluster.members) score = Math.max(score, similarity(entry.set, member.set));
      if (score > bestScore) { bestScore = score; best = cluster; }
    }
    if (best && bestScore >= threshold) best.members.push(entry);
    else clusters.push({ scope, members: [entry] });
  }
  return clusters.map((cluster) => describeCluster(cluster, existing));
}

function sharesRunAndSection(a, b) {
  const places = new Set(a.readouts.map((readout) => `${readout.run_id}\u0000${readout.section_reference || ''}`));
  return b.readouts.some((readout) => places.has(`${readout.run_id}\u0000${readout.section_reference || ''}`));
}

function describeCluster(cluster, existing) {
  const members = cluster.members.map((member) => ({
    name: member.name,
    count: member.readouts.length,
    runs: [...new Set(member.readouts.map((readout) => readout.run_id))].sort(),
    existing: existing.has(member.name),
    readouts: member.readouts,
  }));
  const canonical = members.find((member) => member.existing);
  const proposed = canonical || members[0];
  const runs = [...new Set(members.flatMap((member) => member.runs))].sort();
  const count = members.reduce((sum, member) => sum + member.count, 0);
  return {
    proposed_name: proposed.name,
    proposed_from: canonical ? 'EXISTING_CANONICAL' : members.length > 1 ? 'MOST_USED_MEMBER' : 'SINGLE_NAME',
    count,
    runs,
    members,
  };
}

// The whole proposal: per table and row label, the clusters, the whole-row
// facts and the reuse figures that show whether names repeat across runs.
function proposeCanonicalLimbs({ runs, tableShapes, sectionReferencesByRun = new Map(), threshold = DEFAULT_THRESHOLD }) {
  const readouts = runs.flatMap((run) => harvestRepresentationReadouts(run, { sectionReferences: sectionReferencesByRun.get(run.run_id) || new Map() }));
  const shapeTables = new Map();
  for (const section of tableShapes?.sections || []) {
    for (const table of section.tables || []) shapeTables.set(table.table_key, table);
  }
  const byTableRow = new Map();
  for (const readout of readouts) {
    const key = `${readout.table_key}\u0000${readout.row_label}`;
    if (!byTableRow.has(key)) byTableRow.set(key, []);
    byTableRow.get(key).push(readout);
  }
  const rows = [];
  for (const [key, rowReadouts] of byTableRow) {
    const [tableKey, rowLabel] = key.split('\u0000');
    const table = shapeTables.get(tableKey) || {};
    const existingLabels = table.detail_labels_by_row?.[rowLabel] || [];
    const fixedRow = (table.fixed_row_labels || []).includes(rowLabel);
    const detailed = rowReadouts.filter((readout) => readout.row_detail);
    const clusters = clusterRowDetails(detailed, { existingLabels, threshold });
    const runsHere = [...new Set(rowReadouts.map((readout) => readout.run_id))].sort();
    const distinctNames = new Set(detailed.map((readout) => readout.row_detail));
    const namesInSeveralRuns = [...distinctNames].filter((name) => new Set(detailed.filter((readout) => readout.row_detail === name).map((readout) => readout.run_id)).size > 1);
    const namesInExisting = [...distinctNames].filter((name) => existingLabels.includes(name));
    rows.push({
      table_key: tableKey,
      row_label: rowLabel,
      fixed_row: fixedRow,
      existing_labels: existingLabels,
      facts: rowReadouts.length,
      facts_with_detail: detailed.length,
      whole_row_facts: rowReadouts.filter((readout) => !readout.row_detail),
      distinct_names: distinctNames.size,
      names_in_several_runs: namesInSeveralRuns.length,
      names_already_canonical: namesInExisting.length,
      runs: runsHere,
      clusters: clusters.sort((a, b) => b.count - a.count || a.proposed_name.localeCompare(b.proposed_name)),
    });
  }
  rows.sort((a, b) => a.table_key.localeCompare(b.table_key) || b.facts - a.facts || a.row_label.localeCompare(b.row_label));
  const totals = {
    readouts: readouts.length,
    with_detail: readouts.filter((readout) => readout.row_detail).length,
    rows: rows.length,
    distinct_names: rows.reduce((sum, row) => sum + row.distinct_names, 0),
    names_in_several_runs: rows.reduce((sum, row) => sum + row.names_in_several_runs, 0),
    names_already_canonical: rows.reduce((sum, row) => sum + row.names_already_canonical, 0),
    clusters: rows.reduce((sum, row) => sum + row.clusters.length, 0),
    clusters_of_several_names: rows.reduce((sum, row) => sum + row.clusters.filter((cluster) => cluster.members.length > 1).length, 0),
  };
  return { threshold, rows, totals };
}

module.exports = {
  DEFAULT_THRESHOLD,
  REPRESENTATION_TABLES,
  clusterRowDetails,
  harvestRepresentationReadouts,
  proposeCanonicalLimbs,
  similarity,
  stem,
  tokens,
};
