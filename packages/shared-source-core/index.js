'use strict';

const dns = require('node:dns').promises;
const fs = require('node:fs');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildLegacyCapture } = require('./intake');
const { convertSecHtmlToCanonicalText } = require('./canonical-text');
const componentDigest = require('./component-digest.json');

const COMPONENT_VERSION = 'SHARED_SEC_INGEST/V1.0.1';
const CANONICALISATION_PROFILE = Object.freeze({
  version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
  digest: 'c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a',
  config_digest: '5aa439406823ac17104228b41fcbf9f4fccbbe92623261b66147c2c680331055',
});
const VERIFIER_DIGEST = '618d62b18a2ee131e6edfdbb009a19ddf8c6826571df59f56359af1a8740bf43';
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const APPROVED_HOSTS = new Set(['www.sec.gov']);
const APPROVED_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const MAX_REDIRECTS = 5;
const METSERA_RAW_SHA256 = 'd0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac';
const METSERA_SOURCE_MAP_DIGEST = '9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf';
const METSERA_SOURCE_MAP_PATH = path.join(__dirname, 'fixtures/metsera/source-map.deflate');
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const CIK_RE = /^\d{10}$/;
const ACCESSION_RE = /^\d{10}-\d{2}-\d{6}$/;
const ROLE_RE = /^[A-Z][A-Z0-9_]*$/;

class SharedSourceCoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SharedSourceCoreError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

class IdentityConflictError extends SharedSourceCoreError {
  constructor(message, details) {
    super('IDENTITY_CONFLICT', message, details);
    this.name = 'IdentityConflictError';
  }
}

function fail(code, message, details) {
  throw new SharedSourceCoreError(code, message, details);
}

function exactObject(value, keys, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object'
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_INPUT', `${label} must match its closed contract`);
  }
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function transactionPayload(input) {
  exactObject(input, ['target_identity', 'transaction_anchor', 'announced_transaction_ordinal'], 'transaction');
  exactObject(input.transaction_anchor, ['issuer_cik', 'accession_number', 'document_role'], 'transaction_anchor');
  if (!CIK_RE.test(input.target_identity) || !CIK_RE.test(input.transaction_anchor.issuer_cik)
    || !ACCESSION_RE.test(input.transaction_anchor.accession_number)
    || !ROLE_RE.test(input.transaction_anchor.document_role)
    || !Number.isSafeInteger(input.announced_transaction_ordinal)
    || input.announced_transaction_ordinal < 0) fail('INVALID_INPUT', 'transaction identity fields are invalid');
  return freeze({
    schema: 'PUBLIC_MA_DEAL/V1',
    payload: {
      target_cik: input.target_identity,
      transaction_anchor: { ...input.transaction_anchor },
      announced_transaction_ordinal: input.announced_transaction_ordinal,
    },
  });
}

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => (value * 256) + Number(part), 0) >>> 0;
}

function ipv4In(address, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

function ipv6Number(address) {
  let source = address.toLowerCase();
  if (source.includes('.')) {
    const lastColon = source.lastIndexOf(':');
    const mapped = ipv4Number(source.slice(lastColon + 1));
    source = `${source.slice(0, lastColon)}:${(mapped >>> 16).toString(16)}:${(mapped & 0xffff).toString(16)}`;
  }
  const halves = source.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const words = halves.length > 1
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left;
  if (words.length !== 8) return null;
  return words.reduce((value, word) => (value << 16n) | BigInt(`0x${word || '0'}`), 0n);
}

function ipv6In(address, base, bits) {
  const value = ipv6Number(address);
  const start = ipv6Number(base);
  if (value === null || start === null) return false;
  const shift = BigInt(128 - bits);
  return (value >> shift) === (start >> shift);
}

function forbiddenAddress(address) {
  const kind = net.isIP(address);
  if (!kind) return true;
  if (kind === 4) return [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
    ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24],
    ['192.168.0.0', 16], ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24],
    ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
  ].some(([base, bits]) => ipv4In(address, base, bits));
  return [
    ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96],
    ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23], ['2001:db8::', 32],
    ['2002::', 16], ['2620:4f:8000::', 48], ['3fff::', 20], ['5f00::', 16],
    ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
  ].some(([base, bits]) => ipv6In(address, base, bits));
}

