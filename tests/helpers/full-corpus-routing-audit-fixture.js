'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { contentId, sha256Hex, utf8ByteLength } = require('../../lib/canonical-v2/canonical-bytes');

const FIXTURE_RECEIPT_COHORT_COUNT = 41;
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');

function digest(label) {
  return sha256Hex(label);
}

function receipt(index, occurrenceId) {
  const body = {
    schema_version: 'M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1',
    discovery_id: digest(`discovery:${index}`),
    occurrence_id: occurrenceId,
    raw_sha256: digest(`raw:${index}`),
    capture_id: digest(`capture:${index}`),
    conversion_id: digest(`conversion:${index}`),
    verification_id: digest(`verification:${index}`),
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return { ...body, receipt_id: contentId('M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1', body) };
}

function buildFullCorpusRoutingAuditFixture() {
  const capture_records = [];
  const receipt_associations = [];
  for (let index = 0; index < FIXTURE_RECEIPT_COHORT_COUNT; index += 1) {
    const occurrence_id = index === 0 ? 'METADATA/7dc3a05f-b170-4d59-a255-b7103cca16e1'
      : index === 1 ? 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE'
        : `METADATA/test-${index}`;
    const itemReceipt = receipt(index, occurrence_id);
    const canonical_text = index < 2
      ? 'ARTICLE I\nDEFINITIONS AND REMEDIES\n\nSection 1.1 Definitions and Specific Performance\n“Company Material Adverse Effect” means any event, change or circumstance.\n'
      : 'ARTICLE I\nTERMINATION\n\nSection 1.1 Termination Rights\nThe agreement may be terminated.\n';
    capture_records.push({
      discovery: {
        discovery_id: itemReceipt.discovery_id,
        occurrence_id,
        deal_id: index < 2 ? 'topbuild' : `deal-${index}`,
      },
      receipt: itemReceipt,
      conversion: {
        intake_capture_receipt_id: itemReceipt.capture_id,
        source_admission_status: 'NOT_ATTEMPTED',
        canonical_text,
        canonical_text_sha256: sha256Hex(canonical_text),
        canonical_text_byte_length: utf8ByteLength(canonical_text),
      },
    });
    receipt_associations.push({
      receipt_id: itemReceipt.receipt_id,
      discovery_id: itemReceipt.discovery_id,
      occurrence_id,
    });
  }
  const cohortBody = {
    schema_version: 'M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1',
    receipt_associations,
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
  };
  return {
    capture_records,
    cohort_manifest: {
      ...cohortBody,
      cohort_capture_manifest_id: contentId('M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1', cohortBody),
    },
  };
}

function writeFullCorpusRoutingAuditFixtureRoot() {
  const root = fs.mkdtempSync(path.join(REPOSITORY_ROOT, '.full-corpus-routing-audit-'));
  const captureRoot = path.join(root, 'm3-corpus-source-capture');
  const fixture = buildFullCorpusRoutingAuditFixture();
  fs.mkdirSync(captureRoot, { recursive: true });
  fs.writeFileSync(
    path.join(captureRoot, 'cohort-capture-manifest.json'),
    `${JSON.stringify(fixture.cohort_manifest, null, 2)}\n`,
  );
  fixture.capture_records.forEach((record, index) => {
    const directory = path.join(captureRoot, `source-${String(index).padStart(2, '0')}`);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'discovery.json'), `${JSON.stringify(record.discovery, null, 2)}\n`);
    fs.writeFileSync(path.join(directory, 'intake-receipt.json'), `${JSON.stringify(record.receipt, null, 2)}\n`);
    fs.writeFileSync(path.join(directory, 'canonical-conversion.json'), `${JSON.stringify(record.conversion, null, 2)}\n`);
  });
  return root;
}

module.exports = {
  FIXTURE_RECEIPT_COHORT_COUNT,
  buildFullCorpusRoutingAuditFixture,
  writeFullCorpusRoutingAuditFixtureRoot,
};
