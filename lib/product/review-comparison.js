'use strict';

// Maps a lawyer's V1 review items (comments and decisions on one-sentence
// facts) onto V2 layered facts from a rerun of the same agreement, so a lead
// can check whether each V1 finding is addressed. Pure functions; no
// database or model access. Contract: contracts/product/fact-components.v2.json.

const { walk, renderHeadline } = require('./fact-components');

function mergeRanges(ranges) {
  const sorted = ranges
    .filter(([start, end]) => Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function totalBytes(ranges) {
  return ranges.reduce((sum, [start, end]) => sum + (end - start), 0);
}

function overlapBytes(rangesA, rangesB) {
  let total = 0;
  for (const [aStart, aEnd] of rangesA) {
    for (const [bStart, bEnd] of rangesB) {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      if (end > start) total += end - start;
    }
  }
  return total;
}

function citedRanges(item, spansById) {
  const ids = (item.original && item.original.source_span_ids) || [];
  const ranges = ids
    .map((id) => spansById[id])
    .filter(Boolean)
    .map((span) => [span.start_byte, span.end_byte]);
  return mergeRanges(ranges);
}

// Own components of a fact, at every depth, that carry a byte range.
function ownComponents(fact) {
  return [...walk(fact.components || [])]
    .map(([component]) => component)
    .filter((component) => component.origin === 'OWN'
      && Number.isSafeInteger(component.start_byte)
      && Number.isSafeInteger(component.end_byte));
}

function matchFactToItem(fact, itemRanges, citedTotal) {
  const own = ownComponents(fact);
  const mergedOwn = mergeRanges(own.map((component) => [component.start_byte, component.end_byte]));
  const overlap = overlapBytes(itemRanges, mergedOwn);
  const matchedComponents = own
    .filter((component) => overlapBytes(itemRanges, [[component.start_byte, component.end_byte]]) > 0)
    .map((component) => component.component_id);
  return {
    fact_id: fact.fact_id,
    headline_text: renderHeadline(fact),
    overlap_bytes: overlap,
    overlap_share: citedTotal > 0 ? overlap / citedTotal : 0,
    matched_components: matchedComponents,
  };
}

function statusForShare(share) {
  if (share >= 0.5) return 'MATCHED';
  if (share > 0) return 'PARTIAL';
  return 'UNMATCHED';
}

// Splits a section reference like "3.16" into alternating digit/non-digit
// parts so "3.2" sorts before "3.16" (plain string sort would not).
function naturalParts(value) {
  return String(value || '').match(/\d+|\D+/g) || [];
}

function naturalCompare(a, b) {
  const partsA = naturalParts(a);
  const partsB = naturalParts(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i += 1) {
    const partA = partsA[i] ?? '';
    const partB = partsB[i] ?? '';
    if (partA === partB) continue;
    const numA = /^\d+$/.test(partA) ? Number(partA) : null;
    const numB = /^\d+$/.test(partB) ? Number(partB) : null;
    if (numA !== null && numB !== null) return numA - numB;
    return partA < partB ? -1 : 1;
  }
  return 0;
}

// compareReviewItems({ v1Items, v1Spans, v2Facts }) -> [{ v1_item_id,
// section_reference, comment, decision, v1_statement, matches, status }]
//
// Only items with a comment or a non-PENDING decision are included.
// Candidate V2 facts are those sharing the item's structure_node_id when any
// do; otherwise every V2 fact is a candidate (byte overlap alone decides).
// Matches with zero overlap are dropped from the result's `matches` list.
function compareReviewItems({ v1Items, v1Spans, v2Facts }) {
  const spansById = v1Spans || {};
  const facts = v2Facts || [];
  const reviewed = (v1Items || []).filter((item) => {
    const hasComment = typeof item.comment === 'string' && item.comment.trim().length > 0;
    const hasDecision = item.decision && item.decision !== 'PENDING';
    return hasComment || hasDecision;
  });

  const results = reviewed.map((item) => {
    const itemRanges = citedRanges(item, spansById);
    const citedTotal = totalBytes(itemRanges);
    const sameNode = item.structure_node_id
      ? facts.filter((fact) => fact.structure_node_id === item.structure_node_id)
      : [];
    const candidates = sameNode.length ? sameNode : facts;
    const matches = candidates
      .map((fact) => matchFactToItem(fact, itemRanges, citedTotal))
      .filter((match) => match.overlap_bytes > 0)
      .sort((a, b) => (b.overlap_share - a.overlap_share) || a.fact_id.localeCompare(b.fact_id));
    const bestShare = matches.length ? matches[0].overlap_share : 0;
    return {
      v1_item_id: item.item_id,
      section_reference: item.section_reference,
      comment: item.comment || null,
      decision: item.decision,
      v1_statement: item.edited_statement || (item.original && item.original.statement) || '',
      matches,
      status: statusForShare(bestShare),
    };
  });

  return results.sort((a, b) => (
    naturalCompare(a.section_reference, b.section_reference)
    || (a.v1_statement < b.v1_statement ? -1 : a.v1_statement > b.v1_statement ? 1 : 0)
  ));
}

// summariseComparison(results) -> { byStatus, bySection, unmatched }
function summariseComparison(results) {
  const byStatus = { MATCHED: 0, PARTIAL: 0, UNMATCHED: 0 };
  const bySection = {};
  const unmatched = [];
  for (const result of results) {
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;
    const section = result.section_reference || '(no section)';
    if (!bySection[section]) bySection[section] = { MATCHED: 0, PARTIAL: 0, UNMATCHED: 0 };
    bySection[section][result.status] += 1;
    if (result.status === 'UNMATCHED') unmatched.push(result);
  }
  return { byStatus, bySection, unmatched };
}

module.exports = { compareReviewItems, summariseComparison };
