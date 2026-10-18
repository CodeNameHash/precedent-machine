'use strict';

// Finding (66)'s open item: the draft-level REQUIRED_FACT_TYPE_UNRESOLVED
// issues (51 on Metsera generation 8). lib/product/agreement-draft.js
// familyCoverage writes one per required fact type whose section-level
// FACT_TYPE assertion is UNRESOLVED in any section, so the issue names the
// fact type and nothing else: not the section, not why, not whether another
// section carries the fact. This module reads the stored rows back to the
// sections and the cause, says whether the fact type is carried VALID
// elsewhere, and gives each fact type a verdict: bookkeeping (a held fact
// the lawyer decides, or an answer the model gave against its own facts) or
// a gap in what was extracted. Pure functions over a run's rows
// (lib/product/run-rows.js). Ben: "everything to be driven by coding and not
// just a layer on top so all edits need to be repeatable across corpus".

const DRAFT_ISSUE_CODE = 'REQUIRED_FACT_TYPE_UNRESOLVED';

const CAUSES = Object.freeze({
  SECTION_NOT_EXTRACTED: 'SECTION_NOT_EXTRACTED', // SOURCE_CLOSURE_INCOMPLETE: the runner never asked the model for the section's facts
  HELD_PROPOSAL: 'HELD_PROPOSAL', // a proposal of the fact type is held INVALID in the section
  MODEL_SAID_FOUND_NO_FACT: 'MODEL_SAID_FOUND_NO_FACT', // the model answered FOUND and returned no valid fact of the type
  MODEL_SAID_NOT_FOUND_WITH_FACT: 'MODEL_SAID_NOT_FOUND_WITH_FACT', // the model answered NOT_FOUND beside a fact of the type
  MODEL_SAID_UNRESOLVED: 'MODEL_SAID_UNRESOLVED', // the model answered UNRESOLVED itself
  MODEL_OMITTED_ANSWER: 'MODEL_OMITTED_ANSWER', // the model's answer had no entry for the fact type
  ROUTED_WITHOUT_ANSWER: 'ROUTED_WITHOUT_ANSWER', // the family was routed and no FACT_TYPE assertion was written
  MODEL_ANSWER_NOT_READ: 'MODEL_ANSWER_NOT_READ', // the extraction call is not among the rows read
});

const VERDICTS = Object.freeze({
  BOOKKEEPING_HELD: 'BOOKKEEPING_HELD', // every unresolved section holds a proposal of the type; the lawyer's decision on it resolves the state
  BOOKKEEPING_MODEL_ANSWER: 'BOOKKEEPING_MODEL_ANSWER', // the model's coverage answer disagrees with its own facts; the facts stand
  SECTION_GAP: 'SECTION_GAP', // a routed section was never extracted; its content is missing whatever other sections carry
  EXTRACTION_GAP: 'EXTRACTION_GAP', // the model said FOUND and gave nothing, or answered UNRESOLVED, and no valid fact of the type exists anywhere
  MIXED: 'MIXED',
});

function factTypeOfAssertion(assertion) {
  const reason = assertion.payload?.reason || '';
  const match = reason.match(/^FACT_TYPE:(.+)$/);
  return match ? match[1] : null;
}

function issueCode(issue) {
  return issue.payload?.code || issue.code || null;
}

function issueMessage(issue) {
  return issue.payload?.message ?? issue.message ?? null;
}

// The model's coverage answer per family and fact type from a stored
// extraction call: the JSON object the CLI or API returned, carried as the
// text of the first content block. A call whose text does not parse, or has
// no fact_type_coverage, yields null.
function parseModelAnswer(call) {
  const text = call?.response?.content?.[0]?.text;
  if (typeof text !== 'string') return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    // The answer may carry words around the JSON object; take the outermost braces.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (inner) {
      return null;
    }
  }
}

function groupBy(rows, keyOf) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (key == null) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function parseJsonMessage(message) {
  if (typeof message !== 'string') return null;
  try { return JSON.parse(message); } catch (error) { return null; }
}

