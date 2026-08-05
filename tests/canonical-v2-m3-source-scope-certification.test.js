'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { RUN_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { RESOLUTION_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  M3SourceScopeCertificationError,
  deriveSourceScopePartition,
  buildM3SourceScopeCertificate,
  validateM3SourceScopeCertificate,
  buildM3SourceScopeCertificationSet,
  validateM3SourceScopeCertificationSet,
} = require('../lib/canonical-v2/native-producer/m3-source-scope-certification');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const DEAL_ADMISSION_ID = 'a'.repeat(64);
const EXTRACTION_REFERENCE_ID = 'b'.repeat(64);
const EXCLUSION_APPROVAL_ID = 'c'.repeat(64);

function source(text, sourceOrdinal = 0) {
  return buildIdentityAdmittedSourceContext(text, {
    dealKey: 'm3-source-scope-test',
    dealAdmissionId: DEAL_ADMISSION_ID,
    sourceOrdinal,
  });
}

function receipts(context, suffix = 'fixture') {
  const runBody = {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: context.document_hash,
    fixture: suffix,
  };
  const runReceipt = {
    ...runBody,
    run_receipt_id: contentId(RUN_RECEIPT_SCHEMA, runBody),
  };
  const resolutionBody = {
    schema_version: RESOLUTION_RECEIPT_SCHEMA,
    run_receipt_id: runReceipt.run_receipt_id,
    document_hash: context.document_hash,
    fixture: suffix,
  };
  return {
    run_receipt: runReceipt,
    resolution_receipt: {
      ...resolutionBody,
      resolution_receipt_id: contentId(RESOLUTION_RECEIPT_SCHEMA, resolutionBody),
    },
  };
}

function extractedDispositions(context) {
  return deriveSourceScopePartition({ admitted_source_context: context }).atomic_units.map((unit) => ({
    start: unit.start,
    end: unit.end,
    disposition: 'EXTRACTED',
    extraction_reference_id: EXTRACTION_REFERENCE_ID,
  }));
}

function certificate(context, dispositions = extractedDispositions(context), suffix = 'fixture') {
  return buildM3SourceScopeCertificate({
    admitted_source_context: context,
    ...receipts(context, suffix),
    dispositions,
  });
}

test('M3 source-scope certificate derives an ordered complete byte partition and content-addressed roots', () => {
  const context = source([
    'ARTICLE I',
    'Section 1.1 First.',
    '(a) Alpha.',
    '(b) Beta.',
    'Section 1.2 Second.',
    '',
  ].join('\n'));
  const partition = deriveSourceScopePartition({ admitted_source_context: context });
  assert.equal(partition.atomic_units[0].start, 0);
  assert.equal(partition.atomic_units.at(-1).end, context.canonical_text_byte_length);
  assert.ok(partition.atomic_units.every((unit, index) =>
    index === 0 || partition.atomic_units[index - 1].end === unit.start));

  const result = certificate(context);
  assert.equal(result.certification_status, 'CERTIFIED');
  assert.equal(result.unresolved_unit_count, 0);
  assert.match(result.section_tree_root_id, /^[a-f0-9]{64}$/);
  assert.match(result.inventory_root_id, /^[a-f0-9]{64}$/);
  assert.match(result.disposition_root_id, /^[a-f0-9]{64}$/);
  assert.match(result.execution_root_id, /^[a-f0-9]{64}$/);
  assert.equal(validateM3SourceScopeCertificate(result), true);
});

test('M3 source-scope certificate is blocked by unresolved units but retains explicit disposition', () => {
  const context = source('Section 1.1 Scope.\n');
  const dispositions = extractedDispositions(context);
  dispositions[0] = {
    start: dispositions[0].start,
    end: dispositions[0].end,
    disposition: 'UNRESOLVED',
    unresolved_reason: 'NO_EXTRACTION_RESULT',
  };
  const result = certificate(context, dispositions);
  assert.equal(result.certification_status, 'BLOCKED_UNRESOLVED');
  assert.equal(result.unresolved_unit_count, 1);
  assert.equal(validateM3SourceScopeCertificate(result), true);
});