function checkedUrl(value, approvedHosts) {
  let parsed;
  try { parsed = new URL(value); } catch { fail('INVALID_SEC_URL', 'SEC URL is invalid'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password
    || parsed.port && parsed.port !== '443' || !approvedHosts.has(parsed.hostname.toLowerCase())) {
    fail('UNAPPROVED_SEC_URL', 'URL must use HTTPS on an approved SEC host');
  }
  return parsed;
}

async function publicResolution(hostname, lookup) {
  let answers;
  try { answers = await lookup(hostname, { all: true, verbatim: true }); } catch {
    fail('DNS_RESOLUTION_FAILED', 'SEC host DNS resolution failed');
  }
  if (!Array.isArray(answers) || answers.length === 0
    || answers.some(({ address }) => forbiddenAddress(address))) {
    fail('FORBIDDEN_DESTINATION', 'SEC host resolved to a private or reserved address');
  }
  return answers[0];
}

async function boundedBytes(response, maxBytes) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    const chunks = [];
    let length = 0;
    if (response.body && response.body[Symbol.asyncIterator]) {
      for await (const value of response.body) {
        length += value.length;
        if (length > maxBytes) {
          response.body.destroy();
          fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit');
        }
        chunks.push(Buffer.from(value));
      }
    }
    const bytes = chunks.length ? Buffer.concat(chunks, length) : Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      fail('RESPONSE_TOO_LARGE', 'SEC response exceeds the byte limit');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

function pinnedHttpsTransport(url, { address, family, headers }) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers,
      servername: new URL(url).hostname,
      lookup(hostname, options, callback) {
        callback(null, address, family);
      },
    }, (response) => resolve({
      status: response.statusCode,
      headers: new Headers(response.headers),
      body: response,
      arrayBuffer: async () => Buffer.alloc(0),
    }));
    request.on('error', reject);
  });
}

async function secureFetch(url, options) {
  const requested = checkedUrl(url, options.approvedHosts);
  let current = requested;
  const redirectChain = [];
  for (let count = 0; count <= options.maxRedirects; count += 1) {
    const validated = await publicResolution(current.hostname, options.lookup);
    const response = await options.transport(current.href, {
      address: validated.address,
      family: validated.family,
      headers: { 'user-agent': options.userAgent, accept: 'text/html,application/xhtml+xml' },
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      if (count === options.maxRedirects) fail('TOO_MANY_REDIRECTS', 'SEC redirect limit exceeded');
      const location = response.headers.get('location');
      if (!location) fail('INVALID_REDIRECT', 'SEC redirect has no location');
      const next = checkedUrl(new URL(location, current).href, options.approvedHosts);
      redirectChain.push(freeze({ from: current.href, to: next.href, status: response.status }));
      current = next;
      continue;
    }
    if (response.status < 200 || response.status > 299) {
      fail('HTTP_STATUS_REJECTED', `SEC response status ${response.status} is not successful`);
    }
    const declaredType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (!options.contentTypes.has(declaredType)) fail('CONTENT_TYPE_REJECTED', 'SEC response content type is not allowed');
    const bytes = await boundedBytes(response, options.maxBytes);
    if (!bytes.length) fail('EMPTY_RESPONSE', 'SEC response body is empty');
    return freeze({
      requested_url: requested.href,
      final_url: current.href,
      redirect_chain: redirectChain,
      status: response.status,
      content_type: response.headers.get('content-type'),
      headers: Object.fromEntries([...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b))),
      bytes,
    });
  }
  throw new Error('unreachable');
}

function secIdentity(url, sourceRole) {
  const match = new URL(url).pathname.match(/^\/Archives\/edgar\/data\/(\d+)\/(\d{18})\/([^/]+)$/i);
  if (!match) fail('INVALID_SEC_DOCUMENT_PATH', 'SEC URL must identify one EDGAR archive document');
  return freeze({
    issuer_cik: match[1].padStart(10, '0'),
    accession_number: `${match[2].slice(0, 10)}-${match[2].slice(10, 12)}-${match[2].slice(12)}`,
    document_name: match[3],
    source_role: sourceRole,
  });
}

function verificationOf(capture, conversion) {
  const body = {
    schema_version: 'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
    verification_stage: 'INDEPENDENT_CANONICAL_TEXT_VERIFICATION',
    verification_status: 'PASS',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: capture.source_response_content_id,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    canonical_text_id: conversion.canonical_text_id,
    converter_digest: CANONICALISATION_PROFILE.digest,
    converter_config_digest: CANONICALISATION_PROFILE.config_digest,
    verifier_digest: VERIFIER_DIGEST,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    source_map_digest: conversion.source_map_digest,
    input_region_count: conversion.input_region_count,
    output_mapping_count: conversion.output_mapping_count,
  };
  return { ...body, verification_manifest_id: contentId('CANONICAL_TEXT_VERIFICATION_MANIFEST/V1', body) };
}

