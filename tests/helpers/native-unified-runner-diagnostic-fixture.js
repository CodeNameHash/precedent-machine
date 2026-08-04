'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../../lib/canonical-v2/sec-html-canonical-text');
const { sectionizeAdmittedSource, findSectionByReference } = require('../../lib/canonical-v2/native-producer/deterministic-sectionizer');

function createDiagnosticFixture(rootDir) {
  const rawFilePath = 'tests/fixtures/canonical-v2/native-unified-runner/compact-source.htm';
  const raw = fs.readFileSync(path.resolve(rootDir, rawFilePath));
  const retrievalUrl = 'https://www.sec.gov/Archives/edgar/data/1/topbuild.htm';
  const retrievalPolicyDigest = sha256Hex('native unified runner diagnostic fixture');
  const conversion = convertSecHtmlToCanonicalText(buildSecEdgarIntakeCapture({
    retrieval_url: retrievalUrl,
    final_url: retrievalUrl,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-03T00:00:00.000Z',
    retrieval_policy_digest: retrievalPolicyDigest,
    redirect_count: 0,
    response_bytes: raw,
  }));
  const tree = sectionizeAdmittedSource({ source_text: conversion.canonical_text, document_hash: sha256Hex(raw) });
  function pin(reference) {
    const node = findSectionByReference(tree, reference);
    if (!node) throw new Error(`Missing diagnostic fixture section: ${reference}`);
    return Object.freeze({
      section_reference: node.reference,
      section_id: node.section_id,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
    });
  }
  function localSource(overrides = {}) {
    return {
      source_id: 'topbuild-original',
      disposition: 'ADMITTED_LOCAL',
      raw_file_path: rawFilePath,
      retrieval_url: retrievalUrl,
      retrieved_at: '2026-08-03T00:00:00.000Z',
      retrieval_policy_digest: retrievalPolicyDigest,
      raw_sha256: sha256Hex(raw),
      canonical_text_sha256: conversion.canonical_text_sha256,
      canonical_text_byte_length: conversion.canonical_text_byte_length,
      governed_deal_key: 'deal:topbuild-diagnostic',
      deal_admission_id: sha256Hex('native-unified-runner-diagnostic-deal'),
      source_ordinal: 0,
      ...overrides,
    };
  }
  function extract(workItemId, familyId, reference = '2.1') {
    return {
      work_item_id: workItemId,
      source_id: 'topbuild-original',
      family_id: familyId,
      disposition: 'EXTRACT',
      section_pin: pin(reference),
    };
  }
  function manifest({ sources = [localSource()], workItems = [extract('capitalisation', 'CAPITALISATION')] } = {}) {
    return { schema_version: 'NATIVE_UNIFIED_RUN_MANIFEST/V1', sources, work_items: workItems };
  }
  return Object.freeze({ pin, localSource, extract, manifest });
}

module.exports = { createDiagnosticFixture };
