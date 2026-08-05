'use strict';

const { canonicalJson, contentId, sha256Hex, utf8Slice } = require('../canonical-bytes');
const { validateImmutableSource } = require('../source-structure');
const { buildAdmittedSourceReference } = require('../admitted-semantic-source');
const { validateObservationNormalisation } = require('../observation-normalisers');
const { checkCitationConstructibility } = require('./citation-constructibility');
const { resolveQualifierAttachment } = require('./limb-components');

const SCHEMA_VERSION = 'NATIVE_CANDIDATE_SEMANTIC_SAFETY_PREFLIGHT/V1';
const REPORT_DOMAIN = 'NATIVE_CANDIDATE_SEMANTIC_SAFETY_PREFLIGHT/V1';
const CANDIDATE_STATES = new Set(['PRESENT', 'OPEN_WORLD']);

function stable(value) {
  return canonicalJson(value);
}

function finding(code, details = {}) {
  return { code, details };
}

function rawValuePresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function sortedFindings(findings) {
  return findings.sort((a, b) => stable(a).localeCompare(stable(b)));
}

function candidateId(candidate, index) {
  return candidate.candidate_id || candidate.claim_occurrence_id || `candidate:${index}`;
}

function sourceBinding(source) {
  if (source?.schema_version === 'IMMUTABLE_SOURCE_DOCUMENT/V1') {
    validateImmutableSource(source);
    return {
      source_text: source.canonical_text.text,
      document_hash: source.document_hash,
      canonical_text_sha256: source.document_hash,
      source_kind: 'IMMUTABLE_SOURCE_DOCUMENT/V1',
    };
  }
  // This validates the runtime context's closed shape and content identity.
  buildAdmittedSourceReference(source);
  return {
    source_text: source.canonical_text.text,
    document_hash: source.document_hash,
    canonical_text_sha256: source.canonical_text_sha256,
    source_kind: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
  };
}

function validateExactEvidence({ source, candidateId: id, evidence, evidenceIndex, findings }) {
  try {
    const quote = utf8Slice(source.source_text, evidence.absolute_start, evidence.absolute_end);
    if (typeof evidence.exact_quote !== 'string' || quote !== evidence.exact_quote) {
      findings.push(finding('EVIDENCE_OFFSET_EXACT_QUOTE_MISMATCH', {
        candidate_id: id, evidence_index: evidenceIndex,
        absolute_start: evidence.absolute_start, absolute_end: evidence.absolute_end,
      }));
    }
    if (typeof evidence.exact_text_sha256 !== 'string' || sha256Hex(quote) !== evidence.exact_text_sha256) {
      findings.push(finding('EVIDENCE_EXACT_QUOTE_DIGEST_MISMATCH', { candidate_id: id, evidence_index: evidenceIndex }));
    }
    if (evidence.document_hash != null && evidence.document_hash !== source.document_hash) {
      findings.push(finding('EVIDENCE_DOCUMENT_HASH_MISMATCH', { candidate_id: id, evidence_index: evidenceIndex }));
    }
    if (evidence.canonical_text_sha256 != null && evidence.canonical_text_sha256 !== source.canonical_text_sha256) {
      findings.push(finding('EVIDENCE_CANONICAL_TEXT_HASH_MISMATCH', { candidate_id: id, evidence_index: evidenceIndex }));
    }
  } catch (error) {
    findings.push(finding('EVIDENCE_OFFSET_INVALID', { candidate_id: id, evidence_index: evidenceIndex, message: error.message }));
  }
}

/**
 * Build one deterministic semantic-safety report for one native candidate
 * set. This is deliberately a composition seam: source identity, citation
 * constructibility, qualifier attachment and comparison normalisation remain
 * owned by their existing modules. A failed check is reported, never repaired
 * or silently converted into absence.
 */
