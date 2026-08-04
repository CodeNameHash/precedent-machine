const path = require('node:path');
const { contentId, sha256Hex } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');

const SEC_HOST = 'www.sec.gov';

function fail(message) {
  throw new Error(`M3 corpus source discovery/capture: ${message}`);
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isSecHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === SEC_HOST && url.username === '' && url.password === '';
  } catch (_) {
    return false;
  }
}

function assertAbsoluteDurablePath(value, label) {
  try {
    return resolveDurableArtifactRoot({ root: value, certificationMode: true, requireExisting: true });
  } catch (error) {
    fail(`${label} is not an existing durable absolute path: ${error.message}`);
  }
}

function assertAbsolutePath(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(`${label} must be an absolute path.`);
  return path.resolve(value);
}

function parseCliArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--capture') {
      fail('CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE: Phase 1 cannot execute source capture.');
    }
    if (arg === '--plan') {
      values.plan = true;
      continue;
    }
    if (!['--artifact-root', '--roster', '--occurrences'].includes(arg)) fail(`unknown argument ${arg}.`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    values[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  if (!values.plan) fail('requires explicit --plan acknowledgement.');
  return {
    plan: true,
    artifactRoot: assertAbsoluteDurablePath(values.artifactRoot, '--artifact-root'),
    roster: assertAbsolutePath(values.roster, '--roster'),
    occurrences: values.occurrences ? assertAbsolutePath(values.occurrences, '--occurrences') : null,
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
}

function validateRoster(roster) {
  assertPlainObject(roster, 'roster');
  if (roster.schema_version !== 'M3_CORPUS_SOURCE_ROSTER/V1') fail('roster schema_version is invalid.');
  if (!Array.isArray(roster.deals) || roster.deals.length === 0) fail('roster must contain one or more deals.');
  const ids = new Set();
  for (const item of roster.deals) {
    assertPlainObject(item, 'roster deal');
    if (typeof item.deal_id !== 'string' || item.deal_id.length === 0) fail('every roster deal requires deal_id.');
    if (ids.has(item.deal_id)) fail(`roster deal_id ${item.deal_id} appears more than once.`);
    ids.add(item.deal_id);
  }
  return { dealIds: [...ids] };
}

function deriveGovernedRoster(input) {
  if (input?.schema_version === 'M3_CORPUS_SOURCE_ROSTER/V1') return input;
  if (input?._meta?.schema_version !== 'home-deal-directory/v1'
    || !isDigest(input._meta.source_digest) || !Array.isArray(input.deals)) {
    fail('roster must be M3_CORPUS_SOURCE_ROSTER/V1 or the committed home-deal-directory/v1.');
  }
  const roster = {
    schema_version: 'M3_CORPUS_SOURCE_ROSTER/V1',
    directory_source_digest: input._meta.source_digest,
    deals: input.deals.map((deal) => ({ deal_id: deal && deal.id })),
  };
  validateRoster(roster);
  return roster;
}

function validateOccurrences(declaration, rosterState) {
  if (!declaration) return [];
  assertPlainObject(declaration, 'occurrence declaration');
  if (declaration.schema_version !== 'M3_SOURCE_OCCURRENCE_DECLARATIONS/V1') fail('occurrence declaration schema_version is invalid.');
  if (!Array.isArray(declaration.occurrences) || declaration.occurrences.length === 0) fail('occurrence declaration must contain occurrences.');
  const occurrenceIds = new Set();
  return declaration.occurrences.map((item) => {
    assertPlainObject(item, 'occurrence');
    if (typeof item.occurrence_id !== 'string' || item.occurrence_id.length === 0) fail('every occurrence requires occurrence_id.');
    if (occurrenceIds.has(item.occurrence_id)) fail(`occurrence_id ${item.occurrence_id} appears more than once.`);
    if (!rosterState.dealIds.includes(item.deal_id)) fail(`occurrence ${item.occurrence_id} has a deal outside the roster.`);
    if (!isSecHttpsUrl(item.source_url)) fail(`occurrence ${item.occurrence_id} must declare an exact SEC HTTPS URL.`);
    occurrenceIds.add(item.occurrence_id);
    return { occurrence_id: item.occurrence_id, deal_id: item.deal_id, source_url: item.source_url };
  });
}

async function readExactRosterDeals() {
  fail('CONTROLLED_DATABASE_SNAPSHOT_READER_UNAVAILABLE: Phase 1 cannot query a database through caller-supplied boundaries.');
}

function buildDiscoveryRecords({ roster, deals, occurrences }) {
  const rosterState = validateRoster(roster);
  const declaredOccurrences = validateOccurrences(occurrences, rosterState);
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));
  const receivedOccurrences = deals.map((deal) => ({
    occurrence_id: `METADATA/${deal.id}`,
    deal_id: deal.id,
    source_url: deal.metadata.source_url,
  }));
  const additionalUrlsByDeal = new Map();
  for (const occurrence of declaredOccurrences) {
    const primaryUrl = dealById.get(occurrence.deal_id)?.metadata?.source_url;
    if (occurrence.source_url === primaryUrl) fail(`additional occurrence ${occurrence.occurrence_id} duplicates its metadata primary URL.`);
    const seen = additionalUrlsByDeal.get(occurrence.deal_id) || new Set();
    if (seen.has(occurrence.source_url)) fail(`additional occurrence ${occurrence.occurrence_id} duplicates another added occurrence URL.`);
    seen.add(occurrence.source_url);
    additionalUrlsByDeal.set(occurrence.deal_id, seen);
  }
  return [...receivedOccurrences, ...declaredOccurrences].map((occurrence) => {
    const deal = dealById.get(occurrence.deal_id);
    if (!deal) fail(`occurrence ${occurrence.occurrence_id} refers to undiscovered deal ${occurrence.deal_id}.`);
    const sourceMetadata = {
      source_url: occurrence.source_url,
      accession_number: deal.metadata.accession_number || null,
      filing_date: deal.metadata.filing_date || null,
    };
    const isAdditionalOccurrence = occurrence.occurrence_id.startsWith('METADATA/') === false;
    const payload = {
      occurrence_id: occurrence.occurrence_id,
      deal_id: deal.id,
      acquirer: deal.acquirer || null,
      target: deal.target || null,
      occurrence_kind: isAdditionalOccurrence ? 'DECLARED_ADDITIONAL_SEC_OCCURRENCE' : 'METADATA_PRIMARY_SEC_OCCURRENCE',
      stored_full_text_sha256: isAdditionalOccurrence ? null : sha256Hex(deal.metadata.full_text),
      primary_occurrence_relationship: isAdditionalOccurrence
        ? { status: 'UNCOMPARED', primary_occurrence_id: `METADATA/${deal.id}` }
        : null,
      source_metadata: sourceMetadata,
      admission_authority: 'NOT_ADMISSION_AUTHORITY',
      deal_admission_status: 'NOT_ATTEMPTED',
      source_admission_status: 'NOT_ATTEMPTED',
    };
    return { ...payload, discovery_id: contentId('M3_CORPUS_SOURCE_DISCOVERY_RECORD/V1', payload) };
  });
}