test('M3 source-scope certificate fails closed for gaps, overlaps and default exclusions', () => {
  const context = source('Section 1.1 Scope.\n(a) Alpha.\n');
  const dispositions = extractedDispositions(context);
  assert.throws(
    () => certificate(context, dispositions.slice(1)),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'DISPOSITION_COUNT_MISMATCH',
  );
  const gapped = [...dispositions];
  gapped[0] = {
    ...gapped[0],
    start: gapped[0].start + 1,
  };
  assert.throws(
    () => certificate(context, gapped),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'PARTITION_DISPOSITION_GAP',
  );
  const overlapping = [...dispositions];
  overlapping[1] = { ...overlapping[0] };
  assert.throws(
    () => certificate(context, overlapping),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'DUPLICATE_DISPOSITION',
  );
  const excluded = extractedDispositions(context);
  excluded[0] = {
    start: excluded[0].start,
    end: excluded[0].end,
    disposition: 'APPROVED_EXCLUDED',
  };
  assert.throws(
    () => certificate(context, excluded),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'DEFAULT_EXCLUSION',
  );
  excluded[0] = {
    start: excluded[0].start,
    end: excluded[0].end,
    disposition: 'APPROVED_EXCLUDED',
    exclusion_approval_id: EXCLUSION_APPROVAL_ID,
  };
  assert.equal(certificate(context, excluded).certification_status, 'CERTIFIED');
});

test('M3 source-scope certificate rejects changed identities and stale or mismatched receipts', () => {
  const context = source('Section 1.1 Scope.\n');
  const changedContextBody = {
    ...context,
    canonical_text_id: 'd'.repeat(64),
    canonical_text: {
      ...context.canonical_text,
      canonical_text_id: 'd'.repeat(64),
    },
  };
  delete changedContextBody.admitted_semantic_source_context_id;
  const changedContext = {
    ...changedContextBody,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
      changedContextBody,
    ),
  };
  assert.throws(
    () => certificate(changedContext),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'CANONICAL_TEXT_IDENTITY_MISMATCH',
  );
  const stale = receipts(context);
  stale.run_receipt.document_hash = 'e'.repeat(64);
  assert.throws(
    () => buildM3SourceScopeCertificate({
      admitted_source_context: context,
      ...stale,
      dispositions: extractedDispositions(context),
    }),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'RECEIPT_DOCUMENT_MISMATCH',
  );
  const mismatched = receipts(context);
  mismatched.resolution_receipt.run_receipt_id = 'f'.repeat(64);
  mismatched.resolution_receipt.resolution_receipt_id = contentId(
    RESOLUTION_RECEIPT_SCHEMA,
    (() => {
      const body = { ...mismatched.resolution_receipt };
      delete body.resolution_receipt_id;
      return body;
    })(),
  );
  assert.throws(
    () => buildM3SourceScopeCertificate({
      admitted_source_context: context,
      ...mismatched,
      dispositions: extractedDispositions(context),
    }),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'RECEIPT_RUN_MISMATCH',
  );
});

test('M3 source-scope certification set is order independent and rejects duplicate, missing and extra sources', () => {
  const first = source('Section 1.1 First.\n', 0);
  const second = source('Section 1.1 Second.\n', 1);
  const firstCertificate = certificate(first, undefined, 'first');
  const secondCertificate = certificate(second, undefined, 'second');
  const ordered = buildM3SourceScopeCertificationSet({
    admitted_source_contexts: [first, second],
    certificates: [firstCertificate, secondCertificate],
  });
  const reversed = buildM3SourceScopeCertificationSet({
    admitted_source_contexts: [second, first],
    certificates: [secondCertificate, firstCertificate],
  });
  assert.equal(
    ordered.m3_source_scope_certification_set_id,
    reversed.m3_source_scope_certification_set_id,
  );
  assert.equal(validateM3SourceScopeCertificationSet(ordered), true);
  const blockedDispositions = extractedDispositions(second);
  blockedDispositions[0] = {
    start: blockedDispositions[0].start,
    end: blockedDispositions[0].end,
    disposition: 'UNRESOLVED',
    unresolved_reason: 'NO_EXTRACTION_RESULT',
  };
  const blocked = buildM3SourceScopeCertificationSet({
    admitted_source_contexts: [first, second],
    certificates: [firstCertificate, certificate(second, blockedDispositions, 'blocked')],
  });
  assert.equal(blocked.certification_status, 'BLOCKED_UNRESOLVED');
  assert.throws(
    () => buildM3SourceScopeCertificationSet({
      admitted_source_contexts: [first, second],
      certificates: [firstCertificate],
    }),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'CERTIFICATE_SOURCE_SET_MISMATCH',
  );
  assert.throws(
    () => buildM3SourceScopeCertificationSet({
      admitted_source_contexts: [first, second],
      certificates: [firstCertificate, firstCertificate],
    }),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'DUPLICATE_CERTIFICATE_SOURCE',
  );
  assert.throws(
    () => buildM3SourceScopeCertificationSet({
      admitted_source_contexts: [first],
      certificates: [firstCertificate, secondCertificate],
    }),
    (error) => error instanceof M3SourceScopeCertificationError
      && error.code === 'CERTIFICATE_SOURCE_SET_MISMATCH',
  );
});
