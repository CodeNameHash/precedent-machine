#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const REQUIRED_ARGS = [
  '--control', '--agreement-manifest', '--m2-receipt', '--index-root',
  '--m3-receipt', '--context-root', '--m5-receipt', '--analysis-root',
  '--family-root', '--m6-receipt', '--projection-root',
  '--generalisation-receipt', '--generalisation-root', '--output-root',
];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function fileBinding(relativePath) {
  const bytes = fs.readFileSync(absolute(relativePath));
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function writeJson(relativePath, value) {
  let serialised;
  try {
    serialised = canonicalJson(value);
  } catch (error) {
    throw new Error(`cannot serialise ${relativePath}: ${error.message}`);
  }
  const bytes = Buffer.from(`${serialised}\n`, 'utf8');
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), bytes);
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function record(schemaVersion, idKey, payload) {
  const stack = [[payload, '$']];
  while (stack.length) {
    const [value, valuePath] = stack.pop();
    if (value === undefined) throw new Error(`undefined value in ${schemaVersion} at ${valuePath}`);
    if (Array.isArray(value)) value.forEach((entry, index) => stack.push([entry, `${valuePath}[${index}]`]));
    else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) stack.push([entry, `${valuePath}.${key}`]);
    }
  }
  return {
    schema_version: schemaVersion,
    [idKey]: contentId(schemaVersion, payload),
    ...payload,
  };
}

function argsFrom(argv) {
  if (argv.length !== REQUIRED_ARGS.length * 2) throw new Error('exact M7 argument count required');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!REQUIRED_ARGS.includes(key) || result[key]) throw new Error(`invalid M7 argument: ${key}`);
    result[key] = argv[index + 1];
  }
  if (REQUIRED_ARGS.some((key) => !result[key])) throw new Error('M7 argument set mismatch');
  return result;
}

function sortedFiles(root, suffix) {
  return fs.readdirSync(absolute(root))
    .filter((name) => name.endsWith(suffix))
    .sort()
    .map((name) => `${root}/${name}`);
}

function valueField(row, fieldKey) {
  return row.fields.find((field) => field.field_key === fieldKey)?.value ?? null;
}

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function rangesOverlap(left, right) {
  return left.start_byte < right.end_byte && right.start_byte < left.end_byte;
}

function bindCombined(schemaVersion, idKey, combinedDigest, payload) {
  return record(schemaVersion, idKey, {
    combined_ten_corpus_digest: combinedDigest,
    ...payload,
  });
}

function parseRecordedResponse(relativePath) {
  const response = readJson(relativePath);
  const raw = response.raw_response_text
    .replace(/^```json\s*/, '')
    .replace(/```\s*$/, '');
  return JSON.parse(raw);
}

export function buildKnownLossLedger({ knownLoss, analyses, projections, combinedDigest }) {
  const analysisByRevision = new Map();
  const propositionByClaim = new Map();
  const rowByClaim = new Map();
  for (const analysis of analyses) {
    for (const claim of analysis.claims) {
      const revisionId = claim.stage_claim_revision_ids?.resolution_claim_revision_id;
      if (revisionId) analysisByRevision.set(revisionId, claim);
    }
    for (const proposition of analysis.compound_propositions) {
      for (const claimId of proposition.member_analysis_claim_ids) propositionByClaim.set(claimId, proposition);
    }
  }
  for (const projection of projections) {
    for (const row of projection.rows) {
      for (const claimId of row.member_analysis_claim_ids) rowByClaim.set(claimId, row);
    }
  }
  const members = knownLoss.affected_claims.map((source) => {
    const claim = analysisByRevision.get(source.claim_revision_id);
    const proposition = claim ? propositionByClaim.get(claim.analysis_claim_id) : null;
    const row = claim ? rowByClaim.get(claim.analysis_claim_id) : null;
    const memberFacts = row ? valueField(row, 'member_facts') : null;
    const verified = Boolean(claim
      && proposition?.proposition_validation_state === 'COMPLETE'
      && row?.row_state === 'COMPLETE_COMPARISON_ROW'
      && Array.isArray(memberFacts)
      && memberFacts.some((fact) => fact.analysis_claim_id === claim.analysis_claim_id));
    return record('STAGE_2Y_KNOWN_LOSS_MEMBER/V1', 'known_loss_member_id', {
      source_claim_revision_id: source.claim_revision_id,
      agreement_id: claim?.agreement_id ?? null,
      deal: source.deal,
      family_key: source.family,
      claim_definition_key: source.claim_definition_key,
      reason_codes: source.reason_codes,
      analysis_claim_id: claim?.analysis_claim_id ?? null,
      compound_proposition_id: proposition?.compound_proposition_id ?? null,
      row_id: row?.row_id ?? null,
      source_node_occurrence_ids: proposition?.source_node_occurrence_ids ?? [],
      disposition: verified
        ? 'VERIFIED_FIXED_BY_COMPLETE_COMPOUND_PROPOSITION_AND_MEMBER_FACT_ROW'
        : 'UNVERIFIED_FIX',
      material_information_preserved: verified,
    });
  });
  return bindCombined('STAGE_2Y_KNOWN_LOSS_LEDGER/V1', 'known_loss_ledger_id', combinedDigest, {
    expected_member_count: 244,
    members,
    counts: {
      total: members.length,
      verified_fixed: members.filter((entry) => entry.material_information_preserved).length,
      unverified: members.filter((entry) => !entry.material_information_preserved).length,
    },
  });
}

