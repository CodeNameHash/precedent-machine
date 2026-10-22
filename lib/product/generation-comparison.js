'use strict';

// Phase 6, "Compare the rendered V1 and V2 result. Explain differences
// rather than requiring false equality" (plan section 6). Two generations
// of one agreement, the earlier under LEGAL_SCHEMA/V1 (one-sentence facts
// with roles) and the later under LEGAL_SCHEMA/V2 (a headline over a tree
// of verbatim components, laid out as tables), compared by section and by
// table on the one thing both share: the agreement's bytes. A V1 fact and
// a V2 fact are counterparts when the bytes the V1 fact cites overlap the
// V2 fact's own component spans (the rule lib/product/review-comparison.js
// uses for a lawyer's V1 review items). Every difference is named with its
// reason (a family routed in one generation only, a fact held by V2's
// validation, a fact new to V2, a V1 fact with no counterpart), never
// asserted away. Pure functions; no database or model access.

const { buildTableView } = require('./table-view');
const { walk } = require('./fact-components');

const MATCH_SHARE = 0.5;

function mergeRanges(ranges) {
  const sorted = ranges
    .filter(([start, end]) => Number.isSafeInteger(start) && Number.isSafeInteger(end) && end > start)
    .sort((left, right) => left[0] - right[0]);
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

function overlapBytes(left, right) {
  let total = 0;
  for (const [aStart, aEnd] of left) {
    for (const [bStart, bEnd] of right) {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      if (end > start) total += end - start;
    }
  }
  return total;
}

function spanRanges(spanIds, spansById) {
  return mergeRanges((spanIds || []).map((id) => spansById.get(id)).filter(Boolean)
    .map((span) => [Number(span.start_byte), Number(span.end_byte)]));
}

// A V2 fact's own words: its OWN components at every depth with bytes;
// the cited spans when the tree carries no bytes.
function factRanges(fact, spansById) {
  const own = Array.isArray(fact.components)
    ? [...walk(fact.components)].map(([component]) => component)
      .filter((component) => (component.origin === 'OWN' || !component.origin)
        && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
      .map((component) => [component.start_byte, component.end_byte])
    : [];
  if (own.length) return mergeRanges(own);
  return spanRanges(fact.source_span_ids, spansById);
}

function statusForShare(share) {
  if (share >= MATCH_SHARE) return 'MATCHED';
  if (share > 0) return 'PARTIAL';
  return 'UNMATCHED';
}

// Plan finding (199g), work package E14: the matcher's rule. A stored
// covenant's OWN component bytes are mostly the chapeau words the proposal
// repeats (the actor, the consent standard, the exceptions), so a live
// fact that cites the whole chapeau scored MATCHED on a stored fact whose
// limb it never cites (NCS 5.1: the equity-award covenant matched the Tax
// covenant on the default rung) while live facts citing fragments scored
// PARTIAL on facts they do state. Now a stored fact is scored on its bytes
// outside the section's chapeau span when any remain (the limb's own
// words; a chapeau-only fact keeps all its bytes), and a live fact matches
// one stored fact at most, the best shares assigned first.
function rangesOutside(ranges, excluded) {
  let current = mergeRanges(ranges);
  for (const [exStart, exEnd] of mergeRanges(excluded)) {
    const next = [];
    for (const [start, end] of current) {
      if (exEnd <= start || exStart >= end) { next.push([start, end]); continue; }
      if (start < exStart) next.push([start, exStart]);
      if (exEnd < end) next.push([exEnd, end]);
    }
    current = next;
  }
  return current;
}

function scoredRanges(ranges, chapeauRanges = []) {
  const merged = mergeRanges(ranges);
  if (!chapeauRanges || chapeauRanges.length === 0) return merged;
  const outside = rangesOutside(merged, chapeauRanges);
  return outside.length ? outside : merged;
}

// The section's own chapeau span (kind CHAPEAU on the node) as byte ranges.
function chapeauRangesOf(spans, nodeId = null) {
  return mergeRanges([...(spans || [])].filter((span) => span && span.kind === 'CHAPEAU' && (!nodeId || span.structure_node_id === nodeId))
    .map((span) => [Number(span.start_byte), Number(span.end_byte)]));
}

// `stored` and `candidates` are [{ id, ranges }]. Returns the candidates
// of every stored fact by share (on the stored fact's scored bytes) and
// the assignment: best share first, each candidate once when `exclusive`
// (the rule), every stored fact its best candidate when not (the old rule,
// kept for the re-score).
function matchFacts({ stored, candidates, chapeauRanges = [], exclusive = true }) {
  const scored = stored.map((fact) => {
    const ranges = scoredRanges(fact.ranges || [], chapeauRanges);
    return { id: fact.id, ranges, bytes: totalBytes(ranges) };
  });
  const shares = new Map();
  const scoredBytes = new Map();
  const pairs = [];
  scored.forEach((fact, storedIndex) => {
    const list = [];
    scoredBytes.set(fact.id, fact.bytes);
    candidates.forEach((candidate, candidateIndex) => {
      if (fact.bytes === 0 || !Array.isArray(candidate.ranges) || candidate.ranges.length === 0) return;
      const overlap = overlapBytes(fact.ranges, candidate.ranges);
      if (overlap <= 0) return;
      const share = overlap / fact.bytes;
      // The candidate's side of the pair: how much of its own bytes the
      // stored fact covers. It breaks ties between stored facts a wide
      // live fact covers whole (a LIST component quoted from its first
      // element to its last spans every sub-limb between them).
      const candidateBytes = totalBytes(candidate.ranges);
      const reverse = candidateBytes > 0 ? overlap / candidateBytes : 0;
      list.push({ id: candidate.id, share, overlap_bytes: overlap, reverse_share: reverse });
      pairs.push({ storedIndex, candidateIndex, storedId: fact.id, candidateId: candidate.id, share, reverse });
    });
    list.sort((left, right) => right.share - left.share || String(left.id).localeCompare(String(right.id)));
    shares.set(fact.id, list);
  });
  pairs.sort((left, right) => right.share - left.share || right.reverse - left.reverse || left.storedIndex - right.storedIndex || left.candidateIndex - right.candidateIndex);
  const assigned = new Map();
  const taken = new Set();
  for (const pair of pairs) {
    if (assigned.has(pair.storedId)) continue;
    if (exclusive && taken.has(pair.candidateId)) continue;
    assigned.set(pair.storedId, { id: pair.candidateId, share: pair.share });
    taken.add(pair.candidateId);
  }
  return { assigned, shares, scored_bytes: scoredBytes };
}

function naturalCompare(left, right) {
  const partsA = String(left || '').match(/\d+|\D+/g) || [];
  const partsB = String(right || '').match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const a = partsA[i] ?? ''; const b = partsB[i] ?? '';
    if (a === b) continue;
    const numA = /^\d+$/.test(a) ? Number(a) : null; const numB = /^\d+$/.test(b) ? Number(b) : null;
    if (numA !== null && numB !== null) return numA - numB;
    return a < b ? -1 : 1;
  }
  return 0;
}

function isValid(fact) { return fact.validation_status === 'VALID'; }

// The V2 fact as a reader meets it: the headline's one-line summary when
// the generation wrote one (prompt V9 onward), else the fact's own
// top-level words in source order under its label.
function headlineText(fact) {
  const headline = fact.headline || {};
  if (headline.summary) return headline.summary;
  const own = (fact.components || []).filter((component) => component && (component.origin === 'OWN' || !component.origin) && component.text)
    .sort((left, right) => (left.start_byte ?? 0) - (right.start_byte ?? 0)).map((component) => component.text.trim());
  if (own.length) return `${headline.label ? `${headline.label}: ` : ''}${own.join(' … ')}`;
  return headline.label || fact.statement || '';
}

function countBy(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return counts;
}

function sortedEntries(counts) {
  return Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

// The issue codes behind each proposal: an issue names a proposal on its
// proposal_id or anywhere in its message (a DUPLICATE_FACT_OCCURRENCE
// issue lists its candidates' proposal ids in the message JSON).
function issuesByProposal(analysis) {
  const proposalIds = new Set((analysis.proposals || []).map((fact) => fact.proposal_id));
  const map = new Map();
  const add = (proposalId, code) => {
    if (!proposalIds.has(proposalId)) return;
    if (!map.has(proposalId)) map.set(proposalId, []);
    if (!map.get(proposalId).includes(code)) map.get(proposalId).push(code);
  };
  for (const issue of analysis.issues || []) {
    if (issue.proposal_id) add(issue.proposal_id, issue.code);
    for (const id of String(issue.message || '').match(/[0-9a-f]{64}/g) || []) add(id, issue.code);
  }
  return map;
}

function coverageByFamily(analysis, nodeId) {
  const states = new Map();
  for (const assertion of analysis.coverage_assertions || []) {
    if (assertion.structure_node_id !== nodeId || !assertion.family_key) continue;
    if (!['FAMILY', 'FACT_TYPE'].includes(assertion.subject_kind)) continue;
    if (!states.has(assertion.family_key)) states.set(assertion.family_key, new Set());
    states.get(assertion.family_key).add(assertion.state);
  }
  return new Map([...states].map(([family, set]) => [family, [...set].sort()]));
}

function reviewedItems(review) {
  return (review?.state?.items || []).filter((item) => ['PROPOSAL', 'USER_FACT'].includes(item.kind)
    && ((item.decision && item.decision !== 'PENDING') || (typeof item.comment === 'string' && item.comment.trim())
      || (Array.isArray(item.comments) && item.comments.length > 0)));
}

function reviewNote(item) {
  const comments = [
    ...(typeof item.comment === 'string' && item.comment.trim() ? [item.comment.trim()] : []),
    ...(Array.isArray(item.comments) ? item.comments.map((entry) => (typeof entry === 'string' ? entry : entry?.text || entry?.comment || '')).filter(Boolean) : []),
  ];
  return { decision: item.decision, comments, edited_statement: item.edited_statement || null };
}

function runSummary(analysis) {
  const proposals = analysis.proposals || [];
  const valid = proposals.filter(isValid);
  return {
    run_id: analysis.analysis_run_id,
    legal_schema_version: analysis.legal_schema_version || null,
    sections: (analysis.sections || []).length,
    sections_with_families: (analysis.sections || []).filter((section) => (section.families || []).length > 0).length,
    proposals: proposals.length,
    valid: valid.length,
    held: proposals.length - valid.length,
    families: countBy(valid.map((fact) => fact.family_key)),
    layered: valid.filter((fact) => Array.isArray(fact.components) && fact.components.length > 0).length,
  };
}

function tableFact(fact, sectionReference) {
  return { ...fact, fact_id: fact.proposal_id, section_reference: sectionReference };
}

// compareGenerations({ v1: { analysis, review }, v2: { analysis, review }, tableShapes, legalSchema }) -> model
function compareGenerations({ v1, v2, tableShapes = null, legalSchema = null } = {}) {
  if (!v1?.analysis || !v2?.analysis) throw new TypeError('v1.analysis and v2.analysis are required');
  const v1Spans = new Map((v1.analysis.spans || []).map((span) => [span.span_id, span]));
  const v2Spans = new Map((v2.analysis.spans || []).map((span) => [span.span_id, span]));
  const nodes = new Map();
  for (const source of [v2.analysis, v1.analysis]) {
    for (const node of source.agreement_structure?.nodes || []) if (!nodes.has(node.node_id)) nodes.set(node.node_id, node);
  }
  const v1Routing = new Map((v1.analysis.sections || []).map((section) => [section.structure_node_id, section]));
  const v2Routing = new Map((v2.analysis.sections || []).map((section) => [section.structure_node_id, section]));
  const nodeIds = [...new Set([...v1Routing.keys(), ...v2Routing.keys()])];
  const order = (nodeId) => {
    const node = nodes.get(nodeId);
    return Number.isFinite(node?.authored_order) ? node.authored_order : Number.MAX_SAFE_INTEGER;
  };
  nodeIds.sort((left, right) => order(left) - order(right) || naturalCompare(nodes.get(left)?.reference, nodes.get(right)?.reference));
  const referenceOf = (nodeId) => nodes.get(nodeId)?.reference || v2Routing.get(nodeId)?.section_reference || v1Routing.get(nodeId)?.section_reference || nodeId.slice(0, 8);

  const v1ByNode = new Map();
  for (const fact of v1.analysis.proposals || []) {
    if (!v1ByNode.has(fact.structure_node_id)) v1ByNode.set(fact.structure_node_id, []);
    v1ByNode.get(fact.structure_node_id).push(fact);
  }
  const v2ByNode = new Map();
  for (const fact of v2.analysis.proposals || []) {
    if (!v2ByNode.has(fact.structure_node_id)) v2ByNode.set(fact.structure_node_id, []);
    v2ByNode.get(fact.structure_node_id).push(fact);
  }
  const v2Issues = issuesByProposal(v2.analysis);
  const v1Issues = issuesByProposal(v1.analysis);
  const v1Notes = new Map(reviewedItems(v1.review).map((item) => [item.source_id, reviewNote(item)]));
  const v2Notes = new Map(reviewedItems(v2.review).map((item) => [item.source_id, reviewNote(item)]));

  const counterpartsOfV2 = new Map(); // v2 proposal id -> [{ v1_id, share }]
  const sections = [];
  const totals = { v1_valid: 0, v2_valid: 0, v1_matched: 0, v1_partial: 0, v1_unmatched: 0, v1_unmatched_held_in_v2: 0, v2_new: 0, v2_held: 0, v1_held: 0, routing_same: 0, routing_differs: 0 };
  for (const nodeId of nodeIds) {
    const routingV1 = v1Routing.get(nodeId) || null;
    const routingV2 = v2Routing.get(nodeId) || null;
    const familiesV1 = [...(routingV1?.families || [])].sort();
    const familiesV2 = [...(routingV2?.families || [])].sort();
    const added = familiesV2.filter((family) => !familiesV1.includes(family));
    const dropped = familiesV1.filter((family) => !familiesV2.includes(family));
    const routing = {
      v1: routingV1 ? { disposition: routingV1.disposition, families: familiesV1 } : null,
      v2: routingV2 ? { disposition: routingV2.disposition, families: familiesV2, widened: routingV2.widened_families || [] } : null,
      added, dropped,
      same: added.length === 0 && dropped.length === 0 && (routingV1?.disposition || null) === (routingV2?.disposition || null),
    };
    if (routing.same) totals.routing_same += 1; else totals.routing_differs += 1;

    const v1Facts = v1ByNode.get(nodeId) || [];
    const v2Facts = v2ByNode.get(nodeId) || [];
    const v2Valid = v2Facts.filter(isValid).map((fact) => ({ fact, ranges: factRanges(fact, v2Spans) }));
    const v2Held = v2Facts.filter((fact) => !isValid(fact)).map((fact) => ({ fact, ranges: factRanges(fact, v2Spans) }));
    const matchedV2 = new Set();
    const pairs = [];
    // Plan finding (199g): the section's chapeau bytes are not scored when
    // a fact has other bytes, and a V2 fact is the counterpart of one V1
    // fact at most; a V1 fact V1 itself held takes no counterpart.
    const chapeauRanges = chapeauRangesOf([...v1Spans.values(), ...v2Spans.values()], nodeId);
    const v1Ranges = new Map(v1Facts.map((fact) => [fact.proposal_id, spanRanges(fact.source_span_ids, v1Spans)]));
    const v2ById = new Map(v2Valid.map(({ fact }) => [fact.proposal_id, fact]));
    const matching = matchFacts({
      stored: v1Facts.filter(isValid).map((fact) => ({ id: fact.proposal_id, ranges: v1Ranges.get(fact.proposal_id) })),
      candidates: v2Valid.map(({ fact, ranges }) => ({ id: fact.proposal_id, ranges })),
      chapeauRanges,
    });
    const heldShares = matchFacts({
      stored: v1Facts.filter((fact) => !isValid(fact)).map((fact) => ({ id: fact.proposal_id, ranges: v1Ranges.get(fact.proposal_id) })),
      candidates: v2Valid.map(({ fact, ranges }) => ({ id: fact.proposal_id, ranges })),
      chapeauRanges, exclusive: false,
    });
    for (const fact of v1Facts) {
      const ranges = v1Ranges.get(fact.proposal_id);
      const cited = totalBytes(ranges);
      const scoredBytesOfFact = scoredRanges(ranges, chapeauRanges);
      const candidates = ((isValid(fact) ? matching : heldShares).shares.get(fact.proposal_id) || []).map((entry) => {
        const candidate = v2ById.get(entry.id);
        return { v2_id: candidate.proposal_id, family_key: candidate.family_key, subtype_key: candidate.subtype_key, headline: headlineText(candidate), overlap_bytes: entry.overlap_bytes, share: entry.share };
      });
      const heldMatches = v2Held.map(({ fact: candidate, ranges: candidateRanges }) => ({
        v2_id: candidate.proposal_id, headline: headlineText(candidate), codes: v2Issues.get(candidate.proposal_id) || [],
        share: totalBytes(scoredBytesOfFact) > 0 ? overlapBytes(scoredBytesOfFact, candidateRanges) / totalBytes(scoredBytesOfFact) : 0,
      })).filter((candidate) => candidate.share > 0).sort((left, right) => right.share - left.share);
      const assigned = isValid(fact) ? matching.assigned.get(fact.proposal_id) || null : null;
      const status = isValid(fact) ? statusForShare(assigned ? assigned.share : 0) : 'HELD_IN_V1';
      for (const candidate of candidates) {
        matchedV2.add(candidate.v2_id);
        // A V1 fact V1 itself held is no counterpart of anything.
        if (status === 'HELD_IN_V1') continue;
        if (!counterpartsOfV2.has(candidate.v2_id)) counterpartsOfV2.set(candidate.v2_id, []);
        counterpartsOfV2.get(candidate.v2_id).push({ v1_id: fact.proposal_id, statement: fact.statement, family_key: fact.family_key, subtype_key: fact.subtype_key, share: candidate.share, status });
      }
      pairs.push({
        v1_id: fact.proposal_id, family_key: fact.family_key, subtype_key: fact.subtype_key, fact_type: fact.fact_type,
        statement: fact.statement, cited_bytes: cited, scored_bytes: totalBytes(scoredBytesOfFact), status, counterpart: assigned ? assigned.id : null, matches: candidates,
        held_in_v2: status === 'UNMATCHED' ? heldMatches : [],
        v1_issues: v1Issues.get(fact.proposal_id) || [],
        review: v1Notes.get(fact.proposal_id) || null,
      });
      if (isValid(fact)) {
        totals.v1_valid += 1;
        if (status === 'MATCHED') totals.v1_matched += 1;
        else if (status === 'PARTIAL') totals.v1_partial += 1;
        else { totals.v1_unmatched += 1; if (heldMatches.length) totals.v1_unmatched_held_in_v2 += 1; }
      } else totals.v1_held += 1;
    }
    const v2Only = v2Valid.filter(({ fact }) => !matchedV2.has(fact.proposal_id)).map(({ fact }) => ({
      v2_id: fact.proposal_id, family_key: fact.family_key, subtype_key: fact.subtype_key, headline: headlineText(fact), review: v2Notes.get(fact.proposal_id) || null,
    }));
    totals.v2_valid += v2Valid.length;
    totals.v2_new += v2Only.length;
    totals.v2_held += v2Held.length;
    const coverageV1 = coverageByFamily(v1.analysis, nodeId);
    const coverageV2 = coverageByFamily(v2.analysis, nodeId);
    const coverageDifferences = [];
    for (const family of new Set([...coverageV1.keys(), ...coverageV2.keys()])) {
      const left = (coverageV1.get(family) || []).join('/') || 'not asserted';
      const right = (coverageV2.get(family) || []).join('/') || 'not asserted';
      if (left !== right) coverageDifferences.push({ family_key: family, v1: left, v2: right });
    }
    const explanation = [];
    if (!routingV1) explanation.push('section analysed in V2 only');
    else if (!routingV2) explanation.push('section analysed in V1 only');
    else if (added.length || dropped.length) explanation.push(`routing differs: ${added.length ? `V2 adds ${added.join(', ')}` : ''}${added.length && dropped.length ? '; ' : ''}${dropped.length ? `V2 drops ${dropped.join(', ')}` : ''}${routing.v2.widened.length ? ` (widened by code: ${routing.v2.widened.join(', ')})` : ''}`);
    else if (routingV1.disposition !== routingV2.disposition) explanation.push(`disposition ${routingV1.disposition} in V1, ${routingV2.disposition} in V2`);
    const validPairs = pairs.filter((pair) => pair.status !== 'HELD_IN_V1');
    if (validPairs.length || v2Valid.length) {
      const matched = validPairs.filter((pair) => pair.status === 'MATCHED').length;
      const partial = validPairs.filter((pair) => pair.status === 'PARTIAL').length;
      const unmatched = validPairs.filter((pair) => pair.status === 'UNMATCHED');
      explanation.push(`${validPairs.length} V1 facts: ${matched} with a V2 counterpart, ${partial} partial, ${unmatched.length} without${unmatched.length ? ` (${unmatched.filter((pair) => pair.held_in_v2.length).length} of them overlap a fact V2 held)` : ''}; ${v2Valid.length} V2 facts, ${v2Only.length} new to V2${v2Held.length ? `; ${v2Held.length} V2 facts held (${sortedEntries(countBy(v2Held.flatMap(({ fact }) => v2Issues.get(fact.proposal_id) || ['no issue code']))).map(([code, count]) => `${code} ${count}`).join(', ')})` : ''}`);
    }
    if (coverageDifferences.length) explanation.push(`coverage differs for ${coverageDifferences.map((entry) => `${entry.family_key} (${entry.v1} in V1, ${entry.v2} in V2)`).join('; ')}`);
    sections.push({
      node_id: nodeId, reference: referenceOf(nodeId), title: nodes.get(nodeId)?.title || null,
      routing, coverage_differences: coverageDifferences,
      v1: { facts: v1Facts.length, valid: v1Facts.filter(isValid).length },
      v2: { facts: v2Facts.length, valid: v2Valid.length, held: v2Held.length },
      pairs, v2_only: v2Only,
      v2_held: v2Held.map(({ fact }) => ({ v2_id: fact.proposal_id, family_key: fact.family_key, headline: headlineText(fact), codes: v2Issues.get(fact.proposal_id) || [] })),
      explanation,
    });
  }

  // By family: counts on both sides and the V1 facts each family keeps.
  const familyKeys = new Set([...(v1.analysis.proposals || []).map((fact) => fact.family_key), ...(v2.analysis.proposals || []).map((fact) => fact.family_key)]);
  const families = [...familyKeys].sort().map((familyKey) => {
    const pairsOfFamily = sections.flatMap((section) => section.pairs.filter((pair) => pair.family_key === familyKey && pair.status !== 'HELD_IN_V1'));
    const v2Facts = (v2.analysis.proposals || []).filter((fact) => fact.family_key === familyKey);
    return {
      family_key: familyKey,
      v1_valid: pairsOfFamily.length,
      v1_matched: pairsOfFamily.filter((pair) => pair.status === 'MATCHED').length,
      v1_partial: pairsOfFamily.filter((pair) => pair.status === 'PARTIAL').length,
      v1_unmatched: pairsOfFamily.filter((pair) => pair.status === 'UNMATCHED').length,
      v2_valid: v2Facts.filter(isValid).length,
      v2_held: v2Facts.filter((fact) => !isValid(fact)).length,
      v2_new: sections.reduce((sum, section) => sum + section.v2_only.filter((entry) => entry.family_key === familyKey).length, 0),
      v1_subtypes: countBy(pairsOfFamily.map((pair) => pair.subtype_key)),
      v2_subtypes: countBy(v2Facts.filter(isValid).map((fact) => fact.subtype_key)),
    };
  });

  // By table: V2's tables (the page's own layout) with each row's V1
  // counterparts; a V1 fact of the table's families with no V2 counterpart
  // is listed under the table as absent from it.
  let tables = null;
  if (tableShapes) {
    const sectionReference = new Map(sections.map((section) => [section.node_id, section.reference]));
    const facts = (v2.analysis.proposals || []).filter(isValid).map((fact) => tableFact(fact, sectionReference.get(fact.structure_node_id) || null));
    const view = buildTableView({ facts, heldFacts: [], tableShapes, legalSchema });
    const v1Pairs = new Map(sections.flatMap((section) => section.pairs.map((pair) => [pair.v1_id, { ...pair, reference: section.reference }])));
    const counterpartsOf = (factId) => (counterpartsOfV2.get(factId) || []).map((entry) => ({ ...entry, reference: v1Pairs.get(entry.v1_id)?.reference || null }));
    tables = view.sections.map((section) => {
      const familiesOfSection = new Set((tableShapes.sections || []).find((shape) => shape.section_key === section.section_key)?.v2_family_keys?.map((entry) => entry.key) || []);
      const placedFactIds = new Set();
      const sectionTables = section.tables.map((table) => {
        const rows = table.rows.map((row) => {
          const backing = [...row.backing_facts, ...(row.sub_rows || []).flatMap((subRow) => subRow.backing_facts)];
          for (const entry of backing) placedFactIds.add(entry.fact_id);
          return {
            subject: row.subject, absent: row.absent === true,
            v2_facts: backing.map((entry) => ({ fact_id: entry.fact_id, section_reference: entry.section_reference })),
            v1_counterparts: backing.flatMap((entry) => counterpartsOf(entry.fact_id)),
          };
        });
        const others = (table.other_provisions || []).flatMap((group) => (group.facts || group.entries || []).map((entry) => entry.fact_id || entry)).filter(Boolean);
        for (const factId of others) placedFactIds.add(factId);
        return { table_key: table.table_key, rows, other_provisions: others.length };
      });
      const withoutReadout = (section.facts_without_readout || []).map((entry) => {
        placedFactIds.add(entry.fact_id);
        return { fact_id: entry.fact_id, section_reference: entry.section_reference, headline: entry.headline, v1_counterparts: counterpartsOf(entry.fact_id) };
      });
      const v1Absent = [...v1Pairs.values()].filter((pair) => familiesOfSection.has(pair.family_key) && pair.status === 'UNMATCHED');
      return {
        section_key: section.section_key, title: section.title, families: [...familiesOfSection],
        tables: sectionTables, facts_without_readout: withoutReadout,
        v1_without_v2_counterpart: v1Absent.map((pair) => ({ v1_id: pair.v1_id, reference: pair.reference, statement: pair.statement, subtype_key: pair.subtype_key, held_in_v2: pair.held_in_v2 })),
      };
    });
  }

  // A family with V1 facts whose table section V2 never filled: those V1
  // facts appear in no table at all, so the by-table part names them.
  let familiesWithoutTable = null;
  if (tables) {
    const familiesShown = new Set(tables.flatMap((section) => section.families));
    familiesWithoutTable = families.filter((family) => family.v1_valid > 0 && !familiesShown.has(family.family_key))
      .map((family) => ({ family_key: family.family_key, v1_valid: family.v1_valid, v1_unmatched: family.v1_unmatched, v2_valid: family.v2_valid, v2_held: family.v2_held }));
  }

  return {
    schema_version: 'PRODUCT_GENERATION_COMPARISON/V1',
    agreement: v2.analysis.source_document?.retrieval_url || v1.analysis.source_document?.retrieval_url || null,
    structure_shared: v1.analysis.agreement_structure?.structure_id && v1.analysis.agreement_structure?.structure_id === v2.analysis.agreement_structure?.structure_id,
    runs: { v1: runSummary(v1.analysis), v2: runSummary(v2.analysis) },
    v1_review_notes: v1Notes.size,
    totals,
    families,
    sections,
    tables,
    families_without_table: familiesWithoutTable,
  };
}

// A long statement keeps its head and its tail: a V1 representation opens
// with the same exception chapeau every time, and the words that tell the
// facts apart come last.
function clip(text, max = 160) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const tail = Math.floor(max / 3);
  return `${flat.slice(0, max - tail - 3)} … ${flat.slice(-tail)}`;
}

function pct(share) { return `${Math.round(share * 100)}%`; }

function renderGenerationComparison(model) {
  const lines = [];
  const { runs, totals } = model;
  lines.push(`# V1 to V2 generation comparison${model.agreement ? `: ${model.agreement}` : ''}`, '');
  lines.push(`V1: run ${runs.v1.run_id} (${runs.v1.legal_schema_version || 'schema unknown'}). V2: run ${runs.v2.run_id} (${runs.v2.legal_schema_version || 'schema unknown'}). ${model.structure_shared ? 'Both generations share one agreement structure, so sections correspond node for node.' : 'The two generations have different agreement structures; sections are matched by reference.'}`, '');
  lines.push('## Summary', '');
  lines.push('| Measure | V1 | V2 |', '| --- | --- | --- |');
  lines.push(`| Sections routed to a family | ${runs.v1.sections_with_families} of ${runs.v1.sections} | ${runs.v2.sections_with_families} of ${runs.v2.sections} |`);
  lines.push(`| Proposed facts | ${runs.v1.proposals} | ${runs.v2.proposals} |`);
  lines.push(`| Valid facts | ${runs.v1.valid} | ${runs.v2.valid} |`);
  lines.push(`| Held by validation | ${runs.v1.held} | ${runs.v2.held} |`);
  lines.push(`| Facts with a component tree | ${runs.v1.layered} | ${runs.v2.layered} |`, '');
  lines.push('| V1 valid facts | Count |', '| --- | --- |');
  lines.push(`| With a V2 counterpart (half or more of the cited bytes) | ${totals.v1_matched} |`);
  lines.push(`| Partial counterpart (some cited bytes) | ${totals.v1_partial} |`);
  lines.push(`| No V2 counterpart | ${totals.v1_unmatched} |`);
  lines.push(`| ... of which overlap a fact V2 held | ${totals.v1_unmatched_held_in_v2} |`, '');
  lines.push(`V2 valid facts with no V1 counterpart (new to V2): ${totals.v2_new} of ${totals.v2_valid}. Sections whose routing is the same in both: ${totals.routing_same}; differs: ${totals.routing_differs}.${model.v1_review_notes ? ` The V1 review carries ${model.v1_review_notes} decided or commented items; each is shown beside its V1 fact below.` : ''}`, '');
  lines.push('## Why the two results differ', '');
  lines.push('- The schemas differ by design: a V1 fact is one sentence with roles; a V2 fact is a headline over a tree of verbatim components with byte spans, laid out as coded tables. Counterparts are found on the shared bytes, not on wording.');
  lines.push('- A section routed to more families in V2 (the routing widening by code and the V2 schema\'s subtypes) yields facts V1 never asked for; a section routed to fewer yields facts V1 had and V2 does not.');
  lines.push('- A V2 fact held by validation (an unresolved component span, an invented role, an invalid tree) is not shown; a V1 fact over the same bytes then has no visible counterpart. The held fact and its code are listed under the section.');
  lines.push('- The V2 tables place only facts carrying a readout; a V2 fact without one is listed under its section as evidence without a readout, with its V1 counterparts.', '');

  lines.push('## By family', '');
  lines.push('| Family | V1 valid | matched | partial | unmatched | V2 valid | V2 held | new to V2 |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const family of model.families) {
    lines.push(`| ${family.family_key} | ${family.v1_valid} | ${family.v1_matched} | ${family.v1_partial} | ${family.v1_unmatched} | ${family.v2_valid} | ${family.v2_held} | ${family.v2_new} |`);
  }
  lines.push('');
  const subtypeShifts = model.families.filter((family) => family.v1_valid && family.v2_valid);
  if (subtypeShifts.length) {
    lines.push('Subtypes used (V1 then V2):', '');
    for (const family of subtypeShifts) {
      lines.push(`- ${family.family_key}: ${sortedEntries(family.v1_subtypes).map(([key, count]) => `${key} ${count}`).join(', ') || 'none'} → ${sortedEntries(family.v2_subtypes).map(([key, count]) => `${key} ${count}`).join(', ') || 'none'}`);
    }
    lines.push('');
  }

  lines.push('## By section', '');
  for (const section of model.sections) {
    const hasContent = section.pairs.length || section.v2_only.length || section.v2_held.length || !section.routing.same || section.coverage_differences.length;
    if (!hasContent) continue;
    lines.push(`### ${section.reference}${section.title ? ` ${clip(section.title, 80)}` : ''}`, '');
    const routingLine = (side) => (side ? `${side.disposition}${side.families.length ? ` (${side.families.join(', ')})` : ''}` : 'not analysed');
    lines.push(`Routing: V1 ${routingLine(section.routing.v1)}; V2 ${routingLine(section.routing.v2)}. V1 ${section.v1.valid} valid of ${section.v1.facts}; V2 ${section.v2.valid} valid of ${section.v2.facts}${section.v2.held ? `, ${section.v2.held} held` : ''}.`);
    for (const line of section.explanation) lines.push(`- ${line}`);
    lines.push('');
    for (const pair of section.pairs) {
      const best = pair.matches[0];
      const tail = pair.status === 'HELD_IN_V1'
        ? `held in V1${pair.v1_issues.length ? ` (${pair.v1_issues.join(', ')})` : ''}`
        : best ? `${pair.status} ${pct(best.share)}: "${clip(best.headline)}" [${best.family_key}/${best.subtype_key}]${pair.matches.length > 1 ? ` (+${pair.matches.length - 1} more)` : ''}`
          : pair.held_in_v2.length ? `UNMATCHED; V2 held "${clip(pair.held_in_v2[0].headline)}" over these bytes (${pair.held_in_v2[0].codes.join(', ') || 'no issue code'})`
            : 'UNMATCHED: no V2 fact over these bytes';
      lines.push(`- V1 [${pair.family_key}/${pair.subtype_key}] "${clip(pair.statement)}" → ${tail}`);
      if (pair.review) {
        const note = pair.review;
        lines.push(`  - V1 review: ${note.decision}${note.edited_statement ? `, edited to "${clip(note.edited_statement)}"` : ''}${note.comments.length ? `; ${note.comments.map((comment) => `"${clip(comment, 200)}"`).join(' ')}` : ''}`);
      }
    }
    for (const entry of section.v2_only) {
      lines.push(`- V2 only [${entry.family_key}/${entry.subtype_key}] "${clip(entry.headline)}"${entry.review ? ` (V2 review: ${entry.review.decision}${entry.review.comments.length ? `; "${clip(entry.review.comments[0], 200)}"` : ''})` : ''}`);
    }
    for (const entry of section.v2_held) {
      lines.push(`- V2 held [${entry.family_key}] "${clip(entry.headline)}" (${entry.codes.join(', ') || 'no issue code'})`);
    }
    lines.push('');
  }

  if (model.tables) {
    lines.push('## By table', '');
    if (model.tables.length === 0) lines.push('No V2 fact resolves to a table (no readouts in this generation), so the page shows lists, not tables.', '');
    for (const section of model.tables) {
      lines.push(`### ${section.title} (${section.families.join(', ') || 'no family'})`, '');
      for (const table of section.tables) {
        lines.push(`${table.table_key}: ${table.rows.length} rows${table.other_provisions ? `, ${table.other_provisions} other provisions` : ''}`);
        for (const row of table.rows) {
          if (row.absent) { lines.push(`- ${row.subject}: absent`); continue; }
          // One V1 counterpart per V1 fact, the strongest first, at most
          // three shown; a row backed by seventy facts names its count.
          const byV1 = new Map();
          for (const entry of row.v1_counterparts) {
            const prior = byV1.get(entry.v1_id);
            if (!prior || entry.share > prior.share) byV1.set(entry.v1_id, entry);
          }
          const strongest = [...byV1.values()].sort((left, right) => right.share - left.share);
          const counterparts = strongest.length
            ? `${strongest.length} V1 facts: ${strongest.slice(0, 3).map((entry) => `${entry.reference ? `${entry.reference} ` : ''}"${clip(entry.statement, 110)}" (${entry.status} ${pct(entry.share)})`).join('; ')}${strongest.length > 3 ? `; +${strongest.length - 3} more` : ''}`
            : 'no V1 counterpart';
          lines.push(`- ${row.subject} (${row.v2_facts.length} V2 facts, ${[...new Set(row.v2_facts.map((fact) => fact.section_reference).filter(Boolean))].join(', ') || 'no reference'}) ← V1: ${counterparts}`);
        }
      }
      if (section.facts_without_readout.length) {
        lines.push(`Evidence without a readout: ${section.facts_without_readout.length} V2 facts; ${section.facts_without_readout.filter((entry) => entry.v1_counterparts.length).length} with a V1 counterpart.`);
      }
      if (section.v1_without_v2_counterpart.length) {
        lines.push(`V1 facts of these families with no V2 counterpart: ${section.v1_without_v2_counterpart.length}`);
        for (const entry of section.v1_without_v2_counterpart.slice(0, 20)) {
          lines.push(`- ${entry.reference || '?'} [${entry.subtype_key}] "${clip(entry.statement, 120)}"${entry.held_in_v2.length ? ` (V2 held a fact over these bytes: ${entry.held_in_v2[0].codes.join(', ')})` : ''}`);
        }
        if (section.v1_without_v2_counterpart.length > 20) lines.push(`- … and ${section.v1_without_v2_counterpart.length - 20} more`);
      }
      lines.push('');
    }
    if (model.families_without_table?.length) {
      lines.push('Families with V1 facts and no V2 table:', '');
      for (const family of model.families_without_table) {
        lines.push(`- ${family.family_key}: ${family.v1_valid} V1 facts (${family.v1_unmatched} without a V2 counterpart); V2 ${family.v2_valid} valid, ${family.v2_held} held`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

module.exports = { MATCH_SHARE, chapeauRangesOf, compareGenerations, factRanges, matchFacts, mergeRanges, overlapBytes, rangesOutside, renderGenerationComparison, scoredRanges, spanRanges, statusForShare, totalBytes };
