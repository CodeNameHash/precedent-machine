#!/usr/bin/env node

import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const {
  buildAdmittedSemanticSourceContext,
} = require('../lib/canonical-v2/admitted-semantic-source');
const {
  buildAdmittedParserProposalEnvelope,
} = require('../lib/canonical-v2/admitted-parser-proposal-adapter');
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildAcceptedDefinitionCandidateDisposition,
  buildNoModelInferenceTranscriptSetMarker,
  buildReviewedDefinitionGraphPackage,
} = require('../lib/canonical-v2/reviewed-definition-graph-package');
const {
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const {
  buildQxoTierBParserBoundReviewSeed,
  validateQxoTierBParserBoundReviewSeed,
} = require('../lib/canonical-v2/qxo-tier-b-parser-bridge');
const {
  convertSecHtmlToCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text');
const {
  verifySecHtmlCanonicalText,
} = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  buildVerifiedSecSourceAdmission,
} = require('../lib/canonical-v2/sec-source-admission');
const {
  buildSemanticSpan,
} = require('../lib/canonical-v2/source-structure');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const REVIEW_PATH = join(
  ROOT,
  'tests/fixtures/canonical-v2/qxo-tier-b-staging-lineage-review.json',
);
const DEAL_KEY = 'deal:qxo-topbuild';
const MAX_ATTESTATION_BYTES = 8 * 1024;
const MAX_ATTESTATION_NODES = 2048;
const SHA256_RE = /^[a-f0-9]{64}$/;
const REVIEW_FINDINGS = Object.freeze([
  'SOURCE_GEOMETRY_ACCEPTED',
  'NESTED_DECLARATION_ACCEPTED',
  'TIER_B_OPERATIVE_USE_ACCEPTED',
  'CAPITALISATION_LIMBS_I_AND_III_ACCEPTED',
  'PARENT_MAPPING_LIMITED_TO_EXISTING_REVIEWED_REFERENCE',
  'MERGER_SUBSIDIARIES_OBSERVED_UNASSIGNED',
  'KNOWLEDGE_ABSENCES_WITHHELD',
  'USES_DEFINITION_AUTHORITY_ABSENT',
  'COMPARABILITY_QUERY_SERVING_RELEASE_WRITE_AUTHORITY_ABSENT',
  'FAILURE_ISOLATION_ACCEPTED',
]);
const REVIEWER_IDENTITY = Object.freeze({
  actor_kind: 'AI_REVIEW_AGENT',
  provider: 'OPENAI_CODEX',
  review_lane: 'INDEPENDENT_LEGAL_SEMANTIC',
  identity_attestation_state: 'UNAVAILABLE',
});
const MAX_SQL_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function guardProject() {
  const ref = readFileSync(join(ROOT, 'supabase/.temp/project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(
    join(ROOT, 'supabase/.temp/linked-project.json'),
    'utf8',
  ));
  if (ref !== PROJECT.ref || linked.ref !== PROJECT.ref || linked.name !== PROJECT.name) {
    throw new Error(`Refusing to run outside ${PROJECT.name} (${PROJECT.ref}).`);
  }
}

function safeDiagnostic(output) {
  const lines = String(output || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const line = lines.find((item) => /(?:ERROR|DETAIL|HINT):/i.test(item)) || lines.at(-1);
  if (!line) return 'Canonical QXO Tier B staging read failed.';
  return line
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted-database-url]')
    .replace(
      /((?:password|token|secret|api[_-]?key|service[_-]?role[_-]?key)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1[redacted]',
    )
    .slice(0, 500);
}

function sqlText(value) {
  if (typeof value !== 'string') throw new TypeError('SQL text value must be a string.');
  return `'${value.replaceAll("'", "''")}'`;
}

function runReadOnlySql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new TypeError('QXO Tier B staging SQL must be a non-empty string.');
  }
  if (Buffer.byteLength(sql, 'utf8') > MAX_SQL_BYTES) {
    throw new Error('QXO Tier B staging SQL exceeded its bounded request limit.');
  }
  guardProject();
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-qxo-tier-b-attestation-'));
  const file = join(directory, 'read-only.sql');
  writeFileSync(file, `BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
${sql}
ROLLBACK;
`, { mode: 0o600 });
  try {
    const result = spawnSync(
      'supabase',
      [
        '--workdir',
        ROOT,
        'db',
        'query',
        '--linked',
        '--file',
        file,
        '--output',
        'json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 90_000,
        maxBuffer: 6 * 1024 * 1024,
        shell: false,
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error(safeDiagnostic(
        `${result.error?.message || ''}\n${result.stderr || ''}`,
      ));
    }
    if (Buffer.byteLength(result.stdout || '', 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('QXO Tier B staging read exceeded its bounded response limit.');
    }
    const payload = JSON.parse(result.stdout);
    if (!payload || !Array.isArray(payload.rows)) {
      throw new Error('QXO Tier B staging read returned no rows array.');
    }
    return payload.rows;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function exactKeys(value, keys, label) {
  if (!plainObject(value)) throw new Error(`${label} is outside its closed contract.`);
  const actual = Object.keys(value);
  const permitted = new Set(keys);
  if (actual.length !== permitted.size || actual.some((key) => !permitted.has(key))) {
    throw new Error(`${label} is outside its closed contract.`);
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value)) throw new Error(`${label} must be a SHA-256 digest.`);
  return value;
}

function requireInterval(interval, label) {
  exactKeys(interval, ['absolute_start', 'absolute_end', 'exact_bytes_digest'], label);
  if (!Number.isSafeInteger(interval.absolute_start)
    || !Number.isSafeInteger(interval.absolute_end)
    || interval.absolute_start < 0
    || interval.absolute_end <= interval.absolute_start) {
    throw new Error(`${label} must be a non-empty byte interval.`);
  }
  requireDigest(interval.exact_bytes_digest, `${label}.exact_bytes_digest`);
  return interval;
}

function reviewBody(review) {
  const {
    qxo_tier_b_staging_lineage_review_id: _reviewId,
    canonical_payload_digest: _payloadDigest,
    ...body
  } = review;
  return body;
}

function validateReview(review) {
  exactKeys(review, [
    'schema_version',
    'authority_scope',
    'review_eligibility_state',
    'reviewer_identity',
    'reviewer_identity_digest',
    'source_selection',
    'reviewed_definition_geometry',
    'expected_lineage',
    'review_findings',
    'qxo_tier_b_staging_lineage_review_id',
    'canonical_payload_digest',
  ], 'QXO Tier B staging lineage review');
  if (review.schema_version !== 'QXO_TIER_B_STAGING_LINEAGE_REVIEW/V1'
    || review.authority_scope !== 'STAGING_SOURCE_BACKED_REPRODUCTION_ONLY'
    || review.review_eligibility_state !== 'UNVERIFIED_IDENTITY') {
    throw new Error('QXO Tier B staging lineage review authority has drifted.');
  }
  exactKeys(review.reviewer_identity, [
    'actor_kind',
    'provider',
    'review_lane',
    'identity_attestation_state',
  ], 'reviewer_identity');
  if (canonicalJson(review.reviewer_identity) !== canonicalJson(REVIEWER_IDENTITY)) {
    throw new Error('QXO Tier B staging reviewer descriptor has drifted.');
  }
  const reviewerIdentityDigest = contentId(
    'QXO_TIER_B_STAGING_REVIEWER_DESCRIPTOR/V1',
    review.reviewer_identity,
  );
  if (review.reviewer_identity_digest !== reviewerIdentityDigest) {
    throw new Error('QXO Tier B staging reviewer descriptor identity has drifted.');
  }
  exactKeys(review.source_selection, [
    'retrieval_url_sha256',
    'response_bytes_sha256',
  ], 'source_selection');
  requireDigest(review.source_selection.retrieval_url_sha256, 'retrieval_url_sha256');
  requireDigest(review.source_selection.response_bytes_sha256, 'response_bytes_sha256');
  exactKeys(review.reviewed_definition_geometry, [
    'neutral_defined_term',
    'syntactic_role',
    'term_interval',
    'body_intervals',
    'use_intervals',
  ], 'reviewed_definition_geometry');
  if (review.reviewed_definition_geometry.neutral_defined_term
      !== 'De Minimis Inaccuracies'
    || review.reviewed_definition_geometry.syntactic_role !== 'NESTED_INLINE') {
    throw new Error('QXO Tier B staging reviewed definition classification has drifted.');
  }
  requireInterval(review.reviewed_definition_geometry.term_interval, 'term_interval');
  if (!Array.isArray(review.reviewed_definition_geometry.body_intervals)
    || review.reviewed_definition_geometry.body_intervals.length !== 1) {
    throw new Error('QXO Tier B staging review requires one definition body interval.');
  }
  review.reviewed_definition_geometry.body_intervals.forEach(
    (interval, index) => requireInterval(interval, `body_intervals[${index}]`),
  );
  if (!Array.isArray(review.reviewed_definition_geometry.use_intervals)
    || review.reviewed_definition_geometry.use_intervals.length !== 2) {
    throw new Error('QXO Tier B staging review requires two definition use intervals.');
  }
  review.reviewed_definition_geometry.use_intervals.forEach((use, index) => {
    exactKeys(use, [
      'absolute_start',
      'absolute_end',
      'exact_bytes_digest',
      'use_role',
      'source_order_ordinal',
    ], `use_intervals[${index}]`);
    requireInterval({
      absolute_start: use.absolute_start,
      absolute_end: use.absolute_end,
      exact_bytes_digest: use.exact_bytes_digest,
    }, `use_intervals[${index}]`);
    const expectedRole = index === 0 ? 'OPERATIVE_REFERENCE' : 'DECLARATION_REFERENCE';
    if (use.use_role !== expectedRole || use.source_order_ordinal !== index) {
      throw new Error('QXO Tier B staging definition use order has drifted.');
    }
  });
  if (!plainObject(review.expected_lineage)) {
    throw new Error('QXO Tier B staging expected lineage must be an object.');
  }
  if (canonicalJson(review.review_findings) !== canonicalJson(REVIEW_FINDINGS)) {
    throw new Error('QXO Tier B staging legal-semantic findings have drifted.');
  }
  const body = reviewBody(review);
  if (review.qxo_tier_b_staging_lineage_review_id !== contentId(
    'QXO_TIER_B_STAGING_LINEAGE_REVIEW/V1',
    body,
  ) || review.canonical_payload_digest !== contentId(
    'QXO_TIER_B_STAGING_LINEAGE_REVIEW_PAYLOAD/V1',
    body,
  )) {
    throw new Error('QXO Tier B staging lineage review identity has drifted.');
  }
  return review;
}

function readReview() {
  return validateReview(JSON.parse(readFileSync(REVIEW_PATH, 'utf8')));
}

function readStoredSourceLineage(review) {
  const expected = review.expected_lineage;
  const rows = runReadOnlySql(
    `SELECT jsonb_build_object(
       'capture', capture.canonical_payload,
       'conversion', conversion.canonical_payload,
       'verification', verification.canonical_payload,
       'immutable_source_document', immutable.canonical_payload,
       'source_admission_manifest', admission.canonical_payload,
       'semantic_extraction_input_envelope', envelope.canonical_payload,
       'deal', deal.canonical_payload
     ) AS source_lineage
     FROM canonical_v2_staging.intake_capture_receipts AS capture
     JOIN canonical_v2_staging.canonical_text_conversions AS conversion
       ON conversion.intake_capture_receipt_id=capture.intake_capture_receipt_id
      AND conversion.canonical_text_id=${sqlText(expected.canonical_text_id)}
     JOIN canonical_v2_staging.canonical_text_verification_manifests AS verification
       ON verification.intake_capture_receipt_id=capture.intake_capture_receipt_id
      AND verification.canonical_text_id=conversion.canonical_text_id
      AND verification.verification_manifest_id=${sqlText(expected.verification_manifest_id)}
     JOIN canonical_v2_staging.immutable_source_documents AS immutable
       ON immutable.immutable_source_document_id=${sqlText(expected.immutable_source_document_id)}
     JOIN canonical_v2_staging.source_admission_manifests AS admission
       ON admission.source_admission_manifest_id=${sqlText(expected.source_admission_manifest_id)}
     JOIN canonical_v2_staging.semantic_extraction_input_envelopes AS envelope
       ON envelope.semantic_extraction_input_envelope_id=${sqlText(expected.semantic_extraction_input_envelope_id)}
     JOIN canonical_v2_staging.deals AS deal
       ON deal.deal_key=${sqlText(DEAL_KEY)}
     WHERE capture.intake_capture_receipt_id=${sqlText(expected.intake_capture_receipt_id)}
       AND capture.retrieval_url_sha256=${sqlText(review.source_selection.retrieval_url_sha256)}
       AND capture.response_bytes_sha256=${sqlText(review.source_selection.response_bytes_sha256)}
       AND immutable.canonical_payload->>'canonical_text_id'=conversion.canonical_text_id
       AND immutable.canonical_payload->>'verification_manifest_id'=verification.verification_manifest_id
       AND admission.canonical_payload->>'immutable_source_document_id'=immutable.immutable_source_document_id
       AND admission.canonical_payload->>'canonical_text_id'=conversion.canonical_text_id
       AND envelope.immutable_source_document_id=immutable.immutable_source_document_id
       AND envelope.source_admission_manifest_id=admission.source_admission_manifest_id
       AND envelope.verification_manifest_id=verification.verification_manifest_id
       AND envelope.canonical_text_id=conversion.canonical_text_id
       AND deal.canonical_payload->>'deal_admission_id'=${sqlText(expected.deal_admission_id)}
       AND deal.canonical_payload->>'document_hash'=${sqlText(expected.document_hash)}
     LIMIT 2;`,
  );
  if (rows.length !== 1 || !plainObject(rows[0]?.source_lineage)) {
    throw new Error('The exact persisted QXO source lineage must resolve once.');
  }
  return rows[0].source_lineage;
}

function exactTermIntervals(source, term, sectionSpan) {
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');
  const token = Buffer.from(term, 'utf8');
  const intervals = [];
  let offset = sectionSpan.absolute_start;
  while (offset < sectionSpan.absolute_end) {
    const start = bytes.indexOf(token, offset);
    if (start < 0 || start >= sectionSpan.absolute_end) break;
    intervals.push({ start, end: start + token.length });
    offset = start + token.length;
  }
  if (intervals.length !== 2) {
    throw new Error('The exact admitted Section 5.2 must contain two defined-term tokens.');
  }
  return intervals;
}

function intervalFromSpan(span) {
  return {
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
  };
}

function buildReproduction(review) {
  const contractBundle = compileFixtureContract();
  const stored = readStoredSourceLineage(review);
  const capture = stored.capture;
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const admission = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const dealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id:
      admission.source_admission_manifest.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const sourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
  const rebuiltStoredObjects = {
    capture,
    conversion,
    verification,
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    deal: {
      deal_key: DEAL_KEY,
      deal_admission_id: dealAdmissionId,
      document_hash: sourceContext.document_hash,
    },
  };
  for (const [key, rebuilt] of Object.entries(rebuiltStoredObjects)) {
    if (canonicalJson(stored[key]) !== canonicalJson(rebuilt)) {
      throw new Error(`The persisted QXO ${key} payload has drifted.`);
    }
  }
  const parserInputs = {
    contract_bundle: contractBundle,
    immutable_source_document: admission.immutable_source_document,
    source_admission_manifest: admission.source_admission_manifest,
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
    conversion,
    admitted_source_context: sourceContext,
  };
  const parserEnvelope = buildAdmittedParserProposalEnvelope(parserInputs);
  const candidates = parserEnvelope.definition_candidates.filter(
    (candidate) => candidate.neutral_defined_term
      === review.reviewed_definition_geometry.neutral_defined_term,
  );
  if (candidates.length !== 1) {
    throw new Error('The exact QXO parser envelope must contain one reviewed definition candidate.');
  }
  const candidate = candidates[0];
  const section52Parents = parserEnvelope.structural_section_proposals.filter(
    (proposal) => proposal.admitted_structural_section_proposal_id
      === candidate.parent_structural_section_proposal_id
      && proposal.section_number === '5.2',
  );
  if (section52Parents.length !== 1) {
    throw new Error('The exact QXO definition candidate must have one admitted Section 5.2 parent.');
  }
  const section52 = section52Parents[0];
  const [operativeInterval, declarationInterval] = exactTermIntervals(
    sourceContext,
    candidate.neutral_defined_term,
    section52.evidence_anchor,
  );
  const sourceBytes = Buffer.from(sourceContext.canonical_text.text, 'utf8');
  const bodyPrefix = Buffer.from('” means ', 'utf8');
  const bodyPrefixStart = sourceBytes.indexOf(bodyPrefix, declarationInterval.end);
  if (bodyPrefixStart !== declarationInterval.end) {
    throw new Error('The exact QXO nested definition declaration boundary has drifted.');
  }
  const bodyStart = bodyPrefixStart + bodyPrefix.length;
  const bodyEnd = sourceBytes.indexOf(Buffer.from(';', 'utf8'), bodyStart);
  if (bodyEnd <= bodyStart || bodyEnd > section52.evidence_anchor.absolute_end) {
    throw new Error('The exact QXO nested definition body boundary has drifted.');
  }
  const termSpan = buildSemanticSpan(
    sourceContext,
    declarationInterval.start,
    declarationInterval.end,
  );
  const bodySpan = buildSemanticSpan(sourceContext, bodyStart, bodyEnd);
  const operativeUseSpan = buildSemanticSpan(
    sourceContext,
    operativeInterval.start,
    operativeInterval.end,
  );
  const geometry = {
    neutral_defined_term: candidate.neutral_defined_term,
    syntactic_role: 'NESTED_INLINE',
    term_interval: intervalFromSpan(termSpan),
    body_intervals: [intervalFromSpan(bodySpan)],
    use_intervals: [
      {
        ...intervalFromSpan(operativeUseSpan),
        use_role: 'OPERATIVE_REFERENCE',
        source_order_ordinal: 0,
      },
      {
        ...intervalFromSpan(termSpan),
        use_role: 'DECLARATION_REFERENCE',
        source_order_ordinal: 1,
      },
    ],
  };
  if (canonicalJson(geometry) !== canonicalJson(review.reviewed_definition_geometry)) {
    throw new Error('The exact QXO reviewed definition geometry has drifted.');
  }
  const reviewedDisposition = buildAcceptedDefinitionCandidateDisposition({
    source: sourceContext,
    candidate,
    term_span: termSpan,
    body_spans: [bodySpan],
    use_spans: [
      {
        span: operativeUseSpan,
        use_role: 'OPERATIVE_REFERENCE',
        source_order_ordinal: 0,
      },
      {
        span: termSpan,
        use_role: 'DECLARATION_REFERENCE',
        source_order_ordinal: 1,
      },
    ],
    syntactic_role: 'NESTED_INLINE',
    reviewer_identity_digest: review.reviewer_identity_digest,
  });
  const marker = buildNoModelInferenceTranscriptSetMarker({
    semantic_extraction_input_envelope:
      admission.semantic_extraction_input_envelope,
  });
  const packageInputs = {
    ...parserInputs,
    admitted_parser_proposal_envelope: parserEnvelope,
    inference_transcript_set_marker: marker,
    reviewed_candidate_dispositions: [reviewedDisposition],
    governed_parent_section_proposal_ids: [
      section52.admitted_structural_section_proposal_id,
    ],
  };
  const definitionPackage = buildReviewedDefinitionGraphPackage(packageInputs);
  const capitalisationSlice = buildQxoReviewedCapitalisationSlice({
    sourceContext,
    contractBundle,
  });
  const bridgeInputs = {
    ...packageInputs,
    reviewed_definition_graph_package: definitionPackage,
    reviewed_capitalisation_slice: capitalisationSlice,
  };
  const seed = buildQxoTierBParserBoundReviewSeed(bridgeInputs);
  validateQxoTierBParserBoundReviewSeed({
    qxo_tier_b_parser_bound_review_seed: seed,
    ...bridgeInputs,
  });
  const lineage = {
    contract_fingerprint: contractBundle.fingerprint,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    verification_manifest_id: verification.verification_manifest_id,
    immutable_source_document_id:
      admission.immutable_source_document.immutable_source_document_id,
    source_admission_manifest_id:
      admission.source_admission_manifest.source_admission_manifest_id,
    semantic_extraction_input_envelope_id:
      admission.semantic_extraction_input_envelope
        .semantic_extraction_input_envelope_id,
    admitted_semantic_source_context_id:
      sourceContext.admitted_semantic_source_context_id,
    deal_admission_id: sourceContext.deal_admission_id,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    parser_runtime_manifest_id: parserEnvelope.parser_runtime_manifest_id,
    parser_runtime_manifest_payload_digest:
      parserEnvelope.parser_runtime_manifest_payload_digest,
    admitted_parser_proposal_envelope_id:
      parserEnvelope.admitted_parser_proposal_envelope_id,
    admitted_parser_proposal_envelope_payload_digest:
      parserEnvelope.canonical_payload_digest,
    section_5_2_proposal_id:
      section52.admitted_structural_section_proposal_id,
    definition_candidate_id: candidate.admitted_definition_candidate_id,
    reviewed_definition_candidate_disposition_id:
      reviewedDisposition.reviewed_definition_candidate_disposition_id,
    inference_transcript_set_marker_id:
      marker.semantic_inference_transcript_set_marker_id,
    reviewed_definition_graph_package_id:
      definitionPackage.reviewed_definition_graph_package_id,
    reviewed_definition_graph_package_payload_digest:
      definitionPackage.canonical_payload_digest,
    definition_graph_normaliser_id:
      definitionPackage.normaliser_identity.definition_graph_normaliser_id,
    definition_graph_normaliser_semantic_closure_digest:
      definitionPackage.normaliser_identity.executable_semantic_closure_digest,
    validated_semantic_graph_id:
      definitionPackage.validated_semantic_graph.validated_semantic_graph_id,
    reviewed_mapping_id:
      capitalisationSlice.reviewed_mapping.reviewed_mapping_id,
    qxo_tier_b_parser_bound_review_seed_id:
      seed.qxo_tier_b_parser_bound_review_seed_id,
    qxo_tier_b_parser_bound_review_seed_payload_digest:
      seed.canonical_payload_digest,
    section_3_1_proposal_id:
      seed.parser_binding.section_3_1_proposal_id,
  };
  if (canonicalJson(lineage) !== canonicalJson(review.expected_lineage)) {
    throw new Error('The exact QXO staging source-backed lineage has drifted.');
  }
  return { lineage, parserEnvelope, seed };
}

function preflightAttestation(value) {
  const stack = [value];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    nodes += 1;
    if (nodes > MAX_ATTESTATION_NODES) {
      throw new Error('The QXO Tier B staging attestation exceeds its node limit.');
    }
    if (typeof current === 'string') {
      stringBytes += Buffer.byteLength(current, 'utf8');
      if (stringBytes > MAX_ATTESTATION_BYTES) {
        throw new Error('The QXO Tier B staging attestation exceeds 8 KiB.');
      }
    } else if (Array.isArray(current)) {
      current.forEach((item) => stack.push(item));
    } else if (current && typeof current === 'object') {
      Object.entries(current).forEach(([key, child]) => {
        stringBytes += Buffer.byteLength(key, 'utf8');
        stack.push(child);
      });
    }
  }
  if (Buffer.byteLength(canonicalJson(value), 'utf8') > MAX_ATTESTATION_BYTES) {
    throw new Error('The QXO Tier B staging attestation exceeds 8 KiB.');
  }
}

function attest(review, reproduction) {
  const body = {
    schema_version: 'QXO_TIER_B_STAGING_REPRODUCTION_ATTESTATION/V1',
    environment: 'staging',
    mode: 'VERIFIED_READ_ONLY',
    authority_scope: 'REVIEW_ONLY_NO_CANONICAL_WRITE',
    staging_project_ref: PROJECT.ref,
    source_selection: review.source_selection,
    review_binding: {
      qxo_tier_b_staging_lineage_review_id:
        review.qxo_tier_b_staging_lineage_review_id,
      reviewer_identity_digest: review.reviewer_identity_digest,
      review_identity_attestation_state:
        review.reviewer_identity.identity_attestation_state,
      review_eligibility_state: review.review_eligibility_state,
    },
    lineage: reproduction.lineage,
    retained_parser_residual_summary:
      reproduction.seed.parser_binding.retained_parser_residual_summary,
    status: reproduction.seed.status,
    database_round_trip_count: 1,
    database_write_count: 0,
  };
  const attestation = {
    ...body,
    qxo_tier_b_staging_reproduction_attestation_id: contentId(
      'QXO_TIER_B_STAGING_REPRODUCTION_ATTESTATION/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_TIER_B_STAGING_REPRODUCTION_ATTESTATION_PAYLOAD/V1',
      body,
    ),
  };
  preflightAttestation(attestation);
  return attestation;
}

if (process.argv.length !== 3 || process.argv[2] !== '--verify') {
  fail('Usage: node scripts/canonical-v2-staging-qxo-tier-b-attestation.mjs --verify');
}

try {
  guardProject();
  const review = readReview();
  const reproduction = buildReproduction(review);
  process.stdout.write(`${canonicalJson(attest(review, reproduction))}\n`);
} catch (error) {
  fail(error instanceof Error
    ? error.message
    : 'Canonical QXO Tier B staging attestation failed.');
}