// analyseUnresolvedFactTypes(run, { sectionReferences }) -> {
//   draft_issue_fact_types: [{ family_key, fact_type }],
//   fact_types: [{ family_key, fact_type, in_draft_issue, sections: [{ section_reference, cause, detail }],
//                  valid_elsewhere: [{ section_reference, count }], valid_here_total, verdict }],
//   sections_not_extracted: [{ section_reference, families, unresolved_references, cross_scope_references }],
//   summary: { by_cause, by_verdict, draft_issues, fact_types_unresolved, carried_elsewhere, nowhere } }
function analyseUnresolvedFactTypes(run, { sectionReferences = new Map() } = {}) {
  const tables = run.tables || {};
  const issues = tables.product_issues || [];
  const assertions = tables.product_coverage_assertions || [];
  const proposals = tables.product_proposals || [];
  const calls = tables.product_model_calls || [];
  const routings = tables.product_section_routings || [];
  const reference = (nodeId) => sectionReferences.get(nodeId) || (nodeId ? nodeId.slice(0, 8) : '(draft)');

  const draftIssues = issues.filter((issue) => issue.structure_node_id == null && issueCode(issue) === DRAFT_ISSUE_CODE);
  const draftIssueKeys = new Set(draftIssues.map((issue) => `${issue.family_key}\u0000${issueMessage(issue)}`));

  const issuesByNode = groupBy(issues.filter((issue) => issue.structure_node_id), (issue) => issue.structure_node_id);
  const proposalsByNode = groupBy(proposals, (proposal) => proposal.structure_node_id);
  const callsByNode = groupBy(calls.filter((call) => call.call_kind === 'EXTRACTION'), (call) => call.structure_node_id);
  const validByFactType = groupBy(proposals.filter((proposal) => proposal.validation_status === 'VALID'), (proposal) => `${proposal.family_key}\u0000${proposal.fact_type}`);

  const unresolved = assertions.filter((assertion) => assertion.subject_kind === 'FACT_TYPE' && assertion.state === 'UNRESOLVED');
  const byFactType = groupBy(unresolved, (assertion) => `${assertion.family_key}\u0000${factTypeOfAssertion(assertion)}`);

  const sectionsNotExtracted = new Map();
  const factTypes = [];
  for (const [key, group] of byFactType) {
    const [familyKey, factType] = key.split('\u0000');
    const sections = [];
    for (const assertion of group) {
      const nodeId = assertion.structure_node_id;
      const nodeIssues = issuesByNode.get(nodeId) || [];
      const nodeProposals = (proposalsByNode.get(nodeId) || []).filter((proposal) => proposal.family_key === familyKey && proposal.fact_type === factType);
      const held = nodeProposals.filter((proposal) => proposal.validation_status !== 'VALID');
      const valid = nodeProposals.filter((proposal) => proposal.validation_status === 'VALID');
      const closureIssue = nodeIssues.find((issue) => issueCode(issue) === 'SOURCE_CLOSURE_INCOMPLETE');
      const omission = nodeIssues.find((issue) => issueCode(issue) === 'MODEL_COVERAGE_OMISSION'
        && String(issueMessage(issue) || '').includes(`fact_type_coverage.${familyKey}.${factType}`));
      let cause;
      let detail = null;
      if (closureIssue) {
        cause = CAUSES.SECTION_NOT_EXTRACTED;
        const diagnostics = parseJsonMessage(issueMessage(closureIssue)) || {};
        detail = {
          unresolved_references: diagnostics.unresolved_section_references || [],
          cross_scope_references: (diagnostics.cross_scope_section_references || []).map((entry) => `${entry.reference} (${entry.from_scope} -> ${entry.to_scope})`),
        };
        if (!sectionsNotExtracted.has(nodeId)) {
          const routing = routings.find((row) => row.structure_node_id === nodeId);
          sectionsNotExtracted.set(nodeId, {
            section_reference: reference(nodeId),
            families: routing?.families || [...new Set(group.filter((item) => item.structure_node_id === nodeId).map((item) => item.family_key))],
            routing_rationale: routing?.payload?.rationale || null,
            unresolved_references: detail.unresolved_references,
            cross_scope_references: detail.cross_scope_references,
            unusual_provisions: nodeIssues.filter((issue) => issueCode(issue) === 'UNRESOLVED_UNUSUAL_PROVISION').map((issue) => issueMessage(issue)),
          });
        }
      } else if (held.length) {
        cause = CAUSES.HELD_PROPOSAL;
        const heldIds = new Set(held.map((proposal) => proposal.proposal_id));
        const holdCodes = [...new Set(nodeIssues.filter((issue) => heldIds.has(issue.proposal_id)).map((issue) => issueCode(issue)))].sort();
        detail = {
          held: held.length,
          valid: valid.length,
          // The held proposals' own issues; when none names a proposal, the
          // section's issue codes, marked as the section's.
          hold_codes: holdCodes.length ? holdCodes : [...new Set(nodeIssues.map((issue) => `section:${issueCode(issue)}`))].sort(),
        };
      } else if (omission) {
        cause = CAUSES.MODEL_OMITTED_ANSWER;
      } else if (!assertion.model_call_id) {
        cause = CAUSES.ROUTED_WITHOUT_ANSWER;
      } else {
        const nodeCalls = callsByNode.get(nodeId) || [];
        if (!nodeCalls.length) {
          cause = CAUSES.MODEL_ANSWER_NOT_READ;
        } else {
          const answers = nodeCalls.map((call) => parseModelAnswer(call)?.fact_type_coverage?.[familyKey]?.[factType]).filter((answer) => answer !== undefined);
          const answer = answers.includes('UNRESOLVED') ? 'UNRESOLVED' : answers.includes('FOUND') ? 'FOUND' : answers.includes('NOT_FOUND') ? 'NOT_FOUND' : null;
          detail = { model_answers: answers, valid: valid.length };
          if (answer === null) cause = CAUSES.MODEL_OMITTED_ANSWER;
          else if (answer === 'UNRESOLVED') cause = CAUSES.MODEL_SAID_UNRESOLVED;
          else if (answer === 'FOUND' && valid.length === 0) cause = CAUSES.MODEL_SAID_FOUND_NO_FACT;
          else if (answer === 'NOT_FOUND' && nodeProposals.length > 0) cause = CAUSES.MODEL_SAID_NOT_FOUND_WITH_FACT;
          else cause = CAUSES.MODEL_SAID_UNRESOLVED;
        }
      }
      sections.push({ structure_node_id: nodeId, section_reference: reference(nodeId), cause, detail });
    }
    sections.sort((a, b) => a.section_reference.localeCompare(b.section_reference, undefined, { numeric: true }));
    const unresolvedNodes = new Set(sections.map((section) => section.structure_node_id));
    const validElsewhere = [...groupBy((validByFactType.get(key) || []).filter((proposal) => !unresolvedNodes.has(proposal.structure_node_id)), (proposal) => proposal.structure_node_id)]
      .map(([nodeId, rows]) => ({ section_reference: reference(nodeId), count: rows.length }))
      .sort((a, b) => a.section_reference.localeCompare(b.section_reference, undefined, { numeric: true }));
    const validHere = (validByFactType.get(key) || []).filter((proposal) => unresolvedNodes.has(proposal.structure_node_id)).length;
    factTypes.push({
      family_key: familyKey,
      fact_type: factType,
      in_draft_issue: draftIssueKeys.has(key),
      sections,
      valid_elsewhere: validElsewhere,
      valid_in_unresolved_sections: validHere,
      verdict: verdictFor(sections, validElsewhere, validHere),
    });
  }
  factTypes.sort((a, b) => a.family_key.localeCompare(b.family_key) || a.fact_type.localeCompare(b.fact_type));

  const byCause = {};
  const byVerdict = {};
  for (const entry of factTypes) {
    byVerdict[entry.verdict] = (byVerdict[entry.verdict] || 0) + 1;
    for (const section of entry.sections) byCause[section.cause] = (byCause[section.cause] || 0) + 1;
  }
  const draftIssueFactTypes = draftIssues.map((issue) => ({ family_key: issue.family_key, fact_type: issueMessage(issue) }))
    .sort((a, b) => a.family_key.localeCompare(b.family_key) || String(a.fact_type).localeCompare(String(b.fact_type)));
  const analysedKeys = new Set(factTypes.map((entry) => `${entry.family_key}\u0000${entry.fact_type}`));
  return {
    run_id: run.run_id,
    draft_issue_fact_types: draftIssueFactTypes,
    draft_issues_without_assertion: draftIssueFactTypes.filter((entry) => !analysedKeys.has(`${entry.family_key}\u0000${entry.fact_type}`)),
    fact_types: factTypes,
    sections_not_extracted: [...sectionsNotExtracted.values()].sort((a, b) => a.section_reference.localeCompare(b.section_reference, undefined, { numeric: true })),
    summary: {
      draft_issues: draftIssues.length,
      fact_types_unresolved: factTypes.length,
      carried_elsewhere: factTypes.filter((entry) => entry.valid_elsewhere.length > 0 || entry.valid_in_unresolved_sections > 0).length,
      nowhere: factTypes.filter((entry) => entry.valid_elsewhere.length === 0 && entry.valid_in_unresolved_sections === 0).length,
      by_cause: byCause,
      by_verdict: byVerdict,
    },
  };
}