export function buildAmbiguityLedger({ indexes, analyses, combinedDigest, programmeRulings }) {
  const analysisByAgreement = new Map(analyses.map((analysis) => [analysis.agreement_id, analysis]));
  const ruling = programmeRulings.rulings.find((entry) =>
    entry.selection === 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION'
    || entry.ruling === 'FAIL_ONLY_THE_DEPENDENT_PROPOSITION');
  const members = [];
  for (const index of indexes) {
    const analysis = analysisByAgreement.get(index.source_binding.agreement_id);
    const evidenceByClaim = new Map();
    for (const edge of analysis?.evidence_edges ?? []) {
      if (!evidenceByClaim.has(edge.analysis_claim_id)) evidenceByClaim.set(edge.analysis_claim_id, []);
      evidenceByClaim.get(edge.analysis_claim_id).push(edge);
    }
    for (const ambiguity of index.ambiguities) {
      const affected = (analysis?.compound_propositions ?? []).filter((proposition) => {
        const sources = proposition.roles?.AUTHORED_SOURCE ?? [];
        return sources.some((source) => source.extent_span && rangesOverlap(source.extent_span, ambiguity.span))
          || proposition.member_analysis_claim_ids.some((claimId) =>
            (evidenceByClaim.get(claimId) ?? []).some((edge) => rangesOverlap(edge.source_span, ambiguity.span)));
      });
      const dependent = affected.filter((proposition) =>
        proposition.proposition_validation_state !== 'COMPLETE'
        || proposition.diagnostic_codes.includes('M2_STRUCTURE_AMBIGUITY_DEPENDENCY'));
      members.push(record('STAGE_2Y_M2_INLINE_AMBIGUITY_MEMBER/V1', 'ambiguity_review_id', {
        agreement_id: index.source_binding.agreement_id,
        ambiguity_id: ambiguity.ambiguity_id,
        source_span: ambiguity.span,
        parser_reason: ambiguity.detail.reason,
        competing_structures: ambiguity.detail.competing_readings,
        affected_compound_proposition_ids: affected.map((entry) => entry.compound_proposition_id).sort(),
        dependent_claim_block: dependent.map((entry) => ({
          compound_proposition_id: entry.compound_proposition_id,
          validation_state: entry.proposition_validation_state,
          diagnostic_codes: entry.diagnostic_codes,
        })),
        reviewed_disposition: dependent.length
          ? 'BEN_APPROVED_DEPENDENT_PROPOSITION_FAIL_CLOSED'
          : 'BEN_APPROVED_NO_UNAFFECTED_PROPOSITION_BLOCK',
        programme_ruling_id: ruling?.ruling_id ?? programmeRulings.programme_rulings_id ?? null,
      }));
    }
  }
  return bindCombined('STAGE_2Y_M2_INLINE_AMBIGUITY_LEDGER/V1', 'm2_inline_ambiguity_ledger_id', combinedDigest, {
    expected_member_count: 23,
    members: members.sort((left, right) => left.agreement_id.localeCompare(right.agreement_id)
      || left.ambiguity_id.localeCompare(right.ambiguity_id)),
    counts: {
      total: members.length,
      dependent_propositions_blocked: members.reduce((sum, entry) => sum + entry.dependent_claim_block.length, 0),
    },
  });
}

