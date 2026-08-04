'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const SCHEMA = 'IDENTITY_CONSUMER_CLOSURE_AUDIT/V2';
const ROOT = path.resolve(__dirname, '../..');

// These are the public boundary symbols. The audit discovers production
// references to them. It does not treat a hand-maintained list of consumers
// as proof of closure.
const IDENTITY_BOUNDARY_SYMBOLS = Object.freeze([
  'validateV2DealIdentityAuthorityEvidence',
  'requireIssuedIdentityConsumerEvidence',
  'buildSourceUniverseInventoryCandidate',
  'buildSourceUniverseInventory',
  'buildSnapshotForDeal',
  'buildV1V2ComparisonReceipt',
  'buildV1V2ComparisonDiagnostic',
]);
const PUBLIC_ENTRY_PATHS = Object.freeze([
  'lib/canonical-v2/governed-identity-proposal-packet.js',
  'lib/canonical-v2/deal-identity-allocation-readiness.js',
  'lib/canonical-v2/deal-source-binding.js',
  'lib/canonical-v2/source-universe-inventory-candidate.js',
  'lib/canonical-v2/source-universe-inventory-planner.js',
  'lib/canonical-v2/native-producer/v1v2-comparator.js',
  'scripts/export-v1-provision-snapshot.mjs',
]);

function productionFiles(root) {
  const files = [];
  for (const directory of ['lib', 'scripts']) {
    const absoluteDirectory = path.join(root, directory);
    if (!fs.existsSync(absoluteDirectory)) continue;
    const visit = (absolute) => {
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        const child = path.join(absolute, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (/\.(?:c?js|mjs)$/.test(entry.name)) files.push(child);
      }
    };
    visit(absoluteDirectory);
  }
  return files.sort();
}

function relative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function referencesIn(source) {
  return IDENTITY_BOUNDARY_SYMBOLS.filter((symbol) => new RegExp(`\\b${symbol}\\b`).test(source));
}

function classifyConsumer(relativePath, referencedSymbols) {
  const references = new Set(referencedSymbols);
  if (relativePath === 'lib/canonical-v2/governed-identity-proposal-packet.js') return 'AUTHORITY_EVIDENCE_VALIDATOR';
  if (relativePath === 'lib/canonical-v2/deal-identity-allocation-readiness.js') return 'ISSUED_EVIDENCE_GATE';
  if (references.has('requireIssuedIdentityConsumerEvidence')) return 'ISSUED_EVIDENCE_GATE_CALLER';
  if (references.has('buildV1V2ComparisonReceipt')) return 'AUTHORITATIVE_COMPARATOR_CALLER';
  if (relativePath === 'lib/canonical-v2/source-universe-inventory-planner.js') return 'NON_AUTHORITATIVE_PLANNER';
  return null;
}

function discoverIdentityConsumerReferences({ repository_root: root = ROOT } = {}) {
  const entries = new Map();
  for (const absolute of productionFiles(root)) {
    const consumerPath = relative(root, absolute);
    if (consumerPath === 'lib/canonical-v2/identity-consumer-closure-audit.js') continue;
    const bytes = fs.readFileSync(absolute);
    const source = bytes.toString('utf8');
    const referencedSymbols = referencesIn(source);
    if (referencedSymbols.length === 0 && !PUBLIC_ENTRY_PATHS.includes(consumerPath)) continue;
    entries.set(consumerPath, Object.freeze({
      consumer_path: consumerPath,
      referenced_symbols: Object.freeze(referencedSymbols),
      classification: classifyConsumer(consumerPath, referencedSymbols),
      source_sha256: sha256Hex(bytes),
    }));
  }
  for (const entryPath of PUBLIC_ENTRY_PATHS) {
    if (!entries.has(entryPath)) {
      entries.set(entryPath, Object.freeze({
        consumer_path: entryPath,
        referenced_symbols: Object.freeze([]),
        classification: null,
        source_sha256: null,
      }));
    }
  }
  return Object.freeze([...entries.values()].sort((left, right) => left.consumer_path.localeCompare(right.consumer_path)));
}

function buildIdentityConsumerClosureAudit({ repository_root: root = ROOT } = {}) {
  const discovered = discoverIdentityConsumerReferences({ repository_root: root });
  const consumers = discovered
    .filter((entry) => entry.classification !== null)
    .map((entry) => Object.freeze({ ...entry }));
  const unclassified = discovered
    .filter((entry) => entry.classification === null)
    .map((entry) => Object.freeze({ ...entry }));
  const body = {
    schema_version: SCHEMA,
    status: unclassified.length === 0
      ? 'DISCOVERED_PRODUCTION_CONSUMER_INDEX_NOT_AUTHORITY'
      : 'UNCLASSIFIED_IDENTITY_CONSUMERS_REQUIRE_REVIEW',
    consumers: Object.freeze(consumers),
    unclassified_identity_consumers: Object.freeze(unclassified),
    admission_authority: 'NONE',
    export_authority: 'NONE',
    production_authority: 'NONE',
  };
  return Object.freeze({ ...body, identity_consumer_closure_audit_id: contentId(SCHEMA, body) });
}

function validateIdentityConsumerClosureAudit(audit, { repository_root: root = ROOT } = {}) {
  const expected = buildIdentityConsumerClosureAudit({ repository_root: root });
  if (canonicalJson(audit) !== canonicalJson(expected)) throw new Error('identity consumer closure audit is stale or incomplete');
  return expected;
}

module.exports = {
  SCHEMA,
  IDENTITY_BOUNDARY_SYMBOLS,
  PUBLIC_ENTRY_PATHS,
  discoverIdentityConsumerReferences,
  buildIdentityConsumerClosureAudit,
  validateIdentityConsumerClosureAudit,
};