function verdictFor(sections, validElsewhere, validHere) {
  const causes = new Set(sections.map((section) => section.cause));
  if (causes.size === 1 && causes.has(CAUSES.SECTION_NOT_EXTRACTED)) return VERDICTS.SECTION_GAP;
  if (causes.size === 1 && causes.has(CAUSES.HELD_PROPOSAL)) return VERDICTS.BOOKKEEPING_HELD;
  const modelAnswerOnly = [...causes].every((cause) => [CAUSES.MODEL_SAID_NOT_FOUND_WITH_FACT, CAUSES.MODEL_SAID_FOUND_NO_FACT, CAUSES.MODEL_SAID_UNRESOLVED, CAUSES.MODEL_OMITTED_ANSWER].includes(cause));
  if (modelAnswerOnly) {
    const carried = validElsewhere.length > 0 || validHere > 0;
    if (causes.size === 1 && causes.has(CAUSES.MODEL_SAID_NOT_FOUND_WITH_FACT)) return VERDICTS.BOOKKEEPING_MODEL_ANSWER;
    return carried ? VERDICTS.BOOKKEEPING_MODEL_ANSWER : VERDICTS.EXTRACTION_GAP;
  }
  return VERDICTS.MIXED;
}

// Two runs' draft issues side by side: the fact types both name, and the
// ones only one names.
function compareDraftIssues(a, b) {
  const keyOf = (entry) => `${entry.family_key}\u0000${entry.fact_type}`;
  const inA = new Map(a.draft_issue_fact_types.map((entry) => [keyOf(entry), entry]));
  const inB = new Map(b.draft_issue_fact_types.map((entry) => [keyOf(entry), entry]));
  return {
    both: [...inA.keys()].filter((key) => inB.has(key)).map((key) => inA.get(key)),
    only_a: [...inA.keys()].filter((key) => !inB.has(key)).map((key) => inA.get(key)),
    only_b: [...inB.keys()].filter((key) => !inA.has(key)).map((key) => inB.get(key)),
  };
}

module.exports = {
  CAUSES,
  DRAFT_ISSUE_CODE,
  VERDICTS,
  analyseUnresolvedFactTypes,
  compareDraftIssues,
  parseModelAnswer,
};
