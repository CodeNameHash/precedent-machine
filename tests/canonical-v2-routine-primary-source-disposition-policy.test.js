'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const {
  POLICY_SCHEMA,
  RoutinePrimarySourceDispositionPolicyError,
  buildRoutinePrimaryDispositionProposal,
} = require('../lib/canonical-v2/routine-primary-source-disposition-policy');

function makeRecord({ dealId, occurrenceId, occurrenceKind = 'METADATA_PRIMARY_SEC_OCCURRENCE', url }) {
  const raw = Buffer.from(`<html><body>${occurrenceId}</body></html>`);
  const discoveryBody = {
    occurrence_id: occurrenceId,
    deal_id: dealId,
    acquirer: null,
    target: null,
    occurrence_kind: occurrenceKind,
    stored_full_text_sha256: occurrenceKind === 'METADATA_PRIMARY_SEC_OCCURRENCE' ? sha256Hex('stored source') : null,
    primary_occurrence_relationship: occurrenceKind === 'METADATA_PRIMARY_SEC_OCCURRENCE'
      ? null
      : { status: 'UNCOMPARED', primary_occurrence_id: `METADATA/${dealId}` },
    source_metadata: { source_url: url, accession_number: null, filing_date: null },
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  const discovery = {
    ...discoveryBody,
    discovery_id: contentId('M3_CORPUS_SOURCE_DISCOVERY_RECORD/V1', discoveryBody),
  };
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: url,
    final_url: url,
    status_code: 200,
    content_type: 'text/html',
    retrieved_at: '2026-08-04T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('retrieval policy'),
    redirect_count: 0,
    response_bytes: raw,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  const receiptBody = {
    schema_version: 'M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1',
    discovery_id: discovery.discovery_id,
    occurrence_id: occurrenceId,
    raw_sha256: sha256Hex(raw),
    capture_id: capture.intake_capture_receipt_id,
    conversion_id: conversion.canonical_text_id,
    verification_id: verification.verification_manifest_id,
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return {
    discovery,
    capture,
    conversion,
    verification,
    receipt: { ...receiptBody, receipt_id: contentId('M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1', receiptBody) },
  };
}

function makeCohort({ dealCount = 2, addTopBuild = true, duplicateUrl = false } = {}) {
  const receiptRecords = [];
  for (let index = 1; index <= dealCount; index += 1) {
    receiptRecords.push(makeRecord({
      dealId: `deal-${index}`,
      occurrenceId: `METADATA/deal-${index}`,
      url: `https://www.sec.gov/Archives/edgar/data/${index}/primary-${index}.htm`,
    }));
  }
  if (addTopBuild) {
    receiptRecords.push(makeRecord({
      dealId: 'deal-1',
      occurrenceId: 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE',
      occurrenceKind: 'DECLARED_ADDITIONAL_SEC_OCCURRENCE',
      url: duplicateUrl
        ? 'https://www.sec.gov/Archives/edgar/data/1/primary-1.htm'
        : 'https://www.sec.gov/Archives/edgar/data/1236275/topbuild-second.htm',
    }));
  }
  const receiptAssociations = receiptRecords.map(({ receipt, discovery }) => ({
    receipt_id: receipt.receipt_id,
    discovery_id: discovery.discovery_id,
    occurrence_id: discovery.occurrence_id,
  })).sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id));
  const manifestBody = {
    schema_version: 'M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1',
    receipt_associations: receiptAssociations,
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return {
    cohort_manifest: {
      ...manifestBody,
      cohort_capture_manifest_id: contentId('M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1', manifestBody),
    },
    receipt_records: receiptRecords,
  };
}

test('makes a content-addressed non-authoritative proposal and routes TopBuild to ordinary multi-occurrence review', () => {
  const proposal = buildRoutinePrimaryDispositionProposal(makeCohort());
  assert.equal(proposal.schema_version, POLICY_SCHEMA);
  assert.equal(proposal.status, 'PROPOSED_NOT_AUTHORITY');
  assert.equal(proposal.admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.equal(proposal.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(proposal.deal_admission_status, 'NOT_ATTEMPTED');
  assert.deepEqual(proposal.routine_primary_source_dispositions.find((row) => row.deal_id === 'deal-1'), {
    deal_id: 'deal-1',
    primary_occurrence_id: 'METADATA/deal-1',
    primary_source_url_sha256: sha256Hex('https://www.sec.gov/Archives/edgar/data/1/primary-1.htm'),
    additional_occurrence_ids: ['TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE'],
    proposed_disposition: 'PROPOSED_ORDINARY_MULTI_OCCURRENCE_INCLUSION_REVIEW_REQUIRED',
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
  });
  const rebuilt = buildRoutinePrimaryDispositionProposal(makeCohort());
  assert.equal(proposal.policy_id, rebuilt.policy_id);
});

test('fails closed for missing or extra receipts, ID association changes, URL changes, redirects, raw changes and bad verification', () => {
  const mutations = [
    (input) => input.receipt_records.pop(),
    (input) => input.receipt_records.push(makeRecord({
      dealId: 'deal-extra',
      occurrenceId: 'METADATA/deal-extra',
      url: 'https://www.sec.gov/Archives/edgar/data/99/extra.htm',
    })),
    (input) => { input.cohort_manifest.receipt_associations.pop(); },
    (input) => { input.receipt_records[0].receipt.discovery_id = '0'.repeat(64); },
    (input) => { input.receipt_records[0].capture.redirect_count = 1; },
    (input) => { input.receipt_records[0].receipt.raw_sha256 = '0'.repeat(64); },
    (input) => { input.receipt_records[0].verification.verification_status = 'FAIL'; },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(makeCohort());
    mutate(input);
    assert.throws(() => buildRoutinePrimaryDispositionProposal(input), RoutinePrimarySourceDispositionPolicyError);
  }
});

test('binds the discovered SEC URL to the exact capture URL digest', () => {
  const input = structuredClone(makeCohort());
  const record = input.receipt_records[0];
  record.discovery.source_metadata.source_url = 'https://www.sec.gov/Archives/edgar/data/1/changed.htm';
  const discoveryBody = { ...record.discovery };
  delete discoveryBody.discovery_id;
  record.discovery.discovery_id = contentId('M3_CORPUS_SOURCE_DISCOVERY_RECORD/V1', discoveryBody);
  record.receipt.discovery_id = record.discovery.discovery_id;
  const receiptBody = { ...record.receipt };
  delete receiptBody.receipt_id;
  record.receipt.receipt_id = contentId('M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1', receiptBody);
  const association = input.cohort_manifest.receipt_associations.find((item) => item.occurrence_id === record.discovery.occurrence_id);
  association.discovery_id = record.discovery.discovery_id;
  association.receipt_id = record.receipt.receipt_id;
  const manifestBody = { ...input.cohort_manifest };
  delete manifestBody.cohort_capture_manifest_id;
  input.cohort_manifest.cohort_capture_manifest_id = contentId('M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1', manifestBody);
  assert.throws(() => buildRoutinePrimaryDispositionProposal(input),
    (error) => error instanceof RoutinePrimarySourceDispositionPolicyError && error.code === 'SOURCE_URL_HASH_MISMATCH');
});

test('fails closed for duplicate SEC URLs and a non-SEC source URL', () => {
  assert.throws(() => buildRoutinePrimaryDispositionProposal(makeCohort({ duplicateUrl: true })),
    (error) => error instanceof RoutinePrimarySourceDispositionPolicyError && error.code === 'DUPLICATE_SOURCE_URL');
  const input = makeCohort();
  input.receipt_records[0].discovery.source_metadata.source_url = 'https://example.com/nope.htm';
  assert.throws(() => buildRoutinePrimaryDispositionProposal(input), RoutinePrimarySourceDispositionPolicyError);
});

module.exports = { makeCohort };
