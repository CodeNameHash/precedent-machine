'use strict';

// Plan finding (192), the fresh sheet's row 7 (Ben's Apollo 13 brief,
// finding (177)): the extraction answer as one JSON object per line
// instead of one JSON object. A capped answer (NCS generation 5, 5.1: three
// attempts past the 64,000-token cap, $9.29 and 47 call-minutes, finding
// (180)) then keeps every whole line the model wrote; the reader drops the
// broken last line, the trailer (coverage) when the cut came before it, and
// says so; the draft asks a continuation call for the words after the cut.
//
// The lines, in order: one `{"line":"proposal",...}` per fact in source
// order, then `{"line":"group",...}` and `{"line":"link",...}` lines, then
// one `{"line":"coverage", coverage, fact_type_coverage, coverage_reason,
// ...}` trailer carrying every other top-level field of the object answer.
// A line without `line` is read by its fields (fact_type: a proposal;
// subtype_key without fact_type: a group; from_ref and to_ref: a link;
// coverage: the trailer).

const LINE_KINDS = Object.freeze(['proposal', 'group', 'link', 'cross_section_link', 'coverage']);

const FACT_LINES_INSTRUCTION = 'Write the answer as JSON Lines, not as one JSON object: one compact JSON object per line and nothing else on the line. First one line per proposal in source order, each {"line":"proposal", ...the proposal object of the contract}; then one line per group {"line":"group", ...} and per link {"line":"link", ...} and per cross-section link {"line":"cross_section_link", ...}; last, exactly one line {"line":"coverage", "coverage": {...}, "fact_type_coverage": {...}, "coverage_reason": {...}} carrying every other field the contract names (paragraph_dispositions when asked). Never nest the proposals in an array; never write a line that is not a whole JSON object. If the output is cut short, every whole line before the cut is kept and the words after it are asked for again, so write facts in the order of the words and finish each line before starting the next.';

function isFactLinesRequest(request) {
  return Boolean(request && typeof request === 'object' && request.answer_mode === 'lines');
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function lineKind(item) {
  if (typeof item.line === 'string' && LINE_KINDS.includes(item.line)) return item.line;
  if (typeof item.fact_type === 'string') return 'proposal';
  if (typeof item.subtype_key === 'string' && item.fact_type === undefined && item.from_ref === undefined) return 'group';
  if (item.from_ref !== undefined && item.to_ref !== undefined) return 'link';
  if (item.from_ref !== undefined && item.to_section_reference !== undefined) return 'cross_section_link';
  if (plainObject(item.coverage) || plainObject(item.fact_type_coverage) || Array.isArray(item.paragraph_dispositions)) return 'coverage';
  return null;
}

function stripLine(item) {
  const { line: _line, ...rest } = item;
  return rest;
}

// Reads the lines. `truncated` says the provider reported the cap (the last
// line may be broken and the trailer missing). Returns the object answer the
// compiler reads and the reading's counts.
function readFactLines(text, { truncated = false } = {}) {
  const raw = String(text || '').replace(/^```(?:json|jsonl|ndjson)?\s*/i, '').replace(/\s*```\s*$/, '');
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const response = { proposals: [], groups: [], links: [], cross_section_links: [] };
  const counts = { lines: lines.length, kept: 0, malformed: 0, unreadable: 0, truncated: truncated === true, trailer: false, broken_last_line: false };
  lines.forEach((line, index) => {
    let item;
    try {
      item = JSON.parse(line);
    } catch {
      if (index === lines.length - 1 && truncated) counts.broken_last_line = true;
      else counts.malformed += 1;
      return;
    }
    if (!plainObject(item)) { counts.malformed += 1; return; }
    const kind = lineKind(item);
    if (kind === null) { counts.unreadable += 1; return; }
    counts.kept += 1;
    const body = stripLine(item);
    if (kind === 'proposal') response.proposals.push(body);
    else if (kind === 'group') response.groups.push(body);
    else if (kind === 'link') response.links.push(body);
    else if (kind === 'cross_section_link') response.cross_section_links.push(body);
    else {
      counts.trailer = true;
      for (const [key, value] of Object.entries(body)) {
        if (['proposals', 'groups', 'links', 'cross_section_links'].includes(key)) {
          if (Array.isArray(value)) response[key].push(...value);
        } else {
          response[key] = value;
        }
      }
    }
  });
  // A group the proposals name that no group line wrote (the cut came
  // before the group lines): the group is the proposals' own words.
  const written = new Set(response.groups.map((group) => group && group.client_ref));
  for (const proposal of response.proposals) {
    if (!plainObject(proposal) || typeof proposal.group_ref !== 'string' || written.has(proposal.group_ref)) continue;
    if (typeof proposal.family_key !== 'string' || typeof proposal.subtype_key !== 'string') continue;
    response.groups.push({ client_ref: proposal.group_ref, family_key: proposal.family_key, subtype_key: proposal.subtype_key });
    written.add(proposal.group_ref);
    counts.groups_derived = (counts.groups_derived || 0) + 1;
  }
  if (response.cross_section_links.length === 0) delete response.cross_section_links;
  response.answer_lines = counts;
  return { response, lines: counts };
}

module.exports = { FACT_LINES_INSTRUCTION, LINE_KINDS, isFactLinesRequest, lineKind, readFactLines };
