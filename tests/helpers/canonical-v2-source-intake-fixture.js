'use strict';

const { contentId, sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../../lib/canonical-v2/sec-html-canonical-text-verifier');

function makeRecord({ dealId, occurrenceId, occurrenceKind = 'METADATA_PRIMARY_SEC_OCCURRENCE', url, sourceText = occurrenceId }) {
  const raw = Buffer.from(`<html><body>${sourceText}</body></html>`);
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

module.exports = { makeRecord, makeCohort };