function preflightNativeCandidateSet({
  candidate_set_key,
  immutable_source,
  candidates = [],
  citation_checks = [],
  qualifier_checks = [],
  party_inheritance_checks = [],
  comparison_values = [],
  formula_values = [],
  run_receipt = null,
} = {}) {
  const findings = [];
  const checkResults = [];
  let source = null;
  let sourceText = null;
  let sourceHash = null;
  let canonicalTextHash = null;

  if (typeof candidate_set_key !== 'string' || !candidate_set_key) {
    findings.push(finding('CANDIDATE_SET_KEY_REQUIRED'));
  }
  try {
    source = sourceBinding(immutable_source);
    sourceText = source.source_text;
    sourceHash = source.document_hash;
    canonicalTextHash = source.canonical_text_sha256;
    checkResults.push({ check: 'SOURCE_CONTEXT', source_kind: source.source_kind, status: 'PASS' });
  } catch (error) {
    findings.push(finding('SOURCE_CONTEXT_INVALID', { message: error.message }));
  }
  if (typeof sourceText !== 'string' || sha256Hex(sourceText) !== canonicalTextHash) {
    findings.push(finding('CANONICAL_TEXT_HASH_MISMATCH', {
      expected_canonical_text_sha256: canonicalTextHash || null,
      actual_canonical_text_sha256: typeof sourceText === 'string' ? sha256Hex(sourceText) : null,
    }));
  }
  if (run_receipt != null) {
    if (!run_receipt || run_receipt.document_hash !== sourceHash) {
      findings.push(finding('RUN_RECEIPT_DOCUMENT_HASH_MISMATCH', {
        expected_document_hash: sourceHash || null,
        actual_document_hash: run_receipt?.document_hash || null,
      }));
    }
    if (run_receipt?.source_sha256 != null && run_receipt.source_sha256 !== canonicalTextHash) {
      findings.push(finding('RUN_RECEIPT_CANONICAL_TEXT_HASH_MISMATCH', {
        expected_canonical_text_sha256: canonicalTextHash || null,
        actual_source_hash: run_receipt.source_sha256,
      }));
    }
  }

  if (!Array.isArray(candidates)) findings.push(finding('CANDIDATES_NOT_ARRAY'));
  else candidates.forEach((candidate, index) => {
    const id = candidateId(candidate || {}, index);
    if (!candidate || typeof candidate !== 'object') {
      findings.push(finding('CANDIDATE_INVALID', { candidate_id: id }));
      return;
    }
    if (!CANDIDATE_STATES.has(candidate.state)) {
      findings.push(finding('CANDIDATE_STATE_INVALID', { candidate_id: id, state: candidate.state || null }));
    }
    // OPEN_WORLD is evidence-bearing uncertainty. It is never an absence fact.
    if (candidate.state === 'OPEN_WORLD' && candidate.absence === true) {
      findings.push(finding('OPEN_WORLD_CONFLATED_WITH_ABSENCE', { candidate_id: id }));
    }
    if (!rawValuePresent(candidate.raw_value)) {
      findings.push(finding('RAW_VALUE_REQUIRED', { candidate_id: id }));
    }
    if (candidate.citation_validation != null && candidate.citation_validation.accepted !== true) {
      findings.push(finding('CITATION_NOT_VALIDATED', {
        candidate_id: id,
        result: candidate.citation_validation,
      }));
    }
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
      findings.push(finding('EVIDENCE_REQUIRED', { candidate_id: id }));
      return;
    }
    candidate.evidence.forEach((edge, evidenceIndex) => validateExactEvidence({
      source, candidateId: id, evidence: edge, evidenceIndex, findings,
    }));
  });

  if (!Array.isArray(citation_checks)) findings.push(finding('CITATION_CHECKS_NOT_ARRAY'));
  else citation_checks.forEach((input, index) => {
    try {
      const result = checkCitationConstructibility({
        ...input,
        document_text: sourceText,
      });
      checkResults.push({ check: 'CITATION_CONSTRUCTIBILITY', candidate_id: input.candidate_id || `citation:${index}`, result });
      if (!result || result.accepted !== true) {
        findings.push(finding('CITATION_NOT_VALIDATED', { candidate_id: input.candidate_id || `citation:${index}`, result: result || null }));
      }
    } catch (error) {
      findings.push(finding('CITATION_CHECK_INVALID', { candidate_id: input?.candidate_id || `citation:${index}`, message: error.message }));
    }
  });

  if (!Array.isArray(qualifier_checks)) findings.push(finding('QUALIFIER_CHECKS_NOT_ARRAY'));
  else qualifier_checks.forEach((input, index) => {
    try {
      const result = resolveQualifierAttachment(input.tree, input);
      checkResults.push({ check: 'QUALIFIER_ATTACHMENT', candidate_id: input.candidate_id || `qualifier:${index}`, result });
      if (!result.attached) findings.push(finding('QUALIFIER_NOT_ATTACHED', { candidate_id: input.candidate_id || `qualifier:${index}`, reasons: result.reasons }));
      if (input.expected_subject_component_id != null && result.subject_component_id !== input.expected_subject_component_id) {
        findings.push(finding('QUALIFIER_NOT_ON_NARROWEST_GOVERNED_LIMB', { candidate_id: input.candidate_id || `qualifier:${index}`, expected_subject_component_id: input.expected_subject_component_id, actual_subject_component_id: result.subject_component_id }));
      }
      if (result.auto_pass_blocked && input.review_outcome !== 'GOVERNS_WHOLE_NODE') {
        findings.push(finding('QUALIFIER_ATTACHMENT_REQUIRES_REVIEW', { candidate_id: input.candidate_id || `qualifier:${index}`, reasons: result.reasons }));
      }
    } catch (error) {
      findings.push(finding('QUALIFIER_CHECK_INVALID', { candidate_id: input?.candidate_id || `qualifier:${index}`, message: error.message }));
    }
  });

  if (!Array.isArray(party_inheritance_checks)) findings.push(finding('PARTY_INHERITANCE_CHECKS_NOT_ARRAY'));
  else party_inheritance_checks.forEach((input, index) => {
    const actual = input?.child_claim?.attributes?.inherited_party_from_provision_instance_id;
    const expected = input?.parent_provision_instance_id;
    const id = input?.candidate_id || `party:${index}`;
    checkResults.push({ check: 'PARENT_PARTY_INHERITANCE', candidate_id: id, expected_parent_provision_instance_id: expected || null, actual_parent_provision_instance_id: actual || null });
    if (typeof expected !== 'string' || !expected || actual !== expected) {
      findings.push(finding('PARENT_PARTY_INHERITANCE_INVALID', { candidate_id: id, expected_parent_provision_instance_id: expected || null, actual_parent_provision_instance_id: actual || null }));
    }
  });

  if (!Array.isArray(comparison_values)) findings.push(finding('COMPARISON_VALUES_NOT_ARRAY'));
  else comparison_values.forEach((value, index) => {
    try {
      if (!rawValuePresent(value?.raw_value)) {
        findings.push(finding('COMPARISON_RAW_VALUE_REQUIRED', { comparison_id: value?.comparison_id || `comparison:${index}` }));
      }
      validateObservationNormalisation(value.normalisation);
      checkResults.push({ check: 'COMPARISON_NORMALISATION', comparison_id: value.comparison_id || `comparison:${index}`, comparability_state: value.normalisation.comparability_state });
    } catch (error) {
      findings.push(finding('COMPARISON_NORMALISATION_INVALID', { comparison_id: value?.comparison_id || `comparison:${index}`, message: error.message }));
    }
  });

  if (!Array.isArray(formula_values)) findings.push(finding('FORMULA_VALUES_NOT_ARRAY'));
  else formula_values.forEach((value, index) => {
    const id = value?.formula_id || `formula:${index}`;
    const lineage = value?.source_citations;
    if (typeof value?.raw_formula !== 'string' || !value.raw_formula
      || !Array.isArray(value.evidence) || value.evidence.length === 0) {
      findings.push(finding('FORMULA_RAW_PROVENANCE_INVALID', { formula_id: id }));
    }
    (value?.evidence || []).forEach((edge, evidenceIndex) => {
      validateExactEvidence({ source, candidateId: id, evidence: edge, evidenceIndex, findings });
      if (edge.exact_quote !== value.raw_formula) {
        findings.push(finding('FORMULA_EXACT_QUOTE_MISMATCH', { formula_id: id, evidence_index: evidenceIndex }));
      }
    });
    if (!Array.isArray(lineage) || lineage.length === 0 || lineage.some((citation) => typeof citation !== 'string' || !citation)) {
      findings.push(finding('FORMULA_CITATION_LINEAGE_REQUIRED', { formula_id: id }));
    }
    checkResults.push({ check: 'FORMULA_PROVENANCE', formula_id: id, evidence_count: Array.isArray(value?.evidence) ? value.evidence.length : 0, citation_count: Array.isArray(lineage) ? lineage.length : 0 });
  });

  const orderedFindings = sortedFindings(findings);
  const body = {
    schema_version: SCHEMA_VERSION,
    candidate_set_key: candidate_set_key || null,
    document_hash: sourceHash || null,
    candidate_count: Array.isArray(candidates) ? candidates.length : 0,
    status: orderedFindings.length === 0 ? 'PASS' : 'FAIL',
    findings: orderedFindings,
    check_results: checkResults.sort((a, b) => stable(a).localeCompare(stable(b))),
  };
  return Object.freeze({ ...body, semantic_safety_preflight_id: contentId(REPORT_DOMAIN, body) });
}