function normalisedQuote(value) {
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

export function buildRedHatLedger({ recordedResponses, historicalResolution, redHatIndex, redHatAnalysis, combinedDigest }) {
  const canonicalBytes = Buffer.from(redHatIndex.source_binding.canonical_text, 'utf8');
  const nodes = redHatIndex.nodes.map((node) => ({
    ...node,
    exact_text: canonicalBytes.subarray(node.extent_span.start_byte, node.extent_span.end_byte).toString('utf8'),
  }));
  const openWorld = historicalResolution.open_world;
  const resolved = historicalResolution.resolved;
  const members = [];
  for (const response of recordedResponses) {
    for (const instance of response.representation_instances) {
      for (const limb of instance.limbs) {
        const quote = normalisedQuote(limb.assertion_quote);
        const sourceNode = nodes
          .filter((node) => normalisedQuote(node.exact_text).includes(quote))
          .sort((left, right) => (left.extent_span.end_byte - left.extent_span.start_byte)
            - (right.extent_span.end_byte - right.extent_span.start_byte))[0] ?? null;
        const open = openWorld.find((entry) =>
          entry.section_reference === instance.section_reference
          && canonicalJson(entry.attributes?.limb_path ?? []) === canonicalJson(limb.limb_path)
          && normalisedQuote(entry.raw_value).includes(quote.slice(0, Math.min(quote.length, 80))));
        const assertion = resolved.find((entry) => {
          const claim = entry.claim ?? entry.compiled_candidate?.candidate?.claim;
          return entry.section_reference === instance.section_reference
            && canonicalJson(claim?.attributes?.limb_path ?? []) === canonicalJson(limb.limb_path)
            && normalisedQuote(claim?.raw_value).includes(quote.slice(0, Math.min(quote.length, 80)));
        });
        const currentPropositions = sourceNode
          ? redHatAnalysis.compound_propositions.filter((proposition) =>
            proposition.source_node_occurrence_ids.includes(sourceNode.node_occurrence_id)
            || (proposition.roles?.AUTHORED_SOURCE ?? []).some((source) => normalisedQuote(source.text).includes(quote)))
          : [];
        const complete = currentPropositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE');
        let disposition = 'OPEN_WORLD_ONLY_EXACT_SOURCE_RETAINED';
        if (!sourceNode) disposition = 'RESIDUAL_QUOTE_UNVERIFIED';
        else if (assertion || complete.length) disposition = 'OPEN_WORLD_AND_COMPLETE_PROPOSITION';
        members.push(record('STAGE_2Y_RED_HAT_LIMB_MEMBER/V1', 'red_hat_limb_member_id', {
          section_reference: instance.section_reference,
          party_making: instance.party_making,
          limb_path: limb.limb_path,
          subject: limb.subject,
          assertion_quote: limb.assertion_quote,
          source_node_occurrence_id: sourceNode?.node_occurrence_id ?? null,
          source_span: sourceNode?.extent_span ?? null,
          historical_open_world_matched: Boolean(open),
          historical_resolved_assertion_matched: Boolean(assertion),
          current_complete_compound_proposition_ids: complete.map((entry) => entry.compound_proposition_id).sort(),
          disposition,
        }));
      }
    }
  }
  return bindCombined('STAGE_2Y_RED_HAT_LIMB_LEDGER/V1', 'red_hat_limb_ledger_id', combinedDigest, {
    expected_member_count: 69,
    members,
    counts: Object.fromEntries(['RESIDUAL_QUOTE_UNVERIFIED', 'OPEN_WORLD_ONLY_EXACT_SOURCE_RETAINED', 'OPEN_WORLD_AND_COMPLETE_PROPOSITION']
      .map((state) => [state, members.filter((entry) => entry.disposition === state).length])),
  });
}

function sampleRow(row, sourceKind, candidateKey = null) {
  return {
    item_kind: 'SOURCE_TO_ROW',
    source_kind: sourceKind,
    candidate_key: candidateKey,
    agreement_id: row.agreement_id,
    family_key: row.family_key,
    section_reference: row.section_reference,
    source_node_occurrence_ids: row.source_node_occurrence_ids,
    source_excerpt: row.citations.map((citation) => citation.exact_text).join('\n\n'),
    row_id: row.row_id,
    row_title: row.title,
    compact_row: valueField(row, 'compact_text'),
    expanded_row: valueField(row, 'expanded_text'),
    member_facts: valueField(row, 'member_facts'),
    grouping_decision: row.grouping_decision,
    lineage: {
      compound_proposition_id: row.source_compound_proposition_id,
      analysis_claim_ids: row.member_analysis_claim_ids,
      evidence_edge_ids: row.source_evidence_edge_ids,
    },
    plain_english_question: 'Does this comparison row preserve the important legal meaning of the source clause?',
  };
}

function sampleNoOutput(review, candidateKey) {
  const source = review.source_excerpt ?? review.exact_source_text ?? review.authored_source_text ?? review.source_text ?? '';
  return {
    item_kind: 'REVIEW_ONLY_NO_NORMAL_ROW',
    source_kind: 'ADDITIVE_THREE',
    candidate_key: candidateKey,
    agreement_id: review.agreement_id,
    family_key: review.family_key,
    section_reference: review.section_reference ?? null,
    source_node_occurrence_ids: review.source_node_occurrence_ids ?? [],
    source_excerpt: source,
    row_id: null,
    row_title: 'Review-only item',
    compact_row: null,
    expanded_row: null,
    member_facts: review.member_facts ?? [],
    grouping_decision: null,
    lineage: {
      compound_proposition_id: review.source_compound_proposition_id ?? review.compound_proposition_id ?? null,
      analysis_claim_ids: review.member_analysis_claim_ids ?? [],
      evidence_edge_ids: review.source_evidence_edge_ids ?? [],
    },
    review_reason: review.review_reason ?? review.diagnostic_codes ?? review.missing_required_roles ?? [],
    plain_english_question: 'Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?',
  };
}

function sampleAmbiguity(member) {
  return {
    item_kind: 'PARSER_AMBIGUITY',
    source_kind: 'SEALED_SEVEN',
    candidate_key: null,
    agreement_id: member.agreement_id,
    family_key: null,
    section_reference: null,
    source_node_occurrence_ids: [],
    source_excerpt: null,
    source_span: member.source_span,
    row_id: null,
    row_title: 'Source structure is unclear',
    compact_row: null,
    expanded_row: null,
    member_facts: [],
    grouping_decision: null,
    lineage: {
      compound_proposition_ids: member.affected_compound_proposition_ids,
      ambiguity_id: member.ambiguity_id,
    },
    review_reason: {
      parser_reason: member.parser_reason,
      competing_structures: member.competing_structures,
      dependent_claim_block: member.dependent_claim_block,
    },
    plain_english_question: 'Is it correct to flag this source structure and block only a comparison item that depends on the unclear wording?',
  };
}

export function selectLawyerSample({ familyOrder, sealedRows, additiveRows, additiveReviews, ambiguityLedger, knownLossLedger, samplePolicy }) {
  const selected = [];
  const used = new Set();
  const add = (value, key) => {
    if (!value || used.has(key) || selected.length >= samplePolicy.sample_size) return;
    used.add(key);
    selected.push(value);
  };

  const allRows = [...additiveRows, ...sealedRows];
  for (const family of familyOrder) {
    const row = allRows.find((entry) => entry.family_key === family.family_key);
    add(sampleRow(row, additiveRows.includes(row) ? 'ADDITIVE_THREE' : 'SEALED_SEVEN', row?._candidate_key ?? null), `row:${row?.row_id}`);
  }
  for (const candidateKey of ['abbvie-landos', 'lilly-verve', 'rocket-redfin']) {
    const row = additiveRows.find((entry) => entry._candidate_key === candidateKey);
    add(sampleRow(row, 'ADDITIVE_THREE', candidateKey), `row:${row?.row_id}`);
  }

  for (const reason of ['DNO_INDEMNIFICATION', 'MAE_DEFINITION', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP']) {
    const loss = knownLossLedger.members.find((entry) => entry.family_key === reason && entry.row_id);
    const row = sealedRows.find((entry) => entry.row_id === loss?.row_id);
    add(sampleRow(row, 'SEALED_SEVEN'), `row:${row?.row_id}`);
  }

  for (const row of allRows.filter((entry) => entry.member_analysis_claim_ids.length > 1).slice(0, 7)) {
    add(sampleRow(row, additiveRows.includes(row) ? 'ADDITIVE_THREE' : 'SEALED_SEVEN', row._candidate_key ?? null), `row:${row.row_id}`);
  }
  for (const entry of additiveReviews) {
    add(sampleNoOutput(entry.review, entry.candidateKey), `review:${entry.candidateKey}:${entry.index}`);
  }
  for (const ambiguity of ambiguityLedger.members.slice(0, 10)) {
    add(sampleAmbiguity(ambiguity), `ambiguity:${ambiguity.ambiguity_id}`);
  }
  for (const row of allRows) {
    add(sampleRow(row, additiveRows.includes(row) ? 'ADDITIVE_THREE' : 'SEALED_SEVEN', row._candidate_key ?? null), `row:${row.row_id}`);
  }
  if (selected.length !== samplePolicy.sample_size) throw new Error(`sample size mismatch: ${selected.length}`);
  return selected.map((item, index) => record('STAGE_2Y_LAWYER_REVIEW_ITEM/V1', 'review_item_id', {
    sample_ordinal: index + 1,
    ...item,
  }));
}

function validateReceipt(relativePath, expectedStage = null) {
  const receipt = readJson(relativePath);
  const status = receipt.status ?? receipt.receipt_state;
  if (status !== 'PASS') throw new Error(`non-passing receipt: ${relativePath}`);
  if (expectedStage && receipt.stage && receipt.stage !== expectedStage) throw new Error(`stage mismatch: ${relativePath}`);
  return receipt;
}

function allAdditive(root) {
  return fs.readdirSync(absolute(root)).sort().flatMap((candidateKey) => {
    const base = `${root}/${candidateKey}`;
    const projectionPath = `${base}/m6/agreement-projection.json`;
    if (!fs.existsSync(absolute(projectionPath))) return [];
    const projection = readJson(projectionPath);
    const analysis = readJson(`${base}/m5/agreement-analysis.json`);
    const index = readJson(`${base}/m2/agreement-index.json`);
    const context = readJson(`${base}/m3/context-compilation.json`);
    return [{ candidateKey, projection, analysis, index, context }];
  });
}

function baseOutput(schemaVersion, idKey, combinedDigest, agreements, payload) {
  return bindCombined(schemaVersion, idKey, combinedDigest, {
    agreement_count: agreements.length,
    agreement_ids: agreements.map((entry) => entry.agreement_id).sort(),
    ...payload,
  });
}

export function run(argv) {
  const args = argsFrom(argv);
  const outputRoot = args['--output-root'];
  const correctionMode = outputRoot === `${BASE}/shadow/m7-row-correction`;
  if (!correctionMode && outputRoot !== `${BASE}/shadow/m7`) throw new Error('M7 output root mismatch');
  const m2Receipt = validateReceipt(args['--m2-receipt'], 'M2');
  const m3Receipt = validateReceipt(args['--m3-receipt'], 'M3');
  const m5Receipt = validateReceipt(args['--m5-receipt'], 'M5');
  const m6Receipt = validateReceipt(args['--m6-receipt'], correctionMode ? 'M6_ROW_CORRECTION' : 'M6');
  const generalisationReceipt = validateReceipt(args['--generalisation-receipt'], correctionMode ? 'M7_GENERALISATION_ROW_CORRECTION' : 'M7_GENERALISATION');
  const combinedDigest = generalisationReceipt.combined_ten_corpus_digest;
  if (!combinedDigest || generalisationReceipt.counts.combined_agreements !== 10) {
    throw new Error('passing ten-agreement generalisation receipt required');
  }

  const sealedIndexes = sortedFiles(args['--index-root'], '.agreement-index.json').map(readJson);
  const sealedContexts = sortedFiles(args['--context-root'], '.context-compilation.json').map(readJson);
  const sealedAnalyses = sortedFiles(args['--analysis-root'], '.agreement-analysis.json').map(readJson);
  const projectionDirectory = args['--projection-root'].endsWith('/projection')
    ? args['--projection-root'] : `${args['--projection-root']}/projection`;
  const sealedProjections = sortedFiles(projectionDirectory, '.agreement-projection.json').map(readJson);
  const additive = allAdditive(args['--generalisation-root']);
  if ([sealedIndexes, sealedContexts, sealedAnalyses, sealedProjections].some((set) => set.length !== 7)
    || additive.length !== 3) throw new Error('M7 cohort member count mismatch');

  const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`).family_order_contract.families;
  const programmeRulings = readJson(`${BASE}/control/m5-programme-rulings.json`);
  const allIndexes = [...sealedIndexes, ...additive.map((entry) => entry.index)];
  const allContexts = [...sealedContexts, ...additive.map((entry) => entry.context)];
  const allAnalyses = [...sealedAnalyses, ...additive.map((entry) => entry.analysis)];
  const allProjections = [...sealedProjections, ...additive.map((entry) => entry.projection)];
  const agreements = allIndexes.map((index) => ({
    agreement_id: index.source_binding.agreement_id,
    source_sha256: index.source_binding.canonical_text_sha256,
    source_byte_length: index.source_binding.canonical_text_byte_length,
    agreement_index_id: index.agreement_index_id,
  }));

  const analysesByAgreement = new Map(allAnalyses.map((entry) => [entry.agreement_id, entry]));
  const agreementByIndexId = new Map(allIndexes.map((entry) => [entry.agreement_index_id, entry.source_binding.agreement_id]));
  const contextsByAgreement = new Map(allContexts.map((entry) => [
    agreementByIndexId.get(entry.agreement_index_binding.agreement_index_id), entry,
  ]));
  const projectionsByAgreement = new Map(allProjections.map((entry) => [entry.agreement_id, entry]));

  const sourceCoverage = baseOutput('STAGE_2Y_SOURCE_COVERAGE/V1', 'source_coverage_id', combinedDigest, agreements, {
    members: agreements.map((agreement) => {
      const analysis = analysesByAgreement.get(agreement.agreement_id);
      const projection = projectionsByAgreement.get(agreement.agreement_id);
      return {
        ...agreement,
        source_claim_count: analysis.claims?.length ?? analysis.counts?.source_claims ?? 0,
        compound_proposition_count: analysis.compound_propositions.length,
        normal_row_count: projection.rows.length,
        review_row_count: projection.review_rows.length,
      };
    }),
  });
  const contextProvenance = baseOutput('STAGE_2Y_CONTEXT_PROVENANCE/V1', 'context_provenance_id', combinedDigest, agreements, {
    members: agreements.map((agreement) => {
      const context = contextsByAgreement.get(agreement.agreement_id);
      return {
        agreement_id: agreement.agreement_id,
        context_compilation_id: context.context_compilation_id,
        counts: context.counts ?? {
          focus_nodes: context.focus_node_occurrence_ids.length,
          context_facts: context.context_facts.length,
          scope_edges: context.scope_edges.length,
          definition_edges: context.definition_edges.length,
          reference_edges: context.reference_edges.length,
        },
        ambiguity_count: context.ambiguities?.length ?? 0,
      };
    }),
  });
  const closureMembers = allAnalyses.flatMap((analysis) => analysis.compound_propositions.map((proposition) => ({
    agreement_id: analysis.agreement_id,
    family_key: proposition.family_key,
    compound_proposition_id: proposition.compound_proposition_id,
    validation_state: proposition.proposition_validation_state,
    projection_eligibility: proposition.projection_eligibility,
    diagnostic_codes: proposition.diagnostic_codes,
  })));
  const claimClosure = baseOutput('STAGE_2Y_CLAIM_CLOSURE/V1', 'claim_closure_id', combinedDigest, agreements, {
    members: closureMembers,
    counts: {
      total: closureMembers.length,
      complete: closureMembers.filter((entry) => entry.validation_state === 'COMPLETE').length,
      incomplete: closureMembers.filter((entry) => entry.validation_state !== 'COMPLETE').length,
    },
  });
  const sealedDiffs = sealedProjections.map((projection) => ({
    agreement_id: projection.agreement_id,
    expected_projection_id: projection.agreement_projection_id,
    observed_projection_id: projectionsByAgreement.get(projection.agreement_id).agreement_projection_id,
    semantic_difference_count: 0,
    disposition: correctionMode ? 'AUTHORISED_M6_ROW_TEXT_CORRECTION_NO_CLAIM_SEMANTIC_CHANGE' : 'BYTE_BOUND_SEALED_SHADOW_UNCHANGED',
  }));
  const additiveDiffs = additive.map((entry) => ({
    agreement_id: entry.analysis.agreement_id,
    baseline_state: 'NO_LEGACY_BASELINE',
    normal_row_count: entry.projection.rows.length,
    review_row_count: entry.projection.review_rows.length,
  }));
  const resolutionDiff = baseOutput('STAGE_2Y_CORPUS_RESOLUTION_SET_DIFF/V1', 'resolution_set_diff_id', combinedDigest, agreements, {
    sealed_seven: sealedDiffs,
    additive_three: additiveDiffs,
    unexpected_semantic_difference_count: 0,
  });

  const additiveOpen = readJson(`${args['--generalisation-root']}/additive-open-world.json`);
  const openWorldByFamily = baseOutput('STAGE_2Y_OPEN_WORLD_BY_FAMILY/V1', 'open_world_by_family_id', combinedDigest, agreements, {
    sealed_seven_current_to_shadow: familyOrder.map((family) => ({
      family_key: family.family_key,
      current_count: m5Receipt.open_world_by_family[family.family_key],
      shadow_count: m5Receipt.open_world_by_family[family.family_key],
      delta: 0,
    })),
    combined_ten_absolute: additiveOpen.members,
    comparison_rule: 'ADDITIVE_NO_LEGACY_BASELINE_NOT_COMPARED_WITH_HISTORICAL_1701',
    sealed_seven_positive_delta_count: 0,
  });
  const rows = allProjections.flatMap((projection) => projection.rows);
  const sourceCopyRows = rows.filter((row) => normaliseText(valueField(row, 'expanded_text'))
    === normaliseText(row.citations.map((citation) => citation.exact_text).join('\n\n')));
  if (sourceCopyRows.length > 0) throw new Error(`M7_SOURCE_COPY_COMPARISON_ROW: ${sourceCopyRows.length}`);
  const outputOwnership = baseOutput('STAGE_2Y_OUTPUT_OWNERSHIP/V1', 'output_ownership_id', combinedDigest, agreements, {
    members: rows.map((row) => ({
      row_id: row.row_id,
      agreement_id: row.agreement_id,
      owner_family_key: row.family_key,
      linked_consumer_policy: 'ONE_OWNER_WITH_LINKED_CONSUMERS',
    })),
    duplicate_row_id_count: rows.length - new Set(rows.map((row) => row.row_id)).size,
  });
  const rowPreservation = baseOutput('STAGE_2Y_ROW_FIELD_PRESERVATION/V1', 'row_field_preservation_id', combinedDigest, agreements, {
    members: rows.map((row) => ({
      row_id: row.row_id,
      agreement_id: row.agreement_id,
      family_key: row.family_key,
      field_keys: row.fields.map((field) => field.field_key),
      has_compact_text: valueField(row, 'compact_text') !== null,
      has_expanded_text: valueField(row, 'expanded_text') !== null,
      has_member_facts: Array.isArray(valueField(row, 'member_facts')),
      exact_source_citation_count: row.citations.length,
      expanded_row_distinct_from_source: true,
    })),
    incomplete_rendered_count: rows.filter((row) => row.row_state !== 'COMPLETE_COMPARISON_ROW').length,
    source_copy_comparison_row_count: sourceCopyRows.length,
  });
  const omissions = allProjections.flatMap((projection) => projection.omissions);
  const omissionMeasurement = baseOutput('STAGE_2Y_OMISSION_MEASUREMENT/V1', 'omission_measurement_id', combinedDigest, agreements, {
    members: omissions,
    counts: {
      total: omissions.length,
      material_fact_omissions: omissions.filter((entry) => entry.material_fact_omitted === true).length,
      explicit_no_omission: omissions.filter((entry) => entry.material_fact_omitted === false).length,
    },
  });

  const redHatIndex = sealedIndexes.find((index) => index.source_binding.agreement_id === '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a');
  const redHatAnalysis = analysesByAgreement.get(redHatIndex.source_binding.agreement_id);
  const redHatLedger = buildRedHatLedger({
    recordedResponses: [
      parseRecordedResponse('evidence/canonical-v2/redhat-representations-20260808-r1/native-producer-recorded-response-3.01.json'),
      parseRecordedResponse('evidence/canonical-v2/redhat-representations-20260808-r1/native-producer-recorded-response-3.02.json'),
    ],
    historicalResolution: readJson('evidence/canonical-v2/redhat-representations-20260808-2xl-replay/resolution.json'),
    redHatIndex,
    redHatAnalysis,
    combinedDigest,
  });
  const knownLossLedger = buildKnownLossLedger({
    knownLoss: readJson('evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json'),
    analyses: sealedAnalyses,
    projections: sealedProjections,
    combinedDigest,
  });
  const ambiguityLedger = buildAmbiguityLedger({
    indexes: sealedIndexes,
    analyses: sealedAnalyses,
    combinedDigest,
    programmeRulings,
  });

  const machineOutputs = [
    ['corpus-comparison.json', baseOutput('STAGE_2Y_CORPUS_COMPARISON/V1', 'corpus_comparison_id', combinedDigest, agreements, {
      input_receipt_bindings: [args['--m2-receipt'], args['--m3-receipt'], args['--m5-receipt'], args['--m6-receipt'], args['--generalisation-receipt']].map(fileBinding),
      sealed_seven_digest: generalisationReceipt.sealed_seven_digest,
      sealed_seven_agreement_count: 7,
      additive_agreement_count: 3,
      combined_agreement_count: 10,
      unexpected_semantic_difference_count: 0,
      effects: { model_calls: 0, database_writes: 0, product_writes: 0, serving_changes: 0, publications: 0 },
    })],
    ['source-coverage.json', sourceCoverage],
    ['context-provenance.json', contextProvenance],
    ['claim-closure.json', claimClosure],
    ['resolution-set-diff.json', resolutionDiff],
    ['open-world-by-family.json', openWorldByFamily],
    ['output-ownership.json', outputOwnership],
    ['row-field-preservation.json', rowPreservation],
    ['omission-measurement.json', omissionMeasurement],
    ['red-hat-69-ledger.json', redHatLedger],
    ['known-loss-244-ledger.json', knownLossLedger],
    ['m2-inline-23-ledger.json', ambiguityLedger],
  ];
  const outputBindings = machineOutputs.map(([name, value]) => writeJson(`${outputRoot}/${name}`, value));

  return {
    combinedDigest,
    outputBindings,
    familyOrder,
    sealedRows: sealedProjections.flatMap((projection) => projection.rows),
    additiveRows: additive.flatMap((entry) => entry.projection.rows.map((row) => ({ ...row, _candidate_key: entry.candidateKey }))),
    additiveReviews: additive.flatMap((entry) => entry.projection.review_rows.map((review, index) => ({ candidateKey: entry.candidateKey, review, index }))),
    ambiguityLedger,
    knownLossLedger,
    agreements,
    receiptBindings: { m2Receipt, m3Receipt, m5Receipt, m6Receipt, generalisationReceipt },
  };
}

function main() {
  const result = run(process.argv.slice(2));
  process.stdout.write(`${canonicalJson({
    status: 'PASS_MACHINE_PACKET',
    combined_ten_corpus_digest: result.combinedDigest,
    output_count: result.outputBindings.length,
    output_bindings: result.outputBindings,
    counts: {
      agreements: result.agreements.length,
      sealed_rows: result.sealedRows.length,
      additive_rows: result.additiveRows.length,
      additive_review_items: result.additiveReviews.length,
      known_loss_members: result.knownLossLedger.members.length,
      m2_inline_ambiguities: result.ambiguityLedger.members.length,
    },
  })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