function validateCaptureReceipt(receipt) {
  const keys = [
    'schema_version', 'receipt_id', 'discovery_id', 'occurrence_id', 'raw_sha256',
    'capture_id', 'conversion_id', 'verification_id', 'admission_authority',
    'deal_admission_status', 'source_admission_status',
  ];
  if (!exactKeys(receipt, keys)
    || receipt.schema_version !== 'M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1'
    || !isDigest(receipt.receipt_id) || !isDigest(receipt.discovery_id)
    || typeof receipt.occurrence_id !== 'string' || receipt.occurrence_id.length === 0
    || !isDigest(receipt.raw_sha256) || !isDigest(receipt.capture_id)
    || !isDigest(receipt.conversion_id) || !isDigest(receipt.verification_id)
    || receipt.admission_authority !== 'NOT_ADMISSION_AUTHORITY'
    || receipt.deal_admission_status !== 'NOT_ATTEMPTED'
    || receipt.source_admission_status !== 'NOT_ATTEMPTED') fail('capture receipt is invalid.');
  const body = { ...receipt };
  delete body.receipt_id;
  if (receipt.receipt_id !== contentId('M3_CORPUS_SOURCE_CAPTURE_RECEIPT/V1', body)) fail('capture receipt identity is invalid.');
  return true;
}

function validateCohortCaptureManifest(manifest) {
  if (!exactKeys(manifest, [
    'schema_version', 'receipt_associations', 'admission_authority', 'deal_admission_status',
    'source_admission_status', 'cohort_capture_manifest_id',
  ]) || manifest.schema_version !== 'M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1'
    || !Array.isArray(manifest.receipt_associations) || manifest.receipt_associations.length === 0
    || manifest.receipt_associations.some((item) => !exactKeys(item, ['receipt_id', 'discovery_id', 'occurrence_id'])
      || !isDigest(item.receipt_id) || !isDigest(item.discovery_id)
      || typeof item.occurrence_id !== 'string' || item.occurrence_id.length === 0)
    || new Set(manifest.receipt_associations.map((item) => item.receipt_id)).size !== manifest.receipt_associations.length
    || new Set(manifest.receipt_associations.map((item) => item.occurrence_id)).size !== manifest.receipt_associations.length
    || manifest.admission_authority !== 'NOT_ADMISSION_AUTHORITY'
    || manifest.deal_admission_status !== 'NOT_ATTEMPTED'
    || manifest.source_admission_status !== 'NOT_ATTEMPTED') fail('cohort capture manifest is invalid.');
  const body = { ...manifest };
  delete body.cohort_capture_manifest_id;
  if (!isDigest(manifest.cohort_capture_manifest_id)
    || manifest.cohort_capture_manifest_id !== contentId('M3_CORPUS_SOURCE_CAPTURE_COHORT_MANIFEST/V1', body)) fail('cohort capture manifest identity is invalid.');
  return true;
}

async function captureDiscoveryRecords() {
  fail('CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE: source capture requires an adopted successor M1 contract, a controller-issued read-only database snapshot, and a registered capture worker.');
}

module.exports = {
  isSecHttpsUrl,
  parseCliArgs,
  validateRoster,
  deriveGovernedRoster,
  validateOccurrences,
  readExactRosterDeals,
  buildDiscoveryRecords,
  captureDiscoveryRecords,
  validateCaptureReceipt,
  validateCohortCaptureManifest,
};