/**
 * Adapt a real native-extraction receipt into the preflight's explicit source
 * coordinate system. The runner's evidence is section-local by contract, so
 * this adapter adds the independently recorded section start. It binds the
 * runner's own citation validator into the composite report instead of
 * recreating its family logic.
 */
function preflightNativeRunReceipt({
  candidate_set_key,
  immutable_source,
  run_receipt,
  qualifier_checks = [],
  party_inheritance_checks = [],
  comparison_values = [],
  formula_values = [],
} = {}) {
  const sections = new Map((run_receipt?.resolved_sections || []).map((section) => [section.section_reference, section]));
  let source = null;
  try { source = sourceBinding(immutable_source); } catch (_) { /* preflight records the source error below */ }
  const candidates = (run_receipt?.compiled_candidates || [])
    .filter((entry) => entry?.ok === true && entry.candidate?.kind === 'claim' && entry.candidate.claim)
    .map((entry, index) => {
      const claim = entry.candidate.claim;
      const section = sections.get(entry.section_reference);
      return {
        candidate_id: claim.claim_occurrence_id || `run-candidate:${index}`,
        state: claim.state,
        raw_value: claim.raw_value,
        citation_validation: entry.citation_validation || null,
        evidence: (claim.evidence || []).map((edge) => {
          const absoluteStart = Number.isInteger(section?.start) ? section.start + edge.absolute_start : edge.absolute_start;
          const absoluteEnd = Number.isInteger(section?.start) ? section.start + edge.absolute_end : edge.absolute_end;
          let exactQuote = null;
          try { exactQuote = utf8Slice(source?.source_text, absoluteStart, absoluteEnd); } catch (_) { /* preflight records the invalid span */ }
          return {
            absolute_start: absoluteStart,
            absolute_end: absoluteEnd,
            exact_quote: exactQuote,
            exact_text_sha256: exactQuote == null ? null : sha256Hex(exactQuote),
            document_hash: run_receipt?.document_hash || null,
            canonical_text_sha256: run_receipt?.source_sha256 || null,
          };
        }),
      };
    });
  return preflightNativeCandidateSet({
    candidate_set_key,
    immutable_source,
    candidates,
    qualifier_checks,
    party_inheritance_checks,
    comparison_values,
    formula_values,
    run_receipt,
  });
}

function preflightUnifiedWorkResult({ work_result, admitted_source_context, ...options } = {}) {
  return preflightNativeRunReceipt({
    ...options,
    immutable_source: admitted_source_context,
    run_receipt: work_result?.run_receipt,
  });
}

module.exports = {
  SCHEMA_VERSION,
  preflightNativeCandidateSet,
  preflightNativeRunReceipt,
  preflightUnifiedWorkResult,
};