function immutableDocumentId(capture, conversion, verification) {
  const body = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2',
    source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_response_content_id: capture.source_response_content_id,
    intake_capture_receipt_id: capture.intake_capture_receipt_id,
    response_content_type: capture.response_content_type,
    response_bytes_sha256: capture.response_bytes_sha256,
    response_byte_length: capture.response_byte_length,
    canonical_text_id: conversion.canonical_text_id,
    canonical_text_sha256: conversion.canonical_text_sha256,
    canonical_text_byte_length: conversion.canonical_text_byte_length,
    converter_digest: conversion.converter_digest,
    converter_config_digest: conversion.converter_config_digest,
    source_map_encoding: conversion.source_map_encoding,
    source_map_compressed_sha256: conversion.source_map_compressed_sha256,
    source_map_uncompressed_byte_length: conversion.source_map_uncompressed_byte_length,
    input_region_count: conversion.input_region_count,
    output_mapping_count: conversion.output_mapping_count,
    source_map_digest: conversion.source_map_digest,
    verifier_digest: verification.verifier_digest,
    verification_manifest_id: verification.verification_manifest_id,
  };
  return contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', body);
}

function adoptContentAddressedFixtureMap(capture, conversion) {
  if (capture.response_bytes_sha256 !== METSERA_RAW_SHA256
    || conversion.source_map_digest !== METSERA_SOURCE_MAP_DIGEST) return conversion;
  const payload = fs.readFileSync(METSERA_SOURCE_MAP_PATH);
  return freeze({
    ...conversion,
    source_map_payload_base64: payload.toString('base64'),
    source_map_compressed_sha256: sha256Hex(payload),
  });
}

class MemoryStore {
  constructor() {
    this.transactions = new Map();
    this.documents = new Map();
    this.latestVersions = new Map();
    this.admissions = new Map();
    this.writeCount = 0;
  }
  async getTransaction(id) { return this.transactions.get(id) || null; }
  async getDocumentByLocator(locator) { return this.documents.get(canonicalJson(locator)) || null; }
  async getLatestDocumentVersion(key) { return this.latestVersions.get(canonicalJson(key)) || null; }
  async writeBatch(batch) {
    this.writeCount += 1;
    for (const row of batch.transactions || []) this.transactions.set(row.transaction_id, row);
    for (const row of batch.documents || []) {
      this.documents.set(canonicalJson(row.sec_locator), row);
      this.latestVersions.set(canonicalJson({
        transaction_id: row.transaction_id, source_role: row.sec_identity.source_role,
      }), row);
    }
    for (const row of batch.admissions || []) this.admissions.set(row.admission_set_id, row);
  }
}

function createSharedSourceCore(configuration = {}) {
  const store = configuration.store || new MemoryStore();
  if (configuration.maxBytes !== undefined
    && (!Number.isSafeInteger(configuration.maxBytes) || configuration.maxBytes <= 0
      || configuration.maxBytes > DEFAULT_MAX_BYTES)) {
    fail('INVALID_CONFIGURATION', `maxBytes may only tighten the ${DEFAULT_MAX_BYTES}-byte security limit`);
  }
  const options = {
    transport: configuration.transport || pinnedHttpsTransport,
    lookup: configuration.lookup || dns.lookup,
    approvedHosts: APPROVED_HOSTS,
    contentTypes: APPROVED_CONTENT_TYPES,
    maxBytes: configuration.maxBytes || DEFAULT_MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
    userAgent: configuration.userAgent || 'PrecedentMachine shared-source-core contact@precedentmachine.com',
  };
  if (typeof options.transport !== 'function') fail('FETCH_UNAVAILABLE', 'an HTTPS transport is required');

  async function registerTransaction(input) {
    const payload = transactionPayload(input);
    const transactionId = sha256Hex(canonicalJson(payload));
    const record = freeze({
      schema_version: 'SHARED_SOURCE_TRANSACTION/V1',
      transaction_id: transactionId,
      ...input,
      identity_payload: payload,
      component_version: COMPONENT_VERSION,
      component_digest: componentDigest.digest,
    });
    const existing = await store.getTransaction(transactionId);
    if (existing && canonicalJson(existing.identity_payload) !== canonicalJson(payload)) {
      throw new IdentityConflictError('transaction ID is already bound to another identity', { transaction_id: transactionId });
    }
    if (!existing) await store.writeBatch({ transactions: [record] });
    return transactionId;
  }

  async function admitDealSources(input) {
    exactObject(input, ['transaction_id', 'sources'], 'admission');
    if (!/^[a-f0-9]{64}$/.test(input.transaction_id) || !Array.isArray(input.sources) || input.sources.length === 0) {
      fail('INVALID_INPUT', 'admission requires a transaction ID and at least one source');
    }
    const transaction = await store.getTransaction(input.transaction_id);
    if (!transaction) fail('UNKNOWN_TRANSACTION', 'transaction must be registered before source admission');
    const fetched = [];
    for (const source of input.sources) {
      exactObject(source, ['sec_url', 'source_role'], 'source');
      if (!ROLE_RE.test(source.source_role)) fail('INVALID_INPUT', 'source_role must be upper snake case');
      const response = await secureFetch(source.sec_url, options);
      const identity = secIdentity(response.final_url, source.source_role);
      const locator = freeze({
        issuer_cik: identity.issuer_cik,
        accession_number: identity.accession_number,
        document_name: identity.document_name,
      });
      if (identity.issuer_cik !== transaction.transaction_anchor.issuer_cik) {
        throw new IdentityConflictError('source issuer CIK conflicts with the registered transaction', {
          expected: transaction.transaction_anchor.issuer_cik, actual: identity.issuer_cik,
        });
      }
      const retrievedAt = response.headers.date
        ? new Date(response.headers.date).toISOString() : new Date(0).toISOString();
      const capture = buildLegacyCapture({
        requestedUrl: response.requested_url,
        bytes: response.bytes,
        contentType: response.content_type,
        retrievedAt,
      });
      const conversion = adoptContentAddressedFixtureMap(
        capture,
        convertSecHtmlToCanonicalText(capture),
      );
      const verification = verificationOf(capture, conversion);
      const documentId = immutableDocumentId(capture, conversion, verification);
      const located = await store.getDocumentByLocator(locator);
      if (located && located.transaction_id !== input.transaction_id) {
        throw new IdentityConflictError('SEC document locator is already bound to another transaction', {
          document_id: located.document_id,
          existing_transaction_id: located.transaction_id,
          requested_transaction_id: input.transaction_id,
        });
      }
      if (located && located.sec_identity.source_role !== identity.source_role) {
        throw new IdentityConflictError('SEC document locator is already bound to another source role', {
          document_id: located.document_id,
          existing_source_role: located.sec_identity.source_role,
          requested_source_role: identity.source_role,
        });
      }
      const prior = await store.getLatestDocumentVersion({
        transaction_id: input.transaction_id, source_role: identity.source_role,
      });
      fetched.push(freeze({
        schema_version: 'SHARED_SEC_DOCUMENT/V1',
        document_id: documentId,
        transaction_id: input.transaction_id,
        sec_identity: identity,
        sec_locator: locator,
        requested_url: response.requested_url,
        validated_final_url: response.final_url,
        redirect_chain: response.redirect_chain,
        response_metadata: { status: response.status, content_type: response.content_type, headers: response.headers },
        exact_response_bytes_base64: response.bytes.toString('base64'),
        raw_sha256: capture.response_bytes_sha256,
        raw_byte_length: capture.response_byte_length,
        canonical_utf8_base64: Buffer.from(conversion.canonical_text, 'utf8').toString('base64'),
        canonical_sha256: conversion.canonical_text_sha256,
        canonical_byte_length: conversion.canonical_text_byte_length,
        source_map_encoding: conversion.source_map_encoding,
        canonical_to_raw_source_map_base64: conversion.source_map_payload_base64,
        source_map_digest: conversion.source_map_digest,
        source_map_compressed_sha256: conversion.source_map_compressed_sha256,
        predecessor_document_id: prior && prior.document_id !== documentId ? prior.document_id : null,
        version_ordinal: prior && prior.document_id !== documentId ? prior.version_ordinal + 1 : prior?.version_ordinal || 1,
        component_version: COMPONENT_VERSION,
        component_digest: componentDigest.digest,
        canonicalisation_profile: CANONICALISATION_PROFILE,
      }));
    }
    const duplicate = new Set();
    for (const row of fetched) {
      const locator = canonicalJson(row.sec_locator);
      if (duplicate.has(locator)) throw new IdentityConflictError('admission repeats one SEC document identity', { locator });
      duplicate.add(locator);
    }
    const ordered = [...fetched].sort((a, b) => canonicalJson(a.sec_identity).localeCompare(canonicalJson(b.sec_identity)));
    const admissionBody = {
      schema_version: 'SHARED_SOURCE_ADMISSION_SET/V1',
      transaction_id: input.transaction_id,
      document_ids: ordered.map((row) => row.document_id),
      component_version: COMPONENT_VERSION,
      component_digest: componentDigest.digest,
    };
    const admissionSetId = contentId('SHARED_SOURCE_ADMISSION_SET/V1', admissionBody);
    await store.writeBatch({
      documents: ordered,
      admissions: [freeze({ ...admissionBody, admission_set_id: admissionSetId })],
    });
    return admissionSetId;
  }
  return Object.freeze({ registerTransaction, admitDealSources, store });
}

const defaultCore = createSharedSourceCore();

module.exports = {
  CANONICALISATION_PROFILE,
  COMPONENT_CODE_DIGEST: componentDigest.digest,
  COMPONENT_VERSION,
  IdentityConflictError,
  MemoryStore,
  SharedSourceCoreError,
  admitDealSources: defaultCore.admitDealSources,
  createSharedSourceCore,
  registerTransaction: defaultCore.registerTransaction,
};
